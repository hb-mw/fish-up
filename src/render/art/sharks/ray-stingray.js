// Blue-spotted ribbontail ray (Taeniura lymma), seen 3/4 from above: a golden-olive oval disc studded with
// electric-blue spots, bulging eyes + spiracles, a thick tail with blue side stripes and a ribbon finfold.
// Motion: the disc is cut into vertical strips; each strip's far and near halves are scaled about the midline
// by a wave travelling back along the margins (rajiform undulation); the tail sways with sheared strips.
import { unitSprite, variantFor, paintEye } from '../common.js';
import { TAU, clamp, spline, soft, softStroke, clipTo, texture, rngFor, variantOf, lod, pxsOf } from './kit.js';
import { rayMotion } from './ray-motion.js';

// projected outline (unit space, x forward, y down on screen); the near half is a touch fuller (disc thickness)
const FAR = [[0.5, 0], [0.49, -0.03], [0.465, -0.072], [0.425, -0.111], [0.37, -0.142], [0.3, -0.157], [0.228, -0.155], [0.165, -0.137], [0.118, -0.104], [0.09, -0.058], [0.08, -0.018]];
const NEAR = FAR.map(([x, y], i) => [x, i === 0 ? 0.002 : -y * 1.075 + 0.004]);
const TOP_NEAR = FAR.map(([x, y]) => [x, -y]);
export const STINGRAY_BOX = { x0: -0.515, x1: 0.515, y0: -0.2, y1: 0.215 };
const XD0 = 0.07; // disc strips cover x ≥ XD0, tail strips the rest

function discPath(q, top = false) {
  spline(q, FAR, true);
  q.lineTo(0.074, 0);
  spline(q, (top ? TOP_NEAR : NEAR).slice().reverse(), false);
  q.closePath();
}
const tailW = (x) => 0.0018 + 0.0145 * Math.pow(clamp((x + 0.5) / 0.62, 0, 1), 1.15);
function tailPath(q) {
  q.moveTo(0.13, -0.017);
  for (let x = 0.12; x >= -0.5; x -= 0.02) q.lineTo(x, -tailW(x));
  q.lineTo(-0.505, 0);
  for (let x = -0.5; x <= 0.12; x += 0.02) q.lineTo(x, tailW(x) * 1.15);
  q.lineTo(0.13, 0.019);
  q.closePath();
}
function foldPath(q) {
  // ventral finfold: a deep ribbon under the rear two-thirds of the tail
  q.moveTo(-0.08, 0.008);
  for (let x = -0.08; x >= -0.49; x -= 0.015) {
    const k = (-0.08 - x) / 0.41;
    q.lineTo(x, tailW(x) + 0.026 * Math.sin(Math.PI * Math.pow(k, 0.8)));
  }
  q.lineTo(-0.495, 0.001);
  q.lineTo(-0.08, 0.002);
  q.closePath();
}

function blueSpot(g, res, x, y, r) {
  soft(g, res, r * 0.25, 'rgba(8,40,90,0.75)', (q) => q.ellipse(x, y, r * 1.18, r * 0.98, 0, 0, TAU));
  const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r);
  gr.addColorStop(0, '#c4f1ff');
  gr.addColorStop(0.35, '#3fb7ff');
  gr.addColorStop(0.8, '#1584f0');
  gr.addColorStop(1, '#0d5fc0');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.82, 0, 0, TAU);
  g.fill();
}

