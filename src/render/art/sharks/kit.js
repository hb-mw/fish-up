// Shared painting + animation kit for the SHARKS art set (sharks, rays, eels, deep-sea fish).
// Everything here is either (a) used once while painting a cached sprite (quality over speed), or
// (b) a tight per-frame blitter (no allocations).
import { TAU, clamp } from '../../../core/math.js';
import { createRng, hashStr, hash2 } from '../../../core/rng.js';
import { makeCanvas, spriteVariant } from '../common.js';

export { TAU, clamp };

/** Deterministic rng for a painter (same key → same pattern every time the sprite is (re)painted). */
export const rngFor = (key) => createRng(hashStr(key));

/** Quantise anim.seed (0..1) into n stable variants. */
export const variantOf = (seed, n) => Math.min(n - 1, Math.max(0, Math.floor((Number(seed) || 0) * n)));

/** Level of detail from sprite resolution (device px per unit length). */
export const lod = (res) => (res >= 900 ? 3 : res >= 420 ? 2 : res >= 150 ? 1 : 0);

export const SIL = '#0f1c2b';

// ── paths ───────────────────────────────────────────────────────────────────────────────────────
function segCtrl(p0, p1, p2, p3, t) {
  return [
    p1[0] + ((p2[0] - p0[0]) * t) / 6,
    p1[1] + ((p2[1] - p0[1]) * t) / 6,
    p2[0] - ((p3[0] - p1[0]) * t) / 6,
    p2[1] - ((p3[1] - p1[1]) * t) / 6,
  ];
}

/** Open Catmull-Rom spline through pts ([[x,y],…]) as cubic Béziers. move=false continues the current path. */
export function spline(ctx, pts, move = true, t = 1) {
  const n = pts.length;
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const c = segCtrl(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n - 1, i + 2)], t);
    ctx.bezierCurveTo(c[0], c[1], c[2], c[3], pts[i + 1][0], pts[i + 1][1]);
  }
}

/**
 * Closed shape through points. A point [x, y, 1] is a sharp corner; the rest are smooth.
 * (Fins: corners at the tip and where the base enters the body.)
 */
export function shape(ctx, pts, t = 1) {
  const n = pts.length;
  let start = pts.findIndex((p) => p[2]);
  if (start < 0) {
    // fully smooth closed loop
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const c = segCtrl(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n], t);
      ctx.bezierCurveTo(c[0], c[1], c[2], c[3], pts[(i + 1) % n][0], pts[(i + 1) % n][1]);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(pts[start][0], pts[start][1]);
  let run = [pts[start]];
  for (let k = 1; k <= n; k++) {
    const p = pts[(start + k) % n];
    run.push(p);
    if (p[2] || k === n) {
      if (run.length === 2) ctx.lineTo(p[0], p[1]);
      else {
        for (let i = 0; i < run.length - 1; i++) {
          const c = segCtrl(run[Math.max(0, i - 1)], run[i], run[i + 1], run[Math.min(run.length - 1, i + 2)], t);
          ctx.bezierCurveTo(c[0], c[1], c[2], c[3], run[i + 1][0], run[i + 1][1]);
        }
      }
      run = [p];
    }
  }
  ctx.closePath();
}

/** Sample an open Catmull-Rom spline into a polyline. */
export function sampleSpline(pts, per = 20, t = 1) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const c = segCtrl(pts[Math.max(0, i - 1)], p1, p2, pts[Math.min(n - 1, i + 2)], t);
    for (let k = 0; k < per; k++) {
      const s = k / per, u = 1 - s;
      out.push([
        u * u * u * p1[0] + 3 * u * u * s * c[0] + 3 * u * s * s * c[2] + s * s * s * p2[0],
        u * u * u * p1[1] + 3 * u * u * s * c[1] + 3 * u * s * s * c[3] + s * s * s * p2[1],
      ]);
    }
  }
  out.push([pts[n - 1][0], pts[n - 1][1]]);
  return out;
}

