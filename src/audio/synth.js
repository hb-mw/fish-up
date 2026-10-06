// Fish Up — synthesis building blocks. Every helper builds its nodes through a Voice (mixer.js) so they
// are counted and cleaned up, connects into `o.dest` (default: the voice output) and returns the time
// at which it falls silent. All frequencies are multiplied by the voice pitch `v.p`.

export const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Percussive envelope: 0 → peak over `a`, exponential decay (time-constant tau). Returns the -60 dB time. */
export function ad(param, t, a, peak, tau) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(0, t + a, tau);
  return t + a + tau * 7;
}
/** Sustained envelope: attack a, hold to t+hold, release tau. */
export function asr(param, t, a, peak, hold, tau) {
  const h = Math.max(a, hold);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setValueAtTime(peak, t + h);
  param.setTargetAtTime(0, t + h, tau);
  return t + h + tau * 7;
}
/** Exponential (or linear) glide of a frequency-like param. */
export function glide(param, t, f0, f1, dur, exp = true) {
  param.setValueAtTime(f0, t);
  if (exp && f0 > 0 && f1 > 0) param.exponentialRampToValueAtTime(f1, t + Math.max(0.001, dur));
  else param.linearRampToValueAtTime(f1, t + Math.max(0.001, dur));
}
function envelope(v, g, t, o, defA, defG, defD) {
  return o.hold !== undefined
    ? asr(g.gain, t, o.a !== undefined ? o.a : Math.max(defA, 0.004), o.g !== undefined ? o.g : defG, o.hold, o.r !== undefined ? o.r : 0.08)
    : ad(g.gain, t, o.a !== undefined ? o.a : defA, o.g !== undefined ? o.g : defG, o.d !== undefined ? o.d : defD);
}

/**
 * Oscillator tone. o: { t, f, f2, gd (glide delay), glide, lin, type, detune, vib:{rate,depth cents},
 *   g, a, d | hold+r, lp, lq, dest }
 */
export function tone(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const f = o.f * v.p;
  const osc = v.osc(o.type || 'sine', f, t);
  if (o.f2) glide(osc.frequency, t + (o.gd || 0), f, o.f2 * v.p, o.glide || 0.1, !o.lin);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) {
    const l = v.osc('sine', o.vib.rate, t);
    const lg = v.gain(o.vib.depth);
    l.connect(lg);
    lg.connect(osc.detune);
  }
  let node = osc;
  if (o.lp) {
    const f2 = v.filter('lowpass', o.lp * v.p, o.lq || 0.8);
    node.connect(f2);
    node = f2;
  }
  const g = v.gain(0);
  node.connect(g);
  g.connect(o.dest || v.out);
  return envelope(v, g, t, o, 0.002, 0.3, 0.12);
}

/**
 * Filtered noise burst. o: { t, kind 'white'|'pink'|'brown', rate, type, f, f2, glide, q, type2, ff, q2,
 *   g, a, d | hold+r, dest }
 */
export function noise(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const s = v.src(v.mix.buffers[o.kind || 'white'], t, { rate: o.rate });
  let node = s;
  if (o.type) {
    const fl = v.filter(o.type, o.f * v.p, o.q !== undefined ? o.q : 0.9);
    if (o.f2) glide(fl.frequency, t + (o.gd || 0), o.f * v.p, o.f2 * v.p, o.glide || 0.2);
    node.connect(fl);
    node = fl;
  }
  if (o.type2) {
    const f2 = v.filter(o.type2, o.ff * v.p, o.q2 !== undefined ? o.q2 : 0.7);
    node.connect(f2);
    node = f2;
  }
  const g = v.gain(0);
  node.connect(g);
  g.connect(o.dest || v.out);
  return envelope(v, g, t, o, 0.002, 0.3, 0.08);
}

/** Looped texture buffer through an optional filter. o: { buf, t, rate, type, f, f2, glide, q, g, a, d|hold+r, dest } */
export function texture(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const s = v.src(o.buf, t, { rate: (o.rate || 1) * v.p });
  let node = s;
  if (o.type) {
    const fl = v.filter(o.type, o.f, o.q !== undefined ? o.q : 0.7);
    if (o.f2) glide(fl.frequency, t, o.f, o.f2, o.glide || 0.3);
    node.connect(fl);
    node = fl;
  }
  const g = v.gain(0);
  node.connect(g);
  g.connect(o.dest || v.out);
  return envelope(v, g, t, o, 0.005, 0.3, 0.2);
}

/**
 * Two-operator FM. o: { t, f, ratio, index, indexEnd (fraction), indexTau, type, g, a, d|hold+r, dest, detune }
 */
