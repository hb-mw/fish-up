// Fish Up — audio lab (dev only).
//   dev/audio-lab.html           buttons for every one-shot / event, sliders for every continuous input
//   dev/audio-lab.html?auto=1    renders every one-shot + ~10 s of each ambience/music state through an
//                                OfflineAudioContext, measures peak / RMS / K-weighted loudness / DC and
//                                publishes window.__audioReport = { ok, failures, table, rows }
//   &only=<substring>            restrict the report to matching cases     &long=1  add the 5-minute music soak
import { createAudio } from '../src/audio/audio.js';
import { SFX, SFX_VARIANTS } from '../src/audio/sfx.js';
import { createEvents } from '../src/core/events.js';
import { createRng } from '../src/core/rng.js';
import { createEnvironment, WEATHER_TYPES } from '../src/world/environment.js';
import { createTerrain } from '../src/world/terrain.js';
import { createBoatState, createFishingState, createPlayerState } from '../src/gameplay/state.js';
import { createFish } from '../src/entities/fishbase.js';
import { SPECIES, SPECIES_BY_ID } from '../src/data/species.js';
import { ZONES, rarityOf } from '../src/core/config.js';

const Q = new URLSearchParams(location.search);
const SR = 48000;

// ── a stand-in for the game object (real kernel env/state factories, no renderer) ─────────────────
function makeGame() {
  const g = {
    flags: {},
    debug: true,
    settings: { quality: 'high', postfx: true, master: 0.8, music: 0.55, sfx: 0.9, muted: false, shake: true },
    mode: 'play',
    paused: false,
    time: { now: 0, real: 0, dt: 0, frame: 0, scale: 1, fps: 60 },
    view: { w: 1920, h: 1080, scale: 1 },
    events: createEvents(),
    rng: createRng(42),
    camera: { x: 1930, y: 86, zoom: 1, free: true },
    boat: createBoatState(),
    fishing: createFishingState(),
    player: createPlayerState(),
    world: { width: 12000, depth: 7200, terrain: createTerrain() },
    mods: {},
    reportError: (w, e) => console.error('[lab]', w, e),
  };
  g.env = createEnvironment(g);
  g.env.setHour(11);
  g.env.setWeather('clear', true, true);
  return g;
}
function fishOfLevel(level, sizeQ = 0.6) {
  const sp = SPECIES.find((s) => s.level === level && s.group !== 'item') || SPECIES_BY_ID.yellowtail_snapper;
  return createFish(sp, { sizeQ, rng: createRng(level * 31 + 7) });
}
/** Apply a scenario description to the stand-in game. */
function applyScene(g, s) {
  if (s.hour !== undefined) g.env.setHour(s.hour);
  if (s.weather) g.env.setWeather(s.weather, true, true);
  const w = g.env.weather;
  if (s.sea !== undefined) w.sea = s.sea;
  if (s.wind !== undefined) w.wind = s.wind;
  if (s.rain !== undefined) w.rain = s.rain;
  if (s.camX !== undefined) g.camera.x = s.camX;
  if (s.camY !== undefined) g.camera.y = s.camY;
  if (s.zoom !== undefined) g.camera.zoom = s.zoom;
  if (s.boatX !== undefined) g.boat.x = s.boatX;
  if (s.throttle !== undefined) {
    g.boat.throttle = s.throttle;
    g.boat.vx = s.throttle * 300;
  }
  if (s.tier !== undefined) g.boat.tier = s.tier;
  const f = g.fishing;
  if (s.state) f.state = s.state;
  if (s.reelRate !== undefined) f.reelRate = s.reelRate;
  if (s.reeling !== undefined) f.reeling = s.reeling;
  if (s.tension !== undefined) f.tension = s.tension;
  if (s.charge !== undefined) f.charge = s.charge;
  if (s.spoolFree !== undefined) f.spoolFree = s.spoolFree;
  if (s.fishLevel !== undefined) {
    f.hooked = s.fishLevel > 0 ? fishOfLevel(s.fishLevel, s.fishSize !== undefined ? s.fishSize : 0.6) : null;
  }
  if (s.lureVx !== undefined) {
    f.lure.vx = s.lureVx;
    f.lure.inWater = !!s.lureInWater;
  }
  if (s.settings) Object.assign(g.settings, s.settings);
  if (s.mode) g.mode = s.mode;
  if (s.paused !== undefined) g.paused = s.paused;
}

