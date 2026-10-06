// Spine model shared by the eels (moray, gulper, oarfish): a travelling wave runs along the body, the strips of
// a straight body sprite are laid along it with arc length preserved and each strip rotated to the local
// tangent. The head is ONE rigid piece riding the neck point, so jaws / eyes / lures attach to a single frame.
import { TAU, clamp } from './kit.js';

const MAXN = 64;

/** Allocate a reusable spine buffer (one per drawer; draw calls are sequential so it is safe to reuse). */
export function makeSpine() {
  return {
    n: 0, xh: 0.3, stepU: 0, len: 0,
    bx: new Float32Array(MAXN + 1), by: new Float32Array(MAXN + 1), // strip boundaries: [0] = neck … [n] = tail end
    cx: new Float32Array(MAXN), cy: new Float32Array(MAXN), ang: new Float32Array(MAXN),
    hx: 0, hy: 0, hang: 0, // head frame (neck point + heading)
  };
}

/**
 * Lay the spine out for this frame.
 *   o: { xh (unit x where the rigid head starts), tail (unit x of the far end incl. padding), waves (wavelengths
 *        along the body), swing (tail amplitude × len at amp 1), head (fraction of the swing at the neck),
 *        power (envelope growth), harm (0..1 second harmonic for chaotic thrashing), stripPx (target device px) }
 */
export function layoutSpine(sp, len, phase, amp, o, pxs) {
  const xh = o.xh, tail = o.tail;
  const span = xh - tail;
  const n = clamp(Math.round((span * len * pxs) / (o.stripPx || 8)), 4, Math.min(MAXN, o.maxStrips || 40));
  const stepU = span / n;
  const A = (o.swing || 0.05) * len * clamp(amp, 0, 1.8);
  const waves = o.waves || 1.2, head = o.head || 0, power = o.power || 1.2, harm = o.harm || 0;
  const w = (u) => {
    const a = (xh - u) / (xh + 0.5);
    const env = head + (1 - head) * Math.pow(Math.max(0, a), power);
    let y = Math.sin(phase - a * waves * TAU);
    if (harm) y += harm * Math.sin(phase * 1.7 + 1.3 - a * waves * 2.1 * TAU);
    return A * env * y + (o.bias ? o.bias(a) * len : 0);
  };
  sp.n = n;
  sp.xh = xh;
  sp.stepU = stepU;
  sp.len = len;
  let px = xh * len, py = w(xh), prevW = py;
  sp.bx[0] = px;
  sp.by[0] = py;
  const ds = stepU * len;
  // never bend more than maxTurn per strip: keeps the curve smooth (no kinks where strips would fan out)
  const maxTurn = o.maxTurn || 0.16;
  let prevDir = 0, first = true;
  for (let i = 0; i < n; i++) {
    const u = xh - stepU * (i + 1);
    const wy = w(u);
    let dir = Math.atan2(wy - prevW, -ds);
    if (first) first = false;
    else {
      let dd = dir - prevDir;
      if (dd > Math.PI) dd -= 2 * Math.PI;
      else if (dd < -Math.PI) dd += 2 * Math.PI;
      dir = prevDir + clamp(dd, -maxTurn, maxTurn);
    }
    prevDir = dir;
    const dx = Math.cos(dir) * ds, dy = Math.sin(dir) * ds;
    const nx = px + dx, ny = py + dy;
    sp.bx[i + 1] = nx;
    sp.by[i + 1] = ny;
    sp.cx[i] = (px + nx) * 0.5;
    sp.cy[i] = (py + ny) * 0.5;
    sp.ang[i] = Math.atan2(-dy, -dx);
    px = nx;
    py = ny;
    prevW = wy;
  }
  sp.hx = sp.bx[0];
  sp.hy = sp.by[0];
  sp.hang = n > 1 ? sp.ang[0] * 1.5 - sp.ang[1] * 0.5 : sp.ang[0];
  return sp;
}

/**
 * Draw a straight unit sprite along the spine: the rigid head piece (unit x ≥ sp.xh) in the head frame, then the
 * strips toward the tail. Overlap is computed in device px and widened where the body bends (no wedge gaps).
 */
export function drawSpine(ctx, spr, sp, pxs) {
  const len = sp.len, res = spr.res, s = len / res;
  const b = spr.box, padU = spr.pad / res;
  const uLeft = b.x0 - padU, uRight = b.x1 + padU;
  const chh = spr.canvas.height, dh = chh * s, yTop = b.y0 * len - spr.pad * s;
  const half = Math.max(-yTop, yTop + dh);
  const ov = 1.1 / Math.max(0.02, pxs);
  // head
  const hc = Math.cos(sp.hang), hs = Math.sin(sp.hang);
  const col = (sp.xh - uLeft) * res;
  if (col < spr.canvas.width) {
    ctx.transform(hc, hs, -hs, hc, sp.hx, sp.hy);
    ctx.drawImage(spr.canvas, col, 0, spr.canvas.width - col, chh, 0, yTop, (uRight - sp.xh) * len, dh);
    ctx.transform(hc, -hs, hs, hc, -(hc * sp.hx + hs * sp.hy), hs * sp.hx - hc * sp.hy);
  }
  // body strips, neck → tail (each new strip tucks under the previous one's edge)
  const dw = sp.stepU * len, sw = sp.stepU * res;
  let prev = sp.hang;
  for (let i = 0; i < sp.n; i++) {
    const a = sp.ang[i], c = Math.cos(a), sn = Math.sin(a);
    const x = sp.cx[i], y = sp.cy[i];
    const extra = Math.abs(a - prev) * half + ov;
    prev = a;
    const u0 = sp.xh - sp.stepU * (i + 1);
    ctx.transform(c, sn, -sn, c, x, y);
    ctx.drawImage(spr.canvas, (u0 - uLeft) * res, 0, sw * (1 + extra / dw), chh, -dw / 2, yTop, dw + extra, dh);
    ctx.transform(c, -sn, sn, c, -(c * x + sn * y), sn * x - c * y);
  }
}

/** Frame (point on the axis + heading) at unit x along the body. out = {x, y, a}. */
export function frameAt(sp, u, out) {
  if (u >= sp.xh) {
    const d = (u - sp.xh) * sp.len, c = Math.cos(sp.hang), s = Math.sin(sp.hang);
    out.x = sp.hx + c * d;
    out.y = sp.hy + s * d;
    out.a = sp.hang;
    return out;
  }
  const f = (sp.xh - u) / sp.stepU;
  const i = Math.min(sp.n - 1, Math.max(0, Math.floor(f)));
  const k = Math.min(1.5, f - i);
  out.x = sp.bx[i] + (sp.bx[i + 1] - sp.bx[i]) * k;
  out.y = sp.by[i] + (sp.by[i + 1] - sp.by[i]) * k;
  out.a = sp.ang[i];
  return out;
}

/** Point at unit (u, v) on the bent body (v = offset across the axis, in units of len). */
export function pointAt(sp, u, v, out) {
  frameAt(sp, u, out);
  const off = v * sp.len;
  out.x -= Math.sin(out.a) * off;
  out.y += Math.cos(out.a) * off;
  return out;
}

/** Enter the rigid head frame: afterwards unit-space coordinates × len draw on the head. Pair with leaveHead. */
export function enterHead(ctx, sp) {
  ctx.save();
  ctx.translate(sp.hx, sp.hy);
  ctx.rotate(sp.hang);
  ctx.translate(-sp.xh * sp.len, 0);
}
export const leaveHead = (ctx) => ctx.restore();
