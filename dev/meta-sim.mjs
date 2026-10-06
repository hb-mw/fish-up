#!/usr/bin/env node
// META economy & pacing simulation:   node dev/meta-sim.mjs [--seeds 16] [--minutes 180] [--verbose]
//
// Plays a plausible stream of catches with the REAL scoring (progression-score.js), gear/stat model
// (gear.js), quest generator (progression-quests.js) and the kernel's day/night + weather clock
// (environment.js), and prints when each shop item gets unlocked and bought, plus milestones.
//
// ── TIMING / SKILL MODEL (assumptions about gameplay — tune here if the real fight model differs) ──
//   cast            2.5 s (charge + flight)
//   sink            depth / (lure.sink × (1 + sinkBonus))
//   bite wait       max(3, 14 / Σw) + 2 s, × (1 − 0.12·sonar)          Σw = Σ abundance × activity × affinity
//                   at night lamp ≥ 1 adds +30 % (+60 % floodlight) attraction above 120 m
//   hook-set        12 % of bites missed (− hookWindowBonus × 0.25); quality: 30 % perfect · 55 % good · 15 % late
//   fight           4 + 1.6 · power · (0.6 + stamina/10) · (1 − 0.35·dragSmooth) s, ×(1 + 0.3·(power − tackle)) when outgunned
//   loss            clamp(0.06 + 0.22·(power − tackle) − 0.08·(rodControl + dragSmooth), 0.03, 0.92)  → half a fight wasted
//   reel-up         depth / (0.75 · reelSpeed)
//   landing + card  5 s
//   human overhead  ×1.3 on all of the above (sailing about, menus, admiring the catch card)
//   size / shiny    sampleSizeQ(bias = lure.bigBias + 0.5·luck) · shiny 1/150 × (1 + 3·luck)
//   spots           the player fishes the (biome, depth, lure) with the best expected coins/minute, re-planned at
//                   every purchase and at dawn/dusk; travel = Δx / boatSpeed
//   shopping        buys the cheapest affordable unlocked upgrade, except that while a better LINE or ROD is
//                   unlocked but unaffordable it only impulse-buys items costing < 25 % of its coins
//   quests          always 3 active (real generator); completed quests are claimed at once
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
import { LEVEL_POINTS, WORLD, zoneAt } from '../src/core/config.js';
import { createRng } from '../src/core/rng.js';
import { createEvents } from '../src/core/events.js';
import { createEnvironment } from '../src/world/environment.js';
import { SPECIES } from '../src/data/species.js';
import { LURES_BY_ID, lureAffinity } from '../src/data/lures.js';
import { sampleSizeQ } from '../src/entities/fishbase.js';
import { lengthFor, weightFor } from '../src/data/species.js';
import { ALL_ITEMS, ITEMS_BY_ID, computeStats, EQUIP_SLOTS, STARTER_GEAR, GEAR } from '../src/data/gear.js';
import { scoreCatch, levelForXp, xpAt, MAX_LEVEL, deepPremium } from '../src/gameplay/progression-score.js';
import { generateQuest, questOnCatch, computeReach, SEABED_M } from '../src/gameplay/progression-quests.js';
import { freshProfile } from '../src/gameplay/progression-save.js';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? Number(argv[argv.indexOf(k) + 1]) : d);
const SEEDS = arg('--seeds', 16);
const MINUTES = arg('--minutes', 180);
const VERBOSE = argv.includes('--verbose');

const OVERHEAD = 1.3;
const BIOME_X = { reef: 1800, kelp: 4000, slope: 6300, open: 8800, trench: 11200 };
const COLUMN = [3, 12, 25, 45, 70, 100, 140, 190, 250, 320, 400, 480, 560, 650, 750, 850];

// candidate spots: open-water depths per biome + bottom spots across its seabed range
const SPOTS = [];
for (const b of Object.keys(BIOME_X)) {
  const sb = SEABED_M[b];
  for (const d of COLUMN) if (d < sb[1] - 5) SPOTS.push({ biome: b, depth: d, bottom: false });
  for (const k of [0.15, 0.5, 0.85]) SPOTS.push({ biome: b, depth: Math.round(sb[0] + (sb[1] - sb[0]) * k), bottom: true });
}

