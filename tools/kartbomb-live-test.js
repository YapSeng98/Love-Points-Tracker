// 🤝 卡丁车 and 💣 烟花炸弹 on TWO phones on the LIVE backend (CLAUDE.md §7.37): two logged-in pages on a throwaway
// couple, the local app, and the couple's real private live channel. What tools/kartbomb-net-test.js checks in a
// stand-in, checked here end to end through app.js: the game page gets the channel from the app, the two phones find
// each other, one invites and the other says 出发, both race (each sees the other where they are), both cross the line
// and see the same end card, the winner — and only the winner — is paid into 本月记录; then a maze together, a
// firework that goes off on both, the little house, both paid; leaving; and how many messages it costs.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/kartbomb-live-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves a couple behind)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const FN = 'https://yvllstktmjoedfsgojgs.supabase.co/functions/v1';
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; fails.push(m); console.log('  ❌', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000, every = 120) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(every); } return false; };
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
async function phone(browser, user, { w = 900, h = 560 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.route(/open-meteo/, (r) => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await p.evaluate(() => { document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary(); });
  return { p, ctx, errs };
}
// open a game from the app, as a tap on 小游戏 would; count what the page sends over the couple's channel
async function openKB(X, kind) {
  await X.p.evaluate((kind) => { App.openKB(kind); const h = window.__kbHost, send = h.live.send; window.__kbSent = 0; h.live.send = (e, p) => { window.__kbSent++; return send(e, p); }; }, kind);
  let f = null;
  for (let i = 0; i < 120 && !f; i++) { const x = X.p.frames().find((y) => /kartbomb\.html/.test(y.url())); if (x) { try { if (await x.evaluate(() => !!window.__kb)) f = x; } catch (e) {} } if (!f) await sleep(100); }
  if (!f) throw new Error('the game page did not open');
  await f.evaluate(() => { localStorage.setItem('kb_coach_kart', '5'); localStorage.setItem('kb_coach_bomb', '5'); });
  X.f = f; return f;
}
const E = (X, fn, arg) => X.f.evaluate(fn, arg);
const panelH = (X) => E(X, () => { const m = document.getElementById('msg'); return m && !m.hidden && m.querySelector('.panel h2') ? m.querySelector('.panel h2').textContent : ''; });
const click = async (X, sel) => { await X.f.waitForSelector(`#msg:not([hidden]) ${sel}`, { timeout: 10000 }); await X.f.click(`#msg ${sel}`); };
const autopilot = (X, on) => E(X, (on) => {
  clearInterval(window.__ap); if (!on) return;
  window.__ap = setInterval(() => { const G = __kb.game; if (!G || G.kind !== 'kart') return; const me = G.karts.find((k) => k.human); if (!me) return; const s = G.T.S[(me.idx + 12) % G.T.N], want = Math.atan2(s.y - me.y, s.x - me.x); let d = (want - me.h) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = Math.max(-1, Math.min(1, d * 3)); }, 30);
}, on);
async function drawGap(A, B, ms) {   // each phone's copy of the other's kart against where it really was at that instant (wall clock)
  for (const X of [A, B]) await E(X, () => {
    window.__rec = { own: [], peer: [] }; cancelAnimationFrame(window.__recF);
    const t0 = performance.timeOrigin, rec = () => { const G = __kb.game; if (G && G.kind === 'kart') { const t = t0 + performance.now(), me = G.karts.find((k) => k.human), pr = G.karts.find((k) => k.remote && k.k !== 'mm'); if (me && pr) { window.__rec.own.push([t, me.x, me.y]); window.__rec.peer.push([t, pr.x, pr.y]); } } window.__recF = requestAnimationFrame(rec); };
    window.__recF = requestAnimationFrame(rec);
  });
  await sleep(ms);
  const [ra, rb] = await Promise.all([A, B].map((X) => E(X, () => { cancelAnimationFrame(window.__recF); return window.__rec; })));
  const err = (peer, truth) => { const out = []; let j = 0; for (const [t, x, y] of peer) { while (j < truth.length - 2 && truth[j + 1][0] < t) j++; const a = truth[j], c = truth[j + 1]; if (!c || t < a[0] || t > c[0]) continue; const f = (t - a[0]) / (c[0] - a[0]); out.push(Math.hypot(x - (a[1] + (c[1] - a[1]) * f), y - (a[2] + (c[2] - a[2]) * f))); } return out; };
  const e = err(ra.peer, rb.own).concat(err(rb.peer, ra.own)).sort((p, q) => p - q);
  const q = (p) => e[Math.min(e.length - 1, Math.floor(e.length * p))];
  return { n: e.length, med: q(0.5), p90: q(0.9), max: e[e.length - 1] };
}

(async () => {
  const s0 = Date.now(), u1 = `t${s0}_kb1`, u2 = `t${s0}_kb2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2' } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 760, h: 520 });

  console.log('\n1. 🏎️ 卡丁车 from the app on both phones: they find each other over the couple\'s channel');
  ok(await A.p.evaluate(() => !App._liveTest().open), 'no live connection before the game opens');
  await openKB(A, 'kart'); await openKB(B, 'kart');
  ok(await until(async () => /B2 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)) && /A1 也在这里/.test(await E(B, () => document.getElementById('peer-kart').textContent)), 15000), 'each says the other is here (the names from 设置)');
  ok(await A.p.evaluate(() => App._liveTest().joined), 'the private channel is open while the game page is');
  await A.f.click('[data-play="kart:net"]'); await click(A, '[data-m="go"]');
  ok(await until(async () => /A1 想和你比一场/.test(await panelH(B)), 10000), 'B2\'s phone is asked: 「A1 想和你比一场」');
  await click(B, '[data-m="go"]');
  ok(await until(async () => (await E(A, () => __kb.game.state)) === 'race' && (await E(B, () => __kb.game.state)) === 'race', 12000), 'B2 says 出发: both are racing');

  console.log('\n2. Racing on the real network');
  await autopilot(A, true); await autopilot(B, true); await sleep(800);
  const sent0 = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__kbSent)));
  const g = await drawGap(A, B, 8000);
  const sent1 = await Promise.all([A, B].map((X) => X.p.evaluate(() => window.__kbSent)));
  await autopilot(A, false); await autopilot(B, false);
  const rate = sent1.map((v, i) => (v - sent0[i]) / 8);
  ok(g.n > 500 && g.p90 < 4 && g.max < 12, `each phone draws the other's kart ${g.med.toFixed(2)} off typically, ${g.p90.toFixed(2)} nine times in ten, ${g.max.toFixed(2)} at worst (a kart is 2.6 long)`);
  ok(rate.every((r) => r <= 10), `messages a second while racing: A1 ${rate[0].toFixed(1)}, B2 ${rate[1].toFixed(1)} (≤ 10; Supabase bills each twice)`);

  console.log('\n3. Over the line: one end card, and only the winner is paid');
  const finish = (X) => E(X, () => { const G = __kb.game, me = G.karts.find((k) => k.human), s = G.T.S[G.T.N - 2]; Object.assign(me, { lap: 3, idx: G.T.N - 2, mid: true, owe: false, x: s.x, y: s.y, rescue: 0, spin: 0 }); });
  await finish(A); await sleep(1500); await finish(B);
  const ended = await until(async () => !!(await E(A, () => __kb.game.shown)) && !!(await E(B, () => __kb.game.shown)), 15000);
  const cards = await Promise.all([A, B].map((X) => E(X, () => document.querySelector('#msg .panel h2').textContent + ' | ' + [...document.querySelectorAll('#msg .rows div span:first-child')].map((x) => x.textContent).join(' '))));
  ok(ended && cards[0] === cards[1] && /A1 第一名/.test(cards[0]), `the same end card on both: 「${cards[0]}」`);
  await sleep(2500);
  const rows = (await call('/entries', { token: r1.data.accessToken })).data.filter((e) => /卡丁车/.test(e.desc || ''));
  ok(rows.length === 1 && rows[0].charId === 'char1' && rows[0].pts === 1, `only A1's first win is paid, into 本月记录 (${rows.map((e) => `${e.charId} +${e.pts} ${e.desc}`).join(' / ')})`);

  console.log('\n4. 💣 烟花炸弹 together');
  for (const X of [A, B]) { await X.p.evaluate(() => App.closeKB()); await sleep(300); }
  await openKB(A, 'bomb'); await openKB(B, 'bomb');
  await until(async () => /B2 也在这里/.test(await E(A, () => document.getElementById('peer-bomb').textContent)), 15000);
  await A.f.click('[data-play="bomb:coop"]'); await click(A, '[data-m="net"]'); await click(A, '[data-m="go"]');
  ok(await until(async () => /A1 想和你一起闯/.test(await panelH(B)), 10000), 'B2\'s phone is asked to the maze');
  await click(B, '[data-m="go"]');
  ok(await until(async () => (await E(A, () => __kb.game.state)) === 'play' && (await E(B, () => __kb.game.state)) === 'play', 12000), 'both are in the maze');
  ok((await E(A, () => Array.from(__kb.game.grid).join(''))) === (await E(B, () => Array.from(__kb.game.grid).join(''))), 'the same boxes on both');
  await E(A, () => { for (const e of __kb.game.enemies) e.freeze = 1e6; });
  await E(B, () => { const p = __kb.game.players.find((q) => q.human); p.shield = 30; __kb.IN.yy.bombHit = 1; });
  const spot = await E(B, () => { const p = __kb.game.players.find((q) => q.human); return [Math.floor(p.x), Math.floor(p.y)]; });
  ok(await until(async () => (await E(A, ([c, r]) => __kb.game.bombs.some((b) => b.c === c && b.r === r && b.own.k === 'yy'), spot)), 5000), 'B2 sets a firework down: A1\'s phone has it, as B2\'s');
  ok(await until(async () => (await E(B, ([c, r]) => __kb.game.flames.has(c + ',' + r), spot)), 6000), '…it goes off on A1\'s phone, and the fire is on B2\'s');
  await sleep(1500);
  ok((await E(A, () => Array.from(__kb.game.grid).join(''))) === (await E(B, () => Array.from(__kb.game.grid).join(''))), 'what it burned is gone on both');
  await E(A, () => { __kb.game.enemies.forEach((e) => { e.alive = false; e.die = 0.1; }); });
  ok(await until(async () => !!(await E(B, () => __kb.game.door)), 6000), 'the little house comes out on both');
  const dc = await E(A, () => __kb.game.test.doorCell);
  for (const X of [A, B]) await E(X, ([c, r]) => { const p = __kb.game.players.find((q) => q.human); p.x = c + 0.5; p.y = r + 0.5; p.hop = null; p.walk = 0.1; }, dc);
  ok(await until(async () => (await E(A, () => __kb.game.how)) === 'win' && (await E(B, () => __kb.game.how)) === 'win', 10000), 'both walk in: won on both phones');
  await sleep(3000);
  const brows = (await call('/entries', { token: r1.data.accessToken })).data.filter((e) => /烟花炸弹/.test(e.desc || ''));
  ok(brows.length === 2 && brows.some((e) => e.charId === 'char1') && brows.some((e) => e.charId === 'char2'), `each is paid on their own phone (${brows.map((e) => `${e.charId} +${e.pts} ${e.desc}`).join(' / ')})`);

  console.log('\n5. Leaving');
  await click(A, '[data-m="next"]');
  await until(async () => /想和你一起闯/.test(await panelH(B)), 10000); await click(B, '[data-m="go"]');
  await until(async () => (await E(A, () => __kb.game.state)) === 'play' && (await E(B, () => __kb.game.state)) === 'play', 12000);
  await B.p.evaluate(() => App.closeKB());
  ok(await until(async () => /离开了这一关/.test(await panelH(A)), 8000), 'B2 closes the game: A1\'s phone says so at once');
  await A.p.evaluate(() => App.closeKB()); await sleep(1500);
  ok(await A.p.evaluate(() => !App._liveTest().open), 'with both games closed, the channel is closed too');
  ok(!A.errs.length && !B.errs.length, 'no page errors ' + A.errs.concat(B.errs).join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { for (const f of fails) console.log('  ' + f); process.exitCode = 1; }
})();
