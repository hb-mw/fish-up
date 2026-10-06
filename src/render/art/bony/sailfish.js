// Atlantic sailfish (Istiophorus albicans) — the fastest fish in the sea: slender bill, bronze-blue flanks with
// bars of pale dots, and an enormous spotted cobalt sail that rises when it is excited or hooked.
import { profile, paintBody, fin, ridge, scales, gill, mouthLine, eye, spot, soft, glint, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull, ease } from './rig.js';
import { paintBill, keels, lunate, lunateFin, flankBars } from './billfish-extra.js';

const P = profile(
  [[0.5, -0.0015], [0.42, -0.005], [0.35, -0.009], [0.305, -0.015], [0.28, -0.028], [0.25, -0.046], [0.21, -0.062], [0.16, -0.071], [0.09, -0.074], [0.0, -0.07], [-0.1, -0.06], [-0.2, -0.046], [-0.28, -0.03], [-0.335, -0.022]],
  [[0.5, 0.0015], [0.42, 0.005], [0.35, 0.009], [0.335, 0.01], [0.324, 0.021], [0.3, 0.03], [0.26, 0.042], [0.21, 0.052], [0.15, 0.058], [0.07, 0.06], [-0.03, 0.057], [-0.13, 0.047], [-0.23, 0.034], [-0.3, 0.024], [-0.335, 0.02]],
);
const HINGE = [0.215, 0.03], TIP = [0.332, 0.017], CORNER = [0.248, 0.027];
const PEC = [0.14, 0.024];
const SAIL_Y = -0.055; // the line the sail scales about (just inside the back)

