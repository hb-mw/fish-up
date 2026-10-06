// Great barracuda (Sphyraena barracuda) — a long silver pike: pointed head, jutting lower jaw with fangs that show
// even at rest, two small widely separated dorsals, dark forked tail with white tips, faint oblique bars high on
// the flank and inky blotches low on the rear flank.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { uvMottle } from './tuna-extra.js';

// the lower jaw juts 0.016 past the upper jaw: the top contour folds down over the mouth line beyond x = 0.5
const P = profile(
  [[0.516, 0.02], [0.506, 0.016], [0.5, 0.01], [0.49, -0.004], [0.46, -0.022], [0.41, -0.04], [0.34, -0.054], [0.24, -0.064], [0.1, -0.068], [-0.06, -0.064], [-0.2, -0.052], [-0.3, -0.036], [-0.36, -0.022], [-0.39, -0.014]],
  [[0.516, 0.02], [0.506, 0.03], [0.49, 0.036], [0.46, 0.044], [0.41, 0.054], [0.34, 0.063], [0.24, 0.07], [0.1, 0.072], [-0.06, 0.068], [-0.2, 0.056], [-0.3, 0.04], [-0.36, 0.024], [-0.39, 0.014]],
);
// the lower jaw juts past the upper: the hinge sits far back under the eye
const HINGE = [0.37, 0.04], TIP = [0.514, 0.019], CORNER = [0.412, 0.034];
const PEC = [0.25, 0.02];

/** Fangs along a jaw line: alternating long and short teeth. */
function teeth(g, res, x0, y0, x1, y1, n, len, down, col = '#f4f1ea') {
  g.save();
  g.fillStyle = col;
  for (let i = 0; i <= n; i++) {
    const q = i / n, x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q;
    const L = len * (i % 3 === 0 ? 1 : 0.5) * (0.7 + 0.3 * Math.sin(q * 7));
    g.beginPath();
    g.moveTo(x - L * 0.22, y);
    g.lineTo(x + L * 0.1, y + down * L);
    g.lineTo(x + L * 0.26, y);
    g.closePath();
    g.fill();
  }
  g.restore();
}

