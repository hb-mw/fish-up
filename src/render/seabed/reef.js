// Coral-reef decoration painters (local px, origin = base point on the ground, −y up, light from above-left).
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, blobPath, contactShadow, lin, rad, ribbon } from './paint.js';

// ── brain coral ─────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'brain', variants: 4, box: { x0: -54, y0: -46, x1: 54, y1: 10 },
  paint(g, v, rng) {
    const C = [H('#cdb46a'), H('#a6b67c'), H('#d8a08a'), H('#c0a07c')][v];
    contactShadow(g, 0, 56, 8, 0.45);
    const RX = 46, RY = 38, CY = 5;
    const dome = () => {
      g.beginPath();
      g.moveTo(-RX, CY);
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI + (i / 40) * Math.PI;
        const wob = 1 + 0.035 * Math.sin(a * 7 + v);
        g.lineTo(Math.cos(a) * RX * wob, CY + Math.sin(a) * RY * wob);
      }
      g.closePath();
    };
    dome();
    g.fillStyle = rad(g, -14, -20, 2, 0, -4, 58, [[0, lite(C, 0.32)], [0.45, rgbk(C)], [1, rgbk(C, 0.5)]]);
    g.fill();
    g.save();
    dome();
    g.clip();
    // meandering grooves: wiggly concentric rings, broken in places
    for (let i = 1; i <= 10; i++) {
      const k = i / 10.5;
      const ph = rng.range(0, TAU), f1 = rng.int(9, 15), f2 = rng.int(19, 27);
      const gap0 = rng.range(0, TAU), gapW = rng.range(0.15, 0.5);
      for (const [dx, dy, col, w] of [[0, 0, rgbk(C, 0.42, 0.55), 2.4], [-0.7, -0.9, lite(C, 0.35, 0.55), 1.1]]) {
        g.beginPath();
        let pen = false;
        for (let j = 0; j <= 90; j++) {
          const a = Math.PI + (j / 90) * Math.PI;
          const inGap = Math.abs(((a - gap0) % TAU + TAU) % TAU) < gapW;
          const r = k * (1 + 0.07 * Math.sin(a * f1 + ph) + 0.03 * Math.sin(a * f2 + ph * 2));
          const x = Math.cos(a) * RX * r + dx, y = CY + Math.sin(a) * RY * r + dy;
          if (inGap) {
            pen = false;
            continue;
          }
          if (!pen) g.moveTo(x, y);
          else g.lineTo(x, y);
          pen = true;
        }
        g.strokeStyle = col;
        g.lineWidth = w;
        g.stroke();
      }
    }
    // ambient occlusion at the foot
    g.fillStyle = lin(g, 0, -6, 0, CY, [[0, 'rgba(0,0,0,0)'], [1, rgbk(C, 0.25, 0.55)]]);
    g.fillRect(-RX, -10, RX * 2, 20);
    g.restore();
    // rim light
    g.beginPath();
    for (let i = 4; i <= 26; i++) {
      const a = Math.PI + (i / 40) * Math.PI;
      g.lineTo(Math.cos(a) * RX * 0.99, CY + Math.sin(a) * RY * 0.99);
    }
    g.strokeStyle = lite(C, 0.6, 0.55);
    g.lineWidth = 1.6;
    g.stroke();
  },
});

