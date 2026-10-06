// Fish Up — one-shot sound recipes.
// Registry entry: { bus, cat, sub?, poly, gap, gain, rev, dly, fn(v, o) → endTime }
//   cat  ui | tick | sfx | alert | fanfare | stinger | amb   (loudness class — see dev/audio-lab.js)
//   sub  'above' | 'under' → routed through the ambience above/under-water submix (muffled by depth)
// `o` carries the play() options (volume, pitch, pan, size, power, quality, rarity, root …).
// All musical stingers are built on `o.root` (MIDI note of the music's current key) so they always
// sit in tune with the score.
import { tone, noise, texture, fm, bell, kalimba, marimba, epiano, pluck, thump, tick, whoosh, boom, pad, brass, choir, cymbal, roll, creak, glide, asr, midi } from './synth.js';
import { MOTIF, PENTA_MAJOR, degree } from './theory.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const max = Math.max;
const M = (n) => midi(n);
const maj = (R) => [R, R + 4, R + 7];

// ── shared little gestures ─────────────────────────────────────────────────────────────────────
function shaker(v, t, g = 0.03) {
  return noise(v, { t, kind: 'white', type: 'highpass', f: 6500, q: 0.7, g, a: 0.004, d: 0.018 });
}
function bongo(v, t, f = 320, g = 0.1) {
  return tone(v, { t, f, f2: f * 0.9, glide: 0.04, g, a: 0.001, d: 0.045 });
}
/** Random high pentatonic glitter over `dur` seconds (shiny / treasure). */
function shimmer(v, t, dur, R, g = 0.03, n = 14) {
  let end = t;
  for (let i = 0; i < n; i++) {
    const at = t + (dur * i) / n + v.rng() * 0.03;
    const st = degree(PENTA_MAJOR, 10 + Math.floor(v.rng() * 7));
    end = max(end, bell(v, M(R + 12 + st), at, g * (0.6 + 0.4 * v.rng()), 0.9));
  }
  end = max(end, cymbal(v, { t, a: dur * 0.5, g: g * 0.8, d: dur }));
  return end;
}
function stamp(v, t, R) {
  const e = [
    thump(v, { t, f0: 170, f1: 58, glide: 0.06, g: 0.5, d: 0.07 }),
    noise(v, { t, kind: 'white', type: 'bandpass', f: 1600, q: 0.9, g: 0.22, a: 0.001, d: 0.035 }),
  ];
  for (const dt of [0.006, 0.019, 0.033]) e.push(noise(v, { t: t + dt, kind: 'white', type: 'bandpass', f: 1150, q: 1.3, g: 0.13, a: 0.001, d: 0.012 }));
  e.push(brass(v, [M(R + 12), M(R + 16), M(R + 19)], { t: t + 0.07, a: 0.03, hold: 0.22, r: 0.2, g: 0.07, bright: 2800 }));
  return max(...e);
}
function releaseChime(v, t, R) {
  return max(
    bell(v, M(R + 19), t, 0.05, 2.6),
    bell(v, M(R + 24), t + 0.28, 0.045, 3.2),
    pad(v, [M(R + 12), M(R + 19)], { t, type: 'triangle', a: 0.5, hold: 0.5, r: 1.1, g: 0.035, lp: 1800 })
  );
}
function coinClinks(v, t, n, g = 0.045) {
  let end = t;
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.045 + v.rng() * 0.03);
    end = max(end, bell(v, 2300 + v.rng() * 2200, at, g * (0.6 + 0.4 * v.rng()), 0.45));
    end = max(end, tick(v, { t: at, f: 6000, q: 0.8, g: g * 0.6, d: 0.003 }));
  }
  return end;
}

// ── catch fanfares (by rarity) — each returns [end, landTime] ──────────────────────────────────
const FANFARES = {
  common(v, R) {
    const t = v.t, e = [];
    const seq = [[-5, 0], [0, 0.1], [4, 0.2], [7, 0.3]];
    for (const [st, dt] of seq) {
      e.push(kalimba(v, M(R + 12 + st), t + dt, 0.2, dt === 0.3 ? 1.3 : 0.8));
      e.push(marimba(v, M(R + st), t + dt, 0.1, 0.6));
    }
    e.push(bell(v, M(R + 31), t + 0.3, 0.06, 1.4));
    e.push(shaker(v, t + 0.1), shaker(v, t + 0.2), shaker(v, t + 0.3, 0.04));
    return [max(...e), t + 0.3];
  },
  uncommon(v, R) {
    const t = v.t, e = [];
    [0, 2, 4, 7, 9].forEach((st, i) => e.push(marimba(v, M(R + 12 + st), t + i * 0.07, 0.13, 0.5)));
    const land = t + 0.38;
    for (const st of [12, 16, 19, 24]) e.push(kalimba(v, M(R + st), land, 0.11, 1.4));
    for (const st of [0, 4, 7, 11]) e.push(epiano(v, M(R + st), land, 0.045, 0.6));
    e.push(bell(v, M(R + 28), land, 0.06, 1.8));
    e.push(bongo(v, t, 330, 0.08), bongo(v, t + 0.21, 300, 0.07), bongo(v, land, 270, 0.1));
    e.push(tone(v, { t: land, f: M(R - 12), type: 'triangle', g: 0.14, a: 0.005, hold: 0.25, r: 0.25, lp: 700 }));
    return [max(...e), land];
  },
  rare(v, R) {
    const t = v.t, e = [], beat = 0.13;
    const notes = MOTIF.slice(0, 6);
    for (const [st, b, len] of notes) {
      e.push(bell(v, M(R + st + 12), t + b * beat, 0.06, 1.2 + len));
      e.push(kalimba(v, M(R + st), t + b * beat, 0.14, 0.7 + len * 0.3));
    }
    const land = t + 3 * beat;
    e.push(pad(v, [M(R), M(R + 4), M(R + 7), M(R + 14)], { t, type: 'triangle', a: 0.35, hold: 0.7, r: 0.9, g: 0.07, lp: 1700 }));
    [24, 28, 31, 36].forEach((st, i) => e.push(bell(v, M(R + st), land + 0.12 + i * 0.05, 0.045, 1.5)));
    e.push(tone(v, { t: land, f: M(R - 12), type: 'triangle', g: 0.16, a: 0.005, hold: 0.4, r: 0.35, lp: 600 }));
    e.push(cymbal(v, { t, a: land - t, g: 0.035, d: 1.4 }));
    return [max(...e), land];
  },
  epic(v, R) {
    const t = v.t, e = [];
    e.push(roll(v, { t, n: 9, dur: 0.42, g: 0.2, timpani: true, f: M(R - 24) * 2 }));
    const t0 = t + 0.46;
    const I = [0, 4, 7, 12], IV = [5, 9, 12, 17], V = [7, 11, 14, 19], I2 = [12, 16, 19, 24];
    e.push(brass(v, I.map((s) => M(R + s)), { t: t0, a: 0.02, hold: 0.1, r: 0.08, g: 0.13 }));
    e.push(brass(v, IV.map((s) => M(R + s)), { t: t0 + 0.2, a: 0.02, hold: 0.08, r: 0.07, g: 0.12 }));
    e.push(brass(v, V.map((s) => M(R + s)), { t: t0 + 0.32, a: 0.02, hold: 0.1, r: 0.07, g: 0.12 }));
    const land = t0 + 0.5;
    e.push(brass(v, I2.map((s) => M(R + s)), { t: land, a: 0.03, hold: 1.0, r: 0.5, g: 0.15, vib: 9 }));
    e.push(tone(v, { t: land, f: M(R - 12), type: 'triangle', g: 0.22, a: 0.005, hold: 0.8, r: 0.5, lp: 500 }));
    e.push(boom(v, { t: land, f0: 70, f1: 36, g: 0.32, d: 0.5 }));
    e.push(cymbal(v, { t: land, g: 0.08, d: 1.8 }));
    [24, 28, 31, 36, 40].forEach((st, i) => e.push(bell(v, M(R + st), land + 0.1 + i * 0.06, 0.05, 1.6)));
    return [max(...e), land];
  },
  legendary(v, R) {
    const t = v.t, e = [];
    e.push(roll(v, { t, n: 14, dur: 0.75, g: 0.17 }));
    e.push(cymbal(v, { t, a: 0.78, g: 0.05, d: 0.4 }));
    const t0 = t + 0.8, beat = 0.15;
    // the title motif on brass, harmonised a diatonic third below
    for (const [st, b, len] of MOTIF) {
      const at = t0 + b * beat, hold = Math.max(0.06, len * beat * 0.85);
      const third = [4, 11].includes(((st % 12) + 12) % 12) ? 4 : 3;
      e.push(brass(v, [M(R + st), M(R + st - third)], { t: at, a: 0.025, hold, r: 0.08, g: 0.1, bright: 3000 }));
    }
    const bassLine = [[0, 0], [5, 2], [7, 4], [0, 6]];
    for (const [st, b] of bassLine) e.push(tone(v, { t: t0 + b * beat, f: M(R - 12 + st), type: 'triangle', g: 0.2, a: 0.006, hold: beat * 1.8, r: 0.1, lp: 550 }));
    for (let b = 0; b < 8; b += 2) e.push(thump(v, { t: t0 + b * beat, f0: 110, f1: 50, g: 0.25, d: 0.08 }));
    const land = t0 + 8 * beat;
    e.push(brass(v, [0, 4, 7, 12, 16].map((s) => M(R + s)), { t: land, a: 0.04, hold: 1.5, r: 0.7, g: 0.16, vib: 10 }));
    e.push(choir(v, [M(R + 12), M(R + 16), M(R + 19)], { t: land, a: 0.25, hold: 1.4, r: 0.9, g: 0.08 }));
    e.push(tone(v, { t: land, f: M(R - 12), type: 'triangle', g: 0.24, a: 0.005, hold: 1.2, r: 0.6, lp: 500 }));
    e.push(boom(v, { t: land, f0: 66, f1: 32, g: 0.36, d: 0.7 }));
    e.push(cymbal(v, { t: land, g: 0.1, d: 2.4 }));
    e.push(roll(v, { t: land, n: 4, dur: 0.16, g: 0.22, timpani: true, f: M(R - 24) * 2 }));
    for (let i = 0; i < 8; i++) e.push(bell(v, M(R + 24 + degree(PENTA_MAJOR, i)), land + 0.12 + i * 0.055, 0.045, 1.8));
    return [max(...e), land];
  },
  mythic(v, R) {
    const t = v.t, e = [];
    e.push(tone(v, { t, f: 41, g: 0.3, a: 1.2, hold: 2.2, r: 1.6 }));
    e.push(tone(v, { t, f: 82, g: 0.08, a: 1.2, hold: 2.2, r: 1.2 }));
    e.push(boom(v, { t: t + 0.05, f0: 55, f1: 28, g: 0.32, d: 1.4 }));
    const bVI = [R - 4, R, R + 3, R + 8], bVII = [R - 2, R + 2, R + 5, R + 10];
    e.push(choir(v, bVI.map(M), { t: t + 0.1, a: 0.8, hold: 0.9, r: 0.6, g: 0.13 }));
    e.push(choir(v, bVII.map(M), { t: t + 1.45, a: 0.6, hold: 0.8, r: 0.6, g: 0.14 }));
    e.push(pad(v, [M(R - 16), M(R - 14)], { t: t + 0.1, a: 1.0, hold: 1.8, r: 0.8, g: 0.06, lp: 400 }));
    e.push(cymbal(v, { t: t + 1.6, a: 1.05, g: 0.06, d: 0.5 }));
    const land = t + 2.7;
    e.push(choir(v, [R, R + 4, R + 7, R + 12, R + 16].map(M), { t: land, a: 0.3, hold: 2.0, r: 1.4, g: 0.17 }));
    e.push(brass(v, [R, R + 7, R + 12].map(M), { t: land, a: 0.12, hold: 1.6, r: 0.9, g: 0.08, bright: 2000 }));
    e.push(bell(v, M(R - 24), land, 0.14, 5.5));
    e.push(bell(v, M(R - 12), land, 0.08, 4));
    e.push(boom(v, { t: land, f0: 62, f1: 30, g: 0.34, d: 1.2 }));
    e.push(cymbal(v, { t: land, g: 0.08, d: 3 }));
    e.push(shimmer(v, land + 0.15, 2.2, R + 12, 0.028, 18));
    return [max(...e), land];
  },
};

