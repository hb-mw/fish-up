// Goliath grouper (Epinephelus itajara) — a massive, robust, mottled olive-brown grouper with a broad flat head,
// small eyes, a cavernous mouth, small dark spots everywhere and faint oblique bars; rounded fins.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, speckle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.03], [0.49, 0.004], [0.46, -0.032], [0.4, -0.072], [0.3, -0.108], [0.18, -0.136], [0.05, -0.145], [-0.08, -0.136], [-0.2, -0.108], [-0.3, -0.078], [-0.36, -0.062]],
  [[0.5, 0.03], [0.49, 0.064], [0.46, 0.096], [0.4, 0.124], [0.3, 0.146], [0.18, 0.16], [0.05, 0.163], [-0.08, 0.15], [-0.2, 0.12], [-0.3, 0.087], [-0.36, 0.066]],
);
const HINGE = [0.345, 0.098], TIP = [0.497, 0.036], CORNER = [0.372, 0.078];
const PEC = [0.245, 0.062];

function spotsOn(g, rng, n, x0, y0, x1, y1, r0, r1, col, a) {
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * rng.next(), y = y0 + (y1 - y0) * rng.next();
    const r = r0 + (r1 - r0) * rng.next();
    spot(g, x, y, r, col, a * (0.6 + 0.4 * rng.next()), 0.6, r * (0.8 + 0.3 * rng.next()));
  }
}

