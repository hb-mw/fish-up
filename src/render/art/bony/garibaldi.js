// Garibaldi (Hypsypops rubicundus) — brilliant uniform orange damselfish, deep body, rounded fin lobes,
// heart-shaped tail, thick lips, large scales and a green-yellow eye.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.0], [0.49, -0.04], [0.465, -0.088], [0.42, -0.142], [0.35, -0.198], [0.25, -0.238], [0.12, -0.254], [-0.02, -0.244], [-0.15, -0.2], [-0.25, -0.13], [-0.31, -0.086], [-0.335, -0.078]],
  [[0.5, 0.0], [0.49, 0.042], [0.465, 0.086], [0.42, 0.13], [0.35, 0.175], [0.25, 0.215], [0.12, 0.234], [-0.02, 0.228], [-0.15, 0.19], [-0.25, 0.126], [-0.31, 0.086], [-0.335, 0.078]],
);
const HINGE = [0.428, 0.04], TIP = [0.497, 0.012], CORNER = [0.456, 0.03];
const PEC = [0.205, 0.04];

function paint(g, res, v) {
  const rng = createRng(89 + v * 13);
  const orange = shift('#ff6f14', [-4, 0, 5][v], 0, [0, 0.015, -0.015][v]);
  const dusk = dark(orange, 0.2), pale = lite(orange, 0.2);
  const rayCol = '#8a2e04';
  const finStyle = (axis) => ({
    stops: [[0, rgba(dusk, 0.98)], [0.45, rgba(orange, 0.95)], [1, rgba(mixc(orange, '#ffb070', 0.5), 0.78)]],
    axis,
    mottle: { color: '#a03a08', a: 0.14, scale: 0.3, lo: 0.4, hi: 0.75, seed: 4 + v },
    margin: { col: 'rgba(255,220,190,0.22)', w: 0.004 },
  });

  const tail = caudal({ P, root: 0.07, up: [-0.5, -0.165], lo: [-0.5, 0.165], notch: [-0.44, 0.0], lead: 0.1, trail: 0.12, sharp: false });
  fin(g, res, {
    pts: tail, ...finStyle([-0.3, 0, -0.5, 0]),
    rays: { n: 18, to: [3, 7], from: tail.root, col: rayCol, a: 0.26, fade: 0.45, w: 0.0017, curl: 0.05, hl: '#ffd0a0', hla: 0.14 },
    margin: { col: 'rgba(255,220,190,0.25)', w: 0.004, from: 3, to: 7 },
    scallop: { from: 3, to: 7, n: 9, depth: 0.0025 },
  });
  const sp = spines(0.2, -0.03, 12, lerpArr([0.03, 0.05, 0.062, 0.07, 0.072, 0.072, 0.07, 0.068, 0.066, 0.064, 0.062, 0.06]), 0.18);
  sp.pop();
  const dorsal = ridge(P, 'top', [...sp, [-0.06, 0.085], [-0.11, 0.115], [-0.17, 0.122], [-0.225, 0.1], [-0.27, 0.06], [-0.292, -0.012]], 0.35);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal, ...finStyle([0.0, -0.24, -0.08, -0.38]),
    rays: [
      { n: 11, from: [[0.1862, dTop(0.1862)], [-0.0184, dTop(-0.0184)]], lean: 0.26, col: rayCol, a: 0.42, fade: 0.25, w: 0.0026, jitter: 0.15 },
      { n: 14, from: [[-0.04, dTop(-0.04)], [-0.285, dTop(-0.285)]], lean: [0.3, 1.1], col: rayCol, a: 0.26, w: 0.0016, hl: '#ffd0a0', hla: 0.14 },
    ],
    margin: { col: 'rgba(255,220,190,0.25)', w: 0.004, from: 1, to: dorsal.length - 2 },
    tension: 0.75,
  });
  const anal = ridge(P, 'bot', [[-0.065, -0.012], [-0.085, 0.05], [-0.13, 0.092], [-0.185, 0.104], [-0.235, 0.08], [-0.27, 0.044], [-0.292, -0.012]], 0.35);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal, ...finStyle([-0.14, 0.22, -0.18, 0.33]),
    rays: { n: 13, from: [[-0.075, aBot(-0.075)], [-0.285, aBot(-0.285)]], lean: [0.3, 1.1], up: 1, col: rayCol, a: 0.26, w: 0.0016, hl: '#ffd0a0', hla: 0.14 },
    margin: { col: 'rgba(255,220,190,0.25)', w: 0.004, from: 1, to: 5 },
  });
  const pelvic = (dx, a) => {
    const y = P.bot(0.17);
    fin(g, res, {
      pts: [[0.195 + dx, y - 0.014], [0.175 + dx, y + 0.05], [0.125 + dx, y + 0.11], [0.085 + dx, y + 0.1], [0.1 + dx, y + 0.04], [0.13 + dx, y - 0.014]],
      stops: [[0, rgba(dusk, a)], [1, rgba(mixc(orange, '#ffb070', 0.4), a * 0.8)]], axis: [0.16, y, 0.11, y + 0.1],
      rays: { n: 7, to: [1, 4], from: [[0.185 + dx, y - 0.004], [0.135 + dx, y - 0.004]], col: rayCol, a: 0.26, w: 0.0016 },
      shade: 'rgba(110,40,0,0.3)',
    });
  };
  pelvic(-0.026, 0.55);

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, dusk], [0.14, dark(orange, 0.08)], [0.4, orange], [0.68, mixc(orange, pale, 0.55)], [0.9, pale], [1, lite(pale, 0.2)]]);
      // a slightly dusky nape and a warmer golden flank
      U.glow(0.1, 0.5, 0.3, 0.3, '#ffa040', 0.35);
    },
    over(gg) {
      mottle(gg, -0.34, -0.26, 0.5, 0.24, { color: '#8a2a00', a: 0.18, scale: 0.32, lo: 0.42, hi: 0.75, seed: 3 + v });
      scales(gg, res, P, { rows: 15, x0: -0.3, x1: 0.24, dark: '#5a1800', da: 0.26, la: 0.16, lw: 0.1, rng, xFade: (x) => Math.min(1, (0.24 - x) / 0.05) });
      // small cheek scales
      scales(gg, res, P, { rows: 22, x0: 0.22, x1: 0.4, v0: 0.3, v1: 0.9, dark: '#5a1800', da: 0.16, la: 0.1, rng });
    },
    shade: { dark: '#5a1a06', light: '#fff0da', sheen: 0.42, sheenV: 0.2, sheenW: 0.13, gloss: 0.3, belly: 0.32, bounce: 0.6, rim: 0.34, topLight: 0.16 },
    face(gg) {
      soft(gg, 0.014, 'rgba(100,30,0,0.26)', () => {
        gg.beginPath();
        gg.ellipse(0.14, 0.08, 0.07, 0.022, -0.5, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.215, y0: -0.14, y1: 0.16, bulge: 0.03, dark: '#5a2008', a: 0.3, shadow: 0.18, la: 0.14, w: 0.0026, plate: 0.16 });
      gill(gg, res, { x: 0.29, y0: -0.07, y1: 0.1, bulge: 0.018, dark: '#5a2008', a: 0.14, shadow: 0.1, la: 0.08, w: 0.002 });
      // thick pale lips
      soft(gg, 0.004, rgba(lite(orange, 0.35), 0.6), () => {
        gg.beginPath();
        gg.moveTo(0.5, -0.012);
        gg.quadraticCurveTo(0.47, -0.01, 0.455, 0.02);
        gg.quadraticCurveTo(0.47, 0.048, 0.5, 0.04);
        gg.lineWidth = 0.009;
        gg.stroke();
      });
      spot(gg, 0.447, -0.044, 0.0045, '#5a2410', 0.6, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.004, dark: '#5a1a10', a: 0.6, w: 0.0036, lip: 'rgba(255,230,200,0.35)' });
      eye(gg, 0.345, -0.07, 0.03, { iris: '#b9c43c', irisDark: '#4e5a12', pupil: 0.56, ring: 'rgba(50,20,10,0.35)', rim: 'rgba(255,230,150,0.4)', socket: 0.22 });
      glint(gg, 0.41, -0.11, 0.03, 0.006, 0.3, -0.6);
    },
  });
  pelvic(0, 1);
}

