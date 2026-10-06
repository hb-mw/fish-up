// Night sky: a seeded star field (varied size & colour temperature, twinkling in groups), a few bright stars
// with soft glints, a hint of the Milky Way, and the occasional shooting star.
// Stars are batched into cached Path2D groups (one fill per group) — no per-star draw calls.
import { createRng } from '../../core/rng.js';
import { makeCanvas, css, createNoiseTex, noiseAt, mod } from './util.js';

const FIELD_W = 3000; // sky px (wraps horizontally)
const FIELD_A = 1150; // altitude range covered
const TEMPS = [
  [176, 200, 255], // hot blue-white
  [214, 226, 255],
  [255, 255, 255],
  [255, 241, 214], // sun-like
  [255, 208, 160], // orange giant
];
const TEMP_W = [0.14, 0.28, 0.3, 0.2, 0.08];
const SIZES = [0.7, 1.05, 1.5];
const PHASES = 4;

export function createStars(game) {
  const env = game.env;
  const rng = createRng(31337);
  const groups = []; // {path, color(css), size, phase, speed, base}
  const bright = []; // {x, a, r, col, ph, sp}
  const shooting = { active: false, t: 0, life: 0, x: 0, a: 0, dx: 0, da: 0, len: 0, timer: game.flags && game.flags.shooting === '1' ? 0.3 : 6 };

  // Milky Way band: a gentle arc rising across the field
  // (a tilted arc that crosses the visible sky: low on one side, overhead in the middle)
  const bandAt = (x) => 40 + 470 * Math.pow(Math.sin((x / FIELD_W) * Math.PI), 1.3) + 90 * Math.sin((x / FIELD_W) * 6.283 + 0.6);
  const BAND_W = 78;

  // ── build star groups ─────────────────────────────────────────────────────
  const buckets = new Map();
  const N = 1300;
  for (let i = 0; i < N; i++) {
    let x = rng.range(0, FIELD_W), a = rng.range(8, FIELD_A);
    // denser inside the Milky Way
    if (rng.chance(0.3)) {
      x = rng.range(0, FIELD_W);
      a = bandAt(x) + rng.gaussian() * BAND_W * 0.35;
      if (a < 8 || a > FIELD_A) continue;
    }
    // magnitude: many faint, few bright
    const m = Math.pow(rng.next(), 2.6);
    const si = m > 0.55 ? 2 : m > 0.18 ? 1 : 0;
    let ti = 0;
    let r = rng.next();
    while (ti < TEMPS.length - 1 && r > TEMP_W[ti]) r -= TEMP_W[ti++];
    const ph = rng.int(0, PHASES - 1);
    const key = si * 100 + ti * 10 + ph;
    let b = buckets.get(key);
    if (!b) {
      b = { path: new Path2D(), color: css(TEMPS[ti]), size: SIZES[si], phase: ph * 1.7 + ti, speed: 1.2 + ph * 0.55 + si * 0.3, base: 0.45 + 0.25 * si, n: 0 };
      buckets.set(key, b);
    }
    const s = b.size;
    b.path.rect(x - s / 2, -a - s / 2, s, s);
    b.n++;
  }
  for (const b of buckets.values()) groups.push(b);
  // bright stars (drawn as small glints)
  for (let i = 0; i < 26; i++) {
    let ti = rng.int(0, TEMPS.length - 1);
    if (ti === 4 && rng.chance(0.5)) ti = 3;
    bright.push({ x: rng.range(0, FIELD_W), a: rng.range(60, FIELD_A * 0.85), r: rng.range(1.4, 2.6), ti, ph: rng.range(0, 6.28), sp: rng.range(1.5, 3.2) });
  }

  // glint sprite per colour temperature (soft core + faint cross)
  const glints = TEMPS.map((c) => {
    const S = 32;
    const cv = makeCanvas(S, S), g = cv.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, css([255, 255, 255], 1));
    grd.addColorStop(0.09, css(c, 0.95));
    grd.addColorStop(0.22, css(c, 0.28));
    grd.addColorStop(0.5, css(c, 0.06));
    grd.addColorStop(1, css(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    const sg = g.createLinearGradient(0, 0, S, 0);
    sg.addColorStop(0, css(c, 0));
    sg.addColorStop(0.5, css(c, 0.5));
    sg.addColorStop(1, css(c, 0));
    g.fillStyle = sg;
    g.fillRect(0, S / 2 - 0.5, S, 1);
    const sv = g.createLinearGradient(0, 0, 0, S);
    sv.addColorStop(0, css(c, 0));
    sv.addColorStop(0.5, css(c, 0.5));
    sv.addColorStop(1, css(c, 0));
    g.fillStyle = sv;
    g.fillRect(S / 2 - 0.5, 0, 1, S);
    return cv;
  });

  // ── Milky Way (low-res, soft) ────────────────────────────────────────────
  const milky = (() => {
    const W = 600, H = 230; // covers FIELD_W × FIELD_A
    const c = makeCanvas(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data;
    const tex = createNoiseTex(5150, 128, 5, 4, 0.55);
    for (let y = 0; y < H; y++) {
      const a = (1 - y / H) * FIELD_A;
      for (let x = 0; x < W; x++) {
        const fx = (x / W) * FIELD_W;
        const dist = (a - bandAt(fx)) / BAND_W;
        const core = Math.exp(-dist * dist * 1.6);
        if (core < 0.01) continue;
        const n1 = noiseAt(tex, x * 0.3, y * 0.6);
        const n2 = noiseAt(tex, x * 1.1 + 50, y * 1.9 + 20);
        // dark dust lane down the middle
        const lane = Math.exp(-Math.pow((dist + 0.1 + (n1 - 0.5) * 0.5) / 0.18, 2)) * (0.5 + 0.5 * n2);
        const clump = n1 * 0.65 + n2 * 0.55;
        let v = core * (clump <= 0.3 ? 0 : clump >= 0.95 ? 1 : ((clump - 0.3) / 0.65) * ((clump - 0.3) / 0.65)) * (1 - 0.85 * lane);
        v = Math.max(0, Math.min(1, v));
        const warm = 0.5 + 0.5 * Math.sin((fx / FIELD_W) * 6.28 + 1.2);
        const i = (y * W + x) * 4;
        d[i] = 190 + 50 * warm;
        d[i + 1] = 200 + 25 * warm;
        d[i + 2] = 255 - 30 * warm;
        d[i + 3] = 255 * v * 0.55;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  })();

  function update(dt) {
    const s = shooting;
    if (s.active) {
      s.t += dt;
      if (s.t >= s.life) s.active = false;
      return;
    }
    if (env.palette.stars < 0.5) return;
    s.timer -= dt;
    if (s.timer <= 0) {
      s.timer = game.flags && game.flags.shooting === '1' ? rng.range(1, 3) : rng.range(7, 22);
      s.active = true;
      s.t = 0;
      s.life = rng.range(0.55, 0.95);
      s.x = rng.range(0.1, 0.9);
      s.a = rng.range(200, 380);
      const ang = rng.range(0.35, 0.75) * (rng.chance(0.5) ? 1 : -1);
      const sp = rng.range(520, 820);
      s.dx = Math.sin(ang) * sp;
      s.da = -Math.cos(ang) * sp * 0.6;
      s.len = rng.range(90, 170);
    }
  }

  function draw(ctx, F) {
    const fogK = 1 - env.weather.fog * 0.92;
    const vis = env.palette.stars * fogK;
    if (vis < 0.01) return;
    const t = game.time.real;
    const drift = env.hour * 22 + F.sx; // the sky turns slowly through the night
    const off = mod(drift, FIELD_W);
    const skyH = Math.min(F.hy, F.H);
    ctx.save();
    // Milky Way
    ctx.globalAlpha = vis * 0.5;
    for (let rep = 0; rep < 2; rep++) {
      const x0 = -off + rep * FIELD_W;
      if (x0 > F.W || x0 + FIELD_W < 0) continue;
      ctx.drawImage(milky, x0, F.hy - FIELD_A * F.k, FIELD_W, FIELD_A * F.k);
    }
    // star groups
    for (let rep = 0; rep < 2; rep++) {
      const x0 = -off + rep * FIELD_W;
      if (x0 > F.W || x0 + FIELD_W < 0) continue;
      ctx.save();
      ctx.translate(x0, F.hy);
      ctx.scale(1, F.k);
      for (let i = 0; i < groups.length; i++) {
        const b = groups[i];
        const tw = 0.72 + 0.28 * Math.sin(t * b.speed + b.phase) * Math.sin(t * b.speed * 0.37 + b.phase * 2.1);
        ctx.globalAlpha = Math.min(1, vis * b.base * tw * 1.25);
        ctx.fillStyle = b.color;
        ctx.fill(b.path);
      }
      ctx.restore();
    }
    // bright glints
    for (let i = 0; i < bright.length; i++) {
      const s = bright[i];
      let x = s.x - off;
      if (x < -20) x += FIELD_W;
      if (x > F.W + 20) continue;
      const y = F.hy - s.a * F.k;
      if (y < -20 || y > skyH) continue;
      const tw = 0.68 + 0.32 * Math.sin(t * s.sp + s.ph) * Math.sin(t * s.sp * 0.43 + s.ph * 1.7);
      ctx.globalAlpha = vis * tw;
      const r = s.r * 6.5 * (0.9 + 0.2 * tw);
      ctx.drawImage(glints[s.ti], x - r, y - r, r * 2, r * 2);
    }
    // shooting star
    const sh = shooting;
    if (sh.active) {
      const k = sh.t / sh.life;
      const fade = Math.sin(Math.min(1, k) * Math.PI);
      const hx = sh.x * F.W + sh.dx * sh.t, hy = F.hy - (sh.a + sh.da * sh.t) * F.k;
      const len = Math.hypot(sh.dx, sh.da);
      const tx = hx - (sh.dx / len) * sh.len * (0.4 + 0.6 * k), ty = hy + ((sh.da / len) * sh.len * (0.4 + 0.6 * k)) * F.k;
      const grd = ctx.createLinearGradient(hx, hy, tx, ty);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.15, 'rgba(210,225,255,0.55)');
      grd.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.globalAlpha = vis * fade;
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glints[1], hx - 7, hy - 7, 14, 14);
    }
    ctx.restore();
  }

  /** Dev hook: launch a shooting star now. */
  function shoot() {
    shooting.timer = 0;
    shooting.active = false;
  }

  return { update, draw, shoot };
}
