// Blue tang (Paracanthurus hepatus) — royal-blue oval, black "painter's palette", yellow triangular tail.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.022], [0.49, -0.012], [0.462, -0.058], [0.41, -0.108], [0.33, -0.158], [0.22, -0.194], [0.1, -0.21], [-0.03, -0.204], [-0.15, -0.174], [-0.25, -0.116], [-0.31, -0.07], [-0.34, -0.062]],
  [[0.5, 0.022], [0.49, 0.05], [0.462, 0.086], [0.41, 0.126], [0.33, 0.166], [0.22, 0.196], [0.1, 0.21], [-0.03, 0.204], [-0.15, 0.174], [-0.25, 0.116], [-0.31, 0.07], [-0.34, 0.062]],
);
const HINGE = [0.452, 0.046], TIP = [0.497, 0.026], CORNER = [0.471, 0.036];
const PEC = [0.205, 0.035];
const INK = '#07070f';

function paint(g, res, v) {
  const rng = createRng(53 + v * 7);
  const blue = shift('#1d4fe0', [-6, 0, 5][v], 0, [0, 0.02, -0.02][v]);
  const blueLt = lite(blue, 0.18), blueDk = dark(blue, 0.3);
  const yel = '#f9d416';
  const rayCol = '#06103a';

  // ── caudal: yellow with black upper / lower margins ──
  const tail = caudal({ P, root: 0.08, up: [-0.5, -0.15], lo: [-0.5, 0.148], notch: [-0.462, 0.0], lead: 0.03, trail: -0.03 });
  fin(g, res, {
    pts: tail,
    stops: [[0, mixc(yel, '#ffe66a', 0.3)], [0.5, yel], [1, rgba('#ffe766', 0.9)]],
    axis: [-0.3, 0, -0.5, 0],
    rays: { n: 22, to: [3, 7], from: tail.root, col: '#8a6a00', a: 0.3, fade: 0.4, w: 0.0015, curl: 0.03, hl: '#fff6b0', hla: 0.16 },
    scallop: { from: 3, to: 7, n: 11, depth: 0.002 },
    paint(gg) {
      // the black of the body wraps round the top and bottom of the fin
      gg.fillStyle = INK;
      for (const sgn of [-1, 1]) {
        gg.beginPath();
        gg.moveTo(-0.26, sgn * 0.025);
        gg.lineTo(-0.52, sgn * 0.2);
        gg.lineTo(-0.52, sgn * 0.128);
        gg.lineTo(-0.3, sgn * 0.046);
        gg.closePath();
        gg.fill();
      }
    },
    margin: { col: 'rgba(255,255,255,0.22)', w: 0.004, from: 3, to: 7 },
    mottle: { color: '#b08400', a: 0.12, scale: 0.3, lo: 0.4, hi: 0.75, seed: 4 },
  });
  // ── dorsal: long, low-ish, 9 spines then soft rays; blue with a black base band and a thin black edge ──
  const sp = spines(0.235, 0.0, 9, lerpArr([0.03, 0.055, 0.07, 0.078, 0.08, 0.08, 0.078, 0.075, 0.072]), 0.14);
  sp.pop();
  const dorsal = ridge(P, 'top', [...sp, [-0.05, 0.078], [-0.12, 0.08], [-0.19, 0.068], [-0.235, 0.045, 1], [-0.262, -0.012]], 0.3);
  const dTop = (x) => P.top(x) + 0.012;
  const finBlue = (axis, from, to) => ({
    stops: [[0, blueDk], [0.3, blue], [1, rgba(blueLt, 0.92)]],
    axis,
    margin: { col: rgba(INK, 0.85), w: 0.0036, from, to },
    mottle: { color: '#061040', a: 0.16, scale: 0.3, lo: 0.42, hi: 0.75, seed: 6 },
  });
  fin(g, res, {
    pts: dorsal, ...finBlue([0.0, -0.19, -0.04, -0.3], 1, dorsal.length - 2),
    rays: [
      { n: 8, from: [[0.2209, dTop(0.2209)], [0.0141, dTop(0.0141)]], lean: 0.32, col: rayCol, a: 0.45, fade: 0.25, w: 0.0024, jitter: 0.15 },
      { n: 16, from: [[-0.01, dTop(-0.01)], [-0.255, dTop(-0.255)]], lean: [0.32, 0.95], col: rayCol, a: 0.3, w: 0.0015, hl: '#8fb4ff', hla: 0.14 },
    ],
    tension: 0.75,
  });
  const anal = ridge(P, 'bot', [[-0.0, -0.012], [-0.02, 0.04, 1], [-0.07, 0.066], [-0.14, 0.07], [-0.2, 0.058], [-0.235, 0.038, 1], [-0.262, -0.012]], 0.32);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal, ...finBlue([-0.12, 0.18, -0.14, 0.28], 1, 5),
    rays: { n: 17, from: [[-0.012, aBot(-0.012)], [-0.255, aBot(-0.255)]], lean: [0.3, 0.95], up: 1, col: rayCol, a: 0.3, w: 0.0015, hl: '#8fb4ff', hla: 0.14 },
  });
  const pelvic = (dx, a) => {
    const y = P.bot(0.17);
    fin(g, res, {
      pts: [[0.19 + dx, y - 0.014], [0.17 + dx, y + 0.03], [0.12 + dx, y + 0.085, 1], [0.1 + dx, y + 0.05], [0.125 + dx, y - 0.014]],
      stops: [[0, rgba(blueDk, a)], [1, rgba(blue, a * 0.9)]], axis: [0.16, y, 0.12, y + 0.085],
      margin: { col: rgba(INK, 0.8 * a), w: 0.003, from: 1, to: 3 },
      rays: { n: 6, to: [1, 3], from: [[0.18 + dx, y - 0.004], [0.13 + dx, y - 0.004]], col: rayCol, a: 0.3, w: 0.0015 },
    });
  };
  pelvic(-0.03, 0.6);

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, blueDk], [0.15, blue], [0.45, mixc(blue, blueLt, 0.6)], [0.8, blueLt], [1, lite(blueLt, 0.2)]]);
      // the palette: black band from the eye along the back to the peduncle, returning along the mid-flank
      soft(t, U.H * 0.009, INK, () => {
        U.path([[0.37, 0.27], [0.28, 0.12], [0.08, 0.06], [-0.14, 0.07], [-0.27, 0.1], [-0.33, 0.3], [-0.35, 0.5], [-0.33, 0.72], [-0.26, 0.8], [-0.15, 0.73], [-0.02, 0.64], [0.12, 0.58], [0.22, 0.48], [0.3, 0.37]], true);
        t.fill();
      });
      // the blue "thumb hole"
      soft(t, U.H * 0.009, blue, () => {
        U.path([[0.19, 0.31], [0.04, 0.24], [-0.1, 0.25], [-0.2, 0.33], [-0.22, 0.43], [-0.15, 0.52], [0.0, 0.5], [0.14, 0.44]], true);
        t.fill();
      });
      // the yellow triangle of the tail pushing onto the peduncle
      soft(t, U.H * 0.008, yel, () => {
        U.path([[-0.235, 0.5], [-0.345, 0.14], [-0.345, 0.86]], true, true);
        t.fill();
      });
      // soft dark along the dorsal base behind the head
      U.band(-0.02, 0.06, INK, 0.5, 0.05, -0.2, 0.3);
    },
    over(gg) {
      mottle(gg, -0.34, -0.22, 0.5, 0.22, { color: '#061040', a: 0.18, scale: 0.34, lo: 0.42, hi: 0.72, seed: 3 + v });
      mottle(gg, -0.34, -0.22, 0.5, 0.22, { color: '#8fd0ff', a: 0.1, scale: 0.3, lo: 0.5, hi: 0.8, seed: 9 });
      scales(gg, res, P, { rows: 26, x0: -0.3, x1: 0.27, dark: '#020818', da: 0.16, la: 0.1, lw: 0.09, rng, xFade: (x) => Math.min(1, (0.27 - x) / 0.04) });
      // caudal spine (the scalpel)
      spot(gg, -0.298, 0.0, 0.03, yel, 0.9, 0.6, 0.006);
    },
    shade: { dark: '#02061c', light: '#dcecff', sheen: 0.4, sheenV: 0.2, sheenW: 0.13, gloss: 0.3, belly: 0.3, bounce: 0.55, rim: 0.34, topLight: 0.16 },
    face(gg) {
      soft(gg, 0.012, 'rgba(2,8,40,0.28)', () => {
        gg.beginPath();
        gg.ellipse(0.15, 0.07, 0.06, 0.02, -0.5, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.24, y0: -0.12, y1: 0.14, bulge: 0.03, dark: '#030818', a: 0.4, shadow: 0.22, la: 0.14, w: 0.0024, plate: 0.14 });
      spot(gg, 0.445, -0.03, 0.004, '#06102a', 0.6, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.002, dark: '#06102a', a: 0.65, w: 0.003, lip: 'rgba(200,220,255,0.3)' });
      eye(gg, 0.35, -0.072, 0.027, { iris: '#2a2a3a', irisDark: '#08080f', pupil: 0.62, ring: 'rgba(2,6,20,0.4)', rim: 'rgba(255,214,80,0.75)', socket: 0.25 });
      glint(gg, 0.42, -0.1, 0.028, 0.005, 0.3, -0.7);
    },
  });
  pelvic(0, 1);
}

