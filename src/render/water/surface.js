// WATER · surface — drawn after the boat and fish: the film of water over whatever sits at the waterline.
//   translucent band that embeds the hull · darker meniscus · bright crest highlight (slope- and sun-modulated,
//   with travelling ripple glints) · foam flecks · sun/moon specular stars · storm spindrift · rain splashes.
// Never hides the boat: everything here is thin or translucent.
import { clamp, clamp01, lerp, smoothstep, mixRgb, rgbToCss } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { softDot, star, dash, ring, ramp, Tint, makeCanvas } from './sprites.js';

export function createSurface(game, core) {
  const cam = game.camera;
  const env = game.env;
  const rng = createRng(0x5f1a);

  // sprites
  const filmS = ramp(4, 64, (v) => Math.pow(1 - v, 1.7));
  const tFilm = new Tint(filmS);
  const dotS = softDot(16, 0.55);
  // NB: one Tint per colour role — re-tinting a canvas after drawing from it in the same frame forces a GPU flush
  const tFoam = new Tint(dotS), tDrop = new Tint(dotS);
  // a baked clump of foam (three blobs) so heavy seas cost one draw per fleck
  const clumpS = makeCanvas(48, 16);
  {
    const g = clumpS.getContext('2d');
    g.drawImage(dotS, 12, 2, 24, 12);
    g.globalAlpha = 0.75;
    g.drawImage(dotS, 0, 6, 18, 9);
    g.drawImage(dotS, 30, 4, 16, 9);
  }
  const tClump = new Tint(clumpS);
  const starS = star(32);
  const tStar = new Tint(starS), tMoonStar = new Tint(starS);
  const dashS = dash(24, 6);
  const tSpray = new Tint(dashS);
  const ringS = ring(32, 10, 0.22);
  const tRing = new Tint(ringS);

  const mk = (n, f) => Array.from({ length: n }, f);
  const foam = mk(220, () => ({ x: 0, dy: 0, t: 0, life: -1, size: 1, vx: 0, on: false }));
  const glints = mk(46, () => ({ x: 0, t: 0, life: -1, size: 1, moon: false, on: false }));
  const spray = mk(100, () => ({ x: 0, y: 0, vx: 0, vy: 0, t: 0, life: -1, size: 1, on: false }));
  const drops = mk(90, () => ({ x: 0, t: 0, life: -1, h: 1, on: false }));

  // spawn accumulators
  let foamAcc = 0, glintAcc = 0, sprayAcc = 0, rainAcc = 0;

  const take = (pool) => {
    for (let i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i];
    return null;
  };
  /** crestness 0..1 at x: how close the surface is to a local crest (cheap: compare with neighbours ±40 px) */
  const crestAt = (x) => {
    const y = core.lineYAt(x);
    const yl = core.lineYAt(x - 40), yr = core.lineYAt(x + 40);
    return clamp01(((yl + yr) * 0.5 - y) / (4 * Math.max(0.5, core.light.sea)) + 0.5);
  };
  const wetAt = (x) => x > 700 || game.world.terrain.heightAt(x) > core.lineYAt(x) + 2;

  function update(dt) {
    const b = cam.bounds;
    const L = core.light;
    const visible = core.surfaceInView && b.top < core.troughY + 80;
    const wind = L.wind, aw = Math.abs(wind);
    const spanW = b.w + 200;
    // rates follow SCREEN width: zoomed out, flecks are tiny and world-density counts would only cost draw calls
    const rateW = spanW * clamp(cam.zoom, 0.5, 1);
    const x0 = b.left - 100;

    // foam: some always (gentle), lots in wind / heavy seas
    const foamRate = (0.8 + 12 * smoothstep(0.3, 1, aw) * clamp01(L.sea / 1.4) + 10 * L.storm) * rateW / 1000;
    foamAcc += visible ? foamRate * dt : 0;
    while (foamAcc >= 1) {
      foamAcc -= 1;
      const o = take(foam);
      if (!o) break;
      let x = x0 + rng.next() * spanW;
      // prefer crests
      for (let k = 0; k < 2 && crestAt(x) < rng.next(); k++) x = x0 + rng.next() * spanW;
      if (!wetAt(x)) continue;
      o.on = true;
      o.x = x;
      o.dy = rng.range(-3.2, 1.2);
      o.t = 0;
      o.life = rng.range(1.4, 4.2);
      o.size = rng.range(0.7, 1.6) * (1 + 0.5 * L.storm);
      o.vx = wind * rng.range(6, 18);
    }
    for (const o of foam) {
      if (!o.on) continue;
      o.t += dt;
      o.x += o.vx * dt;
      if (o.t >= o.life) o.on = false;
    }

    // specular glints toward the sun / moon
    const overcast = smoothstep(0.45, 1, L.cloud);
    const sunG = core.sunVis * (1 - overcast) * (1 - 0.7 * L.rain);
    const moonG = core.moonVis * (1 - overcast) * 0.7;
    const gRate = (sunG * 26 + moonG * 12) * rateW / 1920;
    glintAcc += visible ? gRate * dt : 0;
    while (glintAcc >= 1) {
      glintAcc -= 1;
      const o = take(glints);
      if (!o) break;
      const useMoon = moonG > sunG ? true : rng.next() < moonG / (sunG + moonG + 1e-6);
      const cx = useMoon ? core.moonWX : core.sunWX;
      const x = cx + rng.gaussian() * 380;
      if (!wetAt(x)) continue;
      o.on = true;
      o.x = x;
      o.t = 0;
      o.life = rng.range(0.14, 0.42);
      o.size = rng.range(0.55, 1.15);
      o.moon = useMoon;
    }
    for (const o of glints) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= o.life) o.on = false;
    }

    // spindrift: spray torn off the crests by strong wind
    const sprayRate = 50 * smoothstep(0.55, 1, aw) * smoothstep(1.1, 2, L.sea) * rateW / 1920;
    sprayAcc += visible ? sprayRate * dt : 0;
    while (sprayAcc >= 1) {
      sprayAcc -= 1;
      const o = take(spray);
      if (!o) break;
      let x = x0 + rng.next() * spanW;
      for (let k = 0; k < 3 && crestAt(x) < 0.75; k++) x = x0 + rng.next() * spanW;
      if (!wetAt(x)) continue;
      o.on = true;
      o.x = x;
      o.y = core.lineYAt(x) - 1;
      o.vx = wind * rng.range(120, 260);
      o.vy = -rng.range(30, 110);
      o.t = 0;
      o.life = rng.range(0.5, 1.2);
      o.size = rng.range(0.6, 1.4);
    }
    for (const o of spray) {
      if (!o.on) continue;
      o.t += dt;
      o.vy += 160 * dt;
      o.vx *= 1 - 0.4 * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.t >= o.life || (o.vy > 0 && o.y > core.lineYAt(o.x) + 2)) o.on = false;
    }

    // rain splashes on the waterline
    const rainRate = 140 * L.rain * rateW / 1920;
    rainAcc += visible ? rainRate * dt : 0;
    while (rainAcc >= 1) {
      rainAcc -= 1;
      const o = take(drops);
      if (!o) break;
      const x = x0 + rng.next() * spanW;
      if (!wetAt(x)) continue;
      o.on = true;
      o.x = x;
      o.t = 0;
      o.life = rng.range(0.22, 0.36);
      o.h = rng.range(0.6, 1.3);
    }
    for (const o of drops) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= o.life) o.on = false;
    }
  }

  // stroke the polyline only where there is open water (breaks over the island's dry land)
  function traceWet(ctx, dy) {
    const xs = core.xs, ys = core.ys, wet = core.wet, n = core.n;
    let pen = false;
    for (let i = 0; i < n; i++) {
      if (!wet[i]) {
        pen = false;
        continue;
      }
      if (!pen) {
        ctx.moveTo(xs[i], ys[i] + dy);
        pen = true;
      } else ctx.lineTo(xs[i], ys[i] + dy);
    }
  }

  const hiCol = [0, 0, 0];
  function render(ctx) {
    const b = cam.bounds;
    if (!core.surfaceInView || b.top > core.troughY + 70 || b.bottom < core.crestY - 30) return;
    const L = core.light;
    const p = env.palette;
    const T = game.time.now;
    const z = cam.zoom;
    const M = ctx.getTransform();
    const overcast = smoothstep(0.45, 1, L.cloud);
    const amb = p.ambient;
    const ab0 = amb[0] / 255, ab1 = amb[1] / 255, ab2 = amb[2] / 255;

    // 1 · translucent film just under the line: embeds the hull, softly
    const top = env.waterColorAt(6, cam.x);
    const lit = clamp01(0.1 + 0.9 * L.surface);
    const film = mixRgb(top, [190 * lit, 245 * lit, 255 * lit], 0.18);
    ctx.globalAlpha = 0.5;
    core.drawStrip(ctx, M, tFilm.get(film), 0, 44, 2, null);
    ctx.globalAlpha = 1;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 2 · meniscus: thin darker line just under the bright edge
    ctx.strokeStyle = rgbToCss([top[0] * 0.55, top[1] * 0.68, top[2] * 0.8], 0.32);
    ctx.lineWidth = 1.6 / z;
    ctx.beginPath();
    traceWet(ctx, 2.6 / z);
    ctx.stroke();

    // 3 · crest highlight: brightness varies with slope (facing the light), crests and travelling ripples
    const sky = mixRgb(p.skyHorizon, [255, 255, 255], 0.42);
    const warm = mixRgb(sky, p.sunGlow, 0.35 * L.golden);
    const night = 1 - smoothstep(0.15, 0.6, L.surface);
    hiCol[0] = lerp(warm[0], 120 + 60 * core.moonVis, night);
    hiCol[1] = lerp(warm[1], 140 + 70 * core.moonVis, night);
    hiCol[2] = lerp(warm[2], 190 + 50 * core.moonVis, night);
    const srcX = core.moonVis > core.sunVis ? core.moonWX : core.sunWX;
    const lightSide = srcX < cam.x ? -1 : 1;
    const g = ctx.createLinearGradient(b.left, 0, b.right, 0);
    const NS = 40;
    const baseA = lerp(0.55, 0.3, night) * (1 - 0.25 * overcast);
    for (let i = 0; i <= NS; i++) {
      const x = b.left + (b.w * i) / NS;
      const slope = (core.lineYAt(x + 6) - core.lineYAt(x - 6)) / 12;
      const facing = clamp01(0.5 - slope * lightSide * 3.2);
      const ripple = 0.72 + 0.28 * Math.sin(x * 0.043 - T * 2.6) * Math.sin(x * 0.011 + T * 0.9);
      const sunNear = Math.exp(-Math.pow((x - srcX) / 700, 2));
      const a = clamp01(baseA * (0.55 + 0.45 * facing) * ripple * (0.8 + 0.4 * sunNear));
      g.addColorStop(i / NS, rgbToCss(hiCol, a));
    }
    ctx.strokeStyle = g;
    // soft halo + crisp core
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 4.5 / z;
    ctx.beginPath();
    traceWet(ctx, 0.4 / z);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.35 / z;
    ctx.stroke();

    // 4 · foam flecks riding the line
    const foamCol = [242 * ab0 + 8, 248 * ab1 + 6, 252 * ab2 + 4];
    const fSpr = tFoam.get(foamCol), cSpr = tClump.get(foamCol);
    for (const o of foam) {
      if (!o.on) continue;
      if (o.x < b.left - 10 || o.x > b.right + 10) continue;
      const k = o.t / o.life;
      const fade = Math.min(1, k * 14) * Math.pow(1 - k, 1.1);
      const y = core.lineYAt(o.x) + o.dy;
      ctx.globalAlpha = 0.95 * fade;
      if (o.size > 1.4) {
        // heavy seas: a clump of foam, not a single fleck
        const w = 11 * o.size, h = 3.7 * o.size;
        ctx.drawImage(cSpr, o.x - w * 0.5, y - h * 0.5, w, h);
      } else {
        const w = 6 * o.size, h = 2.4 * o.size;
        ctx.drawImage(fSpr, o.x - w * 0.5, y - h * 0.5, w, h);
      }
    }
    ctx.globalAlpha = 1;

    // 5 · spindrift
    if (L.storm > 0.05 || Math.abs(L.wind) > 0.55) {
      const sSpr = tSpray.get(foamCol);
      const fSpr2 = tFoam.get(foamCol);
      for (const o of spray) {
        if (!o.on) continue;
        if (o.x < b.left - 20 || o.x > b.right + 20) continue;
        const k = o.t / o.life;
        const sp = Math.hypot(o.vx, o.vy);
        const len = clamp(sp * 0.07, 5, 20) * o.size;
        // a misty puff where it tore off, then a streak riding the wind
        if (k < 0.3) {
          const r = (4 + 10 * k) * o.size;
          ctx.globalAlpha = 0.45 * (1 - k / 0.3);
          ctx.drawImage(fSpr2, o.x - o.vx * o.t - r, core.lineYAt(o.x - o.vx * o.t) - r * 0.9, r * 2, r * 1.2);
        }
        // the streak, oriented along its flight
        const c = o.vx / (sp || 1), s = o.vy / (sp || 1);
        ctx.setTransform(M.a * c, M.a * s, -M.a * s, M.a * c, M.a * o.x + M.e, M.a * o.y + M.f);
        ctx.globalAlpha = 1 - k * k;
        ctx.drawImage(sSpr, -len * 0.5, -1.7 * o.size, len, 3.4 * o.size);
        ctx.setTransform(M);
      }
      ctx.globalAlpha = 1;
    }

    // 6 · rain splashes: a little jet and droplet, and a ring spreading on the surface
    if (L.rain > 0.02) {
      const rc = [225 * ab0 + 20, 232 * ab1 + 20, 245 * ab2 + 10];
      const rSpr = tRing.get(rc);
      ctx.strokeStyle = rgbToCss(rc, 0.7);
      ctx.lineWidth = 1.1 / z;
      ctx.beginPath();
      for (const o of drops) {
        if (!o.on) continue;
        if (o.x < b.left || o.x > b.right) continue;
        const k = o.t / o.life;
        if (k > 0.55) continue;
        const y = core.lineYAt(o.x);
        const hh = Math.sin(Math.PI * k / 0.55) * 4.5 * o.h;
        ctx.moveTo(o.x, y - 0.3);
        ctx.lineTo(o.x, y - hh);
      }
      ctx.globalAlpha = L.rain;
      ctx.stroke();
      const dSpr = tDrop.get(rc);
      for (const o of drops) {
        if (!o.on || o.x < b.left || o.x > b.right) continue;
        const k = o.t / o.life;
        if (k < 0.3 || k > 0.85) continue;
        const hh = Math.sin(Math.PI * (k - 0.3) / 0.55) * 7 * o.h;
        ctx.globalAlpha = 0.8 * L.rain;
        ctx.drawImage(dSpr, o.x - 1.1, core.lineYAt(o.x) - hh - 1.1, 2.2, 2.2);
      }
      for (const o of drops) {
        if (!o.on) continue;
        if (o.x < b.left || o.x > b.right) continue;
        const k = o.t / o.life;
        const w = 4 + 12 * k;
        ctx.globalAlpha = 0.5 * L.rain * (1 - k);
        ctx.drawImage(rSpr, o.x - w * 0.5, core.lineYAt(o.x) - 1.5, w, 3);
      }
      ctx.globalAlpha = 1;
    }

    // 7 · specular stars (additive)
    ctx.globalCompositeOperation = 'lighter';
    const sunCol = mixRgb(mixRgb(p.sun, [255, 255, 255], 0.5), [255, 230, 160], 0.5 * L.golden);
    const sSpr = tStar.get(sunCol), mSpr = tMoonStar.get([200, 215, 255]);
    for (const o of glints) {
      if (!o.on) continue;
      if (o.x < b.left - 20 || o.x > b.right + 20) continue;
      const k = o.t / o.life;
      const tw = Math.sin(Math.PI * k);
      const sz = (o.moon ? 11 : 15) * o.size * (0.6 + 0.4 * tw) / Math.sqrt(z);
      ctx.globalAlpha = tw * (o.moon ? 0.55 : 0.9);
      ctx.drawImage(o.moon ? mSpr : sSpr, o.x - sz * 0.5, core.lineYAt(o.x) - sz * 0.5 - 0.5, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { update, render, pools: { foam, glints, spray, drops } };
}
