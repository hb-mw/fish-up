// Rare sky events: a rainbow while the rain clears with the sun out (opposite the sun), and an aurora on
// some clear nights. Preview flags: &rainbow=1 · &aurora=1.
import { createRng, hash1 } from '../../core/rng.js';
import { makeCanvas, sstep, createNoiseTex, noiseAt } from './util.js';

const BOW = [
  // [t across the band 0 = inner edge … 1 = outer edge, r, g, b, a]
  [0.0, 120, 70, 200, 0], [0.12, 120, 80, 220, 0.5], [0.3, 60, 130, 255, 0.55], [0.48, 70, 210, 110, 0.6],
  [0.64, 250, 235, 90, 0.66], [0.8, 255, 150, 60, 0.62], [0.92, 235, 60, 50, 0.5], [1.0, 235, 60, 50, 0],
];

export function createExtras(game) {
  const env = game.env;
  const flags = game.flags || {};
  let wet = 0, bowA = 0, auroraA = 0, sunNow = 0, nightNow = 0;
  const forceBow = flags.rainbow === '1', forceAurora = flags.aurora === '1';
  let curtain = null;

  function makeCurtain() {
    const W = 512, H = 200;
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data;
    const tex = createNoiseTex(2323, 128, 4, 4, 0.55);
    const rng = createRng(77);
    const off = rng.range(0, 100);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const env2 = Math.pow(Math.sin(Math.PI * u), 0.8);
      const rays = noiseAt(tex, u * 128 * 3 + off, 3) * 0.6 + noiseAt(tex, u * 128 * 9, 40) * 0.4;
      const base = 0.62 + (noiseAt(tex, u * 128 * 1.5, 80) - 0.5) * 0.35; // wavy lower edge
      for (let y = 0; y < H; y++) {
        const v = y / H; // 0 top … 1 bottom
        const lower = sstep(base + 0.06, base - 0.02, v); // sharp-ish bright lower hem
        const upper = sstep(0.0, base - 0.05, v); // long fade upward
        const hem = Math.exp(-Math.pow((v - base + 0.01) / 0.03, 2)); // the bright lower hem of the curtain
        const a = env2 * (rays * lower * upper * (0.35 + 0.65 * Math.pow(upper, 2)) + hem * (0.45 + 0.55 * rays));
        const i = (y * W + x) * 4;
        const top = 1 - v / base;
        d[i] = 80 + 150 * Math.max(0, top - 0.45); // magenta-ish crowns
        d[i + 1] = 255 - 120 * Math.max(0, top - 0.3);
        d[i + 2] = 140 + 90 * top;
        d[i + 3] = 255 * Math.min(1, a * 1.3);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function update(dt) {
    const w = env.weather;
    wet = Math.max(w.rain, wet - dt / 45);
    const sunOut = sstep(0.35, 0.65, env.daylight) * (1 - sstep(0.62, 0.92, w.cloud)) * (1 - sstep(0.62, 0.8, env.sun.elev));
    sunNow = sunOut;
    let tb = sstep(0.12, 0.35, wet) * (1 - sstep(0.18, 0.5, w.rain)) * sunOut;
    if (forceBow) tb = Math.max(tb, sunOut > 0.05 ? 1 : 0);
    bowA += (tb - bowA) * Math.min(1, dt * 0.35);
    const night = sstep(0.6, 0.95, env.night) * (1 - sstep(0.2, 0.45, w.cloud)) * (1 - w.fog);
    nightNow = night;
    const lucky = hash1(env.day * 7919 + 13) < 0.28;
    const ta = night * (lucky || forceAurora ? 1 : 0);
    auroraA += (ta - auroraA) * Math.min(1, dt * 0.25);
    if (forceBow && bowA < tb) bowA = tb; // previews show it immediately
    if (forceAurora && auroraA < ta) auroraA = ta;
  }

  function drawRainbow(ctx, F) {
    const a = Math.min(bowA, sunNow); // never without sunlight, even right after a time jump
    if (a < 0.01) return;
    const sun = env.sun;
    const cx = (1 - sun.x) * F.W + F.sx;
    const R = Math.max(F.W * 0.3, 520) * F.k;
    const cy = F.hy + Math.max(0, F.sunAlt) * 0.45 * F.k + R * 0.05;
    const band = R * 0.075;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, F.W, F.hy);
    ctx.clip();
    for (const [rad, k, rev] of [[R, 1, false], [R * 1.24, 0.38, true]]) {
      const r0 = rad - band * (rev ? 1.3 : 1), r1 = rad + (rev ? band * 0.3 : 0);
      const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      for (const s of BOW) g.addColorStop(rev ? 1 - s[0] : s[0], `rgba(${s[1]},${s[2]},${s[3]},${s[4]})`);
      ctx.globalAlpha = a * 0.42 * k;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r1, Math.PI, Math.PI * 2);
      ctx.arc(cx, cy, r0, Math.PI * 2, Math.PI, true);
      ctx.fill();
    }
    // the sky inside the bow is a touch brighter
    const gi = ctx.createRadialGradient(cx, cy, 0, cx, cy, R - band);
    gi.addColorStop(0.7, 'rgba(255,255,255,0)');
    gi.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.globalAlpha = a;
    ctx.fillStyle = gi;
    ctx.beginPath();
    ctx.arc(cx, cy, R - band, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAurora(ctx, F) {
    const aa = Math.min(auroraA, nightNow);
    if (aa < 0.01) return;
    if (!curtain) curtain = makeCurtain();
    const t = game.time.real;
    const n = 80; // narrow slices: a smooth wavy hem instead of a staircase
    const w = F.W * 0.85, h = 300 * F.k;
    const x0 = F.W * 0.08 + F.sx;
    const yb = F.hy - 120 * F.k - h;
    const sw = curtain.width / n;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const wave = Math.sin(u * 7 + t * 0.35) * 22 + Math.sin(u * 17 - t * 0.6) * 8 - Math.sin(u * Math.PI) * 30;
      const pulse = 0.7 + 0.3 * Math.sin(u * 11 + t * 0.9);
      ctx.globalAlpha = aa * 0.45 * pulse;
      // exact widths: overlapping slices would double up under additive blending (bright seams)
      ctx.drawImage(curtain, i * sw, 0, sw, curtain.height, x0 + u * w, yb + wave * F.k, w / n, h);
    }
    ctx.restore();
  }

  return { update, drawRainbow, drawAurora };
}
