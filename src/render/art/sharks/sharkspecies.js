// The eight sharks, as specs for the parametric builder (shark.js). Unit space: snout tip at x = +0.5,
// tail tip at x = −0.5, belly toward +y. All numbers are anatomy (proportions from field-guide plates).
import { makeShark } from './shark.js';
import { TAU, spline, softStroke, soft, rngFor, ca, band, lod } from './kit.js';

// ── Great white ─────────────────────────────────────────────────────────────────────────────────
/**
 * Healed scars: rake marks from another shark's teeth (short, near-parallel, slightly curved pale lines with
 * a darker rim) and the odd longer gash. list: [x, f (fraction of height), length, angle, count, spacing]
 */
export function scars(g, res, v, P, list, o = {}) {
  const r = rngFor('scars' + v + (o.key || ''));
  const pale = o.pale || 'rgba(214,220,224,0.6)', dark = o.dark || 'rgba(16,20,26,0.32)';
  for (const s of list) {
    const [x, f, len, ang, n = 1, sp = 0.0065] = s;
    const y = P.at(x, f);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * sp;
      const l = len * (0.75 + r.next() * 0.45);
      const dx = Math.cos(ang) * l, dy = Math.sin(ang) * l;
      const cx = x + nx * off + (r.next() - 0.5) * sp * 0.5, cy = y + ny * off;
      const bend = (r.next() - 0.5) * l * 0.25;
      const path = (q) => {
        q.moveTo(cx - dx / 2, cy - dy / 2);
        q.quadraticCurveTo(cx + nx * bend, cy + ny * bend, cx + dx / 2, cy + dy / 2);
      };
      const w = (o.width || 0.0016) * (0.8 + r.next() * 0.5);
      // healed tissue: a soft pale welt with a darker seam down its middle (not a chalk line)
      softStroke(g, res, w * 0.9, dark, w * 2.2, path);
      softStroke(g, res, w * 0.7, pale, w * 1.5, path);
      if (o.seam !== false) softStroke(g, res, w * 0.2, 'rgba(40,36,40,0.35)', w * 0.35, path);
    }
  }
}

