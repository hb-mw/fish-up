// WATER · overlay — pass 11, after effects and before the additive light pass:
//   1. depth fog: fades everything already drawn toward the water colour (the SAME colour field as the body,
//      alpha by depth and darkness) so creatures recede with depth and the background never shifts;
//   2. marine snow: tiled particle layers at three parallax depths (pattern fills — a few fills per frame),
//      denser in the deep, catching the light near the surface;
//   3. sunlit motes twinkling in the upper water by day, bioluminescent plankton sparkling at night
//      (stirred up by the boat's wake and a moving lure).
import { clamp, clamp01, lerp, smoothstep } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { makeCanvas, softDot, Tint } from './sprites.js';

const RES = 1.5; // tile px per world px

function snowTile(size, n, seed, rMin, rMax, aMin, aMax) {
  const px = Math.round(size * RES);
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const rng = createRng(seed);
  const dot = softDot(32, 0.35);
  for (let i = 0; i < n; i++) {
    const x = rng.next() * px, y = rng.next() * px;
    const r = rng.range(rMin, rMax) * RES * (rng.chance(0.08) ? 1.8 : 1);
    g.globalAlpha = rng.range(aMin, aMax);
    // wrap so the tile repeats seamlessly
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cx = x + ox * px, cy = y + oy * px;
        if (cx + r < 0 || cx - r > px || cy + r < 0 || cy - r > px) continue;
        // marine snow is flaky, not round: slightly stretched, random orientation
        g.save();
        g.translate(cx, cy);
        g.rotate(rng.next() * Math.PI);
        g.drawImage(dot, -r * 1.3, -r * 0.8, r * 2.6, r * 1.6);
        g.restore();
      }
    }
  }
  // gentle pale cyan-white
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = 'rgb(222,240,246)';
  g.fillRect(0, 0, px, px);
  return c;
}

