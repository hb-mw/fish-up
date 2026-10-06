// Swordfish (Xiphias gladius) — a flat sword a third of its length, a stout bronze-black body fading to a pale
// belly, a tall rigid crescent dorsal, a huge eye, no pelvic fins, one big keel and a wide lunate tail.
import { profile, paintBody, fin, ridge, gill, mouthLine, eye, spot, soft, glint, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { paintBill, keels, lunate, lunateFin } from './billfish-extra.js';

const P = profile(
  [[0.5, -0.002], [0.4, -0.007], [0.3, -0.011], [0.2, -0.016], [0.17, -0.028], [0.14, -0.05], [0.1, -0.074], [0.05, -0.09], [-0.01, -0.097], [-0.08, -0.095], [-0.16, -0.08], [-0.24, -0.056], [-0.3, -0.036], [-0.335, -0.026]],
  [[0.5, 0.002], [0.4, 0.007], [0.3, 0.011], [0.215, 0.015], [0.2, 0.032], [0.17, 0.046], [0.13, 0.064], [0.08, 0.08], [0.02, 0.09], [-0.06, 0.09], [-0.14, 0.078], [-0.22, 0.056], [-0.3, 0.035], [-0.335, 0.026]],
);
const HINGE = [0.12, 0.04], TIP = [0.212, 0.026], CORNER = [0.15, 0.04];
const PEC = [0.08, 0.06];

function paint(g, res, v) {
  const rng = createRng(501 + v * 7);
  const col = shift('#2a2026', [-8, 0, 8][v]);
  const finCol = mixc(col, '#3b2f3a', 0.5);
  lunateFin(g, res, lunate({ P, root: 0.09, up: [-0.5, -0.235], lo: [-0.5, 0.235], notchX: -0.425, lead: 0.06, trail: 0.1 }), { col: finCol, ray: '#0a0608', hl: '#a89aa0', n: 42, mot: '#120a10' });
  // tiny second dorsal / anal
  fin(g, res, { pts: ridge(P, 'top', [[-0.27, -0.01], [-0.28, 0.024, 1], [-0.3, 0.012], [-0.312, -0.01]], 0.5), stops: [[0, finCol], [1, rgba(lite(finCol, 0.2), 0.9)]] });
  fin(g, res, { pts: ridge(P, 'bot', [[-0.272, -0.01], [-0.282, 0.022, 1], [-0.302, 0.011], [-0.314, -0.01]], 0.5), stops: [[0, finCol], [1, rgba(lite(finCol, 0.2), 0.9)]] });
  // first dorsal: tall, rigid, crescent-shaped
  const d = ridge(P, 'top', [[0.07, -0.012], [0.06, 0.06], [0.045, 0.12], [0.025, 0.155, 1], [-0.01, 0.1], [-0.03, 0.055], [-0.045, 0.02], [-0.06, -0.012]], 0.35);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: d,
    stops: [[0, dark(finCol, 0.2)], [0.6, finCol], [1, rgba(lite(finCol, 0.2), 0.92)]],
    axis: [0.02, -0.1, 0.0, -0.26],
    rays: { n: 16, from: [[0.066, dTop(0.066)], [-0.055, dTop(-0.055)]], lean: [0.25, 1.3], col: '#0a0608', a: 0.4, w: 0.0015, hl: '#a89aa0', hla: 0.12, len: 0.3 },
    edge: { col: 'rgba(10,6,8,0.45)', w: 0.003, to: 3 },
    mottle: { color: '#120a10', a: 0.2, scale: 0.3, lo: 0.42, hi: 0.78, seed: 23 },
    tension: 0.85,
  });
  // first anal: falcate
  const an = ridge(P, 'bot', [[-0.13, -0.012], [-0.15, 0.05], [-0.165, 0.085, 1], [-0.19, 0.045], [-0.215, 0.016], [-0.23, -0.012]], 0.5);
  fin(g, res, { pts: an, stops: [[0, dark(finCol, 0.1)], [1, rgba(lite(finCol, 0.15), 0.9)]], rays: { n: 12, from: [[-0.135, P.bot(-0.135) - 0.012], [-0.228, P.bot(-0.228) - 0.012]], lean: [0.5, 1.4], up: 1, col: '#0a0608', a: 0.35, w: 0.0014 }, edge: { col: 'rgba(10,6,8,0.4)', w: 0.003, to: 2 } });
  paintBody(g, res, P, {
    fade: 0.04,
    skin(t, U) {
      const dh = [-8, 0, 8][v];
      U.grad([[0, '#080406'], [0.12, shift('#201216', dh)], [0.3, shift('#3a262b', dh)], [0.46, shift('#634a49', dh)], [0.6, '#92807c'], [0.78, '#c4b8b2'], [1, '#e6e0da']]);
      // bronze-purple sheen on the upper flank
      U.band(0.18, 0.42, '#8a5a4a', 0.22, 0.1, -0.33, 0.15);
    },
    over(gg) {
      mottle(gg, -0.34, -0.1, 0.25, 0.1, { color: '#140a12', a: 0.26, scale: 0.4, lo: 0.42, hi: 0.72, seed: 3 + v });
      mottle(gg, -0.34, -0.1, 0.25, 0.1, { color: '#c8a0a8', a: 0.08, scale: 0.25, lo: 0.5, hi: 0.8, seed: 9 });
    },
    shade: { dark: '#0a0608', sheen: 0.4, sheenV: 0.2, sheenW: 0.1, gloss: 0.35, belly: 0.3, bounce: 0.6, rim: 0.3, topLight: 0.14 },
    face(gg) {
      paintBill(gg, res, P, { x0: 0.15, x1: 0.5, jawX: 0.217, top: '#1e1418', bot: '#8a7c80', fade: 0.07 });
      soft(gg, 0.005, 'rgba(220,210,206,0.9)', () => {
        gg.beginPath();
        gg.moveTo(0.214, 0.022);
        gg.quadraticCurveTo(0.18, 0.03, 0.148, 0.04);
        gg.quadraticCurveTo(0.138, 0.058, 0.13, 0.072);
        gg.quadraticCurveTo(0.17, 0.055, 0.205, 0.036);
        gg.closePath();
        gg.fill();
      });
      spot(gg, 0.06, 0.02, 0.06, '#ffffff', 0.18, 0.05, 0.03);
      gill(gg, res, { x: 0.035, y0: -0.08, y1: 0.075, bulge: 0.024, dark: '#140a10', a: 0.4, shadow: 0.24, plate: 0.16, w: 0.0024 });
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.003, dark: '#0a0608', a: 0.65, w: 0.0028 });
      eye(gg, 0.105, -0.028, 0.024, { iris: '#3a4a66', irisDark: '#101826', pupil: 0.7, ring: 'rgba(10,8,12,0.45)', rim: 'rgba(200,210,230,0.5)', socket: 0.3 });
      glint(gg, 0.14, -0.06, 0.03, 0.005, 0.26, -0.3);
      keels(gg, res, P, -0.3, { w: 0.07, h: 0.008, light: '#b8aaa8', dark: '#0a0608' });
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.09, 0.05], [0.03, 0.07], [-0.09, 0.115, 1], [-0.03, 0.11], [0.04, 0.09], [0.086, 0.074]],
    stops: [[0, '#2a1c22'], [0.5, 'rgba(60,44,52,0.95)'], [1, 'rgba(120,100,108,0.85)']],
    axis: [0.085, 0.06, -0.09, 0.115],
    rays: { n: 14, to: [2, 4], from: [[0.088, 0.054], [0.085, 0.072]], col: '#0a0608', a: 0.35, w: 0.0014, hl: '#a89aa0', hla: 0.12 },
    edge: { col: 'rgba(10,6,8,0.45)', w: 0.0026, to: 2 },
  });
}

export const def = {
  id: 'swordfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.27, y1: 0.235 },
  mouth: { x: 0.21, y: 0.024 },
  paint,
  swim: { swing: 0.038, waves: 0.95, power: 3.0, head: 0.03, squash: 0.035, freq: 1.25, thrash: 1.2, idle: 0.05 },
  parts: [{ key: 'pec', box: { x0: -0.11, x1: 0.1, y0: 0.03, y1: 0.13 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.06, amp: 0.04, rate: 1.4, squash: 0.08, fold: 0.08 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 8, 0.01), gape: 0.4, cavity: '#1c0a12', throat: '#6a2630' },
  gillSlit: { x: 0.035, y0: -0.07, y1: 0.066, bulge: 0.024 },
};