// ── staghorn / branching coral ──────────────────────────────────────────────────────────────────────
defType({
  id: 'staghorn', variants: 4, box: { x0: -66, y0: -128, x1: 66, y1: 8 },
  paint(g, v, rng) {
    const P = [
      { base: H('#b48a64'), tip: H('#f2dcc2') },
      { base: H('#8f7598'), tip: H('#f0d4f0') },
      { base: H('#c49650'), tip: H('#f6e6b6') },
      { base: H('#6f87a0'), tip: H('#d6ecfa') },
    ][v];
    contactShadow(g, 0, 50, 7, 0.4);
    const segs = [];
    const grow = (x, y, ang, len, w, d) => {
      let cx = x, cy = y, a = ang;
      const pts = [[cx, cy]];
      const n = 3;
      for (let i = 0; i < n; i++) {
        a += rng.range(-0.18, 0.18);
        a = a * 0.85 + (-Math.PI / 2) * 0.15; // tends upward
        cx += Math.cos(a) * (len / n);
        cy += Math.sin(a) * (len / n);
        pts.push([cx, cy]);
      }
      segs.push({ pts, w, d });
      if (d >= 4 || cy < -118) return;
      const kids = d < 1 ? 2 : rng.int(1, 2);
      for (let k = 0; k < kids; k++) {
        const side = kids === 1 ? rng.sign() : k === 0 ? -1 : 1;
        grow(cx, cy, a + side * rng.range(0.25, 0.65), len * rng.range(0.72, 0.9), w * 0.76, d + 1);
      }
      if (rng.chance(0.35) && d < 3) grow(cx, cy, a + rng.range(-0.1, 0.1), len * 0.6, w * 0.7, d + 2);
    };
    const trunks = rng.int(2, 4);
    for (let i = 0; i < trunks; i++) {
      const x = (i - (trunks - 1) / 2) * 12 + rng.range(-4, 4);
      grow(x, 4, -Math.PI / 2 + (x / 40) + rng.range(-0.25, 0.25), rng.range(26, 34), rng.range(9, 11), 0);
    }
    const colAt = (d, k = 1, a = 1) => {
      const t = Math.min(1, d / 4.5);
      return rgbk([P.base[0] + (P.tip[0] - P.base[0]) * t, P.base[1] + (P.tip[1] - P.base[1]) * t, P.base[2] + (P.tip[2] - P.base[2]) * t], k, a);
    };
    segs.sort((a, b) => a.d - b.d);
    // dark body (gives a soft edge), body colour, highlight
    for (const s of segs) {
      g.strokeStyle = colAt(s.d, 0.52);
      g.lineWidth = s.w + 2.2;
      g.beginPath();
      s.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.stroke();
    }
    for (const s of segs) {
      g.strokeStyle = colAt(s.d + 0.4);
      g.lineWidth = s.w;
      g.beginPath();
      s.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.stroke();
    }
    for (const s of segs) {
      g.strokeStyle = lite(P.tip, 0.4, 0.5);
      g.lineWidth = Math.max(1, s.w * 0.3);
      g.beginPath();
      s.pts.forEach((p, i) => (i ? g.lineTo(p[0] - s.w * 0.22, p[1] - s.w * 0.1) : g.moveTo(p[0] - s.w * 0.22, p[1] - s.w * 0.1)));
      g.stroke();
      // corallites: tiny bumps along the branch
      const last = s.pts[s.pts.length - 1];
      if (s.d >= 3) {
        g.fillStyle = lite(P.tip, 0.5);
        g.beginPath();
        g.arc(last[0], last[1], s.w * 0.55, 0, TAU);
        g.fill();
      }
    }
  },
});

// ── table coral ─────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'table', variants: 3, box: { x0: -86, y0: -74, x1: 86, y1: 8 },
  paint(g, v, rng) {
    const C = [H('#8fa47e'), H('#7f9cae'), H('#b39c74')][v];
    // the shade under the plate
    g.save();
    g.translate(0, -8);
    g.scale(1, 0.22);
    g.fillStyle = rad(g, 0, 0, 2, 0, 0, 78, [[0, 'rgba(8,16,20,0.5)'], [1, 'rgba(8,16,20,0)']]);
    g.beginPath();
    g.arc(0, 0, 78, 0, TAU);
    g.fill();
    g.restore();
    contactShadow(g, 0, 30, 6, 0.5);
    // stalk
    g.beginPath();
    g.moveTo(-12, 5);
    g.quadraticCurveTo(-6, -24, -9, -50);
    g.lineTo(9, -50);
    g.quadraticCurveTo(6, -24, 12, 5);
    g.closePath();
    g.fillStyle = lin(g, -12, 0, 12, 0, [[0, lite(C, 0.15)], [0.5, rgbk(C, 0.8)], [1, rgbk(C, 0.45)]]);
    g.fill();
    // underside stubs
    g.strokeStyle = rgbk(C, 0.42);
    g.lineWidth = 2.2;
    for (let x = -66; x <= 66; x += 6) {
      const y = -46 + Math.abs(x) * 0.08;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(-1.5, 1.5), y + rng.range(3, 6) * (1 - Math.abs(x) / 90));
      g.stroke();
    }
    // plate: dark underside, then the lit top surface, edges drooping
    const plate = (dy, rx, th) => {
      g.beginPath();
      g.moveTo(-rx, -44 + dy + 6);
      g.quadraticCurveTo(-rx * 0.5, -54 + dy - th * 0.2, 0, -54 + dy);
      g.quadraticCurveTo(rx * 0.5, -54 + dy - th * 0.2, rx, -44 + dy + 6);
      g.quadraticCurveTo(rx * 0.55, -46 + dy + th, 0, -46 + dy + th * 0.6);
      g.quadraticCurveTo(-rx * 0.55, -46 + dy + th, -rx, -44 + dy + 6);
      g.closePath();
    };
    plate(2, 78, 9);
    g.fillStyle = rgbk(C, 0.42);
    g.fill();
    plate(-2, 80, 6);
    g.fillStyle = lin(g, 0, -60, 0, -38, [[0, lite(C, 0.38)], [0.55, rgbk(C, 1.02)], [1, rgbk(C, 0.62)]]);
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 160; i++) {
      const x = rng.range(-78, 78), y = rng.range(-58, -40);
      g.fillStyle = rng.chance(0.5) ? lite(C, 0.55, 0.5) : rgbk(C, 0.6, 0.4);
      g.beginPath();
      g.arc(x, y, rng.range(0.6, 1.3), 0, TAU);
      g.fill();
    }
    g.restore();
    // bright growing rim
    g.beginPath();
    g.moveTo(-80, -38);
    g.quadraticCurveTo(-40, -58, 0, -56);
    g.quadraticCurveTo(40, -58, 80, -38);
    g.strokeStyle = lite(C, 0.7, 0.75);
    g.lineWidth = 1.8;
    g.stroke();
  },
});