function paintPec(g, res, v) {
  const orange = shift('#ff6f14', [-4, 0, 5][v], 0, 0);
  fin(g, res, {
    pts: [[0.22, 0.005], [0.16, -0.012], [0.08, 0.025], [0.03, 0.1], [0.055, 0.16], [0.135, 0.158], [0.2, 0.105], [0.22, 0.062]],
    stops: [[0, rgba(dark(orange, 0.15), 0.95)], [0.5, rgba(orange, 0.85)], [1, rgba('#ffc890', 0.7)]],
    axis: [0.21, 0.04, 0.06, 0.12],
    rays: { n: 13, to: [2, 6], from: [[0.205, 0.02], [0.212, 0.06]], col: '#8a2e04', a: 0.26, w: 0.0016, hl: '#ffd0a0', hla: 0.14 },
    margin: { col: 'rgba(255,220,190,0.25)', w: 0.004, from: 2, to: 6 },
  });
  erase(g, 0.215, 0.04, 0.022, 0.9, 0.2, 0.028);
}

export const def = {
  id: 'garibaldi',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.39, y1: 0.35 },
  mouth: { x: 0.49, y: 0.014 },
  paint,
  swim: { swing: 0.05, waves: 1.15, power: 1.7, head: 0.1, squash: 0.025, idle: 0.08 },
  parts: [{ key: 'pec', box: { x0: 0.01, x1: 0.235, y0: -0.03, y1: 0.18 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.35, rate: 3.0, squash: 0.35, fold: 0.2 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.45, cavity: '#3a0e12' },
  gillSlit: { x: 0.215, y0: -0.13, y1: 0.15, bulge: 0.03 },
};
