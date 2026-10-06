// Shared mutable game-state shapes. KERNEL FILE.
// These objects are created once by the kernel and live at game.boat / game.fishing / game.player.
// Gameplay modules MUTATE them (never replace them); art, UI and audio READ them.
import { WORLD, DEFAULT_STATS } from '../core/config.js';

/** game.boat — written by the boat controller (src/entities/boat.js). */
export function createBoatState() {
  return {
    /** World position of the hull's waterline centre. y follows the waves. */
    x: WORLD.startX,
    y: 0,
    vx: 0,
    /** Hull rotation in radians (canvas convention: + = clockwise). From wave slope + acceleration. */
    tilt: 0,
    /** +1 = bow points right, −1 = bow points left. (Snaps; art may animate the flip.) */
    facing: 1,
    /** Visual tier 0..2 from the equipped boat (0 = old skiff, 1 = bay cruiser, 2 = sport-fisher). */
    tier: 0,
    /** −1..1 engine throttle right now (wake, engine sound, exhaust). */
    throttle: 0,
    /** Rod angle at the grip, radians above horizontal-forward (see src/entities/rig.js). */
    rodAngle: 0.95,
    /** 0..1 how hard the rod is bent by the line. */
    rodBend: 0,
    /** Angler animation pose: 'idle'|'charge'|'cast'|'wait'|'reel'|'strike'|'fight'|'lift'|'celebrate'|'sad' */
    pose: 'idle',
    /** Seconds since the pose last changed. */
    poseT: 0,
    /** Night lamp on? */
    lamp: false,
    /** Filled in every frame by computeRod() — WORLD coords. The line starts at rod.tip. */
    rod: { grip: { x: 0, y: 0 }, tip: { x: 0, y: 0 }, pts: [], tipAngle: 0 },
  };
}

/** game.fishing — written by the fishing module (src/gameplay/fishing.js). */
export function createFishingState() {
  return {
    /**
     * 'idle'     line in — free to sail
     * 'charging' holding the cast (charge 0..1)
     * 'casting'  lure flying through the air
     * 'waiting'  lure in the water, nothing on (sinking / jigging / retrieving)
     * 'bite'     a fish has taken the bait — hook-set window is open (biteT counts up to biteWindow)
     * 'fight'    fish on!
     * 'landing'  fish beaten — being lifted aboard (short cinematic)
     * 'caught'   catch card is showing; waiting for the 'catchDismissed' event
     * 'broken'   line snapped or fish got away — short recovery before 'idle'
     */
    state: 'idle',
    /** Seconds in the current state. */
    stateT: 0,
    /** Cast power 0..1 while charging. */
    charge: 0,
    lure: {
      /** Lure id from src/data/lures.js (mirrors game.player.lureId). */
      id: 'worm',
      x: 0, y: 0, vx: 0, vy: 0,
      /** Is the lure out of the rod-tip rest position (flying or in the water)? Draw it only when true. */
      visible: false,
      inWater: false,
      /** Rotation for drawing (radians). */
      angle: 0,
      /** Seconds since the player last twitched/jigged it (fish love a fresh twitch). */
      twitchT: 99,
      /** Current speed px/s (moving lures attract predators). */
      speed: 0,
      /** Lure depth in metres (0 at the surface). */
      depthM: 0,
    },
    line: {
      /** Polyline rod tip → lure/fish in WORLD coords: [{x,y}, …]. Empty when the line is in. */
      points: [],
      /** px of line currently off the spool. */
      out: 0,
      /** px of line on the spool (= stats.lineLengthM × 8). */
      max: 480,
      /** 0 = bar-taut … 1 = very slack (drives the sag of the drawn line). */
      slack: 0,
    },
    /** true while the spool is free and the lure is sinking on its own; false once the reel is engaged (lure holds depth). */
    spoolFree: true,
    /** Is the player cranking the reel right now? */
    reeling: false,
    /** −1..1 spool speed: + = retrieving line, − = line being pulled out (drag screaming). For audio & animation. */
    reelRate: 0,
    /** Line tension 0..1+. ≥ 1 is the red zone: hold it there and the line snaps. */
    tension: 0,
    /** The fish currently on the hook during 'bite' / 'fight' / 'landing' (else null). */
    hooked: null,
    /** Bite window progress: seconds elapsed / seconds allowed. */
    biteT: 0,
    biteWindow: 0,
    fight: {
      /** Hooked fish stamina 1 → 0. At 0 it is spent and comes in easily. */
      stamina: 1,
      /** What the fish is doing: 'rest'|'pull'|'run'|'dive'|'jump'|'thrash' */
      mode: 'rest',
      /** Seconds since hook-set. */
      time: 0,
      /** 0..1 — fills while tension is in the red; at 1 the line snaps. */
      snapMeter: 0,
      /** 0..1 — fills while the line is slack during a fight; at 1 the hook shakes loose. */
      slackMeter: 0,
      /** 0..1 progress toward landing (1 = at the boat). */
      progress: 0,
      /** Hook-set quality of this fight: 'perfect' | 'good' | 'late' */
      hookQuality: 'good',
    },
    /** Consecutive catches without losing a fish. */
    streak: 0,
    /** The last finished catch (same object as the 'catch' event payload), for the lift/celebrate pose. */
    lastCatch: null,

    // ── API installed by the fishing module (safe no-op defaults) ──
    /** Fish AI → gameplay: "this fish just took the lure". Returns true if accepted (gameplay then controls the fish). */
    fishBite(fish) { return false; },
    /** Fish AI → gameplay: "this predator just attacked the hooked fish". Returns true if it took over the hook. */
    predatorStrike(predator) { return false; },
    /** Is there a lure in the water that fish may currently go for? */
    canAttract() { return false; },
  };
}

/**
 * game.player — default profile. The progression module (src/gameplay/progression.js) takes ownership:
 * it loads/saves it, and may add fields, but these keys always exist.
 */
export function createPlayerState() {
  return {
    coins: 0,
    /** Lifetime points. */
    score: 0,
    xp: 0,
    level: 1,
    /** Equipped lure id. */
    lureId: 'worm',
    /** Lures the player owns (ids, in shop order). */
    lures: ['worm'],
    /** Equipped boat tier (mirrored to game.boat.tier). */
    boatTier: 0,
    /** Current gear stats — see DEFAULT_STATS in src/core/config.js. */
    stats: { ...DEFAULT_STATS },
    /** Fishdex: speciesId → { count, bestLengthCm, bestWeightKg, bestPoints, firstDay } */
    dex: {},
  };
}
