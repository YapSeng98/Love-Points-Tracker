// 🤝 卡丁车 and 💣 烟花炸弹 on two phones (CLAUDE.md §7.37), in tools/kb-harness.html: two pages in one browser that
// talk the way two phones talk over the couple's live channel — instantly, or with a phone network's delay, jitter,
// lost messages and a socket that drops (?lat= &jit= &drop=, and goDown()). What is checked is what the couple would
// notice: they find each other; one invites, the other is asked and says 出发; the race / the maze starts on both;
// each sees the other move where they really are; a 布丁, a 小雨云, the 季节门, a firework, a burst, a pickup, a
// monster's touch, a fall and a pick-up reach the other phone; both see the same finish and the same end card, each is
// paid on their own phone; 再来一次 from either phone; pause on one pauses both; leaving is noticed; junk on the wire
// and our own login on another device are ignored; and no phone sends more than ~12 messages a second.
//   python3 -m http.server 8765   (or BASE=http://localhost:PORT)
//   node tools/kartbomb-net-test.js            ONLY=kart,bomb,junk,clock,net,rate   (sections)   BROWSER=webkit (an iPhone's engine)
const { chromium, webkit } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean), want = (s) => !ONLY.length || ONLY.includes(s);
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; fails.push(m); console.log('  ❌', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000, every = 80) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) {} await sleep(every); } return false; };

async function pair(browser, game, q = '', size = { width: 900, height: 560 }) {
  const ctx = await browser.newContext({ viewport: size });
  const room = 'r' + Date.now() + Math.floor(Math.random() * 1e6);
  const open = async (me) => {
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
    await p.goto(`${BASE}/tools/kb-harness.html?me=${me}&game=${game}&room=${room}${q}`);
    let f = null;
    for (let i = 0; i < 120 && !f; i++) { const x = p.frames().find((y) => /kartbomb\.html/.test(y.url())); if (x) { try { if (await x.evaluate(() => !!window.__kb)) f = x; } catch (e) {} } if (!f) await sleep(100); }
    if (!f) throw new Error('the game page did not load');
    await f.evaluate(() => { localStorage.setItem('kb_coach_kart', '5'); localStorage.setItem('kb_coach_bomb', '5'); });
    return { p, f, me };
  };
  const A = await open('cs'), B = await open('yy');
  return { ctx, A, B, room };
}
const E = (X, fn, arg) => X.f.evaluate(fn, arg);
const panelH = (X) => E(X, () => { const m = document.getElementById('msg'); return m && !m.hidden && m.querySelector('.panel h2') ? m.querySelector('.panel h2').textContent : ''; });
const click = async (X, sel) => { await X.f.waitForSelector(`#msg:not([hidden]) ${sel}`, { timeout: 6000 }); await X.f.click(`#msg ${sel}`); };
const harness = (X, fn, arg) => X.p.evaluate(fn, arg);

