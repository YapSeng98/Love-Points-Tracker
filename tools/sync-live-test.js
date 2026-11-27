// One person, two devices: what you do on one is on the other. Local app, LIVE backend, a throwaway couple.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/sync-live-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
//
// CS logs in on a phone and on an iPad. 一起回家's levels, stars and best times, the levels that have paid
// their first-clear point, and the 接零食 / 翻牌 records follow CS from one to the other (game-save 'play',
// CS's own slot); a level paid on one device doesn't pay again on the other; changes made on each device
// separately merge (the faster time, every star); the garden in 我们的家 is the same on both; and CS's
// second device is not mistaken for YY.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const FN = 'https://yvllstktmjoedfsgojgs.supabase.co/functions/v1';
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const WHEN = '2026-11-25T15:00:00+08:00', TODAY = '2026-11-25';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
async function device(browser, user, { w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.setFixedTime(new Date(WHEN));
  await p.route(/open-meteo/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('hm_hinted', '1'); } catch (e) {} });
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await p.evaluate(() => { document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary(); });
  return { p, ctx, errs };
}
const J = (p, k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);

(async () => {
  const s = Date.now(), u1 = `t${s}_sy1`, u2 = `t${s}_sy2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  const T = r1.data.accessToken;
  await call('/config', { method: 'PUT', token: T, body: { charName1: 'A1', charName2: 'B2', petSpecies: 'dog', petName: '测试狗', petBase: 0 } });

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const phone = await device(browser, u1), pad = await device(browser, u1, { w: 820, h: 1180 });

  console.log('\n1. Progress made on the phone');
  await phone.p.evaluate(() => {
    localStorage.setItem('cg_save3_cs', JSON.stringify({ unlocked: 5, best: { M1: { t: 61.5, sm: [true, false, true], h: 2 }, M2: { t: 80, sm: [false, true, false], h: 1 } } }));
    localStorage.setItem('mg_best_catch_char1', JSON.stringify({ lv: 3, n: 42 }));
  });
  const paid1 = await phone.p.evaluate(() => App._cgPayTest('coop', 'M1', '1-1 樱花小路 通关'));
  ok(paid1.pts === 1, `clearing 1-1 for the first time pays +1 on the phone (${JSON.stringify(paid1)})`);
  await phone.p.evaluate(() => App._progTest.sync()); await sleep(500);
  const saved = await call('/game-save?game=play&slot=char1', { token: T });
  ok(saved.data.rev >= 1 && saved.data.data.coop.unlocked === 5 && saved.data.data.paid.coop.includes('M1') && saved.data.data.mg.catch.lv === 3,
    `…and it is saved in CS's account (rev ${saved.data.rev}: 5 levels open, 1-1 paid, 接零食 3 关)`);

  console.log('\n2. The iPad, which has never played');
  ok(!(await J(pad.p, 'cg_save3_cs')) && !(await J(pad.p, 'mg_best_catch_char1')), 'nothing about the games on the iPad yet');
  await pad.p.evaluate(() => App.openGames()); await sleep(2500);
  const coopPad = await J(pad.p, 'cg_save3_cs');
  ok(coopPad && coopPad.unlocked === 5 && coopPad.best.M1.t === 61.5 && coopPad.best.M1.sm[2] === true, `opening 小游戏 on the iPad brings 一起回家's levels and stars (${JSON.stringify(coopPad && coopPad.best.M1)})`);
  const best = await J(pad.p, 'mg_best_catch_char1');
  ok(best && best.lv === 3 && best.n === 42, `…and the 接零食 record (${JSON.stringify(best)})`);
  ok(await pad.p.evaluate(() => /过了 3 关 · 接到 42 个/.test(document.querySelector('.mg-root')?.textContent || '')), '…which the games list shows');
  const again = await pad.p.evaluate(() => App._cgPayTest('coop', 'M1', '1-1 樱花小路 通关'));
  ok(again.pts === 0 && again.why === 'again', `1-1 doesn't pay a second time on the iPad (${JSON.stringify(again)})`);
  await pad.p.evaluate(() => App.closeGames());
  await pad.p.evaluate(() => App.openCoop('home'));
  await pad.p.waitForFunction(() => !!document.querySelector('.cg-home'), null, { timeout: 20000 }).catch(() => {});
  const coopState = await pad.p.evaluate(() => window.CoopGames && { unlocked: CoopGames.test.G.save.unlocked, m1: CoopGames.test.G.save.best.M1 });
  ok(coopState && coopState.unlocked === 5 && coopState.m1 && coopState.m1.sm.filter(Boolean).length === 2, `一起回家 on the iPad opens with CS's levels (5 open, 1-1 ★★): ${JSON.stringify(coopState)}`);
  await pad.p.evaluate(() => CoopGames.close()); await sleep(300);

  console.log('\n3. Each device plays on its own; then they meet');
  await pad.p.evaluate(() => { const v = JSON.parse(localStorage.getItem('cg_save3_cs')); v.best.M2 = { t: 72.3, sm: [false, true, false], h: 1 }; v.unlocked = 6; localStorage.setItem('cg_save3_cs', JSON.stringify(v)); });
  await phone.p.evaluate(() => { const v = JSON.parse(localStorage.getItem('cg_save3_cs')); v.best.M2 = { t: 90, sm: [true, true, true], h: 3 }; localStorage.setItem('cg_save3_cs', JSON.stringify(v)); });
  const paid3 = await pad.p.evaluate(() => App._cgPayTest('coop', 'M3', '1-3 通关'));
  ok(paid3.pts === 1, '1-3 cleared first on the iPad pays there');
  await Promise.all([pad.p.evaluate(() => App._progTest.sync()), phone.p.evaluate(() => App._progTest.sync())]); await sleep(400);
  await Promise.all([pad.p.evaluate(() => App._progTest.sync()), phone.p.evaluate(() => App._progTest.sync())]); await sleep(400);
  const fin = await call('/game-save?game=play&slot=char1', { token: T });
  const m2 = fin.data.data.coop.best.M2;
  ok(m2.t === 72.3 && m2.sm.every(Boolean) && m2.h === 3 && fin.data.data.coop.unlocked === 6, `the saved record keeps the best of both: the iPad's time, the phone's stars (${JSON.stringify(m2)}, ${fin.data.data.coop.unlocked} open)`);
  ok(fin.data.data.paid.coop.includes('M1') && fin.data.data.paid.coop.includes('M3'), `both devices' paid levels: ${fin.data.data.paid.coop.join(' ')}`);
  const pm2 = (await J(phone.p, 'cg_save3_cs')).best.M2, padm2 = (await J(pad.p, 'cg_save3_cs')).best.M2;
  const sameRec = (x) => x && x.t === m2.t && x.h === m2.h && JSON.stringify(x.sm) === JSON.stringify(m2.sm);
  ok(sameRec(pm2) && sameRec(padm2), `and both devices now have it (phone ${JSON.stringify(pm2)}, iPad ${JSON.stringify(padm2)})`);
  ok(await phone.p.evaluate(() => App._cgPaidKeysTest('coop').includes('M3')), 'the phone knows 1-3 has paid (so it won\'t pay it again)');
  const yy = await call('/game-save?game=play&slot=char1', { token: r2.data.accessToken });
  ok(yy.status === 200 && yy.data.data.coop.unlocked === 6, 'YY can see how far CS has got');
  const yyw = await call('/game-save', { method: 'PUT', token: r2.data.accessToken, body: { game: 'play', slot: 'char1', rev: fin.data.rev, data: { v: 1 } } });
  ok(yyw.status === 403, 'but YY can\'t change it');

  console.log('\n3b. 🏎️ 卡丁车 / 💣 烟花炸弹: records and paid tracks follow you too (CLAUDE.md §7.37)');
  await phone.p.evaluate(() => localStorage.setItem('kb_prog_cs', JSON.stringify({ kart: { sakura: { place: 1, time: 95.2 }, cup: 1 }, bomb: { garden: { stars: 2, time: 120 } } })));
  await pad.p.evaluate(() => localStorage.setItem('kb_prog_cs', JSON.stringify({ kart: { sakura: { place: 2, time: 90.1 }, beach: { place: 1, time: 101 } }, bomb: { garden: { stars: 3, time: 140 } } })));
  const kp = await phone.p.evaluate(() => App._cgPayTest('kart', 'K:sakura', '樱花小镇 第一名'));
  ok(kp.pts === 1, `a first win on 樱花小镇 pays on the phone (${JSON.stringify(kp)})`);
  await Promise.all([pad.p.evaluate(() => App._progTest.sync()), phone.p.evaluate(() => App._progTest.sync())]); await sleep(400);
  await Promise.all([pad.p.evaluate(() => App._progTest.sync()), phone.p.evaluate(() => App._progTest.sync())]); await sleep(400);
  const kbs = await call('/game-save?game=play&slot=char1', { token: T });
  const kb = kbs.data.data.kb || {};
  const kbOk = (x) => x && x.kart && x.kart.sakura && x.kart.sakura.place === 1 && x.kart.sakura.time === 90.1 && x.kart.beach && x.kart.beach.place === 1 && x.kart.cup === 1
    && x.bomb && x.bomb.garden && x.bomb.garden.stars === 3 && x.bomb.garden.time === 120;
  ok(kbs.status === 200 && kbOk(kb), `the server keeps the best of both: 1st place with the iPad's faster time, the phone's cup, the iPad's 3 stars with the phone's faster clear (${JSON.stringify(kb)})`);
  ok((kbs.data.data.paid.kart || []).includes('K:sakura') && kbs.data.data.coop.unlocked === 6, `the paid track is saved beside 一起回家's progress, which is untouched (${JSON.stringify(kbs.data.data.paid.kart)})`);
  ok(kbOk(await J(phone.p, 'kb_prog_cs')) && kbOk(await J(pad.p, 'kb_prog_cs')), 'and both devices now have those records');
  const kpad = await pad.p.evaluate(() => App._cgPayTest('kart', 'K:sakura', '樱花小镇 第一名'));
  ok(kpad.pts === 0 && kpad.why === 'again', `樱花小镇 doesn't pay a second time on the iPad (${JSON.stringify(kpad)})`);

  console.log('\n4. 我们的家 on both devices');
  await phone.p.evaluate(() => App.openHome()); await phone.p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 20000 });
  await sleep(800);
  await phone.p.evaluate(() => HomeGame.test.act({ t: 'plant', pot: 0, seed: 'sunflower' }));
  await phone.p.waitForFunction(() => !HomeGame.test.state().pending, null, { timeout: 15000 });
  await pad.p.evaluate(() => App.openHome()); await pad.p.waitForFunction(() => !!(window.HomeGame && HomeGame.test.state()), null, { timeout: 20000 });
  await pad.p.waitForFunction(() => HomeGame.test.state().pots[0].seed === 'sunflower', null, { timeout: 10000 }).catch(() => {});
  ok((await pad.p.evaluate(() => HomeGame.test.state().pots[0].seed)) === 'sunflower', 'a sunflower planted on the phone is in the garden on the iPad');
  const id = await pad.p.evaluate(() => HomeGame.test.state().pots[0].id);
  await pad.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id);
  await pad.p.waitForFunction(() => !HomeGame.test.state().pending, null, { timeout: 15000 });
  await phone.p.evaluate(() => HomeGame.test.load()); await sleep(1500);
  const ph = await phone.p.evaluate(() => HomeGame.test.state());
  ok(ph.pots[0].stage === 1 && ph.pots[0].mine, 'watered on the iPad: the phone shows it watered by CS today');
  const again2 = await phone.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id);
  ok(again2 === false, '…so CS can\'t water it again from the phone today');
  await sleep(2500);
  ok(!(await phone.p.evaluate(() => HomeGame.test.state().partner.on)) && !(await pad.p.evaluate(() => HomeGame.test.state().partner.on)), 'CS\'s own second device is not taken for YY');

  ok(!phone.errs.length && !pad.errs.length, `no page errors ${JSON.stringify([phone.errs.slice(0, 2), pad.errs.slice(0, 2)])}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
