// Dev-only helpers for reviewing the UI module (NOT loaded by the game).
//   --eval "const m = await import('/dev/ui-mock.js'); await m.setup(__game, {level: 12, coins: 9000, dex: 18})"
//   --after "(await import('/dev/ui-mock.js')).showCard(__game, 'legendary')"
// setup() drives the REAL progression (src/gameplay/progression.js) through its debug cheats; when META is
// switched off (?off=progression) it installs a small stand-in so panels can still be laid out.
import { SPECIES, SPECIES_BY_ID, lengthFor, weightFor } from '../src/data/species.js';
import { LURES } from '../src/data/lures.js';
import { rarityOf, sizeClassOf, sizeMultiplier, LEVEL_POINTS, DEFAULT_STATS } from '../src/core/config.js';

/** A catchScored record in META's shape. o: { sizeQ, shiny, isNew, isRecord, depthM, streak, levelUp, note, released } */
export function makeRecord(id, o = {}) {
  const sp = SPECIES_BY_ID[id];
  const sizeQ = o.sizeQ !== undefined ? o.sizeQ : 0.5;
  const lengthCm = lengthFor(sp, sizeQ);
  const weightKg = weightFor(sp, lengthCm);
  const isItem = sp.group === 'item';
  const level = sp.level;
  const base = isItem ? sp.item.points : LEVEL_POINTS[level];
  const mult = isItem ? 1 : sizeMultiplier(sizeQ);
  const breakdown = [{ label: isItem ? sp.name : `${sp.name} · Lv ${level}`, value: base }];
  let points = base;
  if (!isItem) {
    const sizeBonus = Math.round(base * (mult - 1));
    breakdown.push({ label: `Size ×${mult.toFixed(2)}`, value: sizeBonus });
    points += sizeBonus;
    if (o.hookQuality !== 'good') {
      const b = Math.round(points * 0.25);
      breakdown.push({ label: 'Perfect hook +25%', value: b });
      points += b;
    }
    if (o.shiny) {
      const b = points * 2;
      breakdown.push({ label: 'Shiny ×3', value: b });
      points += b;
    }
    if ((o.depthM || 0) > 180) {
      const b = Math.round(points * 0.15);
      breakdown.push({ label: 'Deep water +15%', value: b });
      points += b;
    }
  }
  if (sp.protected) {
    const b = Math.round(points * 0.5);
    breakdown.push({ label: 'Conservation bonus', value: b });
    points += b;
  }
  if ((o.streak || 0) > 2) {
    const b = Math.round(points * 0.1);
    breakdown.push({ label: `Streak ×${o.streak}`, value: b });
    points += b;
  }
  const rar = rarityOf(level);
  return {
    speciesId: id, species: sp, name: sp.name, level, rarity: { id: rar.id, name: rar.name, color: rar.color },
    isItem, itemKind: isItem ? sp.item.kind : null, lengthCm, weightKg, sizeQ, sizeClass: sizeClassOf(sizeQ),
    sizeLabel: sp.sizeLabel, shiny: !!o.shiny, protected: sp.protected, released: sp.protected,
    points, coins: Math.round(points * (sp.protected ? 0.4 : 0.8) * (sp.valueMult || 1)), xp: Math.round(points * 0.6 + 12),
    breakdown, isNew: !!o.isNew, isRecord: !!o.isRecord, note: o.note || null,
    hookQuality: o.hookQuality || 'perfect', fightTime: o.fightTime !== undefined ? o.fightTime : 24, depthM: o.depthM || 40,
    day: 3, hour: 9.5, streak: o.streak || 1, levelUp: o.levelUp || null,
  };
}

export const PRESETS = {
  common: () => makeRecord('clownfish', { sizeQ: 0.45, depthM: 38, isNew: true, fightTime: 6 }),
  trophy: () => makeRecord('yellowfin_tuna', { sizeQ: 0.97, depthM: 64, isRecord: true, streak: 5, fightTime: 48 }),
  shiny: () => makeRecord('mahi_mahi', { sizeQ: 0.7, shiny: true, depthM: 12, fightTime: 31 }),
  legendary: () => makeRecord('great_white', { sizeQ: 0.86, depthM: 120, isNew: true, levelUp: { level: 13, title: 'Bluewater Captain' }, fightTime: 96 }),
  mythic: () => makeRecord('megalodon', { sizeQ: 0.5, depthM: 860, isNew: true, fightTime: 180 }),
  protected: () => makeRecord('sea_turtle', { sizeQ: 0.6, depthM: 22, fightTime: 40 }),
  bottle: () => makeRecord('message_bottle', { depthM: 0, isNew: true, note: 'To whoever finds this: the big one lives below the wreck. It only bites at night. — Old Pete, 1987' }),
  treasure: () => makeRecord('treasure_chest', { depthM: 410, isNew: true, fightTime: 55 }),
  junk: () => makeRecord('old_boot', { depthM: 44, fightTime: 8 }),
  deep: () => makeRecord('anglerfish', { sizeQ: 0.8, depthM: 640, isNew: true, isRecord: false, fightTime: 33 }),
};