function paint(g, res, v) {
  const rng = createRng(501 + v * 23);
  const dh = [-6, 0, 6][v];
  const base = shift('#7d6b42', dh, 0, [0.02, 0, -0.02][v]), back = shift('#5a4c2c', dh, 0, 0);
  const belly = shift('#c7b58e', dh, -0.05, 0);
  const finCol = mixc(base, '#4a3c22', 0.4), finTip = mixc(base, '#2e2616', 0.55);
  const spotCol = '#2a2012';
  const finPaint = (sp) => (gg) => spotsOn(gg, rng, sp, -0.5, -0.25, 0.3, 0.28, 0.003, 0.0055, spotCol, 0.45);

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.08, up: [-0.455, -0.15], lo: [-0.455, 0.152], notch: [-0.5, 0.004], lead: 0.02, trail: -0.2, sharp: false });
  fin(g, res, {
    pts: tail,
    stops: [[0, finCol], [0.55, finCol], [1, finTip]],
    axis: [-0.34, 0, -0.5, 0],
    rays: { n: 20, to: [3, 7], from: tail.root, col: '#1e180c', a: 0.32, fade: 0.3, w: 0.0018, curl: 0.05, hl: '#e8d8a8', hla: 0.1 },
    scallop: { from: 3, to: 7, n: 13, depth: 0.003 },
    margin: { col: 'rgba(240,226,190,0.3)', w: 0.004, from: 3, to: 7 },
    paint: finPaint(60),
    mottle: { color: '#1e180c', a: 0.2, scale: 0.3, lo: 0.45, hi: 0.8, seed: 3 },
  });
  // dorsal: 11 low spines, deeply notched membrane, then a tall rounded soft dorsal
  const sp = spines(0.22, -0.035, 11, lerpArr([0.022, 0.034, 0.04, 0.04, 0.038, 0.036, 0.034, 0.033, 0.032, 0.032, 0.034]), 0.45);
  sp.pop();
  const dorsal = ridge(P, 'top', [...sp, [-0.06, 0.045], [-0.11, 0.07], [-0.17, 0.078], [-0.225, 0.068], [-0.262, 0.04], [-0.275, 0.012], [-0.27, -0.012]], 0.3);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal,
    stops: [[0, rgba(finCol, 0.98)], [1, rgba(finTip, 0.95)]],
    axis: [0.0, -0.14, -0.1, -0.23],
    rays: [
      { n: 10, from: [[0.2047, dTop(0.2047)], [-0.0197, dTop(-0.0197)]], lean: 0.45, col: '#1e180c', a: 0.5, fade: 0.2, w: 0.003, jitter: 0.15 },
      { n: 15, from: [[-0.045, dTop(-0.045)], [-0.268, dTop(-0.268)]], lean: [0.35, 1.1], col: '#1e180c', a: 0.3, w: 0.0016, hl: '#e8d8a8', hla: 0.1 },
    ],
    scallop: { from: dorsal.length - 7, to: dorsal.length - 2, n: 9, depth: 0.0025 },
    paint: finPaint(50),
    shade: 'rgba(30,24,12,0.35)',
    tension: 0.7,
  });
  const anal = ridge(P, 'bot', [[-0.125, -0.012], [-0.142, 0.04, 1], [-0.18, 0.062], [-0.225, 0.056], [-0.255, 0.03], [-0.268, -0.012]], 0.35);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal,
    stops: [[0, rgba(finCol, 0.98)], [1, rgba(finTip, 0.95)]],
    rays: { n: 11, from: [[-0.135, aBot(-0.135)], [-0.262, aBot(-0.262)]], lean: [0.3, 1.0], up: 1, col: '#1e180c', a: 0.32, w: 0.0016, hl: '#e8d8a8', hla: 0.1 },
    scallop: { from: 1, to: 4, n: 8, depth: 0.0025 },
    paint: finPaint(24),
    shade: 'rgba(30,24,12,0.3)',
  });
  const py = P.bot(0.19);
  fin(g, res, {
    pts: [[0.21, py - 0.014], [0.19, py + 0.035], [0.14, py + 0.072], [0.11, py + 0.06, 1], [0.135, py + 0.02], [0.16, py - 0.014]],
    stops: [[0, rgba(finCol, 0.98)], [1, rgba(finTip, 0.95)]],
    rays: { n: 8, to: [1, 4], from: [[0.2, py], [0.165, py]], col: '#1e180c', a: 0.3, w: 0.0016 },
    paint: finPaint(12),
    shade: 'rgba(30,24,12,0.3)',
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.035,
    skin(t, U) {
      U.grad([[0, dark(back, 0.3)], [0.08, back], [0.3, mixc(back, base, 0.6)], [0.5, base], [0.72, mixc(base, belly, 0.55)], [0.9, belly], [1, lite(belly, 0.2)]]);
      // 5 faint oblique bars leaning forward from the back
      soft(t, U.H * 0.05, rgba(back, 0.5), () => {
        for (let i = 0; i < 5; i++) {
          const x = 0.2 - i * 0.12;
          U.path([[x + 0.02, 0.0], [x + 0.06, 0.0], [x + 0.01, 0.85], [x - 0.04, 0.85]], true, true);
          t.fill();
        }
      });
      // paler saddles between the bars
      soft(t, U.H * 0.08, rgba(belly, 0.25), () => {
        for (let i = 0; i < 5; i++) {
          const x = 0.14 - i * 0.12;
          U.path([[x + 0.02, 0.05], [x + 0.05, 0.05], [x + 0.0, 0.6], [x - 0.03, 0.6]], true, true);
          t.fill();
        }
      });
    },
    over(gg) {
      mottle(gg, -0.37, -0.15, 0.5, 0.17, { color: '#2e2616', a: 0.3, scale: 0.42, lo: 0.42, hi: 0.72, seed: 4 + v });
      mottle(gg, -0.37, -0.15, 0.5, 0.17, { color: '#d9c89a', a: 0.22, scale: 0.3, lo: 0.5, hi: 0.8, seed: 9 + v });
      scales(gg, res, P, { rows: 24, x0: -0.33, x1: 0.28, xFade: (x) => Math.min(1, (0.28 - x) / 0.03), dark: '#2a2012', da: 0.2, la: 0.12, rng });
      // small dark spots over head and body
      spotsOn(gg, rng, 150, -0.34, -0.14, 0.49, 0.16, 0.0028, 0.0055, spotCol, 0.55);
      spotsOn(gg, rng, 60, 0.27, -0.1, 0.49, 0.12, 0.002, 0.0045, spotCol, 0.5);
    },
    shade: { dark: '#1e1608', sheen: 0.3, sheenV: 0.2, sheenW: 0.13, gloss: 0.18, belly: 0.3, bounce: 0.55, rim: 0.34, topLight: 0.12, breakup: 0.5 },
    face(gg) {
      gill(gg, res, { x: 0.33, y0: -0.05, y1: 0.09, bulge: 0.018, dark: '#2a2012', a: 0.2, shadow: 0.16, la: 0.1, w: 0.0024 });
      gill(gg, res, { x: 0.272, y0: -0.11, y1: 0.135, bulge: 0.034, dark: '#2a2012', a: 0.45, shadow: 0.3, plate: 0.16, w: 0.003 });
      // heavy brow and lips
      soft(gg, 0.012, 'rgba(30,22,8,0.4)', () => {
        gg.beginPath();
        gg.ellipse(0.4, -0.085, 0.07, 0.014, -0.25, 0, 7);
        gg.fill();
      });
      spot(gg, 0.455, -0.03, 0.005, '#1e1608', 0.7, 0.5);
      spot(gg, 0.44, -0.04, 0.0035, '#1e1608', 0.5, 0.5);
      // darker crown, cheek plates
      soft(gg, 0.03, 'rgba(40,30,12,0.35)', () => {
        gg.beginPath();
        gg.ellipse(0.4, -0.1, 0.12, 0.03, 0.15, 0, 7);
        gg.fill();
      });
      soft(gg, 0.006, 'rgba(30,22,8,0.25)', () => {
        gg.beginPath();
        gg.moveTo(0.37, -0.03);
        gg.quadraticCurveTo(0.33, 0.03, 0.34, 0.085);
        gg.lineWidth = 0.004;
        gg.stroke();
      });
      scales(gg, res, P, { rows: 14, v0: 0.3, v1: 0.9, x0: 0.28, x1: 0.42, dark: '#2a2012', da: 0.14, la: 0.08, rng, xFade: (x) => Math.min(1, (0.42 - x) / 0.04) });
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.022, dark: '#1a1008', a: 0.7, w: 0.005, lip: 'rgba(230,210,170,0.3)' });
      // thick lower lip
      soft(gg, 0.004, rgba(mixc(base, '#ffffff', 0.25), 0.45), () => {
        gg.beginPath();
        gg.moveTo(0.492, 0.052);
        gg.quadraticCurveTo(0.44, 0.085, 0.378, 0.092);
        gg.lineWidth = 0.009;
        gg.stroke();
      });
      eye(gg, 0.385, -0.062, 0.015, { iris: '#b48a3a', irisDark: '#4a2e10', pupil: 0.55, ring: 'rgba(20,16,8,0.45)', rim: 'rgba(240,200,120,0.4)', socket: 0.3 });
      glint(gg, 0.44, -0.062, 0.03, 0.005, 0.22, -0.4);
    },
  });
}

