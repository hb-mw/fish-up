// GAMEPLAY bot — drives the real game through game.input.setVirtual() to test & tune the fishing loop.
//
//   node tools/shot.mjs "/?mode=play&nosave=1&off=ui,audio,postfx&debug=1&time=12&seed=3" out.png --script dev/bot-gameplay.mjs
//
// Environment:
//   BOT_MODE=table|shots      table: fights over species × tackle × policy, prints a result table (default)
//                             shots: screenshots of every fishing state (idle, charge, cast, wait, bite, fight, jump, landing, caught, broken)
//   BOT_SPECIES=a,b|all       species ids (default: a spread over levels and styles)
//   BOT_TACKLE=fair|<n>[,…]   tackle rating(s); 'fair' = the fish's own fight power (ratio 1) (default fair)
//   BOT_POLICY=smart|always|never|all   reel policy (default all)
//   BOT_SIZEQ=0.5  BOT_SCALE=3 (time scale; keep ≤ 4 — above that headless frames get too coarse)  BOT_DEPTH=150 (lure depth px before the bite)  BOT_FISH=<id for shots>
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const DEFAULT_SPECIES = [
  'clownfish', 'sardine', 'yellowtail_snapper', 'garibaldi', 'parrotfish', 'pufferfish', 'flying_fish', 'moray_eel', 'mahi_mahi',
  'barracuda', 'yellowfin_tuna', 'goliath_grouper', 'ocean_sunfish', 'sailfish', 'bluefin_tuna', 'hammerhead', 'blue_marlin',
  'great_white', 'whale_shark', 'megalodon', 'treasure_chest',
];
const TARGETS = [[1, 3, 5, 12], [4, 6, 15, 30], [7, 8, 30, 60], [9, 10, 60, 100]];
const targetFor = (level) => TARGETS.find((t) => level >= t[0] && level <= t[1]) || [0, 0, 1, 40];

