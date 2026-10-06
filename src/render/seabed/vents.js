// Trench + hydrothermal-vent painters: black-smoker chimneys (knobby sulphide towers, mineral streaks), Riftia
// tube-worm clusters (white tubes, red plumes), mussel beds with pale crabs, bacterial mats, strange glowing
// flora and jagged basalt spires. Local px, base (0,0), −y up.
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, blobPath, contactShadow } from './paint.js';

export const CHIMNEY_H = [250, 180, 120];

defType({
  id: 'chimney', variants: 3, box: { x0: -60, y0: -270, x1: 60, y1: 10 }, foot: 34,
  paint(g, v, rng) {
    const h = CHIMNEY_H[v], w0 = 34 - v * 6, w1 = 9 - v;
    contactShadow(g, 0, 56, 7, 0.6);
    // stacked knobby lumps from the base up
    const lumps = [];
    for (let y = 0; y > -h; y -= rng.range(6, 11)) {
      const f = -y / h;
      const hw = w0 + (w1 - w0) * Math.pow(f, 0.8);
      lumps.push([rng.range(-hw * 0.25, hw * 0.25) + Math.sin(f * 6 + v) * 3, y, hw * rng.range(0.85, 1.15), rng.range(7, 12)]);
    }
    for (const [x, y, rx, ry] of lumps) {
      g.fillStyle = rad(g, x - rx * 0.4, y - ry * 0.6, 1, x, y, rx * 1.1, [[0, '#6a6460'], [0.45, '#2c2826'], [1, '#0c0a0a']]);
      blobPath(g, x, y, rx, ry, 9, 0.18, rng);
      g.fill();
    }
    // flanges: ledges where hot fluid pools beneath
    for (let i = 0; i < 2 + v; i++) {
      const y = -h * rng.range(0.25, 0.8), side = rng.sign();
      const hw = w0 + (w1 - w0) * (-y / h);
      g.fillStyle = lin(g, 0, y - 4, 0, y + 6, [[0, '#7a706a'], [1, '#1a1614']]);
      g.beginPath();
      g.ellipse(side * (hw + 8), y, 16, 4.5, side * 0.1, 0, TAU);
      g.fill();
    }
    // mineral streaks: iron ochre, sulphur, white anhydrite
    for (let i = 0; i < 26; i++) {
      const y = -rng.range(0, h), f = -y / h;
      const hw = w0 + (w1 - w0) * f;
      const x = rng.range(-hw, hw);
      g.strokeStyle = rng.pick(['rgba(196,110,48,0.55)', 'rgba(230,200,80,0.45)', 'rgba(236,230,214,0.45)', 'rgba(160,70,40,0.5)']);
      g.lineWidth = rng.range(1, 3);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(-3, 3), y + rng.range(6, 20));
      g.stroke();
    }
    // the orifice
    g.fillStyle = '#060404';
    g.beginPath();
    g.ellipse(0 + Math.sin(6 + v) * 3, -h, w1 * 0.8, w1 * 0.35, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(214,170,90,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
  },
});

defType({
  id: 'tubeworms', variants: 3, box: { x0: -40, y0: -112, x1: 40, y1: 6 },
  sway: { amp: 3.5, freq: 1.1, wave: 0.7, slices: 4 },
  paint(g, v, rng) {
    contactShadow(g, 0, 34, 5, 0.5);
    const n = 6 + v * 3;
    const worms = [];
    for (let i = 0; i < n; i++) worms.push({ x: rng.range(-16, 16), h: rng.range(40, 100), lean: rng.range(-0.35, 0.35), z: rng.next() });
    worms.sort((a, b) => a.z - b.z);
    for (const W of worms) {
      const tx = W.x + W.lean * W.h, ty = -W.h;
      // tube: chalky white, ringed
      g.strokeStyle = rgbk(H('#cfc6b8'), 0.62 + W.z * 0.3);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(W.x, 4);
      g.quadraticCurveTo(W.x + W.lean * W.h * 0.3, -W.h * 0.5, tx, ty);
      g.stroke();
      g.strokeStyle = 'rgba(255,252,240,0.55)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(W.x - 1.6, 4);
      g.quadraticCurveTo(W.x - 1.6 + W.lean * W.h * 0.3, -W.h * 0.5, tx - 1.6, ty);
      g.stroke();
      // the blood-red plume
      g.fillStyle = rad(g, tx - 2, ty - 7, 0.5, tx, ty - 5, 9, [[0, '#ff6a6a'], [0.5, '#d81e2e'], [1, '#7a0c18']]);
      blobPath(g, tx, ty - 5, 6, 8, 8, 0.25, rng, W.lean);
      g.fill();
    }
  },
});

defType({
  id: 'mussels', variants: 2, box: { x0: -46, y0: -20, x1: 46, y1: 6 },
  paint(g, v, rng) {
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-38, 38), y = rng.range(-10, 2);
      g.fillStyle = rad(g, x - 1, y - 2, 0.3, x, y, 6, [[0, '#6a7a8a'], [0.5, '#2a3038'], [1, '#0e1014']]);
      g.beginPath();
      g.ellipse(x, y, 5.5, 2.8, rng.range(-0.8, 0.8), 0, TAU);
      g.fill();
    }
    // pale vent crabs picking over the bed
    for (let i = 0; i < 2 + v; i++) {
      const x = rng.range(-30, 30), y = -9;
      g.strokeStyle = '#e8e2d8';
      g.lineWidth = 1.2;
      for (let k = -3; k <= 3; k++) {
        if (!k) continue;
        g.beginPath();
        g.moveTo(x + k * 1.5, y);
        g.lineTo(x + k * 3.6, y + 4.5);
        g.stroke();
      }
      g.fillStyle = rad(g, x - 1, y - 2, 0.3, x, y, 6, [[0, '#ffffff'], [1, '#c8beb0']]);
      g.beginPath();
      g.ellipse(x, y - 1, 5, 3.4, 0, 0, TAU);
      g.fill();
    }
  },
});

