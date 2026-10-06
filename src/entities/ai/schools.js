// LIFE — schools & social groups.
//
//  'school'  a polarised formation that follows a VIRTUAL LEADER (a pseudo-fish running the normal cruise logic,
//            never drawn). Members hold a slot in an ellipse around it, align with its velocity and keep their
//            distance from each other, so the whole school turns together. Sardines can collapse into a milling
//            bait ball (members orbit the centre in the vertical plane). Flying-fish schools take flight together.
//  'loose' · 'cluster' · 'bloom' · 'conga'   social groups: members wander on their own but share a home and
//            drift back toward the group when they stray (decideHeading), lobsters walk single file.
import { clamp, damp, lerp } from '../../core/math.js';
import { noise1 } from '../../core/rng.js';
import { makeAI, stepFish, setMode, startle } from './motion.js';
import { cruiseFor } from './profiles.js';

/** Create a group for `n` members of `prof` around (x, y). Members are attached with joinGroup(). */
export function createGroup(S, prof, x, y, n, len) {
  const rng = S.rng;
  const g = {
    prof,
    style: prof.group,
    members: [],
    alive: true,
    cx: x,
    cy: y,
    homeX: x,
    R: 0,
    lead: null,
    mill: 0,
    millDir: rng.sign(),
    millMood: false,
    moodT: rng.range(8, 25),
    panic: 0,
    px: 0,
    py: 0,
    flightT: rng.range(5, 18),
  };
  if (g.style === 'school') {
    g.R = len * prof.spacing * Math.sqrt(n) * 0.55 + 6;
    const L = {
      x, y, vx: 0, vy: 0, dir: rng.sign(), pitch: 0, visualLen: len + g.R * 0.9, species: prof.sp, speciesId: prof.id,
      swimPhase: 0, swimAmp: 0.5, mouth: 0, alpha: 1, glowAmt: 1, state: 'swim', controlled: false, age: 0, uid: 0,
      sizeQ: 0.5, shiny: false, seed: 0.5,
    };
    L.ai = makeAI(S, L, prof);
    L.ai.cruise = cruiseFor(prof, len) * 0.9;
    L.ai.accel = Math.max(14, L.ai.cruise * prof.agility * 0.7);
    L.ai.isLeader = true;
    g.lead = L;
  } else if (g.style === 'cluster') g.R = prof.homeR;
  else if (g.style === 'bloom') g.R = 150;
  else g.R = len * 2.6 + 70;
  S.groups.push(g);
  return g;
}

/** Attach a fish to a group (formation slot, orbit radius, shared home). */
export function joinGroup(S, g, f) {
  const a = f.ai, rng = S.rng;
  a.group = g;
  a.gi = g.members.length;
  g.members.push(f);
  const r = Math.sqrt(rng.next()), th = rng.next() * Math.PI * 2;
  a.sx = Math.cos(th) * r;
  a.sy = Math.sin(th) * r;
  // bait-ball orbits: plenty of fish on the inner tracks so the ball reads dense, not as a hollow ring
  a.orbR = g.R * (0.18 + 0.72 * rng.next());
  a.orbA = rng.next() * Math.PI * 2;
  a.homeX = g.homeX;
  if (g.lead) {
    a.hx = g.lead.ai.hx;
    setMode(a, 'school');
  }
}

export function leaveGroup(f) {
  const a = f.ai;
  const g = a && a.group;
  if (!g) return;
  const i = g.members.indexOf(f);
  if (i >= 0) g.members.splice(i, 1);
  for (let k = 0; k < g.members.length; k++) if (g.members[k].ai) g.members[k].ai.gi = k;
  a.group = null;
  if (g.members.length === 0) g.alive = false;
}

/** Update group centres, leaders, bait-ball moods and flights. Runs before the members move. */
export function updateGroups(S, dt) {
  const rng = S.rng;
  for (let i = S.groups.length - 1; i >= 0; i--) {
    const g = S.groups[i];
    if (!g.alive || g.members.length === 0) {
      g.alive = false;
      S.groups.splice(i, 1);
      continue;
    }
    let cx = 0, cy = 0, n = 0;
    for (const m of g.members) {
      if (m.controlled) continue;
      cx += m.x;
      cy += m.y;
      n++;
    }
    if (n > 0) {
      g.cx = cx / n;
      g.cy = cy / n;
    }
    if (g.panic > 0) g.panic = Math.max(0, g.panic - dt * 0.18);
    const L = g.lead;
    if (!L) continue;
    // the leader settled back in (hemmed in by its habitat): so does the school
    if (!L.ai.leaving) for (const m of g.members) if (m.ai.leaving && m.ai.mode === 'school') m.ai.leaving = false;
    // bait-ball mood (sardines): sometimes spontaneously, always when a hunter is around
    if (g.prof.mill) {
      g.moodT -= dt;
      if (g.moodT <= 0) {
        g.millMood = !g.millMood && rng.next() < 0.35;
        g.moodT = g.millMood ? rng.range(10, 22) : rng.range(14, 34);
      }
      const want = g.panic > 0.05 || g.millMood ? 1 : 0;
      g.mill = damp(g.mill, want, want ? 1.4 : 0.6, dt);
      const la = L.ai;
      if (want && la.mode === 'cruise') {
        setMode(la, 'rest');
        la.restT = 1e6;
      } else if (!want && la.mode === 'rest' && la.restT > 1e5) la.restT = 0;
    }
    // flying fish take to the air together
    if (g.prof.special === 'flyer') {
      g.flightT -= dt;
      if (g.flightT <= 0 || g.panic > 0.9) {
        g.flightT = rng.range(9, 26);
        if (g.panic > 0.9) g.panic = 0.85;
        takeFlight(S, g);
      }
    }
    if (L.ai.boostT > 0) L.ai.boostT -= dt;
    stepFish(S, L, dt);
    if (L.ai.boostT > 0) {
      const v = L.ai.hx * L.ai.cruise * 3.2;
      L.vx = damp(L.vx, v, 2.5, dt);
    }
    // leash: the leader waits for stragglers (e.g. held back by terrain or by a lure)
    if (n > 0) {
      const dx = g.cx - L.x, dy = g.cy - L.y;
      const far = Math.hypot(dx, dy) - (g.R * 1.6 + 50);
      if (far > 0) {
        const k = Math.min(1, far / 300) * 0.9 * dt;
        L.x += dx * k;
        L.y += dy * k;
      }
    }
  }
}

