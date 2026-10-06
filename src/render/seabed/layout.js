// Deterministic placement of every decoration item in the world (same every session: fixed seeds only).
// Items: { t, v, x, y, s, f (±1 flip), ph (anim phase), layer (0 back · 1 mid · 2 low/near · 3 front pass), z,
//          x0, x1, y0, y1 (world bounds) }  — indexed into 512-px columns for culling.
import { heightAt, slopeAt } from '../../world/terrain.js';
import { createRng } from '../../core/rng.js';
import { TYPES } from './deco.js';

export const COL = 512;
const LAYOUTS = [];
/** Register a biome layout: fn(rng, add) — add(id, x, {v, s, f, layer, dy, sink}) places one item. */
export function defLayout(seed, fn) {
  LAYOUTS.push({ seed, fn });
}

export function buildLayout() {
  const items = [];
  for (const L of LAYOUTS) {
    const rng = createRng(L.seed);
    const add = (id, x, o = {}) => {
      const t = TYPES.get(id);
      if (!t) return null;
      const v = o.v !== undefined ? o.v % t.variants : rng.int(0, t.variants - 1);
      const s = o.s !== undefined ? o.s : 1;
      const f = o.f !== undefined ? o.f : rng.chance(0.5) ? 1 : -1;
      const half = (t.foot !== undefined ? t.foot : (t.box.x1 - t.box.x0) * 0.3) * s;
      // sink the base on slopes so no corner floats; dy lifts/sinks extra (e.g. sitting on a rock)
      const sink = o.sink !== undefined ? o.sink : Math.min(half * Math.abs(slopeAt(x)) * 0.9, half * 1.2) + 2;
      const y = (o.y !== undefined ? o.y : heightAt(x)) + sink + (o.dy || 0);
      const it = { t, v, x, y, s, f, ph: rng.range(0, 6.283), layer: o.layer !== undefined ? o.layer : 1, z: rng.next(), data: o.data || null };
      const bx0 = f > 0 ? t.box.x0 : -t.box.x1, bx1 = f > 0 ? t.box.x1 : -t.box.x0;
      const swayPad = t.sway ? t.sway.amp * 2.5 * s : 0;
      it.x0 = x + bx0 * s - swayPad;
      it.x1 = x + bx1 * s + swayPad;
      it.y0 = y + t.box.y0 * s;
      it.y1 = y + t.box.y1 * s;
      items.push(it);
      return it;
    };
    L.fn(rng, add);
  }
  const cols = new Map();
  for (const it of items) {
    const c0 = Math.floor(it.x0 / COL), c1 = Math.floor(it.x1 / COL);
    for (let c = c0; c <= c1; c++) {
      let list = cols.get(c);
      if (!list) cols.set(c, (list = []));
      list.push(it);
    }
  }
  for (const list of cols.values()) list.sort((a, b) => a.layer - b.layer || a.z - b.z);
  return { items, cols };
}

// ── shared helpers for layouts ──────────────────────────────────────────────────────────────────────
/** Weighted pick from [[value, weight], …]. */
export function pickW(rng, table) {
  let tot = 0;
  for (const e of table) tot += e[1];
  let r = rng.next() * tot;
  for (const e of table) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return table[table.length - 1][0];
}
