// LIFE — locomotion: the per-frame movement of every animal (and the gentle bob of items).
//
// Every free animal runs one `mode` at a time and produces a DESIRED velocity (a.dvx, a.dvy); the body then
// accelerates toward it with a limited acceleration (momentum: no jitter, no instant turns), is kept inside the
// water (surface, seabed, shore) and finally oriented with orientFish so dir / pitch / swimPhase / swimAmp match.
//
//   modes: cruise · rest · flee · leave · school (formation member) · lure (see lure.js) · rush / stalk (hunt.js)
//          · launch / air (flying fish, anything thrown out of the water) · breathe (turtle) · bask (sunfish)
import { clamp, damp, TAU } from '../../core/math.js';
import { noise1 } from '../../core/rng.js';
import { WORLD } from '../../core/config.js';
import { orientFish } from '../fishbase.js';
import { heightAt, slopeAt } from '../../world/terrain.js';
import { waveHeight, waveSlope } from '../../world/waves.js';
import { zoneFor, biomeOK } from './habitat.js';
import { cruiseFor } from './profiles.js';

const tmpZ = { top: 0, bot: 0 };

/** Create the private AI record for a fish (stored at fish.ai). */
export function makeAI(S, f, prof) {
  const rng = S.rng;
  const cruise = cruiseFor(prof, f.visualLen) * (0.9 + 0.2 * rng.next());
  return {
    tag: S.tag,
    prof,
    mode: 'cruise',
    modeT: 0,
    st: 'swim',
    t: rng.next() * 200,
    ns: rng.next() * 997,
    cruise,
    accel: Math.max(16, cruise * prof.agility),
    hx: f.dir >= 0 ? 1 : -1,
    lockT: 0,
    turnT: rng.range(prof.turnEvery[0], prof.turnEvery[1]),
    decideT: rng.next() * 0.4,
    homeX: f.x,
    homeR: prof.homeR,
    // residence time (game s): then it moves on, so the sea keeps turning over (reef residents linger longest)
    stayT: prof.homeR > 0 && prof.homeR <= 700 ? rng.range(150, 400) : rng.range(60, 150),
    zf: 0.5,
    z: { top: 0, bot: 0 },
    zOK: true,
    ty: f.y,
    dvx: 0,
    dvy: 0,
    restT: 0,
    // groups / schools
    group: null,
    gi: 0,
    sx: 0,
    sy: 0,
    orbR: 30,
    orbA: rng.next() * TAU,
    // fear
    fx: 0,
    fy: 0,
    fleeT: 0,
    fleeDur: 1,
    // lure interest (lure.js)
    wary: 0,
    lureCool: 0,
    lookCool: 0,
    ls: 0,
    lT: 0,
    lI: 0,
    lTotal: 0,
    nib: 0,
    nibMax: 0,
    hes: 0,
    look: false,
    side: 1,
    orbit: 1,
    checkT: rng.next() * 0.3,
    snagT: 0,
    np: 0,
    npT: 0,
    yo: 0,
    notice: 0,
    kick: 0,
    lost: 0,
    npT2: 0,
    reach: true,
    boostT: 0,
    isLeader: false,
    dead: false,
    cell: undefined,
    inView: false,
    // hunting (hunt.js)
    huntCool: rng.range(14, 40),
    prey: null,
    rushT: 0,
    stage: 0,
    ate: false,
    // flags
    leaving: false,
    pinned: false,
    seeker: false,
    fadeIn: 0,
    face: 0,
    pov: false,
    povT: 0,
    topK: 1,
    mouthT: 0,
    // rhythm / specials
    pulse: rng.next() * TAU,
    burstT: 0,
    pauseT: rng.range(0.2, 2),
    lift: 0,
    glideT: 0,
    glideH: 30,
    retMode: 'cruise',
    launchDelay: 0,
    cycleT: rng.range(12, 40),
    flashT: rng.range(0.5, 3),
    gapeT: rng.range(5, 14),
    inkT: 0,
    ctrl: false,
  };
}

/** The mode a fish returns to when nothing special is going on. */
export function baseMode(a) {
  // formation members always follow their leader (a leaving leader takes the whole school away)
  if (a.group && a.group.lead && a.group.alive) return 'school';
  if (a.leaving) return 'leave';
  return 'cruise';
}

export function setMode(a, m) {
  if (a.mode !== m) {
    a.mode = m;
    a.modeT = 0;
  }
}

/** Activity of the species right now (species.active[phase]). */
export const activity = (P, W) => P.sp.active[W.phase] || 0;

/**
 * Startle a fish: burst away from (x, y). strength 0..1+ scales the duration.
 * Interest in the lure is dropped (lure.js releases its lock when it sees the mode change).
 */
