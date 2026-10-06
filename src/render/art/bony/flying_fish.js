// Atlantic flying fish (Cheilopogon melanurus) — slim iridescent-blue fish with enormous wing-like pectoral fins
// and large pelvic "second wings": folded along the body while swimming, spread wide when it jumps.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { ease } from './rig.js';

const P = profile(
  [[0.5, -0.01], [0.49, -0.03], [0.46, -0.048], [0.38, -0.062], [0.25, -0.07], [0.1, -0.07], [-0.05, -0.064], [-0.2, -0.05], [-0.3, -0.036], [-0.36, -0.028]],
  [[0.5, -0.01], [0.49, 0.013], [0.46, 0.033], [0.38, 0.052], [0.25, 0.066], [0.1, 0.07], [-0.05, 0.066], [-0.2, 0.052], [-0.3, 0.036], [-0.36, 0.028]],
);
const HINGE = [0.45, 0.02], TIP = [0.498, -0.004], CORNER = [0.465, 0.01];
const WING = [0.27, 0.004];
const PELV = [0.0, 0.062];

function paint(g, res, v) {
  const rng = createRng(601 + v * 11);
  const dh = [-8, 0, 8][v];
  const back = shift('#143a7a', dh, 0.05, 0), blue = shift('#2a72d0', dh, 0.05, 0);
  const finCol = '#5a7390';
  const tail = caudal({ P, root: 0.05, up: [-0.465, -0.1], lo: [-0.5, 0.15], notch: [-0.4, 0.012], lead: 0.03, trail: 0.1 });
  fin(g, res, {
    pts: tail,
    stops: [[0, rgba('#6f8196', 0.95)], [0.6, rgba(finCol, 0.85)], [1, rgba('#2f4258', 0.85)]],
    axis: [-0.34, 0, -0.5, 0.03],
    rays: { n: 20, to: [3, 7], from: tail.root, col: '#1a2838', a: 0.35, fade: 0.3, w: 0.0014, curl: 0.04, hl: '#dfe8f0', hla: 0.14 },
    scallop: { from: 3, to: 7, n: 10, depth: 0.0025 },
    edge: { col: 'rgba(20,35,55,0.4)', w: 0.002, to: 3 },
  });
  const dTop = (x) => P.top(x) + 0.01;
  fin(g, res, {
    pts: ridge(P, 'top', [[-0.15, -0.01], [-0.165, 0.04], [-0.21, 0.05], [-0.26, 0.042], [-0.3, 0.022, 1], [-0.31, -0.01]], 0.3),
    stops: [[0, rgba('#6f8196', 0.95)], [1, rgba('#aebccb', 0.7)]],
    rays: { n: 11, from: [[-0.16, dTop(-0.16)], [-0.305, dTop(-0.305)]], lean: [0.2, 0.9], col: '#1a2838', a: 0.32, w: 0.0013 },
    shade: 'rgba(20,40,70,0.3)',
  });
  const aBot = (x) => P.bot(x) - 0.01;
  fin(g, res, {
    pts: ridge(P, 'bot', [[-0.17, -0.01], [-0.185, 0.03], [-0.23, 0.04], [-0.27, 0.03], [-0.3, 0.014, 1], [-0.31, -0.01]], 0.35),
    stops: [[0, rgba('#8e9db0', 0.9)], [1, rgba('#c9d4de', 0.65)]],
    rays: { n: 9, from: [[-0.18, aBot(-0.18)], [-0.305, aBot(-0.305)]], lean: [0.3, 1.0], up: 1, col: '#1a2838', a: 0.28, w: 0.0012 },
  });

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, dark(back, 0.35)], [0.1, back], [0.26, blue], [0.36, mixc(blue, '#9fd0f0', 0.55)], [0.45, '#d6e3ee'], [0.6, '#eef2f5'], [0.8, '#ffffff'], [1, '#f0f3f4']]);
      U.band(0.34, 0.37, '#7fe0ff', 0.4, 0.015, -0.33, 0.42);
    },
    over(gg) {
      mottle(gg, -0.37, -0.08, 0.5, 0.09, { color: '#ffffff', a: 0.14, scale: 0.26, lo: 0.5, hi: 0.8, seed: 31, sy: 0.4 });
      mottle(gg, -0.37, -0.08, 0.5, 0.0, { color: '#8ad8ff', a: 0.18, scale: 0.3, lo: 0.5, hi: 0.8, seed: 32, sy: 0.5 });
      scales(gg, res, P, { rows: 10, x0: -0.33, x1: 0.29, xFade: (x) => Math.min(1, (0.29 - x) / 0.03), dark: '#163050', da: 0.16, la: 0.18, rng, glint: { p: 0.15, color: '#ffffff', a: 0.25 } });
      // soft shadow where the folded wing lies
      soft(gg, 0.012, 'rgba(20,40,70,0.25)', () => {
        gg.beginPath();
        gg.ellipse(0.05, 0.03, 0.2, 0.012, 0.02, 0, 7);
        gg.fill();
      });
    },
    shade: { dark: '#0e2040', sheen: 0.5, sheenV: 0.4, sheenW: 0.12, gloss: 0.4, belly: 0.22, bounce: 0.6, rim: 0.32, topLight: 0.25 },
    face(gg) {
      gill(gg, res, { x: 0.31, y0: -0.05, y1: 0.058, bulge: 0.026, dark: '#1a3050', a: 0.4, shadow: 0.22, plate: 0.22, w: 0.0022 });
      spot(gg, 0.47, -0.022, 0.003, '#13283a', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.004, dark: '#2a2a30', a: 0.55, w: 0.0024, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.4, -0.008, 0.03, { iris: '#b9c0c4', irisDark: '#3a4452', pupil: 0.62, ring: 'rgba(20,30,45,0.35)', rim: 'rgba(220,230,240,0.5)', socket: 0.2 });
      glint(gg, 0.45, -0.03, 0.02, 0.004, 0.3, -0.5);
    },
  });
}