function lookupTable(poly, x0, x1, N) {
  // poly runs in any x order; build y(x) on a uniform grid by linear interpolation
  const pts = poly.slice().sort((a, b) => a[0] - b[0]);
  const tab = new Float32Array(N + 1);
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N;
    while (j < pts.length - 2 && pts[j + 1][0] < x) j++;
    const a = pts[j], b = pts[j + 1] || a;
    const k = b[0] === a[0] ? 0 : clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
    tab[i] = a[1] + (b[1] - a[1]) * k;
  }
  return tab;
}

/**
 * Body profile from a dorsal and a ventral control polyline, both running from the snout tip (max x) to
 * the tail end (min x) and sharing the first point. Gives top(x)/bot(x) lookups for painting bands that
 * follow the body, and the outline path.
 */
export function makeProfile(topPts, botPts, t = 1) {
  const ts = sampleSpline(topPts, 24, t), bs = sampleSpline(botPts, 24, t);
  const x1 = topPts[0][0];
  const x0 = Math.max(topPts[topPts.length - 1][0], botPts[botPts.length - 1][0]);
  const N = 400;
  const tt = lookupTable(ts, x0, x1, N), bt = lookupTable(bs, x0, x1, N);
  const at = (tab, x) => {
    const f = clamp(((x - x0) / (x1 - x0)) * N, 0, N);
    const i = Math.min(N - 1, Math.floor(f));
    return tab[i] + (tab[i + 1] - tab[i]) * (f - i);
  };
  const prof = {
    x0, x1, topPts, botPts, t,
    top: (x) => at(tt, x),
    bot: (x) => at(bt, x),
    h: (x) => at(bt, x) - at(tt, x),
    /** y at fraction f of the local height (0 = dorsal edge, 1 = ventral edge) */
    at: (x, f) => at(tt, x) + (at(bt, x) - at(tt, x)) * f,
    outline(ctx) {
      spline(ctx, topPts, true, t);
      const rb = botPts.slice().reverse();
      spline(ctx, rb, false, t);
      ctx.closePath();
    },
  };
  return prof;
}

/**
 * Path of a band that follows the body: between fraction fa(x) and fb(x) of the local height,
 * from x = xa (front) to xb (back). fa/fb: numbers or functions of x. ext extends the band beyond the
 * outline (units) on the dorsal/ventral side so soft edges are not starved at the silhouette.
 */
