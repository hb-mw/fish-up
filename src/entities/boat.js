// Boat controller — sailing, buoyancy, tow by a hooked fish, and rod/angler posing. GAMEPLAY module.
//
// Mutates game.boat (shape in src/gameplay/state.js). Reads game.fishing for the rod pose and the extra
// fields the fishing module adds: fishing.tug (0..1 rod-tip impulse), fishing.tow {x, y, pull} (force a
// hooked fish exerts on the hull), fishing.charge, fishing.tension, fishing.fight.mode.
import { WORLD, biomeAt } from '../core/config.js';
import { clamp, clamp01, damp, lerp, ease, smoothstep } from '../core/math.js';
import { RIG } from '../entities/rig.js';

const HULL = RIG.hullLength;
const TROLL = 0.35;      // throttle fraction while the lure is out ('waiting')
const ACCEL = 230;       // px/s² at full throttle
const COAST = 1.4;       // 1/s hydrodynamic drag while coasting
const EDGE = 220;        // px of soft-stop zone before WORLD.boatMinX / boatMaxX
const STRIKE_T = 0.32;   // s of the 'strike' pose after a hook-set

/** Rest angle of the rod (radians above horizontal-forward) per angler pose. */
const REST_ANGLE = { idle: 0.95, wait: 0.74, reel: 0.9, fight: 1.12, lift: 1.58, celebrate: 1.35, sad: 1.25 };

