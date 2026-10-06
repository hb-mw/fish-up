// Seabed profile + biome lookup. KERNEL FILE (gameplay, fish AI and seabed art all rely on it).
import { WORLD, BIOMES, biomeAt as biomeAtX } from '../core/config.js';
import { clamp, smoothstep } from '../core/math.js';
import { fbm1 } from '../core/rng.js';

// Control points [x, y] of the seabed (y = px below sea level; negative = land above water).
//   island/beach → coral reef flats → kelp-forest slope → the drop-off (with the wreck ledge)
//   → abyssal plain → the trench (hydrothermal vents on its floor).
const PTS = [
  [0, -150], [260, -72], [430, 0], [560, 95], [800, 300], [1200, 430], [1800, 500], [2400, 468],
  [2900, 560], [3300, 760], [3900, 1050], [4500, 1380], [5000, 1700], [5400, 2300], [5900, 2950],
  [6300, 3080], [6700, 3210], [7100, 3900], [7600, 4350], [8500, 4600], [9500, 4900], [10100, 5200],
  [10500, 5900], [10900, 6700], [11300, 7000], [11700, 6950], [12000, 6480],
];

function baseProfile(x) {
  x = clamp(x, 0, WORLD.width);
  let i = 0;
  while (i < PTS.length - 2 && x > PTS[i + 1][0]) i++;
  const p0 = PTS[Math.max(0, i - 1)], p1 = PTS[i], p2 = PTS[i + 1], p3 = PTS[Math.min(PTS.length - 1, i + 2)];
  const h = p2[0] - p1[0];
  const t = (x - p1[0]) / h;
  // Cubic Hermite with finite-difference tangents (smooth, respects uneven spacing).
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * h;
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

function roughness(x) {
  // amplitude (px) of the bumpy detail, by region
  let a = 6;
  a += 22 * smoothstep(600, 900, x) * (1 - smoothstep(2900, 3300, x)); // reef: lumpy
  a += 18 * smoothstep(3000, 3400, x) * (1 - smoothstep(4900, 5200, x)); // kelp slope
  a += 62 * smoothstep(5000, 5400, x) * (1 - smoothstep(7500, 7900, x)); // craggy drop-off walls
  a -= 50 * smoothstep(5950, 6150, x) * (1 - smoothstep(6600, 6800, x)); // …but a calm ledge for the wreck
  a += 12 * smoothstep(7600, 8000, x) * (1 - smoothstep(10100, 10400, x)); // abyssal plain: gentle
  a += 56 * smoothstep(10200, 10600, x) * (1 - smoothstep(11050, 11250, x)); // trench wall
  a += 20 * smoothstep(11100, 11300, x); // trench floor
  return Math.max(3, a);
}

const STEP = 4;
const N = Math.floor(WORLD.width / STEP) + 2;
const table = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const x = i * STEP;
  const r = roughness(x);
  const n = (fbm1(x * 0.0042, 4, 17) - 0.5) * 2 * r + (fbm1(x * 0.021, 3, 91) - 0.5) * 2 * r * 0.28;
  table[i] = baseProfile(x) + n;
}

/** Seabed y (px below sea level) at world x. Negative on the island (land). */
export function heightAt(x) {
  const f = clamp(x, 0, WORLD.width) / STEP;
  const i = Math.floor(f);
  const t = f - i;
  return table[i] + (table[Math.min(N - 1, i + 1)] - table[i]) * t;
}
/** Seabed slope dy/dx at x (positive = getting deeper to the right). */
export function slopeAt(x) {
  return (heightAt(x + 10) - heightAt(x - 10)) / 20;
}
/** Biome id at x: 'shore' | 'reef' | 'kelp' | 'slope' | 'open' | 'trench' */
export function biomeIdAt(x) {
  return biomeAtX(x).id;
}

export const LANDMARKS = {
  dock: { x: 470, y: 0 },
  reefCrest: { x: 2400, y: heightAt(2400) },
  wreck: { x: 6330, y: heightAt(6330) },
  vents: [11080, 11330, 11560].map((x) => ({ x, y: heightAt(x) })),
};

/** Stored at game.world.terrain */
export function createTerrain() {
  return {
    heightAt,
    slopeAt,
    biomeAt: biomeIdAt,
    biomes: BIOMES,
    landmarks: LANDMARKS,
    /** px of water between a point and the seabed directly below it (negative = inside the ground) */
    clearance: (x, y) => heightAt(x) - y,
  };
}
