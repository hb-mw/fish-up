// Yellowfin tuna (Thunnus albacares) — torpedo with a dark metallic-blue back, a golden lateral band, silver-white
// belly with broken vertical lines of pale spots, long sickle-shaped bright-yellow second dorsal / anal fins and
// yellow finlets edged black, long pectorals, lunate tail.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { finletRow, keels, bellyMarks, corselet, uvMottle } from './tuna-extra.js';

const P = profile(
  [[0.5, 0.0], [0.49, -0.022], [0.46, -0.054], [0.41, -0.086], [0.33, -0.112], [0.22, -0.128], [0.1, -0.13], [-0.02, -0.12], [-0.14, -0.096], [-0.24, -0.066], [-0.31, -0.04], [-0.355, -0.022], [-0.38, -0.015]],
  [[0.5, 0.0], [0.49, 0.02], [0.46, 0.048], [0.41, 0.076], [0.33, 0.1], [0.22, 0.116], [0.1, 0.12], [-0.02, 0.112], [-0.14, 0.09], [-0.24, 0.062], [-0.31, 0.038], [-0.355, 0.021], [-0.38, 0.015]],
);
const HINGE = [0.412, 0.044], TIP = [0.5, 0.001], CORNER = [0.44, 0.028];
const PEC = [0.25, 0.026];

