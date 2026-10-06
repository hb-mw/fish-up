// Shared cephalopod parts: eyes (paint-time) and live tapered arms with sucker rows (per-frame, allocation-free).
import { TAU, clamp, limbPath, limbEdges, blurred } from './kit.js';

/**
 * Paint a cephalopod eye (sprite paint time). r = eyeball radius.
 * o: { iris, irisDark, pupil: 'slit' (octopus: horizontal bar) | 'round' | 'pinhole', pupilR (0..1), lid (skin colour
 *      for a soft upper lid), ring (socket colour), glint (0..1), sheen (rgba for a coloured tapetum glow) }
 */
export function paintCephEye(g, res, x, y, r, o) {
  // socket: soft dark ring + skin bulge
  if (o.ring) {
    blurred(g, res, r * 0.18, () => {
      g.fillStyle = o.ring;
      g.beginPath();
      g.ellipse(x, y, r * 1.32, r * 1.22, 0, 0, TAU);
      g.fill();
    });
  }
  const ir = g.createRadialGradient(x - r * 0.25, y - r * 0.35, r * 0.05, x, y, r);
  ir.addColorStop(0, o.irisLight || o.iris);
  ir.addColorStop(0.55, o.iris);
  ir.addColorStop(1, o.irisDark || '#1a120a');
  g.fillStyle = ir;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  // iris striations
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = r * 0.04;
  g.beginPath();
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    g.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45);
    g.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
  }
  g.stroke();
  const pr = r * (o.pupilR || 0.5);
  g.fillStyle = '#040406';
  g.beginPath();
  if (o.pupil === 'slit') {
    // horizontal rectangular pupil with rounded ends (octopus)
    const w = pr * 1.25, h = pr * 0.38;
    g.moveTo(x - w, y - h);
    g.lineTo(x + w, y - h);
    g.quadraticCurveTo(x + w * 1.18, y, x + w, y + h);
    g.lineTo(x - w, y + h);
    g.quadraticCurveTo(x - w * 1.18, y, x - w, y - h);
  } else if (o.pupil === 'pinhole') {
    g.arc(x, y, pr * 0.35, 0, TAU);
  } else {
    g.arc(x, y, pr, 0, TAU);
  }
  g.fill();
  if (o.sheen) {
    blurred(g, res, r * 0.15, () => {
      g.fillStyle = o.sheen;
      g.beginPath();
      g.ellipse(x + r * 0.1, y + r * 0.3, r * 0.55, r * 0.3, 0, 0, TAU);
      g.fill();
    });
  }
  // wet glints
  const gl = o.glint === undefined ? 1 : o.glint;
  if (gl > 0) {
    g.fillStyle = `rgba(255,255,255,${0.92 * gl})`;
    g.beginPath();
    g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.24, r * 0.17, -0.5, 0, TAU);
    g.fill();
    g.fillStyle = `rgba(255,255,255,${0.4 * gl})`;
    g.beginPath();
    g.arc(x + r * 0.34, y + r * 0.3, r * 0.09, 0, TAU);
    g.fill();
  }
  // soft upper lid of skin
  if (o.lid) {
    g.fillStyle = o.lid;
    g.beginPath();
    g.ellipse(x, y - r * 0.82, r * 1.2, r * 0.5, 0, 0, TAU);
    g.fill();
  }
}

// ── live arms ───────────────────────────────────────────────────────────────
export const AXs = new Float32Array(40), AYs = new Float32Array(40);
const BEND = new Float32Array(40);

/**
 * Build an arm chain into AXs/AYs (local px). base (x0, y0) local px, heading a0, total length L (local px),
 * n points. bendFn(i, u) → turn at joint i (u = i/(n-1)); stored in a scratch array, so pass a module-level fn.
 */
export function armChain(n, x0, y0, a0, L, bendAt, ctxObj) {
  const seg = L / (n - 1);
  let a = a0, x = x0, y = y0;
  AXs[0] = x;
  AYs[0] = y;
  for (let i = 1; i < n; i++) {
    a += bendAt(i, i / (n - 1), ctxObj);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    AXs[i] = x;
    AYs[i] = y;
  }
  void BEND;
}

/** Fill the current arm (AXs/AYs) as a tapered limb in `fill`, with an optional highlight stroke along its top. */
export function fillArm(ctx, n, w0, w1, fill, hi, hiW) {
  ctx.beginPath();
  limbPath(ctx, AXs, AYs, n, w0, w1, 0.9);
  ctx.fillStyle = fill;
  ctx.fill();
  if (hi) {
    const { LX, LY } = limbEdges;
    ctx.beginPath();
    ctx.moveTo((LX[1] + AXs[1]) * 0.5, (LY[1] + AYs[1]) * 0.5);
    for (let i = 2; i < n - 2; i++) ctx.lineTo(LX[i] * 0.6 + AXs[i] * 0.4, LY[i] * 0.6 + AYs[i] * 0.4);
    ctx.strokeStyle = hi;
    ctx.lineWidth = hiW;
    ctx.stroke();
  }
}

/**
 * Append sucker discs along one edge of the last limb (side: 1 = right/RX edge, −1 = left/LX edge) to the current
 * path. Two rows when `rows` = 2. Radius follows the local arm width. Call between beginPath() and fill().
 */
export function suckers(ctx, n, w0, w1, side, rows, from = 1) {
  const { LX, LY, RX, RY } = limbEdges;
  const EX = side > 0 ? RX : LX, EY = side > 0 ? RY : LY;
  for (let i = from; i < n - 1; i++) {
    const u = i / (n - 1);
    const w = w0 + (w1 - w0) * Math.pow(u, 0.9);
    const r = clamp(w * (rows === 2 ? 0.12 : 0.16), 0.3, 1e9);
    for (let k = 0; k < rows; k++) {
      const inset = rows === 2 ? (k ? 0.36 : 0.14) : 0.2;
      const t = (i + (k ? 0.5 : 0)) / 1;
      const j = Math.min(n - 1, Math.floor(t)), f = t - j;
      const j1 = Math.min(n - 1, j + 1);
      const ex = EX[j] + (EX[j1] - EX[j]) * f, ey = EY[j] + (EY[j1] - EY[j]) * f;
      const cx = AXs[j] + (AXs[j1] - AXs[j]) * f, cy = AYs[j] + (AYs[j1] - AYs[j]) * f;
      const x = ex + (cx - ex) * inset, y = ey + (cy - ey) * inset;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
}
