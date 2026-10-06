// Fish Up — META: pure scoring maths + the level curve. No DOM, no game object: node can import it
// (dev/meta-test.mjs, dev/meta-sim.mjs).
//
// THE SCORING FORMULA (animals)
//   points = round( LEVEL_POINTS[level] × size × hook × trophy × streak × shiny )
//     size    sizeMultiplier(sizeQ) rounded to 2 dp           0.60 (tiny) … 2.00 (max size)
//     hook    ×1.10 on a 'perfect' hook-set
//     trophy  ×1.50 when the size class is TROPHY (sizeQ ≥ 0.93)
//     streak  ×(1 + 0.05·streak) from the 2nd consecutive catch, capped at ×1.50 (streak 10+)
//     shiny   ×5
//   Every factor is rounded to 2 dp BEFORE multiplying, so the catch card's breakdown reproduces the total.
//   coins  = round( points × species.valueMult × deep )          (× 0.75 "conservation grant" if protected → released)
//     deep    deep-sea premium 1 + (depthM − 50)/500 below 50 m (2 dp), capped ×2.50 — deep drops take longer and
//             need costly line; shown on the card whenever it applies
//   xp     = round( 3 + 1.6 · points^0.82 )  ×2 first catch of the species  ×1.5 released
// ITEMS (level 0): flat species.item.points, coins rolled in species.item.coins, xp from points (+ clean-up / bottle bonus).
import { LEVEL_POINTS, sizeMultiplier, sizeClassOf, rarityOf } from '../core/config.js';

export const SCORE = {
  perfectHook: 1.1,
  trophy: 1.5,
  streakStep: 0.05,
  streakMax: 1.5,
  shiny: 5,
  firstCatchXp: 2,
  releaseCoins: 0.75,
  releaseXp: 1.5,
  coinRate: 1,
  junkXpBonus: 10,
  bottleXpBonus: 25,
  deepFromM: 50,
  deepPerM: 1 / 500,
  deepMax: 2.5,
};

/** Deep-sea premium on coins for a catch hooked at depthM: ×1 down to 50 m, ×1.27 at 187 m, ×1.8 at 450 m … ×2.5. */
export function deepPremium(depthM) {
  const d = Math.max(0, (Number(depthM) || 0) - SCORE.deepFromM);
  return r2(Math.min(SCORE.deepMax, 1 + d * SCORE.deepPerM));
}

