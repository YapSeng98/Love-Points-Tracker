// 周年小电影 browser test. Serve the repo first:  python3 -m http.server 8765
// then:  node tools/anniversary-test.js   (screenshots go to $SHOTS or /tmp)
// Uses demo mode with a seeded couple and a faked clock — no real account.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const PORT = 8765, URL = `http://localhost:${PORT}/index.html`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// tiny coloured JPEG-ish PNGs as photos
const px = (c) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${c}"/><circle cx="200" cy="220" r="90" fill="#fff" opacity=".5"/></svg>`)}`;
function seed(opts = {}) {
  const e = [];
  const months = ['2026-01','2026-05','2026-09','2026-12'];
  months.forEach((m, i) => { for (let k = 0; k < 5; k++) e.push({ id:`e${i}${k}`, charId: k%2?'char2':'char1', catId:'c1', catName:'陪伴时光', icon:'💑', pts:10, desc:'', date:`${m}-1${k}`, month:m }); });
  e.push({ id:'ci1', charId:'char1', catName:'📅 每日签到', pts:2, date:'2026-12-20', month:'2026-12' });
  const entries = {}; e.forEach(x => (entries[x.month] ||= []).push(x));
  return {
    mode:'reward', rewardTarget:100, punishThreshold:-80, entries, history:[], archive:[],
    letters: [
      { id:'l1', charId:'char2', text:'亲爱的CS：\n遇见你，是我今年最好的运气。以后也要一起。', date:'2026-07-14T02:30:15.868Z', opened:true },
      { id:'l2', charId:'char1', text:'宝宝\n今天好想你呀，下班一起吃火锅吧！', date:'2026-07-15T00:57:49.867Z', opened:true },
      { id:'l3', charId:'char2', text:'第二封', date:'2026-08-01T00:00:00Z', opened:true },
    ],
    photos: opts.noPhotos ? [] : [
      { id:'p1', charId:'char1', image:px('#E07A8B'), caption:'第一次看海', date:'2026-01-04' },
      { id:'p2', charId:'char2', image:px('#6C8FD4'), caption:'', date:'2026-02-28' },
      { id:'p3', charId:'char1', image:px('#6FB39A'), caption:'生日那天', date:'2026-05-17' },
      { id:'p4', charId:'char2', image:px('#F0A45C'), caption:'一起做的蛋糕', date:'2026-07-25' },
    ],
    goalName:'', goalIcon:'🎯', goalTarget:0,
    petName:'呆呆', petSpecies:'dog', petExp:0, petBase:0, petEquipped:'',
    wx1:'', wx2:'', charName1:'CS', charName2:'YY', charImg1:'', charImg2:'',
    startDate: opts.start || '2024-12-24',
    categories:[{ id:'c1', icon:'💑', name:'陪伴时光', pts:10, active:true }], rewards:[], punishments:[],
  };
}

