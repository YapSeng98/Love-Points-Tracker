// 🏎️ 卡丁车 and 💣 烟花炸弹 inside the app (CLAUDE.md §7.37): opened from 小游戏, full screen, in a frame of the app's own.
// Who holds the phone and the names come from the app; the first win on a track or a cup and the first clear of a maze
// pay +1 through the ledger (once each, at most +3 a day); the records join the synced progress; ✕ and Esc go back;
// the app holds still behind it; 倾斜 is allowed (the same site); the game follows the app's day and night; phone and
// laptop. The games themselves: tools/kartbomb-test.js.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/kartbomb-app-test.js
const { chromium, webkit } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; fails.push(m); console.log('  ❌', m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function demoPage(browser, { w = 390, h = 844, mobile = true, look = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: mobile, ...(browser.browserType().name() === 'chromium' ? { isMobile: mobile } : {}) });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  await p.route(/open-meteo/, (r) => r.abort());
  await p.goto(APP_URL + (look ? `?look=${look}` : ''));
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => App.demoMode());
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^kb_|^cg_paid_|^mg_done_/.test(k)) localStorage.removeItem(k); localStorage.setItem('kb_coach_kart', '5'); localStorage.setItem('kb_coach_bomb', '5'); });
  await p.evaluate(() => App.demoMode());
  return p;
}
const entries = (p, re) => p.evaluate((src) => { const d = JSON.parse(localStorage.getItem('love_score_data')), r = new RegExp(src); return Object.values(d.entries || {}).flat().filter((e) => r.test(e.desc || '')).map((e) => `${e.charId}:${e.pts}:${e.desc}`); }, re.source);
async function frameOf(p) {
  await p.waitForSelector('body > .kb-root iframe');
  for (let i = 0; i < 80; i++) { const f = p.frames().find((x) => /kartbomb\.html/.test(x.url())); if (f) { try { if (await f.evaluate(() => !!window.__kb)) return f; } catch (e) {} } await sleep(100); }
  throw new Error('the game page did not load');
}
async function winRace(fr, place) {   // you cross the line first; the others are a lap behind
  await fr.evaluate((place) => { __kb.close(); __kb.open('kart', { mode: '1p', place, skipCard: true }); }, place);
  await sleep(150);
  await fr.evaluate(() => { const G = __kb.game; G.state = 'race'; G.paused = false; const me = G.karts.find((k) => k.human), s = G.T.S[3];
    for (const k of G.karts) if (k === me) Object.assign(k, { lap: 3, idx: G.T.N - 2, mid: true, owe: false, x: s.x, y: s.y }); else k.lap = 1;
    for (let n = 0; n < 200; n++) G.update(1 / 60); });
  await fr.waitForSelector('#msg:not([hidden]) .panel', { timeout: 6000 });
  for (let i = 0; i < 40; i++) { const t = await fr.evaluate(() => { const e = document.querySelector('#msg .paid'); return e && !e.hidden ? e.textContent : ''; }); if (t) return t; await sleep(100); }
  return '';
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

  console.log('\nA1. Opening from 小游戏: a frame of the app\'s own, full screen, the app holding still behind it');
  const p = await demoPage(browser);
  await p.evaluate(() => App.openGames()); await sleep(300);
  const cards = await p.evaluate(() => ['kart', 'bomb'].map((g) => { const b = document.querySelector(`.mg-root .mg-pick[data-g="${g}"]`); return b ? b.textContent : ''; }));
  ok(/卡丁车/.test(cards[0]) && /每条赛道第一次拿第一 \+1/.test(cards[0]) && /一部手机/.test(cards[0]), '小游戏 lists 🏎️ 卡丁车, how it pays, and that it is played on one phone');
  ok(/烟花炸弹/.test(cards[1]) && /每个地方第一次过关 \+1/.test(cards[1]), '…and 💣 烟花炸弹');
  await p.click('.mg-root .mg-pick[data-g="kart"]');
  let fr = await frameOf(p);
  const open = await p.evaluate(() => { const r = document.querySelector('body > .kb-root'), f = r.querySelector('iframe'), rb = r.getBoundingClientRect(), cs = getComputedStyle(r);
    return { list: !document.querySelector('.mg-root'), cover: document.documentElement.classList.contains('game-cover'), z: +cs.zIndex, full: rb.width === innerWidth && rb.height === innerHeight, src: f.getAttribute('src') }; });
  const ver = await p.evaluate(() => (document.querySelector('#settings-version, .app-version') || {}).textContent || '');
  ok(open.list && open.cover && open.z >= 150 && open.full && /kartbomb\.html\?v=v20\d\d/.test(open.src) && /game=kart/.test(open.src), `it opens full screen over everything (z ${open.z}), the list closes, the app behind holds still, the page loads fresh for this version`);
  // edge to edge (2026-11-29): the frame fills the screen, and the phone's safe areas reach the game as its own CSS variables
  // (a frame has none of its own) — given here to the app's probe, then changed as when the phone turns
  const edge = await p.evaluate(() => { const f = document.querySelector('body > .kb-root iframe').getBoundingClientRect(); return f.left === 0 && f.top === 0 && f.width === innerWidth && f.height === innerHeight; });
  await p.addStyleTag({ content: '.kb-safe { padding: 0px 59px 21px 59px !important; }' }); await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400);
  const got1 = await fr.evaluate(() => { const d = document.documentElement; return ['--sat', '--sar', '--sab', '--sal'].map((k) => d.style.getPropertyValue(k)).join(' '); });
  const xLeft1 = await fr.evaluate(() => Math.round(document.querySelector('.pgx').getBoundingClientRect().left));   // (the menu's ✕: the game's own is hidden here)
  await p.addStyleTag({ content: '.kb-safe { padding: 59px 0px 34px 0px !important; }' }); await p.evaluate(() => window.dispatchEvent(new Event('orientationchange'))); await sleep(500);
  const got2 = await fr.evaluate(() => { const d = document.documentElement; return ['--sat', '--sar', '--sab', '--sal'].map((k) => d.style.getPropertyValue(k)).join(' '); });
  ok(edge && got1 === '0px 59px 21px 59px' && got2 === '59px 0px 34px 0px' && xLeft1 >= 59, `the game fills the screen to its edges (no bands), and gets the phone's safe areas from the app — sideways «${got1}», turned upright «${got2}» — so its ✕ sits clear of the notch (${xLeft1} px in)`);
  await p.addStyleTag({ content: '.kb-safe { padding: 0px !important; }' }); await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(300);
  const inside = await fr.evaluate(() => ({ who: document.querySelector('.who').hidden, other: document.querySelector('[aria-labelledby="h-bomb"]').hidden, h1: document.querySelector('header h1').textContent, x: !!document.querySelector('.pgx'), me: __kb.game ? null : true, inApp: document.documentElement.classList.contains('in-app') }));
  ok(inside.who && inside.other && /卡丁车/.test(inside.h1) && inside.x && inside.inApp, 'inside: never asks 「我是 CS/YY」 (the app knows), only 卡丁车 is shown, and there is a ✕ back');
  await fr.click('[data-play="kart:1p"]'); await fr.waitForSelector('#msg:not([hidden]) [data-o="ctl:tilt"]');
  ok(await fr.evaluate(() => !document.querySelector('#msg [data-o="ctl:tilt"]').disabled), '倾斜 can be chosen: the frame is the app\'s own site, so the phone\'s motion is allowed');
  await fr.evaluate(() => __kb.close());

  console.log('\nA2. Points: the first win on each track pays +1, once, at most +3 a day — and a cup');
  const t1 = await winRace(fr, 'sakura');
  const e1 = await entries(p, /^卡丁车/);
  ok(/\+1/.test(t1) && e1.length === 1 && /^char1:1:卡丁车 · 樱花小镇 第一名$/.test(e1[0]), `winning 樱花小镇 pays +1 to the one holding the phone (“${t1}”, ${e1[0]})`);
  const t2 = await winRace(fr, 'sakura');
  ok(/已经拿过/.test(t2) && (await entries(p, /^卡丁车/)).length === 1, `winning it again pays nothing (“${t2}”)`);
  await winRace(fr, 'beach'); const t4 = await winRace(fr, 'snow'); const t5 = await winRace(fr, 'candy');
  const e5 = await entries(p, /^卡丁车/);
  ok(/\+1/.test(t4) && /拿满/.test(t5) && e5.length === 3, `two more tracks pay +1 each; the fourth that day says the +3 is used up (${e5.length} entries)`);
  const rec = await p.evaluate(() => ({ local: JSON.parse(localStorage.getItem('kb_prog_cs') || 'null'), prog: App._progTest.local().kb }));
  ok(rec.local && rec.local.kart.sakura && rec.local.kart.sakura.place === 1 && JSON.stringify(rec.prog) === JSON.stringify(rec.local), 'your best place and time on each track are kept as yours, and are part of the progress the app syncs to your other phones');
  const m = await p.evaluate(() => App._progTest.merge({ kb: { kart: { sakura: { place: 2, time: 50 } }, bomb: { garden: { stars: 1, time: 90 } } } }, { kb: { kart: { sakura: { place: 1, time: 55 }, cup: 1, park: { place: 3, time: 70 } }, bomb: { garden: { stars: 3, time: 120 } } } }).kb);
  ok(m.kart.sakura.place === 1 && m.kart.sakura.time === 50 && m.kart.cup === 1 && m.kart.park.place === 3 && m.bomb.garden.stars === 3 && m.bomb.garden.time === 90, 'two phones\' records merge to the best of each: the better place, the faster time, more stars, a cup won anywhere');
  const today = await p.evaluate(() => (document.getElementById('today-card') || {}).textContent || '');
  ok(/小游戏 \+3/.test(today), '首页\'s 今天 shows the 小游戏 points');

  console.log('\nA3. 💣 烟花炸弹: the first clear of a maze pays');
  await fr.evaluate(() => __kb.close()); await sleep(100);   // leave the race: in a race the game has its own ⏸ and 回到菜单
  await fr.click('.pgx'); await sleep(300);
  const closed = await p.evaluate(() => ({ gone: !document.querySelector('body > .kb-root'), cover: document.documentElement.classList.contains('game-cover') }));
  ok(closed.gone && !closed.cover, '✕ goes back to the app, and the app comes back to life');
  await p.evaluate(() => App.openGames()); await sleep(200); await p.click('.mg-root .mg-pick[data-g="bomb"]');
  fr = await frameOf(p);
  ok(await fr.evaluate(() => /烟花炸弹/.test(document.querySelector('header h1').textContent) && document.querySelector('[aria-labelledby="h-kart"]').hidden), 'opening 烟花炸弹 shows only 烟花炸弹');
  await fr.evaluate(() => __kb.open('bomb', { mode: 'coop', place: 'garden', two: false })); await fr.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await fr.click('#msg [data-m="go"]'); await sleep(200);
  await fr.evaluate(() => { const G = __kb.game, step = (n) => { for (let i = 0; i < n; i++) G.update(1 / 60); };   // the critters gone, the little house opens; both of you walk in
    G.paused = false; G.state = 'play'; G.enemies.length = 0; if (G.boss) G.boss = null; for (const q of G.players) q.inv = 0; step(2);
    const [dc, dr] = G.test.doorCell; G.players[0].x = dc + 0.5; G.players[0].y = dr + 0.5; step(60); G.players[1].x = dc + 0.5; G.players[1].y = dr + 0.5; step(90); });
  await fr.waitForSelector('#msg:not([hidden]) .panel', { timeout: 6000 }); await sleep(600);
  const bt = await fr.evaluate(() => { const e = document.querySelector('#msg .paid'); return e && !e.hidden ? e.textContent : ''; });
  const be = await entries(p, /^烟花炸弹/);
  ok(/\+1/.test(bt) && be.length === 1 && /烟花炸弹 · 花园 过关$/.test(be[0]), `clearing 花园 pays +1 (“${bt}”)`);
  await fr.evaluate(() => __kb.close()); await sleep(100);
  await fr.focus('body').catch(() => {}); await fr.evaluate(() => window.focus()); await p.keyboard.press('Escape'); await sleep(300);
  ok(await p.evaluate(() => !document.querySelector('body > .kb-root')), 'Esc on the game\'s own page goes back to the app too');

  console.log('\nA3b. YY\'s phone: YY drives YY\'s kart, YY is paid, the record is YY\'s');
  await p.evaluate(() => { App.selectChar('char2'); });   // demo has one phone, so the whose-points switch is who holds it (a logged-in phone uses the login, §6)
  await p.evaluate(() => App.openKB('kart')); fr = await frameOf(p);
  const yyName = await p.evaluate(() => window.__kbHost.me);
  await fr.evaluate(() => { __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); });
  const yyKart = await fr.evaluate(() => __kb.game.karts.find((k) => k.human).k);
  const ty = await winRace(fr, 'sakura');
  const ey = await entries(p, /^卡丁车/);
  const yyRec = await p.evaluate(() => ({ yy: JSON.parse(localStorage.getItem('kb_prog_yy') || 'null'), cs: JSON.parse(localStorage.getItem('kb_prog_cs') || 'null') }));
  ok(yyName === 'yy' && yyKart === 'yy', `on YY's phone the game knows it is YY and YY drives (host ${yyName}, kart ${yyKart})`);
  ok(/\+1/.test(ty) && ey.filter((e) => e.startsWith('char2:1:')).length === 1, `YY's first win on 樱花小镇 pays YY, though CS already won there (“${ty}”)`);
  ok(yyRec.yy && yyRec.yy.kart.sakura && yyRec.cs && yyRec.cs.kart.beach, 'YY\'s record is kept as YY\'s, and CS\'s is left alone');
  await fr.evaluate(() => __kb.close()); await p.evaluate(() => { App.closeKB(); App.selectChar('char1'); });

  console.log('\nA4. Day and night, phone and laptop, both looks');
  await p.evaluate(() => App.openKB('kart')); fr = await frameOf(p);
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await sleep(200);
  const dark = await fr.evaluate(() => ({ t: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await sleep(200);
  const light = await fr.evaluate(() => ({ t: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
  ok(dark.t === 'dark' && light.t === 'light' && dark.bg !== light.bg, `the game follows the app's night and day (${dark.bg} / ${light.bg})`);
  const band = async (t) => { await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t); await sleep(50); return p.evaluate(() => getComputedStyle(document.querySelector('body > .kb-root')).backgroundColor); };
  const bands = [await band('light'), await band('dark')]; await band('light');
  ok(bands[0] === 'rgb(251, 245, 250)' && bands[1] === 'rgb(22, 19, 42)', `the bands round the frame (home bar, a notch sideways) are the game's own background by day and by night (${bands.join(' / ')})`);
  await p.evaluate(() => App.closeKB());

  console.log('\nA5. The app\'s song waits while a game with its own music is open');
  await p.evaluate(async () => { const a = document.getElementById('bg-audio'); a.muted = true; try { await a.play(); } catch (e) {} });
  const s0 = await p.evaluate(() => !document.getElementById('bg-audio').paused);
  await p.evaluate(() => App.openKB('bomb')); await frameOf(p);
  const s1 = await p.evaluate(() => document.getElementById('bg-audio').paused);
  const pref = await p.evaluate(() => localStorage.getItem('music_on'));
  await p.evaluate(() => App.closeKB()); await sleep(300);
  const s2 = await p.evaluate(() => !document.getElementById('bg-audio').paused);
  ok(s0 && s1 && s2, `playing before → paused while the game is open → playing again after (${s0}/${s1}/${s2})`);
  await p.evaluate(() => document.getElementById('bg-audio').pause());
  await p.evaluate(() => App.openKB('kart')); await frameOf(p); await p.evaluate(() => App.closeKB()); await sleep(300);
  ok(await p.evaluate(() => document.getElementById('bg-audio').paused) && pref === (await p.evaluate(() => localStorage.getItem('music_on'))), 'a song that was off stays off, and the saved 🎵 setting is never changed');
  ok(!p.errs.length, 'no page errors in the app ' + p.errs.join(' | '));
  await p.context().close();
  for (const [w, h, mobile, look] of [[390, 844, true, ''], [844, 390, true, ''], [1280, 800, false, ''], [390, 844, true, 'classic']]) {
    const q = await demoPage(browser, { w, h, mobile, look });
    await q.evaluate(() => App.openGames()); await sleep(200);
    await q.click('.mg-root .mg-pick[data-g="bomb"]'); const f2 = await frameOf(q);
    const r = await q.evaluate(() => { const f = document.querySelector('body > .kb-root iframe').getBoundingClientRect(); return f.width === innerWidth && f.height === innerHeight; });
    const pg = await f2.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, x: (() => { const b = document.querySelector('.pgx').getBoundingClientRect(); return b.left >= 0 && b.top >= 0; })() }));
    await f2.click('[data-play="bomb:coop"]'); await f2.waitForSelector('#msg:not([hidden]) [data-m="1"]'); await f2.click('#msg [data-m="1"]'); await f2.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await f2.click('#msg [data-m="go"]'); await sleep(300);
    const play = await f2.evaluate(() => { const G = __kb.game; return G && G.state === 'play' && G.players.some((x) => x.human); });
    ok(r && pg.over <= 0 && pg.x && play, `${w}×${h}${look ? ' ' + look : ''}${mobile ? '' : ' (laptop)'}: the game fills the screen, nothing scrolls sideways, ✕ in reach, a maze starts`);
    ok(!q.errs.length, `${w}×${h}: no page errors ` + q.errs.join(' | '));
    await q.context().close();
  }
  await browser.close();

  console.log('\nA6. On an iPhone\'s engine (WebKit): opens, races, pays, goes back');
  const fs = require('fs'), path = require('path'), cache = path.join(process.env.HOME, 'Library/Caches/ms-playwright');
  const dir = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('webkit-')).sort().pop() : null;
  const wk = dir ? await webkit.launch({ executablePath: path.join(cache, dir, 'pw_run.sh') }).catch((e) => { console.log('  (WebKit would not start: ' + e.message.split('\n')[0] + ')'); return null; }) : null;
  if (!wk) console.log('  (no WebKit here — skipped)');
  else {
    const w = await demoPage(wk, { w: 390, h: 844, mobile: true });
    await w.evaluate(() => App.openGames()); await sleep(300); await w.click('.mg-root .mg-pick[data-g="kart"]');
    const wf = await frameOf(w);
    const wIn = await wf.evaluate(() => ({ who: document.querySelector('.who').hidden, h1: document.querySelector('header h1').textContent, me: window.parent.__kbHost.me }));
    const size = await w.evaluate(() => { const f = document.querySelector('body > .kb-root iframe').getBoundingClientRect(); return [Math.round(f.width), Math.round(f.height), innerWidth, innerHeight]; });
    ok(wIn.who && /卡丁车/.test(wIn.h1) && wIn.me === 'cs' && size[0] === size[2] && size[1] === size[3], `WebKit: the frame fills the screen (${size.join('×')}) and knows who is playing`);
    const wt = await winRace(wf, 'night');
    ok(/\+1/.test(wt) && (await entries(w, /星空夜路/)).length === 1, `WebKit: a first win pays +1 (“${wt}”)`);
    await wf.evaluate(() => __kb.close()); await sleep(100); await wf.click('.pgx'); await sleep(300);
    ok(await w.evaluate(() => !document.querySelector('body > .kb-root') && !document.documentElement.classList.contains('game-cover')), 'WebKit: ✕ goes back to the app');
    ok(!w.errs.length, 'WebKit: no page errors ' + w.errs.join(' | '));
    await wk.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { for (const f of fails) console.log('  ' + f); process.exitCode = 1; }
})();
