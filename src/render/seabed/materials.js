// Ground materials along the world: which material is where (smooth blends at biome edges) and how each
// one is coloured with depth below the local surface. Full local colour — the water's fog pass tints it.
import { smoothstep } from '../../core/math.js';
import { hex, stopsAt } from './util.js';

/** Depth (px below the surface, measured perpendicular to it) beyond which the ground is plain interior. */
export const REACH = 300;

const S = (d, h) => [d, hex(h)];

// index → material
export const TURF = 0, SAND = 1, KELP = 2, WALL = 3, OOZE = 4, BASALT = 5;
export const MAT_COUNT = 6;

// Deep stops are kept close between neighbours so biome blends never show as vertical seams in the interior.
/** colour stops by depth below the surface (px) */
export const MAT_STOPS = [
  // island turf: a grass skin over loam that settles into the same sandy body as the beach
  [S(0, '#9ccc52'), S(4, '#78ad3a'), S(9, '#5f8a2c'), S(14, '#8a7048'), S(34, '#7a6040'), S(70, '#8a7452'), S(130, '#7f6a4e'),
    S(200, '#6a573f'), S(REACH, '#594936')],
  // pale coral sand
  [S(0, '#fbf2d8'), S(5, '#efe0b8'), S(18, '#e2cb9c'), S(45, '#cdb080'), S(90, '#b0946a'), S(140, '#937a58'), S(200, '#7a6449'),
    S(250, '#665540'), S(REACH, '#594936')],
  // kelp-slope rock: grey-brown, a little olive
  [S(0, '#aaa088'), S(6, '#958d76'), S(30, '#7e7765'), S(90, '#686253'), S(170, '#544e43'), S(240, '#48433a'), S(REACH, '#433e36')],
  // drop-off wall rock: warm grey with ochre
  [S(0, '#c8ad86'), S(8, '#ad9270'), S(40, '#8e765c'), S(110, '#6c5a48'), S(190, '#52453a'), S(250, '#463c33'), S(REACH, '#3f3630')],
  // abyssal ooze: grey-tan sediment
  [S(0, '#aaa190'), S(6, '#938a7b'), S(36, '#7a7265'), S(110, '#5e574c'), S(190, '#4a443c'), S(250, '#403b34'), S(REACH, '#3b3630')],
  // trench basalt: blue-black
  [S(0, '#666a78'), S(5, '#4c4f5a'), S(30, '#393a42'), S(100, '#2a2a31'), S(180, '#222228'), S(250, '#1e1e23'), S(REACH, '#1c1c21')],
];

/** Material weights at world x (sum = 1). Writes into out (length MAT_COUNT). */
export function matWeights(x, out) {
  const a = smoothstep(250, 330, x); // turf → sand (island crest → beach)
  const b = smoothstep(2850, 3250, x); // reef sand → kelp rock
  const c = smoothstep(4950, 5250, x); // kelp → drop-off wall
  const d = smoothstep(7300, 7650, x); // wall → abyssal ooze
  const e = smoothstep(10150, 10450, x); // ooze → basalt
  out[TURF] = 1 - a;
  out[SAND] = a * (1 - b);
  out[KELP] = b * (1 - c);
  out[WALL] = c * (1 - d);
  out[OOZE] = d * (1 - e);
  out[BASALT] = e;
  return out;
}

const W = new Float32Array(MAT_COUNT);
const tmp = [0, 0, 0];
/** Ground colour [r,g,b] at world x and depth d below the surface. */
export function groundColor(x, d, out = [0, 0, 0]) {
  matWeights(x, W);
  out[0] = out[1] = out[2] = 0;
  for (let m = 0; m < MAT_COUNT; m++) {
    const w = W[m];
    if (w < 0.002) continue;
    stopsAt(MAT_STOPS[m], d, tmp);
    out[0] += tmp[0] * w;
    out[1] += tmp[1] * w;
    out[2] += tmp[2] * w;
  }
  return out;
}

/** Plain interior colour at x (the ground deeper than REACH). */
export const interiorColor = (x, out) => groundColor(x, REACH + 1, out);

/** Weight of one material at x. */
export function matW(x, m) {
  matWeights(x, W);
  return W[m];
}

/**
 * Horizontal CanvasGradient (in world units) sampling `fn(x) → [r,g,b]` on the global 64-px lattice between
 * x0 and x1 (end colours interpolated from the lattice too), so neighbouring tiles and the solid interior fill
 * produce identical colours at any x.
 */
export function hGradient(ctx, x0, x1, fn, alpha = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const span = x1 - x0;
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  const str = (col) => (alpha >= 1
    ? `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`
    : `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha})`);
  const lat = (x, out) => {
    const l = Math.floor(x / 64) * 64;
    fn(l, a);
    fn(l + 64, b);
    const t = (x - l) / 64;
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  };
  g.addColorStop(0, str(lat(x0, c)));
  for (let x = Math.floor(x0 / 64) * 64 + 64; x < x1; x += 64) {
    fn(x, c);
    g.addColorStop((x - x0) / span, str(c));
  }
  g.addColorStop(1, str(lat(x1, c)));
  return g;
}
