// Small live-drawn boat props: lantern & pole, flag, propeller, the hull's shadow in the water, and the
// additive glows of the lamp and cabin lights. BOAT ART module. Boat-local unless noted.
import { clamp, clamp01, lerp, smoothstep, TAU } from '../../core/math.js';
import { makeCanvas } from './util.js';

// ── lantern & pole ────────────────────────────────────────────────────────────
export function drawLampPole(g, T, lan) {
  const p = T.lampPole;
  if (!p) {
    // tiers 1–2: the lantern hangs from a hook under the hardtop / bridge
    const h = T.lampHook;
    if (!h) return;
    g.strokeStyle = '#3a3f44';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(h.x - 3, h.y);
    g.lineTo(h.x, h.y + 1.5);
    g.lineTo(h.x + 3, h.y);
    g.moveTo(h.x, h.y + 1.5);
    g.lineTo(h.x, -163);
    g.stroke();
    return;
  }
  const topY = p.y1;
  g.strokeStyle = '#5b3a20';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(p.x, p.y0);
  g.lineTo(p.x, topY + 4);
  g.stroke();
  g.strokeStyle = 'rgba(255,220,170,0.35)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(p.x - 0.7, p.y0);
  g.lineTo(p.x - 0.7, topY + 5);
  g.stroke();
  // gooseneck arm to the hanging hook
  const hx = lan.pivotX ?? -120, hy = lan.pivotY ?? -163;
  g.strokeStyle = '#3a3f44';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(p.x, topY + 4);
  g.quadraticCurveTo(p.x, topY - 4, (p.x + hx) / 2 + 2, topY - 3);
  g.quadraticCurveTo(hx, topY - 2, hx, hy);
  g.stroke();
}

/** Hurricane lantern hanging from (cx, cy − 13), swinging by `swing`. lit 0..1. */
export function drawLantern(g, cx, cy, swing, lit, t) {
  g.save();
  g.translate(cx, cy);
  g.rotate(swing);
  // bail
  g.strokeStyle = '#2c3034';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-5, -9);
  g.quadraticCurveTo(0, -17, 5, -9);
  g.stroke();
  // top cap
  g.fillStyle = '#7a2a22';
  g.beginPath();
  g.moveTo(-6.5, -7);
  g.lineTo(6.5, -7);
  g.lineTo(3.5, -11);
  g.lineTo(-3.5, -11);
  g.closePath();
  g.fill();
  g.fillStyle = '#4a1914';
  g.fillRect(-2, -12.5, 4, 1.8);
  // glass globe
  const on = clamp01(lit);
  const gg = g.createRadialGradient(0, 0.5, 0.5, 0, 0, 7);
  if (on > 0.02) {
    gg.addColorStop(0, `rgba(255,252,230,${0.5 + 0.5 * on})`);
    gg.addColorStop(0.45, `rgba(255,214,130,${0.35 + 0.6 * on})`);
    gg.addColorStop(1, `rgba(220,140,70,${0.25 + 0.5 * on})`);
  } else {
    gg.addColorStop(0, 'rgba(230,240,245,0.35)');
    gg.addColorStop(1, 'rgba(160,180,190,0.55)');
  }
  g.fillStyle = gg;
  g.beginPath();
  g.ellipse(0, 0, 5.4, 6.8, 0, 0, TAU);
  g.fill();
  // flame / wick
  if (on > 0.02) {
    const fl = 1 + 0.12 * Math.sin(t * 17) * Math.sin(t * 5.3);
    g.fillStyle = `rgba(255,255,240,${on})`;
    g.beginPath();
    g.moveTo(0, -3.6 * fl);
    g.quadraticCurveTo(1.8, 0.2, 0, 2.2);
    g.quadraticCurveTo(-1.8, 0.2, 0, -3.6 * fl);
    g.fill();
  } else {
    g.fillStyle = '#3b2b20';
    g.fillRect(-0.8, 1, 1.6, 1.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(-3.2, -3.5, 1, 4);
  }
  // wire guards
  g.strokeStyle = '#3a3f44';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(-2.6, -7);
  g.quadraticCurveTo(-7.4, 0, -2.6, 7);
  g.moveTo(2.6, -7);
  g.quadraticCurveTo(7.4, 0, 2.6, 7);
  g.stroke();
  // fuel base
  g.fillStyle = '#7a2a22';
  g.beginPath();
  g.roundRect(-6, 6.2, 12, 4.4, 1.6);
  g.fill();
  g.fillStyle = 'rgba(255,200,170,0.35)';
  g.fillRect(-5, 6.8, 6, 0.9);
  g.restore();
}

