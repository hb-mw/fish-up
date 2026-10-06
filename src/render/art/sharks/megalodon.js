// Megalodon — the Lv10 secret boss. A great white's ancient, heavier cousin: blunt broad head, massive girth,
// charcoal hide crazed with old wounds, dagger teeth always half-bared. Built to hold up at 600–700 px.
import { makeShark } from './shark.js';
import { TAU, softStroke, soft, rngFor, spline, lod } from './kit.js';
import { scars, F, craters, finWear } from './sharkspecies.js';

const TEETH = { kind: 'tri', n: 11, size: 0.024, width: 0.88, taper: 0.5, rake: 0.05, nLow: 10, sizeLow: 0.019, color: '#ece2c8', root: '#9c8660', tipCol: '#fffaf0', from: 0.12, jitter: 0.45, gaps: 0.12 };

/** V-shaped tears cut into a fin edge: [x, y (on the edge), depth, direction the tear points (rad, into the fin)] */
function tears(g, list) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (const [x, y, d, a] of list) {
    const c = Math.cos(a), s = Math.sin(a);
    g.beginPath();
    g.moveTo(x - c * d * 0.3 - s * d * 0.32, y - s * d * 0.3 + c * d * 0.32);
    g.lineTo(x + c * d, y + s * d);
    g.lineTo(x - c * d * 0.3 + s * d * 0.3, y - s * d * 0.3 - c * d * 0.3);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** An old healed bite: a crescent of tooth punctures with puckered pale tissue. */
function biteScar(g, res, P, x, f) {
  const y = P.at(x, f), R = 0.045;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (i / 8) * 0.7);
    const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 0.55;
    soft(g, res, 0.002, 'rgba(10,12,16,0.45)', (q) => q.ellipse(px, py, 0.005, 0.0035, a, 0, TAU));
    soft(g, res, 0.0015, 'rgba(176,164,168,0.6)', (q) => q.ellipse(px - 0.0012, py - 0.001, 0.0034, 0.002, a, 0, TAU));
  }
  softStroke(g, res, 0.004, 'rgba(160,150,154,0.25)', 0.006, (q) => q.ellipse(x, y, R, R * 0.55, 0, Math.PI * 0.1, Math.PI * 0.9));
}

function copepod(g, res, x, y, ang, s) {
  // a parasitic copepod: little pale-pink body + two trailing egg strings
  const c = Math.cos(ang), sn = Math.sin(ang);
  softStroke(g, res, 0.0008, 'rgba(200,184,180,0.6)', 0.0012 * s, (q) => {
    q.moveTo(x, y);
    q.quadraticCurveTo(x + c * 0.012 * s - sn * 0.003, y + sn * 0.012 * s + c * 0.003, x + c * 0.024 * s, y + sn * 0.024 * s + 0.002);
  });
  softStroke(g, res, 0.0008, 'rgba(200,184,180,0.5)', 0.0012 * s, (q) => {
    q.moveTo(x, y);
    q.quadraticCurveTo(x + c * 0.012 * s + sn * 0.003, y + sn * 0.012 * s - c * 0.003, x + c * 0.022 * s, y + sn * 0.022 * s - 0.001);
  });
  g.fillStyle = 'rgba(190,160,156,0.8)';
  g.beginPath();
  g.ellipse(x, y, 0.0045 * s, 0.0025 * s, ang, 0, TAU);
  g.fill();
}

