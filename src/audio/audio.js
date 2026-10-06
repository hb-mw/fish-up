// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — AUDIO. Every sound in the game, synthesised with the Web Audio API.
//
//   createAudio(game[, opts]) → { update(dt), play(name, opts), unlock(), names, debugState() }
//
// • One AudioContext, created lazily on the first user gesture (or unlock()); suspended while the tab
//   is hidden. Before that every call is a cheap no-op.
// • Buses ambience / sfx / music / ui → master → limiter (see mixer.js). Volumes follow game.settings.
// • Event-driven one-shots (sfx.js), a state-driven soundscape (ambience.js) and generative music
//   (music.js), all reading a plain `inputs` snapshot built from the game each frame.
// • opts.context (any BaseAudioContext, e.g. an OfflineAudioContext) skips the gesture / visibility
//   handling — used by dev/audio-lab.html to render and measure everything offline.
//   opts.ambience=false / opts.music=false disable those layers (isolated one-shot renders).
// ─────────────────────────────────────────────────────────────────────────────
import { createMixer } from './mixer.js';
import { SFX, SFX_NAMES, playSfx } from './sfx.js';
import { createAmbience } from './ambience.js';
import { createMusic } from './music.js';
import { wireEvents } from './wiring.js';
import { createRng } from '../core/rng.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'click', 'keydown'];
/** Internal bus trims at default settings (calibrated in dev/audio-lab). */
const TRIM = { ambience: 1, sfx: 1, music: 0.45, ui: 1 };

/** Fresh inputs snapshot (the lab fills the same shape from sliders via a fake game). */
export function createInputs() {
  return {
    time: 0, real: 0, mode: 'play', paused: false,
    sea: 0.75, wind: 0.22, windDir: 1, rain: 0, fog: 0, storm: false, lightning: 0,
    phase: 'day', hour: 12, daylight: 1, night: 0, golden: 0,
    camX: 1930, camY: 86, zoom: 1, halfW: 960, halfH: 540, submerged: 0, viewDepth: 86,
    boatX: 1750, boatY: 0, boatVx: 0, throttle: 0, tier: 0, tilt: 0,
    fstate: 'idle', charge: 0, reeling: false, reelRate: 0, tension: 0, spoolFree: true,
    lureX: 0, lureY: 0, lureSpeed: 0, lureInWater: false,
    hooked: false, fishUid: 0, fishLevel: 0, fishSize: 0.5, fightMode: 'rest', stamina: 1,
  };
}

/** Fill `I` from the game object (null-safe: any module may be missing). */
export function readInputs(I, game, dt) {
  const env = game.env, w = (env && env.weather) || {}, cam = game.camera, view = game.view || { w: 1920, h: 1080 };
  const b = game.boat || {}, f = game.fishing || {};
  I.real += dt;
  I.time = game.time && game.time.now !== undefined ? game.time.now : I.real;
  I.mode = game.mode || 'play';
  I.paused = !!game.paused;
  const set = game.settings || {};
  I.musicOff = !!set.muted || Number(set.music) === 0 || Number(set.master) === 0;
  I.sea = w.sea !== undefined ? w.sea : 1;
  I.wind = Math.abs(w.wind !== undefined ? w.wind : 0.2);
  I.windDir = (w.wind || 0) < 0 ? -1 : 1;
  I.rain = w.rain || 0;
  I.fog = w.fog || 0;
  I.storm = w.type === 'storm';
  I.lightning = w.lightning || 0;
  I.phase = (env && env.phase) || 'day';
  I.hour = env && env.hour !== undefined ? env.hour : 12;
  I.daylight = env && env.daylight !== undefined ? env.daylight : 1;
  I.night = (env && env.night) || 0;
  I.golden = (env && env.goldenHour) || 0;
  const zoom = (cam && cam.zoom) || 1;
  I.zoom = zoom;
  I.halfH = view.h / 2 / zoom;
  I.halfW = view.w / 2 / zoom;
  I.camX = cam ? cam.x : I.camX;
  I.camY = cam ? cam.y : I.camY;
  const top = I.camY - I.halfH;
  const skyFrac = clamp01(-top / (2 * I.halfH));
  I.submerged = 1 - smoothstep(0, 0.32, skyFrac);
  I.viewDepth = Math.max(0, I.camY);
  I.boatX = b.x !== undefined ? b.x : I.camX;
  I.boatY = b.y || 0;
  I.boatVx = b.vx || 0;
  I.throttle = b.throttle || 0;
  I.tier = b.tier || 0;
  I.tilt = b.tilt || 0;
  I.fstate = f.state || 'idle';
  I.charge = f.charge || 0;
  I.reeling = !!f.reeling;
  I.reelRate = f.reelRate || 0;
  I.tension = f.tension || 0;
  I.spoolFree = f.spoolFree !== false;
  const lure = f.lure || {};
  I.lureX = lure.x || 0;
  I.lureY = lure.y || 0;
  I.lureInWater = !!lure.inWater;
  I.lureSpeed = Math.hypot(lure.vx || 0, lure.vy || 0);
  const fish = f.hooked;
  // the fight score runs only while actually fighting (it resolves when the landing cinematic starts)
  I.hooked = !!fish && I.fstate === 'fight';
  I.fishUid = (fish && fish.uid) || 0;
  I.fishLevel = (fish && fish.species && fish.species.level) || 0;
  I.fishSize = fish && fish.sizeQ !== undefined ? fish.sizeQ : 0.5;
  I.fightMode = (f.fight && f.fight.mode) || 'rest';
  I.stamina = f.fight && f.fight.stamina !== undefined ? f.fight.stamina : 1;
  return I;
}

