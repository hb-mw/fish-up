// LIFE — headless census & bite-pacing report. A tools/shot.mjs --script flow:
//
//   node tools/shot.mjs "/?mode=play" /tmp/life/x.png --quiet --script dev/life-census.mjs
//
// env:  LIFE_MODE = pop | bite | real | rare | perf | all (default pop,perf)
//       LIFE_SCEN = comma list of scenario names to run (default: all of that mode)
//       LIFE_LURES = comma list of lure ids for the bite table (default: all 9)
//       LIFE_TRIALS = trials per bite cell (default 2) · LIFE_SHOTS=1 also saves a screenshot per census scenario
//
// pop   on-screen species census at several places / hours (+ habitat violations, in-view spawns)
// bite  time-to-first-bite per lure (game seconds), lure still and twitched (+ slow retrieve for flashy lures)
// rare  appearances per level over ~10 game-minutes in a few habitats (distinct individuals seen in view)
// real  the real fishing module, no overrides: cast with the keyboard, time lure splash → bite (incl. sinking)
// perf  update ms at time.scale = 1 with a crowded view
const MODE = (process.env.LIFE_MODE || 'pop,perf').split(',');
const ONLY = process.env.LIFE_SCEN ? process.env.LIFE_SCEN.split(',') : null;
const LURES = (process.env.LIFE_LURES || 'worm,shrimp,spinner,jelly,minnow,krill,squid_jig,glow_jig,chum').split(',');
const TRIALS = Number(process.env.LIFE_TRIALS || 2);
const SHOTS = process.env.LIFE_SHOTS === '1';
const BASE = process.env.FISHUP_URL || 'http://localhost:5173';
const COMMON = 'mode=play&nosave=1&off=ui,audio,postfx&freeze=1&weather=clear';

const POP = [
  { name: 'reef-sail', x: 1750, cam: '1930,86', time: 12 },
  { name: 'reef-lure', x: 1750, cam: '1930,248', time: 12 },
  { name: 'reef-dusk', x: 1750, cam: '1930,86', time: 19 },
  { name: 'reef-night', x: 1750, cam: '1930,86', time: 23.5 },
  { name: 'kelp-sail', x: 3900, cam: '4080,86', time: 12 },
  { name: 'kelp-mid', x: 3900, cam: '4080,640', time: 12 },
  { name: 'dropoff-sail', x: 5600, cam: '5780,86', time: 12 },
  { name: 'wreck', x: 6150, cam: '6330,2900', time: 12 },
  { name: 'open-sail', x: 8700, cam: '8880,86', time: 12 },
  { name: 'open-twilight', x: 8700, cam: '8880,2400', time: 12 },
  { name: 'open-twi-night', x: 8700, cam: '8880,2400', time: 23.5 },
  { name: 'open-midnight', x: 8700, cam: '8880,4100', time: 12 },
  { name: 'trench-deep-night', x: 10900, cam: '11080,4800', time: 23.5 },
  { name: 'trench-floor', x: 11150, cam: '11330,6500', time: 12 },
];

const BITE = [
  { name: 'reef', x: 1750, depth: 380, time: 12 },
  { name: 'kelp', x: 3800, depth: 760, time: 12 },
  { name: 'wreck', x: 5930, depth: 2900, time: 12 },
  { name: 'open-surface', x: 8400, depth: 220, time: 12 },
  { name: 'open-twilight', x: 8400, depth: 2400, time: 12 },
  { name: 'open-twi-night', x: 8400, depth: 1400, time: 23.5 },
  { name: 'trench-night', x: 10600, depth: 4800, time: 23.5 },
];

const RARE = [
  { name: 'reef', x: 1750, cam: '1930,200', time: 12 },
  { name: 'open-surface', x: 8700, cam: '8880,140', time: 12 },
  { name: 'open-twilight', x: 8700, cam: '8880,2400', time: 12 },
  { name: 'trench-night', x: 10900, cam: '11080,4800', time: 23.5 },
];

const want = (list) => (ONLY ? list.filter((s) => ONLY.includes(s.name)) : list);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

// bite / rarity runs don't need the scenery: placeholders keep the frame rate (and game time) high
const FAST = 'mode=play&nosave=1&off=ui,audio,postfx,sky,water,seabed,effects,boatArt,art&freeze=1&weather=clear';

