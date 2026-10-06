// Tiny WebGL helpers for the post-processing pass (WebGL2 first, WebGL1 fallback).
// Everything here is allocation-free once set up; render targets are re-created only on resize.

const CTX_ATTRS = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

/**
 * Create a GL context on `canvas`. Returns { gl, gl2 } or null.
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} forceGL1  skip WebGL2 (dev flag, to exercise the fallback path)
 */
export function createContext(canvas, forceGL1 = false) {
  let gl = null;
  if (!forceGL1) {
    try {
      gl = canvas.getContext('webgl2', CTX_ATTRS);
    } catch { gl = null; }
    if (gl) return { gl, gl2: true };
  }
  try {
    gl = canvas.getContext('webgl', CTX_ATTRS) || canvas.getContext('experimental-webgl', CTX_ATTRS);
  } catch { gl = null; }
  return gl ? { gl, gl2: false } : null;
}

/** GLSL prelude so one shader source compiles as ES 3.00 (WebGL2) or ES 1.00 (WebGL1). */
export function prelude(gl2, stage, defines = '') {
  if (gl2) {
    return stage === 'vs'
      ? `#version 300 es\nprecision highp float;\n#define GL2 1\n#define ATTR in\n#define VARY out\n${defines}\n`
      : `#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n#define GL2 1\n#define VARY in\n#define TEX texture\nout vec4 fragColor;\n#define FRAG fragColor\n${defines}\n`;
  }
  return stage === 'vs'
    ? `precision highp float;\n#define ATTR attribute\n#define VARY varying\n${defines}\n`
    : `#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#define VARY varying\n#define TEX texture2D\n#define FRAG gl_FragColor\n${defines}\n`;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}

/**
 * Compile + link a program. Returns { prog, u: {name: location}, use() }.
 * Uniform locations are looked up once for every name in `uniforms`.
 */
export function createProgram(gl, vsSrc, fsSrc, uniforms) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error('program link failed: ' + log);
  }
  const u = {};
  for (const name of uniforms) u[name] = gl.getUniformLocation(prog, name);
  return { prog, u };
}

/** A buffer holding one triangle that covers the whole viewport (attribute 0 = aPos). */
export function createFullscreenTriangle(gl) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return buf;
}

export function bindFullscreenTriangle(gl, buf) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

/** Plain 2D texture with clamp (or repeat) wrapping and linear filtering. */
export function createTexture(gl, w, h, opts = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (w > 0 && h > 0) {
    const f = opts.format;
    if (f) gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, f.type, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  return tex;
}

/**
 * Pick the best colour-renderable format for the bloom chain: RGBA16F when the context can render to it
 * (smooth, band-free halos), RGBA8 otherwise. Verified with a framebuffer completeness check.
 */
export function pickRenderFormat(gl, gl2) {
  const rgba8 = { internal: gl.RGBA, format: gl.RGBA, type: gl.UNSIGNED_BYTE, name: 'rgba8' };
  if (!gl2) return rgba8;
  const ok = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  if (!ok) return rgba8;
  const f16 = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, name: 'rgba16f' };
  const tex = createTexture(gl, 4, 4, { format: f16 });
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);
  return complete ? f16 : rgba8;
}

/** Render target: texture + framebuffer of a given size. */
export function createTarget(gl, w, h, format, opts = {}) {
  w = Math.max(1, w | 0);
  h = Math.max(1, h | 0);
  const tex = createTexture(gl, w, h, { format, repeat: opts.repeat, mipmap: opts.mipmap });
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

export function deleteTarget(gl, t) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}
