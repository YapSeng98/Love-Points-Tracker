// 生日惊喜 on the REAL thing: the deployed site, the live backend, a throwaway
// couple, two phones.
//   node tools/live-birthday-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
//
// A1 (char1) prepares through the real UI five days before B2's birthday.
// Then the birthday "arrives": with the service key (tools/backup.local.json,
// like test-anniv.mjs) the birthday and the sealed row are moved to today —
// the one thing a test can't wait for. B2 logs in, the server says it is the
// day, the film plays, the coupon lands in the real 背包, A1 gets the receipt.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs');
const SITE = process.env.SITE || 'https://yapseng98.github.io/Love-Points-Tracker/';
const BASE = 'https://yvllstktmjoedfsgojgs.supabase.co', FN = `${BASE}/functions/v1`;
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const SERVICE = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'backup.local.json'), 'utf8')).serviceKey;
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
const service = (path, init = {}) => fetch(`${BASE}/rest/v1/${path}`, { ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } });
const sg = (days) => new Date(Date.now() + 8 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
const TODAY = sg(0), SOON = sg(5);
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const s = Date.now(), u1 = `t${s}_lb1`, u2 = `t${s}_lb2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  const T1 = r1.data.accessToken, T2 = r2.data.accessToken, match = r1.data.matchId;
  ok(match && match === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  const cfg = await call('/config', { method: 'PUT', token: T1, body: { mode: 'reward', rewardTarget: 100, punishThreshold: -80, startDate: '2024-12-24',
    charName1: 'A1', charName2: 'B2', petName: '测试呆呆', petSpecies: 'dog', birthday1: '1998-07-20', birthday2: SOON.slice(5) } });
  ok(cfg.status === 200, `B2's birthday set to ${SOON.slice(5)} (in 5 days)`);
  for (let i = 0; i < 3; i++) await call('/photos', { method: 'POST', token: T1, body: { image: PIXEL, caption: '', date: TODAY } });

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  async function phone(user) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
    await p.addInitScript(() => { if (localStorage.getItem('decor_seen') === null) localStorage.setItem('decor_seen', '[]'); });
    await p.goto(SITE + '?v=' + s);
    await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
    await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
    await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
    await p.click('#sn-connect-btn');
    const inOk = await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 }).then(() => true).catch(() => false);
    await sleep(3500);
    return { p, ctx, errs, inOk };
  }
  const card = (p) => p.evaluate(() => { const c = document.getElementById('bday-card'); return !c || c.classList.contains('hidden') ? '' : c.textContent.replace(/\s+/g, ' ').trim(); });

  console.log('\nA1 prepares (5 days before)');
  const A = await phone(u1);
  ok(A.inOk, 'logged in on the live site');
  await A.p.evaluate(() => App.selectChar && App.selectChar('char2')); await sleep(300);   // "adding points for B2" — must not confuse who A1 is
  let c = await card(A.p);
  ok(/B2 的生日还有 5 天/.test(c), `card, even with the home switch on B2: 「${c}」`);
  await A.p.click('#bday-card'); await sleep(2500);
  await A.p.click('[data-view="letter"]'); await sleep(300);
  await A.p.fill('[data-letter]', 'B2：\n生日快乐！这是一封测试信。'); await A.p.click('[data-done]'); await sleep(2500);
  await A.p.click('[data-view="coupon"]'); await sleep(300);
  await A.p.fill('[data-ctitle]', '测试券：一起去散步'); await A.p.click('[data-done]'); await sleep(2500);
  await A.p.click('[data-view="photos"]'); await sleep(500);
  const ids = await A.p.$$eval('[data-pid]', a => a.map(x => x.dataset.pid));
  for (const id of ids.slice(0, 3)) await A.p.click(`[data-pid="${id}"]`);
  await A.p.click('[data-done]'); await sleep(2500);
  await A.p.screenshot({ path: `${SHOTS}/live_bday_01_prep.png` });
  await A.p.click('[data-seal]'); await sleep(3000);
  const rows = await (await service(`surprises?match_id=eq.${match}&select=from_char,open_on,letter,coupon_title,photo_ids,tz_min`)).json();
  ok(rows.length === 1 && rows[0].from_char === 'char1' && rows[0].open_on === SOON && rows[0].coupon_title === '测试券：一起去散步' && rows[0].photo_ids.length === 3 && rows[0].tz_min === 480,
    `sealed on the server: ${JSON.stringify(rows.map(r => [r.from_char, r.open_on, r.coupon_title, r.photo_ids.length, r.tz_min]))}`);
  c = await card(A.p);
  ok(/已经封好/.test(c), `A1's card: 「${c}」`);
  const peek = await call(`/surprise?openOn=${SOON}&tz=480`, { token: T2 });
  ok(peek.data.theirs === null && peek.data.day === false, 'B2 asking the server early gets nothing');

  console.log('\n…the birthday arrives');
  await service(`config?match_id=eq.${match}`, { method: 'PATCH', body: JSON.stringify({ birthday_2: TODAY.slice(5) }) });
  await service(`surprises?match_id=eq.${match}`, { method: 'PATCH', body: JSON.stringify({ open_on: TODAY }) });

  console.log('\nB2 on the day');
  const B = await phone(u2);
  ok(B.inOk, 'partner logged in');
  const opened = await B.p.waitForFunction(() => !!(App._bdfState && App._bdfState()), null, { timeout: 15000 }).then(() => true).catch(() => false);
  let st = await B.p.evaluate(() => App._bdfState());
  ok(opened && st.real && st.order.join() === 'dark,wish,blow,name,letter,gift,photos,end', `the film opened by itself: ${st && st.order.join(' → ')}`);
  await sleep(1800);
  await B.p.screenshot({ path: `${SHOTS}/live_bday_02_film.png` });
  for (let g = 0; g < 12; g++) {
    st = await B.p.evaluate(() => App._bdfState());
    if (!st || st.scene === 'end') break;
    if (st.scene === 'letter') { await B.p.click('.bdf-sc.bdf-on [data-env]', { force: true }); await sleep(1300); }
    if (st.scene === 'gift') { for (let i = 0; i < 3; i++) { await B.p.click('.bdf-sc.bdf-on [data-gift]', { force: true }); await sleep(250); } await sleep(1000); }
    if (st.scene === 'blow') { await B.p.click('.bdf-sc.bdf-on [data-blow]'); await sleep(3000); continue; }
    await B.p.click('.bdf-sc.bdf-on .bdf-p'); await sleep(900);
  }
  st = await B.p.evaluate(() => App._bdfState());
  ok(st && st.scene === 'end' && st.opened, 'watched to the end; opening reported');
  await B.p.click('.bdf-sc.bdf-on .bdf-g'); await sleep(4000);
  const bag = (await call('/bag', { token: T2 })).data;
  const gifts = (bag || []).filter(b => b.sourceType === 'gift');
  ok(gifts.length === 1 && gifts[0].itemName === '测试券：一起去散步', `the coupon is in B2's real 背包 (${gifts.length})`);
  ok(await B.p.$('#bdf-tab') !== null, 'the 🎂 tab is on the edge');
  c = await card(B.p);
  ok(/你有一张生日券：测试券：一起去散步/.test(c), `B2's card: 「${c}」`);
  await B.p.screenshot({ path: `${SHOTS}/live_bday_03_home.png` });

  console.log('\nA1 the same day');
  await A.p.reload(); await A.p.waitForFunction(() => typeof App !== 'undefined' && App.connect); await sleep(5000);
  await A.p.evaluate(() => document.getElementById('start-page')?.remove());
  c = await card(A.p);
  ok(/B2 拆开了你准备的惊喜 ✓/.test(c), `A1's receipt: 「${c}」`);
  ok(await A.p.$('#bdf-root') === null && await A.p.$('#bdf-tab') === null, 'A1 gets no film and no tab — it is B2\'s day');
  await A.p.screenshot({ path: `${SHOTS}/live_bday_04_receipt.png` });

  ok(!A.errs.length && !B.errs.length, 'no errors on either phone ' + [...A.errs, ...B.errs].join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  process.exit(fail ? 1 : 0);
})();
