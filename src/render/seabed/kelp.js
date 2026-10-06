// Kelp-forest painters: giant kelp (holdfast, stipes, gas bladders, ruffled golden blades) in three heights,
// a hazy far variant, rounded boulders and plumose anemones. Local px, base (0,0), −y up.
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, blobPath, contactShadow, ribbon } from './paint.js';

export const KELP_H = [420, 640, 880];

function paintKelp(g, v, rng, Hh) {
  const pal = v % 2 ? [H('#8c7a2c'), H('#c8b25a'), H('#5e5020')] : [H('#7e7a2e'), H('#bcb45e'), H('#545020')];
  // holdfast: a tangle of root claws
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + rng.range(0.15, Math.PI - 0.15);
    const L = rng.range(8, 18);
    g.strokeStyle = rgbk(pal[2], rng.range(0.8, 1.2));
    g.lineWidth = rng.range(1.6, 3);
    g.beginPath();
    g.moveTo(rng.range(-3, 3), -6);
    g.quadraticCurveTo(Math.cos(a) * L * 0.5, -6 - Math.sin(a) * -2, Math.cos(a) * L, 3 + rng.range(-2, 3));
    g.stroke();
  }
  const nSt = rng.int(2, 3);
  for (let s = 0; s < nSt; s++) {
    const top = Hh * rng.range(0.82, 1);
    const sway = rng.range(-14, 14);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      pts.push([sway * f * f + Math.sin(f * 7 + s * 2) * 4 + (s - 1) * 3, -6 - top * f]);
    }
    // blades + bladders along the stipe, alternating sides
    let side = rng.sign();
    for (let i = 3; i < pts.length; i += rng.int(1, 2)) {
      const f = i / 40;
      const [x, y] = pts[i];
      side = -side;
      const len = rng.range(34, 62) * (f > 0.9 ? 0.6 : 1);
      const wid = rng.range(5, 8.5) * (f > 0.9 ? 0.7 : 1);
      const ang = -Math.PI / 2 + side * rng.range(0.55, 1.05);
      const bp = [], bw = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        bp.push([x + side * 5 + Math.cos(ang) * len * t + Math.sin(t * 9 + i) * 2.2 * t, y - 4 + Math.sin(ang) * len * t + len * 0.25 * t * t]);
        bw.push(wid * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.25));
      }
      ribbon(g, bp, bw);
      const shade = rng.range(0.8, 1.15);
      g.fillStyle = lin(g, x, y, bp[10][0], bp[10][1], [[0, rgbk(pal[0], 0.85 * shade, 0.95)], [0.5, rgbk(pal[1], shade, 0.9)], [1, rgbk(pal[0], shade, 0.8)]]);
      g.fill();
      // ruffled edge + midrib
      g.strokeStyle = rgbk(pal[2], 1, 0.35);
      g.lineWidth = 0.8;
      g.stroke();
      g.beginPath();
      bp.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = lite(pal[1], 0.35, 0.45);
      g.lineWidth = 1;
      g.stroke();
      // gas bladder (pneumatocyst)
      const bx = x + side * 4.5, by = y - 3;
      g.fillStyle = rad(g, bx - 1.2, by - 1.5, 0.3, bx, by, 4.5, [[0, lite(pal[1], 0.5)], [0.6, rgbk(pal[1], 0.95)], [1, rgbk(pal[0], 0.7)]]);
      g.beginPath();
      g.ellipse(bx, by, 3.2, 4.4, side * 0.4, 0, TAU);
      g.fill();
    }
    // the stipe over the blade roots
    g.strokeStyle = rgbk(pal[2], 1.25);
    g.lineWidth = 2.4;
    g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
  }
}

KELP_H.forEach((Hh, hi) => {
  defType({
    id: 'kelp' + hi, variants: 2, box: { x0: -80, y0: -Hh - 40, x1: 80, y1: 8 }, foot: 8,
    sway: { amp: 16 + hi * 9, freq: 0.62, wave: 2.6 + hi * 0.6, slices: 10 + hi * 5 },
    paint(g, v, rng) {
      paintKelp(g, v, rng, Hh);
    },
  });
});

