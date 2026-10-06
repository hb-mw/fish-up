// Red lionfish (Pterois volitans) — maroon-and-white zebra stripes, a crown of 13 long venomous dorsal spines with
// pennant membranes, huge banded fan-like pectorals, fleshy tentacles over the eyes. It hovers; spines and fans sway.
import { profile, paintBody, fin, ridge, caudal, gill, mouthLine, eye, spot, soft, glint, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { spineGroup, pectoralFan, spine } from './lionfish-extra.js';

const P = profile(
  [[0.5, 0.0], [0.49, -0.03], [0.46, -0.062], [0.4, -0.1], [0.3, -0.135], [0.18, -0.15], [0.05, -0.145], [-0.08, -0.125], [-0.2, -0.092], [-0.3, -0.06], [-0.34, -0.052]],
  [[0.5, 0.0], [0.49, 0.036], [0.46, 0.07], [0.4, 0.105], [0.3, 0.14], [0.18, 0.158], [0.05, 0.158], [-0.08, 0.14], [-0.2, 0.106], [-0.3, 0.072], [-0.34, 0.062]],
);
const HINGE = [0.398, 0.062], TIP = [0.498, 0.006], CORNER = [0.42, 0.04];
const COLS = { dark: '#7a2a24', light: '#f2e4cc' };
const SPX = [], SPL = [0.11, 0.19, 0.245, 0.27, 0.27, 0.262, 0.25, 0.235, 0.215, 0.195, 0.175, 0.155, 0.135];
for (let i = 0; i < 13; i++) SPX.push(0.23 - i * 0.0275);
const LEAN = 0.35;

function finSpots(rng, n, x0, y0, x1, y1) {
  return (g) => {
    for (let i = 0; i < n; i++) spot(g, x0 + (x1 - x0) * rng.next(), y0 + (y1 - y0) * rng.next(), 0.003 + 0.0025 * rng.next(), '#5a1e1c', 0.6, 0.55);
  };
}

function paint(g, res, v) {
  const rng = createRng(701 + v * 19);
  const dh = [-6, 0, 8][v];
  const maroon = shift('#7c2b24', dh, 0, 0), maroonDk = shift('#4e1612', dh, 0, 0), cream = '#f2e6d0';
  const soft1 = (gg) => rgba('#e9dcc4', 0.78);
  // ── translucent spotted fins behind the body ──
  const tail = caudal({ P, root: 0.06, up: [-0.46, -0.14], lo: [-0.46, 0.14], notch: [-0.5, 0.0], lead: 0.02, trail: -0.18, sharp: false });
  fin(g, res, {
    pts: tail,
    stops: [[0, rgba('#d8c8b0', 0.9)], [1, rgba('#efe4d2', 0.62)]],
    axis: [-0.33, 0, -0.5, 0],
    rays: { n: 18, to: [3, 7], from: tail.root, col: '#5a2a24', a: 0.4, fade: 0.3, w: 0.0018, curl: 0.04 },
    scallop: { from: 3, to: 7, n: 10, depth: 0.003 },
    paint: finSpots(rng, 40, -0.5, -0.14, -0.33, 0.14),
  });
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: ridge(P, 'top', [[-0.115, -0.012], [-0.13, 0.07], [-0.18, 0.1], [-0.24, 0.095], [-0.29, 0.06], [-0.31, 0.02, 1], [-0.325, -0.012]], 0.25),
    stops: [[0, rgba('#d8c8b0', 0.92)], [1, rgba('#efe4d2', 0.6)]],
    rays: { n: 12, from: [[-0.12, dTop(-0.12)], [-0.32, dTop(-0.32)]], lean: [0.25, 0.9], col: '#5a2a24', a: 0.4, w: 0.0018 },
    scallop: { from: 1, to: 5, n: 8, depth: 0.003 },
    paint: finSpots(rng, 36, -0.33, -0.26, -0.11, -0.05),
    shade: 'rgba(70,20,16,0.35)',
  });
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: ridge(P, 'bot', [[-0.135, -0.012], [-0.15, 0.06], [-0.2, 0.09], [-0.25, 0.085], [-0.29, 0.05], [-0.31, 0.016, 1], [-0.325, -0.012]], 0.3),
    stops: [[0, rgba('#d8c8b0', 0.92)], [1, rgba('#efe4d2', 0.6)]],
    rays: { n: 11, from: [[-0.14, aBot(-0.14)], [-0.32, aBot(-0.32)]], lean: [0.25, 0.9], up: 1, col: '#5a2a24', a: 0.4, w: 0.0018 },
    scallop: { from: 1, to: 5, n: 8, depth: 0.003 },
    paint: finSpots(rng, 30, -0.33, 0.1, -0.12, 0.26),
    shade: 'rgba(70,20,16,0.35)',
  });
  const py = P.bot(0.2);
  fin(g, res, {
    pts: [[0.218, py - 0.012], [0.2, py + 0.06], [0.135, py + 0.15, 1], [0.1, py + 0.1], [0.145, py + 0.03], [0.17, py - 0.012]],
    stops: [[0, rgba(maroonDk, 0.98)], [1, rgba(maroon, 0.92)]],
    rays: { n: 8, to: [1, 3], from: [[0.21, py], [0.175, py]], col: '#2a0c0a', a: 0.4, w: 0.002 },
    paint: (gg) => {
      for (let i = 0; i < 18; i++) spot(gg, 0.1 + 0.11 * rng.next(), py + 0.01 + 0.13 * rng.next(), 0.003 + 0.002 * rng.next(), cream, 0.7, 0.6);
    },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, maroonDk], [0.15, maroon], [0.55, maroon], [0.85, mixc(maroon, cream, 0.35)], [1, mixc(maroon, cream, 0.5)]]);
      // zebra: cream lines every ~0.052, slanting forward at the top, each shadowed by a darker maroon stripe behind
      for (let i = 0; i < 13; i++) {
        const x = 0.33 - i * 0.052;
        const w = i % 3 === 1 ? 0.011 : 0.008;
        U.path([[x + 0.016, 0], [x + 0.016 + w, 0], [x - 0.012 + w, 1], [x - 0.012, 1]], true, true);
        t.fillStyle = rgba(cream, 0.92);
        t.fill();
        U.path([[x + 0.016 - 0.018, 0], [x + 0.016, 0], [x - 0.012, 1], [x - 0.012 - 0.018, 1]], true, true);
        t.fillStyle = rgba(maroonDk, 0.55);
        t.fill();
        if (i % 2) {
          U.path([[x - 0.01, 0.1], [x - 0.006, 0.1], [x - 0.03, 0.95], [x - 0.034, 0.95]], true, true);
          t.fillStyle = rgba(cream, 0.4);
          t.fill();
        }
      }
    },
    over(gg) {
      mottle(gg, -0.35, -0.16, 0.5, 0.17, { color: '#2a0806', a: 0.25, scale: 0.36, lo: 0.45, hi: 0.78, seed: 5 + v });
      mottle(gg, -0.35, -0.16, 0.5, 0.17, { color: '#ffb090', a: 0.12, scale: 0.3, lo: 0.5, hi: 0.8, seed: 12 });
    },
    shade: { dark: '#2a0a08', sheen: 0.3, sheenV: 0.2, sheenW: 0.13, gloss: 0.2, belly: 0.3, bounce: 0.5, rim: 0.36, topLight: 0.12, breakup: 0.5 },
    face(gg) {
      // bands radiating from the eye over cheek and gill cover
      const ex = 0.408, ey = -0.052;
      gg.save();
      gg.strokeStyle = rgba(cream, 0.85);
      gg.lineCap = 'round';
      const rays = [[0.47, 0.03, 0.012], [0.44, 0.09, 0.011], [0.405, 0.11, 0.012], [0.36, 0.1, 0.011], [0.33, 0.04, 0.01], [0.35, -0.095, 0.009]];
      for (const r of rays) {
        gg.lineWidth = r[2];
        gg.beginPath();
        gg.moveTo(ex + (r[0] - ex) * 0.42, ey + (r[1] - ey) * 0.42);
        gg.lineTo(r[0], r[1]);
        gg.stroke();
      }
      gg.restore();
      gill(gg, res, { x: 0.3, y0: -0.1, y1: 0.12, bulge: 0.032, dark: '#3a1210', a: 0.4, shadow: 0.28, plate: 0.12, w: 0.003 });
      // eye tentacle + lip tentacles (fleshy banded flaps)
      spine(gg, 0.42, -0.1, 0.44, -0.155, 0.009, 0.002, cream, maroonDk, 4, res);
      spine(gg, 0.47, 0.02, 0.48, 0.06, 0.004, 0.001, cream, maroonDk, 3, res);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.012, dark: '#2a0c0a', a: 0.65, w: 0.0036, lip: 'rgba(255,230,200,0.3)' });
      eye(gg, ex, ey, 0.025, { iris: '#b8732e', irisDark: '#3a1808', pupil: 0.52, ring: 'rgba(40,10,8,0.45)', rim: 'rgba(255,214,150,0.4)', socket: 0.3 });
      glint(gg, 0.45, -0.075, 0.025, 0.004, 0.25, -0.5);
    },
  });
}

