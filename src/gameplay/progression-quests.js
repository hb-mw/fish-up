// Fish Up — META: quest generation & progress (pure; node-importable).
//
// computeReach(player) works out what the player can catch RIGHT NOW: how deep the line goes, which
// species the owned lures attract, which fish the tackle can land, which biomes / zones hold them, and
// what a typical catch is worth. generateQuest() only rolls quests that are completable with that kit,
// and pays rewards in proportion to the expected effort (in "catches") × the value of a typical catch.
import { BIOMES, ZONES, WORLD, LEVEL_POINTS, SIZE_CLASSES } from '../core/config.js';
import { ANIMALS, ITEMS, SPECIES_BY_ID, lengthFor, weightFor } from '../data/species.js';
import { LURES, LURES_BY_ID, lureAffinity } from '../data/lures.js';
import { heightAt } from '../world/terrain.js';
import { QUEST_TEMPLATES, BIOME_TEXT, ZONE_TEXT } from '../data/quests.js';
import { xpForPoints, deepPremium, SCORE } from './progression-score.js';

/** Usable depth = line length × this (part of the line always runs sideways). */
export const REACH_FACTOR = 0.92;
/** A species counts as landable when fight.power ≤ tackle + this. */
export const LANDABLE_MARGIN = 1;
/** Minimum lure affinity for a species to count as catchable. */
export const MIN_AFFINITY = 0.3;
/** Quest pay: reward ≈ QUEST_PAY × (what the effort would earn from the catches themselves). */
export const QUEST_PAY = 0.42;
/** Mean of sizeMultiplier(sampleSizeQ()) for an unbiased bite (≈0.95). */
const AVG_SIZE_MULT = 0.95;

/** Seabed depth range [min, max] in metres per biome, over the sailable part of the world. */
export const SEABED_M = (() => {
  const out = {};
  for (const b of BIOMES) {
    let lo = Infinity, hi = -Infinity;
    const x0 = Math.max(b.from, WORLD.boatMinX - 200), x1 = Math.min(b.to, WORLD.boatMaxX + 200);
    for (let x = x0; x <= x1; x += 25) {
      const d = heightAt(x) / WORLD.pxPerM;
      if (d > 2) {
        lo = Math.min(lo, d);
        hi = Math.max(hi, d);
      }
    }
    out[b.id] = lo <= hi ? [lo, hi] : null;
  }
  return out;
})();
export const ZONE_M = Object.fromEntries(ZONES.map((z) => [z.id, [z.from / WORLD.pxPerM, z.to / WORLD.pxPerM]]));
export const SIZE_RANK = Object.fromEntries(SIZE_CLASSES.map((c, i) => [c.id, i]));
const BIOME_IDS = new Set(BIOMES.map((b) => b.id));
const ZONE_IDS = new Set(ZONES.map((z) => z.id));
const TYPES = new Set(QUEST_TEMPLATES.map((t) => t.type));
/** P(size class ≥ X) for an unbiased bite: sampleSizeQ = u^2.3. */
const SIZE_SHARE = { large: 0.21, huge: 0.092, trophy: 0.031 };

const bandsOf = (s) => (s.nightDepthM ? [s.depthM, s.nightDepthM] : [s.depthM]);
const isFloor = (s) => s.layer === 'benthic' || s.layer === 'demersal';
const meanActive = (s) => (s.active.day + s.active.dawn + s.active.dusk + s.active.night) / 4;

/**
 * Can a lure reach this species' habitat? Optionally restricted to one biome and/or a depth window [m].
 * Bottom dwellers additionally need the seabed (of one of their biomes) inside the reachable band.
 */
export function habitatReachable(s, maxD, biomeId = null, win = null) {
  const biomes = biomeId ? (s.biomes.includes(biomeId) ? [biomeId] : []) : s.biomes;
  if (!biomes.length) return false;
  for (const band of bandsOf(s)) {
    let lo = band[0], hi = Math.min(band[1], maxD);
    if (win) {
      lo = Math.max(lo, win[0]);
      hi = Math.min(hi, win[1]);
    }
    if (lo > hi) continue;
    if (!isFloor(s)) return true;
    for (const b of biomes) {
      const sb = SEABED_M[b];
      if (sb && Math.max(lo, sb[0]) <= Math.min(hi, sb[1])) return true;
    }
  }
  return false;
}

