// Creature-art toolkit (CREATURE ART module): palettes with shiny/silhouette variants, robust sprite variants,
// sheared-strip "bend" blits for hanging / trailing appendages, tapered limb outlines, cached glow dots and
// per-individual pose smoothing.
import { TAU, clamp, sampleStops } from '../../../core/math.js';
import { createRng, hash1 } from '../../../core/rng.js';
import { makeCanvas, unitSprite, drawUnitSprite, spriteVariant } from '../common.js';

export { TAU, clamp, createRng, hash1, makeCanvas, unitSprite, drawUnitSprite };

export const SIL = '#0f1c2b';

/** Colour mode for the current draw: 0 normal · 1 shiny (gold) · 2 silhouette. */
export const modeOf = (opts) => (opts && opts.silhouette ? 2 : opts && opts.shiny ? 1 : 0);

/** Glow strength vs ambient light: glows read in the dark but don't turn into lamps at noon (floor for galleries). */
export const glowK = (opts) => 0.32 + 0.68 * (1 - clamp(opts && opts.light !== undefined ? opts.light : 1, 0, 1));

// ── colour ──────────────────────────────────────────────────────────────────
export function rgbOf(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const GOLD = [
  [0, [58, 32, 6]],
  [0.3, [150, 92, 16]],
  [0.55, [222, 162, 44]],
  [0.8, [255, 216, 110]],
  [1, [255, 248, 216]],
];
/** Luminance-preserving map onto a rich gold ramp (shiny variant of live-drawn parts). */
export function goldRgb(c) {
  const L = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return sampleStops(GOLD, clamp(Math.pow(L, 0.8) * 1.05, 0, 1));
}
const cssRgb = (c, a) => (a === undefined || a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

/** Colour in a given mode (precompute at load time — this allocates a string). */
export function colIn(hex, mode, a) {
  const c = mode === 2 ? rgbOf(SIL) : mode === 1 ? goldRgb(rgbOf(hex)) : rgbOf(hex);
  return cssRgb(c, mode === 2 && a !== undefined ? Math.min(1, a * 1.6) : a);
}

/**
 * Build a palette once: defs = { name: '#hex' | ['#hex', alpha] }. Returns [normal, shiny, silhouette],
 * each { name: cssString }. Use: const P = PAL[modeOf(opts)].
 */
export function palette(defs) {
  const out = [{}, {}, {}];
  for (const k in defs) {
    const d = defs[k];
    const hex = Array.isArray(d) ? d[0] : d;
    const a = Array.isArray(d) ? d[1] : undefined;
    for (let m = 0; m < 3; m++) out[m][k] = colIn(hex, m, a);
  }
  return out;
}

/** Mix two hex colours → '#rrggbb'. */
export function mixHex(a, b, t) {
  const p = rgbOf(a), q = rgbOf(b);
  const h = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return '#' + h(p[0] + (q[0] - p[0]) * t) + h(p[1] + (q[1] - p[1]) * t) + h(p[2] + (q[2] - p[2]) * t);
}
/** rgba() from hex (paint-time helper; allocates). */
export function rgba(hex, a) {
  const c = rgbOf(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// ── gradients usable from any context (created on a scratch context, cached per key) ────────────────
const scratch = makeCanvas(2, 2).getContext('2d');
const gradCache = new Map();
/**
 * Cached gradient in whatever space you draw it in (unit space is the usual choice).
 * build(scratchCtx, mode) must return a CanvasGradient. Cached per key + mode.
 */
export function cachedGrad(key, mode, build) {
  const k = mode === 0 ? key : mode === 1 ? key + '#s' : key + '#k';
  let g = gradCache.get(k);
  if (!g) {
    g = build(scratch, mode);
    gradCache.set(k, g);
  }
  return g;
}

// ── sprite variants ─────────────────────────────────────────────────────────
/**
 * Variant for the draw options. For translucent sprites (jellies, fins) the silhouette is made solid first,
 * so an undiscovered jelly still reads as a shape.
 */
export function variant(spr, opts, translucent) {
  if (opts.silhouette) return translucent ? solidSil(spr) : spriteVariant(spr, 'silhouette', SIL);
  if (opts.shiny) return spriteVariant(spr, 'shiny');
  return spr;
}
function solidSil(spr) {
  if (spr._v_solid) return spr._v_solid;
  const c = makeCanvas(spr.canvas.width, spr.canvas.height);
  const g = c.getContext('2d');
  for (let i = 0; i < 6; i++) g.drawImage(spr.canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = SIL;
  g.fillRect(0, 0, c.width, c.height);
  spr._v_solid = { canvas: c, res: spr.res, box: spr.box, pad: spr.pad, bytes: 0, used: 0 };
  return spr._v_solid;
}

/** Blit a unit sprite scaled non-uniformly about local point (ox, oy) (local px). */
export function drawUnitSpriteScaled(ctx, spr, len, sx, sy, ox, oy) {
  const b = spr.box, s = len / spr.res;
  const x = b.x0 * len - spr.pad * s, y = b.y0 * len - spr.pad * s;
  const w = spr.canvas.width * s, h = spr.canvas.height * s;
  ctx.drawImage(spr.canvas, ox + (x - ox) * sx, oy + (y - oy) * sy, w * sx, h * sy);
}

/**
 * Blit a unit sprite whose lower part hangs: below unit-y `from` it is cut into `n` horizontal bands; band edge j
 * (j = 0 at `from`, n at the sprite bottom) is shifted horizontally by offs[j] local px. Each band is sheared so
 * neighbouring edges meet exactly — strands bend smoothly with no steps. Use hangEdgeY() for the edge positions.
 */
export function drawHanging(ctx, spr, len, from, n, offs) {
  const b = spr.box, s = len / spr.res, pad = spr.pad;
  const cv = spr.canvas, cw = cv.width, ch = cv.height;
  const X = b.x0 * len - pad * s, W = cw * s;
  const top = b.y0 * len - pad * s;
  const r0 = clamp((from - b.y0) * spr.res + pad, 0, ch - 1);
  if (r0 > 0.5) ctx.drawImage(cv, 0, 0, cw, r0, X + offs[0], top, W, r0 * s);
  const rh = (ch - r0) / n;
  for (let j = 0; j < n; j++) {
    const ra = r0 + j * rh;
    const ya = top + ra * s, hb = rh * s;
    const k = (offs[j + 1] - offs[j]) / hb;
    const e = offs[j] - k * ya;
    ctx.transform(1, 0, k, 1, e, 0);
    ctx.drawImage(cv, 0, ra, cw, rh, X, ya, W, hb);
    ctx.transform(1, 0, -k, 1, -e, 0);
  }
}
/** drawHanging, except silhouettes are blitted whole (static, and no strip seams on the flat shape). */
export function hang(ctx, spr, len, from, n, offs, opts) {
  if (opts.silhouette) drawUnitSprite(ctx, spr, len);
  else drawHanging(ctx, spr, len, from, n, offs);
}
/** drawTrailing, except silhouettes are blitted whole. */
export function trail(ctx, spr, len, from, n, offs, opts) {
  if (opts.silhouette) drawUnitSprite(ctx, spr, len);
  else drawTrailing(ctx, spr, len, from, n, offs);
}
/** Unit-space y of band edge j for drawHanging. */
export function hangEdgeY(spr, from, n, j) {
  const end = spr.box.y1 + spr.pad / spr.res;
  return from + ((end - from) * j) / n;
}

/**
 * Blit a unit sprite whose rear part trails toward −X: left of unit-x `from` it is cut into `n` vertical bands;
 * band edge j (0 at `from`, n at the left end) is shifted vertically by offs[j] local px (sheared, seamless).
 */
export function drawTrailing(ctx, spr, len, from, n, offs) {
  const b = spr.box, s = len / spr.res, pad = spr.pad;
  const cv = spr.canvas, cw = cv.width, ch = cv.height;
  const Y = b.y0 * len - pad * s, H = ch * s;
  const left = b.x0 * len - pad * s;
  const c0 = clamp((from - b.x0) * spr.res + pad, 1, cw);
  if (c0 < cw - 0.5) ctx.drawImage(cv, c0, 0, cw - c0, ch, left + c0 * s, Y + offs[0], (cw - c0) * s, H);
  const cwid = c0 / n;
  for (let j = 0; j < n; j++) {
    const ca = c0 - (j + 1) * cwid; // left edge of this band (sprite px)
    const xa = left + ca * s, wb = cwid * s;
    // edge j sits at the band's right side (xa + wb), edge j+1 at its left side (xa)
    const k = (offs[j] - offs[j + 1]) / wb;
    const e = offs[j + 1] - k * xa;
    ctx.transform(1, k, 0, 1, 0, e);
    ctx.drawImage(cv, ca, 0, cwid, ch, xa, Y, wb, H);
    ctx.transform(1, -k, 0, 1, 0, -e);
  }
}
/** Unit-space x of band edge j for drawTrailing. */
export function trailEdgeX(spr, from, n, j) {
  const end = spr.box.x0 - spr.pad / spr.res;
  return from + ((end - from) * j) / n;
}

// ── soft glow dots ──────────────────────────────────────────────────────────
const glowCache = new Map();
/** Cached radial glow sprite (64 px) in a colour; `core` 0..1 adds a hot centre. */
export function glowDot(hex, core = 0) {
  const k = hex + core;
  let c = glowCache.get(k);
  if (c) return c;
  c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const rgb = rgbOf(hex);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const st = (t, a) => gr.addColorStop(t, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  if (core > 0) gr.addColorStop(0, `rgba(255,255,255,${core})`);
  else st(0, 1);
  st(0.12, 0.85);
  st(0.3, 0.42);
  st(0.55, 0.13);
  st(0.8, 0.03);
  st(1, 0);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(k, c);
  return c;
}
/** Draw a glow dot centred at (x, y) with radii rx, ry. */
export function glow(ctx, dot, x, y, rx, ry) {
  ctx.drawImage(dot, x - rx, y - (ry === undefined ? rx : ry), rx * 2, (ry === undefined ? rx : ry) * 2);
}

// ── limbs & strands ─────────────────────────────────────────────────────────
const LX = new Float32Array(96), LY = new Float32Array(96), RX = new Float32Array(96), RY = new Float32Array(96);
/**
 * Append a closed, smoothly tapered limb outline along points (xs, ys)[0..n) to the current path.
 * Width goes w0 → w1 (power `p` shapes the taper); the tip is rounded.
 */
export function limbPath(ctx, xs, ys, n, w0, w1, p = 1) {
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    const i0 = i > 0 ? i - 1 : 0, i1 = i < n - 1 ? i + 1 : n - 1;
    let dx = xs[i1] - xs[i0], dy = ys[i1] - ys[i0];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const u = i / (n - 1);
    const w = (w0 + (w1 - w0) * (p === 1 ? u : Math.pow(u, p))) * 0.5;
    LX[i] = xs[i] - dy * w;
    LY[i] = ys[i] + dx * w;
    RX[i] = xs[i] + dy * w;
    RY[i] = ys[i] - dx * w;
  }
  ctx.moveTo(LX[0], LY[0]);
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(LX[i], LY[i], (LX[i] + LX[i + 1]) * 0.5, (LY[i] + LY[i + 1]) * 0.5);
  ctx.lineTo(LX[n - 1], LY[n - 1]);
  // rounded tip
  const tx = xs[n - 1] - xs[n - 2], ty = ys[n - 1] - ys[n - 2];
  const td = Math.hypot(tx, ty) || 1;
  const wt = Math.hypot(LX[n - 1] - RX[n - 1], LY[n - 1] - RY[n - 1]) * 0.5;
  const cx = xs[n - 1] + (tx / td) * wt * 1.3, cy = ys[n - 1] + (ty / td) * wt * 1.3;
  ctx.quadraticCurveTo(cx, cy, RX[n - 1], RY[n - 1]);
  for (let i = n - 2; i > 0; i--) ctx.quadraticCurveTo(RX[i], RY[i], (RX[i] + RX[i - 1]) * 0.5, (RY[i] + RY[i - 1]) * 0.5);
  ctx.lineTo(RX[0], RY[0]);
  ctx.closePath();
}
/** Left / right edge points of the last limbPath call (for highlights, sucker rows). */
export const limbEdges = { LX, LY, RX, RY };

/** Append a smooth open curve through points (quadratic through midpoints). */
export function smoothLine(ctx, xs, ys, n, start = 0) {
  ctx.moveTo(xs[start], ys[start]);
  if (n - start < 3) {
    for (let i = start + 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
    return;
  }
  for (let i = start + 1; i < n - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) * 0.5, (ys[i] + ys[i + 1]) * 0.5);
  ctx.lineTo(xs[n - 1], ys[n - 1]);
}

/**
 * Fill xs/ys with a chain: start (x0, y0), initial heading a0 (radians), n points spaced seg apart; the heading
 * turns by bend[i] at each joint. Returns n.
 */
export function chain(xs, ys, n, x0, y0, a0, seg, bend) {
  let a = a0, x = x0, y = y0;
  xs[0] = x;
  ys[0] = y;
  for (let i = 1; i < n; i++) {
    a += bend[i];
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    xs[i] = x;
    ys[i] = y;
  }
  return n;
}

// ── per-individual pose smoothing (so state changes never snap) ─────────────
const poses = new Map();
let poseCalls = 0;
/**
 * Exponentially ease a per-individual value toward `target` at `rate` (1/s), advancing only when anim.t advances
 * (draw and drawGlow both call this in one frame). Icons (uid 0) get the target directly.
 */
export function easePose(anim, slot, target, rate) {
  const uid = anim.uid;
  if (!uid) return target;
  const k = uid * 16 + slot;
  const t = anim.t;
  let s = poses.get(k);
  if (!s) {
    poses.set(k, { v: target, t });
    if (++poseCalls % 512 === 0) prunePoses(t);
    return target;
  }
  const dt = t - s.t;
  if (dt > 0) {
    s.v += (target - s.v) * (1 - Math.exp(-rate * Math.min(dt, 0.2)));
    s.t = t;
  } else if (dt < -2) {
    s.v = target;
    s.t = t;
  }
  return s.v;
}
function prunePoses(t) {
  for (const [k, s] of poses) if (t - s.t > 30 || s.t - t > 30) poses.delete(k);
}

// ── paint-time helpers (used inside cached sprites only) ────────────────────
/** Scatter soft dots inside the current clip: n dots, radius r0..r1, colours picked from cols. */
export function speckle(ctx, rng, x0, y0, x1, y1, n, r0, r1, cols) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[(rng.next() * cols.length) | 0];
    const r = r0 + (r1 - r0) * rng.next() * rng.next();
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * rng.next(), y0 + (y1 - y0) * rng.next(), r, 0, TAU);
    ctx.fill();
  }
}
/** Soft blurred blob painting: runs fn with a blur filter sized in unit space. */
export function blurred(ctx, res, unitBlur, fn) {
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, unitBlur * res).toFixed(2)}px)`;
  fn();
  ctx.restore();
}
/** Pseudo-random in [0,1) from a seed and index (stable, allocation-free). */
export const rnd = (seed, i) => hash1(((seed * 7919) | 0) + i * 104729);
