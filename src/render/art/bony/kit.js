// Bony-fish art kit — parametric body profiles, a UV "skin" painter, fins, scales, soft shapes.
// Everything in this file runs at SPRITE PAINT time (once per species / variant / resolution bucket) and
// never per frame, so it favours quality over speed. Unit space: body length = 1, snout at +0.5, belly +y.
import { TAU, clamp } from '../../../core/math.js';
import { createRng } from '../../../core/rng.js';
import { makeCanvas, paintEye } from '../common.js';

// ── colour (hex in → hex out, so calls chain) ────────────────────────────────
const parse = (hex) => {
  let h = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r, g, b) =>
  '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1);
/** hex + alpha → css rgba() */
export const rgba = (hex, a = 1) => {
  const c = parse(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
/** mix two hex colours → hex */
export const mixc = (a, b, t) => {
  const p = parse(a), q = parse(b);
  return toHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
};
export const lite = (c, t) => mixc(c, '#ffffff', t);
export const dark = (c, t) => mixc(c, '#000000', t);
/** HSL shift: dh in degrees, ds / dl additive (−1..1) → hex */
export function shift(hex, dh = 0, ds = 0, dl = 0) {
  const [r0, g0, b0] = parse(hex);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (((h + dh / 360) % 1) + 1) % 1;
  s = clamp(s + ds, 0, 1);
  const l2 = clamp(l + dl, 0, 1);
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s, p = 2 * l2 - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return toHex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
}

// ── curves & profiles ────────────────────────────────────────────────────────
/** Monotone cubic interpolation through [[x, y], …] (any order) → f(x), clamped outside the range. No overshoot. */
export function curve(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0]);
  const n = p.length;
  const xs = new Float64Array(n), ys = new Float64Array(n), ms = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = p[i][0];
    ys[i] = p[i][1];
  }
  if (n === 1) return () => ys[0];
  const d = new Float64Array(n - 1), h = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  ms[0] = d[0];
  ms[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) ms[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      ms[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * ms[i + 1];
  };
}

/**
 * A body profile: dorsal contour `top` and ventral contour `bot`, each a list of [x, y] control points that
 * share the same x range (rear end of the trunk … snout tip). Returns an object with samplers and path helpers.
 */
export function profile(top, bot) {
  const ft = curve(top), fb = curve(bot);
  let x0 = Infinity, x1 = -Infinity;
  for (const p of top) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
  }
  const N = 200;
  const xs = new Float64Array(N + 1), ts = new Float64Array(N + 1), bs = new Float64Array(N + 1);
  let hmax = 0, xDeep = 0;
  for (let i = 0; i <= N; i++) {
    const x = x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / N));
    xs[i] = x;
    ts[i] = ft(x);
    bs[i] = fb(x);
    if (bs[i] - ts[i] > hmax) {
      hmax = bs[i] - ts[i];
      xDeep = x;
    }
  }
  const P = {
    x0, x1, hmax, xDeep,
    top: ft,
    bot: fb,
    h: (x) => fb(x) - ft(x),
    mid: (x) => (ft(x) + fb(x)) / 2,
    /** y at fraction v (0 = back, 1 = belly) of the body at x */
    at: (x, v) => {
      const a = ft(x);
      return a + (fb(x) - a) * v;
    },
    /** closed outline path */
    trace(g) {
      g.beginPath();
      g.moveTo(xs[0], ts[0]);
      for (let i = 1; i <= N; i++) g.lineTo(xs[i], ts[i]);
      for (let i = N; i >= 0; i--) g.lineTo(xs[i], bs[i]);
      g.closePath();
    },
    /** open polyline following fraction v (number or fn(x)) from xa to xb */
    line(g, v, xa, xb, n = 48, move = true) {
      const fv = typeof v === 'function' ? v : () => v;
      for (let i = 0; i <= n; i++) {
        const x = xa + ((xb - xa) * i) / n;
        const y = P.at(x, fv(x));
        if (i === 0 && move) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    },
    /** closed polygon between fractions va and vb (numbers or fn(x)) from xa to xb — begins its own path */
    band(g, va, vb, xa, xb, n = 48) {
      g.beginPath();
      P.line(g, va, xa, xb, n, true);
      P.line(g, vb, xb, xa, n, false);
      g.closePath();
    },
  };
  return P;
}

/**
 * Sample a smooth open curve through control points [[x, y, sharp?], …] (Catmull-Rom; a truthy third value
 * makes that point a corner). Returns { poly: [[x,y],…], at: [index in poly of each control point] }.
 */
export function sampleSpline(pts, seg = 10, tension = 1) {
  const n = pts.length;
  const poly = [[pts[0][0], pts[0][1]]];
  const at = [0];
  for (let i = 0; i < n - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const p0 = i > 0 && !p1[2] ? pts[i - 1] : null;
    const p3 = i < n - 2 && !p2[2] ? pts[i + 2] : null;
    const k = 0.5 * tension;
    const m1x = p0 ? (p2[0] - p0[0]) * k : (p2[0] - p1[0]) * (p1[2] ? 1 : tension);
    const m1y = p0 ? (p2[1] - p0[1]) * k : (p2[1] - p1[1]) * (p1[2] ? 1 : tension);
    const m2x = p3 ? (p3[0] - p1[0]) * k : (p2[0] - p1[0]) * (p2[2] ? 1 : tension);
    const m2y = p3 ? (p3[1] - p1[1]) * k : (p2[1] - p1[1]) * (p2[2] ? 1 : tension);
    for (let j = 1; j <= seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
      poly.push([a * p1[0] + b * m1x + c * p2[0] + d * m2x, a * p1[1] + b * m1y + c * p2[1] + d * m2y]);
    }
    at.push(poly.length - 1);
  }
  return { poly, at };
}
/** lineTo along a polyline (moveTo first when `move`). */
export function tracePoly(g, poly, move = true, from = 0, to = poly.length - 1) {
  const s = from <= to ? 1 : -1;
  for (let i = from; i !== to + s; i += s) {
    if (i === from && move) g.moveTo(poly[i][0], poly[i][1]);
    else g.lineTo(poly[i][0], poly[i][1]);
  }
}
/** Begin + trace a smooth path through control points (closed with a straight segment when `close`). */
export function splinePath(g, pts, close = false, seg = 10, tension = 1) {
  const sp = sampleSpline(pts, seg, tension);
  g.beginPath();
  tracePoly(g, sp.poly);
  if (close) g.closePath();
  return sp;
}
const polyPoint = (poly, f) => {
  const i = clamp(Math.floor(f), 0, poly.length - 2), t = f - i;
  return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t];
};

