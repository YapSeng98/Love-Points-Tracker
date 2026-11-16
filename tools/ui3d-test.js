// 新外观 (ui3d, CLAUDE.md §7.31) in a browser: demo data, faked clock, both themes.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:8766/index.html)
//   node tools/ui3d-test.js
//
// The new look is the default (since 2026-11-15); 经典 is a per-phone choice that
// sticks once picked. Then: the ＋ sheet saves through the
// tiles' own path, 月末结算 lives in the score card, entry actions wait for a tap,
// the room's light never takes a tap, and turning it off leaves nothing behind.
// §9: the opening screen and login card — three fixes for both looks (他/她
// unreadable at night, the pair-code hint cut off, 「继续 (…) →」 on a fresh
// phone), then the new look's version, stamped before app.js so it can't flash.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function seed({ older = false } = {}) {
  const cats = [['c1','💑','陪伴时光',10],['c2','🎁','惊喜礼物',15],['c3','🍳','亲自煮饭',8],['c4','🧹','做家务',5],['c8','😤','忘记约定',-10],['c10','📱','手机太久',-5]];
  const entries = { '2026-11': cats.map((c, i) => ({ id: 'e' + i, catId: c[0], catName: c[2], icon: c[1], pts: c[3], desc: i === 0 ? '<b>粗</b>' : '', date: `2026-11-${String(14 - i).padStart(2, '0')}`, charId: i % 2 ? 'char2' : 'char1', month: '2026-11' })) };
  if (older) entries['2026-10'] = [{ id: 'o1', catId: 'c1', catName: '陪伴时光', icon: '💑', pts: 10, desc: '', date: '2026-10-30', charId: 'char1', month: '2026-10' }];
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries, history: [], archive: [], letters: [], photos: [],
    goalName: '', goalIcon: '🎯', goalTarget: 0, petName: '呆呆', petSpecies: 'dog', petExp: 900, petBase: 0, petEquipped: '',
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24', birthday1: '03-16', birthday2: '11-01',
    categories: [...cats, ['c5','📅','记住重要日',20], ['c9','⏰','约会迟到',-5]].map(([id, icon, name, pts]) => ({ id, icon, name, pts, active: true })).concat([{ id: 'cx', icon: '🙈', name: '停用的', pts: 3, active: false }]),
    rewards: [], punishments: [], decorOwned: [], surprises: [],
  };
}

