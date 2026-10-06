// The angler: a procedural, pose-blended character who always holds the rod at RIG.grip. BOAT ART module.
//
// The body is solved AROUND the fixed grip: each pose asks for a torso lean, a crouch and a comfortable arm
// extension, and the hip is placed so the shoulder sits at that reach from the grip. Arms and legs are
// two-bone IK. Every parameter is damped toward its pose target, so poses blend smoothly.
// Everything is in boat-local space (+x = toward the bow, −y = up).
import { clamp, clamp01, damp, lerp, smoothstep, TAU } from '../../core/math.js';
import { RIG } from '../../entities/rig.js';
import { ik2, capsule, shade, css, rgbOf } from './util.js';

// ── proportions (local px) ─────────────────────────────────────────────────
const THIGH = 36, SHIN = 36;
const TORSO = 47;
const UPPER = 27, FORE = 29; // FORE reaches the palm centre
const ARM = UPPER + FORE;
const NECK = 6;
const HEAD_K = 1.17; // a slightly big head reads better (and is more charming) at game scale

// ── outfits ────────────────────────────────────────────────────────────────
const SKIN = '#e9b28c', SKIN_SH = '#c4805c', BLUSH = '#e47a66', NOSE = '#ec9a7c';
const HAIR = '#8f4f2b', HAIR_HI = '#c27a45';
const OUTFITS = {
  sun: { shirt: '#6f93b8', sleeveRoll: true, vest: '#f2792b', pants: '#8d7f5a', hat: 'straw', coat: null },
  night: { shirt: '#2f456b', sleeveRoll: false, vest: '#f2792b', pants: '#5d5848', hat: 'beanie', coat: null },
  rain: { shirt: '#f2c230', sleeveRoll: false, vest: null, pants: '#3d5a4a', hat: 'souwester', coat: '#f2c230' },
};

const POSES = ['idle', 'charge', 'cast', 'wait', 'reel', 'strike', 'fight', 'lift', 'celebrate', 'sad'];
// how quickly each pose pulls the body toward its targets (1/s)
const STIFF = { idle: 3.2, charge: 7, cast: 16, wait: 3, reel: 6, strike: 24, fight: 7, lift: 6, celebrate: 8, sad: 3.5 };

