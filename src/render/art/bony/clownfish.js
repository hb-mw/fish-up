// Clownfish (Amphiprion ocellaris) — orange, three white bands edged in thin black, rounded black-rimmed fins.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.004], [0.49, -0.028], [0.462, -0.068], [0.41, -0.11], [0.33, -0.15], [0.22, -0.178], [0.1, -0.188], [-0.03, -0.178], [-0.15, -0.148], [-0.24, -0.1], [-0.3, -0.066], [-0.33, -0.06]],
  [[0.5, 0.004], [0.49, 0.034], [0.462, 0.068], [0.41, 0.104], [0.33, 0.138], [0.22, 0.165], [0.1, 0.178], [-0.03, 0.17], [-0.15, 0.14], [-0.24, 0.1], [-0.3, 0.066], [-0.33, 0.06]],
);
const HINGE = [0.432, 0.034], TIP = [0.497, 0.008], CORNER = [0.458, 0.022];
const PEC = [0.205, 0.03];
const BLACK = '#0d0b10';

// the three white bands, in body coordinates [x, v]
const BANDS = [
  [[0.278, -0.02], [0.3, 0.5], [0.318, 1.02], [0.255, 1.02], [0.228, 0.5], [0.212, -0.02]],
  [[0.005, -0.02], [0.05, 0.2], [0.108, 0.44, 1], [0.05, 0.72], [0.008, 1.02], [-0.082, 1.02], [-0.092, 0.6], [-0.092, 0.3], [-0.088, -0.02]],
  [[-0.246, -0.02], [-0.24, 0.5], [-0.246, 1.02], [-0.315, 1.02], [-0.322, 0.5], [-0.315, -0.02]],
];

function finStyle(orange, a = 1) {
  return {
    stops: [[0, rgba(orange, a)], [0.6, rgba(mixc(orange, '#ff9a3c', 0.5), a)], [1, rgba(lite(orange, 0.12), a)]],
    margin: { col: rgba(BLACK, 0.62), w: 0.0038, rim: 'rgba(255,245,230,0.45)', rimW: 0.0014 },
  };
}

