// SKY & WEATHER — everything above the horizon (SCREEN space), plus the weather layer in front of the scene.
//
//   render(ctx)         sky dome → stars/Milky Way → moon/sun → cloud layers (far→near) with the far scenery,
//                       horizon haze, lightning and birds woven in by depth.
//   renderWeather(ctx)  rain / fog / lightning flash / storm mood, clipped to above the waterline.
//
// Sky objects live in "sky space": an altitude `a` in px above the horizon maps to screen y = hy − a·k, where
// hy = camera.screenY(WORLD.horizonY) and k = zoom^0.3 (the sky is far away: it scales a little with zoom,
// not fully). Horizontal parallax against camera.x is tiny for the far layers. render() returns at once when
// the horizon is above the top of the screen, renderWeather() when the waterline is (camera under water).
// Everything is driven by the SMOOTHED env.weather values, so weather changes never pop.
//
// Preview flags (read from the URL): &aurora=1 (force an aurora) · &rainbow=1 (force a rainbow when the sun is
// out) · &shooting=1 (frequent shooting stars). Dev hooks on game.mods.sky: debug.flash(x01, power) (lightning
// now) · debug.shoot() · clouds.setDebug(1) (show cloud lighting channels) · stats {updateMs, clouds{…}}.
import { WORLD } from '../core/config.js';
import { createSkyGradient } from './sky/gradient.js';
import { createSunMoon } from './sky/sunmoon.js';
import { createStars } from './sky/stars.js';
import { createClouds } from './sky/clouds.js';
import { createLightning } from './sky/lightning.js';
import { createWeatherFx } from './sky/weatherfx.js';
import { createScenery } from './sky/scenery.js';
import { createBirds } from './sky/birds.js';
import { createExtras } from './sky/extras.js';

/** Sky px between the horizon and the sun at elevation 1 (keeps the noon sun on screen at the default framing). */
export const SUN_ARC = 275;

/**
 * @param {object} game
 * @returns {{update(dt:number):void, render(ctx:CanvasRenderingContext2D):void, renderWeather(ctx:CanvasRenderingContext2D):void}}
 */
export function createSky(game) {
  const env = game.env;
  const F = {
    W: 1920, H: 1080, hy: 390, wy: 454, k: 1, sx: 0, camX: 0, zoom: 1,
    sunX: 0, sunY: 0, sunAlt: 0, moonX: 0, moonY: 0, moonAlt: 0,
  };

  function computeFrame() {
    const cam = game.camera, v = game.view;
    F.W = v.w;
    F.H = v.h;
    F.hy = cam.screenY(WORLD.horizonY);
    F.wy = cam.screenY(0);
    F.zoom = cam.zoom;
    F.k = Math.pow(cam.zoom, 0.3);
    F.sx = cam.shakeX;
    F.camX = cam.x;
    F.sunAlt = env.sun.elev * SUN_ARC;
    F.sunX = env.sun.x * F.W + F.sx;
    F.sunY = F.hy - F.sunAlt * F.k;
    F.moonAlt = env.moon.elev * SUN_ARC * 0.96;
    F.moonX = env.moon.x * F.W + F.sx;
    F.moonY = F.hy - F.moonAlt * F.k;
    return F;
  }

  const grad = createSkyGradient(game);
  const sunmoon = createSunMoon(game);
  const stars = createStars(game);
  const clouds = createClouds(game);
  const lightning = createLightning(game);
  const weather = createWeatherFx(game);
  const scenery = createScenery(game);
  const birds = createBirds(game);
  const extras = createExtras(game);
  const stats = { updateMs: 0, clouds: clouds.stats };

  computeFrame();
  try {
    clouds.warm(F);
  } catch (e) {
    game.reportError('sky.warm', e);
  }

  function update(dt) {
    const t0 = performance.now();
    computeFrame();
    clouds.update(dt, F);
    stars.update(dt);
    lightning.update(dt);
    weather.update(dt);
    birds.update(dt);
    extras.update(dt);
    stats.updateMs = stats.updateMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  function render(ctx) {
    computeFrame();
    if (F.hy <= 0) return; // looking at the sea from below the horizon line: no sky on screen
    grad.drawBase(ctx, F);
    grad.drawBelt(ctx, F);
    grad.drawScatter(ctx, F);
    stars.draw(ctx, F);
    extras.drawAurora(ctx, F);
    sunmoon.drawMoon(ctx, F);
    sunmoon.drawSun(ctx, F);
    clouds.drawLayer(ctx, F, 'cirrus');
    clouds.drawDeck(ctx, F);
    clouds.drawLayer(ctx, F, 'tower');
    clouds.drawLayer(ctx, F, 'far');
    clouds.drawLayer(ctx, F, 'stratus');
    scenery.draw(ctx, F);
    grad.drawHorizonHaze(ctx, F);
    extras.drawRainbow(ctx, F);
    lightning.draw(ctx, F);
    clouds.drawLayer(ctx, F, 'mid');
    clouds.drawLayer(ctx, F, 'near');
    clouds.drawLayer(ctx, F, 'scud');
    const fl = env.weather.lightning;
    if (fl > 0.02) {
      const bx = lightning.lastX(F);
      clouds.drawFlash(ctx, F, fl, bx === null ? F.W * 0.5 : bx);
    }
    sunmoon.drawSunBloom(ctx, F);
    birds.draw(ctx, F);
  }

  function renderWeather(ctx) {
    computeFrame();
    if (F.wy <= 0) return; // camera under water: no weather on screen
    weather.draw(ctx, F);
  }

  const debug = {
    flash(x = 0.4, power = 1) {
      env.weather.lightning = power;
      game.events.emit('lightning', { x, power });
    },
    shoot: () => stars.shoot(),
  };

  return { update, render, renderWeather, frame: F, stats, debug, clouds };
}
