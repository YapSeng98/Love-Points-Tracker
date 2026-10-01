// 月末结算 browser test. Serve the repo first:  python3 -m http.server 8765
// then:  node tools/settle-test.js
//
// Replays the 2026-10-01 report — four 9/30 entries logged on 10/1 went into
// October, so September's settle left them out — and the other ways the same
// symptom can happen: a partner logging while the other settles (mocked
// server answering 409), a double tap, a phone left open across midnight.
// Demo mode with a faked clock; the mocked-server part never touches the real
// backend.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const PORT = 8765, APP_URL = `http://localhost:${PORT}/index.html`;
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const E = (id, charId, pts, date, extra = {}) =>
  ({ id, charId, catId: 'c1', catName: '陪伴时光', icon: '💑', pts, desc: '', date, month: date.slice(0, 7), ...extra });

function seed({ entries = [], history = [], archive = [] } = {}) {
  const buckets = {};
  entries.forEach(e => (buckets[e.month] ||= []).push(e));
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: buckets, history, archive,
    letters: [], photos: [], goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '', petSpecies: '', petExp: 0, petBase: 0, petEquipped: '', wx1: '', wx2: '',
    charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [{ id: 'c1', icon: '💑', name: '陪伴时光', pts: 10, active: true }],
    rewards: [{ id: 'r1', icon: '🎁', name: '盲盒', minPts: 20 }], punishments: [],
  };
}

async function page(browser, when, data, { theme = 'light', w = 390, h = 844, install = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|fonts\.g|SN 409/.test(m.text())) errs.push(m.text()); });
  if (install) await p.clock.install({ time: new Date(when) });
  else await p.clock.setFixedTime(new Date(when));
  await p.route(/open-meteo/, r => r.abort());
  await p.addInitScript(([d, th]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      localStorage.setItem('love_score_data', JSON.stringify(d));
      localStorage.setItem('theme_mode', th);
      sessionStorage.setItem('seeded', '1');
    }
  }, [data, theme]);
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode()); await sleep(500);
  return { p, ctx, errs };
}
const LSd = p => p.evaluate(() => JSON.parse(localStorage.getItem('love_score_data')));
const allLive = d => Object.values(d.entries || {}).flat();