// ── soft shapes ──────────────────────────────────────────────────────────────
const OFF = 16000;
/**
 * Gaussian-soft drawing that works in every browser: whatever `fn` fills / strokes is rendered ONLY as its
 * blurred shadow in `color` (the shape itself is parked off-canvas). `blur` is in the ctx's current units.
 */
export function soft(g, blur, color, fn) {
  const m = g.getTransform();
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  g.save();
  g.shadowColor = color;
  g.shadowBlur = Math.max(0.01, blur * sc * 2);
  g.shadowOffsetX = OFF;
  g.shadowOffsetY = 0;
  g.setTransform(m.a, m.b, m.c, m.d, m.e - OFF, m.f);
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  fn(g);
  g.restore();
}
/** Soft round (or elliptical) spot via a radial gradient. `hard` 0..1 = solid core fraction. */
export function spot(g, x, y, r, color, a = 1, hard = 0.35, ry = r, rot = 0) {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale(r, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, rgba(color, a));
  gr.addColorStop(hard, rgba(color, a));
  gr.addColorStop(hard + (1 - hard) * 0.5, rgba(color, a * 0.42));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
}
/** Soft eraser (destination-out spot) — melts the root of a fin into the body it sits on. */
export function erase(g, x, y, r, a = 1, hard = 0.2, ry = r, rot = 0) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  spot(g, x, y, r, '#000000', a, hard, ry, rot);
  g.restore();
}
/** Gaussian-ish bump of `color` across a gradient (for sheen bands). */
function bellStops(gr, color, a) {
  const k = [0, 0.03, 0.14, 0.38, 0.75, 1, 0.75, 0.38, 0.14, 0.03, 0];
  for (let i = 0; i < k.length; i++) gr.addColorStop(i / (k.length - 1), rgba(color, a * k[i]));
}

