// WATER core — per-frame shared state for the four water passes:
//   · the sampled sea-surface polyline (one world-anchored sampling reused by every layer, so the far sea,
//     the body's top edge, the surface film and the fog all meet on exactly the same line)
//   · the low-res water colour field (env.waterColorAt sampled on a world grid → tiny canvases that are
//     bilinear-upscaled): an opaque copy for the body and an RGBA copy (alpha = depth fog) for the overlay.
//     Both come from the SAME sample pass, so the fog never shifts the background, only what is in front of it.
//   · sun / moon positions in world space (screen-anchored: the sky draws them at x × view width).
import { WORLD } from '../../core/config.js';
import { clamp, clamp01, lerp, smoothstep } from '../../core/math.js';

const MAX_WAVE = 14.5; // waves.js: max excursion ≈ ±14 px × sea

export function createWaterCore(game) {
  const cam = game.camera;
  const env = game.env;

  // ── surface polyline ───────────────────────────────────────────────────────
  let cap = 512;
  const core = {
    frame: -1,
    /** polyline sample count, spacing (world px) and samples */
    n: 0,
    step: 9,
    xs: new Float32Array(cap),
    ys: new Float32Array(cap),
    /** 1 where there is open water at the surface (not the island's dry land) */
    wet: new Uint8Array(cap),
    anyDry: false,
    /** highest crest / deepest trough of the visible line (world y) */
    crestY: 0,
    troughY: 0,
    /** largest possible excursion right now (px) */
    waveMax: MAX_WAVE,
    /** is any part of the surface band (horizon … deepest trough) on screen? */
    surfaceInView: true,
    /** world x of the sun / moon (they hang at x × view width on screen) */
    sunWX: 0,
    moonWX: 0,
    /** 0..1 visibility of the sun / moon low enough to light the sea */
    sunVis: 0,
    moonVis: 0,
    /** Lighting snapshot for this frame */
    light: { day: 1, night: 0, golden: 0, surface: 1, cloud: 0, rain: 0, wind: 0, sea: 1, fog: 0, lightning: 0, storm: 0 },

    // field
    field: null,
    /** Dev/profiling: set core.off.<feature> = true to skip a feature (e.g. masses, rays, snow, clip). */
    off: {},

    prepare,
    update,
    /** surface y at world x right now (exact function) */
    heightAt: (x) => game.world.waves.heightAt(x),
    /** Trace the surface polyline (left → right) into the current path. */
    traceLine,
    /** Path: surface line closed down to `bottom` (fill / clip the water below the surface). */
    traceBelow,
    /** Path: surface line closed UP to `top` (the region above the cut line). */
    traceAbove,
    clipBelow,
    drawBodyField,
    drawFogField,
    fogAlphaAt,
    /** Sample the polyline height at any world x (linear between samples; falls back to the exact function). */
    lineYAt,
    drawStrip,
  };

  /**
   * Draw a texture strip along the surface polyline as sheared quads, so the strip's top edge follows the
   * line exactly (a plain vertical gradient cannot follow a moving wave). Quad edges are snapped to device
   * pixels so translucent strips do not show hairline seams.
   *   M      the camera matrix (ctx.getTransform() in WORLD space)
   *   dy, h  strip spans [line + dy, line + dy + h] (world px)
   *   every  polyline samples per quad
   *   tile   null → the whole texture per quad; else {w: tile width (tex px), scale: tex px per world px,
   *          offset: tex px} for a horizontally tiling texture (tex must carry a wrap pad ≥ quad width)
   *   x0, x1 optional world-x range to cover
   */
  function drawStrip(ctx, M, tex, dy, h, every, tile, x0 = -1e9, x1 = 1e9) {
    const k = M.a, tx = M.e, ty = M.f;
    const xs = core.xs, ys = core.ys, n = core.n, wet = core.wet;
    const th = tex.height, tw = tex.width;
    let xa = Math.round(k * xs[0] + tx);
    for (let i = 0; i < n - 1; i += every) {
      const j = Math.min(i + every, n - 1);
      const xb = Math.round(k * xs[j] + tx);
      if (xs[j] < x0 || xs[i] > x1 || !(wet[i] && wet[j])) {
        xa = xb;
        continue;
      }
      const X0 = (xa - tx) / k;
      const w = (xb - xa) / k;
      if (w <= 0) continue;
      const m = (ys[j] - ys[i]) / (xs[j] - xs[i]);
      const Y0 = ys[i] + m * (X0 - xs[i]);
      ctx.setTransform(k, k * m, 0, k, xa, k * (Y0 + dy) + ty);
      if (tile) {
        const sw = w * tile.scale;
        let sx = (X0 * tile.scale + tile.offset) % tile.w;
        if (sx < 0) sx += tile.w;
        ctx.drawImage(tex, sx, 0, sw, th, 0, 0, w, h);
      } else {
        ctx.drawImage(tex, 0, 0, tw, th, 0, 0, w, h);
      }
      xa = xb;
    }
    ctx.setTransform(M);
  }

  function ensureCap(n) {
    if (n <= cap) return;
    cap = Math.ceil(n * 1.5);
    core.xs = new Float32Array(cap);
    core.ys = new Float32Array(cap);
    core.wet = new Uint8Array(cap);
  }

  function update() {
    // nothing time-based here yet; prepare() does the per-frame work lazily
  }

  function prepare() {
    if (core.frame === game.time.frame) return;
    core.frame = game.time.frame;
    const b = cam.bounds;
    const L = core.light, w = env.weather;
    L.day = env.daylight;
    L.night = env.night;
    L.golden = env.goldenHour;
    L.surface = env.surfaceLight;
    L.cloud = w.cloud;
    L.rain = w.rain;
    L.wind = w.wind;
    L.sea = w.sea;
    L.fog = w.fog;
    L.lightning = w.lightning;
    L.storm = smoothstep(1.2, 2.0, w.sea) * 0.5 + w.rain * 0.5 * smoothstep(0.55, 1, w.wind < 0 ? -w.wind : w.wind);
    core.waveMax = MAX_WAVE * Math.max(0.3, w.sea);

    // sun & moon in world space (screen-anchored)
    const v = game.view;
    core.sunWX = cam.x + (env.sun.x * v.w - v.w / 2 - cam.shakeX) / cam.zoom;
    core.moonWX = cam.x + (env.moon.x * v.w - v.w / 2 - cam.shakeX) / cam.zoom;
    core.sunVis = smoothstep(-0.04, 0.1, env.sun.elev);
    const mphase = 1 - Math.abs(env.moon.phase - 0.5) * 2; // 1 = full
    core.moonVis = smoothstep(0.0, 0.25, env.moon.elev) * env.night * (0.35 + 0.65 * mphase);

    // polyline
    const top = WORLD.horizonY - 8, bottom = core.waveMax + 4;
    core.surfaceInView = b.bottom > top && b.top < bottom + 90;
    const step = Math.round(clamp(9 / cam.zoom, 6, 22));
    core.step = step;
    const x0 = (Math.floor(b.left / step) - 2) * step;
    const n = Math.ceil((b.right - x0) / step) + 3;
    ensureCap(n);
    core.n = n;
    const xs = core.xs, ys = core.ys, wet = core.wet;
    const waves = game.world.waves, terr = game.world.terrain;
    let lo = 1e9, hi = -1e9, dry = false;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      const y = waves.heightAt(x);
      xs[i] = x;
      ys[i] = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
      const isWet = x > 700 || terr.heightAt(x) > y + 1.5;
      wet[i] = isWet ? 1 : 0;
      if (!isWet) dry = true;
    }
    core.anyDry = dry;
    core.crestY = lo;
    core.troughY = hi;

    updateField(b);
  }

  function lineYAt(x) {
    const i = (x - core.xs[0]) / core.step;
    if (i < 0 || i >= core.n - 1) return game.world.waves.heightAt(x);
    const k = i | 0, t = i - k;
    return core.ys[k] + (core.ys[k + 1] - core.ys[k]) * t;
  }

  function traceLine(ctx, dy = 0) {
    const xs = core.xs, ys = core.ys, n = core.n;
    ctx.moveTo(xs[0], ys[0] + dy);
    for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i] + dy);
  }
  function traceBelow(ctx, bottom) {
    const xs = core.xs, n = core.n;
    traceLine(ctx);
    ctx.lineTo(xs[n - 1], bottom);
    ctx.lineTo(xs[0], bottom);
    ctx.closePath();
  }
  function traceAbove(ctx, top) {
    const xs = core.xs, n = core.n;
    traceLine(ctx);
    ctx.lineTo(xs[n - 1], top);
    ctx.lineTo(xs[0], top);
    ctx.closePath();
  }
  /** Clip to the water below the surface line (no-op when the surface is above the view). */
  function clipBelow(ctx) {
    const b = cam.bounds;
    if (b.top > core.troughY + 1 || core.off.clip) return false;
    ctx.beginPath();
    traceBelow(ctx, b.bottom + 40);
    ctx.clip();
    return true;
  }

  // ── colour field ───────────────────────────────────────────────────────────
  const fieldCanvas = document.createElement('canvas');
  const fogCanvas = document.createElement('canvas');
  const fieldCtx = fieldCanvas.getContext('2d');
  const fogCtx = fogCanvas.getContext('2d');
  let img = null, fogImg = null;
  const F = {
    dx: 200, dy: 48, i0: 0, j0: 0, cols: 0, rows: 0, valid: false,
    sig: new Float32Array(16),
    computeMs: 0,
    recomputes: 0,
  };
  core.field = F;
  const sigNow = new Float32Array(16);

  function fogAlphaAt(y) {
    const L = core.light;
    const dark = 1 - clamp01((L.surface - 0.1) / 0.9); // 0 bright day … 1 night
    // pow > 1: cloud-dimmed days stay clear-ish; only real darkness (dusk, night) closes the shallows in
    let s = lerp(0.05, 0.46, Math.pow(dark, 1.3));
    s += 0.04 * L.storm + 0.02 * L.rain; // a little murk on stormy days

    const f = 1 - Math.exp(-Math.max(0, y) / 2600);
    const deep = 0.62;
    return clamp(s + (deep - s) * f, 0, 0.75);
  }

  function updateField(b) {
    const zoom = cam.zoom;
    const dx = zoom >= 0.8 ? 200 : 320;
    const dy = zoom >= 0.8 ? 44 : 64;
    const yTop = Math.max(b.top, -40);
    const i0 = Math.floor(b.left / dx) - 1;
    const i1 = Math.ceil(b.right / dx) + 1;
    const j0 = Math.floor(yTop / dy) - 1;
    const j1 = Math.ceil(Math.max(yTop, b.bottom) / dy) + 1;
    const cols = i1 - i0 + 1, rows = Math.max(2, j1 - j0 + 1);
    // signature: everything waterColorAt / fogAlphaAt reads
    const p = env.palette, L = core.light;
    sigNow[0] = L.surface; sigNow[1] = L.day; sigNow[2] = L.night; sigNow[3] = L.golden;
    sigNow[4] = L.cloud; sigNow[5] = L.rain; sigNow[6] = L.storm;
    sigNow[7] = p.skyMid[0] / 255; sigNow[8] = p.skyMid[1] / 255; sigNow[9] = p.skyMid[2] / 255;
    sigNow[10] = p.skyHorizon[0] / 255; sigNow[11] = p.skyHorizon[1] / 255; sigNow[12] = p.skyHorizon[2] / 255;
    let same = F.valid && F.dx === dx && F.dy === dy && F.i0 === i0 && F.j0 === j0 && F.cols === cols && F.rows === rows;
    if (same) {
      for (let k = 0; k < 13; k++) {
        if (Math.abs(sigNow[k] - F.sig[k]) > 0.0015) {
          same = false;
          break;
        }
      }
    }
    if (same) return;
    const t0 = performance.now();
    F.dx = dx; F.dy = dy; F.i0 = i0; F.j0 = j0; F.cols = cols; F.rows = rows; F.valid = true;
    F.sig.set(sigNow);
    if (fieldCanvas.width !== cols || fieldCanvas.height !== rows) {
      fieldCanvas.width = cols;
      fieldCanvas.height = rows;
      fogCanvas.width = cols;
      fogCanvas.height = rows;
      img = fieldCtx.createImageData(cols, rows);
      fogImg = fogCtx.createImageData(cols, rows);
    }
    const d = img.data, fd = fogImg.data;
    for (let j = 0; j < rows; j++) {
      const y = (j0 + j) * dy;
      const a = fogAlphaAt(y);
      const a255 = Math.round(a * 255);
      for (let i = 0; i < cols; i++) {
        const x = (i0 + i) * dx;
        const c = env.waterColorAt(y, x);
        const o = (j * cols + i) * 4;
        d[o] = fd[o] = c[0];
        d[o + 1] = fd[o + 1] = c[1];
        d[o + 2] = fd[o + 2] = c[2];
        d[o + 3] = 255;
        fd[o + 3] = a255;
      }
    }
    fieldCtx.putImageData(img, 0, 0);
    fogCtx.putImageData(fogImg, 0, 0);
    F.recomputes++;
    F.computeMs = F.computeMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  function drawField(ctx, canvas) {
    const F = core.field;
    ctx.imageSmoothingEnabled = true;
    // NOT 'high': Chrome's high-quality resampler on a ~100× upscale costs ~25 ms/frame; bilinear is free
    // and the field is smooth enough (rows every 44–64 px) that it shows no Mach bands.
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(canvas, (F.i0 - 0.5) * F.dx, (F.j0 - 0.5) * F.dy, F.cols * F.dx, F.rows * F.dy);
  }
  function drawBodyField(ctx) {
    drawField(ctx, fieldCanvas);
  }
  function drawFogField(ctx) {
    drawField(ctx, fogCanvas);
  }

  return core;
}
