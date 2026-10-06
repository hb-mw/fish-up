// Coconut palms: a ringed, leaning trunk (sways as a slice stack) + separate fronds that rotate about the
// crown and flutter with the wind + a coconut cluster. Painted in local px, base at (0,0).
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, contactShadow } from './paint.js';

// trunk variants: height, lean (px the crown sits right of the base), bow (curvature)
export const PALM_TRUNKS = [
  { h: 250, lean: 70, bow: 34 },
  { h: 214, lean: 96, bow: 44 },
  { h: 178, lean: 40, bow: 22 },
];
const trunkPt = (P, f) => {
  // quadratic: base (0,0) → crown (lean, -h), bowing out to the right
  const x = P.lean * f * f + P.bow * Math.sin(Math.PI * f) * 0.6;
  return [x, -P.h * f];
};
/** Crown position (local px) of trunk variant v. */
export const crownOf = (v) => trunkPt(PALM_TRUNKS[v], 1);

defType({
  id: 'palmtrunk', variants: 3, box: { x0: -30, y0: -262, x1: 130, y1: 10 }, foot: 10, noFade: false,
  sway: { amp: 6, freq: 0.9, wave: 0.4, slices: 8 },
  paint(g, v, rng) {
    const P = PALM_TRUNKS[v];
    const C = H('#8a7458');
    contactShadow(g, 4, 26, 5, 0.35);
    // body: a tapered tube along the curve
    const L = [], R = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const [x, y] = trunkPt(P, f);
      const [x2, y2] = trunkPt(P, Math.min(1, f + 0.01));
      let dx = x2 - x, dy = y2 - y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const w = 10 - 4 * f + (f < 0.08 ? (0.08 - f) * 60 : 0); // flared foot
      L.push([x - dy * w, y + dx * w]);
      R.push([x + dy * w, y - dx * w]);
    }
    g.beginPath();
    L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    g.fillStyle = lin(g, -12, 0, 22, 0, [[0, lite(C, 0.3)], [0.45, rgbk(C)], [1, rgbk(C, 0.55)]]);
    g.fill();
    g.save();
    g.clip();
    // growth rings: little chevrons up the trunk
    for (let i = 1; i < 34; i++) {
      const f = i / 34 + rng.range(-0.004, 0.004);
      const [x, y] = trunkPt(P, f);
      const w = 10 - 4 * f;
      g.strokeStyle = rgbk(C, 0.5, 0.55);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - w - 2, y + 1.5);
      g.quadraticCurveTo(x, y - 2.5, x + w + 2, y + 1.5);
      g.stroke();
      g.strokeStyle = lite(C, 0.45, 0.45);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - w - 2, y - 0.5);
      g.quadraticCurveTo(x - w * 0.3, y - 3.5, x + w * 0.2, y - 2.6);
      g.stroke();
    }
    g.restore();
  },
});

defType({
  id: 'frond', variants: 3, box: { x0: -6, y0: -34, x1: 136, y1: 62 }, noFade: true,
  paint(g, v, rng) {
    const C = [H('#4f8e2e'), H('#5f9a34'), H('#447e2c')][v];
    const L = 124 - v * 10;
    const pt = (f) => [L * f, -18 * Math.sin(f * 1.4) + 44 * f * f * f]; // rises then droops
    // leaflets, back side first (darker), then front
    for (const side of [-1, 1]) {
      for (let i = 2; i < 40; i++) {
        const f = i / 40;
        const [x, y] = pt(f);
        const [x2, y2] = pt(Math.min(1, f + 0.02));
        const ang = Math.atan2(y2 - y, x2 - x);
        const len = (30 * Math.sin(Math.PI * Math.min(1, f * 1.05)) + 6) * rng.range(0.85, 1.1);
        const a = ang + side * (1.15 - f * 0.4) + 0.35; // leaflets sweep back and hang down
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len + len * 0.25;
        g.strokeStyle = side < 0 ? rgbk(C, 0.72) : rgbk(C, 1.05);
        g.lineWidth = 2.6 - f * 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 3, ex, ey);
        g.stroke();
        if (side > 0 && i % 2) {
          g.strokeStyle = lite(C, 0.35, 0.6);
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(x, y - 0.6);
          g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 3.6, ex, ey - 0.6);
          g.stroke();
        }
      }
    }
    // midrib
    g.strokeStyle = lite(H('#9a8a4a'), 0.2);
    g.lineWidth = 2.4;
    g.beginPath();
    for (let i = 0; i <= 30; i++) {
      const [x, y] = pt(i / 30);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  },
});

defType({
  id: 'coconuts', variants: 1, box: { x0: -18, y0: -12, x1: 18, y1: 20 }, noFade: true,
  paint(g) {
    const nuts = [[-7, 4, H('#6a8a2a')], [6, 5, H('#7a5a2a')], [0, 10, H('#5a7a26')], [-1, 0, H('#8a6a32')]];
    for (const [x, y, c] of nuts) {
      g.fillStyle = rad(g, x - 2, y - 2, 0.5, x, y, 7, [[0, lite(c, 0.35)], [0.6, rgbk(c)], [1, rgbk(c, 0.5)]]);
      g.beginPath();
      g.arc(x, y, 6.5, 0, TAU);
      g.fill();
    }
  },
});

// beach grass tuft (sways with the wind)
defType({
  id: 'beachgrass', variants: 3, box: { x0: -26, y0: -46, x1: 26, y1: 6 },
  sway: { amp: 5, freq: 1.6, wave: 0.8, slices: 3 },
  paint(g, v, rng) {
    const C = [H('#8aa848'), H('#a8b458'), H('#7a9a40')][v];
    for (let i = 0; i < 16; i++) {
      const x = rng.range(-10, 10), h = rng.range(18, 42), lean = rng.range(-14, 14);
      g.strokeStyle = rng.chance(0.5) ? rgbk(C, rng.range(0.7, 1.1)) : lite(C, 0.25);
      g.lineWidth = rng.range(1, 1.8);
      g.beginPath();
      g.moveTo(x, 3);
      g.quadraticCurveTo(x + lean * 0.2, 3 - h * 0.6, x + lean, 3 - h);
      g.stroke();
    }
  },
});
