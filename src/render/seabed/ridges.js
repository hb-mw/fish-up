// Far parallax ridges: two hazy layers of distant seabed behind the main ground.
// Each layer is a terrain-like profile seen at a greater distance — drawn with a true perspective projection
// about the camera centre (screen offset × p), so it shrinks toward the view centre, slides slower than the
// camera, and towers overhead when the camera is deep in the trench. Coloured as a darker veil of the water
// colour at its own depth, with a faint lit crest.
import { heightAt } from '../../world/terrain.js';
import { clamp, smoothstep } from '../../core/math.js';
import { fbm1 } from '../../core/rng.js';
import { css } from './util.js';

const U0 = -5000, U1 = 17000, USTEP = 32;
const SMOOTH = new Float32Array(Math.ceil((U1 - U0) / USTEP) + 1);
for (let i = 0; i < SMOOTH.length; i++) {
  const u = U0 + i * USTEP;
  let s = 0, n = 0;
  for (let k = -8; k <= 8; k++) {
    const w = 1 - Math.abs(k) / 9;
    s += heightAt(u + k * 40) * w;
    n += w;
  }
  SMOOTH[i] = s / n;
}
function smoothH(u) {
  const f = clamp((u - U0) / USTEP, 0, SMOOTH.length - 1.001);
  const i = Math.floor(f);
  return SMOOTH[i] + (SMOOTH[i + 1] - SMOOTH[i]) * (f - i);
}

export const LAYERS = [
  // far: big soft hills, strong haze
  { p: 0.45, lift: 150, amp: 240, freq: 0.0011, seed: 31, shade: 0.16, rim: 0.1, detail: 22 },
  // mid: closer, more relief, less haze
  { p: 0.68, lift: 70, amp: 150, freq: 0.0019, seed: 57, shade: 0.27, rim: 0.14, detail: 30 },
];

/** Layer-space depth of a ridge at layer coordinate u. */
export function ridgeV(L, u) {
  let v = smoothH(u) - L.lift + L.amp * (fbm1(u * L.freq, 3, L.seed) - 0.5) * 2 + L.detail * (fbm1(u * 0.006, 2, L.seed + 9) - 0.5) * 2;
  // never near the island shore or the surface
  const shore = 1 - smoothstep(600, 1500, u);
  v = Math.max(v, 150 + 260 * shore);
  return v;
}

export function createRidges(game) {
  const xs = new Float32Array(260), ys = new Float32Array(260);
  const colA = [0, 0, 0];

  function drawLayer(ctx, L, cam, b) {
    const cx = cam.x, cy = cam.y;
    const n = Math.min(xs.length - 1, Math.ceil(b.w / Math.max(10, b.w / 200)));
    let minY = Infinity;
    for (let i = 0; i <= n; i++) {
      const xd = b.left - 20 + ((b.w + 40) * i) / n;
      const u = cx + (xd - cx) / L.p;
      const yd = cy + (ridgeV(L, u) - cy) * L.p;
      xs[i] = xd;
      ys[i] = yd;
      if (yd < minY) minY = yd;
    }
    if (minY > b.bottom) return;
    const top = Math.max(minY, b.top - 10);
    const bottom = b.bottom + 10;
    const xm = cx;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    const env = game.env;
    const steps = 5;
    for (let k = 0; k <= steps; k++) {
      const y = top + ((bottom - top) * k) / steps;
      const w = env.waterColorAt(y, xm);
      // the silhouette is a little darker (and a touch cooler) than the water around it, darkening downward
      const s = L.shade + 0.1 * (k / steps);
      colA[0] = w[0] * (1 - s * 1.1);
      colA[1] = w[1] * (1 - s);
      colA[2] = w[2] * (1 - s * 0.8);
      g.addColorStop(k / steps, css(colA));
    }
    ctx.beginPath();
    ctx.moveTo(xs[0], bottom);
    for (let i = 0; i <= n; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(xs[n], bottom);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    // faint lit crest
    const wc = env.waterColorAt(Math.max(0, top), xm);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) ctx.lineTo(xs[i], ys[i] + 1.5);
    ctx.lineWidth = 3 / Math.max(0.5, cam.zoom);
    ctx.strokeStyle = css([Math.min(255, wc[0] * 1.25 + 8), Math.min(255, wc[1] * 1.22 + 8), Math.min(255, wc[2] * 1.15 + 8)], L.rim * (0.4 + 0.6 * env.lightAt(top)));
    ctx.stroke();
  }

  return {
    /** Draw both layers (WORLD space). Clipped to below the sea surface. */
    render(ctx) {
      const cam = game.camera, b = cam.bounds;
      if (b.bottom < 30) return;
      ctx.save();
      // clip below the moving surface so a ridge can never poke into the sky
      if (b.top < 40) {
        const waves = game.world.waves;
        ctx.beginPath();
        ctx.moveTo(b.left - 30, b.bottom + 30);
        for (let x = b.left - 30; x <= b.right + 30; x += 24) ctx.lineTo(x, waves.heightAt(x) + 16);
        ctx.lineTo(b.right + 30, b.bottom + 30);
        ctx.closePath();
        ctx.clip();
      }
      for (const L of LAYERS) drawLayer(ctx, L, cam, b);
      ctx.restore();
    },
  };
}
