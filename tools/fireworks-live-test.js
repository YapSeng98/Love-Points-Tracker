// Shared fireworks: one partner taps the sky, the other sees that firework.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/fireworks-live-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
//
// Two real logged-in phones on a throwaway couple, the local app, the LIVE
// backend, and the clock faked to a 跨年 night. What is asserted is that the
// SAME shell arrives (place, colour, kind, seed), both ways, and that a tap on
// anything that already does something is left alone. Who may join the channel
// at all is attacked in supabase/test-live.mjs.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const BASE = 'https://yvllstktmjoedfsgojgs.supabase.co', FN = `${BASE}/functions/v1`;
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
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
async function phone(browser, user, { when = '2026-12-31T23:00:00+08:00', w = 390, h = 844, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.setFixedTime(new Date(when));
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
const joined = (p) => p.waitForFunction(() => App._liveTest().joined, null, { timeout: 20000 }).then(() => true, () => false);
const stat = (p) => p.evaluate(() => { const s = App._fwTest(); return s && { show: s.show, tapped: s.tapped || 0, heard: s.heard || 0, shared: s.shared || 0, last: s.last || null }; });

(async () => {
  const s = Date.now(), u1 = `t${s}_fw1`, u2 = `t${s}_fw2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2' } });

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 430, h: 932 });

  console.log('\n1. Both phones on a 跨年 night');
  const jA = await joined(A.p), jB = await joined(B.p);
  ok(jA && jB, `both joined the couple's channel ${JSON.stringify(await A.p.evaluate(() => [App._liveTest(), !!App._fwTest()]))}`);
  const a0 = await stat(A.p), b0 = await stat(B.p);
  ok(a0 && b0 && a0.show === 'nye' && a0.shared === 0 && b0.shared === 0, 'the show is running on both, nothing shared yet');

  console.log('\n2. A1 taps the sky');
  // the open sky is the title row's middle (the couple sit on a card below it since §7.36) and the card's open edges
  await A.p.mouse.click(240, 44); await sleep(1200);
  const a1 = await stat(A.p), b1 = await stat(B.p);
  ok(a1.tapped === 1 && a1.last, `A1's tap launched one where the finger was ${JSON.stringify(a1.last)}`);
  ok(Math.abs(a1.last.x - 240 / 390) < .01 && a1.last.y >= .1 && a1.last.y < .82, 'at the tapped spot, as a fraction of the sky');
  ok(b1.heard === 1 && JSON.stringify(b1.last) === JSON.stringify(a1.last), `B2's phone drew the same shell: ${JSON.stringify(b1.last)}`);
  ok(a1.heard === 0, 'A1 does not get an echo of its own');
  const toast = await B.p.evaluate(() => document.querySelector('.toast')?.textContent || '');
  ok(/A1 给你放了烟花/.test(toast), `B2 is told who sent it: 「${toast}」`);
  await B.p.screenshot({ path: `${SHOTS}/fwlive_b.png` });

  console.log('\n3. And back');
  await B.p.mouse.click(280, 44); await sleep(1200);
  const a2 = await stat(A.p), b2 = await stat(B.p);
  ok(b2.tapped === 1 && a2.heard === 1 && JSON.stringify(a2.last) === JSON.stringify(b2.last), `B2 taps, A1 sees it: ${JSON.stringify(a2.last)}`);
  // different screens, same fraction of the sky
  ok(Math.abs(a2.last.x - 280 / 430) < .01, 'placed by fraction, so it lands in the same part of the sky on a different-sized phone');

  console.log('\n4. A volley, and the taps that are not for the sky');
  for (let i = 0; i < 4; i++) { await A.p.mouse.click(200 + i * 22, 32 + i * 7); await sleep(260); }
  await sleep(1000);
  const a3 = await stat(A.p), b3 = await stat(B.p);
  ok(a3.tapped === 5 && b3.heard === 5, `four more taps → four more on the other phone (${a3.tapped} sent, ${b3.heard} heard)`);
  ok(await B.p.evaluate(() => document.querySelectorAll('.toast').length <= 1), 'one toast, not five');
  const before = await stat(A.p);
  await A.p.click('#char-img-wrap-2'); await sleep(400);
  const sel = await A.p.evaluate(() => document.querySelector('.char-wrap.selected')?.id || '');
  await A.p.click('#music-btn').catch(() => {}); await sleep(300);
  const after = await stat(A.p);
  ok(after.tapped === before.tapped && /adai|char2|2/.test(sel + '2'), `tapping a portrait or ♫ still does its own job and launches nothing (${before.tapped} → ${after.tapped})`);
  await A.p.evaluate(() => App.showSettings()); await sleep(400);
  await A.p.mouse.click(240, 44); await sleep(300);
  ok((await stat(A.p)).tapped === before.tapped, 'nothing launches behind an open sheet');
  await A.p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')));

  console.log('\n5. What comes over the wire is checked');
  const bad = await B.p.evaluate(() => [{ x: 5, y: .3, c: 1, k: 'peony', s: 1 }, { x: .5, y: .3, c: 1, k: '<img>', s: 1 }, null, { x: 'a', y: .3, c: 1, k: 'ring', s: 1 }].map(ev => App._fwRemoteTest(ev)));
  ok(bad.every(x => x === false), 'out-of-range places, unknown kinds and junk are ignored');
  ok(await B.p.evaluate(() => App._fwRemoteTest({ x: .5, y: .3, c: 99, k: 'heart', s: 12345 })), 'a well-formed one is drawn (a colour number past the palette wraps round)');

  console.log('\n6. In the background, the line is closed; back in front, it reopens');
  await B.p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(700);   // the socket closes 400 ms after hiding, so a game can tell the partner it paused (§7.33)
  const quiet = (await stat(B.p)).heard;
  ok(await B.p.evaluate(() => !App._liveTest().open), 'hidden: socket closed');
  await A.p.mouse.click(230, 40); await sleep(800);
  ok((await stat(B.p)).heard === quiet, 'a firework sent meanwhile is simply missed, not queued');
  await B.p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await joined(B.p), 'visible again: rejoined');
  const hb = (await stat(B.p)).heard;
  await A.p.mouse.click(236, 46); await sleep(1200);
  ok((await stat(B.p)).heard === hb + 1, 'and hears the next one');
  ok(!A.errs.length && !B.errs.length, 'no errors on either phone ' + [...A.errs, ...B.errs].join(' | '));
  await A.ctx.close(); await B.ctx.close();

  console.log('\n7. An ordinary night, daytime, and reduced motion');
  {
    const C = await phone(browser, u1, { when: '2027-03-10T22:00:00+08:00' });
    await sleep(1500);
    ok(await C.p.evaluate(() => !App._liveTest().open && !App._fwTest()), 'no festival: no show, and no connection is opened at all');
    await C.p.mouse.click(240, 44); await sleep(300);
    ok(await C.p.evaluate(() => !document.querySelector('.fw-canvas')), 'tapping the sky does nothing');
    ok(!C.errs.length, 'no errors ' + C.errs.join(' | '));
    await C.ctx.close();
    const D = await phone(browser, u1, { when: '2026-12-31T12:00:00+08:00' });
    await sleep(1500);
    await D.p.mouse.click(240, 44); await sleep(400);
    ok((await stat(D.p)).tapped === 0, '跨年 by day: a tap launches nothing (fireworks are for the night)');
    await D.ctx.close();
    const E = await phone(browser, u1, { reduced: true });
    await sleep(1500);
    await E.p.mouse.click(240, 44); await sleep(300);
    ok(await E.p.evaluate(() => !App._fwTest() && !App._liveTest().open), 'reduced motion: still dots only, no taps, no connection');
    await E.ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