// ── sea fan (gorgonian) ─────────────────────────────────────────────────────────────────────────────
defType({
  id: 'seafan', variants: 4, box: { x0: -78, y0: -150, x1: 78, y1: 8 },
  sway: { amp: 4, freq: 0.8, wave: 0.7, slices: 6 },
  paint(g, v, rng) {
    const C = [H('#b8325a'), H('#8a3fa8'), H('#e0742c'), H('#e2b23a')][v];
    contactShadow(g, 0, 18, 4, 0.4);
    const R = 92, oy = -14;
    const A0 = -Math.PI + 0.42, A1 = -0.42;
    // translucent body of the fan
    g.beginPath();
    g.moveTo(-3, oy);
    for (let i = 0; i <= 32; i++) {
      const a = A0 - 0.05 + (i / 32) * (A1 - A0 + 0.1);
      const r = R * (1.02 + 0.06 * Math.sin(i * 1.9 + v * 2));
      g.lineTo(Math.cos(a) * r, oy + Math.sin(a) * r * 1.05);
    }
    g.lineTo(3, oy);
    g.closePath();
    g.fillStyle = rad(g, -12, oy - 70, 4, 0, oy - 30, 100, [[0, rgbk(C, 1.25, 0.34)], [1, rgbk(C, 0.85, 0.16)]]);
    g.fill();
    // branch skeleton: main branches fan out from the trunk top
    const branches = [];
    const nMain = rng.int(8, 11);
    for (let i = 0; i < nMain; i++) {
      const a = A0 + (i / (nMain - 1)) * (A1 - A0) + rng.range(-0.06, 0.06);
      const pts = [[0, oy]];
      let x = 0, y = oy, ang = -Math.PI / 2;
      const steps = 9;
      const len = R * rng.range(0.9, 1.04);
      for (let st = 1; st <= steps; st++) {
        const f = st / steps;
        ang = -Math.PI / 2 * (1 - Math.sqrt(f)) + a * Math.sqrt(f);
        x += Math.cos(ang) * len / steps;
        y += Math.sin(ang) * len / steps * 1.05;
        pts.push([x + rng.range(-0.8, 0.8), y + rng.range(-0.8, 0.8)]);
      }
      branches.push(pts);
    }
    // mesh between neighbouring branches
    g.strokeStyle = rgbk(C, 1.1, 0.75);
    g.lineWidth = 0.8;
    for (let i = 0; i < branches.length - 1; i++) {
      const A = branches[i], B = branches[i + 1];
      for (let s = 2; s < A.length; s++) {
        for (let q = 0; q < 3; q++) {
          const t = rng.next();
          const p = A[s], p2 = B[Math.min(B.length - 1, s + (rng.chance(0.5) ? 1 : 0))];
          const pp = A[s - 1];
          const ax = pp[0] + (p[0] - pp[0]) * t, ay = pp[1] + (p[1] - pp[1]) * t;
          g.beginPath();
          g.moveTo(ax, ay);
          g.quadraticCurveTo((ax + p2[0]) / 2 + rng.range(-3, 3), (ay + p2[1]) / 2 + rng.range(-3, 3), p2[0], p2[1]);
          g.stroke();
        }
      }
    }
    // twigs off the outer branches
    for (const B of branches) {
      for (let s = 3; s < B.length; s++) {
        if (!rng.chance(0.6)) continue;
        const p = B[s];
        const a = Math.atan2(p[1] - oy, p[0]) + rng.range(-0.6, 0.6);
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0] + Math.cos(a) * rng.range(4, 9), p[1] + Math.sin(a) * rng.range(4, 9));
        g.stroke();
      }
    }
    // main branches: dark under-stroke + colour + highlight
    for (const [w, col] of [[3.4, rgbk(C, 0.5)], [2.2, rgbk(C, 1.05)], [0.9, lite(C, 0.45, 0.8)]]) {
      g.strokeStyle = col;
      for (const B of branches) {
        g.lineWidth = w;
        g.beginPath();
        B.forEach((p, i) => (i ? g.lineTo(p[0] - (w < 1 ? 0.6 : 0), p[1] - (w < 1 ? 0.6 : 0)) : g.moveTo(p[0], p[1])));
        g.stroke();
      }
    }
    // trunk + holdfast
    g.fillStyle = rgbk(C, 0.6);
    blobPath(g, 0, 2, 10, 5, 8, 0.25, rng);
    g.fill();
    g.strokeStyle = rgbk(C, 0.75);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(0, oy);
    g.stroke();
  },
});

