// Home island above the water: palms (wind-blown fronds), the hut, the beached rowboat, beach grass and the
// dock — all drawn into an offscreen layer that is multiplied by palette.ambient (warm at golden hour, deep
// blue at night, flash-lit by lightning), clipped to above the moving sea surface. Night: lit window + lanterns.
import { heightAt } from '../../world/terrain.js';
import { TYPES, sprite, stamp, stampSway, stampRot, glowSprite } from './deco.js';
import { defLayout } from './layout.js';
import { crownOf } from './palms.js';
import { HUT_X, HUT_GLOW } from './hut.js';
import { DOCK_X, DOCK_LAMP, ROWBOAT_X } from './dock.js';
import { makeCanvas } from './util.js';

const PALMS = [
  { x: 30, v: 0, f: 1, s: 1.08, ph: 0.3 },
  { x: 214, v: 1, f: 1, s: 1, ph: 2.1 },
  { x: 306, v: 2, f: 1, s: 0.92, ph: 4.4 },
];
// fronds per crown: [side, elevation, variant, scale]
const CROWN = [[1, 0.95, 0, 0.82], [-1, 0.85, 1, 0.8], [1, 0.42, 2, 1], [-1, 0.38, 0, 0.96], [1, -0.08, 1, 1.02],
  [-1, -0.14, 2, 0.98], [1, -0.55, 0, 0.86], [-1, -0.62, 1, 0.84]];
const ISLAND_X1 = 700;

// the dock is drawn behind the fish (main pass) and again tinted in the air layer
defLayout(0x15a1, (rng, add) => {
  add('dock', DOCK_X, { y: 0, sink: 0, f: 1, layer: 0, v: 0 });
  void rng;
});