async function open(page, query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${BASE}/?${query}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__game && window.__game.fish && window.__game.fish.debugState, { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 600));
      return;
    } catch (e) {
      console.log(`   (retrying ${query.slice(0, 60)}… : ${e.message.slice(0, 80)})`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

// ── in-page helpers (serialised into the page) ─────────────────────────────────────────────────────────
function pageCensus() {
  const g = window.__game, b = g.camera.bounds, terr = g.world.terrain, env = g.env;
  const counts = {}, bad = [];
  let n = 0;
  for (const f of g.fish.list) {
    if (f.species.group === 'item') continue;
    if (f.x < b.left || f.x > b.right || f.y < b.top || f.y > b.bottom) continue;
    n++;
    counts[f.speciesId] = (counts[f.speciesId] || 0) + 1;
    const sp = f.species;
    const bio = terr.biomeAt(f.x);
    const okB = sp.biomes.includes(bio) || sp.biomes.includes(terr.biomeAt(f.x - 160)) || sp.biomes.includes(terr.biomeAt(f.x + 160));
    let lo = sp.depthM[0], hi = sp.depthM[1];
    if (sp.nightDepthM) {
      lo += (sp.nightDepthM[0] - lo) * env.night;
      hi += (sp.nightDepthM[1] - hi) * env.night;
    }
    const bottom = sp.layer === 'demersal' || sp.layer === 'benthic';
    const dm = (bottom ? terr.heightAt(f.x) : f.y) / 8;
    const okD = dm >= lo - 12 && dm <= hi + 12;
    if (!okB || !okD) bad.push(`${sp.id}@${Math.round(f.x)},${Math.round(dm)}m${okB ? '' : '(biome ' + bio + ')'}`);
  }
  const items = g.fish.list.filter((f) => f.species.group === 'item' && f.x > b.left && f.x < b.right && f.y > b.top && f.y < b.bottom).map((f) => f.speciesId);
  return { n, counts, bad, items, phase: env.phase, st: g.fish.debugState(), stats: { ...g.fish.stats }, total: g.fish.list.length };
}

async function runPop(page, shot) {
  console.log('\n══ POPULATION CENSUS (animals in the 1920×1080 view; mean of samples over ~40 game-s at 4×) ══');
  console.log(pad('scenario', 18) + pad('hour', 6) + lpad('view', 6) + lpad('target', 8) + lpad('total', 7) + lpad('inViewSp', 9) + '  species (mean count in view)');
  for (const s of want(POP)) {
    await open(page, `${COMMON}&x=${s.x}&time=${s.time}&cam=${s.cam}&seed=11`);
    await page.evaluate(() => { window.__game.time.scale = 4; });
    const acc = {};
    let sumN = 0, k = 0, last = null;
    const bad = new Set();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const c = await page.evaluate(pageCensus);
      sumN += c.n;
      k++;
      for (const id in c.counts) acc[id] = (acc[id] || 0) + c.counts[id];
      c.bad.forEach((b) => bad.add(b.split('@')[0]));
      last = c;
    }
    if (SHOTS) await shot(`census-${s.name}.png`);
    const mix = Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${id} ${(v / k).toFixed(1)}`).join(', ');
    console.log(
      pad(s.name, 18) + pad(s.time, 6) + lpad((sumN / k).toFixed(1), 6) + lpad(last.st.viewTarget.toFixed(1), 8) + lpad(last.total, 7) +
      lpad(last.stats.inViewSpawns, 9) + '  ' + (mix || '—'),
    );
    if (bad.size) console.log(pad('', 18) + '  ⚠ out of habitat: ' + [...bad].join(', '));
    if (last.items.length) console.log(pad('', 18) + '  items in view: ' + last.items.join(', '));
  }
}

// ── bite pacing ─────────────────────────────────────────────────────────────────────────────────────
function pageBiteSetup(lureId, mode) {
  const g = window.__game;
  g.time.scale = 10;
  g.fishing.lure.id = lureId;
  g.fishing.canAttract = () => true;
  window.__bites = [];
  window.__nibbles = 0;
  window.__t0 = g.time.now;
  g.fishing.fishBite = (f) => {
    window.__bites.push({ t: g.time.now - window.__t0, id: f.speciesId, cm: f.lengthCm, lvl: f.species.level });
    return false;
  };
  if (!window.__nibHook) {
    window.__nibHook = true;
    g.events.on('nibble', () => window.__nibbles++);
  }
  // drivers: twitch every ~3 game-s, or a slow retrieve (boat moves → the demo lure follows at ~60 px/s)
  if (window.__drv) cancelAnimationFrame(window.__drv);
  if (window.__boatX0 === undefined) window.__boatX0 = g.boat.x;
  const x0 = (g.boat.x = window.__boatX0);
  g.fishing.lure.speed = 0;
  g.fishing.lure.twitchT = 99;
  let lastTw = g.time.now;
  const tick = () => {
    window.__drv = requestAnimationFrame(tick);
    const t = g.time.now - window.__t0;
    if (mode === 'twitch' && g.time.now - lastTw > 3) {
      lastTw = g.time.now;
      g.fishing.lure.twitchT = 0;
      g.events.emit('twitch', { x: g.fishing.lure.x, y: g.fishing.lure.y });
    }
    if (mode === 'retrieve') {
      g.boat.x = x0 + Math.sin(t * 0.2) * 300;
      g.fishing.lure.speed = Math.abs(Math.cos(t * 0.2) * 60);
    }
  };
  tick();
  g.fish.debugReset();
}

async function runBite(page) {
  console.log('\n══ TIME TO FIRST BITE (game seconds; median of ' + TRIALS + ' trials; "—" = none within 45 s) ══');
  console.log('   cell = still / twitched [/ retrieve]  · biter species of the first trial');
  for (const s of want(BITE)) {
    console.log(`\n── ${s.name}  (lure x≈${s.x + 400}, ${Math.round(s.depth / 8)} m, ${s.time}h)`);
    await open(page, `${FAST}&demo=wait&x=${s.x}&depth=${s.depth}&time=${s.time}&seed=5`);
    for (const lure of LURES) {
      const modes = ['still', 'twitch'];
      if (lure === 'spinner' || lure === 'minnow') modes.push('retrieve');
      const cells = [];
      const who = new Set();
      for (const mode of modes) {
        const ts = [];
        for (let k = 0; k < TRIALS; k++) {
          await page.evaluate(pageBiteSetup, lure, mode);
          let r = null;
          for (let w = 0; w < 120; w++) {
            await new Promise((res) => setTimeout(res, 150));
            r = await page.evaluate(() => ({ b: window.__bites[0] || null, t: window.__game.time.now - window.__t0, n: window.__nibbles }));
            if (r.b || r.t > 45) break;
          }
          if (r.b) {
            ts.push(r.b.t);
            who.add(r.b.id);
          } else ts.push(Infinity);
        }
        ts.sort((a, b) => a - b);
        const mid = (ts.length - 1) / 2;
        const med = (ts[Math.floor(mid)] + ts[Math.ceil(mid)]) / 2;
        cells.push(Number.isFinite(med) ? med.toFixed(1) : '—');
      }
      console.log('   ' + pad(lure, 10) + pad(cells.join(' / '), 22) + [...who].join(', '));
    }
  }
}

// ── rarity ──────────────────────────────────────────────────────────────────────────────────────────
async function runRare(page) {
  console.log('\n══ RARITY: distinct animals seen in view over ~10 game-minutes, by level ══');
  for (const s of want(RARE)) {
    for (const seed of [3, 4]) {
      await open(page, `${FAST}&x=${s.x}&time=${s.time}&cam=${s.cam}&seed=${seed}`);
      await page.evaluate(() => {
        const g = window.__game;
        g.time.scale = 10;
        window.__seen = new Map();
        if (window.__rint) clearInterval(window.__rint);
        window.__rint = setInterval(() => {
          const b = g.camera.bounds;
          for (const f of g.fish.list) {
            if (f.species.group === 'item' || f.x < b.left || f.x > b.right || f.y < b.top || f.y > b.bottom) continue;
            if (!window.__seen.has(f.uid)) window.__seen.set(f.uid, f.speciesId + ':' + f.species.level + (f.shiny ? ':shiny' : ''));
          }
        }, 100);
      });
      let t = 0;
      while (t < 600) {
        await new Promise((r) => setTimeout(r, 1000));
        t = await page.evaluate(() => window.__game.time.now);
      }
      const r = await page.evaluate(() => {
        const byLvl = {}, rare = {};
        let shiny = 0;
        for (const v of window.__seen.values()) {
          const [id, lvl, sh] = v.split(':');
          byLvl[lvl] = (byLvl[lvl] || 0) + 1;
          if (Number(lvl) >= 7) rare[id] = (rare[id] || 0) + 1;
          if (sh) shiny++;
        }
        return { byLvl, rare, shiny, n: window.__seen.size, t: window.__game.time.now };
      });
      console.log(`${pad(s.name, 16)} seed ${seed}: ${r.n} animals in ${(r.t / 60).toFixed(1)} min · by level ${JSON.stringify(r.byLvl)} · lvl≥7: ${JSON.stringify(r.rare)} · shiny ${r.shiny}`);
    }
  }
}

// ── perf ────────────────────────────────────────────────────────────────────────────────────────────
async function runPerf(page) {
  console.log('\n══ PERF (fish.update ms at time.scale 1) ══');
  for (const q of [`x=1750&time=12&cam=1930,200,0.6`, `x=8700&time=12&cam=8880,600,0.5`]) {
    await open(page, `${COMMON}&${q}&seed=9`);
    await new Promise((r) => setTimeout(r, 4000));
    const r = await page.evaluate(() => ({ n: window.__game.fish.list.length, ms: window.__game.fish.perf.ms, max: window.__game.fish.perf.max, fps: window.__game.time.fps }));
    console.log(`${pad(q, 34)} entities ${r.n}  update avg ${r.ms.toFixed(3)} ms  max ${r.max.toFixed(2)} ms  fps ${r.fps.toFixed(0)}`);
  }
}

// ── real gameplay: no overrides — cast with the keyboard, time lureSplash → bite (includes the sink) ──
const REAL = [
  { name: 'reef-worm', x: 1750, lure: 'worm', time: 12 },
  { name: 'kelp-spinner', x: 3900, lure: 'spinner', time: 12 },
];
async function runReal(page) {
  console.log('\n══ REAL GAMEPLAY (fishing.js, no overrides): lure splash → bite, game seconds (includes sinking) ══');
  for (const s of want(REAL)) {
    const ts = [];
    const who = [];
    for (let k = 0; k < TRIALS; k++) {
      await open(page, `mode=play&nosave=1&off=audio,postfx&x=${s.x}&time=${s.time}&freeze=1&weather=clear&seed=${30 + k}`);
      await page.evaluate((lure) => {
        const g = window.__game;
        if (!g.player.lures.includes(lure)) g.player.lures.push(lure);
        g.player.lureId = lure;
        window.__rb = {};
        g.events.on('lureSplash', () => { if (!window.__rb.splash) window.__rb.splash = g.time.now; });
        g.events.on('bite', (p) => { if (!window.__rb.bite) { window.__rb.bite = g.time.now; window.__rb.id = p.fish.speciesId; } });
      }, s.lure);
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 300));
      await page.keyboard.down('Space');
      await new Promise((r) => setTimeout(r, 650));
      await page.keyboard.up('Space');
      let r = null;
      for (let w = 0; w < 140; w++) {
        await new Promise((res) => setTimeout(res, 250));
        r = await page.evaluate(() => ({ ...window.__rb, now: window.__game.time.now }));
        if (r.bite || (r.splash && r.now - r.splash > 45)) break;
      }
      if (r && r.bite && r.splash) {
        ts.push(r.bite - r.splash);
        who.push(r.id);
      } else ts.push(Infinity);
    }
    ts.sort((a, b) => a - b);
    const mid = (ts.length - 1) / 2, med = (ts[Math.floor(mid)] + ts[Math.ceil(mid)]) / 2;
    console.log(`   ${pad(s.name, 14)} median ${Number.isFinite(med) ? med.toFixed(1) : '—'} s   trials ${ts.map((t) => (Number.isFinite(t) ? t.toFixed(1) : '—')).join(' ')}   ${who.join(', ')}`);
  }
}

export default async ({ page, shot }) => {
  if (MODE.includes('real') || MODE.includes('all')) await runReal(page);
  if (MODE.includes('pop') || MODE.includes('all')) await runPop(page, shot);
  if (MODE.includes('perf') || MODE.includes('all')) await runPerf(page);
  if (MODE.includes('bite') || MODE.includes('all')) await runBite(page);
  if (MODE.includes('rare') || MODE.includes('all')) await runRare(page);
};
