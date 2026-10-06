// Day/night cycle, weather and the master lighting palette. KERNEL FILE.
// Every art module reads its colours/light from here so the whole picture stays coherent.
import { DAY_LENGTH_S, START_HOUR } from '../core/config.js';
import { clamp, clamp01, lerp, smoothstep, hexToRgb, mixRgb, damp, sampleStops } from '../core/math.js';

export const SUNRISE = 6.0;
export const SUNSET = 19.5;

// ── Sky palette keyframes (hour → colours). Linear interpolation, wraps at 24h. ──────────────────
const H = hexToRgb;
const key = (h, top, mid, hor, sun, glow, cloudLit, cloudShade, haze, ambient, waterTop, stars, rays) => ({
  h, skyTop: H(top), skyMid: H(mid), skyHorizon: H(hor), sun: H(sun), sunGlow: H(glow),
  cloudLit: H(cloudLit), cloudShade: H(cloudShade), haze: H(haze), ambient: H(ambient), waterTop: H(waterTop),
  stars, rays,
});
//            hour   skyTop     skyMid     horizon    sun/moon   glow       cloudLit   cloudShade haze       ambient    waterTop   stars rays
const KEYS = [
  key(0.0,  '#040818', '#0a1230', '#16264e', '#e6ecff', '#6f86c9', '#2a3558', '#0e1428', '#1a2a52', '#4a5a8c', '#0c2444', 1.0, 0.16),
  key(4.6,  '#060b20', '#101a3e', '#2a2f60', '#e6ecff', '#6f86c9', '#30395e', '#11172e', '#232c58', '#505a8e', '#0e2848', 0.9, 0.14),
  key(5.6,  '#17224f', '#4a3f78', '#c9738a', '#ffb38a', '#ff8a6a', '#e89aa0', '#3a3560', '#7a5f8a', '#9a86a8', '#2a4a78', 0.35, 0.25),
  key(6.4,  '#2b4f8f', '#8f8fc0', '#ffc98f', '#ffe2b0', '#ffb070', '#ffd9b8', '#7a6f9a', '#d9a9a0', '#ffd2b0', '#3f86a8', 0.0, 0.75),
  key(8.0,  '#2a78d2', '#6fb4ee', '#cfeaf8', '#fff6dc', '#fff0c0', '#ffffff', '#a9c3dc', '#b9dcf2', '#fff6ea', '#2aa3c6', 0.0, 1.0),
  key(12.0, '#1b66c9', '#4fa3ec', '#bfe6fb', '#ffffff', '#fffbe6', '#ffffff', '#a3c0dd', '#b5dcf5', '#ffffff', '#24a6cc', 0.0, 1.0),
  key(16.0, '#2470cc', '#62acec', '#d6ecf4', '#fff4d6', '#ffeeb8', '#fffaf0', '#a8bcd6', '#c2def0', '#fff4e2', '#2a9fc4', 0.0, 0.95),
  key(18.0, '#3b6aa8', '#e6b089', '#ffd58f', '#ffcf7a', '#ffb45a', '#ffe0b0', '#8f7f9f', '#e8c09a', '#ffd9a8', '#4a8fa6', 0.0, 0.9),
  key(19.3, '#2b3470', '#b8587a', '#ff8f4f', '#ff7a42', '#ff5a3a', '#ff9f7a', '#4f3f72', '#c9707a', '#ff9f86', '#4a5f8a', 0.12, 0.55),
  key(20.3, '#101844', '#3b2f6e', '#8a4f80', '#ff6a5a', '#a04a7a', '#7a5f95', '#1e1e45', '#4a3a6e', '#7a6aa0', '#1c3460', 0.6, 0.2),
  key(21.3, '#040818', '#0a1230', '#16264e', '#e6ecff', '#6f86c9', '#2a3558', '#0e1428', '#1a2a52', '#4a5a8c', '#0c2444', 1.0, 0.16),
  key(24.0, '#040818', '#0a1230', '#16264e', '#e6ecff', '#6f86c9', '#2a3558', '#0e1428', '#1a2a52', '#4a5a8c', '#0c2444', 1.0, 0.16),
];
const COLOR_KEYS = ['skyTop', 'skyMid', 'skyHorizon', 'sun', 'sunGlow', 'cloudLit', 'cloudShade', 'haze', 'ambient', 'waterTop'];

