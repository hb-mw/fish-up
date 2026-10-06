// LIFE — habitat: where each species may live right now (biome, depth band, layer), and how dense life is.
import { biomeAt, WORLD } from '../../core/config.js';
import { heightAt } from '../../world/terrain.js';

const PX = WORLD.pxPerM;

/** Individuals per 1e6 px² of water, by biome (sunlit water). Calibrated with dev/life-census.mjs. */
export const BIOME_DENSITY = { shore: 0, reef: 25, kelp: 18, slope: 11.5, open: 6.5, trench: 6 };

/** Biomes a species tolerates at x (with a little overlap at the borders so populations blend). */
export function biomeOK(prof, x, tol = 140) {
  const bs = prof.sp.biomes;
  if (bs.includes(biomeAt(x).id)) return true;
  if (tol > 0) return bs.includes(biomeAt(x - tol).id) || bs.includes(biomeAt(x + tol).id);
  return false;
}

/** Depth band (px) right now: day band blended toward nightDepthM by nightF (0..1). Writes out.top/out.bot. */
export function bandOf(sp, nightF, out) {
  const d = sp.depthM, n = sp.nightDepthM;
  let a = d[0], b = d[1];
  if (n && nightF > 0) {
    a += (n[0] - a) * nightF;
    b += (n[1] - b) * nightF;
  }
  out.top = a * PX;
  out.bot = b * PX;
  return out;
}

/**
 * Vertical interval (px, body-centre y) where an individual of length `len` may be at column x right now.
 * Returns false when the species cannot live in this column (e.g. seabed outside a bottom-dweller's band).
 */
export function zoneFor(prof, len, seabed, nightF, out) {
  const sp = prof.sp;
  bandOf(sp, nightF, out);
  const up = prof.up * len, down = prof.down * len;
  const layer = sp.layer;
  if (layer === 'surface') {
    const s = prof.surf || [12, 120];
    const top = Math.max(out.top, s[0] + up), bot = Math.min(Math.max(out.bot, s[0] + up + 8), s[1] + up);
    out.top = top;
    out.bot = Math.min(bot, seabed - down - 24);
  } else if (layer === 'pelagic') {
    out.top = Math.max(out.top, up + 10);
    out.bot = Math.min(out.bot, seabed - down - 34);
  } else {
    // demersal / benthic: the seabed itself must lie inside the band (±10 m)
    const tol = 10 * PX;
    if (seabed < out.top - tol || seabed > out.bot + tol) return false;
    if (prof.arch === 'crawl' || prof.arch === 'item') {
      out.top = out.bot = seabed - down;
    } else {
      const h = prof.hover || (layer === 'benthic' ? [0, 8] : [10, 60]);
      out.top = seabed - down - h[1];
      out.bot = seabed - down - h[0];
    }
    if (out.top < up + 6) out.top = up + 6;
  }
  return out.bot >= out.top - 0.5;
}

/** Density of life at a point (individuals / 1e6 px²). */
export function densityAt(x, y, seabed, nightF) {
  let d = BIOME_DENSITY[biomeAt(x).id] || 0;
  if (d === 0) return 0;
  if (y > 1500) d *= y < 3600 ? 0.5 - 0.14 * ((y - 1500) / 2100) : y < 5600 ? 0.3 : 0.26;
  // the deep sea concentrates its life near the seabed, and even more around the hydrothermal vents
  if (y > 1100 && seabed - y < 300) {
    d *= 1.6;
    if (x > 10700 && (Math.abs(x - 11080) < 380 || Math.abs(x - 11330) < 380 || Math.abs(x - 11560) < 380)) d *= 1.8;
  }
  // the shallows thin out a little at night (reef fish hide in the coral)
  if (y < 900 && nightF > 0) d *= 1 - 0.25 * nightF;
  return d;
}

/** Integrate density over the water inside a rect → target number of animals. */
export function targetFor(r, nightF) {
  const w = r.r - r.l;
  if (w <= 0) return 0;
  const cols = Math.max(4, Math.min(48, Math.ceil(w / 160)));
  const dx = w / cols;
  let sum = 0;
  for (let i = 0; i < cols; i++) {
    const x = r.l + (i + 0.5) * dx;
    if (x < 0 || x > WORLD.width) continue;
    const sb = heightAt(x);
    const top = Math.max(r.t, 0), bot = Math.min(r.b, sb);
    if (bot <= top) continue;
    const rows = Math.max(1, Math.ceil((bot - top) / 220));
    const dy = (bot - top) / rows;
    for (let j = 0; j < rows; j++) sum += densityAt(x, top + (j + 0.5) * dy, sb, nightF) * dx * dy;
  }
  return sum / 1e6;
}

/** Animal profiles grouped by biome id (items excluded) — the spawn pools. */
export function buildPools(profiles) {
  const pools = { shore: [], reef: [], kelp: [], slope: [], open: [], trench: [] };
  for (const id in profiles) {
    const p = profiles[id];
    if (p.arch === 'item') continue;
    for (const b of p.sp.biomes) if (pools[b]) pools[b].push(p);
  }
  return pools;
}

/** Spawn-weight damping by level, on top of the species' own abundance (rare must really be rare). */
export function rarityK(level) {
  return level <= 5 ? 1 : Math.pow(0.84, level - 5);
}
