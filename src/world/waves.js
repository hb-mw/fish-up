// The one true sea-surface function. KERNEL FILE.
// Everything that touches the surface (water art, boat physics, splashes, jumping fish) must use this
// so that it all lines up.

/**
 * World-y of the water surface at world-x at time t (seconds).
 * 0 = mean sea level, negative = crest (up), positive = trough.
 * `sea` is the sea state (game.env.weather.sea): ~0.5 glassy · 1 normal · 2+ storm.
 * Max excursion is about ±14 px × sea.
 */
export function waveHeight(x, t, sea = 1) {
  return (
    sea *
    (7.0 * Math.sin(x * 0.0042 + t * 0.9) +
      4.0 * Math.sin(x * 0.011 - t * 1.4 + 1.3) +
      2.0 * Math.sin(x * 0.027 + t * 2.3 + 4.1) +
      1.0 * Math.sin(x * 0.061 - t * 3.1 + 0.7))
  );
}

/** d(waveHeight)/dx — surface slope (for boat tilt, normals, glints). */
export function waveSlope(x, t, sea = 1) {
  return (
    sea *
    (7.0 * 0.0042 * Math.cos(x * 0.0042 + t * 0.9) +
      4.0 * 0.011 * Math.cos(x * 0.011 - t * 1.4 + 1.3) +
      2.0 * 0.027 * Math.cos(x * 0.027 + t * 2.3 + 4.1) +
      1.0 * 0.061 * Math.cos(x * 0.061 - t * 3.1 + 0.7))
  );
}

/**
 * Convenience object stored at game.world.waves:
 *   heightAt(x)  → surface y right now      slopeAt(x) → surface slope right now
 */
export function createWaves(game) {
  return {
    heightAt: (x) => waveHeight(x, game.time.now, game.env.weather.sea),
    slopeAt: (x) => waveSlope(x, game.time.now, game.env.weather.sea),
  };
}
