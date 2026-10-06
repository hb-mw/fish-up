// Fish Up — the score's instruments. Each call schedules ONE voice on the music bus (a note, a chord
// or a drum hit) at audio time t, built from the synth.js primitives. `n` = MIDI note, `g` = velocity 0..1+.
import { kalimba, marimba, bell, epiano, pluck, bass, pad, brass, choir, tone, noise, thump, cymbal, midi } from './synth.js';

const M = midi;
const max = Math.max;

function play(mix, name, t, o, fn) {
  const v = mix.voice(name, 'music', {
    t,
    gain: o.gain !== undefined ? o.gain : 1,
    pan: o.pan || 0,
    rev: o.rev !== undefined ? o.rev : 0.22,
    dly: o.dly || 0,
    poly: o.poly || 12,
    prio: 0.5,
    rng: o.rng,
  });
  let end;
  try {
    end = fn(v, v.t);
  } catch (e) {
    v.finish(v.t + 0.01);
    throw e;
  }
  v.finish(Number.isFinite(end) ? end : v.t + 1);
  return end;
}

export const INST = {
  // ── melodic ──
  kalimba: (mix, t, n, g = 1, o = {}) => play(mix, 'm_kalimba', t, { rev: 0.26, dly: 0.12, ...o }, (v, t0) => kalimba(v, M(n), t0, 0.2 * g, o.decay || 1.1)),
  marimba: (mix, t, n, g = 1, o = {}) => play(mix, 'm_marimba', t, { rev: 0.2, ...o }, (v, t0) => marimba(v, M(n), t0, 0.2 * g, o.decay || 0.7)),
  bell: (mix, t, n, g = 1, o = {}) => play(mix, 'm_bell', t, { rev: 0.4, dly: 0.15, ...o }, (v, t0) => bell(v, M(n), t0, 0.08 * g, o.decay || 2.2)),
  epiano: (mix, t, n, g = 1, o = {}) => play(mix, 'm_epiano', t, { rev: 0.25, ...o }, (v, t0) => epiano(v, M(n), t0, 0.12 * g, o.hold || 0.5)),
  pizz: (mix, t, n, g = 1, o = {}) => play(mix, 'm_pizz', t, { rev: 0.14, ...o }, (v, t0) => pluck(v, M(n), t0, 0.16 * g, o.decay || 0.4, o.bright || 1)),
  lead: (mix, t, n, g = 1, o = {}) =>
    play(mix, 'm_lead', t, { rev: 0.25, dly: 0.1, ...o }, (v, t0) => brass(v, [M(n)], { t: t0, a: 0.03, hold: o.hold || 0.3, r: 0.12, g: 0.1 * g, bright: 2600, vib: 8 })),

  // ── chords ──
  /** Marimba chord hit (the tropical off-beat comp). */
  marimbaChord: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_comp', t, { rev: 0.18, ...o }, (v, t0) => max(...ns.map((n) => marimba(v, M(n), t0, (0.11 * g) / Math.sqrt(ns.length / 3), 0.45)))),
  kalimbaChord: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_comp', t, { rev: 0.25, ...o }, (v, t0) => max(...ns.map((n, i) => kalimba(v, M(n), t0 + i * 0.012, (0.1 * g) / Math.sqrt(ns.length / 3), 0.9)))),
  epianoChord: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_comp', t, { rev: 0.28, ...o }, (v, t0) => max(...ns.map((n) => epiano(v, M(n), t0, (0.045 * g) / Math.sqrt(ns.length / 3), o.hold || 0.8)))),
  pad: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_pad', t, { rev: 0.4, poly: 4, ...o }, (v, t0) =>
      pad(v, ns.map(M), { t: t0, type: o.type || 'triangle', a: o.a || 0.9, hold: o.hold || 2, r: o.r || 1.4, g: 0.016 * g, lp: o.lp || 1500, detune: o.detune })),
  /** String tremolo for tension: a bright saw pad chopped by a fast LFO. */
  tremolo: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_trem', t, { rev: 0.3, poly: 3, ...o }, (v, t0) => {
      const chop = v.gain(0.5);
      const lfo = v.osc('sine', o.rate || 11, t0);
      const lg = v.gain(0.45);
      lfo.connect(lg);
      lg.connect(chop.gain);
      chop.connect(v.out);
      return pad(v, ns.map(M), { t: t0, type: 'sawtooth', a: o.a || 0.25, hold: o.hold || 1.5, r: 0.4, g: 0.022 * g, lp: o.lp || 2600, detune: 9, dest: chop });
    }),
  stab: (mix, t, ns, g = 1, o = {}) => play(mix, 'm_stab', t, { rev: 0.2, ...o }, (v, t0) => brass(v, ns.map(M), { t: t0, a: 0.015, hold: o.hold || 0.12, r: 0.12, g: 0.1 * g, bright: o.bright || 2400 })),
  choir: (mix, t, ns, g = 1, o = {}) => play(mix, 'm_choir', t, { rev: 0.45, poly: 3, ...o }, (v, t0) => choir(v, ns.map(M), { t: t0, a: o.a || 1.2, hold: o.hold || 2, r: o.r || 1.5, g: 0.03 * g })),
  bass: (mix, t, n, g = 1, o = {}) => play(mix, 'm_bass', t, { rev: 0.04, ...o }, (v, t0) => bass(v, M(n), t0, 0.09 * g, o.hold || 0.35)),
  /** Long low drone note (deep water / abyss). */
  drone: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_drone', t, { rev: 0.5, poly: 3, ...o }, (v, t0) => pad(v, ns.map(M), { t: t0, type: 'sine', a: o.a || 2.5, hold: o.hold || 4, r: o.r || 3, g: 0.04 * g, lp: 600, detune: 4 })),

  // ── percussion ──
  kick: (mix, t, g = 1, o = {}) => play(mix, 'm_kick', t, { rev: 0.02, poly: 4, ...o }, (v, t0) => thump(v, { t: t0, f0: 125, f1: 46, glide: 0.06, g: 0.4 * g, d: 0.09 })),
  shaker: (mix, t, g = 1, o = {}) =>
    play(mix, 'm_shaker', t, { rev: 0.06, poly: 6, ...o }, (v, t0) => noise(v, { t: t0, kind: 'white', type: 'bandpass', f: 7600, q: 1.1, g: 0.07 * g, a: 0.008, d: 0.018 })),
  bongo: (mix, t, hi, g = 1, o = {}) => {
    const f = hi ? 385 : 290;
    return play(mix, 'm_bongo', t, { rev: 0.12, poly: 4, ...o }, (v, t0) => tone(v, { t: t0, f, f2: f * 0.92, glide: 0.04, g: 0.15 * g, a: 0.001, d: 0.05 }));
  },
  rim: (mix, t, g = 1, o = {}) =>
    play(mix, 'm_rim', t, { rev: 0.12, poly: 3, ...o }, (v, t0) =>
      max(noise(v, { t: t0, kind: 'white', type: 'bandpass', f: 1900, q: 3, g: 0.12 * g, a: 0.0005, d: 0.008 }), tone(v, { t: t0, f: 830, g: 0.05 * g, d: 0.015 }))),
  brush: (mix, t, g = 1, o = {}) =>
    play(mix, 'm_brush', t, { rev: 0.12, poly: 3, ...o }, (v, t0) => noise(v, { t: t0, kind: 'pink', type: 'bandpass', f: 3200, q: 0.6, g: 0.06 * g, a: 0.05, d: 0.07 })),
  tom: (mix, t, g = 1, o = {}) => {
    const f = o.f || 95;
    return play(mix, 'm_tom', t, { rev: 0.18, poly: 4, ...o }, (v, t0) =>
      max(tone(v, { t: t0, f, f2: f * 0.8, glide: 0.12, g: 0.34 * g, a: 0.002, d: 0.16 }), noise(v, { t: t0, kind: 'brown', type: 'lowpass', f: 700, g: 0.2 * g, a: 0.001, d: 0.04 })));
  },
  hat: (mix, t, g = 1, o = {}) =>
    play(mix, 'm_hat', t, { rev: 0.04, poly: 6, ...o }, (v, t0) => noise(v, { t: t0, kind: 'white', type: 'highpass', f: 8000, q: 0.7, g: 0.05 * g, a: 0.001, d: 0.012 })),
  crash: (mix, t, g = 1, o = {}) => play(mix, 'm_crash', t, { rev: 0.3, poly: 2, ...o }, (v, t0) => cymbal(v, { t: t0, g: 0.07 * g, d: 1.8 })),
  /** "deflate": a chord whose pitch sags an octave while the filter closes (a lost fish). */
  deflate: (mix, t, ns, g = 1, o = {}) =>
    play(mix, 'm_deflate', t, { rev: 0.3, poly: 1, ...o }, (v, t0) => {
      const lp = v.filter('lowpass', 2400, 1.5);
      lp.frequency.setValueAtTime(2400, t0);
      lp.frequency.exponentialRampToValueAtTime(300, t0 + 1.3);
      const env = v.gain(0);
      lp.connect(env);
      env.connect(v.out);
      for (const n of ns) {
        const osc = v.osc('sawtooth', M(n), t0);
        osc.frequency.setValueAtTime(M(n), t0 + 0.15);
        osc.frequency.exponentialRampToValueAtTime(M(n) / 2, t0 + 1.3);
        const gg = v.gain(1 / ns.length);
        osc.connect(gg);
        gg.connect(lp);
      }
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(0.12 * g, t0 + 0.03);
      env.gain.setTargetAtTime(0, t0 + 0.6, 0.25);
      return t0 + 2.4;
    }),
};
