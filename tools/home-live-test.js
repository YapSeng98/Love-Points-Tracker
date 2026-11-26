// 我们的家 on two logged-in phones: the local app, the LIVE backend, a throwaway couple.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/home-live-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
//
// What has to hold between two phones: each sees the other arrive and leave, walk (tap and hold) and
// wave and hug; the garden is ONE garden — a planting, a watering, a flower picked on one phone is on
// the other within a moment and in the saved game; two phones acting on the same pot at the same
// instant end in one agreed result (both waterings count, one flower is picked once, one seed wins a
// pot) with the loser told why; an upgrade bought on one phone builds the house on both; the pet EXP
// and the 小窝币 follow the flowers; and where you stood when you left is what the partner sees.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const BASE = 'https://yvllstktmjoedfsgojgs.supabase.co', FN = `${BASE}/functions/v1`;
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const SHOTS = process.env.SHOTS || '/tmp';
const WHEN = '2026-11-25T15:00:00+08:00', TODAY = '2026-11-25';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
async function phone(browser, user, { w = 390, h = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g|ERR_CONNECTION|409/.test(m.text())) errs.push(m.text()); });
  await p.clock.setFixedTime(new Date(WHEN));
  await p.route(/open-meteo/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('hm_hinted', '1'); } catch (e) {} });
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await p.evaluate(() => { document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary(); });
  return { p, ctx, errs };
}
const st = (p) => p.evaluate(() => HomeGame.test.state());
const until = async (p, fn, arg, ms = 8000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } };
const idle = async (p) => until(p, () => { const s = HomeGame.test.state(); return s && !s.pending && !s[s.me].path; }, null, 15000);
const toastOf = (p) => p.evaluate(() => document.querySelector('.hm-toast')?.textContent || '');
// the house is full screen now: the menus open sheets, and walking to the garden is a button in 🌱 花园
const sheet = async (p, kind) => { if (await p.evaluate(() => !!document.querySelector('.hm-sheet'))) await p.click('.hm-sheet [data-a="close-sheet"]'); await p.click(`[data-sheet="${kind}"]`); await sleep(150); };
const toGarden = async (p) => { await sheet(p, 'garden'); await p.click('.hm-sheet [data-go="garden"]'); };
const openHouse = async (P) => { await P.p.evaluate(() => App.openHome()); await until(P.p, () => !!(window.HomeGame && HomeGame.test.state()), null, 20000); await sleep(400); };

