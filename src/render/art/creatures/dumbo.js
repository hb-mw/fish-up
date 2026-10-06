// Dumbo octopus (Grimpoteuthis) — side view, travelling +X; len = total length.
// Gelatinous bell-shaped body (cached sprite) with two ear-like fins (cached sprite, flapping about their base),
// over a live webbed "umbrella" of short arms that pulses like a medusa. Soft pink-peach, big dark eyes.
import { TAU, clamp, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, blurred, speckle, cachedGrad } from './kit.js';
import { paintCephEye } from './cephkit.js';

const BODY = { x0: -0.24, x1: 0.31, y0: -0.47, y1: 0.03 };
const FIN = { x0: -0.02, x1: 0.24, y0: -0.08, y1: 0.08 };
const PAL = palette({
  rib: ['#d06e6a', 0.75],
  ribFar: ['#b85c5c', 0.6],
  cirri: ['#fff0ea', 0.7],
  edge: ['#ffe2d8', 0.8],
});

function bodyPath(g) {
  g.beginPath();
  g.moveTo(-0.17, -0.03);
  g.bezierCurveTo(-0.24, -0.2, -0.16, -0.42, 0.03, -0.43);
  g.bezierCurveTo(0.2, -0.43, 0.3, -0.27, 0.27, -0.1);
  g.bezierCurveTo(0.26, -0.03, 0.22, 0.0, 0.18, 0.0);
  g.quadraticCurveTo(0.0, 0.03, -0.17, -0.03);
  g.closePath();
}

function paintBody(g, res) {
  const rng = createRng(606);
  bodyPath(g);
  const gr = g.createRadialGradient(0.0, -0.36, 0.02, 0.03, -0.2, 0.32);
  gr.addColorStop(0, '#ffe6dc');
  gr.addColorStop(0.45, '#f7b0a0');
  gr.addColorStop(0.85, '#e07e74');
  gr.addColorStop(1, '#c4625e');
  g.fillStyle = gr;
  g.fill();
  g.save();
  bodyPath(g);
  g.clip();
  speckle(g, rng, -0.22, -0.44, 0.3, 0.0, 120, 0.002, 0.007, ['rgba(255,255,255,0.35)', 'rgba(170,70,70,0.18)']);
  // gelatinous rim (light passing through the thin edge)
  blurred(g, res, 0.014, () => {
    bodyPath(g);
    g.strokeStyle = 'rgba(255,214,204,0.55)';
    g.lineWidth = 0.04;
    g.stroke();
  });
  blurred(g, res, 0.016, () => {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.ellipse(-0.02, -0.37, 0.1, 0.035, -0.25, 0, TAU);
    g.fill();
  });
  g.restore();
  // big soulful eye
  paintCephEye(g, res, 0.15, -0.13, 0.058, {
    iris: '#3a2a3a', irisLight: '#7a6070', irisDark: '#0c080c', pupil: 'round', pupilR: 0.62,
    ring: 'rgba(160,70,72,0.45)', sheen: 'rgba(140,170,220,0.35)', lid: 'rgba(240,150,140,0.55)',
  });
}

function paintFin(g, res) {
  const path = () => {
    g.beginPath();
    g.moveTo(0, -0.03);
    g.bezierCurveTo(0.08, -0.075, 0.2, -0.07, 0.225, 0.0);
    g.bezierCurveTo(0.2, 0.07, 0.08, 0.06, 0, 0.03);
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, 0, 0.23, 0);
  gr.addColorStop(0, 'rgba(236,132,120,0.95)');
  gr.addColorStop(0.7, 'rgba(250,176,160,0.85)');
  gr.addColorStop(1, 'rgba(255,214,200,0.7)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(190,90,90,0.35)';
  g.lineWidth = 0.004;
  g.beginPath();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(0.01, k * 0.008);
    g.quadraticCurveTo(0.1, k * 0.02, 0.2, k * 0.022);
  }
  g.stroke();
  g.strokeStyle = 'rgba(255,230,220,0.6)';
  g.lineWidth = 0.005;
  path();
  g.stroke();
}

const TX = new Float32Array(8), TY = new Float32Array(8);
// arm tips around the umbrella rim (unit space, relaxed), back → front
const TIPS = [[-0.33, 0.22], [-0.24, 0.3], [-0.13, 0.34], [-0.02, 0.36], [0.09, 0.35], [0.19, 0.31], [0.27, 0.24], [0.31, 0.14]];

