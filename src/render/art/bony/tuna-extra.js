// Shared bits for the tunas (and the mackerel): finlet rows, caudal keels, the pale belly dots/lines, corselet.
import { spot, soft, rgba, lite, dark, createRng, noiseCanvas, makeCanvas } from './kit.js';

/** A row of swept finlets along the back ('top') or belly ('bot') between xa and xb (head → tail). */
export function finletRow(g, res, P, side, xa, xb, n, size, col, edge, lean = 0.9) {
  const sgn = side === 'top' ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const x = xa + ((xb - xa) * i) / (n - 1);
    const y = (side === 'top' ? P.top(x) : P.bot(x)) + sgn * 0.002;
    const s = size * (1 - 0.3 * (i / (n - 1)));
    g.beginPath();
    g.moveTo(x + s * 0.5, y - sgn * 0.01);
    g.quadraticCurveTo(x + s * 0.05, y + sgn * s * 0.9, x - s * lean, y + sgn * s * 1.05);
    g.quadraticCurveTo(x - s * 0.35, y + sgn * s * 0.4, x - s * 0.45, y - sgn * 0.01);
    g.closePath();
    const gr = g.createLinearGradient(x, y, x - s * 0.4, y + sgn * s);
    gr.addColorStop(0, col);
    gr.addColorStop(1, lite(col, 0.25));
    g.fillStyle = gr;
    g.fill();
    if (edge) {
      g.strokeStyle = edge;
      g.lineWidth = Math.max(s * 0.1, 0.6 / res);
      g.stroke();
    }
  }
}

/** The lateral keel on the caudal peduncle (a dark ridge with a lit top edge) plus two small keels at the tail root. */
export function keels(g, res, P, x0, x1, col, lightCol) {
  const y = (P.mid(x0) + P.mid(x1)) / 2;
  g.save();
  soft(g, 0.006, rgba(col, 0.55), () => {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.lineWidth = 0.009;
    g.stroke();
  });
  g.strokeStyle = rgba(lightCol || '#ffffff', 0.35);
  g.lineWidth = Math.max(0.0025, 0.6 / res);
  g.beginPath();
  g.moveTo(x0, y - 0.004);
  g.lineTo(x1, y - 0.004);
  g.stroke();
  g.restore();
}

/** Faint transverse lines and dots of pale guanine on the lower flank (tunas). */
export function bellyMarks(g, res, P, rng, xa, xb, n, col = '#ffffff', a = 0.3) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = xa + ((xb - xa) * i) / (n - 1) + (rng.next() - 0.5) * 0.01;
    const v0 = 0.5 + rng.next() * 0.1, v1 = 0.85 + rng.next() * 0.1;
    if (i % 2) {
      g.strokeStyle = rgba(col, a * (0.6 + 0.4 * rng.next()));
      g.lineWidth = Math.max(0.0022, 0.6 / res);
      g.beginPath();
      P.line(g, (xx) => v0 + ((v1 - v0) * (xx - x + 0.03)) / 0.06, x + 0.03, x - 0.03, 8, true);
      g.stroke();
    } else {
      for (let k = 0; k < 5; k++) {
        const v = v0 + ((v1 - v0) * (k + 0.5)) / 5;
        spot(g, x - 0.004 * k, P.at(x - 0.004 * k, v), 0.004, col, a * 0.9, 0.5);
      }
    }
  }
  g.restore();
}

/** Soft darker/bluer corselet of enlarged scales behind the head. */
export function corselet(g, P, x0, x1, col, a) {
  soft(g, 0.015, rgba(col, a), () => {
    g.beginPath();
    P.line(g, 0.08, x1, x0, 10, true);
    P.line(g, 0.62, x0, x1, 10, false);
    g.closePath();
    g.fill();
  });
}

/**
 * Organic blotches painted in UV space with FEATHERED limits (mottle() in the kit fills a hard rectangle).
 * o: { color, a=0.3, scale=0.35 (tile size as a fraction of the skin width), lo, hi, seed, v0=0, v1=1, feather=0.08,
 *      x0, x1 (unit x limits, default whole body), xFeather=0.05, sy=1 }
 */
export function uvMottle(t, U, o) {
  const W = U.W, H = U.H;
  const tmp = makeCanvas(W, H);
  const g = tmp.getContext('2d');
  const tile = noiseCanvas(o.color, o.lo === undefined ? 0.42 : o.lo, o.hi === undefined ? 0.75 : o.hi, o.seed || 1, 4, 4);
  const s = ((o.scale || 0.35) * W) / 256;
  g.save();
  g.scale(s, s * (o.sy || 1));
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, W / s, H / (s * (o.sy || 1)));
  g.restore();
  g.globalCompositeOperation = 'destination-in';
  const v0 = o.v0 === undefined ? 0 : o.v0, v1 = o.v1 === undefined ? 1 : o.v1, f = o.feather === undefined ? 0.08 : o.feather;
  let gr = g.createLinearGradient(0, (v0 - f) * H, 0, (v1 + f) * H);
  const k = clampF(f / Math.max(1e-3, v1 - v0 + 2 * f));
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(k, 'rgba(0,0,0,1)');
  gr.addColorStop(1 - k, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  if (o.x0 !== undefined || o.x1 !== undefined) {
    const xa = U.X(o.x0 === undefined ? U.P.x0 : o.x0), xb = U.X(o.x1 === undefined ? U.P.x1 : o.x1);
    const xf = U.dx(o.xFeather === undefined ? 0.05 : o.xFeather);
    gr = g.createLinearGradient(xa - xf, 0, xb + xf, 0);
    const kk = clampF(xf / Math.max(1, xb - xa + 2 * xf));
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(kk, 'rgba(0,0,0,1)');
    gr.addColorStop(1 - kk, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  t.save();
  t.globalAlpha *= o.a === undefined ? 0.3 : o.a;
  t.drawImage(tmp, 0, 0);
  t.restore();
}
const clampF = (v) => (v < 0.001 ? 0.001 : v > 0.499 ? 0.499 : v);

export { createRng, dark };
