// Fish Up — the mixer: buses, master chain, shared reverb + delay sends, voice registry.
// Works on any BaseAudioContext, so the live game and the lab's OfflineAudioContext renders share
// exactly the same graph.
//
//   voices ─┬─ bus.dry ─[lp]─ duck ─ fader ─┐
//           ├─ bus.rev ─[lp]─ duck ─ fader ─┼─ reverb (generated IR) ─┐
//           └─ bus.dly ─[lp]─ duck ─ fader ─┴─ stereo delay ──────────┤
//                                           └─────────────────────────┴─ master ─ trim ─ HP ─ limiter ─ soft clip ─ out
import { getBuffers } from './buffers.js';

export const BUS_NAMES = ['ambience', 'sfx', 'music', 'ui'];
const FILTERED = new Set(['music', 'ambience']);
const MAX_VOICES = 80;
/** One-shots start this far ahead of currentTime so their first envelope point is never in the past. */
export const LEAD = 0.015;
/** Pre-limiter trim that cancels the DynamicsCompressor's automatic make-up gain (measured in dev/audio-lab). */
const TRIM = 0.68;

export function createMixer(ctx) {
  const buffers = getBuffers(ctx);
  let nodeCount = 0;
  const voices = [];
  const byName = new Map();

  // ── master chain ──
  const master = ctx.createGain();
  const trim = ctx.createGain();
  trim.gain.value = TRIM;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 24;
  hp.Q.value = 0.55;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -6;
  lim.knee.value = 1.5;
  lim.ratio.value = 20;
  lim.attack.value = 0.002;
  lim.release.value = 0.16;
  const pre = ctx.createGain();
  pre.gain.value = 0.5; // the shaper curve spans ±2 (see softClipCurve)
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = 'none';
  const out = ctx.createGain();
  master.connect(trim);
  trim.connect(hp);
  hp.connect(lim);
  lim.connect(pre);
  pre.connect(clip);
  clip.connect(out);
  out.connect(ctx.destination);

  // ── shared reverb ──
  const revIn = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = buffers.ir;
  const revOut = ctx.createGain();
  revOut.gain.value = 0.55;
  revIn.connect(conv);
  conv.connect(revOut);
  revOut.connect(master);

  // ── stereo delay (two lines panned apart, darkening repeats) → master + a little into the reverb ──
  const dlyIn = ctx.createGain();
  const dlyHp = ctx.createBiquadFilter();
  dlyHp.type = 'highpass';
  dlyHp.frequency.value = 220;
  const dlyOut = ctx.createGain();
  dlyOut.gain.value = 0.5;
  dlyIn.connect(dlyHp);
  for (const [time, pan] of [[0.375, -0.55], [0.5, 0.55]]) {
    const d = ctx.createDelay(1.5);
    d.delayTime.value = time;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    dlyHp.connect(d);
    d.connect(lp);
    lp.connect(fb);
    fb.connect(d);
    lp.connect(p);
    p.connect(dlyOut);
  }
  dlyOut.connect(master);
  const dlyToRev = ctx.createGain();
  dlyToRev.gain.value = 0.25;
  dlyOut.connect(dlyToRev);
  dlyToRev.connect(revIn);

  // ── buses ──
  const buses = {};
  for (const name of BUS_NAMES) {
    const bus = { name, level: 1, pauseK: 1, streams: [], lps: [], ducks: [], faders: [], duckLevel: 1, duckUntil: 0 };
    for (const kind of ['dry', 'rev', 'dly']) {
      const input = ctx.createGain();
      let node = input;
      if (FILTERED.has(name)) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 20000;
        lp.Q.value = 0.6;
        node.connect(lp);
        node = lp;
        bus.lps.push(lp);
      }
      const duck = ctx.createGain();
      const fader = ctx.createGain();
      node.connect(duck);
      duck.connect(fader);
      fader.connect(kind === 'dry' ? master : kind === 'rev' ? revIn : dlyIn);
      bus[kind] = input;
      bus.ducks.push(duck);
      bus.faders.push(fader);
    }
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    bus.faders[0].connect(an);
    bus.analyser = an;
    buses[name] = bus;
  }
  const masterAn = ctx.createAnalyser();
  masterAn.fftSize = 2048;
  out.connect(masterAn);

  const mix = {
    ctx,
    buffers,
    buses,
    master,
    get nodeCount() {
      return nodeCount;
    },
    voices,
    now: () => ctx.currentTime,

    /** Smoothly set a bus level (linear gain). */
    setBusLevel(name, v, tau = 0.08) {
      const bus = buses[name];
      if (!bus) return;
      bus.level = v;
      applyFader(bus, tau);
    },
    /** 0..1 pause attenuation for a bus (1 = not paused). */
    setBusPause(name, k, tau = 0.12) {
      const bus = buses[name];
      if (!bus) return;
      bus.pauseK = k;
      applyFader(bus, tau);
    },
    setBusFilter(name, freq, tau = 0.15) {
      const bus = buses[name];
      if (!bus) return;
      const t = ctx.currentTime;
      for (const lp of bus.lps) lp.frequency.setTargetAtTime(Math.max(40, Math.min(20000, freq)), t, tau);
    },
    setMaster(v, tau = 0.08) {
      master.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, tau);
    },
    /**
     * Duck a bus (sidechain-style): fall to `level` within ~attack, hold until t+hold, recover over ~release.
     * A deeper duck wins; a shallower one only extends the hold.
     */
    duck(name, level, hold = 0.5, attack = 0.04, release = 0.5) {
      const bus = buses[name];
      if (!bus) return;
      const t = ctx.currentTime;
      const until = t + hold;
      const active = t < bus.duckUntil;
      const lvl = active ? Math.min(level, bus.duckLevel) : level;
      const end = active ? Math.max(until, bus.duckUntil) : until;
      for (const d of bus.ducks) {
        d.gain.cancelScheduledValues(t);
        d.gain.setTargetAtTime(lvl, t, attack / 3);
        d.gain.setTargetAtTime(1, end, release / 3);
      }
      bus.duckLevel = lvl;
      bus.duckUntil = end;
    },

    /**
     * Create a voice (a self-cleaning group of nodes) on a bus.
     * opts: { t, gain, pan, rev, dly, pitch, poly, prio }
     */
    voice(name, busName, o = {}) {
      const bus = buses[busName] || buses.sfx;
      const poly = o.poly || 6;
      let list = byName.get(name);
      if (!list) byName.set(name, (list = []));
      while (list.length >= poly) list[0].kill(0.03);
      if (voices.length >= MAX_VOICES) {
        let worst = null;
        for (const v of voices) if (!v.dying && (!worst || v.prio < worst.prio || (v.prio === worst.prio && v.t < worst.t))) worst = v;
        if (worst) worst.kill(0.03);
      }
      const v = new Voice(mix, name, bus, o);
      voices.push(v);
      list.push(v);
      return v;
    },

    /** Drop voices whose sources never reported 'ended' (belt and braces against leaks). */
    sweep() {
      const t = ctx.currentTime;
      for (let i = voices.length - 1; i >= 0; i--) {
        const v = voices[i];
        if (v.finished && t > v.end + 0.75) v.dispose();
        else if (!v.finished && t > v.t + 30) v.dispose();
      }
    },
    /** Remove every voice immediately (context teardown). */
    killAll() {
      for (let i = voices.length - 1; i >= 0; i--) voices[i].kill(0.02);
    },

    /** RMS level in dBFS of a bus (post-fader) or 'master'. */
    level(name) {
      const an = name === 'master' ? masterAn : buses[name] && buses[name].analyser;
      if (!an) return -Infinity;
      const a = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(a);
      let e = 0;
      for (let i = 0; i < a.length; i++) e += a[i] * a[i];
      return 10 * Math.log10(e / a.length + 1e-12);
    },
    peakMaster() {
      const a = new Float32Array(masterAn.fftSize);
      masterAn.getFloatTimeDomainData(a);
      let p = 0;
      for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]));
      return p;
    },

    _count(n) {
      nodeCount += n;
    },
    _remove(v) {
      const i = voices.indexOf(v);
      if (i >= 0) voices.splice(i, 1);
      const list = byName.get(v.name);
      if (list) {
        const j = list.indexOf(v);
        if (j >= 0) list.splice(j, 1);
      }
    },
    _unlist(v) {
      const list = byName.get(v.name);
      if (list) {
        const j = list.indexOf(v);
        if (j >= 0) list.splice(j, 1);
      }
    },
  };

  function applyFader(bus, tau) {
    const t = ctx.currentTime;
    const v = Math.max(0, bus.level * bus.pauseK);
    for (const f of bus.faders) f.gain.setTargetAtTime(v, t, tau);
  }

  return mix;
}