// ── analysis ───────────────────────────────────────────────────────────────────────────────────
/** ITU-R BS.1770 K-weighting (48 kHz coefficients). */
function kweight(x) {
  const y = new Float32Array(x.length);
  const st = [
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621],
  ];
  let src = x;
  for (const [b0, b1, b2, a1, a2] of st) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < src.length; i++) {
      const xi = src[i];
      const yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = yi;
      y[i] = yi;
    }
    src = y;
  }
  return y;
}
function analyze(buf, from = 0) {
  const sr = buf.sampleRate, n = buf.length, i0 = Math.floor(from * sr);
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  let peak = 0, nan = 0, sq = 0, cnt = 0, knee = 0;
  const dc = [0, 0];
  chans.forEach((d, c) => {
    for (let i = i0; i < n; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) {
        nan++;
        continue;
      }
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      if (a > 0.8) knee++;
      sq += v * v;
      dc[c] += v;
      cnt++;
    }
    dc[c] /= Math.max(1, n - i0);
  });
  const kw = chans.map((d) => kweight(d.subarray(i0)));
  const win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr);
  const blocks = [];
  for (let s = 0; s + win <= kw[0].length; s += hop) {
    let e = 0;
    for (const k of kw) {
      let m = 0;
      for (let i = s; i < s + win; i++) m += k[i] * k[i];
      e += m / win;
    }
    blocks.push(e);
  }
  if (!blocks.length) {
    let e = 0;
    for (const k of kw) {
      let m = 0;
      for (let i = 0; i < k.length; i++) m += k[i] * k[i];
      e += m / Math.max(1, k.length);
    }
    blocks.push(e);
  }
  const lufs = (e) => -0.691 + 10 * Math.log10(e + 1e-15);
  const mmax = lufs(Math.max(...blocks));
  const abs = blocks.filter((e) => lufs(e) > -70);
  let integ = -Infinity;
  if (abs.length) {
    const rel = lufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const gated = abs.filter((e) => lufs(e) > rel);
    if (gated.length) integ = lufs(gated.reduce((a, b) => a + b, 0) / gated.length);
  }
  // longest stretch below -55 LUFS (silence) in seconds, for the music soak
  let run = 0, longest = 0;
  for (const e of blocks) {
    if (lufs(e) < -55) {
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return {
    peak,
    peakDb: 20 * Math.log10(peak + 1e-12),
    rmsDb: 10 * Math.log10(sq / Math.max(1, cnt) + 1e-15),
    mmax,
    integ,
    dc: Math.max(Math.abs(dc[0]), Math.abs(dc[1])),
    nan,
    silentRun: longest * 0.1,
    knee: knee / Math.max(1, cnt),
    blocks: blocks.map(lufs),
  };
}

// ── offline rendering ──────────────────────────────────────────────────────────────────────────
const STEP = 1536 / SR; // 32 ms, render-quantum aligned
async function renderCase(c) {
  let dur = c.dur;
  if (!dur && c.start) {
    // probe pass: how long does the sound last?
    const probe = new OfflineAudioContext(2, 128, SR);
    const g0 = makeGame();
    if (c.scene) applyScene(g0, c.scene);
    const a0 = createAudio(g0, { context: probe, ambience: false, music: false, seed: 7 });
    a0.update(0.001);
    c.start(g0, a0);
    let end = 0;
    for (const v of a0.mixer.voices) end = Math.max(end, v.end);
    dur = Math.min(24, Math.max(0.4, end + 0.9));
  }
  const oc = new OfflineAudioContext(2, Math.round(SR * dur), SR);
  const g = makeGame();
  if (c.scene) applyScene(g, c.scene);
  const audio = createAudio(g, { context: oc, ambience: !!c.ambience, music: !!c.music, seed: 7 });
  let maxVoices = 0, maxNodes = 0, lagMax = 0;
  const step = (t) => {
    g.time.now += STEP;
    g.time.real += STEP;
    if (c.tick) c.tick(g, audio, t);
    audio.update(STEP);
    const d = audio.mixer;
    maxVoices = Math.max(maxVoices, d.voices.length);
    maxNodes = Math.max(maxNodes, d.nodeCount);
    const m = audio.debugState().music;
    if (m && m.lag !== undefined) lagMax = Math.max(lagMax, m.lag);
  };
  audio.update(0.001);
  if (c.start) c.start(g, audio);
  const sched = (t) => {
    if (t >= dur - STEP * 1.5) return;
    oc.suspend(t).then(() => {
      try {
        step(t);
      } catch (e) {
        console.error('[lab] step', c.id, e);
      }
      sched(t + STEP);
      oc.resume();
    });
  };
  sched(STEP);
  const t0 = performance.now();
  const buf = await oc.startRendering();
  const ms = performance.now() - t0;
  const st = analyze(buf, c.from || 0);
  return { st, dur, ms, maxVoices, maxNodes, lagMax, endVoices: audio.mixer.voices.length, buf };
}

// ── expectations (momentary-max LUFS for one-shots, integrated for states) ──────────────────────
const EXPECT = {
  cal: [-20.6, -19.4],
  calhot: [-8, -1],
  ui: [-46, -24],
  tick: [-46, -24],
  sfx: [-34, -13],
  alert: [-24, -11],
  fanfare: [-25, -10],
  stinger: [-28, -11],
  amb: [-48, -18],
  ambstate: [-44, -22],
  ambstorm: [-40, -19],
  musicstate: [-40, -24],
  fightstate: [-36, -18],
  eventpath: [-30, -8],
  layer: [-42, -16],
  stress: [-30, -8],
  soak: [-40, -22],
};

function buildCases() {
  const cases = [];
  // calibration: a -20 dBFS sine into the sfx bus must come out at -20 dBFS (limiter make-up trimmed out),
  // and a +6 dBFS one must be caught under the ceiling.
  for (const [label, amp] of [['cal: sine -20 dBFS', 0.1], ['cal: sine +6 dBFS', 2]]) {
    cases.push({
      id: label,
      cat: amp < 1 ? 'cal' : 'calhot',
      dur: 1.5,
      from: 0.5,
      start: (g, a) => {
        const m = a.mixer, c = m.ctx;
        const o = c.createOscillator();
        o.frequency.value = 997;
        const gg = c.createGain();
        gg.gain.value = amp;
        o.connect(gg);
        gg.connect(m.buses.sfx.dry);
        o.start(0);
        o.stop(1.45);
      },
    });
  }
  // every one-shot variant, isolated (no ambience / music)
  for (const vdef of SFX_VARIANTS) {
    const def = SFX[vdef.name];
    cases.push({
      id: vdef.label,
      cat: def.cat,
      start: (g, a) => a.play(vdef.name, { ...(vdef.opts || {}) }),
    });
  }
  // continuous states (~10 s each)
  const S = (id, cat, scene, extra = {}) => cases.push({ id, cat, scene, dur: extra.dur || 10, ambience: extra.ambience !== false, music: !!extra.music, from: extra.from || 1.5, tick: extra.tick, start: extra.start });
  S('amb: day calm', 'ambstate', { hour: 11, weather: 'clear', camY: 86 });
  S('amb: fair breeze', 'ambstate', { hour: 15, weather: 'fair', camY: 86 });
  S('amb: rain', 'ambstate', { hour: 13, weather: 'rain', camY: 86 });
  S('amb: storm (+close thunder)', 'ambstorm', { hour: 13, weather: 'storm', camY: 86 }, { start: (g) => setTimeout(() => {}, 0), tick: (g, a, t) => { if (Math.abs(t - 3) < STEP / 2) g.events.emit('thunder', { power: 0.9 }); } });
  S('amb: night calm', 'ambstate', { hour: 23.5, weather: 'clear', camY: 86 });
  S('amb: dusk island', 'ambstate', { hour: 19, weather: 'clear', camX: 1100, boatX: 1000, camY: 86 });
  S('amb: sunlit underwater', 'ambstate', { hour: 12, camX: 1800, camY: 800 });
  S('amb: twilight zone', 'ambstate', { hour: 12, camX: 8000, camY: 2600 });
  S('amb: midnight zone', 'ambstate', { hour: 12, camX: 9000, camY: 4600 });
  S('amb: abyss', 'ambstate', { hour: 12, camX: 10600, camY: 6200 });
  S('amb: vents', 'ambstate', { hour: 12, camX: 11300, camY: 6750 });
  // continuous gameplay layers over a calm night bed (compare with 'amb: night calm')
  const LY = { dur: 8, from: 1.5 };
  const night = { hour: 23.5, weather: 'clear' };
  S('layer: engine tier0 full', 'layer', { ...night, throttle: 1, tier: 0 }, LY);
  S('layer: engine tier1 full', 'layer', { ...night, throttle: 1, tier: 1 }, LY);
  S('layer: engine tier2 full', 'layer', { ...night, throttle: 1, tier: 2 }, LY);
  S('layer: engine tier0 trolling', 'layer', { ...night, throttle: 0.15, tier: 0 }, LY);
  S('layer: ratchet retrieve', 'layer', { ...night, state: 'waiting', reelRate: 0.8, reeling: true, lureVx: 0, lureInWater: true }, LY);
  S('layer: drag scream', 'layer', { ...night, state: 'fight', reelRate: -1, tension: 0.3 }, LY);
  S('layer: strain in the red', 'layer', { ...night, state: 'fight', reelRate: 0, tension: 1.1 }, LY);
  S('layer: line whizz (casting)', 'layer', { ...night, state: 'casting', lureVx: 800 }, { dur: 4, from: 0.3 });
  S('layer: cast charge', 'layer', { ...night, state: 'charging', charge: 0.8 }, { dur: 4, from: 0.5 });
  // the score, isolated (no ambience)
  const MU = { ambience: false, music: true, dur: 14, from: 2 };
  S('music: title', 'musicstate', { mode: 'title', hour: 11 }, MU);
  S('music: day', 'musicstate', { hour: 11 }, MU);
  S('music: dawn', 'musicstate', { hour: 6.5 }, MU);
  S('music: dusk', 'musicstate', { hour: 18.6 }, MU);
  S('music: night', 'musicstate', { hour: 23 }, MU);
  S('music: deep (twilight)', 'musicstate', { hour: 12, camX: 8000, camY: 2600 }, MU);
  S('music: abyss', 'musicstate', { hour: 12, camX: 10600, camY: 6400 }, MU);
  // fights: score + reel/drag/strain feedback (+ day ambience)
  const FT = { ambience: true, music: true, dur: 12, from: 2 };
  S('fight: lv2 playful', 'fightstate', { hour: 11, state: 'fight', fishLevel: 2, tension: 0.5, reelRate: 0.6, reeling: true }, FT);
  S('fight: lv5 driving drag', 'fightstate', { hour: 11, state: 'fight', fishLevel: 5, tension: 0.8, reelRate: -0.6 }, FT);
  S('fight: lv9 epic in the red', 'fightstate', { hour: 11, state: 'fight', fishLevel: 9, fishSize: 0.9, tension: 1.08, reelRate: -1 }, FT);
  // event paths (payload shapes, arbitration, fallbacks)
  const at = (t, T) => Math.abs(t - T) < STEP / 2;
  const EV = (id, scene, tick, dur = 9) => cases.push({ id, cat: 'eventpath', scene, dur, ambience: false, music: false, tick });
  EV('ev: catch → META pile-up → legendary', {}, (g, a, t) => {
    if (!at(t, 0.5)) return;
    // the real META order: catch → coins, xp, dexNew, record, levelUp → catchScored → toast
    g.events.emit('catch', { fish: fishOfLevel(9) });
    g.events.emit('coins', { delta: 640, total: 900, reason: 'sale' });
    g.events.emit('xp', { delta: 120, total: 400 });
    g.events.emit('dexNew', { speciesId: 'great_white' });
    g.events.emit('record', { speciesId: 'great_white', lengthCm: 500, weightKg: 1500 });
    g.events.emit('levelUp', { level: 6, title: 'Angler', unlocked: [] });
    g.events.emit('catchScored', { record: { speciesId: 'great_white', level: 9, rarity: { id: 'legendary', name: 'Legendary' }, shiny: true, isRecord: true, sizeClass: { id: 'trophy' }, released: true } });
    g.events.emit('toast', { text: 'x', kind: 'rare' });
  }, 15);
  EV('ev: catchScored junk (bare record)', {}, (g, a, t) => at(t, 0.3) && g.events.emit('catchScored', { record: { speciesId: 'old_boot' } }), 4);
  EV('ev: catch fallback (no META)', {}, (g, a, t) => at(t, 0.3) && g.events.emit('catch', { fish: fishOfLevel(5) }), 5);
  EV('ev: bite → hookSet perfect', {}, (g, a, t) => {
    if (at(t, 0.3)) g.events.emit('bite', { fish: fishOfLevel(4) });
    if (at(t, 0.75)) g.events.emit('hookSet', { fish: fishOfLevel(4), quality: 'perfect' });
  }, 4);
  cases.push({ id: 'ev: lineSnap mid-fight', cat: 'fightstate', scene: { hour: 11, state: 'fight', fishLevel: 6, tension: 1.0, reelRate: -0.7 }, dur: 9, from: 1, ambience: true, music: true, tick: (g, a, t) => {
    if (at(t, 4)) {
      g.fishing.state = 'broken';
      g.fishing.hooked = null;
      g.fishing.tension = 0;
      g.fishing.reelRate = 0;
      g.events.emit('lineSnap', { x: 2000, y: 300 });
      g.events.emit('fightEnd', { fish: null, result: 'snapped' });
    }
  } });
  // worst case: storm + epic fight in the red + legendary fanfare + breach + thunder + coins at once
  cases.push({ id: 'stress: everything at once', cat: 'stress', scene: { hour: 13, weather: 'storm', state: 'fight', fishLevel: 9, fishSize: 1, tension: 1.1, reelRate: -1 }, dur: 10, from: 0.5, ambience: true, music: true, tick: (g, a, t) => {
    if (at(t, 2)) {
      g.events.emit('thunder', { power: 1 });
      g.events.emit('splash', { x: 2000, y: 0, size: 3, kind: 'jump' });
      g.events.emit('predatorStrike', { predator: fishOfLevel(9), prey: fishOfLevel(5), took: true });
      g.events.emit('catchScored', { record: { speciesId: 'megalodon', level: 10, shiny: true, isRecord: true } });
      g.events.emit('coins', { delta: 5000, total: 9000 });
      g.events.emit('bite', { fish: fishOfLevel(9) });
      for (const n of ['hookSet', 'lineSnap', 'splash', 'landed', 'coins']) a.play(n, { size: 3, amount: 900 });
    }
  } });
  const stressTick = cases[cases.length - 1].tick;
  cases.push({ id: 'stress: same, all volumes at max', cat: 'stress', scene: { hour: 13, weather: 'storm', state: 'fight', fishLevel: 9, fishSize: 1, tension: 1.1, reelRate: -1, settings: { master: 1, music: 1, sfx: 1 } }, dur: 10, from: 0.5, ambience: true, music: true, tick: stressTick });
  {
    // landed path as the real fishing module does it: no fightEnd event, 'landing' with the fish still hooked,
    // then 'caught' + catch → catchScored. Exactly one landed stab; the fight score must not restart.
    const seen = new Set();
    let restarted = false, endedAt = -1;
    cases.push({ id: 'ev: landed (landing → caught, no fightEnd)', cat: 'fightstate', scene: { hour: 11, state: 'fight', fishLevel: 6, tension: 0.7, reelRate: 0.5, reeling: true }, dur: 9, from: 1, ambience: true, music: true,
      tick: (g, a, t) => {
        if (at(t, 3)) Object.assign(g.fishing, { state: 'landing', reelRate: 0, reeling: false, tension: 0.2 });
        if (at(t, 4.4)) {
          g.fishing.state = 'caught';
          g.events.emit('landed', { fish: g.fishing.hooked });
          g.events.emit('catch', { fish: g.fishing.hooked });
          g.events.emit('catchScored', { record: { speciesId: g.fishing.hooked.speciesId, level: 6, rarity: { id: 'rare' } } });
        }
        for (const v of a.mixer.voices) if (v.name === 'm_stab' && v.t > 2.95) seen.add(v);
        const f = a.debugState().music.fight;
        if (f === 'off' && endedAt < 0 && t > 3) endedAt = t;
        if (endedAt > 0 && f !== 'off') restarted = true;
      },
      verify: () => [...(seen.size !== 1 ? [`stabs ${seen.size}`] : []), ...(restarted ? ['fight restarted'] : []), ...(endedAt < 0 ? ['never ended'] : [])],
    });
  }
  if (Q.get('long') === '1') {
    // 5-minute soak across the day, a fight, a dive and back: bounded voices, no lag, sane silence/drift
    cases.push({ id: 'soak: 5 min music+ambience', cat: 'soak', scene: { hour: 11 }, dur: 300, from: 2, ambience: true, music: true, tick: (g, a, t) => {
      for (const [T, h] of [[50, 18.6], [100, 23], [150, 6.5], [200, 11]]) if (at(t, T)) g.env.setHour(h);
      if (at(t, 120)) Object.assign(g.fishing, { state: 'fight', hooked: fishOfLevel(7), tension: 0.8, reelRate: -0.5 });
      if (t > 120 && t < 160) g.fishing.tension = 0.7 + 0.35 * Math.sin(t * 1.3);
      if (at(t, 160)) {
        Object.assign(g.fishing, { state: 'caught', hooked: null, tension: 0, reelRate: 0 });
        g.events.emit('fightEnd', { result: 'landed' });
        g.events.emit('catchScored', { record: { speciesId: 'sailfish', level: 7 } });
      }
      if (t > 215 && t < 270) g.camera.y = Math.min(3200, 86 + (t - 215) * 120);
      if (t >= 270) g.camera.y = 86;
    } });
  }
  return cases;
}

const fmt = (v, w, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : String(v)).padStart(w);
async function runReport() {
  const status = document.getElementById('status');
  const only = Q.get('only');
  let cases = buildCases();
  if (only) {
    const re = new RegExp(only);
    cases = cases.filter((c) => re.test(c.id) || re.test(c.cat));
  }
  const rows = [];
  const failures = [];
  const notes = [];
  const T0 = performance.now();
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    status.textContent = `rendering ${i + 1}/${cases.length}: ${c.id}`;
    let r;
    try {
      r = await renderCase(c);
    } catch (e) {
      failures.push(`${c.id}: threw ${e && e.message}`);
      rows.push({ id: c.id, cat: c.cat, error: String(e && e.message) });
      continue;
    }
    const st = r.st;
    const isState = /state|stress|soak|ambstorm/.test(c.cat);
    const isCal = c.cat === 'cal' || c.cat === 'calhot';
    const lvl = isCal ? st.peakDb : isState ? st.integ : st.mmax;
    const [lo, hi] = EXPECT[c.cat] || [-60, -6];
    const probs = [];
    if (st.peak >= 0.98) probs.push('CLIP');
    if (st.knee > 0.001 && c.cat !== 'calhot') probs.push(`knee ${(st.knee * 100).toFixed(2)}%`);
    if (c.verify) probs.push(...c.verify());
    if (st.nan) probs.push('NaN');
    if (!(st.mmax > -60)) probs.push('SILENT');
    if (st.dc > 0.004) probs.push('DC');
    if (lvl < lo) probs.push('quiet');
    if (lvl > hi) probs.push('loud');
    if (r.endVoices > 0 && c.start && !c.tick && !c.ambience && !c.music) probs.push('leak?');
    if (c.cat === 'soak') {
      // 30-s windows of the momentary series → loudness drift; plus voices / lag / silence bounds
      const win = [];
      for (let i = 0; i + 300 <= st.blocks.length; i += 300) {
        let e = 0;
        for (let j = i; j < i + 300; j++) e += Math.pow(10, (st.blocks[j] + 0.691) / 10);
        win.push(-0.691 + 10 * Math.log10(e / 300));
      }
      const drift = Math.max(...win) - Math.min(...win);
      r.drift = drift;
      if (r.maxVoices > 70) probs.push(`voices ${r.maxVoices}`);
      if (r.lagMax > 0.05) probs.push(`lag ${r.lagMax.toFixed(2)}s`);
      if (st.silentRun > 35) probs.push(`silence ${st.silentRun.toFixed(0)}s`);
      if (drift > 14) probs.push(`drift ${drift.toFixed(1)} LU`);
      notes.push(`soak: max voices ${r.maxVoices}, max nodes ${r.maxNodes}, lag ${r.lagMax.toFixed(3)} s, longest silence ${st.silentRun.toFixed(1)} s, 30-s loudness range ${drift.toFixed(1)} LU [${win.map((x) => x.toFixed(0)).join(' ')}]`);
    }
    const row = { id: c.id, cat: c.cat, knee: st.knee, dur: r.dur, peakDb: st.peakDb, rmsDb: st.rmsDb, mmax: st.mmax, integ: st.integ, dc: st.dc, nan: st.nan, maxVoices: r.maxVoices, maxNodes: r.maxNodes, silentRun: st.silentRun, lagMax: r.lagMax, ms: r.ms, status: probs.length ? probs.join(',') : 'ok' };
    rows.push(row);
    if (probs.length) failures.push(`${c.id}: ${probs.join(',')} (L=${lvl.toFixed(1)} expect ${lo}..${hi}, peak ${st.peakDb.toFixed(1)} dBFS)`);
    if (i % 4 === 3) await new Promise((res) => setTimeout(res, 0));
  }
  // relative-loudness sanity
  const med = (cat, key = 'mmax') => {
    const v = rows.filter((r) => r.cat === cat && Number.isFinite(r[key])).map((r) => r[key]).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : NaN;
  };
  const rel = [];
  const ui = med('ui'), sfx = med('sfx'), fan = med('fanfare'), amb = med('ambstate', 'integ'), mus = med('musicstate', 'integ');
  const check = (label, ok) => {
    rel.push(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) failures.push('relative: ' + label);
  };
  if (Number.isFinite(ui) && Number.isFinite(sfx)) check(`UI median (${ui.toFixed(1)}) at least 6 LU under SFX median (${sfx.toFixed(1)})`, ui < sfx - 6);
  if (Number.isFinite(fan) && Number.isFinite(sfx)) check(`fanfare median (${fan.toFixed(1)}) above SFX median (${sfx.toFixed(1)})`, fan > sfx);
  if (Number.isFinite(fan) && Number.isFinite(amb)) check(`ambience median (${amb.toFixed(1)} I) at least 8 LU under fanfares (${fan.toFixed(1)})`, amb < fan - 8);
  if (Number.isFinite(mus) && Number.isFinite(fan)) check(`music median (${mus.toFixed(1)} I) at least 6 LU under fanfares (${fan.toFixed(1)})`, mus < fan - 6);

  const head = `${'case'.padEnd(34)} ${'cat'.padEnd(10)} ${'dur'.padStart(5)} ${'peak'.padStart(6)} ${'RMS'.padStart(6)} ${'Mmax'.padStart(6)} ${'I'.padStart(6)} ${'DC'.padStart(7)} ${'knee%'.padStart(6)} ${'vox'.padStart(4)} status`;
  const lines = [head, '-'.repeat(head.length)];
  for (const r of rows) {
    if (r.error) {
      lines.push(`${r.id.padEnd(34)} ${r.cat.padEnd(10)} ERROR ${r.error}`);
      continue;
    }
    lines.push(`${r.id.slice(0, 34).padEnd(34)} ${String(r.cat).padEnd(10)} ${fmt(r.dur, 5)} ${fmt(r.peakDb, 6)} ${fmt(r.rmsDb, 6)} ${fmt(r.mmax, 6)} ${fmt(r.integ, 6)} ${fmt(r.dc, 7, 4)} ${fmt(r.knee * 100, 6, 2)} ${fmt(r.maxVoices, 4, 0)} ${r.status}${r.silentRun > 0.5 ? ` silence≤${r.silentRun.toFixed(1)}s` : ''}`);
  }
  lines.push('', 'knee% = share of samples above the 0.8 soft-clip knee (limiter ceiling ≈ -1.6 dBFS) · peak/RMS in dBFS after the limiter · Mmax = max momentary (400 ms) loudness, I = integrated, both LUFS (K-weighted)');
  lines.push(...rel, ...notes);
  lines.push('', `${rows.length} cases in ${((performance.now() - T0) / 1000).toFixed(1)} s — ${failures.length ? failures.length + ' problem(s)' : 'all ok'}`);
  const table = lines.join('\n');
  const report = { ok: failures.length === 0, failures, table, rows };
  window.__audioReport = report;
  status.textContent = report.ok ? 'report: all ok' : `report: ${failures.length} problem(s)`;
  showReport(table, failures);
  return report;
}

