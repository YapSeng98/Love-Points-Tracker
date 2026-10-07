// 小窝: can every piece be picked up, and where do new ones land?
// Serve the repo first:  python3 -m http.server 8765      then:  node tools/room-test.js
// ROOM=path.json (a saved pet_equipped blob) replays a real room instead of the
// sample one — never commit a real layout.
//
// Reported 2026-10-07: a 毛线篮 bought from the shop landed at x=50 — straight
// behind 呆呆 — with only its needles showing over the pet's head, and could
// not be picked up. Two causes: the pet's whole BOX took taps (its empty
// corners included), and the placement grid sent every fifth floor piece to
// the pet's column. The bubble and the rug took taps meant for furniture too.

const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs');
const APP_URL = 'http://localhost:8765/index.html';
const SHOTS = process.env.SHOTS || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A crowded room like a real one: sofa, table and lamps along the back, a bed
// on the right, shelves on the wall — and the reported basket behind the pet.
const SAMPLE = ['ab,16.7,66.3,0.9', 'ah,31.8,36,0.9', 'ad,16.4,72.1,0.7', 'ac,86.5,63.6,0.7', 'aj,87.8,48,0.7',
  'ai,32.2,48,0.9', 'ap,49.7,23', 'aw,63.4,62,0.6', 'ar,57.8,62', 'ao,16.3,67.8,0.8', 'aq,29.6,67.3,0.8', 'bb,18.1,47', 'bc,50,70'];
const OWNED = ['sofa_blue', 'clock_wall', 'table_wood', 'bed_pink', 'neon_heart', 'shelf_books', 'moon_window', 'moon_rabbit_26',
  'osmanthus', 'mooncake_set', 'rabbit_lamp', 'maple_frame', 'knit_basket', 'lamp_floor', 'fishtank', 'persimmon_basket'];

function seed(items, outfit = 'scarf_red') {
  return {
    mode: 'reward', rewardTarget: 100, punishThreshold: -80, entries: {}, history: [], archive: [],
    letters: [], photos: [], goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '呆呆', petSpecies: 'dog', petExp: 2600, petBase: 0,
    petEquipped: JSON.stringify({ p: '', m: '', o: outfit, it: items }),
    wx1: '', wx2: '', charName1: 'CS', charName2: 'YY', charImg1: '', charImg2: '', startDate: '2024-12-24',
    categories: [], rewards: [], punishments: [],
    decorOwned: OWNED.map((id, n) => ({ id: 'd' + n, itemId: id, owner: 'char1', itemName: id, itemIcon: '', ptsSpent: 0 })),
  };
}

async function room(browser, items, w = 390) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, timezoneId: 'Asia/Singapore', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.clock.setFixedTime(new Date('2026-10-07T13:00:00+08:00'));
  await p.route(/open-meteo|supabase\.co/, r => r.abort());
  await p.addInitScript(d => { if (sessionStorage.getItem('s')) return; localStorage.clear();
    localStorage.setItem('love_score_data', JSON.stringify(d)); sessionStorage.setItem('s', '1'); }, seed(items));
  await p.goto(APP_URL);
  await p.waitForFunction(() => typeof App !== 'undefined' && App.demoMode);
  await p.evaluate(() => document.getElementById('start-page')?.remove());
  await p.evaluate(() => App.demoMode()); await sleep(400);
  await p.evaluate(() => App.showPetHome()); await sleep(700);
  return { p, ctx, errs };
}