export function startle(S, f, x, y, strength = 1) {
  const a = f.ai, P = a.prof;
  if (!a || f.controlled || P.arch === 'item' || P.arch === 'jelly' || a.mode === 'air' || a.mode === 'launch') return;
  a.fx = x;
  a.fy = y;
  a.fleeDur = a.fleeT = (P.arch === 'crawl' ? 0.7 : 1.1) * (0.7 + 0.6 * S.rng.next()) * Math.min(2, 0.6 + strength);
  if (a.mode === 'lure') a.lureCool = Math.max(a.lureCool, 4 + 4 * S.rng.next());
  setMode(a, 'flee');
  // cephalopods ink when they bolt
  if (P.special === 'ink' && a.inkT <= 0 && strength > 0.6) {
    a.inkT = 12;
    const col = P.id === 'vampire_squid' ? '#59c8ff' : '#1a1410';
    S.emit('ink', { x: f.x, y: f.y, size: Math.min(2.2, f.visualLen / 90), color: col });
  }
}

// ── the per-frame step ─────────────────────────────────────────────────────────────────────────────
/** Advance one free (non-controlled) animal by dt. */
export function stepFish(S, f, dt) {
  const a = f.ai, P = a.prof;
  a.t += dt;
  a.modeT += dt;
  if (a.wary > 0) a.wary -= dt;
  if (a.lureCool > 0) a.lureCool -= dt;
  if (a.lookCool > 0) a.lookCool -= dt;
  if (a.inkT > 0) a.inkT -= dt;
  if (a.fadeIn > 0) {
    f.alpha = Math.min(1, f.alpha + a.fadeIn * dt);
    if (f.alpha >= 1) a.fadeIn = 0;
  }
  f.age += dt;
  if (P.arch === 'item') itemStep(S, f, a, P, dt);
  else if (P.arch === 'jelly') jellyStep(S, f, a, P, dt);
  else if (P.arch === 'crawl') crawlStep(S, f, a, P, dt);
  else swimStep(S, f, a, P, dt);
  glowStep(f, a, P, dt);
}

function swimStep(S, f, a, P, dt) {
  const W = S.W, len = f.visualLen;
  if (a.mode === 'air') return airStep(S, f, a, P, dt);
  const sb = heightAt(f.x);
  a.zOK = zoneFor(P, len, sb, W.nightF, a.z);
  if (!a.zOK) {
    // bottom-dweller over water that is too deep/shallow for it: hug whatever seabed there is
    a.z.top = sb - P.down * len - 90;
    a.z.bot = sb - P.down * len - 10;
  }
  a.face = 0;
  a.pov = false;
  a.topK = 1;
  a.mouthT = 0;
  let accel = a.accel;
  switch (a.mode) {
    case 'school': S.schoolMember(S, f, a, P, dt); break;
    case 'rest': rest(S, f, a, P, dt, sb); break;
    case 'flee': accel *= 3.5; flee(S, f, a, P, dt); break;
    case 'leave': leave(S, f, a, P, dt, sb); break;
    case 'lure': accel *= S.lureStep(S, f, a, P, dt); break;
    case 'rush': case 'stalk': accel *= S.huntStep(S, f, a, P, dt); break;
    case 'launch': accel *= 4; launch(S, f, a, P, dt); break;
    case 'breathe': breathe(S, f, a, P, dt, sb); break;
    case 'bask': bask(S, f, a, P, dt, sb); break;
    default: cruise(S, f, a, P, dt, sb);
  }
  if (a.mode !== 'lure' || a.ls < 3) avoid(S, f, a, P);
  if (P.jet > 0) jetRhythm(f, a, P, dt);
  specials(S, f, a, P, dt);
  integrate(f, a, accel, dt);
  if (a.mode === 'air') return;
  constrain(S, f, a, P, dt);
  orient(f, a, P, dt);
  f.mouth = damp(f.mouth, a.mouthT, 7, dt);
  f.state = a.st;
}

