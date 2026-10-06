// Bluefin tuna (Thunnus thynnus) — a massive deep torpedo: blue-black back, silver-white lower flanks with
// pale spots and lines, short pectorals, dusky-yellow finlets edged black, dark lunate tail with a black keel.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { finletRow, keels, bellyMarks, corselet, uvMottle } from './tuna-extra.js';

const P = profile(
  [[0.5, 0.0], [0.49, -0.024], [0.46, -0.058], [0.41, -0.092], [0.33, -0.122], [0.22, -0.14], [0.12, -0.144], [0.0, -0.134], [-0.12, -0.108], [-0.22, -0.076], [-0.3, -0.046], [-0.35, -0.026], [-0.378, -0.017]],
  [[0.5, 0.0], [0.49, 0.02], [0.46, 0.05], [0.41, 0.08], [0.33, 0.108], [0.22, 0.128], [0.12, 0.134], [0.0, 0.126], [-0.12, 0.1], [-0.22, 0.07], [-0.3, 0.042], [-0.35, 0.024], [-0.378, 0.017]],
);
const HINGE = [0.412, 0.046], TIP = [0.5, 0.001], CORNER = [0.44, 0.03];
const PEC = [0.25, 0.028];

function paint(g, res, v) {
  const rng = createRng(301 + v * 13);
  const dh = [-5, 0, 6][v];
  const back = shift('#0c1a36', dh, 0, 0), steel = shift('#1f4178', dh, 0, 0), flank = shift('#4c76ab', dh, 0, 0);
  const silver = '#c3cfdc', belly = '#f3f6f9';
  const finlet = '#c8b45c';

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.08, up: [-0.5, -0.215], lo: [-0.5, 0.215], notch: [-0.4, 0], lead: 0.06, trail: 0.22 });
  fin(g, res, {
    pts: tail,
    stops: [[0, '#243a5e'], [0.5, '#1d2d4a'], [1, rgba('#3a4d6e', 0.9)]],
    axis: [-0.33, 0, -0.5, 0],
    rays: { n: 34, to: [3, 7], from: tail.root, col: '#060c18', a: 0.35, fade: 0.3, w: 0.0014, curl: 0.03, hl: '#8fa6c8', hla: 0.12 },
    scallop: { from: 3, to: 7, n: 13, depth: 0.0025 },
    margin: { col: 'rgba(170,190,220,0.22)', w: 0.004, from: 3, to: 7 },
    edge: { col: 'rgba(5,10,24,0.45)', w: 0.003, to: 3 },
  });
  // first dorsal: tall spiny triangle, hollow rear edge
  const d1 = ridge(P, 'top', [[0.165, -0.012], [0.152, 0.07], [0.138, 0.096, 1], [0.08, 0.06], [0.02, 0.03], [-0.03, 0.012], [-0.05, -0.012]], 0.2);
  fin(g, res, {
    pts: d1,
    stops: [[0, rgba('#2a3f66', 0.98)], [0.5, rgba('#4a5e86', 0.95)], [1, rgba(mixc('#8a9ab8', finlet, 0.35), 0.88)]],
    rays: { n: 13, from: [[0.158, P.top(0.158) + 0.01], [-0.045, P.top(-0.045) + 0.01]], lean: [0.2, 1.2], col: '#0a1424', a: 0.4, w: 0.0018, hl: '#c8d4ea', hla: 0.1 },
    edge: { col: 'rgba(5,10,24,0.4)', w: 0.0028, to: 2 },
    shade: 'rgba(5,12,30,0.35)',
    tension: 0.8,
  });
  // second dorsal: short reddish-brown sickle, then 9 finlets
  const d2 = ridge(P, 'top', [[-0.072, -0.012], [-0.08, 0.04], [-0.095, 0.078], [-0.118, 0.09, 1], [-0.112, 0.05], [-0.118, 0.02], [-0.13, -0.012]], 0.45);
  fin(g, res, {
    pts: d2,
    stops: [[0, '#5a3d3a'], [0.6, rgba('#7a5a52', 0.92)], [1, rgba('#9a8078', 0.8)]],
    rays: { n: 9, from: [[-0.08, P.top(-0.08) + 0.01], [-0.145, P.top(-0.145) + 0.01]], lean: [0.5, 1.6], col: '#2a1410', a: 0.4, w: 0.0016 },
    edge: { col: 'rgba(30,12,8,0.4)', w: 0.0026, to: 2 },
  });
  finletRow(g, res, P, 'top', -0.155, -0.335, 9, 0.019, finlet, 'rgba(10,10,10,0.55)', 1.15);
  // anal fin + finlets
  const an = ridge(P, 'bot', [[-0.085, -0.012], [-0.092, 0.036], [-0.106, 0.068], [-0.128, 0.08, 1], [-0.122, 0.045], [-0.128, 0.018], [-0.14, -0.012]], 0.45);
  fin(g, res, {
    pts: an,
    stops: [[0, '#8a8a80'], [0.6, rgba('#c9c0a0', 0.92)], [1, rgba('#e0d8b8', 0.8)]],
    rays: { n: 9, from: [[-0.095, P.bot(-0.095) - 0.01], [-0.155, P.bot(-0.155) - 0.01]], lean: [0.5, 1.6], up: 1, col: '#3a3220', a: 0.4, w: 0.0016 },
    edge: { col: 'rgba(40,36,20,0.4)', w: 0.0026, to: 2 },
  });
  finletRow(g, res, P, 'bot', -0.162, -0.335, 8, 0.018, finlet, 'rgba(10,10,10,0.55)', 1.15);
  // pelvic (small, dark)
  const py = P.bot(0.215);
  fin(g, res, {
    pts: [[0.228, py - 0.012], [0.215, py + 0.03], [0.175, py + 0.06, 1], [0.185, py + 0.025], [0.198, py - 0.012]],
    stops: [[0, '#2a3a58'], [1, rgba('#5a6d8c', 0.9)]],
    rays: { n: 6, to: [1, 3], from: [[0.224, py - 0.004], [0.202, py - 0.004]], col: '#0a1424', a: 0.4, w: 0.0015 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.045,
    skin(t, U) {
      U.grad([[0, dark(back, 0.3)], [0.08, back], [0.2, steel], [0.32, flank], [0.42, '#8aa6c6'], [0.52, silver], [0.7, mixc(silver, belly, 0.6)], [0.88, belly], [1, '#ffffff']]);
      // a cool metallic flash along the upper flank, dark cloudiness on the back, pearl on the silver
      U.glow(0.05, 0.3, 0.42, 0.08, '#7fb0e8', 0.3);
      uvMottle(t, U, { color: '#050c1c', a: 0.35, scale: 0.4, lo: 0.42, hi: 0.75, seed: 21 + v, v0: 0, v1: 0.4, feather: 0.1 });
      uvMottle(t, U, { color: '#9ec8ff', a: 0.16, scale: 0.3, lo: 0.5, hi: 0.8, seed: 23, v0: 0.4, v1: 0.9, feather: 0.1, sy: 0.6 });
    },
    over(gg) {
      corselet(gg, P, 0.0, 0.26, '#1a3060', 0.14);
      bellyMarks(gg, res, P, rng, 0.22, -0.3, 19, '#ffffff', 0.32);
      scales(gg, res, P, { rows: 30, x0: -0.33, x1: 0.26, dark: '#0a1a3a', da: 0.14, la: 0.08, aspect: 1.1, rng, xFade: (x) => Math.min(1, (0.26 - x) / 0.04), vFade: (vv) => (vv < 0.45 ? 0.9 : 0.45) });
      // lateral line: a faint pale wave from the gill cover down along the flank
      gg.strokeStyle = 'rgba(255,255,255,0.18)';
      gg.lineWidth = Math.max(0.0022, 0.6 / res);
      gg.beginPath();
      P.line(gg, (x) => (x > 0.1 ? 0.3 + (0.26 - x) * 0.8 : 0.43 - (0.1 - x) * 0.05), 0.26, -0.35, 40, true);
      gg.stroke();
    },
    shade: { dark: '#050c1c', sheen: 0.3, sheenV: 0.19, sheenW: 0.09, gloss: 0.35, belly: 0.34, bounce: 0.7, rim: 0.36, topLight: 0.22, breakup: 0.45 },
    face(gg) {
      spot(gg, 0.35, 0.03, 0.07, '#ffffff', 0.3, 0.05, 0.045);
      // shadow under the pectoral root
      soft(gg, 0.012, 'rgba(10,20,50,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.2, 0.05, 0.07, 0.016, -0.2, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.33, y0: -0.05, y1: 0.07, bulge: 0.015, dark: '#0e1a34', a: 0.18, shadow: 0.14, la: 0.1, w: 0.002 });
      gill(gg, res, { x: 0.268, y0: -0.1, y1: 0.105, bulge: 0.03, dark: '#0a1530', a: 0.45, shadow: 0.28, plate: 0.2, w: 0.0024 });
      spot(gg, 0.455, -0.025, 0.0035, '#0a1428', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.006, dark: '#0a1020', a: 0.6, w: 0.003, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.372, -0.032, 0.021, { iris: '#8a98a8', irisDark: '#2a3442', pupil: 0.64, ring: 'rgba(10,16,30,0.4)', rim: 'rgba(255,232,190,0.5)', socket: 0.25 });
      glint(gg, 0.43, -0.07, 0.02, 0.004, 0.22, -0.45);
      keels(gg, res, P, -0.3, -0.37, '#050a16', '#aab8cc');
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.262, 0.016], [0.22, 0.02], [0.1, 0.05, 1], [0.15, 0.062], [0.23, 0.052], [0.26, 0.04]],
    stops: [[0, 'rgba(40,58,90,0.96)'], [0.5, 'rgba(70,92,128,0.9)'], [1, 'rgba(120,142,172,0.72)']],
    axis: [0.26, 0.03, 0.1, 0.052],
    rays: { n: 14, to: [2, 4], from: [[0.26, 0.02], [0.258, 0.038]], col: '#060c18', a: 0.3, w: 0.0014, hl: '#b8ccea', hla: 0.14 },
    edge: { col: 'rgba(5,10,24,0.35)', w: 0.0024, to: 2 },
    margin: { col: 'rgba(200,220,245,0.25)', w: 0.003, from: 2, to: 4 },
  });
  erase(g, 0.268, 0.028, 0.02, 0.9, 0.25, 0.024);
}

export const def = {
  id: 'bluefin_tuna',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.245, y1: 0.215 },
  mouth: { x: 0.49, y: 0.008 },
  paint,
  swim: { swing: 0.035, waves: 0.9, power: 3.4, head: 0.03, squash: 0.04, freq: 1.6, thrash: 1.4, idle: 0.04 },
  parts: [{ key: 'pec', box: { x0: 0.08, x1: 0.28, y0: 0.0, y1: 0.08 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.02, amp: 0.04, rate: 1.8, squash: 0.06 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.42, throat: '#6a2630', cavity: '#1e0810' },
  gillSlit: { x: 0.268, y0: -0.09, y1: 0.1, bulge: 0.03 },
};
