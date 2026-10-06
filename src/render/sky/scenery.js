// Far horizon scenery: hazy distant islands and a volcanic peak (left / home side only — the open ocean on the
// right keeps a clean horizon for sunsets), a tiny lighthouse whose beam sweeps at night, and a far sailing ship.
// Silhouettes are cached Path2D (built once); colour comes from palette.haze / ambient every frame.
import { createRng, fbm1 } from '../../core/rng.js';
import { css, mix, sstep, mod, colorDelta } from './util.js';

const DARK = [64, 86, 104]; // cool blue-grey of land seen through a lot of air

/** Ridge silhouette as a Path2D in local px (x 0..w, y ≤ 0 up from the horizon). */
function ridgePath(w, h, seed, o = {}) {
  const p = new Path2D();
  const step = 3;
  p.moveTo(0, 2);
  for (let x = 0; x <= w; x += step) {
    const u = x / w;
    let y = Math.pow(Math.sin(Math.PI * u), o.pow || 1.2);
    if (o.peak !== undefined) y = Math.max(y * 0.55, Math.pow(Math.max(0, 1 - Math.abs(u - o.peak) / (o.peakW || 0.3)), 1.5));
    y += (fbm1(x * 0.011 + seed, 4, seed) - 0.5) * (o.rough || 0.35) * Math.sin(Math.PI * u);
    if (o.trees) y += (fbm1(x * 0.16 + seed * 3, 2, seed + 9) - 0.5) * o.trees * Math.min(1, Math.sin(Math.PI * u) * 4);
    p.lineTo(x, -Math.max(0, y) * h);
  }
  p.lineTo(w, 2);
  p.closePath();
  return p;
}