defType({
  id: 'bactmat', variants: 3, box: { x0: -60, y0: -10, x1: 60, y1: 6 },
  paint(g, v, rng) {
    for (let i = 0; i < 30; i++) {
      const x = rng.range(-52, 52), y = rng.range(-5, 2);
      g.fillStyle = rng.pick(['rgba(250,248,236,0.6)', 'rgba(244,220,120,0.55)', 'rgba(236,150,70,0.45)', 'rgba(220,240,230,0.5)']);
      g.beginPath();
      g.ellipse(x, y, rng.range(4, 12), rng.range(1.5, 3.5), 0, 0, TAU);
      g.fill();
    }
  },
});

/** glowing bulbs (local px) per glowflora variant — the glow pass lights them */
export const FLORA_BULBS = [];
defType({
  id: 'glowflora', variants: 3, box: { x0: -30, y0: -96, x1: 30, y1: 6 },
  sway: { amp: 1, freq: 0.8, wave: 0.9, slices: 3 }, // barely moves, so the additive bulb glows stay on the bulbs
  paint(g, v, rng) {
    const bulbs = [];
    const n = 3 + v;
    for (let i = 0; i < n; i++) {
      const x = rng.range(-14, 14), h = rng.range(36, 88), lean = rng.range(-10, 10);
      g.strokeStyle = 'rgba(70,90,110,0.9)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x * 0.3, 3);
      g.quadraticCurveTo(x, -h * 0.5, x + lean, -h);
      g.stroke();
      bulbs.push([x + lean, -h, rng.range(3, 5)]);
      g.fillStyle = rad(g, x + lean, -h, 0.5, x + lean, -h, 5, [[0, '#e8fbff'], [0.5, '#7ad8f0'], [1, '#2a6a8a']]);
      g.beginPath();
      g.arc(x + lean, -h, bulbs[bulbs.length - 1][2], 0, TAU);
      g.fill();
    }
    FLORA_BULBS[v] = bulbs;
  },
});

defType({
  id: 'spire', variants: 3, box: { x0: -50, y0: -170, x1: 50, y1: 10 }, foot: 30,
  paint(g, v, rng) {
    const h = 90 + v * 36;
    g.beginPath();
    g.moveTo(-34, 8);
    let x = -34;
    for (let y = 0; y > -h; y -= rng.range(10, 22)) {
      x = -34 * (1 + y / h) + rng.range(-6, 6);
      g.lineTo(x, y);
    }
    g.lineTo(rng.range(-6, 6), -h);
    for (let y = -h; y < 0; y += rng.range(10, 22)) g.lineTo(34 * (1 + y / h) + rng.range(-6, 6), y);
    g.lineTo(34, 8);
    g.closePath();
    g.fillStyle = lin(g, -34, -h, 30, 0, [[0, '#5a5c68'], [0.4, '#2c2c34'], [1, '#0a0a0e']]);
    g.fill();
    g.strokeStyle = 'rgba(150,160,190,0.35)';
    g.lineWidth = 1.2;
    g.stroke();
  },
});
