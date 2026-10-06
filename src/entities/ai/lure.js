// LIFE — lure interest: who notices the lure, how keen they are, items snagging, and the bite-pacing director.
// The per-fish drama (approach → hesitate → nibble → bite) lives in lure-drama.js.
//
// Detection radius = √(vis² + glow² + flash² + twitch² + scent²) + half a body, scaled by temperament:
//   vis    the lure seen in ambient light (env.lightAt)          glow   self-light, matters in the dark
//   flash  glint of a moving / just-twitched flashy lure in light  twitch vibration of a fresh jig (any light)
//   scent  live / dead baits (chum leaves a blood slick)
// Interest = affinity × activity × weather × size bias × temperament × twitch × (wise old fish discount).
import { lureAffinity } from '../../data/lures.js';
import { clamp } from '../../core/math.js';
import { heightAt } from '../../world/terrain.js';
import { zoneFor, biomeOK } from './habitat.js';
import { startle } from './motion.js';
import { lureStep, beginInterest } from './lure-drama.js';

const SCENT = { worm: 110, shrimp: 140, minnow: 170, krill: 130, chum: 470 };
const RADIUS_K = { aggressive: 1.25, bold: 1.05, curious: 1, skittish: 0.9, passive: 0.45 };
const LOOK_P = { curious: 0.5, bold: 0.18, skittish: 0.1, aggressive: 0.12, passive: 0.05 };
const RECRUIT = { shore: 5, reef: 3.2, kelp: 3.8, slope: 5, open: 6, trench: 6.5 };
const tmpZ = { top: 0, bot: 0 };

