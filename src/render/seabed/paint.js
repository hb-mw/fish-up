// Small painting helpers shared by the decoration painters (all work in the ctx's current local space).
import { hex } from './util.js';

const TAU = Math.PI * 2;
export { TAU };

/** css from [r,g,b] scaled by k (+alpha) */
export const rgbk = (c, k = 1, a = 1) => {
  const r = Math.max(0, Math.min(255, c[0] * k)) | 0, g = Math.max(0, Math.min(255, c[1] * k)) | 0, b = Math.max(0, Math.min(255, c[2] * k)) | 0;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`;
};
/** lighten toward white */
export const lite = (c, t, a = 1) => rgbk([c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t], 1, a);
export const H = hex;

/** Irregular closed blob path (call fill/stroke after). */
export function blobPath(g, cx, cy, rx, ry, n, jit, rng, rot = 0) {
  g.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const r = 1 + rng.range(-jit, jit);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  // smooth closed curve through midpoints
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) g.moveTo(mx, my);
    else g.quadraticCurveTo(p[0], p[1], mx, my);
  }
  const p = pts[0], q = pts[1];
  g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  g.closePath();
}

/** Soft contact shadow ellipse on the ground under an object. */
export function contactShadow(g, cx, w, h = 6, a = 0.35) {
  const gr = g.createRadialGradient(cx, 1, 0, cx, 1, w);
  gr.addColorStop(0, `rgba(10,14,18,${a})`);
  gr.addColorStop(1, 'rgba(10,14,18,0)');
  g.save();
  g.translate(cx, 1);
  g.scale(1, h / w);
  g.translate(-cx, -1);
  g.fillStyle = gr;
  g.fillRect(cx - w, 1 - w, w * 2, w * 2);
  g.restore();
}

/** Linear gradient helper: stops = [[t, css], …] */
export function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}
export function rad(g, x0, y0, r0, x1, y1, r1, stops) {
  const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}

/** A tapered stroke along a polyline (widths w0 → w1), drawn as overlapping round segments. */
export function taper(g, pts, w0, w1, style) {
  g.strokeStyle = style;
  g.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const t = (i - 0.5) / (pts.length - 1);
    g.lineWidth = w0 + (w1 - w0) * t;
    g.beginPath();
    g.moveTo(pts[i - 1][0], pts[i - 1][1]);
    g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
}

/** Filled ribbon (leaf / blade) along a centre polyline with per-point half-widths. */
export function ribbon(g, pts, widths) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = widths[i];
    L.push([p[0] - dy * w, p[1] + dx * w]);
    R.push([p[0] + dy * w, p[1] - dx * w]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) g.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
}

/** Speckle dots inside the current clip. */
export function speckle(g, x0, y0, x1, y1, n, rng, colors, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.beginPath();
    g.arc(rng.range(x0, x1), rng.range(y0, y1), rng.range(rMin, rMax), 0, TAU);
    g.fill();
  }
}
