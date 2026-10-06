// LIFE — the lure drama of one animal (mode 'lure'):
//   0 notice   (state 'curious')  turns toward the lure; seekers from afar travel in at cruise ('swim')
//   1 approach (state 'approach') closes to its inspection distance — aggressive fish charge, passive ones drift
//   2 hesitate (state 'curious')  holds / circles (skittish) / edges in and out; may lose interest; rivals wait here
//   3 nibble   (state 'nibble')   needs the lock (one biter at a time): darts in, pecks (emits 'nibble'), backs off
//   4 commit   (state 'nibble')   darts in mouth-first → game.fishing.fishBite(fish)
//   5 look     (state 'curious')  can't take this lure: inspects it, then turns away (feedback for the player)
import { clamp, damp } from '../../core/math.js';
import { mouthOf } from '../../render/bestiary.js';
import { heightAt } from '../../world/terrain.js';
import { setMode, baseMode, startle } from './motion.js';

const T = {
  aggressive: { app: 1.9, ins: [0, 0], hes: [0, 0.3], nib: [0, 1], nibP: 0.25 },
  bold: { app: 1.1, ins: [0.35, 12], hes: [0.3, 1.0], nib: [0, 1], nibP: 0.6 },
  curious: { app: 0.75, ins: [0.7, 18], hes: [0.6, 1.8], nib: [1, 2], nibP: 1 },
  skittish: { app: 0.9, ins: [1.2, 28], hes: [1.0, 2.6], nib: [1, 3], nibP: 1 },
  passive: { app: 0.55, ins: [0.25, 8], hes: [0.6, 1.6], nib: [1, 2], nibP: 1 },
};

/** Start the drama for fish f with interest I (lookOnly: it can't take this lure, it only inspects). */
export function beginInterest(S, brain, f, a, P, I, lookOnly) {
  const rng = S.rng, L = S.L;
  const tm = T[P.sp.temperament] || T.curious;
  setMode(a, 'lure');
  a.ls = lookOnly ? 5 : 0;
  a.lT = 0;
  a.lTotal = 0;
  a.lI = I;
  a.look = lookOnly;
  a.side = f.x >= L.x ? 1 : -1;
  a.yo = (rng.next() - 0.5) * 0.3 * f.visualLen;
  a.nib = 0;
  const nb = tm.nib;
  a.nibMax = rng.next() < tm.nibP ? rng.int(nb[0], nb[1]) : 0;
  if (I > 1.2 && a.nibMax > 0) a.nibMax--;
  a.np = 0;
  a.npT = 0;
  a.hes = hesitation(rng, tm, I);
  a.notice = 0.35 + rng.next() * 0.8;
  a.orbit = rng.sign();
  a.kick = 0;
  a.lost = 0;
  a.npT2 = 0;
  a.reach = true;
  if (!P.mouth) P.mouth = mouthOf(P.id);
}

function hesitation(rng, tm, I) {
  return (tm.hes[0] + rng.next() * (tm.hes[1] - tm.hes[0])) * (1.3 - 0.5 * Math.min(1, I));
}

/** End the drama: swim off from the lure side and stay uninterested for `cool` seconds. */
export function endInterest(S, brain, f, a, cool) {
  if (brain.owner === f) brain.owner = null;
  a.lureCool = Math.max(a.lureCool, cool);
  a.hx = a.side;
  a.lockT = 2;
  a.ls = 0;
  setMode(a, baseMode(a));
}

