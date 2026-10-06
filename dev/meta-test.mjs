#!/usr/bin/env node
// META unit + integration tests (node, no browser):   node dev/meta-test.mjs
// Pure parts (stats, scoring, level curve, quest generation, save sanitising) and the real
// createProgression() driven through a fake `game` with a Map-backed localStorage.
import { DEFAULT_STATS, LEVEL_POINTS, SAVE_KEY, sizeMultiplier } from '../src/core/config.js';
import { createEvents } from '../src/core/events.js';
import { createRng } from '../src/core/rng.js';
import { createBoatState, createFishingState, createPlayerState } from '../src/gameplay/state.js';
import { SPECIES, SPECIES_BY_ID, ANIMALS } from '../src/data/species.js';
import { LURES } from '../src/data/lures.js';
import { createFish } from '../src/entities/fishbase.js';
import { computeStats, RODS, REELS, LINES, BOATS, GADGETS, ALL_ITEMS, STARTER_GEAR, LURE_ITEMS } from '../src/data/gear.js';
import { ACHIEVEMENTS } from '../src/data/quests.js';
import { scoreCatch, streakMultiplier, xpAt, levelForXp, levelInfo, XP_TABLE, MAX_LEVEL, LEVEL_TITLES } from '../src/gameplay/progression-score.js';
import { computeReach, generateQuest, questOnCatch, validQuest, habitatReachable, SEABED_M } from '../src/gameplay/progression-quests.js';
import { freshProfile, serialize, sanitize } from '../src/gameplay/progression-save.js';
import { BOTTLE_NOTES } from '../src/gameplay/progression-notes.js';
import { createProgression } from '../src/gameplay/progression.js';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) pass++;
  else {
    fail++;
    failures.push(msg);
    console.log('  ✗ ' + msg);
  }
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const section = (name) => console.log('\n▸ ' + name);

// ── localStorage stand-in ──
class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
globalThis.localStorage = new MemStorage();