export function band(ctx, prof, xa, xb, fa, fb, steps = 48, jitter = null) {
  const A = typeof fa === 'function' ? fa : () => fa;
  const B = typeof fb === 'function' ? fb : () => fb;
  for (let i = 0; i <= steps; i++) {
    const x = xa + ((xb - xa) * i) / steps;
    const y = prof.at(x, A(x)) + (jitter ? jitter(x, 0) : 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const x = xa + ((xb - xa) * i) / steps;
    ctx.lineTo(x, prof.at(x, B(x)) + (jitter ? jitter(x, 1) : 0));
  }
  ctx.closePath();
}

// ── soft painting (cache-time only) ─────────────────────────────────────────────────────────────
const OFF = 12000;
/**
 * Fill a path with a solid colour and a soft (blurred) edge, using the shadow trick: the shape itself is
 * drawn far off-canvas and only its blurred shadow lands in place. Works in every browser.
 * blur in UNITS (converted to device px with res). Honours the current clip.
 */
export function soft(g, res, blur, color, build) {
  const px = blur * res;
  g.save();
  g.beginPath();
  if (px < 0.7) {
    build(g);
    g.fillStyle = color;
    g.fill();
    g.restore();
    return;
  }
  const m = g.getTransform();
  g.setTransform(m.a, m.b, m.c, m.d, m.e - OFF, m.f);
  build(g);
  g.shadowColor = color;
  g.shadowBlur = px * 2;
  g.shadowOffsetX = OFF;
  g.shadowOffsetY = 0;
  g.fillStyle = '#000';
  g.fill();
  g.restore();
}

/** Like soft() but strokes the built path (soft lines: scars, rims, creases). */
export function softStroke(g, res, blur, color, width, build) {
  const px = blur * res;
  g.save();
  g.beginPath();
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (px < 0.7) {
    build(g);
    g.strokeStyle = color;
    g.stroke();
    g.restore();
    return;
  }
  const m = g.getTransform();
  g.setTransform(m.a, m.b, m.c, m.d, m.e - OFF, m.f);
  build(g);
  g.shadowColor = color;
  g.shadowBlur = px * 2;
  g.shadowOffsetX = OFF;
  g.strokeStyle = '#000';
  g.stroke();
  g.restore();
}

/**
 * Offscreen layer with the same size + transform as g (cache-time only): paint into it, post-process it
 * (e.g. fade an edge with destination-out), then composite it back with putLayer.
 */
export function makeLayer(g) {
  const c = makeCanvas(g.canvas.width, g.canvas.height);
  const l = c.getContext('2d');
  l.setTransform(g.getTransform());
  l.lineJoin = 'round';
  l.lineCap = 'round';
  return l;
}
export function putLayer(g, l, op) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (op) g.globalCompositeOperation = op;
  g.drawImage(l.canvas, 0, 0);
  g.restore();
}
/** Fade a layer out horizontally between unit x a (opaque) and b (transparent). */
export function fadeX(l, a, b, box) {
  l.save();
  l.globalCompositeOperation = 'destination-out';
  const gr = l.createLinearGradient(a, 0, b, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,1)');
  l.fillStyle = gr;
  // the gradient clamps beyond b, so everything past b is erased completely
  if (b < a) l.fillRect(box.x0 - 1, box.y0 - 1, a - box.x0 + 1, box.y1 - box.y0 + 2);
  else l.fillRect(a, box.y0 - 1, box.x1 - a + 1, box.y1 - box.y0 + 2);
  l.restore();
}

/** Run fn with the clip set to the path built by build. */
export function clipTo(g, build, fn) {
  g.save();
  g.beginPath();
  build(g);
  g.clip();
  fn();
  g.restore();
}

// ── textures ────────────────────────────────────────────────────────────────────────────────────
const fade = (t) => t * t * (3 - 2 * t);
function pnoise(x, y, p, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (i, j) => hash2((((i % p) + p) % p) + seed * 131, (((j % p) + p) % p) + seed * 71);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const tiles = new Map();
/**
 * Tileable grey noise canvas. kind: 'mottle' (soft blotches) | 'grain' (fine) | 'cells' (spotty).
 */
export function noiseTile(kind = 'mottle') {
  let c = tiles.get(kind);
  if (c) return c;
  const S = kind === 'grain' ? 128 : 256;
  c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const oct = kind === 'grain' ? [32, 64, 128] : kind === 'cells' ? [12, 24] : [4, 8, 16, 32];
  const seed = kind.length * 7;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = 0, a = 0.5, norm = 0;
      for (let o = 0; o < oct.length; o++) {
        const p = oct[o];
        v += a * pnoise((x / S) * p, (y / S) * p, p, seed + o);
        norm += a;
        a *= 0.55;
      }
      v /= norm;
      if (kind === 'cells') v = clamp((v - 0.45) * 3.2 + 0.5, 0, 1);
      else v = clamp((v - 0.5) * 2.2 + 0.5, 0, 1);
      const i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  tiles.set(kind, c);
  return c;
}

/** Fill the current clip with a tiled texture blended into what is there (soft-light by default). */
export function texture(g, kind, unitsPerTile, alphaV, box, op = 'soft-light', stretchX = 1, offset = 0) {
  const tile = noiseTile(kind);
  const pat = g.createPattern(tile, 'repeat');
  if (!pat) return;
  const s = unitsPerTile / tile.width;
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([s * stretchX, 0, 0, s, offset, offset * 0.7]));
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alphaV;
  g.fillStyle = pat;
  g.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  g.restore();
}

