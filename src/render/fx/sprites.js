// Pre-rendered soft sprites for the particle system (painted once at start-up), plus tinted copies.
// Particles never build gradients per frame: they blit one of these, scaled / rotated / alpha-faded.
//
// Sprites are addressed by a small integer index (stored per particle in a Uint16Array).
//   base(name)            → index of a white/neutral master sprite
//   tint(name, css)       → index of a multiplied (colour × master) copy, cached by colour (LRU-capped)
//   lit(name)             → index of a copy that follows the hour's ambient light (above-water spray / foam);
//                           relight(ambient) repaints those few copies in place when the light changes.
import { createRng } from '../../core/rng.js';

const TAU = Math.PI * 2;
const MAX_TINTS = 160;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Radial falloff sprite: stops = [[t, alpha], …] of white. */
function radial(size, stops, rgb = '255,255,255') {
  const c = canvas(size, size), g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [t, a] of stops) grad.addColorStop(t, `rgba(${rgb},${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function paintDrop() {
  const s = 32, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  let grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.42, 'rgba(236,249,255,0.95)');
  grad.addColorStop(0.7, 'rgba(196,232,250,0.55)');
  grad.addColorStop(1, 'rgba(180,225,250,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  grad = g.createRadialGradient(r - 4, r - 4, 0, r - 4, r - 4, 6);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/** A sheet of water: translucent body with a brighter rim — the walls of a splash crown / column. */
function paintSheet() {
  const s = 64, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.86)');
  grad.addColorStop(0.35, 'rgba(244,252,255,0.74)');
  grad.addColorStop(0.65, 'rgba(226,246,255,0.42)');
  grad.addColorStop(0.86, 'rgba(214,240,252,0.14)');
  grad.addColorStop(1, 'rgba(214,240,252,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

function paintBubble() {
  const s = 64, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  let grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(210,244,255,0.07)');
  grad.addColorStop(0.62, 'rgba(210,244,255,0.13)');
  grad.addColorStop(0.83, 'rgba(232,250,255,0.62)');
  grad.addColorStop(0.92, 'rgba(244,253,255,0.8)');
  grad.addColorStop(1, 'rgba(244,253,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // specular highlight (upper left) + faint bounce light (lower right)
  g.save();
  g.translate(r - r * 0.36, r - r * 0.4);
  g.rotate(-0.7);
  grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.scale(1, 0.62);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r * 0.3, 0, TAU);
  g.fill();
  g.restore();
  grad = g.createRadialGradient(r + r * 0.34, r + r * 0.4, 0, r + r * 0.34, r + r * 0.4, r * 0.18);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/** Lacy foam patch (white), wider than tall; drawn flattened on the surface. */
function paintFoam(seed) {
  const w = 128, h = 64, c = canvas(w, h), g = c.getContext('2d');
  const rng = createRng(seed);
  for (let i = 0; i < 70; i++) {
    // gaussian-ish cluster, denser in the middle
    const a = rng.next() * TAU, d = Math.pow(rng.next(), 0.7);
    const x = w / 2 + Math.cos(a) * d * w * 0.42, y = h / 2 + Math.sin(a) * d * h * 0.38;
    const rr = (1.5 + rng.next() * 6) * (1 - d * 0.5);
    const al = (0.25 + rng.next() * 0.55) * (1 - d * 0.7);
    if (rng.next() < 0.45) {
      g.strokeStyle = `rgba(255,255,255,${al})`;
      g.lineWidth = 0.8 + rng.next() * 1.4;
      g.beginPath();
      g.arc(x, y, rr * 1.4, rng.next() * TAU, rng.next() * TAU + 2);
      g.stroke();
    } else {
      const grad = g.createRadialGradient(x, y, 0, x, y, rr);
      grad.addColorStop(0, `rgba(255,255,255,${al})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
  // soft milky base so it reads as foam, not dots
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.32)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.save();
  g.translate(0, h / 2);
  g.scale(1, h / w);
  g.translate(0, -w / 2);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, w);
  g.restore();
  return c;
}

/** Thin ring (radius 56 of 64) with a gaussian profile; `soft` → wider, gentler pulse ring. */
function paintRing(soft) {
  const s = 128, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  const R = soft ? 50 : 56, hw = soft ? 11 : 3.2;
  const grad = g.createRadialGradient(r, r, Math.max(0, R - hw * 2.2), r, r, R + hw * 2.2);
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const d = (t - 0.5) * 4.4;
    grad.addColorStop(t, `rgba(255,255,255,${Math.exp(-d * d * 0.9).toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/** Four-point glint with a soft core and faint diagonal rays. */
function paintStar() {
  const s = 64, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  const ray = (len, wid, alpha) => {
    const grad = g.createLinearGradient(-len, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(0, -wid, len, 0);
    g.quadraticCurveTo(0, wid, -len, 0);
    g.fill();
  };
  g.translate(r, r);
  ray(r, 3.2, 1);
  g.rotate(Math.PI / 2);
  ray(r, 3.2, 1);
  g.rotate(Math.PI / 4);
  ray(r * 0.5, 1.6, 0.55);
  g.rotate(Math.PI / 2);
  ray(r * 0.5, 1.6, 0.55);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(-r, -r, s, s);
  return c;
}

/** Billowy cloud puff (white luminance, tinted later): soft overlapping lobes. */
function paintPuff(seed) {
  const s = 128, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  const rng = createRng(seed);
  for (let i = 0; i < 16; i++) {
    const a = rng.next() * TAU, d = Math.pow(rng.next(), 0.8) * 26;
    const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
    const rr = 16 + rng.next() * 20;
    const grad = g.createRadialGradient(x, y, 0, x, y, rr);
    const al = 0.16 + rng.next() * 0.2;
    grad.addColorStop(0, `rgba(255,255,255,${al})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${al * 0.6})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }
  // keep the edge fully transparent
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(r, r, r * 0.45, r, r, r);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m;
  g.fillRect(0, 0, s, s);
  return c;
}

