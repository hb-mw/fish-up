// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — META: scoring, economy, gear, levels, quests, achievements, Fishdex and the save file.
// Pure logic: no rendering, no DOM (apart from the save hooks on visibilitychange/pagehide).
//
// Owns game.player (mutated in place — the object, its `stats`, `lures` and `dex` keep their identity).
// Listens:  'catch' → scores it · 'fightEnd' (lost fish, streaks) · 'newDay' (days at sea) · 'ready'
// Emits:    'coins' 'xp' 'dexNew' 'record' 'levelUp' → 'catchScored' {record} → 'questProgress'
//           'questComplete' 'achievement' · 'purchase' 'equip' · 'profileReset'
// Scoring formula: see src/gameplay/progression-score.js. Gear/stat model: src/data/gear.js.
// ─────────────────────────────────────────────────────────────────────────────
import { SAVE_KEY, biomeAt, zoneAt, WORLD } from '../core/config.js';
import { createRng } from '../core/rng.js';
import { SPECIES, SPECIES_BY_ID, ANIMALS, lengthFor, weightFor } from '../data/species.js';
import { LURES, LURES_BY_ID, lureAffinity } from '../data/lures.js';
import { LANDMARKS } from '../world/terrain.js';
import {
  ALL_ITEMS, ITEMS_BY_ID, itemById, computeStats, boatTierOf, EQUIP_SLOTS, LURE_SHOP, GEAR,
} from '../data/gear.js';
import { ACHIEVEMENTS, speciesFound } from '../data/quests.js';
import { scoreCatch, levelInfo, levelForXp, xpAt, titleOf, MAX_LEVEL, rarityInfo } from './progression-score.js';
import { generateQuest, questOnCatch, computeReach } from './progression-quests.js';
import { freshProfile, serialize, sanitize } from './progression-save.js';
import { nextBottleNote, chestNote, pearlNote } from './progression-notes.js';

const SAVE_DELAY_MS = 1200;
const PLAY_SAVE_EVERY_S = 20;
const CHEST_LURE_CHANCE = 0.3;
const MINUS = '−';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const r1 = (v) => Math.round(v * 10) / 10;

// ── catalogue stat lines ─────────────────────────────────────────────────────────────────────────
const FMT = {
  tackle: { label: 'Tackle', f: (v) => v.toFixed(1), d: (v) => v.toFixed(1) },
  castPower: { label: 'Cast', f: (v) => '×' + v.toFixed(2), d: (v) => v.toFixed(2) },
  rodControl: { label: 'Control', f: (v) => Math.round(v * 100) + '%', d: (v) => Math.round(v * 100) + '%' },
  reelSpeed: { label: 'Retrieve', f: (v) => '×' + (v / 300).toFixed(2), d: (v) => (v / 300).toFixed(2) },
  dragSmooth: { label: 'Drag', f: (v) => Math.round(v * 100) + '%', d: (v) => Math.round(v * 100) + '%' },
  lineLengthM: { label: 'Length', f: (v) => Math.round(v) + ' m', d: (v) => Math.round(v) + ' m' },
  boatSpeed: { label: 'Top speed', f: (v) => Math.round(v / 20) + ' kn', d: (v) => Math.round(v / 20) + ' kn' },
  sinkBonus: { label: 'Sink speed', f: (v) => '+' + Math.round(v * 100) + '%', d: (v) => Math.round(v * 100) + '%' },
  hookWindowBonus: { label: 'Bite window', f: (v) => '+' + v.toFixed(2) + ' s', d: (v) => v.toFixed(2) + ' s' },
  sonar: { label: 'Sonar', f: (v) => ['Off', 'Fish blips', 'Blips + rarity'][v] || String(v), d: (v) => String(v) },
  lamp: { label: 'Night lamp', f: (v) => ['Off', 'Lantern', 'Floodlight'][v] || String(v), d: (v) => String(v) },
  luck: { label: 'Luck', f: (v) => '+' + Math.round(v * 100) + '%', d: (v) => Math.round(v * 100) + '%' },
};
const SLOT_KEYS = {
  rod: ['tackle', 'castPower', 'rodControl'],
  reel: ['reelSpeed', 'dragSmooth'],
  line: ['lineLengthM', 'tackle'],
  boat: ['boatSpeed'],
};
const sinkWord = (sink) => (sink < 140 ? 'Slow' : sink < 190 ? 'Medium' : sink < 260 ? 'Fast' : 'Very fast');

/**
 * @param {object} game  the kernel game object
 */