function paint(g, res, v) {
  const rng = createRng(401 + v * 13);
  const dh = [-5, 0, 6][v];
  const back = shift('#0b1a3a', dh, 0, 0), steel = shift('#1d3f7a', dh, 0, 0), flank = shift('#3f6fa8', dh, 0, 0);
  const gold = shift('#e9c23a', [-4, 0, 5][v], 0, 0), goldLt = lite(gold, 0.3);
  const silver = '#c6d0dc', belly = '#f4f6f8';
  const finY = shift('#f2cc2e', [-4, 0, 5][v], 0, 0);

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.08, up: [-0.5, -0.21], lo: [-0.5, 0.21], notch: [-0.398, 0], lead: 0.14, trail: 0.14 });
  fin(g, res, {
    pts: tail,
    stops: [[0, '#2c3c56'], [0.5, '#2a3a54'], [1, rgba(mixc('#4a5a72', gold, 0.35), 0.92)]],
    axis: [-0.33, 0, -0.5, 0],
    rays: { n: 34, to: [3, 7], from: tail.root, col: '#060c18', a: 0.35, fade: 0.3, w: 0.0014, curl: 0.03, hl: '#d8c890', hla: 0.12 },
    scallop: { from: 3, to: 7, n: 13, depth: 0.0025 },
    margin: { col: 'rgba(240,220,150,0.25)', w: 0.004, from: 3, to: 7 },
    edge: { col: 'rgba(5,10,24,0.45)', w: 0.003, to: 3 },
  });
  // first dorsal: spiny, grey-blue with a yellow cast
  const d1 = ridge(P, 'top', [[0.165, -0.012], [0.152, 0.062], [0.14, 0.088, 1], [0.085, 0.055], [0.03, 0.028], [-0.02, 0.012], [-0.04, -0.012]], 0.2);
  fin(g, res, {
    pts: d1,
    stops: [[0, rgba('#283a5c', 0.98)], [0.5, rgba(mixc('#4a6290', gold, 0.25), 0.95)], [1, rgba(mixc('#8a98b0', finY, 0.4), 0.88)]],
    rays: { n: 13, from: [[0.158, P.top(0.158) + 0.01], [-0.035, P.top(-0.035) + 0.01]], lean: [0.2, 1.2], col: '#0a1424', a: 0.4, w: 0.0018, hl: '#e8e0b8', hla: 0.1 },
    edge: { col: 'rgba(5,10,24,0.4)', w: 0.0028, to: 2 },
    shade: 'rgba(5,12,30,0.35)',
    tension: 0.8,
  });
  // second dorsal: the long bright-yellow sickle, then 9 finlets
  const d2 = ridge(P, 'top', [[-0.058, -0.012], [-0.066, 0.045], [-0.084, 0.1], [-0.118, 0.148], [-0.19, 0.188, 1], [-0.15, 0.13], [-0.122, 0.078], [-0.106, 0.03], [-0.108, -0.012]], 0.3);
  fin(g, res, {
    pts: d2,
    stops: [[0, mixc(finY, '#8a6a10', 0.3)], [0.5, finY], [1, rgba(goldLt, 0.86)]],
    rays: { n: 11, from: [[-0.064, P.top(-0.064) + 0.01], [-0.106, P.top(-0.106) + 0.01]], lean: [0.5, 2.2], col: '#6a4a08', a: 0.4, w: 0.0016, hl: '#fff4c0', hla: 0.16, curl: 0.05 },
    edge: { col: 'rgba(90,60,10,0.35)', w: 0.0026, to: 4 },
    mottle: { color: '#b07a00', a: 0.14, scale: 0.3, lo: 0.45, hi: 0.8, seed: 7 },
  });
  finletRow(g, res, P, 'top', -0.14, -0.34, 9, 0.019, finY, 'rgba(10,10,10,0.6)', 1.15);
  // anal: mirror sickle + 9 finlets
  const an = ridge(P, 'bot', [[-0.068, -0.012], [-0.076, 0.045], [-0.094, 0.098], [-0.128, 0.142], [-0.2, 0.178, 1], [-0.16, 0.124], [-0.132, 0.074], [-0.116, 0.028], [-0.118, -0.012]], 0.3);
  fin(g, res, {
    pts: an,
    stops: [[0, mixc(finY, '#8a6a10', 0.3)], [0.5, finY], [1, rgba(goldLt, 0.86)]],
    rays: { n: 11, from: [[-0.074, P.bot(-0.074) - 0.01], [-0.116, P.bot(-0.116) - 0.01]], lean: [0.5, 2.2], up: 1, col: '#6a4a08', a: 0.4, w: 0.0016, hl: '#fff4c0', hla: 0.16, curl: -0.05 },
    edge: { col: 'rgba(90,60,10,0.35)', w: 0.0026, to: 4 },
    mottle: { color: '#b07a00', a: 0.14, scale: 0.3, lo: 0.45, hi: 0.8, seed: 8 },
  });
  finletRow(g, res, P, 'bot', -0.15, -0.34, 9, 0.018, finY, 'rgba(10,10,10,0.6)', 1.15);
  // pelvic (small, yellowish grey)
  const py = P.bot(0.215);
  fin(g, res, {
    pts: [[0.228, py - 0.012], [0.215, py + 0.03], [0.172, py + 0.062, 1], [0.185, py + 0.025], [0.198, py - 0.012]],
    stops: [[0, '#4a5a70'], [1, rgba(mixc('#8a94a4', finY, 0.4), 0.9)]],
    rays: { n: 6, to: [1, 3], from: [[0.224, py - 0.004], [0.202, py - 0.004]], col: '#0a1424', a: 0.4, w: 0.0015 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.045,
    skin(t, U) {
      U.grad([[0, dark(back, 0.3)], [0.08, back], [0.2, steel], [0.3, flank], [0.38, mixc(flank, gold, 0.4)], [0.44, gold], [0.52, mixc(gold, silver, 0.55)], [0.6, silver], [0.78, mixc(silver, belly, 0.6)], [0.92, belly], [1, '#ffffff']]);
      // the golden band glows a little brighter mid-body; a cool flash along the back
      U.glow(0.0, 0.44, 0.4, 0.07, goldLt, 0.45);
      U.glow(0.05, 0.27, 0.42, 0.07, '#7fb0e8', 0.26);
      uvMottle(t, U, { color: '#050c1c', a: 0.35, scale: 0.4, lo: 0.42, hi: 0.75, seed: 31 + v, v0: 0, v1: 0.36, feather: 0.1 });
      uvMottle(t, U, { color: '#bfe0ff', a: 0.14, scale: 0.3, lo: 0.5, hi: 0.8, seed: 33, v0: 0.55, v1: 0.95, feather: 0.1, sy: 0.6 });
    },
    over(gg) {
      corselet(gg, P, 0.0, 0.26, '#1a3060', 0.12);
      bellyMarks(gg, res, P, rng, 0.24, -0.32, 21, '#ffffff', 0.36);
      scales(gg, res, P, { rows: 30, x0: -0.33, x1: 0.26, dark: '#0a1a3a', da: 0.13, la: 0.08, aspect: 1.1, rng, xFade: (x) => Math.min(1, (0.26 - x) / 0.04), vFade: (vv) => 0.75 - 0.4 * Math.max(0, Math.min(1, (vv - 0.4) / 0.4)) });
      gg.strokeStyle = 'rgba(255,255,255,0.16)';
      gg.lineWidth = Math.max(0.0022, 0.6 / res);
      gg.beginPath();
      P.line(gg, (x) => (x > 0.1 ? 0.3 + (0.26 - x) * 0.7 : 0.41 - (0.1 - x) * 0.05), 0.26, -0.35, 40, true);
      gg.stroke();
    },
    shade: { dark: '#050c1c', sheen: 0.3, sheenV: 0.18, sheenW: 0.09, gloss: 0.35, belly: 0.3, bounce: 0.7, rim: 0.36, topLight: 0.22, breakup: 0.45 },
    face(gg) {
      spot(gg, 0.35, 0.03, 0.07, '#ffffff', 0.3, 0.05, 0.045);
      soft(gg, 0.012, 'rgba(10,20,50,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.18, 0.05, 0.08, 0.015, -0.15, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.33, y0: -0.05, y1: 0.066, bulge: 0.015, dark: '#0e1a34', a: 0.18, shadow: 0.14, la: 0.1, w: 0.002 });
      gill(gg, res, { x: 0.268, y0: -0.094, y1: 0.098, bulge: 0.03, dark: '#0a1530', a: 0.45, shadow: 0.28, plate: 0.2, w: 0.0024 });
      spot(gg, 0.455, -0.024, 0.0035, '#0a1428', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.006, dark: '#0a1020', a: 0.6, w: 0.003, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.372, -0.03, 0.02, { iris: '#8a98a8', irisDark: '#2a3442', pupil: 0.64, ring: 'rgba(10,16,30,0.4)', rim: 'rgba(255,232,190,0.5)', socket: 0.25 });
      glint(gg, 0.43, -0.066, 0.02, 0.004, 0.22, -0.45);
      keels(gg, res, P, -0.3, -0.372, '#2a2a30', '#d8d0a8');
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.262, 0.012], [0.19, 0.02], [0.05, 0.05], [-0.075, 0.06, 1], [0.02, 0.064], [0.17, 0.056], [0.26, 0.04]],
    stops: [[0, 'rgba(50,68,100,0.95)'], [0.45, 'rgba(96,116,146,0.85)'], [1, 'rgba(176,184,192,0.55)']],
    axis: [0.26, 0.028, -0.075, 0.06],
    rays: { n: 16, to: [3, 5], from: [[0.26, 0.016], [0.258, 0.036]], col: '#060c18', a: 0.3, w: 0.0014, hl: '#c8d4e8', hla: 0.14, curl: 0.03 },
    edge: { col: 'rgba(5,10,24,0.35)', w: 0.0024, to: 3 },
    margin: { col: 'rgba(230,220,180,0.25)', w: 0.003, from: 3, to: 5 },
  });
  erase(g, 0.268, 0.026, 0.02, 0.9, 0.25, 0.024);
}

export const def = {
  id: 'yellowfin_tuna',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.31, y1: 0.3 },
  mouth: { x: 0.49, y: 0.008 },
  paint,
  swim: { swing: 0.035, waves: 0.9, power: 3.4, head: 0.03, squash: 0.04, freq: 1.6, thrash: 1.4, idle: 0.04 },
  parts: [{ key: 'pec', box: { x0: -0.11, x1: 0.28, y0: 0.0, y1: 0.08 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.0, amp: 0.035, rate: 1.7, squash: 0.06 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.42, throat: '#6a2630', cavity: '#1e0810' },
  gillSlit: { x: 0.268, y0: -0.084, y1: 0.094, bulge: 0.03 },
};