// ── colour ──────────────────────────────────────────────────────────────────────────────────────
export function hex(h) {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
/** Mix two '#hex' colours, return css (with optional alpha). */
export function mixc(a, b, t, al = 1) {
  const p = hex(a), q = hex(b);
  return rgba([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t], al);
}
export const ca = (h, a) => rgba(hex(h), a);
/** Shift a hex colour's brightness (k > 1 lighter toward white, k < 1 darker) → hex. */
export function shade(h, k) {
  const c = hex(h);
  const f = (v) => (k >= 1 ? v + (255 - v) * (k - 1) : v * k);
  const r = c.map((v) => clamp(Math.round(f(v)), 0, 255));
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ── glow sprites (additive pass) ────────────────────────────────────────────────────────────────
const glows = new Map();
/** Radial glow dot: white-hot core fading through `color` to transparent. Drawn with drawImage(x−r, y−r, 2r, 2r). */
export function glowDot(color, core = 0.18) {
  const key = color + core;
  let c = glows.get(key);
  if (c) return c;
  const S = 64;
  c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const rgb = hex(color);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, `rgba(255,255,255,1)`);
  gr.addColorStop(core, rgba(rgb.map((v) => v + (255 - v) * 0.55), 0.95));
  gr.addColorStop(core * 2.2, rgba(rgb, 0.5));
  gr.addColorStop(0.62, rgba(rgb, 0.12));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  glows.set(key, c);
  return c;
}
/** Soft halo only (no hot core). */
export function haloDot(color) {
  const key = 'halo' + color;
  let c = glows.get(key);
  if (c) return c;
  const S = 96;
  c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const rgb = hex(color);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, rgba(rgb, 0.55));
  gr.addColorStop(0.25, rgba(rgb, 0.3));
  gr.addColorStop(0.55, rgba(rgb, 0.1));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  glows.set(key, c);
  return c;
}

// ── per-frame blitters ──────────────────────────────────────────────────────────────────────────
/**
 * Swim parameters → displacement of the body at unit x (local px), the same formula swimBlit uses.
 * o: { swing (× len at amp 1), waves, power, rigid (unit x ahead of which the body is rigid), tail (unit x of the tail tip) }
 */
export function swimDy(x, len, phase, amp, o) {
  const rigid = o.rigid !== undefined ? o.rigid : 0.2;
  const tail = o.tail !== undefined ? o.tail : -0.5;
  const along = Math.max(0, (rigid - x) / (rigid - tail));
  if (along <= 0) return 0;
  const e = Math.pow(Math.min(along, 1.25), o.power || 1.8);
  return Math.sin(phase - along * (o.waves || 1) * TAU) * e * (o.swing || 0.04) * len * clamp(amp, 0, 1.6);
}
/** Local slope (radians) of the swim wave at unit x — for attachments that should tilt with the body. */
export function swimSlope(x, len, phase, amp, o) {
  const d = 0.01;
  return Math.atan2(swimDy(x - d, len, phase, amp, o) - swimDy(x + d, len, phase, amp, o), 2 * d * len) * -1;
}

/**
 * Blit a unit sprite as a swimming body: vertical strips ride a travelling wave behind o.rigid; strips near
 * the tail foreshorten as the tail sweeps toward / away from the camera (lateral beat seen side-on).
 * Same idea as common.drawUnitSpriteSwim, plus: rigid head (attachments need no tracking), seam-free strip
 * overlap in DEVICE px (pxs = device px per local px horizontally), and strip count from on-screen size.
 * o: { swing, waves, power, rigid, tail, squash (0..1), strips (max) }
 */
