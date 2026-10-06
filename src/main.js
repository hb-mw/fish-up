// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — kernel: boot, module loading, game loop. KERNEL FILE.
//
// Feature modules are loaded dynamically and are all OPTIONAL: when one is missing or throws,
// the kernel logs it and carries on with a placeholder, so the game always boots.
//
// URL flags (for development & screenshots) — see parseFlags() below:
//   ?mode=play         skip the title screen           ?debug=1        profiler overlay + debug keys
//   ?time=18.5         hour of day                     ?freeze=1       stop the day clock
//   ?weather=storm     clear|fair|cloudy|rain|storm|fog (locked)
//   ?x=6200            boat x                          ?cam=6200,3000[,zoom]  fixed free camera
//   ?off=audio,postfx  skip modules (keys: progression boat fish fishing sky water seabed boatArt effects audio ui postfx
//                                         bony sharks creatures art)
//   ?demo=fight        scripted demo states: idle|charge|cast|wait|bite|fight|deep|caught  (+ &fish=id &sizeQ=0.8 &depth=px)
//   ?spawn=great_white:2,clownfish:12     drop fish into view (for art checks)
//   ?seed=42  ?quality=low|medium|high|ultra  ?nosave=1 (do not read/write the save)  ?ui=0 (hide DOM UI)
// ─────────────────────────────────────────────────────────────────────────────
import { VIEW_H, MIN_VIEW_W, MAX_VIEW_W, WORLD } from './core/config.js';
import { createEvents } from './core/events.js';
import { createRng } from './core/rng.js';
import { createInput } from './core/input.js';
import { createCamera, SURFACE_CAM_Y } from './core/camera.js';
import { createEnvironment, WEATHER_TYPES } from './world/environment.js';
import { createWaves } from './world/waves.js';
import { createTerrain } from './world/terrain.js';
import { createBoatState, createFishingState, createPlayerState } from './gameplay/state.js';
import { computeRod } from './entities/rig.js';
import { registerDrawers } from './render/bestiary.js';
import { createRenderer } from './render/renderer.js';
import { createDemo } from './dev/demo.js';

const MODULES = [
  { key: 'progression', off: 'progression', path: './gameplay/progression.js', factory: 'createProgression' },
  { key: 'boatCtl', off: 'boat', path: './entities/boat.js', factory: 'createBoat' },
  { key: 'fishSys', off: 'fish', path: './entities/fish.js', factory: 'createFishSystem' },
  { key: 'fishingCtl', off: 'fishing', path: './gameplay/fishing.js', factory: 'createFishing' },
  { key: 'sky', off: 'sky', path: './render/sky.js', factory: 'createSky' },
  { key: 'water', off: 'water', path: './render/water.js', factory: 'createWater' },
  { key: 'seabed', off: 'seabed', path: './render/seabed.js', factory: 'createSeabed' },
  { key: 'boatArt', off: 'boatArt', path: './render/boatart.js', factory: 'createBoatArt' },
  { key: 'effects', off: 'effects', path: './render/effects.js', factory: 'createEffects' },
  { key: 'audio', off: 'audio', path: './audio/audio.js', factory: 'createAudio' },
  { key: 'ui', off: 'ui', path: './ui/ui.js', factory: 'createUI' },
];
const ART_SETS = [
  { key: 'bony', path: './render/art/bonyfish.js' },
  { key: 'sharks', path: './render/art/sharks.js' },
  { key: 'creatures', path: './render/art/creatures.js' },
];
const QUALITY = { low: 810, medium: 1080, high: 1440, ultra: 2160 };
const SETTINGS_KEY = 'fishup.settings.v1';

function parseFlags() {
  const flags = {};
  for (const [k, v] of new URLSearchParams(location.search)) flags[k] = v;
  return flags;
}
const noop = () => undefined;
/** An object on which any method call is a harmless no-op (stands in for missing modules). */
const NULL_API = new Proxy({}, { get: (_, prop) => (prop === 'then' ? undefined : noop) });

