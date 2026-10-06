// Moorish idol (Zanclus cornutus) — tall disc, tubular snout with an orange saddle, black / white / yellow bars,
// black caudal with a white margin and the long white dorsal streamer (a separate sprite riding its own ripple).
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, sampleSpline, tracePoly, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull, blitSwim } from './rig.js';
import { unitSprite, variantFor } from '../common.js';

const P = profile(
  [[0.5, 0.075], [0.47, 0.048], [0.44, 0.024], [0.41, -0.008], [0.38, -0.06], [0.35, -0.13], [0.31, -0.2], [0.25, -0.262], [0.17, -0.3], [0.08, -0.316], [-0.02, -0.308], [-0.12, -0.268], [-0.22, -0.19], [-0.3, -0.112], [-0.34, -0.09]],
  [[0.5, 0.075], [0.47, 0.1], [0.44, 0.12], [0.41, 0.146], [0.38, 0.176], [0.35, 0.21], [0.31, 0.244], [0.25, 0.276], [0.17, 0.296], [0.08, 0.302], [-0.02, 0.294], [-0.12, 0.26], [-0.22, 0.186], [-0.3, 0.112], [-0.34, 0.09]],
);
const HINGE = [0.462, 0.092], TIP = [0.498, 0.082], CORNER = [0.48, 0.086];
const PEC = [0.235, 0.06];
const INK = '#0b0a12', WHITE = '#f7f3ea', YEL = '#f4c531', ORANGE = '#f08a1c';
// the body bars as x spans (shared by body and fins so they line up)
const BAR1 = [0.335, 0.115], BAR2 = [-0.085, -0.245];

/** vertical bar pattern in unit space (for the fins): clipped to the current clip */
function barsOn(gg, y0, y1) {
  const rect = (xa, xb, col) => {
    gg.fillStyle = col;
    gg.fillRect(xb, y0, xa - xb, y1 - y0);
  };
  rect(0.6, BAR1[0], WHITE);
  rect(BAR1[0], BAR1[1], INK);
  const gr = gg.createLinearGradient(BAR1[1], 0, BAR2[0], 0);
  gr.addColorStop(0, WHITE);
  gr.addColorStop(0.55, WHITE);
  gr.addColorStop(1, YEL);
  rect(BAR1[1], BAR2[0], gr);
  rect(BAR2[0], BAR2[1], INK);
  rect(BAR2[1], BAR2[1] - 0.012, '#dfe9f4');
  rect(BAR2[1] - 0.012, -0.6, mixc(YEL, ORANGE, 0.5));
}

