// 首页 · 积分 · ＋ · 一起 · 商店 (CLAUDE.md §7.36) in a browser, on demo data and a faked clock.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:8766/index.html)
//   node tools/nav-test.js            ONLY=3,7 runs some sections; LOOK=classic runs them in 经典
//
// Asked for 2026-11-25: 「the main page looks so messy … improve the system design for the
// navigation and user view」, then 「the theme dun change, just the card and the idea for the
// navigation button」. So the look is the same; what moved is where things live:
//   首页  the header and the hero, 今天 (only what is still to do), 本月, 常用记分
//   积分  本月 (whose points, the score card, 记分, 本月记录) · 历史 · 奖惩表
//   一起  我们的家, 小窝, 共同目标, 小游戏, 情书, 我们的时光
//   商店  the shop page with the bar above it;  ＋ from anywhere;  ⚙️ on every page

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const LOOK = process.env.LOOK || '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = (n) => !ONLY.length || ONLY.includes(String(n));
const DAY = '2026-11-25T10:30:00+08:00', NIGHT = '2026-11-25T21:30:00+08:00';

// Fixtures are made up (CLAUDE.md §7.258): nothing here is anyone's real words.
function seed({ older = false, letters = true, garden = false, checked = false, played = false, cats = true } = {}) {
  const C = [['c1','💑','陪伴时光',10],['c2','🎁','惊喜礼物',15],['c3','🍳','亲自煮饭',8],['c4','🧹','做家务',5],['c5','📅','记住重要日',20],['c8','😤','忘记约定',-10],['c10','📱','手机太久',-5]];
  const ent = [];
  // 忘记约定 is the one used most; it must be among the four on 首页
  const uses = ['c8','c8','c8','c8','c1','c1','c1','c2','c2','c3','c4','c10'];
  uses.forEach((id, i) => { const c = C.find(x => x[0] === id); ent.push({ id: 'e' + i, catId: id, catName: c[2], icon: c[1], pts: c[3], desc: '', date: `2026-11-${String(24 - (i % 9)).padStart(2, '0')}`, charId: i % 3 ? 'char2' : 'char1', month: '2026-11' }); });
  ent.push({ id: 'ck2', catId: '', catName: '📅 每日签到', icon: '📅', pts: 2, desc: '每日签到', date: '2026-11-25', charId: 'char2', month: '2026-11' });
  if (checked) ent.push({ id: 'ck1', catId: '', catName: '📅 每日签到', icon: '📅', pts: 2, desc: '每日签到', date: '2026-11-25', charId: 'char1', month: '2026-11' });
  if (played) ent.push({ id: 'g1', catId: '', catName: '🎮 小游戏', icon: '🎮', pts: 2, desc: '接零食 · 接到 21 个', date: '2026-11-25', charId: 'char1', month: '2026-11' });
  const entries = { '2026-11': ent };
  if (older) entries['2026-10'] = [{ id: 'o1', catId: 'c1', catName: '陪伴时光', icon: '💑', pts: 10, desc: '', date: '2026-10-30', charId: 'char1', month: '2026-10' }];
  const pots = garden ? [
    { id: 'a', seed: 'daisy', at: '2026-11-23', by: 'char1', w: { '2026-11-24': 1 } },                                   // wants water today
    { id: 'b', seed: 'daisy', at: '2026-11-20', by: 'char1', w: { '2026-11-21': 3, '2026-11-22': 3, '2026-11-23': 1 } }, // in flower
  ] : [];
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries,
    history: [{ month: '2026-10', mode: 'reward', char1Pts: 120, char2Pts: 98, result1: '约会一次', result2: '小零食一份', settledAt: '2026-10-31T22:00:00' }],
    archive: [], photos: [],
    letters: letters ? [{ id: 'l1', charId: 'char2', title: '测试信', body: '这是一封测试用的信。', date: '2026-11-20', opened: false },
                        { id: 'l2', charId: 'char1', title: '测试信二', body: '测试。', date: '2026-11-10', opened: true }] : [],
    goalName: '一起去旅行', goalIcon: '✈️', goalTarget: 2000, petName: '呆呆', petSpecies: 'dog', petExp: 900, petBase: 0, petEquipped: '',
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24', birthday1: '03-16', birthday2: '11-01',
    categories: cats ? C.map(([id, icon, name, pts]) => ({ id, icon, name, pts, active: true })) : [],
    rewards: [{ id: 'r1', icon: '🍦', name: '小零食一份', desc: '任意选一样零食', minPts: 30 }, { id: 'r2', icon: '🎬', name: '约会一次', desc: '对方安排', minPts: 60 }],
    punishments: [{ id: 'p1', icon: '🧹', name: '洗碗一周', desc: '', minPts: 30 }], decorOwned: [], surprises: [],
    gameSaves: pots.length ? { home: { data: { pots, picked: 0, album: {}, log: [], lv: 1 }, rev: 1 } } : {},
  };
}