// ── page ───────────────────────────────────────────────────────────────────────────────────────
const main = document.getElementById('main');
function section(title, wide) {
  const s = document.createElement('section');
  if (wide) s.className = 'wide';
  const h = document.createElement('h2');
  h.textContent = title;
  s.appendChild(h);
  main.appendChild(s);
  return s;
}
function showReport(table, failures) {
  let s = document.getElementById('report');
  if (!s) {
    s = section('Offline report', true);
    s.id = 'report';
  }
  s.querySelectorAll('pre').forEach((p) => p.remove());
  const pre = document.createElement('pre');
  pre.textContent = table + (failures.length ? '\n\nProblems:\n' + failures.join('\n') : '');
  s.appendChild(pre);
}

const live = { game: makeGame(), audio: null, last: 0 };
live.game.camera.y = 86;
function ensureLive() {
  if (!live.audio) {
    live.audio = createAudio(live.game, { seed: 99 });
    requestAnimationFrame(loop);
  }
  live.audio.unlock();
  return live.audio;
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = live.last ? Math.min(0.05, (now - live.last) / 1000) : 0.016;
  live.last = now;
  const g = live.game;
  if (!g.paused) {
    g.time.now += dt;
    g.time.dt = dt;
  }
  g.time.real += dt;
  live.audio.update(dt);
  const st = live.audio.debugState();
  const el = document.getElementById('dbg');
  if (el && g.time.frame++ % 15 === 0) el.textContent = JSON.stringify(st, null, 1);
}

