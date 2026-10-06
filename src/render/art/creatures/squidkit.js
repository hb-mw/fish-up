// Shared squid parts (Humboldt squid, giant squid). Side view, mantle tip at +X, arms trailing toward −X.
// spec = { tip, neck, H (mantle half-height), headX (front of the arm crown), headH, eye: [x, y, r], skin: [light,
//          mid, dark, belly], chroma (dot colour), finX0 (fin base start), finH, seed }
import { TAU, createRng, blurred, limbPath, limbEdges } from './kit.js';
import { paintCephEye, AXs, AYs } from './cephkit.js';

export function mantlePath(g, s) {
  const { tip, neck, H } = s;
  const L = tip - neck;
  g.beginPath();
  g.moveTo(tip, 0);
  g.bezierCurveTo(tip - L * 0.12, -H * 0.5, tip - L * 0.45, -H * 1.02, neck + L * 0.12, -H);
  g.quadraticCurveTo(neck + 0.01, -H * 0.98, neck - 0.005, -H * 0.86);
  // head with the eye bulge
  g.bezierCurveTo(neck - 0.04, -s.headH * 1.15, s.headX + 0.03, -s.headH, s.headX, -s.headH * 0.55);
  g.quadraticCurveTo(s.headX - 0.012, 0, s.headX, s.headH * 0.55);
  g.bezierCurveTo(s.headX + 0.03, s.headH, neck - 0.04, s.headH * 1.1, neck - 0.005, H * 0.86);
  g.quadraticCurveTo(neck + 0.01, H * 0.98, neck + L * 0.12, H);
  g.bezierCurveTo(tip - L * 0.45, H * 1.02, tip - L * 0.12, H * 0.5, tip, 0);
  g.closePath();
}

/** Paint the mantle + head + eye in unit space. pale = 1 paints the white "flash" colouring. */
export function paintSquidBody(g, res, s, pale) {
  const rng = createRng(s.seed);
  const [light, mid, dark, belly] = pale ? s.paleSkin : s.skin;
  mantlePath(g, s);
  const gr = g.createLinearGradient(0, -s.H * 1.05, 0, s.H * 1.05);
  gr.addColorStop(0, dark);
  gr.addColorStop(0.3, mid);
  gr.addColorStop(0.55, light);
  gr.addColorStop(0.8, belly);
  gr.addColorStop(1, mid);
  g.fillStyle = gr;
  g.fill();
  g.save();
  mantlePath(g, s);
  g.clip();
  // soft mottled flushes under the skin, then fine chromatophore specks (dense on the back, sparse on the belly)
  blurred(g, res, 0.008, () => {
    for (let i = 0; i < 40; i++) {
      const x = s.headX + rng.next() * (s.tip - s.headX), v = rng.next() * 1.6 - 1;
      g.fillStyle = pale ? 'rgba(220,150,140,0.12)' : `rgba(${s.chroma},${0.1 + rng.next() * 0.12})`;
      g.beginPath();
      g.ellipse(x, v * s.H, 0.01 + rng.next() * 0.03, 0.006 + rng.next() * 0.012, 0, 0, TAU);
      g.fill();
    }
  });
  const n = Math.round(2600 * (s.tip - s.headX));
  for (let i = 0; i < n; i++) {
    const x = s.headX + rng.next() * (s.tip - s.headX);
    const v = rng.next() * 2 - 1;
    const dens = v < 0 ? 1 : 0.3;
    if (rng.next() > dens) continue;
    const big = rng.next() < 0.06;
    g.fillStyle = pale ? `rgba(200,120,110,${0.08 + rng.next() * 0.12})` : `rgba(${s.chroma},${0.18 + rng.next() * 0.32})`;
    g.beginPath();
    g.arc(x, v * s.H, big ? 0.003 + rng.next() * 0.003 : 0.0012 + rng.next() * 0.0022, 0, TAU);
    g.fill();
  }
  // faint longitudinal muscle texture
  g.strokeStyle = pale ? 'rgba(255,255,255,0.08)' : 'rgba(255,200,190,0.07)';
  g.lineWidth = 0.002;
  for (let k = -4; k <= 4; k++) {
    g.beginPath();
    g.moveTo(s.neck + 0.02, k * s.H * 0.2);
    g.quadraticCurveTo((s.neck + s.tip) / 2, k * s.H * 0.21, s.tip - 0.03, k * s.H * 0.06);
    g.stroke();
  }
  // muscular sheen along the mantle + a darker dorsal stripe
  blurred(g, res, 0.01, () => {
    g.fillStyle = pale ? 'rgba(255,255,255,0.5)' : 'rgba(255,220,210,0.35)';
    g.beginPath();
    g.ellipse((s.tip + s.neck) / 2, -s.H * 0.45, (s.tip - s.neck) * 0.4, s.H * 0.12, 0, 0, TAU);
    g.fill();
    g.strokeStyle = pale ? 'rgba(220,160,150,0.3)' : `rgba(${s.chroma},0.35)`;
    g.lineWidth = s.H * 0.18;
    g.beginPath();
    g.moveTo(s.tip - 0.04, -s.H * 0.18);
    g.quadraticCurveTo((s.tip + s.neck) / 2, -s.H * 0.98, s.neck + 0.02, -s.H * 0.88);
    g.stroke();
  });
  // mantle collar
  g.strokeStyle = 'rgba(40,6,6,0.35)';
  g.lineWidth = 0.004;
  g.beginPath();
  g.moveTo(s.neck + 0.006, -s.H * 0.9);
  g.quadraticCurveTo(s.neck - 0.012, 0, s.neck + 0.006, s.H * 0.9);
  g.stroke();
  g.restore();
  const [ex, ey, er] = s.eye;
  paintCephEye(g, res, ex, ey, er, {
    iris: s.iris || '#c9b98a', irisLight: '#f4ecd0', irisDark: '#3a3020', pupil: 'round', pupilR: 0.56,
    ring: pale ? 'rgba(160,90,80,0.5)' : 'rgba(30,4,4,0.6)', sheen: 'rgba(170,220,255,0.25)',
  });
}