export const megalodon = makeShark({
  id: 'megalodon',
  variants: 2,
  top: [
    [0.5, -0.006], [0.49, -0.028], [0.466, -0.054], [0.425, -0.083], [0.355, -0.113], [0.26, -0.134], [0.16, -0.142],
    [0.06, -0.133], [-0.04, -0.112], [-0.14, -0.08], [-0.22, -0.051], [-0.29, -0.034], [-0.335, -0.024], [-0.37, -0.016],
  ],
  bot: [
    [0.5, -0.006], [0.495, 0.014], [0.48, 0.034], [0.452, 0.055], [0.41, 0.072], [0.36, 0.085], [0.3, 0.097], [0.21, 0.11],
    [0.1, 0.114], [-0.01, 0.103], [-0.1, 0.082], [-0.2, 0.05], [-0.29, 0.024], [-0.335, 0.007], [-0.37, -0.006],
  ],
  colors: {
    back: '#333b43', top: '#4a545e', flank: '#1d2329', belly: '#bcc3c2', bellyLit: '#d3d8d5', bellyShade: '#535e66', fin: '#2e353c',
    rim: '#b9cdd8', gum: '#4a1c22', mouth: '#1e0709', throat: '#040102', gill: '#0b0f13',
  },
  counter: {
    f: (x) => (x > 0.35 ? 0.64 : x > 0.25 ? 0.64 - (0.35 - x) * 0.8 : x > -0.08 ? 0.56 + Math.sin(x * 8) * 0.025 : 0.56 + Math.pow((-0.08 - x) / 0.19, 1.5) * 0.5),
    rough: 0.016, freq: 28, soft: 0.003,
  },
  light: { top: 0.42, flank: 0.85, sheen: 0.12, spec: 0.16, mottle: 0.2, mottleScale: 0.4, grain: 0.16, belly: 0.66 },
  eye: [0.415, -0.04, 0.0085],
  eyeStyle: { ring: 'rgba(60,66,72,0.8)', iris: '#0e1012', glint: true },
  nostril: [0.47, 0.012, 0.014],
  gills: { xs: [0.336, 0.316, 0.296, 0.276, 0.256], top: 0.27, bot: 0.84, lean: 0.009, bow: 0.008, width: 0.003, alpha: 0.5, bellyAlpha: 0.35 },
  keel: [-0.2, -0.34, 0.5],
  mouth: {
    hinge: [0.355, 0.044], front: [0.474, 0.026],
    line: [[0.355, 0.044], [0.385, 0.0425], [0.42, 0.038], [0.45, 0.032], [0.474, 0.026]],
    throat: 0.34, open: 0.5, min: 0.16, idle: 0.22, bared: true, idleRate: 0.33, foldLen: 1.6,
    teeth: TEETH,
  },
  fins: {
    d1: F([[0.21, -0.135, 1], [0.185, -0.185], [0.155, -0.24], [0.128, -0.278], [0.112, -0.29, 1], [0.106, -0.258], [0.098, -0.21], [0.086, -0.17], [0.07, -0.148], [0.05, -0.138, 1], [0.075, -0.13, 1]], 4),
    d2: F([[-0.2, -0.05, 1], [-0.212, -0.068], [-0.222, -0.08, 1], [-0.228, -0.066], [-0.242, -0.052, 1], [-0.236, -0.042, 1]], 2),
    anal: F([[-0.222, 0.044, 1], [-0.232, 0.06], [-0.242, 0.07, 1], [-0.248, 0.056], [-0.262, 0.044, 1], [-0.256, 0.034, 1]], 2),
    pec: F([[0.285, 0.074, 1], [0.262, 0.115], [0.22, 0.165], [0.17, 0.21], [0.118, 0.242, 1], [0.142, 0.2], [0.168, 0.158], [0.195, 0.122], [0.222, 0.098, 1]], 4),
    pecFar: F([[0.262, 0.064, 1], [0.24, 0.102], [0.2, 0.145], [0.155, 0.182], [0.115, 0.204, 1], [0.138, 0.17], [0.163, 0.135], [0.188, 0.105], [0.205, 0.086, 1]], 4),
    pelvic: F([[-0.03, 0.11, 1], [-0.052, 0.134], [-0.08, 0.152], [-0.102, 0.16, 1], [-0.1, 0.14], [-0.106, 0.116], [-0.115, 0.095, 1]], 3),
    pelvicFar: F([[-0.045, 0.105, 1], [-0.064, 0.124], [-0.088, 0.138], [-0.108, 0.144, 1], [-0.107, 0.128], [-0.112, 0.108], [-0.12, 0.09, 1]], 3),
    caudal: {
      pts: [
        [-0.27, -0.04, 1], [-0.33, -0.068], [-0.39, -0.12], [-0.45, -0.182], [-0.5, -0.232, 1], [-0.468, -0.16], [-0.434, -0.085],
        [-0.41, -0.025], [-0.406, 0.012], [-0.418, 0.066], [-0.443, 0.124], [-0.466, 0.172, 1], [-0.43, 0.128], [-0.382, 0.075],
        [-0.33, 0.036], [-0.27, 0.022, 1],
      ],
      lead: [
        [[-0.27, -0.04], [-0.33, -0.068], [-0.39, -0.12], [-0.45, -0.182], [-0.5, -0.232]],
        [[-0.466, 0.172], [-0.43, 0.128], [-0.382, 0.075], [-0.33, 0.036], [-0.27, 0.022]],
      ],
      trail: [[-0.5, -0.232], [-0.468, -0.16], [-0.434, -0.085], [-0.41, -0.025], [-0.406, 0.012], [-0.418, 0.066], [-0.443, 0.124], [-0.466, 0.172]],
      base: [-0.29, 0], tip: [-0.48, 0],
    },
  },
  paint: {
    extras(g, res, v, P) {
      const sets = [
        [[0.13, 0.33, 0.05, -1.1, 5, 0.008], [-0.05, 0.38, 0.09, 0.14, 1], [0.36, 0.22, 0.025, -0.9, 3], [0.22, 0.5, 0.06, -0.3, 2], [-0.17, 0.3, 0.035, -1.2, 3], [0.03, 0.62, 0.05, 0.2, 1]],
        [[0.05, 0.28, 0.045, -1.25, 4, 0.009], [0.27, 0.42, 0.08, -0.12, 1], [-0.1, 0.42, 0.04, -1.0, 4], [0.38, 0.32, 0.03, 0.5, 2], [0.16, 0.18, 0.05, 0.1, 1], [-0.2, 0.55, 0.03, 0.3, 1]],
      ];
      scars(g, res, v, P, sets[v % 2], { width: 0.003, pale: 'rgba(150,142,148,0.42)', dark: 'rgba(8,10,14,0.38)' });
      biteScar(g, res, P, v ? 0.1 : -0.04, v ? 0.3 : 0.36);
      craters(g, res, P, v ? [[0.08, 0.5, 0.008], [-0.12, 0.35, 0.007], [0.3, 0.6, 0.006], [-0.02, 0.2, 0.006]] : [[0.18, 0.44, 0.008], [-0.06, 0.55, 0.007], [0.0, 0.25, 0.0065], [-0.2, 0.4, 0.006], [0.31, 0.28, 0.005]]);
    },
    head(g, res) {
      // heavy brow shading the small cold eye, skin folds behind the gape
      soft(g, res, 0.008, 'rgba(6,8,12,0.5)', (q) => q.ellipse(0.413, -0.049, 0.024, 0.008, -0.12, 0, TAU));
      soft(g, res, 0.006, 'rgba(6,8,12,0.4)', (q) => q.ellipse(0.415, -0.04, 0.014, 0.011, 0, 0, TAU));
      for (let i = 0; i < 3; i++) {
        softStroke(g, res, 0.0015, 'rgba(10,12,16,0.35)', 0.0024, (q) => {
          q.moveTo(0.362 - i * 0.008, 0.032 + i * 0.002);
          q.quadraticCurveTo(0.356 - i * 0.008, 0.045 + i * 0.003, 0.35 - i * 0.008, 0.056 + i * 0.004);
        });
      }
    },
    dorsal(g, res, v) {
      // a ragged trailing edge: small V-shaped tears, plus old wear lines
      const nicks = v ? [[0.103, -0.242, 0.012, 2.9], [0.089, -0.178, 0.008, 2.7]] : [[0.1, -0.225, 0.014, 2.85], [0.084, -0.165, 0.007, 2.6]];
      tears(g, nicks);
      finWear(g, res, 0.14, -0.2, 0.04, -1.9, 3, 'rgba(150,150,156,0.22)');
    },
    caudal(g, res, v) {
      tears(g, v ? [[-0.455, -0.13, 0.016, 2.2]] : [[-0.437, -0.09, 0.014, 2.0], [-0.44, 0.11, 0.01, -2.2]]);
    },
    front(g, res, v) {
      if (lod(res) < 2) return;
      const r = rngFor('cope' + v);
      // a few copepods trailing from the dorsal fin's rear edge (only visible on big renders)
      const spots = [[0.076, -0.158, 2.6], [0.069, -0.149, 2.9], [-0.237, -0.05, 2.8]];
      spots.forEach(([x, y, a]) => copepod(g, res, x, y, a + (r.next() - 0.5) * 0.4, 0.6 + r.next() * 0.2));
    },
  },
  swim: { swing: 0.026, waves: 0.8, power: 2.2, rigid: 0.18, squash: 0.55, strips: 26 },
  bounds: { x0: -0.505, x1: 0.505, y0: -0.3, y1: 0.255 },
  anchor: { x: 0.44, y: 0.042 },
  capPx: 1390,
});
