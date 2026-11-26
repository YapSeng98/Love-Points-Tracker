// 我们的家 in a browser, on demo data and a faked clock (CLAUDE.md §7.34).
//   python3 -m http.server 8765        then:  node tools/home-test.js
// (or APP_URL=http://localhost:PORT/index.html; add ?look=classic for 经典)
//
// The garden is a set of rules about days, so most of this is the calendar: a flower takes five
// waterings (three days when both of you water), one watering per person per pot per day, three dry
// days droop a growing plant and the watering that saves it doesn't count, a flower is picked once and
// is pet EXP +20 (小窝币 +10). Then every way to move (a tap anywhere on a floor, into the room and out of it, the
// stick, the keys, walls that are wall at the back and a doorway at the front, the stairs, further back drawn smaller
// and behind the furniture, a view that follows you through a bigger house), the upgrades and festival pieces paid from the one wallet, the
// festivals arriving by date, a save whose answer is lost on the way back, actions kept when the
// network is down, and the screen at 360–1280 in both themes and with reduced motion.
// Two phones are tools/home-live-test.js. BROWSER=webkit runs it all in WebKit (the iPhone's engine).

const { chromium, webkit } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), os = require('os');
const WEBKIT = process.env.BROWSER === 'webkit';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean), want = (n) => !ONLY.length || ONLY.includes(String(n));   // ONLY=2,7 runs those sections
function launch() {
  if (!WEBKIT) return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  // this playwright-core expects a different WebKit build than the one installed, so name it (CLAUDE.md §7.31)
  const dir = path.join(os.homedir(), 'Library/Caches/ms-playwright'), wk = fs.readdirSync(dir).find(d => d.startsWith('webkit-'));
  return webkit.launch({ executablePath: path.join(dir, wk, 'pw_run.sh') });
}
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const own = (ids) => ids.map((id, n) => ({ id: 'h' + n, itemId: id, owner: 'char1', itemName: id, itemIcon: '', ptsSpent: 0 }));
function seed({ exp = 0, owned = [], save = null, entries = {} } = {}) {
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries, history: [], archive: [], letters: [], photos: [],
    goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '呆呆', petSpecies: 'dog', petExp: exp, petBase: 0,
    petEquipped: JSON.stringify({ p: '', m: '', o: '', it: ['ag,16,30', 'aa,16,87', 'ab,78,87', 'ae,44,72'] }),
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [], rewards: [], punishments: [], decorOwned: own(owned), gameSaves: save ? { home: save } : {},
  };
}
// 1600 points this month: the pet's EXP is 1600 and the wallet 800 小窝币
const POINTS = (n = 1600) => ({ '2026-11': [{ id: 'e1', catId: '', catName: '测试', icon: '🧪', pts: n, desc: 'test', charId: 'char1', month: '2026-11', date: '2026-11-01' }] });

