// Wreck debris (toppled mast, anchor, barrel, crate, open treasure chest, cannon) and drop-off wall life
// (black coral, feather stars) plus a cave-mouth recess. Local px, base (0,0), −y up.
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, contactShadow } from './paint.js';

const WOOD = H('#957650');

defType({
  id: 'mast', variants: 1, box: { x0: -16, y0: -150, x1: 404, y1: 12 }, foot: 20,
  paint(g, v, rng) {
    // a toppled mast: foot on the ledge (left), the broken top resting high on the bow (right)
    const ang = Math.atan2(-106, 380);
    g.save();
    g.translate(4, -4);
    g.rotate(ang);
    const L = 396;
    g.fillStyle = lin(g, 0, -8, 0, 8, [[0, lite(WOOD, 0.25)], [0.5, rgbk(WOOD)], [1, rgbk(WOOD, 0.45)]]);
    g.beginPath();
    g.moveTo(0, -9);
    g.lineTo(L, -6);
    g.lineTo(L + 6, -1);
    g.lineTo(L - 2, 2);
    g.lineTo(L + 4, 6);
    g.lineTo(0, 9);
    g.closePath();
    g.fill();
    for (let x = 30; x < L - 20; x += 62) {
      g.fillStyle = 'rgba(40,32,24,0.8)';
      g.fillRect(x, -9, 5, 18); // iron hoops
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = 'rgba(220,212,190,0.6)';
      g.beginPath();
      g.arc(rng.range(10, L), rng.range(-8, 8), rng.range(0.6, 1.4), 0, TAU);
      g.fill();
    }
    g.restore();
    // the yard, still lashed across, and tattered rigging trailing to the ground
    g.strokeStyle = rgbk(WOOD, 0.85);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(170, -120);
    g.lineTo(236, -6);
    g.stroke();
    g.strokeStyle = 'rgba(190,170,130,0.75)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(300, -86);
    g.bezierCurveTo(320, -50, 300, -20, 330, -2);
    g.moveTo(120, -40);
    g.quadraticCurveTo(110, -20, 128, 0);
    g.stroke();
  },
});

defType({
  id: 'anchor', variants: 1, box: { x0: -60, y0: -96, x1: 60, y1: 10 }, foot: 30,
  paint(g) {
    const iron = H('#4a4038');
    contactShadow(g, 0, 50, 6, 0.5);
    g.save();
    g.rotate(-0.5);
    g.strokeStyle = rgbk(iron);
    g.lineCap = 'round';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, -84);
    g.lineTo(0, 0);
    g.moveTo(-40, -26);
    g.quadraticCurveTo(-30, 6, 0, 4);
    g.quadraticCurveTo(30, 6, 40, -26);
    g.moveTo(-24, -70);
    g.lineTo(24, -70);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(160,90,50,0.6)'; // rust streaks
    g.beginPath();
    g.moveTo(-2, -60);
    g.lineTo(-2, -10);
    g.stroke();
    g.fillStyle = rgbk(iron);
    for (const [x, y] of [[-40, -26], [40, -26]]) {
      g.beginPath();
      g.moveTo(x, y - 10);
      g.lineTo(x + (x < 0 ? -8 : 8), y + 4);
      g.lineTo(x + (x < 0 ? 8 : -8), y);
      g.closePath();
      g.fill();
    }
    g.lineWidth = 3;
    g.strokeStyle = rgbk(iron, 1.2);
    g.beginPath();
    g.arc(0, -90, 6, 0, TAU);
    g.stroke();
    g.restore();
  },
});

