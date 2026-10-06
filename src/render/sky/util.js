// Sky toolkit: offscreen canvases, colour strings/mixing, a fast tileable noise texture, small math helpers.
import { createRng } from '../../core/rng.js';

/** New offscreen canvas (at least 1×1). */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** [r,g,b] (+ alpha) → css colour string. */
export function css(c, a = 1) {
  const r = c[0] < 0 ? 0 : c[0] > 255 ? 255 : c[0] | 0;
  const g = c[1] < 0 ? 0 : c[1] > 255 ? 255 : c[1] | 0;
  const b = c[2] < 0 ? 0 : c[2] > 255 ? 255 : c[2] | 0;
  if (a >= 1) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${a < 0 ? 0 : a.toFixed(3)})`;
}

/** out = a + (b − a)·t (writes into out, returns it). */
export function mixInto(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scale = (c, s) => [c[0] * s, c[1] * s, c[2] * s];
export const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
export const copy3 = (out, c) => {
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
  return out;
};
/** Largest channel difference between two colours. */
export const colorDelta = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

const FLASH = [225, 232, 255];
/**
 * The environment mixes some palette entries toward a flash white during lightning (by lightning·0.6).
 * The mix is linear, so it can be undone: returns the colour as it was before the flash.
 */
export function unflash(out, c, lightning) {
  const k = lightning > 0.01 ? Math.min(0.9, lightning * 0.6) : 0;
  if (k <= 0) return copy3(out, c);
  const inv = 1 / (1 - k);
  out[0] = (c[0] - FLASH[0] * k) * inv;
  out[1] = (c[1] - FLASH[1] * k) * inv;
  out[2] = (c[2] - FLASH[2] * k) * inv;
  return out;
}

/** Positive modulo. */
export const mod = (a, n) => ((a % n) + n) % n;

/** Van der Corput radical inverse (base 2) — spreads thresholds so any subset is evenly spaced. */
export function radicalInverse(i) {
  let bits = i >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits / 4294967296;
}

/**
 * Tileable fractal value-noise texture (size × size, values ~0..1) — sampled with bilinear wrap by
 * `noiseAt`. Much faster than hashing per sample when baking big sprites.
 */
export function createNoiseTex(seed, size = 256, octaves = 5, baseCells = 4, persistence = 0.5) {
  const rng = createRng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, norm = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i++) lat[i] = rng.next();
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy), fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx), fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const a = lat[r0 + c0], b = lat[r0 + c1], c = lat[r1 + c0], d = lat[r1 + c1];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    norm += amp;
    amp *= persistence;
    cells *= 2;
    if (cells > size) break;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  // stretch to use the full 0..1 range
  let lo = 1, hi = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] < lo) lo = out[i];
    if (out[i] > hi) hi = out[i];
  }
  const k = 1 / Math.max(1e-6, hi - lo);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) * k;
  return { data: out, size };
}

/** Bilinear, wrapping sample of a noise texture at texel coords (x, y). */
export function noiseAt(tex, x, y) {
  const n = tex.size, d = tex.data;
  const fx0 = Math.floor(x), fy0 = Math.floor(y);
  const fx = x - fx0, fy = y - fy0;
  const x0 = ((fx0 % n) + n) % n, y0 = ((fy0 % n) + n) % n;
  const x1 = x0 + 1 === n ? 0 : x0 + 1, y1 = y0 + 1 === n ? 0 : y0 + 1;
  const a = d[y0 * n + x0], b = d[y0 * n + x1], c = d[y1 * n + x0], e = d[y1 * n + x1];
  const top = a + (b - a) * fx, bot = c + (e - c) * fx;
  return top + (bot - top) * fy;
}

export const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const sstep = (a, b, v) => smooth01((v - a) / (b - a));
