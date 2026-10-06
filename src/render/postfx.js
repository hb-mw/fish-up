// ─────────────────────────────────────────────────────────────────────────────
// Post-processing (WebGL): the 2D scene canvas → the final, "expensive" image.
//
//   upload scene ─┬─ bright-pass ¼ ─ down ⅛ ─ down 1/16 ─ down 1/32 ─ up … up (additive)  = bloom
//                 ├─ caustic net (small animated repeat texture, mipmapped)
//                 └─ composite (full res): underwater refraction · hook-set ripple · chromatic fringe ·
//                    caustics · bloom · colour grade · vignette · flash · grain + dither → screen
//
// WebGL2 with a WebGL1 fallback (?gl1=1 forces it). Returns { ok:false } (never throws) when WebGL or a shader
// is unavailable — the kernel then shows the plain 2D canvas. Internal quality: game.settings.quality or ?pfx=low|medium|high.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createContext, prelude, createProgram, createFullscreenTriangle, bindFullscreenTriangle,
  createTexture, createTarget, deleteTarget, pickRenderFormat,
} from './postfx/gl.js';
import { VS, FS_CAUSTIC, FS_BRIGHT, FS_DOWN, FS_UP, FS_COMPOSITE, WAVE_N } from './postfx/shaders.js';
import { createLook } from './postfx/look.js';

const QUALITY = {
  low: { levels: 2, caustics: false, causSize: 256, tent: false, sharp: false },
  medium: { levels: 3, caustics: true, causSize: 256, tent: false, sharp: true },
  high: { levels: 4, caustics: true, causSize: 512, tent: true, sharp: true },
};

/**
 * @param {object} game
 * @param {HTMLCanvasElement} sceneCanvas  the 2D scene (source)
 * @param {HTMLCanvasElement} glCanvas     our output canvas (shown instead of the scene while postfx is on)
 * @returns {{ok:boolean, render:(dt:number)=>void, resize:(w:number,h:number)=>void}}
 */
