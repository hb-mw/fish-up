// Giant manta (Mobula birostris) — sprite painters.
//   wing sprites: ONE wing in PLANFORM (top view): x = along the body (+x forward), y = lateral distance from
//   the midline (z). The renderer cuts them into span strips and projects each strip with the wing's bend.
//   body sprite: the rigid centre (head, cephalic lobes, mouth, eyes, median band, tail) painted directly in the
//   projected 3/4-from-above view (camera ELEV above the horizon).
import { paintEye } from '../common.js';
import { TAU, spline, shape, soft, softStroke, clipTo, texture, rngFor, lod } from './kit.js';

export const ELEV = 0.72; // camera elevation (rad) ≈ 41°
export const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);
export const ROOT = -0.004; // planform z where the strips start: just past the midline, so the halves overlap
export const HALF = 0.075; // body half-width: the disc is rigid inside it, the wing bends outside
export const WING_BOX = { x0: -0.215, x1: 0.205, y0: -0.012, y1: 0.512 };
export const BODY_BOX = { x0: -0.515, x1: 0.32, y0: -0.08, y1: 0.095 };

// one half of the disc, planform: midline behind the head → leading edge → falcate tip → concave trailing edge
// → midline at the rear. The head itself (in front of x ≈ 0.16) lives in the body sprite.
const WING = [
  [0.165, -0.006, 1], [0.163, 0.05], [0.155, 0.1], [0.138, 0.16], [0.106, 0.23], [0.068, 0.3], [0.026, 0.37], [-0.02, 0.43],
  [-0.066, 0.482], [-0.097, 0.506, 1], [-0.092, 0.47], [-0.087, 0.42], [-0.09, 0.36], [-0.104, 0.29], [-0.128, 0.22], [-0.158, 0.15],
  [-0.184, 0.095], [-0.2, 0.05], [-0.206, -0.006, 1],
];
const LE = WING.slice(1, 10).map((p) => [p[0], p[1]]);
const TE = WING.slice(9, 18).map((p) => [p[0], p[1]]);
// the white shoulder patch of M. birostris: near-transverse front edge, lateral point, diagonal rear edge
const PATCH = [
  [0.128, 0.072, 1], [0.127, 0.1], [0.121, 0.13], [0.11, 0.158], [0.096, 0.18, 1], [0.074, 0.162], [0.048, 0.138],
  [0.018, 0.112], [-0.012, 0.088], [-0.03, 0.072, 1],
];
const wingPath = (q) => shape(q, WING);

/** Dorsal planform: black-charcoal, white shoulder patch, lit leading edge, wet sheen. lift > 0 = paler (shiny base). */
export function paintWingTop(g, res, v, lift = 0) {
  const L = lod(res);
  clipTo(g, wingPath, () => {
    const base = g.createLinearGradient(0, 0.05, 0, 0.5);
    base.addColorStop(0, lift ? '#5d6670' : '#1e232a');
    base.addColorStop(0.6, lift ? '#535c66' : '#191d23');
    base.addColorStop(1, lift ? '#4a525b' : '#14171c');
    g.fillStyle = base;
    g.fillRect(-0.22, -0.02, 0.44, 0.54);
    // white shoulder patch with a blotchy rear margin
    soft(g, res, 0.004, '#e4e7e6', (q) => shape(q, PATCH));
    const r = rngFor('mantaPatch' + v);
    for (let i = 0; i < 7; i++) {
      const t = r.next(), x = 0.07 - t * 0.1 + (r.next() - 0.5) * 0.015, y = 0.17 - t * 0.09;
      soft(g, res, 0.005, `rgba(40,44,50,${0.18 + r.next() * 0.2})`, (q) => q.ellipse(x, y, 0.006 + r.next() * 0.007, 0.005 + r.next() * 0.005, r.next() * 3, 0, TAU));
    }
    soft(g, res, 0.012, 'rgba(120,128,138,0.22)', (q) => q.ellipse(0.03, 0.11, 0.035, 0.02, -0.6, 0, TAU));
    // the top surface catches the light toward the leading edge; the trailing margin thins and greys
    soft(g, res, 0.03, 'rgba(150,175,200,0.14)', (q) => {
      spline(q, LE, true);
      q.lineTo(-0.05, 0.4);
      q.lineTo(0.02, 0.1);
      q.closePath();
    });
    softStroke(g, res, 0.01, 'rgba(120,130,140,0.25)', 0.022, (q) => spline(q, TE, true));
    texture(g, 'mottle', 0.22, L >= 1 ? 0.16 : 0.12, WING_BOX);
    if (L >= 2) texture(g, 'grain', 0.03, 0.12, WING_BOX);
    // the raised midline of the disc: a dark spine with a faint lit flank, hides the seam between the halves
    soft(g, res, 0.014, lift ? 'rgba(70,78,88,0.6)' : 'rgba(12,14,18,0.6)', (q) => q.rect(-0.21, -0.03, 0.37, 0.034));
  });
  softStroke(g, res, 0.003, 'rgba(185,200,214,0.42)', 0.004, (q) => spline(q, LE.slice(1), true));
}

