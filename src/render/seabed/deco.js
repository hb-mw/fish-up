// Decoration sprites: a registry of procedural painters, a resolution-bucketed sprite cache, and the fast
// per-frame stamping of placed items (static stamp, or a swaying stack of sheared slices for plants).
import { makeCanvas, cellRng } from './util.js';

/**
 * Decoration type:
 *  { id, box:{x0,y0,x1,y1} (local world px, origin = base point on the ground, −y up), variants:n,
 *    paint(g, v, rng, res) — draw variant v in local px (ctx pre-transformed),
 *    sway: null | { amp (px at the top, ×scale), freq (rad/s), wave (rad over the height), slices, stiff (0..1 lower part) } }
 */
export const TYPES = new Map();
export function defType(def) {
  if (TYPES.has(def.id)) console.warn('[seabed] duplicate decoration id', def.id);
  def.variants = def.variants || 1;
  def.sway = def.sway || null;
  TYPES.set(def.id, def);
  return def;
}

// ── sprite cache ────────────────────────────────────────────────────────────────────────────────────
const cache = new Map(); // `${id}:${v}@${res}` → entry
const byIdV = new Map(); // `${id}:${v}` → Set(res) available
let bytes = 0;
let tick = 0;
const queue = [];
const queued = new Set();
const MAX_BYTES = 140 * 1024 * 1024;

function paintSprite(t, v, res) {
  const b = t.box;
  const pad = 2;
  const w = Math.ceil((b.x1 - b.x0) * res) + pad * 2, h = Math.ceil((b.y1 - b.y0) * res) + pad * 2;
  const canvas = makeCanvas(w, h);
  const g = canvas.getContext('2d');
  g.translate(pad - b.x0 * res, pad - b.y0 * res);
  g.scale(res, res);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  t.paint(g, v, cellRng(v, t.id.length * 31 + t.id.charCodeAt(0), 777), res);
  // dissolve whatever is painted below the base into the ground (no hard plinths on uneven ground)
  if (b.y1 > 1 && !t.noFade) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const yb = (1 - b.y0) * res + pad;
    const gr = g.createLinearGradient(0, yb, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gr;
    g.fillRect(0, yb, w, h - yb);
    g.globalCompositeOperation = 'source-over';
  }
  const e = { canvas, res, pad, w, h, used: ++tick, bytes: w * h * 4, key: t.id + ':' + v };
  cache.set(e.key + '@' + res, e);
  let set = byIdV.get(e.key);
  if (!set) byIdV.set(e.key, (set = new Set()));
  set.add(res);
  bytes += e.bytes;
  if (bytes > MAX_BYTES) evict();
  return e;
}
function evict() {
  const entries = [...cache.entries()].sort((a, b) => a[1].used - b[1].used);
  for (const [k, e] of entries) {
    if (bytes <= MAX_BYTES * 0.7) break;
    if (e.used >= tick - 2) continue;
    cache.delete(k);
    byIdV.get(e.key)?.delete(e.res);
    bytes -= e.bytes;
  }
}

/** Sprite for type t, variant v at resolution `res`; falls back to another resolution (and queues a repaint). */
export function sprite(t, v, res) {
  const key = t.id + ':' + v;
  let e = cache.get(key + '@' + res);
  if (e) {
    e.used = ++tick;
    return e;
  }
  const set = byIdV.get(key);
  if (set && set.size) {
    let best = null;
    for (const r of set) if (!best || Math.abs(Math.log(r / res)) < Math.abs(Math.log(best / res))) best = r;
    e = cache.get(key + '@' + best);
    if (e) {
      e.used = ++tick;
      const qk = key + '@' + res;
      if (!queued.has(qk)) {
        queued.add(qk);
        queue.push([t, v, res, qk]);
      }
      return e;
    }
  }
  return paintSprite(t, v, res);
}

/** Paint queued sprites until `budgetMs` is used. */
export function pumpSprites(budgetMs) {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budgetMs) {
    const [t, v, res, qk] = queue.shift();
    queued.delete(qk);
    if (!cache.has(qk)) paintSprite(t, v, res);
  }
}
export const spriteStats = () => ({ sprites: cache.size, MB: +(bytes / 1048576).toFixed(1), queued: queue.length });