// ── Water colour by depth (px) in full daylight ──────────────────────────────────────────────────
const WATER_STOPS = [
  [0, [40, 186, 204]], [220, [26, 152, 200]], [700, [15, 108, 182]], [1500, [9, 68, 142]],
  [2600, [6, 41, 100]], [3600, [4, 25, 68]], [5000, [2, 12, 38]], [7200, [1, 5, 16]],
];
const REEF_TINT = [44, 206, 190];
const KELP_TINT = [24, 140, 128];
const OVERCAST_TINT = [70, 96, 112];

// ── Weather ──────────────────────────────────────────────────────────────────────────────────────
export const WEATHER_TYPES = {
  clear:  { name: 'Clear',    cloud: 0.12, rain: 0.0, wind: 0.22, sea: 0.75, fog: 0.0,  dur: [110, 220] },
  fair:   { name: 'Fair',     cloud: 0.38, rain: 0.0, wind: 0.42, sea: 1.0,  fog: 0.0,  dur: [100, 200] },
  cloudy: { name: 'Overcast', cloud: 0.82, rain: 0.0, wind: 0.5,  sea: 1.15, fog: 0.05, dur: [80, 150] },
  rain:   { name: 'Rain',     cloud: 0.95, rain: 0.6, wind: 0.62, sea: 1.35, fog: 0.12, dur: [70, 130] },
  storm:  { name: 'Storm',    cloud: 1.0,  rain: 1.0, wind: 1.0,  sea: 2.1,  fog: 0.15, dur: [50, 90] },
  fog:    { name: 'Fog',      cloud: 0.45, rain: 0.0, wind: 0.08, sea: 0.5,  fog: 0.85, dur: [60, 110] },
};
const WEATHER_NEXT = {
  clear: [['clear', 2], ['fair', 5], ['fog', 0.6]],
  fair: [['clear', 4], ['cloudy', 3], ['fair', 1]],
  cloudy: [['fair', 3], ['rain', 3.5], ['cloudy', 1]],
  rain: [['cloudy', 3], ['storm', 2], ['fair', 1.5]],
  storm: [['rain', 4], ['cloudy', 1.5]],
  fog: [['clear', 3], ['fair', 2]],
};

export function phaseOfHour(h) {
  if (h >= 21 || h < 5) return 'night';
  if (h < 7.5) return 'dawn';
  if (h < 17.5) return 'day';
  return 'dusk';
}

