// 一起回家 and 默契拍拍 on TWO phones (CLAUDE.md §7.33): two logged-in pages on a
// throwaway couple, the local app, the LIVE backend and its real live channel.
// What is checked is what the couple would notice: they find each other, a
// level starts on both, each sees the other move, standing on a head works
// across the phones, a button held on one phone opens the gate on the other,
// a heart picked up is gone on both, a box needs both to push, the seesaw
// throws the partner, the guest's stomp hurts the big cloud, pause and leaving
// reach the other phone, both get their points, and the beat game agrees.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-live-test.js
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
const st = (p) => T(p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; return { state: G.state, mode: G.mode, me: G.meIdx, role: N.role, n: N.n, lv: G.L && G.L.i, hp: G.hp, hearts: G.hearts,
  P: G.players.map(q => ({ x: q.x, y: q.y, g: q.grounded, gk: q.ground && q.ground.kind, dead: q.dead > 0 })), chan: G.chanOn ? Array.from(G.chanOn) : [], box: G.L && G.L.boxes.map(b => b.x), boss: G.L && G.L.boss && { hp: G.L.boss.hp, st: G.L.boss.st, x: G.L.boss.x, y: G.L.boss.y } }; });
const chunk = (p, id) => T(p, (id) => { const c = CoopGames.test.G.L.chunks.find(c => c.ch.id === id); return c && { x0: c.x0, w: c.ch.w }; }, id);
const tpMe = (p, x, y) => T(p, ([x, y]) => { const T2 = CoopGames.test, G = T2.G; T2.tp(G.meIdx, x, y); }, [x, y]);
const until = async (fn, ms = 8000, every = 120) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(every); } return false; };
async function startLevel(A, B, i) {
  await A.p.click(`.cg-worlds [data-w="${Math.floor(i / 4)}"]`);
  await A.p.click(`.cg-lv[data-i="${i}"]`);
  const both = await until(async () => { const a = await st(A.p), b = await st(B.p); return a.state === 'play' && b.state === 'play' && a.lv === i && b.lv === i && a.n === b.n; }, 9000);
  return both;
}
async function backToHome(X) { await T(X.p, () => { const T2 = CoopGames.test; if (T2.stage() && !T2.stage().hidden) T2.closeStage(); }); await sleep(300); }