const activity = (s, phase) => s.active[phase] ?? 1;
function bandAt(s, phase) {
  return phase === 'night' && s.nightDepthM ? s.nightDepthM : s.depthM;
}
/** Which species/items can take the lure at this spot. */
function spotPool(spot, lure, phase, stats) {
  const out = [];
  let sum = 0;
  for (const s of SPECIES) {
    if (!s.biomes.includes(spot.biome)) continue;
    const band = bandAt(s, phase);
    const d = spot.depth;
    let w = 0;
    if (s.item) {
      if (s.item.kind === 'bottle') w = d <= 5 ? s.abundance * 0.6 : 0;
      else w = spot.bottom && d >= band[0] - 5 && d <= band[1] + 5 ? s.abundance * 0.6 : 0;
    } else {
      const inBand = d >= band[0] - 5 && d <= band[1] + 5;
      if (s.layer === 'surface') w = d <= Math.min(20, band[1]) ? 1 : 0;
      else if (s.layer === 'pelagic') w = inBand ? 1 : 0;
      else w = spot.bottom && inBand ? 1 : 0;
      if (w) w = s.abundance * activity(s, phase) * lureAffinity(lure, s) * (s.level >= 6 ? 1 + stats.luck : 1);
    }
    if (w > 0.0005) {
      out.push({ s, w });
      sum += w;
    }
  }
  return { list: out, sum };
}
function lossChance(s, st) {
  if (s.item) return 0.02;
  const gap = s.fight.power - st.tackle;
  return Math.min(0.92, Math.max(0.03, 0.06 + 0.22 * gap - 0.08 * (st.rodControl + st.dragSmooth)));
}
function fightTime(s, st) {
  if (s.item) return 3 + s.fight.power;
  const gap = Math.max(0, s.fight.power - st.tackle);
  return (4 + 1.6 * s.fight.power * (0.6 + s.fight.stamina / 10) * (1 - 0.35 * st.dragSmooth)) * (1 + 0.3 * gap);
}
function waitTime(sum, spot, phase, st) {
  let attract = sum;
  if (phase === 'night' && st.lamp > 0 && spot.depth < 120) attract *= 1 + 0.3 * st.lamp;
  return (Math.max(3, 14 / Math.max(0.05, attract)) + 2) * (1 - 0.12 * st.sonar);
}
function cycleTime(spot, lure, st, s, lost) {
  const px = spot.depth * WORLD.pxPerM;
  const sink = px / (lure.sink * (1 + st.sinkBonus));
  const up = px / (0.75 * st.reelSpeed);
  const f = fightTime(s, st);
  return 2.5 + sink + (lost ? f * 0.5 + up : f + up + 5);
}
/** Expected coins per second at a spot with a lure (for planning) + the landed-catch mix. */
function spotRate(spot, lure, phase, st) {
  const { list, sum } = spotPool(spot, lure, phase, st);
  if (sum <= 0) return { rate: 0, et: 1, mix: [] };
  const miss = Math.max(0.03, 0.12 - 0.25 * st.hookWindowBonus);
  let ev = 0, et = 0;
  const mix = [];
  for (const { s, w } of list) {
    const p = w / sum;
    const loss = lossChance(s, st);
    const pts = s.item ? s.item.points : LEVEL_POINTS[s.level] * 0.95;
    const coins = s.item ? (s.item.coins[0] + s.item.coins[1]) / 2 : pts * s.valueMult * deepPremium(spot.depth) * (s.protected ? 0.75 : 1);
    ev += p * (1 - loss) * coins;
    et += p * ((1 - loss) * cycleTime(spot, lure, st, s, false) + loss * cycleTime(spot, lure, st, s, true));
    mix.push({ s, p: p * (1 - loss) });
  }
  et += waitTime(sum, spot, phase, st) / (1 - miss);
  et *= OVERHEAD;
  return { rate: ev / et, et, mix };
}
/** Probability that one cast at this spot advances quest q (only spot-dependent quest types). */
function questShare(q, spot, mix, phase, player) {
  let pr = 0;
  const zone = zoneAt(spot.depth * WORLD.pxPerM).id;
  for (const { s, p } of mix) {
    const animal = !s.item;
    let hit = false;
    switch (q.type) {
      case 'species': hit = s.id === q.target; break;
      case 'biome': hit = animal && spot.biome === q.target; break;
      case 'zone': hit = animal && zone === q.target; break;
      case 'junk': hit = s.item && s.item.kind === 'junk'; break;
      case 'release': hit = animal && s.protected; break;
      case 'depth': hit = animal && spot.depth >= q.target; break;
      case 'level': hit = animal && s.level >= q.target; break;
      case 'newSpecies': hit = animal && !player.dex[s.id]; break;
      case 'night': hit = animal && phase === 'night'; break;
      default: hit = false;
    }
    if (hit) pr += p;
  }
  return pr;
}
const XP_COIN = 0.5; // how much the simulated player values 1 XP in coins when weighing quests
function plan(player, phase) {
  let best = null;
  for (const lid of player.lures) {
    const lure = LURES_BY_ID[lid];
    for (const spot of SPOTS) {
      if (spot.depth > player.stats.lineLengthM * 0.92) continue;
      const r = spotRate(spot, lure, phase, player.stats);
      let score = r.rate;
      for (const q of player.quests) {
        const share = questShare(q, spot, r.mix, phase, player);
        if (share > 0) score += (share * (q.reward.coins + XP_COIN * q.reward.xp)) / Math.max(1, q.goal) / r.et;
      }
      if (!best || score > best.score) best = { spot, lure, rate: r.rate, score };
    }
  }
  return best;
}

