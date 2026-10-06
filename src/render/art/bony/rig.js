// Bony-fish runtime rig — everything that runs PER FRAME. Sprites are painted once (kit.js) and cached by the
// kernel's unitSprite(); here they are blitted as a few sheared strips riding a travelling wave, with a handful
// of separately cached animated parts on top (pectoral fins, the lower jaw, a breathing gill slit).
import { TAU, clamp, damp } from '../../../core/math.js';
import { unitSprite, drawUnitSprite, variantFor } from '../common.js';

/** The body wave currently being drawn (one shared scratch object — no per-frame garbage). */
export const WAVE = { phase: 0, k: TAU, swing: 0, head: 0.1, power: 2, sq: 0, phase2: 0, k2: 0, swing2: 0 };
const POSE = { rot: 0, sx: 1, sy: 1, dx: 0, dy: 0, alpha: 1 };
/** Per-draw info handed to the custom hooks: strips, overlap, on-screen size, variant, flags, the main sprite. */
const INFO = { n: 10, ov: 1, lenPx: 100, v: 0, sil: false, card: false, base: null };

/** Vertical displacement (local px) of the body wave at unit x. */
export function waveY(w, xu) {
  const along = 0.5 - xu;
  const al = along < 0 ? 0 : along > 1 ? 1 : along;
  const e = w.head + (1 - w.head) * Math.pow(al, w.power);
  let y = Math.sin(w.phase - along * w.k) * e * w.swing;
  if (w.swing2) y += Math.sin(w.phase2 - along * w.k2) * e * w.swing2;
  return y;
}
/** Fore-aft shift (local px): the tail foreshortens as it sweeps toward / away from the viewer. */
export function waveX(w, xu) {
  if (!w.sq) return 0;
  const along = 0.5 - xu;
  const al = along < 0 ? 0 : along > 1 ? 1 : along;
  const c = Math.cos(w.phase - along * w.k);
  return w.sq * al * al * al * c * c;
}

/**
 * Blit a unit sprite as a swimming body: n strips, each SHEARED so neighbouring strips meet exactly (a continuous
 * piecewise-linear bend — no stair-steps even on a 600 px fish), denser toward the tail where the curvature is.
 * ov = strip overlap in local px (≈ 1 device px hides seams). yScale/yOrg squash the sprite vertically about a line
 * (used to raise / lower a sail that must still ride the same wave).
 */
export function blitSwim(ctx, spr, len, w, n, ov, yScale = 1, yOrg = 0) {
  const b = spr.box, res = spr.res, cv = spr.canvas;
  const s = len / res;
  const padU = spr.pad / res;
  const uL = b.x0 - padU, span = b.x1 - b.x0 + 2 * padU;
  const cw = cv.width, ch = cv.height;
  const y0 = yOrg + ((b.y0 - padU) * len - yOrg) * yScale, hh = ch * s * yScale;
  // When the fish is not pitched, strip boundaries are snapped to device pixels: neighbours then share an exact
  // edge (no seam, no overlap, translucent fins stay clean). Otherwise fall back to a sub-pixel overlap.
  const m = ctx.getTransform();
  const snap = m.b === 0 && m.c === 0 && m.a !== 0;
  const ma = m.a, me = m.e;
  if (snap) ov = 0;
  let slPrev = 0, oPrev = 0, sxa = 0;
  let Xa = uL * len + waveX(w, uL), Da = waveY(w, uL);
  ctx.save();
  for (let j = 1; j <= n; j++) {
    const f = j / n;
    const ub = uL + span * (f < 1 ? Math.pow(f, 1.4) : 1);
    let Xb = ub * len + waveX(w, ub);
    if (snap && j < n) Xb = (Math.round(ma * Xb + me) - me) / ma;
    const Db = waveY(w, ub);
    const dw = Xb - Xa;
    if (dw * ma * (ma < 0 ? -1 : 1) < 0.5 && j < n) continue;
    const sl = (Db - Da) / dw, o = Da - sl * Xa;
    ctx.transform(1, sl - slPrev, 0, 1, 0, o - oPrev);
    slPrev = sl;
    oPrev = o;
    const sxb = ((ub - uL) / span) * cw;
    const sw = sxb - sxa;
    const ex = j < n ? ov : 0;
    ctx.drawImage(cv, sxa, 0, Math.min(cw - sxa, sw + (ex * sw) / dw), ch, Xa, y0, dw + ex, hh);
    Xa = Xb;
    Da = Db;
    sxa = sxb;
  }
  ctx.restore();
}