/** Injected into the page once: the in-page driver (cast, force a bite, set the hook, play the fight). */
const DRIVER = `
window.__bot = (() => {
  const g = window.__game, f = g.fishing, inp = g.input;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  async function waitFor(cond, timeoutS = 30) {
    const t0 = g.time.now;
    while (!cond()) {
      await frame();
      if (g.time.now - t0 > timeoutS) return false;
    }
    return true;
  }
  const gearFor = (tackle) => {
    const k = Math.max(0, Math.min(1, (tackle - 1.5) / 8.5));
    return { tackle, lineLengthM: Math.max(60, Math.round(60 * Math.pow(1.38, tackle - 1.5))), reelSpeed: 300 + 550 * k, dragSmooth: 0.7 * k, rodControl: 0.7 * k };
  };
  async function reset() {
    inp.setVirtual('action', false);
    inp.setVirtual('down', false);
    if (f.state === 'caught') g.events.emit('catchDismissed', {});
    await waitFor(() => f.state === 'idle', 0.5);
    if (f.state !== 'idle' && g.mods.fishingCtl && g.mods.fishingCtl.abort) g.mods.fishingCtl.abort();
    await waitFor(() => f.state === 'idle', 12);
    for (const fi of [...g.fish.list]) if (fi.__bot) g.fish.remove(fi);
  }
  async function cast(power = 0.7) {
    inp.setVirtual('action', true);
    await waitFor(() => f.state === 'charging' && f.charge >= power, 5);
    inp.setVirtual('action', false);
    return waitFor(() => f.state === 'waiting', 8);
  }
  async function sinkTo(depthPx) {
    inp.setVirtual('action', false);
    const ok = await waitFor(() => f.lure.y >= depthPx || (f.lure.y >= g.world.terrain.heightAt(f.lure.x) - 20), 20);
    inp.setVirtual('action', true); // engage the reel (one frame is enough) so the lure holds its depth
    await frame(); await frame();
    inp.setVirtual('action', false);
    await frame();
    return ok;
  }
  async function spawnAndBite(speciesId, sizeQ) {
    const { createFish } = await import('/src/entities/fishbase.js');
    const fish = createFish(speciesId, { x: f.lure.x + 20, y: f.lure.y, sizeQ, rng: g.rng, dir: g.boat.facing });
    fish.__bot = true;
    g.fish.list.push(fish);
    const ok = f.fishBite(fish);
    return { fish, ok };
  }
  async function setHook(when = 0.15) {
    if (f.state === 'fight') return true;
    await waitFor(() => f.state !== 'bite' || f.biteT / Math.max(0.01, f.biteWindow) >= when, 5);
    if (f.state !== 'bite') return f.state === 'fight';
    inp.tap('action');
    return waitFor(() => f.state === 'fight', 2);
  }
  function policyReel(policy, fish) {
    const t = f.tension;
    if (policy === 'always') return true;
    if (policy === 'never') return false;
    if (policy === 'smart' && fish && fish.state === 'jump') return false;
    if (policyReel.on) { if (t > 0.92) policyReel.on = false; } else if (t < 0.8) policyReel.on = true;
    return policyReel.on;
  }
  async function playFight(policy, timeoutS = 160) {
    const fish = f.hooked;
    let result = null, reason = '';
    const offs = [
      g.events.on('fightEnd', (p) => { result = p.result; }),
      g.events.on('escape', (p) => { reason = p.reason; }),
      g.events.on('landed', () => { result = 'landed'; }),
    ];
    policyReel.on = false;
    let maxT = 0, t0 = g.time.now, modes = {}, jumps = 0, runs = 0, preds = 0, held = 0, n = 0;
    const offJ = g.events.on('jump', () => jumps++), offR = g.events.on('run', () => runs++), offP = g.events.on('predatorStrike', () => preds++);
    while (!result && (f.state === 'fight') && g.time.now - t0 < timeoutS) {
      inp.setVirtual('action', policyReel(policy, f.hooked));
      maxT = Math.max(maxT, f.tension);
      modes[f.fight.mode] = (modes[f.fight.mode] || 0) + g.time.dt;
      if (f.line.out >= f.line.max - 1) held += g.time.dt;
      n++;
      await frame();
    }
    inp.setVirtual('action', false);
    offs.forEach((o) => o()); offJ(); offR(); offP();
    const dur = g.time.now - t0;
    if (!result) result = f.state === 'landing' || f.state === 'caught' ? 'landed' : 'timeout';
    return { result, reason, dur, maxT, modes, jumps, runs, preds, held, frames: n };
  }
  /** Non-blocking variant for node: B.result is null until the fight is over. */
  function startFight(policy, timeoutS) {
    B.result = null;
    playFight(policy, timeoutS).then((r) => { B.result = r; });
  }
  const B = { g, f, waitFor, gearFor, reset, cast, sinkTo, spawnAndBite, setHook, playFight, startFight, result: null, frame, sleep };
  return B;
})();
`;

export default async function run({ page, shot, sleep }) {
  const mode = env('BOT_MODE', 'table');
  await page.waitForFunction(() => window.__game && window.__game.time.frame > 5, { timeout: 15000 });
  await page.evaluate(DRIVER);
  if (mode === 'shots') return shots({ page, shot, sleep });
  return table({ page });
}