function nextUpgrade(player) {
  const owned = (it) => (it.slot === 'lure' ? player.lures.includes(it.lureId) : player.owned.includes(it.id));
  const cands = ALL_ITEMS.filter((it) => !owned(it) && it.unlockLevel <= player.level && it.price > 0
    && (!EQUIP_SLOTS.includes(it.slot) || it.tier > ITEMS_BY_ID[player.gear[it.slot]].tier));
  if (!cands.length) return null;
  cands.sort((a, b) => a.price - b.price);
  const key = cands.find((it) => it.slot === 'line' || it.slot === 'rod');
  const cheapest = cands[0];
  if (key && key !== cheapest && player.coins < key.price) {
    return cheapest.price <= player.coins * 0.25 ? cheapest : null;
  }
  return player.coins >= cheapest.price ? cheapest : null;
}

function simulate(seed) {
  const rng = createRng(seed);
  const game = { rng: createRng(seed * 7 + 3), events: createEvents() };
  const env = createEnvironment(game);
  const player = freshProfile();
  const recompute = () => {
    const gad = player.owned.filter((id) => ITEMS_BY_ID[id].slot === 'gadget');
    player.stats = computeStats(player.gear, gad);
  };
  recompute();
  let t = 0, x = 1750, qseq = 0, streak = 0;
  const log = { unlock: {}, buy: {}, level: {}, zone: {}, biome: {}, windows: [], firstBuy: null };
  const fillQuests = () => {
    while (player.quests.length < 3) player.quests.push(generateQuest(player, rng, player.quests, ++qseq));
  };
  fillQuests();
  const stats = { catches: 0, lost: 0, coinsCatch: 0, coinsQuest: 0, quests: 0, xp: 0 };
  let win = { coins: 0, catches: 0, quest: 0 };
  let nextWin = 600;
  const unlockCheck = () => {
    for (const it of ALL_ITEMS) if (it.unlockLevel <= player.level && log.unlock[it.id] === undefined) log.unlock[it.id] = t / 60;
  };
  const addXp = (n) => {
    player.xp += n;
    const lv = levelForXp(player.xp);
    for (let l = player.level + 1; l <= lv; l++) log.level[l] = t / 60;
    player.level = lv;
    unlockCheck();
  };
  unlockCheck();
  let p = plan(player, env.phase);
  let lastPhase = env.phase;
  const advance = (dt) => {
    while (dt > 0) {
      const step = Math.min(1, dt);
      env.update(step);
      t += step;
      dt -= step;
    }
  };

  while (t < MINUTES * 60) {
    if (env.phase !== lastPhase) {
      lastPhase = env.phase;
      p = plan(player, env.phase);
    }
    // travel
    const tx = BIOME_X[p.spot.biome];
    if (Math.abs(tx - x) > 50) {
      advance(Math.abs(tx - x) / player.stats.boatSpeed);
      x = tx;
    }
    const { list, sum } = spotPool(p.spot, p.lure, env.phase, player.stats);
    if (!list.length) {
      advance(10);
      p = plan(player, env.phase);
      continue;
    }
    advance(waitTime(sum, p.spot, env.phase, player.stats) * OVERHEAD);
    const miss = Math.max(0.03, 0.12 - 0.25 * player.stats.hookWindowBonus);
    if (rng.chance(miss)) {
      advance(2 * OVERHEAD);
      continue;
    }
    const pick = rng.weighted(list, (e) => e.w).s;
    const lost = rng.chance(lossChance(pick, player.stats));
    advance(cycleTime(p.spot, p.lure, player.stats, pick, lost) * OVERHEAD);
    if (lost) {
      stats.lost++;
      streak = 0;
      continue;
    }
    streak++;
    const q = rng.next();
    const hookQuality = pick.item ? 'good' : q < 0.3 ? 'perfect' : q < 0.85 ? 'good' : 'late';
    const sizeQ = sampleSizeQ(rng, p.lure.bigBias + 0.5 * player.stats.luck);
    const shiny = !pick.item && rng.chance((1 / 150) * (1 + 3 * player.stats.luck));
    const isNew = !player.dex[pick.id];
    const sc = scoreCatch({ species: pick, sizeQ, shiny, hookQuality, streak: pick.item ? 0 : streak, isNew, depthM: p.spot.depth, roll: rng.next() });
    player.dex[pick.id] = { count: (player.dex[pick.id]?.count || 0) + 1 };
    player.coins += sc.coins;
    player.score += sc.points;
    stats.catches++;
    stats.coinsCatch += sc.coins;
    win.coins += sc.coins;
    win.catches++;
    addXp(sc.xp);
    const zone = zoneAt(p.spot.depth * WORLD.pxPerM).id;
    if (!pick.item) {
      if (log.zone[zone] === undefined) log.zone[zone] = t / 60;
      if (log.biome[p.spot.biome] === undefined) log.biome[p.spot.biome] = t / 60;
    }
    const lengthCm = lengthFor(pick, sizeQ);
    const rec = {
      speciesId: pick.id, isItem: !!pick.item, itemKind: pick.item?.kind || null, level: pick.level, sizeClass: sc.sizeClass,
      points: sc.points, weightKg: weightFor(pick, lengthCm), shiny, hookQuality, released: sc.released, isNew, streak, depthM: p.spot.depth,
    };
    const ctx = { biome: p.spot.biome, zone, phase: env.phase, weather: env.weather.type };
    for (let i = 0; i < player.quests.length; i++) {
      const qq = player.quests[i];
      questOnCatch(qq, rec, ctx);
      if (qq.done) {
        player.coins += qq.reward.coins;
        stats.coinsQuest += qq.reward.coins;
        win.quest += qq.reward.coins;
        stats.quests++;
        addXp(qq.reward.xp);
        player.quests[i] = generateQuest(player, rng, player.quests, ++qseq); // like claimQuest(): replacement differs in type
      }
    }
    // shopping, then re-plan (quests and the dex changed too)
    let bought = false;
    for (let it = nextUpgrade(player); it; it = nextUpgrade(player)) {
      player.coins -= it.price;
      log.buy[it.id] = t / 60;
      if (log.firstBuy === null) log.firstBuy = t / 60;
      if (it.slot === 'lure') player.lures.push(it.lureId);
      else {
        player.owned.push(it.id);
        if (EQUIP_SLOTS.includes(it.slot)) player.gear[it.slot] = it.id;
      }
      bought = true;
    }
    if (bought) recompute();
    p = plan(player, env.phase);
    while (t >= nextWin) {
      log.windows.push({ min: nextWin / 60, level: player.level, xp: player.xp, coins: win.coins, quest: win.quest, catches: win.catches, line: player.stats.lineLengthM, tackle: player.stats.tackle, spot: `${p.spot.biome}@${p.spot.depth}${p.spot.bottom ? 'b' : ''}/${p.lure.id}`, reachV: computeReach(player).coinsPerCatch });
      win = { coins: 0, catches: 0, quest: 0 };
      nextWin += 600;
    }
  }
  return { log, stats, player };
}

