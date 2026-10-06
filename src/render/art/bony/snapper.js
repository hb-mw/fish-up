// Yellowtail snapper (Ocyurus chrysurus) — the "reference" fish of the kit: a streamlined snapper with a
// blue-violet back, a yellow mid-lateral stripe that widens into an all-yellow, deeply forked tail.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.016], [0.489, -0.006], [0.458, -0.034], [0.405, -0.066], [0.32, -0.1], [0.2, -0.124], [0.07, -0.127], [-0.06, -0.11], [-0.18, -0.08], [-0.27, -0.052], [-0.335, -0.04]],
  [[0.5, 0.016], [0.489, 0.034], [0.458, 0.053], [0.405, 0.075], [0.32, 0.098], [0.2, 0.114], [0.07, 0.114], [-0.06, 0.096], [-0.18, 0.068], [-0.27, 0.047], [-0.335, 0.04]],
);
const HINGE = [0.41, 0.05], TIP = [0.497, 0.02], CORNER = [0.438, 0.04];
const PEC = [0.222, 0.034];

function paint(g, res, v) {
  const rng = createRng(101 + v * 17);
  const dh = [-7, 0, 8][v];
  const back = shift('#35518a', dh, 0, 0), backLt = shift('#6d8fc6', dh, 0, 0);
  const yel = shift('#f5c518', [-3, 0, 3][v], 0, 0), yelLt = lite(yel, 0.35);
  const yRay = 'rgba(140,84,0,0.3)';

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.075, up: [-0.5, -0.172], lo: [-0.497, 0.16], notch: [-0.384, -0.002], lead: 0.06, trail: 0.12 });
  fin(g, res, {
    pts: tail,
    stops: [[0, yel], [0.55, mixc(yel, '#ffd93a', 0.6)], [1, rgba(yelLt, 0.8)]],
    axis: [-0.3, 0, -0.5, 0],
    rays: { n: 30, to: [3, 7], from: tail.root, col: '#8a5200', a: 0.32, fade: 0.35, w: 0.0015, curl: 0.045, hl: '#fff6c0', hla: 0.2 },
    scallop: { from: 3, to: 7, n: 15, depth: 0.0035 },
    margin: { col: 'rgba(255,250,214,0.3)', w: 0.006, from: 3, to: 7 },
    mottle: { color: '#c98a00', a: 0.16, scale: 0.3, lo: 0.4, hi: 0.75, seed: 5 },
    edge: { col: 'rgba(150,95,0,0.28)', w: 0.0026, to: 3 },
  });
  // dorsal: 10 spines stepping down into the soft-rayed lobe
  const sp = spines(0.2, -0.04, 10, lerpArr([0.014, 0.04, 0.057, 0.065, 0.063, 0.058, 0.052, 0.045, 0.039, 0.035]), 0.14);
  sp.pop();
  const dorsal = ridge(P, 'top', [...sp, [-0.07, 0.039], [-0.12, 0.043], [-0.17, 0.037], [-0.205, 0.022, 1], [-0.236, -0.012]], 0.45);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal,
    stops: [[0, rgba(mixc(back, yel, 0.62), 0.96)], [0.4, rgba(mixc(yel, '#e9cf5e', 0.3), 0.9)], [1, rgba(yelLt, 0.72)]],
    axis: [0.05, -0.12, 0.02, -0.2],
    rays: [
      { n: 9, from: [[0.1856, dTop(0.1856)], [-0.0304, dTop(-0.0304)]], lean: 0.45, col: '#5e4508', a: 0.5, fade: 0.2, w: 0.0026, jitter: 0.15 },
      { n: 13, from: [[-0.05, dTop(-0.05)], [-0.232, dTop(-0.232)]], lean: [0.45, 1.1], col: '#6e500a', a: 0.3, w: 0.0015, hl: '#fff6c0' },
    ],
    edge: { col: 'rgba(90,70,30,0.3)', w: 0.0024, to: 1 },
    shade: 'rgba(30,50,90,0.3)',
    mottle: { color: '#8a6a00', a: 0.14, scale: 0.3, lo: 0.4, hi: 0.75, seed: 6 },
    tension: 0.7,
  });
  const anal = ridge(P, 'bot', [[-0.1, -0.012], [-0.112, 0.03, 1], [-0.142, 0.047], [-0.185, 0.036], [-0.21, 0.018, 1], [-0.238, -0.012]], 0.45);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal,
    stops: [[0, rgba('#f3ecd0', 0.95)], [1, rgba(mixc(yelLt, '#ffffff', 0.3), 0.72)]],
    rays: { n: 11, from: [[-0.106, aBot(-0.106)], [-0.234, aBot(-0.234)]], lean: [0.3, 1.1], up: 1, col: '#785a1e', a: 0.26, w: 0.0015, hl: '#ffffff' },
    edge: { col: 'rgba(120,100,60,0.28)', w: 0.0024, to: 1 },
    shade: 'rgba(60,70,100,0.25)',
  });
  const pelvic = (dx, dy, a, shade) => {
    const y = P.bot(0.15);
    fin(g, res, {
      pts: [[0.176 + dx, y - 0.014 + dy], [0.15 + dx, y + 0.028 + dy], [0.078 + dx, y + 0.078 + dy, 1], [0.105 + dx, y + 0.03 + dy], [0.13 + dx, y - 0.014 + dy]],
      stops: [[0, rgba(mixc('#f7f2e0', '#6d7c94', shade), a)], [1, rgba(mixc(lite(yelLt, 0.4), '#6d7c94', shade), a * 0.7)]],
      rays: { n: 8, to: [1, 3], from: [[0.168 + dx, y - 0.008 + dy], [0.134 + dx, y - 0.008 + dy]], col: '#6e5f3c', a: 0.25, w: 0.0015 },
      edge: { col: 'rgba(110,100,80,0.28)', w: 0.0024, to: 2 },
      shade: 'rgba(60,70,100,0.22)',
    });
  };
  pelvic(-0.02, -0.003, 0.55, 0.3);

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.05,
    skin(t, U) {
      U.grad([[0, dark(back, 0.25)], [0.09, back], [0.26, mixc(back, backLt, 0.7)], [0.37, lite(backLt, 0.25)], [0.52, '#dfe3f1'], [0.66, '#f1eaf0'], [0.84, '#fbf9f6'], [1, '#ffffff']]);
      // faint rosy / yellow pinstripes on the lower flank
      for (let i = 0; i < 5; i++) {
        const vv = 0.585 + i * 0.07;
        U.band(vv, vv + 0.012, i % 2 ? '#f0cf6a' : '#eeb7b4', 0.34, 0.014, -0.31, 0.26);
      }
      // the yellow stripe: snout → through the eye → flaring to cover the whole tail base
      soft(t, U.H * 0.012, yel, () => {
        const up = [[0.5, 0.42], [0.43, 0.35], [0.3, 0.37], [0.12, 0.39], [-0.05, 0.385], [-0.17, 0.33], [-0.26, 0.18], [-0.335, -0.05]];
        const lo = [[-0.335, 1.05], [-0.26, 0.86], [-0.17, 0.63], [-0.05, 0.52], [0.12, 0.495], [0.3, 0.475], [0.43, 0.455], [0.5, 0.5]];
        U.path([...up, ...lo], true);
        t.fill();
      });
      // warm shadow under the stripe, brighter core through it
      soft(t, U.H * 0.02, rgba('#d98a00', 0.3), () => {
        U.path([[0.42, 0.47], [0.2, 0.495], [-0.05, 0.53], [-0.2, 0.66], [-0.3, 0.9]]);
        t.lineWidth = U.H * 0.03;
        t.stroke();
      });
      soft(t, U.H * 0.022, rgba('#ffe85c', 0.75), () => {
        U.path([[0.42, 0.395], [0.2, 0.425], [-0.05, 0.435], [-0.2, 0.44], [-0.33, 0.4]]);
        t.lineWidth = U.H * 0.045;
        t.stroke();
      });
    },
    over(gg) {
      mottle(gg, -0.34, -0.14, 0.5, 0.0, { color: '#1c2f66', a: 0.2, scale: 0.34, lo: 0.42, hi: 0.72, seed: 3 + v });
      // mother-of-pearl on the silver flank
      mottle(gg, -0.34, 0.0, 0.3, 0.13, { color: '#f0a8c8', a: 0.16, scale: 0.4, lo: 0.45, hi: 0.8, seed: 8, sy: 0.5 });
      mottle(gg, -0.34, 0.0, 0.3, 0.13, { color: '#8fd0e8', a: 0.14, scale: 0.33, lo: 0.5, hi: 0.8, seed: 9, sy: 0.5 });
      // yellow flecks over the blue back, a little ragged, following the scale rows
      for (let i = 0; i < 70; i++) {
        const x = -0.28 + rng.next() * 0.54;
        const vv = 0.045 + Math.pow(rng.next(), 0.8) * 0.27;
        if (vv > 0.2 && x < -0.14) continue;
        const r = 0.0036 + rng.next() * rng.next() * 0.008;
        spot(gg, x, P.at(x, vv), r * 1.25, i % 4 ? yel : '#ffdf55', 0.92, 0.6, r * (0.7 + 0.4 * rng.next()), (rng.next() - 0.5) * 0.8);
      }
      scales(gg, res, P, {
        rows: 17, x0: -0.31, x1: 0.268, xFade: (x) => Math.min(1, (0.268 - x) / 0.03), dark: '#122a5c', da: 0.3, la: 0.2, rng,
        vFade: (vv) => (vv < 0.5 ? 1 : 1 - 0.55 * Math.min(1, (vv - 0.5) / 0.4)),
        glint: { p: 0.14, color: '#ffffff', a: 0.2 },
      });
    },
    shade: { dark: '#1a2a55', sheen: 0.4, sheenV: 0.19, sheenW: 0.11, gloss: 0.3, belly: 0.3, bounce: 0.65, rim: 0.34, topLight: 0.16 },
    face(gg) {
      // soft modelling of the head: brow shadow, pearly cheek, shadow under the pectoral fin
      spot(gg, 0.365, 0.024, 0.07, '#ffffff', 0.36, 0.05, 0.04);
      soft(gg, 0.012, 'rgba(40,60,110,0.22)', () => {
        gg.beginPath();
        gg.ellipse(0.16, 0.058, 0.07, 0.016, -0.32, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.33, y0: -0.035, y1: 0.066, bulge: 0.016, dark: '#2a3a66', a: 0.16, shadow: 0.14, la: 0.1, w: 0.002 });
      gill(gg, res, { x: 0.27, y0: -0.082, y1: 0.09, bulge: 0.03, dark: '#1c2c58', a: 0.4, shadow: 0.2, plate: 0.22, w: 0.0022 });
      // lachrymal line from the eye to the corner of the mouth, nostrils
      soft(gg, 0.004, 'rgba(40,50,90,0.3)', () => {
        gg.beginPath();
        gg.moveTo(0.4, -0.004);
        gg.quadraticCurveTo(0.425, 0.022, 0.442, 0.036);
        gg.lineWidth = 0.004;
        gg.stroke();
      });
      spot(gg, 0.455, -0.019, 0.004, '#1a2a44', 0.75, 0.5);
      spot(gg, 0.441, -0.026, 0.003, '#1a2a44', 0.55, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.004, dark: '#3a2026', a: 0.62, w: 0.0032, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.392, -0.029, 0.0205, { iris: '#cf6a2e', irisDark: '#6a2412', pupil: 0.56, ring: 'rgba(24,30,56,0.32)', rim: 'rgba(255,220,130,0.4)', socket: 0.2 });
      glint(gg, 0.44, -0.05, 0.028, 0.005, 0.3, -0.55);
    },
  });

  // near-side pelvic over the belly edge
  pelvic(0, 0, 0.95, 0);
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.232, 0.02], [0.19, 0.03], [0.098, 0.07, 1], [0.13, 0.082], [0.2, 0.066], [0.23, 0.05]],
    stops: [[0, 'rgba(240,232,214,0.85)'], [0.4, 'rgba(248,238,200,0.6)'], [1, 'rgba(255,248,214,0.42)']],
    axis: [0.228, 0.036, 0.1, 0.076],
    rays: { n: 14, to: [2, 4], from: [[0.229, 0.027], [0.227, 0.046]], col: '#785f32', a: 0.3, w: 0.0015 },
    outline: { col: 'rgba(120,100,70,0.22)', w: 0.0016 },
  });
  erase(g, 0.236, 0.036, 0.022, 0.9, 0.25, 0.026);
}

export const def = {
  id: 'yellowtail_snapper',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.2, y1: 0.2 },
  mouth: { x: 0.49, y: 0.022 },
  paint,
  swim: { swing: 0.05, waves: 1.05, power: 2.1, head: 0.08, squash: 0.03 },
  parts: [{ key: 'pec', box: { x0: 0.08, x1: 0.25, y0: 0.0, y1: 0.1 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.05, amp: 0.28, rate: 2.6, fold: 0.25 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.5, throat: '#7a2a30' },
  gillSlit: { x: 0.27, y0: -0.072, y1: 0.084, bulge: 0.03 },
};
