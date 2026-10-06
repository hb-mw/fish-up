// Fish Up — under-water ambience layers (same layer shape as amb-above.js). They feed the 'under'
// submix, which ambience.js fades in as the camera goes below the surface.
import { LANDMARKS } from '../world/terrain.js';
import { driveCurve } from './synth.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** 0 at the surface … 1 at the bottom of the world (view centre). */
export const depthK = (I) => smoothstep(0, 6200, I.viewDepth);
/** Coral-reef proximity in the shallows (snapping shrimp). */
export const reefK = (I) => smoothstep(500, 900, I.camX) * (1 - smoothstep(2700, 3400, I.camX)) * (1 - smoothstep(350, 1000, I.viewDepth));
/** Hydrothermal vent proximity (trench floor around x≈11300). */
export function ventK(I) {
  let d = Infinity;
  for (const v of LANDMARKS.vents) d = Math.min(d, Math.hypot(I.camX - v.x, (I.camY - v.y) * 1.2));
  return 1 - smoothstep(250, 1500, d);
}
/** Drone character by depth: [freqA, ratioB, gainA, gainB, gainC] keyed at twilight, midnight, abyss. */
const DRONE = [
  { y: 1500, a: 55, rb: 1.5, ga: 0.5, gb: 0.35, gc: 0.25, sw: 0.09 },
  { y: 3600, a: 46.2, rb: 1.5, ga: 0.55, gb: 0.18, gc: 0.12, sw: 0.07 },
  { y: 5600, a: 36.7, rb: 1.036, ga: 0.5, gb: 0.45, gc: 0.3, sw: 0.05 },
  { y: 7200, a: 34.6, rb: 1.04, ga: 0.55, gb: 0.5, gc: 0.35, sw: 0.045 },
];
function droneAt(y) {
  if (y <= DRONE[0].y) return DRONE[0];
  for (let i = 1; i < DRONE.length; i++) {
    if (y <= DRONE[i].y) {
      const a = DRONE[i - 1], b = DRONE[i], t = smoothstep(a.y, b.y, y);
      const o = {};
      for (const k of ['a', 'rb', 'ga', 'gb', 'gc', 'sw']) o[k] = lerp(a[k], b[k], t);
      return o;
    }
  }
  return DRONE[DRONE.length - 1];
}

export const UNDER = {
  // The water itself: a deep rumble that sinks with depth, and the muffled surface (waves, rain) above.
  bed: {
    dest: 'under',
    build(a) {
      const r = a.src(a.B.brown), rlp = a.filter('lowpass', 220, 0.7), rg = a.gain(0.8);
      const s = a.src(a.B.pink), sbp = a.filter('bandpass', 520, 0.7), sg = a.gain(0.3);
      r.connect(rlp);
      rlp.connect(rg);
      rg.connect(a.out);
      s.connect(sbp);
      sbp.connect(sg);
      sg.connect(a.out);
      return { rlp, rg, sbp, sg };
    },
    level: (I) => 0.11 * (1 - 0.4 * depthK(I)),
    control(p, I, set) {
      const k = depthK(I);
      set(p.rlp.frequency, lerp(260, 95, k), 0.6);
      set(p.rg.gain, 0.8 + 0.5 * k, 0.6);
      const surf = (1 - smoothstep(200, 2200, I.viewDepth)) * (0.5 + 0.35 * clamp01(I.sea / 2) + 0.6 * I.rain);
      set(p.sg.gain, 0.55 * surf, 0.6);
      set(p.sbp.frequency, lerp(650, 380, k) + 300 * I.rain, 0.6);
    },
  },

  // Snapping-shrimp crackle of the living reef.
  crackle: {
    dest: 'under',
    build(a) {
      const s = a.src(a.B.crackle), hp = a.filter('highpass', 1800, 0.6), g = a.gain(1);
      s.connect(hp);
      hp.connect(g);
      g.connect(a.out);
      return {};
    },
    level: (I) => 0.06 * reefK(I),
    control() {},
  },

  // Zone drones: open fifths in the twilight, a thin hum at midnight, beating sub-bass unease in the abyss.
  // Upper harmonics (soft drive + 3rd osc) keep it audible on laptop speakers.
  drone: {
    dest: 'under',
    build(a) {
      const oa = a.osc('sine', 55), ob = a.osc('sine', 82.5), oc = a.osc('triangle', 110);
      const ga = a.gain(0.5), gb = a.gain(0.3), gc = a.gain(0.2);
      oa.connect(ga);
      ob.connect(gb);
      oc.connect(gc);
      const sum = a.gain(1), drive = a.shaper(driveCurve(1.8)), lp = a.filter('lowpass', 420, 0.7);
      [ga, gb, gc].forEach((g) => g.connect(sum));
      sum.connect(drive);
      drive.connect(lp);
      const swell = a.gain(0.75), lfo = a.osc('sine', 0.07), lg = a.gain(0.25);
      lfo.connect(lg);
      lg.connect(swell.gain);
      lp.connect(swell);
      swell.connect(a.out);
      return { oa, ob, oc, ga, gb, gc, lfo, lp };
    },
    level: (I) => 0.05 * smoothstep(1100, 2600, I.viewDepth) * (0.7 + 0.3 * smoothstep(5000, 6400, I.viewDepth)),
    control(p, I, set) {
      const d = droneAt(I.viewDepth);
      set(p.oa.frequency, d.a, 1.5);
      set(p.ob.frequency, d.a * d.rb, 1.5);
      set(p.oc.frequency, d.a * 2.01, 1.5);
      set(p.ga.gain, d.ga, 1.2);
      set(p.gb.gain, d.gb, 1.2);
      set(p.gc.gain, d.gc, 1.2);
      set(p.lfo.frequency, d.sw, 2);
      set(p.lp.frequency, lerp(520, 300, depthK(I)), 1.5);
    },
  },

  // Hydrothermal vents: a low roar, a throbbing rumble and dense boiling bubbles.
  vents: {
    dest: 'under',
    build(a) {
      const r = a.src(a.B.brown), rlp = a.filter('lowpass', 170, 0.8), rg = a.gain(1);
      const t = a.src(a.B.brown, 0.5), tbp = a.filter('bandpass', 58, 1.6), tg = a.gain(1.4);
      const b = a.src(a.B.droplets, 0.45), blp = a.filter('lowpass', 1100, 0.7), bg = a.gain(0.5);
      r.connect(rlp);
      rlp.connect(rg);
      t.connect(tbp);
      tbp.connect(tg);
      b.connect(blp);
      blp.connect(bg);
      [rg, tg, bg].forEach((g) => g.connect(a.out));
      return {};
    },
    level: (I) => 0.1 * ventK(I),
    control() {},
  },
};
