// Fish Up — continuous fishing feedback (same layer shape as amb-above.js; routed to the sfx bus so it is
// never muffled by the camera depth). Read from game.fishing every frame via the inputs snapshot.
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const LINE_OUT = new Set(['waiting', 'bite', 'fight', 'landing']);
const ON_HOOK = new Set(['bite', 'fight', 'landing']);

export const FISHING = {
  // Retrieve: a crisp ratchet whose click rate follows reelRate, over a soft gear whirr.
  ratchet: {
    dest: 'sfx',
    build(a) {
      const s = a.src(a.B.ratchet), bp = a.filter('bandpass', 3000, 0.6), g = a.gain(1);
      s.connect(bp);
      bp.connect(g);
      g.connect(a.out);
      const w = a.osc('triangle', 110), wlp = a.filter('lowpass', 500, 1.2), wg = a.gain(0.18);
      w.connect(wlp);
      wlp.connect(wg);
      wg.connect(a.out);
      return { s, w };
    },
    level: (I) => (!I.paused && I.reelRate > 0.03 && LINE_OUT.has(I.fstate) ? 0.2 * (0.55 + 0.45 * clamp01(I.reelRate)) : 0),
    control(p, I, set) {
      const r = clamp01(I.reelRate);
      set(p.s.playbackRate, 0.45 + 1.2 * r, 0.05);
      set(p.w.frequency, 70 + 170 * r, 0.08);
    },
  },

  // Drag scream: the clicker runs faster and faster as the fish takes line, from a ratchet into a buzz.
  drag: {
    dest: 'sfx',
    build(a) {
      const slow = a.src(a.B.drag), fast = a.src(a.B.dragFast);
      const sg = a.gain(1), fg = a.gain(0), bp = a.filter('bandpass', 3800, 0.55);
      slow.connect(sg);
      fast.connect(fg);
      sg.connect(bp);
      fg.connect(bp);
      bp.connect(a.out);
      const whine = a.osc('sine', 800), wg = a.gain(0);
      whine.connect(wg);
      wg.connect(a.out);
      return { slow, fast, sg, fg, whine, wg };
    },
    level: (I) => (!I.paused && I.reelRate < -0.03 && ON_HOOK.has(I.fstate) ? 0.38 * (0.5 + 0.5 * clamp01(-I.reelRate)) : 0),
    control(p, I, set) {
      const u = clamp01(-I.reelRate);
      set(p.slow.playbackRate, 0.5 + 1.0 * u, 0.04);
      set(p.fast.playbackRate, 0.6 + 0.9 * u, 0.04);
      set(p.sg.gain, 1 - smoothstep(0.35, 0.75, u), 0.06);
      set(p.fg.gain, smoothstep(0.3, 0.75, u), 0.06);
      set(p.whine.frequency, 650 + 1100 * u, 0.08);
      set(p.wg.gain, 0.06 * smoothstep(0.4, 1, u), 0.1);
    },
  },

  // Free spool: the lure sinking pulls line off an open spool — a soft whirr.
  spool: {
    dest: 'sfx',
    build(a) {
      const s = a.src(a.B.whizz, 0.5), bp = a.filter('bandpass', 2400, 0.9), g = a.gain(1);
      s.connect(bp);
      bp.connect(g);
      g.connect(a.out);
      return { s };
    },
    level: (I) => (!I.paused && I.fstate === 'waiting' && I.spoolFree && I.lureInWater && I.reelRate <= 0.01 && (I.reelRate < -0.02 || I.lureSpeed > 40) ? 0.05 : 0),
    control(p, I, set) {
      const u = Math.max(clamp01(-I.reelRate), clamp01(I.lureSpeed / 320));
      set(p.s.playbackRate, 0.35 + 0.6 * u, 0.1);
    },
  },

  // Strain: rod/line creaks while the load changes, then a singing, trembling line toward the red.
  strain: {
    dest: 'sfx',
    build(a) {
      const c = a.osc('sawtooth', 52), wander = a.src(a.B.brown, 0.03), wg = a.gain(30);
      wander.connect(wg);
      wg.connect(c.frequency);
      const b1 = a.filter('bandpass', 760, 7), b2 = a.filter('bandpass', 1480, 9), cg = a.gain(0);
      c.connect(b1);
      c.connect(b2);
      b1.connect(cg);
      b2.connect(cg);
      cg.connect(a.out);
      const s1 = a.osc('sine', 520), s2 = a.osc('sine', 527), s2g = a.gain(0);
      const trem = a.osc('sine', 8), tg = a.gain(0.45), am = a.gain(0.55), sg = a.gain(0);
      trem.connect(tg);
      tg.connect(am.gain);
      s1.connect(am);
      s2.connect(s2g);
      s2g.connect(am);
      am.connect(sg);
      sg.connect(a.out);
      return { c, cg, b1, s1, s2, s2g, trem, sg };
    },
    level: (I) => (!I.paused && ON_HOOK.has(I.fstate) ? 0.13 * smoothstep(0.35, 0.85, I.tension) : 0),
    control(p, I, set, S) {
      const T = I.tension;
      const act = clamp01(Math.abs(S.tensionRate || 0) * 1.6);
      set(p.cg.gain, (0.25 + 0.75 * act) * smoothstep(0.4, 0.9, T) * 0.9, 0.08);
      set(p.c.frequency, 40 + 50 * T, 0.2);
      set(p.b1.frequency, 700 + 220 * T, 0.2);
      const u = smoothstep(0.76, 1.05, T), red = smoothstep(0.97, 1.12, T);
      set(p.sg.gain, 0.28 * u + 0.18 * red, 0.06);
      set(p.s1.frequency, 420 + 900 * u + 200 * red, 0.08);
      set(p.s2.frequency, (420 + 900 * u + 200 * red) * 1.03, 0.08);
      set(p.s2g.gain, red, 0.06);
      set(p.trem.frequency, 7 + 13 * red, 0.1);
    },
  },

  // Line whizzing off the spool while the lure flies.
  whizz: {
    dest: 'sfx',
    build(a) {
      const s = a.src(a.B.whizz), bp = a.filter('bandpass', 3400, 0.8), g = a.gain(1);
      s.connect(bp);
      bp.connect(g);
      g.connect(a.out);
      return { s };
    },
    level(I, S) {
      if (I.paused || I.fstate !== 'casting') return 0;
      const spd = clamp01(I.lureSpeed / 900);
      return 0.13 * Math.max(spd, Math.exp(-S.stateT / 0.9));
    },
    control(p, I, set, S) {
      const spd = Math.max(clamp01(I.lureSpeed / 900), Math.exp(-S.stateT / 0.9));
      set(p.s.playbackRate, 0.6 + 1.1 * spd, 0.05);
    },
  },

  // Charging a cast: the rod loading up — a rising, airy strain.
  charge: {
    dest: 'sfx',
    build(a) {
      const n = a.src(a.B.pink), bp = a.filter('bandpass', 400, 2.2), g = a.gain(1);
      n.connect(bp);
      bp.connect(g);
      g.connect(a.out);
      const o = a.osc('triangle', 180), og = a.gain(0.12);
      o.connect(og);
      og.connect(a.out);
      return { bp, o };
    },
    level: (I) => (!I.paused && I.fstate === 'charging' ? 0.05 * (0.3 + 0.7 * clamp01(I.charge)) : 0),
    control(p, I, set) {
      const c = clamp01(I.charge);
      set(p.bp.frequency, 320 + 1100 * c, 0.05);
      set(p.o.frequency, 160 + 260 * c, 0.05);
    },
  },
};