const r2 = (v) => Math.round(v * 100) / 100;
const fmtMul = (m) => '×' + (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** Streak multiplier: none for a lone catch, ×1.10 for 2 in a row, ×1.15 for 3 … ×1.50 cap. */
export function streakMultiplier(streak) {
  const n = Math.floor(Number(streak) || 0);
  if (n < 2) return 1;
  return r2(Math.min(SCORE.streakMax, 1 + SCORE.streakStep * n));
}

/** XP for a catch worth `points` (sub-linear so a lucky monster doesn't skip ten levels). */
export function xpForPoints(points) {
  return Math.round(3 + 1.6 * Math.pow(Math.max(0, points), 0.82));
}

/**
 * Pure catch scoring.
 * @param {object} c
 * @param {object} c.species       species object (src/data/species.js)
 * @param {number} c.sizeQ         0..1
 * @param {boolean} [c.shiny]
 * @param {string} [c.hookQuality] 'perfect' | 'good' | 'late'
 * @param {number} [c.streak]      consecutive catches INCLUDING this one
 * @param {boolean} [c.isNew]      first catch of this species (doubles XP)
 * @param {number} [c.depthM]      depth it was hooked at (deep-sea premium on coins)
 * @param {number} [c.roll]        0..1 random number for item coin rolls
 * @returns {{points:number, coins:number, xp:number, released:boolean, breakdown:{label:string,value:string}[], sizeClass:{id:string,name:string}}}
 */
export function scoreCatch(c) {
  const sp = c.species;
  const sizeQ = Math.max(0, Math.min(1, Number(c.sizeQ) || 0));
  const sc = sizeClassOf(sizeQ);
  const sizeClass = { id: sc.id, name: sc.name };
  const breakdown = [];

  if (sp.item) {
    const it = sp.item;
    const points = it.points;
    const roll = c.roll === undefined ? 0.5 : Math.max(0, Math.min(1, c.roll));
    const coins = Math.round(it.coins[0] + (it.coins[1] - it.coins[0]) * roll);
    let xp = xpForPoints(points);
    const label = it.kind === 'junk' ? 'Junk' : it.kind === 'bottle' ? 'Message in a bottle' : 'Treasure';
    breakdown.push({ label, value: String(points) });
    if (it.kind === 'junk') {
      xp += SCORE.junkXpBonus;
      breakdown.push({ label: 'Clean-up bonus', value: `+${SCORE.junkXpBonus} XP` });
    } else if (it.kind === 'bottle') {
      xp += SCORE.bottleXpBonus;
      breakdown.push({ label: 'Message bonus', value: `+${SCORE.bottleXpBonus} XP` });
    }
    if (c.isNew) {
      xp *= SCORE.firstCatchXp;
      breakdown.push({ label: 'First find!', value: `×${SCORE.firstCatchXp} XP` });
    }
    return { points, coins, xp: Math.round(xp), released: false, breakdown, sizeClass };
  }

  const level = Math.max(1, Math.min(10, sp.level | 0));
  const base = LEVEL_POINTS[level];
  const sizeM = r2(sizeMultiplier(sizeQ));
  let p = base * sizeM;
  breakdown.push({ label: `Lv ${level} base`, value: String(base) });
  breakdown.push({ label: sc.name === 'TROPHY' ? 'Trophy size' : sc.name, value: fmtMul(sizeM) });
  if (c.hookQuality === 'perfect') {
    p *= SCORE.perfectHook;
    breakdown.push({ label: 'Perfect hook', value: fmtMul(SCORE.perfectHook) });
  }
  if (sc.id === 'trophy') {
    p *= SCORE.trophy;
    breakdown.push({ label: 'TROPHY bonus', value: fmtMul(SCORE.trophy) });
  }
  const sm = streakMultiplier(c.streak);
  if (sm > 1) {
    p *= sm;
    breakdown.push({ label: `Streak ×${Math.floor(c.streak)}`, value: fmtMul(sm) });
  }
  if (c.shiny) {
    p *= SCORE.shiny;
    breakdown.push({ label: 'Shiny!', value: fmtMul(SCORE.shiny) });
  }
  const points = Math.max(1, Math.round(p));
  const released = !!sp.protected;
  const deep = deepPremium(c.depthM);
  let coins = points * (sp.valueMult || 1) * SCORE.coinRate * deep;
  let xp = xpForPoints(points);
  if (deep > 1) {
    breakdown.push({ label: `Deep-sea premium · ${Math.round(c.depthM)} m`, value: `${fmtMul(deep)} coins` });
  }
  if (released) {
    coins *= SCORE.releaseCoins;
    xp *= SCORE.releaseXp;
    breakdown.push({ label: 'Released · conservation grant', value: '+50% XP' });
  }
  if (c.isNew) {
    xp *= SCORE.firstCatchXp;
    breakdown.push({ label: 'First catch!', value: `×${SCORE.firstCatchXp} XP` });
  }
  return { points, coins: Math.round(coins), xp: Math.round(xp), released, breakdown, sizeClass };
}

/** Rarity summary for a record. */
export function rarityInfo(level) {
  const r = rarityOf(level);
  return { id: r.id, name: r.name, color: r.color };
}

// ── Level curve ──────────────────────────────────────────────────────────────────────────────────
export const MAX_LEVEL = 30;
export const LEVEL_TITLES = [
  '',
  'Deckhand', 'Bait Wrangler', 'Knot Tier', 'Dock Dabbler', 'Reef Rookie',
  'Hook Setter', 'Tide Reader', 'Kelp Prowler', 'Weekend Skipper', 'Seasoned Angler',
  'Bluewater Rookie', 'Lure Whisperer', 'Drop-off Diver', 'Twilight Seeker', 'Master Angler',
  'Shark Wrangler', 'Marlin Chaser', 'Old Salt', 'Sea Wolf', 'Deep-Line Captain',
  'Midnight Fisher', 'Abyss Walker', 'Trench Pioneer', 'Kraken Hunter', 'Storm Rider',
  'Ocean Sage', 'Tamer of Titans', 'Keeper of the Tides', 'Neptune’s Rival', 'Legend of the Deep',
];

/** XP needed to go from level L to L+1: a·L^p + b, plus a quadratic tail past level `tailFrom` (30 is a long-tail goal). */
export const XP_CURVE = { a: 42, p: 1.4, b: 60, tail: 50, tailFrom: 19 };
function stepXp(level) {
  const over = Math.max(0, level - XP_CURVE.tailFrom);
  const v = XP_CURVE.a * Math.pow(level, XP_CURVE.p) + XP_CURVE.b + XP_CURVE.tail * over * over;
  const unit = v < 1000 ? 5 : v < 10000 ? 50 : 100;
  return Math.round(v / unit) * unit;
}
/** XP_TABLE[L] = total XP needed to reach level L (XP_TABLE[1] = 0). */
export const XP_TABLE = (() => {
  const t = [0, 0];
  for (let l = 1; l < MAX_LEVEL; l++) t.push(t[l] + stepXp(l));
  return t;
})();

export const xpAt = (level) => XP_TABLE[Math.max(1, Math.min(MAX_LEVEL, level | 0))];
export function levelForXp(xp) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= XP_TABLE[l + 1]) l++;
  return l;
}
export const titleOf = (level) => LEVEL_TITLES[Math.max(1, Math.min(MAX_LEVEL, level | 0))];

/** { level, title, xp, xpIntoLevel, xpForLevel, progress 0..1, maxLevel } */
export function levelInfo(xp) {
  xp = Math.max(0, Number(xp) || 0);
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) {
    return { level, title: titleOf(level), xp, xpIntoLevel: xp - XP_TABLE[MAX_LEVEL], xpForLevel: 0, progress: 1, maxLevel: MAX_LEVEL };
  }
  const into = xp - XP_TABLE[level];
  const need = XP_TABLE[level + 1] - XP_TABLE[level];
  return { level, title: titleOf(level), xp, xpIntoLevel: into, xpForLevel: need, progress: Math.max(0, Math.min(1, into / need)), maxLevel: MAX_LEVEL };
}