export function fm(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const f = o.f * v.p;
  const c = v.osc(o.type || 'sine', f, t);
  const m = v.osc('sine', f * o.ratio, t);
  if (o.detune) c.detune.value = o.detune;
  const mg = v.gain(0);
  m.connect(mg);
  mg.connect(c.frequency);
  const dev = f * o.ratio * o.index;
  mg.gain.setValueAtTime(dev, t);
  mg.gain.setTargetAtTime(dev * (o.indexEnd !== undefined ? o.indexEnd : 0.06), t + 0.001, o.indexTau || 0.12);
  const g = v.gain(0);
  c.connect(g);
  g.connect(o.dest || v.out);
  return envelope(v, g, t, o, 0.002, 0.3, 0.3);
}

// ── instruments (one note each) ─────────────────────────────────────────────────────────────────
/** Struck bell / celesta. decay = seconds to near-silence. */
export function bell(v, f, t, g = 0.25, decay = 1.6, dest) {
  const e1 = fm(v, { t, f, ratio: 3.5, index: 1.9, indexEnd: 0.12, indexTau: decay * 0.18, g, a: 0.002, d: decay / 6, dest });
  const e2 = tone(v, { t, f: f * 2.76, g: g * 0.22, a: 0.001, d: decay / 14, dest });
  return Math.max(e1, e2);
}
/** Kalimba tine: warm fundamental, bright inharmonic partial that dies fast, a thumb tick. */
export function kalimba(v, f, t, g = 0.25, decay = 0.9, dest) {
  const e1 = tone(v, { t, f, g, a: 0.002, d: decay / 4, dest });
  const e2 = tone(v, { t, f: f * 5.93, g: g * 0.18, a: 0.001, d: 0.035, dest });
  const e3 = tone(v, { t, f: f * 3.02, g: g * 0.08, a: 0.001, d: 0.09, dest });
  return Math.max(e1, e2, e3);
}
/** Marimba bar: fundamental + 4th partial (≈3.93×) + a soft mallet. */
export function marimba(v, f, t, g = 0.25, decay = 0.7, dest) {
  const e1 = tone(v, { t, f, g, a: 0.003, d: decay / 4.5, dest });
  const e2 = tone(v, { t, f: f * 3.93, g: g * 0.3, a: 0.002, d: 0.045, dest });
  const e3 = noise(v, { t, kind: 'pink', type: 'lowpass', f: Math.min(4000, f * 5), q: 0.7, g: g * 0.35, a: 0.001, d: 0.006, dest });
  return Math.max(e1, e2, e3);
}
/** Electric-piano (tine + bar): FM 1:1 body with a 14:1 attack chime. */
export function epiano(v, f, t, g = 0.2, hold = 0.6, dest) {
  const e1 = fm(v, { t, f, ratio: 1, index: 1.1, indexEnd: 0.25, indexTau: 0.5, g, a: 0.004, hold, r: 0.35, dest });
  const e2 = fm(v, { t, f, ratio: 14, index: 0.25, indexEnd: 0, indexTau: 0.03, g: g * 0.12, a: 0.001, d: 0.06, dest });
  return Math.max(e1, e2);
}
/** Plucked string (saw through a closing low-pass). */
export function pluck(v, f, t, g = 0.2, decay = 0.5, bright = 1, dest) {
  const o = v.osc('sawtooth', f * v.p, t);
  const lp = v.filter('lowpass', Math.min(16000, f * v.p * 9 * bright), 1.2);
  lp.frequency.setValueAtTime(Math.min(16000, f * v.p * 9 * bright), t);
  lp.frequency.setTargetAtTime(Math.max(80, f * v.p * 1.3), t + 0.005, decay * 0.12);
  const a = v.gain(0);
  o.connect(lp);
  lp.connect(a);
  a.connect(dest || v.out);
  return ad(a.gain, t, 0.002, g, decay / 5);
}
/** Round, soft bass note. */
export function bass(v, f, t, g = 0.3, hold = 0.4, dest) {
  const e1 = tone(v, { t, f, type: 'triangle', g, a: 0.006, hold, r: 0.09, lp: Math.min(900, f * 5), dest });
  const e2 = tone(v, { t, f, g: g * 0.6, a: 0.006, hold, r: 0.1, dest });
  return Math.max(e1, e2);
}
/** Low thump with a pitch drop (kick, hull knock, hook-set body). */
export function thump(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  return tone(v, { t, f: o.f0 || 110, f2: o.f1 || 45, glide: o.glide || 0.08, g: o.g !== undefined ? o.g : 0.5, a: 0.002, d: o.d || 0.1, dest: o.dest });
}
/** Short bright tick (band-passed noise). */
export function tick(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  return noise(v, { t, kind: 'white', type: 'bandpass', f: o.f || 3000, q: o.q || 1.4, g: o.g !== undefined ? o.g : 0.3, a: 0.0005, d: o.d || 0.004, dest: o.dest });
}
/** Air / water whoosh: band-pass sweep with a rise-and-fall envelope. */
export function whoosh(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const dur = o.dur || 0.4;
  const s = v.src(v.mix.buffers[o.kind || 'pink'], t);
  const fl = v.filter('bandpass', o.f0 * v.p, o.q || 1.2);
  fl.frequency.setValueAtTime(o.f0 * v.p, t);
  if (o.fm) {
    fl.frequency.exponentialRampToValueAtTime(o.fm * v.p, t + dur * (o.peak || 0.45));
    fl.frequency.exponentialRampToValueAtTime(o.f1 * v.p, t + dur);
  } else fl.frequency.exponentialRampToValueAtTime(o.f1 * v.p, t + dur);
  const g = v.gain(0);
  s.connect(fl);
  fl.connect(g);
  g.connect(o.dest || v.out);
  const pk = t + dur * (o.peak || 0.45);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.g !== undefined ? o.g : 0.3, pk);
  g.gain.setTargetAtTime(0, pk, (t + dur - pk) / 3 + 0.01);
  return t + dur + (t + dur - pk) * 1.5 + 0.05;
}
/** A one-off sub boom (big hits, thunder body, abyss). */
export function boom(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const e1 = tone(v, { t, f: o.f0 || 70, f2: o.f1 || 32, glide: o.glide || 0.5, g: o.g !== undefined ? o.g : 0.5, a: 0.006, d: o.d || 0.35, dest: o.dest });
  const e2 = noise(v, { t, kind: 'brown', type: 'lowpass', f: 220, q: 0.7, g: (o.g || 0.5) * 0.5, a: 0.004, d: (o.d || 0.35) * 0.6, dest: o.dest });
  return Math.max(e1, e2);
}

