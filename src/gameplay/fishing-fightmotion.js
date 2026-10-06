// Fight behaviour & body motion of the hooked fish, by species.fight.style. GAMEPLAY helper.
//
// A fight is a sequence of MODES (rest · pull · run · dive · jump · thrash). Each style has its own menu of
// modes, durations and tells. `pull` is how hard the fish is pulling right now (0..1+, before the
// power/tackle ratio), `activity` how violently it is moving (drives the slack-escape meter and FX).
import { clamp, clamp01, damp, lerp } from '../core/math.js';
import { orientFish } from '../entities/fishbase.js';

const GRAVITY = 900;

/** Per-mode base numbers: pulling effort, violence, speed (× body speed), stamina burn. */
export const MODES = {
  rest:   { pull: 0.12, activity: 0.3, speed: 0.32, burn: 0.5 },
  pull:   { pull: 0.52, activity: 0.6, speed: 0.75, burn: 0.85 },
  run:    { pull: 1.0,  activity: 1.0, speed: 1.9,  burn: 1.1 },
  dive:   { pull: 0.8,  activity: 0.8, speed: 1.15, burn: 1.0 },
  jump:   { pull: 0.62, activity: 1.0, speed: 1.6,  burn: 1.1 },
  thrash: { pull: 0.55, activity: 0.9, speed: 0.5,  burn: 0.95 },
};

/**
 * Style menus: [mode, weight, minDur, maxDur]. `after` biases the next mode (e.g. jumpers jump after a run).
 */
const STYLES = {
  darter:     { menu: [['rest', 3, 0.7, 1.4], ['pull', 3, 0.8, 1.6], ['run', 4, 0.5, 1.1]], runPull: 0.85, zigzag: 0.3 },
  runner:     { menu: [['rest', 2.5, 1.0, 2.0], ['pull', 3, 1.4, 2.8], ['run', 4.5, 2.2, 4.5]] },
  diver:      { menu: [['rest', 2.5, 1.0, 2.0], ['pull', 2.5, 1.2, 2.4], ['dive', 5, 2.5, 4.5], ['run', 1, 1.0, 1.8]] },
  jumper:     { menu: [['rest', 2, 0.9, 1.8], ['pull', 2, 1.2, 2.2], ['run', 3.5, 1.8, 3.6], ['jump', 2.5, 3, 3]], after: { run: { jump: 0.6 } } },
  thrasher:   { menu: [['rest', 2.5, 1.0, 2.0], ['pull', 2.5, 1.2, 2.2], ['thrash', 4, 1.4, 2.8], ['run', 1, 1.0, 1.8]] },
  bulldog:    { menu: [['rest', 3, 0.9, 1.8], ['pull', 6, 1.6, 3.2], ['run', 1, 0.8, 1.4]], tugs: true, runPull: 0.8 },
  deadweight: { menu: [['rest', 2, 1.2, 2.2], ['pull', 6, 2.5, 5.0], ['dive', 1.5, 2.5, 4.0]], restPull: 0.35, speedMul: 0.55 },
  floater:    { menu: [['rest', 7, 1.2, 2.5], ['pull', 3, 1.0, 2.0]], restPull: 0.05, pullMul: 0.55, speedMul: 0.5 },
};
export const styleOf = (style) => STYLES[style] || STYLES.bulldog;

/** Choose the next mode for the fight record F (see fishing-fight.js) and reset its timers. */
export function nextMode(F, rng) {
  const st = styleOf(F.style);
  const bias = st.after && st.after[F.mode];
  let total = 0;
  for (const m of st.menu) total += m[0] === F.mode ? m[1] * 0.35 : m[1] * (bias && bias[m[0]] ? 1 + bias[m[0]] * 6 : 1);
  let r = rng.next() * total;
  let pick = st.menu[0];
  for (const m of st.menu) {
    r -= m[0] === F.mode ? m[1] * 0.35 : m[1] * (bias && bias[m[0]] ? 1 + bias[m[0]] * 6 : 1);
    if (r <= 0) {
      pick = m;
      break;
    }
  }
  F.mode = pick[0];
  F.modeT = 0;
  F.modeDur = lerp(pick[2], pick[3], rng.next());
  // rests often mean swimming at the boat (slack line — reel!), the rest of the time just hanging
  F.toward = F.mode === 'rest' && rng.next() < 0.55;
  F.zigT = 0;
  F.zigDir = rng.next() < 0.5 ? -1 : 1;
  F.jumpPhase = F.mode === 'jump' ? 'rise' : null;
  F.tugT = 0;
}

