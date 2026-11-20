// 小游戏 — 接零食 and 记忆翻牌 — played in a browser on demo data.
//   python3 -m http.server 8765        then:  node tools/games-test.js
// (or APP_URL=http://localhost:PORT/index.html; add ?look=classic for 经典)
//
// What matters here is the payout, not the fun: a game pays each person at
// most once a day, as an ordinary entry dated today, and never twice however
// often it is played. The rest checks the games can actually be played —
// the pet catches what it is under, the cards pair up, photos are used and a
// dead photo falls back — at 360/390/820 in both themes.
// "The player is the login" (§6) cannot be shown in demo mode, where there is
// no login; tools/identity-test.js is where that class of rule is attacked.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PX = c => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${c}"/></svg>`)}`;

function seed({ photos = 0, dead = 0 } = {}) {
  const cols = ['#f99', '#9cf', '#fc9', '#9f9', '#c9f', '#ff9', '#9ff', '#f9c'];
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: {}, history: [], archive: [],
    letters: [], goalName: '', goalIcon: '🎯', goalTarget: 0,
    photos: Array.from({ length: photos }, (_, i) => ({ id: 'ph' + i, image: i < dead ? 'http://localhost:1/gone.jpg' : PX(cols[i % 8]), caption: 'test photo ' + i, date: '2026-01-0' + (i + 1), by: 'char1' })),
    petName: '呆呆', petSpecies: 'dog', petExp: 2600, petBase: 0,
    petEquipped: JSON.stringify({ p: '', m: '', o: '', it: ['ag,16,30', 'aa,10,84', 'ab,78,72'] }),
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [], rewards: [], punishments: [], decorOwned: [],
  };
}
async function open(browser, { when = '2026-11-17T20:00:00', theme = 'light', w = 390, data = seed(), reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g|ERR_CONNECTION/.test(m.text())) errs.push(m.text()); });
  await p.clock.setFixedTime(new Date(when + '+08:00'));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, th]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d));
    localStorage.setItem('theme_mode', th);
    sessionStorage.setItem('seeded', '1');
  }, [data, theme]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode()); await sleep(450);
  return { p, ctx, errs };
}
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')));
const gameRows = async (p) => Object.values((await stored(p)).entries).flat().filter(e => e.catName === '🎮 小游戏');
// keep the pet under the lowest treat (hazards removed: they get their own checks)
const chase = (p, ms) => p.evaluate((ms) => new Promise(done => {
  const t0 = performance.now();
  const step = () => {
    const g = App._mgTest();
    if (g && g.game === 'catch' && !g.over) {
      g.items = g.items.filter(o => !['🌶️', '💣'].includes(o.e));
      const good = g.items.slice().sort((a, b) => b.y - a.y)[0];
      if (good) g.x = good.x;
    }
    performance.now() - t0 < ms ? requestAnimationFrame(step) : done();
  };
  step();
}), ms);
// drop one thing straight onto the pet and report what changed
const drop = (p, e) => p.evaluate((e) => new Promise(done => {
  const g = App._mgTest(); g.items = [{ x: .5, y: 0, v: 500, e }]; g.x = .5; g.pause = 0;
  const before = { got: g.got, hearts: g.hearts, total: g.total };
  const t0 = performance.now();
  const wait = () => { g.items = g.items.filter(o => o.e === e); (g.items.length && performance.now() - t0 < 4000) ? requestAnimationFrame(wait) : setTimeout(() => done([before, { got: g.got, hearts: g.hearts, total: g.total }]), 60); };
  wait();
}), e);
// clear n levels of 接零食 by handing over the target, then run the clock out
const catchRun = async (p, levels) => {
  await p.click('.mg-start'); await sleep(250);
  for (let i = 0; i < levels; i++) {
    const lv = await p.evaluate(() => { const g = App._mgTest(); g.items = []; g.got = 99; return g.lv; });
    await p.waitForFunction((lv) => App._mgTest().lv === lv + 1 && App._mgTest().pause <= 0, lv, { timeout: 5000 });
  }
  await p.evaluate(() => { const g = App._mgTest(); g.items = []; g.got = 0; g.left = .03; });
  await p.waitForFunction(() => App._mgTest().done, null, { timeout: 5000 }); await sleep(150);
};
const wrong = async (p, n) => {
  for (let i = 0; i < n; i++) {
    const [a, b] = await p.evaluate(() => { const c = [...document.querySelectorAll('.mg-card')]; const a = c.find(x => !x.classList.contains('mg-ok')); const b = c.find(x => !x.classList.contains('mg-ok') && x.dataset.k !== a.dataset.k); return [c.indexOf(a), c.indexOf(b)]; });
    await p.click(`.mg-card >> nth=${a}`); await p.click(`.mg-card >> nth=${b}`); await sleep(900);
  }
};
// pair up everything still face down on the current level
const solve = async (p) => {
  const ks = await p.evaluate(() => [...new Set([...document.querySelectorAll('.mg-card:not(.mg-ok)')].map(c => c.dataset.k))]);
  for (const k of ks) { await p.click(`.mg-card[data-k="${k}"] >> nth=0`); await p.click(`.mg-card[data-k="${k}"] >> nth=1`); await sleep(90); }
  await sleep(150);
};
const cardsDone = (p) => p.waitForFunction(() => App._mgTest() && App._mgTest().done, null, { timeout: 5000 });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. 分数和关卡规则');
  {
    const { p, ctx } = await open(browser);
    const t = await p.evaluate(() => [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [12, 3]].map(([n, w]) => App._gamePointsTest('catch', n) === w));
    ok(t.every(Boolean), '接零食：过 1 / 3 / 5 关 → +1 / +2 / +3，一关没过没有分');
    const c = await p.evaluate(() => [[0, 0], [1, 1], [2, 2], [3, 3], [4, 3]].map(([n, w]) => App._gamePointsTest('cards', n) === w));
    ok(c.every(Boolean), '翻牌：过 1 / 2 / 3 关 → +1 / +2 / +3，4 关也是 +3');
    const L = await p.evaluate(() => [1, 2, 3, 4, 5, 6, 9, 20].map(n => App._catchLevelTest(n)));
    ok(L.map(x => x.need).join() === '8,10,12,13,14,15,16,16', `每关要接的数量：${L.map(x => x.need).join(' → ')}`);
    ok(L.every((x, i) => !i || (x.speed > L[i - 1].speed && x.gap <= L[i - 1].gap && x.chilli >= L[i - 1].chilli)), '一关比一关快、密、辣椒多');
    ok(L[0].bomb === 0 && L[1].bomb === 0 && L[2].bomb > 0 && L[0].star === 0 && L[1].star > 0 && L.every(x => x.bomb + x.chilli + x.star < .6), '炸弹从第 3 关开始，星星从第 2 关开始，零食始终占大多数');
    await ctx.close();
  }

  console.log('\n2. 从小窝进去');
  {
    const { p, ctx, errs } = await open(browser);
    const home = await p.evaluate(() => { const a = document.getElementById('checkin-banner').getBoundingClientRect(), c = document.getElementById('mg-home'), b = c && c.getBoundingClientRect(); return c && { n: document.querySelectorAll('#mg-home').length, same: Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1, gap: Math.round(b.top - a.bottom), sub: document.getElementById('mg-home-sub').textContent }; });
    ok(home && home.n === 1 && home.same && home.gap === 12 && /今天还能拿分/.test(home.sub), `首页有「小游戏」卡片，和签到卡片同宽同边距 ${JSON.stringify(home)}`);
    await p.evaluate(() => App.nav('home')); await sleep(200);
    ok(await p.evaluate(() => document.querySelectorAll('#mg-home').length === 1), '首页重画以后还是只有一张');
    await p.evaluate(() => document.getElementById('mg-home').click()); await sleep(300);
    ok(await p.evaluate(() => [...document.querySelectorAll('.mg-pick')].map(b => b.dataset.g).join() === 'coop,beat,catch,cards'), '点它打开选游戏的页面（一起回家、默契拍拍在最前面）');
    await p.evaluate(() => App.closeGames());
    await p.evaluate(() => App.showPetHome()); await sleep(600);
    const door = await p.evaluate(() => { const b = document.querySelector('.pet-panel .mg-open'); const r = b && b.getBoundingClientRect(); return b && { n: document.querySelectorAll('.pet-panel .mg-open').length, h: r.height, vis: r.bottom <= innerHeight && r.width > 200 }; });
    ok(door && door.n === 1 && door.h >= 40 && door.vis, `小窝里有一个「和它玩小游戏」按钮 ${JSON.stringify(door)}`);
    await p.evaluate(() => { App.closePetHome(); return App.showPetHome(); }); await sleep(500);
    ok(await p.evaluate(() => document.querySelectorAll('.pet-panel .mg-open').length === 1), '再进一次小窝，按钮不会变成两个');
    await p.click('.pet-panel .mg-open'); await sleep(400);
    const pick = await p.evaluate(() => ({ n: document.querySelectorAll('.mg-pick[data-g="catch"], .mg-pick[data-g="cards"]').length, top: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.mg-root'), pay: [...document.querySelectorAll('.mg-pick[data-g="catch"] .mg-pay, .mg-pick[data-g="cards"] .mg-pay')].map(x => x.textContent) }));
    ok(pick.n === 2 && pick.top && pick.pay.every(t => /最多 \+3 分/.test(t)), `选游戏的页面盖在小窝上面，两个游戏都写着今天能拿多少 ${JSON.stringify(pick.pay)}`);
    await p.screenshot({ path: `${SHOTS}/games_01_pick.png` });
    await p.keyboard.press('Escape'); await sleep(200);
    ok(await p.evaluate(() => !document.querySelector('.mg-root')), 'Esc 关掉');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n3. 接零食');
  {
    const { p, ctx, errs } = await open(browser);
    await p.evaluate(() => App.showPetHome()); await sleep(500);
    await p.evaluate(() => App.playGame('catch')); await sleep(300);
    ok(await p.evaluate(() => !!document.querySelector('.mg-pet svg') && App._mgTest().over), '场上是自己的宠物，还没开始');
    await p.click('.mg-start'); await chase(p, 6000);   // short enough that level 1 (8) cannot be cleared yet
    const g1 = await p.evaluate(() => { const g = App._mgTest(); return { total: g.total, lv: g.lv, hud: document.querySelector('.mg-score').textContent, hearts: document.querySelector('.mg-hearts').textContent }; });
    ok(g1.total >= 2 && g1.lv === 1 && g1.hearts === '❤️❤️❤️', `追着零食跑 6 秒真的接到了 ${g1.total} 个（第 ${g1.lv} 关，${g1.hud}）`);
    await p.screenshot({ path: `${SHOTS}/games_02_catch.png` });
    await p.evaluate(() => { const g = App._mgTest(); g.got = 3; g.left = 12; });
    const chilli = await drop(p, '🌶️');
    ok(chilli[1].got === chilli[0].got - 2 && chilli[1].hearts === 3, `辣椒扣 2 个（${chilli[0].got} → ${chilli[1].got}），不掉心`);
    await p.evaluate(() => { App._mgTest().left = 12; });
    const star = await drop(p, '⭐');
    ok(star[1].got === star[0].got + 3 && star[1].total === star[0].total + 3, `星星算 3 个（${star[0].got} → ${star[1].got}）`);
    await p.evaluate(() => { App._mgTest().left = 12; });
    const bomb = await drop(p, '💣');
    ok(bomb[1].hearts === 2 && bomb[1].got === bomb[0].got && /🤍/.test(await p.textContent('.mg-hearts')), `炸弹掉一颗心（${await p.textContent('.mg-hearts')}），数量不变`);
    // time runs out on level 1: nothing is paid
    await p.evaluate(() => { const g = App._mgTest(); g.items = []; g.got = 2; g.left = .03; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(100);
    ok((await gameRows(p)).length === 0 && /过了第 1 关才有分/.test(await p.textContent('.mg-cover')) && /差 6 个/.test(await p.textContent('.mg-cover')), `第 1 关没过：没有分，说清楚差多少 「${(await p.textContent('.mg-cover .mg-line')).trim()}」`);
    // 3 levels cleared → +2
    await catchRun(p, 3);
    let rows = await gameRows(p);
    ok(rows.length === 1 && rows[0].pts === 2 && rows[0].date === '2026-11-17' && rows[0].month === '2026-11' && rows[0].charId === 'char1' && /^接零食 · 过了 3 关/.test(rows[0].desc),
      `过了 3 关：记了一笔 ${JSON.stringify(rows[0] && { pts: rows[0].pts, who: rows[0].charId, date: rows[0].date, desc: rows[0].desc })}`);
    ok(/\+2 分，记给 CS/.test(await p.textContent('.mg-cover')) && /过了 3 关/.test(await p.textContent('.mg-cover')), `结果页：「${(await p.textContent('.mg-cover .mg-win')).trim()}」`);
    await p.screenshot({ path: `${SHOTS}/games_03_catch_done.png` });
    // a weaker run the same day adds nothing
    await catchRun(p, 1);
    ok((await gameRows(p)).length === 1 && /要比上一局过更多关/.test(await p.textContent('.mg-cover')), '同一天再过 1 关：不加分，也说了为什么');
    // a better run tops the day up to the cap, and no further
    await catchRun(p, 5);
    rows = await gameRows(p);
    ok(rows.length === 2 && rows.reduce((n, r) => n + r.pts, 0) === 3 && /\+1 分/.test(await p.textContent('.mg-cover')) && /新纪录/.test(await p.textContent('.mg-cover')), `后来过了 5 关：补 +1，今天一共 +3，并提示新纪录（${rows.map(r => '+' + r.pts).join('，')}）`);
    await catchRun(p, 7);
    ok((await gameRows(p)).length === 2 && /拿满/.test(await p.textContent('.mg-cover')), '再过 7 关：今天已经拿满，不再记分');
    const best = await p.evaluate(() => App._gameBestTest('catch'));
    ok(best && best.lv === 7, `最高纪录记下来了：${JSON.stringify(best)}`);
    // hearts end the run
    await p.click('.mg-start'); await sleep(250);
    await p.evaluate(() => { App._mgTest().hearts = 1; });
    await drop(p, '💣'); await p.waitForFunction(() => App._mgTest().done); await sleep(100);
    ok(/三颗心都没了/.test(await p.textContent('.mg-cover')), '心掉光了，这局结束');
    await p.evaluate(() => App.closeGames()); await sleep(200);
    ok(/🎮 小游戏/.test(await p.evaluate(() => document.querySelector('.entry-day-items')?.textContent || '')), '这些分出现在首页「本月记录」里');
    await p.evaluate(() => App.openGames()); await sleep(200);
    const pay = await p.evaluate(() => [...document.querySelectorAll('.mg-pick[data-g="catch"], .mg-pick[data-g="cards"]')].map(x => x.textContent));
    ok(/拿满啦/.test(pay[0]) && /最高纪录：过了 7 关/.test(pay[0]) && /今天最多 \+3/.test(pay[1]), '选游戏页：接零食写「拿满啦」和最高纪录，翻牌还能拿');
    // the flag alone is not the rule: clear it and the ledger still says paid
    await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('mg_done_')).forEach(k => localStorage.removeItem(k)));
    await p.evaluate(() => App.playGame('catch')); await sleep(200);
    await catchRun(p, 6);
    ok((await gameRows(p)).length === 2, '清掉手机上的标记也拿不到更多：是按记录算的');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // leaving half way banks what was cleared; tomorrow pays again
    const { p, ctx, errs } = await open(browser);
    await p.evaluate(() => App.playGame('catch')); await sleep(200); await p.click('.mg-start'); await sleep(250);
    const lv = await p.evaluate(() => { const g = App._mgTest(); g.items = []; g.got = 99; return g.lv; });
    await p.waitForFunction((lv) => App._mgTest().lv === lv + 1, lv);
    await p.evaluate(() => App.closeGames()); await sleep(600);
    let rows = await gameRows(p);
    ok(rows.length === 1 && rows[0].pts === 1 && !errs.length && await p.evaluate(() => !document.querySelector('.mg-root')), `过了 1 关就关掉：这 1 关的分还是记上了，干净退出 ${errs.join(' | ')}`);
    await p.evaluate(() => App.playGame('catch')); await sleep(200); await p.click('.mg-start'); await sleep(200);
    await p.evaluate(() => App.closeGames()); await sleep(300);
    ok((await gameRows(p)).length === 1, '刚开始就关掉：什么都不记');
    await p.clock.setFixedTime(new Date('2026-11-18T09:00:00+08:00'));
    await p.evaluate(() => App.playGame('catch')); await sleep(200);
    await catchRun(p, 5);
    rows = await gameRows(p);
    ok(rows.length === 2 && rows.some(r => r.date === '2026-11-18' && r.pts === 3), `第二天又可以拿满：${rows.map(r => r.date + ' +' + r.pts).join('，')}`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n4. 记忆翻牌');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ photos: 12 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(500);
    const shape = () => p.evaluate(() => { const c = [...document.querySelectorAll('.mg-card')]; const n = {}; c.forEach(x => n[x.dataset.k] = (n[x.dataset.k] || 0) + 1); const g = App._mgTest(); return { cards: c.length, pairs: Object.keys(n).length, even: Object.values(n).every(x => x === 2), imgs: document.querySelectorAll('.mg-face img').length, up: document.querySelectorAll('.mg-up').length, cols: getComputedStyle(document.querySelector('.mg-cards')).gridTemplateColumns.split(' ').length, lv: g.lv, limit: g.limit, hud: document.querySelector('.mg-moves').textContent }; });
    let d = await shape();
    ok(d.cards === 12 && d.pairs === 6 && d.even && d.up === 0 && d.cols === 3 && d.limit === 14 && d.hud === '0 / 14 步', `第 1 关：12 张牌 6 对，3 列，14 步以内 ${JSON.stringify(d)}`);
    ok(d.imgs === 12, `有照片时，牌面全是自己的照片（${d.imgs} 张图）`);
    await wrong(p, 3); await solve(p);
    ok(await p.evaluate(() => !!document.querySelector('.mg-next') && App._mgTest().waiting) && (await gameRows(p)).length === 0, '第 1 关过了：出现「下一关」，这时还没记分');
    await p.click('.mg-card >> nth=0'); await sleep(100);
    await p.click('.mg-next'); await sleep(300);
    d = await shape();
    ok(d.cards === 16 && d.pairs === 8 && d.even && d.up === 0 && d.cols === 4 && d.limit === 20 && d.lv === 2 && d.imgs === 16, `第 2 关：16 张牌 8 对，4 列，20 步以内 ${JSON.stringify(d)}`);
    await solve(p); await p.click('.mg-next'); await sleep(300);
    d = await shape();
    ok(d.cards === 20 && d.pairs === 10 && d.even && d.limit === 25 && d.lv === 3 && d.imgs === 20, `第 3 关：20 张牌 10 对，25 步以内`);
    await p.screenshot({ path: `${SHOTS}/games_04_cards.png` });
    await solve(p); await p.click('.mg-next'); await sleep(300);
    d = await shape();
    ok(d.cards === 20 && d.limit === 21 && d.lv === 4, '第 4 关：还是 10 对，只给 21 步');
    await solve(p); await cardsDone(p); await sleep(150);
    let rows = await gameRows(p);
    const g = await p.evaluate(() => ({ total: App._mgTest().total, txt: document.querySelector('.mg-result').textContent }));
    ok(g.total === 37 && rows.length === 1 && rows[0].pts === 3 && /^记忆翻牌 · 过了 4 关 · 用了 37 步/.test(rows[0].desc) && /4 关全部通关/.test(g.txt), `全部通关：+3 ${JSON.stringify(rows[0] && { pts: rows[0].pts, desc: rows[0].desc })}`);
    await p.click('.mg-again'); await sleep(300);
    d = await shape();
    ok(d.cards === 12 && d.up === 0 && d.lv === 1 && await p.evaluate(() => App._mgTest().total === 0), '从第 1 关再来：重新洗牌，步数归零');
    await solve(p); await p.evaluate(() => App.closeGames()); await sleep(500);
    ok((await gameRows(p)).length === 1, '拿满以后再玩再关，不会多记');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // out of moves; then the top-up; then leaving after a cleared level
    const { p, ctx, errs } = await open(browser, { data: seed({ photos: 6 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(400);
    await wrong(p, 14); await cardsDone(p); await sleep(100);
    ok((await gameRows(p)).length === 0 && /步数用完了/.test(await p.textContent('.mg-result')) && /还差 6 对/.test(await p.textContent('.mg-result')), '14 步全错：步数用完，这局结束，没有分');
    ok(await p.evaluate(() => { const before = document.querySelectorAll('.mg-up').length; document.querySelector('.mg-card:not(.mg-up)').click(); return document.querySelectorAll('.mg-up').length === before; }), '结束以后牌点不动了');
    await p.click('.mg-again'); await sleep(300);
    await solve(p); await p.click('.mg-next'); await sleep(300); await wrong(p, 20); await cardsDone(p); await sleep(150);
    let rows = await gameRows(p);
    ok(rows.length === 1 && rows[0].pts === 1 && /过了 1 关/.test(rows[0].desc), `过第 1 关、第 2 关步数用完：+1 ${JSON.stringify(rows[0] && rows[0].desc)}`);
    await p.click('.mg-again'); await sleep(300);
    await solve(p); await p.click('.mg-next'); await sleep(300); await solve(p); await sleep(200);
    await p.evaluate(() => App.closeGames()); await sleep(600);
    rows = await gameRows(p);
    ok(rows.length === 2 && rows.reduce((n, r) => n + r.pts, 0) === 2, `过了 2 关后直接关掉：补 +1，今天一共 +2（${rows.map(r => '+' + r.pts).join('，')}）`);
    const best = await p.evaluate(() => App._gameBestTest('cards'));
    ok(best && best.lv === 2, `最高纪录：${JSON.stringify(best)}`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ photos: 2 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(400);
    ok(await p.evaluate(() => document.querySelectorAll('.mg-face img').length === 4 && [...document.querySelectorAll('.mg-face')].every(f => f.querySelector('img') || f.textContent.trim())), '只有 2 张照片：两对用照片，其余用图案补上，没有空白牌');
    await solve(p); await p.click('.mg-next'); await sleep(300); await solve(p); await p.click('.mg-next'); await sleep(300);
    ok(await p.evaluate(() => { const f = [...document.querySelectorAll('.mg-face')]; const t = f.filter(x => !x.querySelector('img')).map(x => x.textContent.trim()); const n = {}; t.forEach(x => n[x] = (n[x] || 0) + 1); return f.length === 20 && t.every(Boolean) && Object.values(n).every(x => x === 2); }), '第 3 关 10 对：补上的图案每种正好两张，没有重复的一对');
    await ctx.close();
    const b = await open(browser, { data: seed({ photos: 6, dead: 2 }) });
    await b.p.evaluate(() => App.playGame('cards')); await sleep(1200);
    const f = await b.p.evaluate(() => ({ imgs: document.querySelectorAll('.mg-face img').length, blank: [...document.querySelectorAll('.mg-face')].filter(f => !f.querySelector('img') && !f.textContent.trim()).length }));
    ok(f.imgs === 8 && f.blank === 0, `照片打不开时那一对换成图案（剩 ${f.imgs} 张图，空白 ${f.blank}）`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await b.ctx.close();
  }
  {
    const { p, ctx } = await open(browser, { data: seed({ photos: 3 }) });
    await p.evaluate(() => App.showLovePage()); await sleep(700);
    const door = await p.evaluate(() => { const b = document.getElementById('mg-cards-open'); return b && { n: document.querySelectorAll('#mg-cards-open').length, h: b.getBoundingClientRect().height }; });
    ok(door && door.n === 1 && door.h >= 36, `「我们的时光」里也有翻牌的入口 ${JSON.stringify(door)}`);
    await p.evaluate(() => document.getElementById('mg-cards-open').click()); await sleep(400);
    ok(await p.evaluate(() => !!document.elementFromPoint(innerWidth / 2, 300).closest('.mg-root')), '从那里打开，游戏盖在最上面');
    await ctx.close();
  }

  console.log('\n5. 各种屏幕和深浅色');
  for (const w of [360, 390, 820]) for (const theme of ['light', 'dark']) {
    const { p, ctx, errs } = await open(browser, { w, theme, data: seed({ photos: 6 }) });
    const m = {};
    for (const game of ['catch', 'cards']) {
      await p.evaluate((g) => App.playGame(g), game); await sleep(400);
      m[game] = await p.evaluate(() => {
        const r = document.querySelector('.mg-root'), col = document.querySelector('.mg-col').getBoundingClientRect();
        const small = [...r.querySelectorAll('button')].filter(b => { const q = b.getBoundingClientRect(); return q.width && (q.width < 40 || q.height < 40); }).length;
        const last = [...r.querySelectorAll('.mg-card, .mg-field')].pop().getBoundingClientRect();
        return { over: document.documentElement.scrollWidth > innerWidth || r.scrollWidth > r.clientWidth, in: col.left >= 15 && col.right <= innerWidth - 15, small, fits: last.bottom <= innerHeight + 1 };
      });
      await p.screenshot({ path: `${SHOTS}/games_05_${game}_${w}_${theme}.png` });
    }
    await solve(p); await p.click('.mg-next'); await sleep(250); await solve(p); await p.click('.mg-next'); await sleep(300);
    m.big = await p.evaluate(() => { const r = document.querySelector('.mg-root'), c = [...document.querySelectorAll('.mg-card')], q = c.map(x => x.getBoundingClientRect()); const col = document.querySelector('.mg-col').getBoundingClientRect(); return { over: r.scrollWidth > r.clientWidth, in: Math.min(...q.map(x => x.left)) >= 15 && Math.max(...q.map(x => x.right)) <= innerWidth - 15, small: q.filter(x => x.width < 44).length, fits: q[q.length - 1].bottom <= innerHeight + 1, col: col.width > 0 }; });
    await p.screenshot({ path: `${SHOTS}/games_05_cards20_${w}_${theme}.png` });
    const bad = Object.entries(m).filter(([, v]) => v.over || !v.in || v.small || !v.fits);
    ok(!bad.length && !errs.length, `${w}px ${theme}：不横向滚动、有边距、按钮够大、一屏放得下 ${bad.length ? JSON.stringify(m) : ''} ${errs.join(' | ')}`);
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { reduced: true, data: seed({ photos: 6 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(300);
    ok(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.mg-card i')).transitionDuration) < 0.01), '减少动态效果：牌不翻转动画，直接换面');
    await solve(p); await p.evaluate(() => App.closeGames()); await sleep(500);
    ok((await gameRows(p)).length === 1 && !errs.length, '照样能玩、能记分');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
