// Furniture art sheet — the "draw it, then LOOK at it" step (CLAUDE.md §7.1).
// Serve the repo first:  python3 -m http.server 8765
// then:  node tools/artsheet.js [--season 万圣节,秋] [--date 2026-10-30] [--room path.json]
//
// Writes PNGs to $SHOTS (default /tmp):
//   artsheet_catalog.png   every piece big AND at true in-room size, light + dark
//   artsheet_room_*.png    a furnished room at day / dusk / night on --date
//   artsheet_shop_*.png    the shop tabs as the couple would see them that day
//
// No test can tell you a drawing is ugly — three of the first 21 passed every
// automated check and still read as a fragment, a lollipop and a tent. This
// produces the pictures; a person (or Claude) still has to look at them.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs');
const APP_URL = 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SEASONS = (arg('--season', '') || '').split(',').filter(Boolean);
const DATE = arg('--date', '2026-10-30');
const ROOM = arg('--room', '');        // optional saved-room JSON (e.g. a real layout), never committed
const sleep = ms => new Promise(r => setTimeout(r, ms));

// One sample room: the starter pieces plus whatever is being reviewed, spread
// over the wall band and the floor so nothing overlaps.
// Kept clear of the pet (centre), the window (top right) and the speech bubble.
const WALL = [[40, 34], [58, 40], [24, 20], [86, 48]];
const FLOOR = [[24, 95], [66, 84], [82, 95], [36, 84], [92, 82], [12, 88], [56, 97]];

function seed(decorIds, catalog, roomJson) {
  let wi = 0, fi = 0;
  const items = [
    { i: 'pic_couple', x: 16, y: 30 }, { i: 'plant_pot', x: 8, y: 80 }, { i: 'sofa_blue', x: 78, y: 70 },
  ];
  for (const id of decorIds) {
    const it = catalog[id];
    if (!it || it.slot === 'outfit' || it.slot === 'paper' || it.slot === 'mat') continue;
    const [x, y] = it.slot === 'wall' ? WALL[wi++ % WALL.length] : FLOOR[fi++ % FLOOR.length];
    items.push({ i: id, x, y });
  }
  const eq = roomJson || JSON.stringify({ p: '', m: '', o: '', it: items.map(o => `${catalog[o.i].k || o.i},${o.x},${o.y}`) });
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: {}, history: [], archive: [],
    letters: [], photos: [], goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '呆呆', petSpecies: 'dog', petExp: 2600, petBase: 0, petEquipped: eq, wx1: '', wx2: '',
    charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [], rewards: [], punishments: [],
    decorOwned: decorIds.map((id, n) => ({ id: 'd' + n, itemId: id, owner: 'char1', itemName: id, itemIcon: '', ptsSpent: 0 })),
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  // Read the live catalog straight out of the app, so the sheet can never
  // drift from what actually ships.
  const probe = await (await browser.newContext()).newPage();
  await probe.route(/open-meteo|supabase\.co/, r => r.abort());
  await probe.goto(APP_URL);
  await probe.waitForFunction(() => typeof App !== 'undefined' && App._decorTest);
  const catalog = await probe.evaluate(() => {
    const out = {};
    for (const [id, it] of Object.entries(App._decorTest())) {
      out[id] = { k: it.k, name: it.name, slot: it.slot, ratio: it.ratio, svg: it.svg || '', season: it.season || '',
                  year: it.year || 0, price: it.price, from: it.from, to: it.to, draw: it.draw || '' };
    }
    return out;
  });
  const chosen = Object.keys(catalog).filter(id => !SEASONS.length || SEASONS.includes(catalog[id].season));
  console.log(`${chosen.length} pieces: ${chosen.map(id => catalog[id].name).join('、')}`);

  // ── 1. catalog: big + true size, on both themes ──
  const PET_H = 154;                        // --pet-h on a 390px phone
  const cell = (id, dark) => {
    const it = catalog[id];
    if (!it.svg) return '';
    const real = Math.round(PET_H * (it.ratio || 0.5));
    return `<div class="cell ${dark ? 'dark' : ''}">
      <div class="big">${it.svg}</div>
      <div class="real" style="font-size:${real}px">${it.svg}</div>
      <div class="lbl">${it.name}<br><small>${it.slot} · ${it.ratio} → ${real}px${it.year ? ' · ' + it.year : ''}</small></div></div>`;
  };
  const sheet = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;font:13px -apple-system,"PingFang SC",sans-serif;background:#eee}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px}
    .cell{background:#FBF7F2;border-radius:14px;padding:10px;display:grid;grid-template-columns:150px 1fr;align-items:end;gap:8px}
    .cell.dark{background:#2A2450;color:#eee}
    .big svg{width:150px;height:150px;display:block}
    .real .decor-svg{width:1em;height:1em;display:block;filter:drop-shadow(0 5px 5px rgba(0,0,0,.3))}
    .lbl{grid-column:1/-1;font-weight:700}.lbl small{font-weight:400;opacity:.7}
  </style><div class="grid">${chosen.map(id => cell(id, false) + cell(id, true)).join('')}</div>`);
  await sleep(300);
  await sheet.screenshot({ path: `${SHOTS}/artsheet_catalog.png`, fullPage: true });

  // ── 2. a furnished room, day / dusk / night ──
  let roomJson = null;
  if (ROOM) roomJson = fs.readFileSync(ROOM, 'utf8').trim();
  for (const [label, hour] of [['day', '11:00'], ['dusk', '17:40'], ['night', '21:30']]) {
    for (const w of [390, 820]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(String(e)));
      await p.clock.setFixedTime(new Date(`${DATE}T${hour}:00+08:00`));
      await p.route(/open-meteo|supabase\.co/, r => r.abort());
      const data = seed(chosen, catalog, roomJson);
      await p.addInitScript(d => { localStorage.clear(); localStorage.setItem('love_score_data', JSON.stringify(d)); localStorage.setItem('theme_mode', 'time'); }, data);
      await p.goto(APP_URL);
      await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
      await p.evaluate(() => document.getElementById('start-page')?.remove());
      await p.evaluate(() => App.demoMode()); await sleep(400);
      // on an anniversary the film's envelope opens over everything (§7.257)
      await p.evaluate(() => document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary());
      await p.evaluate(() => App.showPetHome()); await sleep(900);
      await p.screenshot({ path: `${SHOTS}/artsheet_room_${label}_${w}.png` });
      if (label === 'day' && w === 390) {
        await p.evaluate(() => App.openDecor()); await sleep(400);
        for (const tab of ['floor', 'wall', 'outfit']) {
          await p.evaluate(t => App.decorTab(t), tab); await sleep(250);
          await p.screenshot({ path: `${SHOTS}/artsheet_shop_${tab}.png` });
        }
      }
      if (errs.length) console.log(`  ⚠️ ${label} ${w}: ${errs.join(' | ')}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`wrote ${SHOTS}/artsheet_*.png — now LOOK at them.`);
})();
