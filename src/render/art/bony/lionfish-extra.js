// Lionfish helpers: banded venomous spines with pennant membranes, and the great fan-like pectoral fins.
import { rgba, mixc, soft, spot, createRng } from './kit.js';

/** A tapered spine from (x0,y0) to (x1,y1), cream with dark rings. */
export function spine(g, x0, y0, x1, y1, w0, w1, light, darkCol, bands = 6, res = 400) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  g.save();
  g.beginPath();
  g.moveTo(x0 + nx * w0, y0 + ny * w0);
  g.lineTo(x1 + nx * w1, y1 + ny * w1);
  g.lineTo(x1 - nx * w1, y1 - ny * w1);
  g.lineTo(x0 - nx * w0, y0 - ny * w0);
  g.closePath();
  g.fillStyle = light;
  g.fill();
  g.clip();
  g.strokeStyle = darkCol;
  g.lineCap = 'butt';
  for (let i = 0; i < bands; i++) {
    const k0 = (i + 0.35) / bands, k1 = (i + 0.72) / bands;
    g.lineWidth = Math.max(w0 * 2.2, 0.8 / res);
    g.beginPath();
    g.moveTo(x0 + dx * k0, y0 + dy * k0);
    g.lineTo(x0 + dx * k1, y0 + dy * k1);
    g.stroke();
  }
  g.restore();
}

/**
 * One group of dorsal spines. xs = base positions along the back, lens = spine lengths, lean = tailward run per rise.
 * Each spine trails a soft pennant membrane (banded red-brown / white).
 */
export function spineGroup(g, res, P, xs, lens, lean, cols) {
  const rng = createRng(xs.length * 7 + 3);
  for (let i = 0; i < xs.length; i++) {
    const xb = xs[i], yb = P.top(xb) + 0.012, L = lens[i];
    const d = Math.hypot(lean, 1);
    const ux = -lean / d, uy = -1 / d;
    const xt = xb + ux * L, yt = yb + uy * L;
    // pennant: a narrow translucent membrane trailing the spine, ringed light/dark
    const fw = 0.013 + 0.005 * rng.next();
    g.save();
    g.beginPath();
    g.moveTo(xb + ux * L * 0.08, yb + uy * L * 0.08);
    g.quadraticCurveTo(xb + ux * L * 0.5 - fw * 1.1, yb + uy * L * 0.5 + fw * 0.35, xb + ux * L * 0.8 - fw * 0.8, yb + uy * L * 0.8 + fw * 0.25);
    g.quadraticCurveTo(xb + ux * L * 0.94 - fw * 0.3, yb + uy * L * 0.94, xt, yt);
    g.lineTo(xb + ux * L * 0.08, yb + uy * L * 0.08);
    g.closePath();
    g.clip();
    const gr = g.createLinearGradient(xb, yb, xt, yt);
    gr.addColorStop(0, rgba(cols.dark, 0.85));
    gr.addColorStop(1, rgba(cols.dark, 0.5));
    g.fillStyle = gr;
    g.fillRect(xb - 0.1, yt - 0.05, 0.2, L + 0.1);
    g.strokeStyle = rgba(cols.light, 0.7);
    g.lineWidth = 0.0032;
    for (let k = 0.2 + 0.06 * rng.next(); k < 0.95; k += 0.11) {
      g.beginPath();
      g.moveTo(xb + ux * L * k + 0.003, yb + uy * L * k);
      g.lineTo(xb + ux * L * k - fw * 1.2, yb + uy * L * k + fw * 0.45);
      g.stroke();
    }
    g.restore();
    spine(g, xb, yb + 0.01, xt, yt, 0.0062, 0.0012, cols.light, cols.dark, 7, res);
  }
}

/**
 * Pectoral fan: rays radiating from (px,py) between angles a0..a1 (from the −x axis, + downward), membrane over the
 * inner part, free banded filaments beyond. `shade` 0..1 darkens the far fan.
 */
export function pectoralFan(g, res, px, py, a0, a1, n, Lmax, cols, shade = 0) {
  const rng = createRng(n * 13 + 1);
  const rays = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    const a = a0 + (a1 - a0) * q;
    const L = Lmax * (0.72 + 0.28 * Math.sin(Math.PI * Math.pow(q, 0.8)));
    rays.push([a, L, -Math.cos(a), Math.sin(a)]);
  }
  const dk = mixc(cols.dark, '#000000', shade * 0.5), lt = mixc(cols.light, '#6a5a58', shade * 0.5);
  // membrane
  g.save();
  g.beginPath();
  g.moveTo(px, py);
  for (let i = 0; i < rays.length; i++) {
    const r = rays[i];
    g.lineTo(px + r[2] * r[1] * 0.66, py + r[3] * r[1] * 0.66);
    if (i < rays.length - 1) {
      const q = rays[i + 1];
      g.lineTo(px + (r[2] * r[1] + q[2] * q[1]) * 0.5 * 0.6, py + (r[3] * r[1] + q[3] * q[1]) * 0.5 * 0.6);
    }
  }
  g.closePath();
  g.clip();
  const gr = g.createRadialGradient(px, py, 0, px, py, Lmax * 0.6);
  gr.addColorStop(0, rgba(dk, 0.95));
  gr.addColorStop(0.5, rgba(dk, 0.8));
  gr.addColorStop(1, rgba(dk, 0.5));
  g.fillStyle = gr;
  g.fillRect(px - Lmax, py - Lmax, 2 * Lmax, 2 * Lmax);
  // concentric light bands + spots across the membrane
  g.strokeStyle = rgba(lt, 0.32);
  for (let k = 0.18; k < 0.64; k += 0.1) {
    g.lineWidth = 0.003 + 0.004 * rng.next();
    g.beginPath();
    g.arc(px, py, Lmax * k, Math.PI - a1 - 0.3, Math.PI - a0 + 0.3, false);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const a = a0 + (a1 - a0) * rng.next(), r = Lmax * (0.12 + 0.52 * rng.next());
    spot(g, px - Math.cos(a) * r, py + Math.sin(a) * r, 0.0025 + 0.003 * rng.next(), i % 3 ? lt : '#2a0806', 0.55, 0.5);
  }
  g.restore();
  // rays: thick near the base, free filaments beyond the membrane
  for (const r of rays) {
    spine(g, px, py, px + r[2] * r[1], py + r[3] * r[1], 0.0045, 0.0012, lt, dk, 9, res);
  }
  // soft root shadow so the fan grows out of the flank
  soft(g, 0.012, 'rgba(30,10,10,0.35)', () => {
    g.beginPath();
    g.ellipse(px, py, 0.03, 0.02, 0, 0, 7);
    g.fill();
  });
}