/** Specular sheen layer for the dorsal planform (drawn per strip with an alpha from the strip's orientation). */
export function paintWingSheen(g, res) {
  clipTo(g, wingPath, () => {
    soft(g, res, 0.03, 'rgba(170,200,230,0.55)', (q) => {
      spline(q, LE, true);
      q.lineTo(-0.07, 0.42);
      q.lineTo(-0.05, 0.08);
      q.closePath();
    });
    soft(g, res, 0.02, 'rgba(220,235,250,0.35)', (q) => q.ellipse(0.05, 0.24, 0.05, 0.12, -0.5, 0, TAU));
  });
}

/** Ventral planform: shaded white (it faces away from the light), charcoal trailing margin and tip, a few spots. */
export function paintWingBottom(g, res, v, lift = 0) {
  clipTo(g, wingPath, () => {
    const base = g.createLinearGradient(0.15, 0.08, -0.05, 0.48);
    base.addColorStop(0, '#d9e0e4');
    base.addColorStop(0.7, '#bcc7ce');
    base.addColorStop(1, '#9aa6ae');
    g.fillStyle = base;
    g.fillRect(-0.22, -0.02, 0.44, 0.54);
    soft(g, res, 0.012, lift ? 'rgba(90,96,104,0.8)' : 'rgba(34,38,44,0.92)', (q) => {
      spline(q, TE, true);
      const back = TE.slice().reverse().map(([x, y]) => [x + 0.03 + (0.5 - y) * 0.02, y - 0.012]);
      spline(q, back, false);
      q.closePath();
    });
    soft(g, res, 0.02, 'rgba(40,44,50,0.75)', (q) => q.ellipse(-0.05, 0.48, 0.03, 0.05, 0.3, 0, TAU));
    const r = rngFor('mantaBelly' + v);
    const n = 3 + Math.floor(r.next() * 4);
    for (let i = 0; i < n; i++) {
      const x = -0.08 + r.next() * 0.16, y = 0.08 + r.next() * 0.12, rr = 0.006 + r.next() * 0.01;
      soft(g, res, 0.003, 'rgba(36,40,48,0.7)', (q) => q.ellipse(x, y, rr, rr * 0.8, r.next() * 3, 0, TAU));
    }
    texture(g, 'mottle', 0.2, 0.18, WING_BOX);
  });
  softStroke(g, res, 0.003, 'rgba(110,120,130,0.5)', 0.003, (q) => spline(q, LE.slice(1), true));
}

