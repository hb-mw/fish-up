// Bestiary: the creature art registry. KERNEL FILE.
// The three art modules (src/render/art/bonyfish.js, sharks.js, creatures.js) each export
//     export const DRAWERS = { [speciesId]: drawer }
// and the kernel registers them here. Everyone else draws animals ONLY through this file.
//
// ── The drawer contract ─────────────────────────────────────────────────────────────────────────
//   drawer.draw(ctx, len, anim, opts)                       REQUIRED
//     Draw the animal in LOCAL space: origin at the body centre, FACING +X (right), belly toward +Y.
//     `len` is the body length in px: the body spans x ∈ [−len/2, +len/2] (snout at +len/2).
//     The registry has already applied translate / flip / pitch / alpha — do NOT undo them, and leave the
//     ctx state as you found it (save/restore).
//       anim = { t        seconds (use for idle motion: fins, gills, tentacles)
//                phase    tail-beat phase in radians (monotonic)
//                amp      swim intensity 0.2 (hover) … 1.5 (frantic)
//                seed     0..1, stable per individual (subtle colour/pattern variation)
//                mouth    0..1 mouth open
//                turn     −1..1 the fish's `dir` (|turn| < 1 while it is turning around)
//                state    fish.state ('swim', 'hooked', 'flee', …) or 'icon' for UI renders
//                hooked   boolean
//                uid      integer id of the individual (0 for icons) }
//       opts = { detail      'world' (in-game, must be FAST) | 'card' (large beauty render for UI, quality over speed)
//                silhouette  true → flat dark shape only (undiscovered Fishdex entries)
//                shiny       true → rare golden variant (tint toward gold if you can; the registry adds sparkles)
//                light       0..1 ambient light at the animal (optional use; fog is applied later by the water pass)
//                pxScale     device px per local px right now (pick your sprite-cache resolution from this) }
//   drawer.drawGlow(ctx, len, anim, opts)                   optional — bioluminescence / light organs.
//     Called in a later ADDITIVE pass (globalCompositeOperation = 'lighter') in the same local space.
//   drawer.bounds = { x0, x1, y0, y1 }                      optional — full extent of the art in units of len
//     (default −0.5..0.5 × −0.25..0.25). Used to fit icons and to cull. Include fins, tentacles, streamers.
//   drawer.mouth  = { x, y }                                optional — hook point in units of len (default 0.46, 0.02)
//   drawer.mouthAt(anim) → { x, y }                         optional — dynamic hook point (protrusible jaws, reaching claws)
//   drawer.iconBounds = { x0, x1, y0, y1 }                  optional — tighter box used only to fit UI portraits
// ────────────────────────────────────────────────────────────────────────────────────────────────
import { SPECIES_BY_ID } from '../data/species.js';
import { TAU } from '../core/math.js';

const drawers = new Map();
const DEFAULT_BOUNDS = { x0: -0.5, x1: 0.5, y0: -0.25, y1: 0.25 };
const DEFAULT_MOUTH = { x: 0.46, y: 0.02 };

export function registerDrawers(map) {
  if (!map) return;
  for (const id in map) {
    if (map[id] && typeof map[id].draw === 'function') drawers.set(id, map[id]);
  }
}
export const hasDrawer = (id) => drawers.has(id);
export const getDrawer = (id) => drawers.get(id) || fallbackDrawer(id);
export const boundsOf = (id) => getDrawer(id).bounds || DEFAULT_BOUNDS;
export const mouthOf = (id, fish) => {
  const d = getDrawer(id);
  if (fish && typeof d.mouthAt === 'function') {
    const m = d.mouthAt({ state: fish.state, hooked: fish.state === 'hooked', mouth: fish.mouth, phase: fish.swimPhase, uid: fish.uid, seed: fish.seed });
    if (m) return m;
  }
  return d.mouth || DEFAULT_MOUTH;
};

const _anim = { t: 0, phase: 0, amp: 0.5, seed: 0, mouth: 0, turn: 1, state: 'swim', hooked: false, uid: 0 };
const _opts = { detail: 'world', silhouette: false, shiny: false, light: 1, pxScale: 1 };

