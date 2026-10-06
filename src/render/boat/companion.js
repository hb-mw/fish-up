// The ship's cat: an orange tabby who sits on the cooler, perks up at bites, watches fights,
// cheers catches, sulks at losses, hunches in the rain and naps at night. BOAT ART module (boat-local).
import { clamp01, damp, TAU } from '../../core/math.js';

const FUR = '#e39443', FUR_DK = '#b5642a', FUR_HI = '#f6b56c', WHITE = '#f6eee2', NOSE = '#e48a8a';

export function createCompanion(game) {
  const rng = game.rng.fork();
  const C = {
    rise: 0, ear: 0.6, eye: 1, tailUp: 0.2, lean: 0, hop: 0, mouth: 0, look: 0, curl: 0, hunch: 0,
    blink: 0, blinkT: 2, twitchT: 3, twitch: 0, lastState: '', cheerT: 0, idleT: 0,
  };
  function update(dt, s) {
    const night = s.night > 0.7;
    let rise = 0, ear = 0.6, eye = 1, tailUp = 0.25, lean = 0, mouth = 0, look = 0.05, curl = 0, hunch = 0;
    const st = s.state;
    if (st !== C.lastState) {
      C.lastState = st;
      C.idleT = 0;
      if (st === 'caught' || st === 'landing') C.cheerT = 0;
    }
    C.idleT += dt;
    if (st === 'bite' || s.biteAlert > 0.3) {
      rise = 0.7; ear = 1; eye = 1.25; tailUp = 0.9; lean = 0.25; look = 0.35;
    } else if (st === 'fight') {
      rise = 0.45; ear = 0.95; eye = 1.2; tailUp = 0.7 + 0.2 * Math.sin(C.idleT * 9); lean = 0.35; look = 0.4;
    } else if (st === 'caught' || st === 'landing' || s.pose === 'celebrate') {
      C.cheerT += dt;
      rise = 0.8; ear = 1; eye = C.cheerT < 1.6 ? 0.2 : 1; tailUp = 1; lean = 0.1; look = -0.25;
      mouth = C.cheerT < 1.6 ? 0.5 + 0.5 * Math.abs(Math.sin(C.cheerT * 5)) : 0.1;
    } else if (s.pose === 'sad' || st === 'broken') {
      ear = 0.05; eye = 0.6; tailUp = 0; look = 0.35;
    } else if (s.rain > 0.4) {
      hunch = 1; ear = 0.1; eye = 0.45; tailUp = 0; look = 0.1;
    } else if (night && C.idleT > 6 && st === 'idle' && Math.abs(s.vx) < 20) {
      curl = 1; eye = 0; ear = 0.4; tailUp = 0;
    } else if (st === 'waiting') {
      look = 0.3 + 0.1 * Math.sin(C.idleT * 0.4);
    }
    C.rise = damp(C.rise, rise, 6, dt);
    C.ear = damp(C.ear, ear, 9, dt);
    C.eye = damp(C.eye, eye, 10, dt);
    C.tailUp = damp(C.tailUp, tailUp, 4, dt);
    C.lean = damp(C.lean, lean, 5, dt);
    C.mouth = damp(C.mouth, mouth, 12, dt);
    C.look = damp(C.look, look, 4, dt);
    C.curl = damp(C.curl, curl, 1.6, dt);
    C.hunch = damp(C.hunch, hunch, 3, dt);
    C.hop = st === 'caught' || s.pose === 'celebrate' ? Math.abs(Math.sin(C.cheerT * 6)) * Math.max(0, 1 - C.cheerT / 2.4) : 0;
    // blinks & ear twitches
    C.blinkT -= dt;
    if (C.blinkT <= 0) C.blinkT = 2.5 + rng.next() * 4;
    C.blink = C.blinkT < 0.16 ? Math.sin((C.blinkT / 0.16) * Math.PI) : 0;
    C.twitchT -= dt;
    if (C.twitchT <= 0) {
      C.twitchT = 2 + rng.next() * 5;
      C.twitch = 1;
    }
    C.twitch = Math.max(0, C.twitch - dt * 6);
  }
  return Object.assign(C, { update });
}

