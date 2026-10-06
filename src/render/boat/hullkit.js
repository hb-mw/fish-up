// Shared hull-painting kit: parametric hull geometry + small deck props. BOAT ART module.
import { clamp01, lerp, smoothstep } from '../../core/math.js';
import { bez, shade, vgrad, lgrad } from './util.js';

// ── generic hull geometry ───────────────────────────────────────────────────
export const NS = 90;
/**
 * def: { sheer:[8 numbers: cubic bezier stern-top → stem-top], bottom:[8: transom-bottom → forefoot],
 *        stem:[4: two control points stem-top → forefoot], reveal: max px, revealStern: 0..1 }
 */
export function makeHull(def) {
  const S = new Float32Array((NS + 1) * 2), B = new Float32Array((NS + 1) * 2);
  const s = def.sheer, b = def.bottom;
  for (let i = 0; i <= NS; i++) {
    const u = i / NS;
    S[i * 2] = bez(s[0], s[2], s[4], s[6], u);
    S[i * 2 + 1] = bez(s[1], s[3], s[5], s[7], u);
    B[i * 2] = bez(b[0], b[2], b[4], b[6], u);
    B[i * 2 + 1] = bez(b[1], b[3], b[5], b[7], u);
  }
  const H = { def, S, B };
  /** point on the side at (u, v): v = 0 sheer … 1 keel. u may overshoot [0,1] slightly (extrapolated). */
  H.pt = (u, v, out) => {
    const sx = bez(s[0], s[2], s[4], s[6], u), sy = bez(s[1], s[3], s[5], s[7], u);
    const bx = bez(b[0], b[2], b[4], b[6], u), by = bez(b[1], b[3], b[5], b[7], u);
    out.x = sx + (bx - sx) * v;
    out.y = sy + (by - sy) * v;
    return out;
  };
  H.outline = (ctx) => {
    ctx.moveTo(S[0], S[1]);
    for (let i = 1; i <= NS; i++) ctx.lineTo(S[i * 2], S[i * 2 + 1]);
    const st = def.stem;
    ctx.bezierCurveTo(st[0], st[1], st[2], st[3], B[NS * 2], B[NS * 2 + 1]);
    for (let i = NS - 1; i >= 0; i--) ctx.lineTo(B[i * 2], B[i * 2 + 1]);
    ctx.closePath();
  };
  const tp = { x: 0, y: 0 };
  /** polygon between v-lines va and vb (overshooting the ends; clip with the outline). */
  H.band = (ctx, va, vb) => {
    const n = 70;
    for (let i = 0; i <= n; i++) {
      const u = -0.05 + (1.12 * i) / n;
      H.pt(u, va, tp);
      if (i === 0) ctx.moveTo(tp.x, tp.y);
      else ctx.lineTo(tp.x, tp.y);
    }
    for (let i = n; i >= 0; i--) {
      const u = -0.05 + (1.12 * i) / n;
      H.pt(u, vb, tp);
      ctx.lineTo(tp.x, tp.y);
    }
    ctx.closePath();
  };
  H.vline = (ctx, v, u0 = -0.05, u1 = 1.07) => {
    const n = 60;
    for (let i = 0; i <= n; i++) {
      H.pt(lerp(u0, u1, i / n), v, tp);
      if (i === 0) ctx.moveTo(tp.x, tp.y);
      else ctx.lineTo(tp.x, tp.y);
    }
  };
  /** sheer y at local x (sampled). */
  H.sheerY = (x) => {
    for (let i = 1; i <= NS; i++) {
      if (S[i * 2] >= x) {
        const x0 = S[i * 2 - 2], x1 = S[i * 2];
        const k = (x - x0) / Math.max(1e-6, x1 - x0);
        return S[i * 2 - 1] + (S[i * 2 + 1] - S[i * 2 - 1]) * clamp01(k);
      }
    }
    return S[NS * 2 + 1];
  };
  H.bottomY = (x) => {
    for (let i = 1; i <= NS; i++) {
      if (B[i * 2] >= x) {
        const x0 = B[i * 2 - 2], x1 = B[i * 2];
        const k = (x - x0) / Math.max(1e-6, x1 - x0);
        return B[i * 2 - 1] + (B[i * 2 + 1] - B[i * 2 - 1]) * clamp01(k);
      }
    }
    return B[NS * 2 + 1];
  };
  /** how far the far gunwale is raised at sheer index i (the beam, seen from slightly above). */
  H.reveal = (u) => {
    const R = def.reveal || 11;
    const st = def.revealStern ?? 0.6;
    const w = u < 0.45 ? lerp(st, 1, smoothstep(0, 0.45, u)) : 1 - Math.pow(smoothstep(0.45, 1, u), 1.25);
    return R * w;
  };
  /** far-gunwale curve from u0..u1 */
  H.farLine = (ctx, move = true) => {
    for (let i = 0; i <= NS; i++) {
      const u = i / NS;
      const x = S[i * 2], y = S[i * 2 + 1] - H.reveal(u);
      if (i === 0 && move) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  H.nearLineRev = (ctx) => {
    for (let i = NS; i >= 0; i--) ctx.lineTo(S[i * 2], S[i * 2 + 1]);
  };
  H.uAtX = (x) => {
    for (let i = 1; i <= NS; i++) if (S[i * 2] >= x) return i / NS;
    return 1;
  };
  return H;
}

// ── painting helpers ────────────────────────────────────────────────────────
export function chip(g, rng, x, y, s, fill, edge) {
  g.beginPath();
  const n = 6 + ((rng.next() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = s * (0.55 + rng.next() * 0.6);
    const px = x + Math.cos(a) * r * 1.5, py = y + Math.sin(a) * r * 0.75;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = 0.45;
    g.stroke();
  }
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Galvanised bucket (with a fish tail poking out), sitting with its base at (x, y). */
export function paintBucket(g, x, y, w, h) {
  const top = y - h;
  g.fillStyle = lgrad(g, x - w / 2, 0, x + w / 2, 0, [[0, '#6f7a80'], [0.35, '#c9d2d6'], [0.6, '#9aa6ac'], [1, '#56616a']]);
  g.beginPath();
  g.moveTo(x - w / 2, top);
  g.lineTo(x + w / 2, top);
  g.lineTo(x + w / 2 - 3, y);
  g.lineTo(x - w / 2 + 3, y);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,50,56,0.45)';
  g.lineWidth = 0.8;
  for (const k of [0.3, 0.62]) {
    g.beginPath();
    g.moveTo(x - w / 2 + 1 + 3 * k, top + h * k);
    g.lineTo(x + w / 2 - 1 - 3 * k, top + h * k);
    g.stroke();
  }
  // rim
  g.fillStyle = '#d7dee2';
  g.fillRect(x - w / 2 - 1, top - 1.5, w + 2, 2.5);
  // the sardine tail (bait)
  g.fillStyle = '#7fa6bf';
  g.beginPath();
  g.moveTo(x + 2, top);
  g.quadraticCurveTo(x + 4, top - 7, x + 1, top - 11);
  g.lineTo(x + 5, top - 9);
  g.lineTo(x + 8, top - 12);
  g.quadraticCurveTo(x + 7, top - 6, x + 6, top);
  g.closePath();
  g.fill();
  // bail handle
  g.strokeStyle = '#59646b';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(x - w / 2 + 0.5, top + 2);
  g.bezierCurveTo(x - w / 2 + 1, top - 14, x + w / 2 - 1, top - 14, x + w / 2 - 0.5, top + 2);
  g.stroke();
}

/** Picnic cooler: red body, white lid, chrome latch. Base at (x0..x1, y). */
export function paintCooler(g, x0, x1, y, h, body = '#c4412f') {
  const top = y - h;
  g.fillStyle = vgrad(g, top, y, [[0, shade(body, 0.12)], [0.7, body], [1, shade(body, -0.3)]]);
  roundRect(g, x0, top + 4, x1 - x0, h - 4, 2.5);
  g.fill();
  g.fillStyle = vgrad(g, top, top + 6, [[0, '#ffffff'], [1, '#d6dbde']]);
  roundRect(g, x0 - 1, top, x1 - x0 + 2, 6, 2.5);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 0.6;
  g.stroke();
  // handle + latch
  g.fillStyle = '#e8ecef';
  g.fillRect(x0 + (x1 - x0) * 0.42, top + 6, 6, 3);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x0 + 2, top + 8, x1 - x0 - 4, 1.4);
}

/** Green steel tackle box with a carry handle. */
export function paintTackleBox(g, x0, x1, y, h) {
  const top = y - h;
  const c = '#3e7a5a';
  g.fillStyle = vgrad(g, top, y, [[0, shade(c, 0.18)], [1, shade(c, -0.3)]]);
  roundRect(g, x0, top, x1 - x0, h, 2);
  g.fill();
  g.strokeStyle = 'rgba(10,30,20,0.5)';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(x0, top + 6);
  g.lineTo(x1, top + 6);
  g.stroke();
  // scuffs
  g.fillStyle = 'rgba(200,210,200,0.35)';
  g.fillRect(x0 + 3, top + 2, 5, 0.8);
  g.fillRect(x1 - 9, top + 12, 4, 0.8);
  // latch
  g.fillStyle = '#c9cfd2';
  g.fillRect((x0 + x1) / 2 - 2, top + 4.5, 4, 3);
  // handle
  g.strokeStyle = '#2b3a33';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(x0 + 6, top);
  g.bezierCurveTo(x0 + 6, top - 6, x1 - 6, top - 6, x1 - 6, top);
  g.stroke();
}

/** Coiled hemp rope seen from the side: stacked loops. */
export function paintCoil(g, cx, y, rx, loops) {
  for (let i = 0; i < loops; i++) {
    const yy = y - i * 2.6;
    const r = rx - i * 1.3;
    g.strokeStyle = '#7a5a33';
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(cx, yy, r, 2.6, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#d2b07a';
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(cx, yy, r, 2.6, 0, 0.1, Math.PI - 0.1);
    g.stroke();
    // twist marks
    g.strokeStyle = 'rgba(110,80,40,0.7)';
    g.lineWidth = 0.6;
    g.beginPath();
    for (let a = 0.3; a < Math.PI - 0.2; a += 0.38) {
      const px = cx + Math.cos(a) * r, py = yy + Math.sin(a) * 2.6;
      g.moveTo(px - 1, py - 1);
      g.lineTo(px + 1, py + 1);
    }
    g.stroke();
  }
}


// ── fibreglass helpers (tiers 1–2) ───────────────────────────────────────────
/** Polyline of a v-line (0 sheer … 1 keel) between u0..u1 → path. */
export function vlinePath(g, H, v, u0 = 0, u1 = 1, move = true) {
  const tp = { x: 0, y: 0 };
  const n = 60;
  for (let i = 0; i <= n; i++) {
    H.pt(lerp(u0, u1, i / n), v, tp);
    if (i === 0 && move) g.moveTo(tp.x, tp.y);
    else g.lineTo(tp.x, tp.y);
  }
}

/**
 * Glossy gelcoat hull side: base colour above the waterline, bottom paint below, boot stripe, sheer stripe,
 * sky reflection band and the wet waterline. o = { top, bottom, boot, stripe, stripeV:[v0,v1], gloss 0..1, x0, x1 }
 */
export function paintGelcoat(g, H, o) {
  const x0 = o.x0 ?? -300, x1 = o.x1 ?? 300;
  g.save();
  g.beginPath();
  H.outline(g);
  g.clip();
  // topsides: sky reflected in the upper hull, darker toward the turn of the bilge
  g.fillStyle = vgrad(g, -100, 0, [[0, shade(o.top, 0.1)], [0.35, shade(o.top, 0.04)], [0.55, shade(o.top, -0.06)], [0.8, shade(o.top, -0.02)], [1, shade(o.top, -0.16)]]);
  g.fillRect(x0, -140, x1 - x0, 140);
  // bottom paint
  g.fillStyle = vgrad(g, 0, 40, [[0, shade(o.bottom, 0.05)], [1, shade(o.bottom, -0.45)]]);
  g.fillRect(x0, -0.6, x1 - x0, 60);
  // sheer stripe(s)
  if (o.stripe) {
    g.beginPath();
    H.band(g, o.stripeV[0], o.stripeV[1]);
    g.fillStyle = o.stripe;
    g.fill();
    if (o.stripe2) {
      g.beginPath();
      H.band(g, o.stripeV[1] + 0.012, o.stripeV[1] + 0.03);
      g.fillStyle = o.stripe2;
      g.fill();
    }
  }
  // the long horizontal reflection of the sea & sky on a glossy hull
  const gl = o.gloss ?? 0.5;
  g.beginPath();
  H.band(g, 0.06, 0.2);
  g.fillStyle = `rgba(255,255,255,${0.18 * gl})`;
  g.fill();
  g.beginPath();
  H.band(g, 0.24, 0.26);
  g.fillStyle = `rgba(255,255,255,${0.35 * gl})`;
  g.fill();
  g.beginPath();
  H.band(g, 0.42, 0.62);
  g.fillStyle = `rgba(20,60,90,${0.12 * gl})`;
  g.fill();
  // bow & stern turn away
  g.fillStyle = lgrad(g, x0 + 40, 0, x1 - 30, 0, [[0, 'rgba(10,20,30,0.22)'], [0.1, 'rgba(10,20,30,0)'], [0.86, 'rgba(10,20,30,0)'], [1, 'rgba(10,20,30,0.18)']]);
  g.fillRect(x0, -140, x1 - x0, 200);
  // boot stripe + wet band
  g.fillStyle = o.boot;
  g.fillRect(x0, -5, x1 - x0, 4.4);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  g.fillRect(x0, -5, x1 - x0, 0.7);
  g.fillStyle = vgrad(g, -10, 3, [[0, 'rgba(10,20,25,0)'], [1, 'rgba(10,20,25,0.22)']]);
  g.fillRect(x0, -10, x1 - x0, 13);
  g.restore();
}

/** Stainless / white rub rail along the sheer. */
export function paintRail(g, H, base = '#e9edf0', insert = '#8c959c') {
  g.lineCap = 'round';
  g.strokeStyle = shade(base, -0.45);
  g.lineWidth = 4.4;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = H.S[i * 2], y = H.S[i * 2 + 1] + 1.8;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.strokeStyle = base;
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = insert;
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 0.7;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = H.S[i * 2], y = H.S[i * 2 + 1] + 0.7;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Stainless bow pulpit rail from x0 to the stem, h px above the sheer. */
export function paintBowRail(g, H, x0, x1, h, far = false) {
  const lift = far ? 0 : 0;
  g.strokeStyle = far ? '#9aa4ab' : '#d7dee3';
  g.lineWidth = far ? 1.2 : 1.6;
  g.lineCap = 'round';
  g.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    const y = H.sheerY(x) - h - lift - (far ? H.reveal(H.uAtX(x)) : 0);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.lineWidth = far ? 0.9 : 1.2;
  g.beginPath();
  for (let x = x0; x <= x1 - 8; x += 24) {
    const ys = H.sheerY(x) - (far ? H.reveal(H.uAtX(x)) : 0);
    g.moveTo(x, ys);
    g.lineTo(x, ys - h - lift);
  }
  g.stroke();
  if (!far) {
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 0.5;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      const y = H.sheerY(x) - h - 0.5;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

/** Glass pane (path already built by the caller): sky reflection, a diagonal glare, dark interior. */
export function paintGlass(g, x, y, w, h, tint = '#1d3346', glare = 0.5) {
  g.save();
  g.clip();
  g.fillStyle = vgrad(g, y, y + h, [[0, shade(tint, 0.55)], [0.45, shade(tint, 0.1)], [0.5, tint], [1, shade(tint, -0.35)]]);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = `rgba(255,255,255,${0.28 * glare})`;
  g.beginPath();
  g.moveTo(x + w * 0.15, y - 2);
  g.lineTo(x + w * 0.38, y - 2);
  g.lineTo(x + w * 0.1, y + h + 2);
  g.lineTo(x - w * 0.13, y + h + 2);
  g.closePath();
  g.fill();
  g.fillStyle = `rgba(255,255,255,${0.14 * glare})`;
  g.beginPath();
  g.moveTo(x + w * 0.46, y - 2);
  g.lineTo(x + w * 0.52, y - 2);
  g.lineTo(x + w * 0.3, y + h + 2);
  g.lineTo(x + w * 0.24, y + h + 2);
  g.closePath();
  g.fill();
  g.restore();
}

/** Modern outboard on the transom at (tx, ty): part 'leg' (behind the transom) or 'head'. */
export function paintModernOutboard(g, tx, ty, part, cowl = '#eef1f3', accent = '#1f3d66', scale = 1) {
  g.save();
  g.translate(tx, ty);
  g.scale(scale, scale);
  if (part === 'leg') {
    g.fillStyle = lgrad(g, -22, 0, -8, 0, [[0, '#2a2f34'], [0.5, '#5a636a'], [1, '#2b3035']]);
    g.beginPath();
    g.moveTo(-22, -4);
    g.lineTo(-8, -4);
    g.lineTo(-10, 62);
    g.lineTo(-20, 62);
    g.closePath();
    g.fill();
    g.fillStyle = '#3a4046';
    g.fillRect(-32, 58, 34, 3);
    g.fillStyle = lgrad(g, 0, 63, 0, 75, [[0, '#6b747b'], [1, '#2c3136']]);
    g.beginPath();
    g.ellipse(-15, 68, 16, 5.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#30363b';
    g.beginPath();
    g.moveTo(-19, 72);
    g.lineTo(-11, 72);
    g.lineTo(-14, 84);
    g.lineTo(-19, 83);
    g.closePath();
    g.fill();
    g.restore();
    return;
  }
  // bracket
  g.fillStyle = '#2b3035';
  g.beginPath();
  g.roundRect(-10, -8, 12, 16, 2);
  g.fill();
  // cowling
  g.fillStyle = lgrad(g, -48, 0, -2, 0, [[0, shade(cowl, -0.35)], [0.45, shade(cowl, 0.05)], [0.8, cowl], [1, shade(cowl, -0.22)]]);
  g.beginPath();
  g.moveTo(-44, -4);
  g.bezierCurveTo(-52, -18, -50, -46, -34, -50);
  g.bezierCurveTo(-20, -53, -8, -48, -5, -36);
  g.bezierCurveTo(-3, -24, -4, -10, -8, -4);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = accent;
  g.fillRect(-60, -24, 70, 7);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(-30, -42, 12, 4, -0.25, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = '#1e2226';
  g.fillRect(-45, -6, 40, 6);
  g.restore();
}
