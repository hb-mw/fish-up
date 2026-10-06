// Birds: gulls gliding and wheeling by day (more over the island side, camera x < 3000) and a V-formation
// crossing at dusk. None at night or in storms. Each bird is a couple of stroked curves per frame
// (cheap; at most ~16 birds on screen), with wing beats, glides and banking turns.
import { createRng } from '../../core/rng.js';
import { css, sstep, mod } from './util.js';

const PAR = 0.55; // gulls are much closer than the horizon: strong parallax
const SPAN = 4200;

export function createBirds(game) {
  const env = game.env;
  const rng = createRng(8080);
  const gulls = [];
  for (let i = 0; i < 9; i++) {
    gulls.push({
      cx: rng.range(0, SPAN), alt: rng.range(110, 330), r: rng.range(50, 160), ang: rng.range(0, 6.28),
      av: rng.range(0.16, 0.32) * (rng.chance(0.5) ? 1 : -1), drift: rng.range(-14, 14), size: rng.range(0.8, 1.25),
      ph: rng.range(0, 6.28), flap: 0, flapT: rng.range(0, 4), rank: i,
    });
  }
  const vee = { active: false, x: 0, alt: 0, dir: 1, t: 0, timer: 8, n: 7, ph: 0 };

  function update(dt) {
    for (const g of gulls) {
      g.ang += g.av * dt;
      g.cx += g.drift * dt;
      // bursts of flapping between long glides
      g.flapT -= dt;
      if (g.flapT <= 0) {
        g.flap = g.flap > 0 ? 0 : 1;
        g.flapT = g.flap ? rng.range(0.8, 1.8) : rng.range(2.5, 6);
      }
      g.ph += dt * (g.flap ? 9 : 0.8);
    }
    // dusk: a V-formation now and then
    const dusk = env.goldenHour > 0.35 && env.hour > 15 && env.weather.rain < 0.2;
    if (vee.active) {
      vee.t += dt;
      vee.x += vee.dir * 62 * dt;
      vee.ph += dt * 6.5;
      if (vee.t > 60) vee.active = false;
    } else if (dusk) {
      vee.timer -= dt;
      if (vee.timer <= 0) {
        vee.timer = rng.range(35, 70);
        vee.active = true;
        vee.t = 0;
        vee.dir = rng.chance(0.5) ? 1 : -1;
        vee.x = vee.dir > 0 ? -160 : game.view.w + 160;
        vee.alt = rng.range(230, 330);
        vee.n = rng.int(5, 9);
      }
    }
  }

  /** One bird: M-shaped wings, s = half wingspan (px), beat = −1..1 wing position, bank = roll. */
  function bird(ctx, x, y, s, beat, bank) {
    const lift = beat * s * 0.55;
    const l = s * (1 - 0.18 * bank), r = s * (1 + 0.18 * bank);
    ctx.moveTo(x - l, y - lift * 0.9 + s * 0.12);
    ctx.quadraticCurveTo(x - l * 0.45, y - lift * 0.45 - s * 0.32, x, y);
    ctx.quadraticCurveTo(x + r * 0.45, y - lift * 0.45 - s * 0.32, x + r, y - lift * 0.9 + s * 0.12);
  }

  function draw(ctx, F) {
    const w = env.weather;
    const vis = sstep(0.25, 0.6, env.daylight) * (1 - sstep(0.25, 0.7, w.rain)) * (1 - 0.8 * w.fog);
    if (vis < 0.02) return;
    const a = env.palette.ambient;
    const amb = (c) => [c[0] * a[0] / 255, c[1] * a[1] / 255, c[2] * a[2] / 255];
    // gulls: more of them over the island side
    const nVis = Math.round(2 + 7 * (1 - sstep(2400, 5200, F.camX)));
    const t = game.time.now;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const body = css(amb([236, 238, 240]));
    const tips = css(amb([58, 62, 70]));
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? body : tips;
      ctx.beginPath();
      for (const g of gulls) {
        if (g.rank >= nVis) continue;
        const span = F.W + 400;
        const wx = g.cx + Math.cos(g.ang) * g.r * 1.6 - PAR * F.camX;
        const x = mod(wx, Math.max(span, SPAN * 0.5)) - 200 + F.sx;
        if (x < -40 || x > F.W + 40) continue;
        const alt = g.alt + Math.sin(g.ang) * g.r * 0.35 + Math.sin(t * 0.7 + g.ph) * 4;
        const y = F.hy - alt * F.k;
        if (y < -30 || y > F.hy - 20) continue;
        const s = 8.5 * g.size * F.k * (0.85 + 0.25 * (alt / 330));
        const beat = g.flap ? Math.sin(g.ph) : 0.25 + 0.08 * Math.sin(g.ph);
        const bank = Math.sin(g.ang) * Math.sign(g.av);
        if (pass === 0) {
          ctx.lineWidth = Math.max(1.1, s * 0.2);
          bird(ctx, x, y, s, beat, bank);
        } else {
          // dark wing tips
          const lift = beat * s * 0.55;
          const l = s * (1 - 0.18 * bank), r = s * (1 + 0.18 * bank);
          ctx.lineWidth = Math.max(1, s * 0.16);
          ctx.moveTo(x - l, y - lift * 0.9 + s * 0.12);
          ctx.lineTo(x - l * 0.8, y - lift * 0.8 - s * 0.02);
          ctx.moveTo(x + r, y - lift * 0.9 + s * 0.12);
          ctx.lineTo(x + r * 0.8, y - lift * 0.8 - s * 0.02);
        }
      }
      ctx.globalAlpha = vis;
      ctx.stroke();
    }
    // the dusk V-formation: dark silhouettes
    if (vee.active) {
      const fade = sstep(0, 3, vee.t) * (1 - sstep(50, 60, vee.t));
      ctx.globalAlpha = vis * fade * 0.9;
      ctx.strokeStyle = css(amb([44, 36, 44]));
      ctx.beginPath();
      const s = 7.5 * F.k;
      ctx.lineWidth = Math.max(1.2, s * 0.24);
      for (let i = 0; i < vee.n; i++) {
        // chevron: the leader in front, two trailing arms (one a little longer)
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const x = vee.x - vee.dir * row * 24 * F.k + F.sx;
        const y = F.hy - vee.alt * F.k + side * row * 9 * F.k + Math.sin(vee.t * 0.8 + i) * 1.5;
        bird(ctx, x, y, s, Math.sin(vee.ph - row * 0.55), 0);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  return { update, draw };
}
