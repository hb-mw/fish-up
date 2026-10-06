// The fish entity shape + shared motion helpers. KERNEL FILE.
// Everything that swims (or sits on the seabed, or is an old boot) is one of these objects.
import { clamp, damp, lerp, TAU } from '../core/math.js';
import { lengthFor, weightFor, visualLength, SPECIES_BY_ID } from '../data/species.js';

let _uid = 1;

/** Sample a size quantile. Skewed small — trophies are rare. bias 0..1 shifts toward bigger fish. */
export function sampleSizeQ(rng, bias = 0) {
  const k = lerp(1.35, 0.8, clamp(bias, 0, 1)); // ≈ 17% tiny · 23% small · 26% average · 18% large · 10% huge · 5% trophy
  return Math.pow(rng.next(), k);
}

/**
 * Create a fish entity.
 * @param {object|string} species  species object or id
 * @param {object} opts  { x, y, sizeQ, rng, dir, shiny }
 */
export function createFish(species, opts = {}) {
  if (typeof species === 'string') species = SPECIES_BY_ID[species];
  const rng = opts.rng;
  const rand = rng ? rng.next : Math.random;
  const sizeQ = opts.sizeQ !== undefined ? clamp(opts.sizeQ, 0, 1) : rng ? sampleSizeQ(rng, opts.sizeBias || 0) : Math.pow(Math.random(), 1.35);
  const lengthCm = lengthFor(species, sizeQ);
  return {
    uid: _uid++,
    species,
    speciesId: species.id,
    // ── kinematics (world px, px/s) ──
    x: opts.x || 0,
    y: opts.y || 0,
    vx: 0,
    vy: 0,
    /** Facing: +1 = right, −1 = left. CONTINUOUS — it passes through 0 while the fish turns around (looks like a 3D turn). */
    dir: opts.dir || (rand() < 0.5 ? -1 : 1),
    /** Nose pitch in radians, in facing space: + = nose down, − = nose up. */
    pitch: 0,
    // ── the individual ──
    sizeQ,
    lengthCm,
    weightKg: weightFor(species, lengthCm),
    /** On-screen body length in logical px (snout → tail tip). */
    visualLen: visualLength(lengthCm),
    /** 0..1 random per individual — art uses it for subtle colour/pattern variation. */
    seed: rand(),
    /** Rare golden/sparkling variant: worth much more. */
    shiny: !!opts.shiny,
    // ── animation ──
    /** Tail-beat phase (radians, keeps increasing). */
    swimPhase: rand() * TAU,
    /** Swim intensity: ~0.25 idle hover · 0.6 cruise · 1.0 fast · 1.4 frantic burst. */
    swimAmp: 0.5,
    /** Mouth open 0..1 (biting, gasping). */
    mouth: 0,
    /** Draw alpha 0..1 (fade in/out when spawning/despawning). */
    alpha: 1,
    /** Bioluminescence intensity multiplier 0..1 (flicker it for life). */
    glowAmt: 1,
    // ── state ──
    /** 'swim' | 'curious' | 'approach' | 'nibble' | 'flee' | 'bite' | 'hooked' | 'landed' — free-form for AI; 'bite'/'hooked'/'landed' are set by gameplay. */
    state: 'swim',
    /** true while gameplay (the fishing module) owns this fish's movement: from bite acceptance until release/landing. */
    controlled: false,
    age: 0,
    /** Private scratch space for the fish-AI module. */
    ai: null,
  };
}

/**
 * Update a fish's facing, pitch and swim animation from its velocity. Call once per frame for every moving fish
 * (both the AI and the fishing module use this so all fish animate consistently).
 * opts: { maxPitch (rad, default 0.85), turnRate (default 7), tailRate (default 1) }
 */
export function orientFish(fish, dt, opts) {
  const maxPitch = (opts && opts.maxPitch) || 0.85;
  const turnRate = (opts && opts.turnRate) || 7;
  const tailRate = (opts && opts.tailRate) || 1;
  const vx = fish.vx, vy = fish.vy;
  const speed = Math.hypot(vx, vy);
  if (Math.abs(vx) > 3) {
    const target = vx > 0 ? 1 : -1;
    fish.dir = damp(fish.dir, target, turnRate, dt);
    if (Math.abs(fish.dir) > 0.985) fish.dir = target;
  } else if (Math.abs(fish.dir) < 0.985) {
    // finish any turn in progress
    fish.dir = damp(fish.dir, fish.dir >= 0 ? 1 : -1, turnRate, dt);
  }
  const pitchTarget = speed > 4 ? clamp(Math.atan2(vy, Math.abs(vx) + 0.001), -maxPitch, maxPitch) : 0;
  fish.pitch = damp(fish.pitch, pitchTarget, 5, dt);
  const bl = speed / Math.max(20, fish.visualLen); // body lengths per second
  fish.swimPhase += dt * (2.4 + bl * 5.2) * tailRate;
  fish.swimAmp = damp(fish.swimAmp, clamp(0.22 + bl * 0.5, 0.2, 1.5), 4, dt);
}
