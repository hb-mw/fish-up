// The sky dome: base gradient (horizon → zenith), sun-side scattering at dawn/dusk, the anti-solar
// "belt of Venus" at twilight and the luminous haze band that sits on the horizon.
// All gradients are built around the horizon (local y = 0) and positioned with translate(), so they only
// need rebuilding when the colours change — never because the camera moved.
import { makeCanvas, css, mix, mixInto, colorDelta, sstep, unflash, copy3 } from './util.js';

const A_TOP = 900; // sky px from the horizon to the end of the gradient (deep zenith)
const MARGIN = 48; // filled below the horizon so no seam can ever show under the far-sea band
const STOPS = [-MARGIN, 0, 5, 14, 28, 48, 78, 120, 175, 240, 315, 400, 500, 640, 780, A_TOP];
const WHITE = [255, 255, 255];

export function createSkyGradient(game) {
  const env = game.env;
  let base = null;
  const baseKey = { top: [0, 0, 0], mid: [0, 0, 0], hor: [0, 0, 0], glow: [0, 0, 0], k: 0, gh: -1, night: -1 };
  let warm = null, warmKey = [-1, -1, -1];
  let hot = null, hotKey = [-1, -1, -1];
  let haze = null;
  const hazeKey = { c: [-1, -1, -1], a: -1 };
  const belt = { canvas: makeCanvas(128, 96), key: [-1, -1, -1, -1, -1, -1] };
  const tmpA = [0, 0, 0], tmpB = [0, 0, 0], tmpC = [0, 0, 0];

  /** Sky colour at altitude a (sky px above the horizon). */
  function skyAt(out, a, top, mid, hor, band, bandK) {
    const t = a / 420;
    mixInto(out, hor, mid, Math.pow(sstep(-0.02, 0.52, t), 0.85));
    mixInto(out, out, top, sstep(0.26, 1.05, t));
    if (a > 420) {
      const z = sstep(420, A_TOP, a) * 0.22;
      out[0] *= 1 - z;
      out[1] *= 1 - z;
      out[2] *= 1 - z * 0.6;
    }
    const b = bandK * Math.exp(-Math.max(0, a) / 26);
    if (b > 0.001) mixInto(out, out, band, b);
    return out;
  }

  function buildBase(ctx, F, top, mid, hor, glow) {
    const gh = env.goldenHour, night = env.night;
    // a pale luminous band right on the horizon: white by day, warm at golden hour, faint airglow at night
    const band = mix(mix(hor, WHITE, 0.55), mix(glow, WHITE, 0.25), gh * 0.6);
    mixInto(band, band, mix(hor, [70, 92, 150], 0.4), night);
    const bandK = 0.36 * (1 - night * 0.65);
    const y0 = -A_TOP * F.k, y1 = MARGIN;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    const c = [0, 0, 0];
    for (let i = STOPS.length - 1; i >= 0; i--) {
      const a = STOPS[i];
      const y = -a * F.k;
      skyAt(c, Math.max(-6, a), top, mid, hor, band, bandK);
      g.addColorStop(Math.min(1, Math.max(0, (y - y0) / (y1 - y0))), css(c));
    }
    return g;
  }

  /** Base gradient over the whole visible sky. */
  function drawBase(ctx, F) {
    const p = env.palette, fl = env.weather.lightning;
    // key on the un-flashed colours; the flash itself is an overlay
    const top = unflash(tmpA, p.skyTop, fl), mid = unflash(tmpB, p.skyMid, fl), hor = unflash(tmpC, p.skyHorizon, fl);
    const k = baseKey;
    if (
      !base || colorDelta(k.top, top) > 0.6 || colorDelta(k.mid, mid) > 0.6 || colorDelta(k.hor, hor) > 0.6 ||
      colorDelta(k.glow, p.sunGlow) > 1 || Math.abs(k.k - F.k) > 0.002 || Math.abs(k.gh - env.goldenHour) > 0.01 ||
      Math.abs(k.night - env.night) > 0.01
    ) {
      copy3(k.top, top);
      copy3(k.mid, mid);
      copy3(k.hor, hor);
      copy3(k.glow, p.sunGlow);
      k.k = F.k;
      k.gh = env.goldenHour;
      k.night = env.night;
      base = buildBase(ctx, F, top, mid, hor, p.sunGlow);
    }
    ctx.save();
    ctx.translate(0, F.hy);
    ctx.fillStyle = base;
    const yTop = -F.hy - 2;
    ctx.fillRect(-4, yTop, F.W + 8, Math.min(F.H - F.hy + 2, MARGIN) - yTop);
    ctx.restore();
    // lightning: the whole dome lights up for an instant
    if (fl > 0.01) {
      ctx.fillStyle = css([205, 215, 255], fl * 0.32);
      ctx.fillRect(0, 0, F.W, Math.min(F.H, F.hy + MARGIN));
    }
  }

  /** Warm forward-scattering glow around a low sun, and a little aureole around it all day. */
  function drawScatter(ctx, F) {
    const p = env.palette, sun = env.sun;
    const gh = env.goldenHour;
    const clouds = env.weather.cloud;
    const veil = 1 - 0.78 * sstep(0.45, 1, clouds);
    if (sun.elev < -0.32 || veil <= 0.02) return;
    const sx = F.sunX, sy = F.hy - Math.max(-30, F.sunAlt) * 0.5;
    // 1) the wide glow of a low sun — sunGlow colour spread along the horizon
    const wideA = gh * 0.62 * veil;
    if (wideA > 0.01) {
      if (!warm || colorDelta(warmKey, p.sunGlow) > 1.5) {
        copy3(warmKey, p.sunGlow);
        warm = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        const c = p.sunGlow;
        warm.addColorStop(0, css(c, 1));
        warm.addColorStop(0.18, css(c, 0.72));
        warm.addColorStop(0.45, css(c, 0.3));
        warm.addColorStop(0.75, css(c, 0.08));
        warm.addColorStop(1, css(c, 0));
      }
      ctx.save();
      ctx.globalAlpha = wideA;
      ctx.translate(sx, F.hy + 10);
      ctx.scale(F.W * 0.78, 330 * F.k);
      ctx.fillStyle = warm;
      ctx.fillRect(-1, -1, 2, 1.06);
      ctx.restore();
    }
    // 2) the bright inner glow (screen blend → luminous yellow-white close to the sun)
    const hotA = (0.34 * gh + 0.16 * env.daylight * (1 - gh)) * veil;
    if (hotA > 0.01 && sun.elev > -0.12) {
      const c = mix(p.sun, WHITE, 0.25);
      if (!hot || colorDelta(hotKey, c) > 2) {
        copy3(hotKey, c);
        hot = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        hot.addColorStop(0, css(c, 0.95));
        hot.addColorStop(0.12, css(c, 0.55));
        hot.addColorStop(0.35, css(c, 0.18));
        hot.addColorStop(0.7, css(c, 0.04));
        hot.addColorStop(1, css(c, 0));
      }
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = hotA;
      const r = 420 * F.k;
      ctx.translate(sx, sy);
      ctx.scale(r * 1.35, r * (0.75 + 0.25 * env.daylight));
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Twilight: the pink anti-solar band above the dark blue shadow of the Earth (opposite the low sun). */
  function drawBelt(ctx, F) {
    const sun = env.sun;
    const s = sstep(-0.3, -0.12, sun.elev) * (1 - sstep(0.04, 0.16, sun.elev));
    const veil = 1 - sstep(0.4, 0.85, env.weather.cloud);
    const a = s * veil * 0.85;
    if (a < 0.01) return;
    const p = env.palette;
    const pink = mix(mix(p.skyMid, [255, 168, 178], 0.5), p.skyHorizon, 0.25);
    const shadow = mix(p.skyTop, [44, 52, 104], 0.45);
    const key = belt.key;
    if (Math.max(Math.abs(key[0] - pink[0]), Math.abs(key[1] - pink[1]), Math.abs(key[2] - pink[2]), Math.abs(key[3] - shadow[0]), Math.abs(key[4] - shadow[1]), Math.abs(key[5] - shadow[2])) > 1.5) {
      key[0] = pink[0]; key[1] = pink[1]; key[2] = pink[2];
      key[3] = shadow[0]; key[4] = shadow[1]; key[5] = shadow[2];
      const c = belt.canvas, g = c.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, c.width, c.height);
      const vg = g.createLinearGradient(0, 0, 0, c.height);
      // canvas top = 170 sky px above the horizon, bottom = the horizon
      vg.addColorStop(0, css(pink, 0));
      vg.addColorStop(0.4, css(pink, 0.42));
      vg.addColorStop(0.66, css(pink, 0.55));
      vg.addColorStop(0.8, css(mix(pink, shadow, 0.6), 0.55));
      vg.addColorStop(0.9, css(shadow, 0.6));
      vg.addColorStop(1, css(shadow, 0.66));
      g.fillStyle = vg;
      g.fillRect(0, 0, c.width, c.height);
      // fade out horizontally (x = 0 is the anti-solar end)
      g.globalCompositeOperation = 'destination-in';
      const hg2 = g.createLinearGradient(0, 0, c.width, 0);
      hg2.addColorStop(0, 'rgba(0,0,0,1)');
      hg2.addColorStop(0.3, 'rgba(0,0,0,0.85)');
      hg2.addColorStop(0.62, 'rgba(0,0,0,0.35)');
      hg2.addColorStop(0.9, 'rgba(0,0,0,0)');
      g.fillStyle = hg2;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    // stretch across the anti-solar side, fading out toward the sun
    const hg = 170 * F.k;
    ctx.save();
    ctx.globalAlpha = a;
    if (sun.x < 0.5) {
      ctx.translate(F.W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(belt.canvas, 0, 0, belt.canvas.width, belt.canvas.height, -2, F.hy - hg, F.W + 4, hg + 2);
    ctx.restore();
  }

  /** The haze band sitting on the horizon — drawn after far clouds & islands so it swallows their bases. */
  function drawHorizonHaze(ctx, F) {
    const p = env.palette, fl = env.weather.lightning;
    const hor = unflash(tmpC, p.skyHorizon, fl);
    const c = mix(mix(hor, p.haze, 0.35), WHITE, 0.12 * (1 - env.night));
    const a = 0.75 + 0.25 * env.weather.fog;
    if (!haze || colorDelta(hazeKey.c, c) > 1 || Math.abs(hazeKey.a - a) > 0.02 || hazeKey.k !== F.k) {
      copy3(hazeKey.c, c);
      hazeKey.a = a;
      hazeKey.k = F.k;
      const h = 70 * F.k;
      haze = ctx.createLinearGradient(0, -h, 0, 0);
      haze.addColorStop(0, css(c, 0));
      haze.addColorStop(0.45, css(c, 0.16 * a));
      haze.addColorStop(0.8, css(c, 0.48 * a));
      haze.addColorStop(1, css(c, 0.8 * a));
    }
    ctx.save();
    ctx.translate(0, F.hy);
    ctx.fillStyle = haze;
    ctx.fillRect(0, -70 * F.k, F.W, 70 * F.k + 6);
    ctx.restore();
  }

  return { drawBase, drawScatter, drawBelt, drawHorizonHaze };
}