// ── tube sponges ────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'tubes', variants: 4, box: { x0: -46, y0: -112, x1: 46, y1: 8 },
  paint(g, v, rng) {
    const C = [H('#8a52b0'), H('#e2803a'), H('#e3c048'), H('#d8708e')][v];
    contactShadow(g, 0, 40, 6, 0.45);
    const n = rng.int(3, 5);
    const tubes = [];
    for (let i = 0; i < n; i++) {
      tubes.push({
        x: (i - (n - 1) / 2) * 14 + rng.range(-4, 4),
        h: rng.range(46, 100) * (1 - Math.abs(i - (n - 1) / 2) * 0.12),
        r: rng.range(7, 10.5),
        lean: rng.range(-0.18, 0.18),
        z: rng.next(),
      });
    }
    tubes.sort((a, b) => a.z - b.z);
    for (const t of tubes) {
      const topX = t.x + t.lean * t.h, topY = -t.h;
      const r0 = t.r * 0.85, r1 = t.r * 1.12;
      g.beginPath();
      g.moveTo(t.x - r0, 4);
      g.quadraticCurveTo(t.x - r0 + t.lean * t.h * 0.4, -t.h * 0.5, topX - r1, topY);
      g.lineTo(topX + r1, topY);
      g.quadraticCurveTo(t.x + r0 + t.lean * t.h * 0.4, -t.h * 0.5, t.x + r0, 4);
      g.closePath();
      g.fillStyle = lin(g, t.x - r1, 0, t.x + r1, 0, [[0, lite(C, 0.25)], [0.35, rgbk(C, 1.05)], [1, rgbk(C, 0.48)]]);
      g.fill();
      // pores
      g.save();
      g.clip();
      for (let i = 0; i < t.h * 0.9; i++) {
        g.fillStyle = rgbk(C, 0.55, 0.45);
        g.beginPath();
        const yy = rng.range(topY + 6, 2);
        g.arc(t.x + t.lean * -yy + rng.range(-r0, r0), yy, rng.range(0.6, 1.3), 0, TAU);
        g.fill();
      }
      g.fillStyle = lin(g, 0, -10, 0, 4, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
      g.fillRect(t.x - 20, -10, 40, 16);
      g.restore();
      // opening
      g.beginPath();
      g.ellipse(topX, topY, r1, r1 * 0.38, t.lean * 0.5, 0, TAU);
      g.fillStyle = rgbk(C, 0.32);
      g.fill();
      g.strokeStyle = lite(C, 0.45);
      g.lineWidth = 1.6;
      g.stroke();
      g.beginPath();
      g.ellipse(topX, topY + 1, r1 * 0.75, r1 * 0.22, t.lean * 0.5, 0, Math.PI);
      g.strokeStyle = rgbk(C, 0.2, 0.6);
      g.lineWidth = 1.2;
      g.stroke();
    }
  },
});