function fillAnim(fish, game) {
  _anim.t = game.time.now;
  _anim.phase = fish.swimPhase;
  _anim.amp = fish.swimAmp;
  _anim.seed = fish.seed;
  _anim.mouth = fish.mouth;
  _anim.turn = fish.dir;
  _anim.state = fish.state;
  _anim.hooked = fish.state === 'hooked';
  _anim.uid = fish.uid;
  return _anim;
}

function applyFishTransform(ctx, fish) {
  ctx.translate(fish.x, fish.y);
  let d = fish.dir;
  if (d > -0.14 && d < 0.14) d = d < 0 ? -0.14 : 0.14;
  ctx.scale(d, 1);
  if (fish.pitch) ctx.rotate(fish.pitch);
}

/** Draw a fish entity in WORLD space (ctx must already have the camera transform). */
export function drawFish(ctx, fish, game) {
  const d = getDrawer(fish.speciesId);
  const b = d.bounds || DEFAULT_BOUNDS;
  const len = fish.visualLen;
  const r = len * Math.max(-b.x0, b.x1, -b.y0, b.y1) * 1.15;
  if (!game.camera.sees(fish.x, fish.y, r) || fish.alpha <= 0.01) return;
  ctx.save();
  applyFishTransform(ctx, fish);
  if (fish.alpha < 1) ctx.globalAlpha *= fish.alpha;
  _opts.detail = 'world';
  _opts.silhouette = false;
  _opts.shiny = fish.shiny;
  _opts.light = game.env.lightAt(fish.y);
  _opts.pxScale = game.view.scale * game.camera.zoom;
  d.draw(ctx, len, fillAnim(fish, game), _opts);
  ctx.restore();
}

/** Additive glow pass for a fish (bioluminescence + shiny sparkles). ctx composite must be 'lighter'. */
export function drawFishGlow(ctx, fish, game) {
  const d = getDrawer(fish.speciesId);
  const len = fish.visualLen;
  if (!game.camera.sees(fish.x, fish.y, len * 1.2) || fish.alpha <= 0.01) return;
  if (d.drawGlow && fish.glowAmt > 0.01) {
    ctx.save();
    applyFishTransform(ctx, fish);
    ctx.globalAlpha *= fish.alpha * fish.glowAmt;
    _opts.detail = 'world';
    _opts.silhouette = false;
    _opts.shiny = fish.shiny;
    _opts.light = game.env.lightAt(fish.y);
    _opts.pxScale = game.view.scale * game.camera.zoom;
    d.drawGlow(ctx, len, fillAnim(fish, game), _opts);
    ctx.restore();
  }
  if (fish.shiny) drawShinySparkles(ctx, fish.x, fish.y, len, game.time.now, fish.uid, fish.alpha);
}

