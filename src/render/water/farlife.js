// WATER · far life on the far-sea band — rare delights, not texture:
//   · a pod of dolphins porpoising across the middle distance
//   · a whale far out: a spout or two, the back rolling, then the flukes as it dives — or, rarely, a breach
//   · a sail on the horizon (mast light at night)
// Everything lives in far-sea ground space (lateral X + perspective s, see farsea.js), so it shrinks, flattens,
// scrolls with parallax and takes on the horizon haze with distance.
// Dev triggers: __game.mods.water.debug.far.life.dolphins() · .whale('spout'|'breach') · .sail()
import { clamp01, lerp, smoothstep, mixRgb } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { unitSprite } from '../art/common.js';
import { makeCanvas, softDot, blob, Tint } from './sprites.js';

function paintDolphin() {
  const w = 96, h = 40;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  // nose at the right
  g.moveTo(w * 0.99, h * 0.54);
  g.bezierCurveTo(w * 0.93, h * 0.5, w * 0.9, h * 0.44, w * 0.84, h * 0.4);
  g.bezierCurveTo(w * 0.7, h * 0.28, w * 0.5, h * 0.3, w * 0.42, h * 0.33);
  g.lineTo(w * 0.36, h * 0.08); // dorsal fin
  g.bezierCurveTo(w * 0.33, h * 0.18, w * 0.31, h * 0.3, w * 0.28, h * 0.38);
  g.bezierCurveTo(w * 0.2, h * 0.44, w * 0.14, h * 0.46, w * 0.09, h * 0.47);
  g.lineTo(w * 0.01, h * 0.3); // fluke up
  g.lineTo(w * 0.05, h * 0.52);
  g.lineTo(w * 0.01, h * 0.72); // fluke down
  g.lineTo(w * 0.1, h * 0.56);
  g.bezierCurveTo(w * 0.3, h * 0.66, w * 0.55, h * 0.74, w * 0.78, h * 0.64);
  g.bezierCurveTo(w * 0.86, h * 0.6, w * 0.92, h * 0.58, w * 0.99, h * 0.56);
  g.closePath();
  g.fill();
  // flipper
  g.beginPath();
  g.moveTo(w * 0.66, h * 0.62);
  g.lineTo(w * 0.56, h * 0.9);
  g.lineTo(w * 0.6, h * 0.62);
  g.fill();
  return c;
}

function paintBack() {
  // a whale's back rolling at the surface with its small dorsal fin (seen far away)
  const w = 128, h = 32;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0, h);
  g.bezierCurveTo(w * 0.12, h * 0.45, w * 0.32, h * 0.3, w * 0.52, h * 0.32);
  g.lineTo(w * 0.6, h * 0.1);
  g.lineTo(w * 0.64, h * 0.36);
  g.bezierCurveTo(w * 0.8, h * 0.45, w * 0.92, h * 0.7, w, h);
  g.closePath();
  g.fill();
  return c;
}

function paintFluke() {
  // tail flukes raised as the whale dives (seen from behind)
  const w = 96, h = 72;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(w * 0.44, h);
  g.bezierCurveTo(w * 0.45, h * 0.7, w * 0.46, h * 0.5, w * 0.47, h * 0.36);
  g.bezierCurveTo(w * 0.36, h * 0.3, w * 0.12, h * 0.24, w * 0.0, h * 0.04);
  g.bezierCurveTo(w * 0.18, h * 0.1, w * 0.35, h * 0.12, w * 0.46, h * 0.2);
  g.lineTo(w * 0.5, h * 0.27); // notch
  g.lineTo(w * 0.54, h * 0.2);
  g.bezierCurveTo(w * 0.65, h * 0.12, w * 0.82, h * 0.1, w, h * 0.04);
  g.bezierCurveTo(w * 0.88, h * 0.24, w * 0.64, h * 0.3, w * 0.53, h * 0.36);
  g.bezierCurveTo(w * 0.54, h * 0.5, w * 0.55, h * 0.7, w * 0.56, h);
  g.closePath();
  g.fill();
  return c;
}

