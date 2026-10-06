// Common octopus (Octopus vulgaris). Two poses blended per individual:
//   crawl (state 'crawl'/'idle'/lure states/'icon'): mantle raised up-back, arms flowing over the ground (feet at y≈+0.05)
//   jet   ('swim'/'flee'/'hooked'/'landed'): mantle-first (+X), arms trailing in a bundle.
// len = total length. Body = cached sprites (one per pose × two mottle states, cross-faded so the skin shifts);
// arms = live tapered limbs with sucker rows.
import { TAU, clamp, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, blurred, speckle } from './kit.js';
import { paintCephEye, AXs, AYs, fillArm, suckers } from './cephkit.js';

const BOX = { x0: -0.32, x1: 0.5, y0: -0.48, y1: 0.18 };
const TH_C = -1.95, TH_J = 0; // mantle axis angle per pose
const HC = [0.06, -0.165], HJ = [0.12, -0.07]; // head centre per pose
const CC = [0.08, -0.075], CJ = [0.05, -0.07]; // arm crown per pose
const PAL = palette({
  arm: '#c46a43',
  armFar: '#8e4630',
  armHi: ['#f6c49a', 0.5],
  sucker: ['#f4cdb0', 0.85],
  suckerRim: ['#8a3c28', 0.8],
});
const SKIN = [
  ['#f0aa78', '#c4663f', '#6c2a1c'],
  ['#de7650', '#a33c28', '#541612'],
];

function paintBody(g, res, jet, flush) {
  const th = jet ? TH_J : TH_C;
  const ax = Math.cos(th), ay = Math.sin(th);
  const ds = jet ? -1 : 1;
  const nx = -ay * ds, ny = ax * ds; // dorsal normal
  const [light, mid, dark] = SKIN[flush];
  const rng = createRng(jet ? 41 : 42);
  const mcx = ax * 0.2, mcy = ay * 0.2;
  const shape = () => {
    g.beginPath();
    g.ellipse(mcx, mcy, 0.21, 0.125, th, 0, TAU);
    g.moveTo(ax * 0.01 + ax * 0.1, ay * 0.01 + ay * 0.1);
    g.ellipse(ax * 0.01, ay * 0.01, 0.1, 0.108, th, 0, TAU);
  };
  shape();
  const gr = g.createRadialGradient(mcx - 0.04, mcy - 0.13, 0.02, mcx, mcy, 0.34);
  gr.addColorStop(0, light);
  gr.addColorStop(0.45, mid);
  gr.addColorStop(1, dark);
  g.fillStyle = gr;
  g.fill();
  g.save();
  shape();
  g.clip();
  // mottling: dark reticulation, cream spots, papillae
  for (let i = 0; i < 46; i++) {
    const u = rng.next() * 0.42 - 0.08, v = (rng.next() - 0.5) * 0.24;
    g.fillStyle = flush ? `rgba(70,12,8,${0.12 + rng.next() * 0.16})` : `rgba(90,30,14,${0.08 + rng.next() * 0.12})`;
    g.beginPath();
    g.ellipse(ax * u - ay * v, ay * u + ax * v, 0.012 + rng.next() * 0.03, 0.008 + rng.next() * 0.016, rng.next() * 3, 0, TAU);
    g.fill();
  }
  speckle(g, rng, -0.3, -0.48, 0.5, 0.15, 70, 0.003, 0.009, flush ? ['rgba(255,236,214,0.7)'] : ['rgba(255,232,206,0.45)']);
  for (let i = 0; i < 60; i++) {
    const u = rng.next() * 0.4 - 0.05, v = (rng.next() - 0.5) * 0.22;
    const x = ax * u - ay * v, y = ay * u + ax * v, r = 0.004 + rng.next() * 0.005;
    g.fillStyle = 'rgba(60,16,8,0.25)';
    g.beginPath();
    g.arc(x + r * 0.3, y + r * 0.5, r, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,214,180,0.35)';
    g.beginPath();
    g.arc(x - r * 0.2, y - r * 0.3, r * 0.75, 0, TAU);
    g.fill();
  }
  // wet sheen along the top of the mantle
  blurred(g, res, 0.014, () => {
    g.fillStyle = 'rgba(255,240,226,0.42)';
    g.beginPath();
    g.ellipse(mcx + nx * 0.06 - 0.01, mcy - 0.06, 0.12, 0.03, th + (jet ? 0 : 0.3), 0, TAU);
    g.fill();
  });
  g.restore();
  // siphon on the ventral side, by the head
  g.fillStyle = mid;
  g.beginPath();
  g.ellipse(ax * 0.07 - nx * 0.085, ay * 0.07 - ny * 0.085, 0.034, 0.02, th + 0.5 * ds, 0, TAU);
  g.fill();
  // eye in a raised socket with a little horn above it
  const ex = ax * 0.0 + nx * 0.048, ey = ay * 0.0 + ny * 0.048;
  g.fillStyle = mid;
  g.beginPath();
  g.ellipse(ex, ey, 0.046, 0.04, th, 0, TAU);
  g.fill();
  paintCephEye(g, res, ex, ey, 0.028, {
    iris: '#d9a645', irisLight: '#ffe39a', irisDark: '#5e3a10', pupil: 'slit', pupilR: 0.55,
    ring: 'rgba(80,26,12,0.5)', lid: flush ? 'rgba(164,62,40,0.85)' : 'rgba(196,102,63,0.8)',
  });
  g.fillStyle = mid;
  g.beginPath();
  g.moveTo(ex + nx * 0.03 - ax * 0.012, ey + ny * 0.03 - ay * 0.012);
  g.lineTo(ex + nx * 0.062, ey + ny * 0.062);
  g.lineTo(ex + nx * 0.03 + ax * 0.014, ey + ny * 0.03 + ay * 0.014);
  g.closePath();
  g.fill();
}