export function createOverlay(game, core) {
  const cam = game.camera;
  const env = game.env;
  const rng = createRng(0x0b5e);

  const LAYERS = [
    { tile: snowTile(512, 300, 11, 0.5, 1.0, 0.35, 0.9), size: 512, par: 0.55, sc: 0.62, a: 0.42, sink: 5, sway: 14, ph: 0 },
    { tile: snowTile(512, 150, 22, 0.7, 1.5, 0.35, 0.9), size: 512, par: 0.8, sc: 0.85, a: 0.5, sink: 8, sway: 20, ph: 2 },
    { tile: snowTile(512, 46, 33, 1.0, 2.2, 0.3, 0.8), size: 512, par: 1.15, sc: 1.2, a: 0.42, sink: 13, sway: 28, ph: 4 },
  ];
  const DEEP = { tile: snowTile(512, 240, 44, 0.6, 1.3, 0.3, 0.85), size: 512, par: 0.7, sc: 0.75, a: 0.45, sink: 4, sway: 10, ph: 1 };
  let patCtx = null;
  const mtx = new DOMMatrix();

  const glowS = softDot(32, 0.5);
  const tPlank = new Tint(glowS), tMote = new Tint(softDot(16, 0.7));
  const mk = (n, f) => Array.from({ length: n }, f);
  const plank = mk(80, () => ({ x: 0, y: 0, t: 0, life: -1, size: 1, on: false, hue: 0 }));
  const motes = mk(48, () => ({ x: 0, y: 0, t: 0, life: -1, size: 1, on: false, vx: 0, vy: 0 }));
  let plankAcc = 0, moteAcc = 0;
  const take = (pool) => {
    for (let i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i];
    return null;
  };

  function update(dt) {
    const b = cam.bounds;
    const L = core.light;
    const upper = b.top < 650 && b.bottom > 0;
    // bioluminescent plankton: ambient sparkles near the surface at night + bursts in the wake / around the lure
    const nightK = smoothstep(0.35, 0.85, env.night);
    if (nightK > 0.01 && upper) {
      plankAcc += nightK * 9 * (b.w / 1920) * dt;
      const boat = game.boat, lure = game.fishing && game.fishing.lure;
      const wake = Math.min(1, Math.abs(boat.vx || 0) / 160);
      plankAcc += nightK * wake * 30 * dt;
      while (plankAcc >= 1) {
        plankAcc -= 1;
        const o = take(plank);
        if (!o) break;
        o.on = true;
        if (wake > 0.1 && rng.next() < 0.7) {
          o.x = boat.x - Math.sign(boat.vx || 1) * rng.range(-60, 260);
          o.y = core.lineYAt(o.x) + rng.range(4, 50);
        } else if (lure && lure.inWater && lure.speed > 40 && rng.next() < 0.5) {
          o.x = lure.x + rng.range(-40, 40);
          o.y = Math.max(core.lineYAt(o.x) + 4, lure.y + rng.range(-30, 30));
        } else {
          o.x = lerp(b.left, b.right, rng.next());
          o.y = Math.max(core.lineYAt(o.x) + 6, 0) + Math.pow(rng.next(), 1.6) * 520;
        }
        o.t = 0;
        o.life = rng.range(0.5, 1.5);
        o.size = rng.range(0.6, 1.3);
        o.hue = rng.next();
      }
    }
    for (const o of plank) {
      if (!o.on) continue;
      o.t += dt;
      if (o.t >= o.life) o.on = false;
    }
    // sunlit motes in the upper water by day
    const dayK = smoothstep(0.35, 0.8, L.surface) * (1 - 0.6 * smoothstep(0.5, 1, L.cloud));
    if (dayK > 0.01 && upper) {
      moteAcc += dayK * 16 * (b.w / 1920) * dt;
      while (moteAcc >= 1) {
        moteAcc -= 1;
        const o = take(motes);
        if (!o) break;
        o.on = true;
        o.x = lerp(b.left, b.right, rng.next());
        o.y = Math.max(core.lineYAt(o.x) + 10, 0) + Math.pow(rng.next(), 1.4) * 460;
        o.t = 0;
        o.life = rng.range(2.5, 6);
        o.size = rng.range(0.6, 1.3);
        o.vx = rng.range(-6, 6);
        o.vy = rng.range(2, 8);
      }
    }
    for (const o of motes) {
      if (!o.on) continue;
      o.t += dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.t >= o.life) o.on = false;
    }
  }

  function render(ctx) {
    const b = cam.bounds;
    if (b.bottom < core.crestY - 2) return;
    const L = core.light;
    const T = game.time.now;
    const off = core.off;
    ctx.save();
    core.clipBelow(ctx);
    // 1 · depth fog
    if (!off.fog) core.drawFogField(ctx);

    // 2 · marine snow
    const top = Math.max(b.top, core.crestY - 2);
    if (!off.snow && b.bottom > top) {
      if (patCtx !== ctx) {
        patCtx = ctx;
        for (const l of LAYERS) l.pat = ctx.createPattern(l.tile, 'repeat');
        DEEP.pat = ctx.createPattern(DEEP.tile, 'repeat');
      }
      for (const l of LAYERS) drawSnow(ctx, b, top, l, T, (y) => snowAlpha(y, L) * l.a);
      if (b.bottom > 700) drawSnow(ctx, b, top, DEEP, T, (y) => DEEP.a * smoothstep(700, 2600, y) * (0.5 + 0.5 * snowLit(y, L)));
    }

    // 3 · motes and plankton (additive)
    ctx.globalCompositeOperation = 'lighter';
    const mSpr = tMote.get([255, 250, 225]);
    for (const o of motes) {
      if (!o.on || o.x < b.left || o.x > b.right || o.y < b.top || o.y > b.bottom) continue;
      const k = o.t / o.life;
      const tw = Math.sin(Math.PI * k) * (0.55 + 0.45 * Math.sin(T * 5 + o.x * 0.1));
      const s = 3.2 * o.size;
      ctx.globalAlpha = clamp01(0.5 * tw * (1 - o.y / 700));
      ctx.drawImage(mSpr, o.x - s * 0.5, o.y - s * 0.5, s, s);
    }
    const pSpr = tPlank.get([80, 255, 215]);
    for (const o of plank) {
      if (!o.on || o.x < b.left - 10 || o.x > b.right + 10 || o.y < b.top - 10 || o.y > b.bottom + 10) continue;
      const k = o.t / o.life;
      const env1 = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 2);
      const s = (15 + 11 * o.hue) * o.size;
      ctx.globalAlpha = clamp01(0.75 * env1);
      ctx.drawImage(pSpr, o.x - s * 0.5, o.y - s * 0.5, s, s);
      ctx.globalAlpha = clamp01(0.9 * env1);
      ctx.drawImage(pSpr, o.x - s * 0.15, o.y - s * 0.15, s * 0.3, s * 0.3);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Lit near the surface (motes catch the light), faint but present deeper down.
  function snowLit(y, L) {
    return Math.sqrt(Math.max(0, L.surface * Math.exp(-Math.max(0, y) / 1500)));
  }
  function snowAlpha(y, L) {
    const lit = snowLit(y, L);
    const deep = smoothstep(300, 2400, y);
    return clamp01(0.18 + 0.55 * lit * (1 - 0.4 * deep) + 0.32 * deep) * (1 + 0.4 * L.storm);
  }

  function drawSnow(ctx, b, top, l, T, alphaFn) {
    const s = l.sc / RES;
    const period = l.size * l.sc; // world px per tile repeat
    let ox = cam.x * (1 - l.par) + Math.sin(T * 0.07 + l.ph) * l.sway;
    let oy = cam.y * (1 - l.par) + T * l.sink;
    ox %= period;
    oy %= period;
    mtx.a = s;
    mtx.b = 0;
    mtx.c = 0;
    mtx.d = s;
    mtx.e = ox;
    mtx.f = oy;
    l.pat.setTransform(mtx);
    ctx.fillStyle = l.pat;
    // horizontal bands, each with the alpha of its depth (density / light change with depth)
    const H = b.bottom - top;
    const n = clamp(Math.ceil(H / 160), 1, 14);
    const bh = H / n;
    for (let i = 0; i < n; i++) {
      const y0 = top + i * bh;
      const a = alphaFn(y0 + bh * 0.5);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(b.left - 2, y0, b.w + 4, bh);
    }
    ctx.globalAlpha = 1;
  }

  return { update, render };
}