function buildPage() {
  document.getElementById('start').onclick = () => ensureLive();
  document.getElementById('run').onclick = () => runReport();
  const g = live.game;
  const vol = document.getElementById('vol');
  vol.oninput = () => {
    g.settings.master = Number(vol.value);
    g.events.emit('settings', g.settings);
  };
  document.getElementById('mute').onchange = (e) => {
    g.settings.muted = e.target.checked;
    g.events.emit('settings', g.settings);
  };
  document.getElementById('pause').onchange = (e) => g.setPaused(e.target.checked);
  g.setPaused = (on) => {
    g.paused = on;
    g.events.emit('pause', { paused: on });
  };

  // one-shots, grouped by category
  const shots = section('One-shots — audio.play(name, opts)', true);
  const groups = {};
  for (const v of SFX_VARIANTS) {
    const cat = SFX[v.name].cat;
    if (!groups[cat]) {
      const div = document.createElement('div');
      div.className = 'group';
      div.innerHTML = `<div>${cat}</div><div class="grid"></div>`;
      shots.appendChild(div);
      groups[cat] = div.lastChild;
    }
    const b = document.createElement('button');
    b.textContent = v.label;
    b.title = `play('${v.name}', ${JSON.stringify(v.opts || {})})`;
    b.onclick = () => ensureLive().play(v.name, { ...(v.opts || {}) });
    groups[cat].appendChild(b);
  }

  // continuous inputs
  const cont = section('Continuous inputs (drive the fake game state)');
  const slider = (label, min, max, step, get, set, fmtv = (x) => x.toFixed(2)) => {
    const l = document.createElement('label');
    l.className = 'sl';
    l.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span></span>`;
    const inp = l.children[1], out = l.children[2];
    inp.value = get();
    out.textContent = fmtv(Number(inp.value));
    inp.oninput = () => {
      set(Number(inp.value));
      out.textContent = fmtv(Number(inp.value));
    };
    cont.appendChild(l);
    return inp;
  };
  const w = g.env.weather;
  slider('hour', 0, 23.9, 0.1, () => g.env.hour, (v) => g.env.setHour(v), (x) => `${x.toFixed(1)} h`);
  slider('sea', 0.3, 2.4, 0.01, () => w.sea, (v) => (w.sea = v));
  slider('wind', -1, 1, 0.01, () => w.wind, (v) => (w.wind = v));
  slider('rain', 0, 1, 0.01, () => w.rain, (v) => {
    w.rain = v;
    w.type = v > 0.85 ? 'storm' : v > 0.2 ? 'rain' : 'clear';
  });
  slider('depth (cam)', 0, 7100, 10, () => g.camera.y, (v) => (g.camera.y = v), (x) => `${(x / 8).toFixed(0)} m`);
  slider('x (cam/boat)', 0, 12000, 10, () => g.camera.x, (v) => {
    g.camera.x = v;
    g.boat.x = v - 180;
  }, (x) => x.toFixed(0));
  slider('throttle', -1, 1, 0.01, () => g.boat.throttle, (v) => {
    g.boat.throttle = v;
    g.boat.vx = v * 300;
  });
  slider('boat tier', 0, 2, 1, () => g.boat.tier, (v) => (g.boat.tier = v), (x) => x.toFixed(0));
  const f = g.fishing;
  slider('reel rate', -1, 1, 0.01, () => f.reelRate, (v) => {
    f.reelRate = v;
    f.reeling = v > 0.02;
  });
  slider('tension', 0, 1.25, 0.01, () => f.tension, (v) => (f.tension = v));
  slider('cast charge', 0, 1, 0.01, () => f.charge, (v) => (f.charge = v));
  slider('fight level', 0, 10, 1, () => 0, (v) => {
    f.hooked = v > 0 ? fishOfLevel(v) : null;
    if (v > 0 && f.state !== 'fight') {
      f.state = 'fight';
      g.events.emit('fightStart', { fish: f.hooked });
    }
    if (v === 0 && f.state === 'fight') {
      f.state = 'idle';
      g.events.emit('fightEnd', { fish: null, result: 'escaped' });
    }
  }, (x) => (x ? `lv ${x}` : 'none'));
  const sel = document.createElement('label');
  sel.className = 'sl';
  sel.innerHTML = `<span>fishing state</span><select>${['idle', 'charging', 'casting', 'waiting', 'bite', 'fight', 'landing', 'caught', 'broken'].map((s) => `<option>${s}</option>`).join('')}</select><span></span>`;
  sel.children[1].onchange = (e) => {
    const from = f.state;
    f.state = e.target.value;
    f.stateT = 0;
    g.events.emit('state', { from, to: f.state });
  };
  cont.appendChild(sel);
  const mode = document.createElement('label');
  mode.className = 'sl';
  mode.innerHTML = `<span>game mode</span><select><option>play</option><option>title</option></select><span></span>`;
  mode.children[1].onchange = (e) => {
    g.mode = e.target.value;
    if (g.mode === 'play') g.events.emit('gameStart', {});
  };
  cont.appendChild(mode);

  // events
  const evs = section('Events — game.events.emit(...)');
  const evb = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      ensureLive();
      fn();
    };
    evs.appendChild(b);
  };
  const E = (type, p) => g.events.emit(type, p);
  const fishAt = (lv) => {
    const fi = fishOfLevel(lv);
    fi.x = g.camera.x + 200;
    fi.y = 300;
    return fi;
  };
  evb('bite', () => E('bite', { fish: fishAt(4) }));
  evb('hookSet perfect', () => E('hookSet', { fish: fishAt(4), quality: 'perfect' }));
  evb('hookSet late', () => E('hookSet', { fish: fishAt(4), quality: 'late' }));
  evb('run', () => E('run', { fish: fishAt(6) }));
  evb('jump', () => E('jump', { fish: fishAt(7), x: g.camera.x + 150, y: -40 }));
  evb('splash 3 (breach)', () => E('splash', { x: g.camera.x + 150, y: 0, size: 3, kind: 'jump' }));
  evb('lineSnap', () => E('lineSnap', { fish: fishAt(6), x: g.camera.x, y: 200 }));
  evb('escape', () => E('escape', { fish: fishAt(5), reason: 'jump' }));
  evb('thunder close', () => E('thunder', { power: 1 }));
  evb('thunder far', () => E('thunder', { power: 0.55 }));
  for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
    const lv = { common: 1, uncommon: 3, rare: 5, epic: 7, legendary: 9, mythic: 10 }[r];
    evb(`catchScored ${r}`, () => E('catchScored', { record: { speciesId: fishOfLevel(lv).speciesId, level: lv, rarity: rarityOf(lv), points: 100 } }));
  }
  evb('catchScored shiny+record', () => E('catchScored', { record: { speciesId: 'mahi_mahi', level: 4, rarity: rarityOf(4), shiny: true, isRecord: true } }));
  evb('catchScored junk', () => E('catchScored', { record: { speciesId: 'old_boot', level: 0 } }));
  evb('catchScored chest', () => E('catchScored', { record: { speciesId: 'treasure_chest', level: 0 } }));
  evb('catchScored released', () => E('catchScored', { record: { speciesId: 'sea_turtle', level: 5, released: true } }));
  evb('coins +12', () => E('coins', { delta: 12, total: 100, reason: 'catch' }));
  evb('coins +450', () => E('coins', { delta: 450, total: 900, reason: 'catch' }));
  evb('levelUp', () => E('levelUp', { level: 5, title: 'Angler', unlocked: [] }));
  evb('questComplete', () => E('questComplete', { quest: {} }));
  evb('achievement', () => E('achievement', { achievement: {} }));
  for (let i = 1; i < ZONES.length; i++) evb(`zone → ${ZONES[i].id}`, () => E('zone', { from: ZONES[i - 1].id, to: ZONES[i].id }));
  evb('zone ↑ sunlit', () => E('zone', { from: 'twilight', to: 'sunlit' }));
  evb('biome → kelp', () => E('biome', { from: 'reef', to: 'kelp' }));
  evb('phase → dawn', () => E('phase', { from: 'night', to: 'dawn' }));
  evb('phase → dusk', () => E('phase', { from: 'day', to: 'dusk' }));
  evb('toast', () => E('toast', { text: 'hi', kind: 'info' }));

  const dbg = section('debugState()');
  const pre = document.createElement('pre');
  pre.id = 'dbg';
  pre.textContent = 'press Start audio';
  dbg.appendChild(pre);
}

buildPage();
if (Q.get('auto') === '1') runReport().catch((e) => {
  console.error('[lab] report failed', e);
  window.__audioReport = { ok: false, failures: ['report threw: ' + (e && e.message)], table: String(e && e.stack) };
});
export { WEATHER_TYPES };
