// Dev sprite sheet for the seabed decoration painters.
//   dev/seabed-sprites.html?res=2&ids=brain,staghorn&bg=%231a6a8a&t=1.2&scale=1
import { TYPES, sprite, stamp, stampSway } from '../src/render/seabed/deco.js';
import '../src/render/seabed/catalog.js';

const q = new URLSearchParams(location.search);
const res = Number(q.get('res') || 2);
const ids = q.get('ids') ? q.get('ids').split(',') : null;
const bg = q.get('bg') || '#1a6a8a';
const tFixed = q.get('t') !== null ? Number(q.get('t')) : null;
const scale = Number(q.get('scale') || 1);

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
canvas.width = innerWidth * dpr;
canvas.height = innerHeight * dpr;
canvas.style.width = innerWidth + 'px';
canvas.style.height = innerHeight + 'px';

const list = [];
for (const t of TYPES.values()) {
  if (ids && !ids.includes(t.id)) continue;
  for (let v = 0; v < t.variants; v++) list.push({ t, v });
}

function draw(time) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const Z = res; // css px per world px (sprites shown at native resolution)
  const k = dpr * Z;
  let x = 20, y = 20, rowH = 0;
  const W = innerWidth;
  ctx.font = '11px ui-monospace,Menlo,monospace';
  for (const { t, v } of list) {
    const b = t.box;
    const w = (b.x1 - b.x0) * scale * Z, h = (b.y1 - b.y0) * scale * Z;
    if (x + w > W - 20) {
      x = 20;
      y += rowH + 26;
      rowH = 0;
    }
    const baseX = x - b.x0 * scale * Z, baseY = y - b.y0 * scale * Z;
    // ground line
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, baseY, w, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${t.id}:${v}`, x, y + h + 14);
    const spr = sprite(t, v, res);
    const M = { a: k, e: 0, f: 0 };
    const item = { t, v, x: baseX / Z, y: baseY / Z, s: scale, f: 1, ph: v * 1.7 };
    if (t.sway) {
      const tt = tFixed !== null ? tFixed : time / 1000;
      const sw = t.sway;
      stampSway(ctx, M, item, spr, 1, (hf) => sw.amp * Math.pow(hf, 1.5) * Math.sin(tt * sw.freq + item.ph - hf * sw.wave));
    } else stamp(ctx, M, item, spr, 1);
    x += w + 24;
    rowH = Math.max(rowH, h);
  }
  ctx.globalAlpha = 1;
  if (tFixed === null) requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
