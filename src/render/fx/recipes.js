// Effect recipes: how each effect is assembled from pooled particles.
// All sizes are WORLD px at zoom 1. Splashes are anchored to the real sea surface (waves.heightAt):
// droplets are born at it and die when they fall back through it.
import { K, F, spawn } from './pool.js';
import { clamp } from '../../core/math.js';

const TAU = Math.PI * 2;
const G = 1500; // splash gravity, px/s²

/**
 * @param {object} C  shared context: { game, rng, S (sprite ids), P (pools), sprites, surf(x), budget(), near(x,y,m) }
 */
export function createRecipes(C) {
  const { rng, S, P, sprites } = C;
  const R = () => rng.next();
  const gauss = () => (R() + R() + R() - 1.5) * 1.15;
  const count = (base) => Math.max(0, Math.round(base * C.budget()));
  const foamSpr = () => S.foamLit[(R() * 3) | 0];

  // ── splash ────────────────────────────────────────────────────────────────────────────────────
  /**
   * Water splash at the surface. size 0.3 lure plop … 1 fish … 3 whale breach.
   * opts: { kind: 'lure'|'fish'|'jump'|'boat'|'land', dir: −1..1 horizontal bias }
   */
  function splash(x, size = 1, opts) {
    const kind = (opts && opts.kind) || 'fish';
    const exit = !!(opts && opts.exit); // a body leaving the water: no jet, water dragged along its path
    const dir = clamp((opts && opts.dir) || 0, -1, 1) * (exit ? 1.6 : 1);
    const s = clamp(size, 0.12, 4);
    const rs = Math.sqrt(s);
    const sy = C.surf(x);
    if (!C.near(x, sy, 300 + 200 * s)) return;
    const air = P.air;

    const sg = Math.pow(s, 0.62); // speed scale
    // crown: two coherent curtains of water (a fan of streaks per side) thrown up and out
    const nSheet = count((kind === 'lure' ? 6 : 8) + 16 * s);
    const vmax = (300 + R() * 90) * sg * (kind === 'land' ? 0.5 : 1);
    const lobe0 = 0.34 + R() * 0.12, lobe1 = 0.34 + R() * 0.12;
    for (let k = 0; k < nSheet; k++) {
      const side = k % 2 ? 1 : -1;
      const ang = side * ((side > 0 ? lobe1 : lobe0) + (R() - 0.35) * 0.5) + dir * 0.3;
      const sp = vmax * (0.4 + 0.6 * Math.pow(R(), 0.6));
      const i = spawn(air, K.SHEET, S.sheetLit, x + side * (2 + R() * 9) * s, sy - 1);
      if (i < 0) break;
      air.vx[i] = Math.sin(ang) * sp;
      air.vy[i] = -Math.cos(ang) * sp;
      air.g[i] = 1350;
      air.drag[i] = 0.7;
      air.s0[i] = (4 + R() * 6) * (0.6 + 0.4 * s);
      air.s1[i] = air.s0[i] * 1.6;
      air.dur[i] = (0.5 + R() * 0.35) * (0.8 + 0.25 * rs);
      air.a0[i] = 0.82;
      air.st[i] = 0.0055;
      air.age[i] = -R() * 0.04;
      air.flags[i] = F.SURF_KILL | F.STRETCH | (R() < 0.4 ? F.FOAMDROP : 0);
    }
    // column (Worthington jet): stacked blobs aimed at staggered heights, a beat after impact —
    // a soft sheath plus a solid bright core
    if (kind !== 'boat' && kind !== 'land' && !exit) {
      const H = (12 + 105 * Math.pow(s, 0.92)) * (0.85 + R() * 0.3) * (kind === 'lure' ? 0.75 : 1);
      const nCol = Math.max(3, count(5 + 7 * s));
      const delay = 0.05 + 0.05 * rs;
      for (let j = 0; j < nCol; j++) {
        const h = H * (0.25 + (0.75 * (j + 1)) / nCol);
        const vy0 = -Math.sqrt(2 * G * h);
        const taper = 1 - (0.35 * j) / nCol;
        for (let layer = 0; layer < 2; layer++) {
          const i = spawn(air, K.SHEET, layer ? S.dropLit : S.sheetLit, x + (R() - 0.5) * 4 * s, sy);
          if (i < 0) break;
          air.vx[i] = (R() - 0.5) * 14 * s + dir * 40 * rs;
          air.vy[i] = vy0 * (layer ? 0.985 : 1);
          air.g[i] = G;
          air.drag[i] = 0.15;
          air.s0[i] = (6 + 6 * s) * taper * (layer ? 0.5 : 1);
          air.s1[i] = air.s0[i] * (layer ? 1.1 : 1.5);
          air.dur[i] = (2 * -vy0) / G + 0.2;
          air.age[i] = -delay;
          air.a0[i] = layer ? 0.9 : 0.8;
          air.st[i] = layer ? 0.0026 : 0.0032;
          air.flags[i] = F.SURF_KILL | F.STRETCH | (layer ? 0 : F.FOAMDROP);
        }
      }
    }
    // lingering mist over big splashes
    if (s > 1.2) {
      const nm = count(3 + 3 * s);
      for (let k = 0; k < nm; k++) {
        const i = spawn(air, K.MOTE, S.softLit, x + (R() - 0.5) * 50 * s, sy - (20 + R() * 90) * s);
        if (i < 0) break;
        air.vx[i] = (R() - 0.5) * 80 * s;
        air.vy[i] = -(40 + R() * 90) * rs;
        air.drag[i] = 1.6;
        air.g[i] = 12;
        air.s0[i] = (28 + R() * 26) * s;
        air.s1[i] = air.s0[i] * 1.9;
        air.dur[i] = 1.3 + R() * 1.1;
        air.age[i] = -(0.15 + R() * 0.25);
        air.a0[i] = 0.09;
      }
    }
    // droplets
    const nDrop = count((kind === 'lure' ? 8 : 10) + (kind === 'jump' ? 36 : 28) * s);
    const glint = kind === 'jump' ? 0.6 : 0.35;
    for (let k = 0; k < nDrop; k++) {
      const ang = gauss() * (kind === 'boat' ? 0.8 : 0.55) + dir * 0.35;
      const sp = (170 + R() * 520) * sg * (0.55 + 0.45 * R()) * (kind === 'land' ? 0.45 : 1);
      const i = spawn(air, K.DROP, S.dropLit, x + (R() - 0.5) * 12 * s, sy - 2);
      if (i < 0) break;
      air.vx[i] = Math.sin(ang) * sp;
      air.vy[i] = -Math.cos(ang) * sp;
      air.g[i] = G;
      air.drag[i] = 0.3;
      air.s0[i] = (1.5 + R() * 2.3) * (0.75 + 0.2 * s);
      air.s1[i] = air.s0[i] * 0.8;
      air.dur[i] = 3;
      air.a0[i] = 0.95;
      air.st[i] = 0.0042;
      air.age[i] = -R() * 0.07;
      air.flags[i] = F.SURF_KILL | F.STRETCH | (R() < 0.35 ? F.RINGLET : 0) | (R() < glint ? F.GLINT : 0);
    }
    // foam spreading on the surface (a dense patch at the impact, flecks drifting out)
    const nFoam = count(3 + 6 * s);
    for (let k = 0; k < nFoam; k++) foam(x + (R() - 0.5) * 20 * s, s, (R() < 0.5 ? -1 : 1) * (8 + R() * 60) * rs, R() * 0.15);
    // rings
    ring(x, 9 * s, (70 + 55 * s) * (0.9 + R() * 0.2), 1.25 + 0.3 * s, 0.55, 0);
    ring(x, 5 * s, (42 + 34 * s) * (0.9 + R() * 0.2), 1.55 + 0.3 * s, 0.38, 0.14);
    if (s > 1.4) ring(x, 14 * s, (110 + 60 * s), 1.9 + 0.3 * s, 0.3, 0.05);
    // entrained air: a burst of bubbles under the impact
    const nb = count((kind === 'land' ? 2 : 3) + 9 * s);
    for (let k = 0; k < nb; k++) {
      const bx = x + (R() - 0.5) * 24 * s;
      bubble(bx, sy + 6 + R() * 16 * s, 1.4 + R() * 3.2 * rs, (R() - 0.5) * 60 * s, 40 + R() * 130 * s, -520, 1.4 + R() * 1.4, 0);
    }
  }

  function foam(x, s, vx, delay) {
    const pool = P.surf;
    const i = spawn(pool, K.FOAM, foamSpr(), x, C.surf(x));
    if (i < 0) return;
    pool.vx[i] = vx;
    pool.drag[i] = 1.3;
    pool.oy[i] = 0.5 + R() * 2.5;
    pool.s0[i] = (18 + R() * 18) * (0.5 + 0.5 * s);
    pool.s1[i] = pool.s0[i] * (1.7 + R() * 0.9);
    pool.sq[i] = 0.34;
    pool.dur[i] = (2.2 + R() * 2) * (0.8 + 0.2 * Math.min(2, s));
    pool.a0[i] = 0.7 + R() * 0.3;
    pool.age[i] = -delay;
  }

  /** A ring lying on the surface (flattened ellipse riding the waves). r0 → r1 px (radius). */
  function ring(x, r0, r1, dur, alpha, delay) {
    const pool = P.surf;
    const i = spawn(pool, K.RING, S.ringLit, x, C.surf(x));
    if (i < 0) return;
    pool.s0[i] = r0 * 2.28;
    pool.s1[i] = r1 * 2.28;
    pool.sq[i] = 0.17;
    pool.dur[i] = dur;
    pool.a0[i] = alpha;
    pool.age[i] = -delay;
  }

  function bubble(x, y, size, vx, vy, g, dur, delay) {
    const pool = P.bub;
    const sy = C.surf(x) + 4 + size;
    const i = spawn(pool, K.BUBBLE, size < 3 ? S.bubbleSmall : S.bubble, x, y < sy ? sy : y);
    if (i < 0) return -1;
    pool.vx[i] = vx;
    pool.vy[i] = vy;
    pool.g[i] = g;
    pool.drag[i] = 1.8;
    pool.s0[i] = size;
    pool.s1[i] = size * (1.15 + R() * 0.25);
    pool.w[i] = (6 + R() * 16) * Math.min(1.6, 0.6 + size * 0.12);
    pool.wf[i] = 3 + R() * 6;
    pool.ph[i] = R() * TAU;
    pool.dur[i] = dur;
    pool.a0[i] = 0.78 + R() * 0.2;
    pool.age[i] = -delay;
    return i;
  }

  // ── simple surface / underwater shapes ───────────────────────────────────────────────────────
  function ripple(x, size = 1) {
    const s = clamp(size, 0.1, 4);
    if (!C.near(x, C.surf(x), 200 * s + 100)) return;
    ring(x, 3 * s, (34 + 30 * s) * Math.sqrt(s), 1.4 + 0.4 * s, 0.42, 0);
    ring(x, 2 * s, (20 + 18 * s) * Math.sqrt(s), 1.6 + 0.4 * s, 0.28, 0.2);
  }

  /** Underwater expanding ring (bite / hook-set / snap). glow → additive pass. */
  function pulse(x, y, r1, alpha, dur, glow, color) {
    const pool = glow ? P.glow : P.bub;
    const spr = color ? sprites.tint('pulse', color) : S.pulse;
    const i = spawn(pool, K.PULSE, spr, x, y);
    if (i < 0) return;
    pool.s0[i] = r1 * 0.25;
    pool.s1[i] = r1 * 2.2;
    pool.dur[i] = dur;
    pool.a0[i] = alpha;
  }

  function bubbles(x, y, n = 6, opts) {
    const spread = opts && opts.spread !== undefined ? opts.spread : 10;
    const size = opts && opts.size !== undefined ? opts.size : 1;
    const speed = opts && opts.speed !== undefined ? opts.speed : 1;
    if (!C.near(x, y, 200 + spread)) return;
    y = aboveFloor(x, y, 8);
    const m = Math.min(120, count(n));
    for (let k = 0; k < m; k++) {
      const bs = (1.6 + Math.pow(R(), 2) * 6.2) * size;
      bubble(x + gauss() * spread, y + gauss() * spread * 0.5, bs, gauss() * 14 * speed, -(12 + R() * 40) * speed,
        -240 * speed, 2.2 + R() * 2.8, R() * 0.12 * Math.min(4, n / 6));
    }
  }

  /** Generic particles. opts: { n, color, speed, life, gravity, size, additive, spread, angle, drag } */
  function burst(x, y, opts = {}) {
    const n = count(opts.n !== undefined ? opts.n : 14);
    const color = opts.color || '#ffffff';
    const speed = opts.speed !== undefined ? opts.speed : 220;
    const life = opts.life !== undefined ? opts.life : 0.6;
    const size = opts.size !== undefined ? opts.size : 4;
    const spread = opts.spread !== undefined ? opts.spread : TAU;
    const angle = opts.angle !== undefined ? opts.angle : -Math.PI / 2;
    const pool = opts.additive ? P.glow : P.air;
    if (!C.near(x, y, 150 + speed * life)) return;
    const spr = sprites.tint(size < 3 ? 'dot' : 'soft', color);
    for (let k = 0; k < n; k++) {
      const a = angle + (R() - 0.5) * spread;
      const sp = speed * (0.35 + R() * 0.75);
      const i = spawn(pool, K.SPARK, spr, x, y);
      if (i < 0) break;
      pool.vx[i] = Math.cos(a) * sp;
      pool.vy[i] = Math.sin(a) * sp;
      pool.g[i] = opts.gravity || 0;
      pool.drag[i] = opts.drag !== undefined ? opts.drag : 2.5;
      pool.s0[i] = size * (0.6 + R() * 0.8);
      pool.s1[i] = pool.s0[i] * 0.35;
      pool.dur[i] = life * (0.6 + R() * 0.6);
      if (speed > 140) {
        pool.flags[i] = F.STRETCH;
        pool.st[i] = 0.0035;
      }
    }
  }

  function sparkle(x, y, n = 8, color = '#fff2c2', radius = 30) {
    if (!C.near(x, y, 200)) return;
    const pool = P.glow;
    const spr = sprites.tint('star', color);
    const m = count(n);
    for (let k = 0; k < m; k++) {
      const a = R() * TAU, r = Math.sqrt(R()) * radius;
      const i = spawn(pool, K.STAR, spr, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
      if (i < 0) break;
      pool.vx[i] = Math.cos(a) * R() * 26;
      pool.vy[i] = Math.sin(a) * R() * 26 - 14;
      pool.drag[i] = 1.6;
      pool.s0[i] = 9 + R() * 17;
      pool.dur[i] = 0.45 + R() * 0.65;
      pool.age[i] = -R() * 0.4;
      pool.rot[i] = (R() - 0.5) * 0.6;
      pool.vr[i] = (R() - 0.5) * 2.4;
      pool.a0[i] = 0.95;
      pool.flags[i] = F.ROT;
    }
    mote(x, y, radius * 1.4, color, 0.3, 0.55);
  }

  function mote(x, y, size, color, alpha, dur) {
    const pool = P.glow;
    const i = spawn(pool, K.MOTE, sprites.tint('soft', color), x, y);
    if (i < 0) return;
    pool.s0[i] = size;
    pool.s1[i] = size * 1.5;
    pool.dur[i] = dur;
    pool.a0[i] = alpha;
  }

  /** Billowing cloud (ink, murk, sediment). color css; glowColor → also a faint additive glow (bioluminescent ink). */
  /** Keep underwater spawns inside the water column (above the seabed). */
  const aboveFloor = (x, y, m) => {
    const t = C.game.world.terrain;
    const floor = t && t.heightAt ? t.heightAt(x) - m : Infinity;
    return y > floor ? floor : y;
  };

  function cloud(x, y, size, color, opts) {
    const s = clamp(size, 0.2, 5);
    y = aboveFloor(x, y, 10 * s);
    if (!C.near(x, y, 260 * s)) return;
    const pool = P.under;
    const n = count((opts && opts.n) || 6 + 5 * s);
    const spreadV = (opts && opts.spreadV) || 1;
    const sink = (opts && opts.sink) || 0;
    const alpha = (opts && opts.alpha) || 0.5;
    // ejected as a short jet, then billowing: puffs strung along the jet, big and overlapping
    const ja = opts && Number.isFinite(opts.angle) ? opts.angle : R() * TAU;
    const jc = Math.cos(ja), js = Math.sin(ja) * spreadV;
    for (let k = 0; k < n; k++) {
      const along = Math.pow(R(), 0.8) * 34 * s;
      const px = x + jc * along + gauss() * 6 * s, py = y + js * along + gauss() * 5 * s * spreadV;
      const i = spawn(pool, K.PUFF, sprites.tint('puff' + (k % 3), color), px, py);
      if (i < 0) break;
      const sp = (14 + R() * 40) * s;
      const a = R() * TAU;
      pool.vx[i] = jc * (30 + 60 * (1 - along / (34 * s))) * s * 0.6 + Math.cos(a) * sp;
      pool.vy[i] = js * (30 + 60 * (1 - along / (34 * s))) * s * 0.6 + Math.sin(a) * sp * 0.6 * spreadV - 4;
      pool.g[i] = sink;
      pool.drag[i] = 1.25;
      pool.s0[i] = (20 + R() * 16) * s;
      pool.s1[i] = (80 + R() * 70) * s;
      pool.dur[i] = ((opts && opts.life) || 4.6) * (0.75 + R() * 0.5);
      pool.rot[i] = R() * TAU;
      pool.vr[i] = (R() - 0.5) * 0.45;
      pool.a0[i] = alpha * (0.7 + R() * 0.45);
      pool.age[i] = -R() * 0.12;
      pool.flags[i] = F.ROT | F.UNDER;
    }
    if (opts && opts.glowColor) {
      for (let k = 0; k < 5; k++) mote(x + gauss() * 22 * s, y + gauss() * 16 * s, (50 + R() * 50) * s, opts.glowColor, 0.2, 2.6 + R() * 1.6);
    }
  }

  /** Sediment puff where the lure touches the bottom. */
  function dust(x, y, color) {
    cloud(x, y - 8, 0.75, color, { n: 7, spreadV: 0.45, sink: 4, alpha: 0.5, life: 3, angle: -Math.PI / 2 });
    const pool = P.air;
    const spr = sprites.tint('dot', color);
    const n = count(8);
    for (let k = 0; k < n; k++) {
      const i = spawn(pool, K.SPARK, spr, x + (R() - 0.5) * 16, y - 2);
      if (i < 0) break;
      const a = -Math.PI / 2 + (R() - 0.5) * 2.2;
      const sp = 30 + R() * 70;
      pool.vx[i] = Math.cos(a) * sp;
      pool.vy[i] = Math.sin(a) * sp;
      pool.g[i] = 90;
      pool.drag[i] = 2.2;
      pool.s0[i] = 1.4 + R() * 1.6;
      pool.s1[i] = pool.s0[i];
      pool.dur[i] = 0.9 + R() * 0.8;
      pool.a0[i] = 0.75;
    }
  }

  /** A droplet shed from a wet body (jumping / lifted fish). */
  function shed(x, y, vx, vy, size, glint, dur = 3) {
    const pool = P.air;
    const i = spawn(pool, K.DROP, S.dropLit, x, y);
    if (i < 0) return;
    pool.vx[i] = vx;
    pool.vy[i] = vy;
    pool.g[i] = G;
    pool.drag[i] = 0.3;
    pool.s0[i] = size;
    pool.s1[i] = size * 0.85;
    pool.dur[i] = dur;
    pool.a0[i] = 0.9;
    pool.st[i] = 0.004;
    pool.flags[i] = F.SURF_KILL | F.STRETCH | (R() < 0.4 ? F.RINGLET : 0) | (glint ? F.GLINT : 0);
  }

  /** Small upward flick of droplets (line cutting the water, wake spray). */
  function spray(x, n, dirX, power = 1) {
    const sy = C.surf(x);
    const m = count(n);
    for (let k = 0; k < m; k++) {
      shed(x + (R() - 0.5) * 8, sy - 1, dirX * (40 + R() * 120) * power + gauss() * 30, -(90 + R() * 200) * power, 1.1 + R() * 1.6, R() < 0.4);
    }
  }

  // ── wake ─────────────────────────────────────────────────────────────────────────────────────
  const wk = { foam: 0, bub: 0, spray: 0 };
  /**
   * Continuous wake emission at (x, surface) covering dt seconds. `full` = we are the only wake (no boat-art
   * prop wash / bow spray), so also emit bubbles and spray; otherwise only the lingering lacy foam trail.
   */
  function wake(x, dir, strength, dt, full) {
    const s = clamp(strength, 0, 1);
    if (s < 0.03 || !C.near(x, 0, 400)) return;
    const b = C.budget();
    wk.foam += dt * (6 + 22 * s) * b;
    wk.bub += dt * (full ? 34 : 6) * s * b;
    wk.spray += dt * Math.max(0, s - (full ? 0.45 : 0.75)) * 40 * b;
    while (wk.foam >= 1) {
      wk.foam -= 1;
      const fx = x + (R() - 0.5) * 16 - dir * R() * 10;
      const pool = P.surf;
      const i = spawn(pool, K.FOAM, foamSpr(), fx, C.surf(fx));
      if (i < 0) break;
      pool.vx[i] = -dir * (6 + R() * 26) * s + gauss() * 6;
      pool.drag[i] = 0.9;
      pool.oy[i] = 0.5 + R() * 2.5;
      pool.s0[i] = 16 + 20 * s + R() * 10;
      pool.s1[i] = pool.s0[i] * (1.9 + R() * 1.1);
      pool.sq[i] = 0.26;
      pool.dur[i] = 1.6 + 2.6 * s + R();
      pool.a0[i] = 0.3 + 0.35 * s;
    }
    while (wk.bub >= 1) {
      wk.bub -= 1;
      const bx = x - dir * R() * 24;
      bubble(bx, C.surf(bx) + 10 + R() * 26, 1.2 + R() * 2.6, -dir * (30 + R() * 90) * s, R() * 20, -200, 1 + R() * 1.4, 0);
    }
    while (wk.spray >= 1) {
      wk.spray -= 1;
      spray(x, 1, -dir, 0.6 + 0.6 * s);
    }
  }

  return { splash, foam, ring, bubble, ripple, pulse, bubbles, burst, sparkle, mote, cloud, dust, shed, spray, wake };
}