function paint(g, res, v) {
  const rng = createRng(31 + v * 11);
  const orange = shift('#f97a1c', [-5, 0, 6][v], 0, [0, 0.02, -0.02][v]);
  const dusk = dark(orange, 0.22), pale = lite(orange, 0.22);
  const rayCol = '#7a2c06';

  // caudal: rounded fan
  const tail = caudal({ P, root: 0.07, up: [-0.472, -0.084], lo: [-0.472, 0.084], notch: [-0.5, 0.0], lead: 0.1, trail: 0.09, sharp: false });
  fin(g, res, {
    pts: tail, ...finStyle(orange), axis: [-0.3, 0, -0.5, 0],
    rays: { n: 16, to: [3, 7], from: tail.root, col: rayCol, a: 0.25, fade: 0.5, w: 0.0017, curl: 0.05, hl: '#ffd9b0', hla: 0.14 },
    margin: { col: rgba(BLACK, 0.62), w: 0.0042, from: 2, to: 8, rim: 'rgba(255,245,230,0.5)', rimW: 0.0016 },
    mottle: { color: '#a03a08', a: 0.14, scale: 0.3, lo: 0.4, hi: 0.75, seed: 4 },
  });
  // dorsal: 11 spines then a rounded soft lobe; the mid band climbs onto it
  const sp = spines(0.225, -0.015, 11, lerpArr([0.028, 0.052, 0.064, 0.07, 0.07, 0.068, 0.064, 0.06, 0.054, 0.046, 0.04]), 0.22);
  sp.pop();
  const dorsal = ridge(P, 'top', [...sp, [-0.04, 0.052], [-0.09, 0.072], [-0.15, 0.072], [-0.2, 0.052], [-0.23, 0.026], [-0.246, -0.012]], 0.28);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal, ...finStyle(orange), axis: [0.0, -0.17, -0.05, -0.27],
    margin: { col: rgba(BLACK, 0.62), w: 0.0038, from: 1, to: dorsal.length - 2, rim: 'rgba(255,245,230,0.45)', rimW: 0.0014 },
    paint(gg) {
      // the mid band climbs onto the fin, black-edged like on the body
      gg.beginPath();
      gg.moveTo(0.012, dTop(0.012) + 0.01);
      gg.lineTo(-0.012, -0.3);
      gg.lineTo(-0.1, -0.3);
      gg.lineTo(-0.084, dTop(-0.084) + 0.01);
      gg.closePath();
      gg.fillStyle = '#f6eee2';
      gg.fill();
      gg.strokeStyle = rgba(BLACK, 0.7);
      gg.lineWidth = 0.005;
      gg.stroke();
      const gr = gg.createLinearGradient(0, -0.3, 0, -0.17);
      gr.addColorStop(0, 'rgba(120,100,110,0.3)');
      gr.addColorStop(1, 'rgba(120,100,110,0)');
      gg.fillStyle = gr;
      gg.fill();
    },
    rays: [
      { n: 10, from: [[0.2114, dTop(0.2114)], [0.0014, dTop(0.0014)]], lean: 0.3, col: rayCol, a: 0.42, fade: 0.25, w: 0.0026, jitter: 0.15 },
      { n: 13, from: [[-0.03, dTop(-0.03)], [-0.24, dTop(-0.24)]], lean: [0.3, 1.0], col: rayCol, a: 0.26, w: 0.0015, hl: '#ffe0c0' },
    ],
    tension: 0.75,
  });
  const anal = ridge(P, 'bot', [[-0.07, -0.012], [-0.088, 0.04], [-0.13, 0.07], [-0.18, 0.068], [-0.215, 0.04], [-0.236, 0.012], [-0.246, -0.012]], 0.3);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal, ...finStyle(orange), axis: [-0.12, 0.16, -0.16, 0.25],
    margin: { col: rgba(BLACK, 0.62), w: 0.0038, from: 1, to: 5, rim: 'rgba(255,245,230,0.45)', rimW: 0.0014 },
    rays: { n: 12, from: [[-0.078, aBot(-0.078)], [-0.238, aBot(-0.238)]], lean: [0.3, 1.0], up: 1, col: rayCol, a: 0.26, w: 0.0015, hl: '#ffe0c0' },
  });
  const pelvic = (dx, a) => {
    const y = P.bot(0.14);
    fin(g, res, {
      pts: [[0.16 + dx, y - 0.014], [0.14 + dx, y + 0.045], [0.095 + dx, y + 0.09], [0.06 + dx, y + 0.078], [0.072 + dx, y + 0.03], [0.1 + dx, y - 0.014]],
      ...finStyle(orange, a), axis: [0.13, y, 0.09, y + 0.09],
      margin: { col: rgba(BLACK, 0.62 * a), w: 0.0038, from: 1, to: 4, rim: 'rgba(255,245,230,0.45)', rimW: 0.0014 },
      rays: { n: 7, to: [1, 4], from: [[0.15 + dx, y - 0.004], [0.104 + dx, y - 0.004]], col: rayCol, a: 0.26, w: 0.0015 },
      shade: 'rgba(90,30,0,0.3)',
    });
  };
  pelvic(-0.028, 0.6);

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, dusk], [0.12, dark(orange, 0.08)], [0.35, orange], [0.6, mixc(orange, pale, 0.5)], [0.85, pale], [1, lite(pale, 0.25)]]);
      // bands: white with a thin black edge
      for (const b of BANDS) {
        U.path(b, true);
        t.fillStyle = '#fbf5eb';
        t.fill();
        t.strokeStyle = rgba(BLACK, 0.82);
        t.lineWidth = U.dx(0.0065);
        t.stroke();
      }
      // soft shading inside the bands (they are not flat white)
      for (const b of BANDS) {
        U.path(b, true);
        t.save();
        t.clip();
        const gr = t.createLinearGradient(0, 0, 0, U.H);
        gr.addColorStop(0, 'rgba(120,110,120,0.3)');
        gr.addColorStop(0.3, 'rgba(255,255,255,0)');
        gr.addColorStop(0.75, 'rgba(255,255,255,0)');
        gr.addColorStop(1, 'rgba(110,90,110,0.32)');
        t.fillStyle = gr;
        t.fillRect(0, 0, U.W, U.H);
        t.restore();
      }
    },
    over(gg) {
      mottle(gg, -0.34, -0.2, 0.5, 0.2, { color: '#8a2a00', a: 0.16, scale: 0.3, lo: 0.42, hi: 0.75, seed: 3 + v });
      scales(gg, res, P, { rows: 16, x0: -0.3, x1: 0.3, dark: '#5a1800', da: 0.2, la: 0.12, rng, xFade: (x) => Math.min(1, (0.3 - x) / 0.04) });
    },
    shade: { dark: '#5a1a06', light: '#fff2dc', sheen: 0.4, sheenV: 0.2, sheenW: 0.13, gloss: 0.28, belly: 0.3, bounce: 0.6, rim: 0.32, topLight: 0.14 },
    face(gg) {
      soft(gg, 0.012, 'rgba(90,30,0,0.26)', () => {
        gg.beginPath();
        gg.ellipse(0.15, 0.065, 0.06, 0.02, -0.5, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.212, y0: -0.11, y1: 0.12, bulge: 0.028, dark: '#5a2a10', a: 0.25, shadow: 0.14, la: 0.12, w: 0.0024 });
      spot(gg, 0.44, -0.036, 0.0045, '#5a2410', 0.6, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.003, dark: '#4a1a10', a: 0.6, w: 0.0035, lip: 'rgba(255,230,200,0.3)' });
      eye(gg, 0.34, -0.042, 0.029, { iris: '#b8552c', irisDark: '#3a1208', pupil: 0.6, ring: 'rgba(30,14,10,0.35)', rim: 'rgba(255,200,140,0.35)', socket: 0.2 });
      glint(gg, 0.4, -0.08, 0.03, 0.006, 0.3, -0.6);
    },
  });
  pelvic(0, 1);
}

