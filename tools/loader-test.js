// The app.js loader in index.html (CLAUDE.md §7.27): a deploy must reach the
// phone on the very next open, and an open with nothing new must not download
// app.js again. Served here the way GitHub Pages serves it — max-age=600 and
// an ETag — so a loader that leaned on the cache would keep the old file.
// Chrome and WebKit (the iPhone's engine):
//   node tools/loader-test.js
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), os = require('os');
const PW = process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const { chromium, webkit } = require(PW);
const REPO = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-'));
for (const f of ['index.html', 'app.js', 'ui3d.css']) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
const setVersion = (v) => {
  const p = path.join(dir, 'app.js');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/const APP_VERSION = '[^']*'/, `const APP_VERSION = '${v}'`));
};
let hits = { full: 0, notModified: 0, head: 0 };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  const body = fs.readFileSync(file);
  const etag = 'W/"' + crypto.createHash('md5').update(body).digest('hex') + '"';
  const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
  const head = { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'max-age=600', ETag: etag };
  if (req.method === 'HEAD') { if (name === 'app.js') hits.head++; res.writeHead(200, head); return res.end(); }
  if (req.headers['if-none-match'] === etag) {
    if (name === 'app.js') hits.notModified++;
    res.writeHead(304, head); return res.end();
  }
  if (name === 'app.js') hits.full++;
  res.writeHead(200, head); res.end(body);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/index.html`;
  const engines = [['Chrome', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }]];
  const wk = fs.readdirSync(path.join(os.homedir(), 'Library/Caches/ms-playwright')).find(d => d.startsWith('webkit-'));
  if (wk) engines.push(['WebKit', webkit, { executablePath: path.join(os.homedir(), 'Library/Caches/ms-playwright', wk, 'pw_run.sh') }]);
  for (const [name, engine, opts] of engines) {
    console.log(`\n${name}`);
    let browser;
    try { browser = await engine.launch(opts); } catch (e) { console.log('  (skipped: could not launch —', String(e).split('\n')[0], ')'); continue; }
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    const version = async () => {
      await p.waitForFunction(() => typeof App !== 'undefined' && document.getElementById('app-version-tag')?.textContent, null, { timeout: 20000 });
      return p.evaluate(() => document.getElementById('app-version-tag').textContent);
    };
    setVersion('v-test-1'); hits = { full: 0, notModified: 0, head: 0 };
    await p.goto(url);
    ok(/v-test-1/.test(await version()), `first open runs app.js (${await version()})`);
    ok(hits.full === 1, `…downloading it once (${JSON.stringify(hits)})`);

    hits = { full: 0, notModified: 0, head: 0 };
    await p.goto(url);
    ok(/v-test-1/.test(await version()), 'open again: the same app.js runs');
    ok(hits.full === 0, `…without downloading it again (${JSON.stringify(hits)})`);

    setVersion('v-test-2'); hits = { full: 0, notModified: 0, head: 0 };
    await p.goto(url);
    ok(/v-test-2/.test(await version()), `a deploy reaches the very next open, inside max-age (${await version()})`);
    ok(hits.full === 1, `…by downloading only then (${JSON.stringify(hits)})`);

    const boots = await p.evaluate(() => document.querySelectorAll('script[src*="app.js"]').length);
    ok(boots === 1, `app.js is added to the page exactly once (${boots})`);
    ok(errs.length === 0, `no page errors ${errs.slice(0, 2).join(' | ')}`);

    // the old way still works when fetch is unavailable
    await ctx.addInitScript(() => { delete window.fetch; });
    hits = { full: 0, notModified: 0, head: 0 };
    await p.goto(url);
    ok(/v-test-2/.test(await version()), 'without fetch it falls back to the cache-busting tag');
    await ctx.clearCookies();
    // a HEAD that fails (offline captive portal, odd proxy) must still boot the app
    const c2 = await browser.newContext(), p2 = await c2.newPage();
    await c2.route(/app\.js$/, r => r.request().method() === 'HEAD' ? r.abort() : r.continue());
    await p2.goto(url);
    await p2.waitForFunction(() => typeof App !== 'undefined', null, { timeout: 20000 }).then(() => ok(true, 'a failed HEAD still boots, cache-busted'), () => ok(false, 'a failed HEAD still boots, cache-busted'));
    await c2.close();
    await browser.close();
  }
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