// ── tileable noise → mottling ────────────────────────────────────────────────
const noiseData = new Map();
const noiseCanvases = new Map();
const NS = 256;
function tileNoise(seed, oct = 4, baseCells = 4) {
  const key = seed + ':' + oct + ':' + baseCells;
  let out = noiseData.get(key);
  if (out) return out;
  out = new Float32Array(NS * NS);
  let amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    const cells = baseCells << o;
    const lat = new Float32Array(cells * cells);
    const r = createRng(seed * 131 + o * 17 + 7);
    for (let i = 0; i < lat.length; i++) lat[i] = r.next();
    for (let y = 0; y < NS; y++) {
      const fy = (y / NS) * cells, yi = Math.floor(fy), ty = fy - yi, sy = ty * ty * (3 - 2 * ty);
      const ya = (yi % cells) * cells, yb = ((yi + 1) % cells) * cells;
      for (let x = 0; x < NS; x++) {
        const fx = (x / NS) * cells, xi = Math.floor(fx), tx = fx - xi, sx = tx * tx * (3 - 2 * tx);
        const xa = xi % cells, xb = (xi + 1) % cells;
        const a = lat[ya + xa], b = lat[ya + xb], c = lat[yb + xa], d = lat[yb + xb];
        out[y * NS + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    norm += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  noiseData.set(key, out);
  return out;
}
/** A 256² tile of `color` whose alpha is smoothstep(lo, hi, fbm noise). Cached. */
export function noiseCanvas(color, lo = 0.4, hi = 0.65, seed = 1, oct = 4, cells = 4) {
  const key = `${color}|${lo}|${hi}|${seed}|${oct}|${cells}`;
  let c = noiseCanvases.get(key);
  if (c) return c;
  const n = tileNoise(seed, oct, cells);
  c = makeCanvas(NS, NS);
  const g = c.getContext('2d');
  const img = g.createImageData(NS, NS);
  const [r, gg, b] = parse(color);
  for (let i = 0; i < n.length; i++) {
    let t = clamp((n[i] - lo) / (hi - lo), 0, 1);
    t = t * t * (3 - 2 * t);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = t * 255;
  }
  g.putImageData(img, 0, 0);
  noiseCanvases.set(key, c);
  return c;
}
/**
 * Fill a rectangle (current space) with organic noise blotches — call inside a clip.
 * o: { color, a=0.3, scale=0.5 (size of one noise tile in current units), lo, hi, seed, oct, cells, sy=1 (vertical stretch),
 *      ox, oy (offset), op (composite op) }
 */
export function mottle(g, x0, y0, x1, y1, o) {
  const c = noiseCanvas(o.color, o.lo, o.hi, o.seed || 1, o.oct || 4, o.cells || 4);
  const s = (o.scale || 0.5) / NS;
  g.save();
  if (o.op) g.globalCompositeOperation = o.op;
  g.globalAlpha *= o.a === undefined ? 0.3 : o.a;
  g.translate(o.ox || 0, o.oy || 0);
  g.scale(s, s * (o.sy || 1));
  g.fillStyle = g.createPattern(c, 'repeat');
  const ox = o.ox || 0, oy = o.oy || 0, ssy = s * (o.sy || 1);
  g.fillRect((x0 - ox) / s, (y0 - oy) / ssy, (x1 - x0) / s, (y1 - y0) / ssy);
  g.restore();
}

// ── the UV skin painter ──────────────────────────────────────────────────────
/**
 * Helpers for painting in the body's own UV space: a W×H canvas where the horizontal axis runs along the
 * body (tail end at the left, snout at the right — same way round as the fish) and the vertical axis runs from
 * the dorsal contour (v = 0) to the ventral contour (v = 1). Anything painted here follows the body's curves.
 */
function uvSpace(t, P, W, H) {
  const L = P.x1 - P.x0;
  const U = {
    t, W, H, P,
    /** unit x → px column */
    X: (x) => ((x - P.x0) / L) * W,
    /** fraction v → px row */
    Y: (v) => v * H,
    /** unit length along the body → px */
    dx: (d) => (d / L) * W,
    /** unit length across the body at x → px (so round things stay round after the warp) */
    dy: (d, x) => (d / Math.max(P.h(x), P.hmax * 0.12)) * H,
    /** vertical gradient over the whole skin: stops [[v, css], …] (optionally only columns xa..xb) */
    grad(stops, xa = P.x0, xb = P.x1) {
      const gr = t.createLinearGradient(0, 0, 0, H);
      for (const s of stops) gr.addColorStop(clamp(s[0], 0, 1), s[1]);
      t.fillStyle = gr;
      const a = U.X(Math.min(xa, xb)), b = U.X(Math.max(xa, xb));
      t.fillRect(a, 0, b - a, H);
    },
    /** soft-edged band of `color` (hex) between fractions v0..v1 (feather in fraction units) from xa to xb */
    band(v0, v1, color, a = 1, feather = 0.03, xa = P.x0, xb = P.x1) {
      const y0 = (v0 - feather) * H, y1 = (v1 + feather) * H;
      const gr = t.createLinearGradient(0, y0, 0, y1);
      const f = clamp((2 * feather) / Math.max(1e-4, v1 - v0 + 2 * feather), 0.001, 0.499);
      gr.addColorStop(0, rgba(color, 0));
      gr.addColorStop(f, rgba(color, a));
      gr.addColorStop(1 - f, rgba(color, a));
      gr.addColorStop(1, rgba(color, 0));
      t.fillStyle = gr;
      const xl = U.X(Math.min(xa, xb)), xr = U.X(Math.max(xa, xb));
      t.fillRect(xl, y0, xr - xl, y1 - y0);
    },
    /** begin a path through [[x, v], …] in body coordinates (smooth spline unless `straight`) */
    path(pts, close = false, straight = false) {
      const px = pts.map((p) => [U.X(p[0]), p[1] * H, p[2]]);
      t.beginPath();
      if (straight) tracePoly(t, px);
      else tracePoly(t, sampleSpline(px, 10).poly);
      if (close) t.closePath();
    },
    /** a spot that stays ROUND on the fish: centre (x, v), radius r in unit lengths */
    spot(x, v, r, color, a = 1, hard = 0.35) {
      spot(t, U.X(x), v * H, U.dx(r), color, a, hard, U.dy(r, x));
    },
    /** soft elliptical glow: radii rx (unit length along the body) and rv (fraction of the depth) */
    glow(x, v, rx, rv, color, a = 1, hard = 0) {
      spot(t, U.X(x), v * H, U.dx(rx), color, a, hard, rv * H);
    },
  };
  return U;
}

function blitUV(g, res, P, tex) {
  const W = tex.width, H = tex.height, L = P.x1 - P.x0;
  const m = g.getTransform();
  if (m.b === 0 && m.c === 0 && m.a > 0) {
    // device-pixel-exact columns: no seams, no double blending of translucent layers
    const c0 = Math.floor(m.a * P.x0 + m.e), c1 = Math.ceil(m.a * P.x1 + m.e);
    const sw = W / (L * m.a);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let c = c0; c < c1; c++) {
      const x = clamp((c + 0.5 - m.e) / m.a, P.x0, P.x1);
      const ty = P.top(x), hy = P.bot(x) - ty;
      const sx = clamp(((x - P.x0) / L) * W - sw * 0.5, 0, W - sw);
      g.drawImage(tex, sx, 0, sw, H, c, m.d * ty + m.f - 0.5, 1, m.d * hy + 1);
    }
    g.restore();
    return;
  }
  const px = 1 / res;
  const n = Math.max(8, Math.ceil(L * res));
  const dw = L / n, sw = W / n;
  for (let i = 0; i < n; i++) {
    const xa = P.x0 + i * dw, xm = xa + dw * 0.5;
    const ty = P.top(xm), hy = P.bot(xm) - ty;
    g.drawImage(tex, i * sw, 0, sw, H, xa - px * 0.3, ty - px * 0.5, dw + px * 0.6, hy + px);
  }
}

/** Standard form shading painted in UV space on a transparent layer (so it follows the body's contours). */
function shadeUV(t, U, o) {
  const W = U.W, H = U.H;
  const light = o.light || '#ffffff', shadow = o.dark || '#071428';
  const sheen = o.sheen === undefined ? 0.38 : o.sheen;
  const sv = o.sheenV === undefined ? 0.2 : o.sheenV, sw = o.sheenW === undefined ? 0.13 : o.sheenW;
  if (sheen > 0) {
    let gr = t.createLinearGradient(0, (sv - sw) * H, 0, (sv + sw) * H);
    bellStops(gr, light, sheen);
    t.fillStyle = gr;
    t.fillRect(0, (sv - sw) * H, W, 2 * sw * H);
    if (o.gloss) {
      // a thinner, brighter wet streak riding the top of the sheen
      const gv = sv - sw * 0.25, gw = sw * 0.3;
      gr = t.createLinearGradient(0, (gv - gw) * H, 0, (gv + gw) * H);
      bellStops(gr, light, o.gloss);
      t.fillStyle = gr;
      t.fillRect(0, (gv - gw) * H, W, 2 * gw * H);
    }
    // break the sheen up a little (wet skin is never a perfect airbrush band), then fade it toward tail and snout
    const brk = o.breakup === undefined ? 0.4 : o.breakup;
    if (brk > 0) {
      t.save();
      t.globalCompositeOperation = 'destination-out';
      t.globalAlpha = brk;
      const k = Math.max(0.25, H / 110);
      t.scale(k * 2.2, k);
      t.fillStyle = t.createPattern(noiseCanvas('#000000', 0.38, 0.7, 11, 4, 4), 'repeat');
      t.fillRect(0, 0, W / (k * 2.2), H / k);
      t.restore();
    }
    t.globalCompositeOperation = 'destination-in';
    const e = t.createLinearGradient(0, 0, W, 0);
    e.addColorStop(0, 'rgba(0,0,0,0.12)');
    e.addColorStop(0.22, 'rgba(0,0,0,0.6)');
    e.addColorStop(0.55, 'rgba(0,0,0,1)');
    e.addColorStop(0.84, 'rgba(0,0,0,0.9)');
    e.addColorStop(1, 'rgba(0,0,0,0.3)');
    t.fillStyle = e;
    t.fillRect(0, 0, W, H);
    t.globalCompositeOperation = 'source-over';
  }
  const belly = o.belly === undefined ? 0.2 : o.belly;
  if (belly > 0) {
    // core shadow low on the flank, easing off at the very bottom (bounce light from below)
    const gr = t.createLinearGradient(0, 0.48 * H, 0, H);
    gr.addColorStop(0, rgba(shadow, 0));
    gr.addColorStop(0.45, rgba(shadow, belly * 0.55));
    gr.addColorStop(0.74, rgba(shadow, belly));
    gr.addColorStop(0.9, rgba(shadow, belly * 0.8));
    gr.addColorStop(1, rgba(shadow, belly * (o.bounce === undefined ? 0.4 : 1 - o.bounce)));
    t.fillStyle = gr;
    t.fillRect(0, 0.48 * H, W, 0.52 * H);
  }
  const rim = o.rim === undefined ? 0.28 : o.rim;
  if (rim > 0) {
    let gr = t.createLinearGradient(0, 0, 0, 0.1 * H);
    gr.addColorStop(0, rgba(shadow, rim));
    gr.addColorStop(0.4, rgba(shadow, rim * 0.35));
    gr.addColorStop(1, rgba(shadow, 0));
    t.fillStyle = gr;
    t.fillRect(0, 0, W, 0.1 * H);
    gr = t.createLinearGradient(0, H, 0, 0.93 * H);
    gr.addColorStop(0, rgba(shadow, rim * 0.8));
    gr.addColorStop(1, rgba(shadow, 0));
    t.fillStyle = gr;
    t.fillRect(0, 0.93 * H, W, 0.07 * H);
    // nose
    gr = t.createLinearGradient(W, 0, W * 0.965, 0);
    gr.addColorStop(0, rgba(shadow, rim * 0.6));
    gr.addColorStop(1, rgba(shadow, 0));
    t.fillStyle = gr;
    t.fillRect(W * 0.965, 0, W * 0.035, H);
  }
  if (o.topLight) {
    // light grazing the very top of the back
    const gr = t.createLinearGradient(0, 0, 0, 0.07 * H);
    gr.addColorStop(0, rgba(light, o.topLight));
    gr.addColorStop(1, rgba(light, 0));
    t.fillStyle = gr;
    t.fillRect(W * 0.1, 0, W * 0.8, 0.07 * H);
  }
  if (o.extra) o.extra(t, U);
}

/**
 * Paint a fish body.
 *   o.skin(t, U)   REQUIRED — paint the opaque skin in UV space (base colours, stripes, bars…)
 *   o.over(g)      optional — unit-space details clipped to the body, UNDER the form shading (scales, spots)
 *   o.shade        false | { light, dark, sheen, sheenV, sheenW, gloss, belly, bounce, rim, topLight, extra(t,U) }
 *   o.face(g)      optional — unit-space details clipped to the body, OVER the shading (gill cover, mouth, eye)
 *   o.fade         unit length over which the tail end of the trunk melts into the caudal fin (default 0.02)
 */
export function paintBody(g, res, P, o) {
  const L = P.x1 - P.x0;
  const W = clamp(Math.ceil(L * res), 24, 2048);
  const H = clamp(Math.ceil(P.hmax * res), 12, 1024);
  const tex = makeCanvas(W, H);
  const t = tex.getContext('2d');
  t.lineJoin = 'round';
  t.lineCap = 'round';
  o.skin(t, uvSpace(t, P, W, H));
  const fade = o.fade === undefined ? 0.03 : o.fade;
  if (fade > 0) {
    // the scaled trunk ends in a soft "<" over the root of the caudal fin instead of a straight cut
    const fw = (fade / L) * W;
    t.globalCompositeOperation = 'destination-out';
    soft(t, fw * 0.2, '#000', () => {
      t.beginPath();
      t.moveTo(-fw * 2, -H);
      for (let i = 0; i <= 24; i++) {
        const v = i / 24;
        t.lineTo(fw * (0.12 + 0.88 * Math.pow(Math.abs(2 * v - 1), 1.7)), v * H);
      }
      t.lineTo(-fw * 2, 2 * H);
      t.closePath();
      t.fill();
    });
    t.globalCompositeOperation = 'source-over';
  }
  g.save();
  P.trace(g);
  g.clip();
  blitUV(g, res, P, tex);
  if (o.over) o.over(g);
  if (o.shade !== false) {
    const sw = Math.max(16, W >> 1), sh = Math.max(8, H >> 1);
    const lay = makeCanvas(sw, sh);
    const s = lay.getContext('2d');
    shadeUV(s, uvSpace(s, P, sw, sh), o.shade || {});
    blitUV(g, res, P, lay);
  }
  if (o.face) o.face(g);
  g.restore();
}

// ── scales ───────────────────────────────────────────────────────────────────
/**
 * Imbricated scales that follow the body: rows run along the contours and shrink toward the tail, each scale a
 * shadowed rear edge with a lit rim inside it. Call inside the body clip (paintBody's `over`). Rows whose pitch
 * would be under ~2 device px fade out, so small sprites skip the work entirely.
 * o: { rows=12, v0=0.05, v1=0.95, x0=P.x0, x1 (head-side limit), aspect=1 (scale length / height),
 *      dark, light (hex or null), da=0.22, la=0.14 (alphas), lw=0.1 (× row pitch), jitter=0.5 (per-scale alpha variation),
 *      vFade(v) / xFade(x) → 0..1 extra alpha,  glint: { p, color, a } random bright scales (shimmer),  rng }
 */
export function scales(g, res, P, o = {}) {
  const rows = o.rows || 12;
  const v0 = o.v0 === undefined ? 0.05 : o.v0, v1 = o.v1 === undefined ? 0.95 : o.v1;
  const xa = o.x0 === undefined ? P.x0 : o.x0;
  const xb = o.x1 === undefined ? P.x1 - (P.x1 - P.x0) * 0.24 : o.x1;
  const k = o.aspect || 1;
  const dk = o.dark === undefined ? '#001428' : o.dark;
  const lt = o.light === undefined ? '#ffffff' : o.light;
  const da = o.da === undefined ? 0.22 : o.da, la = o.la === undefined ? 0.14 : o.la;
  const lw = o.lw || 0.1;
  const jit = o.jitter === undefined ? 0.5 : o.jitter;
  const rng = o.rng || createRng(7);
  const A0 = Math.PI - 1.32, A1 = Math.PI + 1.32;
  g.save();
  if (dk) g.strokeStyle = dk;
  let x = xb, col = 0;
  while (x > xa) {
    const bh = P.h(x), top = P.top(x);
    const rh = (bh * (v1 - v0)) / rows;
    const step = Math.max(rh * 0.52 * k, 0.4 / res);
    let a = clamp((rh * res - 2) / 2.5, 0, 1);
    if (o.xFade) a *= o.xFade(x);
    if (a > 0.02) {
      const r = rh * 0.56;
      const off = col & 1 ? 0.5 : 0;
      for (let j = 0; j < rows; j++) {
        const v = v0 + ((v1 - v0) * (j + off + 0.25)) / rows;
        if (v > v1) continue;
        const y = top + bh * v;
        let aa = a * (1 - jit * rng.next());
        if (o.vFade) aa *= o.vFade(v);
        if (aa < 0.02) continue;
        const cx = x + r * 0.3;
        if (o.glint && rng.next() < o.glint.p) {
          g.globalAlpha = aa * o.glint.a * (0.35 + 0.65 * rng.next());
          g.fillStyle = o.glint.color;
          g.beginPath();
          g.ellipse(cx - r * 0.3, y, r * 0.62 * k, r * 0.8, 0, 0, TAU);
          g.fill();
        }
        if (lt) {
          g.globalAlpha = aa * la;
          g.strokeStyle = lt;
          g.lineWidth = rh * lw * 1.5;
          g.beginPath();
          g.ellipse(cx + rh * lw * 1.3, y, r * k, r, 0, A0 + 0.3, A1 - 0.3);
          g.stroke();
        }
        if (dk) {
          g.globalAlpha = aa * da;
          g.strokeStyle = dk;
          g.lineWidth = rh * lw;
          g.beginPath();
          g.ellipse(cx, y, r * k, r, 0, A0, A1);
          g.stroke();
        }
      }
    }
    x -= step;
    col++;
  }
  g.restore();
}

// ── fins ─────────────────────────────────────────────────────────────────────
/**
 * Points along the back ('top') or belly ('bot') lifted off the contour: list of [x, height, sharp?] →
 * [[x, y, sharp?], …]. Negative heights sink into the body (use for the two base points). `lean` shifts each
 * point tailward in proportion to its height (rays sweeping back).
 */
export function ridge(P, side, list, lean = 0) {
  return list.map(([x, h, s]) => {
    const y = side === 'top' ? P.top(x) - h : P.bot(x) + h;
    return [x - Math.max(0, h) * lean, y, s];
  });
}
/** Piecewise-linear lookup over an array: lerpArr([a, b, c])(k) for k in 0..1. */
export const lerpArr = (arr) => (k) => {
  const f = clamp(k, 0, 1) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f));
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
};
/**
 * A spiny fin edge: n spines between x0 and x1 with height h(k) (k = 0..1), membrane dipping between them.
 * Returns ridge-style [[x, height, sharp], …] including sunk base points, ready for ridge().
 */