(async () => {
  const s = Date.now(), u1 = `t${s}_hm1`, u2 = `t${s}_hm2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  const A_T = r1.data.accessToken;
  // a pet, and 1600 points so the wallet holds 800 小窝币 (EXP / 2) — enough for 小平房 at 600
  await call('/config', { method: 'PUT', token: A_T, body: { charName1: 'A1', charName2: 'B2', petSpecies: 'dog', petName: '测试狗', petBase: 0, startDate: '2024-12-24' } });
  await call('/entries', { method: 'POST', token: A_T, body: { pts: 1600, charId: 'char1', catName: '测试分', icon: '🧪', desc: 'test points', date: TODAY, month: TODAY.slice(0, 7) } });

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const A = await phone(browser, u1), B = await phone(browser, u2, { w: 430, h: 932 });

  console.log('\n1. Both come home');
  await openHouse(A); await openHouse(B);
  const metA = await until(A.p, () => HomeGame.test.state().partner.on, null, 20000), metB = await until(B.p, () => HomeGame.test.state().partner.on, null, 20000);
  ok(metA && metB, 'each phone sees the other one arrive');
  const sa = await st(A.p), sb = await st(B.p);
  ok(sa.me === 'cs' && sb.me === 'yy', 'each phone is its own login (A1 = CS, B2 = YY)');
  ok(sa.lv === 1 && sb.lv === 1 && sa.rev === 0 && sb.rev === 0, 'a new couple: 小木屋, nothing saved yet');
  ok(!(await A.p.evaluate(() => document.querySelector('.hm-ch.hm-off'))), 'nobody is drawn as away');
  const coins0 = await A.p.evaluate(() => App._coinTest());
  ok(coins0.balance === 800, `the wallet: ${JSON.stringify(coins0)}`);

  console.log('\n2. Walking, seen from the other phone');
  await toGarden(A.p);
  const walked = await until(B.p, () => { const s = HomeGame.test.state(); return Math.abs(s.cs.x - 20) < 1.2 && !s.cs.path; }, null, 8000);
  const sa2 = await st(A.p), sb2 = await st(B.p);
  ok(walked && Math.abs(sa2.cs.x - sb2.cs.x) < 1.2, `A1 walks to the garden; B2's phone has A1 there too (${sa2.cs.x.toFixed(1)} / ${sb2.cs.x.toFixed(1)})`);
  ok(sb2.cs.where === '花园', `B2's phone says where: ${sb2.cs.where}`);
  // push the stick right for a second, then let go: the other phone keeps up and stops in the same place
  const joy = await A.p.locator('.hm-joy').boundingBox();
  await A.p.mouse.move(joy.x + joy.width / 2, joy.y + joy.height / 2); await A.p.mouse.down(); await A.p.mouse.move(joy.x + joy.width * .95, joy.y + joy.height / 2, { steps: 3 }); await sleep(1100); await A.p.mouse.up();
  await idle(A.p); await sleep(1500);
  const sa3 = await st(A.p), sb3 = await st(B.p);
  ok(sa3.cs.x > sa2.cs.x + 10, `pushing the stick walked A1 to the right (${sa2.cs.x.toFixed(1)} → ${sa3.cs.x.toFixed(1)})`);
  ok(Math.abs(sa3.cs.x - sb3.cs.x) < 2 && Math.abs(sa3.cs.y - sb3.cs.y) < 1 && !sb3.cs.hold, `B2's copy stopped where A1 stopped (${sa3.cs.x.toFixed(1)},${sa3.cs.y.toFixed(1)} / ${sb3.cs.x.toFixed(1)},${sb3.cs.y.toFixed(1)})`);
  // into the room: a walk to the back of the 客厅 (round by the front door) — the other phone has A1 there, drawn as small
  await A.p.evaluate(() => { const g = HomeGame.test.geo(); HomeGame.test.walk(66, 0, g.band[0][0] + .5); }); await idle(A.p);
  const deep = await until(B.p, () => { const s = HomeGame.test.state(), g = HomeGame.test.geo(); return Math.abs(s.cs.y - (g.band[0][0] + .5)) < .6 && Math.abs(s.cs.x - 66) < 1.2 && !s.cs.path; }, null, 9000);
  const sa4 = await st(A.p), sb4 = await st(B.p);
  ok(deep && Math.abs(sa4.cs.s - sb4.cs.s) < .02 && sb4.cs.where === '客厅', `A1 walks to the back of the 客厅; B2's phone has A1 there, as small (y ${sa4.cs.y.toFixed(1)} / ${sb4.cs.y.toFixed(1)}, ${sb4.cs.s.toFixed(2)})`);
  // the stick diagonally, out of the room and left: the same path on B2's phone
  await A.p.evaluate(() => HomeGame.test.hold(-1, 1)); await sleep(700); await A.p.evaluate(() => HomeGame.test.stop());
  await sleep(1800);
  const sa5 = await st(A.p), sb5 = await st(B.p);
  ok(sa5.cs.y > sa4.cs.y + 3 && sa5.cs.x < sa4.cs.x - 4 && Math.abs(sa5.cs.x - sb5.cs.x) < 2 && Math.abs(sa5.cs.y - sb5.cs.y) < 1, `out and left at once: B2's phone walked it too (${sa5.cs.x.toFixed(1)},${sa5.cs.y.toFixed(1)} / ${sb5.cs.x.toFixed(1)},${sb5.cs.y.toFixed(1)})`);
  ok(sb3.lead === 'peer', 'the pet follows whoever moved last — on B2\'s phone that is A1');

  console.log('\n3. Waving and hugging');
  await A.p.click('[data-a="wave"]'); await sleep(900);
  ok(/A1 在跟你招手/.test(await toastOf(B.p)), `B2 sees the wave: 「${await toastOf(B.p)}」`);
  // B2 walks to A1; both phones then have them side by side
  await B.p.evaluate(() => { const s = HomeGame.test.state(); HomeGame.test.walk(s.cs.x + 5, 0, s.cs.y); });
  await idle(B.p); await sleep(1500);
  ok(await until(A.p, () => HomeGame.test.state().near, null, 6000), 'A1\'s phone sees B2 come and stand next to A1');
  ok(await A.p.evaluate(() => !document.querySelector('[data-a="hug"]').disabled), '…so 抱抱 is on');
  await A.p.click('[data-a="hug"]'); await sleep(250);
  const hugA = await A.p.evaluate(() => document.querySelectorAll('.hm-ch.hm-hug').length), hugB = await until(B.p, () => document.querySelectorAll('.hm-ch.hm-hug').length === 2, null, 3000);
  ok(hugA === 2 && hugB, 'the hug plays on both phones');

  console.log('\n4. One garden: plant on one phone, it is planted on both');
  await toGarden(A.p); await idle(A.p);
  await A.p.evaluate(() => HomeGame.test.potAction(0)); await sleep(300);
  ok(await A.p.evaluate(() => !!document.querySelector('.hm-sheet')), 'an empty pot asks which seed');
  await A.p.click('.hm-seed[data-seed="sunflower"]');
  await idle(A.p);
  const p1 = await until(B.p, () => HomeGame.test.state().pots[0].seed === 'sunflower', null, 6000);
  ok(p1, 'B2\'s pot 1 has the sunflower too');
  const g1 = await call('/game-save?game=home', { token: A_T });
  ok(g1.data.rev >= 1 && g1.data.data.pots[0].seed === 'sunflower' && g1.data.by === 'char1', `…and the saved game has it (rev ${g1.data.rev})`);
  ok(/A1 种下了向日葵/.test(await toastOf(B.p)), `B2 is told: 「${await toastOf(B.p)}」`);

  console.log('\n5. Both water the same pot at the same instant');
  const id = (await st(A.p)).pots[0].id;
  await Promise.all([A.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id), B.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id)]);
  await idle(A.p); await idle(B.p); await sleep(2500);
  await A.p.evaluate(() => HomeGame.test.load()); await B.p.evaluate(() => HomeGame.test.load()); await sleep(1500);
  const w = await call('/game-save?game=home', { token: A_T }), wa = await st(A.p), wb = await st(B.p);
  ok(w.data.data.pots[0].w[TODAY] === 3, `both waterings landed in the save (bits ${w.data.data.pots[0].w[TODAY]}), neither undid the other`);
  ok(wa.pots[0].stage === 2 && wb.pots[0].stage === 2, `watered by both the same day → two steps, on both phones (${wa.pots[0].stage} / ${wb.pots[0].stage})`);
  ok(wa.pots[0].mine && wa.pots[0].theirs && wb.pots[0].mine && wb.pots[0].theirs, 'each phone knows both of them watered today');
  ok(wa.rev === w.data.rev && wb.rev === w.data.rev && !wa.pending && !wb.pending, `both phones are on the saved rev ${w.data.rev}, nothing left unsaved`);
  const again = await A.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 0, id }), id);
  ok(again === false, 'a second watering by the same person the same day does nothing');

  console.log('\n6. A flower both pick at once is picked once');
  const cur = await call('/game-save?game=home', { token: A_T });
  const days = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'];
  const bloomSave = { ...cur.data.data, pots: [cur.data.data.pots[0], { id: 'bloomtest', seed: 'daisy', at: '2026-11-20', w: Object.fromEntries(days.map(d => [d, 1])) }] };
  const put = await call('/game-save', { method: 'PUT', token: A_T, body: { game: 'home', rev: cur.data.rev, data: bloomSave } });
  ok(put.status === 200, 'a daisy that has had its five waterings, put in pot 2');
  await A.p.evaluate(() => HomeGame.test.load()); await B.p.evaluate(() => HomeGame.test.load());
  ok(await until(A.p, () => HomeGame.test.state().pots[1].bloom, null, 8000) && await until(B.p, () => HomeGame.test.state().pots[1].bloom, null, 8000), 'both phones show it in flower');
  const expBefore = await A.p.evaluate(() => App._coinTest());
  const [pa, pb] = await Promise.all([A.p.evaluate(() => HomeGame.test.act({ t: 'pick', pot: 1, id: 'bloomtest' })), B.p.evaluate(() => HomeGame.test.act({ t: 'pick', pot: 1, id: 'bloomtest' }))]);
  ok(pa && pb, 'both phones picked it, each before hearing the other');
  await idle(A.p); await idle(B.p); await sleep(2500);
  await A.p.evaluate(() => HomeGame.test.load()); await B.p.evaluate(() => HomeGame.test.load()); await sleep(1500);
  const after = await call('/game-save?game=home', { token: A_T });
  ok(after.data.data.picked === 1 && after.data.data.album.daisy === 1 && !after.data.data.pots[1], `the save counts ONE flower (picked ${after.data.data.picked}, album ${JSON.stringify(after.data.data.album)})`);
  const fa = await st(A.p), fb = await st(B.p);
  ok(fa.view.picked === 1 && fb.view.picked === 1 && fa.pots[1].empty && fb.pots[1].empty, 'both phones agree: one flower, pot 2 empty');
  const tA = await toastOf(A.p), tB = await toastOf(B.p);
  const picker = (after.data.data.log.slice(-1)[0] || [])[1];
  const loser = picker === 'char1' ? { name: 'B2', toast: tB, winner: 'A1' } : { name: 'A1', toast: tA, winner: 'B2' };
  ok(new RegExp(`${loser.winner} 先把这朵花收进图鉴了`).test(loser.toast), `the one who lost the race (${loser.name}) is told who picked it: 「${loser.toast}」 (saved picker ${picker}; toasts A「${tA}」 B「${tB}」)`);
  ok(fa.view.log.slice(-1)[0][1] === picker && fb.view.log.slice(-1)[0][1] === picker, 'both phones credit the same person in the album');
  const expAfter = await A.p.evaluate(() => App._coinTest());
  ok(expAfter.exp === expBefore.exp + 20 && expAfter.balance === expBefore.balance + 10, `the flower is pet EXP +20 and 小窝币 +10 (${expBefore.exp} → ${expAfter.exp}, 🪙 ${expBefore.balance} → ${expAfter.balance})`);

  console.log('\n7. Two seeds for one pot at the same instant: one wins, on both phones');
  const [sa7, sb7] = await Promise.all([A.p.evaluate(() => HomeGame.test.act({ t: 'plant', pot: 1, seed: 'daisy' })), B.p.evaluate(() => HomeGame.test.act({ t: 'plant', pot: 1, seed: 'sunflower' }))]);
  await idle(A.p); await idle(B.p); await sleep(2500);
  await A.p.evaluate(() => HomeGame.test.load()); await B.p.evaluate(() => HomeGame.test.load()); await sleep(1500);
  const s7 = await call('/game-save?game=home', { token: A_T }), a7 = await st(A.p), b7 = await st(B.p);
  const won = s7.data.data.pots[1] && s7.data.data.pots[1].seed;
  ok(sa7 && sb7 && (won === 'daisy' || won === 'sunflower'), `one seed is in the saved pot: ${won}`);
  ok(a7.pots[1].seed === won && b7.pots[1].seed === won && a7.pots[1].id === b7.pots[1].id, 'both phones show the same planting');
  ok(/刚在这个花盆里种了别的/.test((await toastOf(A.p)) + (await toastOf(B.p))), 'the other one is told the pot was taken');

  console.log('\n8. An upgrade bought on one phone builds the house on both');
  await sheet(A.p, 'house');
  ok(await A.p.evaluate(() => !document.querySelector('[data-buy="hm_lv2"]').disabled), '小平房 can be bought with what is in the wallet');
  await A.p.click('[data-buy="hm_lv2"]');
  ok(await until(A.p, () => HomeGame.test.state().lv === 2, null, 15000), 'A1 lives in 小平房');
  ok(await until(B.p, () => HomeGame.test.state().lv === 2, null, 15000), 'B2\'s phone built it too, without reopening');
  const c8 = await A.p.evaluate(() => App._coinTest()), c8b = await B.p.evaluate(() => App._coinTest());
  ok(c8.balance === expAfter.balance - 600 && c8b.balance === c8.balance, `600 小窝币 came out of the one wallet, the same on both phones (🪙 ${c8.balance} / ${c8b.balance})`);
  ok((await st(B.p)).pots.length === 3, 'the bigger garden has 3 pots');
  await A.p.screenshot({ path: `${SHOTS}/hmlive_a.png` }); await B.p.screenshot({ path: `${SHOTS}/hmlive_b.png` });

  console.log('\n8a. Watering a pot the partner planted a moment ago, before their save reaches this phone');
  // B2 hears A1's planting at once but can't load the save that has it (its reads are held back): the
  // watering must wait for that save, not be dropped. home-live-test lost it one run in four before.
  const HOLD = /functions\/v1\/game-save\?game=home/;
  await B.p.route(HOLD, async r => { if (r.request().method() === 'GET') await sleep(3000); r.continue().catch(() => {}); });
  await A.p.evaluate(() => HomeGame.test.act({ t: 'plant', pot: 2, seed: 'daisy' }));
  ok(await until(B.p, () => { const q = HomeGame.test.state().pots[2]; return !!q && q.seed === 'daisy'; }, null, 8000), 'B2 sees the new daisy at once (heard over the channel, not loaded yet)');
  const id8 = (await st(B.p)).pots[2].id;
  ok(await B.p.evaluate((id) => HomeGame.test.act({ t: 'water', pot: 2, id }), id8), 'B2 waters it straight away');
  await sleep(5000); await B.p.unroute(HOLD);
  await idle(A.p); await idle(B.p); await sleep(2000);
  const p8 = (await call('/game-save?game=home', { token: A_T })).data.data.pots[2];
  ok(!!p8 && p8.seed === 'daisy' && !!(((p8.w || {})[TODAY] || 0) & 2), `the watering waited for the planting's save and was kept (bits ${p8 && (p8.w || {})[TODAY]})`);
  ok(!(await st(B.p)).pending, '…and nothing is left unsaved on B2');

  console.log('\n8b. Sitting on the sofa together');
  await A.p.click('[data-a="sit"]'); await idle(A.p);
  ok(await until(B.p, () => document.querySelector('.hm-ch:not(.hm-me)').classList.contains('hm-sit'), null, 8000), 'A1 sits down, and B2\'s phone shows A1 on the sofa');
  await B.p.click('[data-a="sit"]'); await idle(B.p); await sleep(400);
  const bothA = await until(A.p, () => document.querySelectorAll('.hm-ch.hm-sit').length === 2, null, 8000), bothB = await B.p.evaluate(() => document.querySelectorAll('.hm-ch.hm-sit').length === 2);
  ok(bothA && bothB, 'B2 sits next to A1: both sitting, on both phones');
  const seats = await A.p.evaluate(() => { const s = HomeGame.test.state(); return Math.abs(s.cs.x - s.yy.x); });
  ok(seats > 2 && seats < 12, `side by side, not on top of each other (${seats.toFixed(1)} apart)`);
  ok(/一起坐在沙发上/.test((await toastOf(A.p)) + (await toastOf(B.p))), '「一起坐在沙发上 💕」');
  await toGarden(B.p);
  ok(await until(A.p, () => document.querySelectorAll('.hm-ch.hm-sit').length === 1, null, 8000), 'B2 gets up and walks off; on A1\'s phone too');

  console.log('\n8c. Off the screen: a tag at the edge walks you to them');
  ok(await until(A.p, () => { const e = document.querySelector('.hm-edge'); return !!e && !e.hidden && e.classList.contains('hm-edge-l') && /B2/.test(e.textContent); }, null, 10000), 'B2 walked off A1\'s screen to the left: a 「‹ B2」 tag at that edge');
  await A.p.click('.hm-edge');
  const walkedOver = await until(A.p, () => document.querySelector('.hm-edge').hidden && HomeGame.test.state().cs.where === '花园' && HomeGame.test.state().near, null, 15000);
  ok(walkedOver, `tapping it walks A1 over to B2 (standing up from the sofa), and the tag goes ${walkedOver ? '' : JSON.stringify(await A.p.evaluate(() => { const s = HomeGame.test.state(); return { cs: s.cs, yy: s.yy, camX: s.camX, near: s.near, partner: s.partner, edge: document.querySelector('.hm-edge').hidden, sit: document.querySelector('.hm-ch.hm-me').classList.contains('hm-sit') }; }))}`);

  console.log('\n9. Leaving, and coming back');
  await A.p.evaluate(() => HomeGame.test.walk(70, 0)); await idle(A.p);
  const leftAt = (await st(A.p)).cs.x;
  await A.p.evaluate(() => App.closeHome());
  ok(await until(B.p, () => !HomeGame.test.state().partner.on, null, 6000), 'B2 sees A1 leave');
  ok(/A1 出门了/.test(await toastOf(B.p)), `「${await toastOf(B.p)}」`);
  await sleep(3000);
  const s9 = await call('/game-save?game=home', { token: A_T });
  ok(s9.data.data.pos && s9.data.data.pos.char1 && Math.abs(s9.data.data.pos.char1.x - leftAt) < .2, `where A1 stood is saved (${JSON.stringify(s9.data.data.pos)})`);
  await B.p.evaluate(() => HomeGame.test.load()); await sleep(1500);
  const st9 = await B.p.evaluate(() => document.querySelector('.hm-status').textContent);
  ok(/A1 不在家 · 上次在/.test(st9), `B2's phone says where A1 was: 「${st9}」`);
  await openHouse(A);
  ok(await until(B.p, () => HomeGame.test.state().partner.on, null, 15000), 'A1 comes home again and B2 sees it');
  const s9a = await st(A.p);
  ok(Math.abs(s9a.cs.x - leftAt) < 1, `A1 is back where they left (${s9a.cs.x.toFixed(1)})`);

  console.log('\n10. Nothing broke');
  ok(!A.errs.length && !B.errs.length, `no page errors ${JSON.stringify([A.errs.slice(0, 3), B.errs.slice(0, 3)])}`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