async function page(browser, when, { data = seed(), char, extraLS = {}, demo = true, w = 390, h = 844, install = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  if (install) await p.clock.install({ time: new Date(when) });
  else await p.clock.setFixedTime(new Date(when));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, ls]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('love_score_data', JSON.stringify(d));
      for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
      sessionStorage.setItem('seeded', '1');
    }
  }, [data, extraLS]);
  await p.goto(URL);
  await p.waitForFunction(() => typeof App !== "undefined" && App.demoMode);
  if (char) await p.evaluate(c => App._setChar(c), char);
  if (demo) {
    // what tapping the splash does on a phone, minus the login card
    await p.evaluate(() => document.getElementById('start-page')?.remove());
    await p.evaluate(() => App.demoMode()); await sleep(600);
  }
  return { p, ctx, errs };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. 日期判断（纯函数）');
  {
    const { p, ctx } = await page(browser, '2026-09-30T10:00:00+08:00', { demo: false });
    const t = (d, s) => p.evaluate(([d, s]) => { return App._annivTest(new Date(d), s); }, [d, s]);
    const a = await t('2026-12-24T00:05:00', '2024-12-24');
    ok(a && a.label === '两周年' && a.days === 731 && a.next === '第三年', `12-24 00:05 → 两周年, 第 731 天, 第三年 (${JSON.stringify(a && [a.label,a.days,a.next])})`);
    ok(await t('2026-12-23T23:59:00', '2024-12-24') === null, '12-23 23:59 → 不是');
    ok(await t('2026-12-25T00:00:00', '2024-12-24') === null, '12-25 00:00 → 不是');
    ok(await t('2024-12-24T12:00:00', '2024-12-24') === null, '在一起的第一天本身 → 不是周年');
    const y1 = await t('2025-12-24T12:00:00', '2024-12-24'); ok(y1 && y1.label === '一周年' && y1.next === '第二年', '2025-12-24 → 一周年 / 第二年');
    const k = await t('2027-09-19T12:00:00', '2024-12-24'); ok(k && k.kind === 'days' && k.n === 1000, '2027-09-19 → 第 1000 天');
    const l1 = await t('2027-02-28T12:00:00', '2024-02-29'); ok(l1 && l1.label === '三周年', '2/29 开始的情侣：平年 2/28 过');
    const l2 = await t('2028-02-28T12:00:00', '2024-02-29'); ok(l2 === null, '闰年 2/28 不过（等 2/29）');
    const l3 = await t('2028-02-29T12:00:00', '2024-02-29'); ok(l3 && l3.label === '四周年', '闰年 2/29 → 四周年');
    const tt = await t('2034-12-24T12:00:00', '2024-12-24'); ok(tt && tt.label === '十周年', '十周年');
    ok(await p.evaluate(() => App._annivTest(new Date('2026-12-24T12:00:00'), '')) === null, '没设开始日期 → 不出现');
    const q = s => p.evaluate(s => App._annivQuoteTest(s), s);
    ok(await q('亲爱的CS：\n遇见你，是我今年最好的运气。以后也要一起。') === '遇见你，是我今年最好的运气', '跳过「亲爱的CS：」取第一句');
    ok(await q('宝宝\n今天好想你呀，下班一起吃火锅吧！') === '今天好想你呀，下班一起吃火锅吧！', '跳过太短的称呼');
    ok([...await q('我'.repeat(50) + '。')].length === 30, '太长截断到一行');
    ok(await q('嗯') === '', '没有像样的句子 → 空（这一幕会跳过）');
    await ctx.close();
  }

  console.log('\n2. 登录前不弹');
  {
    const { p, ctx, errs } = await page(browser, '2026-12-24T09:00:00+08:00', { demo: false });
    await sleep(800);
    ok(await p.$('#anv-root') === null, '开屏页上不出现');
    await p.evaluate(() => App._annivMaybeTest()); await sleep(200);
    ok(await p.$('#anv-root') === null, '开屏页还在时，就算被叫到也不出现');
    await p.evaluate(() => document.getElementById('start-page').remove());
    await p.evaluate(() => document.getElementById('setup-overlay').classList.remove('hidden'));
    await p.evaluate(() => App._annivMaybeTest()); await sleep(200);
    ok(await p.$('#anv-root') === null, '登录卡片上也不出现');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n3. 12-24 第一次打开：CS 的手机，完整播一遍');
  {
    const { p, ctx, errs } = await page(browser, '2026-12-24T00:30:00+08:00');
    ok(await p.$('#anv-root') !== null, '凌晨 00:30（服务器还是 12-23 UTC）也会弹');
    const to = await p.textContent('.anv-env-to'); ok(to.includes('给 CS 的'), '信封写「给 CS 的」');
    ok((await p.textContent('.anv-hint')).includes('两周年快乐'), '「两周年快乐 · 轻点打开」');
    await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/01_envelope.png' });
    const nodesBefore = await p.evaluate(() => document.getElementsByTagName('*').length);
    await p.click('.anv-env', { force: true });
    ok(await p.evaluate(() => localStorage.getItem('anniv_seen_2026-12-24') === '1'), '打开就记为看过');
    await sleep(2600); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/02_date.png' });
    ok((await p.textContent('.anv-date')).trim() === '2024.12.24', '日期幕 2024.12.24');
    await sleep(5500); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/03_count.png' });
    ok((await p.textContent('.anv-count')).trim() === '731', '数字滚到 731');
    const s1 = await p.evaluate(() => App._annivStateTest());
    ok(s1.built && s1.plan.join() === 'date,count,photos,things,letter,pet,end', '场景顺序 ' + s1.plan.join());
    ok(s1.data.things === 20, `「小事」按过去一年算、不含签到：${s1.data.things}`);
    ok(s1.data.letters === 3 && s1.data.photos.length === 4, '信 3 封、照片 4 张');
    ok(s1.data.quote === '遇见你，是我今年最好的运气', '引用的是 YY 写的信：' + s1.data.quote);
    await sleep(2200); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/04_photo.png' });
    const vis = await p.$$eval('.anv-pol.anv-on', a => a.length); ok(vis === 1, '一次只显示一张照片');
    // tap to pause / resume
    await p.mouse.click(195, 700); const tp = (await p.evaluate(() => App._annivStateTest())).t; await sleep(800);
    const tp2 = (await p.evaluate(() => App._annivStateTest())).t; ok(Math.abs(tp2 - tp) < 0.05, '点画面暂停');
    ok(await p.isVisible('.anv-pausemark'), '显示「已暂停」');
    await p.mouse.click(195, 700); await sleep(500);
    ok((await p.evaluate(() => App._annivStateTest())).t > tp2 + 0.2, '再点继续');
    await sleep(11500); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/05_things.png' });
    ok((await p.evaluate(() => App._annivStateTest())).scene === 'things', '「这一年」幕');
    await sleep(7000); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/06_letter.png' }); await sleep(2500); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/06b_letter.png' }); 
    ok((await p.evaluate(() => App._annivStateTest())).scene === 'letter', '「一句话」幕');
    ok((await p.textContent('.anv-scene[data-s="letter"]')).includes('YY 写给你'), '「YY 写给你的第一封信里说」');
    await sleep(6500); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/07a_pet_enter.png' }); await sleep(1800); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/07_pet.png' });
    ok((await p.evaluate(() => App._annivStateTest())).scene === 'pet', '呆呆幕');
    ok(await p.$('.anv-pet svg') !== null && (await p.innerHTML('.anv-pet')).includes('#FF8FA0'), '呆呆戴派对帽');
    await p.waitForFunction(() => !App._annivStateTest().playing, null, { timeout: 15000 });
    await sleep(3500); await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/08_end.png' });
    const st = await p.evaluate(() => App._annivStateTest());
    ok(st.scene === 'end' && !st.playing, '停在结尾');
    ok((await p.textContent('.anv-names')).replace(/\s/g,'') === 'CS♥YY', 'CS ♥ YY');
    ok((await p.textContent('.anv-scene[data-s="end"]')).includes('第三年，也请多多指教'), '第三年，也请多多指教');
    // again
    await p.click('button[data-a="again"]'); await sleep(400);
    ok((await p.evaluate(() => App._annivStateTest())).scene === 'date', '再看一次从头');
    // skip
    await p.click('.anv-skip'); await sleep(400);
    ok((await p.evaluate(() => App._annivStateTest())).scene === 'end', '跳过 → 结尾');
    await p.click('button[data-a="close"]'); await sleep(900);
    ok(await p.$('#anv-root') === null, '关掉后整个移除');
    const nodesAfter = await p.evaluate(() => document.getElementsByTagName('*').length);
    ok(nodesAfter <= nodesBefore - 10, `DOM 回落（${nodesBefore} → ${nodesAfter}）`);
    ok((await p.textContent('#together-next')).includes('今天两周年 · 看小电影'), '首页卡片：「🎬 今天两周年 · 看小电影 ›」');
    await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/09_home_tip.png' });
    // not again on return
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300); ok(await p.$('#anv-root') === null, '看过之后切回 app 不会再弹');
    // tip replays
    await p.click('.th-anniv'); await sleep(400);
    ok(await p.$('#anv-root') !== null, '点首页卡片可以再看');
    ok(await p.$('.anv-later') === null, '手动打开没有「稍后再看」');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n4. 同一天重新打开 app');
  {
    const { p, ctx } = await page(browser, '2026-12-24T20:00:00+08:00', { extraLS: { 'anniv_seen_2026-12-24': '1' } });
    ok(await p.$('#anv-root') === null, '这台手机看过了 → 不再弹');
    await ctx.close();
  }

  console.log('\n5. YY 的手机');
  {
    const { p, ctx } = await page(browser, '2026-12-24T09:00:00+08:00', { char: 'char2' });
    ok((await p.textContent('.anv-env-to')).includes('给 YY 的'), '信封写「给 YY 的」');
    await p.click('.anv-env', { force: true }); await sleep(1500);
    const s = await p.evaluate(() => App._annivStateTest());
    ok(s.data.quote === '今天好想你呀，下班一起吃火锅吧！', '引用的是 CS 写的信：' + s.data.quote);
    await ctx.close();
  }

  console.log('\n6. 稍后再看');
  {
    const { p, ctx } = await page(browser, '2026-12-24T09:00:00+08:00');
    await p.click('.anv-later'); await sleep(700);
    ok(await p.$('#anv-root') === null, '关掉');
    ok(await p.evaluate(() => !localStorage.getItem('anniv_seen_2026-12-24')), '没有记为看过');
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(300);
    ok(await p.$('#anv-root') === null, '这次打开里不会反复弹');
    await p.click('.th-anniv'); await sleep(300);
    ok(await p.$('#anv-root') !== null, '首页卡片能打开');
    await ctx.close();
  }

  console.log('\n7. 平常日子');
  {
    const { p, ctx } = await page(browser, '2026-12-23T09:00:00+08:00');
    ok(await p.$('#anv-root') === null, '12-23 不弹');
    ok(!(await p.textContent('#together-next')).includes('小电影'), '首页卡片照常显示里程碑');
    await ctx.close();
  }

  console.log('\n8. 手机开着过午夜（12-23 23:59 → 12-24）');
  {
    const { p, ctx } = await page(browser, '2026-12-23T23:59:30+08:00', { install: true });
    ok(await p.$('#anv-root') === null, '23:59 还没有');
    await p.clock.runFor(61000); await sleep(300);
    ok(await p.$('#anv-root') !== null, '分钟计时器过了午夜 → 弹出信封');
    await ctx.close();
  }

  console.log('\n9. 没有照片、没养宠物');
  {
    const d = seed({ noPhotos: true }); d.petSpecies = ''; d.letters = [];
    const { p, ctx, errs } = await page(browser, '2026-12-24T09:00:00+08:00', { data: d });
    await p.click('.anv-env', { force: true }); await sleep(1500);
    const s = await p.evaluate(() => App._annivStateTest());
    ok(s.plan.join() === 'date,count,things,end', '跳过照片、一句话、呆呆：' + s.plan.join());
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n9b. 照片链接过期（签名 URL 4 小时失效）');
  {
    const d = seed(); d.photos[0].image = 'https://expired.invalid/p.jpg';
    const { p, ctx, errs } = await page(browser, '2026-12-24T09:00:00+08:00', { data: d });
    await p.route(/expired\.invalid/, r => r.fulfill({ status: 400, body: 'expired' }));
    await p.click('.anv-env', { force: true }); await sleep(11000);
    await p.screenshot({ path: (process.env.SHOTS || '/tmp') + '/11_broken_photo.png' });
    const imgs = await p.$$eval('.anv-pol img', a => a.length);
    ok(imgs === 3, `坏掉的那张不显示破图标，只剩底色卡片（剩 ${imgs} 张图）`);
    await ctx.close();
  }

  console.log('\n10. 宽屏 / iPad');
  for (const [w, h] of [[820, 1180], [1280, 800]]) {
    const { p, ctx } = await page(browser, '2026-12-24T09:00:00+08:00', { w, h });
    await p.click('.anv-env', { force: true }); await sleep(10600);
    await p.screenshot({ path: `shots/10_photo_${w}.png` });
    const box = await p.$eval('.anv-pol.anv-on', e => e.getBoundingClientRect().toJSON());
    ok(box.width <= 300 && box.top >= 0 && box.bottom <= h, `${w}px 照片在屏幕内，宽 ${Math.round(box.width)}`);
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
