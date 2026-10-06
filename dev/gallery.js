// Dev gallery for creature art. KERNEL FILE.
//   dev/gallery.html?set=bony|sharks|creatures|all   &ids=a,b,c   (subset)
//     &mode=world|card|silhouette|sizes   world = in-game look at in-game size (default); card = big UI beauty render;
//                                         sizes = each species at its min / median / max size
//     &bg=water|deep|dark|light  &cols=6  &scale=1.5  &len=300 (force body length px)  &sizeQ=0.55
//     &state=swim|hooked|flee|...  &amp=0.6  &pitch=0.3  &flip=1  &freeze=1  &t=1.5 (fixed time)  &shiny=1
//     &glow=0 (skip additive pass)  &bounds=1 (show drawer.bounds + mouth anchor)  &perf=1 (ms per draw)
import { SPECIES, lengthFor, visualLength, formatLength } from '../src/data/species.js';
import { registerDrawers, getDrawer, hasDrawer, drawSpeciesIcon, drawShinySparkles } from '../src/render/bestiary.js';
import { rarityOf } from '../src/core/config.js';

const q = new URLSearchParams(location.search);
const P = (k, d) => (q.get(k) !== null ? q.get(k) : d);
const N = (k, d) => (q.get(k) !== null ? Number(q.get(k)) : d);
const setName = P('set', 'all');
const ids = q.get('ids') ? q.get('ids').split(',') : null;
const mode = P('mode', 'world');
const bg = P('bg', mode === 'card' ? 'dark' : 'water');
const scaleArg = N('scale', 1);
const fixedLen = N('len', 0);
const freeze = P('freeze', '0') === '1';
const fixedT = q.get('t') !== null ? Number(q.get('t')) : null;
const sizeQ = N('sizeQ', 0.55);
const state = P('state', 'swim');
const amp = N('amp', 0.6);
const pitch = N('pitch', 0);
const flip = P('flip', '0') === '1';
const glow = P('glow', '1') !== '0';
const shiny = P('shiny', '0') === '1';
const showBounds = P('bounds', '0') === '1';
const perf = P('perf', '0') === '1';

const ART = { bony: '../src/render/art/bonyfish.js', sharks: '../src/render/art/sharks.js', creatures: '../src/render/art/creatures.js' };
for (const key of Object.keys(ART)) {
  if (setName !== 'all' && setName !== key && !ids) continue;
  try {
    const mod = await import(ART[key]);
    registerDrawers(mod.DRAWERS);
  } catch (e) {
    console.warn(`[gallery] could not load ${ART[key]}:`, e.message);
  }
}

let list = SPECIES.filter((s) => (ids ? ids.includes(s.id) : setName === 'all' || s.set === setName));
if (ids) list = ids.map((id) => list.find((s) => s.id === id)).filter(Boolean);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = N('dpr', window.devicePixelRatio || 1);
let W = 0, H = 0;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
}
window.addEventListener('resize', resize);
resize();

const BG = {
  water: ['#2ab0cc', '#0e5f9e'],
  deep: ['#06204a', '#01060f'],
  dark: ['#141c28', '#0a0f18'],
  light: ['#f2f6f8', '#dfe8ee'],
};
const cellsPer = mode === 'sizes' ? 3 : 1;
const count = Math.max(1, list.length * cellsPer);
const cols = N('cols', mode === 'sizes' ? 3 : Math.ceil(Math.sqrt(count * (W / H) * 0.62)));
const rows = Math.ceil(count / cols);
const perfMs = new Map();

