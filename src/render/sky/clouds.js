// Clouds — the centrepiece of the sky.
//
// Every cloud is BAKED once into per-pixel fields (low-res, soft):
//   den   density / coverage 0..1 (puff clusters + fractal erosion)
//   nx,ny the normal of the billow that dominates the pixel (gives cumulus their cauliflower relief)
//   T[8]  light transmittance from 8 directions (exponential self-shadowing along each direction)
// and is SHADED on demand into its own sprite canvas (per-pixel, cheap: no noise, no marching) whenever the
// light direction, the palette or its haze changed noticeably. Shading runs in update() under a pixel
// budget, so a dawn or a weather change re-lights the sky progressively instead of in one frame.
// Visibility follows the SMOOTHED weather values (never weather.type), so clouds form and dissolve.
import { createRng } from '../../core/rng.js';
import { makeCanvas, css, mix, colorDelta, copy3, unflash, sstep, noiseAt, createNoiseTex, radicalInverse, mod } from './util.js';

const NT = createNoiseTex(1234, 256, 6, 4, 0.55); // general fbm
const NF = createNoiseTex(4321, 128, 4, 8, 0.6); // fine detail
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]]; // step toward the light (screen, y down)
const MOON_SILVER = [176, 192, 228];
const WHITE = [255, 255, 255];

// ── shape generators (all in bake px) ─────────────────────────────────────────────────────────────
function cumulusPuffs(rng, W, H, o) {
  const puffs = [];
  const baseY = H * o.base;
  const nT = rng.int(o.towers[0], o.towers[1]);
  const bumps = [];
  for (let i = 0; i < nT; i++) bumps.push({ c: rng.range(0.2, 0.8) * W, s: rng.range(0.1, 0.22) * W, h: rng.range(0.4, 0.85) });
  bumps[0].c = rng.range(0.32, 0.62) * W;
  bumps[0].h = 1;
  bumps[0].s = rng.range(0.16, 0.26) * W;
  const top = H * 0.05;
  const topAt = (x) => {
    const u = x / W;
    let h = (o.dome || 0.36) * Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.7);
    for (const b of bumps) {
      const q = (x - b.c) / b.s;
      h = Math.max(h, b.h * Math.exp(-q * q));
    }
    h *= Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.02) / 0.96)))), 0.35);
    return baseY - h * (baseY - top);
  };
  // body puffs whose tops touch the skyline
  for (let i = 0; i < o.puffs; i++) {
    const x = W * (0.07 + 0.86 * rng.next());
    const t = topAt(x);
    const hh = baseY - t;
    if (hh < H * 0.08) continue;
    let r = hh * rng.range(0.3, 0.52);
    r = Math.min(Math.max(r, H * 0.09), H * 0.4);
    let cy = t + r * rng.range(0.88, 1.06);
    if (cy > baseY - r * 0.25) cy = baseY - r * 0.25;
    puffs.push({ x, y: cy, r, w: 1 });
  }
  // flat base: a few broad, low puffs (wide spacing so they never read as a row of bumps)
  const br = H * (o.baseR || 0.24);
  for (let x = W * 0.1 + br * 0.5; x < W * 0.9; x += br * rng.range(0.7, 0.95)) {
    if (topAt(x) > baseY - H * 0.12) continue;
    const r = br * rng.range(0.95, 1.2);
    puffs.push({ x, y: baseY - r * 0.3, r, rx: r * 1.5, ry: r, w: 0.75, base: true });
  }
  // cauliflower: smaller billows on the upper arcs of skyline puffs
  const n0 = puffs.length;
  const cauli = o.cauli === undefined ? [2, 4] : o.cauli;
  for (let i = 0; i < n0; i++) {
    const p = puffs[i];
    if (p.base || p.y - p.r > topAt(p.x) + p.r * 0.6) continue;
    const k = rng.int(cauli[0], cauli[1]);
    for (let j = 0; j < k; j++) {
      const a = rng.range(-2.7, -0.45);
      const rr = p.r * rng.range(0.28, 0.46);
      puffs.push({ x: p.x + Math.cos(a) * p.r * 0.7, y: p.y + Math.sin(a) * p.r * 0.7, r: rr, w: 0.85 });
    }
  }
  return { puffs, baseY };
}

function accumulatePuffs(W, H, puffs, acc, wsum, nxs, nys, sum = false) {
  for (const p of puffs) {
    const rx = p.rx || p.r, ry = p.ry || p.r;
    const x0 = Math.max(0, Math.floor(p.x - rx)), x1 = Math.min(W - 1, Math.ceil(p.x + rx));
    const y0 = Math.max(0, Math.floor(p.y - ry)), y1 = Math.min(H - 1, Math.ceil(p.y + ry));
    const ix = 1 / rx, iy = 1 / ry, w = p.w;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - p.y) * iy, dy2 = dy * dy;
      if (dy2 >= 1) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - p.x) * ix;
        const q = dx * dx + dy2;
        if (q >= 1) continue;
        const f = 1 - q, f2 = f * f;
        const i = y * W + x;
        const v = f2 * w;
        // soft max: mostly the strongest billow, a little of the sum to keep the body solid
        const m = acc[i];
        acc[i] = sum ? m + v : v > m ? v + 0.22 * m : m + 0.22 * v;
        const ww = f2 * f2 * f * w;
        wsum[i] += ww;
        nxs[i] += ww * dx;
        nys[i] += ww * dy;
      }
    }
  }
}

/*
 * All generators write c.den as a RAW DEPTH field: ≤ 0 outside, 0..1 across the soft edge, > 1 in the solid
 * core. At full formation alpha = smoothstep(0, 1, den); while a cloud forms or dissolves the threshold is
 * raised, so it shrinks, thins and frays along its noise instead of turning into a transparent ghost.
 */

/** Puff-cluster cloud → fields. o: {thr, soft, erode, baseSoft, noiseScale, stretch} */
function bakePuffCloud(c, rng, puffs, baseY, o) {
  const W = c.bw, H = c.bh, n = W * H;
  const acc = new Float32Array(n), wsum = new Float32Array(n), nxs = new Float32Array(n), nys = new Float32Array(n);
  accumulatePuffs(W, H, puffs, acc, wsum, nxs, nys, !!o.sum);
  writeFields(c, rng, acc, wsum, nxs, nys, baseY, o);
}

