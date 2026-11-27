// 📖 故事模式 on TWO phones (CLAUDE.md §7.33): two logged-in pages on a throwaway couple, the local app, the LIVE
// backend and its live channel. The comic before a chapter shows on both phones and either of you can turn the page;
// then the level starts on both. A key picked up on one phone is carried on the other and a lock it opens is open on
// both; a balloon held on one phone floats on the other; a clock button pressed on one phone holds the gate open on
// both, and it shuts on both; the frame goes up onto both heads, rides between two phones and opens the gate on both.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-story-live-test.js
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
const st = (p) => T(p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; return { state: G.state, role: N.role, n: N.n, lv: G.L && G.L.i }; });
const sc = (p) => T(p, () => CoopGames.test.sceneState());
const chunk = (p, id) => T(p, (id) => { const c = CoopGames.test.G.L.chunks.find(c => c.ch.id === id); return c && { x0: c.x0, w: c.ch.w }; }, id);
const tpMe = (p, x, y) => T(p, ([x, y]) => { const T2 = CoopGames.test, G = T2.G; T2.tp(G.meIdx, x, y); }, [x, y]);
const until = async (fn, ms = 8000, every = 120) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(every); } return false; };
const both = async (A, B, fn, ms = 9000) => until(async () => { const a = await st(A.p), b = await st(B.p); return fn(a, b); }, ms);
async function home(X) { await T(X.p, () => { const T2 = CoopGames.test; if (T2.stage() && !T2.stage().hidden) T2.closeStage(); }); await sleep(300); }
// the story level k, picked on A's phone from the story screen (its chapter's comic already seen)
async function startStory(A, B, k) {
  await home(A); await home(B); await sleep(1200);
  await T(A.p, (k) => { const t = CoopGames.test; t.ui('story'); const c = t.STORY_LV[k].c; const n = document.querySelector(`.cg-node[data-ch="${c}"]`); if (n) n.click(); }, k);
  await sleep(200);
  await A.p.click(`.cg-lv[data-s="${k}"]`);
  return both(A, B, (a, b) => a.state === 'play' && b.state === 'play' && a.lv === 1000 + k && b.lv === 1000 + k && a.n === b.n, 12000);
}

