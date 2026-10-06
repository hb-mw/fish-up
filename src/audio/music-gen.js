// Fish Up — composition rules for the generative score: moods, progressions, voicing, motifs, patterns.
import { SCALES, PENTA_MAJOR, PENTA_MINOR, degree, chord } from './theory.js';

/** Mood presets. progs = chord degrees in `scale` (one chord per `bpc` bars). */
export const MOODS = {
  title: { bpm: 96, swing: 0.1, scale: 'major', n: 3, bpc: 1, progs: [[0, 3, 5, 0], [0, 3, 5, 4]], energy: 0.85, lead: 'kalimba', comp: 'marimba', bass: 'pop', perc: 'day', pad: 0.25, rest: 0, melody: 1 },
  day: { bpm: 92, swing: 0.12, scale: 'major', n: 3, bpc: 1, progs: [[0, 4, 5, 3], [0, 3, 0, 4], [0, 5, 3, 4], [3, 4, 2, 5], [0, 2, 3, 4], [5, 3, 0, 4], [0, 3, 1, 4]], energy: 0.65, lead: 'kalimba', comp: 'marimba', bass: 'pop', perc: 'day', pad: 0.25, rest: 0.1, melody: 0.75 },
  dawn: { bpm: 80, swing: 0.08, scale: 'major', n: 4, bpc: 1, progs: [[0, 3, 5, 4], [3, 0, 4, 0], [0, 4, 3, 3], [5, 3, 0, 4]], energy: 0.42, lead: 'bell', comp: 'arp', bass: 'soft', perc: 'light', pad: 0.55, rest: 0.14, melody: 0.5 },
  dusk: { bpm: 74, swing: 0.15, scale: 'major', n: 4, bpc: 1, progs: [[3, 2, 5, 0], [1, 4, 0, 5], [0, 5, 1, 4], [3, 4, 2, 5]], energy: 0.45, lead: 'kalimba', comp: 'epiano', bass: 'soft', perc: 'brush', pad: 0.5, rest: 0.15, melody: 0.55 },
  night: { bpm: 62, swing: 0.06, scale: 'lydian', n: 4, bpc: 2, progs: [[0, 1], [0, 5, 3, 4], [5, 3, 0, 0], [0, 3]], energy: 0.2, lead: 'bell', comp: 'none', bass: 'drone', perc: 'none', pad: 1, rest: 0.28, melody: 0.35 },
  deep: { bpm: 60, swing: 0, scale: 'dorian', n: 4, bpc: 2, progs: [[0, 5], [0, 3], [0, 6, 5, 3]], energy: 0.15, lead: 'bell', comp: 'none', bass: 'drone', perc: 'none', pad: 1, rest: 0.35, melody: 0.25 },
  abyss: { bpm: 54, swing: 0, scale: 'phrygian', n: 3, bpc: 4, progs: [[0, 1]], energy: 0.05, lead: 'none', comp: 'none', bass: 'none', perc: 'none', pad: 'drone', rest: 0.3, melody: 0.12 },
};
/** Fight harmony: playful (major) for small fish, minor and driving for big ones. */
export const FIGHT_PROGS = {
  light: { scale: 'major', progs: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 5, 3, 4]] },
  dark: { scale: 'minor', progs: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 5, 6, 0], [0, 6, 5, 4]] },
};

export const scaleOf = (name) => SCALES[name] || SCALES.major;
/** Chord tones (semitones from the key root) of degree d in a scale, n notes. */
export const chordRels = (scaleName, d, n) => chord(scaleOf(scaleName), d, n);

/** Close voicing near `target` (MIDI), keeping voice movement small. */
export function voiceChord(root, rels, prev, center) {
  const target = prev && prev.length ? (prev.reduce((a, b) => a + b, 0) / prev.length) * 0.6 + center * 0.4 : center;
  const out = rels.map((r) => {
    let n = root + r;
    while (n < target - 6) n += 12;
    while (n > target + 6) n -= 12;
    return n;
  });
  return out.sort((a, b) => a - b);
}

