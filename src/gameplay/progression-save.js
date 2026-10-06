// Fish Up — META: the player profile, its save format and a defensive loader (pure; node-importable).
//
// Save file = localStorage[SAVE_KEY] = JSON { v: SAVE_VERSION, savedAt, player: {…persisted fields…} }.
// sanitize() accepts ANYTHING (old versions, hand-edited, truncated, wrong types) and always returns a
// complete, valid profile: unknown ids are dropped, numbers clamped, missing fields defaulted. Derived
// fields (stats, level, boatTier) are never trusted from the file — progression.js recomputes them.
import { DEFAULT_STATS, BIOMES, ZONES } from '../core/config.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { LURES, LURES_BY_ID } from '../data/lures.js';
import { GEAR, ITEMS_BY_ID, STARTER_GEAR, EQUIP_SLOTS } from '../data/gear.js';
import { ACHIEVEMENTS } from '../data/quests.js';
import { BOTTLE_NOTES } from './progression-notes.js';
import { levelForXp } from './progression-score.js';
import { validQuest } from './progression-quests.js';

export const SAVE_VERSION = 1;

const TOTAL_KEYS = [
  'caught', 'items', 'lost', 'coinsEarned', 'playTimeS', 'longestStreak', 'perfect', 'night', 'rain', 'storm',
  'junk', 'bottles', 'chests', 'pearls', 'released', 'shiny', 'trophies', 'legendary', 'heaviestKg', 'maxDepthM',
  'wreck', 'vents', 'questsDone', 'purchases',
];
const GEAR_IDS = new Set(GEAR.map((g) => g.id));
const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const STARTER_IDS = Object.values(STARTER_GEAR);

export function freshTotals() {
  const t = {};
  for (const k of TOTAL_KEYS) t[k] = 0;
  t.biomes = Object.fromEntries(BIOMES.map((b) => [b.id, 0]));
  t.zones = Object.fromEntries(ZONES.map((z) => [z.id, 0]));
  return t;
}

/** A brand-new profile: every key of createPlayerState() plus META's own fields. */
export function freshProfile() {
  return {
    // ── kernel keys (src/gameplay/state.js) ──
    coins: 0,
    score: 0,
    xp: 0,
    level: 1,
    lureId: 'worm',
    lures: ['worm'],
    boatTier: 0,
    stats: { ...DEFAULT_STATS },
    dex: {},
    // ── META ──
    /** Equipped catalogue id per gear slot. */
    gear: { ...STARTER_GEAR },
    /** Owned gear + gadget ids (lures live in `lures`). */
    owned: [...STARTER_IDS],
    /** The 3 active quests. */
    quests: [],
    questSeq: 0,
    /** achievementId → day it was unlocked. */
    achievements: {},
    /** Persistent day counter (env.day restarts every session). */
    day: 1,
    /** Consecutive landed catches (own count; the catch event's streak wins when present). */
    streak: 0,
    totals: freshTotals(),
    /** Heaviest animal ever: { speciesId, weightKg } */
    biggest: null,
    /** Highest-scoring catch ever: { speciesId, points } */
    best: null,
    /** Bottle notes already read (indices into BOTTLE_NOTES). */
    notesRead: [],
  };
}

/** The persisted part of a profile, wrapped with the version. */
export function serialize(p) {
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    player: {
      coins: p.coins, score: p.score, xp: p.xp,
      lureId: p.lureId, lures: p.lures,
      dex: p.dex, gear: p.gear, owned: p.owned,
      quests: p.quests, questSeq: p.questSeq,
      achievements: p.achievements, day: p.day, streak: p.streak,
      totals: p.totals, biggest: p.biggest, best: p.best, notesRead: p.notesRead,
    },
  };
}

// ── sanitising helpers ──
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, def = 0, min = 0, max = 1e12) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const int = (v, def = 0, min = 0, max = 1e9) => Math.floor(num(v, def, min, max));

/**
 * Turn any parsed JSON into a valid profile. Never throws for JSON input.
 * @param {*} raw  parsed save (either {v, player} or, for very old saves, the bare player object)
 * @returns {{profile: object, warnings: string[]}}
 */
