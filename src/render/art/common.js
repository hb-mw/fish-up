// Shared toolkit for creature art. KERNEL FILE.
// The fast path every drawer should use in-game:
//   1. paint the animal ONCE, in "unit space" (body length = 1), into a cached offscreen sprite  → unitSprite()
//   2. every frame, blit it — optionally sliced into strips that ride a travelling wave        → drawUnitSpriteSwim()
// Animated parts (pectoral fins, jaws, tentacles, lures…) can be extra sprites or live paths drawn on top.
// Silhouette and shiny-gold variants come for free via spriteVariant().
import { TAU, clamp } from '../../core/math.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ── sprite cache (LRU by bytes) ──────────────────────────────────────────────
const cache = new Map();
let cacheBytes = 0;
let tick = 0;
const MAX_BYTES = 260 * 1024 * 1024;
const BUCKETS = [40, 56, 80, 112, 160, 224, 320, 448, 640, 896, 1280, 1792, 2560];

function bucketFor(lenPx) {
  for (let i = 0; i < BUCKETS.length; i++) if (BUCKETS[i] >= lenPx * 0.92) return BUCKETS[i];
  return BUCKETS[BUCKETS.length - 1];
}
function evict() {
  if (cacheBytes <= MAX_BYTES) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].used - b[1].used);
  for (const [k, e] of entries) {
    if (cacheBytes <= MAX_BYTES * 0.75) break;
    cache.delete(k);
    cacheBytes -= e.bytes;
  }
}

/**
 * Get (or paint & cache) a sprite of something drawn in UNIT space: origin = body centre, +x = snout,
 * +y = belly, body length = 1 (so the body spans x −0.5 … +0.5).
 *
 * @param {string} key     unique id: species + anything that changes the pixels (variant, pose, seed bucket…)
 * @param {{x0:number,x1:number,y0:number,y1:number}} box   unit-space rectangle the sprite must contain (fins included!)
 * @param {number} lenPx   body length on screen in DEVICE px (= len * opts.pxScale) → picks a resolution bucket
 * @param {(ctx:CanvasRenderingContext2D, res:number)=>void} paint   draw in unit space (ctx is pre-transformed).
 *                         `res` = device px per unit, in case you want hairlines: lineWidth = 1.5 / res.
 * @returns {{canvas:HTMLCanvasElement, res:number, box:object}}
 */
export function unitSprite(key, box, lenPx, paint) {
  const res = bucketFor(lenPx);
  const k = key + '@' + res;
  let e = cache.get(k);
  if (!e) {
    const pad = 2;
    const w = (box.x1 - box.x0) * res + pad * 2, h = (box.y1 - box.y0) * res + pad * 2;
    const canvas = makeCanvas(w, h);
    const g = canvas.getContext('2d');
    g.translate(pad - box.x0 * res, pad - box.y0 * res);
    g.scale(res, res);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    paint(g, res);
    e = { canvas, res, box, pad, bytes: canvas.width * canvas.height * 4, used: 0 };
    cache.set(k, e);
    cacheBytes += e.bytes;
    evict();
  }
  e.used = ++tick;
  return e;
}

/** Blit a unit sprite so that its body is `len` local px long (origin = body centre). */
export function drawUnitSprite(ctx, spr, len) {
  const b = spr.box, s = len / spr.res;
  ctx.drawImage(spr.canvas, b.x0 * len - spr.pad * s, b.y0 * len - spr.pad * s, spr.canvas.width * s, spr.canvas.height * s);
}

/**
 * Blit a unit sprite as a SWIMMING body: vertical strips ride a travelling wave whose amplitude grows from
 * head to tail, plus a little fore/aft squash near the tail (reads as the tail sweeping toward/away from the camera).
 *
 * @param phase  tail-beat phase (anim.phase)
 * @param amp    swim intensity (anim.amp, ~0.2..1.5)
 * @param o      { strips=18, waves=1.15 (wavelengths along the body), swing=0.055 (tail-tip displacement, × len at amp 1),
 *                 head=0.12 (fraction of the swing the head gets), power=1.7 (how late the bend starts),
 *                 squash=0.35 (0..1 tail foreshortening), from=box.x0, to=box.x1 (unit-space span to deform) }
 */
