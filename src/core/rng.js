// Seeded RNG + cheap deterministic noise. KERNEL FILE.

/** mulberry32 — small, fast, good enough. */
export function createRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** float in [a, b) */
    range: (a, b) => a + (b - a) * next(),
    /** integer in [a, b] inclusive */
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    /** approx normal(0,1) */
    gaussian: () => {
      let u = 0;
      for (let i = 0; i < 6; i++) u += next();
      return (u - 3) / 0.7071;
    },
    /** weighted pick: weightFn(item) → weight ≥ 0. Returns undefined when all weights are 0. */
    weighted: (items, weightFn) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weightFn(it));
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weightFn(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
    /** new independent generator derived from this one */
    fork: () => createRng(Math.floor(next() * 4294967296)),
  };
  return rng;
}

/** Deterministic hash of an integer → [0,1). */
export function hash1(n) {
  let x = (n | 0) * 374761393;
  x = (x ^ (x >>> 13)) * 1274126177;
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967296;
}
/** Deterministic hash of two integers → [0,1). */
export function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
/** Hash a string → uint32 (for seeding per-species generators). */
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const fade = (t) => t * t * (3 - 2 * t);
/** 1D value noise in [0,1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, seed), b = hash2(i + 1, seed);
  return a + (b - a) * fade(f);
}
/** 2D value noise in [0,1]. */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = seed * 7919;
  const a = hash2(xi + s, yi), b = hash2(xi + 1 + s, yi);
  const c = hash2(xi + s, yi + 1), d = hash2(xi + 1 + s, yi + 1);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal 1D noise in ~[0,1]. */
export function fbm1(x, octaves = 4, seed = 0) {
  let amp = 0.5, sum = 0, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x * f, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
/** Fractal 2D noise in ~[0,1]. */
export function fbm2(x, y, octaves = 4, seed = 0) {
  let amp = 0.5, sum = 0, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x * f, y * f, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