export function swimBlit(ctx, spr, len, phase, amp, o, pxs) {
  const b = spr.box;
  const a = clamp(amp, 0, 1.6);
  const s = len / spr.res; // local px per sprite px
  const cw = spr.canvas.width, chh = spr.canvas.height;
  const padU = spr.pad / spr.res;
  const uLeft = b.x0 - padU, uRight = b.x1 + padU;
  const y0 = b.y0 * len - spr.pad * s;
  const dh = chh * s;
  const squash = o.squash !== undefined ? o.squash : 0.4;
  const rigid = Math.min(o.rigid !== undefined ? o.rigid : 0.2, uRight);
  const tail = o.tail !== undefined ? o.tail : -0.5;
  const waves = o.waves || 1;
  const power = o.power || 1.8;
  const swing = (o.swing || 0.04) * len * a;
  const ov = 1 / Math.max(0.02, pxs); // ≈1 device px of overlap between pieces
  // 1) the rigid front in a single blit
  const colR = (rigid - uLeft) * spr.res;
  if (colR < cw) ctx.drawImage(spr.canvas, colR, 0, cw - colR, chh, rigid * len, y0, (cw - colR) * s, dh);
  // 2) the bending rear: strips sheared so neighbouring edges meet (piecewise-linear, no stair-steps)
  const span = rigid - uLeft;
  if (span <= 0) return;
  const n = Math.max(len * pxs < 70 ? 2 : 3, Math.min(o.strips || 24, Math.round((span * len * pxs) / (o.stripPx || 9))));
  const stepU = span / n;
  const sw = stepU * spr.res;
  let right = rigid * len;
  let dyR = 0;
  for (let i = 0; i < n; i++) {
    const uL = rigid - stepU * (i + 1);
    const alL = (rigid - uL) / (rigid - tail);
    const angL = phase - alL * waves * TAU;
    const dyL = Math.sin(angL) * Math.pow(Math.min(alL, 1.25), power) * swing;
    const alC = (rigid - (uL + stepU * 0.5)) / (rigid - tail);
    const cC = Math.cos(phase - alC * waves * TAU);
    const k = 1 - squash * 0.5 * Math.pow(Math.min(alC, 1), 2.2) * cC * cC * Math.min(a, 1.2);
    const dw = stepU * len * k;
    const xL = right - dw;
    const sl = (dyR - dyL) / dw;
    const c = dyL - sl * xL;
    ctx.transform(1, sl, 0, 1, 0, c);
    ctx.drawImage(spr.canvas, (uL - uLeft) * spr.res, 0, sw * (1 + ov / dw), chh, xL, y0, dw + ov, dh);
    ctx.transform(1, -sl, 0, 1, 0, -c);
    right = xL;
    dyR = dyL;
  }
}

/** Horizontal device-px scale of the current fish draw (the registry squashes x while turning). */
export const pxsOf = (anim, opts) => (opts.pxScale || 1) * Math.max(0.14, Math.abs(anim.turn === undefined ? 1 : anim.turn));

/** Blit a unit sprite rigidly, rotated by ang about unit point (px, py), optional extra offset (local px). */
export function blitAbout(ctx, spr, len, px, py, ang, dx = 0, dy = 0, sx = 1, sy = 1) {
  ctx.save();
  ctx.translate(px * len + dx, py * len + dy);
  if (ang) ctx.rotate(ang);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.translate(-px * len, -py * len);
  const b = spr.box, s = len / spr.res;
  ctx.drawImage(spr.canvas, b.x0 * len - spr.pad * s, b.y0 * len - spr.pad * s, spr.canvas.width * s, spr.canvas.height * s);
  ctx.restore();
}

/**
 * Bend a straight unit sprite along a spine (eels, oarfish): the sprite is cut into n vertical strips and each
 * strip is placed at its spine point, rotated to the local tangent. spine: Float32Array [x0,y0,ang0, x1,y1,ang1 …]
 * (local px, radians) for the strip centres from the sprite's left edge to its right edge.
 */
export function spineBlit(ctx, spr, len, spine, n, pxs) {
  const s = len / spr.res;
  const cw = spr.canvas.width, chh = spr.canvas.height;
  const sw = cw / n;
  const dw = sw * s;
  const ov = 1.1 / Math.max(0.02, pxs);
  const b = spr.box;
  const yTop = b.y0 * len - spr.pad * s;
  const dh = chh * s;
  for (let i = 0; i < n; i++) {
    const x = spine[i * 3], y = spine[i * 3 + 1], ang = spine[i * 3 + 2];
    const c = Math.cos(ang), sn = Math.sin(ang);
    ctx.save();
    ctx.transform(c, sn, -sn, c, x, y);
    ctx.drawImage(spr.canvas, i * sw, 0, sw, chh, -dw / 2 - ov * 0.5, yTop, dw + ov, dh);
    ctx.restore();
  }
}

