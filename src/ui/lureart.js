// UI module — lure icons. The boat/FX artist's drawLure(ctx, lureId, x, y, size, angle, t) is loaded with a guarded
// dynamic import; until it exists (or if it throws) a glossy bead in the lure's colour stands in.
import { LURES_BY_ID } from '../data/lures.js';

let drawLureFn = null;
let loading = null;
const listeners = new Set();

/** Start loading the lure art once. onReady fires when the real drawer becomes available. */
export function loadLureArt(onReady) {
  if (onReady) listeners.add(onReady);
  if (!loading) {
    loading = import('../render/boat/lures.js')
      .then((m) => {
        if (m && typeof m.drawLure === 'function') {
          drawLureFn = m.drawLure;
          for (const fn of listeners) {
            try {
              fn();
            } catch { /* ignore */ }
          }
        }
      })
      .catch(() => { /* not written yet — the bead fallback is used */ });
  }
  return loading;
}
export const hasLureArt = () => !!drawLureFn;

/** Draw a lure icon centred at (x, y) fitting a `size` box. */
export function drawLureIcon(ctx, lureId, x, y, size, t = 0, angle = -0.62) {
  if (drawLureFn) {
    try {
      ctx.save();
      drawLureFn(ctx, lureId, x, y, size * 0.92, angle, t);
      ctx.restore();
      return;
    } catch {
      ctx.restore();
      drawLureFn = null; // broken art: fall back for good
    }
  }
  drawBead(ctx, LURES_BY_ID[lureId], x, y, size, t);
}

function drawBead(ctx, lure, x, y, size, t) {
  const color = (lure && lure.color) || '#d9796a';
  const r = size * 0.24;
  const by = y - size * 0.06 + Math.sin(t * 2.2) * size * 0.015;
  ctx.save();
  // line
  ctx.strokeStyle = 'rgba(220,240,255,0.55)';
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.5);
  ctx.lineTo(x, by - r);
  ctx.stroke();
  // hook
  ctx.strokeStyle = '#c9d4de';
  ctx.lineWidth = Math.max(1.2, size * 0.04);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, by + r * 0.6);
  ctx.lineTo(x, by + r * 1.55);
  ctx.arc(x - r * 0.45, by + r * 1.55, r * 0.45, 0, Math.PI, false);
  ctx.lineTo(x - r * 0.9, by + r * 1.25);
  ctx.stroke();
  // glow for glowing lures
  if (lure && lure.glow > 0.2) {
    const g = ctx.createRadialGradient(x, by, 0, x, by, r * 2.6);
    g.addColorStop(0, hexA(color, 0.55 * lure.glow));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3, by - r * 3, r * 6, r * 6);
  }
  // bead body
  const g = ctx.createRadialGradient(x - r * 0.35, by - r * 0.4, r * 0.1, x, by, r * 1.05);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, lighten(color, 0.35));
  g.addColorStop(0.65, color);
  g.addColorStop(1, darken(color, 0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, by, r, 0, Math.PI * 2);
  ctx.fill();
  // rim + glint
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(0.8, size * 0.012);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, by - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function parse(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexA(hex, a) {
  const c = parse(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function lighten(hex, t) {
  const c = parse(hex);
  return `rgb(${(c[0] + (255 - c[0]) * t) | 0},${(c[1] + (255 - c[1]) * t) | 0},${(c[2] + (255 - c[2]) * t) | 0})`;
}
function darken(hex, t) {
  const c = parse(hex);
  return `rgb(${(c[0] * (1 - t)) | 0},${(c[1] * (1 - t)) | 0},${(c[2] * (1 - t)) | 0})`;
}
