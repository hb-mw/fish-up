// ─────────────────────────────────────────────────────────────────────────────
// Effects (Canvas 2D): splashes, droplets, foam, rings, bubbles, ink, sparkles, floating texts, confetti …
// The same object is the kernel's `game.fx` API (always safe to call) and the render module:
//   renderWorld(ctx)   WORLD space, normal blend  — under-water clouds → bubbles → surface foam/rings → spray
//   renderGlow(ctx)    WORLD space, additive      — sparkles, glints, magic, light rings
//   renderScreen(octx) SCREEN space, crisp overlay — confetti, coins, floating texts, flashes
// Pooled struct-of-arrays particles (zero per-frame allocation), hard caps with graceful degradation (spawn counts
// shrink as pools fill or when the frame-time governor sees the budget exceeded), culled to camera.bounds.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp, lerp, smoothstep } from '../core/math.js';
import { createRng } from '../core/rng.js';
import { ZONES, rarityOf } from '../core/config.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { RIG, boatToWorld } from '../entities/rig.js';
import { createSprites } from './fx/sprites.js';
import { createPool, step, draw, F, K } from './fx/pool.js';
import { createRecipes } from './fx/recipes.js';
import { createTexts } from './fx/texts.js';
import { createScreenLayer } from './fx/screen.js';

const QUALITY_MUL = { low: 0.55, medium: 0.8, high: 1, ultra: 1 };
const ZONE_TINT = { sunlit: '#9fe9ff', twilight: '#6d8cff', midnight: '#a77bff', abyss: '#ff6a8a' };

/**
 * @param {object} game
 * @returns the effects module + public `game.fx` API
 */
