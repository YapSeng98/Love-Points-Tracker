// 📖 一起回家 · 故事模式, 自由选关 and the endless road's new things, on one phone (CLAUDE.md §7.33).
//   python3 -m http.server 8765        then:  node tools/coop-story-test.js      (ONLY=1,4 runs those sections)
// (APP_URL=http://localhost:PORT/index.html; BROWSER=webkit for the iPhone's engine)
//
// The start screen is three ways to play. 故事模式: the comics before a chapter (the prologue once), each new thing
// to do together on its own (keys only their owner can carry, locks, balloons, the tide, clock buttons, the frame you
// carry together), all twelve levels played by the bot (two on a phone, and one person playing both), a chapter
// opening the next, its ending finding one of your own photos (or a drawing when there is none, or it won't load),
// points for a first clear. 自由选关: world cards, a random level, the levels short of stars, the story's levels. 一直
// 走下去: a blessing after each 段, camps every 5 段 that keep the run, the road of the day, events on the road. Then
// the save merge across phones, and the screens at 360–820 in both themes.
const { chromium, webkit } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), os = require('os');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const BOT = fs.readFileSync(path.join(__dirname, 'coop-bot.js'), 'utf8');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean), on = (n) => !ONLY.length || ONLY.includes(String(n));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function launch() {
  if (process.env.BROWSER !== 'webkit') return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const dir = path.join(os.homedir(), 'Library/Caches/ms-playwright'), wk = fs.readdirSync(dir).find(d => d.startsWith('webkit-'));
  return webkit.launch({ executablePath: path.join(dir, wk, 'pw_run.sh') });
}
// plain pictures standing in for the couple's photos (never real ones: fixtures are obviously fake)
const photo = (h) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="hsl(${h},70%,78%)"/><text x="80" y="66" font-size="16" text-anchor="middle">示例</text></svg>`);
async function demoPage(browser, { w = 390, h = 844, scheme = 'light', photos = 3, dead = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, timezoneId: 'Asia/Singapore', colorScheme: scheme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  const ph = Array.from({ length: photos }, (_, k) => ({ id: 'p' + k, image: dead ? 'https://example.invalid/gone.jpg' : photo(k * 70), caption: '', date: `2025-0${k + 1}-1${k}`, by: 'char1' }));
  await p.addInitScript(([th, ph]) => { if (sessionStorage.getItem('s')) return; localStorage.clear(); localStorage.setItem('theme_mode', th); localStorage.setItem('love_score_data', JSON.stringify({ mode: 'reward', entries: {}, history: [], archive: [], letters: [], photos: ph, petName: '豆豆', petSpecies: 'dog', petExp: 600, petBase: 0, charName1: 'CS', charName2: 'YY', categories: [], rewards: [], punishments: [], decorOwned: [], startDate: '2024-12-24' })); sessionStorage.setItem('s', '1'); }, [scheme, ph]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => { document.getElementById('start-page')?.remove(); App.demoMode(); });
  await sleep(500);
  await p.evaluate(() => App.openCoop('home'));
  await p.waitForFunction(() => document.querySelector('.cg-home .cg-mode'), null, { timeout: 15000 });
  return { p, ctx, errs };
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const text = (p, sel) => p.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);
const panel = (p) => text(p, '.cg-veil:not([hidden]) .cg-panel').then(t => t.replace(/\s+/g, ' ').trim());
const steps = (p, n) => T(p, (n) => { const t = CoopGames.test; for (let k = 0; k < n; k++) t.stepFn(t.STEP); }, n);

(async () => {
  const browser = await launch();

  if (on(1)) {
    console.log('\n1. The start screen, the story screen, and the comics before chapter 1');
    const { p, ctx, errs } = await demoPage(browser);
    const modes = await T(p, () => [...document.querySelectorAll('.cg-home .cg-mode b, .cg-home .cg-endless h4')].map(b => b.textContent.replace(/\s+/g, '').replace('新', '')));
    ok(modes.join(' ') === '故事模式 自由选关 一直走下去', `three ways to play: ${modes.join(' · ')}`);
    ok(/第 1 章「花瓣里的第一张」/.test(await text(p, '.cg-m-story')) && /开始/.test(await text(p, '.cg-m-story .go')), 'the story card says where you are: 第 1 章「花瓣里的第一张」, 开始');
    await p.click('[data-go="story"]');
    const map = await T(p, () => [...document.querySelectorAll('.cg-node')].map(b => (b.disabled ? (b.textContent.includes('⏳') ? 'soon' : 'lock') : 'open')));
    ok(map.join() === ['open', 'lock', 'lock', 'soon', 'soon', 'soon', 'soon', 'soon', 'soon', 'soon'].join(), `the chapter map: 1 open, 2–3 locked, 4–10 coming (${map.join(' ')})`);
    const lv = await T(p, () => [...document.querySelectorAll('.cg-lv')].map(b => b.disabled));
    ok(JSON.stringify(lv) === '[false,true,true,true]' && /0 \/ 10/.test(await text(p, '.cg-album')), 'chapter 1: only 1-1 is open, no photos found yet (0 / 10)');
    await p.click('.cg-lv[data-s="0"]'); await sleep(300);
    let sc = await T(p, () => CoopGames.test.sceneState());
    ok(sc && sc.id === 'pro' && sc.k === 0 && /周末的下午，CS 和 YY 窝在沙发上翻相册/.test(await text(p, '.cg-sc')), `1-1 the first time: the prologue first (「${(await text(p, '.cg-sc p')).slice(0, 18)}…」)`);
    for (let k = 0; k < 4; k++) { await p.click('.cg-sc [data-a="next"]'); await sleep(80); }
    const petPanel = await text(p, '.cg-sc-box');
    ok(/豆豆/.test(petPanel) && /第一个冲了出去/.test(petPanel), `your own pet, by its name, goes first (「${petPanel.replace(/\s+/g, ' ').slice(0, 22)}…」)`);
    await p.click('.cg-sc [data-a="next"]'); await sleep(80);
    ok(/好 ▸/.test(await text(p, '.cg-sc [data-a="next"]')) && (await T(p, () => CoopGames.test.sceneState().k)) === 5, 'the last panel says 好 ▸ (6 / 6)');
    await p.click('.cg-sc [data-a="next"]'); await sleep(200);
    sc = await T(p, () => CoopGames.test.sceneState());
    ok(sc && sc.id === 'o0', 'then chapter 1\'s own opening');
    await p.click('.cg-sc [data-a="skip"]'); await sleep(400);
    ok(await T(p, () => !CoopGames.test.sceneState() && CoopGames.test.G.L && CoopGames.test.G.L.i === CoopGames.test.SI) && /📖 1-1 樱花门/.test(await panel(p)) && /钥匙和锁/.test(await panel(p)), '跳过 → the level: 「📖 1-1 樱花门」 with the 钥匙和锁 tip');
    const seen = await T(p, () => CoopGames.test.G.save.seen);
    ok(seen && seen.pro && seen.o0, `seen, and kept in the save: ${JSON.stringify(seen)}`);
    await T(p, () => CoopGames.test.closeStage()); await sleep(200);
    await p.click('.cg-lv[data-s="0"]'); await sleep(300);
    ok(await T(p, () => !CoopGames.test.sceneState() && CoopGames.test.G.L.i === CoopGames.test.SI), 'the second time 1-1 starts straight away');
    await T(p, () => CoopGames.test.closeStage()); await sleep(200);
    await p.click('[data-scene="pro"]'); await sleep(200);
    ok((await T(p, () => CoopGames.test.sceneState().id)) === 'pro', '▶ 看这一章的开头 plays it again any time');
    await p.keyboard.press('Escape'); await sleep(200);
    ok(await T(p, () => !CoopGames.test.sceneState()), 'Esc closes a comic');
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  if (on(2)) {
    console.log('\n2. The new things to do together, one by one');
    const { p, ctx, errs } = await demoPage(browser);
    // 钥匙和锁 (1-1: Q1_intro)
    let r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI, 'duo'); t.set('god', true);
      const c = G.L.chunks.find(c => c.ch.id === 'Q1_intro'), x0 = c.x0, key = G.L.items.find(it => it.type === 'key' && it.col === 0);
      const out = {};
      t.tp(1, key.x - 0.4, 9.82); for (let k = 0; k < 30; k++) t.stepFn(t.STEP);
      out.yyTook = !!G.players[1].key;
      t.tp(1, x0 + 1, 9.82); t.tp(0, key.x - 0.4, 9.82); for (let k = 0; k < 30; k++) t.stepFn(t.STEP);
      out.csTook = G.players[0].key === key;
      // carried to the blue lock: it opens (every tile of it), the key is used
      t.inp(0, { r: true }); for (let k = 0; k < 120 && G.players[0].key; k++) t.stepFn(t.STEP); t.inp(0, {});
      out.open = !G.L.grid.some((v, k) => v === t.T_LOCKB && k % G.L.w >= x0 && k % G.L.w < x0 + c.ch.w);
      out.used = !G.players[0].key && key.used;
      // the pink key, carried into its lock by YY — and dropped into a pit it goes home
      const pk = G.L.items.find(it => it.type === 'key' && it.col === 1);
      t.tp(1, pk.x - 0.4, 9.82); for (let k = 0; k < 30; k++) t.stepFn(t.STEP);
      out.yyPink = G.players[1].key === pk;
      t.tp(1, 3, 20); for (let k = 0; k < 20; k++) t.stepFn(t.STEP);
      out.back = !pk.got && !G.players[1].key && Math.abs(pk.x - pk.ox) < 0.01;
      return out;
    });
    ok(!r.yyTook && r.csTook, '钥匙: YY can\'t pick up CS\'s blue key; CS can');
    ok(r.open && r.used, '…carried into the blue lock: every tile of it opens, and the key is used up');
    ok(r.yyPink && r.back, 'YY takes her pink one; falling into a pit sends it back to where it was');
    // a checkpoint remembers which locks are open (1-2 has a checkpoint right after the relay)
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI + 1, 'duo'); t.set('god', true);
      const c = G.L.chunks.find(c => c.ch.id === 'Q2_relay'), cells = [];
      for (let k = 0; k < G.L.grid.length; k++) if (G.L.grid[k] === t.T_LOCKP && k % G.L.w >= c.x0 && k % G.L.w < c.x0 + c.ch.w) cells.push(k);
      t.unlock(cells[0] % G.L.w, Math.floor(cells[0] / G.L.w));
      t.flag(G.L.cps[0]); t.restartCp();
      return { n: cells.length, still: cells.every(k => G.L.grid[k] === 0) };
    });
    ok(r.n === 4 && r.still, 'a checkpoint keeps the locks you opened: restarting there, Q2_relay\'s pink lock (4 tiles) is still open');
    // 气球 (2-1: B1_wall)
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI + 4, 'duo'); t.set('god', true);
      const b = G.L.balloons[0], out = {};
      t.tp(0, b.ox - 0.39, 9.82); for (let k = 0; k < 4; k++) t.stepFn(t.STEP);
      out.held = G.players[0].balloon === b;
      const y0 = G.players[0].y; for (let k = 0; k < 120; k++) t.stepFn(t.STEP);
      out.rose = y0 - G.players[0].y;
      t.inp(0, { j: true }); t.stepFn(t.STEP); t.inp(0, {}); t.stepFn(t.STEP);
      out.let = !G.players[0].balloon && b.held === -1 && b.back > 0;
      for (let k = 0; k < 240; k++) t.stepFn(t.STEP);
      out.back = b.back <= 0 && Math.abs(b.x - b.ox) < 0.01;
      // held too long, it pops
      t.tp(1, b.ox - 0.39, 9.82); for (let k = 0; k < 4; k++) t.stepFn(t.STEP);
      for (let k = 0; k < 700 && G.players[1].balloon; k++) t.stepFn(t.STEP);
      out.pop = !G.players[1].balloon;
      return out;
    });
    ok(r.held && r.rose > 3.5, `气球: walking into it takes hold, and it lifts you (${r.rose.toFixed(1)} tiles in a second)`);
    ok(r.let && r.back, 'jump lets go; the balloon floats back to its place a moment later');
    ok(r.pop, 'held too long, it pops (5.5 s)');
    // 涨潮 (2-2: a level with a tide)
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI + 5, 'duo'); t.set('god', true);
      const td = G.L.tides[0], out = { lo: t.waterLevel(td) };
      G.wt = td.period / 2; out.hi = t.waterLevel(td);
      // standing on the seabed with the sea over you, holding jump swims you up
      t.tp(0, 3, 9.82); for (let k = 0; k < 10; k++) t.stepFn(t.STEP);
      const y0 = G.players[0].y; t.inp(0, { j: true }); for (let k = 0; k < 90; k++) t.stepFn(t.STEP); t.inp(0, {});
      out.swam = y0 - G.players[0].y;
      return out;
    });
    ok(r.lo > 13 && r.hi < 5, `涨潮: low tide under the beach (${r.lo.toFixed(1)}), high tide over it (${r.hi.toFixed(1)})`);
    ok(r.swam > 2.5, `under the sea, holding jump swims you up from the bottom (${r.swam.toFixed(1)} tiles)`);
    // 计时门 (3-1: R1_intro)
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI + 8, 'duo'); t.set('god', true);
      const tp = G.L.tplates[0], out = {};
      t.tp(0, tp.c + 0.11, tp.r + 1 - 1.18); for (let k = 0; k < 6; k++) t.stepFn(t.STEP);
      out.on = !!G.chanOn[tp.ch];
      t.tp(0, tp.c - 2.5, tp.r + 1 - 1.18); for (let k = 0; k < 120 * 4; k++) t.stepFn(t.STEP);
      out.after4 = !!G.chanOn[tp.ch];
      for (let k = 0; k < 120 * 1.2; k++) t.stepFn(t.STEP);
      out.after52 = !!G.chanOn[tp.ch];
      return out;
    });
    ok(r.on && r.after4 && !r.after52, '计时门: open while pressed, still open 4 s after, shut by 5.2 s');
    // 一起抬 (3-2: F1_intro)
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.start(t.SI + 9, 'duo'); t.set('god', true);
      const f = G.L.frames[0], fc = f.x + f.w / 2, out = {};
      // walking past it together doesn't pick it up
      t.tp(0, fc - 3.5, 9.82); t.tp(1, fc - 2.5, 9.82); t.inp(0, { r: true }); t.inp(1, { r: true });
      for (let k = 0; k < 110; k++) t.stepFn(t.STEP);
      out.walkPast = f.st;
      t.inp(0, {}); t.inp(1, {});
      t.tp(0, fc - 0.95, 9.82); t.tp(1, fc + 0.2, 9.82); for (let k = 0; k < 70; k++) t.stepFn(t.STEP);
      out.up = f.st;
      t.inp(0, { j: true }); t.stepFn(t.STEP); t.inp(0, {}); for (let k = 0; k < 10; k++) t.stepFn(t.STEP);
      out.noJump = G.players[0].grounded;
      t.inp(1, { r: true }); for (let k = 0; k < 90 && f.st === 'up'; k++) t.stepFn(t.STEP); t.inp(1, {});
      out.apart = f.st;
      for (let k = 0; k < 240; k++) t.stepFn(t.STEP);
      out.home = f.st === 'rest' && Math.abs(f.x - f.ox) < 0.01;
      return out;
    });
    ok(r.walkPast === 'rest', '一起抬: walking past it together doesn\'t pick it up');
    ok(r.up === 'up', 'standing under it together a moment, it goes up onto both heads');
    ok(r.noJump, 'carrying it, nobody can jump');
    ok(r.apart === 'fall' && r.home, 'walk apart and it falls, then goes back to its pegs');
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  if (on(3)) {
    console.log('\n3. All twelve story levels, played by the bot (two on a phone, and one person playing both; real hits)');
    const { p, ctx, errs } = await demoPage(browser, { w: 900, h: 560 });
    await p.addScriptTag({ content: BOT });
    for (const mode of ['duo', 'solo']) {
      const res = [];
      for (let k = 0; k < 12; k++) res.push(await T(p, ([i, m]) => window.__bot.play(i, false, m), [1000 + k, mode]));
      const bad = res.filter(r => !r.ok);
      ok(!bad.length, `${mode === 'duo' ? '两个人' : '一个人'}: ${12 - bad.length}/12 cleared${bad.length ? ' — ' + bad.map(r => `${r.level}@${r.chunk}(${r.why})`).join(' ') : ''} · hearts left ${res.map(r => r.hp).join(' ')}`);
    }
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  if (on(4)) {
    console.log('\n4. A chapter, start to end: the next level, the ending, your photo, the next chapter; points');
    const { p, ctx, errs } = await demoPage(browser);
    await T(p, () => { const G = CoopGames.test.G; G.save.seen = { pro: 1, o0: 1 }; });
    const clear = (i) => T(p, (i) => { const t = CoopGames.test, G = t.G; t.start(i, 'duo'); t.set('test', false); const d = G.L.door; t.tp(0, d.x - 0.9, d.y - 1.18); t.tp(1, d.x - 0.2, d.y - 1.18); }, i);
    const entries = () => T(p, () => { const d = JSON.parse(localStorage.getItem('love_score_data') || '{"entries":{}}'); return Object.values(d.entries || {}).flat().filter(e => /一起回家/.test(e.desc || '')).map(e => e.desc); });
    await clear(1000);
    await p.waitForFunction(() => /回到家啦/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 8000 });
    await sleep(500);
    let t = await panel(p);
    ok(/下一关/.test(t) && /回到故事/.test(t) && /第 1 章 · 花瓣里的第一张/.test(t), `1-1 cleared: 下一关 and 回到故事 (「${t.slice(0, 26)}…」)`);
    let es = await entries();
    ok(es.some(d => /📖 1-1 樱花门 通关/.test(d)), `the first clear pays like any level's: ${es.join(' · ')}`);
    await p.click('.cg-panel [data-a="next"]'); await sleep(300);
    ok(/📖 1-2 蜜蜂花园/.test(await panel(p)), '下一关 → 📖 1-2 蜜蜂花园');
    await T(p, () => CoopGames.test.closeStage()); await sleep(200);
    await T(p, () => CoopGames.test.ui('story'));
    ok((await T(p, () => [...document.querySelectorAll('.cg-lv')].map(b => b.disabled))).join() === 'false,false,true,true', '1-2 is open now, 1-3 not yet');
    for (const k of [1001, 1002]) { await clear(k); await p.waitForFunction(() => CoopGames.test.G.state === 'result', null, { timeout: 8000 }); await T(p, () => CoopGames.test.closeStage()); }
    await clear(1003);
    await p.waitForFunction(() => /这一章打完了/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 8000 });
    t = await panel(p);
    ok(/看结尾，找回照片/.test(t), `the chapter's last level: 「这一章打完了！」 and 📷 看结尾，找回照片`);
    await p.click('.cg-panel [data-a="end"]'); await sleep(300);
    ok((await T(p, () => (CoopGames.test.sceneState() || {}).id)) === 'c0', 'its ending plays');
    await p.click('.cg-sc [data-a="next"]'); await sleep(300);
    const pic = await T(p, () => { const im = document.querySelector('.cg-sc-photo .pic img'); return { img: !!im, cap: (document.querySelector('.cg-sc-photo .pol span') || {}).textContent }; });
    ok(pic.img && /第 1 张 · 2025-01-10/.test(pic.cap), `…and finds one of your photos, with its date (「${pic.cap}」)`);
    await p.click('.cg-sc [data-a="skip"]'); await sleep(300);
    const after = await T(p, () => ({ album: document.querySelector('.cg-album').textContent, slots: document.querySelectorAll('.cg-slot.got img').length, map: [...document.querySelectorAll('.cg-node')].slice(0, 3).map(b => !b.disabled), seen: CoopGames.test.G.save.seen.c0 }));
    ok(/1 \/ 10/.test(after.album) && after.slots === 1 && after.seen, 'the album: 1 / 10, with your photo in its first slot');
    ok(after.map.join() === 'true,true,false', 'chapter 2 opens on the map');
    await T(p, () => CoopGames.test.ui('home'));
    ok(/第 2 章「漂流瓶」/.test(await text(p, '.cg-m-story')) && /继续/.test(await text(p, '.cg-m-story .go')), 'the start screen\'s story card moves on: 第 2 章「漂流瓶」, 继续');
    // replays pay nothing
    await clear(1000); await p.waitForFunction(() => CoopGames.test.G.state === 'result', null, { timeout: 8000 }); await sleep(500);
    es = await entries();
    ok(es.filter(d => /1-1 樱花门/.test(d)).length === 1, 'clearing 1-1 again pays nothing more');
    await T(p, () => CoopGames.test.closeStage());
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
    // no photos at all, or a link that is gone: a drawing of the two of you instead, never a broken image
    for (const [label, opt] of [['no photos', { photos: 0 }], ['a dead link', { photos: 2, dead: true }]]) {
      const { p: q, ctx: c } = await demoPage(browser, opt);
      await T(q, () => { const G = CoopGames.test.G; for (const id of ['S1', 'S2', 'S3', 'S4']) G.save.best[id] = { t: 30, sm: [1, 0, 0], h: 1 }; CoopGames.test.ui('story'); CoopGames.test.playScene('c0'); });
      await q.click('.cg-sc [data-a="next"]'); await sleep(1200);
      const d = await T(q, () => ({ svg: !!document.querySelector('.cg-sc-photo .pic svg'), img: document.querySelector('.cg-sc-photo .pic img') }));
      ok(d.svg, `${label}: the ending shows a drawing of the two of you`);
      await c.close();
    }
  }

  if (on(5)) {
    console.log('\n5. 自由选关: world cards, a random level, the ones short of stars, the story\'s levels, the editor');
    const { p, ctx, errs } = await demoPage(browser);
    await p.click('[data-go="free"]');
    const cards = await T(p, () => [...document.querySelectorAll('.cg-wcard')].map(b => b.disabled));
    ok(cards.length === 10 && !cards[0] && cards.slice(1).every(Boolean), 'ten world cards; only the first is open on a new save');
    ok(await T(p, () => !!document.querySelector('.cg-home .cg-maker')), '🛠️ making a level for each other is here');
    await p.click('.cg-wcard[data-w="0"]');
    ok((await T(p, () => [...document.querySelectorAll('.cg-lv')].map(b => b.disabled))).join() === 'false,true,true,true,true', 'a world: its five levels, 1-1 open');
    await p.click('[data-w="back"]');
    await T(p, () => { const G = CoopGames.test.G; G.save.best.M1 = { t: 20, sm: [1, 0, 1], h: 2 }; G.save.best.S1 = { t: 30, sm: [1, 1, 0], h: 1 }; G.save.unlocked = 2; CoopGames.test.ui('free'); });
    ok(/还差星星的 2 关/.test(await text(p, '.cg-home .cg-seg')) && await T(p, () => !!document.querySelector('.cg-lv[data-s="0"]')), '⭐ 还差星星的 2 关, and the story\'s 1-1 under 「故事里玩过的关」');
    await p.click('[data-a="short"]');
    ok((await T(p, () => [...document.querySelectorAll('.cg-lv')].map(b => b.querySelector('.nm').textContent))).join() === '樱花小路,樱花门', 'the short list: 樱花小路 and 樱花门');
    await p.click('.cg-lv[data-s="0"]'); await sleep(300);
    ok(await T(p, () => !CoopGames.test.sceneState() && CoopGames.test.G.L.i === CoopGames.test.SI), 'a story level from here starts at once (no comic)');
    await T(p, () => CoopGames.test.closeStage()); await sleep(200);
    await T(p, () => CoopGames.test.ui('free'));
    await p.click('[data-a="rand"]'); await sleep(300);
    const ri = await T(p, () => CoopGames.test.G.L.i);
    ok([0, 1, 1000].includes(ri), `🎲 a level you have opened (${ri})`);
    await T(p, () => CoopGames.test.closeStage());
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  if (on(6)) {
    console.log('\n6. 一直走下去: blessings, camps that keep the run, the road of the day, events on the road');
    const { p, ctx, errs } = await demoPage(browser);
    let r = await T(p, () => {
      const t = CoopGames.test, run = { rs: 777, d: 3, hp: 5, he: 0, t: 0, ws: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
      const a = t.blessOffer(run), b = t.blessOffer(Object.assign({}, run)), c = t.blessOffer(Object.assign({}, run, { bl: ['magnet'] }));
      return { a, same: a.join() === b.join(), distinct: new Set(a).size === 3, noMagnet: !c.includes('magnet') };
    });
    ok(r.distinct && r.same && r.noMagnet, `three different blessings, the same three from the same run (${r.a.join(' ')}); 🧲 only once`);
    // wings / a bubble for the next 段; a heart at once; the storm slower for the run
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G;
      t.startE(4242, 1, 'duo'); const d = G.L.door; t.tp(0, d.x - 0.9, d.y - 1.18); t.tp(1, d.x - 0.2, d.y - 1.18);
      for (let k = 0; k < 600 && G.state !== 'result'; k++) t.stepFn(t.STEP);
      return { st: G.state, offer: [...document.querySelectorAll('.cg-panel [data-a="bl"]')].map(b => b.dataset.bl) };
    });
    ok(r.st === 'result' && r.offer.length === 3, `段 1 walked: three blessings (${r.offer.join(' ')})`);
    const pickWing = r.offer.includes('wings') ? 'wings' : r.offer.includes('shield') ? 'shield' : r.offer[0];
    await p.click(`.cg-panel [data-bl="${pickWing}"]`); await sleep(200);
    await p.click('.cg-panel [data-a="go"]'); await sleep(300);
    r = await T(p, () => { const G = CoopGames.test.G; return { d: G.espec.endless, wings: G.players.map(p => p.wings), shield: G.players.map(p => p.shield), bl: G.run.bl }; });
    ok(r.d === 2 && (pickWing === 'wings' ? r.wings.every(Boolean) : pickWing === 'shield' ? r.shield.every(Boolean) : true), `chose 「${pickWing}」: 段 2 starts with it (${JSON.stringify(r.bl)})`);
    r = await T(p, () => {
      const t = CoopGames.test, s0 = t.endless.spec({ rs: 9, d: 4, hp: 5, he: 0, t: 0, ws: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }), s1 = t.endless.spec({ rs: 9, d: 4, hp: 5, he: 0, t: 0, ws: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], bl: ['slow'] });
      return { a: s0.chase.speed, b: s1.chase.speed, same: s0.seq.join() === s1.seq.join() };
    });
    ok(r.b < r.a && r.same, `⏱️ the storm slower (${r.a.toFixed(2)} → ${r.b.toFixed(2)} tiles/s), the road the same`);
    // a camp after 段 5: a heart more, the run kept; the card offers to go on from 段 6
    r = await T(p, () => {
      const t = CoopGames.test, G = t.G; t.closeStage();
      t.startE(5151, 5, 'duo'); G.hp = 3; G.run.hp = 3; const d = G.L.door; t.tp(0, d.x - 0.9, d.y - 1.18); t.tp(1, d.x - 0.2, d.y - 1.18);
      for (let k = 0; k < 600 && G.state !== 'result'; k++) t.stepFn(t.STEP);
      return { st: G.state, panel: document.querySelector('.cg-panel').textContent.replace(/\s+/g, ' '), hp: G.hp, camp: JSON.parse(localStorage.getItem(t.campKey())) };
    });
    ok(/营地/.test(r.panel) && r.hp === 4 && r.camp && r.camp.d === 6 && r.camp.run.rs === 5151, `段 5 is a camp: a heart more (${r.hp}), and the run kept to go on from 段 ${r.camp && r.camp.d}`);
    await T(p, () => { CoopGames.test.closeStage(); CoopGames.test.ui('home'); });
    ok(/从第 6 段接着走/.test(await text(p, '.cg-endless')), 'the start screen offers ⛺ 从第 6 段接着走');
    await p.click('[data-a="camp"]'); await sleep(400);
    r = await T(p, () => { const G = CoopGames.test.G; return { d: G.espec && G.espec.endless, rs: G.run.rs, hp: G.run.hp }; });
    ok(r.d === 6 && r.rs === 5151 && r.hp === 5, `…and goes on from 段 6 of that run (${JSON.stringify(r)})`);
    await T(p, () => { CoopGames.test.closeStage(); CoopGames.test.ui('home'); });
    // the road of the day: the same road twice today
    await p.click('[data-a="daily"]'); await sleep(400);
    const d1 = await T(p, () => CoopGames.test.G.run.rs + '|' + CoopGames.test.G.espec.seq.join());
    await T(p, () => { CoopGames.test.closeStage(); CoopGames.test.ui('home'); });
    await p.click('[data-a="daily"]'); await sleep(400);
    const d2 = await T(p, () => ({ k: CoopGames.test.G.run.rs + '|' + CoopGames.test.G.espec.seq.join(), day: CoopGames.test.G.run.daily, today: CoopGames.test.dayStr() }));
    ok(d1 === d2.k && d2.day === d2.today, `📅 今日之路: the same road both times today (${d2.day})`);
    await T(p, () => CoopGames.test.closeStage());
    // events: moonlight, a rain of hearts, fog — from 段 3, never on a storm run
    r = await T(p, () => {
      const t = CoopGames.test, all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], seen = {};
      let found = {};
      for (let rs = 1; rs < 400 && Object.keys(found).length < 3; rs++) for (let d = 1; d <= 12; d++) { const s = t.endless.spec({ rs, d, hp: 5, he: 0, t: 0, ws: all }); if (s.ev) { seen[s.ev] = (seen[s.ev] || 0) + 1; if (!found[s.ev]) found[s.ev] = { rs, d }; if (d < 3 || s.chase) return { bad: `${rs}/${d}` }; } }
      const out = { found };
      // moonlight: jumps higher; a rain of hearts: more hearts than the same 段 without it
      const m = found.moon; t.startE(m.rs, m.d, 'duo'); t.set('god', true);
      const G = t.G, pl = G.players[0]; let top = 99;
      const y0 = (() => { for (let k = 0; k < 30; k++) t.stepFn(t.STEP); return pl.y; })();
      t.inp(0, { j: true }); for (let k = 0; k < 140; k++) { t.stepFn(t.STEP); top = Math.min(top, pl.y); } t.inp(0, {});
      out.moonJump = y0 - top; out.moon = G.L.spec.moon;
      const h = found.hearts; t.startE(h.rs, h.d, 'duo'); out.heartsN = G.L.items.filter(it => it.type === 'heart').length;
      const f = found.fog; t.startE(f.rs, f.d, 'duo'); out.fogDark = !!G.L.spec.dark;
      t.closeStage();
      return out;
    });
    ok(!r.bad && r.found.moon && r.found.hearts && r.found.fog, `events turn up from 段 3 on, never on a storm run (${JSON.stringify(r.found)})`);
    ok(r.moon && r.moonJump > 4.5 && r.moonJump < 5.4, `🌙 moonlight: a jump goes higher (${r.moonJump.toFixed(2)} tiles, against 4.2)`);
    ok(r.heartsN >= 4 && r.heartsN <= 50 && r.fogDark, `💗 a rain of hearts (${r.heartsN} in the 段); 🌫️ fog darkens it`);
    ok(!errs.length, `no page errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  if (on(7)) {
    console.log('\n7. Two phones of one person: comics seen and the day\'s road merge, nothing lost');
    const { p, ctx } = await demoPage(browser);
    const m = await T(p, () => App._progTest.merge(
      { coop: { unlocked: 3, best: { S1: { t: 40, sm: [1, 0, 0], h: 1 } }, seen: { pro: 1, o0: 1 }, day: { date: '2026-11-27', d: 4 } } },
      { coop: { unlocked: 2, best: { S1: { t: 35, sm: [0, 1, 0], h: 2 }, S2: { t: 50, sm: [0, 0, 1], h: 0 } }, seen: { c0: 1 }, day: { date: '2026-11-27', d: 6 } } }));
    ok(m.coop.seen.pro && m.coop.seen.o0 && m.coop.seen.c0, `the comics seen on either phone: ${JSON.stringify(m.coop.seen)}`);
    ok(m.coop.best.S1.t === 35 && m.coop.best.S1.sm.join() === 'true,true,false' && m.coop.best.S2, 'story records merge like the 50\'s: the faster time, every star');
    ok(m.coop.day.d === 6, 'the same day\'s road: the farther walk');
    const m2 = await T(p, () => App._progTest.merge({ coop: { best: {}, day: { date: '2026-11-26', d: 9 } } }, { coop: { best: {}, day: { date: '2026-11-27', d: 2 } } }));
    ok(m2.coop.day.date === '2026-11-27' && m2.coop.day.d === 2, 'a newer day replaces an older one');
    await ctx.close();
  }

  if (on(8)) {
    console.log('\n8. Looks: 360 / 390 / 820, light and dark');
    for (const [w, h] of [[360, 740], [390, 844], [820, 1180]]) for (const scheme of ['light', 'dark']) {
      const { p, ctx, errs } = await demoPage(browser, { w, h, scheme });
      const check = async (label) => {
        const r = await T(p, () => {
          const home = document.querySelector('.cg-home'), vis = (e) => e.offsetParent;
          const small = [...home.querySelectorAll('button')].filter(b => vis(b) && b.getBoundingClientRect().height < 40).map(b => b.textContent.trim().slice(0, 8));
          const spill = [...home.querySelectorAll('.cg-mode b, .cg-mode small, .cg-lv .nm, .cg-wcard b, .cg-wcard small')].filter(e => vis(e) && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.slice(0, 8));
          return { over: home.scrollWidth > innerWidth + 1, small, spill };
        });
        ok(!r.over && !r.small.length && !r.spill.length, `${w} ${scheme} ${label}: fits${r.small.length ? ' · small ' + r.small.join(',') : ''}${r.spill.length ? ' · cut ' + r.spill.join(',') : ''}`);
      };
      await check('start');
      await T(p, () => CoopGames.test.ui('story')); await check('story');
      await T(p, () => CoopGames.test.ui('free')); await check('自由选关');
      await T(p, () => CoopGames.test.playScene('o1')); await sleep(300);
      const sc = await T(p, () => { const r = document.querySelector('.cg-sc-card').getBoundingClientRect(), b = [...document.querySelectorAll('.cg-sc-b button')].map(x => x.getBoundingClientRect().height); return { fit: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, b }; });
      ok(sc.fit && sc.b.every(x => x >= 44), `${w} ${scheme}: a comic panel fits the screen, its buttons ≥ 44px`);
      await p.screenshot({ path: path.join(process.env.SHOTS || '/tmp', `story_${w}_${scheme}.png`) });
      ok(!errs.length, `${w} ${scheme}: no page errors ${errs.slice(0, 2).join(' | ')}`);
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