// ── flag ──────────────────────────────────────────────────────────────────────
const FLAG_N = 9;
const _fx = new Float32Array(FLAG_N + 1), _fy = new Float32Array(FLAG_N + 1);
/** Pennant on a staff; wind = apparent wind in world px/s (+ = blowing to world +x). */
export function drawFlag(g, F, ph, wind, facing, t) {
  const top = F.y1;
  g.strokeStyle = '#4b3420';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(F.x, F.y0);
  g.lineTo(F.x, top - 2);
  g.stroke();
  g.fillStyle = '#d9b45a';
  g.beginPath();
  g.arc(F.x, top - 3, 1.4, 0, TAU);
  g.fill();
  const str = clamp01(Math.abs(wind) / 110);
  const dir = (wind >= 0 ? 1 : -1) * facing; // local direction the flag streams
  const L = 24, H = 13, n = FLAG_N;
  // limp → hangs down along the staff; strong → streams out flat
  const droop = (1 - str) * 1.2;
  const ca = Math.cos(droop), sa = Math.sin(droop);
  // the fly line (top edge) leaves the hoist and bends with the travelling wave
  const amp = lerp(1.2, 3.2, str);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const along = k * L;
    const w = Math.sin(ph - k * 3.4) * amp * k;
    _fx[i] = F.x + dir * (along * ca) - dir * w * sa;
    _fy[i] = top + along * sa + w * ca;
  }
  // the bottom edge sits a tapering height "below" the top edge, perpendicular to the fly direction
  const px = -dir * sa, py = ca; // unit normal pointing to the flag's lower side
  g.beginPath();
  g.moveTo(F.x, top);
  for (let i = 1; i <= n; i++) g.lineTo(_fx[i], _fy[i]);
  for (let i = n; i >= 0; i--) {
    const h = H * (1 - (i / n) * 0.92);
    g.lineTo(_fx[i] + px * h, _fy[i] + py * h);
  }
  g.closePath();
  const grad = g.createLinearGradient(F.x, top, F.x + dir * L * ca, top + L * sa);
  grad.addColorStop(0, '#c8372d');
  grad.addColorStop(1, '#e2563f');
  g.fillStyle = grad;
  g.fill();
  // white stripe + shading folds
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = H * 0.2;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const h = H * (1 - (i / n) * 0.92) * 0.48;
    const x = _fx[i] + px * h, y = _fy[i] + py * h;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  for (let i = 1; i < n; i += 2) {
    const sh = Math.sin(ph - (i / n) * 3.4);
    g.fillStyle = sh > 0 ? `rgba(255,255,255,${0.12 * sh})` : `rgba(60,0,0,${-0.18 * sh})`;
    g.beginPath();
    g.moveTo(_fx[i], _fy[i]);
    g.lineTo(_fx[i + 1], _fy[i + 1]);
    g.lineTo(_fx[i + 1] + px * H, _fy[i + 1] + py * H);
    g.lineTo(_fx[i] + px * H, _fy[i] + py * H);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// ── propeller ────────────────────────────────────────────────────────────────
export function drawProp(g, P, a, throttle, tierId) {
  const thr = Math.abs(throttle);
  const x = P.x, y = P.y, r = P.r;
  if (thr > 0.35) {
    // motion blur disc
    g.fillStyle = 'rgba(190,160,100,0.38)';
    g.beginPath();
    g.ellipse(x, y, 2.6, r, 0, 0, TAU);
    g.fill();
  }
  const blades = 3;
  g.fillStyle = thr > 0.35 ? 'rgba(176,138,74,0.5)' : '#b08a4a';
  for (let i = 0; i < blades; i++) {
    const ang = a + (i * TAU) / blades;
    const h = Math.cos(ang) * r;
    const depth = Math.sin(ang);
    if (Math.abs(h) < 0.6) continue;
    g.beginPath();
    g.ellipse(x - depth * 0.6, y + h / 2, 2.4, Math.abs(h) / 2, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#6b5636';
  g.beginPath();
  g.ellipse(x + 1, y, 3.2, 2.6, 0, 0, TAU);
  g.fill();
}

// ── the hull's shadow in the water (WORLD space, under the boat) ─────────────────
let shadowSpr = null;
function shadowSprite() {
  if (shadowSpr) return shadowSpr;
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 26, 4, 64, 40, 66);
  gr.addColorStop(0, 'rgba(4,18,32,1)');
  gr.addColorStop(0.45, 'rgba(4,18,32,0.55)');
  gr.addColorStop(1, 'rgba(4,18,32,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  // soften the top so it never shows above the waterline
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 30);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = v;
  g.fillRect(0, 0, 128, 128);
  shadowSpr = c;
  return c;
}
export function drawShadowUnder(ctx, game, T, visF) {
  const b = game.boat, env = game.env;
  const strength = 0.3 * (0.25 + 0.75 * env.daylight) * (1 - 0.55 * smoothstep(0.3, 1, env.weather.cloud));
  if (strength < 0.02) return;
  const spr = shadowSprite();
  const len = (T.bow - T.stern) * 1.08;
  const cx = b.x + ((T.stern + T.bow) / 2) * visF;
  // light from the sun's side shears the shadow away from it
  const shear = clamp((0.5 - env.sun.x) * 1.1, -0.55, 0.55) * env.daylight;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.translate(cx, b.y + 6);
  ctx.transform(1, 0, shear, 1, 0, 0);
  ctx.drawImage(spr, -len / 2, -12, len, 330);
  ctx.restore();
}

// ── additive glows (WORLD space, composite 'lighter') ───────────────────────────
let coneSpr = null;
function coneSprite() {
  if (coneSpr) return coneSpr;
  const W = 128, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  // soft elliptical falloff that reaches exactly zero at the sprite edges
  g.save();
  g.translate(W / 2, 0);
  g.scale(1, H / (W / 2));
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, W / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.62)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gr.addColorStop(0.8, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-W / 2, 0, W, W / 2);
  g.restore();
  // a few faint shafts fanning down, fading before the edges
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = -0.3 + i * 0.12;
    const ex = W / 2 + Math.sin(a) * H * 0.75, ey = H * 0.75;
    const ray = g.createLinearGradient(W / 2, 0, ex, ey);
    ray.addColorStop(0, 'rgba(255,255,255,0.16)');
    ray.addColorStop(0.6, 'rgba(255,255,255,0.05)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = ray;
    g.lineWidth = 2 + (i % 3) * 1.6;
    g.beginPath();
    g.moveTo(W / 2, 2);
    g.lineTo(ex, ey);
    g.stroke();
  }
  coneSpr = c;
  return c;
}

/** Lamp: warm halo, a soft cone of light down into the water, a glint on the sea, moths. */
export function drawLampGlow(ctx, game, lx, ly, k, t) {
  const env = game.env;
  const vis = k * (0.2 + 0.8 * (1 - env.daylight));
  if (vis < 0.01) return;
  const flick = 0.95 + 0.05 * Math.sin(t * 13.1) * Math.sin(t * 7.3);
  const waves = game.world.waves;
  const sy = waves.heightAt(lx);
  // underwater: a soft warm-to-green cone, gently breathing
  ctx.save();
  ctx.beginPath();
  ctx.rect(lx - 300, sy + 2, 600, 640);
  ctx.clip();
  const spr = coneSprite();
  const breathe = 1 + 0.04 * Math.sin(t * 0.7);
  ctx.globalAlpha = 0.2 * vis * flick;
  ctx.drawImage(spr, lx - 190 * breathe, sy - 8, 380 * breathe, 600);
  ctx.globalAlpha = 1;
  const tint = ctx.createRadialGradient(lx, sy, 0, lx, sy, 260);
  tint.addColorStop(0, `rgba(255,190,110,${0.12 * vis})`);
  tint.addColorStop(0.5, `rgba(110,200,160,${0.05 * vis})`);
  tint.addColorStop(1, 'rgba(80,170,150,0)');
  ctx.fillStyle = tint;
  ctx.fillRect(lx - 260, sy, 520, 260);
  ctx.restore();
  // the light caught on the sea surface around the boat (a thin warm sheen on the far sea)
  ctx.save();
  ctx.translate(lx, sy - 3);
  ctx.scale(1, 0.06);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
  pool.addColorStop(0, `rgba(255,205,140,${0.28 * vis * flick})`);
  pool.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(-170, -170, 340, 340);
  ctx.restore();
  // halo around the lantern
  const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 130);
  halo.addColorStop(0, `rgba(255,236,190,${0.5 * vis * flick})`);
  halo.addColorStop(0.1, `rgba(255,205,135,${0.3 * vis * flick})`);
  halo.addColorStop(0.4, `rgba(255,170,90,${0.07 * vis})`);
  halo.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(lx - 130, ly - 130, 260, 260);
  const core = ctx.createRadialGradient(lx, ly, 0, lx, ly, 11);
  core.addColorStop(0, `rgba(255,255,240,${0.85 * k})`);
  core.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = core;
  ctx.fillRect(lx - 11, ly - 11, 22, 22);
  // moths circling the light
  for (let i = 0; i < 3; i++) {
    const ph = t * (2.3 + i * 0.7) + i * 2.1;
    const r = 16 + i * 7 + Math.sin(t * 3.1 + i) * 4;
    const mx = lx + Math.cos(ph) * r, my = ly - 4 + Math.sin(ph * 1.3) * r * 0.6;
    const flap = 0.6 + 0.4 * Math.abs(Math.sin(t * 40 + i));
    ctx.fillStyle = `rgba(255,240,205,${0.7 * vis})`;
    ctx.beginPath();
    ctx.ellipse(mx, my, 1.4 * flap, 0.9, ph, 0, TAU);
    ctx.fill();
  }
}

/** Cabin windows & navigation lights of tiers 1–2 (only visible when it gets dark). */
export function drawCabinGlow(ctx, game, T, visF, t) {
  const env = game.env, b = game.boat;
  const dark = smoothstep(0.25, 0.8, env.night);
  if (dark < 0.01) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.scale(visF, 1);
  for (const w of T.windows) {
    ctx.fillStyle = `rgba(255,196,120,${0.5 * dark})`;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 2);
    ctx.fill();
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2, r = Math.max(w.w, w.h) * 1.4;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,190,110,${0.22 * dark})`);
    g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  if (T.nav) {
    // the side we see: starboard (green) when facing right, port (red) when facing left
    const side = visF >= 0 ? [90, 255, 140] : [255, 70, 60];
    const list = [[T.nav.side, side], [T.nav.mast, [255, 250, 235]]];
    for (const [p, c] of list) {
      if (!p) continue;
      const tw = 0.85 + 0.15 * Math.sin(t * 3 + p.x);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.9 * dark * tw})`);
      g.addColorStop(0.2, `rgba(${c[0]},${c[1]},${c[2]},${0.35 * dark})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
    }
  }
  ctx.restore();
}