export function spines(x0, x1, n, h, notch = 0.25, inset = 0.012) {
  const out = [[x0 + 0.004 * Math.sign(x0 - x1), -inset]];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1);
    const x = x0 + (x1 - x0) * (0.06 + 0.9 * k);
    out.push([x, h(k), 1]);
    if (i < n - 1) {
      const k2 = (i + 0.5) / (n - 1);
      out.push([x0 + (x1 - x0) * (0.06 + 0.9 * k2) - (x0 - x1) * 0.012, h(k2) * (1 - notch)]);
    }
  }
  out.push([x1, -inset]);
  return out;
}
/**
 * Caudal fin outline, rooted INSIDE the peduncle so the trunk can melt into it.
 * o: { P, root=0.06 (how far the root reaches forward under the trunk), up: [x,y], lo: [x,y] (lobe tips),
 *      notch: [x,y] (centre of the trailing edge), lead=0.1 (how much the leading edges bow outward), trail=0 (bow of the
 *      trailing edge: + hollows it (lunate / forked), − bulges it outward (rounded lobes)), sharp=true (pointed tips), notchSharp }
 * Returns control points; the trailing edge spans indices 3..7 (rays: to: [3, 7]) and `.root` is a root segment for rays.
 */
export function caudal(o) {
  const { P, up, lo, notch } = o;
  const lead = o.lead === undefined ? 0.1 : o.lead, trail = o.trail || 0;
  const sharp = o.sharp === undefined ? 1 : o.sharp ? 1 : 0;
  const bow = (a, b, k) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    return [mx - (b[1] - a[1]) * k, my + (b[0] - a[0]) * k];
  };
  const xr = P.x0 + (o.root === undefined ? 0.06 : o.root);
  const rt = [xr, P.top(xr) + 0.005], rb = [xr, P.bot(xr) - 0.005];
  const et = [P.x0 + 0.004, P.top(P.x0) + 0.002], eb = [P.x0 + 0.004, P.bot(P.x0) - 0.002];
  const pts = [rt, et, bow(et, up, lead), [up[0], up[1], sharp], bow(up, notch, -trail), [notch[0], notch[1], o.notchSharp ? 1 : 0], bow(notch, lo, -trail), [lo[0], lo[1], sharp], bow(lo, eb, lead), eb, rb];
  const ym = (et[1] + eb[1]) / 2, hh = (eb[1] - et[1]) * 0.3;
  pts.root = [[P.x0 + 0.012, ym - hh], [P.x0 + 0.012, ym + hh]];
  return pts;
}