export function createEffects(game) {
  const rng = createRng(0xf1e5);
  const sprites = createSprites();
  const S = {
    soft: sprites.base('soft'),
    dot: sprites.base('dot'),
    bubble: sprites.base('bubble'),
    bubbleSmall: sprites.base('bubbleSmall'),
    pulse: sprites.base('pulse'),
    star: sprites.base('star'),
    dropLit: sprites.lit('drop'),
    sheetLit: sprites.lit('sheet'),
    softLit: sprites.lit('soft'),
    ringLit: sprites.lit('ring'),
    foamLit: [sprites.lit('foam0'), sprites.lit('foam1'), sprites.lit('foam2')],
    glint: sprites.tint('star', '#fff4d6'),
    glintSoft: sprites.tint('soft', '#fff2cf'),
  };
  const P = {
    under: createPool(220),  // ink / murk / sediment
    bub: createPool(900),    // bubbles + underwater pulses
    surf: createPool(420),   // foam + surface rings
    air: createPool(1300),   // sheets, droplets, generic particles
    glow: createPool(700),   // additive
  };
  const POOLS = [P.under, P.bub, P.surf, P.air, P.glow];
  const cam = { k: 1, ox: 0, oy: 0, l: 0, r: 0, t: 0, b: 0 };
  const tmp = { x: 0, y: 0 };
  const tmp2 = { x: 0, y: 0 };

  // ── governor: shrink spawn counts if the draw cost exceeds the budget ──
  const perf = { worldMs: 0, glowMs: 0, screenMs: 0, emaMs: 0, peakMs: 0, gov: 1, acc: 0 };
  let qualityMul = QUALITY_MUL[game.settings.quality] || 1;
  game.events.on('settings', () => {
    qualityMul = QUALITY_MUL[game.settings.quality] || 1;
  });

  const waves = () => game.world.waves;
  const C = {
    game, rng, S, P, sprites,
    surf: (x) => waves().heightAt(x),
    budget() {
      let fill = 0;
      for (const p of POOLS) fill = Math.max(fill, p.n / p.cap);
      const load = fill > 0.65 ? clamp(1 - (fill - 0.65) / 0.35, 0.12, 1) : 1;
      return qualityMul * perf.gov * load;
    },
    near(x, y, m) {
      const b = game.camera.bounds;
      return x > b.left - m && x < b.right + m && y > b.top - m && y < b.bottom + m;
    },
  };
  const fx = createRecipes(C);
  const texts = createTexts(game);
  const screen = createScreenLayer(game, sprites);

  // per-frame budgets for secondary splashes (ringlets / pops) so a storm of droplets stays cheap
  let ringletBudget = 8, popBudget = 6;
  const hooks = {
    land(x, sy, size, flags) {
      if (flags & F.RINGLET && ringletBudget > 0) {
        ringletBudget--;
        fx.ring(x, 1.5, 6 + size * 3, 0.55, 0.45, 0);
      }
      if (flags & F.FOAMDROP && ringletBudget > 0) {
        ringletBudget--;
        const pool = P.surf;
        fx.foam(x, 0.35 + size * 0.02, (rng.next() - 0.5) * 20, 0);
        if (pool.n) pool.dur[pool.n - 1] *= 0.6;
      }
    },
    pop(x, sy, size) {
      if (size > 3.2 && popBudget > 0) {
        popBudget--;
        fx.ring(x, size * 0.4, size * 1.6 + 3, 0.5, 0.38, 0);
        if (size > 6) {
          fx.shed(x, sy - 1, (rng.next() - 0.5) * 50, -(60 + rng.next() * 80), 1.1, false, 1);
          fx.shed(x, sy - 1, (rng.next() - 0.5) * 50, -(60 + rng.next() * 80), 0.9, false, 1);
        }
      }
    },
  };

  // ── helpers ───────────────────────────────────────────────────────────────────────────────────
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const isFish = (f) => f && typeof f === 'object' && Number.isFinite(f.x) && Number.isFinite(f.y);
  const lure = () => game.fishing && game.fishing.lure;
  /** Position of an event: fish mouth → payload x/y → lure → boat. Writes into `out`. */
  function where(p, out, preferMouth = true) {
    const f = p && (p.fish || p.prey || p.predator);
    if (isFish(f)) {
      const len = f.visualLen || 60;
      const d = f.dir >= 0 ? Math.max(0.14, f.dir || 1) : Math.min(-0.14, f.dir);
      const pitch = f.pitch || 0;
      out.x = f.x + (preferMouth ? Math.cos(pitch) * d * len * 0.44 : 0);
      out.y = f.y + (preferMouth ? Math.sin(pitch) * len * 0.44 : 0);
      return out;
    }
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      out.x = p.x;
      out.y = p.y;
      return out;
    }
    const l = lure();
    if (l && Number.isFinite(l.x) && (l.visible || l.inWater)) {
      out.x = l.x;
      out.y = l.y;
      return out;
    }
    out.x = game.boat.x;
    out.y = game.boat.y;
    return out;
  }
  /** Point along a fish's body axis: u = −0.5 (tail) … +0.5 (snout). */
  function bodyPoint(f, u, out) {
    const len = f.visualLen || 60;
    const d = f.dir >= 0 ? 1 : -1;
    const pitch = f.pitch || 0;
    out.x = f.x + Math.cos(pitch) * d * len * u;
    out.y = f.y + Math.sin(pitch) * len * u;
    return out;
  }
  const fishSplashSize = (f) => clamp(((f && f.visualLen) || 90) / 125, 0.45, 3.2);
  const trophyPoint = (out) => {
    boatToWorld(game.boat, RIG.trophy.x, RIG.trophy.y, out);
    return out;
  };

  // event-sourced splash de-duplication (gameplay may emit both lureSplash and splash, jump re-entries twice, …)
  const recent = [];
  for (let i = 0; i < 8; i++) recent.push({ x: 0, t: -99, size: 0 });
  let recentI = 0;
  function splashDeduped(x, size, opts) {
    const now = game.time.now;
    for (const r of recent) {
      if (now - r.t < 0.3 && Math.abs(r.x - x) < 70 + 55 * Math.max(size, r.size) && size <= r.size * 1.15) return;
    }
    const r = recent[recentI];
    recentI = (recentI + 1) % recent.length;
    r.x = x;
    r.t = now;
    r.size = size;
    fx.splash(x, size, opts);
  }

  // ── emitters that follow a fish for a while (run bubbles, drips, jump tracking) ──
  const EMIT = { TRAIL: 1, DRIP: 2, JUMP: 3 };
  const emitters = [];
  for (let i = 0; i < 12; i++) emitters.push({ on: false, type: 0, fish: null, t: 0, dur: 0, acc: 0, rate: 0, above: false, lx: 0, ly: 0, vx: 0, vy: 0 });
  function emitter(type, fish, dur, rate) {
    if (!isFish(fish)) return null;
    let e = null;
    for (const c of emitters) {
      if (c.on && c.type === type && c.fish === fish) {
        e = c;
        break;
      }
      if (!e && !c.on) e = c;
    }
    if (!e) e = emitters[(rng.next() * emitters.length) | 0];
    if (!(e.on && e.type === type && e.fish === fish)) {
      e.t = 0;
      e.acc = 0;
      e.above = false;
      e.lx = fish.x;
      e.ly = fish.y;
      e.vx = 0;
      e.vy = 0;
    }
    e.on = true;
    e.type = type;
    e.fish = fish;
    e.dur = Math.max(e.dur - e.t, dur);
    e.t = 0;
    e.rate = rate;
    return e;
  }
  function updateEmitters(dt) {
    for (const e of emitters) {
      if (!e.on) continue;
      e.t += dt;
      const f = e.fish;
      if (!isFish(f) || e.t > e.dur) {
        e.on = false;
        e.fish = null;
        continue;
      }
      if (dt > 0) {
        e.vx = lerp(e.vx, (f.x - e.lx) / dt, 0.5);
        e.vy = lerp(e.vy, (f.y - e.ly) / dt, 0.5);
      }
      e.lx = f.x;
      e.ly = f.y;
      const sy = C.surf(f.x);
      if (e.type === EMIT.TRAIL) {
        if (f.y < sy + 4) continue;
        const big = clamp((f.visualLen || 80) / 140, 0.7, 2.2);
        e.acc += dt * e.rate * (1 - e.t / e.dur) * Math.min(2, 0.4 + big * 0.6) * C.budget();
        while (e.acc >= 1) {
          e.acc -= 1;
          bodyPoint(f, -0.45 + rng.next() * 0.2, tmp);
          fx.bubble(tmp.x, tmp.y, (1.2 + rng.next() * 2.6) * big, -e.vx * 0.15 + (rng.next() - 0.5) * 30, -e.vy * 0.1, -260, 1.6 + rng.next() * 1.6, 0);
        }
      } else if (e.type === EMIT.DRIP) {
        const k = 1 - e.t / e.dur;
        e.acc += dt * (6 + e.rate * 1.5 * k * k) * C.budget();
        // drips run off the LOWEST end of the body
        bodyPoint(f, 0.5, tmp);
        bodyPoint(f, -0.5, tmp2);
        const low = tmp.y > tmp2.y ? 0.5 : -0.5;
        while (e.acc >= 1) {
          e.acc -= 1;
          const u = low * (1 - Math.pow(rng.next(), 0.55) * 1.3);
          bodyPoint(f, u, tmp);
          fx.shed(tmp.x + (rng.next() - 0.5) * 6, tmp.y + 4, (rng.next() - 0.5) * 16, 20 + rng.next() * 50, 1.7 + rng.next() * 1.6, rng.next() < 0.5, 0.5 + rng.next() * 0.35);
        }
      } else if (e.type === EMIT.JUMP) {
        const len = f.visualLen || 90;
        if (f.y < sy - 3) {
          e.above = true;
          // water streaming off the airborne body, catching the light
          e.acc += dt * (18 + len / 8) * C.budget();
          while (e.acc >= 1) {
            e.acc -= 1;
            bodyPoint(f, (rng.next() - 0.5) * 0.9, tmp);
            fx.shed(tmp.x, tmp.y, e.vx * 0.35 + (rng.next() - 0.5) * 60, e.vy * 0.25 + (rng.next() - 0.7) * 80, 1.4 + rng.next() * 2, rng.next() < 0.65);
          }
        } else if (e.above && f.y > sy + 6) {
          splashDeduped(f.x, fishSplashSize(f) * 1.15, { kind: 'jump', dir: clamp(e.vx / 600, -1, 1) });
          if (len > 220) game.events.emit('shake', { amount: clamp(len / 1400, 0.12, 0.45) });
          e.on = false;
          e.fish = null;
        }
      }
    }
  }

  // ── ambient hooks: lure sinking trail, fight bubbles, auto-wake ──
  const amb = { lx: 0, ly: 0, lureOk: false, lureAcc: 0, fightAcc: 0, thrashT: 0, fx: 0, fy: 0, fish: null, wakeCallT: -99, boatX: 0 };
  function updateAmbient(dt) {
    const f = game.fishing;
    const l = f && f.lure;
    if (l && l.inWater && l.visible && Number.isFinite(l.x) && dt > 0) {
      if (amb.lureOk) {
        const vy = (l.y - amb.ly) / dt, vx = (l.x - amb.lx) / dt;
        const sp = Math.hypot(vx, vy);
        const sy = C.surf(l.x);
        if (l.y > sy + 8 && (vy > 110 || sp > 260)) {
          amb.lureAcc += dt * Math.min(12, (Math.max(vy - 90, sp - 240)) / 18) * C.budget();
          while (amb.lureAcc >= 1) {
            amb.lureAcc -= 1;
            fx.bubble(l.x + (rng.next() - 0.5) * 5, l.y - 4, 0.9 + rng.next() * 1.4, -vx * 0.05, -vy * 0.08, -200, 1.2 + rng.next(), 0);
          }
        }
      }
      amb.lx = l.x;
      amb.ly = l.y;
      amb.lureOk = true;
    } else amb.lureOk = false;

    const fish = f && f.state === 'fight' ? f.hooked : null;
    if (isFish(fish) && dt > 0) {
      if (amb.fish === fish) {
        const sp = Math.hypot(fish.x - amb.fx, fish.y - amb.fy) / dt;
        const mode = f.fight && f.fight.mode;
        const sy = C.surf(fish.x);
        let rate = clamp((sp - 70) / 26, 0, 12);
        if (mode === 'thrash') rate += 8;
        else if (mode === 'run' || mode === 'dive') rate += 3;
        if (fish.y > sy + 6) {
          const big = clamp((fish.visualLen || 80) / 140, 0.7, 2.2);
          amb.fightAcc += dt * rate * Math.min(2, 0.4 + big * 0.6) * C.budget();
          while (amb.fightAcc >= 1) {
            amb.fightAcc -= 1;
            bodyPoint(fish, -0.42 + rng.next() * 0.25, tmp);
            fx.bubble(tmp.x, tmp.y, (1.1 + rng.next() * 2.4) * big, (rng.next() - 0.5) * 40, 0, -240, 1.4 + rng.next() * 1.6, 0);
          }
        }
        // thrashing at the surface throws white water
        amb.thrashT -= dt;
        if (fish.y < sy + (fish.visualLen || 80) * 0.35 && fish.y > sy - 20 && (mode === 'thrash' || sp > 260) && amb.thrashT <= 0) {
          amb.thrashT = 0.22 + rng.next() * 0.2;
          splashDeduped(fish.x + (rng.next() - 0.5) * (fish.visualLen || 80) * 0.5, clamp(fishSplashSize(fish) * 0.45, 0.3, 1.2), { kind: 'fish' });
        }
      }
      amb.fx = fish.x;
      amb.fy = fish.y;
      amb.fish = fish;
    } else amb.fish = null;

    // automatic wake when nobody calls fx.wake() (keeps the boat alive even without the boat-art hook)
    const boat = game.boat;
    const vx = Number.isFinite(boat.vx) ? boat.vx : 0;
    if (game.time.now - amb.wakeCallT > 0.35 && Math.abs(vx) > 22) {
      const face = boat.facing || 1;
      const dir = vx > 0 ? 1 : -1;
      const strength = clamp(Math.abs(vx) / ((game.player && game.player.stats && game.player.stats.boatSpeed) || 300), 0, 1);
      boatToWorld(boat, -RIG.hullLength * 0.47 * dir * face, 0, tmp);
      fx.wake(tmp.x, dir, strength, dt, true);
      if (strength > 0.4) {
        boatToWorld(boat, RIG.hullLength * 0.5 * dir * face, 0, tmp);
        fx.wake(tmp.x, -dir, (strength - 0.4) * 0.7, dt, true);
      }
    }
  }

  // ── event reactions ───────────────────────────────────────────────────────────────────────────
  const ev = game.events;
  const on = (name, fn) =>
    ev.on(name, (p) => {
      try {
        fn(p || {});
      } catch (e) {
        game.reportError('fx:' + name, e);
      }
    });
  const lim = {};
  const limited = (key, sec) => {
    const now = game.time.real;
    if (lim[key] !== undefined && now - lim[key] < sec) return true;
    lim[key] = now;
    return false;
  };
  const postfxOn = () => !!(game.mods.postfx && game.mods.postfx.ok && game.settings.postfx);

  on('lureSplash', (p) => {
    const x = num(p.x, lure() ? lure().x : game.boat.x);
    const size = clamp(0.24 + num(p.speed, 300) / 2400, 0.24, 0.55);
    splashDeduped(x, size, { kind: 'lure' });
  });
  on('splash', (p) => {
    if (!Number.isFinite(p.x)) return;
    splashDeduped(p.x, num(p.size, 1), { kind: p.kind || 'fish', dir: num(p.dir, 0) });
  });
  on('bubbles', (p) => {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) fx.bubbles(p.x, p.y, num(p.n, 6));
  });
  on('ink', (p) => {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) api.ink(p.x, p.y, num(p.size, 1), p.color);
  });
  on('twitch', (p) => {
    const w = where(p, tmp, false);
    if (w.y > C.surf(w.x) + 6) {
      fx.bubbles(w.x, w.y, 4, { spread: 4, size: 0.7, speed: 1.5 });
      fx.mote(w.x, w.y, 26, '#dff6ff', 0.22, 0.25);
    } else fx.ripple(w.x, 0.35);
  });
  on('nibble', (p) => {
    if (limited('nibble', 0.15)) return;
    const w = where(p, tmp, true);
    fx.pulse(w.x, w.y, 16, 0.3, 0.42, false);
    fx.bubbles(w.x, w.y, 1, { spread: 2, size: 0.8 });
  });
  on('bite', (p) => {
    const l = lure();
    const w = Number.isFinite(p.x) || !(l && l.inWater) ? where(p, tmp, true) : where({ x: l.x, y: l.y }, tmp);
    fx.pulse(w.x, w.y, 34, 0.6, 0.34, false);
    fx.pulse(w.x, w.y, 22, 0.35, 0.3, true, '#e8fbff');
    fx.bubbles(w.x, w.y, 5, { spread: 7, size: 0.9, speed: 1.3 });
  });
  on('hookSet', (p) => {
    const w = where(p, tmp, true);
    const x = w.x, y = w.y;
    const q = p.quality;
    fx.pulse(x, y, 52, 0.55, 0.42, false);
    fx.burst(x, y, { n: 10, color: '#f4fdff', speed: 300, life: 0.34, size: 5, additive: true, drag: 3 });
    fx.bubbles(x, y, 12, { spread: 12, size: 1, speed: 1.6 });
    const ty = y - 46;
    if (q === 'perfect') {
      fx.sparkle(x, y, 16, '#ffd86b', 42);
      fx.pulse(x, y, 40, 0.35, 0.5, true, '#ffd36a');
      texts.spawn(x, ty, 'PERFECT!', { color: '#ffd24a', size: 46, life: 1.45, punch: 1, rise: 74 });
    } else if (q === 'late') {
      texts.spawn(x, ty, 'Barely!', { color: '#ffb07c', size: 34, life: 1.2, rise: 56 });
    } else {
      fx.sparkle(x, y, 5, '#e9fbff', 26);
      texts.spawn(x, ty, 'Hooked!', { color: '#e6fbff', size: 38, life: 1.25, rise: 64 });
    }
  });
  on('run', (p) => {
    const f = p.fish || (game.fishing && game.fishing.hooked);
    if (!isFish(f)) return;
    const w = bodyPoint(f, -0.45, tmp);
    if (w.y > C.surf(w.x) + 6) fx.bubbles(w.x, w.y, 7, { spread: 10, size: 1, speed: 1.4 });
    emitter(EMIT.TRAIL, f, 1.4, 22);
  });
  on('jump', (p) => {
    const f = p.fish;
    const x = num(p.x, isFish(f) ? f.x : NaN);
    if (!Number.isFinite(x)) return;
    const vx = isFish(f) && Number.isFinite(f.vx) ? f.vx : 0;
    splashDeduped(x, (isFish(f) ? fishSplashSize(f) : 1) * 0.9, { kind: 'jump', dir: clamp(vx / 600, -1, 1), exit: true });
    if (isFish(f)) emitter(EMIT.JUMP, f, 5, 0);
  });
  on('tensionWarn', () => {
    if (limited('tension', 0.14)) return;
    const pts = game.fishing && game.fishing.line && game.fishing.line.points;
    if (!pts || pts.length < 2) return;
    // where the line cuts the surface: a fine flick of spray
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const sa = a.y - C.surf(a.x), sb = b.y - C.surf(b.x);
      if ((sa <= 0 && sb > 0) || (sa > 0 && sb <= 0)) {
        const t = sa / (sa - sb || 1);
        const x = a.x + (b.x - a.x) * t;
        fx.spray(x, 5, Math.sign(b.x - a.x) || 1, 0.8);
        fx.ring(x, 2, 14, 0.5, 0.4, 0);
        return;
      }
    }
  });
  on('lineSnap', (p) => {
    const tip = game.boat.rod && game.boat.rod.tip;
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      tmp.x = p.x;
      tmp.y = p.y;
    } else if (tip && Number.isFinite(tip.x)) {
      tmp.x = tip.x;
      tmp.y = tip.y;
    } else where(p, tmp);
    const x = tmp.x, y = tmp.y;
    fx.burst(x, y, { n: 16, color: '#ffffff', speed: 560, life: 0.26, size: 3.2, additive: true, drag: 4 });
    fx.burst(x, y, { n: 6, color: '#ffd9c2', speed: 240, life: 0.4, size: 6, additive: true, drag: 3 });
    fx.pulse(x, y, 30, 0.45, 0.28, true, '#fff1e6');
    texts.spawn(x, y - 40, 'SNAP!', { color: '#ff5a4f', size: 44, life: 1.3, punch: 1.3, rise: 60 });
  });
  on('escape', (p) => {
    const w = where(p, tmp, false);
    if (w.y > C.surf(w.x) + 6) fx.bubbles(w.x, w.y, 10, { spread: 14, size: 1, speed: 1.3 });
    else fx.ripple(w.x, 0.8);
    texts.spawn(w.x, w.y - 40, 'Got away…', { color: '#a9c8de', size: 30, life: 1.7, rise: 48, weight: 700 });
  });
  on('hookMiss', (p) => {
    const w = where(p, tmp, true);
    if (w.y > C.surf(w.x) + 6) fx.bubbles(w.x, w.y, 6, { spread: 9, size: 0.9, speed: 1.6 });
  });
  on('predatorStrike', (p) => {
    const w = where({ fish: p.prey || p.predator, x: p.x, y: p.y }, tmp, false);
    const x = w.x, y = w.y;
    const big = isFish(p.predator) ? clamp((p.predator.visualLen || 200) / 220, 0.8, 2.4) : 1.2;
    fx.bubbles(x, y, 30, { spread: 26 * big, size: 1.2, speed: 1.8 });
    fx.cloud(x, y, 1.1 * big, '#18282a', { alpha: 0.55, life: 4 });
    fx.pulse(x, y, 70 * big, 0.5, 0.45, false);
    if (y < C.surf(x) + 60) splashDeduped(x, 1.2 * big, { kind: 'fish' });
    game.events.emit('shake', { amount: 0.45 });
  });
  on('landed', (p) => {
    const f = p.fish || (game.fishing && game.fishing.hooked);
    if (isFish(f)) {
      splashDeduped(f.x, clamp(fishSplashSize(f) * 0.55, 0.35, 1.4), { kind: 'land' });
      emitter(EMIT.DRIP, f, 2.8, 26);
    }
  });
  // ── catch payoff. The UI's catch card (z-index above our overlay) dims the whole scene while it is up, so when a UI
  //    is present the payoff — "+points" at the boat, coins, confetti, level-up sparkle — waits for 'catchDismissed'.
  //    Coins / level-ups that are NOT part of a catch (quests, …) still pop on their own a moment later. ──
  const held = { record: null, coins: 0, coinsT: 0, level: null, levelT: 0 };
  const hasCard = () => !!game.mods.ui;
  function celebrateCatch(rec) {
    const sp = SPECIES_BY_ID[rec.speciesId] || (rec.species && typeof rec.species === 'object' ? rec.species : null);
    const level = num(rec.level, sp ? sp.level : 1);
    const color = rec.rarityColor || (rec.rarity && rec.rarity.color) || rarityOf(level).color;
    const points = num(rec.points, num(rec.score, num(rec.total, NaN)));
    const pos = isFish(rec.fish) && rec.fish.state === 'landed' ? rec.fish : trophyPoint(tmp);
    const x = pos.x, y = pos.y - 40;
    if (Number.isFinite(points)) {
      texts.spawn(x, y, '+' + Math.round(points).toLocaleString('en-US'), {
        color, size: level >= 7 ? 48 : 42, life: 1.9, rise: 64, delay: 0.15, punch: level >= 9 ? 1 : 0,
      });
    }
    const sizeId = rec.sizeClass && typeof rec.sizeClass === 'object' ? rec.sizeClass.id : rec.sizeClass;
    const trophy = rec.trophy || sizeId === 'trophy' || num(rec.sizeQ, 0) >= 0.93;
    let o = 0;
    if (rec.isNew || rec.firstCatch || rec.dexNew) o += 1;
    if (trophy) o += 1;
    if (rec.shiny) o += 1.5;
    if (rec.isRecord || rec.newRecord) o += 0.5;
    if (level >= 9) o += 1.5;
    else if (level >= 7) o += 0.6;
    if (o > 0) {
      fx.sparkle(x, y + 30, Math.round(8 + 6 * o), rec.shiny ? '#ffd86b' : color, 50 + 10 * o);
      if (o >= 1) api.confetti(x, y, Math.round(26 + 26 * o));
      if (o >= 2.5) screen.rain(Math.round(40 * (o - 1.5)));
    }
  }
  /** Level-up: confetti, sparkles, a ring of light and a soft flash — no text (the UI owns the level-up banner). */
  function celebrateLevel() {
    const t = trophyPoint(tmp);
    const x = t.x, y = t.y - 90;
    fx.sparkle(x, y + 60, 26, '#ffe08a', 90);
    fx.pulse(x, t.y, 160, 0.4, 0.9, true, '#ffe6a0');
    api.confetti(x, y + 40, 90);
    screen.rain(70);
    screen.screenFlash('#fff4d6', postfxOn() ? 0.1 : 0.16, 0.55);
  }
  function popCoins(d) {
    trophyPoint(tmp);
    game.camera.worldToScreen(tmp.x, tmp.y - 40, tmp2);
    screen.coins(tmp2.x, tmp2.y, clamp(Math.round(2 + d / 40), 2, 9));
  }
  /** Release held coins / level-ups that turned out not to belong to a catch card. */
  function flushHeld() {
    const now = game.time.real;
    if (held.record) return;
    if (held.coins > 0 && now - held.coinsT > 0.12) {
      popCoins(held.coins);
      held.coins = 0;
    }
    if (held.level && now - held.levelT > 0.12) {
      celebrateLevel();
      held.level = null;
    }
  }
  on('catchScored', (p) => {
    const rec = p.record || p;
    if (!hasCard()) {
      celebrateCatch(rec);
      return;
    }
    held.record = rec;
  });
  on('catchDismissed', () => {
    if (!held.record) return;
    const rec = held.record;
    held.record = null;
    celebrateCatch(rec);
    if (held.coins > 0) popCoins(held.coins);
    if (held.level) celebrateLevel();
    held.coins = 0;
    held.level = null;
  });
  on('levelUp', (p) => {
    if (!hasCard()) {
      celebrateLevel();
      return;
    }
    held.level = p;
    held.levelT = game.time.real;
  });
  on('coins', (p) => {
    const d = num(p.delta, 0);
    if (d <= 0) return;
    if (!hasCard()) {
      popCoins(d);
      return;
    }
    held.coins += d;
    held.coinsT = game.time.real;
  });
  on('lightning', (p) => {
    const power = clamp(num(p.power, 0.8), 0, 1);
    // the sky + palette already flash; postfx adds exposure — keep ours a whisper
    screen.screenFlash('#e8eeff', (postfxOn() ? 0.04 : 0.1) * power, 0.2);
  });
  on('lureBottom', (p) => {
    if (limited('bottom', 0.3)) return;
    const w = where(p, tmp, false);
    const deep = smoothstep(800, 3500, w.y);
    fx.dust(w.x, w.y, deep > 0.5 ? '#6b6458' : '#c9b48c');
  });
  on('zone', (p) => {
    const from = ZONES.findIndex((z) => z.id === p.from);
    const to = ZONES.findIndex((z) => z.id === p.to);
    if (to < 0 || to <= from) return;
    const l = lure();
    const fish = game.fishing && game.fishing.hooked;
    const src = isFish(fish) ? fish : l && l.inWater ? l : null;
    if (!src) return;
    const col = ZONE_TINT[p.to] || '#9fe9ff';
    fx.pulse(src.x, src.y, 240, 0.2, 1.7, true, col);
    fx.pulse(src.x, src.y, 140, 0.16, 1.3, true, col);
  });
  on('retrieved', () => {
    const l = lure();
    if (l && Number.isFinite(l.x)) fx.ripple(l.x, 0.3);
  });

  // ── update / render ───────────────────────────────────────────────────────────────────────────
  function update(dt) {
    ringletBudget = 8;
    popBudget = 6;
    const surf = C.surf;
    const wind = (game.env.weather.wind || 0) * 14;
    for (const p of POOLS) if (p.n) step(p, dt, surf, hooks, wind);
    updateEmitters(dt);
    updateAmbient(dt);
    texts.update(dt);
    screen.update(dt);
    flushHeld();
    sprites.relight(game.env.palette.ambient);
    // governor (EMA of world+glow draw ms)
    perf.acc += dt;
    if (perf.acc > 0.5) {
      perf.acc = 0;
      if (perf.emaMs > 1.35) perf.gov = Math.max(0.35, perf.gov * 0.85);
      else if (perf.emaMs < 0.9) perf.gov = Math.min(1, perf.gov * 1.06);
    }
  }

  function setCam() {
    const v = game.view, c = game.camera, b = c.bounds;
    const k = v.scale * c.zoom;
    cam.k = k;
    cam.ox = v.scale * (v.w / 2 + c.shakeX) - c.x * k;
    cam.oy = v.scale * (v.h / 2 + c.shakeY) - c.y * k;
    cam.l = b.left;
    cam.r = b.right;
    cam.t = b.top;
    cam.b = b.bottom;
  }

  function renderWorld(ctx) {
    const t0 = performance.now();
    setCam();
    ctx.globalCompositeOperation = 'source-over';
    if (P.under.n) draw(ctx, P.under, sprites, cam);
    if (P.bub.n) draw(ctx, P.bub, sprites, cam);
    if (P.surf.n) draw(ctx, P.surf, sprites, cam);
    if (P.air.n) draw(ctx, P.air, sprites, cam);
    game.camera.apply(ctx);
    ctx.globalAlpha = 1;
    perf.worldMs = performance.now() - t0;
  }

  /** Sun glints on flagged spray droplets (day only). */
  function drawGlints(ctx, amount) {
    const p = P.air, list = sprites.list, k = cam.k, ox = cam.ox, oy = cam.oy;
    const t = game.time.now;
    for (let i = 0; i < p.n; i++) {
      if (!(p.flags[i] & F.GLINT) || p.age[i] < 0) continue;
      const x = p.x[i], y = p.y[i];
      if (x < cam.l || x > cam.r || y < cam.t || y > cam.b) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 19 + i * 2.17);
      const a = amount * tw * tw;
      if (a < 0.02) continue;
      const star = tw > 0.94 && (i & 3) === 0;
      const size = star ? 6 + p.s0[i] * 3 : 3 + p.s0[i] * 2.2 * (0.6 + 0.4 * tw);
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.setTransform(k * size, 0, 0, k * size, k * x + ox, k * y + oy);
      ctx.drawImage(list[star ? S.glint : S.glintSoft], -0.5, -0.5, 1, 1);
    }
  }

  function renderGlow(ctx) {
    const t0 = performance.now();
    setCam();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    const env = game.env;
    const sun = env.daylight * (1 - 0.75 * smoothstep(0.35, 1, env.weather.cloud));
    if (sun > 0.05 && P.air.n) drawGlints(ctx, sun * 0.9);
    if (P.glow.n) draw(ctx, P.glow, sprites, cam);
    game.camera.apply(ctx);
    ctx.globalAlpha = 1;
    perf.glowMs = performance.now() - t0;
    const ms = perf.worldMs + perf.glowMs;
    perf.emaMs = perf.emaMs * 0.9 + ms * 0.1;
    if (ms > perf.peakMs) perf.peakMs = ms;
  }

  let screenReal = 0;
  function renderScreen(octx) {
    const t0 = performance.now();
    // update() stops while the game is paused (panels): keep celebrations moving on real time behind them
    const real = game.time.real;
    if (game.paused) {
      const dt = clamp(real - screenReal, 0, 0.05);
      screen.update(dt);
      texts.update(dt);
      flushHeld();
    }
    screenReal = real;
    screen.render(octx);
    texts.render(octx);
    perf.screenMs = performance.now() - t0;
  }

  // ── public API (game.fx) ──────────────────────────────────────────────────────────────────────
  const api = {
    update,
    renderWorld,
    renderGlow,
    renderScreen,
    /** Water splash at the surface at x (y is ignored: the real surface is used). size 0.3 plop … 1 fish … 3 breach. opts {kind, dir} */
    splash(x, y, size = 1, opts) {
      if (Number.isFinite(x)) fx.splash(x, num(size, 1), opts);
    },
    /** A quiet ring on the surface. */
    ripple(x, y, size = 1) {
      if (Number.isFinite(x)) fx.ripple(x, num(size, 1));
    },
    /** Rising, wobbling bubbles that pop at the surface. opts { spread, size, speed } */
    bubbles(x, y, n = 6, opts) {
      if (Number.isFinite(x) && Number.isFinite(y)) fx.bubbles(x, y, num(n, 6), opts);
    },
    /** Generic particles { n, color, speed, life, gravity, size, additive, spread, angle, drag }. */
    burst(x, y, opts) {
      if (Number.isFinite(x) && Number.isFinite(y)) fx.burst(x, y, opts || {});
    },
    /** Four-point glints (additive). */
    sparkle(x, y, n = 8, color) {
      if (Number.isFinite(x) && Number.isFinite(y)) fx.sparkle(x, y, num(n, 8), color || '#fff2c2');
    },
    /** Soft billowing, slowly dispersing ink cloud. A bright colour glows (bioluminescent ink). */
    ink(x, y, size = 1, color) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const c = typeof color === 'string' && color ? color : '#160e18';
      const n = parseInt(c.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
      const lum = Number.isFinite(n) ? (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 : 0;
      fx.cloud(x, y, num(size, 1), c, lum > 0.45 ? { glowColor: c, alpha: 0.4 } : null);
    },
    /** World-anchored text that pops in, floats up and fades (drawn crisp on the overlay). */
    floatText(x, y, text, opts) {
      texts.spawn(x, y, text, opts || {});
    },
    /** Brief full-screen flash. */
    screenFlash(color = '#ffffff', alpha = 0.4, time = 0.25) {
      screen.screenFlash(color, alpha, time);
    },
    /**
     * Boat wake / bow foam, called every frame while the boat moves.
     * x, y: where the trail starts (stern waterline) · dir: travel direction ±1 · strength 0..1.
     */
    wake(x, y, dir, strength) {
      if (!Number.isFinite(x)) return;
      // callers may throttle (every frame … every few frames): emit for the real time since the last call
      const now = game.time.now;
      const dt = clamp(now - amb.wakeCallT, 0, 0.12) || game.time.dt || 1 / 60;
      amb.wakeCallT = now;
      fx.wake(x, dir < 0 ? -1 : 1, num(strength, 0.5), dt, false);
    },
    /** Celebration burst at WORLD (x, y) (drawn in screen space); defaults to the upper middle of the screen. */
    confetti(x, y, n = 60) {
      if (Number.isFinite(x) && Number.isFinite(y)) game.camera.worldToScreen(x, y, tmp2);
      else {
        tmp2.x = game.view.w / 2;
        tmp2.y = game.view.h * 0.4;
      }
      screen.confetti(tmp2.x, tmp2.y, Math.round(num(n, 60) * Math.max(0.5, qualityMul)), 0.8, 1);
    },
    /** Dev / profiling info. */
    stats() {
      return {
        particles: POOLS.reduce((s, p) => s + p.n, 0),
        pools: { under: P.under.n, bub: P.bub.n, surf: P.surf.n, air: P.air.n, glow: P.glow.n },
        texts: texts.count(),
        screen: screen.count(),
        worldMs: perf.worldMs, glowMs: perf.glowMs, screenMs: perf.screenMs, emaMs: perf.emaMs, peakMs: perf.peakMs, governor: perf.gov,
      };
    },
    resetPeak() {
      perf.peakMs = 0;
    },
  };
  return api;
}

export { K as FX_KINDS };
