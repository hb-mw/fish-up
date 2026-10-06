// Struct-of-arrays particle pool. Dense storage [0, n): spawning appends, dying swaps with the last.
// Zero allocation after construction. One pool per draw layer (so blend mode and draw order stay fixed).
//
// A particle with age < 0 is dormant (staggered starts inside one effect): it neither moves nor draws.

/** Particle kinds — each has its own motion + fade/size envelope. */
export const K = {
  DROP: 1,    // ballistic water droplet (velocity-stretched), dies on re-entering the water
  SHEET: 2,   // splash crown / column sheet: like DROP but bigger, softer, growing
  BUBBLE: 3,  // buoyant, wobbling, growing; pops at the surface
  FOAM: 4,    // rides the waves (y = surface + oy), spreads and fades
  PUFF: 5,    // ink / sediment / murk cloud: expands (ease-out), slow drift and spin, long fade
  SPARK: 6,   // generic particle (burst)
  STAR: 7,    // four-point glint: pops in and out, spins
  MOTE: 8,    // soft light mote: sine fade, gentle drift
  RING: 9,    // expanding ring lying on the surface (flattened ellipse), rides the waves
  PULSE: 10,  // expanding ring in place (underwater shock / bite pulse / light ring)
};
/** Flags (bitmask). */
export const F = {
  SURF_KILL: 1,  // die when falling back into the water (DROP / SHEET)
  RINGLET: 2,    // …and leave a tiny ring where it lands
  GLINT: 4,      // also drawn as a sun glint in the additive pass (spray catching the light)
  STRETCH: 8,    // stretch along velocity
  ROT: 16,       // use the rotation field
  UNDER: 32,     // must stay underwater (clamped below the surface)
  FOAMDROP: 64,  // leaves a small foam fleck when landing
};

export function createPool(cap) {
  const f32 = () => new Float32Array(cap);
  return {
    cap,
    n: 0,
    x: f32(), y: f32(), vx: f32(), vy: f32(),
    age: f32(), dur: f32(),
    s0: f32(), s1: f32(), a0: f32(),
    rot: f32(), vr: f32(),
    drag: f32(), g: f32(),
    w: f32(), wf: f32(), ph: f32(),
    sq: f32(), oy: f32(), st: f32(),
    kind: new Uint8Array(cap),
    flags: new Uint8Array(cap),
    spr: new Uint16Array(cap),
  };
}

/**
 * Reserve a particle and fill defaults. Returns its index, or -1 when the pool is full.
 * Callers then set the fields they care about.
 */
export function spawn(p, kind, spr, x, y) {
  if (p.n >= p.cap) return -1;
  const i = p.n++;
  p.kind[i] = kind;
  p.spr[i] = spr;
  p.flags[i] = 0;
  p.x[i] = x;
  p.y[i] = y;
  p.vx[i] = 0;
  p.vy[i] = 0;
  p.age[i] = 0;
  p.dur[i] = 1;
  p.s0[i] = 4;
  p.s1[i] = 4;
  p.a0[i] = 1;
  p.rot[i] = 0;
  p.vr[i] = 0;
  p.drag[i] = 0;
  p.g[i] = 0;
  p.w[i] = 0;
  p.wf[i] = 0;
  p.ph[i] = 0;
  p.sq[i] = 1;
  p.oy[i] = 0;
  p.st[i] = 0;
  return i;
}

function copy(p, from, to) {
  p.kind[to] = p.kind[from];
  p.spr[to] = p.spr[from];
  p.flags[to] = p.flags[from];
  p.x[to] = p.x[from];
  p.y[to] = p.y[from];
  p.vx[to] = p.vx[from];
  p.vy[to] = p.vy[from];
  p.age[to] = p.age[from];
  p.dur[to] = p.dur[from];
  p.s0[to] = p.s0[from];
  p.s1[to] = p.s1[from];
  p.a0[to] = p.a0[from];
  p.rot[to] = p.rot[from];
  p.vr[to] = p.vr[from];
  p.drag[to] = p.drag[from];
  p.g[to] = p.g[from];
  p.w[to] = p.w[from];
  p.wf[to] = p.wf[from];
  p.ph[to] = p.ph[from];
  p.sq[to] = p.sq[from];
  p.oy[to] = p.oy[from];
  p.st[to] = p.st[from];
}

/** Remove particle i (swap with last). */
export function kill(p, i) {
  const last = --p.n;
  if (i !== last) copy(p, last, i);
}

/**
 * Advance a pool. `surf(x)` = sea-surface y at x. `hooks.land(x, y, size, flags)` is called when a droplet re-enters
 * the water, `hooks.pop(x, y, size)` when a bubble reaches the surface.
 */
