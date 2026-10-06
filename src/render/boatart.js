// BOAT & ANGLER ART — the player's boat (3 tiers), the angler, rod, line, lures and the night lamp.
//   createBoatArt(game) → { update(dt), renderBoat(ctx), renderLine(ctx), renderLure(ctx), renderGlow(ctx) }
// All render functions are called in WORLD space.
//
// Lighting: the boat + angler are painted into an offscreen, device-pixel-aligned layer L. When the light is not
// plain daylight, the same content is painted a second time into M, M's silhouette is filled with the multiply
// factor (palette.ambient, lifted toward warm white around the lamp) and L is MULTIPLIED by M — offscreen. A rim
// light (low golden-hour sun / lightning) = M's silhouette minus itself shifted toward the light, added into L.
// The scene then receives exactly ONE composite of L. (Measured: compositing a second offscreen canvas into the
// scene after a blend, or a save/restore around such composites, forces a ~1 ms full flush in Chrome at 1440p;
// copying L into M instead of repainting it forces a readback when M falls back to CPU raster.)
import { RIG } from '../entities/rig.js';
import { LURES_BY_ID } from '../data/lures.js';
import { clamp, clamp01, lerp, damp, smoothstep } from '../core/math.js';
import { makeCanvas } from './boat/util.js';
import { TIERS, hullSprite, resBucket } from './boat/hulls.js';
import { createAngler } from './boat/angler.js';
import { drawRod, drawReel, drawCrank, knobPos, rodStyleFor } from './boat/rod.js';
import { drawLine, lineEndDir } from './boat/line.js';
import { drawLure, drawLureGlow, LURE_SIZE } from './boat/lures.js';
import { createWake } from './boat/wake.js';
import { drawCompanion, createCompanion } from './boat/companion.js';
import { drawLampGlow, drawLantern, drawLampPole, drawFlag, drawProp, drawShadowUnder, drawCabinGlow } from './boat/props.js';

const FLIP_TIME = 0.34;