function overlaps(a, b) {
  if (!a.biomes.some((x) => b.biomes.includes(x))) return false;
  for (const ba of bandsOf(a)) for (const bb of bandsOf(b)) if (ba[0] <= bb[1] && bb[0] <= ba[1]) return true;
  return false;
}

/**
 * What can this player catch right now?
 * @param {object} player  game.player (reads stats, lures, level, dex)
 */
export function computeReach(player) {
  const stats = player.stats || {};
  const maxDepthM = Math.max(10, (Number(stats.lineLengthM) || 60) * REACH_FACTOR);
  const tackle = Number(stats.tackle) || 1.5;
  const lures = (player.lures || []).map((id) => LURES_BY_ID[id]).filter(Boolean);
  if (!lures.length) lures.push(LURES[0]);
  const pool = [];
  for (const s of ANIMALS) {
    if (s.secret || s.fight.power > tackle + LANDABLE_MARGIN) continue;
    let aff = 0, lure = null;
    for (const l of lures) {
      const a = lureAffinity(l, s);
      if (a > aff) {
        aff = a;
        lure = l;
      }
    }
    if (aff < MIN_AFFINITY || !habitatReachable(s, maxDepthM)) continue;
    const points = LEVEL_POINTS[s.level] * AVG_SIZE_MULT;
    const band = s.depthM;
    const deep = deepPremium((band[0] + Math.min(band[1], maxDepthM)) / 2);
    pool.push({
      s, lure, aff,
      w: s.abundance * aff * meanActive(s),
      points,
      coins: points * s.valueMult * deep * (s.protected ? SCORE.releaseCoins : 1),
      xp: xpForPoints(points) * (s.protected ? SCORE.releaseXp : 1),
      kg: weightFor(s, lengthFor(s, 0.3)),
    });
  }
  // Typical catch: weight by abundance × points — players gravitate to the best fish they can land
  // (calibrated against dev/meta-sim.mjs, whose planner maximises coins per minute).
  let sw = 0, sc = 0, sx = 0, sp = 0, sk = 0;
  for (const e of pool) {
    const k = e.w * e.points;
    sw += k;
    sc += k * e.coins;
    sx += k * e.xp;
    sp += k * e.points;
    sk += k * e.kg;
  }
  const junk = ITEMS.filter((s) => s.item.kind === 'junk').some((s) => habitatReachable(s, maxDepthM));
  return {
    level: player.level || 1,
    maxDepthM,
    tackle,
    lures,
    pool,
    junk,
    coinsPerCatch: sw ? sc / sw : 10,
    xpPerCatch: sw ? sx / sw : 15,
    pointsPerCatch: sw ? sp / sw : 10,
    kgPerCatch: sw ? sk / sw : 0.5,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
const article = (name) => (/^[aeiou]/i.test(name) ? 'an' : 'a');
/** 2 significant digits, multiples of 5 above 20. */
function niceNumber(v) {
  if (v <= 0) return 0;
  const k = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  let r = Math.round(v / k) * k;
  if (r >= 20) r = Math.round(r / 5) * 5;
  return r;
}
const round5 = (v) => Math.max(5, Math.round(v / 5) * 5);
const sumW = (list) => list.reduce((a, e) => a + e.w, 0);
const fmtKg = (kg) => (kg < 10 ? String(Math.round(kg * 10) / 10) : String(Math.round(kg)));

// ── quest makers: (reach, rng, player) → partial quest {type, target, goal, effort, title, desc} | null ──
const MAKERS = {
  species(R, rng, p) {
    if (!R.pool.length) return null;
    const e = rng.weighted(R.pool, (x) => x.w * (p.dex && p.dex[x.s.id] && p.dex[x.s.id].count > 0 ? 1 : 1.6));
    if (!e) return null;
    const share = e.w / Math.max(e.w, sumW(R.pool.filter((x) => overlaps(x.s, e.s))));
    const n = share > 0.3 ? rng.int(3, 5) : share > 0.12 ? rng.int(2, 3) : 1;
    const name = e.s.name;
    // players can target a species (right spot, right lure), so the habitat share overstates the effort
    return {
      type: 'species', target: e.s.id, goal: n, effort: n * Math.min(5, 1 + 0.5 / share),
      title: `Wanted: ${name}`,
      desc: n === 1 ? `Catch ${article(name)} ${name}` : `Catch ${n} × ${name}`,
    };
  },
  biome(R, rng) {
    const opts = BIOMES.map((b) => ({ b, list: R.pool.filter((e) => habitatReachable(e.s, R.maxDepthM, b.id)) })).filter((o) => o.list.length >= 2);
    const o = rng.weighted(opts, (x) => sumW(x.list));
    if (!o) return null;
    const n = rng.int(4, 7);
    return { type: 'biome', target: o.b.id, goal: n, effort: n * 1.3, title: BIOME_TEXT[o.b.id].title, desc: `Catch ${n} fish ${BIOME_TEXT[o.b.id].where}` };
  },
  zone(R, rng) {
    const opts = ZONES.filter((z) => z.id !== 'sunlit')
      .map((z) => ({ z, list: R.pool.filter((e) => habitatReachable(e.s, R.maxDepthM, null, ZONE_M[z.id])) }))
      .filter((o) => o.list.length >= 2);
    if (!opts.length) return null;
    const o = rng.chance(0.6) ? opts[opts.length - 1] : rng.pick(opts);
    const n = rng.int(3, 5);
    return { type: 'zone', target: o.z.id, goal: n, effort: n * 1.6, title: ZONE_TEXT[o.z.id].title, desc: `Catch ${n} fish ${ZONE_TEXT[o.z.id].where}` };
  },
  level(R) {
    const total = sumW(R.pool);
    if (!total) return null;
    for (let L = 10; L >= 2; L--) {
      const share = sumW(R.pool.filter((e) => e.s.level >= L)) / total;
      if (share >= 0.07) {
        const n = share > 0.3 ? 2 : 1;
        return { type: 'level', target: L, goal: n, effort: n * Math.min(6, 1 + 0.6 / share), title: 'Big Game', desc: n === 1 ? `Land a level ${L}+ catch` : `Land ${n} catches of level ${L} or higher` };
      }
    }
    return null;
  },
  size(R, rng) {
    const pick = rng.weighted([['large', 0.55], ['huge', 0.33], ['trophy', 0.12]], (o) => o[1])[0];
    if (pick === 'large') {
      const n = rng.int(2, 4);
      return { type: 'size', target: 'large', goal: n, effort: n / SIZE_SHARE.large, title: 'Size Matters', desc: `Land ${n} fish of Large size or bigger` };
    }
    if (pick === 'huge') {
      const n = rng.int(1, 2);
      return { type: 'size', target: 'huge', goal: n, effort: n / SIZE_SHARE.huge, title: 'Monster Hunt', desc: n === 1 ? 'Land a Huge or TROPHY-size fish' : `Land ${n} Huge or TROPHY-size fish` };
    }
    return { type: 'size', target: 'trophy', goal: 1, effort: 1 / SIZE_SHARE.trophy, title: 'Trophy Room', desc: 'Land a TROPHY-size fish' };
  },
  night(R, rng) {
    const n = rng.int(3, 5);
    return { type: 'night', target: null, goal: n, effort: n * 1.4 + 4, title: 'Night Shift', desc: `Catch ${n} fish at night` };
  },
  rain(R, rng) {
    const n = rng.int(2, 3);
    return { type: 'rain', target: null, goal: n, effort: n * 1.4 + 10, title: 'Singing in the Rain', desc: `Catch ${n} fish in the rain or a storm` };
  },
  perfect(R, rng) {
    const n = rng.int(3, 5);
    return { type: 'perfect', target: null, goal: n, effort: n * 2.5, title: 'Quick Draw', desc: `Land ${n} fish with a perfect hook-set` };
  },
  weight(R, rng) {
    if (!R.pool.length) return null;
    const kg = niceNumber(Math.max(1, R.kgPerCatch * rng.int(6, 10)));
    return { type: 'weight', target: null, goal: kg, effort: kg / Math.max(0.01, R.kgPerCatch), title: 'Heavy Haul', desc: `Land ${fmtKg(kg)} kg of catch in total` };
  },
  streak(R, rng) {
    const n = rng.int(4, 7);
    return { type: 'streak', target: null, goal: n, effort: n * 1.5, title: 'Hot Streak', desc: `Land ${n} fish in a row without losing one` };
  },
  shiny() {
    return { type: 'shiny', target: null, goal: 1, effort: 40, title: 'All That Glitters', desc: 'Catch a shiny golden variant' };
  },
  junk(R, rng) {
    if (!R.junk) return null;
    const n = rng.int(2, 3);
    return { type: 'junk', target: null, goal: n, effort: n * 5, title: 'Clean-up Duty', desc: `Haul ${n} pieces of junk off the sea floor` };
  },
  points(R, rng) {
    const pts = niceNumber(R.pointsPerCatch * rng.int(8, 12));
    return { type: 'points', target: null, goal: pts, effort: pts / Math.max(1, R.pointsPerCatch), title: 'Point Hunter', desc: `Score ${pts.toLocaleString('en-US')} points` };
  },
  newSpecies(R, rng, p) {
    const fresh = R.pool.filter((e) => !(p.dex && p.dex[e.s.id] && p.dex[e.s.id].count > 0));
    if (fresh.length < 2) return null;
    const n = Math.min(3, Math.max(1, Math.floor(fresh.length / 3)), rng.int(1, 3));
    return { type: 'newSpecies', target: null, goal: n, effort: n * 4, title: 'Explorer', desc: n === 1 ? 'Discover a new species' : `Discover ${n} new species` };
  },
  depth(R, rng) {
    if (R.maxDepthM < 70) return null;
    const D = Math.max(30, Math.round((R.maxDepthM * rng.range(0.55, 0.8)) / 10) * 10);
    const deep = R.pool.filter((e) => habitatReachable(e.s, R.maxDepthM, null, [D, 9999]));
    if (deep.length < 2) return null;
    const n = rng.int(1, 3);
    return { type: 'depth', target: D, goal: n, effort: n * 2, title: 'Deep Dive', desc: n === 1 ? `Land a fish from below ${D} m` : `Land ${n} fish from below ${D} m` };
  },
  release(R, rng) {
    const prot = R.pool.filter((e) => e.s.protected);
    const total = sumW(R.pool);
    if (!prot.length || !total) return null;
    const share = sumW(prot) / total;
    const n = share > 0.1 ? 2 : 1;
    return { type: 'release', target: null, goal: n, effort: n * Math.min(6, 1 + 0.6 / share), title: 'Gentle Hands', desc: n === 1 ? 'Catch and release a protected animal' : `Catch and release ${n} protected animals` };
  },
};

/** Reward for a quest of a given effort (in catches) at this reach. */
export function questReward(effort, R) {
  const e = Math.max(1.5, Math.min(40, effort));
  return { coins: round5(10 + e * R.coinsPerCatch * QUEST_PAY), xp: round5(10 + e * R.xpPerCatch * QUEST_PAY) };
}

/**
 * Roll a fresh quest that fits what the player can reach, avoiding the types already active.
 * @param {object} player   game.player
 * @param {object} rng      createRng() instance
 * @param {object[]} existing  the other active quests
 * @param {number} seq      unique sequence number → id 'q<seq>'
 */
export function generateQuest(player, rng, existing = [], seq = 1) {
  const R = computeReach(player);
  const usedTypes = new Set(existing.map((q) => q.type));
  const usedKeys = new Set(existing.map((q) => q.type + ':' + q.target));
  const level = player.level || 1;
  let cands = QUEST_TEMPLATES.filter((t) => level >= t.minLevel && !usedTypes.has(t.type) && MAKERS[t.type]);
  let made = null;
  for (let i = 0; i < 40 && cands.length && !made; i++) {
    const tpl = rng.weighted(cands, (t) => t.weight);
    const q = tpl && MAKERS[tpl.type](R, rng, player);
    if (q && !usedKeys.has(q.type + ':' + q.target)) made = q;
    else cands = cands.filter((t) => t !== tpl);
  }
  if (!made) {
    const n = 5;
    made = { type: 'points', target: null, goal: niceNumber(R.pointsPerCatch * n), effort: n, title: 'Point Hunter', desc: '' };
    made.desc = `Score ${made.goal.toLocaleString('en-US')} points`;
  }
  return {
    id: 'q' + seq,
    type: made.type,
    target: made.target === undefined ? null : made.target,
    title: made.title,
    desc: made.desc,
    progress: 0,
    goal: made.goal,
    reward: questReward(made.effort, R),
    done: false,
    claimed: false,
    effort: Math.round(made.effort * 10) / 10,
  };
}

/**
 * Advance a quest with a scored catch. Mutates `q`. Returns true when its progress changed.
 * @param {object} q
 * @param {object} rec   catch record (progression.js)
 * @param {{biome:string, zone:string, phase:string, weather:string}} ctx
 */
export function questOnCatch(q, rec, ctx) {
  if (!q || q.done) return false;
  const animal = !rec.isItem;
  let inc = 0;
  switch (q.type) {
    case 'species': inc = rec.speciesId === q.target ? 1 : 0; break;
    case 'biome': inc = animal && ctx.biome === q.target ? 1 : 0; break;
    case 'zone': inc = animal && ctx.zone === q.target ? 1 : 0; break;
    case 'level': inc = animal && rec.level >= q.target ? 1 : 0; break;
    case 'size': inc = animal && SIZE_RANK[rec.sizeClass.id] >= SIZE_RANK[q.target] ? 1 : 0; break;
    case 'night': inc = animal && ctx.phase === 'night' ? 1 : 0; break;
    case 'rain': inc = animal && (ctx.weather === 'rain' || ctx.weather === 'storm') ? 1 : 0; break;
    case 'perfect': inc = animal && rec.hookQuality === 'perfect' ? 1 : 0; break;
    case 'weight': inc = animal ? rec.weightKg : 0; break;
    case 'shiny': inc = rec.shiny ? 1 : 0; break;
    case 'junk': inc = rec.itemKind === 'junk' ? 1 : 0; break;
    case 'points': inc = rec.points; break;
    case 'newSpecies': inc = animal && rec.isNew ? 1 : 0; break;
    case 'depth': inc = animal && rec.depthM >= q.target ? 1 : 0; break;
    case 'release': inc = rec.released ? 1 : 0; break;
    case 'streak': {
      const v = Math.min(q.goal, animal ? rec.streak || 0 : 0);
      if (v <= q.progress) return false;
      q.progress = v;
      if (q.progress >= q.goal) q.done = true;
      return true;
    }
    default: return false;
  }
  if (!(inc > 0)) return false;
  q.progress = Math.min(q.goal, Math.round((q.progress + inc) * 10) / 10);
  if (q.progress >= q.goal) q.done = true;
  return true;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** Is a (loaded) quest object well-formed and does its target still exist? */
export function validQuest(q) {
  if (!q || typeof q !== 'object' || !TYPES.has(q.type)) return false;
  if (typeof q.id !== 'string' || typeof q.title !== 'string' || typeof q.desc !== 'string') return false;
  if (!finite(q.goal) || q.goal <= 0 || !finite(q.progress) || q.progress < 0) return false;
  if (!q.reward || !finite(q.reward.coins) || !finite(q.reward.xp) || q.reward.coins < 0 || q.reward.xp < 0) return false;
  switch (q.type) {
    case 'species': return !!SPECIES_BY_ID[q.target];
    case 'biome': return BIOME_IDS.has(q.target);
    case 'zone': return ZONE_IDS.has(q.target);
    case 'size': return SIZE_RANK[q.target] !== undefined;
    case 'level':
    case 'depth': return finite(q.target);
    default: return true;
  }
}
