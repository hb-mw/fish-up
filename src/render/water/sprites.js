// WATER · procedural sprites & textures, painted once at start-up (ImageData / gradients), then blitted.
// White-on-transparent sprites are tinted on demand through small one-slot caches (see Tint).
import { TAU, clamp, smoothstep, lerp, rgbToCss } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { makeCanvas } from '../art/common.js';

export { makeCanvas };

/** Paint a white sprite whose alpha is fn(u, v) with u, v ∈ [0,1] (pixel centres). */
export function alphaSprite(w, h, fn) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const a = fn((x + 0.5) / w, v, x, y);
      const o = (y * w + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = 255;
      d[o + 3] = a <= 0 ? 0 : a >= 1 ? 255 : (a * 255 + 0.5) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Soft round dot: gaussian-ish falloff (core = 0..1 how hard the centre is). */
export function softDot(size, core = 0.25) {
  return alphaSprite(size, size, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (r >= 1) return 0;
    const soft = Math.pow(1 - r * r, 2.2);
    const hard = 1 - smoothstep(0.15, 0.45, r);
    return lerp(soft, Math.max(soft, hard), core);
  });
}

/** Very soft blob for big washes (water masses, cloud shadows, glows). */
export function blob(size) {
  return alphaSprite(size, size, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (r >= 1) return 0;
    const t = 1 - r;
    return t * t * (3 - 2 * t) * Math.pow(1 - r * r, 0.6);
  });
}

/** Horizontal glint / wavelet dash: elongated soft capsule with a bright core. */
export function dash(w, h) {
  return alphaSprite(w, h, (u, v) => {
    const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
    const r = dx * dx + dy * dy;
    if (r >= 1) return 0;
    return Math.pow(1 - r, 1.6);
  });
}

/** Four-point star sparkle with a soft halo (specular glints on the waterline). */
export function star(size) {
  return alphaSprite(size, size, (u, v) => {
    const dx = Math.abs(u - 0.5) * 2, dy = Math.abs(v - 0.5) * 2;
    const r = Math.hypot(dx, dy);
    const halo = Math.max(0, 1 - r) ** 3 * 0.55;
    const armH = Math.max(0, 1 - dx) ** 2.2 * Math.exp(-dy * dy * 260);
    const armV = Math.max(0, 1 - dy) ** 2.2 * Math.exp(-dx * dx * 260) * 0.75;
    const core = Math.exp(-r * r * 60);
    return clamp(halo + armH + armV + core, 0, 1);
  });
}

/** Thin elliptical ring (rain rings / ripples seen in perspective). */
export function ring(w, h, thick = 0.16) {
  return alphaSprite(w, h, (u, v) => {
    const r = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
    const d = Math.abs(r - (1 - thick));
    return Math.max(0, 1 - d / thick) ** 1.5;
  });
}

/**
 * God-ray beam: top-centre origin, widening downward (fan), internal streaks diverging along the beam,
 * bright near the top and fading to nothing at the bottom.
 */
export function beam(w, h, seed, topWidth = 0.45) {
  const rng = createRng(seed);
  const streaks = [];
  const ns = 2 + Math.floor(rng.next() * 3);
  for (let i = 0; i < ns; i++) streaks.push({ u: rng.range(-0.6, 0.6), w: rng.range(0.14, 0.34), a: rng.range(0.2, 0.45) });
  let norm = 0.6;
  for (const s of streaks) norm = Math.max(norm, 0.6 + s.a);
  return alphaSprite(w, h, (u, v) => {
    const hw = lerp(topWidth, 1, Math.pow(v, 0.9));
    const q = ((u - 0.5) * 2) / hw;
    if (q <= -1 || q >= 1) return 0;
    // soft gaussian-like cross-section that reaches exactly 0 at the edge
    const prof = Math.exp(-q * q * 2.6) * (1 - q * q);
    let s = 0.6;
    for (let i = 0; i < streaks.length; i++) {
      const k = (q - streaks[i].u) / streaks[i].w;
      s += streaks[i].a * Math.exp(-k * k);
    }
    const vert = smoothstep(0, 0.05, v) * Math.pow(1 - v, 1.45);
    return prof * (s / norm) * vert;
  });
}

/**
 * Tileable (in x) band of compressed caustic cells: what the sunlit underside of the surface looks like
 * when seen almost edge-on. Bright cell borders, strongest along the top, fading downward.
 * Returned canvas is (w + pad) wide: the first `pad` columns are repeated at the end so any source window
 * up to `pad` wide can be sampled without wrapping.
 */