/** Rigid centre in the projected view: tail, feathered median band, broad head with mouth, rolled lobes, eyes. */
export function paintBody(g, res, v, lift = 0) {
  const L = lod(res);
  const dark = lift ? '#5d6670' : '#1e232a';
  const ny = HALF * SIN_E; // projected near edge of the top surface
  // tail: slim whip, dark above / pale below, a small dorsal fin at its root, pelvic fins either side
  const tail = (q) => {
    q.moveTo(-0.17, -0.011);
    q.quadraticCurveTo(-0.33, -0.004, -0.505, 0.006);
    q.quadraticCurveTo(-0.33, 0.006, -0.17, 0.013);
    q.closePath();
  };
  clipTo(g, tail, () => {
    const tg = g.createLinearGradient(0, -0.011, 0, 0.013);
    tg.addColorStop(0, dark);
    tg.addColorStop(0.6, '#2b3038');
    tg.addColorStop(1, '#b8c2c8');
    g.fillStyle = tg;
    g.fillRect(-0.52, -0.02, 0.36, 0.04);
  });
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-0.178, -0.02);
  g.quadraticCurveTo(-0.2, -0.046, -0.226, -0.05);
  g.quadraticCurveTo(-0.214, -0.026, -0.22, -0.008);
  g.closePath();
  g.fill();
  for (const s of [-1, 1]) {
    g.fillStyle = s > 0 ? '#2a2f36' : dark;
    g.beginPath();
    g.ellipse(-0.185, s * 0.026, 0.026, 0.012, s * 0.25, 0, TAU);
    g.fill();
  }
  // under the near wing root the head's flank shows in front: dark top fading to the pale belly
  const flank = (q) => {
    q.moveTo(0.1, ny - 0.012);
    q.lineTo(0.2, ny - 0.012);
    q.quadraticCurveTo(0.226, ny + 0.012, 0.2, ny + 0.032);
    q.quadraticCurveTo(0.15, ny + 0.036, 0.1, ny + 0.028);
    q.closePath();
  };
  clipTo(g, flank, () => {
    const fg = g.createLinearGradient(0, ny - 0.012, 0, ny + 0.034);
    fg.addColorStop(0, dark);
    fg.addColorStop(0.45, '#3b424b');
    fg.addColorStop(1, '#d8dfe3');
    g.fillStyle = fg;
    g.fillRect(0.08, ny - 0.02, 0.16, 0.07);
  });
  // the head: a blunt dark cap in front of the disc, its back melting into the wings
  soft(g, res, 0.006, dark, (q) => {
    q.moveTo(0.13, -ny - 0.004);
    q.lineTo(0.172, -ny - 0.004);
    q.quadraticCurveTo(0.212, -ny * 0.6, 0.215, 0);
    q.quadraticCurveTo(0.212, ny * 0.7, 0.174, ny + 0.007);
    q.lineTo(0.13, ny + 0.007);
    q.closePath();
  });
  soft(g, res, 0.01, 'rgba(140,155,170,0.12)', (q) => q.ellipse(0.18, -0.01, 0.025, 0.012, 0, 0, TAU));
  // the mouth: a wide dark gap straight across the front of the head, a pale lower lip under it
  soft(g, res, 0.0012, 'rgba(6,8,10,0.95)', (q) => {
    q.moveTo(0.2, -ny + 0.01);
    q.lineTo(0.214, -ny + 0.012);
    q.quadraticCurveTo(0.219, 0.005, 0.212, ny + 0.014);
    q.lineTo(0.2, ny + 0.012);
    q.quadraticCurveTo(0.207, 0.004, 0.2, -ny + 0.01);
    q.closePath();
  });
  softStroke(g, res, 0.0008, 'rgba(214,222,228,0.55)', 0.002, (q) => {
    q.moveTo(0.211, ny + 0.002);
    q.quadraticCurveTo(0.216, ny + 0.012, 0.21, ny + 0.019);
  });
  // cephalic lobes, rolled into horns: far one above/behind, near one in front/below
  lobe(g, res, 0.197, -ny + 0.01, 0.06, 0.12, 0.8, dark, lift);
  lobe(g, res, 0.199, ny + 0.01, 0.068, -0.14, 1, dark, lift);
  // eyes on the sides of the head, just behind the lobes
  paintEye(g, 0.168, -ny - 0.002, 0.0058, { iris: '#2a2622', irisDark: '#050505', pupil: 0.6, sclera: null, look: { x: 0.4, y: -0.3 } });
  paintEye(g, 0.172, ny + 0.013, 0.0085, { iris: '#3d352b', irisDark: '#060606', pupil: 0.58, sclera: null, look: { x: 0.5, y: 0.2 } });
  if (L >= 2) soft(g, res, 0.002, 'rgba(0,0,0,0.55)', (q) => q.ellipse(0.148, ny + 0.006, 0.008, 0.003, 0, 0, TAU));
}

function lobe(g, res, x, y, l, ang, k, dark, lift) {
  // a cephalic fin rolled into a horn: broad at the head, tapering and curling inward, dark outer face with
  // the pale inner face showing along its inner edge
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const w = 0.026 * k, s = Math.sign(ang) || 1; // s: which side the inner edge faces
  const tip = w * 0.34; // blunt, rolled end
  const path = (q) => {
    q.moveTo(-0.006, -w * 0.6);
    q.bezierCurveTo(l * 0.4, -w * 0.58, l * 0.8, -w * 0.36 - s * w * 0.08, l - tip * 0.6, -tip - s * w * 0.1);
    q.arc(l - tip * 0.6, -s * w * 0.1, tip, -Math.PI / 2, Math.PI / 2);
    q.bezierCurveTo(l * 0.75, tip - s * w * 0.1 + w * 0.02, l * 0.35, w * 0.6, -0.006, w * 0.64);
    q.closePath();
  };
  const gr = g.createLinearGradient(0, -w * 0.6, 0, w * 0.6);
  gr.addColorStop(0, lift ? '#68717b' : '#2c323a');
  gr.addColorStop(0.55, dark);
  gr.addColorStop(1, lift ? '#59626c' : '#171a1f');
  g.fillStyle = gr;
  g.beginPath();
  path(g);
  g.fill();
  softStroke(g, res, 0.0016, 'rgba(206,214,220,0.6)', 0.003, (q) => {
    q.moveTo(l * 0.08, s * w * 0.5);
    q.bezierCurveTo(l * 0.35, s * w * 0.42, l * 0.6, s * w * 0.3, l * 0.82, s * w * 0.18);
  });
  softStroke(g, res, 0.002, 'rgba(160,178,192,0.3)', 0.002, (q) => {
    q.moveTo(0, -s * w * 0.55);
    q.bezierCurveTo(l * 0.35, -s * w * 0.55, l * 0.7, -s * w * 0.35, l * 0.9, -s * w * 0.2);
  });
  softStroke(g, res, 0.0012, 'rgba(5,6,8,0.6)', 0.0018, (q) => q.arc(l - tip * 0.7, -s * w * 0.1, tip * 0.55, 0.3, 3.8));
  g.restore();
}