// ── run & report ────────────────────────────────────────────────────────────────────────────────
const runs = [];
for (let i = 0; i < SEEDS; i++) runs.push(simulate(1000 + i * 17));
const median = (arr) => {
  const v = arr.filter((x) => x !== undefined && x !== null).sort((a, b) => a - b);
  if (v.length < Math.ceil(runs.length / 2)) return null; // not reached in most runs
  return v[Math.floor((runs.length - 1) / 2)] ?? v[v.length - 1];
};
const fmt = (m) => (m === null ? '   —  ' : m < 1 ? `${(m * 60).toFixed(0).padStart(4)} s` : `${m.toFixed(1).padStart(5)}m`);

console.log(`META pacing sim — ${SEEDS} seeds × ${MINUTES} min (median times; "—" = not reached in most runs)\n`);
console.log('ITEM                              slot    price   lvl   unlocked   bought');
for (const it of ALL_ITEMS) {
  if (it.price === 0) continue;
  const u = median(runs.map((r) => r.log.unlock[it.id]));
  const b = median(runs.map((r) => r.log.buy[it.id]));
  console.log(`${it.name.padEnd(33)} ${it.slot.padEnd(6)} ${String(it.price).padStart(6)}  ${String(it.unlockLevel).padStart(3)}   ${fmt(u)}    ${fmt(b)}`);
}
console.log('\nMILESTONES');
const ms = (label, fn) => console.log(`  ${label.padEnd(34)} ${fmt(median(runs.map(fn)))}`);
ms('first purchase', (r) => r.log.firstBuy);
for (const id of ['line_mono', 'line_braid', 'line_fluoro', 'line_spectra', 'line_dyneema', 'line_kevlar']) ms(`line ${ITEMS_BY_ID[id].stats.lineLengthM} m bought`, (r) => r.log.buy[id]);
ms('tackle 10 (rod 6 + line 7)', (r) => Math.max(r.log.buy.rod_leviathan ?? Infinity, r.log.buy.line_kevlar ?? Infinity) === Infinity ? undefined : Math.max(r.log.buy.rod_leviathan, r.log.buy.line_kevlar));
ms('everything bought', (r) => (ALL_ITEMS.every((it) => it.price === 0 || r.log.buy[it.id] !== undefined) ? Math.max(...Object.values(r.log.buy)) : undefined));
for (const z of ['twilight', 'midnight', 'abyss']) ms(`first catch in the ${z} zone`, (r) => r.log.zone[z]);
for (const b of ['kelp', 'slope', 'open', 'trench']) ms(`first catch in biome ${b}`, (r) => r.log.biome[b]);
for (const l of [2, 3, 5, 8, 10, 12, 15, 18, 20, 25, 30]) ms(`level ${l}`, (r) => r.log.level[l]);

