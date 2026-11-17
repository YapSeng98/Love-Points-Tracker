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
// keep the pet under the lowest treat
const chase = (p, ms) => p.evaluate((ms) => new Promise(done => {
  const t0 = performance.now();
  const step = () => {
    const g = App._mgTest();
    if (g && g.game === 'catch' && !g.over) {
      g.items = g.items.filter(o => o.e !== '🌶️');   // chillies get their own check below
      const good = g.items.slice().sort((a, b) => b.y - a.y)[0];
      if (good) g.x = good.x;
    }
    performance.now() - t0 < ms ? requestAnimationFrame(step) : done();
  };
  step();
}), ms);
const solve = async (p, wrongFirst = 0) => {
  for (let i = 0; i < wrongFirst; i++) {
    const [a, b] = await p.evaluate(() => { const c = [...document.querySelectorAll('.mg-card:not(.mg-ok)')]; const a = c[0]; const b = c.find(x => x.dataset.k !== a.dataset.k); return [c.indexOf(a), c.indexOf(b)]; });
    await p.click(`.mg-card:not(.mg-ok) >> nth=${a}`); await p.click(`.mg-card:not(.mg-ok) >> nth=${b}`); await sleep(950);
  }
  for (let k = 0; k < 6; k++) { await p.click(`.mg-card[data-k="${k}"] >> nth=0`); await p.click(`.mg-card[data-k="${k}"] >> nth=1`); await sleep(120); }
  await p.waitForFunction(() => App._mgTest() && App._mgTest().done, null, { timeout: 5000 });
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. 分数规则');
  {
    const { p, ctx } = await open(browser);
    const t = await p.evaluate(() => [[9, 0], [10, 1], [19, 1], [20, 2], [27, 2], [28, 3], [60, 3]].map(([n, w]) => App._gamePointsTest('catch', n) === w));
    ok(t.every(Boolean), '接零食：10 / 20 / 28 个 → +1 / +2 / +3，9 个没有分');
    const c = await p.evaluate(() => [[6, 3], [9, 3], [10, 2], [13, 2], [14, 1], [40, 1]].map(([n, w]) => App._gamePointsTest('cards', n) === w));
    ok(c.every(Boolean), '翻牌：9 步内 +3，13 步内 +2，找齐就 +1');
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
    ok(await p.evaluate(() => document.querySelectorAll('.mg-pick').length === 2), '点它打开选游戏的页面');
    await p.evaluate(() => App.closeGames());
    await p.evaluate(() => App.showPetHome()); await sleep(600);
    const door = await p.evaluate(() => { const b = document.querySelector('.pet-panel .mg-open'); const r = b && b.getBoundingClientRect(); return b && { n: document.querySelectorAll('.pet-panel .mg-open').length, h: r.height, vis: r.bottom <= innerHeight && r.width > 200 }; });
    ok(door && door.n === 1 && door.h >= 40 && door.vis, `小窝里有一个「和它玩小游戏」按钮 ${JSON.stringify(door)}`);
    await p.evaluate(() => { App.closePetHome(); return App.showPetHome(); }); await sleep(500);
    ok(await p.evaluate(() => document.querySelectorAll('.pet-panel .mg-open').length === 1), '再进一次小窝，按钮不会变成两个');
    await p.click('.pet-panel .mg-open'); await sleep(400);
    const pick = await p.evaluate(() => ({ n: document.querySelectorAll('.mg-pick').length, top: !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.mg-root'), pay: [...document.querySelectorAll('.mg-pay')].map(x => x.textContent) }));
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
    await p.click('.mg-start'); await chase(p, 9000);
    const g1 = await p.evaluate(() => { const g = App._mgTest(); return { score: g.score, left: g.left, hud: document.querySelector('.mg-score').textContent }; });
    ok(g1.score >= 4 && g1.left < 12 && g1.hud === `接到 ${g1.score}`, `追着零食跑 9 秒真的接到了：${g1.hud}，还剩 ${g1.left.toFixed(1)} 秒`);
    await p.screenshot({ path: `${SHOTS}/games_02_catch.png` });
    // a chilli costs two
    const hit = await p.evaluate(() => new Promise(done => { const g = App._mgTest(); g.items = [{ x: .5, y: 0, v: 400, e: '🌶️' }]; g.x = .5; const s = g.score; setTimeout(() => done([s, g.score]), 1500); }));
    ok(hit[1] <= hit[0] - 1 || hit[0] === 0, `接到辣椒会扣分（${hit[0]} → ${hit[1]}）`);
    // under 10: nothing is paid, and the day is not used up
    await p.evaluate(() => { const g = App._mgTest(); g.items = []; g.score = 7; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(100);
    ok((await gameRows(p)).length === 0 && /接到 10 个才有分/.test(await p.textContent('.mg-cover')), '7 个：没有分，也没有用掉今天的机会');
    await p.click('.mg-start'); await sleep(300);
    await p.evaluate(() => { const g = App._mgTest(); g.score = 21; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(200);
    let rows = await gameRows(p);
    ok(rows.length === 1 && rows[0].pts === 2 && rows[0].date === '2026-11-17' && rows[0].month === '2026-11' && rows[0].charId === 'char1' && /^接零食 · 接到 21 个/.test(rows[0].desc),
      `21 个：记了一笔 ${JSON.stringify(rows[0] && { pts: rows[0].pts, who: rows[0].charId, date: rows[0].date, desc: rows[0].desc })}`);
    ok(/\+2 分，记给 CS/.test(await p.textContent('.mg-cover')), `结果页说清楚了：「${(await p.textContent('.mg-cover .mg-win')).trim()}」`);
    await p.screenshot({ path: `${SHOTS}/games_03_catch_done.png` });
    await p.click('.mg-start'); await sleep(300);
    await p.evaluate(() => { const g = App._mgTest(); g.score = 40; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(200);
    rows = await gameRows(p);
    ok(rows.length === 1 && /纯玩/.test(await p.textContent('.mg-cover')), '同一天再玩 40 个：不会再记分');
    await p.evaluate(() => App.closeGames()); await sleep(200);
    ok(/🎮 小游戏/.test(await p.evaluate(() => document.querySelector('.entry-day-items')?.textContent || '')), '这笔分出现在首页「本月记录」里');
    await p.evaluate(() => App.openGames()); await sleep(200);
    const pay = await p.evaluate(() => [...document.querySelectorAll('.mg-pay')].map(x => x.textContent));
    ok(/拿过啦/.test(pay[0]) && /最多 \+3/.test(pay[1]), `选游戏页：接零食写「拿过啦」，翻牌还能拿 ${JSON.stringify(pay)}`);
    // the flag alone is not the rule: clear it and the ledger still says paid
    await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('mg_done_')).forEach(k => localStorage.removeItem(k)));
    await p.evaluate(() => App.playGame('catch')); await sleep(200); await p.click('.mg-start'); await sleep(200);
    await p.evaluate(() => { const g = App._mgTest(); g.score = 30; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(200);
    ok((await gameRows(p)).length === 1, '清掉手机上的标记也拿不到第二次：是按记录算的');
    await p.evaluate(() => App.closeGames()); await p.evaluate(() => App.playGame('cards')); await sleep(400); await solve(p, 0); await p.evaluate(() => App.closeGames()); await sleep(200);
    ok(/拿过啦/.test(await p.textContent('#mg-home-sub')), `两个游戏都拿过分以后，首页卡片改口：「${await p.textContent('#mg-home-sub')}」`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // tomorrow it pays again; closing mid-save does not break anything
    const { p, ctx, errs } = await open(browser);
    await p.evaluate(() => App.playGame('catch')); await sleep(200); await p.click('.mg-start'); await sleep(200);
    await p.evaluate(() => { const g = App._mgTest(); g.score = 12; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(150);
    await p.clock.setFixedTime(new Date('2026-11-18T09:00:00+08:00'));
    await p.click('.mg-start'); await sleep(200);
    await p.evaluate(() => { const g = App._mgTest(); g.score = 29; g.left = .05; });
    await p.waitForFunction(() => App._mgTest().done); await sleep(200);
    const rows = await gameRows(p);
    ok(rows.length === 2 && rows.some(r => r.date === '2026-11-18' && r.pts === 3), `第二天又可以拿分：${rows.map(r => r.date + ' +' + r.pts).join('，')}`);
    await p.click('.mg-start'); await sleep(200);
    await p.evaluate(() => { App._mgTest().left = .05; App.closeGames(); }); await sleep(400);
    ok(!errs.length && await p.evaluate(() => !document.querySelector('.mg-root')), '玩到一半关掉：干净退出，无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n4. 记忆翻牌');
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ photos: 8 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(500);
    const d = await p.evaluate(() => { const c = [...document.querySelectorAll('.mg-card')]; const n = {}; c.forEach(x => n[x.dataset.k] = (n[x.dataset.k] || 0) + 1); return { cards: c.length, pairs: Object.values(n), imgs: document.querySelectorAll('.mg-face img').length, up: document.querySelectorAll('.mg-up').length }; });
    ok(d.cards === 12 && d.pairs.length === 6 && d.pairs.every(x => x === 2) && d.up === 0, '12 张牌，6 对，一开始都盖着');
    ok(d.imgs === 12, `有照片时，牌面全是自己的照片（${d.imgs} 张图）`);
    await solve(p, 4);
    await p.screenshot({ path: `${SHOTS}/games_04_cards.png` });
    const g = await p.evaluate(() => ({ moves: App._mgTest().moves, txt: document.querySelector('.mg-result').textContent }));
    let rows = await gameRows(p);
    ok(g.moves === 10 && rows.length === 1 && rows[0].pts === 2 && /^记忆翻牌 · 10 步找齐/.test(rows[0].desc), `错 4 次共 10 步 → +2：${JSON.stringify(rows[0] && { pts: rows[0].pts, desc: rows[0].desc })}`);
    await p.click('.mg-again'); await sleep(300);
    ok(await p.evaluate(() => document.querySelectorAll('.mg-up').length === 0 && App._mgTest().moves === 0), '再玩一次：重新洗牌，步数归零');
    await solve(p, 0);
    rows = await gameRows(p);
    ok(rows.length === 1 && /纯玩/.test(await p.textContent('.mg-result')), '第二局 6 步全对也不会再记分');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { data: seed({ photos: 2 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(400);
    ok(await p.evaluate(() => document.querySelectorAll('.mg-face img').length === 4 && [...document.querySelectorAll('.mg-face')].every(f => f.querySelector('img') || f.textContent.trim())), '只有 2 张照片：两对用照片，其余用图案补上，没有空白牌');
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
    const bad = Object.entries(m).filter(([, v]) => v.over || !v.in || v.small || !v.fits);
    ok(!bad.length && !errs.length, `${w}px ${theme}：不横向滚动、有边距、按钮够大、一屏放得下 ${bad.length ? JSON.stringify(m) : ''} ${errs.join(' | ')}`);
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await open(browser, { reduced: true, data: seed({ photos: 6 }) });
    await p.evaluate(() => App.playGame('cards')); await sleep(300);
    ok(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.mg-card i')).transitionDuration) < 0.01), '减少动态效果：牌不翻转动画，直接换面');
    await solve(p, 0);
    ok((await gameRows(p)).length === 1 && !errs.length, '照样能玩完、能记分');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