/**
 * Per-individual animation memory (smoothing of state changes so nothing pops), keyed by anim.uid.
 * uid 0 (UI icons) never remembers anything. `st.fresh` is true when the entry has no usable history
 * (first sighting, or not drawn for a while) → snap to targets; otherwise ease with `st.dt`.
 */
export function makeStore(init) {
  const map = new Map();
  const icon = init();
  let calls = 0;
  return (anim) => {
    const uid = anim.uid | 0;
    let st;
    if (!uid) {
      st = icon;
      st.fresh = true;
      st.dt = 0;
    } else {
      st = map.get(uid);
      if (!st) {
        st = init();
        st.fresh = true;
        st.dt = 0;
        map.set(uid, st);
      } else {
        const dt = anim.t - st.t;
        st.fresh = dt < 0 || dt > 1.5;
        st.dt = st.fresh ? 0 : dt > 0.1 ? 0.1 : dt;
      }
      if (++calls > 600) {
        calls = 0;
        for (const [k, v] of map) if (Math.abs(anim.t - v.t) > 8) map.delete(k);
      }
    }
    st.t = anim.t;
    return st;
  };
}
/** Ease st[key] toward target (snaps when the entry is fresh). */
export function ease(st, key, target, rate) {
  st[key] = st.fresh ? target : damp(st[key], target, rate, st.dt);
  return st[key];
}

/**
 * Pectoral-fin pose generator.
 * o: { rest=0 (radians, + = tip swings down/back), amp=0.25 (stroke angle), rate=2.4 (strokes/s·2π when hovering),
 *      lock=0 (>0: stroke locked to the tail-beat phase × lock — fish that row with their pectorals),
 *      squash=0.25 (how much the fin foreshortens through the stroke), fold=0 (extra rotation toward the body at speed) }
 *      (rigid hydroplane fins, e.g. tunas: amp ≈ 0.03, squash ≈ 0.05)
 */
export function scull(o = {}) {
  const rest = o.rest || 0, amp = o.amp === undefined ? 0.25 : o.amp, rate = o.rate || 2.4;
  const lock = o.lock || 0, squash = o.squash === undefined ? 0.25 : o.squash, fold = o.fold || 0;
  return (anim, st, out) => {
    const ph = lock ? anim.phase * lock + 0.6 : anim.t * rate + anim.uid * 1.37;
    const sp = clamp((anim.amp - 0.3) / 0.9, 0, 1);
    const k = lock ? 0.45 + 0.55 * clamp(anim.amp, 0, 1.3) : 1 - 0.55 * sp;
    const hk = st.hook || 0;
    out.rot = rest + amp * k * Math.sin(ph) + fold * sp + hk * 0.25 * Math.sin(anim.t * 17 + anim.uid);
    out.sx = 1 - squash * (0.5 + 0.5 * Math.cos(ph + 0.9)) * k - fold * sp * 0.25;
    out.sy = 1;
  };
}

const variantOf = (seed, n) => {
  const v = (seed * n) | 0;
  return v < 0 ? 0 : v >= n ? n - 1 : v;
};