// ── barrel sponge ───────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'barrel', variants: 3, box: { x0: -58, y0: -96, x1: 58, y1: 8 },
  paint(g, v, rng) {
    const C = [H('#a2604c'), H('#b48260'), H('#8e5e74')][v];
    contactShadow(g, 0, 50, 7, 0.5);
    const shape = () => {
      g.beginPath();
      g.moveTo(-26, 5);
      g.bezierCurveTo(-40, -20, -50, -60, -44, -84);
      g.lineTo(44, -84);
      g.bezierCurveTo(50, -60, 40, -20, 26, 5);
      g.closePath();
    };
    shape();
    g.fillStyle = lin(g, -48, 0, 48, 0, [[0, lite(C, 0.2)], [0.3, rgbk(C, 1.08)], [0.75, rgbk(C, 0.72)], [1, rgbk(C, 0.42)]]);
    g.fill();
    g.save();
    shape();
    g.clip();
    // vertical ridges
    for (let i = -6; i <= 6; i++) {
      const t = i / 7;
      g.beginPath();
      for (let s = 0; s <= 12; s++) {
        const y = 5 - (s / 12) * 90;
        const half = 26 + (44 - 26) * Math.pow(s / 12, 0.8) + Math.sin(s * 0.9) * 2;
        g.lineTo(t * half + Math.sin(s * 1.3 + i) * 1.5, y);
      }
      g.strokeStyle = rgbk(C, 0.5, 0.5);
      g.lineWidth = 2.6;
      g.stroke();
      g.strokeStyle = lite(C, 0.3, 0.4);
      g.lineWidth = 1;
      g.stroke();
    }
    // horizontal growth bands
    for (let y = -10; y > -80; y -= rng.range(9, 15)) {
      g.beginPath();
      g.ellipse(0, y, 50, 4, 0, 0, Math.PI);
      g.strokeStyle = rgbk(C, 0.55, 0.35);
      g.lineWidth = 1.4;
      g.stroke();
    }
    g.fillStyle = lin(g, 0, -12, 0, 5, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.4)']]);
    g.fillRect(-50, -12, 100, 18);
    g.restore();
    // the cavernous opening
    g.beginPath();
    g.ellipse(0, -84, 44, 9, 0, 0, TAU);
    g.fillStyle = rad(g, 0, -82, 2, 0, -84, 44, [[0, rgbk(C, 0.12)], [1, rgbk(C, 0.4)]]);
    g.fill();
    g.strokeStyle = lite(C, 0.35);
    g.lineWidth = 2.4;
    g.stroke();
  },
});

// ── soft coral (puffy branching) ────────────────────────────────────────────────────────────────────
defType({
  id: 'softcoral', variants: 5, box: { x0: -52, y0: -96, x1: 52, y1: 8 },
  sway: { amp: 7, freq: 1.05, wave: 1.1, slices: 6 },
  paint(g, v, rng) {
    const C = [H('#f0668a'), H('#e8483e'), H('#f2c240'), H('#b46ad8'), H('#f2f0e6')][v];
    const stem = v === 4 ? H('#d8c8b8') : [C[0] + (255 - C[0]) * 0.55, C[1] + (255 - C[1]) * 0.55, C[2] + (255 - C[2]) * 0.55];
    contactShadow(g, 0, 22, 5, 0.4);
    const tips = [];
    const grow = (x, y, a, len, w, d) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      g.strokeStyle = rgbk(stem, 0.85, 0.85);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, ex, ey);
      g.stroke();
      if (d >= 3) {
        tips.push([ex, ey]);
        return;
      }
      const k = rng.int(2, 3);
      for (let i = 0; i < k; i++) grow(ex, ey, a + rng.range(-0.8, 0.8), len * 0.72, w * 0.7, d + 1);
    };
    grow(0, 4, -Math.PI / 2, 30, 9, 0);
    // polyp puffs around each tip and along the upper branches
    const puffs = [];
    for (const [x, y] of tips) {
      const n = rng.int(5, 9);
      for (let i = 0; i < n; i++) puffs.push([x + rng.range(-10, 10), y + rng.range(-10, 7), rng.range(3, 6.5)]);
    }
    puffs.sort((a, b) => b[1] - a[1]);
    for (const [x, y, r] of puffs) {
      g.fillStyle = rad(g, x - r * 0.35, y - r * 0.45, 0.5, x, y, r, [[0, lite(C, 0.5)], [0.55, rgbk(C)], [1, rgbk(C, 0.58)]]);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    // tiny white polyp stars on the puffs
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < puffs.length; i += 2) {
      const [x, y, r] = puffs[i];
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.3, 0.8, 0, TAU);
      g.fill();
    }
  },
});

