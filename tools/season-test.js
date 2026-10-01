// Seasons & festivals, walked through the calendar. Serve the repo first:
//   python3 -m http.server 8765        then:  node tools/season-test.js
//
// Everything seasonal is decided by the device clock with nothing running
// anywhere (CLAUDE.md §7.2), so the only way to know 万圣节 or 圣诞 will work
// is to fake the clock and look. Five parts:
//   1. the theme calendar — which theme wins on every boundary day
//   2. the stock calendar — which limited pieces are on sale, day by day
//   3. the "new stock" card on drop days, replayed as a real couple would
//   4. each festival rendered: home sky, room, pet, both themes, no errors
//   5. 周年 (§7.29): the couple's own day beats 圣诞, and its free gift
// Screenshots go to $SHOTS (default /tmp) for a human to look at.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const at = (s) => new Date(s.length === 10 ? `${s}T12:00:00+08:00` : `${s}+08:00`);

function seed({ outfit = '', owned = [] } = {}) {
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: {}, history: [], archive: [],
    letters: [], photos: [], goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '呆呆', petSpecies: 'dog', petExp: 2600, petBase: 0,
    petEquipped: JSON.stringify({ p: '', m: '', o: outfit, it: ['ag,16,30', 'aa,10,84', 'ab,78,72'] }),
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [], rewards: [], punishments: [],
    decorOwned: owned.map((id, n) => ({ id: 'd' + n, itemId: id, owner: 'char1', itemName: id, itemIcon: '', ptsSpent: 0 })),
  };
}

