// Reef + island-shallows composition: coral "bommies" — mounds of old reef rock crowned with big corals and
// crowded at the foot — separated by sand gaps with sea-grass beds, starfish and urchins; plus a sparse
// foreground layer.
import { smoothstep } from '../../core/math.js';
import { defLayout, pickW } from './layout.js';

defLayout(0x4ee1, (rng, add) => {
  // island shallows: grass beds and a few rocks below the dock
  for (let x = 452; x < 700; x += rng.range(10, 22)) {
    if (rng.chance(0.65)) add('seagrass', x, { s: rng.range(0.6, 1.05), layer: 1 });
  }
  add('reefrock', 590, { s: 0.55, layer: 0, v: 1 });
  add('starfish', 520, { layer: 2, v: 0 });
  add('urchin', 648, { layer: 2, s: 0.9 });

  const lush = (x) => smoothstep(660, 1250, x) * (1 - smoothstep(2650, 2990, x)) * (0.8 + 0.2 * smoothstep(1500, 2200, x));
  let x = 700;
  while (x < 2970) {
    const L = lush(x);
    const w = rng.range(170, 360) * (0.6 + 0.6 * L);
    const cx = x + w / 2;
    const spread = w * 0.42;
    // the mound: 1–3 rocks
    let top = 0; // how high the mound rises (px above the ground)
    const nRock = L > 0.3 ? rng.int(1, 3) : rng.chance(0.5) ? 1 : 0;
    for (let i = 0; i < nRock; i++) {
      const s = rng.range(0.85, 1.7) * (0.55 + 0.45 * L);
      add('reefrock', cx + rng.range(-spread * 0.5, spread * 0.5), { s, layer: 0, dy: 8 * s });
      top = Math.max(top, 44 * s);
    }
    // the crown: big corals sitting on the mound
    const nCrown = Math.round(rng.range(1.2, 3.6) * (0.35 + L));
    for (let i = 0; i < nCrown; i++) {
      const id = pickW(rng, [['staghorn', 3], ['table', 1.5], ['seafan', 2.2], ['barrel', 0.35], ['brain', 1.4], ['softcoral', 1.2]]);
      const dx = rng.range(-0.45, 0.45) * Math.max(60, top * 1.6);
      add(id, cx + dx, { s: rng.range(0.85, 1.45), layer: 0, dy: -top * rng.range(0.45, 0.8) * (1 - Math.abs(dx) / Math.max(80, top * 2)) });
    }
    // the foot: mid-size corals crowding around
    const nMid = Math.round(rng.range(2.5, 6) * (0.4 + L));
    for (let i = 0; i < nMid; i++) {
      const id = pickW(rng, [['brain', 3], ['tubes', 2.2], ['softcoral', 2.6], ['anemone', 1.6], ['barrel', 0.25], ['seafan', 0.8], ['staghorn', 0.8]]);
      add(id, cx + rng.range(-spread * 1.15, spread * 1.15), { s: rng.range(0.7, 1.25), layer: 1 });
    }
    const nLow = Math.round(rng.range(3, 7) * (0.5 + L));
    for (let i = 0; i < nLow; i++) {
      const id = pickW(rng, [['seagrass', 2.2], ['urchin', 1], ['clam', 1], ['starfish', 0.8], ['duster', 1.6], ['anemone', 0.7]]);
      add(id, cx + rng.range(-spread * 1.35, spread * 1.35), { s: rng.range(0.7, 1.15), layer: 2 });
    }
    x += w;
    // sand gap
    const gap = rng.range(20, 110) * (1.5 - 0.8 * L);
    for (let gx = x + 8; gx < x + gap; gx += rng.range(14, 28)) {
      const r = rng.next();
      if (r < 0.45) add('seagrass', gx, { s: rng.range(0.55, 1), layer: 2 });
      else if (r < 0.5) add('starfish', gx, { layer: 2 });
      else if (r < 0.54) add('clam', gx, { s: rng.range(0.7, 0.95), layer: 2 });
    }
    x += gap;
  }

  // a carpet of small life all along the reef flat
  for (let cx = 700; cx < 2960; cx += rng.range(10, 24)) {
    const L = lush(cx);
    if (!rng.chance(0.25 + 0.45 * L)) continue;
    const id = pickW(rng, [['seagrass', 2], ['brain', 1.2 * L], ['anemone', 0.7], ['duster', 1], ['urchin', 0.5], ['clam', 0.4], ['tubes', 0.6 * L], ['softcoral', 0.6 * L]]);
    const small = id === 'brain' || id === 'tubes' || id === 'softcoral';
    add(id, cx, { s: small ? rng.range(0.4, 0.65) : rng.range(0.55, 0.9), layer: 2 });
  }

  // sparse foreground: low things that overlap the lip, so fish pass behind them now and then
  for (let fx = 740; fx < 2950; fx += rng.range(260, 560)) {
    const id = pickW(rng, [['seagrass', 3], ['brain', 1.2], ['softcoral', 1], ['reefrock', 0.5], ['anemone', 0.6]]);
    add(id, fx, { layer: 3, s: id === 'reefrock' ? rng.range(0.55, 0.75) : rng.range(0.9, 1.25), dy: rng.range(10, 22) });
  }
});