export function createBoat(game) {
  const b = game.boat, f = game.fishing;
  // second-order state (velocities of the spring-damped quantities)
  let vy = 0, tiltV = 0, rodV = 0, bendV = 0;
  let accel = 0, prevVx = b.vx;
  let biome = biomeAt(b.x).id;
  let strikeT = 99, lastState = f.state;
  let flipT = 0;

  function setPose(p) {
    if (b.pose !== p) {
      b.pose = p;
      b.poseT = 0;
    }
  }

  // ── sailing ────────────────────────────────────────────────────────────────
  function sail(dt) {
    const stats = game.player.stats;
    const st = f.state;
    const allow = st === 'idle' ? 1 : st === 'waiting' ? TROLL : 0;
    const ax = game.mode === 'play' && allow > 0 ? game.input.axisX() : 0;
    // soft stop: the engine fades out as the hull approaches the world edges
    let effort = ax * allow;
    if (effort < 0) effort *= clamp01((b.x - WORLD.boatMinX) / EDGE);
    if (effort > 0) effort *= clamp01((WORLD.boatMaxX - b.x) / EDGE);
    b.throttle = damp(b.throttle, effort, 7, dt);
    const target = effort * stats.boatSpeed;
    if (ax !== 0) {
      // engine: strong push, but a heavy hull — reversing takes a moment
      const a = ACCEL * (0.45 + 0.55 * allow) * (Math.sign(target - b.vx) === Math.sign(b.vx) || b.vx === 0 ? 1 : 1.6);
      b.vx = Math.abs(target - b.vx) <= a * dt ? target : b.vx + Math.sign(target - b.vx) * a * dt;
    } else {
      b.vx = damp(b.vx, 0, COAST, dt);
      if (Math.abs(b.vx) < 0.5) b.vx = 0;
    }
    // tow by the hooked fish (fishing.tow.x is an acceleration, px/s²)
    const tow = f.tow;
    if (tow && tow.x) b.vx += tow.x * dt;
    b.x += b.vx * dt;
    if (b.x < WORLD.boatMinX) {
      b.x = WORLD.boatMinX;
      b.vx = Math.max(0, b.vx) * 0.3;
    } else if (b.x > WORLD.boatMaxX) {
      b.x = WORLD.boatMaxX;
      b.vx = Math.min(0, b.vx) * 0.3;
    }
    // facing follows the helm only with the line in
    flipT += dt;
    if (st === 'idle' && ax !== 0 && ax !== b.facing && flipT > 0.25) {
      b.facing = ax;
      flipT = 0;
    }
    accel = damp(accel, dt > 0 ? (b.vx - prevVx) / dt : 0, 8, dt);
    prevVx = b.vx;
    const bio = biomeAt(b.x).id;
    if (bio !== biome) {
      game.events.emit('biome', { from: biome, to: bio });
      biome = bio;
    }
  }

  // ── buoyancy ───────────────────────────────────────────────────────────────
  function float(dt) {
    const waves = game.world.waves, sea = game.env.weather.sea;
    const hb = waves.heightAt(b.x + b.facing * HULL * 0.4);
    const hs = waves.heightAt(b.x - b.facing * HULL * 0.4);
    const tow = f.tow || { x: 0, y: 0, pull: 0 };
    const hooked = f.hooked;
    const side = hooked ? (hooked.x >= b.x ? 1 : -1) : b.facing;
    const speed = Math.abs(b.vx) / Math.max(1, game.player.stats.boatSpeed);
    // the waterline centre rides the mean of bow & stern; squats a little at speed, sinks under a giant
    const yT = (hb + hs) * 0.5 + speed * 4 + (tow.y || 0);
    // hull follows the wave slope; bow lifts under acceleration, dips when braking; heels toward a big fish
    let tiltT = b.facing * Math.atan2(hb - hs, HULL * 0.8) * 0.85;
    tiltT += -b.facing * clamp(accel / ACCEL, -1, 1) * 0.07;
    tiltT += side * 0.11 * clamp01(tow.pull || 0);
    // spring/damper — stiffer and less damped in a big sea so the hull gets lively, heavy in a calm one
    const live = clamp01((sea - 0.6) / 1.5);
    const ky = lerp(26, 52, live), zy = lerp(0.62, 0.4, live);
    const kt = lerp(34, 60, live), zt = lerp(0.6, 0.42, live);
    vy += (ky * (yT - b.y) - 2 * zy * Math.sqrt(ky) * vy) * dt;
    b.y += vy * dt;
    tiltV += (kt * (tiltT - b.tilt) - 2 * zt * Math.sqrt(kt) * tiltV) * dt;
    b.tilt += tiltV * dt;
  }

  // ── rod & angler ───────────────────────────────────────────────────────────
  /** Pick the pose and the rod targets for this frame. Returns [angleTarget, bendTarget, kAngle, zetaAngle]. */
  function pose(dt) {
    const st = f.state, t = f.stateT, now = game.time.now;
    const hooked = f.hooked;
    const heavy = hooked ? clamp01((hooked.visualLen - 70) / 320) : 0;
    const tug = f.tug || 0;
    const ten = clamp(f.tension, 0, 1.3);
    if (st !== lastState) {
      if (st === 'fight' && lastState === 'bite') strikeT = 0;
      lastState = st;
    }
    strikeT += dt;
    let angle = REST_ANGLE.idle, bend = 0.03, k = 90, z = 0.75;
    const breathe = Math.sin(now * 1.1) * 0.02;
    switch (st) {
      case 'idle':
        setPose('idle');
        angle = REST_ANGLE.idle + breathe;
        bend = 0.03 + Math.abs(tiltV) * 0.06;
        break;
      case 'charging':
        // wind-up: the rod follows the charge meter back over the shoulder, so the pose reads as power
        setPose('charge');
        angle = lerp(1.05, 2.2, ease.outQuad(clamp01(f.charge)));
        bend = 0.06 + 0.06 * clamp01(f.charge);
        k = 160;
        z = 0.85;
        break;
      case 'casting': {
        // the whip: a fast forward snap with overshoot, the blank loads then unloads as the lure leaves
        setPose('cast');
        const w = clamp01(t / 0.17);
        angle = lerp(2.2, 0.42, ease.outCubic(w));
        if (t > 0.17) angle = lerp(0.42, 0.72, smoothstep(0.17, 0.9, t));
        bend = 0.6 * Math.sin(Math.min(1, t / 0.24) * Math.PI) + 0.04;
        k = 420;
        z = 0.5;
        break;
      }
      case 'waiting': {
        const reel = f.reeling;
        setPose(reel ? 'reel' : 'wait');
        angle = (reel ? REST_ANGLE.reel : REST_ANGLE.wait) + breathe * 0.6;
        // crank bob while reeling, drag of the lure, bottom bumps and twitch impulses dip the tip
        bend = 0.05 + (reel ? 0.12 + 0.035 * Math.sin(now * 9) : 0) + 0.08 * clamp01(f.line.slack < 0.15 ? 0.6 : 0) + tug * 0.32;
        break;
      }
      case 'bite':
        setPose('wait');
        angle = REST_ANGLE.wait - 0.05;
        bend = 0.2 + tug * 0.4;
        k = 140;
        z = 0.55;
        break;
      case 'fight': {
        if (strikeT < STRIKE_T) {
          setPose('strike');
          angle = 1.62;
          bend = 0.5;
          k = 300;
          z = 0.6;
        } else {
          setPose('fight');
          const mode = f.fight.mode;
          // pump-and-wind: against a heavy fish the rod lifts, then drops as the reel takes the line
          const pump = f.reeling ? Math.sin(now * (2 * Math.PI) * lerp(1.5, 0.8, heavy)) * lerp(0.03, 0.17, heavy) : 0;
          angle = REST_ANGLE.fight + (1 - ten) * 0.22 + pump + (mode === 'jump' ? -0.18 : 0);
          bend = clamp(ten, 0.08, 1.1) + tug * 0.2;
          if (mode === 'thrash') bend += Math.sin(now * 34) * 0.07;
          if (mode === 'run') bend += 0.04 * Math.sin(now * 21);
          k = 70;
          z = 0.7;
        }
        break;
      }
      case 'landing':
        setPose('lift');
        angle = lerp(1.25, REST_ANGLE.lift, smoothstep(0, 0.7, t));
        bend = lerp(0.45, 0.14 + heavy * 0.25, smoothstep(0, 1.0, t));
        k = 60;
        z = 0.8;
        break;
      case 'caught':
        setPose('celebrate');
        angle = REST_ANGLE.celebrate + breathe;
        bend = 0.06 + heavy * 0.1;
        break;
      case 'broken':
        // the line parts: the rod flings back straight, then slumps
        setPose('sad');
        angle = t < 0.2 ? 1.85 : REST_ANGLE.sad;
        bend = 0;
        k = t < 0.2 ? 380 : 50;
        z = t < 0.2 ? 0.35 : 0.9;
        break;
      default:
        setPose('idle');
    }
    return [angle, bend, k, z];
  }

  function rod(dt) {
    const [angleT, bendT, k, z] = pose(dt);
    // the rod is a spring in the angler's hands: quick, slightly underdamped, so changes feel physical
    rodV += (k * (angleT - b.rodAngle) - 2 * z * Math.sqrt(k) * rodV) * dt;
    b.rodAngle += rodV * dt;
    const kb = 230, zb = 0.5;
    bendV += (kb * (bendT - b.rodBend) - 2 * zb * Math.sqrt(kb) * bendV) * dt;
    b.rodBend = clamp(b.rodBend + bendV * dt, 0, 1.2);
    b.poseT += dt;
  }

  function update(dt) {
    if (dt <= 0) return;
    sail(dt);
    float(dt);
    rod(dt);
    b.tier = game.player.boatTier || 0;
    b.lamp = (game.player.stats.lamp || 0) > 0 && game.env.night > 0.5;
  }

  return { update };
}
