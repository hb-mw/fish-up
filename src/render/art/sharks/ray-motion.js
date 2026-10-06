// Per-individual motion state for the rays: their beat rate and effort change with the fish's state (resting,
// cruising, hooked). Scaling the absolute anim.phase by a state-dependent factor would make the wings jump the
// moment the state flips, so the beat phase is integrated per fish instead — rate changes alter only the speed.
import { hookedness } from './kit.js';

const states = new Map();
const scratch = { ph: 0, hk: 0 };

/**
 * Advance and return the motion state of one individual.
 * rate: beat phase advanced per unit of anim.phase; hookRate: additional rad/s at full hookedness (frantic beats).
 * Returns { ph (integrated beat phase), hk (hookedness eased over ~0.3 s) }.
 */
export function rayMotion(anim, rate, hookRate) {
  const hkNow = hookedness(anim);
  const uid = anim.uid || 0;
  const t = anim.t || 0, phase = anim.phase || 0;
  if (!uid) {
    // UI portraits: stateless (reuse one scratch object — no per-frame garbage)
    scratch.ph = phase * rate + hookRate * hkNow * t;
    scratch.hk = hkNow;
    return scratch;
  }
  let s = states.get(uid);
  if (!s) {
    s = { ph: phase * rate, hk: hkNow, t, phase };
    states.set(uid, s);
    if (states.size > 96) {
      // forget individuals not drawn for a while (they despawned)
      for (const [k, o] of states) if (t - o.t > 6 || o.t > t + 1) states.delete(k);
    }
  }
  const dt = Math.min(0.1, Math.max(0, t - s.t));
  const dph = phase - s.phase;
  s.hk += (hkNow - s.hk) * Math.min(1, dt * 3.5);
  s.ph += (Math.abs(dph) < 2 ? dph : 0) * rate + dt * hookRate * s.hk;
  s.t = t;
  s.phase = phase;
  return s;
}