// ── stamping ────────────────────────────────────────────────────────────────────────────────────────
/**
 * Draw one placed item. M = camera matrix {a (=k), e, f} — world → device is (k*x + e, k*y + f).
 * item: { t, v, x, y, s, f (±1), ph }   sway(item, hFrac) is supplied by the caller for animated types.
 */
export function stamp(ctx, M, item, spr, alpha) {
  const t = item.t, b = t.box, k = M.a, s = item.s;
  const sc = 1 / spr.res;
  ctx.globalAlpha = alpha;
  ctx.setTransform(k * s * item.f, 0, 0, k * s, M.e + item.x * k, M.f + item.y * k);
  ctx.drawImage(spr.canvas, b.x0 - spr.pad * sc, b.y0 - spr.pad * sc, spr.canvas.width * sc, spr.canvas.height * sc);
}

/**
 * Draw a swaying item as a stack of horizontal slices, each sheared so neighbours join up (a piecewise-linear bend).
 * off(hFrac) → horizontal offset in local px (before scale) at height fraction hFrac (0 = base … 1 = top).
 */
export function stampSway(ctx, M, item, spr, alpha, off) {
  const t = item.t, b = t.box, k = M.a, s = item.s, fl = item.f;
  const n = t.sway.slices;
  const sc = 1 / spr.res;
  const H = -b.y0; // height above the base
  const cw = spr.canvas.width;
  const x0 = b.x0 - spr.pad * sc, wLoc = cw * sc;
  ctx.globalAlpha = alpha;
  // below the base (embedded part) — no sway
  const yBaseLocal = 0;
  const pyBase = (yBaseLocal - b.y0) * spr.res + spr.pad;
  const below = spr.canvas.height - pyBase;
  if (below > 0.5) {
    ctx.setTransform(k * s * fl, 0, 0, k * s, M.e + item.x * k, M.f + item.y * k);
    ctx.drawImage(spr.canvas, 0, pyBase, cw, below, x0, 0, wLoc, below * sc);
  }
  let oPrev = off(0), yPrev = 0;
  for (let j = 1; j <= n; j++) {
    const yTop = -H * (j / n);
    const o = off(j / n);
    const c = (o - oPrev) / (yTop - yPrev); // shear: dx per dy (local)
    // local (xl, yl) → world: X + fl*s*xl + s*(oPrev + c*(yl - yPrev)), Y + s*yl
    const e = M.e + (item.x + s * (oPrev - c * yPrev)) * k;
    ctx.setTransform(k * s * fl, 0, k * s * c, k * s, e, M.f + item.y * k);
    const pyTop = (yTop - b.y0) * spr.res + spr.pad - (j === n ? spr.pad : 0);
    const pyBot = (yPrev - b.y0) * spr.res + spr.pad;
    const sh = pyBot - pyTop;
    if (sh > 0.25) ctx.drawImage(spr.canvas, 0, pyTop, cw, sh + 0.6, x0, yTop - (j === n ? spr.pad * sc : 0), wLoc, (sh + 0.6) * sc);
    oPrev = o;
    yPrev = yTop;
  }
}

/** Draw a sprite rotated by `ang` about its base point (x, y), flipped when f = −1. */
export function stampRot(ctx, M, t, spr, x, y, ang, s, f, alpha) {
  const b = t.box, k = M.a * s, sc = 1 / spr.res;
  const c = Math.cos(ang) * k, sn = Math.sin(ang) * k;
  ctx.globalAlpha = alpha;
  ctx.setTransform(c * f, sn * f, -sn, c, M.e + x * M.a, M.f + y * M.a);
  ctx.drawImage(spr.canvas, b.x0 - spr.pad * sc, b.y0 - spr.pad * sc, spr.canvas.width * sc, spr.canvas.height * sc);
}

/** Cached additive glow sprite: radial falloff of one colour (64 px). */
const glows = new Map();
export function glowSprite(r, g, b) {
  const key = r + ',' + g + ',' + b;
  let c = glows.get(key);
  if (c) return c;
  c = makeCanvas(64, 64);
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},0.14)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  glows.set(key, c);
  return c;
}

/** Queue a sprite for budgeted painting if it is not cached at `res` yet (prefetch ahead of the camera). */
export function want(t, v, res) {
  const qk = t.id + ':' + v + '@' + res;
  if (cache.has(qk) || queued.has(qk)) return;
  queued.add(qk);
  queue.push([t, v, res, qk]);
}
