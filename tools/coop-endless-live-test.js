// ♾️ 一直走下去 on TWO phones (CLAUDE.md §7.33): two logged-in pages on a throwaway couple, the local app, the LIVE
// backend and its real live channel. The run is the host's; what is checked is what the couple would notice:
// 一起出发 starts the same 段 on both, a 段 walked shows on both and the next one starts on both by itself, the
// hearts carry over the same on both, the guest can hurry it on, stopping on either phone stops both, another run
// starts from either phone, the hearts running out ends it on both, both keep the record, and a 段 sent with a
// piece nobody knows is ignored.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-endless-live-test.js
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
const st = (p) => T(p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; return { state: G.state, role: N.role, n: N.n, lv: G.L && G.L.i, hp: G.hp, d: G.espec && G.espec.endless, rs: G.run && G.run.rs, seq: G.espec ? G.espec.seq.join(' ') : '', w: G.espec && G.espec.world }; });
const panel = (p) => T(p, () => { const el = document.querySelector('.cg-veil:not([hidden]) .cg-panel'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
const until = async (fn, ms = 8000, every = 120) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(every); } return false; };
// each phone walks its own character to the house; the host's phone says when you are both in
const atDoor = (X, dx) => T(X.p, (dx) => { const T2 = CoopGames.test, G = T2.G, d = G.L.door; T2.tp(G.meIdx, d.x + dx, d.y - 1.18); }, dx);
const both = async (A, B, f, ms = 9000) => until(async () => f(await st(A.p), await st(B.p)), ms);
const same = (a, b) => a.n === b.n && a.seq === b.seq && a.d === b.d && a.rs === b.rs;

(async () => {
  const s = Date.now(), u1 = `t${s}_ce1`, u2 = `t${s}_ce2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2', petName: '豆豆', petSpecies: 'dog' } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 760, h: 520 });

  console.log('\n1. Both open 一起回家; 一起出发 starts the same 段 on both phones');
  for (const X of [A, B]) { await X.p.evaluate(() => App.openCoop('home')); await X.p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 }); }
  const found = await until(async () => (await T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent))) && (await T(B.p, () => /A1 也在这里/.test(document.querySelector('.cg-home').textContent))), 12000);
  ok(found, 'each screen says the other is here');
  ok(await T(A.p, () => document.querySelector('.cg-ego').textContent === '一起出发'), 'the endless card says 一起出发 on two phones');
  await A.p.click('.cg-ego');
  ok(await both(A, B, (a, b) => a.state === 'play' && b.state === 'play' && a.lv === -1 && b.lv === -1 && same(a, b)), 'both count down and start 段 1 together, built from the same pieces');
  let a = await st(A.p), b = await st(B.p);
  ok(a.role === 'host' && b.role === 'guest' && a.d === 1 && a.hp === 5 && b.hp === 5, `A1's phone runs the run; 段 1 on both, five hearts (world ${a.w}, ${a.seq.split(' ').length} pieces)`);
  const rs1 = a.rs;

  console.log('\n2. A 段 walked shows on both, and the next starts on both by itself');
  await atDoor(B, 0.3); await sleep(400); await atDoor(A, -0.6);
  ok(await until(async () => /走完第 1 段/.test(await panel(A.p)) && /走完第 1 段/.test(await panel(B.p)), 8000), 'both reach the house: 「走完第 1 段！」 on both phones');
  const pa = await panel(A.p), pb = await panel(B.p);
  ok(pa.match(/下一段：[^继]*/)[0] === pb.match(/下一段：[^继]*/)[0], `both say what comes next: 「${pa.match(/下一段：[^继]*/)[0].trim()}」`);
  ok(await both(A, B, (a, b) => a.state === 'play' && b.state === 'play' && a.d === 2 && same(a, b), 9000), 'the host\'s countdown starts 段 2 on both, the same pieces on both');

  console.log('\n3. The hearts carry over, the same on both');
  await T(A.p, () => { CoopGames.test.G.hp = 2; });   // the host's phone keeps the hearts
  await sleep(700);
  ok((await st(B.p)).hp === 2, 'a heart lost shows on the guest too (2 left)');
  await atDoor(B, 0.3); await sleep(400); await atDoor(A, -0.6);
  ok(await until(async () => /❤ \+1，现在有 3 颗心/.test(await panel(A.p)) && /❤ \+1，现在有 3 颗心/.test(await panel(B.p)), 8000), '段 2 walked with 2 hearts: 「❤ +1，现在有 3 颗心」 on both');
  // the guest doesn't have to wait for the countdown
  await B.p.click('.cg-panel [data-a="go"]');
  ok(await both(A, B, (a, b) => a.state !== 'result' && a.d === 3 && b.d === 3 && same(a, b), 3500), '继续走 on the guest\'s phone starts 段 3 at once, on both');
  ok(await both(A, B, (a, b) => a.state === 'play' && b.state === 'play' && a.hp === 3 && b.hp === 3), '…with those 3 hearts on both');

  console.log('\n4. Stopping on either phone stops both; another run from either phone');
  await B.p.click('[data-r="pause"]');
  ok(await until(async () => (await st(A.p)).state === 'paused', 4000), 'the guest pauses: the host is paused too');
  await B.p.click('.cg-panel [data-a="end"]');
  ok(await until(async () => /歇一歇/.test(await panel(A.p)) && /歇一歇/.test(await panel(B.p)), 6000), '结束这一趟 on the guest\'s phone: 「歇一歇」 on both');
  ok(/一起走完了 2 段/.test(await panel(A.p)) && /一起走完了 2 段/.test(await panel(B.p)), 'both count the same: 2 段 walked');
  const recs = await Promise.all([A, B].map(X => T(X.p, () => (CoopGames.test.G.save.endless || {}).d)));
  ok(recs[0] === 2 && recs[1] === 2, `both keep the record for their own person (${recs.join(' / ')})`);
  await B.p.click('.cg-panel [data-a="again"]');
  ok(await both(A, B, (a, b) => a.state === 'play' && b.state === 'play' && a.d === 1 && b.d === 1 && same(a, b) && a.rs !== rs1, 10000), '再走一次 on the guest\'s phone: the host starts a new run, 段 1 on both, new pieces');

  console.log('\n5. The hearts running out ends the run on both');
  await T(A.p, () => { CoopGames.test.G.hp = 1; CoopGames.test.hurt(); });
  ok(await until(async () => /心用完了/.test(await panel(A.p)) && /心用完了/.test(await panel(B.p)), 6000), '「心用完了」 on both phones');

  console.log('\n6. Never trust the wire');
  await B.p.click('.cg-panel [data-a="menu"]').catch(() => {}); await sleep(400);
  const before = await st(B.p);
  // a 段 with a piece nobody knows, straight onto the couple's channel the way a host sends one
  const sent = await T(A.p, () => App._coopApiTest().live.send('cg', { t: 'go', v: 6, n: 123456, lv: -1, who: 0, cp: null, e: { rs: 5, d: 1, hp: 5, he: 0, t: 0, ws: [0], w: 0, seq: ['start', 'nope_piece', 'goal'], ch: 0, dk: 0 } }));
  await sleep(1500);
  const after = await st(B.p);
  ok(sent !== false && after.n === before.n && after.state === before.state && (await T(B.p, () => !!document.querySelector('.cg-home:not([hidden])'))), 'a 段 with a piece nobody knows is ignored: the other phone stays where it was');

  ok(!A.errs.length && !B.errs.length, `no page errors ${A.errs.concat(B.errs).slice(0, 3).join(' | ')}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
