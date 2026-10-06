// The post-processing "look": turns game state (camera, light, weather, fight) into shader uniforms each frame,
// and owns the short event accents (hook-set shock ripple, chromatic fringe, flashes).
// Pure CPU, allocation-free per frame: everything is written into preallocated Float32Arrays.
import { clamp, clamp01, lerp, smoothstep } from '../../core/math.js';
import { noise1 } from '../../core/rng.js';
import { WAVE_N } from './shaders.js';

const RIPPLE_LIFE = 0.75;

export function createLook(game) {
  const u = {
    view: new Float32Array(2),
    cam: new Float32Array(4),
    shake: new Float32Array(2),
    wave: new Float32Array(WAVE_N + 1),
    waveInfo: new Float32Array(3),
    water: new Float32Array(4),
    bright: new Float32Array(4),
    bloomP: new Float32Array(4),
    grade: new Float32Array(4),
    vig: new Float32Array(4),
    ripple: new Float32Array(4),
    fx: new Float32Array(4),
    causTime: 0,
    /** 0 = calm daylight … 1 = night / deep (drives bloom metric, grain, …) */
    dark: 0,
  };
  const tmp = { x: 0, y: 0 };
  const rip = { x: 0.5, y: 0.5, age: 99, strength: 0 };
  let chroma = 0;
  let flash = 0;
  let vigX = 0.5, vigY = 0.5;
  let frame = 0;
  let pulseT = 0;
  /** Event accents can be switched off for motion-sensitive players (settings.shake === false). */
  const motionOk = () => game.settings.shake !== false;

  function toScreenUv(x, y) {
    game.camera.worldToScreen(x, y, tmp);
    tmp.x /= game.view.w;
    tmp.y /= game.view.h;
    return tmp;
  }
  /** Best guess of where an event happened: the fish, else payload x/y, else the lure. */
  function eventPos(p) {
    const f = p && (p.fish || p.prey || p.predator);
    if (f && Number.isFinite(f.x) && Number.isFinite(f.y)) return toScreenUv(f.x, f.y);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return toScreenUv(p.x, p.y);
    const l = game.fishing && game.fishing.lure;
    if (l) return toScreenUv(l.x, l.y);
    tmp.x = 0.5;
    tmp.y = 0.5;
    return tmp;
  }
  function startRipple(p, strength) {
    if (!motionOk()) return;
    const s = eventPos(p);
    rip.x = clamp(s.x, -0.2, 1.2);
    rip.y = clamp(s.y, -0.2, 1.2);
    rip.age = 0;
    rip.strength = strength;
  }
  const kick = (amount) => {
    if (motionOk()) chroma = Math.max(chroma, amount);
  };

  const ev = game.events;
  ev.on('hookSet', (p) => {
    const q = p && p.quality;
    startRipple(p, q === 'perfect' ? 1 : q === 'late' ? 0.55 : 0.8);
    if (q === 'perfect') kick(0.45);
  });
  ev.on('predatorStrike', (p) => {
    startRipple(p, 1.1);
    kick(1);
  });
  ev.on('lineSnap', () => kick(0.85));
  ev.on('jump', (p) => {
    const len = (p && p.fish && p.fish.visualLen) || 100;
    if (len > 150) kick(clamp(len / 600, 0.25, 0.6));
  });
  ev.on('levelUp', () => {
    flash = Math.max(flash, 0.35);
  });

  /** @param {number} dt real seconds since the last frame */
  function update(dt) {
    frame++;
    const v = game.view, cam = game.camera, env = game.env, waves = game.world.waves;
    const fishing = game.fishing;
    const time = game.time.now % 3600;

    u.view[0] = v.w;
    u.view[1] = v.h;
    u.cam[0] = cam.x;
    u.cam[1] = cam.y;
    u.cam[2] = cam.zoom;
    u.cam[3] = time;
    u.shake[0] = cam.shakeX;
    u.shake[1] = cam.shakeY;

    // waterline samples across the screen (screen uv, y down)
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= WAVE_N; i++) {
      cam.screenToWorld((i / WAVE_N) * v.w, 0, tmp);
      const y = cam.screenY(waves.heightAt(tmp.x)) / v.h;
      u.wave[i] = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    u.waveInfo[0] = lo;
    u.waveInfo[1] = hi;
    u.waveInfo[2] = cam.screenY(0) / v.h;

    // how "dark" the shot is: night at the surface, or depth
    const camDepth = Math.max(0, cam.y);
    const deep = smoothstep(450, 3600, camDepth);
    // only real night or real depth count as "dark" — a bright sunset sky must never lower the bloom threshold
    const light = env.lightAt(camDepth);
    const deepDark = clamp01(Math.max(deep, (1 - light) * smoothstep(150, 900, camDepth)));
    const night = env.night;
    const dark = Math.max(night * 0.9, deepDark);
    u.dark = dark;
    const cloud = env.weather.cloud;

    // water: refraction amplitude (world px), caustic amount, light flicker, deep factor
    const sun = env.daylight * (1 - 0.7 * smoothstep(0.3, 1, cloud));
    u.water[0] = 1.45 * (motionOk() ? 1 : 0.45);
    u.water[1] = 0.13 * sun;
    u.water[2] = (noise1(time * 2.1, 5) - 0.5) * 0.035 * sun;
    u.water[3] = deep;

    // bloom: luminance threshold by day (the sky must not glow) → max-channel + low threshold in the dark
    const lightning = env.weather.lightning;
    // (at night near the surface moonlit reef whites stay below the threshold; in the deep only emitters are bright)
    u.bright[0] = lerp(lerp(0.85, 0.7, night), 0.36, deepDark);
    u.bright[1] = lerp(0.09, 0.22, Math.max(night * 0.5, deepDark));
    u.bright[2] = 0;
    u.bright[3] = Math.max(0.4 * night, smoothstep(0.25, 0.85, deepDark));
    u.bloomP[0] = lerp(0.42, 0.55, dark) + lightning * 0.35 + flash * 0.4;
    u.bloomP[1] = 1.0;
    u.bloomP[2] = lerp(0.97, 1.0, dark);
    u.bloomP[3] = lerp(0.9, 1.0, dark);

    // grade: contrast k, pivot, saturation, split toning
    u.grade[0] = lerp(0.08, 0.18, dark) + deep * 0.05;
    u.grade[1] = lerp(0.46, 0.2, Math.max(night * 0.5, deepDark));
    u.grade[2] = lerp(1.04, 1.02, deep);
    u.grade[3] = lerp(1.0, 0.65, deep);

    // vignette: soft by day, a tunnel of darkness around the lure in the deep, pulse at high tension
    let tx = 0.5, ty = 0.5;
    if (deep > 0.01 && fishing) {
      const target = fishing.hooked || (fishing.lure && fishing.lure.inWater ? fishing.lure : null);
      if (target && Number.isFinite(target.x)) {
        const s = toScreenUv(target.x, target.y);
        tx = lerp(0.5, clamp(s.x, 0.25, 0.75), deep);
        ty = lerp(0.5, clamp(s.y, 0.25, 0.75), deep);
      }
    }
    const k = 1 - Math.exp(-dt * 3);
    vigX += (tx - vigX) * k;
    vigY += (ty - vigY) * k;
    let pulse = 0;
    if (fishing && fishing.state === 'fight' && fishing.tension > 0.85) {
      pulseT += dt;
      pulse = smoothstep(0.85, 1.05, fishing.tension) * (0.5 + 0.5 * Math.sin(pulseT * 7.5)) * 0.07;
    }
    u.vig[0] = vigX;
    u.vig[1] = vigY;
    u.vig[2] = lerp(0.24, 0.62, deep) + env.night * 0.06 + pulse;
    u.vig[3] = lerp(0.38, 0.1, deep);

    // accents
    rip.age += dt;
    const ra = rip.age / RIPPLE_LIFE;
    u.ripple[0] = rip.x;
    u.ripple[1] = rip.y;
    u.ripple[2] = 0.04 + rip.age * 0.95;
    u.ripple[3] = ra < 1 ? rip.strength * (1 - ra) * (1 - ra) * smoothstep(0, 0.06, rip.age) : 0;
    chroma *= Math.exp(-dt * 4.2);
    if (chroma < 0.002) chroma = 0;
    flash *= Math.exp(-dt * 5);
    if (flash < 0.002) flash = 0;
    if (fishing && fishing.state === 'fight' && fishing.tension > 1 && motionOk()) chroma = Math.max(chroma, (fishing.tension - 1) * 1.2);

    u.fx[0] = lightning * 0.4 + flash * 0.25;
    u.fx[1] = chroma;
    u.fx[2] = lerp(0.008, 0.02, dark);
    u.fx[3] = frame % 61;
    u.causTime = time * 0.32;
  }

  return { u, update };
}
