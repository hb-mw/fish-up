// The ground itself: a pure world-space painter. bakeGround() paints the world rectangle [x0,x1]×[y0,y1]
// into a canvas at `res` device px per world px. Everything is a function of world position only, so
// neighbouring tiles (and any resolution) produce matching pixels.
//
// Recipe: interior fill → surface-following depth shading (stacked translucent fat strokes of the profile,
//         deep→shallow) → deep mottling → material detail (strata, joints, pebbles, crusts, pillows…) on a temp
//         layer, faded out with depth through a feathered mask so nothing reaches the plain interior →
//         sediment caps on flat rock, lit lip, grass fringe.
import { heightAt } from '../../world/terrain.js';
import { smoothstep, clamp } from '../../core/math.js';
import { REACH, groundColor, interiorColor, matWeights, MAT_COUNT, TURF, SAND, KELP, WALL, OOZE, BASALT, hGradient } from './materials.js';
import { makeCanvas, cellRng, vnoise, h01 } from './util.js';

export const STEP = 4; // the kernel samples the profile every 4 px — draw through exactly those samples

// depth bands (px below the surface), widest first; translucent so steps melt into a smooth ramp
const BANDS = [];
{
  const N = 40;
  for (let k = N; k >= 1; k--) BANDS.push(REACH * Math.pow(k / N, 1.5));
}
const BAND_ALPHA = 0.42;

// ── shared scratch canvases + textures ─────────────────────────────────────────────────────────────
let tA = null, tB = null;
function temp(which, w, h) {
  let c = which === 0 ? tA : tB;
  if (!c || c.width < w || c.height < h) {
    c = makeCanvas(Math.max(w, c ? c.width : 0), Math.max(h, c ? c.height : 0));
    if (which === 0) tA = c;
    else tB = c;
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, w, h);
  return c;
}

