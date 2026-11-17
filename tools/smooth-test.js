// Is it smooth? Frame pacing on every busy screen, on a slowed-down CPU.
//   python3 -m http.server 8765        then:  node tools/smooth-test.js
// (APP_URL=… to point elsewhere; add ?look=classic for 经典. RATE=4 is the CPU slowdown.)
//
// A laptop hides jank a phone shows, so Chrome's CPU is throttled 4× (roughly a
// mid-range phone) and each scene is watched frame by frame: average rate, the
// 95th-percentile gap, the worst gap, and main-thread tasks over 50 ms. A scene
// fails when it averages under 50 fps or stalls for longer than 120 ms once it
// is running. Run it alone — other test runs on the same machine skew it.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const RATE = +(process.env.RATE || 4);
let pass = 0, fail = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function seed() {
  const cats = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, name: '项目' + i, icon: '⭐', pts: i % 3 ? 5 : -5, active: true }));
  const entries = Array.from({ length: 220 }, (_, i) => ({ id: 'e' + i, catId: 'c' + (i % 10), catName: '项目' + (i % 10), icon: '⭐', pts: i % 3 ? 5 : -5, desc: i % 4 ? '' : '备注 ' + i, charId: i % 2 ? 'char1' : 'char2', month: '2026-12', date: '2026-12-' + String(1 + (i % 28)).padStart(2, '0') }));
  return {
    mode: 'reward', rewardTarget: 300, punishThreshold: -80, entries: { '2026-12': entries },
    history: Array.from({ length: 24 }, (_, i) => ({ id: 'h' + i, month: `20${24 + Math.floor(i / 12)}-${String(1 + (i % 12)).padStart(2, '0')}`, char1: 120, char2: 90, mode: 'reward', settledAt: '2026-01-01' })), archive: [],
    letters: Array.from({ length: 60 }, (_, i) => ({ id: 'l' + i, from: i % 2 ? 'char1' : 'char2', text: '测试信 ' + i, date: '2026-10-01', opened: true })),
    photos: Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, image: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="hsl(${i * 30},70%,75%)"/></svg>`)}`, caption: '', date: '2026-01-01', by: 'char1' })),
    goalName: '旅行', goalIcon: '✈️', goalTarget: 2000,
    petName: '呆呆', petSpecies: 'dog', petExp: 2600, petBase: 0,
    petEquipped: JSON.stringify({ p: '', m: '', o: '', it: ['ag,16,30', 'aa,10,84', 'ab,78,72'] }),
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: cats, rewards: [], punishments: [], decorOwned: [],
  };
}