// ── cruising: wander inside the habitat ────────────────────────────────────────────────────────────
function cruise(S, f, a, P, dt, sb) {
  const W = S.W, rng = S.rng;
  a.st = 'swim';
  const act = activity(P, W);
  a.lockT -= dt;
  a.turnT -= dt;
  a.decideT -= dt;
  if (a.decideT <= 0) {
    a.decideT = 0.28 + rng.next() * 0.2;
    decideHeading(S, f, a, P);
    const restP = P.restP + (act < 0.35 ? 0.5 : 0);
    if (restP > 0 && a.modeT > 2.5 && rng.next() < restP * 0.075) {
      a.restT = rng.range(P.restDur[0], P.restDur[1]) * (act < 0.35 ? 2.5 : 1);
      setMode(a, 'rest');
    }
    // surface breathers & baskers run their own cycles
    if (P.special === 'breather' || P.special === 'basker') {
      a.cycleT -= 0.38;
      if (a.cycleT <= 0) {
        a.cycleT = 0;
        setMode(a, P.special === 'breather' ? 'breathe' : 'bask');
        a.restT = P.special === 'breather' ? rng.range(2.5, 4.5) : rng.range(12, 28);
      }
    }
  }
  const sk = 0.74 + 0.52 * noise1(a.t * 0.21, a.ns + 31);
  const actK = 0.55 + 0.45 * Math.min(1, act);
  let sp = a.cruise * sk * actK;
  // darters (clownfish): little bursts
  if (P.dart) {
    a.burstT -= dt;
    if (a.burstT < -1.5 - noise1(a.t, a.ns) * 3) a.burstT = 0.25 + rng.next() * 0.3;
    if (a.burstT > 0) sp *= 2.4;
  }
  a.dvx = a.hx * sp;
  a.dvy = vertical(S, f, a, P, sb, 0.045, P.hover ? 0.6 : a.isLeader ? 0.2 : 0.28);
  // strayed outside the habitat (pushed by a chase, a spawn spread or the shoreline): head back home
  if (!a.zOK || !biomeOK(P, f.x, 60)) {
    a.hx = a.homeX >= f.x ? 1 : -1;
    a.dvx = a.hx * sp;
  }
}

/** Desired vertical speed toward a slowly wandering target depth inside the habitat zone. */
function vertical(S, f, a, P, sb, freq, vk) {
  const len = f.visualLen, z = a.z;
  let ty;
  if (P.hover || P.sp.layer === 'benthic' || P.sp.layer === 'demersal') {
    // follow the terrain: look ahead so slopes are climbed early
    const ax = f.x + a.hx * (len * 0.6 + Math.abs(f.vx) * 1.2 + 20);
    const sbA = heightAt(ax);
    const h = P.hover || [10, 60];
    const n = noise1(a.t * freq * 2, a.ns + 13);
    ty = Math.min(sb, sbA) - P.down * len - (h[0] + (h[1] - h[0]) * n);
    if (ty < z.top) ty = z.top;
  } else {
    const zh = Math.max(0, z.bot - z.top);
    const amp = Math.min(0.5, 240 / Math.max(1, zh));
    const n = noise1(a.t * freq * Math.min(1, 320 / Math.max(1, zh)), a.ns + 7) - 0.5;
    const fr = clamp(a.zf + n * 2 * amp, 0, 1);
    ty = z.top + fr * zh;
    // rise early over terrain ahead
    const ax = f.x + a.hx * (len * 0.6 + Math.abs(f.vx) * 1.5 + 40);
    const lim = heightAt(ax) - P.down * len - 34;
    if (ty > lim) ty = Math.max(z.top, lim);
  }
  a.ty = ty;
  const vmax = a.cruise * vk;
  return clamp((ty - f.y) * 0.65, -vmax, vmax);
}

/** Heading decisions: home range, random meanders, terrain / habitat ahead, school cohesion. */
function decideHeading(S, f, a, P) {
  if (a.lockT > 0) return;
  const rng = S.rng, len = f.visualLen;
  let turn = false;
  const g = a.group;
  if (g && !g.lead && g.members.length > 1 && Math.abs(f.x - g.cx) > g.R && (g.cx - f.x) * a.hx < 0) turn = true;
  else if (a.homeR > 0 && (f.x - a.homeX) * a.hx > a.homeR) turn = true;
  else if (a.turnT <= 0) {
    a.turnT = rng.range(P.turnEvery[0], P.turnEvery[1]);
    if (a.homeR > 0 && rng.next() < 0.42) turn = true;
  }
  if (!turn && blockedAhead(S, f, a, P, a.hx, len)) turn = true;
  if (turn && !blockedAhead(S, f, a, P, -a.hx, len)) {
    a.hx = -a.hx;
    a.lockT = 1.4 + rng.next() * 1.6;
  } else if (turn) a.lockT = 0.6;
}

/** Is the way ahead (direction hx) closed: world edge, wrong biome, a wall above our band, or no habitat? */
export function blockedAhead(S, f, a, P, hx, len) {
  const look = len * (0.4 + P.front) + Math.abs(f.vx) * 1.3 + 36;
  const ax = f.x + hx * look;
  if (ax < 620 || ax > WORLD.width - 30) return true;
  // a school leader turns right at the biome edge: its members spread out around it
  if (!biomeOK(P, ax, a.isLeader ? 0 : 140)) return true;
  const sbA = heightAt(ax);
  if (!zoneFor(P, len, sbA, S.W.nightF, tmpZ)) return true;
  return sbA - P.down * len - 12 < a.z.top;
}