/**
 * A self-cleaning group of nodes playing one sound. Recipes create nodes through it (so they are
 * counted and torn down), connect the final stage to `v.out`, then call `v.finish(endTime)`.
 */
class Voice {
  constructor(mix, name, bus, o) {
    const ctx = mix.ctx;
    this.mix = mix;
    this.ctx = ctx;
    this.name = name;
    this.nodes = [];
    this.srcs = [];
    this.pending = 0;
    this.finished = false;
    this.dying = false;
    this.disposed = false;
    this.prio = o.prio !== undefined ? o.prio : 1;
    this.t = Math.max(o.t || 0, ctx.currentTime + LEAD);
    this.end = this.t;
    /** Pitch multiplier: recipes multiply every frequency by v.p */
    this.p = o.pitch || 1;
    this.rng = o.rng || Math.random;
    const out = this.gain(o.gain !== undefined ? o.gain : 1);
    let tail = out;
    if (o.pan) {
      const p = this.track(ctx.createStereoPanner());
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      out.connect(p);
      tail = p;
    }
    tail.connect(o.dest || bus.dry);
    if (o.rev > 0) {
      const s = this.gain(o.rev);
      tail.connect(s);
      s.connect(bus.rev);
    }
    if (o.dly > 0) {
      const s = this.gain(o.dly);
      tail.connect(s);
      s.connect(bus.dly);
    }
    this.out = out;
    this.tail = tail;
    this.bus = bus;
  }
  track(n) {
    this.nodes.push(n);
    this.mix._count(1);
    return n;
  }
  gain(v = 0) {
    const g = this.track(this.ctx.createGain());
    g.gain.value = v;
    return g;
  }
  filter(type, f, q = 0.707) {
    const b = this.track(this.ctx.createBiquadFilter());
    b.type = type;
    b.frequency.value = Math.max(10, Math.min(22000, f));
    b.Q.value = q;
    return b;
  }
  panner(p) {
    const n = this.track(this.ctx.createStereoPanner());
    n.pan.value = Math.max(-1, Math.min(1, p));
    return n;
  }
  shaper(curve) {
    const s = this.track(this.ctx.createWaveShaper());
    s.curve = curve;
    return s;
  }
  delay(time, max = 1) {
    const d = this.track(this.ctx.createDelay(max));
    d.delayTime.value = time;
    return d;
  }
  /** Oscillator started at t (stopped by finish()). */
  osc(type, f, t = this.t, stopAt) {
    const o = this.track(this.ctx.createOscillator());
    if (typeof type === 'string') o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.value = Math.max(0.01, Math.min(20000, f));
    o.start(t);
    this.srcs.push({ n: o, stop: stopAt });
    return o;
  }
  /** Buffer source started at t, random (or given) offset. */
  src(buffer, t = this.t, o = {}) {
    const s = this.track(this.ctx.createBufferSource());
    s.buffer = buffer;
    s.loop = o.loop !== false;
    if (o.rate) s.playbackRate.value = o.rate;
    const off = o.offset !== undefined ? o.offset : this.rng() * buffer.duration * 0.9;
    s.start(t, s.loop ? off : Math.min(off, buffer.duration));
    this.srcs.push({ n: s, stop: o.stop });
    return s;
  }
  /** Constant-source control signal started at t. */
  constant(v, t = this.t) {
    const c = this.track(this.ctx.createConstantSource());
    c.offset.value = v;
    c.start(t);
    this.srcs.push({ n: c, stop: undefined });
    return c;
  }
  /** Schedule every source to stop (at its own stop time or `end`) and self-dispose when all have ended. */
  finish(end) {
    if (this.finished) return this;
    this.finished = true;
    this.end = Math.max(this.end, end);
    this.pending = this.srcs.length;
    const done = () => {
      this.pending--;
      if (this.pending <= 0) this.dispose();
    };
    for (const s of this.srcs) {
      s.n.onended = done;
      try {
        s.n.stop(Math.max(this.t, Math.min(this.end, s.stop !== undefined ? s.stop : this.end)));
      } catch {
        done();
      }
    }
    if (!this.srcs.length) this.dispose();
    return this;
  }
  /** Fade out fast and stop (voice stealing / teardown). */
  kill(fade = 0.03) {
    if (this.disposed || this.dying) return;
    this.dying = true;
    this.mix._unlist(this);
    const t = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    if (!this.finished) this.finish(t + fade + 0.01);
    else {
      for (const s of this.srcs) {
        try {
          s.n.stop(Math.max(this.t, t + fade + 0.01));
        } catch { /* already stopped */ }
      }
      this.end = Math.min(this.end, t + fade + 0.01);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch { /* ignore */ }
    }
    this.mix._count(-this.nodes.length);
    this.nodes.length = 0;
    this.srcs.length = 0;
    this.mix._remove(this);
  }
}

/** Unity below 0.8, a smooth knee above, asymptote 0.97. Input domain ±2 (the pre-gain halves the signal). */
function softClipCurve() {
  const N = 8193, c = new Float32Array(N);
  const knee = 0.8, room = 0.17;
  for (let i = 0; i < N; i++) {
    const x = ((i / (N - 1)) * 2 - 1) * 2;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    c[i] = Math.sign(x) * y;
  }
  return c;
}