const ITEM_FANFARES = {
  /** comic sad-trombone "womp womp womp wooomp" */
  junk(v, R) {
    const t = v.t;
    const notes = [R + 2, R + 1, R, R - 1];
    const o = v.osc('sawtooth', M(notes[0]), t);
    const lp = v.filter('lowpass', 900, 3);
    const wah = v.osc('sine', 5.5, t);
    const wg = v.gain(380);
    wah.connect(wg);
    wg.connect(lp.frequency);
    const vib = v.osc('sine', 6, t);
    const vg = v.gain(0);
    vib.connect(vg);
    vg.connect(o.detune);
    const g = v.gain(0);
    o.connect(lp);
    lp.connect(g);
    g.connect(v.out);
    const step = 0.36;
    o.frequency.setValueAtTime(M(notes[0]), t);
    g.gain.setValueAtTime(0, t);
    notes.forEach((n, i) => {
      const at = t + i * step;
      o.frequency.setValueAtTime(M(n), at);
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(0.16, at + 0.04);
      if (i < notes.length - 1) g.gain.linearRampToValueAtTime(0.06, at + step - 0.03);
    });
    const last = t + 3 * step;
    o.frequency.setValueAtTime(M(notes[3]), last + 0.25);
    o.frequency.exponentialRampToValueAtTime(M(notes[3] - 2), last + 1.0);
    vg.gain.setValueAtTime(0, last);
    vg.gain.linearRampToValueAtTime(45, last + 0.5);
    g.gain.setValueAtTime(0.16, last + 0.6);
    g.gain.linearRampToValueAtTime(0, last + 1.1);
    return [max(last + 1.15, tone(v, { t: last + 0.05, f: M(R - 24), type: 'triangle', g: 0.1, a: 0.01, hold: 0.6, r: 0.3, lp: 400 })), last];
  },
  treasure(v, R) {
    const t = v.t, e = [];
    e.push(whoosh(v, { t, kind: 'pink', f0: 400, f1: 5000, dur: 0.5, q: 1, g: 0.08, peak: 0.85 }));
    const land = t + 0.45;
    for (let i = 0; i < 12; i++) e.push(bell(v, M(R + 36 + degree(PENTA_MAJOR, 4 - i)), land + i * 0.045, 0.045, 1.1));
    e.push(coinClinks(v, land + 0.05, 7, 0.04));
    e.push(choir(v, [R + 12, R + 16, R + 19, R + 26].map(M), { t: land, a: 0.25, hold: 0.9, r: 0.9, g: 0.09 }));
    e.push(tone(v, { t: land, f: M(R - 12), type: 'triangle', g: 0.14, a: 0.01, hold: 0.6, r: 0.5, lp: 600 }));
    return [max(...e), land];
  },
  bottle(v, R) {
    const t = v.t, e = [];
    e.push(bell(v, M(R + 36), t, 0.07, 1.3), bell(v, M(R + 43), t + 0.12, 0.05, 1.3));
    [12, 19, 26, 28, 31].forEach((st, i) => e.push(kalimba(v, M(R + st), t + 0.2 + i * 0.1, 0.11, 1.2)));
    e.push(noise(v, { t: t + 0.25, kind: 'white', type: 'bandpass', f: 3200, q: 0.6, g: 0.03, a: 0.06, hold: 0.18, r: 0.1 }));
    return [max(...e), t + 0.6];
  },
};

