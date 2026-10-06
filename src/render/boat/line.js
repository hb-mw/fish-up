// The fishing line: hair-thin but always readable, taut = straight, slack = soft, shivering under load,
// fading (not vanishing) with depth, with a little ring where it pierces the surface. BOAT ART module.
import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';

const MAXP = 96;
const X = new Float32Array(MAXP), Y = new Float32Array(MAXP);

/**
 * @param ctx      WORLD-space context
 * @param pts      fishing.line.points (world)
 * @param tipX/Y   where the drawn rod tip really is (replaces pts[0])
 * @param o        { slack, tension, t, k (device px per world px), night (0..1), amb [r,g,b], waves, glintSide (−1|1) }
 * Returns the surface crossing in `o.cross` ({x, y, ok}).
 */
export function drawLine(ctx, pts, tipX, tipY, o) {
  let n = Math.min(pts.length, MAXP);
  if (n < 2) return;
  X[0] = tipX;
  Y[0] = tipY;
  for (let i = 1; i < n; i++) {
    X[i] = pts[i].x;
    Y[i] = pts[i].y;
  }
  // taut lines are dead straight: pull the points onto the chord as the slack goes
  const x0 = X[0], y0 = Y[0], x1 = X[n - 1], y1 = Y[n - 1];
  const straight = 1 - smoothstep(0.04, 0.35, o.slack);
  if (straight > 0.001) {
    for (let i = 1; i < n - 1; i++) {
      const k = i / (n - 1);
      X[i] = lerp(X[i], lerp(x0, x1, k), straight);
      Y[i] = lerp(Y[i], lerp(y0, y1, k), straight);
    }
  }
  // a tiny shiver under high tension (standing wave, a couple of px at most)
  const shiver = clamp01((o.tension - 0.72) / 0.35);
  if (shiver > 0.01) {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    const amp = 1.6 * shiver;
    for (let i = 1; i < n - 1; i++) {
      const k = i / (n - 1);
      const w = Math.sin(k * Math.PI * 3) * Math.sin(o.t * 62 + k * 9) * amp * Math.sin(k * Math.PI);
      X[i] += nx * w;
      Y[i] += ny * w;
    }
  }

  // where does the line pierce the surface?
  const waves = o.waves;
  let ci = -1, cx = 0, cy = 0;
  let prevAbove = Y[0] < waves.heightAt(X[0]);
  for (let i = 1; i < n; i++) {
    const s = waves.heightAt(X[i]);
    const above = Y[i] < s;
    if (prevAbove && !above) {
      const sp = waves.heightAt(X[i - 1]);
      const a = Y[i - 1] - sp, b = Y[i] - s;
      const k = clamp(a / (a - b), 0, 1);
      cx = lerp(X[i - 1], X[i], k);
      cy = lerp(Y[i - 1], Y[i], k);
      ci = i;
      break;
    }
    prevAbove = above;
  }
  const lw = 1.25 / o.k;
  const amb = o.amb;
  const night = o.night;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── above water: slightly dark against the bright sky, pale at night ──
  const endA = ci < 0 ? (prevAbove ? n : 1) : ci;
  if (endA > 1 || ci > 0) {
    const r = lerp(70, 205, night) * (amb[0] / 255) + 10, g = lerp(78, 215, night) * (amb[1] / 255) + 10, b = lerp(92, 235, night) * (amb[2] / 255) + 12;
    ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${lerp(0.62, 0.5, night)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    path(ctx, 0, endA, ci > 0 ? cx : NaN, cy);
    ctx.stroke();
    // a faint specular glint sliding along the airborne part
    const len = endA;
    if (len >= 2) {
      const gk = (o.t * 0.23) % 1;
      const gi = Math.min(len - 2, Math.floor(gk * (len - 1)));
      const gx = lerp(X[gi], X[gi + 1], 0.5), gy = lerp(Y[gi], Y[gi + 1], 0.5);
      const gr = 14;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, `rgba(255,255,250,${0.75 * (1 - night * 0.6)})`);
      grad.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw * 1.2;
      ctx.beginPath();
      path(ctx, 0, endA, ci > 0 ? cx : NaN, cy);
      ctx.stroke();
    }
  }
  // ── under water: light against the dark sea, fading with depth (never vanishing) ──
  if (ci > 0) {
    const yEnd = Math.max(cy + 40, Y[n - 1]);
    const grad = ctx.createLinearGradient(0, cy, 0, yEnd);
    grad.addColorStop(0, 'rgba(225,246,255,0.78)');
    grad.addColorStop(0.5, 'rgba(200,236,250,0.55)');
    grad.addColorStop(1, `rgba(180,225,245,${Y[n - 1] - cy > 600 ? 0.32 : 0.42})`);
    // soft halo so it reads over busy backgrounds
    ctx.strokeStyle = 'rgba(200,240,255,0.10)';
    ctx.lineWidth = lw * 2.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    path(ctx, ci, n, NaN, 0, true);
    ctx.stroke();
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    path(ctx, ci, n, NaN, 0, true);
    ctx.stroke();
    // ring ripples where it pierces the surface
    const per = 1.5;
    for (let r = 0; r < 2; r++) {
      const ph = ((o.t / per) + r * 0.5) % 1;
      const rad = 3 + ph * 15;
      ctx.strokeStyle = `rgba(235,250,255,${0.55 * (1 - ph) * (1 - night * 0.5)})`;
      ctx.lineWidth = lw * 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.5, rad, rad * 0.24, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - night * 0.5)})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.3, 2.4, 0.9, 0, 0, TAU);
    ctx.fill();
  }
  o.cross.ok = ci > 0;
  o.cross.x = cx;
  o.cross.y = cy;
}

/** Path through X/Y[i0..i1) with smooth quadratic joins; optional end point (ex, ey) appended. */
function path(ctx, i0, i1, ex, ey, cont = false) {
  if (!cont) ctx.moveTo(X[i0], Y[i0]);
  const last = i1 - 1;
  if (last - i0 < 2) {
    for (let i = i0 + (cont ? 0 : 1); i <= last; i++) ctx.lineTo(X[i], Y[i]);
  } else {
    if (cont) ctx.lineTo(X[i0], Y[i0]);
    for (let i = i0 + 1; i < last; i++) ctx.quadraticCurveTo(X[i], Y[i], (X[i] + X[i + 1]) / 2, (Y[i] + Y[i + 1]) / 2);
    ctx.lineTo(X[last], Y[last]);
  }
  if (ex === ex) ctx.lineTo(ex, ey);
}

/** The last two line points (for orienting the lure). */
export function lineEndDir(pts, out) {
  const n = pts.length;
  if (n < 2) {
    out.x = 0;
    out.y = 1;
    return out;
  }
  // look back a few points so the direction is stable
  const a = pts[Math.max(0, n - 4)], b = pts[n - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  out.x = dx / d;
  out.y = dy / d;
  return out;
}