/** Draw the cat sitting with its bottom at perch (x, y), facing +x. */
export function drawCompanion(g, C, perch, t) {
  g.save();
  g.translate(perch.x, perch.y - C.hop * 7);
  const curl = C.curl;
  if (curl > 0.55) {
    drawCurled(g, C, t);
    g.restore();
    return;
  }
  const rise = C.rise * (1 - C.hunch);
  const hunch = C.hunch;
  const bodyH = 15 + rise * 5 - hunch * 3;
  // tail (behind)
  const sw = Math.sin(t * (1.6 + C.tailUp * 2.4)) * (0.35 + 0.4 * (1 - C.tailUp));
  g.strokeStyle = FUR_DK;
  g.lineCap = 'round';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-8, -3);
  const tipX = -16 - 4 * (1 - C.tailUp) + sw * 4, tipY = -4 - C.tailUp * 22 + (1 - C.tailUp) * 6;
  g.bezierCurveTo(-18, -2, -20 + sw * 3, -10 - C.tailUp * 6, tipX, tipY);
  g.stroke();
  g.strokeStyle = FUR;
  g.lineWidth = 2.6;
  g.stroke();
  // haunch + body
  const gb = g.createLinearGradient(-12, 0, 8, 0);
  gb.addColorStop(0, FUR_DK);
  gb.addColorStop(0.6, FUR);
  gb.addColorStop(1, FUR_HI);
  g.fillStyle = gb;
  g.beginPath();
  g.ellipse(-4, -5.5 + hunch * 1.5, 9, 6.5 - hunch, 0, 0, TAU);
  g.fill();
  g.save();
  g.rotate(C.lean * 0.4);
  g.beginPath();
  g.ellipse(2, -bodyH * 0.62, 6.5, bodyH * 0.5, 0.35 - C.lean * 0.3, 0, TAU);
  g.fill();
  // tabby stripes on the back
  g.strokeStyle = 'rgba(150,80,30,0.55)';
  g.lineWidth = 1.2;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    g.moveTo(-9 + i * 3.5, -10.5 + i * 1.2 - hunch);
    g.quadraticCurveTo(-7 + i * 3.5, -6, -8.5 + i * 3.5, -2.5);
  }
  g.stroke();
  // white chest
  g.fillStyle = WHITE;
  g.beginPath();
  g.ellipse(5.2, -bodyH * 0.55, 3, bodyH * 0.36, 0.25, 0, TAU);
  g.fill();
  // front legs
  g.fillStyle = FUR;
  g.fillRect(2.5, -bodyH * 0.45, 3, bodyH * 0.45);
  g.fillStyle = WHITE;
  g.beginPath();
  g.ellipse(4.6, -0.8, 2.6, 1.6, 0, 0, TAU);
  g.fill();
  // head
  const hx = 6 + C.lean * 3, hy = -bodyH - 5.5 + hunch * 2;
  g.translate(hx, hy);
  g.rotate(C.look * 0.6);
  // ears (perk 0..1: flat → up), with a twitch
  const ear = C.ear;
  const tw = C.twitch * 0.25;
  g.fillStyle = FUR_DK;
  earPath(g, -3.2, -4, ear, -0.35 - tw);
  g.fill();
  g.fillStyle = FUR;
  earPath(g, 1.8, -5, ear, 0.1);
  g.fill();
  g.fillStyle = '#f2b1a8';
  g.beginPath();
  g.moveTo(1.8 + 0.4, -5.2);
  g.lineTo(1.8 + 1.4 * (1 - ear) + 1.2, -5 - 5.2 * ear);
  g.lineTo(1.8 + 2.4, -4.8);
  g.closePath();
  g.fill();
  // skull
  const gh = g.createRadialGradient(1, -2, 0.5, 0, 0, 7.5);
  gh.addColorStop(0, FUR_HI);
  gh.addColorStop(1, FUR);
  g.fillStyle = gh;
  g.beginPath();
  g.ellipse(0, 0, 6.6, 5.9, 0, 0, TAU);
  g.fill();
  // forehead stripes
  g.strokeStyle = 'rgba(150,80,30,0.6)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-1, -5.4);
  g.lineTo(-0.4, -3);
  g.moveTo(1.2, -5.6);
  g.lineTo(1.4, -3.2);
  g.stroke();
  // muzzle
  g.fillStyle = WHITE;
  g.beginPath();
  g.ellipse(5.2, 1.8, 3.4, 2.6, 0, 0, TAU);
  g.fill();
  g.fillStyle = NOSE;
  g.beginPath();
  g.moveTo(7.6, 0.2);
  g.lineTo(8.6, 0.9);
  g.lineTo(7.6, 1.6);
  g.closePath();
  g.fill();
  // mouth
  if (C.mouth > 0.1) {
    g.fillStyle = '#7a2b2b';
    g.beginPath();
    g.ellipse(6.6, 3.4, 1.6, 1.4 * C.mouth + 0.3, 0, 0, TAU);
    g.fill();
  } else {
    g.strokeStyle = 'rgba(90,40,30,0.7)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(7.6, 1.8);
    g.quadraticCurveTo(7, 3, 5.8, 2.8);
    g.stroke();
  }
  // eye: green almond with slit pupil (wide & round when excited)
  const open = clamp01(C.eye) * (1 - C.blink);
  if (open < 0.15) {
    g.strokeStyle = '#3a2210';
    g.lineWidth = 0.8;
    g.beginPath();
    if (C.eye < 0.4 && C.mouth > 0.2) {
      g.moveTo(1.6, -0.6);
      g.quadraticCurveTo(3, -2, 4.4, -0.6); // happy ^
    } else {
      g.moveTo(1.6, -0.8);
      g.quadraticCurveTo(3, 0, 4.4, -0.9);
    }
    g.stroke();
  } else {
    g.fillStyle = '#9ccf4f';
    g.beginPath();
    g.ellipse(3, -1, 1.7, 1.6 * Math.min(1.2, open), 0, 0, TAU);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    const pw = C.eye > 1.1 ? 1.1 : 0.45;
    g.ellipse(3.3, -1, pw, 1.4 * Math.min(1.2, open), 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(3.4, -2, 0.6, 0.6);
  }
  // whiskers
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 0.35;
  g.beginPath();
  g.moveTo(6, 2);
  g.lineTo(12, 1);
  g.moveTo(6, 2.4);
  g.lineTo(11.6, 3.4);
  g.stroke();
  g.restore();
  g.restore();
}

