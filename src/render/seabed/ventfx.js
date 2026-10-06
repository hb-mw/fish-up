// The Trench: layout (basalt spires, sparse glowing life on the walls, the three vent fields at
// LANDMARKS.vents), billowing black-smoker plumes (particles) and the additive glow of the vents & biolights.
import { heightAt, LANDMARKS } from '../../world/terrain.js';
import { createRng } from '../../core/rng.js';
import { defLayout, pickW } from './layout.js';
import { CHIMNEY_H, FLORA_BULBS } from './vents.js';
import { glowSprite } from './deco.js';
import { makeCanvas } from './util.js';

const VENTS = LANDMARKS.vents.map((v) => v.x);
const smokers = []; // {x, y (orifice), s}
const glowItems = []; // bacterial mats + flora items (filled by the layout)

defLayout(0x7e47, (rng, add) => {
  // walls and floor: spires, black coral, flora, mats
  for (let x = 10250; x < 12000; x += rng.range(40, 110)) {
    const nearVent = VENTS.some((v) => Math.abs(v - x) < 170);
    if (nearVent) continue;
    const id = pickW(rng, [['spire', 2], ['blackcoral', 1], ['glowflora', 1.2], ['bactmat', 0.8], ['featherstar', 0.4], ['crinoid', 0.5]]);
    const it = add(id, x, { s: rng.range(0.6, 1.15), layer: rng.chance(0.4) ? 0 : 1 });
    if (it && (id === 'glowflora' || id === 'bactmat')) glowItems.push(it);
  }
  VENTS.forEach((vx, k) => {
    const main = add('chimney', vx, { v: k === 1 ? 0 : 1, s: rng.range(0.95, 1.1), f: 1, layer: 0, sink: 8 });
    const extra = [];
    for (let i = 0; i < 2; i++) extra.push(add('chimney', vx + (i ? 1 : -1) * rng.range(46, 90), { v: 2 - (i & k & 1), s: rng.range(0.6, 0.95), f: 1, layer: 0, sink: 8 }));
    for (const c of [main, ...extra]) {
      if (!c) continue;
      const h = CHIMNEY_H[c.v] * c.s;
      smokers.push({ x: c.x + Math.sin(6 + c.v) * 3 * c.s, y: c.y - h, s: c.s, ph: rng.range(0, 6) });
    }
    for (let i = 0; i < 6; i++) add('tubeworms', vx + rng.range(-150, 150), { s: rng.range(0.7, 1.15), layer: rng.chance(0.5) ? 1 : 2 });
    for (let i = 0; i < 3; i++) add('mussels', vx + rng.range(-160, 160), { s: rng.range(0.8, 1.1), layer: 2 });
    for (let i = 0; i < 4; i++) glowItems.push(add('bactmat', vx + rng.range(-200, 200), { s: rng.range(0.7, 1.2), layer: 2 }));
    for (let i = 0; i < 2; i++) glowItems.push(add('glowflora', vx + rng.range(-220, 220), { s: rng.range(0.8, 1.1), layer: 1 }));
  });
});