/** Show a catch card for a preset name or a species id. */
export function showCard(game, name = 'common', o = {}) {
  const record = PRESETS[name] ? PRESETS[name]() : makeRecord(name, o);
  game.events.emit('catchScored', { record });
  return record.name;
}

/** Push the real progression into an interesting state (or install a stand-in when META is off). */
export async function setup(game, o = {}) {
  for (let i = 0; i < 100 && !game.mods.ui; i++) await new Promise((r) => setTimeout(r, 50));
  const p = game.progression;
  if (!p) return installStandIn(game, o);
  const dbg = game.debug;
  game.debug = true;
  try {
    if (o.level) p.cheat('level', o.level);
    if (o.coins) p.cheat('coins', o.coins);
    if (o.dex) {
      // discover the first N animals (+ a couple of items) through the cheat's per-species path
      const keep = new Set(SPECIES.filter((s) => s.group !== 'item').slice(0, o.dex).map((s) => s.id));
      keep.add('old_boot');
      keep.add('message_bottle');
      p.cheat('dexAll');
      for (const id of Object.keys(game.player.dex)) if (!keep.has(id)) delete game.player.dex[id];
      for (const id of keep) {
        const d = game.player.dex[id];
        if (d) {
          d.count = 1 + ((id.length * 7) % 23);
          d.shinyCount = id === 'mahi_mahi' ? 1 : 0;
        }
      }
    }
    if (o.lures) {
      for (const l of LURES.slice(1, o.lures)) {
        p.cheat('coins', 99999);
        p.buy('lure_' + l.id);
      }
      p.selectLure(LURES[Math.min(2, o.lures - 1)].id);
    }
    if (o.buy) for (const id of o.buy) p.buy(id);
    if (o.questDone) {
      const q = p.getQuests()[0];
      // flip the first quest to "done" for screenshots of the Claim state
      game.player.quests && game.player.quests[0] && Object.assign(game.player.quests[0], { done: true, progress: q.goal });
    }
  } finally {
    game.debug = dbg;
  }
  if (o.sonar) game.player.stats.sonar = o.sonar;
  return 'ok';
}

function installStandIn(game, o) {
  const pl = game.player;
  Object.assign(pl, { coins: o.coins || 2400, level: o.level || 5, xp: 900, lures: LURES.slice(0, 4).map((l) => l.id), lureId: 'spinner' });
  pl.stats = { ...DEFAULT_STATS, lineLengthM: 220, sonar: o.sonar || 0 };
  for (const s of SPECIES.slice(0, o.dex || 12)) pl.dex[s.id] = { count: 3, bestLengthCm: lengthFor(s, 0.6), bestWeightKg: weightFor(s, lengthFor(s, 0.6)), bestPoints: 120, shinyCount: 0, firstDay: 1 };
  game.progression = {
    getCatalog: () => [],
    buy: () => ({ ok: false, reason: 'unknown' }),
    equip: () => ({ ok: false }),
    selectLure: (id) => ((pl.lureId = id), true),
    cycleLure: () => pl.lureId,
    getQuests: () => [
      { id: 'q1', title: 'Reef regular', desc: 'Catch 5 fish on the Coral Reef', progress: 3, goal: 5, reward: { coins: 120, xp: 60 }, done: false, claimed: false },
      { id: 'q2', title: 'Heavyweight', desc: 'Land a fish over 20 kg', progress: 1, goal: 1, reward: { coins: 300, xp: 150 }, done: true, claimed: false },
    ],
    claimQuest: () => ({ ok: true }),
    getAchievements: () => [],
    getDex: () => SPECIES.map((s) => ({ species: s, discovered: !!pl.dex[s.id], count: pl.dex[s.id] ? 3 : 0, bestLengthCm: 0, bestWeightKg: 0, bestPoints: 0, shinyCount: 0, firstDay: 1 })),
    getLevelInfo: () => ({ level: pl.level, title: 'Reef Angler', xp: pl.xp, xpIntoLevel: 300, xpForLevel: 800, progress: 0.375, maxLevel: 30 }),
    getSummary: () => ({ totalCaught: 48, speciesFound: 12, speciesTotal: 50, totalPoints: 5400, totalCoinsEarned: 6100, biggestCatch: null, bestCatch: null, longestStreak: 6, playTimeS: 3720, daysAtSea: 4, fishLost: 9 }),
    hasSave: () => true,
    reset() {},
    save() {},
  };
  return 'stand-in';
}
