// VFX lab (dev only): buttons + hotkeys for every effect and every event the effects/postfx modules react to.
// Open http://localhost:5173/dev/vfx-lab.html — click the scene for a splash (at the surface) or bubbles (below).
import { orientFish } from '../src/entities/fishbase.js';
import { RIG, boatToWorld } from '../src/entities/rig.js';

const wait = () => new Promise((r) => {
  const t = setInterval(() => {
    if (window.__game && document.documentElement.classList.contains('fishup-ready')) {
      clearInterval(t);
      r(window.__game);
    }
  }, 50);
});

const g = await wait();
const fx = () => g.fx;
const ev = (name, p) => g.events.emit(name, p);
const cx = () => g.camera.x + 120;
const surf = (x) => g.world.waves.heightAt(x);
const under = () => Math.max(surf(cx()) + 160, Math.min(g.camera.bounds.bottom - 200, g.camera.y + 60));
const pickFish = () => {
  const b = g.camera.bounds;
  const list = (g.fish && g.fish.list) || [];
  let best = null;
  for (const f of list) if (f.x > b.left && f.x < b.right && f.y > 0 && (!best || f.visualLen > best.visualLen)) best = f;
  return best || { x: cx(), y: under(), visualLen: 120, dir: 1, pitch: 0, vx: 0, vy: 0 };
};

/** Animate a fish leaping out of the water and falling back (tests the jump tracker: exit, spray, re-entry). */
function jumpTest() {
  const f = pickFish();
  if (!f.species) return;
  const x0 = f.x, dir = f.dir >= 0 ? 1 : -1, len = f.visualLen;
  const h = 120 + len * 0.6, dist = 220 + len * 0.8, T = 1.5;
  f.controlled = true;
  let t = 0, last = performance.now(), emitted = false;
  const y0 = surf(x0) + len * 0.6;
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt * g.time.scale;
    const k = Math.min(1, t / T);
    const px = x0 + dir * dist * k, py = y0 - (y0 + h) * 4 * k * (1 - k) + 60 * k * k;
    f.vx = (px - f.x) / Math.max(dt, 1e-3);
    f.vy = (py - f.y) / Math.max(dt, 1e-3);
    f.x = px;
    f.y = py;
    f.state = 'jump';
    orientFish(f, dt, { maxPitch: 1.3, turnRate: 12 });
    if (!emitted && f.y < surf(f.x)) {
      emitted = true;
      ev('jump', { fish: f, x: f.x, y: surf(f.x) });
    }
    if (k < 1) requestAnimationFrame(step);
    else {
      f.controlled = false;
      f.state = 'swim';
    }
  };
  requestAnimationFrame(step);
}

/** Hold a fish up at the boat's trophy point for a few seconds and emit 'landed' (water streaming off it). */
function landTest() {
  const f = pickFish();
  if (!f.species) return;
  f.controlled = true;
  const p = { x: 0, y: 0 };
  const t0 = performance.now();
  ev('landed', { fish: f });
  const step = (now) => {
    boatToWorld(g.boat, RIG.trophy.x, RIG.trophy.y, p);
    f.x = p.x;
    f.y = p.y - f.visualLen * 0.1;
    f.dir = g.boat.facing || 1;
    f.pitch = -1.45;
    f.state = 'landed';
    f.swimPhase += 0.25;
    if (now - t0 < 3200) requestAnimationFrame(step);
    else {
      f.controlled = false;
      f.state = 'swim';
      f.pitch = 0;
      f.y = 300;
    }
  };
  requestAnimationFrame(step);
}

function fakeLine(x, y) {
  const tip = g.boat.rod.tip, pts = g.fishing.line.points;
  pts.length = 0;
  for (let i = 0; i <= 16; i++) pts.push({ x: tip.x + (x - tip.x) * (i / 16), y: tip.y + (y - tip.y) * (i / 16) });
  setTimeout(() => (pts.length = 0), 600);
}
function lureAt(x, y) {
  const l = g.fishing.lure;
  l.x = x;
  l.y = y;
  l.inWater = true;
}

