// Fish Up — pre-rendered audio material: noise beds, the shared reverb impulse response, mechanical
// click loops (reel ratchet / drag) and water textures (laps, rain, droplets, shrimp crackle).
// Everything is synthesised in plain JS once per sample rate and cached. AudioBuffers are not tied
// to the context that created them, so live and offline (lab) contexts share the same data.
import { createRng } from '../core/rng.js';

const TAU = Math.PI * 2;
const caches = new Map();

/**
 * Lazily-built buffer bank for ctx.sampleRate. Each property is generated on first access.
 * @param {BaseAudioContext} ctx
 */
export function getBuffers(ctx) {
  const sr = ctx.sampleRate;
  let bank = caches.get(sr);
  if (bank) return bank;
  const made = {};
  const mk = (ch, len) => ctx.createBuffer(ch, Math.max(1, len | 0), sr);
  const gens = {
    white: () => noiseBuffer(mk, sr, 3.1, 'white', 11),
    pink: () => noiseBuffer(mk, sr, 4.3, 'pink', 23),
    brown: () => noiseBuffer(mk, sr, 5.7, 'brown', 37),
    ir: () => impulse(mk, sr, 3.4, 2.7, 51),
    ratchet: () => clickLoop(mk, sr, { rate: 22, n: 12, seed: 61, bright: 0.85, soft: 0.6 }),
    drag: () => clickLoop(mk, sr, { rate: 42, n: 21, seed: 67, bright: 1.15, soft: 0.25 }),
    dragFast: () => clickLoop(mk, sr, { rate: 130, n: 52, seed: 71, bright: 1.25, soft: 0.2 }),
    laps: () => lapTexture(mk, sr, 9.3, 79),
    rainLight: () => rainTexture(mk, sr, 4.7, 83, { drops: 70, hiss: 0.05, plinks: 0.4 }),
    rainHeavy: () => rainTexture(mk, sr, 4.1, 89, { drops: 520, hiss: 0.5, plinks: 0.15 }),
    rainDeck: () => deckRain(mk, sr, 3.7, 97),
    droplets: () => dropletTexture(mk, sr, 2.9, 101),
    crackle: () => crackleTexture(mk, sr, 3.3, 103),
    whizz: () => whizzLoop(mk, sr, 113),
    click: () => singleClick(mk, sr, 127),
  };
  bank = { sampleRate: sr };
  for (const [k, gen] of Object.entries(gens)) {
    Object.defineProperty(bank, k, {
      get() {
        if (!made[k]) made[k] = gen();
        return made[k];
      },
      enumerable: true,
    });
  }
  caches.set(sr, bank);
  return bank;
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────────
function finishChannel(data, src, len, fade, rmsTarget) {
  // equal-power crossfade of the over-rendered tail into the head → seamless loop
  for (let i = 0; i < len; i++) data[i] = src[i];
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    data[i] = src[i] * Math.sqrt(k) + src[len + i] * Math.sqrt(1 - k);
  }
  let mean = 0;
  for (let i = 0; i < len; i++) mean += data[i];
  mean /= len;
  let e = 0;
  for (let i = 0; i < len; i++) {
    data[i] -= mean;
    e += data[i] * data[i];
  }
  const rms = Math.sqrt(e / len) || 1;
  if (rmsTarget) {
    const k = rmsTarget / rms;
    for (let i = 0; i < len; i++) data[i] *= k;
  }
}