function paintStingray(g, res, v) {
  const L = lod(res);
  const r = rngFor('stingray' + v);
  // tail: finfold, body, stripes, spine
  const fold = g.createLinearGradient(0, 0, 0, 0.04);
  fold.addColorStop(0, '#6f5a33');
  fold.addColorStop(1, 'rgba(92,96,110,0.55)');
  g.fillStyle = fold;
  g.beginPath();
  foldPath(g);
  g.fill();
  softStroke(g, res, 0.002, 'rgba(40,120,220,0.45)', 0.002, (q) => {
    for (let x = -0.1; x >= -0.48; x -= 0.015) q.lineTo(x, tailW(x) + 0.026 * Math.sin(Math.PI * Math.pow((-0.08 - x) / 0.41, 0.8)) - 0.002);
  });
  clipTo(g, tailPath, () => {
    const tg = g.createLinearGradient(0, -0.02, 0, 0.02);
    tg.addColorStop(0, '#c3a65f');
    tg.addColorStop(0.5, '#9a7c3c');
    tg.addColorStop(1, '#6e5426');
    g.fillStyle = tg;
    g.fillRect(-0.52, -0.03, 0.66, 0.06);
    for (const [k, w] of [[-0.42, 0.0034], [0.5, 0.0036]]) {
      softStroke(g, res, 0.0008, '#1f8cf0', w, (q) => {
        q.moveTo(0.1, tailW(0.1) * k);
        for (let x = 0.08; x >= -0.46; x -= 0.02) q.lineTo(x, tailW(x) * k);
      });
    }
    texture(g, 'mottle', 0.2, 0.15, { x0: -0.52, y0: -0.03, x1: 0.14, y1: 0.03 });
  });
  if (L >= 1) {
    // the venomous spine near the tail base
    g.fillStyle = '#e8dcc0';
    g.beginPath();
    g.moveTo(-0.02, -tailW(-0.02) + 0.001);
    g.lineTo(-0.085, -tailW(-0.085) - 0.004);
    g.lineTo(-0.03, -tailW(-0.03) + 0.003);
    g.closePath();
    g.fill();
  }
  // pelvic fins peeking out behind the disc
  for (const s of [-1, 1]) {
    // pelvic fins: only their rounded rear tips show behind the disc
    g.fillStyle = s < 0 ? '#8a6c34' : '#7a5f2c';
    g.beginPath();
    g.ellipse(0.088, s * 0.03, 0.022, 0.016, s * 0.35, 0, TAU);
    g.fill();
  }
  // disc: the near rim (thickness / pale underside), then the domed top surface
  clipTo(g, (q) => discPath(q), () => {
    g.fillStyle = '#e9dfc6';
    g.fillRect(0, -0.2, 0.52, 0.42);
    soft(g, res, 0.004, 'rgba(120,100,70,0.6)', (q) => discPath(q, false));
    clipTo(g, (q) => discPath(q, true), () => {
      const dg = g.createRadialGradient(0.31, -0.03, 0.01, 0.29, 0, 0.24);
      dg.addColorStop(0, '#c9ab63');
      dg.addColorStop(0.55, '#ae8e4a');
      dg.addColorStop(0.85, '#94763a');
      dg.addColorStop(1, '#755b2a');
      g.fillStyle = dg;
      g.fillRect(0, -0.2, 0.52, 0.42);
      // light from above: the dome's crown is lit, the far margin catches a rim, the near slope shades
      soft(g, res, 0.045, 'rgba(255,238,185,0.38)', (q) => q.ellipse(0.31, -0.04, 0.11, 0.055, 0, 0, TAU));
      soft(g, res, 0.03, 'rgba(60,40,10,0.3)', (q) => q.ellipse(0.13, 0, 0.05, 0.14, 0, 0, TAU));
      soft(g, res, 0.03, 'rgba(60,40,10,0.34)', (q) => q.ellipse(0.29, 0.14, 0.21, 0.05, 0, 0, TAU));
      texture(g, 'mottle', 0.25, 0.25, { x0: 0, y0: -0.2, x1: 0.52, y1: 0.2 });
      // electric-blue spots, larger toward the centre, none on the eyes
      const n = L >= 1 ? 54 : 30;
      const big = L >= 1 ? 1 : 1.45; // small renders: fewer, bolder spots so the pattern still reads
      const placed = [];
      for (let tries = 0; placed.length < n && tries < 2000; tries++) {
        const x = 0.1 + r.next() * 0.4, y = (r.next() - 0.5) * 0.31;
        const ex = (x - 0.3) / 0.205, ey = y / 0.15;
        const d = Math.sqrt(ex * ex + ey * ey);
        if (d > 0.93) continue;
        if (Math.abs(x - 0.37) < 0.05 && Math.abs(y) < 0.06) continue;
        const rr = (0.0042 + r.next() * 0.006) * (1.2 - 0.55 * d) * big;
        if (placed.some(([px, py, pr]) => Math.hypot(px - x, (py - y) * 1.2) < (pr + rr) * 1.9)) continue;
        placed.push([x, y, rr]);
        blueSpot(g, res, x, y, rr);
      }
      // wet sheen
      soft(g, res, 0.02, 'rgba(255,255,255,0.16)', (q) => q.ellipse(0.33, -0.07, 0.1, 0.022, -0.12, 0, TAU));
      // blue margin band (T. lymma's disc edge is often edged in blue)
      softStroke(g, res, 0.004, 'rgba(40,140,240,0.35)', 0.008, (q) => spline(q, FAR, true));
    });
  });
  // eyes on bulging turrets, spiracles behind them
  for (const [y, k] of [[-0.036, 0.9], [0.03, 1]]) {
    const ex = 0.388, ey = y - 0.008;
    soft(g, res, 0.006, 'rgba(70,50,20,0.5)', (q) => q.ellipse(ex - 0.004, ey + 0.007, 0.021 * k, 0.014 * k, 0, 0, TAU));
    g.fillStyle = '#b8984f';
    g.beginPath();
    g.ellipse(ex, ey + 0.002, 0.018 * k, 0.013 * k, 0, 0, TAU);
    g.fill();
    paintEye(g, ex + 0.002, ey, 0.0118 * k, { iris: '#e0b84e', irisDark: '#5e3f0c', pupil: 0.42, look: { x: 0.5, y: 0 } });
    soft(g, res, 0.002, 'rgba(25,18,10,0.8)', (q) => q.ellipse(ex - 0.036, ey + 0.004, 0.012 * k, 0.007 * k, 0.1, 0, TAU));
    softStroke(g, res, 0.0015, 'rgba(240,225,180,0.5)', 0.0018, (q) => q.ellipse(ex - 0.036, ey + 0.004, 0.013 * k, 0.008 * k, 0.1, Math.PI, TAU));
  }
}

