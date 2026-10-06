// CREATURE ART — the non-fish animals and catchable items: cephalopods, jellies, crustaceans, the turtle, the
// seahorse, and the junk / treasure items. Each group lives in ./creatures/*.js and exports its own DRAWERS;
// groups are loaded independently so one broken file can never take the others down.
//
//   export const DRAWERS = { [speciesId]: { draw, drawGlow?, bounds, mouth } }   (contract: ../bestiary.js)
const GROUPS = [
  './creatures/jellies.js',
  './creatures/crustaceans.js',
  './creatures/octopus.js',
  './creatures/nautilus.js',
  './creatures/dumbo.js',
  './creatures/vampire.js',
  './creatures/humboldt.js',
  './creatures/giantsquid.js',
  './creatures/turtle.js',
  './creatures/seahorse.js',
  './creatures/junk.js',
  './creatures/treasure.js',
];

/** @type {Record<string, {draw: Function, drawGlow?: Function, bounds?: object, mouth?: object}>} */
export const DRAWERS = {};

const loaded = await Promise.all(
  GROUPS.map((p) =>
    import(p).catch((e) => {
      console.error(`[creatures] could not load ${p}:`, e);
      return null;
    }),
  ),
);
for (const mod of loaded) if (mod && mod.DRAWERS) Object.assign(DRAWERS, mod.DRAWERS);