function noiseBuffer(mk, sr, seconds, kind, seed) {
  const len = Math.floor(sr * seconds), fade = Math.floor(sr * 0.08);
  const buf = mk(2, len);
  for (let c = 0; c < 2; c++) {
    const rng = createRng(seed * 977 + c * 7919);
    const tmp = new Float32Array(len + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, y = 0;
    for (let i = 0; i < tmp.length; i++) {
      const w = rng.next() * 2 - 1;
      if (kind === 'white') tmp[i] = w;
      else if (kind === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        tmp[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else {
        y = (y + 0.02 * w) / 1.02; // leaky integrator → brown
        tmp[i] = y;
      }
    }
    finishChannel(buf.getChannelData(c), tmp, len, fade, 0.3);
  }
  return buf;
}

/** Stereo reverb IR: pre-delay, sparse early reflections, a dense tail that darkens as it decays. */
function impulse(mk, sr, seconds, rt60, seed) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const pre = Math.floor(sr * 0.014);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const rng = createRng(seed + c * 131);
    let lp = 0, lp2 = 0;
    for (let i = 0; i + pre < len; i++) {
      const t = i / sr;
      const env = Math.exp((-6.91 * t) / rt60);
      const fc = 9500 * Math.pow(0.16, Math.min(1, t / rt60)); // 9.5 kHz → 1.5 kHz over the decay
      const a = 1 - Math.exp((-TAU * fc) / sr);
      lp += a * (rng.next() * 2 - 1 - lp);
      lp2 += a * (lp - lp2);
      const fadeIn = Math.min(1, t / 0.006);
      const swell = 0.55 + 0.45 * Math.min(1, t / 0.09); // the dense tail builds up after the early reflections
      d[i + pre] = lp2 * env * fadeIn * swell * 2.2;
    }
    for (let k = 0; k < 11; k++) {
      const at = pre + Math.floor(sr * (0.004 + rng.next() * 0.075));
      if (at < len) d[at] += (rng.next() * 2 - 1) * 0.5 * Math.exp(-(at / sr) * 14);
    }
  }
  return buf;
}

/** Add one damped-modal click into `d` at sample `at` (wrapping, so loops stay seamless). */
function addClick(d, sr, at, rng, modes, noiseAmp, noiseTau, amp, len) {
  const n = Math.floor(sr * len), L = d.length;
  const ph = [], fj = [];
  for (let m = 0; m < modes.length; m++) {
    ph.push(rng.next() * TAU);
    fj.push(modes[m][0] * (1 + (rng.next() - 0.5) * 0.06));
  }
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const atk = Math.min(1, i / 6);
    let s = (rng.next() * 2 - 1) * noiseAmp * Math.exp(-t / noiseTau);
    for (let m = 0; m < modes.length; m++) s += modes[m][1] * Math.sin(TAU * fj[m] * t + ph[m]) * Math.exp(-t / modes[m][2]);
    d[(at + i) % L] += s * amp * atk;
  }
}

/** A loop of n evenly spaced ratchet clicks (`rate` clicks/s at playbackRate 1). */
function clickLoop(mk, sr, o) {
  const len = Math.round((sr * o.n) / o.rate);
  const buf = mk(1, len);
  const d = buf.getChannelData(0);
  const rng = createRng(o.seed);
  const b = o.bright;
  const modes = [
    [2700 * b, 0.55, 0.0028],
    [4400 * b, 0.42, 0.0018],
    [6900 * b, 0.3, 0.0011],
    [1150 * b, 0.35 * o.soft + 0.1, 0.0045],
  ];
  for (let k = 0; k < o.n; k++) {
    const at = Math.round((k * len) / o.n + (rng.next() - 0.5) * sr * 0.0012);
    const amp = 0.75 + 0.25 * rng.next() * (k % 3 === 0 ? 1 : 0.6);
    addClick(d, sr, (at + len) % len, rng, modes, 0.7, 0.0007, amp, 0.012);
  }
  normalizePeak(d, 0.9);
  return buf;
}

function singleClick(mk, sr, seed) {
  const len = Math.floor(sr * 0.03);
  const buf = mk(1, len);
  const d = buf.getChannelData(0);
  const rng = createRng(seed);
  addClick(d, sr, 0, rng, [[3100, 0.5, 0.002], [5200, 0.4, 0.0012], [1700, 0.3, 0.003]], 0.8, 0.0005, 1, 0.02);
  normalizePeak(d, 0.9);
  return buf;
}

function normalizePeak(d, target) {
  let p = 0, mean = 0;
  for (let i = 0; i < d.length; i++) mean += d[i];
  mean /= d.length;
  for (let i = 0; i < d.length; i++) {
    d[i] -= mean;
    p = Math.max(p, Math.abs(d[i]));
  }
  if (p > 0) for (let i = 0; i < d.length; i++) d[i] *= target / p;
}

