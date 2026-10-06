// WATER · far-background life in the water column, for scale and atmosphere. All of it lives on parallax
// layers behind the action and is tinted toward the local water colour (it recedes into the fog, and the
// overlay fog fades it further):
//   · schools of small fish wheeling in the sunlit / twilight water
//   · a humpback whale gliding past — very rarely (debug: __game.mods.water.debug.body.deep.whale())
//   · ghostly jellies drifting in the twilight zone
//   · distant bioluminescent flashes in the midnight zone and the abyss ("living lights")
import { clamp, clamp01, lerp, smoothstep, mixRgb, TAU } from '../../core/math.js';
import { createRng, hash1 } from '../../core/rng.js';
import { unitSprite, drawUnitSpriteSwim } from '../art/common.js';
import { fishSil, softDot, Tint, GradTint, makeCanvas } from './sprites.js';

const SCHOOL_PAR = 0.62, JELLY_PAR = 0.5, WHALE_PAR = 0.45, LIGHT_PAR = 0.4;

function paintHumpback(g) {
  // unit space: +x snout, body length 1, origin = body centre. Flat knobbly rostrum, deep throat,
  // small dorsal hump two-thirds back, slender tail stock, swept flukes and the famous long pectoral.
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0.5, 0.004);
  g.bezierCurveTo(0.47, -0.03, 0.4, -0.055, 0.3, -0.078);
  g.bezierCurveTo(0.2, -0.098, 0.05, -0.104, -0.1, -0.092);
  g.bezierCurveTo(-0.15, -0.088, -0.17, -0.09, -0.19, -0.104); // dorsal hump
  g.bezierCurveTo(-0.205, -0.112, -0.215, -0.1, -0.225, -0.078);
  g.bezierCurveTo(-0.29, -0.055, -0.35, -0.034, -0.405, -0.02);
  // flukes (seen slightly from above: a swept fork)
  g.bezierCurveTo(-0.44, -0.03, -0.48, -0.07, -0.525, -0.086);
  g.bezierCurveTo(-0.515, -0.05, -0.495, -0.016, -0.468, 0.0);
  g.bezierCurveTo(-0.495, 0.016, -0.515, 0.05, -0.525, 0.086);
  g.bezierCurveTo(-0.48, 0.07, -0.44, 0.03, -0.405, 0.02);
  g.bezierCurveTo(-0.33, 0.034, -0.22, 0.066, -0.1, 0.092);
  g.bezierCurveTo(0.05, 0.118, 0.22, 0.118, 0.34, 0.09); // ventral pleats / throat
  g.bezierCurveTo(0.42, 0.07, 0.47, 0.04, 0.495, 0.02);
  g.closePath();
  g.fill();
  // knobbly rostrum
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(0.46 - i * 0.045, -0.034 - i * 0.011, 0.007, 0, Math.PI * 2);
    g.fill();
  }
  // the long pectoral fin, swept back and down
  g.beginPath();
  g.moveTo(0.22, 0.07);
  g.bezierCurveTo(0.16, 0.13, 0.04, 0.23, -0.09, 0.285);
  g.bezierCurveTo(-0.11, 0.294, -0.118, 0.282, -0.104, 0.27);
  g.bezierCurveTo(0.0, 0.2, 0.08, 0.13, 0.13, 0.078);
  g.closePath();
  g.fill();
}

function paintJelly(size) {
  const c = makeCanvas(size, size * 2);
  const g = c.getContext('2d');
  const w = size, cx = w / 2;
  const bell = g.createRadialGradient(cx, w * 0.42, w * 0.05, cx, w * 0.45, w * 0.5);
  bell.addColorStop(0, 'rgba(255,255,255,0.55)');
  bell.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  bell.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bell;
  g.beginPath();
  g.ellipse(cx, w * 0.5, w * 0.42, w * 0.34, 0, Math.PI, 0);
  g.quadraticCurveTo(cx + w * 0.3, w * 0.58, cx, w * 0.56);
  g.quadraticCurveTo(cx - w * 0.3, w * 0.58, cx - w * 0.42, w * 0.5);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = Math.max(1, w * 0.025);
  for (let i = 0; i < 7; i++) {
    const x0 = cx + (i - 3) * w * 0.1;
    g.beginPath();
    g.moveTo(x0, w * 0.55);
    g.bezierCurveTo(x0 + w * 0.08, w * 0.9, x0 - w * 0.08, w * 1.3, x0 + (i % 2 ? 1 : -1) * w * 0.04, w * (1.55 + 0.3 * ((i * 37) % 5) / 5));
    g.globalAlpha = 0.5 + 0.1 * (i % 3);
    g.stroke();
  }
  return c;
}

