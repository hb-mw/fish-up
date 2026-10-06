// Small helpers shared by the boat & angler art (src/render/boat/*). BOAT ART module.
import { clamp } from '../../core/math.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * Two-bone IK. Root (ax,ay) reaches for (tx,ty) with bones l1, l2.
 * bend = +1 puts the middle joint clockwise of the root→target direction (elbow DOWN for a forward reach),
 * bend = −1 counter-clockwise (knee FORWARD for a downward leg). Unreachable targets are clamped.
 * Writes out.jx/jy (middle joint) and out.ex/ey (effective end point).
 */
export function ik2(ax, ay, tx, ty, l1, l2, bend, out) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.998, minD = Math.abs(l1 - l2) + 0.5;
  if (d < 1e-4) {
    dx = 0;
    dy = minD;
    d = minD;
  } else if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  } else if (d < minD) {
    dx *= minD / d;
    dy *= minD / d;
    d = minD;
  }
  const a = Math.atan2(dy, dx);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const ang = a + bend * Math.acos(cosA);
  out.jx = ax + Math.cos(ang) * l1;
  out.jy = ay + Math.sin(ang) * l1;
  out.ex = ax + dx;
  out.ey = ay + dy;
  return out;
}

/** Append a tapered capsule (round ends) from a (radius ra) to b (radius rb) to the current path. */
export function capsule(ctx, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy) || 0.001;
  const ang = Math.atan2(dy, dx);
  // tangent offset angle for unequal radii
  const s = clamp((ra - rb) / d, -0.95, 0.95);
  const off = Math.acos(s);
  ctx.moveTo(ax + Math.cos(ang + off) * ra, ay + Math.sin(ang + off) * ra);
  ctx.arc(ax, ay, ra, ang + off, ang - off + Math.PI * 2, false);
  ctx.lineTo(bx + Math.cos(ang - off) * rb, by + Math.sin(ang - off) * rb);
  ctx.arc(bx, by, rb, ang - off, ang + off, false);
  ctx.closePath();
}

/** Cubic bezier point. */
export function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// ── colour ──────────────────────────────────────────────────────────────────
function parse(hex) {
  let h = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const _hexCache = new Map();
/** '#rrggbb' → [r,g,b] (cached). */
export function rgbOf(hex) {
  let c = _hexCache.get(hex);
  if (!c) {
    c = parse(hex);
    _hexCache.set(hex, c);
  }
  return c;
}
export const css = (r, g, b, a = 1) =>
  a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a < 0 ? 0 : a.toFixed(3)})`;
/** Shade a hex colour: k > 0 lightens toward white, k < 0 darkens toward black. */
export function shade(hex, k, a = 1) {
  const c = rgbOf(hex);
  if (k >= 0) return css(c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k, a);
  const m = 1 + k;
  return css(c[0] * m, c[1] * m, c[2] * m, a);
}
/** Mix two hex colours (t 0..1) → css. */
export function mixc(h1, h2, t, a = 1) {
  const p = rgbOf(h1), q = rgbOf(h2);
  return css(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, a);
}
/** hex + alpha → css. */
export function hexa(hex, a) {
  const c = rgbOf(hex);
  return css(c[0], c[1], c[2], a);
}

/** Vertical linear gradient helper: stops = [[t, css], …]. */
export function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
export function lgrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
export function rgrad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}

/** Soft round blob sprite (white → transparent), cached per size. Used for foam, bubbles and glows. */
const _blobs = new Map();
export function softBlob(size = 64, hard = 0.35, color = '255,255,255') {
  const k = size + '|' + hard + '|' + color;
  let c = _blobs.get(k);
  if (c) return c;
  c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${color},1)`);
  gr.addColorStop(hard, `rgba(${color},0.75)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  _blobs.set(k, c);
  return c;
}

/** Smooth polyline through points using quadratic midpoints (adds to the current path). */
export function smoothPath(ctx, xs, ys, n, move = true) {
  if (n < 2) return;
  if (move) ctx.moveTo(xs[0], ys[0]);
  if (n === 2) {
    ctx.lineTo(xs[1], ys[1]);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2, my = (ys[i] + ys[i + 1]) / 2;
    ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
  }
  ctx.lineTo(xs[n - 1], ys[n - 1]);
}