export function sanitize(raw) {
  const warnings = [];
  const p = freshProfile();
  let src = isObj(raw) && isObj(raw.player) ? raw.player : raw;
  if (!isObj(src)) {
    warnings.push('save is not an object');
    return { profile: p, warnings };
  }
  if (isObj(raw) && typeof raw.v === 'number' && raw.v > SAVE_VERSION) warnings.push(`save version ${raw.v} is newer than ${SAVE_VERSION}: loading what we understand`);

  p.coins = Math.floor(num(src.coins));
  p.score = Math.floor(num(src.score));
  p.xp = Math.floor(num(src.xp));
  p.level = levelForXp(p.xp);

  // lures: known ids, worm always, LURES order
  const lureSet = new Set(['worm']);
  if (Array.isArray(src.lures)) for (const id of src.lures) if (LURES_BY_ID[id]) lureSet.add(id);
  p.lures = LURES.filter((l) => lureSet.has(l.id)).map((l) => l.id);
  p.lureId = lureSet.has(src.lureId) ? src.lureId : 'worm';

  // gear
  const owned = new Set(STARTER_IDS);
  if (Array.isArray(src.owned)) for (const id of src.owned) if (GEAR_IDS.has(id)) owned.add(id);
  p.owned = GEAR.filter((g) => owned.has(g.id)).map((g) => g.id);
  const gear = isObj(src.gear) ? src.gear : {};
  for (const slot of EQUIP_SLOTS) {
    const id = gear[slot];
    p.gear[slot] = owned.has(id) && ITEMS_BY_ID[id].slot === slot ? id : STARTER_GEAR[slot];
  }

  // dex
  if (isObj(src.dex)) {
    for (const id in src.dex) {
      const e = src.dex[id];
      if (!SPECIES_BY_ID[id] || !isObj(e)) continue;
      const count = int(e.count);
      if (count <= 0) continue;
      p.dex[id] = {
        count,
        bestLengthCm: num(e.bestLengthCm),
        bestWeightKg: num(e.bestWeightKg),
        bestPoints: Math.floor(num(e.bestPoints)),
        shinyCount: int(e.shinyCount, 0, 0, count),
        firstDay: int(e.firstDay, 1, 1),
      };
    }
  }

  // quests (the module tops them up to 3 with fresh ones)
  if (Array.isArray(src.quests)) {
    for (const q of src.quests) {
      if (p.quests.length >= 3) break;
      if (!validQuest(q) || q.claimed === true || p.quests.some((o) => o.id === q.id)) continue;
      const progress = Math.min(q.goal, q.progress);
      p.quests.push({
        id: q.id, type: q.type, target: q.target === undefined ? null : q.target, title: q.title, desc: q.desc,
        progress, goal: q.goal, reward: { coins: Math.floor(q.reward.coins), xp: Math.floor(q.reward.xp) },
        done: progress >= q.goal, claimed: false, effort: num(q.effort),
      });
    }
  }
  let seq = int(src.questSeq);
  for (const q of p.quests) seq = Math.max(seq, parseInt(String(q.id).replace(/\D/g, ''), 10) || 0);
  p.questSeq = seq;

  if (isObj(src.achievements)) for (const id in src.achievements) if (ACH_IDS.has(id)) p.achievements[id] = int(src.achievements[id], 1, 1);

  p.day = int(src.day, 1, 1);
  p.streak = int(src.streak);

  const t = isObj(src.totals) ? src.totals : {};
  for (const k of TOTAL_KEYS) p.totals[k] = num(t[k]);
  for (const k in p.totals.biomes) p.totals.biomes[k] = int(isObj(t.biomes) ? t.biomes[k] : 0);
  for (const k in p.totals.zones) p.totals.zones[k] = int(isObj(t.zones) ? t.zones[k] : 0);

  if (isObj(src.biggest) && SPECIES_BY_ID[src.biggest.speciesId] && num(src.biggest.weightKg, -1) > 0) {
    p.biggest = { speciesId: src.biggest.speciesId, weightKg: num(src.biggest.weightKg) };
  }
  if (isObj(src.best) && SPECIES_BY_ID[src.best.speciesId] && num(src.best.points, -1) > 0) {
    p.best = { speciesId: src.best.speciesId, points: Math.floor(num(src.best.points)) };
  }
  if (Array.isArray(src.notesRead)) {
    p.notesRead = [...new Set(src.notesRead.filter((i) => Number.isInteger(i) && i >= 0 && i < BOTTLE_NOTES.length))];
  }
  return { profile: p, warnings };
}
