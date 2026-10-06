// WATER · body — the opaque water column from the surface line down:
//   colour field (env.waterColorAt) → drifting water masses → far parallax life → thermocline shimmer
//   → god rays → the bright rippling underside of the surface (Snell's window band) → lightning.
import { clamp01, lerp, smoothstep, mixRgb } from '../../core/math.js';
import { hash1, noise1 } from '../../core/rng.js';
import { blob, causticBand, ramp, Tint } from './sprites.js';
import { createRays } from './rays.js';
import { createDeepLife } from './deeplife.js';

export function createBody(game, core) {
  const cam = game.camera;
  const env = game.env;
  const rays = createRays(game, core);
  const deep = createDeepLife(game, core);

  // sprites
  const blobS = blob(128);
  const tMassLight = new Tint(blobS), tMassDark = new Tint(blobS), tMassTeal = new Tint(blobS);
  const CAUSTIC_W = 512, CAUSTIC_PAD = 96;
  const caustA = causticBand(CAUSTIC_W, 40, 101, CAUSTIC_PAD, 9, 4);
  const caustB = causticBand(CAUSTIC_W, 40, 202, CAUSTIC_PAD, 13, 5);
  const tCaustA = new Tint(caustA), tCaustB = new Tint(caustB);
  const glowRamp = ramp(4, 64, (v) => Math.pow(1 - v, 2.2));
  const tGlow = new Tint(glowRamp);
  const flashRamp = ramp(4, 64, (v) => Math.pow(1 - v, 1.5));
  const tFlash = new Tint(flashRamp);
  const thermoRamp = ramp(4, 64, (v) => Math.pow(Math.sin(Math.PI * v), 3));
  const tThermo = new Tint(thermoRamp);

  const tileA = { w: CAUSTIC_W, scale: 1, offset: 0 };
  const tileB = { w: CAUSTIC_W, scale: 1, offset: 0 };
  const lightCol = [0, 0, 0];

  function update(dt) {
    deep.update(dt);
  }

  function render(ctx) {
    const b = cam.bounds;
    if (b.bottom < core.crestY - 2) return;
    const L = core.light;
    const T = game.time.now;
    const off = core.off;
    ctx.save();
    const clipped = core.clipBelow(ctx);
    if (!off.field) core.drawBodyField(ctx);
    const M = ctx.getTransform();

    if (!off.masses) drawMasses(ctx, b, T);
    if (!off.deep) deep.render(ctx, b);
    if (!off.thermo) drawThermocline(ctx, b, T, M);
    if (!off.rays) rays.render(ctx, M);

    // ── the underside of the surface: luminous band + compressed caustic shimmer ──
    if (!off.snell && b.top < core.troughY + 120 && core.surfaceInView) {
      const p = env.palette;
      const lit = clamp01(0.08 + 0.92 * L.surface);
      const sky = mixRgb(mixRgb(p.skyHorizon, [255, 255, 255], 0.35), p.sunGlow, 0.25 * L.golden);
      lightCol[0] = sky[0] * lit;
      lightCol[1] = sky[1] * lit;
      lightCol[2] = sky[2] * lit;
      ctx.globalCompositeOperation = 'screen';
      // soft glow just under the line (light pouring in)
      ctx.globalAlpha = 0.14 + 0.08 * L.day;
      core.drawStrip(ctx, M, tGlow.get(lightCol), 0, 110, 3, null);
      // caustic shimmer: two layers sliding against each other
      ctx.globalCompositeOperation = 'lighter';
      const calm = 1 - 0.5 * L.rain;
      tileA.offset = T * 17;
      tileB.offset = -T * 11 + 200;
      tileB.scale = 0.78;
      ctx.globalAlpha = (0.22 + 0.1 * L.day) * calm;
      core.drawStrip(ctx, M, tCaustA.get(lightCol), 0.5, 30, 2, tileA);
      ctx.globalAlpha = (0.16 + 0.08 * L.day) * calm;
      core.drawStrip(ctx, M, tCaustB.get(lightCol), 0.5, 22, 2, tileB);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── lightning lights up the upper water for an instant ──
    if (L.lightning > 0.01 && b.top < 900) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(0.55 * L.lightning);
      ctx.drawImage(tFlash.get([170, 190, 255]), b.left - 10, Math.max(core.crestY, b.top - 10), b.w + 20, 820);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Big, very soft lighter/darker/greener washes so the column never reads as a flat CSS gradient.
  const MCW = 1100, MCH = 820, MPAR = 0.82;
  function drawMasses(ctx, b, T) {
    const L = core.light;
    const ox = cam.x * (1 - MPAR), oy = cam.y * (1 - MPAR);
    const i0 = Math.floor((b.left - ox) / MCW) - 1, i1 = Math.floor((b.right - ox) / MCW) + 1;
    const j0 = Math.max(-1, Math.floor((b.top - oy) / MCH) - 1), j1 = Math.floor((b.bottom - oy) / MCH) + 1;
    const lit = 0.25 + 0.75 * L.surface;
    const light = tMassLight.get([150 * lit + 20, 232 * lit + 10, 245 * lit + 20]);
    const dark = tMassDark.get([0, 14, 40]);
    const teal = tMassTeal.get([40 * lit, 190 * lit, 150 * lit]);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const h = hash1(i * 7919 + j * 104729 + 17);
        const h2 = hash1(i * 31 + j * 977 + 5);
        const h3 = hash1(i * 131 + j * 71 + 9);
        const cx = (i + 0.2 + 0.6 * h2) * MCW + ox + Math.sin(T * 0.031 + h * 9) * 90;
        const cy = (j + 0.2 + 0.6 * h3) * MCH + oy + Math.sin(T * 0.023 + h2 * 7) * 50;
        if (cy < -200) continue;
        const r = MCW * (0.55 + 0.6 * h);
        if (cx + r < b.left || cx - r > b.right || cy + r * 0.6 < b.top || cy - r * 0.6 > b.bottom) continue;
        const depthF = smoothstep(1400, 3800, cy);
        let spr, a;
        if (h < 0.38) {
          spr = light;
          a = 0.15 * (1 - depthF) * (1 - 0.6 * smoothstep(0, 260, -cy + 260));
        } else if (h < 0.55 && cy < 1800) {
          spr = teal;
          a = 0.11 * (1 - smoothstep(600, 1800, cy));
        } else {
          spr = dark;
          a = lerp(0.2, 0.28, depthF) * (0.6 + 0.4 * noise1(T * 0.02 + i * 3 + j, 3));
        }
        if (a < 0.005) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(spr, cx - r, cy - r * 0.6, r * 2, r * 1.2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Sunlit / twilight boundary: a faint refractive shimmer band where warm water meets cold.
  const THERMO_Y = 1480;
  function drawThermocline(ctx, b, T, M) {
    if (b.top > THERMO_Y + 220 || b.bottom < THERMO_Y - 220) return;
    const L = core.light;
    const lit = 0.25 + 0.75 * L.surface;
    const c = env.waterColorAt(THERMO_Y - 300, cam.x);
    const col = mixRgb(c, [190, 240, 255], 0.5);
    const spr = tThermo.get([col[0] * lit, col[1] * lit, col[2] * lit]);
    ctx.globalCompositeOperation = 'lighter';
    const step = 40;
    const x0 = Math.floor(b.left / step) * step - step, x1 = b.right + step;
    for (let band = 0; band < 2; band++) {
      const amp = 22 + band * 12, ph = band * 2.1;
      const hh = 70 - band * 18;
      ctx.globalAlpha = (0.05 - band * 0.015) * (0.65 + 0.35 * Math.sin(T * 0.3 + band));
      for (let x = x0; x < x1; x += step) {
        const y0 = THERMO_Y + band * 34 + Math.sin(x * 0.0021 + T * 0.13 + ph) * amp + Math.sin(x * 0.0057 - T * 0.21 + ph) * amp * 0.35;
        const y1 = THERMO_Y + band * 34 + Math.sin((x + step) * 0.0021 + T * 0.13 + ph) * amp + Math.sin((x + step) * 0.0057 - T * 0.21 + ph) * amp * 0.35;
        const m = (y1 - y0) / step;
        const k = M.a;
        ctx.setTransform(k, k * m, 0, k, k * x + M.e, k * (y0 - hh * 0.5) + M.f);
        ctx.drawImage(spr, 0, 0, step + 0.6, hh);
      }
    }
    ctx.setTransform(M);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { update, render, rays, deep };
}
