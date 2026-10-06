// The Drop-off (x ≈ 5000–7400): wall life thinning with depth (sea fans, sponges, black coral, feather stars),
// cave mouths set into the steep walls, and the shipwreck with its scattered cargo on the ledge.
import { heightAt, slopeAt } from '../../world/terrain.js';
import { smoothstep } from '../../core/math.js';
import { defType } from './deco.js';
import { defLayout, pickW } from './layout.js';
import { WRECK_X } from './wreck.js';
import { rad, TAU } from './paint.js';

// cave mouth: a dark recess in the wall face with a lit roof lip
defType({
  id: 'cave', variants: 2, box: { x0: -70, y0: -50, x1: 70, y1: 50 }, noFade: true,
  paint(g, v, rng) {
    const rx = 52 + v * 10, ry = 30 + v * 6;
    g.save();
    g.scale(1, ry / rx);
    g.fillStyle = rad(g, 4, 6, 2, 0, 0, rx, [[0, 'rgba(4,3,2,0.96)'], [0.55, 'rgba(10,8,6,0.85)'], [0.85, 'rgba(24,20,16,0.35)'], [1, 'rgba(24,20,16,0)']]);
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
    // roof lip catching the light, a few stalactite-like crusts hanging from it
    g.strokeStyle = 'rgba(230,214,186,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(0, -2, rx * 0.86, ry * 0.8, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = rng.range(-rx * 0.6, rx * 0.6);
      const y = -Math.sqrt(Math.max(0, 1 - (x / (rx * 0.86)) ** 2)) * ry * 0.8;
      g.fillStyle = rng.pick(['rgba(214,128,150,0.8)', 'rgba(230,170,80,0.75)', 'rgba(200,190,170,0.7)']);
      g.beginPath();
      g.ellipse(x, y + 4, rng.range(2, 4), rng.range(4, 8), 0, 0, TAU);
      g.fill();
    }
  },
});

const CAVES = [[5330, 70, 0], [5790, 80, 1], [6940, 90, 1], [7210, 70, 0], [10560, 90, 1], [10840, 80, 0]];

defLayout(0xd209, (rng, add) => {
  for (const [x, d, v] of CAVES) add('cave', x, { y: heightAt(x) + d, sink: 0, v, f: 1, layer: 0, s: 1 });

  // wall life: fans and sponges, thinning with depth
  for (let x = 5000; x < 7450; x += rng.range(26, 70)) {
    if (x > WRECK_X - 330 && x < WRECK_X + 330) continue;
    const ground = heightAt(x);
    const life = 1 - smoothstep(1900, 4300, ground);
    if (!rng.chance(0.25 + 0.65 * life)) continue;
    const steep = Math.abs(slopeAt(x)) > 1.2;
    const id = pickW(rng, [['seafan', 3 * life + 0.3], ['tubes', 1.5 * life], ['blackcoral', 0.6 + 1.2 * (1 - life)], ['featherstar', 1.4],
      ['boulder', steep ? 0.2 : 1], ['anemone', 0.6 * life], ['plumose', 0.8]]);
    const s = id === 'boulder' ? rng.range(0.4, 0.85) : rng.range(0.6, 1.15) * (0.7 + 0.3 * life);
    add(id, x, { s, layer: rng.chance(0.35) ? 0 : 1 });
  }

  // ── the wreck and its debris field ──
  add('wreckhull', WRECK_X, { s: 1, f: 1, layer: 0, sink: 16 });
  add('mast', WRECK_X - 360, { s: 1, f: 1, layer: 1, sink: 6 });
  add('anchor', WRECK_X - 420, { s: 1, f: 1, layer: 1, sink: 6 });
  add('chest', WRECK_X + 150, { s: 1, f: 1, layer: 2, sink: 8, data: { chest: true } });
  add('cannon', WRECK_X - 120, { s: 1, f: 1, layer: 2, sink: 8 });
  for (const [id, dx, v] of [['cask', -200, 0], ['cask', 222, 1], ['crate', -60, 0], ['crate', 260, 1], ['cask', 300, 0], ['crate', -300, 1]]) {
    add(id, WRECK_X + dx, { s: rng.range(0.9, 1.15), v, layer: 2, sink: 8 });
  }
  // encrusting life on and around the wreck
  for (let i = 0; i < 16; i++) {
    const x = WRECK_X + rng.range(-330, 330);
    add(pickW(rng, [['featherstar', 2], ['seafan', 1.5], ['tubes', 1], ['plumose', 1.2], ['anemone', 0.8]]), x, { s: rng.range(0.5, 0.85), layer: 2 });
  }
});