function writeFields(c, rng, acc, wsum, nxs, nys, baseY, o) {
  const W = c.bw, H = c.bh;
  const den = c.den, nx = c.nx, ny = c.ny;
  const ox = rng.range(0, 256), oy = rng.range(0, 256);
  const fs = o.noiseScale / c.bs; // texels per bake px (keeps feature size constant in sky px)
  const thr = o.thr, soft = o.soft, erode = o.erode, st = o.stretch || 1;
  for (let y = 0; y < H; y++) {
    const baseCut = baseY > 0 ? sstep(baseY + o.baseSoft, baseY - o.baseSoft * 1.6, y + (noiseAt(NF, oy, y * 0.3) - 0.5) * 2) : 1;
    const bb = baseY > 0 ? sstep(baseY - H * 0.24, baseY, y) : 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = acc[i];
      if (a < 0.02) {
        den[i] = -1;
        continue;
      }
      const nn = noiseAt(NT, ox + x * fs * st, oy + y * fs);
      const nd = noiseAt(NF, ox * 0.5 + x * fs * 2.2 * st, oy * 0.5 + y * fs * 2.2);
      const edge = 1 - sstep(thr, thr + 0.9, a);
      const v = a - erode * edge * (nn * 0.8 + nd * 0.45 - 0.42);
      let d = (v - thr) / soft;
      d -= (1 - baseCut) * 4; // flat base
      // inner structure (where it frays when it dissolves) — none at the rim, so the formed silhouette keeps its billows
      if (d > 3.2) d = 3.2 + (d - 3.2) * 0.15;
      if (d > 0.6) d += ((nd - 0.5) * 1.5 + (nn - 0.5) * 2.2) * (d >= 2.6 ? 1 : (d - 0.6) / 2);
      den[i] = d > 8 ? 8 : d;
      if (wsum[i] > 1e-6) {
        let vx = (nxs[i] / wsum[i]) * 1.3, vy = (nys[i] / wsum[i]) * 1.3;
        const m = vx * vx + vy * vy;
        if (m > 0.98) {
          const s = 0.99 / Math.sqrt(m);
          vx *= s;
          vy *= s;
        }
        // the flat base faces down: fade the billow normals out near it (no stripes from base puffs)
        vx *= 1 - bb;
        vy = vy * (1 - bb) + 0.6 * bb;
        if (o.flatten) {
          vx *= 1 - o.flatten;
          vy = vy * (1 - o.flatten) - 0.25 * o.flatten;
        }
        nx[i] = Math.round(vx * 127);
        ny[i] = Math.round(vy * 127);
      }
    }
  }
}

function genCumulus(c, rng, o) {
  const { puffs, baseY } = cumulusPuffs(rng, c.bw, c.bh, o);
  bakePuffCloud(c, rng, puffs, baseY, { thr: 0.2, soft: 0.2, erode: o.erode || 0.8, baseSoft: o.baseSoft || 3, noiseScale: 1.0 });
}

/** Distant cumulus: a long low bank of soft rounded humps (no small bumps), one or two a little taller. */
function genFar(c, rng) {
  const W = c.bw, H = c.bh;
  const puffs = [];
  const baseY = H * 0.86;
  const t1 = rng.range(0.25, 0.75) * W, t2 = rng.range(0.15, 0.85) * W, h2 = rng.range(0, 0.35);
  let x = W * 0.07;
  while (x < W * 0.93) {
    const u = x / W;
    const env = Math.pow(Math.sin(Math.PI * u), 0.6);
    let r = H * rng.range(0.3, 0.42) * (0.5 + 0.5 * env);
    r *= 1 + 0.55 * Math.exp(-Math.pow((x - t1) / (W * 0.11), 2)) + h2 * Math.exp(-Math.pow((x - t2) / (W * 0.08), 2));
    puffs.push({ x, y: baseY - r * 0.6, r, w: 1 });
    x += r * rng.range(0.75, 1.05);
  }
  bakePuffCloud(c, rng, puffs, baseY, { thr: 0.25, soft: 0.32, erode: 0.75, baseSoft: 2, noiseScale: 1.2, flatten: 0.7, sum: true });
}

function genScud(c, rng) {
  const W = c.bw, H = c.bh;
  const puffs = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const x = W * rng.range(0.08, 0.92);
    const env = Math.sin(Math.PI * (x / W));
    const r = H * rng.range(0.18, 0.36) * (0.5 + 0.5 * env);
    puffs.push({ x, y: H * rng.range(0.4, 0.62), r, w: 0.9 });
  }
  bakePuffCloud(c, rng, puffs, H * 0.72, { thr: 0.18, soft: 0.4, erode: 1.25, baseSoft: 6, noiseScale: 1.1, stretch: 0.55, sum: true });
}

