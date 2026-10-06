// The lure in the water ('waiting'): sinking, reeling, twitching, the seabed and the line-length constraint.
// GAMEPLAY helper (used by src/gameplay/fishing.js).
import { clamp, damp } from '../core/math.js';
import { LURES_BY_ID } from '../data/lures.js';
import { buildLine, lureAngle, spoolLimit } from './fishing-line.js';

const ARRIVE_OUT = 34;      // px of line left → the lure is back at the tip
const SLACK_KEEP = 8;       // px of slack the reel leaves when it stops taking line
const GRAVITY = 900;

export function createLureSim(game) {
  const f = game.fishing, L = f.lure, line = f.line;
  let onBottom = false;

  /**
   * One step of the lure in the water.
   *  cmd = { reel (crank held), reelSpeed px/s, free (spool open: sinks and pays out line) }
   * Returns 'retrieved' once the lure is back at the rod tip, else null.
   */
  function step(cmd, dt) {
    const tip = game.boat.rod.tip, boat = game.boat;
    const terrain = game.world.terrain, waves = game.world.waves;
    const def = LURES_BY_ID[L.id] || LURES_BY_ID.worm;
    const sinkV = def.sink * (1 + (game.player.stats.sinkBonus || 0));
    let dx = L.x - tip.x, dy = L.y - tip.y, d = Math.hypot(dx, dy) || 1;
    const inWater = L.y > waves.heightAt(L.x);
    const limit = spoolLimit(line, tip, waves.heightAt(tip.x));

    if (cmd.reel) {
      // the reel takes line at reelSpeed; slack comes in three times as fast (cranking with no load)
      line.out = Math.max(0, line.out - cmd.reelSpeed * (onBottom ? 0.75 : 1) * dt);
      if (line.out > d + SLACK_KEEP) line.out = Math.max(d + SLACK_KEEP, line.out - cmd.reelSpeed * 2 * dt);
      f.reelRate = damp(f.reelRate, clamp(cmd.reelSpeed / 300, 0.45, 1), 10, dt);
      // pulled toward the tip along the line while still sinking a little: it rises on a natural arc
      const ux = -dx / d, uy = -dy / d;
      const want = cmd.reelSpeed * 1.08;
      if (onBottom && -uy < 0.72) {
        // a shallow line angle drags the lure along the seabed instead of lifting it
        L.vx = damp(L.vx, Math.sign(ux) * want * 0.8, 7, dt);
        L.vy = damp(L.vy, 0, 7, dt);
      } else {
        L.vx = damp(L.vx, ux * want, 7, dt);
        L.vy = damp(L.vy, uy * want + (inWater ? sinkV * 0.35 : 0), 7, dt);
      }
    } else {
      f.reelRate = damp(f.reelRate, 0, 9, dt);
      if (inWater) {
        // water: terminal sink speed on a free spool; an engaged reel holds the lure at its depth
        L.vy = damp(L.vy, cmd.free ? sinkV : 0, 2.6, dt);
        L.vx = damp(L.vx, 0, 2.2, dt);
        if (cmd.free) line.out = Math.min(limit, Math.max(line.out, d + SLACK_KEEP));
      } else {
        L.vy += GRAVITY * dt;
        L.vx *= Math.max(0, 1 - 0.3 * dt);
      }
    }
    L.x += L.vx * dt;
    L.y += L.vy * dt;
    L.x = clamp(L.x, 30, game.world.width - 30);

    // seabed: settles, can be dragged along it
    const floor = terrain.heightAt(L.x) - 3;
    if (L.y >= floor) {
      L.y = floor;
      if (L.vy > 0) L.vy = 0;
      if (!cmd.reel) L.vx *= Math.max(0, 1 - 5 * dt);
      if (!onBottom) {
        onBottom = true;
        game.events.emit('lureBottom', { x: L.x, y: L.y });
        f.tug = Math.max(f.tug, 0.25);
      }
    } else if (L.y < floor - 14) onBottom = false;

    // line-length constraint: never farther from the tip than the line that is out → pendulum under the tip
    dx = L.x - tip.x;
    dy = L.y - tip.y;
    d = Math.hypot(dx, dy) || 1;
    if (d > line.out) {
      const k = line.out / d;
      L.x = tip.x + dx * k;
      L.y = tip.y + dy * k;
      const ux = dx / d, uy = dy / d;
      const vr = L.vx * ux + L.vy * uy;
      if (vr > 0) {
        L.vx -= vr * ux;
        L.vy -= vr * uy;
        // running out of spool with the lure still sinking: the rod tip feels the stop
        if (cmd.free && line.out >= limit - 1 && vr > 50) f.tug = Math.max(f.tug, 0.35);
      }
      d = line.out;
    }

    // water entry / exit
    const nowIn = L.y > waves.heightAt(L.x);
    if (nowIn !== L.inWater) {
      L.inWater = nowIn;
      game.events.emit('splash', { x: L.x, y: waves.heightAt(L.x), size: 0.35, kind: 'lure' });
    }
    L.speed = Math.hypot(L.vx, L.vy);
    L.depthM = Math.max(0, L.y) / 8;
    if (cmd.reel && (line.out <= ARRIVE_OUT || d <= 28)) return 'retrieved';

    buildLine(line, tip, L.x, L.y, line.out - d, nowIn ? 'water' : 'air', -Math.sign(boat.vx));
    L.angle = lureAngle(line, L);
    return null;
  }

  /** A jig: short dart toward the rod tip and up. */
  function twitch() {
    const tip = game.boat.rod.tip;
    const dx = tip.x - L.x, dy = tip.y - L.y, d = Math.hypot(dx, dy) || 1;
    L.vx += (dx / d) * 190;
    L.vy += (dy / d) * 190 - 50;
    L.twitchT = 0;
    f.tug = Math.max(f.tug, 0.45);
    game.events.emit('twitch', { x: L.x, y: L.y });
    if (L.inWater) game.fx.bubbles(L.x, L.y, 3);
  }

  function reset() {
    onBottom = false;
  }

  return { step, twitch, reset, onBottom: () => onBottom };
}
