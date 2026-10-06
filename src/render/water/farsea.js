// WATER · far sea — the strip of open sea seen from above, between the horizon (WORLD.horizonY) and the cut line.
//
// Perspective model: a ground-plane point at distance z projects to s = zCut / z (1 at the cut line, → 0 at the
// horizon) → world y = horizonY·(1 − s) and world x = cam.x + (X − cam.x)·s, where X is its lateral ground
// position. So far features are smaller, flatter, closer together AND scroll slower (parallax) — the strip reads
// as a real receding plane. The sun/moon glitter path is screen-anchored (it hangs under the sky's sun).
import { WORLD } from '../../core/config.js';
import { clamp, clamp01, lerp, smoothstep, mixRgb, rgbToCss } from '../../core/math.js';
import { createRng, noise1 } from '../../core/rng.js';
import { dash, blob, ring, ramp, Tint } from './sprites.js';
import { createFarLife } from './farlife.js';

const HZ = WORLD.horizonY;

export function createFarSea(game, core) {
  const cam = game.camera;
  const env = game.env;
  const rng = createRng(0x5eaf00d);

  // ── sprites ────────────────────────────────────────────────────────────────
  const dashS = dash(32, 6);
  const tLight = new Tint(dashS), tDark = new Tint(dashS), tSun = new Tint(dashS), tMoon = new Tint(dashS), tCap = new Tint(dashS);
  const blobS = blob(128);
  const tShadow = new Tint(blobS), tGlow = new Tint(blobS), tGlow2 = new Tint(blobS), tMoonGlow = new Tint(blobS);
  const ringS = ring(40, 12, 0.2);
  const tRing = new Tint(ringS);
  const nearS = ramp(4, 48, (v) => Math.pow(v, 1.8));
  const tNear = new Tint(nearS);

  const yOf = (s) => HZ * (1 - s);
  const viewX = (X, s) => cam.x + (X - cam.x) * s;
  const groundX = (x, s) => cam.x + (x - cam.x) / s;

  const life = createFarLife(game, core, { yOf, viewX, groundX });

  // ── particle pools (all in ground space: s + lateral X) ──────────────────────
  const N_WAVE = 200, N_SUN = 260, N_MOON = 110, N_CAP = 130, N_RAIN = 170, N_SHADOW = 6;
  const mk = (n, f) => Array.from({ length: n }, f);
  const wav = mk(N_WAVE, () => ({ s: 0.5, X: 0, len: 1, t: 0, life: -1, dark: false, a: 1 }));
  const sunG = mk(N_SUN, () => ({ s: 0.5, u: 0, t: 0, life: -1, size: 1 }));
  const moonG = mk(N_MOON, () => ({ s: 0.5, u: 0, t: 0, life: -1, size: 1 }));
  const caps = mk(N_CAP, () => ({ s: 0.5, X: 0, t: 0, life: -1, w: 1, on: false }));
  const rain = mk(N_RAIN, () => ({ s: 0.5, X: 0, t: 0, life: -1, w: 1 }));
  const shadows = mk(N_SHADOW, () => ({ s: 0.5, X: 0, w: 800, ds: 0.2, a: 1, life: -1 }));

  const randViewX = (b, s, m = 30) => groundX(lerp(b.left - m, b.right + m, rng.next()), s);
  const inView = (X, s, b, m = 60) => {
    const x = viewX(X, s);
    return x > b.left - m && x < b.right + m;
  };

  function spawnWave(o, b, warm) {
    o.s = 0.035 + 0.965 * Math.pow(rng.next(), 1.25);
    o.X = randViewX(b, o.s);
    o.len = rng.range(0.35, 1);
    o.life = rng.range(1.4, 4.2);
    o.t = warm ? rng.next() * o.life : 0;
    o.dark = rng.chance(0.45);
    o.a = rng.range(0.45, 1);
  }
  function spawnGlint(o, e, warm) {
    const sMin = lerp(0.012, 0.3, e);
    o.s = sMin + (1 - sMin) * Math.pow(rng.next(), lerp(1.5, 0.75, e));
    o.u = rng.gaussian() * 0.38;
    o.life = rng.range(0.09, 0.38);
    o.t = warm ? rng.next() * o.life : 0;
    o.size = rng.range(0.35, 1);
  }
  function spawnCap(o, b, warm) {
    o.s = 0.06 + 0.94 * Math.pow(rng.next(), 1.15);
    o.X = randViewX(b, o.s);
    o.life = rng.range(1.0, 2.6);
    o.t = warm ? rng.next() * o.life : 0;
    o.w = rng.range(0.5, 1.2);
  }
  function spawnRain(o, b, warm) {
    o.s = 0.05 + 0.95 * Math.pow(rng.next(), 0.9);
    o.X = randViewX(b, o.s);
    o.life = rng.range(0.18, 0.34);
    o.t = warm ? rng.next() * o.life : 0;
    o.w = rng.range(0.6, 1.2);
  }
  function spawnShadow(o, b, edge) {
    o.s = rng.range(0.1, 0.95);
    o.w = rng.range(520, 1250);
    o.ds = rng.range(0.07, 0.16) + 0.22 * o.s;
    o.a = rng.range(0.5, 1);
    if (edge) {
      // enter from the upwind edge
      const w = env.weather.wind >= 0 ? -1 : 1;
      o.X = groundX(w < 0 ? b.left - o.w * o.s * 0.5 : b.right + o.w * o.s * 0.5, o.s);
    } else o.X = randViewX(b, o.s, 200);
    o.life = 1;
  }

  // ── colours (refreshed per frame) ───────────────────────────────────────────
  const C = {
    horizon: [0, 0, 0], mid: [0, 0, 0], near: [0, 0, 0], light: [0, 0, 0], dark: [0, 0, 0], sun: [0, 0, 0],
    glow: [0, 0, 0], cap: [0, 0, 0], rain: [0, 0, 0], fog: [0, 0, 0], nearBand: [0, 0, 0], shadow: [0, 0, 0],
  };
  const set3 = (o, c) => {
    o[0] = c[0];
    o[1] = c[1];
    o[2] = c[2];
  };

  function refreshColours() {
    const p = env.palette, L = core.light;
    const amb = p.ambient;
    const overcast = smoothstep(0.45, 1, L.cloud);
    // Fresnel: grazing angles near the horizon mirror the sky; nearer, we look down into the water.
    const body = env.waterColorAt(0, cam.x);
    const top = p.waterTop;
    // Fresnel: right at the horizon the sea mirrors the horizon sky; a little nearer it mirrors the sky higher
    // up (skyMid); near the viewer we look down into the water itself. A low sun boosts the reflection.
    const g = L.golden;
    set3(C.horizon, mixRgb(top, p.skyHorizon, lerp(0.7, 0.8, g) - 0.12 * overcast));
    set3(C.mid, mixRgb(top, mixRgb(p.skyHorizon, p.skyMid, 0.6), 0.34 + 0.22 * g));
    const deep = [top[0] * 0.72, top[1] * 0.82, top[2] * 0.9];
    set3(C.near, mixRgb(mixRgb(deep, body, 0.15), p.skyMid, 0.05 + 0.08 * g));
    set3(C.nearBand, [deep[0] * 0.7, deep[1] * 0.76, deep[2] * 0.84]);
    set3(C.light, mixRgb(mixRgb(p.skyHorizon, [255, 255, 255], 0.3), p.sunGlow, 0.15 * L.golden));
    set3(C.dark, [top[0] * 0.55, top[1] * 0.66, top[2] * 0.76]);
    // glitter: near-white sparks with a golden cast at sunrise / sunset (yellow keeps additive light from going pink)
    set3(C.sun, mixRgb(mixRgb(p.sun, [255, 236, 170], 0.55 * L.golden), [255, 255, 255], 0.3 * (1 - L.golden)));
    set3(C.glow, mixRgb(p.sunGlow, p.sun, 0.45));
    const ab = [amb[0] / 255, amb[1] / 255, amb[2] / 255];
    set3(C.cap, [250 * ab[0], 252 * ab[1], 255 * ab[2]]);
    set3(C.rain, mixRgb([235 * ab[0], 240 * ab[1], 248 * ab[2]], p.skyHorizon, 0.3));
    set3(C.fog, mixRgb(p.haze, p.skyHorizon, 0.55));
    set3(C.shadow, [top[0] * 0.32, top[1] * 0.44, top[2] * 0.6]);
  }

  // ── update ─────────────────────────────────────────────────────────────────
  let warmed = false;
  function update(dt) {
    const b = cam.bounds;
    if (!core.surfaceInView && warmed) {
      life.update(dt);
      return;
    }
    const w = env.weather;
    const e = clamp01(env.sun.elev);
    const wind = w.wind;
    const drift = wind * 26; // ground px / s
    const warm = !warmed;
    warmed = true;
    for (const o of wav) {
      o.t += dt;
      o.X += drift * 0.35 * dt;
      if (o.t >= o.life || (o.life > 0 && !inView(o.X, o.s, b))) spawnWave(o, b, warm || o.life < 0);
    }
    for (const o of sunG) {
      o.t += dt;
      if (o.t >= o.life) spawnGlint(o, e, warm || o.life < 0);
    }
    const me = clamp01(env.moon.elev);
    for (const o of moonG) {
      o.t += dt;
      if (o.t >= o.life) spawnGlint(o, me, warm || o.life < 0);
    }
    // whitecaps: only part of the pool is active, by wind & sea
    const capFrac = smoothstep(0.32, 0.95, Math.abs(wind)) * clamp01(w.sea / 1.5);
    const capN = Math.round(N_CAP * capFrac);
    for (let i = 0; i < N_CAP; i++) {
      const o = caps[i];
      o.t += dt;
      o.X += drift * dt;
      if (o.t >= o.life || !inView(o.X, o.s, b)) {
        if (i < capN) {
          spawnCap(o, b, warm || o.life < 0);
          o.on = true;
        } else o.on = false;
      }
    }
    if (w.rain > 0.02) {
      for (const o of rain) {
        o.t += dt;
        if (o.t >= o.life || !inView(o.X, o.s, b)) spawnRain(o, b, warm || o.life < 0);
      }
    }
    for (const o of shadows) {
      o.X += drift * 1.5 * dt;
      if (o.life < 0) spawnShadow(o, b, false);
      else if (!inView(o.X, o.s, b, o.w * o.s * 0.6 + 80)) spawnShadow(o, b, true);
    }
    life.update(dt);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  function render(ctx) {
    if (!core.surfaceInView) return;
    const b = cam.bounds;
    const L = core.light;
    const T = game.time.now;
    refreshColours();
    const bot = core.troughY + 3;
    const left = b.left - 4, width = b.w + 8;

    // 1 · base Fresnel gradient
    const g = ctx.createLinearGradient(0, HZ, 0, 0);
    g.addColorStop(0, rgbToCss(C.horizon));
    g.addColorStop(0.2, rgbToCss(mixRgb(C.horizon, C.mid, 0.5)));
    g.addColorStop(0.45, rgbToCss(C.mid));
    g.addColorStop(1, rgbToCss(C.near));
    ctx.fillStyle = g;
    ctx.fillRect(left, HZ, width, bot - HZ);

    const overcast = smoothstep(0.45, 1, L.cloud);
    const amb = env.palette.ambient;
    const lum = (amb[0] * 0.3 + amb[1] * 0.55 + amb[2] * 0.15) / 255;

    // 2 · cloud shadows (broken cloud + sun)
    const shadowAmt = core.sunVis * smoothstep(0.14, 0.4, L.cloud) * (1 - smoothstep(0.72, 0.97, L.cloud));
    if (shadowAmt > 0.01) {
      const spr = tShadow.get(C.shadow);
      for (const o of shadows) {
        const x = viewX(o.X, o.s);
        const ww = o.w * o.s;
        if (x + ww < b.left || x - ww > b.right) continue;
        const y0 = yOf(Math.max(0.005, o.s - o.ds * 0.5)), y1 = yOf(Math.min(1.1, o.s + o.ds * 0.5));
        ctx.globalAlpha = 0.55 * shadowAmt * o.a;
        ctx.drawImage(spr, x - ww * 0.5, y0, ww, y1 - y0);
      }
      ctx.globalAlpha = 1;
    }

    // 3 · long swell bands, compressed toward the horizon
    drawSwells(ctx, b, T, L, lum);

    // 4 · glow column under a low sun / the moon (additive)
    const e = clamp01(env.sun.elev);
    const low = 1 - smoothstep(0.15, 0.85, e);
    const sunPath = core.sunVis * (1 - 0.88 * overcast) * lerp(0.55, 1, low) * (1 + 0.5 * L.golden);
    const moonPath = core.moonVis * (1 - 0.92 * overcast) * 0.75;
    const hw = (s, el) => (7 + 150 * Math.pow(s, 1.1)) * lerp(1, 2.3, el);
    if (sunPath > 0.01) {
      // the water under a low sun takes on its colour (source-over: a reflection replaces, it does not add)
      const wCol = hw(0.6, e) * 2.6;
      ctx.globalAlpha = clamp01(0.42 * sunPath * (0.35 + 0.65 * low));
      ctx.drawImage(tGlow.get(C.glow), core.sunWX - wCol * 0.5, HZ - 26, wCol, (0 - HZ) * 2 + 40);
      ctx.globalCompositeOperation = 'lighter';
      if (low > 0.2) {
        // tight bright smear right at the horizon under a setting / rising sun
        ctx.globalAlpha = clamp01(0.55 * sunPath * low * low);
        ctx.drawImage(tGlow2.get(C.sun), core.sunWX - 170, HZ - 5, 340, 15);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (moonPath > 0.01) {
      const wCol = hw(0.6, clamp01(env.moon.elev)) * 1.7;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(0.3 * moonPath);
      ctx.drawImage(tMoonGlow.get([120, 140, 190]), core.moonWX - wCol * 0.5, HZ - 26, wCol, (0 - HZ) * 2 + 40);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // 5 · wavelets: light sky-glints and dark troughs, flickering
    const calm = 1 - 0.35 * L.rain;
    const lightSpr = tLight.get(C.light), darkSpr = tDark.get(C.dark);
    for (const o of wav) {
      if (o.life <= 0) continue;
      const x = viewX(o.X, o.s);
      if (x < b.left - 40 || x > b.right + 40) continue;
      const k = o.t / o.life;
      const fade = Math.sin(Math.PI * k);
      const sp = o.s;
      const len = (5 + 34 * o.len) * Math.pow(sp, 0.95);
      const th = Math.max(0.55, 2.3 * sp);
      const y = yOf(sp) + Math.sin(T * 1.3 + o.X * 0.01) * 0.6 * sp;
      if (o.dark) {
        ctx.globalAlpha = fade * o.a * 0.32 * calm;
        ctx.drawImage(darkSpr, x - len * 0.5, y - th * 0.5, len, th);
      } else {
        ctx.globalAlpha = fade * o.a * (0.18 + 0.32 * sp) * calm * (0.55 + 0.45 * lum);
        ctx.drawImage(lightSpr, x - len * 0.5, y - th * 0.5, len, th);
      }
    }
    ctx.globalAlpha = 1;

    // 6 · whitecaps — bigger and streakier as the sea builds (wind-blown foam lanes in a storm)
    const capSpr = tCap.get(C.cap);
    const seaK = clamp(L.sea, 0.5, 2.4);
    for (let i = 0; i < caps.length; i++) {
      const o = caps[i];
      if (!o.on || o.life <= 0) continue;
      const x = viewX(o.X, o.s);
      if (x < b.left - 60 || x > b.right + 60) continue;
      const k = o.t / o.life;
      const fade = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.6);
      const streak = L.storm > 0.3 && (i & 3) === 0;
      let len = (8 + 26 * o.w) * o.s * (0.7 + 0.5 * k) * (0.6 + 0.55 * seaK);
      let th = Math.max(0.8, 3 * o.s * (0.7 + 0.35 * seaK));
      if (streak) {
        len *= 3.2;
        th *= 0.55;
      }
      ctx.globalAlpha = (streak ? 0.45 : 0.85) * fade;
      ctx.drawImage(capSpr, x - len * 0.5, yOf(o.s) - th * 0.6, len, th);
      if (!streak && seaK > 1.2) {
        // the broken crest throws a little spray up behind it
        ctx.globalAlpha = 0.35 * fade * (seaK - 1.2);
        ctx.drawImage(capSpr, x - len * 0.3, yOf(o.s) - th * 1.6, len * 0.6, th * 1.1);
      }
    }
    ctx.globalAlpha = 1;

    // 7 · glitter paths (additive)
    ctx.globalCompositeOperation = 'lighter';
    if (sunPath > 0.01) drawGlitter(ctx, b, sunG, core.sunWX, e, tSun.get(C.sun), sunPath * (1 - 0.6 * L.rain), hw);
    if (moonPath > 0.01) drawGlitter(ctx, b, moonG, core.moonWX, clamp01(env.moon.elev), tMoon.get([215, 226, 255]), moonPath * 2.4, hw, 0.85);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // 8 · rain pocks
    if (L.rain > 0.02) {
      const spr = tRing.get(C.rain);
      for (const o of rain) {
        if (o.life <= 0) continue;
        const x = viewX(o.X, o.s);
        if (x < b.left - 20 || x > b.right + 20) continue;
        const k = o.t / o.life;
        const ww = (3 + 14 * o.s) * o.w * (0.35 + 0.65 * k);
        const hh = Math.max(0.6, ww * 0.26);
        ctx.globalAlpha = 0.55 * L.rain * (1 - k);
        ctx.drawImage(spr, x - ww * 0.5, yOf(o.s) - hh * 0.5, ww, hh);
      }
      ctx.globalAlpha = 1;
    }

    // 9 · far life (dolphins, whales, sails) — before the haze so it recedes
    life.render(ctx, b);

    // 10 · fog / haze swallowing the horizon
    if (L.fog > 0.01) {
      const fg = ctx.createLinearGradient(0, HZ, 0, 0);
      fg.addColorStop(0, rgbToCss(C.fog, clamp01(L.fog * 0.97)));
      fg.addColorStop(0.5, rgbToCss(C.fog, clamp01(L.fog * 0.62)));
      fg.addColorStop(1, rgbToCss(C.fog, clamp01(L.fog * 0.3)));
      ctx.fillStyle = fg;
      ctx.fillRect(left, HZ, width, bot - HZ);
    }
    // a whisper of atmospheric haze right at the horizon even on clear days
    const hz = ctx.createLinearGradient(0, HZ, 0, HZ + 12);
    hz.addColorStop(0, rgbToCss(env.palette.skyHorizon, 0.5));
    hz.addColorStop(1, rgbToCss(env.palette.skyHorizon, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(left, HZ, width, 12);

    // 11 · the near water: darker, more saturated band just behind the cut line (gives the edge a body)
    const M = ctx.getTransform();
    ctx.globalAlpha = 0.8;
    core.drawStrip(ctx, M, tNear.get(C.nearBand), -20, 20, 2, null);
    ctx.globalAlpha = 1;
  }

  function drawSwells(ctx, b, T, L, lum) {
    const N = 10;
    const sea = L.sea;
    const speed = 0.012 * (0.7 + 0.3 * sea);
    const step = 26 / cam.zoom;
    const amp = 2.2 * sea;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      const dark = pass === 1;
      ctx.strokeStyle = rgbToCss(dark ? C.dark : C.light);
      for (let k = 0; k < N; k++) {
        const ph = (k / N + T * speed) % 1;
        const z = lerp(16, 1.05, ph);
        const s = 1 / z;
        const fade = smoothstep(0, 0.2, ph) * (1 - smoothstep(0.82, 1, ph));
        const a = (dark ? 0.16 : 0.11 * (0.5 + 0.5 * lum)) * fade * (0.6 + 0.4 * s);
        if (a < 0.004) continue;
        ctx.globalAlpha = a;
        ctx.lineWidth = Math.max(0.5, (dark ? 2.6 : 1.6) * s);
        const yb = yOf(s) + (dark ? 1.4 * s : 0);
        ctx.beginPath();
        for (let x = b.left - step; x <= b.right + step; x += step) {
          const X = groundX(x, s);
          const wob = Math.sin(X * 0.0037 + k * 1.7 + T * 0.21) * 0.6 + Math.sin(X * 0.0093 + k * 3.1 - T * 0.37) * 0.4;
          const y = yb + wob * amp * s;
          if (x === b.left - step) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGlitter(ctx, b, pool, cx, el, spr, inten, hw, scale = 1) {
    const T = game.time.now;
    for (const o of pool) {
      if (o.life <= 0) continue;
      const k = o.t / o.life;
      const tw = Math.sin(Math.PI * k);
      const s = o.s;
      const x = cx + o.u * hw(s, el) * scale;
      if (x < b.left - 20 || x > b.right + 20) continue;
      // brighter toward the horizon for a low sun, toward the viewer for a high one
      const along = lerp(1 - 0.55 * s, 0.45 + 0.55 * s, el);
      const core01 = Math.exp(-o.u * o.u * 3.2);
      const a = inten * tw * tw * along * (0.35 + 0.65 * core01);
      if (a < 0.01) continue;
      const len = (2.5 + 15 * s) * o.size * scale * (0.8 + 0.25 * noise1(T * 3 + o.u * 9));
      const th = Math.max(0.6, 1.9 * s * scale);
      ctx.globalAlpha = clamp01(a);
      ctx.drawImage(spr, x - len * 0.5, yOf(s) - th * 0.5 + 0.4, len, th);
    }
    ctx.globalAlpha = 1;
  }

  return { update, render, life };
}