/** Fin pair at the mantle tip (arrowhead silhouette), painted once; drawn with a vertical flap scale. */
export function paintSquidFin(g, res, s, pale) {
  const [light, mid, dark] = pale ? s.paleSkin : s.skin;
  const x0 = s.finX0, tip = s.tip + 0.01, H = s.finH;
  for (const sg of [-1, 1]) {
    g.beginPath();
    g.moveTo(tip, 0);
    g.quadraticCurveTo(tip - 0.02, sg * H * 0.7, x0 + (tip - x0) * 0.42, sg * H);
    g.quadraticCurveTo(x0 + 0.01, sg * H * 0.55, x0, sg * s.H * 0.4);
    g.lineTo(x0, 0);
    g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, sg * H);
    gr.addColorStop(0, sg < 0 ? dark : light);
    gr.addColorStop(0.6, mid);
    gr.addColorStop(1, sg < 0 ? mid : dark);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,220,210,0.25)';
    g.lineWidth = 0.004;
    g.stroke();
  }
}

/**
 * Draw `count` arms from the crown (x0, y0) (local px) trailing toward −X. far → skip highlights.
 * o = { L, w0, spread, wave, hooked, n, fill, hi, sucker }
 */
export function squidArms(ctx, len, anim, o, idx0, count, far) {
  const t = anim.t, ph = anim.phase;
  const n = o.n || 11;
  for (let a = 0; a < count; a++) {
    const i = idx0 + a;
    const s = (i / 7) * 2 - 1; // −1 … 1 across the crown
    const L = o.L * len * (0.86 + 0.14 * Math.cos(i * 1.7));
    const seg = L / (n - 1);
    let x = o.x0 * len, y = (o.y0 + s * o.crownH) * len;
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1);
      const hd = Math.PI - s * o.spread * (1 - 0.5 * u) + o.wave * Math.sin(ph * 0.7 - u * 4.2 + i * 0.9) * u +
        (o.wave2 || 0) * Math.sin(t * 0.55 - u * 7.5 + i * 1.3) * u +
        o.hooked * 0.7 * Math.sin(t * 5 + i * 2.3 - u * 5) * u;
      AXs[k] = x;
      AYs[k] = y;
      x += Math.cos(hd) * seg;
      y += Math.sin(hd) * seg;
    }
    ctx.beginPath();
    limbPath(ctx, AXs, AYs, n, o.w0 * len, 0.003 * len, 0.8);
    ctx.fillStyle = far ? o.fillFar : o.fill;
    ctx.fill();
    if (!far && o.shade) {
      // roundness: a soft darker band along the lower edge of each arm
      const { RX, RY, LX, LY } = limbEdges;
      const EX = s < 0 ? LX : RX, EY = s < 0 ? LY : RY;
      ctx.beginPath();
      ctx.moveTo(EX[1], EY[1]);
      for (let k = 2; k < n - 1; k++) ctx.lineTo(EX[k] * 0.8 + AXs[k] * 0.2, EY[k] * 0.8 + AYs[k] * 0.2);
      ctx.strokeStyle = o.shade;
      ctx.lineWidth = o.w0 * len * 0.3;
      ctx.stroke();
    }
    if (!far && o.sucker) {
      // sucker rows on the inner (oral) side: the edge facing the crown's centre line
      const { LX, LY, RX, RY } = limbEdges;
      const EX = s < 0 ? RX : LX, EY = s < 0 ? RY : LY;
      ctx.beginPath();
      for (let k = 1; k < n - 1; k++) {
        const r = Math.max(0.4, o.w0 * len * 0.11 * (1 - k / n));
        const x2 = EX[k] + (AXs[k] - EX[k]) * 0.3, y2 = EY[k] + (AYs[k] - EY[k]) * 0.3;
        ctx.moveTo(x2 + r, y2);
        ctx.arc(x2, y2, r, 0, TAU);
      }
      ctx.fillStyle = o.sucker;
      ctx.fill();
    }
    if (!far && o.hi) {
      ctx.beginPath();
      ctx.moveTo(AXs[1], AYs[1] - o.w0 * len * 0.25);
      for (let k = 2; k < n - 3; k++) ctx.lineTo(AXs[k], AYs[k] - o.w0 * len * 0.25 * (1 - k / n));
      ctx.strokeStyle = o.hi;
      ctx.lineWidth = o.w0 * len * 0.18;
      ctx.stroke();
    }
  }
}