defType({
  id: 'cask', variants: 2, box: { x0: -22, y0: -28, x1: 22, y1: 8 }, foot: 16,
  paint(g, v) {
    g.save();
    g.rotate(v ? 0.25 : -0.1);
    g.fillStyle = lin(g, 0, -26, 0, 4, [[0, lite(WOOD, 0.25)], [0.5, rgbk(WOOD)], [1, rgbk(WOOD, 0.5)]]);
    g.beginPath();
    g.ellipse(0, -11, 19, 14, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(40,34,28,0.85)';
    g.lineWidth = 2.4;
    for (const x of [-11, 11]) {
      g.beginPath();
      g.ellipse(x, -11, 2.5, 13, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
  },
});

defType({
  id: 'crate', variants: 2, box: { x0: -24, y0: -40, x1: 24, y1: 8 }, foot: 18,
  paint(g, v) {
    g.save();
    g.rotate(v ? -0.18 : 0.08);
    g.fillStyle = lin(g, -20, -36, 20, 4, [[0, lite(WOOD, 0.3)], [1, rgbk(WOOD, 0.55)]]);
    g.fillRect(-19, -34, 38, 36);
    g.strokeStyle = 'rgba(40,32,24,0.7)';
    g.lineWidth = 2;
    g.strokeRect(-19, -34, 38, 36);
    g.beginPath();
    g.moveTo(-19, -34);
    g.lineTo(19, 2);
    g.moveTo(-19, -16);
    g.lineTo(19, -16);
    g.stroke();
    g.restore();
  },
});

/** glint anchors (local px) on the chest's gold */
export const CHEST_GLINTS = [[-8, -26], [6, -30], [14, -20], [-16, -18]];
defType({
  id: 'chest', variants: 1, box: { x0: -36, y0: -56, x1: 36, y1: 8 }, foot: 24,
  paint(g, v, rng) {
    contactShadow(g, 0, 34, 5, 0.55);
    // open lid tilted back
    g.fillStyle = lin(g, 0, -56, 0, -30, [[0, lite(WOOD, 0.2)], [1, rgbk(WOOD, 0.6)]]);
    g.beginPath();
    g.moveTo(-26, -30);
    g.lineTo(-30, -54);
    g.quadraticCurveTo(0, -62, 30, -54);
    g.lineTo(26, -30);
    g.closePath();
    g.fill();
    // heap of gold
    for (let i = 0; i < 60; i++) {
      const x = rng.range(-22, 22), y = -24 - rng.range(0, 10) * (1 - Math.abs(x) / 26);
      g.fillStyle = rad(g, x - 1, y - 1, 0.2, x, y, 3.4, [[0, '#fff2a8'], [0.5, '#e0b040'], [1, '#8a6418']]);
      g.beginPath();
      g.ellipse(x, y, 3.2, 2.2, rng.range(-0.5, 0.5), 0, TAU);
      g.fill();
    }
    // box with iron bands
    g.fillStyle = lin(g, 0, -28, 0, 4, [[0, lite(WOOD, 0.15)], [1, rgbk(WOOD, 0.5)]]);
    g.fillRect(-28, -26, 56, 30);
    g.fillStyle = 'rgba(60,52,44,0.95)';
    for (const x of [-24, -2, 20]) g.fillRect(x, -26, 4, 30);
    g.fillStyle = '#c8a040';
    g.fillRect(-3, -18, 6, 7);
    // a few spilled coins
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#d8a838';
      g.beginPath();
      g.ellipse(rng.range(-34, 34), rng.range(0, 5), 2.6, 1.2, 0, 0, TAU);
      g.fill();
    }
  },
});

defType({
  id: 'cannon', variants: 1, box: { x0: -50, y0: -26, x1: 50, y1: 8 }, foot: 30,
  paint(g) {
    const iron = H('#3e3a36');
    g.rotate(0.12);
    g.fillStyle = lin(g, 0, -20, 0, 2, [[0, lite(iron, 0.3)], [0.5, rgbk(iron)], [1, rgbk(iron, 0.5)]]);
    g.beginPath();
    g.moveTo(-44, -14);
    g.lineTo(38, -10);
    g.lineTo(44, -12);
    g.lineTo(44, 0);
    g.lineTo(38, -2);
    g.lineTo(-44, 2);
    g.quadraticCurveTo(-52, -6, -44, -14);
    g.closePath();
    g.fill();
    g.fillStyle = '#0a0806';
    g.beginPath();
    g.ellipse(44, -6, 2, 4.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(150,90,50,0.45)';
    g.fillRect(-20, -12, 30, 3);
  },
});

// black coral: thin, dark, bushy branches (deep walls)
defType({
  id: 'blackcoral', variants: 2, box: { x0: -60, y0: -130, x1: 60, y1: 6 },
  sway: { amp: 3, freq: 0.6, wave: 0.6, slices: 4 },
  paint(g, v, rng) {
    const C = v ? H('#3a2a2a') : H('#2e3a30');
    const grow = (x, y, a, len, w, d) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      g.strokeStyle = d > 2 ? lite(C, 0.35) : rgbk(C, 1.2);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(ex, ey);
      g.stroke();
      if (d < 5) for (let i = 0; i < 2; i++) grow(ex, ey, a + rng.range(-0.6, 0.6), len * 0.72, w * 0.7, d + 1);
    };
    grow(0, 2, -Math.PI / 2, 34, 3.4, 0);
  },
});

// feather star (crinoid) clinging to the wall
defType({
  id: 'featherstar', variants: 3, box: { x0: -34, y0: -48, x1: 34, y1: 6 },
  sway: { amp: 3, freq: 1.1, wave: 0.9, slices: 3 },
  paint(g, v, rng) {
    const C = [H('#e8c040'), H('#d0503a'), H('#f0f0e0')][v];
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + 0.15 + (i / 13) * (Math.PI - 0.3);
      const L = rng.range(20, 32);
      g.strokeStyle = rgbk(C, rng.range(0.75, 1.1));
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -8);
      g.quadraticCurveTo(Math.cos(a) * L * 0.6, -8 + Math.sin(a) * L * 0.6 - 6, Math.cos(a) * L, -8 + Math.sin(a) * L * 0.7 + 8);
      g.stroke();
      g.strokeStyle = lite(C, 0.4, 0.6);
      g.lineWidth = 0.8;
      g.stroke();
    }
    g.fillStyle = rgbk(C, 0.7);
    g.beginPath();
    g.arc(0, -8, 4, 0, TAU);
    g.fill();
  },
});
