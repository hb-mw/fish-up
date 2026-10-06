// Porcupine pufferfish painting: one sprite per inflation level f (0 = cruising oval, 1 = spiky ball).
import { profile, paintBody, fin, ridge, caudal, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, createRng } from './kit.js';

const KX = [0.5, 0.48, 0.44, 0.38, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.26, -0.3];
const T0 = [0.02, -0.035, -0.082, -0.112, -0.132, -0.142, -0.14, -0.13, -0.11, -0.08, -0.055, -0.04];
const B0 = [0.02, 0.072, 0.118, 0.148, 0.166, 0.176, 0.175, 0.165, 0.14, 0.1, 0.07, 0.05];
const T1 = [0.0, -0.045, -0.11, -0.2, -0.27, -0.32, -0.34, -0.32, -0.27, -0.19, -0.1, -0.045];
const B1 = [0.04, 0.085, 0.15, 0.24, 0.31, 0.36, 0.38, 0.36, 0.31, 0.23, 0.13, 0.055];
const CX = 0.1, CY = 0.02;

/** Body profile at inflation f. */
export function profileAt(f) {
  const top = KX.map((x, i) => [x, T0[i] + (T1[i] - T0[i]) * f]);
  const bot = KX.map((x, i) => [x, B0[i] + (B1[i] - B0[i]) * f]);
  return profile(top, bot);
}
/** Sprite box for level f (body + erect spines + fins). */
export function boxAt(f) {
  const P = profileAt(f);
  let y0 = 0, y1 = 0;
  for (const x of KX) {
    y0 = Math.min(y0, P.top(x));
    y1 = Math.max(y1, P.bot(x));
  }
  return { x0: -0.52, x1: 0.52 + 0.06 * f, y0: y0 - 0.1 * f - 0.08, y1: y1 + 0.1 * f + 0.08 };
}

function spines(g, res, P, f, rng, cols) {
  const L = 0.038 + 0.045 * f;
  for (let r = 0; r < 7; r++) {
    const vv = 0.08 + (0.84 * r) / 6;
    for (let x = 0.46; x > -0.27; x -= 0.046) {
      const xx = x + (r & 1 ? 0.02 : 0) + (rng.next() - 0.5) * 0.012;
      if (xx > P.x1 - 0.01) continue;
      const y = P.at(xx, vv + (rng.next() - 0.5) * 0.04);
      // skip the eye and the mouth
      if (xx > 0.27 && Math.abs(y + 0.07) < 0.075 && xx < 0.42) continue;
      if (xx > 0.44 && Math.abs(y - 0.02) < 0.05) continue;
      const k = Math.abs(2 * vv - 1);
      // flat (lying back) → sphere normal
      let nx = xx - CX, ny = y - CY;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const fx = -1, fy = (vv < 0.5 ? -1 : 1) * 0.12;
      let dx = fx + (nx - fx) * f, dy = fy + (ny - fy) * f;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const len = L * (f < 0.5 ? 1 : 0.35 + 0.65 * k) * (0.85 + 0.3 * rng.next());
      const w = 0.0045 + 0.002 * f;
      const px = -dy, py = dx;
      g.beginPath();
      g.moveTo(xx + px * w, y + py * w);
      g.lineTo(xx + dx * len, y + dy * len);
      g.lineTo(xx - px * w, y - py * w);
      g.closePath();
      const gr = g.createLinearGradient(xx, y, xx + dx * len, y + dy * len);
      gr.addColorStop(0, rgba(cols.spineDk, 0.9));
      gr.addColorStop(0.35, rgba(cols.spine, 0.95));
      gr.addColorStop(1, rgba(lite(cols.spine, 0.5), 0.9));
      g.fillStyle = gr;
      g.fill();
      if (f > 0.4) spot(g, xx, y, w * 1.6, cols.spineDk, 0.4 * f, 0.4);
    }
  }
}

