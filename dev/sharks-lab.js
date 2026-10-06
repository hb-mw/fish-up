// Dev lab for the SHARKS art set: sweep parameters the gallery cannot (mouth, turn, state, pitch) and log
// first-paint (sprite cache) cost per species.
//   dev/sharks-lab.html?ids=great_white,mako_shark&len=420
//     &cols=mouth:0,mouth:0.5,mouth:1      one column per param override, '/'-joined (keys: mouth turn amp state pitch seed len t shiny sil card)
//     &bg=water|deep|dark|light  &t=1.3 (fixed time)  &glow=0  &pxs=2 (pxScale)  &deep=1 (apply a deep-water fog)
import { SPECIES_BY_ID } from '../src/data/species.js';
import { DRAWERS } from '../src/render/art/sharks.js';

const q = new URLSearchParams(location.search);
const ids = (q.get('ids') || 'great_white').split(',');
const baseLen = Number(q.get('len') || 0);
const cols = (q.get('cols') || '').split(',').filter(Boolean).map((c) => {
  const o = {};
  for (const kv of c.split('/')) {
    const [k, v] = kv.split(':');
    o[k] = isNaN(Number(v)) ? v : Number(v);
  }
  return o;
});
if (!cols.length) cols.push({});
const bg = q.get('bg') || 'water';
const fixedT = q.get('t') !== null ? Number(q.get('t')) : null;
const glow = q.get('glow') !== '0';
const pxsArg = Number(q.get('pxs') || 0);
const deep = q.get('deep') === '1';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
let W = 0, H = 0;
function resize() {
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
}
addEventListener('resize', resize);
resize();
const BG = { water: ['#2ab0cc', '#0e5f9e'], deep: ['#06204a', '#01060f'], dark: ['#141c28', '#0a0f18'], light: ['#f2f6f8', '#dfe8ee'] };
const firstPaint = new Map();

// &bench=200 : draw every species N times at its median in-game size (scattered over the canvas, varying
// phase/mouth like a live scene), force a GPU flush, and log ms per draw (CPU+GPU) — drawGlow separately.
async function bench(N) {
  const { visualLength, lengthFor } = await import('../src/data/species.js');
  const out = [];
  for (const id of ids) {
    const d = DRAWERS[id];
    if (!d) continue;
    const sp = SPECIES_BY_ID[id];
    const len = visualLength(lengthFor(sp, 0.55));
    const run = (glowPass) => {
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        const tt = i * 0.037;
        const anim = { t: tt, phase: tt * 5, amp: 0.6, seed: (i % 7) / 7, mouth: i % 5 === 0 ? 0.4 : 0, turn: 1, state: 'swim', hooked: false, uid: i };
        const opts = { detail: 'world', silhouette: false, shiny: false, light: 1, pxScale: pxsArg || 1.33 };
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate((i * 97) % (W - 200) + 100, (i * 61) % (H - 200) + 100);
        if (glowPass) {
          ctx.globalCompositeOperation = 'lighter';
          d.drawGlow(ctx, len, anim, opts);
        } else d.draw(ctx, len, anim, opts);
        ctx.restore();
      }
      ctx.getImageData(0, 0, 1, 1);
      return (performance.now() - t0) / N;
    };
    run(false); // warm the sprite cache
    const ms = Math.min(run(false), run(false), run(false));
    const gms = d.drawGlow ? Math.min(run(true), run(true)) : 0;
    out.push(`${id} len${len.toFixed(0)}: ${ms.toFixed(3)} ms${d.drawGlow ? ` glow ${gms.toFixed(3)} ms` : ''}`);
  }
  console.log('[bench]\n' + out.join('\n'));
}
if (q.get('bench')) setTimeout(() => bench(Number(q.get('bench'))), 300);

function frame(now) {
  if (q.get('bench')) return;
  const t = fixedT !== null ? fixedT : now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, BG[bg][0]);
  g.addColorStop(1, BG[bg][1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cw = W / cols.length, ch = H / ids.length;
  ids.forEach((id, r) => {
    const d = DRAWERS[id];
    if (!d) return;
    cols.forEach((c, k) => {
      const b = d.bounds;
      const fit = Math.min((cw * 0.9) / (b.x1 - b.x0), (ch * 0.8) / (b.y1 - b.y0));
      const len = Math.min(c.len || baseLen || fit, fit);
      const cx = k * cw + cw / 2, cy = r * ch + ch / 2;
      const tt = c.t !== undefined ? c.t : t;
      const sweep = (v, f) => (v === 'sweep' ? f : v);
      const turn = sweep(c.turn !== undefined ? c.turn : 1, Math.cos(tt * 0.9));
      const mouth = sweep(c.mouth !== undefined ? c.mouth : 0, 0.5 - 0.5 * Math.cos(tt * 1.6));
      const amp = c.amp !== undefined ? c.amp : 0.6;
      // state:cycle alternates swim → hooked → flee every 1.5 s (checks that state flips never snap)
      const state = c.state === 'cycle' ? ['swim', 'hooked', 'flee'][Math.floor(tt / 1.5) % 3] : c.state || 'swim';
      const anim = { t: tt, phase: tt * (2.4 + amp * 4), amp, seed: c.seed !== undefined ? c.seed : 0.5, mouth, turn, state, hooked: state === 'hooked', uid: r * 10 + k + 1 }; // uid 0 = stateless UI icon
      const opts = { detail: c.card ? 'card' : 'world', silhouette: !!c.sil, shiny: !!c.shiny, light: 1, pxScale: pxsArg || dpr };
      const ox = cx - ((b.x0 + b.x1) / 2) * len, oy = cy - ((b.y0 + b.y1) / 2) * len;
      const t0 = performance.now();
      ctx.save();
      ctx.translate(ox, oy);
      let dd = turn;
      if (dd > -0.14 && dd < 0.14) dd = dd < 0 ? -0.14 : 0.14;
      ctx.scale(dd, 1);
      if (c.pitch) ctx.rotate(c.pitch);
      d.draw(ctx, len, anim, opts);
      ctx.restore();
      const ms = performance.now() - t0;
      const key = id + ':' + k;
      if (!firstPaint.has(key)) {
        firstPaint.set(key, ms);
        console.log(`[lab] first draw ${id} col${k} len ${len.toFixed(0)}: ${ms.toFixed(1)} ms`);
      }
      if (deep) {
        ctx.save();
        ctx.fillStyle = 'rgba(2,10,24,0.55)';
        ctx.fillRect(k * cw, r * ch, cw, ch);
        ctx.restore();
      }
      if (glow && d.drawGlow && !c.sil) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(ox, oy);
        ctx.scale(dd, 1);
        if (c.pitch) ctx.rotate(c.pitch);
        d.drawGlow(ctx, len, anim, opts);
        ctx.restore();
      }
      ctx.fillStyle = bg === 'light' ? '#123' : 'rgba(255,255,255,0.7)';
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${SPECIES_BY_ID[id]?.name || id} ${JSON.stringify(c)}`, cx, r * ch + ch - 8);
    });
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