function rest(S, f, a, P, dt, sb) {
  a.st = 'idle';
  a.restT -= dt;
  const n = noise1(a.t * 0.4, a.ns + 5) - 0.5;
  a.dvx = a.hx * a.cruise * (0.05 + 0.1 * n);
  a.dvy = vertical(S, f, a, P, sb, 0.02, 0.18);
  if (P.special === 'oarfish') {
    a.pov = true;
    a.povT = -1.32;
    a.dvx *= 0.3;
  } else if (P.special === 'headdown') {
    a.pov = true;
    a.povT = 0.62;
  } else if (P.special === 'grazer' && sb - f.y < f.visualLen * 0.9 + 60) {
    a.pov = true;
    a.povT = 0.42;
    a.mouthT = Math.max(0, Math.sin(a.t * 5.5)) * 0.7;
    a.dvy += 6;
  }
  if (a.restT <= 0 || (a.prof.dart && a.modeT > 1.2)) setMode(a, baseMode(a));
}

function flee(S, f, a, P, dt) {
  a.fleeT -= dt;
  const k = clamp(a.fleeT / a.fleeDur, 0, 1);
  const dx = f.x - a.fx, dy = f.y - a.fy;
  const d = Math.hypot(dx, dy) || 1;
  const sp = a.cruise * (1 + (P.burst - 1) * Math.sqrt(k));
  a.dvx = (dx / d) * sp;
  a.dvy = (dy / d) * sp * 0.55;
  // keep roughly inside the habitat while bolting
  if (f.y < a.z.top - 20) a.dvy += a.cruise * 0.6;
  else if (f.y > a.z.bot + 20) a.dvy -= a.cruise * 0.6;
  a.st = k > 0.25 ? 'flee' : 'swim';
  if (a.fleeT <= 0) {
    a.hx = dx >= 0 ? 1 : -1;
    a.lockT = 2;
    setMode(a, baseMode(a));
  }
}

function leave(S, f, a, P, dt, sb) {
  a.st = 'swim';
  a.lockT -= dt;
  if (a.lockT <= 0 && blockedAhead(S, f, a, P, a.hx, f.visualLen)) {
    a.hx = -a.hx;
    a.lockT = 3;
    // hemmed in by its own habitat for a long time: it settles back in (still wary of lures)
    if (a.modeT > 25) {
      a.leaving = false;
      setMode(a, baseMode(a));
    }
  }
  a.dvx = a.hx * a.cruise * 1.25;
  a.dvy = vertical(S, f, a, P, sb, 0.03, 0.4);
}

// ── surface specials ───────────────────────────────────────────────────────────────────────────────
function surfaceY(S, x) {
  return waveHeight(x, S.W.t, S.W.sea);
}

/** Turtle: swim up, hold the head at the surface for a breath, dive again. */
function breathe(S, f, a, P, dt, sb) {
  const len = f.visualLen;
  a.topK = 0.45;
  const ty = surfaceY(S, f.x) + P.up * len * 0.45;
  const near = f.y - ty < 14;
  if (!near) {
    a.st = 'swim';
    a.dvx = a.hx * a.cruise * 0.7;
    a.dvy = -a.cruise * 0.75;
    if (a.modeT > 25) a.restT = 0;
  } else {
    a.st = 'idle';
    a.restT -= dt;
    a.dvx = a.hx * a.cruise * 0.08;
    a.dvy = (ty - f.y) * 2;
    a.pov = true;
    a.povT = -0.22;
  }
  if (a.restT <= 0) {
    a.cycleT = S.rng.range(25, 55);
    a.zf = S.rng.range(0.35, 1);
    setMode(a, 'cruise');
  }
}

/** Sunfish: lie at the surface warming up, drifting with the swell; then dive for a while. */
function bask(S, f, a, P, dt, sb) {
  const len = f.visualLen;
  a.topK = 0.2;
  a.st = 'idle';
  a.restT -= dt;
  const ty = surfaceY(S, f.x) + P.up * len * 0.2;
  a.dvx = a.hx * a.cruise * 0.06 + S.W.wind * 5;
  a.dvy = clamp((ty - f.y) * 0.8, -a.cruise * 0.6, a.cruise * 0.6);
  if (f.y - ty > 30) a.st = 'swim';
  if (a.restT <= 0) {
    a.cycleT = S.rng.range(20, 45);
    a.zf = S.rng.range(0.25, 0.8);
    setMode(a, 'cruise');
  }
}

/** Flying fish: sprint for the surface, then burst out (→ air). */
function launch(S, f, a, P, dt) {
  a.st = 'swim';
  a.launchDelay -= dt;
  const sp = a.cruise * 2.8;
  if (a.launchDelay > 0) {
    a.dvx = a.hx * a.cruise * 1.2;
    a.dvy = -a.cruise * 0.3;
    return;
  }
  a.dvx = a.hx * sp;
  a.dvy = -sp * 0.9;
  a.topK = -1; // allowed to break the surface
  const surf = surfaceY(S, f.x);
  if (f.y < surf + P.up * f.visualLen + 4 || a.modeT > 3) {
    a.mode = 'air';
    a.modeT = 0;
    f.vx = a.hx * S.rng.range(250, 340);
    f.vy = -S.rng.range(230, 310);
    a.glideT = S.rng.range(1.1, 2.6);
    a.glideH = S.rng.range(24, 46);
    f.y = Math.min(f.y, surf - 2);
    S.emit('splash', { x: f.x, y: surf, size: 0.3, kind: 'jump' });
  }
}