// far, hazy kelp: a flattened silhouette tone so it reads as forest receding into the water
defType({
  id: 'kelpfar', variants: 3, box: { x0: -80, y0: -720, x1: 80, y1: 8 }, foot: 8,
  sway: { amp: 18, freq: 0.5, wave: 2.6, slices: 12 },
  paint(g, v, rng) {
    paintKelp(g, v, rng, 680);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(34,70,64,0.78)';
    g.fillRect(-100, -760, 200, 780);
    g.globalCompositeOperation = 'source-over';
  },
});

// rounded boulder with a turf of red algae and coralline crust
defType({
  id: 'boulder', variants: 4, box: { x0: -74, y0: -84, x1: 74, y1: 12 },
  paint(g, v, rng) {
    const C = [H('#8e877a'), H('#7c766c'), H('#968a78'), H('#857e74')][v];
    contactShadow(g, 0, 70, 9, 0.5);
    const rx = 52 + v * 5, ry = 40 + v * 6;
    blobPath(g, 0, 8 - ry * 0.75, rx, ry, 10, 0.12, rng);
    g.fillStyle = rad(g, -rx * 0.35, -ry * 1.1, 4, 0, -ry * 0.5, rx * 1.15, [[0, lite(C, 0.32)], [0.55, rgbk(C)], [1, rgbk(C, 0.42)]]);
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rng.chance(0.5) ? lite(C, 0.3, 0.35) : rgbk(C, 0.6, 0.35);
      g.beginPath();
      g.arc(rng.range(-rx, rx), rng.range(-ry * 1.7, 8), rng.range(1, 3.5), 0, TAU);
      g.fill();
    }
    // coralline crust patches and red turf on top
    for (let i = 0; i < 9; i++) {
      const x = rng.range(-rx * 0.8, rx * 0.8), y = -ry * 1.45 + rng.range(0, ry * 0.9);
      blobPath(g, x, y, rng.range(6, 14), rng.range(3, 7), 7, 0.3, rng);
      g.fillStyle = rng.pick(['rgba(214,126,152,0.85)', 'rgba(178,64,74,0.8)', 'rgba(150,110,170,0.7)', 'rgba(120,130,60,0.75)']);
      g.fill();
    }
    g.fillStyle = lin(g, 0, -10, 0, 10, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
    g.fillRect(-rx, -10, rx * 2, 22);
    g.restore();
    // red algae fringe along the top
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + 0.35 + (i / 25) * (Math.PI - 0.7);
      const x = Math.cos(a) * rx * 0.95, y = 8 - ry * 0.75 + Math.sin(a) * ry * 0.95;
      g.strokeStyle = rng.pick(['#9a3a3a', '#b8504a', '#7a8a3a']);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(-3, 3), y - rng.range(3, 8));
      g.stroke();
    }
  },
});

// plumose anemone (Metridium): tall column, a fluffy crown
defType({
  id: 'plumose', variants: 3, box: { x0: -28, y0: -96, x1: 28, y1: 6 },
  sway: { amp: 4, freq: 0.9, wave: 0.8, slices: 4 },
  paint(g, v, rng) {
    const C = [H('#f2ece0'), H('#f2a860'), H('#e8c8c0')][v];
    contactShadow(g, 0, 16, 4, 0.4);
    const h = rng.range(54, 70);
    g.beginPath();
    g.moveTo(-8, 4);
    g.bezierCurveTo(-10, -h * 0.4, -6, -h * 0.7, -10, -h);
    g.lineTo(10, -h);
    g.bezierCurveTo(6, -h * 0.7, 10, -h * 0.4, 8, 4);
    g.closePath();
    g.fillStyle = lin(g, -10, 0, 10, 0, [[0, lite(C, 0.3)], [0.5, rgbk(C, 0.95)], [1, rgbk(C, 0.6)]]);
    g.fill();
    // fluffy crown: many tiny tentacle lobes
    for (let i = 0; i < 70; i++) {
      const a = Math.PI + rng.range(0, Math.PI);
      const r = rng.range(4, 20);
      const x = Math.cos(a) * r * 1.2, y = -h - 4 + Math.sin(a) * r * 0.9;
      g.fillStyle = rad(g, x - 1, y - 1, 0.2, x, y, 4, [[0, lite(C, 0.5, 0.95)], [1, rgbk(C, 0.75, 0.9)]]);
      g.beginPath();
      g.arc(x, y, rng.range(2, 3.6), 0, TAU);
      g.fill();
    }
  },
});
