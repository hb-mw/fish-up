// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — LIFE: every animal in the sea gets its brain here.
//
//   createFishSystem(game) → game.fish = { list, update, release, remove, spawnDebug, scan, … }
//
// The system keeps a living population around the camera (and the lure), moves every free animal with
// momentum inside its habitat (ai/motion.js, ai/schools.js), runs the lure drama — notice, approach,
// hesitate, nibble, bite (ai/lure.js) — and the hunters (ai/hunt.js). Animals handed to gameplay via
// game.fishing.fishBite() / predatorStrike() are left completely alone while fish.controlled is true.
// ─────────────────────────────────────────────────────────────────────────────
import { SPECIES_BY_ID } from '../data/species.js';
import { createFish } from './fishbase.js';
import { buildProfiles } from './ai/profiles.js';
import { buildPools, zoneFor } from './ai/habitat.js';
import { makeAI, stepFish, setMode, startle, baseMode } from './ai/motion.js';
import { updateGroups, schoolMember, leaveGroup } from './ai/schools.js';
import { createPopulation } from './ai/population.js';
import { createLureBrain } from './ai/lure.js';
import { createHunt } from './ai/hunt.js';
import { heightAt } from '../world/terrain.js';
import { waveHeight } from '../world/waves.js';
import { clamp } from '../core/math.js';

const MAX_STEP = 1 / 30;
const CAP = 80;
const TEMPER_SCARE = { skittish: 1, curious: 0.7, passive: 0.5, bold: 0.35, aggressive: 0.18 };

/**
 * Create the fish system (stored by the kernel at game.fish).
 * @param {object} game
 */