/** Paint the whole puffer at inflation level f, variant v. */
export function paintPuffer(g, res, f, v) {
  const P = profileAt(f);
  const rng = createRng(801 + v * 31);
  const dh = [-6, 6][v] || 0;
  const tan = shift('#c9a872', dh, 0, 0), olive = shift('#8a7a4a', dh, 0, 0), blotch = '#4a3418', belly = '#f6efe0';
  const cols = { spine: '#efe2c4', spineDk: '#7a6238' };
  const finCol = rgba('#e6d9a8', 0.85), finTip = rgba('#f4ecd0', 0.6);
  // ── fins behind ──
  const tail = caudal({ P, root: 0.05, up: [-0.46, -0.075], lo: [-0.46, 0.08], notch: [-0.5, 0.003], lead: 0.03, trail: -0.2, sharp: false });
  fin(g, res, { pts: tail, stops: [[0, finCol], [1, finTip]], axis: [-0.32, 0, -0.5, 0], rays: { n: 12, to: [3, 7], from: tail.root, col: '#6a5230', a: 0.4, w: 0.0018 }, scallop: { from: 3, to: 7, n: 7, depth: 0.003 } });
  const dTop = (x) => P.top(x) + 0.01;
  fin(g, res, {
    pts: ridge(P, 'top', [[-0.1, -0.012], [-0.115, 0.045], [-0.16, 0.062], [-0.2, 0.052], [-0.225, 0.02, 1], [-0.235, -0.012]], 0.3),
    stops: [[0, finCol], [1, finTip]], rays: { n: 9, from: [[-0.108, dTop(-0.108)], [-0.23, dTop(-0.23)]], lean: [0.2, 0.9], col: '#6a5230', a: 0.4, w: 0.0016 },
  });
  const aBot = (x) => P.bot(x) - 0.01;
  fin(g, res, {
    pts: ridge(P, 'bot', [[-0.11, -0.012], [-0.125, 0.045], [-0.17, 0.06], [-0.21, 0.05], [-0.23, 0.02, 1], [-0.24, -0.012]], 0.3),
    stops: [[0, finCol], [1, finTip]], rays: { n: 9, from: [[-0.118, aBot(-0.118)], [-0.235, aBot(-0.235)]], lean: [0.2, 0.9], up: 1, col: '#6a5230', a: 0.4, w: 0.0016 },
  });
  // ── body ──
  paintBody(g, res, P, {
    fade: 0.02,
    skin(t, U) {
      U.grad([[0, olive], [0.2, mixc(olive, tan, 0.6)], [0.42, tan], [0.62, mixc(tan, belly, 0.6)], [0.8, belly], [1, '#ffffff']]);
      const bl = (pts, a) => soft(t, U.H * 0.025, rgba(blotch, a), () => { U.path(pts, true); t.fill(); });
      bl([[0.37, 0.0], [0.3, 0.0], [0.27, 0.42], [0.31, 0.55], [0.37, 0.5], [0.39, 0.25]], 0.85);       // bar through the eye
      bl([[0.3, 0.0], [0.17, 0.0], [0.16, 0.14], [0.22, 0.22], [0.29, 0.14]], 0.8);                     // nape
      bl([[0.24, 0.3], [0.13, 0.28], [0.1, 0.42], [0.15, 0.52], [0.24, 0.46]], 0.75);                   // above the pectoral
      bl([[-0.02, 0.0], [-0.2, 0.0], [-0.21, 0.2], [-0.12, 0.3], [-0.03, 0.22]], 0.8);                  // mid-back / dorsal base
      bl([[0.46, 0.05], [0.42, 0.04], [0.41, 0.18], [0.45, 0.2]], 0.5);                                  // snout
    },
    over(gg) {
      mottle(gg, -0.35, -0.35, 0.5, 0.4, { color: '#5a4620', a: 0.22, scale: 0.3, lo: 0.45, hi: 0.78, seed: 7 + v });
      for (let i = 0; i < 70; i++) {
        const x = -0.28 + rng.next() * 0.74, vv = Math.pow(rng.next(), 1.4) * 0.6;
        const r = 0.0035 + rng.next() * 0.0045;
        spot(gg, x, P.at(x, vv), r, blotch, 0.55, 0.6, r * 0.9);
      }
    },
    shade: { dark: '#2e2210', sheen: 0.32, sheenV: 0.22, sheenW: 0.14, gloss: 0.2, belly: 0.26, bounce: 0.55, rim: 0.32, topLight: 0.14, breakup: 0.5 },
    face(gg) {
      gill(gg, res, { x: 0.25, y0: P.top(0.25) + 0.05, y1: P.bot(0.25) - 0.05, bulge: 0.02, dark: '#4a3418', a: 0.3, shadow: 0.2, plate: 0.1, w: 0.0026 });
      // the beak: two pale tooth plates and a thick lip line
      const my = 0.02 + 0.012 * f;
      soft(gg, 0.005, 'rgba(60,40,20,0.5)', () => { gg.beginPath(); gg.ellipse(0.468, my, 0.028, 0.03, 0, 0, 7); gg.fill(); });
      gg.fillStyle = '#f7f1e6';
      gg.beginPath(); gg.ellipse(0.482, my - 0.008, 0.016, 0.01, 0, 0, 7); gg.fill();
      gg.beginPath(); gg.ellipse(0.482, my + 0.01, 0.016, 0.009, 0, 0, 7); gg.fill();
      mouthLine(gg, res, { tip: [0.5, my], corner: [0.455, my + 0.004], sag: 0.006, dark: '#2a1a0c', a: 0.7, w: 0.0036 });
      spot(gg, 0.44, -0.05 - 0.02 * f, 0.004, '#2a1a0c', 0.6, 0.5);
      eye(gg, 0.33, -0.07 - 0.03 * f, 0.04, { iris: '#6f9a5a', irisDark: '#1e3a22', pupil: 0.56, ring: 'rgba(40,30,10,0.4)', rim: 'rgba(170,220,255,0.45)', socket: 0.3 });
      for (let i = 0; i < 9; i++) {
        const a = rng.next() * 6.28, rr = 0.022 + rng.next() * 0.013;
        spot(gg, 0.33 + Math.cos(a) * rr, -0.07 - 0.03 * f + Math.sin(a) * rr, 0.002, '#9fe0ff', 0.6, 0.5);
      }
      glint(gg, 0.38, -0.11 - 0.03 * f, 0.03, 0.005, 0.28, -0.3);
    },
  });
  spines(g, res, P, f, rng, cols);
}

/** Broad rounded pectoral fan (an animated part). */
export function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.215, 0.012], [0.17, 0.0], [0.1, 0.025], [0.075, 0.07, 1], [0.1, 0.108], [0.17, 0.1], [0.21, 0.06]],
    stops: [[0, rgba('#d9c892', 0.95)], [1, rgba('#f1e8c8', 0.55)]],
    axis: [0.21, 0.04, 0.08, 0.07],
    rays: { n: 13, to: [2, 5], from: [[0.212, 0.02], [0.21, 0.055]], col: '#6a5230', a: 0.4, w: 0.0016, hl: '#ffffff', hla: 0.12 },
    scallop: { from: 2, to: 5, n: 7, depth: 0.003 },
    outline: { col: 'rgba(80,60,30,0.3)', w: 0.0015 },
  });
  erase(g, 0.22, 0.04, 0.02, 0.9, 0.25, 0.028);
}
