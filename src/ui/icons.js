// UI module — the Fish Up icon set: one hidden SVG <symbol> sprite, referenced with <use>.
// Line icons are drawn on a 24×24 grid with 2px round strokes in currentColor (+ a 20% duotone fill);
// a few "currency" icons (coin, xp, trophy, gem) carry their own colours.

const LINE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const DUO = 'fill="currentColor" fill-opacity=".2"';
const SOLID = 'fill="currentColor" stroke="none"';

function gearPath(cx, cy, ro, ri, teeth) {
  const pts = [];
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 === 0 || i % 4 === 1 ? ro : ri;
    const da = (Math.PI * 2) / n / 2;
    const aa = i % 4 === 0 || i % 4 === 2 ? a + da * 0.35 : a - da * 0.35;
    pts.push(`${(cx + Math.cos(aa) * r).toFixed(2)} ${(cy + Math.sin(aa) * r).toFixed(2)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}

const CLOUD = 'M7 19h10.2a3.8 3.8 0 0 0 .5-7.57A5.6 5.6 0 0 0 6.9 10.2 4.4 4.4 0 0 0 7 19z';
const CLOUD_HI = 'M6.5 15.2h11a3.2 3.2 0 0 0 .4-6.36A4.8 4.8 0 0 0 8.6 7.9 3.7 3.7 0 0 0 6.5 15.2z';
const SUN_RAYS = (cx, cy, r1, r2) => {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    d += `M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`;
  }
  return d;
};

/** name → inner SVG markup (24×24) */
const SYMBOLS = {
  // ── currency / colour icons ──
  coin: `<circle cx="12" cy="12" r="9.6" fill="url(#fu-g-coin)" stroke="#6e420c" stroke-width="1.3"/>
    <circle cx="12" cy="12" r="6.9" fill="none" stroke="#fff3c4" stroke-opacity=".5" stroke-width="1.1"/>
    <path d="M7.4 12.2c1.6-2.4 4.6-3 6.9-1.1l1.9-1.5v5.2l-1.9-1.5c-2.3 1.9-5.3 1.3-6.9-1.1z" fill="#9a5c10" fill-opacity=".9"/>
    <circle cx="9.6" cy="11.7" r=".7" fill="#ffe9a8"/>
    <path d="M6.3 8.4a7 7 0 0 1 4.6-3" stroke="#fffbe8" stroke-opacity=".85" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  xp: `<path d="M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.66l-5.5 2.89 1.05-6.12L3.1 9.1l6.15-.9z" fill="url(#fu-g-xp)" stroke="#0a4570" stroke-width="1.25" stroke-linejoin="round"/>
    <path d="M12 6.1l1.55 3.15" stroke="#effcff" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`,
  trophy: `<path d="M7.2 4h9.6v4.6a4.8 4.8 0 0 1-9.6 0z" fill="url(#fu-g-coin)" stroke="#6e420c" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M7.2 5.6H4.6v1.1a3.4 3.4 0 0 0 3.1 3.4M16.8 5.6h2.6v1.1a3.4 3.4 0 0 1-3.1 3.4" fill="none" stroke="#d29b35" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 13.4v3.2" stroke="#b27a22" stroke-width="2"/>
    <path d="M8.3 20.2h7.4l-.9-3.4H9.2z" fill="url(#fu-g-coin)" stroke="#6e420c" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M9.4 5.6v2.6" stroke="#fffbe8" stroke-opacity=".8" stroke-width="1.2" stroke-linecap="round"/>`,
  gem: `<path d="M6.5 4.5h11l3.5 5-9 10.5L3 9.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M6.5 4.5h11l3.5 5H3z" fill="#fff" fill-opacity=".35"/>
    <path d="M3 9.5h18M8.6 9.5 12 20l3.4-10.5M9.5 4.5l-.9 5M14.5 4.5l.9 5" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1"/>`,
  // ── HUD / navigation ──
  shop: `<g ${LINE}><path d="M4.5 8.5h15l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3z" ${DUO}/><path d="M8.8 8.5V7a3.2 3.2 0 0 1 6.4 0v1.5"/><path d="M8.8 12.2v.1M15.2 12.2v.1"/></g>`,
  book: `<g ${LINE}><path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" ${DUO}/><path d="M5 20a2 2 0 0 0 2 2h12v-4"/>
    <path d="M8.6 10.6c1.4-1.8 3.9-2.1 5.6-.6l1.6-1.2v3.6l-1.6-1.2c-1.7 1.5-4.2 1.2-5.6-.6z" ${SOLID}/></g>`,
  scroll: `<g ${LINE}><path d="M8 4h9.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 4a2.5 2.5 0 0 0-2.5 2.5v11" /><path d="M16 9v8.5a2.5 2.5 0 0 1-2.5 2.5H5.5a2.5 2.5 0 0 1-2.5-2.5V17h10.5v.5a2.5 2.5 0 0 0 2.5 2.5" ${DUO}/><path d="M9 9.5h3.5M9 13h3.5"/></g>`,
  cog: `<g ${LINE}><path d="${gearPath(12, 12, 9.4, 7.2, 8)}" ${DUO}/><circle cx="12" cy="12" r="3"/></g>`,
  pause: `<g ${SOLID}><rect x="6.2" y="5" width="4.1" height="14" rx="1.3"/><rect x="13.7" y="5" width="4.1" height="14" rx="1.3"/></g>`,
  play: `<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.3-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>`,
  sound: `<g ${LINE}><path d="M3.8 9.4h3.4L12 5.2v13.6l-4.8-4.2H3.8z" ${DUO}/><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.3a8 8 0 0 1 0 11.4"/></g>`,
  mute: `<g ${LINE}><path d="M3.8 9.4h3.4L12 5.2v13.6l-4.8-4.2H3.8z" ${DUO}/><path d="M16 9.5l5 5M21 9.5l-5 5"/></g>`,
  music: `<g ${LINE}><path d="M9 18V5.5l11-2.2v12.5"/><circle cx="6.5" cy="18" r="2.6" ${DUO}/><circle cx="17.4" cy="15.8" r="2.6" ${DUO}/></g>`,
  sfx: `<g ${LINE}><path d="M12 3c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6z" ${DUO}/><path d="M18.5 15.5v4M16.5 17.5h4M5 16.5v2.5M3.75 17.75h2.5"/></g>`,
  monitor: `<g ${LINE}><rect x="3" y="4.5" width="18" height="12" rx="2.2" ${DUO}/><path d="M8.5 20h7M12 16.5V20"/></g>`,
  keyboard: `<g ${LINE}><rect x="2.5" y="6" width="19" height="12.5" rx="2.4" ${DUO}/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 14h.01M17 14h.01M9.5 14h5"/></g>`,
  close: `<g ${LINE}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></g>`,
  check: `<g ${LINE} stroke-width="2.6"><path d="M5 12.6l4.6 4.6L19.2 7.4"/></g>`,
  lock: `<g ${LINE}><rect x="5" y="10.4" width="14" height="10.1" rx="2.6" ${DUO}/><path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4"/><path d="M12 14.4v2.2"/></g>`,
  info: `<g ${LINE}><circle cx="12" cy="12" r="9" ${DUO}/><path d="M12 11v5.5M12 7.6v.1"/></g>`,
  warn: `<g ${LINE}><path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z" ${DUO}/><path d="M12 9.5v4M12 16.7v.1"/></g>`,
  back: `<g ${LINE}><path d="M14.5 5.5L8 12l6.5 6.5"/></g>`,
  next: `<g ${LINE}><path d="M9.5 5.5L16 12l-6.5 6.5"/></g>`,
  up: `<g ${LINE}><path d="M12 19V5.5M6 11.5l6-6 6 6"/></g>`,
  down: `<g ${LINE}><path d="M12 5v13.5M6 12.5l6 6 6-6"/></g>`,
  exit: `<g ${LINE}><path d="M14 4h3.8A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2H14"/><path d="M10 8l-4 4 4 4M6 12h10"/></g>`,
  trash: `<g ${LINE}><path d="M4.5 7h15M9.5 7V4.6h5V7"/><path d="M6.5 7l1 12.6a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12.6" ${DUO}/><path d="M10 11v6M14 11v6"/></g>`,
  star: `<g ${LINE}><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" ${DUO}/></g>`,
  medal: `<g ${LINE}><path d="M8 3h3l1.6 5.4M16 3h-3l-1 3.2"/><circle cx="12" cy="15" r="5.8" ${DUO}/><path d="M12 12.3l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" ${SOLID}/></g>`,
  target: `<g ${LINE}><circle cx="12" cy="12" r="9" ${DUO}/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" ${SOLID}/></g>`,
  sparkle: `<path d="M12 2.5c.7 5.2 2.8 7.3 8 8-5.2.7-7.3 2.8-8 8-.7-5.2-2.8-7.3-8-8 5.2-.7 7.3-2.8 8-8z" fill="currentColor"/><path d="M19 15.5c.25 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9z" fill="currentColor" opacity=".7"/>`,
  flame: `<g ${LINE}><path d="M12 21.2a6.4 6.4 0 0 0 6.4-6.4c0-3.6-2.5-5.6-3.7-9.4-1.1 1.6-1.6 3.1-1.3 4.8-1.8-1.4-3.1-3.2-3.1-5.8-3 2.3-4.7 6.1-4.7 10.4a6.4 6.4 0 0 0 6.4 6.4z" ${DUO}/><path d="M12 21.2a2.8 2.8 0 0 1-2.8-2.8c0-1.9 1.6-3 2.8-4.9 1.2 1.9 2.8 3 2.8 4.9a2.8 2.8 0 0 1-2.8 2.8z"/></g>`,
  leaf: `<g ${LINE}><path d="M5 19.5C5 11 10.2 5 19.5 4.5 19.5 14 14 19.5 5 19.5z" ${DUO}/><path d="M5 19.5c3-4.2 6.2-7 10-9.2"/></g>`,
  heart: `<g ${LINE}><path d="M12 20s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.8 2.6C19.8 15.4 12 20 12 20z" ${DUO}/></g>`,
  anchor: `<g ${LINE}><circle cx="12" cy="5" r="2.1"/><path d="M12 7.1V20.5M8 10.5h8M4.5 13.5a7.5 7.5 0 0 0 15 0M4.5 13.5l-1 1.6M19.5 13.5l1 1.6"/></g>`,
  compass: `<g ${LINE}><circle cx="12" cy="12" r="9" ${DUO}/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" ${SOLID}/></g>`,
  calendar: `<g ${LINE}><rect x="3.8" y="5.2" width="16.4" height="15" rx="2.6" ${DUO}/><path d="M3.8 10h16.4M8.4 3.4v3.6M15.6 3.4v3.6"/></g>`,
  clock: `<g ${LINE}><circle cx="12" cy="12" r="8.8" ${DUO}/><path d="M12 7.2V12l3.2 2"/></g>`,
  timer: `<g ${LINE}><circle cx="12" cy="13.3" r="7.6" ${DUO}/><path d="M12 9.6v3.9l2.4 1.5M9.8 2.8h4.4M18.4 6.6l1.3-1.3"/></g>`,
  depth: `<g ${LINE}><path d="M12 3v11M8 10.4l4 4 4-4"/><path d="M3.4 19.2c1.4 1.2 2.9 1.2 4.3 0s2.9-1.2 4.3 0 2.9 1.2 4.3 0 2.9-1.2 4.3 0"/></g>`,
  wave: `<g ${LINE}><path d="M3 9.5c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M3 15c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/></g>`,
  ruler: `<g ${LINE}><path d="M3.5 16.4L16.4 3.5l4.1 4.1L7.6 20.5z" ${DUO}/><path d="M7.4 12.5l1.8 1.8M10.2 9.7l1.3 1.3M13 6.9l1.8 1.8"/></g>`,
  weight: `<g ${LINE}><path d="M7.4 8.6h9.2l2.6 10.6a1.4 1.4 0 0 1-1.4 1.8H6.2a1.4 1.4 0 0 1-1.4-1.8z" ${DUO}/><path d="M9.6 8.6a2.4 2.4 0 1 1 4.8 0"/></g>`,
  fish: `<g ${LINE}><path d="M2.8 12c3-4.6 9.3-5.6 13.8-2l3.6-2.8v9.6L16.6 14c-4.5 3.6-10.8 2.6-13.8-2z" ${DUO}/><path d="M7.6 11.2v.1" stroke-width="2.6"/></g>`,
  hook: `<g ${LINE}><circle cx="14" cy="3.8" r="1.6"/><path d="M14 5.4v9.4a4.8 4.8 0 0 1-9.6 0v-2.6l2.8 2.2"/></g>`,
  bottle: `<g ${LINE}><path d="M10 2.8h4v3.6l1.6 2.6v10.6a1.8 1.8 0 0 1-1.8 1.8h-3.6a1.8 1.8 0 0 1-1.8-1.8V9l1.6-2.6z" ${DUO}/><path d="M10.4 12.5h3.2M10.4 15.5h3.2"/></g>`,
  chest: `<g ${LINE}><path d="M3.5 11h17v7.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z" ${DUO}/><path d="M3.5 11V9a4.5 4.5 0 0 1 4.5-4.5h8A4.5 4.5 0 0 1 20.5 9v2"/><rect x="10.4" y="9.6" width="3.2" height="4.2" rx=".8"/></g>`,
  boot: `<g ${LINE}><path d="M6 3.5h6v8.5l6.2 2.4a2.8 2.8 0 0 1 1.8 2.6v2.5H4.5V12z" ${DUO}/><path d="M4.5 16h15.5"/></g>`,
  eye: `<g ${LINE}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" ${DUO}/><circle cx="12" cy="12" r="3"/></g>`,
  crown: `<g ${LINE}><path d="M4 8l4 4 4-6.5L16 12l4-4-1.6 10.5H5.6z" ${DUO}/></g>`,
  map: `<g ${LINE}><path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" ${DUO}/><path d="M9 4.5v13M15 6.5v13"/></g>`,

  // ── weather & time ──
  sun: `<g ${LINE}><circle cx="12" cy="12" r="4.2" ${DUO}/><path d="${SUN_RAYS(12, 12, 7, 9.4)}"/></g>`,
  moon: `<g ${LINE}><path d="M19.6 14.6A8.2 8.2 0 1 1 9.4 4.4a6.4 6.4 0 0 0 10.2 10.2z" ${DUO}/></g>`,
  'w-clear': `<g ${LINE}><circle cx="12" cy="12" r="4.2" ${DUO}/><path d="${SUN_RAYS(12, 12, 7, 9.4)}"/></g>`,
  'w-fair': `<g ${LINE}><circle cx="9" cy="8.6" r="3.2"/><path d="${SUN_RAYS(9, 8.6, 5.4, 7.2)}" /><path d="M9 19h9a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.4-.9A3.9 3.9 0 0 0 9 19z" fill="currentColor" fill-opacity=".35"/></g>`,
  'w-cloudy': `<g ${LINE}><path d="${CLOUD_HI}" opacity=".55"/><path d="${CLOUD}" transform="translate(1.5 1)" ${DUO}/></g>`,
  'w-rain': `<g ${LINE}><path d="${CLOUD_HI}" ${DUO}/><path d="M8.5 18l-1 2.6M12.5 18l-1 2.6M16.5 18l-1 2.6"/></g>`,
  'w-storm': `<g ${LINE}><path d="${CLOUD_HI}" ${DUO}/><path d="M12.8 15.2l-2.6 3.8h3.2l-2.2 3.4" stroke-width="2.2"/></g>`,
  'w-fog': `<g ${LINE}><path d="${CLOUD_HI}" opacity=".7"/><path d="M4 18.2h11M8 21h12"/></g>`,

  // ── gear ──
  rod: `<g ${LINE}><path d="M3.5 20.5L19 4.2"/><path d="M19 4.2c1.6 3.4 1.9 7.4 1.1 11.6"/><circle cx="7.8" cy="16" r="2.4" ${DUO}/><path d="M20.1 15.8v1.6a1.6 1.6 0 0 1-3.2 0"/></g>`,
  reel: `<g ${LINE}><circle cx="11" cy="11.5" r="6.4" ${DUO}/><circle cx="11" cy="11.5" r="2"/><path d="M17.4 11.5h3.1v3.2M7.6 20.5h6.8M11 17.9v2.6"/></g>`,
  line: `<g ${LINE}><ellipse cx="12" cy="5.6" rx="7" ry="2.2"/><path d="M5 5.6v12.8c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2V5.6" ${DUO}/><path d="M5 10c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2M5 14.2c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2"/></g>`,
  boat: `<g ${LINE}><path d="M2.8 14.4h18.4l-2.4 4.6a2 2 0 0 1-1.8 1.1H7a2 2 0 0 1-1.8-1.1z" ${DUO}/><path d="M7 14.4V9.6h6.2l2.6 4.8M9.6 9.6V6.4"/></g>`,
  gadget: `<g ${LINE}><rect x="3.4" y="7.6" width="17.2" height="11.4" rx="2.2" ${DUO}/><path d="M9 7.6V5.6h6v2M3.4 12.4h17.2M10.4 12.4v2.2h3.2v-2.2"/></g>`,
  sonar: `<g ${LINE}><circle cx="12" cy="12" r="1.8" ${SOLID}/><path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/></g>`,
  lamp: `<g ${LINE}><path d="M9 6.4h6l1.2 3v7.8a2 2 0 0 1-2 2H9.8a2 2 0 0 1-2-2V9.4z" ${DUO}/><path d="M10 6.4V4.6h4v1.8M12 2.6v2M8.4 21.2h7.2"/><path d="M12 10.4c1 1.2 1.4 2.1 1.4 2.9a1.4 1.4 0 0 1-2.8 0c0-.8.4-1.7 1.4-2.9z" ${SOLID}/></g>`,
  sinker: `<g ${LINE}><path d="M12 6.4c3.6 3.6 5.6 6.6 5.6 9.2a5.6 5.6 0 0 1-11.2 0c0-2.6 2-5.6 5.6-9.2z" ${DUO}/><circle cx="12" cy="4" r="1.6"/></g>`,
  clover: `<g ${LINE}><path d="M12 12c-1.4-1.6-4.6-1.4-4.6-4a2.3 2.3 0 0 1 4.6 0 2.3 2.3 0 0 1 4.6 0c0 2.6-3.2 2.4-4.6 4z" ${DUO}/><path d="M12 12c-1.4 1.6-4.6 1.4-4.6 4a2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.6 0c0-2.6-3.2-2.4-4.6-4z" ${DUO}/><path d="M12 12c2 1.8 4 4.8 3.4 8.6"/></g>`,
};

let sprite = null;

/** Insert the sprite (once) into `root`. */
export function mountIcons(root) {
  if (sprite && sprite.isConnected) return sprite;
  const ns = 'http://www.w3.org/2000/svg';
  sprite = document.createElementNS(ns, 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('class', 'fu-sprite');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
  let html = `<defs>
    <linearGradient id="fu-g-coin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff2b8"/><stop offset=".42" stop-color="#ffd25a"/><stop offset=".78" stop-color="#e79e25"/><stop offset="1" stop-color="#b86d10"/>
    </linearGradient>
    <linearGradient id="fu-g-xp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6fdff"/><stop offset=".45" stop-color="#5fe0ff"/><stop offset="1" stop-color="#1c7fd6"/>
    </linearGradient>
    <linearGradient id="fu-g-gem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3e2ff"/><stop offset=".5" stop-color="#b47bff"/><stop offset="1" stop-color="#5a2fd0"/>
    </linearGradient>
  </defs>`;
  for (const name in SYMBOLS) html += `<symbol id="fu-i-${name}" viewBox="0 0 24 24">${SYMBOLS[name]}</symbol>`;
  sprite.innerHTML = html;
  root.prepend(sprite);
  return sprite;
}

/** Icon markup: <svg class="fu-ico …"><use href="#fu-i-name"/></svg> */
export function icon(name, cls = '') {
  if (!SYMBOLS[name]) name = 'info';
  return `<svg class="fu-ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#fu-i-${name}"/></svg>`;
}
/** Icon as an element. */
export function iconEl(name, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = icon(name, cls);
  return t.content.firstElementChild;
}
export const hasIcon = (name) => !!SYMBOLS[name];
export const ICON_NAMES = Object.keys(SYMBOLS);

export const WEATHER_ICON = { clear: 'w-clear', fair: 'w-fair', cloudy: 'w-cloudy', rain: 'w-rain', storm: 'w-storm', fog: 'w-fog' };

/** Pick an icon for a shop item. */
export function gearIcon(item) {
  const slot = item && item.slot;
  if (slot === 'rod' || slot === 'reel' || slot === 'line' || slot === 'boat') return slot;
  if (slot === 'lure') return 'hook';
  const key = ((item && (item.id + ' ' + item.name)) || '').toLowerCase();
  if (/kraken|eye/.test(key)) return 'eye';
  if (/doubloon|coin/.test(key)) return 'coin';
  if (/sonar|finder|radar/.test(key)) return 'sonar';
  if (/lamp|light|lantern|torch/.test(key)) return 'lamp';
  if (/weight|sinker|lead|ballast/.test(key)) return 'sinker';
  if (/luck|charm|clover|horseshoe|amulet|talisman/.test(key)) return 'clover';
  if (/hook/.test(key)) return 'hook';
  return 'gadget';
}