/** Anything in the air: ballistic (flying fish glide after the apex) until it drops back in. */
function airStep(S, f, a, P, dt) {
  let g = 980;
  if (P.special === 'flyer' && a.glideT > 0 && f.vy > -60) {
    // skim the swell at a steady height on outstretched pectoral "wings"
    a.glideT -= dt;
    g = 0;
    const alt = surfaceY(S, f.x) - a.glideH;
    f.vy = damp(f.vy, clamp((alt - f.y) * 2.5, -60, 40), 4, dt);
  }
  f.vy += g * dt;
  f.vx *= Math.exp(-0.12 * dt);
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  const turn = f.vx >= 0 ? 1 : -1;
  f.dir = damp(f.dir, turn, 8, dt);
  f.pitch = damp(f.pitch, clamp(Math.atan2(f.vy, Math.abs(f.vx) + 1), -1.1, 1.2), 10, dt);
  f.swimPhase += dt * 1.5;
  f.swimAmp = damp(f.swimAmp, 0.22, 6, dt);
  f.mouth = damp(f.mouth, 0, 6, dt);
  f.state = 'jump';
  const surf = surfaceY(S, f.x);
  if (f.y > surf + 1 && f.vy > 0) {
    S.emit('splash', { x: f.x, y: surf, size: clamp(f.visualLen / 160, 0.25, 2.6), kind: 'jump' });
    f.vy *= 0.35;
    f.vx *= 0.55;
    a.hx = f.vx >= 0 ? 1 : -1;
    a.mode = a.retMode || baseMode(a);
    a.modeT = 0;
  }
}

// ── avoidance: predators, the boat hull and its engine noise ──────────────────────────────────────
function avoid(S, f, a, P) {
  const W = S.W;
  if (f.y < 360 && P.fearK > 0.1) {
    const R = 140 + 420 * Math.abs(W.throttle) + (P.sp.temperament === 'skittish' ? 70 : 0) + f.visualLen * 0.3;
    const dx = f.x - W.boatX, dy = f.y - W.boatY;
    if (Math.abs(dx) < R && dy < R) {
      const d = Math.hypot(dx, dy) || 1;
      if (d < R) {
        const w = (1 - d / R) * (P.sp.level >= 8 ? 0.4 : 1);
        a.dvx += (dx / d) * a.cruise * 1.3 * w;
        a.dvy += Math.max(0.35, dy / d) * a.cruise * 1.1 * w;
      }
    }
  }
  const T = S.threats, lv = P.level, len = f.visualLen;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    if (t === f || t.species.level < lv + 2 || t.visualLen < len * 1.5) continue;
    const ta = t.ai;
    const hunting = !!ta && ta.tag === S.tag && (ta.mode === 'rush' || ta.mode === 'stalk');
    const R = 70 + t.visualLen * (hunting ? 2.1 : 1.0);
    const dx = f.x - t.x, dy = f.y - t.y;
    if (dx > R || dx < -R || dy > R || dy < -R) continue;
    const d = Math.hypot(dx, dy) || 1;
    if (d > R) continue;
    const w = (1 - d / R) * P.fearK;
    a.dvx += (dx / d) * a.cruise * 1.8 * w;
    a.dvy += (dy / d) * a.cruise * 0.9 * w;
    if (hunting && d < R * 0.65 && a.mode !== 'flee' && a.mode !== 'lure') startle(S, f, t.x, t.y, 1);
  }
}

// ── rhythms & specials ─────────────────────────────────────────────────────────────────────────────
/** Cephalopod jetting: the mantle pulse drives the swimPhase and makes the speed surge. */
function jetRhythm(f, a, P, dt) {
  const v = Math.hypot(f.vx, f.vy);
  a.pulse += dt * TAU * P.jet * (0.8 + Math.min(1.6, v / Math.max(20, a.cruise)) * 0.6);
  const s = Math.sin(a.pulse);
  const m = 0.45 + 1.15 * (s > 0 ? s * s : 0);
  a.dvx *= m;
  a.dvy *= m;
}