function paint(g, res, v) {
  const rng = createRng(401 + v * 7);
  const col = shift('#13234f', [-5, 0, 6][v]);
  // tail + small second dorsal / anals + pelvic filaments
  lunateFin(g, res, lunate({ P, root: 0.09, up: [-0.5, -0.22], lo: [-0.5, 0.22], notchX: -0.44, lead: 0.05, trail: 0.1 }), { col, ray: '#06101f', hl: '#8fb0d8', n: 40 });
  fin(g, res, { pts: ridge(P, 'top', [[-0.232, -0.01], [-0.242, 0.03, 1], [-0.268, 0.016], [-0.285, -0.01]], 0.5), stops: [[0, col], [1, rgba(lite(col, 0.2), 0.9)]] });
  fin(g, res, { pts: ridge(P, 'bot', [[-0.242, -0.01], [-0.252, 0.028, 1], [-0.274, 0.014], [-0.29, -0.01]], 0.5), stops: [[0, col], [1, rgba(lite(col, 0.2), 0.9)]] });
  const an = ridge(P, 'bot', [[-0.11, -0.012], [-0.135, 0.05], [-0.152, 0.078, 1], [-0.178, 0.04], [-0.205, 0.014], [-0.22, -0.012]], 0.55);
  fin(g, res, { pts: an, stops: [[0, dark(col, 0.1)], [1, rgba(lite(col, 0.15), 0.9)]], rays: { n: 12, from: [[-0.115, P.bot(-0.115) - 0.012], [-0.218, P.bot(-0.218) - 0.012]], lean: [0.5, 1.4], up: 1, col: '#06101f', a: 0.35, w: 0.0014 }, edge: { col: 'rgba(5,12,30,0.4)', w: 0.003, to: 2 } });
  // pelvic: two long thin filaments reaching back toward the anal fin
  for (const [dx, a] of [[-0.012, 0.6], [0, 0.95]]) {
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = dark(col, 0.1);
    g.lineCap = 'round';
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(0.135 + dx, P.bot(0.135) - 0.005);
    g.quadraticCurveTo(0.06 + dx, P.bot(0.06) + 0.05, -0.09 + dx, P.bot(-0.09) + 0.045);
    g.stroke();
    g.lineWidth = 0.0025;
    g.strokeStyle = rgba(lite(col, 0.3), 0.6);
    g.stroke();
    g.restore();
  }
  paintBody(g, res, P, {
    fade: 0.04,
    skin(t, U) {
      const dh = [-5, 0, 6][v];
      U.grad([[0, '#050c22'], [0.08, shift('#0f2250', dh)], [0.24, shift('#1b3a78', dh)], [0.4, shift('#4d6a95', dh)], [0.5, '#8a8f98'], [0.6, '#c9cfd6'], [0.74, '#eceef0'], [1, '#ffffff']]);
      // bronze wash along the mid flank
      U.band(0.36, 0.56, '#b08a52', 0.3, 0.08, -0.33, 0.28);
      flankBars(t, U, { n: 19, x0: 0.19, x1: -0.31, v0: 0.08, v1: 0.74, v0jit: 0.03, v1jit: 0.1, color: '#a9dcff', a: 0.55, slant: U.dx(0.006), dotted: true, width: 0.009 });
    },
    over(gg) {
      mottle(gg, -0.34, -0.08, 0.34, 0.07, { color: '#0a1a44', a: 0.22, scale: 0.4, lo: 0.42, hi: 0.72, seed: 3 + v });
      scales(gg, res, P, { rows: 18, x0: -0.3, x1: 0.16, v0: 0.1, v1: 0.9, da: 0.12, la: 0.1, dark: '#0a1a3a', rng, vFade: (vv) => 1 - 0.6 * vv, xFade: (x) => Math.min(1, (0.16 - x) / 0.04) });
    },
    shade: { dark: '#07112a', sheen: 0.34, sheenV: 0.2, sheenW: 0.1, gloss: 0.3, belly: 0.3, bounce: 0.6, rim: 0.3, topLight: 0.12 },
    face(gg) {
      paintBill(gg, res, P, { x0: 0.28, x1: 0.5, jawX: 0.337, top: '#1a2a4a', bot: '#6c7f9c', fade: 0.06 });
      soft(gg, 0.005, 'rgba(226,232,240,0.95)', () => {
        gg.beginPath();
        gg.moveTo(0.334, 0.014);
        gg.quadraticCurveTo(0.29, 0.018, 0.245, 0.028);
        gg.quadraticCurveTo(0.23, 0.045, 0.222, 0.055);
        gg.quadraticCurveTo(0.28, 0.04, 0.326, 0.025);
        gg.closePath();
        gg.fill();
      });
      spot(gg, 0.19, 0.015, 0.06, '#ffffff', 0.22, 0.05, 0.028);
      gill(gg, res, { x: 0.205, y0: -0.035, y1: 0.04, bulge: 0.01, dark: '#1a2a4e', a: 0.14, shadow: 0.12, la: 0.08, w: 0.0018 });
      gill(gg, res, { x: 0.155, y0: -0.062, y1: 0.054, bulge: 0.022, dark: '#0e1c3e', a: 0.42, shadow: 0.24, plate: 0.18, w: 0.0022 });
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.002, dark: '#101a30', a: 0.65, w: 0.0024 });
      eye(gg, 0.243, -0.018, 0.0145, { iris: '#56688a', irisDark: '#1c2638', pupil: 0.66, ring: 'rgba(10,20,40,0.4)', rim: 'rgba(210,225,245,0.45)', socket: 0.25 });
      glint(gg, 0.27, -0.04, 0.025, 0.004, 0.28, -0.3);
      keels(gg, res, P, -0.31, { w: 0.045, h: 0.0045 });
    },
  });
}

