// 我们的家 in a browser, on demo data and a faked clock (CLAUDE.md §7.34).
//   python3 -m http.server 8765        then:  node tools/home-test.js
// (or APP_URL=http://localhost:PORT/index.html; add ?look=classic for 经典)
//
// The garden is a set of rules about days, so most of this is the calendar: a flower takes five
// waterings (three days when both of you water), one watering per person per pot per day, three dry
// days droop a growing plant and the watering that saves it doesn't count, a flower is picked once and
// is pet EXP +20 (小窝币 +10). Then every way to move (tap, hold, keys, the buttons, stairs, a view that
// follows you through a bigger house), the upgrades and festival pieces paid from the one wallet, the
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

async function open(browser, { when = '2026-11-25T15:00:00', theme = 'light', w = 390, h = 844, data = seed(), reduced = false, hinted = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
const tapPot = async (p, i) => { const [x, y] = await potXY(p, i); await p.mouse.click(x, y); };

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
    await p.click('#hm-home'); await p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 15000 }); await sleep(300);
    ok(await p.evaluate(() => document.documentElement.classList.contains('game-cover')), 'the app behind holds still while the house is open (game-cover)');
    const coin0 = await p.evaluate(() => App._coinTest());
    ok(coin0.exp === 1600 && coin0.balance === 800, `pet EXP ${coin0.exp}, 🪙 ${coin0.balance}`);
    // a tap NEAR a pot counts: it is a 25px drawing on a phone
    const [px, py] = await potXY(p, 0);
    await p.mouse.click(px + 13, py - 28); await sleep(250);
    ok(await p.evaluate(() => !!document.querySelector('.hm-sheet')), 'a tap a thumb away from an empty pot opens the seeds');
    const seeds = await p.evaluate(() => [...document.querySelectorAll('.hm-seed')].map(b => [b.dataset.seed, !b.disabled]));
    ok(JSON.stringify(seeds.filter(s => s[1]).map(s => s[0])) === '["daisy","sunflower"]', `a new garden can plant 小雏菊 and 向日葵 (${seeds.filter(s => s[1]).map(s => s[0])})`);
    await p.keyboard.press('Escape'); await sleep(150);
    ok(await p.evaluate(() => !document.querySelector('.hm-sheet') && !!document.querySelector('.hm-root')), 'Esc closes the seed sheet first, not the house');
    await tapPot(p, 0); await sleep(200); await p.click('.hm-seed[data-seed="daisy"]'); await idle(p);
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
    ok(await p.evaluate(() => /蔫了/.test(document.querySelector('.hm-prow[data-pot="0"]').textContent)), 'the garden list says so');
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
  console.log('\n4. Every way to move');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ owned: ['hm_lv2', 'hm_lv3'] }) });
    await enter(p);
    let s = await st(p);
    ok(s.lv === 3 && s.pots.length === 6, 'Lv3: two floors, six pots');
    const box = await p.locator('.hm-scene').boundingBox();
    // tap the lawn in front of the pots: in the Lv3 garden the pots stand close, and the lawn still walks you
    await p.mouse.click(box.x + box.width * .2, box.y + box.height * .94); await idle(p);
    s = await st(p);
    ok(Math.abs(s.cs.x - (20 + s.camX)) < 2 && s.cs.where === '花园' && !(await p.evaluate(() => !!document.querySelector('.hm-sheet'))), `a tap on the lawn walks there (${s.cs.x.toFixed(1)}, ${s.cs.where})`);
    // and a tap on the air above the pots too
    await p.mouse.click(box.x + box.width * .3, box.y + box.height * .5); await idle(p);
    s = await st(p);
    ok(Math.abs(s.cs.x - (30 + s.camX)) < 2 && !(await p.evaluate(() => !!document.querySelector('.hm-sheet'))), `…and a tap on the air above them (${s.cs.x.toFixed(1)})`);
    // the arrow keys
    await p.focus('.hm-scene'); await p.keyboard.press('ArrowRight'); await idle(p);
    const s2 = await st(p);
    ok(s2.cs.x > s.cs.x + 6, 'the → key steps right');
    // hold ▶: walks while held, stops when let go
    const pad = await p.locator('.hm-pad[data-dir="1"]').boundingBox();
    await p.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2); await p.mouse.down(); await sleep(1500);
    const mid = await st(p);
    await p.mouse.up(); await sleep(700);
    const end = await st(p); await sleep(400);
    const end2 = await st(p);
    ok(mid.cs.x > s2.cs.x + 15 && mid.cs.hold === 1, `holding ▶ keeps walking (${s2.cs.x.toFixed(1)} → ${mid.cs.x.toFixed(1)})`);
    ok(!end.cs.hold && Math.abs(end2.cs.x - end.cs.x) < .5, 'letting go stops');
    ok(end2.camX > 0, `a house wider than the screen: the view followed (camX ${end2.camX.toFixed(1)})`);
    const onScreen = await p.evaluate(() => { const r = document.querySelector('.hm-ch.hm-me').getBoundingClientRect(), sc = document.querySelector('.hm-scene').getBoundingClientRect(); return r.left >= sc.left - 2 && r.right <= sc.right + 2; });
    ok(onScreen, 'CS stays on screen');
    // upstairs and down
    await p.click('.hm-pad[data-go="up"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 56 && /卧室|阳台|楼梯/.test(s.cs.where), `⬆ 上楼 climbs the stairs (${s.cs.where})`);
    await p.click('.hm-pad[data-go="living"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 86 && s.cs.where === '客厅', '🛋️ 客厅 comes back down by the stairs');
    // a pot upstairs, on the balcony: going to it takes the stairs
    await p.evaluate(() => HomeGame.test.potAction(4)); await sleep(250);
    await p.click('.hm-seed[data-seed="daisy"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 56 && s.cs.where === '阳台' && s.pots[4].seed === 'daisy', 'the balcony pot: up the stairs, and planted');
    await p.click('.hm-pad[data-go="garden"]'); await idle(p);
    s = await st(p);
    ok(s.cs.f === 86 && s.cs.where === '花园' && s.camX < 1, '🌷 花园 walks all the way back, and the view with it');
    const caught = await p.waitForFunction(() => { const s = HomeGame.test.state(); return s.pet && Math.abs(s.pet.x - s.cs.x) < 9 && s.pet.f === 86; }, null, { timeout: 6000 }).then(() => true, () => false);
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
    await p.click('.hm-tab[data-tab="house"]'); await sleep(150);
    ok(await p.evaluate(() => !!document.querySelector('[data-buy="hm_lv2"]') && !document.querySelector('[data-buy="hm_lv3"]')), 'Lv3 waits until Lv2 is built');
    const c0 = await p.evaluate(() => App._coinTest());
    await p.click('[data-buy="hm_lv2"]'); await p.waitForFunction(() => HomeGame.test.state().lv === 2, null, { timeout: 8000 }).catch(() => {});
    const c1 = await p.evaluate(() => App._coinTest());
    ok((await st(p)).lv === 2 && c1.balance === c0.balance - 600, `小平房 built for 600 (🪙 ${c0.balance} → ${c1.balance})`);
    ok(await p.evaluate(() => document.querySelector('[data-buy="hm_lv3"]').disabled), `两层小楼 (1500) can't be bought with 🪙 ${c1.balance}`);
    await p.click('.hm-tab[data-tab="shop"]'); await sleep(150);
    const shop = await p.evaluate(() => [...document.querySelectorAll('[data-buy]')].map(b => b.dataset.buy));
    ok(shop.includes('hm_xtree') && shop.includes('hm_lights') && !shop.includes('hm_lantern') && !shop.includes('hm_pumpkin'), `12-20: Christmas pieces on sale, not 春节's or 万圣节's (${shop.join(' ')})`);
    await p.click('[data-buy="hm_xtree"]'); await sleep(400);
    ok(await p.evaluate(() => !!document.querySelector('.hm-xtree')), 'the Christmas tree stands in the garden at once');
    ok(await p.evaluate(() => /每年圣诞摆出来/.test(document.querySelector('.hm-panel').textContent)), 'and the shop says it comes back every year');
    const c2 = await p.evaluate(() => App._coinTest());
    ok(c2.balance === c1.balance - 120, `🪙 ${c1.balance} → ${c2.balance}`);
    // the same wallet the 小窝's shop reads
    const owned = await p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')).decorOwned.map(r => r.itemId + ':' + r.ptsSpent));
    ok(owned.includes('hm_lv2:600') && owned.includes('hm_xtree:120'), `bought through the 小窝's own ledger (${owned.join(' ')})`);
    await p.evaluate(() => App.closeHome());
    // the tree goes back in its box after the festival, and comes out again next year
    await at(p, '2027-03-01T15:00:00'); await enter(p);
    ok(await p.evaluate(() => !document.querySelector('.hm-xtree')), 'in March the tree is put away');
    await p.click('.hm-tab[data-tab="shop"]'); await sleep(150);
    ok(await p.evaluate(() => /收起来的节日装饰/.test(document.querySelector('.hm-panel').textContent) && !document.querySelector('[data-buy="hm_xtree"]')), '…the shop lists it as stored, and doesn\'t sell it now');
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
    const pieces = await p.evaluate(() => [...document.querySelectorAll('.hm-mini .hm-mp')].map(e => e.querySelector('svg') ? 'svg' : 'emoji'));
    ok(pieces.length === 4 && pieces.every(x => x === 'svg'), `the 客厅 holds the 4 pieces the 小窝 has, drawn the same way (${pieces.join(' ')})`);
    const inside = await p.evaluate(() => { const m = document.querySelector('.hm-mini').getBoundingClientRect(); return [...document.querySelectorAll('.hm-mini .hm-mp')].every(e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.left >= m.left - 1 && r.right <= m.right + 1 && r.bottom <= m.bottom + 1; }); });
    ok(inside, 'every piece sits inside the room, at a size you can see');
    // 一起坐沙发: the 小窝's own sofa is a seat
    ok(await p.evaluate(() => !document.querySelector('[data-a="sit"]').hidden), 'their sofa is in the 客厅, so there is 🛋️ 坐沙发');
    await p.click('[data-a="sit"]'); await idle(p); await sleep(250);
    const sat = await p.evaluate(() => {
      const el = document.querySelector('.hm-ch.hm-me'), ch = el.querySelector('svg').getBoundingClientRect();
      const sofa = [...document.querySelectorAll('.hm-mini .hm-mp')].find(e => /7FB3DC/i.test(e.innerHTML)).getBoundingClientRect();
      const feet = ch.top + ch.height * (100 / 112);   // where the feet are in the drawing
      return { sit: el.classList.contains('hm-sit'), label: document.querySelector('[data-a="sit"]').textContent, feet, top: sofa.top, bottom: sofa.bottom, cx: ch.x + ch.width / 2, l: sofa.left, r: sofa.right, where: HomeGame.test.state().cs.where };
    });
    ok(sat.sit && /站起来/.test(sat.label) && sat.where === '客厅', `CS walked to the sofa and sat down (${sat.label})`);
    ok(sat.feet > sat.top + (sat.bottom - sat.top) * .3 && sat.feet < sat.bottom && sat.cx > sat.l && sat.cx < sat.r, `on the cushion — not floating above it or sunk into the floor (feet ${sat.feet.toFixed(0)}, sofa ${sat.top.toFixed(0)}–${sat.bottom.toFixed(0)})`);
    await p.screenshot({ path: `${SHOTS}/home_sit.png` });
    await p.click('.hm-pad[data-go="garden"]'); await sleep(150);
    ok(await p.evaluate(() => !document.querySelector('.hm-ch.hm-me').classList.contains('hm-sit') && /坐沙发/.test(document.querySelector('[data-a="sit"]').textContent)), 'walking away stands up');
    await idle(p);
    await p.click('.hm-tab[data-tab="house"]'); await p.click('[data-a="nest"]'); await sleep(900);
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
  for (const w of [360, 390, 430, 820, 1280]) for (const theme of ['light', 'dark']) {
    const { p, ctx, errs } = await open(browser, { w, h: w > 800 ? 900 : 844, theme, data: seed({ owned: w === 820 ? ['hm_lv2'] : w === 1280 ? ['hm_lv2', 'hm_lv3'] : [] }), hinted: false });
    await enter(p);
    const m = await p.evaluate(() => {
      const root = document.querySelector('.hm-root'), sc = document.querySelector('.hm-scene').getBoundingClientRect();
      const small = [...root.querySelectorAll('button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40 && !b.classList.contains('hm-edge')).map(b => b.textContent.trim().slice(0, 8));
      const clipped = [...root.querySelectorAll('.hm-tab, .hm-pad, .hm-btn, .hm-prow, .hm-lvc b, .hm-status')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 8));
      const hint = document.querySelector('.hm-hint'), hr = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
      return { over: root.scrollWidth > root.clientWidth + 1, sw: sc.width, sh: sc.height, small, clipped, hint: hr ? hr.left >= sc.left && hr.right <= sc.right : true, font: getComputedStyle(document.querySelector('.hm-pad[data-go="garden"]')).fontSize };
    });
    ok(!m.over && m.sw > 300 && Math.abs(m.sw / m.sh - 4 / 3) < .02 && !m.small.length && !m.clipped.length && m.hint && m.font === '15px',
      `${w} ${theme}: no sideways scroll, a ${Math.round(m.sw)}×${Math.round(m.sh)} house, no small buttons ${JSON.stringify(m.small)}, nothing cut off ${JSON.stringify(m.clipped)}, the hint inside`);
    if (w === 390 || w === 1280) await p.screenshot({ path: `${SHOTS}/home_${w}_${theme}.png` });
    if (errs.length) ok(false, `${w} ${theme} page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { reduced: true, data: seed({ owned: ['hm_lv2', 'hm_lv3'] }), when: '2026-12-20T21:00:00' });
    await enter(p);
    const moving = await p.evaluate(() => document.querySelector('.hm-root').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
    ok(moving === 0, `reduced motion: nothing animates (${moving} running), snow and lights included`);
    await p.click('.hm-pad[data-go="up"]'); await sleep(250);
    const s = await st(p);
    ok(s.cs.f === 56 && !s.cs.path, 'walking is a step, not a glide');
    ok(!errs.length, `no page errors ${errs.slice(0, 2)}`);
    await ctx.close();
  }
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