/**
 * Build a drawer ({ draw, bounds, mouth }) for a "standard" fish from a definition:
 *   id, bounds, mouth
 *   box            unit-space rect the main sprite must contain (defaults to bounds, padded)
 *   variants=3     how many seed variants to cache
 *   paint(g, res, v)                  main sprite: body + median fins (+ anything that should ride the body wave)
 *   swim           { swing=0.05 (tail-tip travel × len at amp 1), waves=1.1, power=2 (how late the bend starts), head=0.1,
 *                    squash=0.02, freq=1 (tail-beat multiplier), idle=0.06 (wave that remains when hovering),
 *                    thrash=1 (how wildly it fights), strips }
 *   parts          [{ key, box, pivot:[x,y], paint(g,res,v), pose(anim,st,out), behind?, swim? }]
 *                    rigid sprites posed about a pivot that rides the body wave (pectorals…); swim:true → blitted along
 *                    the same wave instead, with pose.sy scaling about the pivot's y (sails, streamers)
 *   jaw            { hinge:[x,y], tip:[x,y], corner?:[x,y], depth, gape (radians at mouth = 1), rest=0 (mouth never closes past this),
 *                    cavity='#2a0a10', paint?(g,res) extra (teeth) }  — the lower jaw is cut from the main sprite and hinged
 *   gillSlit       { x, y0, y1, bulge, sweep, col, w, rate }  dark slit that breathes behind the gill cover
 *   state(st, anim)                   extra per-individual easing (st.hook 0..1 is always maintained)
 *   under / over(ctx, len, anim, opts, st, wave, R)   custom live drawing before / after the body. R = { n (strips), ov (overlap),
 *                    lenPx, v (variant), sil, card, base (the uncoloured main sprite) } — e.g. blitSwim(ctx, extraSprite, len, wave, R.n, R.ov)
 *   tune(anim, st, wave, len)         last-minute changes to the wave (species-specific gaits)
 */