function earPath(g, x, y, up, tilt) {
  const h = 2 + 5 * up;
  const back = (1 - up) * 3.5;
  g.beginPath();
  g.moveTo(x - 1, y + 1.2);
  g.lineTo(x + 0.6 - back + Math.sin(tilt) * 2, y - h);
  g.lineTo(x + 3.4, y + 0.6);
  g.closePath();
}

function drawCurled(g, C, t) {
  // a sleepy donut of cat, tail wrapped around, breathing slowly
  const br = 1 + Math.sin(t * 1.4) * 0.04;
  const gb = g.createRadialGradient(-1, -7, 1, 0, -5, 12);
  gb.addColorStop(0, FUR_HI);
  gb.addColorStop(1, FUR_DK);
  g.fillStyle = gb;
  g.beginPath();
  g.ellipse(0, -5.5 * br, 11, 6.2 * br, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(150,80,30,0.55)';
  g.lineWidth = 1.1;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    g.moveTo(-8 + i * 4, -10.5);
    g.quadraticCurveTo(-6 + i * 4, -7, -7.5 + i * 4, -3.5);
  }
  g.stroke();
  // head tucked at the front
  g.fillStyle = FUR;
  g.beginPath();
  g.ellipse(7, -5, 5, 4.2, 0.2, 0, TAU);
  g.fill();
  g.fillStyle = FUR_DK;
  g.beginPath();
  g.moveTo(5, -8);
  g.lineTo(6.5, -12);
  g.lineTo(8.6, -8.4);
  g.closePath();
  g.fill();
  g.strokeStyle = '#3a2210';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(7.4, -5.4);
  g.quadraticCurveTo(8.6, -4.6, 9.8, -5.4);
  g.stroke();
  // tail wrapped across the front
  g.strokeStyle = FUR;
  g.lineWidth = 3.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-10, -3);
  g.quadraticCurveTo(-2, 1.5, 9, -1);
  g.stroke();
  // z z z
  const z = (t * 0.5) % 1;
  g.fillStyle = `rgba(255,255,255,${0.7 * Math.sin(z * Math.PI)})`;
  g.font = 'bold 6px sans-serif';
  g.fillText('z', 10 + z * 6, -12 - z * 10);
}

