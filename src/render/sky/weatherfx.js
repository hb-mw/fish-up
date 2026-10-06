// Weather in front of the whole scene (SCREEN space), always clipped to above the waterline:
// layered rain sheets slanted by the wind (+ a few big close drops), drifting fog banks that thicken toward
// the horizon, the lightning flash and a storm vignette.
import { createRng } from '../../core/rng.js';
import { makeCanvas, css, mix, lum, colorDelta, copy3, sstep, createNoiseTex, noiseAt, mod } from './util.js';
import { noise1 } from '../../core/rng.js';
import { WORLD } from '../../core/config.js';

const RAIN_LAYERS = [
  // tile px, streak length range, width, count, speed (px/s), alpha, parallax
  { tile: 220, len: [9, 18], w: 0.8, n: 110, speed: 640, alpha: 0.24, scale: 0.75 },
  { tile: 260, len: [18, 34], w: 1.0, n: 70, speed: 980, alpha: 0.32, scale: 1.0 },
  { tile: 300, len: [34, 70], w: 1.4, n: 26, speed: 1500, alpha: 0.42, scale: 1.25 },
];

export function createWeatherFx(game) {
  const env = game.env;
  const rng = createRng(2468);
  let devScale = 0;
  const layers = RAIN_LAYERS.map((L) => ({ ...L, canvas: null, pattern: null, ox: 0, oy: 0, mtx: null }));
  const fogTex = createNoiseTex(1357, 128, 5, 4, 0.55);
  const banks = [];
  const fogTint = { canvas: null, key: [-1, -1, -1] };
  let fogMask = null;
  const fogGrad = { g: null, c: [-1, -1, -1], k: 0, gap: 0 };
  const veilGrad = { g: null, c: [-1, -1, -1], k: 0, gap: 0 };
  let vignette = null;
  let fadeY = 0, airBottom = 0;
  const tmpP = { x: 0, y: 0 };
  let rainAmt = 0;
  let gust = 0;

  function buildRain(scale) {
    devScale = scale;
    for (const L of layers) {
      const S = Math.round(L.tile * scale);
      const c = makeCanvas(S, S), g = c.getContext('2d');
      g.scale(scale, scale);
      g.lineCap = 'round';
      for (let i = 0; i < L.n; i++) {
        const x = rng.range(0, L.tile), y = rng.range(0, L.tile);
        const len = rng.range(L.len[0], L.len[1]);
        const a = rng.range(0.35, 1);
        const grd = g.createLinearGradient(0, y, 0, y + len);
        grd.addColorStop(0, `rgba(255,255,255,0)`);
        grd.addColorStop(0.7, `rgba(255,255,255,${(a * 0.7).toFixed(3)})`);
        grd.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
        g.strokeStyle = grd;
        g.lineWidth = L.w * rng.range(0.7, 1.2);
        // draw wrapped copies so the tile repeats seamlessly
        for (const dy of [0, -L.tile]) {
          if (y + dy + len < 0 || y + dy > L.tile) continue;
          g.beginPath();
          g.moveTo(x, y + dy);
          g.lineTo(x, y + dy + len);
          g.stroke();
        }
      }
      L.canvas = c;
      L.pattern = null;
      L.mtx = new DOMMatrix();
    }
  }

  function buildFog() {
    // a soft, lumpy bank (white mask) — tinted on demand
    const W = 384, H = 96;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const n = noiseAt(fogTex, u * 128 * 1.5, v * 40);
        const env2 = Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * v), 0.9);
        const top = 0.25 + 0.5 * n;
        const a = Math.max(0, Math.min(1, env2 * 1.4 - (1 - v) * top * 0.7)) * (0.55 + 0.45 * n);
        const i = (y * W + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    fogMask = c;
    fogTint.canvas = makeCanvas(W, H);
    for (let i = 0; i < 7; i++) {
      banks.push({ u: (i + rng.range(0.1, 0.9)) / 7, alt: rng.range(-30, 70), w: rng.range(700, 1300), h: rng.range(90, 170), sp: rng.range(0.6, 1.4), par: rng.range(0.15, 0.4) });
    }
  }
  buildFog();

  function tintedFog(col) {
    if (colorDelta(fogTint.key, col) > 2) {
      copy3(fogTint.key, col);
      const g = fogTint.canvas.getContext('2d');
      g.globalCompositeOperation = 'copy';
      g.drawImage(fogMask, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = css(col);
      g.fillRect(0, 0, fogMask.width, fogMask.height);
      g.globalCompositeOperation = 'source-over';
    }
    return fogTint.canvas;
  }

  let fogDrift = 0;
  function update(dt) {
    const w = env.weather;
    rainAmt = w.rain;
    // gusty slant in storms
    const t = game.time.now;
    gust = (noise1(t * 0.35, 77) - 0.5) * 2 * (0.15 + 0.5 * sstep(0.6, 1, w.rain));
    fogDrift += (w.wind * 9 + 3) * dt;
    if (rainAmt < 0.01) return;
    const slant = Math.max(-0.9, Math.min(0.9, w.wind * 0.55 + gust * 0.35));
    for (const L of layers) {
      const v = L.speed * (0.85 + 0.3 * w.rain);
      L.oy += v * dt;
      L.ox += v * slant * dt;
    }
  }

  function fogColor() {
    const p = env.palette;
    const c = mix(mix(p.skyHorizon, p.haze, 0.45), p.ambient, 0.15);
    return c;
  }

  function drawFog(ctx, F, top) {
    const fog = env.weather.fog;
    if (fog < 0.01) return;
    const c = fogColor();
    // overall veil above the water
    ctx.globalAlpha = fog * 0.3;
    ctx.fillStyle = css(c);
    ctx.fillRect(0, top, F.W, airBottom - top);
    // thickening toward the horizon and over the distant sea (swallows the far scenery)
    const h0 = F.hy - 420 * F.k;
    // the band peaks on the horizon and is gone before the highest wave crests (no hard edge across the waves)
    const gap = Math.max(2, Math.round(fadeY - F.hy));
    if (!fogGrad.g || colorDelta(fogGrad.c, c) > 1.5 || fogGrad.k !== F.k || fogGrad.gap !== gap) {
      copy3(fogGrad.c, c);
      fogGrad.k = F.k;
      fogGrad.gap = gap;
      const g = ctx.createLinearGradient(0, -420 * F.k, 0, gap);
      const yH = (420 * F.k) / (420 * F.k + gap);
      g.addColorStop(0, css(c, 0));
      g.addColorStop(yH * 0.55, css(c, 0.32));
      g.addColorStop(yH * 0.88, css(c, 0.72));
      g.addColorStop(yH, css(c, 0.93));
      g.addColorStop(yH + (1 - yH) * 0.45, css(c, 0.45));
      g.addColorStop(1, css(c, 0));
      fogGrad.g = g;
    }
    ctx.save();
    ctx.translate(0, F.hy);
    ctx.globalAlpha = fog;
    ctx.fillStyle = fogGrad.g;
    const y0 = Math.max(top, h0);
    ctx.fillRect(0, y0 - F.hy, F.W, fadeY - y0);
    ctx.restore();
    // drifting banks
    const tex = tintedFog(mix(c, [255, 255, 255], 0.06 * (1 - env.night)));
    for (const b of banks) {
      const w = b.w * F.k, h = b.h * F.k;
      const span = F.W + w;
      const x = mod(b.u * span + fogDrift * b.sp - b.par * (F.camX - 960) + F.sx, span) - w;
      const y = F.hy - (b.alt + b.h * 0.6) * F.k;
      ctx.globalAlpha = Math.min(1, fog * 0.95);
      ctx.drawImage(tex, x, y, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, F, top) {
    const r = rainAmt;
    if (r < 0.01) return;
    if (devScale !== game.view.scale) buildRain(game.view.scale);
    const p = env.palette;
    const bright = 0.35 + 0.65 * Math.min(1, lum(p.ambient) * 1.15) + env.weather.lightning * 0.6;
    const slant = Math.max(-0.9, Math.min(0.9, env.weather.wind * 0.55 + gust * 0.35));
    const storm = sstep(0.6, 1, r);
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      const amt = li === 0 ? sstep(0, 0.4, r) : li === 1 ? sstep(0.1, 0.6, r) : sstep(0.35, 0.9, r);
      if (amt < 0.01) continue;
      if (!L.pattern) L.pattern = ctx.createPattern(L.canvas, 'repeat');
      const m = L.mtx;
      const s = L.scale / devScale;
      // pattern space → screen: translate(scroll) · shear(slant) · scale
      m.a = s;
      m.b = 0;
      m.c = slant * s;
      m.d = s;
      m.e = mod(L.ox + F.sx, L.tile * 4);
      m.f = mod(L.oy, L.tile * L.scale);
      L.pattern.setTransform(m);
      ctx.globalAlpha = Math.min(1, L.alpha * amt * bright * (1 + storm * 0.35));
      ctx.fillStyle = L.pattern;
      ctx.fillRect(0, top, F.W, airBottom - top);
    }
    // a wet grey veil of distant rain over the horizon
    const veil = sstep(0.2, 1, r);
    if (veil > 0.01) {
      const c = mix(p.skyHorizon, p.cloudShade, 0.4);
      const gap = Math.max(2, Math.round(fadeY - F.hy));
      if (!veilGrad.g || colorDelta(veilGrad.c, c) > 1.5 || veilGrad.k !== F.k || veilGrad.gap !== gap) {
        copy3(veilGrad.c, c);
        veilGrad.k = F.k;
        veilGrad.gap = gap;
        const g = ctx.createLinearGradient(0, -240 * F.k, 0, gap);
        const yH = (240 * F.k) / (240 * F.k + gap);
        g.addColorStop(0, css(c, 0));
        g.addColorStop(yH * 0.7, css(c, 0.3));
        g.addColorStop(yH, css(c, 0.4));
        g.addColorStop(yH + (1 - yH) * 0.45, css(c, 0.2));
        g.addColorStop(1, css(c, 0));
        veilGrad.g = g;
      }
      ctx.save();
      ctx.translate(0, F.hy);
      ctx.globalAlpha = veil;
      ctx.fillStyle = veilGrad.g;
      const y0 = Math.max(top, F.hy - 240 * F.k);
      ctx.fillRect(0, y0 - F.hy, F.W, fadeY - y0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Clip to the air: everything above the actual wave line (not the flat mean sea level). */
  function clipAboveWaves(ctx, F) {
    const cam = game.camera, waves = game.world && game.world.waves;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(F.W + 2, -2);
    if (!waves) {
      ctx.lineTo(F.W + 2, F.wy);
      ctx.lineTo(-2, F.wy);
    } else {
      const step = 14;
      for (let sx = F.W + step; sx >= -step; sx -= step) {
        const wx = cam.screenToWorld(sx, 0, tmpP).x;
        ctx.lineTo(sx, cam.screenY(waves.heightAt(wx)));
      }
    }
    ctx.closePath();
    ctx.clip();
  }

  function draw(ctx, F) {
    const top = 0;
    if (F.wy <= top + 1) return;
    const w = env.weather;
    const fl = w.lightning;
    const storm = sstep(0.4, 1, w.rain) * sstep(0.8, 1, w.cloud);
    if (w.rain < 0.01 && w.fog < 0.01 && fl < 0.01 && storm < 0.01) return;
    // horizon bands fade out just above the highest crests (14·sea px is the wave amplitude)
    fadeY = game.camera.screenY(Math.max(WORLD.horizonY + 6, -(14 * w.sea + 5)));
    airBottom = game.camera.screenY(14 * w.sea + 4); // reaches the deepest troughs; the wave clip trims it
    ctx.save();
    clipAboveWaves(ctx, F);
    // storm mood: darken the upper scene a touch
    if (storm > 0.01) {
      if (!vignette) {
        vignette = ctx.createLinearGradient(0, 0, 0, 1);
        vignette.addColorStop(0, 'rgba(8,12,22,0.42)');
        vignette.addColorStop(0.6, 'rgba(8,12,22,0.14)');
        vignette.addColorStop(1, 'rgba(8,12,22,0)');
      }
      ctx.save();
      ctx.scale(1, F.wy);
      ctx.globalAlpha = storm;
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, F.W, 1);
      ctx.restore();
    }
    drawFog(ctx, F, top);
    drawRain(ctx, F, top);
    if (fl > 0.01) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(190,205,255,${Math.min(0.55, fl * 0.42).toFixed(3)})`;
      ctx.fillRect(0, 0, F.W, airBottom);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  return { update, draw };
}