async function open(browser, { when = '2026-11-25T15:00:00', theme = 'light', w = 390, h = 844, data = seed(), reduced = false, hinted = true, touch = true, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, hasTouch: touch, ...(mobile ? { isMobile: true } : {}), reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await p.clock.setFixedTime(new Date(when + '+08:00'));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, th, hn]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d));
    localStorage.setItem('theme_mode', th);
    if (hn) localStorage.setItem('hm_hinted', '1');
    sessionStorage.setItem('seeded', '1');
  }, [data, theme, hinted]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode()); await sleep(450);
  await p.evaluate(() => { document.getElementById('anv-root')?.remove(); document.querySelector('.bdf-root')?.remove(); });
  return { p, ctx, errs };
}
const enter = async (p) => { await p.evaluate(() => App.openHome()); await p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 15000 }); await sleep(300); };
const st = (p) => p.evaluate(() => HomeGame.test.state());
const idle = (p) => p.waitForFunction(() => { const s = HomeGame.test.state(); return s && !s.pending && !s[s.me].path; }, null, { timeout: 15000 }).then(() => true, () => false);
const toast = (p) => p.evaluate(() => document.querySelector('.hm-toast')?.textContent || '');
const saved = async (p) => (JSON.parse(await p.evaluate(() => localStorage.getItem('love_score_data'))).gameSaves || {}).home || null;
const at = async (p, iso) => { await p.clock.setFixedTime(new Date(iso + '+08:00')); await p.evaluate(() => { App._tickTest(); HomeGame.test.tick(); }); await sleep(120); };
const potXY = (p, i) => p.evaluate((i) => { const r = document.querySelector(`.hm-pot[data-i="${i}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * .6]; }, i);
const tapPot = async (p, i) => { await settle(p); const [x, y] = await potXY(p, i); await p.mouse.click(x, y); };
// the house is full screen: a place in the house (x in units, y in %) → where it is on the screen right now
const screenAt = (p, x, y) => p.evaluate(([x, y]) => { const s = HomeGame.test.state(), b = document.querySelector('.hm-band').getBoundingClientRect(); return [b.left + (x - s.camX) * s.W / 100, b.top + y / 100 * s.H]; }, [x, y]);
// the menus open sheets (one at a time); walking to the garden or back is a button in 🌱 花园
const sheet = async (p, kind) => { if (await p.evaluate(() => !!document.querySelector('.hm-sheet'))) await p.click('.hm-sheet [data-a="close-sheet"]'); await p.click(`[data-sheet="${kind}"]`); await sleep(150); };
// the view eases after you: wait until it has stopped moving before measuring where things are on screen
const settle = async (p) => { let last = null; for (let k = 0; k < 40; k++) { const c = await p.evaluate(() => HomeGame.test.state().camX); if (last !== null && Math.abs(c - last) < .01) return; last = c; await sleep(120); } };
const go = async (p, where) => { await sheet(p, 'garden'); await p.click(`.hm-sheet [data-go="${where}"]`); };

(async () => {
  const browser = await launch();
  console.log(WEBKIT ? '(WebKit)' : '(Chrome)');

  if (want(1)) {
  console.log('\n1. The rules on their own');
  {
    const { p, ctx, errs } = await open(browser);
    await enter(p);
    const r = await p.evaluate(() => {
      const T = HomeGame.test, g = (w, today) => T.grow({ seed: 'daisy', at: '2026-11-01', w }, today);
      const days = (n, bits = 1, from = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-11-${String(from + i).padStart(2, '0')}`, bits]));
      return {
        alone: [1, 2, 3, 4, 5].map(n => g(days(n), `2026-11-0${n}`).stage),
        both: [1, 2, 3].map(n => g(days(n, 3), `2026-11-0${n}`).stage),
        mixed: g({ '2026-11-01': 3, '2026-11-02': 1, '2026-11-03': 2 }, '2026-11-03').stage,
        dry2: g(days(1), '2026-11-03').wilted, dry3: g(days(1), '2026-11-04').wilted,
        revive: g({ '2026-11-01': 1, '2026-11-04': 1 }, '2026-11-04'), after: g({ '2026-11-01': 1, '2026-11-04': 1, '2026-11-05': 1 }, '2026-11-05').stage,
        bloomDry: g(days(5), '2026-11-30'), seedDry: T.grow({ seed: 'daisy', at: '2026-11-01', w: {} }, '2026-11-30'),
        ahead: g({ '2026-11-01': 1, '2026-11-02': 1 }, '2026-11-01').stage,
        // the actions
        plantFull: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: {} }], picked: 0 }, { t: 'plant', pot: 0, seed: 'rose', id: 'b', who: 'char1', date: '2026-11-01' }),
        plantBad: T.apply({ pots: [], picked: 0 }, { t: 'plant', pot: 0, seed: 'nonsense', id: 'b', who: 'char1', date: '2026-11-01' }),
        water1: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: {} }], picked: 0 }, { t: 'water', pot: 0, id: 'a', who: 'char2', date: '2026-11-01' }),
        water2: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: { '2026-11-01': 2 } }], picked: 0 }, { t: 'water', pot: 0, id: 'a', who: 'char2', date: '2026-11-01' }),
        waterBoth: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: { '2026-11-01': 2 } }], picked: 0 }, { t: 'water', pot: 0, id: 'a', who: 'char1', date: '2026-11-01' }),
        waterOld: T.apply({ pots: [{ id: 'new', seed: 'daisy', w: {} }], picked: 0 }, { t: 'water', pot: 0, id: 'old', who: 'char1', date: '2026-11-01' }),
        waterBloom: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: days(5) }], picked: 0 }, { t: 'water', pot: 0, id: 'a', who: 'char2', date: '2026-11-06' }),
        pickEarly: T.apply({ pots: [{ id: 'a', seed: 'daisy', w: days(4) }], picked: 0 }, { t: 'pick', pot: 0, id: 'a', who: 'char1', date: '2026-11-04' }),
        pick: T.apply({ pots: [{ id: 'a', seed: 'tulip', w: days(5) }], picked: 2, album: { tulip: 1 } }, { t: 'pick', pot: 0, id: 'a', who: 'char2', date: '2026-11-05' }),
      };
    });
    ok(JSON.stringify(r.alone) === '[1,2,3,4,5]', `alone: one step a day, a flower on day 5 ${JSON.stringify(r.alone)}`);
    ok(JSON.stringify(r.both) === '[2,4,5]', `both every day: two steps a day, a flower on day 3 ${JSON.stringify(r.both)}`);
    ok(r.mixed === 4, `both, then one, then the other: 2 + 1 + 1 = ${r.mixed}`);
    ok(!r.dry2 && r.dry3, 'two dry days are fine, the third droops it');
    ok(!r.revive.wilted && r.revive.stage === 1 && r.after === 2, `the watering that saves a droopy plant doesn't grow it; the next one does (${r.revive.stage} → ${r.after})`);
    ok(r.bloomDry.stage === 5 && !r.bloomDry.wilted, 'a flower waits to be picked however long it takes — it never droops');
    ok(r.seedDry.stage === 0 && !r.seedDry.wilted, 'a seed nobody has watered yet waits too');
    ok(r.ahead === 1, 'a watering dated after today (the partner\'s clock is ahead) waits for its day');
    ok(r.plantFull === null && r.plantBad === null, 'a pot can\'t be planted twice, or with a seed that doesn\'t exist');
    ok(r.water1 && r.water1.pots[0].w['2026-11-01'] === 2 && r.water2 === null, 'one watering per person per pot per day');
    ok(r.waterBoth && r.waterBoth.pots[0].w['2026-11-01'] === 3, '…and the other person\'s watering joins it');
    ok(r.waterOld === null, 'watering a planting that has been picked (and replanted) does nothing');
    ok(r.waterBloom === null, 'a flower needs no more water');
    ok(r.pickEarly === null, 'a bud can\'t be picked');
    ok(r.pick && r.pick.picked === 3 && r.pick.album.tulip === 2 && r.pick.pots[0] === null && JSON.stringify(r.pick.log[0]) === '["2026-11-05","char2","tulip","a"]', 'picking: one more flower, the album, who picked which planting, an empty pot');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(2)) {
  console.log('\n2. A week in the garden, by tapping');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ entries: POINTS() }) });
    ok(await p.evaluate(() => /一起走进家里/.test(document.getElementById('hm-home-sub')?.textContent || '')), 'the home card invites them in');
    await p.evaluate(() => App.nav('together')); await sleep(300);   // the tile is on 一起 (§7.36)
    await p.click('#hm-home'); await p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 15000 }); await sleep(300);
    ok(await p.evaluate(() => document.documentElement.classList.contains('game-cover')), 'the app behind holds still while the house is open (game-cover)');
    const coin0 = await p.evaluate(() => App._coinTest());
    ok(coin0.exp === 1600 && coin0.balance === 800, `pet EXP ${coin0.exp}, 🪙 ${coin0.balance}`);
    // the blue chip under the menus always says what you can do next, and one tap does it
    ok(await p.evaluate(() => /还有空花盆/.test(document.querySelector('.hm-todo').textContent)), `the next-thing chip: 「${await p.evaluate(() => document.querySelector('.hm-todo').textContent)}」`);
    await p.click('.hm-todo', { force: true }); await sleep(250);   // (it bounces when it has news; a finger doesn't wait for that)
    ok(await p.evaluate(() => !!document.querySelector('.hm-sheet .hm-seed')), '…and tapping it opens the seeds for that pot');
    const seeds = await p.evaluate(() => [...document.querySelectorAll('.hm-seed')].map(b => [b.dataset.seed, !b.disabled]));
    ok(JSON.stringify(seeds.filter(s => s[1]).map(s => s[0])) === '["daisy","sunflower"]', `a new garden can plant 小雏菊 and 向日葵 (${seeds.filter(s => s[1]).map(s => s[0])})`);
    await p.keyboard.press('Escape'); await sleep(150);
    ok(await p.evaluate(() => !document.querySelector('.hm-sheet') && !!document.querySelector('.hm-root')), 'Esc closes the seed sheet first, not the house');
    // walk to the garden; then a tap NEAR a pot counts, not only on its drawing
    await go(p, 'garden'); await idle(p); await settle(p);
    const [px, py] = await potXY(p, 0);
    await p.mouse.click(px + 18, py - 40); await sleep(250);
    ok(await p.evaluate(() => !!document.querySelector('.hm-sheet .hm-seed')), 'a tap a thumb away from an empty pot opens the seeds too');
    await p.click('.hm-seed[data-seed="daisy"]'); await idle(p);
    let s = await st(p);
    ok(s.pots[0].seed === 'daisy' && s.pots[0].stage === 0 && s.pots[0].thirsty, 'planted: a seed, asking for water');
    const stand = s.cs.x;
    ok(Math.abs(stand - 13) > 5, `CS stands beside the pot, not in front of it (pot 13, CS ${stand.toFixed(1)})`);
    ok(await p.evaluate(() => document.querySelector('.hm-pot[data-i="0"]').classList.contains('hm-thirsty')), 'a thirsty pot glows');
    await tapPot(p, 0); await idle(p);
    s = await st(p);
    ok(s.pots[0].stage === 1 && s.pots[0].mine && !s.pots[0].thirsty, 'watered: a sprout, and the glow stops for today');
    await tapPot(p, 0); await sleep(300);
    ok(/今天浇过这盆了/.test(await toast(p)) && (await st(p)).pots[0].stage === 1, `the same day again: 「${await toast(p)}」 and nothing grows`);
    for (const d of ['26', '27', '28']) { await at(p, `2026-11-${d}T09:00:00`); await tapPot(p, 0); await idle(p); }
    s = await st(p);
    ok(s.pots[0].stage === 4 && s.today === '2026-11-28', `four days, four steps: a bud (${s.pots[0].stage})`);
    await at(p, '2026-12-01T09:00:00');
    s = await st(p);
    ok(s.pots[0].wilted && await p.evaluate(() => document.querySelector('.hm-pot[data-i="0"]').classList.contains('hm-wilt')), 'three dry days: it droops');
    ok(await p.evaluate(() => /🥀 有 1 盆花蔫了/.test(document.querySelector('.hm-todo').textContent)), `…and the chip puts that first: 「${await p.evaluate(() => document.querySelector('.hm-todo').textContent)}」`);
    await sheet(p, 'garden');
    ok(await p.evaluate(() => /蔫了/.test(document.querySelector('.hm-sheet .hm-prow[data-pot="0"]').textContent)), 'the 🌱 花园 sheet says so');
    await p.click('.hm-sheet [data-a="close-sheet"]');
    await tapPot(p, 0); await idle(p);
    s = await st(p);
    ok(!s.pots[0].wilted && s.pots[0].stage === 4, 'watered: it stands up again, but doesn\'t grow today');
    await at(p, '2026-12-02T09:00:00'); await tapPot(p, 0); await idle(p);
    s = await st(p);
    ok(s.pots[0].bloom, 'the next day: a flower');
    await p.evaluate(() => App.closeHome()); await sleep(300);
    ok(await p.evaluate(() => /花开了 1 盆/.test(document.getElementById('hm-home-sub').textContent)), `the home card says a flower is waiting: 「${await p.evaluate(() => document.getElementById('hm-home-sub').textContent)}」`);
    ok(await p.evaluate(() => !document.documentElement.classList.contains('game-cover') && !document.querySelector('.hm-root')), 'closing removes the house and lets the app move again');
    await enter(p);
    await tapPot(p, 0); await idle(p);
    s = await st(p);
    const sv = await saved(p);
    ok(s.pots[0].empty && s.view.picked === 1 && s.view.album.daisy === 1, 'picked: one flower in the album, the pot empty');
    ok(sv && sv.data.picked === 1 && sv.data.album.daisy === 1 && sv.data.log.length === 1, `…and saved (rev ${sv && sv.rev})`);
    const coin1 = await p.evaluate(() => App._coinTest());
    ok(coin1.exp === coin0.exp + 20 && coin1.balance === coin0.balance + 10, `pet EXP +20, 小窝币 +10 (${coin0.exp} → ${coin1.exp}, 🪙 ${coin0.balance} → ${coin1.balance})`);
    ok(await p.evaluate((n) => document.querySelector('.hm-coins').textContent.includes(String(n)), coin1.balance), `…and the house's own 🪙 shows ${coin1.balance} at once`);
    ok(/收了一朵小雏菊/.test(await toast(p)), `「${await toast(p)}」`);
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(3)) {
  console.log('\n3. Seeds open up as flowers are picked, and with the festivals');
  {
    const save = (picked) => ({ data: { v: 1, pots: [], picked, album: { daisy: picked }, log: [], pos: {} }, rev: 3 });
    for (const [picked, when, want, not] of [
      [3, '2026-11-25T12:00:00', ['tulip'], ['hydrangea', 'rose', 'pumpkin']],
      [15, '2026-11-25T12:00:00', ['tulip', 'hydrangea', 'lavender', 'moon'], ['rose', 'peach']],
      [0, '2027-02-10T12:00:00', ['rose', 'peach'], ['tulip', 'pumpkin']],
      [0, '2026-10-24T12:00:00', ['pumpkin'], ['rose', 'poin']],
      [0, '2026-12-20T12:00:00', ['poin', 'eternal'], ['pumpkin']],
      [0, '2026-12-31T12:00:00', ['eternal'], ['poin']],
      [0, '2027-01-02T12:00:00', [], ['eternal', 'poin']],
    ]) {
      const { p, ctx } = await open(browser, { when, data: seed({ save: save(picked) }) });
      await enter(p);
      const states = await p.evaluate(() => Object.fromEntries(Object.keys(HomeGame.test.SEEDS).map(k => [k, HomeGame.test.seedState(k).ok])));
      ok(want.every(k => states[k]) && not.every(k => !states[k]), `${when.slice(0, 10)}, ${picked} picked: ${want.join(' ') || '(no festival seed)'} open; ${not.join(' ')} not`);
      await ctx.close();
    }
  }
  }

  if (want(4)) {
  console.log('\n4. Every way to move: anywhere on a floor, smaller further back, round by the doorways, up the stairs');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ owned: ['hm_lv2', 'hm_lv3'] }) });
    await enter(p);
    let s = await st(p);
    const geo = await p.evaluate(() => HomeGame.test.geo());
    const [B0, F0] = geo.band[0], PY = geo.passY[0];
    ok(s.lv === 3 && s.pots.length === 6 && geo.floors.length === 2, 'Lv3: two floors, six pots');
    // a tap in the air over the garden walks to the back of the lawn under it (the pots and the lawn still work)
    await p.evaluate(() => HomeGame.test.teleport(30, 0)); await sleep(300);
    const [tx, ty] = await screenAt(p, 21, 60);
    await p.mouse.click(tx, ty); await idle(p);
    s = await st(p);
    ok(Math.abs(s.cs.x - 21) < 2 && s.cs.where === '花园' && Math.abs(s.cs.y - B0) < .4 && !(await p.evaluate(() => !!document.querySelector('.hm-sheet'))), `a tap in the air over the garden walks to the back of the lawn under it (${s.cs.x.toFixed(1)}, ${s.cs.y.toFixed(1)})`);
    // into the room and out of it
    await p.evaluate(() => HomeGame.test.teleport(60, 0)); await sleep(200); await settle(p);
    let [cx, cy] = await screenAt(p, 70, B0 + .6);
    await p.mouse.click(cx, cy); await idle(p);
    const back = await st(p);
    [cx, cy] = await screenAt(p, 70, F0 - .3);
    await p.mouse.click(cx, cy); await idle(p);
    const front = await st(p);
    ok(back.cs.where === '客厅' && Math.abs(back.cs.y - (B0 + .6)) < .5 && Math.abs(front.cs.y - (F0 - .3)) < .5, `a tap walks to that spot, how far back included (y ${back.cs.y.toFixed(1)} → ${front.cs.y.toFixed(1)})`);
    ok(back.cs.s < front.cs.s - .15 && back.cs.z < front.cs.z, `further back is drawn smaller and further behind (${back.cs.s.toFixed(2)} at the back, ${front.cs.s.toFixed(2)} at the front)`);
    // the furniture: behind it when you stand further back, in front of it when you stand nearer
    const sofa = await p.evaluate(() => { const e = [...document.querySelectorAll('.hm-props .hm-mpf')].find(e => /7FB3DC/i.test(e.innerHTML)); return e ? { x: parseFloat(e.style.left), y: parseFloat(e.style.top), z: +e.style.zIndex } : null; });
    await p.evaluate(([x, y]) => HomeGame.test.teleport(x, 0, y), [sofa.x, sofa.y - 1.6]); await sleep(150);
    const behind = (await st(p)).cs.z;
    await p.evaluate(([x, y]) => HomeGame.test.teleport(x, 0, y), [sofa.x, sofa.y + 1.6]); await sleep(150);
    const before = (await st(p)).cs.z;
    ok(sofa && behind < sofa.z && before > sofa.z, `behind the sofa and in front of it (z ${behind} < sofa ${sofa.z} < ${before})`);
    // walls: the back part stops you; the doorway at the front lets you through
    await p.evaluate(([y]) => HomeGame.test.teleport(88, 0, y), [B0 + .4]); await sleep(150);
    await p.evaluate(() => HomeGame.test.hold(1, 0)); await sleep(900); await p.evaluate(() => HomeGame.test.stop()); await sleep(200);
    const stopped = await st(p);
    await p.evaluate(([y]) => HomeGame.test.teleport(88, 0, y), [F0 - .5]); await sleep(150);
    await p.evaluate(() => HomeGame.test.hold(1, 0)); await sleep(900); await p.evaluate(() => HomeGame.test.stop()); await sleep(200);
    const through = await st(p);
    ok(stopped.cs.x < 92 && stopped.cs.where === '客厅' && through.cs.x > 93, `at the back the wall stops you (x ${stopped.cs.x.toFixed(1)}); at the front you go through the doorway (x ${through.cs.x.toFixed(1)}, ${through.cs.where})`);
    // a tap from the back of one room to the back of another goes round by the doorways
    await p.evaluate(([y]) => HomeGame.test.teleport(60, 0, y), [B0 + .4]); await sleep(150);
    const r = await p.evaluate(([y]) => HomeGame.test.route(120, y, 0), [B0 + .4]);
    ok(r.length === 3 && r[0].y >= PY && r[1].y >= PY && Math.abs(r[2].y - (B0 + .4)) < .01 && r[2].x === 120, `the back of the 客厅 → the back of the kitchen: forward to the doorways, along, and back (${r.map(q => q.x.toFixed(0) + ',' + q.y.toFixed(0)).join(' → ')})`);
    await p.evaluate(([y]) => HomeGame.test.walk(120, 0, y), [B0 + .4]); await idle(p);
    s = await st(p);
    ok(s.cs.where === '厨房' && Math.abs(s.cs.x - 120) < .5 && Math.abs(s.cs.y - (B0 + .4)) < .5, `…and gets there (${s.cs.where})`);
    // the stick: eight ways
    await p.evaluate(() => HomeGame.test.teleport(66, 0)); await sleep(150); await settle(p);
    const joy = await p.locator('.hm-joy').boundingBox();
    const jx = joy.x + joy.width / 2, jy = joy.y + joy.height / 2;
    let s0 = (await st(p)).cs;
    await p.mouse.move(jx, jy); await p.mouse.down(); await p.mouse.move(jx + joy.width * .45, jy, { steps: 4 }); await sleep(800);
    const right = (await st(p)).cs;
    await p.mouse.move(jx, jy - joy.height * .45, { steps: 4 }); await sleep(600);
    const up = (await st(p)).cs;
    await p.mouse.move(jx - joy.width * .4, jy + joy.height * .4, { steps: 4 }); await sleep(500);
    const diag = (await st(p)).cs;
    await p.mouse.up(); await sleep(500);
    const let1 = (await st(p)).cs; await sleep(400);
    const let2 = (await st(p)).cs;
    ok(right.hold && right.hold[0] === 1 && right.hold[1] === 0 && right.x > s0.x + 8, `pushing the stick right walks right (${s0.x.toFixed(1)} → ${right.x.toFixed(1)})`);
    ok(up.hold && up.hold[1] === -1 && up.y < right.y - 2, `pushing it up walks into the room (y ${right.y.toFixed(1)} → ${up.y.toFixed(1)})`);
    ok(diag.hold && diag.hold[0] === -1 && diag.hold[1] === 1 && diag.y > up.y && diag.x < up.x, 'down-left walks out and left at once');
    ok(!let1.hold && Math.abs(let2.x - let1.x) < .5 && Math.abs(let2.y - let1.y) < .3 && await p.evaluate(() => document.querySelector('.hm-joy-k').style.transform === ''), 'letting go stops, and the knob goes back to the middle');
    // the view follows you through a house wider than the screen
    await p.evaluate(() => HomeGame.test.hold(1, 0)); await sleep(2200); await p.evaluate(() => HomeGame.test.stop()); await settle(p);
    s = await st(p);
    ok(s.camX > 0, `a house wider than the screen: the view followed (camX ${s.camX.toFixed(1)})`);
    const onScreen = await p.evaluate(() => { const r = document.querySelector('.hm-ch.hm-me').getBoundingClientRect(), sc = document.querySelector('.hm-scene').getBoundingClientRect(); return r.left >= sc.left - 2 && r.right <= sc.right + 2; });
    ok(onScreen, 'CS stays on screen');
    // upstairs and down
    await p.click('.hm-pad[data-go="up"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 1 && /卧室|阳台|楼梯/.test(s.cs.where), `⬆ 上楼 climbs the stairs (${s.cs.where})`);
    ok(await p.evaluate(() => document.querySelector('[data-r="stairs"]').dataset.go === 'down' && /下楼/.test(document.querySelector('[data-r="stairs"]').textContent)), 'upstairs, the stairs button turns into ⬇ 下楼');
    const up2 = await p.evaluate(() => HomeGame.test.geo().band[1]);
    ok(s.cs.y >= up2[0] - .01 && s.cs.y <= up2[1] + .01, `…and stands on the upstairs floor (y ${s.cs.y.toFixed(1)} in ${up2.map(v => v.toFixed(1)).join('–')})`);
    await p.click('[data-go="down"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 0 && s.cs.where !== '楼梯上', `⬇ 下楼 comes back down by the stairs, to under where you were (${s.cs.where})`);
    // a pot upstairs, on the balcony: going to it takes the stairs
    await p.evaluate(() => HomeGame.test.potAction(4)); await sleep(250);
    await p.click('.hm-seed[data-seed="daisy"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 1 && s.cs.where === '阳台' && s.pots[4].seed === 'daisy', 'the balcony pot: up the stairs, and planted');
    await go(p, 'garden'); await idle(p); await settle(p);
    s = await st(p);
    ok(s.cs.f === 0 && s.cs.where === '花园' && s.camX < 1 && !(await p.evaluate(() => !!document.querySelector('.hm-sheet'))), '🌱 花园 › 走去花园 walks all the way back (down the stairs), and the view with it');
    const caught = await p.waitForFunction(() => { const s = HomeGame.test.state(); return s.pet && Math.abs(s.pet.x - s.cs.x) < 9 && s.pet.f === 0; }, null, { timeout: 6000 }).then(() => true, () => false);
    ok(caught, `the pet followed, down the stairs and across (${JSON.stringify((await st(p)).pet)})`);
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(5)) {
  console.log('\n5. Upgrades and festival pieces, from the one wallet');
  {
    const { p, ctx, errs } = await open(browser, { when: '2026-12-20T15:00:00', data: seed({ entries: POINTS(3000) }) });
    await enter(p);
    await sheet(p, 'house');
    ok(await p.evaluate(() => !!document.querySelector('[data-buy="hm_lv2"]') && !document.querySelector('[data-buy="hm_lv3"]')), 'Lv3 waits until Lv2 is built');
    const c0 = await p.evaluate(() => App._coinTest());
    await p.click('[data-buy="hm_lv2"]'); await p.waitForFunction(() => HomeGame.test.state().lv === 2, null, { timeout: 8000 }).catch(() => {});
    const c1 = await p.evaluate(() => App._coinTest());
    ok((await st(p)).lv === 2 && c1.balance === c0.balance - 600, `小平房 built for 600 (🪙 ${c0.balance} → ${c1.balance})`);
    ok(await p.evaluate(() => !document.querySelector('.hm-sheet')), 'the sheet closes so the new house can be seen');
    await sheet(p, 'house');
    ok(await p.evaluate(() => document.querySelector('[data-buy="hm_lv3"]').disabled), `两层小楼 (1500) can't be bought with 🪙 ${c1.balance}`);
    await sheet(p, 'shop');
    const shop = await p.evaluate(() => [...document.querySelectorAll('[data-buy]')].map(b => b.dataset.buy));
    ok(shop.includes('hm_xtree') && shop.includes('hm_lights') && !shop.includes('hm_lantern') && !shop.includes('hm_pumpkin'), `12-20: Christmas pieces on sale, not 春节's or 万圣节's (${shop.join(' ')})`);
    await p.click('[data-buy="hm_xtree"]'); await sleep(400);
    ok(await p.evaluate(() => !!document.querySelector('.hm-xtree')), 'the Christmas tree stands in the garden at once');
    ok(await p.evaluate(() => /每年圣诞摆出来/.test(document.querySelector('.hm-sheet-body').textContent)), 'and the shop says it comes back every year');
    const c2 = await p.evaluate(() => App._coinTest());
    ok(c2.balance === c1.balance - 120, `🪙 ${c1.balance} → ${c2.balance}`);
    // the same wallet the 小窝's shop reads
    const owned = await p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')).decorOwned.map(r => r.itemId + ':' + r.ptsSpent));
    ok(owned.includes('hm_lv2:600') && owned.includes('hm_xtree:120'), `bought through the 小窝's own ledger (${owned.join(' ')})`);
    await p.evaluate(() => App.closeHome());
    // the tree goes back in its box after the festival, and comes out again next year
    await at(p, '2027-03-01T15:00:00'); await enter(p);
    ok(await p.evaluate(() => !document.querySelector('.hm-xtree')), 'in March the tree is put away');
    await sheet(p, 'shop');
    ok(await p.evaluate(() => /收起来的节日装饰/.test(document.querySelector('.hm-sheet-body').textContent) && !document.querySelector('[data-buy="hm_xtree"]')), '…the shop lists it as stored, and doesn\'t sell it now');
    await p.evaluate(() => App.closeHome());
    await at(p, '2027-12-15T15:00:00'); await enter(p);
    ok(await p.evaluate(() => !!document.querySelector('.hm-xtree')), 'and the next December it is up again by itself');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(6)) {
  console.log('\n6. The festivals arrive by themselves');
  for (const [when, fest, sign, label] of [
    ['2026-12-20T15:00:00', 'xmas', '.hm-snowcap', '圣诞: snow on the roof'],
    ['2026-12-24T15:00:00', 'anniv', '.hm-banner', '周年 (12-24): the banner'],
    ['2027-02-08T15:00:00', 'cny', '.hm-fu', '春节: 福 on the door'],
    ['2027-02-14T15:00:00', 'vday', '.hm-fheart', '情人节: hearts in the air'],
    ['2026-10-28T21:00:00', 'halloween', '.hm-bat', '万圣节 night: bats'],
    ['2027-09-15T21:00:00', 'midautumn', '.hm-scene.hm-f-midautumn.hm-night', '中秋 night: the big moon'],
  ]) {
    const { p, ctx } = await open(browser, { when });
    await enter(p);
    const s = await st(p);
    const seen = await p.evaluate((sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }, sign);
    ok(s.fest === fest && seen, `${label} (${s.fest})`);
    if (fest === 'anniv') ok(await p.evaluate(() => !!document.querySelector('.hm-snowcap')), '…and it is still 圣诞 in the garden that day');
    await ctx.close();
  }
  {
    const { p, ctx } = await open(browser, { when: '2026-11-25T21:30:00' });
    await enter(p);
    ok(await p.evaluate(() => document.querySelector('.hm-scene').classList.contains('hm-night') && !document.querySelector('.hm-snowcap')), 'an ordinary night: night sky, no festival');
    await at(p, '2026-11-26T18:00:00');
    ok(await p.evaluate(() => document.querySelector('.hm-scene').classList.contains('hm-dusk')), 'dusk the next day, without reopening');
    await ctx.close();
  }
  }

  if (want(7)) {
  console.log('\n7. A save whose answer is lost, and a network that is down');
  {
    const { p, ctx, errs } = await open(browser);
    await enter(p); await p.evaluate(() => App.closeHome()); await sleep(200);   // (loads home.js)
    // the first write reaches the "server" and its answer never comes back
    await p.evaluate(() => {
      const api = App._homeApiTest(), put = api.save.put;
      let drop = 1;
      api.save.put = async (d, r) => { const res = await put(d, r); if (drop-- > 0) throw new Error('network'); return res; };
      HomeGame.open(api);
    });
    await sleep(300);
    const rev0 = ((await saved(p)) || { rev: 0 }).rev;
    await p.evaluate(() => HomeGame.test.act({ t: 'plant', pot: 0, seed: 'daisy' })); await sleep(400);
    let s = await st(p);
    ok(s.pending === 1, 'the answer was lost: the planting is kept to send again');
    await p.evaluate(() => HomeGame.test.flush()); await idle(p);
    s = await st(p);
    const t = await toast(p);
    ok(s.pending === 0 && s.pots[0].seed === 'daisy' && !/已经种上了|刚在这个花盆|先把/.test(t), `the retry finds its own planting already saved: nothing doubled, nothing said about it (「${t}」)`);
    const sv = await saved(p);
    ok(sv.rev === rev0 + 1 && sv.data.pots[0].seed === 'daisy' && sv.data.pots.filter(Boolean).length === 1, `saved once (rev ${rev0} → ${sv.rev})`);
    await p.evaluate(() => App.closeHome()); await sleep(300);
    // now nothing gets through: the actions wait on the phone, even across closing the house
    await p.evaluate(() => {
      const api = App._homeApiTest();
      api.save.put = async () => { throw new Error('offline'); };
      api.save.get = async () => { throw new Error('offline'); };
      HomeGame.open(api);
    });
    await sleep(300);
    const id = (await st(p)).pots[0].id;
    await p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id); await sleep(400);
    s = await st(p);
    ok(s.pending === 1 && s.pots[0].stage === 1, 'offline: the watering shows at once and waits to be sent');
    await p.evaluate(() => App.closeHome()); await sleep(300);
    const kept = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hm_pending_')).map(k => JSON.parse(localStorage.getItem(k)).length));
    ok(kept.reduce((a, b) => a + b, 0) >= 1, `closing the house keeps it on the phone (${kept})`);
    await enter(p); await idle(p); await sleep(300);
    s = await st(p);
    const sv2 = await saved(p);
    ok(s.pending === 0 && sv2.data.pots[0].w['2026-11-25'] === 1, 'back online, the next visit sends it');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(8)) {
  console.log('\n8. The 客厅 is their own 小窝, and the doors');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ entries: POINTS() }) });
    await enter(p);
    const pieces = await p.evaluate(() => [...document.querySelectorAll('.hm-bwall .hm-mp, .hm-props .hm-mpf')].map(e => (e.classList.contains('hm-mpw') ? 'wall:' : 'floor:') + (e.querySelector('svg') ? 'svg' : 'emoji')));
    ok(pieces.length === 4 && pieces.every(x => /svg$/.test(x)) && pieces.some(x => /^wall/.test(x)) && pieces.some(x => /^floor/.test(x)), `the 客厅 holds the 4 pieces the 小窝 has, drawn the same way, on its back wall and its floor (${pieces.join(' ')})`);
    const inside = await p.evaluate(() => { const st = HomeGame.test.state(), L = HomeGame.test.LVS[st.lv], r0 = L.rooms[0], F = L.floors[0], b = document.querySelector('.hm-band').getBoundingClientRect(), X = (x) => b.left + (x - st.camX) * st.W / 100, Y = (y) => b.top + y / 100 * st.H, m = { left: X(r0.x0), right: X(r0.x1), top: Y(r0.top), bottom: Y(F.front) }; return [...document.querySelectorAll('.hm-bwall .hm-mp, .hm-props .hm-mpf')].every(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.left >= m.left - 1 && r.right <= m.right + 1 && r.bottom <= m.bottom + 1; }); });
    ok(inside, 'every piece sits inside the room, at a size you can see');
    // 一起坐沙发: the 小窝's own sofa is a seat
    ok(await p.evaluate(() => !document.querySelector('[data-a="sit"]').hidden), 'their sofa is in the 客厅, so there is 🛋️ 坐下');
    await p.click('[data-a="sit"]'); await idle(p); await sleep(250);
    const sat = await p.evaluate(() => {
      const el = document.querySelector('.hm-ch.hm-me'), ch = el.querySelector('svg').getBoundingClientRect();
      const sofa = [...document.querySelectorAll('.hm-props .hm-mpf')].find(e => /7FB3DC/i.test(e.innerHTML)).getBoundingClientRect();
      const feet = ch.top + ch.height * (100 / 112);   // where the feet are in the drawing
      return { sit: el.classList.contains('hm-sit'), label: document.querySelector('[data-a="sit"]').textContent, feet, top: sofa.top, bottom: sofa.bottom, cx: ch.x + ch.width / 2, l: sofa.left, r: sofa.right, where: HomeGame.test.state().cs.where };
    });
    ok(sat.sit && /站起来/.test(sat.label) && sat.where === '客厅', `CS walked to the sofa and sat down (${sat.label})`);
    ok(sat.feet > sat.top + (sat.bottom - sat.top) * .3 && sat.feet < sat.bottom && sat.cx > sat.l && sat.cx < sat.r, `on the cushion — not floating above it or sunk into the floor (feet ${sat.feet.toFixed(0)}, sofa ${sat.top.toFixed(0)}–${sat.bottom.toFixed(0)})`);
    await p.screenshot({ path: `${SHOTS}/home_sit.png` });
    await go(p, 'garden'); await sleep(150);
    ok(await p.evaluate(() => !document.querySelector('.hm-ch.hm-me').classList.contains('hm-sit') && /坐下/.test(document.querySelector('[data-a="sit"]').textContent)), 'walking away stands up');
    await idle(p);
    await sheet(p, 'house'); await p.click('[data-a="nest"]'); await sleep(900);
    ok(await p.evaluate(() => !document.querySelector('.hm-root') && document.getElementById('pet-page')?.classList.contains('open')), '布置客厅 opens the 小窝');
    ok(await p.evaluate(() => !!document.querySelector('.pet-panel .hm-open')), 'the 小窝 has a door back to the house');
    await p.click('.pet-panel .hm-open'); await p.waitForFunction(() => !!document.querySelector('.hm-root'), null, { timeout: 8000 }).catch(() => {});
    ok(await p.evaluate(() => !!document.querySelector('.hm-root') && !document.getElementById('pet-page')?.classList.contains('open')), '…which opens it again');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(9)) {
  console.log('\n9. Screens: 360–1280, both themes; reduced motion');
  // from a folded Galaxy Fold and a first-generation iPhone SE to a desktop, both ways up; the narrow and
  // the two-storey ones also with every action button showing (next to the partner, by the sofa)
  for (const [w, h, lv] of [[280, 653, 3], [320, 568, 3], [360, 740, 1], [390, 844, 1], [430, 932, 1], [667, 375, 3], [844, 390, 3], [820, 1180, 2], [1280, 800, 3], [1920, 1080, 1]]) for (const theme of ['light', 'dark']) {
    const { p, ctx, errs } = await open(browser, { w, h, theme, data: seed({ owned: lv === 3 ? ['hm_lv2', 'hm_lv3'] : lv === 2 ? ['hm_lv2'] : [] }), hinted: false });
    await enter(p);
    if (w < 400) { await p.evaluate(() => { const g = document.querySelector('[data-a="hug"]'); g.hidden = false; g.disabled = false; document.querySelector('[data-a="sit"]').hidden = false; }); await sleep(100); }
    const m = await p.evaluate(() => {
      const root = document.querySelector('.hm-root'), rr = root.getBoundingClientRect(), band = document.querySelector('.hm-band').getBoundingClientRect();
      const st = HomeGame.test.state(), vis = (e) => e && e.offsetParent && getComputedStyle(e).visibility !== 'hidden';
      const small = [...root.querySelectorAll('button')].filter(b => vis(b) && !b.closest('.hm-sheet') && b.getBoundingClientRect().height < 39.5 && !b.classList.contains('hm-edge')).map(b => b.textContent.trim().slice(0, 8) + ':' + b.getBoundingClientRect().height.toFixed(1));
      const clipped = [...root.querySelectorAll('.hm-mbtn, .hm-act span, .hm-coins, .hm-title b, .hm-hint li span')].filter(e => vis(e) && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 8));
      const todo = document.querySelector('.hm-todo').getBoundingClientRect(), floor = band.top + (HomeGame.test.geo().floors[0].front + 3.4) / 100 * band.height;
      const ctl = [...document.querySelectorAll('.hm-ctl')].map(c => c.getBoundingClientRect());
      // a wide screen puts the house in the middle and the buttons beside it; otherwise they stand on the lawn under it
      const houseL = band.left + (0 - st.camX) * st.W / 100, houseR = houseL + HomeGame.test.LVS[st.lv].world * st.W / 100;
      const covers = ctl.some(c => c.top < floor - 1 && c.right > houseL && c.left < houseR);
      const bs = [...root.querySelectorAll('.hm-top > *, .hm-mbtn, .hm-todo, .hm-ctl > *')].filter(vis).map(e => ({ t: e.textContent.trim().slice(0, 4), r: e.getBoundingClientRect() }));
      const overlap = [];
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].r, b = bs[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap.push(bs[i].t + '×' + bs[j].t); }
      const off = [...root.querySelectorAll('button, .hm-title, .hm-coins, .hm-todo')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1; }).map(e => e.textContent.trim().slice(0, 4));
      const hint = document.querySelector('.hm-hint'), hr = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
      return { full: Math.abs(rr.width - innerWidth) < 1 && Math.abs(rr.height - innerHeight) < 1, over: root.scrollWidth > root.clientWidth + 1, bw: band.width, bh: band.height,
        small, clipped, under: root.classList.contains('hm-short') ? band.top >= document.querySelector('.hm-menu').getBoundingClientRect().bottom - 1 && todo.top >= floor - 1 : band.top >= todo.bottom - 1, covers, hint: hr ? hr.left >= 0 && hr.right <= innerWidth && hr.top >= 0 && hr.bottom <= innerHeight : true,
        font: getComputedStyle(document.querySelector('.hm-mbtn')).fontSize, ch: document.querySelector('.hm-ch.hm-me').getBoundingClientRect().width, overlap, off };
    });
    ok(m.full && !m.over && Math.abs(m.bw / m.bh - 4 / 3) < .02 && !m.small.length && !m.clipped.length && m.under && !m.covers && m.hint && /^1[34]px$/.test(m.font) && m.ch >= 24 && !m.overlap.length && !m.off.length,
      `${w}×${h} Lv${lv} ${theme}: full screen, the house ${Math.round(m.bw)}×${Math.round(m.bh)} under the buttons at the top (${m.under}), the bottom buttons off the floor (${!m.covers}), no small buttons ${JSON.stringify(m.small)}, nothing cut off ${JSON.stringify(m.clipped)}, no buttons on each other ${JSON.stringify(m.overlap)}, none off screen ${JSON.stringify(m.off)}, the welcome inside, you ${Math.round(m.ch)}px wide`);
    if (w === 390 || w === 1280 || w === 844) await p.screenshot({ path: `${SHOTS}/home_${w}x${h}_${theme}.png` });
    if (errs.length) ok(false, `${w} ${theme} page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { reduced: true, data: seed({ owned: ['hm_lv2', 'hm_lv3'] }), when: '2026-12-20T21:00:00' });
    await enter(p);
    const moving = await p.evaluate(() => document.querySelector('.hm-root').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
    ok(moving === 0, `reduced motion: nothing animates (${moving} running), snow and lights included`);
    await p.click('[data-go="up"]'); await sleep(250);
    const s = await st(p);
    ok(s.cs.f === 1 && !s.cs.path, 'walking is a step, not a glide');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(10)) {
  console.log('\n10. The full-screen house, used only by its buttons (a first visit, then a whole day)');
  {
    const { p, ctx, errs } = await open(browser, { hinted: false, data: seed({ entries: POINTS() }) });
    await enter(p);
    // the first visit: a welcome, not a wall of text
    ok(await p.evaluate(() => { const h = document.querySelector('.hm-hint'); return !!h && !h.hidden && h.querySelectorAll('li').length === 3; }), 'the first visit opens on a three-step welcome');
    const [cx, cy] = await p.evaluate(() => { const r = document.querySelector('.hm-hint').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 30]; });
    await p.mouse.click(cx, cy); await sleep(200);
    ok(!(await st(p)).cs.path && await p.evaluate(() => !document.querySelector('.hm-hint').hidden), 'a tap on the welcome card does not walk you anywhere behind it');
    await p.click('[data-a="hint-help"]'); await sleep(200);
    ok(await p.evaluate(() => document.querySelector('.hm-hint').hidden && /怎么玩/.test(document.querySelector('.hm-sheet-top').textContent) && document.querySelector('[data-sheet="help"]').getAttribute('aria-pressed') === 'true'), '「看玩法」 opens ❓ 怎么玩, and its button shows it is open');
    ok(await p.evaluate(() => ['走路', '种花', '一起', '房子', '节日'].every(t => document.querySelector('.hm-sheet-body').textContent.includes(t))), '…which covers walking, flowers, the two of you, the house and the festivals');
    await p.evaluate(() => App.closeHome()); await enter(p);
    ok(await p.evaluate(() => document.querySelector('.hm-hint').hidden), 'the welcome is shown once, not every visit');
    // every menu opens its sheet; each closes four ways
    const titles = { help: '怎么玩', garden: '花园', house: '房子', shop: '节日小店' };
    for (const k of Object.keys(titles)) {
      await p.click(`[data-sheet="${k}"]`); await sleep(150);
      const t = await p.evaluate(() => document.querySelector('.hm-sheet-top')?.textContent || '');
      ok(t.includes(titles[k]), `the ${titles[k]} button opens 「${t.replace('✕', '').trim()}」`);
      const how = ['✕', 'the same button again', 'a tap outside it', 'Esc'][Object.keys(titles).indexOf(k)];
      if (how === '✕') await p.click('.hm-sheet [data-a="close-sheet"]');
      else if (how === 'the same button again') await p.evaluate((k) => document.querySelector(`[data-sheet="${k}"]`).click(), k);
      else if (how === 'a tap outside it') await p.mouse.click(10, 140);
      else await p.keyboard.press('Escape');
      await sleep(150);
      ok(await p.evaluate(() => !document.querySelector('.hm-sheet') && !!document.querySelector('.hm-root')), `…and closes with ${how}, leaving the house open`);
    }
    // a whole day in the garden, using only the blue "next thing" chip
    const chip = () => p.evaluate(() => document.querySelector('.hm-todo').textContent);
    ok(/还有空花盆/.test(await chip()), `an empty garden: 「${await chip()}」`);
    // it always suggests the most useful thing: a flower to pick, then a pot to water, then one to plant
    const said = [];
    for (let n = 0; n < 4; n++) {
      said.push((await chip()).replace(/ · 点这里.*/, ''));
      await p.click('.hm-todo', { force: true }); await sleep(150);
      if (await p.evaluate(() => !!document.querySelector('.hm-seed'))) await p.click('.hm-seed[data-seed="sunflower"]');
      await idle(p);
    }
    let s = await st(p);
    ok(JSON.stringify(said) === JSON.stringify(['🌱 还有空花盆', '💧 还有 1 盆花等你浇水', '🌱 还有空花盆', '💧 还有 1 盆花等你浇水']), `plant, water, plant, water — in the order it suggests: ${said.join(' → ')}`);
    ok(s.pots.every(q => q.seed === 'sunflower' && q.mine && q.stage === 1), 'four taps on the chip: two sunflowers planted and watered');
    ok(/都照顾好了/.test(await chip()) && await p.evaluate(() => document.querySelector('.hm-todo').classList.contains('hm-done')), `then it rests: 「${await chip()}」`);
    await p.click('.hm-todo', { force: true }); await sleep(150);
    ok(await p.evaluate(() => /花园/.test(document.querySelector('.hm-sheet-top').textContent)), '…and tapping it then shows the garden');
    await p.click('.hm-sheet [data-a="close-sheet"]');
    // the next days, still only the chip: water, bloom, pick
    for (const d of ['26', '27', '28', '29']) {
      await at(p, `2026-11-${d}T09:00:00`);
      for (let n = 0; n < 2; n++) { await p.click('.hm-todo', { force: true }); await idle(p); }
    }
    s = await st(p);
    ok(s.pots.every(q => q.bloom) && /花开了/.test(await chip()), `day five: both in flower, and the chip says so (「${await chip()}」)`);
    const c0 = await p.evaluate(() => App._coinTest());
    for (let n = 0; n < 2; n++) { await p.click('.hm-todo', { force: true }); await idle(p); }
    const c1 = await p.evaluate(() => App._coinTest());
    s = await st(p);
    ok(s.view.picked === 2 && s.pots.every(q => q.empty) && c1.balance === c0.balance + 20, `two more taps pick both: 2 flowers, 🪙 ${c0.balance} → ${c1.balance}`);
    ok(/还有空花盆/.test(await chip()), 'and the chip starts the next round');
    // the buttons at the bottom
    await p.click('[data-a="wave"]'); await sleep(150);
    ok(await p.evaluate(() => [...document.querySelectorAll('.hm-pop')].some(e => e.textContent === '👋')), '👋 招手 waves');
    ok(await p.evaluate(() => { const b = document.querySelector('[data-a="hug"]'); return b.disabled && b.hidden; }), '🤗 抱抱 appears only when someone is next to you');
    ok(await p.evaluate(() => document.querySelector('[data-r="stairs"]').hidden), 'no stairs button in a one-storey house');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  if (want(11)) {
  console.log('\n11. A laptop: the whole house from the keyboard');
  {
    const { p, ctx, errs } = await open(browser, { w: 1280, h: 800, touch: false, data: seed({ owned: ['hm_lv2', 'hm_lv3'], entries: POINTS() }) });
    await enter(p);
    const S = () => st(p);
    // ← → / A D walk for as long as they are held
    await p.evaluate(() => HomeGame.test.teleport(60, 0)); await sleep(150);
    let x0 = (await S()).cs.x;
    await p.keyboard.down('ArrowRight'); await sleep(700);
    const mid = (await S()).cs;
    await p.keyboard.up('ArrowRight'); await sleep(350);
    let x1 = (await S()).cs.x;
    ok(mid.hold && mid.hold[0] === 1 && x1 > x0 + 6, `holding → walks right while held (${x0.toFixed(1)} → ${x1.toFixed(1)})`);
    const after = (await S()).cs.x; await sleep(400);
    ok(Math.abs((await S()).cs.x - after) < .6, '…and stops when it is let go');
    await p.keyboard.down('a'); await sleep(600); await p.keyboard.up('a'); await sleep(350);
    ok((await S()).cs.x < x1 - 4, 'A walks left too');
    // the window losing focus mid-walk must not leave you walking
    await p.keyboard.down('d'); await sleep(250);
    await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await sleep(200);
    const b0 = (await S()).cs.x; await sleep(500);
    ok((await S()).cs.hold === 0 && Math.abs((await S()).cs.x - b0) < 1.2, 'leaving the window stops the walk (no key-up ever comes)');
    await p.keyboard.up('d');
    // ↑ / W walk into the room, ↓ / S out of it; two at once go diagonally
    await p.evaluate(() => HomeGame.test.teleport(66, 0, 90)); await sleep(150);
    let k0 = (await S()).cs;
    await p.keyboard.down('ArrowUp'); await sleep(500);
    const kup = (await S()).cs;
    await p.keyboard.down('ArrowRight'); await sleep(400);
    const kdiag = (await S()).cs;
    await p.keyboard.up('ArrowRight'); await p.keyboard.up('ArrowUp'); await sleep(300);
    ok(kup.hold && kup.hold[1] === -1 && kup.y < k0.y - 2 && kup.s < k0.s, `↑ walks into the room, getting smaller (y ${k0.y.toFixed(1)} → ${kup.y.toFixed(1)})`);
    ok(kdiag.hold && kdiag.hold[0] === 1 && kdiag.hold[1] === -1 && kdiag.x > kup.x + 2, '↑ and → together walk diagonally');
    await p.keyboard.down('s'); await sleep(400); await p.keyboard.up('s'); await sleep(300);
    ok((await S()).cs.y > kdiag.y + 1.5, 'S walks back out');
    // F takes the stairs, both ways
    await p.keyboard.press('f'); await idle(p);
    ok((await S()).cs.f === 1, 'F takes the stairs up');
    await p.keyboard.press('f'); await idle(p);
    ok((await S()).cs.f === 0, '…and F again comes back down');
    // Space does the 「下一步」 chip; E uses the pot you stand by
    const chip = await p.evaluate(() => { const t = document.querySelector('.hm-todo'); return t && !t.hidden ? t.textContent : ''; });
    await p.keyboard.press(' '); await sleep(300);
    const spaced = await p.evaluate(() => !!document.querySelector('.hm-sheet .hm-seed') || HomeGame.test.state().cs.path > 0);
    ok(chip && spaced, `空格 does what the chip says (「${chip}」)`);
    await p.evaluate(() => document.querySelector('.hm-sheet [data-a="close-sheet"]')?.click()); await sleep(200);
    const px = await p.evaluate(() => HomeGame.test.LVS[HomeGame.test.state().lv].pots[0][0]);
    await p.evaluate((x) => HomeGame.test.teleport(x + 2, 0), px); await sleep(150);
    await p.keyboard.press('e'); await sleep(400);
    ok(await p.evaluate(() => !!document.querySelector('.hm-sheet .hm-seed')), 'E by an empty pot asks which seed');
    await p.keyboard.press('Escape'); await sleep(250);
    ok(await p.evaluate(() => !document.querySelector('.hm-sheet') && !!document.querySelector('.hm-root')), 'Esc closes the sheet, not the house');
    await p.evaluate(() => HomeGame.test.teleport(80, 0)); await sleep(150);   // inside, away from every pot
    await p.keyboard.press('e'); await sleep(300);
    ok(/走到花盆旁边/.test(await toast(p)), `E away from the pots says where to go: 「${await toast(p)}」`);
    // H hugs (or says why not), J waves, K sits on the 客厅's sofa
    await p.keyboard.press('h'); await sleep(250);
    ok(/抱抱|不在家/.test(await toast(p)), `H: 抱抱, or why not: 「${await toast(p)}」`);
    await p.keyboard.press('j'); await sleep(250);
    ok(await p.evaluate(() => [...document.querySelectorAll('.hm-pop')].some(e => e.textContent === '👋')), 'J waves');
    const sofa = await p.evaluate(() => !document.querySelector('[data-r="sit"]').hidden);
    await p.keyboard.press('k'); await idle(p); await sleep(400);
    if (sofa) {
      ok(/站起来/.test(await p.textContent('[data-r="sit"]')), 'K walks to the sofa and sits (the button now says 站起来)');
      await p.keyboard.press('k'); await sleep(300);
      ok(/坐下/.test(await p.textContent('[data-r="sit"]')), '…and K again stands up');
    } else ok(/沙发/.test(await toast(p)), `no sofa in the 客厅: K says so (「${await toast(p)}」)`);
    // 1–4 open the menus, the same key closes; the browser's own shortcuts are left alone
    await p.keyboard.press('2'); await sleep(250);
    ok(await p.evaluate(() => document.querySelector('[data-sheet="garden"]').getAttribute('aria-pressed') === 'true'), '2 opens 🌱 花园');
    await p.keyboard.press('2'); await sleep(250);
    ok(await p.evaluate(() => !document.querySelector('.hm-sheet')), '…and 2 again closes it');
    await p.keyboard.press('1'); await sleep(250);
    ok(await p.evaluate(() => { const k = document.querySelector('.hm-sheet .hm-keys'); return !!k && getComputedStyle(k).display !== 'none'; }), '❓ 玩法 lists the keys on a laptop');
    await p.keyboard.press('Escape'); await sleep(200);
    x0 = (await S()).cs.x;
    await p.keyboard.down('Meta'); await p.keyboard.down('ArrowRight'); await sleep(400); await p.keyboard.up('ArrowRight'); await p.keyboard.up('Meta'); await sleep(200);
    ok(Math.abs((await S()).cs.x - x0) < .6, '⌘ → is the browser\'s, not a walk');
    // each button shows its key on a laptop
    const keys = await p.evaluate(() => [...document.querySelectorAll('.hm-root [data-key]')].filter(b => b.offsetParent).map(b => b.dataset.key + ':' + getComputedStyle(b, '::after').content.replace(/"/g, '')));
    ok(keys.length >= 7 && keys.every(k => k.split(':')[0] === k.split(':')[1]), `the keys are drawn on the buttons: ${keys.join(' ')}`);
    await p.screenshot({ path: `${SHOTS}/hm_keyboard_1280.png` });
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  {
    // a phone never shows the keys
    const { p, ctx } = await open(browser, { mobile: !WEBKIT });
    await enter(p);
    ok(await p.evaluate(() => [...document.querySelectorAll('.hm-root [data-key]')].every(b => getComputedStyle(b, '::after').content === 'none')), 'a touch screen shows no key labels');
    await ctx.close();
  }
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
