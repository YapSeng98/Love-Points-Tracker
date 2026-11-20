// How fast the app FEELS on a phone: a returning partner opening it, adding
// points, and opening each screen — CPU slowed 4× and a 4G-ish network
// (60 ms extra latency, 12 Mbit down), against the LIVE backend.
// It serves the repo itself the way GitHub Pages does — gzip, ETag,
// max-age=600, byte ranges — because python's http.server has no cache
// headers and no compression, and so says nothing true about what a phone
// downloads. APP_URL=… points it at another server instead.
//   node tools/speed-test.js            prints a table; RUNS=5 for steadier medians
//   node supabase/cleanup-test-accounts.mjs --yes      (it leaves a couple behind)
//
// It reports, it does not judge — except for the few waits that must never
// come back (BUDGET below), which fail the run. Network times swing ±50% run to
// run, so compare medians, never one run.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
let APP_URL = process.env.APP_URL || '';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib'), crypto = require('crypto');
// GitHub Pages, as far as a phone can tell: gzip for text, a weak ETag,
// Cache-Control: max-age=600, 304 on If-None-Match, 206 for a Range.
function pagesServer(root) {
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.svg': 'image/svg+xml' };
  return http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(root, name);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const st = fs.statSync(file), ext = path.extname(file);
    const etag = `W/"${Math.floor(st.mtimeMs / 1000).toString(16)}-${st.size.toString(16)}"`;
    const head = { 'Content-Type': (TYPES[ext] || 'application/octet-stream'), 'Cache-Control': 'max-age=600', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    if (req.method === 'HEAD') { res.writeHead(200, head); return res.end(); }
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = +range[1] || 0, end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    let body = fs.readFileSync(file);
    if (/text|javascript|json|svg/.test(head['Content-Type']) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body); head['Content-Encoding'] = 'gzip'; }
    res.writeHead(200, { ...head, 'Content-Length': body.length }); res.end(body);
  });
}
const RUNS = +process.env.RUNS || 3;
const BASE = 'https://yvllstktmjoedfsgojgs.supabase.co', FN = `${BASE}/functions/v1`;
const KEY = 'sb_publishable_YEULeHekm3gNb3zGHI90mw_36KV7XLB';   // the public key app.js ships with
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { status: r.status, data: d };
}
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };

// Waits a person notices. A screen that answers a tap must show SOMETHING at
// once; only the data may arrive later.
const BUDGET = { tables: 300, history: 300, shop: 300, letters: 300, room: 300, addScore: 300 };

