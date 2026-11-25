// 一起回家 and 默契拍拍 on two phones over a BAD network (CLAUDE.md §7.33).
// coop-live-test.js proves each mechanic works across two phones on a good
// connection. This one proves the phones still agree, and the partner still
// moves smoothly, when the connection behaves like a phone's: delay, jitter,
// stalls, a socket that drops and comes back, a screen that locks, a partner
// who vanishes, the same login on a third device, a token renewed mid-game,
// and two slow phones. Every level's mechanics that the partner can change are
// done FROM THE GUEST'S phone and checked on the host's (gift blocks, crumbling
// clouds, flags, stars, hearts, stomps, hits, falls, the win), some of them
// while a socket is down.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-net-test.js          PHONE_B=webkit runs the second phone in WebKit
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves a couple behind)
const PW = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), os = require('os'), path = require('path');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const FN = 'https://yvllstktmjoedfsgojgs.supabase.co/functions/v1';
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);   // e.g. ONLY=smooth,cuts
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = (k) => !ONLY.length || ONLY.includes(k);
async function call(p, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}

// A phone's network, between the page and the live channel: every frame each way is held for
// base + jitter·random ms (in order, like TCP), now and then a spike; cut() drops the socket the
// way a tunnel does; stall(ms) holds everything and then lets it through in a burst.
const NETSIM = () => {
  const Real = window.WebSocket;
  const N = window.__net = { base: 0, jitter: 0, spike: 0, spikeMs: 0, holdUntil: 0, opens: 0, out: 0, in: 0, socks: [], topic: '' };
  const delay = () => { let d = N.base + Math.random() * N.jitter; if (Math.random() < N.spike) d += N.spikeMs; return Math.max(d, N.holdUntil - performance.now()); };
  function W(url, proto) {
    const ws = proto ? new Real(url, proto) : new Real(url);
    N.opens++; N.socks.push(ws);
    const send = ws.send.bind(ws); let outLast = 0;
    ws.send = (d) => {
      N.out++;
      try { const m = JSON.parse(d); if (m.event === 'phx_join') N.topic = m.topic; } catch (e) {}
      const dl = delay(); if (dl <= 0 && outLast < performance.now()) return send(d);
      const at = Math.max(outLast, performance.now() + dl); outLast = at;
      setTimeout(() => { if (ws.readyState === 1) send(d); }, at - performance.now());
    };
    let h = null, inLast = 0;
    Object.defineProperty(ws, 'onmessage', { configurable: true, get: () => h, set: (f) => { h = f; } });
    ws.addEventListener('message', (ev) => {
      N.in++;
      const dl = delay(); if (dl <= 0 && inLast < performance.now()) { if (h) h(ev); return; }
      const at = Math.max(inLast, performance.now() + dl); inLast = at;
      setTimeout(() => { if (h && ws.readyState === 1) h(ev); }, at - performance.now());
    });
    return ws;
  }
  W.prototype = Real.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSING = 2; W.CLOSED = 3;
  window.WebSocket = W;
  N.set = (o) => Object.assign(N, { base: 0, jitter: 0, spike: 0, spikeMs: 0 }, o);
  N.cut = () => { for (const s of N.socks) if (s.readyState <= 1) try { s.close(); } catch (e) {} };
  N.stall = (ms) => { N.holdUntil = performance.now() + ms; };
};
const COND = { ideal: {}, '4G': { base: 25, jitter: 45 }, poor: { base: 55, jitter: 130, spike: 0.03, spikeMs: 380 } };

