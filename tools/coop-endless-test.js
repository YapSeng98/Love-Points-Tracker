// ♾️ 一直走下去 — 一起回家's endless road (coop.js, CLAUDE.md §7.33), on one phone:
//   1. the made stretches are fair by construction, for every seed and difficulty (gaps, runways, steps, spikes)
//   2. a 段 follows from the run and its number: the same on every phone, harder as it goes, and the wire refuses junk
//   3. the play-test bot walks many runs, 段 after 段, as two people on one phone and as one person playing both
//   4. the run in the app: the card, the intro, a 段 walked, the next one by itself, hearts that carry over,
//      stopping, the hearts running out, the record (and on the home card), another run
//   5. points: the first run to get 3 / 6 / 10 段 far pays +1 each, once, inside the day's +3
//   6. the record follows you to your other phones (the merge keeps the farther run)
//   7. looks: 360 / 390 / 820, light and dark
// The two-phone game is in tools/coop-live-test.js (§ endless).
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-endless-test.js        RUNS=6 DMAX=12 for the bot section, ONLY=gen,spec,bot,run,pay,sync,look
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const APP_URL = process.env.APP_URL || 'http://localhost:8765/index.html';
const RUNS = +(process.env.RUNS || 6), DMAX = +(process.env.DMAX || 12);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = (k) => !ONLY || ONLY.includes(k);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = fs.readFileSync(path.join(__dirname, 'coop-bot.js'), 'utf8');
const SHOTS = process.env.SHOTS || require('os').tmpdir();

