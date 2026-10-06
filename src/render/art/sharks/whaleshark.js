// Whale shark (Rhincodon typus): broad flat head, terminal filter-feeding mouth, a star-map of pale spots on
// dark blue-grey, longitudinal ridges — and a remora or two hitching a ride.
import { makeShark } from './shark.js';
import { TAU, soft, softStroke, rngFor, lod, band, clipTo } from './kit.js';
import { F } from './sharkspecies.js';

const PALE = 'rgba(224,234,236,0.92)';

function whalePattern(g, res, v, P, S) {
  const r = rngFor('ws' + v);
  const L = lod(res);
  const cf = typeof S.counter.f === 'function' ? S.counter.f : () => S.counter.f;
  clipTo(g, (q) => band(q, P, 0.52, -0.4, -0.5, (x) => cf(x) + 0.02), () => {
    // body: pale vertical bars between columns of spots, crossed by fine horizontal lines → a checkerboard
    const step = 0.034;
    for (let x = 0.31; x > -0.34; x -= step) {
      const xx = x + (r.next() - 0.5) * 0.006;
      softStroke(g, res, 0.0015, 'rgba(220,232,236,0.5)', 0.0028, (q) => {
        q.moveTo(xx, P.at(xx, -0.05));
        q.quadraticCurveTo(xx - 0.005, P.at(xx, 0.3), xx + 0.002, P.at(xx, 0.68));
      });
      for (let f = 0.08; f < 0.62; f += 0.105) {
        const sx = xx - step * 0.5 + (r.next() - 0.5) * 0.008, sf = f + (r.next() - 0.5) * 0.03;
        const rr = (0.0052 + r.next() * 0.0028) * (x < -0.2 ? 0.8 : 1);
        soft(g, res, 0.0012, PALE, (q) => q.ellipse(sx, P.at(sx, sf), rr, rr * 0.88, 0, 0, TAU));
      }
    }
    for (const f of [0.14, 0.3, 0.46]) {
      softStroke(g, res, 0.0012, 'rgba(220,232,236,0.32)', 0.002, (q) => {
        for (let i = 0; i <= 30; i++) {
          const x = 0.32 - (0.66 * i) / 30;
          if (i === 0) q.moveTo(x, P.at(x, f));
          else q.lineTo(x, P.at(x, f + Math.sin(i * 1.3 + v) * 0.01));
        }
      });
    }
    // head: smaller, denser spots and no bars
    const n = L >= 1 ? 90 : 45;
    for (let i = 0; i < n; i++) {
      const x = 0.33 + r.next() * 0.16, f = 0.04 + r.next() * 0.58;
      const rr = 0.0026 + r.next() * 0.0022;
      soft(g, res, 0.001, PALE, (q) => q.ellipse(x, P.at(x, f), rr, rr * 0.9, 0, 0, TAU));
    }
  });
  // three longitudinal ridges on each flank: a lit crest over a soft shadow
  const ridges = [[0.37, 0.16, -0.34, 0.47], [0.22, 0.34, -0.24, 0.52], [0.12, 0.5, -0.14, 0.6]];
  for (const [x0, f0, x1, f1] of ridges) {
    const path = (q, d) => {
      for (let i = 0; i <= 24; i++) {
        const k = i / 24, x = x0 + (x1 - x0) * k;
        const y = P.at(x, f0 + (f1 - f0) * k) + d;
        if (i === 0) q.moveTo(x, y);
        else q.lineTo(x, y);
      }
    };
    softStroke(g, res, 0.003, 'rgba(8,16,26,0.32)', 0.005, (q) => path(q, 0.003));
    softStroke(g, res, 0.0025, 'rgba(210,228,240,0.3)', 0.003, (q) => path(q, -0.001));
  }
}