async function table({ page }) {
  const speciesArg = env('BOT_SPECIES', 'default');
  const species = speciesArg === 'all'
    ? await page.evaluate(async () => (await import('/src/data/species.js')).SPECIES.map((s) => s.id))
    : speciesArg === 'default' ? DEFAULT_SPECIES : speciesArg.split(',');
  const tackles = env('BOT_TACKLE', 'fair').split(',');
  const policyArg = env('BOT_POLICY', 'all');
  const policies = policyArg === 'all' ? ['smart', 'always', 'never'] : policyArg.split(',');
  const sizeQ = Number(env('BOT_SIZEQ', 0.5)), scale = Number(env('BOT_SCALE', 3)), depth = Number(env('BOT_DEPTH', 150));
  const rows = [];
  for (const sp of species) {
    for (const tk of tackles) {
      for (const policy of policies) {
        const r = await page.evaluate(async (sp, tk, policy, sizeQ, scale, depth) => {
          const B = window.__bot, g = B.g, f = B.f;
          const { SPECIES_BY_ID } = await import('/src/data/species.js');
          const { fishPower, baseDuration } = await import('/src/gameplay/fishing-fight.js');
          const def = SPECIES_BY_ID[sp];
          if (!def) return { error: 'unknown species ' + sp };
          g.time.scale = scale;
          await B.reset();
          const fishTmp = { species: def, sizeQ };
          const power = fishPower(fishTmp);
          const tackle = tk === 'fair' ? power : Number(tk);
          Object.assign(g.player.stats, B.gearFor(tackle));
          // (the real fish AI may hook something of its own meanwhile — retry a couple of times)
          let hooked = false, err = '';
          for (let attempt = 0; attempt < 3 && !hooked; attempt++) {
            await B.reset();
            if (!(await B.cast(0.7))) { err = 'cast failed (' + f.state + ')'; continue; }
            await B.sinkTo(depth);
            if (f.state !== 'waiting') { err = 'interrupted (' + f.state + ')'; continue; }
            const { ok } = await B.spawnAndBite(sp, sizeQ);
            if (!ok) { err = 'bite refused (' + f.state + ' inWater=' + f.lure.inWater + ' lure=' + (f.lure.x | 0) + ',' + (f.lure.y | 0) + ' boat=' + (g.boat.x | 0) + ' face=' + g.boat.facing + ' hooked=' + (f.hooked && f.hooked.speciesId) + ')'; continue; }
            if (!(await B.setHook(0.15))) { err = 'hook-set failed (' + f.state + ')'; continue; }
            hooked = f.hooked && f.hooked.__bot;
          }
          if (!hooked) return { error: err || 'could not hook the bot fish' };
          B.startFight(policy, 160);
          return { level: def.level, style: def.fight.style, power: power.toFixed(2), tackle: tackle.toFixed(2),
            ratio: (power / tackle).toFixed(2), T0: baseDuration(fishTmp).toFixed(1), lineM: g.player.stats.lineLengthM };
        }, sp, tk, policy, sizeQ, scale, depth);
        if (!r.error) {
          let res = null;
          while (!res) {
            await new Promise((ok) => setTimeout(ok, 400));
            res = await page.evaluate(() => window.__bot.result);
          }
          const errs = await page.evaluate(async () => { const B = window.__bot; await B.reset(); B.g.time.scale = 1; return [...B.g.errors.keys()]; });
          Object.assign(r, res, { errs });
        }
        rows.push({ species: sp, policy, ...r });
        const t = targetFor(r.level || 0);
        const inT = r.dur >= t[2] && r.dur <= t[3];
        console.log(fmtRow({ species: sp, policy, ...r }), r.result === 'landed' ? (inT ? '' : `  (target ${t[2]}–${t[3]}s)`) : '');
        if (r.errs && r.errs.length) console.log('   module errors:', r.errs.join(', '));
      }
    }
  }
  summarize(rows);
}

function fmtRow(r) {
  if (r.error) return `${r.species.padEnd(20)} ${r.policy.padEnd(7)} ERROR ${r.error}`;
  const modes = Object.entries(r.modes || {}).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(' ');
  return `${r.species.padEnd(20)} L${String(r.level).padEnd(2)} ${String(r.style).padEnd(10)} tk${r.tackle} r${r.ratio} ${r.policy.padEnd(7)} ` +
    `${String(r.result).padEnd(8)}${(r.reason || '').padEnd(6)} ${r.dur.toFixed(1).padStart(6)}s (T0 ${r.T0}) maxT ${r.maxT.toFixed(2)} line ${r.lineM}m held ${r.held.toFixed(1)}s runs ${r.runs} jumps ${r.jumps}${r.preds ? ' PREDATOR×' + r.preds : ''}  ${modes}`;
}

function summarize(rows) {
  const ok = rows.filter((r) => !r.error);
  const by = (p) => ok.filter((r) => r.policy === p);
  for (const p of ['smart', 'always', 'never']) {
    const rs = by(p);
    if (!rs.length) continue;
    const landed = rs.filter((r) => r.result === 'landed');
    const inTarget = landed.filter((r) => { const t = targetFor(r.level); return r.dur >= t[2] && r.dur <= t[3]; });
    const snapped = rs.filter((r) => r.result === 'snapped').length, escaped = rs.filter((r) => r.result === 'escaped').length;
    console.log(`\n[${p}] ${rs.length} fights: landed ${landed.length} (in target ${inTarget.length}), snapped ${snapped}, escaped ${escaped}, other ${rs.length - landed.length - snapped - escaped}`);
  }
}