function paintSail(g, res, v) {
  const rng = createRng(77 + v);
  const col = shift('#1f45a8', [-6, 0, 6][v]);
  const top = (x) => P.top(x);
  const pts = [
    [0.2, top(0.2) + 0.03], [0.192, top(0.192) - 0.07], [0.17, top(0.17) - 0.17], [0.125, top(0.125) - 0.225], [0.06, top(0.06) - 0.24],
    [-0.01, top(-0.01) - 0.235], [-0.08, top(-0.08) - 0.215], [-0.14, top(-0.14) - 0.17], [-0.185, top(-0.185) - 0.1], [-0.21, top(-0.21) - 0.03], [-0.215, top(-0.215) + 0.03],
  ];
  fin(g, res, {
    pts,
    stops: [[0, dark(col, 0.35)], [0.35, col], [0.8, lite(col, 0.12)], [1, rgba(lite(col, 0.25), 0.9)]],
    axis: [0.0, -0.05, 0.0, -0.3],
    rays: { n: 42, from: [[0.19, top(0.19) + 0.01], [-0.205, top(-0.205) + 0.01]], lean: [0.15, 0.95], col: '#071030', a: 0.4, w: 0.0016, hl: '#9fc0ff', hla: 0.14, len: 0.4 },
    scallop: { from: 2, to: 8, n: 22, depth: 0.004 },
    edge: { col: 'rgba(5,12,40,0.45)', w: 0.003, to: 3 },
    mottle: { color: '#061232', a: 0.22, scale: 0.35, lo: 0.42, hi: 0.78, seed: 31 },
    paint(gg) {
      // scattered small black spots
      for (let i = 0; i < 75; i++) {
        const x = -0.2 + rng.next() * 0.38;
        const y = top(x) - 0.03 - rng.next() * 0.19;
        spot(gg, x, y, 0.0018 + rng.next() * 0.0025, '#05091c', 0.7, 0.6);
      }
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.15, 0.014], [0.09, 0.036], [-0.03, 0.082, 1], [0.03, 0.07], [0.1, 0.05], [0.147, 0.036]],
    stops: [[0, '#1a2a4e'], [0.5, 'rgba(34,54,96,0.95)'], [1, 'rgba(90,110,150,0.85)']],
    axis: [0.145, 0.025, -0.03, 0.082],
    rays: { n: 14, to: [2, 4], from: [[0.148, 0.017], [0.145, 0.034]], col: '#06101f', a: 0.35, w: 0.0013, hl: '#9fb8dc', hla: 0.12 },
    edge: { col: 'rgba(5,12,30,0.45)', w: 0.0024, to: 2 },
  });
}

const EXCITED = { hooked: 1, flee: 1, curious: 1, approach: 1, nibble: 1, bite: 1, jump: 1, icon: 1, landed: 1 };

export const def = {
  id: 'sailfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.32, y1: 0.22 },
  box: { x0: -0.51, x1: 0.51, y0: -0.12, y1: 0.23 },
  mouth: { x: 0.33, y: 0.016 },
  paint,
  swim: { swing: 0.04, waves: 0.95, power: 3.0, head: 0.03, squash: 0.035, freq: 1.35, thrash: 1.3, idle: 0.05 },
  state(st, anim) {
    const target = EXCITED[anim.state] || anim.hooked ? 1 : anim.state === 'idle' ? 0.6 : anim.amp > 1.0 ? 0.45 : 0.18;
    ease(st, 'sail', target, target > (st.sail || 0) ? 5 : 2.5);
  },
  parts: [
    {
      key: 'sail', box: { x0: -0.23, x1: 0.22, y0: -0.33, y1: 0.0 }, pivot: [0.0, SAIL_Y], paint: paintSail, behind: true, swim: true,
      pose(anim, st, out) {
        out.sy = 0.14 + 0.86 * (st.sail === undefined ? 1 : st.sail) * (1 + 0.025 * Math.sin(anim.t * 3.1 + anim.uid));
      },
    },
    { key: 'pec', box: { x0: -0.05, x1: 0.16, y0: 0.0, y1: 0.1 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.05, rate: 1.6, squash: 0.1, fold: 0.1 }) },
  ],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER, 8, 0.009), gape: 0.42, cavity: '#1c0a12', throat: '#6a2630' },
  gillSlit: { x: 0.155, y0: -0.055, y1: 0.048, bulge: 0.022 },
};