export function createDeepLife(game, core) {
  const cam = game.camera;
  const env = game.env;
  const rng = createRng(0xdee9);

  const fishS = fishSil(28, 12);
  const schoolTints = [new Tint(fishS), new Tint(fishS), new Tint(fishS)];
  const jellyS = paintJelly(48);
  const jellyTint = new Tint(jellyS);
  const lightDot = softDot(32, 0.4);
  const tLightA = new Tint(lightDot), tLightB = new Tint(lightDot);
  let whaleTint = null;

  // ── schools: one per 2600-px cell of the parallax layer, each with its own personality ──
  const SCHOOL_CELL = 1900;
  const N_FISH = 56;
  const fishOff = [];
  for (let i = 0; i < N_FISH; i++) {
    const a = rng.next() * TAU, r = Math.sqrt(rng.next());
    fishOff.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.42, ph: rng.next() * TAU, s: rng.range(0.75, 1.2), lag: rng.next() });
  }

  // ── whale (rare event) ──
  const whale = { on: false, x: 0, y: 0, dir: 1, len: 900, t: 0, speed: 40, phase: 0, timer: 0 };
  whale.timer = rng.range(90, 200);
  function startWhale(force) {
    const b = cam.bounds;
    if (!force && (b.top > 2200 || b.bottom < 250)) return false;
    whale.on = true;
    whale.dir = rng.chance(0.5) ? 1 : -1;
    whale.len = rng.range(820, 1100);
    // layer-space y so it appears at a pleasing height in the current view
    whale.y = clamp(lerp(b.top, b.bottom, rng.range(0.35, 0.68)), 320, 1900) - cam.y * (1 - WHALE_PAR);
    // start just off-screen (in parallax layer space)
    const ox = cam.x * (1 - WHALE_PAR);
    const sx = whale.dir > 0 ? b.left - whale.len * 0.55 : b.right + whale.len * 0.55;
    whale.x = sx - ox;
    whale.speed = rng.range(34, 52);
    whale.t = 0;
    return true;
  }

  // ── living lights (deep) ──
  const flashes = Array.from({ length: 40 }, () => ({ on: false, x: 0, y: 0, t: 0, life: 1, size: 1, hue: 0, trail: 0, vx: 0, vy: 0 }));
  let flashAcc = 0;

  function update(dt) {
    const b = cam.bounds;
    // whale scheduling
    if (whale.on) {
      whale.t += dt;
      whale.x += whale.dir * whale.speed * dt;
      whale.phase += dt * 1.1;
      const ox = cam.x * (1 - WHALE_PAR);
      const sx = whale.x + ox;
      if ((whale.dir > 0 && sx - whale.len > b.right + 200) || (whale.dir < 0 && sx + whale.len < b.left - 200) || whale.t > 160) whale.on = false;
    } else {
      whale.timer -= dt;
      if (whale.timer <= 0) {
        whale.timer = rng.range(150, 320);
        startWhale(false);
      }
    }
    // living lights
    const deepK = smoothstep(2400, 3800, (b.top + b.bottom) * 0.5);
    if (deepK > 0.01) {
      flashAcc += deepK * 8 * (b.w / 1920) * dt;
      while (flashAcc >= 1) {
        flashAcc -= 1;
        const o = flashes.find((f) => !f.on);
        if (!o) break;
        o.on = true;
        o.x = lerp(b.left, b.right, rng.next()) - cam.x * (1 - LIGHT_PAR);
        o.y = Math.max(2600, lerp(b.top, b.bottom, rng.next())) - cam.y * (1 - LIGHT_PAR);
        o.t = 0;
        o.life = rng.range(0.7, 2.2);
        o.size = rng.range(0.5, 1.2);
        o.hue = rng.next();
        o.trail = rng.chance(0.3) ? rng.int(2, 4) : 0;
        o.vx = rng.range(-30, 30);
        o.vy = rng.range(-12, 12);
      }
    }
    for (const o of flashes) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= o.life) o.on = false;
    }
  }

  function render(ctx, b) {
    const T = game.time.now;
    drawSchools(ctx, b, T);
    drawJellies(ctx, b, T);
    if (whale.on) drawWhale(ctx, b, T);
    drawLights(ctx, b, T);
  }

  function silColour(y, x, k) {
    const c = env.waterColorAt(y, x);
    return [c[0] * k, c[1] * k, c[2] * (k + 0.06)];
  }

  function drawSchools(ctx, b, T) {
    if (b.top > 2600 || b.bottom < 120) return;
    const ox = cam.x * (1 - SCHOOL_PAR), oy = cam.y * (1 - SCHOOL_PAR);
    const i0 = Math.floor((b.left - ox - 1400) / SCHOOL_CELL), i1 = Math.floor((b.right - ox + 1400) / SCHOOL_CELL);
    let tIdx = 0;
    for (let i = i0; i <= i1 && tIdx < schoolTints.length; i++) {
      const h1 = hash1(i * 17 + 3), h2 = hash1(i * 29 + 11), h3 = hash1(i * 53 + 7);
      if (h3 < 0.15) continue; // not every stretch of sea has one
      const range = lerp(380, 820, h2);
      const per = lerp(70, 120, h1);
      const ph = (T / per + h1) * TAU;
      const homeX = i * SCHOOL_CELL + lerp(400, 1500, h1);
      const sx = homeX + Math.sin(ph) * range + ox;
      const vx = Math.cos(ph); // direction of travel
      const sy = lerp(170, 1300, h2 * h2) + Math.sin(ph * 2.3 + h3 * 5) * 60 + oy;
      const R = lerp(150, 260, h3);
      if (sx + R < b.left || sx - R > b.right || sy + R < b.top || sy - R > b.bottom) continue;
      const wy = sy - oy; // the school's real depth (for its colour)
      const col = silColour(wy, sx, 0.62);
      const spr = schoolTints[tIdx++].get(col);
      const fade = 0.62 * (1 - smoothstep(1400, 2400, wy));
      if (fade < 0.02) continue;
      const fl = 13 * lerp(0.85, 1.15, h2);
      for (let k = 0; k < N_FISH; k++) {
        const f = fishOff[k];
        // the turn ripples through the school: each fish turns with its own small lag
        const facing = Math.cos(ph - 0.04 - f.lag * 0.3) >= 0 ? 1 : -1;
        const swirl = T * 0.4 + f.ph;
        const fx = sx + f.x * R + Math.sin(swirl) * 14 + Math.sin(T * 0.9 + f.ph * 3) * 6;
        const fy = sy + f.y * R + Math.cos(swirl * 1.3) * 9;
        const w = fl * f.s, h = w * 0.43;
        const wig = 1 + 0.06 * Math.sin(T * 9 + f.ph);
        ctx.globalAlpha = fade * (0.75 + 0.25 * f.lag);
        if (facing > 0) ctx.drawImage(spr, fx - w * 0.5, fy - h * 0.5, w * wig, h);
        else {
          ctx.save();
          ctx.translate(fx, fy);
          ctx.scale(-1, 1);
          ctx.drawImage(spr, -w * 0.5, -h * 0.5, w * wig, h);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  const JCELL = 900;
  function drawJellies(ctx, b, T) {
    if (b.bottom < 1200 || b.top > 4200) return;
    const ox = cam.x * (1 - JELLY_PAR), oy = cam.y * (1 - JELLY_PAR);
    const i0 = Math.floor((b.left - ox) / JCELL) - 1, i1 = Math.floor((b.right - ox) / JCELL) + 1;
    const j0 = Math.floor((b.top - oy) / JCELL) - 1, j1 = Math.floor((b.bottom - oy) / JCELL) + 1;
    const lit = env.lightAt(2000);
    // one colour per frame (from the view's depth): a shared tint must not change colour mid-frame
    const cyw = clamp((b.top + b.bottom) * 0.5, 1500, 3800);
    const wcc = env.waterColorAt(cyw, cam.x);
    const spr = jellyTint.get(mixRgb(mixRgb(wcc, [150, 200, 255], 0.35), [120, 200, 255], smoothstep(2400, 3600, cyw) * 0.5));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const h = hash1(i * 7349 + j * 1931 + 5);
        if (h > 0.34) continue;
        const h2 = hash1(i * 31 + j * 17 + 1), h3 = hash1(i * 61 + j * 89 + 2);
        const cy0 = (j + 0.5) * JCELL;
        const wy = cy0 + (h2 - 0.5) * JCELL * 0.6;
        if (wy < 1300 || wy > 4000) continue;
        const x = (i + 0.2 + 0.6 * h2) * JCELL + ox + Math.sin(T * 0.05 + h * 30) * 60;
        const y = wy + oy - ((T * (4 + 6 * h3)) % 400) + 200;
        const s = lerp(26, 56, h3);
        if (x + s < b.left || x - s > b.right || y + s * 2 < b.top || y - s > b.bottom) continue;
        // translucent: a touch lighter than the water, or faintly glowing in the dark
        const glow = smoothstep(2400, 3600, wy);
        const pulse = 1 + 0.08 * Math.sin(T * 1.6 + h * 20);
        ctx.globalAlpha = clamp01((0.34 + 0.24 * glow) * (0.6 + 0.6 * lit + glow * 0.5) * smoothstep(1300, 1800, wy));
        ctx.drawImage(spr, x - s * 0.5 * pulse, y - s * 0.5, s * pulse, s * 2 / pulse);
      }
    }
    ctx.globalAlpha = 1;
  }

  const wSpr = { canvas: null, res: 0, box: null, pad: 0 };
  const WHALE_BOX = { x0: -0.54, x1: 0.52, y0: -0.13, y1: 0.31 };
  function drawWhale(ctx, b, T) {
    const ox = cam.x * (1 - WHALE_PAR);
    const x = whale.x + ox, y = whale.y + cam.y * (1 - WHALE_PAR);
    const len = whale.len;
    if (x + len < b.left || x - len > b.right || y + len * 0.3 < b.top || y - len * 0.3 > b.bottom) return;
    const base = unitSprite('water:humpback', WHALE_BOX, len * game.view.scale * cam.zoom * 0.6, paintHumpback);
    if (!whaleTint || whaleTint.src !== base.canvas) whaleTint = new GradTint(base.canvas);
    // opaque, but coloured as seen through a lot of water (strip-sliced drawing must be opaque: no seams)
    const wy = Math.max(250, y);
    const wc = env.waterColorAt(wy, x);
    const fade = smoothstep(0, 8, whale.t) * 0.5;
    const back = mixRgb(wc, [wc[0] * 0.4, wc[1] * 0.5, wc[2] * 0.62], fade);
    const belly = mixRgb(wc, [wc[0] * 0.3, wc[1] * 0.38, wc[2] * 0.5], fade);
    wSpr.canvas = whaleTint.get(mixRgb(back, [170, 220, 240], 0.04 * env.lightAt(wy)), belly);
    wSpr.res = base.res;
    wSpr.box = base.box;
    wSpr.pad = base.pad;
    ctx.save();
    ctx.translate(x, y + Math.sin(T * 0.25) * 12);
    ctx.scale(whale.dir, 1);
    ctx.rotate(Math.sin(T * 0.25 + 1) * 0.035);
    drawUnitSpriteSwim(ctx, wSpr, len, whale.phase, 0.5, { strips: 22, waves: 0.6, swing: 0.035, power: 2.2, squash: 0 });
    ctx.restore();
  }

  function drawLights(ctx, b, T) {
    if (b.bottom < 2600) return;
    const ox = cam.x * (1 - LIGHT_PAR), oy = cam.y * (1 - LIGHT_PAR);
    const a = tLightA.get([90, 200, 255]), c = tLightB.get([110, 255, 190]);
    ctx.globalCompositeOperation = 'lighter';
    for (const o of flashes) {
      if (!o.on) continue;
      const k = o.t / o.life;
      const e = k < 0.15 ? k / 0.15 : Math.pow(1 - (k - 0.15) / 0.85, 2.2);
      const spr = o.hue < 0.6 ? a : c;
      for (let n = 0; n <= o.trail; n++) {
        const kk = clamp01(k * 1.6 - n * 0.22);
        if (kk <= 0) continue;
        const x = o.x + ox + o.vx * n * 0.4, y = o.y + oy + o.vy * n * 0.4;
        if (x < b.left - 20 || x > b.right + 20 || y < b.top - 20 || y > b.bottom + 20) continue;
        const s = 13 * o.size * (1 - n * 0.15);
        ctx.globalAlpha = clamp01(0.85 * e * (1 - n * 0.2));
        ctx.drawImage(spr, x - s * 0.5, y - s * 0.5, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    update,
    render,
    /** dev: force a whale pass now */
    whale: () => startWhale(true),
    state: { whale },
  };
}