const group = (lo, hi) => {
  const xs = SPX.slice(lo, hi), ls = SPL.slice(lo, hi);
  const xm = xs[Math.floor(xs.length / 2)];
  const Lm = Math.max(...ls);
  return {
    key: 'sp' + lo,
    box: { x0: xs[xs.length - 1] - LEAN * Lm - 0.06, x1: xs[0] + 0.03, y0: P.top(xm) - Lm * 0.96 - 0.03, y1: P.top(xm) + 0.05 },
    pivot: [xm, P.top(xm) + 0.01],
    paint: (g, res) => spineGroup(g, res, P, xs, ls, LEAN, COLS),
    pose: (anim, st, out) => {
      const hk = st.hook || 0;
      out.rot = 0.06 * Math.sin(anim.t * 1.1 + anim.uid + lo * 0.5) + hk * 0.12 * Math.sin(anim.t * 9 + lo);
    },
  };
};

export const def = {
  id: 'lionfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.44, y1: 0.42 },
  mouth: { x: 0.49, y: 0.006 },
  box: { x0: -0.51, x1: 0.51, y0: -0.26, y1: 0.33 },
  paint,
  swim: { swing: 0.03, waves: 1.0, power: 1.6, head: 0.1, squash: 0.015, freq: 0.8, idle: 0.08 },
  parts: [
    {
      key: 'pecF', box: { x0: -0.14, x1: 0.3, y0: -0.3, y1: 0.4 }, pivot: [0.235, 0.04], behind: true,
      paint: (g, res) => pectoralFan(g, res, 0.235, 0.04, -1.25, 1.15, 13, 0.34, COLS, 0.5),
      pose: (anim, st, out) => {
        out.rot = -0.1 * Math.sin(anim.t * 0.9 + anim.uid);
        out.sx = 0.84 + 0.16 * Math.cos(anim.t * 0.9 + anim.uid + 1.2);
      },
    },
    group(0, 5), group(5, 9), group(9, 13),
    {
      key: 'pec', box: { x0: -0.14, x1: 0.3, y0: -0.3, y1: 0.42 }, pivot: [0.25, 0.05],
      paint: (g, res) => pectoralFan(g, res, 0.25, 0.05, -1.05, 1.3, 13, 0.36, COLS, 0),
      pose: (anim, st, out) => {
        const hk = st.hook || 0;
        out.rot = 0.1 * Math.sin(anim.t * 0.9 + anim.uid + 2.5) + hk * 0.1 * Math.sin(anim.t * 8 + anim.uid);
        out.sx = 0.86 + 0.14 * Math.cos(anim.t * 0.9 + anim.uid);
      },
    },
  ],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 8, 0.012), gape: 0.55, cavity: '#2a0a0c', throat: '#8a3038' },
  gillSlit: { x: 0.3, y0: -0.09, y1: 0.11, bulge: 0.032, w: 0.004, rate: 1.8 },
};