// ── the registry ───────────────────────────────────────────────────────────────────────────────
export const SFX = {
  // ── UI (quiet, crisp, one woody family) ──
  ui_click: {
    bus: 'ui', cat: 'ui', poly: 3, gap: 0.03,
    fn(v) {
      return max(tick(v, { f: 3400, q: 1.1, g: 0.34, d: 0.0035 }), tone(v, { f: 1850, f2: 1450, glide: 0.025, g: 0.19, d: 0.016 }));
    },
  },
  ui_hover: {
    bus: 'ui', cat: 'ui', gain: 1.4, poly: 2, gap: 0.05,
    fn(v) {
      return tone(v, { f: 2600, f2: 2900, glide: 0.02, g: 0.07, a: 0.002, d: 0.012 });
    },
  },
  ui_open: {
    bus: 'ui', cat: 'ui', gain: 0.35, poly: 2, gap: 0.08,
    fn(v) {
      const t = v.t;
      return max(
        whoosh(v, { t, kind: 'pink', f0: 500, f1: 2600, dur: 0.16, q: 0.9, g: 0.08, peak: 0.6 }),
        marimba(v, M(84), t + 0.02, 0.1, 0.4),
        marimba(v, M(91), t + 0.08, 0.11, 0.5)
      );
    },
  },
  ui_close: {
    bus: 'ui', cat: 'ui', gain: 0.5, poly: 2, gap: 0.08,
    fn(v) {
      const t = v.t;
      return max(
        whoosh(v, { t, kind: 'pink', f0: 2600, f1: 600, dur: 0.15, q: 0.9, g: 0.07, peak: 0.35 }),
        marimba(v, M(91), t, 0.09, 0.35),
        marimba(v, M(84), t + 0.06, 0.09, 0.4)
      );
    },
  },
  ui_tab: {
    bus: 'ui', cat: 'ui', gain: 0.7, poly: 2, gap: 0.04,
    fn(v) {
      return max(marimba(v, M(88), v.t, 0.1, 0.3), tick(v, { f: 2600, q: 1.5, g: 0.12, d: 0.003 }));
    },
  },
  ui_error: {
    bus: 'ui', cat: 'ui', gain: 0.7, poly: 2, gap: 0.12,
    fn(v) {
      const t = v.t;
      return max(
        tone(v, { t, f: 220, type: 'square', lp: 800, g: 0.07, a: 0.003, d: 0.05 }),
        tone(v, { t: t + 0.12, f: 207.65, type: 'square', lp: 700, g: 0.07, a: 0.003, d: 0.07 }),
        thump(v, { t, f0: 140, f1: 90, g: 0.12, d: 0.04 })
      );
    },
  },
  ui_buy: {
    bus: 'ui', cat: 'ui', gain: 0.5, poly: 2, gap: 0.1, rev: 0.1,
    fn(v) {
      const t = v.t;
      return max(bell(v, M(96), t, 0.06, 0.6), bell(v, M(103), t + 0.07, 0.07, 0.9), tick(v, { t, f: 5200, q: 0.9, g: 0.08, d: 0.004 }));
    },
  },
  ui_equip: {
    bus: 'ui', cat: 'ui', poly: 2, gap: 0.1,
    fn(v) {
      const t = v.t;
      return max(
        tick(v, { t, f: 1800, q: 2, g: 0.2, d: 0.004 }),
        tick(v, { t: t + 0.045, f: 2600, q: 2, g: 0.16, d: 0.003 }),
        tone(v, { t: t + 0.045, f: 3900, g: 0.035, a: 0.001, d: 0.06 }),
        thump(v, { t, f0: 260, f1: 160, g: 0.1, d: 0.025 })
      );
    },
  },
  ui_claim: {
    bus: 'ui', cat: 'ui', gain: 0.5, poly: 2, gap: 0.15, rev: 0.15,
    fn(v, o) {
      const t = v.t, R = o.root || 60, e = [];
      [24, 28, 31, 36].forEach((st, i) => e.push(bell(v, M(R + st), t + i * 0.05, 0.05, 0.9)));
      e.push(noise(v, { t, kind: 'white', type: 'highpass', f: 7000, g: 0.025, a: 0.12, hold: 0.05, r: 0.12 }));
      return max(...e);
    },
  },
  toast: {
    bus: 'ui', cat: 'ui', poly: 2, gap: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60, k = o.kind || 'info';
      v.out.gain.value *= { warn: 0.75, good: 0.7, rare: 0.5 }[k] || 1;
      if (k === 'warn') return max(tone(v, { t, f: 330, f2: 300, glide: 0.05, type: 'triangle', g: 0.1, d: 0.05 }), tone(v, { t: t + 0.11, f: 300, f2: 270, glide: 0.05, type: 'triangle', g: 0.1, d: 0.06 }));
      const e = [tone(v, { t, f: 520, f2: 980, glide: 0.04, g: 0.12, d: 0.035 }), tick(v, { t, f: 3000, g: 0.05, d: 0.003 })];
      if (k === 'good') e.push(bell(v, M(R + 31), t + 0.06, 0.04, 0.8));
      if (k === 'rare') [28, 31, 36].forEach((st, i) => e.push(bell(v, M(R + st), t + 0.05 + i * 0.05, 0.04, 1)));
      return max(...e);
    },
  },

  // ── fishing ──
  castCharge: {
    bus: 'sfx', cat: 'tick', gain: 2.8, poly: 1, gap: 0.2,
    fn(v) {
      const t = v.t;
      return max(tick(v, { t, f: 2200, q: 2, g: 0.16, d: 0.004 }), tick(v, { t: t + 0.04, f: 3100, q: 2, g: 0.13, d: 0.003 }), tone(v, { t: t + 0.04, f: 4200, g: 0.02, d: 0.02 }));
    },
  },
  cast: {
    bus: 'sfx', cat: 'sfx', poly: 2, gap: 0.15, rev: 0.1,
    fn(v, o) {
      const p = clamp(o.power !== undefined ? o.power : 0.7, 0, 1), t = v.t;
      return max(
        whoosh(v, { t, kind: 'pink', f0: 500, fm: 2400 + 1600 * p, f1: 700, dur: 0.22 + 0.14 * p, q: 1.6, g: 0.2 + 0.22 * p, peak: 0.4 }),
        whoosh(v, { t: t + 0.03, kind: 'white', f0: 3000, fm: 6500, f1: 2500, dur: 0.18 + 0.1 * p, q: 1.2, g: 0.05 + 0.06 * p, peak: 0.35 }),
        texture(v, { buf: v.mix.buffers.whizz, t: t + 0.08, rate: 1.1 + 0.6 * p, type: 'bandpass', f: 3600, q: 0.8, g: 0.06 + 0.06 * p, a: 0.02, hold: 0.2 + 0.2 * p, r: 0.12 })
      );
    },
  },
  lureSplash: {
    bus: 'sfx', cat: 'sfx', poly: 3, gap: 0.05, rev: 0.12,
    fn(v, o) {
      const s = clamp(o.size !== undefined ? o.size : 0.5, 0.2, 1.4);
      const t = v.t;
      return max(
        tone(v, { t, f: 520 / Math.sqrt(s), f2: 1100 / Math.sqrt(s), glide: 0.05, g: 0.3, a: 0.002, d: 0.035 }),
        noise(v, { t, type: 'bandpass', f: 1500, f2: 700, glide: 0.08, q: 0.9, g: 0.3 * s + 0.1, a: 0.002, d: 0.035 + 0.03 * s }),
        texture(v, { buf: v.mix.buffers.droplets, t: t + 0.03, type: 'highpass', f: 900, g: 0.12 * s + 0.04, a: 0.01, hold: 0.08 + 0.12 * s, r: 0.06 })
      );
    },
  },
  lureBottom: {
    bus: 'sfx', cat: 'tick', gain: 0.6, poly: 2, gap: 0.3,
    fn(v) {
      const t = v.t;
      return max(
        thump(v, { t, f0: 125, f1: 62, glide: 0.05, g: 0.3, d: 0.055 }),
        noise(v, { t, kind: 'brown', type: 'lowpass', f: 520, g: 0.16, a: 0.002, d: 0.05 }),
        noise(v, { t: t + 0.01, kind: 'pink', type: 'bandpass', f: 1300, q: 0.7, g: 0.035, a: 0.01, d: 0.07 })
      );
    },
  },
  twitch: {
    bus: 'sfx', cat: 'tick', gain: 4.5, poly: 3, gap: 0.06,
    fn(v) {
      const t = v.t;
      return max(
        tick(v, { t, f: 2800, q: 2, g: 0.14, d: 0.004 }),
        tick(v, { t: t + 0.035, f: 2400, q: 2, g: 0.1, d: 0.004 }),
        whoosh(v, { t, kind: 'pink', f0: 900, fm: 2200, f1: 1200, dur: 0.1, q: 1.5, g: 0.05, peak: 0.4 }),
        noise(v, { t: t + 0.02, kind: 'pink', type: 'bandpass', f: 620, q: 1, g: 0.06, a: 0.004, d: 0.03 })
      );
    },
  },
  retrieved: {
    bus: 'sfx', cat: 'tick', poly: 1, gap: 0.3,
    fn(v) {
      const t = v.t;
      return max(tick(v, { t, f: 3600, q: 3, g: 0.2, d: 0.003 }), tone(v, { t, f: 2400, g: 0.08, d: 0.03 }), tone(v, { t: t + 0.09, f: 1100, f2: 1900, glide: 0.03, g: 0.06, d: 0.02 }));
    },
  },
  nibble: {
    bus: 'sfx', cat: 'tick', gain: 0.8, poly: 2, gap: 0.2,
    fn(v, o) {
      const t = v.t, k = clamp(o.size !== undefined ? o.size : 0.5, 0.2, 1.2);
      const e = [];
      [[0, 1], [0.13, 0.7]].forEach(([dt, g]) => {
        e.push(thump(v, { t: t + dt, f0: 270 / Math.sqrt(k), f1: 140, glide: 0.03, g: 0.2 * g, d: 0.025 }));
        e.push(tick(v, { t: t + dt, f: 1600, q: 1.2, g: 0.09 * g, d: 0.006 }));
      });
      return max(...e);
    },
  },
  bite: {
    bus: 'sfx', cat: 'alert', poly: 2, gap: 0.25, rev: 0.18, dly: 0.12,
    fn(v) {
      const t = v.t, e = [];
      const base = M(91); // the rod-tip bell shaken by the take: ting-a-ling
      [0, 0.075, 0.16].forEach((dt, i) => e.push(bell(v, base * (i === 1 ? 1.012 : 1), t + dt, 0.2 * [1, 0.62, 0.42][i], 1.1)));
      e.push(thump(v, { t, f0: 150, f1: 48, glide: 0.07, g: 0.55, d: 0.085 }));
      e.push(noise(v, { t, type: 'bandpass', f: 2600, f2: 5200, glide: 0.06, q: 1.4, g: 0.1, a: 0.002, d: 0.03 }));
      return max(...e);
    },
  },
  hookSet: {
    bus: 'sfx', cat: 'sfx', poly: 2, gap: 0.2, rev: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60, q = o.quality || 'good';
      const k = q === 'late' ? 0.7 : 1;
      const e = [
        thump(v, { t, f0: 115, f1: 42, glide: 0.09, g: 0.6 * k, d: 0.1 }),
        noise(v, { t, kind: 'white', type: 'bandpass', f: 950, q: 0.8, g: 0.26 * k, a: 0.001, d: 0.03 }),
        whoosh(v, { t, kind: 'pink', f0: 700, fm: 2100, f1: 500, dur: 0.15, q: 1.2, g: 0.12 * k, peak: 0.3 }),
        tone(v, { t: t + 0.01, f: 190, f2: 176, glide: 0.1, type: 'triangle', g: 0.14 * k, d: 0.12, vib: { rate: 7, depth: 14 } }),
        tone(v, { t: t + 0.01, f: 382, g: 0.05 * k, d: 0.06 }),
      ];
      if (q === 'perfect') {
        [24, 28, 31, 36].forEach((st, i) => e.push(bell(v, M(R + st), t + 0.04 + i * 0.032, 0.07, 1.3)));
        e.push(noise(v, { t: t + 0.04, kind: 'white', type: 'highpass', f: 6500, g: 0.035, a: 0.1, hold: 0.05, r: 0.2 }));
      }
      return max(...e);
    },
  },
  hookMiss: {
    bus: 'sfx', cat: 'sfx', poly: 1, gap: 0.3,
    fn(v) {
      const t = v.t;
      return max(
        tone(v, { t, f: 520, f2: 190, glide: 0.32, type: 'triangle', g: 0.15, a: 0.005, d: 0.12, vib: { rate: 9, depth: 25 } }),
        tone(v, { t, f: 260, f2: 95, glide: 0.3, g: 0.1, a: 0.005, d: 0.1 }),
        noise(v, { t, kind: 'pink', type: 'lowpass', f: 900, f2: 300, glide: 0.3, g: 0.06, a: 0.02, d: 0.15 })
      );
    },
  },
  run: {
    bus: 'sfx', cat: 'sfx', gain: 1.4, poly: 1, gap: 0.6, rev: 0.12,
    fn(v, o) {
      const t = v.t, k = clamp(o.size !== undefined ? o.size : 0.6, 0.2, 1.2);
      const s = v.src(v.mix.buffers.dragFast, t);
      s.playbackRate.setValueAtTime(0.3 * v.p, t);
      s.playbackRate.exponentialRampToValueAtTime(1.0 * v.p, t + 0.5);
      const bp = v.filter('bandpass', 4200, 0.8);
      const g = v.gain(0);
      s.connect(bp);
      bp.connect(g);
      g.connect(v.out);
      const e1 = asr(g.gain, t, 0.08, 0.14, 0.45, 0.06);
      return max(
        e1,
        noise(v, { t, kind: 'pink', type: 'lowpass', f: 300, f2: 2600, glide: 0.35, q: 0.7, g: 0.2 * k + 0.08, a: 0.25, d: 0.12 }),
        tone(v, { t, f: 900, f2: 1500, glide: 0.4, g: 0.035, a: 0.05, d: 0.12 })
      );
    },
  },
  jump: {
    bus: 'sfx', cat: 'sfx', poly: 2, gap: 0.3, rev: 0.18,
    fn(v, o) {
      const t = v.t, s = clamp(o.size !== undefined ? o.size : 1, 0.3, 3), k = Math.sqrt(s);
      return max(
        noise(v, { t, kind: 'white', type: 'highpass', f: 1400, f2: 4200, glide: 0.15, g: 0.18 * k, a: 0.006, d: 0.1 }),
        noise(v, { t, kind: 'white', type: 'lowpass', f: 2500, g: 0.14 * k, a: 0.004, d: 0.05 }),
        whoosh(v, { t: t + 0.04, kind: 'pink', f0: 380, fm: 1500, f1: 600, dur: 0.32 + 0.1 * s, q: 0.9, g: 0.1 * k, peak: 0.45 }),
        texture(v, { buf: v.mix.buffers.droplets, t: t + 0.05, type: 'highpass', f: 1200, g: 0.08 * k, a: 0.02, hold: 0.25, r: 0.2 })
      );
    },
  },
  splash: {
    bus: 'sfx', cat: 'sfx', poly: 4, gap: 0.04, rev: 0.2,
    fn(v, o) {
      const s = clamp(o.size !== undefined ? o.size : 1, 0.2, 3.2);
      const t = v.t, k = Math.sqrt(s);
      const e = [
        noise(v, { t, kind: 'white', type: 'lowpass', f: 2500 + 2600 * k, f2: 500, glide: 0.18 + 0.25 * s, q: 0.6, g: 0.2 * k, a: 0.004, d: 0.07 + 0.11 * s }),
        thump(v, { t, f0: 190 / Math.pow(s, 0.3), f1: 55, glide: 0.09, g: 0.22 * k, d: 0.06 + 0.05 * s }),
        tone(v, { t: t + 0.01, f: 430 / Math.pow(s, 0.4), f2: 900 / Math.pow(s, 0.4), glide: 0.07, g: 0.12, d: 0.05 }),
        texture(v, { buf: v.mix.buffers.droplets, t: t + 0.06, type: 'bandpass', f: 2200, q: 0.5, g: 0.1 * k, a: 0.03, hold: 0.12 + 0.35 * s, r: 0.12 + 0.12 * s }),
      ];
      if (s > 1.6) e.push(boom(v, { t, f0: 75, f1: 34, g: 0.18 * (s - 1.2), d: 0.4 }));
      return max(...e);
    },
  },
  predatorStrike: {
    bus: 'sfx', cat: 'alert', poly: 1, gap: 0.5, rev: 0.22,
    fn(v, o) {
      const t = v.t, R = o.root || 60, k = clamp((o.level || 6) / 9, 0.4, 1.1);
      const e = [
        boom(v, { t, f0: 68, f1: 30, g: 0.42 * k, d: 0.45 }),
        noise(v, { t, kind: 'white', type: 'bandpass', f: 1300, f2: 450, glide: 0.12, q: 0.7, g: 0.3, a: 0.002, d: 0.07 }),
        noise(v, { t, kind: 'pink', type: 'lowpass', f: 3000, f2: 600, glide: 0.4, g: 0.18, a: 0.01, d: 0.2 }),
        brass(v, [M(R - 24), M(R - 23), M(R - 18)], { t, a: 0.012, hold: 0.28, r: 0.25, g: 0.16 * k, bright: 1500 }),
        tone(v, { t: t + 0.32, f: M(R - 20), type: 'sawtooth', lp: 420, g: 0.1 * k, a: 0.01, hold: 0.12, r: 0.06 }),
        tone(v, { t: t + 0.5, f: M(R - 19), type: 'sawtooth', lp: 420, g: 0.11 * k, a: 0.01, hold: 0.2, r: 0.12 }),
      ];
      return max(...e);
    },
  },
  lineSnap: {
    bus: 'sfx', cat: 'alert', gain: 1.25, poly: 1, gap: 0.5, rev: 0.18,
    fn(v) {
      const t = v.t;
      const s = v.src(v.mix.buffers.ratchet, t + 0.05);
      s.playbackRate.setValueAtTime(2.6 * v.p, t + 0.05);
      s.playbackRate.exponentialRampToValueAtTime(0.35 * v.p, t + 0.85);
      const bp = v.filter('bandpass', 3000, 0.9);
      const g = v.gain(0);
      s.connect(bp);
      bp.connect(g);
      g.connect(v.out);
      return max(
        asr(g.gain, t + 0.05, 0.01, 0.14, 0.55, 0.12),
        noise(v, { t, kind: 'white', type: 'highpass', f: 2000, g: 0.4, a: 0.0005, d: 0.006 }),
        tone(v, { t, f: 1250, f2: 380, glide: 0.25, type: 'triangle', g: 0.22, a: 0.001, d: 0.14 }),
        tone(v, { t, f: 2600, f2: 900, glide: 0.2, g: 0.08, a: 0.001, d: 0.06 }),
        whoosh(v, { t, kind: 'white', f0: 3500, f1: 500, dur: 0.3, q: 1.4, g: 0.22, peak: 0.15 })
      );
    },
  },
  escape: {
    bus: 'sfx', cat: 'sfx', gain: 0.5, poly: 1, gap: 0.5, rev: 0.2,
    fn(v) {
      const t = v.t;
      return max(
        tone(v, { t, f: 600, f2: 240, glide: 0.7, type: 'triangle', g: 0.12, a: 0.04, hold: 0.3, r: 0.25, vib: { rate: 5, depth: 20 }, lp: 1800 }),
        tone(v, { t, f: 300, f2: 120, glide: 0.7, g: 0.08, a: 0.04, hold: 0.3, r: 0.2 }),
        noise(v, { t, kind: 'pink', type: 'bandpass', f: 800, f2: 300, glide: 0.6, q: 0.8, g: 0.07, a: 0.05, d: 0.25 })
      );
    },
  },
  landed: {
    bus: 'sfx', cat: 'sfx', poly: 1, gap: 0.5, rev: 0.12,
    fn(v, o) {
      const t = v.t, s = clamp(o.size !== undefined ? o.size : 1, 0.3, 3), k = Math.sqrt(s);
      const e = [
        texture(v, { buf: v.mix.buffers.droplets, t, type: 'lowpass', f: 3500, g: 0.14 * k, a: 0.02, hold: 0.35 + 0.35 * s, r: 0.3 }),
        noise(v, { t, kind: 'pink', type: 'bandpass', f: 1400, q: 0.5, g: 0.09 * k, a: 0.03, hold: 0.4 + 0.2 * s, r: 0.3 }),
      ];
      const n = 3 + Math.round(2 * k);
      for (let i = 0; i < n; i++) {
        const at = t + 0.1 + i * (0.09 + v.rng() * 0.05);
        e.push(noise(v, { t: at, kind: 'white', type: 'lowpass', f: 1900, g: 0.15 * (1 - i / (n + 1)), a: 0.001, d: 0.022 }));
        e.push(thump(v, { t: at, f0: 220, f1: 120, g: 0.08, d: 0.02 }));
      }
      if (s > 1.2) e.push(thump(v, { t: t + 0.05, f0: 130, f1: 58, g: 0.3 * (s - 0.8), d: 0.08 }));
      return max(...e);
    },
  },
  tensionWarn: {
    bus: 'sfx', cat: 'sfx', gain: 1.8, poly: 1, gap: 0.45,
    fn(v) {
      const t = v.t;
      return max(
        creak(v, { t, r0: 55, r1: 95, f: 900, q: 6, g: 0.2, dur: 0.28 }),
        tone(v, { t, f: 1800, f2: 2300, glide: 0.25, g: 0.04, a: 0.02, d: 0.12, vib: { rate: 22, depth: 35 } })
      );
    },
  },
  ink: {
    bus: 'sfx', cat: 'sfx', poly: 1, gap: 0.4, rev: 0.15,
    fn(v) {
      const t = v.t, e = [
        noise(v, { t, kind: 'pink', type: 'bandpass', f: 650, f2: 240, glide: 0.15, q: 1.2, g: 0.22, a: 0.01, d: 0.1 }),
        tone(v, { t, f: 180, f2: 85, glide: 0.12, g: 0.14, a: 0.005, d: 0.08 }),
      ];
      for (let i = 0; i < 4; i++) e.push(tone(v, { t: t + 0.08 + i * 0.06, f: 700 + v.rng() * 700, f2: 1400 + v.rng() * 800, glide: 0.04, g: 0.04, d: 0.025 }));
      return max(...e);
    },
  },
  bubbles: {
    bus: 'sfx', cat: 'tick', gain: 0.55, poly: 3, gap: 0.08,
    fn(v, o) {
      const t = v.t, n = clamp(Math.round(o.n || 5), 1, 10), e = [];
      for (let i = 0; i < n; i++) {
        const f = 600 + v.rng() * 1300;
        e.push(tone(v, { t: t + v.rng() * 0.4, f, f2: f * 1.7, glide: 0.04, g: 0.05 + v.rng() * 0.05, a: 0.002, d: 0.02 + v.rng() * 0.02 }));
      }
      return max(...e);
    },
  },

  // ── ambient one-shots (routed through the above/under-water submixes) ──
  thunder: {
    bus: 'ambience', sub: 'above', cat: 'amb', gain: 0.22, poly: 3, gap: 0.3, rev: 0.45,
    fn(v, o) {
      const t = v.t, p = clamp(o.power !== undefined ? o.power : 0.8, 0.3, 1);
      const near = clamp((p - 0.55) / 0.4, 0, 1);
      const dur = 5 + 4 * p;
      const e = [];
      // rolling body: brown noise through a low-pass, amplitude driven by a random rumble curve
      const s = v.src(v.mix.buffers.brown, t);
      const lp = v.filter('lowpass', 140 + 260 * near, 0.8);
      const roll = v.gain(0);
      const env = v.gain(0);
      s.connect(lp);
      lp.connect(roll);
      roll.connect(env);
      env.connect(v.out);
      const N = 96, curve = new Float32Array(N);
      let bump = 0.8;
      for (let i = 0; i < N; i++) {
        if (v.rng() < 0.12) bump = 0.5 + v.rng() * 0.8;
        curve[i] = (i === 0 ? 0 : bump * (0.7 + 0.3 * v.rng())) * Math.exp((-i / N) * 2.2);
      }
      curve[N - 1] = 0;
      roll.gain.setValueCurveAtTime(curve, t, dur);
      e.push(asr(env.gain, t, 0.05 + (1 - near) * 0.6, 1.6 * (0.45 + 0.55 * near), dur * 0.85, 0.4));
      e.push(boom(v, { t: t + 0.02, f0: 58, f1: 26, g: 0.45 * p, d: 1.1 + p }));
      if (near > 0) {
        e.push(noise(v, { t, kind: 'white', type: 'highpass', f: 1100, g: 0.5 * near, a: 0.002, d: 0.07 }));
        e.push(texture(v, { buf: v.mix.buffers.crackle, t: t + 0.01, type: 'highpass', f: 700, g: 0.4 * near, a: 0.01, hold: 0.35, r: 0.3 }));
      }
      return max(...e, t + dur);
    },
  },
  gull: {
    bus: 'ambience', sub: 'above', cat: 'amb', poly: 2, gap: 1.5, rev: 0.35,
    fn(v, o) {
      const t = v.t, n = 2 + Math.floor(v.rng() * 4), f0 = (o.f || 820) * (0.9 + 0.2 * v.rng());
      const osc = v.osc('sawtooth', f0, t);
      const am = v.osc('sine', 85 + 30 * v.rng(), t);
      const amg = v.gain(0.45);
      const body = v.gain(0.55);
      am.connect(amg);
      amg.connect(body.gain);
      const b1 = v.filter('bandpass', 2300, 4), b2 = v.filter('bandpass', 3500, 5), lp = v.filter('lowpass', 4500, 0.7);
      const g = v.gain(0);
      osc.connect(body);
      body.connect(b1);
      body.connect(b2);
      b1.connect(lp);
      b2.connect(lp);
      lp.connect(g);
      g.connect(v.out);
      osc.frequency.setValueAtTime(f0, t);
      g.gain.setValueAtTime(0, t);
      let at = t, gg = o.g || 0.16;
      for (let i = 0; i < n; i++) {
        const dur = (i === 0 ? 0.32 : 0.18) + v.rng() * 0.08, fk = i === 0 ? 1.15 : 1 - i * 0.04;
        osc.frequency.setValueAtTime(f0 * 0.72 * fk, at);
        osc.frequency.linearRampToValueAtTime(f0 * 1.18 * fk, at + dur * 0.3);
        osc.frequency.linearRampToValueAtTime(f0 * 0.78 * fk, at + dur);
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(gg, at + 0.025);
        g.gain.linearRampToValueAtTime(gg * 0.7, at + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, at + dur);
        at += dur + 0.05 + v.rng() * 0.08;
        gg *= 0.85;
      }
      return at + 0.05;
    },
  },
  creak: {
    bus: 'ambience', sub: 'above', cat: 'amb', gain: 1.4, poly: 2, gap: 0.6, rev: 0.12,
    fn(v, o) {
      const up = v.rng() < 0.5, d = 0.35 + v.rng() * 0.6;
      return creak(v, { r0: up ? 38 : 80, r1: up ? 78 : 36, f: 520 + v.rng() * 380, q: 7, g: o.g || 0.09, dur: d, a: 0.1 });
    },
  },
  slap: {
    bus: 'ambience', sub: 'above', cat: 'amb', poly: 3, gap: 0.25, rev: 0.1,
    fn(v, o) {
      const t = v.t, k = clamp(o.size !== undefined ? o.size : 0.6, 0.2, 1.5);
      return max(
        noise(v, { t, kind: 'white', type: 'lowpass', f: 1500, f2: 450, glide: 0.08, g: 0.2 * k, a: 0.003, d: 0.05 }),
        thump(v, { t, f0: 160, f1: 80, g: 0.16 * k, d: 0.05 }),
        texture(v, { buf: v.mix.buffers.droplets, t: t + 0.03, type: 'highpass', f: 1800, g: 0.04 * k, a: 0.01, hold: 0.08, r: 0.08 })
      );
    },
  },
  buoy: {
    bus: 'ambience', sub: 'above', cat: 'amb', gain: 0.4, poly: 1, gap: 4, rev: 0.7,
    fn(v, o) {
      const t = v.t, f = M((o.root || 60) + 19);
      return max(bell(v, f, t, 0.07, 3.5), bell(v, f * 1.004, t + 0.85, 0.05, 3.5));
    },
  },
  birds: {
    bus: 'ambience', sub: 'above', cat: 'amb', poly: 1, gap: 3, rev: 0.4,
    fn(v) {
      const t = v.t, e = [];
      const n = 6 + Math.floor(v.rng() * 6);
      for (let i = 0; i < n; i++) {
        const at = t + i * 0.35 + v.rng() * 0.3, f = 2600 + v.rng() * 1800;
        e.push(tone(v, { t: at, f, f2: f * (1.25 + v.rng() * 0.3), glide: 0.05, g: 0.035, a: 0.004, d: 0.03 }));
        e.push(tone(v, { t: at + 0.07, f: f * 1.3, f2: f * 0.9, glide: 0.06, g: 0.03, a: 0.004, d: 0.035 }));
      }
      return max(...e);
    },
  },
  whale: {
    bus: 'ambience', sub: 'under', cat: 'amb', gain: 0.35, poly: 1, gap: 20, rev: 1.0, dly: 0.25,
    fn(v, o) {
      // A far humpback phrase: moans, whoops and cries with slow glides, formant-filtered, drenched in space.
      const t = v.t;
      const c = v.osc('triangle', 180, t);
      const c2 = v.osc('sine', 360, t);
      c2.detune.value = 4;
      const m = v.osc('sine', 180, t);
      const mg = v.gain(120);
      m.connect(mg);
      mg.connect(c.frequency);
      const vib = v.osc('sine', 4.3, t);
      const vg = v.gain(10);
      vib.connect(vg);
      vg.connect(c.detune);
      vg.connect(c2.detune);
      const mixg = v.gain(1);
      const c2g = v.gain(0.35);
      c.connect(mixg);
      c2.connect(c2g);
      c2g.connect(mixg);
      const f1 = v.filter('bandpass', 520, 1.4), f2 = v.filter('bandpass', 1250, 2.5), lp = v.filter('lowpass', 1900, 0.6);
      mixg.connect(f1);
      mixg.connect(f2);
      f1.connect(lp);
      f2.connect(lp);
      const g = v.gain(0);
      lp.connect(g);
      g.connect(v.out);
      const freqs = [c.frequency, c2.frequency, m.frequency];
      const set = (time, f, ramp) => {
        freqs.forEach((p, i) => {
          const ff = f * (i === 1 ? 2 : 1);
          if (ramp === 'lin') p.linearRampToValueAtTime(ff, time);
          else if (ramp === 'exp') p.exponentialRampToValueAtTime(ff, time);
          else p.setValueAtTime(ff, time);
        });
      };
      const units = o.units || 3 + Math.floor(v.rng() * 3);
      let at = t;
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < units; i++) {
        const kind = ['moan', 'whoop', 'cry', 'moan', 'groan'][Math.floor(v.rng() * 5)];
        const d = kind === 'whoop' ? 1.1 + v.rng() * 0.5 : kind === 'cry' ? 1.6 + v.rng() * 0.8 : 2 + v.rng() * 1.4;
        const amp = kind === 'cry' ? 0.12 : kind === 'groan' ? 0.2 : 0.17;
        if (kind === 'moan') {
          const f = 150 + v.rng() * 90;
          set(at, f);
          set(at + d * 0.45, f * (1.25 + v.rng() * 0.2), 'exp');
          set(at + d, f * (0.82 + v.rng() * 0.1), 'exp');
        } else if (kind === 'whoop') {
          const f = 120 + v.rng() * 60;
          set(at, f);
          set(at + d * 0.55, f * (3 + v.rng()), 'exp');
          set(at + d, f * 2.2, 'exp');
        } else if (kind === 'cry') {
          const f = 520 + v.rng() * 260;
          set(at, f * 0.9);
          set(at + d * 0.3, f * 1.12, 'exp');
          set(at + d, f * 0.8, 'exp');
        } else {
          const f = 62 + v.rng() * 20;
          set(at, f);
          set(at + d * 0.5, f * 1.15, 'exp');
          set(at + d, f * 0.9, 'exp');
        }
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(amp, at + Math.min(0.5, d * 0.3));
        g.gain.linearRampToValueAtTime(amp * 0.75, at + d * 0.75);
        g.gain.linearRampToValueAtTime(0, at + d);
        at += d + 0.6 + v.rng() * 1.6;
      }
      return at + 0.2;
    },
  },
  clicks: {
    bus: 'ambience', sub: 'under', cat: 'amb', poly: 2, gap: 2, rev: 0.4,
    fn(v, o) {
      const t = v.t, d = 0.5 + v.rng() * 0.6;
      const s = v.src(v.mix.buffers.click, t, { offset: 0 });
      s.playbackRate.setValueAtTime((0.7 + v.rng() * 0.4) * v.p, t);
      s.playbackRate.linearRampToValueAtTime((1.6 + v.rng() * 1.6) * v.p, t + d);
      const bp = v.filter('bandpass', 3200, 0.8);
      const g = v.gain(0);
      s.connect(bp);
      bp.connect(g);
      g.connect(v.out);
      const e = [asr(g.gain, t, 0.05, o.g || 0.12, d, 0.08)];
      if (v.rng() < 0.4) e.push(tone(v, { t: t + d * 0.5, f: 5200, f2: 7600, glide: 0.25, g: 0.02, a: 0.04, hold: 0.2, r: 0.1 }));
      return max(...e);
    },
  },
  bubble: {
    bus: 'ambience', sub: 'under', cat: 'amb', poly: 6, gap: 0.03,
    fn(v, o) {
      const f = (o.f || 900) * (0.7 + 0.6 * v.rng());
      return tone(v, { f, f2: f * (1.6 + 0.5 * v.rng()), glide: 0.035 + 0.03 * v.rng(), g: o.g || 0.06, a: 0.002, d: 0.018 + 0.02 * v.rng() });
    },
  },
  groan: {
    bus: 'ambience', sub: 'under', cat: 'amb', poly: 1, gap: 6, rev: 0.6,
    fn(v, o) {
      const t = v.t, d = 1.6 + v.rng() * 1.2;
      return max(
        creak(v, { t, r0: 24, r1: 19, f: 210, q: 5, g: o.g || 0.16, dur: d, a: 0.7 }),
        noise(v, { t: t + 0.3, kind: 'white', type: 'bandpass', f: 1500, f2: 1950, glide: d, q: 14, g: 0.03, a: 0.6, hold: d * 0.6, r: 0.6 })
      );
    },
  },

  // ── progression ──
  coins: {
    bus: 'sfx', cat: 'sfx', gain: 1.6, poly: 2, gap: 0.12, rev: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60, amt = Math.max(1, Math.abs(o.amount || 10));
      const n = clamp(1 + Math.floor(Math.log2(amt / 4)), 1, 9);
      const e = [coinClinks(v, t + (amt >= 20 ? 0.09 : 0), n, 0.05)];
      if (amt >= 20) e.push(bell(v, M(R + 36), t, 0.08, 1.1), tick(v, { t, f: 2400, q: 2, g: 0.12, d: 0.004 }));
      if (amt >= 200) e.push(bell(v, M(R + 43), t + 0.09, 0.07, 1.3), noise(v, { t: t + 0.1, kind: 'white', type: 'highpass', f: 5500, g: 0.04, a: 0.02, hold: 0.25, r: 0.15 }));
      return max(...e);
    },
  },
  xp: {
    bus: 'sfx', cat: 'tick', gain: 1.7, poly: 2, gap: 0.12,
    fn(v) {
      return tone(v, { f: 2400, f2: 3000, glide: 0.03, g: 0.05, a: 0.002, d: 0.02 });
    },
  },
  purchase: {
    bus: 'sfx', cat: 'sfx', gain: 0.65, poly: 1, gap: 0.3, rev: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60;
      return max(
        tick(v, { t, f: 1900, q: 2, g: 0.15, d: 0.004 }),
        tick(v, { t: t + 0.05, f: 1500, q: 2, g: 0.12, d: 0.004 }),
        noise(v, { t: t + 0.05, kind: 'pink', type: 'bandpass', f: 900, q: 1, g: 0.06, a: 0.01, d: 0.06 }),
        bell(v, M(R + 31), t + 0.1, 0.09, 1.2),
        bell(v, M(R + 36), t + 0.1, 0.07, 1.4),
        coinClinks(v, t + 0.14, 5, 0.04)
      );
    },
  },
  levelUp: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 1, rev: 0.25, dly: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60, e = [];
      const arp = [0, 4, 7, 12, 16, 19, 24];
      arp.forEach((st, i) => {
        e.push(kalimba(v, M(R + 12 + st), t + i * 0.06, 0.14, 0.9));
        e.push(bell(v, M(R + 24 + st), t + i * 0.06, 0.03, 0.8));
      });
      const land = t + arp.length * 0.06 + 0.04;
      e.push(pad(v, [R + 12, R + 16, R + 19, R + 24].map(M), { t: land, type: 'sawtooth', a: 0.05, hold: 0.7, r: 0.6, g: 0.09, lp: 2400, lp2: 1200 }));
      e.push(marimba(v, M(R + 7), land - 0.12, 0.16, 0.4), marimba(v, M(R + 12), land, 0.2, 0.8));
      e.push(boom(v, { t: land, f0: 90, f1: 40, g: 0.25, d: 0.3 }));
      e.push(cymbal(v, { t: land, g: 0.05, d: 1.4 }));
      e.push(shimmer(v, land + 0.1, 1, R + 12, 0.025, 8));
      return max(...e);
    },
  },
  questComplete: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 0.8, rev: 0.2,
    fn(v, o) {
      const t = v.t, R = o.root || 60, e = [];
      [[7, 0], [9, 0.12], [7, 0.24], [12, 0.36]].forEach(([st, dt], i) => {
        e.push(marimba(v, M(R + 12 + st), t + dt, 0.16, i === 3 ? 1 : 0.5));
        e.push(kalimba(v, M(R + st), t + dt, 0.08, 0.6));
      });
      e.push(bell(v, M(R + 36), t + 0.36, 0.06, 1.6));
      e.push(pad(v, maj(R).map(M), { t: t + 0.36, type: 'triangle', a: 0.05, hold: 0.5, r: 0.6, g: 0.07, lp: 1800 }));
      e.push(bongo(v, t, 330, 0.08), bongo(v, t + 0.24, 300, 0.08), bongo(v, t + 0.36, 270, 0.1));
      return max(...e);
    },
  },
  achievement: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 0.8, rev: 0.3, dly: 0.12,
    fn(v, o) {
      const t = v.t, R = o.root || 60, e = [];
      for (const st of [12, 19, 24, 28]) e.push(bell(v, M(R + st), t, 0.06, 2.4));
      [31, 36, 40, 43].forEach((st, i) => e.push(bell(v, M(R + st), t + 0.25 + i * 0.07, 0.045, 1.6)));
      e.push(pad(v, [R, R + 7, R + 16].map(M), { t, type: 'triangle', a: 0.4, hold: 0.6, r: 1, g: 0.07, lp: 1600 }));
      e.push(cymbal(v, { t, a: 0.5, g: 0.04, d: 1 }));
      e.push(boom(v, { t, f0: 80, f1: 40, g: 0.18, d: 0.4 }));
      return max(...e);
    },
  },
  dexNew: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 0.8, rev: 0.22,
    fn(v, o) {
      const t = v.t, R = o.root || 60;
      return max(
        noise(v, { t, kind: 'white', type: 'bandpass', f: 1800, f2: 4200, glide: 0.12, q: 0.8, g: 0.06, a: 0.02, d: 0.06 }),
        bell(v, M(R + 24), t + 0.08, 0.06, 1.2),
        bell(v, M(R + 28), t + 0.17, 0.06, 1.2),
        bell(v, M(R + 31), t + 0.26, 0.07, 1.8),
        kalimba(v, M(R + 19), t + 0.26, 0.1, 1)
      );
    },
  },
  record: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 0.8, rev: 0.15,
    fn(v, o) {
      return stamp(v, v.t, o.root || 60);
    },
  },
  zone: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 0.6, rev: 0.45,
    fn(v, o) {
      const t = v.t, R = o.root || 60, z = clamp(o.zone !== undefined ? o.zone : 1, 0, 3), up = !!o.up;
      if (!up) v.out.gain.value *= [1, 1, 0.7, 0.5][z];
      const e = [whoosh(v, { t, kind: 'pink', f0: up ? 300 : 2600, f1: up ? 2600 : 260, dur: 1.1, q: 0.8, g: 0.1, peak: up ? 0.7 : 0.3 })];
      if (up || z === 0) {
        e.push(pad(v, [R + 12, R + 19, R + 24].map(M), { t: t + 0.25, type: 'triangle', a: 0.3, hold: 0.6, r: 0.9, g: 0.06, lp: 2400 }));
        e.push(bell(v, M(R + 31), t + 0.3, 0.05, 2));
      } else if (z === 1) {
        e.push(pad(v, [R - 12, R - 9, R - 5, R].map(M), { t: t + 0.2, type: 'sawtooth', a: 0.5, hold: 1, r: 1.2, g: 0.07, lp: 1100 }));
        e.push(bell(v, M(R + 12), t + 0.3, 0.05, 2.6));
      } else if (z === 2) {
        e.push(pad(v, [R - 24, R - 18, R - 12].map(M), { t: t + 0.2, type: 'sawtooth', a: 0.7, hold: 1.2, r: 1.4, g: 0.09, lp: 600 }));
        e.push(bell(v, M(R - 6), t + 0.4, 0.06, 3.5));
        e.push(boom(v, { t: t + 0.2, f0: 60, f1: 32, g: 0.2, d: 0.8 }));
      } else {
        e.push(pad(v, [R - 24, R - 23, R - 17].map(M), { t: t + 0.15, type: 'sawtooth', a: 0.9, hold: 1.4, r: 1.6, g: 0.11, lp: 380 }));
        e.push(boom(v, { t: t + 0.2, f0: 52, f1: 26, g: 0.32, d: 1.4 }));
        e.push(noise(v, { t: t + 0.5, kind: 'white', type: 'bandpass', f: 1400, f2: 2100, glide: 1.6, q: 16, g: 0.05, a: 0.6, hold: 0.8, r: 0.6 }));
        e.push(bell(v, M(R - 18), t + 0.5, 0.08, 4.5));
      }
      return max(...e);
    },
  },
  biome: {
    bus: 'sfx', cat: 'stinger', poly: 1, gap: 1, rev: 0.4,
    fn(v, o) {
      const t = v.t, R = o.root || 60;
      const CH = {
        shore: [0, 4, 7, 14], reef: [0, 4, 7, 14], kelp: [0, 2, 7, 12], slope: [-3, 0, 4, 7],
        open: [0, 7, 12, 19], trench: [-12, -9, -5, 0],
      };
      const ch = CH[o.to] || CH.reef;
      return max(
        pad(v, ch.map((s) => M(R + s)), { t, type: 'triangle', a: 0.7, hold: 0.7, r: 1.2, g: 0.07, lp: o.to === 'trench' ? 800 : 1800 }),
        whoosh(v, { t, kind: 'pink', f0: 300, fm: 900, f1: 400, dur: 1.4, q: 0.7, g: 0.05, peak: 0.5 })
      );
    },
  },
  phase: {
    bus: 'sfx', cat: 'amb', poly: 1, gap: 2, rev: 0.45,
    fn(v, o) {
      const t = v.t, R = o.root || 60, to = o.to || 'day';
      if (to === 'dawn') return max(bell(v, M(R + 24), t, 0.04, 2.2), bell(v, M(R + 31), t + 0.5, 0.04, 2.5), pad(v, [R + 12, R + 19].map(M), { t, type: 'triangle', a: 1, hold: 0.6, r: 1.2, g: 0.04, lp: 2000 }));
      if (to === 'dusk') return max(pad(v, [R + 7, R + 12, R + 16].map(M), { t, type: 'triangle', a: 0.8, hold: 0.8, r: 1.4, g: 0.05, lp: 1500, lp2: 600 }), bell(v, M(R + 19), t + 0.2, 0.04, 2.4), bell(v, M(R + 12), t + 0.9, 0.035, 2.8));
      if (to === 'night') return max(bell(v, M(R + 12), t, 0.04, 3.2), pad(v, [R - 12, R - 5].map(M), { t, type: 'sine', a: 1.2, hold: 0.6, r: 1.4, g: 0.05, lp: 900 }));
      return max(bell(v, M(R + 28), t, 0.035, 1.6), bell(v, M(R + 31), t + 0.15, 0.035, 1.8));
    },
  },

  // ── catch fanfare (o: rarity, item, shiny, record, released) ──
  fanfare: {
    bus: 'sfx', cat: 'fanfare', poly: 2, gap: 0.3, rev: 0.26, dly: 0.1,
    fn(v, o) {
      const R = o.root || 60;
      const fn = (o.item && ITEM_FANFARES[o.item]) || FANFARES[o.rarity] || FANFARES.common;
      if (!o.item) v.out.gain.value *= { common: 0.75, uncommon: 0.8, rare: 1, epic: 0.9, legendary: 0.9, mythic: 1 }[o.rarity] || 0.75;
      let [end, land] = fn(v, R);
      if (o.shiny) end = max(end, shimmer(v, land, 1.6, R + 12, 0.032, 16));
      if (o.record) end = max(end, stamp(v, land + 0.35, R));
      if (o.released) end = max(end, releaseChime(v, land + 0.5, R));
      return end;
    },
  },
};