(async () => {
  const s = Date.now(), u1 = `t${s}_sl1`, u2 = `t${s}_sl2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2', petName: '豆豆', petSpecies: 'dog' } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 760, h: 520 });
  for (const X of [A, B]) { await X.p.evaluate(() => App.openCoop('home')); await X.p.waitForFunction(() => document.querySelector('.cg-home .cg-mode'), null, { timeout: 15000 }); }
  ok(await until(async () => (await T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent))) && (await T(B.p, () => /A1 也在这里/.test(document.querySelector('.cg-home').textContent))), 15000), 'both open 一起回家 and find each other');

  console.log('\n1. The comic before chapter 1 shows on both phones, and either can turn the page');
  await A.p.click('[data-go="story"]'); await sleep(200);
  ok(await T(A.p, () => [...document.querySelectorAll('.cg-node')].slice(0, 3).every(b => !b.disabled)), 'two phones: the chapters in this update are all open (either of you may be ahead)');
  await A.p.click('.cg-lv[data-s="0"]');
  ok(await until(async () => ((await sc(A.p)) || {}).id === 'pro' && ((await sc(B.p)) || {}).id === 'pro', 5000), 'A1 taps 1-1: the prologue opens on both phones');
  await B.p.click('.cg-sc [data-a="next"]');
  ok(await until(async () => ((await sc(A.p)) || {}).k === 1, 4000), 'B2 turns the page: A1\'s phone turns it too');
  await A.p.click('.cg-sc [data-a="skip"]');
  ok(await until(async () => ((await sc(A.p)) || {}).id === 'o0' && ((await sc(B.p)) || {}).id === 'o0', 5000), 'A1 skips: chapter 1\'s opening comes next, on both');
  await B.p.click('.cg-sc [data-a="skip"]');
  ok(await both(A, B, (a, b) => a.state !== 'off' && a.lv === 1000 && b.lv === 1000 && a.n === b.n, 12000) && !(await sc(A.p)) && !(await sc(B.p)), 'B2 skips the rest: the comic closes on both, and 1-1 starts on both');
  ok(await T(A.p, () => { const s = CoopGames.test.G.save.seen || {}; return !!(s.pro && s.o0); }) && await T(B.p, () => { const s = CoopGames.test.G.save.seen || {}; return !!(s.pro && s.o0); }), 'both phones remember the comics as seen');
  await until(async () => (await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 8000);

  console.log('\n2. Keys and locks across the phones (1-1)');
  let c = await chunk(A.p, 'Q1_intro');
  await tpMe(A.p, c.x0 + 3.1, 9.82);
  ok(await until(async () => (await T(A.p, () => !!CoopGames.test.G.players[0].key)) && (await T(B.p, () => !!CoopGames.test.G.players[0].key)), 5000), 'A1 picks up the blue key: B2\'s phone sees A1 carrying it');
  await A.p.keyboard.down('ArrowRight'); await sleep(900); await A.p.keyboard.up('ArrowRight');
  const lockGone = (p, t) => T(p, ([x0, w, t]) => { const G = CoopGames.test.G; for (let k = 0; k < G.L.grid.length; k++) if (G.L.grid[k] === t && k % G.L.w >= x0 && k % G.L.w < x0 + w) return false; return true; }, [c.x0, c.w, t]);
  const TB = await T(A.p, () => CoopGames.test.T_LOCKB), TP = await T(A.p, () => CoopGames.test.T_LOCKP);
  ok(await until(async () => (await lockGone(A.p, TB)) && (await lockGone(B.p, TB)), 5000), 'A1 walks the key into the blue lock: it opens on both phones');
  await tpMe(B.p, c.x0 + 9.7, 9.82);
  ok(await until(async () => (await T(B.p, () => !!CoopGames.test.G.players[1].key)) && (await T(A.p, () => !!CoopGames.test.G.players[1].key)), 5000), 'B2 picks up the pink key: A1\'s phone sees it');
  await B.p.keyboard.down('ArrowRight'); await sleep(1100); await B.p.keyboard.up('ArrowRight');
  ok(await until(async () => (await lockGone(A.p, TP)) && (await lockGone(B.p, TP)), 5000), '…and the pink lock opens on both');
  await T(A.p, () => { const G = CoopGames.test.G; G.save.seen = Object.assign({}, G.save.seen, { o1: 1, o2: 1 }); });

  console.log('\n3. A balloon held on one phone floats on the other (2-1)');
  ok(await startStory(A, B, 4), '2-1 starts on both');
  await until(async () => (await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 8000);
  c = await chunk(A.p, 'B1_wall');
  await tpMe(A.p, c.x0 + 6.1, 9.82);
  ok(await until(async () => (await T(A.p, () => !!CoopGames.test.G.players[0].balloon)) && (await T(B.p, () => !!CoopGames.test.G.players[0].balloon)), 5000), 'A1 takes hold of the balloon: B2\'s phone has A1 holding it');
  const y0 = await T(B.p, () => CoopGames.test.G.players[0].y); await sleep(1000);
  const y1 = await T(B.p, () => CoopGames.test.G.players[0].y);
  ok(y0 - y1 > 2.5, `…and rising on B2's phone too (${(y0 - y1).toFixed(1)} tiles in a second)`);
  // (a key pressed and let go inside one frame is never seen by the game: hold it a moment, as a finger does)
  await A.p.keyboard.down('Space'); await sleep(120); await A.p.keyboard.up('Space');
  ok(await until(async () => (await T(A.p, () => !CoopGames.test.G.players[0].balloon)) && (await T(B.p, () => !CoopGames.test.G.players[0].balloon && CoopGames.test.G.L.balloons[0].held === -1)), 4000), 'A1 lets go: on B2\'s phone the balloon is let go of too');

  console.log('\n4. A clock button pressed on one phone holds the gate open on both, then it shuts on both (3-1)');
  ok(await startStory(A, B, 8), '3-1 starts on both');
  await until(async () => (await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 8000);
  const tp = await T(A.p, () => { const t = CoopGames.test.G.L.tplates[0]; return { c: t.c, r: t.r, ch: t.ch }; });
  await tpMe(A.p, tp.c + 0.11, tp.r + 1 - 1.18);
  ok(await until(async () => (await T(A.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch)) && (await T(B.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch)), 4000), 'A1 steps on the clock button: the gate opens on both');
  await tpMe(A.p, tp.c - 2.5, tp.r + 1 - 1.18); await sleep(2500);
  ok(await T(A.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch) && await T(B.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch), '2.5 s after stepping off, still open on both');
  await sleep(3500);
  ok(!(await T(A.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch)) && !(await T(B.p, (ch) => !!CoopGames.test.G.chanOn[ch], tp.ch)), '…and shut on both by 6 s');

  console.log('\n5. The frame, carried together across two phones (3-2)');
  ok(await startStory(A, B, 9), '3-2 starts on both');
  await until(async () => (await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 8000);
  const f = await T(A.p, () => { const f = CoopGames.test.G.L.frames[0], s = CoopGames.test.G.L.stands[0]; return { fc: f.x + f.w / 2, ch: f.ch, sx: s.x }; });
  await tpMe(A.p, f.fc - 0.95, 9.82); await tpMe(B.p, f.fc + 0.2, 9.82);
  const fst = (p) => T(p, () => CoopGames.test.G.L.frames[0].st);
  ok(await until(async () => (await fst(A.p)) === 'up' && (await fst(B.p)) === 'up', 6000), 'both stand under the frame: it goes up onto both heads, on both phones');
  await Promise.all([A.p.keyboard.down('ArrowRight'), B.p.keyboard.down('ArrowRight')]);
  const placed = await until(async () => (await fst(A.p)) === 'placed' || (await fst(A.p)) === 'fall', 6000, 60);
  await Promise.all([A.p.keyboard.up('ArrowRight'), B.p.keyboard.up('ArrowRight')]);
  ok(placed && (await fst(A.p)) === 'placed', 'walked over together, it goes onto its stand (A1\'s phone runs it)');
  ok(await until(async () => (await fst(B.p)) === 'placed' && (await T(B.p, (ch) => !!CoopGames.test.G.chanOn[ch], f.ch)), 5000), '…on B2\'s phone too, and the gate is open there');

  console.log('\n6. Never trust the wire');
  await home(A); await home(B); await sleep(800);
  await T(A.p, () => App._coopApiTest().live.send('cg', { t: 'scn', v: 8, id: 'nope', p: 0, who: 0 }));
  await T(A.p, () => App._coopApiTest().live.send('cg', { t: 'scn', v: 8, id: 'c0', p: 'x', who: 0 }));
  await sleep(1200);
  ok(!(await sc(B.p)), 'a comic nobody knows (or a page that is not a number) opens nothing on the other phone');
  ok(!A.errs.length && !B.errs.length, `no page errors ${A.errs.concat(B.errs).slice(0, 3).join(' | ')}`);
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
