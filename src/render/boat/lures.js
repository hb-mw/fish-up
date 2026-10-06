// The nine lures as little jewels, drawn procedurally on ANY 2D context. BOAT ART module.
//
//   drawLure(ctx, lureId, x, y, size, angle, t)
//     x, y   centre of the drawing        size  approximate total length in px (tie ring → tail)
//     angle  rotation (radians). Local +x is the lure's HEAD — the line tie / swivel end.
//     t      seconds (animation: wriggling, spinning blades, kicking tails …)
//
//   drawLureGlow(ctx, lureId, x, y, size, angle, t, moving)   additive pass ('lighter') — halo + flash glints
//   lureTieOffset(lureId)  → distance (in units of size) from the centre to the tie ring along +x (0.5)
//
// Internally every lure is designed in a 100-unit box: x ∈ [−50, 50] (tie ring at +50), y ∈ [−30, 30].
import { TAU, clamp } from '../../core/math.js';
import { LURES_BY_ID } from '../../data/lures.js';

const DRAW = {};

/** @param {CanvasRenderingContext2D} ctx */
export function drawLure(ctx, lureId, x, y, size, angle = 0, t = 0) {
  const fn = DRAW[lureId] || DRAW.worm;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  const s = size / 100;
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fn(ctx, t, s);
  ctx.restore();
}

export function lureTieOffset() {
  return 0.5;
}

// ── shared bits ──────────────────────────────────────────────────────────────
function leader(ctx, x0, x1) {
  // monofilament leader + barrel swivel + tie ring at +50
  ctx.strokeStyle = 'rgba(225,235,240,0.85)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(Math.min(x1, 39), 0);
  ctx.stroke();
  // swivel rings
  ctx.strokeStyle = '#8d959b';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(39.5, 0, 2, 1.6, 0, 0, TAU);
  ctx.moveTo(49.6, 0);
  ctx.ellipse(48, 0, 2, 1.6, 0, 0, TAU);
  ctx.stroke();
  // barrel
  const g = ctx.createLinearGradient(0, -2.6, 0, 2.6);
  g.addColorStop(0, '#f2e2b0');
  g.addColorStop(0.45, '#b8913f');
  g.addColorStop(1, '#5f4417');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(43.8, 0, 3.4, 2.5, 0, 0, TAU);
  ctx.fill();
}

/** A J hook: eye at (ex, ey), shank to (bx, by), bend downward with radius r, point rising back toward +x. */
function jHook(ctx, ex, ey, bx, r, w = 2.1, gauge = '#7d858c', barb = true) {
  ctx.lineCap = 'round';
  // eye
  ctx.strokeStyle = gauge;
  ctx.lineWidth = w * 0.8;
  ctx.beginPath();
  ctx.arc(ex + 2.2, ey, 2.1, 0, TAU);
  ctx.stroke();
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(bx, ey);
    ctx.arc(bx, ey + r, r, -Math.PI / 2, Math.PI / 2, true);
    ctx.quadraticCurveTo(bx + r * 1.05, ey + 2 * r, bx + r * 1.15, ey + r * 0.45);
  };
  ctx.strokeStyle = '#3c4247';
  ctx.lineWidth = w;
  path();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,242,248,0.85)';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(ex - 1, ey - w * 0.2);
  ctx.lineTo(bx, ey - w * 0.2);
  ctx.arc(bx, ey + r, r - w * 0.2, -Math.PI / 2, Math.PI * 0.9, true);
  ctx.stroke();
  if (barb) {
    const px = bx + r * 1.15, py = ey + r * 0.45;
    ctx.fillStyle = '#3c4247';
    ctx.beginPath();
    ctx.moveTo(px + 0.5, py - 1.2);
    ctx.lineTo(px - 2.2, py + 3.4);
    ctx.lineTo(px - 0.4, py + 2.8);
    ctx.closePath();
    ctx.fill();
  }
}

function glossDot(ctx, x, y, rx, ry, a = 0.7) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.3, 0, TAU);
  ctx.fill();
}

