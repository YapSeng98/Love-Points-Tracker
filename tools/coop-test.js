// 一起回家 and 默契拍拍 inside the app (coop.js, CLAUDE.md §7.33), on one phone:
// every level played through by a bot for two people and for one person
// switching, the pet that follows, the points (first clear only, +3 a day), the
// beat game's scoring, and both looks. The two-phone game: tools/coop-live-test.js.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-test.js            LEVELS=1,5,20 for a few
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = fs.readFileSync(path.join(__dirname, 'coop-bot.js'), 'utf8');

async function demoPage(browser, { w = 390, h = 844, scheme = 'light', pet = 'dog', mobile = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo/, r => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => App.demoMode());
  await p.evaluate(async (pet) => {
    await App.quickEntry('c1'); await new Promise(r => setTimeout(r, 300));
    const d = JSON.parse(localStorage.getItem('love_score_data'));
    d.petName = pet ? '豆豆' : ''; d.petSpecies = pet || ''; d.petBase = 0;
    localStorage.setItem('love_score_data', JSON.stringify(d));
    for (const k of Object.keys(localStorage)) if (/^cg_|^cgb_|^mg_done_/.test(k)) localStorage.removeItem(k);
  }, pet);
  await p.evaluate(() => App.demoMode());
  await sleep(300);
  return { p, ctx, errs };
}
const openCoop = async (p, kind = 'home') => { await p.evaluate(k => App.openCoop(k), kind); await p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 }); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const only = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : Array.from({ length: 50 }, (_, k) => k + 1);   // every level (50 since 2026-11-24)

  console.log('\n1. The doors and the home screen');
  {
    const { p, ctx, errs } = await demoPage(browser);
    await p.evaluate(() => App.openGames());
    const picks = await p.evaluate(() => [...document.querySelectorAll('.mg-pick')].map(b => b.dataset.g));
    ok(picks[0] === 'coop' && picks[1] === 'beat' && picks.includes('catch') && picks.includes('cards'), `🎮 小游戏 lists 一起回家 and 默契拍拍 first: ${picks.join(' ')}`);
    await p.click('.mg-pick[data-g="coop"]');
    await p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 10000 });
    ok(await p.evaluate(() => !document.querySelector('.mg-root')), 'the games list closes behind it');
    const home = await p.evaluate(() => ({ online: document.querySelector('.cg-home [data-mode="online"]').disabled, text: document.querySelector('.cg-home').textContent }));
    // the three ways to play, and the 50 levels one tap in, under 自由选关 › the first world
    home.modes = await p.evaluate(() => [...document.querySelectorAll('.cg-home .cg-mode b, .cg-home .cg-endless h4')].map(b => b.textContent.replace(/\s+/g, '').replace('新', '')).join(' '));
    await p.click('[data-go="free"]'); await p.click('.cg-wcard[data-w="0"]');
    home.locked = await p.evaluate(() => [...document.querySelectorAll('.cg-lv')].map(b => b.disabled));
    ok(home.modes === '故事模式 自由选关 一直走下去', `the start screen is the three ways to play: ${home.modes}`);
    ok(home.online, 'not signed in (demo): 各用自己的手机 is off');
    ok(/豆豆 会跟着你们/.test(home.text), 'your own pet is named as the one who comes along');
    ok(JSON.stringify(home.locked) === '[false,true,true,true,true]', 'one phone: only 1-1 is open at first (5 levels in a world)');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at 390');
    ok(await p.evaluate(() => !!CoopGames.test.G.petImg), 'the pet is drawn from the app\'s own pet picture');
    await p.click('.cg-home [data-a="x"]'); await sleep(200);   // ✕ (on a world's screen the first round button is ‹ back)
    ok(await p.evaluate(() => !document.querySelector('.cg-home, .cg-stage') && document.documentElement.style.overflow === ''), 'closing leaves nothing behind');
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
  {
    const { p, ctx } = await demoPage(browser, { pet: '' });
    await openCoop(p);
    ok(/领养一只宠物/.test(await p.evaluate(() => document.querySelector('.cg-home').textContent)) && await p.evaluate(() => !CoopGames.test.G.petImg), 'no pet adopted: nobody follows, and the screen says how to get one');
    await p.evaluate(() => { CoopGames.test.start(0, 'duo'); for (let k = 0; k < 120; k++) CoopGames.test.stepFn(1 / 120); CoopGames.test.render(); });
    ok(await p.evaluate(() => CoopGames.test.G.petPos == null), '…and none is drawn in the level');
    await ctx.close();
  }

  console.log('\n2. Every level, two people on one phone and one person playing both (bot, hits off)');
  const { p, ctx, errs } = await demoPage(browser, { w: 1000, h: 640, mobile: false });
  await openCoop(p);
  await p.addScriptTag({ content: BOT });
  for (const mode of ['duo', 'solo']) {
    const res = [];
    for (const L of only) res.push(await p.evaluate(([i, m]) => window.__bot.play(i, true, m), [L - 1, mode]));
    const bad = res.filter(r => !r.ok);
    ok(!bad.length, `${mode === 'duo' ? '两个人' : '一个人'}: ${res.length - bad.length}/${res.length} levels finished${bad.length ? ' — stuck: ' + bad.map(r => `${r.level}@${r.chunk}(${r.why})`).join(', ') : ''}`);
  }
  {
    const res = [];
    for (const L of only) res.push(await p.evaluate(([i]) => window.__bot.play(i, false, 'duo'), [L - 1]));
    const done = res.filter(r => r.ok).length;
    ok(done >= Math.min(only.length, only.length - 2), `with real hits the bot (which never dodges) still finishes ${done}/${res.length}`);
  }
  ok(!errs.length, `no page errors while playing ${errs.slice(0, 2).join(' | ')}`);

  console.log('\n3. Points: the first clear of a level, once, at most +3 a day');
  await p.evaluate(() => { CoopGames.test.closeStage(); CoopGames.test.set('test', false); for (const k of Object.keys(localStorage)) if (/^cg_paid|^mg_done_/.test(k)) localStorage.removeItem(k); });
  const winOnce = async () => p.evaluate(async () => {
    const T = CoopGames.test, G = T.G;
    T.start(0, 'duo'); T.set('test', false);
    const d = G.L.door.x;
    T.tp(0, d - 0.8, 9.82); T.tp(1, d - 0.2, 9.82);
    for (let k = 0; k < 30; k++) T.stepFn(1 / 120);
    await new Promise(r => setTimeout(r, 2600));
    return { state: G.state, line: document.querySelector('.cg-panel [data-r="pay"]') && document.querySelector('.cg-panel [data-r="pay"]').textContent };
  });
  const entries = () => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('love_score_data')); return Object.values(d.entries).flat().filter(e => /一起回家|默契拍拍/.test(e.desc || '')).map(e => `${e.charId}:${e.pts}:${e.desc}`); });
  const w1 = await winOnce();
  ok(w1.state === 'result' && /第一次通关 \+1/.test(w1.line || ''), `both at the house → the result says +1 for the first clear: 「${w1.line}」`);
  let es = await entries();
  ok(es.length === 1 && /char1:1:一起回家 · 1-1 樱花小路 通关/.test(es[0]), `one ledger row, for the person holding this phone: ${es.join(' | ')}`);
  const w2 = await winOnce();
  ok(/以前通关过了/.test(w2.line || '') && (await entries()).length === 1, 'clearing the same level again pays nothing');
  const r2 = await p.evaluate(() => App._cgPayTest('coop', 'M2', 'test 2')), r3 = await p.evaluate(() => App._cgPayTest('coop', 'M3', 'test 3')), r4 = await p.evaluate(() => App._cgPayTest('coop', 'M4', 'test 4'));
  ok(r2.pts === 1 && r3.pts === 1 && r4.pts === 0 && r4.why === 'cap', `new levels pay until +3 for the day, then stop: ${[r2, r3, r4].map(r => r.pts || r.why).join(' ')}`);
  ok((await p.evaluate(() => App._cgPaidKeysTest('coop'))).join() === 'M1,M2,M3', 'and the capped one is still unpaid, so it can pay another day (levels are keyed M1… since the new map)');
  await p.evaluate(() => CoopGames.test.closeStage());
  await p.click('.cg-x');

  console.log('\n4. 默契拍拍 on one phone');
  await openCoop(p, 'beat');
  ok(await p.evaluate(() => document.querySelector('.cg-home [data-m="online"]').disabled && document.querySelector('.cg-home [data-m="duo"]').getAttribute('aria-pressed') === 'true'), 'demo: one-phone mode, two pads');
  const beat = await p.evaluate(async () => {
    const T = CoopGames.test, BT = T.BT;
    document.querySelector('.cg-home [data-a="go"]').click();
    const R = BT.run, iv = R.iv;
    // both of you, on the beat, a few ms apart
    R.beats.forEach((b, k) => { setTimeout(() => T.beatTap('cs'), b.t - performance.now() + 3); setTimeout(() => T.beatTap('yy'), b.t - performance.now() + 18 + (k % 3) * 9); });
    await new Promise(r => setTimeout(r, R.beats[R.beats.length - 1].t - performance.now() + iv + 400));
    return { msg: document.querySelector('[data-r="msg"]').textContent, sub: document.querySelector('[data-r="sub"]').textContent, unlocked: BT.save.unlocked };
  });
  ok(/默契 100 分/.test(beat.msg), `every beat within 60 ms of each other scores 100: 「${beat.msg}」`);
  ok(beat.unlocked === 2 && /下一关解锁/.test(beat.sub), 'passing unlocks the next level');
  await sleep(400);
  es = await entries();
  ok(es.some(e => /char1:1:默契拍拍 · 慢慢来 过关/.test(e)), 'the first pass of a level pays +1 to the person holding the phone');
  await p.click('.cg-home [data-m="bot"]');
  ok(await p.evaluate(() => document.querySelectorAll('.cgb-pad').length === 2 && document.querySelectorAll('.cgb-pad[disabled]').length === 1), 'practice: your pad and the computer\'s');
  await p.click('.cg-x');
  await ctx.close();

  console.log('\n5. Looks: 360 / 390 / 820, light and dark, 新外观 and 经典');
  for (const [w, h] of [[360, 740], [390, 844], [820, 1180]]) for (const scheme of ['light', 'dark']) {
    const { p: q, ctx: c } = await demoPage(browser, { w, h, scheme });
    await openCoop(q);
    const over = await q.evaluate(() => document.querySelector('.cg-home').scrollWidth > innerWidth + 1);
    await q.evaluate(() => CoopGames.test.ui('free', 0));
    await q.click('.cg-lv[data-i="0"]'); await sleep(400);
    const stage = await q.evaluate(() => { const v = document.querySelector('.cg-view'); return { vw: v.clientWidth, vh: v.clientHeight, panel: !!document.querySelector('.cg-panel h2') }; });
    ok(!over && stage.vw === w && stage.vh > 200 && stage.panel, `${w} ${scheme}: home fits, the stage fills the width, the level card shows`);
    // every label inside its button, in both control layouts. 牵手/换人 once spilled out of their
    // 58px buttons in 26px type: `font: 800 12.5px/1.15 inherit` is not valid CSS, so the size was dropped
    const spill = [];
    for (const mode of ['solo', 'duo']) {
      await q.evaluate(() => CoopGames.test.closeStage()); await sleep(200);
      await q.evaluate(() => CoopGames.test.ui('home'));
      await q.click(`.cg-home [data-mode="${mode}"]`); await sleep(200);
      await q.evaluate(() => CoopGames.test.ui('free', 0));
      await q.click('.cg-lv[data-i="0"]'); await sleep(300);
      await q.click('.cg-panel [data-a="go"]'); await sleep(300);
      spill.push(...await q.evaluate((mode) => [...document.querySelectorAll('.cg-stage button, .cg-zone .lab')].filter(b => b.offsetParent).filter(b => {
        const r = b.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(b); const t = range.getBoundingClientRect();
        return t.width && (t.left < r.left - 1 || t.right > r.right + 1 || t.top < r.top - 1 || t.bottom > r.bottom + 1);
      }).map(b => `${mode}:${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 8)}`), mode));
    }
    if (w === 390 && scheme === 'light') {   // still in 两个人一部手机 from the loop above
      const before = await q.evaluate(() => getComputedStyle(document.querySelector('.cg-zone .lab')).opacity);
      await sleep(7600);
      const after = await q.evaluate(() => ({ quiet: document.querySelector('.cg-sticks').classList.contains('cg-quiet'), op: getComputedStyle(document.querySelector('.cg-zone .lab')).opacity }));
      ok(before === '1' && after.quiet && after.op === '0', `two on one phone: the side hints show, then fade once play is under way (${before} → ${after.op})`);
    }
    const homeSpill = await q.evaluate(() => { CoopGames.test.closeStage(); return [...document.querySelectorAll('.cg-home button')].filter(b => b.offsetParent && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)).map(b => b.textContent.trim().slice(0, 8)); });
    const small = await q.evaluate(() => { const b = document.querySelector('.cg-stage .cg-sm'); return b ? getComputedStyle(b).fontSize : '12.5px'; });
    ok(!spill.length && !homeSpill.length && small === '12.5px', `${w} ${scheme}: every label stays inside its button (small buttons ${small})${spill.length || homeSpill.length ? ' — spilling: ' + spill.concat(homeSpill).join(', ') : ''}`);
    await c.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
