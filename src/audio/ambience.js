// Fish Up — the continuous soundscape. Persistent layers (amb-above / amb-under / amb-fishing) are built
// on demand, ramped from the `inputs` snapshot at a ~25 Hz control rate, and torn down after a few silent
// seconds. Sparse ambient one-shots (gulls, creaks, slaps, bubbles, whale song …) are scheduled here and
// played through `fire` (audio.js → sfx registry).
import { waveHeight } from '../world/waves.js';
import { ABOVE, nearIsland } from './amb-above.js';
import { UNDER, depthK, ventK } from './amb-under.js';
import { FISHING } from './amb-fishing.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const CONTROL_DT = 0.04;

export function createAmbience(mix, rng, fire = () => {}) {
  const ctx = mix.ctx;
  const bus = mix.buses.ambience;
  const R = () => rng.next();
  let persistent = 0;
  const mk = (n) => {
    persistent++;
    return n;
  };
  const gainNode = (v) => {
    const g = mk(ctx.createGain());
    g.gain.value = v;
    return g;
  };

  // ── submixes: above-water (muffled + faded as the camera dives) and under-water ──
  const above = gainNode(1);
  const aboveLP = mk(ctx.createBiquadFilter());
  aboveLP.type = 'lowpass';
  aboveLP.frequency.value = 18000;
  aboveLP.Q.value = 0.5;
  const aboveOut = gainNode(1);
  above.connect(aboveLP);
  aboveLP.connect(aboveOut);
  aboveOut.connect(bus.dry);
  const aboveRev = gainNode(0.12);
  aboveOut.connect(aboveRev);
  aboveRev.connect(bus.rev);
  const under = gainNode(1);
  const underLP = mk(ctx.createBiquadFilter());
  underLP.type = 'lowpass';
  underLP.frequency.value = 1600;
  underLP.Q.value = 0.6;
  const underOut = gainNode(0);
  under.connect(underLP);
  underLP.connect(underOut);
  underOut.connect(bus.dry);
  const underRev = gainNode(0.35);
  underOut.connect(underRev);
  underRev.connect(bus.rev);
  const DEST = { above, under, sfx: mix.buses.sfx.dry };

  // ── smoothed param setter: skips negligible changes so automation stays sparse ──
  const last = new WeakMap();
  function set(param, value, tau = 0.12) {
    if (!Number.isFinite(value)) return;
    const prev = last.get(param);
    if (prev !== undefined && Math.abs(prev - value) <= Math.max(1e-4, Math.abs(prev) * 0.004)) return;
    last.set(param, value);
    param.setTargetAtTime(value, ctx.currentTime, tau);
  }

  // ── layers ──
  const S = { dt: 0, stateT: 0, fstate: 'idle', tensionRate: 0, prevTension: 0, engineIdle: 99,
    gullT: 4, creakT: 3, slapT: 0, buoyT: 12, bubT: 0, clickT: 9, whaleT: 30, groanT: 8, prevH: 0, prevVy: 0 };
  const layers = [];
  for (const [group, defs] of [['above', ABOVE], ['under', UNDER], ['fishing', FISHING]]) {
    for (const [name, def] of Object.entries(defs)) {
      layers.push({ name, group, def, on: false, out: null, nodes: [], srcs: [], p: null, target: 0, offT: 0 });
    }
  }
  function build(L) {
    const t = ctx.currentTime + 0.01;
    L.out = ctx.createGain();
    L.out.gain.value = 0;
    L.out.connect(DEST[L.def.dest]);
    L.nodes = [L.out];
    L.srcs = [];
    const keep = (n) => (L.nodes.push(n), n);
    const start = (n) => (L.srcs.push(n), n);
    const a = {
      ctx, B: mix.buffers, out: L.out,
      gain: (v = 0) => {
        const g = keep(ctx.createGain());
        g.gain.value = v;
        return g;
      },
      filter: (type, f, q = 0.7) => {
        const b = keep(ctx.createBiquadFilter());
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        return b;
      },
      panner: (p = 0) => {
        const n = keep(ctx.createStereoPanner());
        n.pan.value = p;
        return n;
      },
      shaper: (curve) => {
        const s = keep(ctx.createWaveShaper());
        s.curve = curve;
        return s;
      },
      src: (buf, rate = 1) => {
        const s = start(keep(ctx.createBufferSource()));
        s.buffer = buf;
        s.loop = true;
        s.playbackRate.value = rate;
        s.start(t, R() * buf.duration * 0.95);
        return s;
      },
      osc: (type, f) => {
        const o = start(keep(ctx.createOscillator()));
        if (typeof type === 'string') o.type = type;
        else o.setPeriodicWave(type);
        o.frequency.value = f;
        o.start(t);
        return o;
      },
      constant: (v) => {
        const c = start(keep(ctx.createConstantSource()));
        c.offset.value = v;
        c.start(t);
        return c;
      },
    };
    L.p = L.def.build(a, S) || {};
    L.on = true;
  }
  function stop(L) {
    const t = ctx.currentTime;
    const nodes = L.nodes;
    for (const s of L.srcs) {
      try {
        s.stop(t + 0.05);
      } catch { /* already stopped */ }
    }
    const done = () => nodes.forEach((n) => n.disconnect());
    if (L.srcs.length) L.srcs[0].onended = done;
    else done();
    L.on = false;
    L.out = null;
    L.nodes = [];
    L.srcs = [];
    L.p = null;
  }
  function drive(L, I) {
    const target = Math.max(0, L.def.level(I, S) || 0);
    L.target = target;
    if (target > 0.0008) {
      if (!L.on) build(L);
      L.offT = 0;
      set(L.out.gain, target, L.group === 'fishing' ? 0.05 : 0.45);
      L.def.control(L.p, I, set, S);
    } else if (L.on) {
      set(L.out.gain, 0, L.group === 'fishing' ? 0.05 : 0.45);
      L.offT += S.dt;
      if (L.offT > (L.group === 'fishing' ? 1.5 : 3.5)) stop(L);
    }
  }

  // ── sparse ambient events ──
  function events(I) {
    const dt = S.dt, ab = 1 - I.submerged, un = I.submerged;
    const boatNear = 1 - smoothstep(I.halfW * 0.8, I.halfW * 1.6, Math.abs(I.boatX - I.camX));
    const seaK = clamp01((I.sea - 0.4) / 1.7);
    if ((S.gullT -= dt) <= 0) {
      S.gullT = 5 + R() * 15;
      const p = I.daylight * nearIsland(I) * ab * (1 - smoothstep(0.15, 0.45, I.rain)) * (1 - smoothstep(0.6, 0.95, I.wind));
      if (p > 0.12 && R() < p) fire('gull', { pan: R() * 1.6 - 0.8, volume: 0.35 + 0.65 * p * R(), f: 700 + R() * 300 });
    }
    if ((S.creakT -= dt) <= 0) {
      S.creakT = (3 + R() * 7) / (0.5 + seaK);
      if (ab > 0.3 && boatNear > 0.3) fire('creak', { volume: (0.35 + 0.65 * seaK) * boatNear, pan: (R() - 0.5) * 0.4 });
    }
    // water slapping the hull: the boat rides the real wave function; a slap when it bottoms out
    const h = waveHeight(I.boatX, I.time, I.sea);
    const vy = (h - S.prevH) / Math.max(dt, 1e-3);
    S.slapT -= dt;
    if (S.prevVy > 4 && vy <= 0 && S.slapT <= 0 && ab > 0.3 && boatNear > 0.3) {
      S.slapT = 0.7 + R() * 0.6;
      fire('slap', { size: clamp01(S.prevVy / 30) + 0.2, volume: (0.4 + 0.6 * seaK) * boatNear, pan: (R() - 0.5) * 0.5 });
    }
    S.prevH = h;
    S.prevVy = vy;
    if ((S.buoyT -= dt) <= 0) {
      S.buoyT = 25 + R() * 30;
      if (ab > 0.5 && I.night > 0.4 && I.rain < 0.3) fire('buoy', { pan: R() < 0.5 ? -0.6 : 0.6, volume: 0.6 });
    }
    if (un < 0.05) return;
    const dk = depthK(I), vk = ventK(I);
    const bubRate = (0.4 + 2.2 * (1 - dk) + 6 * vk) * un;
    if ((S.bubT -= dt) <= 0) {
      S.bubT = -Math.log(1 - R() * 0.999) / Math.max(0.05, bubRate);
      fire('bubble', { f: (1500 - 900 * dk) * (0.6 + 0.8 * R()), volume: 0.35 + 0.65 * R(), pan: R() * 1.4 - 0.7 });
    }
    if ((S.clickT -= dt) <= 0) {
      S.clickT = 14 + R() * 26;
      if (un > 0.5 && I.viewDepth < 3600) fire('clicks', { pan: R() * 1.6 - 0.8, volume: 0.5 + 0.5 * R() });
    }
    if ((S.whaleT -= dt) <= 0) {
      S.whaleT = 70 + R() * 90;
      if (un > 0.6 && I.camX > 4500 && I.viewDepth > 500 && I.viewDepth < 5200) fire('whale', { pan: R() * 1.2 - 0.6, volume: 0.8 });
    }
    if ((S.groanT -= dt) <= 0) {
      S.groanT = 12 + R() * 18;
      if (un > 0.6 && I.viewDepth > 5000) fire('groan', { pan: R() * 1.2 - 0.6, volume: 0.7 });
    }
  }

  function control(I) {
    // fishing-state clock and tension velocity (shared with the fishing layers)
    if (I.fstate !== S.fstate) {
      S.fstate = I.fstate;
      S.stateT = 0;
    } else S.stateT += S.dt;
    S.tensionRate = S.tensionRate * 0.6 + 0.4 * ((I.tension - S.prevTension) / Math.max(S.dt, 1e-3));
    S.prevTension = I.tension;
    const sub = I.submerged;
    set(aboveLP.frequency, 18000 * Math.pow(0.025, sub), 0.15);
    set(aboveOut.gain, 1 - 0.85 * sub, 0.2);
    set(underOut.gain, smoothstep(0.05, 0.6, sub), 0.3);
    set(underLP.frequency, 1600 - 700 * depthK(I), 0.5);
    for (const L of layers) {
      if (L.group === 'above' && sub > 0.97 && !L.on) continue;
      if (L.group === 'under' && sub < 0.03 && !L.on) continue;
      drive(L, I);
    }
    if (!I.paused) events(I);
  }

  let acc = 0;
  return {
    above,
    under,
    get nodeCount() {
      let n = persistent;
      for (const L of layers) n += L.nodes.length;
      return n;
    },
    /** dt = real seconds; I = inputs snapshot */
    update(dt, I) {
      acc += dt;
      if (acc < CONTROL_DT) return;
      S.dt = Math.min(acc, 0.25);
      acc = 0;
      control(I);
    },
    debug() {
      const o = {};
      for (const L of layers) if (L.on) o[L.name] = +L.target.toFixed(3);
      return o;
    },
    stopAll() {
      for (const L of layers) if (L.on) stop(L);
    },
  };
}