/**
 * Like common.variantFor, but the silhouette is SOLID: translucent fin membranes are built up (drawn 3×) before
 * the flat fill, so an undiscovered Fishdex entry shows a clean shape instead of ghostly fin rays.
 */
export function look(spr, opts) {
  if (opts && opts.silhouette) {
    if (!spr._silSolid) {
      const c = makeCanvas(spr.canvas.width, spr.canvas.height);
      const g = c.getContext('2d');
      for (let i = 0; i < 3; i++) g.drawImage(spr.canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = SIL;
      g.fillRect(0, 0, c.width, c.height);
      spr._silSolid = { canvas: c, res: spr.res, box: spr.box, pad: spr.pad, bytes: 0, used: 0 };
    }
    return spr._silSolid;
  }
  if (opts && opts.shiny) {
    // gold from a desaturated copy: the kernel's overlay pass re-applies the source colours, so a strongly
    // saturated animal (the mako's indigo) would otherwise come out grey-silver instead of gold
    if (!spr._grey) {
      const c = makeCanvas(spr.canvas.width, spr.canvas.height);
      const g = c.getContext('2d');
      g.drawImage(spr.canvas, 0, 0);
      g.globalCompositeOperation = 'saturation';
      g.fillStyle = '#808080';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(spr.canvas, 0, 0);
      spr._grey = { canvas: c, res: spr.res, box: spr.box, pad: spr.pad, bytes: 0, used: 0 };
    }
    return spriteVariant(spr._grey, 'shiny');
  }
  return spr;
}

/**
 * Per-individual eased motion state, so state flips (swim → hooked → flee, bite windows) never snap and
 * effort-dependent rates never jump: values are eased with the anim.t delta, and `ph` integrates a rate (rad/s)
 * instead of multiplying the absolute time by it. uid 0 (UI portraits) is stateless.
 * Returns a reused object { hk, open, ph } — read it immediately.
 */
const easeMemo = new Map();
const easeTmp = { hk: 0, open: 0, ph: 0 };
export function easeState(anim, key, hkTarget, openTarget, rate = 0) {
  const uid = anim.uid || 0, t = anim.t || 0;
  if (!uid) {
    easeTmp.hk = hkTarget;
    easeTmp.open = openTarget;
    easeTmp.ph = t * rate;
    return easeTmp;
  }
  const k = key + uid;
  let s = easeMemo.get(k);
  if (!s) {
    s = { t, hk: hkTarget, open: openTarget, ph: (anim.seed || 0) * 20 };
    easeMemo.set(k, s);
    if (easeMemo.size > 160) for (const [kk, o] of easeMemo) if (t - o.t > 8 || o.t > t + 1) easeMemo.delete(kk);
  }
  const dt = Math.min(0.1, Math.max(0, t - s.t));
  if (dt > 0) {
    s.hk += (hkTarget - s.hk) * Math.min(1, dt * 4);
    s.open += (openTarget - s.open) * Math.min(1, dt * (openTarget > s.open ? 9 : 4.5));
    s.ph += dt * rate;
    s.t = t;
  } else if (t < s.t) s.t = t; // time went backwards (new session / lab reload)
  return s;
}

/** Read (never create) an individual's eased state, e.g. so mouthAt() can follow the jaw actually being drawn. */
export function peekEase(key, uid) {
  return uid ? easeMemo.get(key + uid) || null : null;
}

/** Draw state helpers shared by every drawer. */
export function hookedness(anim) {
  return anim.hooked || anim.state === 'hooked' ? 1 : anim.state === 'flee' ? 0.35 : 0;
}

/** Fill colour for live (non-sprite) parts so silhouette / shiny modes stay consistent. */
export function liveColor(opts, normal, shinyCol) {
  if (opts.silhouette) return SIL;
  if (opts.shiny) return shinyCol || '#c9973a';
  return normal;
}