function skirt(ctx, len, anim, mode, P, h, card) {
  const ph = anim.phase, t = anim.t;
  // medusoid pulse: the umbrella closes (contraction) and opens again; tips lag the bell
  const c = Math.pow(0.5 + 0.5 * Math.sin(ph), 1.6);
  const spread = 1.08 - 0.2 * c + h * 0.15 * Math.sin(t * 7);
  const drop = 1 - 0.1 * c;
  for (let i = 0; i < 8; i++) {
    const lag = Math.sin(ph - 0.9 - i * 0.12) * 0.02;
    TX[i] = (0.0 + (TIPS[i][0] - 0.0) * spread + lag) * len;
    TY[i] = (-0.04 + (TIPS[i][1] + 0.04) * drop + Math.sin(t * 1.4 + i) * 0.008) * len;
  }
  const g = cachedGrad('dumbo_web', mode, (s, m) => {
    const gr = s.createLinearGradient(0, -0.05, 0, 0.36);
    if (m === 2) {
      gr.addColorStop(0, '#0f1c2b');
      gr.addColorStop(1, 'rgba(15,28,43,0.85)');
    } else if (m === 1) {
      gr.addColorStop(0, 'rgba(226,170,60,0.95)');
      gr.addColorStop(1, 'rgba(255,230,150,0.7)');
    } else {
      gr.addColorStop(0, 'rgba(232,128,118,0.96)');
      gr.addColorStop(0.6, 'rgba(244,160,146,0.86)');
      gr.addColorStop(1, 'rgba(255,200,186,0.7)');
    }
    return gr;
  });
  // the web: base around the head, scalloped rim between the arm tips
  ctx.save();
  ctx.scale(len, len);
  const il = 1 / len;
  ctx.beginPath();
  ctx.moveTo(-0.17, -0.05);
  ctx.quadraticCurveTo(-0.27, 0.06, TX[0] * il, TY[0] * il);
  for (let i = 1; i < 8; i++) {
    const mx = (TX[i - 1] + TX[i]) * 0.5 * il, my = (TY[i - 1] + TY[i]) * 0.5 * il;
    ctx.quadraticCurveTo(mx * 0.86, my * 0.86 - 0.01, TX[i] * il, TY[i] * il);
  }
  ctx.quadraticCurveTo(0.3, 0.02, 0.2, -0.03);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // arm ribs inside the web + curling tips beyond it
  ctx.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = pass; i < 8; i += 2) {
      const bx = (-0.1 + i * 0.04) * len, by = -0.02 * len;
      const cx = TX[i] * 0.55 + bx * 0.45, cy = TY[i] * 0.6 + by * 0.4 + 0.02 * len;
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(cx, cy, TX[i], TY[i]);
      const curl = Math.sin(t * 1.1 + i * 1.3) * 0.5 + (i < 4 ? -0.6 : 0.6);
      const a = Math.atan2(TY[i] - cy, TX[i] - cx) + curl;
      ctx.quadraticCurveTo(TX[i] + Math.cos(a - curl * 0.5) * 0.03 * len, TY[i] + Math.sin(a - curl * 0.5) * 0.03 * len, TX[i] + Math.cos(a) * 0.05 * len, TY[i] + Math.sin(a) * 0.05 * len);
    }
    ctx.strokeStyle = pass ? P.rib : P.ribFar;
    ctx.lineWidth = (pass ? 0.018 : 0.014) * len;
    ctx.stroke();
  }
  if (card && mode !== 2) {
    // rows of fine cirri along the arms
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      for (let k = 2; k < 7; k++) {
        const u = k / 8;
        const x = (-0.1 + i * 0.04) * len * (1 - u) + TX[i] * u, y = -0.02 * len * (1 - u) + TY[i] * u;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.012 * len, y + 0.012 * len);
      }
    }
    ctx.strokeStyle = P.cirri;
    ctx.lineWidth = 0.004 * len;
    ctx.stroke();
  }
}

function fin(ctx, len, spr, x, y, ang) {
  ctx.save();
  ctx.translate(x * len, y * len);
  ctx.rotate(ang);
  drawUnitSprite(ctx, spr, len);
  ctx.restore();
}

export const DRAWERS = {
  dumbo_octopus: {
    bounds: { x0: -0.45, x1: 0.42, y0: -0.62, y1: 0.43 },
    mouth: { x: 0.04, y: 0.12 },
    draw(ctx, len, anim, opts) {
      const mode = modeOf(opts);
      const P = PAL[mode];
      const lenPx = len * (opts.pxScale || 1);
      const body = variant(unitSprite('du_body', BODY, lenPx, paintBody), opts);
      const finS = variant(unitSprite('du_fin', FIN, lenPx, paintFin), opts, true);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const h = easePose(anim, 0, hooked ? 1 : 0, 4);
      const amp = clamp(anim.amp, 0.2, 1.5);
      // ears flap in a slow rowing stroke (twice per bell pulse when in a hurry)
      const flap = Math.sin(anim.phase * (amp > 0.8 ? 2 : 1) + 0.6) * (0.45 + 0.25 * amp) + h * Math.sin(anim.t * 9) * 0.4;
      const tilt = -0.1 * Math.min(1, amp) + 0.04 * Math.sin(anim.t * 0.7 + anim.seed * 6);
      const bob = Math.sin(anim.phase) * 0.015 * len;
      ctx.save();
      ctx.translate(0, bob);
      ctx.rotate(tilt);
      fin(ctx, len, finS, 0.02, -0.38, -2.45 + flap * 0.8);
      skirt(ctx, len, anim, mode, P, h, opts.detail === 'card');
      drawUnitSprite(ctx, body, len);
      fin(ctx, len, finS, -0.06, -0.33, -2.75 + flap);
      ctx.restore();
    },
  },
};