/**
 * Sustained chord pad: two detuned oscillators per note → one shared low-pass → one envelope.
 * o: { t, a, hold, r, g, lp, lp2 (cutoff at release), q, type, detune (cents), dest }
 */
export function pad(v, freqs, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const lp = v.filter('lowpass', (o.lp || 1800) * v.p, o.q || 0.6);
  if (o.lp2) glide(lp.frequency, t, (o.lp || 1800) * v.p, o.lp2 * v.p, (o.a || 0.3) + (o.hold || 0.5), true);
  const env = v.gain(0);
  lp.connect(env);
  env.connect(o.dest || v.out);
  const each = 1 / Math.sqrt(freqs.length * 2);
  const det = o.detune !== undefined ? o.detune : 7;
  for (const f of freqs) {
    for (const d of [-det, det]) {
      const osc = v.osc(o.type || 'sawtooth', f * v.p, t);
      osc.detune.value = d;
      const g = v.gain(each);
      osc.connect(g);
      g.connect(lp);
    }
  }
  return asr(env.gain, t, o.a || 0.3, o.g !== undefined ? o.g : 0.1, o.hold || 0.5, o.r || 0.5);
}
/** Brass-like stab/chord: saws through a low-pass that opens with the attack. */
export function brass(v, freqs, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const top = (o.bright || 2600) * v.p;
  const lp = v.filter('lowpass', 300, 1.1);
  lp.frequency.setValueAtTime(350, t);
  lp.frequency.linearRampToValueAtTime(top, t + (o.a || 0.04) + 0.03);
  lp.frequency.setTargetAtTime(top * 0.55, t + (o.a || 0.04) + 0.05, 0.25);
  const env = v.gain(0);
  lp.connect(env);
  env.connect(o.dest || v.out);
  const each = 1 / Math.sqrt(freqs.length * 2);
  for (const f of freqs) {
    for (const d of [-6, 5]) {
      const osc = v.osc('sawtooth', f * v.p, t);
      osc.detune.value = d;
      if (o.vib) {
        const l = v.osc('sine', 5.2, t);
        const lg = v.gain(0);
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(o.vib, t + Math.max(0.2, (o.hold || 0.3) * 0.6));
        l.connect(lg);
        lg.connect(osc.detune);
      }
      const g = v.gain(each);
      osc.connect(g);
      g.connect(lp);
    }
  }
  return asr(env.gain, t, o.a || 0.04, o.g !== undefined ? o.g : 0.12, o.hold || 0.3, o.r || 0.18);
}
/** Choir-ish "aah": detuned saws through two vowel formants. */
export function choir(v, freqs, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const env = v.gain(0);
  env.connect(o.dest || v.out);
  const f1 = v.filter('bandpass', 760, 3.2), f2 = v.filter('bandpass', 1180, 4), f3 = v.filter('bandpass', 2600, 6);
  const mixg = v.gain(1);
  const lp = v.filter('lowpass', 3200, 0.5);
  for (const f of [f1, f2, f3]) {
    mixg.connect(f);
    f.connect(lp);
  }
  lp.connect(env);
  const each = 1.6 / Math.sqrt(freqs.length * 3);
  for (const f of freqs) {
    for (const d of [-9, 0, 8]) {
      const osc = v.osc('sawtooth', f * v.p, t);
      osc.detune.value = d;
      const g = v.gain(each);
      osc.connect(g);
      g.connect(mixg);
    }
  }
  return asr(env.gain, t, o.a || 0.6, o.g !== undefined ? o.g : 0.2, o.hold || 1, o.r || 0.8);
}
/** Cymbal: crash (a≈0) or swell (a = swell time), long shimmering decay. */
export function cymbal(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const s = v.src(v.mix.buffers.white, t);
  const hp = v.filter('highpass', 4200, 0.7);
  const bp = v.filter('peaking', 8500, 0.8);
  bp.gain.value = 6;
  const g = v.gain(0);
  s.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(o.dest || v.out);
  const a = o.a || 0.003;
  g.gain.setValueAtTime(0, t);
  if (a > 0.05) g.gain.linearRampToValueAtTime(o.g || 0.1, t + a);
  else g.gain.linearRampToValueAtTime(o.g || 0.1, t + a);
  g.gain.setTargetAtTime(0, t + a, (o.d || 1.2) / 5);
  return t + a + (o.d || 1.2) * 1.4;
}
/** Drum roll (snare / timpani): n hits over dur, accelerating and swelling. */
export function roll(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const n = o.n || 10, dur = o.dur || 0.6;
  let end = t;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const at = t + dur * (1 - Math.pow(1 - k, 1.4));
    const gg = (o.g || 0.2) * (0.35 + 0.65 * k);
    if (o.timpani) end = Math.max(end, tone(v, { t: at, f: o.f || 82, f2: (o.f || 82) * 0.94, glide: 0.1, g: gg, a: 0.002, d: 0.12, dest: o.dest }));
    end = Math.max(end, noise(v, { t: at, kind: 'white', type: 'bandpass', f: o.timpani ? 700 : 2200, q: 0.8, g: gg * (o.timpani ? 0.3 : 0.6), a: 0.001, d: 0.03, dest: o.dest }));
  }
  return end;
}
/** Wooden creak: stick-slip pulses (a slowly sweeping saw) through two body resonances. */
export function creak(v, o) {
  const t = o.t !== undefined ? o.t : v.t;
  const dur = o.dur || 0.6;
  const s = v.osc('sawtooth', o.r0 || 45, t);
  s.frequency.setValueAtTime(o.r0 || 45, t);
  s.frequency.linearRampToValueAtTime(o.r1 || 80, t + dur);
  const j = v.osc('sine', 13 + 9 * v.rng(), t);
  const jg = v.gain((o.r0 || 45) * 0.25);
  j.connect(jg);
  jg.connect(s.frequency);
  const b1 = v.filter('bandpass', (o.f || 700) * v.p, o.q || 7);
  const b2 = v.filter('bandpass', (o.f || 700) * 1.9 * v.p, (o.q || 7) * 1.3);
  const g = v.gain(0);
  s.connect(b1);
  s.connect(b2);
  b1.connect(g);
  b2.connect(g);
  g.connect(o.dest || v.out);
  return asr(g.gain, t, o.a || 0.06, o.g !== undefined ? o.g : 0.1, dur, 0.06);
}

/** Symmetric soft-saturation curve (odd → no DC). drive 1 = gentle, 4 = gritty. */
export function driveCurve(drive = 2, n = 1024) {
  const c = new Float32Array(n);
  const k = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / k;
  }
  return c;
}

/** A PeriodicWave from one cycle of samples (DC is ignored by the API). normalize → peak 1. */
export function waveFromCycle(ctx, cycle, harmonics = 48, normalize = false) {
  const N = cycle.length;
  const re = new Float32Array(harmonics + 1), im = new Float32Array(harmonics + 1);
  for (let h = 1; h <= harmonics; h++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) {
      const ph = (2 * Math.PI * h * i) / N;
      a += cycle[i] * Math.cos(ph);
      b += cycle[i] * Math.sin(ph);
    }
    re[h] = (2 * a) / N;
    im[h] = (2 * b) / N;
  }
  return ctx.createPeriodicWave(re, im, { disableNormalization: !normalize });
}