// A wing painted SPREAD, pointing straight back (−x) from its pivot; posed by rotation + chord scale (sy).
function wingPaint(px, py, L, chord, dusky) {
  return (g, res) => {
    const pts = [[px + 0.01, py - chord * 0.12], [px - L * 0.3, py - chord * 0.5], [px - L * 0.72, py - chord * 0.6], [px - L, py - chord * 0.22], [px - L * 0.82, py + chord * 0.12], [px - L * 0.5, py + chord * 0.36], [px - L * 0.2, py + chord * 0.42], [px, py + chord * 0.16]];
    fin(g, res, {
      pts,
      stops: [[0, rgba(dusky ? '#2a3f58' : '#3a5578', 0.9)], [0.35, rgba(dusky ? '#5a6f88' : '#7f94ad', 0.72)], [0.55, rgba('#dfe8f0', 0.55)], [0.75, rgba(dusky ? '#4a6080' : '#6a82a4', 0.75)], [1, rgba(dusky ? '#1e2e44' : '#2a3f5c', 0.85)]],
      axis: [px, py, px - L, py - chord * 0.3],
      rays: { n: 16, to: [1, 6], from: [[px, py - chord * 0.08], [px - 0.01, py + chord * 0.12]], col: '#0f1c2c', a: 0.4, fade: 0.25, w: 0.0016, curl: 0.03, hl: '#ffffff', hla: 0.12 },
      scallop: { from: 3, to: 6, n: 7, depth: chord * 0.03 },
      edge: { col: 'rgba(15,28,44,0.5)', w: 0.0024, to: 3 },
      mottle: { color: '#ffffff', a: 0.14, scale: 0.25, lo: 0.5, hi: 0.8, seed: 41 },
    });
    erase(g, px + 0.005, py, L * 0.06, 0.85, 0.2, chord * 0.3);
  };
}
const wingBox = (px, py, L, chord) => ({ x0: px - L - 0.02, x1: px + 0.03, y0: py - chord * 0.7, y1: py + chord * 0.5 });

const wingPose = (sign, spread, fold, far) => (anim, st, out) => {
  const wk = st.wing || 0;
  const flutter = (1 - wk) * 0.03 * Math.sin(anim.t * 9 + anim.uid) + wk * 0.02 * Math.sin(anim.t * 2.1 + anim.uid);
  out.rot = sign * (spread * wk + flutter) + fold * (1 - wk);
  out.sy = 0.14 + 0.86 * wk;
  out.sx = far ? 0.92 : 1;
  out.alpha = far ? 0.55 + 0.45 * wk : 1;
};

export const def = {
  id: 'flying_fish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.5, y1: 0.3 },
  mouth: { x: 0.49, y: -0.002 },
  paint,
  swim: { swing: 0.045, waves: 1.2, power: 2.2, head: 0.07, squash: 0.02, freq: 1.4 },
  state(st, anim) {
    const jump = anim.state === 'jump' || anim.state === 'landed' || anim.state === 'icon' ? 1 : 0;
    ease(st, 'wing', jump, jump ? 9 : 4);
  },
  parts: [
    { key: 'wingF', box: wingBox(WING[0], WING[1] + 0.02, 0.5, 0.24), pivot: [WING[0], WING[1] + 0.02], paint: wingPaint(WING[0], WING[1] + 0.02, 0.5, 0.24, true), pose: wingPose(1, 1.05, 0.02, true), behind: true },
    { key: 'pelvF', box: wingBox(PELV[0], PELV[1], 0.24, 0.1), pivot: PELV, paint: wingPaint(PELV[0], PELV[1], 0.24, 0.1, true), pose: wingPose(-1, 0.8, -0.03, true), behind: true },
    { key: 'pelv', box: wingBox(PELV[0], PELV[1], 0.24, 0.1), pivot: PELV, paint: wingPaint(PELV[0], PELV[1], 0.24, 0.1, false), pose: wingPose(-1, 0.55, -0.05, false) },
    { key: 'wing', box: wingBox(WING[0], WING[1], 0.5, 0.24), pivot: WING, paint: wingPaint(WING[0], WING[1], 0.5, 0.24, false), pose: wingPose(1, 0.75, 0.04, false) },
  ],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 6, 0.008), gape: 0.4, cavity: '#2a1016' },
  gillSlit: { x: 0.31, y0: -0.045, y1: 0.055, bulge: 0.026, w: 0.003 },
};
