// LIFE — hunters.
//  rush   a hunter (tuna, barracuda, mahi, sharks, squid…) occasionally charges a school of smaller fish: the school
//         panics (members bolt, sardines ball up, flying fish take off) and sometimes one straggler is eaten.
//  stalk  while a fish is being fought, a predator (species.predator > 0, ≥ 2 levels above the hooked fish) may
//         circle in and strike it → game.fishing.predatorStrike(predator). One roll per fight (~1 in 6 when such a
//         predator is around), so it is a thrill, not a tax.
import { setMode, baseMode, startle } from './motion.js';
import { panicGroup } from './schools.js';
import { mouthOf } from '../../render/bestiary.js';

const BOLD = [1, 0.8, 1, 1.25];

export function createHunt(S) {
  const rng = S.rng;
  const F = { on: false, prey: null, t: 0, rolled: false, pred: null, attract: false, checkT: 0 };
  const H = { force: false, scanT: 0.5, fight: F };

  const eligible = (p, prey) =>
    p.sp.predator > 0 && p.level >= prey.species.level + 2 && p.refLen > prey.visualLen * 1.1;

  function findPredator(prey, R) {
    let best = null, bd = R;
    for (const f of S.list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.dead || a.leaving) continue;
      if (a.mode === 'air' || a.mode === 'launch' || a.mode === 'lure' || !eligible(a.prof, prey)) continue;
      const d = Math.hypot(f.x - prey.x, f.y - prey.y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  function startStalk(pred, prey) {
    const a = pred.ai;
    a.prey = prey;
    a.stage = 0;
    a.rushT = 1.5 + rng.next() * 1.8;
    a.orbit = rng.sign();
    setMode(a, 'stalk');
  }

  function watchFight(dt) {
    const fl = S.game.fishing;
    const prey = fl && fl.state === 'fight' && fl.hooked && fl.hooked.species.group !== 'item' ? fl.hooked : null;
    if (!prey) {
      if (F.on && F.pred && F.pred.ai && !F.pred.controlled && F.pred.ai.mode === 'stalk') {
        F.pred.ai.prey = null;
        setMode(F.pred.ai, baseMode(F.pred.ai));
      }
      F.on = false;
      F.pred = null;
      return;
    }
    if (!F.on || F.prey !== prey) {
      F.on = true;
      F.prey = prey;
      F.t = 0;
      F.rolled = false;
      F.pred = null;
      F.attract = false;
      F.checkT = 0.5;
    }
    F.t += dt;
    if (F.pred) {
      if (F.pred.controlled || F.pred.ai.dead || F.pred.ai.mode !== 'stalk') F.pred = null;
      return;
    }
    if (F.rolled) return;
    F.checkT -= dt;
    if (F.checkT > 0) return;
    F.checkT = 0.5;
    const pred = findPredator(prey, 1500);
    if (pred) {
      F.rolled = true;
      if (H.force || rng.next() < (1 / 6) * (BOLD[pred.species.predator] || 1)) {
        F.pred = pred;
        startStalk(pred, prey);
        S.stats.strikes++;
      }
      return;
    }
    // a struggling fish sends out vibrations: now and then they draw a predator in from out of view
    if (!F.attract && F.t > 2) {
      F.attract = true;
      if (H.force || rng.next() < 0.3) S.pop.spawnNear(prey.x, prey.y, { only: (p) => eligible(p, prey), room: 2 });
    }
  }

  function scanRushes() {
    for (const f of S.list) {
      const a = f.ai;
      if (!a || a.tag !== S.tag || f.controlled || a.dead || a.leaving || !a.prof.isHunter) continue;
      if (a.mode !== 'cruise' && a.mode !== 'school' && a.mode !== 'rest') continue;
      a.huntCool -= 0.5;
      if (a.huntCool > 0) continue;
      a.huntCool = (25 + rng.next() * 45) / a.prof.hunter;
      let best = null, bd = 720;
      for (const g of S.groups) {
        if (!g.alive || g.members.length < 3 || g === a.group) continue;
        if (g.prof.level >= a.prof.level || g.prof.refLen > f.visualLen * 0.5) continue;
        const d = Math.hypot(g.cx - f.x, g.cy - f.y);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
      if (!best) continue;
      a.prey = best;
      // long enough to get there at full burst, plus the strike itself
      a.rushT = bd / (a.cruise * 2.4) + 1.2 + rng.next();
      a.ate = false;
      setMode(a, 'rush');
      S.stats.rushes++;
    }
  }

  H.pre = (dt) => {
    watchFight(dt);
    H.scanT -= dt;
    if (H.scanT <= 0) {
      H.scanT = 0.5;
      scanRushes();
    }
  };

  function quit(f, a) {
    a.prey = null;
    setMode(a, baseMode(a));
    a.dvx = a.hx * a.cruise;
    a.dvy = 0;
    a.st = 'swim';
    return 1;
  }

  function rush(f, a, P, dt) {
    const g = a.prey;
    a.rushT -= dt;
    if (!g || !g.alive || a.rushT <= 0) return quit(f, a);
    const len = f.visualLen;
    const dx = g.cx - f.x, dy = g.cy - f.y, d = Math.hypot(dx, dy) || 1;
    const sp = a.cruise * 2.9;
    a.dvx = (dx / d) * sp;
    a.dvy = (dy / d) * sp * 0.8;
    a.hx = dx >= 0 ? 1 : -1;
    a.st = 'swim';
    a.mouthT = d < len * 1.2 + g.R ? 0.85 : 0.15;
    // squids lunge arms-first (their mouth is at the trailing end)
    if (P.mouth === undefined) P.mouth = mouthOf(P.id);
    if (P.mouth.x < 0 && d < len * 1.6 + g.R) a.face = g.cx >= f.x ? -1 : 1;
    if (d < g.R * 1.8 + len) panicGroup(S, g, f.x, f.y, g.R * 2 + len);
    if (!a.ate && d < len * 0.5 + g.R * 0.7) {
      a.ate = true;
      a.rushT = Math.min(a.rushT, 0.7);
      if (rng.next() < 0.35) {
        const mo = mouthOf(P.id), mxp = f.x + (f.dir >= 0 ? 1 : -1) * mo.x * len, myp = f.y + mo.y * len;
        let v = null, vd = len * 0.6 + 20;
        for (const m of g.members) {
          if (m.controlled || m.shiny) continue;
          const e = Math.hypot(m.x - mxp, m.y - myp);
          if (e < vd) {
            vd = e;
            v = m;
          }
        }
        if (v) {
          S.emit('bubbles', { x: v.x, y: v.y, n: 6 });
          S.removeFish(v, 'eaten');
          S.stats.eaten++;
        }
      }
    }
    return 3;
  }

  function stalk(f, a, P, dt) {
    const prey = a.prey, fl = S.game.fishing;
    if (!prey || !fl || fl.hooked !== prey || fl.state !== 'fight') return quit(f, a);
    const len = f.visualLen;
    const dx = prey.x - f.x, dy = prey.y - f.y, d = Math.hypot(dx, dy) || 1;
    a.hx = dx >= 0 ? 1 : -1;
    if (a.stage === 0) {
      // close in, then circle the struggling fish for a moment
      a.st = 'swim';
      const r = len * 1.4 + prey.visualLen + 60;
      if (d > r * 1.4) {
        const sp = a.cruise * 1.7;
        a.dvx = (dx / d) * sp;
        a.dvy = (dy / d) * sp * 0.7;
        if (a.modeT > 14) return quit(f, a);
      } else {
        a.rushT -= dt;
        const ang = Math.atan2(f.y - prey.y, f.x - prey.x) + a.orbit * 0.9;
        const tx = prey.x + Math.cos(ang) * r, ty = prey.y + Math.sin(ang) * r * 0.55;
        const ex = tx - f.x, ey = ty - f.y, e = Math.hypot(ex, ey) || 1;
        const sp = a.cruise * 1.25;
        a.dvx = (ex / e) * sp;
        a.dvy = (ey / e) * sp;
        if (a.rushT <= 0) {
          a.stage = 1;
          a.modeT = 0;
        }
      }
      return 1.8;
    }
    // the strike: full burst, jaws open, leading the target a little
    a.st = 'approach';
    const lx = prey.x + (prey.vx || 0) * 0.25 - f.x, ly = prey.y + (prey.vy || 0) * 0.25 - f.y;
    const ld = Math.hypot(lx, ly) || 1, sp = a.cruise * 3.2;
    a.dvx = (lx / ld) * sp;
    a.dvy = (ly / ld) * sp;
    a.mouthT = d < len * 1.6 ? 1 : 0.4;
    const mo = mouthOf(P.id);
    if (mo.x < 0) a.face = prey.x >= f.x ? -1 : 1; // arms-first strike
    const mxp = f.x + (f.dir >= 0 ? 1 : -1) * mo.x * len, myp = f.y + mo.y * len;
    if (Math.hypot(prey.x - mxp, prey.y - myp) < prey.visualLen * 0.35 + len * 0.12 + 10) {
      let ok = false;
      try {
        ok = typeof fl.predatorStrike === 'function' && !!fl.predatorStrike(f);
      } catch (e) {
        S.game.reportError('fish:predatorStrike', e);
      }
      if (ok) {
        if (!f.controlled) f.controlled = true;
        return 1;
      }
      a.wary = 40;
      a.huntCool = 60;
      startle(S, f, prey.x, prey.y, 0.6);
      return 1;
    }
    if (a.modeT > 6) return quit(f, a);
    return 3.6;
  }

  H.step = (S2, f, a, P, dt) => (a.mode === 'rush' ? rush(f, a, P, dt) : stalk(f, a, P, dt));

  H.forget = (f) => {
    if (F.pred === f) F.pred = null;
    if (F.prey === f) F.prey = null;
  };

  return H;
}