async function open(browser, when, { theme = 'time', w = 390, data = seed(), reduced = false, extraLS = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, timezoneId: 'Asia/Singapore',
    deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
  await p.clock.setFixedTime(at(when));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(([d, th, ls]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d));
    localStorage.setItem('theme_mode', th);
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, [data, theme, extraLS]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode()); await sleep(450);
  await p.evaluate(() => document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary());
  return { p, ctx, errs };
}
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/season_${name}.png` });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const { p: probe, ctx: probeCtx } = await open(browser, '2026-10-02');

  console.log('\n1. 主题日历（每个交界日）');
  const cal = [
    ['2026-09-21', 'autumn'], ['2026-09-22', 'midautumn'], ['2026-09-25', 'midautumn'], ['2026-09-28', 'midautumn'], ['2026-09-29', 'autumn'],
    ['2026-10-02', 'autumn'], ['2026-10-25', 'autumn'], ['2026-10-26', 'halloween'], ['2026-10-31', 'halloween'],
    ['2026-11-01', 'halloween'], ['2026-11-02', 'autumn'], ['2026-11-30', 'autumn'], ['2026-12-01', 'winter'],
    ['2026-12-17', 'winter'], ['2026-12-18', 'xmas'], ['2026-12-23', 'xmas'], ['2026-12-24', 'anniv'], ['2026-12-25', 'xmas'], ['2026-12-27', 'xmas'], ['2026-12-28', 'winter'],
    ['2026-12-29', 'nye'], ['2027-01-02', 'nye'], ['2027-01-03', 'winter'],
    ['2027-02-04', 'cny'], ['2027-02-12', 'cny'], ['2027-02-13', 'vday'], ['2027-02-14', 'vday'], ['2027-02-15', 'vday'],
    ['2027-02-16', 'cny'], ['2027-02-18', 'cny'], ['2027-02-19', 'winter'],
    ['2027-06-08', 'dragon'], ['2027-06-12', 'dragon'], ['2027-06-13', 'summer'],
    ['2027-09-15', 'midautumn'], ['2028-10-03', 'midautumn'], ['2028-10-06', 'midautumn'], ['2028-10-07', 'autumn'],
    ['2028-10-26', 'halloween'], ['2030-10-31', 'halloween'],
  ];
  const got = await probe.evaluate(c => c.map(([d]) => (App._themeTest(new Date(d + 'T12:00:00+08:00')) || {}).id), cal);
  const wrong = cal.filter(([d, want], i) => got[i] !== want).map(([d, want], i) => `${d}: ${got[cal.findIndex(x => x[0] === d)]}≠${want}`);
  ok(!wrong.length, `${cal.length} 个交界日全部正确${wrong.length ? '：' + wrong.join(', ') : ''}`);
  ok(await probe.evaluate(() => App._particleTest(new Date('2026-10-30T21:30:00+08:00'))) === '🍬', '万圣节夜里落的是糖果，不是会转圈掉下来的蝙蝠');
  const moon = await probe.evaluate(() => App._moonTest(new Date('2026-09-25T20:30:00+08:00')));
  ok(moon.illum > 0.97, `中秋当晚月亮 ${(moon.illum * 100).toFixed(0)}% 亮（${moon.name}）`);

  console.log('\n2. 限定家具上下架');
  const stock = (d) => probe.evaluate(d => App._seasonStockTest(new Date(d + 'T12:00:00+08:00')), d);
  const has = (list, ids) => ids.every(i => list.includes(i));
  const none = (list, ids) => ids.every(i => !list.includes(i));
  const MID = ['mooncake_set', 'moon_window', 'rabbit_lamp', 'osmanthus', 'moon_rabbit_26'];
  const AUT = ['persimmon_basket', 'maple_frame', 'knit_basket'];
  const HAL = ['jack_lantern', 'ghost_plush', 'bat_garland', 'cauldron', 'pumpkin_cottage_26', 'hat_witch'];
  let s = await stock('2026-10-02');
  ok(has(s, MID) && none(s, [...AUT, ...HAL]), '10-02（今天）：中秋 5 件还在卖，秋/万圣节还没上');
  s = await stock('2026-10-05'); ok(has(s, MID), '10-05：中秋最后一天还能买');
  s = await stock('2026-10-06'); ok(none(s, MID) && has(s, AUT) && none(s, HAL), '10-06：中秋下架，秋 3 件上架');
  s = await stock('2026-10-12'); ok(has(s, AUT) && has(s, HAL), '10-12：万圣节 6 件上架（含 2026 南瓜小屋、小巫师帽）');
  s = await stock('2026-11-02'); ok(has(s, HAL), '11-02：万圣节最后一天');
  s = await stock('2026-11-03'); ok(none(s, HAL) && has(s, AUT), '11-03：万圣节下架，秋还在');
  s = await stock('2026-12-01'); ok(none(s, AUT), '12-01：秋下架');
  s = await stock('2026-12-05'); ok(has(s, ['fireplace', 'xmas_socks', 'gingerbread', 'snow_globe_26']) && !s.includes('xmas_tree'), '12-05：圣诞 4 件先上，圣诞树 12-10');
  s = await stock('2026-12-10'); ok(s.includes('xmas_tree') && s.includes('star_string'), '12-10：圣诞树、星星彩灯上架');
  s = await stock('2027-10-12'); ok(!s.includes('pumpkin_cottage_26') && has(s, ['jack_lantern', 'ghost_plush']), '2027-10-12：南瓜灯回来了，2026 南瓜小屋不会再卖');
  s = await stock('2027-09-05'); ok(s.includes('mooncake_box_27') && !s.includes('moon_rabbit_26'), '2027 中秋：卖 2027 月饼礼盒，不卖 2026 月兔');
  await probeCtx.close();

  console.log('\n3. 「新家具上架」卡片：一对情侣真实的打开顺序');
  {
    const { p, ctx, errs } = await open(browser, '2026-10-02');
    const card = () => p.evaluate(() => { const c = document.getElementById('season-card');
      return c.classList.contains('hidden') ? null : { t: c.querySelector('.sc-title')?.textContent, s: c.querySelector('.sc-sub')?.textContent, e: c.querySelector('.sc-emoji')?.textContent }; });
    ok(await card() === null, '10-02 打开：没有新东西，不出卡片（中秋早就看过）');
    await p.clock.setFixedTime(at('2026-10-06T09:00:00')); await p.evaluate(() => App._renderSeasonTest());
    let c = await card();
    ok(c && /^秋限定上架 · 3 件/.test(c.t) && c.e === '🍂', `10-06：「${c && c.t}」${c && c.e}`);
    ok(c && /柿柿如意篮/.test(c.s) && /还有 56 天下架/.test(c.s), `副标题：${c && c.s}`);
    await shot(p, '01_card_autumn');
    // didn't open the shop this week — both drops are now "new"
    await p.clock.setFixedTime(at('2026-10-12T09:00:00')); await p.evaluate(() => App._renderSeasonTest());
    c = await card();
    ok(c && /^万圣节限定上架 · 6 件/.test(c.t) && c.e === '🎃', `10-12：用最新的那一批命名 → 「${c && c.t}」${c && c.e}（不是「秋限定 · 9 件」）`);
    ok(c && /南瓜灯/.test(c.s) && !/柿柿如意篮/.test(c.s) && /还有 22 天下架/.test(c.s), `只列万圣节的：${c && c.s}`);
    await shot(p, '02_card_halloween');
    await p.evaluate(() => App.showPetHome()); await sleep(400);
    await p.evaluate(() => App.openDecor()); await sleep(300);
    const newBadges = await p.$$eval('#decor-grid .decor-new, #decor-grid [class*="new"]', a => a.length).catch(() => -1);
    await p.evaluate(() => App.closeDecor()); await sleep(200);
    await p.evaluate(() => App.closePetHome()); await sleep(200);
    ok(await card() === null, '逛过商店再出来：卡片收起（离开商店时才算看过）');
    ok(!errs.length, '无报错 ' + errs.join(' | ') + (newBadges >= 0 ? '' : ''));
    await ctx.close();
  }

  console.log('\n4. 万圣节当周');
  for (const [label, when, night] of [['night', '2026-10-30T21:30:00', true], ['day', '2026-10-30T11:00:00', false], ['dusk', '2026-10-30T17:45:00', true]]) {
    const { p, ctx, errs } = await open(browser, when);
    const h = await p.evaluate(() => {
      const L = document.querySelector('.sky-bg .home-fest-layer');
      const vis = (sel) => [...document.querySelectorAll(sel)].filter(e => getComputedStyle(e).display !== 'none').length;
      return { fest: document.documentElement.dataset.festival, period: document.documentElement.dataset.period,
               theme: document.documentElement.dataset.theme, layer: !!L,
               pumpkins: vis('.sky-bg .pumpkin-accent'), bats: vis('.sky-bg .night-bat'), candy: [...document.querySelectorAll('.sky-bg .fest-p')].map(e => e.textContent).join('') };
    });
    ok(h.fest === 'halloween' && h.layer, `${label}：首页进入万圣节（data-festival=${h.fest}）`);
    ok(h.pumpkins === 6, `${label}：南瓜串 6 个（${h.pumpkins}）`);
    ok(night ? h.bats === 2 : h.bats === 0, `${label}：蝙蝠 ${h.bats} 只——${night ? '傍晚/夜里才飞' : '白天不出来'}（period=${h.period}）`);
    ok(/^(?:🍬)+$/u.test(h.candy), `${label}：飘的是糖果`);
    await shot(p, `03_home_halloween_${label}`);
    await p.evaluate(() => App.showPetHome()); await sleep(700);
    const r = await p.evaluate(() => {
      const room = document.getElementById('pet-room'), win = room.querySelector('.pet-window');
      return { theme: room.dataset.theme, win: room.dataset.window, chip: document.getElementById('pet-mood-chip').textContent,
               hat: !!document.querySelector('#pet-stage svg path[fill="#7B5DB4"]'), bat: getComputedStyle(win, '::before').content,
               particle: [...room.querySelectorAll('.pet-season-p')].map(e => e.textContent).join('') };
    });
    ok(r.theme === 'halloween' && r.win === 'spooky', `${label}：小窝主题 halloween、窗户 spooky`);
    ok(/🎃\s*万圣节/.test(r.chip), `${label}：头部显示「🎃 万圣节」`);
    ok(r.hat, `${label}：没自己选衣服时，宠物戴上小巫师帽`);
    ok(/🦇/.test(r.bat), `${label}：窗外有一只蝙蝠`);
    ok(/^(?:🍬)+$/u.test(r.particle), `${label}：小窝里飘糖果`);
    await shot(p, `04_room_halloween_${label}`);
    ok(!errs.length, `${label}：无报错 ` + errs.join(' | '));
    await ctx.close();
  }
  {
    // the couple's own choice of outfit always wins over the festival's
    const { p, ctx } = await open(browser, '2026-10-30T21:30:00', { data: seed({ outfit: 'scarf_red' }) });
    await p.evaluate(() => App.showPetHome()); await sleep(600);
    const hat = await p.evaluate(() => !!document.querySelector('#pet-stage svg path[fill="#7B5DB4"]'));
    const scarf = await p.evaluate(() => !!document.querySelector('#pet-stage svg path[fill="#E8556B"]'));
    ok(!hat && scarf, '自己穿了小红围巾 → 不会被巫师帽替掉（玩家的选择优先）');
    await ctx.close();
  }
  {
    // reduced motion: bats must still be SEEN, parked on-screen, not frozen off it
    const { p, ctx } = await open(browser, '2026-10-30T21:30:00', { reduced: true });
    const b = await p.evaluate(() => [...document.querySelectorAll('.sky-bg .night-bat')].map(e => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, d: getComputedStyle(e).display }; }));
    ok(b.length === 2 && b.every(x => x.d !== 'none' && x.x > 0 && x.x < 390), `减少动态效果：蝙蝠停在屏幕里（x=${b.map(x => Math.round(x.x)).join(',')}）`);
    await ctx.close();
  }
  {
    // forced light theme at night still shows the night-only bats (§7.15: gate on period, not theme)
    const { p, ctx } = await open(browser, '2026-10-30T21:30:00', { theme: 'light' });
    const bats = await p.evaluate(() => [...document.querySelectorAll('.sky-bg .night-bat')].filter(e => getComputedStyle(e).display !== 'none').length);
    ok(bats === 2, '强制浅色主题的晚上：蝙蝠照样出来（看时间段，不看主题）');
    await shot(p, '05_home_halloween_forcedlight_night');
    await ctx.close();
  }

  console.log('\n5. 中秋（9-25 晚上）——你问的那个');
  {
    const { p, ctx, errs } = await open(browser, '2026-09-25T20:30:00', { data: seed({ owned: MID }) });
    const h = await p.evaluate(() => ({ fest: document.documentElement.dataset.festival, lanterns: document.querySelectorAll('.sky-bg .lantern-accent').length }));
    ok(h.fest === 'midautumn' && h.lanterns === 6, `首页：中秋，灯笼 6 盏（${h.lanterns}）`);
    await shot(p, '06_home_midautumn');
    await p.evaluate(() => App.showPetHome()); await sleep(600);
    const r = await p.evaluate(() => ({ theme: document.getElementById('pet-room').dataset.theme, win: document.getElementById('pet-room').dataset.window, chip: document.getElementById('pet-mood-chip').textContent }));
    ok(r.theme === 'midautumn' && r.win === 'fullmoon' && /🥮\s*中秋/.test(r.chip), '小窝：中秋主题、满月窗、头部「🥮 中秋」');
    await shot(p, '07_room_midautumn');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n6. 之后的每个节日都能正常显示');
  const fests = [
    ['2026-12-20T21:00:00', 'xmas', '.sky-bg .fairy-light', 8, 'lights'],
    ['2026-12-23T10:00:00', 'xmas', '.sky-bg .sleigh', 1, 'lights'],
    ['2026-12-25T10:00:00', 'xmas', '.sky-bg .sleigh', 1, 'lights'],
    ['2026-12-31T23:00:00', 'nye', '.sky-bg .firework', 5, 'fireworks'],
    ['2027-02-06T12:00:00', 'cny', '.sky-bg .confetti', 9, 'fireworks'],
    ['2027-02-14T20:00:00', 'vday', '.sky-bg .hero-heart', 1, 'hearts'],
    ['2027-06-09T12:00:00', 'dragon', '.sky-bg .boat', 3, 'day'],
  ];
  for (const [when, id, sel, n, win] of fests) {
    const { p, ctx, errs } = await open(browser, when);
    const h = await p.evaluate(s => ({ fest: document.documentElement.dataset.festival, n: document.querySelectorAll(s).length }), sel);
    await p.evaluate(() => App.showPetHome()); await sleep(500);
    const r = await p.evaluate(() => ({ win: document.getElementById('pet-room').dataset.window }));
    ok(h.fest === id && h.n === n && r.win === win, `${when.slice(0, 10)} ${id}：首页 ${sel.split(' ').pop()} ×${h.n}，窗户 ${r.win}`);
    await shot(p, `08_${id}_${when.slice(5, 10)}`);
    ok(!errs.length, `${id}：无报错 ` + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n7. 买过的限定家具永远留着');
  {
    const { p, ctx } = await open(browser, '2027-10-15', { data: seed({ owned: ['pumpkin_cottage_26'] }) });
    await p.evaluate(() => App.showPetHome()); await sleep(400);
    await p.evaluate(() => App.openDecor()); await sleep(300);
    const names = await p.$$eval('#decor-grid .decor-name, #decor-grid [class*="name"]', a => a.map(x => x.textContent));
    ok(names.some(n => /2026 南瓜小屋/.test(n)), '2027 年：买过的 2026 南瓜小屋还在商店里（可以摆）');
    ok(names.some(n => /南瓜灯/.test(n)), '2027 年：南瓜灯回来卖');
    await ctx.close();
  }
  {
    const { p, ctx } = await open(browser, '2027-10-15');
    await p.evaluate(() => App.showPetHome()); await sleep(400);
    await p.evaluate(() => App.openDecor()); await sleep(300);
    const names = await p.$$eval('#decor-grid .decor-name, #decor-grid [class*="name"]', a => a.map(x => x.textContent));
    ok(!names.some(n => /2026 南瓜小屋/.test(n)), '2027 年：没买过的 2026 南瓜小屋不会出现（错过就没了）');
    await ctx.close();
  }

  console.log('\n8. 两周年（12-24）——这一天房间是你们俩的');
  {
    const { p: q, ctx: qc, errs } = await open(browser, '2026-10-02');
    const on = (d, start = '2024-12-24') => q.evaluate(([d, s]) => App._seasonAtTest(new Date(d), s),
      [d.length === 10 ? `${d}T12:00:00+08:00` : `${d}+08:00`, start]);
    const gifts = (l) => l.filter(i => /^anniv_frame_/.test(i)).join();
    let a = await on('2026-12-24T00:05:00');
    ok(a.id === 'anniv' && a.name === '两周年' && a.num === '2', `12-24 00:05：${a.name}（盖过圣诞，天空里是「${a.num}」）`);
    ok((await on('2026-12-24T23:59:00')).id === 'anniv', '12-24 23:59：还是两周年');
    ok((await on('2026-12-23T23:59:00')).id === 'xmas', '12-23 23:59：还是圣诞');
    ok((await on('2026-12-25T00:00:00')).id === 'xmas', '12-25 00:00：回到圣诞');
    ok(a.speech[0] === '两周年快乐！💞' && a.speech.some(s => /礼物/.test(s)), '宠物说「两周年快乐！💞」，也会提醒去小窝拿礼物');
    a = await on('2027-12-24'); ok(a.name === '三周年' && a.num === '3', '2027-12-24：三周年');
    a = await on('2027-09-19');
    ok(a.id === 'anniv' && a.name === '一千天' && a.num === '1000', `2027-09-19（第 1000 天）：${a.name} · 「${a.num}」`);
    ok(a.speech[0] === '在一起1000天啦！💞' && !a.speech.some(s => /礼物/.test(s)), '一千天：不提礼物（那天没有礼物）');
    ok((await on('2027-09-18')).id === 'midautumn' && (await on('2027-09-20')).id === 'autumn', '一千天前后一天：中秋 / 秋，不受影响');
    a = await on('2026-12-24', '');
    ok(a.id === 'xmas' && !gifts(a.stock), '没设开始日期（比如还没登录）：12-24 就是圣诞，没有礼物');
    a = await on('2027-03-14', '2025-03-14');
    ok(a.name === '两周年' && gifts(a.stock) === 'anniv_frame_2', '别的日子在一起的情侣：2027-03-14 过两周年、有相框');
    a = await on('2026-12-24', '2025-03-14');
    ok(a.id === 'xmas' && !gifts(a.stock), '…他们的 12-24 只是圣诞');
    a = await on('2026-02-28', '2024-02-29');
    ok(a.name === '两周年' && gifts(a.stock) === 'anniv_frame_2', '2/29 在一起的：2026 没有 2/29 → 2/28 过两周年，礼物也在');
    a = await on('2028-02-29', '2024-02-29');
    ok(a.name === '四周年' && gifts(a.stock) === 'anniv_frame_4', '2028 是闰年 → 2/29 当天四周年');

    ok(!gifts((await on('2026-12-23T23:59:00')).stock), '12-23 23:59：礼物还没上架（不剧透）');
    a = await on('2026-12-24T00:00:30');
    ok(gifts(a.stock) === 'anniv_frame_2' && a.left[0] === 8, `12-24 00:00：只有两周年相框，还有 ${a.left[0]} 天`);
    a = await on('2026-12-31T22:00:00');
    ok(gifts(a.stock) === 'anniv_frame_2' && a.left[0] === 1, `12-31 晚上：最后一天（还有 ${a.left[0]} 天）`);
    ok(!gifts((await on('2027-01-01T00:00:30')).stock), '2027-01-01：下架了——没收下就错过了');
    ok(gifts((await on('2027-12-24')).stock) === 'anniv_frame_3', '2027-12-24：三周年相框');
    ok(gifts((await on('2028-12-24')).stock) === 'anniv_frame_4', '2028-12-24：四周年相框');
    const codes = await q.evaluate(() => App._codesTest().byId);
    ok(codes.anniv_frame_2 === 'bi' && codes.anniv_frame_3 === 'bj' && codes.anniv_frame_4 === 'bk', '相框编码 bi/bj/bk，没有和别的家具撞');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await qc.close();
  }
  for (const [label, when] of [['day', '2026-12-24T10:00:00'], ['night', '2026-12-24T21:00:00']]) {
    const { p, ctx, errs } = await open(browser, when);
    const h = await p.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).length;
      const n = document.querySelector('.sky-bg .anniv-num'), r = n && n.getBoundingClientRect();
      return { fest: document.documentElement.dataset.festival, num: n && n.textContent, box: r && { cx: r.x + r.width / 2, y: r.y, w: r.width },
               balloons: vis('.sky-bg .anniv-balloon'), sleigh: document.querySelectorAll('.sky-bg .sleigh').length,
               fall: [...document.querySelectorAll('.sky-bg .fest-p')].map(e => e.textContent).join('') };
    });
    ok(h.fest === 'anniv' && h.num === '2' && h.balloons === 4 && !h.sleigh, `${label}：首页是两周年——金色「2」+ 一小串气球（${h.balloons}），没有圣诞老人`);
    ok(h.box && Math.abs(h.box.cx - 195) < 12 && h.box.y < 110 && h.box.w > 18, `${label}：「2」在顶部正中（中心 x=${h.box && Math.round(h.box.cx)}，y=${h.box && Math.round(h.box.y)}）`);
    ok(/^(?:💞)+$/u.test(h.fall), `${label}：飘的是 💞`);
    await shot(p, `09_home_anniv_${label}`);
    await p.evaluate(() => App.showPetHome()); await sleep(700);
    const r = await p.evaluate(() => {
      const room = document.getElementById('pet-room');
      return { theme: room.dataset.theme, win: room.dataset.window, chip: document.getElementById('pet-mood-chip').textContent,
               chipH: document.getElementById('pet-mood-chip').getBoundingClientRect().height,
               lv: document.getElementById('pet-page-lv').getBoundingClientRect().height,
               balloon: getComputedStyle(room.querySelector('.pet-window'), '::before').content,
               hat: !!document.querySelector('#pet-stage svg path[fill="#FF8FA0"]'),
               fall: [...room.querySelectorAll('.pet-season-p')].map(e => e.textContent).join('') };
    });
    ok(r.theme === 'anniv' && r.win === 'anniv', `${label}：小窝主题 anniv、窗户 anniv`);
    ok(/💞\s*两周年/.test(r.chip), `${label}：头部「💞 两周年」`);
    ok(r.lv < 24, `${label}：等级那行没被挤到换行（${Math.round(r.lv)}px）`);
    ok(/🎈/.test(r.balloon) && /^(?:💞)+$/u.test(r.fall), `${label}：窗外飘一个气球，房间里落 💞`);
    ok(r.hat, `${label}：没自己选衣服时，戴派对帽`);
    await shot(p, `10_room_anniv_${label}`);
    ok(!errs.length, `${label}：无报错 ` + errs.join(' | '));
    await ctx.close();
  }
  {
    // A real couple has been opening the app all December: 圣诞 is already
    // "seen", so on the day the only new thing is the gift.
    const { p, ctx, errs } = await open(browser, '2026-12-20T09:00:00');
    const card = () => p.evaluate(() => { const c = document.getElementById('season-card');
      return c.classList.contains('hidden') ? null : { t: c.querySelector('.sc-title')?.textContent, s: c.querySelector('.sc-sub')?.textContent, e: c.querySelector('.sc-emoji')?.textContent }; });
    ok(await card() === null, '12-20：没有新东西');
    await p.evaluate(() => App.decorTab('floor'));       // last time in the shop they were on 家具
    await p.clock.setFixedTime(at('2026-12-24T09:00:00')); await p.evaluate(() => App._renderSeasonTest());
    const c = await card();
    ok(c && c.t === '两周年礼物 · 免费收下' && c.e === '💞', `12-24 首页卡片：「${c && c.t}」${c && c.e}`);
    ok(c && /两周年相框/.test(c.s) && /还有 8 天下架/.test(c.s), `副标题：${c && c.s}`);
    await shot(p, '11_card_anniv');
    await p.evaluate(() => App.openDecorFromSeason()); await sleep(900);
    const shop = await p.evaluate(() => {
      const card = [...document.querySelectorAll('#decor-grid .decor-card')].find(c => /两周年相框/.test(c.textContent));
      return { tab: document.querySelector('[id^="dtab-"].active')?.id, found: !!card,
               badge: card?.querySelector('.decor-limited')?.textContent, gold: !!card?.querySelector('.decor-limited.oneyear'),
               price: card?.querySelector('.decor-price')?.textContent, btn: card?.querySelector('.decor-btn')?.textContent.trim(),
               ends: card?.querySelector('.decor-ends')?.textContent, isNew: !!card?.querySelector('.decor-new'),
               first: document.querySelector('#decor-grid .decor-card .decor-name')?.textContent,
               coins: document.getElementById('pet-coin-pill')?.textContent };
    });
    ok(shop.tab === 'dtab-wall' && shop.found, `点卡片 → 商店直接开在「墙面」（${shop.tab}）`);
    ok(shop.first === '两周年相框', `新到的排第一个，不用往下翻（第一个是「${shop.first}」）`);
    ok(shop.badge === '两周年限定' && shop.gold && shop.isNew, `金色「${shop.badge}」+ 🆕`);
    ok(shop.price === '周年礼物 · 免费' && shop.btn === '🎁 免费收下' && /还有 8 天下架/.test(shop.ends || ''), `「${shop.price}」·「${shop.btn}」·「${shop.ends}」`);
    await shot(p, '12_shop_anniv');
    await p.evaluate(() => App.buyDecor('anniv_frame_2')); await sleep(900);
    const after = await p.evaluate(() => ({ toast: document.querySelector('.toast')?.textContent || '',
      coins: document.getElementById('pet-coin-pill')?.textContent, placed: (App._eqTest()?.items || []).some(o => o.i === 'anniv_frame_2'),
      owned: (JSON.parse(localStorage.getItem('love_score_data')).decorOwned || []).filter(r => r.itemId === 'anniv_frame_2').map(r => r.ptsSpent) }));
    ok(/收下了「两周年相框」/.test(after.toast), `提示：${after.toast}`);
    ok(after.coins === shop.coins && after.owned.join() === '0', `小窝币没变（${shop.coins} → ${after.coins}），记账 0 币`);
    ok(after.placed, '收下就直接挂进小窝');
    const fr = await p.evaluate(() => {
      const items = App._eqTest().items, idx = items.findIndex(o => o.i === 'anniv_frame_2');
      const el = document.querySelector(`#pet-decor-layer .decor-piece[data-i="${idx}"]`), win = document.querySelector('#pet-room .pet-window');
      const a = el.getBoundingClientRect(), b = win.getBoundingClientRect();
      return { x: items[idx].x, y: items[idx].y, over: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom };
    });
    ok(fr.x === 50 && fr.y === 44 && !fr.over, `挂在墙正中、宠物上方（${fr.x}, ${fr.y}），没挡住窗户`);
    await p.evaluate(() => App.closeDecor()); await sleep(300);
    await shot(p, '13_room_with_frame');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }
  {
    // A phone set up ON the day (new phone, reinstall): everything already on
    // sale counts as seen — except the present, which is still announced.
    const { p, ctx } = await open(browser, '2026-12-24T09:00:00');
    const c = await p.evaluate(() => { const c = document.getElementById('season-card');
      return c.classList.contains('hidden') ? null : c.querySelector('.sc-title')?.textContent; });
    ok(c === '两周年礼物 · 免费收下', `当天第一次打开的新手机：照样提醒礼物（「${c}」），不提早就在卖的圣诞`);
    await ctx.close();
  }
  {
    // Hasn't opened the shop since before 圣诞 arrived: those pieces are 🆕
    // too, and the gift that arrived TODAY still has to come first.
    const { p, ctx } = await open(browser, '2026-12-03T09:00:00');
    await p.clock.setFixedTime(at('2026-12-24T09:00:00'));
    await p.evaluate(() => App.showPetHome()); await sleep(400);
    await p.evaluate(() => { App.decorTab('wall'); App.openDecor(); }); await sleep(400);
    const order = await p.$$eval('#decor-grid .decor-card', a => a.map(c => (c.querySelector('.decor-new') ? '🆕' : '') + c.querySelector('.decor-name').textContent));
    ok(order.slice(0, 3).join() === '🆕两周年相框,🆕星星彩灯,🆕圣诞袜' && !order.slice(3).some(n => n.startsWith('🆕')),
      `好久没逛商店：新的在前、最新的最前 → ${order.slice(0, 4).join('、')}…`);
    await ctx.close();
  }
  {
    // keepsake rules: owned → stays forever; missed → gone
    const { p, ctx } = await open(browser, '2027-03-01', { data: seed({ owned: ['anniv_frame_2'] }) });
    await p.evaluate(() => App.showPetHome()); await sleep(400);
    await p.evaluate(() => App.decorTab('wall')); await p.evaluate(() => App.openDecor()); await sleep(300);
    let names = await p.$$eval('#decor-grid .decor-name', a => a.map(x => x.textContent));
    ok(names.includes('两周年相框'), '2027 年：收下过的两周年相框一直在（可以摆）');
    await ctx.close();
    const o2 = await open(browser, '2027-03-01');
    await o2.p.evaluate(() => App.showPetHome()); await sleep(400);
    await o2.p.evaluate(() => App.decorTab('wall')); await o2.p.evaluate(() => App.openDecor()); await sleep(300);
    names = await o2.p.$$eval('#decor-grid .decor-name', a => a.map(x => x.textContent));
    ok(!names.some(n => /周年相框/.test(n)), '2027 年：没收下的就不会再出现');
    await o2.ctx.close();
  }
  {
    // The date is unknown until the config arrives (the module-load theme
    // runs before any login). The moment it arrives the day has to turn into
    // 两周年 — not at the next hour band, hours later. Before the fix in
    // refresh() this stayed 圣诞 until the tick.
    const d0 = seed(); d0.startDate = '';
    const { p, ctx } = await open(browser, '2026-12-24T10:00:00', { data: d0 });
    const before = await p.evaluate(() => document.documentElement.dataset.festival);
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('love_score_data')); d.startDate = '2024-12-24';
      localStorage.setItem('love_score_data', JSON.stringify(d)); });
    await p.evaluate(() => App.demoMode()); await sleep(500);
    await p.evaluate(() => document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary());
    const after = await p.evaluate(() => ({ f: document.documentElement.dataset.festival, n: document.querySelector('.sky-bg .anniv-num')?.textContent }));
    ok(before === 'xmas' && after.f === 'anniv' && after.n === '2', `日期还没到手：${before} → 配置一到就是两周年（${after.f}，「${after.n}」）`);
    await ctx.close();
  }
  {
    // left open overnight: the minute tick crosses midnight into the day
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Singapore' });
    const p = await ctx.newPage();
    await p.clock.install({ time: at('2026-12-23T23:59:30') });
    await p.route(/open-meteo|supabase\.co/, r => r.abort());
    await p.addInitScript(d => { if (sessionStorage.getItem('s')) return; localStorage.clear(); localStorage.setItem('love_score_data', JSON.stringify(d)); sessionStorage.setItem('s', '1'); }, seed());
    await p.goto(APP_URL);
    await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
    await p.evaluate(() => document.getElementById('start-page')?.remove());
    await p.evaluate(() => App.demoMode()); await p.clock.runFor(1500);
    const f1 = await p.evaluate(() => document.documentElement.dataset.festival);
    await p.clock.runFor(61000);
    await p.evaluate(() => App.closeAnniversary && App.closeAnniversary());
    const f2 = await p.evaluate(() => ({ f: document.documentElement.dataset.festival, n: document.querySelector('.sky-bg .anniv-num')?.textContent }));
    ok(f1 === 'xmas' && f2.f === 'anniv' && f2.n === '2', `手机开着过午夜：${f1} → ${f2.f}（「${f2.n}」）`);
    await ctx.close();
  }
  for (const w of [360, 390, 820]) {
    const { p, ctx } = await open(browser, '2026-12-24T10:00:00', { w });
    const g = await p.evaluate(() => {
      const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const rg = document.createRange(); rg.selectNodeContents(document.querySelector('.app-title'));
      const keep = [box(rg.getBoundingClientRect()), ...[...document.querySelectorAll('.header-right > *')].map(e => box(e.getBoundingClientRect()))];
      const bs = [...document.querySelectorAll('.sky-bg .anniv-balloon, .sky-bg .anniv-num')].map(e => box(e.getBoundingClientRect()));
      return { n: bs.length, clash: bs.filter(b => keep.some(k => hit(b, k))).length, inside: bs.every(b => b.l >= 0 && b.r <= innerWidth) };
    });
    ok(g.n === 5 && !g.clash && g.inside, `${w}px：「2」和气球没压到标题、♫/⚙️ 按钮（重叠 ${g.clash}）`);
    if (w !== 390) await shot(p, `16_home_anniv_${w}`);
    await ctx.close();
  }
  {
    const { p, ctx } = await open(browser, '2026-12-24T21:00:00', { reduced: true });
    const r = await p.evaluate(() => [...document.querySelectorAll('.sky-bg .anniv-num, .sky-bg .anniv-balloon')].map(e => {
      const b = e.getBoundingClientRect(); return { x: b.x, w: b.width, o: +getComputedStyle(e).opacity }; }));
    ok(r.length === 5 && r.every(b => b.x >= 0 && b.x + b.w <= 390 && b.o > 0.5), `减少动态效果：数字和气球都静止在屏幕里（${r.length} 个）`);
    await ctx.close();
  }
  {
    const { p, ctx } = await open(browser, '2026-12-24T10:00:00', { theme: 'dark' });
    await shot(p, '14_home_anniv_forceddark');
    await p.evaluate(() => App.showPetHome()); await sleep(500);
    await shot(p, '15_room_anniv_forceddark');
    await ctx.close();
  }
  {
    const { p, ctx } = await open(browser, '2027-12-24T10:00:00');
    const n = await p.evaluate(() => document.querySelector('.sky-bg .anniv-num')?.textContent);
    await p.evaluate(() => App.showPetHome()); await sleep(500);
    const chip = await p.evaluate(() => document.getElementById('pet-mood-chip').textContent);
    ok(n === '3' && /💞\s*三周年/.test(chip), `2027-12-24：天空「${n}」，头部「💞 三周年」——明年自己会来`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
