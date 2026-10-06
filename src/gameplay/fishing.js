// The fishing state machine — "the feel" of fishing. GAMEPLAY module.
//
//   idle → charging → casting → waiting → bite → fight → landing → caught → idle   (+ 'broken' after a loss)
//
// Mutates game.fishing (shape: src/gameplay/state.js) and owns the hooked fish's body from the bite until it is
// released or landed. Draws nothing: boat art, effects, UI and audio render from this state and the events.
// Extra fields this module ADDS to game.fishing (all documented in the final report):
//   tug 0..1        impulse for the rod tip (twitch, nibble, bite tugs, rocks) — decays by itself
//   tow {x,y,pull}  force of the hooked fish on the hull: x px/s², y px of extra draft, pull 0..1 heel
//   retrieving      R was pressed: auto-reel until the lure is in
//   castPower       power of the last cast 0..1
//   hookDepthM      depth (m) at which the current fish was hooked (reported in 'catch')
import { SURFACE_CAM_Y } from '../core/camera.js';
import { zoneAt } from '../core/config.js';
import { clamp, clamp01, damp, lerp, ease, smoothstep } from '../core/math.js';
import { RIG, boatToWorld } from '../entities/rig.js';
import { orientFish } from '../entities/fishbase.js';
import { mouthOffset } from '../render/bestiary.js';
import { castRange, launchVelocity, flyStep, buildLine, lureAngle, spoolLimit } from './fishing-line.js';
import { createLureSim } from './fishing-lure.js';
import { createFight } from './fishing-fight.js';

const CHARGE_PERIOD = 1.9; // s for the cast meter to swing 0 → 1 → 0 (learnable ping-pong)
const WHIP = 0.16;         // s the lure rides the rod tip while the rod whips forward
const TAP = 0.17;          // an ACTION press shorter than this on a lure in the water is a jig twitch
const BITE_TUG_HZ = 6.5;
const LANDING_T = 1.35;
const CAUGHT_AUTO = 2.5;   // s before the catch auto-dismisses when no UI is around
const CAUGHT_MAX = 20;     // safety: never stay in 'caught' longer than this
const BROKEN_T = 1.5;

