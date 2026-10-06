// Ocean sunfish (Mola mola) — a giant flattened disc with no real tail: a scalloped clavus, tall dorsal and anal
// fins that scull side to side (the body itself never waves), rough silvery-grey skin, tiny mouth and eye.
import { profile, paintBody, fin, gill, eye, spot, soft, glint, mottle, speckle, rgba, mixc, lite, dark, shift, createRng } from './kit.js';
import { ease } from './rig.js';

const P = profile(
  [[0.5, -0.012], [0.485, -0.048], [0.455, -0.095], [0.4, -0.15], [0.31, -0.21], [0.19, -0.255], [0.05, -0.285], [-0.1, -0.3], [-0.24, -0.298], [-0.34, -0.275], [-0.4, -0.24], [-0.43, -0.21]],
  [[0.5, 0.012], [0.485, 0.05], [0.455, 0.1], [0.4, 0.158], [0.31, 0.22], [0.19, 0.265], [0.05, 0.295], [-0.1, 0.31], [-0.24, 0.308], [-0.34, 0.283], [-0.4, 0.245], [-0.43, 0.21]],
);
const SKIN = ['#6e6f70', '#737678', '#6b6e6c'];

function clavus(g, res, v) {
  // the "tail": a shallow scalloped blade behind the trunk, made of fin rays
  const pts = [[-0.4, -0.2], [-0.43, -0.215]];
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const y = -0.215 + 0.43 * k;
    const bulge = 0.5 - 0.5 * Math.cos(Math.PI * 2 * (k * n - Math.floor(k * n)));
    pts.push([-0.5 + 0.012 * (1 - Math.sin(Math.PI * k)) + 0.012 * bulge, y, i % 1 === 0 ? 0 : 0]);
  }
  pts.push([-0.43, 0.215], [-0.4, 0.2]);
  const col = shift('#7a8088', [-4, 0, 4][v]);
  fin(g, res, {
    pts,
    stops: [[0, dark(col, 0.25)], [0.4, col], [1, rgba(lite(col, 0.2), 0.95)]],
    axis: [-0.41, 0, -0.5, 0],
    rays: { n: 22, to: [2, n + 2], from: [[-0.415, -0.17], [-0.415, 0.17]], col: '#1a2028', a: 0.35, fade: 0.3, w: 0.0018, hl: '#c8ced4', hla: 0.14 },
    scallop: { from: 2, to: n + 2, n: 12, depth: 0.011 },
    edge: { col: 'rgba(20,26,34,0.4)', w: 0.003, to: 2 },
    mottle: { color: '#1a2028', a: 0.2, scale: 0.3, lo: 0.42, hi: 0.78, seed: 41 },
    seg: 6,
  });
}

