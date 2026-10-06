// The fight: a tension tug-of-war between the fish's pulling effort and the player's reel. GAMEPLAY helper.
//
//   load     = pull(mode, stamina) × ratio, ratio = fishPower / stats.tackle
//   reeling  → tension = load + REEL_LOAD           (cranking against a pulling fish is how lines snap)
//   released → tension = min(load, DRAG), the fish strips line when it pulls harder than the drag
//   geometric slack (fish swimming at the boat) kills tension no matter what → reel to stay tight
//   tension ≥ 1 fills fight.snapMeter · tension ≈ 0 while the fish is active fills fight.slackMeter
//   the sweet spot (≈0.55–0.9) tires the fish fastest; a fish with no stamina is dead weight and comes in.
import { clamp, clamp01, damp } from '../core/math.js';
import { LURES_BY_ID } from '../data/lures.js';
import { spoolLimit } from './fishing-line.js';
import { MODES, nextMode, effort, stepMotion, constrainToLine } from './fishing-fightmotion.js';

const DRAG = 0.8;        // tension the released spool lets through before giving line
const REEL_LOAD = 0.4;   // tension added by cranking against the fish
const SNAP_BAND = 0.3;   // tension above 1.0 that fills the snap meter in one second
const SLACK_T = 0.2;     // below this tension the hook can work loose
const SLACK_TIME = 1.3;  // s of dead-slack line (fully active fish) before the hook is thrown

/** Fight power of an individual (species power scaled by its size). */
export const fishPower = (fish) => fish.species.fight.power * (0.7 + 0.6 * fish.sizeQ);
/** Seconds a fair, well-played fight with this fish should take. */
export const baseDuration = (fish) => {
  const lv = fish.species.level, big = Math.max(0, lv - 7);
  return (6 + 2.0 * Math.pow(fish.species.fight.stamina, 1.25)) * (0.6 + 0.1 * lv + 0.12 * big * big);
};