function paintSail() {
  const w = 40, h = 48;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  // hull (dark) — drawn via separate tint passes would be overkill: hull alpha lower so it reads darker on haze
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath(); // mainsail
  g.moveTo(w * 0.5, h * 0.02);
  g.quadraticCurveTo(w * 0.72, h * 0.4, w * 0.8, h * 0.8);
  g.lineTo(w * 0.5, h * 0.8);
  g.closePath();
  g.fill();
  g.beginPath(); // jib
  g.moveTo(w * 0.47, h * 0.12);
  g.lineTo(w * 0.46, h * 0.78);
  g.quadraticCurveTo(w * 0.3, h * 0.72, w * 0.18, h * 0.78);
  g.closePath();
  g.globalAlpha = 0.85;
  g.fill();
  return c;
}

const AUTO_SAIL = false;

export function createFarLife(game, core, P) {
  const cam = game.camera;
  const env = game.env;
  const rng = createRng(0xfa21);
  const { yOf, viewX, groundX } = P;

  const dolphinS = paintDolphin(), backS = paintBack(), flukeS = paintFluke(), sailS = paintSail();
  const tDolphin = new Tint(dolphinS), tBack = new Tint(backS), tFluke = new Tint(flukeS), tSail = new Tint(sailS), tHull = new Tint(backS);
  const dotS = softDot(16, 0.6), tSplash = new Tint(dotS), tLamp = new Tint(softDot(16, 0.8));
  const mistS = blob(64), tMist = new Tint(mistS);
  let tBreach = null;

  const pod = { on: false, X: 0, s: 0.4, dir: 1, t: 0, dur: 14, speed: 60, n: 4, m: [] };
  for (let i = 0; i < 7; i++) pod.m.push({ off: 0, per: 1.8, ph: 0, lane: 0 });
  const whale = { on: false, X: 0, s: 0.2, dir: 1, t: 0, kind: 'spout', dur: 16 };
  const sail = { on: false, X: 0, s: 0.07, dir: 1, t: 0, speed: 4 };
  const splashes = Array.from({ length: 24 }, () => ({ on: false, X: 0, s: 0.5, t: 0, life: 0.5, size: 1 }));
  const mists = Array.from({ length: 10 }, () => ({ on: false, X: 0, s: 0.2, t: 0, life: 3, size: 1 }));
  let podTimer = rng.range(30, 70), whaleTimer = rng.range(80, 170), sailTimer = rng.range(5, 40);

  const viewRangeX = (s, k) => {
    const b = cam.bounds;
    return groundX(lerp(b.left + b.w * 0.12, b.right - b.w * 0.12, k), s);
  };

  function startPod() {
    pod.on = true;
    pod.s = rng.range(0.3, 0.6);
    pod.dir = rng.chance(0.5) ? 1 : -1;
    pod.speed = rng.range(70, 110); // ground px / s
    pod.dur = rng.range(11, 16);
    pod.X = viewRangeX(pod.s, pod.dir > 0 ? rng.range(0.0, 0.35) : rng.range(0.65, 1.0));
    pod.t = 0;
    pod.n = rng.int(3, 6);
    for (let i = 0; i < pod.n; i++) {
      const m = pod.m[i];
      m.off = (i - pod.n / 2) * rng.range(28, 46) + rng.range(-10, 10);
      m.per = rng.range(1.5, 2.1);
      m.ph = rng.next();
      m.lane = rng.range(-0.025, 0.025);
    }
  }
  function startWhale(kind) {
    whale.on = true;
    whale.kind = kind || (rng.chance(0.25) ? 'breach' : 'spout');
    whale.s = whale.kind === 'breach' ? rng.range(0.16, 0.3) : rng.range(0.12, 0.26);
    whale.dir = rng.chance(0.5) ? 1 : -1;
    whale.X = viewRangeX(whale.s, rng.range(0.15, 0.85));
    whale.t = 0;
    whale.dur = whale.kind === 'breach' ? 9 : 17;
  }
  function startSail() {
    sail.on = true;
    sail.s = rng.range(0.05, 0.1);
    sail.dir = rng.chance(0.5) ? 1 : -1;
    sail.X = viewRangeX(sail.s, rng.range(0.1, 0.9));
    sail.t = 0;
    sail.speed = rng.range(3, 7);
  }
  function splash(X, s, size) {
    const o = splashes.find((q) => !q.on);
    if (!o) return;
    o.on = true;
    o.X = X;
    o.s = s;
    o.t = 0;
    o.life = 0.5 + 0.4 * size;
    o.size = size;
  }
  function mist(X, s, size) {
    const o = mists.find((q) => !q.on);
    if (!o) return;
    o.on = true;
    o.X = X;
    o.s = s;
    o.t = 0;
    o.life = 3.2;
    o.size = size;
  }

  // per-dolphin leap state → splash triggers
  const wasUp = new Array(7).fill(false);
  let spoutsDone = 0, breachSplash = false;

  function update(dt) {
    const visible = core.surfaceInView;
    if (!pod.on) {
      podTimer -= dt;
      if (podTimer <= 0) {
        podTimer = rng.range(55, 140);
        if (visible) startPod();
      }
    } else {
      pod.t += dt;
      pod.X += pod.dir * pod.speed * dt;
      for (let i = 0; i < pod.n; i++) {
        const st = leapState(i);
        if (st.up !== wasUp[i]) splash(pod.X + pod.m[i].off + st.dx, pod.s + pod.m[i].lane, 0.5);
        wasUp[i] = st.up;
      }
      if (pod.t > pod.dur) pod.on = false;
    }
    if (!whale.on) {
      whaleTimer -= dt;
      if (whaleTimer <= 0) {
        whaleTimer = rng.range(150, 320);
        if (visible) {
          startWhale();
          spoutsDone = 0;
          breachSplash = false;
        }
      }
    } else {
      whale.t += dt;
      whale.X += whale.dir * 6 * dt;
      if (whale.kind === 'spout') {
        const spoutAt = [0.4, 4.2];
        if (spoutsDone < spoutAt.length && whale.t >= spoutAt[spoutsDone]) {
          mist(whale.X + whale.dir * 18, whale.s, 1);
          spoutsDone++;
        }
        // the flukes slip under with a little white water
        if (spoutsDone === 2 && whale.t >= 13.1) {
          splash(whale.X - whale.dir * 45, whale.s, 0.8);
          spoutsDone++;
        }
      } else {
        // bursting out, then the crash back down
        if (spoutsDone === 0 && whale.t > 1.0) {
          for (let k = 0; k < 3; k++) splash(whale.X + rng.range(-30, 30), whale.s, 1.8);
          spoutsDone = 1;
        }
        if (!breachSplash && whale.t > 3.3) {
          breachSplash = true;
          for (let k = 0; k < 6; k++) splash(whale.X + whale.dir * rng.range(-20, 110), whale.s, rng.range(2.2, 3));
          mist(whale.X + whale.dir * 50, whale.s, 1.3);
        }
      }
      if (whale.t > whale.dur) whale.on = false;
    }
    if (!sail.on) {
      // the sky module already keeps a sail on its horizon: ours only appears when asked (AUTO_SAIL / debug)
      sailTimer -= dt;
      if (sailTimer <= 0) {
        sailTimer = rng.range(60, 200);
        if (visible && AUTO_SAIL) startSail();
      }
    } else {
      sail.t += dt;
      sail.X += sail.dir * sail.speed * dt;
      if (sail.t > 200) sail.on = false;
    }
    for (const o of splashes) if (o.on && (o.t += dt) >= o.life) o.on = false;
    for (const o of mists) {
      if (!o.on) continue;
      o.t += dt;
      o.X += env.weather.wind * 14 * dt;
      if (o.t >= o.life) o.on = false;
    }
  }

  const ls = { up: false, u: 0, dx: 0 };
  /** dolphin i: is it in the air, how far through the leap (0..1), and its lateral offset in the leap */
  function leapState(i) {
    const m = pod.m[i];
    const c = (pod.t / m.per + m.ph) % 1;
    const air = 0.38;
    ls.up = c < air;
    ls.u = c / air;
    ls.dx = 0;
    return ls;
  }

  function haze(c, s) {
    // atmospheric perspective + the light of the hour
    const p = env.palette, a = p.ambient;
    const lit = [c[0] * a[0] / 255, c[1] * a[1] / 255, c[2] * a[2] / 255];
    return mixRgb(lit, mixRgb(p.haze, p.skyHorizon, 0.5), clamp01(0.75 - s * 1.1) + env.weather.fog * 0.5);
  }

  function render(ctx, b) {
    const T = game.time.now;
    // sail on the horizon
    if (sail.on) {
      const x = viewX(sail.X, sail.s);
      if (x > b.left - 30 && x < b.right + 30) {
        const s = sail.s;
        const fade = smoothstep(0, 4, sail.t) * (1 - smoothstep(190, 200, sail.t));
        const hgt = 260 * s, wid = hgt * 0.83;
        const y = yOf(s) + Math.sin(T * 1.3) * 0.3;
        const bob = Math.sin(T * 1.1) * 0.05;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bob);
        ctx.scale(sail.dir, 1);
        ctx.globalAlpha = fade;
        ctx.drawImage(tSail.get(haze([250, 248, 240], s)), -wid * 0.5, -hgt * 0.8, wid, hgt);
        ctx.drawImage(tHull.get(haze([60, 52, 50], s)), -wid * 0.42, -hgt * 0.06, wid * 0.84, hgt * 0.1);
        ctx.restore();
        if (env.night > 0.4) {
          ctx.globalCompositeOperation = 'lighter';
          const ls2 = 9 * Math.max(0.6, s * 10) * (0.85 + 0.15 * Math.sin(T * 3));
          ctx.globalAlpha = fade * env.night * 0.9;
          ctx.drawImage(tLamp.get([255, 214, 140]), x - ls2 * 0.5, y - hgt * 0.78 - ls2 * 0.5, ls2, ls2);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      }
    }

    // whale
    if (whale.on) drawWhale(ctx, b, T);

    // dolphins
    if (pod.on) {
      const fadeIn = smoothstep(0, 1.5, pod.t) * (1 - smoothstep(pod.dur - 1.5, pod.dur, pod.t));
      const spr = tDolphin.get(haze([46, 58, 72], pod.s));
      for (let i = 0; i < pod.n; i++) {
        const st = leapState(i);
        if (!st.up) continue;
        const m = pod.m[i];
        const s = pod.s + m.lane;
        const len = 46 * s;
        const H = 30 * s;
        const leapLen = 70 * s;
        const u = st.u;
        const X = pod.X + m.off;
        const x = viewX(X, s) + pod.dir * (u - 0.5) * leapLen;
        const y = yOf(s) - H * 4 * u * (1 - u) + len * 0.12;
        if (x < b.left - 40 || x > b.right + 40) continue;
        const slope = -H * 4 * (1 - 2 * u) / leapLen; // dy/dx along the arc
        const ang = Math.atan(slope) * 0.9;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pod.dir, 1);
        ctx.rotate(ang);
        ctx.globalAlpha = fadeIn;
        ctx.drawImage(spr, -len * 0.5, -len * 0.21, len, len * 0.42);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // splashes & mist
    const white = haze([245, 248, 252], 0.6);
    const sp = tSplash.get(white), mi = tMist.get(white);
    for (const o of splashes) {
      if (!o.on) continue;
      const x = viewX(o.X, o.s);
      if (x < b.left - 40 || x > b.right + 40) continue;
      const k = o.t / o.life;
      const r = (12 + 10 * o.size) * o.s * (0.4 + 0.8 * k) * o.size;
      const y = yOf(o.s);
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.drawImage(sp, x - r, y - r * 0.9 * (0.4 + k * 0.6), r * 2, r * 0.9);
      for (let d = -1; d <= 1; d++) {
        const dh = Math.sin(Math.PI * Math.min(1, k * 1.4)) * r * (1.1 - Math.abs(d) * 0.3);
        ctx.drawImage(sp, x + d * r * 0.45 - r * 0.15, y - dh - r * 0.15, r * 0.3, r * 0.3);
      }
    }
    for (const o of mists) {
      if (!o.on) continue;
      const x = viewX(o.X, o.s);
      if (x < b.left - 60 || x > b.right + 60) continue;
      const k = o.t / o.life;
      // a blow: a tall jet that blooms into a drifting cloud of mist
      const hgt = 170 * o.s * o.size * (0.3 + 0.7 * Math.min(1, k * 4));
      const w = hgt * (0.28 + 0.55 * k);
      ctx.globalAlpha = 0.9 * Math.pow(1 - k, 1.4);
      ctx.drawImage(mi, x - w * 0.35, yOf(o.s) - hgt * 0.95, w * 0.7, hgt);
      ctx.drawImage(mi, x - w * 0.75, yOf(o.s) - hgt * 1.2, w * 1.5, hgt * 0.62);
      ctx.globalAlpha = 0.5 * Math.pow(1 - k, 2);
      ctx.drawImage(mi, x - w * 1.1, yOf(o.s) - hgt * 1.25, w * 2.2, hgt * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawWhale(ctx, b, T) {
    const s = whale.s, t = whale.t;
    const x = viewX(whale.X, s);
    if (x < b.left - 200 || x > b.right + 200) return;
    const y = yOf(s);
    const col = haze([30, 38, 50], s + 0.18);
    const fade = smoothstep(0, 0.6, t) * (1 - smoothstep(whale.dur - 0.8, whale.dur, t));
    ctx.save();
    ctx.globalAlpha = fade;
    // everything below the far waterline stays submerged
    ctx.beginPath();
    ctx.rect(b.left - 10, b.top - 10, b.w + 20, y + 0.8 - b.top + 10);
    ctx.clip();
    if (whale.kind === 'spout') {
      // 0–7 s: two blows with the back rolling; 8–13 s: the dive and the flukes
      const len = 240 * s;
      const back = Math.max(roll(t, 0.0, 3.0), roll(t, 3.6, 7.2), roll(t, 8.0, 10.6));
      if (back > 0.01) {
        const h = len * 0.2 * back;
        ctx.save();
        ctx.translate(x, y + 0.5);
        ctx.scale(whale.dir, 1);
        ctx.drawImage(tBack.get(col), -len * 0.5, -h, len, h);
        ctx.restore();
      }
      const fl = roll(t, 9.6, 13.6);
      if (fl > 0.01) {
        const fh = len * 0.42 * fl, fw = len * 0.5;
        ctx.translate(x - whale.dir * len * 0.3, y + 0.5);
        ctx.rotate(whale.dir * (0.25 - 0.25 * fl));
        ctx.drawImage(tFluke.get(col), -fw * 0.5, -fh, fw, fh);
      }
    } else {
      // breach: bursts out at a steep angle, hangs, crashes back onto its side
      const up = clamp01((t - 1.0) / 1.2), down = clamp01((t - 2.2) / 1.1);
      if (t > 1.0 && t < 3.4) {
        const len = 300 * s;
        if (!tBreach) {
          const base = unitSprite('water:humpback-far', { x0: -0.54, x1: 0.52, y0: -0.13, y1: 0.31 }, 96, paintHumpbackFar);
          tBreach = { tint: new Tint(base.canvas), base };
        }
        const bs = tBreach.base;
        const rise = Math.sin(Math.PI * 0.5 * up) * (1 - down * down);
        const ang = -1.15 + down * 1.6;
        const cx = x + whale.dir * (down * len * 0.25), cy = y - rise * len * 0.42 + len * 0.1;
        ctx.translate(cx, cy);
        ctx.scale(whale.dir, 1);
        ctx.rotate(ang);
        const k = len / bs.res;
        ctx.drawImage(tBreach.tint.get(col), bs.box.x0 * len - bs.pad * k, bs.box.y0 * len - bs.pad * k, bs.canvas.width * k, bs.canvas.height * k);
      }
    }
    ctx.restore();
  }

  return {
    update,
    render,
    dolphins: () => startPod(),
    whale: (kind) => {
      startWhale(kind);
      spoutsDone = 0;
      breachSplash = false;
    },
    sail: () => startSail(),
    state: { pod, whale, sail },
  };
}

/** 0 → 1 → 0 bump of t over [k0, k1] */
function roll(t, k0, k1) {
  const k = clamp01((t - k0) / (k1 - k0));
  return Math.sin(Math.PI * k);
}

// small far-away humpback (same silhouette family as the deep one, simplified)
function paintHumpbackFar(g) {
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(0.5, 0.0);
  g.bezierCurveTo(0.4, -0.08, 0.1, -0.11, -0.15, -0.09);
  g.lineTo(-0.2, -0.11);
  g.lineTo(-0.23, -0.07);
  g.bezierCurveTo(-0.32, -0.04, -0.4, -0.02, -0.46, -0.01);
  g.lineTo(-0.53, -0.08);
  g.lineTo(-0.49, 0.0);
  g.lineTo(-0.53, 0.08);
  g.lineTo(-0.46, 0.01);
  g.bezierCurveTo(-0.3, 0.05, 0.0, 0.12, 0.3, 0.1);
  g.bezierCurveTo(0.42, 0.08, 0.5, 0.04, 0.5, 0.0);
  g.fill();
  g.beginPath();
  g.moveTo(0.2, 0.07);
  g.lineTo(-0.08, 0.28);
  g.lineTo(0.1, 0.08);
  g.fill();
}