function paintPec(g, res, v) {
  const blue = shift('#1d4fe0', [-6, 0, 5][v], 0, 0);
  fin(g, res, {
    pts: [[0.218, 0.005], [0.165, -0.008], [0.1, 0.03], [0.06, 0.085, 1], [0.085, 0.11], [0.15, 0.1], [0.2, 0.072], [0.218, 0.05]],
    stops: [[0, dark(blue, 0.25)], [0.45, blue], [0.62, '#f9d416'], [1, rgba('#ffe766', 0.88)]],
    axis: [0.21, 0.035, 0.07, 0.09],
    rays: { n: 11, to: [2, 6], from: [[0.205, 0.015], [0.215, 0.05]], col: '#4a3a00', a: 0.28, w: 0.0015, hl: '#ffffff', hla: 0.12 },
    outline: { col: 'rgba(0,0,20,0.3)', w: 0.0015 },
  });
  erase(g, 0.215, 0.035, 0.022, 0.9, 0.2, 0.026);
}

export const def = {
  id: 'blue_tang',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.3, y1: 0.295 },
  mouth: { x: 0.492, y: 0.028 },
  paint,
  swim: { swing: 0.03, waves: 1.1, power: 1.8, head: 0.1, squash: 0.02, idle: 0.08 },
  parts: [{ key: 'pec', box: { x0: 0.04, x1: 0.235, y0: -0.025, y1: 0.13 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.12, amp: 0.5, lock: 1, squash: 0.4 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.4, cavity: '#1a0a12' },
  gillSlit: { x: 0.24, y0: -0.11, y1: 0.13, bulge: 0.03 },
};
