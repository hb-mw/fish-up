// Atlantic mackerel (Scomber scombrus) — a slim torpedo: iridescent blue-green back with dark wavy "tiger" bars
// down to the midline, silver belly with a pink/gold sheen, two well-separated dorsals, finlets, a forked tail.
import { profile, paintBody, fin, ridge, spines, lerpArr, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';
import { finletRow, keels, uvMottle } from './tuna-extra.js';

const P = profile(
  [[0.5, 0.0], [0.486, -0.018], [0.44, -0.046], [0.37, -0.068], [0.26, -0.083], [0.14, -0.088], [0.0, -0.082], [-0.14, -0.064], [-0.26, -0.04], [-0.34, -0.021], [-0.385, -0.012]],
  [[0.5, 0.0], [0.486, 0.017], [0.44, 0.04], [0.37, 0.062], [0.26, 0.078], [0.14, 0.085], [0.0, 0.08], [-0.14, 0.063], [-0.26, 0.04], [-0.34, 0.021], [-0.385, 0.012]],
);
const HINGE = [0.42, 0.03], TIP = [0.5, 0.0], CORNER = [0.446, 0.02];
const PEC = [0.262, 0.004];

function paint(g, res, v) {
  const rng = createRng(501 + v * 13);
  const dh = [-8, 0, 8][v];
  const deep = shift('#0d3444', dh, 0, 0), teal = shift('#1f6f82', dh, 0, 0), blue = shift('#3d8fae', dh, 0, 0);
  const bar = shift('#0a2230', dh, 0, 0);
  const silver = '#d9e2e6', belly = '#f6f5f2';
  const finCol = 'rgba(70,86,100,0.9)', finTip = 'rgba(150,165,178,0.7)';

  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.07, up: [-0.5, -0.115], lo: [-0.5, 0.115], notch: [-0.425, 0], lead: 0.08, trail: 0.05 });
  fin(g, res, {
    pts: tail,
    stops: [[0, 'rgba(60,76,92,0.95)'], [0.6, 'rgba(84,100,116,0.9)'], [1, 'rgba(130,145,158,0.75)']],
    axis: [-0.36, 0, -0.5, 0],
    rays: { n: 22, to: [3, 7], from: tail.root, col: '#0a1420', a: 0.35, fade: 0.3, w: 0.0014, curl: 0.04, hl: '#c8d8e4', hla: 0.12 },
    scallop: { from: 3, to: 7, n: 9, depth: 0.0025 },
    edge: { col: 'rgba(10,20,32,0.4)', w: 0.0026, to: 3 },
  });
  // first dorsal: 11 spines, triangular
  const sp = spines(0.13, -0.03, 11, lerpArr([0.028, 0.055, 0.064, 0.06, 0.054, 0.046, 0.038, 0.03, 0.024, 0.018, 0.012]), 0.16);
  const d1 = ridge(P, 'top', sp, 0.25);
  fin(g, res, {
    pts: d1,
    stops: [[0, finCol], [1, finTip]],
    rays: { n: 10, from: [[0.12, P.top(0.12) + 0.008], [-0.022, P.top(-0.022) + 0.008]], lean: [0.25, 1.1], col: '#0a1420', a: 0.45, w: 0.0016 },
    edge: { col: 'rgba(10,20,32,0.35)', w: 0.0022, to: 1 },
    tension: 0.6,
  });
  // second dorsal (small, soft) + 5 finlets; anal + 5 finlets
  const d2 = ridge(P, 'top', [[-0.135, -0.01], [-0.148, 0.03], [-0.175, 0.042, 1], [-0.19, 0.016], [-0.2, -0.01]], 0.4);
  fin(g, res, { pts: d2, stops: [[0, finCol], [1, finTip]], rays: { n: 7, from: [[-0.14, P.top(-0.14) + 0.008], [-0.195, P.top(-0.195) + 0.008]], lean: [0.4, 1.4], col: '#0a1420', a: 0.4, w: 0.0014 }, edge: { col: 'rgba(10,20,32,0.35)', w: 0.002, to: 2 } });
  finletRow(g, res, P, 'top', -0.215, -0.345, 5, 0.014, '#7c929e', 'rgba(10,20,32,0.45)', 1.1);
  const an = ridge(P, 'bot', [[-0.15, -0.01], [-0.162, 0.028], [-0.188, 0.04, 1], [-0.2, 0.014], [-0.21, -0.01]], 0.4);
  fin(g, res, { pts: an, stops: [[0, 'rgba(200,205,205,0.9)'], [1, 'rgba(230,232,232,0.7)']], rays: { n: 7, from: [[-0.155, P.bot(-0.155) - 0.008], [-0.205, P.bot(-0.205) - 0.008]], lean: [0.4, 1.4], up: 1, col: '#2a3a44', a: 0.35, w: 0.0014 }, edge: { col: 'rgba(40,50,60,0.3)', w: 0.002, to: 2 } });
  finletRow(g, res, P, 'bot', -0.225, -0.345, 5, 0.013, '#c0cad0', 'rgba(20,30,40,0.4)', 1.1);
  // pelvic
  const py = P.bot(0.225);
  fin(g, res, {
    pts: [[0.236, py - 0.01], [0.225, py + 0.024], [0.19, py + 0.046, 1], [0.2, py + 0.02], [0.21, py - 0.01]],
    stops: [[0, 'rgba(200,205,205,0.9)'], [1, 'rgba(235,236,236,0.7)']],
    rays: { n: 5, to: [1, 3], from: [[0.232, py - 0.004], [0.214, py - 0.004]], col: '#2a3a44', a: 0.35, w: 0.0013 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.04,
    skin(t, U) {
      U.grad([[0, dark(deep, 0.3)], [0.07, deep], [0.2, teal], [0.36, blue], [0.46, mixc(blue, silver, 0.55)], [0.53, silver], [0.62, '#ece2e2'], [0.76, '#f4f2ee'], [0.9, belly], [1, '#ffffff']]);
      U.glow(0.0, 0.62, 0.36, 0.06, '#f2c2c8', 0.3);
      U.glow(-0.15, 0.7, 0.2, 0.05, '#f4dca8', 0.25);
      U.glow(0.1, 0.3, 0.3, 0.06, '#8fe0d8', 0.22);
      // the tiger bars: near-vertical wavy dark lines from the back to just below the midline, bold enough to read at 90 px
      const nb = 17;
      soft(t, Math.max(0.5, U.H * 0.007), bar, () => {
        t.lineWidth = Math.max(1.1, U.dx(0.0085));
        t.lineCap = 'round';
        for (let i = 0; i < nb; i++) {
          const k = i / (nb - 1);
          const x = 0.2 - k * 0.52 + (rng.next() - 0.5) * 0.01;
          const w = 0.004 + rng.next() * 0.005, ph = rng.next() * 6.3, lean = (rng.next() - 0.5) * 0.02;
          const pts = [];
          const vTop = 0.0 + rng.next() * 0.03, vBot = 0.47 + rng.next() * 0.09;
          for (let j = 0; j <= 5; j++) {
            const vv = vTop + ((vBot - vTop) * j) / 5;
            pts.push([x + lean * (j / 5) + Math.sin(ph + j * 1.4) * w, vv]);
          }
          U.path(pts);
          t.stroke();
          if (i % 3 === 1) {
            // Y-forks and short dashes, like the real zigzags
            const vf = vTop + 0.1 + rng.next() * 0.2;
            U.path([[x + lean * 0.4, vf], [x - 0.022 + (rng.next() - 0.5) * 0.01, vf + 0.16 + rng.next() * 0.1]]);
            t.stroke();
          }
          if (i % 4 === 2) {
            U.path([[x + 0.014, 0.05 + rng.next() * 0.1], [x + 0.016, 0.22 + rng.next() * 0.1]]);
            t.stroke();
          }
        }
      });
      uvMottle(t, U, { color: '#06202c', a: 0.3, scale: 0.4, lo: 0.42, hi: 0.75, seed: 41 + v, v0: 0, v1: 0.45, feather: 0.1 });
    },
    over(gg) {
      scales(gg, res, P, { rows: 22, x0: -0.34, x1: 0.26, dark: '#0a2a3a', da: 0.1, la: 0.1, rng, xFade: (x) => Math.min(1, (0.26 - x) / 0.04), vFade: (vv) => 0.6 - 0.3 * Math.max(0, Math.min(1, (vv - 0.5) / 0.4)) });
      gg.strokeStyle = 'rgba(255,255,255,0.14)';
      gg.lineWidth = Math.max(0.002, 0.6 / res);
      gg.beginPath();
      P.line(gg, (x) => (x > 0.15 ? 0.32 + (0.26 - x) * 0.9 : 0.42 - (0.15 - x) * 0.04), 0.26, -0.36, 40, true);
      gg.stroke();
    },
    shade: { dark: '#07202c', sheen: 0.4, sheenV: 0.2, sheenW: 0.1, gloss: 0.4, belly: 0.26, bounce: 0.7, rim: 0.34, topLight: 0.2, breakup: 0.4 },
    face(gg) {
      spot(gg, 0.355, 0.02, 0.06, '#ffffff', 0.3, 0.05, 0.035);
      soft(gg, 0.01, 'rgba(10,30,50,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.2, 0.03, 0.06, 0.012, -0.15, 0, 7);
        gg.fill();
      });
      gill(gg, res, { x: 0.33, y0: -0.03, y1: 0.045, bulge: 0.012, dark: '#0e2a3a', a: 0.16, shadow: 0.12, la: 0.1, w: 0.0018 });
      gill(gg, res, { x: 0.278, y0: -0.062, y1: 0.066, bulge: 0.024, dark: '#0a2030', a: 0.45, shadow: 0.26, plate: 0.2, w: 0.0022 });
      spot(gg, 0.458, -0.016, 0.003, '#0a1428', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.004, dark: '#0a1420', a: 0.6, w: 0.0026, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.385, -0.02, 0.024, { iris: '#b8c4cc', irisDark: '#3a4a56', pupil: 0.6, ring: 'rgba(10,16,30,0.42)', rim: 'rgba(255,240,210,0.4)', socket: 0.22 });
      glint(gg, 0.44, -0.046, 0.02, 0.0035, 0.22, -0.4);
      keels(gg, res, P, -0.33, -0.375, '#0a2030', '#cfe0ea');
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.27, -0.004], [0.23, 0.0], [0.168, 0.034, 1], [0.2, 0.042], [0.245, 0.03], [0.268, 0.014]],
    stops: [[0, 'rgba(70,86,100,0.9)'], [0.5, 'rgba(110,126,140,0.8)'], [1, 'rgba(170,182,192,0.6)']],
    axis: [0.266, 0.005, 0.17, 0.036],
    rays: { n: 10, to: [2, 4], from: [[0.268, -0.001], [0.266, 0.012]], col: '#0a1420', a: 0.3, w: 0.0013, hl: '#d8e4ee', hla: 0.14 },
    edge: { col: 'rgba(10,20,32,0.35)', w: 0.002, to: 2 },
  });
  erase(g, 0.274, 0.004, 0.014, 0.9, 0.25, 0.017);
}

export const def = {
  id: 'mackerel',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.16, y1: 0.14 },
  mouth: { x: 0.49, y: 0.006 },
  paint,
  swim: { swing: 0.045, waves: 1.0, power: 2.8, head: 0.05, squash: 0.03, freq: 1.4, thrash: 1.2, idle: 0.05 },
  parts: [{ key: 'pec', box: { x0: 0.15, x1: 0.29, y0: -0.02, y1: 0.06 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.05, amp: 0.2, rate: 3.0, fold: 0.3 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.5, throat: '#6a2630', cavity: '#1e0810' },
  gillSlit: { x: 0.278, y0: -0.056, y1: 0.06, bulge: 0.024 },
};