function genTower(c, rng) {
  const W = c.bw, H = c.bh;
  const puffs = [];
  const baseY = H * 0.93;
  const cx = W * rng.range(0.42, 0.58);
  const anvilY = H * rng.range(0.14, 0.2);
  const colW = W * rng.range(0.2, 0.26);
  const lean = rng.range(-0.25, 0.25) * W;
  // column of billows from the base to the anvil
  for (let y = baseY - colW * 0.3; y > anvilY + colW * 0.2; y -= colW * rng.range(0.22, 0.32)) {
    const k = (baseY - y) / (baseY - anvilY);
    const w = colW * (1.15 - 0.35 * k + 0.25 * Math.sin(k * 7 + rng.next()));
    const xc = cx + lean * k * k;
    const m = rng.int(2, 4);
    for (let j = 0; j < m; j++) {
      const r = w * rng.range(0.42, 0.62);
      puffs.push({ x: xc + rng.range(-0.55, 0.55) * w, y: y + rng.range(-0.15, 0.15) * w, r, w: 1 });
    }
  }
  // wide skirt at the base
  for (let x = W * 0.12; x < W * 0.88; x += colW * 0.38) {
    const r = colW * rng.range(0.35, 0.55) * (1 - Math.abs(x / W - 0.5) * 0.9);
    puffs.push({ x, y: baseY - r * 0.55, r, w: 0.9 });
  }
  // billows on the anvil underside
  const ax = cx + lean;
  for (let i = 0; i < 9; i++) {
    const x = ax + rng.range(-0.38, 0.38) * W;
    const r = colW * rng.range(0.22, 0.4);
    puffs.push({ x, y: anvilY + colW * rng.range(0.15, 0.4), r, w: 0.8 });
  }
  const n = W * H;
  const acc = new Float32Array(n), wsum = new Float32Array(n), nxs = new Float32Array(n), nys = new Float32Array(n);
  accumulatePuffs(W, H, puffs, acc, wsum, nxs, nys);
  // the anvil: a flat-topped, wind-sheared plate
  const ox = rng.range(0, 256), oy = rng.range(0, 256);
  const shear = lean > 0 ? 1 : -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = (x - ax) / (W * 0.46);
      const v = (y - anvilY) / (H * 0.075);
      const plate = Math.exp(-v * v * 1.4) * Math.max(0, 1 - Math.pow(Math.abs(u - shear * 0.12), 2.4));
      if (plate > 0.01) {
        const fib = noiseAt(NT, ox + x * 0.25, oy + y * 1.6);
        acc[i] += plate * (0.7 + 0.6 * fib);
        if (wsum[i] < 0.05) {
          wsum[i] = 0.05;
          nys[i] = -0.04 * Math.sign(v);
        }
      }
    }
  }
  writeFields(c, rng, acc, wsum, nxs, nys, baseY, { thr: 0.22, soft: 0.3, erode: 0.7, baseSoft: 5, noiseScale: 0.75 });
}

/** Long bands of flattened puffs with breaks and combed edges — lit gold/pink from below at dusk. */
function genStratus(c, rng) {
  const W = c.bw, H = c.bh;
  const puffs = [];
  const ph = rng.range(0, 6.28), amp = rng.range(0.04, 0.12) * H;
  const nBands = rng.chance(0.4) ? 2 : 1;
  for (let b = 0; b < nBands; b++) {
    const yb = H * (nBands === 1 ? 0.55 : b === 0 ? 0.42 : 0.68);
    const x0 = W * (b === 0 ? 0.03 : rng.range(0.15, 0.4)), x1 = W * (b === 0 ? 0.97 : rng.range(0.6, 0.9));
    let x = x0;
    while (x < x1) {
      const u = (x - x0) / (x1 - x0);
      const taper = Math.pow(Math.sin(Math.PI * u), 0.6);
      const ry = H * rng.range(0.12, 0.24) * (0.4 + 0.6 * taper) * (b === 0 ? 1 : 0.75);
      const rx = ry * rng.range(5, 9);
      // breaks: skip some links of the chain
      if (rng.chance(0.85) || u < 0.08 || u > 0.92) puffs.push({ x, y: yb + amp * Math.sin((x / W) * 5 + ph + b) + rng.range(-0.35, 0.35) * ry, rx, ry, r: rx, w: rng.range(0.7, 1.1) });
      x += rx * rng.range(0.35, 0.6);
    }
  }
  bakePuffCloud(c, rng, puffs, -1, { thr: 0.22, soft: 0.55, erode: 1.6, baseSoft: 0, noiseScale: 1.1, stretch: 0.12 });
}

/** Fibrous cirrus: curved ribbons combed along their length, frayed at the ends, some with a hooked tail. */
function genCirrus(c, rng) {
  const W = c.bw, H = c.bh;
  const den = c.den;
  den.fill(-1);
  const strands = [];
  const ns = rng.int(2, 4);
  for (let s = 0; s < ns; s++) {
    strands.push({
      y0: rng.range(0.3, 0.7), slope: rng.range(-0.35, 0.35), curve: rng.range(-0.5, 0.5),
      x0: rng.range(0, 0.3), x1: rng.range(0.62, 1), th: rng.range(0.06, 0.13),
      hook: rng.range(-1, 1), a: rng.range(0.55, 1), seed: rng.range(0, 200),
    });
  }
  const ox = rng.range(0, 256), oy = rng.range(0, 256);
  const fs = 0.55 / c.bs;
  for (let x = 0; x < W; x++) {
    const u = x / W;
    for (const s of strands) {
      if (u < s.x0 || u > s.x1) continue;
      const k = (u - s.x0) / (s.x1 - s.x0);
      const taper = Math.pow(Math.sin(Math.PI * k), 0.5) * s.a;
      const hook = s.hook * Math.pow(Math.max(0, k - 0.72) / 0.28, 2) * 0.22;
      const yc = s.y0 + s.slope * (k - 0.5) + s.curve * (k - 0.5) * (k - 0.5) + hook;
      const th = s.th * (0.45 + 0.9 * noiseAt(NT, ox + x * fs * 0.3, oy + s.seed)) * (0.4 + 0.6 * taper);
      for (let y = 0; y < H; y++) {
        const dv = (y / H - yc) / th;
        if (dv * dv > 6) continue;
        // fibres follow the strand: noise varies fast across it, slowly along it
        const fib = noiseAt(NT, ox + s.seed + x * fs * 0.08, oy + dv * 7);
        const fine = noiseAt(NF, ox + x * fs * 0.35, oy + s.seed + dv * 11);
        const raw = Math.exp(-dv * dv) * taper * (0.15 + 1.1 * fib * (0.6 + 0.4 * fine)) - 0.28;
        const i = y * W + x;
        const d = raw / 0.38;
        if (d > den[i]) den[i] = d;
      }
    }
  }
}

/** Overcast deck: a horizontally tileable sheet of soft stratocumulus cells, flattened toward the horizon. */
function genDeck(c, rng) {
  const W = c.bw, H = c.bh;
  const den = c.den, ny = c.ny;
  const T = NT.size, TF = NF.size;
  const oy = rng.range(0, 256);
  for (let y = 0; y < H; y++) {
    const v = y / H; // 0 = top (overhead), 1 = bottom (toward the horizon)
    const pv = Math.pow(v, 1.7); // perspective: cells shrink toward the horizon
    const sy = oy + pv * 150;
    // tileable in x: blend two integer cell counts (each wraps exactly across the tile)
    const cells = 1 + 2.5 * pv;
    const m0 = Math.floor(cells), m1 = m0 + 1, bl = cells - m0;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const a0 = noiseAt(NT, u * T * m0, sy), a1 = noiseAt(NT, u * T * m1, sy);
      const b0 = noiseAt(NF, u * TF * m0 * 2, sy * 2.1), b1 = noiseAt(NF, u * TF * m1 * 2, sy * 2.1);
      const n1 = a0 + (a1 - a0) * bl, n2 = b0 + (b1 - b0) * bl;
      const i = y * W + x;
      den[i] = Math.min(1, Math.max(0, n1 * 0.85 + n2 * 0.35 - 0.1));
      ny[i] = Math.round((n2 - 0.5) * 60);
    }
  }
}