export function causticBand(w, h, seed, pad = 96, cellsX = 9, cellsY = 4) {
  const rng = createRng(seed);
  const cw = w / cellsX, ch = h / cellsY;
  const pts = [];
  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cellsX; i++) pts.push([(i + rng.range(0.1, 0.9)) * cw, (j + rng.range(0.1, 0.9)) * ch]);
  }
  const W = w + pad;
  return alphaSprite(W, h, (u, v, px, py) => {
    const x = px % w + 0.5, y = py + 0.5;
    const ci = Math.floor(x / cw), cj = Math.floor(y / ch);
    let f1 = 1e9, f2 = 1e9;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = cj + dj;
      if (jj < 0 || jj >= cellsY) continue;
      for (let di = -1; di <= 1; di++) {
        let ii = ci + di, ox = 0;
        if (ii < 0) { ii += cellsX; ox = -w; } else if (ii >= cellsX) { ii -= cellsX; ox = w; }
        const p = pts[jj * cellsX + ii];
        const dx = (p[0] + ox - x) / cw, dy = (p[1] - y) / ch;
        const d = dx * dx + dy * dy;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
    }
    const edge = Math.sqrt(f2) - Math.sqrt(f1);
    const line = Math.max(0, 1 - edge / 0.16) ** 1.6;
    const fall = Math.pow(1 - v, 1.4);
    return line * fall * 0.95;
  });
}

/** Vertical alpha ramp (film / bands): alpha(v) from a curve fn(v). */
export function ramp(w, h, fn) {
  return alphaSprite(w, h, (u, v) => fn(v));
}

/** Small fish silhouette (far school): unit body along +x. */
export function fishSil(w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  // body
  g.moveTo(w * 0.98, h * 0.5);
  g.bezierCurveTo(w * 0.85, h * 0.12, w * 0.45, h * 0.08, w * 0.25, h * 0.42);
  g.lineTo(w * 0.04, h * 0.1);
  g.lineTo(w * 0.1, h * 0.5);
  g.lineTo(w * 0.04, h * 0.9);
  g.lineTo(w * 0.25, h * 0.58);
  g.bezierCurveTo(w * 0.45, h * 0.92, w * 0.85, h * 0.88, w * 0.98, h * 0.5);
  g.fill();
  return c;
}

/** One-slot tint cache for a white sprite: get(rgb) → canvas tinted to rgb (quantised, re-tints rarely). */
export class Tint {
  constructor(src) {
    this.src = src;
    this.canvas = makeCanvas(src.width, src.height);
    this.g = this.canvas.getContext('2d');
    this.key = -1;
  }
  get(rgb) {
    const r = clamp(rgb[0], 0, 255) >> 2, gg = clamp(rgb[1], 0, 255) >> 2, b = clamp(rgb[2], 0, 255) >> 2;
    const key = (r << 12) | (gg << 6) | b;
    if (key !== this.key) {
      this.key = key;
      const g = this.g;
      g.globalCompositeOperation = 'copy';
      g.drawImage(this.src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = rgbToCss([r << 2, gg << 2, b << 2]);
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      g.globalCompositeOperation = 'source-over';
    }
    return this.canvas;
  }
}

/** Like Tint, but fills the sprite with a vertical gradient top → bottom (two colours). */
export class GradTint {
  constructor(src) {
    this.src = src;
    this.canvas = makeCanvas(src.width, src.height);
    this.g = this.canvas.getContext('2d');
    this.key = '';
  }
  get(top, bottom) {
    const q = (c) => (clamp(c, 0, 255) >> 2) << 2;
    const key = q(top[0]) + ',' + q(top[1]) + ',' + q(top[2]) + '|' + q(bottom[0]) + ',' + q(bottom[1]) + ',' + q(bottom[2]);
    if (key !== this.key) {
      this.key = key;
      const g = this.g, h = this.canvas.height;
      g.globalCompositeOperation = 'copy';
      g.drawImage(this.src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, rgbToCss([q(top[0]), q(top[1]), q(top[2])]));
      gr.addColorStop(1, rgbToCss([q(bottom[0]), q(bottom[1]), q(bottom[2])]));
      g.fillStyle = gr;
      g.fillRect(0, 0, this.canvas.width, h);
      g.globalCompositeOperation = 'source-over';
    }
    return this.canvas;
  }
}

export const TWO_PI = TAU;
