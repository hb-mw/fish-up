// Helpers for the bony deep-sea fish of the SHARKS set (lanternfish, viperfish, anglerfish, coelacanth):
// rayed translucent fins, layered iridescent skin with scales, a photophore glow sprite.
import { paintScales } from '../common.js';
import { TAU, shape, soft, softStroke, band, texture, ca, lod, clipTo, rgba, hex } from './kit.js';

/**
 * A rayed fin: translucent membrane (gradient base → edge), fine rays fanning from the base segment toward
 * the tip segment (clipped to the fin), a lit outer edge. fin: { pts, base:[[x,y],[x,y]], tips:[[x,y],[x,y]], rays }
 * col: { mem, memEdge, ray, edge }
 */
export function rayFin(g, res, fin, col, o = {}) {
  const [b0, b1] = fin.base, [t0, t1] = fin.tips;
  const bx = (b0[0] + b1[0]) / 2, by = (b0[1] + b1[1]) / 2, tx = (t0[0] + t1[0]) / 2, ty = (t0[1] + t1[1]) / 2;
  g.save();
  g.beginPath();
  shape(g, fin.pts);
  const gr = g.createLinearGradient(bx, by, tx, ty);
  gr.addColorStop(0, col.mem);
  gr.addColorStop(1, col.memEdge || col.mem);
  g.fillStyle = gr;
  g.fill();
  g.clip();
  const n = fin.rays || 8;
  const lw = o.rayW || Math.max(0.0012, Math.hypot(tx - bx, ty - by) * 0.03);
  g.strokeStyle = col.ray;
  g.lineWidth = lw;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const sx = b0[0] + (b1[0] - b0[0]) * k, sy = b0[1] + (b1[1] - b0[1]) * k;
    const ex = t0[0] + (t1[0] - t0[0]) * k, ey = t0[1] + (t1[1] - t0[1]) * k;
    g.moveTo(sx, sy);
    g.quadraticCurveTo((sx + ex) / 2 + (o.bend || 0) * (ey - sy), (sy + ey) / 2 - (o.bend || 0) * (ex - sx), ex, ey);
  }
  g.stroke();
  if (col.edge) softStroke(g, res, lw * 0.8, col.edge, lw * 1.6, (q) => shape(q, fin.pts));
  if (o.after) o.after(g);
  g.restore();
}

/**
 * Layered skin for a bony fish, painted inside the body clip:
 * belly base → soft dorsal pigment above the countershade line → iridescent flank band → lit back / sheen
 * → belly shade → scales → lateral line → low-contrast texture.
 * C: { back, flank, belly, iris?, scaleDark?, scaleLight? } o: { cf (fraction or fn), soft, scale, scaleA, lateral, box }
 */
export function fishSkin(g, res, P, C, o) {
  const xa = P.x1 + 0.02, xb = P.x0 - 0.02;
  const cf = typeof o.cf === 'function' ? o.cf : () => (o.cf !== undefined ? o.cf : 0.5);
  const box = o.box;
  g.fillStyle = C.belly;
  g.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  soft(g, res, o.soft || 0.03, C.flank, (q) => band(q, P, xa, xb, -0.4, (x) => cf(x) + 0.18));
  soft(g, res, o.soft || 0.03, C.back, (q) => band(q, P, xa, xb, -0.4, cf));
  if (C.iris) soft(g, res, 0.03, C.iris, (q) => band(q, P, xa, xb, (x) => cf(x) - 0.05, (x) => cf(x) + 0.22));
  if (C.top) soft(g, res, 0.02, C.top, (q) => band(q, P, xa, xb, -0.3, 0.12));
  const sh = o.sheen !== undefined ? o.sheen : 1;
  soft(g, res, 0.03, `rgba(255,255,255,${0.16 * sh})`, (q) => band(q, P, xa - 0.06, xb + 0.1, 0.16, 0.36));
  soft(g, res, 0.008, `rgba(255,255,255,${0.22 * sh})`, (q) => band(q, P, xa - 0.12, xb + 0.25, 0.22, 0.26));
  soft(g, res, 0.03, C.bellyShade || 'rgba(20,30,50,0.35)', (q) => band(q, P, xa, xb, 0.84, 1.3));
  if (o.scale && lod(res) >= 1) {
    paintScales(g, box.x0, box.y0, box.x1, box.y1, o.scale, {
      dark: C.scaleDark || `rgba(0,10,30,${o.scaleA || 0.18})`,
      light: C.scaleLight || `rgba(255,255,255,${(o.scaleA || 0.18) * 0.7})`,
      lineWidth: o.scale * 0.07,
    });
  }
  if (o.lateral !== undefined) {
    softStroke(g, res, 0.002, 'rgba(255,255,255,0.3)', 0.003, (q) => {
      for (let i = 0; i <= 30; i++) {
        const x = xa - 0.08 - ((xa - xb - 0.12) * i) / 30;
        if (i === 0) q.moveTo(x, P.at(x, o.lateral));
        else q.lineTo(x, P.at(x, o.lateral));
      }
    });
  }
  texture(g, 'mottle', 0.35, o.mottle !== undefined ? o.mottle : 0.12, box);
  softStroke(g, res, 0.008, 'rgba(0,8,20,0.25)', 0.008, (q) => P.outline(q));
}

/** A photophore as painted on the body (daylight look): pearly disc with a dark pigment cup and a bright eye. */
export function photophore(g, x, y, r, col) {
  g.fillStyle = 'rgba(10,14,24,0.75)';
  g.beginPath();
  g.ellipse(x, y + r * 0.1, r * 1.25, r * 1.15, 0, 0, TAU);
  g.fill();
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, rgba(hex(col).map((v) => v * 0.45), 1));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/**
 * Paint glow dots into a unit sprite (pre-blurred halo + hot core) — blitted with the body's swim params in
 * the additive pass so the lights ride the body. list: [[x, y, r], …] in unit space.
 */
export function paintGlowDots(g, res, list, color, halo = 3.2) {
  const c = hex(color);
  for (const [x, y, r] of list) {
    const R = r * halo;
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.14, rgba(c.map((v) => v + (255 - v) * 0.5), 0.9));
    gr.addColorStop(0.32, rgba(c, 0.45));
    gr.addColorStop(0.62, rgba(c, 0.12));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(x - R, y - R, R * 2, R * 2);
  }
}

export { clipTo, ca };