export function createPostFX(game, sceneCanvas, glCanvas) {
  const flags = game.flags || {};
  const api = {
    ok: false,
    gl2: false,
    quality: 'high',
    /**
     * cpuMs: JS + command submission per frame (EMA).
     * gpuMs: RAW timer-query span of our command range (diagnostic only). In Chrome it also absorbs waits on the 2D
     * canvas's GPU work behind the texture upload, so it is NOT the postfx cost — use bench() for that.
     */
    stats: { cpuMs: 0, gpuMs: null, format: '', timer: 'none' },
    render() {},
    resize() {},
    bench: () => null,
    setQuality() {},
  };
  const forceGL1 = flags.gl1 === '1';
  const ctx = createContext(glCanvas, forceGL1);
  if (!ctx) return api;
  const gl = ctx.gl, gl2 = ctx.gl2;
  api.gl2 = gl2;

  const look = createLook(game);
  let lost = false;
  let progs = null, tri = null, sceneTex = null, fmt = null;
  let levels = [], caus = null;
  let builtFor = '';
  let q = QUALITY.high;
  let timer = null;

  let qualityOverride = flags.pfx || null;
  function pickQuality() {
    const name = qualityOverride || game.settings.quality || 'high';
    const key = name === 'low' ? 'low' : name === 'medium' ? 'medium' : 'high';
    api.quality = key;
    q = QUALITY[key];
  }

  function freeAll() {
    if (!progs) return;
    for (const k in progs) gl.deleteProgram(progs[k].prog);
    gl.deleteBuffer(tri);
    gl.deleteTexture(sceneTex);
    freeTargets();
    progs = null;
  }

  function build() {
    if (!gl.isContextLost()) freeAll();
    pickQuality();
    const vs = prelude(gl2, 'vs') + VS;
    const fs = (src, defs = '') => prelude(gl2, 'fs', defs) + src;
    const waveDef = `#define WAVE_N ${WAVE_N}`;
    progs = {
      caustic: createProgram(gl, vs, fs(FS_CAUSTIC), ['uTime']),
      bright: createProgram(gl, vs, fs(FS_BRIGHT), ['uScene', 'uTexel', 'uBright']),
      down: createProgram(gl, vs, fs(FS_DOWN), ['uSrc', 'uTexel']),
      up: createProgram(gl, vs, fs(FS_UP), ['uSrc', 'uTexel', 'uGain']),
      composite: createProgram(gl, vs, fs(FS_COMPOSITE, waveDef + (q.tent ? '\n#define BLOOM_TENT 1' : '') + (q.sharp ? '\n#define SHARP_REFRACT 1' : '')), [
        'uScene', 'uBloom', 'uCaus', 'uSceneSize', 'uView', 'uCam', 'uShake', 'uWave', 'uWaveInfo', 'uWater',
        'uBloomP', 'uBloomTexel', 'uGrade', 'uVig', 'uRipple', 'uFx',
      ]),
    };
    tri = createFullscreenTriangle(gl);
    sceneTex = createTexture(gl, 0, 0);
    fmt = pickRenderFormat(gl, gl2);
    api.stats.format = fmt.name;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    timer = createTimer();
    builtFor = '';
  }

  function freeTargets() {
    for (const t of levels) deleteTarget(gl, t);
    levels = [];
    deleteTarget(gl, caus);
    caus = null;
  }
  function buildTargets(w, h) {
    freeTargets();
    let lw = Math.max(1, Math.ceil(w / 4)), lh = Math.max(1, Math.ceil(h / 4));
    for (let i = 0; i < q.levels; i++) {
      levels.push(createTarget(gl, lw, lh, fmt));
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
    }
    if (q.caustics) caus = createTarget(gl, q.causSize, q.causSize, null, { repeat: true, mipmap: true });
    builtFor = `${w}x${h}|${api.quality}`;
  }

  function resize(w, h) {
    if (lost) return;
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    if (glCanvas.width !== w || glCanvas.height !== h) {
      glCanvas.width = w;
      glCanvas.height = h;
    }
    if (builtFor !== `${w}x${h}|${api.quality}`) buildTargets(w, h);
  }

  function pass(prog, target) {
    gl.useProgram(prog.prog);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    }
  }
  function bindTex(unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /** One full post-process frame (upload + all passes). noUpload: re-use the last uploaded scene (benchmarks). */
  function draw(dt, noUpload) {
    const w = sceneCanvas.width, h = sceneCanvas.height;
    if (glCanvas.width !== w || glCanvas.height !== h || builtFor !== `${w}x${h}|${api.quality}`) resize(w, h);
    look.update(dt);
    const U = look.u;

    bindTex(0, sceneTex);
    if (!noUpload) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);
    bindFullscreenTriangle(gl, tri);
    gl.disable(gl.BLEND);

    // caustic net
    const useCaus = !!caus && U.water[1] > 0.002;
    if (useCaus) {
      pass(progs.caustic, caus);
      gl.uniform1f(progs.caustic.u.uTime, U.causTime);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      bindTex(2, caus.tex);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // bloom chain
    const L = levels;
    pass(progs.bright, L[0]);
    bindTex(0, sceneTex);
    gl.uniform1i(progs.bright.u.uScene, 0);
    gl.uniform2f(progs.bright.u.uTexel, 1 / w, 1 / h);
    gl.uniform4fv(progs.bright.u.uBright, U.bright);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 1; i < L.length; i++) {
      pass(progs.down, L[i]);
      bindTex(0, L[i - 1].tex);
      gl.uniform1i(progs.down.u.uSrc, 0);
      gl.uniform2f(progs.down.u.uTexel, 1 / L[i - 1].w, 1 / L[i - 1].h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = L.length - 1; i > 0; i--) {
      pass(progs.up, L[i - 1]);
      bindTex(0, L[i].tex);
      gl.uniform1i(progs.up.u.uSrc, 0);
      gl.uniform2f(progs.up.u.uTexel, 1 / L[i].w, 1 / L[i].h);
      gl.uniform1f(progs.up.u.uGain, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // composite → screen
    const c = progs.composite, cu = c.u;
    pass(c, null);
    bindTex(0, sceneTex);
    bindTex(1, L[0].tex);
    bindTex(2, useCaus ? caus.tex : sceneTex);
    gl.uniform1i(cu.uScene, 0);
    gl.uniform1i(cu.uBloom, 1);
    gl.uniform1i(cu.uCaus, 2);
    gl.uniform2f(cu.uSceneSize, w, h);
    gl.uniform2fv(cu.uView, U.view);
    gl.uniform4fv(cu.uCam, U.cam);
    gl.uniform2fv(cu.uShake, U.shake);
    gl.uniform1fv(cu.uWave, U.wave);
    gl.uniform3fv(cu.uWaveInfo, U.waveInfo);
    if (!useCaus) U.water[1] = 0;
    gl.uniform4fv(cu.uWater, U.water);
    gl.uniform4fv(cu.uBloomP, U.bloomP);
    gl.uniform2f(cu.uBloomTexel, 1 / L[0].w, 1 / L[0].h);
    gl.uniform4fv(cu.uGrade, U.grade);
    gl.uniform4fv(cu.uVig, U.vig);
    gl.uniform4fv(cu.uRipple, U.ripple);
    gl.uniform4fv(cu.uFx, U.fx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(dt) {
    if (lost || !api.ok) return;
    const t0 = performance.now();
    try {
      if (timer) timer.begin();
      draw(dt || 1 / 60);
      if (timer) timer.end();
    } catch (e) {
      game.reportError('postfx.render', e);
    }
    const ms = performance.now() - t0;
    api.stats.cpuMs = api.stats.cpuMs ? api.stats.cpuMs * 0.95 + ms * 0.05 : ms;
  }

  /**
   * Honest cost measurement: N post-process frames of the unchanged scene canvas, fenced by a 1-px readPixels
   * (a real GPU sync — gl.finish() does not block in Chrome). Returns ms per frame for the full frame (texture
   * upload included) and for the passes alone (upload skipped).
   */
  const px1 = new Uint8Array(4);
  function fence() {
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
  }
  function bench(n = 120) {
    if (lost || !api.ok) return null;
    draw(1 / 60);
    fence();
    let t0 = performance.now();
    for (let i = 0; i < n; i++) draw(1 / 60);
    fence();
    const full = (performance.now() - t0) / n;
    t0 = performance.now();
    for (let i = 0; i < n; i++) draw(1 / 60, true);
    fence();
    const passes = (performance.now() - t0) / n;
    return { full, passes };
  }

  // GPU timer queries (rarely exposed in browsers; used when present)
  function createTimer() {
    const ext = gl2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : gl.getExtension('EXT_disjoint_timer_query');
    if (!ext) {
      api.stats.timer = 'unavailable';
      return null;
    }
    api.stats.timer = 'EXT_disjoint_timer_query';
    const pending = [];
    let active = null, n = 0;
    return {
      begin() {
        if (++n % 20 !== 0 || active) return;
        active = gl2 ? gl.createQuery() : ext.createQueryEXT();
        if (gl2) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
        else ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, active);
      },
      end() {
        if (active) {
          if (gl2) gl.endQuery(ext.TIME_ELAPSED_EXT);
          else ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
          pending.push(active);
          active = null;
        }
        for (let i = pending.length - 1; i >= 0; i--) {
          const qo = pending[i];
          const avail = gl2 ? gl.getQueryParameter(qo, gl.QUERY_RESULT_AVAILABLE) : ext.getQueryObjectEXT(qo, ext.QUERY_RESULT_AVAILABLE_EXT);
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
          if (avail || disjoint) {
            if (avail && !disjoint) {
              const ns = gl2 ? gl.getQueryParameter(qo, gl.QUERY_RESULT) : ext.getQueryObjectEXT(qo, ext.QUERY_RESULT_EXT);
              const ms = ns / 1e6;
              api.stats.gpuMs = api.stats.gpuMs == null ? ms : api.stats.gpuMs * 0.8 + ms * 0.2;
            }
            if (gl2) gl.deleteQuery(qo);
            else ext.deleteQueryEXT(qo);
            pending.splice(i, 1);
          }
        }
      },
    };
  }

  // ── context loss: fall back to the 2D canvas until the context comes back ──
  function showScene(sceneOn) {
    sceneCanvas.style.display = sceneOn ? 'block' : 'none';
    glCanvas.style.display = sceneOn ? 'none' : 'block';
  }
  glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    api.ok = false;
    progs = null;
    levels = [];
    caus = null;
    builtFor = '';
    showScene(true);
  });
  glCanvas.addEventListener('webglcontextrestored', () => {
    try {
      lost = false;
      build();
      buildTargets(sceneCanvas.width, sceneCanvas.height);
      api.ok = true;
      if (game.settings.postfx) showScene(false);
    } catch (e) {
      game.reportError('postfx.restore', e);
    }
  });
  game.events.on('settings', () => {
    if (lost || !api.ok) return;
    const before = api.quality;
    pickQuality();
    if (before !== api.quality) {
      try {
        build();
        resize(sceneCanvas.width, sceneCanvas.height);
      } catch (e) {
        game.reportError('postfx.quality', e);
      }
    }
  });

  try {
    build();
    resize(sceneCanvas.width, sceneCanvas.height);
  } catch (e) {
    game.reportError('postfx.init', e);
    return api;
  }
  api.ok = true;
  api.render = render;
  api.resize = resize;
  api.bench = bench;
  api.look = look;
  api.gl = gl;
  /** Dev: switch internal quality ('low' | 'medium' | 'high') at runtime. */
  api.setQuality = (name) => {
    qualityOverride = name || null;
    build();
    resize(sceneCanvas.width, sceneCanvas.height);
  };
  return api;
}
