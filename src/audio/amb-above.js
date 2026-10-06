// Fish Up — above-water ambience layers. Each layer: { dest, build(a) → p, level(I, S) → gain, control(p, I, set, S) }
// (a = the layer-builder API from ambience.js; I = inputs; S = shared ambience state; set = smoothed param setter)
import { waveHeight } from '../world/waves.js';
import { driveCurve, waveFromCycle } from './synth.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const seaK = (I) => clamp01((I.sea - 0.4) / 1.7);

/** Island proximity 0..1 (gulls by day, crickets by night). */
export const nearIsland = (I) => 1 - smoothstep(1500, 3600, I.camX);

export const ABOVE = {
  // Swells washing (two washes that follow the real sea surface left/right of view), a low sea rumble,
  // laps against the hull, and the hiss of water along the hull when sailing.
  waves: {
    dest: 'above',
    build(a) {
      const mk = (buf, f, pan, type = 'lowpass') => {
        const s = a.src(buf);
        const lp = a.filter(type, f, 0.5);
        const g = a.gain(0.5);
        const p = a.panner(pan);
        s.connect(lp);
        lp.connect(g);
        g.connect(p);
        p.connect(a.out);
        return { lp, g };
      };
      return {
        washL: mk(a.B.pink, 700, -0.6),
        washR: mk(a.B.pink, 700, 0.6),
        rumble: mk(a.B.brown, 380, 0),
        laps: mk(a.B.laps, 180, 0, 'highpass'),
        hull: mk(a.B.pink, 1200, 0.15, 'bandpass'),
      };
    },
    level: (I) => 0.36 * (0.6 + 0.25 * seaK(I)) * (1 - 0.3 * I.night),
    control(p, I, set) {
      const k = seaK(I), t = I.time;
      const xs = [I.camX - I.halfW * 0.6, I.camX + I.halfW * 0.6];
      [p.washL, p.washR].forEach((w, i) => {
        const h0 = waveHeight(xs[i], t, 1), h1 = waveHeight(xs[i], t + 0.15, 1);
        const sw = 0.5 + 0.5 * Math.tanh((h0 - h1) / 0.15 / 10);
        set(w.g.gain, (0.16 + 0.22 * sw) * (0.6 + 0.3 * k), 0.25);
        set(w.lp.frequency, 420 + (600 + 1700 * k) * sw * (1 - 0.35 * I.night), 0.25);
      });
      set(p.rumble.g.gain, 0.27 + 0.2 * k, 0.5);
      set(p.rumble.lp.frequency, 260 + 260 * k, 0.5);
      const boatNear = 1 - smoothstep(I.halfW * 0.8, I.halfW * 1.6, Math.abs(I.boatX - I.camX));
      set(p.laps.g.gain, (0.12 + 0.24 * k) * (1 - 0.4 * I.night) * (0.35 + 0.65 * boatNear), 0.5);
      const spd = clamp01(Math.abs(I.boatVx) / 320);
      set(p.hull.g.gain, 0.5 * Math.pow(spd, 1.3) * boatNear, 0.3);
      set(p.hull.lp.frequency, 900 + 900 * spd, 0.3);
    },
  },

  // Wind: a broad gusting rush plus a resonant howl that wanders in pitch; panned by wind direction.
  wind: {
    dest: 'above',
    build(a) {
      const s = a.src(a.B.pink), bp = a.filter('bandpass', 500, 0.8), g = a.gain(0.6);
      const h = a.src(a.B.white), hb = a.filter('bandpass', 800, 14), hg = a.gain(0.0);
      const pan = a.panner(0);
      s.connect(bp);
      bp.connect(g);
      g.connect(pan);
      h.connect(hb);
      hb.connect(hg);
      hg.connect(pan);
      pan.connect(a.out);
      return { bp, g, hb, hg, pan };
    },
    level: (I) => 0.16 * Math.pow(clamp01(I.wind), 1.6),
    control(p, I, set, S) {
      const t = I.real;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.37 + Math.sin(t * 0.13) * 2.1) * Math.sin(t * 0.21 + 1.3);
      const w = clamp01(I.wind);
      set(p.g.gain, 0.45 + 0.55 * gust, 0.4);
      set(p.bp.frequency, 320 + (380 + 700 * w) * gust, 0.4);
      set(p.hg.gain, 1.0 * smoothstep(0.45, 1, w) * (0.3 + 0.7 * gust), 0.5);
      set(p.hb.frequency, 520 + 600 * w + 260 * Math.sin(t * 0.29), 0.6);
      set(p.pan.pan, 0.35 * I.windDir, 1);
    },
  },

  // Rain: sparse drops → dense hiss, plus fat drops on the deck when the boat is near.
  rain: {
    dest: 'above',
    build(a) {
      const mk = (buf, hp) => {
        const s = a.src(buf), f = a.filter('highpass', hp, 0.6), g = a.gain(0);
        s.connect(f);
        f.connect(g);
        g.connect(a.out);
        return g;
      };
      return { light: mk(a.B.rainLight, 500), heavy: mk(a.B.rainHeavy, 350), deck: mk(a.B.rainDeck, 200) };
    },
    level: (I) => 0.28 * smoothstep(0.02, 0.35, I.rain),
    control(p, I, set) {
      const r = I.rain;
      const boatNear = 1 - smoothstep(I.halfW * 0.8, I.halfW * 1.6, Math.abs(I.boatX - I.camX));
      set(p.light.gain, 0.7 * smoothstep(0.02, 0.35, r) * (1 - 0.5 * smoothstep(0.6, 1, r)), 0.8);
      set(p.heavy.gain, 0.5 * smoothstep(0.25, 1, r), 0.8);
      set(p.deck.gain, 0.45 * smoothstep(0.1, 0.6, r) * boatNear, 0.8);
    },
  },

  // Island crickets at night: three chirping insects (AM-pulsed sines) at slightly different rates.
  crickets: {
    dest: 'above',
    build(a) {
      const out = [];
      [[4650, 31, 1.7, -0.5], [4420, 27, 1.3, 0.3], [4900, 35, 2.1, 0.7]].forEach(([f, pr, cr, pan]) => {
        const o = a.osc('sine', f);
        const pulse = a.osc('square', pr), pg = a.gain(0.5), am = a.gain(0.5);
        const chirp = a.osc('square', cr), cg = a.gain(0.5), am2 = a.gain(0.5);
        pulse.connect(pg);
        pg.connect(am.gain);
        chirp.connect(cg);
        cg.connect(am2.gain);
        const p = a.panner(pan), lp = a.filter('lowpass', 5200, 0.7);
        o.connect(am);
        am.connect(am2);
        am2.connect(lp);
        lp.connect(p);
        p.connect(a.out);
        out.push(am2);
      });
      return {};
    },
    level: (I) => 0.014 * smoothstep(0.4, 0.9, I.night) * nearIsland(I) * (1 - smoothstep(0.1, 0.4, I.rain)) * (1 - smoothstep(0.5, 0.9, I.wind)),
    control() {},
  },

  // Outboard engine: a band-limited firing pulse (rate from throttle) through exhaust resonances, with
  // a noise "putt" gated by the same firing clock, grit by boat tier. Shuts off a few seconds after idling.
  engine: {
    dest: 'above',
    build(a, S) {
      if (!S.pulseWave) {
        const N = 1024, cyc = new Float32Array(N), bump = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const x = i / N;
          cyc[i] = Math.exp(-(((x - 0.1) / 0.035) ** 2)) - 0.35 * Math.exp(-(((x - 0.2) / 0.06) ** 2));
          bump[i] = Math.exp(-(((x - 0.12) / 0.09) ** 2));
        }
        S.pulseWave = waveFromCycle(a.ctx, cyc, 220, true);
        S.bumpWave = waveFromCycle(a.ctx, bump, 24, true);
      }
      const rate = a.constant(10);
      const jit = a.osc('sine', 2.3), jg = a.gain(0.35);
      jit.connect(jg);
      jg.connect(rate.offset);
      const p1 = a.osc(S.pulseWave, 0), p2 = a.osc(S.pulseWave, 0), k2 = a.gain(1.013), bump = a.osc(S.bumpWave, 0);
      rate.connect(p1.frequency);
      rate.connect(k2);
      k2.connect(p2.frequency);
      rate.connect(bump.frequency);
      const twin = a.gain(0);
      p2.connect(twin);
      const drive = a.shaper(driveCurve(2.5));
      const pre = a.gain(0.8);
      p1.connect(pre);
      twin.connect(pre);
      pre.connect(drive);
      const ex = a.filter('bandpass', 150, 2.6), body = a.filter('lowpass', 1200, 0.8), exg = a.gain(1.6), bodyg = a.gain(0.45);
      drive.connect(ex);
      drive.connect(body);
      ex.connect(exg);
      body.connect(bodyg);
      const n = a.src(a.B.pink), gate = a.gain(0.4), nbp = a.filter('bandpass', 1100, 0.9), ng = a.gain(0.5);
      bump.connect(gate.gain);
      n.connect(gate);
      gate.connect(nbp);
      nbp.connect(ng);
      const burb = a.src(a.B.brown), blp = a.filter('lowpass', 420, 0.8), bg = a.gain(0);
      burb.connect(blp);
      blp.connect(bg);
      const sum = a.gain(1);
      [exg, bodyg, ng, bg].forEach((x) => x.connect(sum));
      sum.connect(a.out);
      return { rate, twin, drive, ex, body, ng, bg, blp, tier: -1 };
    },
    level(I, S) {
      const thr = Math.abs(I.throttle), moving = thr > 0.03 || Math.abs(I.boatVx) > 15;
      if (moving && !I.paused) S.engineIdle = 0;
      else S.engineIdle = (S.engineIdle || 0) + S.dt;
      const on = S.engineIdle < 3.5 ? 1 : 0;
      const boatNear = 1 - smoothstep(I.halfW * 0.9, I.halfW * 2, Math.abs(I.boatX - I.camX));
      return on * 0.45 * (0.11 + 0.17 * Math.pow(thr, 0.8)) * (0.4 + 0.6 * boatNear) * (I.paused ? 0 : 1);
    },
    control(p, I, set) {
      const tier = Math.max(0, Math.min(2, Math.round(I.tier)));
      const T = [
        { idle: 8.5, top: 31, ex: 165, q: 2.8, lp: 1500, drive: 3.2, twin: 0 },
        { idle: 13, top: 46, ex: 125, q: 2.2, lp: 1100, drive: 1.9, twin: 0 },
        { idle: 17, top: 58, ex: 95, q: 1.7, lp: 850, drive: 1.5, twin: 0.85 },
      ][tier];
      if (p.tier !== tier) {
        p.tier = tier;
        p.drive.curve = driveCurve(T.drive);
        set(p.ex.Q, T.q, 0.2);
        set(p.twin.gain, T.twin, 0.3);
      }
      const thr = Math.abs(I.throttle);
      set(p.rate.offset, T.idle + (T.top - T.idle) * Math.pow(thr, 0.85), 0.35);
      set(p.ex.frequency, T.ex * (1 + 0.5 * thr), 0.35);
      set(p.body.frequency, T.lp * (0.7 + 0.6 * thr), 0.35);
      set(p.ng.gain, 0.35 + 0.5 * thr, 0.3);
      set(p.bg.gain, 0.6 * thr, 0.4);
      set(p.blp.frequency, 250 + 450 * thr, 0.4);
    },
  },
};
