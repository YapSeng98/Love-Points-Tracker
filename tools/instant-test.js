// Things that answer at once (CLAUDE.md §7.4): points that move on the tap,
// sheets that open before the server answers, 继续 that doesn't load the
// couple twice. Each is checked where it could go wrong — a save the server
// holds back, refuses, or answers after a refresh already saw it.
// The local app, the LIVE backend, a throwaway couple:
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/instant-test.js
//   node supabase/cleanup-test-accounts.mjs --yes
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
const POST_ENTRY = (req) => /\/functions\/v1\/entries$/.test(req.url()) && req.method() === 'POST';

(async () => {
  const s = Date.now(), u1 = `t${s}_in1`, u2 = `t${s}_in2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  const T1 = r1.data.accessToken, T2 = r2.data.accessToken;
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: T1, body: { charName1: 'A1', charName2: 'B2', mode: 'reward', rewardTarget: 500 } });
  const catA = (await call('/categories', { method: 'POST', token: T1, body: { icon: '🍳', name: '做早餐', pts: 5, active: true } })).data.id;
  const catB = (await call('/categories', { method: 'POST', token: T1, body: { icon: '🧹', name: '做家务', pts: 8, active: true } })).data.id;
  await call('/rewards', { method: 'POST', token: T1, body: { icon: '🧋', name: '奶茶', minPts: 50, desc: '测试' } });
  const serverRows = async (pred) => ((await call('/entries', { token: T1 })).data || []).filter(pred);

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Singapore' });
  await ctx.route(/open-meteo/, r => r.abort());
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const login = async () => {
    await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
    await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
    await p.fill('#sn-username', u1); await p.fill('#sn-password', 'Pass123!');
    await p.click('#sn-connect-btn');
    await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
    await sleep(1500);
  };
  await p.goto(APP_URL);
  await login();
  const score = () => p.evaluate(() => App._scoreTest().c1);
  const toast = () => p.evaluate(() => document.querySelector('.toast')?.textContent || '');
  const clearToast = () => p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const localRows = () => p.evaluate(() => [...document.querySelectorAll('.entry-item')].filter(e => /^entry-e\d/.test(e.id)).length);
  // hold a save back: the server only hears it `ms` later
  const holdPosts = async (ms) => { await p.route(/functions\/v1\/entries$/, async r => { if (!POST_ENTRY(r.request())) return r.continue(); await sleep(ms); r.continue(); }); };
  const release = () => p.unroute(/functions\/v1\/entries$/);

  console.log('\n1. A tap moves the score before the server answers');
  let s0 = await score();
  await holdPosts(2500); await clearToast();
  const t0 = Date.now();
  await p.evaluate(id => { App.quickEntry(id); }, catA);
  await p.waitForFunction(b => App._scoreTest().c1 !== b, s0, { timeout: 2000 }).catch(() => {});
  const moved = Date.now() - t0;
  ok(await score() === s0 + 5 && moved < 1000, `the score moved +5 in ${moved} ms, with the save still held back`);
  ok(/做早餐 \+5/.test(await toast()), `said so at once: 「${await toast()}」`);
  const flying = await p.evaluate(() => App._inFlightTest());
  ok(flying.length === 1 && await localRows() === 1, 'the row is on the list under a local id while it saves');
  await clearToast();
  await p.evaluate(id => { App.openEditEntryModal(id); }, flying[0]);
  ok(/还在保存/.test(await toast()) && !(await p.evaluate(() => document.getElementById('modal-add').classList.contains('open'))), 'editing it waits for the real id (the server has never heard of a local one)');
  await clearToast();
  await p.evaluate(id => { App.deleteEntry(id); }, flying[0]);
  ok(/还在保存/.test(await toast()) && !(await p.evaluate(() => document.getElementById('modal-confirm')?.classList.contains('open'))), 'so does deleting it');
  await sleep(3500);
  ok((await p.evaluate(() => App._inFlightTest())).length === 0 && await localRows() === 0, 'once saved, it carries the server\'s id');
  ok(await score() === s0 + 5, `…and still counts once (${await score()})`);
  ok((await serverRows(e => e.catId === catA)).length === 1, 'the server has exactly one');
  await release();

  console.log('\n2. A refresh that lands mid-save neither loses nor doubles it');
  s0 = await score();
  await holdPosts(2500);
  await p.evaluate(id => { App.quickEntry(id); }, catB);
  await sleep(300);
  await p.evaluate(() => { App.nav('home'); });                    // refresh() while the save is out
  ok(await score() === s0 + 8, `a refresh mid-save keeps it (${await score()} = ${s0} + 8)`);
  await sleep(3500); await release();
  ok(await score() === s0 + 8, `and after the save it is still +8 once (${await score()})`);
  // the hard one: the server has the row, the answer is late, and a refresh sees the row first
  s0 = await score();
  await p.route(/functions\/v1\/entries$/, async r => { if (!POST_ENTRY(r.request())) return r.continue(); const resp = await r.fetch(); await sleep(2500); r.fulfill({ response: resp }); });
  await p.evaluate(id => { App.quickEntry(id); }, catA);
  await sleep(1200);                                          // saved on the server by now
  await p.evaluate(() => { App.nav('home'); });
  await sleep(3000); await release(); await sleep(1500);
  ok(await score() === s0 + 5, `a refresh that saw the row before its answer came back still counts it once (${await score()} = ${s0} + 5)`);
  const ids = await p.evaluate(() => [...document.querySelectorAll('.entry-item')].map(e => e.id));
  ok(new Set(ids).size === ids.length, 'no row is drawn twice');

  console.log('\n3. A save the server refuses is taken back');
  s0 = await score(); await clearToast();
  await p.route(/functions\/v1\/entries$/, r => POST_ENTRY(r.request()) ? r.fulfill({ status: 500, body: '{"error":"boom"}' }) : r.continue());
  await p.evaluate(id => { App.quickEntry(id); }, catA);
  await sleep(1500);
  ok(await score() === s0, `the score went back (${await score()})`);
  ok(/记录失败/.test(await toast()), `and it says so: 「${await toast()}」`);
  ok(await localRows() === 0 && (await p.evaluate(() => App._inFlightTest())).length === 0, 'nothing is left behind on the list');
  await p.unroute(/functions\/v1\/entries$/);
  // two picked, one refused
  s0 = await score(); await clearToast();
  let n = 0;
  await p.route(/functions\/v1\/entries$/, r => POST_ENTRY(r.request()) && n++ === 0 ? r.fulfill({ status: 500, body: '{"error":"boom"}' }) : r.continue());
  await p.evaluate(([a, b]) => { App.quickEntries([a, b]); }, [catA, catB]);
  await sleep(1500);
  const after = await score();
  ok(after === s0 + 5 || after === s0 + 8, `two picked, one refused: only the saved one counts (${s0} → ${after})`);
  ok(/1 项没记上/.test(await toast()), `「${await toast()}」`);
  await p.unroute(/functions\/v1\/entries$/);

  console.log('\n4. 签到');
  s0 = await score(); await clearToast();
  await holdPosts(2500);
  await p.evaluate(() => { App.openCheckin(); App.doCheckin(); });
  await sleep(250);
  ok(await score() === s0 + (new Date().getDay() === 0 ? 5 : 2) || await score() > s0, 'the check-in counts at once');
  // 首页's 今天 folds the 签到 row into 「✓ CS 已签到」 the moment it is tapped (§7.36)
  ok(await p.evaluate(() => !document.getElementById('checkin-banner') && [...document.querySelectorAll('#today-card .td-chip')].some(c => /已签到/.test(c.textContent))), 'the card says 已签到 straight away');
  await clearToast();
  await p.evaluate(() => { App.doCheckin(); });
  ok(/已经签到/.test(await toast()), 'a second tap while it saves is turned away');
  await sleep(3500); await release();
  ok((await serverRows(e => /签到/.test(e.catName) && e.charId === 'char1')).length === 1, 'one check-in on the server');
  await p.evaluate(() => App.closeModal('modal-checkin'));

  console.log('\n5. A refused 自定义记分 gives the form back with the note');
  await p.route(/functions\/v1\/entries$/, r => POST_ENTRY(r.request()) ? r.fulfill({ status: 500, body: '{"error":"boom"}' }) : r.continue());
  await p.evaluate(() => { App.openAddModal(); });
  await sleep(300);
  await p.evaluate(() => { document.getElementById('add-pts').value = '3'; document.getElementById('add-desc').value = 'fake note to keep'; });
  await p.evaluate(() => { App.submitEntry(); });
  await sleep(1500);
  const form = await p.evaluate(() => ({ open: document.getElementById('modal-add').classList.contains('open'), desc: document.getElementById('add-desc').value }));
  ok(form.open && form.desc === 'fake note to keep', `the sheet is back with the note (${JSON.stringify(form)})`);
  await p.unroute(/functions\/v1\/entries$/);
  await p.evaluate(() => App.closeModal('modal-add'));

  console.log('\n6. Sheets open before the server answers');
  await p.route(/functions\/v1\/(rewards|punishments)/, async r => { await sleep(2000); r.continue(); });
  await call('/rewards', { method: 'POST', token: T2, body: { icon: '🎬', name: '看电影', minPts: 150, desc: '测试' } });   // the partner adds one meanwhile
  const ts = Date.now();
  await p.evaluate(() => { App.nav('tables'); });   // 积分 › 奖惩表 (§7.36)
  await p.waitForFunction(() => !document.getElementById('pt-rules').hidden && document.querySelectorAll('#modal-tables-content .tier-row').length > 0, null, { timeout: 3000 });
  const opened = Date.now() - ts;
  ok(opened < 400, `奖惩表 open in ${opened} ms with the server held back 2 s`);
  ok(await p.evaluate(() => document.querySelectorAll('#modal-tables-content .tier-row').length) === 1, 'showing what the phone had');
  await sleep(2800);
  ok(await p.evaluate(() => document.querySelectorAll('#modal-tables-content .tier-row').length) === 2, 'and the partner\'s new reward arrives on the open pane');
  await p.unroute(/functions\/v1\/(rewards|punishments)/);
  await p.evaluate(() => App.nav('home'));

  console.log('\n7. 历史 never says "none" before it knows');
  await p.route(/functions\/v1\/history/, async r => { await sleep(3000); r.continue(); });
  await p.goto(APP_URL); await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', u1); await p.fill('#sn-password', 'Pass123!'); await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await p.evaluate(() => { App.nav('history'); });
  await sleep(150);
  const h1 = await p.evaluate(() => document.getElementById('history-content').textContent);
  ok(/加载中/.test(h1) && !/还没有/.test(h1), `before the history arrives it says 加载中, not 还没有 (「${h1.trim()}」)`);
  await sleep(4000);
  ok(/还没有历史记录/.test(await p.evaluate(() => document.getElementById('history-content').textContent)), 'then the real answer');
  await p.unroute(/functions\/v1\/history/);
  await p.evaluate(() => App.nav('home'));

  console.log('\n8. 继续 uses what loaded behind the splash');
  await p.goto(APP_URL); await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.waitForFunction(() => App._scoreTest().c1 > 0, null, { timeout: 20000 });   // the saved session, loaded behind the splash
  const calls = [];
  const watch = r => { if (/functions\/v1\//.test(r.url()) && r.method() !== 'OPTIONS') calls.push(r.url().replace(/.*functions\/v1\//, '').replace(/\?.*/, '')); };
  p.on('request', watch);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', u1); await p.fill('#sn-password', 'Pass123!');
  const tc = Date.now();
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  const took = Date.now() - tc;
  await sleep(2500); p.off('request', watch);
  ok(!calls.some(c => /^(config|categories|rewards|punishments)$/.test(c)), `no second load of the couple: ${calls.join(' ')}`);
  ok(calls[0] === 'auth-login', 'the password is still checked first');
  console.log(`     (继续 → home took ${took} ms)`);
  ok(await score() > 0, 'home shows the couple');

  console.log('\n9. A list asked for early is never served after a write');
  await p.route(/functions\/v1\/entries\?month/, (() => { let first = true; return r => { if (first) { first = false; return r.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'access-control-allow-origin': '*' } }); } return r.continue(); }; })());
  const seen = await p.evaluate(() => App._entriesAheadTest({ id: 'e' + Date.now(), catId: '', catName: '🧪 测试', icon: '🧪', pts: 1, desc: 'fake ahead ' + Date.now(), charId: 'char1', month: new Date().toISOString().slice(0, 7), date: new Date().toLocaleDateString('sv-SE') }));
  ok(seen, 'the early (now stale) list was dropped and the fresh one includes the write');
  await p.unroute(/functions\/v1\/entries\?month/);

  console.log('\n10. 情书 and the shop show what the phone has');
  await call('/letters', { method: 'POST', token: T2, body: { text: 'fake letter for the test', date: new Date().toLocaleDateString('sv-SE') } });
  await call('/shop', { method: 'POST', token: T1, body: { icon: '🧸', name: '小熊', desc: '测试', ptsCost: 30, active: true } });
  await p.evaluate(() => { App.showLetters(); });                       // first open fetches
  await p.waitForFunction(() => document.querySelectorAll('#letter-list .letter-card').length > 0, null, { timeout: 15000 });
  await p.evaluate(() => App.closeLetters());
  await p.route(/functions\/v1\/letters/, async r => { await sleep(2500); r.continue(); });
  await p.evaluate(() => { document.getElementById('letter-list').innerHTML = ''; App.showLetters(); });
  await sleep(150);
  ok(await p.evaluate(() => document.querySelectorAll('#letter-list .letter-card').length) === 1, '情书 opens with the letters already loaded, server held back');
  await sleep(3000); await p.unroute(/functions\/v1\/letters/);
  ok(await p.evaluate(() => document.querySelectorAll('#letter-list .letter-card').length) === 1, '…and the answer leaves them as they were');
  await p.evaluate(() => App.closeLetters());
  await p.evaluate(() => { App.nav('shop'); });
  await p.waitForFunction(() => document.querySelectorAll('#shop-content-shop .shop-item-card').length > 0, null, { timeout: 15000 });
  await p.evaluate(() => App.closeShop());
  await p.route(/functions\/v1\/shop$/, async r => { await sleep(2500); r.continue(); });
  await p.evaluate(() => { App.nav('shop'); });
  await sleep(150);
  const shop1 = await p.evaluate(() => ({ cards: document.querySelectorAll('#shop-content-shop .shop-item-card').length, spin: !!document.querySelector('#shop-content-shop .spinner') }));
  ok(shop1.cards === 1 && !shop1.spin, `the shop reopens on its items, no spinner (${JSON.stringify(shop1)})`);
  await sleep(3000); await p.unroute(/functions\/v1\/shop$/);
  await p.evaluate(() => App.closeShop());
  // a dead network on a first open says so, and offers to try again
  await p.goto(APP_URL); await login();
  await p.route(/functions\/v1\/shop$/, r => r.abort());
  await p.evaluate(() => { App.nav('shop'); });
  await sleep(1500);
  const dead = await p.evaluate(() => document.getElementById('shop-content-shop').textContent);
  ok(/网络不太好/.test(dead) && /再试一次/.test(dead) && !/SN|u_love/.test(dead), `offline shop: 「${dead.replace(/\s+/g, ' ').trim()}」`);
  await p.unroute(/functions\/v1\/shop$/);
  await p.evaluate(() => App.closeShop());

  ok(errs.length === 0, `no page errors ${errs.slice(0, 3).join(' | ')}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