function drawOne(sp, cx, cy, cw, ch, q01, t, idx) {
  const d = getDrawer(sp.id);
  const realLen = lengthFor(sp, q01);
  let len = (fixedLen || visualLength(realLen)) * scaleArg;
  const b = d.bounds || { x0: -0.5, x1: 0.5, y0: -0.25, y1: 0.25 };
  const fit = Math.min((cw * 0.92) / (b.x1 - b.x0), (ch * 0.68) / (b.y1 - b.y0));
  let note = '';
  if (len > fit) {
    note = ` (shown ${(fit / len * 100).toFixed(0)}%)`;
    len = fit;
  }
  const oy = cy - 12;
  if (mode === 'card') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2 + 8, cy - ch / 2 + 8, cw - 16, ch - 16, 14);
    ctx.fill();
    drawSpeciesIcon(ctx, sp.id, cx, oy, cw * 0.84, ch * 0.62, { t, amp: 0.3, shiny, glow, pxScale: dpr, flip });
  } else {
    const anim = { t, phase: t * (2.4 + amp * 4), amp, seed: (idx * 0.37) % 1, mouth: state === 'bite' ? 0.7 : 0, turn: 1, state, hooked: state === 'hooked', uid: idx + 1 };
    const opts = { detail: 'world', silhouette: mode === 'silhouette', shiny, light: 1, pxScale: dpr };
    const ox = cx - ((b.x0 + b.x1) / 2) * len * (flip ? -1 : 1), oyy = oy - ((b.y0 + b.y1) / 2) * len;
    const t0 = performance.now();
    ctx.save();
    ctx.translate(ox, oyy);
    if (flip) ctx.scale(-1, 1);
    if (pitch) ctx.rotate(pitch);
    d.draw(ctx, len, anim, opts);
    ctx.restore();
    if (perf) perfMs.set(sp.id, (perfMs.get(sp.id) || 0) * 0.95 + (performance.now() - t0) * 0.05);
    if (glow && mode !== 'silhouette') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (d.drawGlow) {
        ctx.translate(ox, oyy);
        if (flip) ctx.scale(-1, 1);
        if (pitch) ctx.rotate(pitch);
        d.drawGlow(ctx, len, anim, opts);
      }
      ctx.restore();
      if (shiny) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawShinySparkles(ctx, ox, oyy, len, t, idx);
        ctx.restore();
      }
    }
    if (showBounds) {
      ctx.save();
      ctx.translate(ox, oyy);
      if (flip) ctx.scale(-1, 1);
      if (pitch) ctx.rotate(pitch);
      ctx.strokeStyle = 'rgba(255,255,0,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x0 * len, b.y0 * len, (b.x1 - b.x0) * len, (b.y1 - b.y0) * len);
      ctx.strokeStyle = 'rgba(255,0,255,0.8)';
      ctx.strokeRect(-len / 2, -2, len, 4);
      const m = d.mouth || { x: 0.46, y: 0.02 };
      ctx.fillStyle = '#f0f';
      ctx.beginPath();
      ctx.arc(m.x * len, m.y * len, 4, 0, 6.3);
      ctx.fill();
      ctx.restore();
    }
  }
  // label
  const light = bg === 'light';
  ctx.textAlign = 'center';
  ctx.fillStyle = light ? '#123' : 'rgba(255,255,255,0.95)';
  ctx.font = '600 14px -apple-system, system-ui, sans-serif';
  ctx.fillText(`${sp.name}${hasDrawer(sp.id) ? '' : '  ⚠ placeholder'}`, cx, cy + ch / 2 - 30);
  ctx.fillStyle = light ? '#456' : 'rgba(255,255,255,0.6)';
  ctx.font = '12px ui-monospace, Menlo, monospace';
  const ms = perf && perfMs.has(sp.id) ? `  ${perfMs.get(sp.id).toFixed(2)}ms` : '';
  ctx.fillText(`${sp.id} · Lv${sp.level} · ${formatLength(realLen)} → ${len.toFixed(0)}px${note}${ms}`, cx, cy + ch / 2 - 13);
  ctx.fillStyle = rarityOf(sp.level).color;
  ctx.fillRect(cx - 18, cy + ch / 2 - 8, 36, 3);
}

function frame(now) {
  const t = fixedT !== null ? fixedT : freeze ? 1.0 : now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const c = BG[bg] || BG.water;
  g.addColorStop(0, c[0]);
  g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  let cell = 0;
  list.forEach((sp, i) => {
    const qs = mode === 'sizes' ? [0, 0.5, 1] : [sizeQ];
    for (const q01 of qs) {
      const cx = (cell % cols) * cw + cw / 2, cy = Math.floor(cell / cols) * ch + ch / 2;
      try {
        drawOne(sp, cx, cy, cw, ch, q01, t, i);
      } catch (e) {
        if (!frame.errs) frame.errs = new Set();
        if (!frame.errs.has(sp.id)) {
          frame.errs.add(sp.id);
          console.error(`[gallery] ${sp.id} threw:`, e);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ff6a5a';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${sp.id}: ${e.message}`, cx, cy);
      }
      cell++;
    }
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