/**
 * Paint one fin.
 * F: { pts            outline control points [[x,y,sharp?],…], from the FRONT of the base round to the REAR of the base
 *      col, tip       base → tip colours (css) — or stops: [[t, css], …]
 *      axis           [x0,y0,x1,y1] gradient axis (default: base midpoint → farthest outline point)
 *      rays           one group or an array of groups:
 *                       fan      { n, to:[i0,i1] (control-point indices the rays end between), from:[[x,y],[x,y]] (root segment), curl, bias }
 *                       parallel { n, from:[[x,y],[x,y]] (root segment, front→rear), lean | [leanFront, leanRear] (tailward run per unit rise),
 *                                  up=-1 (−1 rays rise: dorsal; +1 rays drop: anal), len=0.5 (they are trimmed by the fin outline), curl }
 *                       both     { col (hex), a=0.28, fade=0.55 (alpha lost toward the tip), w, jitter=0.45,
 *                                  hl (hex) + hla=0.16: soft light pleats between the rays }
 *      scallop        { from, to (control-point indices), n (number of scallops), depth } trailing edge sagging between rays
 *      mottle         mottle() options — organic blotches over the membrane
 *      shade          css rgba() laid over the root of the fin, fading out along the axis (shadeLen = 0.45 of it)
 *      edge           { col, w, to: index } darker leading edge from point 0 to `to`
 *      margin         { col, w, from, to, rim, rimW } band along the outline between control-point indices (inside the fin)
 *      outline        { col, w } faint line just inside the whole outline (helps pale fins read over a pale body)
 *      paint(g, sp)   custom painting inside the fin clip (spots, bands…)
 *      seg, tension   spline quality / tightness }
 */