function remora(g, res, x, y, len, ang) {
  // a sharksucker hanging under the host: slim, dark-striped, sucker disc pressed to the shark's belly
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const h = len * 0.16;
  const body = (q) => {
    q.moveTo(len * 0.5, h * 0.05);
    q.quadraticCurveTo(len * 0.42, -h * 0.5, len * 0.2, -h * 0.5);
    q.lineTo(-len * 0.3, -h * 0.3);
    q.quadraticCurveTo(-len * 0.42, -h * 0.15, -len * 0.42, 0);
    q.quadraticCurveTo(-len * 0.42, h * 0.2, -len * 0.3, h * 0.3);
    q.lineTo(len * 0.25, h * 0.45);
    q.quadraticCurveTo(len * 0.45, h * 0.4, len * 0.5, h * 0.05);
    q.closePath();
  };
  // forked tail
  g.fillStyle = '#4a5058';
  g.beginPath();
  g.moveTo(-len * 0.38, 0);
  g.lineTo(-len * 0.52, -h * 0.75);
  g.quadraticCurveTo(-len * 0.46, 0, -len * 0.52, h * 0.75);
  g.closePath();
  g.fill();
  const gr = g.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
  gr.addColorStop(0, '#6e757e');
  gr.addColorStop(0.45, '#3b4048');
  gr.addColorStop(0.6, '#2c3036');
  gr.addColorStop(1, '#9aa1a8');
  g.fillStyle = gr;
  g.beginPath();
  body(g);
  g.fill();
  // pale-edged dark stripe, long low fins, tiny eye, jutting lower jaw
  g.strokeStyle = 'rgba(210,216,222,0.5)';
  g.lineWidth = h * 0.12;
  g.beginPath();
  g.moveTo(len * 0.42, -h * 0.12);
  g.lineTo(-len * 0.36, -h * 0.05);
  g.stroke();
  g.fillStyle = '#3d424a';
  g.beginPath();
  g.moveTo(-len * 0.05, h * 0.4);
  g.quadraticCurveTo(-len * 0.2, h * 0.85, -len * 0.33, h * 0.32);
  g.closePath();
  g.fill();
  g.fillStyle = '#0b0c0e';
  g.beginPath();
  g.arc(len * 0.36, -h * 0.08, h * 0.13, 0, TAU);
  g.fill();
  g.restore();
}