/** Per-step steering in mode 'lure'. Returns an acceleration multiplier. */
export function lureStep(S, brain, f, a, P, dt) {
  const L = S.L, rng = S.rng, len = f.visualLen;
  const tm = T[P.sp.temperament] || T.curious;
  brain.counted++;
  a.lT += dt;
  a.lTotal += dt;
  if (a.kick > 0) a.kick -= dt;
  // ── give up? ──
  if (!L.active) {
    // another fish took it: the commotion of the strike spooks the rivals hanging around
    const st = S.game.fishing && S.game.fishing.state;
    if ((st === 'bite' || st === 'fight') && Math.hypot(L.x - f.x, L.y - f.y) < 260 && rng.next() < (P.sp.temperament === 'aggressive' ? 0.2 : 0.7)) {
      endInterest(S, brain, f, a, 8 + rng.next() * 6);
      startle(S, f, L.x, L.y, 0.7);
      return 1;
    }
    return end(S, brain, f, a, 1.5 + rng.next() * 2);
  }
  const dx = L.x - f.x, dy = L.y - f.y, d = Math.hypot(dx, dy);
  // only a SUSTAINED fast lure (reeled in) is given up on — a jig twitch's dart must not scare them off
  const fast = L.slow > Math.max(150, a.cruise * 2.4);
  if (a.lTotal > 30 || (fast && P.sp.temperament !== 'aggressive') || (d > 1700 && !a.seeker) || d > 2600) {
    return end(S, brain, f, a, 6 + rng.next() * 6);
  }
  // the lure must stay inside this animal's habitat (biome / depth / near the bottom for bottom-dwellers)
  a.npT2 = (a.npT2 || 0) - dt;
  if (a.npT2 <= 0) {
    a.npT2 = 0.25;
    a.reach = brain.reachable(f, a, P);
  }
  if (!a.reach && a.ls < 5) {
    a.lost += dt;
    if (a.lost > (a.ls === 0 ? 0.6 : 1.2)) return end(S, brain, f, a, 8);
    if (a.ls === 3 || a.ls === 4) a.ls = 2;
  } else a.lost = 0;
  // the lure swept past: swap sides (the fish turns around)
  if ((f.x - L.x) * a.side < -0.3 * len && a.ls !== 3 && a.ls !== 4) a.side = -a.side;
  const m = P.mouth || { x: 0.46, y: 0.02 };
  // squids swim mantle-first and take the bait with their trailing arms: they travel in mantle-first,
  // then turn the arms toward the lure for the approach and the lunge
  const armsFirst = m.x < 0;
  a.face = armsFirst && a.ls >= 1 ? a.side : -a.side;
  const mx = Math.abs(m.x) * len, my = m.y * len;
  const rivalWaits = brain.owner && brain.owner !== f;
  let ins = tm.ins[0] * len + tm.ins[1];
  if (rivalWaits) ins = Math.max(ins, 1.8 * len + 40);
  let spd = a.cruise * tm.app * (a.kick > 0 ? 1.5 : 1);
  let accK = 1.6;
  let gap = ins;
  switch (a.ls) {
    case 0: // notice / travel in
      a.st = d > 380 ? 'swim' : 'curious';
      gap = Math.max(ins, d > 380 ? 0 : 0.6 * len + 30);
      spd = d > 380 ? a.cruise * 1.45 : a.cruise * 0.35;
      if (a.lT > a.notice && d < 380) next(a, 1);
      break;
    case 1: // approach
      a.st = 'approach';
      if (P.sp.temperament === 'aggressive') accK = 2.6;
      if (arrived(f, L, a, mx, my, ins, len)) {
        if (P.sp.temperament === 'aggressive' && !rivalWaits) {
          brain.owner = f;
          next(a, a.nibMax > 0 ? 3 : 4);
        } else next(a, 2);
      }
      break;
    case 2: // hesitate
      a.st = 'curious';
      spd = a.cruise * 0.45;
      gap = ins * (1 + 0.22 * Math.sin(a.lTotal * 1.7 + a.ns));
      a.hes -= dt;
      if (a.hes <= 0) {
        if (rivalWaits) {
          a.hes = 0.6;
          if (a.lTotal > 20) return end(S, brain, f, a, 8);
        } else if (rng.next() < clamp(0.1 + 0.85 * a.lI, 0.08, 0.95)) {
          brain.owner = f;
          next(a, a.nib < a.nibMax ? 3 : 4);
        } else if (rng.next() < 0.45 * (1 - Math.min(1, a.lI)) + (a.lTotal > 18 ? 0.5 : 0)) {
          return end(S, brain, f, a, 6 + rng.next() * 6);
        } else a.hes = hesitation(rng, tm, a.lI) * 0.6;
      }
      break;
    case 3: // nibble: in, peck, back off, pause
      a.st = 'nibble';
      accK = 3;
      if (a.np === 0) {
        gap = 0;
        spd = Math.max(a.cruise * 1.2, spd * 1.3);
        a.mouthT = clamp(1 - (d - mx) / (len * 0.8 + 30), 0.2, 1);
        if (arrived(f, L, a, mx, my, 0, len)) {
          a.nib++;
          S.stats.nibbles++;
          S.emit('nibble', { fish: f, x: L.x, y: L.y });
          a.np = 1;
          a.npT = 0.3 + rng.next() * 0.15;
        }
      } else {
        a.npT -= dt;
        gap = 0.3 * len + 10;
        spd = a.cruise * 0.6;
        a.mouthT = 0.1;
        if (a.npT <= 0) {
          if (a.np === 1) {
            a.np = 2;
            a.npT = 0.2 + rng.next() * 0.35;
          } else {
            a.np = 0;
            if (a.nib >= a.nibMax) next(a, 4);
            else if (P.sp.temperament === 'skittish' && rng.next() < 0.12) return end(S, brain, f, a, 5);
          }
        }
      }
      break;
    case 4: // commit
      a.st = 'nibble';
      accK = 3.2;
      gap = 0;
      spd = Math.max(a.cruise * 1.5, spd * 1.5);
      a.mouthT = 1;
      if (arrived(f, L, a, mx, my, 0, len)) {
        if (brain.callBite(f)) return 1;
        S.stats.refused++;
        a.wary = 6 + rng.next() * 5;
        return end(S, brain, f, a, a.wary);
      }
      if (a.lT > 4) return end(S, brain, f, a, 5);
      break;
    case 5: // look only
      a.st = 'curious';
      gap = 1.6 * len + 30;
      spd = a.cruise * 0.6;
      if (a.lT > 7 || (a.lT > 1.2 && arrived(f, L, a, mx, my, gap, len * 2) && a.lT > 1.5 + (a.ns % 1.5))) {
        S.stats.looks++;
        return end(S, brain, f, a, 20 + rng.next() * 20);
      }
      break;
  }
  steerTo(S, f, a, P, L, mx, my, gap, spd, dt);
  return accK;
}

