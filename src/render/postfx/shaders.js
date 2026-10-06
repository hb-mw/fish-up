// GLSL sources for the post-processing chain. Written once, compiled as ES 3.00 or ES 1.00 via prelude().
//
// Orientation conventions (important — the scene texture is uploaded WITHOUT a y-flip):
//   vUv  = GL uv, y UP   (0,0 = bottom-left of the render target)  → use it for render-target textures
//   s    = screen uv, y DOWN (0,0 = top-left, like game screen coords) → use it for the scene texture
//
// Number of waterline samples across the screen (segments). The CPU fills WAVE_N + 1 values.
export const WAVE_N = 48;

export const VS = `
ATTR vec2 aPos;
VARY vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

// ── animated, tileable caustic net (rendered into a small repeat texture every frame) ─────────────
// After Dave Hoskins' "Tileable Water Caustic" (iterative trig domain warp).
export const FS_CAUSTIC = `
VARY vec2 vUv;
uniform float uTime;
const float TAU = 6.28318530718;
void main() {
  vec2 p = mod(vUv * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    float t = uTime * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  c = pow(abs(c), 8.0);
  FRAG = vec4(vec3(clamp(c, 0.0, 1.0)), 1.0);
}`;

// ── bloom: bright-pass + 4×4 box downsample of the scene (output at ¼ res, GL orientation) ─────────
export const FS_BRIGHT = COMMON + `
VARY vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uTexel;    // 1 / scene size
uniform vec4 uBright;   // threshold, knee, unused, metric mix (0 = luminance … 1 = max channel)
vec3 prefilter(vec3 c) {
  float br = mix(dot(c, LUMA), max(c.r, max(c.g, c.b)), uBright.w);
  float rq = clamp(br - uBright.x + uBright.y, 0.0, 2.0 * uBright.y);
  rq = rq * rq / (4.0 * uBright.y + 1e-4);
  float w = max(rq, br - uBright.x) / max(br, 1e-4);
  return c * w;
}
void main() {
  vec2 s = vec2(vUv.x, 1.0 - vUv.y);
  vec3 a = prefilter(TEX(uScene, s + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = prefilter(TEX(uScene, s + uTexel * vec2( 1.0, -1.0)).rgb);
  vec3 c = prefilter(TEX(uScene, s + uTexel * vec2(-1.0,  1.0)).rgb);
  vec3 d = prefilter(TEX(uScene, s + uTexel * vec2( 1.0,  1.0)).rgb);
  FRAG = vec4((a + b + c + d) * 0.25, 1.0);
}`;

// ── dual-filter (Kawase) down / up samplers for the bloom chain ───────────────────────────────────
export const FS_DOWN = `
VARY vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;   // 1 / source size
void main() {
  vec3 sum = TEX(uSrc, vUv).rgb * 4.0;
  sum += TEX(uSrc, vUv - uTexel).rgb;
  sum += TEX(uSrc, vUv + uTexel).rgb;
  sum += TEX(uSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  sum += TEX(uSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  FRAG = vec4(sum * 0.125, 1.0);
}`;

export const FS_UP = `
VARY vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;   // 1 / source size (the smaller level)
uniform float uGain;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 sum = TEX(uSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  sum += TEX(uSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  sum += TEX(uSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  sum += TEX(uSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  sum += TEX(uSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  sum += TEX(uSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  sum += TEX(uSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  sum += TEX(uSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  FRAG = vec4(sum * (uGain / 12.0), 1.0);
}`;

// ── the final composite (full resolution, to the screen) ──────────────────────────────────────────
export const FS_COMPOSITE = COMMON + `
VARY vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uCaus;
uniform vec2 uSceneSize;   // scene texture size (device px)
uniform vec2 uView;        // logical view size (w, h)
uniform vec4 uCam;         // camera x, y, zoom, time (s)
uniform vec2 uShake;       // camera shake offset (logical px)
uniform float uWave[WAVE_N + 1];   // screen-uv y (down) of the sea surface at x = i / WAVE_N
uniform vec3 uWaveInfo;    // min, max, mean of uWave
uniform vec4 uWater;       // refraction amplitude (world px), caustic amount, light flicker, deep factor
uniform vec4 uBloomP;      // bloom amount, tint r, g, b
uniform vec2 uBloomTexel;  // 1 / bloom level-0 size
uniform vec4 uGrade;       // contrast k, pivot, saturation, split-tone strength
uniform vec4 uVig;         // centre x, centre y (screen uv), strength, inner radius
uniform vec4 uRipple;      // centre x, y (screen uv), radius (view heights), strength
uniform vec4 uFx;          // flash, chroma, grain, frame seed

float waterline(float x) {
  float f = clamp(x, 0.0, 1.0) * float(WAVE_N);
  float fi = min(floor(f), float(WAVE_N - 1));
#ifdef GL2
  int i = int(fi);
  return mix(uWave[i], uWave[i + 1], f - fi);
#else
  float a = 0.0, b = 0.0;
  int i = int(fi);
  for (int k = 0; k < WAVE_N; k++) {
    if (k == i) { a = uWave[k]; b = uWave[k + 1]; }
  }
  return mix(a, b, f - fi);
#endif
}

// Catmull-Rom (5-tap approximation): resamples the scene at sub-pixel refraction offsets WITHOUT the bilinear
// blur, so fish detail (scales, eyes) stays crisp under the wobble.
vec3 sceneCR(vec2 uv) {
  vec2 sp = uv * uSceneSize;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 inv = 1.0 / uSceneSize;
  vec2 p0 = (t1 - 1.0) * inv, p3 = (t1 + 2.0) * inv, p12 = (t1 + w2 / w12) * inv;
  vec3 r = TEX(uScene, vec2(p12.x, p0.y)).rgb * (w12.x * w0.y)
         + TEX(uScene, vec2(p0.x, p12.y)).rgb * (w0.x * w12.y)
         + TEX(uScene, p12).rgb * (w12.x * w12.y)
         + TEX(uScene, vec2(p3.x, p12.y)).rgb * (w3.x * w12.y)
         + TEX(uScene, vec2(p12.x, p3.y)).rgb * (w12.x * w3.y);
  float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / ws, 0.0);
}

vec3 bloomAt(vec2 uv) {
#ifdef BLOOM_TENT
  vec2 h = uBloomTexel * 0.5;
  return (TEX(uBloom, uv + vec2(-h.x, -h.y)).rgb + TEX(uBloom, uv + vec2(h.x, -h.y)).rgb
        + TEX(uBloom, uv + vec2(-h.x, h.y)).rgb + TEX(uBloom, uv + vec2(h.x, h.y)).rgb) * 0.25;
#else
  return TEX(uBloom, uv).rgb;
#endif
}

vec3 grade(vec3 c, float deep) {
  c = clamp(c, 0.0, 1.0);
  // pivoted power S-curve: fixed points 0, pivot, 1; slope (1 + k) at the pivot
  float k = 1.0 + uGrade.x, p = uGrade.y;
  vec3 lo = p * pow(c / p, vec3(k));
  vec3 hi = 1.0 - (1.0 - p) * pow((1.0 - c) / (1.0 - p), vec3(k));
  c = mix(lo, hi, step(vec3(p), c));
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, uGrade.z);
  // split toning: teal shadows, warm highlights
  float sh = (1.0 - l) * (1.0 - l), hl = l * l;
  c += (vec3(-0.006, 0.006, 0.012) * sh + vec3(0.018, 0.007, -0.011) * hl) * uGrade.w;
  // cooler with depth
  c *= mix(vec3(1.0), vec3(0.94, 0.99, 1.05), deep);
  return c;
}

void main() {
  vec2 s = vec2(vUv.x, 1.0 - vUv.y);
  float zoom = uCam.z, t = uCam.w;
  vec2 world = vec2(uCam.x + (s.x * uView.x - 0.5 * uView.x - uShake.x) / zoom,
                    uCam.y + (s.y * uView.y - 0.5 * uView.y - uShake.y) / zoom);
  float pxY = zoom / uView.y;                          // world px → screen uv (y)
  float depthPx = max(0.0, (s.y - uWaveInfo.z) / pxY);  // approx. world px below the mean surface

  // ── how far below the (wavy) waterline is this pixel? 0 above … 1 well below ──
  float below;
  float bandTop = 6.0 * pxY, bandBot = 44.0 * pxY;
  if (s.y < uWaveInfo.x + bandTop) below = 0.0;
  else if (s.y > uWaveInfo.y + bandBot) below = 1.0;
  else {
    float wl = waterline(s.x);
    below = smoothstep(wl + bandTop, wl + bandBot, s.y);
  }

  // ── underwater refraction wobble (world-anchored, slow, a pixel or two) ──
  vec2 off = vec2(0.0);
  if (below > 0.0) {
    vec2 w = world;
    vec2 n;
    n.x = sin(w.y * 0.021 + t * 1.10 + sin(w.x * 0.0093 + t * 0.55) * 1.7) * 0.62
        + sin(w.x * 0.0165 - t * 0.83 + w.y * 0.0112) * 0.38;
    n.y = sin(w.x * 0.0187 + t * 0.97 + sin(w.y * 0.0131 - t * 0.47) * 1.5) * 0.62
        + sin(w.y * 0.0268 + t * 1.27 - w.x * 0.0071) * 0.38;
    float amp = uWater.x * below * mix(1.0, 0.65, smoothstep(0.0, 900.0, depthPx));
    off = n * amp * zoom / uView;
  }
  // ── hook-set shock ripple ──
  if (uRipple.w > 0.0) {
    float aspect = uView.x / uView.y;
    vec2 d = (s - uRipple.xy) * vec2(aspect, 1.0);
    float r = length(d);
    float band = exp(-pow((r - uRipple.z) / 0.03, 2.0));
    off += (d / max(r, 1e-4)) * band * uRipple.w * 0.010 * vec2(1.0 / aspect, 1.0);
  }

  vec2 su = s + off;
  vec3 col;
  if (uFx.y > 0.001) {
    // chromatic fringe toward the screen edges during violent moments
    vec2 cd = s - 0.5;
    vec2 co = cd * dot(cd, cd) * uFx.y * 0.022;
    col = vec3(TEX(uScene, su + co).r, TEX(uScene, su).g, TEX(uScene, su - co).b);
  } else {
#ifdef SHARP_REFRACT
    col = below > 0.0 || uRipple.w > 0.0 ? sceneCR(su) : TEX(uScene, su).rgb;
#else
    col = TEX(uScene, su).rgb;
#endif
  }

  // ── caustic shimmer near the top of the water column (by day): light dancing on what is already lit ──
  if (uWater.y > 0.0 && below > 0.0) {
    float fall = exp(-depthPx / 210.0) * below;
    if (fall > 0.01) {
      vec2 cp = world * vec2(1.0 / 210.0, 1.0 / 260.0);
      float c1 = TEX(uCaus, cp).r;
      float c2 = TEX(uCaus, cp * 0.57 + vec2(0.37, 0.71)).r;
      float c = c1 * (0.35 + 0.65 * c2);
      float l = dot(col, LUMA);
      col += c * fall * uWater.y * (0.06 + 1.1 * l) * vec3(1.0, 0.98, 0.9);
    }
    col *= 1.0 + uWater.z * fall;
  }

  // ── bloom ──
  col += bloomAt(vUv) * uBloomP.x * uBloomP.yzw;

  // ── colour grade ──
  col = grade(col, uWater.w);

  // ── vignette ──
  float aspect = uView.x / uView.y;
  vec2 vd = (s - uVig.xy) * vec2(aspect, 1.0);
  float vr = length(vd) / length(vec2(0.5 * aspect, 0.5));
  col *= 1.0 - uVig.z * smoothstep(uVig.w, 1.3, vr);

  // ── lightning / event flash ──
  col = col * (1.0 + uFx.x * 0.32) + uFx.x * vec3(0.040, 0.046, 0.058);

  // ── fine grain + triangular dither (kills 8-bit banding in big smooth gradients) ──
  float n1 = hash12(gl_FragCoord.xy + vec2(uFx.w * 17.0, uFx.w * 7.0));
  float n2 = hash12(gl_FragCoord.xy * 1.37 + vec2(uFx.w * 3.1, 19.7));
  float lum = dot(col, LUMA);
  col += (n1 - 0.5) * uFx.z * (0.35 + 0.65 * (1.0 - lum));
  col += (n1 + n2 - 1.0) * (1.0 / 255.0);
  FRAG = vec4(col, 1.0);
}`;

export const FS_COPY = `
VARY vec2 vUv;
uniform sampler2D uSrc;
void main() { FRAG = vec4(TEX(uSrc, vUv).rgb, 1.0); }`;