export function createFishSystem(game) {
  const rng = game.rng.fork();
  const profiles = buildProfiles();
  const list = [];
  const S = {
    game,
    rng,
    profiles,
    pools: buildPools(profiles),
    list,
    groups: [],
    threats: [],
    tag: { owner: 'life' },
    cap: CAP,
    iter: [],
    seenGroups: new Set(),
    pick: { prof: null, y: 0 },
    W: { t: 0, dt: 0, phase: 'day', nightF: 0, light0: 1, rain: 0, storm: false, wind: 0, sea: 1, boatX: 0, boatY: 0, throttle: 0 },
    L: { inWater: false, active: false, x: 0, y: 0, px: NaN, py: NaN, vx: 0, vy: 0, speed: 0, slow: 0, twitchT: 99, id: 'worm', def: null, light: 1 },
    stats: { spawned: 0, removed: 0, inViewSpawns: 0, nibbles: 0, bites: 0, refused: 0, looks: 0, recruits: 0, seekers: 0, snags: 0, strikes: 0, rushes: 0, eaten: 0 },
    selfEmit: false,
    emit,
    removeFish,
    schoolMember,
    lureStep: null,
    huntStep: null,
  };
  const pop = (S.pop = createPopulation(S));
  const lure = (S.lure = createLureBrain(S));
  const hunt = (S.hunt = createHunt(S));
  S.lureStep = lure.step;
  S.huntStep = hunt.step;
  const perf = { ms: 0, max: 0, steps: 0 };

  function emit(type, payload) {
    S.selfEmit = true;
    try {
      game.events.emit(type, payload);
    } finally {
      S.selfEmit = false;
    }
  }

  function removeFish(f, reason) {
    const i = list.indexOf(f);
    if (i >= 0) list.splice(i, 1);
    const a = f.ai;
    if (a && a.tag === S.tag) {
      a.dead = true;
      leaveGroup(f);
      if (a.cell !== undefined) {
        pop.cells.set(a.cell, null);
        if (reason === 'landed') pop.collected.set(a.cell, S.W.t);
      }
    }
    lure.forget(f);
    hunt.forget(f);
    S.stats.removed++;
  }

  // ── per-step world snapshot ─────────────────────────────────────────────────────────────────────
  function snapshot(dt) {
    const W = S.W, env = game.env, w = env.weather;
    W.t = game.time.now;
    W.dt = dt;
    W.phase = env.phase;
    W.nightF = env.night;
    W.light0 = env.surfaceLight;
    W.rain = w.rain;
    W.storm = w.type === 'storm' || w.rain > 0.85;
    W.wind = w.wind;
    W.sea = w.sea;
    const b = game.boat;
    W.boatX = b.x;
    W.boatY = b.y;
    W.throttle = b.throttle || 0;
    const fl = game.fishing, lu = fl && fl.lure, L = S.L;
    L.inWater = !!(lu && lu.inWater && lu.y > 0);
    if (L.inWater) {
      if (!Number.isNaN(L.px)) {
        const k = 1 / Math.max(dt, 1e-3);
        const vx = (lu.x - L.px) * k, vy = (lu.y - L.py) * k;
        L.vx = L.vx * 0.8 + Math.max(-900, Math.min(900, vx)) * 0.2;
        L.vy = L.vy * 0.8 + Math.max(-900, Math.min(900, vy)) * 0.2;
        L.speed = Math.hypot(L.vx, L.vy);
      }
      L.px = L.x = lu.x;
      L.py = L.y = lu.y;
      L.speed = Math.max(L.speed, lu.speed || 0);
      // sustained speed (~0.7 s average): a jig twitch is a brief dart, a fast reel-in is not
      L.slow += (L.speed - L.slow) * Math.min(1, dt * 1.4);
      L.twitchT = lu.twitchT === undefined ? 99 : lu.twitchT;
      L.id = lu.id;
      L.def = pop.lureDef(lu.id);
      L.light = env.lightAt(lu.y);
    } else {
      L.px = L.py = NaN;
      L.speed = L.vx = L.vy = L.slow = 0;
    }
    let attract = false;
    if (L.inWater && fl && typeof fl.canAttract === 'function') {
      try {
        attract = !!fl.canAttract();
      } catch (e) {
        game.reportError('fish:canAttract', e);
      }
    }
    // one biter at a time, whatever the fishing module says
    L.active = attract && !fl.hooked && fl.state !== 'bite' && fl.state !== 'fight' && fl.state !== 'landing';
  }

  function buildThreats() {
    const T = S.threats;
    T.length = 0;
    for (const f of list) {
      if (f.controlled || f.visualLen < 110 || f.species.group === 'item') continue;
      const p = profiles[f.speciesId];
      if (p && (p.isHunter || p.sp.predator > 0 || p.level >= 7)) T.push(f);
    }
  }

  function step(dt) {
    snapshot(dt);
    buildThreats();
    lure.pre(dt);
    hunt.pre(dt);
    updateGroups(S, dt);
    const it = S.iter;
    it.length = 0;
    for (let i = 0; i < list.length; i++) it.push(list[i]);
    for (let i = 0; i < it.length; i++) {
      const f = it[i], a = f.ai;
      if (!a || a.tag !== S.tag || a.dead) continue;
      if (f.controlled) {
        a.ctrl = true;
        continue;
      }
      if (a.ctrl) {
        // gameplay let go without calling release(): treat it as an escape
        a.ctrl = false;
        handBack(f, 'escaped');
      }
      if (f.speciesId === 'megalodon' && S.W.phase !== 'night' && !a.leaving) {
        a.leaving = true;
        a.hx = f.x < (pop.view.l + pop.view.r) / 2 ? -1 : 1;
      }
      if (S.L.active && a.mode !== 'lure') lure.consider(f, a, dt);
      stepFish(S, f, dt);
    }
  }

  function update(dt) {
    if (!(dt > 0)) return;
    const t0 = performance.now();
    const n = Math.min(10, Math.ceil(dt / MAX_STEP - 1e-6));
    const h = dt / n;
    for (let i = 0; i < n; i++) step(h);
    pop.update(dt);
    const ms = performance.now() - t0;
    perf.ms = perf.steps ? perf.ms * 0.95 + ms * 0.05 : ms;
    perf.max = Math.max(perf.max * 0.995, ms);
    perf.steps++;
  }

  // ── gameplay → life ──────────────────────────────────────────────────────────────────────────────
  function handBack(f, reason) {
    let a = f.ai;
    const prof = profiles[f.speciesId];
    if (!prof) return;
    if (!a || a.tag !== S.tag) a = f.ai = makeAI(S, f, prof);
    a.ctrl = false;
    a.dead = false;
    if (!list.includes(f)) list.push(f);
    if (a.group) leaveGroup(f);
    lure.forget(f);
    hunt.forget(f);
    f.alpha = 1;
    a.fadeIn = 0;
    if (prof.arch === 'item') {
      // the snag came free: it settles back onto the seabed
      a.zOK = true;
      a.modeT = 0;
      return;
    }
    a.wary = 70 + rng.next() * 70;
    a.lureCool = a.wary;
    a.leaving = prof.arch !== 'jelly';
    const tip = game.boat.rod && game.boat.rod.tip;
    const ox = tip ? tip.x : game.boat.x, oy = Math.max(0, tip ? tip.y : 0);
    a.hx = f.x >= ox ? 1 : -1;
    if (f.y < waveHeight(f.x, game.time.now, game.env.weather.sea) - 2 && prof.arch === 'swim') {
      // thrown free in mid-air: fall back in first
      a.retMode = 'leave';
      setMode(a, 'air');
      f.state = 'jump';
      return;
    }
    f.y = Math.min(f.y, heightAt(f.x) - prof.down * f.visualLen);
    startle(S, f, ox, oy - 40, reason === 'escaped' ? 0.8 : 1.3);
    if (a.mode !== 'flee') setMode(a, baseMode(a));
  }

  /**
   * Gameplay hands a fish back ('missed' | 'escaped' | 'snapped'): it bolts, stays wary, and later despawns.
   * @param {object} fish
   * @param {string} reason
   */
  function release(fish, reason) {
    if (!fish) return;
    fish.controlled = false;
    handBack(fish, reason || 'escaped');
    if (fish.species.group !== 'item' && fish.state !== 'jump') fish.state = 'flee';
  }

  /** Landed / eaten → delete it. */
  function remove(fish) {
    if (!fish) return;
    removeFish(fish, 'landed');
  }

  /**
   * Drop a fully-behaving animal at (x, y). opts: { sizeQ, shiny, dir, pinned (default true: never despawns) }.
   * @returns {object|null} the fish
   */
  function spawnDebug(speciesId, x, y, opts = {}) {
    const sp = SPECIES_BY_ID[speciesId], prof = profiles[speciesId];
    if (!sp || !prof) return null;
    const f = createFish(sp, { x, y, sizeQ: opts.sizeQ, rng, shiny: !!opts.shiny, dir: opts.dir });
    const a = (f.ai = makeAI(S, f, prof));
    a.pinned = opts.pinned !== false;
    a.homeX = x;
    if (prof.jet > 0) f.swimPhase = a.pulse;
    const z = a.z;
    if (zoneFor(prof, f.visualLen, heightAt(x), S.W.nightF, z) && z.bot - z.top > 1) a.zf = clamp((y - z.top) / (z.bot - z.top), 0, 1);
    list.push(f);
    S.stats.spawned++;
    return f;
  }

  const scanOut = [];
  const scanPool = [];
  /**
   * Animals within `radius` px of world-x (any depth) — for the sonar. The returned array and its objects are
   * reused between calls: copy what you need to keep.
   * @returns {Array<{x:number,y:number,level:number,speciesId:string,visualLen:number,uid:number,shiny:boolean}>}
   */
  function scan(x, radius) {
    scanOut.length = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.species.group === 'item' || f.state === 'landed' || f.alpha < 0.3) continue;
      if (Math.abs(f.x - x) > radius) continue;
      let o = scanPool[scanOut.length];
      if (!o) o = scanPool[scanOut.length] = { x: 0, y: 0, level: 0, speciesId: '', visualLen: 0, uid: 0, shiny: false };
      o.x = f.x;
      o.y = f.y;
      o.level = f.species.level;
      o.speciesId = f.speciesId;
      o.visualLen = f.visualLen;
      o.uid = f.uid;
      o.shiny = f.shiny;
      scanOut.push(o);
    }
    return scanOut;
  }

  // ── startles ─────────────────────────────────────────────────────────────────────────────────────
  function scare(x, y, R, strength, onlySkittish) {
    for (const f of list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.dead) continue;
      const dx = f.x - x, dy = f.y - y;
      if (dx * dx + dy * dy > R * R) continue;
      const tm = f.species.temperament;
      if (onlySkittish && tm !== 'skittish') continue;
      let p = TEMPER_SCARE[tm] || 0.5;
      if (f.species.level >= 6) p *= 0.3;
      if (rng.next() < p) {
        startle(S, f, x, y, strength);
        if (a.group) a.group.panic = Math.max(a.group.panic, 0.6);
      }
    }
  }
  const offs = [
    game.events.on('splash', (p) => {
      if (S.selfEmit || !p) return;
      const size = p.size === undefined ? 1 : p.size;
      if (size >= 0.5) scare(p.x, p.y, 110 + 140 * size, Math.min(1.5, size));
    }),
    game.events.on('lureSplash', (p) => {
      if (!p) return;
      scare(p.x, p.y, 150, 0.7, true);
      lure.dinnerBell(p.x, p.y);
    }),
    game.events.on('lightning', (p) => {
      const power = (p && p.power) || 0.7;
      const v = pop.view;
      for (const f of list) {
        const a = f.ai;
        if (!a || a.tag !== S.tag || f.controlled || f.y > 640 || f.x < v.l || f.x > v.r) continue;
        if (rng.next() < (TEMPER_SCARE[f.species.temperament] || 0.5) * power * 0.8) startle(S, f, f.x + (rng.next() - 0.5) * 300, -300, 0.6);
      }
    }),
    game.events.on('twitch', (p) => lure.onTwitch(p)),
  ];

  /** Dev: wipe the population and refill (census/bite tests). */
  function debugReset() {
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.ai && f.ai.tag === S.tag && !f.controlled) removeFish(f, 'reset');
    }
    S.groups.length = 0;
    pop.cells.clear();
    pop.booted = false;
    pop.acc = 1;
    lure.reset && lure.reset();
    for (const k in S.stats) S.stats[k] = 0;
  }

  return {
    list,
    update,
    release,
    remove,
    spawnDebug,
    scan,
    /** dev / diagnostics (not part of the contract) */
    perf,
    stats: S.stats,
    debugReset,
    debugState: () => ({
      view: { ...pop.view },
      viewTarget: pop.viewTarget,
      viewCensus: pop.viewCensus,
      regions: pop.reg.map((r) => ({ on: r.on, target: r.target, census: r.census, kind: r.kind })),
      groups: S.groups.length,
      mega: { ...pop.mega },
    }),
    debugForce: (what, on = true) => {
      if (what === 'megalodon') {
        if (on) pop.openMega();
        else pop.mega.open = false;
      }
      if (what === 'predator') hunt.force = on;
    },
    _S: S,
    destroy() {
      offs.forEach((off) => off());
    },
  };
}