(async () => {
  const s = Date.now(), u1 = `t${s}_cg1`, u2 = `t${s}_cg2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2', petName: '豆豆', petSpecies: 'dog' } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 760, h: 520 });

  console.log('\n1. Both open 一起回家 and find each other');
  ok(await T(A.p, () => !App._liveTest().open), 'no live connection before the game opens');
  for (const X of [A, B]) { await X.p.evaluate(() => App.openCoop('home')); await X.p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 }); }
  ok((await st(A.p)).mode === 'online' && (await st(B.p)).mode === 'online', 'signed in: 各用自己的手机 is the default');
  const found = await until(async () => T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent)) && T(B.p, () => /A1 也在这里/.test(document.querySelector('.cg-home').textContent)), 12000);
  ok(found, 'each screen says the other is here');
  ok(await T(A.p, () => App._liveTest().joined), 'the couple\'s private live channel is open while the game is');
  ok(await T(A.p, () => [...document.querySelectorAll('.cg-lv')].every(b => !b.disabled)), 'two phones: every level can be picked');

  console.log('\n2. A1 picks 1-1: it starts on both phones');
  ok(await startLevel(A, B, 0), 'both phones count down and start the same level together');
  let a = await st(A.p), b = await st(B.p);
  ok(a.role === 'host' && b.role === 'guest' && a.me === 0 && b.me === 1, 'A1\'s phone runs the shared things; each phone moves its own character');

  console.log('\n3. Each sees the other move');
  await B.p.keyboard.down('ArrowRight'); await sleep(900); await B.p.keyboard.up('ArrowRight'); await sleep(700);
  a = await st(A.p); b = await st(B.p);
  ok(b.P[1].x > 5 && Math.abs(a.P[1].x - b.P[1].x) < 0.25 && Math.abs(a.P[1].y - b.P[1].y) < 0.25, `B2 walked to x=${b.P[1].x.toFixed(2)}; A1's phone shows B2 at ${a.P[1].x.toFixed(2)}`);
  await A.p.keyboard.down('ArrowRight'); await sleep(600); await A.p.keyboard.up('ArrowRight'); await sleep(700);
  a = await st(A.p); b = await st(B.p);
  ok(Math.abs(a.P[0].x - b.P[0].x) < 0.25, `…and the other way: A1 at ${a.P[0].x.toFixed(2)} here, ${b.P[0].x.toFixed(2)} on B2's phone`);
  // jumping shows too
  await B.p.keyboard.down('Space'); await sleep(250); const mid = await st(A.p); await B.p.keyboard.up('Space'); await sleep(900);
  ok(mid.P[1].y < 9.5, `a jump on B2's phone is a jump on A1's (B2 at y=${mid.P[1].y.toFixed(2)} mid-air)`);

  console.log('\n4. A heart picked up on one phone is gone on both');
  const flat = await chunk(A.p, 'P_flat');
  const hi = await T(B.p, (x0) => { const L = CoopGames.test.G.L; return L.items.findIndex(it => it.type === 'heart' && it.x > x0 && it.x < x0 + 10); }, flat.x0);
  const hx = await T(B.p, (i) => { const it = CoopGames.test.G.L.items[i]; return [it.x, it.y]; }, hi);
  await tpMe(B.p, hx[0] - 0.39, hx[1] - 0.5); await sleep(900);
  const gotA = await T(A.p, (i) => CoopGames.test.G.L.items[i].got, hi), gotB = await T(B.p, (i) => CoopGames.test.G.L.items[i].got, hi);
  a = await st(A.p); b = await st(B.p);
  ok(gotA && gotB, 'the heart B2 took is gone on A1\'s phone too');
  ok(a.hearts >= 1 && a.hearts === b.hearts, `the 💗 count agrees: ${a.hearts} / ${b.hearts}`);

  console.log('\n5. Standing on your partner\'s head, across two phones (the 1-1 wall)');
  const stk = await chunk(A.p, 'C_stack');
  await tpMe(A.p, stk.x0 + 5.1, 9.82); await sleep(700);
  await tpMe(B.p, stk.x0 + 5.1, 7.6); await sleep(900);
  b = await st(B.p); a = await st(A.p);
  ok(b.P[1].g && b.P[1].gk === 'player', 'B2, dropped above A1, lands on A1\'s head (on B2\'s phone)');
  ok(a.P[1].gk === 'player', '…and A1\'s phone knows B2 is standing on A1');
  await A.p.keyboard.press('Space'); await sleep(300);
  ok((await st(A.p)).P[0].g, 'A1 can\'t jump with someone on their head');
  await A.p.keyboard.down('ArrowLeft'); await sleep(350); await A.p.keyboard.up('ArrowLeft'); await sleep(700);
  a = await st(A.p); b = await st(B.p);
  ok(b.P[1].gk === 'player' && Math.abs(b.P[1].x - b.P[0].x) < 0.6, `A1 walks and carries B2 along (B2 ${b.P[1].x.toFixed(2)}, A1 ${b.P[0].x.toFixed(2)} on B2's phone)`);
  // B2 jumps from A1's head onto the wall and stands on its button: A1's gate opens
  await tpMe(A.p, stk.x0 + 5.1, 9.82); await sleep(600);
  await tpMe(B.p, stk.x0 + 6.2, 4.6); await sleep(1000);
  const gateA = await until(async () => (await st(A.p)).chan[(await T(A.p, (id) => CoopGames.test.G.L.chunks.findIndex(c => c.ch.id === id), 'C_stack'))] === 1, 3000);
  ok(gateA, 'B2 on the button on top of the wall opens the gate on A1\'s phone');
  await A.p.keyboard.down('ArrowRight'); await sleep(900); await A.p.keyboard.up('ArrowRight'); await sleep(300);
  a = await st(A.p);
  ok(a.P[0].x > stk.x0 + 8, `A1 walks through that gate (x ${a.P[0].x.toFixed(2)})`);

  console.log('\n6. Pause reaches the other phone');
  await A.p.keyboard.press('Escape'); await sleep(900);
  ok((await st(B.p)).state === 'paused' && /A1 按了暂停/.test(await T(B.p, () => document.querySelector('.cg-panel').textContent)), 'A1 pauses → B2\'s phone pauses and says who');
  await B.p.click('.cg-panel [data-a="go"]'); await sleep(900);
  ok((await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 'B2 taps 继续 → both play again');

  console.log('\n7. Home together: both get their points');
  const door = await T(A.p, () => CoopGames.test.G.L.door.x);
  await tpMe(A.p, door - 0.9, 9.82); await tpMe(B.p, door - 0.2, 9.82);
  const won = await until(async () => { const x = await st(A.p), y = await st(B.p); return (x.state === 'won' || x.state === 'result') && (y.state === 'won' || y.state === 'result'); }, 8000);
  ok(won, 'when both stand at the house, both phones win');
  await sleep(3500);
  const rows = (await call('/entries', { token: r1.data.accessToken })).data.filter(e => /一起回家/.test(e.desc || ''));
  ok(rows.some(e => e.charId === 'char1') && rows.some(e => e.charId === 'char2') && rows.every(e => e.pts === 1), `each phone paid its own person +1: ${rows.map(e => `${e.charId} +${e.pts}`).join(', ')}`);

  console.log('\n8. Two people, one box (4-1)');
  await T(B.p, () => { const b = document.querySelector('.cg-panel [data-a="next"]'); }, null);
  await backToHome(A); await backToHome(B); await sleep(800);
  ok(await startLevel(A, B, 12), '4-1 starts on both');
  const xp = await chunk(A.p, 'X_plate');
  await tpMe(A.p, xp.x0 + 1.2, 9.82); await tpMe(B.p, xp.x0 + 0.9, 9.82); await sleep(900);
  await A.p.keyboard.down('ArrowRight'); await sleep(1500);
  const alone = (await st(A.p)).box[0];
  ok(alone < xp.x0 + 2.3, `one person pushing: the box stays (${alone.toFixed(2)})`);
  await B.p.keyboard.down('ArrowRight'); await sleep(4500); await A.p.keyboard.up('ArrowRight'); await B.p.keyboard.up('ArrowRight'); await sleep(800);
  a = await st(A.p); b = await st(B.p);
  ok(a.box[0] >= xp.x0 + 7.9, `both pushing from two phones: the box reaches the button (${a.box[0].toFixed(2)})`);
  ok(Math.abs(a.box[0] - b.box[0]) < 0.15, `and it is in the same place on both phones (${a.box[0].toFixed(2)} / ${b.box[0].toFixed(2)})`);
  const xi = await T(A.p, (id) => CoopGames.test.G.L.chunks.findIndex(c => c.ch.id === id), 'X_plate');
  ok(a.chan[xi] === 1 && b.chan[xi] === 1, 'its button holds the gate open on both');

  console.log('\n9. The seesaw throws the partner (5-1)');
  await backToHome(A); await backToHome(B); await sleep(800);
  ok(await startLevel(A, B, 16), '5-1 starts on both');
  const ss = await chunk(A.p, 'N_seesaw');
  const px = await T(A.p, () => CoopGames.test.G.L.seesaws[0].px);
  await tpMe(A.p, px + 1.4, 9.0); await sleep(1200);
  ok((await st(A.p)).P[0].gk === 'seesaw', 'A1 stands on the low end');
  await tpMe(B.p, px - 2.2, 4.5); 
  const flew = await until(async () => (await st(A.p)).P[0].y < 6, 2500, 60);
  ok(flew, 'B2 lands hard on the high end on B2\'s phone → A1 is thrown up on A1\'s phone');
  await sleep(1500);
  a = await st(A.p);
  ok(a.P[0].g && a.P[0].y < 3, `…and lands on the high platform (y ${a.P[0].y.toFixed(2)})`);

  console.log('\n10. The guest\'s stomp hurts the big cloud (5-4)');
  await backToHome(A); await backToHome(B); await sleep(800);
  ok(await startLevel(A, B, 19), '5-4 starts on both');
  const bossC = await chunk(A.p, 'boss');
  await tpMe(A.p, bossC.x0 + 6, 9.82); await tpMe(B.p, bossC.x0 + 8, 9.82);
  const dip = await until(async () => { const y = await st(B.p); return y.boss && y.boss.st === 'dip' && y.boss.y > 6; }, 15000, 100);
  ok(dip, 'the cloud comes down on B2\'s phone too');
  const bb = (await st(B.p)).boss;
  await tpMe(B.p, bb.x + 1.1, bb.y - 2.2);
  const hurt = await until(async () => (await st(A.p)).boss.hp === 2, 3000, 60);
  ok(hurt, 'B2 lands on it on B2\'s phone → A1\'s phone (which runs the cloud) counts the hit');
  await sleep(500);
  ok((await st(B.p)).boss.hp === 2, '…and B2\'s phone shows 2 left');

  console.log('\n11. Leaving reaches the other phone');
  await T(B.p, () => CoopGames.test.closeStage()); await sleep(1200);
  ok((await st(A.p)).state === 'left' && /B2 离开了/.test(await T(A.p, () => document.querySelector('.cg-panel').textContent)), 'B2 leaves the level → A1\'s phone says so');
  await A.p.click('.cg-panel [data-a="menu"]'); await sleep(300);
  for (const X of [A, B]) await X.p.evaluate(() => CoopGames.close());
  await sleep(1500);
  ok(await T(A.p, () => !App._liveTest().open) && await T(B.p, () => !App._liveTest().open), 'with the games closed, no connection stays open');

  console.log('\n12. 默契拍拍 on two phones');
  for (const X of [A, B]) { await X.p.evaluate(() => App.openCoop('beat')); await X.p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 }); }
  const ready = await until(async () => T(A.p, () => /两部手机的时间对好了/.test(document.querySelector('.cg-home').textContent) && !document.querySelector('[data-a="go"]').disabled), 12000);
  ok(ready, 'both phones see each other and line up their clocks');
  const off = await T(B.p, () => CoopGames.test.BT.offRtt);
  ok(off < 600, `the round trip used for the clocks: ${Math.round(off)} ms`);
  // each phone taps its own pad, right on its own beat
  const tapPlan = () => { const BT = CoopGames.test.BT; const R = BT.run; R.beats.forEach((b) => setTimeout(() => CoopGames.test.beatTap(CoopGames.test.G.meIdx ? 'yy' : 'cs'), b.t - performance.now() + 4)); };
  await A.p.click('.cg-home [data-a="go"]');
  const started = await until(async () => T(B.p, () => !!CoopGames.test.BT.run), 3000, 50);
  ok(started, 'A1 presses 开始 → it starts on B2\'s phone too');
  await T(A.p, `(${tapPlan})()`); await T(B.p, `(${tapPlan})()`);
  await sleep(4 * 857 + 8 * 857 + 2200);
  const msgA = await T(A.p, () => document.querySelector('[data-r="msg"]').textContent), msgB = await T(B.p, () => document.querySelector('[data-r="msg"]').textContent);
  const scA = +(msgA.match(/默契 (\d+) 分/) || [])[1], scB = +(msgB.match(/默契 (\d+) 分/) || [])[1];
  ok(scA === scB && scA >= 55, `both phones give the same verdict: ${msgA} / ${msgB}`);
  await sleep(2500);
  const brows = (await call('/entries', { token: r1.data.accessToken })).data.filter(e => /默契拍拍/.test(e.desc || ''));
  ok(brows.some(e => e.charId === 'char1') && brows.some(e => e.charId === 'char2'), `a pass pays each person once: ${brows.map(e => e.charId).join(', ')}`);

  ok(!A.errs.length && !B.errs.length, `no page errors ${A.errs.concat(B.errs).slice(0, 3).join(' | ')}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
