// Blue marlin (Makaira nicricans) — the trophy of trophies: spear bill, cobalt back, silver belly, pale-blue bars
// that "light up" electric blue when it is hooked, a tall pointed front dorsal lobe and a huge lunate tail.
import { profile, paintBody, fin, ridge, scales, gill, mouthLine, eye, spot, soft, glint, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng, makeCanvas } from './kit.js';
import { scull, blitSwim } from './rig.js';
import { unitSprite, variantFor } from '../common.js';
import { paintBill, keels, lunate, lunateFin, flankBars } from './billfish-extra.js';

const BILL = 0.335; // x where the bill leaves the head
const P = profile(
  [[0.5, -0.002], [0.44, -0.006], [0.38, -0.011], [0.335, -0.018], [0.31, -0.034], [0.28, -0.058], [0.24, -0.08], [0.19, -0.095], [0.13, -0.102], [0.05, -0.1], [-0.05, -0.092], [-0.15, -0.075], [-0.24, -0.052], [-0.3, -0.036], [-0.335, -0.028]],
  [[0.5, 0.002], [0.44, 0.006], [0.38, 0.011], [0.365, 0.013], [0.352, 0.027], [0.32, 0.04], [0.27, 0.054], [0.21, 0.066], [0.14, 0.075], [0.05, 0.077], [-0.05, 0.072], [-0.15, 0.058], [-0.24, 0.043], [-0.3, 0.032], [-0.335, 0.027]],
);
const HINGE = [0.235, 0.04], TIP = [0.36, 0.022], CORNER = [0.268, 0.034];
const PEC = [0.155, 0.032];

function skin(t, U, v, lit) {
  const dh = [-5, 0, 6][v];
  const back = shift('#143070', dh), back2 = shift('#1f4a9a', dh);
  if (!lit) {
    U.grad([[0, '#060f2a'], [0.07, dark(back, 0.3)], [0.22, back], [0.38, back2], [0.47, '#6f8fbf'], [0.56, '#c7d3e0'], [0.7, '#eef1f3'], [1, '#ffffff']]);
    // bronze iridescence just under the dark back
    U.band(0.36, 0.5, '#8b7a5a', 0.18, 0.06, -0.3, 0.3);
  }
  flankBars(t, U, { n: 15, x0: 0.2, x1: -0.31, v0: 0.06, v1: 0.78, v0jit: 0.03, v1jit: 0.08, color: lit ? '#7fe4ff' : '#a9dcff', a: lit ? 0.95 : 0.5, slant: U.dx(0.008), dotted: !lit, width: lit ? 0.014 : 0.011 });
  if (lit) {
    // the whole flank fires up electric blue when the fish is excited
    U.band(0.3, 0.75, '#3fc8ff', 0.3, 0.12, -0.33, 0.25);
    U.band(0.0, 0.16, '#58a8ff', 0.35, 0.08, -0.33, 0.3);
  }
}

