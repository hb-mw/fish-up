// Fishing-line geometry + lure flight. GAMEPLAY helper (used by src/gameplay/fishing.js).
//
// The line is an ANALYTIC curve, not a simulation: it is stable at any length (up to the whole 7200 px water
// column), costs nothing and never jitters. Its shape is driven by how much line is off the spool beyond the
// straight-line distance (`extra`): zero → bar-taut, a lot → a deep belly that hangs under gravity in the water
// (or trails behind the boat when the line is nearly vertical).
import { clamp, clamp01 } from '../core/math.js';

const MAX_POINTS = 28;
const GRAVITY = 900;      // px/s² on the flying lure
const AIR_DRAG = 0.16;    // 1/s
const LAUNCH_ANGLE = 0.66; // radians above horizontal (~38°)

/**
 * How much line may be off the spool: the spool (line.max) plus the air gap between the rod tip and the water,
 * so that `lineLengthM` really is the depth you can reach rather than being eaten by the rod's height.
 */
export const spoolLimit = (line, tip, surfaceY) => line.max + Math.max(0, surfaceY - tip.y);

/** Cast distance in px for a charge `power` 0..1 (before stats.castPower). */
export const castRange = (power) => 160 + 660 * Math.pow(clamp01(power), 1.35);

/**
 * Launch velocity for a wanted range (flat-ground ballistic estimate, nudged up to pay for air drag and
 * down for the rod tip's height above the water).
 */
export function launchVelocity(rangePx, facing) {
  const v0 = Math.sqrt((rangePx * GRAVITY) / Math.sin(2 * LAUNCH_ANGLE)) * 1.02;
  return { vx: Math.cos(LAUNCH_ANGLE) * v0 * facing, vy: -Math.sin(LAUNCH_ANGLE) * v0 };
}

/** One integration step of the lure in the air. */
export function flyStep(lure, dt) {
  lure.vy += GRAVITY * dt;
  const k = Math.max(0, 1 - AIR_DRAG * dt);
  lure.vx *= k;
  lure.vy *= k;
  lure.x += lure.vx * dt;
  lure.y += lure.vy * dt;
}

/**
 * Fill `line.points` with a curve from the rod tip to (ex, ey) and set `line.slack`.
 *  extra   px of line out beyond the straight distance (≥ 0): the belly grows with it
 *  mode    'air' (a shallow trailing bow) | 'water' (a gravity belly, drifting with `driftX`)
 *  driftX  −1..1 sideways direction the belly leans when the line hangs nearly vertical (−boat.vx sign)
 */
export function buildLine(line, tip, ex, ey, extra, mode, driftX = 0) {
  const pts = line.points;
  const dx = ex - tip.x, dy = ey - tip.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) {
    pts.length = 0;
    line.slack = 0;
    return;
  }
  const ux = dx / d, uy = dy / d;
  extra = Math.max(0, extra);
  // chain approximation: a chain of length d+extra spanning d hangs by h ≈ √(3·d·extra/8)
  let h = Math.sqrt((3 * d * extra) / 8);
  const hMax = mode === 'air' ? 24 + d * 0.06 : 60 + d * 0.3;
  h = Math.min(h, hMax);
  line.slack = clamp01(extra / Math.max(30, d * 0.1));
  // belly direction: gravity projected perpendicular to the chord; when the chord is nearly vertical the
  // belly leans sideways instead (behind the boat's motion / away from the rod)
  let nx = -uy, ny = ux; // chord rotated +90°
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const vertical = 1 - clamp01(Math.abs(ny) / 0.35);
  if (vertical > 0) {
    const sx = driftX !== 0 ? Math.sign(driftX) : -Math.sign(nx || 1);
    nx = nx * (1 - vertical) + sx * vertical;
    ny = ny * (1 - vertical);
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    h *= 1 - 0.5 * vertical;
  }
  const n = clamp(Math.round(d / 55) + 2, 4, MAX_POINTS - 1);
  pts.length = n + 1;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    // asymmetric parabola: the weight sits toward the lure end of the belly
    const sag = mode === 'air' ? 4 * k * (1 - k) * (1.2 - 0.4 * k) : 4 * k * (1 - k) * (0.7 + 0.6 * k);
    let p = pts[i];
    if (!p) p = pts[i] = { x: 0, y: 0 };
    p.x = tip.x + dx * k + nx * h * sag;
    p.y = tip.y + dy * k + ny * h * sag;
  }
}

/** Angle for drawing the lure: its head (line tie) points back along the line toward the previous point. */
export function lureAngle(line, lure) {
  const pts = line.points;
  if (pts.length < 2) return lure.angle;
  const p = pts[pts.length - 2];
  return Math.atan2(p.y - lure.y, p.x - lure.x);
}
