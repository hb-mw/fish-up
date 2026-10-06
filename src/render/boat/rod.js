// Rod, guides, handle and reel. BOAT ART module. Drawn in boat-local space through the rod sample points.
import { TAU, clamp, lerp } from '../../core/math.js';
import { shade } from './util.js';

/** Rod looks by tackle rating: honey fibreglass → graphite → black & gold. */
const STYLES = [
  { blank: '#c99a4a', blankHi: '#f3d9a0', wrap: '#b8322a', trim: '#e8c35a', reel: '#9aa4ad', reelDark: '#4d565f', spool: '#c9cfd4' },
  { blank: '#27384c', blankHi: '#7f9ab8', wrap: '#d6dde4', trim: '#5fb0e0', reel: '#2a2f36', reelDark: '#15181c', spool: '#c0c7ce' },
  { blank: '#16181d', blankHi: '#6a6f7a', wrap: '#d9a93a', trim: '#f5d77a', reel: '#c9a24a', reelDark: '#6b5220', spool: '#efe2b5' },
];
export function rodStyleFor(tackle) {
  return STYLES[tackle >= 7 ? 2 : tackle >= 3.5 ? 1 : 0];
}

const GUIDES = [0.17, 0.31, 0.45, 0.58, 0.71, 0.84];
const _L = new Float32Array(64), _R = new Float32Array(64);
const _NX = new Float32Array(32), _NY = new Float32Array(32);