// smoke puffs: soft, lumpy dark blobs
const puffs = [];
function puffSprite(i) {
  if (puffs[i]) return puffs[i];
  const c = makeCanvas(96, 96), g = c.getContext('2d');
  const rng = createRng(91 + i);
  for (let k = 0; k < 7; k++) {
    const x = 48 + rng.range(-16, 16), y = 48 + rng.range(-16, 16), r = rng.range(18, 30);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(22,18,16,0.55)');
    gr.addColorStop(0.6, 'rgba(30,24,20,0.3)');
    gr.addColorStop(1, 'rgba(30,24,20,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 96, 96);
  }
  return (puffs[i] = c);
}

export function createVentFx(game) {
  const parts = [];
  const rng = createRng(4242);
  let acc = 0;
  const near = () => {
    const b = game.camera.bounds;
    return b.right > 10200 && b.bottom > 5400;
  };
  return {
    update(dt) {
      if (!near()) {
        parts.length = 0;
        return;
      }
      acc += dt;
      const b = game.camera.bounds;
      while (acc > 0.07) {
        acc -= 0.07;
        for (const s of smokers) {
          if (s.x < b.left - 400 || s.x > b.right + 400 || rng.next() > 0.45) continue;
          parts.push({ x: s.x + rng.range(-2, 2) * s.s, y: s.y, vx: rng.range(-6, 6), vy: -rng.range(38, 62) * s.s, r: 7 * s.s, gr: rng.range(5, 8) * s.s, age: 0, life: rng.range(6, 9), k: rng.int(0, 2), rot: rng.range(0, 6.28) });
        }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age > p.life) {
          parts.splice(i, 1);
          continue;
        }
        p.vy *= 1 - 0.18 * dt;
        p.vx += (Math.sin(p.age * 0.7 + p.rot) * 6 + 4) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.gr * dt;
      }
    },
    /** black plumes (WORLD space, normal blending) */
    render(ctx) {
      if (!parts.length) return;
      for (const p of parts) {
        const f = p.age / p.life;
        const a = Math.min(1, p.age * 2.5) * (1 - f) * 0.9;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        const r = p.r;
        ctx.drawImage(puffSprite(p.k), p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    },
    /** additive: hot throats, lit smoke bases, bacterial mats, biolights */
    renderGlow(ctx, t) {
      if (!near()) return;
      const b = game.camera.bounds;
      const hot = glowSprite(255, 120, 40), core = glowSprite(255, 220, 140);
      for (const s of smokers) {
        if (s.x < b.left - 200 || s.x > b.right + 200) continue;
        const fl = 0.85 + 0.15 * Math.sin(t * 7.1 + s.ph) * Math.sin(t * 3.3 + s.ph * 2);
        const r = 60 * s.s;
        ctx.globalAlpha = 0.6 * fl;
        ctx.drawImage(hot, s.x - r, s.y - r * 0.8, r * 2, r * 2);
        ctx.globalAlpha = 0.9 * fl;
        ctx.drawImage(core, s.x - r * 0.25, s.y - r * 0.2, r * 0.5, r * 0.4);
        // glow on the rising plume base
        ctx.globalAlpha = 0.22 * fl;
        ctx.drawImage(hot, s.x - r * 1.2, s.y - r * 2.6, r * 2.4, r * 2.4);
      }
      // the young billows are lit from below by the vent: warm, rising, fading
      for (const p of parts) {
        const f = p.age / p.life;
        if (f > 0.45) continue;
        const a = Math.min(1, p.age * 3) * (1 - f / 0.45) * 0.16;
        const r = p.r * 1.3;
        ctx.globalAlpha = a;
        ctx.drawImage(hot, p.x - r, p.y - r, r * 2, r * 2);
      }
      // warm rim of light up each chimney
      for (const s of smokers) {
        if (s.x < b.left - 200 || s.x > b.right + 200) continue;
        const h = heightAt(s.x) - s.y;
        ctx.globalAlpha = 0.14;
        ctx.drawImage(hot, s.x - 36 * s.s, s.y - 10, 72 * s.s, h + 20);
      }
      const mat = glowSprite(70, 230, 210), bulb = glowSprite(110, 200, 255), vio = glowSprite(180, 120, 255);
      for (const it of glowItems) {
        if (!it || it.x1 < b.left || it.x0 > b.right || it.y1 < b.top || it.y0 > b.bottom) continue;
        const pulse = 0.65 + 0.35 * Math.sin(t * 1.3 + it.ph);
        if (it.t.id === 'bactmat') {
          ctx.globalAlpha = 0.3 * pulse;
          const w = 70 * it.s;
          ctx.drawImage(mat, it.x - w, it.y - w * 0.35, w * 2, w * 0.7);
        } else {
          const bulbs = FLORA_BULBS[it.v] || [];
          for (let i = 0; i < bulbs.length; i++) {
            const [bx, by, br] = bulbs[i];
            const x = it.x + bx * it.s * it.f, y = it.y + by * it.s;
            const r = br * it.s * 6;
            ctx.globalAlpha = 0.75 * (0.6 + 0.4 * Math.sin(t * 2.1 + it.ph + i));
            ctx.drawImage(i % 2 ? vio : bulb, x - r, y - r, r * 2, r * 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