/** Screenshots of every fishing state, written next to the --out path. */
async function shots({ page, shot, sleep }) {
  const fishId = env('BOT_FISH', 'mahi_mahi');
  const sizeQ = Number(env('BOT_SIZEQ', 0.6));
  const scale = Number(env('BOT_SCALE', 2));
  const ev = (js) => page.evaluate(`(async () => { const B = window.__bot, g = B.g, f = B.f, inp = g.input; ${js} })()`);
  const wait = (cond, t = 10) => ev(`return B.waitFor(() => ${cond}, ${t})`);
  const snap = async (name, cond, t) => { if (cond) await wait(cond, t); await ev('g.time.scale = 1'); await sleep(60); await shot(name); await ev(`g.time.scale = ${scale}`); };
  await ev(`g.time.scale = ${scale}; await B.reset();`);
  await snap('state-01-idle.png');
  await ev(`inp.setVirtual('action', true)`);
  await snap('state-02-charging.png', `f.state === 'charging' && f.charge > 0.8`, 4);
  await ev(`inp.setVirtual('action', false)`);
  await snap('state-03-casting.png', `f.state === 'casting' && f.stateT > 0.45`, 4);
  await wait(`f.state === 'waiting'`, 6);
  await ev(`await B.sinkTo(${Number(env('BOT_DEPTH', 300))})`);
  await ev(`inp.tap('action')`);
  await snap('state-04-waiting.png', `f.lure.twitchT < 0.3`, 2);
  await ev(`const { fishPower } = await import('/src/gameplay/fishing-fight.js'); const { SPECIES_BY_ID } = await import('/src/data/species.js');
    Object.assign(g.player.stats, B.gearFor(fishPower({ species: SPECIES_BY_ID['${fishId}'], sizeQ: ${sizeQ} })));`);
  // (the real fish AI may be busy with the lure — retry until our fish is the one on the hook)
  for (let attempt = 0; attempt < 4; attempt++) {
    const ok = await ev(`if (f.state !== 'waiting') { await B.reset(); await B.cast(0.7); await B.sinkTo(${Number(env('BOT_DEPTH', 300))}); }
      return (await B.spawnAndBite('${fishId}', ${sizeQ})).ok`);
    if (!ok) continue;
    if (attempt === 0) await snap('state-05-bite.png', `f.state === 'bite' && f.biteT > 0.15`, 3);
    await ev(`await B.setHook(0.2)`);
    if (await ev(`return f.state === 'fight' && f.hooked && f.hooked.__bot`)) break;
  }
  await snap('state-06-strike.png', `f.state === 'fight' && f.stateT > 0.12`, 3);
  await ev(`B.startFight('smart', 150)`);
  await snap('state-07-fight-run.png', `f.state !== 'fight' || (f.fight.mode === 'run' && f.fight.time > 1.5)`, 30);
  await snap('state-08-fight-jump.png', `f.state !== 'fight' || f.hooked.state === 'jump'`, 60);
  await snap('state-09-fight-late.png', `f.state !== 'fight' || f.fight.stamina < 0.3`, 90);
  await snap('state-10-landing.png', `f.state === 'landing' && f.stateT > 0.75 || ['caught','broken','idle'].includes(f.state)`, 90);
  await snap('state-11-caught.png', `['caught','broken','idle'].includes(f.state)`, 10);
  const res = await page.evaluate(() => window.__bot.result);
  console.log('fight result', JSON.stringify(res));
  // a loss: hopeless tackle, always reel → snap
  await ev(`await B.reset(); Object.assign(g.player.stats, B.gearFor(1.5)); await B.cast(0.7); await B.sinkTo(200); await B.spawnAndBite('yellowfin_tuna', 0.7); await B.setHook(0.15); B.startFight('always', 30)`);
  await snap('state-12-broken.png', `f.state === 'broken' && f.stateT > 0.25`, 40);
  await ev(`await B.reset()`);
  await snap('state-13-idle-after.png', `f.state === 'idle'`, 8);
}
