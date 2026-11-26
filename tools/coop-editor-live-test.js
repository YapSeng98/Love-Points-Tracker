// 🛠️ 关卡编辑 on TWO phones (CLAUDE.md §7.33): two logged-in pages on a throwaway couple, the local app, the LIVE
// backend. A1 makes a level, clears it and sends it — it goes up in A1's own progress save; B2's 一起回家 screen lists
// it; B2 picks it with A1 there and both phones play the same level; how they did comes back to A1's card; a made
// level with rows that are not a level is ignored by the other phone.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-editor-live-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves a couple behind)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const FN = 'https://yvllstktmjoedfsgojgs.supabase.co/functions/v1';
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
async function phone(browser, user, { w = 900, h = 560 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo/, r => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await p.evaluate(() => { document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary(); });
  return { p, ctx, errs };
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const st = (p) => T(p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; return { state: G.state, role: N.role, n: N.n, lv: G.L && G.L.i, chunk: G.L ? G.L.chunks.map(c => c.ch.id).join(' ') : '', name: G.uspec && G.uspec.name }; });
const panel = (p) => T(p, () => { const el = document.querySelector('.cg-veil:not([hidden]) .cg-panel'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
const until = async (fn, ms = 8000, every = 150) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(every); } return false; };
const atDoor = (X, dx) => T(X.p, (dx) => { const T2 = CoopGames.test, G = T2.G, d = G.L.door; T2.tp(G.meIdx, d.x + dx, d.y - 1.18); }, dx);

(async () => {
  const s = Date.now(), u1 = `t${s}_ed1`, u2 = `t${s}_ed2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2' } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 760, h: 520 });

  console.log('\n1. A1 makes a level, clears it and sends it');
  await A.p.evaluate(() => App.openCoop('home')); await A.p.waitForFunction(() => document.querySelector('.cg-home .cg-maker'), null, { timeout: 15000 });
  await A.p.click('.cg-maker [data-a="newlv"]'); await sleep(300);
  await T(A.p, () => { const X = CoopGames.test.ed; X.tool('.'); for (const c of [12, 13, 14]) for (const r of [11, 12]) X.paint(c, r); X.tool('*'); X.paint(13, 8); X.paint(24, 9); X.tool('p'); X.paint(30, 10); });
  await A.p.fill('.cg-ed-name', '跳过小河'); await sleep(400);
  await A.p.click('.cg-ed [data-e="play"]'); await sleep(500);
  ok(await T(A.p, () => CoopGames.test.G.mode !== 'online' && CoopGames.test.G.L.i === -2), '试玩 is on this phone only (A1 plays both), even with 各用自己的手机 chosen');
  await A.p.click('.cg-panel [data-a="go"]'); await sleep(200);
  await T(A.p, () => { const T2 = CoopGames.test, G = T2.G, d = G.L.door; T2.tp(0, d.x - .9, d.y - 1.18); T2.tp(1, d.x - .2, d.y - 1.18); });
  await A.p.waitForFunction(() => /自己通关了/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 6000 });
  await A.p.click('.cg-panel [data-a="send"]'); await sleep(300);
  ok(await T(A.p, () => CoopGames.test.G.mode === 'online'), '…and back in the editor, 各用自己的手机 is chosen again');
  await A.p.click('.cg-ed [data-e="back"]'); await sleep(300);
  const up = await until(async () => { const g = await call('/game-save?game=play&slot=char1', { token: r1.data.accessToken }); return g.data && g.data.data && Array.isArray(g.data.data.lv) && g.data.data.lv.some(l => l.n === '跳过小河' && l.s > 0); }, 12000, 700);
  ok(up, 'it went up in A1\'s own progress save (game-save play, char1), sent');

  console.log('\n2. B2 sees it, and they play it together');
  await B.p.evaluate(() => App.openCoop('home')); await B.p.waitForFunction(() => document.querySelector('.cg-home .cg-maker'), null, { timeout: 15000 });
  const listed = await until(async () => T(B.p, () => [...document.querySelectorAll('[data-pplay]')].some(b => b.closest('.cg-mrow').textContent.includes('跳过小河'))), 12000);
  ok(listed, 'B2\'s 一起回家 lists 「跳过小河」 under A1 做给你的关');
  const found = await until(async () => (await T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent))) && (await T(B.p, () => /A1 也在这里/.test(document.querySelector('.cg-home').textContent))), 15000);
  ok(found, 'each screen says the other is here');
  await B.p.click('[data-pplay]');
  ok(await until(async () => { const a = await st(A.p), b = await st(B.p); return a.state === 'play' && b.state === 'play' && a.lv === -2 && b.lv === -2 && a.n === b.n && a.chunk === b.chunk; }, 12000), 'both phones count down and start the same made level');
  const a1 = await st(A.p), b1 = await st(B.p);
  ok(b1.role === 'host' && a1.role === 'guest' && a1.name === '跳过小河', 'B2 picked it, so B2\'s phone runs it; A1\'s phone built it from what came over the channel');
  await atDoor(A, -.6); await sleep(400); await atDoor(B, .3);
  ok(await until(async () => /回到家啦/.test(await panel(A.p)) && /回到家啦/.test(await panel(B.p)), 9000), 'both reach the house: 「回到家啦！」 on both');
  ok(/A1 会看到你们的成绩/.test(await panel(B.p)) && /你做的/.test(await panel(A.p)), 'B2 is told A1 will see how they did; A1\'s phone knows it is A1\'s own level');

  console.log('\n3. How they did comes back to A1');
  await B.p.click('.cg-panel [data-a="menu"]'); await A.p.click('.cg-panel [data-a="menu"]').catch(() => {}); await sleep(500);
  const back = await until(async () => { await T(A.p, () => CoopGames.test.ed.loadPartner()); await sleep(1200); return T(A.p, () => /B2 通关了/.test(document.querySelector('.cg-maker').textContent)); }, 20000, 1500);
  ok(back, `A1's card says B2 cleared it: 「${await T(A.p, () => (document.querySelector('.cg-maker').textContent.match(/B2 通关了[^改]*/) || [''])[0].trim())}」`);

  console.log('\n4. Never trust the wire');
  const before = await st(B.p);
  const sent = await T(A.p, () => App._coopApiTest().live.send('cg', { t: 'go', v: 7, n: 424242, lv: -2, who: 0, cp: null, u: { id: 'ux', n: 'bad', w: 0, r: 'not|a|level', by: 'cs' } }));
  await sleep(1500);
  const after = await st(B.p);
  ok(sent !== false && after.n === before.n && await T(B.p, () => !!document.querySelector('.cg-home:not([hidden])')), 'a made level whose rows are not a level is ignored by the other phone');

  ok(!A.errs.length && !B.errs.length, `no page errors ${A.errs.concat(B.errs).slice(0, 3).join(' | ')}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