/** Current pulling effort and activity for the fight record (reads F.mode, F.modeT, stamina). */
export function effort(F, stamina) {
  const st = styleOf(F.style), m = MODES[F.mode];
  let pull = m.pull, activity = m.activity;
  if (F.mode === 'rest' && st.restPull !== undefined) pull = st.restPull;
  if (F.mode === 'run' && st.runPull !== undefined) pull = st.runPull;
  if (st.pullMul) pull *= st.pullMul;
  if (st.tugs && F.mode === 'pull') pull *= F.tugT % 0.9 < 0.38 ? 1.45 : 0.6; // stubborn short tugs
  if (F.mode === 'thrash') pull *= 1 + 0.5 * Math.sin(F.modeT * 56) * Math.sin(F.modeT * 9.3); // flutter
  if (F.mode === 'jump' && F.jumpPhase === 'air') pull = 0.62 + (F.shakeT < 0.06 ? 0.45 : 0);
  if (F.item) pull = 0.3;
  // a tired fish pulls less: at zero stamina it is dead weight
  const fatigue = F.item ? 0.9 : 0.2 + 0.8 * Math.pow(clamp01(stamina), 0.7);
  return { pull: pull * fatigue, activity: activity * (0.45 + 0.55 * clamp01(stamina)) };
}

/**
 * Move the hooked fish for one frame. Sets its velocity & position, keeps it in the water column, animates it.
 * Returns a tell: null | 'surfaced' (left the water) | 'reentered' | 'rocks' (hit the seabed on a dive).
 */