function specials(S, f, a, P, dt) {
  const sp = P.special;
  if (!sp) return;
  if (sp === 'filter') a.mouthT = Math.max(a.mouthT, 0.3 + 0.35 * noise1(a.t * 0.3, a.ns + 9));
  else if (sp === 'sweep') a.dvy += Math.sin(a.t * 1.8 + a.ns) * a.cruise * 0.14;
  else if (sp === 'lurker' && a.mode === 'rest') a.mouthT = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(a.t * 1.7));
  else if (sp === 'gape') {
    a.gapeT -= dt;
    if (a.gapeT < 0) a.mouthT = Math.max(a.mouthT, 1);
    if (a.gapeT < -1.6) a.gapeT = S.rng.range(6, 15);
  }
}

function integrate(f, a, accel, dt) {
  const ax = a.dvx - f.vx, ay = a.dvy - f.vy;
  const m = Math.hypot(ax, ay), lim = accel * dt;
  if (m > lim) {
    const k = lim / m;
    f.vx += ax * k;
    f.vy += ay * k;
  } else {
    f.vx = a.dvx;
    f.vy = a.dvy;
  }
  f.x += f.vx * dt;
  f.y += f.vy * dt;
}

/** Keep a swimmer in the water: not above the waves, not inside the seabed, not on the beach. */
function constrain(S, f, a, P, dt) {
  const len = f.visualLen;
  if (f.x < 24) {
    f.x = 24;
    f.vx = Math.abs(f.vx) * 0.3;
    a.hx = 1;
  } else if (f.x > WORLD.width - 24) {
    f.x = WORLD.width - 24;
    f.vx = -Math.abs(f.vx) * 0.3;
    a.hx = -1;
  }
  const sb = heightAt(f.x);
  const floor = sb - P.down * len - 1;
  let top = P.up * len * a.topK + 3;
  if (f.y < top + 40 && a.topK >= 0) top += surfaceY(S, f.x);
  else if (a.topK < 0) top = -1e9;
  if (floor < top) {
    // too shallow for this body here: slide back toward deeper water
    const s = slopeAt(f.x) >= 0 ? 1 : -1;
    f.x += s * 60 * dt;
    f.vx = s * Math.abs(f.vx) * 0.5;
    a.hx = s;
    f.y = Math.max(top, Math.min(f.y, floor));
    return;
  }
  if (f.y > floor) {
    f.y = floor;
    if (f.vy > 0) f.vy = 0;
  }
  if (f.y < top) {
    f.y = top;
    if (f.vy < 0) f.vy *= 0.1;
  }
}

function orient(f, a, P, dt) {
  const pd = f.dir, pp = f.pitch, ph = f.swimPhase;
  orientFish(f, dt, P.orient);
  if (a.face !== 0) {
    f.dir = damp(pd, a.face, P.turnRate, dt);
    if (f.dir * a.face > 0.985) f.dir = a.face;
  }
  if (a.pov) f.pitch = damp(pp, clamp(a.povT, -P.maxPitch, P.maxPitch), 2.2, dt);
  else {
    // a slow vertical drift while hovering must not read as a nose-dive: pitch against a virtual forward speed
    const tgt = Math.atan2(f.vy, Math.abs(f.vx) + a.cruise * 0.35);
    f.pitch = damp(pp, tgt < -P.maxPitch ? -P.maxPitch : tgt > P.maxPitch ? P.maxPitch : tgt, 5, dt);
  }
  // cephalopods: the mantle pulse (jetRhythm) is the locomotion cycle
  if (P.jet > 0) {
    if (a.pulse < ph) a.pulse = ph;
    f.swimPhase = a.pulse;
  }
}

// ── jellyfish: pulse & drift ───────────────────────────────────────────────────────────────────────
function jellyStep(S, f, a, P, dt) {
  const W = S.W, len = f.visualLen;
  const sb = heightAt(f.x);
  a.zOK = zoneFor(P, len, sb, W.nightF, a.z);
  // slow wander of the target depth + gentle homing
  const zh = Math.max(0, a.z.bot - a.z.top);
  const n = noise1(a.t * 0.03, a.ns + 7) - 0.5;
  const ty = a.z.top + clamp(a.zf + n * Math.min(1, 300 / Math.max(1, zh)), 0, 1) * zh;
  const wantVy = clamp((ty - f.y) * 0.12, -16, 9);
  const home = a.group ? a.group.cx : a.homeX;
  const current = W.wind * 9 * Math.max(0, 1 - f.y / 700);
  const wantVx = clamp((home - f.x) * 0.01, -7, 7) + current + (noise1(a.t * 0.05, a.ns + 3) - 0.5) * 10;
  // the bell: contraction at sin(phase) → 1
  const need = clamp(-wantVy / 12 + 0.55, 0.25, 1.4);
  if (a.pulse < f.swimPhase) a.pulse = f.swimPhase;
  a.pulse += dt * TAU * P.pulse * (0.85 + 0.3 * noise1(a.t * 0.2, a.ns)) * (0.8 + 0.3 * need);
  f.swimPhase = a.pulse;
  const s = Math.sin(a.pulse);
  if (s > 0) {
    const th = 95 * P.thrust * need * s * s * dt;
    const tilt = clamp(wantVx / 22, -0.5, 0.5);
    f.vx += Math.sin(tilt) * th;
    f.vy -= Math.cos(tilt) * th;
  }
  const drag = Math.exp(-1.6 * dt);
  f.vx = f.vx * drag + (wantVx - f.vx) * 0.25 * dt;
  f.vy = f.vy * drag + 10 * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  a.topK = 1;
  constrain(S, f, a, P, dt);
  // radially symmetric: never "turn around" (no squash) — tilt toward the drift instead
  f.dir = f.dir >= 0 ? 1 : -1;
  f.pitch = damp(f.pitch, clamp(f.vx / 40, -P.maxPitch, P.maxPitch) * f.dir, 2, dt);
  f.swimAmp = damp(f.swimAmp, 0.35 + 0.35 * need, 2, dt);
  f.state = 'swim';
}