let grainCanvas = null, mottleCanvas = null;
function grainTex() {
  if (grainCanvas) return grainCanvas;
  const N = 256;
  grainCanvas = makeCanvas(N, N);
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(N, N);
  const d = img.data;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = h01(x + y * N, 5);
      const i = (y * N + x) * 4;
      if (v < 0.06) {
        d[i] = 30; d[i + 1] = 24; d[i + 2] = 18; d[i + 3] = 30 + v * 700;
      } else if (v > 0.95) {
        d[i] = 255; d[i + 1] = 250; d[i + 2] = 235; d[i + 3] = 24 + (v - 0.95) * 1200;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}
/** Large soft light/dark blotches, tileable (512 px). */
export function mottleTex() {
  if (mottleCanvas) return mottleCanvas;
  const N = 512;
  mottleCanvas = makeCanvas(N, N);
  const g = mottleCanvas.getContext('2d');
  const rng = cellRng(3, 9, 77);
  for (let i = 0; i < 150; i++) {
    const x = rng.range(0, N), y = rng.range(0, N), r = rng.range(14, 60);
    const light = rng.chance(0.5);
    const a = rng.range(0.03, 0.08);
    for (const ox of [-N, 0, N]) {
      for (const oy of [-N, 0, N]) {
        const cx = x + ox, cy = y + oy;
        if (cx + r < 0 || cx - r > N || cy + r < 0 || cy - r > N) continue;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        const col = light ? '255,246,226' : '20,16,12';
        gr.addColorStop(0, `rgba(${col},${a})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }
  }
  return mottleCanvas;
}
/** Alpha of the deep mottle pass — shared with the solid-interior fill so they match exactly. */
export const DEEP_MOTTLE_ALPHA = 0.32;

// ── Voronoi rock cells (jittered grid; deterministic in world space) ───────────────────────────────
function clipHalf(poly, mx, my, nx, ny) {
  // keep points p with (p - m)·n <= 0
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a[0] - mx) * nx + (a[1] - my) * ny;
    const db = (b[0] - mx) * nx + (b[1] - my) * ny;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const cellPt = (i, j, cw, ch, salt, jit) => [
  (i + 0.5 + (h01(i * 7919 + j * 104729, salt) - 0.5) * jit) * cw,
  (j + 0.5 + (h01(i * 6271 + j * 7907, salt + 1) - 0.5) * jit) * ch,
];
/** Visit Voronoi cells (convex polygons) of a jittered cw×ch grid overlapping the rect. */
function forVoronoi(x0, y0, x1, y1, cw, ch, salt, jit, fn) {
  const i0 = Math.floor(x0 / cw) - 1, i1 = Math.floor(x1 / cw) + 1;
  const j0 = Math.floor(y0 / ch) - 1, j1 = Math.floor(y1 / ch) + 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const p = cellPt(i, j, cw, ch, salt, jit);
      let poly = [[p[0] - cw * 2, p[1] - ch * 2], [p[0] + cw * 2, p[1] - ch * 2], [p[0] + cw * 2, p[1] + ch * 2], [p[0] - cw * 2, p[1] + ch * 2]];
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          if ((!di && !dj) || (Math.abs(di) === 2 && Math.abs(dj) === 2)) continue;
          const q = cellPt(i + di, j + dj, cw, ch, salt, jit);
          poly = clipHalf(poly, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, q[0] - p[0], q[1] - p[1]);
          if (poly.length < 3) break;
        }
      }
      if (poly.length >= 3) fn(poly, p, cellRng(i, j, salt + 5));
    }
  }
}
function inset(poly, cx, cy, d) {
  return poly.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, 1 - d / L);
    return [cx + dx * k, cy + dy * k];
  });
}
/** Shade one rock cell: lit upper-left, shadowed lower-right, dark crevice around, light rim on top edges. */
function rockCell(a, poly, p, rng, base, w, o) {
  let cx = 0, cy = 0;
  for (const v of poly) {
    cx += v[0];
    cy += v[1];
  }
  cx /= poly.length;
  cy /= poly.length;
  let r = 0;
  for (const v of poly) r = Math.max(r, Math.hypot(v[0] - cx, v[1] - cy));
  const ins = inset(poly, cx, cy, o.gap);
  const lum = rng.range(0.82, 1.16);
  const c = [base[0] * lum, base[1] * lum, base[2] * lum];
  a.beginPath();
  for (const v of ins) a.lineTo(v[0], v[1]);
  a.closePath();
  const gr = a.createLinearGradient(cx - r * 0.6, cy - r * 0.8, cx + r * 0.5, cy + r * 0.9);
  gr.addColorStop(0, `rgba(${Math.min(255, c[0] * 1.32) | 0},${Math.min(255, c[1] * 1.32) | 0},${Math.min(255, c[2] * 1.3) | 0},${(o.alpha * w).toFixed(3)})`);
  gr.addColorStop(0.5, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(o.alpha * w).toFixed(3)})`);
  gr.addColorStop(1, `rgba(${c[0] * 0.55 | 0},${c[1] * 0.55 | 0},${c[2] * 0.55 | 0},${(o.alpha * w).toFixed(3)})`);
  a.fillStyle = gr;
  if (o.round) {
    a.strokeStyle = gr;
    a.lineWidth = o.round;
    a.stroke();
  }
  a.fill();
  // crevice
  a.lineWidth = o.crease;
  a.strokeStyle = `rgba(14,11,9,${(o.creaseA * w).toFixed(3)})`;
  a.stroke();
  // rim light on edges facing up / up-left
  a.beginPath();
  for (let i = 0; i < ins.length; i++) {
    const p0 = ins[i], p1 = ins[(i + 1) % ins.length];
    const nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]); // outward normal for clockwise-in-screen polys
    const L = Math.hypot(nx, ny) || 1;
    if ((ny / L) < -0.45 || (nx / L) < -0.8) {
      a.moveTo(p0[0], p0[1]);
      a.lineTo(p1[0], p1[1]);
    }
  }
  a.lineWidth = o.rim;
  a.strokeStyle = `rgba(255,240,214,${(o.rimA * w).toFixed(3)})`;
  a.stroke();
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
const WT = new Float32Array(MAT_COUNT);
const wAt = (x, m) => (matWeights(x, WT), WT[m]);
const rockW = (x) => (matWeights(x, WT), WT[KELP] + WT[WALL]);

/** Horizontal gradient of one rgb colour whose alpha follows alphaFn(x) (sampled every 32 px). */
function alphaGrad(g, x0, x1, rgb, alphaFn) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  const span = x1 - x0;
  const add = (x) => gr.addColorStop(clamp((x - x0) / span, 0, 1), `rgba(${rgb},${clamp(alphaFn(x), 0, 1).toFixed(3)})`);
  add(x0);
  for (let x = Math.ceil(x0 / 32) * 32; x < x1; x += 32) if (x > x0) add(x);
  add(x1);
  return gr;
}

/**
 * Paint the ground for world rect [x0,x1]×[y0,y1] into canvas `g` (2D context) at `res` device px per world px.
 * The canvas must be ≥ ceil((x1-x0)*res) × ceil((y1-y0)*res). Returns 'empty' | 'solid' | 'band'.
 */
export function bakeGround(g, x0, y0, x1, y1, res) {
  const W = Math.ceil((x1 - x0) * res), H = Math.ceil((y1 - y0) * res);
  const ax0 = Math.floor((x0 - REACH - 8) / STEP) * STEP;
  const ax1 = Math.ceil((x1 + REACH + 8) / STEP) * STEP;
  const n = Math.round((ax1 - ax0) / STEP) + 1;
  const py = new Float32Array(n);
  let minIn = Infinity, maxAll = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = ax0 + i * STEP;
    const y = heightAt(x);
    py[i] = y;
    if (y > maxAll) maxAll = y;
    if (x >= x0 - 8 && x <= x1 + 8 && y < minIn) minIn = y;
  }
  const setT = (c) => c.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  if (minIn > y1 + 4) return 'empty';
  setT(g);
  if (y0 > maxAll + REACH + 4) {
    fillInterior(g, x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    return 'solid';
  }

  const bottom = y1 + 40;
  const ground = new Path2D();
  const line = new Path2D();
  ground.moveTo(ax0, bottom);
  for (let i = 0; i < n; i++) {
    const x = ax0 + i * STEP;
    ground.lineTo(x, py[i]);
    if (i === 0) line.moveTo(x, py[i]);
    else line.lineTo(x, py[i]);
  }
  ground.lineTo(ax1, bottom);
  ground.closePath();
  // coarser copies of the line for the wide strokes (cheaper; 4-px detail is invisible 100 px down)
  const coarse = new Path2D(), mid = new Path2D();
  for (let i = 0; i < n; i++) {
    const x = ax0 + i * STEP;
    if (i % 4 === 0 || i === n - 1) coarse.lineTo(x, py[i]);
    if (i % 2 === 0 || i === n - 1) mid.lineTo(x, py[i]);
  }

  // 1 ── body: interior + surface-following depth shading
  g.save();
  g.clip(ground);
  fillInterior(g, x0 - 2, y0 - 2, x1 + 2, y1 + 2, true);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.globalAlpha = BAND_ALPHA;
  for (const d of BANDS) {
    if (d < (y0 - maxAll) - 4) continue; // band can't reach this rect
    g.lineWidth = d * 2;
    g.strokeStyle = hGradient(g, ax0, ax1, (x, out) => groundColor(x, d * 0.9, out));
    g.stroke(d > 90 ? coarse : d > 30 ? mid : line);
  }
  g.globalAlpha = 1;
  // deep mottling (unmasked — the solid interior fill repeats it exactly)
  g.globalAlpha = DEEP_MOTTLE_ALPHA;
  g.fillStyle = g.createPattern(mottleTex(), 'repeat');
  g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  g.globalAlpha = 1;
  g.restore();

  // 2 ── material detail on a temp layer, masked to fade out with depth: a deep pass (fades by ~270 px) and a
  //      weathered-skin pass (fades by ~110 px) for the strata faces, joints, crusts and buried bits
  g.save();
  g.clip(ground);
  for (const pass of [0, 1]) {
    const A = temp(0, W, H);
    const a = A.getContext('2d');
    setT(a);
    a.lineJoin = 'round';
    a.lineCap = 'round';
    if (pass === 0) paintDeep(a, x0, y0, x1, y1);
    else paintSkin(a, x0, y0, x1, y1, ax0, ax1, py, n, line);
    const B = temp(1, W, H);
    const b = B.getContext('2d');
    setT(b);
    b.lineJoin = 'round';
    b.lineCap = 'round';
    b.strokeStyle = '#fff';
    const MASK = pass === 0
      ? [[270, 0.16], [240, 0.2], [210, 0.26], [180, 0.34], [150, 0.45], [118, 1]]
      : [[120, 0.2], [100, 0.25], [82, 0.33], [64, 0.45], [46, 1]];
    for (const [d, al] of MASK) {
      b.globalAlpha = al;
      b.lineWidth = d * 2;
      b.stroke(d > 90 ? coarse : mid);
    }
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'destination-in';
    a.drawImage(B, 0, 0, W, H, 0, 0, W, H);
    a.globalCompositeOperation = 'source-over';
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(A, 0, 0, W, H, 0, 0, W, H);
  }
  setT(g);

  // 3 ── surface: sediment caps on flat rock, lit lip
  paintLip(g, ax0, ax1, py, line, n);
  g.restore();
  paintFringe(g, x0, x1, ax0, py, n);
  return 'band';
}

/**
 * Plain interior (+ the deep mottle) for a world rect. `skipMottle` when the caller adds it later.
 * Used for solid tiles and by the per-frame solid fill so both match the band tiles' depths.
 */
export function fillInterior(g, x0, y0, x1, y1, skipMottle = false) {
  g.fillStyle = hGradient(g, x0, x1, interiorColor);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (skipMottle) return;
  g.globalAlpha = DEEP_MOTTLE_ALPHA;
  g.fillStyle = g.createPattern(mottleTex(), 'repeat');
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.globalAlpha = 1;
}

// ── material detail ─────────────────────────────────────────────────────────────────────────────────
const anyMat = (x0, x1, m) => {
  for (let x = x0 - 64; x <= x1 + 64; x += 32) if (wAt(x, m) > 0.02) return true;
  return false;
};

/** Deep pass: texture and large, low-contrast structure through the whole band. */
function paintDeep(a, x0, y0, x1, y1) {
  const gx0 = x0 - 4, gy0 = y0 - 4, gw = x1 - x0 + 8, gh = y1 - y0 + 8;
  a.fillStyle = a.createPattern(mottleTex(), 'repeat');
  a.save();
  a.translate(173, 91); // decorrelate from the deep mottle
  a.fillRect(gx0 - 173, gy0 - 91, gw, gh);
  a.restore();
  a.fillStyle = a.createPattern(grainTex(), 'repeat');
  a.fillRect(gx0, gy0, gw, gh);

  if (anyMat(x0, x1, TURF)) {
    forCells(x0, y0, x1, y1, 30, 30, 12, (rng, cx, cy) => {
      if (!rng.chance(0.4)) return;
      const x = cx + rng.range(0, 30), y = cy + rng.range(0, 30);
      const w = wAt(x, TURF);
      const d = y - heightAt(x);
      if (w < 0.05 || d < 16 || d > 170) return;
      const r = rng.range(1.6, 5);
      pebble(a, x, y, r, r * rng.range(0.55, 0.85), [140, 122, 100], 0.8 * w, rng.range(-0.4, 0.4));
    });
  }
  if (anyMat(x0, x1, SAND)) {
    forCells(x0, y0, x1, y1, 34, 20, 23, (rng, cx, cy) => {
      if (!rng.chance(0.35)) return;
      const x = cx + rng.range(0, 34), y = cy + rng.range(0, 34);
      const w = wAt(x, SAND);
      const d = y - heightAt(x);
      if (w < 0.05 || d < 30 || d > 220) return;
      const r = rng.range(1.2, 3.4);
      pebble(a, x, y, r, r * 0.7, rng.chance(0.5) ? [176, 158, 128] : [138, 124, 108], 0.6 * w, rng.range(-0.5, 0.5));
    });
  }
  const rk = anyMat(x0, x1, KELP) || anyMat(x0, x1, WALL);
  if (rk) {
    forVoronoi(x0 - 60, y0 - 60, x1 + 60, y1 + 60, 170, 120, 83, 0.9, (poly, p, rng) => {
      const w = wAt(p[0], KELP) * 0.8;
      if (w < 0.03) return;
      const d = p[1] - heightAt(p[0]);
      if (d < -60 || d > 330) return;
      rockCell(a, poly, p, rng, [104, 96, 86], w, { gap: 3, round: 10, alpha: 0.14, crease: 3, creaseA: 0.1, rim: 2, rimA: 0.04 });
    });
  }
  if (anyMat(x0, x1, BASALT)) {
    forVoronoi(x0 - 40, y0 - 60, x1 + 40, y1 + 60, 58, 150, 93, 0.8, (poly, p, rng) => {
      const w = wAt(p[0], BASALT);
      if (w < 0.03) return;
      const d = p[1] - heightAt(p[0]);
      if (d < -90 || d > 330) return;
      rockCell(a, poly, p, rng, [62, 64, 74], w, { gap: 2, round: 0, alpha: 0.24, crease: 2, creaseA: 0.3, rim: 1.2, rimA: 0.08 });
    });
  }
  if (anyMat(x0, x1, OOZE)) {
    forCells(x0, y0, x1, y1, 40, 20, 53, (rng, cx, cy) => {
      if (!rng.chance(0.3)) return;
      const x = cx + rng.range(0, 40), y = cy + rng.range(0, 40);
      const w = wAt(x, OOZE);
      const d = y - heightAt(x);
      if (w < 0.05 || d < 30 || d > 220) return;
      const r = rng.range(1.6, 4);
      pebble(a, x, y, r, r * 0.75, [62, 54, 46], 0.6 * w, rng.range(-0.5, 0.5));
    });
  }
}

/** Skin pass: what weathering exposes right at the surface. */
function paintSkin(a, x0, y0, x1, y1, ax0, ax1, py, n, line) {
  if (anyMat(x0, x1, TURF)) paintTurf(a, x0, y0, x1, y1);
  if (anyMat(x0, x1, SAND)) paintSand(a, x0, y0, x1, y1, ax0, ax1, line);
  if (anyMat(x0, x1, KELP) || anyMat(x0, x1, WALL)) paintRock(a, x0, y0, x1, y1, ax0, ax1, py, n);
  if (anyMat(x0, x1, OOZE)) paintOoze(a, x0, y0, x1, y1, ax0, ax1, line);
  if (anyMat(x0, x1, BASALT)) paintBasalt(a, x0, y0, x1, y1);
}

/** Iterate deterministic world cells of size `cs` overlapping the rect (+margin). */
function forCells(x0, y0, x1, y1, cs, margin, salt, fn) {
  const cx0 = Math.floor((x0 - margin) / cs), cx1 = Math.floor((x1 + margin) / cs);
  const cy0 = Math.floor((y0 - margin) / cs), cy1 = Math.floor((y1 + margin) / cs);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) fn(cellRng(cx, cy, salt), cx * cs, cy * cs);
  }
}
/** Iterate deterministic slots along x only (things that live on the surface). */
function forSlots(x0, x1, cs, margin, salt, fn) {
  const c0 = Math.floor((x0 - margin) / cs), c1 = Math.floor((x1 + margin) / cs);
  for (let c = c0; c <= c1; c++) fn(cellRng(c, 0, salt), c * cs);
}

