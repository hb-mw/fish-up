// Lightning bolts: on every 'lightning' event a branching bolt is generated (midpoint displacement + forks),
// pre-rendered ONCE into an offscreen canvas with its glow, then blitted additively while it fades (~0.25 s),
// re-brightening with the environment's re-flashes.
import { createRng } from '../../core/rng.js';
import { makeCanvas, sstep } from './util.js';

export function createLightning(game) {
  const env = game.env;
  const rng = createRng(6060);
  const bolts = [];
  let lastFl = 0;

  function displace(pts, rough, depth) {
    let cur = pts;
    for (let it = 0; it < depth; it++) {
      const next = [cur[0]];
      for (let i = 1; i < cur.length; i++) {
        const a = cur[i - 1], b = cur[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const off = (rng.next() - 0.5) * len * rough;
        next.push([(a[0] + b[0]) / 2 + (-dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off]);
        next.push(b);
      }
      cur = next;
      rough *= 0.92;
    }
    return cur;
  }

  /** Bolt geometry in local px (y down). Returns [{pts, w}] strokes. */
  function makeBolt(height) {
    const strokes = [];
    const endX = rng.range(-0.25, 0.25) * height;
    const main = displace([[0, 0], [endX * 0.4 + rng.range(-20, 20), height * 0.45], [endX, height]], 0.55, 6);
    strokes.push({ pts: main, w: 1 });
    // forks
    const nf = rng.int(3, 6);
    for (let f = 0; f < nf; f++) {
      const i = Math.floor(rng.range(0.08, 0.7) * main.length);
      const p = main[i];
      const remain = height - p[1];
      const len = remain * rng.range(0.25, 0.6);
      const dir = rng.chance(0.5) ? 1 : -1;
      const end = [p[0] + dir * len * rng.range(0.35, 0.8), p[1] + len * rng.range(0.6, 0.95)];
      const br = displace([p, end], 0.6, 5);
      strokes.push({ pts: br, w: rng.range(0.4, 0.6) });
      if (rng.chance(0.5)) {
        const j = Math.floor(rng.range(0.3, 0.7) * br.length);
        const q = br[j];
        const l2 = len * rng.range(0.25, 0.45);
        strokes.push({ pts: displace([q, [q[0] + dir * l2 * rng.range(0.2, 0.7), q[1] + l2]], 0.6, 4), w: 0.3 });
      }
    }
    return strokes;
  }

  function render(strokes, height, scale) {
    let x0 = 0, x1 = 0;
    for (const s of strokes) for (const p of s.pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
    }
    const pad = 14;
    const w = x1 - x0 + pad * 2, h = height + pad * 2;
    const c = makeCanvas(w * scale, h * scale), g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(pad - x0, pad);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const passes = [
      [11, 'rgba(150,170,255,0.06)'], [6, 'rgba(170,190,255,0.14)'], [3, 'rgba(210,220,255,0.45)'], [1.3, 'rgba(255,255,255,1)'],
    ];
    for (const [lw, col] of passes) {
      g.strokeStyle = col;
      for (const s of strokes) {
        g.lineWidth = lw * (0.35 + 0.65 * s.w);
        g.beginPath();
        g.moveTo(s.pts[0][0], s.pts[0][1]);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0], s.pts[i][1]);
        g.stroke();
      }
    }
    return { canvas: c, ox: pad - x0, w, h };
  }

  function spawn(e) {
    const F = game.mods.sky && game.mods.sky.frame;
    const k = F ? F.k : 1;
    const top = rng.range(250, 360);
    const height = top * k;
    const strokes = makeBolt(height);
    const img = render(strokes, height, game.view.scale);
    bolts.push({ x01: e && typeof e.x === 'number' ? e.x : 0.5, top, k, img, life: 1, power: (e && e.power) || 1 });
    if (bolts.length > 3) bolts.shift();
  }
  game.events.on('lightning', spawn);

  function update(dt) {
    const fl = env.weather.lightning;
    const reflash = fl > lastFl + 0.15;
    lastFl = fl;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= dt / 0.28;
      if (reflash && b.life > -0.6) b.life = Math.max(b.life, 0.75);
      if (b.life <= -0.6) bolts.splice(i, 1);
    }
  }

  function draw(ctx, F) {
    if (!bolts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bolts) {
      if (b.life <= 0) continue;
      const a = sstep(0, 0.6, b.life) * (0.7 + 0.3 * b.power);
      const x = b.x01 * F.W + F.sx;
      const yTop = F.hy - b.top * F.k;
      ctx.globalAlpha = a;
      ctx.drawImage(b.img.canvas, x - b.img.ox, yTop - 14, b.img.w, b.img.h);
    }
    ctx.restore();
  }

  /** Screen x of the most recent bolt (for cloud illumination), or null. */
  function lastX(F) {
    const b = bolts[bolts.length - 1];
    return b ? b.x01 * F.W + F.sx : null;
  }

  return { update, draw, lastX, spawn };
}
