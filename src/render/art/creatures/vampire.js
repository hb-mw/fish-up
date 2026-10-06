// Vampire squid (Vampyroteuthis infernalis) — side view, mantle-first (+X); len = total length.
// Body (mantle, head, huge pale-blue eye) and ear-like fins are cached sprites; the webbed cloak of eight arms is
// live: it trails like a cape, and when hooked it flips inside-out over the body ("pineapple" posture), exposing
// the pale fleshy spines. Glow: blue-white photophores at the arm tips and behind the fins.
import { TAU, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, blurred, speckle, glowK, glowDot, glow, limbPath } from './kit.js';
import { paintCephEye } from './cephkit.js';

const BODY = { x0: -0.1, x1: 0.42, y0: -0.18, y1: 0.15 };
const FIN = { x0: -0.01, x1: 0.13, y0: -0.05, y1: 0.05 };
const PAL = palette({
  web: ['#5a1222', 0.92],
  webIn: '#14030a',
  arm: '#4a0e1a',
  armIn: '#1e050c',
  spine: ['#e6c2c8', 0.85],
});
const SP = [-0.95, -0.66, -0.38, -0.13, 0.13, 0.38, 0.66, 0.95];
const N = 9;
const XS = new Float32Array(N), YS = new Float32Array(N);
const EX = new Float32Array(8), EY = new Float32Array(8), TX = new Float32Array(8), TY = new Float32Array(8);

function bodyPath(g) {
  g.beginPath();
  g.moveTo(-0.07, 0.0);
  g.bezierCurveTo(-0.07, -0.1, 0.02, -0.13, 0.12, -0.12);
  g.bezierCurveTo(0.28, -0.11, 0.38, -0.06, 0.4, 0.0);
  g.bezierCurveTo(0.38, 0.07, 0.27, 0.12, 0.12, 0.12);
  g.bezierCurveTo(0.02, 0.12, -0.07, 0.09, -0.07, 0.0);
  g.closePath();
}

function paintBody(g, res) {
  const rng = createRng(13);
  bodyPath(g);
  const gr = g.createRadialGradient(0.18, -0.08, 0.01, 0.16, 0.0, 0.26);
  gr.addColorStop(0, '#7e2232');
  gr.addColorStop(0.45, '#4e0e1c');
  gr.addColorStop(1, '#1c0408');
  g.fillStyle = gr;
  g.fill();
  g.save();
  bodyPath(g);
  g.clip();
  speckle(g, rng, -0.08, -0.14, 0.42, 0.14, 160, 0.002, 0.006, ['rgba(20,0,4,0.35)', 'rgba(200,90,110,0.18)']);
  blurred(g, res, 0.012, () => {
    g.fillStyle = 'rgba(255,190,200,0.28)';
    g.beginPath();
    g.ellipse(0.2, -0.085, 0.14, 0.022, 0.05, 0, TAU);
    g.fill();
  });
  g.restore();
  // the huge eye (proportionally the largest of any animal)
  paintCephEye(g, res, 0.02, -0.02, 0.062, {
    iris: '#7cc8f0', irisLight: '#d4f2ff', irisDark: '#1a4a6a', pupil: 'round', pupilR: 0.5,
    ring: 'rgba(10,0,4,0.7)', sheen: 'rgba(160,230,255,0.25)',
  });
}

function paintFin(g) {
  g.beginPath();
  g.moveTo(0, -0.025);
  g.bezierCurveTo(0.05, -0.05, 0.12, -0.04, 0.125, 0.0);
  g.bezierCurveTo(0.12, 0.04, 0.05, 0.05, 0, 0.025);
  g.closePath();
  const gr = g.createLinearGradient(0, 0, 0.125, 0);
  gr.addColorStop(0, '#5a1222');
  gr.addColorStop(1, 'rgba(150,50,70,0.85)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(230,140,160,0.35)';
  g.lineWidth = 0.004;
  g.stroke();
}

/** Solve the 8 arm chains for cloak openness and pineapple blend p; fills EX/EY (web rim) and TX/TY (tips). */
function solveArm(i, len, anim, p, out) {
  const t = anim.t, ph = anim.phase;
  const s = SP[i];
  const L = 0.5 * len, seg = L / (N - 1);
  let x = -0.05 * len, y = s * 0.02 * len, a = 0;
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1);
    const open = 0.82 + 0.16 * Math.sin(ph * 0.5 + 1);
    const hn = Math.PI + s * open * (1 - 0.45 * u) + 0.14 * Math.sin(ph - u * 3 + i) * u;
    // pineapple: arms flare, then turn hard and run forward over the mantle (cloak pulled inside-out)
    const turn = Math.min(1, u / 0.32);
    const hp = Math.PI + s * 1.1 - Math.sign(s) * (Math.PI * 1.12 + Math.abs(s) * 0.25) * turn * turn * (3 - 2 * turn) + 0.08 * Math.sin(t * 6 + i) * u;
    a = hn + (hp - hn) * p;
    XS[k] = x;
    YS[k] = y;
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg * (1 - 0.25 * p);
  }
  void out;
  const j = 7;
  EX[i] = XS[j];
  EY[i] = YS[j];
  TX[i] = XS[N - 1];
  TY[i] = YS[N - 1];
}

