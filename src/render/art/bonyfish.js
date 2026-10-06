// Bony fish — the 20 classic fish of Fish Up, painted and animated procedurally.
//   bony/kit.js   paint-time toolkit (profiles, UV skin painter, fins, scales)
//   bony/rig.js   per-frame rig (sheared swim strips, animated parts, hinged jaw, per-individual easing)
//   bony/<species>.js   one definition per species → fishDrawer(def), or a hand-rolled { draw, bounds, mouth }
import { fishDrawer } from './bony/rig.js';

// Each file exports `def` (a fishDrawer definition or a complete drawer). Files are loaded one by one so a
// species that is still being painted can never take the rest of the set down with it.
const FILES = [
  'snapper', 'clownfish', 'blue_tang', 'moorish_idol', 'garibaldi', 'parrotfish',
  'pufferfish', 'lionfish', 'grouper', 'flying_fish', 'sardine',
  'mackerel', 'mahi', 'barracuda', 'yellowfin', 'bluefin',
  'sunfish', 'sailfish', 'swordfish', 'marlin',
];

/** @type {Record<string, {draw: Function, bounds: object, mouth: object}>} */
export const DRAWERS = {};
await Promise.all(
  FILES.map(async (name) => {
    try {
      const mod = await import(`./bony/${name}.js`);
      const defs = mod.DEFS || (mod.def ? [mod.def] : []);
      for (const def of defs) DRAWERS[def.id] = def.draw ? def : fishDrawer(def);
    } catch (e) {
      console.warn(`[bony] ${name}.js not ready:`, e && e.message);
    }
  }),
);