function paint(g, res, v) {
  const rng = createRng(71 + v * 5);
  const rayCol = '#2a2a30';
  // caudal: black with a white trailing margin
  const tail = caudal({ P, root: 0.07, up: [-0.5, -0.19], lo: [-0.5, 0.19], notch: [-0.472, 0.0], lead: 0.05, trail: -0.04 });
  fin(g, res, {
    pts: tail, stops: [[0, '#2a2520'], [0.3, INK], [1, '#1a1820']], axis: [-0.3, 0, -0.5, 0],
    rays: { n: 20, to: [3, 7], from: tail.root, col: '#6a6a70', a: 0.22, fade: 0.3, w: 0.0015, curl: 0.03 },
    margin: { col: rgba(WHITE, 0.92), w: 0.011, from: 3, to: 7 },
    scallop: { from: 3, to: 7, n: 10, depth: 0.002 },
  });
  // dorsal: short first spines, the (separately drawn) streamer's base, then a tall angular fin carrying the bars
  const dorsal = ridge(P, 'top', [[0.215, -0.012], [0.205, 0.05], [0.185, 0.11], [0.155, 0.16], [0.12, 0.185], [0.08, 0.17], [0.0, 0.14], [-0.1, 0.115], [-0.2, 0.092], [-0.27, 0.07], [-0.295, 0.045, 1], [-0.31, -0.012]], 0.2);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal, col: INK, axis: [0.0, -0.3, -0.02, -0.48],
    paint: (gg) => barsOn(gg, -0.6, 0.0),
    rays: { n: 24, from: [[0.2, dTop(0.2)], [-0.3, dTop(-0.3)]], lean: [0.2, 1.0], col: rayCol, a: 0.3, w: 0.0015, hl: '#ffffff', hla: 0.14 },
    edge: { col: 'rgba(20,20,30,0.35)', w: 0.003, to: 3 },
    tension: 0.7,
  });
  const anal = ridge(P, 'bot', [[-0.025, -0.012], [-0.055, 0.075], [-0.105, 0.135, 1], [-0.19, 0.105], [-0.265, 0.062], [-0.3, -0.012]], 0.4);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal, col: INK, axis: [-0.12, 0.27, -0.13, 0.42],
    paint: (gg) => barsOn(gg, 0.0, 0.6),
    rays: { n: 15, from: [[-0.035, aBot(-0.035)], [-0.29, aBot(-0.29)]], lean: [0.4, 1.0], up: 1, col: rayCol, a: 0.3, w: 0.0015, hl: '#ffffff', hla: 0.14 },
    edge: { col: 'rgba(20,20,30,0.35)', w: 0.003, to: 2 },
  });
  const pelvic = (dx, a) => {
    const y = P.bot(0.23);
    fin(g, res, {
      pts: [[0.25 + dx, y - 0.014], [0.21 + dx, y + 0.06], [0.135 + dx, y + 0.15, 1], [0.165 + dx, y + 0.07], [0.195 + dx, y - 0.014]],
      stops: [[0, rgba('#2a2520', a)], [1, rgba(INK, a)]], axis: [0.22, y, 0.14, y + 0.15],
      rays: { n: 6, to: [1, 3], from: [[0.24 + dx, y], [0.2 + dx, y]], col: '#6a6a70', a: 0.25, w: 0.0015 },
      margin: { col: 'rgba(230,235,245,0.35)', w: 0.003, from: 1, to: 3 },
    });
  };
  pelvic(-0.02, 0.5);

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, '#e9e4d8'], [0.5, WHITE], [1, '#efeae0']]);
      // yellow grading in before the second bar, orange-yellow peduncle, pale-blue line
      U.path([[0.02, -0.02], [-0.09, -0.02], [-0.09, 1.02], [0.02, 1.02]], true, true);
      const gr = t.createLinearGradient(U.X(0.02), 0, U.X(-0.09), 0);
      gr.addColorStop(0, rgba(YEL, 0));
      gr.addColorStop(1, YEL);
      t.fillStyle = gr;
      t.fill();
      U.path([[BAR2[1] - 0.012, -0.02], [-0.345, -0.02], [-0.345, 1.02], [BAR2[1] - 0.012, 1.02]], true, true);
      t.fillStyle = mixc(YEL, ORANGE, 0.5);
      t.fill();
      U.path([[BAR2[1], -0.02], [BAR2[1] - 0.012, -0.02], [BAR2[1] - 0.012, 1.02], [BAR2[1], 1.02]], true, true);
      t.fillStyle = '#dfe9f4';
      t.fill();
      // the two black bars (bar 1 widens toward the belly)
      soft(t, U.H * 0.004, INK, () => {
        U.path([[BAR1[0] - 0.01, -0.02], [BAR1[0] + 0.012, 0.3], [BAR1[0] - 0.015, 0.7], [BAR1[0] - 0.06, 1.02], [BAR1[1] - 0.01, 1.02], [BAR1[1] - 0.015, 0.5], [BAR1[1], -0.02]], true);
        t.fill();
        U.path([[BAR2[0], -0.02], [BAR2[0] - 0.006, 0.5], [BAR2[0], 1.02], [BAR2[1], 1.02], [BAR2[1] + 0.006, 0.5], [BAR2[1], -0.02]], true);
        t.fill();
      });
      // snout: orange saddle over the bridge (black edged) and a black chin
      soft(t, U.H * 0.003, INK, () => {
        U.path([[0.47, 0.02], [0.44, 0.0], [0.385, 0.02], [0.372, 0.22], [0.4, 0.42], [0.45, 0.42], [0.48, 0.3]], true);
        t.fill();
      });
      soft(t, U.H * 0.003, ORANGE, () => {
        U.path([[0.465, 0.06], [0.44, 0.03], [0.395, 0.05], [0.385, 0.2], [0.405, 0.36], [0.445, 0.36], [0.47, 0.26]], true);
        t.fill();
      });
      U.path([[0.5, 0.62], [0.41, 0.74], [0.4, 1.02], [0.5, 1.02]], true);
      t.fillStyle = INK;
      t.fill();
    },
    over(gg) {
      mottle(gg, -0.34, -0.32, 0.5, 0.31, { color: '#3a3a4a', a: 0.1, scale: 0.34, lo: 0.42, hi: 0.72, seed: 3 + v });
      scales(gg, res, P, { rows: 30, x0: -0.3, x1: 0.3, dark: '#20202a', da: 0.12, la: 0.1, lw: 0.08, rng });
    },
    shade: { dark: '#1a1830', light: '#ffffff', sheen: 0.3, sheenV: 0.18, sheenW: 0.14, gloss: 0.25, belly: 0.32, bounce: 0.5, rim: 0.3, topLight: 0.1 },
    face(gg) {
      gill(gg, res, { x: 0.255, y0: -0.16, y1: 0.2, bulge: 0.03, dark: '#000008', a: 0.3, shadow: 0.2, la: 0.1, w: 0.0024 });
      spot(gg, 0.455, 0.03, 0.004, '#1a1a24', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.0, dark: '#101018', a: 0.7, w: 0.003, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.31, -0.11, 0.03, { iris: '#3a3028', irisDark: '#100c08', pupil: 0.6, ring: 'rgba(0,0,0,0.5)', rim: 'rgba(240,230,200,0.6)', socket: 0.1 });
      glint(gg, 0.38, -0.2, 0.03, 0.006, 0.3, -0.9);
    },
  });
  pelvic(0, 1);
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.248, 0.028], [0.2, 0.012], [0.13, 0.04], [0.095, 0.095, 1], [0.125, 0.13], [0.2, 0.118], [0.248, 0.085]],
    stops: [[0, 'rgba(236,232,222,0.7)'], [0.5, 'rgba(240,238,232,0.45)'], [1, 'rgba(255,255,250,0.3)']], axis: [0.245, 0.058, 0.1, 0.1],
    rays: { n: 12, to: [2, 5], from: [[0.243, 0.032], [0.246, 0.082]], col: '#3a3a40', a: 0.3, w: 0.0014, hl: '#ffffff', hla: 0.2 },
    outline: { col: 'rgba(30,30,40,0.25)', w: 0.0015 },
  });
  erase(g, 0.242, 0.058, 0.02, 0.9, 0.2, 0.026);
}