export const whale_shark = makeShark({
  id: 'whale_shark',
  variants: 3,
  top: [
    [0.5, -0.022], [0.498, -0.036], [0.486, -0.05], [0.455, -0.064], [0.39, -0.082], [0.3, -0.1], [0.2, -0.112], [0.1, -0.118],
    [0, -0.114], [-0.08, -0.102], [-0.16, -0.08], [-0.23, -0.056], [-0.28, -0.038], [-0.32, -0.026], [-0.36, -0.016],
  ],
  bot: [
    [0.5, -0.022], [0.4995, -0.002], [0.4965, 0.016], [0.486, 0.032], [0.46, 0.046], [0.39, 0.064], [0.3, 0.08], [0.2, 0.09], [0.1, 0.094],
    [0, 0.088], [-0.08, 0.074], [-0.16, 0.054], [-0.23, 0.034], [-0.28, 0.02], [-0.32, 0.008], [-0.36, -0.002],
  ],
  colors: {
    back: '#3d5367', top: '#57708a', flank: '#2a3a4b', belly: '#e4e9ea', bellyShade: '#8794a0', fin: '#3a4f63',
    gum: '#5a4048', mouth: '#2a1c22', throat: '#070405', gill: '#121c26', rim: '#c8dceb', flesh: '#1f1519',
  },
  counter: { f: (x) => (x > 0.3 ? 0.66 : x > -0.15 ? 0.62 : 0.62 + Math.pow((-0.15 - x) / 0.15, 1.5) * 0.4), rough: 0.004, freq: 30, soft: 0.008 },
  light: { top: 0.45, flank: 0.5, sheen: 0.14, spec: 0.16, mottle: 0.12 },
  eye: [0.432, -0.004, 0.0056],
  eyeStyle: { iris: '#2b2f32', irisDark: '#08090a', pupil: 0.5, ring: 'rgba(200,210,215,0.55)' },
  pores: false,
  gills: { xs: [0.335, 0.312, 0.289, 0.266, 0.243], top: 0.17, bot: 0.92, lean: 0.004, bow: 0.006, width: 0.003, alpha: 0.5, taper: 0.05 },
  keel: [-0.2, -0.345, 0.45],
  mouth: {
    hinge: [0.444, 0.016], front: [0.5, 0.004],
    line: [[0.444, 0.016], [0.46, 0.0145], [0.48, 0.011], [0.5, 0.004]],
    throat: 0.43, open: 0.42, idle: 0.3, idleRate: 0.28, fold: false, thrust: 0.002, drop: 0.026,
    teeth: null,
  },
  fins: {
    d1: F([[0.02, -0.112, 1], [0, -0.145], [-0.025, -0.18], [-0.045, -0.198], [-0.06, -0.2, 1], [-0.064, -0.18], [-0.07, -0.15], [-0.082, -0.118], [-0.1, -0.102, 1], [-0.08, -0.1, 1]], 4),
    d2: F([[-0.21, -0.06, 1], [-0.22, -0.078], [-0.232, -0.09, 1], [-0.236, -0.075], [-0.248, -0.058, 1], [-0.24, -0.052, 1]], 2),
    anal: F([[-0.22, 0.04, 1], [-0.23, 0.056], [-0.242, 0.066, 1], [-0.246, 0.052], [-0.258, 0.036, 1], [-0.25, 0.03, 1]], 2),
    pec: F([[0.25, 0.07, 1], [0.23, 0.105], [0.195, 0.145], [0.155, 0.18], [0.12, 0.198, 1], [0.135, 0.168], [0.155, 0.132], [0.175, 0.105], [0.2, 0.085, 1]], 4),
    pecFar: F([[0.235, 0.062, 1], [0.215, 0.094], [0.185, 0.128], [0.15, 0.156], [0.12, 0.17, 1], [0.133, 0.145], [0.15, 0.115], [0.168, 0.092], [0.19, 0.076, 1]], 4),
    pelvic: F([[-0.07, 0.075, 1], [-0.088, 0.096], [-0.11, 0.108, 1], [-0.112, 0.092], [-0.122, 0.072, 1], [-0.1, 0.068, 1]], 2),
    caudal: {
      pts: [
        [-0.28, -0.036, 1], [-0.33, -0.06], [-0.39, -0.11], [-0.45, -0.165], [-0.5, -0.205, 1], [-0.47, -0.14], [-0.44, -0.07], [-0.42, -0.02],
        [-0.418, 0.01], [-0.43, 0.05], [-0.45, 0.09], [-0.468, 0.118, 1], [-0.43, 0.085], [-0.38, 0.05], [-0.33, 0.022], [-0.28, 0.012, 1],
      ],
      lead: [[[-0.28, -0.036], [-0.33, -0.06], [-0.39, -0.11], [-0.45, -0.165], [-0.5, -0.205]], [[-0.468, 0.118], [-0.43, 0.085], [-0.38, 0.05], [-0.33, 0.022]]],
      trail: [[-0.5, -0.205], [-0.47, -0.14], [-0.44, -0.07], [-0.42, -0.02], [-0.418, 0.01], [-0.43, 0.05], [-0.45, 0.09], [-0.468, 0.118]],
      base: [-0.29, 0], tip: [-0.48, -0.02],
    },
  },
  paint: {
    pattern: whalePattern,
    dorsal: (g, res, v) => finDots(g, res, v, -0.03, -0.15, 0.05, 0.05),
    pec: (g, res, v) => finDots(g, res, v, 0.2, 0.12, 0.08, 0.04),
    caudal: (g, res, v) => finDots(g, res, v, -0.4, -0.1, 0.07, 0.06),
    front(g, res, v, P) {
      // remoras: one or two, hanging just under the belly
      const spots = v === 1 ? [[0.12, 0.085]] : v === 2 ? [[0.16, 0.088], [-0.02, 0.08]] : [[0.06, 0.09], [-0.005, 0.082]];
      for (const [x, l] of spots) remora(g, res, x, P.bot(x) + l * 0.1, l, Math.atan2(P.bot(x - 0.02) - P.bot(x + 0.02), -0.04) + Math.PI);
    },
  },
  swim: { swing: 0.026, waves: 0.8, power: 2.0, rigid: 0.2, squash: 0.5 },
  bounds: { x0: -0.505, x1: 0.505, y0: -0.215, y1: 0.205 },
  anchor: { x: 0.48, y: 0.012 },
  capPx: 1390,
});

function finDots(g, res, v, x, y, w, h) {
  const r = rngFor('wsf' + v + x);
  for (let i = 0; i < 14; i++) {
    const rr = 0.003 + r.next() * 0.002;
    soft(g, res, 0.001, 'rgba(224,234,236,0.75)', (q) => q.ellipse(x + (r.next() - 0.5) * w, y + (r.next() - 0.5) * h, rr, rr, 0, 0, TAU));
  }
}