function pebble(a, x, y, rx, ry, rgb, al, rot = 0) {
  const gr = a.createRadialGradient(x - rx * 0.35, y - ry * 0.5, 0, x, y, Math.max(rx, ry) * 1.1);
  gr.addColorStop(0, `rgba(${Math.min(255, rgb[0] * 1.4) | 0},${Math.min(255, rgb[1] * 1.4) | 0},${Math.min(255, rgb[2] * 1.4) | 0},${al})`);
  gr.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${al})`);
  gr.addColorStop(1, `rgba(${rgb[0] * 0.5 | 0},${rgb[1] * 0.5 | 0},${rgb[2] * 0.5 | 0},${al})`);
  a.fillStyle = gr;
  a.beginPath();
  a.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  a.fill();
}

function paintTurf(a, x0, y0, x1, y1) {
  // fine roots hanging from the grass skin
  forSlots(x0, x1, 8, 40, 11, (rng, cx) => {
    const x = cx + rng.range(0, 8);
    const w = wAt(x, TURF);
    if (w < 0.05) return;
    let px = x, py = heightAt(x) + 7;
    a.strokeStyle = `rgba(66,46,26,${(0.4 * w).toFixed(3)})`;
    a.lineWidth = rng.range(0.5, 1.1);
    a.beginPath();
    a.moveTo(px, py);
    const len = rng.range(6, 26);
    for (let s = 0; s < len; s += 4) {
      px += rng.range(-2.2, 2.2);
      py += 4;
      a.lineTo(px, py);
    }
    a.stroke();
  });
  void y0; void y1;
}

function paintSand(a, x0, y0, x1, y1, ax0, ax1, line) {
  const sw = (x) => wAt(x, SAND);
  // bedding: faint layers that follow the surface and fade in and out along x
  const layers = [[8, 1.3, '255,248,228', 0.34], [14, 2.2, '128,100,64', 0.13], [22, 1.1, '255,246,222', 0.24],
    [33, 2.6, '112,88,58', 0.12], [46, 1.3, '255,240,210', 0.16], [62, 3, '96,74,48', 0.11], [82, 1.5, '250,232,200', 0.1]];
  layers.forEach(([dy, lw, rgb, al], li) => {
    a.save();
    a.translate(vnoise(dy, 3) * 9, dy);
    a.lineWidth = lw;
    a.strokeStyle = alphaGrad(a, ax0, ax1, rgb, (x) => al * sw(x) * (0.35 + 0.65 * (0.5 + 0.5 * vnoise(x * 0.008 + li * 5.3, 4))));
    a.stroke(line);
    a.restore();
  });
  // shells, pebbles, coral rubble near the surface
  forCells(x0, y0, x1, y1, 24, 20, 21, (rng, cx, cy) => {
    const x = cx + rng.range(0, 24), y = cy + rng.range(0, 24);
    const w = sw(x);
    if (w < 0.05) return;
    const depth = y - heightAt(x);
    if (depth < 2 || depth > 70) return;
    const near = 1 - depth / 70;
    if (!rng.chance(0.15 + 0.45 * near * near)) return;
    const t = rng.next();
    if (t < 0.45) {
      const r = rng.range(1, 2.8);
      pebble(a, x, y, r, r * 0.7, rng.chance(0.5) ? [176, 158, 128] : [138, 124, 108], 0.75 * w, rng.range(-0.5, 0.5));
    } else if (t < 0.72) {
      a.strokeStyle = `rgba(255,${rng.int(228, 246)},${rng.int(214, 236)},${(0.7 * w).toFixed(3)})`;
      a.lineWidth = rng.range(1, 1.7);
      a.beginPath();
      const r = rng.range(2, 4.2), st = rng.range(0, 6.28);
      a.arc(x, y, r, st, st + rng.range(1.8, 3));
      a.stroke();
    } else if (x > 640) {
      a.strokeStyle = `rgba(${rng.int(236, 252)},${rng.int(216, 236)},${rng.int(206, 228)},${(0.75 * w).toFixed(3)})`;
      a.lineWidth = rng.range(1.5, 2.6);
      a.beginPath();
      const ang = rng.range(-0.6, 0.6), L = rng.range(3, 7);
      a.moveTo(x, y);
      a.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      a.stroke();
    }
  });
  // burrows just under the surface (gobies, shrimps)
  forSlots(x0, x1, 120, 20, 22, (rng, cx) => {
    if (!rng.chance(0.4)) return;
    const x = cx + rng.range(0, 120);
    const w = sw(x);
    if (w < 0.3 || x < 600) return;
    const y = heightAt(x) + rng.range(3, 6);
    const r = rng.range(2.5, 4.5);
    a.fillStyle = `rgba(40,30,20,${(0.55 * w).toFixed(3)})`;
    a.beginPath();
    a.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    a.fill();
    a.strokeStyle = `rgba(255,248,226,${(0.5 * w).toFixed(3)})`;
    a.lineWidth = 1;
    a.beginPath();
    a.ellipse(x, y + 0.6, r + 1, r * 0.6 + 0.8, 0, 0.15, Math.PI - 0.15);
    a.stroke();
  });
}

// strata: horizontal-ish rock layers of varied thickness (global, deterministic)
const ST_BASE = new Float32Array(900);
{
  let y = -2600;
  for (let k = 0; k < ST_BASE.length; k++) {
    ST_BASE[k] = y;
    y += 12 + 52 * Math.pow(h01(k, 44), 1.6);
  }
}
const DIP = 0.035;
function strataY(k, x) {
  return ST_BASE[k] + 11 * vnoise(x * 0.0026 + k * 7.31, 11) + 4 * vnoise(x * 0.013 + k * 3.17, 12) - x * DIP;
}
function strataRange(y0, y1, x0, x1) {
  const lo = y0 + x0 * DIP - 30, hi = y1 + x1 * DIP + 30;
  let k0 = 0;
  while (k0 < ST_BASE.length - 1 && ST_BASE[k0 + 1] < lo) k0++;
  let k1 = k0;
  while (k1 < ST_BASE.length - 2 && ST_BASE[k1] < hi) k1++;
  return [Math.max(0, k0 - 1), k1 + 1];
}
const STRATA_TONES = ['204,170,118', '172,112,76', '236,222,194', '104,98,90', '70,60,50', '140,134,110', '214,194,154', '186,150,120'];

function paintRock(a, x0, y0, x1, y1, ax0, ax1, py, n) {
  const ex0 = x0 - 24, ex1 = x1 + 24;
  const wallW = (x) => wAt(x, WALL) + wAt(x, KELP) * 0.45;
  // strata faces: tinted bands; hard layers stand proud (lit top edge, shadow under), soft ones recede
  const [k0, k1] = strataRange(y0, y1, ex0, ex1);
  for (let k = k0; k <= k1; k++) {
    const tone = STRATA_TONES[Math.floor(h01(k, 41) * STRATA_TONES.length)];
    const hard = h01(k, 42);
    const al = 0.16 + 0.34 * hard;
    const erode = (x) => clamp(0.25 + 0.9 * (0.5 + 0.5 * vnoise(x * 0.005 + k * 1.7, 45)), 0, 1);
    a.beginPath();
    for (let x = ex0 - 16; x <= ex1 + 16; x += 16) a.lineTo(x, strataY(k, x));
    for (let x = Math.floor((ex1 + 16) / 16) * 16; x >= ex0 - 32; x -= 16) a.lineTo(x, strataY(k + 1, x));
    a.closePath();
    a.fillStyle = alphaGrad(a, ex0, ex1, tone, (x) => al * wallW(x) * (0.6 + 0.4 * vnoise(x * 0.004 + k, 43)));
    a.fill();
    const top = new Path2D();
    for (let x = ex0 - 16; x <= ex1 + 16; x += 16) top.lineTo(x, strataY(k, x));
    if (hard > 0.45) {
      // overhang shadow cast by this hard layer onto the softer one below
      a.save();
      a.translate(0, strataY(k + 1, 0) - strataY(k, 0) + 4);
      a.lineWidth = 7;
      a.strokeStyle = alphaGrad(a, ex0, ex1, '18,14,10', (x) => 0.3 * wallW(x) * erode(x));
      a.stroke(top);
      a.restore();
      a.save();
      a.translate(0, 1.4);
      a.lineWidth = 1.8;
      a.strokeStyle = alphaGrad(a, ex0, ex1, '255,240,214', (x) => 0.42 * wallW(x) * erode(x));
      a.stroke(top);
      a.restore();
    }
    a.lineWidth = 1.4;
    a.strokeStyle = alphaGrad(a, ex0, ex1, '22,17,13', (x) => 0.5 * wallW(x) * erode(x));
    a.stroke(top);
  }
  // facet plates: angular slabs standing proud of the wall face (lit top, shadowed underside)
  forSlots(x0, x1, 34, 120, 35, (rng, cx) => {
    const x = cx + rng.range(0, 34);
    const w = wAt(x, WALL) + wAt(x, BASALT) * 0.5;
    if (w < 0.05 || !rng.chance(0.75)) return;
    const d = rng.range(2, 46);
    const y = heightAt(x) + d;
    const hw = rng.range(22, 70), hh = rng.range(9, 24);
    const tilt = rng.range(-0.25, 0.25) - 0.035;
    const k = rng.int(5, 7);
    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rng.range(-0.25, 0.25);
      pts.push([x + Math.cos(a) * hw * rng.range(0.8, 1.1), y + Math.sin(a) * hh * rng.range(0.75, 1.1) + Math.cos(a) * hw * tilt]);
    }
    const tone = STRATA_TONES[Math.floor(rng.next() * STRATA_TONES.length)].split(',').map(Number);
    const c = [118 * 0.6 + tone[0] * 0.4, 108 * 0.6 + tone[1] * 0.4, 96 * 0.6 + tone[2] * 0.4];
    // cast shadow below the slab
    a.beginPath();
    for (const p of pts) a.lineTo(p[0] + 3, p[1] + hh * 0.7);
    a.closePath();
    a.fillStyle = `rgba(14,10,8,${(0.32 * w).toFixed(3)})`;
    a.fill();
    a.beginPath();
    for (const p of pts) a.lineTo(p[0], p[1]);
    a.closePath();
    const gr = a.createLinearGradient(0, y - hh, 0, y + hh);
    gr.addColorStop(0, `rgba(${Math.min(255, c[0] * 1.4) | 0},${Math.min(255, c[1] * 1.38) | 0},${Math.min(255, c[2] * 1.32) | 0},${(0.9 * w).toFixed(3)})`);
    gr.addColorStop(0.4, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(0.9 * w).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${c[0] * 0.5 | 0},${c[1] * 0.5 | 0},${c[2] * 0.5 | 0},${(0.9 * w).toFixed(3)})`);
    a.fillStyle = gr;
    a.fill();
    a.lineWidth = 1.2;
    a.strokeStyle = `rgba(16,12,10,${(0.45 * w).toFixed(3)})`;
    a.stroke();
    // rim light along the top edge
    a.beginPath();
    let first = true;
    for (const p of pts) {
      if (p[1] > y) continue;
      if (first) a.moveTo(p[0], p[1] + 0.8);
      else a.lineTo(p[0], p[1] + 0.8);
      first = false;
    }
    a.lineWidth = 1.4;
    a.strokeStyle = `rgba(255,238,210,${(0.4 * w).toFixed(3)})`;
    a.stroke();
  });
  // joints: near-vertical fractures from the surface into the rock
  forSlots(x0, x1, 46, 90, 33, (rng, cx) => {
    if (!rng.chance(0.55)) return;
    let x = cx + rng.range(0, 46);
    const w = rockW(x);
    if (w < 0.05) return;
    let y = heightAt(x) - 2;
    const len = rng.range(30, 110);
    const lean = rng.range(-0.3, 0.3);
    const pts = [[x, y]];
    for (let s = 0; s < len; s += 9) {
      x += lean * 9 + rng.range(-2.5, 2.5);
      y += 9;
      pts.push([x, y]);
    }
    a.beginPath();
    for (const p of pts) a.lineTo(p[0] + 3.5, p[1]);
    a.lineWidth = 7;
    a.strokeStyle = `rgba(20,16,12,${(0.16 * w).toFixed(3)})`;
    a.stroke();
    a.beginPath();
    for (const p of pts) a.lineTo(p[0] - 1.4, p[1]);
    a.lineWidth = 1.2;
    a.strokeStyle = `rgba(255,236,206,${(0.28 * w).toFixed(3)})`;
    a.stroke();
    a.beginPath();
    for (const p of pts) a.lineTo(p[0], p[1]);
    a.lineWidth = 1.7;
    a.strokeStyle = `rgba(16,12,9,${(0.7 * w).toFixed(3)})`;
    a.stroke();
  });
  // small cracks
  forCells(x0, y0, x1, y1, 48, 60, 31, (rng, cx, cy) => {
    if (!rng.chance(0.45)) return;
    let x = cx + rng.range(0, 48), y = cy + rng.range(0, 48);
    const w = rockW(x);
    if (w < 0.05 || y < heightAt(x) + 4) return;
    a.beginPath();
    a.moveTo(x, y);
    const dir = rng.range(0, Math.PI * 2);
    for (let s = 0; s < rng.int(2, 4); s++) {
      const ang = dir + rng.range(-0.8, 0.8);
      x += Math.cos(ang) * rng.range(3, 8);
      y += Math.sin(ang) * rng.range(3, 8);
      a.lineTo(x, y);
    }
    a.lineWidth = 1;
    a.strokeStyle = `rgba(22,18,14,${(0.5 * w).toFixed(3)})`;
    a.stroke();
  });
  // boulders bedded right under the surface: few big, more small, at varied depths
  forSlots(x0, x1, 54, 60, 32, (rng, cx) => {
    if (!rng.chance(0.38)) return;
    const x = cx + rng.range(0, 54);
    const w = rockW(x);
    if (w < 0.05) return;
    const r = 5 + 26 * Math.pow(rng.next(), 2.2);
    const y = heightAt(x) + r * rng.range(0.75, 1.6) + rng.range(0, 14);
    boulder(a, x, y, r, rng, 0.8 * w);
  });
  // overhang shade: under a convex ledge the wall recedes into shadow
  for (let i = 6; i < n - 12; i += 2) {
    const sBefore = (py[i] - py[i - 6]) / (6 * STEP);
    const sAfter = (py[i + 10] - py[i]) / (10 * STEP);
    if (sBefore < 0.7 && sAfter > 1.3) {
      const x = ax0 + i * STEP;
      const w = wAt(x, WALL) + wAt(x, BASALT) * 0.6;
      if (w < 0.05) continue;
      const cx = x + 6, cy = py[i] + 34;
      const gr = a.createRadialGradient(cx, cy, 2, cx, cy, 42);
      gr.addColorStop(0, `rgba(12,9,7,${(0.5 * w).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(12,9,7,0)');
      a.fillStyle = gr;
      a.fillRect(cx - 42, cy - 42, 84, 84);
      i += 10;
    }
  }
  paintCrust(a, x0, x1);
}

function paintCrust(a, x0, x1) {
  forSlots(x0, x1, 6, 20, 34, (rng, cx) => {
    const x = cx + rng.range(0, 6);
    matWeights(x, WT);
    const kelp = WT[KELP], wall = WT[WALL];
    const w = kelp + wall;
    if (w < 0.05) return;
    const ground = heightAt(x);
    const life = w * (1 - smoothstep(1800, 4400, ground)); // thins out with depth
    if (life < 0.05 || !rng.chance(0.5)) return;
    const pal = kelp > wall
      ? ['176,62,70', '214,128,150', '136,44,52', '156,120,60', '204,150,166', '120,96,48']
      : ['214,128,150', '230,160,80', '220,196,96', '160,100,170', '200,90,70'];
    const col = rng.pick(pal);
    const y = ground + rng.range(1.5, 5);
    const r = rng.range(1.4, 3.8);
    a.fillStyle = `rgba(${col},${(0.8 * life).toFixed(3)})`;
    a.beginPath();
    a.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2);
    a.fill();
    a.fillStyle = `rgba(255,240,230,${(0.28 * life).toFixed(3)})`;
    a.beginPath();
    a.ellipse(x - r * 0.3, y - r * 0.35, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
    a.fill();
  });
}

function boulder(a, x, y, r, rng, al) {
  const n = 10;
  a.beginPath();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rr = r * rng.range(0.82, 1.1);
    a.lineTo(x + Math.cos(ang) * rr * 1.3, y + Math.sin(ang) * rr * 0.85);
  }
  a.closePath();
  const gr = a.createLinearGradient(x - r * 0.5, y - r, x + r * 0.4, y + r);
  gr.addColorStop(0, `rgba(204,192,170,${al})`);
  gr.addColorStop(0.45, `rgba(128,118,104,${al})`);
  gr.addColorStop(1, `rgba(46,40,34,${al})`);
  a.fillStyle = gr;
  a.strokeStyle = gr;
  a.lineWidth = 4;
  a.stroke();
  a.fill();
  a.lineWidth = 1.2;
  a.strokeStyle = `rgba(22,18,14,${(al * 0.45).toFixed(3)})`;
  a.stroke();
}

function paintOoze(a, x0, y0, x1, y1, ax0, ax1, line) {
  const ow = (x) => wAt(x, OOZE);
  [[7, 1.2, '236,228,210', 0.24], [13, 2, '60,52,44', 0.12], [20, 1, '228,218,200', 0.15], [30, 2.6, '56,48,40', 0.1],
    [43, 1.2, '222,212,192', 0.1], [60, 3, '50,42,36', 0.09], [82, 1.4, '214,204,186', 0.07]].forEach(([dy, lw, rgb, al], li) => {
    a.save();
    a.translate(0, dy);
    a.lineWidth = lw;
    a.strokeStyle = alphaGrad(a, ax0, ax1, rgb, (x) => al * ow(x) * (0.4 + 0.6 * (0.5 + 0.5 * vnoise(x * 0.006 + li * 4.1, 52))));
    a.stroke(line);
    a.restore();
  });
  forCells(x0, y0, x1, y1, 26, 20, 51, (rng, cx, cy) => {
    const x = cx + rng.range(0, 26), y = cy + rng.range(0, 26);
    const w = ow(x);
    if (w < 0.05) return;
    const depth = y - heightAt(x);
    if (depth < 2 || depth > 80) return;
    const t = rng.next();
    if (t < 0.2) {
      const r = rng.range(1.6, 4.5);
      pebble(a, x, y, r, r * 0.75, [62, 54, 46], 0.85 * w, rng.range(-0.5, 0.5));
    } else if (t < 0.34 && depth < 30) {
      a.fillStyle = `rgba(22,18,14,${(0.5 * w).toFixed(3)})`;
      a.beginPath();
      a.ellipse(x, y, rng.range(1.2, 2.4), rng.range(0.9, 1.8), 0, 0, Math.PI * 2);
      a.fill();
    } else if (t < 0.5) {
      a.fillStyle = `rgba(244,238,224,${(0.45 * w).toFixed(3)})`;
      a.fillRect(x, y, rng.range(0.8, 1.6), rng.range(0.8, 1.4));
    }
  });
}

function paintBasalt(a, x0, y0, x1, y1) {
  const bw = (x) => wAt(x, BASALT);
  // columnar jointing in the weathered skin: varied, tall cells with glassy rims
  forVoronoi(x0 - 30, y0 - 30, x1 + 30, y1 + 30, 34, 70, 91, 0.9, (poly, p, rng) => {
    const w = bw(p[0]);
    if (w < 0.03) return;
    const d = p[1] - heightAt(p[0]);
    if (d < -60 || d > 140) return;
    if (rng.chance(0.18)) return; // spalled out: show the dark rock behind
    const tone = rng.pick([[80, 82, 96], [66, 68, 78], [90, 92, 106], [58, 58, 66], [74, 74, 86]]);
    rockCell(a, poly, p, rng, tone, w, { gap: 1.6, round: 0, alpha: 0.8, crease: 1.7, creaseA: 0.85, rim: 1.2, rimA: 0.4 });
  });
  // pillow lava lumps on the flatter floor
  forSlots(x0, x1, 110, 60, 63, (rng, cx) => {
    if (!rng.chance(0.6)) return;
    const x = cx + rng.range(0, 110);
    const w = bw(x);
    if (w < 0.05) return;
    const s = Math.abs(heightAt(x + 20) - heightAt(x - 20)) / 40;
    if (s > 0.7) return;
    const rx = rng.range(16, 30), ry = rx * rng.range(0.45, 0.62);
    const y = heightAt(x) + ry * 0.9 + rng.range(1, 6);
    const gr = a.createRadialGradient(x - rx * 0.3, y - ry * 0.6, 1, x, y, rx * 1.05);
    gr.addColorStop(0, `rgba(130,136,156,${(0.85 * w).toFixed(3)})`);
    gr.addColorStop(0.45, `rgba(58,60,70,${(0.85 * w).toFixed(3)})`);
    gr.addColorStop(1, `rgba(10,10,14,${(0.85 * w).toFixed(3)})`);
    a.fillStyle = gr;
    a.beginPath();
    a.ellipse(x, y, rx, ry, rng.range(-0.15, 0.15), 0, Math.PI * 2);
    a.fill();
    a.lineWidth = 1.2;
    a.strokeStyle = `rgba(4,4,6,${(0.8 * w).toFixed(3)})`;
    a.stroke();
    a.lineWidth = 0.9;
    a.strokeStyle = `rgba(8,8,10,${(0.6 * w).toFixed(3)})`;
    a.beginPath();
    for (let c = 0; c < 3; c++) {
      const ang = rng.range(-2.6, -0.5);
      a.moveTo(x + Math.cos(ang) * rx * 0.3, y + Math.sin(ang) * ry * 0.3);
      a.lineTo(x + Math.cos(ang) * rx * 0.95, y + Math.sin(ang) * ry * 0.95);
    }
    a.stroke();
  });
  // hydrothermal mineral crusts around the vents: soft patches of sulphur, iron ochre and white anhydrite
  const VENTS = [11080, 11330, 11560];
  for (const vx of VENTS) {
    if (vx < x0 - 300 || vx > x1 + 300) continue;
    const rng = cellRng(vx, 1, 64);
    for (let i = 0; i < 18; i++) {
      const x = vx + rng.gaussian() * 80;
      const fall = 1 - Math.min(1, Math.abs(x - vx) / 280);
      const r = rng.range(8, 26) * fall;
      if (r < 3) continue;
      const y = heightAt(x) + r * 0.35 + rng.range(0, 6);
      const col = rng.pick(['232,200,80', '206,140,58', '236,230,214', '178,92,46', '244,220,110']);
      const gr = a.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},${(0.7 * fall).toFixed(3)})`);
      gr.addColorStop(0.6, `rgba(${col},${(0.4 * fall).toFixed(3)})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      a.fillStyle = gr;
      a.save();
      a.translate(x, y);
      a.scale(1.8, 0.7);
      a.translate(-x, -y);
      a.fillRect(x - r, y - r, r * 2, r * 2);
      a.restore();
    }
    for (let i = 0; i < 60; i++) {
      const x = vx + rng.gaussian() * 70;
      const y = heightAt(x) + Math.abs(rng.gaussian()) * 8 + 1;
      a.fillStyle = `rgba(${rng.pick(['250,240,200', '255,214,100', '220,120,60'])},${rng.range(0.4, 0.8).toFixed(3)})`;
      a.fillRect(x, y, rng.range(0.8, 2.2), rng.range(0.8, 1.8));
    }
  }
}

// ── surface ─────────────────────────────────────────────────────────────────────────────────────────
function paintLip(g, ax0, ax1, py, line, n) {
  // sediment caps: on flat-ish rock / basalt a pale silty layer settles on top
  const capW = (x) => {
    matWeights(x, WT);
    return WT[KELP] * 0.75 + WT[WALL] + WT[BASALT] * 0.9;
  };
  const runs = [];
  let cur = null;
  for (let i = 2; i < n - 2; i++) {
    const x = ax0 + i * STEP;
    const s = Math.abs(py[i + 2] - py[i - 2]) / (4 * STEP);
    const ok = s < 0.5 && capW(x) > 0.05;
    if (ok) {
      if (!cur) runs.push((cur = []));
      cur.push(i);
    } else cur = null;
  }
  for (const run of runs) {
    if (run.length < 5) continue;
    const p = new Path2D();
    for (const i of run) p.lineTo(ax0 + i * STEP, py[i]);
    const xm = ax0 + run[run.length >> 1] * STEP;
    const cw = capW(xm);
    matWeights(xm, WT);
    const silt = WT[BASALT] > 0.5 ? '120,116,110' : '206,194,170';
    g.lineWidth = 18;
    g.strokeStyle = `rgba(${silt},${(0.4 * cw).toFixed(3)})`;
    g.stroke(p);
    g.lineWidth = 8;
    g.strokeStyle = `rgba(${silt},${(0.55 * cw).toFixed(3)})`;
    g.stroke(p);
  }
  // lit lip
  const lip = (x, out) => {
    groundColor(x, 0, out);
    out[0] = Math.min(255, out[0] * 1.1 + 18);
    out[1] = Math.min(255, out[1] * 1.1 + 18);
    out[2] = Math.min(255, out[2] * 1.08 + 16);
    return out;
  };
  g.lineWidth = 8;
  g.strokeStyle = hGradient(g, ax0, ax1, lip, 0.3);
  g.stroke(line);
  g.lineWidth = 3;
  g.strokeStyle = hGradient(g, ax0, ax1, lip, 0.85);
  g.stroke(line);
}

/** Tiny static fringe on top of the line: grass blades on the island crest. */
function paintFringe(g, x0, x1, ax0, py, n) {
  if (x0 > 360) return;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = ax0 + i * STEP;
    if (x < x0 - 6 || x > x1 + 6) continue;
    const w = wAt(x, TURF);
    if (w < 0.1) continue;
    for (let j = 0; j < 3; j++) {
      const hsh = h01(i * 3 + j, 71);
      const bx = x + hsh * STEP;
      const by = heightAt(bx) + 2.5;
      const h = (3 + hsh * 8) * w;
      const lean = (h01(i * 3 + j, 72) - 0.45) * 6;
      g.strokeStyle = hsh > 0.66 ? 'rgba(150,200,80,0.95)' : hsh > 0.33 ? 'rgba(112,164,58,0.95)' : 'rgba(84,132,44,0.95)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + lean * 0.3, by - h * 0.6, bx + lean, by - h);
      g.stroke();
    }
  }
}