// ── 1. Garden worm, threaded on a hook, both ends wriggling ─────────────────
const _wx = new Float32Array(40), _wy = new Float32Array(40);
function wormStroke(ctx, n, width, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(_wx[0], _wy[0]);
  for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(_wx[i], _wy[i], (_wx[i] + _wx[i + 1]) / 2, (_wy[i] + _wy[i + 1]) / 2);
  ctx.lineTo(_wx[n - 1], _wy[n - 1]);
  ctx.stroke();
}
DRAW.worm = (ctx, t) => {
  leader(ctx, 26, 40);
  // the hook first: the shank & bend are hidden inside the threaded worm, the point pokes out
  const bx = -12, by = 10, br = 9;
  // worm path: dangling front end → threaded along the shank → around the bend → wriggling tail
  const n = 34;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    let x, y;
    if (k < 0.16) {
      const q = k / 0.16; // front end hangs below the eye
      const w = Math.sin(t * 5.4 + q * 4) * 3.2 * (1 - q);
      x = 13 + w + q * 5;
      y = 21 - q * 19.5;
    } else if (k < 0.5) {
      const q = (k - 0.16) / 0.34;
      x = 18 - q * 30;
      y = 1.5 + Math.sin(q * 6 + t * 1.5) * 0.4;
    } else if (k < 0.72) {
      const q = (k - 0.5) / 0.22; // around the bend (outside it)
      const ang = -Math.PI / 2 - q * Math.PI;
      x = bx + Math.cos(ang) * (br + 0.6);
      y = by + Math.sin(ang) * (br + 0.6);
    } else {
      const q = (k - 0.72) / 0.28; // the free tail, wriggling
      const wig = Math.sin(t * 6.6 - q * 7.5) * q * 6.5;
      x = bx - 2 - q * 22 + wig * 0.5;
      y = by + br + 1 + q * 9 + wig;
    }
    _wx[i] = x;
    _wy[i] = y;
  }
  wormStroke(ctx, n, 8.6, '#73291f');
  wormStroke(ctx, n, 7.2, '#cf6a5c');
  // segment rings
  ctx.strokeStyle = 'rgba(115,38,30,0.5)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const dx = _wx[i + 1] - _wx[i - 1], dy = _wy[i + 1] - _wy[i - 1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    ctx.moveTo(_wx[i] + nx * 3.3, _wy[i] + ny * 3.3);
    ctx.lineTo(_wx[i] - nx * 3.3, _wy[i] - ny * 3.3);
  }
  ctx.stroke();
  // clitellum (the saddle band) on the tail
  ctx.strokeStyle = '#ec9c84';
  ctx.lineWidth = 8.2;
  ctx.beginPath();
  ctx.moveTo(_wx[26], _wy[26]);
  ctx.lineTo(_wx[28], _wy[28]);
  ctx.stroke();
  // wet gloss along the top
  ctx.strokeStyle = 'rgba(255,228,218,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = _wx[i] - 0.6, py = _wy[i] - 2.3;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // the eye of the hook peeks out at the front, the point & barb out of the bend
  ctx.strokeStyle = '#3c4247';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(24.2, 0, 2.1, 0, TAU);
  ctx.moveTo(22, 0);
  ctx.lineTo(18.5, 0.5);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(bx + 3, by + br - 0.5);
  ctx.quadraticCurveTo(bx + br * 1.1, by + br * 0.55, bx + br * 1.12, by - 1.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,242,248,0.85)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(bx + 4, by + br - 1.4);
  ctx.quadraticCurveTo(bx + br * 0.95, by + br * 0.5, bx + br * 0.98, by - 1);
  ctx.stroke();
  ctx.fillStyle = '#3c4247';
  ctx.beginPath();
  ctx.moveTo(bx + br * 1.12 + 0.6, by - 2.4);
  ctx.lineTo(bx + br * 1.12 - 2.8, by + 2.4);
  ctx.lineTo(bx + br * 1.12 - 0.8, by + 1.9);
  ctx.closePath();
  ctx.fill();
};