// ── anemone ─────────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'anemone', variants: 4, box: { x0: -54, y0: -76, x1: 54, y1: 8 },
  sway: { amp: 6, freq: 1.35, wave: 1.5, slices: 5 },
  paint(g, v, rng) {
    const P = [
      { col: H('#9a3a6a'), ten: H('#e8d8a8'), tip: H('#a6d070'), bulb: false },
      { col: H('#c0502e'), ten: H('#f0a050'), tip: H('#ffd890'), bulb: true },
      { col: H('#5a7a3a'), ten: H('#b8d078'), tip: H('#f0f0c0'), bulb: false },
      { col: H('#6a3a8a'), ten: H('#d890c8'), tip: H('#ffe0f4'), bulb: true },
    ][v];
    contactShadow(g, 0, 26, 5, 0.45);
    // column
    g.beginPath();
    g.moveTo(-15, 4);
    g.quadraticCurveTo(-18, -8, -14, -16);
    g.lineTo(14, -16);
    g.quadraticCurveTo(18, -8, 15, 4);
    g.closePath();
    g.fillStyle = lin(g, -16, 0, 16, 0, [[0, lite(P.col, 0.25)], [0.4, rgbk(P.col)], [1, rgbk(P.col, 0.5)]]);
    g.fill();
    // verrucae spots
    for (let i = 0; i < 16; i++) {
      g.fillStyle = lite(P.col, 0.35, 0.6);
      g.beginPath();
      g.arc(rng.range(-12, 12), rng.range(-14, 0), rng.range(0.7, 1.4), 0, TAU);
      g.fill();
    }
    // tentacles: back row darker, front row lighter
    const n = 46;
    const tent = [];
    for (let i = 0; i < n; i++) {
      const t = rng.next();
      const x0 = (t - 0.5) * 28;
      const front = rng.chance(0.5);
      const ang = -Math.PI / 2 + (t - 0.5) * 2.6 + rng.range(-0.25, 0.25);
      tent.push({ x0, front, ang, len: rng.range(20, 40) * (1 - Math.abs(t - 0.5) * 0.5), w: rng.range(2.2, 3.4), curl: rng.range(-0.6, 0.6) });
    }
    tent.sort((a, b) => a.front - b.front);
    for (const T of tent) {
      const pts = [];
      let x = T.x0, y = -15, a = T.ang;
      for (let s = 0; s < 6; s++) {
        pts.push([x, y]);
        a += T.curl * 0.12;
        x += Math.cos(a) * T.len / 5;
        y += Math.sin(a) * T.len / 5;
      }
      pts.push([x, y]);
      const k = T.front ? 1 : 0.68;
      g.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const f = i / (pts.length - 1);
        g.strokeStyle = rgbk([P.ten[0] + (P.tip[0] - P.ten[0]) * f, P.ten[1] + (P.tip[1] - P.ten[1]) * f, P.ten[2] + (P.tip[2] - P.ten[2]) * f], k);
        g.lineWidth = T.w * (1 - f * 0.45);
        g.beginPath();
        g.moveTo(pts[i - 1][0], pts[i - 1][1]);
        g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
      }
      const e = pts[pts.length - 1];
      if (P.bulb) {
        g.fillStyle = rad(g, e[0] - 1, e[1] - 1, 0.3, e[0], e[1], T.w * 1.1, [[0, lite(P.tip, 0.5)], [1, rgbk(P.tip, k)]]);
        g.beginPath();
        g.arc(e[0], e[1], T.w * 1.05, 0, TAU);
        g.fill();
      } else if (T.front) {
        g.fillStyle = lite(P.tip, 0.3, 0.9);
        g.beginPath();
        g.arc(e[0], e[1], T.w * 0.5, 0, TAU);
        g.fill();
      }
    }
  },
});

// ── giant clam ──────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'clam', variants: 3, box: { x0: -40, y0: -40, x1: 40, y1: 8 },
  paint(g, v, rng) {
    const M = [H('#2a8acb'), H('#2fb59a'), H('#7a4ac0')][v];
    const S = H('#d8d0bc');
    contactShadow(g, 0, 40, 6, 0.5);
    // shell body
    g.beginPath();
    g.moveTo(-34, 4);
    g.quadraticCurveTo(-38, -22, -20, -28);
    g.lineTo(20, -28);
    g.quadraticCurveTo(38, -22, 34, 4);
    g.closePath();
    g.fillStyle = lin(g, 0, -30, 0, 4, [[0, lite(S, 0.3)], [0.5, rgbk(S)], [1, rgbk(S, 0.55)]]);
    g.fill();
    // radial ribs
    for (let i = -5; i <= 5; i++) {
      g.beginPath();
      g.moveTo(i * 2, 4);
      g.quadraticCurveTo(i * 5.5, -12, i * 6.4, -27);
      g.strokeStyle = rgbk(S, 0.62, 0.6);
      g.lineWidth = 1.6;
      g.stroke();
    }
    // mantle between the wavy lips
    g.beginPath();
    g.moveTo(-31, -24);
    for (let i = 0; i <= 12; i++) {
      const x = -31 + (i / 12) * 62;
      g.lineTo(x, -24 - (i % 2 ? 8 : 2));
    }
    for (let i = 12; i >= 0; i--) {
      const x = -31 + (i / 12) * 62;
      g.lineTo(x, -30 - (i % 2 ? 9 : 3));
    }
    g.closePath();
    g.fillStyle = lin(g, -30, 0, 30, 0, [[0, rgbk(M, 0.8)], [0.5, lite(M, 0.35)], [1, rgbk(M, 0.75)]]);
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(180,255,250,0.7)' : 'rgba(20,40,80,0.4)';
      g.beginPath();
      g.arc(rng.range(-30, 30), rng.range(-40, -22), rng.range(0.7, 1.6), 0, TAU);
      g.fill();
    }
    g.restore();
    // zigzag lip highlights
    g.beginPath();
    for (let i = 0; i <= 12; i++) g.lineTo(-31 + (i / 12) * 62, -24 - (i % 2 ? 8 : 2));
    g.strokeStyle = lite(S, 0.5);
    g.lineWidth = 2;
    g.stroke();
  },
});

