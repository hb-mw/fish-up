// Kelp forest composition (x ≈ 2950–5200): a hazy far stand (drawn before the ground, bases hidden), a dense
// main stand whose tops reach toward the surface (never above y ≈ 40), boulders with plumose anemones,
// urchins and stars on the rocky floor, and a few strands in front of the fish.
import { heightAt } from '../../world/terrain.js';
import { smoothstep } from '../../core/math.js';
import { defLayout, pickW } from './layout.js';
import { KELP_H } from './kelp.js';

const forest = (x) => smoothstep(2880, 3250, x) * (1 - smoothstep(4850, 5250, x));

function kelpFor(rng, x, maxTop) {
  // tallest kelp that fits between the ground and maxTop
  const ground = heightAt(x);
  const room = ground - maxTop - rng.range(0, 220);
  for (let h = KELP_H.length - 1; h >= 0; h--) {
    const s = rng.range(0.82, 1.12);
    if (KELP_H[h] * s + 40 * s <= room) return { id: 'kelp' + h, s };
  }
  return room > 260 ? { id: 'kelp0', s: (room - 30) / 460 } : null;
}

defLayout(0x6e1f, (rng, add) => {
  // far stand (layer −1: before the ground tiles)
  for (let x = 2900; x < 5300; x += rng.range(40, 90)) {
    const F = forest(x);
    if (!rng.chance(F)) continue;
    const ground = heightAt(x);
    const s = Math.min(rng.range(0.7, 1.05), (ground - 60) / 730);
    if (s < 0.35) continue;
    add('kelpfar', x, { s, layer: -1, dy: rng.range(30, 90), sink: 0 });
  }
  // main stand
  for (let x = 2920; x < 5280; x += rng.range(42, 92)) {
    const F = forest(x);
    if (!rng.chance(0.15 + 0.85 * F)) continue;
    const k = kelpFor(rng, x, 46);
    if (k) add(k.id, x, { s: k.s, layer: 0 });
  }
  // rocky floor
  for (let x = 2950; x < 5250; x += rng.range(60, 170)) {
    const F = forest(x);
    if (!rng.chance(0.3 + 0.6 * F)) continue;
    const s = rng.range(0.55, 1.25);
    add('boulder', x, { s, layer: rng.chance(0.5) ? 0 : 1 });
    const top = 60 * s;
    const n = rng.int(0, 3);
    for (let i = 0; i < n; i++) {
      add(pickW(rng, [['plumose', 3], ['anemone', 1], ['urchin', 1.2], ['starfish', 0.6]]), x + rng.range(-30, 30) * s, { s: rng.range(0.7, 1.05), layer: 1, dy: -top * rng.range(0.7, 0.95) });
    }
  }
  for (let x = 2960; x < 5250; x += rng.range(18, 44)) {
    if (!rng.chance(0.45 * forest(x))) continue;
    add(pickW(rng, [['urchin', 2], ['plumose', 1.4], ['starfish', 1], ['seagrass', 1.2], ['anemone', 0.8]]), x, { s: rng.range(0.6, 1), layer: 2 });
  }
  // a few strands in front of the action (rendered in the front pass, faded near the lure)
  for (let x = 3150; x < 5000; x += rng.range(420, 820)) {
    const k = kelpFor(rng, x, 60);
    if (k) add(k.id, x, { s: k.s, layer: 3, dy: rng.range(6, 14) });
  }
});