async function boot() {
  const flags = parseFlags();
  const off = new Set((flags.off || '').split(',').filter(Boolean));
  if (off.has('art')) ART_SETS.forEach((a) => off.add(a.key));
  if (flags.demo) {
    off.add('boat');
    off.add('fishing');
  }

  const stage = document.getElementById('stage');
  const sceneCanvas = document.getElementById('scene');
  const glCanvas = document.getElementById('gl');
  const overlayCanvas = document.getElementById('overlay');
  const uiRoot = document.getElementById('ui');
  if (flags.ui === '0') uiRoot.style.display = 'none';

  let settings = { quality: 'high', postfx: true, master: 0.8, music: 0.55, sfx: 0.9, muted: false, shake: true };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch { /* ignore */ }
  if (flags.quality && QUALITY[flags.quality]) settings.quality = flags.quality;

  const errors = new Map();
  const game = {
    flags,
    debug: flags.debug === '1',
    settings,
    /** 'title' | 'play' */
    mode: 'play',
    paused: false,
    /** now: game seconds (pauses, scales) · real: wall seconds since boot · dt: this frame's game dt · scale: time scale */
    time: { now: 0, real: 0, dt: 0, frame: 0, scale: 1, fps: 60 },
    /** Logical view: w × h logical px (h is always 1080). scale = device px per logical px. */
    view: { w: 1920, h: VIEW_H, scale: 1, cssW: 0, cssH: 0 },
    events: createEvents(),
    rng: createRng(flags.seed ? Number(flags.seed) : (Date.now() ^ (Math.random() * 1e9)) >>> 0),
    stage, uiRoot, sceneCanvas, glCanvas, overlayCanvas,
    ctx: sceneCanvas.getContext('2d', { alpha: false }),
    octx: overlayCanvas.getContext('2d'),
    mods: {},
    errors,

    reportError(where, e) {
      const rec = errors.get(where) || { n: 0, msg: '' };
      rec.n++;
      rec.msg = (e && e.message) || String(e);
      errors.set(where, rec);
      if (rec.n <= 3) console.error(`[fishup:${where}]`, e);
      else if (rec.n === 4) console.error(`[fishup:${where}] (further errors from here are muted)`);
    },
    /** UI panels call lockInput('shop', true) while open: gameplay input is ignored while any lock is held. */
    lockInput(key, on) {
      if (on) locks.add(key);
      else locks.delete(key);
      refreshLock();
    },
    isLocked: () => locks.size > 0,
    setPaused(on) {
      on = !!on;
      if (game.paused === on) return;
      game.paused = on;
      game.events.emit('pause', { paused: on });
    },
    /** Leave the title screen and start playing. */
    start() {
      if (game.mode === 'play') return;
      game.mode = 'play';
      refreshLock();
      game.events.emit('gameStart', {});
    },
    saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(game.settings));
      } catch { /* ignore */ }
      applySettings();
      game.events.emit('settings', game.settings);
    },
  };
  window.__game = game;

  const locks = new Set();
  function refreshLock() {
    game.input.locked = locks.size > 0 || game.mode !== 'play';
  }

  game.input = createInput(game, overlayCanvas);
  game.env = createEnvironment(game);
  game.world = { width: WORLD.width, depth: WORLD.depth, terrain: createTerrain(), waves: null };
  game.world.waves = createWaves(game);
  game.camera = createCamera(game);
  game.events.on('shake', (p) => {
    if (game.settings.shake !== false) game.camera.addShake((p && p.amount) || 0.2);
  });
  game.boat = createBoatState();
  game.fishing = createFishingState();
  game.player = createPlayerState();
  game.fish = { list: [], release: noop, remove(f) { const i = this.list.indexOf(f); if (i >= 0) this.list.splice(i, 1); }, spawnDebug: null };
  game.fx = NULL_API;
  game.audio = NULL_API;
  game.ui = NULL_API;
  game.progression = null;

  // ── view / canvases ──────────────────────────────────────────────────────
  function resize() {
    const cssW = Math.max(320, window.innerWidth), cssH = Math.max(240, window.innerHeight);
    let stageW = cssW, stageH = cssH;
    let vw = (VIEW_H * cssW) / cssH;
    if (vw < MIN_VIEW_W) {
      vw = MIN_VIEW_W;
      stageH = (cssW * VIEW_H) / MIN_VIEW_W;
    } else if (vw > MAX_VIEW_W) {
      vw = MAX_VIEW_W;
      stageW = (cssH * MAX_VIEW_W) / VIEW_H;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let scale = (stageH * dpr) / VIEW_H;
    const maxH = QUALITY[game.settings.quality] || QUALITY.high;
    if (VIEW_H * scale > maxH) scale = maxH / VIEW_H;
    const v = game.view;
    v.w = vw;
    v.h = VIEW_H;
    v.scale = scale;
    v.cssW = stageW;
    v.cssH = stageH;
    const bw = Math.round(vw * scale), bh = Math.round(VIEW_H * scale);
    for (const c of [sceneCanvas, overlayCanvas]) {
      if (c.width !== bw || c.height !== bh) {
        c.width = bw;
        c.height = bh;
      }
    }
    stage.style.width = stageW + 'px';
    stage.style.height = stageH + 'px';
    // CSS unit for the DOM UI: calc(var(--u) * 24) == 24 logical px
    stage.style.setProperty('--u', stageH / VIEW_H + 'px');
    stage.style.setProperty('--vw', vw);
    if (game.mods.postfx && game.mods.postfx.resize) {
      try {
        game.mods.postfx.resize(bw, bh);
      } catch (e) {
        game.reportError('postfx.resize', e);
      }
    }
    game.camera.refresh();
    game.events.emit('resize', v);
  }
  function applySettings() {
    const fxOn = !!(game.mods.postfx && game.mods.postfx.ok !== false && game.settings.postfx);
    glCanvas.style.display = fxOn ? 'block' : 'none';
    sceneCanvas.style.display = fxOn ? 'none' : 'block';
    resize();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── flags → initial state ────────────────────────────────────────────────
  if (flags.time !== undefined) game.env.setHour(Number(flags.time));
  if (flags.freeze === '1') game.env.clockScale = 0;
  if (flags.weather && WEATHER_TYPES[flags.weather]) game.env.setWeather(flags.weather, true, true);
  if (flags.x !== undefined) game.boat.x = Number(flags.x);
  game.camera.setTarget(game.boat.x + 180, SURFACE_CAM_Y, 1, true);
  if (flags.cam) {
    const [cx, cy, cz] = flags.cam.split(',').map(Number);
    game.camera.setTarget(cx, cy, cz || 1, true);
    game.camera.free = true;
  }

  // ── load feature modules ─────────────────────────────────────────────────
  const load = async (path) => {
    try {
      return await import(path);
    } catch (e) {
      const missing = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(String(e && e.message));
      if (missing) console.info(`[fishup] module ${path} not available yet — using placeholder`);
      else game.reportError('import ' + path, e);
      return null;
    }
  };
  const [mods, arts, postfxMod] = await Promise.all([
    Promise.all(MODULES.map((m) => (off.has(m.off) ? null : load(m.path)))),
    Promise.all(ART_SETS.map((a) => (off.has(a.key) ? null : load(a.path)))),
    off.has('postfx') ? null : load('./render/postfx.js'),
  ]);
  arts.forEach((mod) => mod && registerDrawers(mod.DRAWERS));

  const renderer = createRenderer(game);
  game.renderer = renderer;

  MODULES.forEach((m, i) => {
    const mod = mods[i];
    if (!mod || typeof mod[m.factory] !== 'function') return;
    try {
      const inst = mod[m.factory](game);
      if (inst) {
        game.mods[m.key] = inst;
        if (m.key === 'progression') game.progression = inst;
        if (m.key === 'fishSys') game.fish = inst;
        if (m.key === 'effects') game.fx = inst;
        if (m.key === 'audio') game.audio = inst;
        if (m.key === 'ui') game.ui = inst;
      }
    } catch (e) {
      game.reportError('create ' + m.key, e);
    }
  });
  if (postfxMod && typeof postfxMod.createPostFX === 'function') {
    try {
      game.mods.postfx = postfxMod.createPostFX(game, sceneCanvas, glCanvas);
    } catch (e) {
      game.reportError('create postfx', e);
    }
  }
  applySettings();

  const demo = createDemo(game);
  game.mode = game.mods.ui && flags.mode !== 'play' && !flags.demo ? 'title' : 'play';
  refreshLock();

  const call = (mod, fn, a) => {
    if (mod && typeof mod[fn] === 'function') {
      try {
        mod[fn](a);
      } catch (e) {
        game.reportError(`${fn}`, e);
      }
    }
  };
  const callMod = (key, fn, a) => {
    const mod = game.mods[key];
    if (mod && typeof mod[fn] === 'function') {
      try {
        mod[fn](a);
      } catch (e) {
        game.reportError(`${key}.${fn}`, e);
      }
    }
  };

  // ── debug keys ───────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (!game.debug) return;
    if (e.code === 'BracketRight') game.env.setHour(game.env.hour + 1);
    if (e.code === 'BracketLeft') game.env.setHour(game.env.hour - 1);
    if (e.code === 'Backslash') {
      const types = Object.keys(WEATHER_TYPES);
      game.env.setWeather(types[(types.indexOf(game.env.weather.type) + 1) % types.length], false, true);
    }
    if (e.code === 'KeyT') game.env.clockScale = game.env.clockScale ? 0 : 1;
  });

  // ── main loop ────────────────────────────────────────────────────────────
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let rdt = (now - last) / 1000;
    last = now;
    if (rdt > 0.25) rdt = 1 / 60; // tab was in the background
    rdt = Math.min(rdt, 1 / 20);
    const time = game.time;
    time.real += rdt;
    time.frame++;
    fpsAcc += rdt;
    fpsN++;
    if (fpsAcc >= 0.5) {
      time.fps = fpsN / fpsAcc;
      fpsAcc = 0;
      fpsN = 0;
    }
    if (game.input.pressed('debug')) game.debug = !game.debug;

    const dt = game.paused ? 0 : rdt * time.scale;
    time.dt = dt;
    if (dt > 0) {
      time.now += dt;
      call(game.env, 'update', dt);
      callMod('progression', 'update', dt);
      if (game.mods.boatCtl) callMod('boatCtl', 'update', dt);
      else if (!demo.active) fallbackBoat(dt);
      computeRod(game.boat);
      callMod('fishSys', 'update', dt);
      callMod('fishingCtl', 'update', dt);
      if (demo.active) call(demo, 'update', dt);
      if (game.mode === 'title' && !game.camera.free) {
        game.camera.setTarget(game.boat.x + 180 + Math.sin(time.real * 0.12) * 90, SURFACE_CAM_Y + 30, 1);
      }
      game.camera.update(dt);
      callMod('sky', 'update', dt);
      callMod('water', 'update', dt);
      callMod('seabed', 'update', dt);
      callMod('boatArt', 'update', dt);
      callMod('effects', 'update', dt);
    }
    // UI & audio keep running while paused (they get the real dt)
    callMod('ui', 'update', rdt);
    callMod('audio', 'update', rdt);

    renderer.render();
    if (game.mods.postfx && game.settings.postfx && game.mods.postfx.ok !== false) callMod('postfx', 'render', rdt);
    renderer.renderOverlay();
    if (game.debug) drawDebug();
    game.input.endFrame();
  }

  function fallbackBoat() {
    const b = game.boat, w = game.world.waves;
    b.y = w.heightAt(b.x) * 0.8;
    b.tilt = Math.atan(w.slopeAt(b.x)) * 0.6;
  }

  function drawDebug() {
    const o = game.octx, v = game.view, e = game.env, f = game.fishing, c = game.camera;
    o.save();
    o.setTransform(v.scale, 0, 0, v.scale, 0, 0);
    const lines = [
      `${game.time.fps.toFixed(0)} fps   view ${v.w.toFixed(0)}×${v.h} @${v.scale.toFixed(2)}   mode ${game.mode}${game.paused ? ' (paused)' : ''}`,
      `time ${e.hour.toFixed(2)}h ${e.phase}  day ${e.day}  light ${e.surfaceLight.toFixed(2)}  weather ${e.weather.type} c${e.weather.cloud.toFixed(2)} r${e.weather.rain.toFixed(2)} w${e.weather.wind.toFixed(2)} sea${e.weather.sea.toFixed(2)}`,
      `cam ${c.x.toFixed(0)},${c.y.toFixed(0)} z${c.zoom.toFixed(2)}   boat ${game.boat.x.toFixed(0)}  fish ${game.fish.list.length}`,
      `fishing ${f.state} t${f.stateT.toFixed(1)} tension ${f.tension.toFixed(2)} out ${f.line.out.toFixed(0)}/${f.line.max.toFixed(0)} lure ${f.lure.id} ${f.lure.depthM.toFixed(0)}m ${f.hooked ? '⟵ ' + f.hooked.speciesId : ''}`,
      'layers: ' + renderer.order.map((n) => `${n} ${renderer.prof[n].toFixed(1)}`).join('  '),
    ];
    for (const [where, rec] of errors) lines.push(`⚠ ${where} ×${rec.n}: ${rec.msg}`);
    o.font = '15px ui-monospace, Menlo, monospace';
    o.textBaseline = 'top';
    let y = v.h - 14 - lines.length * 20;
    for (const line of lines) {
      const w = o.measureText(line).width;
      o.fillStyle = 'rgba(0,0,0,0.6)';
      o.fillRect(10, y - 2, w + 12, 20);
      o.fillStyle = line.startsWith('⚠') ? '#ff8a7a' : '#d6f5ff';
      o.fillText(line, 16, y);
      y += 20;
    }
    o.restore();
  }

  game.events.emit('ready', {});
  document.documentElement.classList.add('fishup-ready');
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

boot().catch((e) => {
  console.error('[fishup] boot failed', e);
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;color:#ffb4a8;background:#06121f;font:14px ui-monospace,monospace;white-space:pre-wrap;z-index:99';
  el.textContent = 'Fish Up failed to start:\n\n' + (e && e.stack ? e.stack : e);
  document.body.appendChild(el);
});
