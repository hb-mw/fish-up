// Tiny event bus (game.events). KERNEL FILE.
//
// ═══ EVENT CATALOGUE — the canonical list. [who emits] name {payload} ═══════════════════════════
// lifecycle
//   [kernel]  'ready' {}                      all modules created
//   [kernel]  'gameStart' {}                  left the title screen (game.start())
//   [kernel]  'pause' {paused}
//   [kernel]  'resize' view
//   [kernel]  'settings' settings             volumes / quality / toggles changed (game.saveSettings())
// world
//   [env]     'phase' {from, to}              'night' | 'dawn' | 'day' | 'dusk'
//   [env]     'newDay' {day}
//   [env]     'weatherChange' {from, to}      'clear'|'fair'|'cloudy'|'rain'|'storm'|'fog'
//   [env]     'lightning' {x, power}          flash now (x = 0..1 across the sky)
//   [env]     'thunder' {power}               the sound arrives (delayed)
//   [boat]    'biome' {from, to}              the boat sailed into another biome (ids from BIOMES)
//   [fishing] 'zone' {from, to}               the lure/hooked fish crossed into another depth zone (ids from ZONES)
// fishing flow — emitted by src/gameplay/fishing.js unless noted
//   'state' {from, to}                        game.fishing.state changed
//   'castCharge' {}                           started charging a cast
//   'cast' {power}                            lure released (power 0..1)
//   'lureSplash' {x, y, speed}                lure hit the water
//   'lureBottom' {x, y}                       lure touched the seabed
//   'twitch' {x, y}                           player jigged the lure
//   'retrieved' {}                            lure reeled all the way in with nothing on
//   'nibble' {fish, x, y}        [fish AI]    a fish pecked at the lure without committing
//   'bite' {fish}                             a fish took the bait — the hook-set window is open
//   'hookSet' {fish, quality}                 struck in time. quality: 'perfect' | 'good' | 'late'
//   'hookMiss' {fish}                         window missed — the fish is gone
//   'fightStart' {fish}
//   'run' {fish}                              the fish started a hard run (drag screams)
//   'jump' {fish, x, y}                       the fish left the water
//   'tensionWarn' {level}                     tension is in the red (rate-limited)
//   'lineSnap' {fish, x, y}                   the line broke
//   'escape' {fish, reason}                   hook came out: 'slack' | 'jump' | 'thrown'
//   'predatorStrike' {predator, prey, took}   a predator hit the hooked fish (took = it is now the one on the hook)
//   'fightEnd' {fish, result}                 'landed' | 'snapped' | 'escaped'
//   'landed' {fish}                           fish lifted out of the water at the boat
//   'catch' {fish, hookQuality, fightTime, maxTension, streak, depthM}     final → progression scores it
//   'catchDismissed' {}          [UI]         the catch card was closed → fishing returns to 'idle'
// generic FX requests — anyone may emit; effects + audio react
//   'splash' {x, y, size, kind}               size 0.3 (plop) … 3 (breach). kind: 'lure'|'fish'|'jump'|'boat'|'land'
//   'bubbles' {x, y, n}
//   'ink' {x, y, size, color}
//   'shake' {amount}                          camera shake 0..1 (the kernel listens)
// progression — emitted by src/gameplay/progression.js
//   'catchScored' {record}                    the scored catch → UI shows the catch card (record: see progression.js)
//   'coins' {delta, total, reason}            'xp' {delta, total}
//   'levelUp' {level, title, unlocked}        unlocked = [gear ids now available]
//   'questProgress' {quest}                   'questComplete' {quest}           'achievement' {achievement}
//   'purchase' {item}   'equip' {item}        gear changed (game.player.stats already updated)
//   'dexNew' {speciesId}                      first catch of a species
//   'record' {speciesId, lengthCm, weightKg}  new personal best
//   'profileReset' {}                         the save was wiped and a fresh profile started
// UI
//   'toast' {text, kind, icon}   [anyone]     small notification. kind: 'info' | 'good' | 'warn' | 'rare'
//   'ui:open' {panel}  'ui:close' {panel}     [UI]
//   'ui:click' {}  'ui:hover' {}              [UI] → audio
// ════════════════════════════════════════════════════════════════════════════════════════════════

export function createEvents() {
  const map = new Map();
  const bus = {
    /** Subscribe. Returns an unsubscribe function. */
    on(type, fn) {
      let set = map.get(type);
      if (!set) map.set(type, (set = new Set()));
      set.add(fn);
      return () => set.delete(fn);
    },
    once(type, fn) {
      const off = bus.on(type, (p) => {
        off();
        fn(p);
      });
      return off;
    },
    off(type, fn) {
      const set = map.get(type);
      if (set) set.delete(fn);
    },
    /** Emit synchronously. A throwing listener never breaks the emitter or other listeners. */
    emit(type, payload) {
      const set = map.get(type);
      if (set) {
        for (const fn of [...set]) {
          try {
            fn(payload);
          } catch (e) {
            console.error(`[events] listener for "${type}" threw`, e);
          }
        }
      }
      const any = map.get('*');
      if (any) {
        for (const fn of [...any]) {
          try {
            fn(type, payload);
          } catch (e) {
            console.error('[events] wildcard listener threw', e);
          }
        }
      }
    },
  };
  return bus;
}