// ── 2. Live shrimp, hooked under the horn, legs paddling ─────────────────────
DRAW.shrimp = (ctx, t) => {
  leader(ctx, 30, 40);
  const body = '#ff9a78';
  // antennae (behind)
  ctx.strokeStyle = 'rgba(255,170,140,0.8)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const w = Math.sin(t * 2.2 + i * 1.7) * 6;
    ctx.moveTo(24, -6);
    ctx.bezierCurveTo(10, -26 - i * 4, -20, -22 + w, -46, -6 + w * 1.2 + i * 6);
  }
  ctx.stroke();
  // tail fan
  const tailX = -34, tailY = 10;
  const flick = Math.sin(t * 3.1) * 0.12;
  ctx.save();
  ctx.translate(tailX, tailY);
  ctx.rotate(0.5 + flick);
  ctx.fillStyle = 'rgba(255,150,120,0.9)';
  for (const a of [-0.55, 0, 0.55]) {
    ctx.beginPath();
    ctx.ellipse(-8 * Math.cos(a), 8 * Math.sin(a), 8, 3.2, a, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(150,60,40,0.45)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
  // abdomen segments along a curve
  const segs = 6;
  for (let i = segs - 1; i >= 0; i--) {
    const k = i / segs;
    const a = 0.2 + k * 1.15 + flick * k;
    const cx = 2 - Math.sin(a) * 30 - k * 4, cy = -1 + (1 - Math.cos(a)) * 18;
    const rx = 9.5 - k * 3.6, ry = 8.2 - k * 3.2;
    const g = ctx.createRadialGradient(cx - 2, cy - 3, 0.5, cx, cy, rx + 2);
    g.addColorStop(0, '#ffd9c4');
    g.addColorStop(0.6, body);
    g.addColorStop(1, '#c4583c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, a * 0.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,60,40,0.45)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // swimmerets paddling
    ctx.strokeStyle = 'rgba(255,170,140,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const p = Math.sin(t * 9 - i * 0.9) * 3;
    ctx.moveTo(cx, cy + ry * 0.8);
    ctx.lineTo(cx + p - 1, cy + ry + 5);
    ctx.stroke();
  }
  // carapace
  const g = ctx.createLinearGradient(0, -12, 0, 10);
  g.addColorStop(0, '#ffc9ae');
  g.addColorStop(0.5, body);
  g.addColorStop(1, '#c4583c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.bezierCurveTo(12, -12, 24, -11, 29, -5);
  ctx.lineTo(40, -9); // rostrum
  ctx.lineTo(30, -1.5);
  ctx.bezierCurveTo(28, 6, 16, 9, 6, 8);
  ctx.bezierCurveTo(-1, 6, -2, -4, 4, -8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,55,35,0.5)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // walking legs
  ctx.strokeStyle = 'rgba(240,140,110,0.95)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const p = Math.sin(t * 7 + i) * 2.5;
    const lx = 8 + i * 4.2;
    ctx.moveTo(lx, 6);
    ctx.quadraticCurveTo(lx + 2, 12, lx - 1 + p, 17);
  }
  ctx.stroke();
  // eye on a stalk
  ctx.fillStyle = '#1b1210';
  ctx.beginPath();
  ctx.arc(27, -6.5, 2.4, 0, TAU);
  ctx.fill();
  glossDot(ctx, 26.4, -7.4, 0.8, 0.6, 0.9);
  // speckles
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 6; i++) ctx.fillRect(8 + i * 3.1, -4 + (i % 3) * 2.4, 0.9, 0.9);
  glossDot(ctx, 14, -7, 7, 1.6, 0.45);
  // the hook through the horn
  ctx.strokeStyle = '#3c4247';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(31, 0);
  ctx.lineTo(24, 0.5);
  ctx.moveTo(19, -11);
  ctx.quadraticCurveTo(15, -15, 18, -18);
  ctx.stroke();
  ctx.fillStyle = '#3c4247';
  ctx.beginPath();
  ctx.moveTo(18.5, -19);
  ctx.lineTo(16, -15);
  ctx.lineTo(17.6, -15.6);
  ctx.closePath();
  ctx.fill();
};

// ── 3. Silver spinner: rotating blade, brass body, dressed treble ────────────
DRAW.spinner = (ctx, t) => {
  leader(ctx, 34, 40);
  // wire shaft
  ctx.strokeStyle = '#b9c2c8';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(36, 0);
  ctx.lineTo(-26, 0);
  ctx.stroke();
  // treble hook + red tuft
  ctx.fillStyle = 'rgba(220,40,40,0.9)';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25 + Math.sin(t * 6 + i) * 0.05;
    ctx.moveTo(-26, 0);
    ctx.quadraticCurveTo(-36, Math.sin(a) * 10, -46, Math.sin(a) * 16);
    ctx.quadraticCurveTo(-36, Math.sin(a) * 6 + 2, -26, 0);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(-27, -1);
  ctx.quadraticCurveTo(-38, -3, -45, -2);
  ctx.quadraticCurveTo(-37, 0, -27, 1);
  ctx.fill();
  ctx.strokeStyle = '#3c4247';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const sgn of [-1, 1]) {
    ctx.moveTo(-24, 0);
    ctx.lineTo(-36, 0);
    ctx.arc(-36, sgn * 5.5, 5.5, sgn < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, sgn < 0);
    ctx.lineTo(-41.5 + 2.5, sgn * 9);
  }
  ctx.stroke();
  // brass body + beads
  const gb = ctx.createLinearGradient(0, -6, 0, 6);
  gb.addColorStop(0, '#fff1b8');
  gb.addColorStop(0.35, '#d9a93a');
  gb.addColorStop(1, '#6e4c12');
  ctx.fillStyle = gb;
  ctx.beginPath();
  ctx.moveTo(-1, -4.8);
  ctx.bezierCurveTo(-8, -5.8, -18, -4.4, -22, 0);
  ctx.bezierCurveTo(-18, 4.4, -8, 5.8, -1, 4.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0362c';
  ctx.beginPath();
  ctx.arc(3, 0, 3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = gb;
  ctx.beginPath();
  ctx.arc(8, 0, 2.6, 0, TAU);
  ctx.fill();
  glossDot(ctx, -8, -2.6, 5, 1, 0.6);
  // clevis
  ctx.strokeStyle = '#9aa3a9';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(30, -2);
  ctx.quadraticCurveTo(26, 0, 30, 2);
  ctx.stroke();
  // the blade spinning about the shaft
  const a = t * 26;
  const c = Math.cos(a), sn = Math.sin(a);
  const w = 1.5 + 8.5 * Math.abs(c);
  const cy = sn * 5.5;
  const front = c > 0;
  const gl = ctx.createLinearGradient(14, cy - w, 22, cy + w);
  if (front) {
    gl.addColorStop(0, '#ffffff');
    gl.addColorStop(0.4, '#dfe8f0');
    gl.addColorStop(1, '#7d8a96');
  } else {
    gl.addColorStop(0, '#9aa6b0');
    gl.addColorStop(1, '#4d5862');
  }
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.moveTo(30, cy * 0.3);
  ctx.bezierCurveTo(26, cy - w * 1.1, 6, cy - w, 4, cy);
  ctx.bezierCurveTo(6, cy + w, 26, cy + w * 1.1, 30, cy * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,50,60,0.5)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  if (front && Math.abs(c) > 0.75) glossDot(ctx, 14, cy - w * 0.35, 4, 1.4, 0.95);
};

// ── 4. Jelly blob: a wobbling translucent soft lure ──────────────────────────
DRAW.jelly = (ctx, t) => {
  leader(ctx, 26, 40);
  const pulse = Math.sin(t * 3.2);
  const rx = 21 * (1 + 0.06 * pulse), ry = 15 * (1 - 0.08 * pulse);
  const mx = 0; // bell margin (flat side) — the dome bulges toward +x
  // trailing tentacles (thin) and frilly oral arms (thick)
  for (let i = 0; i < 7; i++) {
    const y0 = -ry * 0.8 + (i / 6) * ry * 1.6;
    ctx.strokeStyle = 'rgba(214,196,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mx, y0);
    for (let k = 1; k <= 9; k++) {
      ctx.lineTo(mx - k * 5.2, y0 * (1 + k * 0.04) + Math.sin(t * 3 - k * 0.75 + i * 1.3) * (0.6 + k * 0.45));
    }
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const y0 = -4 + i * 4;
    ctx.strokeStyle = 'rgba(236,170,236,0.6)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(mx + 2, y0);
    for (let k = 1; k <= 6; k++) ctx.lineTo(mx + 2 - k * 4.6, y0 + Math.sin(t * 2.4 - k * 0.9 + i * 2) * (1 + k * 0.4));
    ctx.stroke();
  }
  // the bell: translucent dome with a bright crown and a scalloped margin
  const g = ctx.createRadialGradient(mx + rx * 0.62, -ry * 0.35, 1, mx + rx * 0.35, 0, rx * 1.05);
  g.addColorStop(0, 'rgba(255,252,255,0.95)');
  g.addColorStop(0.35, 'rgba(226,210,255,0.8)');
  g.addColorStop(0.8, 'rgba(176,146,240,0.62)');
  g.addColorStop(1, 'rgba(150,120,225,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(mx, -ry);
  ctx.bezierCurveTo(mx + rx * 1.1, -ry * 1.02, mx + rx * 1.1, ry * 1.02, mx, ry);
  const sc = 6;
  for (let k = 0; k < sc; k++) {
    const y1 = ry - ((k + 1) * 2 * ry) / sc;
    const ym = ry - ((k + 0.5) * 2 * ry) / sc;
    ctx.quadraticCurveTo(mx - 3.2 - Math.sin(t * 5 + k) * 0.8, ym, mx, y1);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // the hook, dimly visible inside the soft body
  ctx.save();
  ctx.globalAlpha *= 0.5;
  jHook(ctx, 22, 0, 4, 5.5, 1.7, '#4a4f66', true);
  ctx.restore();
  // inner radial canals + four-leaf gonads
  ctx.strokeStyle = 'rgba(255,190,235,0.6)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(mx + rx * 0.42, -ry * 0.28, 4, 2.6, -0.4, 0, TAU);
  ctx.moveTo(mx + rx * 0.42 + 4, ry * 0.28);
  ctx.ellipse(mx + rx * 0.42, ry * 0.28, 4, 2.6, 0.4, 0, TAU);
  ctx.stroke();
  glossDot(ctx, mx + rx * 0.7, -ry * 0.55, 4.6, 2, 0.8);
};

// ── 5. Live sardine on a nose hook, tail kicking ─────────────────────────────
const _mTop = new Float32Array(30), _mBot = new Float32Array(30);
DRAW.minnow = (ctx, t) => {
  leader(ctx, 37, 40);
  const kick = t * 9;
  const bend = (x) => Math.sin(kick - (34 - x) * 0.06) * Math.pow(Math.max(0, 34 - x) / 80, 1.8) * 9;
  // body outline sampled with the bend
  const top = _mTop, bot = _mBot;
  for (let i = 0; i <= 14; i++) {
    const x = 34 - (i / 14) * 70;
    const k = i / 14;
    const h = (k < 0.25 ? Math.sin((k / 0.25) * Math.PI / 2) : 1 - Math.pow((k - 0.25) / 0.75, 1.6) * 0.82) * 8.4;
    const b = bend(x);
    top[i * 2] = x;
    top[i * 2 + 1] = -h * 0.95 + b;
    bot[i * 2] = x;
    bot[i * 2 + 1] = h + b;
  }
  // tail fork
  const tb = bend(-36);
  ctx.fillStyle = '#5f7f95';
  ctx.beginPath();
  ctx.moveTo(-34, tb - 1);
  ctx.lineTo(-47, tb - 9 + Math.sin(kick) * 2);
  ctx.lineTo(-42, tb);
  ctx.lineTo(-47, tb + 9 + Math.sin(kick) * 2);
  ctx.lineTo(-34, tb + 1);
  ctx.closePath();
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, '#244c6b');
  g.addColorStop(0.3, '#5c8fb0');
  g.addColorStop(0.5, '#d9e6ee');
  g.addColorStop(0.8, '#f4f7f8');
  g.addColorStop(1, '#c8d3da');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(top[0], top[1]);
  for (let i = 2; i < top.length; i += 2) ctx.lineTo(top[i], top[i + 1]);
  for (let i = bot.length - 2; i >= 0; i -= 2) ctx.lineTo(bot[i], bot[i + 1]);
  ctx.closePath();
  ctx.fill();
  // flank spots + lateral shimmer
  ctx.fillStyle = 'rgba(20,40,60,0.75)';
  for (let i = 0; i < 6; i++) {
    const x = 16 - i * 7;
    ctx.beginPath();
    ctx.arc(x, -2.5 + bend(x), 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(180,240,255,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const x = 26 - i * 5.6;
    const y = 0.6 + bend(x);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // dorsal + pelvic fins
  ctx.fillStyle = 'rgba(70,100,125,0.85)';
  ctx.beginPath();
  ctx.moveTo(6, -8 + bend(6));
  ctx.lineTo(-2, -14 + bend(-2));
  ctx.lineTo(-6, -7.5 + bend(-6));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 7.5 + bend(-4));
  ctx.lineTo(-10, 12 + bend(-10));
  ctx.lineTo(-12, 7 + bend(-12));
  ctx.closePath();
  ctx.fill();
  // gill cover
  ctx.strokeStyle = 'rgba(60,80,100,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(20, -6);
  ctx.quadraticCurveTo(15, 0, 20, 6.5);
  ctx.stroke();
  // eye
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.arc(26, -1.8, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0c1014';
  ctx.beginPath();
  ctx.arc(26.6, -1.8, 2.3, 0, TAU);
  ctx.fill();
  glossDot(ctx, 25.6, -3, 0.9, 0.7, 0.95);
  glossDot(ctx, 4, -4.5, 12, 1.4, 0.35);
  // nose hook: up through both lips
  ctx.strokeStyle = '#3c4247';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(38, 2);
  ctx.lineTo(33, 4);
  ctx.arc(30, 6, 4.5, 0, Math.PI * 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(32.5, -3);
  ctx.quadraticCurveTo(33, -8, 30.5, -10.5);
  ctx.stroke();
  ctx.fillStyle = '#3c4247';
  ctx.beginPath();
  ctx.moveTo(30, -11.5);
  ctx.lineTo(29.5, -7);
  ctx.lineTo(31.2, -8);
  ctx.closePath();
  ctx.fill();
};

// ── 6. Krill cloud: a pink puff of tiny krill around a small hook ─────────────
const KRILL = [];
for (let i = 0; i < 20; i++) {
  const a = i * 2.39996, r = 4 + Math.sqrt(i / 20) * 24;
  KRILL.push({ x: -8 + Math.cos(a) * r * 1.3, y: Math.sin(a) * r * 0.8, rot: a * 1.7 + i, ph: i * 0.73, s: 0.55 + ((i * 5) % 4) * 0.08 });
}
DRAW.krill = (ctx, t) => {
  leader(ctx, 20, 40);
  // the pink puff
  const haze = ctx.createRadialGradient(-8, 0, 1, -8, 0, 34);
  haze.addColorStop(0, 'rgba(255,170,160,0.6)');
  haze.addColorStop(0.5, 'rgba(255,150,150,0.28)');
  haze.addColorStop(1, 'rgba(255,150,150,0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(-8, 0, 40, 28, 0, 0, TAU);
  ctx.fill();
  jHook(ctx, 18, 0, -2, 5.2, 1.6);
  for (let i = 0; i < KRILL.length; i++) {
    const k = KRILL[i];
    const dx = Math.sin(t * 0.9 + k.ph) * 2.4, dy = Math.cos(t * 1.1 + k.ph * 1.3) * 1.9;
    const flick = Math.sin(t * 9 + k.ph * 3);
    ctx.save();
    ctx.translate(k.x + dx, k.y + dy);
    ctx.rotate(k.rot + flick * 0.12);
    ctx.scale(k.s, k.s);
    ctx.fillStyle = i % 3 ? 'rgba(255,128,108,0.92)' : 'rgba(255,165,140,0.92)';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.quadraticCurveTo(3, -3.2, -2.5, -2);
    ctx.quadraticCurveTo(-7, flick * 1.5, -9, 2.6 + flick * 1.6);
    ctx.quadraticCurveTo(-3, 2.6, 7, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,180,0.8)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(1, 1.4);
    ctx.lineTo(0.4 + flick, 4.2);
    ctx.moveTo(-1.6, 1.4);
    ctx.lineTo(-2.2 + flick, 4);
    ctx.stroke();
    ctx.fillStyle = '#160b0c';
    ctx.beginPath();
    ctx.arc(4.8, -0.7, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
};

// ── 7. Squid jig (egi): luminous cloth body, sinker keel, barbless crown ──────
DRAW.squid_jig = (ctx, t) => {
  leader(ctx, 32, 40);
  // the crown: two rows of upturned pins at the tail
  ctx.strokeStyle = '#c9d0d6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      const a = -1.3 + (i / 5) * 2.6;
      const bx = -28 - row * 4, r = 8 + row * 2;
      const ex = bx - Math.cos(a) * r * 0.6, ey = Math.sin(a) * r;
      ctx.moveTo(bx, a * 1.5);
      ctx.quadraticCurveTo(ex - 2, ey, ex + 1.5, ey - Math.sign(a || 1) * 2.5 - 1.5);
    }
  }
  ctx.stroke();
  ctx.fillStyle = '#9aa3a9';
  ctx.fillRect(-32, -3.5, 5, 7);
  // fins (feather wings)
  ctx.fillStyle = 'rgba(255,130,200,0.8)';
  ctx.beginPath();
  ctx.moveTo(8, -6);
  ctx.quadraticCurveTo(-2, -20, -10, -16 + Math.sin(t * 4) * 1.5);
  ctx.quadraticCurveTo(-4, -10, 2, -5);
  ctx.closePath();
  ctx.fill();
  // cloth body
  const g = ctx.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, '#ffb0e4');
  g.addColorStop(0.5, '#ff4fb8');
  g.addColorStop(1, '#a3196f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, -1);
  ctx.bezierCurveTo(28, -8, 14, -10, 0, -9);
  ctx.bezierCurveTo(-14, -8, -24, -6, -28, -2);
  ctx.lineTo(-28, 2);
  ctx.bezierCurveTo(-22, 7, -8, 9, 6, 8.5);
  ctx.bezierCurveTo(20, 8, 28, 5, 32, -1);
  ctx.closePath();
  ctx.fill();
  // woven texture + luminous stripes
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,10,70,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = -34; x < 34; x += 3) {
    ctx.moveTo(x, -10);
    ctx.lineTo(x + 8, 10);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,140,0.75)';
  for (const x of [-18, -8, 2]) ctx.fillRect(x, -10, 2.6, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-30, -7, 60, 2);
  ctx.restore();
  // lead keel under the head
  ctx.fillStyle = '#5b6168';
  ctx.beginPath();
  ctx.moveTo(30, 2);
  ctx.quadraticCurveTo(26, 11, 12, 9);
  ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = '#f0d24a';
  ctx.beginPath();
  ctx.arc(22, -2.5, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0c0c10';
  ctx.beginPath();
  ctx.arc(22.6, -2.5, 1.9, 0, TAU);
  ctx.fill();
  glossDot(ctx, 21.6, -3.6, 0.9, 0.7, 0.95);
};

// ── 8. Abyss glow jig: heavy metal slab, cyan luminous paint, assist hooks ────
DRAW.glow_jig = (ctx, t) => {
  leader(ctx, 32, 40);
  // assist hooks dangling from the solid ring
  ctx.strokeStyle = 'rgba(240,220,170,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(31, 0);
  ctx.quadraticCurveTo(28, 6, 24, 8);
  ctx.moveTo(31, 0);
  ctx.quadraticCurveTo(29, -5, 25, -7);
  ctx.stroke();
  ctx.save();
  ctx.translate(24, 8);
  ctx.rotate(0.3 + Math.sin(t * 2) * 0.1);
  jHook(ctx, 0, 0, -6, 3.6, 1.6, '#7d858c', true);
  ctx.restore();
  ctx.save();
  ctx.translate(25, -7);
  ctx.rotate(-0.4 + Math.sin(t * 2.3) * 0.1);
  ctx.scale(1, -1);
  jHook(ctx, 0, 0, -6, 3.6, 1.6, '#7d858c', true);
  ctx.restore();
  // solid ring
  ctx.strokeStyle = '#b6bfc6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(32, 0, 2.4, 0, TAU);
  ctx.stroke();
  // the slab
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#f2fbff');
  g.addColorStop(0.32, '#9fb2c0');
  g.addColorStop(0.55, '#5ff6e8');
  g.addColorStop(1, '#1d8f8a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(29, 0);
  ctx.bezierCurveTo(26, -6, 10, -7.5, -6, -6);
  ctx.bezierCurveTo(-20, -4.5, -30, -2, -34, 0);
  ctx.bezierCurveTo(-30, 3, -18, 7, -4, 7.5);
  ctx.bezierCurveTo(12, 7.5, 26, 5, 29, 0);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // holographic scale dots
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = -30; x < 26; x += 3.4) {
    for (let y = -6; y < 7; y += 3.4) {
      if (((x + y) | 0) % 2) continue;
      ctx.fillRect(x + ((y * 0.5) % 1.7), y, 1, 1);
    }
  }
  const sh = ((t * 0.6) % 1) * 80 - 40;
  const gs = ctx.createLinearGradient(sh - 6, 0, sh + 6, 0);
  gs.addColorStop(0, 'rgba(255,255,255,0)');
  gs.addColorStop(0.5, 'rgba(255,255,255,0.65)');
  gs.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(-36, -8, 70, 16);
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,60,70,0.55)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // painted eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(20, -1, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0a1a20';
  ctx.beginPath();
  ctx.arc(20.4, -1, 1.5, 0, TAU);
  ctx.fill();
};

// ── 9. Bloody chum: a slab of tuna on a circle hook trailing a red slick ──────
DRAW.chum = (ctx, t) => {
  // the slick: red wisps bleeding off the chunk, drifting back & up
  for (let i = 0; i < 7; i++) {
    const life = (t * 0.32 + i / 7) % 1;
    const x = -14 - life * 36, y = -2 - life * 16 + Math.sin(t * 0.8 + i * 2) * 3;
    const r = 4 + life * 13;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(196,24,24,${0.42 * (1 - life)})`);
    g.addColorStop(1, 'rgba(196,24,24,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  leader(ctx, 30, 40);
  // the chunk: a torn, irregular slab of dark tuna loin
  const P = [[-24, -8], [-14, -12.5], [-2, -11], [8, -14], [17, -11], [21, -4], [19, 4], [21, 10], [11, 13], [0, 11.5], [-10, 13.5], [-20, 10], [-26, 3], [-23, -2]];
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(-10, -14, 6, 14);
  g.addColorStop(0, '#c8394a');
  g.addColorStop(0.5, '#93171f');
  g.addColorStop(1, '#4e0a10');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // W-shaped muscle flakes
  ctx.strokeStyle = 'rgba(255,170,170,0.32)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let x = -28; x < 26; x += 6) {
    ctx.moveTo(x, -14);
    ctx.lineTo(x + 3, -5);
    ctx.lineTo(x - 1, 2);
    ctx.lineTo(x + 3, 9);
    ctx.lineTo(x, 15);
  }
  ctx.stroke();
  // silvery skin + fat line along the top edge
  ctx.fillStyle = '#56758e';
  ctx.beginPath();
  ctx.moveTo(-28, -9);
  ctx.quadraticCurveTo(-4, -14, 24, -12);
  ctx.lineTo(24, -8.5);
  ctx.quadraticCurveTo(-4, -10.5, -28, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(220,235,242,0.85)';
  ctx.beginPath();
  ctx.moveTo(-28, -5.5);
  ctx.quadraticCurveTo(-4, -10.5, 24, -8.5);
  ctx.lineTo(24, -7.2);
  ctx.quadraticCurveTo(-4, -9, -28, -4.2);
  ctx.closePath();
  ctx.fill();
  // dark blood line
  ctx.fillStyle = 'rgba(60,5,10,0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, 4, 14, 2.4, 0.05, 0, TAU);
  ctx.fill();
  ctx.restore();
  glossDot(ctx, -6, 1, 8, 1.8, 0.35);
  glossDot(ctx, 9, -3, 3, 1.1, 0.6);
  // circle hook through the chunk, point curling back in
  ctx.strokeStyle = '#2f3438';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(28.5, 0, 2.3, 0, TAU);
  ctx.moveTo(26, 0);
  ctx.lineTo(19, 1.5);
  ctx.moveTo(-6, 12.5);
  ctx.arc(1, 14, 7.5, Math.PI * 1.08, Math.PI * 0.12, true);
  ctx.quadraticCurveTo(6.5, 11, 2.5, 9.5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,230,236,0.7)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(1, 14, 6.8, Math.PI * 0.95, Math.PI * 0.3, true);
  ctx.stroke();
};

// ── glow pass ─────────────────────────────────────────────────────────────────
const GLOW_COL = {
  jelly: [200, 170, 255], krill: [255, 150, 140], squid_jig: [255, 110, 210], glow_jig: [90, 255, 235],
};

/** Additive glow for a lure: halo by `glow`, twinkles by `flash` while moving. ctx composite must be 'lighter'. */
export function drawLureGlow(ctx, lureId, x, y, size, angle, t, moving = 0) {
  const L = LURES_BY_ID[lureId];
  if (!L) return;
  const glow = L.glow || 0, flash = L.flash || 0;
  if (glow > 0.01) {
    const c = GLOW_COL[lureId] || [255, 230, 190];
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.6);
    const r = size * (0.7 + 2.6 * glow);
    const a = clamp(0.18 + 0.55 * glow, 0, 0.8) * pulse;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
    g.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.45})`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (glow >= 0.5) {
      // the luminous body itself
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.35 * glow * pulse})`;
      ctx.beginPath();
      ctx.ellipse(-size * 0.02, 0, size * 0.3, size * 0.09, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  if (flash > 0.05 && moving > 0.05) {
    // glints: deterministic twinkle timing
    const n = Math.ceil(flash * 3);
    for (let i = 0; i < n; i++) {
      const ph = (t * (2.1 + i * 0.7) + i * 0.37) % 1;
      if (ph > 0.35) continue;
      const k = Math.sin((ph / 0.35) * Math.PI) * moving * flash;
      const sx = x + Math.cos(angle) * size * (0.12 - i * 0.1), sy = y + Math.sin(angle) * size * (0.12 - i * 0.1) - size * 0.04;
      const s = size * 0.22 * k;
      ctx.fillStyle = `rgba(255,255,240,${0.85 * k})`;
      ctx.beginPath();
      ctx.moveTo(sx - s, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - s);
      ctx.quadraticCurveTo(sx, sy, sx + s, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + s);
      ctx.quadraticCurveTo(sx, sy, sx - s, sy);
      ctx.fill();
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s * 1.4);
      g.addColorStop(0, `rgba(255,255,255,${0.45 * k})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - s * 1.4, sy - s * 1.4, s * 2.8, s * 2.8);
    }
  }
}

/** In-game size (px at zoom 1) per lure. */
export const LURE_SIZE = { worm: 30, shrimp: 31, spinner: 33, jelly: 30, minnow: 36, krill: 34, squid_jig: 33, glow_jig: 31, chum: 34 };
