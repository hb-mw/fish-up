// Junk items: old boot, rusty can, message in a bottle. Items don't swim: phase is ignored except for gentle
// bobbing, swaying strands (algae, lace) and moving glints. Benthic items rest on the seabed (y ≈ +0.05·len).
import { TAU, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, blurred, speckle } from './kit.js';

const PAL = palette({ algae: '#4f8a3a', algae2: '#7ab04a', lace: '#c8b088', glint: ['#ffffff', 0.85] });

// ── OLD BOOT (upright, toe +X; len = sole length) ───────────────────────────
const BOOT = { x0: -0.52, x1: 0.54, y0: -0.78, y1: 0.08 };
function bootPath(g) {
  g.beginPath();
  g.moveTo(-0.44, 0.02);
  g.lineTo(-0.44, -0.66);
  g.quadraticCurveTo(-0.3, -0.72, -0.12, -0.68);
  g.lineTo(-0.1, -0.34);
  g.bezierCurveTo(0.05, -0.3, 0.32, -0.24, 0.44, -0.14);
  g.bezierCurveTo(0.52, -0.08, 0.52, 0.0, 0.46, 0.02);
  g.closePath();
}
function paintBoot(g, res) {
  const rng = createRng(4);
  // sole + heel
  g.fillStyle = '#231a12';
  g.beginPath();
  g.moveTo(-0.47, 0.0);
  g.lineTo(0.48, 0.0);
  g.quadraticCurveTo(0.53, 0.02, 0.5, 0.05);
  g.lineTo(-0.47, 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = '#2e241a';
  g.fillRect(-0.46, 0.03, 0.22, 0.05);
  bootPath(g);
  const gr = g.createLinearGradient(-0.44, -0.7, 0.3, 0.0);
  gr.addColorStop(0, '#5a3c26');
  gr.addColorStop(0.5, '#43301e');
  gr.addColorStop(1, '#2c2014');
  g.fillStyle = gr;
  g.fill();
  g.save();
  bootPath(g);
  g.clip();
  // worn leather: scuffs, creases, a silt film on top surfaces
  speckle(g, rng, -0.45, -0.7, 0.5, 0.02, 160, 0.004, 0.016, ['rgba(140,104,70,0.25)', 'rgba(20,12,6,0.3)', 'rgba(120,130,100,0.15)']);
  g.strokeStyle = 'rgba(16,10,6,0.55)';
  g.lineWidth = 0.008;
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    g.moveTo(-0.1 + k * 0.06, -0.3 + k * 0.025);
    g.quadraticCurveTo(-0.05 + k * 0.06, -0.2, -0.08 + k * 0.07, -0.1);
    g.stroke();
  }
  blurred(g, res, 0.02, () => {
    g.fillStyle = 'rgba(200,170,120,0.25)';
    g.beginPath();
    g.ellipse(-0.28, -0.5, 0.06, 0.16, 0, 0, TAU);
    g.ellipse(0.22, -0.2, 0.18, 0.04, 0.3, 0, TAU);
    g.fill();
  });
  // stitched toe cap
  g.setLineDash([0.015, 0.012]);
  g.strokeStyle = 'rgba(200,170,120,0.45)';
  g.lineWidth = 0.005;
  g.beginPath();
  g.moveTo(0.2, -0.25);
  g.quadraticCurveTo(0.12, -0.12, 0.2, 0.0);
  g.stroke();
  g.setLineDash([]);
  g.restore();
  // eyelets
  g.fillStyle = '#8a8070';
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.arc(-0.155 + k * 0.012, -0.62 + k * 0.075, 0.011, 0, TAU);
    g.fill();
  }
  // barnacle clusters on the toe and heel: little volcano cones, lit from above
  for (let k = 0; k < 11; k++) {
    const toe = k < 7;
    const bx = toe ? 0.18 + rng.next() * 0.26 : -0.43 + rng.next() * 0.08;
    const by = toe ? -0.17 + rng.next() * 0.14 : -0.08 - rng.next() * 0.22;
    const r = 0.014 + rng.next() * 0.018;
    g.fillStyle = '#7a7266';
    g.beginPath();
    g.moveTo(bx - r, by + r * 0.5);
    g.lineTo(bx - r * 0.45, by - r * 0.55);
    g.lineTo(bx + r * 0.45, by - r * 0.55);
    g.lineTo(bx + r, by + r * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(236,230,214,0.85)';
    g.beginPath();
    g.moveTo(bx - r * 0.8, by + r * 0.35);
    g.lineTo(bx - r * 0.4, by - r * 0.5);
    g.lineTo(bx + r * 0.05, by - r * 0.5);
    g.lineTo(bx - r * 0.2, by + r * 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#2e2a24';
    g.beginPath();
    g.ellipse(bx, by - r * 0.52, r * 0.42, r * 0.14, 0, 0, TAU);
    g.fill();
  }
}

// ── RUSTY CAN (lying on its side, open end +X; len = can height) ─────────────
const CAN = { x0: -0.56, x1: 0.68, y0: -0.86, y1: 0.08 };
function paintCan(g, res) {
  const rng = createRng(9);
  const R = 0.32, cy = -0.28;
  const body = () => {
    g.beginPath();
    g.moveTo(-0.46, cy - R);
    g.lineTo(0.42, cy - R);
    g.ellipse(0.42, cy, 0.08, R, 0, -Math.PI / 2, Math.PI / 2);
    g.lineTo(-0.46, cy + R);
    g.ellipse(-0.46, cy, 0.08, R, 0, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  };
  body();
  const gr = g.createLinearGradient(0, cy - R, 0, cy + R);
  gr.addColorStop(0, '#9a8a78');
  gr.addColorStop(0.3, '#d8d0c4');
  gr.addColorStop(0.55, '#8c7c6a');
  gr.addColorStop(1, '#3e342a');
  g.fillStyle = gr;
  g.fill();
  g.save();
  body();
  g.clip();
  // faded, peeling label (red band with a pale stripe)
  g.fillStyle = 'rgba(176,54,40,0.75)';
  g.fillRect(-0.36, cy - R, 0.6, R * 2);
  g.fillStyle = 'rgba(236,220,180,0.6)';
  g.fillRect(-0.36, cy - 0.06, 0.6, 0.1);
  g.fillStyle = 'rgba(90,40,30,0.5)';
  g.beginPath();
  g.moveTo(0.24, cy - R);
  g.quadraticCurveTo(0.3, cy - 0.1, 0.18, cy + 0.05);
  g.lineTo(0.24, cy + R);
  g.lineTo(0.3, cy + R);
  g.lineTo(0.3, cy - R);
  g.fill();
  // rust blooms + ribs
  for (let i = 0; i < 26; i++) {
    const x = -0.46 + rng.next() * 0.9, y = cy - R + rng.next() * 2 * R, r = 0.02 + rng.next() * 0.07;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(150,70,24,0.85)');
    rg.addColorStop(0.6, 'rgba(176,96,40,0.5)');
    rg.addColorStop(1, 'rgba(176,96,40,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(40,30,20,0.35)';
  g.lineWidth = 0.008;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.moveTo(-0.46 + k * 0.17, cy - R);
    g.lineTo(-0.46 + k * 0.17, cy + R);
    g.stroke();
  }
  // shading by the curvature
  const sh = g.createLinearGradient(0, cy - R, 0, cy + R);
  sh.addColorStop(0, 'rgba(255,255,255,0.15)');
  sh.addColorStop(0.3, 'rgba(255,255,255,0.3)');
  sh.addColorStop(0.5, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = sh;
  g.fillRect(-0.6, cy - R, 1.2, R * 2);
  g.restore();
  // dark open mouth + jagged lid bent up and back
  g.fillStyle = '#1a140e';
  g.beginPath();
  g.ellipse(0.42, cy, 0.07, R * 0.92, 0, 0, TAU);
  g.fill();
  // the lid: a jagged flap still hinged at the top rim, peeled outward and up
  g.save();
  g.translate(0.45, cy - R + 0.02);
  g.rotate(0.7);
  g.beginPath();
  for (let k = 0; k <= 26; k++) {
    const a = (k / 26) * TAU;
    const jag = a > Math.PI * 0.2 && a < Math.PI * 0.8 ? (k % 2 ? 0.86 : 1) : 1;
    const x = Math.cos(a) * 0.055 * jag, y = -0.15 + Math.sin(a) * 0.15 * jag;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  const lg = g.createLinearGradient(-0.1, 0, 0.1, 0);
  lg.addColorStop(0, '#6a5a48');
  lg.addColorStop(0.5, '#cfc6b8');
  lg.addColorStop(1, '#7a5030');
  g.fillStyle = lg;
  g.fill();
  g.restore();
}

// ── MESSAGE IN A BOTTLE (floating, neck up-right; len = bottle length) ─────────
const BOTTLE = { x0: -0.52, x1: 0.56, y0: -0.2, y1: 0.2 };
function bottlePath(g) {
  g.beginPath();
  g.moveTo(-0.48, -0.12);
  g.lineTo(0.06, -0.12);
  g.bezierCurveTo(0.18, -0.12, 0.24, -0.05, 0.3, -0.045);
  g.lineTo(0.46, -0.045);
  g.lineTo(0.46, 0.045);
  g.lineTo(0.3, 0.045);
  g.bezierCurveTo(0.24, 0.05, 0.18, 0.12, 0.06, 0.12);
  g.lineTo(-0.48, 0.12);
  g.quadraticCurveTo(-0.52, 0, -0.48, -0.12);
  g.closePath();
}
function paintBottle(g, res) {
  // rolled paper inside, seen through the glass
  g.fillStyle = '#e8dcb4';
  g.fillRect(-0.36, -0.06, 0.42, 0.11);
  g.fillStyle = 'rgba(160,120,70,0.5)';
  g.fillRect(-0.36, -0.06, 0.42, 0.02);
  g.strokeStyle = '#a03a2a';
  g.lineWidth = 0.012;
  g.beginPath();
  g.moveTo(-0.15, -0.06);
  g.lineTo(-0.15, 0.05);
  g.stroke();
  bottlePath(g);
  const gr = g.createLinearGradient(0, -0.12, 0, 0.12);
  gr.addColorStop(0, 'rgba(120,200,150,0.55)');
  gr.addColorStop(0.35, 'rgba(60,150,100,0.35)');
  gr.addColorStop(1, 'rgba(20,90,60,0.7)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(190,250,210,0.6)';
  g.lineWidth = 0.008;
  g.stroke();
  // thick glass base + lip, cork
  g.fillStyle = 'rgba(30,110,70,0.6)';
  g.fillRect(-0.49, -0.1, 0.035, 0.2);
  g.fillStyle = 'rgba(160,230,190,0.7)';
  g.fillRect(0.44, -0.055, 0.03, 0.11);
  const cg = g.createLinearGradient(0, -0.04, 0, 0.04);
  cg.addColorStop(0, '#d8a868');
  cg.addColorStop(1, '#8a6038');
  g.fillStyle = cg;
  g.fillRect(0.46, -0.038, 0.08, 0.076);
  g.fillStyle = 'rgba(80,50,20,0.4)';
  for (let k = 0; k < 6; k++) g.fillRect(0.47 + k * 0.012, -0.03 + (k % 2) * 0.03, 0.006, 0.01);
  // glossy highlights
  blurred(g, res, 0.008, () => {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(-0.44, -0.095, 0.48, 0.022);
  });
}

export const DRAWERS = {
  old_boot: {
    bounds: { x0: -0.62, x1: 0.56, y0: -0.8, y1: 0.1 },
    mouth: { x: -0.08, y: -0.5 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const boot = variant(unitSprite('it_boot', BOOT, lenPx, paintBoot), opts);
      const t = anim.t;
      const swing = anim.state === 'hooked' || anim.state === 'landed' ? Math.sin(t * 2.2) * 0.12 : 0;
      ctx.save();
      ctx.rotate(swing);
      drawUnitSprite(ctx, boot, len);
      ctx.lineCap = 'round';
      // a ribbon of algae streaming from the heel (flat blade: wide, then a thin highlight vein)
      ctx.fillStyle = P.algae;
      ctx.beginPath();
      const w1 = Math.sin(t * 1.1) * 0.03, w2 = Math.sin(t * 1.3 + 1) * 0.06, w3 = Math.sin(t * 1.6 + 2) * 0.05;
      ctx.moveTo(-0.43 * len, -0.28 * len);
      ctx.bezierCurveTo((-0.56 + w1) * len, -0.42 * len, (-0.52 + w2) * len, -0.6 * len, (-0.6 + w3) * len, -0.77 * len);
      ctx.bezierCurveTo((-0.48 + w2) * len, -0.6 * len, (-0.5 + w1) * len, -0.42 * len, -0.41 * len, -0.32 * len);
      ctx.fill();
      ctx.strokeStyle = P.algae2;
      ctx.lineWidth = 0.008 * len;
      ctx.beginPath();
      ctx.moveTo(-0.42 * len, -0.3 * len);
      ctx.bezierCurveTo((-0.53 + w1) * len, -0.42 * len, (-0.51 + w2) * len, -0.6 * len, (-0.59 + w3) * len, -0.75 * len);
      ctx.stroke();
      // dangling, frayed lace
      ctx.strokeStyle = P.lace;
      ctx.lineWidth = 0.014 * len;
      ctx.beginPath();
      ctx.moveTo(-0.13 * len, -0.5 * len);
      ctx.bezierCurveTo((0.0 + Math.sin(t * 1.5) * 0.02) * len, -0.4 * len, (0.06 + Math.sin(t * 1.7) * 0.04) * len, -0.28 * len, (0.02 + Math.sin(t * 2) * 0.05) * len, -0.18 * len);
      ctx.stroke();
      ctx.restore();
    },
  },
  tin_can: {
    bounds: { x0: -0.58, x1: 0.68, y0: -0.86, y1: 0.08 },
    mouth: { x: 0.55, y: -0.72 },
    draw(ctx, len, anim, opts) {
      const lenPx = len * (opts.pxScale || 1);
      const can = variant(unitSprite('it_can', CAN, lenPx, paintCan), opts);
      const swing = anim.state === 'hooked' || anim.state === 'landed' ? Math.sin(anim.t * 2.6) * 0.15 : 0;
      ctx.save();
      ctx.rotate(swing);
      drawUnitSprite(ctx, can, len);
      ctx.restore();
    },
  },
  message_bottle: {
    bounds: { x0: -0.56, x1: 0.6, y0: -0.36, y1: 0.36 },
    mouth: { x: 0.46, y: -0.15 }, // the corked neck (the bottle floats tilted ~0.32 rad)
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const bottle = variant(unitSprite('it_bottle', BOTTLE, lenPx, paintBottle), opts, true);
      const t = anim.t;
      ctx.save();
      ctx.translate(0, Math.sin(t * 1.4 + anim.seed * 6) * 0.03 * len);
      ctx.rotate(-0.32 + Math.sin(t * 1.1 + anim.seed * 3) * 0.08);
      drawUnitSprite(ctx, bottle, len);
      // a glint sliding along the glass
      if (!opts.silhouette) {
        const u = (t * 0.35 + anim.seed) % 1;
        ctx.fillStyle = P.glint;
        ctx.globalAlpha *= Math.sin(u * Math.PI);
        ctx.beginPath();
        ctx.ellipse((-0.4 + u * 0.7) * len, -0.085 * len, 0.03 * len, 0.008 * len, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  },
};