// Collect rAF gaps and long tasks while `act` runs (and for `ms` in total).
async function watch(p, ms, act) {
  await p.evaluate(() => {
    const F = window.__f = { gaps: [], long: [], last: 0, on: true };   // each watch owns its loop: a shared one would count frames twice
    const f = (t) => { if (!F.on) return; if (F.last) F.gaps.push(t - F.last); F.last = t; requestAnimationFrame(f); };
    requestAnimationFrame(f);
    try { window.__po = new PerformanceObserver(l => l.getEntries().forEach(e => F.long.push(Math.round(e.duration)))); window.__po.observe({ entryTypes: ['longtask'] }); } catch (e) {}
  });
  const t0 = Date.now();
  if (act) await act();
  const left = ms - (Date.now() - t0);
  if (left > 0) await sleep(left);
  return p.evaluate(() => {
    const F = window.__f; F.on = false; try { window.__po.disconnect(); } catch (e) {}
    const g = F.gaps.slice().sort((a, b) => a - b), sum = g.reduce((a, b) => a + b, 0);
    return { frames: g.length, fps: g.length ? 1000 / (sum / g.length) : 0, p95: g[Math.floor(g.length * .95)] || 0, worst: g[g.length - 1] || 0, long: F.long.length, longMax: Math.max(0, ...F.long) };
  });
}
function report(name, m, { fps = 50, worst = 120 } = {}) {
  const good = m.fps >= fps && m.worst <= worst;
  good ? pass++ : fail++;
  console.log(`  ${good ? '✅' : '❌'} ${name.padEnd(26)} ${m.fps.toFixed(0).padStart(3)} fps · p95 ${m.p95.toFixed(0).padStart(3)} ms · worst ${m.worst.toFixed(0).padStart(3)} ms · long tasks ${m.long}${m.long ? ` (max ${m.longMax} ms)` : ''}`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  async function open(when, theme = 'time') {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 3 });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.clock.setFixedTime(new Date(when + '+08:00'));
    await p.route(/open-meteo|supabase\.co/, r => r.abort());
    await p.addInitScript(([d, th]) => { if (sessionStorage.getItem('seeded')) return; localStorage.clear(); localStorage.setItem('love_score_data', JSON.stringify(d)); localStorage.setItem('theme_mode', th); sessionStorage.setItem('seeded', '1'); }, [seed(), theme]);
    const t0 = Date.now();
    await p.goto(APP_URL);
    await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
    await p.evaluate(() => document.getElementById('start-page')?.remove());
    await p.evaluate(() => App.demoMode());
    await p.waitForFunction(() => document.querySelectorAll('.entry-item').length > 0, null, { timeout: 15000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    await p.evaluate(() => document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary());
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    await sleep(1200);
    return { p, ctx, errs, loadMs };
  }

  console.log(`\nCPU slowed ${RATE}×, 390×844 at 3× pixels, a year of data (220 entries, 60 letters, 12 photos)\n`);
  {
    const { p, ctx, errs, loadMs } = await open('2026-12-10T21:00:00');
    console.log(`  load → home with data: ${loadMs} ms (unthrottled) · ${await p.evaluate(() => document.querySelectorAll('*').length)} nodes\n`);
    report('home, idle (night)', await watch(p, 3000));
    report('home, scrolling', await watch(p, 3000, async () => { await p.evaluate(() => new Promise(done => { const el = document.scrollingElement; const max = el.scrollHeight - innerHeight; const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 2400); el.scrollTop = max * (.5 - .5 * Math.cos(k * Math.PI * 2)); k < 1 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); })); }));
    await p.evaluate(() => scrollTo(0, 0));
    if (await p.$('.u3d-add')) {
      report('＋ sheet open, pick, close', await watch(p, 3000, async () => { await p.click('.u3d-add'); await sleep(800); await p.click('.u3d-cat >> nth=0'); await p.click('.u3d-cat >> nth=1'); await sleep(400); await p.evaluate(() => document.querySelector('.u3d-sheet-veil').click()); }));
    }
    report('积分表 → 历史 → 主页', await watch(p, 3600, async () => { await p.evaluate(() => App.nav('rewards')); await sleep(900); await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'))); await p.evaluate(() => App.nav('history')); await sleep(900); await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'))); await p.evaluate(() => App.nav('home')); }));
    report('记一笔 → refresh', await watch(p, 2500, async () => { await p.evaluate(() => App.quickEntry('c1')); }));
    report('小窝 opens, idle', await watch(p, 3500, async () => { await p.evaluate(() => App.showPetHome()); }));
    report('小窝, poke the pet', await watch(p, 2000, async () => { await p.evaluate(() => App.pokePet()); await sleep(500); await p.evaluate(() => App.pokePet()); }));
    report('接零食, playing', await watch(p, 4500, async () => { await p.evaluate(() => App.playGame('catch')); await sleep(300); await p.click('.mg-start'); await p.evaluate(() => new Promise(done => { const t0 = performance.now(); const f = (t) => { const g = App._mgTest(); if (g) g.x = .5 + .4 * Math.sin((t - t0) / 300); t - t0 < 3600 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); })); }));
    report('翻牌, 20 cards flipping', await watch(p, 4500, async () => {
      await p.evaluate(() => App.playGame('cards')); await sleep(500);
      for (let lv = 0; lv < 2; lv++) { const ks = await p.evaluate(() => [...new Set([...document.querySelectorAll('.mg-card')].map(c => c.dataset.k))]); for (const k of ks) { await p.evaluate((k) => document.querySelectorAll(`.mg-card[data-k="${k}"]`).forEach(c => c.click()), k); } await sleep(150); await p.evaluate(() => document.querySelector('.mg-next')?.click()); await sleep(200); }
      for (let i = 0; i < 8; i++) { await p.evaluate((i) => document.querySelectorAll('.mg-card')[i].click(), i); await sleep(140); }
    }));
    await p.evaluate(() => { App.closeGames(); App.closePetHome(); });
    report('我们的时光 opens', await watch(p, 3000, async () => { await p.evaluate(() => App.showLovePage()); }));
    console.log(errs.length ? `  ❌ page errors: ${errs.join(' | ')}` : '  ✅ no page errors'); errs.length ? fail++ : pass++;
    await ctx.close();
  }
  for (const [when, name] of [['2026-12-31T23:00:00', '跨年 fireworks (night)'], ['2026-12-24T21:00:00', '12-24 fireworks + balloons'], ['2027-02-06T21:00:00', '春节 fireworks']]) {
    const { p, ctx, errs } = await open(when);
    report(name, await watch(p, 6000));
    report(name.split(' ')[0] + ' + tapping the sky', await watch(p, 4000, async () => { for (let i = 0; i < 8; i++) { await p.mouse.click(30 + (i % 2) * 330, 120 + i * 20); await sleep(350); } }));
    report(name.split(' ')[0] + ' + scrolling', await watch(p, 3000, async () => { await p.evaluate(() => new Promise(done => { const el = document.scrollingElement; const max = el.scrollHeight - innerHeight; const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 2400); el.scrollTop = max * (.5 - .5 * Math.cos(k * Math.PI * 2)); k < 1 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); })); }));
    if (errs.length) { fail++; console.log(`  ❌ page errors: ${errs.join(' | ')}`); }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