async function startKart(A, B, opts = {}) {
  await A.f.click('[data-play="kart:net"]');
  await click(A, '[data-m="go"]');
  await until(async () => /准备好/.test(await panelH(A)), 4000);
  await until(async () => /想和你比/.test(await panelH(B)), 6000);
  if (opts.beforeGo) await opts.beforeGo();
  await click(B, '[data-m="go"]');
  return until(async () => (await E(A, () => __kb.game && __kb.game.state)) !== 'card' && (await E(B, () => __kb.game && __kb.game.state)) !== 'card', 6000);
}
async function startBomb(A, B, mode = 'coop', petB) {
  await A.f.click(`[data-play="bomb:${mode}"]`);
  await click(A, '[data-m="net"]');
  await click(A, '[data-m="go"]');
  await until(async () => /想和你/.test(await panelH(B)), 6000);
  if (petB) await B.f.click(`#msg [data-pet="yy:${petB}"]`);
  await click(B, '[data-m="go"]');
  return until(async () => (await E(A, () => __kb.game && __kb.game.state)) === 'play' && (await E(B, () => __kb.game && __kb.game.state)) === 'play', 6000);
}
// a person at the wheel: steer along the road ahead (nobody steering bounces off every wall, which nobody really does)
const autopilot = (X, on) => E(X, (on) => {
  clearInterval(window.__ap); if (!on) { for (const k of ['cs', 'yy']) { __kb.IN[k].steerOn = false; __kb.IN[k].steer = 0; } return; }
  window.__ap = setInterval(() => {
    const G = __kb.game; if (!G || G.kind !== 'kart') return;
    const me = G.karts.find((k) => k.human); if (!me) return;
    const s = G.T.S[(me.idx + 12) % G.T.N], want = Math.atan2(s.y - me.y, s.x - me.x);
    let d = (want - me.h) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = Math.max(-1, Math.min(1, d * 3));
  }, 30);
}, on);
// How far each phone's copy of the partner's kart is from where that kart really was AT THAT MOMENT: every frame both
// phones note their own kart and their copy of the other's with the wall clock; the copy is then compared with the
// real one's path at the same instant. (Reading the two pages "at once" can be tens of ms apart: a kart length.)
async function drawGap(A, B, ms) {
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
  let browser;
  if (process.env.BROWSER === 'webkit') {
    const cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright'), dir = fs.readdirSync(cache).filter((d) => d.startsWith('webkit-')).sort().pop();
    browser = await webkit.launch({ executablePath: path.join(cache, dir, 'pw_run.sh') });
  } else browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

  if (want('kart')) {
    console.log('\nK1. 卡丁车: finding each other, being asked, starting together');
    const { ctx, A, B } = await pair(browser, 'kart');
    const seen = await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)) && /CS 也在这里/.test(await E(B, () => document.getElementById('peer-kart').textContent)), 6000);
    ok(seen, 'each phone says the other is here, on the menu');
    ok(await E(A, () => !document.querySelector('[data-play="kart:net"]').hidden && document.querySelector('[data-play="kart:net"]').getAttribute('aria-disabled') === 'false'), '🤝 各用自己的手机 is there and ready');
    // the partner says no
    await A.f.click('[data-play="kart:net"]'); await click(A, '[data-m="go"]');
    await until(async () => /想和你比/.test(await panelH(B)), 6000);
    const card = await E(B, () => ({ h: document.querySelector('#msg .panel h2').textContent, t: document.querySelector('#msg .panel').textContent, cls: !!document.querySelector('#msg [data-o^="cls:"]') }));
    ok(/CS 想和你比一场/.test(card.h) && /樱花小镇/.test(card.t) && !card.cls, `YY's phone asks: 「${card.h}」, the track and the class are CS's, YY chooses only how to steer`);
    await click(B, '[data-m="no"]');
    ok(await until(async () => /这次不比/.test(await panelH(A)), 5000), 'YY says 不比了: CS\'s phone hears it');
    await click(A, '[data-m="ok"]');
    // the ✕ in the corner of the question is a 不比了 too
    await A.f.click('[data-play="kart:net"]'); await click(A, '[data-m="go"]');
    await until(async () => /想和你比/.test(await panelH(B)), 6000);
    await click(B, '.pclose');
    ok(await until(async () => /这次不比/.test(await panelH(A)), 5000) && !(await E(B, () => !!__kb.game)), 'the ✕ in the corner of YY\'s question says 不比了 too, and closes it');
    await click(A, '[data-m="ok"]');
    // and CS can leave the card before asking: nothing reaches YY
    await A.f.click('[data-play="kart:net"]'); await A.f.waitForSelector('#msg:not([hidden]) .pclose'); await A.f.click('#msg .pclose'); await sleep(1200);
    ok(!(await E(A, () => !!__kb.game)) && !(await panelH(B)), 'CS taps ✕ on the start card before asking: back to the menu, and YY\'s phone is never asked');
    // and then yes
    ok(await startKart(A, B), 'asked again, YY says 出发: the race starts on both phones');
    const same = await Promise.all([A, B].map((X) => E(X, () => { const G = __kb.game; return { place: G.def.id, cls: G.title, trip: G.trip && G.trip.opts.map((t) => t.id).join(), net: G.net && G.net.role, karts: G.karts.map((k) => `${k.k}:${k.human ? 'me' : k.remote ? 'remote' : 'ai'}`).join() }; })));
    ok(same[0].place === same[1].place && same[0].trip === same[1].trip, `the same track and the same two 季节门 places on both (${same[0].place}, ${same[0].trip})`);
    ok(same[0].karts === 'mm:ai,cs:me,yy:remote' && same[1].karts === 'mm:remote,cs:remote,yy:me', `each drives its own kart; 闷闷 is driven on CS's phone (A ${same[0].karts} · B ${same[1].karts})`);
    await until(async () => (await E(A, () => __kb.game.state)) === 'race' && (await E(B, () => __kb.game.state)) === 'race', 6000);
    ok((await E(A, () => document.getElementById('msg').hidden)) && (await E(B, () => document.getElementById('msg').hidden)), 'nothing is left over the race on either phone (the waiting card, the question)');

    console.log('\nK2. Seeing each other drive');
    // apart, so this measures the drawing and not a bump (each phone pushes only its own kart, off a copy a moment old)
    const ci = await E(A, () => __kb.game.karts.find((k) => k.human).idx);
    await E(B, (ci) => { const G = __kb.game, me = G.karts.find((k) => k.human), i = (ci + 30) % G.T.N, s = G.T.S[i]; Object.assign(me, { x: s.x, y: s.y, h: s.ang, idx: i, v: 12, vx: 0, vy: 0 }); }, ci);
    await autopilot(A, true); await autopilot(B, true); await sleep(1000);
    const g = await drawGap(A, B, 5000);
    await autopilot(A, false); await autopilot(B, false);
    ok(g.n > 400 && g.p90 < 2 && g.max < 4.5, `each phone draws the other's kart where it really is: ${g.med.toFixed(2)} typically, ${g.p90.toFixed(2)} nine times in ten, ${g.max.toFixed(2)} at worst (24 a second; a kart is 2.6 long)`);
    const [ma, mb] = await Promise.all([E(A, () => { const k = __kb.game.karts.find((q) => q.k === 'mm'); return [k.x, k.y, k.v]; }), E(B, () => { const k = __kb.game.karts.find((q) => q.k === 'mm'); return [k.x, k.y]; })]);
    ok(Math.hypot(ma[0] - mb[0], ma[1] - mb[1]) < 6, `闷闷 on YY's phone is where CS's phone has it (${Math.hypot(ma[0] - mb[0], ma[1] - mb[1]).toFixed(2)})`);

    console.log('\nK3. A 布丁 and a 小雨云 cross over');
    await E(A, () => {   // CS well ahead of the pack (a 布丁 dropped in a pack is driven over at once), then the 布丁
      const G = __kb.game, me = G.karts.find((k) => k.human), mm = G.karts.find((k) => k.k === 'mm'), i0 = me.idx, i = (i0 + 70) % G.T.N, s = G.T.S[i], j = (i0 + G.T.N - 10) % G.T.N, b = G.T.S[j];
      Object.assign(mm, { x: b.x, y: b.y, h: b.ang, idx: j, v: 0, vx: 0, vy: 0 });   // 闷闷 (driven on CS's phone) well behind, so it can't get there first
      Object.assign(me, { x: s.x, y: s.y, h: s.ang, idx: i, v: 6, vx: 0, vy: 0, item: 'pudding', roll: 0, rescue: 0, spin: 0, air: false }); __kb.IN.cs.itemHit = 1;
    });
    // the moment it shows on YY's phone, YY drives onto it (闷闷, close behind on CS's phone, would otherwise get there first)
    let pb = null;
    // (moved with its place along the track too: a kart put down far from where the track thinks it is gets pushed back by the wall)
    const pud = await until(async () => { pb = await E(B, () => { const G = __kb.game, p = G.puddles.find((q) => /^cs/.test(q.id)); if (!p) return null; const me = G.karts.find((k) => k.human); let bi = 0, bd = 1e9; G.T.S.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i; } }); Object.assign(me, { x: p.x, y: p.y, idx: bi, spin: 0, air: false, rescue: 0, shield: 0, rainbow: 0 }); return [[p.id, p.x, p.y]]; }); return !!pb; }, 3000, 20);
    const pa = await E(A, () => __kb.game.puddles.filter((p) => /^cs/.test(p.id)).map((p) => [p.id, p.x, p.y]).concat(__kb.game.pudSeen || []));
    ok(pud && pb && (pa.length === 0 || JSON.stringify(pa[0]) === JSON.stringify(pb[0])), `CS drops a 布丁: it lands in the same place on YY's phone (${JSON.stringify(pb)})`);
    const spun = await until(async () => (await E(B, () => __kb.game.karts.find((k) => k.human).spin)) > 0, 2000);
    const goneA = await until(async () => !(await E(A, () => __kb.game.puddles.some((p) => /^cs/.test(p.id)))), 3000);
    const why = spun && goneA ? '' : ` ✗ spun ${spun}, gone on CS's phone ${goneA}: ${JSON.stringify(await E(B, () => { const me = __kb.game.karts.find((k) => k.human); return { x: me.x, y: me.y, spin: me.spin, shield: me.shield, rainbow: me.rainbow, air: me.air, rescue: me.rescue, pud: __kb.game.puddles.map((p) => [p.id, p.x, p.y, p.t, p.safe]) }; }))}`;
    ok(spun && goneA, 'YY drives into it: YY spins (on YY\'s phone), and it is gone on CS\'s phone too' + why);
    await E(B, () => { const G = __kb.game, me = G.karts.find((k) => k.human); me.item = 'rain'; me.roll = 0; me.place = 2; const cs = G.karts.find((k) => k.k === 'cs'); cs.place = 1; G.karts.find((k) => k.k === 'mm').place = 3; __kb.IN.yy.itemHit = 1; });
    await sleep(60);
    const rained = await until(async () => (await E(A, () => __kb.game.karts.find((k) => k.human).slow)) > 0, 4000);
    ok(rained, 'YY sends a 小雨云 at CS ahead: it rains on CS, on CS\'s phone');

    console.log('\nK4. Over the line: the same order on both, each paid on their own phone');
    const finish = (X) => E(X, () => { const G = __kb.game, me = G.karts.find((k) => k.human), s = G.T.S[3]; Object.assign(me, { lap: 3, idx: G.T.N - 2, mid: true, owe: false, x: s.x, y: s.y, h: s.ang, rescue: 0, spin: 0, air: false }); });   // just past the line, its place on the track still just before it: the next frame counts the crossing (whichever way it was pointing)
    await finish(A);
    ok(await until(async () => (await E(B, () => __kb.game.karts.find((k) => k.k === 'cs').done)), 4000), 'CS crosses the line: YY\'s phone knows, with CS\'s time');
    ok(await until(async () => /等 YY 到终点/.test(await E(A, () => __kb.game.karts.find((k) => k.human).msg || '')), 3000), '…and CS\'s phone waits for YY: 「等 YY 到终点…」');
    await finish(B);
    const endA = await until(async () => !!(await E(A, () => __kb.game.shown)), 8000), endB = await until(async () => !!(await E(B, () => __kb.game.shown)), 8000);
    const res = await Promise.all([A, B].map((X) => E(X, () => ({ h: document.querySelector('#msg .panel h2').textContent, rows: [...document.querySelectorAll('#msg .rows div span:first-child')].map((x) => x.textContent).join(' ') }))));
    const sameCard = endA && endB && res[0].h === res[1].h && res[0].rows === res[1].rows;
    if (!sameCard) console.log('    net A', JSON.stringify(await E(A, () => { const N = __kb.NET; return { rx: N.rx, tx: N.tx, hold: [...N.hold.keys()], pend: N.pend.map((x) => x.m.q + x.m.e), yy: __kb.game.karts.find((k) => k.k === 'yy').done }; })), 'net B', JSON.stringify(await E(B, () => { const N = __kb.NET; return { rx: N.rx, tx: N.tx, hold: [...N.hold.keys()], pend: N.pend.map((x) => x.m.q + x.m.e) }; })));
    ok(sameCard, `both phones show the same end card: 「${res[0].h}」 ${res[0].rows}${sameCard ? '' : ` ✗ ended ${endA}/${endB}; YY's card 「${res[1].h}」 ${res[1].rows}`}`);
    const pays = await Promise.all([A, B].map((X) => harness(X, () => __harness.log.filter((l) => l[0] === 'pay').map((l) => l.slice(1).join(':')))));
    const winner = /CS/.test(res[0].h) ? 'A' : /YY/.test(res[0].h) ? 'B' : 'mm';
    ok(winner === 'A' ? pays[0].length === 1 && !pays[1].length : winner === 'B' ? pays[1].length === 1 && !pays[0].length : !pays[0].length && !pays[1].length, `only the winner's own phone pays, once (CS ${JSON.stringify(pays[0])} · YY ${JSON.stringify(pays[1])})`);

    console.log('\nK5. 再来一次 from YY\'s phone; pause; leaving');
    await click(B, '[data-m="again"]');
    const again = await until(async () => (await E(A, () => __kb.game && __kb.game.state === 'count' || __kb.game.state === 'race')) && (await E(B, () => __kb.game && (__kb.game.state === 'count' || __kb.game.state === 'race'))), 8000);
    ok(again, 'YY taps 再来一次: CS\'s phone starts it, and both are racing again without being asked twice');
    await until(async () => (await E(A, () => __kb.game.state)) === 'race', 6000);
    await E(A, () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p' })));
    ok(await until(async () => (await E(B, () => __kb.game.paused)) && /暂停/.test(await panelH(B)), 3000), 'CS pauses: YY\'s race pauses too, and says why');
    await click(B, '[data-m="go"]');
    ok(await until(async () => !(await E(A, () => __kb.game.paused)) && !(await E(B, () => __kb.game.paused)), 3000), 'YY taps 继续: both go on');
    await E(B, () => { const b = document.querySelector('.pgx'); __kb.close(); b && b.click(); });   // YY leaves: ✕ says goodbye
    ok(await until(async () => !!(await E(A, () => __kb.game.peerGone)), 4000), 'YY leaves: CS\'s phone knows at once, and races on');
    ok(!A.p.errs.length && !B.p.errs.length, 'no page errors ' + A.p.errs.concat(B.p.errs).join(' | '));
    await ctx.close();
  }

  if (want('bomb')) {
    console.log('\nB1. 烟花炸弹: asked, each with their own pet, the same maze on both');
    const { ctx, A, B } = await pair(browser, 'bomb');
    await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-bomb').textContent)), 6000);
    ok(await startBomb(A, B, 'coop', 'cat'), 'CS: 一起闯关 › 🤝 › 叫 YY 一起; YY picks the 🐱 and says 出发: both are in the maze');
    const S = (X) => E(X, () => { const G = __kb.game; return { grid: Array.from(G.grid).join(''), loot: G.coop, P: G.players.map((p) => ({ k: p.k, pet: p.pet, x: p.x, y: p.y, me: p.human, r: !!p.remote, st: p.state, h: p.hearts })), E: G.enemies.map((e) => [e.id, e.x, e.y, e.alive]), t: G.t }; });
    let a = await S(A), b = await S(B);
    ok(a.grid === b.grid, 'the same boxes on both phones (the host\'s seed)');
    ok(a.P.find((p) => p.k === 'yy').pet === 'cat' && b.P.find((p) => p.k === 'cs').pet === a.P.find((p) => p.k === 'cs').pet, 'each phone knows the other\'s pet (YY\'s 🐱 on CS\'s phone)');

    console.log('\nB2. Walking, and the monsters, as the other phone has them');
    await E(B, () => { __kb.IN.yy.dirs = ['l']; }); await sleep(900); await E(B, () => { __kb.IN.yy.dirs = []; }); await sleep(500);
    const [ya, yb] = await Promise.all([E(A, () => { const p = __kb.game.players.find((q) => q.k === 'yy'); return [p.x, p.y]; }), E(B, () => { const p = __kb.game.players.find((q) => q.k === 'yy'); return [p.x, p.y]; })]);
    ok(Math.hypot(ya[0] - yb[0], ya[1] - yb[1]) < 0.3, `YY walks: CS's phone has YY where YY is (${yb.map((v) => v.toFixed(2)).join(',')} vs ${ya.map((v) => v.toFixed(2)).join(',')})`);
    let eg = 0; for (let i = 0; i < 8; i++) { const [ea, eb] = await Promise.all([E(A, () => __kb.game.enemies.map((e) => [e.x, e.y])), E(B, () => __kb.game.enemies.map((e) => [e.x, e.y]))]); ea.forEach((v, j) => { if (eb[j]) eg = Math.max(eg, Math.hypot(v[0] - eb[j][0], v[1] - eb[j][1])); }); await sleep(200); }
    ok(eg < 0.8, `the monsters walk the same way on YY's phone (worst ${eg.toFixed(2)} of a square)`);

    console.log('\nB3. A firework placed on YY\'s phone goes off on both');
    await E(A, () => { for (const e of __kb.game.enemies) e.freeze = 1e6; });   // the monsters hold still (on the host's phone, so on both) until the touch below
    await E(B, () => { const p = __kb.game.players.find((q) => q.human); Object.assign(p, { hearts: 3, state: 'ok', shield: 30 }); });   // and YY's own burst won't knock YY down
    await sleep(400);
    const spot = await E(B, () => { const G = __kb.game, p = G.players.find((q) => q.human); return [Math.floor(p.x), Math.floor(p.y)]; });
    await E(B, () => { __kb.IN.yy.bombHit = 1; });
    ok(await until(async () => (await E(B, ([c, r]) => __kb.game.bombs.some((b) => b.c === c && b.r === r), spot)), 600), 'YY sees it at once');
    ok(await until(async () => (await E(A, ([c, r]) => __kb.game.bombs.some((b) => b.c === c && b.r === r && b.own.k === 'yy'), spot)), 1500), '…and CS\'s phone has it, as YY\'s');
    await E(B, () => { __kb.IN.yy.dirs = ['r']; }); await sleep(700); await E(B, () => { __kb.IN.yy.dirs = []; });   // out of the way
    ok(await until(async () => (await E(B, ([c, r]) => __kb.game.flames.has(c + ',' + r), spot)), 4000), 'it goes off: the fire is on YY\'s phone');
    await sleep(1200);
    a = await S(A); b = await S(B);
    ok(a.grid === b.grid, 'the boxes it burned are gone on both phones');

    console.log('\nB4. A monster\'s touch, a pickup, a fall and a pick-up');
    await E(B, () => { const p = __kb.game.players.find((q) => q.human); Object.assign(p, { hearts: 3, state: 'ok', shield: 0, inv: 0 }); });
    await sleep(400);
    const h0 = await E(B, () => __kb.game.players.find((q) => q.human).hearts);
    await E(A, () => { const G = __kb.game, yy = G.players.find((q) => q.k === 'yy'), e = G.enemies.find((x) => x.alive); e.x = yy.ns.x; e.y = yy.ns.y; e.dir = [0, 0]; e.freeze = 0; });
    ok(await until(async () => (await E(B, () => __kb.game.players.find((q) => q.human).hearts)) < h0, 3000), 'a monster walks into YY on CS\'s phone: YY\'s phone counts the hit');
    ok(await until(async () => (await E(A, () => __kb.game.players.find((q) => q.k === 'yy').hearts)) < h0, 3000), '…and CS\'s phone shows YY\'s hearts going down');
    await E(A, () => { const G = __kb.game, yy = G.players.find((q) => q.k === 'yy'); G.items.set(Math.floor(yy.ns.x) + ',' + Math.floor(yy.ns.y), { k: 'photo', born: G.t - 1 }); });
    await sleep(500);
    await E(B, () => { const p = __kb.game.players.find((q) => q.human); p.x += 0.001; });
    ok(await until(async () => (await E(A, () => __kb.game.photos)) >= 1 && (await E(B, () => __kb.game.photos)) >= 1, 4000), 'YY picks up a 📷: it counts on both phones');
    await E(B, () => { const p = __kb.game.players.find((q) => q.human); p.state = 'down'; p.hearts = 0; });
    ok(await until(async () => (await E(A, () => __kb.game.players.find((q) => q.k === 'yy').state)) === 'down', 3000), 'YY is down: CS\'s phone sees it');
    await E(A, () => { const G = __kb.game, me = G.players.find((q) => q.human), yy = G.players.find((q) => q.k === 'yy'); me.x = yy.ns.x; me.y = yy.ns.y; });
    ok(await until(async () => (await E(B, () => __kb.game.players.find((q) => q.human).state)) === 'ok', 3000), 'CS walks over: YY is up again (on YY\'s phone)');

    console.log('\nB5. Into the little house together');
    await E(A, () => { const G = __kb.game; G.enemies.forEach((e) => { e.alive = false; e.die = 0.1; }); });
    ok(await until(async () => !!(await E(B, () => __kb.game.door)), 4000), 'the goal done on CS\'s phone: the little house comes out on YY\'s too');
    const dc = await E(A, () => __kb.game.test.doorCell);
    await E(A, ([c, r]) => { const p = __kb.game.players.find((q) => q.human); p.x = c + 0.5; p.y = r + 0.5; p.hop = null; }, dc);
    await E(B, ([c, r]) => { const p = __kb.game.players.find((q) => q.human); p.x = c + 0.5; p.y = r + 0.5; p.hop = null; p.walk = 0.1; }, dc);
    const won = await until(async () => (await E(A, () => __kb.game.how)) === 'win' && (await E(B, () => __kb.game.how)) === 'win', 6000);
    ok(won, 'both walk in: it is won on both phones');
    await until(async () => !!(await E(A, () => __kb.game.shown)) && !!(await E(B, () => __kb.game.shown)), 4000);
    const pays = await Promise.all([A, B].map((X) => harness(X, () => __harness.log.filter((l) => l[0] === 'pay').length)));
    ok(pays[0] === 1 && pays[1] === 1, `each is paid on their own phone (CS ${pays[0]}, YY ${pays[1]})`);
    const cards = await Promise.all([A, B].map((X) => E(X, () => document.querySelector('#msg .panel .stars').getAttribute('aria-label'))));
    ok(cards[0] === cards[1], `the same stars on both end cards (${cards[0]})`);

    console.log('\nB6. 下一关 from CS\'s phone: YY is asked; then YY leaves mid-maze');
    await click(A, '[data-m="next"]');
    ok(await until(async () => /想和你一起闯/.test(await panelH(B)), 6000), 'CS taps 下一关: YY\'s phone asks again (with the next place)');
    await click(B, '[data-m="go"]');
    ok(await until(async () => (await E(A, () => __kb.game.state)) === 'play' && (await E(B, () => __kb.game.state)) === 'play' && (await E(A, () => __kb.game.PL.id)) === (await E(B, () => __kb.game.PL.id)), 6000), '…and both are in the next maze');
    await E(B, () => { const b = document.querySelector('.pgx'); __kb.close(); b && b.click(); });
    ok(await until(async () => /离开了这一关/.test(await panelH(A)), 5000), 'YY leaves: CS\'s phone says so (a maze needs you both)');
    ok(!A.p.errs.length && !B.p.errs.length, 'no page errors ' + A.p.errs.concat(B.p.errs).join(' | '));
    await ctx.close();

    console.log('\nB7. 对战 on two phones: a round, and the next one');
    const v = await pair(browser, 'bomb');
    await until(async () => /YY 也在这里/.test(await E(v.A, () => document.getElementById('peer-bomb').textContent)), 6000);
    ok(await startBomb(v.A, v.B, 'vs'), '对战 › 🤝: both in round 1');
    await E(v.B, () => { const p = __kb.game.players.find((q) => q.human); p.state = 'out'; p.hearts = 0; });
    ok(await until(async () => (await E(v.A, () => __kb.game.how)) === 'cs' && (await E(v.B, () => __kb.game.how)) === 'cs', 5000), 'YY is out (on YY\'s phone): CS wins the round on both');
    await until(async () => !!(await E(v.B, () => __kb.game.shown)), 4000);
    await click(v.B, '[data-m="next"]');
    ok(await until(async () => (await E(v.A, () => __kb.game.round)) === 2 && (await E(v.B, () => __kb.game.round)) === 2 && (await E(v.A, () => __kb.game.state)) === 'play' && (await E(v.B, () => __kb.game.state)) === 'play', 8000), 'YY taps 下一局: round 2 starts on both, with the same score');
    ok(JSON.stringify(await E(v.A, () => __kb.game.wins)) === JSON.stringify(await E(v.B, () => __kb.game.wins)), 'the same score on both');
    ok(!v.A.p.errs.length && !v.B.p.errs.length, 'no page errors ' + v.A.p.errs.concat(v.B.p.errs).join(' | '));
    await v.ctx.close();
  }

  if (want('junk')) {
    console.log('\nJ. Junk on the wire, our own login elsewhere, an old version');
    const { ctx, A, B } = await pair(browser, 'kart');
    await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)), 6000);
    await startKart(A, B); await until(async () => (await E(A, () => __kb.game.state)) === 'race', 6000);
    const n = await E(A, () => __kb.game && window.__kb && __kb.game.net && 1) && await A.f.evaluate(() => { try { return null; } catch (e) { return null; } });
    const before = await E(A, () => { const k = __kb.game.karts.find((q) => q.k === 'yy'); return [k.x, k.y]; });
    await harness(A, () => {
      const junk = [null, 7, 'x', {}, { t: 'st' }, { t: 'st', v: 1, w: 'yy', n: 5, k: 'nope' }, { t: 'st', v: 1, w: 'yy', n: 0, ts: 1e15, k: [['yy', 'a', 'b']] }, { t: 'ev', v: 1, w: 'yy', q: 'x' },
        { t: 'go', v: 1, w: 'yy', n: 99, g: 'kart', o: { place: 'atlantis' } }, { t: 'go', v: 1, w: 'yy', n: 98, g: 'kart', o: { place: 'sakura', cup: { set: 'x' } } }, { t: 'go', v: 1, w: 'yy', n: 97, g: 'bomb', o: { place: 'garden', mode: 'coop', seed: -4 } },
        { t: 'hi', v: 1, w: 'cs', g: 'kart' }, { t: 'rq', v: 1, w: 'yy', n: 1, k: '<script>' }];
      for (const m of junk) __harness.inject('kb', m);
    });
    await sleep(300);
    const after = await E(A, () => ({ st: __kb.game.state, yy: (() => { const k = __kb.game.karts.find((q) => q.k === 'yy'); return [k.x, k.y]; })() }));
    ok(after.st === 'race' && Math.hypot(after.yy[0] - before[0], after.yy[1] - before[1]) < 30 && !A.p.errs.length, 'junk, a made-up race and messages for another race are dropped; the race goes on');
    await harness(B, () => __harness.inject('kb', { t: 'st', v: 1, w: 'yy', n: 1, ts: 1e12, k: [['yy', 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] }));
    await sleep(200);
    ok(await E(B, () => { const k = __kb.game.karts.find((q) => q.human); return k.x > 2 || k.y > 2; }), 'a message claiming to be YY (our own login on another device) never moves YY\'s own kart');
    await harness(A, () => __harness.inject('kb', { t: 'hi', v: 99, w: 'yy', g: 'kart' }));
    await E(A, () => __kb.close());
    ok(await until(async () => /不是最新/.test(await E(A, () => document.getElementById('peer-kart').textContent)), 2000), 'the partner on an older app: 「…不是最新的：两个人都把 app 关掉重新打开一次」');
    ok(!A.p.errs.length && !B.p.errs.length, 'no page errors ' + A.p.errs.concat(B.p.errs).join(' | '));
    await ctx.close();
  }

  if (want('clock')) {
    console.log('\nC. One clock for a race on two phones (reported 2026-11-28: the first over the line had the longer time)');
    // each phone used to time its own kart by its own game clock — which stops while that phone holds the picture for a
    // hit, and runs slow on a struggling phone — so the finish order could be the opposite of what both of them saw
    const { ctx, A, B } = await pair(browser, 'kart', '&lat=120&jit=60');
    await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)), 8000);
    for (const X of [A, B]) await E(X, () => { window.__goAt = 0; const tick = () => { const G = __kb.game; if (G && G.kind === 'kart' && G.state === 'race' && !window.__goAt) window.__goAt = performance.timeOrigin + performance.now(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    ok(await startKart(A, B), 'a race over a 120 ms line');
    await until(async () => (await E(A, () => window.__goAt)) && (await E(B, () => window.__goAt)), 9000);
    const [ga, gb] = await Promise.all([A, B].map((X) => E(X, () => window.__goAt)));
    ok(Math.abs(ga - gb) < 100, `both count down from the same moment: GO ${Math.round(Math.abs(ga - gb))} ms apart (it was the line's delay, the partner's phone a step ahead)`);
    for (let i = 0; i < 4; i++) { await E(B, () => { __kb.game.freeze = 0.5; }); await sleep(700); }   // YY's phone holds the picture for hits: 2 s
    const finish = (X) => E(X, () => { const G = __kb.game, me = G.karts.find((k) => k.human), s = G.T.S[3]; Object.assign(me, { lap: 3, idx: G.T.N - 2, mid: true, owe: false, x: s.x, y: s.y, h: s.ang, rescue: 0, spin: 0, air: false }); return performance.timeOrigin + performance.now(); });
    const wa = await finish(A); await sleep(300); const wb = await finish(B);
    await until(async () => !!(await E(A, () => __kb.game.shown)) && !!(await E(B, () => __kb.game.shown)), 9000);
    const card = (X) => E(X, () => { const G = __kb.game, cs = G.karts.find((k) => k.k === 'cs'), yy = G.karts.find((k) => k.k === 'yy'); return { h: document.querySelector('#msg .panel h2').textContent, cs: cs.time, yy: yy.time }; });
    const [ca, cb] = await Promise.all([card(A), card(B)]);
    if (!(/CS 第一名/.test(ca.h) && /CS 第一名/.test(cb.h)) || Math.abs((ca.yy - ca.cs) - (wb - wa) / 1000) >= 0.2) console.log('    cards', JSON.stringify(ca), JSON.stringify(cb), 'offsets', JSON.stringify(await Promise.all([A, B].map((X) => E(X, () => ({ role: __kb.NET.role, off: __kb.NET.off, offRtt: __kb.NET.offRtt, rttMin: __kb.NET.rttMin }))))));
    ok(/CS 第一名/.test(ca.h) && /CS 第一名/.test(cb.h), `CS crossed the line ${Math.round(wb - wa)} ms before YY: CS is first on both phones, though YY's phone stopped for 2 s of hits`);
    ok(ca.cs < ca.yy && Math.abs((ca.yy - ca.cs) - (wb - wa) / 1000) < 0.2 && ca.cs === cb.cs && ca.yy === cb.yy, `and the times say so: CS ${ca.cs.toFixed(2)} s, YY ${ca.yy.toFixed(2)} s — ${(ca.yy - ca.cs).toFixed(2)} s apart, as they crossed`);
    ok(!A.p.errs.length && !B.p.errs.length, 'no page errors ' + A.p.errs.concat(B.p.errs).join(' | '));
    await ctx.close();
  }

  if (want('net')) {
    console.log('\nN0. YY\'s 出发 is lost on the way: it is said again until CS\'s phone has started');
    const { ctx, A, B } = await pair(browser, 'kart');
    await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)), 6000);
    await A.f.click('[data-play="kart:net"]'); await click(A, '[data-m="go"]');
    await until(async () => /想和你比/.test(await panelH(B)), 6000);
    await harness(B, () => __harness.setNet({ drop: 1 }));   // everything YY's phone says is lost for a moment…
    await click(B, '[data-m="go"]'); await sleep(900);
    await harness(B, () => __harness.setNet({ drop: 0 }));   // …while CS's hellos keep arriving
    ok(await until(async () => (await E(A, () => __kb.game.state)) !== 'card', 5000), 'CS\'s phone starts all the same');
    await ctx.close();
  }

  if (want('net') || want('rate')) {
    console.log('\nN. A phone network (120 ms, jitter 80 ms, 5% lost): it still works, smoothly; and what it costs');
    const { ctx, A, B } = await pair(browser, 'kart', '&lat=120&jit=80&drop=0.05');
    await until(async () => /YY 也在这里/.test(await E(A, () => document.getElementById('peer-kart').textContent)), 8000);
    ok(await startKart(A, B), 'the race starts over a slow, lossy line');
    await until(async () => (await E(A, () => __kb.game.state)) === 'race' && (await E(B, () => __kb.game.state)) === 'race', 8000);
    await sleep(1000);
    // apart, as in K2: since both phones start at the same moment the karts race side by side, and a bump (each phone
    // pushing its own kart off a copy a moment old) is real but is not what this measures
    { const ci = await E(A, () => __kb.game.karts.find((k) => k.human).idx); await E(B, (ci) => { const G = __kb.game, me = G.karts.find((k) => k.human), i = (ci + 30) % G.T.N, s = G.T.S[i]; Object.assign(me, { x: s.x, y: s.y, h: s.ang, idx: i, v: 12, vx: 0, vy: 0 }); }, ci); }
    await autopilot(A, true); await autopilot(B, true); await sleep(600);
    const s0 = await Promise.all([A, B].map((X) => harness(X, () => __harness.sent())));
    const g = await drawGap(A, B, 8000);
    const s1 = await Promise.all([A, B].map((X) => harness(X, () => __harness.sent())));
    const rate = s1.map((v, i) => (v - s0[i]) / 8);
    await autopilot(A, false); await autopilot(B, false);
    ok(g.n > 600 && g.p90 < 4.5 && g.max < 12, `on a 4G line the partner's kart is drawn ${g.med.toFixed(2)} off typically, ${g.p90.toFixed(2)} nine times in ten, ${g.max.toFixed(2)} at worst (a bump or a spin; a kart is 2.6 long)`);
    ok(rate.every((r) => r <= 10), `messages a second while racing: CS ${rate[0].toFixed(1)}, YY ${rate[1].toFixed(1)} (≤ 10; each is billed twice)`);
    // a lost line for 3 seconds: the finish still arrives
    await harness(B, () => __harness.goDown(3000));
    const finish = (X) => E(X, () => { const G = __kb.game, me = G.karts.find((k) => k.human), s = G.T.S[3]; Object.assign(me, { lap: 3, idx: G.T.N - 2, mid: true, owe: false, x: s.x, y: s.y, h: s.ang, rescue: 0, spin: 0, air: false }); });   // just past the line, its place on the track still just before it: the next frame counts the crossing (whichever way it was pointing)
    await finish(B);
    ok(await until(async () => (await E(A, () => __kb.game.karts.find((k) => k.k === 'yy').done)), 9000), 'YY crosses the line while their line is down: CS\'s phone hears it when it comes back');
    await ctx.close();
    const m = await pair(browser, 'bomb', '&lat=120&jit=80&drop=0.05');
    await until(async () => /YY 也在这里/.test(await E(m.A, () => document.getElementById('peer-bomb').textContent)), 8000);
    ok(await startBomb(m.A, m.B), 'a maze starts over the same line');
    await sleep(1500);
    const t0 = await Promise.all([m.A, m.B].map((X) => harness(X, () => __harness.sent())));
    await m.B.f.evaluate(() => { let i = 0; const dirs = ['r', 'd', 'l', 'u']; window.__walk = setInterval(() => { __kb.IN.yy.dirs = [dirs[(i++ >> 2) % 4]]; }, 250); });
    await sleep(5000);
    await m.B.f.evaluate(() => { clearInterval(window.__walk); __kb.IN.yy.dirs = []; });
    const t1 = await Promise.all([m.A, m.B].map((X) => harness(X, () => __harness.sent())));
    const r2 = t1.map((v, i) => (v - t0[i]) / 5);
    ok(r2.every((r) => r <= 10), `messages a second in a maze with the monsters moving: CS (the host) ${r2[0].toFixed(1)}, YY walking ${r2[1].toFixed(1)} (≤ 10)`);
    ok(!m.A.p.errs.length && !m.B.p.errs.length, 'no page errors ' + m.A.p.errs.concat(m.B.p.errs).join(' | '));
    await m.ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { for (const f of fails) console.log('  ' + f); process.exitCode = 1; }
})();
