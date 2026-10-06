#!/usr/bin/env node
// Integration smoke test (dev only): boots the game in a matrix of situations in one headless Chrome,
// reports uncaught errors, module errors (game.errors), fps and the per-layer render cost.
//
//   node tools/smoke.mjs [--shots <dir>] [--only <substring>] [--wait 2500] [--w 1920 --h 1080]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
const BASE = process.env.FISHUP_URL || 'http://localhost:5173';
const W = Number(opt('--w', 1920)), H = Number(opt('--h', 1080));
const WAIT = Number(opt('--wait', 2500));
const shotsDir = opt('--shots', null);
const only = opt('--only', null);

const P = 'mode=play&nosave=1';
const CASES = [
  ['title', '/?nosave=1'],
  ['reef-noon', `/?${P}&time=12`],
  ['reef-sunset', `/?${P}&time=19.2&freeze=1`],
  ['reef-night', `/?${P}&time=23&freeze=1`],
  ['storm', `/?${P}&time=15&weather=storm`],
  ['kelp', `/?${P}&x=4000&cam=4000,700`],
  ['wreck', `/?${P}&x=6330&cam=6330,2800`],
  ['open-ocean', `/?${P}&x=8500&time=10`],
  ['midnight-zone', `/?${P}&x=9000&cam=9000,4300`],
  ['trench-vents', `/?${P}&x=11330&cam=11330,6700`],
  ['demo-fight', `/?${P}&demo=fight&fish=blue_marlin`],
  ['demo-caught', `/?${P}&demo=caught&fish=yellowtail_snapper`],
  ['zoomed-out', `/?${P}&cam=6000,300,0.55`],
  ['no-postfx', `/?${P}&off=postfx`],
].filter((c) => !only || c[0].includes(only));

const executablePath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean).find((p) => fs.existsSync(p));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishup-smoke-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir,
  args: [`--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--no-first-run', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

let failed = 0;
try {
  for (const [name, url] of CASES) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('UNCAUGHT ' + (e.message || e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console.error ' + m.text().slice(0, 300));
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`);
    });
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => {
      window.__fpsN = 0;
      window.__fpsT0 = performance.now();
      const tick = () => { window.__fpsN++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await sleep(WAIT);
    const info = await page.evaluate(() => {
      const g = window.__game;
      if (!g) return null;
      const prof = {};
      let total = 0;
      for (const k of g.renderer.order) {
        prof[k] = +g.renderer.prof[k].toFixed(2);
        total += g.renderer.prof[k];
      }
      return {
        fps: +((window.__fpsN * 1000) / (performance.now() - window.__fpsT0)).toFixed(1),
        total: +total.toFixed(2),
        prof,
        fish: g.fish.list.length,
        mods: Object.keys(g.mods),
        modErrors: [...g.errors].map(([k, v]) => `${k} ×${v.n}: ${v.msg}`),
      };
    });
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, name + '.png') });
    await page.close();
    const bad = errs.length || !info || info.modErrors.length;
    if (bad) failed++;
    console.log(`${bad ? '✗' : '✓'} ${name.padEnd(15)} ${info ? `${String(info.fps).padStart(5)} fps  render ${String(info.total).padStart(5)} ms  fish ${String(info.fish).padStart(3)}` : 'NO GAME OBJECT'}`);
    if (info) {
      const heavy = Object.entries(info.prof).filter(([, v]) => v >= 0.8).map(([k, v]) => `${k} ${v}`).join('  ');
      if (heavy) console.log(`    layers ≥0.8ms: ${heavy}`);
      for (const e of info.modErrors) console.log('    MODULE ERROR ' + e);
    }
    for (const e of [...new Set(errs)].slice(0, 8)) console.log('    ' + e);
  }
} finally {
  await browser.close().catch(() => {});
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} case(s) with problems` : '\nall clean');
process.exit(failed ? 1 : 0);