async function addEntry(p, date, pts, desc) {
  await p.evaluate(() => App.openAddModal()); await sleep(150);
  await p.fill('#add-date', date);
  await p.dispatchEvent('#add-date', 'input');
  await p.fill('#add-pts', String(pts));
  await p.fill('#add-desc', desc || '');
  const hint = await p.evaluate(() => { const h = document.getElementById('add-date-hint'); return h && h.style.display !== 'none' ? h.textContent : ''; });
  await p.evaluate(() => App.submitEntry()); await sleep(300);
  return hint;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

  console.log('\n1. 10/1 晚上补记 9/30 → 结算 9 月时算进去（当晚的真实情况）');
  {
    const { p, ctx, errs } = await page(browser, '2026-10-01T22:35:00+08:00', seed({ entries: [
      E('s1', 'char1', 10, '2026-09-28'), E('s2', 'char2', 10, '2026-09-29'),
      E('o1', 'char2', 2, '2026-10-01', { catName: '📅 每日签到', icon: '📅' }),
    ] }));
    const hint = await addEntry(p, '2026-09-30', 5, '说晚安');
    ok(/算在 9 月/.test(hint), '选 9/30 时提示「这条算在 9 月」: ' + hint);
    let d = await LSd(p);
    const back = allLive(d).find(e => e.desc === '说晚安');
    ok(back && back.month === '2026-09' && back.date === '2026-09-30', `补记的 9/30 记在 9 月（${back && back.month}），不是 10 月`);
    await p.evaluate(() => App._setChar('char2'));
    await addEntry(p, '2026-09-30', 1, '12.00睡觉');
    await p.evaluate(() => App._setChar('char1'));

    await p.evaluate(() => App.openSettleModal()); await sleep(300);
    const titles = await p.$$eval('#settle-preview .sp-title', a => a.map(x => x.textContent));
    ok(titles.length === 2 && /9 月/.test(titles[0]) && /10 月.*本月/.test(titles[1]), '预览：9 月一块、10 月（本月）一块 ' + JSON.stringify(titles));
    const scores = await p.$$eval('#settle-preview .settle-month-block', b => [...b[0].querySelectorAll('.sc-score')].map(x => x.textContent.trim()));
    ok(scores[0] === '+15' && scores[1] === '+11', `9 月预览含补记：CS ${scores[0]}（10+5）YY ${scores[1]}（10+1）`);
    ok(await p.$eval('#settle-include-current', el => !el.checked), '有过去的月份时，「同时结算本月」默认不勾');
    await p.screenshot({ path: `${SHOTS}/settle_01_preview.png` });
    await p.evaluate(() => App.confirmSettle()); await sleep(500);
    d = await LSd(p);
    const row = d.history.find(h => h.month === '2026-09');
    ok(row && row.char1Pts === 15 && row.char2Pts === 11, `9 月历史：CS ${row && row.char1Pts} / YY ${row && row.char2Pts}`);
    ok(d.archive.length === 4 && d.archive.every(e => e.month === '2026-09'), `归档 4 条，全是 9 月（${d.archive.length}）`);
    ok(allLive(d).length === 1 && allLive(d)[0].id === 'o1', '剩下的只有 10 月的那条');

    console.log('\n2. 结算之后再补 9 月 → 明确告诉你是「补记」');
    const hint2 = await addEntry(p, '2026-09-30', -10, '1.00睡觉');
    ok(/9 月已经结算过了.*补记/.test(hint2), '提示「9 月已经结算过了…补记」: ' + hint2);
    await p.evaluate(() => App.openSettleModal()); await sleep(300);
    const t2 = await p.$$eval('#settle-preview .sp-title', a => a.map(x => x.textContent));
    ok(/9 月.*补记 1 条/.test(t2[0]), '结算预览把它标成「补记 1 条」: ' + t2[0]);
    await p.screenshot({ path: `${SHOTS}/settle_02_bujì.png` });
    await p.evaluate(() => App.closeModal('modal-settle'));

    console.log('\n3. 不能选未来的日期');
    ok(await p.$eval('#add-date', el => el.max) === '2026-10-01', '日期框 max = 今天');
    const before = allLive(await LSd(p)).length;
    await addEntry(p, '2026-10-05', 3, '未来');
    ok(allLive(await LSd(p)).length === before, '选了未来日期不会记进去');
    ok(/未来/.test(await p.textContent('.toast').catch(() => '')), '并且提示「日期不能选未来」');

    console.log('\n4. 改日期 = 换月份');
    await p.evaluate(() => App.openEditEntryModal('o1')); await sleep(150);
    await p.fill('#add-date', '2026-09-29'); await p.dispatchEvent('#add-date', 'input');
    await p.evaluate(() => App.submitEntry()); await sleep(300);
    d = await LSd(p);
    const moved = allLive(d).find(e => e.id === 'o1');
    ok(moved && moved.month === '2026-09' && (d.entries['2026-09'] || []).some(e => e.id === 'o1'), '10/1 改成 9/29 → 标签和分组都变成 9 月');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n5. 手机开着过了 9/30 午夜');
  {
    const { p, ctx, errs } = await page(browser, '2026-09-30T23:59:30+08:00', seed({ entries: [E('s1', 'char1', 10, '2026-09-30')] }));
    ok((await p.textContent('#month-label')).includes('9 月'), '23:59 页头是 9 月');
    await p.clock.setFixedTime(new Date('2026-10-01T00:00:40+08:00'));
    ok((await p.textContent('#month-label')).includes('9 月'), '00:00:40 时钟还没跳：页头仍是 9 月（S.month 也还是 9 月）');
    // tap a quick entry while S.month is still stale
    await p.evaluate(() => App.quickEntry('c1')); await sleep(300);
    const d = await LSd(p);
    const e = allLive(d).find(x => x.date === '2026-10-01');
    ok(e && e.month === '2026-10', `午夜后点的记在 10 月（${e && e.month}）——不再跟着没刷新的 S.month`);
    // and the minute tick alone (no refresh) moves the header on the next month change
    await p.clock.setFixedTime(new Date('2026-11-01T00:00:30+08:00'));
    await p.evaluate(() => App._tickTest());
    ok((await p.textContent('#month-label')).includes('11 月'), '只靠时钟跳一下，页头就换成 11 月');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n6. 对方刚记了一条，你这边结算 → 服务器拒绝（409），刷新后再确认');
  {
    const { p, ctx, errs } = await page(browser, '2026-10-01T23:00:00+08:00', seed());
    const server = {
      entries: [
        { id: 'A', charId: 'char1', pts: 10, catName: '陪伴时光', icon: '💑', desc: '', month: '2026-09', date: '2026-09-20', settled: false },
        { id: 'B', charId: 'char2', pts: 10, catName: '陪伴时光', icon: '💑', desc: '', month: '2026-09', date: '2026-09-21', settled: false },
      ],
      history: [], posts: [],
    };
    await p.route(/supabase\.co\/functions\/v1\//, async (route) => {
      const req = route.request(), url = new URL(req.url()), fn = url.pathname.split('/').pop();
      const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (fn === 'entries' && req.method() === 'GET') return reply(200, server.entries.filter(e => !e.settled));
      if (fn === 'history') return reply(200, server.history);
      if (fn === 'monthly-settle') {
        const b = JSON.parse(req.postData() || '{}');
        server.posts.push(b);
        await sleep(250);                                  // a real round trip takes time
        const pend = server.entries.filter(e => !e.settled && e.month === b.month);
        if (!pend.length) return reply(200, { success: true, alreadySettled: true });
        const seen = new Map((b.seen || []).map(s => [s[0], s]));
        const same = seen.size === pend.length && pend.every(e => seen.get(e.id) && seen.get(e.id)[1] === e.pts && seen.get(e.id)[2] === e.charId);
        if (!same) return reply(409, { error: 'stale' });
        pend.forEach(e => { e.settled = true; });
        server.history.unshift({ month: b.month, char1Pts: b.char1Pts, char2Pts: b.char2Pts, mode: b.mode, result1: b.result1, result2: b.result2, settledAt: new Date().toISOString() });
        return reply(200, { success: true, monthId: 'm1' });
      }
      if (/^(rewards|punishments|letters|photos|bag|categories|shop)$/.test(fn)) return reply(200, []);
      return reply(200, {});
    });
    await p.evaluate(() => App._fakeSessionTest());
    await p.evaluate(() => App.nav('home')); await sleep(500);
    await p.evaluate(() => App.openSettleModal()); await sleep(200);
    let sc = await p.$$eval('#settle-preview .sc-score', a => a.map(x => x.textContent.trim()));
    ok(sc[0] === '+10' && sc[1] === '+10', '预览 CS +10 / YY +10');
    // YY logs one more September entry on her phone while CS looks at the preview
    server.entries.push({ id: 'C', charId: 'char2', pts: 5, catName: '说晚安', icon: '🫶', desc: '', month: '2026-09', date: '2026-09-30', settled: false });
    await p.evaluate(() => App.confirmSettle()); await sleep(1200);
    ok(server.posts.length === 1 && server.posts[0].seen.length === 2, '第一次提交带着「我看到的 2 条」');
    ok(server.history.length === 0, '服务器没有写历史（409）');
    ok(await p.$eval('#modal-settle', el => el.classList.contains('open')), '结算框重新打开');
    sc = await p.$$eval('#settle-preview .sc-score', a => a.map(x => x.textContent.trim()));
    ok(sc[1] === '+15', `数字已更新：YY ${sc[1]}（10+5）`);
    ok(/刚刚有新的记录/.test(await p.textContent('.toast').catch(() => '')), '提示「刚刚有新的记录，请再确认一次」');
    await p.screenshot({ path: `${SHOTS}/settle_03_stale.png` });

    console.log('\n7. 连点两下「确认结算」只发一次');
    await Promise.all([p.evaluate(() => App.confirmSettle()), p.evaluate(() => App.confirmSettle())]);
    await sleep(800);
    ok(server.posts.length === 2, `总共只发了 2 次（第一次 409 + 这一次），实际 ${server.posts.length}`);
    ok(server.history.length === 1 && server.history[0].char2Pts === 15, `历史只有一行，YY 15 分（${JSON.stringify(server.history.map(h => h.char2Pts))}）`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n8. 同一个月结算过两轮：历史标轮次、年度回顾不漏、宠物经验只按月数');
  {
    const history = [
      { month: '2026-09', char1Pts: 6, char2Pts: 0, mode: 'reward', result1: '无结果', result2: '无结果', settledAt: '2026-10-01T15:00:00Z' },
      { month: '2026-09', char1Pts: 100, char2Pts: 50, mode: 'reward', result1: '盲盒', result2: '盲盒', settledAt: '2026-10-01T14:37:00Z' },
      { month: '2026-08', char1Pts: 80, char2Pts: 70, mode: 'reward', result1: '盲盒', result2: '盲盒', settledAt: '2026-09-01T15:00:00Z' },
    ];
    const archive = [E('a1', 'char1', 100, '2026-09-10'), E('a2', 'char2', 50, '2026-09-11'), E('a3', 'char1', 6, '2026-09-30'),
                     E('a4', 'char1', 80, '2026-08-10'), E('a5', 'char2', 70, '2026-08-11')];
    const { p, ctx, errs } = await page(browser, '2026-10-02T12:00:00+08:00', seed({ history, archive, entries: [
      E('l1', 'char1', 5, '2026-09-30'),            // a third, still-unsettled 补记 round
      E('l2', 'char2', 7, '2026-10-01'),
    ] }));
    await p.evaluate(() => App.showHistory()); await sleep(300);
    const rows = await p.$$eval('.history-month', a => a.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    ok(rows.filter(r => /2026-09 第 [12] 轮/.test(r)).length === 2 && rows.some(r => r === '2026-08'), '两行 9 月标「第 1 轮 / 第 2 轮」，8 月不标: ' + JSON.stringify(rows));
    await p.screenshot({ path: `${SHOTS}/settle_04_rounds.png` });
    await p.evaluate(() => App.closeModal('modal-history'));
    const yr = await p.evaluate(() => App._yearReviewFullTest(2026));
    ok(yr.settledPts === 306 && yr.livePts === 12 && yr.totalPts === 318, `年度回顾：已结算 306（两轮都算）+ 本轮 12（含 9 月补记）= ${yr.totalPts}（${yr.settledPts}+${yr.livePts}）`);
    ok(yr.settledMonths === 2, `「结算过的月份」是 2 个，不是 3 行（${yr.settledMonths}）`);
    const raw = await p.evaluate(() => App._petRawTest()), life = await p.evaluate(() => App._lifetimeTest());
    ok(raw - life === 200, `宠物经验：结算月数 2 × 100 = ${raw - life}（不是 3 行 × 100）`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n9. 深色模式下的提示和结算框');
  {
    const { p, ctx, errs } = await page(browser, '2026-10-01T22:40:00+08:00', seed({
      history: [{ month: '2026-09', char1Pts: 10, char2Pts: 0, mode: 'reward', result1: '无结果', result2: '无结果', settledAt: '2026-10-01T14:37:00Z' }],
      entries: [E('x1', 'char1', 2, '2026-10-01')] }), { theme: 'dark' });
    await p.evaluate(() => App.openAddModal()); await sleep(150);
    await p.fill('#add-date', '2026-09-30'); await p.dispatchEvent('#add-date', 'input'); await sleep(100);
    await p.screenshot({ path: `${SHOTS}/settle_05_hint_dark.png` });
    const box = await p.$eval('#add-date-hint', el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: r.width, h: r.height, color: cs.color }; });
    ok(box.h > 0 && box.w <= 390, `提示在 390 宽内正常显示（${Math.round(box.w)}×${Math.round(box.h)}）`);
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