export function drawUnitSpriteSwim(ctx, spr, len, phase, amp, o) {
  const b = spr.box;
  const n = (o && o.strips) || 18;
  const waves = (o && o.waves) || 1.15;
  const a = clamp(amp, 0, 1.6);
  const swing = (o && o.swing !== undefined ? o.swing : 0.055) * len * a;
  const head = o && o.head !== undefined ? o.head : 0.12;
  const power = (o && o.power) || 1.7;
  const squash = o && o.squash !== undefined ? o.squash : 0.35;
  const s = len / spr.res; // local px per sprite px
  const cw = spr.canvas.width, chh = spr.canvas.height;
  const sw = cw / n; // strip width in sprite px
  const dwBase = sw * s;
  const y0 = b.y0 * len - spr.pad * s;
  const dh = chh * s;
  const padU = spr.pad / spr.res;
  const spanU = b.x1 - b.x0 + 2 * padU; // unit width of the whole canvas
  const uLeft = b.x0 - padU;
  // Walk from the snout side toward the tail so the head stays anchored and the tail pulls in when it squashes.
  let right = b.x1 * len + spr.pad * s;
  for (let i = n - 1; i >= 0; i--) {
    const xc = uLeft + ((i + 0.5) / n) * spanU;
    const along = Math.max(0, 0.5 - xc); // 0 at the snout … 1 at the tail tip (… >1 for trailing streamers)
    const al = Math.min(along, 1);
    const e = head + (1 - head) * Math.pow(al, power);
    const ang = phase - along * waves * TAU;
    const dy = Math.sin(ang) * e * swing;
    const k = 1 - squash * 0.5 * Math.pow(al, 2.2) * (0.5 + 0.5 * Math.cos(ang)) * Math.min(a, 1.2);
    const dw = dwBase * k;
    ctx.drawImage(spr.canvas, i * sw, 0, sw, chh, right - dw - 0.3, y0 + dy, dw + 0.6, dh);
    right -= dw;
  }
}

/**
 * Cached recoloured copy of a sprite.
 *   'silhouette' → flat dark shape (undiscovered Fishdex entries)        colour default '#0f1c2b'
 *   'shiny'      → golden variant: keeps the shading, pushes everything toward gold with a glossy sheen
 */
