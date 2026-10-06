// SHARKS art set: sharks, rays, eels and deep-sea fish (17 species).
//   export const DRAWERS = { [speciesId]: { draw, drawGlow?, bounds, mouth } }   (contract: src/render/bestiary.js)
// Each drawer paints its animal once per size bucket into cached unit-space sprites and blits them per frame
// (swim strips / spine strips / wing strips) with a few separately cached moving parts on top.
import { great_white } from './sharks/sharkspecies.js';
import { megalodon } from './sharks/megalodon.js';
import { leopard_shark, blacktip_reef_shark, mako_shark } from './sharks/reefsharks.js';
import { hammerhead, goblin_shark } from './sharks/oddsharks.js';
import { whale_shark } from './sharks/whaleshark.js';

const SOURCES = {
  great_white, megalodon, leopard_shark, blacktip_reef_shark, mako_shark, hammerhead, goblin_shark, whale_shark,
};

// Rays, eels and deep-sea fish live in their own files, each exporting `DRAWERS`. They are loaded in isolation
// (top-level await) so a broken file costs only its own animals, never the whole set.
const PARTS = ['./sharks/rays.js', './sharks/eels.js', './sharks/deepfish.js'];
const parts = await Promise.all(
  PARTS.map((p) =>
    import(p).then(
      (m) => m.DRAWERS || {},
      (e) => {
        console.error(`[sharks] could not load ${p}:`, e);
        return {};
      },
    ),
  ),
);
for (const part of parts) Object.assign(SOURCES, part);

// One misbehaving drawer must never take the rest of the frame down (the renderer draws every fish inside a
// single try): each draw / drawGlow is isolated, logged once, and leaves the ctx state balanced.
const errored = new Set();
function guard(id, d) {
  const wrap = (fn, name) =>
    function guarded(ctx, len, anim, opts) {
      ctx.save();
      try {
        fn.call(d, ctx, len, anim, opts);
      } catch (e) {
        if (!errored.has(id + name)) {
          errored.add(id + name);
          console.error(`[sharks] ${id}.${name} failed:`, e);
        }
      }
      ctx.restore();
    };
  const out = { bounds: d.bounds, mouth: d.mouth, draw: wrap(d.draw, 'draw') };
  if (d.drawGlow) out.drawGlow = wrap(d.drawGlow, 'drawGlow');
  if (d.iconBounds) out.iconBounds = d.iconBounds;
  if (typeof d.mouthAt === 'function') {
    out.mouthAt = (a) => {
      try {
        return d.mouthAt(a);
      } catch (e) {
        if (!errored.has(id + 'mouthAt')) {
          errored.add(id + 'mouthAt');
          console.error(`[sharks] ${id}.mouthAt failed:`, e);
        }
        return null; // the registry falls back to the static mouth anchor
      }
    };
  }
  return out;
}

/** @type {Record<string, {draw:Function, drawGlow?:Function, bounds:object, mouth:object}>} */
export const DRAWERS = {};
for (const id in SOURCES) if (SOURCES[id]) DRAWERS[id] = guard(id, SOURCES[id]);