async function demoPage(browser, { w = 390, h = 844, theme = 'light', mobile = true, save = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.route(/open-meteo/, r => r.abort());
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(([th, save]) => {
    localStorage.setItem('theme_mode', th);
    for (const k of Object.keys(localStorage)) if (/^cg_|^cgb_|^mg_done_/.test(k)) localStorage.removeItem(k);
    if (save) localStorage.setItem('cg_save3_cs', JSON.stringify(save));
  }, [theme, save]);
  await p.reload();
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => App.demoMode());
  await sleep(300);
  return { p, ctx, errs };
}
const openCoop = async (p) => { await p.evaluate(() => App.openCoop('home')); await p.waitForFunction(() => document.querySelector('.cg-home'), null, { timeout: 15000 }); };
// both of you at the house: the 段 is walked
const toDoor = (p) => p.evaluate(() => { const T = CoopGames.test, G = T.G, d = G.L.door; T.tp(0, d.x - 0.9, d.y - 1.18); T.tp(1, d.x - 0.2, d.y - 1.18); });
const panel = (p) => p.evaluate(() => { const el = document.querySelector('.cg-veil:not([hidden]) .cg-panel'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; });
const state = (p) => p.evaluate(() => { const G = CoopGames.test.G; return { st: G.state, d: G.espec && G.espec.endless, hp: G.hp, rs: G.run && G.run.rs, seq: G.espec && G.espec.seq.join(' '), w: G.espec && G.espec.world }; });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  if (on('gen')) {
    console.log('\n1. The made stretches: fair by construction, for every seed and difficulty');
    const { p, ctx, errs } = await demoPage(browser, { mobile: false, w: 1000, h: 640 });
    await openCoop(p);
    const r = await p.evaluate(() => {
      const E = CoopGames.test.endless, bad = [], seen = { M: 0, '=': 0, '^': 0, p: 0, n: 0, a: 0, G: 0, Q: 0, l: 0 };
      let n = 0, widths = [];
      for (let seed = 1; seed <= 300; seed++) for (let df = 1; df <= 5; df++) for (const run of [false, true]) for (const lamps of [false, true]) {
        if (lamps && seed % 3) continue;
        const rows = E.genRows(seed * 7919 + df, df, run, lamps), again = E.genRows(seed * 7919 + df, df, run, lamps);
        n++;
        const tag = `${seed}/${df}${run ? 'r' : ''}${lamps ? 'l' : ''}`;
        const W = rows[0].length; widths.push(W);
        if (rows.length !== 13 || rows.some(x => x.length !== W)) { bad.push(tag + ' shape'); continue; }
        if (rows.join() !== again.join()) bad.push(tag + ' not the same twice');
        const top = (x) => { for (let r = 0; r < 13; r++) if (rows[r][x] === '#') return r; return null; };
        const tops = Array.from({ length: W }, (_, x) => top(x));
        for (let x = 0; x < W; x++) for (let r = 0; r < 13; r++) { const ch = rows[r][x]; if (seen[ch] != null) seen[ch]++; if (ch === 'S') bad.push(tag + ' a spring'); if (ch === 'h' && tops[x] != null && r >= tops[x]) bad.push(tag + ' a heart in the ground'); }
        if ([0, 1].some(x => tops[x] !== 11) || [1, 2, 3, 4, 5].some(k => tops[W - k] !== 11)) bad.push(tag + ' does not start/end on the usual ground');
        if (run && rows.some(r => r.includes('M'))) bad.push(tag + ' a raft in a storm stretch');
        if (!lamps && rows.some(r => r.includes('l'))) bad.push(tag + ' lanterns without the dark');
        // every pit: narrow (≤4), or a plank pit (≤7, one plank), or a raft pit (9); a runway before it, room after it
        for (let x = 0; x < W;) {
          if (tops[x] != null) { x++; continue; }
          let e = x; while (e < W && tops[e] == null) e++;
          const pw = e - x, cols = rows.map(r => r.slice(x, e)).join('');
          const plank = cols.includes('='), raft = cols.includes('M');
          if (!(pw <= 4 || (plank && pw <= 7) || (raft && pw === 9))) bad.push(`${tag} a pit ${pw} wide at ${x}`);
          const before = tops.slice(Math.max(0, x - 3), x), after = tops.slice(e, e + 2);
          if (before.length < 3 || before.some(t => t !== before[0])) bad.push(`${tag} no runway before the pit at ${x}`);
          if (after.length < 2 || after.some(t => t !== after[0])) bad.push(`${tag} no room after the pit at ${x}`);
          if (after[0] != null && before[0] != null && before[0] - after[0] > 1) bad.push(`${tag} the far side of the pit at ${x} is ${before[0] - after[0]} higher`);
          x = e;
        }
        for (let x = 1; x < W; x++) if (tops[x] != null && tops[x - 1] != null && tops[x - 1] - tops[x] > 3) bad.push(`${tag} a step up of ${tops[x - 1] - tops[x]} at ${x}`);
        // a jump over spikes comes down on ground, not in a pit
        for (let x = 0; x < W; x++) if (rows.some(r => r[x] === '^')) for (let k = 1; k <= 4; k++) if (x + k < W && tops[x + k] == null) { bad.push(`${tag} a pit ${k} after spikes at ${x}`); break; }
        if (rows.join('').split('h').length - 1 > 6) bad.push(tag + ' too many hearts');
      }
      return { n, bad: bad.slice(0, 12), nbad: bad.length, seen, wmin: Math.min(...widths), wmax: Math.max(...widths) };
    });
    ok(r.nbad === 0, `${r.n} stretches (300 seeds × 5 levels of hard, storm and dark ones): every pit fair, every jump possible, no springs${r.nbad ? ' — ' + r.bad.join(' | ') : ''}`);
    ok(r.wmin >= 24 && r.wmax <= 90, `each is ${r.wmin}–${r.wmax} tiles long`);
    ok(Object.values(r.seen).every(v => v > 0), `everything turns up somewhere: ${Object.entries(r.seen).map(([k, v]) => k + v).join(' ')}`);
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('spec')) {
    console.log('\n2. A 段 follows from the run: the same on every phone, harder as it goes; the wire refuses junk');
    const { p, ctx, errs } = await demoPage(browser, { mobile: false, w: 1000, h: 640 });
    await openCoop(p);
    const r = await p.evaluate(() => {
      const E = CoopGames.test.endless, all = [...Array(10).keys()], out = { bad: [] };
      const spec = (rs, d, ws = all) => E.spec({ rs, d, hp: 5, he: 0, t: 0, ws });
      const isGen = (id) => E.GEN_RE.test(id), isPuzzle = (id) => !isGen(id) && !['start', 'goal', 'cp'].includes(id);
      out.same = JSON.stringify(spec(424242, 7)) === JSON.stringify(spec(424242, 7));
      out.diffRun = spec(1, 1).seq.join() !== spec(2, 1).seq.join();
      for (let run = 1; run <= 5; run++) {
        const rs = run * 99991;
        for (let d = 1; d <= 40; d++) {
          const s = spec(rs, d), prev = d > 1 ? spec(rs, d - 1) : null, pz = s.seq.filter(isPuzzle);
          if (s.seq[0] !== 'start' || s.seq[s.seq.length - 1] !== 'goal') out.bad.push(`${rs}/${d} ends`);
          if (prev && prev.world === s.world) out.bad.push(`${rs}/${d} the same world twice in a row`);
          if (d % 4 === 0) { if (!s.chase || pz.length) out.bad.push(`${rs}/${d} the storm 段 should be a run`); }
          else { if (s.chase) out.bad.push(`${rs}/${d} a storm off the 4th`); if (pz.length !== (d <= 1 ? 1 : d <= 3 ? 2 : 3)) out.bad.push(`${rs}/${d} ${pz.length} puzzles`); }
          if (s.dark !== (s.world === 9 && d >= 5)) out.bad.push(`${rs}/${d} dark=${s.dark} in world ${s.world}`);
          for (const id of pz) if (!E.POOL[s.world].includes(id)) out.bad.push(`${rs}/${d} ${id} is not from world ${s.world}`);
          if (s.seq.some(id => /^(boss|R_run\d)$/.test(id))) out.bad.push(`${rs}/${d} has the boss or a storm-level piece`);
          const df = +((s.seq.find(isGen) || 'g0_0').split('_')[1][0]);
          if (df !== Math.min(5, 1 + Math.floor((d - 1) / 2))) out.bad.push(`${rs}/${d} difficulty ${df}`);
          if (s.rank !== Math.min(49, 15 + d * 2)) out.bad.push(`${rs}/${d} rank ${s.rank}`);
          if (s.chase && s.chase.speed !== Math.min(2.4, 1.5 + d * 0.05)) out.bad.push(`${rs}/${d} storm speed`);
        }
      }
      // ten 段 visit ten different worlds; a phone that has only reached the first world stays in it
      out.tenWorlds = new Set(Array.from({ length: 10 }, (_, k) => spec(777, k + 1).world)).size;
      out.oneWorld = Array.from({ length: 12 }, (_, k) => spec(777, k + 1, [0]).world).every(w => w === 0);
      // the wire: what the host sends builds exactly the same 段, and junk is dropped
      CoopGames.test.G.run = { rs: 31337, d: 9, hp: 3, he: 40, t: 300.25, ws: all };
      CoopGames.test.G.espec = spec(31337, 9);
      const wire = E.wire(), back = E.fromWire(JSON.parse(JSON.stringify(wire)));
      out.round = !!back && back.spec.seq.join() === CoopGames.test.G.espec.seq.join() && back.spec.world === CoopGames.test.G.espec.world && back.run.hp === 3 && back.run.he === 40 && back.run.d === 9;
      const junk = [
        { ...wire, seq: ['start', 'nope', 'goal'] }, { ...wire, seq: ['C_stack', 'goal'] }, { ...wire, seq: ['start', 'C_stack'] },
        { ...wire, d: 0 }, { ...wire, w: 99 }, { ...wire, seq: Array(30).fill('cp') }, { ...wire, seq: ['start', 7, 'goal'] }, { ...wire, rs: 'x' }, null, 'go',
        { ...wire, seq: ['start', 'g12_9', 'goal'] }, { ...wire, seq: ['start', 'g12_3zz', 'goal'] },
      ];
      out.junk = junk.map(j => E.fromWire(j) === null);
      out.hpClamp = E.fromWire({ ...wire, hp: 99 }).run.hp === 5 && E.fromWire({ ...wire, hp: -3 }).run.hp === 1;
      return out;
    });
    ok(r.same && r.diffRun, 'the same run and 段 give the same pieces every time; another run gives others');
    ok(!r.bad.length, `200 段 over 5 runs: a new world each 段, a storm run every 4th, the night dark from 段 5, 1 → 2 → 3 puzzles, each from its own world, harder and faster walkers as it goes${r.bad.length ? ' — ' + r.bad.slice(0, 6).join(' | ') : ''}`);
    ok(r.tenWorlds === 10 && r.oneWorld, `ten 段 walk through all ten worlds (${r.tenWorlds}); a phone that has only reached 春 stays in 春`);
    ok(r.round, 'the 段 the host sends builds exactly the same one on the other phone (pieces, world, hearts, 💗, 段)');
    ok(r.junk.every(Boolean), `junk on the wire is dropped: ${r.junk.map(x => (x ? '✓' : '✗')).join('')}`);
    ok(r.hpClamp, 'hearts on the wire are held to 1–5');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('bot')) {
    console.log(`\n3. The bot walks ${RUNS} runs × ${DMAX} 段, two people on one phone and one person playing both (hits off)`);
    const { p, ctx, errs } = await demoPage(browser, { mobile: false, w: 1000, h: 640 });
    await openCoop(p);
    await p.addScriptTag({ content: BOT });
    for (const mode of ['duo', 'solo']) {
      const bad = []; let n = 0;
      for (let run = 1; run <= RUNS; run++) for (let d = 1; d <= DMAX; d++) {
        const rs = run * 7777 + 13;
        const r = await p.evaluate(([rs, d, mode]) => window.__bot.playE(rs, d, true, mode), [rs, d, mode]);
        n++;
        if (!r.ok) bad.push(`run ${rs} 段${d}@${r.chunk}(${r.why})`);
      }
      ok(!bad.length, `${mode === 'duo' ? '两个人' : '一个人'}: ${n - bad.length}/${n} 段 walked${bad.length ? ' — stuck: ' + bad.join(', ') : ''}`);
    }
    {
      // hard, but not a wall: a bot that never dodges, each 段 started on 5 hearts, walks most of them (it walked 20/24
      // once the storm 段 stopped putting chestnuts and wide spikes in front of the storm)
      const res = [];
      for (const rs of [50505, 60606, 70707]) for (let d = 1; d <= 8; d++) res.push(await p.evaluate(([rs, d]) => window.__bot.playE(rs, d, false, 'duo'), [rs, d]));
      const done = res.filter(r => r.ok).length;
      ok(done >= 18, `with real hits, the bot (which never dodges) still walks ${done}/24 段 of three runs`);
    }
    ok(!errs.length, 'no page errors while walking ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('run')) {
    console.log('\n4. The run in the app: the card, a 段 walked, the next by itself, hearts that carry over, stopping, running out');
    const { p, ctx, errs } = await demoPage(browser);
    await openCoop(p);
    const card = await p.evaluate(() => { const c = document.querySelector('.cg-endless'); return c ? { text: c.textContent.replace(/\s+/g, ' '), btn: c.querySelector('.cg-ego').textContent, before: !!document.querySelector('.cg-endless ~ .cg-worlds') } : null; });
    ok(card && /一直走下去/.test(card.text) && /新/.test(card.text) && /还没走过/.test(card.text) && card.btn === '出发' && card.before, `the home screen has the endless card above the worlds: 「${card && card.text.slice(0, 40)}…」`);
    await p.click('.cg-ego');
    await p.waitForFunction(() => document.querySelector('.cg-stage:not([hidden]) .cg-panel h2'), null, { timeout: 10000 });
    let t = await panel(p);
    ok(/♾️ 第 1 段/.test(t) && /一直走下去/.test(t) && /心用完就结束/.test(t), `出发 → 段 1's card says how it works: 「${t.slice(0, 60)}…」`);
    const hud = await p.evaluate(() => ({ name: document.querySelector('[data-r="name"]').textContent, stars: document.querySelector('[data-r="stars"]').hidden }));
    await p.click('.cg-panel [data-a="go"]'); await sleep(300);
    const hud2 = await p.evaluate(() => ({ name: document.querySelector('[data-r="name"]').textContent, stars: document.querySelector('[data-r="stars"]').hidden }));
    ok(/^♾️ 第 1 段/.test(hud2.name) && hud2.stars, `the bar says 「${hud2.name}」 and shows no stars (how far you get is the score)`);
    const s1 = await state(p);
    await toDoor(p);
    await p.waitForFunction(() => /走完第 1 段/.test(document.querySelector('.cg-panel').textContent), null, { timeout: 6000 });
    t = await panel(p);
    ok(/下一段：/.test(t) && /继续走 · \d/.test(t) && /歇一歇/.test(t), `段 1 walked → what comes next, and a countdown: 「${t.slice(0, 80)}…」`);
    await p.waitForFunction(() => CoopGames.test.G.state === 'play' && CoopGames.test.G.espec.endless === 2, null, { timeout: 7000 });
    const s2 = await state(p);
    ok(s2.d === 2 && s2.rs === s1.rs && s2.w !== s1.w && s2.hp === 5, `…and goes on by itself: 段 2, another world (${s1.w} → ${s2.w}), hearts still full`);
    // hearts carry over, +1 for each 段 walked
    await p.evaluate(() => { CoopGames.test.G.hp = 2; });
    await toDoor(p);
    await p.waitForFunction(() => /走完第 2 段/.test(document.querySelector('.cg-panel').textContent), null, { timeout: 6000 });
    t = await panel(p);
    ok(/❤ \+1，现在有 3 颗心/.test(t), `2 hearts left at the end of 段 2 → 「❤ +1，现在有 3 颗心」`);
    await p.click('.cg-panel [data-a="go"]');
    await p.waitForFunction(() => CoopGames.test.G.state === 'play' && CoopGames.test.G.espec.endless === 3, null, { timeout: 4000 });
    ok((await state(p)).hp === 3, '继续走 straight away: 段 3 starts with those 3 hearts');
    const rec = await p.evaluate(() => JSON.parse(localStorage.getItem('cg_save3_cs')).endless);
    ok(rec && rec.d === 2, `the record is kept 段 by 段 (a run left halfway still counts): ${JSON.stringify(rec)}`);
    // the 段 again from the start keeps the hearts as they are (it is not a way to refill them)
    await p.evaluate(() => { CoopGames.test.G.hp = 2; });
    await p.click('[data-r="pause"]'); await sleep(200);
    t = await panel(p);
    ok(/这一段重来/.test(t) && /结束这一趟/.test(t) && !/这一关重来/.test(t), `pause: 这一段重来 and 结束这一趟: 「${t.slice(0, 60)}」`);
    await p.click('.cg-panel [data-a="re"]'); await sleep(300);
    const s3 = await state(p);
    ok(s3.d === 3 && s3.hp === 2 && s3.st === 'play', `这一段重来: 段 3 from its start, still 2 hearts (not refilled)`);
    await p.click('[data-r="pause"]'); await sleep(200);
    await p.click('.cg-panel [data-a="end"]'); await sleep(300);
    t = await panel(p);
    ok(/歇一歇/.test(t) && /一起走完了 2 段/.test(t) && /新纪录/.test(t) && /再走一次/.test(t), `结束这一趟 → 「${t.slice(0, 70)}」`);
    await p.click('.cg-panel [data-a="again"]'); await sleep(300);
    const s4 = await state(p);
    t = await panel(p);
    ok(s4.d === 1 && s4.rs !== s1.rs && s4.hp === 5 && /♾️ 第 1 段/.test(t), '再走一次: a new run from 段 1, other pieces, full hearts');
    await p.click('.cg-panel [data-a="go"]'); await sleep(200);
    await p.evaluate(() => { CoopGames.test.G.hp = 1; CoopGames.test.hurt(); });
    await p.waitForFunction(() => /心用完了/.test((document.querySelector('.cg-veil:not([hidden]) .cg-panel') || {}).textContent || ''), null, { timeout: 4000 });
    t = await panel(p);
    ok(/第 1 段还没走完/.test(t) && /最远走完 2 段/.test(t) && !/新纪录/.test(t), `the hearts run out on 段 1 → 「${t.slice(0, 70)}」`);
    await p.click('.cg-panel [data-a="menu"]'); await sleep(300);
    const card2 = await p.evaluate(() => document.querySelector('.cg-endless').textContent.replace(/\s+/g, ' '));
    ok(/最远走完 2 段/.test(card2), `back on the home screen the card shows the record: 「${card2.match(/🏆[^第]*/) ? card2.match(/🏆[^第]*/)[0] : card2.slice(0, 40)}」`);
    // a level of the 50 is untouched by all this
    await p.click('.cg-lv[data-i="0"]'); await sleep(300);
    t = await panel(p);
    ok(/1-1 樱花小路/.test(t) && await p.evaluate(() => CoopGames.test.G.hp === 5 && !document.querySelector('[data-r="stars"]').hidden), 'the 50 levels are as they were: 1-1, five hearts, stars');
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  }

  if (on('pay')) {
    console.log('\n5. Points: the first run to get 3 / 6 / 10 段 far pays +1 each, once, inside the day\'s +3');
    const { p, ctx, errs } = await demoPage(browser);
    await openCoop(p);
    const entries = () => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('love_score_data') || '{"entries":{}}'); return Object.values(d.entries).flat().filter(e => /一起回家/.test(e.desc || '')).map(e => `${e.charId}:${e.pts}:${e.desc}`); });
    const walk = async (d) => {
      await p.evaluate(([d]) => { const T = CoopGames.test; T.startE(4242, d, 'duo'); T.set('test', false); }, [d]);
      await toDoor(p);
      await p.waitForFunction(() => CoopGames.test.G.state === 'result', null, { timeout: 6000 });
      await sleep(600);
      const line = await p.evaluate(() => (document.querySelector('.cg-panel [data-r="pay"]') || {}).textContent || '');
      await p.evaluate(() => CoopGames.test.closeStage());
      return line;
    };
    let line = await walk(2);
    ok(!line && !(await entries()).length, '段 2 walked: nothing to pay');
    line = await walk(3);
    let es = await entries();
    ok(/第一次走完 3 段 \+1/.test(line) && es.length === 1 && /^char1:1:一起回家 · ♾️ 一直走下去 · 走完第 3 段$/.test(es[0]), `段 3 walked the first time: +1, one ledger row for the person holding the phone (「${es[0]}」)`);
    line = await walk(3);
    ok(!/\+1/.test(line) && (await entries()).length === 1, 'walking 段 3 again pays nothing');
    await walk(6); await walk(10);
    es = await entries();
    ok(es.length === 3 && es.some(e => /走完第 6 段/.test(e)) && es.some(e => /走完第 10 段/.test(e)), `6 and 10 pay once each: ${es.length} rows`);
    const keys = await p.evaluate(() => App._cgPaidKeysTest('coop'));
    ok(['E3', 'E6', 'E10'].every(k => keys.includes(k)), `kept with the level keys, so another phone of yours knows: ${keys.join(',')}`);
    ok(!errs.length, 'no page errors ' + errs.join(' | '));
    await ctx.close();
    // the cap: two levels paid already today, then 段 3 and 段 6
    const b = await demoPage(browser);
    await openCoop(b.p);
    await b.p.evaluate(async () => { await App._cgPayTest('coop', 'M1', 'test 1'); await App._cgPayTest('coop', 'M2', 'test 2'); });
    const w3 = await b.p.evaluate(async () => { const T = CoopGames.test; T.startE(4242, 3, 'duo'); T.set('test', false); return true; });
    await toDoor(b.p); await b.p.waitForFunction(() => CoopGames.test.G.state === 'result', null, { timeout: 6000 }); await sleep(600);
    const l3 = await b.p.evaluate(() => document.querySelector('.cg-panel [data-r="pay"]').textContent);
    await b.p.evaluate(() => { CoopGames.test.closeStage(); const T = CoopGames.test; T.startE(4242, 6, 'duo'); T.set('test', false); });
    await toDoor(b.p); await b.p.waitForFunction(() => CoopGames.test.G.state === 'result', null, { timeout: 6000 }); await sleep(600);
    const l6 = await b.p.evaluate(() => document.querySelector('.cg-panel [data-r="pay"]').textContent);
    const keys2 = await b.p.evaluate(() => App._cgPaidKeysTest('coop'));
    ok(w3 && /\+1/.test(l3) && /今天的 \+3 分已经拿满/.test(l6) && !keys2.includes('E6'), `inside the day's +3: 段 3 makes three, 段 6 waits for another day (「${l6.trim()}」)`);
    await b.ctx.close();
  }

  if (on('sync')) {
    console.log('\n6. The record follows you to your other phones');
    const { p, ctx } = await demoPage(browser);
    const m = await p.evaluate(() => {
      const M = (a, b) => App._progTest.merge({ coop: a }, { coop: b }).coop.endless;
      return {
        farther: M({ unlocked: 3, best: {}, endless: { d: 3, h: 90 } }, { unlocked: 1, best: {}, endless: { d: 5, h: 2 } }),
        tie: M({ unlocked: 1, best: {}, endless: { d: 4, h: 30 } }, { unlocked: 1, best: {}, endless: { d: 4, h: 12 } }),
        one: M({ unlocked: 1, best: {} }, { unlocked: 1, best: {}, endless: { d: 2, h: 7 } }),
        none: M({ unlocked: 1, best: {} }, { unlocked: 1, best: {} }),
        keep: App._progTest.merge({ coop: { unlocked: 9, best: { M1: { t: 50, sm: [true, false, false], h: 3 } }, endless: { d: 6, h: 1 } } }, {}).coop,
      };
    });
    ok(m.farther.d === 5 && m.tie.h === 30 && m.one.d === 2 && m.none === undefined, `the merge keeps the farther run (5 over 3), more 💗 on a tie (30 over 12), whichever phone has one`);
    ok(m.keep.endless.d === 6 && m.keep.unlocked === 9 && m.keep.best.M1.t === 50, 'and the levels, stars and times beside it are untouched');
    await ctx.close();
  }

  if (on('look')) {
    console.log('\n7. Looks: 360 / 390 / 820, light and dark');
    for (const [w, h] of [[360, 640], [390, 844], [820, 1180]]) for (const theme of ['light', 'dark']) {
      const { p, ctx, errs } = await demoPage(browser, { w, h, theme, save: { unlocked: 12, best: {}, endless: { d: 12, h: 380, t: 1234 } } });
      await openCoop(p);
      const m = await p.evaluate(() => {
        const c = document.querySelector('.cg-endless'), b = c.querySelector('.cg-ego'), r = c.getBoundingClientRect(), br = b.getBoundingClientRect();
        const spill = [...c.querySelectorAll('h4, p, button, .cg-lab')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.slice(0, 10));
        return { over: document.documentElement.scrollWidth > innerWidth + 1, inside: br.right <= r.right + 1 && br.left >= r.left - 1, bh: br.height, spill, theme: document.documentElement.dataset.theme };
      });
      await p.click('.cg-ego'); await sleep(400);
      await p.click('.cg-panel [data-a="go"]'); await sleep(200);
      await toDoor(p);
      await p.waitForFunction(() => /走完第 1 段/.test(document.querySelector('.cg-panel').textContent), null, { timeout: 6000 });
      const pm = await p.evaluate(() => { const el = document.querySelector('.cg-panel'); return { scroll: el.scrollHeight > el.clientHeight + 1, btns: [...el.querySelectorAll('.pb button')].every(b => b.getBoundingClientRect().height >= 44) }; });
      if (w === 390) await p.screenshot({ path: path.join(SHOTS, `endless_${theme}.png`) });
      ok(!m.over && m.inside && m.bh >= 44 && !m.spill.length && m.theme === theme && !pm.scroll && pm.btns, `${w} ${theme}: the card fits (出发 ${Math.round(m.bh)}px), the 段 card needs no scrolling, its buttons ≥ 44px${m.spill.length ? ' — clipped: ' + m.spill.join(',') : ''}`);
      ok(!errs.length, `${w} ${theme}: no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