function next(a, s) {
  a.ls = s;
  a.lT = 0;
  a.np = 0;
}

function end(S, brain, f, a, cool) {
  endInterest(S, brain, f, a, cool);
  a.dvx = a.hx * a.cruise;
  a.dvy = 0;
  a.st = 'swim';
  return 1;
}

/** Is the body centre at the spot that puts the mouth `gap` px from the lure? */
function arrived(f, L, a, mx, my, gap, len) {
  const tx = L.x + a.side * (mx + gap);
  let ty = L.y - my + (gap > 0 ? a.yo : 0);
  // a lure lying on the bottom: the body can only get as low as the seabed allows (same clamp as steerTo)
  const floor = heightAt(tx) - a.prof.down * f.visualLen - 2;
  if (ty > floor) ty = floor;
  const tol = gap > 0 ? 8 + 0.08 * len + gap * 0.25 : 4 + 0.04 * len;
  return Math.abs(tx - f.x) < tol && Math.abs(ty - f.y) < tol + (a.prof.arch === 'crawl' ? 40 : 0);
}

/** Steer toward the mouth-at-gap point (with orbiting for skittish fish while they hesitate). */
function steerTo(S, f, a, P, L, mx, my, gap, spd, dt) {
  const armsFirst = (P.mouth || { x: 1 }).x < 0;
  let tx = L.x + a.side * (mx + gap), ty = L.y - my + (gap > 0 ? a.yo : 0);
  if (a.ls === 2 && P.sp.temperament === 'skittish') {
    const ang = a.lTotal * 0.9 * a.orbit;
    tx = L.x + a.side * (mx + gap * (0.8 + 0.4 * Math.cos(ang)));
    ty += Math.sin(ang) * (gap * 0.5 + 10);
  }
  // a moving lure is chased: interested fish match its speed (up to their burst)
  if (a.ls >= 1 && a.ls <= 4 && L.slow > 20) spd = Math.max(spd, Math.min(L.slow * 1.25, a.cruise * P.burst * 0.85));
  if (P.arch === 'crawl') {
    a.dvx = clamp((tx - f.x) * 2.2, -spd, spd);
    if (Math.abs(tx - f.x) < 3) a.dvx = 0;
    return;
  }
  // bottom-dwellers don't dig into the seabed to reach a lure lying on it
  const floor = heightAt(tx) - P.down * f.visualLen - 2;
  if (ty > floor) ty = floor;
  const ex = tx - f.x, ey = ty - f.y;
  const e = Math.hypot(ex, ey);
  const k = e > 1e-3 ? Math.min(spd, e * 2.4) / e : 0;
  // feed-forward the lure's own motion so a fish can actually keep station on a moving bait
  const ff = a.ls >= 1 ? 1 : 0.5;
  a.dvx = ex * k + L.vx * ff;
  a.dvy = ey * k + L.vy * ff;
  // fish that hold station don't sit dead still: a gentle fin-hover sway
  if (gap > 0 && e < 20) a.dvy += Math.sin(a.lTotal * 2.1 + a.ns) * 4;
  // eyes on the bait: the nose points at the lure (level once the mouth is at its height)
  if (a.ls !== 0 || Math.hypot(L.x - f.x, L.y - f.y) < 380) {
    a.pov = true;
    a.povT = armsFirst ? 0 : clamp(Math.atan2(L.y - (f.y + my), Math.abs(L.x - f.x) + 0.5 * f.visualLen), -0.42, 0.42);
  }
  f.mouth = damp(f.mouth, a.mouthT, 10, dt);
}