function paintCoin() {
  const s = 40, c = canvas(s, s), g = c.getContext('2d'), r = s / 2;
  let grad = g.createRadialGradient(r - 6, r - 7, 1, r, r, r - 1);
  grad.addColorStop(0, '#fff6c2');
  grad.addColorStop(0.45, '#ffd25a');
  grad.addColorStop(0.85, '#e09a22');
  grad.addColorStop(1, '#9a5b12');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(r, r, r - 1.5, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(140,80,10,0.75)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(r, r, r - 6, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,250,215,0.7)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(r, r, r - 2.2, Math.PI * 1.05, Math.PI * 1.75);
  g.stroke();
  // little fish emblem
  g.fillStyle = 'rgba(150,88,14,0.8)';
  g.beginPath();
  g.ellipse(r + 1, r, 6.5, 3.8, 0, 0, TAU);
  g.moveTo(r - 4, r);
  g.lineTo(r - 9, r - 4);
  g.lineTo(r - 9, r + 4);
  g.closePath();
  g.fill();
  grad = g.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(r, r, r - 1.5, 0, TAU);
  g.fill();
  return c;
}

export function createSprites() {
  /** @type {HTMLCanvasElement[]} */
  const list = [];
  const names = new Map();
  const tints = new Map();
  const litList = [];
  let tintTick = 0;

  const add = (name, c) => {
    const i = list.length;
    list.push(c);
    if (name) names.set(name, i);
    return i;
  };
  add('soft', radial(64, [[0, 1], [0.22, 0.78], [0.45, 0.38], [0.7, 0.1], [1, 0]]));
  add('dot', radial(16, [[0, 1], [0.5, 0.65], [1, 0]]));
  add('drop', paintDrop());
  add('sheet', paintSheet());
  add('bubble', paintBubble());
  add('bubbleSmall', radial(16, [[0, 0.25], [0.55, 0.55], [0.8, 0.9], [1, 0]], '235,250,255'));
  for (let i = 0; i < 3; i++) add('foam' + i, paintFoam(101 + i * 17));
  add('ring', paintRing(false));
  add('pulse', paintRing(true));
  add('star', paintStar());
  for (let i = 0; i < 3; i++) add('puff' + i, paintPuff(7 + i * 31));
  add('coin', paintCoin());

  const base = (name) => names.get(name);

  /** Index of a multiplied copy of a master sprite (colour × sprite, alpha kept). */
  function tint(name, css) {
    const key = name + '|' + css;
    let e = tints.get(key);
    if (e) {
      e.used = ++tintTick;
      return e.idx;
    }
    const src = list[names.get(name)];
    let c, idx;
    if (tints.size >= MAX_TINTS) {
      // recycle the least recently used canvas (its index stays valid; old users just get the new colour)
      let oldKey = null, oldUsed = Infinity;
      for (const [k, v] of tints) if (v.used < oldUsed && v.name === name) { oldUsed = v.used; oldKey = k; }
      if (oldKey === null) return names.get(name);
      e = tints.get(oldKey);
      tints.delete(oldKey);
      c = list[e.idx];
      idx = e.idx;
    } else {
      c = canvas(src.width, src.height);
      idx = add(null, c);
    }
    paintTint(c, src, css);
    tints.set(key, { idx, used: ++tintTick, name });
    return idx;
  }
  function paintTint(c, src, css) {
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = css;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }

  /** A copy of `name` that follows the ambient light (see relight). */
  function lit(name) {
    const src = list[names.get(name)];
    const c = canvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    const idx = add(null, c);
    litList.push({ src, c });
    return idx;
  }
  let litKey = -1;
  /** Repaint the lit copies for an ambient colour [r,g,b] (cheap; only when it visibly changed). */
  function relight(amb) {
    const r = Math.min(255, amb[0] | 0), gg = Math.min(255, amb[1] | 0), b = Math.min(255, amb[2] | 0);
    const key = ((r >> 2) << 12) | ((gg >> 2) << 6) | (b >> 2);
    if (key === litKey) return;
    litKey = key;
    const css = `rgb(${r},${gg},${b})`;
    for (const e of litList) paintTint(e.c, e.src, css);
  }

  return { list, base, tint, lit, relight };
}