export function step(p, dt, surf, hooks, wind) {
  for (let i = p.n - 1; i >= 0; i--) {
    let age = p.age[i];
    if (age < 0) {
      p.age[i] = age + dt;
      continue;
    }
    age += dt;
    if (age >= p.dur[i]) {
      kill(p, i);
      continue;
    }
    p.age[i] = age;
    const k = p.kind[i], fl = p.flags[i];
    let vx = p.vx[i], vy = p.vy[i];
    const d = p.drag[i];
    if (k === K.BUBBLE) {
      // buoyancy up to a terminal speed that grows with size; zig-zag wobble
      const size = p.s0[i] + (p.s1[i] - p.s0[i]) * (age / p.dur[i]);
      const term = -(20 + 16 * Math.sqrt(size));
      vy += p.g[i] * dt;
      if (vy < term) vy += (term - vy) * Math.min(1, dt * 6);
      vx *= 1 / (1 + d * dt);
      const x = p.x[i] + (vx + Math.sin(p.ph[i] + age * p.wf[i]) * p.w[i]) * dt;
      const y = p.y[i] + vy * dt;
      const sy = surf(x);
      if (y - size * 0.5 < sy) {
        if (hooks.pop) hooks.pop(x, sy, size);
        kill(p, i);
        continue;
      }
      p.x[i] = x;
      p.y[i] = y;
      p.vx[i] = vx;
      p.vy[i] = vy;
      continue;
    }
    vy += p.g[i] * dt;
    if (d > 0) {
      const f = 1 / (1 + d * dt);
      vx *= f;
      vy *= f;
    }
    let x = p.x[i] + vx * dt;
    let y = p.y[i] + vy * dt;
    if (k === K.FOAM) {
      x += wind * dt;
      y = surf(x) + p.oy[i];
    } else if (k === K.RING) {
      y = surf(x) + p.oy[i];
    } else if (fl & F.SURF_KILL) {
      if (vy > 0) {
        const sy = surf(x);
        if (y > sy) {
          if (hooks.land) hooks.land(x, sy, p.s0[i], fl);
          kill(p, i);
          continue;
        }
      }
    } else if (fl & F.UNDER) {
      const sy = surf(x) + 3;
      if (y < sy) {
        y = sy;
        if (vy < 0) vy = 0;
      }
    }
    p.x[i] = x;
    p.y[i] = y;
    p.vx[i] = vx;
    p.vy[i] = vy;
    if (fl & F.ROT) p.rot[i] += p.vr[i] * dt;
  }
}

const outCubic = (t) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * Draw a pool. `cam` = { k, ox, oy, l, r, t, b } (device scale, offsets and world culling rect).
 * Every particle is drawn with its own full transform (camera ∘ translate ∘ rotate ∘ scale) into a unit quad.
 * `alphaMul` scales every particle (e.g. day-only glints).
 */
export function draw(ctx, p, sprites, cam, alphaMul = 1) {
  const list = sprites.list;
  const k = cam.k, ox = cam.ox, oy = cam.oy;
  for (let i = 0; i < p.n; i++) {
    const age = p.age[i];
    if (age < 0) continue;
    const t = age / p.dur[i];
    const kind = p.kind[i];
    let size, alpha;
    switch (kind) {
      case K.DROP:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * t;
        alpha = t > 0.8 ? (1 - t) * 5 : 1;
        break;
      case K.SHEET:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * outCubic(t);
        alpha = (1 - t * t) * Math.min(1, age * 25);
        break;
      case K.BUBBLE:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * t;
        alpha = Math.min(1, age * 8) * (t > 0.82 ? (1 - t) / 0.18 : 1);
        break;
      case K.FOAM:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * outCubic(t);
        alpha = Math.min(1, age * 10) * Math.pow(1 - t, 1.3);
        break;
      case K.PUFF:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * outCubic(t);
        alpha = Math.min(1, age * 6) * Math.pow(1 - t, 1.5);
        break;
      case K.STAR: {
        const e = Math.sin(Math.PI * t);
        size = p.s0[i] * (0.25 + 0.75 * Math.sqrt(e));
        alpha = Math.pow(e, 0.6);
        break;
      }
      case K.MOTE:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * t;
        alpha = Math.sin(Math.PI * t);
        break;
      case K.RING:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * (1 - (1 - t) * (1 - t));
        alpha = Math.min(1, age * 12) * Math.pow(1 - t, 1.4);
        break;
      case K.PULSE:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * outCubic(t);
        alpha = Math.min(1, age * 30) * (1 - t) * (1 - t);
        break;
      default:
        size = p.s0[i] + (p.s1[i] - p.s0[i]) * t;
        alpha = 1 - t * t;
    }
    alpha *= p.a0[i] * alphaMul;
    if (alpha < 0.004 || size < 0.15) continue;
    const x = p.x[i], y = p.y[i];
    const reach = size * (1 + p.st[i] * 40);
    if (x + reach < cam.l || x - reach > cam.r || y + reach < cam.t || y - reach > cam.b) continue;
    const fl = p.flags[i];
    let sx = size, sy = size * p.sq[i], c = 1, s = 0;
    if (fl & F.STRETCH) {
      const vx = p.vx[i], vy = p.vy[i];
      const sp = Math.sqrt(vx * vx + vy * vy);
      if (sp > 1) {
        c = vx / sp;
        s = vy / sp;
        sx = size * (1 + sp * p.st[i]);
      }
    } else if (fl & F.ROT) {
      const r = p.rot[i];
      c = Math.cos(r);
      s = Math.sin(r);
    }
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.setTransform(k * c * sx, k * s * sx, -k * s * sy, k * c * sy, k * x + ox, k * y + oy);
    ctx.drawImage(list[p.spr[i]], -0.5, -0.5, 1, 1);
  }
}