export function createAngler(game) {
  const rng = game.rng.fork();
  // ── animated state ──
  const S = {
    lean: 0.04, crouch: 0.08, reach: 0.8, stance: 0, hipDY: 0,
    headPitch: 0, headTilt: 0, shrug: 0,
    wCrank: 0, wFore: 0, freeX: 60, freeY: -60,
    smile: 0.3, open: 0, brow: 0, squint: 0, sad: 0, grit: 0, joy: 0,
    blink: 0, tremble: 0, red: 0,
    mug: 0, // 0..1 mug visible in the free hand
  };
  const T = { lean: 0, crouch: 0, reach: 0.8, stance: 0, hipDY: 0, headPitch: 0, headTilt: 0, shrug: 0, wCrank: 0, wFore: 0,
    freeX: 0, freeY: 0, freeK: 8, smile: 0, open: 0, brow: 0, squint: 0, sad: 0, grit: 0, joy: 0, tremble: 0, red: 0, mug: 0,
    lookX: 0, lookY: 0, lookW: 0 };

  let t = 0;
  let blinkT = 2.5;
  let fidget = null, fidgetT = 0, nextFidget = 3.5;
  let lookPhaseT = 0, lookIdx = 0;
  let lastPose = 'idle';
  let outfit = OUTFITS.sun;
  let rainOn = false;
  const sweat = []; // {x,y,vx,vy,life}
  for (let i = 0; i < 6; i++) sweat.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  let sweatT = 0;

  // ── solved skeleton (reused every frame) ──
  const J = {
    hipX: 0, hipY: 0, shX: 0, shY: 0, neckX: 0, neckY: 0, headX: 0, headY: 0, headA: 0,
    footBX: 0, footBY: 0, footFX: 0, footFY: 0, kneeBX: 0, kneeBY: 0, kneeFX: 0, kneeFY: 0,
    elbFX: 0, elbFY: 0, handFX: 0, handFY: 0, // far arm (rod hand)
    elbNX: 0, elbNY: 0, handNX: 0, handNY: 0, // near arm (free / crank hand)
    lean: 0,
  };
  const tmp = { jx: 0, jy: 0, ex: 0, ey: 0 };

  function pickFidget(pose) {
    const night = game.env.night > 0.6, rain = rainOn;
    const opts = pose === 'wait'
      ? ['feel', 'feel', 'sip', 'hat', 'beard', 'look']
      : ['hat', 'look', 'shade', 'beard', 'sip', 'stretch'];
    let f = opts[(rng.next() * opts.length) | 0];
    if ((night || rain) && f === 'shade') f = 'look';
    if (rain && f === 'sip') f = 'beard';
    return f;
  }

  /**
   * Advance the animation. `I` = per-frame inputs from boatart:
   *  { pose, poseT, floorY, gripX, gripY, ux, uy (rod direction at grip, local), reelX, reelY, knobX, knobY,
   *    lookX, lookY, lookOn (0..1), trophyX, trophyY, tilt, accel, rain, night, tension, reeling, reelRate, charge,
   *    biteAlert (0..1), fightMode }
   */
  function update(dt, I) {
    t += dt;
    const pose = POSES.includes(I.pose) ? I.pose : 'idle';
    if (pose !== lastPose) {
      lastPose = pose;
      if (pose !== 'idle' && pose !== 'wait') fidget = null;
    }
    // outfit with hysteresis
    if (!rainOn && I.rain > 0.32) rainOn = true;
    else if (rainOn && I.rain < 0.18) rainOn = false;
    outfit = rainOn ? OUTFITS.rain : I.night > 0.55 ? OUTFITS.night : OUTFITS.sun;

    const pT = I.poseT;
    const breath = Math.sin(t * 1.55);
    // defaults
    T.lean = 0.04; T.crouch = 0.07; T.reach = 0.8; T.stance = 0; T.hipDY = 0;
    T.headPitch = 0; T.headTilt = 0; T.shrug = 0;
    T.wCrank = 0; T.wFore = 0; T.freeK = 7;
    T.smile = 0.35; T.open = 0; T.brow = 0; T.squint = 0; T.sad = 0; T.grit = 0; T.joy = 0; T.tremble = 0; T.red = 0; T.mug = 0;
    T.lookX = I.lookX; T.lookY = I.lookY; T.lookW = I.lookOn;
    // free hand resting on the hip by default (set after the hip is known → use last frame's hip)
    let freeMode = 'hip';

    if (pose === 'idle' || pose === 'wait') {
      T.lean = 0.03 + 0.025 * Math.sin(t * 0.37);
      T.crouch = 0.06 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.29 + 1));
      T.stance = 2 * Math.sin(t * 0.21);
      T.smile = 0.4;
      // look around when idle (no line out)
      if (pose === 'idle') {
        lookPhaseT -= dt;
        if (lookPhaseT <= 0) {
          lookPhaseT = 2.2 + rng.next() * 3.5;
          lookIdx = (rng.next() * 5) | 0;
        }
        const looks = [0, -0.32, 0.22, -0.12, 0.08];
        T.headPitch = looks[lookIdx];
        T.lookW = 0;
      } else {
        T.lookW = 0.75;
      }
      // fidgets with the free hand
      nextFidget -= dt;
      if (!fidget && nextFidget <= 0) {
        fidget = pickFidget(pose);
        fidgetT = 0;
      }
      if (fidget) {
        fidgetT += dt;
        const dur = fidget === 'sip' ? 3.6 : fidget === 'feel' ? 3.2 : fidget === 'stretch' ? 2.6 : 2.2;
        const env = smoothstep(0, 0.45, fidgetT) * (1 - smoothstep(dur - 0.5, dur, fidgetT));
        if (fidgetT >= dur) {
          fidget = null;
          nextFidget = 3 + rng.next() * 5;
        } else if (env > 0.02) {
          freeMode = fidget;
          if (fidget === 'sip') {
            T.mug = 1;
            const sipping = fidgetT > 1 && fidgetT < 2.4;
            T.headPitch = sipping ? -0.28 : 0;
            T.lookW = sipping ? 0 : T.lookW;
            T.smile = sipping ? 0.1 : 0.5;
            T.squint = sipping ? 0.6 : 0;
          } else if (fidget === 'feel') {
            T.lean += 0.05 * env;
            T.brow = 0.3 * env;
            T.lookW = 1;
          } else if (fidget === 'shade') {
            T.headPitch = -0.08;
            T.lookW = 0;
            T.squint = 0.5;
          } else if (fidget === 'stretch') {
            T.headPitch = -0.35 * env;
            T.open = fidgetT > 0.6 && fidgetT < 1.9 ? 0.85 : 0; // yawn
            T.squint = T.open;
            T.lookW = 0;
          } else if (fidget === 'look') {
            freeMode = 'hip';
            T.headPitch = 0.3 * Math.sin(fidgetT * 1.4);
            T.lookW = 0;
          } else if (fidget === 'beard') {
            T.headPitch = -0.1;
            T.smile = 0.2;
            T.brow = 0.35;
          }
        }
      }
    } else if (pose === 'charge') {
      const c = clamp01(I.charge);
      T.lean = -0.04 - 0.26 * c;
      T.crouch = 0.12 + 0.22 * c;
      T.stance = 6 * c;
      T.reach = 0.84;
      freeMode = 'aim';
      T.headPitch = -0.08 - 0.06 * c;
      T.lookW = 0;
      T.brow = -0.5 * c;
      T.squint = 0.35 * c;
      T.smile = 0.25;
      T.tremble = c > 0.92 ? 0.35 : 0;
      T.freeK = 9;
    } else if (pose === 'cast') {
      const whip = pT < 0.32;
      T.lean = whip ? 0.34 : 0.1;
      T.crouch = whip ? 0.26 : 0.12;
      T.stance = 8;
      T.reach = 0.86;
      freeMode = pT < 0.55 ? 'throw' : 'hip';
      T.open = pT < 0.35 ? 0.7 : 0;
      T.brow = pT < 0.35 ? -0.5 : 0.25;
      T.smile = pT < 0.35 ? 0 : 0.45;
      T.lookW = pT < 0.2 ? 0 : 0.9;
      T.freeK = 14;
    } else if (pose === 'reel') {
      T.lean = 0.1;
      T.crouch = 0.12;
      T.stance = 4;
      T.wCrank = 1;
      freeMode = 'crank';
      T.lookW = 0.85;
      T.brow = -0.2;
      T.smile = 0.25;
    } else if (pose === 'strike') {
      T.lean = pT < 0.5 ? -0.42 : -0.22;
      T.crouch = 0.34;
      T.stance = 10;
      T.wFore = 1;
      freeMode = 'fore';
      T.open = pT < 0.45 ? 0.75 : 0.3;
      T.brow = 0.6;
      T.squint = 0;
      T.smile = 0;
      T.lookW = 1;
      T.headPitch = -0.1;
    } else if (pose === 'fight') {
      const ten = clamp(I.tension, 0, 1.2);
      const running = I.fightMode === 'run' || I.fightMode === 'dive';
      T.lean = -0.1 - 0.3 * Math.min(1, ten) - (running ? 0.05 : 0);
      T.crouch = 0.22 + 0.36 * Math.min(1, ten);
      T.stance = 9 + 9 * Math.min(1, ten);
      T.reach = 0.8;
      if (I.reeling) {
        T.wCrank = 1;
        freeMode = 'crank';
      } else {
        T.wFore = 1;
        freeMode = 'fore';
      }
      T.lookW = 1;
      T.brow = -0.55 - 0.2 * ten;
      T.squint = 0.25 + 0.4 * Math.min(1, ten);
      T.grit = ten > 0.55 ? 1 : 0;
      T.open = ten > 0.55 ? 0.35 : 0;
      T.smile = ten < 0.4 ? 0.2 : 0;
      T.tremble = Math.max(0, ten - 0.68) * 2.2;
      T.red = clamp01((ten - 0.6) * 2);
    } else if (pose === 'lift') {
      T.lean = -0.18;
      T.crouch = 0.26;
      T.stance = 10;
      freeMode = 'trophy';
      T.lookW = 1;
      T.lookX = I.trophyX;
      T.lookY = I.trophyY;
      T.brow = 0.3;
      T.open = 0.3;
      T.smile = 0.6;
      T.freeK = 6;
    } else if (pose === 'celebrate') {
      const hop = pT < 1.3 ? Math.abs(Math.sin(pT * 7.5)) * (1 - pT / 1.3) : 0;
      T.lean = -0.07 + 0.04 * Math.sin(t * 2.2);
      T.crouch = 0.1 + 0.28 * hop;
      T.hipDY = 0;
      T.stance = 6;
      freeMode = 'trophy';
      T.lookW = 1;
      T.lookX = I.trophyX;
      T.lookY = I.trophyY;
      T.joy = 1;
      T.smile = 1;
      T.open = 0.75;
      T.brow = 0.55;
      T.freeK = 7;
    } else if (pose === 'sad') {
      T.lean = 0.2;
      T.crouch = 0.14;
      T.shrug = -3;
      T.headPitch = 0.42 + (pT > 1.4 && pT < 2.6 ? 0.08 * Math.sin((pT - 1.4) * 15) : 0);
      T.headTilt = pT > 1.4 && pT < 2.6 ? 0.12 * Math.sin((pT - 1.4) * 9) : 0.05;
      T.lookW = 0;
      freeMode = 'hang';
      T.sad = 1;
      T.smile = -0.8;
      T.brow = 0.4;
      T.squint = 0.25;
      T.freeK = 3;
    }

    // bite alert: everyone notices!
    if (I.biteAlert > 0 && pose !== 'fight' && pose !== 'strike') {
      T.brow = Math.max(T.brow, 0.7 * I.biteAlert);
      T.open = Math.max(T.open, 0.45 * I.biteAlert);
      T.lean += 0.05 * I.biteAlert;
      T.lookW = 1;
    }
    // stay upright in WORLD space while the hull rocks, and lean into accelerations
    T.lean -= I.tilt * 0.75;
    T.lean -= clamp(I.accel * 0.00035, -0.12, 0.12);
    // breathing
    T.shrug += breath * 0.6;

    // ── damp toward targets ──
    const k = STIFF[pose] || 4;
    S.lean = damp(S.lean, T.lean, k, dt);
    S.crouch = damp(S.crouch, T.crouch, k, dt);
    S.reach = damp(S.reach, T.reach, k, dt);
    S.stance = damp(S.stance, T.stance, k * 0.8, dt);
    S.hipDY = damp(S.hipDY, T.hipDY, k, dt);
    S.shrug = damp(S.shrug, T.shrug, 4, dt);
    S.headTilt = damp(S.headTilt, T.headTilt, 6, dt);
    S.wCrank = damp(S.wCrank, T.wCrank, 9, dt);
    S.wFore = damp(S.wFore, T.wFore, 9, dt);
    const fk = 7;
    S.smile = damp(S.smile, T.smile, fk, dt);
    S.open = damp(S.open, T.open, 12, dt);
    S.brow = damp(S.brow, T.brow, fk, dt);
    S.squint = damp(S.squint, T.squint, fk, dt);
    S.sad = damp(S.sad, T.sad, 4, dt);
    S.grit = damp(S.grit, T.grit, 10, dt);
    S.joy = damp(S.joy, T.joy, 6, dt);
    S.tremble = damp(S.tremble, T.tremble, 6, dt);
    S.red = damp(S.red, T.red, 1.5, dt);
    S.mug = damp(S.mug, T.mug, 8, dt);

    // blink
    blinkT -= dt;
    if (blinkT <= 0) {
      blinkT = 2 + rng.next() * 3.5;
      if (rng.next() < 0.2) blinkT = 0.25; // double blink
    }
    S.blink = blinkT < 0.13 ? Math.sin((blinkT / 0.13) * Math.PI) : 0;

    // ── solve the skeleton ──
    solve(I, freeMode, dt);

    // sweat drops when straining hard
    sweatT -= dt;
    if (S.red > 0.55 && sweatT <= 0) {
      sweatT = 0.35 + rng.next() * 0.4;
      const d = sweat.find((s) => s.life <= 0);
      if (d) {
        d.x = J.headX - 6 + rng.next() * 6;
        d.y = J.headY - 10;
        d.vx = -20 - rng.next() * 30;
        d.vy = -30 - rng.next() * 30;
        d.life = 0.7;
      }
    }
    for (const d of sweat) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy += 260 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
  }

  function solve(I, freeMode, dt) {
    const gx = I.gripX, gy = I.gripY;
    const lean = S.lean + (S.tremble > 0.01 ? Math.sin(t * 47) * 0.012 * S.tremble : 0);
    J.lean = lean;
    const legReach = 71 - 24 * S.crouch;
    const hipY = I.floorY - legReach + S.hipDY;
    const sl = Math.sin(lean), cl = Math.cos(lean);
    // place the hip so the shoulder is `reach` × arm length from the grip
    const shY = hipY - TORSO * cl - S.shrug * 0.4;
    const r = S.reach * ARM;
    const dy = shY - gy;
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
    let shX = gx - dx;
    let hipX = shX - TORSO * sl;
    // keep the hips inside the boat-ish region (the grip is fixed, so this only bites in extreme poses)
    hipX = clamp(hipX, gx - 70, gx - 8);
    shX = hipX + TORSO * sl;
    J.hipX = hipX;
    J.hipY = hipY;
    J.shX = shX;
    J.shY = shY;
    // neck & head
    J.neckX = shX + Math.sin(lean) * NECK + 1.5;
    J.neckY = shY - Math.cos(lean) * NECK;
    // head pitch: look at the target (lure / fish) when asked
    let pitch = 0;
    const hx0 = J.neckX + 3, hy0 = J.neckY - 13;
    if (T.lookW > 0.01) {
      const la = Math.atan2(T.lookY - hy0, Math.max(8, T.lookX - hx0));
      pitch = clamp(la * 0.55, -0.45, 0.55);
    }
    const pitchTarget = lerp(T.headPitch, pitch, clamp01(T.lookW)) + T.headPitch * (T.lookW > 0 ? 0.3 : 0);
    S.headPitch = damp(S.headPitch, clamp(pitchTarget, -0.55, 0.6), 5, dt);
    J.headA = S.headPitch + S.headTilt + lean * 0.35;
    J.headX = J.neckX + Math.sin(lean * 0.6) * 15 + 2 + Math.sin(J.headA) * 2;
    J.headY = J.neckY - Math.cos(lean * 0.6) * 15;

    // legs: feet planted under the hip (hidden behind the hull side anyway)
    J.footBX = hipX - 13 - S.stance * 0.5;
    J.footFX = hipX + 17 + S.stance * 0.6;
    J.footBY = J.footFY = I.floorY;
    ik2(hipX - 2, hipY, J.footBX, J.footBY, THIGH, SHIN, -1, tmp);
    J.kneeBX = tmp.jx;
    J.kneeBY = tmp.jy;
    ik2(hipX + 2, hipY, J.footFX, J.footFY, THIGH, SHIN, -1, tmp);
    J.kneeFX = tmp.jx;
    J.kneeFY = tmp.jy;

    // far arm → rod hand at the grip
    ik2(shX - 1, shY + 1, gx, gy, UPPER, FORE, 1, tmp);
    J.elbFX = tmp.jx;
    J.elbFY = tmp.jy;
    J.handFX = gx;
    J.handFY = gy;

    // near arm → crank knob / fore grip / free gesture
    let fx, fy;
    const hx = J.headX, hy = J.headY;
    switch (freeMode) {
      case 'aim': fx = shX + 40; fy = shY - 12 - 6 * Math.sin(t * 2); break;
      case 'throw': fx = shX - 26; fy = shY + 22; break;
      case 'trophy': fx = I.trophyX - 1; fy = I.trophyY + 9; break; // grabs the fish just under the gills
      case 'hang': fx = shX + 4; fy = shY + 50; break;
      case 'hat': fx = hx + 13; fy = hy - 11; break;
      case 'sip': fx = hx + 13; fy = hy + (S.mug > 0.5 && fidgetT > 1 && fidgetT < 2.4 ? 4 : 18); break;
      case 'beard': fx = hx + 9 + Math.sin(t * 9) * 1.5; fy = hy + 10; break;
      case 'shade': fx = hx + 14; fy = hy - 5; break;
      case 'stretch': fx = shX - 10; fy = shY - 46; break;
      case 'feel': fx = gx + I.ux * 26 + (-I.uy) * 3; fy = gy + I.uy * 26 + I.ux * 3; break;
      default: // 'hip' (and attached modes fall back to it)
        fx = hipX + 2 + Math.sin(lean) * -12;
        fy = hipY - 10;
    }
    if (S.freeX === 60 && S.freeY === -60) {
      S.freeX = fx;
      S.freeY = fy;
    }
    S.freeX = damp(S.freeX, fx, T.freeK, dt);
    S.freeY = damp(S.freeY, fy, T.freeK, dt);
    const wc = clamp01(S.wCrank), wf = clamp01(S.wFore) * (1 - wc);
    const wfree = Math.max(0, 1 - wc - wf);
    const foreX = gx + I.ux * 17, foreY = gy + I.uy * 17;
    let nx = S.freeX * wfree + I.knobX * wc + foreX * wf;
    let ny = S.freeY * wfree + I.knobY * wc + foreY * wf;
    const sx = shX + 1.5, sy = shY + 0.5;
    // hip rest: elbow out the back
    const bendN = freeMode === 'hip' || freeMode === 'hang' ? 1 : 1;
    ik2(sx, sy, nx, ny, UPPER, FORE, bendN, tmp);
    J.elbNX = tmp.jx;
    J.elbNY = tmp.jy;
    // attached hands must sit exactly on the target (the forearm stretches a hair if needed)
    if (wc + wf > 0.5) {
      J.handNX = nx;
      J.handNY = ny;
    } else {
      J.handNX = tmp.ex;
      J.handNY = tmp.ey;
    }
    J.freeMode = freeMode;
    J.wAttached = wc + wf;
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  // Split into passes so boatart can interleave the rod & reel:  drawBack → (rod) → drawFarHand → drawBody → (reel) → drawNearArm
  function limb(ctx, ax, ay, bx, by, ra, rb, fill, edge) {
    ctx.beginPath();
    capsule(ctx, ax, ay, bx, by, ra, rb);
    ctx.fillStyle = fill;
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }

  function drawFarArm(ctx) {
    const o = outfit;
    const sleeve = o.coat || o.shirt;
    // upper arm (mostly hidden behind the torso)
    limb(ctx, J.shX - 1, J.shY + 2, J.elbFX, J.elbFY, 6.4, 5.2, shade(sleeve, -0.28), null);
    if (o.sleeveRoll) {
      // rolled sleeve then bare forearm
      const mx = lerp(J.elbFX, J.handFX, 0.18), my = lerp(J.elbFY, J.handFY, 0.18);
      limb(ctx, J.elbFX, J.elbFY, J.handFX, J.handFY, 4.5, 3.6, shade(SKIN, -0.22), null);
      limb(ctx, J.elbFX, J.elbFY, mx, my, 6.0, 5.6, shade(sleeve, -0.18), null);
    } else {
      limb(ctx, J.elbFX, J.elbFY, J.handFX, J.handFY, 4.7, 4.0, shade(sleeve, -0.26), null);
    }
  }

  /** The rod hand: a fist wrapped around the rod at the grip. (ux,uy) = rod direction. */
  function drawFarHand(ctx, ux, uy) {
    const x = J.handFX, y = J.handFY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(uy, ux));
    // fist: long axis along the rod
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 5.4, 4.6, 0, 0, TAU);
    ctx.fillStyle = shade(SKIN, -0.12);
    ctx.fill();
    ctx.fillStyle = shade(SKIN, 0.12);
    ctx.beginPath();
    ctx.ellipse(-0.5, -1.4, 3.6, 2.2, 0, 0, TAU);
    ctx.fill();
    // finger creases
    ctx.strokeStyle = shade(SKIN_SH, -0.25, 0.55);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(i * 2.3, 1.2);
      ctx.lineTo(i * 2.3 + 0.4, 4.6);
    }
    ctx.stroke();
    // thumb over the top
    ctx.fillStyle = shade(SKIN, 0.04);
    ctx.beginPath();
    ctx.ellipse(3.6, -2.6, 3.0, 1.7, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawLegs(ctx, near) {
    const o = outfit;
    const pants = o.pants;
    if (!near) {
      limb(ctx, J.kneeBX, J.kneeBY, J.footBX, J.footBY - 3, 5.6, 4.6, shade(pants, -0.35), null);
      limb(ctx, J.hipX - 2, J.hipY, J.kneeBX, J.kneeBY, 8.6, 6.4, shade(pants, -0.3), null);
    } else {
      limb(ctx, J.kneeFX, J.kneeFY, J.footFX, J.footFY - 3, 5.8, 4.8, shade(pants, -0.08), null);
      const g = ctx.createLinearGradient(J.hipX, J.hipY - 8, J.kneeFX, J.kneeFY + 8);
      g.addColorStop(0, shade(pants, 0.08));
      g.addColorStop(1, shade(pants, -0.12));
      limb(ctx, J.hipX + 2, J.hipY - 1, J.kneeFX, J.kneeFY, 9.2, 6.6, g, shade(pants, -0.35, 0.6));
      // trouser crease highlight
      ctx.strokeStyle = shade(pants, 0.25, 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(lerp(J.hipX, J.kneeFX, 0.25) + 2, lerp(J.hipY, J.kneeFY, 0.25) - 4);
      ctx.lineTo(lerp(J.hipX, J.kneeFX, 0.9) + 2, lerp(J.hipY, J.kneeFY, 0.9) - 4);
      ctx.stroke();
    }
  }

  /** Torso (+ vest / coat) drawn in the torso frame: origin = hip, +x forward, −y up along the spine. */
  function drawTorso(ctx) {
    const o = outfit;
    ctx.save();
    ctx.translate(J.hipX, J.hipY);
    ctx.rotate(J.lean);
    ctx.scale(1.12, 1);
    const br = Math.sin(t * 1.55) * 0.6; // breathing: chest swells
    const top = -TORSO;
    // trousers seat / hips
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.bezierCurveTo(-15, 0, -14, 7, -8, 9);
    ctx.lineTo(9, 9);
    ctx.bezierCurveTo(13, 5, 13, -2, 11, -6);
    ctx.closePath();
    ctx.fillStyle = shade(o.pants, -0.05);
    ctx.fill();
    // shirt / coat body
    const body = o.coat || o.shirt;
    const gb = ctx.createLinearGradient(-15, 0, 16, 0);
    gb.addColorStop(0, shade(body, -0.3));
    gb.addColorStop(0.55, shade(body, 0.02));
    gb.addColorStop(1, shade(body, -0.12));
    ctx.beginPath();
    ctx.moveTo(-12, o.coat ? 8 : -3);
    ctx.bezierCurveTo(-16, -12, -16.5, -28, -13.5, top + 5);
    ctx.bezierCurveTo(-11, top - 1, -4, top - 2, 0, top - 1.5);
    ctx.bezierCurveTo(6, top - 1, 9, top + 2, 11 + br * 0.3, top + 9);
    ctx.bezierCurveTo(15 + br, -26, 16.5 + br * 0.5, -14, 14, -6);
    ctx.bezierCurveTo(13, o.coat ? 4 : -2, 11, o.coat ? 9 : -3, 9, o.coat ? 9 : -3);
    ctx.closePath();
    ctx.fillStyle = gb;
    ctx.fill();
    ctx.strokeStyle = shade(body, -0.42, 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (o.coat) {
      // raincoat: placket, toggles, a hood bunched on the back
      ctx.strokeStyle = shade(body, -0.35, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(13.5, top + 10);
      ctx.bezierCurveTo(16, -24, 15.5, -10, 13, 6);
      ctx.stroke();
      ctx.fillStyle = shade(body, -0.5);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(13.6 + (i === 1 ? 1.5 : 0.5), top + 15 + i * 10, 1.5, 0.9, 0.3, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = shade(body, -0.15);
      ctx.beginPath();
      ctx.ellipse(-11, top + 6, 6, 4.5, -0.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = shade(body, -0.4, 0.6);
      ctx.stroke();
      // shine on the oilskin
      ctx.strokeStyle = 'rgba(255,255,240,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, top + 12);
      ctx.quadraticCurveTo(-11, -20, -9, -8);
      ctx.stroke();
    } else {
      // belt
      ctx.fillStyle = '#3a2c22';
      ctx.fillRect(-13, -7.5, 26, 3);
      // the life vest
      const v = o.vest;
      const gv = ctx.createLinearGradient(-17, 0, 18, 0);
      gv.addColorStop(0, shade(v, -0.32));
      gv.addColorStop(0.5, shade(v, 0.06));
      gv.addColorStop(0.85, shade(v, -0.02));
      gv.addColorStop(1, shade(v, -0.2));
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.bezierCurveTo(-18, -16, -18, -30, -14.5, top + 7);
      ctx.bezierCurveTo(-12.5, top + 1.5, -8.5, top + 1, -6, top + 3);
      ctx.lineTo(-3, top + 8);
      ctx.bezierCurveTo(1, top + 9, 4, top + 7, 6, top + 3);
      ctx.bezierCurveTo(10, top + 4, 13, top + 8, 14 + br * 0.4, top + 14);
      ctx.bezierCurveTo(18 + br, -27, 18.5 + br * 0.5, -14, 16, -5);
      ctx.bezierCurveTo(9, -3, -6, -3, -14, -5);
      ctx.closePath();
      ctx.fillStyle = gv;
      ctx.fill();
      ctx.strokeStyle = shade(v, -0.45, 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // foam panel seams
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = shade(v, -0.35, 0.55);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const sx of [-7, 1, 9]) {
        ctx.moveTo(sx, top + 9);
        ctx.quadraticCurveTo(sx + 2.5, -22, sx + 1, -4);
      }
      ctx.stroke();
      // reflective tape across the shoulder
      ctx.fillStyle = 'rgba(232,240,246,0.9)';
      ctx.beginPath();
      ctx.moveTo(-15, top + 12);
      ctx.lineTo(-3, top + 13.5);
      ctx.lineTo(-3, top + 16);
      ctx.lineTo(-15.5, top + 14.5);
      ctx.closePath();
      ctx.fill();
      // strap + buckle across the belly
      ctx.fillStyle = '#2b323d';
      ctx.fillRect(-18, -16, 40, 3.2);
      ctx.fillStyle = '#11151b';
      ctx.fillRect(9, -17, 5, 5.2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(9.5, -16.6, 4, 1);
      ctx.restore();
      // collar of the shirt
      ctx.fillStyle = shade(o.shirt, 0.08);
      ctx.beginPath();
      ctx.moveTo(-5, top + 2);
      ctx.lineTo(1, top + 7);
      ctx.lineTo(6.5, top + 2.5);
      ctx.lineTo(1.5, top - 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHead(ctx) {
    const o = outfit;
    ctx.save();
    ctx.translate(J.headX, J.headY);
    ctx.rotate(J.headA);
    ctx.scale(HEAD_K, HEAD_K);
    // neck
    ctx.fillStyle = shade(SKIN, -0.2);
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.lineTo(-5, 16);
    ctx.lineTo(5, 16);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.fill();
    // hair at the back of the head (below the hat)
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.ellipse(-3.5, -1, 9.2, 10.5, 0, 0, TAU);
    ctx.fill();
    // skull + face
    const gs = ctx.createRadialGradient(4, -4, 2, 0, 0, 14);
    gs.addColorStop(0, shade(SKIN, 0.12));
    gs.addColorStop(0.7, SKIN);
    gs.addColorStop(1, shade(SKIN, -0.18));
    ctx.fillStyle = gs;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.bezierCurveTo(-1, -13, 8, -12, 10, -6); // forehead
    ctx.bezierCurveTo(10.8, -3.8, 10.2, -2.6, 10.6, -1.2); // brow → eye
    ctx.lineTo(11.2, 1.8); // nose bridge (the nose is drawn separately)
    ctx.bezierCurveTo(11.6, 4, 11.2, 6, 11, 7.2); // upper lip
    ctx.bezierCurveTo(11.2, 9, 10.8, 11.2, 8.6, 12.2); // chin
    ctx.bezierCurveTo(5, 13.6, 0, 12.4, -3.5, 9); // jaw
    ctx.bezierCurveTo(-7, 5.5, -9, -4, -6, -9);
    ctx.closePath();
    ctx.fill();
    // blush (more when straining)
    ctx.fillStyle = css(...rgbOf(BLUSH), 0.28 + 0.4 * S.red);
    ctx.beginPath();
    ctx.ellipse(4.5, 4.2, 3.6, 2.4, 0, 0, TAU);
    ctx.fill();
    if (S.red > 0.05) {
      ctx.fillStyle = `rgba(214,70,50,${0.22 * S.red})`;
      ctx.beginPath();
      ctx.ellipse(2, -1, 9, 9, 0, 0, TAU);
      ctx.fill();
    }
    // ear
    ctx.fillStyle = shade(SKIN, -0.08);
    ctx.beginPath();
    ctx.ellipse(-2.2, 1.6, 2.6, 3.5, 0.15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(SKIN_SH, -0.2, 0.7);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(-2.0, 1.6, 1.5, -1.2, 1.9);
    ctx.stroke();
    // beard: jaw + chin
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(-1.6, 4.6);
    ctx.bezierCurveTo(0, 8.8, 4, 9.4, 7.2, 8.6);
    ctx.bezierCurveTo(9, 8.2, 10.5, 8.6, 11.3, 9.8);
    ctx.bezierCurveTo(11.6, 12.6, 9.6, 15.4, 6, 15.6);
    ctx.bezierCurveTo(1.5, 15.8, -2.6, 13, -4.2, 8.8);
    ctx.bezierCurveTo(-4.6, 6.6, -3.4, 4.6, -1.6, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HAIR_HI;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(2, 10.5);
    ctx.quadraticCurveTo(4, 13.5, 7.5, 13.2);
    ctx.moveTo(0, 9.5);
    ctx.quadraticCurveTo(1.5, 12.5, 4, 14.2);
    ctx.stroke();
    // mouth (inside the beard, under the moustache)
    drawMouth(ctx);
    // moustache
    ctx.fillStyle = shade(HAIR, 0.06);
    ctx.beginPath();
    ctx.moveTo(6.2, 6.2);
    ctx.bezierCurveTo(8, 5.2, 10.6, 5.2, 12.2, 6.6);
    ctx.bezierCurveTo(12.4, 8.2, 11, 8.6, 9.6, 8.1);
    ctx.bezierCurveTo(8.6, 8.6, 7, 8.4, 6.2, 6.2);
    ctx.closePath();
    ctx.fill();
    // nose: a friendly sunburnt bulb
    const gn = ctx.createRadialGradient(13.4, 2, 0.3, 12.6, 3, 4.4);
    gn.addColorStop(0, shade(NOSE, 0.3));
    gn.addColorStop(0.6, NOSE);
    gn.addColorStop(1, shade(NOSE, -0.2));
    ctx.fillStyle = gn;
    ctx.beginPath();
    ctx.moveTo(10.4, -1.8);
    ctx.bezierCurveTo(12.4, -0.6, 15.6, 1.4, 15.6, 3.6);
    ctx.bezierCurveTo(15.6, 5.6, 13.2, 6.2, 11.2, 5.4);
    ctx.closePath();
    ctx.fill();
    // eye + brow
    drawEye(ctx);
    // sideburn / hair below the hat at the back
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(-9.5, -6);
    ctx.quadraticCurveTo(-11, 1, -7, 5.5);
    ctx.lineTo(-4, 3);
    ctx.quadraticCurveTo(-6, -2, -4, -7);
    ctx.closePath();
    ctx.fill();
    // hat
    if (o.hat === 'straw') drawStrawHat(ctx);
    else if (o.hat === 'beanie') drawBeanie(ctx);
    else drawSouwester(ctx);
    ctx.restore();

    // sweat drops (in boat space)
    for (const d of sweat) {
      if (d.life <= 0) continue;
      ctx.fillStyle = `rgba(200,235,255,${Math.min(1, d.life * 2)})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 1.1, 1.6, Math.atan2(d.vy, d.vx) + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
  }

  function drawEye(ctx) {
    const ex = 7.2, ey = -1.6;
    const open = clamp01(1 - S.blink) * (1 - 0.65 * S.squint) * (1 - S.joy);
    // brow: + raised (surprise/worry), − lowered (focus)
    const by = ey - 4.2 - S.brow * 1.6;
    const tiltIn = -S.brow * 0.35 + S.sad * 0.45; // inner (front) end up when sad
    ctx.strokeStyle = shade(HAIR, -0.25);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 3, by + 0.3 + tiltIn * 0.8);
    ctx.quadraticCurveTo(ex, by - 0.9, ex + 3.2, by - tiltIn * 1.6 + (S.brow < 0 ? -S.brow * 0.8 : 0));
    ctx.stroke();
    if (S.joy > 0.5 || open < 0.12) {
      // happy closed eye ^ / blink line
      ctx.strokeStyle = '#2a1a14';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      if (S.joy > 0.5) {
        ctx.moveTo(ex - 2.2, ey + 0.8);
        ctx.quadraticCurveTo(ex, ey - 1.8, ex + 2.2, ey + 0.8);
      } else {
        ctx.moveTo(ex - 2, ey + 0.4);
        ctx.quadraticCurveTo(ex, ey + 1.2, ex + 2.2, ey + 0.2);
      }
      ctx.stroke();
      return;
    }
    // white + iris (profile: an almond)
    ctx.fillStyle = '#f6efe6';
    ctx.beginPath();
    ctx.ellipse(ex + 0.3, ey, 2.1, 2.0 * open, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3b2a20';
    ctx.beginPath();
    ctx.ellipse(ex + 1, ey + 0.1, 1.45, 1.75 * open, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(ex + 1.5, ey - 0.6 * open, 0.55, 0, TAU);
    ctx.fill();
    // upper lid line
    ctx.strokeStyle = 'rgba(70,40,30,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(ex - 1.9, ey - 0.4 * open);
    ctx.quadraticCurveTo(ex + 0.3, ey - 2.3 * open, ex + 2.4, ey - 0.6 * open);
    ctx.stroke();
  }

  function drawMouth(ctx) {
    const mx = 9.6, my = 9.2;
    const open = S.open, smile = S.smile, grit = S.grit;
    if (grit > 0.5) {
      // gritted teeth
      ctx.fillStyle = '#5a1f1a';
      ctx.beginPath();
      ctx.ellipse(mx, my + 0.3, 2.6, 1.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(mx - 2.2, my - 0.6, 4.4, 1.6);
      ctx.strokeStyle = 'rgba(90,60,50,0.6)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(mx - 2.2, my + 0.2);
      ctx.lineTo(mx + 2.2, my + 0.2);
      ctx.stroke();
      return;
    }
    if (open > 0.15) {
      const h = 0.8 + 3.2 * open;
      ctx.fillStyle = '#5a1f1a';
      ctx.beginPath();
      ctx.moveTo(mx - 2.4, my - 0.4 + (smile > 0.5 ? -0.6 : 0));
      ctx.quadraticCurveTo(mx, my + h * 1.5, mx + 2.6, my - 0.6 - smile * 0.6);
      ctx.closePath();
      ctx.fill();
      if (smile > 0.5) {
        ctx.fillStyle = '#f4efe2';
        ctx.fillRect(mx - 1.8, my - 0.6, 4, 1.1);
      }
      // tongue
      ctx.fillStyle = '#d9645a';
      ctx.beginPath();
      ctx.ellipse(mx + 0.2, my + h * 0.75, 1.5, 0.7 * open, 0, 0, TAU);
      ctx.fill();
      return;
    }
    ctx.strokeStyle = '#6b2a20';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(mx - 2.2, my + smile * -0.3);
    ctx.quadraticCurveTo(mx, my + smile * 1.4, mx + 2.4, my - smile * 1.3);
    ctx.stroke();
  }

  function drawStrawHat(ctx) {
    const straw = '#e3c27a';
    // brim underside (seen as a thin dark band) + top surface
    ctx.fillStyle = shade(straw, -0.38);
    ctx.beginPath();
    ctx.ellipse(1.2, -7.2, 21, 3.4, 0.03, 0, TAU);
    ctx.fill();
    const gb = ctx.createLinearGradient(0, -12, 0, -6);
    gb.addColorStop(0, shade(straw, 0.2));
    gb.addColorStop(1, shade(straw, -0.12));
    ctx.fillStyle = gb;
    ctx.beginPath();
    ctx.ellipse(1.2, -8.6, 20.6, 2.9, 0.03, 0, TAU);
    ctx.fill();
    // crown
    const gc = ctx.createLinearGradient(-10, 0, 11, 0);
    gc.addColorStop(0, shade(straw, -0.25));
    gc.addColorStop(0.55, shade(straw, 0.12));
    gc.addColorStop(1, shade(straw, -0.1));
    ctx.fillStyle = gc;
    ctx.beginPath();
    ctx.moveTo(-9.5, -8.6);
    ctx.bezierCurveTo(-10.5, -15, -8.5, -20.5, -2, -20.6);
    ctx.bezierCurveTo(1, -19.4, 3, -19.4, 5.5, -20.6);
    ctx.bezierCurveTo(10.5, -20, 11.6, -14, 10.6, -8.6);
    ctx.closePath();
    ctx.fill();
    // weave lines
    ctx.strokeStyle = shade(straw, -0.3, 0.45);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = -17.5 + i * 2.2;
      ctx.moveTo(-9 + i * 0.2, y);
      ctx.quadraticCurveTo(1, y - 0.8, 10.3, y);
    }
    ctx.stroke();
    // band
    ctx.fillStyle = '#2c4a6e';
    ctx.beginPath();
    ctx.moveTo(-9.7, -12);
    ctx.quadraticCurveTo(1, -13.2, 10.9, -12);
    ctx.lineTo(10.7, -9.2);
    ctx.quadraticCurveTo(1, -10.2, -9.6, -9.2);
    ctx.closePath();
    ctx.fill();
    // a little red feather tucked in the band — the angler's lucky charm
    ctx.fillStyle = '#d24b3a';
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.quadraticCurveTo(-14, -18, -11.5, -22);
    ctx.quadraticCurveTo(-9, -17, -7, -11.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,30,20,0.6)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-7.6, -11.2);
    ctx.quadraticCurveTo(-11, -16, -11.4, -21);
    ctx.stroke();
    // brim front edge highlight
    ctx.strokeStyle = shade(straw, 0.35, 0.8);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(1.2, -8.4, 20.4, 2.8, 0.03, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  function drawBeanie(ctx) {
    const c = '#c0412f';
    const g = ctx.createLinearGradient(-10, 0, 11, 0);
    g.addColorStop(0, shade(c, -0.3));
    g.addColorStop(0.6, shade(c, 0.08));
    g.addColorStop(1, shade(c, -0.12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10.4, -3);
    ctx.bezierCurveTo(-12, -14, -5, -19, 1, -18.6);
    ctx.bezierCurveTo(8, -18, 11.6, -12, 10.6, -4.5);
    ctx.closePath();
    ctx.fill();
    // ribs
    ctx.strokeStyle = shade(c, -0.35, 0.6);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(i * 2.8, -7);
      ctx.quadraticCurveTo(i * 2.4, -13, i * 1.6, -17.5 + Math.abs(i) * 0.4);
    }
    ctx.stroke();
    // folded cuff
    ctx.fillStyle = shade(c, -0.08);
    ctx.beginPath();
    ctx.moveTo(-11, -2.6);
    ctx.quadraticCurveTo(0, -5.5, 11, -4);
    ctx.lineTo(10.6, -8.6);
    ctx.quadraticCurveTo(0, -10.4, -10.8, -7.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(c, -0.4, 0.5);
    ctx.stroke();
  }

  function drawSouwester(ctx) {
    const c = '#f2c230';
    // long back brim over the neck, short front brim
    ctx.fillStyle = shade(c, -0.25);
    ctx.beginPath();
    ctx.moveTo(-17, 2);
    ctx.quadraticCurveTo(-14, -6, 0, -8);
    ctx.quadraticCurveTo(12, -8.6, 17, -5);
    ctx.quadraticCurveTo(12, -4.5, 6, -5.6);
    ctx.quadraticCurveTo(-6, -4, -13, 4);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(-10, 0, 11, 0);
    g.addColorStop(0, shade(c, -0.25));
    g.addColorStop(0.55, shade(c, 0.15));
    g.addColorStop(1, shade(c, -0.1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10.5, -6.5);
    ctx.bezierCurveTo(-11, -15, -6, -19.5, 0.5, -19.5);
    ctx.bezierCurveTo(7, -19.5, 11.5, -15, 10.8, -7.5);
    ctx.quadraticCurveTo(0, -9.5, -10.5, -6.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(c, -0.4, 0.6);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.quadraticCurveTo(0, -11.5, 10, -9.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,235,0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, -10, 8, -2.6, -1.6);
    ctx.stroke();
    // chin strap
    ctx.strokeStyle = shade(c, -0.45, 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(-3, 8, 5, 13);
    ctx.stroke();
  }

  function drawNearArm(ctx) {
    const o = outfit;
    const sleeve = o.coat || o.shirt;
    const sx = J.shX + 1.5, sy = J.shY + 0.5;
    const ex = J.elbNX, ey = J.elbNY, hx = J.handNX, hy = J.handNY;
    // upper arm (sleeve)
    const g = ctx.createLinearGradient(sx, sy - 5, ex, ey + 5);
    g.addColorStop(0, shade(sleeve, 0.1));
    g.addColorStop(1, shade(sleeve, -0.12));
    limb(ctx, sx, sy, ex, ey, 7, 5.6, g, shade(sleeve, -0.42, 0.55));
    if (o.sleeveRoll) {
      // bare forearm + the rolled cuff at the elbow
      const fg = ctx.createLinearGradient(ex, ey - 4, hx, hy + 4);
      fg.addColorStop(0, SKIN);
      fg.addColorStop(1, shade(SKIN, -0.1));
      limb(ctx, ex, ey, hx, hy, 4.9, 3.8, fg, shade(SKIN_SH, -0.1, 0.5));
      // forearm hair hint
      ctx.strokeStyle = shade(HAIR, 0, 0.25);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 1; i <= 3; i++) {
        const k = 0.25 + i * 0.15;
        const px = lerp(ex, hx, k), py = lerp(ey, hy, k);
        ctx.moveTo(px - 1, py - 2.4);
        ctx.lineTo(px + 0.6, py - 3.2);
      }
      ctx.stroke();
      const cx = lerp(ex, hx, 0.12), cy = lerp(ey, hy, 0.12);
      ctx.beginPath();
      capsule(ctx, ex, ey, cx, cy, 6.4, 6.1);
      ctx.fillStyle = shade(sleeve, 0.12);
      ctx.fill();
      ctx.strokeStyle = shade(sleeve, -0.35, 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lerp(ex, cx, 0.5) - 2, lerp(ey, cy, 0.5) - 4);
      ctx.lineTo(lerp(ex, cx, 0.5) + 2, lerp(ey, cy, 0.5) + 4);
      ctx.stroke();
    } else {
      limb(ctx, ex, ey, hx, hy, 5.8, 4.8, shade(sleeve, -0.02), shade(sleeve, -0.4, 0.55));
      // cuff
      const cx = lerp(ex, hx, 0.86), cy = lerp(ey, hy, 0.86);
      ctx.beginPath();
      capsule(ctx, cx, cy, lerp(ex, hx, 0.95), lerp(ey, hy, 0.95), 4.8, 4.6);
      ctx.fillStyle = shade(sleeve, -0.2);
      ctx.fill();
    }
    // hand
    const a = Math.atan2(hy - ey, hx - ex);
    if (J.wAttached < 0.5 && (J.freeMode === 'trophy' || J.freeMode === 'aim' || J.freeMode === 'stretch')) {
      drawOpenHand(ctx, hx, hy, a);
    } else {
      drawFist(ctx, hx, hy, a);
    }

    // enamel mug for the coffee break
    if (S.mug > 0.05) {
      ctx.save();
      ctx.globalAlpha *= clamp01(S.mug * 1.5);
      const mx = hx + 2, my = hy - 3;
      ctx.fillStyle = '#e9eef2';
      ctx.beginPath();
      ctx.roundRect(mx - 3.5, my - 5, 8, 9, 1.4);
      ctx.fill();
      ctx.fillStyle = '#1f5f8f';
      ctx.fillRect(mx - 3.5, my - 5, 8, 1.6);
      ctx.strokeStyle = '#e9eef2';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(mx - 4.2, my - 0.5, 2.2, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      // steam
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const st = t * 2;
      ctx.moveTo(mx + 0.5, my - 6);
      ctx.bezierCurveTo(mx - 1.5 + Math.sin(st) * 1.5, my - 9, mx + 2.5, my - 11, mx + Math.sin(st + 1) * 1.5, my - 14);
      ctx.stroke();
      ctx.restore();
    }
  }


  function drawFist(ctx, hx, hy, a) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.fillStyle = shade(SKIN, 0.04);
    ctx.beginPath();
    ctx.ellipse(1.5, 0, 4.8, 4.0, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(SKIN_SH, -0.15, 0.55);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3.6, -2.6);
    ctx.lineTo(4.2, 2.6);
    ctx.stroke();
    ctx.fillStyle = shade(SKIN, 0.1);
    ctx.beginPath();
    ctx.ellipse(2.4, -3.2, 2.6, 1.4, 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Open, presenting hand (palm up, fingers spread) — "look at this one!" */
  function drawOpenHand(ctx, hx, hy, a) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    const sk = shade(SKIN, 0.04), edge = shade(SKIN_SH, -0.15, 0.6);
    ctx.strokeStyle = sk;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const fa = -0.55 + i * 0.3 + Math.sin(t * 2 + i) * 0.03;
      ctx.moveTo(3, (i - 1.5) * 1.6);
      ctx.lineTo(3 + Math.cos(fa) * (6.4 - Math.abs(i - 1.2) * 0.8), (i - 1.5) * 1.6 + Math.sin(fa) * 5.4);
    }
    ctx.stroke();
    ctx.fillStyle = sk;
    ctx.beginPath();
    ctx.ellipse(1.6, 0, 4.4, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // thumb up
    ctx.strokeStyle = shade(SKIN, 0.1);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(1.4, -2.6);
    ctx.lineTo(3.4, -6.4);
    ctx.stroke();
    ctx.restore();
  }

  return {
    J, S,
    update,
    drawFarArm,
    drawFarHand,
    drawLegs,
    drawTorso,
    drawHead,
    drawNearArm,
    get outfit() { return outfit; },
  };
}