(async () => {
  const s = Date.now(), u1 = `t${s}_sp1`, u2 = `t${s}_sp2`;
  const r1 = await call('/auth-register', { method: 'POST', body: { username: u1, password: 'Pass123!', charId: 'char1' } });
  const r2 = await call('/auth-register', { method: 'POST', body: { username: u2, password: 'Pass123!', charId: 'char2', pairCode: r1.data.pairCode } });
  const T = r1.data.accessToken;
  if (!(r1.data.matchId && r1.data.matchId === r2.data.matchId)) throw new Error('could not make a couple');
  await call('/config', { method: 'PUT', token: T, body: { charName1: 'A1', charName2: 'B2', startDate: '2024-01-05', mode: 'reward', rewardTarget: 300, petName: '豆豆', petSpecies: 'dog' } });
  const cats = [['🍳', '做早餐', 5], ['💌', '说晚安', 2], ['🧹', '做家务', 8], ['🎁', '小惊喜', 10], ['😤', '发脾气', -5], ['⏰', '迟到', -3]];
  const catIds = [];
  for (const [icon, name, pts] of cats) catIds.push((await call('/categories', { method: 'POST', token: T, body: { icon, name, pts, active: true } })).data.id);
  for (const [icon, name, minPts] of [['🧋', '奶茶', 50], ['🎬', '看电影', 150], ['✈️', '旅行', 300]]) await call('/rewards', { method: 'POST', token: T, body: { icon, name, minPts, desc: '测试' } });
  // a busy month: 120 entries across both partners
  const month = new Date().toISOString().slice(0, 7);
  for (let b = 0; b < 12; b++) {
    await Promise.all(Array.from({ length: 10 }, (_, i) => {
      const n = b * 10 + i, c = cats[n % cats.length];
      return call('/entries', { method: 'POST', token: T, body: { catId: catIds[n % cats.length], catName: c[0] + ' ' + c[1], icon: c[0], pts: c[2], desc: n % 4 ? '' : 'fake note ' + n, charId: n % 2 ? 'char2' : 'char1', date: `${month}-0${1 + (n % 9)}` } });
    }));
  }
  console.log(`couple ${u1} / ${u2}, 120 entries\n`);

  let server = null;
  if (!APP_URL) {
    server = pagesServer(process.env.ROOT ? path.resolve(process.env.ROOT) : path.join(__dirname, '..'));
    await new Promise(r => server.listen(0, r));
    APP_URL = `http://localhost:${server.address().port}/index.html`;
  }
  // Weather is kept out by DNS, not page.route(): routing turns the HTTP cache
  // off, and then every open looks like a first visit.
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--host-resolver-rules=MAP *.open-meteo.com ~NOTFOUND'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Singapore', isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 12e6 / 8, uploadThroughput: 4e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0, reqs = [], byUrl = {};
  const urlOf = {};
  cdp.on('Network.responseReceived', e => { urlOf[e.requestId] = e.response.url; });
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; const u = decodeURIComponent((urlOf[e.requestId] || '?').replace(/[?#].*/, '').replace(/.*\//, '')); byUrl[u] = (byUrl[u] || 0) + e.encodedDataLength; });
  cdp.on('Network.requestWillBeSent', e => { if (/functions\/v1|auth\/v1/.test(e.request.url) && e.request.method !== 'OPTIONS') reqs.push(e.request.url.replace(/.*\/v1\//, '').replace(/\?.*/, '')); });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));

  const R = {};
  const put = (k, v) => { (R[k] = R[k] || []).push(v); };
  // ms from "now" until fn() is true in the page; polled every animation frame
  const until = (fn, arg, timeout = 30000) => p.evaluate(async ([src, arg, timeout]) => {
    const f = eval(src), t0 = performance.now();
    while (!f(arg)) { if (performance.now() - t0 > timeout) return null; await new Promise(r => requestAnimationFrame(r)); }
    return performance.now() - t0;
  }, [String(fn), arg, timeout]);
  // Start watching BEFORE the tap, so nothing that happens in between is missed.
  // (evaluateHandle would wait for a returned promise, so park it on window.)
  const watch = (fn, arg) => p.evaluate(([src, arg]) => {
    const f = eval(src), t0 = performance.now();
    window.__speedWatch = new Promise(res => { (function tick() { if (f(arg)) res(performance.now() - t0); else requestAnimationFrame(tick); })(); setTimeout(() => res(null), 30000); });
  }, [String(fn), arg]);
  const tapThen = async (sel, fn, arg) => {   // tap, then time until fn() holds
    await watch(fn, arg);
    await p.evaluate(sel => { const el = document.querySelector(sel); if (el) el.click(); }, sel);
    return p.evaluate(() => window.__speedWatch);
  };

  for (let run = 0; run < RUNS; run++) {
    // ── open the app as a returning partner ──────────────────────────────
    bytes = 0; reqs = []; byUrl = {};
    const t0 = Date.now();
    await p.goto(APP_URL + (run ? '' : ''), { waitUntil: 'commit' });
    await p.waitForFunction(() => typeof App !== 'undefined' && App.connect, null, { timeout: 60000 });
    put('app.js ready', Date.now() - t0);
    // read once it has happened: app.js can now be running before the first paint
    const fcp = await p.waitForFunction(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime, null, { timeout: 10000 }).then(h => h.jsonValue(), () => null);
    put('splash painted', fcp);
    if (run === 0) {   // first time on this phone: sign in once so later runs are "returning"
      await p.evaluate(() => { document.querySelector('.sp-btn').click(); });
      await p.waitForSelector('#setup-overlay:not(.hidden)');
      await p.fill('#sn-username', u1); await p.fill('#sn-password', 'Pass123!');
      await p.click('#sn-connect-btn');
      await p.waitForFunction(() => document.getElementById('setup-overlay').classList.contains('hidden'), null, { timeout: 60000 });
      await sleep(2500);
      continue;
    }
    // the splash is up; the saved session loads behind it
    const behind = await until(() => App._scoreTest().c1 !== 0);
    put('data loaded behind splash', behind == null ? null : Date.now() - t0);
    await sleep(300);
    await p.evaluate(() => { document.querySelector('.sp-btn').click(); });
    await p.waitForSelector('#setup-overlay:not(.hidden)');
    await p.fill('#sn-password', 'Pass123!');
    put('继续 → home', await tapThen('#sn-connect-btn', () => document.getElementById('setup-overlay').classList.contains('hidden')));
    put('KB on open', Math.round(bytes / 1024));
    put('API calls on open', reqs.length);
    if (run === 1) {
      console.log('  calls on open:', reqs.join(' '));
      console.log('  biggest downloads:', Object.entries(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, b]) => `${u} ${Math.round(b / 1024)}KB`).join(', '));
    }
    await sleep(2500);
    await p.evaluate(() => { document.getElementById('anv-root') && App.closeAnniversary && App.closeAnniversary(); document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });

    // ── add points with a tile ──────────────────────────────────────────
    await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));   // the welcome toast is still up
    const before = await p.evaluate(() => document.getElementById('score-number').textContent);
    const tile = await p.evaluate(() => { const t = [...document.querySelectorAll('.cat-card.positive')][0]; t.id = 'speed-tile'; return !!t; });
    if (tile) {
      await p.evaluate(() => { const t0 = performance.now(); window.__toast = new Promise(res => { (function tick() { if (document.querySelector('.toast')) res(performance.now() - t0); else requestAnimationFrame(tick); })(); setTimeout(() => res(null), 30000); }); });
      put('tap tile → score moves', await tapThen('#speed-tile', b => document.getElementById('score-number').textContent !== b, before));
      put('tap tile → toast', await p.evaluate(() => window.__toast));
      await sleep(2500);
    }

    // ── each screen: time to SHOW, and time until its data is in ────────
    const screens = [
      ['tables', '#nav-tables', () => document.getElementById('modal-tables').classList.contains('open'),
        () => document.querySelectorAll('#modal-tables-content .tier-row, #modal-tables-content .tier-item, #modal-tables-content [class*="tier"]').length > 0,
        () => App.closeModal('modal-tables')],
      ['history', '#nav-history', () => document.getElementById('modal-history').classList.contains('open'),
        () => document.getElementById('modal-history').classList.contains('open'),
        () => App.closeModal('modal-history')],
      ['shop', '#nav-shop', () => document.getElementById('shop-page').classList.contains('open'),
        () => !!document.querySelector('#shop-content-shop .shop-empty, #shop-content-shop .shop-item, #shop-content-shop .shop-card'),
        () => document.getElementById('shop-page').classList.remove('open')],
    ];
    for (const [name, sel, shown, ready, close] of screens) {
      await p.evaluate(src => { const f = eval(src), t0 = performance.now(); window.__ready = new Promise(res => { (function tick() { if (f()) res(performance.now() - t0); else requestAnimationFrame(tick); })(); setTimeout(() => res(null), 30000); }); }, String(ready));
      put(name + ' shows', await tapThen(sel, shown));
      put(name + ' data in', await p.evaluate(() => window.__ready));
      await sleep(600); await p.evaluate(`(${close})()`); await sleep(500);
    }
    // letters and the room have no nav button — they open from home cards
    for (const [name, open, shown, ready, close] of [
      ['letters', () => App.showLetters(), () => document.getElementById('letter-page').classList.contains('open'), () => !document.querySelector('#letter-page .loading'), () => App.closeLetters()],
      ['room', () => { document.getElementById('pet-decor-layer').innerHTML = ''; App.showPetHome(); }, () => document.getElementById('pet-page').classList.contains('open'), () => document.querySelectorAll('#pet-decor-layer .decor-piece').length > 0, () => App.closePetHome()],
    ]) {
      await p.evaluate(([s1, s2]) => {
        const a = eval(s1), b = eval(s2), t0 = performance.now(); let sh = null;
        window.__pg = new Promise(res => { (function tick() { if (sh == null && a()) sh = performance.now() - t0; if (sh != null && b()) res([sh, performance.now() - t0]); else requestAnimationFrame(tick); })(); setTimeout(() => res([sh, null]), 30000); });
      }, [String(shown), String(ready)]);
      await p.evaluate(`(${open})()`);
      const [a, b] = await p.evaluate(() => window.__pg);
      put(name + ' shows', a); put(name + ' data in', b);
      await sleep(600); await p.evaluate(`(${close})()`); await sleep(500);
    }
  }

  console.log(`\n  median of ${RUNS - 1} returning opens (CPU 4×, 4G)\n`);
  const keys = Object.keys(R);
  for (const k of keys) console.log('  ' + k.padEnd(28) + String(med(R[k])).padStart(7) + (/KB|calls/.test(k) ? '' : ' ms') + '   ' + R[k].map(x => x == null ? '–' : Math.round(x)).join(' / '));
  let fail = 0;
  for (const [k, max] of Object.entries(BUDGET)) {
    const key = k === 'addScore' ? 'tap tile → score moves' : k + ' shows';
    const m = med(R[key] || []);
    if (process.env.BUDGET !== '0' && (m == null || m > max)) { fail++; console.log(`  ❌ ${key}: ${m} ms (budget ${max})`); }
  }
  if (errs.length) { fail++; console.log('  ❌ page errors:', errs.slice(0, 3)); }
  console.log(fail ? `\n${fail} over budget` : '\nall within budget');
  await browser.close();
  if (server) server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