console.log('\nPER 10 MINUTES (seed 0; median across seeds for coins)');
console.log('  min  lvl      xp(med)   coins/10m (quests)   catches  coins/catch  reachV  line  tackle  spot');
const W = runs[0].log.windows;
for (let i = 0; i < W.length; i++) {
  const w = W[i];
  const medCoins = median(runs.map((r) => r.log.windows[i]?.coins + r.log.windows[i]?.quest));
  const medXp = median(runs.map((r) => r.log.windows[i]?.xp));
  console.log(`  ${String(w.min).padStart(3)}  ${String(w.level).padStart(3)}  ${String(medXp).padStart(10)}   ${String(medCoins).padStart(8)} (${String(w.quest).padStart(5)})   ${String(w.catches).padStart(7)}  ${(w.coins / Math.max(1, w.catches)).toFixed(0).padStart(11)}  ${w.reachV.toFixed(0).padStart(6)}  ${String(w.line).padStart(4)}  ${w.tackle.toFixed(1).padStart(6)}  ${w.spot}`);
}
const tot = runs.map((r) => r.stats);
const avg = (k) => tot.reduce((a, s) => a + s[k], 0) / tot.length;
console.log(`\nper run: ${avg('catches').toFixed(0)} catches, ${avg('lost').toFixed(0)} lost, ${avg('quests').toFixed(0)} quests; income ${avg('coinsCatch').toFixed(0)} from catches + ${avg('coinsQuest').toFixed(0)} from quests (${((100 * avg('coinsQuest')) / (avg('coinsCatch') + avg('coinsQuest'))).toFixed(0)} %)`);
if (VERBOSE) {
  for (const r of runs.slice(0, 2)) {
    console.log('\nbuy order:', Object.entries(r.log.buy).sort((a, b) => a[1] - b[1]).map(([id, m]) => `${id}@${m.toFixed(1)}`).join(' '));
  }
}