function paint(g, res, v) {
  const rng = createRng(601 + v * 7);
  const skin = SKIN[v];
  clavus(g, res, v);
  paintBody(g, res, P, {
    fade: 0,
    skin(t, U) {
      U.grad([[0, dark(skin, 0.45)], [0.14, dark(skin, 0.2)], [0.36, skin], [0.55, lite(skin, 0.2)], [0.78, lite(skin, 0.42)], [1, lite(skin, 0.55)]]);
      // the thick band of skin where the clavus begins
      U.band(0.0, 1.0, dark(skin, 0.3), 0.22, 0.02, -0.43, -0.405);
      U.band(0.0, 1.0, lite(skin, 0.3), 0.18, 0.02, -0.4, -0.385);
    },
    over(gg) {
      // rough, blotchy skin: light patches, dark cloud, then fine grain
      mottle(gg, -0.44, -0.32, 0.5, 0.32, { color: '#d4d6d8', a: 0.42, scale: 0.5, lo: 0.5, hi: 0.72, seed: 5 + v, sy: 0.7 });
      mottle(gg, -0.44, -0.32, 0.5, 0.32, { color: '#3a3a3c', a: 0.38, scale: 0.36, lo: 0.52, hi: 0.8, seed: 11 + v, sy: 0.8 });
      mottle(gg, -0.44, -0.32, 0.5, 0.32, { color: '#5a4e48', a: 0.3, scale: 0.7, lo: 0.45, hi: 0.75, seed: 29 + v });
      mottle(gg, -0.44, -0.32, 0.5, 0.32, { color: '#e8ebee', a: 0.18, scale: 0.08, lo: 0.62, hi: 0.88, seed: 17 });
      speckle(gg, rng, 700, -0.44, -0.32, 0.5, 0.32, 0.001, 0.0025, ['#1c2229', '#e8ecef', '#9aa0a6'], 0.08, 0.28);
      // a few pale spots on the lower flank
      for (let i = 0; i < 18; i++) {
        const x = -0.35 + rng.next() * 0.75, vv = 0.5 + rng.next() * 0.42;
        spot(gg, x, P.at(x, vv), 0.006 + rng.next() * 0.012, '#eef1f3', 0.35, 0.3);
      }
    },
    shade: { dark: '#141a22', sheen: 0.3, sheenV: 0.22, sheenW: 0.16, gloss: 0.15, breakup: 0.6, belly: 0.3, bounce: 0.5, rim: 0.38, topLight: 0.1 },
    face(gg) {
      // small round gill opening in front of the pectoral, cheek shading, tiny beak mouth, small eye
      spot(gg, 0.235, -0.02, 0.012, '#1c2228', 0.6, 0.4, 0.03);
      soft(gg, 0.02, 'rgba(20,26,34,0.3)', () => {
        gg.beginPath();
        gg.ellipse(0.3, 0.02, 0.1, 0.16, 0, 0, 7);
        gg.stroke();
      });
      gill(gg, res, { x: 0.26, y0: -0.12, y1: 0.1, bulge: 0.02, dark: '#1c2228', a: 0.16, shadow: 0.14, la: 0.1, w: 0.002 });
      spot(gg, 0.492, 0.0, 0.016, '#1a1216', 0.9, 0.45, 0.02);
      spot(gg, 0.492, 0.0, 0.009, '#3a2026', 0.7, 0.5, 0.012);
      gg.strokeStyle = 'rgba(230,232,236,0.45)';
      gg.lineWidth = 0.004;
      gg.beginPath();
      gg.arc(0.49, 0.0, 0.021, Math.PI * 0.6, Math.PI * 1.4, true);
      gg.stroke();
      eye(gg, 0.365, -0.045, 0.021, { iris: '#5c6878', irisDark: '#1c222c', pupil: 0.62, ring: 'rgba(20,26,34,0.5)', rim: 'rgba(220,226,236,0.4)', socket: 0.3 });
      glint(gg, 0.41, -0.1, 0.05, 0.008, 0.2, -0.7);
    },
  });
}

function blade(g, res, v, side) {
  // dorsal (side = -1) or anal (side = +1) fin: a tall, slightly swept blade with a rounded tip
  const s = side;
  const base = (x) => (s < 0 ? P.top(x) : P.bot(x));
  const col = shift('#5e6469', [-4, 0, 4][v]);
  const pts = [
    [-0.11, base(-0.11) - s * 0.03], [-0.14, base(-0.14) + s * 0.14], [-0.19, base(-0.19) + s * 0.3], [-0.24, base(-0.24) + s * 0.4],
    [-0.3, base(-0.3) + s * 0.44], [-0.35, base(-0.35) + s * 0.39], [-0.385, base(-0.385) + s * 0.25], [-0.405, base(-0.405) + s * 0.1], [-0.415, base(-0.415) - s * 0.03],
  ];
  fin(g, res, {
    pts,
    stops: [[0, dark(col, 0.35)], [0.4, col], [1, rgba(lite(col, 0.12), 0.97)]],
    axis: [-0.26, base(-0.26), -0.3, base(-0.3) + s * 0.42],
    rays: { n: 16, from: [[-0.125, base(-0.125) + s * 0.01], [-0.395, base(-0.395) + s * 0.01]], lean: [0.2, 0.0], up: s, col: '#1a2028', a: 0.35, w: 0.0018, hl: '#c8ced4', hla: 0.14, len: 0.5 },
    edge: { col: 'rgba(20,26,34,0.4)', w: 0.003, to: 4 },
    mottle: { color: '#1a2028', a: 0.22, scale: 0.3, lo: 0.42, hi: 0.78, seed: 43 },
    shade: 'rgba(20,26,34,0.35)',
    paint(gg) {
      mottle(gg, -0.45, -0.8, -0.05, 0.8, { color: '#e0e4e8', a: 0.14, scale: 0.12, lo: 0.58, hi: 0.85, seed: 47 });
    },
  });
}