function paintPec(g, res, v) {
  const orange = shift('#f97a1c', [-5, 0, 6][v], 0, 0);
  fin(g, res, {
    pts: [[0.218, 0.0], [0.16, -0.012], [0.095, 0.022], [0.058, 0.085], [0.08, 0.135], [0.145, 0.128], [0.2, 0.085], [0.218, 0.05]],
    stops: [[0, rgba(orange, 0.95)], [0.5, rgba(mixc(orange, '#ffb060', 0.5), 0.9)], [1, rgba('#ffd2a0', 0.8)]],
    axis: [0.205, 0.03, 0.1, 0.1],
    margin: { col: rgba(BLACK, 0.55), w: 0.0036, from: 2, to: 6, rim: 'rgba(255,245,230,0.45)', rimW: 0.0014 },
    rays: { n: 12, to: [2, 6], from: [[0.2, 0.012], [0.21, 0.05]], col: '#7a2c06', a: 0.26, w: 0.0015, hl: '#ffe0c0' },
  });
  erase(g, 0.212, 0.03, 0.022, 0.9, 0.2, 0.026);
}

export const def = {
  id: 'clownfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.28, y1: 0.265 },
  mouth: { x: 0.49, y: 0.01 },
  paint,
  swim: { swing: 0.06, waves: 1.2, power: 1.6, head: 0.12, squash: 0.025, idle: 0.1 },
  parts: [{ key: 'pec', box: { x0: 0.04, x1: 0.235, y0: -0.03, y1: 0.155 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.42, rate: 3.6, squash: 0.35, fold: 0.15 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.45, cavity: '#3a0e12' },
  gillSlit: { x: 0.212, y0: -0.1, y1: 0.115, bulge: 0.028 },
};