/** Biquad band-pass coefficients (RBJ cookbook, constant 0 dB peak gain). */
function bpCoefs(fc, q, sr) {
  const w = (TAU * fc) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
  return [al / a0, 0, -al / a0, (-2 * Math.cos(w)) / a0, (1 - al) / a0];
}

/** Gentle laps of water against a hull/shore: filtered noise swells + the odd glug. */
function lapTexture(mk, sr, seconds, seed) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const rng = createRng(seed);
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  let t = 0;
  while (t < seconds) {
    const dur = 0.12 + rng.next() * 0.3, atk = 0.02 + rng.next() * 0.05;
    const fc = 380 + rng.next() * 1100, q = 0.9 + rng.next() * 1.6, amp = 0.35 + rng.next() * 0.65;
    const pan = rng.next();
    const [b0, , b2, a1, a2] = bpCoefs(fc, q, sr);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const at = Math.floor(t * sr), n = Math.floor((dur + 0.2) * sr);
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      const env = tt < atk ? Math.sin((tt / atk) * Math.PI * 0.5) ** 2 : Math.exp(-(tt - atk) / (dur * 0.45));
      const x = (rng.next() * 2 - 1) * env;
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const idx = (at + i) % len;
      chans[0][idx] += y * amp * (1 - pan * 0.7);
      chans[1][idx] += y * amp * (0.3 + pan * 0.7);
    }
    if (rng.next() < 0.22) {
      // a hollow glug as water sloshes into a gap
      const f0 = 140 + rng.next() * 160, gl = Math.floor(sr * 0.09);
      let ph = 0;
      for (let i = 0; i < gl; i++) {
        const tt = i / sr;
        ph += (TAU * f0 * (1 + tt * 5)) / sr;
        const s = Math.sin(ph) * Math.exp(-tt / 0.025) * Math.min(1, i / 40) * 0.5 * amp;
        const idx = (at + Math.floor(atk * sr) + i) % len;
        chans[0][idx] += s;
        chans[1][idx] += s;
      }
    }
    t += 0.18 + rng.next() * 0.55;
  }
  for (const d of chans) normalizePeak(d, 0.85);
  return buf;
}

/** Rain on water: tiny ticks, the odd bubbly plink, plus a hiss bed for heavy rain. */
function rainTexture(mk, sr, seconds, seed, o) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const rng = createRng(seed);
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  const nDrops = Math.floor(o.drops * seconds);
  for (let k = 0; k < nDrops; k++) {
    const at = Math.floor(rng.next() * len), c = rng.next() < 0.5 ? 0 : 1, d = chans[c], o2 = chans[1 - c];
    const amp = Math.pow(rng.next(), 2.2) * 0.9 + 0.05;
    const n = Math.floor(sr * 0.0018);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const w = (rng.next() * 2 - 1) * Math.exp(-i / (sr * 0.00035));
      const hp = w - lp;
      lp += 0.3 * (w - lp);
      d[(at + i) % len] += hp * amp;
      o2[(at + i) % len] += hp * amp * 0.35;
    }
    if (rng.next() < o.plinks) {
      // Minnaert bubble ring: rising chirp, quick decay
      const f0 = 1300 + rng.next() * 2600, m = Math.floor(sr * 0.03);
      let ph = 0;
      for (let i = 0; i < m; i++) {
        const tt = i / sr;
        ph += (TAU * f0 * (1 + tt * 14)) / sr;
        const s = Math.sin(ph) * Math.exp(-tt / 0.0065) * Math.min(1, i / 8) * amp * 0.5;
        d[(at + 40 + i) % len] += s;
        o2[(at + 40 + i) % len] += s * 0.4;
      }
    }
  }
  if (o.hiss > 0) {
    for (let c = 0; c < 2; c++) {
      const r2 = createRng(seed * 13 + c);
      const d = chans[c];
      let l1 = 0, l2 = 0;
      for (let i = 0; i < len; i++) {
        const w = r2.next() * 2 - 1;
        l1 += 0.55 * (w - l1);
        l2 += 0.06 * (w - l2);
        d[i] += (l1 - l2) * o.hiss * 0.35;
      }
    }
  }
  for (const d of chans) {
    smoothSeam(d, Math.floor(sr * 0.01));
    normalizePeak(d, 0.85);
  }
  return buf;
}