export function createEnvironment(game) {
  const rng = game.rng.fork();
  const palette = {};
  for (const k of COLOR_KEYS) palette[k] = [0, 0, 0];
  palette.stars = 0;
  palette.rays = 1;

  const env = {
    /** Hour of day, 0 ≤ hour < 24 */
    hour: START_HOUR,
    day: 1,
    dayLength: DAY_LENGTH_S,
    /** Multiplier on the day clock (0 = frozen). */
    clockScale: 1,
    /** 'night' | 'dawn' | 'day' | 'dusk' */
    phase: phaseOfHour(START_HOUR),
    /** Sun: x = 0..1 across the sky (rises left, sets right), elev = sin(elevation) (-1..1, <0 = below horizon). */
    sun: { x: 0.3, elev: 0.5 },
    /** Moon: same convention. phase 0..1 (0.5 = full). */
    moon: { x: 0.5, elev: -1, phase: 0.55 },
    /** 0..1 amount of sunlight (smooth across dawn/dusk). */
    daylight: 1,
    /** 0..1 — 1 in the dead of night. */
    night: 0,
    /** 0..1 — peaks at sunrise/sunset (warm low sun). */
    goldenHour: 0,
    /** 0..1 light arriving at the sea surface (sun + moon − clouds). */
    surfaceLight: 1,
    /**
     * Master palette ([r,g,b] 0..255 unless noted):
     *  skyTop, skyMid, skyHorizon — sky gradient          sun — sun (or moon at night) disc colour
     *  sunGlow — halo / glitter-path colour                cloudLit, cloudShade — cloud colours
     *  haze — distant-object tint at the horizon           ambient — multiply tint for lit things above water
     *  waterTop — sea surface colour seen from above       stars (0..1) · rays (0..1 god-ray strength)
     */
    palette,
    /**
     * Weather (all values are the CURRENT smoothed values):
     *  type — 'clear'|'fair'|'cloudy'|'rain'|'storm'|'fog'    cloud 0..1 · rain 0..1 · fog 0..1
     *  wind — signed -1..1 (sign = direction, + blows to the right)    sea — wave multiplier (0.5 calm … 2+ storm)
     *  lightning — 0..1 flash intensity right now (decays fast)
     */
    weather: { type: 'clear', cloud: 0.12, rain: 0, wind: 0.22, sea: 0.75, fog: 0, lightning: 0, timeLeft: 240, windDir: 1, locked: false },

    /** Water colour [r,g,b] at depth y (px) and world x — use for water gradients AND underwater fog/haze. */
    waterColorAt(y, x = 6000) {
      let c = sampleStops(WATER_STOPS, Math.max(0, y));
      const shallow = 1 - smoothstep(300, 1000, y);
      const reef = (1 - smoothstep(2600, 3400, x)) * shallow;
      if (reef > 0.001) c = mixRgb(c, REEF_TINT, 0.3 * reef);
      const kelp = smoothstep(2800, 3400, x) * (1 - smoothstep(4800, 5500, x)) * (1 - smoothstep(600, 1900, y));
      if (kelp > 0.001) c = mixRgb(c, KELP_TINT, 0.28 * kelp);
      const cloud = env.weather.cloud;
      if (cloud > 0.3) c = mixRgb(c, OVERCAST_TINT, 0.22 * smoothstep(0.3, 1, cloud) * (1 - smoothstep(0, 1600, y)));
      // light: the shallows follow the sky, the deep is dark regardless
      const k = lerp(0.16, 1, env.surfaceLight);
      const kk = lerp(k, Math.max(k, 0.62), smoothstep(2200, 6000, y));
      // as the light goes, turquoise slides toward deep blue (less red/green) rather than toward grey
      const low = 1 - env.daylight;
      c = [c[0] * kk * (1 - 0.3 * low), c[1] * kk * (1 - 0.16 * low), c[2] * kk];
      // sky bounce near the surface at dawn/dusk — rose/violet, kept subtle so teal never turns olive
      const warm = env.goldenHour * (1 - smoothstep(0, 520, y)) * 0.15;
      if (warm > 0.001) c = mixRgb(c, mixRgb(palette.skyMid, palette.skyHorizon, 0.35), warm);
      // night: push to deep blue rather than grey
      if (env.night > 0.01) c = mixRgb(c, [c[0] * 0.55, c[1] * 0.8, c[2] * 1.25 + 6], env.night * 0.6);
      return c;
    },
    /** 0..1 ambient light at depth y (px). ~1 at the surface on a clear day, ~0.03 in the abyss or at night. */
    lightAt(y) {
      return Math.max(0.03, env.surfaceLight * Math.exp(-Math.max(0, y) / 1700));
    },

    setHour(h) {
      env.hour = ((h % 24) + 24) % 24;
      refresh(0);
    },
    /** Force a weather type. instant=true jumps the smoothed values too. lock=true stops automatic changes. */
    setWeather(type, instant = false, lock = false) {
      if (!WEATHER_TYPES[type]) return;
      const from = env.weather.type;
      env.weather.type = type;
      env.weather.locked = lock;
      const d = WEATHER_TYPES[type].dur;
      env.weather.timeLeft = rng.range(d[0], d[1]);
      if (instant) {
        const w = WEATHER_TYPES[type];
        env.weather.cloud = w.cloud;
        env.weather.rain = w.rain;
        env.weather.wind = w.wind * env.weather.windDir;
        env.weather.sea = w.sea;
        env.weather.fog = w.fog;
      }
      if (from !== type) game.events.emit('weatherChange', { from, to: type });
      refresh(0);
    },

    update(dt) {
      // clock
      const prevHour = env.hour;
      env.hour += (dt * env.clockScale * 24) / env.dayLength;
      if (env.hour >= 24) {
        env.hour -= 24;
        env.day += 1;
        game.events.emit('newDay', { day: env.day });
      }
      // weather state machine
      const w = env.weather;
      if (!w.locked) {
        w.timeLeft -= dt;
        if (w.timeLeft <= 0) {
          const next = rng.weighted(WEATHER_NEXT[w.type], (o) => (o[0] === 'fog' && !(env.hour > 4.5 && env.hour < 8) ? 0 : o[1]));
          if (rng.chance(0.25)) w.windDir = -w.windDir;
          env.setWeather(next ? next[0] : 'clear');
        }
      }
      const target = WEATHER_TYPES[w.type];
      const rate = 0.055; // ≈ 20 s to mostly settle
      w.cloud = damp(w.cloud, target.cloud, rate, dt);
      w.rain = damp(w.rain, target.rain, rate * 1.4, dt);
      w.wind = damp(w.wind, target.wind * w.windDir, rate, dt);
      w.sea = damp(w.sea, target.sea, rate * 0.8, dt);
      w.fog = damp(w.fog, target.fog, rate, dt);
      // lightning
      w.lightning = Math.max(0, w.lightning - dt * 5.5);
      if (w.type === 'storm' && w.rain > 0.75) {
        lightningT -= dt;
        if (lightningT <= 0) {
          lightningT = rng.range(3.5, 11);
          const power = rng.range(0.55, 1);
          w.lightning = power;
          game.events.emit('lightning', { x: rng.range(0.1, 0.9), power });
          pendingThunder.push({ t: rng.range(0.35, 2.2), power });
          if (rng.chance(0.45)) reflash = rng.range(0.09, 0.2);
        }
        if (reflash > 0) {
          reflash -= dt;
          if (reflash <= 0) w.lightning = Math.max(w.lightning, rng.range(0.4, 0.8));
        }
      }
      for (let i = pendingThunder.length - 1; i >= 0; i--) {
        pendingThunder[i].t -= dt;
        if (pendingThunder[i].t <= 0) {
          game.events.emit('thunder', { power: pendingThunder[i].power });
          pendingThunder.splice(i, 1);
        }
      }
      refresh(dt, prevHour);
    },
  };

  let lightningT = 4;
  let reflash = 0;
  const pendingThunder = [];

  function refresh() {
    const h = env.hour;
    // palette
    let i = 0;
    while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp01((h - a.h) / (b.h - a.h));
    for (const k of COLOR_KEYS) {
      const pa = a[k], pb = b[k], out = palette[k];
      out[0] = pa[0] + (pb[0] - pa[0]) * t;
      out[1] = pa[1] + (pb[1] - pa[1]) * t;
      out[2] = pa[2] + (pb[2] - pa[2]) * t;
    }
    palette.stars = lerp(a.stars, b.stars, t);
    palette.rays = lerp(a.rays, b.rays, t);

    // overcast: grey the sky down
    const cloud = env.weather.cloud;
    const oc = smoothstep(0.45, 1, cloud);
    if (oc > 0.001) {
      const lum = (c) => 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
      for (const k of ['skyTop', 'skyMid', 'skyHorizon', 'haze', 'waterTop']) {
        const c = palette[k];
        const l = lum(c) * (k === 'waterTop' ? 0.8 : 0.82);
        const g = [l * 0.92, l * 0.98, l * 1.06];
        const m = mixRgb(c, g, oc * 0.78);
        c[0] = m[0]; c[1] = m[1]; c[2] = m[2];
      }
      const amb = palette.ambient;
      const dim = 1 - oc * 0.28;
      amb[0] *= dim; amb[1] *= dim * 1.01; amb[2] *= Math.min(1, dim * 1.06);
      palette.stars *= 1 - oc;
      palette.rays *= 1 - oc * 0.8;
    }
    // lightning flash brightens everything for an instant
    const fl = env.weather.lightning;
    if (fl > 0.01) {
      for (const k of ['skyTop', 'skyMid', 'skyHorizon', 'cloudLit', 'cloudShade', 'ambient']) {
        const c = palette[k];
        const m = mixRgb(c, [225, 232, 255], fl * 0.6);
        c[0] = m[0]; c[1] = m[1]; c[2] = m[2];
      }
    }

    // sun & moon
    const sunT = (h - SUNRISE) / (SUNSET - SUNRISE);
    env.sun.x = lerp(0.1, 0.9, sunT);
    env.sun.elev = Math.sin(Math.PI * clamp(sunT, -0.25, 1.25));
    const moonT = (((h - (SUNSET + 0.4) + 24) % 24)) / (24 - (SUNSET + 0.4) + SUNRISE - 0.4);
    env.moon.x = lerp(0.14, 0.86, moonT);
    env.moon.elev = moonT >= 0 && moonT <= 1 ? Math.sin(Math.PI * moonT) * 0.85 : -1;
    env.moon.phase = (0.55 + (env.day - 1) * 0.125) % 1; // a new phase every night (full moon on day 1)

    env.daylight = smoothstep(-0.1, 0.3, env.sun.elev);
    env.night = 1 - smoothstep(-0.22, 0.02, env.sun.elev);
    env.goldenHour = env.sun.elev > -0.2 ? clamp01(1 - Math.abs(env.sun.elev - 0.08) / 0.34) : 0;
    const moonLight = 0.07 * clamp01(env.moon.elev) * env.night;
    env.surfaceLight = clamp01((0.1 + 0.9 * env.daylight) * (1 - 0.38 * smoothstep(0.3, 1, cloud)) + moonLight + fl * 0.5);

    const ph = phaseOfHour(h);
    if (ph !== env.phase) {
      const from = env.phase;
      env.phase = ph;
      game.events.emit('phase', { from, to: ph });
    }
  }

  refresh();
  return env;
}