export const SFX_NAMES = Object.keys(SFX);

/** Option variants worth auditioning / measuring separately (the lab renders each one). */
const EXTRA_VARIANTS = [
  { label: 'cast weak', name: 'cast', opts: { power: 0.15 } },
  { label: 'hookSet perfect', name: 'hookSet', opts: { quality: 'perfect' } },
  { label: 'hookSet late', name: 'hookSet', opts: { quality: 'late' } },
  { label: 'splash 0.3', name: 'splash', opts: { size: 0.3 } },
  { label: 'splash 3 (breach)', name: 'splash', opts: { size: 3 } },
  { label: 'landed big', name: 'landed', opts: { size: 2.5 } },
  { label: 'thunder far', name: 'thunder', opts: { power: 0.55 } },
  { label: 'coins +450', name: 'coins', opts: { amount: 450 } },
  { label: 'coins +3', name: 'coins', opts: { amount: 3 } },
  { label: 'toast good', name: 'toast', opts: { kind: 'good' } },
  { label: 'toast warn', name: 'toast', opts: { kind: 'warn' } },
  { label: 'toast rare', name: 'toast', opts: { kind: 'rare' } },
  ...[0, 1, 2, 3].map((z) => ({ label: `zone ${['sunlit', 'twilight', 'midnight', 'abyss'][z]}`, name: 'zone', opts: { zone: z } })),
  { label: 'zone up', name: 'zone', opts: { zone: 0, up: true } },
  { label: 'phase dawn', name: 'phase', opts: { to: 'dawn' } },
  { label: 'phase dusk', name: 'phase', opts: { to: 'dusk' } },
  { label: 'phase night', name: 'phase', opts: { to: 'night' } },
  ...['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map((r) => ({ label: `fanfare ${r}`, name: 'fanfare', opts: { rarity: r } })),
  { label: 'fanfare rare shiny', name: 'fanfare', opts: { rarity: 'rare', shiny: true } },
  { label: 'fanfare epic record', name: 'fanfare', opts: { rarity: 'epic', record: true } },
  { label: 'fanfare legendary released', name: 'fanfare', opts: { rarity: 'legendary', released: true } },
  { label: 'fanfare junk', name: 'fanfare', opts: { item: 'junk' } },
  { label: 'fanfare treasure', name: 'fanfare', opts: { item: 'treasure' } },
  { label: 'fanfare bottle', name: 'fanfare', opts: { item: 'bottle' } },
];
export const SFX_VARIANTS = [...SFX_NAMES.filter((n) => n !== 'fanfare').map((name) => ({ label: name, name, opts: {} })), ...EXTRA_VARIANTS].filter((v) => SFX[v.name]);

/**
 * Instantiate one sound on a mixer. Returns the voice (or null).
 * o: { volume, pitch, pan, t, dest, ...recipe options }
 */
export function playSfx(mix, name, o = {}) {
  const def = SFX[name];
  if (!def) return null;
  const v = mix.voice(name, def.bus || 'sfx', {
    t: o.t,
    gain: (def.gain || 1) * (o.volume !== undefined ? o.volume : 1),
    pan: o.pan || 0,
    rev: o.rev !== undefined ? o.rev : def.rev || 0,
    dly: o.dly !== undefined ? o.dly : def.dly || 0,
    pitch: o.pitch || 1,
    poly: def.poly || 4,
    prio: def.cat === 'ui' || def.cat === 'fanfare' || def.cat === 'alert' || def.cat === 'stinger' ? 3 : def.cat === 'amb' ? 0 : 1,
    rng: o.rng,
    dest: o.dest,
  });
  let end;
  try {
    end = def.fn(v, o);
  } catch (e) {
    v.finish(v.t + 0.01);
    throw e;
  }
  v.finish(Number.isFinite(end) ? end : v.t + 1);
  return v;
}