/** Fat drops on a wooden deck / canvas: soft knocks. */
function deckRain(mk, sr, seconds, seed) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const rng = createRng(seed);
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = Math.floor(48 * seconds);
  for (let k = 0; k < n; k++) {
    const at = Math.floor(rng.next() * len), pan = rng.next();
    const f = 380 + rng.next() * 700, amp = 0.3 + Math.pow(rng.next(), 2) * 0.7;
    const m = Math.floor(sr * 0.03);
    const ph = rng.next() * TAU;
    for (let i = 0; i < m; i++) {
      const tt = i / sr;
      const s = (Math.sin(TAU * f * tt + ph) * Math.exp(-tt / 0.006) + (rng.next() * 2 - 1) * 0.35 * Math.exp(-tt / 0.0015)) * amp * Math.min(1, i / 10);
      chans[0][(at + i) % len] += s * (1 - pan * 0.6);
      chans[1][(at + i) % len] += s * (0.4 + pan * 0.6);
    }
  }
  for (const d of chans) normalizePeak(d, 0.85);
  return buf;
}

/** Spray falling back onto the water: dense little plinks and ticks (mono). */
function dropletTexture(mk, sr, seconds, seed) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const rng = createRng(seed);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const n = Math.floor(95 * seconds);
    for (let k = 0; k < n; k++) {
      const at = Math.floor(rng.next() * len);
      const f0 = 700 + Math.pow(rng.next(), 1.5) * 3200, amp = 0.2 + rng.next() * 0.8;
      const m = Math.floor(sr * 0.025);
      let ph = 0;
      for (let i = 0; i < m; i++) {
        const tt = i / sr;
        ph += (TAU * f0 * (1 + tt * 10)) / sr;
        d[(at + i) % len] += Math.sin(ph) * Math.exp(-tt / 0.005) * Math.min(1, i / 6) * amp;
      }
      for (let i = 0; i < 30; i++) d[(at + i) % len] += (rng.next() * 2 - 1) * amp * 0.4 * Math.exp(-i / 6);
    }
    normalizePeak(d, 0.85);
  }
  return buf;
}

/** Snapping-shrimp crackle of a living reef: a dense field of tiny impulsive pops. */
function crackleTexture(mk, sr, seconds, seed) {
  const len = Math.floor(sr * seconds);
  const buf = mk(2, len);
  const rng = createRng(seed);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const n = Math.floor(260 * seconds);
    for (let k = 0; k < n; k++) {
      const at = Math.floor(rng.next() * len);
      const amp = Math.pow(rng.next(), 3) * 0.9 + 0.04;
      const m = 14 + Math.floor(rng.next() * 30);
      let prev = 0;
      for (let i = 0; i < m; i++) {
        const w = (rng.next() * 2 - 1) * Math.exp(-i / 5);
        d[(at + i) % len] += (w - prev * 0.6) * amp;
        prev = w;
      }
    }
    normalizePeak(d, 0.85);
  }
  return buf;
}

/** Line peeling off a spool: band-limited noise with a fast rotational flutter (1 s loop). */
function whizzLoop(mk, sr, seed) {
  const len = sr; // 1 s
  const buf = mk(1, len);
  const d = buf.getChannelData(0);
  const rng = createRng(seed);
  let l1 = 0, l2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = rng.next() * 2 - 1;
    l1 += 0.5 * (w - l1);
    l2 += 0.08 * (w - l2);
    const flutter = 0.55 + 0.45 * Math.sin(TAU * 64 * t) * Math.sin(TAU * 64 * t);
    d[i] = (l1 - l2) * flutter;
  }
  smoothSeam(d, 400);
  normalizePeak(d, 0.85);
  return buf;
}

function smoothSeam(d, n) {
  // bend the last n samples so the loop end meets its start (removes the step a filter state leaves)
  const L = d.length;
  const step = d[L - 1] - d[0];
  for (let i = 0; i < n; i++) d[L - n + i] -= (step * (i + 1)) / n;
}
