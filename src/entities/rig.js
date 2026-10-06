// Boat ↔ rod geometry shared by physics (where the line attaches) and art (where the rod is drawn). KERNEL FILE.
//
// BOAT-LOCAL SPACE: origin = the hull's waterline centre. +x points toward the BOW, −y is up.
// To draw in boat-local space:   ctx.translate(boat.x, boat.y); ctx.rotate(boat.tilt); ctx.scale(boat.facing, 1);
//
// The angler stands near the bow and holds the rod at RIG.grip. The rod leaves the grip at `boat.rodAngle`
// (radians above horizontal-forward: 0 = pointing straight ahead, π/2 = straight up, >π/2 = leaning back over the shoulder)
// and droops toward the water as `boat.rodBend` (0..1) increases.

export const RIG = {
  /** Hull length of the tier-0 boat at the waterline (px). Bigger tiers may be longer, but keep the grip where it is. */
  hullLength: 380,
  /** Where the rod is held, boat-local px. Art MUST put the angler's hands here. */
  grip: { x: 96, y: -108 },
  /** Grip → tip length in px. */
  rodLength: 215,
  /** Number of sample points along the rod (grip … tip). */
  segments: 10,
  /** Where a landed fish is held up for the "FISH UP!" pose, boat-local px. */
  trophy: { x: 125, y: -135 },
  /** Lamp position (night fishing light), boat-local px. */
  lamp: { x: -120, y: -150 },
};

/** boat-local → world */
export function boatToWorld(boat, lx, ly, out = {}) {
  const c = Math.cos(boat.tilt), s = Math.sin(boat.tilt);
  const fx = lx * boat.facing;
  out.x = boat.x + fx * c - ly * s;
  out.y = boat.y + fx * s + ly * c;
  return out;
}

/**
 * Recompute boat.rod = { grip:{x,y}, tip:{x,y}, pts:[{x,y}×(segments+1)], tipAngle } in WORLD coords.
 * The kernel calls this every frame after the boat controller has updated. Art draws the rod through `pts`;
 * the fishing line starts at `tip`.
 */
export function computeRod(boat) {
  const rod = boat.rod;
  const n = RIG.segments;
  const seg = RIG.rodLength / n;
  let lx = RIG.grip.x, ly = RIG.grip.y;
  let pt = rod.pts[0] || (rod.pts[0] = { x: 0, y: 0 });
  boatToWorld(boat, lx, ly, pt);
  rod.grip.x = pt.x;
  rod.grip.y = pt.y;
  let ang = boat.rodAngle;
  for (let i = 1; i <= n; i++) {
    const s = (i - 0.5) / n;
    // progressive curvature: stiff butt, whippy tip
    ang = boat.rodAngle - boat.rodBend * 1.55 * Math.pow(s, 1.7);
    lx += Math.cos(ang) * seg;
    ly -= Math.sin(ang) * seg;
    pt = rod.pts[i] || (rod.pts[i] = { x: 0, y: 0 });
    boatToWorld(boat, lx, ly, pt);
  }
  rod.tip.x = pt.x;
  rod.tip.y = pt.y;
  rod.tipAngle = ang;
  return rod;
}
