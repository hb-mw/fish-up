// LIFE — population: keeps the sea alive around the camera (and around the lure when it is far from the view).
//
// Regions = the view plus margins (+ a box around a distant lure). Each region has a target head-count from the
// habitat density (habitat.js) integrated over its water; when a region is short, a group is spawned OUTSIDE the
// view (so it swims in), chosen by ONE gated species picker (biome, depth band, layer, activity, abundance, level
// damping, diversity, megalodon gate) that every spawn path shares. Animals far outside every region despawn.
// Items sit at deterministic per-session spots (one roll per seabed cell) so a chest you saw is still there.
import { clamp } from '../../core/math.js';
import { hash2 } from '../../core/rng.js';
import { WORLD, biomeAt } from '../../core/config.js';
import { heightAt } from '../../world/terrain.js';
import { createFish, sampleSizeQ } from '../fishbase.js';
import { ITEMS, lengthFor, visualLength } from '../../data/species.js';
import { LURES_BY_ID, lureAffinity } from '../../data/lures.js';
import { zoneFor, targetFor, rarityK, biomeOK } from './habitat.js';
import { makeAI, setMode } from './motion.js';
import { createGroup, joinGroup } from './schools.js';

const CELL = 420;
const SHINY_P = 1 / 150;

export function createPopulation(S) {
  const rng = S.rng;
  const view = { l: 0, r: 0, t: 0, b: 0 };
  const reg = [
    { l: 0, r: 0, t: 0, b: 0, on: true, target: 0, census: 0, kind: 'view' },
    { l: 0, r: 0, t: 0, b: 0, on: false, target: 0, census: 0, kind: 'lure' },
  ];
  const z = { top: 0, bot: 0 };
  const segs = [0, 0, 0, 0];
  const wts = [];
  const groupCount = Object.create(null);
  const cells = new Map();
  const collected = new Map();
  const itemSeed = Math.floor(rng.next() * 1e6);
  const mega = { open: false, openT: 0, rollT: 30, cool: 0 };
  const pop = {
    view, reg, viewTarget: 0, viewCensus: 0, booted: false, acc: 0, camX: NaN, camY: NaN, camVX: 0,
    starveT: 0, mega, keepPad: 520, cells, collected,
  };

  const luck = () => {
    const st = S.game.player && S.game.player.stats;
    return clamp((st && st.luck) || 0, 0, 1);
  };

  function updateView(tdt) {
    const g = S.game, cam = g.camera, v = g.view;
    const hw = v.w / 2 / cam.zoom, hh = v.h / 2 / cam.zoom;
    view.l = cam.x - hw;
    view.r = cam.x + hw;
    view.t = cam.y - hh;
    view.b = cam.y + hh;
    let jumped = false;
    if (!Number.isNaN(pop.camX)) {
      const dx = cam.x - pop.camX, dy = cam.y - pop.camY;
      if (Math.abs(dx) > hw * 1.2 || Math.abs(dy) > hh * 1.2) jumped = true;
      else pop.camVX = pop.camVX * 0.6 + (dx / Math.max(tdt, 1e-3)) * 0.4;
    }
    pop.camX = cam.x;
    pop.camY = cam.y;
    const mx = clamp(hw * 0.55, 420, 1000), my = clamp(hh * 0.5, 260, 700);
    const r0 = reg[0];
    r0.l = Math.max(0, view.l - mx);
    r0.r = Math.min(WORLD.width, view.r + mx);
    r0.t = view.t - my;
    r0.b = view.b + my;
    const L = S.L, r1 = reg[1];
    r1.on = false;
    if (L.inWater && (L.x < view.l - 200 || L.x > view.r + 200 || L.y < view.t - 200 || L.y > view.b + 200)) {
      r1.on = true;
      r1.l = Math.max(0, L.x - 800);
      r1.r = Math.min(WORLD.width, L.x + 800);
      r1.t = L.y - 520;
      r1.b = L.y + 520;
    }
    return jumped;
  }

  const inside = (f, r, pad) => f.x > r.l - pad && f.x < r.r + pad && f.y > r.t - pad && f.y < r.b + pad;
  const isAnimal = (f) => f.ai && f.ai.tag === S.tag && !f.ai.isLeader && f.species.group !== 'item';

  /**
   * Head-counts. The VIEW is what the player sees, so the main target is the view itself: an animal counts when
   * it is in view, or in the margins but on its way in (heading toward the view, homed inside it, or about to be
   * overtaken by a moving camera). Margins are only a spawn / despawn buffer. A distant lure keeps its own box.
   */
  function census() {
    for (const k in groupCount) groupCount[k] = 0;
    const r0 = reg[0], r1 = reg[1];
    r0.census = r1.census = 0;
    let inView = 0;
    const seen = S.seenGroups;
    seen.clear();
    const cx = (view.l + view.r) / 2, hw = (view.r - view.l) / 2;
    const camV = pop.camVX;
    for (const f of S.list) {
      if (!isAnimal(f) || f.ai.leaving) continue;
      const a = f.ai;
      if (inside(f, view, 0)) {
        inView++;
        r0.census++;
      } else if (inside(f, r0, 0)) {
        const side = f.x < view.l || f.x > view.r;
        const vx = Math.abs(f.vx) > 4 ? f.vx : a.hx;
        let w = 0;
        if (!side) w = 0.5;
        else if ((cx - f.x) * vx > 0) w = 1;
        else if (a.homeR > 0 && Math.abs(a.homeX - cx) < hw + 120) w = 1;
        else if (Math.abs(camV) > 60 && camV * (f.x - cx) > 0) w = 1;
        r0.census += w;
      } else continue;
      const g = a.group;
      if (!g || !seen.has(g)) {
        if (g) seen.add(g);
        groupCount[f.speciesId] = (groupCount[f.speciesId] || 0) + 1;
      }
    }
    if (r1.on) for (const f of S.list) if (isAnimal(f) && !f.ai.leaving && inside(f, r1, 0)) r1.census++;
    pop.viewCensus = inView;
  }

  function despawn() {
    const list = S.list, r0 = reg[0], r1 = reg[1], keep = pop.keepPad;
    let animals = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i], a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.pinned) continue;
      if (f.species.group === 'item') continue; // items follow their cells
      const pad = f.visualLen * 0.75 + 40;
      a.inView = f.x > view.l - pad && f.x < view.r + pad && f.y > view.t - pad && f.y < view.b + pad;
      if (!a.leaving && f.age > a.stayT && a.mode !== 'lure' && a.mode !== 'stalk') moveOn(f);
      if (a.inView) {
        animals++;
        continue;
      }
      const p = a.leaving ? 0 : keep;
      if (!inside(f, r0, p) && !(r1.on && inside(f, r1, p))) S.removeFish(f, 'despawn');
      else animals++;
    }
    // hard cap: drop the out-of-view animal farthest from the view centre
    let over = list.length - S.cap;
    const cx = (view.l + view.r) / 2, cy = (view.t + view.b) / 2;
    while (over > 0) {
      let worst = null, wd = -1;
      for (const f of list) {
        const a = f.ai;
        if (!a || a.tag !== S.tag || f.controlled || a.pinned || a.inView || f.species.group === 'item') continue;
        const d = Math.abs(f.x - cx) + Math.abs(f.y - cy);
        if (d > wd) {
          wd = d;
          worst = f;
        }
      }
      if (!worst) break;
      S.removeFish(worst, 'cap');
      over--;
    }
    // a region far over its target lets its out-of-view animals drift away
    if (r0.census > r0.target * 1.6 + 6) {
      for (const f of list) {
        const a = f.ai;
        if (a && a.tag === S.tag && !a.inView && !a.leaving && !f.controlled && !a.pinned && a.prof.arch !== 'item' && a.prof.arch !== 'jelly') {
          moveOn(f);
          break;
        }
      }
    }
    return animals;
  }

  /** Residence time is up: the animal — with its whole group — swims off; newcomers take its place. */
  function moveOn(f) {
    const P = f.ai.prof;
    if (P.arch === 'jelly' || P.arch === 'item') return;
    const hx = f.x < (view.l + view.r) / 2 ? -1 : 1;
    const g = f.ai.group;
    const go = (m) => {
      const a = m.ai;
      if (!a || m.controlled || a.pinned || a.leaving) return;
      a.leaving = true;
      a.hx = hx;
      a.lockT = 2;
      // formation members keep following their leader (baseMode → 'school'); everyone else heads out
      if (a.mode === 'cruise' || a.mode === 'rest') setMode(a, a.group && a.group.lead ? 'school' : 'leave');
    };
    if (g) {
      for (const m of g.members) go(m);
      if (g.lead) {
        go(g.lead);
        setMode(g.lead.ai, 'leave');
      }
    } else go(f);
  }

  // ── the gated species picker (every spawn path goes through here) ──────────────────────────────────
  /**
   * Pick a species able to live at column x within the y-intervals in `segs` (n intervals).
   * opts.lure → weight by affinity^1.5 (only species that can take that lure). Writes S.pick = {prof, y}.
   */
  function pickSpecies(x, sb, n, opts) {
    const pool = S.pools[biomeAt(x).id];
    if (!pool || pool.length === 0) return false;
    const W = S.W;
    const lure = opts && opts.lure;
    const room = opts && opts.room !== undefined ? opts.room : 99;
    let total = 0;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      let w = 0;
      const allowed = !(opts && opts.only) || opts.only(p);
      if (allowed && (p.id !== 'megalodon' || mega.open) && zoneFor(p, p.refLen, sb, W.nightF, z)) {
        const zl = z.bot - z.top;
        let ov = 0;
        for (let k = 0; k < n; k++) {
          const s0 = segs[k * 2], s1 = segs[k * 2 + 1];
          if (zl < 1) {
            if (z.top >= s0 && z.top <= s1) ov = 1;
          } else {
            const lo = Math.max(z.top, s0), hi = Math.min(z.bot, s1);
            if (hi > lo) ov += hi - lo;
          }
        }
        if (ov > 0) {
          const act = p.sp.active[W.phase] || 0;
          // abundance^1.4: common species dominate the head-count, the rare stay rare
          w = Math.pow(p.sp.abundance, 1.4) * Math.pow(act, 0.8) * rarityK(p.level) * (zl < 1 ? 1 : ov / zl);
          w /= 1 + 0.35 * (groupCount[p.id] || 0);
          // a big school can't fill a small gap (it would overshoot the density target)
          if (room < p.sp.school[0] * 0.6 - 1) w *= 0.12;
          if (W.storm && p.sp.layer === 'surface') w *= 0.4;
          if (p.id === 'megalodon') w = 4;
          if (lure) {
            const aff = lureAffinity(lure, p.sp);
            w *= aff > 0 ? Math.pow(aff, 1.5) * (1 + (lure.bigBias || 0) * 2) : 0;
          }
        }
      }
      wts[i] = w;
      total += w;
    }
    if (total <= 0) return false;
    let r = rng.next() * total, pi = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= wts[i];
      if (r <= 0) {
        pi = i;
        break;
      }
    }
    const p = pool[pi];
    zoneFor(p, p.refLen, sb, W.nightF, z);
    let y = z.top;
    if (z.bot - z.top >= 1) {
      // uniform over the allowed overlap
      let tot = 0;
      for (let k = 0; k < n; k++) tot += Math.max(0, Math.min(z.bot, segs[k * 2 + 1]) - Math.max(z.top, segs[k * 2]));
      let u = rng.next() * tot;
      for (let k = 0; k < n; k++) {
        const lo = Math.max(z.top, segs[k * 2]), hi = Math.min(z.bot, segs[k * 2 + 1]);
        if (hi <= lo) continue;
        if (u <= hi - lo) {
          y = lo + u;
          break;
        }
        u -= hi - lo;
      }
    }
    S.pick.prof = p;
    S.pick.y = y;
    return true;
  }

  /** Allowed y-intervals in column x of region r (minus the padded view unless inView is allowed). */
  function columnSegs(x, sb, r, inView) {
    const top = Math.max(r.t, 0), bot = Math.min(r.b, sb);
    if (bot - top < 8) return 0;
    const pad = 150;
    if (inView || x < view.l - pad || x > view.r + pad) {
      segs[0] = top;
      segs[1] = bot;
      return 1;
    }
    let n = 0;
    if (view.t - pad > top) {
      segs[0] = top;
      segs[1] = Math.min(bot, view.t - pad);
      n = 1;
    }
    if (view.b + pad < bot) {
      segs[n * 2] = Math.max(top, view.b + pad);
      segs[n * 2 + 1] = bot;
      n++;
    }
    return n;
  }

  function pickX(r, inView) {
    if (inView) return r.l + rng.next() * (r.r - r.l);
    const lw = Math.max(0, view.l - r.l), rw = Math.max(0, r.r - view.r);
    if (rng.next() < 0.78 && lw + rw > 40) {
      const bias = clamp(pop.camVX / 220, -0.85, 0.85);
      const pl = (lw * (1 - bias)) / Math.max(1, lw * (1 - bias) + rw * (1 + bias));
      return rng.next() < pl ? r.l + rng.next() * lw : view.r + rng.next() * rw;
    }
    return r.l + rng.next() * (r.r - r.l);
  }

  const inViewAt = (x, y, len) => {
    const pad = len * 0.6 + 30;
    return x > view.l - pad && x < view.r + pad && y > view.t - pad && y < view.b + pad;
  };

  /** Try to spawn one group in region r. opts: {inView, fade, lure, seeker}. Returns the group's first fish. */
  function spawnInRegion(r, opts) {
    const inView = !!(opts && opts.inView);
    const maxTries = (opts && opts.tries) || 14;
    for (let tries = 0; tries < maxTries; tries++) {
      const x = pickX(r, inView);
      if (x < 600 || x > WORLD.width - 20) continue;
      const sb = heightAt(x);
      const n = columnSegs(x, sb, r, inView);
      if (!n || !pickSpecies(x, sb, n, opts)) continue;
      const p = S.pick.prof, y = S.pick.y;
      if (!inView && inViewAt(x, y, p.refLen)) continue;
      return spawnGroupAt(p, x, y, opts);
    }
    return null;
  }

  /** Create a group of `prof` at (x, y): sizes, shinies, formation, heading into the view. */
  function spawnGroupAt(prof, x, y, opts) {
    const sp = prof.sp;
    let n = rng.int(sp.school[0], sp.school[1]);
    if (opts && opts.room !== undefined) n = Math.min(n, Math.max(sp.school[0], Math.ceil(opts.room * 1.3)));
    n = Math.min(n, S.cap - S.list.length);
    if (n <= 0) return null;
    const lk = luck();
    const bias = clamp(lk * 0.5 + ((opts && opts.sizeBias) || 0), 0, 1);
    const baseQ = sampleSizeQ(rng, bias);
    const refLen = visualLength(lengthFor(sp, baseQ));
    const grouped = n > 1 || prof.group === 'cluster';
    const g = grouped ? createGroup(S, prof, x, y, n, refLen) : null;
    const vc = (view.l + view.r) / 2;
    const hx = x < vc ? 1 : -1;
    const homeX = prof.homeR > 0 ? x + hx * Math.min(prof.homeR * 0.9, Math.abs(vc - x)) : x;
    if (g) g.homeX = homeX;
    const fade = !!(opts && opts.fade);
    let first = null;
    for (let i = 0; i < n; i++) {
      const q = g && prof.group === 'school' ? clamp(baseQ + rng.gaussian() * 0.06, 0, 1) : i === 0 ? baseQ : sampleSizeQ(rng, bias);
      const shiny = rng.next() < SHINY_P * (1 + 2.5 * lk);
      const f = createFish(sp, { x, y, sizeQ: q, rng, dir: hx, shiny });
      const a = (f.ai = makeAI(S, f, prof));
      a.hx = hx;
      a.homeX = homeX;
      if (prof.jet > 0) f.swimPhase = a.pulse;
      if (g) joinGroup(S, g, f);
      placeMember(f, g, i, x, y, hx);
      if (!biomeOK(prof, f.x, 0) || !zoneFor(prof, f.visualLen, heightAt(f.x), S.W.nightF, z)) {
        f.x = x;
        f.y = y;
      }
      if (zoneFor(prof, f.visualLen, heightAt(f.x), S.W.nightF, z)) {
        if (f.y < z.top) f.y = z.top;
        if (f.y > z.bot) f.y = z.bot;
        // spawned above / below the view: its preferred depth points into the view, so it drifts in
        const yy = f.y < view.t || f.y > view.b ? (view.t + view.b) / 2 : f.y;
        a.zf = z.bot - z.top > 1 ? clamp((yy - z.top) / (z.bot - z.top), 0, 1) : 0.5;
      }
      a.ty = f.y;
      if (fade) {
        f.alpha = 0;
        a.fadeIn = 0.75;
      }
      if (opts && opts.seeker && i === 0) a.seeker = true;
      S.list.push(f);
      S.stats.spawned++;
      if (fade) S.stats.inViewSpawns++;
      if (!first) first = f;
    }
    if (g && g.lead) {
      const la = g.lead.ai;
      la.hx = hx;
      la.homeX = homeX;
      la.zf = first ? first.ai.zf : 0.5;
      g.lead.dir = hx;
    }
    if (sp.id === 'megalodon') {
      mega.open = false;
      mega.cool = 480;
    }
    return first;
  }

  function placeMember(f, g, i, x, y, hx) {
    if (!g) return;
    const a = f.ai, len = f.visualLen, st = g.style;
    if (st === 'school') {
      f.x = x + a.sx * g.R * 1.3;
      f.y = y + a.sy * g.R * 0.62;
    } else if (st === 'cluster') {
      f.x = x + (rng.next() - 0.5) * g.R * 1.2;
      f.y = y - rng.next() * 30;
    } else if (st === 'bloom') {
      f.x = x + (rng.next() - 0.5) * 260;
      f.y = y + (rng.next() - 0.5) * 120;
    } else if (st === 'conga') {
      f.x = x - hx * i * len * 1.05;
    } else {
      f.x = x + (rng.next() - 0.5) * len * 4;
      f.y = y + (rng.next() - 0.5) * len * 0.8;
    }
    f.x = clamp(f.x, 620, WORLD.width - 30);
  }

  // ── items: one deterministic roll per seabed cell (+ bottles at the surface) ────────────────────────
  function items() {
    const r0 = reg[0], keep = pop.keepPad * 0.6;
    const c0 = Math.floor((r0.l - keep) / CELL), c1 = Math.floor((r0.r + keep) / CELL);
    const t = S.W.t;
    for (let c = Math.max(1, c0); c <= c1; c++) {
      for (let k = 0; k < 2; k++) {
        const key = c * 2 + k;
        if (cells.has(key)) continue;
        const ct = collected.get(key);
        if (ct !== undefined && t - ct < 600) {
          cells.set(key, null);
          continue;
        }
        cells.set(key, placeItem(c, k));
      }
    }
    for (const [key, f] of cells) {
      const c = key >> 1;
      if (c >= c0 - 1 && c <= c1 + 1) continue;
      if (f && (f.controlled || !S.list.includes(f))) {
        cells.delete(key);
        continue;
      }
      if (f && inViewAt(f.x, f.y, f.visualLen)) continue;
      if (f) S.removeFish(f, 'despawn');
      cells.delete(key);
    }
  }

  function placeItem(c, surface) {
    const h = (k) => hash2(c * 7 + k, itemSeed + surface * 977);
    const x = (c + 0.12 + 0.76 * h(1)) * CELL;
    if (x < 640 || x > WORLD.width - 40) return null;
    const sb = heightAt(x), bio = biomeAt(x).id;
    const nearWreck = Math.abs(x - 6330) < 520;
    let total = 0;
    for (const it of ITEMS) {
      if ((it.layer === 'surface') !== !!surface || !it.biomes.includes(bio)) continue;
      if (!surface && (sb < it.depthM[0] * 8 || sb > it.depthM[1] * 8)) continue;
      total += it.abundance * (nearWreck && it.id === 'treasure_chest' ? 9 : 1);
    }
    const p = Math.min(surface ? 0.07 : 0.55, total * (surface ? 0.6 : 0.5));
    if (h(2) > p) return null;
    let r = h(3) * total, pick = null;
    for (const it of ITEMS) {
      if ((it.layer === 'surface') !== !!surface || !it.biomes.includes(bio)) continue;
      if (!surface && (sb < it.depthM[0] * 8 || sb > it.depthM[1] * 8)) continue;
      r -= it.abundance * (nearWreck && it.id === 'treasure_chest' ? 9 : 1);
      if (r <= 0) {
        pick = it;
        break;
      }
    }
    if (!pick) return null;
    const prof = S.profiles[pick.id];
    const f = createFish(pick, { x, y: surface ? 2 : sb, sizeQ: h(4), dir: h(5) < 0.5 ? -1 : 1, rng });
    const a = (f.ai = makeAI(S, f, prof));
    a.homeX = x;
    a.cell = c * 2 + surface;
    a.modeT = 0;
    f.y = surface ? 2 : sb - prof.down * f.visualLen * 0.75;
    S.list.push(f);
    return f;
  }

  // ── the megalodon: trench, night, a long timed roll (chum helps), then a long cooldown ─────────────
  function megaGate(tdt) {
    if (mega.cool > 0) mega.cool -= tdt;
    if (mega.open) {
      mega.openT -= tdt;
      if (mega.openT <= 0) mega.open = false;
      return;
    }
    if (mega.cool > 0 || S.W.phase !== 'night') return;
    let deep = false;
    for (const r of reg) if (r.on && (r.l + r.r) / 2 > 10300 && r.b > 480 * 8) deep = true;
    if (!deep) return;
    mega.rollT -= tdt;
    if (mega.rollT > 0) return;
    mega.rollT = 60;
    const chum = S.L.inWater && S.L.id === 'chum';
    if (rng.next() < (chum ? 0.12 : 0.03) || S.game.flags.mega === '1') openMega();
  }

  /** Open the gate and try to bring it in right away (out of view, from the dark). */
  function openMega() {
    mega.open = true;
    mega.openT = 45;
    const only = (p) => p.id === 'megalodon';
    for (const r of reg) {
      if (!r.on || !mega.open) continue;
      // an 18 m shark needs more room than the usual margins to stay out of sight while it arrives
      const big = { l: Math.max(0, r.l - 500), r: Math.min(WORLD.width, r.r + 500), t: r.t - 700, b: r.b + 1000 };
      spawnInRegion(big, { only, room: 1, tries: 80 });
    }
  }
  pop.openMega = openMega;

  // ── tick ───────────────────────────────────────────────────────────────────────────────────────────
  /** Spawn groups placed inside `posR` until region `r` reaches its target (or maxGroups attempts). */
  function fill(r, posR, opts, maxGroups) {
    let k = 0;
    while (k < maxGroups && r.target - r.census >= 1 && S.list.length < S.cap) {
      opts.room = r.target - r.census;
      const f = spawnInRegion(posR, opts);
      k++;
      if (!f) continue;
      r.census += f.ai.group ? f.ai.group.members.length : 1;
      groupCount[f.speciesId] = (groupCount[f.speciesId] || 0) + 1;
    }
  }

  pop.update = (dt) => {
    pop.acc += dt;
    if (pop.booted && pop.acc < 0.2) return;
    const tdt = pop.acc;
    pop.acc = 0;
    const jumped = updateView(tdt);
    const W = S.W;
    pop.viewTarget = Math.min(S.cap * 0.8, targetFor(view, W.nightF));
    reg[0].target = pop.viewTarget;
    if (reg[1].on) reg[1].target = Math.min(S.cap * 0.5, targetFor(reg[1], W.nightF));
    megaGate(tdt);
    items();
    despawn();
    census();
    pop.starveT = pop.viewCensus < pop.viewTarget * 0.5 ? pop.starveT + tdt : 0;
    if (!pop.booted || jumped) {
      // boot / teleport: the scene must be alive right away (boot: no fade; teleport: fade in)
      fill(reg[0], view, { inView: true, fade: pop.booted }, 80);
      if (reg[1].on) fill(reg[1], reg[1], { inView: true, fade: pop.booted }, 40);
      pop.booted = true;
      return;
    }
    const lastResort = pop.starveT > 4;
    let best = null, bestK = 0;
    for (const r of reg) {
      if (!r.on) continue;
      const d = r.target - r.census;
      if (d < 1) continue;
      const k = d / Math.max(1, r.target);
      if (k > bestK) {
        bestK = k;
        best = r;
      }
    }
    if (!best) return;
    const groups = bestK > 0.4 ? 3 : 1;
    fill(best, best, { inView: lastResort, fade: lastResort }, groups);
    if (lastResort) pop.starveT = 2;
  };

  pop.spawnInRegion = spawnInRegion;
  pop.spawnGroupAt = spawnGroupAt;
  pop.pickSpecies = pickSpecies;
  pop.columnSegs = columnSegs;
  pop.inViewAt = inViewAt;
  pop.luck = luck;
  /** Spawn a group that has noticed the lure from afar (director / predators drawn to a struggle). */
  pop.spawnNear = (x, y, opts) => {
    const r = { l: Math.max(0, x - 1100), r: Math.min(WORLD.width, x + 1100), t: y - 420, b: y + 420 };
    return spawnInRegion(r, opts);
  };
  pop.lureDef = (id) => LURES_BY_ID[id] || LURES_BY_ID.worm;
  return pop;
}
