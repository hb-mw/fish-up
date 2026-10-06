// Foam, prop wash and lapping ripples around the hull (pooled particles, no per-frame garbage). BOAT ART module.
import { clamp, clamp01 } from '../../core/math.js';
import { softBlob } from './util.js';

const N = 160;

export function createWake(game) {
  const rng = game.rng.fork();
  const P = [];
  for (let i = 0; i < N; i++) P.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, rise: 0 });
  let cursor = 0;
  let foamAcc = 0, bubAcc = 0, slapT = 1, fxT = 0;
  const FOAM = 0, BUBBLE = 1, SLAP = 2, SPRAY = 3;

  function spawn(kind, x, y, vx, vy, life, size) {
    for (let k = 0; k < N; k++) {
      const p = P[cursor];
      cursor = (cursor + 1) % N;
      if (!p.on || k === N - 1) {
        p.on = true;
        p.kind = kind;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = 0;
        p.max = life;
        p.size = size;
        p.rise = 0;
        return p;
      }
    }
    return null;
  }

  /**
   * B = { x, y, vx, throttle, facing, stern (world x), bow (world x), propX, propY, draft, length, tier }
   */
  function update(dt, B) {
    const waves = game.world.waves;
    const speed = Math.abs(B.vx);
    const under = clamp01(speed / 260);
    const thr = Math.abs(B.throttle);
    const dir = B.vx >= 0 ? 1 : -1;
    // stern wash + trailing wake foam
    foamAcc += dt * (under * 70 + thr * 22);
    while (foamAcc >= 1) {
      foamAcc -= 1;
      const x = B.stern - B.facing * rng.range(-6, 22);
      spawn(FOAM, x, rng.range(-3, 3), -dir * speed * rng.range(0.05, 0.25) + rng.range(-10, 10), 0, rng.range(1.6, 3.6), rng.range(13, 26) * (0.6 + under));
      // bow wave curls
      if (under > 0.12 && rng.next() < 0.85) {
        const bx = B.bow - B.facing * rng.range(4, 40);
        spawn(FOAM, bx, rng.range(-4, 2), -dir * speed * rng.range(0.4, 0.8), 0, rng.range(0.7, 1.5), rng.range(8, 16) * (0.4 + under));
      }
    }
    // underwater prop wash
    bubAcc += dt * (thr * 90 + under * 30);
    while (bubAcc >= 1) {
      bubAcc -= 1;
      const back = -B.facing * Math.sign(B.throttle || 1);
      spawn(BUBBLE, B.propX + back * rng.range(0, 8), B.propY + rng.range(-5, 5), back * rng.range(60, 180) + B.vx * 0.3, rng.range(-30, 10), rng.range(0.5, 1.2), rng.range(1.2, 3.2));
    }
    // spray off the bow when running fast through chop
    if (under > 0.6 && rng.next() < dt * 18 * under) {
      spawn(SPRAY, B.bow, waves.heightAt(B.bow) - 2, dir * rng.range(10, 60), -rng.range(40, 110), rng.range(0.4, 0.8), rng.range(1.5, 3));
    }
    // gentle lapping slaps at rest
    slapT -= dt;
    if (slapT <= 0) {
      slapT = rng.range(0.5, 1.4);
      const end = rng.next() < 0.5 ? B.stern : B.bow;
      spawn(SLAP, end + rng.range(-12, 12), 0, rng.range(-6, 6), 0, rng.range(1.0, 1.8), rng.range(8, 16));
    }
    // effects module hook (no-op until the effects engineer implements it)
    fxT -= dt;
    if (under > 0.05 && fxT <= 0) {
      fxT = 0.06;
      try {
        game.fx.wake(B.stern, waves.heightAt(B.stern), dir, under);
      } catch (e) { /* optional */ }
    }
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.on = false;
        continue;
      }
      if (p.kind === BUBBLE) {
        p.vx *= Math.exp(-dt * 3);
        p.vy -= 60 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.kind === SPRAY) {
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.vx *= Math.exp(-dt * 1.2);
        p.x += p.vx * dt;
        // the far arm of the wake drifts back toward the horizon (slightly up the screen) as it spreads
        p.rise = Math.min(9, p.life * 3.2);
      }
    }
  }

  /** Draw in WORLD space. amb = [r,g,b] ambient (foam takes the light of the hour). */
  function draw(ctx, amb, night) {
    const waves = game.world.waves;
    const b = game.camera.bounds;
    const fr = clamp(amb[0] * 0.9 + 25, 0, 255) | 0, fg = clamp(amb[1] * 0.92 + 25, 0, 255) | 0, fb = clamp(amb[2] * 0.95 + 25, 0, 255) | 0;
    const blob = softBlob(64, 0.3, `${fr & ~7},${fg & ~7},${fb & ~7}`);
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (!p.on) continue;
      if (p.x < b.left - 40 || p.x > b.right + 40) continue;
      const k = p.life / p.max;
      if (p.kind === BUBBLE) {
        const a = (1 - k) * 0.7;
        ctx.globalAlpha = a;
        const r = p.size * (1 + k * 0.6);
        ctx.drawImage(blob, p.x - r, p.y - r, r * 2, r * 2);
        continue;
      }
      if (p.kind === SPRAY) {
        ctx.globalAlpha = (1 - k) * 0.8;
        const r = p.size;
        ctx.drawImage(blob, p.x - r, p.y - r, r * 2, r * 2);
        continue;
      }
      const s = waves.heightAt(p.x);
      const grow = p.kind === SLAP ? 0.4 + k * 1.2 : 0.6 + k * 0.9;
      const rx = p.size * grow, ry = rx * (p.kind === SLAP ? 0.18 : 0.26);
      const a = (p.kind === SLAP ? 0.42 : 0.72) * Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k);
      ctx.globalAlpha = a;
      ctx.drawImage(blob, p.x - rx, s - p.rise - ry + p.y * 0.3, rx * 2, ry * 2);
    }
    ctx.globalAlpha = 1;
  }

  return { update, draw };
}

