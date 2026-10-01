// 12-24 on the REAL thing: the deployed site, the live backend, a throwaway
// couple, both phones' clocks set to the anniversary.
//   node tools/live-anniv-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
// WHEN=2027-12-24T10:00:00+08:00 checks a later year; SITE=… points elsewhere.
//
// What the demo-mode suites cannot show: that a real login on the day turns
// the home into 两周年 (the theme needs start_date, which only the server
// has), and that the free gift is claimed through the UI, stored at 0 coins,
// and seen hanging in the shared room on the partner's phone.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const SITE = process.env.SITE || 'https://yapseng98.github.io/Love-Points-Tracker/';
const FN = 'https://yvllstktmjoedfsgojgs.supabase.co/functions/v1';
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const WHEN = new Date(process.env.WHEN || '2026-12-24T10:00:00+08:00');
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

(async () => {
  const s = Date.now(), u1 = `t${s}_a1`, u2 = `t${s}_a2`;
  console.log(`\n${WHEN.toISOString()} · ${SITE}`);
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  const T1 = r1.data.accessToken, T2 = r2.data.accessToken;
  ok(r1.data.matchId && r1.data.matchId === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  const cfg = await call('/config', { method: 'PUT', token: T1, body: { mode: 'reward', rewardTarget: 100, punishThreshold: -80,
    startDate: '2024-12-24', charName1: 'A1', charName2: 'B2', petName: '测试呆呆', petSpecies: 'dog' } });
  ok(cfg.status === 200, 'together since 2024-12-24, a pet, and 0 小窝币 — the gift must not need any');

  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  async function phone(user) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
    await p.clock.setFixedTime(WHEN);
    // A phone that has been opening the app all along already has a seen
    // list; a brand-new one would seed today's gift into it (§7.16).
    await p.addInitScript(() => { if (localStorage.getItem('decor_seen') === null) localStorage.setItem('decor_seen', '[]'); });
    await p.goto(SITE + '?v=' + s);
    await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
    const pre = await p.evaluate(() => document.documentElement.dataset.festival || '');
    await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
    await p.fill('#sn-username', user); await p.fill('#sn-password', 'Pass123!');
    await p.click('#sn-connect-btn');
    const inOk = await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 }).then(() => true).catch(() => false);
    await sleep(2500);
    const film = await p.evaluate(() => !!document.getElementById('anv-root'));
    await p.evaluate(() => document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary()); await sleep(600);
    return { p, ctx, errs, inOk, pre, film };
  }

  console.log('\nA1 的手机');
  const A = await phone(u1);
  ok(A.inOk, 'logged in on the live site');
  ok(A.film, '第一次打开：小电影的信封先出来');
  const h = await A.p.evaluate(() => ({ f: document.documentElement.dataset.festival, n: document.querySelector('.sky-bg .anniv-num')?.textContent,
    tip: document.getElementById('together-next')?.textContent.trim(), days: document.getElementById('together-days')?.textContent,
    card: document.getElementById('season-card').classList.contains('hidden') ? '' : document.querySelector('#season-card .sc-title')?.textContent }));
  ok(h.f === 'anniv' && h.n === '2', `登录前 ${A.pre || '（无）'} → 登录后首页是两周年（${h.f}，「${h.n}」）`);
  ok(h.days === '731' && /两周年/.test(h.tip), `731 天 · 「${h.tip}」`);
  ok(h.card === '两周年礼物 · 免费收下', `首页卡片：「${h.card}」`);
  await A.p.screenshot({ path: `${SHOTS}/live_anniv_01_home.png` });

  await A.p.click('#season-card .sc-body'); await sleep(2500);
  const shop = await A.p.evaluate(() => ({ tab: document.querySelector('[id^="dtab-"].active')?.id,
    first: document.querySelector('#decor-grid .decor-card .decor-name')?.textContent,
    btn: document.querySelector('#decor-grid .decor-card .decor-btn')?.textContent.trim(),
    coins: document.getElementById('pet-coin-pill')?.textContent }));
  ok(shop.tab === 'dtab-wall' && shop.first === '两周年相框' && shop.btn === '🎁 免费收下',
    `点卡片 → 墙面第一个就是「${shop.first}」·「${shop.btn}」（${shop.coins}）`);
  await A.p.screenshot({ path: `${SHOTS}/live_anniv_02_shop.png` });
  await A.p.click('#decor-grid .decor-card .decor-btn'); await sleep(3500);
  const toast = await A.p.evaluate(() => document.querySelector('.toast')?.textContent || '');
  ok(/收下了「两周年相框」/.test(toast), `提示：${toast}`);
  await A.p.evaluate(() => App.closeDecor()); await sleep(800);
  await A.p.screenshot({ path: `${SHOTS}/live_anniv_03_room.png` });

  const bag = (await call('/bag?type=decor', { token: T2 })).data;
  const row = Array.isArray(bag) && bag.find(r => r.itemId === 'anniv_frame_2');
  ok(row && row.ptsSpent === 0, `后端：一条 anniv_frame_2，记 ${row && row.ptsSpent} 币`);
  const live = (await call('/config', { token: T2 })).data;
  ok(/"bi,50,44"/.test(live.petEquipped || ''), `后端：房间里存的是 bi,50,44（${(live.petEquipped || '').match(/"bi[^"]*"/)}）`);
  const again = await call('/decor-buy', { method: 'POST', token: T2, body: { itemId: 'anniv_frame_2', price: 0 } });
  ok(again.status === 400 && again.data.error === 'already_owned', '另一个人再领 → already_owned（一对情侣只有一个）');

  console.log('\nB2 的手机');
  const B = await phone(u2);
  ok(B.inOk, 'partner logged in');
  await B.p.evaluate(() => App.showPetHome()); await sleep(2500);
  const room = await B.p.evaluate(() => ({ chip: document.getElementById('pet-mood-chip')?.textContent,
    framed: (App._eqTest()?.items || []).some(o => o.i === 'anniv_frame_2'),
    svg: [...document.querySelectorAll('#pet-decor-layer .decor-piece')].length }));
  ok(/💞\s*两周年/.test(room.chip) && room.framed, `对方的小窝：「${(room.chip || '').trim()}」，相框挂着`);
  await B.p.evaluate(() => { App.decorTab('wall'); App.openDecor(); }); await sleep(800);
  const theirs = await B.p.evaluate(() => { const c = [...document.querySelectorAll('#decor-grid .decor-card')].find(x => /两周年相框/.test(x.textContent));
    return c && { price: c.querySelector('.decor-price')?.textContent, btn: c.querySelector('.decor-btn')?.textContent.trim() }; });
  ok(theirs && theirs.price === '已拥有' && /已摆放/.test(theirs.btn), `对方的商店：「${theirs && theirs.price}」·「${theirs && theirs.btn}」`);
  await B.p.screenshot({ path: `${SHOTS}/live_anniv_04_partner_shop.png` });

  ok(!A.errs.length && !B.errs.length, '两部手机都没有报错 ' + [...A.errs, ...B.errs].join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  process.exit(fail ? 1 : 0);
})();