export function fishDrawer(def) {
  const id = def.id;
  const nVar = def.variants || 3;
  const b = def.bounds;
  const box = def.box || { x0: b.x0 - 0.01, x1: b.x1 + 0.01, y0: b.y0 - 0.01, y1: b.y1 + 0.01 };
  const S = Object.assign({ swing: 0.05, waves: 1.1, power: 2, head: 0.1, squash: 0.02, freq: 1, idle: 0.06, thrash: 1 }, def.swim);
  const store = makeStore(() => ({ t: 0, dt: 0, fresh: true, hook: 0 }));
  const keys = [], paints = [];
  for (let v = 0; v < nVar; v++) {
    keys.push(`${id}/b${v}`);
    paints.push((g, res) => def.paint(g, res, v));
  }
  const parts = (def.parts || []).map((p) => ({
    ...p,
    keys: paints.map((_, v) => `${id}/${p.key}${v}`),
    paints: paints.map((_, v) => (g, res) => p.paint(g, res, v)),
  }));

  // lower jaw: a wedge of the main sprite, re-drawn rotated about the hinge
  const J = def.jaw || null;
  let jawPoly = null, jawBox = null, jawBase = null;
  const jawKeys = keys.map((k) => k + '/jaw');
  if (J) {
    const [hx, hy] = J.hinge, [tx, ty] = J.tip;
    const c = J.corner || [hx + (tx - hx) * 0.3, hy + (ty - hy) * 0.3];
    const d = J.depth || 0.05;
    jawPoly = [[hx, hy], c, [tx, ty], [tx + 0.012, ty + d * 0.25], [tx - (tx - hx) * 0.2, ty + d * 0.9], [hx + (tx - hx) * 0.35, hy + d * 1.5], [hx, hy + d * 1.7]];
    if (J.poly) jawPoly = J.poly;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of jawPoly) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const m = J.margin || 0.012;
    jawBox = { x0: x0 - m, x1: x1 + m, y0: y0 - m, y1: y1 + m };
  }
  const jawPaint = (g, res) => {
    g.save();
    g.beginPath();
    for (let i = 0; i < jawPoly.length; i++) g[i ? 'lineTo' : 'moveTo'](jawPoly[i][0], jawPoly[i][1]);
    g.closePath();
    g.clip();
    drawUnitSprite(g, jawBase, 1);
    g.restore();
    if (J.paint) J.paint(g, res);
  };

  function drawPart(ctx, p, v, len, lenPx, anim, opts, st, n, ov) {
    const spr = variantFor(unitSprite(p.keys[v], p.box, lenPx, p.paints[v]), opts);
    POSE.rot = 0;
    POSE.sx = 1;
    POSE.sy = 1;
    POSE.dx = 0;
    POSE.dy = 0;
    POSE.alpha = 1;
    if (p.pose) p.pose(anim, st, POSE);
    if (POSE.alpha <= 0.01) return;
    const ga = ctx.globalAlpha;
    if (POSE.alpha < 1) ctx.globalAlpha = ga * POSE.alpha;
    if (p.swim) {
      blitSwim(ctx, spr, len, WAVE, n, ov, POSE.sy, p.pivot[1] * len);
    } else {
      const px = p.pivot[0], py = p.pivot[1];
      ctx.save();
      ctx.translate(px * len + waveX(WAVE, px) + POSE.dx * len, py * len + waveY(WAVE, px) + POSE.dy * len);
      if (POSE.rot) ctx.rotate(POSE.rot);
      if (POSE.sx !== 1 || POSE.sy !== 1) ctx.scale(POSE.sx, POSE.sy);
      ctx.translate(-px * len, -py * len);
      drawUnitSprite(ctx, spr, len);
      ctx.restore();
    }
    ctx.globalAlpha = ga;
  }

  function draw(ctx, len, anim, opts) {
    const pxs = opts.pxScale || 1;
    const lenPx = len * pxs;
    const sil = !!opts.silhouette;
    const st = store(anim);
    const hooked = anim.hooked || anim.state === 'hooked' || anim.state === 'jump';
    const hk = ease(st, 'hook', hooked ? 1 : 0, hooked ? 8 : 3);
    if (def.state) def.state(st, anim);
    const v = variantOf(anim.seed, nVar);
    const base = unitSprite(keys[v], box, lenPx, paints[v]);
    const main = variantFor(base, opts);

    const turn = Math.abs(anim.turn);
    const tk = 0.3 + 0.7 * (turn > 1 ? 1 : turn);
    const amp = clamp(anim.amp, 0, 1.6);
    const w = WAVE;
    w.phase = anim.phase * S.freq;
    w.k = S.waves * TAU;
    w.head = S.head;
    w.power = S.power;
    w.swing = S.swing * len * (amp * (1 + 0.5 * hk * S.thrash) + S.idle) * tk;
    w.sq = S.squash * len * (amp > 1.2 ? 1.2 : amp) * tk;
    if (hk > 0.01) {
      w.swing2 = S.swing * len * 0.45 * hk * S.thrash * tk;
      w.phase2 = anim.t * 23 + anim.uid * 1.9;
      w.k2 = w.k * 0.7;
    } else w.swing2 = 0;
    if (def.tune) def.tune(anim, st, w, len);

    const card = opts.detail === 'card';
    const n = S.strips || (card ? 18 : lenPx > 420 ? 14 : lenPx > 110 ? 10 : 7);
    const ov = 0.9 / (pxs * (turn < 0.25 ? 0.25 : turn > 1 ? 1 : turn));
    const R = INFO;
    R.n = n;
    R.ov = ov;
    R.lenPx = lenPx;
    R.v = v;
    R.sil = sil;
    R.card = card;
    R.base = base;

    ctx.save();
    if (hk > 0.01) ctx.rotate(Math.sin(anim.t * 12.7 + anim.uid) * 0.055 * hk * S.thrash);
    if (def.under) def.under(ctx, len, anim, opts, st, w, R);
    for (let i = 0; i < parts.length; i++) if (parts[i].behind) drawPart(ctx, parts[i], v, len, lenPx, anim, opts, st, n, ov);
    blitSwim(ctx, main, len, w, n, ov);

    // breathing: a dark slit opening and closing behind the gill cover
    const G = def.gillSlit;
    if (G && !sil && lenPx > 90) {
      const br = 0.5 + 0.5 * Math.sin(anim.t * (G.rate || 2.3) * (1 + 1.6 * hk) + anim.uid * 0.7);
      const gx = G.x * len + waveX(w, G.x), dy = waveY(w, G.x);
      const bl = (G.bulge === undefined ? 0.03 : G.bulge) * len;
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * (0.03 + 0.2 * br);
      ctx.strokeStyle = G.col || '#3a0d16';
      ctx.lineWidth = len * (G.w || 0.0036) * (0.5 + 0.9 * br);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - bl * 0.12, G.y0 * len + dy);
      ctx.quadraticCurveTo(gx - bl * 2.12, ((G.y0 + G.y1) / 2) * len + dy, gx + bl * (G.sweep === undefined ? 0.5 : G.sweep) - bl * 0.12, G.y1 * len + dy);
      ctx.stroke();
      ctx.globalAlpha = ga;
    }

    // jaw
    if (J && !sil) {
      let m = anim.mouth > 1 ? 1 : anim.mouth;
      const gasp = hk * (0.55 + 0.4 * Math.sin(anim.t * 6.3 + anim.uid));
      if (gasp > m) m = gasp;
      const rest = J.rest || 0;
      m = rest + (1 - rest) * m;
      if (m > 0.02) {
        const ang = m * J.gape;
        const hx = J.hinge[0], hy = J.hinge[1];
        const ox = waveX(w, hx), oy = waveY(w, hx);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const X = hx * len + ox, Y = hy * len + oy;
        // mouth cavity: the wedge swept between the closed and the open jaw line
        ctx.fillStyle = J.cavity || '#2a0a10';
        ctx.beginPath();
        ctx.moveTo(X, Y);
        for (let i = 1; i <= 2; i++) ctx.lineTo(jawPoly[i][0] * len + ox, jawPoly[i][1] * len + oy);
        const tx = (jawPoly[2][0] - hx) * len, ty = (jawPoly[2][1] - hy) * len;
        const r = Math.hypot(tx, ty), a0 = Math.atan2(ty, tx);
        ctx.arc(X, Y, r, a0, a0 + ang);
        const cx = (jawPoly[1][0] - hx) * len, cy = (jawPoly[1][1] - hy) * len;
        ctx.lineTo(X + cx * ca - cy * sa, Y + cx * sa + cy * ca);
        ctx.closePath();
        ctx.fill();
        if (J.throat && m > 0.25) {
          // a glimpse of gill arches / tongue deep in the mouth
          const ga = ctx.globalAlpha;
          ctx.globalAlpha = ga * clamp((m - 0.25) * 1.6, 0, 0.75);
          ctx.fillStyle = J.throat;
          ctx.beginPath();
          const a1 = a0 + ang * 0.5;
          ctx.ellipse(X + Math.cos(a1) * r * 0.52, Y + Math.sin(a1) * r * 0.52, r * 0.3, r * Math.sin(ang * 0.5) * 0.36, a1, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = ga;
        }
        jawBase = base;
        const jaw = variantFor(unitSprite(jawKeys[v], jawBox, lenPx, jawPaint), opts);
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(ang);
        ctx.translate(-hx * len, -hy * len);
        drawUnitSprite(ctx, jaw, len);
        ctx.restore();
      }
    }
    for (let i = 0; i < parts.length; i++) if (!parts[i].behind) drawPart(ctx, parts[i], v, len, lenPx, anim, opts, st, n, ov);
    if (def.over) def.over(ctx, len, anim, opts, st, w, R);
    ctx.restore();
  }

  return { draw, bounds: def.bounds, mouth: def.mouth };
}

export { variantOf };
