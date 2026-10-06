// WATER · god rays — soft shafts of sun (or moon) light fanning down from the surface.
// A handful of cached beam sprites (tinted on demand) drawn additively with per-ray transforms.
// Rays are world-anchored "slots" along x (they belong to the water), slanted away from the sun and fanned
// around its screen position, breathing in and out on slow noise.
import { clamp, clamp01, lerp, smoothstep, mixRgb } from '../../core/math.js';
import { hash1, noise1 } from '../../core/rng.js';
import { beam, blob, Tint } from './sprites.js';

export function createRays(game, core) {
  const cam = game.camera;
  const env = game.env;
  const VARIANTS = [
    beam(96, 384, 11, 0.42),
    beam(96, 384, 23, 0.55),
    beam(96, 384, 37, 0.34),
    beam(96, 384, 41, 0.48),
  ];
  const tints = VARIANTS.map((v) => new Tint(v));
  const poolTint = new Tint(blob(128));
  const col = [0, 0, 0];

  /** Ray density/shape by biome: reef = broad and bright, kelp = many narrow shafts through the canopy. */
  const SLOT = 100;
  const prm = { density: 1, width: 1, length: 1 };
  function slotParams(x) {
    const kelp = smoothstep(2900, 3400, x) * (1 - smoothstep(4800, 5300, x));
    const open = smoothstep(5200, 7000, x);
    prm.density = lerp(lerp(0.78, 0.5, open), 0.95, kelp);
    prm.width = lerp(1, 0.55, kelp);
    prm.length = lerp(1, 1.18, open);
    return prm;
  }

  /**
   * @param ctx    WORLD-space context, clipped below the surface
   * @param M      camera matrix
   */
  function render(ctx, M) {
    const b = cam.bounds;
    const L = core.light;
    const overcast = smoothstep(0.45, 1, L.cloud);
    const p = env.palette;
    // light source: sun by day, moon by night
    const sunK = p.rays * smoothstep(-0.08, 0.12, env.sun.elev);
    const moonK = 0.5 * core.moonVis * (1 - 0.85 * overcast);
    const useMoon = moonK > sunK;
    const strength = useMoon ? moonK : sunK;
    if (strength < 0.02) return;
    const maxLen = 980;
    if (b.top > maxLen) return;
    const srcX = useMoon ? env.moon.x : env.sun.x;
    const srcWX = useMoon ? core.moonWX : core.sunWX;
    const elev = clamp01(useMoon ? env.moon.elev : env.sun.elev);
    const base = -clamp((0.5 - srcX) * 1.15, -0.6, 0.6) * (1 - 0.35 * elev);
    if (useMoon) {
      col[0] = 150; col[1] = 180; col[2] = 235;
    } else {
      const warm = L.golden;
      const c = mixRgb(mixRgb(p.sunGlow, [205, 250, 255], 0.6), mixRgb(p.sunGlow, p.sun, 0.5), warm * 0.8);
      col[0] = c[0]; col[1] = c[1]; col[2] = c[2];
    }
    const T = game.time.now;
    const k = M.a;
    const zoomFix = 1;

    // 'screen' instead of 'lighter': light adds up gracefully on bright shallow water instead of clipping to neon
    ctx.globalCompositeOperation = 'screen';

    // diffuse pool of light in the upper water under the sun
    const poolA = strength * (useMoon ? 0.16 : 0.07) * (1 - 0.5 * overcast);
    if (poolA > 0.01 && b.top < 700) {
      ctx.globalAlpha = poolA;
      const pr = 1300;
      ctx.drawImage(poolTint.get(col), srcWX - pr * 0.75 + base * -250, -pr * 0.42, pr * 1.5, pr * 0.95);
    }

    // shafts: fixed world slots every SLOT px; a biome-dependent share of them carries a ray
    const k0 = Math.floor((b.left - 700) / SLOT), k1 = Math.ceil((b.right + 700) / SLOT);
    for (let kIdx = k0; kIdx <= k1; kIdx++) {
      const h1 = hash1(kIdx * 7 + 1), h2 = hash1(kIdx * 13 + 5), h3 = hash1(kIdx * 31 + 9), h4 = hash1(kIdx * 3 + 77);
      const x = kIdx * SLOT + (h1 - 0.5) * SLOT * 0.9;
      const prm = slotParams(x);
      if (hash1(kIdx * 101 + 3) > prm.density) continue;
      // breathing: rays come and go slowly
      const life = smoothstep(0.32, 0.78, noise1(T * 0.07 + kIdx * 3.71, 17));
      if (life < 0.02) continue;
      const shimmer = 0.85 + 0.15 * Math.sin(T * 1.9 + kIdx * 2.3) * Math.sin(T * 0.73 + kIdx);
      const a = strength * life * shimmer * lerp(0.16, 0.4, h2);
      const ox = x + Math.sin(T * 0.21 + kIdx * 1.3) * 14;
      const fan = clamp((ox - srcWX) * 0.00017, -0.2, 0.2);
      const ang = base - fan + Math.sin(T * 0.17 + kIdx * 2.1) * 0.025;
      const len = lerp(480, 900, h3) * prm.length;
      const wid = lerp(56, 240, h4 * h4) * prm.width * zoomFix;
      const oy = core.lineYAt(ox) - 6;
      // skip shafts that cannot reach the view
      const endX = ox - Math.sin(ang) * len;
      if (Math.max(ox, endX) + wid < b.left || Math.min(ox, endX) - wid > b.right) continue;
      if (oy + len < b.top) continue;
      const v = (kIdx & 3);
      const spr = tints[v].get(col);
      const c = Math.cos(ang), s = Math.sin(ang);
      // local (u right, v down along the beam) → world, then camera
      ctx.setTransform(k * c, k * s, -k * s, k * c, k * ox + M.e, k * oy + M.f);
      ctx.globalAlpha = clamp01(a);
      ctx.drawImage(spr, -wid * 0.5, 0, wid, len);
    }
    ctx.setTransform(M);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { render };
}
