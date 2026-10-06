// Sun (radiant disc, layered bloom, faint rays — big, red and squashed on the horizon) and the moon
// (phase-correct sphere lighting, maria, earthshine, halo). Disc/halo gradients are built around the origin
// and placed with translate(), so they are rebuilt only when their colour changes.
import { createRng } from '../../core/rng.js';
import { makeCanvas, css, mix, colorDelta, copy3, sstep, createNoiseTex, noiseAt } from './util.js';

const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];
const MOON_WHITE = [226, 233, 255];

export function createSunMoon(game) {
  const env = game.env;

  // ── sun ──────────────────────────────────────────────────────────────────
  const sunG = { disc: null, corona: null, bloom: null, key: [-1, -1, -1], gkey: [-1, -1, -1] };
  const rays = makeRays();
  const raysTint = { canvas: makeCanvas(rays.width, rays.height), key: [-1, -1, -1] };

  function makeRays() {
    // soft radial streaks (white mask), baked once
    const S = 256;
    const c = makeCanvas(S, S), g = c.getContext('2d');
    const rng = createRng(4242);
    g.translate(S / 2, S / 2);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng.range(-0.08, 0.08);
      const len = S * 0.5 * rng.range(0.55, 1);
      const w = rng.range(0.025, 0.075);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, len);
      const al = rng.range(0.35, 1);
      grd.addColorStop(0, `rgba(255,255,255,${0.7 * al})`);
      grd.addColorStop(0.2, `rgba(255,255,255,${0.3 * al})`);
      grd.addColorStop(0.55, `rgba(255,255,255,${0.08 * al})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, len, a - w, a + w);
      g.closePath();
      g.fill();
    }
    return c;
  }
  function tintedRays(col) {
    if (colorDelta(raysTint.key, col) > 3) {
      copy3(raysTint.key, col);
      const g = raysTint.canvas.getContext('2d');
      g.globalCompositeOperation = 'copy';
      g.drawImage(rays, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = css(col);
      g.fillRect(0, 0, rays.width, rays.height);
      g.globalCompositeOperation = 'source-over';
    }
    return raysTint.canvas;
  }

  function sunGradients(ctx, sun, glow) {
    if (colorDelta(sunG.key, sun) > 1.5 || !sunG.disc) {
      copy3(sunG.key, sun);
      const hot = mix(sun, WHITE, 0.82);
      const d = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      d.addColorStop(0, css(hot));
      d.addColorStop(0.55, css(mix(sun, WHITE, 0.6)));
      d.addColorStop(0.86, css(mix(sun, WHITE, 0.3)));
      d.addColorStop(0.95, css(sun));
      d.addColorStop(1, css(sun, 0));
      sunG.disc = d;
      const c = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const cc = mix(sun, WHITE, 0.35);
      c.addColorStop(0, css(cc, 0.9));
      c.addColorStop(0.22, css(cc, 0.45));
      c.addColorStop(0.5, css(cc, 0.12));
      c.addColorStop(1, css(cc, 0));
      sunG.corona = c;
    }
    if (colorDelta(sunG.gkey, glow) > 1.5 || !sunG.bloom) {
      copy3(sunG.gkey, glow);
      const b = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      b.addColorStop(0, css(glow, 0.4));
      b.addColorStop(0.2, css(glow, 0.17));
      b.addColorStop(0.5, css(glow, 0.06));
      b.addColorStop(1, css(glow, 0));
      sunG.bloom = b;
    }
  }

  /** How much of the sun gets through the cloud deck: [disc, glow]. */
  function sunVeil() {
    const c = env.weather.cloud;
    return [1 - sstep(0.52, 0.9, c), 1 - 0.88 * sstep(0.5, 1, c)];
  }

  function sunRadius(F) {
    const e = env.sun.elev;
    return (31 + 15 * (1 - sstep(0.0, 0.4, e))) * F.k;
  }

  /** Disc + corona + rays (behind the clouds). */
  function drawSun(ctx, F) {
    const sun = env.sun;
    if (sun.elev < -0.2) return;
    const [discA, glowA] = sunVeil();
    if (glowA < 0.01) return;
    const p = env.palette;
    sunGradients(ctx, p.sun, p.sunGlow);
    const R = sunRadius(F);
    const squash = 1 - 0.2 * (1 - sstep(-0.06, 0.14, sun.elev));
    const x = F.sunX, y = F.sunY;
    ctx.save();
    ctx.translate(x, y);
    // wide bloom
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowA * (0.75 + 0.25 * env.goldenHour);
    ctx.save();
    ctx.scale(R * 11, R * 11 * (0.85 + 0.15 * squash));
    ctx.fillStyle = sunG.bloom;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    // rays — very faint, slowly turning
    const rayA = 0.05 * glowA * (0.55 + 0.45 * env.daylight) * (1 - env.weather.fog);
    if (rayA > 0.004) {
      const tex = tintedRays(mix(p.sun, WHITE, 0.4));
      const t = game.time.now;
      const rr = R * 7.5;
      ctx.save();
      ctx.globalAlpha = rayA;
      ctx.rotate(t * 0.012);
      ctx.drawImage(tex, -rr, -rr, rr * 2, rr * 2);
      ctx.rotate(-t * 0.012 * 2.6);
      ctx.globalAlpha = rayA * 0.7;
      ctx.drawImage(tex, -rr * 0.8, -rr * 0.8, rr * 1.6, rr * 1.6);
      ctx.restore();
    }
    // disc first, then the additive corona over it: the disc stays the brightest thing in the sky
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = discA;
    ctx.save();
    ctx.scale(R, R * squash);
    ctx.fillStyle = sunG.disc;
    ctx.beginPath();
    ctx.arc(0, 0, 1.02, 0, TAU);
    ctx.fill();
    ctx.restore();
    // screen (not add): a bright corona that never clips into a flat white blob on a pale sky
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glowA * 0.8;
    ctx.scale(R * 2.6, R * 2.6 * squash);
    ctx.fillStyle = sunG.corona;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  /** A soft glare over the clouds right around the sun (drawn after them). */
  function drawSunBloom(ctx, F) {
    const sun = env.sun;
    if (sun.elev < -0.15) return;
    const [discA, glowA] = sunVeil();
    const a = glowA * (0.22 + 0.2 * discA) * sstep(-0.15, 0.02, sun.elev);
    if (a < 0.01 || !sunG.corona) return;
    const R = sunRadius(F);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.translate(F.sunX, F.sunY);
    ctx.scale(R * 3.6, R * 3.6);
    ctx.fillStyle = sunG.corona;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  // ── moon ─────────────────────────────────────────────────────────────────
  const moonTex = createNoiseTex(9091, 64, 5, 4, 0.55);
  const moon = { canvas: null, key: '', glow: null, gkey: [-1, -1, -1] };
  // maria (unit-disc coords, radius, darkness) — loosely after the real near side
  const MARIA = [
    [-0.36, -0.3, 0.3, 0.55], [-0.05, -0.42, 0.2, 0.45], [0.22, -0.22, 0.2, 0.5], [0.3, 0.05, 0.22, 0.55],
    [-0.15, 0.05, 0.16, 0.35], [-0.55, 0.1, 0.26, 0.5], [-0.4, 0.38, 0.2, 0.3], [0.48, -0.42, 0.12, 0.4],
    [0.12, 0.25, 0.12, 0.3],
  ];

  function moonColor() {
    const p = env.palette;
    const c = mix(p.sun, MOON_WHITE, env.night);
    // rising/setting moon is warmer
    const low = 1 - sstep(0.02, 0.25, env.moon.elev);
    return mix(c, [255, 214, 168], low * 0.55);
  }

  function bakeMoon(Rdev, phase, col) {
    const S = Math.ceil(Rdev * 2 + 4);
    const c = moon.canvas && moon.canvas.width === S ? moon.canvas : makeCanvas(S, S);
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const d = img.data;
    const cx = S / 2, cy = S / 2;
    const ang = phase * TAU; // 0 new, π full
    const lx = Math.sin(ang), lz = -Math.cos(ang);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x + 0.5 - cx) / Rdev, v = (y + 0.5 - cy) / Rdev;
        const r2 = u * u + v * v;
        if (r2 > 1.08) continue;
        const r = Math.sqrt(r2);
        const edge = Math.min(1, Math.max(0, (1 - r) * Rdev + 0.5)); // 1-px antialiased limb
        if (edge <= 0) continue;
        const z = Math.sqrt(Math.max(0, 1 - r2));
        // albedo: highlands bright, maria darker, fine mottling
        let alb = 0.9;
        for (let m = 0; m < MARIA.length; m++) {
          const M = MARIA[m];
          const du = u - M[0], dv = v - M[1];
          const q = (du * du + dv * dv) / (M[2] * M[2]);
          if (q < 1) alb -= M[3] * 0.42 * (1 - q) * (1 - q) * (0.7 + 0.6 * noiseAt(moonTex, (u + 2) * 18, (v + 2) * 18));
        }
        alb += (noiseAt(moonTex, (u + 1) * 30, (v + 1) * 30) - 0.5) * 0.16;
        // a bright young crater with faint rays (Tycho-ish)
        const tu = u - 0.08, tv = v - 0.66;
        const td = Math.sqrt(tu * tu + tv * tv);
        alb += 0.22 * Math.max(0, 1 - td / 0.06) + 0.05 * Math.max(0, 1 - td / 0.5) * (0.5 + 0.5 * Math.cos(Math.atan2(tv, tu) * 9));
        // sphere lighting with the phase terminator
        const ndl = u * lx + z * lz;
        const lit = sstep(-0.06, 0.14, ndl);
        const shade = 0.78 + 0.22 * Math.max(0, ndl); // mild — the moon barely darkens toward the limb
        const earthshine = 0.07;
        const b = Math.max(0, alb) * (earthshine + (1 - earthshine) * lit * shade);
        const i = (y * S + x) * 4;
        d[i] = Math.min(255, col[0] * b * 1.04);
        d[i + 1] = Math.min(255, col[1] * b * 1.02);
        d[i + 2] = Math.min(255, col[2] * b);
        d[i + 3] = 255 * edge * (0.42 + 0.58 * lit); // the earthshine side stays faint and lets the glow through
      }
    }
    g.putImageData(img, 0, 0);
    moon.canvas = c;
  }

  function drawMoon(ctx, F) {
    const m = env.moon;
    if (m.elev < -0.12) return;
    const cloud = env.weather.cloud;
    const vis = sstep(-0.12, 0.04, m.elev) * (1 - env.daylight * 0.9) * (1 - sstep(0.5, 0.9, cloud)) * (1 - env.weather.fog * 0.7);
    if (vis < 0.01) return;
    const col = moonColor();
    const R = 23 * F.k * (1 + 0.15 * (1 - sstep(0.02, 0.3, m.elev)));
    const Rdev = Math.max(6, Math.round(R * game.view.scale));
    const key = `${Rdev}|${m.phase.toFixed(3)}|${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
    if (moon.key !== key) {
      // colour drifts slowly; only rebake on a visible change
      const parts = moon.key.split('|');
      const old = parts[2] ? parts[2].split(',').map(Number) : null;
      if (!old || parts[0] !== String(Rdev) || parts[1] !== m.phase.toFixed(3) || colorDelta(old, col) > 3) {
        bakeMoon(Rdev, m.phase, col);
        moon.key = key;
      }
    }
    const x = F.moonX, y = F.moonY;
    // halo
    const gc = mix(col, MOON_WHITE, 0.5);
    if (!moon.glow || colorDelta(moon.gkey, gc) > 3) {
      copy3(moon.gkey, gc);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, css(gc, 0.5));
      g.addColorStop(0.08, css(gc, 0.3));
      g.addColorStop(0.22, css(gc, 0.1));
      g.addColorStop(0.5, css(gc, 0.03));
      g.addColorStop(1, css(gc, 0));
      moon.glow = g;
    }
    const full = 0.35 + 0.65 * (1 - Math.abs(m.phase - 0.5) * 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = vis;
    const S = moon.canvas.width / game.view.scale;
    ctx.drawImage(moon.canvas, -S / 2, -S / 2, S, S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = vis * full * (0.8 + 0.4 * env.weather.fog) * (1 - env.daylight * 0.6);
    const hr = R * 9;
    ctx.scale(hr, hr);
    ctx.fillStyle = moon.glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  return { drawSun, drawSunBloom, drawMoon, sunRadius };
}
