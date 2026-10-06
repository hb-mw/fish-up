// The frame pipeline. KERNEL FILE.
// Calls every art module in a fixed order, with the right transform, isolating errors and timing each layer.
// When a module is missing, a plain placeholder is drawn instead so the game always runs.
import { WORLD } from '../core/config.js';
import { rgbToCss, TAU } from '../core/math.js';
import { drawFish, drawFishGlow, getDrawer } from './bestiary.js';

export function createRenderer(game) {
  const prof = {};
  const order = [];
  const sorted = [];

  function layer(name, fn) {
    const t0 = performance.now();
    const ctx = game.ctx;
    ctx.save();
    try {
      fn(ctx);
    } catch (e) {
      game.reportError('render:' + name, e);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    const ms = performance.now() - t0;
    if (prof[name] === undefined) {
      prof[name] = ms;
      order.push(name);
    } else prof[name] = prof[name] * 0.93 + ms * 0.07;
  }
  const world = (ctx) => game.camera.apply(ctx);
  const screen = (ctx) => game.camera.applyScreen(ctx);
  const has = (mod, fn) => mod && typeof mod[fn] === 'function' && !mod.__disabled?.[fn];

  // ── placeholders ───────────────────────────────────────────────────────────
  function fallbackSky(ctx) {
    const v = game.view, p = game.env.palette;
    const hy = game.camera.screenY(WORLD.horizonY);
    const g = ctx.createLinearGradient(0, Math.min(0, hy - 900), 0, Math.max(1, hy));
    g.addColorStop(0, rgbToCss(p.skyTop));
    g.addColorStop(0.6, rgbToCss(p.skyMid));
    g.addColorStop(1, rgbToCss(p.skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
    const sun = game.env.sun;
    if (sun.elev > -0.05) {
      ctx.fillStyle = rgbToCss(p.sun);
      ctx.beginPath();
      ctx.arc(sun.x * v.w, hy - sun.elev * 520, 46, 0, TAU);
      ctx.fill();
    }
  }
  function fallbackFarSea(ctx) {
    const b = game.camera.bounds;
    ctx.fillStyle = rgbToCss(game.env.palette.waterTop);
    ctx.fillRect(b.left, WORLD.horizonY, b.w, 80 - WORLD.horizonY);
  }
  function waterGradient(ctx, alphaFn) {
    // vertical gradient in WORLD space covering the visible water column
    const b = game.camera.bounds;
    const top = Math.max(-40, b.top), bottom = Math.max(top + 1, b.bottom);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    const n = 8;
    const cx = (b.left + b.right) / 2;
    for (let i = 0; i <= n; i++) {
      const y = top + ((bottom - top) * i) / n;
      g.addColorStop(i / n, rgbToCss(game.env.waterColorAt(y, cx), alphaFn ? alphaFn(y) : 1));
    }
    return g;
  }
  function surfacePath(ctx, bottomY) {
    const b = game.camera.bounds, waves = game.world.waves;
    ctx.beginPath();
    ctx.moveTo(b.left - 20, bottomY);
    for (let x = b.left - 20; x <= b.right + 20; x += 12) ctx.lineTo(x, waves.heightAt(x));
    ctx.lineTo(b.right + 20, bottomY);
    ctx.closePath();
  }
  function fallbackWaterBody(ctx) {
    const b = game.camera.bounds;
    if (b.bottom < -40) return;
    ctx.fillStyle = waterGradient(ctx);
    surfacePath(ctx, b.bottom + 10);
    ctx.fill();
  }
  function fallbackSeabed(ctx) {
    const b = game.camera.bounds, terr = game.world.terrain;
    ctx.beginPath();
    ctx.moveTo(b.left - 20, b.bottom + 20);
    for (let x = b.left - 20; x <= b.right + 20; x += 10) ctx.lineTo(x, terr.heightAt(x));
    ctx.lineTo(b.right + 20, b.bottom + 20);
    ctx.closePath();
    const mid = (b.top + b.bottom) / 2;
    const l = 0.25 + 0.75 * game.env.lightAt(mid);
    ctx.fillStyle = rgbToCss([196 * l, 170 * l, 120 * l]);
    ctx.fill();
  }
  function fallbackBoat(ctx) {
    const boat = game.boat;
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.tilt);
    ctx.scale(boat.facing, 1);
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath();
    ctx.moveTo(-190, -34);
    ctx.lineTo(200, -40);
    ctx.lineTo(150, 22);
    ctx.lineTo(-160, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.fillRect(60, -150, 26, 112); // "angler"
    ctx.restore();
    const pts = boat.rod.pts;
    if (pts.length > 1) {
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
  function fallbackLine(ctx) {
    const f = game.fishing, pts = f.line.points;
    if (pts.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    if (f.lure.visible) {
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(f.lure.x, f.lure.y, 7, 0, TAU);
      ctx.fill();
    }
  }
  function fallbackFog(ctx) {
    // tint everything toward the water colour with depth (matches fallbackWaterBody's gradient)
    const b = game.camera.bounds;
    if (b.bottom < 0) return;
    ctx.fillStyle = waterGradient(ctx, (y) => Math.min(0.62, 0.1 + 0.5 * (1 - game.env.lightAt(Math.max(0, y)))));
    surfacePath(ctx, b.bottom + 10);
    ctx.fill();
  }

  // ── fish ───────────────────────────────────────────────────────────────────
  function fishList() {
    const list = (game.fish && game.fish.list) || [];
    sorted.length = 0;
    const hooked = game.fishing.hooked;
    for (let i = 0; i < list.length; i++) if (list[i] !== hooked) sorted.push(list[i]);
    sorted.sort((a, b) => b.visualLen - a.visualLen); // big ones behind, small ones in front
    return sorted;
  }

  function render() {
    const mods = game.mods;
    const f = game.fishing;
    const ctx0 = game.ctx;
    ctx0.setTransform(1, 0, 0, 1, 0, 0);
    ctx0.globalAlpha = 1;
    ctx0.globalCompositeOperation = 'source-over';

    // 1 ─ sky (SCREEN space)
    layer('sky', (ctx) => {
      screen(ctx);
      if (has(mods.sky, 'render')) mods.sky.render(ctx);
      else fallbackSky(ctx);
    });
    // 2 ─ far sea band between the horizon and the cut plane (WORLD space)
    layer('farSea', (ctx) => {
      world(ctx);
      if (has(mods.water, 'renderFarSea')) mods.water.renderFarSea(ctx);
      else fallbackFarSea(ctx);
    });
    // 3 ─ water body: opaque depth gradient, god rays, far silhouettes (WORLD space)
    layer('waterBody', (ctx) => {
      world(ctx);
      if (has(mods.water, 'renderBody')) mods.water.renderBody(ctx);
      else fallbackWaterBody(ctx);
    });
    // 4 ─ seabed behind the action: far parallax ridges, terrain, background decoration (WORLD space)
    layer('seabedBack', (ctx) => {
      world(ctx);
      if (has(mods.seabed, 'renderBack')) mods.seabed.renderBack(ctx);
      else fallbackSeabed(ctx);
    });
    // 5 ─ fish & creatures
    layer('fish', (ctx) => {
      world(ctx);
      const list = fishList();
      for (let i = 0; i < list.length; i++) drawFish(ctx, list[i], game);
    });
    // 6 ─ boat, angler, rod, then line + lure
    layer('boat', (ctx) => {
      world(ctx);
      if (has(mods.boatArt, 'renderBoat')) mods.boatArt.renderBoat(ctx);
      else fallbackBoat(ctx);
    });
    layer('line', (ctx) => {
      world(ctx);
      if (has(mods.boatArt, 'renderLine')) {
        mods.boatArt.renderLine(ctx);
        if (has(mods.boatArt, 'renderLure')) mods.boatArt.renderLure(ctx);
      } else fallbackLine(ctx);
    });
    // 7 ─ the hooked fish goes on top of the line
    layer('hooked', (ctx) => {
      if (f.hooked) {
        world(ctx);
        drawFish(ctx, f.hooked, game);
      }
    });
    // 8 ─ seabed foreground: fronds / coral that pass in FRONT of fish (WORLD space)
    layer('seabedFront', (ctx) => {
      if (has(mods.seabed, 'renderFront')) {
        world(ctx);
        mods.seabed.renderFront(ctx);
      }
    });
    // 9 ─ water surface film over the hull/fish near the surface: crest highlights, foam (WORLD space)
    layer('surface', (ctx) => {
      if (has(mods.water, 'renderSurface')) {
        world(ctx);
        mods.water.renderSurface(ctx);
      }
    });
    // 10 ─ world particles: splashes, bubbles, ripples, ink (WORLD space)
    layer('effects', (ctx) => {
      if (has(mods.effects, 'renderWorld')) {
        world(ctx);
        mods.effects.renderWorld(ctx);
      }
    });
    // 11 ─ depth fog / darkness + marine snow (WORLD space) — fades everything toward the water colour
    layer('fog', (ctx) => {
      world(ctx);
      if (has(mods.water, 'renderOverlay')) mods.water.renderOverlay(ctx);
      else fallbackFog(ctx);
    });
    // 12 ─ additive light pass: bioluminescence, lamp cone, lure glow, sparkles (WORLD space, 'lighter')
    layer('glow', (ctx) => {
      world(ctx);
      ctx.globalCompositeOperation = 'lighter';
      if (has(mods.seabed, 'renderGlow')) mods.seabed.renderGlow(ctx);
      const list = (game.fish && game.fish.list) || [];
      for (let i = 0; i < list.length; i++) {
        const fi = list[i];
        if (fi.species.glow || fi.shiny || getDrawer(fi.speciesId).drawGlow) drawFishGlow(ctx, fi, game);
      }
      if (has(mods.boatArt, 'renderGlow')) mods.boatArt.renderGlow(ctx);
      if (has(mods.effects, 'renderGlow')) mods.effects.renderGlow(ctx);
    });
    // 13 ─ weather in front of everything: rain, lightning flash, fog banks (SCREEN space)
    layer('weather', (ctx) => {
      if (has(mods.sky, 'renderWeather')) {
        screen(ctx);
        mods.sky.renderWeather(ctx);
      }
    });
  }

  /** The transparent overlay canvas (crisp, never post-processed): floating texts, world-anchored HUD. SCREEN space. */
  function renderOverlay() {
    const o = game.octx, mods = game.mods, v = game.view;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, game.overlayCanvas.width, game.overlayCanvas.height);
    o.setTransform(v.scale, 0, 0, v.scale, 0, 0);
    for (const [mod, fn] of [[mods.effects, 'renderScreen'], [mods.ui, 'renderOverlay']]) {
      if (has(mod, fn)) {
        o.save();
        try {
          mod[fn](o);
        } catch (e) {
          game.reportError('overlay:' + fn, e);
        }
        o.restore();
        o.globalAlpha = 1;
        o.globalCompositeOperation = 'source-over';
      }
    }
  }

  return { render, renderOverlay, prof, order };
}