function fakeGame(opts = {}) {
  const game = {
    flags: opts.flags || {},
    debug: opts.debug !== undefined ? opts.debug : true,
    mode: 'play',
    events: createEvents(),
    rng: createRng(opts.seed || 42),
    env: { phase: 'day', hour: 12, day: 1, weather: { type: 'clear' } },
    boat: createBoatState(),
    fishing: createFishingState(),
    player: createPlayerState(),
    reportError: (w, e) => { throw e; },
  };
  game.log = [];
  game.events.on('*', (type, payload) => game.log.push([type, payload]));
  return game;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
section('gear & stats');
eq(computeStats(STARTER_GEAR, []), DEFAULT_STATS, 'starter kit stats deep-equal DEFAULT_STATS');
{
  const top = computeStats({ rod: RODS.at(-1).id, reel: REELS.at(-1).id, line: LINES.at(-1).id, boat: BOATS.at(-1).id }, GADGETS.map((g) => g.id));
  ok(top.tackle === 10, `fully upgraded tackle = 10 (got ${top.tackle})`);
  ok(top.lineLengthM === 950, 'top line = 950 m');
  eq(Object.keys(top).sort(), Object.keys(DEFAULT_STATS).sort(), 'stats have exactly the DEFAULT_STATS keys');
  ok(top.sonar === 2 && top.lamp === 2 && top.luck === 0.25 && top.sinkBonus === 0.7 && top.hookWindowBonus === 0.3, 'gadgets combine by max');
  eq(LINES.map((l) => l.stats.lineLengthM), [60, 120, 220, 350, 500, 700, 950], 'line lengths');
  for (const list of [RODS, REELS, LINES, BOATS]) {
    ok(list[0].price === 0, `${list[0].slot} tier 1 is free`);
    for (let i = 1; i < list.length; i++) ok(list[i].price > list[i - 1].price && list[i].unlockLevel >= list[i - 1].unlockLevel, `${list[i].id} costs more / unlocks later than the previous tier`);
  }
  const ids = ALL_ITEMS.map((i) => i.id);
  ok(new Set(ids).size === ids.length, 'catalogue ids are unique');
  ok(LURE_ITEMS.length === LURES.length, 'every lure is in the shop');
  ok(ALL_ITEMS.every((i) => /^#[0-9a-f]{6}$/i.test(i.accent) && i.desc && i.name), 'every item has name, desc and a hex accent');
}

section('scoring');
{
  const sp = SPECIES_BY_ID.barracuda; // level 5 → 150 base
  const r = scoreCatch({ species: sp, sizeQ: 0.7, hookQuality: 'perfect', streak: 3, isNew: false });
  const sm = Math.round(sizeMultiplier(0.7) * 100) / 100;
  ok(r.points === Math.round(150 * sm * 1.1 * 1.15), `barracuda points = 150 × ${sm} × 1.10 × 1.15 (got ${r.points})`);
  eq(r.breakdown.map((b) => b.label), ['Lv 5 base', 'Large', 'Perfect hook', 'Streak ×3'], 'breakdown labels');
  eq(r.breakdown.map((b) => b.value), ['150', '×' + sm.toFixed(2), '×1.10', '×1.15'], 'breakdown values');
  ok(r.coins === r.points, 'coins = points × valueMult(1)');
  const t = scoreCatch({ species: SPECIES_BY_ID.bluefin_tuna, sizeQ: 0.97, hookQuality: 'good', streak: 1, shiny: true, isNew: true });
  ok(t.points === Math.round(400 * Math.round(sizeMultiplier(0.97) * 100) / 100 * 1.5 * 5), `trophy shiny bluefin points (got ${t.points})`);
  ok(t.coins === Math.round(t.points * 2.0), 'bluefin coins use valueMult 2.0');
  ok(t.breakdown.some((b) => b.label === 'TROPHY bonus') && t.breakdown.some((b) => b.label === 'Shiny!') && t.breakdown.some((b) => b.label === 'First catch!'), 'trophy/shiny/first lines present');
  // every breakdown reproduces its total
  const rng = createRng(7);
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const s = ANIMALS[Math.floor(rng.next() * ANIMALS.length)];
    const c = scoreCatch({ species: s, sizeQ: rng.next(), hookQuality: rng.pick(['perfect', 'good', 'late']), streak: rng.int(0, 14), shiny: rng.chance(0.05) });
    let p = 1;
    for (const b of c.breakdown) {
      if (b.value.endsWith('XP') || b.value.endsWith('coins')) continue;
      p *= b.value.startsWith('×') ? Number(b.value.slice(1)) : Number(b.value);
    }
    worst = Math.max(worst, Math.abs(Math.round(p) - c.points));
  }
  ok(worst === 0, `breakdown × factors reproduces points exactly (worst diff ${worst})`);
  const manta = scoreCatch({ species: SPECIES_BY_ID.manta_ray, sizeQ: 0.5, hookQuality: 'good', streak: 1 });
  ok(manta.released && manta.coins === Math.round(manta.points * 0.75), 'protected → released, 0.75× conservation grant');
  const boot = scoreCatch({ species: SPECIES_BY_ID.old_boot, sizeQ: 0.5, roll: 0, isNew: false });
  ok(boot.points === 5 && boot.coins === 2, 'old boot: 5 points, coins from the item range');
  eq([0, 1, 2, 3, 4, 10, 11, 30].map(streakMultiplier), [1, 1, 1.1, 1.15, 1.2, 1.5, 1.5, 1.5], 'streak multipliers');
}

section('level curve');
{
  ok(xpAt(1) === 0, 'level 1 at 0 XP');
  let mono = true;
  for (let l = 2; l <= MAX_LEVEL; l++) if (!(XP_TABLE[l] > XP_TABLE[l - 1])) mono = false;
  ok(mono, 'XP table strictly increasing');
  ok(LEVEL_TITLES.length === MAX_LEVEL + 1 && LEVEL_TITLES[1] === 'Deckhand' && LEVEL_TITLES[MAX_LEVEL] === 'Legend of the Deep', 'titles Deckhand … Legend of the Deep');
  ok(levelForXp(xpAt(7)) === 7 && levelForXp(xpAt(7) - 1) === 6, 'levelForXp boundaries');
  const li = levelInfo(xpAt(5) + 10);
  ok(li.level === 5 && li.xpIntoLevel === 10 && li.xpForLevel === xpAt(6) - xpAt(5) && li.progress > 0 && li.progress < 1, 'levelInfo mid-level');
  const lm = levelInfo(xpAt(MAX_LEVEL) + 500);
  ok(lm.level === MAX_LEVEL && lm.progress === 1 && lm.xpForLevel === 0, 'levelInfo at max level');
  console.log('    XP to reach: ' + [2, 3, 5, 8, 10, 15, 20, 25, 30].map((l) => `L${l} ${xpAt(l)}`).join(' · '));
}

section('reach & quest generation');
{
  console.log('    seabed (m): ' + Object.entries(SEABED_M).map(([k, v]) => `${k} ${v ? v.map((x) => x.toFixed(0)).join('–') : '—'}`).join(' · '));
  const stage = (gear, lures, level) => {
    const p = freshProfile();
    Object.assign(p.gear, gear);
    p.stats = computeStats(p.gear, []);
    p.lures = lures;
    p.level = level;
    p.xp = xpAt(level);
    return p;
  };
  const stages = [
    stage({}, ['worm'], 1),
    stage({ rod: 'rod_graphite', line: 'line_mono' }, ['worm', 'shrimp', 'spinner'], 5),
    stage({ rod: 'rod_carbon', line: 'line_fluoro' }, ['worm', 'shrimp', 'spinner', 'jelly', 'minnow', 'squid_jig'], 10),
    stage({ rod: 'rod_leviathan', line: 'line_kevlar' }, LURES.map((l) => l.id), 25),
  ];
  for (const p of stages) {
    const R = computeReach(p);
    ok(R.pool.length > 0, `stage L${p.level}: something is catchable (${R.pool.length} species, ${R.maxDepthM.toFixed(0)} m, tackle ${R.tackle})`);
    const rng = createRng(p.level * 31 + 1);
    const types = {};
    for (let i = 0; i < 300; i++) {
      const existing = [generateQuest(p, rng, [], 1), generateQuest(p, rng, [], 2)];
      const q = generateQuest(p, rng, existing, 3);
      types[q.type] = (types[q.type] || 0) + 1;
      if (!validQuest(q)) ok(false, `invalid quest ${JSON.stringify(q)}`);
      if (existing.some((e) => e.type === q.type)) ok(false, `duplicate type ${q.type}`);
      if (q.type === 'species') {
        const s = SPECIES_BY_ID[q.target];
        if (!R.pool.some((e) => e.s.id === s.id)) ok(false, `quest species ${s.id} not catchable at stage L${p.level}`);
      }
      if (q.type === 'zone' && q.target !== 'sunlit') {
        const z = { twilight: 187, midnight: 450, abyss: 700 }[q.target];
        if (z > R.maxDepthM) ok(false, `zone quest ${q.target} unreachable at ${R.maxDepthM} m`);
      }
      if (q.type === 'rain' && p.level < 6) ok(false, 'rain quest before level 6');
      if (q.type === 'shiny' && p.level < 10) ok(false, 'shiny quest before level 10');
      if (!(q.reward.coins > 0 && q.reward.xp > 0)) ok(false, 'quest without reward');
    }
    pass++;
    const sample = generateQuest(p, createRng(p.level), [], 9);
    console.log(`    L${p.level}: ${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ')}`);
    console.log(`         e.g. "${sample.title}: ${sample.desc}" → ${sample.reward.coins} coins, ${sample.reward.xp} XP (effort ${sample.effort} catches; typical catch ${R.coinsPerCatch.toFixed(0)} coins)`);
  }
  // progress
  const q = { id: 'q1', type: 'species', target: 'clownfish', title: 't', desc: 'd', progress: 0, goal: 2, reward: { coins: 10, xp: 10 }, done: false, claimed: false };
  const rec = { speciesId: 'clownfish', isItem: false, level: 1, sizeClass: { id: 'small' }, points: 9, weightKg: 0.01, streak: 1, depthM: 40 };
  ok(questOnCatch(q, rec, {}) && q.progress === 1 && !q.done, 'species quest +1');
  ok(questOnCatch(q, rec, {}) && q.done, 'species quest completes');
  ok(!questOnCatch(q, rec, {}), 'done quest does not move');
  const w = { id: 'q2', type: 'weight', target: null, title: 't', desc: 'd', progress: 0, goal: 1, reward: { coins: 1, xp: 1 }, done: false, claimed: false };
  questOnCatch(w, { ...rec, weightKg: 0.44 }, {});
  ok(w.progress === 0.4, 'weight quest accumulates (rounded to 0.1)');
  ok(habitatReachable(SPECIES_BY_ID.clownfish, 55) && !habitatReachable(SPECIES_BY_ID.coelacanth, 200), 'habitat reach by depth');
}

section('save sanitising');
{
  const p = freshProfile();
  p.coins = 1234; p.xp = xpAt(6) + 3; p.lures = ['worm', 'shrimp', 'spinner']; p.lureId = 'spinner';
  p.owned.push('rod_fiberglass', 'gad_sonar1'); p.gear.rod = 'rod_fiberglass';
  p.dex.clownfish = { count: 3, bestLengthCm: 9.5, bestWeightKg: 0.02, bestPoints: 12, shinyCount: 0, firstDay: 1 };
  p.quests = [generateQuest(p, createRng(1), [], 1)];
  p.questSeq = 1; p.day = 4; p.totals.caught = 3; p.totals.biomes.reef = 3; p.achievements.first_catch = 1;
  const back = sanitize(JSON.parse(JSON.stringify(serialize(p)))).profile;
  ok(back.coins === 1234 && back.level === 6 && back.lureId === 'spinner' && back.gear.rod === 'rod_fiberglass', 'round-trip keeps coins / level / lure / gear');
  eq(back.dex.clownfish, p.dex.clownfish, 'round-trip keeps the dex');
  eq(back.quests[0], p.quests[0], 'round-trip keeps quests');
  ok(back.day === 4 && back.totals.biomes.reef === 3 && back.achievements.first_catch === 1, 'round-trip keeps totals / day / achievements');
  const nasty = [
    null, 42, 'hello', [], [1, 2, 3], { v: 1 }, { v: 1, player: null }, { v: 99, player: { coins: 50 } },
    { player: { coins: -5, xp: 'lots', lures: 'worm', lureId: 'kraken', owned: [null, 'rod_leviathan', 7], gear: { rod: 'rod_titan', reel: 3 } } },
    { player: { coins: 1e300, xp: Infinity, dex: { clownfish: { count: 'x' }, nope: { count: 3 }, sardine: { count: 2, bestLengthCm: -4, shinyCount: 99 } } } },
    { player: { quests: [{ id: 'q1', type: 'species', target: 'unicorn' }, { foo: 1 }, 5, null], achievements: { first_catch: 1, fake: 2 }, totals: { caught: 'many', biomes: null } } },
    { player: { biggest: { speciesId: 'kraken', weightKg: 5 }, best: { speciesId: 'clownfish', points: NaN }, notesRead: [1, 1, 999, -1, 'x'] } },
    { coins: 77, xp: 10, lures: ['worm', 'chum'] }, // bare (pre-versioned) player object
  ];
  let threw = 0;
  for (const raw of nasty) {
    try {
      const { profile } = sanitize(raw);
      const okShape = profile.coins >= 0 && Number.isFinite(profile.coins) && profile.lures.includes('worm') && profile.lures.includes(profile.lureId)
        && Object.values(profile.gear).every((id) => profile.owned.includes(id)) && Array.isArray(profile.quests) && profile.quests.every(validQuest)
        && Number.isFinite(profile.xp) && profile.level >= 1 && profile.day >= 1;
      if (!okShape) ok(false, 'sanitize produced a bad profile for ' + JSON.stringify(raw));
    } catch (e) {
      threw++;
      console.log('    threw on', JSON.stringify(raw), e.message);
    }
  }
  ok(threw === 0, 'sanitize never throws on garbage');
  const s1 = sanitize({ player: { owned: ['rod_leviathan'], gear: { rod: 'rod_leviathan', reel: 'reel_winch' } } }).profile;
  ok(s1.gear.rod === 'rod_leviathan' && s1.gear.reel === 'reel_rusty', 'equipped gear must be owned');
  const s2 = sanitize({ player: { coins: 77, xp: 10, lures: ['chum', 'worm', 'shrimp', 'shrimp'] } }).profile;
  eq(s2.lures, ['worm', 'shrimp', 'chum'], 'lures deduped and kept in shop order');
  ok(sanitize({ coins: 77 }).profile.coins === 77, 'bare legacy player object accepted');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
section('integration: createProgression on a fake game');
{
  localStorage.clear();
  const game = fakeGame();
  const prog = createProgression(game);
  const P = game.player;
  ok(P === game.player && P.stats && P.coins === 0 && P.level === 1, 'fresh profile on an empty storage');
  eq({ ...P.stats }, DEFAULT_STATS, 'fresh stats = DEFAULT_STATS');
  ok(prog.getQuests().length === 3, '3 quests at boot');
  ok(!prog.hasSave(), 'no save yet (nothing happened)');
  const statsRef = P.stats, luresRef = P.lures, dexRef = P.dex;

  // a catch
  game.boat.x = 1800;
  const fish = createFish('clownfish', { sizeQ: 0.95, rng: createRng(3) });
  game.log.length = 0;
  game.events.emit('catch', { fish, hookQuality: 'perfect', fightTime: 3.2, maxTension: 0.5, streak: 1, depthM: 42 });
  const types = game.log.map((l) => l[0]);
  const scored = game.log.find((l) => l[0] === 'catchScored');
  ok(!!scored, 'catchScored emitted');
  const rec = scored && scored[1].record;
  ok(types.indexOf('coins') < types.indexOf('xp') && types.indexOf('xp') < types.indexOf('dexNew') && types.indexOf('dexNew') < types.indexOf('catchScored'), `event order coins → xp → dexNew → catchScored (${types.join(',')})`);
  ok(rec.isNew && !rec.isRecord && rec.sizeClass.id === 'trophy' && rec.points === Math.round(10 * Math.round(sizeMultiplier(0.95) * 100) / 100 * 1.1 * 1.5), `trophy clownfish record (points ${rec.points})`);
  ok(rec.biome === 'reef' && rec.zone === 'sunlit' && rec.day === 1 && rec.rarity.id === 'common' && rec.sizeLabel === 'length', 'record context fields');
  for (const k of ['speciesId', 'species', 'name', 'level', 'rarity', 'isItem', 'itemKind', 'lengthCm', 'weightKg', 'sizeQ', 'sizeClass', 'sizeLabel', 'shiny', 'protected', 'released', 'points', 'coins', 'xp', 'breakdown', 'isNew', 'isRecord', 'note', 'hookQuality', 'fightTime', 'depthM', 'day', 'hour', 'streak', 'levelUp']) {
    if (!(k in rec)) ok(false, 'record missing ' + k);
  }
  ok(P.coins === rec.coins && P.xp === rec.xp && P.score === rec.points && P.dex.clownfish.count === 1, 'player updated by the catch');
  ok(P.stats === statsRef && P.lures === luresRef && P.dex === dexRef, 'stats / lures / dex keep their identity');

  // record (bigger clownfish)
  game.log.length = 0;
  game.events.emit('catch', { fish: createFish('clownfish', { sizeQ: 1 }), hookQuality: 'good', streak: 2, depthM: 40 });
  ok(game.log.some((l) => l[0] === 'record') && game.log.find((l) => l[0] === 'catchScored')[1].record.isRecord, 'personal best → record event + isRecord');

  // level up across many catches
  game.log.length = 0;
  for (let i = 0; i < 6; i++) game.events.emit('catch', { fish: createFish('yellowtail_snapper', { sizeQ: 0.6 }), hookQuality: 'good', streak: 3 + i, depthM: 30 });
  const lu = game.log.find((l) => l[0] === 'levelUp');
  ok(!!lu && lu[1].level >= 2 && Array.isArray(lu[1].unlocked), `levelUp emitted (${lu && JSON.stringify(lu[1])})`);
  ok(game.log.filter((l) => l[0] === 'catchScored').some((l) => l[1].record.levelUp), 'record.levelUp set on the levelling catch');

  // shop
  const cat = prog.getCatalog();
  ok(cat.length === ALL_ITEMS.length && cat.every((c) => 'stats' in c && 'affordable' in c && 'locked' in c), 'catalogue shape');
  ok(cat.find((c) => c.id === 'rod_bamboo').equipped && cat.find((c) => c.id === 'lure_worm').equipped, 'starter rod + worm equipped');
  const fibre = cat.find((c) => c.id === 'rod_fiberglass');
  eq(fibre.stats[0], { label: 'Tackle', value: '2.3', delta: '+0.8', better: true }, 'rod stat line vs equipped');
  P.coins = 5000;
  eq(prog.buy('rod_leviathan'), { ok: false, reason: 'level' }, 'locked item → reason level');
  P.coins = 10;
  eq(prog.buy('rod_fiberglass'), { ok: false, reason: 'coins' }, 'too poor → reason coins');
  P.coins = 1000;
  game.log.length = 0;
  eq(prog.buy('rod_fiberglass'), { ok: true }, 'buy fiberglass rod');
  ok(P.coins === 1000 - RODS[1].price && P.gear.rod === 'rod_fiberglass' && P.stats.tackle === 2.3, 'coins deducted, auto-equipped, stats updated');
  ok(game.log.map((l) => l[0]).join(',').includes('coins,purchase,equip'), 'coins → purchase → equip events');
  eq(prog.buy('rod_fiberglass'), { ok: false, reason: 'owned' }, 'already owned');
  ok(prog.equip('rod_bamboo').ok && P.stats.tackle === 1.5 && prog.equip('rod_fiberglass').ok && P.stats.tackle === 2.3, 'equip swaps rods');
  ok(!prog.equip('rod_titan').ok, 'cannot equip unowned');
  ok(prog.buy('lure_shrimp').ok && P.lureId === 'shrimp' && game.fishing.lure.id === 'shrimp', 'buy lure → selected + mirrored to the idle fishing state');
  ok(prog.buy('gad_sinkers').ok && P.stats.sinkBonus === 0.35 && prog.equip('gad_sinkers').ok, 'gadget active once owned');
  ok(prog.selectLure('worm') && P.lureId === 'worm' && !prog.selectLure('chum'), 'selectLure only owned');
  ok(prog.cycleLure(1) === 'shrimp' && prog.cycleLure(1) === 'worm' && prog.cycleLure(-1) === 'shrimp', 'cycleLure wraps both ways');
  ok(prog.buy('shrimp').reason === 'owned', 'bare lure id accepted by buy()');
  game.fishing.state = 'fight';
  prog.selectLure('worm');
  ok(game.fishing.lure.id === 'shrimp', 'lure in the water is not swapped mid-fight');
  game.fishing.state = 'idle';
  prog.update(0.3);
  ok(game.fishing.lure.id === 'worm', '…but mirrored once the line is back in');
  P.lureId = 'chum';
  prog.update(0.3);
  ok(P.lureId === 'worm', 'an unowned lureId written by someone else is corrected');

  // quests: force-complete one and claim
  const q0 = P.quests[0];
  q0.progress = q0.goal; q0.done = true;
  const coinsBefore = P.coins;
  const res = prog.claimQuest(q0.id);
  ok(res.ok && P.coins === coinsBefore + q0.reward.coins && P.quests.length === 3 && !P.quests.some((q) => q.id === q0.id), 'claim pays and replaces');
  ok(!prog.claimQuest(P.quests[0].id).ok || P.quests[0].done, 'cannot claim an unfinished quest');
  {
    const open = P.quests.find((q) => !q.done);
    const others = P.quests.filter((q) => q !== open).map((q) => q.type);
    const rr = prog.rerollQuest(open.id);
    ok(rr.ok && !P.quests.some((q) => q.id === open.id) && rr.quest.type !== open.type && !others.includes(rr.quest.type) && P.quests.length === 3, `rerollQuest swaps ${open.type} → ${rr.quest && rr.quest.type}`);
    ok(!prog.rerollQuest('nope').ok, 'rerollQuest rejects unknown ids');
  }

  // items
  game.log.length = 0;
  game.events.emit('catch', { fish: createFish('message_bottle', { sizeQ: 0.5 }), hookQuality: 'good', streak: 1, depthM: 0.5 });
  const bottle = game.log.find((l) => l[0] === 'catchScored')[1].record;
  ok(bottle.isItem && bottle.itemKind === 'bottle' && typeof bottle.note === 'string' && bottle.note.length > 10, `bottle note: "${bottle.note}"`);
  P.lures.splice(1); // keep only the worm so a chest can grant something
  let gotLure = 0, chestCoins = 0;
  for (let i = 0; i < 40; i++) {
    game.log.length = 0;
    game.events.emit('catch', { fish: createFish('treasure_chest', { sizeQ: 0.5 }), hookQuality: 'good', depthM: 400 });
    const r = game.log.find((l) => l[0] === 'catchScored')[1].record;
    if (r.bonusLure) gotLure++;
    chestCoins += r.coins;
    if (i === 0) console.log(`    chest note: "${r.note}"`);
  }
  ok(gotLure > 0 && gotLure < 40, `chests sometimes contain a lure (${gotLure}/40)`);
  ok(chestCoins / 40 >= 350 && chestCoins / 40 <= 900, 'chest coins in range');
  ok(P.lures.every((id, i) => i === 0 || LURES.findIndex((l) => l.id === id) > LURES.findIndex((l) => l.id === P.lures[i - 1])), 'lures stay in shop order after chest grants');

  // protected
  game.log.length = 0;
  game.events.emit('catch', { fish: createFish('sea_turtle', { sizeQ: 0.5 }), hookQuality: 'good', streak: 1, depthM: 20 });
  const turtle = game.log.find((l) => l[0] === 'catchScored')[1].record;
  ok(turtle.released && turtle.protected && game.log.find((l) => l[0] === 'coins')[1].reason === 'grant', 'turtle released with a conservation grant');

  // hook depth wins over a landing depth reported by 'catch'
  game.boat.x = 8800;
  const deepFish = createFish('anglerfish', { sizeQ: 0.5, x: 8800, y: 4000 });
  game.events.emit('hookSet', { fish: deepFish, quality: 'good' });
  deepFish.y = 10; // reeled up to the boat
  game.log.length = 0;
  game.events.emit('catch', { fish: deepFish, hookQuality: 'good', fightTime: 20, streak: 1, depthM: 0 });
  const deepRec = game.log.find((l) => l[0] === 'catchScored')[1].record;
  ok(Math.abs(deepRec.depthM - 500) < 1 && deepRec.zone === 'midnight' && deepRec.breakdown.some((b) => b.label.startsWith('Deep-sea premium')), `hook depth remembered (depth ${deepRec.depthM} m, zone ${deepRec.zone})`);
  ok(deepRec.coins === Math.round(deepRec.points * 1.9), `deep-sea premium ×1.90 at 500 m (coins ${deepRec.coins} for ${deepRec.points} pts)`);

  // lost fish & days
  const lostBefore = P.totals.lost;
  game.events.emit('fightEnd', { fish: null, result: 'snapped' });
  game.events.emit('fightEnd', { fish: null, result: 'landed' });
  ok(P.totals.lost === lostBefore + 1 && P.streak === 0, 'fightEnd snapped → lost +1, streak reset');
  game.events.emit('newDay', { day: 2 });
  ok(P.day === 2 && prog.getSummary().daysAtSea === 2, 'newDay → day counter');

  // broken catch payloads never block the card
  game.log.length = 0;
  game.reportError = () => {};
  game.events.emit('catch', {});
  game.events.emit('catch', { fish: { speciesId: 'nope' } });
  ok(game.log.filter((l) => l[0] === 'catchScored').length === 2, 'malformed catch events still emit catchScored');

  // dex & summary & achievements
  const dex = prog.getDex();
  ok(dex.length === SPECIES.length && dex.every((d, i) => d.species === SPECIES[i]), 'dex: one entry per species, same order');
  ok(dex.find((d) => d.species.id === 'clownfish').discovered && !dex.find((d) => d.species.id === 'megalodon').discovered, 'dex discovered flags');
  const sum = prog.getSummary();
  ok(sum.totalCaught === P.totals.caught && sum.speciesTotal === ANIMALS.length && sum.biggestCatch && sum.bestCatch, 'summary');
  const achs = prog.getAchievements();
  ok(achs.length === ACHIEVEMENTS.length && achs.find((a) => a.id === 'first_catch').unlocked, 'first-catch achievement unlocked');
  const meg = achs.find((a) => a.id === 'megalodon');
  ok(meg.hidden && !meg.unlocked && meg.title === '???', 'hidden achievement masked while locked');
  ok(achs.length >= 25 && achs.filter((a) => a.hidden).length >= 4, `${achs.length} achievements, ${achs.filter((a) => a.hidden).length} hidden`);

  // cheats
  const lvBefore = P.level;
  const lvTarget = Math.min(MAX_LEVEL - 1, lvBefore + 6);
  game.log.length = 0;
  ok(prog.cheat('level', lvTarget) && P.level === lvTarget, `cheat level ${lvBefore} → ${lvTarget}`);
  const lvEv = game.log.find((l) => l[0] === 'levelUp');
  ok(lvEv && lvEv[1].unlocked.length > 0 && lvEv[1].unlocked.every((id) => ALL_ITEMS.find((i) => i.id === id).unlockLevel > lvBefore), 'multi-level jump: unlocked = union over skipped levels');
  ok(prog.cheat('coins', 500) && prog.cheat('xp', 10), 'cheat coins / xp');
  ok(prog.cheat('dexAll') && prog.getDex().every((d) => d.discovered), 'cheat dexAll');
  ok(prog.cheat('unlockAll') && P.stats.tackle === 10 && P.lures.length === LURES.length && P.level === MAX_LEVEL, 'cheat unlockAll');
  const gNoDebug = fakeGame({ debug: false, flags: { nosave: '1' } });
  const pNoDebug = createProgression(gNoDebug);
  ok(pNoDebug.cheat('coins', 100) === false && gNoDebug.player.coins === 0, 'cheats refused without debug');

  // save round-trip into a second "session"
  ok(prog.save() && prog.hasSave(), 'save() writes');
  const raw = localStorage.getItem(SAVE_KEY);
  ok(raw && JSON.parse(raw).v === 1, 'versioned JSON in localStorage[SAVE_KEY]');
  const game2 = fakeGame({ seed: 9 });
  const prog2 = createProgression(game2);
  const P2 = game2.player;
  ok(P2.coins === P.coins && P2.xp === P.xp && P2.level === P.level && P2.day === P.day, 'reload restores coins / xp / level / day');
  eq(P2.gear, P.gear, 'reload restores equipped gear');
  eq({ ...P2.stats }, { ...P.stats }, 'reload recomputes the same stats');
  eq(Object.keys(P2.dex).length, Object.keys(P.dex).length, 'reload restores the dex');
  eq(prog2.getQuests().map((q) => q.id), prog.getQuests().map((q) => q.id), 'reload restores the active quests');
  ok(game2.boat.tier === P2.boatTier && P2.boatTier === 2, 'boat tier mirrored to game.boat on load');

  // reset
  game2.log.length = 0;
  prog2.reset();
  ok(P2.coins === 0 && P2.level === 1 && !localStorage.getItem(SAVE_KEY) && !prog2.hasSave() && game2.log.some((l) => l[0] === 'profileReset'), 'reset wipes the save and emits profileReset');
  ok(P2.stats.tackle === 1.5 && game2.boat.tier === 0 && prog2.getQuests().length === 3, 'reset → starter stats, quests refilled');

  // corrupted storage must not crash
  for (const junk of ['{not json', '', 'null', '[]', '{"v":1,"player":"x"}', '{"v":1,"player":{"coins":"NaN","dex":[1,2]}}']) {
    localStorage.setItem(SAVE_KEY, junk);
    let crashed = false;
    try {
      const g = fakeGame();
      const pr = createProgression(g);
      if (!(g.player.coins >= 0 && pr.getQuests().length === 3)) crashed = true;
    } catch (e) {
      crashed = true;
      console.log('    crashed on', junk, e);
    }
    ok(!crashed, `corrupted save ${JSON.stringify(junk)} → fresh profile, no crash`);
  }
  ok(localStorage.getItem(SAVE_KEY + '.corrupt') !== null, 'unreadable save backed up to .corrupt');

  // nosave: never touches storage
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialize({ ...freshProfile(), coins: 999 })));
  const gN = fakeGame({ flags: { nosave: '1' } });
  const pN = createProgression(gN);
  ok(gN.player.coins === 0 && !pN.hasSave(), 'nosave: does not read the save');
  gN.events.emit('catch', { fish: createFish('clownfish', { sizeQ: 0.5 }), hookQuality: 'good', streak: 1, depthM: 40 });
  pN.save();
  ok(JSON.parse(localStorage.getItem(SAVE_KEY)).player.coins === 999, 'nosave: does not write the save');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('FAILURES:\n  ' + failures.join('\n  '));
  process.exitCode = 1;
}
// pending autosave timers would keep node alive for ~1 s — fine, but exit promptly
setTimeout(() => process.exit(process.exitCode || 0), 50);