export function createScenery(game) {
  const env = game.env;
  const rng = createRng(5511);
  // layer-space x (px at the leftmost camera); depth 0 = farthest
  const islands = [
    { x: -120, w: 620, h: 92, depth: 0.22, par: 0.05, path: null, o: { peak: 0.42, peakW: 0.34, rough: 0.25, pow: 1.6 } },
    { x: 380, w: 330, h: 40, depth: 0.32, par: 0.07, path: null, o: { pow: 1.0, rough: 0.5 } },
    { x: -260, w: 440, h: 44, depth: 0.46, par: 0.1, path: null, o: { pow: 0.8, rough: 0.45, trees: 0.12 } },
    { x: 640, w: 300, h: 30, depth: 0.5, par: 0.12, path: null, o: { pow: 0.7, rough: 0.5, trees: 0.16 } },
    { x: 1020, w: 120, h: 15, depth: 0.62, par: 0.16, path: null, o: { pow: 0.6, rough: 0.6 }, lighthouse: 0.62 },
  ];
  for (const is of islands) is.path = ridgePath(is.w, is.h, rng.range(1, 99), is.o);
  const ship = { u: rng.range(0, 1), speed: 5.5, par: 0.11 };
  // unit-space lamp glow and beam (positioned with transforms; intensity via globalAlpha)
  const g0 = game.ctx;
  const LAMP = g0.createRadialGradient(0, 0, 0, 0, 0, 1);
  LAMP.addColorStop(0, 'rgba(255,236,190,0.9)');
  LAMP.addColorStop(0.25, 'rgba(255,210,140,0.3)');
  LAMP.addColorStop(1, 'rgba(255,200,120,0)');
  const BEAM = g0.createLinearGradient(0, 0, 1, 0);
  BEAM.addColorStop(0, 'rgba(255,230,180,1)');
  BEAM.addColorStop(1, 'rgba(255,230,180,0)');
  const tmp = [0, 0, 0];

  function landColor(depth) {
    const p = env.palette, a = p.ambient;
    const amb = [a[0] / 255, a[1] / 255, a[2] / 255];
    const far = mix(p.haze, p.skyHorizon, 0.35);
    const c = mix(far, [DARK[0] * amb[0], DARK[1] * amb[1], DARK[2] * amb[2]], depth);
    tmp[0] = c[0]; tmp[1] = c[1]; tmp[2] = c[2];
    return tmp;
  }

  function screenX(x, par, F) {
    return x - par * (F.camX - 960) + F.sx;
  }

  function drawLighthouse(ctx, x, y, k, F) {
    const s = k * 0.95;
    const a = env.palette.ambient;
    const wall = css([235 * a[0] / 255, 232 * a[1] / 255, 226 * a[2] / 255]);
    const band = css([190 * a[0] / 255, 60 * a[1] / 255, 52 * a[2] / 255]);
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(x - 2.6 * s, y);
    ctx.lineTo(x - 1.6 * s, y - 20 * s);
    ctx.lineTo(x + 1.6 * s, y - 20 * s);
    ctx.lineTo(x + 2.6 * s, y);
    ctx.fill();
    ctx.fillStyle = band;
    ctx.fillRect(x - 2.3 * s, y - 7 * s, 4.6 * s, 2.6 * s);
    ctx.fillRect(x - 1.9 * s, y - 14 * s, 3.8 * s, 2.4 * s);
    ctx.fillStyle = css([40 * a[0] / 255, 44 * a[1] / 255, 50 * a[2] / 255]);
    ctx.fillRect(x - 2.2 * s, y - 21 * s, 4.4 * s, 1.2 * s);
    ctx.fillRect(x - 1.3 * s, y - 25 * s, 2.6 * s, 4 * s);
    // lamp + beam at night
    const night = sstep(0.15, 0.6, 1 - env.daylight);
    if (night <= 0.01) return;
    const t = game.time.now;
    const th = t * 1.15;
    const facing = Math.cos(th); // 1 = toward us
    const side = Math.sin(th);
    const ly = y - 23 * s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flash = Math.pow(Math.max(0, facing), 6);
    const gr = (10 + 34 * flash) * s;
    ctx.save();
    ctx.translate(x, ly);
    ctx.scale(gr, gr);
    ctx.globalAlpha = night * (0.75 + 0.25 * flash);
    ctx.fillStyle = LAMP;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    // the beam: a long faint wedge swinging across, shortest when it points at (or away from) us
    const len = 260 * s * Math.abs(side);
    if (len > 8) {
      const dir = side > 0 ? 1 : -1;
      ctx.save();
      ctx.translate(x, ly);
      ctx.scale(dir * len, s);
      ctx.globalAlpha = 0.22 * night * (0.35 + 0.65 * Math.max(0, facing + 0.3));
      ctx.fillStyle = BEAM;
      ctx.beginPath();
      ctx.moveTo(0, -1.2);
      ctx.lineTo(1, -9);
      ctx.lineTo(1, 7);
      ctx.lineTo(0, 1.2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawShip(ctx, F, vis) {
    const span = F.W + 400;
    const x = mod(ship.u * span + game.time.now * ship.speed * (env.weather.wind < 0 ? -1 : 1) - ship.par * (F.camX - 960), span) - 200 + F.sx;
    if (x < -40 || x > F.W + 40) return;
    const k = F.k;
    const y = F.hy + 0.5;
    const a = env.palette.ambient;
    const amb = (c) => css([c[0] * a[0] / 255, c[1] * a[1] / 255, c[2] * a[2] / 255]);
    ctx.globalAlpha = vis * 0.85;
    ctx.fillStyle = amb([60, 52, 50]);
    ctx.beginPath();
    ctx.moveTo(x - 9 * k, y - 3 * k);
    ctx.lineTo(x + 10 * k, y - 3 * k);
    ctx.lineTo(x + 7 * k, y);
    ctx.lineTo(x - 7 * k, y);
    ctx.fill();
    ctx.fillStyle = amb([238, 232, 220]);
    ctx.beginPath();
    ctx.moveTo(x - 1 * k, y - 4 * k);
    ctx.lineTo(x - 1 * k, y - 19 * k);
    ctx.lineTo(x - 8 * k, y - 4 * k);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 1 * k, y - 4 * k);
    ctx.lineTo(x + 1 * k, y - 15 * k);
    ctx.lineTo(x + 7 * k, y - 4 * k);
    ctx.fill();
    const night = 1 - env.daylight;
    if (night > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,220,160,${(0.8 * night * vis).toFixed(3)})`;
      ctx.fillRect(x - 0.8 * k, y - 21 * k, 1.6 * k, 1.6 * k);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function draw(ctx, F) {
    const w = env.weather;
    const vis = (1 - sstep(0.1, 0.8, w.fog)) * (1 - 0.75 * sstep(0.2, 1, w.rain));
    if (vis < 0.01) return;
    ctx.save();
    ctx.globalAlpha = vis;
    const sunSide = env.sun.x > 0.5 ? 1 : -1;
    for (const is of islands) {
      const x = screenX(is.x, is.par, F);
      if (x > F.W || x + is.w * F.k < 0) continue;
      ctx.save();
      ctx.translate(x, F.hy + 1);
      ctx.scale(F.k, F.k);
      ctx.fillStyle = css(landColor(is.depth));
      ctx.fill(is.path);
      // the sun-facing slopes catch a little warm light
      const lit = env.daylight * (0.18 + 0.3 * env.goldenHour) * (1 - sstep(0.4, 1, w.cloud));
      if (lit > 0.01) {
        const sc = mix(env.palette.sunGlow, [255, 255, 255], 0.3);
        if (!is.grad || is.gSide !== sunSide || colorDelta(is.gCol, sc) > 2) {
          is.gSide = sunSide;
          is.gCol = sc;
          is.grad = ctx.createLinearGradient(sunSide > 0 ? is.w : 0, 0, sunSide > 0 ? is.w * 0.35 : is.w * 0.65, 0);
          is.grad.addColorStop(0, css(sc, 1));
          is.grad.addColorStop(1, css(sc, 0));
        }
        ctx.globalAlpha = vis * lit;
        ctx.fillStyle = is.grad;
        ctx.fill(is.path);
        ctx.globalAlpha = vis;
      }
      ctx.restore();
      if (is.lighthouse) drawLighthouse(ctx, x + is.w * is.lighthouse * F.k, F.hy - is.h * 0.82 * F.k, F.k, F);
    }
    drawShip(ctx, F, vis);
    ctx.restore();
  }

  return { draw };
}