function paintPec(g, res, v) {
  const col = shift('#6e767e', [-4, 0, 4][v]);
  fin(g, res, {
    pts: [[0.215, -0.01], [0.2, -0.06], [0.175, -0.105, 1], [0.15, -0.085], [0.155, -0.03], [0.185, 0.0]],
    stops: [[0, dark(col, 0.2)], [1, rgba(lite(col, 0.25), 0.92)]],
    rays: { n: 8, to: [1, 4], from: [[0.21, -0.012], [0.19, -0.002]], col: '#1a2028', a: 0.35, w: 0.0016 },
    edge: { col: 'rgba(20,26,34,0.4)', w: 0.0024, to: 2 },
  });
}

const beat = (anim, st) => {
  const hk = st.hook || 0;
  return { ph: anim.phase * 0.55 + hk * anim.t * 3, k: 0.6 + 0.6 * Math.min(1, anim.amp) + 0.5 * hk };
};

export const def = {
  id: 'ocean_sunfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.73, y1: 0.73 },
  box: { x0: -0.51, x1: 0.51, y0: -0.33, y1: 0.33 },
  mouth: { x: 0.49, y: 0.0 },
  paint,
  swim: { swing: 0, idle: 0, squash: 0, strips: 2, thrash: 0.5 },
  under(ctx, len, anim, opts, st) {
    // the whole disc rocks slowly with the fin strokes
    ctx.rotate(Math.sin(anim.phase * 0.55 + 1) * 0.025 + Math.sin(anim.t * 0.5 + anim.uid) * 0.02);
  },
  parts: [
    {
      key: 'dor', box: { x0: -0.43, x1: -0.1, y0: -0.76, y1: -0.15 }, pivot: [-0.26, -0.27], behind: true, paint: (g, r, v) => blade(g, r, v, -1),
      pose(anim, st, out) {
        const b = beat(anim, st);
        out.rot = Math.sin(b.ph) * 0.2 * b.k;
        out.sx = 1 - 0.18 * b.k * (0.5 + 0.5 * Math.cos(b.ph + 1.2));
      },
    },
    {
      key: 'ana', box: { x0: -0.43, x1: -0.1, y0: 0.15, y1: 0.76 }, pivot: [-0.26, 0.27], behind: true, paint: (g, r, v) => blade(g, r, v, 1),
      pose(anim, st, out) {
        const b = beat(anim, st);
        out.rot = -Math.sin(b.ph) * 0.2 * b.k;
        out.sx = 1 - 0.18 * b.k * (0.5 + 0.5 * Math.cos(b.ph + 1.2));
      },
    },
    {
      key: 'pec', box: { x0: 0.13, x1: 0.23, y0: -0.12, y1: 0.02 }, pivot: [0.2, -0.005], paint: paintPec,
      pose(anim, st, out) {
        out.rot = Math.sin(anim.t * 5.5 + anim.uid) * 0.25;
        out.sx = 0.8 + 0.2 * Math.cos(anim.t * 5.5 + anim.uid);
      },
    },
  ],
};