// ── light transmittance maps ─────────────────────────────────────────────────────────────────────
function bakeTransmittance(c, sigma, reach) {
  const W = c.bw, H = c.bh, n = W * H;
  const den = c.den;
  const acc = new Float32Array(n);
  for (let k = 0; k < 8; k++) {
    const [sx, sy] = DIRS[k];
    const len = sx && sy ? Math.SQRT2 : 1;
    const decay = Math.exp(-len / reach);
    const xs = sx > 0 ? W - 1 : 0, xe = sx > 0 ? -1 : W, xd = sx > 0 ? -1 : 1;
    const ys = sy > 0 ? H - 1 : 0, ye = sy > 0 ? -1 : H, yd = sy > 0 ? -1 : 1;
    const T = c.T[k];
    for (let y = ys; y !== ye; y += yd) {
      const py = y + sy;
      const rowOk = py >= 0 && py < H;
      for (let x = xs; x !== xe; x += xd) {
        const i = y * W + x;
        const px = x + sx;
        const prev = rowOk && px >= 0 && px < W ? acc[py * W + px] : 0;
        const dv = den[i];
        const a = (dv <= 0 ? 0 : dv >= 1 ? 1 : dv) * len + prev * decay;
        acc[i] = a;
        T[i] = Math.round(255 * Math.exp(-sigma * a));
      }
    }
  }
}

// ── cloud kinds & layers ──────────────────────────────────────────────────────────────────────────
const KINDS = {
  // w/h: sky px · bs: bake px per sky px (× device scale, capped) · sigma/reach: self-shadowing ·
  // depth: how far the threshold rises while forming/dissolving · alpha: max opacity
  cirrus: { w: [460, 820], h: [80, 140], bs: 0.45, gen: genCirrus, sigma: 0.012, reach: 40, depth: 1.6, alpha: 0.62 },
  cumFar: { w: [170, 340], h: [30, 54], bs: 0.6, gen: genFar, sigma: 0.035, reach: 30, depth: 2.5, alpha: 1 },
  cumulus: { w: [260, 440], h: [110, 180], bs: 0.5, gen: (c, r) => genCumulus(c, r, { towers: [1, 3], puffs: 24, base: 0.86 }), sigma: 0.03, reach: 70, depth: 3, alpha: 1 },
  cumBig: { w: [440, 680], h: [200, 300], bs: 0.45, gen: (c, r) => genCumulus(c, r, { towers: [2, 3], puffs: 32, base: 0.88 }), sigma: 0.026, reach: 95, depth: 3, alpha: 1 },
  stratus: { w: [380, 880], h: [34, 66], bs: 0.5, gen: genStratus, sigma: 0.03, reach: 40, depth: 1.6, alpha: 0.82 },
  tower: { w: [620, 900], h: [520, 680], bs: 0.36, gen: genTower, sigma: 0.03, reach: 120, depth: 3, alpha: 1 },
  scud: { w: [340, 600], h: [80, 140], bs: 0.42, gen: genScud, sigma: 0.04, reach: 45, depth: 2, alpha: 0.92 },
};

const LAYERS = [
  { id: 'cirrus', kind: 'cirrus', n: 5, par: 0.035, speed: 5, alt: [260, 560], drv: 'cirrus', haze: 0.12, back: true },
  { id: 'tower', kind: 'tower', n: 3, par: 0.015, speed: 1.6, alt: [-8, 4], drv: 'storm', haze: 0.2, back: true },
  { id: 'far', kind: 'cumFar', n: 12, par: 0.025, speed: 4, alt: [6, 64], drv: 'far', haze: 0.42, back: true },
  { id: 'stratus', kind: 'stratus', n: 5, par: 0.045, speed: 6, alt: [36, 230], drv: 'stratus', haze: 0.18, back: true },
  { id: 'mid', kind: 'cumulus', n: 8, par: 0.06, speed: 8, alt: [96, 250], drv: 'cumulus', haze: 0.16, back: false },
  { id: 'near', kind: 'cumBig', n: 6, par: 0.1, speed: 12, alt: [215, 600], drv: 'cumulus', haze: 0.05, back: false },
  { id: 'scud', kind: 'scud', n: 7, par: 0.16, speed: 26, alt: [70, 270], drv: 'scud', haze: 0.1, back: false },
];

