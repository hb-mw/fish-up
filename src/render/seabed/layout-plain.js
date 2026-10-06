// Abyssal plain (x ≈ 7400–10300): sparse, lonely life on dark ooze — manganese nodule fields, glass sponges,
// sea pens, stalked crinoids, brittle stars — and the whale fall as a landmark.
import { smoothstep } from '../../core/math.js';
import { defLayout, pickW } from './layout.js';
import { WHALE_X } from './whale.js';

defLayout(0xab55, (rng, add) => {
  const plain = (x) => smoothstep(7300, 7700, x) * (1 - smoothstep(10050, 10400, x));
  add('whalefall', WHALE_X, { s: 1, f: 1, layer: 0, sink: 10 });
  for (let x = 7350; x < 10400; x += rng.range(24, 70)) {
    const P = plain(x);
    if (!rng.chance(0.2 + 0.8 * P)) continue;
    const nearWhale = Math.abs(x - WHALE_X) < 230;
    const id = pickW(rng, [['nodules', nearWhale ? 0.5 : 4], ['glasssponge', 0.8], ['seapen', 1.6], ['crinoid', 0.7], ['brittlestar', 1.2]]);
    const layer = id === 'nodules' || id === 'brittlestar' ? 2 : rng.chance(0.4) ? 0 : 1;
    add(id, x, { s: rng.range(0.7, 1.15), layer });
  }
  // a couple of foreground sea pens / nodules
  for (let x = 7700; x < 10100; x += rng.range(500, 900)) add(rng.chance(0.5) ? 'seapen' : 'nodules', x, { s: rng.range(0.9, 1.2), layer: 3, dy: rng.range(6, 12) });
});