function paint(g, res, v) {
  const rng = createRng(701 + v * 13);
  const dh = [-6, 0, 6][v];
  const backC = shift('#2e4a52', dh, 0, 0), steel = shift('#4e6e78', dh, 0, 0);
  const silver = '#c9d3d8', belly = '#f1f4f5';
  const finDk = '#28323e';

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.07, up: [-0.5, -0.14], lo: [-0.5, 0.14], notch: [-0.415, 0], lead: 0.06, trail: 0.02 });
  fin(g, res, {
    pts: tail,
    stops: [[0, '#3a4654'], [0.55, finDk], [0.88, '#303a48'], [1, rgba('#e8ecee', 0.9)]],
    axis: [-0.35, 0, -0.5, 0],
    rays: { n: 24, to: [3, 7], from: tail.root, col: '#070a10', a: 0.4, fade: 0.3, w: 0.0014, curl: 0.03, hl: '#a8b4c0', hla: 0.1 },
    scallop: { from: 3, to: 7, n: 9, depth: 0.0025 },
    edge: { col: 'rgba(5,8,16,0.4)', w: 0.0026, to: 3 },
  });
  // first dorsal (5 spines) far back over the pelvics; second dorsal over the anal
  const d1 = ridge(P, 'top', spines(0.06, -0.03, 5, lerpArr([0.04, 0.052, 0.045, 0.036, 0.026]), 0.2), 0.3);
  fin(g, res, { pts: d1, stops: [[0, rgba('#5a6e78', 0.95)], [1, rgba('#a8b8c0', 0.8)]], rays: { n: 5, from: [[0.05, P.top(0.05) + 0.008], [-0.022, P.top(-0.022) + 0.008]], lean: [0.3, 0.9], col: '#0a1420', a: 0.45, w: 0.0016 }, edge: { col: 'rgba(10,20,32,0.35)', w: 0.002, to: 1 }, tension: 0.6 });
  const d2 = ridge(P, 'top', [[-0.205, -0.01], [-0.215, 0.034], [-0.235, 0.05, 1], [-0.265, 0.03], [-0.28, 0.012], [-0.29, -0.01]], 0.4);
  fin(g, res, { pts: d2, stops: [[0, finDk], [0.8, '#303a48'], [1, rgba('#e8ecee', 0.9)]], rays: { n: 8, from: [[-0.21, P.top(-0.21) + 0.008], [-0.285, P.top(-0.285) + 0.008]], lean: [0.4, 1.3], col: '#070a10', a: 0.4, w: 0.0014 }, edge: { col: 'rgba(5,8,16,0.35)', w: 0.002, to: 2 } });
  const an = ridge(P, 'bot', [[-0.21, -0.01], [-0.22, 0.032], [-0.24, 0.048, 1], [-0.268, 0.028], [-0.283, 0.012], [-0.293, -0.01]], 0.4);
  fin(g, res, { pts: an, stops: [[0, finDk], [0.8, '#303a48'], [1, rgba('#e8ecee', 0.9)]], rays: { n: 8, from: [[-0.215, P.bot(-0.215) - 0.008], [-0.288, P.bot(-0.288) - 0.008]], lean: [0.4, 1.3], up: 1, col: '#070a10', a: 0.4, w: 0.0014 }, edge: { col: 'rgba(5,8,16,0.35)', w: 0.002, to: 2 } });
  // pelvic under the first dorsal
  const py = P.bot(0.05);
  fin(g, res, {
    pts: [[0.06, py - 0.01], [0.048, py + 0.028], [0.0, py + 0.05, 1], [0.012, py + 0.022], [0.03, py - 0.01]],
    stops: [[0, 'rgba(190,200,205,0.9)'], [1, rgba('#eef2f4', 0.75)]],
    rays: { n: 5, to: [1, 3], from: [[0.056, py - 0.004], [0.034, py - 0.004]], col: '#2a3a44', a: 0.35, w: 0.0013 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.04,
    skin(t, U) {
      U.grad([[0, dark(backC, 0.3)], [0.08, backC], [0.22, steel], [0.36, mixc(steel, silver, 0.6)], [0.48, silver], [0.62, '#dfe5e8'], [0.8, belly], [1, '#ffffff']]);
      U.glow(0.05, 0.33, 0.4, 0.07, '#c8e4f0', 0.26);
      U.glow(-0.1, 0.62, 0.3, 0.05, '#e8d8c8', 0.18);
      // ~20 faint oblique darker bars high on the flank
      soft(t, Math.max(0.6, U.H * 0.02), rgba(dark(backC, 0.3), 0.42), () => {
        t.lineWidth = Math.max(1, U.dx(0.009));
        for (let i = 0; i < 19; i++) {
          const x = 0.24 - i * 0.03 + (rng.next() - 0.5) * 0.006;
          U.path([[x + 0.012, 0.02], [x - 0.012, 0.42 + rng.next() * 0.08]], false, true);
          t.stroke();
        }
      });
      uvMottle(t, U, { color: '#122a30', a: 0.28, scale: 0.4, lo: 0.42, hi: 0.76, seed: 61 + v, v0: 0, v1: 0.4, feather: 0.12 });
      uvMottle(t, U, { color: '#bfe8f4', a: 0.14, scale: 0.3, lo: 0.5, hi: 0.8, seed: 63, v0: 0.4, v1: 0.9, feather: 0.12, sy: 0.6 });
    },
    over(gg) {
      // inky black blotches low on the rear flank
      for (let i = 0; i < 9; i++) {
        const x = -0.34 + rng.next() * 0.36, vv = 0.55 + rng.next() * 0.35;
        const r = 0.005 + rng.next() * 0.009;
        spot(gg, x, P.at(x, vv), r, '#0a1016', 0.85, 0.55, r * (0.6 + 0.5 * rng.next()), (rng.next() - 0.5) * 1.5);
      }
      scales(gg, res, P, { rows: 18, x0: -0.35, x1: 0.26, dark: '#1a2e3a', da: 0.16, la: 0.14, rng, xFade: (x) => Math.min(1, (0.26 - x) / 0.04), glint: { p: 0.12, color: '#ffffff', a: 0.22 } });
      gg.strokeStyle = 'rgba(20,40,50,0.18)';
      gg.lineWidth = Math.max(0.002, 0.6 / res);
      gg.beginPath();
      P.line(gg, (x) => (x > 0.15 ? 0.3 + (0.26 - x) * 0.6 : 0.37 - (0.15 - x) * 0.03), 0.26, -0.37, 40, true);
      gg.stroke();
    },
    shade: { dark: '#0c1c26', sheen: 0.42, sheenV: 0.22, sheenW: 0.1, gloss: 0.42, belly: 0.26, bounce: 0.7, rim: 0.34, topLight: 0.2, breakup: 0.4 },
    face(gg) {
      spot(gg, 0.33, 0.016, 0.07, '#ffffff', 0.3, 0.05, 0.03);
      soft(gg, 0.01, 'rgba(10,30,40,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.19, 0.04, 0.06, 0.012, -0.1, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.3, y0: -0.03, y1: 0.045, bulge: 0.012, dark: '#0e2430', a: 0.16, shadow: 0.12, la: 0.1, w: 0.0018 });
      gill(gg, res, { x: 0.255, y0: -0.058, y1: 0.064, bulge: 0.022, dark: '#0a1c28', a: 0.45, shadow: 0.26, plate: 0.2, w: 0.0022 });
      // a dark line from the snout along the top of the head
      soft(gg, 0.006, 'rgba(20,40,50,0.3)', () => {
        gg.beginPath();
        gg.moveTo(0.49, -0.004);
        gg.quadraticCurveTo(0.44, -0.02, 0.4, -0.03);
        gg.lineWidth = 0.006;
        gg.stroke();
      });
      spot(gg, 0.462, -0.004, 0.0028, '#0a1420', 0.7, 0.5);
      // mouth: upper jaw line + upper fangs; the lower jaw carries its own in jaw.paint
      // gape: from the upper-jaw tip back to below the eye, then along the top of the jutting lower jaw
      mouthLine(gg, res, { tip: [0.5, 0.011], corner: [0.415, 0.034], sag: 0.005, dark: '#0a1420', a: 0.62, w: 0.0026, lip: 'rgba(255,255,255,0.28)' });
      mouthLine(gg, res, { tip: [0.515, 0.019], corner: [0.5, 0.011], sag: 0.0, dark: '#0a1420', a: 0.5, w: 0.0022 });
      teeth(gg, res, 0.492, 0.013, 0.43, 0.032, 8, 0.013, 1);
      eye(gg, 0.39, -0.014, 0.019, { iris: '#c8c8b8', irisDark: '#4a4a3a', pupil: 0.6, ring: 'rgba(10,16,30,0.42)', rim: 'rgba(255,240,200,0.35)', socket: 0.22 });
      glint(gg, 0.45, -0.03, 0.02, 0.003, 0.2, -0.3);
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.258, 0.012], [0.22, 0.014], [0.17, 0.04, 1], [0.2, 0.05], [0.24, 0.04], [0.256, 0.028]],
    stops: [[0, 'rgba(150,160,166,0.9)'], [0.5, 'rgba(190,198,202,0.75)'], [1, 'rgba(225,230,232,0.55)']],
    axis: [0.256, 0.02, 0.17, 0.042],
    rays: { n: 9, to: [2, 4], from: [[0.257, 0.014], [0.255, 0.026]], col: '#1a2a34', a: 0.3, w: 0.0013, hl: '#ffffff', hla: 0.14 },
    edge: { col: 'rgba(20,30,40,0.3)', w: 0.002, to: 2 },
    outline: { col: 'rgba(40,50,60,0.2)', w: 0.0014 },
  });
  erase(g, 0.262, 0.02, 0.014, 0.9, 0.25, 0.017);
}

const JAW = jawPolygon(P, HINGE, TIP, CORNER);
export const def = {
  id: 'barracuda',
  bounds: { x0: -0.5, x1: 0.52, y0: -0.145, y1: 0.145 },
  mouth: { x: 0.505, y: 0.018 },
  paint,
  swim: { swing: 0.04, waves: 1.0, power: 2.8, head: 0.04, squash: 0.03, freq: 1.2, thrash: 1.3, idle: 0.04 },
  parts: [{ key: 'pec', box: { x0: 0.15, x1: 0.28, y0: 0.0, y1: 0.06 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.05, amp: 0.18, rate: 2.4, fold: 0.3 }) }],
  jaw: {
    hinge: HINGE, tip: TIP, corner: CORNER, poly: JAW, gape: 0.42, rest: 0.12, throat: '#6a2630', cavity: '#1a0608',
    paint(g, res) {
      teeth(g, res, 0.506, 0.019, 0.428, 0.034, 8, 0.012, -1);
    },
  },
  gillSlit: { x: 0.255, y0: -0.052, y1: 0.058, bulge: 0.022 },
};