export function fin(g, res, F) {
  const sp = sampleSpline(F.pts, F.seg || (F.scallop ? 24 : 10), F.tension === undefined ? 1 : F.tension);
  const poly = sp.poly;
  if (F.scallop) {
    // nibble the trailing edge between ray tips: membranes sag a little between the rays that carry them
    const S = F.scallop;
    const i0 = sp.at[S.from], i1 = sp.at[S.to];
    let cx = 0, cy = 0;
    for (const p of poly) {
      cx += p[0];
      cy += p[1];
    }
    cx /= poly.length;
    cy /= poly.length;
    let total = 0;
    const acc = [0];
    for (let i = i0 + 1; i <= i1; i++) {
      total += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);
      acc.push(total);
    }
    for (let i = i0 + 1; i < i1; i++) {
      const sN = acc[i - i0] / total;
      const k = Math.pow(Math.abs(Math.sin(Math.PI * S.n * sN)), 0.8) * Math.min(1, Math.min(sN, 1 - sN) * S.n * 2);
      const dx = cx - poly[i][0], dy = cy - poly[i][1], d = Math.hypot(dx, dy) || 1;
      poly[i][0] += (dx / d) * S.depth * k;
      poly[i][1] += (dy / d) * S.depth * k;
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const a0 = poly[0], a1 = poly[poly.length - 1];
  const bmx = (a0[0] + a1[0]) / 2, bmy = (a0[1] + a1[1]) / 2;
  let ax = bmx, ay = bmy, bx = bmx, by = bmy;
  if (F.axis) [ax, ay, bx, by] = F.axis;
  else {
    let best = -1;
    for (const p of poly) {
      const d = (p[0] - bmx) ** 2 + (p[1] - bmy) ** 2;
      if (d > best) {
        best = d;
        bx = p[0];
        by = p[1];
      }
    }
  }
  g.save();
  g.beginPath();
  tracePoly(g, poly);
  g.closePath();
  g.clip();
  const gr = g.createLinearGradient(ax, ay, bx, by);
  const stops = F.stops || [[0, F.col], [1, F.tip || F.col]];
  for (const s of stops) gr.addColorStop(s[0], s[1]);
  g.fillStyle = gr;
  g.fillRect(minX - 0.01, minY - 0.01, maxX - minX + 0.02, maxY - minY + 0.02);
  if (F.mottle) mottle(g, minX, minY, maxX, maxY, F.mottle);
  if (F.paint) F.paint(g, sp);
  if (F.shade) {
    // the root of the fin sits in the body's shadow
    const sg = g.createLinearGradient(ax, ay, ax + (bx - ax) * (F.shadeLen || 0.45), ay + (by - ay) * (F.shadeLen || 0.45));
    sg.addColorStop(0, F.shade);
    sg.addColorStop(1, F.shade.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = sg;
    g.fillRect(minX - 0.01, minY - 0.01, maxX - minX + 0.02, maxY - minY + 0.02);
  }
  if (F.rays && res >= 70) {
    const groups = Array.isArray(F.rays) ? F.rays : [F.rays];
    const rr = createRng(F.pts.length * 31 + 5);
    for (const R of groups) {
      const n = R.n || 12;
      const from = R.from || [F.pts[0], F.pts[F.pts.length - 1]];
      const col = R.col || '#000000', al = R.a === undefined ? 0.28 : R.a, fade = R.fade === undefined ? 0.55 : R.fade;
      const jit = R.jitter === undefined ? 0.45 : R.jitter;
      const sg = g.createLinearGradient(ax, ay, bx, by);
      sg.addColorStop(0, rgba(col, al));
      sg.addColorStop(1, rgba(col, al * (1 - fade)));
      g.strokeStyle = sg;
      g.lineWidth = Math.max(R.w || 0.0018, 0.5 / res);
      const fan = R.lean === undefined;
      let ia = 0, ib = 0;
      if (fan) {
        const to = R.to || [0, F.pts.length - 1];
        ia = sp.at[to[0]];
        ib = sp.at[to[1]];
      }
      const l0 = fan ? 0 : Array.isArray(R.lean) ? R.lean[0] : R.lean, l1 = fan ? 0 : Array.isArray(R.lean) ? R.lean[1] : R.lean;
      const up = R.up === undefined ? -1 : R.up;
      const len = R.len || 0.5;
      const curl = R.curl || 0;
      const passes = R.hl ? 2 : 1;
      for (let pass = 0; pass < passes; pass++)
      for (let i = 0; i <= n; i++) {
        // pass 0 (only with R.hl): soft light pleats half-way between the rays; last pass: the rays themselves
        const pleat = passes === 2 && pass === 0;
        if (pleat && i === n) continue;
        const q = (i + (pleat ? 0.5 : 0)) / n;
        if (pleat && i === 0) {
          const hg = g.createLinearGradient(ax, ay, bx, by);
          hg.addColorStop(0, rgba(R.hl, 0));
          hg.addColorStop(0.3, rgba(R.hl, R.hla === undefined ? 0.16 : R.hla));
          hg.addColorStop(1, rgba(R.hl, (R.hla === undefined ? 0.16 : R.hla) * 0.6));
          g.strokeStyle = hg;
          g.lineWidth = Math.max((R.w || 0.0018) * 2.6, 0.5 / res);
        } else if (!pleat && i === 0) {
          g.strokeStyle = sg;
          g.lineWidth = Math.max(R.w || 0.0018, 0.5 / res);
        }
        const sx = from[0][0] + (from[1][0] - from[0][0]) * q, sy = from[0][1] + (from[1][1] - from[0][1]) * q;
        let ex, ey;
        if (fan) {
          const e = polyPoint(poly, ia + (ib - ia) * Math.pow(q, R.bias || 1));
          ex = e[0];
          ey = e[1];
        } else {
          const ln = l0 + (l1 - l0) * q;
          const d = Math.hypot(ln, 1);
          ex = sx - (ln / d) * len;
          ey = sy + (up / d) * len;
        }
        g.globalAlpha = 1 - jit * rr.next();
        g.beginPath();
        g.moveTo(sx, sy);
        if (curl) {
          const mx = (sx + ex) / 2, my = (sy + ey) / 2, dx = ex - sx, dy = ey - sy;
          const c = curl * (fan ? 1 - 2 * q : 1);
          g.quadraticCurveTo(mx + dy * c, my - dx * c, ex, ey);
        } else g.lineTo(ex, ey);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  if (F.margin) {
    const M = F.margin;
    const i0 = sp.at[M.from === undefined ? 0 : M.from], i1 = sp.at[M.to === undefined ? F.pts.length - 1 : M.to];
    g.beginPath();
    tracePoly(g, poly, true, i0, i1);
    g.strokeStyle = M.col;
    g.lineWidth = M.w * 2;
    g.stroke();
    if (M.rim) {
      g.strokeStyle = M.rim;
      g.lineWidth = (M.rimW || M.w * 0.3) * 2;
      g.stroke();
    }
  }
  if (F.outline) {
    g.beginPath();
    tracePoly(g, poly);
    g.strokeStyle = F.outline.col;
    g.lineWidth = (F.outline.w || 0.003) * 2;
    g.stroke();
  }
  g.restore();
  if (F.edge) {
    const E = F.edge;
    g.save();
    g.beginPath();
    tracePoly(g, poly, true, 0, sp.at[E.to === undefined ? 1 : E.to]);
    g.strokeStyle = E.col;
    g.lineWidth = Math.max(E.w || 0.004, 0.6 / res);
    g.stroke();
    g.restore();
  }
  return sp;
}

/** A row of finlets (tuna, mackerel): small swept triangles along the back or belly. */
export function finlets(g, P, side, xs, size, col, edge) {
  const sgn = side === 'top' ? -1 : 1;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = (side === 'top' ? P.top(x) : P.bot(x)) - sgn * 0.004;
    const s = size * (1 - 0.35 * (i / Math.max(1, xs.length - 1)));
    g.beginPath();
    g.moveTo(x + s * 0.55, y);
    g.quadraticCurveTo(x + s * 0.1, y + sgn * s * 0.75, x - s * 0.75, y + sgn * s * 0.95);
    g.quadraticCurveTo(x - s * 0.3, y + sgn * s * 0.35, x - s * 0.5, y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    if (edge) {
      g.strokeStyle = edge;
      g.lineWidth = s * 0.12;
      g.stroke();
    }
  }
}

// ── head details ─────────────────────────────────────────────────────────────
/**
 * Gill cover: a curved edge that tapers out at both ends, a soft shadow behind it and a faint lit lip in front —
 * reads as an overlapping plate rather than a drawn line.
 * o: { x, y0, y1, bulge=0.03 (how far the edge bows toward the tail), sweep=0.5 (bottom end swings forward by bulge×this),
 *      dark='#0a1626', a=0.5, w=0.0035, shadow=0.3, light='#ffffff', la=0.2, plate=0 (soft sheen on the cover itself) }
 */
export function gill(g, res, o) {
  const b = o.bulge === undefined ? 0.03 : o.bulge;
  const sw = o.sweep === undefined ? 0.5 : o.sweep;
  const dk = o.dark || '#0a1626';
  const ym = (o.y0 + o.y1) / 2;
  const path = (dx) => {
    g.beginPath();
    g.moveTo(o.x + dx, o.y0);
    g.quadraticCurveTo(o.x - b * 2 + dx, ym, o.x + b * sw + dx, o.y1);
  };
  const taper = (hex, a) => {
    const gr = g.createLinearGradient(0, o.y0, 0, o.y1);
    gr.addColorStop(0, rgba(hex, 0));
    gr.addColorStop(0.22, rgba(hex, a));
    gr.addColorStop(0.72, rgba(hex, a));
    gr.addColorStop(1, rgba(hex, 0));
    return gr;
  };
  const w = o.w || 0.0035;
  if (o.plate) spot(g, o.x + b * 1.2, ym - (o.y1 - o.y0) * 0.08, (o.y1 - o.y0) * 0.3, o.light || '#ffffff', o.plate, 0.05, (o.y1 - o.y0) * 0.36);
  if (o.shadow !== 0) {
    soft(g, w * 3, rgba(dk, o.shadow === undefined ? 0.3 : o.shadow), () => {
      path(-w * 2.6);
      g.lineWidth = w * 5;
      g.stroke();
    });
  }
  g.save();
  path(w * 1.1);
  g.strokeStyle = taper(o.light || '#ffffff', o.la === undefined ? 0.2 : o.la);
  g.lineWidth = Math.max(w * 0.9, 0.5 / res);
  g.stroke();
  path(0);
  g.strokeStyle = taper(dk, o.a === undefined ? 0.5 : o.a);
  g.lineWidth = Math.max(w, 0.7 / res);
  g.stroke();
  g.restore();
}

/**
 * Mouth line from the snout tip back to the corner of the jaw.
 * o: { tip:[x,y], corner:[x,y], sag=0 (how much the line bellies downward), dark, a=0.6, w=0.004, lip (css highlight above) }
 */
export function mouthLine(g, res, o) {
  const [tx, ty] = o.tip, [cx, cy] = o.corner;
  const mx = (tx + cx) / 2, my = (ty + cy) / 2 + (o.sag || 0);
  const w = o.w || 0.004;
  g.save();
  if (o.lip) {
    g.beginPath();
    g.moveTo(tx, ty - w);
    g.quadraticCurveTo(mx, my - w * 1.2, cx, cy - w);
    g.strokeStyle = o.lip;
    g.lineWidth = Math.max(w, 0.5 / res);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(tx, ty);
  g.quadraticCurveTo(mx, my, cx, cy);
  g.strokeStyle = rgba(o.dark || '#0a1020', o.a === undefined ? 0.6 : o.a);
  g.lineWidth = Math.max(w, 0.7 / res);
  g.stroke();
  g.restore();
}

/**
 * The shared game eye (paintEye) seated in a softly shaded socket, with an optional metallic ring.
 * o: paintEye options + { socket=0.3 (shadow strength), socketCol, rim (css colour of a thin ring round the eyeball) }
 */
export function eye(g, x, y, r, o = {}) {
  const sa = o.socket === undefined ? 0.3 : o.socket;
  if (sa > 0) spot(g, x, y + r * 0.1, r * 1.9, o.socketCol || '#06101e', sa, 0.45);
  paintEye(g, x, y, r, o);
  if (o.rim) {
    g.save();
    g.strokeStyle = o.rim;
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.arc(x, y, r * 0.99, 0, TAU);
    g.stroke();
    g.restore();
  }
}

/** Scatter n tiny dots inside a rectangle (call inside a clip) — skin grain, freckles. */
export function speckle(g, rng, n, x0, y0, x1, y1, rMin, rMax, colors, aMin = 0.1, aMax = 0.4) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * rng.next(), y = y0 + (y1 - y0) * rng.next();
    const r = rMin + (rMax - rMin) * rng.next();
    g.globalAlpha = aMin + (aMax - aMin) * rng.next();
    g.fillStyle = colors[(rng.next() * colors.length) | 0];
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** A small crisp wet highlight (elongated, soft-ended). */
export function glint(g, x, y, len, w, a = 0.7, rot = 0, color = '#ffffff') {
  spot(g, x, y, len, color, a, 0.1, w, rot);
}

/**
 * Polygon of the lower jaw (closed position) as a fan from the hinge: hinge → corner of the mouth → tip → back along
 * the chin contour to the point under the hinge. Feed to the rig's `jaw.poly`.
 */
export function jawPolygon(P, hinge, tip, corner, n = 8, out = 0.012) {
  const poly = [hinge, corner || [hinge[0] + (tip[0] - hinge[0]) * 0.3, hinge[1] + (tip[1] - hinge[1]) * 0.3], tip];
  poly.push([tip[0] + out, tip[1] + out * 0.6]);
  for (let i = 0; i <= n; i++) {
    const x = tip[0] + (hinge[0] - tip[0]) * (i / n);
    poly.push([x, Math.max(P.bot(Math.min(x, P.x1)), tip[1]) + out]);
  }
  return poly;
}

export { createRng, makeCanvas, clamp, TAU };