async function phone(browser, when, { look = '', data = seed(), w = 390, h = 844, dark = false, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
    if (look) localStorage.setItem('look', look);
    sessionStorage.setItem('seeded', '1');
  }, [data, look]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => App._setChar('char1'));
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode());
  await sleep(1500);
  return { p, ctx, errs };
}
const looks = (p) => p.evaluate(() => ({
  on: document.documentElement.classList.contains('ui3d'),
  css: !!document.getElementById('ui3d-css'),
  plus: !!document.querySelector('.u3d-add'),
  fab: getComputedStyle(document.querySelector('.settle-fab-dock')).display !== 'none',
  navSettings: getComputedStyle(document.getElementById('nav-settings')).display !== 'none',
  leftovers: document.querySelectorAll('[data-u3d]').length,
}));
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')));
const cssReady = (p) => p.waitForFunction(() => getComputedStyle(document.querySelector('.settle-fab-dock')).display === 'none', null, { timeout: 8000 }).then(() => true).catch(() => false);

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. A fresh phone gets the new look');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00');
    await cssReady(p);
    const l = await looks(p);
    ok(l.on && l.css && l.plus && !l.fab && !l.navSettings, `on by default, nobody has to switch it: ＋ in the bar, no floating 月末结算 ${JSON.stringify(l)}`);
    // two fixes that apply to everyone, whichever look
    const desc = await p.evaluate(() => { const d = document.querySelector('#entry-e0 .entry-desc'); return { text: d.textContent, tags: d.querySelectorAll('b').length }; });
    ok(desc.text === '<b>粗</b>' && desc.tags === 0, `an entry note is shown as typed, not run as page code: 「${desc.text}」`);
    await p.evaluate(() => App.nav('shop')); await sleep(700);
    const shop = await p.textContent('#shop-content-shop').catch(() => '');
    ok(!/ServiceNow/.test(shop) && /登录后就能用/.test(shop), `the demo shop no longer mentions ServiceNow: 「${shop.trim()}」`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n2. 经典 from 设置, kept on this phone only');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00');
    await cssReady(p);
    await p.evaluate(() => App.showSettings()); await sleep(500);
    ok(await p.$eval('#cfg-look', s => s.value) === 'ui3d', '设置 › 外观风格 shows 新外观');
    await p.selectOption('#cfg-look', 'classic'); await sleep(400);
    const toast = await p.textContent('.toast').catch(() => '');
    ok(/经典/.test(toast) && /这台手机/.test(toast), `says it is this phone only: 「${toast.trim()}」`);
    await p.evaluate(() => App.closeModal('modal-settings'));
    let l = await looks(p);
    ok(!l.on && !l.plus && l.fab && l.navSettings && !l.leftovers, `经典: 月末结算 button and 设置 tab back, nothing left over ${JSON.stringify(l)}`);
    await p.reload(); await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
    await p.evaluate(() => { document.getElementById('start-page')?.remove(); App.demoMode(); }); await sleep(1200);
    l = await looks(p);
    ok(!l.on && !l.plus && !(await p.evaluate(() => !!document.getElementById('ui3d-css-pre'))), 'still 经典 after a reload — the opening screen too');
    const other = await phone(browser, '2026-11-15T15:00:00+08:00');
    await cssReady(other.p);
    ok((await looks(other.p)).on, "the partner's phone keeps the new look");
    await other.ctx.close();
    await p.evaluate(() => App.showSettings()); await sleep(400);
    await p.selectOption('#cfg-look', 'ui3d');
    ok(await cssReady(p), 'and 新外观 comes straight back when picked');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n3. The ＋ sheet saves a real entry');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d' });
    await cssReady(p);
    const geo = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const plus = r('.u3d-add'), t = r('#nav-tables'), h = r('#nav-history'), ind = r('.u3d-nav-ind'), home = r('#nav-home');
      return { between: plus.left > t.right - 2 && plus.right < h.left + 2, size: Math.round(plus.width), ind: Math.abs((ind.left + ind.width / 2) - (home.left + home.width / 2)) < 3 };
    });
    ok(geo.between && geo.size >= 56, `＋ sits between 积分表 and 历史, ${geo.size}px`);
    ok(geo.ind, 'the lit pill sits under 主页');
    await p.evaluate(() => App.nav('history')); await sleep(700);
    const moved = await p.evaluate(() => { const i = document.querySelector('.u3d-nav-ind').getBoundingClientRect(), h = document.getElementById('nav-history').getBoundingClientRect(); return Math.abs((i.left + i.width / 2) - (h.left + h.width / 2)) < 3; });
    ok(moved, 'and slides to 历史 when it is picked');
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')));
    await p.evaluate(() => App.nav('home')); await sleep(500);

    await p.click('.u3d-add'); await sleep(600);
    let sheet = await p.evaluate(() => ({ cats: [...document.querySelectorAll('.u3d-cat')].map(b => b.textContent), who: document.querySelector('.u3d-seg [data-c].on')?.dataset.c, go: document.querySelector('.u3d-go').textContent }));
    ok(sheet.cats.length === 5 && !sheet.cats.some(c => /停用/.test(c)) && sheet.who === 'char1', `opens on the person the home switch points at, active 加分 items only (${sheet.cats.length}): ${sheet.cats.join(' ')}`);
    await p.click('.u3d-seg [data-s="-1"]'); await sleep(200);
    sheet = await p.evaluate(() => [...document.querySelectorAll('.u3d-cat')].map(b => b.textContent));
    ok(sheet.length === 3 && sheet.every(c => /-\d/.test(c)), `扣分 lists the 扣分 items: ${sheet.join(' ')}`);
    await p.click('.u3d-seg [data-s="1"]'); await p.click('.u3d-seg [data-c="char2"]'); await sleep(150);
    await p.click('.u3d-cat:has-text("惊喜礼物")'); await sleep(150);
    ok(/记给 YY · \+15 分/.test(await p.textContent('.u3d-go')), `the button says what will happen: 「${await p.textContent('.u3d-go')}」`);
    const before = await p.textContent('#char2-score-badge');
    await p.screenshot({ path: `${SHOTS}/ui3d_01_sheet.png` });
    await p.click('.u3d-go'); await sleep(1800);
    const d = await stored(p);
    const e = d.entries['2026-11'].find(x => x.catName === '惊喜礼物' && x.charId === 'char2' && x.date === '2026-11-15');
    ok(e && e.pts === 15 && e.month === '2026-11' && e.catId === 'c2', `stored like a tile entry: ${JSON.stringify(e && { cat: e.catName, who: e.charId, pts: e.pts, date: e.date })}`);
    const after = await p.textContent('#char2-score-badge');
    ok(parseInt(after, 10) === parseInt(before, 10) + 15, `YY's score ${before} → ${after}`);
    ok(await p.evaluate(() => !document.querySelector('.u3d-sheet') && !document.querySelector('.u3d-fly')), 'the sheet closed and the flying number landed');
    ok(await p.evaluate(() => /惊喜礼物/.test(document.querySelector('.entry-day-items .entry-item')?.textContent || '')), 'the new entry is first in 本月记录');

    // several at once: tick, untick, one from each tab, one save
    await p.click('.u3d-add'); await sleep(600);
    ok(await p.evaluate(() => document.querySelector('.u3d-go').disabled && !document.querySelector('.u3d-cat.on')), `nothing is ticked on opening, and the button waits: 「${await p.textContent('.u3d-go')}」`);
    const names = await p.evaluate(() => [...document.querySelectorAll('.u3d-cat')].map(b => ({ id: b.dataset.id, pts: parseInt(b.querySelector('b').textContent, 10) })));
    await p.click('.u3d-cat >> nth=0'); await p.click('.u3d-cat >> nth=1'); await p.click('.u3d-cat >> nth=2'); await sleep(100);
    ok(await p.evaluate(() => !!document.querySelector('.u3d-sheet.on') && document.querySelectorAll('.u3d-cat.on').length === 3), 'three taps tick three tiles and the sheet stays open');
    await p.click('.u3d-cat >> nth=1'); await sleep(100);
    ok(await p.evaluate(() => document.querySelectorAll('.u3d-cat.on').length === 2), 'tapping a ticked tile unticks it');
    await p.click('.u3d-seg [data-s="-1"]'); await sleep(150);
    const negPts = await p.evaluate(() => parseInt(document.querySelector('.u3d-cat b').textContent, 10));
    await p.click('.u3d-cat >> nth=0'); await sleep(100);
    const want = names[0].pts + names[2].pts + negPts;
    const goTxt = await p.textContent('.u3d-go');
    ok(goTxt.includes('3 项') && goTxt.includes(`${want > 0 ? '+' : ''}${want} 分`), `the button adds up both tabs: 「${goTxt}」 (want ${want})`);
    ok(await p.evaluate(() => document.querySelector('.u3d-seg [data-s="1"] i')?.textContent === '2' && document.querySelector('.u3d-seg [data-s="-1"] i')?.textContent === '1'), 'each tab shows how many are ticked on it');
    const tick = await p.evaluate(() => { const b = document.querySelector('.u3d-cat.on'), a = getComputedStyle(b, '::after'); return a.content.includes('✓') && a.pointerEvents === 'none'; });
    ok(tick, 'a ticked tile carries a ✓ that does not take taps');
    await p.screenshot({ path: `${SHOTS}/ui3d_01b_multi.png` });
    const who2 = await p.evaluate(() => document.querySelector('.u3d-seg [data-c].on').dataset.c);
    const sBefore = parseInt(await p.textContent(`#${who2}-score-badge`), 10);
    const nBefore = (await stored(p)).entries['2026-11'].length;
    await p.click('.u3d-go'); await sleep(2000);
    const dm = await stored(p), added = dm.entries['2026-11'].slice().sort((a, b) => (a.id > b.id ? 1 : -1));
    ok(dm.entries['2026-11'].length === nBefore + 3, `three entries stored (${nBefore} → ${dm.entries['2026-11'].length})`);
    ok(new Set(dm.entries['2026-11'].map(x => x.id)).size === dm.entries['2026-11'].length, 'each with its own id');
    ok(dm.entries['2026-11'].every(x => x.month === String(x.date).slice(0, 7)), 'every one labelled with the month of its date');
    const sAfter = parseInt(await p.textContent(`#${who2}-score-badge`), 10);
    ok(sAfter === sBefore + want, `the score moved by the total: ${sBefore} → ${sAfter}`);
    ok(await p.evaluate(() => !document.querySelector('.u3d-sheet')), 'and the sheet closed after the save');

    await p.click('.u3d-add'); await sleep(500);
    await p.click('.u3d-seg [data-c="char1"]'); await p.click('.u3d-more'); await sleep(700);
    ok(await p.evaluate(() => document.getElementById('modal-add')?.classList.contains('open')), '「写备注或换日期」 opens the full form');
    ok(await p.evaluate(() => App._bdayTest().me === 'char1' && document.getElementById('active-for-chip')?.textContent.trim() === 'CS'), '…for the person chosen in the sheet');
    await p.evaluate(() => App.closeModal('modal-add'));
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n4. 月末结算 in the score card, entry actions on tap, tilt, count-up');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d' });
    await cssReady(p);
    let chip = await p.evaluate(() => { const c = document.querySelector('.score-card-header .u3d-settle-chip'); return c && { due: c.classList.contains('due'), h: c.getBoundingClientRect().height }; });
    ok(chip && !chip.due, 'the 月末结算 chip is in the score card, quiet mid-month');
    await p.click('.u3d-settle-chip'); await sleep(700);
    ok(await p.evaluate(() => [...document.querySelectorAll('.modal-overlay.open')].some(m => /结算/.test(m.textContent))), 'tapping it opens 月末结算');
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')));

    const row = await p.evaluate(() => { const e = document.querySelector('#entry-e1'); const v = (s) => getComputedStyle(e.querySelector(s)).display !== 'none'; return { edit: v('.entry-edit'), del: v('.entry-delete') }; });
    ok(!row.edit && !row.del, '✏️ and 🗑️ are hidden until a row is tapped');
    await p.evaluate(() => document.querySelector('#entry-e1').scrollIntoView({ block: 'center' }));
    await p.click('#entry-e1 .entry-cat'); await sleep(500);
    const open = await p.evaluate(() => { const e = document.querySelector('#entry-e1'); const r = (s) => e.querySelector(s).getBoundingClientRect(); return { open: e.classList.contains('u3d-open'), edit: [r('.entry-edit').width, r('.entry-edit').height], del: [r('.entry-delete').width, r('.entry-delete').height] }; });
    ok(open.open && open.edit[0] >= 40 && open.edit[1] >= 40 && open.del[0] >= 40, `tapping shows them at 40×40 or more: ${JSON.stringify(open)}`);
    await p.click('#entry-e1 .entry-edit'); await sleep(600);
    ok(await p.evaluate(() => document.getElementById('modal-add')?.classList.contains('open')), '✏️ still opens the edit form');
    await p.evaluate(() => App.closeModal('modal-add'));
    await p.click('#entry-e2 .entry-cat'); await sleep(300);
    ok(await p.evaluate(() => !document.querySelector('#entry-e1').classList.contains('u3d-open') && document.querySelector('#entry-e2').classList.contains('u3d-open')), 'opening another row closes the first');

    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    const hero = await p.$('.together-hero'); const hb = await hero.boundingBox();
    await p.mouse.move(hb.x + hb.width * .85, hb.y + hb.height * .2); await p.mouse.down(); await sleep(150);
    const tilt = await p.evaluate(() => { const h = document.querySelector('.together-hero'); return { cls: h.classList.contains('u3d-tilt'), ry: h.style.getPropertyValue('--u-ry'), tr: getComputedStyle(h).transform }; });
    await p.mouse.up(); await sleep(700);   // a press on the hero is also a tap: it opens 我们的时光, as it should
    const back = await p.evaluate(() => { const h = document.querySelector('.together-hero'); return { cls: h.classList.contains('u3d-tilt'), tr: getComputedStyle(h).transform }; });
    ok(tilt.cls && parseFloat(tilt.ry) > 2 && tilt.tr !== 'none', `pressing a card tilts it toward the finger (rotateY ${tilt.ry})`);
    ok(!back.cls && back.tr === 'none', 'and it springs back flat when let go');
    await p.evaluate(() => App.closeLovePage && App.closeLovePage()); await sleep(400);
    ok(await p.textContent('#together-days') === String(692), 'the days count up and land on the real number (692)');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const { p, ctx } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d', data: seed({ older: true }) });
    await cssReady(p);
    ok(await p.evaluate(() => document.querySelector('.u3d-settle-chip')?.classList.contains('due')), 'the chip glows while an older month is still open');
    await ctx.close();
  }
  {
    const { p, ctx } = await phone(browser, '2026-11-28T15:00:00+08:00', { look: 'ui3d' });
    await cssReady(p);
    ok(await p.evaluate(() => document.querySelector('.u3d-settle-chip')?.classList.contains('due')), '…and in the last three days of the month');
    await ctx.close();
  }

  console.log('\n5. 小窝: the light never takes a tap; furniture never drifts');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d' });
    await cssReady(p);
    await p.evaluate(() => App.showPetHome()); await sleep(1500);
    const layers = await p.evaluate(() => [...document.querySelectorAll('#pet-room > [data-u3d]')].map(n => ({ cls: n.className, pe: getComputedStyle(n).pointerEvents })));
    ok(layers.length === 2 && layers.every(l => l.pe === 'none'), `window light and haze are laid, and let taps through: ${JSON.stringify(layers)}`);
    const hit = await p.evaluate(() => {
      const body = document.querySelector('.pet-stage .pet-body') || document.querySelector('.pet-stage svg');
      const b = body.getBoundingClientRect(), el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const piece = [...document.querySelectorAll('.decor-piece')].find(x => !x.classList.contains('pet-wall-item')) || document.querySelector('.decor-piece');
      const pr = piece.getBoundingClientRect(), pel = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height * .6);
      return { pet: !!el?.closest('.pet-stage'), piece: !!pel?.closest('.decor-piece') };
    });
    ok(hit.pet && hit.piece, `呆呆 and the furniture still take the tap: ${JSON.stringify(hit)}`);
    const room = await (await p.$('#pet-room')).boundingBox();
    await p.mouse.move(room.x + room.width * .9, room.y + room.height * .5); await sleep(150);
    const par = await p.evaluate(() => ({ px: document.getElementById('pet-room').style.getPropertyValue('--u-px'), piece: getComputedStyle(document.querySelector('.decor-piece')).translate, pet: getComputedStyle(document.querySelector('.pet-stage')).translate }));
    ok(parseFloat(par.px) > .5 && (par.piece === 'none' || par.piece === '0px'), `moving over the room shifts depth (--u-px ${par.px}) and no decor piece moves (${par.piece})`);
    await p.evaluate(() => App.selectDecor(0)); await sleep(100);
    await p.mouse.move(room.x + room.width * .2, room.y + room.height * .5); await sleep(150);
    ok(await p.evaluate(() => document.getElementById('pet-room').style.getPropertyValue('--u-px') === ''), 'with a piece selected for arranging, the room holds still');
    await p.evaluate(() => App.selectDecor(null));
    await p.screenshot({ path: `${SHOTS}/ui3d_02_room.png` });
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n6. Turning it off leaves nothing behind');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d' });
    await cssReady(p);
    await p.click('.u3d-add'); await sleep(400);
    await p.evaluate(() => document.querySelector('.u3d-sheet-veil').click()); await sleep(600);
    await p.evaluate(() => { App.showSettings(); }); await sleep(400);
    await p.selectOption('#cfg-look', 'classic'); await sleep(400);
    const l = await looks(p);
    ok(!l.on && !l.plus && l.fab && l.navSettings && l.leftovers === 0, `back to 经典 exactly ${JSON.stringify(l)}`);
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('#entry-e1 .entry-edit')).display !== 'none'), '✏️ and 🗑️ show on every row again');
    ok(await p.evaluate(() => localStorage.getItem('look')) === 'classic', 'and the choice is remembered');
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n7. Reduced motion');
  {
    const { p, ctx } = await phone(browser, '2026-11-15T15:00:00+08:00', { look: 'ui3d', reduced: true });
    await cssReady(p);
    ok(await p.textContent('#together-days') === '692', 'the number is simply there');
    const hb = await (await p.$('.together-hero')).boundingBox();
    await p.mouse.move(hb.x + 10, hb.y + 10); await p.mouse.down(); await sleep(100);
    ok(await p.evaluate(() => !document.querySelector('.together-hero').classList.contains('u3d-tilt')), 'no tilt');
    await p.mouse.up(); await sleep(200);
    await p.evaluate(() => App.closeLovePage && App.closeLovePage()); await sleep(300);
    await p.click('.u3d-add'); await sleep(200); await p.click('.u3d-cat:has-text("陪伴时光")'); await p.click('.u3d-go'); await sleep(500);
    ok(await p.evaluate(() => !document.querySelector('.u3d-fly') && !document.querySelector('.u3d-confetti')), 'no flying number, no confetti');
    ok((await stored(p)).entries['2026-11'].some(e => e.catName === '陪伴时光' && e.date === '2026-11-15'), '…and the entry is still saved');
    await ctx.close();
  }

  console.log('\n8. Both themes, three widths');
  for (const [w, h] of [[360, 760], [390, 844], [820, 1180]]) {
    for (const dark of [false, true]) {
      const { p, ctx, errs } = await phone(browser, dark ? '2026-11-15T21:30:00+08:00' : '2026-11-15T15:00:00+08:00', { look: 'ui3d', w, h, dark });
      await cssReady(p);
      const m = await p.evaluate(() => {
        const nav = document.querySelector('.bottom-nav').getBoundingClientRect(), plus = document.querySelector('.u3d-add').getBoundingClientRect();
        return { sw: document.documentElement.scrollWidth, vw: innerWidth, plusIn: plus.left >= nav.left && plus.right <= nav.right, theme: document.documentElement.dataset.theme };
      });
      await p.click('.u3d-add'); await sleep(650);
      const sh = await p.evaluate(() => { const s = document.querySelector('.u3d-sheet').getBoundingClientRect(); return { fits: s.left >= 0 && s.right <= innerWidth + 1 && s.top >= 0, cats: [...document.querySelectorAll('.u3d-cat')].every(b => b.scrollWidth <= b.clientWidth + 1) }; });
      ok(m.sw <= m.vw && m.plusIn && sh.fits && sh.cats && !errs.length, `${w}px ${m.theme}: no sideways scroll, ＋ inside the bar, sheet fits ${JSON.stringify({ ...m, ...sh })}`);
      if (w === 390) await p.screenshot({ path: `${SHOTS}/ui3d_03_${dark ? 'dark' : 'light'}_sheet.png` });
      await p.evaluate(() => document.querySelector('.u3d-sheet-veil').click()); await sleep(500);
      if (w === 390) await p.screenshot({ path: `${SHOTS}/ui3d_04_${dark ? 'dark' : 'light'}_home.png` });
      await ctx.close();
    }
  }

  console.log('\n9. The opening screen and the login card');
  async function loginPhone({ look = '', dark = false, w = 390, h = 844, saved = '', reduced = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2,
      colorScheme: dark ? 'dark' : 'light', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.clock.setFixedTime(new Date(dark ? '2026-11-15T21:30:00+08:00' : '2026-11-15T15:00:00+08:00'));
    await p.route(/open-meteo|supabase\.co/, r => r.abort());
    await p.addInitScript(([look, saved]) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.clear(); localStorage.setItem('music_on', 'false');
      if (look) localStorage.setItem('look', look);
      if (saved) localStorage.setItem('sn_username', saved);
      sessionStorage.setItem('seeded', '1');
    }, [look, saved]);
    await p.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    const early = await p.evaluate(() => ({ cls: document.documentElement.classList.contains('ui3d'), pre: !!document.getElementById('ui3d-css-pre') }));
    await p.waitForFunction(() => typeof App !== 'undefined' && typeof startApp === 'function');
    await sleep(900);
    return { p, ctx, errs, early };
  }
  const toLogin = async (p) => { await p.evaluate(() => startApp()); await p.waitForFunction(() => !document.getElementById('start-page') && !document.getElementById('setup-overlay').classList.contains('hidden')); await sleep(800); };
  // three bugs on the login card, checked in both looks
  for (const [look, dark] of [['classic', false], ['classic', true], ['ui3d', false], ['ui3d', true]]) {
    const { p, ctx, errs } = await loginPhone({ dark, look });
    await toLogin(p);
    ok(await p.textContent('#sn-connect-btn') === '登录', `${look} ${dark ? 'dark' : 'light'}: a phone that never logged in says 「登录」, not 「继续 (…) →」`);
    await p.evaluate(() => App.switchTab('register')); await sleep(300);
    ok(await p.evaluate(() => document.getElementById('tab-register').classList.contains('on') && !document.getElementById('tab-login').classList.contains('on')), '…the 注册 tab lights up');
    await p.click('.reg-char-opt.c2'); await sleep(200);
    const opt = await p.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return { l: .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]), a: m[3] ?? 1 }; };
      const l = document.querySelector('.reg-char-opt.c1'), cs = getComputedStyle(l), card = getComputedStyle(document.querySelector('.setup-card'));
      const txt = lum(cs.color), bg = lum(cs.backgroundColor), under = lum(card.backgroundColor);
      const back = bg.a < .5 ? under.l : bg.l;                       // a translucent tint sits on the card
      const ratio = (Math.max(txt.l, back) + .05) / (Math.min(txt.l, back) + .05);
      const inp = document.getElementById('reg-pair-code'), ph = getComputedStyle(inp, '::placeholder');
      const ctx2 = document.createElement('canvas').getContext('2d'); ctx2.font = `${ph.fontWeight} ${ph.fontSize} ${ph.fontFamily}`;
      const need = ctx2.measureText(inp.placeholder).width + (parseFloat(ph.letterSpacing) || 0) * inp.placeholder.length;
      const room = inp.clientWidth - parseFloat(getComputedStyle(inp).paddingLeft) - parseFloat(getComputedStyle(inp).paddingRight);
      return { ratio: +ratio.toFixed(1), pair: !document.getElementById('reg-pair-wrap').classList.contains('hidden'), fits: need <= room, need: Math.round(need), room: Math.round(room) };
    });
    ok(opt.ratio >= 4.5, `${look} ${dark ? 'dark' : 'light'}: 他 / 她 are readable (${opt.ratio}:1)`);
    ok(opt.pair && opt.fits, `picking 她 shows the pair code, and its hint fits (${opt.need}px in ${opt.room}px)`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const { p, ctx } = await loginPhone({ saved: 'CS' });
    await toLogin(p);
    ok(await p.textContent('#sn-connect-btn') === '继续 (CS) →', 'a phone that knows its account still says 「继续 (CS) →」');
    await p.fill('#sn-username', 'someone'); await sleep(100);
    ok(await p.textContent('#sn-connect-btn') === '登录', '…and 「登录」 once another name is typed');
    await ctx.close();
  }
  // the new look
  {
    const { p, ctx, errs, early } = await loginPhone();
    ok(early.cls && early.pre, 'a fresh phone gets the new look stamped before app.js runs, so the opening screen never flashes the old one');
    const sp = await p.evaluate(() => ({ title: getComputedStyle(document.querySelector('.sp-title')).fontSize, logo: document.querySelector('.sp-paw-logo').getBoundingClientRect().width }));
    ok(sp.title === '40px' && sp.logo >= 60, `opening screen: big title and a glossy icon ${JSON.stringify(sp)}`);
    await p.screenshot({ path: `${SHOTS}/ui3d_05_start.png` });
    await toLogin(p);
    const card = await p.evaluate(() => ({ glass: getComputedStyle(document.querySelector('.setup-card')).backdropFilter, logo: document.querySelector('.setup-logo').offsetWidth }));   // offsetWidth: the icon floats with a tilt, so its box changes by a pixel
    ok(/blur/.test(card.glass) && card.logo === 76, `login card is frosted glass under a 76px app icon ${JSON.stringify(card)}`);
    await p.click('#tab-register'); await sleep(650);
    const pill = await p.evaluate(() => { const t = getComputedStyle(document.getElementById('login-tabs'), '::before').transform; return { reg: document.getElementById('login-tabs').classList.contains('on-reg'), t }; });
    ok(pill.reg && pill.t !== 'none', `the tab pill slides to 注册 (${pill.t})`);
    await p.click('.reg-char-opt.c2'); await sleep(250);
    ok(await p.evaluate(() => document.querySelector('input[value="char2"]').checked && !document.getElementById('reg-pair-wrap').classList.contains('hidden')), 'tapping the 她 card picks 她 and asks for the pair code');
    await p.click('.reg-char-opt.c1'); await sleep(250);
    ok(await p.evaluate(() => document.querySelector('input[value="char1"]').checked && document.getElementById('reg-pair-wrap').classList.contains('hidden')), 'tapping 他 hides it again');
    await p.screenshot({ path: `${SHOTS}/ui3d_06_register.png` });
    await p.click('#tab-login'); await sleep(400);
    await p.fill('#sn-username', 'nobody'); await p.fill('#sn-password', 'wrong'); await p.click('#sn-connect-btn');
    await p.waitForFunction(() => document.getElementById('sn-login-err').textContent.trim() !== '', null, { timeout: 15000 }).catch(() => {});
    const err = await p.evaluate(() => { const e = document.getElementById('sn-login-err'); return { text: e.textContent.trim(), bg: getComputedStyle(e).backgroundColor }; });
    ok(err.text && err.bg !== 'rgba(0, 0, 0, 0)', `a failed login shows its message in a tinted pill: 「${err.text}」`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }
  {
    const { p, ctx } = await loginPhone({ look: 'ui3d', reduced: true });
    await toLogin(p);
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.setup-logo')).animationName === 'none'), 'reduced motion: the icon holds still');
    await ctx.close();
  }
  for (const [w, h] of [[360, 760], [390, 844], [820, 1180]]) {
    for (const dark of [false, true]) {
      const { p, ctx, errs } = await loginPhone({ look: 'ui3d', dark, w, h });
      const a = await p.evaluate(() => { const b = document.querySelector('.sp-btn').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, btn: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; });
      await toLogin(p);
      await p.click('#tab-register'); await sleep(400);
      const c = await p.evaluate(() => { const r = document.querySelector('.setup-card').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, card: r.left >= 0 && r.right <= innerWidth }; });
      ok(a.sw <= w && a.btn && c.sw <= w && c.card && !errs.length, `${w}px ${dark ? 'dark' : 'light'}: opening screen and login card fit ${JSON.stringify({ ...a, ...c })}`);
      if (w === 390) await p.screenshot({ path: `${SHOTS}/ui3d_07_login_${dark ? 'dark' : 'light'}.png` });
      await ctx.close();
    }
  }

  console.log('\n10. Sheets and pages in the new look; the quicker 自定义记分 form');
  {
    const { p, ctx, errs } = await phone(browser, '2026-11-15T15:00:00+08:00');
    await cssReady(p);
    await p.evaluate(() => App.openAddModal()); await sleep(700);
    const f = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#modal-add .u3d-chips .u3d-chip')].map(c => c.textContent.trim()), on: document.querySelector('#modal-add .u3d-chips .on')?.dataset.v, sel: document.getElementById('add-cat-select').value,
      glass: getComputedStyle(document.querySelector('#modal-add .modal-sheet')).borderTopLeftRadius, step: document.querySelectorAll('#modal-add .u3d-step').length }));
    ok(f.chips.length === 8 && f.on === f.sel && !f.chips.some(c => /停用/.test(c)), `categories are chips, the picked one lit (${f.chips.length}): ${f.chips.slice(0, 3).join(' · ')}…`);
    await p.click('#modal-add .u3d-chip:has-text("忘记约定")'); await sleep(150);
    ok(await p.evaluate(() => document.getElementById('add-cat-select').value === 'c8' && document.getElementById('add-pts').value === '-10'), 'tapping a chip picks the category and fills its points (−10)');
    await p.click('#modal-add .u3d-step:last-of-type'); await p.click('#modal-add .u3d-step:last-of-type'); await p.click('#modal-add .u3d-step:first-of-type');
    ok(await p.$eval('#add-pts', i => i.value) === '-9', '− and ＋ nudge the points (−10 → −9)');
    await p.click('#modal-add .u3d-days .u3d-chip:has-text("昨天")'); await sleep(150);
    ok(await p.$eval('#add-date', i => i.value) === '2026-11-14', '「昨天」 sets the date to 11-14');
    await p.screenshot({ path: `${SHOTS}/ui3d_08_addform.png` });
    await p.evaluate(() => App.submitEntry()); await sleep(1500);
    const e = (await stored(p)).entries['2026-11'].find(x => x.catId === 'c8' && x.date === '2026-11-14' && x.pts === -9);
    ok(!!e && e.month === '2026-11' && e.charId === 'char1', `saved as chosen: ${JSON.stringify(e && { cat: e.catName, pts: e.pts, date: e.date })}`);
    // edit keeps what it was
    await p.evaluate(() => App.openEditEntryModal('e1')); await sleep(600);
    const ed = await p.evaluate(() => ({ on: document.querySelector('#modal-add .u3d-chips .on')?.textContent.trim(), pts: document.getElementById('add-pts').value, days: document.querySelectorAll('#modal-add .u3d-days').length, steps: document.querySelectorAll('#modal-add .u3d-step').length }));
    ok(/惊喜礼物/.test(ed.on || '') && ed.pts === '15' && ed.days === 1 && ed.steps === 2, `editing opens on the entry's own category and points, controls not doubled ${JSON.stringify(ed)}`);
    await p.evaluate(() => App.closeModal('modal-add'));
    // sheets
    await p.evaluate(() => App.nav('tables')); await sleep(900);
    const tier = await p.evaluate(() => { const i = document.querySelector('.tier-icon'); return i ? Math.round(i.getBoundingClientRect().width) : 0; });
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')));
    ok(f.glass === '28px' && f.step === 2, 'sheets are rounded glass');
    // turning the look off puts the plain form back
    await p.evaluate(() => App.setLook('classic')); await sleep(300);
    await p.evaluate(() => App.openAddModal()); await sleep(500);
    const off = await p.evaluate(() => ({ chips: document.querySelectorAll('#modal-add .u3d-chip').length, wrap: !!document.querySelector('#modal-add .u3d-stepper'), sel: getComputedStyle(document.getElementById('add-cat-select')).opacity, h: document.getElementById('add-cat-select').getBoundingClientRect().height }));
    ok(off.chips === 0 && !off.wrap && off.sel === '1' && off.h > 30, `经典 gets the dropdown and plain number box back ${JSON.stringify(off)}`);
    ok(!errs.length, 'no errors ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
