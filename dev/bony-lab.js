// Bony-fish motion lab (dev only): one species drawn as a FILMSTRIP of consecutive animation frames, so a single
// screenshot shows how it moves.
//   dev/bony-lab.html?id=mahi_mahi&frames=8&dt=0.09&cols=4&len=320
//     &state=swim|hooked|flee|jump|idle…   &from=swim&switch=3  (frames before index `switch` use state `from` → shows the transition)
//     &amp=0.6  &mouth=0  &turn=1 (or turn=sweep: +1 → −1 across the strip)  &pitch=0  &seed=0.5
//     &bg=water|deep|dark|light  &detail=world|card  &shiny=1  &sil=1  &bounds=1  &t0=1  &rate=1 (tail-beat rate multiplier)
import { registerDrawers, getDrawer } from '../src/render/bestiary.js';

const q = new URLSearchParams(location.search);
const P = (k, d) => (q.get(k) !== null ? q.get(k) : d);
const N = (k, d) => (q.get(k) !== null ? Number(q.get(k)) : d);
const ids = P('id', 'yellowtail_snapper').split(',');
const frames = N('frames', 8), dt = N('dt', 0.09), t0 = N('t0', 1);
const state = P('state', 'swim'), from = P('from', state), sw = N('switch', 0);
const amp = N('amp', 0.6), mouth = N('mouth', 0), pitch = N('pitch', 0), seed = N('seed', 0.5);
const turnArg = P('turn', '1');
const bg = P('bg', 'water'), detail = P('detail', 'world');
const shiny = P('shiny', '0') === '1', sil = P('sil', '0') === '1', showBounds = P('bounds', '0') === '1';
const rate = N('rate', 1);

const mod = await import('../src/render/art/bonyfish.js');
registerDrawers(mod.DRAWERS);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = N('dpr', window.devicePixelRatio || 1);
const W = window.innerWidth, H = window.innerHeight;
canvas.width = Math.round(W * dpr);
canvas.height = Math.round(H * dpr);
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';
const BG = { water: ['#2ab0cc', '#0e5f9e'], deep: ['#06204a', '#01060f'], dark: ['#141c28', '#0a0f18'], light: ['#f2f6f8', '#dfe8ee'] };
const total = frames * ids.length;
const cols = N('cols', Math.ceil(Math.sqrt(total * (W / H) * 0.5)));
const rows = Math.ceil(total / cols);

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const c = BG[bg] || BG.water;
  g.addColorStop(0, c[0]);
  g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  let cell = 0;
  ids.forEach((id, k) => {
    const d = getDrawer(id);
    const b = d.bounds || { x0: -0.5, x1: 0.5, y0: -0.25, y1: 0.25 };
    const len = Math.min(N('len', 1e9), (cw * 0.9) / (b.x1 - b.x0), (ch * 0.8) / (b.y1 - b.y0));
    for (let i = 0; i < frames; i++, cell++) {
      const cx = (cell % cols) * cw + cw / 2, cy = Math.floor(cell / cols) * ch + ch / 2;
      const t = t0 + i * dt;
      const st = i < sw ? from : state;
      const turn = turnArg === 'sweep' ? 1 - (2 * i) / Math.max(1, frames - 1) : Number(turnArg);
      const anim = { t, phase: t * (2.4 + amp * 4) * rate, amp, seed, mouth, turn, state: st, hooked: st === 'hooked', uid: 100 + k };
      const opts = { detail, silhouette: sil, shiny, light: 1, pxScale: dpr };
      let dx = turn;
      if (dx > -0.14 && dx < 0.14) dx = dx < 0 ? -0.14 : 0.14;
      ctx.save();
      ctx.translate(cx - ((b.x0 + b.x1) / 2) * len * dx, cy - ((b.y0 + b.y1) / 2) * len);
      ctx.scale(dx, 1);
      if (pitch) ctx.rotate(pitch);
      try {
        d.draw(ctx, len, anim, opts);
      } catch (e) {
        if (!render.err) console.error(`[lab] ${id} threw:`, e);
        render.err = true;
      }
      if (showBounds) {
        ctx.strokeStyle = 'rgba(255,255,0,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x0 * len, b.y0 * len, (b.x1 - b.x0) * len, (b.y1 - b.y0) * len);
        const m = d.mouth || { x: 0.46, y: 0.02 };
        ctx.fillStyle = '#f0f';
        ctx.beginPath();
        ctx.arc(m.x * len, m.y * len, 3, 0, 6.3);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = bg === 'light' ? '#234' : 'rgba(255,255,255,0.75)';
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${id} · ${st} · t+${(i * dt).toFixed(2)}`, (cell % cols) * cw + 8, Math.floor(cell / cols) * ch + 16);
    }
  });
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