const ACTIONS = [
  ['Digit1', '1', 'Lure plop', () => fx().splash(cx() - 300, 0, 0.3, { kind: 'lure' })],
  ['Digit2', '2', 'Fish splash', () => fx().splash(cx() + 150, 0, 1)],
  ['Digit3', '3', 'Breach (size 3)', () => fx().splash(cx() + 420, 0, 3)],
  ['Digit4', '4', 'Bubbles', () => fx().bubbles(cx(), under(), 24, { spread: 16 })],
  ['Digit5', '5', 'Ink', () => fx().ink(cx() - 200, under(), 1.4)],
  ['Digit6', '6', 'Glowing ink', () => fx().ink(cx() + 200, under(), 1, '#59f0ff')],
  ['Digit7', '7', 'Sparkle', () => fx().sparkle(cx(), surf(cx()) - 160, 18, '#ffd86b')],
  ['Digit8', '8', 'Burst (additive)', () => fx().burst(cx(), surf(cx()) - 120, { n: 28, additive: true, color: '#9ff3ff', speed: 320 })],
  ['Digit9', '9', 'Confetti', () => fx().confetti(cx(), surf(cx()) - 200, 90)],
  ['Digit0', '0', 'Screen flash', () => fx().screenFlash('#ffffff', 0.5, 0.3)],
  ['KeyZ', 'Z', 'lureSplash', () => ev('lureSplash', { x: cx() + 260, y: 0, speed: 600 })],
  ['KeyX', 'X', 'twitch', () => ev('twitch', { x: cx(), y: under() })],
  ['KeyC', 'C', 'nibble', () => ev('nibble', { fish: null, x: cx(), y: under() })],
  ['KeyV', 'V', 'bite', () => (lureAt(cx(), under()), ev('bite', { fish: null }))],
  ['KeyB', 'B', 'hookSet perfect', () => ev('hookSet', { fish: pickFish(), quality: 'perfect' })],
  ['KeyN', 'N', 'hookSet good', () => ev('hookSet', { fish: pickFish(), quality: 'good' })],
  ['KeyM', 'M', 'hookSet late', () => ev('hookSet', { fish: pickFish(), quality: 'late' })],
  ['KeyG', 'G', 'run (bubble stream)', () => ev('run', { fish: pickFish() })],
  ['KeyJ', 'J', 'jump (scripted leap)', jumpTest],
  ['KeyH', 'H', 'landed (held at boat)', landTest],
  ['KeyT', 'T', 'tensionWarn', () => (fakeLine(cx() + 300, 260), ev('tensionWarn', { level: 1 }))],
  ['KeyK', 'K', 'lineSnap', () => ev('lineSnap', { fish: null, x: g.boat.rod.tip.x, y: g.boat.rod.tip.y })],
  ['KeyL', 'L', 'escape', () => ev('escape', { fish: pickFish(), reason: 'slack' })],
  ['KeyY', 'Y', 'predatorStrike', () => ev('predatorStrike', { predator: null, prey: pickFish(), took: true })],
  ['KeyU', 'U', 'catch: legendary trophy', () => ev('catchScored', { record: { speciesId: 'blue_marlin', level: 9, points: 18450, isNew: true, sizeQ: 0.97, rarity: { color: '#ffb52e' } } })],
  ['KeyI', 'I', 'catch: common', () => ev('catchScored', { record: { speciesId: 'sardine', level: 1, points: 9 } })],
  ['KeyO', 'O', 'coins +240', () => ev('coins', { delta: 240, total: 1000, reason: 'sale' })],
  ['KeyP', 'P', 'levelUp', () => ev('levelUp', { level: 7, title: 'Deckhand', unlocked: [] })],
  ['KeyF', 'F', 'lightning', () => ((g.env.weather.lightning = 0.9), ev('lightning', { x: 0.6, power: 0.9 }))],
  ['KeyR', 'R', 'lureBottom', () => ev('lureBottom', { x: cx(), y: g.world.terrain.heightAt(cx()) })],
  ['KeyQ', 'Q', 'zone (→ twilight)', () => (lureAt(cx(), under()), ev('zone', { from: 'sunlit', to: 'twilight' }))],
  ['KeyE', 'E', 'floatText', () => fx().floatText(cx(), surf(cx()) - 140, 'Fish Up!', { color: '#7fe7ff', size: 44, punch: 1 })],
];

