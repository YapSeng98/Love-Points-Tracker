// 🛠️ 关卡编辑 — levels you make for each other (coop.js, CLAUDE.md §7.33), on one phone (demo data):
//   1. a level as stored: runs that decode to exactly the grid, and anything else refused (the wire too)
//   2. the editor: the card, a new draft, the ground tool, the eraser, planks, 3 stars at most, a box that needs room,
//      a raft that needs room, undo, longer and shorter, the name and the look kept, 6 levels at most
//   3. 试玩 builds exactly the grid between the start and the house; clearing it makes it sendable; changing it after
//      takes it back until it is cleared again; the bot can walk a made level
//   4. your partner's levels: listed when they sent them as they cleared them (and not otherwise), played, and how
//      you did kept for them; your own level shows how your partner did
//   5. the sync merge: every level either phone has, the newer edit, never one deleted, the best result
//   6. looks: 360 / 390 / 820, light and dark
// Two phones: tools/coop-editor-live-test.js.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-editor-test.js        ONLY=enc,edit,play,partner,sync,look
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || require('os').tmpdir();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = (k) => !ONLY || ONLY.includes(k);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = fs.readFileSync(path.join(__dirname, 'coop-bot.js'), 'utf8');

// a level the way the editor stores it (the same runs and hash as coop.js)
const enc = (rows) => rows.map(r => r.replace(/(.)\1*/g, (m, c) => (m.length > 1 ? m.length : '') + c)).join('|');
const hash = (s) => { let h = 2166136261; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
function made({ w = 30, gap = [12, 13, 14], stars = [[13, 8], [20, 9]], extra = [] } = {}) {
  const g = Array.from({ length: 13 }, (_, r) => (r >= 11 ? '#' : '.').repeat(w).split(''));
  for (const c of gap) { g[11][c] = '.'; g[12][c] = '.'; }
  for (const [c, r] of stars) g[r][c] = '*';
  for (const [c, r, ch] of extra) g[r][c] = ch;
  return g.map(r => r.join(''));
}
const level = (o = {}) => { const rows = made(o), r = enc(rows); return { id: o.id || 'u' + Math.random().toString(36).slice(2, 8), n: o.n || '测试小路', w: o.world || 0, r, v: o.cleared === false ? '' : hash(r), s: o.sent === false ? 0 : Date.now(), at: o.at || Date.now(), by: o.by || 'yy' }; };

async function demoPage(browser, { w = 390, h = 844, theme = 'light', mobile = true, partner = null, mine = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(([th, partner, mine]) => {
    localStorage.clear(); localStorage.setItem('theme_mode', th);
    const gs = {};
    if (partner) gs['play:char2'] = { rev: 2, data: { v: 1, lv: partner.lv || [], pl: partner.pl || {} } };
    localStorage.setItem('love_score_data', JSON.stringify({ mode: 'reward', entries: {}, history: [], archive: [], letters: [], photos: [], petName: '呆呆', petSpecies: 'dog', petExp: 0, petBase: 0, charName1: 'CS', charName2: 'YY', categories: [], rewards: [], punishments: [], decorOwned: [], gameSaves: gs }));
    if (mine) localStorage.setItem('cg_lv_cs', JSON.stringify(mine));
  }, [theme, partner, mine]);
  await p.reload();
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode());
  await sleep(300);
  return { p, ctx, errs };
}
const openCoop = async (p) => { await p.evaluate(() => App.openCoop('home')); await p.waitForFunction(() => document.querySelector('.cg-home .cg-mode'), null, { timeout: 15000 }); await p.click('[data-go="free"]'); await p.waitForFunction(() => document.querySelector('.cg-home .cg-maker'), null, { timeout: 15000 }); await sleep(400); };
const toDoor = (p) => p.evaluate(() => { const T = CoopGames.test, G = T.G, d = G.L.door; T.tp(0, d.x - .9, d.y - 1.18); T.tp(1, d.x - .2, d.y - 1.18); });
const panel = (p) => p.evaluate(() => { const el = document.querySelector('.cg-veil:not([hidden]) .cg-panel'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
const E = (p, fn, arg) => p.evaluate(fn, arg);

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  if (on('enc')) {
    console.log('\n1. A level as stored: runs that decode to exactly the grid; anything else refused');
    const { p, ctx, errs } = await demoPage(browser, { mobile: false, w: 1000, h: 640 });
    await openCoop(p);
    const r = await E(p, () => {
      const X = CoopGames.test.ed, chars = '.#B=IC^GhSpnoDbKMX*', out = { round: 0, bad: [] };
      for (let k = 0; k < 300; k++) {
        const w = 16 + (k % 65), rows = Array.from({ length: 13 }, (_, r) => Array.from({ length: w }, (_, c) => chars[(k * 7 + r * 13 + c * c) % chars.length]).join(''));
        const back = X.dec(X.enc(rows)); if (back && back.join() === rows.join()) out.round++; else out.bad.push(w);
      }
      const ok = X.enc(Array.from({ length: 13 }, () => '.'.repeat(20)));
      out.junk = [X.enc(Array.from({ length: 12 }, () => '.'.repeat(20))), X.enc(Array.from({ length: 13 }, () => '.'.repeat(15))), X.enc(Array.from({ length: 13 }, () => '.'.repeat(81))),
        ok.replace('20.', '20Z'), ok + '|' + '20.', 'x'.repeat(5000), '', 17, null].map(s => X.dec(s) === null);
      out.wire = [X.fromWire({ id: 'a', r: 'nope' }), X.fromWire({ id: '', r: ok }), X.fromWire({ id: 'x'.repeat(30), r: ok }), X.fromWire(null), X.fromWire('go')].map(v => v === null);
      out.wireOk = !!X.fromWire({ id: 'u1', n: '<b>名字</b>超过十二个字的名字真的很长', w: 3, r: ok, by: 'yy' });
      const sp = X.fromWire({ id: 'u1', n: '一二三四五六七八九十十一十二十三', w: 99, r: ok, by: 'hacker' });
      out.clamp = sp.name.length === 12 && sp.world === 9 && sp.custom.by === 'cs';
      return out;
    });
    ok(r.round === 300, `300 grids 16–80 wide, every tile: each decodes to exactly what was stored${r.bad.length ? ' — not: ' + r.bad.slice(0, 5).join(',') : ''}`);
    ok(r.junk.every(Boolean), `refused: 12 rows, 15 or 81 wide, a tile that isn't one, an extra row, a huge string, nothing (${r.junk.map(x => (x ? '✓' : '✗')).join('')})`);
    ok(r.wire.every(Boolean) && r.wireOk && r.clamp, 'from the other phone: a level that is not a level is dropped; a long name is cut to 12, an unknown look or maker is held in range');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('edit')) {
    console.log('\n2. The editor');
    const { p, ctx, errs } = await demoPage(browser);
    await openCoop(p);
    const card = await E(p, () => document.querySelector('.cg-maker').textContent.replace(/\s+/g, ' '));
    ok(/关卡编辑/.test(card) && /做一关给 YY/.test(card) && /登录以后/.test(card), `the 一起回家 screen has the editor's card: 「${card.slice(0, 50)}…」`);
    await p.click('.cg-maker [data-a="newlv"]'); await sleep(300);
    let s = await E(p, () => CoopGames.test.ed.state());
    ok(s && s.rows.length === 13 && s.rows[0].length === 40 && s.rows[11] === '#'.repeat(40) && s.rows[10] === '.'.repeat(40), 'a new level: 40 squares of plain ground to build on');
    ok(await E(p, () => CoopGames.test.ed.mine().length === 1 && !CoopGames.test.ed.ok(CoopGames.test.ed.mine()[0])), '…kept as a draft at once (not sendable yet)');
    // the ground tool fills down; tapping the top of the ground shaves one off
    await E(p, () => { const X = CoopGames.test.ed; X.tool('#'); X.paint(5, 8); });
    s = await E(p, () => CoopGames.test.ed.state());
    ok([8, 9, 10, 11, 12].every(r => s.rows[r][5] === '#') && s.rows[7][5] === '.', 'the ground tool fills from the square down to the bottom');
    await E(p, () => CoopGames.test.ed.paint(5, 8));
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[8][5] === '.' && s.rows[9][5] === '#', 'tapping the top of the ground shaves one square off');
    // the eraser makes a gap; planks; stars (3 at most)
    await E(p, () => { const X = CoopGames.test.ed; X.tool('.'); for (const c of [14, 15, 16]) for (const r of [11, 12]) X.paint(c, r); X.tool('='); for (const c of [14, 15, 16]) X.paint(c, 8); X.tool('*'); for (const c of [10, 20, 25, 30]) X.paint(c, 9); });
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[11].slice(14, 17) === '...' && s.rows[12].slice(14, 17) === '...' && s.rows[8].slice(14, 17) === '===', 'the eraser opens a gap; planks go over it');
    ok(s.rows.join('').split('*').length - 1 === 3 && s.rows[9][30] === '.', `three stars at most: the fourth is refused (「${await E(p, () => document.querySelector('.toast')?.textContent || '')}」)`);
    // a box: the square tapped is its bottom-left; it needs room; nothing can be put in it
    await E(p, () => { const X = CoopGames.test.ed; X.tool('X'); X.paint(34, 10); });
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[9][34] === 'X', 'a box: tap the square it stands on, it fills two up and two across');
    const into = await E(p, () => { const X = CoopGames.test.ed; X.tool('h'); return X.paint(35, 10); });
    const tight = await E(p, () => { const X = CoopGames.test.ed; X.tool('X'); return X.paint(39, 10); });
    ok(into === false && tight === false, 'a heart cannot go inside the box, and a box needs two squares across');
    const raft = await E(p, () => { const X = CoopGames.test.ed; X.tool('M'); return [X.paint(38, 5), X.paint(20, 5)]; });
    ok(raft[0] === false && raft[1] === true, 'a raft needs three squares across');
    // undo; longer and shorter
    const u0 = (await E(p, () => CoopGames.test.ed.state())).undo;
    await p.click('.cg-ed [data-e="undo"]'); await sleep(100);
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.undo === u0 - 1 && s.rows[5][20] === '.', '↩ 撤销 takes the last change back');
    await p.click('.cg-ed [data-e="longer"]'); await sleep(100);
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[0].length === 48 && s.rows[11].slice(40) === '#'.repeat(8), '＋ 加长: 8 more squares, with ground under them');
    for (let k = 0; k < 6; k++) await p.click('.cg-ed [data-e="shorter"]');
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[0].length === 16 && await E(p, () => /16 格长/.test(document.querySelector('[data-e="wd"]').textContent)), '－ 变短 stops at 16 squares');
    for (let k = 0; k < 3; k++) await p.click('.cg-ed [data-e="longer"]');
    // the name and the look
    await p.fill('.cg-ed-name', '跳过小河和箱子的一条很长的小路');
    await p.selectOption('.cg-ed-sel', '4'); await sleep(500);
    await p.click('.cg-ed [data-e="back"]'); await sleep(300);
    const kept = await E(p, () => CoopGames.test.ed.mine()[0]);
    ok(kept.n === '跳过小河和箱子的一条很长' && kept.w === 4 && kept.r.length > 10, `closing keeps it: 「${kept.n}」 (12 characters), the 游乐园 look`);
    ok(await E(p, () => /草稿/.test(document.querySelector('.cg-maker').textContent)), 'the card lists it as a draft');
    await p.click('.cg-maker [data-ed]'); await sleep(300);
    s = await E(p, () => CoopGames.test.ed.state());
    ok(s.rows[0].length === 40 && s.lv.n === kept.n, '改 opens it again as it was');
    await p.click('.cg-ed [data-e="back"]'); await sleep(200);
    // six at most
    for (let k = 0; k < 5; k++) { await p.click('.cg-maker [data-a="newlv"]'); await sleep(150); await p.click('.cg-ed [data-e="back"]'); await sleep(150); }
    ok(await E(p, () => CoopGames.test.ed.mine().length === 6 && document.querySelector('.cg-maker [data-a="newlv"]').disabled), 'six levels at most: 新关卡 is off');
    // deleting needs a second tap
    await p.click('.cg-maker [data-ed]'); await sleep(200);
    await p.click('.cg-ed [data-e="del"]'); await sleep(150);
    const still = await E(p, () => CoopGames.test.ed.mine().length);
    await p.click('.cg-ed [data-e="del"]'); await sleep(300);
    ok(still === 6 && await E(p, () => CoopGames.test.ed.mine().length === 5 && JSON.parse(localStorage.getItem('cg_lvdel_cs')).length === 1), '🗑️ needs a second tap; then it is gone (and remembered as deleted, so another phone does not bring it back)');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('play')) {
    console.log('\n3. 试玩 builds the grid; clearing it makes it sendable; the bot can walk one');
    const lv = level({ by: 'cs', cleared: false, sent: false, extra: [[6, 10, 'p'], [24, 10, 'S'], [18, 7, '=']] });
    const { p, ctx, errs } = await demoPage(browser, { mine: [lv] });
    await openCoop(p);
    await p.click('.cg-maker [data-ed]'); await sleep(300);
    ok(await E(p, () => document.querySelector('.cg-ed [data-e="send"]').disabled), '💌 送出 is off until you have cleared it');
    await p.click('.cg-ed [data-e="play"]'); await sleep(500);
    const t = await panel(p);
    ok(/试玩你做的关/.test(t) && /回去编辑/.test(t), `试玩: 「${t.slice(0, 40)}…」`);
    const built = await E(p, () => { const G = CoopGames.test.G, L = G.L; return { w: L.w, chunks: L.chunks.map(c => c.ch.id.slice(0, 2)), plank: L.grid[7 * L.w + 8 + 18], gap: L.grid[11 * L.w + 8 + 13], stars: L.items.filter(it => it.type === 'star').length, foes: L.enemies.length, springs: L.springs.length, mode: G.mode }; });
    ok(built.w === 8 + 30 + 12 && built.chunks.join() === 'st,u~,go' && built.plank === 3 && built.gap === 0, `exactly the grid, between the start and the house (${built.w} squares)`);
    ok(built.stars === 2 && built.foes === 1 && built.springs === 1, `its two stars, the walker and the spring are all there`);
    await p.click('.cg-panel [data-a="go"]'); await sleep(200);
    await toDoor(p);
    await p.waitForFunction(() => /自己通关了/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 6000 });
    ok(await E(p, () => CoopGames.test.ed.ok(CoopGames.test.ed.mine()[0])), 'both in the house: 「自己通关了！」, and it is sendable');
    await p.click('.cg-panel [data-a="edit"]'); await sleep(300);
    ok(await E(p, () => !document.querySelector('.cg-ed').hidden && !document.querySelector('.cg-ed [data-e="send"]').disabled), '回去改一改 goes back to the editor, 💌 送出 on');
    // a change takes it back until it is cleared again
    await E(p, () => { const X = CoopGames.test.ed; X.tool('h'); X.paint(3, 5); });
    ok(await E(p, () => !CoopGames.test.ed.ok(CoopGames.test.ed.state().lv) && document.querySelector('.cg-ed [data-e="send"]').disabled), 'changing it makes it a draft again (clear it again to send it)');
    await p.click('.cg-ed [data-e="undo"]'); await sleep(100);
    ok(await E(p, () => CoopGames.test.ed.ok(CoopGames.test.ed.state().lv)), '…and undoing the change brings back the level that was cleared');
    await p.click('.cg-ed [data-e="send"]'); await sleep(300);
    const sent = await E(p, () => CoopGames.test.ed.mine()[0]);
    ok(sent.s > 0 && await E(p, () => /已送出/.test(document.querySelector('.cg-ed [data-e="send"]').textContent)), `💌 送出: sent (「${await E(p, () => document.querySelector('.toast')?.textContent || '')}」)`);
    await p.click('.cg-ed [data-e="back"]'); await sleep(300);
    ok(await E(p, () => /送给 YY 了/.test(document.querySelector('.cg-maker').textContent)), 'the card says it went to YY');
    // the bot walks a made level, two people and one person (hits off)
    await p.addScriptTag({ content: BOT });
    const res = [];
    for (const mode of ['duo', 'solo']) res.push(await E(p, ([lv, mode]) => { CoopGames.test.startU(lv, mode, false); return window.__bot.run(true, 'U'); }, [level({ w: 36, gap: [10, 11, 12], extra: [[20, 10, 'p'], [26, 8, '='], [27, 8, '='], [28, 8, '=']] }), mode]));
    ok(res.every(r => r.ok), `the bot walks a made level, as two people and as one (${res.map(r => r.ok ? 'ok' : r.chunk + ' ' + r.why).join(', ')})`);
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('partner')) {
    console.log('\n4. Your partner\'s levels, and how they did on yours');
    const theirs = level({ id: 'uyy1', n: '跳过小河', world: 1, by: 'yy' });
    const notCleared = Object.assign(level({ id: 'uyy2', n: '没通关的', by: 'yy' }), { v: '' });
    const tampered = Object.assign(level({ id: 'uyy3', n: '改过没再通关', by: 'yy' }), { r: enc(made({ gap: [3, 4, 5, 6, 7, 8, 9, 10] })) });
    const draft = level({ id: 'uyy4', n: '草稿', by: 'yy', sent: false });
    const mine = level({ id: 'ucs1', n: '我的路', by: 'cs' });
    const { p, ctx, errs } = await demoPage(browser, { partner: { lv: [theirs, notCleared, tampered, draft], pl: { ucs1: { t: 83.4, sm: [true, true, false], at: Date.now() } } }, mine: [mine] });
    await openCoop(p);
    await p.waitForFunction(() => document.querySelectorAll('[data-pplay]').length > 0, null, { timeout: 5000 }).catch(() => {});
    const listed = await E(p, () => [...document.querySelectorAll('[data-pplay]')].map(b => b.dataset.pplay));
    ok(listed.join() === 'uyy1', `only what YY sent, as YY cleared it: ${listed.join() || 'none'} (not a draft, not one YY never cleared, not one changed since)`);
    const card = await E(p, () => document.querySelector('.cg-maker').textContent.replace(/\s+/g, ' '));
    ok(/YY 通关了 · ★★ · 1:23/.test(card), `your own level shows how YY did: 「${(card.match(/YY 通关了[^改]*/) || [''])[0].trim()}」`);
    await p.click('[data-pplay="uyy1"]'); await sleep(500);
    let t = await panel(p);
    ok(/YY 做给你的关/.test(t) && /2 颗星星/.test(t), `YY's level: 「${t.slice(0, 50)}…」`);
    await p.click('.cg-panel [data-a="go"]'); await sleep(200);
    await E(p, () => { const G = CoopGames.test.G; G.stars = [true, false, false]; });
    await toDoor(p);
    await p.waitForFunction(() => /回到家啦/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 6000 });
    t = await panel(p);
    const kept = await E(p, () => CoopGames.test.ed.results().uyy1);
    ok(/YY 会看到你们的成绩/.test(t) && kept && kept.sm[0] && !kept.sm[1], `cleared: kept for YY (★ ${kept && kept.sm.map(x => (x ? '★' : '☆')).join('')})`);
    await p.click('.cg-panel [data-a="re"]'); await sleep(300);
    await p.click('.cg-panel [data-a="go"]').catch(() => {}); await sleep(200);
    await E(p, () => { CoopGames.test.G.stars = [false, true, false]; });
    await toDoor(p);
    await p.waitForFunction(() => /回到家啦/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 6000 });
    const best = await E(p, () => CoopGames.test.ed.results().uyy1);
    ok(best.sm[0] && best.sm[1] && best.t <= kept.t + .01, 'again: every star either run took, and the faster time');
    await p.click('.cg-panel [data-a="menu"]'); await sleep(300);
    ok(await E(p, () => /通关了 · ★★/.test(document.querySelector('.cg-maker').textContent)), 'the card shows how you did on YY\'s level');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('sync')) {
    console.log('\n5. The sync merge');
    const { p, ctx } = await demoPage(browser);
    const m = await E(p, () => {
      const M = (a, b) => App._progTest.merge(a, b);
      const L = (id, at, n) => ({ id, at, n, r: '13.|13.|13.|13.|13.|13.|13.|13.|13.|13.|13.|16#|16#' });
      const a = { lv: [L('u1', 10, 'old'), L('u2', 5, 'two')], lvdel: [], pl: { x: { t: 50, sm: [true, false, false], at: 1 } } };
      const b = { lv: [L('u1', 20, 'new'), L('u3', 7, 'three')], lvdel: ['u2'], pl: { x: { t: 40, sm: [false, false, true], at: 2 }, y: { t: 9, sm: [true, true, true], at: 3 } } };
      const r = M(a, b);
      const many = M({ lv: Array.from({ length: 9 }, (_, k) => L('m' + k, k)) }, {});
      const junk = M({ lv: [null, { id: 3 }, { id: 'ok' }, L('good', 1)] }, {});
      const none = M({ mg: { catch: { lv: 2, n: 30 } } }, {});
      return { ids: r.lv.map(l => l.id + ':' + l.n), del: r.lvdel, x: r.pl.x, y: !!r.pl.y, many: many.lv.length, newest: many.lv[0].id, junk: junk.lv.map(l => l.id), noCoop: !('coop' in none) && none.mg.catch.lv === 2 };
    });
    ok(m.ids.join() === 'u1:new,u3:three', `every level either phone has, the newer edit of each, and not the one deleted on the other (${m.ids.join(' ')})`);
    ok(m.del.join() === 'u2' && m.x.t === 40 && m.x.sm.join() === 'true,false,true' && m.y, 'results: the faster time and every star from both');
    ok(m.many === 6 && m.newest === 'm8' && m.junk.join() === 'good', 'six levels at most (the newest), and broken entries are dropped');
    ok(m.noCoop, 'no 一起回家 save yet: the merge leaves it out (a coop: null made the server refuse the whole write — mini-game records and made levels were never saved)');
    await ctx.close();
  }

  if (on('look')) {
    console.log('\n6. Looks: 360 / 390 / 820, light and dark');
    for (const [w, h] of [[360, 740], [390, 844], [820, 1180]]) for (const theme of ['light', 'dark']) {
      const { p, ctx, errs } = await demoPage(browser, { w, h, theme, partner: { lv: [level({ id: 'uyy1', n: '跳过小河', by: 'yy' })] }, mine: [level({ id: 'ucs1', n: '我的路', by: 'cs' })] });
      await openCoop(p);
      const card = await E(p, () => { const c = document.querySelector('.cg-maker'); return { over: document.documentElement.scrollWidth > innerWidth + 1, small: [...c.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 44).length, spill: [...c.querySelectorAll('.cg-mtx b, button')].filter(e => e.scrollWidth > e.clientWidth + 1 && !e.matches('.cg-mtx b')).length }; });
      await p.click('.cg-maker [data-ed]'); await sleep(400);
      const ed = await E(p, () => {
        const r = document.querySelector('.cg-ed'), vis = [...r.querySelectorAll('button, input, select')].filter(b => b.offsetParent);
        // the things to put down scroll along their own row (nineteen don't fit a phone); the row itself must be on the screen
        const tools = document.querySelector('.cg-ed-tools').getBoundingClientRect();
        const out = vis.filter(b => !b.closest('.cg-ed-tools')).concat([document.querySelector('.cg-ed-tools')]).filter(b => { const q = b.getBoundingClientRect(); return q.left < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1; }).map(b => b.textContent.trim().slice(0, 6));
        const first = r.querySelector('.cg-ed-t').getBoundingClientRect();
        if (first.left < tools.left - 1) out.push('first tool');
        const small = vis.filter(b => b.getBoundingClientRect().height < 44).map(b => b.textContent.trim().slice(0, 6));
        const cv = document.querySelector('.cg-ed-cv').getBoundingClientRect(), wrap = document.querySelector('.cg-ed-wrap').getBoundingClientRect();
        return { out, small, cell: CoopGames.test.ed.state().cell, rows: cv.height, wrapH: wrap.height, over: document.documentElement.scrollWidth > innerWidth + 1, theme: document.documentElement.dataset.theme };
      });
      if (w === 390) await p.screenshot({ path: path.join(SHOTS, `editor_${theme}.png`) });
      ok(!card.over && !card.small && !ed.over && !ed.out.length && !ed.small.length && ed.cell >= 20 && ed.rows <= ed.wrapH + 1 && ed.theme === theme,
        `${w} ${theme}: the card fits with buttons ≥ 44px; the editor fits (squares ${ed.cell}px, nothing off the screen ${JSON.stringify(ed.out)}, nothing small ${JSON.stringify(ed.small)})`);
      ok(!errs.length, `${w} ${theme}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
