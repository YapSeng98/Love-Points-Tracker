// "Who am I" is the LOGIN, never the home page's whose-points switch.
// Serve the repo first:  python3 -m http.server 8765   (or APP_URL=http://localhost:8766/index.html)
//   node tools/identity-test.js
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves the couple behind)
//
// S.activeChar is also the switch you flip to add points FOR your partner. Found
// 2026-10-27 on the live birthday run: with it on the partner, a phone wrote its
// own weather into the partner's slot and showed its own weather as theirs, and
// a letter or photo was stamped as written BY the partner — who then found their
// "own" letter, while you could unseal yours and use up their 未拆. The server
// trusted the request for who wrote it, so it was the only thing that knew.
// A throwaway couple on the live backend; the service key (tools/backup.local.json)
// only reads rows back.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const BASE = 'https://yvllstktmjoedfsgojgs.supabase.co', FN = `${BASE}/functions/v1`;
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const SERVICE = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'backup.local.json'), 'utf8')).serviceKey;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
const rows = async (path) => (await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const s = Date.now(), u1 = `t${s}_id1`, u2 = `t${s}_id2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  const T1 = r1.data.accessToken, T2 = r2.data.accessToken, match = r1.data.matchId;
  ok(match && match === r2.data.matchId, `throwaway couple ${u1} / ${u2}`);
  await call('/config', { method: 'PUT', token: T1, body: { charName1: 'A1', charName2: 'B2' } });

  console.log('\n1. The server decides who wrote it');
  const forged = await call('/letters', { method: 'POST', token: T1, body: { charId: 'char2', text: 'A1 写的', date: new Date().toISOString() } });
  let lt = (await rows(`letters?id=eq.${forged.data.id}&select=char,opened,text`))[0];
  ok(lt && lt.char === 'char1', `A1 posting with charId "char2" is stored as A1's (${lt && lt.char})`);
  await call(`/letters-id?id=${forged.data.id}`, { method: 'PUT', token: T1, body: { opened: true } });
  lt = (await rows(`letters?id=eq.${forged.data.id}&select=char,opened,text`))[0];
  ok(lt.opened === false, 'the writer cannot unseal their own letter');
  const edit = await call(`/letters-id?id=${forged.data.id}`, { method: 'PUT', token: T2, body: { text: '改掉' } });
  const del = await call(`/letters-id?id=${forged.data.id}`, { method: 'DELETE', token: T2 });
  lt = (await rows(`letters?id=eq.${forged.data.id}&select=char,opened,text`))[0];
  ok(lt && lt.text === 'A1 写的' && edit.status === 403 && del.status === 403, `the partner can neither rewrite nor delete it (${edit.status}/${del.status})`);
  await call(`/letters-id?id=${forged.data.id}`, { method: 'PUT', token: T2, body: { opened: true } });
  lt = (await rows(`letters?id=eq.${forged.data.id}&select=opened`))[0];
  ok(lt && lt.opened === true, 'the partner opens it');
  const ph = await call('/photos', { method: 'POST', token: T1, body: { charId: 'char2', image: PIXEL, caption: '', date: '2026-10-27' } });
  const pr = (await rows(`photos?id=eq.${ph.data.id}&select=char`))[0];
  ok(pr && pr.char === 'char1', `a photo A1 posts as "char2" is A1's (${pr && pr.char})`);

  console.log('\n2. A1\'s phone, switched to adding points for B2');
  await call('/config', { method: 'PUT', token: T2, body: { wx2: JSON.stringify({ k: 'snow', h: 9, at: Date.now(), d: 1 }) } });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Singapore' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo/, r => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.connect);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); document.getElementById('setup-overlay')?.classList.remove('hidden'); });
  await p.fill('#sn-username', u1); await p.fill('#sn-password', 'Pass123!');
  await p.click('#sn-connect-btn');
  await p.waitForFunction(() => document.getElementById('setup-overlay')?.classList.contains('hidden'), null, { timeout: 45000 });
  await sleep(3000);
  await p.evaluate(() => App.selectChar('char2')); await sleep(300);

  const pw = await p.evaluate(() => App._partnerWxTest());
  const card = await p.evaluate(() => document.getElementById('partner-wx')?.textContent.replace(/\s+/g, ' ').trim() || '');
  ok(pw && pw.kind === 'snow' && /B2那边/.test(card), `the weather card shows B2's weather under B2's name: 「${card}」`);
  await p.evaluate(() => App._publishWeatherTest('rain')); await sleep(2500);
  const cfg = (await rows(`config?match_id=eq.${match}&select=wx_1,wx_2`))[0];
  ok(/"rain"/.test(cfg.wx_1 || '') && /"snow"/.test(cfg.wx_2 || ''), `A1's weather goes into A1's slot, B2's is untouched (wx_1 ${(cfg.wx_1 || '').slice(0, 14)}… wx_2 ${(cfg.wx_2 || '').slice(0, 14)}…)`);

  await p.evaluate(() => App.showLetters()); await sleep(1500);
  await p.evaluate(() => App.openComposeLetter()); await sleep(400);
  await p.fill('#letter-compose-text', '从 A1 的手机写的'); await p.evaluate(() => App.sendLetter()); await sleep(3000);
  const mineRow = (await rows(`letters?match_id=eq.${match}&text=eq.${encodeURIComponent('从 A1 的手机写的')}&select=char`))[0];
  ok(mineRow && mineRow.char === 'char1', `a letter written with the switch on B2 is from A1 (${mineRow && mineRow.char})`);
  const list = await p.evaluate(() => [...document.querySelectorAll('.letter-card')].map(c => ({ mine: c.classList.contains('mine'), sealed: c.classList.contains('sealed'), who: c.querySelector('.letter-card-sender')?.textContent })));
  ok(list.length === 2 && list.every(c => c.mine && !c.sealed && c.who === 'A1'), `A1's list: both letters are A1's own, none sealed ${JSON.stringify(list)}`);

  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed   accounts: ${u1}, ${u2}`);
  process.exit(fail ? 1 : 0);
})();