// ── melody ─────────────────────────────────────────────────────────────────────────────────────
/** One-bar rhythm cells: [onset16, length16]. The first ones are sparse, the last ones busy. */
const CELLS = [
  [[0, 8], [10, 6]],
  [[4, 4], [12, 4]],
  [[0, 6], [8, 8]],
  [[0, 3], [3, 3], [6, 10]],
  [[0, 4], [6, 2], [8, 2], [10, 6]],
  [[2, 2], [4, 2], [6, 4], [12, 4]],
  [[0, 3], [3, 3], [6, 2], [8, 6], [14, 2]],
  [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 2], [3, 1], [4, 4], [8, 2], [11, 1], [12, 4]],
];
/** A motif: rhythm cell + contour (pentatonic steps relative to the bar's anchor). */
export function makeMotif(rnd, energy) {
  const hi = Math.min(CELLS.length - 1, Math.floor(2 + energy * 8));
  const lo = Math.max(0, hi - 5);
  const cell = CELLS[lo + Math.floor(rnd() * (hi - lo + 1))];
  const contour = [];
  let d = 0;
  for (let i = 0; i < cell.length; i++) {
    if (i > 0) {
      const r = rnd();
      d += r < 0.32 ? 1 : r < 0.62 ? -1 : r < 0.74 ? 2 : r < 0.86 ? -2 : r < 0.93 ? 0 : rnd() < 0.5 ? 3 : -3;
      d = Math.max(-3, Math.min(5, d));
    }
    contour.push(d);
  }
  return { cell, contour, lift: rnd() < 0.5 ? 1 : 2 };
}
const nearestTone = (n, rels) => {
  let best = n, bd = 99;
  for (const r of rels) {
    for (let o = -2; o <= 2; o++) {
      const c = n - (((n % 12) + 12) % 12) + (((r % 12) + 12) % 12) + o * 12;
      const d = Math.abs(c - n);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  }
  return best;
};
/**
 * Notes for bar `b` (0..3) of a 4-bar phrase built on motif m: [{on, len, n, vel}].
 * bar 0 = statement · 1 = sequence (lifted) · 2 = inverted variation · 3 = cadence on a chord tone.
 */
export function phraseBar(m, b, root, rels, minor, rnd, density = 1) {
  const P = minor ? PENTA_MINOR : PENTA_MAJOR;
  const base = root + 12;
  if (b === 3) {
    const land = nearestTone(base + degree(P, rnd() < 0.5 ? 0 : 2), rels.slice(0, 2));
    const out = [{ on: 0, len: 4, n: nearestTone(land + (rnd() < 0.5 ? 2 : -3), rels), vel: 0.8 }, { on: 4, len: 10, n: land, vel: 0.95 }];
    if (rnd() < 0.5) out.unshift({ on: -2, len: 2, n: land + 4, vel: 0.6 });
    return out.filter((x) => x.on >= 0);
  }
  const anchor = b === 1 ? m.lift : 0;
  const out = [];
  m.cell.forEach(([on, len], i) => {
    if (i > 0 && density < 1 && rnd() > density) return;
    const c = b === 2 ? -m.contour[i] : m.contour[i];
    let n = base + degree(P, anchor + c);
    if (on % 8 === 0) n = nearestTone(n, rels);
    out.push({ on, len, n, vel: on % 4 === 0 ? 0.9 : 0.7 });
  });
  return out;
}

// ── accompaniment patterns (16 steps per bar) ─────────────────────────────────────────────────
export const COMP_RHYTHMS = [[6, 14], [2, 6, 10, 14], [0, 6, 10, 14], [3, 6, 10, 14]];
export const PERC = {
  day: { kick: [[0, 0.9], [8, 0.55]], shaker: [[2, 0.6], [6, 1], [10, 0.6], [14, 1], [4, 0.3], [12, 0.3]], bongo: [[3, 1, 0.8], [6, 0, 0.7], [11, 1, 0.8], [14, 0, 0.6]] },
  light: { shaker: [[2, 0.5], [6, 0.8], [10, 0.5], [14, 0.8]] },
  brush: { kick: [[0, 0.6]], brush: [[4, 1], [12, 1]], rim: [[10, 0.5]] },
  none: {},
};
export const FIGHT_PERC = {
  playful: { shaker: [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, s % 4 === 2 ? 1 : 0.55]), bongo: [[0, 0, 0.9], [3, 1, 0.8], [6, 0, 0.7], [10, 1, 0.8], [12, 0, 0.7], [14, 1, 0.6]] },
  driving: { kick: [[0, 1], [4, 0.8], [8, 1], [12, 0.8]], rim: [[4, 0.8], [12, 0.9]], hat: [2, 6, 10, 14].map((s) => [s, 0.8]) },
  epic: { kick: [[0, 1], [8, 0.9]], tom: [[0, 1, 80], [3, 0.7, 80], [6, 0.8, 110], [8, 0.9, 80], [10, 0.7, 110], [11, 0.6, 110], [12, 0.9, 80], [14, 0.8, 140]], hat: [2, 6, 10, 14].map((s) => [s, 0.7]) },
};
