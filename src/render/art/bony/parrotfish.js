// Stoplight parrotfish (Sparisoma viride), terminal phase — emerald body with salmon-edged scales, orange head
// stripes, the yellow spot on the gill cover, a yellow bar at the tail base and a lunate tail with a yellow crescent.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull } from './rig.js';

const P = profile(
  [[0.5, 0.012], [0.49, -0.024], [0.465, -0.06], [0.42, -0.096], [0.34, -0.136], [0.22, -0.16], [0.08, -0.166], [-0.06, -0.158], [-0.18, -0.13], [-0.26, -0.095], [-0.31, -0.07], [-0.335, -0.065]],
  [[0.5, 0.012], [0.49, 0.046], [0.465, 0.076], [0.42, 0.106], [0.34, 0.136], [0.22, 0.155], [0.08, 0.162], [-0.06, 0.155], [-0.18, 0.13], [-0.26, 0.095], [-0.31, 0.07], [-0.335, 0.065]],
);
const HINGE = [0.432, 0.046], TIP = [0.497, 0.016], CORNER = [0.466, 0.032];
const PEC = [0.215, 0.03];
const SALMON = '#e8805a', YEL = '#ffd23a', BLUE = '#2f7ccf';

function paint(g, res, v) {
  const rng = createRng(97 + v * 3);
  const green = shift('#27a06c', [-8, 0, 6][v], 0, 0), teal = shift('#1c8878', [-8, 0, 6][v], 0, 0);
  const greenLt = mixc(green, '#9fe0a8', 0.45);
  const rayCol = '#0f4a3a';

  // caudal: lunate, blue-green lobes with a yellow-orange crescent
  const tail = caudal({ P, root: 0.08, up: [-0.5, -0.185], lo: [-0.5, 0.185], notch: [-0.405, 0.0], lead: 0.06, trail: -0.16 });
  fin(g, res, {
    pts: tail, stops: [[0, teal], [0.5, mixc(teal, BLUE, 0.35)], [1, rgba(mixc(teal, BLUE, 0.55), 0.85)]], axis: [-0.3, 0, -0.5, 0],
    paint(gg) {
      soft(gg, 0.012, rgba('#f2a83c', 0.85), () => {
        gg.beginPath();
        gg.moveTo(-0.475, -0.155);
        gg.quadraticCurveTo(-0.305, 0, -0.475, 0.155);
        gg.lineWidth = 0.045;
        gg.stroke();
      });
    },
    rays: { n: 26, to: [3, 7], from: tail.root, col: rayCol, a: 0.3, fade: 0.4, w: 0.0015, curl: 0.04, hl: '#bfffe0', hla: 0.14 },
    margin: { col: rgba(BLUE, 0.5), w: 0.005, from: 3, to: 7 },
    scallop: { from: 3, to: 7, n: 13, depth: 0.0025 },
  });
  // dorsal: long and low; salmon band along the base, blue margin
  const dorsal = ridge(P, 'top', [[0.215, -0.012], [0.2, 0.04], [0.15, 0.058], [0.05, 0.06], [-0.05, 0.06], [-0.15, 0.058], [-0.225, 0.05], [-0.255, 0.03, 1], [-0.27, -0.012]], 0.3);
  const dTop = (x) => P.top(x) + 0.012;
  fin(g, res, {
    pts: dorsal, stops: [[0, mixc(green, SALMON, 0.5)], [0.45, rgba(green, 0.92)], [1, rgba(mixc(green, BLUE, 0.4), 0.82)]], axis: [0.0, -0.16, 0.0, -0.23],
    paint(gg) {
      soft(gg, 0.01, rgba(SALMON, 0.7), () => {
        gg.beginPath();
        gg.moveTo(0.21, dTop(0.21) - 0.03);
        for (let x = 0.2; x > -0.27; x -= 0.03) gg.lineTo(x, dTop(x) - 0.028);
        gg.lineWidth = 0.022;
        gg.stroke();
      });
    },
    rays: { n: 20, from: [[0.2, dTop(0.2)], [-0.265, dTop(-0.265)]], lean: [0.25, 0.9], col: rayCol, a: 0.3, w: 0.0015, hl: '#d0ffe0', hla: 0.12 },
    margin: { col: rgba(BLUE, 0.55), w: 0.0035, from: 1, to: 7 },
  });
  const anal = ridge(P, 'bot', [[-0.04, -0.012], [-0.06, 0.036], [-0.12, 0.054], [-0.2, 0.05], [-0.25, 0.03, 1], [-0.27, -0.012]], 0.3);
  const aBot = (x) => P.bot(x) - 0.012;
  fin(g, res, {
    pts: anal, stops: [[0, mixc(SALMON, green, 0.3)], [0.5, rgba(mixc(SALMON, '#f0b090', 0.4), 0.9)], [1, rgba(mixc(SALMON, BLUE, 0.3), 0.8)]], axis: [-0.15, 0.15, -0.15, 0.21],
    rays: { n: 13, from: [[-0.05, aBot(-0.05)], [-0.265, aBot(-0.265)]], lean: [0.25, 0.9], up: 1, col: '#7a3a2a', a: 0.28, w: 0.0015, hl: '#ffffff', hla: 0.12 },
    margin: { col: rgba(BLUE, 0.55), w: 0.0035, from: 1, to: 4 },
  });
  const pelvic = (dx, a) => {
    const y = P.bot(0.16);
    fin(g, res, {
      pts: [[0.185 + dx, y - 0.014], [0.165 + dx, y + 0.035], [0.1 + dx, y + 0.085, 1], [0.12 + dx, y + 0.04], [0.14 + dx, y - 0.014]],
      stops: [[0, rgba(mixc(SALMON, green, 0.4), a)], [1, rgba(mixc(SALMON, '#f0c0a0', 0.4), a * 0.8)]], axis: [0.16, y, 0.1, y + 0.085],
      rays: { n: 7, to: [1, 3], from: [[0.178 + dx, y - 0.004], [0.144 + dx, y - 0.004]], col: '#7a3a2a', a: 0.26, w: 0.0015 },
      edge: { col: rgba(BLUE, 0.45), w: 0.0026, to: 2 },
    });
  };
  pelvic(-0.026, 0.55);

  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, dark(teal, 0.25)], [0.12, teal], [0.4, green], [0.72, mixc(green, greenLt, 0.6)], [0.9, greenLt], [1, lite(greenLt, 0.2)]]);
      // yellow bar at the base of the tail
      soft(t, U.H * 0.012, YEL, () => {
        U.path([[-0.268, 0.1], [-0.288, 0.5], [-0.268, 0.9], [-0.305, 0.9], [-0.335, 0.5], [-0.305, 0.1]], true);
        t.fill();
      });
      // melt the yellow bar into the tail root (the kit's cap leaves a short straight cut in the middle)
      t.globalCompositeOperation = 'destination-out';
      const fg = t.createLinearGradient(U.X(P.x0), 0, U.X(P.x0 + 0.03), 0);
      fg.addColorStop(0, 'rgba(0,0,0,1)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = fg;
      t.fillRect(0, 0, U.X(P.x0 + 0.03), U.H);
      t.globalCompositeOperation = 'source-over';
      // the head is a warmer green, the throat paler
      U.glow(0.4, 0.45, 0.16, 0.6, mixc(green, '#8fd060', 0.4), 0.35);
      U.glow(0.38, 0.95, 0.16, 0.25, '#cfe8c0', 0.3);
    },
    over(gg) {
      mottle(gg, -0.34, -0.17, 0.5, 0.17, { color: '#0a4a3a', a: 0.18, scale: 0.34, lo: 0.42, hi: 0.72, seed: 3 + v });
      // big scales edged in salmon
      scales(gg, res, P, { rows: 11, x0: -0.31, x1: 0.25, dark: SALMON, da: 0.5, light: '#ffffff', la: 0.08, lw: 0.16, jitter: 0.35, rng, xFade: (x) => Math.min(1, (0.25 - x) / 0.04) });
      // orange-salmon stripes radiating from the eye
      soft(gg, 0.005, rgba('#f08a5a', 0.9), () => {
        gg.lineWidth = 0.018;
        gg.beginPath();
        gg.moveTo(0.375, -0.055);
        gg.quadraticCurveTo(0.44, -0.03, 0.492, 0.0);
        gg.moveTo(0.345, -0.03);
        gg.quadraticCurveTo(0.33, 0.04, 0.27, 0.11);
        gg.moveTo(0.31, -0.075);
        gg.quadraticCurveTo(0.27, -0.03, 0.24, 0.03);
        gg.stroke();
      });
      // yellow spot on the upper edge of the gill cover
      spot(gg, 0.228, -0.09, 0.024, YEL, 0.95, 0.5, 0.02);
    },
    shade: { dark: '#06302a', light: '#e8fff0', sheen: 0.4, sheenV: 0.2, sheenW: 0.13, gloss: 0.3, belly: 0.3, bounce: 0.6, rim: 0.32, topLight: 0.16 },
    face(gg) {
      gill(gg, res, { x: 0.235, y0: -0.11, y1: 0.13, bulge: 0.03, dark: '#083a30', a: 0.38, shadow: 0.22, la: 0.14, w: 0.0026, plate: 0.16 });
      // the fused beak: pale plates above and below the mouth line
      soft(gg, 0.004, rgba('#dff3ea', 0.9), () => {
        gg.beginPath();
        gg.moveTo(0.5, -0.004);
        gg.quadraticCurveTo(0.472, -0.004, 0.462, 0.028);
        gg.quadraticCurveTo(0.475, 0.05, 0.5, 0.045);
        gg.lineWidth = 0.012;
        gg.stroke();
      });
      spot(gg, 0.45, -0.044, 0.004, '#0a3028', 0.6, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.003, dark: '#0a2a24', a: 0.6, w: 0.003, lip: 'rgba(255,255,255,0.4)' });
      eye(gg, 0.35, -0.06, 0.024, { iris: '#e8883a', irisDark: '#7a3a10', pupil: 0.55, ring: 'rgba(10,30,24,0.4)', rim: 'rgba(255,230,150,0.45)', socket: 0.22 });
      glint(gg, 0.41, -0.1, 0.03, 0.006, 0.3, -0.5);
    },
  });
  pelvic(0, 1);
}