function cloak(ctx, len, anim, p, P, card) {
  // web rim first (needs every arm), then the web, then the arms with their spines
  for (let i = 0; i < 8; i++) solveArm(i, len, anim, p);
  ctx.beginPath();
  ctx.moveTo(-0.05 * len, -0.06 * len);
  ctx.lineTo(EX[0], EY[0]);
  for (let i = 1; i < 8; i++) {
    const mx = (EX[i - 1] + EX[i]) * 0.5, my = (EY[i - 1] + EY[i]) * 0.5;
    ctx.quadraticCurveTo(mx * 0.85 - 0.01 * len, my * 0.85, EX[i], EY[i]);
  }
  ctx.lineTo(-0.05 * len, 0.06 * len);
  ctx.closePath();
  ctx.fillStyle = p > 0.5 ? P.webIn : P.web;
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    solveArm(i, len, anim, p);
    ctx.beginPath();
    limbPath(ctx, XS, YS, N, 0.04 * len, 0.008 * len, 1);
    ctx.fillStyle = p > 0.5 ? P.armIn : P.arm;
    ctx.fill();
    if (p > 0.3) {
      // fleshy cirri ("spines") along the oral side, exposed when the cloak turns inside-out
      ctx.beginPath();
      for (let k = 2; k < N - 1; k++) {
        const nx = -(YS[k + 1] - YS[k - 1]), ny = XS[k + 1] - XS[k - 1];
        const d = Math.hypot(nx, ny) || 1, sg = SP[i] > 0 ? 1 : -1;
        ctx.moveTo(XS[k], YS[k]);
        ctx.lineTo(XS[k] + (nx / d) * 0.035 * len * sg, YS[k] + (ny / d) * 0.035 * len * sg);
      }
      ctx.strokeStyle = P.spine;
      ctx.lineWidth = Math.max(0.6, 0.007 * len);
      ctx.stroke();
    }
  }
}

function fins(ctx, len, spr, flap) {
  for (const [x, y, a] of [[0.3, -0.07, -2.2 + flap], [0.29, -0.08, -1.7 - flap * 0.6]]) {
    ctx.save();
    ctx.translate(x * len, y * len);
    ctx.rotate(a);
    drawUnitSprite(ctx, spr, len);
    ctx.restore();
  }
}

export const DRAWERS = {
  vampire_squid: {
    bounds: { x0: -0.58, x1: 0.46, y0: -0.36, y1: 0.36 },
    mouth: { x: -0.08, y: 0.0 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const body = variant(unitSprite('vs_body', BODY, lenPx, paintBody), opts);
      const fin = variant(unitSprite('vs_fin', FIN, lenPx, paintFin), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const p = easePose(anim, 0, hooked ? 1 : 0, 3);
      const flap = Math.sin(anim.phase * 1.4) * 0.45 * (1 - 0.6 * p);
      ctx.save();
      ctx.lineCap = 'round';
      if (p < 0.5) {
        fins(ctx, len, fin, flap);
        cloak(ctx, len, anim, p, P, opts.detail === 'card');
        drawUnitSprite(ctx, body, len);
      } else {
        fins(ctx, len, fin, flap);
        drawUnitSprite(ctx, body, len);
        cloak(ctx, len, anim, p, P, opts.detail === 'card');
      }
      ctx.restore();
    },
    drawGlow(ctx, len, anim, opts) {
      const k = glowK(opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const p = easePose(anim, 0, hooked ? 1 : 0, 3);
      const dot = glowDot('#59c8ff', 0.9);
      const a0 = ctx.globalAlpha;
      for (let i = 0; i < 8; i++) {
        solveArm(i, len, anim, p);
        const tw = 0.6 + 0.4 * Math.sin(anim.t * 2.6 + i * 1.9 + anim.seed * 7);
        ctx.globalAlpha = a0 * k * tw * 0.9;
        glow(ctx, dot, TX[i], TY[i], len * 0.06);
      }
      // the pair of large photophores behind the fins
      ctx.globalAlpha = a0 * k * (0.6 + 0.3 * Math.sin(anim.t * 1.3));
      glow(ctx, dot, 0.3 * len, -0.04 * len, len * 0.07);
      // when threatened it squirts a cloud of glowing blue mucus
      if (p > 0.05) {
        ctx.globalAlpha = a0 * k * p * (0.35 + 0.15 * Math.sin(anim.t * 3));
        glow(ctx, glowDot('#59c8ff'), -0.25 * len, 0, len * 0.55, len * 0.38);
      }
      ctx.globalAlpha = a0;
    },
  },
};