// the streamer: a tapering white ribbon arching over the body and trailing far behind the tail
const STREAM_BOX = { x0: -0.97, x1: 0.22, y0: -0.8, y1: -0.3 };
function paintStreamer(g, res) {
  const sp = sampleSpline([[0.1, -0.44], [0.05, -0.59], [-0.06, -0.69], [-0.22, -0.75], [-0.44, -0.73], [-0.68, -0.64], [-0.94, -0.52]], 12).poly;
  const n = sp.length, up = [], lo = [];
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = 0.013 * Math.pow(1 - i / (n - 1), 1.2) + 0.0022;
    up.push([sp[i][0] - (dy / d) * w, sp[i][1] + (dx / d) * w]);
    lo.push([sp[i][0] + (dy / d) * w, sp[i][1] - (dx / d) * w]);
  }
  g.beginPath();
  tracePoly(g, up);
  tracePoly(g, lo, false, n - 1, 0);
  g.closePath();
  const gr = g.createLinearGradient(0.1, -0.44, -0.9, -0.52);
  gr.addColorStop(0, '#f7f3ea');
  gr.addColorStop(0.08, '#f4f1ea');
  gr.addColorStop(1, 'rgba(255,255,255,0.75)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(40,40,60,0.28)';
  g.lineWidth = 0.0015;
  g.beginPath();
  tracePoly(g, up, true, 2, n - 1);
  g.stroke();
  g.beginPath();
  tracePoly(g, lo, true, 2, n - 1);
  g.stroke();
}
const SW = { phase: 0, k: 0, swing: 0, head: 0.1, power: 2, sq: 0, phase2: 0, k2: 0, swing2: 0 };

export const def = {
  id: 'moorish_idol',
  bounds: { x0: -0.97, x1: 0.5, y0: -0.8, y1: 0.4 },
  box: { x0: -0.52, x1: 0.52, y0: -0.53, y1: 0.43 },
  mouth: { x: 0.495, y: 0.084 },
  paint,
  swim: { swing: 0.035, waves: 1.1, power: 1.8, head: 0.1, squash: 0.02, idle: 0.08 },
  parts: [{ key: 'pec', box: { x0: 0.07, x1: 0.27, y0: -0.01, y1: 0.15 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.45, lock: 1, squash: 0.4 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.3, cavity: '#1a0a12' },
  gillSlit: { x: 0.255, y0: -0.15, y1: 0.19, bulge: 0.03 },
  over(ctx, len, anim, opts, st, w, R) {
    const spr = variantFor(unitSprite('moorish_idol/streamer', STREAM_BOX, R.lenPx, paintStreamer), opts);
    SW.phase = w.phase;
    SW.k = w.k;
    SW.swing = w.swing * 1.35;
    SW.head = 0.2;
    SW.power = 1.5;
    SW.sq = w.sq;
    SW.swing2 = len * 0.014 * (0.6 + Math.min(1, anim.amp));
    SW.phase2 = anim.t * 6.5 + anim.uid;
    SW.k2 = 9;
    blitSwim(ctx, spr, len, SW, Math.min(14, R.n + 3), R.ov);
  },
};