function takeFlight(S, g) {
  const L = g.lead, rng = S.rng;
  const dir = L.ai.hx;
  L.ai.boostT = 2.6;
  let k = 0;
  for (const m of g.members) {
    const a = m.ai;
    if (m.controlled || !a || a.mode !== 'school') continue;
    if (rng.next() < 0.18) continue; // a few stay below
    a.hx = dir;
    a.launchDelay = k * rng.range(0.04, 0.2);
    a.retMode = 'school';
    setMode(a, 'launch');
    k++;
  }
}

/** Panic a group: members near the threat bolt, sardines ball up, flying fish fly. */
export function panicGroup(S, g, x, y, radius) {
  g.panic = 1;
  g.px = x;
  g.py = y;
  for (const m of g.members) {
    if (m.controlled) continue;
    const md = m.ai.mode;
    if (md === 'flee' || md === 'launch' || md === 'air') continue;
    const dx = m.x - x, dy = m.y - y;
    // a short scatter, then they regroup — into a bait ball for sardines
    if (dx * dx + dy * dy < radius * radius) startle(S, m, x, y, 0.5);
  }
}

/** Steering for a member holding its place in a formation school (mode 'school'). */
export function schoolMember(S, f, a, P, dt) {
  const g = a.group, L = g && g.lead;
  if (!L || !g.alive) {
    a.group = null;
    setMode(a, 'cruise');
    a.dvx = a.hx * a.cruise;
    a.dvy = 0;
    a.st = 'swim';
    return;
  }
  const len = f.visualLen, R = g.R;
  const wob = 0.16;
  const ox = a.sx + (noise1(a.t * 0.33, a.ns) - 0.5) * 2 * wob;
  const oy = a.sy + (noise1(a.t * 0.29, a.ns + 50) - 0.5) * 2 * wob;
  let tx = L.x + ox * R * 1.3, ty = L.y + oy * R * 0.62;
  let fvx = L.vx, fvy = L.vy;
  const m = g.mill;
  if (m > 0.01) {
    const w = (a.cruise * 0.85 / Math.max(14, a.orbR)) * g.millDir;
    a.orbA += dt * w;
    const c = Math.cos(a.orbA), s = Math.sin(a.orbA);
    const rx = a.orbR * 1.15, ry = a.orbR * 0.8;
    tx = lerp(tx, L.x + c * rx, m);
    ty = lerp(ty, L.y + s * ry, m);
    fvx = lerp(fvx, L.vx - s * rx * w, m);
    fvy = lerp(fvy, L.vy + c * ry * w, m);
  }
  const k = 1.2 * P.tight;
  // vertical corrections are gentle (fish in a school stay nearly level); bait balls need the full spring
  const ky = k * (0.55 + 0.45 * m);
  let dvx = fvx + (tx - f.x) * k, dvy = fvy + (ty - f.y) * ky;
  const minD = len * Math.max(0.55, P.spacing * 0.62);
  const ms = g.members;
  for (let i = 0; i < ms.length; i++) {
    const o = ms[i];
    if (o === f) continue;
    const dx = f.x - o.x, dy = f.y - o.y;
    if (dx > minD || dx < -minD || dy > minD || dy < -minD) continue;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d < minD) {
      const push = (1 - d / minD) * a.cruise * 1.6;
      dvx += (dx / d) * push;
      dvy += (dy / d) * push;
    }
  }
  const vmax = a.cruise * 1.9, v = Math.hypot(dvx, dvy);
  if (v > vmax) {
    dvx *= vmax / v;
    dvy *= vmax / v;
  }
  a.dvx = dvx;
  const vy = Math.abs(fvy) + a.cruise * (0.3 + 0.9 * m);
  a.dvy = clamp(dvy, -vy, vy);
  a.hx = L.ai.hx;
  a.st = Math.abs(f.vx) + Math.abs(f.vy) < a.cruise * 0.3 ? 'idle' : 'swim';
}