// ── panel ──
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:50;width:250px;max-height:96vh;overflow:auto;background:rgba(6,18,31,0.82);color:#d6f5ff;font:12px/1.35 ui-monospace,Menlo,monospace;border-radius:10px;padding:8px;box-shadow:0 4px 18px rgba(0,0,0,0.4)';
const btn = (label, fn) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'margin:2px;padding:3px 6px;border:0;border-radius:6px;background:#1d4a6b;color:#e9fbff;font:inherit;cursor:pointer';
  b.onclick = (e) => {
    e.stopPropagation();
    fn();
  };
  return b;
};
const section = (title) => {
  const d = document.createElement('div');
  d.innerHTML = `<div style="margin:6px 0 2px;color:#8fd3ff;font-weight:bold">${title}</div>`;
  panel.appendChild(d);
  return d;
};
const fxSec = section('Effects & events (hotkeys)');
for (const [, key, label, fn] of ACTIONS) fxSec.appendChild(btn(`${key} ${label}`, fn));
const view = section('Scene');
const setPostfx = (on) => {
  if (!g.mods.postfx || !g.mods.postfx.ok) return;
  g.settings.postfx = on;
  g.glCanvas.style.display = on ? 'block' : 'none';
  g.sceneCanvas.style.display = on ? 'none' : 'block';
};
view.appendChild(btn('PostFX on/off', () => setPostfx(!g.settings.postfx)));
for (const q of ['low', 'medium', 'high']) view.appendChild(btn('pfx ' + q, () => g.mods.postfx && g.mods.postfx.setQuality(q)));
for (const [l, h] of [['noon', 12], ['golden', 19.2], ['night', 23], ['dawn', 6.3]]) view.appendChild(btn(l, () => g.env.setHour(h)));
for (const w of ['clear', 'storm', 'fog']) view.appendChild(btn(w, () => g.env.setWeather(w, true, true)));
const cam = (x, y, z) => {
  g.camera.free = true;
  g.camera.x = x;
  g.camera.y = y;
  g.camera.zoom = z;
};
view.appendChild(btn('cam surface', () => cam(g.boat.x + 180, 86, 1)));
view.appendChild(btn('cam deep', () => cam(9000, 4300, 1)));
view.appendChild(btn('cam zoom 0.5', () => cam(g.boat.x + 180, 200, 0.5)));
view.appendChild(btn('slow-mo', () => (g.time.scale = g.time.scale === 1 ? 0.25 : 1)));
view.appendChild(btn('pause', () => g.setPaused(!g.paused)));
view.appendChild(btn('bench postfx', () => {
  const b = g.mods.postfx && g.mods.postfx.bench(60);
  if (b) statsExtra = ` · pfx ${b.full.toFixed(2)} ms (passes ${b.passes.toFixed(2)})`;
}));
const stats = document.createElement('div');
stats.style.cssText = 'margin-top:6px;color:#bfe9ff;white-space:pre-wrap';
panel.appendChild(stats);
document.body.appendChild(panel);
let statsExtra = '';
setInterval(() => {
  const s = g.fx.stats ? g.fx.stats() : null;
  if (!s) return;
  stats.textContent = `particles ${s.particles}  screen ${s.screen}  texts ${s.texts}\nworld+glow ${(s.worldMs + s.glowMs).toFixed(2)} ms (peak ${s.peakMs.toFixed(2)})\nscreen ${s.screenMs.toFixed(2)} ms  gov ${s.governor.toFixed(2)}${statsExtra}\nfps ${g.time.fps.toFixed(0)}  postfx ${g.settings.postfx ? 'on' : 'off'} ${g.mods.postfx ? g.mods.postfx.quality : ''}`;
}, 250);

window.addEventListener('keydown', (e) => {
  const a = ACTIONS.find((x) => x[0] === e.code);
  if (a && !e.repeat) a[3]();
});
g.overlayCanvas.addEventListener('pointerdown', (e) => {
  const r = g.overlayCanvas.getBoundingClientRect();
  const sx = ((e.clientX - r.left) / r.width) * g.view.w, sy = ((e.clientY - r.top) / r.height) * g.view.h;
  const p = g.camera.screenToWorld(sx, sy, {});
  const s = surf(p.x);
  if (Math.abs(p.y - s) < 70) g.fx.splash(p.x, s, 1.2);
  else if (p.y > s) {
    g.fx.bubbles(p.x, p.y, 16, { spread: 12 });
    ev('bite', { x: p.x, y: p.y });
  } else g.fx.sparkle(p.x, p.y, 14, '#ffd86b');
});