export function createIsland(game, tiles) {
  let L = null, L2 = null;
  const M = { a: 1, e: 0, f: 0 };
  const hut = TYPES.get('hut'), boat = TYPES.get('rowboat'), trunk = TYPES.get('palmtrunk');
  const frond = TYPES.get('frond'), nuts = TYPES.get('coconuts'), dock = TYPES.get('dock'), grass = TYPES.get('beachgrass');
  const hutItem = { t: hut, v: 0, x: HUT_X, y: heightAt(HUT_X), s: 1, f: 1 };
  const boatItem = { t: boat, v: 0, x: ROWBOAT_X, y: heightAt(ROWBOAT_X) + 4, s: 1, f: 1 };
  const dockItem = { t: dock, v: 0, x: DOCK_X, y: 0, s: 1, f: 1 };
  const grassItems = [178, 236, 342, 384, 120, 22].map((x, i) => ({ t: grass, v: i % 3, x, y: heightAt(x) + 3, s: 0.9 + (i % 3) * 0.12, f: i % 2 ? 1 : -1, ph: i * 1.3 }));
  const palmItems = PALMS.map((p) => ({ t: trunk, v: p.v, x: p.x, y: heightAt(p.x) + 4, s: p.s, f: p.f, ph: p.ph }));

  function ensure(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (!L || L.width !== w || L.height !== h) {
      L = makeCanvas(w, h);
      L2 = makeCanvas(w, h);
    }
  }

  function drawPalms(lc, t, res) {
    const wind = game.env.weather.wind || 0;
    for (const it of palmItems) {
      const P = it;
      const amp = 2 + 9 * Math.abs(wind);
      const off = (hf) => Math.pow(hf, 1.6) * (wind * 10 + amp * Math.sin(t * (0.8 + Math.abs(wind)) + P.ph));
      stampSway(lc, M, it, sprite(trunk, it.v, res), 1, off);
      const [cx, cy] = crownOf(it.v);
      const X = it.x + it.f * cx * it.s + it.s * off(1), Y = it.y + cy * it.s;
      for (let k = 0; k < CROWN.length; k++) {
        const [side, elev, fv, fs] = CROWN[k];
        const gust = wind * 0.16 * (1 + 0.5 * Math.sin(t * 1.7 + k + P.ph));
        const flutter = Math.sin(t * (2.1 + k * 0.23) + k * 1.7 + P.ph) * 0.045 * (0.5 + Math.abs(wind));
        const ang = (side > 0 ? -elev : elev) + gust + flutter;
        stampRot(lc, M, frond, sprite(frond, fv, res), X, Y, ang, it.s * fs, side, 1);
      }
      stampRot(lc, M, nuts, sprite(nuts, 0, res), X, Y + 2, 0, it.s, 1, 1);
    }
  }

  return {
    /** Draw everything above the water, tinted by the ambient light. Call in renderBack after the ground. */
    render(ctx, t) {
      const b = game.camera.bounds;
      if (b.left > ISLAND_X1 || b.top > 40) return;
      ensure(ctx);
      const m = ctx.getTransform();
      M.a = m.a;
      M.e = m.e;
      M.f = m.f;
      const res = tiles.res;
      const lc = L.getContext('2d');
      // device rect of the island area
      const sx1 = Math.min(L.width, Math.ceil(m.a * ISLAND_X1 + m.e + 4));
      const sy1 = Math.min(L.height, Math.ceil(m.a * 40 + m.f + 4));
      if (sx1 <= 0 || sy1 <= 0) return;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, sx1, sy1);
      lc.setTransform(m);
      lc.save();
      // clip to above the sea surface
      const waves = game.world.waves;
      lc.beginPath();
      lc.moveTo(b.left - 20, b.top - 20);
      for (let x = b.left - 20; x <= Math.min(b.right, ISLAND_X1) + 20; x += 12) lc.lineTo(x, waves.heightAt(x) - 1);
      lc.lineTo(Math.min(b.right, ISLAND_X1) + 20, b.top - 20);
      lc.closePath();
      lc.clip();
      tiles.drawRange(lc, Math.max(b.left, -600), Math.min(b.right, ISLAND_X1), Math.max(b.top, -700), 20);
      drawPalms(lc, t, res);
      stamp(lc, M, hutItem, sprite(hut, 0, res), 1);
      stamp(lc, M, boatItem, sprite(boat, 0, res), 1);
      stamp(lc, M, dockItem, sprite(dock, 0, res), 1);
      for (const it of grassItems) {
        const amp = 2 + 6 * Math.abs(game.env.weather.wind || 0);
        stampSway(lc, M, it, sprite(grass, it.v, res), 1, (hf) => hf * hf * (amp * Math.sin(t * 1.9 + it.ph) + 4 * (game.env.weather.wind || 0)));
      }
      lc.restore();
      lc.globalAlpha = 1;
      // ambient tint: an ambient-coloured silhouette multiplied over the layer
      const a = game.env.palette.ambient;
      const l2 = L2.getContext('2d');
      l2.setTransform(1, 0, 0, 1, 0, 0);
      l2.globalCompositeOperation = 'copy';
      l2.drawImage(L, 0, 0, sx1, sy1, 0, 0, sx1, sy1);
      l2.globalCompositeOperation = 'source-in';
      l2.fillStyle = `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
      l2.fillRect(0, 0, sx1, sy1);
      l2.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(L, 0, 0, sx1, sy1, 0, 0, sx1, sy1);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(L2, 0, 0, sx1, sy1, 0, 0, sx1, sy1);
      ctx.restore();
    },
    /** Warm lit window + lanterns after dusk (additive pass). */
    renderGlow(ctx, t) {
      const b = game.camera.bounds;
      if (b.left > ISLAND_X1 || b.top > 40) return;
      const env = game.env;
      const on = Math.min(1, Math.max(0, (0.55 - env.daylight) / 0.4));
      if (on <= 0.01) return;
      const warm = glowSprite(255, 170, 80);
      const core = glowSprite(255, 236, 190);
      const flick = (k) => 0.92 + 0.08 * Math.sin(t * 9.3 + k) * Math.sin(t * 5.1 + k * 2);
      const hy = heightAt(HUT_X);
      const lamps = [
        [HUT_X + HUT_GLOW.window[0], hy + HUT_GLOW.window[1], 46, 0.7, 0],
        [HUT_X + HUT_GLOW.lantern[0], hy + HUT_GLOW.lantern[1], 70, 0.9, 1],
        [DOCK_LAMP[0], DOCK_LAMP[1], 90, 1, 2],
      ];
      for (const [x, y, r, k, i] of lamps) {
        const a = on * k * flick(i);
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(warm, x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = a;
        ctx.drawImage(core, x - r * 0.18, y - r * 0.18, r * 0.36, r * 0.36);
      }
      // the lit window pane itself
      ctx.globalAlpha = on * 0.75;
      ctx.fillStyle = 'rgb(255,176,84)';
      ctx.fillRect(HUT_X + HUT_GLOW.window[0] - 15, hy + HUT_GLOW.window[1] - 12, 30, 24);
      ctx.globalAlpha = 1;
    },
  };
}