// In the page: how much of a piece answers a tap at its own spot, and where it is.
const PROBE = `(id) => {
  const items = App._eqTest().items, i = items.findIndex(o => o.i === id);
  const el = document.querySelector('#pet-decor-layer .decor-piece[data-i="' + i + '"]');
  if (!el) return null;
  const r = el.getBoundingClientRect(), s = document.getElementById('pet-stage').getBoundingClientRect();
  let hits = 0, all = 0, at = null;
  for (let x = r.left + 2; x < r.right; x += 3) for (let y = r.top + 2; y < r.bottom; y += 3) {
    all++;
    if (document.elementFromPoint(x, y)?.closest('.decor-piece') === el) { hits++; at = at || [x, y]; }
  }
  const over = Math.max(0, Math.min(r.right, s.right) - Math.max(r.left, s.left)) * Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top));
  return { x: items[i].x, y: items[i].y, share: hits / all, at, behindPet: over / (r.width * r.height) };
}`;
const probe = (p, id) => p.evaluate(`(${PROBE})(${JSON.stringify(id)})`);

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const items = process.env.ROOM ? JSON.parse(JSON.parse(fs.readFileSync(process.env.ROOM, 'utf8'))).it : SAMPLE;

  console.log('\n1. 被呆呆挡住的毛线篮（2026-10-07 报的）');
  {
    const { p, ctx, errs } = await room(browser, items);
    await p.screenshot({ path: `${SHOTS}/room_01_basket_behind_pet.png` });
    const b = await probe(p, 'knit_basket');
    ok(b && b.share > 0, `露在外面的部分点得到（${b && Math.round(b.share * 100)}% 的范围能点到它，修之前是 0%）`);
    if (!b || !b.at) { ok(false, '没有一处点得到它——就是报的那个问题'); await ctx.close(); await browser.close(); process.exit(1); }
    await p.mouse.click(b.at[0], b.at[1]); await sleep(200);
    const sel = await p.evaluate(() => { const el = document.querySelector('.decor-piece.selected'); return el && App._eqTest().items[+el.dataset.i].i; });
    ok(sel === 'knit_basket', `点一下就选中了（${sel}）`);
    // drag it out from behind the pet
    const rr = await p.evaluate(() => { const r = document.getElementById('pet-room').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    await p.mouse.move(b.at[0], b.at[1]); await p.mouse.down();
    await p.mouse.move(rr.l + rr.w * 0.14, rr.t + rr.h * 0.88, { steps: 8 }); await p.mouse.up(); await sleep(700);
    await p.evaluate(() => App.finishDecorEdit()); await sleep(200);     // 完成: the edit bar covers the bottom while selected
    const moved = await probe(p, 'knit_basket');
    ok(moved.behindPet < 0.05 && moved.share > 0.9, `拖出来了（${moved.x}, ${moved.y}），整个都点得到`);

    const s = await p.evaluate(() => {
      const st = document.getElementById('pet-stage').getBoundingClientRect();
      const hitPet = (x, y) => !!document.elementFromPoint(x, y)?.closest('#pet-stage');
      const bub = document.getElementById('pet-speech').getBoundingClientRect();
      const rug = document.querySelector('.pet-rug').getBoundingClientRect();
      return { body: hitPet(st.left + st.width / 2, st.top + st.height * 0.7), corner: hitPet(st.left + 3, st.top + 3),
               bubble: !!document.elementFromPoint(bub.left + bub.width / 2, bub.top + bub.height / 2)?.closest('#pet-speech'),
               rug: !!document.elementFromPoint(rug.left + 8, rug.top + rug.height / 2)?.closest('.pet-rug') };
    });
    ok(s.body && !s.corner, '点呆呆的身体还是摸它；它方框的空角不再挡东西');
    ok(!s.bubble && !s.rug, '说话气泡和地毯不挡点击（只是装饰）');
    const st0 = await p.evaluate(() => document.getElementById('pet-stage').classList.contains('poke'));
    const c = await p.evaluate(() => { const r = document.getElementById('pet-stage').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.7]; });
    await p.mouse.click(c[0], c[1]); await sleep(100);
    ok(!st0 && await p.evaluate(() => document.getElementById('pet-stage').classList.contains('poke')), '点它的身体：呆呆照样会动');
    ok(!errs.length, '无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  console.log('\n2. 收起再摆：落在空的地方，不在呆呆身后');
  for (const w of [360, 390, 820]) {
    const { p, ctx } = await room(browser, items, w);
    await p.evaluate(() => App.unplaceDecor('knit_basket')); await sleep(300);
    await p.evaluate(() => App.placeDecor('knit_basket')); await sleep(600);
    const b = await probe(p, 'knit_basket');
    ok(b && b.behindPet === 0 && b.share > 0.85, `${w}px：毛线篮摆到（${b && b.x}, ${b && b.y}），不在呆呆身后，${b && Math.round(b.share * 100)}% 点得到`);
    if (w === 390) await p.screenshot({ path: `${SHOTS}/room_02_basket_replaced.png` });
    await ctx.close();
  }

  console.log('\n3. 一件一件买：没有一件被摆到呆呆身后或窗户上');
  for (const w of [360, 390]) {
    const { p, ctx } = await room(browser, ['ag,16,30', 'aa,16,87', 'ab,78,87'], w);
    const floor = ['table_wood', 'lamp_floor', 'fishtank', 'bed_pink', 'osmanthus', 'mooncake_set', 'rabbit_lamp', 'persimmon_basket', 'knit_basket'];
    const wall = ['clock_wall', 'shelf_books', 'neon_heart', 'maple_frame', 'moon_window'];
    // A bed is wider than the gap beside the pet, so in a full room some
    // overlap is unavoidable; what matters is that it stays mostly in view and
    // can be grabbed. Small pieces must never end up behind the pet at all.
    const bad = [];
    for (const id of floor) {
      await p.evaluate(i => App.placeDecor(i), id); await sleep(250);
      const b = await probe(p, id);
      const small = await p.evaluate(i => (App._decorTest()[i].ratio || 0.5) < 0.45, id);
      if (!b || b.share < (small ? 0.8 : 0.6)) bad.push(`${id}@${b && b.x},${b && b.y} ${b && Math.round(b.share * 100)}%`);
    }
    for (const id of wall) {
      await p.evaluate(i => App.placeDecor(i), id); await sleep(250);
      const r = await p.evaluate(i => {
        const items = App._eqTest().items, k = items.findIndex(o => o.i === i);
        const a = document.querySelector(`#pet-decor-layer .decor-piece[data-i="${k}"]`).getBoundingClientRect();
        const hit = (b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return { x: items[k].x, y: items[k].y, win: hit(document.querySelector('#pet-room .pet-window').getBoundingClientRect()),
                 bub: hit(document.getElementById('pet-speech').getBoundingClientRect()) };
      }, id);
      if (r.win || r.bub) bad.push(`${id}@${r.x},${r.y}${r.win ? ' 窗户' : ''}${r.bub ? ' 气泡' : ''}`);
    }
    ok(!bad.length, `${w}px：9 件地上的 + 5 件墙上的，都摆在看得见、点得到的地方${bad.length ? '：' + bad.join('，') : ''}`);
    if (w === 390) await p.screenshot({ path: `${SHOTS}/room_03_bought_one_by_one.png` });
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
