// Abyssal-plain painters: manganese nodules, glass sponges (Venus' flower basket), sea pens, stalked crinoids
// (sea lilies) and brittle stars. Local px, base (0,0), −y up.
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, contactShadow } from './paint.js';

defType({
  id: 'nodules', variants: 3, box: { x0: -40, y0: -16, x1: 40, y1: 6 },
  paint(g, v, rng) {
    const n = 5 + v * 3;
    for (let i = 0; i < n; i++) {
      const x = rng.range(-32, 32), r = rng.range(3, 8);
      const y = -r * 0.45 + 2;
      g.fillStyle = rad(g, x - r * 0.35, y - r * 0.5, 0.5, x, y, r * 1.1, [[0, '#7a6a5a'], [0.5, '#3a3028'], [1, '#14100c']]);
      g.beginPath();
      g.ellipse(x, y, r * 1.15, r * 0.8, rng.range(-0.3, 0.3), 0, TAU);
      g.fill();
      // botryoidal bumps
      g.fillStyle = 'rgba(160,140,120,0.35)';
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x + rng.range(-r * 0.6, r * 0.6), y - rng.range(0, r * 0.5), r * 0.22, 0, TAU);
        g.fill();
      }
    }
  },
});

defType({
  id: 'glasssponge', variants: 3, box: { x0: -30, y0: -136, x1: 30, y1: 6 },
  paint(g, v, rng) {
    const h = 96 + v * 16, r0 = 7, r1 = 15 + v * 2;
    contactShadow(g, 0, 18, 4, 0.4);
    // root tuft of glassy spicules
    g.strokeStyle = 'rgba(220,236,240,0.55)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.moveTo(rng.range(-4, 4), 0);
      g.lineTo(rng.range(-14, 14), rng.range(2, 6));
      g.stroke();
    }
    const half = (f) => r0 + (r1 - r0) * Math.sin(f * Math.PI * 0.55) + Math.sin(f * 9) * 0.6;
    g.beginPath();
    for (let i = 0; i <= 20; i++) g.lineTo(-half(i / 20) + Math.sin(i * 0.3) * 1.5, -(i / 20) * h);
    for (let i = 20; i >= 0; i--) g.lineTo(half(i / 20) + Math.sin(i * 0.3) * 1.5, -(i / 20) * h);
    g.closePath();
    g.fillStyle = lin(g, -r1, 0, r1, 0, [[0, 'rgba(200,232,236,0.42)'], [0.4, 'rgba(236,248,250,0.62)'], [1, 'rgba(150,190,200,0.3)']]);
    g.fill();
    g.save();
    g.clip();
    // the lattice: vertical + horizontal + diagonal threads
    g.strokeStyle = 'rgba(250,255,255,0.55)';
    g.lineWidth = 0.8;
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      for (let k = 0; k <= 20; k++) g.lineTo((i / 6) * half(k / 20) + Math.sin(k * 0.3) * 1.5, -(k / 20) * h);
      g.stroke();
    }
    for (let y = -4; y > -h; y -= 7) {
      g.beginPath();
      g.ellipse(0, y, half(-y / h), 2.4, 0, 0, Math.PI);
      g.stroke();
    }
    g.strokeStyle = 'rgba(250,255,255,0.25)';
    for (let k = -h; k < h; k += 9) {
      g.beginPath();
      g.moveTo(-r1, k);
      g.lineTo(r1, k - r1 * 2);
      g.stroke();
    }
    g.restore();
    // sieve plate at the top
    g.strokeStyle = 'rgba(244,252,252,0.8)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(Math.sin(6) * 1.5, -h, half(1), 3, 0, 0, TAU);
    g.stroke();
  },
});

defType({
  id: 'seapen', variants: 3, box: { x0: -18, y0: -86, x1: 18, y1: 6 },
  sway: { amp: 5, freq: 0.7, wave: 0.6, slices: 4 },
  paint(g, v, rng) {
    const C = [H('#e8a4c0'), H('#f0c890'), H('#c0d0f0')][v];
    const h = rng.range(60, 76);
    g.strokeStyle = rgbk(C, 0.7);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 4);
    g.lineTo(0, -h);
    g.stroke();
    // feather: paired leaves (polyp leaves) along the upper rachis
    for (let i = 0; i < 18; i++) {
      const f = i / 18;
      const y = -h * 0.25 - f * h * 0.72;
      const L = 12 * Math.sin(Math.PI * Math.min(1, f * 1.1 + 0.1));
      for (const sd of [-1, 1]) {
        g.fillStyle = sd < 0 ? rgbk(C, 0.75) : lite(C, 0.2);
        g.beginPath();
        g.ellipse(sd * L * 0.55, y + L * 0.18, L * 0.55, 2, sd * -0.35, 0, TAU);
        g.fill();
      }
    }
  },
});

defType({
  id: 'crinoid', variants: 3, box: { x0: -40, y0: -170, x1: 40, y1: 6 },
  sway: { amp: 7, freq: 0.5, wave: 0.9, slices: 6 },
  paint(g, v, rng) {
    const C = [H('#d8c8a0'), H('#c87a58'), H('#e0d8d0')][v];
    const h = rng.range(118, 142);
    // jointed stalk with whorls of cirri
    g.strokeStyle = rgbk(C, 0.75);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, 4);
    g.bezierCurveTo(3, -h * 0.4, -4, -h * 0.7, 0, -h);
    g.stroke();
    for (let y = -10; y > -h + 8; y -= 12) {
      g.strokeStyle = rgbk(C, 0.6, 0.8);
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(-5, y + 3);
      g.lineTo(0, y);
      g.lineTo(5, y + 3);
      g.stroke();
    }
    // crown: feathery arms curling like an upturned hand
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 9 - 0.5) * 2.4;
      const pts = [];
      let x = 0, y = -h, ang = a;
      for (let s = 0; s < 8; s++) {
        pts.push([x, y]);
        ang += 0.14 * Math.sign(Math.cos(a) || 1);
        x += Math.cos(ang) * 4.2;
        y += Math.sin(ang) * 4.2;
      }
      g.strokeStyle = rgbk(C, 1.05);
      g.lineWidth = 1.6;
      g.beginPath();
      pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.stroke();
      g.strokeStyle = lite(C, 0.3, 0.8);
      g.lineWidth = 0.7;
      for (const [px, py] of pts) {
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + rng.range(-3, 3), py - rng.range(1, 4));
        g.stroke();
      }
    }
  },
});

defType({
  id: 'brittlestar', variants: 2, box: { x0: -22, y0: -10, x1: 22, y1: 4 },
  paint(g, v, rng) {
    const C = v ? H('#c8a088') : H('#a89cb8');
    g.save();
    g.translate(0, -2);
    g.scale(1, 0.45);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rng.range(-0.2, 0.2);
      g.strokeStyle = rgbk(C);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(a + 0.4) * 10, Math.sin(a + 0.4) * 10, Math.cos(a + 0.1) * 20, Math.sin(a + 0.1) * 20);
      g.stroke();
    }
    g.fillStyle = lite(C, 0.2);
    g.beginPath();
    g.arc(0, 0, 4.5, 0, TAU);
    g.fill();
    g.restore();
  },
});
