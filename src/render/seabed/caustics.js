// Animated caustic light net on the shallow ground. A looping, tileable caustic texture (Worley F2−F1 with
// feature points circling in time) is generated one frame per update tick, then laid additively over the top
// band of the ground, world-anchored, cross-faded between frames, fading with depth and with the sunlight.
import { heightAt } from '../../world/terrain.js';
import { smoothstep } from '../../core/math.js';
import { hash2 } from '../../core/rng.js';
import { makeCanvas } from './util.js';

const N = 128; // texture px
const CELLS = 4; // cells per side (periodic)
const FRAMES = 16;
const WORLD_SCALE = 1.25; // world px per texture px
const BAND = 86; // how far into the ground the light reaches (px)

function genFrame(fi) {
  const c = makeCanvas(N, N), g = c.getContext('2d');
  const img = g.createImageData(N, N), d = img.data;
  const cs = N / CELLS;
  const T = (fi / FRAMES) * Math.PI * 2;
  const px = new Float32Array(CELLS * CELLS), py = new Float32Array(CELLS * CELLS);
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const k = j * CELLS + i;
      const h1 = hash2(i, j), h2 = hash2(i + 17, j + 5), h3 = hash2(i + 3, j + 31);
      const r = 0.22 * cs;
      px[k] = (i + 0.2 + 0.6 * h1) * cs + Math.cos(T + h3 * 6.283) * r;
      py[k] = (j + 0.2 + 0.6 * h2) * cs + Math.sin(T * (h3 > 0.5 ? 1 : -1) + h1 * 6.283) * r;
    }
  }
  for (let y = 0; y < N; y++) {
    const cj = Math.floor(y / cs);
    for (let x = 0; x < N; x++) {
      const ci = Math.floor(x / cs);
      let f1 = 1e9, f2 = 1e9;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + CELLS) % CELLS, jj = (cj + dj + CELLS) % CELLS;
          const k = jj * CELLS + ii;
          const fx = px[k] + (ci + di - ii) * cs, fy = py[k] + (cj + dj - jj) * cs;
          const dd = (fx - x) * (fx - x) + (fy - y) * (fy - y);
          if (dd < f1) {
            f2 = f1;
            f1 = dd;
          } else if (dd < f2) f2 = dd;
        }
      }
      const e = Math.sqrt(f2) - Math.sqrt(f1); // distance to the cell border
      const v = Math.max(0, 1 - e / 3.2);
      // brightness varies along the net (focused bright knots, faint stretches) + a soft glow inside cells
      const vary = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(x * 0.11 + y * 0.07 + T + Math.sin(y * 0.09 - T) * 2), 2);
      const a = Math.min(1, v * v * (3 - 2 * v) * vary + 0.05 * Math.max(0, 1 - e / 14));
      const i4 = (y * N + x) * 4;
      d[i4] = 210;
      d[i4 + 1] = 255;
      d[i4 + 2] = 246;
      d[i4 + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createCaustics(game) {
  const frames = [];
  const pats = [];
  let pm = null;
  return {
    /** generate one more frame per tick until the loop is complete */
    update() {
      if (frames.length < FRAMES && game.camera.bounds.left < 5200) frames.push(genFrame(frames.length));
    },
    render(ctx, t) {
      if (frames.length < FRAMES) return;
      const b = game.camera.bounds, env = game.env;
      if (b.left > 5200) return;
      const sun = env.surfaceLight * (1 - 0.55 * env.weather.cloud) * (0.35 + 0.65 * env.daylight);
      if (sun < 0.05) return;
      if (!pm) {
        pm = new DOMMatrix([WORLD_SCALE, 0, 0, WORLD_SCALE, 0, 0]);
        for (let i = 0; i < FRAMES; i++) {
          pats[i] = ctx.createPattern(frames[i], 'repeat');
          pats[i].setTransform(pm);
        }
      }
      const step = 8;
      const x0 = Math.max(b.left - 20, 0), x1 = Math.min(b.right + 20, 5200);
      if (x1 <= x0) return;
      const ft = (t * 7) % FRAMES;
      const fa = Math.floor(ft), fb = (fa + 1) % FRAMES, fk = ft - fa;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // two depth bands: the lit lip takes most of the light, a weaker fringe below it
      for (const [o0, o1, bandK] of [[-1, 30, 1], [30, BAND, 0.3]]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, heightAt(x0) + o0);
        for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, heightAt(x) + o0);
        for (let x = x1 + step; x >= x0 - step; x -= step) ctx.lineTo(x, heightAt(x) + o1);
        ctx.closePath();
        ctx.clip();
        for (let sx = x0; sx < x1; sx += 160) {
          const y = heightAt(sx + 80);
          const k = (1 - smoothstep(140, 1050, y)) * sun * 0.42 * bandK;
          if (k < 0.01) continue;
          const top = Math.min(heightAt(sx), y, heightAt(sx + 160)) + o0 - 30;
          ctx.globalAlpha = k * (1 - fk);
          ctx.fillStyle = pats[fa];
          ctx.fillRect(sx, top, 161, o1 - o0 + 70);
          ctx.globalAlpha = k * fk;
          ctx.fillStyle = pats[fb];
          ctx.fillRect(sx, top, 161, o1 - o0 + 70);
        }
        ctx.restore();
      }
      ctx.restore();
    },
  };
}
