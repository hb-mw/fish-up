// SCREEN-space celebration layer on the crisp overlay: confetti (fluttering paper), coin pops, full-screen flashes.
// Struct-of-arrays, zero allocation per frame.
import { createRng } from '../../core/rng.js';

const PAPER = ['#ffd04a', '#ff6f61', '#4fd1c5', '#7aa8ff', '#c38bff', '#ffffff', '#7be08a', '#ff9ad1'];
const PAPER_BACK = PAPER.map((h) => {
  const n = parseInt(h.slice(1), 16);
  const f = 0.68;
  return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
});

export function createScreenLayer(game, sprites, cap = 360) {
  const rng = createRng(0x5c4ee7);
  const f32 = () => new Float32Array(cap);
  const P = {
    n: 0, x: f32(), y: f32(), vx: f32(), vy: f32(), age: f32(), dur: f32(), rot: f32(), vr: f32(),
    fl: f32(), vfl: f32(), w: f32(), h: f32(), ph: f32(), kind: new Uint8Array(cap), col: new Uint8Array(cap),
  };
  const flash = { color: '#ffffff', alpha: 0, time: 0.25, age: 1 };
  const coinIdx = sprites.base('coin');
  const starIdx = sprites.base('star');

  function add(kind, x, y) {
    if (P.n >= cap) return -1;
    const i = P.n++;
    P.kind[i] = kind;
    P.x[i] = x;
    P.y[i] = y;
    P.age[i] = 0;
    return i;
  }
  function remove(i) {
    const l = --P.n;
    if (i === l) return;
    P.x[i] = P.x[l]; P.y[i] = P.y[l]; P.vx[i] = P.vx[l]; P.vy[i] = P.vy[l]; P.age[i] = P.age[l]; P.dur[i] = P.dur[l];
    P.rot[i] = P.rot[l]; P.vr[i] = P.vr[l]; P.fl[i] = P.fl[l]; P.vfl[i] = P.vfl[l]; P.w[i] = P.w[l]; P.h[i] = P.h[l];
    P.ph[i] = P.ph[l]; P.kind[i] = P.kind[l]; P.col[i] = P.col[l];
  }

  /** Confetti burst from a SCREEN point (logical px). spread: 0 = straight up … 1 = wide fan. */
  function confetti(sx, sy, n, spread = 0.75, power = 1) {
    const room = cap - P.n;
    n = Math.min(n | 0, room);
    for (let k = 0; k < n; k++) {
      const i = add(0, sx + (rng.next() - 0.5) * 30, sy + (rng.next() - 0.5) * 16);
      if (i < 0) return;
      const a = -Math.PI / 2 + (rng.next() - 0.5) * Math.PI * spread * 1.4;
      const sp = (420 + rng.next() * 620) * power;
      P.vx[i] = Math.cos(a) * sp;
      P.vy[i] = Math.sin(a) * sp;
      P.dur[i] = 2.4 + rng.next() * 1.6;
      P.rot[i] = rng.next() * 6.28;
      P.vr[i] = (rng.next() - 0.5) * 9;
      P.fl[i] = rng.next() * 6.28;
      P.vfl[i] = 5 + rng.next() * 9;
      P.w[i] = 7 + rng.next() * 6;
      P.h[i] = 4 + rng.next() * 3;
      P.ph[i] = rng.next() * 6.28;
      P.col[i] = (rng.next() * PAPER.length) | 0;
    }
  }
  /** A shower of confetti falling from the top edge across the whole width. */
  function rain(n) {
    const v = game.view;
    const room = cap - P.n;
    n = Math.min(n | 0, room);
    for (let k = 0; k < n; k++) {
      const i = add(0, rng.next() * v.w, -20 - rng.next() * 140);
      if (i < 0) return;
      P.vx[i] = (rng.next() - 0.5) * 120;
      P.vy[i] = 60 + rng.next() * 160;
      P.dur[i] = 3.2 + rng.next() * 1.8;
      P.rot[i] = rng.next() * 6.28;
      P.vr[i] = (rng.next() - 0.5) * 8;
      P.fl[i] = rng.next() * 6.28;
      P.vfl[i] = 5 + rng.next() * 9;
      P.w[i] = 7 + rng.next() * 6;
      P.h[i] = 4 + rng.next() * 3;
      P.ph[i] = rng.next() * 6.28;
      P.col[i] = (rng.next() * PAPER.length) | 0;
    }
  }
  /** Spinning gold coins popping up from a SCREEN point. */
  function coins(sx, sy, n) {
    for (let k = 0; k < n; k++) {
      const i = add(1, sx + (rng.next() - 0.5) * 24, sy);
      if (i < 0) return;
      P.vx[i] = (rng.next() - 0.5) * 260;
      P.vy[i] = -(430 + rng.next() * 260);
      P.dur[i] = 0.9 + rng.next() * 0.35;
      P.age[i] = -k * 0.06;
      P.fl[i] = rng.next() * 6.28;
      P.vfl[i] = 9 + rng.next() * 6;
      P.w[i] = 19 + rng.next() * 5;
      P.ph[i] = rng.next();
    }
  }
  function screenFlash(color, alpha, time) {
    flash.color = color || '#ffffff';
    flash.alpha = Math.max(0, Math.min(1, alpha === undefined ? 0.4 : alpha));
    flash.time = Math.max(0.05, time || 0.25);
    flash.age = 0;
  }

  function update(dt) {
    for (let i = P.n - 1; i >= 0; i--) {
      let age = P.age[i] + dt;
      P.age[i] = age;
      if (age < 0) continue;
      if (age >= P.dur[i]) {
        remove(i);
        continue;
      }
      let vx = P.vx[i], vy = P.vy[i];
      if (P.kind[i] === 0) {
        // paper: strong air drag, gentle sway
        vy += 900 * dt;
        const f = 1 / (1 + 4.2 * dt);
        vx = vx * f + Math.sin(age * 2.6 + P.ph[i]) * 90 * dt;
        vy *= f;
      } else {
        vy += 1500 * dt;
        vx *= 1 / (1 + 0.6 * dt);
      }
      P.vx[i] = vx;
      P.vy[i] = vy;
      P.x[i] += vx * dt;
      P.y[i] += vy * dt;
      P.rot[i] += P.vr[i] * dt;
      P.fl[i] += P.vfl[i] * dt;
    }
    if (flash.age < flash.time) flash.age += dt;
  }

  /** ctx is the overlay, in logical SCREEN space (scaled by view.scale). */
  function render(ctx) {
    const v = game.view, s = v.scale;
    if (P.n) {
      const list = sprites.list;
      for (let i = 0; i < P.n; i++) {
        const age = P.age[i];
        if (age < 0) continue;
        const t = age / P.dur[i];
        const x = P.x[i], y = P.y[i];
        if (x < -40 || x > v.w + 40 || y > v.h + 40) continue;
        if (P.kind[i] === 0) {
          const a = t > 0.75 ? (1 - t) * 4 : 1;
          const c = Math.cos(P.rot[i]), sn = Math.sin(P.rot[i]);
          const fl = Math.cos(P.fl[i]);
          const fx = fl < 0 ? -fl : fl;
          ctx.globalAlpha = a;
          ctx.fillStyle = fl >= 0 ? PAPER[P.col[i]] : PAPER_BACK[P.col[i]];
          ctx.setTransform(s * c * (0.15 + 0.85 * fx), s * sn * (0.15 + 0.85 * fx), -s * sn, s * c, s * x, s * y);
          ctx.fillRect(-P.w[i] / 2, -P.h[i] / 2, P.w[i], P.h[i]);
        } else {
          const a = t > 0.7 ? (1 - t) / 0.3 : 1;
          const fl = Math.cos(P.fl[i]);
          const fx = 0.12 + 0.88 * (fl < 0 ? -fl : fl);
          const w = P.w[i];
          ctx.globalAlpha = a;
          ctx.setTransform(s * fx, 0, 0, s, s * x, s * y);
          ctx.drawImage(list[coinIdx], -w / 2, -w / 2, w, w);
          if (fx > 0.9) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = a * (fx - 0.9) * 10 * 0.9;
            ctx.setTransform(s, 0, 0, s, s * (x + w * 0.22), s * (y - w * 0.2));
            ctx.drawImage(list[starIdx], -w * 0.55, -w * 0.55, w * 1.1, w * 1.1);
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalAlpha = 1;
    }
    if (flash.age < flash.time && flash.alpha > 0) {
      const t = flash.age / flash.time;
      ctx.globalAlpha = flash.alpha * (1 - t) * (1 - t);
      ctx.fillStyle = flash.color;
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
  }

  return { confetti, rain, coins, screenFlash, update, render, count: () => P.n };
}