// arm layout: [crawl base heading, ground direction (+1 fwd / −1 back), length, jet heading offset]
const NEAR = [[0.35, 1, 0.58, -0.17], [1.15, 1, 0.5, -0.06], [1.95, -1, 0.5, 0.06], [2.75, -1, 0.56, 0.17]];
const FAR = [[0.62, 1, 0.5, -0.12], [1.38, 1, 0.46, -0.03], [1.75, -1, 0.46, 0.04], [2.5, -1, 0.52, 0.13]];
const N = 13;
const ss = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const WX = new Float32Array(8), WY = new Float32Array(8);

function drawArms(ctx, len, anim, b, h, set, far, P, card, lenPx) {
  const t = anim.t, ph = anim.phase, amp = clamp(anim.amp, 0.2, 1.5);
  const cx = (CC[0] + (CJ[0] - CC[0]) * b) * len, cy = (CC[1] + (CJ[1] - CC[1]) * b) * len;
  const ground = 0.045 * len;
  const w0 = (far ? 0.062 : 0.072) * len, w1 = 0.005 * len;
  const sd = far ? 1.3 : 0;
  for (let i = 0; i < set.length; i++) {
    const [a0, dir, L, jo] = set[i];
    const seg = (L * len) / (N - 1);
    let x = cx + Math.cos(a0) * 0.03 * len * (1 - b), y = cy + Math.sin(a0) * 0.012 * len * (1 - b);
    const curl = -dir * 3.4 * (0.7 + 0.3 * Math.sin(t * 0.6 + i * 2 + sd));
    // the leading near arm lifts and explores now and then
    const explore = !far && i === 0 ? 0.75 * ss(0.2, 0.9, 0.5 + 0.5 * Math.sin(t * 0.45 + anim.seed * 9)) : 0;
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1);
      // crawl: dive to the ground, run along it, curl the tip into a hook; a slow exploring wave on top
      const gdir = (dir > 0 ? 0.04 : Math.PI - 0.04) - explore * dir;
      const cu = Math.pow(Math.max(0, (u - 0.62) / 0.38), 1.6);
      const hc = a0 + (gdir - a0) * ss(0.04, 0.38, u) + curl * cu + 0.2 * Math.sin(t * 1.1 + i * 1.7 + sd - u * 4) * u;
      // jet: trailing bundle with a travelling undulation (stronger, faster when hooked)
      const wv = (0.16 + 0.1 * amp) * Math.sin(ph * 0.9 - u * 5 + i * 0.8 + sd) * u + h * 0.65 * Math.sin(t * 5.5 + i * 2.1 - u * 6) * u;
      const hj = Math.PI + jo * (1.3 - u) + wv;
      const hd = hc + (hj - hc) * b;
      AXs[k] = x;
      AYs[k] = y;
      x += Math.cos(hd) * seg;
      y += Math.sin(hd) * seg;
      if (y > ground) y += (ground - y) * (1 - b) * (1 - explore);
    }
    WX[i] = AXs[2];
    WY[i] = AYs[2];
    fillArm(ctx, N, w0, w1, far ? P.armFar : P.arm, far ? null : P.armHi, w0 * 0.18);
    if (!far && (card || lenPx > 110)) {
      // suckers on the oral side: the lower edge (left edge for a rightward arm)
      const side = AXs[N - 1] > AXs[0] ? -1 : 1;
      ctx.beginPath();
      suckers(ctx, N, w0, w1, side, card ? 2 : 1, 2);
      ctx.fillStyle = P.suckerRim;
      ctx.fill();
      if (card) {
        ctx.save();
        ctx.translate(-0.002 * len, -0.002 * len);
        ctx.beginPath();
        suckers(ctx, N, w0 * 0.8, w1, side, 2, 2);
        ctx.fillStyle = P.sucker;
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

/** Webbing between the bases of the arm set just drawn (scalloped toward the crown). */
function drawWeb(ctx, len, b, fill) {
  const cx = (CC[0] + (CJ[0] - CC[0]) * b) * len, cy = (CC[1] + (CJ[1] - CC[1]) * b) * len;
  // muscular arm crown merging into the head
  ctx.beginPath();
  ctx.ellipse(cx, cy - 0.01 * len, 0.085 * len, (0.05 + 0.02 * b) * len, b * 0.2, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(WX[0], WY[0]);
  for (let i = 1; i < 4; i++) {
    const mx = (WX[i - 1] + WX[i]) * 0.5, my = (WY[i - 1] + WY[i]) * 0.5;
    ctx.quadraticCurveTo(mx + (cx - mx) * 0.3, my + (cy - my) * 0.3, WX[i], WY[i]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBody(ctx, len, anim, opts, b, lenPx, flushA) {
  const th = TH_C + (TH_J - TH_C) * b;
  const hx = (HC[0] + (HJ[0] - HC[0]) * b) * len, hy = (HC[1] + (HJ[1] - HC[1]) * b) * len;
  const breathe = 1 + 0.025 * Math.sin(anim.phase * (b > 0.5 ? 1 : 0.5));
  for (let pose = 0; pose < 2; pose++) {
    const w = pose ? ss(0, 1, b) : 1;
    if ((pose === 0 && b > 0.999) || (pose === 1 && b < 0.001)) continue;
    const base = variant(unitSprite('oc_b' + pose + '0', BOX, lenPx, (g, r) => paintBody(g, r, pose === 1, 0)), opts);
    const fl = variant(unitSprite('oc_b' + pose + '1', BOX, lenPx, (g, r) => paintBody(g, r, pose === 1, 1)), opts);
    ctx.save();
    ctx.globalAlpha *= w;
    ctx.translate(hx, hy);
    ctx.rotate(th - (pose ? TH_J : TH_C));
    ctx.scale(breathe, 1 / breathe);
    if (pose) ctx.scale(1 + 0.1 * b, 1 - 0.08 * b); // streamlined when jetting
    drawUnitSprite(ctx, base, len);
    if (flushA > 0.01 && !opts.silhouette) {
      ctx.globalAlpha *= flushA;
      drawUnitSprite(ctx, fl, len);
    }
    ctx.restore();
  }
}

const JET_STATES = { swim: 1, flee: 1, hooked: 1, landed: 1, jump: 1 };

export const DRAWERS = {
  octopus: {
    bounds: { x0: -0.64, x1: 0.64, y0: -0.63, y1: 0.1 },
    mouth: { x: 0.07, y: -0.06 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const card = opts.detail === 'card';
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const b = easePose(anim, 0, JET_STATES[anim.state] ? 1 : 0, 3.2);
      const h = easePose(anim, 1, hooked ? 1 : 0, 4);
      const f0 = 0.5 + 0.5 * Math.sin(anim.t * 0.33 + anim.seed * 6.28);
      const flushA = Math.max(ss(0.15, 0.85, f0), h);
      ctx.save();
      drawArms(ctx, len, anim, b, h, FAR, true, P, card, lenPx);
      drawWeb(ctx, len, b, P.armFar);
      drawBody(ctx, len, anim, opts, b, lenPx, flushA);
      drawArms(ctx, len, anim, b, h, NEAR, false, P, card, lenPx);
      drawWeb(ctx, len, b, P.arm);
      ctx.restore();
    },
  },
};
