// 生日惊喜 in a browser (CLAUDE.md §7.30), on a faked clock, both phones.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:8766/index.html)
//   node tools/birthday-test.js
//
// Demo mode runs the surprise function's own rules on the phone clock (the
// _bdayDemo twin in app.js), so the real UI is exercised end to end. The one
// thing demo can't show — that a MOVED phone date can't start the film,
// because the server decides — runs against a mocked server in section 7.
// supabase/test-surprise.mjs attacks the real function.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const px = (c) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='${encodeURIComponent(c)}'/></svg>`;
const COLORS = ['#F7C6D2', '#C9DDF5', '#FFE0B2', '#D8EFD9', '#E5D8F5', '#F5B971', '#B5E3F0', '#F2B8C6'];

// YY (char2) turns a year older on 11-09; CS (char1) was born 1998-07-20.
function seed({ b1 = '1998-07-20', b2 = '11-09', surprises = [], photos = 8, pet = true } = {}) {
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: {}, history: [], archive: [], letters: [],
    photos: COLORS.slice(0, photos).map((c, i) => ({ id: 'p' + i, charId: 'char1', image: px(c), caption: '', date: `2026-0${(i % 9) + 1}-10` })),
    goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: pet ? '呆呆' : '', petSpecies: pet ? 'dog' : '', petExp: 2600, petBase: 0, petEquipped: '',
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    birthday1: b1, birthday2: b2, categories: [], rewards: [], punishments: [], decorOwned: [], surprises,
  };
}
const SEALED = (o = {}) => ({ from: 'char1', openOn: '2026-11-09', tz: 480, letter: 'YY：\n生日快乐呀。\n谢谢你这一年一直在我身边。',
  couponTitle: '带你去看一次海', couponNote: '有效期：一辈子', couponIcon: '🌊', photoIds: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'], teaser: false, openedAt: null, ...o });

async function phone(browser, when, { char = 'char1', data = seed(), w = 390, h = 844, reduced = false, install = false, extraLS = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2,
    reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  if (install) await p.clock.install({ time: new Date(when) }); else await p.clock.setFixedTime(new Date(when));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, ls]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d));
    localStorage.setItem('decor_seen', '[]');
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, [data, extraLS]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(c => App._setChar(c), char);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode());
  if (install) await p.clock.runFor(1500); else await sleep(1200);
  return { p, ctx, errs };
}
const film = (p) => p.evaluate(() => App._bdfState());
const cardText = (p) => p.evaluate(() => { const c = document.getElementById('bday-card'); return !c || c.classList.contains('hidden') ? '' : c.textContent.replace(/\s+/g, ' ').trim(); });
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')).surprises || []);
// what the current film scene measures at this width
const measure = (p) => p.evaluate(() => {
  const root = document.getElementById('bdf-root'), sc = root && root.querySelector('.bdf-sc.bdf-on');
  if (!sc) return null;
  const W = innerWidth, H = innerHeight;
  let over = 0, minBtn = 999, minFont = 99;
  sc.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || el.closest('.bdf-walk') || el.closest('.bdf-tile')) return;
    if (r.right > W + .5 || r.left < -.5) over++;
    if (el.matches('button')) minBtn = Math.min(minBtn, r.height);
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
  });
  const x = root.querySelector('.bdf-x').getBoundingClientRect();
  const pb = sc.querySelector('.bdf-p');
  return { scene: sc.dataset.s, over, minBtn: Math.min(minBtn, x.height), minFont, thumb: pb ? pb.getBoundingClientRect().top / H : 1 };
});
// play every scene; `each` is called on each one once its content is showing
async function walk(p, each) {
  for (let guard = 0; guard < 12; guard++) {
    const st = await film(p);
    if (!st) return;
    const s = st.scene;
    if (s === 'letter') { await p.click('.bdf-sc.bdf-on [data-env]', { force: true }); await sleep(1300); }
    if (s === 'gift') { for (let i = 0; i < 3; i++) { await p.click('.bdf-sc.bdf-on [data-gift]', { force: true }); await sleep(250); } await sleep(1000); }
    if (s === 'photos' || s === 'dark') await sleep(2200);
    if (each) await each(s);
    if (s === 'end') return;
    if (s === 'blow') { await p.click('.bdf-sc.bdf-on [data-blow]'); await sleep(3000); continue; }
    await p.click('.bdf-sc.bdf-on .bdf-p'); await sleep(700);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. 日期：谁的生日、什么时候准备');
  {
    const { p, ctx } = await phone(browser, '2026-10-26T12:00:00+08:00');
    const t = (d, c) => p.evaluate(([d, c]) => { App._setChar(c); return App._bdayTest(new Date(d)); }, [d, c]);
    ok((await t('2026-10-25T12:00:00+08:00', 'char1')).soon === null, 'YY 生日前 15 天：CS 还没有准备卡片');
    let r = await t('2026-10-26T12:00:00+08:00', 'char1');
    ok(r.soon && r.soon.inDays === 14 && r.soon.openOn === '2026-11-09', `前 14 天：开始准备（还有 ${r.soon && r.soon.inDays} 天，开 ${r.soon && r.soon.openOn}）`);
    ok((await t('2026-11-08T23:59:00+08:00', 'char1')).soon?.inDays === 1, '前一天：还能准备');
    r = await t('2026-11-09T00:00:30+08:00', 'char1');
    ok(r.soon === null && r.today.length === 1 && r.today[0].char === 'char2' && !r.today[0].mine, '当天在 CS 的手机上：是 YY 的生日，不再准备');
    r = await t('2026-11-09T00:00:30+08:00', 'char2');
    ok(r.today[0]?.mine && r.today[0].age === 0, 'YY 的手机：是自己的生日（没填年份 → 不写岁数）');
    ok((await t('2026-11-08T21:00:00+08:00', 'char2')).tomorrow === '2026-11-09', 'YY 的手机前一晚：知道明天是生日（预告用）');
    ok((await t('2026-11-10T00:00:30+08:00', 'char2')).today.length === 0, '第二天：结束');
    r = await t('2026-07-20T09:00:00+08:00', 'char1');
    ok(r.today[0]?.mine && r.today[0].age === 28, `CS 填了 1998 → 2026-07-20 是第 ${r.today[0] && r.today[0].age} 个生日`);
    const th = await p.evaluate(() => { App._setChar('char1'); const a = App._themeTest(new Date('2026-11-09T12:00:00+08:00'));
      App._setChar('char2'); const b = App._themeTest(new Date('2026-11-09T12:00:00+08:00')); const c = App._themeTest(new Date('2026-11-08T12:00:00+08:00'));
      return [a && a.id + '/' + a.name, b && b.id + '/' + b.name, c && c.id]; });
    ok(th[0] === 'bday/YY生日' && th[1] === 'bday/生日' && th[2] !== 'bday', `主题：CS 手机「${th[0]}」，YY 手机「${th[1]}」，前一天不是`);
    await ctx.close();
  }
  {
    // a 2/29 birthday, and one on the anniversary
    const { p, ctx } = await phone(browser, '2026-10-26T12:00:00+08:00', { char: 'char2', data: seed({ b2: '2004-02-29' }) });
    const t = (d) => p.evaluate((d) => App._bdayTest(new Date(d)).today.map(x => x.char + '@' + x.age).join(), d);
    ok(await t('2026-02-28T12:00:00+08:00') === 'char2@22' && await t('2026-03-01T12:00:00+08:00') === '' && await t('2028-02-29T12:00:00+08:00') === 'char2@24',
      '2/29 生日：平年 2/28 过，闰年 2/29 过');
    await ctx.close();
  }

  console.log('\n2. CS 在 YY 生日前 10 天准备');
  {
    const { p, ctx, errs } = await phone(browser, '2026-10-30T20:00:00+08:00', { char: 'char1' });
    let c = await cardText(p);
    ok(/YY 的生日还有 10 天/.test(c) && /只有你看得到/.test(c), `CS 首页卡片：「${c}」`);
    await p.click('#bday-card'); await sleep(900);
    await p.screenshot({ path: `${SHOTS}/bday_01_prep.png` });
    ok(await p.$('#bdf-veil') !== null, '点卡片打开准备清单');
    await p.click('[data-view="letter"]'); await sleep(300);
    await p.fill('[data-letter]', 'YY：\n生日快乐呀。'); await sleep(800);
    ok(/草稿已保存/.test(await p.textContent('[data-saved]')), '写信时自动存草稿');
    await p.click('[data-done]'); await sleep(500);
    await p.click('[data-view="coupon"]'); await sleep(300);
    await p.click('[data-icon="🍲"]');
    await p.fill('[data-ctitle]', '请你吃那家火锅'); await p.fill('[data-cnote]', '想吃几次都行');
    await p.click('[data-done]'); await sleep(500);
    await p.click('[data-view="photos"]'); await sleep(300);
    for (const id of ['p2', 'p0', 'p1', 'p3']) await p.click(`[data-pid="${id}"]`);
    ok(await p.textContent('.bdf-ph[data-pid="p2"] span') === '1', '照片按点的顺序编号');
    await p.click('[data-done]'); await sleep(500);
    await p.click('[data-teaser]'); await sleep(300);
    await p.click('[data-seal]'); await sleep(900);
    const s = await stored(p);
    ok(s.length === 1 && s[0].from === 'char1' && s[0].openOn === '2026-11-09' && s[0].couponIcon === '🍲' && s[0].photoIds.join() === 'p2,p0,p1,p3' && s[0].teaser,
      `封好：给 2026-11-09，信、火锅券、4 张照片（按顺序）、开了预告`);
    ok(/封好了/.test(await p.textContent('.toast').catch(() => '')), '提示「封好了」');
    c = await cardText(p);
    ok(/已经封好 ✓/.test(c), `卡片变成「${c}」`);
    // edit after sealing
    await p.click('#bday-card'); await sleep(800);
    await p.click('[data-view="letter"]'); await sleep(300);
    await p.fill('[data-letter]', 'YY：\n生日快乐呀，改一改。'); await p.click('[data-done]'); await sleep(600);
    ok((await stored(p))[0].letter.includes('改一改'), '封好以后还能改');
    // preview: the film with the draft, on CS's phone only
    await p.click('[data-preview]'); await sleep(800);
    const st = await film(p);
    ok(st && !st.real && st.order.join() === 'dark,wish,blow,name,letter,gift,photos,end', `预览：${st && st.order.join(' → ')}（不算 YY 拆开）`);
    await p.evaluate(() => App.closeBirthdayFilm()); await sleep(600);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // YY's phone on the same day sees nothing
    const { p, ctx } = await phone(browser, '2026-10-30T20:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }) });
    ok(await cardText(p) === '' && await p.$('#bdf-tab') === null && await p.$('#bdf-root') === null, 'YY 同一天：没有卡片、没有小蛋糕、没有任何提示');
    const g = await p.evaluate(() => Promise.resolve(App._bdayReset()).then(() => null));
    await ctx.close();
  }
  {
    // 3 days before and still nothing sealed: the card glows
    const { p, ctx } = await phone(browser, '2026-11-06T20:00:00+08:00', { char: 'char1' });
    ok(await p.evaluate(() => document.getElementById('bday-card').classList.contains('bdf-glowcard')), '前 3 天还没封好：卡片发光提醒');
    await ctx.close();
  }

  console.log('\n3. 生日前一晚（YY 的手机）');
  {
    const { p, ctx } = await phone(browser, '2026-11-08T21:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }) });
    ok(await cardText(p) === '' && await p.$('#bdf-root') === null, '没开预告：前一晚什么都没有');
    await ctx.close();
  }
  {
    const { p, ctx } = await phone(browser, '2026-11-08T23:30:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED({ teaser: true })] }) });
    const c = await cardText(p);
    ok(/还有 30 分钟就能拆开/.test(c), `开了预告，最后一小时倒数：「${c}」`);
    ok(await p.$('#bdf-root') === null, '盒子看得到，里面看不到（电影没开）');
    await ctx.close();
  }

  console.log('\n4. 00:00，YY 的 app 正开着');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-08T23:59:30+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }), install: true });
    ok(await p.$('#bdf-root') === null, '23:59:30：还没有');
    await p.clock.runFor(33000); await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    let st = await film(p);
    ok(st && st.real && st.scene === 'dark', `00:00 准时自己跳出来（${st && st.scene}）`);
    ok(st && st.order.join() === 'dark,wish,blow,name,letter,gift,photos,end', '八幕都在：' + (st && st.order.join(' → ')));
    await ctx.close();
  }
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-09T00:30:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }) });
    await sleep(600);
    let st = await film(p);
    ok(st && st.real, '当天第一次打开：自己出来');
    const line = await p.textContent('.bdf-sc.bdf-on .bdf-line');
    ok(line === '有人偷偷给你准备了一点东西', `第一句：「${line}」`);
    await walk(p, async (s) => { if (['name', 'letter', 'gift', 'photos', 'end'].includes(s)) await p.screenshot({ path: `${SHOTS}/bday_02_${s}.png` }); });
    st = await film(p);
    ok(st && st.scene === 'end' && st.opened, '看到最后；拆开记下了');
    const s = await stored(p);
    ok(s[0].openedAt && Date.parse(s[0].openedAt) >= Date.parse('2026-11-08T16:00:00Z'), `拆开时间 ${s[0].openedAt}`);
    await p.click('.bdf-sc.bdf-on .bdf-g'); await sleep(1300);
    const tab = await p.evaluate(() => { const t = document.getElementById('bdf-tab'); return t && t.getBoundingClientRect().toJSON(); });
    ok(tab && tab.right === 390 && tab.width === 46, `收到旁边：右边贴边一个小蛋糕（${tab && Math.round(tab.top)}px）`);
    ok(/想再看就点我/.test(await p.textContent('#bdf-tip').catch(() => '')), '第一次收起时提示「想再看就点我」');
    const c = await cardText(p);
    ok(/你有一张生日券：带你去看一次海/.test(c), `首页：「${c}」`);
    ok(await p.evaluate(() => /今天是你的生日/.test(document.getElementById('together-next').textContent)), '「在一起」卡片：🎂 今天是你的生日 · 看惊喜');
    ok(await p.evaluate(() => !!document.querySelector('#char-img-wrap-2 .bdf-crown') && !document.querySelector('#char-img-wrap-1 .bdf-crown')), '首页 YY 的头像戴小皇冠，CS 的没有');
    await p.screenshot({ path: `${SHOTS}/bday_03_home_after.png` });
    // replay from the tab: same film, no second opening
    const before = (await stored(p))[0].openedAt;
    await p.click('#bdf-tab'); await sleep(900);
    st = await film(p);
    ok(st && st.real && st.scene === 'dark', '点小蛋糕：从头再看一次');
    await p.evaluate(() => App.closeBirthdayFilm()); await sleep(800);
    ok((await stored(p))[0].openedAt === before, '重看不会再记一次拆开');
    // reopening the app the same day: no auto-play, the tab is there
    await p.reload(); await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
    await p.evaluate(() => { App._setChar('char2'); document.getElementById('start-page')?.remove(); return App.demoMode(); }); await sleep(1200);
    ok(await p.$('#bdf-root') === null && await p.$('#bdf-tab') !== null, '当天再打开 app：不自动再放，小蛋糕还在');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // CS's phone on the day: the receipt
    const { p, ctx } = await phone(browser, '2026-11-09T10:30:00+08:00', { char: 'char1', data: seed({ surprises: [SEALED({ openedAt: '2026-11-09T02:24:00.000Z' })] }) });
    const c = await cardText(p);
    ok(/YY 拆开了你准备的惊喜 ✓/.test(c) && /10:24/.test(c), `CS 的回执：「${c}」`);
    ok(await p.$('#bdf-root') === null && await p.$('#bdf-tab') === null, 'CS 的手机不弹电影、没有小蛋糕');
    await p.click('#bday-card'); await sleep(900);
    ok((await film(p))?.real === false, '点回执：看 YY 看到的（只是预览）');
    await ctx.close();
  }

  console.log('\n5. 什么都没准备的生日');
  {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2' });
    const st = await film(p);
    ok(st && st.order.join() === 'dark,wish,blow,name,end', `只有 app 自己的五幕：${st && st.order.join(' → ')}`);
    const line = await p.textContent('.bdf-sc.bdf-on .bdf-line');
    ok(line === '呆呆给你端来了蛋糕', `第一句不提「有人准备」：「${line}」`);
    const html = await p.evaluate(() => document.getElementById('bdf-root').textContent);
    ok(!/没写|没准备|没有准备/.test(html), '整部都不出现「没写 / 没准备」');
    await ctx.close();
  }
  {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ pet: false }) });
    ok((await film(p))?.order.length === 5 && await p.$('.bdf-cakeonly') !== null, '还没养宠物：只有蛋糕，照样能播');
    await ctx.close();
  }

  console.log('\n6. 00:00 时 YY 正在打字');
  {
    const { p, ctx } = await phone(browser, '2026-11-08T23:59:30+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }), install: true });
    await p.evaluate(() => App.openAddModal ? App.openAddModal() : null); await p.clock.runFor(600);
    const open = await p.evaluate(() => !!document.querySelector('.modal-overlay.open'));
    await p.clock.runFor(33000); await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    ok(open && await p.$('#bdf-root') === null, '打开着记分窗口：00:00 不打断');
    ok(await p.evaluate(() => document.getElementById('bdf-tab')?.classList.contains('bdf-glowing')), '小蛋糕在边上发光等着');
    await p.evaluate(() => { const m = document.querySelector('.modal-overlay.open'); if (m) App.closeModal(m.id); });
    await p.clock.runFor(1500); await p.evaluate(() => new Promise(r => setTimeout(r, 0)));
    ok((await film(p))?.real, '关掉窗口：电影自己开始');
    await ctx.close();
  }

  console.log('\n7. 把手机日期改到生日（服务器说还没到）');
  {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ surprises: [] }) });
    await p.evaluate(() => App.closeBirthdayFilm()); await sleep(600);
    await p.evaluate(() => { localStorage.clear(); });
    let day = false;
    const asked = [];
    await p.route(/supabase\.co\/functions\/v1\//, async (route) => {
      const url = new URL(route.request().url()), fn = url.pathname.split('/').pop();
      const reply = (b) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
      if (fn === 'surprise') { asked.push(url.search); return reply({ openOn: '2026-11-09', day, teaser: false, moved: '', mine: null, theirs: null }); }
      return reply(/entries|letters|photos|history|bag/.test(fn) ? [] : {});
    });
    await p.evaluate(() => { localStorage.setItem('sn_char', 'char2'); App._fakeSessionTest(); App._setChar('char1'); App._bdayReset(); });
    await p.evaluate(() => App.maybeShowBirthday()); await sleep(800);
    ok(asked.length > 0 && await p.$('#bdf-root') === null, '手机日期是生日，但服务器说「还没到」：电影不播');
    ok(await p.evaluate(() => !Object.keys(localStorage).some(k => k.startsWith('bday_seen_'))), '「看过」没有被提前用掉');
    ok(await p.evaluate(() => App._bdayTest(new Date()).me) === 'char2', '主页角色开关切到 CS 也没关系：这台手机还是 YY（看登录）');
    await p.click('#bdf-tab'); await sleep(600);
    ok(/还没到哦/.test(await p.textContent('.toast').catch(() => '')), '点小蛋糕：「还没到哦，00:00 才开始」');
    day = true;
    await p.evaluate(() => App._bdayReset());
    await p.click('#bdf-tab'); await sleep(900);
    ok((await film(p))?.real, '服务器确认到了：开始播');
    await ctx.close();
  }

  console.log('\n8. 屏幕边的小蛋糕');
  for (const w of [360, 390, 430, 820]) {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED({ openedAt: '2026-11-09T00:10:00.000Z' })] }), w, h: w === 820 ? 1180 : 844,
      extraLS: { 'bday_seen_2026-11-09_char2': '1' } });
    await sleep(500);
    const clash = await p.evaluate(() => {
      const t = document.getElementById('bdf-tab').getBoundingClientRect();
      t.pointer = null;
      return [...document.querySelectorAll('button, a[href], input, [onclick], [role="button"], .bottom-nav')].filter(el => {
        if (el.id === 'bdf-tab') return false;
        const r = el.getBoundingClientRect();
        if (!r.width || (r.width >= innerWidth * .6 && !el.classList.contains('bottom-nav'))) return false;
        const c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!c || !(c === el || el.contains(c))) return false;
        return t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom;
      }).map(el => el.textContent.trim().slice(0, 8) || el.className);
    });
    ok(!clash.length, `${w}px：小蛋糕没压住任何按钮${clash.length ? '：' + clash.join('、') : ''}`);
    if (w === 390) {
      const t = await p.locator('#bdf-tab').boundingBox();
      await p.mouse.move(t.x + 20, t.y + 20); await p.mouse.down();
      await p.mouse.move(60, t.y + 140, { steps: 10 }); await p.mouse.up(); await sleep(600);
      const a = await p.evaluate(() => { const e = document.getElementById('bdf-tab'); return { left: e.getBoundingClientRect().left, cls: e.className }; });
      ok(a.left === 0 && /bdf-left/.test(a.cls), '拖到左边：松手贴左边');
      ok(await p.$('#bdf-root') === null, '拖动不会误触播放');
      await p.reload(); await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
      await p.evaluate(() => { App._setChar('char2'); document.getElementById('start-page')?.remove(); return App.demoMode(); }); await sleep(1000);
      ok(await p.evaluate(() => document.getElementById('bdf-tab').getBoundingClientRect().left) === 0, '再打开 app：还在左边（记在这台手机上）');
      await p.screenshot({ path: `${SHOTS}/bday_04_tab_left.png` });
    }
    await ctx.close();
  }

  console.log('\n9. 每一幕在每种屏幕上');
  for (const [w, h] of [[360, 780], [390, 844], [430, 932], [820, 1180]]) {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED({ letter: 'YY：\n' + '谢谢你这一年一直在我身边。'.repeat(30) })] }), w, h });
    await sleep(500);
    const bad = [];
    await walk(p, async () => {
      const m = await measure(p);
      if (!m) return;
      if (m.over) bad.push(`${m.scene} 溢出 ${m.over}`);
      if (m.minBtn < 44) bad.push(`${m.scene} 按钮 ${Math.round(m.minBtn)}px`);
      if (m.minFont < 12.5) bad.push(`${m.scene} 字 ${m.minFont}px`);
      if (m.thumb < .6) bad.push(`${m.scene} 主按钮在上方 ${Math.round(m.thumb * 100)}%`);
    });
    const letterFits = await p.evaluate(() => true);
    ok(!bad.length, `${w}×${h}：八幕都没溢出，按钮 ≥44px，字 ≥12.5px，主按钮在下方 40% 里${bad.length ? '：' + bad.join('；') : ''}`);
    await ctx.close();
  }
  {
    // the long letter scrolls inside the paper; the button stays on screen
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED({ letter: '谢谢你。'.repeat(200) })] }), w: 360, h: 640 });
    await sleep(500);
    await walk(p, async (s) => {
      if (s !== 'letter') return;
      const r = await p.evaluate(() => { const t = document.querySelector('.bdf-txt'), b = document.querySelector('.bdf-sc.bdf-on .bdf-p').getBoundingClientRect();
        return { scrolls: t.scrollHeight > t.clientHeight, btnIn: b.bottom <= innerHeight }; });
      ok(r.scrolls && r.btnIn, '800 字的信在 360×640 上：信纸里面滚动，「收好了」还在屏幕上');
      await p.screenshot({ path: `${SHOTS}/bday_05_long_letter_360.png` });
    });
    await ctx.close();
  }
  for (const w of [360, 390]) {
    const { p, ctx } = await phone(browser, '2026-10-30T20:00:00+08:00', { char: 'char1', w, h: w === 360 ? 640 : 844 });
    await p.evaluate(() => App.openBirthdayPrep()); await sleep(900);
    const views = {};
    for (const v of ['main', 'letter', 'coupon', 'photos']) {
      if (v !== 'main') { await p.click(`[data-view="${v}"]`); await sleep(300); }
      views[v] = await p.evaluate(() => {
        const sh = document.querySelector('.bdf-sheet'), W = innerWidth;
        let over = 0, small = 0;
        sh.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (!r.width) return; if (r.right > W + .5 || r.left < -.5) over++; if (el.matches('button') && r.height < 44) small++; });
        return { over, small, scrolls: sh.scrollHeight > sh.clientHeight + 2 || sh.getBoundingClientRect().height <= innerHeight };
      });
      if (v !== 'main') { await p.click('[data-back]'); await sleep(250); }
    }
    const bad = Object.entries(views).filter(([, x]) => x.over || x.small).map(([k, x]) => `${k}: 溢出 ${x.over} 小按钮 ${x.small}`);
    ok(!bad.length, `${w}px 准备清单的四页：没有溢出，按钮都 ≥44px${bad.length ? '：' + bad.join('；') : ''}`);
    await ctx.close();
  }

  console.log('\n10. 减少动态效果');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED()] }), reduced: true });
    let reached = '';
    await walk(p, async (s) => { reached = s; });
    ok(reached === 'end' && !errs.length, '系统开了减少动态效果：一样能从头看到尾，蜡烛照样灭');
    await ctx.close();
  }

  console.log('\n11. 设置里填生日');
  {
    const { p, ctx } = await phone(browser, '2026-10-26T12:00:00+08:00', { char: 'char1', data: seed({ b1: '', b2: '' }) });
    await p.evaluate(() => App.showSettings()); await sleep(400);
    ok(await p.textContent('#cfg-bday-label-1') === '🎂 CS 的生日' && await p.textContent('#cfg-bday-label-2') === '🎂 YY 的生日', '设置里写着两个人的名字');
    await p.selectOption('#cfg-bday-m-2', '2'); await p.selectOption('#cfg-bday-d-2', '30');
    await p.evaluate(() => App.saveConfig()); await sleep(500);
    ok(/不存在的日子/.test(await p.textContent('.toast').catch(() => '')) && (await p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')).birthday2)) === '', '选了 2 月 30 日：不保存，提示一下');
    await p.selectOption('#cfg-bday-m-2', '11'); await p.selectOption('#cfg-bday-d-2', '9');
    await p.selectOption('#cfg-bday-m-1', '7'); await p.selectOption('#cfg-bday-d-1', '20'); await p.selectOption('#cfg-bday-y-1', '1998');
    await p.evaluate(() => App.saveConfig()); await sleep(600);
    const d = await p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')));
    ok(d.birthday2 === '11-09' && d.birthday1 === '1998-07-20', `存成 YY「${d.birthday2}」（没填年份）、CS「${d.birthday1}」`);
    await p.evaluate(() => App.showSettings()); await sleep(300);
    ok(await p.inputValue('#cfg-bday-y-1') === '1998' && await p.inputValue('#cfg-bday-m-2') === '11', '再打开设置：选好的都在');
    await ctx.close();
  }

  console.log('\n12. 生日刚好是 12-24（周年那天）');
  {
    const { p, ctx } = await phone(browser, '2026-12-24T09:00:00+08:00', { char: 'char2', data: seed({ b2: '12-24', surprises: [SEALED({ openOn: '2026-12-24' })] }) });
    await sleep(800);
    ok(await p.$('#anv-root') !== null && await p.$('#bdf-root') === null, '先放周年小电影，生日的等着');
    ok(await p.evaluate(() => document.documentElement.dataset.festival) === 'bday', '那天 YY 的手机上是生日主题（生日 16 > 周年 15）');
    await p.evaluate(() => App.closeAnniversary()); await sleep(1500);
    ok((await film(p))?.real, '周年的关掉：生日的接着出来');
    await ctx.close();
  }

  console.log('\n13. 过了生日，在「我们的时光」里重看');
  {
    const { p, ctx } = await phone(browser, '2026-11-20T20:00:00+08:00', { char: 'char2', data: seed({ surprises: [SEALED({ openedAt: '2026-11-09T00:10:00.000Z' })] }) });
    ok(await p.$('#bdf-tab') === null, '第二天起：屏幕边的小蛋糕没了');
    await p.evaluate(() => App.showLovePage()); await sleep(900);
    ok(/收到过的生日惊喜/.test(await p.textContent('#bdf-mem').catch(() => '')), '「我们的时光」里有「收到过的生日惊喜 · 2026 年 ▶」');
    await p.click('#bdf-mem [data-open]'); await sleep(900);
    const st = await film(p);
    ok(st && !st.real && st.order.includes('letter'), '点一下：重看那一年的（不再算拆开）');
    await ctx.close();
  }

  console.log('\n14. 两个人同一天生日');
  {
    const { p, ctx } = await phone(browser, '2026-11-09T09:00:00+08:00', { char: 'char1', data: seed({ b1: '11-09', b2: '11-09' }) });
    const th = await p.evaluate(() => App._themeTest(new Date('2026-11-09T12:00:00+08:00')));
    ok(th && th.id === 'bday' && th.name === '生日' && th.speech.some(s => /你们俩/.test(s)), '主题「生日」，呆呆说「你们俩都生日快乐」');
    ok((await film(p))?.real, 'CS 的手机：自己的生日电影照样出来');
    ok(await p.evaluate(() => !!document.querySelector('#char-img-wrap-1 .bdf-crown') && !!document.querySelector('#char-img-wrap-2 .bdf-crown')), '两个头像都戴小皇冠');
    // Reported from the live run: the portraits bob ~20px and the crown stood still, so it floated off YY's head.
    // Sample a whole bob (2.8s) on both sides (char2 runs 0.9s behind) — the crown must keep its seat on the head.
    await p.evaluate(() => App.closeBirthdayFilm()); await sleep(900);
    const gaps = { 1: [], 2: [] };
    for (let i = 0; i < 15; i++) {
      const g = await p.evaluate(() => [1, 2].map(n => {
        const art = document.querySelector(`#char-img-wrap-${n} .char-svg, #char-img-wrap-${n} .char-img-custom`).getBoundingClientRect();
        return (document.querySelector(`#char-img-wrap-${n} .bdf-crown`).getBoundingClientRect().bottom - art.top) / art.height;
      }));
      gaps[1].push(g[0]); gaps[2].push(g[1]);
      await sleep(200);
    }
    // as a share of the portrait: the drawn head starts 31% down the box (y 41 of 132), so the crown's band belongs just below that
    const drift = n => (Math.max(...gaps[n]) - Math.min(...gaps[n])) * 92, all = [...gaps[1], ...gaps[2]];
    ok(drift(1) <= 2 && drift(2) <= 2, `小皇冠跟着头像一起跳（CS 偏 ${drift(1).toFixed(1)}px · YY 偏 ${drift(2).toFixed(1)}px）`);
    ok(Math.min(...all) > .3 && Math.max(...all) < .42, `一直戴在头上，不飘在半空（底边在头像 ${(Math.min(...all) * 100).toFixed(0)}–${(Math.max(...all) * 100).toFixed(0)}% 处）`);
    await p.screenshot({ path: `${SHOTS}/bday_14_crowns.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