function fins(g, res, v, col) {
  // tail
  lunateFin(g, res, lunate({ P, root: 0.09, up: [-0.5, -0.215], lo: [-0.5, 0.215], notchX: -0.44, lead: 0.05, trail: 0.1 }), { col, ray: '#06101f', hl: '#8fb0d8', n: 40 });
  // second dorsal / second anal (small)
  fin(g, res, { pts: ridge(P, 'top', [[-0.228, -0.01], [-0.238, 0.028, 1], [-0.262, 0.016], [-0.28, -0.01]], 0.5), stops: [[0, col], [1, rgba(lite(col, 0.2), 0.9)]] });
  fin(g, res, { pts: ridge(P, 'bot', [[-0.238, -0.01], [-0.248, 0.026, 1], [-0.27, 0.014], [-0.285, -0.01]], 0.5), stops: [[0, col], [1, rgba(lite(col, 0.2), 0.9)]] });
  // first dorsal: tall pointed lobe sloping into a low ridge that runs most of the back
  const d = ridge(P, 'top', [[0.185, -0.012], [0.178, 0.07], [0.166, 0.125], [0.152, 0.148, 1], [0.12, 0.085], [0.08, 0.05], [0.02, 0.036], [-0.07, 0.028], [-0.15, 0.022], [-0.205, 0.012], [-0.215, -0.012]], 0.2);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: d,
    stops: [[0, dark(col, 0.15)], [0.6, col], [1, rgba(lite(col, 0.18), 0.9)]],
    axis: [0.1, -0.1, 0.13, -0.24],
    rays: [
      { n: 7, from: [[0.182, dTop(0.182)], [0.115, dTop(0.115)]], lean: [0.1, 0.8], col: '#06101f', a: 0.4, w: 0.0017, hl: '#9fb8dc', hla: 0.12 },
      { n: 30, from: [[0.105, dTop(0.105)], [-0.21, dTop(-0.21)]], lean: 1.2, col: '#06101f', a: 0.3, w: 0.0013 },
    ],
    edge: { col: 'rgba(5,12,30,0.4)', w: 0.003, to: 3 },
    mottle: { color: '#05112a', a: 0.2, scale: 0.3, lo: 0.42, hi: 0.78, seed: 22 },
    tension: 0.8,
  });
  // first anal: pointed
  const an = ridge(P, 'bot', [[-0.1, -0.012], [-0.125, 0.045], [-0.145, 0.072, 1], [-0.17, 0.04], [-0.2, 0.014], [-0.215, -0.012]], 0.55);
  fin(g, res, { pts: an, stops: [[0, dark(col, 0.1)], [1, rgba(lite(col, 0.15), 0.9)]], rays: { n: 12, from: [[-0.105, P.bot(-0.105) - 0.012], [-0.212, P.bot(-0.212) - 0.012]], lean: [0.5, 1.4], up: 1, col: '#06101f', a: 0.35, w: 0.0014 }, edge: { col: 'rgba(5,12,30,0.4)', w: 0.003, to: 2 } });
  // pelvic filament
  fin(g, res, { pts: [[0.15, P.bot(0.15) - 0.01], [0.12, P.bot(0.12) + 0.03], [0.045, P.bot(0.06) + 0.075, 1], [0.1, P.bot(0.1) + 0.02], [0.125, P.bot(0.125) - 0.01]], stops: [[0, dark(col, 0.2)], [1, rgba(col, 0.85)]] });
}

function paint(g, res, v) {
  const rng = createRng(301 + v * 7);
  const col = shift('#15275a', [-5, 0, 6][v]);
  fins(g, res, v, col);
  paintBody(g, res, P, {
    fade: 0.04,
    skin: (t, U) => skin(t, U, v, false),
    over(gg) {
      mottle(gg, -0.34, -0.11, 0.34, 0.09, { color: '#0a1a44', a: 0.22, scale: 0.4, lo: 0.42, hi: 0.72, seed: 3 + v });
      mottle(gg, -0.34, 0.0, 0.34, 0.09, { color: '#9fd0ff', a: 0.06, scale: 0.3, lo: 0.5, hi: 0.8, seed: 9, sy: 0.5 });
      scales(gg, res, P, { rows: 22, x0: -0.3, x1: 0.17, v0: 0.1, v1: 0.9, da: 0.14, la: 0.1, dark: '#0a1a3a', rng, vFade: (vv) => 1 - 0.6 * vv, xFade: (x) => Math.min(1, (0.17 - x) / 0.04) });
    },
    shade: { dark: '#07112a', sheen: 0.36, sheenV: 0.2, sheenW: 0.1, gloss: 0.3, belly: 0.3, bounce: 0.6, rim: 0.3, topLight: 0.12 },
    face(gg) {
      paintBill(gg, res, P, { x0: BILL - 0.03, x1: 0.5, jawX: 0.365, top: '#1a2a4a', bot: '#6c7f9c', fade: 0.06 });
      // pale lower jaw: a soft silver wedge under the mouth line, melting into the throat
      soft(gg, 0.006, 'rgba(226,232,240,0.95)', () => {
        gg.beginPath();
        gg.moveTo(0.362, 0.018);
        gg.quadraticCurveTo(0.31, 0.024, 0.262, 0.036);
        gg.quadraticCurveTo(0.245, 0.055, 0.235, 0.07);
        gg.quadraticCurveTo(0.3, 0.052, 0.352, 0.032);
        gg.closePath();
        gg.fill();
      });
      spot(gg, 0.21, 0.02, 0.07, '#ffffff', 0.25, 0.05, 0.035);
      gill(gg, res, { x: 0.23, y0: -0.045, y1: 0.052, bulge: 0.012, dark: '#1a2a4e', a: 0.14, shadow: 0.12, la: 0.08, w: 0.002 });
      gill(gg, res, { x: 0.172, y0: -0.088, y1: 0.078, bulge: 0.026, dark: '#0e1c3e', a: 0.42, shadow: 0.24, plate: 0.18, w: 0.0024 });
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.002, dark: '#101a30', a: 0.65, w: 0.0028 });
      eye(gg, 0.268, -0.022, 0.017, { iris: '#56688a', irisDark: '#1c2638', pupil: 0.66, ring: 'rgba(10,20,40,0.4)', rim: 'rgba(210,225,245,0.45)', socket: 0.25 });
      glint(gg, 0.3, -0.055, 0.03, 0.005, 0.28, -0.35);
      keels(gg, res, P, -0.31, { w: 0.05, h: 0.005, black: '#05070c' });
    },
  });
}