async function phone(browser, user, { w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(NETSIM);
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
const st = (p) => T(p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; return { state: G.state, me: G.meIdx, role: N.role, n: N.n, lv: G.L && G.L.i, hp: G.hp, hearts: G.hearts, stars: G.stars.slice(), cp: G.cp && { ...G.cp },
  P: G.players.map(q => ({ x: q.x, y: q.y, g: q.grounded, gk: q.ground && q.ground.kind, dead: q.dead > 0, w: q.w, h: q.h })), chan: G.chanOn ? Array.from(G.chanOn) : [], box: G.L && G.L.boxes.map(b => b.x),
  pend: N.pend.length, panel: (document.querySelector('.cg-panel') || {}).textContent || '', netBanner: !document.querySelector('[data-r="net"]') || document.querySelector('[data-r="net"]').hidden ? '' : document.querySelector('[data-r="net"]').textContent }; });
const tpMe = (p, x, y, vy = 0) => T(p, ([x, y, vy]) => { const T2 = CoopGames.test, G = T2.G; T2.tp(G.meIdx, x, y); G.players[G.meIdx].vy = vy; }, [x, y, vy]);
const net = (p, o) => T(p, (o) => window.__net.set(o), o);
const until = async (fn, ms = 8000, every = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(every); } return false; };
const live = (p) => T(p, () => App._liveTest());
async function openGame(X, kind = 'home') { await X.p.evaluate((k) => App.openCoop(k), kind); await X.p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 }); }
// the level that has a given piece (levels are found by what they contain, not by number)
const levelWith = (p, id) => p.evaluate((id) => CoopGames.test.LEVELS.findIndex(L => L.seq.includes(id)), id);
async function startLevel(A, B, i) {
  const w = await A.p.evaluate((i) => CoopGames.test.LEVELS[i].world, i);
  await A.p.click(`.cg-worlds [data-w="${w}"]`);
  await A.p.click(`.cg-lv[data-i="${i}"]`);
  return until(async () => { const a = await st(A.p), b = await st(B.p); return a.state === 'play' && b.state === 'play' && a.lv === i && b.lv === i && a.n === b.n; }, 12000);
}
async function home(X) { await T(X.p, () => { const T2 = CoopGames.test; if (T2.stage() && !T2.stage().hidden) T2.closeStage(); }); await sleep(300); }
async function freshLevel(A, B, i) { await home(A); await home(B); await sleep(1200); return startLevel(A, B, i); }
// hurt the player on this phone: onto spikes if the level has them, else into a gap
const hurtMe = async (p) => {
  const at = await T(p, () => { const L = CoopGames.test.G.L, w = L.w; for (let c = 0; c < w; c++) for (let r = 0; r < 13; r++) if (L.grid[r * w + c] === 5) return { c, r, spike: 1 };
    for (let c = 8; c < w - 4; c++) { let e = true; for (let r = 0; r < 13; r++) if (L.grid[r * w + c]) e = false; if (e && !L.movers.some(m => c >= m.x0 - 1 && c <= m.x1 + 1)) return { c, r: 12 }; } return null; });
  await T(p, () => { const G = CoopGames.test.G; G.players[G.meIdx].inv = 0; });
  if (at && at.spike) await tpMe(p, at.c + 0.1, at.r - 0.95, 2); else if (at) await tpMe(p, at.c + 0.1, 6, 3);
  return at;
};
const ground = (p) => T(p, () => {   // the longest flat, clear stretch of ground in this level
  const L = CoopGames.test.G.L, w = L.w, code = (c, r) => L.grid[r * w + c];
  const top = (c) => { for (let r = 0; r < 13; r++) { const t = code(c, r); if (t === 1 || t === 2 || t === 4) return r; if (t) return -1; } return -1; };
  let best = null, s = 0;
  for (let c = 1; c < w; c++) {
    const same = top(c) > 0 && top(c) === top(c - 1) && !L.enemies.some(e => e.x > c - 2 && e.x < c + 1);
    if (!same) s = c; else if (!best || c - s > best.len) best = { x0: s, len: c - s, r: top(c) };
  }
  return best;
});
// where the partner is drawn, every frame, on this phone (the rendered position, between physics steps)
const sampleStart = (p, whose) => T(p, (whose) => {
  const T2 = CoopGames.test, G = T2.G, i = whose === 'them' ? 1 - G.meIdx : G.meIdx; window.__smp = []; window.__smpOn = true;
  // read after the game's own frame has drawn (rAF callbacks run in order; this one was queued later)
  const f = (t) => { if (!window.__smpOn) return; const q = G.players[i]; window.__smp.push([t, q.px + (q.x - q.px) * T2.al() + (q.vox || 0), performance.timeOrigin + t]); requestAnimationFrame(f); };
  requestAnimationFrame(f);
}, whose);
const sampleStop = (p) => T(p, () => { window.__smpOn = false; return window.__smp; });
// how far behind its owner's screen the partner is drawn: for each frame on the watching phone, when was
// the runner's own screen at that spot (both pages run on one machine, so their clocks agree)
function lag(own, seen) {
  const o = own.filter(s => s[2]), x0 = Math.min(...o.map(s => s[1])), x1 = Math.max(...o.map(s => s[1]));
  const ls = [];
  for (const s of seen) {
    if (s[1] < x0 + 1.5 || s[1] > x1 - 1.5) continue;
    const k = o.findIndex(q => q[1] >= s[1]); if (k < 1) continue;
    const a = o[k - 1], b = o[k], tt = a[2] + (b[2] - a[2]) * ((s[1] - a[1]) / Math.max(1e-6, b[1] - a[1]));
    ls.push(s[2] - tt);
  }
  ls.sort((a, b) => a - b);
  return ls.length ? Math.round(ls[Math.floor(ls.length / 2)]) : null;
}
// how evenly a running character moves on screen: the share of frames within 35% of its steady speed
function evenness(smp) {
  if (smp.length < 30) return { frames: smp.length, smooth: 0 };
  const xs = smp.map(s => s[1]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const mid = smp.filter((s) => s[1] > x0 + 1.5 && s[1] < x1 - 1.5);
  const v = []; for (let k = 1; k < mid.length; k++) { const dt = mid[k][0] - mid[k - 1][0]; if (dt > 4) v.push({ v: (mid[k][1] - mid[k - 1][1]) / dt * 1000, dt }); }
  const sorted = v.map(o => o.v).sort((a, b) => a - b), ref = sorted[Math.floor(sorted.length / 2)] || 0;
  const good = v.filter(o => Math.abs(o.v - ref) <= 0.35 * Math.abs(ref)).length;
  const stall = v.filter(o => Math.abs(o.v) < 0.25 * Math.abs(ref)).length, jump = v.filter(o => Math.abs(o.v) > 1.8 * Math.abs(ref)).length;
  let still = 0, run = 0; for (let k = 1; k < mid.length; k++) { if (Math.abs(mid[k][1] - mid[k - 1][1]) < 0.01) { run += mid[k][0] - mid[k - 1][0]; still = Math.max(still, run); } else run = 0; }
  return { frames: v.length, smooth: v.length ? good / v.length : 0, stall, jump, still: Math.round(still), speed: +ref.toFixed(2) };
}

(async () => {
  const s = Date.now(), u1 = `t${s}_cn1`, u2 = `t${s}_cn2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: r1.data.accessToken, body: { charName1: 'A1', charName2: 'B2', petName: '豆豆', petSpecies: 'dog' } });
  const chrome = await PW.chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  let bBrowser = chrome;
  if (process.env.PHONE_B === 'webkit') {
    const dir = fs.readdirSync(path.join(os.homedir(), 'Library/Caches/ms-playwright')).filter(d => d.startsWith('webkit-')).sort().pop();
    bBrowser = await PW.webkit.launch({ executablePath: path.join(os.homedir(), 'Library/Caches/ms-playwright', dir, 'pw_run.sh') });
  }
  const A = await phone(chrome, u1, { w: 390, h: 844 }), B = await phone(bBrowser, u2, { w: 430, h: 932 });
  console.log(`  (A1 on Chrome 390×844, B2 on ${process.env.PHONE_B === 'webkit' ? 'WebKit' : 'Chrome'} 430×932)`);
  for (const X of [A, B]) await openGame(X);
  ok(await until(async () => (await T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent))) && (await T(B.p, () => /A1 也在这里/.test(document.querySelector('.cg-home').textContent))), 15000), 'both phones find each other');

  if (want('smooth')) {
    console.log('\n1. The partner moves smoothly on your screen, on a good and a bad connection');
    ok(await startLevel(A, B, 0), '1-1 starts on both');
    const g = await ground(A.p);
    ok(g && g.len >= 12, `a flat stretch to run on (${g && g.len} tiles at x ${g && g.x0})`);
    for (const [name, c] of Object.entries(COND)) {
      await net(A.p, c); await net(B.p, c); await sleep(2000);   // a phone's network doesn't change in an instant; let it settle
      for (const [runner, watcher, label] of [[A, B, 'A1 runs, seen on B2\'s phone'], [B, A, 'B2 runs, seen on A1\'s phone']]) {
        if (name !== '4G' && runner === B) continue;
        await tpMe(runner.p, g.x0 + 0.6, g.r - 1.25); await sleep(900);
        await sampleStart(watcher.p, 'them'); await sampleStart(runner.p, 'me');
        await runner.p.keyboard.down('ArrowRight'); await sleep(Math.min(2200, (g.len - 2) / 7.5 * 1000)); await runner.p.keyboard.up('ArrowRight');
        await sleep(700);
        const seenS = await sampleStop(watcher.p), ownS = await sampleStop(runner.p);
        const seen = evenness(seenS), own = evenness(ownS), behind = lag(ownS, seenS);
        const need = name === 'poor' ? 0.85 : 0.95, late = { ideal: 80, '4G': 150, poor: 300 }[name];   // was 165 / 305 / 691 ms before the partner was simulated (2026-11-22)
        ok(seen.smooth >= need && seen.still < 150, `${name}: ${label} — ${Math.round(seen.smooth * 100)}% of frames even (own screen ${Math.round(own.smooth * 100)}%), longest freeze ${seen.still} ms, ${seen.stall} stalls, ${seen.jump} jumps`);
        ok(behind != null && behind <= late, `${name}: drawn ${behind} ms behind the runner's own screen (budget ${late} ms)`);
      }
    }
    await net(A.p, {}); await net(B.p, {});
  }

  if (want('mech')) {
    console.log('\n2. The partnership still works with phone-network delay (4G)');
    await net(A.p, COND['4G']); await net(B.p, COND['4G']);
    ok(await freshLevel(A, B, 0), '1-1 again');
    const stk = await T(A.p, () => { const c = CoopGames.test.G.L.chunks.find(c => c.ch.id === 'C_stack'); return c && { x0: c.x0 }; });
    await tpMe(A.p, stk.x0 + 5.1, 9.82); await sleep(900);
    await tpMe(B.p, stk.x0 + 5.1, 7.6); await sleep(1200);
    let a = await st(A.p), b = await st(B.p);
    ok(b.P[1].gk === 'player' && a.P[1].gk === 'player', 'B2 stands on A1\'s head, on both phones');
    if (process.env.DEBUG) await T(B.p, () => { const G = CoopGames.test.G, N = CoopGames.test.NET; window.__dbg = []; window.__dbgI = setInterval(() => { const a = G.players[0], b = G.players[1]; window.__dbg.push(`a ${a.x.toFixed(2)} dx ${(a.dx || 0).toFixed(3)} rin ${JSON.stringify(N.rin)} age ${Math.round(performance.now() - N.rinAt)} | b ${b.x.toFixed(2)} g ${b.grounded} ${b.ground && b.ground.kind} ${b.ground && b.ground.ref === a}`); }, 50); });
    await A.p.keyboard.down('ArrowLeft'); await sleep(450); await A.p.keyboard.up('ArrowLeft'); await sleep(900);
    if (process.env.DEBUG) console.log((await T(B.p, () => { clearInterval(window.__dbgI); return window.__dbg; })).join('\n'));
    b = await st(B.p);
    ok(b.P[1].gk === 'player' && Math.abs(b.P[1].x - b.P[0].x) < 0.7, `A1 carries B2 even with the delay (B2 ${b.P[1].x.toFixed(2)}, A1 ${b.P[0].x.toFixed(2)})`);
    ok(await freshLevel(A, B, await levelWith(A.p, 'X_plate')), 'the box level');
    const xp = await T(A.p, () => { const c = CoopGames.test.G.L.chunks.find(c => c.ch.id === 'X_plate'); return c && { x0: c.x0 }; });
    await tpMe(A.p, xp.x0 + 1.2, 9.82); await tpMe(B.p, xp.x0 + 0.9, 9.82); await sleep(1200);
    await A.p.keyboard.down('ArrowRight'); await B.p.keyboard.down('ArrowRight'); await sleep(5500); await A.p.keyboard.up('ArrowRight'); await B.p.keyboard.up('ArrowRight'); await sleep(1000);
    a = await st(A.p); b = await st(B.p);
    ok(a.box[0] >= xp.x0 + 7.9 && Math.abs(a.box[0] - b.box[0]) < 0.2, `the two-person box still reaches its button (${a.box[0].toFixed(2)} / ${b.box[0].toFixed(2)})`);
    await net(A.p, {}); await net(B.p, {});
  }

  if (want('cuts')) {
    console.log('\n3. A connection that drops for a few seconds loses nothing');
    ok(await freshLevel(A, B, 0), '1-1 again');
    // a heart taken on A1's phone while B2's connection is down
    const hi = await T(A.p, () => CoopGames.test.G.L.items.findIndex(it => it.type === 'heart' && !it.got));
    const hx = await T(A.p, (i) => { const it = CoopGames.test.G.L.items[i]; return [it.x, it.y]; }, hi);
    await T(B.p, () => window.__net.cut());
    await tpMe(A.p, hx[0] - 0.39, hx[1] - 0.5); await sleep(400);
    ok(!(await live(B.p)).joined, 'B2\'s connection is down while A1 takes a heart');
    let healed = await until(async () => T(B.p, (i) => CoopGames.test.G.L.items[i].got, hi), 12000);
    let a = await st(A.p), b = await st(B.p);
    ok(healed && a.hearts === b.hearts, `when it comes back, the heart is gone on B2's phone too and the 💗 count agrees (${a.hearts}/${b.hearts})`);
    // a star B2 takes while A1's connection is down
    const si = await T(B.p, () => CoopGames.test.G.L.items.findIndex(it => it.type === 'star' && !it.got));
    if (si >= 0) {
      const sx = await T(B.p, (i) => { const it = CoopGames.test.G.L.items[i]; return [it.x, it.y, it.n]; }, si);
      await T(A.p, () => window.__net.cut());
      await tpMe(B.p, sx[0] - 0.39, sx[1] - 0.5); await sleep(300);
      healed = await until(async () => (await st(A.p)).stars[sx[2]], 12000);
      ok(healed, `a star B2 took while A1 was offline shows on A1's phone once A1 is back (star ${sx[2] + 1})`);
    } else ok(true, '(no star in this level to test)');
    // a level with a flag (樱花迷宫); the hurt comes from a fall when there are no spikes
    ok(await freshLevel(A, B, await levelWith(A.p, 'S_tall')), '樱花迷宫, which has a flag');
    // a flag B2 touches while A1 is offline: A1's phone restarts from it too
    const cpi = await T(B.p, () => CoopGames.test.G.L.cps.findIndex(k => !k.on));
    const cpx = await T(B.p, (i) => { const k = CoopGames.test.G.L.cps[i]; return [k.x, k.y]; }, cpi);
    await T(A.p, () => window.__net.cut());
    await tpMe(B.p, cpx[0] - 0.39, cpx[1] - 1.0); await sleep(300);
    healed = await until(async () => { const x = await st(A.p); return x.cp && Math.abs(x.cp.x - cpx[0]) < 0.01; }, 12000);
    ok(healed, 'a flag B2 reached while A1 was offline counts on A1\'s phone too');
    // a hit B2 takes while A1 is offline costs exactly one heart, on both
    const hp0 = (await st(A.p)).hp;
    await T(A.p, () => window.__net.cut());
    const rec = () => { const G = CoopGames.test.G, N = CoopGames.test.NET; window.__hpl = []; let last = -1; window.__hpi = setInterval(() => { if (G.hp !== last) { last = G.hp; window.__hpl.push([Math.round(performance.now()), G.hp, N.rx, N.tx, N.pend.map(e => e.m.k + e.m.q).join(' '), G.players.map(p => p.inv.toFixed(2) + (p.dead > 0 ? 'D' : '')).join('/')]); } }, 5); };
    if (process.env.DEBUG) { await T(A.p, rec); await T(B.p, rec); }
    await T(A.p, () => { const G = CoopGames.test.G; G.players[G.meIdx].inv = 30; });   // A1 stands at the start, where a walker can reach it
    await T(B.p, () => CoopGames.test.hurt());   // one hit, as spikes would give
    const sp = true;
    healed = await until(async () => { const x = await st(A.p), y = await st(B.p); return x.hp === hp0 - 1 && y.hp === hp0 - 1; }, 12000);
    await sleep(1500);
    a = await st(A.p); b = await st(B.p);
    if (process.env.DEBUG) console.log('A', JSON.stringify(await T(A.p, () => window.__hpl)), '\nB', JSON.stringify(await T(B.p, () => window.__hpl)));
    ok(sp && healed && a.hp === hp0 - 1 && b.hp === hp0 - 1, `B2 hurt while A1 was offline: one heart gone on both (${hp0} → ${a.hp} / ${b.hp})`);
    // the win, while B2 is offline: B2's phone still ends the level
    const door = await T(A.p, () => CoopGames.test.G.L.door.x);
    await tpMe(B.p, door - 0.2, 9.82); await sleep(900);
    await T(B.p, () => window.__net.cut());
    await tpMe(A.p, door - 0.9, 9.82);
    const won = await until(async () => { const x = await st(A.p), y = await st(B.p); return /won|result/.test(x.state) && /won|result/.test(y.state); }, 15000);
    ok(won, 'both reach the house just as B2\'s connection drops: B2\'s phone still wins');
    ok(await until(async () => (await st(A.p)).pend === 0 && (await st(B.p)).pend === 0, 8000), 'afterwards nothing is left waiting to be confirmed on either phone');
  }

  if (want('lock')) {
    console.log('\n4. Locking the phone pauses both, and the partner waits');
    ok(await freshLevel(A, B, 1), '1-2');
    await T(A.p, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const paused = await until(async () => (await st(B.p)).state === 'paused', 3000, 60);
    ok(paused && /A1 按了暂停/.test((await st(B.p)).panel), 'A1 locks the phone → B2\'s game pauses at once and says A1 paused');
    await sleep(1000);
    ok(!(await live(A.p)).open, 'A1\'s phone closes its connection in the background');
    await sleep(26000);
    let b = await st(B.p);
    ok(b.state === 'paused' && !/离开/.test(b.panel), 'after 27 s away (a phone call) B2 is still waiting, not told A1 left');
    await T(A.p, () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    ok(await until(async () => (await live(A.p)).joined, 12000), 'A1 comes back: the connection reopens');
    await B.p.click('.cg-panel [data-a="go"]');
    const resumed = await until(async () => (await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 6000);
    { const a = await st(A.p), b = await st(B.p); ok(resumed, `B2 taps 继续 → both play again (A1 ${a.state}, B2 ${b.state}, A1 waiting to confirm ${a.pend}, B2 ${b.pend})`); }
    const bx0 = (await st(B.p)).P[1].x;
    await B.p.keyboard.down('ArrowRight'); await sleep(700); await B.p.keyboard.up('ArrowRight'); await sleep(900);
    const a = await st(A.p); b = await st(B.p);
    ok(b.P[1].x > bx0 + 1 && Math.abs(a.P[1].x - b.P[1].x) < 0.3, `and they play on together (B2 walked ${bx0.toFixed(2)} → ${b.P[1].x.toFixed(2)}, ${a.P[1].x.toFixed(2)} on A1's)`);
    await sleep(4000);
    ok((await st(A.p)).state === 'play' && (await st(B.p)).state === 'play', 'and nobody is told the other left');
  }

  if (want('gone')) {
    console.log('\n5. A partner whose connection dies for good, and comes back too late');
    ok(await freshLevel(A, B, 1), '1-2 again');
    await T(B.p, () => window.__net.stall(30000));   // B2's phone keeps playing, but nothing gets through for 30 s
    const waiting = await until(async () => /等 B2 的网络/.test((await st(A.p)).netBanner), 6000, 200);
    ok(waiting, 'after a few seconds A1\'s phone says it is waiting for B2\'s network');
    const left = await until(async () => /B2 离开了/.test((await st(A.p)).panel), 30000, 500);
    ok(left, 'after 25 s A1\'s phone gives up: 「B2 离开了这一关」');
    const told = await until(async () => /A1 离开了/.test((await st(B.p)).panel), 12000, 200);
    ok(told, 'when B2\'s network comes back, B2\'s phone is told straight away, instead of playing on alone');
    await T(B.p, () => window.__net.set({}));
    for (const X of [A, B]) { const btn = await X.p.$('.cg-panel [data-a="menu"]'); if (btn) await btn.click(); }
    await sleep(1500);
  }

  if (want('pick')) {
    console.log('\n6. Both pick a level at the same moment');
    for (const [label, aFirst, gap] of [['at the same instant', true, 0], ['B2 40 ms first', false, 40], ['A1 40 ms first', true, 40]]) {
      for (const X of [A, B]) await home(X);
      await sleep(2500);
      await Promise.all([A.p.click('.cg-worlds [data-w="0"]'), B.p.click('.cg-worlds [data-w="0"]')]);
      const [first, second, fi, si] = aFirst ? [A, B, 2, 3] : [B, A, 3, 2];
      // the second tap may never happen: the first pick can arrive and open the level before it (that phone just joins)
      if (gap) { await first.p.click(`.cg-lv[data-i="${fi}"]`); await sleep(gap); await second.p.click(`.cg-lv[data-i="${si}"]`, { timeout: 800 }).catch(() => {}); }
      else {   // both phones tap at the same millisecond of the shared system clock: neither can have heard the other yet
        const at = Date.now() + 600;
        await Promise.all([[A, 2], [B, 3]].map(([X, i]) => T(X.p, ([at, i]) => { setTimeout(() => document.querySelector(`.cg-lv[data-i="${i}"]`).click(), at - Date.now()); }, [at, i])));
        await sleep(700);
      }
      const same = await until(async () => { const a = await st(A.p), b = await st(B.p); return a.state === 'play' && b.state === 'play' && a.n === b.n && a.lv === b.lv; }, 12000);
      await sleep(1500);
      const a = await st(A.p), b = await st(B.p);
      const expect = aFirst ? 2 : null;   // A1 first or together: CS's pick. B2 first: whichever B2's phone got to send
      ok(same && a.n === b.n && a.role !== b.role && (expect == null || a.lv === expect), `${label}: they end up in one level, together (A1 ${a.lv + 1}, B2 ${b.lv + 1}, ${a.role}/${b.role})${expect != null ? ' — A1\'s pick' : ''}`);
    }
  }

  if (want('flow')) {
    console.log('\n7. Next level and 重来 from the guest\'s phone, even when its request is lost');
    ok(await freshLevel(A, B, 0), '1-1');
    const door = await T(A.p, () => CoopGames.test.G.L.door.x);
    await tpMe(A.p, door - 0.9, 9.82); await tpMe(B.p, door - 0.2, 9.82);
    ok(await until(async () => (await st(A.p)).state === 'result' && (await st(B.p)).state === 'result', 12000), 'both win 1-1 and see the result');
    await T(B.p, () => window.__net.cut());   // B2 taps 下一关 just as its connection drops
    await B.p.click('.cg-panel [data-a="next"]');
    ok(await until(async () => { const a = await st(A.p), b = await st(B.p); return a.lv === 1 && b.lv === 1 && a.state === 'play' && b.state === 'play' && a.n === b.n; }, 15000), 'B2\'s 下一关 still reaches A1\'s phone: both start 1-2');
    // lose every heart → both fail → B2 asks for 重来
    await T(A.p, () => { CoopGames.test.G.hp = 1; });
    await T(B.p, () => { const G = CoopGames.test.G; G.players[G.meIdx].inv = 0; G.hp = 1; });
    await hurtMe(B.p);
    ok(await until(async () => /从头再来/.test((await st(A.p)).panel) && /从头再来/.test((await st(B.p)).panel), 12000), 'the last heart lost on B2\'s phone ends the level on both');
    await B.p.click('.cg-panel [data-a="re"]');
    ok(await until(async () => { const a = await st(A.p), b = await st(B.p); return a.lv === 1 && b.lv === 1 && a.state === 'play' && b.state === 'play' && a.n === b.n && a.hp === b.hp && a.hp > 1; }, 12000), 'B2 taps 从头再来 → both restart 1-2 with full hearts');
  }

  if (want('things')) {
    console.log('\n8. What the guest does to the level shows on the host\'s phone');
    // a fall into a gap: B2 is seen dying and coming back beside A1, one heart gone on both
    let found = null;
    for (const lv of [4, 5, 6, 7, 2, 3]) {
      ok(await freshLevel(A, B, lv), `${Math.floor(lv / 4) + 1}-${lv % 4 + 1}`);
      found = await T(A.p, () => { const L = CoopGames.test.G.L, w = L.w; for (let c = 8; c < w - 4; c++) { let empty = true; for (let r = 0; r < 13; r++) if (L.grid[r * w + c]) empty = false; if (empty && !L.movers.some(m => c >= m.x0 - 1 && c <= m.x1 + 1)) return c; } return null; });
      if (found) break;
    }
    if (found) {
      await tpMe(A.p, found - 3, 9.82); await sleep(800);
      const hp0 = (await st(A.p)).hp;
      await T(B.p, () => { const G = CoopGames.test.G; G.players[G.meIdx].inv = 0; });
      await tpMe(B.p, found + 0.1, 6, 3);
      const sawDead = await until(async () => (await st(A.p)).P[1].dead, 5000, 30);
      ok(sawDead, `B2 falls into the gap at x ${found}: A1's phone sees it`);
      const back = await until(async () => { const a = await st(A.p); return !a.P[1].dead && Math.abs(a.P[1].x - a.P[0].x) < 2 && a.P[1].y < 11; }, 8000, 100);
      const a = await st(A.p), b = await st(B.p);
      ok(back && a.hp === b.hp && a.hp === hp0 - 1, `…and sees B2 come back beside A1; hearts agree (${a.hp}/${b.hp}, was ${hp0})`);
    } else ok(false, 'found a gap to fall into');
    // a gift block bumped from below by B2
    let gift = null;
    for (const lv of [0, 1, 2, 3, 4, 5]) {
      ok(await freshLevel(A, B, lv), `level ${lv + 1} for a gift block`);
      gift = await T(A.p, () => { const L = CoopGames.test.G.L, w = L.w; for (let c = 0; c < w; c++) for (let r = 1; r < 12; r++) { const t = L.grid[r * w + c]; if ((t === 6 || t === 7) && !L.grid[(r + 1) * w + c] && !L.grid[(r + 2) * w + c]) return [c, r]; } return null; });
      if (gift) break;
    }
    if (gift) {
      await tpMe(B.p, gift[0] + 0.5 - 0.39, gift[1] + 1.05, -9);
      const used = await until(async () => T(A.p, ([c, r]) => { const L = CoopGames.test.G.L; return L.grid[r * L.w + c] === 8; }, gift), 5000, 60);
      ok(used, `B2 bumps the gift block at ${gift}: it is used up on A1's phone too`);
    } else ok(false, 'found a gift block');
    // a crumbling cloud B2 stands on
    let crumb = null;
    for (const lv of [11, 13, 14, 35, 36, 12]) {
      ok(await freshLevel(A, B, lv), `level ${lv + 1} for a crumbling cloud`);
      crumb = await T(A.p, () => { const L = CoopGames.test.G.L, w = L.w; for (let c = 0; c < w; c++) for (let r = 1; r < 12; r++) if (L.grid[r * w + c] === 9 && !L.grid[(r - 1) * w + c]) return [c, r]; return null; });
      if (crumb) break;
    }
    if (crumb) {
      const bh = (await st(B.p)).P[1].h;
      await tpMe(B.p, crumb[0] + 0.5 - 0.39, crumb[1] - bh - 0.3, 1);   // just above it, falling: a crumbling cloud gives way when landed on
      const fell = await until(async () => T(A.p, ([c, r]) => { const L = CoopGames.test.G.L; return CoopGames.test.G.crumbs.has(r * L.w + c); }, crumb), 5000, 60);
      ok(fell, `B2 steps on the crumbling cloud at ${crumb}: it crumbles on A1's phone too`);
    } else ok(false, 'found a crumbling cloud');
    // stomping a walker from B2's phone
    let en = null;
    for (const lv of [0, 1, 2, 4, 5, 8]) {
      ok(await freshLevel(A, B, lv), `level ${lv + 1} for a walker`);
      en = await T(A.p, () => CoopGames.test.G.L.enemies.findIndex(e => e.type === 'p' && !e.dead));
      if (en >= 0) break;
    }
    if (en >= 0) {
      await sleep(400);
      const e = await T(B.p, (i) => { const e = CoopGames.test.G.L.enemies[i]; return { x: e.x, y: e.y, w: e.w }; }, en);
      await tpMe(B.p, e.x + e.w / 2 - 0.39, e.y - 1.6, 6);
      const dead = await until(async () => T(A.p, (i) => CoopGames.test.G.L.enemies[i].dead > 0, en), 4000, 40);
      ok(dead, 'B2 stomps a walker on B2\'s phone: it is squashed on A1\'s phone (which runs the walkers)');
    } else ok(false, 'found a walker');
  }

  if (want('same')) {
    console.log('\n9. The same login on a third device is not the partner');
    for (const X of [A, B]) await home(X);
    await T(B.p, () => CoopGames.close());
    await sleep(6000);
    const C = await phone(chrome, u1, { w: 390, h: 844 });
    await openGame(C);
    await sleep(6000);
    const aSees = await T(A.p, () => document.querySelector('.cg-home').textContent), cSees = await T(C.p, () => document.querySelector('.cg-home').textContent);
    ok(!/也在这里/.test(aSees) && !/也在这里/.test(cSees), 'A1 on a phone and an iPad: neither thinks B2 is there');
    await C.ctx.close();
    await openGame(B);
    ok(await until(async () => T(A.p, () => /B2 也在这里/.test(document.querySelector('.cg-home').textContent)), 12000), 'B2 opens it again → found');
  }

  if (want('token')) {
    console.log('\n10. A token renewed mid-game, and a refused one');
    ok(await freshLevel(A, B, 0), '1-1');
    const fresh = await call('/auth-login', { method: 'POST', body: { username: u1, password: 'Pass123!' } });
    ok(fresh.data && fresh.data.accessToken, 'a second, newer token for A1');
    await T(A.p, (t) => { const c = App._liveCtl(); c.setToken(t); c.keep(); }, fresh.data.accessToken);
    let stayed = true; for (let k = 0; k < 20; k++) { if (!(await live(A.p)).joined) stayed = false; await sleep(150); }
    await B.p.keyboard.down('ArrowRight'); await sleep(600); await B.p.keyboard.up('ArrowRight'); await sleep(800);
    let a = await st(A.p), b = await st(B.p);
    ok(stayed && Math.abs(a.P[1].x - b.P[1].x) < 0.3, 'handing the channel the new token keeps it open, and B2 still moves on A1\'s phone');
    const opens0 = await T(A.p, () => window.__net.opens);
    await T(A.p, () => { const c = App._liveCtl(); c.setToken('not-a-token'); c.drop(); });
    ok(await until(async () => (await live(A.p)).joined && await T(A.p, (o) => window.__net.opens > o, opens0), 20000, 200), 'a refused token (as after an hour) is refreshed and the channel rejoins');
    await B.p.keyboard.down('ArrowLeft'); await sleep(500); await B.p.keyboard.up('ArrowLeft'); await sleep(900);
    a = await st(A.p); b = await st(B.p);
    ok(Math.abs(a.P[1].x - b.P[1].x) < 0.3, '…and the game carries on');
  }

  if (want('beat')) {
    console.log('\n11. 默契拍拍 gives one verdict on a bad connection, and through a drop');
    for (const X of [A, B]) { await home(X); await T(X.p, () => CoopGames.close()); }
    await sleep(800);
    for (const X of [A, B]) await openGame(X, 'beat');
    await net(A.p, COND.poor); await net(B.p, COND.poor);
    ok(await until(async () => T(A.p, () => /两部手机的时间对好了/.test(document.querySelector('.cg-home').textContent) && !document.querySelector('[data-a="go"]').disabled), 15000), 'clocks lined up over the bad connection');
    // taps a little early or late, at random, the same plan on both phones (so some beats are close, some not, some missed)
    const plan = (seed) => { const BT = CoopGames.test.BT, R = BT.run; let x = seed; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      R.beats.forEach((b) => { const r = rnd(); if (r < 0.12) return; setTimeout(() => CoopGames.test.beatTap(CoopGames.test.G.meIdx ? 'yy' : 'cs'), b.t - performance.now() + (rnd() - 0.5) * 260); }); };
    for (const [round, cut] of [[1, false], [2, true]]) {
      await A.p.click('.cg-home [data-a="go"]');
      ok(await until(async () => T(B.p, () => !!CoopGames.test.BT.run), 4000, 40), `round ${round} starts on both`);
      await T(A.p, `(${plan})(${round * 7})`); await T(B.p, `(${plan})(${round * 13})`);
      if (cut) { await sleep(4 * 857 + 3 * 857); await T(B.p, () => window.__net.cut()); }
      const done = await until(async () => /默契 \d+ 分/.test(await T(A.p, () => document.querySelector('[data-r="msg"]').textContent)) && /默契 \d+ 分/.test(await T(B.p, () => document.querySelector('[data-r="msg"]').textContent)), 30000, 200);
      const ma = await T(A.p, () => document.querySelector('[data-r="msg"]').textContent), mb = await T(B.p, () => document.querySelector('[data-r="msg"]').textContent);
      ok(done && ma === mb, `round ${round}${cut ? ' (B2\'s connection drops mid-round)' : ''}: both phones say 「${ma}」${ma === mb ? '' : ' vs 「' + mb + '」'}`);
      await sleep(1500);
    }
    await net(A.p, {}); await net(B.p, {});
    for (const X of [A, B]) await T(X.p, () => CoopGames.close());
    await sleep(500);
  }

  if (want('soak')) {
    console.log('\n12. Ninety seconds of play on 4G: no drops, no stalls, still in step');
    for (const X of [A, B]) { await home(X); await T(X.p, () => CoopGames.close()); }
    await sleep(600);
    for (const X of [A, B]) await openGame(X);
    await sleep(2500);
    ok(await startLevel(A, B, 1), '1-2');
    await net(A.p, COND['4G']); await net(B.p, COND['4G']);
    const g = await ground(A.p);
    await tpMe(A.p, g.x0 + 2, g.r - 1.25); await tpMe(B.p, g.x0 + 4, g.r - 1.25); await sleep(800);
    const o0 = [await T(A.p, () => window.__net.opens), await T(B.p, () => window.__net.opens)];
    const sent0 = [await T(A.p, () => window.__net.out), await T(B.p, () => window.__net.out)], tS = Date.now();
    let banner = 0, worst = 0;
    const t0 = Date.now(); let dir = 1, k = 0;
    while (Date.now() - t0 < 90000) {
      const keyA = dir > 0 ? 'ArrowRight' : 'ArrowLeft', keyB = dir > 0 ? 'ArrowLeft' : 'ArrowRight';
      await A.p.keyboard.down(keyA); await B.p.keyboard.down(keyB); await sleep(700); await A.p.keyboard.up(keyA); await B.p.keyboard.up(keyB);
      if (k++ % 3 === 0) { await A.p.keyboard.press('Space'); }
      await sleep(400);
      const a = await st(A.p), b = await st(B.p);
      if (a.netBanner || b.netBanner) banner++;
      worst = Math.max(worst, Math.abs(a.P[0].x - b.P[0].x) - 1.2, Math.abs(a.P[1].x - b.P[1].x) - 1.2);
      dir = -dir;
    }
    await sleep(1200);
    const o1 = [await T(A.p, () => window.__net.opens), await T(B.p, () => window.__net.opens)];
    const rate = await T(A.p, () => ({ out: window.__net.out, in: window.__net.in }));
    const secs = (Date.now() - tS) / 1000, sent1 = [await T(A.p, () => window.__net.out), await T(B.p, () => window.__net.out)];
    const ps = [(sent1[0] - sent0[0]) / secs, (sent1[1] - sent0[1]) / secs];
    // Supabase counts a broadcast once sent and once received: two phones sending a and b a second cost 2(a+b)
    console.log(`     messages sent while both play: A1 ${ps[0].toFixed(1)}/s, B2 ${ps[1].toFixed(1)}/s → about ${Math.round(2 * (ps[0] + ps[1]) * 3600 / 1000)}k billed per hour of play`);
    ok(ps[0] <= +(process.env.MSG_BUDGET || 12) && ps[1] <= +(process.env.MSG_BUDGET || 12), `each phone sends at most ${process.env.MSG_BUDGET || 12} messages a second while playing (A1 ${ps[0].toFixed(1)}, B2 ${ps[1].toFixed(1)})`);
    ok(o1[0] === o0[0] && o1[1] === o0[1], `the channel never dropped (connections opened: A1 ${o1[0] - o0[0]}, B2 ${o1[1] - o0[1]})`);
    ok(banner === 0, `「等…的网络」 never showed (${banner} times)`);
    const a = await st(A.p), b = await st(B.p);
    ok(Math.abs(a.P[0].x - b.P[0].x) < 0.3 && Math.abs(a.P[1].x - b.P[1].x) < 0.3, `at rest, both phones agree where both are (A1 ${a.P[0].x.toFixed(2)}/${b.P[0].x.toFixed(2)}, B2 ${a.P[1].x.toFixed(2)}/${b.P[1].x.toFixed(2)})`);
    console.log(`     (A1's phone over the whole run: ${rate.out} frames out, ${rate.in} in)`);
    await net(A.p, {}); await net(B.p, {});
  }

  if (want('slow')) {
    console.log('\n13. Two slow phones (CPU 4×), playing together');
    const cdps = [];
    for (const X of [A, B]) { if (X === B && process.env.PHONE_B === 'webkit') continue; const c = await X.ctx.newCDPSession(X.p); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); cdps.push(c); }
    const frames = (p) => T(p, () => new Promise((res) => { const ts = []; const f = (t) => { ts.push(t); if (ts.length < 200) requestAnimationFrame(f); else { const d = ts.slice(1).map((t, k) => t - ts[k]); res({ fps: Math.round(1000 * d.length / (ts[ts.length - 1] - ts[0])), worst: Math.round(Math.max(...d)), long: d.filter(x => x > 50).length }); } }; requestAnimationFrame(f); }));
    const go = (async () => { for (let k = 0; k < 4; k++) { await A.p.keyboard.down('ArrowRight'); await B.p.keyboard.down('ArrowRight'); await sleep(450); await A.p.keyboard.up('ArrowRight'); await B.p.keyboard.up('ArrowRight'); await A.p.keyboard.press('Space'); await B.p.keyboard.press('Space'); await sleep(250); await A.p.keyboard.down('ArrowLeft'); await B.p.keyboard.down('ArrowLeft'); await sleep(450); await A.p.keyboard.up('ArrowLeft'); await B.p.keyboard.up('ArrowLeft'); } })();
    const [fa, fb] = await Promise.all([frames(A.p), frames(B.p)]); await go;
    ok(fa.fps >= 50 && fa.worst < 120, `A1's phone: ${fa.fps} fps, worst frame ${fa.worst} ms, ${fa.long} over 50 ms`);
    ok(fb.fps >= 50 && fb.worst < 120, `B2's phone: ${fb.fps} fps, worst frame ${fb.worst} ms, ${fb.long} over 50 ms`);
    for (const c of cdps) await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  ok(!A.errs.length && !B.errs.length, `no page errors ${A.errs.concat(B.errs).slice(0, 3).join(' | ')}`);
  await chrome.close(); if (bBrowser !== chrome) await bBrowser.close();
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
