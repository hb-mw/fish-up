// SEABED & SET-DRESSING — the terrain of the whole world, from the home island to the trench vents.
//   renderBack  (WORLD): parallax ridges → baked ground tiles → decoration behind the fish
//   renderFront (WORLD): sparse foreground decoration the fish pass behind
//   renderGlow  (WORLD, additive): everything self-luminous
import { createTiles } from './seabed/tiles.js';
import { createRidges } from './seabed/ridges.js';
import { createIsland } from './seabed/island.js';
import { createVentFx } from './seabed/ventfx.js';
import { createCaustics } from './seabed/caustics.js';
import { CHEST_GLINTS } from './seabed/wreckprops.js';
import { buildLayout, COL } from './seabed/layout.js';
import { sprite, stamp, stampSway, pumpSprites, spriteStats, want, glowSprite as glowSpriteFn } from './seabed/deco.js';
import './seabed/catalog.js';
import { heightAt } from '../world/terrain.js';
import { css } from './seabed/util.js';

/**
 * @param {object} game
 * @returns {{update(dt:number):void, renderBack(ctx:CanvasRenderingContext2D):void, renderFront(ctx:CanvasRenderingContext2D):void, renderGlow(ctx:CanvasRenderingContext2D):void, stats():object}}
 */
export function createSeabed(game) {
  const tiles = createTiles(game);
  const ridges = createRidges(game);
  const island = createIsland(game, tiles);
  const vents = createVentFx(game);
  const caustics = createCaustics(game);
  const layout = buildLayout();
  const M = { a: 1, e: 0, f: 0 };
  const visible = [];
  const prof = { deco: 0, front: 0, items: 0 };
  let t = 0;

  function readMatrix(ctx) {
    const m = ctx.getTransform();
    M.a = m.a;
    M.e = m.e;
    M.f = m.f;
    return m;
  }

  /** Collect items of layers [l0..l1] intersecting the view (each item once, in z order per column). */
  function collect(l0, l1, out) {
    out.length = 0;
    const b = game.camera.bounds;
    const c0 = Math.floor(b.left / COL), c1 = Math.floor(b.right / COL);
    const fr = game.time.frame;
    for (let c = c0; c <= c1; c++) {
      const list = layout.cols.get(c);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.layer < l0 || it.layer > l1 || it.seen === fr) continue;
        if (it.x1 < b.left || it.x0 > b.right || it.y1 < b.top || it.y0 > b.bottom) continue;
        it.seen = fr;
        out.push(it);
      }
    }
    out.sort((p, q) => p.layer - q.layer || p.z - q.z);
    return out;
  }

  // sway: the plant's own rhythm + a slow surge that rocks the whole shallow sea floor together
  let curT = 0, curX = 0, curItem = null;
  function swayOff(hf) {
    const it = curItem, sw = it.t.sway;
    const own = sw.amp * Math.pow(hf, 1.5) * Math.sin(curT * sw.freq + it.ph - hf * sw.wave);
    const surge = sw.amp * 0.6 * Math.pow(hf, 1.25) * Math.sin(curT * 0.55 + curX * 0.0021);
    return own + surge * it.surge;
  }

  function drawItems(ctx, list, alphaFn) {
    const r = tiles.res;
    curT = t;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const a = alphaFn ? alphaFn(it) : 1;
      if (a <= 0.01) continue;
      const spr = sprite(it.t, it.v, r);
      if (it.t.sway) {
        if (it.surge === undefined) it.surge = 1 - Math.min(1, Math.max(0, (it.y - 300) / 2400));
        curItem = it;
        curX = it.x;
        stampSway(ctx, M, it, spr, a, swayOff);
      } else stamp(ctx, M, it, spr, a);
    }
    ctx.globalAlpha = 1;
  }

  /** A veil of water between the back corals and the near ones (clipped to the water above the ground). */
  function haze(ctx) {
    const b = game.camera.bounds;
    let gmin = Infinity, gmax = -Infinity;
    const step = Math.max(8, b.w / 160);
    for (let x = b.left - step; x <= b.right + step; x += step) {
      const y = heightAt(x);
      if (y < gmin) gmin = y;
      if (y > gmax) gmax = y;
    }
    const y0 = Math.max(6, gmin - 280), y1 = gmax + 4;
    if (y1 <= y0) return;
    if (y0 > b.bottom || y1 < b.top || gmin > 2600) return;
    const c = game.env.waterColorAt(Math.max(0, gmin), (b.left + b.right) / 2);
    const k = 1 - Math.min(1, Math.max(0, (gmin - 1200) / 1400));
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, css(c, 0));
    g.addColorStop(0.6, css(c, 0.14 * k));
    g.addColorStop(1, css(c, 0.26 * k));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b.left - step, y0);
    for (let x = b.left - step; x <= b.right + step; x += step) ctx.lineTo(x, heightAt(x));
    ctx.lineTo(b.right + step, y0);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(b.left - step, y0, b.w + step * 2, y1 - y0);
    ctx.restore();
  }

  // treasure glints: little four-point stars that twinkle on the chest's gold
  const chests = layout.items.filter((it) => it.data && it.data.chest);
  function glints(ctx) {
    const b = game.camera.bounds;
    const warm = glowSpriteFn(255, 214, 120);
    for (const it of chests) {
      if (it.x1 < b.left || it.x0 > b.right || it.y1 < b.top || it.y0 > b.bottom) continue;
      ctx.globalAlpha = 0.35;
      ctx.drawImage(warm, it.x - 40, it.y - 60, 80, 70);
      // a faint warm wash over the wreck and its debris field
      ctx.globalAlpha = 0.07;
      ctx.drawImage(warm, it.x - 560, it.y - 330, 900, 420);
      CHEST_GLINTS.forEach(([gx, gy], i) => {
        const tw = Math.pow(Math.max(0, Math.sin(t * 1.7 + i * 2.3)), 12);
        if (tw < 0.02) return;
        const x = it.x + gx * it.s * it.f, y = it.y + gy * it.s, r = 9 * tw + 2;
        ctx.globalAlpha = tw;
        ctx.fillStyle = 'rgb(255,246,210)';
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.18, y - r * 0.18);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + r * 0.18, y + r * 0.18);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.18, y + r * 0.18);
        ctx.lineTo(x - r, y);
        ctx.lineTo(x - r * 0.18, y - r * 0.18);
        ctx.closePath();
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }

  // foreground items fade while the lure / hooked fish is behind them, so they never hide the action
  let frontDt = 0, lastFrontT = 0;
  function frontAlpha(it) {
    const f = game.fishing;
    let a = 1;
    const test = (x, y, r) => {
      if (x > it.x0 - r && x < it.x1 + r && y > it.y0 - r && y < it.y1 + r) a = 0.3;
    };
    if (f.lure && f.lure.visible && f.lure.inWater) test(f.lure.x, f.lure.y, 30);
    if (f.hooked) test(f.hooked.x, f.hooked.y, 60);
    // ease toward the target so items never pop
    it.fa = it.fa === undefined ? a : it.fa + (a - it.fa) * Math.min(1, frontDt * 6);
    return it.fa;
  }

  /** Every few frames, queue the sprites of items within a view-width beyond the edges (painted on a budget). */
  let pf = 0;
  function prefetch() {
    if (++pf % 12) return;
    const b = game.camera.bounds, r = tiles.res;
    const c0 = Math.floor((b.left - b.w) / COL), c1 = Math.floor((b.right + b.w) / COL);
    for (let c = c0; c <= c1; c++) {
      const list = layout.cols.get(c);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.y1 < b.top - b.h || it.y0 > b.bottom + b.h) continue;
        want(it.t, it.v, r);
      }
    }
  }

  return {
    stats() {
      return { ...tiles.stats(), ...spriteStats(), items: layout.items.length, visible: prof.items };
    },
    update(dt) {
      t += dt;
      tiles.update();
      prefetch();
      pumpSprites(2);
      vents.update(dt);
      caustics.update();
    },
    renderBack(ctx) {
      ridges.render(ctx);
      const m = readMatrix(ctx);
      collect(-1, -1, visible); // far stands behind the ground (bases hidden by it)
      drawItems(ctx, visible, null);
      ctx.setTransform(m);
      tiles.draw(ctx);
      caustics.render(ctx, t);
      ctx.setTransform(m);
      collect(0, 0, visible);
      prof.items = visible.length;
      drawItems(ctx, visible, null);
      ctx.setTransform(m);
      haze(ctx);
      collect(1, 2, visible);
      prof.items += visible.length;
      drawItems(ctx, visible, null);
      ctx.setTransform(m);
      vents.render(ctx);
      island.render(ctx, t);
      ctx.setTransform(m);
    },
    renderFront(ctx) {
      frontDt = Math.min(0.1, Math.max(0, game.time.real - lastFrontT));
      lastFrontT = game.time.real;
      const m = readMatrix(ctx);
      collect(3, 3, visible);
      drawItems(ctx, visible, frontAlpha);
      ctx.setTransform(m);
    },
    renderGlow(ctx) {
      ctx.save();
      island.renderGlow(ctx, t);
      vents.renderGlow(ctx, t);
      glints(ctx);
      ctx.restore();
    },
  };
}
