// Mahi-mahi / dorado (Coryphaena hippurus), bull male — blunt near-vertical forehead, body deepest at the head
// tapering to a slim peduncle, one long dark-blue dorsal down the whole back, electric green-gold flanks with blue
// flecks, golden belly, deeply forked yellow-green tail.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { uvMottle } from './tuna-extra.js';

const P = profile(
  [[0.5, 0.022], [0.496, -0.03], [0.487, -0.085], [0.47, -0.13], [0.44, -0.16], [0.39, -0.172], [0.3, -0.166], [0.18, -0.152], [0.04, -0.126], [-0.1, -0.096], [-0.22, -0.066], [-0.31, -0.04], [-0.355, -0.024], [-0.375, -0.02]],
  [[0.5, 0.022], [0.496, 0.045], [0.487, 0.064], [0.47, 0.082], [0.44, 0.096], [0.39, 0.108], [0.3, 0.114], [0.18, 0.112], [0.04, 0.1], [-0.1, 0.082], [-0.22, 0.058], [-0.31, 0.036], [-0.355, 0.024], [-0.375, 0.02]],
);
const HINGE = [0.4, 0.062], TIP = [0.5, 0.024], CORNER = [0.432, 0.05];
const PEC = [0.275, 0.03];

function paint(g, res, v) {
  const rng = createRng(601 + v * 13);
  const dh = [-6, 0, 7][v];
  const backC = shift('#0f4f62', dh, 0, 0), teal = shift('#1a8e88', dh, 0, 0), green = shift('#52c07a', dh, 0, 0);
  const lime = shift('#a8d85a', dh, 0, 0), gold = shift('#f0cc3a', dh, 0, 0), goldLt = '#f8e27a';
  const finBlue = shift('#1c4a8c', dh, 0, 0);

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.075, up: [-0.5, -0.19], lo: [-0.5, 0.19], notch: [-0.395, 0], lead: 0.12, trail: 0.0 });
  fin(g, res, {
    pts: tail,
    stops: [[0, mixc(gold, green, 0.5)], [0.5, mixc(gold, '#c8d84a', 0.5)], [1, rgba(goldLt, 0.82)]],
    axis: [-0.33, 0, -0.5, 0],
    rays: { n: 30, to: [3, 7], from: tail.root, col: '#6a5a08', a: 0.32, fade: 0.35, w: 0.0014, curl: 0.04, hl: '#fff8c0', hla: 0.16 },
    scallop: { from: 3, to: 7, n: 13, depth: 0.003 },
    margin: { col: 'rgba(255,250,200,0.25)', w: 0.004, from: 3, to: 7 },
    edge: { col: 'rgba(80,70,10,0.3)', w: 0.0026, to: 3 },
    mottle: { color: '#3a8a40', a: 0.18, scale: 0.3, lo: 0.45, hi: 0.8, seed: 12 },
  });
  // the long dorsal: tallest just behind the crest, running to the peduncle
  const dor = ridge(P, 'top', [[0.4, -0.014], [0.385, 0.03], [0.345, 0.07], [0.28, 0.088], [0.16, 0.09], [0.02, 0.082], [-0.12, 0.068], [-0.24, 0.05], [-0.31, 0.032], [-0.335, 0.012], [-0.345, -0.012]], 0.22);
  fin(g, res, {
    pts: dor,
    stops: [[0, rgba(dark(finBlue, 0.2), 0.98)], [0.45, rgba(finBlue, 0.94)], [1, rgba(mixc(finBlue, '#4fb0b8', 0.55), 0.84)]],
    axis: [0.1, -0.14, 0.05, -0.25],
    rays: { n: 44, from: [[0.39, P.top(0.39) + 0.012], [-0.34, P.top(-0.34) + 0.012]], lean: [0.15, 0.9], col: '#08142e', a: 0.4, fade: 0.4, w: 0.0015, hl: '#8fd0e0', hla: 0.12 },
    scallop: { from: 2, to: 9, n: 30, depth: 0.0022 },
    edge: { col: 'rgba(8,20,46,0.4)', w: 0.0026, to: 2 },
    shade: 'rgba(5,15,40,0.4)',
    mottle: { color: '#061a40', a: 0.2, scale: 0.35, lo: 0.42, hi: 0.78, seed: 13 },
    tension: 0.85,
  });
  // anal fin: long, low, hollow-edged, yellow-green
  const an = ridge(P, 'bot', [[-0.03, -0.012], [-0.042, 0.054, 1], [-0.085, 0.036], [-0.2, 0.026], [-0.29, 0.018], [-0.325, 0.008], [-0.34, -0.012]], 0.45);
  fin(g, res, {
    pts: an,
    stops: [[0, rgba(mixc(gold, green, 0.4), 0.92)], [1, rgba(goldLt, 0.62)]],
    rays: { n: 24, from: [[-0.036, P.bot(-0.036) - 0.012], [-0.335, P.bot(-0.335) - 0.012]], lean: [0.5, 1.4], up: 1, col: '#5a5008', a: 0.32, w: 0.0014, hl: '#ffffff', hla: 0.12 },
    scallop: { from: 1, to: 5, n: 20, depth: 0.002 },
    edge: { col: 'rgba(80,70,10,0.3)', w: 0.0024, to: 1 },
    shade: 'rgba(60,70,20,0.3)',
  });
  // pelvic: long, blue-yellow, lying along the belly
  const py = P.bot(0.27);
  fin(g, res, {
    pts: [[0.285, py - 0.012], [0.265, py + 0.03], [0.17, py + 0.085, 1], [0.2, py + 0.04], [0.238, py + 0.008], [0.25, py - 0.012]],
    stops: [[0, rgba(mixc(finBlue, gold, 0.3), 0.95)], [1, rgba(mixc(gold, '#ffffff', 0.3), 0.8)]],
    rays: { n: 7, to: [1, 3], from: [[0.28, py - 0.004], [0.254, py - 0.004]], col: '#2a3a40', a: 0.35, w: 0.0014 },
    edge: { col: 'rgba(20,40,70,0.35)', w: 0.0022, to: 2 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.045,
    skin(t, U) {
      U.grad([[0, dark(backC, 0.25)], [0.08, backC], [0.2, teal], [0.34, green], [0.47, lime], [0.6, mixc(lime, gold, 0.6)], [0.74, gold], [0.9, goldLt], [1, '#fbf0a8']]);
      U.glow(0.1, 0.33, 0.4, 0.08, '#9ff0a0', 0.3);
      U.glow(-0.1, 0.56, 0.3, 0.06, '#fff2a0', 0.3);
      // electric blue haze along the upper flank, soft darker clouds on the back
      U.glow(0.2, 0.22, 0.3, 0.06, '#38c8ff', 0.22);
      uvMottle(t, U, { color: '#063a4a', a: 0.3, scale: 0.4, lo: 0.42, hi: 0.76, seed: 51 + v, v0: 0, v1: 0.42, feather: 0.12 });
      uvMottle(t, U, { color: '#2fb0e0', a: 0.18, scale: 0.3, lo: 0.5, hi: 0.8, seed: 53, v0: 0.25, v1: 0.75, feather: 0.12, sy: 0.7 });
    },
    over(gg) {
      // blue-black flecks scattered over the flank, a few larger pale ones
      for (let i = 0; i < 95; i++) {
        const x = -0.3 + rng.next() * 0.68;
        const vv = 0.12 + Math.pow(rng.next(), 1.3) * 0.6;
        const r = 0.0014 + rng.next() * rng.next() * 0.0032;
        spot(gg, x, P.at(x, vv), r, i % 9 ? '#123a6a' : '#1a7ad0', 0.55 + 0.3 * rng.next(), 0.5, r * (0.8 + 0.4 * rng.next()));
      }
      for (let i = 0; i < 14; i++) {
        const x = -0.25 + rng.next() * 0.55, vv = 0.25 + rng.next() * 0.45;
        spot(gg, x, P.at(x, vv), 0.006 + rng.next() * 0.006, '#9fe8ff', 0.3, 0.3);
      }
      scales(gg, res, P, { rows: 22, x0: -0.33, x1: 0.26, dark: '#0a3a3a', da: 0.14, la: 0.1, rng, xFade: (x) => Math.min(1, (0.26 - x) / 0.04) });
      gg.strokeStyle = 'rgba(0,40,40,0.14)';
      gg.lineWidth = Math.max(0.002, 0.6 / res);
      gg.beginPath();
      P.line(gg, (x) => (x > 0.1 ? 0.28 + (0.26 - x) * 0.6 : 0.37 - (0.1 - x) * 0.06), 0.26, -0.36, 40, true);
      gg.stroke();
    },
    shade: { dark: '#0a3030', sheen: 0.34, sheenV: 0.2, sheenW: 0.1, gloss: 0.3, belly: 0.26, bounce: 0.7, rim: 0.32, topLight: 0.2, breakup: 0.4 },
    face(gg) {
      // the crest and cheek: soft shaping of the big blunt head
      soft(gg, 0.03, 'rgba(10,60,70,0.35)', () => {
        gg.beginPath();
        gg.ellipse(0.47, -0.05, 0.03, 0.09, 0, 0, 7);
        gg.fill();
      });
      spot(gg, 0.36, 0.03, 0.07, '#ffffff', 0.28, 0.05, 0.05);
      soft(gg, 0.012, 'rgba(10,40,50,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.2, 0.052, 0.08, 0.016, -0.15, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.33, y0: -0.07, y1: 0.07, bulge: 0.016, dark: '#0a3040', a: 0.16, shadow: 0.12, la: 0.1, w: 0.002 });
      gill(gg, res, { x: 0.27, y0: -0.13, y1: 0.106, bulge: 0.034, dark: '#06303a', a: 0.45, shadow: 0.28, plate: 0.2, w: 0.0024 });
      spot(gg, 0.47, -0.02, 0.0035, '#0a2030', 0.7, 0.5);
      spot(gg, 0.46, -0.03, 0.0028, '#0a2030', 0.5, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.008, dark: '#0a1a20', a: 0.65, w: 0.0034, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.418, -0.006, 0.02, { iris: '#d8c050', irisDark: '#4a3a10', pupil: 0.58, ring: 'rgba(10,20,30,0.42)', rim: 'rgba(255,245,200,0.45)', socket: 0.25 });
      glint(gg, 0.46, -0.1, 0.03, 0.006, 0.26, -1.1);
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.29, 0.018], [0.24, 0.026], [0.12, 0.072, 1], [0.17, 0.082], [0.24, 0.068], [0.286, 0.048]],
    stops: [[0, 'rgba(220,220,160,0.9)'], [0.5, 'rgba(230,224,150,0.7)'], [1, 'rgba(240,236,170,0.5)']],
    axis: [0.285, 0.032, 0.12, 0.074],
    rays: { n: 14, to: [2, 4], from: [[0.288, 0.022], [0.286, 0.042]], col: '#5a5a20', a: 0.3, w: 0.0014, hl: '#ffffff', hla: 0.14 },
    edge: { col: 'rgba(60,60,20,0.3)', w: 0.0022, to: 2 },
    outline: { col: 'rgba(60,70,40,0.2)', w: 0.0015 },
  });
  erase(g, 0.294, 0.03, 0.02, 0.9, 0.25, 0.024);
}

export const def = {
  id: 'mahi_mahi',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.265, y1: 0.215 },
  mouth: { x: 0.49, y: 0.028 },
  paint,
  swim: { swing: 0.05, waves: 1.1, power: 2.3, head: 0.06, squash: 0.03, freq: 1.3, thrash: 1.3, idle: 0.05 },
  parts: [{ key: 'pec', box: { x0: 0.1, x1: 0.31, y0: 0.0, y1: 0.1 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.04, amp: 0.22, rate: 2.6, fold: 0.3 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.55, throat: '#7a2a30', cavity: '#240a10' },
  gillSlit: { x: 0.27, y0: -0.12, y1: 0.1, bulge: 0.034 },
};