export function createProgression(game) {
  const events = game.events;
  const player = game.player;
  const flags = game.flags || {};
  const noSave = flags.nosave === '1';
  const rng = game.rng && game.rng.fork ? game.rng.fork() : createRng((Date.now() ^ 0x5eed) >>> 0);
  const hasWindow = typeof window !== 'undefined';
  const hasDoc = typeof document !== 'undefined';

  let saveTimer = null;
  let dirty = false;
  let playSaveT = 0;
  let checkT = 0;
  let savedOnce = false;

  // ── storage (never throws) ──
  const store = {
    get() {
      try { return globalThis.localStorage ? globalThis.localStorage.getItem(SAVE_KEY) : null; } catch { return null; }
    },
    set(str) {
      try { globalThis.localStorage.setItem(SAVE_KEY, str); return true; } catch (e) { console.warn('[progression] save failed', e); return false; }
    },
    remove() {
      try { globalThis.localStorage && globalThis.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    },
    backup(str) {
      try { globalThis.localStorage.setItem(SAVE_KEY + '.corrupt', String(str).slice(0, 200000)); } catch { /* ignore */ }
    },
  };

  // ── profile ─────────────────────────────────────────────────────────────────────────────────────
  /** Copy a profile into game.player, preserving the identity of player / stats / lures / dex. */
  function applyProfile(prof) {
    const stats = isPlainObj(player.stats) ? player.stats : {};
    const lures = Array.isArray(player.lures) ? player.lures : [];
    const dex = isPlainObj(player.dex) ? player.dex : {};
    Object.assign(player, prof);
    lures.length = 0;
    lures.push(...prof.lures);
    player.lures = lures;
    for (const k in dex) delete dex[k];
    Object.assign(dex, prof.dex);
    player.dex = dex;
    player.stats = stats;
    player.level = levelForXp(player.xp);
    recomputeStats();
  }

  function load() {
    if (noSave) return null;
    const raw = store.get();
    if (!raw) return null;
    try {
      const { profile, warnings } = sanitize(JSON.parse(raw));
      for (const w of warnings) console.warn('[progression] ' + w);
      savedOnce = true;
      return profile;
    } catch (e) {
      console.warn('[progression] save file is unreadable: starting a fresh profile (kept a copy in ' + SAVE_KEY + '.corrupt)', e);
      store.backup(raw);
      return null;
    }
  }

  function gadgetsOwned() {
    return player.owned.filter((id) => ITEMS_BY_ID[id] && ITEMS_BY_ID[id].slot === 'gadget');
  }

  /** stats = pure function of equipped gear; mirrors boatTier to the boat. */
  function recomputeStats() {
    const s = computeStats(player.gear, gadgetsOwned());
    for (const k in player.stats) if (!(k in s)) delete player.stats[k];
    Object.assign(player.stats, s);
    player.boatTier = boatTierOf(player.gear);
    mirror();
  }

  function mirror() {
    if (game.boat) game.boat.tier = player.boatTier;
    const f = game.fishing;
    if (f && f.lure && (f.state === 'idle' || f.state === undefined) && f.lure.id !== player.lureId) f.lure.id = player.lureId;
  }

  function validateLure() {
    if (!Array.isArray(player.lures) || !player.lures.length) {
      player.lures = ['worm'];
    }
    if (!player.lures.includes(player.lureId)) player.lureId = player.lures[0];
  }

  function ensureQuests() {
    player.quests = player.quests.filter((q) => q && !q.claimed).slice(0, 3);
    while (player.quests.length < 3) {
      player.questSeq = (player.questSeq | 0) + 1;
      player.quests.push(generateQuest(player, rng, player.quests, player.questSeq));
    }
  }

  // ── saving ──────────────────────────────────────────────────────────────────────────────────────
  function hasProgress() {
    const t = player.totals;
    return player.xp > 0 || player.coins > 0 || t.caught > 0 || t.items > 0 || t.purchases > 0 || player.owned.length > 4;
  }
  function save() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    dirty = false;
    if (noSave) return false;
    let ok = false;
    try {
      ok = store.set(JSON.stringify(serialize(player)));
    } catch (e) {
      console.warn('[progression] could not serialise the profile', e);
    }
    if (ok) savedOnce = true;
    return ok;
  }
  /** Debounced autosave: one write ~1.2 s after the first change of a burst. */
  function saveSoon() {
    dirty = true;
    if (noSave || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty) save();
    }, SAVE_DELAY_MS);
  }
  function flush() {
    if (dirty || (hasProgress() && !noSave)) save();
  }
  if (hasDoc) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }
  if (hasWindow) window.addEventListener('pagehide', flush);

  // ── XP / levels ─────────────────────────────────────────────────────────────────────────────────
  function unlockedBetween(from, to) {
    return ALL_ITEMS.filter((it) => it.unlockLevel > from && it.unlockLevel <= to).map((it) => it.id);
  }
  /**
   * Add XP; pushes the 'xp' event into `out` and returns the levelUp payload (or null) — the caller decides
   * where the 'levelUp' event goes in the emit order.
   */
  function addXp(delta, out) {
    delta = Math.max(0, Math.round(delta));
    const before = player.level;
    player.xp += delta;
    player.level = levelForXp(player.xp);
    out.push(['xp', { delta, total: player.xp }]);
    if (player.level > before) {
      return { level: player.level, title: titleOf(player.level), unlocked: unlockedBetween(before, player.level) };
    }
    return null;
  }
  function addCoins(delta, reason, out) {
    delta = Math.round(delta);
    player.coins = Math.max(0, player.coins + delta);
    if (delta > 0) player.totals.coinsEarned += delta;
    out.push(['coins', { delta, total: player.coins, reason }]);
  }

  // ── achievements ────────────────────────────────────────────────────────────────────────────────
  function achValue(a) {
    try {
      const v = a.value(player);
      return finite(v) ? v : 0;
    } catch {
      return 0;
    }
  }
  function publicAch(a) {
    const unlocked = !!player.achievements[a.id];
    const masked = a.hidden && !unlocked;
    return {
      id: a.id,
      title: masked ? '???' : a.title,
      desc: masked ? a.hint || 'A hidden achievement. Keep exploring…' : a.desc,
      unlocked,
      hidden: !!a.hidden,
      progress: unlocked ? a.goal : Math.min(a.goal, Math.floor(achValue(a))),
      goal: a.goal,
    };
  }
  /** Unlock everything newly earned; pushes 'achievement' events into `out` (if given). */
  function checkAchievements(out) {
    for (const a of ACHIEVEMENTS) {
      if (player.achievements[a.id]) continue;
      if (achValue(a) >= a.goal) {
        player.achievements[a.id] = player.day;
        if (out) out.push(['achievement', { achievement: publicAch(a) }]);
      }
    }
  }

  // ── quests ──────────────────────────────────────────────────────────────────────────────────────
  function publicQuest(q) {
    return {
      id: q.id, type: q.type, target: q.target, title: q.title, desc: q.desc,
      progress: q.type === 'weight' ? r1(q.progress) : Math.floor(q.progress),
      goal: q.goal, reward: { coins: q.reward.coins, xp: q.reward.xp }, done: !!q.done, claimed: !!q.claimed,
    };
  }

  // ── the catch ───────────────────────────────────────────────────────────────────────────────────
  /** Depth (m) at which each fish took the lure, by fish.uid — in case 'catch' reports the landing depth. */
  const hookDepth = new Map();
  function rememberHookDepth(p) {
    const fish = p && p.fish;
    if (!fish || fish.uid === undefined) return;
    const lure = game.fishing && game.fishing.lure;
    const d = finite(fish.y) && fish.y > 0 ? fish.y / WORLD.pxPerM : lure && finite(lure.depthM) ? lure.depthM : 0;
    if (hookDepth.size > 64) hookDepth.clear();
    hookDepth.set(fish.uid, Math.max(0, d));
  }

  function catchContext(e, fish) {
    const boatX = game.boat && finite(game.boat.x) ? game.boat.x : finite(fish.x) ? fish.x : WORLD.startX;
    const reported = finite(e.depthM) ? e.depthM : finite(fish.y) ? fish.y / WORLD.pxPerM : 0;
    const hooked = fish.uid !== undefined && hookDepth.has(fish.uid) ? hookDepth.get(fish.uid) : 0;
    if (fish.uid !== undefined) hookDepth.delete(fish.uid);
    const depthM = Math.max(0, reported, hooked);
    const env = game.env || {};
    return {
      boatX,
      depthM,
      biome: biomeAt(boatX).id,
      zone: zoneAt(depthM * WORLD.pxPerM).id,
      phase: env.phase || 'day',
      weather: (env.weather && env.weather.type) || 'clear',
      hour: finite(env.hour) ? env.hour : 12,
    };
  }

  function grantChestLure() {
    const cands = LURES.filter((l) => !player.lures.includes(l.id) && (LURE_SHOP[l.id] || l).unlockLevel <= player.level + 4);
    if (!cands.length || !rng.chance(CHEST_LURE_CHANCE)) return null;
    const l = rng.pick(cands);
    ownLure(l.id);
    return l;
  }

  /** Score + apply one catch. Returns {record, pre, post} — events in emit order around 'catchScored'. */
  function processCatch(e) {
    const pre = [], post = [];
    const fish = e && e.fish;
    const sp = fish && (fish.species && fish.species.id ? fish.species : SPECIES_BY_ID[fish.speciesId]);
    if (!sp) throw new Error('catch event without a known species');
    const isItem = !!sp.item;
    const ctx = catchContext(e, fish);
    const sizeQ = clamp01(finite(fish.sizeQ) ? fish.sizeQ : 0.5);
    const lengthCm = finite(fish.lengthCm) && fish.lengthCm > 0 ? fish.lengthCm : lengthFor(sp, sizeQ);
    const weightKg = finite(fish.weightKg) && fish.weightKg > 0 ? fish.weightKg : weightFor(sp, lengthCm);
    const shiny = !isItem && !!fish.shiny;
    const hookQuality = e.hookQuality === 'perfect' || e.hookQuality === 'late' ? e.hookQuality : 'good';
    const fightTime = finite(e.fightTime) ? e.fightTime : 0;

    // streak: the event's count (expected to include this catch) wins; our own counter is the fallback
    const evStreak = finite(e.streak) && e.streak >= 1 ? Math.floor(e.streak) : null;
    player.streak = evStreak !== null ? evStreak : player.streak + 1;
    const streak = player.streak;

    const prev = player.dex[sp.id];
    const isNew = !(prev && prev.count > 0);
    const sc = scoreCatch({ species: sp, sizeQ, shiny, hookQuality, streak: isItem ? 0 : streak, isNew, depthM: ctx.depthM, roll: rng.next() });
    const { points, coins, xp } = sc;
    const breakdown = sc.breakdown;

    // items: notes & loot
    let note = null, bonusLure = null;
    if (isItem) {
      const kind = sp.item.kind;
      if (kind === 'bottle') note = nextBottleNote(player.notesRead, rng.next);
      else if (sp.id === 'treasure_chest') {
        const l = grantChestLure();
        if (l) {
          bonusLure = { id: l.id, name: l.name };
          breakdown.push({ label: 'Free lure!', value: l.name });
        }
        note = chestNote(coins, l && l.name);
      } else if (sp.id === 'pearl_oyster') note = pearlNote(coins);
    }

    // Fishdex & records
    const d = prev || (player.dex[sp.id] = { count: 0, bestLengthCm: 0, bestWeightKg: 0, bestPoints: 0, shinyCount: 0, firstDay: player.day });
    const isRecord = !isNew && !isItem && weightKg > d.bestWeightKg + 1e-9;
    d.count += 1;
    d.bestLengthCm = Math.max(d.bestLengthCm, lengthCm);
    d.bestWeightKg = Math.max(d.bestWeightKg, weightKg);
    d.bestPoints = Math.max(d.bestPoints, points);
    if (shiny) d.shinyCount += 1;

    // lifetime totals
    const t = player.totals;
    player.score += points;
    t.longestStreak = Math.max(t.longestStreak, streak);
    if (isItem) {
      t.items += 1;
      if (sp.item.kind === 'junk') t.junk += 1;
      if (sp.item.kind === 'bottle') t.bottles += 1;
      if (sp.id === 'treasure_chest') t.chests += 1;
      if (sp.id === 'pearl_oyster') t.pearls += 1;
    } else {
      t.caught += 1;
      if (hookQuality === 'perfect') t.perfect += 1;
      if (ctx.phase === 'night') t.night += 1;
      if (ctx.weather === 'rain' || ctx.weather === 'storm') t.rain += 1;
      if (ctx.weather === 'storm') t.storm += 1;
      if (sc.released) t.released += 1;
      if (shiny) t.shiny += 1;
      if (sc.sizeClass.id === 'trophy') t.trophies += 1;
      if (sp.level >= 9) t.legendary += 1;
      t.heaviestKg = Math.max(t.heaviestKg, weightKg);
      t.maxDepthM = Math.max(t.maxDepthM, ctx.depthM);
      if (t.biomes[ctx.biome] !== undefined) t.biomes[ctx.biome] += 1;
      if (t.zones[ctx.zone] !== undefined) t.zones[ctx.zone] += 1;
      if (Math.abs(ctx.boatX - LANDMARKS.wreck.x) < 520 && ctx.depthM >= 300) t.wreck += 1;
      if (LANDMARKS.vents.some((v) => Math.abs(ctx.boatX - v.x) < 380) && ctx.depthM >= 760) t.vents += 1;
      if (!player.biggest || weightKg > player.biggest.weightKg) player.biggest = { speciesId: sp.id, weightKg };
      if (!player.best || points > player.best.points) player.best = { speciesId: sp.id, points };
    }

    // money & XP, in the contract order: coins, xp, dexNew, record, levelUp
    addCoins(coins, isItem ? 'item' : sc.released ? 'grant' : 'sale', pre);
    const lv = addXp(xp, pre);
    if (isNew) pre.push(['dexNew', { speciesId: sp.id }]);
    if (isRecord) pre.push(['record', { speciesId: sp.id, lengthCm, weightKg }]);
    if (lv) pre.push(['levelUp', lv]);

    const record = {
      speciesId: sp.id,
      species: sp,
      name: sp.name,
      level: sp.level,
      rarity: rarityInfo(sp.level),
      isItem,
      itemKind: isItem ? sp.item.kind : null,
      lengthCm,
      weightKg,
      sizeQ,
      sizeClass: sc.sizeClass,
      sizeLabel: sp.sizeLabel || 'length',
      shiny,
      protected: !!sp.protected,
      released: sc.released,
      points,
      coins,
      xp,
      breakdown,
      isNew,
      isRecord,
      note,
      hookQuality,
      fightTime,
      depthM: ctx.depthM,
      day: player.day,
      hour: ctx.hour,
      streak,
      levelUp: lv ? { level: lv.level, title: lv.title } : null,
      // extras (not in the minimum contract, handy for the card / log)
      biome: ctx.biome,
      zone: ctx.zone,
      phase: ctx.phase,
      weather: ctx.weather,
      lureId: player.lureId,
      bonusLure,
    };

    // quests & achievements (announced after the card)
    for (const q of player.quests) {
      const wasDone = q.done;
      if (questOnCatch(q, record, ctx)) {
        post.push(['questProgress', { quest: publicQuest(q) }]);
        if (q.done && !wasDone) post.push(['questComplete', { quest: publicQuest(q) }]);
      }
    }
    checkAchievements(post);
    return { record, pre, post };
  }

  function fallbackRecord(e) {
    const fish = (e && e.fish) || {};
    const sp = (fish.species && fish.species.id ? fish.species : SPECIES_BY_ID[fish.speciesId]) || SPECIES[0];
    const n = (v) => (finite(v) ? v : 0);
    return {
      speciesId: sp.id, species: sp, name: sp.name, level: sp.level, rarity: rarityInfo(sp.level),
      isItem: !!sp.item, itemKind: sp.item ? sp.item.kind : null,
      lengthCm: n(fish.lengthCm), weightKg: n(fish.weightKg), sizeQ: n(fish.sizeQ),
      sizeClass: { id: 'average', name: 'Average' }, sizeLabel: sp.sizeLabel || 'length',
      shiny: !!fish.shiny, protected: !!sp.protected, released: !!sp.protected,
      points: 0, coins: 0, xp: 0, breakdown: [], isNew: false, isRecord: false, note: null,
      hookQuality: (e && e.hookQuality) || 'good', fightTime: n(e && e.fightTime), depthM: n(e && e.depthM),
      day: player.day, hour: n(game.env && game.env.hour), streak: n(e && e.streak), levelUp: null,
    };
  }

  function onCatch(e) {
    let out = null;
    try {
      out = processCatch(e);
    } catch (err) {
      if (game.reportError) game.reportError('progression.catch', err);
      else console.error('[progression] catch scoring failed', err);
    }
    if (out) for (const [type, payload] of out.pre) events.emit(type, payload);
    // ALWAYS announce the catch: the UI's card (and 'catchDismissed') depends on it
    events.emit('catchScored', { record: out ? out.record : fallbackRecord(e) });
    if (out) for (const [type, payload] of out.post) events.emit(type, payload);
    saveSoon();
  }

  function onFightEnd(e) {
    const result = e && e.result;
    if (result !== 'snapped' && result !== 'escaped') return;
    if (e.fish && e.fish.uid !== undefined) hookDepth.delete(e.fish.uid);
    player.totals.lost += 1;
    player.streak = 0;
    const out = [];
    checkAchievements(out);
    for (const [type, payload] of out) events.emit(type, payload);
    saveSoon();
  }

  function onNewDay() {
    player.day += 1;
    const out = [];
    checkAchievements(out);
    for (const [type, payload] of out) events.emit(type, payload);
    saveSoon();
  }

  // ── shop ────────────────────────────────────────────────────────────────────────────────────────
  function isOwned(it) {
    return it.slot === 'lure' ? player.lures.includes(it.lureId) : player.owned.includes(it.id);
  }
  function isEquipped(it) {
    if (it.slot === 'lure') return player.lureId === it.lureId;
    if (it.slot === 'gadget') return player.owned.includes(it.id);
    return player.gear[it.slot] === it.id;
  }
  function ownLure(id) {
    if (!LURES_BY_ID[id] || player.lures.includes(id)) return;
    const set = new Set([...player.lures, id]);
    const sorted = LURES.filter((l) => set.has(l.id)).map((l) => l.id);
    player.lures.length = 0;
    player.lures.push(...sorted);
  }
  function ownGear(id) {
    if (player.owned.includes(id)) return;
    const set = new Set([...player.owned, id]);
    player.owned = GEAR.filter((g) => set.has(g.id)).map((g) => g.id);
  }

  function statLine(key, value, current, isCurrent) {
    const f = FMT[key];
    const diff = value - current;
    const same = isCurrent || Math.abs(diff) < 1e-6;
    return {
      label: f.label,
      value: f.f(value),
      delta: same ? null : (diff > 0 ? '+' : MINUS) + f.d(Math.abs(diff)),
      better: same ? null : diff > 0,
    };
  }
  function lureLines(l) {
    const best = ANIMALS.filter((s) => !s.secret)
      .map((s) => ({ s, k: lureAffinity(l, s) * Math.sqrt(s.abundance) }))
      .filter((o) => o.k > 0.05)
      .sort((a, b) => b.k - a.k)
      .slice(0, 3)
      .map((o) => (player.dex[o.s.id] && player.dex[o.s.id].count > 0 ? o.s.name : '???'));
    const lines = [
      { label: 'Sink', value: sinkWord(l.sink), delta: null, better: null },
      { label: 'Hook', value: `Size ${l.hook[0]}–${l.hook[1]}`, delta: null, better: null },
    ];
    if (l.glow > 0) lines.push({ label: 'Glow', value: Math.round(l.glow * 100) + '%', delta: null, better: null });
    if (l.flash > 0.25) lines.push({ label: 'Flash', value: Math.round(l.flash * 100) + '%', delta: null, better: null });
    if (best.length) lines.push({ label: 'Best for', value: best.join(', '), delta: null, better: null });
    return lines;
  }
  function itemStatLines(it) {
    if (it.slot === 'lure') return lureLines(LURES_BY_ID[it.lureId]);
    const cur = player.stats;
    const equipped = isEquipped(it);
    if (it.slot === 'gadget') {
      const gad = gadgetsOwned();
      const hyp = computeStats(player.gear, gad.includes(it.id) ? gad : [...gad, it.id]);
      // compare against the stats WITHOUT this gadget when it is owned, so the line says what it adds
      const base = gad.includes(it.id) ? computeStats(player.gear, gad.filter((g) => g !== it.id)) : cur;
      return Object.keys(it.stats).map((k) => statLine(k, hyp[k], base[k], false));
    }
    const hyp = computeStats({ ...player.gear, [it.slot]: it.id }, gadgetsOwned());
    return SLOT_KEYS[it.slot].map((k) => statLine(k, hyp[k], cur[k], equipped));
  }
  function catalogItem(it) {
    const out = {
      id: it.id,
      slot: it.slot,
      name: it.name,
      desc: it.desc,
      tier: it.tier,
      price: it.price,
      unlockLevel: it.unlockLevel,
      owned: isOwned(it),
      equipped: isEquipped(it),
      locked: player.level < it.unlockLevel,
      affordable: player.coins >= it.price,
      stats: itemStatLines(it),
      accent: it.accent,
    };
    if (it.slot === 'lure') out.lureId = it.lureId;
    return out;
  }

  function selectLure(lureId, quiet = false) {
    if (!player.lures.includes(lureId)) return false;
    if (player.lureId === lureId) {
      mirror();
      return true;
    }
    player.lureId = lureId;
    mirror();
    if (!quiet) events.emit('equip', { item: catalogItem(ITEMS_BY_ID['lure_' + lureId]) });
    saveSoon();
    return true;
  }

  // ── cheats (debug only) ─────────────────────────────────────────────────────────────────────────
  function cheat(kind, value) {
    if (!game.debug) {
      console.warn('[progression] cheats need ?debug=1');
      return false;
    }
    const out = [];
    const n = Number(value) || 0;
    let lv = null;
    switch (kind) {
      case 'coins':
        addCoins(n, 'cheat', out);
        break;
      case 'xp':
        lv = addXp(n, out);
        break;
      case 'level': {
        const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(n) || 1));
        const before = player.level;
        player.xp = xpAt(target);
        player.level = levelForXp(player.xp);
        out.push(['xp', { delta: 0, total: player.xp }]);
        if (player.level > before) lv = { level: player.level, title: titleOf(player.level), unlocked: unlockedBetween(before, player.level) };
        break;
      }
      case 'unlockAll': {
        const before = player.level;
        if (player.level < MAX_LEVEL) {
          player.xp = xpAt(MAX_LEVEL);
          player.level = MAX_LEVEL;
          out.push(['xp', { delta: 0, total: player.xp }]);
          lv = { level: player.level, title: titleOf(player.level), unlocked: unlockedBetween(before, player.level) };
        }
        for (const it of ALL_ITEMS) {
          if (it.slot === 'lure') ownLure(it.lureId);
          else ownGear(it.id);
        }
        for (const slot of EQUIP_SLOTS) {
          const best = GEAR.filter((g) => g.slot === slot).pop();
          player.gear[slot] = best.id;
        }
        recomputeStats();
        out.push(['equip', { item: catalogItem(ITEMS_BY_ID[player.gear.rod]) }]);
        break;
      }
      case 'dexAll':
        for (const s of SPECIES) {
          if (player.dex[s.id] && player.dex[s.id].count > 0) continue;
          const len = lengthFor(s, 0.5);
          player.dex[s.id] = { count: 1, bestLengthCm: len, bestWeightKg: weightFor(s, len), bestPoints: s.item ? s.item.points : 0, shinyCount: 0, firstDay: player.day };
        }
        break;
      default:
        console.warn('[progression] unknown cheat', kind);
        return false;
    }
    if (lv) out.push(['levelUp', lv]);
    checkAchievements(out);
    for (const [type, payload] of out) events.emit(type, payload);
    saveSoon();
    return true;
  }

  // ── boot ────────────────────────────────────────────────────────────────────────────────────────
  applyProfile(load() || freshProfile());
  validateLure();
  ensureQuests();
  checkAchievements(null); // silently catch up (e.g. achievements added after the save was written)

  events.on('bite', rememberHookDepth);
  events.on('hookSet', rememberHookDepth);
  events.on('catch', onCatch);
  events.on('fightEnd', onFightEnd);
  events.on('newDay', onNewDay);
  events.on('ready', () => mirror());

  const api = {
    /** @param {number} dt game seconds */
    update(dt) {
      if (game.mode === 'play' && finite(dt) && dt > 0) {
        player.totals.playTimeS += dt;
        playSaveT += dt;
        if (playSaveT >= PLAY_SAVE_EVERY_S) {
          playSaveT = 0;
          if (hasProgress()) saveSoon();
        }
      }
      checkT -= dt;
      if (checkT <= 0) {
        checkT = 0.25;
        validateLure();
        mirror();
      }
    },

    // ── shop ──
    /** @returns {object[]} every shop item (see the META contract for the shape) */
    getCatalog() {
      return ALL_ITEMS.map(catalogItem);
    },
    /** Buy and auto-equip. @returns {{ok:boolean, reason?:'coins'|'level'|'owned'|'unknown'}} */
    buy(id) {
      const it = itemById(id);
      if (!it) return { ok: false, reason: 'unknown' };
      if (isOwned(it)) return { ok: false, reason: 'owned' };
      if (player.level < it.unlockLevel) return { ok: false, reason: 'level' };
      if (player.coins < it.price) return { ok: false, reason: 'coins' };
      const out = [];
      addCoins(-it.price, 'purchase', out);
      player.totals.purchases += 1;
      if (it.slot === 'lure') {
        ownLure(it.lureId);
        player.lureId = it.lureId;
      } else {
        ownGear(it.id);
        if (EQUIP_SLOTS.includes(it.slot)) player.gear[it.slot] = it.id;
      }
      recomputeStats();
      const pub = catalogItem(it);
      out.push(['purchase', { item: pub }]);
      out.push(['equip', { item: pub }]);
      checkAchievements(out);
      for (const [type, payload] of out) events.emit(type, payload);
      saveSoon();
      return { ok: true };
    },
    /** Equip an owned item (gadgets are always active; lures → selectLure). @returns {{ok:boolean}} */
    equip(id) {
      const it = itemById(id);
      if (!it || !isOwned(it)) return { ok: false };
      if (it.slot === 'lure') return { ok: selectLure(it.lureId) };
      if (it.slot === 'gadget') return { ok: true };
      if (player.gear[it.slot] !== it.id) {
        player.gear[it.slot] = it.id;
        recomputeStats();
        events.emit('equip', { item: catalogItem(it) });
        saveSoon();
      }
      return { ok: true };
    },
    /** Select an owned lure. @returns {boolean} */
    selectLure(lureId) {
      return selectLure(lureId);
    },
    /** Next/previous owned lure (shop order). @returns {string} the selected lure id */
    cycleLure(dir = 1) {
      const list = player.lures;
      if (list.length > 1) {
        const i = Math.max(0, list.indexOf(player.lureId));
        const step = dir < 0 ? -1 : 1;
        selectLure(list[(i + step + list.length) % list.length]);
      }
      return player.lureId;
    },

    // ── quests & achievements ──
    getQuests() {
      return player.quests.map(publicQuest);
    },
    /** Pay a finished quest and replace it. @returns {{ok:boolean, reward?:{coins,xp}, quest?:object}} */
    claimQuest(id) {
      const i = player.quests.findIndex((q) => q.id === id);
      if (i < 0) return { ok: false };
      const q = player.quests[i];
      if (!q.done || q.claimed) return { ok: false };
      q.claimed = true;
      const out = [];
      addCoins(q.reward.coins, 'quest', out);
      const lv = addXp(q.reward.xp, out);
      if (lv) out.push(['levelUp', lv]);
      player.totals.questsDone += 1;
      // the claimed quest is passed along so its replacement is a different kind of quest
      player.questSeq = (player.questSeq | 0) + 1;
      const fresh = generateQuest(player, rng, player.quests, player.questSeq);
      player.quests[i] = fresh;
      checkAchievements(out);
      for (const [type, payload] of out) events.emit(type, payload);
      saveSoon();
      return { ok: true, reward: { ...q.reward }, quest: publicQuest(fresh) };
    },
    /**
     * EXTRA (not in the base contract): swap an unfinished quest for a different kind of quest. Free — rewards
     * are effort-scaled, so rerolling buys nothing but variety. @returns {{ok:boolean, quest?:object}}
     */
    rerollQuest(id) {
      const i = player.quests.findIndex((q) => q.id === id);
      if (i < 0 || player.quests[i].done) return { ok: false };
      player.questSeq = (player.questSeq | 0) + 1;
      const fresh = generateQuest(player, rng, player.quests, player.questSeq);
      player.quests[i] = fresh;
      saveSoon();
      return { ok: true, quest: publicQuest(fresh) };
    },
    getAchievements() {
      return ACHIEVEMENTS.map(publicAch);
    },

    // ── collection ──
    /** One entry per SPECIES (items included), same order. */
    getDex() {
      return SPECIES.map((s) => {
        const d = player.dex[s.id];
        const found = !!(d && d.count > 0);
        return {
          species: s,
          discovered: found,
          count: found ? d.count : 0,
          bestLengthCm: found ? d.bestLengthCm : 0,
          bestWeightKg: found ? d.bestWeightKg : 0,
          bestPoints: found ? d.bestPoints : 0,
          shinyCount: found ? d.shinyCount : 0,
          firstDay: found ? d.firstDay : null,
        };
      });
    },

    // ── player ──
    getLevelInfo() {
      return levelInfo(player.xp);
    },
    getSummary() {
      const t = player.totals;
      return {
        totalCaught: t.caught,
        speciesFound: speciesFound(player),
        speciesTotal: ANIMALS.length,
        totalPoints: player.score,
        totalCoinsEarned: t.coinsEarned,
        biggestCatch: player.biggest ? { ...player.biggest } : null,
        bestCatch: player.best ? { ...player.best } : null,
        longestStreak: t.longestStreak,
        playTimeS: Math.floor(t.playTimeS),
        daysAtSea: player.day,
        fishLost: t.lost,
        // extras
        itemsFound: t.items,
        questsDone: t.questsDone,
        achievements: Object.keys(player.achievements).length,
        achievementsTotal: ACHIEVEMENTS.length,
      };
    },
    /** Is there a save to continue from? (always false with ?nosave=1) */
    hasSave() {
      if (noSave) return false;
      return !!store.get() || savedOnce;
    },
    /** Wipe the save and start a fresh profile. */
    reset() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      dirty = false;
      if (!noSave) store.remove();
      savedOnce = false;
      applyProfile(freshProfile());
      validateLure();
      ensureQuests();
      events.emit('profileReset', {});
    },
    /** Write the save now. @returns {boolean} written */
    save() {
      return save();
    },
    /** Debug helpers ('coins' n | 'level' n | 'xp' n | 'unlockAll' | 'dexAll'); need ?debug=1. */
    cheat,
    /** What the player can currently reach (depth, landable species, value of a typical catch). Debug/UI hints. */
    getReach() {
      const R = computeReach(player);
      return {
        maxDepthM: Math.round(R.maxDepthM),
        tackle: R.tackle,
        species: R.pool.map((e) => e.s.id),
        coinsPerCatch: Math.round(R.coinsPerCatch),
        xpPerCatch: Math.round(R.xpPerCatch),
      };
    },
  };
  return api;
}

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
