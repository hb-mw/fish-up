// Seabed art — small shared helpers (canvas, colour, deterministic randomness).
import { createRng, hash2 } from '../../core/rng.js';

/** Offscreen canvas (DOM canvas: works everywhere drawImage does). */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** [r,g,b] (+alpha) → css colour string. */
export const css = (c, a = 1) =>
  a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a.toFixed(3)})`;

/** '#rrggbb' → [r,g,b] */
export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
/** lighten toward white by t */
export const tint = (c, t) => [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
/** hex colour helpers returning css */
export const hx = (h, a = 1) => css(hex(h), a);
export const hmix = (a, b, t, al = 1) => css(mix(hex(a), hex(b), t), al);

/** Piecewise-linear lookup in sorted stops [[t, [r,g,b]], …]. Writes into `out`. */
export function stopsAt(stops, t, out) {
  if (t <= stops[0][0]) {
    const c = stops[0][1];
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    return out;
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      out[0] = a[1][0] + (b[1][0] - a[1][0]) * k;
      out[1] = a[1][1] + (b[1][1] - a[1][1]) * k;
      out[2] = a[1][2] + (b[1][2] - a[1][2]) * k;
      return out;
    }
  }
  const c = stops[stops.length - 1][1];
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;
}

/** Deterministic generator for a world cell (same pixels every session). */
export function cellRng(cx, cy, salt) {
  return createRng(((hash2(cx * 7 + salt, cy * 13 - salt * 3) * 4294967296) >>> 0) || 1);
}

/** Integer hash → [0,1) with a salt. */
export const h01 = (i, salt = 0) => hash2(i, salt * 977 + 31);

/** Fast deterministic 1D value noise in [-1, 1] with a smooth fade (period-free). */
export function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, seed), b = hash2(i + 1, seed);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}
