// WATER — the sea itself: the far-sea band, the water column, the surface film and the depth fog.
// Owner: WATER ARTIST. All four passes are called in WORLD space (camera transform applied).
//
//   renderFarSea  (after the sky)          open sea seen from above between the horizon and the cut line
//   renderBody    (opaque)                 water column: colour field, water masses, far life, god rays
//   renderSurface (after boat + fish)      translucent film, crest highlight, foam, glints, rain, spray
//   renderOverlay (after effects)          depth fog toward the water colour + marine snow + plankton
//
// The surface line is game.world.waves.heightAt(x) — sampled once per frame in core.js and shared by
// every pass so they all meet on the same line.
import { createWaterCore } from './water/core.js';
import { createFarSea } from './water/farsea.js';
import { createBody } from './water/body.js';
import { createSurface } from './water/surface.js';
import { createOverlay } from './water/overlay.js';

/**
 * @param {object} game
 * @returns {{update(dt:number):void, renderFarSea(ctx:CanvasRenderingContext2D):void,
 *   renderBody(ctx:CanvasRenderingContext2D):void, renderSurface(ctx:CanvasRenderingContext2D):void,
 *   renderOverlay(ctx:CanvasRenderingContext2D):void, debug:object}}
 */
export function createWater(game) {
  const core = createWaterCore(game);
  const far = createFarSea(game, core);
  const body = createBody(game, core);
  const surface = createSurface(game, core);
  const overlay = createOverlay(game, core);

  return {
    update(dt) {
      core.update(dt);
      far.update(dt);
      body.update(dt);
      surface.update(dt);
      overlay.update(dt);
    },
    renderFarSea(ctx) {
      core.prepare();
      if (!core.off.farsea) far.render(ctx);
    },
    renderBody(ctx) {
      core.prepare();
      body.render(ctx);
    },
    renderSurface(ctx) {
      core.prepare();
      if (!core.off.surface) surface.render(ctx);
    },
    renderOverlay(ctx) {
      core.prepare();
      overlay.render(ctx);
    },
    /** Dev hooks (screenshots / tuning): __game.mods.water.debug */
    debug: { core, far, body, surface, overlay },
  };
}