// ── benthic walkers: crabs, lobsters, isopods, octopus ────────────────────────────────────────────
function crawlStep(S, f, a, P, dt) {
  const W = S.W, rng = S.rng, len = f.visualLen;
  const sb = heightAt(f.x);
  a.zOK = zoneFor(P, len, sb, W.nightF, a.z);
  let want = 0, accel = a.accel * 2.2;
  a.face = 0;
  a.mouthT = 0;
  let st = 'crawl';
  if (a.mode === 'flee') {
    a.fleeT -= dt;
    const k = clamp(a.fleeT / a.fleeDur, 0, 1);
    const away = f.x >= a.fx ? 1 : -1;
    want = away * a.cruise * P.burst * (0.4 + k);
    accel *= 4;
    if (P.special === 'tailflip') a.face = f.dir >= 0 ? 1 : -1; // shoots off backwards, still facing the threat
    a.lift = damp(a.lift, P.special === 'ink' ? 70 * k : P.special === 'tailflip' ? 26 * k : 0, 6, dt);
    st = P.special === 'ink' ? 'flee' : 'crawl';
    if (a.fleeT <= 0) setMode(a, baseMode(a));
  } else if (a.mode === 'lure') {
    accel *= S.lureStep(S, f, a, P, dt);
    want = a.dvx;
    st = a.st;
  } else if (a.mode === 'leave') {
    want = a.hx * a.cruise;
    a.lockT -= dt;
    if (a.lockT <= 0 && blockedAhead(S, f, a, P, a.hx, len)) {
      a.hx = -a.hx;
      a.lockT = 3;
    }
  } else {
    // walk / scuttle with pauses
    a.lockT -= dt;
    a.decideT -= dt;
    if (a.decideT <= 0) {
      a.decideT = 0.3 + rng.next() * 0.25;
      decideHeading(S, f, a, P);
    }
    const g = a.group;
    if (g && g.style === 'conga' && a.gi > 0) {
      // follow the lobster in front, single file
      const lead = g.members[a.gi - 1];
      if (lead && lead !== f) {
        const tx = lead.x - (lead.dir >= 0 ? 1 : -1) * len * 1.05;
        want = clamp((tx - f.x) * 1.4, -a.cruise * 1.3, a.cruise * 1.3);
        if (Math.abs(want) < 4) want = 0;
        a.hx = lead.dir >= 0 ? 1 : -1;
      }
    } else if (P.gait === 'scuttle') {
      a.pauseT -= dt;
      if (a.pauseT <= 0) {
        if (a.burstT <= 0) {
          a.burstT = rng.range(0.35, 1.2);
          if (rng.next() < 0.3) a.hx = -a.hx;
        }
        a.burstT -= dt;
        want = a.hx * a.cruise * 1.7;
        if (a.burstT <= 0) a.pauseT = rng.range(0.4, 2.6);
      }
    } else {
      a.pauseT -= dt;
      if (a.pauseT <= 0) {
        want = a.hx * a.cruise * (0.6 + 0.6 * noise1(a.t * 0.3, a.ns));
        if (a.pauseT < -rng.range(3, 9)) a.pauseT = rng.range(P.restDur[0], P.restDur[1]) * (activity(P, W) < 0.4 ? 2 : 1);
      }
    }
    a.lift = damp(a.lift, 0, 3, dt);
    if (a.mode !== 'cruise' && a.mode !== 'school') setMode(a, 'cruise');
  }
  const dv = want - f.vx, lim = accel * dt;
  f.vx += clamp(dv, -lim, lim);
  f.x += f.vx * dt;
  if (f.x < 620 || f.x > WORLD.width - 30) {
    f.x = clamp(f.x, 620, WORLD.width - 30);
    f.vx = 0;
    a.hx = -a.hx;
  }
  // stand ON the slope: offset along the surface normal (steep rock walls included)
  const slope = clamp(Math.atan(slopeAt(f.x)), -1.05, 1.05);
  const floorY = heightAt(f.x) - (P.down * len * 0.92) / Math.cos(slope) - a.lift;
  if (f.y < floorY - 8 && a.mode !== 'flee') {
    // dropped in mid-water (e.g. slipped off the hook): sink back to the bottom
    f.vy = Math.min(f.vy + 420 * dt, 170);
    f.y = Math.min(floorY, f.y + f.vy * dt);
  } else {
    f.vy = (floorY - f.y) / Math.max(dt, 1e-3);
    f.y = floorY;
  }
  // facing: crabs walk sideways and just reverse; the others turn around properly
  const sgn = f.vx > 2 ? 1 : f.vx < -2 ? -1 : 0;
  if (a.face !== 0) {
    f.dir = a.face;
  } else if (sgn !== 0) {
    if (P.snapTurn) f.dir = sgn;
    else {
      f.dir = damp(f.dir, sgn, 5, dt);
      if (f.dir * sgn > 0.985) f.dir = sgn;
    }
  } else if (Math.abs(f.dir) < 0.985) f.dir = damp(f.dir, f.dir >= 0 ? 1 : -1, 5, dt);
  const pl = P.maxPitch < 0.5 ? P.maxPitch : 1.05;
  f.pitch = damp(f.pitch, clamp(slope, -pl, pl) * (f.dir >= 0 ? 1 : -1), 6, dt);
  const v = Math.abs(f.vx);
  f.swimPhase += dt * (TAU * v / Math.max(8, len * 0.28) + 0.4);
  f.swimAmp = damp(f.swimAmp, clamp(0.2 + v / Math.max(10, a.cruise) * 0.7, 0.2, 1.4), 6, dt);
  f.mouth = damp(f.mouth, a.mouthT, 6, dt);
  if (a.mode === 'flee') f.state = st;
  else if (v > 3) f.state = 'crawl';
  else f.state = a.mode === 'lure' && (a.ls === 3 || a.ls === 4) ? 'nibble' : 'idle';
}

