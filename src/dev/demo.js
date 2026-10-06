// Dev-only scripted states, so art / UI / audio can be built and screenshotted before (or without) real gameplay.
// KERNEL FILE.   ?demo=idle|charge|cast|wait|bite|fight|deep|caught   &fish=<speciesId> &sizeQ=0.7 &depth=<px>
//                ?spawn=great_white:2,clownfish:12   (drops fish into view; they just cruise back and forth)
import { SURFACE_CAM_Y } from '../core/camera.js';
import { clamp, lerp } from '../core/math.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { createFish, orientFish } from '../entities/fishbase.js';
import { computeRod, boatToWorld, RIG } from '../entities/rig.js';
import { mouthOffset } from '../render/bestiary.js';

export function createDemo(game) {
  const flags = game.flags;
  const mode = flags.demo || null;
  const spawnSpec = flags.spawn || null;
  const dummies = [];
  let spawned = false;
  let fish = null;
  let t = 0;
  let lastState = '';
  const tmp = { x: 0, y: 0 };

  function setState(s) {
    const f = game.fishing;
    if (f.state !== s) {
      const from = f.state;
      f.state = s;
      f.stateT = 0;
      game.events.emit('state', { from, to: s });
    }
  }
  function setPose(p) {
    const b = game.boat;
    if (b.pose !== p) {
      b.pose = p;
      b.poseT = 0;
    }
  }
  function linePoints(x1, y1, sag) {
    const f = game.fishing, tip = game.boat.rod.tip, n = 18;
    f.line.points.length = 0;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      f.line.points.push({ x: lerp(tip.x, x1, k), y: lerp(tip.y, y1, k) + Math.sin(k * Math.PI) * sag });
    }
    f.line.out = Math.hypot(x1 - tip.x, y1 - tip.y);
  }
  function ensureFish() {
    if (fish) return fish;
    const sp = SPECIES_BY_ID[flags.fish] || SPECIES_BY_ID.yellowtail_snapper;
    fish = createFish(sp, { sizeQ: flags.sizeQ !== undefined ? Number(flags.sizeQ) : 0.6, rng: game.rng });
    fish.controlled = true;
    game.fish.list.push(fish);
    return fish;
  }

  function spawnDummies() {
    spawned = true;
    const b = game.camera.bounds, terr = game.world.terrain;
    for (const part of spawnSpec.split(',')) {
      const [id, nStr] = part.split(':');
      const sp = SPECIES_BY_ID[id];
      if (!sp) continue;
      const n = Number(nStr || 1);
      for (let i = 0; i < n; i++) {
        const x = lerp(b.left + 80, b.right - 80, game.rng.next());
        const floor = Math.min(terr.heightAt(x) - 40, b.bottom - 60);
        const top = Math.max(60, b.top + 60);
        let y = lerp(top, Math.max(top + 20, floor), game.rng.next());
        if (sp.layer === 'benthic') y = terr.heightAt(x) - 8;
        if (sp.layer === 'surface') y = Math.max(top, 30) + game.rng.next() * 80;
        const fi = createFish(sp, { x, y, rng: game.rng, sizeQ: flags.sizeQ !== undefined ? Number(flags.sizeQ) : undefined });
        fi.ai = { baseY: y, sp: (34 + game.rng.next() * 30) * (sp.speed || 0.5), ph: game.rng.next() * 6.28 };
        if (flags.shiny === '1') fi.shiny = true;
        dummies.push(fi);
        game.fish.list.push(fi);
      }
    }
  }
  function updateDummies(dt) {
    const b = game.camera.bounds;
    for (const fi of dummies) {
      if (fi.controlled) continue;
      const a = fi.ai;
      const want = fi.dir >= 0 ? 1 : -1;
      if (fi.x > b.right - 40) fi.vx = -a.sp;
      else if (fi.x < b.left + 40) fi.vx = a.sp;
      else if (Math.abs(fi.vx) < 1) fi.vx = want * a.sp;
      fi.vy = Math.sin(game.time.now * 0.6 + a.ph) * a.sp * 0.18 + (a.baseY - fi.y) * 0.4;
      if (fi.species.speed === 0) {
        fi.vx = 0;
        fi.vy = 0;
      }
      fi.x += fi.vx * dt;
      fi.y += fi.vy * dt;
      orientFish(fi, dt);
    }
  }

  function update(dt) {
    t += dt;
    if (spawnSpec && !spawned) spawnDummies();
    if (dummies.length) updateDummies(dt);
    if (!mode) return;

    const boat = game.boat, f = game.fishing, waves = game.world.waves, cam = game.camera;
    boat.y = waves.heightAt(boat.x) * 0.8;
    boat.tilt = Math.atan(waves.slopeAt(boat.x)) * 0.6;
    boat.poseT += dt;
    f.stateT += dt;
    f.lure.twitchT += dt;
    f.line.max = game.player.stats.lineLengthM * 8;
    const face = boat.facing;
    let camX = boat.x + 180 * face, camY = SURFACE_CAM_Y, zoom = 1;

    if (mode === 'idle') {
      setState('idle');
      setPose('idle');
      boat.rodAngle = 0.95 + Math.sin(t * 1.2) * 0.02;
      boat.rodBend = 0.04;
      f.lure.visible = false;
      f.line.points.length = 0;
    } else if (mode === 'charge') {
      setState('charging');
      setPose('charge');
      f.charge = 0.5 - 0.5 * Math.cos(t * 2.2);
      boat.rodAngle = lerp(0.95, 2.15, f.charge);
      boat.rodBend = 0.05;
      f.lure.visible = false;
      f.line.points.length = 0;
    } else if (mode === 'cast') {
      const cyc = t % 3.4;
      computeRod(boat);
      if (cyc < 0.5) {
        setState('charging');
        setPose('charge');
        f.charge = cyc / 0.5;
        boat.rodAngle = lerp(0.95, 2.15, f.charge);
        f.lure.visible = false;
        f.line.points.length = 0;
      } else if (cyc < 1.7) {
        if (lastState !== 'casting') game.events.emit('cast', { power: 0.9 });
        setState('casting');
        setPose('cast');
        const k = (cyc - 0.5) / 1.2;
        boat.rodAngle = lerp(2.15, 0.45, clamp(k * 5, 0, 1));
        const tip = boat.rod.tip;
        f.lure.visible = true;
        f.lure.inWater = false;
        f.lure.x = tip.x + face * 520 * k;
        f.lure.y = tip.y - 260 * 4 * k * (1 - k) + (waves.heightAt(f.lure.x) - tip.y) * k * k;
        f.lure.angle = Math.atan2(-(1 - 2 * k) * 260 * 4 + 2 * k * 100, 520) * face;
        linePoints(f.lure.x, f.lure.y, -30 * Math.sin(k * 3.14));
      } else {
        if (lastState === 'casting') game.events.emit('lureSplash', { x: f.lure.x, y: waves.heightAt(f.lure.x), speed: 500 });
        setState('waiting');
        setPose('wait');
        boat.rodAngle = 0.75;
        f.lure.inWater = true;
        f.lure.y += 150 * dt;
        linePoints(f.lure.x, f.lure.y, 14);
      }
      lastState = f.state;
    } else if (mode === 'wait' || mode === 'bite') {
      setPose('wait');
      boat.rodAngle = 0.72;
      computeRod(boat);
      const depth = Number(flags.depth || 380);
      f.lure.visible = true;
      f.lure.inWater = true;
      f.lure.x = boat.x + face * 400 + Math.sin(t * 0.5) * 12;
      f.lure.y = depth + Math.sin(t * 0.9) * 10;
      f.lure.angle = Math.sin(t * 1.3) * 0.2;
      f.lure.depthM = f.lure.y / 8;
      linePoints(f.lure.x, f.lure.y, 10);
      if (mode === 'bite') {
        const fi = ensureFish();
        const cyc = t % 2.4;
        if (cyc < 1.2) {
          if (f.state !== 'bite') {
            setState('bite');
            game.events.emit('bite', { fish: fi });
          }
          f.biteWindow = 1.2;
          f.biteT = cyc;
          boat.rodBend = 0.3 + Math.sin(t * 30) * 0.08;
        } else {
          setState('waiting');
          boat.rodBend = 0.05;
        }
        f.hooked = fi;
        fi.state = 'bite';
        fi.dir = -face;
        fi.pitch = 0;
        fi.mouth = 0.6;
        fi.swimPhase += dt * 6;
        const mo = mouthOffset(fi, tmp);
        fi.x = f.lure.x - mo.x;
        fi.y = f.lure.y - mo.y;
      } else {
        setState('waiting');
        boat.rodBend = 0.05;
      }
      camY = lerp(SURFACE_CAM_Y, f.lure.y, 0.55);
    } else if (mode === 'fight' || mode === 'deep') {
      const fi = ensureFish();
      setState('fight');
      setPose('fight');
      const depth = Number(flags.depth || (mode === 'deep' ? 3000 : 430));
      const cxw = boat.x + face * 460, r = 170 + fi.visualLen * 0.5;
      const px = cxw + Math.sin(t * 0.7) * r * 1.3, py = depth + Math.sin(t * 1.13 + 1) * r * 0.45;
      fi.vx = (px - fi.x) / Math.max(dt, 0.001);
      fi.vy = (py - fi.y) / Math.max(dt, 0.001);
      if (t < 0.1) {
        fi.vx = 0;
        fi.vy = 0;
      }
      fi.x = px;
      fi.y = Math.max(fi.visualLen * 0.2, py);
      fi.state = 'hooked';
      orientFish(fi, dt);
      f.hooked = fi;
      const cyc = (t % 9) / 9;
      f.tension = clamp(0.55 + 0.42 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 7), 0, 1.15);
      f.fight.stamina = 1 - cyc;
      f.fight.mode = f.tension > 0.85 ? 'run' : f.tension > 0.45 ? 'pull' : 'rest';
      f.fight.time = t;
      f.fight.progress = cyc;
      f.fight.snapMeter = clamp((f.tension - 0.95) * 4, 0, 1);
      f.reeling = Math.sin(t * 1.3) < 0.3;
      f.reelRate = f.reeling ? 0.7 : -0.5 * clamp(f.tension - 0.6, 0, 1);
      boat.rodAngle = 1.15 + Math.sin(t * 1.3) * 0.08;
      boat.rodBend = clamp(f.tension, 0.1, 1);
      computeRod(boat);
      f.lure.visible = false;
      f.lure.inWater = true;
      const mo = mouthOffset(fi, tmp);
      f.lure.x = fi.x + mo.x;
      f.lure.y = fi.y + mo.y;
      f.lure.depthM = f.lure.y / 8;
      linePoints(f.lure.x, f.lure.y, (1 - Math.min(1, f.tension)) * 22);
      f.line.slack = 1 - Math.min(1, f.tension);
      if (mode === 'deep') {
        camX = fi.x;
        camY = fi.y;
      } else {
        camY = lerp(SURFACE_CAM_Y, depth, 0.6);
        zoom = fi.visualLen > 380 ? 0.8 : 1;
      }
    } else if (mode === 'caught') {
      const fi = ensureFish();
      setState('caught');
      setPose('celebrate');
      boat.rodAngle = 1.35;
      boat.rodBend = 0.1;
      computeRod(boat);
      f.hooked = fi;
      fi.state = 'landed';
      const p = boatToWorld(boat, RIG.trophy.x, RIG.trophy.y, tmp);
      fi.x = p.x;
      fi.y = p.y - fi.visualLen * 0.1;
      fi.dir = face;
      fi.pitch = -1.45;
      fi.swimPhase += dt * 9;
      fi.swimAmp = 0.5;
      f.lure.visible = false;
      f.line.points.length = 0;
    }
    f.line.slack = f.state === 'fight' ? f.line.slack : 0.4;
    cam.setTarget(camX, camY, zoom);
  }

  return { active: !!(mode || spawnSpec), update };
}