export const great_white = makeShark({
  id: 'great_white',
  variants: 3,
  top: [
    [0.5, -0.004], [0.488, -0.024], [0.462, -0.048], [0.42, -0.076], [0.35, -0.104], [0.26, -0.124], [0.16, -0.132],
    [0.06, -0.124], [-0.04, -0.104], [-0.14, -0.074], [-0.22, -0.047], [-0.29, -0.031], [-0.34, -0.022], [-0.375, -0.016],
  ],
  bot: [
    [0.5, -0.004], [0.494, 0.012], [0.478, 0.03], [0.45, 0.05], [0.41, 0.066], [0.36, 0.078], [0.3, 0.09], [0.21, 0.102],
    [0.1, 0.106], [-0.01, 0.096], [-0.1, 0.076], [-0.2, 0.046], [-0.29, 0.022], [-0.34, 0.006], [-0.375, -0.008],
  ],
  colors: {
    back: '#5a6570', top: '#7a8792', flank: '#3f4952', belly: '#e9edee', bellyLit: '#ffffff', bellyShade: '#7f8b97', fin: '#59646e',
    rim: '#d6e8f2', gum: '#93424a', mouth: '#3b1015', throat: '#0b0305', gill: '#1b232b',
  },
  counter: {
    // just under the eye, dipping behind the gills, along mid-flank, then off the belly before the tail
    f: (x) => (x > 0.36 ? 0.62 : x > 0.26 ? 0.62 - (0.36 - x) * 0.7 : x > -0.08 ? 0.55 + Math.sin(x * 9) * 0.02 : 0.55 + Math.pow(-0.08 - x, 1.4) * 2.6),
    rough: 0.011, freq: 34, soft: 0.0024,
  },
  light: { top: 0.6, flank: 0.6, sheen: 0.18, spec: 0.26 },
  eye: [0.418, -0.033, 0.0105],
  nostril: [0.47, 0.012, 0.012],
  gills: { xs: [0.35, 0.331, 0.312, 0.293, 0.274], top: 0.3, bot: 0.84, lean: 0.008, bow: 0.006, width: 0.0026, alpha: 0.36 },
  keel: [-0.2, -0.335, 0.5],
  mouth: {
    hinge: [0.383, 0.033], front: [0.471, 0.02],
    line: [[0.383, 0.033], [0.405, 0.0315], [0.43, 0.0285], [0.452, 0.0245], [0.471, 0.02]],
    throat: 0.368, open: 0.48, idle: 0.14, idleRate: 0.45,
    teeth: { kind: 'tri', n: 10, size: 0.0145, width: 0.8, taper: 0.55, rake: 0.08, nLow: 9, sizeLow: 0.011 },
  },
  fins: {
    d1: {
      parts: [
        [[0.2, -0.118], [0.175, -0.165], [0.145, -0.215], [0.118, -0.252], [0.104, -0.262]],
        [[0.104, -0.262], [0.098, -0.225], [0.088, -0.18], [0.075, -0.145], [0.058, -0.126]],
      ],
      lead: [0], trail: [1], base: [0.13, -0.12], tip: [0.104, -0.262],
    },
    d2: {
      parts: [[[-0.19, -0.044], [-0.203, -0.06], [-0.214, -0.071]], [[-0.214, -0.071], [-0.222, -0.058], [-0.236, -0.046], [-0.236, -0.036]]],
      lead: [0], trail: [1], base: [-0.21, -0.042], tip: [-0.214, -0.071],
    },
    anal: {
      parts: [[[-0.212, 0.036], [-0.224, 0.052], [-0.236, 0.062]], [[-0.236, 0.062], [-0.242, 0.048], [-0.256, 0.038], [-0.254, 0.026]]],
      lead: [0], trail: [1], base: [-0.23, 0.035], tip: [-0.236, 0.062],
    },
    pec: {
      parts: [
        [[0.285, 0.06], [0.262, 0.1], [0.215, 0.152], [0.16, 0.198], [0.112, 0.226]],
        [[0.112, 0.226], [0.14, 0.185], [0.168, 0.145], [0.195, 0.108], [0.222, 0.084]],
      ],
      lead: [0], trail: [1], base: [0.25, 0.075], tip: [0.112, 0.226],
    },
    pecFar: {
      parts: [
        [[0.262, 0.05], [0.24, 0.09], [0.198, 0.132], [0.152, 0.166], [0.112, 0.184]],
        [[0.112, 0.184], [0.135, 0.152], [0.162, 0.118], [0.188, 0.088], [0.205, 0.07]],
      ],
      lead: [0], trail: [1], base: [0.23, 0.07], tip: [0.112, 0.184],
    },
    pelvic: {
      parts: [[[-0.035, 0.09], [-0.056, 0.113], [-0.08, 0.13], [-0.1, 0.139]], [[-0.1, 0.139], [-0.098, 0.12], [-0.104, 0.098], [-0.112, 0.078]]],
      lead: [0], trail: [1], base: [-0.065, 0.088], tip: [-0.1, 0.139],
    },
    pelvicFar: {
      parts: [[[-0.05, 0.085], [-0.068, 0.104], [-0.09, 0.118], [-0.108, 0.124]], [[-0.108, 0.124], [-0.106, 0.108], [-0.112, 0.09], [-0.118, 0.074]]],
      lead: [0], trail: [1], base: [-0.075, 0.08], tip: [-0.108, 0.124],
    },
    caudal: {
      parts: [
        [[-0.27, -0.034], [-0.33, -0.058], [-0.39, -0.11], [-0.45, -0.168], [-0.5, -0.214]],
        [[-0.5, -0.214], [-0.468, -0.15], [-0.434, -0.08], [-0.41, -0.022], [-0.406, 0.012], [-0.418, 0.062], [-0.443, 0.118], [-0.466, 0.162]],
        [[-0.466, 0.162], [-0.43, 0.12], [-0.382, 0.07], [-0.33, 0.034], [-0.27, 0.02]],
      ],
      lead: [0, 2], trail: [1], base: [-0.29, 0], tip: [-0.48, 0],
    },
  },
  paint: {
    extras(g, res, v, P) {
      const sets = [
        [[0.12, 0.36, 0.034, -1.15, 4, 0.007], [-0.07, 0.42, 0.05, 0.12, 1], [0.37, 0.22, 0.018, -0.9, 2]],
        [[0.03, 0.3, 0.03, -1.3, 3, 0.008], [0.26, 0.4, 0.045, -0.15, 1]],
        [[0.2, 0.4, 0.03, -1.05, 4, 0.0065], [-0.13, 0.32, 0.028, -1.2, 3], [0.33, 0.48, 0.02, 0.3, 1]],
      ];
      scars(g, res, v, P, sets[v % 3]);
    },
    dorsal(g, res, v) {
      if (v !== 2) return;
      // an old bite notch in the trailing edge
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(0.083, -0.19, 0.011, 0, TAU);
      g.fill();
      g.restore();
    },
  },
  swim: { swing: 0.036, waves: 0.85, power: 2.1, rigid: 0.2, squash: 0.6 },
  bounds: { x0: -0.505, x1: 0.505, y0: -0.27, y1: 0.24 },
  anchor: { x: 0.452, y: 0.04 },
  capPx: 1500,
});

/**
 * Fin from corner-flagged points: pts[0] = base front (inside the body), pts[tip] = apex, pts[n-2] = free rear
 * tip, pts[n-1] = base rear (inside the body). Leading / trailing edges and the gradient axis are derived.
 */
export function F(pts, tip, o = {}) {
  const n = pts.length;
  const xy = (p) => [p[0], p[1]];
  return Object.assign({
    pts,
    lead: pts.slice(0, tip + 1).map(xy),
    trail: pts.slice(tip, n - 1).map(xy),
    base: [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2],
    tip: xy(pts[tip]),
    pivot: xy(pts[0]),
  }, o);
}

/** Cookie-cutter shark bite scars: pale oval craters with a darker rim. list: [x, f, r] */
export function craters(g, res, P, list) {
  for (const [x, f, r] of list) {
    const y = P.at(x, f);
    soft(g, res, r * 0.35, 'rgba(14,18,24,0.35)', (q) => q.ellipse(x, y, r * 1.15, r * 0.9, 0.2, 0, TAU));
    soft(g, res, r * 0.25, 'rgba(206,212,214,0.55)', (q) => q.ellipse(x, y, r * 0.85, r * 0.62, 0.2, 0, TAU));
    soft(g, res, r * 0.2, 'rgba(120,128,134,0.4)', (q) => q.ellipse(x + r * 0.1, y + r * 0.08, r * 0.45, r * 0.32, 0.2, 0, TAU));
  }
}

/** Fine parallel scratch lines on a fin (old wounds / wear), drawn inside the fin's clip. */
export function finWear(g, res, x, y, len, ang, n, col = 'rgba(210,216,220,0.35)') {
  for (let i = 0; i < n; i++) {
    const ox = i * 0.006 * Math.cos(ang + 1.57), oy = i * 0.006 * Math.sin(ang + 1.57);
    softStroke(g, res, 0.001, col, 0.0016, (q) => {
      q.moveTo(x + ox, y + oy);
      q.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
    });
  }
}

export const SHARK_DRAWERS = { great_white };