export function createLureBrain(S) {
  const L = S.L, rng = S.rng;
  const brain = {
    owner: null,
    interested: 0,
    counted: 0,
    idleT: 0,
    nextRecruit: 3,
    rareCool: 0,
    callBite,
    affinity,
    interest,
    reachable,
  };

  function affinity(P) {
    const id = L.id;
    let v = P.affCache[id];
    if (v === undefined) v = P.affCache[id] = lureAffinity(L.def, P.sp);
    return v;
  }

  function radius(f, P) {
    const sp = P.sp;
    const glow = L.rGlow * (sp.diet.glow ? 1.35 : 1);
    const scent = L.rScent * (sp.group === 'shark' && L.id === 'chum' ? 1.8 : 1);
    const r = Math.sqrt(L.rVis * L.rVis + glow * glow + L.rFlash * L.rFlash + L.rTwitch * L.rTwitch + scent * scent);
    return (r + f.visualLen * 0.5) * (RADIUS_K[sp.temperament] || 1);
  }

  function interest(f, a, P, aff) {
    const sp = P.sp, W = S.W;
    let I = aff * (sp.active[W.phase] || 0);
    if (W.rain > 0.08 && !W.storm) I *= 1 + 0.35 * Math.min(1, W.rain / 0.4);
    if (W.storm && (sp.layer === 'surface' || f.y < 160)) I *= 0.25;
    I *= clamp(1 + (L.def.bigBias || 0) * 3 * (f.sizeQ - 0.35), 0.35, 1.8);
    const t = sp.temperament;
    if (t === 'aggressive') I *= L.moving ? 1.6 : 1.15;
    else if (t === 'bold') I *= 1.15;
    else if (t === 'skittish') I *= L.slow > 140 ? 0.3 : 0.8;
    else if (t === 'passive') I *= L.slow > 35 ? 0.5 : 0.9;
    I *= 1 + 1.5 * Math.exp(-L.twitchT / 1.0);
    // big, wise old fish are harder to fool
    return I / (1 + 0.15 * Math.max(0, sp.level - 2));
  }

  /** Can this animal get to the lure where it is (depth inside its habitat, bottom-dwellers: lure near the bottom)? */
  function reachLen(P, len) {
    if (!biomeOK(P, L.x, 200)) return false;
    const sb = heightAt(L.x);
    if (!zoneFor(P, len, sb, S.W.nightF, tmpZ)) return false;
    const bottom = P.arch === 'crawl' || P.sp.layer === 'benthic';
    const tol = bottom ? 60 : 70 + 0.15 * (tmpZ.bot - tmpZ.top);
    return L.y > tmpZ.top - tol && L.y < tmpZ.bot + tol + (bottom ? P.down * len : 0);
  }
  function reachable(f, a, P) {
    return reachLen(P, f.visualLen);
  }
  /** Rare animals take longer to show up: a level-scaled chance to sit this recruiting round out. */
  function rareGate(level) {
    return level < 6 || rng.next() < 1 / (1 + 0.4 * (level - 5));
  }
  /** Seekers: must be able to reach the lure, actually want it, and pass the rarity gate. */
  function onlyReach(P) {
    if (P.level >= 8 && brain.rareCool > 0) return false; // legendaries don't queue up behind each other
    return affinity(P) >= 0.3 && reachLen(P, P.refLen) && rareGate(P.level);
  }

  function callBite(f) {
    const fl = S.game.fishing;
    if (!fl || typeof fl.fishBite !== 'function' || fl.hooked || fl.state === 'bite' || fl.state === 'fight') return false;
    let ok = false;
    try {
      ok = !!fl.fishBite(f);
    } catch (e) {
      S.game.reportError('fish:fishBite', e);
    }
    if (ok) {
      if (!f.controlled) f.controlled = true;
      S.stats.bites++;
      if (brain.owner === f) brain.owner = null;
    }
    return ok;
  }

  /** Per-fish notice check (throttled ~4×/s). Called for free animals while the lure is attractive. */
  brain.consider = (f, a, dt) => {
    a.checkT -= dt;
    if (a.checkT > 0) return;
    a.checkT = 0.22 + rng.next() * 0.1;
    const m = a.mode;
    if ((m !== 'cruise' && m !== 'rest' && m !== 'school') || a.wary > 0 || a.lureCool > 0 || a.leaving) return;
    const P = a.prof;
    if (P.arch === 'item' || P.arch === 'jelly') return;
    const dx = L.x - f.x, dy = L.y - f.y, R = radius(f, P);
    const d2 = dx * dx + dy * dy;
    if (d2 > R * R || !reachable(f, a, P)) return;
    const d = Math.sqrt(d2);
    const aff = affinity(P);
    if (aff <= 0) {
      // can't take it — but it may come and have a look (the player learns something)
      if (a.lookCool > 0) return;
      a.lookCool = 8 + rng.next() * 10;
      if (rng.next() < (LOOK_P[P.sp.temperament] || 0.1) * (1 - d / R)) beginInterest(S, brain, f, a, P, 0, true);
      return;
    }
    const I = interest(f, a, P, aff);
    // a lure that only half-matches the diet gets noticed much less (I^1.25): the right bait matters
    const rate = 1.6 * Math.pow(I, 1.25) * Math.pow(1 - d / R, 0.6);
    if (rng.next() < 1 - Math.exp(-rate * 0.25)) beginInterest(S, brain, f, a, P, I, false);
  };

  function snags(dt) {
    for (const f of S.list) {
      if (f.species.group !== 'item' || f.controlled) continue;
      const a = f.ai;
      if (!a || a.tag !== S.tag) continue;
      if (a.snagT > 0) {
        a.snagT -= dt;
        continue;
      }
      const dx = L.x - f.x, dy = L.y - f.y, r = 45 + f.visualLen * 0.15;
      if (dx * dx + dy * dy < r * r) {
        a.snagT = 1.5;
        if (callBite(f)) S.stats.snags++;
      }
    }
  }

  function recruitDelay() {
    const bio = S.game.world.terrain.biomeAt(L.x);
    let d = (RECRUIT[bio] || 5) * (1 + L.y / 3200);
    if (L.def.glow > 0.3 && L.light < 0.3) d *= 0.75;
    if (L.rScent > 300) d *= 0.6;
    if (L.twitchT < 2) d *= 0.7;
    return d * (0.7 + 0.6 * rng.next());
  }

  /** Nobody interested for a while: send an existing suitable fish, or bring a newcomer in from out of view. */
  function director(dt) {
    if (brain.interested > 0) {
      brain.idleT = 0;
      return;
    }
    brain.idleT += dt;
    if (brain.idleT < brain.nextRecruit) return;
    brain.idleT = 0;
    brain.nextRecruit = recruitDelay();
    let best = null, bestS = 0;
    for (const f of S.list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.dead || a.leaving || a.wary > 0 || a.lureCool > 0) continue;
      if (a.mode !== 'cruise' && a.mode !== 'rest' && a.mode !== 'school') continue;
      const P = a.prof;
      if (P.arch === 'item' || P.arch === 'jelly') continue;
      const aff = affinity(P);
      if (aff <= 0) continue;
      const d = Math.hypot(L.x - f.x, L.y - f.y);
      // only fish that can actually get here soon (a slow reef fish 1 km away would take half a minute)
      if (d > Math.min(1300, a.cruise * 1.45 * 9 + 150) || !reachable(f, a, P)) continue;
      const sc = interest(f, a, P, aff) / (1 + d / 500);
      if (sc > bestS) {
        bestS = sc;
        best = f;
      }
    }
    if (best && bestS > 0.12) {
      if (!rareGate(best.species.level)) return;
      const a = best.ai;
      beginInterest(S, brain, best, a, a.prof, interest(best, a, a.prof, affinity(a.prof)), false);
      a.seeker = true;
      S.stats.recruits++;
      brain.nextRecruit *= 1 + 0.2 * Math.max(0, best.species.level - 2);
      return;
    }
    if (S.list.length >= S.cap) return;
    const f = S.pop.spawnNear(L.x, L.y, { lure: L.def, seeker: true, sizeBias: L.def.bigBias || 0, room: 3, only: onlyReach });
    if (!f) return;
    const a = f.ai;
    S.stats.seekers++;
    beginInterest(S, brain, f, a, a.prof, interest(f, a, a.prof, affinity(a.prof)), false);
    a.seeker = true;
    brain.nextRecruit *= 1 + 0.2 * Math.max(0, f.species.level - 2);
    if (f.species.level >= 8) brain.rareCool = 180;
  }

  brain.pre = (dt) => {
    if (brain.rareCool > 0) brain.rareCool -= dt;
    brain.interested = brain.counted;
    brain.counted = 0;
    const o = brain.owner;
    if (o && (o.controlled || !o.ai || o.ai.dead || o.ai.mode !== 'lure')) brain.owner = null;
    if (!L.active) {
      brain.idleT = 0;
      return;
    }
    const lt = L.light, def = L.def;
    L.moving = L.speed > 35;
    L.rVis = 80 + 240 * Math.sqrt(lt);
    L.rGlow = def.glow * 560 * (1 - lt);
    L.rFlash = def.flash * 320 * lt * Math.min(1, L.speed / 70 + (L.twitchT < 1 ? 0.7 : 0));
    L.rTwitch = 300 * Math.exp(-L.twitchT / 1.3);
    L.rScent = SCENT[L.id] || 0;
    snags(dt);
    director(dt);
  };

  brain.step = (S2, f, a, P, dt) => lureStep(S, brain, f, a, P, dt);

  brain.forget = (f) => {
    if (brain.owner === f) brain.owner = null;
  };

  brain.reset = () => {
    brain.owner = null;
    brain.idleT = 0;
    brain.nextRecruit = 3;
  };

  /** The player jigged the lure: fish close by react right away; dithering fish make up their minds. */
  brain.onTwitch = () => {
    if (!L.active) return;
    for (const f of S.list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.dead) continue;
      const d = Math.hypot(L.x - f.x, L.y - f.y);
      if (a.mode === 'lure') {
        a.lI *= 1.2;
        if (a.ls === 2) a.hes *= 0.35;
        // a jig right in front of a nibbling fish triggers the reaction strike
        if (a.ls === 3 && brain.owner === f) a.nibMax = Math.min(a.nibMax, a.nib + (rng.next() < 0.65 ? 0 : 1));
        a.kick = 0.4;
        if (f.species.temperament === 'skittish' && d < f.visualLen * 0.5 + 12 && rng.next() < 0.08) startle(S, f, L.x, L.y, 0.8);
      } else if (d < 420) a.checkT = Math.min(a.checkT, 0.03 + rng.next() * 0.2);
    }
    brain.idleT += 1.5;
  };

  /** A lure splash rings the dinner bell for the aggressive hunters nearby. */
  brain.dinnerBell = (x, y) => {
    for (const f of S.list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || f.species.temperament !== 'aggressive') continue;
      if (Math.abs(f.x - x) < 520 && Math.abs(f.y - y) < 420) a.checkT = 0.4 + rng.next() * 0.8;
    }
  };

  return brain;
}