export function createClouds(game) {
  const env = game.env;
  const rng = createRng(90210);
  const layers = [];
  const all = [];
  const stats = { baked: 0, bakeMs: 0, shadePx: 0, shadeMs: 0, visible: 0 };

  for (const L of LAYERS) {
    const spec = KINDS[L.kind];
    const layer = { ...L, spec, clouds: [], drift: rng.range(0, 3000), pad: spec.w[1] + 40 };
    for (let i = 0; i < L.n; i++) {
      const w = rng.range(spec.w[0], spec.w[1]);
      const h = rng.range(spec.h[0], spec.h[1]) * (0.85 + 0.3 * ((w - spec.w[0]) / (spec.w[1] - spec.w[0] + 1)));
      const c = {
        layer, kind: L.kind, seed: rng.int(1, 1e9), w, h,
        u: (i + rng.range(0.15, 0.85)) / L.n,
        alt: rng.range(L.alt[0], L.alt[1]),
        flip: rng.chance(0.5),
        thr: 0, alpha: -1, target: 0,
        baked: false, stale: false, bs: spec.bs, bw: 0, bh: 0,
        den: null, nx: null, ny: null, T: null, canvas: null, img: null,
        shaded: false, key: null, cx: 0, cy: 0, pri: 0,
      };
      layer.clouds.push(c);
      all.push(c);
    }
    // spread appearance thresholds so any subset is evenly spaced across the layer
    const byPos = [...layer.clouds].sort((a, b) => a.u - b.u);
    byPos.forEach((c, rank) => {
      c.thr = 0.1 + 0.84 * radicalInverse(rank);
    });
    // far clouds sit lower the smaller they are; near ones vary a lot
    layers.push(layer);
  }

  // overcast deck (one tileable sheet)
  const deck = {
    layer: { id: 'deck', haze: 0.12, spec: { sigma: 0.02, reach: 80, bs: 0.3 } }, kind: 'deck', seed: 4747, w: 1400, h: 520,
    bs: 0.3, bw: 0, bh: 0, baked: false, stale: false, alpha: 0, target: 0, den: null, nx: null, ny: null, T: null, canvas: null, img: null,
    shaded: false, key: null, drift: 0, cx: 0, cy: 0, pri: 0,
  };

  let bakedScale = Math.min(1.5, Math.max(1, game.view.scale));
  function bake(c) {
    const t0 = performance.now();
    // bake resolution follows the device scale (capped) so the upscale factor stays similar at every quality
    c.bs = (c.layer.spec.bs || c.bs0 || 0.4) * bakedScale;
    c.stale = false;
    c.bw = Math.max(4, Math.round(c.w * c.bs));
    c.bh = Math.max(4, Math.round(c.h * c.bs));
    const n = c.bw * c.bh;
    c.den = new Float32Array(n);
    c.nx = new Int8Array(n);
    c.ny = new Int8Array(n);
    c.T = [];
    for (let k = 0; k < 8; k++) c.T.push(new Uint8Array(n));
    const r = createRng(c.seed);
    if (c.kind === 'deck') genDeck(c, r);
    else c.layer.spec.gen(c, r);
    // optical depth per sky px and shadow reach in sky px → bake px (same look at every bake scale)
    bakeTransmittance(c, c.layer.spec.sigma / c.bs, c.layer.spec.reach * c.bs);
    c.canvas = makeCanvas(c.bw, c.bh);
    c.ctx = c.canvas.getContext('2d');
    c.img = c.ctx.createImageData(c.bw, c.bh);
    c.baked = true;
    c.shaded = false;
    stats.baked++;
    stats.bakeMs += performance.now() - t0;
  }

  // ── drivers: how much of each cloud family the smoothed weather asks for ─────────────────────
  const drivers = { cirrus: 0, cumulus: 0, far: 0, stratus: 0, storm: 0, scud: 0, deck: 0 };
  function updateDrivers() {
    const w = env.weather, c = w.cloud;
    drivers.cirrus = sstep(0.02, 0.22, c) * (1 - sstep(0.62, 0.9, c));
    drivers.cumulus = sstep(0.05, 0.78, c);
    drivers.stratus = sstep(0.06, 0.5, c) * (0.12 + 0.88 * Math.min(1, env.goldenHour * 1.3)) * (1 - sstep(0.8, 1, c));
    drivers.storm = sstep(0.5, 0.95, w.rain) * sstep(0.85, 1, c);
    drivers.scud = sstep(0.12, 0.75, w.rain);
    drivers.far = drivers.cumulus * (1 - 0.85 * sstep(0.3, 0.9, w.rain));
    drivers.deck = sstep(0.5, 0.95, c);
  }

  // ── lighting parameters per cloud ─────────────────────────────────────────────────────────────
  const litC = [0, 0, 0], shadeC = [0, 0, 0], horC = [0, 0, 0];
  const light = { sunW: 0, moonW: 0, overcast: 0, storm: 0, gh: 0 };
  function updateLight() {
    const p = env.palette, w = env.weather, fl = w.lightning;
    unflash(litC, p.cloudLit, fl);
    unflash(shadeC, p.cloudShade, fl);
    unflash(horC, p.skyHorizon, fl);
    light.sunW = sstep(-0.24, 0.0, env.sun.elev);
    light.moonW = (1 - light.sunW) * sstep(-0.05, 0.2, env.moon.elev);
    light.overcast = sstep(0.5, 1, w.cloud);
    light.storm = sstep(0.3, 1, w.rain);
    light.gh = env.goldenHour;
  }

  /** Desired shading key for a cloud at screen centre (cx, cy) given the frame F. */
  function shadeParams(c, cx, cy, F, out) {
    const L = c.layer;
    // light vector toward the sun and/or moon (screen: y down)
    let lx = 0, ly = -1;
    let sx = F.sunX - cx, sy = F.sunY - cy;
    const sd = Math.hypot(sx, sy) || 1;
    let mx = F.moonX - cx, my = F.moonY - cy;
    const md = Math.hypot(mx, my) || 1;
    sx /= sd; sy /= sd; mx /= md; my /= md;
    lx = sx * light.sunW + mx * light.moonW * 0.6;
    ly = sy * light.sunW + my * light.moonW * 0.6;
    const ll = Math.hypot(lx, ly);
    if (ll < 1e-3) { lx = 0; ly = -1; } else { lx /= ll; ly /= ll; }
    if (c.flip) lx = -lx; // mirrored sprites are shaded in their own (unmirrored) space
    // backlit when the light source sits right behind the cloud
    const R = Math.min(c.w, c.h * 1.6) * 0.5 * F.k;
    const dist = light.sunW >= light.moonW ? sd : md;
    const back = sstep(R * 1.9, R * 0.3, dist) * 0.75;
    const strength = (light.sunW * (0.35 + 0.65 * sstep(-0.12, 0.08, env.sun.elev)) + light.moonW * 0.55) * (1 - 0.82 * light.overcast) * (1 - 0.5 * light.storm);
    // colours
    const lit = out.lit, shade = out.shade, rim = out.rim, haze = out.haze;
    copy3(lit, litC);
    copy3(shade, shadeC);
    // golden hour: the sunlit side takes on the warm glow of the low sun
    const warm = light.gh * light.sunW * 0.38;
    if (warm > 0.005) {
      const g = env.palette.sunGlow;
      lit[0] += (g[0] - lit[0]) * warm;
      lit[1] += (g[1] - lit[1]) * warm;
      lit[2] += (g[2] - lit[2]) * warm;
    }
    if (light.moonW > 0.01) {
      const mk = light.moonW * 0.5;
      lit[0] += (MOON_SILVER[0] - lit[0]) * mk;
      lit[1] += (MOON_SILVER[1] - lit[1]) * mk;
      lit[2] += (MOON_SILVER[2] - lit[2]) * mk;
    }
    // overcast flattens the light; rain and storms darken the clouds to slate
    const oc = light.overcast, st = light.storm;
    if (oc > 0.001 || st > 0.001) {
      const dim = (1 - 0.2 * oc) * (1 - 0.52 * st);
      const flat = Math.min(1, 0.5 * oc + 0.45 * st);
      for (let j = 0; j < 3; j++) {
        shade[j] *= dim;
        lit[j] += (shade[j] * 1.4 - lit[j]) * flat;
      }
    }
    const rimC = light.sunW >= light.moonW ? mix(env.palette.sunGlow, WHITE, 0.5 - 0.36 * light.gh) : mix(MOON_SILVER, WHITE, 0.3);
    copy3(rim, rimC);
    copy3(haze, horC);
    out.lx = lx;
    out.ly = ly;
    out.back = back;
    out.strength = strength;
    out.rimK = (0.2 + 0.85 * light.gh) * (light.sunW >= light.moonW ? 1 : 0.6) * (1 - 0.7 * light.overcast) + back * 0.7 * (1 - light.overcast);
    out.hazeK = Math.min(0.9, L.haze * (1 + 1.3 * env.weather.fog) + 0.25 * env.weather.fog);
    out.cover = drivers.deck;
    out.form = c.kind === 'deck' ? 1 : Math.max(0, Math.min(1, c.alpha));
    // a low sun lights clouds from the side: less light from the viewer's side, crisper terminators
    const lowSun = (1 - sstep(0.12, 0.5, env.sun.elev)) * light.sunW;
    out.front = 0.55 - 0.15 * lowSun;
    out.wrap = 0.45 - 0.2 * lowSun;
    return out;
  }
  const newKey = () => ({ lx: 0, ly: 0, back: 0, strength: 0, rimK: 0, hazeK: 0, cover: 0, form: 1, front: 0.5, wrap: 0.5, lit: [0, 0, 0], shade: [0, 0, 0], rim: [0, 0, 0], haze: [0, 0, 0] });
  const want = newKey();

  function keyChange(a, b) {
    if (!a) return 99;
    const ang = Math.abs(Math.atan2(a.ly, a.lx) - Math.atan2(b.ly, b.lx));
    const angD = Math.min(ang, Math.PI * 2 - ang);
    return Math.max(
      angD / 0.07,
      Math.abs(a.back - b.back) / 0.05,
      Math.abs(a.strength - b.strength) / 0.04,
      Math.abs(a.rimK - b.rimK) / 0.05,
      Math.abs(a.hazeK - b.hazeK) / 0.04,
      Math.abs(a.cover - b.cover) / 0.03,
      Math.abs(a.form - b.form) / 0.035,
      Math.abs(a.front - b.front) / 0.04,
      colorDelta(a.lit, b.lit) / 3,
      colorDelta(a.shade, b.shade) / 3,
      colorDelta(a.rim, b.rim) / 4,
      colorDelta(a.haze, b.haze) / 4,
    );
  }

  // ── the per-pixel shader ──────────────────────────────────────────────────────────────────────
  function shade(c, P) {
    const t0 = performance.now();
    const n = c.bw * c.bh;
    const out = c.img.data;
    const den = c.den, NX = c.nx, NY = c.ny;
    // pick the two transmittance maps that bracket the light direction
    let ang = Math.atan2(-P.ly, P.lx); // math convention (y up)
    if (ang < 0) ang += Math.PI * 2;
    const fa = ang / (Math.PI / 4);
    const i0 = Math.floor(fa) % 8, i1 = (i0 + 1) % 8, ft = fa - Math.floor(fa);
    const T0 = c.T[i0], T1 = c.T[i1], TU = c.T[2], TD = c.T[6];
    const lx = P.lx, ly = P.ly;
    const back = P.back;
    // 3-D light: mostly in the sky plane, partly from the viewer's side; swings behind the cloud when backlit
    const lz = P.front - 1.1 * back;
    const wrap = P.wrap, wrapN = 1 / (1 + P.wrap);
    const inPlane = Math.sqrt(Math.max(0.05, 1 - lz * lz));
    const Lx = lx * inPlane, Ly = ly * inPlane, Lz = lz;
    const flatN = c.kind === 'cirrus' || c.kind === 'deck';
    const str = P.strength;
    const sr = P.shade[0], sg = P.shade[1], sb = P.shade[2];
    const lr = P.lit[0], lg = P.lit[1], lb = P.lit[2];
    const rr = P.rim[0], rg = P.rim[1], rb = P.rim[2];
    const hr = P.haze[0], hg = P.haze[1], hb = P.haze[2];
    const hk = P.hazeK, rimK = P.rimK;
    const under = Math.max(0, ly) * str; // light from below (low sun under the cloud)
    const isDeck = c.kind === 'deck';
    const cov = isDeck ? 0.2 + 0.55 * P.cover : 0;
    const spec = c.layer.spec;
    const ero = (1 - P.form) * (spec.depth || 2);
    const amax = (spec.alpha || 1) * 255;
    for (let i = 0; i < n; i++) {
      let d = den[i];
      const o = i << 2;
      if (isDeck) d = sstepFast(0.62 - cov, 0.92 - cov * 0.6, d);
      else d = d <= ero ? 0 : d >= ero + 1 ? 1 : ((d - ero) * (d - ero) * (3 - 2 * (d - ero)));
      if (d <= 0.004) {
        out[o + 3] = 0;
        continue;
      }
      const tu = TU[i] * 0.003921;
      const ts = isDeck ? tu : (T0[i] * (1 - ft) + T1[i] * ft) * 0.003921;
      let diff;
      if (flatN) {
        diff = 0.62 + 0.38 * ts;
      } else {
        const nx = NX[i] * 0.007874, ny = NY[i] * 0.007874;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lam = nx * Lx + ny * Ly + nz * Lz;
        diff = (lam + wrap) * wrapN; // wrapped lambert: soft terminators like real billows
        if (diff < 0) diff = 0;
        diff = diff * diff * (3 - 2 * diff);
      }
      const sh = ts <= 0.05 ? 0 : ts >= 0.72 ? 1 : ((ts - 0.05) / 0.67) * ((ts - 0.05) / 0.67) * (3 - 2 * ((ts - 0.05) / 0.67));
      const direct = diff * (0.14 + 0.86 * sh) * str;
      // sky light: billow faces turned up see the blue dome (keeps the relief readable in shadow);
      // deep undersides stay in the shade colour
      let up = 0.5;
      if (!flatN) up = 0.5 - 0.42 * NY[i] * 0.007874;
      const sky = (0.1 + 0.26 * up) * (0.45 + 0.55 * tu);
      const dark = 0.86 + 0.14 * tu;
      let r = (sr + (lr - sr) * sky) * dark, g = (sg + (lg - sg) * sky) * dark, b = (sb + (lb - sb) * sky) * dark;
      r += (lr - r) * direct;
      g += (lg - g) * direct;
      b += (lb - b) * direct;
      // bounce from below: low sun / sea light on the undersides
      if (under > 0.01) {
        const td = TD[i] * 0.003921;
        const u2 = under * (1 - tu) * td * 0.5;
        r += (lr - r) * u2;
        g += (lg - g) * u2;
        b += (lb - b) * u2;
      }
      // silver lining: thin, sun-facing edges glow
      const thin = 1 - d;
      const rim = rimK * thin * thin * (back + (1 - back) * ts);
      r += rr * rim;
      g += rg * rim;
      b += rb * rim;
      // aerial perspective
      r += (hr - r) * hk;
      g += (hg - g) * hk;
      b += (hb - b) * hk;
      if (debugView) {
        r = direct * 255;
        g = ts * 255;
        b = diff * 255;
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = d * amax;
    }
    c.ctx.putImageData(c.img, 0, 0);
    c.shaded = true;
    stats.shadePx += n;
    stats.shadeMs += performance.now() - t0;
  }

  // ── placement ──────────────────────────────────────────────────────────────────────────────────
  function spanOf(layer, F) {
    return F.W + layer.pad * 2;
  }
  function screenX(c, F) {
    const L = c.layer;
    const span = spanOf(L, F);
    return mod(c.u * span + L.drift - L.par * (F.camX - 960), span) - L.pad + F.sx;
  }

  let budgetPx = 70000;
  let debugView = 0;
  const queue = [];
  const prevDrv = { cirrus: -1, cumulus: -1, far: -1, stratus: -1, storm: -1, scud: -1, deck: -1 };
  const byPri = (a, b) => b.pri - a.pri;

  game.events.on('resize', () => {
    const s = Math.min(1.5, Math.max(1, game.view.scale));
    if (Math.abs(s - bakedScale) > 0.2) {
      bakedScale = s;
      for (const c of all) if (c.baked) c.stale = true;
      if (deck.baked) deck.stale = true;
    }
  });

  function update(dt, F) {
    updateDrivers();
    updateLight();
    const w = env.weather;
    // drift with the wind
    for (const L of layers) L.drift += w.wind * L.speed * dt * (L.id === 'scud' ? 1 + 0.6 * light.storm : 1);
    deck.drift += w.wind * 7 * dt;
    // visibility (instant weather jumps — URL/debug — snap instead of fading)
    stats.visible = 0;
    for (const L of layers) {
      const amt = drivers[L.drv];
      const snap = Math.abs(amt - prevDrv[L.drv]) > 0.12;
      for (const c of L.clouds) {
        const tgt = targetOf(c, amt);
        c.target = tgt;
        if (c.alpha < 0 || snap) c.alpha = tgt;
        else c.alpha += (tgt - c.alpha) * Math.min(1, dt * 0.5);
        if (c.alpha > 0.004 || tgt > 0) stats.visible++;
      }
    }
    for (const k in drivers) prevDrv[k] = drivers[k];
    deck.target = drivers.deck;
    deck.alpha = deck.target;
    if (!F) return;
    // shading queue: visible clouds whose light changed the most go first
    queue.length = 0;
    const fl = w.lightning;
    for (const L of layers) {
      for (const c of L.clouds) {
        if (c.alpha < 0.004 && c.target <= 0) continue;
        const x = screenX(c, F);
        const vis = x + c.w * F.k > -50 && x < F.W + 50;
        if (!vis && c.shaded && !c.stale) continue;
        c.cx = x + c.w * F.k * 0.5;
        c.cy = F.hy - (c.alt + c.h * 0.5) * F.k;
        const P = shadeParams(c, c.cx, c.cy, F, want);
        const ch = c.shaded ? keyChange(c.key, P) : 1000;
        if ((ch >= 1 && (fl < 0.01 || !c.shaded)) || c.stale) {
          c.pri = ch + (vis ? 5 : 0) + (c.stale ? 300 : 0);
          queue.push(c);
        }
      }
    }
    if (deck.alpha > 0.004) {
      deck.cx = F.W * 0.5;
      deck.cy = F.hy - 200 * F.k;
      const P = shadeParams(deck, deck.cx, deck.cy, F, want);
      const ch = deck.shaded ? keyChange(deck.key, P) : 1000;
      if (ch >= 1 || deck.stale) {
        deck.pri = ch + 4 + (deck.stale ? 300 : 0);
        queue.push(deck);
      }
    }
    queue.sort(byPri);
    let px = 0, bakes = 0;
    stats.shadePx = 0;
    stats.shadeMs = 0;
    for (const c of queue) {
      if (!c.baked || c.stale) {
        if (bakes > 0) continue; // at most one bake per frame
        bake(c);
        bakes++;
      }
      shade(c, shadeParams(c, c.cx, c.cy, F, c.key || (c.key = newKey())));
      px += c.bw * c.bh;
      if (px > budgetPx) break;
    }
  }

  // ── drawing ────────────────────────────────────────────────────────────────────────────────────
  function drawCloud(ctx, c, F, alphaMul) {
    if (!c.shaded) return;
    const f = c.alpha;
    const q = (f - 0.08) / 0.3; // barely-formed clouds stay invisible (no ghosts at steady state)
    const a = (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q)) * alphaMul;
    if (a < 0.004) return;
    const w = c.w * F.k, h = c.h * F.k;
    const x = screenX(c, F);
    if (x > F.W || x + w < 0) return;
    const y = F.hy - (c.alt + c.h) * F.k;
    if (y > F.hy || y + h < 0) return;
    ctx.globalAlpha = a > 1 ? 1 : a;
    if (c.flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(c.canvas, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(c.canvas, x, y, w, h);
  }

  let baseGrad = null;
  const baseKey = { top: [-1, -1, -1], hz: [-1, -1, -1], k: 0 };
  function drawDeck(ctx, F) {
    if (deck.alpha < 0.004 || !deck.shaded) return;
    const p = env.palette;
    // a solid base under the textured deck so heavy overcast is fully closed
    const solid = sstep(0.72, 1, env.weather.cloud);
    if (solid > 0.004) {
      const top = deck.key ? deck.key.shade : p.cloudShade;
      const hz = deck.key ? deck.key.haze : p.skyHorizon;
      // built around the horizon (local y 0) and placed with translate: rebuilt only when colours change
      if (!baseGrad || colorDelta(baseKey.top, top) > 1.5 || colorDelta(baseKey.hz, hz) > 1.5 || baseKey.k !== F.k) {
        copy3(baseKey.top, top);
        copy3(baseKey.hz, hz);
        baseKey.k = F.k;
        baseGrad = ctx.createLinearGradient(0, -420 * F.k, 0, 0);
        baseGrad.addColorStop(0, css(mix(top, [0, 0, 0], 0.12)));
        baseGrad.addColorStop(1, css(mix(top, hz, 0.55)));
      }
      ctx.save();
      ctx.translate(0, F.hy);
      ctx.globalAlpha = solid * 0.92;
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, -F.hy, F.W, F.hy + 2);
      ctx.restore();
    }
    const w = deck.w * F.k * 1.6, h = deck.h * F.k * 1.2;
    const y = F.hy - h - 14 * F.k;
    const x0 = mod(deck.drift - 0.02 * (F.camX - 960) + F.sx, w) - w;
    ctx.globalAlpha = Math.min(1, deck.alpha * 1.1);
    for (let x = x0; x < F.W; x += w) ctx.drawImage(deck.canvas, x, y, w + 0.5, h);
    // above the deck sprite (camera looking up), keep the sky closed
    if (y > 0 && solid > 0.004) {
      ctx.globalAlpha = deck.alpha;
      ctx.fillStyle = css(deck.key ? deck.key.shade : p.cloudShade);
      ctx.fillRect(0, 0, F.W, y + 1);
    }
  }

  const byId = {};
  for (const L of layers) byId[L.id] = L;
  function drawLayer(ctx, F, id) {
    const L = byId[id];
    if (!L) return;
    ctx.save();
    for (const c of L.clouds) drawCloud(ctx, c, F, 1);
    ctx.restore();
  }

  /** Lightning lights the storm clouds from within: re-add the storm clouds brightly near the bolt. */
  function drawFlash(ctx, F, fl, bx) {
    if (fl < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gy = F.hy - 300 * F.k, gr = 620 * F.k;
    const g = ctx.createRadialGradient(bx, gy, 0, bx, gy, gr);
    g.addColorStop(0, `rgba(190,200,255,${(0.42 * fl).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(150,165,230,${(0.16 * fl).toFixed(3)})`);
    g.addColorStop(1, 'rgba(120,140,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - gr, Math.max(0, gy - gr), gr * 2, Math.min(F.hy, gy + gr) - Math.max(0, gy - gr));
    for (const L of layers) {
      if (L.id !== 'tower' && L.id !== 'scud' && L.id !== 'mid' && L.id !== 'near') continue;
      for (const c of L.clouds) {
        if (!c.shaded || c.alpha < 0.05) continue;
        const x = screenX(c, F);
        const cx = x + c.w * F.k * 0.5;
        const near = 1 - Math.min(1, Math.abs(cx - bx) / (F.W * 0.6));
        drawCloud(ctx, c, F, fl * (0.25 + 0.75 * near) * 1.2);
      }
    }
    if (deck.shaded && deck.alpha > 0.05) {
      ctx.globalAlpha = Math.min(1, fl * 1.1 * deck.alpha);
      const w = deck.w * F.k * 1.6, h = deck.h * F.k * 1.2;
      const y = F.hy - h - 14 * F.k;
      const x0 = mod(deck.drift - 0.02 * (F.camX - 960) + F.sx, w) - w;
      for (let x = x0; x < F.W; x += w) ctx.drawImage(deck.canvas, x, y, w + 0.5, h);
    }
    ctx.restore();
  }

  /** Bake everything the current weather needs right now (used once at start so the first frame is complete). */
  function warm(F) {
    updateDrivers();
    updateLight();
    for (const L of layers) for (const c of L.clouds) {
      const tgt = targetOf(c, drivers[L.drv]);
      c.alpha = tgt;
      if (tgt > 0) {
        bake(c);
        const x = screenX(c, F);
        shade(c, shadeParams(c, x + c.w * F.k * 0.5, F.hy - (c.alt + c.h * 0.5) * F.k, F, c.key || (c.key = newKey())));
      }
    }
    if (drivers.deck > 0) {
      bake(deck);
      shade(deck, shadeParams(deck, F.W * 0.5, F.hy - 200 * F.k, F, deck.key || (deck.key = newKey())));
    }
  }

  return {
    update, warm, drawDeck, drawFlash, drawLayer, stats, layers, deck, drivers,
    setBudget: (px) => { budgetPx = px; },
    /** Dev: 1 = show the lighting channels (r = direct sun, g = transmittance, b = billow lambert). */
    setDebug(v) {
      debugView = v;
      for (const c of all) c.key = null; // forces a re-shade
    },
  };
}

/** How formed a cloud should be (0..1) for its family's weather driver. */
function targetOf(c, amt) {
  return amt < 0.002 ? 0 : sstep(c.thr - 0.035, c.thr + 0.035, amt);
}

function sstepFast(a, b, v) {
  const t = (v - a) / (b - a);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}