function paintPec(g, res, v) {
  const green = shift('#27a06c', [-8, 0, 6][v], 0, 0);
  fin(g, res, {
    pts: [[0.23, 0.01], [0.175, 0.008], [0.06, 0.062, 1], [0.1, 0.095], [0.2, 0.078], [0.23, 0.052]],
    stops: [[0, rgba(mixc(green, '#ffffff', 0.3), 0.85)], [0.5, rgba(mixc(green, '#ffffff', 0.5), 0.6)], [1, rgba('#eafff2', 0.4)]],
    axis: [0.22, 0.032, 0.07, 0.07],
    rays: { n: 13, to: [2, 4], from: [[0.225, 0.018], [0.225, 0.048]], col: '#0f4a3a', a: 0.3, w: 0.0015, hl: '#ffffff', hla: 0.14 },
    edge: { col: rgba('#1a3a8a', 0.6), w: 0.0036, to: 2 },
  });
  erase(g, 0.228, 0.032, 0.02, 0.9, 0.2, 0.024);
}

export const def = {
  id: 'parrotfish',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.24, y1: 0.25 },
  mouth: { x: 0.49, y: 0.02 },
  paint,
  swim: { swing: 0.03, waves: 1.1, power: 1.9, head: 0.08, squash: 0.02, idle: 0.07 },
  parts: [{ key: 'pec', box: { x0: 0.03, x1: 0.245, y0: -0.02, y1: 0.11 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.5, lock: 1, squash: 0.4 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.35, cavity: '#2a1016' },
  gillSlit: { x: 0.235, y0: -0.1, y1: 0.12, bulge: 0.03 },
};