// ── starfish (lying on the ground, foreshortened) ───────────────────────────────────────────────────
defType({
  id: 'starfish', variants: 3, box: { x0: -18, y0: -12, x1: 18, y1: 4 },
  paint(g, v, rng) {
    const C = [H('#e8743a'), H('#d8423a'), H('#3a72c8')][v];
    g.save();
    g.translate(0, -3);
    g.scale(1, 0.52);
    g.rotate(rng.range(0, 1.2));
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? 5 : 15;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = rgbk(C, 0.75);
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = rad(g, -3, -3, 0.5, 0, 0, 15, [[0, lite(C, 0.4)], [0.5, rgbk(C)], [1, rgbk(C, 0.7)]]);
    g.fill();
    for (let i = 0; i < 20; i++) {
      const a = rng.range(0, TAU), r = rng.range(0, 11);
      g.fillStyle = lite(C, 0.5, 0.7);
      g.beginPath();
      g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.8, 0, TAU);
      g.fill();
    }
    g.restore();
  },
});

// ── sea grass ───────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'seagrass', variants: 4, box: { x0: -34, y0: -86, x1: 34, y1: 6 },
  sway: { amp: 9, freq: 1.25, wave: 1.7, slices: 5 },
  paint(g, v, rng) {
    const greens = [[H('#4f8a32'), H('#9ccf5a')], [H('#5c9440'), H('#b8d870')], [H('#3e7a3a'), H('#8cc060')], [H('#6a8a2a'), H('#c0d060')]][v];
    const n = rng.int(7, 12);
    const blades = [];
    for (let i = 0; i < n; i++) blades.push({ x: rng.range(-12, 12), h: rng.range(36, 80), lean: rng.range(-0.5, 0.5), w: rng.range(1.8, 3), z: rng.next() });
    blades.sort((a, b) => a.z - b.z);
    for (const b of blades) {
      const pts = [], widths = [];
      for (let s = 0; s <= 8; s++) {
        const f = s / 8;
        pts.push([b.x + b.lean * b.h * f * f + Math.sin(f * 3 + b.x) * 2, 4 - b.h * f]);
        widths.push(b.w * (1 - f * 0.65));
      }
      ribbon(g, pts, widths);
      const k = 0.7 + b.z * 0.35;
      g.fillStyle = lin(g, 0, 4, 0, -b.h, [[0, rgbk(greens[0], 0.6 * k)], [0.6, rgbk(greens[0], k)], [1, rgbk(greens[1], k)]]);
      g.fill();
    }
  },
});

