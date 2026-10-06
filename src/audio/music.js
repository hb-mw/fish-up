// Fish Up — generative, adaptive score. A 16th-note scheduler on the audio clock (lookahead) plays
// 8-bar sections whose mood (title/dawn/day/dusk/night/deep/abyss), progression, motif and arrangement
// are chosen at section boundaries; a fight layer takes over while a fish is on (scaled by fish level
// and line tension) and resolves into a triumphant hit (landed) or a deflating sag (lost).
import { INST } from './music-inst.js';
import { MOODS, FIGHT_PROGS, chordRels, voiceChord, makeMotif, phraseBar, COMP_RHYTHMS, PERC, FIGHT_PERC } from './music-gen.js';
import { MOTIF, MOTIF_ANSWER } from './theory.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const KEYS = [60, 65, 62, 67, 58, 63, 57];
const LOOKAHEAD = 0.3;

export function createMusic(mix, rng) {
  const ctx = mix.ctx;
  const rnd = () => rng.next();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const st = {
    started: false, next: 0, step: 0, bar: 0, bars: 8, bpm: 92, swing: 0.1, moodName: 'day', mood: MOODS.day, want: 'day',
    root: 60, keyIdx: 0, inKey: 0, scale: 'major', n: 3, bpc: 1, prog: [0, 4, 5, 3], rest: false, restBars: 0,
    arr: {}, motif: null, motifs: [], useTitle: false, voicing: null, compV: null, compRhythm: [6, 14], barNotes: [],
    fight: { on: false, lv: 0, tension: 0, style: 'playful', hit: false, uid: 0 }, endedUid: -1, forceNew: false, lag: 0, notes: 0, filt: 18000,
  };
  const spb = () => 60 / st.bpm;
  const d16 = () => spb() / 4;

  function newSection(first) {
    st.forceNew = false;
    st.bar = 0;
    if (st.fight.on) {
      const fp = st.fight.style === 'playful' ? FIGHT_PROGS.light : FIGHT_PROGS.dark;
      Object.assign(st, { scale: fp.scale, prog: pick(fp.progs), n: 3, bpc: 1, bars: 8, rest: false, bpm: Math.max(st.bpm, 92) });
      st.fight.hit = true;
      return;
    }
    const name = st.want, M = MOODS[name];
    st.moodName = name;
    st.mood = M;
    st.bpm = M.bpm;
    st.swing = M.swing;
    if (!first && name !== 'title' && ++st.inKey >= 3 + Math.floor(rnd() * 3)) {
      st.keyIdx = (st.keyIdx + (rnd() < 0.5 ? 1 : 3)) % KEYS.length;
      st.root = KEYS[st.keyIdx];
      st.inKey = 0;
    }
    Object.assign(st, { scale: M.scale, n: M.n, bpc: M.bpc, prog: name === 'title' ? [0, 3, 5, 0] : pick(M.progs), bars: 8 });
    st.rest = !first && rnd() < M.rest;
    st.useTitle = name === 'title' || (first && name !== 'abyss') || (name === 'day' && rnd() < 0.07);
    // the motif implies I–IV–vi–I in major, one chord per bar
    if (st.useTitle) Object.assign(st, { prog: [0, 3, 5, 0], scale: 'major', bpc: 1 });
    if (!st.useTitle) {
      if (st.motifs.length && rnd() < 0.35) st.motif = pick(st.motifs);
      else {
        st.motif = makeMotif(rnd, M.energy);
        st.motifs.push(st.motif);
        if (st.motifs.length > 4) st.motifs.shift();
      }
    }
    st.arr = {
      melody: st.useTitle || rnd() < M.melody,
      phrase2: st.useTitle || rnd() < 0.4 + M.energy * 0.6,
      comp: M.comp !== 'none' && rnd() < 0.85,
      bass: M.bass !== 'none' && rnd() < 0.9,
      perc: M.perc !== 'none' && (name === 'title' || rnd() < 0.8),
      pad: M.pad === 'drone' ? 'drone' : rnd() < M.pad,
      density: 0.55 + 0.45 * M.energy,
    };
    st.compRhythm = pick(COMP_RHYTHMS.slice(0, M.energy > 0.6 ? 4 : 2));
  }

  function chordNow() {
    const ci = Math.floor(st.bar / st.bpc) % st.prog.length;
    return chordRels(st.scale, st.prog[ci], st.n);
  }
  const bassNote = (rels) => {
    let n = st.root - 24 + rels[0];
    while (n < 34) n += 12;
    while (n > 46) n -= 12;
    return n;
  };

  function perc(t, s, P) {
    if (!P) return;
    for (const [k, vel] of P.kick || []) if (k === s) INST.kick(mix, t, vel);
    for (const [k, vel] of P.shaker || []) if (k === s) INST.shaker(mix, t, vel * (0.8 + 0.4 * rnd()), { pan: 0.3 });
    for (const [k, hi, vel] of P.bongo || []) if (k === s && rnd() < 0.85) INST.bongo(mix, t, hi, vel, { pan: hi ? 0.35 : -0.25 });
    for (const [k, vel] of P.brush || []) if (k === s) INST.brush(mix, t, vel, { pan: -0.2 });
    for (const [k, vel] of P.rim || []) if (k === s) INST.rim(mix, t, vel, { pan: 0.15 });
    for (const [k, vel] of P.hat || []) if (k === s) INST.hat(mix, t, vel, { pan: 0.25 });
    for (const [k, vel, f] of P.tom || []) if (k === s) INST.tom(mix, t, vel, { f, pan: f > 100 ? 0.25 : -0.15 });
  }

  function melody(t, s, rels) {
    if (s === 0) {
      const b = st.bar;
      if (st.useTitle) {
        const src = b % 4 < 2 ? MOTIF : MOTIF_ANSWER, off = (b % 2) * 16;
        st.barNotes = src.filter(([, on]) => on * 4 >= off && on * 4 < off + 16).map(([semi, on, len]) => ({ on: on * 4 - off, len: len * 4, n: st.root + semi, vel: 0.85 }));
      } else if (b < 4 || st.arr.phrase2) {
        st.barNotes = phraseBar(st.motif, b % 4, st.root, rels, st.scale === 'minor' || st.scale === 'dorian' || st.scale === 'phrygian', rnd, st.arr.density);
      } else st.barNotes = [];
    }
    const lead = st.mood.lead;
    for (const x of st.barNotes) {
      if (x.on !== s) continue;
      const hold = x.len * d16();
      const g = x.vel * (0.85 + 0.25 * rnd());
      if (lead === 'kalimba') INST.kalimba(mix, t, x.n, g, { pan: -0.12, decay: 0.7 + hold });
      else INST.bell(mix, t, x.n + (st.moodName === 'deep' ? 0 : 12), g * 0.9, { pan: 0.1, decay: 1.6 + hold });
      if (st.useTitle && st.bar >= 4) INST.marimba(mix, t, x.n + 12, g * 0.55, { pan: 0.3 });
    }
  }

  function normalStep(t, s, rels, chordStart) {
    const M = st.mood, sw = s % 2 === 1 ? st.swing * d16() : 0, tt = t + sw;
    if (st.rest) {
      if (chordStart && st.arr.pad === true && st.moodName !== 'abyss') INST.pad(mix, t, voiceChord(st.root, rels, st.voicing, st.root + 4), 0.45, { hold: spb() * 4 * st.bpc * 0.9, a: 1.6, r: 2 });
      return;
    }
    if (chordStart && st.arr.pad) {
      if (st.arr.pad === 'drone') INST.drone(mix, t, [st.root - 24, st.root - 17], 0.9, { hold: spb() * 4 * st.bpc, a: 2.5, r: 3 });
      else {
        st.voicing = voiceChord(st.root, rels, st.voicing, st.root + 4);
        INST.pad(mix, t, st.voicing, M.energy > 0.5 ? 0.55 : 0.9, { hold: spb() * 4 * st.bpc * 0.85, a: 0.9, r: 1.4 });
      }
    }
    if (st.arr.bass) {
      const bn = bassNote(rels);
      if (M.bass === 'pop') {
        if (s === 0) INST.bass(mix, tt, bn, 1, { hold: spb() * 0.9 });
        else if (s === 8) INST.bass(mix, tt, rnd() < 0.6 ? bn + 7 : bn + 12, 0.75, { hold: spb() * 0.7 });
        else if (s === 14 && rnd() < 0.3) INST.bass(mix, tt, bn + (rnd() < 0.5 ? 2 : -1), 0.5, { hold: spb() * 0.4 });
      } else if (M.bass === 'soft') {
        if (s === 0) INST.bass(mix, tt, bn, 0.85, { hold: spb() * 2 });
        else if (s === 10 && rnd() < 0.5) INST.bass(mix, tt, bn + 7, 0.6, { hold: spb() });
      } else if (M.bass === 'drone' && chordStart) INST.bass(mix, tt, bn, 0.55, { hold: spb() * 4 * st.bpc * 0.9 });
    }
    if (st.arr.comp) {
      if (M.comp === 'marimba' && st.compRhythm.includes(s)) {
        st.compV = voiceChord(st.root, rels.slice(0, 3), st.compV, st.root + 7);
        INST.marimbaChord(mix, tt, st.compV, s % 8 === 6 ? 0.95 : 0.7, { pan: -0.2 });
      } else if (M.comp === 'epiano' && (s === 0 || (s === 10 && rnd() < 0.6))) {
        st.compV = voiceChord(st.root, rels, st.compV, st.root + 4);
        INST.epianoChord(mix, tt, st.compV, s === 0 ? 0.9 : 0.6, { hold: spb() * (s === 0 ? 1.6 : 0.8) });
      } else if (M.comp === 'arp' && s % 2 === 0) {
        const ns = voiceChord(st.root, rels, null, st.root + 12), i = s / 2;
        INST.kalimba(mix, tt, ns[i % ns.length] + 12 * Math.floor(i / ns.length) - 12, 0.4, { pan: 0.3, decay: 0.8 });
      }
    }
    if (st.arr.perc) perc(tt, s, PERC[M.perc]);
    if (st.arr.melody) melody(tt, s, rels);
  }

  function fightStep(t, s, rels, chordStart) {
    const F = st.fight, T = F.tension, sty = F.style, R = st.root;
    if (s === 0 && F.hit) {
      F.hit = false;
      INST.crash(mix, t, sty === 'playful' ? 0.45 : 0.9);
      INST.kick(mix, t, 1);
      if (sty !== 'playful') INST.stab(mix, t, voiceChord(R, rels, null, R), 1, { hold: 0.25 });
    }
    perc(t, s, FIGHT_PERC[sty]);
    if (sty !== 'playful' && T > 0.65 && s % 2 === 1) INST.hat(mix, t, 0.35 + 0.6 * (T - 0.65), { pan: -0.2 });
    if (T > 1.0 && (s === 0 || s === 3 || s === 8 || s === 11)) INST.kick(mix, t, s % 8 === 0 ? 0.9 : 0.6);
    const bn = bassNote(rels);
    const arp = [rels[0], rels[0] + 12, rels[2], rels[0] + 12];
    if (sty === 'playful') {
      if (s % 2 === 0) INST.pizz(mix, t, bn + 12 + [0, 7, 12, 7][(s / 2) % 4], s % 8 === 0 ? 1 : 0.7, { bright: 0.8 + T });
      if (s === 0 || s === 8) INST.bass(mix, t, bn, 0.8, { hold: spb() * 0.8 });
    } else {
      if (s % 2 === 0) INST.bass(mix, t, bn + (s % 8 === 6 ? 7 : 0), s % 4 === 0 ? 1 : 0.7, { hold: d16() * 1.6 });
      if (sty === 'epic' || s % 2 === 0) INST.pizz(mix, t, R + arp[s % 4] - (sty === 'epic' ? 12 : 0), 0.45 + 0.4 * Math.min(1, T), { bright: 0.5 + 1.2 * Math.min(1.2, T), decay: 0.25 });
      if (sty === 'epic' && s === 0) INST.stab(mix, t, voiceChord(R, rels, null, R + 2), 0.75 + 0.3 * Math.min(1, T), { hold: d16() * 3 });
    }
    if (chordStart) {
      st.voicing = voiceChord(R, rels, st.voicing, R + 4);
      INST.pad(mix, t, st.voicing, 0.4, { hold: spb() * 3.6, a: 0.3, r: 0.8, type: 'sawtooth', lp: 900 + 1500 * Math.min(1, T) });
      if (T > 0.7) INST.tremolo(mix, t, voiceChord(R, rels, null, R + 12), 0.5 + 0.9 * Math.min(0.5, T - 0.7), { hold: spb() * 3.8, rate: T > 1 ? 16 : 11 });
    }
  }

  function doStep(t) {
    const s = st.step, rels = chordNow(), chordStart = s === 0 && st.bar % st.bpc === 0;
    st.notes++;
    if (st.restBars > 0) {
      if (s === 15) st.restBars--;
      return;
    }
    if (st.fight.on) fightStep(t, s, rels, chordStart);
    else normalStep(t, s, rels, chordStart);
  }
  function advance() {
    st.next += d16();
    st.step = (st.step + 1) % 16;
    if (st.step === 0 && (++st.bar >= st.bars || st.forceNew)) newSection(false);
  }
  const nextBeat = () => st.next + ((4 - (st.step % 4)) % 4) * d16();

  function fightStart(level, size, tension, uid = 0) {
    if (st.fight.on || (uid && uid === st.endedUid)) return;
    const lv = clamp01(((level || 3) - 1) / 9 + ((size !== undefined ? size : 0.5) - 0.5) * 0.15);
    st.fight = { on: true, lv, tension: tension || 0, style: lv < 0.28 ? 'playful' : lv < 0.6 ? 'driving' : 'epic', hit: true, uid };
    st.forceNew = true;
    st.restBars = 0;
  }
  /** A different (bigger) animal took over the hook: re-style the fight from the next bar. */
  function fightLevel(level, size) {
    if (!st.fight.on) return;
    const lv = clamp01(((level || 3) - 1) / 9 + ((size !== undefined ? size : 0.5) - 0.5) * 0.15);
    const style = lv < 0.28 ? 'playful' : lv < 0.6 ? 'driving' : 'epic';
    st.fight.lv = lv;
    if (style !== st.fight.style) {
      st.fight.style = style;
      st.forceNew = true;
    }
  }
  function fightEnd(result) {
    if (!st.fight.on) return;
    st.fight.on = false;
    st.endedUid = st.fight.uid;
    st.forceNew = true;
    const t = Math.max(nextBeat(), ctx.currentTime + 0.02), R = st.root;
    if (result === 'landed') {
      INST.stab(mix, t, [R, R + 4, R + 7, R + 12], 1, { hold: 0.45 });
      INST.crash(mix, t, 0.7);
      INST.kick(mix, t, 1);
      st.restBars = 3;
    } else {
      INST.deflate(mix, t, [R - 12, R - 5, R], 1);
      st.restBars = 2;
    }
  }

  function update(dt, I) {
    const deep = I.submerged * smoothstep(250, 2600, I.viewDepth);
    const abyss = I.submerged * smoothstep(4800, 6000, I.viewDepth);
    let cut = 18000 * Math.pow(0.05, deep);
    if (abyss > 0) cut = Math.min(cut, 900 - 380 * abyss);
    if (I.paused) cut = Math.min(cut, 650);
    if (Math.abs(cut - st.filt) > st.filt * 0.02) {
      st.filt = cut;
      mix.setBusFilter('music', cut, 0.4);
    }
    const want = I.mode === 'title' ? 'title' : abyss > 0.5 ? 'abyss' : deep > 0.55 ? 'deep' : ['night', 'dusk', 'dawn'].includes(I.phase) ? I.phase : 'day';
    if (want !== st.want) {
      const big = want === 'title' || st.want === 'title' || ((want === 'deep' || want === 'abyss') !== (st.want === 'deep' || st.want === 'abyss'));
      st.want = want;
      if (big) st.forceNew = true;
    }
    if (I.hooked && !st.fight.on && !I.paused) fightStart(I.fishLevel, I.fishSize, I.tension, I.fishUid);
    else if (!I.hooked && st.fight.on) fightEnd(I.fstate === 'caught' || I.fstate === 'landing' ? 'landed' : 'lost');
    st.fight.tension += (I.tension - st.fight.tension) * Math.min(1, dt * 4);
    const now = ctx.currentTime;
    if (!st.started) {
      st.started = true;
      st.next = now + 0.12;
      newSection(true);
    }
    if (st.next < now - 0.03) {
      st.lag = Math.max(st.lag, now - st.next);
      st.next = now + 0.05;
    }
    if (I.musicOff) {
      st.next = Math.max(st.next, now + 0.05);
      return;
    }
    let guard = 0;
    while (st.next < now + LOOKAHEAD && guard++ < 64) {
      doStep(st.next);
      advance();
    }
  }

  return {
    update,
    key: () => st.root,
    fightStart,
    fightLevel,
    fightEnd,
    debug: () => ({ mood: st.moodName, want: st.want, bpm: st.bpm, root: st.root, scale: st.scale, bar: st.bar, rest: st.rest || st.restBars > 0, fight: st.fight.on ? st.fight.style : 'off', tension: +st.fight.tension.toFixed(2), lag: +st.lag.toFixed(3), steps: st.notes }),
    get nodeCount() {
      return 0;
    },
  };
}