// ── items: rest on the seabed / bob at the surface ─────────────────────────────────────────────────
function itemStep(S, f, a, P, dt) {
  const len = f.visualLen;
  f.state = 'idle';
  f.vx = 0;
  f.vy = 0;
  if (P.sp.layer === 'surface') {
    const W = S.W;
    f.x += (W.wind * 6 + (a.homeX - f.x) * 0.02) * dt;
    const surf = waveHeight(f.x, W.t, W.sea) + len * 0.06;
    // a bottle let go below the surface bobs back up first
    f.y = f.y > surf + 12 ? f.y - 55 * dt : surf;
    f.pitch = damp(f.pitch, clamp(Math.atan(waveSlope(f.x, W.t, W.sea)) * 0.8 + Math.sin(a.t * 1.3 + a.ns) * 0.08, -P.maxPitch, P.maxPitch), 5, dt);
    f.swimPhase += dt;
  } else {
    // rest on the seabed; anything dropped mid-water (a snapped line) sinks back down, rocking a little
    const rest = heightAt(f.x) - P.down * len * 0.75;
    const slopeP = clamp(Math.atan(slopeAt(f.x)), -P.maxPitch, P.maxPitch) * (f.dir >= 0 ? 1 : -1);
    if (a.modeT < 0.05 && f.y > rest - 30) f.y = rest;
    if (f.y < rest - 1) {
      f.y = Math.min(rest, f.y + 70 * dt);
      f.pitch = damp(f.pitch, Math.sin(a.t * 2.2 + a.ns) * P.maxPitch, 3, dt);
    } else {
      f.y = rest;
      f.pitch = damp(f.pitch, slopeP, 4, dt);
    }
  }
  f.swimAmp = 0.2;
}

// ── bioluminescence ────────────────────────────────────────────────────────────────────────────────
function glowStep(f, a, P, dt) {
  const g = P.glow;
  if (!g) return;
  if (g === 'flicker') f.glowAmt = 0.55 + 0.45 * noise1(a.t * 2.4, a.ns + 3);
  else if (g === 'pulse') {
    f.glowAmt = P.arch === 'jelly' ? 0.55 + 0.45 * Math.max(0, Math.sin(a.pulse)) : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(a.t * 1.4 + a.ns));
  } else if (g === 'lure') f.glowAmt = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(a.t * 0.8 + a.ns), 2);
  else if (g === 'flash') {
    // Humboldt squid talk in red/white flashes — more chatter while hunting
    a.flashT -= dt * (a.mode === 'rush' || a.mode === 'lure' ? 3 : 1);
    if (a.flashT <= 0) a.flashT = 0.6 + 3.2 * noise1(a.t * 3.7, a.ns + 17);
    f.glowAmt = a.flashT < 0.22 ? 1 : 0.35;
  }
}