export function createFishing(game) {
  const f = game.fishing, L = f.lure, line = f.line, boat = game.boat;
  const lureSim = createLureSim(game);
  const fight = createFight(game);
  const tmp = { x: 0, y: 0 }, tmp2 = { x: 0, y: 0 };
  let holdT = 0, spoolBeforeHold = true; // ACTION hold bookkeeping (tap vs hold)
  let chargeT = 0, flying = false;
  let zone = null;
  let dismissed = false, scored = false;
  let landing = null, brokenKind = 'snapped';

  // ── extra state + the LIFE → GAMEPLAY handshake ──
  f.tug = 0;
  f.tow = { x: 0, y: 0, pull: 0 };
  f.retrieving = false;
  f.castPower = 0;
  f.hookDepthM = 0;
  f.fishBite = fishBite;
  f.predatorStrike = (p) => (f.state === 'fight' ? fight.strike(p) : false);
  f.canAttract = () => f.state === 'waiting' && L.inWater;
  game.events.on('catchDismissed', () => { dismissed = true; });
  game.events.on('catchScored', () => { scored = true; });
  // a fish pecking at the lure (fish AI) twitches the rod tip and the lure
  game.events.on('nibble', () => {
    if (f.state !== 'waiting') return;
    f.tug = Math.max(f.tug, 0.45);
    L.vy -= 40;
    L.vx += (game.rng.next() - 0.5) * 80;
  });

  function setState(s) {
    if (f.state === s) return;
    const from = f.state;
    f.state = s;
    f.stateT = 0;
    game.events.emit('state', { from, to: s });
  }
  const surfaceAt = (x) => game.world.waves.heightAt(x);
  function trackZone(y) {
    const z = zoneAt(Math.max(0, y)).id;
    if (zone && z !== zone) game.events.emit('zone', { from: zone, to: z });
    zone = z;
  }
  function lineIn() {
    L.visible = false;
    L.inWater = false;
    L.speed = 0;
    line.points.length = 0;
    line.out = 0;
    line.slack = 0;
    f.reeling = false;
    f.retrieving = false;
    f.spoolFree = true;
    zone = null;
  }

  // ── idle: sail, pick lures, start a cast ──
  function selectLure(id) {
    if (game.progression && typeof game.progression.selectLure === 'function') game.progression.selectLure(id);
    else game.player.lureId = id;
  }
  function updateIdle(dt) {
    const inp = game.input, p = game.player;
    lineIn();
    f.tension = damp(f.tension, 0, 6, dt);
    f.reelRate = damp(f.reelRate, 0, 8, dt);
    L.x = boat.rod.tip.x;
    L.y = boat.rod.tip.y + 12;
    const lures = p.lures || [];
    for (let i = 1; i <= 9; i++) if (inp.pressed('lure' + i) && lures[i - 1]) selectLure(lures[i - 1]);
    if (inp.pressed('lureNext') && lures.length > 1) selectLure(lures[(Math.max(0, lures.indexOf(p.lureId)) + 1) % lures.length]);
    if (inp.pressed('action')) {
      chargeT = 0;
      f.charge = 0;
      setState('charging');
      game.events.emit('castCharge', {});
    }
  }

  // ── charging → casting ──
  function updateCharging(dt) {
    chargeT += dt;
    f.charge = 0.5 - 0.5 * Math.cos((chargeT * Math.PI * 2) / CHARGE_PERIOD);
    if (game.input.released('action') || !game.input.down('action')) cast(f.charge);
  }
  function cast(power) {
    f.castPower = clamp(power, 0.06, 1);
    f.charge = f.castPower;
    L.id = game.player.lureId;
    L.visible = true;
    L.inWater = false;
    L.twitchT = 99;
    L.vx = L.vy = 0;
    line.out = 0;
    flying = false;
    lureSim.reset();
    setState('casting');
    game.events.emit('cast', { power: f.castPower });
  }
  function updateCasting(dt) {
    const tip = boat.rod.tip;
    if (!flying) {
      // the lure rides the tip through the whip, then leaves it ballistically
      L.x = tip.x;
      L.y = tip.y;
      line.points.length = 0;
      if (f.stateT >= WHIP) {
        flying = true;
        // a short line caps the cast: you can't throw farther than the spool reaches
        const gap = Math.max(0, surfaceAt(tip.x) - tip.y), limit = spoolLimit(line, tip, surfaceAt(tip.x));
        const maxRange = Math.sqrt(Math.max(1, limit * limit - gap * gap)) * 0.96;
        const v = launchVelocity(Math.min(maxRange, castRange(f.castPower) * (game.player.stats.castPower || 1)), boat.facing);
        L.vx = v.vx + boat.vx * 0.5;
        L.vy = v.vy;
      }
      return;
    }
    flyStep(L, dt);
    let dx = L.x - tip.x, dy = L.y - tip.y, d = Math.hypot(dx, dy);
    const limit = spoolLimit(line, tip, surfaceAt(tip.x));
    if (d > limit) {
      // out of line in mid-air: the lure is yanked short
      const k = limit / d;
      L.x = tip.x + dx * k;
      L.y = tip.y + dy * k;
      L.vx *= 0.2;
      d = limit;
      f.tug = Math.max(f.tug, 0.5);
    }
    line.out = Math.min(limit, d + 4);
    L.speed = Math.hypot(L.vx, L.vy);
    buildLine(line, tip, L.x, L.y, 6 + d * 0.012, 'air');
    L.angle = lureAngle(line, L);
    const surf = surfaceAt(L.x), floor = game.world.terrain.heightAt(L.x) - 3;
    if (L.y >= surf || L.y >= floor) {
      if (L.y >= surf && surf < floor) {
        L.y = surf;
        L.inWater = true;
        L.vy *= 0.25;
        L.vx *= 0.4;
        game.events.emit('lureSplash', { x: L.x, y: surf, speed: L.speed });
        zone = zoneAt(0).id;
      } else {
        // it landed on the beach
        L.y = floor;
        L.vx = L.vy = 0;
        game.events.emit('lureBottom', { x: L.x, y: L.y });
      }
      f.spoolFree = true;
      f.reeling = false;
      f.retrieving = false;
      holdT = 0;
      setState('waiting');
    }
  }

  // ── waiting: sink / reel / twitch / retrieve ──
  function updateWaiting(dt) {
    const inp = game.input;
    L.twitchT += dt;
    if (inp.pressed('action')) {
      holdT = 0;
      spoolBeforeHold = f.spoolFree;
    }
    const held = inp.down('action');
    if (held) holdT += dt;
    if (inp.released('action') && holdT < TAP) {
      lureSim.twitch();
      f.spoolFree = spoolBeforeHold; // a jig does not engage the reel
    }
    if (inp.pressed('retrieve')) f.retrieving = true;
    if (inp.down('down')) {
      f.spoolFree = true;
      f.retrieving = false;
    }
    const reel = held || f.retrieving;
    if (held) f.spoolFree = false; // engaging the reel closes the spool: the lure holds its depth afterwards
    f.reeling = reel;
    const res = lureSim.step({ reel, reelSpeed: game.player.stats.reelSpeed || 300, free: f.spoolFree && !reel }, dt);
    if (res === 'retrieved') {
      lineIn();
      setState('idle');
      game.events.emit('retrieved', {});
      return;
    }
    if (L.inWater) trackZone(L.y);
  }

  // ── bite: the hook-set window ──
  function fishBite(fish) {
    if (f.state !== 'waiting' || !L.inWater || !fish || fish.controlled || fish === f.hooked) return false;
    const tip = boat.rod.tip;
    fish.controlled = true;
    f.hooked = fish;
    f.hookDepthM = L.depthM;
    f.reeling = false;
    f.retrieving = false;
    f.spoolFree = false;
    f.reelRate = 0;
    const mo = mouthOffset(fish, tmp);
    fish.x = L.x - mo.x;
    fish.y = L.y - mo.y;
    fish.vx = fish.vy = 0;
    if (fish.species.group === 'item') {
      // junk and treasure never bite: the hook snags them and they come up as dead weight
      game.events.emit('bite', { fish });
      setHook('good');
      return true;
    }
    fish.state = 'bite';
    fish.mouth = 0.7;
    f.biteT = 0;
    f.biteWindow = fish.species.biteWindow + (game.player.stats.hookWindowBonus || 0);
    f.tug = 0.9;
    line.out = Math.max(line.out, Math.hypot(fish.x - tip.x, fish.y - tip.y) + 4);
    setState('bite');
    game.events.emit('bite', { fish });
    return true;
  }
  function updateBite(dt) {
    const fish = f.hooked, tip = boat.rod.tip;
    f.biteT += dt;
    const k = f.biteT / Math.max(0.05, f.biteWindow);
    const tugPhase = Math.max(0, Math.sin(f.biteT * BITE_TUG_HZ * Math.PI * 2));
    f.tug = Math.max(f.tug, 0.3 + 0.4 * tugPhase);
    // the fish worries the lure: short jerks away from the boat, head shaking
    const away = fish.x >= tip.x ? 1 : -1;
    fish.vx = away * 45 * (0.4 + 0.6 * tugPhase);
    fish.vy = Math.sin(f.biteT * 9) * 14;
    fish.x += fish.vx * dt;
    fish.y = clamp(fish.y + fish.vy * dt, surfaceAt(fish.x) + fish.visualLen * 0.2, game.world.terrain.heightAt(fish.x) - fish.visualLen * 0.22);
    orientFish(fish, dt);
    fish.swimAmp = Math.max(fish.swimAmp, 0.9);
    const mo = mouthOffset(fish, tmp);
    L.x = fish.x + mo.x;
    L.y = fish.y + mo.y;
    L.vx = fish.vx;
    L.vy = fish.vy;
    L.speed = Math.hypot(fish.vx, fish.vy);
    L.depthM = Math.max(0, L.y) / 8;
    const d = Math.hypot(L.x - tip.x, L.y - tip.y);
    line.out = Math.max(line.out, d + 4);
    buildLine(line, tip, L.x, L.y, line.out - d, 'water', -Math.sign(boat.vx));
    L.angle = lureAngle(line, L);
    f.tension = damp(f.tension, 0.22 + 0.25 * tugPhase, 12, dt);
    if (game.input.pressed('action')) {
      setHook(k < 0.3 ? 'perfect' : k < 0.8 ? 'good' : 'late');
      return;
    }
    if (f.biteT >= f.biteWindow) {
      game.events.emit('hookMiss', { fish });
      game.fish.release(fish, 'missed');
      fish.controlled = false;
      f.hooked = null;
      f.tug = 0.3;
      f.tension = 0.1;
      setState('waiting');
    }
  }
  function setHook(quality) {
    const fish = f.hooked;
    game.events.emit('hookSet', { fish, quality });
    game.events.emit('shake', { amount: 0.15 + 0.25 * clamp01(fish.visualLen / 320) });
    game.fx.bubbles(L.x, L.y, 6);
    fight.start(fish, quality);
    L.visible = false;
    f.tug = 1;
    f.tension = 0.5;
    setState('fight');
    game.events.emit('fightStart', { fish });
  }
  // ── fight ──
  function updateFight(dt) {
    const fish = f.hooked, tip = boat.rod.tip;
    const reel = game.input.down('action');
    f.reeling = reel;
    f.spoolFree = false;
    const res = fight.update(dt, reel);
    const mo = mouthOffset(fish, tmp);
    L.x = fish.x + mo.x;
    L.y = fish.y + mo.y;
    L.vx = fish.vx;
    L.vy = fish.vy;
    L.speed = Math.hypot(fish.vx, fish.vy);
    L.depthM = Math.max(0, L.y) / 8;
    L.inWater = fish.state !== 'jump';
    const d = Math.hypot(L.x - tip.x, L.y - tip.y);
    // under tension the drawn line is taut even if the spool is a little ahead of the geometry
    const extra = Math.max(0, line.out - d) * (1 - clamp01(f.tension / 0.6)) + (1 - clamp01(f.tension / 0.35)) * 18;
    buildLine(line, tip, L.x, L.y, extra, L.inWater ? 'water' : 'air', -Math.sign(boat.vx));
    L.angle = lureAngle(line, L);
    trackZone(fish.y);
    if (res) endFight(res);
  }
  function endFight(res) {
    const fish = f.hooked;
    if (res.result === 'landed') {
      startLanding();
      return;
    }
    f.streak = 0;
    if (res.result === 'snapped') {
      game.events.emit('lineSnap', { fish, x: L.x, y: L.y });
      game.events.emit('shake', { amount: 0.35 });
    } else game.events.emit('escape', { fish, reason: res.reason });
    game.events.emit('fightEnd', { fish, result: res.result });
    if (res.reason !== 'thrown') {
      // (a prey bitten off by a predator is already gone)
      game.fish.release(fish, res.result === 'snapped' ? 'snapped' : 'escaped');
      fish.controlled = false;
    }
    brokenKind = res.result;
    fight.clear();
    f.hooked = null;
    f.reeling = false;
    f.reelRate = 0;
    f.tension = res.result === 'snapped' ? 0 : 0.1;
    f.fight.mode = 'rest';
    // snapped: the lure is gone with the fish; escaped: the lure is still on, the limp line comes back
    L.visible = res.result !== 'snapped';
    L.vx = L.vy = 0;
    setState('broken');
  }
  function updateBroken(dt) {
    const tip = boat.rod.tip;
    f.tension = damp(f.tension, 0, 8, dt);
    f.tow.x = f.tow.y = f.tow.pull = 0;
    if (brokenKind === 'snapped') {
      line.points.length = 0;
      line.out = 0;
    } else {
      // limp line: the lure swings back to the tip with no load on it
      line.out = Math.max(0, line.out - 1100 * dt);
      const dx = L.x - tip.x, dy = L.y - tip.y, d = Math.hypot(dx, dy) || 1;
      if (d > line.out) {
        L.x = tip.x + (dx / d) * line.out;
        L.y = tip.y + (dy / d) * line.out;
      }
      L.inWater = L.y > surfaceAt(L.x);
      L.depthM = Math.max(0, L.y) / 8;
      if (line.out > 40) {
        buildLine(line, tip, L.x, L.y, 60, L.inWater ? 'water' : 'air', -Math.sign(boat.vx));
        L.angle = lureAngle(line, L);
      } else {
        L.visible = false;
        line.points.length = 0;
      }
    }
    if (f.stateT >= BROKEN_T) {
      lineIn();
      setState('idle');
    }
  }

  // ── landing → caught ──
  function startLanding() {
    const fish = f.hooked, rec = fight.record();
    landing = { x0: fish.x, y0: fish.y, giant: fish.visualLen > 330, out: false, fightTime: f.fight.time, maxTension: rec ? rec.maxTension : f.tension };
    fight.clear();
    f.reeling = false;
    f.reelRate = 0;
    f.fight.progress = 1;
    f.fight.mode = 'rest';
    setState('landing');
  }
  function holdAlongside(fish, dt) {
    // giants are brought alongside at the surface instead of lifted
    const tx = boat.x + boat.facing * (RIG.hullLength * 0.5 + fish.visualLen * 0.42);
    const ty = surfaceAt(tx) + fish.visualLen * 0.16;
    fish.vx = (tx - fish.x) * 3;
    fish.vy = (ty - fish.y) * 3;
    fish.x = damp(fish.x, tx, 3, dt);
    fish.y = damp(fish.y, ty, 3, dt);
    orientFish(fish, dt);
    fish.swimAmp = damp(fish.swimAmp, 0.35, 3, dt);
    fish.mouth = damp(fish.mouth, 0.3, 4, dt);
  }
  function holdTrophy(fish, dt, k) {
    const p = boatToWorld(boat, RIG.trophy.x, RIG.trophy.y, tmp2);
    const lift = Math.sin(k * Math.PI) * (70 + fish.visualLen * 0.35);
    fish.x = lerp(landing.x0, p.x, k);
    fish.y = lerp(landing.y0, p.y - fish.visualLen * 0.1, k) - lift;
    fish.vx = fish.vy = 0;
    fish.dir = damp(fish.dir, boat.facing, 10, dt);
    fish.pitch = damp(fish.pitch, -1.45, 7, dt);
    fish.swimPhase += dt * 9;
    fish.swimAmp = damp(fish.swimAmp, 0.55, 4, dt);
    fish.mouth = damp(fish.mouth, 0.35, 4, dt);
  }
  function updateLanding(dt) {
    const fish = f.hooked, tip = boat.rod.tip;
    const k = ease.inOutSine(clamp01(f.stateT / LANDING_T));
    f.tension = damp(f.tension, 0.45 + 0.2 * Math.sin(f.stateT * 14), 8, dt);
    if (landing.giant) holdAlongside(fish, dt);
    else {
      holdTrophy(fish, dt, k);
      if (!landing.out && fish.y < surfaceAt(fish.x) - fish.visualLen * 0.08) {
        landing.out = true;
        fish.state = 'landed';
        game.events.emit('splash', { x: fish.x, y: surfaceAt(fish.x), size: clamp(0.8 + fish.visualLen / 140, 0.8, 2.5), kind: 'land' });
        game.events.emit('shake', { amount: 0.08 + 0.12 * clamp01(fish.visualLen / 330) });
      }
    }
    const mo = mouthOffset(fish, tmp);
    L.x = fish.x + mo.x;
    L.y = fish.y + mo.y;
    L.inWater = L.y > surfaceAt(L.x);
    line.out = Math.hypot(L.x - tip.x, L.y - tip.y);
    buildLine(line, tip, L.x, L.y, 2, L.inWater ? 'water' : 'air');
    if (f.stateT >= LANDING_T) finishLanding();
  }
  function finishLanding() {
    const fish = f.hooked;
    if (!landing.giant) fish.state = 'landed';
    f.streak += 1;
    game.events.emit('landed', { fish });
    f.lastCatch = { fish, hookQuality: f.fight.hookQuality, fightTime: landing.fightTime, maxTension: landing.maxTension, streak: f.streak, depthM: f.hookDepthM };
    dismissed = false;
    scored = false;
    setState('caught');
    game.events.emit('catch', f.lastCatch);
  }
  function updateCaught(dt) {
    const fish = f.hooked;
    if (fish) {
      if (landing.giant) holdAlongside(fish, dt);
      else holdTrophy(fish, dt, 1);
      line.points.length = 0;
      line.out = 0;
    }
    f.tension = damp(f.tension, 0, 5, dt);
    const noCard = !game.mods.ui || (f.stateT > 1.2 && !scored);
    if (dismissed || (noCard && f.stateT >= CAUGHT_AUTO) || f.stateT >= CAUGHT_MAX) {
      if (fish) game.fish.remove(fish);
      f.hooked = null;
      lineIn();
      setState('idle');
    }
  }

  // ── camera ──
  function updateCamera() {
    if (game.mode !== 'play' || game.camera.free) return;
    const face = boat.facing, fish = f.hooked;
    let x = boat.x + face * 180 + boat.vx * 0.6, y = SURFACE_CAM_Y, zoom = 1;
    switch (f.state) {
      case 'casting':
        x = lerp(boat.x + face * 180, L.x, 0.5);
        y = lerp(SURFACE_CAM_Y, Math.max(L.y, SURFACE_CAM_Y), 0.35);
        break;
      case 'waiting':
      case 'bite': {
        // the lure, with more water below it than above; while it is shallow keep the boat in the frame too
        zoom = clamp(1 - (Math.abs(L.x - boat.x) - 520) / 2200, 0.82, 1);
        const span = L.y + 330, viewH = game.view.h / zoom;
        const both = 1 - smoothstep(0.55 * viewH, 0.9 * viewH, span);
        x = lerp(boat.x + face * 120, L.x, 0.6);
        y = Math.max(SURFACE_CAM_Y, lerp(L.y + 150, (L.y - 330) / 2 + 70, both));
        break;
      }
      case 'fight': {
        const big = fish.visualLen, run = f.fight.mode === 'run' || f.fight.mode === 'jump';
        const near = 1 - clamp01(Math.hypot(fish.x - boat.x, fish.y - boat.y) / 650);
        x = lerp(fish.x + fish.vx * 0.35, (fish.x + boat.x) / 2, near * 0.6);
        y = lerp(fish.y + fish.vy * 0.25 + 40, Math.max(SURFACE_CAM_Y, (fish.y + boat.y) / 2), near * 0.6);
        zoom = clamp(1.08 - big / 800, 0.62, 1.1) * (run ? 0.9 : 1);
        if (big < 60) zoom = 1.15;
        break;
      }
      case 'landing':
      case 'caught':
        x = boat.x + face * 150;
        y = SURFACE_CAM_Y - 30;
        zoom = landing && landing.giant ? 0.8 : 1.1;
        break;
      default:
        break;
    }
    game.camera.setTarget(x, y, zoom);
  }

  function update(dt) {
    if (dt <= 0) return;
    f.stateT += dt;
    f.tug = damp(f.tug, 0, 7, dt);
    line.max = (game.player.stats.lineLengthM || 60) * 8;
    // total line that can actually be off the spool right now (spool + the air gap rod tip → water); the UI bars use it
    line.limit = spoolLimit(line, game.boat.rod.tip, surfaceAt(game.boat.rod.tip.x));
    if (f.state === 'idle' || f.state === 'charging' || f.state === 'casting') L.id = game.player.lureId || L.id;
    switch (f.state) {
      case 'idle': updateIdle(dt); break;
      case 'charging': updateCharging(dt); break;
      case 'casting': updateCasting(dt); break;
      case 'waiting': updateWaiting(dt); break;
      case 'bite': updateBite(dt); break;
      case 'fight': updateFight(dt); break;
      case 'landing': updateLanding(dt); break;
      case 'caught': updateCaught(dt); break;
      case 'broken': updateBroken(dt); break;
      default: setState('idle');
    }
    if (f.state !== 'fight') f.tow.x = f.tow.y = f.tow.pull = 0;
    updateCamera();
  }

  /** Dev/bot: drop whatever is going on (releases the hooked fish) and go back to 'idle'. */
  function abort() {
    const fish = f.hooked;
    if (fish) {
      if (f.state === 'caught' || f.state === 'landing') game.fish.remove(fish);
      else {
        game.fish.release(fish, 'escaped');
        fish.controlled = false;
      }
    }
    fight.clear();
    f.hooked = null;
    f.tension = 0;
    f.tow.x = f.tow.y = f.tow.pull = 0;
    lineIn();
    setState('idle');
  }

  return { update, abort, /** debug/bot access to the live fight record */ fight };
}
