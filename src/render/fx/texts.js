// World-anchored floating texts, drawn crisp on the overlay canvas (SCREEN space).
// Each text is painted ONCE into a pooled offscreen canvas at device resolution (outline, gradient fill, baked
// soft shadow), then simply blitted with an eased pop-in / rise / fade. Repainted if the display font loads late.
import { clamp, ease } from '../../core/math.js';

const FONT = "'FishUp Display', 'Baloo 2', 'Nunito', 'Arial Rounded MT Bold', 'Varela Round', system-ui, -apple-system, 'Segoe UI', sans-serif";
const POP = 1.22; // paint headroom for the overshoot
const TOP_SAFE = 112; // logical px reserved for the HUD at the top of the screen

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function createTexts(game, cap = 14) {
  const items = [];
  for (let i = 0; i < cap; i++) {
    items.push({
      on: false, x: 0, y: 0, text: '', color: '#fff', size: 34, life: 1.3, age: 0, rise: 70, weight: 800,
      stroke: null, delay: 0, punch: 0, canvas: document.createElement('canvas'), w: 0, h: 0, pScale: 0, pEpoch: -1,
      dx: 0, seq: 0,
    });
  }
  const tmp = { x: 0, y: 0 };
  let fontEpoch = 0;
  let seq = 0;
  if (typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      fontEpoch++;
    });
    // load the display face up front, so the first floating text doesn't trigger a late repaint
    try {
      document.fonts.load(`800 40px ${FONT}`).catch(() => {});
    } catch { /* ignore */ }
  }

  function paint(it) {
    const scale = game.view.scale * POP;
    const px = it.size * scale;
    const c = it.canvas, g = c.getContext('2d');
    const font = `${it.weight} ${px.toFixed(1)}px ${FONT}`;
    g.font = font;
    const tw = g.measureText(it.text).width;
    const pad = px * 0.42;
    const w = Math.ceil(tw + pad * 2), h = Math.ceil(px * 1.55 + pad * 0.6);
    if (c.width < w || c.height < h || c.width > w * 2 || c.height > h * 2) {
      c.width = w;
      c.height = h;
    } else g.clearRect(0, 0, c.width, c.height);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.miterLimit = 2;
    const cx = c.width / 2, cy = c.height / 2;
    const base = hexToRgb(it.color) || [255, 255, 255];
    const dark = it.stroke ? hexToRgb(it.stroke) || [8, 20, 34] : mix(base, [6, 16, 30], 0.82);
    // soft drop shadow + outline in one stroke
    g.shadowColor = 'rgba(0,8,20,0.5)';
    g.shadowBlur = px * 0.22;
    g.shadowOffsetY = px * 0.07;
    g.strokeStyle = css(dark, 0.95);
    g.lineWidth = Math.max(2, px * 0.19);
    g.strokeText(it.text, cx, cy);
    g.shadowColor = 'transparent';
    // inner lighter edge for a little bevel
    g.strokeStyle = css(mix(base, [255, 255, 255], 0.35), 0.35);
    g.lineWidth = Math.max(1, px * 0.06);
    g.strokeText(it.text, cx, cy - px * 0.02);
    // gradient fill: highlight at the top, the colour at the bottom
    const grad = g.createLinearGradient(0, cy - px * 0.48, 0, cy + px * 0.42);
    grad.addColorStop(0, css(mix(base, [255, 255, 255], 0.62)));
    grad.addColorStop(0.45, css(mix(base, [255, 255, 255], 0.12)));
    grad.addColorStop(1, css(mix(base, [0, 0, 0], 0.12)));
    g.fillStyle = grad;
    g.fillText(it.text, cx, cy);
    it.w = c.width / scale;
    it.h = c.height / scale;
    it.pScale = game.view.scale;
    it.pEpoch = fontEpoch;
  }

  /**
   * @param {number} x world x   @param {number} y world y
   * @param {string} text
   * @param {{color?:string,size?:number,life?:number,rise?:number,weight?:number,stroke?:string,delay?:number,punch?:number}} [opts]
   */
  function spawn(x, y, text, opts = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || text == null) return;
    let it = null, oldest = null;
    for (const c of items) {
      if (!c.on) {
        it = c;
        break;
      }
      if (!oldest || c.seq < oldest.seq) oldest = c;
    }
    if (!it) it = oldest;
    it.on = true;
    it.seq = ++seq;
    it.x = x;
    it.y = y;
    it.text = String(text);
    it.color = opts.color || '#ffffff';
    it.size = clamp(opts.size || 34, 10, 140);
    it.life = clamp(opts.life || 1.3, 0.3, 8);
    it.rise = opts.rise !== undefined ? opts.rise : 70;
    it.weight = opts.weight || 800;
    it.stroke = opts.stroke || null;
    it.delay = opts.delay || 0;
    it.punch = opts.punch || 0;
    it.age = -it.delay;
    it.dx = 0;
    // avoid stacking right on top of a fresh text at the same spot
    for (const o of items) {
      if (o === it || !o.on || o.age > 0.5) continue;
      if (Math.abs(o.x - x) < 120 && Math.abs(o.y - y) < 60) it.y = Math.min(it.y, o.y - (o.size + it.size) * 0.75);
    }
    paint(it);
  }

  function update(dt) {
    for (const it of items) {
      if (!it.on) continue;
      it.age += dt;
      if (it.age >= it.life) it.on = false;
    }
  }

  /** SCREEN space (ctx already scaled to logical px). */
  function render(ctx) {
    const v = game.view, cam = game.camera;
    for (const it of items) {
      if (!it.on || it.age < 0) continue;
      if (it.pScale !== v.scale || it.pEpoch !== fontEpoch) paint(it);
      const t = it.age / it.life;
      cam.worldToScreen(it.x, it.y, tmp);
      const pop = Math.min(1, it.age / 0.3);
      const scale = 0.5 + 0.5 * ease.outBack(pop);
      const alpha = Math.min(1, it.age / 0.07) * (1 - Math.max(0, (t - 0.68) / 0.32));
      if (alpha <= 0.004) continue;
      const rise = it.rise * ease.outCubic(Math.min(1, t * 1.15));
      const w = it.w * scale, h = it.h * scale;
      const sx = clamp(tmp.x, w * 0.5 + 12, v.w - w * 0.5 - 12);
      // keep clear of the HUD strip along the top edge
      const sy = clamp(tmp.y - rise, h * 0.5 + TOP_SAFE, v.h - h * 0.5 - 10);
      ctx.globalAlpha = alpha;
      if (it.punch > 0 && it.age < 0.6) {
        const r = Math.sin(it.age * 26) * it.punch * (1 - it.age / 0.6) * 0.09;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(r);
        ctx.drawImage(it.canvas, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(it.canvas, sx - w / 2, sy - h / 2, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  const count = () => items.reduce((n, it) => n + (it.on ? 1 : 0), 0);
  return { spawn, update, render, count };
}