/**
 * @param {object} game  the game object (or the lab's stand-in)
 * @param {{context?: BaseAudioContext, ambience?: boolean, music?: boolean, seed?: number}} [opts]
 */
export function createAudio(game, opts = {}) {
  const injected = opts.context || null;
  const rng = createRng(opts.seed || 0x5eaf00d);
  const rand = () => rng.next();
  const I = createInputs();
  const warned = new Set();
  const lastPlay = new Map();
  let ctx = null, mix = null, amb = null, music = null;
  let unlocked = !!injected;
  let hiddenSuspended = false;
  let updMs = 0;

  function init(c) {
    ctx = c;
    mix = createMixer(ctx);
    if (opts.ambience !== false) amb = createAmbience(mix, rng, (name, o) => play(name, o));
    if (opts.music !== false) music = createMusic(mix, rng);
    applySettings(0.005);
    applyPause(0.005);
  }

  function ensureContext() {
    if (ctx) return ctx;
    if (injected) {
      init(injected);
      return ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      init(new AC({ latencyHint: 'interactive' }));
    } catch (e) {
      report('context', e);
      ctx = null;
      mix = null;
      return null;
    }
    ctx.onstatechange = () => {
      if (ctx.state === 'running') unlocked = true;
    };
    return ctx;
  }

  function unlock() {
    const c = ensureContext();
    if (!c || injected) return;
    if (c.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) {
      const p = c.resume();
      if (p && p.then) p.then(() => (unlocked = true)).catch(() => {});
    }
  }

  function report(where, e) {
    if (game.reportError) game.reportError('audio.' + where, e);
    else console.error('[audio]', where, e);
  }

  // ── settings / pause ──
  function applySettings(tau = 0.08) {
    if (!mix) return;
    const s = game.settings || {};
    const sq = (v, d) => {
      const x = v !== undefined ? clamp01(Number(v)) : d;
      return x * x;
    };
    mix.setMaster(s.muted ? 0 : Math.min(1.26, sq(s.master, 0.8) / 0.64), tau);
    const sfx = sq(s.sfx, 0.9) / 0.81;
    const mus = sq(s.music, 0.55) / 0.3025;
    mix.setBusLevel('ambience', TRIM.ambience * sfx, tau);
    mix.setBusLevel('sfx', TRIM.sfx * sfx, tau);
    mix.setBusLevel('ui', TRIM.ui * sfx, tau);
    mix.setBusLevel('music', TRIM.music * mus, tau);
  }
  let pausedApplied = null;
  let settingsSig = '';
  const sigOf = (s = {}) => `${s.master}|${s.music}|${s.sfx}|${s.muted}`;
  function applyPause(tau = 0.15) {
    if (!mix) return;
    const p = !!game.paused;
    pausedApplied = p;
    mix.setBusPause('ambience', p ? 0.32 : 1, tau);
    mix.setBusPause('sfx', p ? 0.32 : 1, tau);
    mix.setBusPause('music', p ? 0.5 : 1, tau);
  }

  // ── play ──
  function pan(o) {
    if (o.pan !== undefined) return o.pan;
    if (o.x === undefined || !game.camera) return 0;
    const d = (o.x - I.camX) / Math.max(200, I.halfW);
    return Math.max(-1, Math.min(1, d)) * 0.75;
  }
  /**
   * Play a one-shot by name. opts: { volume, pitch, pan, x (world x → pan), ...sound-specific }.
   * Unknown names are a silent no-op (warned once in debug mode).
   */
  function play(name, o = {}) {
    const def = SFX[name];
    if (!def) {
      if (game.debug && !warned.has(name)) {
        warned.add(name);
        console.warn(`[audio] unknown sound "${name}"`);
      }
      return;
    }
    if (!mix || !ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const prev = lastPlay.get(name);
    if (prev !== undefined && now - prev < (def.gap || 0.02)) return;
    lastPlay.set(name, now);
    try {
      let vol = o.volume !== undefined ? o.volume : 1;
      if (o.x !== undefined && o.pan === undefined && game.camera) {
        const off = Math.max(0, Math.abs(o.x - I.camX) - I.halfW);
        vol *= 1 / (1 + off / 900);
      }
      const dest = def.sub && amb ? (def.sub === 'under' ? amb.under : amb.above) : undefined;
      playSfx(mix, name, { ...o, volume: vol, pan: pan(o), rng: rand, dest, root: o.root || (music ? music.key() : 60) });
    } catch (e) {
      report('play.' + name, e);
    }
  }

  // ── events ──
  const ev = game.events;
  const on = (type, fn) => {
    if (!ev) return;
    ev.on(type, (p) => {
      if (!mix) return;
      try {
        fn(p || {});
      } catch (e) {
        report('on.' + type, e);
      }
    });
  };
  on('settings', () => applySettings(0.06));
  on('pause', () => applyPause(0.15));
  const wiring = wireEvents(game, {
    play,
    I,
    now: () => (ctx ? ctx.currentTime : 0),
    ready: () => !!mix,
    duck: (bus, level, hold, attack, release) => mix && mix.duck(bus, level, hold, attack, release),
    music: () => music,
    report,
  });

  // ── update ──
  function update(dt) {
    if (!mix) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      readInputs(I, game, dt);
      if (pausedApplied !== !!game.paused) applyPause();
      const sig = sigOf(game.settings);
      if (sig !== settingsSig) {
        settingsSig = sig;
        applySettings(0.06);
      }
      if (amb) amb.update(dt, I);
      if (music) music.update(dt, I);
      wiring.update();
      mix.sweep();
    } catch (e) {
      report('update', e);
    }
    if (t0) updMs = updMs * 0.95 + (performance.now() - t0) * 0.05;
  }

  function debugState() {
    if (!ctx) return { ctx: 'none', unlocked: false, voices: 0, nodes: 0 };
    const byName = {};
    for (const v of mix.voices) byName[v.name] = (byName[v.name] || 0) + 1;
    const buses = { master: +mix.level('master').toFixed(1) };
    for (const k of Object.keys(mix.buses)) buses[k] = +mix.level(k).toFixed(1);
    return {
      ctx: ctx.state,
      unlocked,
      sampleRate: ctx.sampleRate,
      time: +ctx.currentTime.toFixed(2),
      baseLatency: ctx.baseLatency,
      voices: mix.voices.length,
      voiceNodes: mix.nodeCount,
      ambienceNodes: amb ? amb.nodeCount : 0,
      musicNodes: music ? music.nodeCount : 0,
      byName,
      buses,
      peak: +mix.peakMaster().toFixed(3),
      layers: amb ? amb.debug() : {},
      music: music ? music.debug() : {},
      inputs: { submerged: +I.submerged.toFixed(2), viewDepth: Math.round(I.viewDepth), fstate: I.fstate, tension: +I.tension.toFixed(2), reelRate: +I.reelRate.toFixed(2), hooked: I.hooked, fishLevel: I.fishLevel },
      updateMs: +updMs.toFixed(3),
    };
  }

  // ── lifecycle: gestures, visibility, automation ──
  if (!injected && typeof window !== 'undefined') {
    const onGesture = () => {
      if (!ctx || ctx.state !== 'running') unlock();
    };
    for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        if (ctx.state === 'running') {
          hiddenSuspended = true;
          ctx.suspend().catch(() => {});
        }
      } else if (hiddenSuspended) {
        hiddenSuspended = false;
        ctx.resume().catch(() => {});
      }
    });
    // Automated browsers (puppeteer sets navigator.webdriver; the shot tool also allows autoplay) and
    // ?audio=1 start right away, so smoke tests see a running context without a synthetic gesture.
    if ((typeof navigator !== 'undefined' && navigator.webdriver) || (game.flags && game.flags.audio === '1')) unlock();
  } else if (injected) {
    ensureContext();
  }

  return {
    update,
    play,
    unlock,
    names: SFX_NAMES.slice(),
    debugState,
    /** For the lab / tests: the live mixer (null before unlock). */
    get mixer() {
      return mix;
    },
    get context() {
      return ctx;
    },
    inputs: I,
  };
}