export function createFight(game) {
  const f = game.fishing, fi = f.fight, rng = game.rng.fork();
  let F = null;            // the live fight record (null between fights)
  let warnT = 0, runT = 0, toasted = false, pendingEnd = null;

  /** "Distance to the boat" for landing/progress: along the surface, so a fish under the tip counts as alongside. */
  const landDist = (fish) => Math.hypot(fish.x - game.boat.rod.tip.x, Math.max(0, fish.y - game.world.waves.heightAt(fish.x)));
  const emitRun = () => {
    if (runT > 0 || F.fish.visualLen < 50) return;
    runT = 2.5;
    game.events.emit('run', { fish: F.fish });
    f.tug = Math.max(f.tug, 0.5);
  };

  /** Begin (or re-begin, after a predator takes over) a fight with `fish`. */
  function start(fish, quality, keepMeters = false) {
    const sp = fish.species, tip = game.boat.rod.tip;
    const power = fishPower(fish);
    const prevMax = F ? F.maxTension : 0;
    F = {
      fish, style: sp.fight.style, item: sp.group === 'item', power, ratio: power / Math.max(0.5, game.player.stats.tackle || 1),
      T0: baseDuration(fish), mode: 'pull', modeT: 0, modeDur: 1.2, toward: false, zigT: 0, zigDir: 1, jumpPhase: null,
      shakeT: 0, airT: 0, reentryT: 0, tugT: 0, rocksT: 0, spike: 0, throwRisk: 0, heldT: 0, boltT: 0, startD: 0, maxTension: prevMax,
      slackMul: quality === 'perfect' ? 0.7 : quality === 'late' ? 1.4 : 1, landR: 70 + fish.visualLen * 0.45,
    };
    if (!keepMeters) {
      fi.time = 0;
      fi.snapMeter = 0;
      fi.slackMeter = 0;
      fi.progress = 0;
      fi.hookQuality = quality;
    }
    fi.stamina = F.item ? 0 : quality === 'perfect' ? 0.92 : 1; // a perfect strike rattles the fish
    fi.mode = 'pull';
    f.line.out = Math.hypot(fish.x - tip.x, fish.y - tip.y) + 12;
    F.startD = Math.max(F.landR + 40, landDist(fish));
    fi.slackBelow = SLACK_T;
    fi.warnAbove = 0.9 + 0.05 * clamp01(game.player.stats.rodControl || 0);
    fish.state = 'hooked';
    fish.controlled = true;
    f.reelRate = 0;
    pendingEnd = null;
    if (!F.item) {
      // the hook-set triggers an opening bolt from every fish that can run
      const menu = ['runner', 'jumper', 'darter'].includes(F.style) ? 'run' : F.style === 'diver' ? 'dive' : 'pull';
      F.mode = menu;
      F.modeDur = menu === 'run' ? 1.6 + rng.next() * 1.4 : 1.4;
      if (menu === 'run') emitRun();
    }
    if (F.ratio > 3 && !toasted && !F.item) {
      toasted = true;
      game.events.emit('toast', { text: 'This one is too strong for your tackle!', kind: 'warn' });
    }
  }

  /**
   * One frame. `reel` = the crank is held. Returns null while the fight goes on, else
   * { result: 'landed' | 'snapped' | 'escaped', reason }.
   */
  function update(dt, reel) {
    if (pendingEnd) return pendingEnd;
    const fish = F.fish, tip = game.boat.rod.tip, stats = game.player.stats, line = f.line;
    const rodControl = clamp01(stats.rodControl || 0), dragSmooth = clamp01(stats.dragSmooth || 0);
    fi.time += dt;
    F.modeT += dt;
    F.tugT += dt;
    F.boltT -= dt;
    warnT -= dt;
    runT -= dt;

    // ── behaviour ──
    if (!F.item && F.jumpPhase !== 'air' && F.modeT >= F.modeDur) {
      const prev = F.mode;
      nextMode(F, rng);
      if (F.mode === 'run' && prev !== 'run') emitRun();
      if (F.mode === 'thrash') f.tug = Math.max(f.tug, 0.4);
    }
    const tell = stepMotion(game, F, dt);
    const len = fish.visualLen, size = clamp(0.6 + len / 140, 0.6, 3);
    if (tell === 'surfaced') {
      game.events.emit('jump', { fish, x: fish.x, y: fish.y });
      game.events.emit('splash', { x: fish.x, y: game.world.waves.heightAt(fish.x), size, kind: 'jump' });
      if (len > 150) game.events.emit('shake', { amount: clamp(len / 900, 0.12, 0.35) });
      F.throwRisk = 0;
    } else if (tell === 'reentered') {
      game.events.emit('splash', { x: fish.x, y: game.world.waves.heightAt(fish.x), size: size * 1.1, kind: 'jump' });
      F.modeT = F.modeDur; // pick something new next frame
      F.reentryT = 0.4;
      F.spike += 0.12;
    } else if (tell === 'rocks') {
      F.spike += 0.38 * (1 - 0.5 * rodControl);
      game.events.emit('bubbles', { x: fish.x, y: fish.y + len * 0.2, n: 10 });
      game.events.emit('shake', { amount: 0.12 });
      f.tug = Math.max(f.tug, 0.7);
    }
    if (F.mode === 'thrash') f.tug = Math.max(f.tug, 0.25 * Math.abs(Math.sin(F.modeT * 28)));

    // ── the spool ──
    const e = effort(F, fi.stamina);
    const load = e.pull * F.ratio;
    const d0 = Math.hypot(fish.x - tip.x, fish.y - tip.y);
    const dragCap = DRAG + 0.08 * dragSmooth;
    const limit = spoolLimit(line, tip, game.world.waves.heightAt(tip.x));
    // a leaping fish takes line freely (the line never holds it up in the air)
    if (F.jumpPhase === 'air' && line.out < d0) line.out = Math.min(limit, d0);
    const geomSlack = clamp01((line.out - d0 - 10) / 60);
    let target;
    const airborne = F.jumpPhase === 'air';
    if (reel) {
      target = load + REEL_LOAD * (1 - 0.15 * dragSmooth);
      // cranking against a heavy load gains little line; slack comes in fast; nothing at all while it flies
      const gain = airborne ? 0 : clamp(1.2 - target, 0.12, 1);
      line.out = Math.max(0, line.out - stats.reelSpeed * gain * (geomSlack > 0 ? 3 : 1) * dt);
      f.reelRate = damp(f.reelRate, Math.max(0.1, gain) * clamp(stats.reelSpeed / 300, 0.4, 1), 10, dt);
    } else if (load > dragCap && line.out < limit && !airborne) {
      // the drag screams: line leaves the spool while the fish out-pulls it
      const strip = Math.min(Math.hypot(fish.vx, fish.vy) * 0.95 + 20, (load - dragCap) * 600);
      line.out = Math.min(limit, line.out + strip * dt);
      target = dragCap;
      f.reelRate = damp(f.reelRate, -clamp01(strip / 420), 10, dt);
    } else {
      target = load;
      f.reelRate = damp(f.reelRate, 0, 8, dt);
    }
    // end of the spool: the stop jolts the rod and the fish is held (it can't keep running)
    if (line.out >= limit - 0.5 && load > dragCap && !reel) {
      if (F.heldT === 0) {
        F.spike += 0.3 * clamp01(F.ratio - 0.4) * (1 - 0.5 * rodControl);
        f.tug = Math.max(f.tug, 0.8);
      }
      F.heldT += dt;
      if (F.heldT > 0.7 && F.mode === 'run') {
        F.mode = 'pull';
        F.modeT = 0;
        F.modeDur = 1.2;
      }
    } else F.heldT = 0;
    target = target * (1 - 0.92 * geomSlack) + 0.04;
    if (F.item) target = Math.min(target, 0.95); // dead weight is heavy but it never breaks the line by itself
    F.spike = damp(F.spike, 0, 4, dt);
    f.tension = damp(f.tension, target, 9 - 3 * dragSmooth, dt) + F.spike;
    const ten = f.tension;
    if (ten > F.maxTension) F.maxTension = ten;

    // ── meters ──
    if (ten > 1) {
      fi.snapMeter += (dt * (ten - 1)) / (SNAP_BAND + 0.25 * rodControl);
      if (warnT <= 0) {
        warnT = 0.7;
        game.events.emit('tensionWarn', { level: ten });
      }
    } else fi.snapMeter = Math.max(0, fi.snapMeter - dt * 0.5);
    if (fi.snapMeter >= 1) return { result: 'snapped' };
    // (easing off during a jump is the right move: a flying fish does not shake the hook by slack)
    F.reentryT -= dt;
    if (ten < SLACK_T && !F.item && !airborne && F.reentryT <= 0) fi.slackMeter += (dt * (1 - ten / SLACK_T) * (0.5 + 0.5 * e.activity) * F.slackMul) / SLACK_TIME;
    else fi.slackMeter = Math.max(0, fi.slackMeter - dt * 0.08);
    if (fi.slackMeter >= 1) return { result: 'escaped', reason: 'slack' };
    if (F.jumpPhase === 'air') {
      if (ten > 0.85) F.throwRisk += dt * (ten - 0.85) * 7;
      if (F.throwRisk >= 1) return { result: 'escaped', reason: 'jump' };
    }

    // ── stamina ──
    if (!F.item) {
      const lo = 0.55 - 0.08 * rodControl, hi = 0.9 + 0.05 * rodControl;
      const rate = ten < lo ? 0.15 + 0.85 * Math.pow(ten / lo, 1.5) : ten <= hi ? 1 : 0.85;
      // overkill tackle beats a fish quickly; an out-classed rod has to wait it out
      fi.stamina -= (dt * rate * MODES[F.mode].burn * clamp(Math.pow(1 / F.ratio, 0.5), 0.8, 2.2)) / F.T0;
      if (F.mode === 'rest' && ten < 0.2) fi.stamina += dt * 0.025; // it catches its breath on a slack line
      fi.stamina = clamp01(fi.stamina);
    }

    // ── line geometry, progress, landing ──
    // (the line never holds a fish up in the air: no constraint while it flies)
    let d = airborne ? Math.hypot(fish.x - tip.x, fish.y - tip.y) : constrainToLine(fish, tip, line.out);
    if (airborne && line.out < d) line.out = Math.min(limit, d);
    const surfMin = game.world.waves.heightAt(fish.x) + len * 0.2;
    if (F.jumpPhase !== 'air' && fish.y < surfMin) {
      // the line can't lift a fish out of the water: it stays at the surface and the reel can take no more
      fish.y = surfMin;
      d = Math.hypot(fish.x - tip.x, fish.y - tip.y);
      if (line.out < d) line.out = d;
    }
    const dl = landDist(fish);
    fi.progress = clamp01(1 - (dl - F.landR) / Math.max(1, F.startD - F.landR));
    fi.mode = F.mode;
    fi.warnAbove = 0.9 + 0.05 * rodControl;
    const beatenAt = 0.12 + 0.3 * clamp01((0.7 - F.ratio) / 0.5); // a strong rod just hauls small fish in
    const beaten = F.item || fi.stamina <= beatenAt || (F.style === 'floater' && fi.stamina < 0.45);
    if (dl <= F.landR && F.jumpPhase !== 'air') {
      // (the crank must be turning: a boat towed alongside a spent giant still has to bring it in)
      if (beaten && reel) return { result: 'landed' };
      if (F.boltT <= 0 && F.mode !== 'run' && F.mode !== 'jump') {
        // not beaten yet: it sees the boat and bolts
        F.mode = 'run';
        F.modeT = 0;
        F.modeDur = 1.4;
        F.boltT = 3;
        emitRun();
      }
    }
    // tow: mid fish nudge the hull, giants take it for a ride
    const big = clamp01((F.power - 3.5) / 6);
    f.tow.pull = ten * big * (0.5 + 0.5 * clamp01(len / 300)) * (1 - geomSlack);
    f.tow.x = Math.sign(fish.x - game.boat.x) * ten * big * 60 * (F.mode === 'run' ? 1.5 : 1) * (1 - geomSlack);
    f.tow.y = 14 * f.tow.pull;
    return null;
  }

  /** Fish AI: a predator reached the hooked fish. Returns true if it is now the one on the hook. */
  function strike(predator) {
    if (!F || F.item || F.jumpPhase === 'air' || !predator || predator === F.fish) return false;
    const prey = F.fish;
    if (predator.visualLen < prey.visualLen * 1.6 || predator.species.group === 'item') return false;
    const lure = LURES_BY_ID[f.lure.id] || LURES_BY_ID.worm;
    const m = predator.species.mouth;
    const took = m >= lure.hook[0] - 1 && m <= lure.hook[1] + 1 && rng.next() < 0.75;
    const size = clamp(0.8 + predator.visualLen / 160, 1, 3);
    game.events.emit('predatorStrike', { predator, prey, took });
    game.events.emit('splash', { x: prey.x, y: prey.y, size, kind: 'fish' });
    game.events.emit('bubbles', { x: prey.x, y: prey.y, n: 18 });
    game.events.emit('shake', { amount: took ? 0.45 : 0.3 });
    predator.x = prey.x;
    predator.y = Math.max(prey.y, game.world.waves.heightAt(prey.x) + predator.visualLen * 0.25);
    game.fish.remove(prey);
    if (!took) {
      pendingEnd = { result: 'escaped', reason: 'thrown' };
      return false;
    }
    predator.controlled = true;
    f.hooked = predator;
    start(predator, fi.hookQuality, true);
    f.tug = 1;
    F.spike += 0.25;
    return true;
  }

  return {
    start, update, strike,
    /** The live record (bot/debug + the landing cinematic read it). */
    record: () => F,
    clear() { F = null; pendingEnd = null; f.tow.x = f.tow.y = f.tow.pull = 0; },
  };
}