export function stepMotion(game, F, dt) {
  const fish = F.fish, tip = game.boat.rod.tip, boat = game.boat;
  const terrain = game.world.terrain, waves = game.world.waves;
  const st = styleOf(F.style);
  const len = fish.visualLen;
  const stamina = game.fishing.fight.stamina;
  const m = MODES[F.mode];
  const base = clamp(len * 2.3, 60, 330) * (st.speedMul || 1) * (0.45 + 0.55 * stamina);
  let speed = Math.min(560, base * m.speed);
  const away = fish.x >= boat.x ? 1 : -1; // away from the hull (the tip may be on either side of the fish)
  const surf = waves.heightAt(fish.x);
  const floor = terrain.heightAt(fish.x);
  const depthRoom = floor - fish.y;
  let tell = null;
  let tx = 0, ty = 0; // wanted direction (unnormalised)
  let snap = F.style === 'darter' ? 12 : 5;

  if (F.item) {
    // dead weight: hangs on the line, drifts down a little
    tx = 0;
    ty = 0.3;
    speed = 20;
  } else if (F.mode === 'rest') {
    if (F.toward) {
      tx = -away;
      ty = -0.1;
    } else {
      tx = away * 0.3;
      ty = Math.sin(F.modeT * 1.7) * 0.3;
    }
  } else if (F.mode === 'pull') {
    tx = away;
    ty = F.style === 'deadweight' || F.style === 'bulldog' ? 0.6 : F.style === 'floater' ? -0.2 : 0.25;
  } else if (F.mode === 'run') {
    F.zigT -= dt;
    if (F.zigT <= 0) {
      F.zigT = st.zigzag ? 0.3 + 0.2 * Math.abs(Math.sin(F.modeT * 7.1 + fish.seed * 9)) : 0.9;
      if (st.zigzag) F.zigDir = -F.zigDir;
    }
    tx = away;
    ty = st.zigzag ? F.zigDir * 0.8 : F.style === 'jumper' ? -0.12 : 0.18;
    snap = st.zigzag ? 14 : 6;
  } else if (F.mode === 'dive') {
    tx = away * 0.35;
    ty = 1;
    if (depthRoom < len * 0.4 + 14 && F.rocksT <= 0) {
      F.rocksT = 1.4;
      tell = 'rocks';
    }
  } else if (F.mode === 'thrash') {
    // rolls and shakes: rapid reversals, pitch wobble
    const r = Math.sin(F.modeT * 31);
    tx = r > 0 ? 1 : -1;
    ty = Math.sin(F.modeT * 23) * 0.8;
    snap = 16;
  } else if (F.mode === 'jump') {
    if (F.jumpPhase === 'rise') {
      tx = away * 0.7;
      ty = -1;
      speed = Math.min(600, base * 1.9);
      if (fish.y < surf + len * 0.35) {
        F.jumpPhase = 'air';
        fish.vy = -Math.min(700, 320 + len * 1.4);
        fish.vx = away * Math.min(260, 120 + len * 0.6);
        fish.state = 'jump';
        F.shakeT = 0;
        F.airT = 0;
        tell = 'surfaced';
      }
    } else if (F.jumpPhase === 'air') {
      fish.vy += GRAVITY * dt;
      F.shakeT += dt;
      F.airT += dt;
      if (F.shakeT > 0.17) F.shakeT = 0; // head-shake pulses (read by effort())
      if ((fish.vy > 0 && fish.y > surf + len * 0.15) || F.airT > 2.5) {
        F.jumpPhase = 'done';
        fish.state = 'hooked';
        fish.y = Math.max(fish.y, surf + len * 0.2);
        tell = 'reentered';
      }
    } else {
      tx = away;
      ty = 0.3;
    }
  }
  if (F.rocksT > 0) F.rocksT -= dt;

  if (F.jumpPhase !== 'air') {
    // steer: toward the wanted direction, but stay off the seabed / surface / world edges / hull
    if (depthRoom < len * 0.5 + 10 && ty > 0) ty = -0.2;
    if (fish.y < surf + len * 0.45 && ty < 0 && F.jumpPhase !== 'rise') ty = 0.3;
    if (fish.x < 60) tx = 1;
    if (fish.x > game.world.width - 60) tx = -1;
    if (Math.abs(fish.x - boat.x) < 150 && fish.y < 90 && F.mode !== 'rest') tx = away;
    const n = Math.hypot(tx, ty) || 1;
    fish.vx = damp(fish.vx, (tx / n) * speed, snap, dt);
    fish.vy = damp(fish.vy, (ty / n) * speed, snap, dt);
  }
  fish.x += fish.vx * dt;
  fish.y += fish.vy * dt;
  // hard limits: never inside the seabed, never above the surface unless jumping
  const floorNow = terrain.heightAt(fish.x) - len * 0.22;
  if (fish.y > floorNow) {
    fish.y = floorNow;
    if (fish.vy > 0) fish.vy *= -0.2;
  }
  const surfNow = waves.heightAt(fish.x) + len * 0.2;
  if (F.jumpPhase !== 'air' && fish.y < surfNow) {
    fish.y = surfNow;
    if (fish.vy < 0) fish.vy = 0;
  }
  fish.x = clamp(fish.x, 40, game.world.width - 40);
  orientFish(fish, dt, { turnRate: F.mode === 'thrash' ? 9 : 6 });
  const e = effort(F, stamina);
  fish.swimAmp = Math.max(fish.swimAmp, 0.5 + 0.9 * e.activity);
  fish.mouth = damp(fish.mouth, 0.25 + 0.45 * e.pull, 6, dt);
  return tell;
}

/** After the fish moved: enforce the line length (never farther from the tip than line.out) → it swings. */
export function constrainToLine(fish, tip, out) {
  const dx = fish.x - tip.x, dy = fish.y - tip.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > out) {
    const k = out / d;
    fish.x = tip.x + dx * k;
    fish.y = tip.y + dy * k;
    const ux = dx / d, uy = dy / d;
    const vr = fish.vx * ux + fish.vy * uy;
    if (vr > 0) {
      fish.vx -= vr * ux * 0.85;
      fish.vy -= vr * uy * 0.85;
    }
    return out;
  }
  return d;
}