/** One long feeding tentacle with a club. side −1 upper / +1 lower. */
export function squidTentacle(ctx, len, anim, o, side) {
  const t = anim.t, ph = anim.phase;
  const n = 18;
  const seg = (o.TL * len) / (n - 1);
  let x = o.x0 * len, y = (o.y0 + side * o.crownH * 0.4) * len;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1);
    const hd = Math.PI - side * 0.06 + o.twave * Math.sin(ph * 0.5 - u * 6 + (side > 0 ? 1.8 : 0) + t * 0.4) * u +
      o.hooked * 0.9 * Math.sin(t * 4 + side - u * 7) * u;
    AXs[k] = x;
    AYs[k] = y;
    x += Math.cos(hd) * seg;
    y += Math.sin(hd) * seg;
  }
  ctx.beginPath();
  limbPath(ctx, AXs, AYs, n - 4, o.tw * len, o.tw * len * 0.7, 1);
  ctx.fillStyle = o.tfill;
  ctx.fill();
  // the club: a leaf-shaped, sucker-studded end (widens, then tapers to the tip)
  for (let k = 0; k < 6; k++) {
    CX[k] = AXs[n - 6 + k];
    CY[k] = AYs[n - 6 + k];
  }
  ctx.beginPath();
  limbPath(ctx, CX, CY, 4, o.tw * len * 0.7, o.cw * len, 0.7);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    DX[k] = CX[k + 3];
    DY[k] = CY[k + 3];
  }
  ctx.beginPath();
  limbPath(ctx, DX, DY, 3, o.cw * len, o.tw * len * 0.3, 1.2);
  ctx.fill();
  if (o.sucker) {
    ctx.beginPath();
    for (let k = 2; k < 5; k++) {
      const r = o.cw * len * 0.2 * (1 - Math.abs(k - 3) * 0.25);
      const x2 = CX[k], y2 = CY[k] + side * o.cw * len * 0.1;
      ctx.moveTo(x2 + r, y2);
      ctx.arc(x2, y2, r, 0, TAU);
    }
    ctx.fillStyle = o.sucker;
    ctx.fill();
  }
}
const CX = new Float32Array(6), CY = new Float32Array(6), DX = new Float32Array(3), DY = new Float32Array(3);