/** Interpolated point along the polyline at fraction s (0 = grip, 1 = tip). */
function along(xs, ys, n, s, out) {
  const f = clamp(s, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  out.x = xs[i] + (xs[i + 1] - xs[i]) * k;
  out.y = ys[i] + (ys[i + 1] - ys[i]) * k;
  out.i = i;
  return out;
}
const _p = { x: 0, y: 0, i: 0 };

/**
 * Rod blank + handle + guides + the line running along it.
 * xs/ys: local rod points (grip … tip), n = count. ux,uy: unit direction at the grip. style: from rodStyleFor.
 * lineCol: css colour for the line threaded through the guides (null = no line).
 * Returns the reel attachment (local) via `outReel` {x, y}.
 */
export function drawRod(ctx, xs, ys, n, ux, uy, style, lineCol, outReel) {
  // normals (pointing to the "underside" = clockwise of the direction → toward the water when the rod points forward)
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
    let dx = xs[b] - xs[a], dy = ys[b] - ys[a];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    _NX[i] = -dy;
    _NY[i] = dx;
  }
  const nx0 = -uy, ny0 = ux; // underside normal at the grip

  // ── handle behind the grip: butt cap, rear cork, reel seat; fore grip in front ──
  const gx = xs[0], gy = ys[0];
  const seg = (a, b, w0, w1, col, hi) => {
    const ax = gx + ux * a, ay = gy + uy * a, bx = gx + ux * b, by = gy + uy * b;
    ctx.beginPath();
    ctx.moveTo(ax + nx0 * w0, ay + ny0 * w0);
    ctx.lineTo(bx + nx0 * w1, by + ny0 * w1);
    ctx.lineTo(bx - nx0 * w1, by - ny0 * w1);
    ctx.lineTo(ax - nx0 * w0, ay - ny0 * w0);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (hi) {
      ctx.strokeStyle = hi;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(ax - nx0 * w0 * 0.45, ay - ny0 * w0 * 0.45);
      ctx.lineTo(bx - nx0 * w1 * 0.45, by - ny0 * w1 * 0.45);
      ctx.stroke();
    }
  };
  // rear grip (cork) + butt cap
  seg(-40, -35, 2.9, 2.9, '#22252b', 'rgba(255,255,255,0.18)');
  seg(-35, -6, 2.7, 2.5, '#c89a62', 'rgba(255,240,210,0.55)');
  // cork speckle bands
  ctx.strokeStyle = 'rgba(110,70,35,0.45)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = -32; k < -7; k += 3.2) {
    const cx = gx + ux * k, cy = gy + uy * k;
    ctx.moveTo(cx + nx0 * 2.5, cy + ny0 * 2.5);
    ctx.lineTo(cx - nx0 * 2.5, cy - ny0 * 2.5);
  }
  ctx.stroke();
  // reel seat (metal) + fore grip
  seg(-6, 7, 2.3, 2.3, shade(style.reel, -0.15), 'rgba(255,255,255,0.5)');
  seg(7, 19, 2.4, 2.0, '#c89a62', 'rgba(255,240,210,0.5)');
  seg(19, 21, 2.1, 1.9, style.trim, null);

  // ── tapered blank from the fore grip to the tip ──
  // half width: 1.75 → 0.5
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const w = lerp(1.75, 0.5, Math.pow(s, 0.85));
    _L[i * 2] = xs[i] + _NX[i] * w;
    _L[i * 2 + 1] = ys[i] + _NY[i] * w;
    _R[i * 2] = xs[i] - _NX[i] * w;
    _R[i * 2 + 1] = ys[i] - _NY[i] * w;
  }
  ctx.beginPath();
  ctx.moveTo(_L[0], _L[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(_L[i * 2], _L[i * 2 + 1]);
  ctx.arc(xs[n - 1], ys[n - 1], 0.5, Math.atan2(_NY[n - 1], _NX[n - 1]), Math.atan2(-_NY[n - 1], -_NX[n - 1]), true);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(_R[i * 2], _R[i * 2 + 1]);
  ctx.closePath();
  ctx.fillStyle = style.blank;
  ctx.fill();
  // glossy highlight along the top side
  ctx.strokeStyle = style.blankHi;
  ctx.globalAlpha *= 0.75;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const s = i / (n - 1);
    const w = lerp(1.75, 0.5, Math.pow(s, 0.85)) * 0.45;
    const px = xs[i] - _NX[i] * w, py = ys[i] - _NY[i] * w;
    if (i === 1) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.globalAlpha /= 0.75;

  // ── guides: wraps + standing rings on the underside ──
  const ringX = [], ringY = [];
  for (let g = 0; g < GUIDES.length; g++) {
    const s = GUIDES[g];
    along(xs, ys, n, s, _p);
    const i = _p.i;
    const nx = _NX[i], ny = _NY[i];
    const dx = -ny, dy = nx; // along the rod
    const h = lerp(5.2, 1.8, s); // stand-off
    const r = lerp(2.5, 0.9, s); // ring radius
    const w = lerp(1.75, 0.5, Math.pow(s, 0.85));
    // thread wrap
    ctx.strokeStyle = style.wrap;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(_p.x + nx * w - dx * 1.1, _p.y + ny * w - dy * 1.1);
    ctx.lineTo(_p.x - nx * w - dx * 1.1, _p.y - ny * w - dy * 1.1);
    ctx.stroke();
    // feet
    ctx.strokeStyle = '#8e969e';
    ctx.lineWidth = 0.6;
    const rx = _p.x + nx * (w + h), ry = _p.y + ny * (w + h);
    ctx.beginPath();
    ctx.moveTo(_p.x - dx * 2.2, _p.y - dy * 2.2);
    ctx.lineTo(rx - nx * r, ry - ny * r);
    ctx.lineTo(_p.x + dx * 1.2, _p.y + dy * 1.2);
    ctx.stroke();
    // ring (seen edge-on-ish: an ellipse)
    ctx.strokeStyle = '#c8d0d6';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(rx, ry, r * 0.45, r, Math.atan2(dy, dx), 0, TAU);
    ctx.stroke();
    ringX.push(rx);
    ringY.push(ry);
  }
  // tip-top
  ctx.fillStyle = '#c8d0d6';
  ctx.beginPath();
  ctx.arc(xs[n - 1], ys[n - 1], 0.9, 0, TAU);
  ctx.fill();

  // reel position (hangs under the reel seat)
  const reelX = gx + ux * 1 + nx0 * 10.5, reelY = gy + uy * 1 + ny0 * 10.5;
  if (outReel) {
    outReel.x = reelX;
    outReel.y = reelY;
    outReel.nx = nx0;
    outReel.ny = ny0;
  }
  // the line: spool → guides → tip
  if (lineCol) {
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(reelX + ux * 5, reelY + uy * 5 - ny0 * 2);
    for (let g = 0; g < ringX.length; g++) ctx.lineTo(ringX[g], ringY[g]);
    ctx.lineTo(xs[n - 1], ys[n - 1]);
    ctx.stroke();
  }
}

/**
 * The reel body hanging under the rod: foot, round frame, spool face (spins with spoolA), drag knob.
 * Crank arm + knob are drawn separately (drawCrank) so the hand can sit between them.
 */
export function drawReel(ctx, rx, ry, ux, uy, nx, ny, style, spoolA) {
  // foot up to the reel seat
  ctx.strokeStyle = shade(style.reel, -0.1);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(rx - nx * 3, ry - ny * 3);
  ctx.lineTo(rx - nx * 10, ry - ny * 10);
  ctx.stroke();
  // body
  const g = ctx.createRadialGradient(rx - 2, ry - 2.5, 0.5, rx, ry, 7.5);
  g.addColorStop(0, shade(style.reel, 0.45));
  g.addColorStop(0.6, style.reel);
  g.addColorStop(1, style.reelDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(rx, ry, 6.8, 0, TAU);
  ctx.fill();
  // spool face with the line wound on it
  ctx.fillStyle = shade(style.spool, -0.1);
  ctx.beginPath();
  ctx.arc(rx, ry, 4.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(rx, ry, 3.6, 0, TAU);
  ctx.stroke();
  // spokes (rotate with the spool so a screaming drag reads)
  ctx.strokeStyle = style.reelDark;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = spoolA + (i * TAU) / 3;
    ctx.moveTo(rx + Math.cos(a) * 1.2, ry + Math.sin(a) * 1.2);
    ctx.lineTo(rx + Math.cos(a) * 4.2, ry + Math.sin(a) * 4.2);
  }
  ctx.stroke();
  // drag star
  ctx.fillStyle = style.reelDark;
  ctx.beginPath();
  ctx.arc(rx, ry, 1.4, 0, TAU);
  ctx.fill();
  // rim highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(rx, ry, 6.4, -2.6, -1.1);
  ctx.stroke();
}

/** Crank arm + knob (in front of the reel); returns the knob position in out. */
export function knobPos(rx, ry, crankA, out) {
  out.x = rx + Math.cos(crankA) * 7.6;
  out.y = ry + Math.sin(crankA) * 7.6;
  return out;
}
export function drawCrank(ctx, rx, ry, crankA, style) {
  const kx = rx + Math.cos(crankA) * 7.6, ky = ry + Math.sin(crankA) * 7.6;
  const bx = rx - Math.cos(crankA) * 2.4, by = ry - Math.sin(crankA) * 2.4;
  ctx.strokeStyle = shade(style.reel, -0.25);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  ctx.fillStyle = '#2b2622';
  ctx.beginPath();
  ctx.ellipse(kx, ky, 2.2, 1.8, crankA, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(kx - 0.6, ky - 0.6, 0.7, 0, TAU);
  ctx.fill();
}