/** Golden aura + twinkles for shiny fish (additive). */
export function drawShinySparkles(ctx, x, y, len, t, uid = 0, alpha = 1) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + uid);
  const g = ctx.createRadialGradient(x, y, 0, x, y, len * 0.7);
  g.addColorStop(0, `rgba(255,214,90,${0.2 * alpha * (0.6 + 0.4 * pulse)})`);
  g.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - len * 0.7, y - len * 0.7, len * 1.4, len * 1.4);
  for (let i = 0; i < 5; i++) {
    const k = i * 1.7 + uid * 0.37;
    const life = (t * 0.9 + i * 0.23 + uid * 0.11) % 1;
    const a = Math.sin(life * Math.PI) * alpha;
    const px = x + Math.sin(k * 3.1 + Math.floor(t * 0.9 + i * 0.23) * 2.3) * len * 0.45;
    const py = y + Math.cos(k * 1.9 + Math.floor(t * 0.9 + i * 0.23) * 1.7) * len * 0.2;
    const s = (3 + (i % 3) * 2) * (0.6 + 0.4 * a);
    ctx.fillStyle = `rgba(255,244,190,${0.9 * a})`;
    ctx.beginPath();
    ctx.moveTo(px - s * 2, py);
    ctx.quadraticCurveTo(px, py, px, py - s * 2);
    ctx.quadraticCurveTo(px, py, px + s * 2, py);
    ctx.quadraticCurveTo(px, py, px, py + s * 2);
    ctx.quadraticCurveTo(px, py, px - s * 2, py);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a species portrait fitted inside a box centred at (cx, cy) — for the catch card, Fishdex, shop, HUD.
 * Works on ANY 2D context (e.g. a small <canvas> inside a DOM card).
 * opts: { t, phase, amp, seed, silhouette, shiny, glow (also draw the glow pass), flip, pxScale, detail, state, mouth }
 * Returns the body length (px) that was used.
 */
export function drawSpeciesIcon(ctx, speciesId, cx, cy, maxW, maxH, opts = {}) {
  const d = getDrawer(speciesId);
  const b = d.iconBounds || d.bounds || DEFAULT_BOUNDS;
  const len = Math.min(maxW / (b.x1 - b.x0), maxH / (b.y1 - b.y0));
  const t = opts.t || 0;
  const anim = {
    t,
    phase: opts.phase !== undefined ? opts.phase : t * 3.2,
    amp: opts.amp !== undefined ? opts.amp : 0.32,
    seed: opts.seed !== undefined ? opts.seed : 0.5,
    mouth: opts.mouth || 0,
    turn: 1,
    state: opts.state || 'icon',
    hooked: false,
    uid: 0,
  };
  const o = {
    detail: opts.detail || 'card',
    silhouette: !!opts.silhouette,
    shiny: !!opts.shiny,
    light: 1,
    pxScale: opts.pxScale || 2,
  };
  const flip = opts.flip ? -1 : 1;
  ctx.save();
  ctx.translate(cx - ((b.x0 + b.x1) / 2) * len * flip, cy - ((b.y0 + b.y1) / 2) * len);
  if (flip < 0) ctx.scale(-1, 1);
  d.draw(ctx, len, anim, o);
  if (opts.glow && d.drawGlow && !o.silhouette) {
    ctx.globalCompositeOperation = 'lighter';
    d.drawGlow(ctx, len, anim, o);
  }
  ctx.restore();
  if (opts.shiny && !o.silhouette) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawShinySparkles(ctx, cx, cy, len, t, 3, 1);
    ctx.restore();
  }
  return len;
}

/** World-space offset from a fish's centre to its mouth (accounts for facing + pitch). */
export function mouthOffset(fish, out = {}) {
  const m = mouthOf(fish.speciesId, fish);
  const lx = m.x * fish.visualLen, ly = m.y * fish.visualLen;
  const c = Math.cos(fish.pitch), s = Math.sin(fish.pitch);
  const d = fish.dir >= 0 ? Math.max(0.14, fish.dir) : Math.min(-0.14, fish.dir);
  out.x = (lx * c - ly * s) * d;
  out.y = lx * s + ly * c;
  return out;
}

// ── Placeholder art (used until the real drawer for a species is registered) ───────────────────
const fallbackCache = new Map();
function fallbackDrawer(id) {
  let d = fallbackCache.get(id);
  if (d) return d;
  const sp = SPECIES_BY_ID[id];
  const color = (sp && sp.accent) || '#8fa3b5';
  d = {
    placeholder: true,
    draw(ctx, len, anim, opts) {
      const h = len * 0.3;
      const wag = Math.sin(anim.phase) * 0.25 * Math.min(1, anim.amp + 0.3);
      ctx.save();
      ctx.fillStyle = opts.silhouette ? '#16202c' : color;
      ctx.beginPath();
      ctx.ellipse(len * 0.08, 0, len * 0.42, h * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-len * 0.28, 0);
      ctx.lineTo(-len * 0.5, -h * 0.5 + wag * h);
      ctx.lineTo(-len * 0.5, h * 0.5 + wag * h);
      ctx.closePath();
      ctx.fill();
      if (!opts.silhouette) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(len * 0.1, -h * 0.16, len * 0.3, h * 0.16, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(len * 0.34, -h * 0.08, Math.max(1.5, h * 0.1), 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(len * 0.35, -h * 0.08, Math.max(0.8, h * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  };
  fallbackCache.set(id, d);
  return d;
}