async function phone(browser, { when = DAY, data = seed(), w = 390, h = 844, dark = false, reduced = false, look = LOOK } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await p.clock.setFixedTime(new Date(when));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, look]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d));
    localStorage.setItem('decor_seen', JSON.stringify(['x']));
    localStorage.setItem('hm_welcomed', '1');
    if (look) localStorage.setItem('look', look);
    sessionStorage.setItem('seeded', '1');
  }, [data, look]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => App._setChar('char1'));
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode());
  await p.waitForFunction(() => document.querySelectorAll('#today-card .td-row, #today-card .td-done').length > 0, null, { timeout: 8000 });
  await sleep(600);
  return { p, ctx, errs };
}
const tab = (p) => p.evaluate(() => App._tabTest());
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
const entriesOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')).entries['2026-11'] || []);
// a real finger: the point must land on the element itself, not on something covering it
async function tap(p, sel) {
  const el = await p.waitForSelector(sel, { state: 'visible', timeout: 5000 });
  await el.scrollIntoViewIfNeeded();
  const hitAt = async () => { const b = await el.boundingBox(); return { b, hit: await el.evaluate((node, [x, y]) => { const t = document.elementFromPoint(x, y); return !!t && (node === t || node.contains(t)); }, [b.x + b.width / 2, b.y + b.height / 2]) }; };
  let { b, hit } = await hitAt();
  // inside the screen but under the bar: a finger would scroll it up first
  if (!hit) { await el.evaluate(n => n.scrollIntoView({ block: 'center' })); await sleep(250); ({ b, hit } = await hitAt()); }
  if (!hit) throw new Error('covered: ' + sel);
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const closeAll = (p) => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); document.querySelector('.u3d-sheet-veil')?.click(); });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  console.log(`(look: ${LOOK || 'default (新外观)'})`);

  if (want(1)) {
    console.log('\n1. The bar: 首页 · 积分 · ＋ · 一起 · 商店, the same on every page');
    const { p, ctx, errs } = await phone(browser);
    const bar = await p.evaluate(() => [...document.querySelectorAll('.bottom-nav > :not(.u3d-nav-ind)')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none'; })
      .map(e => e.classList.contains('u3d-add') || e.id === 'nav-add' ? '＋' : (e.querySelector('.nav-label') || {}).textContent));
    ok(JSON.stringify(bar) === JSON.stringify(['首页', '积分', '＋', '一起', '商店']), `five buttons in this order: ${bar.join(' · ')}`);
    ok(!(await p.$('#nav-settings')) && !(await p.$('#nav-tables')) && !(await p.$('#nav-history')), '设置 / 积分表 / 历史 are not tabs any more (⚙️ and the panes of 积分 are)');
    ok((await tab(p)).tab === 'home' && await p.evaluate(() => document.getElementById('nav-home').getAttribute('aria-current') === 'page'), 'opens on 首页, and the bar says so');
    for (const [id, t] of [['#nav-points', 'points'], ['#nav-together', 'together'], ['#nav-home', 'home']]) {
      await tap(p, id); await sleep(450);
      const s = await p.evaluate((t) => ({ shown: [...document.querySelectorAll('#app > .app-tab')].filter(x => !x.hidden).map(x => x.dataset.tab), cur: document.querySelector('.bottom-nav [aria-current="page"]')?.id }), t);
      ok(s.shown.length === 1 && s.shown[0] === t && s.cur === id.slice(1), `${id} shows only ${t} and marks itself (${JSON.stringify(s)})`);
    }
    if (await p.$('.u3d-nav-ind')) {
      await tap(p, '#nav-together'); await sleep(700);
      const d = await p.evaluate(() => { const i = document.querySelector('.u3d-nav-ind').getBoundingClientRect(), t = document.getElementById('nav-together').getBoundingClientRect(); return Math.abs((i.left + i.width / 2) - (t.left + t.width / 2)); });
      ok(d < 3, `the lit pill slides under 一起 (${d.toFixed(1)}px off)`);
    }
    // ⚙️ on every page
    for (const t of ['home', 'points', 'together']) {
      await p.evaluate((t) => App.nav(t), t); await sleep(350);
      const gear = await p.evaluate((t) => { const b = document.querySelector(`#tab-${t} .settings-btn`); if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, top: r.top }; }, t);
      ok(gear && gear.w >= 36 && gear.top < 120, `⚙️ is at the top of ${t} (${JSON.stringify(gear)})`);
    }
    await p.evaluate(() => App.nav('points')); await sleep(300);
    await tap(p, '#tab-points .settings-btn'); await sleep(450);
    ok(await p.evaluate(() => document.getElementById('modal-settings').classList.contains('open')), '…and opens 设置');
    await closeAll(p);
    // where you were is kept per page; tapping the page you are on goes to its top
    await p.evaluate(() => App.nav('points')); await sleep(300);
    await p.evaluate(() => window.scrollTo(0, 700)); await sleep(200);
    await p.evaluate(() => App.nav('together')); await sleep(300);
    ok(await p.evaluate(() => window.scrollY) < 5, '一起 opens at its top');
    await p.evaluate(() => App.nav('points')); await sleep(350);
    const back = await p.evaluate(() => window.scrollY);
    ok(Math.abs(back - 700) < 30, `back on 积分 where you left it (${back})`);
    await tap(p, '#nav-points'); await sleep(900);
    ok(await p.evaluate(() => window.scrollY) < 5, 'tapping 积分 again goes to its top');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (want(2)) {
    console.log('\n2. 首页: today, this month, and the four you use most — nothing else');
    const { p, ctx, errs } = await phone(browser);
    const h = await p.evaluate(() => ({
      header: !!document.querySelector('#tab-home .duo-card .characters-row #char-pochacco') && !!document.querySelector('#tab-home .duo-card .characters-row #char-adai'), hero: !!document.querySelector('#tab-home .duo-card #together-days'),
      today: !!document.querySelector('#tab-home #today-card'), month: !!document.querySelector('#tab-home #month-mini'), quick: document.querySelectorAll('#tab-home #quick-top .cat-card').length,
      score: !!document.querySelector('#tab-home .score-card'), list: !!document.querySelector('#tab-home #entries-list'), grid: !!document.querySelector('#tab-home #categories-grid'),
      height: document.documentElement.scrollHeight, vh: innerHeight,
    }));
    ok(h.header && h.hero && h.today && h.month && h.quick === 4, `one card for the two of you and the days, then 今天, 本月 and four score tiles (${h.quick})`);
    // the first screen already answers 「what is there to do today」
    const first = await p.evaluate(() => { const r = document.getElementById('today-card').getBoundingClientRect(), nav = document.querySelector('.bottom-nav').getBoundingClientRect(); return { top: Math.round(r.top), navTop: Math.round(nav.top) }; });
    ok(first.top < first.navTop - 120, `今天 starts on the first screen (at ${first.top}px, the bar at ${first.navTop}px)`);
    // the days open 我们的时光; a portrait picks whose points; the card's open part does neither
    await tap(p, '#together-banner .th-mid'); await sleep(700);
    ok(await p.evaluate(() => document.getElementById('love-page').classList.contains('open')), 'tapping the days opens 我们的时光');
    await p.evaluate(() => App.closeLovePage()); await sleep(500);
    const card = await p.evaluate(() => { const r = document.getElementById('together-banner').getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; });
    await p.mouse.click(card.x, card.y); await sleep(500);
    ok(await p.evaluate(() => !document.getElementById('love-page').classList.contains('open')), 'the card\'s open edge opens nothing (on a fireworks night it is sky)');
    ok(!h.score && !h.list && !h.grid, 'the score card, the full grid and 本月记录 live on 积分, not here');
    ok(h.height < h.vh * 2.4, `about two screens instead of five (${h.height}px for a ${h.vh}px screen)`);
    const names = await p.$$eval('#quick-top .cat-name', ns => ns.map(n => n.textContent));
    ok(names.includes('忘记约定') && names.includes('陪伴时光'), `the four used most this month: ${names.join(' · ')}`);
    // tapping a tile saves for the person shown, and the tiles do not move under the next tap
    const before = (await entriesOf(p)).length;
    await tap(p, '#quick-top .cat-card:has-text("陪伴时光")'); await sleep(700);
    const after = await entriesOf(p);
    ok(after.length === before + 1 && after.some(e => e.catName === '陪伴时光' && e.charId === 'char1' && e.date === '2026-11-25'), 'a tile saves an entry for 给 CS, dated today');
    const names2 = await p.$$eval('#quick-top .cat-name', ns => ns.map(n => n.textContent));
    ok(JSON.stringify(names2) === JSON.stringify(names), 'the tiles stay where they were');
    ok(/给 CS/.test(await p.textContent('#quick-for')), 'says whose points the tiles add to: 给 CS');
    // the portraits switch whose points, here too
    await tap(p, '#char-adai'); await sleep(400);
    ok(/给 YY/.test(await p.textContent('#quick-for')) && /YY/.test(await p.textContent('#month-mini .mm-who')), 'tapping YY\'s portrait: the tiles and 本月 follow');
    await p.evaluate(() => App.selectChar('char1')); await sleep(200);
    // 本月
    const mm = await p.evaluate(() => ({ num: document.querySelector('#month-mini .mm-num').textContent, pct: document.querySelector('#month-mini .mm-pct').textContent, s: document.querySelector('#month-mini .mm-status').textContent,
      score: document.getElementById('score-number').textContent, scorePct: document.getElementById('progress-pct').textContent, ids: document.querySelectorAll('#status-gap').length }));
    ok(mm.num.replace('分', '') === mm.score && mm.pct === mm.scorePct, `本月 matches the score card: ${mm.num} · ${mm.pct}`);
    ok(/下一个奖励/.test(mm.s) && mm.ids === 1, `the same status line, without a second #status-gap: 「${mm.s}」`);
    await tap(p, '#month-mini'); await sleep(450);
    ok((await tab(p)).tab === 'points' && (await tab(p)).pane === 'month', 'tapping 本月 opens 积分 › 本月');
    await p.evaluate(() => App.nav('home')); await sleep(400);
    await tap(p, '#tab-home .home-sec-link >> text=查看积分'); await sleep(400);
    ok((await tab(p)).tab === 'points', '查看积分 › too');
    await p.evaluate(() => App.nav('home')); await sleep(400);
    await tap(p, '#tab-home .home-sec-link >> text=全部'); await sleep(700);
    const all = await p.evaluate(() => ({ sheet: !!document.querySelector('.u3d-sheet.on'), modal: document.getElementById('modal-add').classList.contains('open') }));
    ok(all.sheet || all.modal, `全部 › opens every score (${all.sheet ? 'the ＋ sheet' : 'the 自定义 form'})`);
    await closeAll(p); await sleep(400);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (want(3)) {
    console.log('\n3. 今天: only what is still to do, each with its own button');
    const { p, ctx, errs } = await phone(browser, { data: seed({ older: true, garden: true }) });
    await p.waitForFunction(() => !!document.getElementById('today-garden'), null, { timeout: 15000 }).catch(() => {});
    const rows = await p.$$eval('#today-card .td-row', rs => rs.map(r => r.id));
    ok(JSON.stringify(rows) === JSON.stringify(['checkin-banner', 'today-settle', 'today-garden', 'today-letter', 'today-games']), `签到, the open month, the garden, a sealed letter, a game: ${rows.join(', ')}`);
    ok(/还有 5 件/.test(await p.textContent('#today-note')), 'the heading counts them: 还有 5 件');
    ok(/CS 还没签 · YY 已签 ✓/.test(await p.textContent('#checkin-banner')), `签到 says where both of you are: 「${(await p.textContent('#checkin-banner .td-s')).trim()}」`);
    ok(/10 月还没结算/.test(await p.textContent('#today-settle')), 'an older month left open is a task');
    ok(/花开了 1 盆/.test(await p.textContent('#today-garden')) && /还有 1 盆要浇水/.test(await p.textContent('#today-garden')) && /去浇水/.test(await p.textContent('#today-garden .td-go')),
      `the garden, from home.js's own rule: 「${(await p.textContent('#today-garden .td-s')).trim()}」`);
    ok(/YY 给你写了信/.test(await p.textContent('#today-letter')) && /1 封还没拆/.test(await p.textContent('#today-letter')), 'the letter YY wrote');
    // every button is a real target
    const sizes = await p.$$eval('#today-card .td-go', bs => bs.map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    ok(sizes.every(s => s >= 40), `buttons ≥ 40px (${sizes.map(Math.round).join(', ')})`);
    // 签到 in one tap; the row folds into a ✓
    const before = (await entriesOf(p)).length;
    await tap(p, '#checkin-banner-badge'); await sleep(800);
    const after = await entriesOf(p);
    ok(after.length === before + 1 && after.some(e => e.catName === '📅 每日签到' && e.charId === 'char1' && e.date === '2026-11-25'), '签到 +2 checks CS in straight away');
    ok(!(await p.$('#checkin-banner')) && /CS 已签到/.test(await p.textContent('#today-card .td-done')), 'the row becomes 「✓ CS 已签到」');
    ok(/还有 4 件/.test(await p.textContent('#today-note')), '还有 4 件');
    await tap(p, '#today-card .td-chip >> text=CS 已签到'); await sleep(500);
    ok(await p.evaluate(() => document.getElementById('modal-checkin').classList.contains('open')), 'the ✓ opens the calendar');
    await closeAll(p); await sleep(300);
    // the other buttons go where they say
    await tap(p, '#today-letter .td-go'); await sleep(700);
    ok(await p.evaluate(() => document.getElementById('letter-page').classList.contains('open')), '拆开 opens 情书');
    await p.evaluate(() => App.closeLetters()); await sleep(500);
    await tap(p, '#today-settle .td-go'); await sleep(600);
    ok(await p.evaluate(() => document.getElementById('modal-settle').classList.contains('open')), '去结算 opens 月末结算');
    await closeAll(p); await sleep(300);
    await tap(p, '#today-games .td-go'); await sleep(700);
    ok(await p.evaluate(() => !!document.querySelector('.mg-root')), '去玩 opens 小游戏');
    await p.evaluate(() => App.closeGames()); await sleep(400);
    await tap(p, '#today-garden .td-go');
    await p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 15000 });
    ok(true, '去浇水 opens 我们的家');
    await p.evaluate(() => App.closeHome()); await sleep(600);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();

    // nothing left: it says so, and the chips take you back
    const d = await phone(browser, { data: seed({ letters: false, checked: true, played: true }) });
    const t = await d.p.evaluate(() => ({ rows: document.querySelectorAll('#today-card .td-row').length, note: document.getElementById('today-note').textContent, all: document.querySelector('#today-card .td-all')?.textContent || '', chips: [...document.querySelectorAll('#today-card .td-chip')].map(c => c.textContent) }));
    ok(t.rows === 0 && /都做完了/.test(t.note) && /明天见/.test(t.all), `everything done: 「${t.note}」 「${t.all}」`);
    ok(t.chips.includes('CS 已签到') && t.chips.some(c => /小游戏 \+2/.test(c)), `what was done today stays as chips: ${t.chips.join(' · ')}`);
    ok(!d.errs.length, 'no errors ' + d.errs.join(' | '));
    await d.ctx.close();

    // the partner's phone reads its own rows: YY has checked in, CS wrote no letter to YY
    const y = await phone(browser, { data: seed() });
    await y.p.evaluate(() => App.selectChar('char2')); await sleep(300);
    const yt = await y.p.evaluate(() => ({ rows: [...document.querySelectorAll('#today-card .td-row')].map(r => r.id), chips: [...document.querySelectorAll('#today-card .td-chip')].map(c => c.textContent) }));
    ok(!yt.rows.includes('checkin-banner') && yt.chips.includes('YY 已签到'), `switched to YY: 签到 follows the switch, like the calendar (${JSON.stringify(yt)})`);
    await y.ctx.close();
  }

  if (want(4)) {
    console.log('\n4. 积分: whose points, 本月 · 历史 · 奖惩表');
    const { p, ctx, errs } = await phone(browser, { data: seed({ older: true }) });
    await p.evaluate(() => App.nav('points')); await sleep(500);
    const seg = await p.$$eval('.pt-seg [role="tab"]', bs => bs.map(b => [b.textContent, b.getAttribute('aria-selected')]));
    ok(JSON.stringify(seg) === JSON.stringify([['本月', 'true'], ['历史', 'false'], ['奖惩表', 'false']]), `three panes, 本月 first: ${JSON.stringify(seg)}`);
    const m = await p.evaluate(() => ({ who: [...document.querySelectorAll('#who-switch .who-btn')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), card: !!document.querySelector('#pt-month .score-card'), grid: document.querySelectorAll('#pt-month #categories-grid .cat-card').length, list: !!document.querySelector('#pt-month #entries-list .entry-item') }));
    ok(m.who.length === 2 && /^CS/.test(m.who[0]) && /\*$/.test(m.who[0]) && !/\*$/.test(m.who[1]), `whose points: ${m.who.join(' | ')}`);
    ok(m.card && m.grid > 0 && m.list, `the score card, every score (${m.grid}) and 本月记录`);
    await tap(p, '#who-switch .who-btn.char2'); await sleep(350);
    const y = await p.evaluate(() => ({ active: App._bdayTest().me, on: document.querySelector('#who-switch .on')?.classList.contains('char2'), score: document.getElementById('score-number').textContent, badge: document.getElementById('char2-score-badge').textContent, chip: document.getElementById('active-for-chip').textContent }));
    ok(y.on && y.score === y.badge && y.chip === 'YY', `YY: the score card shows YY's ${y.score}, 记分 is for YY`);
    await tap(p, '#who-switch .who-btn.char1'); await sleep(300);
    if (await p.$('.u3d-settle-chip')) ok(await p.evaluate(() => document.querySelector('.u3d-settle-chip').classList.contains('due')), '月末结算 in the score card glows: October is still open');
    else ok(await visible(p, '.settle-fab'), '经典: the 月末结算 button floats on 积分');
    await tap(p, '#pt-tab-history'); await sleep(600);
    ok(await p.evaluate(() => !document.getElementById('pt-history').hidden && document.getElementById('pt-month').hidden && document.querySelectorAll('#history-content .history-item').length === 1), '历史: last month\'s result, in the page (not a sheet)');
    await tap(p, '#pt-tab-rules'); await sleep(600);
    const r = await p.evaluate(() => ({ title: document.getElementById('modal-tables-title').textContent, rows: document.querySelectorAll('#modal-tables-content .tier-row').length, note: document.getElementById('rules-note').textContent }));
    ok(/奖励表/.test(r.title) && r.rows === 2 && /CS/.test(r.note), `奖惩表: ${r.title}, ${r.rows} rewards, 「${r.note}」`);
    await p.evaluate(() => App.toggleMode()); await sleep(500);
    ok(/惩罚表/.test(await p.textContent('#modal-tables-title')), 'switching to 惩罚模式 redraws it as 惩罚表');
    await p.evaluate(() => App.toggleMode()); await sleep(400);
    await tap(p, '#tables-manage-btn'); await sleep(500);
    ok(await p.evaluate(() => document.getElementById('modal-manage').classList.contains('open')), '⚙️ 管理 opens the editor');
    await closeAll(p); await sleep(300);
    // the old ways in still land in the right place
    await p.evaluate(() => App.nav('home')); await sleep(300);
    await p.evaluate(() => App.nav('history')); await sleep(400);
    ok(JSON.stringify(await tab(p)) === JSON.stringify({ tab: 'points', pane: 'history' }), "App.nav('history') → 积分 › 历史");
    await p.evaluate(() => App.nav('home')); await sleep(300);
    await p.evaluate(() => App.showTables()); await sleep(400);
    ok(JSON.stringify(await tab(p)) === JSON.stringify({ tab: 'points', pane: 'rules' }), 'App.showTables() → 积分 › 奖惩表');
    await p.evaluate(() => App.nav('home')); await sleep(300);
    await p.evaluate(() => App.nav('points')); await sleep(300);
    ok((await tab(p)).pane === 'rules', '积分 opens on the pane you were on last');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (want(5)) {
    console.log('\n5. 一起: every place, each saying what is waiting there');
    const { p, ctx, errs } = await phone(browser, { data: seed({ garden: true }) });
    await p.evaluate(() => App.nav('together')); await sleep(900);
    const t = await p.evaluate(() => [...document.querySelectorAll('#tg-grid > *')].map(e => e.id || e.className));
    ok(JSON.stringify(t) === JSON.stringify(['hm-home', 'home-duo', 'mg-home', 'letter-banner', 'tg-love']), `我们的家, 小窝 + 目标, 小游戏, 情书, 我们的时光: ${t.join(', ')}`);
    await p.waitForFunction(() => /花开了/.test(document.getElementById('hm-home-sub').textContent), null, { timeout: 15000 }).catch(() => {});
    ok(/花开了 1 盆/.test(await p.textContent('#hm-home-sub')), `我们的家 says what waits in the garden: 「${await p.textContent('#hm-home-sub')}」`);
    ok(await p.evaluate(() => document.querySelector('#letter-banner .tg-badge')?.textContent === '1') && /1 封还没拆/.test(await p.textContent('#letter-count')), '情书 carries a badge for the sealed one');
    ok(/今天还能拿分/.test(await p.textContent('#mg-home-sub')), '小游戏: 今天还能拿分');
    ok(/呆呆/.test(await p.textContent('#pet-banner')) && /一起去旅行/.test(await p.textContent('#goal-card')), '小窝 and 共同目标 as before');
    const doors = [
      ['#hm-home', () => p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 15000 }).then(() => true).catch(() => false), () => p.evaluate(() => App.closeHome())],
      ['#pet-banner .pet-banner-box', () => p.evaluate(() => document.getElementById('pet-page').classList.contains('open')), () => p.evaluate(() => App.closePetHome())],
      ['#goal-card > *', () => p.evaluate(() => document.getElementById('modal-goal').classList.contains('open')), () => closeAll(p)],
      ['#mg-home', () => p.evaluate(() => !!document.querySelector('.mg-root')), () => p.evaluate(() => App.closeGames())],
      ['#letter-banner', () => p.evaluate(() => document.getElementById('letter-page').classList.contains('open')), () => p.evaluate(() => App.closeLetters())],
      ['#tg-love', () => p.evaluate(() => document.getElementById('love-page').classList.contains('open')), () => p.evaluate(() => App.closeLovePage())],
    ];
    for (const [sel, check, close] of doors) {
      await p.evaluate(() => App.nav('together')); await sleep(400);
      await tap(p, sel); await sleep(900);
      ok(await check(), `${sel} opens its place`);
      await close(); await sleep(700);
    }
    // reading the letter clears the badge (a cached count is told when it changes, §7.246)
    await p.evaluate(() => App.openLetterReader && App.openLetterReader('l1')); await sleep(800);
    await p.evaluate(() => { App.closeLetterReader && App.closeLetterReader(); App.closeLetters(); }); await sleep(600);
    await p.evaluate(() => App.nav('together')); await sleep(400);
    ok(!(await p.$('#letter-banner .tg-badge')), 'after reading it the badge is gone');
    await p.evaluate(() => App.nav('home')); await sleep(400);
    ok(!(await p.$('#today-letter')), '…and 今天 no longer lists it');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (want(6)) {
    console.log('\n6. 商店: the shop page, with the bar still there');
    const { p, ctx, errs } = await phone(browser);
    await p.evaluate(() => App.nav('points')); await sleep(300);
    await tap(p, '#nav-shop'); await sleep(800);
    const s = await p.evaluate(() => {
      const nav = document.querySelector('.bottom-nav').getBoundingClientRect(), x = nav.left + nav.width * .1, y = nav.top + nav.height / 2;
      return { open: document.getElementById('shop-page').classList.contains('open'), cur: document.querySelector('.bottom-nav [aria-current="page"]')?.id, top: !!document.elementFromPoint(x, y)?.closest('.bottom-nav'),
        pad: parseFloat(getComputedStyle(document.getElementById('shop-content-shop')).paddingBottom), navH: nav.height };
    });
    ok(s.open && s.cur === 'nav-shop', 'the shop opens and 商店 is lit');
    ok(s.top, 'the bar is on top of the shop page, not under it');
    ok(s.pad >= s.navH + 14, `the shop's list ends above the bar (${s.pad}px)`);
    await tap(p, '#nav-together'); await sleep(700);
    ok(await p.evaluate(() => !document.getElementById('shop-page').classList.contains('open')) && (await tab(p)).tab === 'together', '一起 from the shop: the shop closes');
    await tap(p, '#nav-shop'); await sleep(700);
    await tap(p, '.shop-back-btn'); await sleep(700);
    const b = await p.evaluate(() => ({ open: document.getElementById('shop-page').classList.contains('open'), cur: document.querySelector('.bottom-nav [aria-current="page"]')?.id, on: document.documentElement.classList.contains('shop-on') }));
    ok(!b.open && b.cur === 'nav-together' && !b.on, `‹ 返回 goes back to 一起, and the bar says so (${JSON.stringify(b)})`);
    // 积分 is long enough to scroll: the shop opening over it and closing again leaves it where it was
    await p.evaluate(() => App.nav('points')); await sleep(400);
    const y0 = await p.evaluate(() => { window.scrollTo(0, 500); return window.scrollY; }); await sleep(200);
    await tap(p, '#nav-shop'); await sleep(700);
    await tap(p, '.shop-back-btn'); await sleep(700);
    const y1 = await p.evaluate(() => window.scrollY);
    ok(y0 > 200 && Math.abs(y1 - y0) < 30, `the page under the shop is where it was when you come back (${y0} → ${y1})`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (want(7)) {
    console.log('\n7. ＋ from every page, in both looks');
    for (const look of ['ui3d', 'classic']) {
      const { p, ctx, errs } = await phone(browser, { look });
      for (const t of ['home', 'points', 'together', 'shop']) {
        await p.evaluate((t) => App.nav(t), t); await sleep(700);
        const plus = look === 'ui3d' ? '.u3d-add' : '#nav-add';
        await tap(p, plus); await sleep(700);
        const st = await p.evaluate(() => {
          const sheet = document.querySelector('.u3d-sheet.on'), modal = document.getElementById('modal-add');
          const el = sheet || (modal.classList.contains('open') ? modal.querySelector('.modal-sheet') : null);
          if (!el) return null;
          const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
          return { kind: sheet ? 'sheet' : 'form', onTop: !!(hit && el.contains(hit)) };
        });
        ok(st && st.onTop && st.kind === (look === 'ui3d' ? 'sheet' : 'form'), `${look} · ${t}: ＋ opens the ${look === 'ui3d' ? '记一笔 sheet' : '自定义记分 form'} on top (${JSON.stringify(st)})`);
        await closeAll(p); await sleep(500);
      }
      ok(!errs.length, `${look}: no errors ` + errs.join(' | '));
      await ctx.close();
    }
  }

  if (want(8)) {
    console.log('\n8. Every screen: nothing wider than the phone, nothing hidden under the bar, both themes');
    const sizes = [[320, 568], [360, 740], [390, 844], [430, 932], [820, 1180], [1280, 800]];
    for (const [w, h] of sizes) for (const dark of [false, true]) {
      const { p, ctx, errs } = await phone(browser, { w, h, when: dark ? NIGHT : DAY, data: seed({ older: true, garden: true }) });
      const bad = [];
      for (const t of ['home', 'points', 'together']) {
        await p.evaluate((t) => App.nav(t), t); await sleep(500);
        const m = await p.evaluate(async () => {
          const doc = document.documentElement, out = [];
          if (doc.scrollWidth > innerWidth + 1) out.push('page wider than the screen: ' + doc.scrollWidth);
          window.scrollTo(0, doc.scrollHeight); await new Promise(r => setTimeout(r, 250));
          const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
          const tab = document.querySelector('#app > .app-tab:not([hidden])');
          const last = [...tab.querySelectorAll('.today-card, .month-mini, #quick-top .cat-card, .entry-item, .tg-tile, .home-duo, .history-item, .tier-row')].filter(e => e.getBoundingClientRect().height).pop();
          if (last && last.getBoundingClientRect().bottom > nav.top + 1) out.push('the last card ends under the bar');
          for (const e of tab.querySelectorAll('button, [role="button"], .cat-card')) {
            const r = e.getBoundingClientRect();
            if (!r.width) continue;
            if (r.left < -1 || r.right > innerWidth + 1) out.push('off the side: ' + (e.id || e.className).slice(0, 40));
          }
          // text that does not fit its tile
          for (const e of tab.querySelectorAll('.td-t, .td-s, .tg-name, .tg-sub, .mm-status, .who-btn b')) if (e.scrollWidth > e.clientWidth + 2) out.push('clipped: ' + e.textContent.slice(0, 20));
          window.scrollTo(0, 0);
          return out;
        });
        bad.push(...m.map(x => `${t}: ${x}`));
      }
      ok(!bad.length, `${w}×${h} ${dark ? 'night' : 'day'}: fits ${bad.slice(0, 4).join(' | ')}`);
      if (w === 390 || w === 320) for (const t of ['home', 'points', 'together']) {
        await p.evaluate((t) => App.nav(t), t); await sleep(500);
        await p.screenshot({ path: `${SHOTS}/nav_${t}_${w}_${dark ? 'night' : 'day'}${LOOK ? '_' + LOOK : ''}.png` });
      }
      ok(!errs.length, 'no errors ' + errs.join(' | '));
      await ctx.close();
    }
  }

  if (want(9)) {
    console.log('\n9. Reduced motion, keyboard, and the page and the script agreeing');
    const { p, ctx, errs } = await phone(browser, { reduced: true });
    await p.evaluate(() => App.nav('points')); await sleep(200);
    ok(await p.evaluate(() => getComputedStyle(document.getElementById('tab-points')).animationName) === 'none', 'reduced motion: pages switch without sliding');
    await p.evaluate(() => App.nav('home')); await sleep(200);
    await p.focus('#nav-together'); await p.keyboard.press('Enter'); await sleep(400);
    ok((await tab(p)).tab === 'together', 'the bar works from a keyboard (Enter on 一起)');
    await p.focus('#tg-love'); await p.keyboard.press('Enter'); await sleep(700);
    ok(await p.evaluate(() => document.getElementById('love-page').classList.contains('open')), 'so do the tiles (Enter on 我们的时光)');
    await p.evaluate(() => App.closeLovePage()); await sleep(500);
    const v = await p.evaluate(() => ({ meta: document.querySelector('meta[name="app-html-v"]').content }));
    const js = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8').match(/const HTML_V = '([^']+)'/)[1];
    ok(v.meta === js, `index.html and app.js agree on the page version (${v.meta} = ${js}, §7.27)`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