// ── reef rock (old coral rubble mound) ──────────────────────────────────────────────────────────────
defType({
  id: 'reefrock', variants: 4, box: { x0: -76, y0: -82, x1: 76, y1: 16 },
  paint(g, v, rng) {
    const C = [H('#a49a86'), H('#9a9284'), H('#b0a088'), H('#8e8a80')][v];
    contactShadow(g, 0, 84, 9, 0.5);
    const rx = 54 + v * 4, ry = 42 + v * 7;
    const shape = () => {
      g.beginPath();
      g.moveTo(-rx * 0.92, 12);
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 0.94 + (i / n) * Math.PI * 1.12;
        const r = 1 + 0.1 * Math.sin(i * 2.3 + v * 1.7) + 0.05 * Math.sin(i * 5.1 + v);
        g.lineTo(Math.cos(a) * rx * r, 8 + Math.sin(a) * ry * r);
      }
      g.quadraticCurveTo(rx * 0.6, 14, 0, 13);
      g.quadraticCurveTo(-rx * 0.6, 14, -rx * 0.92, 12);
      g.closePath();
    };
    shape();
    g.fillStyle = rad(g, -rx * 0.3, -ry * 0.7, 4, 0, -ry * 0.3, rx * 1.1, [[0, lite(C, 0.3)], [0.5, rgbk(C)], [1, rgbk(C, 0.45)]]);
    g.fill();
    g.save();
    shape();
    g.clip();
    // pitted old-coral texture: cups and holes
    for (let i = 0; i < 70; i++) {
      const x = rng.range(-rx, rx), y = rng.range(-ry - 6, 8), r = rng.range(0.8, 2.6);
      g.fillStyle = rgbk(C, 0.55, 0.45);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
      g.fill();
      g.strokeStyle = lite(C, 0.35, 0.5);
      g.lineWidth = 0.8;
      g.beginPath();
      g.ellipse(x, y + 0.6, r, r * 0.7, 0, 0.2, Math.PI - 0.2);
      g.stroke();
    }
    // crusts: coralline pink, algal green, sponge orange
    for (let i = 0; i < 14; i++) {
      const col = rng.pick([H('#d88aa0'), H('#b85c7a'), H('#7a9a48'), H('#e8904a'), H('#c8b04a'), H('#9a6ac8')]);
      const x = rng.range(-rx * 0.85, rx * 0.85), y = rng.range(-ry * 0.9, 2);
      blobPath(g, x, y, rng.range(4, 11), rng.range(2.5, 6), 7, 0.35, rng);
      g.fillStyle = rgbk(col, 1, 0.8);
      g.fill();
      g.fillStyle = lite(col, 0.4, 0.4);
      blobPath(g, x - 1, y - 1.5, rng.range(1.5, 4), rng.range(1, 2.5), 6, 0.3, rng);
      g.fill();
    }
    g.fillStyle = lin(g, 0, -4, 0, 12, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
    g.fillRect(-rx * 1.2, -4, rx * 2.4, 18);
    g.restore();
    // lit crest
    g.beginPath();
    for (let i = 4; i <= 11; i++) {
      const a = Math.PI * 0.94 + (i / 16) * Math.PI * 1.12;
      const r = 1 + 0.1 * Math.sin(i * 2.3 + v * 1.7) + 0.05 * Math.sin(i * 5.1 + v);
      g.lineTo(Math.cos(a) * rx * r * 0.99, 8 + Math.sin(a) * ry * r * 0.99);
    }
    g.strokeStyle = lite(C, 0.55, 0.5);
    g.lineWidth = 2;
    g.stroke();
  },
});

// ── sea urchin ──────────────────────────────────────────────────────────────────────────────────────
defType({
  id: 'urchin', variants: 2, box: { x0: -20, y0: -30, x1: 20, y1: 4 },
  paint(g, v, rng) {
    const C = [H('#2a1a34'), H('#5a2a6a')][v];
    contactShadow(g, 0, 14, 3, 0.5);
    for (let i = 0; i < 44; i++) {
      const a = Math.PI + rng.range(0.05, Math.PI - 0.05);
      const L = rng.range(10, 19);
      g.strokeStyle = rng.chance(0.3) ? lite(C, 0.35, 0.9) : rgbk(C, 1.2);
      g.lineWidth = rng.range(0.7, 1.3);
      g.beginPath();
      g.moveTo(Math.cos(a) * 5, -6 + Math.sin(a) * 4);
      g.lineTo(Math.cos(a) * L, -6 + Math.sin(a) * L);
      g.stroke();
    }
    g.fillStyle = rad(g, -2, -9, 0.5, 0, -6, 8, [[0, lite(C, 0.4)], [1, rgbk(C, 0.8)]]);
    g.beginPath();
    g.ellipse(0, -5, 8, 6.5, 0, 0, TAU);
    g.fill();
  },
});

// ── feather-duster worm ─────────────────────────────────────────────────────────────────────────────
defType({
  id: 'duster', variants: 3, box: { x0: -18, y0: -46, x1: 18, y1: 4 },
  sway: { amp: 3, freq: 1.6, wave: 1.2, slices: 3 },
  paint(g, v, rng) {
    const C = [H('#e05aa0'), H('#f0a040'), H('#7a8aff')][v];
    g.strokeStyle = '#c8b090';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 3);
    g.quadraticCurveTo(-1.5, -10, 0, -22);
    g.stroke();
    for (let i = 0; i < 22; i++) {
      const a = Math.PI + 0.2 + (i / 21) * (Math.PI - 0.4);
      const L = rng.range(13, 18);
      const pts = [[0, -22]];
      for (let s = 1; s <= 4; s++) pts.push([Math.cos(a) * L * (s / 4), -22 + Math.sin(a) * L * (s / 4) * 1.1 + Math.sin(s) * 0.6]);
      for (let s = 1; s < pts.length; s++) {
        g.strokeStyle = s % 2 ? rgbk(C) : lite(C, 0.6);
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(pts[s - 1][0], pts[s - 1][1]);
        g.lineTo(pts[s][0], pts[s][1]);
        g.stroke();
      }
    }
  },
});