/** Shared strip renderer: disc halves scaled by a travelling margin wave, tail strips sheared by a sway. */
function drawRay(ctx, s, len, ph, A, tailA, pxs) {
  const res = s.res, pad = s.pad, b = s.box, sc = len / res;
  const cw = s.canvas.width, chh = s.canvas.height;
  const uLeft = b.x0 - pad / res;
  const rowMid = (0 - b.y0) * res + pad;
  const hFar = rowMid * sc, hNear = (chh - rowMid) * sc;
  const ov = 1 / Math.max(0.05, pxs);
  // tail: sheared strips from the tip to the disc
  const nt = clamp(Math.round(((XD0 - uLeft) * len * pxs) / 12), 4, 18);
  const stepT = (XD0 - uLeft) / nt;
  let dyR = 0;
  for (let i = 0; i < nt; i++) {
    const xR = XD0 - stepT * i, xL = xR - stepT;
    const k = (XD0 - xL) / (XD0 + 0.5);
    const dyL = Math.sin(ph * 0.8 - k * 4.2) * Math.pow(Math.min(k, 1.1), 1.4) * tailA * len;
    const sl = (dyR - dyL) / (stepT * len);
    const c = dyL - sl * xL * len;
    ctx.transform(1, sl, 0, 1, 0, c);
    ctx.drawImage(s.canvas, (xL - uLeft) * res, 0, stepT * res + 1, chh, xL * len, b.y0 * len - pad * sc, stepT * len + ov, chh * sc);
    ctx.transform(1, -sl, 0, 1, 0, -c);
    dyR = dyL;
  }
  // disc: far half above the midline, near half below, scaled by the margin wave
  const x1 = b.x1 + pad / res;
  const nd = clamp(Math.round(((x1 - XD0) * len * pxs) / 5), 6, 56);
  const step = (x1 - XD0) / nd;
  for (let i = 0; i < nd; i++) {
    const xa = XD0 + step * i, xm = xa + step * 0.5;
    const env = clamp((xm - 0.08) / 0.08, 0, 1) * (1 - 0.6 * clamp((xm - 0.42) / 0.08, 0, 1));
    const m = A * Math.sin(ph - (0.5 - xm) * 15.7) * env;
    const sx = (xa - uLeft) * res, sw = step * res + 1;
    const cy = m * 0.012 * len;
    ctx.drawImage(s.canvas, sx, 0, sw, rowMid + 1, xa * len, cy - hFar * (1 + m), step * len + ov, hFar * (1 + m) + sc);
    ctx.drawImage(s.canvas, sx, rowMid, sw, chh - rowMid, xa * len, cy, step * len + ov, hNear * (1 - m));
  }
}

export const stingray = {
  bounds: { x0: -0.505, x1: 0.505, y0: -0.2, y1: 0.215 },
  mouth: { x: 0.43, y: 0.05 },
  draw(ctx, len, anim, opts) {
    const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2400 : 1200);
    const v = variantOf(anim.seed, 3);
    const spr = unitSprite('stingray:' + v, STINGRAY_BOX, lenPx, (g, res) => paintStingray(g, res, v));
    const rest = anim.state === 'idle' || anim.state === 'crawl';
    // ripple phase + hookedness integrated per individual, so resting ↔ gliding ↔ hooked never pops
    const m = rayMotion(anim, rest ? 0.45 : 0.8, 6);
    const hk = m.hk;
    const amp = clamp(anim.amp === undefined ? 0.5 : anim.amp, 0, 1.6);
    let A = rest ? 0.025 : 0.035 + 0.04 * amp;
    if (anim.state === 'icon') A = 0.035;
    A += hk * 0.1;
    const ph = m.ph;
    ctx.save();
    if (hk) ctx.rotate(Math.sin((anim.t || 0) * 8.3 + (anim.uid || 0)) * 0.06 * hk);
    drawRay(ctx, variantFor(spr, opts), len, ph, A, rest ? 0.012 : 0.03 + hk * 0.03, pxsOf(anim, opts));
    ctx.restore();
  },
};