export function spriteVariant(spr, kind, color) {
  const vk = '_v_' + kind + (color || '');
  if (spr[vk]) return spr[vk];
  const canvas = makeCanvas(spr.canvas.width, spr.canvas.height);
  const g = canvas.getContext('2d');
  g.drawImage(spr.canvas, 0, 0);
  if (kind === 'silhouette') {
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color || '#0f1c2b';
    g.fillRect(0, 0, canvas.width, canvas.height);
  } else if (kind === 'shiny') {
    g.globalCompositeOperation = 'luminosity';
    g.drawImage(spr.canvas, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const grad = g.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(255,196,60,0.78)');
    grad.addColorStop(0.5, 'rgba(255,224,120,0.62)');
    grad.addColorStop(1, 'rgba(255,246,200,0.72)');
    g.fillStyle = grad;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.55;
    g.drawImage(spr.canvas, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-atop';
    const sheen = g.createLinearGradient(0, 0, canvas.width, canvas.height * 0.6);
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,240,0.35)');
    sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  const v = { canvas, res: spr.res, box: spr.box, pad: spr.pad, bytes: 0, used: 0 };
  spr[vk] = v;
  return v;
}

/** Pick the right variant for the draw options: silhouette > shiny > normal. */
export function variantFor(spr, opts) {
  if (opts && opts.silhouette) return spriteVariant(spr, 'silhouette');
  if (opts && opts.shiny) return spriteVariant(spr, 'shiny');
  return spr;
}

// ── painting helpers (all work in whatever space the ctx is in) ───────────────
/**
 * A glossy, alive-looking eye. r = eyeball radius.
 * o: { iris='#d8a23a', irisDark, pupil=0.52 (pupil radius / r), slit=false (vertical cat pupil), sclera='#f4f1e6' or null,
 *      ring='rgba(0,0,0,0.55)' (dark socket ring), look={x,y} (−1..1 pupil offset), glint=true, glow (colour for deep-sea eyes) }
 */
export function paintEye(ctx, x, y, r, o = {}) {
  const iris = o.iris || '#d8a23a';
  const lookX = (o.look ? o.look.x : 0.12) * r * 0.22, lookY = (o.look ? o.look.y : 0) * r * 0.22;
  ctx.save();
  // socket
  ctx.fillStyle = o.ring || 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.12, 0, TAU);
  ctx.fill();
  // eyeball / iris
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, o.sclera === null ? iris : lighten(iris, 0.35));
  g.addColorStop(0.7, iris);
  g.addColorStop(1, o.irisDark || darken(iris, 0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // pupil
  const pr = r * (o.pupil || 0.52);
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  if (o.slit) ctx.ellipse(x + lookX, y + lookY, pr * 0.45, pr * 1.25, 0, 0, TAU);
  else ctx.arc(x + lookX, y + lookY, pr, 0, TAU);
  ctx.fill();
  // glints
  if (o.glint !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.34, r * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x + r * 0.28, y + r * 0.3, r * 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Overlapping fish scales, clipped to the current clip region. Covers the rectangle (x0,y0)-(x1,y1).
 * size = scale width. Draws thin dark arcs + faint light rims — keep alpha low (0.08–0.25) for a painterly look.
 */
export function paintScales(ctx, x0, y0, x1, y1, size, o = {}) {
  const dark = o.dark || 'rgba(0,20,40,0.16)';
  const light = o.light || 'rgba(255,255,255,0.10)';
  const lw = o.lineWidth || size * 0.09;
  const rowH = size * 0.56;
  ctx.save();
  ctx.lineWidth = lw;
  let row = 0;
  for (let y = y0; y <= y1 + rowH; y += rowH, row++) {
    const off = row % 2 ? size * 0.5 : 0;
    ctx.strokeStyle = dark;
    ctx.beginPath();
    for (let x = x0 - size + off; x <= x1 + size; x += size) {
      ctx.moveTo(x + size * 0.5, y - rowH * 0.9);
      ctx.quadraticCurveTo(x - size * 0.22, y, x + size * 0.5, y + rowH * 0.9);
    }
    ctx.stroke();
    if (light !== 'none') {
      ctx.strokeStyle = light;
      ctx.beginPath();
      for (let x = x0 - size + off; x <= x1 + size; x += size) {
        ctx.moveTo(x + size * 0.58, y - rowH * 0.8);
        ctx.quadraticCurveTo(x - size * 0.1, y, x + size * 0.58, y + rowH * 0.8);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Fin rays: fan of fine lines from a base segment to an outer edge (call inside a clip of the fin shape). */
export function paintFinRays(ctx, bx0, by0, bx1, by1, tx0, ty0, tx1, ty1, n, color, lineWidth) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ctx.moveTo(bx0 + (bx1 - bx0) * k, by0 + (by1 - by0) * k);
    ctx.lineTo(tx0 + (tx1 - tx0) * k, ty0 + (ty1 - ty0) * k);
  }
  ctx.stroke();
  ctx.restore();
}

// ── tiny colour utils on css hex strings ─────────────────────────────────────
function parse(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const css = (c, a) => (a === undefined || a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
/** '#rrggbb' → lighter css colour (t 0..1 toward white) */
export function lighten(hex, t, a) {
  const c = parse(hex);
  return css([c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t], a);
}
/** '#rrggbb' → darker css colour (t 0..1 toward black) */
export function darken(hex, t, a) {
  const c = parse(hex);
  return css([c[0] * (1 - t), c[1] * (1 - t), c[2] * (1 - t)], a);
}
/** mix two hex colours → css colour */
export function mix(hexA, hexB, t, a) {
  const p = parse(hexA), q = parse(hexB);
  return css([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t], a);
}
/** hex + alpha → css rgba */
export function alpha(hex, a) {
  return css(parse(hex), a);
}