/** @param {object} game */
export function createBoatArt(game) {
  const angler = createAngler(game);
  const wake = createWake(game);
  const cat = createCompanion(game);

  // ── animation state ──
  let t = 0;
  let phase = game.boat.facing >= 0 ? 0 : Math.PI; // facing flip: visF = cos(phase)
  let visF = Math.cos(phase);
  let crankA = 0, spoolA = 0, propA = 0;
  let prevVx = 0, accel = 0;
  let biteAlert = 0;
  let swing = 0, swingV = 0, prevTilt = 0;
  let flagPh = 0;
  let lampK = 0; // 0..1 lamp warm-up (lamps don't snap on)
  let resNeed = 1, res = 1; // hull sprite resolution (hysteresis)

  // local rod points (grip … tip) in boat space
  const RX = new Float32Array(32), RY = new Float32Array(32);
  let rn = 0;
  let rux = 1, ruy = 0; // rod direction at the grip
  const reel = { x: 0, y: 0, nx: 0, ny: 1 };
  const knob = { x: 0, y: 0 };
  const visTip = { x: 0, y: 0 };
  const lanternLocal = { x: RIG.lamp.x, y: RIG.lamp.y };
  const tmpW = { x: 0, y: 0 };
  const dirTmp = { x: 0, y: 1 };
  const cross = { ok: false, x: 0, y: 0 };
  const lineOpts = { slack: 0, tension: 0, t: 0, k: 1, night: 0, amb: null, waves: null, cross };
  // lure trail (chum slick / krill) in world space
  const TRAIL = 14;
  const trailX = new Float32Array(TRAIL), trailY = new Float32Array(TRAIL), trailA = new Float32Array(TRAIL);
  let trailI = 0, trailT = 0;
  let lureDrawX = 0, lureDrawY = 0, lureDrawA = 0, lureMoving = 0;
  // angler inputs (reused)
  const I = {
    pose: 'idle', poseT: 0, floorY: -10, gripX: RIG.grip.x, gripY: RIG.grip.y, ux: 1, uy: 0, knobX: 0, knobY: 0,
    lookX: 300, lookY: 0, lookOn: 0, trophyX: RIG.trophy.x, trophyY: RIG.trophy.y, tilt: 0, accel: 0,
    rain: 0, night: 0, tension: 0, reeling: false, reelRate: 0, charge: 0, biteAlert: 0, fightMode: 'rest',
  };
  const wakeIn = { x: 0, y: 0, vx: 0, throttle: 0, facing: 1, stern: 0, bow: 0, propX: 0, propY: 0 };
  const catIn = { state: 'idle', pose: 'idle', poseT: 0, rain: 0, night: 0, vx: 0, biteAlert: 0, tension: 0 };

  // offscreen layers
  // created large up front: Chrome only GPU-accelerates canvases above a size threshold, and a CPU canvas
  // composited into the (GPU) scene costs a full texture upload per draw
  const L = makeCanvas(1024, 640), lctx = L.getContext('2d');
  // M (multiply mask) and R (rim) are PAINTED, never copied from L: copying a canvas that was just composited
  // forces a synchronous flush / copy-on-write (or a GPU→CPU readback when M falls back to CPU raster)
  const M = makeCanvas(1024, 640), mctx = M.getContext('2d');
  const R = makeCanvas(1024, 640), rctx = R.getContext('2d');

  const tierOf = () => TIERS[clamp(game.boat.tier | 0, 0, TIERS.length - 1)];
  const lampOwned = () => !!(game.boat.lamp || (game.player && game.player.stats && game.player.stats.lamp > 0));

  /** boat-local → world using the VISUAL facing (matches what is drawn). */
  function toWorldVis(lx, ly, out) {
    const b = game.boat;
    const c = Math.cos(b.tilt), s = Math.sin(b.tilt);
    const fx = lx * visF;
    out.x = b.x + fx * c - ly * s;
    out.y = b.y + fx * s + ly * c;
    return out;
  }
  /** world → boat-local using the TRUE facing (inverse of rig.js boatToWorld). */
  function toLocal(wx, wy, out) {
    const b = game.boat;
    const c = Math.cos(b.tilt), s = Math.sin(b.tilt);
    const dx = wx - b.x, dy = wy - b.y;
    out.x = (dx * c + dy * s) * (b.facing >= 0 ? 1 : -1);
    out.y = -dx * s + dy * c;
    return out;
  }

  function computeLocalRod() {
    const pts = game.boat.rod.pts;
    rn = Math.min(pts.length, 32);
    if (rn < 2) {
      // no rod computed yet: synthesise a straight one
      rn = 11;
      for (let i = 0; i < rn; i++) {
        RX[i] = RIG.grip.x + Math.cos(0.95) * (RIG.rodLength * i) / 10;
        RY[i] = RIG.grip.y - Math.sin(0.95) * (RIG.rodLength * i) / 10;
      }
    } else {
      for (let i = 0; i < rn; i++) {
        toLocal(pts[i].x, pts[i].y, tmpW);
        RX[i] = tmpW.x;
        RY[i] = tmpW.y;
      }
      // anchor exactly at the grip (removes any one-frame lag of the kernel's world points)
      const ox = RIG.grip.x - RX[0], oy = RIG.grip.y - RY[0];
      for (let i = 0; i < rn; i++) {
        RX[i] += ox;
        RY[i] += oy;
      }
    }
    const dx = RX[1] - RX[0], dy = RY[1] - RY[0];
    const d = Math.hypot(dx, dy) || 1;
    rux = dx / d;
    ruy = dy / d;
    // reel hangs under the reel seat (same formula as rod.js)
    reel.nx = -ruy;
    reel.ny = rux;
    reel.x = RIG.grip.x + rux * 1 + reel.nx * 10.5;
    reel.y = RIG.grip.y + ruy * 1 + reel.ny * 10.5;
    knobPos(reel.x, reel.y, crankA, knob);
  }

  function update(dt) {
    const b = game.boat, f = game.fishing, env = game.env;
    const T = tierOf();
    t += dt;
    // facing flip: squash through edge-on
    const target = b.facing >= 0 ? 0 : Math.PI;
    const step = (dt * Math.PI) / FLIP_TIME;
    phase = Math.abs(target - phase) <= step ? target : phase + Math.sign(target - phase) * step;
    const e = Math.cos(phase);
    visF = Math.abs(e) < 0.04 ? (e < 0 ? -0.04 : 0.04) : e;

    // reel: the spool follows reelRate both ways (a screaming drag spins it backwards); the handle only turns forward
    const rr = f.reelRate || 0;
    spoolA += dt * rr * 24;
    const cranking = f.reeling || b.pose === 'reel';
    if (cranking) crankA += dt * Math.max(0.3, rr) * 15;
    propA += dt * (b.throttle || 0) * 46 + dt * (Math.abs(b.vx) > 5 ? 2 : 0);

    // acceleration (for leaning into starts & stops)
    const a = dt > 0 ? (b.vx - prevVx) / dt : 0;
    prevVx = b.vx;
    accel = damp(accel, clamp(a, -900, 900), 6, dt);
    biteAlert = damp(biteAlert, f.state === 'bite' ? 1 : 0, f.state === 'bite' ? 14 : 3, dt);

    computeLocalRod();

    // what is the angler looking at?
    let lx = 0, ly = 0, on = 0;
    if (f.lure.visible) {
      toLocal(f.lure.x, f.lure.y, tmpW);
      lx = tmpW.x;
      ly = tmpW.y;
      on = 1;
    } else if (f.hooked && (f.state === 'fight' || f.state === 'bite' || f.state === 'landing')) {
      toLocal(f.hooked.x, f.hooked.y, tmpW);
      lx = tmpW.x;
      ly = tmpW.y;
      on = 1;
    } else if (f.line.points.length > 1) {
      const p = f.line.points[f.line.points.length - 1];
      toLocal(p.x, p.y, tmpW);
      lx = tmpW.x;
      ly = tmpW.y;
      on = 1;
    }
    I.pose = b.pose === 'wait' && f.reeling ? 'reel' : b.pose;
    I.poseT = b.poseT;
    I.floorY = T.floorY;
    I.ux = rux;
    I.uy = ruy;
    I.knobX = knob.x;
    I.knobY = knob.y;
    I.lookX = lx;
    I.lookY = ly;
    I.lookOn = on;
    I.tilt = b.tilt * (b.facing >= 0 ? 1 : -1);
    I.accel = accel * (b.facing >= 0 ? 1 : -1);
    I.rain = env.weather.rain;
    I.night = env.night;
    I.tension = f.tension || 0;
    I.reeling = !!f.reeling;
    I.reelRate = rr;
    I.charge = f.charge || 0;
    I.biteAlert = biteAlert;
    I.fightMode = (f.fight && f.fight.mode) || 'rest';
    angler.update(dt, I);
    catIn.state = f.state;
    catIn.pose = b.pose;
    catIn.poseT = b.poseT;
    catIn.rain = env.weather.rain;
    catIn.night = env.night;
    catIn.vx = b.vx;
    catIn.biteAlert = biteAlert;
    catIn.tension = I.tension;
    cat.update(dt, catIn);

    // the lantern swings like a pendulum, kicked by rolling & acceleration
    const dTilt = (b.tilt - prevTilt) / Math.max(dt, 1e-4);
    prevTilt = b.tilt;
    swingV += (-swing * 38 - swingV * 1.6 - dTilt * 2.2 * (b.facing >= 0 ? 1 : -1) - I.accel * 0.004) * dt;
    swing = clamp(swing + swingV * dt, -0.6, 0.6);
    lanternLocal.x = RIG.lamp.x + Math.sin(swing) * 13;
    lanternLocal.y = RIG.lamp.y - 13 + Math.cos(swing) * 13;
    lampK = damp(lampK, b.lamp ? 1 : 0, b.lamp ? 3 : 5, dt);
    // flag flutter speed grows with the apparent wind
    const wind = env.weather.wind * 120 - b.vx;
    flagPh += dt * (4 + Math.min(14, Math.abs(wind) * 0.06));

    // wake & foam
    wakeIn.x = b.x;
    wakeIn.y = b.y;
    wakeIn.vx = b.vx;
    wakeIn.throttle = b.throttle || 0;
    wakeIn.facing = b.facing >= 0 ? 1 : -1;
    toWorldVis(T.stern, 0, tmpW);
    wakeIn.stern = tmpW.x;
    toWorldVis(T.bow, 0, tmpW);
    wakeIn.bow = tmpW.x;
    toWorldVis(T.prop.x, T.prop.y, tmpW);
    wakeIn.propX = tmpW.x;
    wakeIn.propY = tmpW.y;
    wake.update(dt, wakeIn);

    updateLureTrail(dt);
  }

  function updateLureTrail(dt) {
    const f = game.fishing;
    for (let i = 0; i < TRAIL; i++) trailA[i] = Math.max(0, trailA[i] - dt * 0.35);
    if (!f.lure.visible || !f.lure.inWater) return;
    trailT -= dt;
    if (trailT <= 0) {
      trailT = 0.22;
      trailX[trailI] = f.lure.x;
      trailY[trailI] = f.lure.y;
      trailA[trailI] = 1;
      trailI = (trailI + 1) % TRAIL;
    }
  }
  // ── PART 2 (render) is appended below ──

  // ── RENDER: boat + angler ────────────────────────────────────────────────────
  const corners = [0, 0, 0, 0, 0, 0, 0, 0];
  /** Device-px rectangle (clipped to the canvas) that holds everything above/around the hull. */
  function layerRect(m, T, cw, ch, out) {
    const bb = T.bounds;
    const x0 = bb.x0 - 12, x1 = Math.max(bb.x1, RIG.trophy.x + 40) + 12;
    const y0 = Math.min(bb.y0, -215), y1 = bb.y1 + 6;
    corners[0] = x0; corners[1] = y0; corners[2] = x1; corners[3] = y0;
    corners[4] = x1; corners[5] = y1; corners[6] = x0; corners[7] = y1;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < 8; i += 2) {
      toWorldVis(corners[i], corners[i + 1], tmpW);
      const dx = m.a * tmpW.x + m.e, dy = m.d * tmpW.y + m.f;
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
    // the rod can reach outside the hull box
    for (let i = 0; i < rn; i++) {
      toWorldVis(RX[i], RY[i], tmpW);
      const dx = m.a * tmpW.x + m.e, dy = m.d * tmpW.y + m.f;
      if (dx - 8 < minX) minX = dx - 8;
      if (dx + 8 > maxX) maxX = dx + 8;
      if (dy - 8 < minY) minY = dy - 8;
      if (dy + 8 > maxY) maxY = dy + 8;
    }
    out.x = Math.max(0, Math.floor(minX));
    out.y = Math.max(0, Math.floor(minY));
    out.w = Math.min(cw, Math.ceil(maxX)) - out.x;
    out.h = Math.min(ch, Math.ceil(maxY)) - out.y;
    return out;
  }
  const rect = { x: 0, y: 0, w: 0, h: 0 };
  function ensure(c, w, h) {
    if (c.width < w || c.height < h) {
      c.width = Math.max(c.width, Math.ceil(w / 64) * 64);
      c.height = Math.max(c.height, Math.ceil(h / 64) * 64);
    }
  }

  /** Paint the boat + angler (boat-local) into context g, which already holds world→device(−offset). */
  function paintBoat(g, T, k) {
    const b = game.boat, f = game.fishing;
    const sf = visF >= 0 ? 1 : -1;
    const back = hullSprite(T.id, 'back', sf, res);
    const front = hullSprite(T.id, 'front', sf, res);
    const style = rodStyleFor((game.player && game.player.stats && game.player.stats.tackle) || 1.5);
    const night = game.env.night;
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.tilt);
    // far / interior layer
    g.save();
    g.scale(visF * sf, 1);
    g.drawImage(back.canvas, back.x, back.y, back.w, back.h);
    g.restore();
    g.save();
    g.scale(visF, 1);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (T.flag) drawFlag(g, T.flag, flagPh, game.env.weather.wind * 120 - b.vx, b.facing >= 0 ? 1 : -1, t);
    if (lampOwned()) {
      drawLampPole(g, T, lanternLocal);
      drawLantern(g, lanternLocal.x, lanternLocal.y, swing, lampK, t);
    }
    if (T.perch) drawCompanion(g, cat, T.perch, t);
    // angler & rod (rod in the far hand, crank with the near hand)
    angler.drawFarArm(g);
    const lineCol = f.line.points.length > 1 || f.lure.visible ? (night > 0.5 ? 'rgba(210,222,240,0.7)' : 'rgba(80,90,105,0.75)') : 'rgba(80,90,105,0.55)';
    drawRod(g, RX, RY, rn, rux, ruy, style, lineCol, reel);
    drawReel(g, reel.x, reel.y, rux, ruy, reel.nx, reel.ny, style, spoolA);
    angler.drawFarHand(g, rux, ruy);
    angler.drawLegs(g, false);
    angler.drawTorso(g);
    angler.drawLegs(g, true);
    angler.drawHead(g);
    drawCrank(g, reel.x, reel.y, crankA, style);
    angler.drawNearArm(g);
    g.restore();
    // near side of the hull over the angler's legs
    g.save();
    g.scale(visF * sf, 1);
    g.drawImage(front.canvas, front.x, front.y, front.w, front.h);
    g.restore();
    g.save();
    g.scale(visF, 1);
    if (T.prop) drawProp(g, T.prop, propA, b.throttle || 0, T.id);
    g.restore();
    g.restore();
    // remember where the rod tip really is (the line starts there)
    toWorldVis(RX[rn - 1], RY[rn - 1], visTip);
  }

  function renderBoat(ctx) {
    const b = game.boat, env = game.env;
    const T = tierOf();
    const cam = game.camera.bounds;
    if (b.x + 420 < cam.left || b.x - 420 > cam.right || b.y - 380 > cam.bottom || b.y + 120 < cam.top) {
      toWorldVis(RX[Math.max(0, rn - 1)], RY[Math.max(0, rn - 1)], visTip);
      return;
    }
    const m = ctx.getTransform();
    const k = m.a; // device px per world px (camera transform has no rotation)
    // hull sprite resolution with hysteresis (re-paint only on big zoom changes)
    resNeed = k;
    if (resNeed > res * 1.06 || resNeed < res * 0.6) res = resBucket(resNeed);

    // soft shadow of the hull cast down into the water column (before the hull)
    drawShadowUnder(ctx, game, T, visF);

    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    layerRect(m, T, cw, ch, rect);
    if (rect.w <= 0 || rect.h <= 0) return;
    ensure(L, rect.w, rect.h);
    ensure(M, rect.w, rect.h);
    ensure(R, rect.w, rect.h);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, rect.w + 2, rect.h + 2);
    lctx.setTransform(m.a, m.b, m.c, m.d, m.e - rect.x, m.f - rect.y);
    paintBoat(lctx, T, k);

    // light of the hour. All blending happens OFFSCREEN so the scene receives a single composite:
    // (a second canvas composited into the scene, or a save/restore around it, forces a full flush in Chrome)
    const amb = env.palette.ambient;
    const lampOn = lampK > 0.01 && lampOwned();
    const needTint = amb[0] < 252 || amb[1] < 252 || amb[2] < 252;
    const rim = rimParams(k);
    const useRim = rim.amt > 0.03;
    if (needTint || useRim) {
      // M: a second copy of the silhouette, painted directly (never copied from L)
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, rect.w + 2, rect.h + 2);
      mctx.setTransform(m.a, m.b, m.c, m.d, m.e - rect.x, m.f - rect.y);
      paintBoat(mctx, T, k);
      mctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (useRim) {
      // R: silhouette in the rim colour minus the silhouette shifted toward the light = the lit edge
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalAlpha = 1;
      rctx.globalCompositeOperation = 'copy';
      rctx.drawImage(M, 0, 0, rect.w, rect.h, 0, 0, rect.w, rect.h);
      rctx.globalCompositeOperation = 'source-in';
      rctx.fillStyle = rim.css;
      rctx.fillRect(0, 0, rect.w, rect.h);
      rctx.globalCompositeOperation = 'destination-out';
      rctx.drawImage(M, 0, 0, rect.w, rect.h, -rim.ox, -rim.oy, rect.w, rect.h);
      rctx.globalCompositeOperation = 'source-over';
    }
    if (needTint) {
      // M → silhouette × (ambient, lifted toward warm white near the lamp); then L ×= M
      mctx.globalCompositeOperation = 'source-in';
      const ambCss = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`;
      if (lampOn) {
        toWorldVis(lanternLocal.x, lanternLocal.y, tmpW);
        const lx = m.a * tmpW.x + m.e - rect.x, ly = m.d * tmpW.y + m.f - rect.y;
        const flick = 0.93 + 0.07 * Math.sin(t * 13.1) * Math.sin(t * 7.3);
        const dark = clamp01(1 - (amb[0] + amb[1] + amb[2]) / 640);
        const a = lampK * flick * (0.35 + 0.65 * dark);
        const r = 280 * k;
        const lit = (kk) => `rgb(${Math.min(255, amb[0] + 255 * a * kk) | 0},${Math.min(255, amb[1] + 214 * a * kk) | 0},${Math.min(255, amb[2] + 150 * a * kk) | 0})`;
        const gr = mctx.createRadialGradient(lx, ly, 2 * k, lx, ly, r);
        gr.addColorStop(0, lit(1));
        gr.addColorStop(0.3, lit(0.72));
        gr.addColorStop(0.65, lit(0.3));
        gr.addColorStop(1, ambCss);
        mctx.fillStyle = gr;
      } else {
        mctx.fillStyle = ambCss;
      }
      mctx.fillRect(0, 0, rect.w, rect.h);
      mctx.globalCompositeOperation = 'source-over';
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'multiply';
      lctx.drawImage(M, 0, 0, rect.w, rect.h, 0, 0, rect.w, rect.h);
      lctx.globalCompositeOperation = 'source-over';
    }
    if (useRim) {
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'lighter';
      lctx.globalAlpha = rim.amt * 0.85;
      lctx.drawImage(R, 0, 0, rect.w, rect.h, 0, 0, rect.w, rect.h);
      lctx.globalAlpha = 1;
      lctx.globalCompositeOperation = 'source-over';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(L, 0, 0, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);

    // foam & wash in front of the hull
    wake.draw(ctx, amb, env.night);
  }

  /** Rim light: the low golden-hour sun, or a lightning flash from above. → {amt, css, ox, oy} */
  const rimOut = { amt: 0, css: '', ox: 0, oy: 0 };
  function rimParams(k) {
    const env = game.env, w = env.weather;
    let amt = 0, r = 255, g = 220, bl = 170, dx = 0, dy = -1;
    if (w.lightning > 0.04) {
      amt = Math.min(1, w.lightning * 1.3);
      r = 215; g = 228; bl = 255;
      dx = 0.15; dy = -1;
    } else if (env.goldenHour > 0.04 && env.sun.elev > -0.12) {
      amt = env.goldenHour * (1 - 0.85 * smoothstep(0.35, 0.9, w.cloud)) * 0.95;
      const sc = env.palette.sun;
      r = sc[0]; g = sc[1] * 0.92; bl = sc[2] * 0.75;
      const bx = game.camera.screenX(game.boat.x), by = game.camera.screenY(game.boat.y - 100);
      dx = env.sun.x * game.view.w - bx;
      dy = game.camera.screenY(-64) - env.sun.elev * 520 - by;
    }
    const d = Math.hypot(dx, dy) || 1;
    const sh = clamp(1.4 * k, 1.2, 3.2);
    rimOut.amt = amt;
    rimOut.css = `rgb(${r | 0},${g | 0},${bl | 0})`;
    rimOut.ox = (dx / d) * sh;
    rimOut.oy = (dy / d) * sh;
    return rimOut;
  }
  // ── PART 3 (line, lure, glow) is appended below ──

  // ── RENDER: line ─────────────────────────────────────────────────────────────
  function renderLine(ctx) {
    const f = game.fishing;
    const pts = f.line.points;
    if (pts.length < 2) return;
    const m = ctx.getTransform();
    lineOpts.slack = f.line.slack || 0;
    lineOpts.tension = f.tension || 0;
    lineOpts.t = t;
    lineOpts.k = m.a || 1;
    lineOpts.night = game.env.night;
    lineOpts.amb = game.env.palette.ambient;
    lineOpts.waves = game.world.waves;
    drawLine(ctx, pts, visTip.x, visTip.y, lineOpts);
  }

  // ── RENDER: lure ─────────────────────────────────────────────────────────────
  /** Where & how the lure is drawn: it hangs from its leader at the end of the line. */
  function placeLure() {
    const f = game.fishing, lure = f.lure;
    const L0 = LURES_BY_ID[lure.id] || LURES_BY_ID.worm;
    const size = LURE_SIZE[L0.id] || 30;
    const pts = f.line.points;
    let ang;
    if (pts.length >= 2) {
      lineEndDir(pts, dirTmp);
      // gravity pulls a slow lure's body under its tie; a moving lure trails along the line
      const speed = lure.speed || Math.hypot(lure.vx || 0, lure.vy || 0);
      lureMoving = clamp01(speed / 120);
      const grav = lure.inWater ? lerp(0.55, 0.12, lureMoving) : 0.15;
      let hx = dirTmp.x, hy = dirTmp.y + grav;
      const d = Math.hypot(hx, hy) || 1;
      hx /= d;
      hy /= d;
      // body hangs along (hx,hy) from the tie; the head (+x local) points back to the tie
      ang = Math.atan2(-hy, -hx);
      const wob = lure.inWater ? Math.sin(t * 2.3 + lure.x * 0.01) * 0.12 + (lure.twitchT < 0.4 ? Math.sin(lure.twitchT * 30) * 0.35 * (1 - lure.twitchT / 0.4) : 0) : 0;
      ang += wob;
      lureDrawX = lure.x - Math.cos(ang) * size * 0.5;
      lureDrawY = lure.y - Math.sin(ang) * size * 0.5;
    } else {
      ang = lure.angle || 0;
      lureDrawX = lure.x;
      lureDrawY = lure.y;
      lureMoving = 0;
    }
    lureDrawA = ang;
    return size;
  }

  function renderLure(ctx) {
    const f = game.fishing, lure = f.lure;
    if (!lure.visible) return;
    if (!game.camera.sees(lure.x, lure.y, 80)) return;
    const size = placeLure();
    // chum leaves a faint red slick behind it
    if (lure.id === 'chum') {
      for (let i = 0; i < TRAIL; i++) {
        const a = trailA[i];
        if (a < 0.02) continue;
        const r = 10 + (1 - a) * 30;
        const g = ctx.createRadialGradient(trailX[i], trailY[i] - (1 - a) * 18, 0, trailX[i], trailY[i] - (1 - a) * 18, r);
        g.addColorStop(0, `rgba(150,16,16,${0.16 * a})`);
        g.addColorStop(1, 'rgba(150,16,16,0)');
        ctx.fillStyle = g;
        ctx.fillRect(trailX[i] - r, trailY[i] - (1 - a) * 18 - r, r * 2, r * 2);
      }
    }
    drawLure(ctx, lure.id, lureDrawX, lureDrawY, size, lureDrawA, t);
  }

  // ── RENDER: additive glow ──────────────────────────────────────────────────────
  function renderGlow(ctx) {
    const b = game.boat, f = game.fishing, env = game.env;
    const T = tierOf();
    const near = game.camera.sees(b.x, b.y - 100, 520);
    if (near && lampOwned() && lampK > 0.01) {
      toWorldVis(lanternLocal.x, lanternLocal.y, tmpW);
      drawLampGlow(ctx, game, tmpW.x, tmpW.y, lampK, t);
    }
    if (near && T.windows && T.windows.length) drawCabinGlow(ctx, game, T, visF, t);
    // lure glow & glints
    if (f.lure.visible && game.camera.sees(f.lure.x, f.lure.y, 200)) {
      const size = placeLure();
      // glow reads in the dark; in bright shallow water it is only a faint shimmer
      const dark = Math.pow(1 - env.lightAt(Math.max(0, f.lure.y)), 0.8);
      ctx.save();
      ctx.globalAlpha = clamp(0.14 + dark * 0.86, 0, 1);
      drawLureGlow(ctx, f.lure.id, lureDrawX, lureDrawY, size, lureDrawA, t, lureMoving);
      ctx.restore();
    } else if (f.hooked && f.state === 'fight') {
      // a glowing lure still shines from the fish's mouth
      const L0 = LURES_BY_ID[f.lure.id];
      if (L0 && L0.glow > 0.3 && game.camera.sees(f.lure.x, f.lure.y, 200)) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawLureGlow(ctx, f.lure.id, f.lure.x, f.lure.y, LURE_SIZE[L0.id] || 30, 0, t, 0);
        ctx.restore();
      }
    }
  }

  return {
    update,
    renderBoat,
    renderLine,
    renderLure,
    renderGlow,
    /** dev/debug access */
    _angler: angler,
  };
}
