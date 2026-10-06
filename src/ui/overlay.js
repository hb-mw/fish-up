// UI module — world-anchored indicators on the crisp overlay canvas (SCREEN space, logical px):
// cast power meter by the angler, the bite alert ("!" + shrinking ring + SPACE cap) at the lure,
// and an off-screen arrow toward the lure / hooked fish. Sprites and gradients are cached; no per-frame garbage.
import { rarityOf, WORLD } from '../core/config.js';

const FONT = (w, s) => `${w} ${s}px "FishUp Display", Fredoka, "Baloo 2", ui-rounded, system-ui, sans-serif`;
const F_BANG = FONT(700, 46);
const F_KEY = FONT(700, 17);
const F_LAB = FONT(600, 15);
const F_ARROW = FONT(700, 16);
const TAU = Math.PI * 2;

function makeGlow(size, inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.45, outer);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

function roundRect(o, x, y, w, h, r) {
  o.beginPath();
  o.moveTo(x + r, y);
  o.arcTo(x + w, y, x + w, y + h, r);
  o.arcTo(x + w, y + h, x, y + h, r);
  o.arcTo(x, y + h, x, y, r);
  o.arcTo(x, y, x + w, y, r);
  o.closePath();
}

export function createOverlay(ui) {
  const { game } = ui;
  const P = { x: 0, y: 0 };
  const Q = { x: 0, y: 0 };
  let glowGold = null, glowRed = null, glowCyan = null;
  let castGrad = null, keyGrad = null, badgeGrad = null;
  let biteAt = -1;
  let lastState = '';

  function sprites() {
    if (glowGold) return;
    glowGold = makeGlow(256, 'rgba(255, 220, 120, 0.85)', 'rgba(255, 170, 40, 0.28)');
    glowRed = makeGlow(256, 'rgba(255, 120, 90, 0.8)', 'rgba(255, 60, 40, 0.22)');
    glowCyan = makeGlow(128, 'rgba(140, 240, 255, 0.7)', 'rgba(60, 190, 255, 0.2)');
  }

  // ── cast power: a bar in front of / above the angler (the rod swings BACK while charging) ──
  function castMeter(o, charge, t) {
    const boat = game.boat;
    game.camera.worldToScreen(boat.rod.grip.x, boat.rod.grip.y, P);
    const face = boat.facing || 1;
    const W = 200, H = 16;
    const cx = Math.max(130, Math.min(game.view.w - 130, P.x + face * 70));
    const cy = Math.max(70, P.y - 178);
    const k = Math.max(0, Math.min(1, charge));
    const x = cx - W / 2;
    o.save();
    // plate
    roundRect(o, x - 12, cy - 40, W + 24, 68, 18);
    o.fillStyle = 'rgba(6, 18, 34, 0.72)';
    o.fill();
    o.lineWidth = 1.2;
    o.strokeStyle = 'rgba(190, 225, 255, 0.3)';
    o.stroke();
    // labels
    o.font = F_LAB;
    o.textBaseline = 'middle';
    o.textAlign = 'left';
    o.fillStyle = 'rgba(205, 228, 250, 0.85)';
    o.fillText('CAST POWER', x, cy - 20);
    o.font = F_KEY;
    o.textAlign = 'right';
    o.fillStyle = k > 0.96 ? '#ffd25a' : '#ffffff';
    o.fillText(k > 0.96 ? 'MAX!' : `${Math.round(k * 100)}%`, x + W, cy - 20);
    // track
    roundRect(o, x, cy, W, H, H / 2);
    o.fillStyle = 'rgba(255, 255, 255, 0.1)';
    o.fill();
    if (!castGrad) {
      castGrad = o.createLinearGradient(0, 0, W, 0);
      castGrad.addColorStop(0, '#2fd6c8');
      castGrad.addColorStop(0.5, '#ffd25a');
      castGrad.addColorStop(0.82, '#ff9a3c');
      castGrad.addColorStop(1, '#ff5a3c');
    }
    const fw = Math.max(H, W * k);
    o.save();
    o.translate(x, cy);
    roundRect(o, 0, 0, fw, H, H / 2);
    o.fillStyle = castGrad;
    o.fill();
    o.fillStyle = 'rgba(255, 255, 255, 0.35)';
    roundRect(o, 3, 2, Math.max(0, fw - 6), H / 2 - 2, (H / 2 - 2) / 2);
    o.fill();
    o.restore();
    // quarter ticks
    o.fillStyle = 'rgba(6, 18, 34, 0.5)';
    for (let i = 1; i < 4; i++) o.fillRect(x + (W * i) / 4 - 0.75, cy + 3, 1.5, H - 6);
    // glowing head
    const hx = x + fw - H / 2;
    if (k > 0.96) {
      sprites();
      o.globalCompositeOperation = 'lighter';
      o.globalAlpha = 0.6 + 0.4 * Math.sin(t * 18);
      o.drawImage(glowGold, hx - 80, cy + H / 2 - 80, 160, 160);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
    }
    o.fillStyle = '#ffffff';
    o.beginPath();
    o.arc(hx, cy + H / 2, H / 2 + 2, 0, TAU);
    o.fill();
    o.restore();
  }

  // ── bite alert ─────────────────────────────────────────────────────────────
  function keyCap(o, cx, cy, text, w, scale) {
    const h = 34;
    o.save();
    o.translate(cx, cy);
    o.scale(scale, scale);
    roundRect(o, -w / 2, -h / 2 + 4, w, h, 9);
    o.fillStyle = 'rgba(10, 24, 44, 0.85)';
    o.fill();
    roundRect(o, -w / 2, -h / 2, w, h, 9);
    if (!keyGrad) {
      keyGrad = o.createLinearGradient(0, -h / 2, 0, h / 2);
      keyGrad.addColorStop(0, '#ffffff');
      keyGrad.addColorStop(1, '#d6e4f2');
    }
    o.fillStyle = keyGrad;
    o.fill();
    o.font = F_KEY;
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = '#10243e';
    o.fillText(text, 0, 1);
    o.restore();
  }

  function biteAlert(o, t) {
    const f = game.fishing;
    const cam = game.camera, v = game.view;
    cam.worldToScreen(f.lure.x, f.lure.y, P);
    sprites();
    const since = t - biteAt;
    const pop = since < 0.5 ? 1 + 0.55 * Math.exp(-since * 9) * Math.cos(since * 22) : 1;
    const remain = f.biteWindow > 0 ? Math.max(0, 1 - f.biteT / f.biteWindow) : 1;
    // badge placement: above the lure, clamped into view
    let bx = Math.max(70, Math.min(v.w - 70, P.x));
    let by = P.y - 92;
    if (by < 90) by = P.y + 96;
    by = Math.max(80, Math.min(v.h - 150, by));
    o.save();
    // glow
    const pulse = 0.75 + 0.25 * Math.sin(t * 16);
    o.globalCompositeOperation = 'lighter';
    o.globalAlpha = 0.85 * pulse;
    o.drawImage(remain < 0.35 ? glowRed : glowGold, bx - 120, by - 120, 240, 240);
    o.globalAlpha = 0.5;
    o.drawImage(glowCyan, P.x - 40, P.y - 40, 80, 80);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    // tether from badge to lure
    o.strokeStyle = 'rgba(255, 236, 170, 0.55)';
    o.lineWidth = 2;
    o.setLineDash([4, 5]);
    o.beginPath();
    o.moveTo(bx, by + (by < P.y ? 40 : -40));
    o.lineTo(P.x, P.y + (by < P.y ? -10 : 10));
    o.stroke();
    o.setLineDash([]);
    o.translate(bx, by);
    o.scale(pop, pop);
    // ring timer
    const R = 44;
    o.lineWidth = 7;
    o.strokeStyle = 'rgba(6, 16, 30, 0.6)';
    o.beginPath();
    o.arc(0, 0, R, 0, TAU);
    o.stroke();
    const col = remain > 0.6 ? '#62f0a0' : remain > 0.3 ? '#ffd25a' : '#ff5a4a';
    o.strokeStyle = col;
    o.lineCap = 'round';
    o.beginPath();
    o.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * remain, false);
    o.stroke();
    // badge
    o.beginPath();
    o.arc(0, 0, 33, 0, TAU);
    if (!badgeGrad) {
      badgeGrad = o.createRadialGradient(-8, -10, 4, 0, 0, 34);
      badgeGrad.addColorStop(0, '#fffdf2');
      badgeGrad.addColorStop(1, '#ffe08a');
    }
    o.fillStyle = badgeGrad;
    o.fill();
    o.lineWidth = 3;
    o.strokeStyle = '#c47a14';
    o.stroke();
    o.font = F_BANG;
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = '#d6301e';
    o.fillText('!', 0, 3);
    o.restore();
    // key-cap: on the far side of the badge from the lure, so it never covers the fish
    const kb = 1 + 0.08 * Math.max(0, Math.sin(t * 14));
    keyCap(o, bx, by < P.y ? by - 76 : by + 76, 'SPACE!', 104, kb);
  }

  // ── off-screen arrow ───────────────────────────────────────────────────────
  function offscreen(o, st, t) {
    const f = game.fishing, v = game.view;
    const target = st === 'fight' && f.hooked ? f.hooked : f.lure;
    if (st !== 'fight' && !f.lure.visible) return;
    game.camera.worldToScreen(target.x, target.y, P);
    const m = 30;
    if (P.x > m && P.x < v.w - m && P.y > m && P.y < v.h - m) return;
    // clamp into an inset rectangle that stays clear of the HUD bands (top bar, prompt, gauge)
    const L = 90, R = v.w - 120, T = 130, B = v.h - 160;
    const cx = v.w / 2, cy = (T + B) / 2;
    const dx = P.x - cx, dy = P.y - cy;
    const sx = dx > 0 ? (R - cx) / dx : dx < 0 ? (L - cx) / dx : Infinity;
    const sy = dy > 0 ? (B - cy) / dy : dy < 0 ? (T - cy) / dy : Infinity;
    const s = Math.min(sx, sy);
    Q.x = cx + dx * s;
    Q.y = cy + dy * s;
    const a = Math.atan2(dy, dx);
    const hot = st === 'bite' || (st === 'fight' && f.tension >= 1);
    let col = hot ? '#ffcf5a' : '#e8f4ff';
    if (st === 'fight' && f.hooked && !hot) {
      const dex = game.player.dex || {};
      if (dex[f.hooked.speciesId] && dex[f.hooked.speciesId].count > 0) col = rarityOf(f.hooked.species.level).color;
    }
    const bob = Math.sin(t * 6) * 4;
    o.save();
    o.translate(Q.x + Math.cos(a) * bob, Q.y + Math.sin(a) * bob);
    o.beginPath();
    o.arc(0, 0, 26, 0, TAU);
    o.fillStyle = 'rgba(6, 18, 34, 0.72)';
    o.fill();
    o.lineWidth = 2;
    o.strokeStyle = col;
    o.stroke();
    o.rotate(a);
    o.beginPath();
    o.moveTo(36, 0);
    o.lineTo(22, -10);
    o.lineTo(22, 10);
    o.closePath();
    o.fillStyle = col;
    o.fill();
    o.rotate(-a);
    o.font = F_ARROW;
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = col;
    const lab = st === 'bite' ? '!' : `${Math.round(Math.max(0, target.y) / WORLD.pxPerM)}m`;
    o.fillText(lab, 0, 1);
    o.restore();
  }

  return {
    render(o) {
      if (ui.cardOpen) return;
      const f = game.fishing;
      const st = f.state;
      const t = game.time.real;
      if (st !== lastState) {
        if (st === 'bite') biteAt = t;
        lastState = st;
      }
      if (st === 'charging') castMeter(o, f.charge, t);
      if (st === 'bite' && f.lure.visible !== false) biteAlert(o, t);
      if (st === 'waiting' || st === 'bite' || st === 'fight') offscreen(o, st, t);
    },
  };
}
