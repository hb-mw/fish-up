// Shared pieces for the billfish (blue marlin, sailfish, swordfish): bill, keels, lunate tails, lit-up bars.
import { fin, caudal, spot, soft, glint, rgba, mixc, lite, dark } from './kit.js';

/**
 * Over-paint the bill (rostrum) in unit space, clipped to the body: dark above, lighter below, with a faint
 * ridge line, and the pale lower jaw. x0 = base of the bill, x1 = tip. Call from paintBody's `face`.
 */
export function paintBill(g, res, P, o) {
  const { x0, x1 } = o;
  const jx = o.jawX || x1;
  // the bill's underside, extended straight back into the head (the lower jaw hangs below this line)
  const yb1 = P.bot(x1), ybj = P.bot(jx);
  const billBot = (x) => ybj + ((yb1 - ybj) * (x - jx)) / (x1 - jx);
  const at = (x, v) => P.top(x) + (billBot(x) - P.top(x)) * v;
  const top = o.top || '#2b3f63', bot = o.bot || '#7f8fa8';
  const gr = g.createLinearGradient(0, P.top(x0 + 0.03), 0, billBot(x0 + 0.03));
  gr.addColorStop(0, top);
  gr.addColorStop(0.45, mixc(top, bot, 0.5));
  gr.addColorStop(1, bot);
  g.save();
  g.beginPath();
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    g[i ? 'lineTo' : 'moveTo'](x, P.top(x) - 0.002);
  }
  for (let i = n; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * i) / n;
    g.lineTo(x, billBot(x) + 0.0015);
  }
  g.closePath();
  g.clip();
  g.fillStyle = gr;
  // the root melts into the head: ramp the opacity up over `fade` in thin slices
  const fd = o.fade || 0.05, ns = 24;
  for (let i = 0; i < ns; i++) {
    const k = i / ns;
    g.globalAlpha = k * k;
    g.fillRect(x0 + fd * k, -0.2, fd / ns + 0.001, 0.4);
  }
  g.globalAlpha = 1;
  g.fillRect(x0 + fd, -0.2, x1 - x0 - fd + 0.02, 0.4);
  // ridge highlight along the upper third + a dark underside line
  g.strokeStyle = rgba('#ffffff', 0.22);
  g.lineWidth = Math.max(0.0025, 0.6 / res);
  g.beginPath();
  g.moveTo(x0 + 0.04, at(x0 + 0.04, 0.3));
  g.lineTo(x1 - 0.01, at(x1 - 0.01, 0.32));
  g.stroke();
  g.strokeStyle = rgba(dark(top, 0.5), 0.3);
  g.beginPath();
  g.moveTo(x0 + 0.04, at(x0 + 0.04, 0.84));
  g.lineTo(x1 - 0.01, at(x1 - 0.01, 0.8));
  g.stroke();
  g.restore();
}

/** Two small horizontal keels on the caudal peduncle (one visible side): a lit ridge with a shadow under it. */
export function keels(g, res, P, x, o = {}) {
  const w = o.w || 0.06, h = o.h || 0.006;
  const y = P.mid(x) + (o.dy || 0);
  soft(g, 0.005, rgba(o.dark || '#0b1830', 0.22), () => {
    g.beginPath();
    g.ellipse(x, y + h * 0.9, w * 0.5, h * 0.7, 0, 0, 7);
    g.fill();
  });
  spot(g, x, y - h * 0.3, w * 0.5, o.light || '#c9d6e4', 0.4, 0.3, h * 0.6);
  if (o.black) spot(g, x, y, w * 0.4, o.black, 0.35, 0.4, h * 0.4);
}

/**
 * A lunate billfish / tuna tail: tall slender lobes, deep crescent. Returns fin control points (rays: to [3, 7]).
 * o: { P, root, up, lo, notchX, sharp }
 */
export function lunate(o) {
  const { P, up, lo } = o;
  return caudal({ P, root: o.root || 0.08, up, lo, notch: [o.notchX, (up[1] + lo[1]) / 2], lead: o.lead === undefined ? 0.04 : o.lead, trail: o.trail === undefined ? -0.3 : o.trail, sharp: o.sharp === undefined ? true : o.sharp });
}

/** Paint a lunate tail with dark membranes and bright rays — shared tuna/billfish look. */
export function lunateFin(g, res, pts, o) {
  fin(g, res, {
    pts,
    stops: o.stops || [[0, o.col], [0.5, o.col], [1, rgba(lite(o.col, 0.15), 0.9)]],
    axis: o.axis || [pts[0][0], 0, pts[3][0], 0],
    rays: { n: o.n || 36, to: [3, 7], from: pts.root, col: o.ray || '#0a1428', a: o.rayA || 0.35, fade: 0.3, w: 0.0014, curl: 0.03, hl: o.hl || '#9fb6d6', hla: 0.14 },
    scallop: { from: 3, to: 7, n: o.scallops || 18, depth: 0.003 },
    edge: { col: o.edge || 'rgba(5,12,30,0.4)', w: 0.003, to: 3 },
    margin: o.margin,
    mottle: { color: o.mot || '#06101f', a: 0.18, scale: 0.3, lo: 0.42, hi: 0.78, seed: 21 },
  });
}

/**
 * Vertical bars of pale dots / short lines on the flank, in UV space. Call from paintBody's `skin`.
 * o: { n, x0, x1 (head→tail span), v0, v1, color, a, slant (UV px per row), dotted (true → rows of dots), width (unit) }
 */
export function flankBars(t, U, o) {
  const n = o.n || 15;
  const col = o.color || '#9fd8ff';
  const w = U.dx(o.width || 0.012);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const x = o.x0 + (o.x1 - o.x0) * k;
    const px = U.X(x);
    const v0 = (o.v0 === undefined ? 0.08 : o.v0) + (o.v0jit || 0) * Math.sin(i * 2.3);
    const v1 = (o.v1 === undefined ? 0.8 : o.v1) + (o.v1jit || 0) * Math.sin(i * 1.7 + 1);
    const a = (o.a === undefined ? 0.55 : o.a) * (0.75 + 0.25 * Math.sin(i * 1.3));
    const slant = o.slant || 0;
    soft(t, w * 0.45, rgba(col, a), () => {
      t.lineWidth = w;
      t.lineCap = 'round';
      if (o.dotted) {
        t.setLineDash([w * 0.9, w * 1.4]);
        t.lineDashOffset = i * w * 0.7;
      }
      t.beginPath();
      t.moveTo(px + slant * (0.5 - v0), v0 * U.H);
      t.lineTo(px + slant * (0.5 - v1), v1 * U.H);
      t.stroke();
      t.setLineDash([]);
    });
  }
}

export { glint };