function paintPec(g, res) {
  const rng = createRng(77);
  fin(g, res, {
    pts: [[0.258, 0.036], [0.2, 0.03], [0.13, 0.065], [0.098, 0.112, 1], [0.125, 0.14], [0.2, 0.128], [0.252, 0.092]],
    stops: [[0, rgba('#6e5c36', 0.98)], [1, rgba('#3e3218', 0.95)]],
    axis: [0.25, 0.06, 0.11, 0.12],
    rays: { n: 16, to: [2, 5], from: [[0.256, 0.042], [0.254, 0.086]], col: '#1e180c', a: 0.32, w: 0.0016, hl: '#e8d8a8', hla: 0.1 },
    scallop: { from: 2, to: 5, n: 8, depth: 0.0025 },
    paint: (gg) => spotsOn(gg, rng, 26, 0.1, 0.03, 0.26, 0.14, 0.003, 0.005, '#2a2012', 0.45),
    outline: { col: 'rgba(30,24,12,0.3)', w: 0.0016 },
  });
  erase(g, 0.262, 0.06, 0.022, 0.9, 0.25, 0.03);
}

export const def = {
  id: 'goliath_grouper',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.235, y1: 0.245 },
  mouth: { x: 0.49, y: 0.04 },
  paint,
  swim: { swing: 0.055, waves: 1.0, power: 1.6, head: 0.1, squash: 0.025, freq: 0.8, idle: 0.05 },
  parts: [{ key: 'pec', box: { x0: 0.08, x1: 0.28, y0: 0.02, y1: 0.16 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.12, amp: 0.3, rate: 1.7, fold: 0.2, squash: 0.3 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 10, 0.014), gape: 0.62, cavity: '#2a0c10', throat: '#8a3a3a' },
  gillSlit: { x: 0.272, y0: -0.1, y1: 0.125, bulge: 0.034, w: 0.005, rate: 1.6 },
};
