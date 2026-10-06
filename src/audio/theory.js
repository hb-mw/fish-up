// Fish Up — a little music theory shared by the score (music.js) and the stingers (sfx.js).

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
export const PENTA_MAJOR = [0, 2, 4, 7, 9];
export const PENTA_MINOR = [0, 3, 5, 7, 10];

/** Semitone offset of scale degree d (0-based, may be negative or ≥ 7: wraps by octaves). */
export function degree(scale, d) {
  const n = scale.length;
  const o = Math.floor(d / n);
  return scale[((d % n) + n) % n] + 12 * o;
}
/** Chord on scale degree `deg`: stacked thirds, `n` notes (3 = triad, 4 = seventh, 5 = ninth). */
export function chord(scale, deg, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(degree(scale, deg + i * 2));
  return out;
}
/** Is semitone offset `s` (from the key root) inside the scale? */
export function inScale(scale, s) {
  return scale.includes(((s % 12) + 12) % 12);
}

/**
 * The Fish Up! title motif — [semitones from the key root, start beat, length in beats].
 * "G C E | D E G~ · E A G~" — a sunny rising hook, quoted by the bigger catch fanfares.
 */
export const MOTIF = [
  [7, 0, 0.5], [12, 0.5, 0.5], [16, 1, 1], [14, 2, 0.5], [16, 2.5, 0.5], [19, 3, 1.5],
  [16, 4.5, 0.5], [21, 5, 1], [19, 6, 2],
];
/** Its answer phrase (resolves to the root). */
export const MOTIF_ANSWER = [
  [21, 0, 0.5], [19, 0.5, 0.5], [16, 1, 1], [12, 2, 0.5], [14, 2.5, 0.5], [16, 3, 1], [14, 4, 1], [12, 5, 3],
];