// hooked / excited: the lit-up bars drawn over the body, riding the same wave
function paintLit(g, res, v) {
  paintBody(g, res, P, { fade: 0.04, skin: (t, U) => skin(t, U, v, true), shade: false });
}
const litKeys = [0, 1, 2].map((v) => `blue_marlin/lit${v}`);
const litPaints = [0, 1, 2].map((v) => (g, res) => paintLit(g, res, v));
const BOX = { x0: -0.51, x1: 0.51, y0: -0.25, y1: 0.22 };

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.165, 0.02], [0.1, 0.045], [-0.01, 0.1, 1], [0.05, 0.085], [0.12, 0.062], [0.162, 0.046]],
    stops: [[0, '#1a2a4e'], [0.5, 'rgba(34,54,96,0.95)'], [1, 'rgba(90,110,150,0.85)']],
    axis: [0.16, 0.034, -0.01, 0.1],
    rays: { n: 14, to: [2, 4], from: [[0.163, 0.024], [0.16, 0.044]], col: '#06101f', a: 0.35, w: 0.0014, hl: '#9fb8dc', hla: 0.12 },
    edge: { col: 'rgba(5,12,30,0.45)', w: 0.0026, to: 2 },
  });
}

export const def = {
  id: 'blue_marlin',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.245, y1: 0.215 },
  box: BOX,
  mouth: { x: 0.36, y: 0.02 },
  paint,
  swim: { swing: 0.04, waves: 0.95, power: 3.0, head: 0.03, squash: 0.035, freq: 1.3, thrash: 1.3, idle: 0.05 },
  parts: [{ key: 'pec', box: { x0: -0.03, x1: 0.18, y0: 0.0, y1: 0.12 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.08, amp: 0.05, rate: 1.6, squash: 0.1, fold: 0.1 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 8, 0.01), gape: 0.42, cavity: '#1c0a12', throat: '#6a2630' },
  gillSlit: { x: 0.172, y0: -0.078, y1: 0.07, bulge: 0.026 },
  over(ctx, len, anim, opts, st, w, R) {
    const k = st.hook * (0.75 + 0.25 * Math.sin(anim.t * 9 + anim.uid));
    if (k < 0.03 || R.sil) return;
    const spr = variantFor(unitSprite(litKeys[R.v], BOX, R.lenPx, litPaints[R.v]), opts);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * k;
    blitSwim(ctx, spr, len, w, R.n, R.ov);
    ctx.globalAlpha = ga;
  },
};
