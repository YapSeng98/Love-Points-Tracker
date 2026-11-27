// 🏎️ 卡丁车 and 💣 烟花炸弹 (kartbomb.html, CLAUDE.md §7.37): the game page on its own, the full suite.
// The app around it (opening from 小游戏, the points, the records): tools/kartbomb-app-test.js.
//   node tools/kartbomb-test.js [section…]      KB_URL=… to test another copy (default: the file in this repo) (sections: geo kart mech cup e2ek e2et ux ctl fun devices newmaps maps stages bmech vs e2eb ui layout perf motion webkit)
const { chromium, webkit } = require('/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const URL = process.env.KB_URL || 'file://' + path.join(__dirname, '..', 'kartbomb.html');
const os = require('os'), SHOTS = path.join(os.tmpdir(), 'kartbomb-shots');
const ONLY = process.argv.slice(2);
const want = (s) => !ONLY.length || ONLY.includes(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) { pass++; console.log('  ✅ ' + msg); } else { fail++; fails.push(msg); console.log('  ❌ ' + msg); } };
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(SHOTS, { recursive: true });

async function page(browser, o = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, o));
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(URL); await p.waitForFunction(() => window.__kb && document.querySelector('#kart-places button'));
  await sleep(500);
  return p;
}
// drives the human kart the way a careful player would: analogue steering at a point ahead, drift through bends
const DRIVER = `(() => { const G = __kb.game, T = G.T; return (k) => { const IN = __kb.IN[k.k], s = T.S[(k.idx + 14) % T.N];
  const d = Math.atan2(Math.sin(Math.atan2(s.y - k.y, s.x - k.x) - k.h), Math.cos(Math.atan2(s.y - k.y, s.x - k.x) - k.h));
  IN.steerOn = true; IN.steer = Math.max(-1, Math.min(1, d * 3)); IN.drift = Math.abs(d) > 0.38 && !k.ice ? 1 : 0; if (k.item && k.roll <= 0) IN.itemHit = 1; }; })()`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });

  if (want('geo')) {
    console.log('\nK1. Track geometry');
    const p = await page(browser);
    const r = await p.evaluate(() => __kb.TRACKS.map((def) => {
      const T = __kb.buildTrack(def); let m = 1e9;
      for (let i = 0; i < T.N; i += 2) for (let j = i + 70; j < T.N && j < i + T.N - 70; j += 2) { const a = T.S[i], c = T.S[j]; m = Math.min(m, Math.hypot(a.x - c.x, a.y - c.y)); }
      const ramp = T.ramps[0], rampBend = Math.abs(T.bend(ramp.i)), rampOnPad = T.pad[ramp.i] || T.ice[ramp.i];
      const heartsOn = T.hearts.every((h) => T.near(h.x, h.y) < def.hw - 0.8), boxesOn = T.boxes.every((b) => T.near(b.x, b.y) < def.hw);
      const treesOff = T.trees.every((t) => T.near(t.x, t.y) > def.hw + 1.4 && !(def.water && def.water(t.x, t.y)));
      const signsOff = T.signs.every((sg) => T.near(sg.x, sg.y) > def.hw + 0.8);
      const badSigns = T.signs.filter((sg) => T.near(sg.x, sg.y) <= def.hw + 0.8).length, badTrees = T.trees.filter((tr) => !(T.near(tr.x, tr.y) > def.hw + 1.4 && !(def.water && def.water(tr.x, tr.y)))).length;
      return { badSigns, badTrees, id: def.id, gap: +m.toFixed(1), road: 2 * def.hw, rampBend: +rampBend.toFixed(2), rampOnPad: !!rampOnPad, heartsOn, boxesOn, treesOff, signs: T.signs.length, signsOff, trees: T.trees.length };
    }));
    for (const t of r) {
      ok(t.gap > t.road + 1, `${t.id}: no part of the road comes within ${t.gap} of another (road ${t.road} wide)`);
      ok(t.rampBend < 0.7 && !t.rampOnPad, `${t.id}: the ramp sits on the straightest open stretch (bend ${t.rampBend}), not on a boost arrow or ice`);
      ok(t.heartsOn && t.boxesOn, `${t.id}: every 💗 and gift box is on the road`);
      ok(t.treesOff && t.signsOff, `${t.id}: ${t.trees} trees and ${t.signs} arrow boards all stand off the road (and out of the sea)${t.badSigns || t.badTrees ? ` — on it: ${t.badSigns} boards, ${t.badTrees} trees` : ''}`);
      ok(t.signs >= 3, `${t.id}: sharp bends have arrow boards (${t.signs})`);
    }
    // a jump at full speed, hands off the wheel, comes down on the road
    const land = await p.evaluate(() => __kb.TRACKS.map((def) => {
      __kb.close(); __kb.open('kart', { mode: '1p', place: def.id, skipCard: true, assist: false }); const G = __kb.game; G.state = 'race'; const k = G.karts.find((x) => x.human), T = G.T, rp = T.ramps[0], i0 = (rp.i - 8 + T.N) % T.N, s0 = T.S[i0], s = { x: s0.x, y: s0.y, ang: T.S[rp.i].ang };
      for (const o of G.karts) if (o !== k) { o.x = 0; o.y = 0; }
      Object.assign(k, { x: s.x, y: s.y, h: s.ang, v: 24, vx: Math.cos(s.ang) * 24, vy: Math.sin(s.ang) * 24, idx: i0 }); let flew = false, landedOn = null;
      for (let n = 0; n < 240 && landedOn === null; n++) { __kb.IN[k.k].steerOn = true; __kb.IN[k.k].steer = 0; G.update(1 / 60); if (k.air) flew = true; else if (flew) landedOn = T.near(k.x, k.y); }
      __kb.close(); return { id: def.id, flew, land: landedOn === null ? null : +landedOn.toFixed(2), hw: def.hw };
    }));
    for (const l of land) ok(l.flew && l.land !== null && l.land < l.hw, `${l.id}: a jump at full speed with hands off lands on the road (${l.land} from the middle, road half-width ${l.hw})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('kart')) {
    console.log('\nK2. Every track can be driven to the end, on 轻松 and 挑战');
    const easyPlaces = [];
    const p = await page(browser);
    for (const id of ['sakura', 'beach', 'snow', 'candy', 'night']) for (const cls of ['easy', 'hard']) {
      const r = await p.evaluate(([id, cls, DRIVER]) => {
        __kb.open('kart', { mode: '1p', place: id, cls, skipCard: true }); const G = __kb.game; const drive = eval(DRIVER);
        G.state = 'count'; G.count = 0.01; const me = G.karts.find((k) => k.human); let t = 0, off = 0, air = 0, wet = 0, rescues = 0, maxCoins = 0;
        while (t < 170 && G.state !== 'end') { drive(me); G.update(1 / 60); t += 1 / 60; if (me.off && !me.air) off++; if (me.air) air++; if (me.rescue > 0) wet++; maxCoins = Math.max(maxCoins, me.coins); }
        const res = { t: +t.toFixed(1), state: G.state, done: me.done, place: me.place, time: +me.time.toFixed(1), offPct: +(off / (t * 60) * 100).toFixed(1), air, wet, maxCoins, others: G.karts.filter((k) => !k.human).map((k) => k.k + ':' + k.lap).join(' ') };
        __kb.close(); return res;
      }, [id, cls, DRIVER]);
      const L = { sakura: 245, beach: 238, snow: 326, candy: 286, night: 317 }[id];
      if (cls === 'easy') easyPlaces.push(r.place);
      ok(r.done && r.state === 'end' && r.time > L * 3 / 37, `${id} ${cls}: finished 3 laps (no faster than the road allows: ${(L * 3 / r.time).toFixed(1)} units/s) in ${r.time}s, place ${r.place}, off the road ${r.offPct}% of the time, ${r.air} frames in the air, 💗 up to ${r.maxCoins} (${r.others})`);
    }
    ok(easyPlaces.filter((x) => x === 1).length >= 3, `on 轻松 a careful driver wins most races (places ${easyPlaces.join(', ')})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('mech')) {
    console.log('\nK3. Kart mechanics, one at a time');
    const p = await page(browser);
    const r = await p.evaluate(() => {
      const out = {}, step = (G, n) => { for (let i = 0; i < n; i++) G.update(1 / 60); };
      const open = (id, o = {}) => { __kb.close(); __kb.open('kart', Object.assign({ mode: '1p', place: id, skipCard: true }, o)); const G = __kb.game; G.state = 'count'; return G; };
      // the start boost: held at 1, and not before
      let G = open('sakura'); let me = G.karts.find((k) => k.human); G.count = 1.1; __kb.IN[me.k].drift = 1; step(G, 75); __kb.IN[me.k].drift = 0; out.rocket = { boost: +me.boost.toFixed(2), msg: me.msg };
      G = open('sakura'); me = G.karts.find((k) => k.human); G.count = 2.5; __kb.IN[me.k].drift = 1; step(G, 160); __kb.IN[me.k].drift = 0; out.early = { boost: +me.boost.toFixed(2) };
      // a ramp: up into the air; a trick pressed in the air pays on landing
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); const T = G.T, rp = T.ramps[0], s0 = T.S[(rp.i - 25 + T.N) % T.N];
      Object.assign(me, { x: s0.x, y: s0.y, h: s0.ang, v: 22, vx: Math.cos(s0.ang) * 22, vy: Math.sin(s0.ang) * 22, idx: (rp.i - 25 + T.N) % T.N });
      let zmax = 0, airSeen = false, tricked = false, boostAfter = 0;
      for (let i = 0; i < 200; i++) { if (me.air && !tricked) { __kb.IN[me.k].drift = 1; step(G, 1); __kb.IN[me.k].drift = 0; tricked = true; } step(G, 1); if (me.air) airSeen = true; zmax = Math.max(zmax, me.z); if (airSeen && !me.air && !boostAfter) boostAfter = me.boost; }
      out.ramp = { airSeen, zmax: +zmax.toFixed(2), boostAfter: +boostAfter.toFixed(2) };
      // 💗 on the road: faster with ten
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); const straight = (coins) => { me.coins = coins; me.v = 0; const s = G.T.S[40]; let vmax = 0; for (let i = 0; i < 300; i++) { Object.assign(me, { x: s.x, y: s.y, idx: 40, h: s.ang, boost: 0, padAt: -1 }); me.vx = Math.cos(me.h) * me.v; me.vy = Math.sin(me.h) * me.v; __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; step(G, 1); vmax = Math.max(vmax, me.v); } return vmax; };
      out.coins = { v0: +straight(0).toFixed(2), v10: +straight(10).toFixed(2) };
      // a pudding spins you and costs two 💗; a bubble stops it
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); me.coins = 5; G.puddles.push({ x: me.x, y: me.y, t: 10, own: G.karts[0], safe: 0 }); step(G, 2); out.pudding = { spin: me.spin > 0, coins: me.coins };
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); me.shield = 5; G.puddles.push({ x: me.x, y: me.y, t: 10, own: G.karts[0], safe: 0 }); step(G, 2); out.shield = { spin: me.spin > 0, shield: me.shield > 0 };
      // 辅助转向 keeps a wobbling driver on the road far more than without it
      const wobble = (assist) => { const G2 = open('snow', { assist }); G2.state = 'race'; const k = G2.karts.find((x) => x.human); let off = 0, n = 0; const drv = (() => { const T2 = G2.T; return () => { const s = T2.S[(k.idx + 14) % T2.N], d = Math.atan2(Math.sin(Math.atan2(s.y - k.y, s.x - k.x) - k.h), Math.cos(Math.atan2(s.y - k.y, s.x - k.x) - k.h)); __kb.IN[k.k].steerOn = true; __kb.IN[k.k].steer = Math.max(-1, Math.min(1, d * 1.2 + Math.sin(n / 25) * 0.9)); }; })(); for (; n < 60 * 40; n++) { drv(); G2.update(1 / 60); if (k.off) off++; } return +(off / n * 100).toFixed(1); };
      out.assist = { on: wobble(true), off: wobble(false) };
      // facing back along the road says so
      G = open('sakura', { assist: false }); G.state = 'race'; me = G.karts.find((k) => k.human); me.h += Math.PI; me.v = 8; let saw = false; for (let i = 0; i < 150; i++) { __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; step(G, 1); if (me.wrongT > 1.2) saw = true; } out.wrong = saw;
      // the sea: in, fished out, back on the road
      G = open('beach'); G.state = 'race'; me = G.karts.find((k) => k.human); me.x = 40; me.y = 70; me.v = 5; step(G, 2); const wet = me.rescue > 0; step(G, 100); out.sea = { wet, back: G.T.near(me.x, me.y) < 1 };
      // ice under the wheels; a jelly bumper throws you back
      G = open('snow'); G.state = 'race'; me = G.karts.find((k) => k.human); { const i = G.T.fr(0.25), s = G.T.S[i]; Object.assign(me, { x: s.x, y: s.y, idx: i, h: s.ang }); } step(G, 2); out.ice = me.ice;
      G = open('candy'); G.state = 'race'; me = G.karts.find((k) => k.human); { const b = G.T.bumpers[0]; me.x = b.x - 3; me.y = b.y; me.h = 0; me.v = 20; me.vx = 20; me.vy = 0; me.idx = __kb.nearIdx ? me.idx : me.idx; step(G, 20); out.bumper = { vx: +me.vx.toFixed(1), bounced: G.T.bumpers[0].t > 0 || me.vx < 0 }; }
      // items: a rain cloud flies to the one ahead and slows it; the rainbow drives you and nothing hurts you
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); const ahead = G.karts[0]; me.place = 2; ahead.place = 1; me.item = 'rain'; me.roll = 0; __kb.IN[me.k].itemHit = 1; step(G, 90); out.rain = ahead.slow > 0;
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); me.item = 'rainbow'; me.roll = 0; __kb.IN[me.k].itemHit = 1; step(G, 2); G.puddles.push({ x: me.x + Math.cos(me.h) * 3, y: me.y + Math.sin(me.h) * 3, t: 10, own: G.karts[0], safe: 0 }); step(G, 40); out.rainbow = { on: me.rainbow > 0 || me.v > 25, spin: me.spin > 0 };
      // laps: reversing over the line takes a lap away, so it cannot be farmed
      G = open('sakura'); G.state = 'race'; me = G.karts.find((k) => k.human); const lap0 = me.lap; const s1 = G.T.S[3], s2 = G.T.S[G.T.N - 3];
      const eff = () => me.lap - (me.owe ? 1 : 0); Object.assign(me, { x: s1.x, y: s1.y }); step(G, 1); const lapA = eff(); Object.assign(me, { x: s2.x, y: s2.y, v: 0, vx: 0, vy: 0 }); step(G, 1); const lapB = eff(); Object.assign(me, { x: s1.x, y: s1.y }); step(G, 1); const lapC = eff(); Object.assign(me, { x: s2.x, y: s2.y }); step(G, 1); Object.assign(me, { x: s1.x, y: s1.y }); step(G, 1); out.laps = [lap0, lapA, lapB, lapC, eff(), me.lap];
      // a shortcut across the grass gains nothing
      G = open('snow'); G.state = 'race'; me = G.karts.find((k) => k.human); step(G, 2); const p0 = me.prog, far = G.T.S[Math.floor(G.T.N * 0.4)]; me.x = far.x + 0.5; me.y = far.y; step(G, 3); out.shortcut = { before: Math.round(p0), after: Math.round(me.prog) };
      __kb.close(); return out;
    });
    ok(r.shortcut.after <= r.shortcut.before + 30, `jumping across the field to a later part of the road gains no progress (${r.shortcut.before} → ${r.shortcut.after})`);
    ok(r.rocket.boost > 0.5 && /起步/.test(r.rocket.msg), `start boost when 漂移 is held at 1 (boost ${r.rocket.boost}, 「${r.rocket.msg}」)`);
    ok(r.early.boost === 0, `held from 3 it does nothing (boost ${r.early.boost})`);
    ok(r.ramp.airSeen && r.ramp.zmax > 0.6, `a ramp throws you up (highest ${r.ramp.zmax})`);
    ok(r.ramp.boostAfter > 0.4, `a trick in the air pays on landing (boost ${r.ramp.boostAfter})`);
    ok(r.coins.v10 > r.coins.v0 * 1.08, `ten 💗 make you faster on a straight (${r.coins.v0} → ${r.coins.v10})`);
    ok(r.pudding.spin && r.pudding.coins === 3, `a pudding spins you and costs two 💗 (left ${r.pudding.coins})`);
    ok(!r.shield.spin && !r.shield.shield, 'a bubble takes the pudding instead, and is used up');
    ok(r.assist.on < r.assist.off * 0.6, `辅助转向 keeps a wobbling driver on the road: off the road ${r.assist.on}% with it, ${r.assist.off}% without`);
    ok(r.wrong, 'driving back along the road shows 「方向反了」 (辅助转向 off: with it on, it does not turn you round for you)');
    ok(r.sea.wet && r.sea.back, 'driving into the sea: fished out and put back on the road');
    ok(r.ice, 'ice under the wheels on 雪山');
    ok(r.bumper.bounced, `a jelly bumper throws you back (vx ${r.bumper.vx})`);
    ok(r.rain, 'a rain cloud flies to the kart ahead and slows it');
    ok(r.rainbow.on && !r.rainbow.spin, '🌈 drives you fast and a pudding cannot spin you');
    ok(r.laps[1] === 1 && r.laps[2] === 0 && r.laps[3] === 1 && r.laps[4] === 1 && r.laps[5] === 1, `laps: over the line +1, back over it −1, forward again +1, and rocking back and forth never adds a lap (${r.laps.join(' → ')})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('cup')) {
    console.log('\nK4. 樱花杯: five races, points, the cup');
    const p = await page(browser);
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="cup"]');
    await p.click('#msg [data-m="cup"]'); await sleep(200);
    ok(await p.evaluate(() => /樱花杯/.test(document.querySelector('#msg .panel').textContent) && __kb.game.def.id === 'sakura'), 'the cup starts at 樱花小镇 with its own card');
    await p.click('#msg [data-m="go"]'); await sleep(100);
    const totals = [];
    for (let i = 0; i < 5; i++) {
      await p.evaluate(() => { const G = __kb.game; G.state = 'race'; G.paused = false; const order = [...G.karts].sort(() => Math.random() - 0.5); order.forEach((k, j) => { k.lap = 3; k.idx = G.T.N - 2; k.prog = 3 * G.T.L; k.mid = true; k.owe = false; }); for (const k of order) { const s = G.T.S[3]; k.x = s.x; k.y = s.y; } for (let n = 0; n < 200; n++) G.update(1 / 60); });
      await p.waitForSelector('#msg:not([hidden]) .panel', { timeout: 5000 });
      const txt = await p.evaluate(() => document.querySelector('#msg .panel').textContent);
      totals.push(txt.match(/(\d+) 分/g) || []);
      if (i < 4) { ok(/下一站/.test(txt), `after race ${i + 1}: points so far, and 下一站`); await p.click('#msg [data-m="next"]'); await sleep(250); const id = await p.evaluate(() => __kb.game.def.id + ':' + __kb.game.state); ok(id.endsWith(':count'), `race ${i + 2} starts straight away (${id})`); }
      else ok(/樱花杯/.test(txt) && /再跑一次樱花杯/.test(txt), 'after the fifth: who took the cup');
    }
    const sum = (arr) => arr.map((x) => parseInt(x)).reduce((a, b) => a + b, 0);
    ok(sum(totals[4]) === 5 * 22, `the points add up: ${sum(totals[4])} = 5 races × (10 + 7 + 5)`);
    await p.click('#msg [data-m="back"]'); await sleep(200);
    ok(await p.evaluate(() => document.getElementById('play').hidden), '换个玩法 goes back to the page');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('e2ek')) {
    console.log('\nK5. End to end on a laptop: the keyboard, a whole race in real time');
    const p = await page(browser, { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1 });
    await p.click('#kart-places [data-kp="sakura"]');
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-o="cls:normal"]');
    await p.click('#msg [data-o="cls:normal"]'); await sleep(150);
    ok(await p.evaluate(() => document.querySelector('#msg [data-o="cls:normal"]').getAttribute('aria-pressed') === 'true'), 'the card remembers 普通');
    await p.click('#msg [data-m="go"]');
    // hold ↓ (漂移) as the 1 shows
    await p.waitForFunction(() => __kb.game.state === 'count' && __kb.game.count < 1.15, null, { timeout: 8000 });
    await p.keyboard.down('ArrowDown'); await p.waitForFunction(() => __kb.game.state === 'race', null, { timeout: 4000 }); await p.keyboard.up('ArrowDown');
    ok(await p.evaluate(() => __kb.game.karts.find((k) => k.human).boost > 0.3), 'holding ↓ at 1 gives the start boost from the keyboard');
    // a driver that only presses keys, reading the screen state to decide
    const t0 = Date.now(); let held = new Set();
    const set = async (keys) => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
    let paused = false;
    while (Date.now() - t0 < 120000) {
      const st = await p.evaluate(() => { const G = __kb.game; if (!G) return null; const k = G.karts.find((x) => x.human), T = G.T, s = T.S[(k.idx + 14) % T.N]; const d = Math.atan2(Math.sin(Math.atan2(s.y - k.y, s.x - k.x) - k.h), Math.cos(Math.atan2(s.y - k.y, s.x - k.x) - k.h)); return { d, state: G.state, item: !!k.item && k.roll <= 0, lap: k.lap }; });
      if (!st || st.state === 'end') break;
      const keys = new Set(); if (st.d > 0.07) keys.add('ArrowRight'); else if (st.d < -0.07) keys.add('ArrowLeft'); if (Math.abs(st.d) > 0.4) keys.add('ArrowDown');
      await set(keys); if (st.item) await p.keyboard.press('ArrowUp');
      if (!paused && st.lap === 2) { paused = true; await set(new Set()); await p.keyboard.press('KeyP'); await sleep(200); ok(await p.evaluate(() => __kb.game.paused && /暂停/.test(document.querySelector('#msg .panel').textContent)), 'P pauses the race, with 继续 / 重来 / 退出'); await p.click('#msg [data-m="go"]'); await sleep(100); ok(await p.evaluate(() => !__kb.game.paused), '继续 carries on'); }
      await sleep(40);
    }
    await set(new Set());
    await p.waitForSelector('#msg:not([hidden]) .panel', { timeout: 10000 }).catch(() => {});
    const res = await p.evaluate(() => ({ txt: (document.querySelector('#msg .panel') || {}).textContent || '', place: __kb.game && __kb.game.karts.find((k) => k.human).place, time: __kb.game && __kb.game.karts.find((k) => k.human).time }));
    ok(/再来一次/.test(res.txt), `a whole race driven with the keys alone, in real time: place ${res.place}, ${res.time && res.time.toFixed(1)}s`);
    await p.screenshot({ path: SHOTS + '/t_e2ek_result.png' });
    await p.click('#msg [data-m="next"]'); await sleep(400);
    ok(await p.evaluate(() => __kb.game.def.id === 'beach' && __kb.game.state === 'count'), '下一条 goes straight to 海边 and counts down');
    await p.keyboard.press('Escape'); await sleep(200);
    ok(await p.evaluate(() => document.getElementById('play').hidden), 'Esc leaves the game');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('e2et')) {
    console.log('\nK6. End to end on a phone: the slider (picked on the card), 漂移, the item');
    const p = await page(browser);
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-o="ctl:bar"]'); await p.click('#msg [data-o="ctl:bar"]');
    await p.waitForSelector('#msg:not([hidden]) [data-o="ctl:bar"][aria-pressed="true"]'); await p.click('#msg [data-m="go"]');
    await p.evaluate(() => { __kb.game.count = 0.01; }); await sleep(300);
    const sz = await p.evaluate(() => { const r = document.querySelector('.sz').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const h0 = await p.evaluate(() => __kb.game.karts.find((k) => k.human).h);
    await p.evaluate(([x, y]) => { const z = document.querySelector('.sz'); const ev = (t, X) => z.dispatchEvent(new PointerEvent(t, { pointerId: 3, clientX: X, clientY: y, bubbles: true })); ev('pointerdown', x); ev('pointermove', x - 60); }, sz);
    let hmin = h0; for (let i = 0; i < 12; i++) { await sleep(50); hmin = Math.min(hmin, await p.evaluate(() => __kb.game.karts.find((k) => k.human).h)); }
    const after = await p.evaluate(() => { const k = __kb.game.karts.find((x) => x.human); return { st: k.st, h: k.h, IN: __kb.IN[k.k].steer }; });
    ok(after.IN < -0.8 && after.st < -0.8, `dragging left on the slider steers left, towards the open middle of the road (steer ${after.st.toFixed(2)})`);
    ok(h0 - hmin > 0.3, `…and the kart turns (${(h0 - hmin).toFixed(2)} rad)`);
    await p.evaluate(([x, y]) => { const z = document.querySelector('.sz'); z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: x, clientY: y, bubbles: true })); }, sz);
    await sleep(100);
    ok(await p.evaluate(() => !__kb.IN[__kb.game.karts.find((x) => x.human).k].steerOn), 'letting go of the slider centres it');
    const drift = await p.evaluate(() => { const b = document.querySelector('[data-k="drift"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, bubbles: true })); return __kb.IN[__kb.game.karts.find((x) => x.human).k].drift; });
    await p.evaluate(() => document.querySelector('[data-k="drift"]').dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, bubbles: true })));
    ok(drift === 1, 'the 漂移 button holds 漂移');
    await p.evaluate(() => { const k = __kb.game.karts.find((x) => x.human); k.item = 'boost'; k.roll = 0; }); await sleep(100);
    ok(await p.evaluate(() => document.querySelector('[data-k="item"]').textContent === '💗'), 'the item button shows the item you are holding');
    await p.evaluate(() => { const b = document.querySelector('[data-k="item"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, bubbles: true })); }); await sleep(100);
    ok(await p.evaluate(() => { const k = __kb.game.karts.find((x) => x.human); return !k.item && k.boost > 0; }), 'tapping it uses it');
    await p.screenshot({ path: SHOTS + '/t_e2et_kart.png' });
    // two people, phone on its side: two sliders, both at once
    await p.evaluate(() => __kb.close()); await p.setViewportSize({ width: 844, height: 390 }); await sleep(200);
    await p.evaluate(() => { __kb.open('kart', { mode: '2p', place: 'candy', skipCard: true }); }); await sleep(200);
    await p.evaluate(() => { __kb.game.state = 'race'; });
    const zones = await p.evaluate(() => [...document.querySelectorAll('.sz')].map((z) => { const r = z.getBoundingClientRect(); return { p: z.dataset.p, x: r.x + r.width / 2, y: r.y + r.height / 2, in: r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
    ok(zones.length === 2 && zones.every((z) => z.in), 'two sliders, both on the screen');
    await p.evaluate((zs) => { for (const [i, z] of zs.entries()) { const el = document.querySelector(`.sz[data-p="${z.p}"]`); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10 + i, clientX: z.x, clientY: z.y, bubbles: true })); el.dispatchEvent(new PointerEvent('pointermove', { pointerId: 10 + i, clientX: z.x + (z.p === 'cs' ? -60 : 60), clientY: z.y, bubbles: true })); } }, zones);
    await sleep(300);
    const two = await p.evaluate(() => ({ cs: __kb.IN.cs.steer, yy: __kb.IN.yy.steer, views: __kb.game.views.length }));
    ok(two.cs < -0.8 && two.yy > 0.8 && two.views === 2, `CS steers left and YY right at the same moment, each on a half of the screen (${two.cs.toFixed(2)}, ${two.yy.toFixed(2)})`);
    await p.screenshot({ path: SHOTS + '/t_e2et_2p.png' });
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('ux')) {
    console.log('\nU1. 卡丁车 on a phone: hold to steer, 自动漂移, first-race tips, one message at a time, the hit flash, 新纪录, 怎么玩');
    const p = await page(browser);
    await p.evaluate(() => { localStorage.removeItem('kb_coach_kart'); localStorage.removeItem('kb_coach_bomb'); localStorage.removeItem('kb_kset'); });
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-o="auto"]');
    ok(await p.evaluate(() => document.querySelector('#msg [data-o="auto"]').getAttribute('aria-pressed') === 'true'), 'the start card has 自动漂移, on unless you turn it off');
    await p.click('#msg [data-m="go"]'); await sleep(250);
    const tips = await p.evaluate(() => {
      const cs = [...document.querySelectorAll('.coach')].map((c) => c.getBoundingClientRect());
      const over = cs.some((a, i) => cs.some((b, j) => j > i && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
      const inside = cs.every((r) => r.left >= 0 && r.right <= innerWidth && r.top >= 0);
      const arrows = [...document.querySelectorAll('.coach')].map((c) => { const r = c.getBoundingClientRect(); return r.left + parseFloat(c.style.getPropertyValue('--ax')); });
      const targets = ['.bz', '[data-k="drift"]', '[data-k="item"]'].map((s) => document.querySelector(s).getBoundingClientRect());
      const aimed = targets.every((t) => arrows.some((x) => x >= t.left && x <= t.right));
      return { n: cs.length, over, inside, aimed, text: [...document.querySelectorAll('.coach')].map((c) => c.textContent) };
    });
    ok(tips.n === 3 && !tips.over && tips.inside && tips.aimed, `the first race shows three tips, none on top of another, each pointing at its control (${tips.text.join(' / ')})`);
    ok(tips.text.some((t) => /自动漂移/.test(t)), '…the 漂移 tip says it drifts by itself while 自动漂移 is on');
    await p.evaluate(() => { const G = __kb.game; G.count = 0; G.state = 'race'; });   // ◀ ▶ is the default; the slider is a tap away in the pause menu
    await p.click('#pause'); await p.waitForSelector('#msg:not([hidden]) [data-c="bar"]'); await p.click('#msg [data-c="bar"]'); await sleep(80);
    ok(await p.evaluate(() => !!document.querySelector('.sz') && !document.querySelector('.bz') && __kb.KSET.ctl === 'bar' && document.querySelector('#msg [data-c="bar"]').getAttribute('aria-pressed') === 'true'), 'the pause menu switches ◀ ▶ to the slider, and remembers it');
    await p.click('#msg [data-m="go"]'); await sleep(60);
    const bar = await p.evaluate(() => { const r = document.querySelector('.sz .szb').getBoundingClientRect(); return { l: r.left, w: r.width, y: r.top + r.height / 2 }; });
    await p.evaluate(() => { const G = __kb.game; G.count = 0; G.state = 'race'; });
    const hold = async (fx) => p.evaluate(([x, y]) => { const z = document.querySelector('.sz'); z.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true })); const k = __kb.game.karts.find((q) => q.human); return { st: __kb.IN[k.k].steer, dir: z.dataset.dir, tips: document.querySelectorAll('.coach').length }; }, [bar.l + bar.w * fx, bar.y]);
    const lift = async () => p.evaluate(() => { const z = document.querySelector('.sz'); z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })); });
    const L = await hold(0.06); await lift(); const R = await hold(0.94); await lift(); const M = await hold(0.5); await lift(); const half = await hold(0.3); await lift();
    ok(L.st <= -0.99 && L.dir === 'l' && R.st >= 0.99 && R.dir === 'r', `holding the left end steers fully left, the right end fully right, and that side lights up (${L.st.toFixed(2)}, ${R.st.toFixed(2)})`);
    ok(M.st === 0 && half.st < -0.3 && half.st > -0.8, `the middle goes straight; part-way out turns part-way (${half.st.toFixed(2)})`);
    ok(L.tips === 0, 'the first touch puts the tips away');
    const knob = await p.evaluate(([x, y]) => { const z = document.querySelector('.sz'); z.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, clientX: x, clientY: y, bubbles: true })); const k = z.querySelector('.szk').getBoundingClientRect(), b = z.querySelector('.szb').getBoundingClientRect(); z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, bubbles: true })); return k.left >= b.left - 1 && k.right <= b.right + 1; }, [bar.l - 30, bar.y]);
    ok(knob, 'the knob never leaves the bar, however far the finger goes');
    // 自动漂移: a hard turn at speed drifts and lets the spark go on its own; off, the same turn does not
    const auto = await p.evaluate(() => {
      const run = (on) => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true, autoDrift: on, assist: false }); const G = __kb.game; G.state = 'race'; G.paused = false; const k = G.karts.find((q) => q.human), IN = __kb.IN[k.k];
        k.v = 22; let drifted = false, boosted = false; IN.steerOn = true; IN.steer = 1; IN.drift = 0;
        for (let i = 0; i < 130; i++) { k.v = Math.max(k.v, 20); G.update(1 / 60); if (k.drift) drifted = true; }
        const charge = k.charge; IN.steer = 0; for (let i = 0; i < 20; i++) { G.update(1 / 60); if (k.boost > 0) boosted = true; }
        IN.steerOn = false; return { drifted, charge, boosted, after: !!k.drift }; };
      return { on: run(true), off: run(false) };
    });
    ok(auto.on.drifted && auto.on.boosted && !auto.on.after, `自动漂移: holding a hard turn at speed drifts (charge ${auto.on.charge.toFixed(2)}), straightening out lets the boost go`);
    ok(!auto.off.drifted, '…and with it off, the same turn does not drift');
    // one message at a time
    const msgs = await p.evaluate(() => { const G = __kb.game; G.state = 'race'; G.t = 30; const k = G.karts.find((q) => q.human); const out = [];
      Object.assign(k, { wrongT: 2, finalT: 1, lapT: 1, msgT: 1, msg: '拿到 💗' }); out.push(G.centerMsg(k));
      k.wrongT = 0; out.push(G.centerMsg(k)); k.finalT = 0; out.push(G.centerMsg(k)); k.lapT = 0; out.push(G.centerMsg(k)); k.msgT = 0; out.push(G.centerMsg(k)); return out; });
    ok(msgs[0][0] === '方向反了！' && msgs[1][0] === '最后一圈！' && msgs[1][1] === '拿到 💗' && msgs[3][0] === null && msgs[3][1] === '拿到 💗' && msgs[4][0] === null && msgs[4][1] === null,
      `the middle of the screen says one thing at a time, the most important first (${msgs.map((m) => m.filter(Boolean).join('+') || '—').join(' → ')})`);
    const hit = await p.evaluate(() => { const G = __kb.game, k = G.karts.find((q) => q.human), ai = G.karts.find((q) => !q.human); for (const q of [k, ai]) { q.shield = 0; q.rainbow = 0; q.hurtT = 0; } G.hurt(k, 'spin'); G.hurt(ai, 'spin'); return [k.hurtT, ai.hurtT || 0]; });
    ok(hit[0] > 0 && hit[1] === 0, 'being hit flashes your screen red (and only yours)');
    // 新纪录: a faster time than the one saved says so, with the old one beside it
    const fin = async () => { await p.evaluate(() => { const G = __kb.game; G.state = 'race'; G.paused = false; for (const k of G.karts) { k.lap = 3; k.idx = G.T.N - 2; k.prog = 3 * G.T.L; k.mid = true; k.owe = false; const s = G.T.S[3]; k.x = s.x; k.y = s.y; } G.t = 50; for (let n = 0; n < 200; n++) G.update(1 / 60); }); await p.waitForSelector('#msg:not([hidden]) .panel', { timeout: 5000 }); return p.evaluate(() => document.querySelector('#msg .panel').textContent); };
    await p.evaluate(() => { localStorage.setItem('kb_prog2', JSON.stringify({ kart: { sakura: { place: 2, time: 999 } }, bomb: {} })); }); await p.reload(); await p.waitForFunction(() => window.__kb); await sleep(300);
    await p.evaluate(() => __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }));
    const t1 = await fin();
    ok(/新纪录/.test(t1) && /16:39/.test(t1), '新纪录！ when you beat your best time, with the old one beside it');
    await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); });
    const t2 = await fin();
    ok(!/新纪录/.test(t2) && /最快纪录/.test(t2), 'a slower race shows your best time instead');
    // 怎么玩 from the pause menu, and back
    await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); __kb.game.state = 'race'; }); await sleep(100);
    await p.click('#pause'); await p.waitForSelector('#msg:not([hidden]) [data-m="help"]'); await p.click('#msg [data-m="help"]'); await sleep(100);
    const help = await p.evaluate(() => { const pn = document.querySelector('#msg .panel'), r = pn.getBoundingClientRect(); return { t: pn.textContent, fits: r.top >= 0 && r.bottom <= innerHeight }; });
    ok(/漂移/.test(help.t) && /道具/.test(help.t) && help.fits, '怎么玩 opens from the pause menu, explains steering, 漂移 and items, and fits on the phone');
    await p.click('#msg [data-m="back"]'); await sleep(100);
    ok(await p.evaluate(() => /暂停一下/.test(document.querySelector('#msg .panel').textContent) && __kb.game.paused), '回去 goes back to the pause menu, still paused');
    // tips come twice, then not again
    const third = await p.evaluate(async () => { localStorage.setItem('kb_coach_kart', '1'); __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura' }); await new Promise((r) => setTimeout(r, 80)); document.querySelector('#msg [data-m="go"]').click(); const a = document.querySelectorAll('.coach').length;
      __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura' }); await new Promise((r) => setTimeout(r, 80)); document.querySelector('#msg [data-m="go"]').click(); return [a, document.querySelectorAll('.coach').length]; });
    ok(third[0] === 3 && third[1] === 0, `the tips show on the first two races only (${third.join(', ')})`);
    // two on a phone on its side: one tip each, by their own bar
    await p.evaluate(() => __kb.close()); await p.setViewportSize({ width: 844, height: 390 }); await sleep(150);
    const two = await p.evaluate(async () => { localStorage.removeItem('kb_coach_kart'); __kb.open('kart', { mode: '2p', place: 'candy' }); await new Promise((r) => setTimeout(r, 80)); document.querySelector('#msg [data-m="go"]').click();
      const c = [...document.querySelectorAll('.coach')].map((e) => ({ t: e.textContent, x: e.getBoundingClientRect().left + parseFloat(e.style.getPropertyValue('--ax')) })), bars = ['cs', 'yy'].map((k) => document.querySelector(`.sz.${k} .szb`).getBoundingClientRect());
      return c.length === 2 && /CS/.test(c.find((q) => q.x >= bars[0].left && q.x <= bars[0].right)?.t || '') && /YY/.test(c.find((q) => q.x >= bars[1].left && q.x <= bars[1].right)?.t || ''); });
    ok(two, 'two on one phone: a tip by each person\'s own bar');
    await p.screenshot({ path: SHOTS + '/t_ux_kart2p.png' });
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
    // a laptop: one line of keys instead of bubbles
    const d = await page(browser, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
    await d.evaluate(() => localStorage.removeItem('kb_coach_kart'));
    await d.click('[data-play="kart:1p"]'); await d.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await d.click('#msg [data-m="go"]'); await sleep(150);
    ok(await d.evaluate(() => { const c = [...document.querySelectorAll('.coach')]; return c.length === 1 && /←/.test(c[0].textContent) && /漂移/.test(c[0].textContent); }), 'on a laptop the tip is one line of keys');
    await d.context().close();

    console.log('\nU2. 烟花炸弹 on a phone: your hearts by your own controls, tips, the hit flash, 怎么玩');
    for (const two of [false, true]) {
      const q = await page(browser);
      await q.evaluate(() => localStorage.removeItem('kb_coach_bomb'));
      await q.evaluate((two) => __kb.open('bomb', { mode: 'coop', place: 'garden', two }), two); await q.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await q.click('#msg [data-m="go"]'); await sleep(250);
      const r = await q.evaluate((two) => {
        const box = (e) => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const mine = [...document.querySelectorAll('.hc.pc')].map(box), ctl = [...document.querySelectorAll('#pad .pb, #pad .jz, #pad .dzb, .tb')].map(box), top = [...document.querySelectorAll('#hud .hc:not(.pc)')].map(box);
        const cv = document.getElementById('cv').getBoundingClientRect();
        return { n: mine.length, clear: mine.every((m) => !ctl.some((c) => hit(m, c)) && !mine.some((o) => o !== m && hit(m, o))), on: mine.every((m) => m.left >= 0 && m.right <= innerWidth && m.bottom <= innerHeight),
          topClear: top.every((t) => !ctl.some((c) => hit(t, c))), tips: document.querySelectorAll('.coach').length };
      }, two);
      ok(r.n === (two ? 2 : 1) && r.clear && r.on, `${two ? 'two on a phone' : 'one on a phone'}: ${two ? 'each person\'s' : 'your'} hearts and powers sit by ${two ? 'their' : 'your'} own controls, clear of every button`);
      ok(r.topClear, '…and the goal line at the top stays clear of ✕ ⏸ 🔊');
      ok(r.tips === 3, `the first game shows three tips (${r.tips})`);
      await q.screenshot({ path: `${SHOTS}/t_ux_bomb_${two ? 2 : 1}.png` });
      if (!two) {
        const f = await q.evaluate(() => { const G = __kb.game, me = G.players.find((x) => x.human), ai = G.players.find((x) => x.ai); G.flash = 0; G.test.hurtP(ai); const a = G.flash; me.inv = 0; me.shield = 0; G.test.hurtP(me); return [a, G.flash]; });
        ok(f[0] === 0 && f[1] > 0, 'a hit on you flashes the screen; a hit on the computer partner does not');
        await q.click('#pause'); await q.waitForSelector('#msg:not([hidden]) [data-m="help"]'); await q.click('#msg [data-m="help"]'); await sleep(100);
        ok(await q.evaluate(() => /宠物/.test(document.querySelector('#msg .panel').textContent) && /小屋/.test(document.querySelector('#msg .panel').textContent)), '怎么玩 explains the pets, the goal and the house');
      }
      ok(!q.errs.length, 'no page errors ' + q.errs.join(' | '));
      await q.context().close();
    }
  }

  if (want('ctl')) {
    console.log('\nU3. Ways to play: ◀ ▶, the slider, tilting the phone; 方向键 or the stick; upright, on its side, face to face; a laptop');
    const p = await page(browser);
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await p.evaluate(() => document.querySelector('#msg [data-o="ctl:btn"]').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#msg [data-o="ctl:bar"]') && !!document.querySelector('#msg [data-o="ctl:tilt"]')), 'the start card offers 按钮 / 滑条 / 倾斜, 按钮 to begin with');
    await p.click('#msg [data-m="go"]'); await sleep(100);
    await p.evaluate(() => { const G = __kb.game; G.count = 0; G.state = 'race'; });
    const pr = await p.evaluate(() => { const z = document.querySelector('.bz'), l = z.querySelector('.bzb.l').getBoundingClientRect(), r = z.querySelector('.bzb.r').getBoundingClientRect(); return { l: [l.x + l.width / 2, l.y + l.height / 2], r: [r.x + r.width / 2, r.y + r.height / 2], size: l.width }; });
    const touch = (t, id, [x, y]) => p.evaluate(([t, id, x, y]) => document.querySelector('.bz').dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true })), [t, id, x, y]);
    const inp = () => p.evaluate(() => { const s = __kb.IN[__kb.game.humans[0]]; return { l: s.l, r: s.r, dir: document.querySelector('.bz').dataset.dir }; });
    const hd = () => p.evaluate(() => __kb.game.karts.find((k) => k.human).h);
    const h0 = await hd(); await touch('pointerdown', 31, pr.l); const a1 = await inp(); await sleep(400); const h1 = await hd();
    await touch('pointermove', 31, pr.r); const a2 = await inp();
    await touch('pointerup', 31, pr.r); const a3 = await inp();
    ok(pr.size >= 72 && a1.l && !a1.r && a1.dir === 'l' && h1 < h0 - 0.1, `holding ◀ (${Math.round(pr.size)}px) turns left and lights it up (${(h1 - h0).toFixed(2)} rad)`);
    ok(a2.r && !a2.l && a2.dir === 'r', 'sliding the thumb onto ▶ turns right without lifting it');
    ok(!a3.l && !a3.r && !a3.dir, 'letting go goes straight');
    // 倾斜: asked for on a tap; then which way is down decides the steering
    await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura' }); }); await p.waitForSelector('#msg:not([hidden]) [data-o="ctl:tilt"]');
    const feed = p.evaluate(async () => { for (let i = 0; i < 40; i++) { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 60, gamma: 0 })); await new Promise((r) => setTimeout(r, 30)); } });
    await p.click('#msg [data-o="ctl:tilt"]'); await feed; await sleep(250);
    ok(await p.evaluate(() => __kb.Tilt.state === 'on' && __kb.KSET.ctl === 'tilt' && /方向盘/.test(document.querySelector('#msg .panel').textContent)), '倾斜: the phone answers, and the card says how to hold it');
    await p.click('#msg [data-m="go"]'); await sleep(80);
    ok(await p.evaluate(() => !!document.querySelector('.tw') && !document.querySelector('.bz') && !document.querySelector('.sz') && !!document.querySelector('[data-k="drift"]') && !!document.querySelector('[data-k="item"]')), '…no steering buttons: 漂移 and 🎁 under the thumbs, a wheel in the middle');
    await p.evaluate(() => { const G = __kb.game; G.count = 0.4; for (let i = 0; i < 30; i++) G.update(1 / 60); });   // held like that through the count: that is straight
    const turnTo = (b, gm) => p.evaluate(([b, gm]) => { for (let i = 0; i < 14; i++) window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: gm })); const G = __kb.game; G.state = 'race'; const k = G.karts.find((q) => q.human), h0 = k.h; for (let i = 0; i < 30; i++) G.update(1 / 60); return { st: k.st, dh: k.h - h0 }; }, [b, gm]);
    const R = await turnTo(60, 40), Lf = await turnTo(60, -40), S0 = await turnTo(60, 0);
    ok(R.st > 0.6 && R.dh > 0.05, `turning the phone right steers right (${R.st.toFixed(2)})`);
    ok(Lf.st < -0.6 && Lf.dh < -0.05, `…left steers left (${Lf.st.toFixed(2)})`);
    ok(Math.abs(S0.st) < 0.05, 'held the way it was at the start: straight');
    await p.evaluate(() => { for (let i = 0; i < 14; i++) window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 70, gamma: 15 })); });
    await p.click('.tw'); const C = await turnTo(70, 15);
    ok(Math.abs(C.st) < 0.05, 'a tap on the wheel makes the way you hold it now "straight"');
    const side = await p.evaluate(() => { const T = __kb.Tilt, a0 = T.angle; T.angle = () => 90; const fire = (b, gm) => { for (let i = 0; i < 14; i++) window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: b, gamma: gm })); };
      fire(0, -60); T.center(); fire(25, -60); const r = T.steer(); fire(-25, -60); const l = T.steer(); T.angle = a0; return [r, l]; });
    ok(side[0] > 0.6 && side[1] < -0.6, `on its side, turning it like a wheel still steers the right way (${side.map((x) => x.toFixed(2)).join(', ')})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
    // a device that gives no tilt (a laptop, or a refused permission): it says so and keeps the buttons
    const q = await page(browser);
    await q.click('[data-play="kart:1p"]'); await q.waitForSelector('#msg:not([hidden]) [data-o="ctl:tilt"]'); await q.click('#msg [data-o="ctl:tilt"]');
    await q.waitForFunction(() => __kb.Tilt.state === 'none', null, { timeout: 4000 }); await sleep(200);
    ok(await q.evaluate(() => __kb.KSET.ctl === 'btn' && /这部设备没有给倾斜/.test(document.querySelector('#msg .panel').textContent) && !/要在 app 里玩/.test(document.querySelector('#msg .panel').textContent) && document.querySelector('#msg [data-o="ctl:btn"]').getAttribute('aria-pressed') === 'true'), 'no tilt to be had (no sensor here): the card says this device gave none — not "play it in the app" — and goes back to 按钮');
    // two on one phone held upright: face to face
    await q.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '2p', place: 'candy' }); }); await q.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await q.evaluate(() => !document.querySelector('#msg [data-o="ctl:tilt"]') && /面对面/.test(document.querySelector('#msg .panel').textContent)), 'two on one phone: no 倾斜 (one phone, one tilt), and the card explains face to face');
    await q.click('#msg [data-m="go"]'); await sleep(120);
    const face = await q.evaluate(() => { const G = __kb.game, cs = document.querySelector('.bz.cs'), yy = document.querySelector('.bz.yy'), a = cs.getBoundingClientRect(), b = yy.getBoundingClientRect(), tb = [...document.querySelectorAll('.tb')].map((e) => e.getBoundingClientRect());
      return { face: G.face, rot: G.views[0].rot && !G.views[1].rot, csTop: a.bottom < innerHeight / 2, yyBottom: b.top > innerHeight / 2, flipped: !!cs.closest('.flip') && !yy.closest('.flip'), mid: tb.every((r) => Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) < 4), cls: document.getElementById('play').classList.contains('face') }; });
    ok(face.face && face.rot && face.csTop && face.yyBottom && face.flipped && face.mid && face.cls, 'upright: face to face — CS\'s half and buttons turned round at the top, YY\'s at the bottom, ✕ ⏸ 🔊 on the line between');
    const csL = await q.evaluate(() => { const z = document.querySelector('.bz.cs'), l = z.querySelector('.bzb.l').getBoundingClientRect(), r = z.getBoundingClientRect(); return { x: l.x + l.width / 2, y: l.y + l.height / 2, right: l.x + l.width / 2 > r.x + r.width / 2 }; });
    await q.evaluate(({ x, y }) => document.querySelector('.bz.cs').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, clientX: x, clientY: y, bubbles: true })), csL);
    const csIn = await q.evaluate(() => ({ l: __kb.IN.cs.l, r: __kb.IN.cs.r }));
    await q.evaluate(() => document.querySelector('.bz.cs').dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, bubbles: true })));
    ok(csL.right && csIn.l && !csIn.r, 'CS\'s ◀ — on the right of the screen, his left — turns his kart left');
    await q.screenshot({ path: SHOTS + '/t_ctl_face.png' });
    await q.setViewportSize({ width: 844, height: 390 }); await sleep(300);
    const sideBy = await q.evaluate(() => { const G = __kb.game, z = [...document.querySelectorAll('.bz')].map((e) => e.getBoundingClientRect()); return { face: G.face, two: G.views.length === 2 && G.views[1].x > 0, on: z.length === 2 && z.every((r) => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), flip: !!document.querySelector('#pad .flip'), cls: document.getElementById('play').classList.contains('face') }; });
    ok(!sideBy.face && sideBy.two && sideBy.on && !sideBy.flip && !sideBy.cls, 'turned on its side mid-race: left and right halves, both sets of buttons on screen');
    const fov = await q.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); const v = __kb.game.views[0]; return { f: v.f0, bw: v.bw }; });
    ok(fov.f < fov.bw * 0.7, `on its side the camera sees wider instead of zooming in (focal ${fov.f.toFixed(0)}, was ${Math.round(fov.bw * 0.78)})`);
    ok(!q.errs.length, 'no page errors ' + q.errs.join(' | '));
    await q.context().close();
    // 烟花炸弹: 方向键 first, the stick a tap away; turn the phone mid-game
    const b = await page(browser);
    await b.evaluate(() => __kb.open('bomb', { mode: 'coop', place: 'garden', two: false })); await b.waitForSelector('#msg:not([hidden]) [data-w="dpad"]');
    ok(await b.evaluate(() => document.querySelector('#msg [data-w="dpad"]').getAttribute('aria-pressed') === 'true' && !!document.querySelector('#msg [data-w="stick"]')), 'the start card offers 方向键 / 摇杆, 方向键 to begin with');
    await b.click('#msg [data-m="go"]'); await sleep(150);
    await b.evaluate(() => { __kb.game.enemies.length = 0; });
    const arm = (k) => b.evaluate((k) => { const r = document.querySelector(`.dz .dzb.${k}`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, k);
    const dz = async (t, k) => { const [x, y] = await arm(k); return b.evaluate(([t, x, y]) => document.querySelector('.dz').dispatchEvent(new PointerEvent(t, { pointerId: 51, clientX: x, clientY: y, bubbles: true })), [t, x, y]); };
    const me = () => b.evaluate(() => { const q2 = __kb.game.players.find((x) => x.human); return { x: q2.x, y: q2.y, joy: __kb.IN[q2.k].joy, a: document.querySelector('.dz').dataset.a, size: document.querySelector('.dzb').getBoundingClientRect().width }; });
    const m0 = await me(); await dz('pointerdown', 'r'); await sleep(450); const m1 = await me();
    ok(m1.joy && m1.joy[0] === 'r' && m1.a === 'r' && m1.x > m0.x + 0.5 && m1.size >= 50, `holding ▶ walks right and lights it up (arms ${Math.round(m1.size)}px)`);
    await dz('pointermove', 'd'); const m2 = await me();
    ok(m2.joy && m2.joy[0] === 'd' && m2.a === 'd', 'sliding onto ▼ turns that way without lifting the thumb');
    await dz('pointerup', 'd'); ok((await me()).joy === null, 'letting go stops');
    await b.click('#pause'); await b.waitForSelector('#msg:not([hidden]) [data-c="stick"]'); await b.click('#msg [data-c="stick"]'); await sleep(100);
    ok(await b.evaluate(() => !!document.querySelector('.jz') && !document.querySelector('.dz') && __kb.BSET.walk === 'stick'), 'the pause menu switches to the stick, and remembers it');
    await b.click('#msg [data-m="go"]'); await sleep(60);
    await b.setViewportSize({ width: 844, height: 390 }); await sleep(300);
    const bs = await b.evaluate(() => { const G = __kb.game, L = G.lay, board = { l: L.x, r: L.x + 13 * L.cs, b: L.y + L.bh + 11 * L.rd }, ctl = [...document.querySelectorAll('#pad .pb, #pad .jz, #pad .dz')].map((e) => e.getBoundingClientRect());
      return { on: ctl.every((r) => r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1), clear: ctl.every((r) => r.right <= board.l + 4 || r.left >= board.r - 4), fits: board.l >= 0 && board.r <= innerWidth && board.b <= innerHeight }; });
    ok(bs.on && bs.clear && bs.fits, 'turned on its side mid-game: the maze fits between the controls');
    await b.setViewportSize({ width: 390, height: 844 }); await sleep(100);
    await b.evaluate(() => { __kb.BSET.walk = 'dpad'; __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'beach', two: true }); }); await b.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await b.click('#msg [data-m="go"]'); await sleep(200);
    const two = await b.evaluate(() => { const els = [...document.querySelectorAll('#pad .pb, #pad .dzb, .hc.pc')].map((e) => e.getBoundingClientRect()), hit = (a, c) => a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
      const L = __kb.game.lay, boardB = L.y + L.bh + 11 * L.rd + L.cs * 0.75;
      return { n: document.querySelectorAll('.dz').length, overlap: els.some((a, i) => els.some((c, j) => j > i && hit(a, c))), on: els.every((r) => r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight), big: [...document.querySelectorAll('.dzb')].every((e) => e.getBoundingClientRect().width >= 44), below: els.every((r) => r.top >= boardB - 2) }; });
    ok(two.n === 2 && !two.overlap && two.on && two.big && two.below, 'two on an upright phone with 方向键: a cross each (arms ≥ 44px), 💥 and the pet above it, hearts above that — nothing on top of anything, all below the maze');
    await b.screenshot({ path: SHOTS + '/t_ctl_bomb2.png' });
    ok(!b.errs.length, 'no page errors ' + b.errs.join(' | '));
    await b.context().close();
    // a laptop: keys at the bottom while you start and whenever you pause; everything a bit bigger; the camera sees wider
    const d = await page(browser, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
    await d.evaluate(() => __kb.open('kart', { mode: '1p', place: 'sakura' })); await d.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await d.evaluate(() => !document.querySelector('#msg [data-o^="ctl"]')), 'a laptop has no 转弯 choice (it has keys)');
    await d.click('#msg [data-m="go"]'); await sleep(200);
    const lap = await d.evaluate(() => { const k = document.getElementById('gkeys'), tb = document.getElementById('pause').getBoundingClientRect(), v = __kb.game.views[0]; return { keys: !k.hidden && /转弯/.test(k.textContent), ui: __kb.UIS, tb: tb.width, page: /电脑上/.test(document.getElementById('keys').textContent), f: v.f0 < v.bw * 0.7 }; });
    ok(lap.keys && lap.ui > 1.2 && lap.tb > 50 && lap.page && lap.f, `a laptop: the keys at the bottom as you start, buttons ${Math.round(lap.tb)}px (×${lap.ui.toFixed(2)}), a wider view — and the page's own key note untouched`);
    await d.evaluate(() => { const G = __kb.game; G.count = 0; G.state = 'race'; G.t = 13; }); await sleep(120);
    ok(await d.evaluate(() => document.getElementById('gkeys').hidden), '…the keys go once you are on your way');
    await d.keyboard.press('KeyP'); await sleep(120);
    ok(await d.evaluate(() => !document.getElementById('gkeys').hidden), '…and come back while paused');
    const bg = await d.evaluate(() => { const T = __kb.game.T, c = T.far, px = c.getContext('2d').getImageData(0, 0, c.width, 4).data; let a = 0; for (let i = 3; i < px.length; i += 4) a = Math.max(a, px[i]); return { mips: T.mips.length === 3 && T.mips[1].tw === Math.ceil(T.tw / 2) && T.mips[2].tw === Math.ceil(T.mips[1].tw / 2), sky: a }; });
    ok(bg.mips && bg.sky === 0, 'the ground has half- and quarter-size copies for far away, and the far hills leave the sky clear');
    ok(!d.errs.length, 'no page errors ' + d.errs.join(' | '));
    await d.context().close();
  }

  if (want('fun')) {
    console.log('\nU4. What the best kart and maze games do, done our way: music, 季节门, 跟风, ⏪ 倒回, 影子赛, the big moments');
    const p = await page(browser);
    await p.evaluate(() => { localStorage.setItem('kb_coach_kart', '5'); localStorage.setItem('kb_coach_bomb', '5'); });
    // music: each place its own tune, from the start of the race, quiet when paused, gone at the end
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await p.click('#msg [data-m="go"]'); await sleep(300);
    const m0 = await p.evaluate(() => ({ before: !!__kb.Music.song, trip: __kb.game.trip && __kb.game.trip.ready && __kb.game.trip.opts.length === 2 }));
    await p.evaluate(() => { const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); }); await sleep(250);
    const m1 = await p.evaluate(() => { const M = __kb.Music; const pulses = []; return { on: !!M.song && !!M.out, bpm: M.song && M.song.bpm, bars: M.song && M.song.bars.length, notes: M.song && M.song.mel.filter(Boolean).length, step: M.step }; });
    ok(!m0.before && m1.on && m1.bpm === 126 && m1.notes > 20 && m1.step > 0, `music starts with the race, not before (樱花小镇: ${m1.bpm} bpm, ${m1.bars} bars, ${m1.notes} melody notes, playing)`);
    ok(m0.trip, 'both places behind the 季节门 are ready while the lights count down');
    await p.click('#pause'); await sleep(150);
    const m2 = await p.evaluate(() => ({ paused: __kb.Music.paused, vol: __kb.Music.vol() }));
    await p.click('#msg [data-m="go"]'); await sleep(100);
    ok(m2.paused && m2.vol === 0 && await p.evaluate(() => !__kb.Music.paused), 'paused: the music goes quiet, and comes back with the race');
    const songs = await p.evaluate(() => ['sakura', 'beach', 'snow', 'candy', 'night'].map((id) => { __kb.close(); __kb.open('kart', { mode: '1p', place: id, skipCard: true }); const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); const s = __kb.Music.song; return `${s.bpm}:${s.mel.slice(0, 16).join(',')}`; }));
    ok(new Set(songs).size === 5, 'every track has its own tune');
    // 季节门: whichever gate the leader drives through, the second lap happens there; the third comes home
    const gate = (side) => p.evaluate((side) => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); const G = __kb.game; return new Promise((res) => setTimeout(() => {
      const T = G.T; G.state = 'count'; G.count = 0; G.update(1 / 60); const me = G.karts.find((k) => k.human); for (const k of G.karts) if (k !== me) k.prog = -1e9;
      const gi = G.trip.gi, s = T.S[gi - 6], lat = side * 1.6, sky0 = T.th.sky[0], song0 = __kb.Music.song;
      Object.assign(me, { lap: 1, idx: gi - 6, x: s.x - s.ty * lat, y: s.y + s.tx * lat, h: s.ang, v: 18, mid: false });
      for (let i = 0; i < 40; i++) { me.prog = 1e9; G.update(1 / 60); }
      const want = G.trip.opts[side < 0 ? 0 : 1], away = { state: G.trip.state, id: G.trip.chosenDef && G.trip.chosenDef.id, want: want.id, sky: T.th.sky[0] === want.th.sky[0] && T.th.sky[0] !== sky0, trees: T.trees.some((t) => want.scenery.some(([kk]) => kk === t.k)), music: __kb.Music.song !== song0, msg: me.msg };
      const s2 = T.S[gi - 6]; Object.assign(me, { lap: 2, idx: gi - 6, x: s2.x, y: s2.y, h: s2.ang, v: 18 });
      for (let i = 0; i < 40; i++) { me.prog = 1e9; G.update(1 / 60); }
      res({ away, home: G.trip.state === 2 && T.th.sky[0] === sky0 && T.trees.some((t) => t.k === 'cherry') });
    }, 200)); }, side);
    const gl = await gate(-1), gr = await gate(1);
    ok(gl.away.state === 1 && gl.away.id === gl.away.want && gl.away.sky && gl.away.trees && gl.away.music, `the leader through the left gate: lap 2 is in ${gl.away.id} — its sky, its trees, its music (“${gl.away.msg}”)`);
    ok(gr.away.state === 1 && gr.away.id === gr.away.want && gr.away.id !== gl.away.id, `through the right one: ${gr.away.id}`);
    ok(gl.home && gr.home, 'the gate on lap 2 brings everyone home for the last lap');
    // 跟风: right behind another kart for a moment pulls you along
    const draft = await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true, assist: false }); const G = __kb.game, T = G.T; G.state = 'count'; G.count = 0; G.update(1 / 60);
      const me = G.karts.find((k) => k.human), mm = G.karts.find((k) => k.k === 'mm'), s = T.S[60], s2 = T.S[67]; for (const k of G.karts) if (k !== me && k !== mm) k.x += 500;
      let got = false; for (let i = 0; i < 100 && !got; i++) { Object.assign(mm, { x: s2.x, y: s2.y, h: s2.ang, v: 0, idx: 67 }); Object.assign(me, { x: s.x, y: s.y, h: s.ang, v: 16, idx: 60, boost: 0 }); __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; G.update(1 / 60); if (me.boost > 0) got = true; }
      return { got, msg: me.msg, col: me.boostCol }; });
    ok(draft.got && /跟风/.test(draft.msg), `right behind 闷闷 for a moment: “${draft.msg}”`);
    // ⏪: offered after trouble, three seconds back, the clock keeps going; not for two, not in 影子赛
    const rw = await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'beach', skipCard: true }); const G = __kb.game, T = G.T; G.state = 'count'; G.count = 0; G.update(1 / 60); const k = G.karts.find((q) => q.human);
      for (const o of G.karts) if (!o.human) { o.x += 999; o.item = null; o.aiT = 999; }   // nobody else on the road for this one
      for (let i = 0; i < 360; i++) { G.clouds.length = 0; G.puddles.length = 0; const s = T.S[(k.idx + 14) % T.N], d = Math.atan2(Math.sin(Math.atan2(s.y - k.y, s.x - k.x) - k.h), Math.cos(Math.atan2(s.y - k.y, s.x - k.x) - k.h)); __kb.IN[k.k].steerOn = true; __kb.IN[k.k].steer = Math.max(-1, Math.min(1, d * 3)); G.update(1 / 60); }
      const hidden0 = document.querySelector('.rwb') ? document.querySelector('.rwb').hidden : true, was = G.hist[G.hist.length - 31], t0 = G.t;
      k.rescue = 1.3; G.update(1 / 60); const shown = document.querySelector('.rwb') && !document.querySelector('.rwb').hidden;
      document.querySelector('.rwb').click(); const back = Math.hypot(k.x - was.x, k.y - was.y), again = G.rewind();
      return { hidden0, shown, back, rescue: k.rescue, clock: G.t >= t0, again, gone: document.querySelector('.rwb').hidden };
    });
    ok(rw.hidden0 && rw.shown, 'no ⏪ while all is well; it comes up after a fall into the sea');
    ok(rw.back < 0.5 && rw.rescue === 0 && rw.clock && !rw.again && rw.gone, `a tap puts you where you were three seconds before (${rw.back.toFixed(2)} away), out of the water; the clock doesn't go back, and it can't be used again straight away`);
    const rwKey = await p.evaluate(() => { const G = __kb.game; G.rwCd = 0; G.state = 'race'; for (let i = 0; i < 30; i++) G.update(1 / 60); const n = G.hist.length; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); return G.hist.length < n; });
    ok(rwKey, 'R on a keyboard does the same');
    ok(await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '2p', place: 'sakura', skipCard: true }); const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); for (let i = 0; i < 200; i++) G.update(1 / 60); return G.rewind() === false; }), 'two on one phone: no ⏪ (it would be unfair on the other)');
    // 影子赛: race alone; the ghost left behind is your partner's to race next time
    await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('kb_ghost')) localStorage.removeItem(k); localStorage.setItem('kb_me', JSON.stringify('cs')); });
    await p.reload(); await p.waitForFunction(() => window.__kb); await sleep(300);
    await p.click('[data-play="kart:tt"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await p.evaluate(() => /第一次跑这里/.test(document.querySelector('#msg .panel').textContent) && !document.querySelector('#msg [data-m="cup"]') && !document.querySelector('#msg [data-o^="cls"]')), '影子赛, the first time: the card says your ghost will be left for your partner; no 难度, no 樱花杯');
    await p.click('#msg [data-m="go"]'); await sleep(100);
    const drive = () => p.evaluate(() => { const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); const k = G.karts[0], T = G.T; let boxes = 0; const b0 = T.boxes.map((b) => b.t).join();
      for (let i = 0; i < 60 * 60 && !k.done; i++) { const s = T.S[(k.idx + 14) % T.N], d = Math.atan2(Math.sin(Math.atan2(s.y - k.y, s.x - k.x) - k.h), Math.cos(Math.atan2(s.y - k.y, s.x - k.x) - k.h)); __kb.IN[k.k].steerOn = true; __kb.IN[k.k].steer = Math.max(-1, Math.min(1, d * 3)); G.update(1 / 60); }
      return { n: G.karts.length, done: k.done, t: k.time, item: k.item, boxes: T.boxes.map((b) => b.t).join() === b0, gh: G.ghost && G.ghost.who }; });
    const r1 = await drive();
    ok(r1.n === 1 && r1.done && !r1.item && r1.boxes, `just you on the road, no gift boxes, home in ${r1.t.toFixed(1)} s`);
    await p.waitForSelector('#msg:not([hidden]) [data-m="again"]', { timeout: 5000 });
    const saved = await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('kb_ghost_sakura_cs')); return { t: g && g.t, n: g && g.d.length / 3, laps: g && g.laps.length, card: document.querySelector('#msg .panel').textContent }; });
    ok(saved.t && saved.n > saved.t * 9 && saved.laps === 4 && /新纪录/.test(saved.card) && /YY 下次/.test(saved.card), `the run is kept as a ghost (${Math.round(saved.n)} places, ten a second) and the card says YY can race it`);
    await p.evaluate(() => localStorage.setItem('kb_me', JSON.stringify('yy'))); await p.reload(); await p.waitForFunction(() => window.__kb); await sleep(300);
    await p.click('[data-play="kart:tt"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await p.evaluate(() => /和CS的影子比/.test(document.querySelector('#msg .panel').textContent.replace(/\s/g, '')) && __kb.game.ghost.who === 'cs'), 'YY opens 影子赛: CS\'s ghost is waiting, with CS\'s time');
    await p.click('#msg [data-m="go"]'); await sleep(100);
    const seen = await p.evaluate(() => { const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); for (let i = 0; i < 60; i++) G.update(1 / 60); return !!G.ghost && G.state === 'race'; });
    await sleep(150); await p.screenshot({ path: SHOTS + '/t_fun_ghost.png' });
    const r2 = await drive();
    await p.waitForSelector('#msg:not([hidden]) [data-m="again"]', { timeout: 5000 });
    const card2 = await p.evaluate(() => document.querySelector('#msg .panel').textContent);
    ok(seen && r2.done && /CS 的影子/.test(card2) && /(快了|慢了)/.test(card2), `racing it: the card says how YY did against CS's ghost (“${card2.match(/比CS 的影子[^，！]*/)?.[0] || card2.slice(0, 40)}”)`);
    ok(await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: 'tt', place: 'sakura' }); return new Promise((r) => setTimeout(() => r(!!document.querySelector('#msg [data-o="ghost:me"]') && !!document.querySelector('#msg [data-o="ghost:partner"]') && !__kb.game.trip), 120)); }), 'with both ghosts kept, the card lets you pick whose to race; 影子赛 has no 季节门');
    // the big moments: a hit holds the picture for a blink; a close finish is called
    const hs = await p.evaluate(() => { __kb.close(); __kb.open('kart', { mode: '1p', place: 'sakura', skipCard: true }); const G = __kb.game; G.state = 'count'; G.count = 0; G.update(1 / 60); const k = G.karts.find((q) => q.human); for (let i = 0; i < 60; i++) G.update(1 / 60); k.shield = 0; k.rainbow = 0; G.hurt(k, 'spin'); const x0 = G.karts[0].x, f = G.freeze; G.update(1 / 60); return { f, still: G.karts[0].x === x0 }; });
    ok(hs.f > 0.05 && hs.still, 'a hit holds the picture for a blink');
    const close = await p.evaluate(() => { const G = __kb.game; G.state = 'race'; const me = G.karts.find((q) => q.human), mm = G.karts.find((q) => q.k === 'mm');
      for (const k of G.karts) { k.lap = 3; k.idx = G.T.N - 2; k.mid = true; k.owe = false; const s = G.T.S[3]; } mm.done = true; mm.time = G.t + 0.2; G.order.push(mm); me.idx = G.T.N - 2; me.lap = 3; me.mid = true; const s = G.T.S[3]; me.x = s.x; me.y = s.y; G.t += 0.4;
      for (let n = 0; n < 200; n++) G.update(1 / 60); return new Promise((r) => setTimeout(() => r(document.querySelector('#msg .panel') ? document.querySelector('#msg .panel').textContent : ''), 2400)); });
    ok(/就差|险胜/.test(close), `a finish within half a second is called (“${(close.match(/(就差|险胜)[^！]*！?/) || [''])[0]}”)`);
    // 烟花炸弹: music from the first step, faster in the 烟花大会; three fireworks setting each other off hold the frame
    const b1 = await p.evaluate(async () => { __kb.close(); __kb.open('bomb', { mode: 'vs', place: 'garden', two: true }); await new Promise((r) => setTimeout(r, 120)); document.querySelector('#msg [data-m="go"]').click(); const G = __kb.game, M = __kb.Music;
      const on = !!M.song && M.song.bpm === Math.round(112 * 0.9), intro = G.startT > 1.2; G.t = 76; G.update(1 / 60); return { on, intro, fast: M.tempo === 1.15 }; });
    ok(b1.on && b1.fast, `烟花炸弹 has its own music from the start, and it speeds up for the 烟花大会`);
    const chain = await p.evaluate(() => { const G = __kb.game; G.hurry = true; const p0 = G.players[0]; G.freeze = 0;
      for (let c = 1; c < 12; c++) { G.grid[1 * 13 + c] = 0; G.ice[1 * 13 + c] = 0; }
      G.bombs.length = 0; for (const c of [3, 4, 5]) G.bombs.push({ c, r: 1, fx: c + 0.5, fy: 1.5, t: c === 3 ? 0.01 : 5, range: 3, own: p0, pierce: 0, love: 0 });
      let saw = false; for (let i = 0; i < 40 && !saw; i++) { G.update(1 / 60); if ((G.chainN || 0) >= 3) saw = true; } return { saw, banner: G.banner }; });
    ok(chain.saw && /连环/.test(chain.banner), `fireworks setting each other off: “${chain.banner}”, and the frame holds`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('devices')) {
    console.log('\nD1. Every kind of screen, every mode, played the way a person would: taps on a phone, keys on a laptop');
    const DEV = [['iPhone in the Claude app, on its side', 932, 352, 1], ['iPhone SE', 375, 667, 1], ['iPhone 15', 393, 852, 1], ['big Android', 412, 915, 1], ['small Android', 360, 740, 1], ['phone on its side', 852, 393, 1], ['iPhone SE on its side', 667, 375, 1],
      ['iPad', 820, 1180, 1], ['iPad on its side', 1180, 820, 1], ['small laptop', 1280, 720, 0], ['laptop', 1366, 768, 0], ['MacBook', 1440, 900, 0], ['desktop', 1920, 1080, 0]];
    const run = async (bw, name, w, h, touch) => {
      const p = await page(bw, { viewport: { width: w, height: h }, isMobile: !!touch, hasTouch: !!touch, deviceScaleFactor: 2 });
      const tag = `${name} ${w}×${h}`, probs = [];
      const fits = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length).map((e) => e.getBoundingClientRect()).filter((r) => r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)).length, sel);
      const small = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height < 42; }).length, sel);
      let lastRect = '';
      const panelOk = () => p.evaluate(() => { const pn = document.querySelector('#msg .panel'); if (!pn) return 'none'; const r = pn.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 ? true : `${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} in ${innerWidth}×${innerHeight}`; }).then((v) => { lastRect = v === true ? '' : v; return v === true; });
      const fps = () => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = (t) => { n++; if (t - t0 < 1200) requestAnimationFrame(f); else res(n / ((t - t0) / 1000)); }; requestAnimationFrame(f); }));
      const press = async (sel, ms, xf = 0.5, yf = 0.5) => { const box = await p.evaluate(([sel, xf, yf]) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width * xf, r.top + r.height * yf]; }, [sel, xf, yf]); if (!box) return false;
        await p.evaluate(([sel, x, y]) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, clientX: x, clientY: y, bubbles: true })), [sel, ...box]); await sleep(ms);
        await p.evaluate(([sel, x, y]) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerup', { pointerId: 77, clientX: x, clientY: y, bubbles: true })), [sel, ...box]); return true; };
      const hold = async (key, ms) => { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key); };
      // the page itself
      const pg = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.wrap button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length }));
      if (pg.over > 0 || pg.small) probs.push(`page: sideways scroll ${pg.over}, small buttons ${pg.small}`);
      await p.evaluate(() => { localStorage.setItem('kb_coach_kart', '5'); localStorage.setItem('kb_coach_bomb', '5'); });
      // 卡丁车, one player
      await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]');
      if (!(await panelOk())) probs.push('kart card cut off ' + lastRect);
      await p.click('#msg [data-m="go"]'); await sleep(150);
      await p.evaluate(() => { const G = __kb.game; G.count = 0.01; }); await sleep(900);
      const h0 = await p.evaluate(() => __kb.game.karts.find((k) => k.human).h);
      if (touch) { if (!(await press('.bz', 700, 0.2))) probs.push('no ◀ ▶'); } else await hold('ArrowLeft', 700);
      const h1 = await p.evaluate(() => __kb.game.karts.find((k) => k.human).h);
      if (!(h1 < h0 - 0.05)) probs.push(`kart did not turn left (${(h1 - h0).toFixed(2)})`);
      const f1 = await fps(); if (f1 < 45) probs.push(`kart ${f1.toFixed(0)} fps`);
      if (await fits('#pad .pb, #pad .bzb, #pad .sz, .tb, #gkeys span')) probs.push('kart: a control off the screen');
      if (await small('#pad .pb, #pad .bzb, .tb')) probs.push('kart: a control under 42px');
      if (touch) await p.click('#pause'); else await p.keyboard.press('KeyP');
      await p.waitForSelector('#msg:not([hidden]) [data-m="help"]'); if (!(await panelOk())) probs.push('pause menu cut off ' + lastRect);
      if (!touch && (await p.evaluate(() => document.getElementById('gkeys').hidden))) probs.push('laptop: no keys shown while paused');
      await p.click('#msg [data-m="go"]'); await sleep(100);
      if (await p.evaluate(() => __kb.game.paused)) probs.push('did not resume');
      if (touch) await p.click('#xbtn'); else await p.keyboard.press('Escape');
      await sleep(150); if (!(await p.evaluate(() => document.getElementById('play').hidden))) probs.push('✕ / Esc did not leave');
      // 卡丁车, two on one screen
      await p.click('[data-play="kart:2p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await p.click('#msg [data-m="go"]'); await sleep(150);
      await p.evaluate(() => { __kb.game.count = 0.01; }); await sleep(600);
      if (touch) { await press('.bz.cs, .sz.cs', 300, 0.2); await press('.bz.yy, .sz.yy', 300, 0.8); }
      else { await hold('KeyA', 300); await hold('ArrowRight', 300); }
      const two = await p.evaluate(() => ({ views: __kb.game.views.length, face: __kb.game.face }));
      if (two.views !== 2) probs.push('2p: not two views');
      if (await fits('#pad .pb, #pad .bzb, #pad .sz, .tb')) probs.push('2p: a control off the screen');
      const f2 = await fps(); if (f2 < 45) probs.push(`2p ${f2.toFixed(0)} fps`);
      await p.evaluate(() => __kb.close());
      // 影子赛
      await p.click('[data-play="kart:tt"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await p.click('#msg [data-m="go"]'); await sleep(150);
      await p.evaluate(() => { __kb.game.count = 0.01; }); await sleep(500);
      if (await p.evaluate(() => __kb.game.karts.length !== 1 || __kb.game.state !== 'race')) probs.push('影子赛 did not start');
      await p.evaluate(() => __kb.close());
      // 烟花炸弹 together (one person + the computer)
      await p.click('[data-play="bomb:coop"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="1"]'); await p.click('#msg [data-m="1"]');
      await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); if (!(await panelOk())) probs.push('bomb card cut off ' + lastRect);
      await p.click('#msg [data-m="go"]'); await sleep(300);
      await p.evaluate(() => { __kb.game.enemies.length = 0; });
      const x0 = await p.evaluate(() => __kb.game.players.find((q) => q.human).x);
      if (touch) { if (!(await press('.dz', 600, 0.85, 0.5))) probs.push('no 方向键'); } else await hold('KeyD', 600);
      const x1 = await p.evaluate(() => __kb.game.players.find((q) => q.human).x);
      if (!(x1 > x0 + 0.4)) probs.push(`bomb: did not walk right (${(x1 - x0).toFixed(2)})`);
      if (touch) await press('[data-k="bomb"]', 60); else await p.keyboard.press('Space');
      await sleep(60); if (!(await p.evaluate(() => __kb.game.bombs.some((b) => b.own.human)))) probs.push('bomb: no firework placed');
      if (await fits('#pad .pb, #pad .dzb, #pad .jz, .tb, .hc')) probs.push('bomb: something off the screen');
      const L = await p.evaluate(() => { const G = __kb.game, L2 = G.lay; return { b: L2.y + L2.bh + 11 * L2.rd + L2.cs * 0.75, r: L2.x + 13 * L2.cs, l: L2.x, t: L2.y }; });
      if (L.l < 0 || L.r > w || L.b > h || L.t < 0) probs.push('bomb: the maze does not fit');
      const f3 = await fps(); if (f3 < 45) probs.push(`bomb ${f3.toFixed(0)} fps`);
      await p.evaluate(() => __kb.close());
      // 烟花炸弹 against each other, two on one screen
      await p.click('[data-play="bomb:vs"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="2"]'); await p.click('#msg [data-m="2"]');
      await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await p.click('#msg [data-m="go"]'); await sleep(250);
      if (await fits('#pad .pb, #pad .dzb, #pad .jz, .tb')) probs.push('vs: a control off the screen');
      if (touch && (await p.evaluate(() => document.querySelectorAll('#pad .dz, #pad .jz').length)) !== 2) probs.push('vs: not two sets of controls');
      await p.evaluate(() => __kb.close());
      if (p.errs.length) probs.push('errors: ' + p.errs.join(' | '));
      await p.screenshot({ path: `${SHOTS}/t_dev_${w}x${h}.png` });
      await p.context().close();
      return { tag, probs, f: [f1, f2, f3].map((x) => Math.round(x)) };
    };
    for (const [name, w, h, touch] of DEV) { const r = await run(browser, name, w, h, touch); ok(!r.probs.length, `${r.tag}: 卡丁车 one and two, 影子赛, 烟花炸弹 together and against — all played, all on the screen, ${r.f.join('/')} fps${r.probs.length ? ' — ' + r.probs.join('; ') : ''}`); }
    console.log('\nD2. The same on Safari\'s engine (WebKit): an iPhone and a MacBook');
    const wkPath = require('fs').readdirSync(require('os').homedir() + '/Library/Caches/ms-playwright').filter((d) => d.startsWith('webkit-')).map((d) => require('os').homedir() + '/Library/Caches/ms-playwright/' + d + '/pw_run.sh').find((f) => require('fs').existsSync(f));
    if (!wkPath) ok(false, 'WebKit is installed');
    else {
      const wk = await webkit.launch({ executablePath: wkPath });
      for (const [name, w, h, touch] of [['iPhone 15', 393, 852, 1], ['iPhone on its side', 852, 393, 1], ['MacBook', 1440, 900, 0]]) { const r = await run(wk, name + ' (WebKit)', w, h, touch); ok(!r.probs.filter((x) => !/fps/.test(x)).length, `${r.tag}: everything played and on the screen (${r.f.join('/')} fps)${r.probs.length ? ' — ' + r.probs.join('; ') : ''}`); }
      await wk.close();
    }
  }

  if (want('newmaps')) {
    console.log('\nN1. The new places: 秋叶山道, 游乐园, 风车麦田, 云上花园, ☁️ 云朵杯; 🍎 秋天果园 and 🎡 游乐园 mazes; the controls inside the Claude app');
    const p = await page(browser);
    const run = (id, fn) => p.evaluate(([id, fn]) => { __kb.close(); __kb.open('kart', { mode: '1p', place: id, skipCard: true, assist: false }); const G = __kb.game, T = G.T; G.state = 'count'; G.count = 0; G.update(1 / 60); return new Function('G', 'T', fn)(G, T); }, [id, fn]);
    const piles = await run('autumn', `const me = G.karts.find((k) => k.human), pl = T.piles[2]; for (const k of G.karts) if (k !== me) k.x += 500; let bi = 0, bd = 1e9; T.S.forEach((q, i) => { const d = (q.x - pl.x) ** 2 + (q.y - pl.y) ** 2; if (d < bd) { bd = d; bi = i; } }); const s0 = T.S[(bi - 3 + T.N) % T.N]; const lat = (pl.x - T.S[bi].x) * -T.S[bi].ty + (pl.y - T.S[bi].y) * T.S[bi].tx; Object.assign(me, { x: s0.x - s0.ty * lat, y: s0.y + s0.tx * lat, h: s0.ang, v: 18, idx: (bi - 3 + T.N) % T.N, vx: Math.cos(s0.ang) * 18, vy: Math.sin(s0.ang) * 18 }); let low = 99, hit = false; for (let i = 0; i < 40; i++) { __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; G.update(1 / 60); if (me.pileT > 0) hit = true; if (hit) low = Math.min(low, me.v); } return { n: T.piles.length, slowIn: low, hit, msg: me.msg };`);
    ok(piles.n === 6 && piles.hit && piles.slowIn < 14 && /落叶/.test(piles.msg), `秋叶山道: six leaf piles on the road, and driving into one drags you down (to ${piles.slowIn.toFixed(1)} from 18)`);
    const tramp = await run('park', `const me = G.karts.find((k) => k.human), tp = T.ramps.find((r) => r.tramp), s = T.S[(tp.i - 4 + T.N) % T.N]; for (const k of G.karts) if (k !== me) k.x += 500; Object.assign(me, { x: s.x, y: s.y, h: s.ang, v: 16, idx: (tp.i - 4 + T.N) % T.N, vx: Math.cos(s.ang) * 16, vy: Math.sin(s.ang) * 16 }); let top = 0, flew = false; for (let i = 0; i < 90; i++) { __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; G.update(1 / 60); if (me.air) flew = true; top = Math.max(top, me.z); } return { n: T.ramps.filter((r) => r.tramp).length, flew, top };`);
    ok(tramp.n === 3 && tramp.flew && tramp.top > 0.95, `游乐园: three trampolines, and one throws the kart high (${tramp.top.toFixed(2)} up)`);
    const wind = await run('farm', `const me = G.karts.find((k) => k.human); for (const k of G.karts) if (k !== me) k.x += 500; let i0 = 0; for (let i = 0; i < T.N; i++) if (T.wind[i] === 1) { i0 = i + 4; break; } const s = T.S[i0]; Object.assign(me, { x: s.x, y: s.y, h: s.ang, v: 14, idx: i0, vx: Math.cos(s.ang) * 14, vy: Math.sin(s.ang) * 14 }); const lat = () => { const q = T.S[me.idx]; return (me.x - q.x) * -q.ty + (me.y - q.y) * q.tx; }; for (let i = 0; i < 40; i++) { __kb.IN[me.k].steerOn = true; __kb.IN[me.k].steer = 0; G.update(1 / 60); } return { drift: lat(), msg: me.msg, zones: T.wind.filter(Boolean).length };`);
    ok(wind.zones > 50 && wind.drift > 0.8 && /风/.test(wind.msg), `风车麦田: in the wind, hands off, the kart is pushed sideways (${wind.drift.toFixed(2)} to the right) and told which way to steer`);
    const sky = await run('sky', `const me = G.karts.find((k) => k.human); for (const k of G.karts) if (k !== me) k.x += 500; const s = T.S[40], o = T.hw + 4; Object.assign(me, { x: s.x - s.ty * o, y: s.y + s.tx * o, v: 8, idx: 40 }); G.update(1 / 60); const fell = me.rescue > 0; const msg = G.centerMsg(me)[0]; for (let i = 0; i < 100; i++) G.update(1 / 60); const q = T.S[me.idx], back = Math.hypot(me.x - q.x, me.y - q.y) < T.hw; return { fell, msg, back, trip: !!G.trip, walls: T.wallL.some((w) => w > T.hw + 3) || T.wallR.some((w) => w > T.hw + 3) };`);
    ok(sky.fell && /云/.test(sky.msg) && sky.back, `云上花园: off the edge of the cloud you fall (“${sky.msg}”) and are put back on the road`);
    ok(!sky.trip && !sky.walls, '…no fences out in the sky, and no 季节门 here (the edge has to stay where you can see it)');
    await p.evaluate(() => __kb.close()); await sleep(100); await p.click('[data-kp="farm"]'); await sleep(150);
    await p.click('[data-play="kart:1p"]'); await p.waitForSelector('#msg:not([hidden]) [data-m="cup"]');
    ok(await p.evaluate(() => /云朵杯/.test(document.querySelector('#msg [data-m="cup"]').textContent)), 'from one of the new tracks, the card offers ☁️ 云朵杯');
    await p.click('#msg [data-m="cup"]'); await sleep(200);
    const cupIds = [];
    await p.click('#msg [data-m="go"]'); await sleep(100);
    for (let i = 0; i < 4; i++) {
      cupIds.push(await p.evaluate(() => __kb.game.def.id));
      await p.evaluate(() => { const G = __kb.game; G.state = 'race'; G.paused = false; for (const k of G.karts) { k.lap = 3; k.idx = G.T.N - 2; k.prog = 3 * G.T.L; k.mid = true; k.owe = false; const s = G.T.S[3]; k.x = s.x; k.y = s.y; } for (let n = 0; n < 200; n++) G.update(1 / 60); });
      await p.waitForSelector('#msg:not([hidden]) .panel', { timeout: 5000 });
      if (i < 3) { await p.click('#msg [data-m="next"]'); await sleep(250); }
    }
    const last = await p.evaluate(() => document.querySelector('#msg .panel').textContent);
    ok(cupIds.join() === 'autumn,park,farm,sky' && /云朵杯/.test(last), `☁️ 云朵杯: ${cupIds.join(' → ')}, then who took the cup`);
    await p.evaluate(() => __kb.close());
    // the mazes
    const orch = await p.evaluate(() => { __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'orchard', two: true }); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true; G.enemies.length = 0;
      const leafK = [...G.loot.entries()].find(([, v]) => v === 'apple')[0], [c, r] = leafK.split(',').map(Number), me = G.players[0];
      const walkable = !G.test || true; const n = [...G.grid].filter((v) => v === 7).length, apples = [...G.loot.values()].filter((v) => v === 'apple').length;
      // wading: the same push moves you slower in the leaves than on the floor
      const free = []; for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) if (G.grid[y * 13 + x] === 0 && G.grid[y * 13 + x + 1] === 0 && G.grid[y * 13 + x + 2] === 0) free.push([x, y]);
      const [fx, fy] = free[0]; me.x = fx + 0.5; me.y = fy + 0.5; __kb.press('cs', 'r', true); for (let i = 0; i < 12; i++) G.update(1 / 60); __kb.press('cs', 'r', false); const onFloor = me.x - (fx + 0.5);
      for (let y = 1; y < 10; y++) for (let x = 1; x < 11; x++) if (G.grid[y * 13 + x] === 7 && G.grid[y * 13 + x + 1] === 7) { me.x = x + 0.5; me.y = y + 0.5; __kb.press('cs', 'r', true); for (let i = 0; i < 12; i++) G.update(1 / 60); __kb.press('cs', 'r', false); return { n, apples, onFloor, inLeaves: me.x - (x + 0.5), leafK }; }
      return { n, apples, onFloor, inLeaves: null, leafK }; });
    ok(orch.n >= 18 && orch.apples >= 8, `秋天果园: ${orch.n} leaf piles, ${orch.apples} apples hidden in them`);
    ok(orch.inLeaves !== null && orch.inLeaves > 0.05 && orch.inLeaves < orch.onFloor * 0.75, `…you can walk into the leaves, but slowly (${orch.inLeaves && orch.inLeaves.toFixed(2)} against ${orch.onFloor.toFixed(2)} on the floor)`);
    const burn = await p.evaluate((leafK) => { const G = __kb.game, [c, r] = leafK.split(',').map(Number), me = G.players[0]; G.items.clear(); G.bombs.push({ c: c, r: r - 1 > 0 && G.grid[(r - 1) * 13 + c] !== 1 ? r - 1 : r + 1, fx: 0, fy: 0, t: 0.01, range: 2, own: me, pierce: 0, love: 0 }); G.bombs[G.bombs.length - 1].fx = G.bombs[G.bombs.length - 1].c + 0.5; G.bombs[G.bombs.length - 1].fy = G.bombs[G.bombs.length - 1].r + 0.5;
      for (let i = 0; i < 50; i++) G.update(1 / 60); const it = G.items.get(leafK); const c0 = G.candy; if (it) { me.x = c + 0.5; me.y = r + 0.5; G.update(1 / 60); } return { burnt: G.grid[r * 13 + c] === 0, item: it && it.k, got: G.candy - c0, line: document.getElementById('hud').textContent }; }, orch.leafK);
    ok(burn.burnt && burn.item === 'apple' && burn.got === 1 && /🍎 1\/8/.test(burn.line), `fire burns the leaves away, an apple rolls out, and picking it up counts (🍎 1/8)`);
    const park = await p.evaluate(() => { __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'park', two: true }); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true;
      const key2 = (c2, r2) => c2 + ',' + r2, pairs = [...G.portals.entries()], [a, b] = pairs[0], [ac, ar] = a.split(',').map(Number), [bc, br] = b.split(',').map(Number), me = G.players[0];
      // walk onto a door from the next square, let go as soon as you come out of the other one
      const side = G.grid[ar * 13 + ac + 1] === 0 ? 1 : -1; me.x = ac + 0.5 + side; me.y = ar + 0.5; me.pCell = null; G.update(1 / 60); __kb.press('cs', side > 0 ? 'l' : 'r', true);
      let went = false; for (let i = 0; i < 60 && !went; i++) { G.update(1 / 60); if (Math.floor(me.x) === bc && Math.floor(me.y) === br) went = true; } __kb.press('cs', side > 0 ? 'l' : 'r', false);
      for (let i = 0; i < 30; i++) G.update(1 / 60); const stayed = Math.floor(me.x) === bc && Math.floor(me.y) === br;
      const bombOn = G.test.placeBomb ? G.test.placeBomb(me) : null;
      const e = G.enemies[0]; e.pCell = key2(ac + side, ar); e.x = ac + 0.5; e.y = ar + 0.5; G.update(1 / 60); const eWent = Math.abs(e.x - (bc + 0.5)) < 1.2 && Math.abs(e.y - (br + 0.5)) < 1.2;
      return { n: G.portals.size, went, stayed, bombOn, eWent };
    });
    ok(park.n === 4 && park.went && park.stayed, '游乐园: two pairs of doors; walk onto one and you come out of its twin, and standing there does not send you back');
    ok(park.bombOn === false, '…no fireworks on a door');
    ok(park.eWent, '…the little clouds use the doors too');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
    // inside the Claude app (a frame): 倾斜 is shown but greyed, with a word why
    const f = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
    const framed = path.join(SHOTS, 'framed.html'); fs.writeFileSync(framed, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${URL}" title="game"></iframe></body></html>`);
    await f.goto('file://' + framed); await sleep(1500);
    const fr = f.frames().find((x) => /kartbomb\.html/.test(x.url()));
    await fr.evaluate(() => { localStorage.removeItem('kb_kset'); }); await fr.click('[data-play="kart:1p"]'); await fr.waitForSelector('#msg:not([hidden]) [data-o="ctl:tilt"]');
    const fe = await fr.evaluate(() => ({ dis: document.querySelector('#msg [data-o="ctl:tilt"]').disabled, note: /要在 app 里玩/.test(document.querySelector('#msg .panel').textContent) }));
    ok(fe.dis && fe.note, 'inside the Claude app: 倾斜 is greyed out and the card says it works in the app');
    await f.context().close();
  }

  if (want('maps')) {
    console.log('\nB1. Every stage map is sound');
    const p = await page(browser);
    const r = await p.evaluate(() => __kb.PLACES.map((PL) => {
      __kb.close(); __kb.open('bomb', { mode: 'coop', place: PL.id, two: true }); const G = __kb.game; const GW = 13, GH = 11, at = (c, r) => G.grid[r * GW + c];
      const edge = [...Array(GW).keys()].every((c) => at(c, 0) === 1 && at(c, GH - 1) === 1) && [...Array(GH).keys()].every((r) => at(0, r) === 1 && at(GW - 1, r) === 1);
      const startsFree = [[1, 1], [2, 1], [1, 2], [11, 9], [10, 9], [11, 8]].every(([c, r]) => at(c, r) === 0);
      const [dc, dr] = G.test.doorCell;
      // what a burst can open is passable; walls, posts, lanterns and water are not
      const seen = new Set(['1,1']), q = [[1, 1]];
      while (q.length) { const [c, r] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c + dx, y = r + dy, v = at(x, y); if (v === 1 || v === 5 || v === 6 || seen.has(x + ',' + y)) continue; seen.add(x + ',' + y); q.push([x, y]); } }
      const reach = (c, r) => seen.has(c + ',' + r);
      const lanternsReachable = [...G.lanterns].every((k) => { const [c, r] = k.split(',').map(Number); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach(c + dx, r + dy)); });
      const turtles = [...G.turtles].every((k) => seen.has(k)), jelly = [...G.grid].filter((v) => v === 3).length;
      const enemiesReach = G.enemies.every((e) => reach(Math.floor(e.x), Math.floor(e.y)));
      const photos = [...G.loot.values()].filter((v) => v === 'photo').length, candies = [...G.loot.values()].filter((v) => v === 'candy').length;
      const apples = [...G.loot.entries()].filter(([k, v]) => v === 'apple' && G.grid[k.split(',')[1] * GW + +k.split(',')[0]] === 7).length;
      return { apples, need: PL.goal.n, item: PL.goal.item, id: PL.id, edge, startsFree, door: reach(dc, dr), lanterns: G.lanterns.size, lanternsReachable, turtles: G.turtles.size, turtlesReach: turtles, jelly, candies, enemies: G.enemies.length, enemiesReach, photos, ai: G.players.filter((x) => x.ai).length, goal: PL.goal.type };
    }));
    for (const m of r) {
      ok(m.edge && m.startsFree, `${m.id}: walled all round, both starts clear`);
      ok(m.door, `${m.id}: the little house's square can be reached`);
      ok(m.enemiesReach, `${m.id}: every monster can be reached (${m.enemies})`);
      ok(m.photos === 3, `${m.id}: three 📷 hidden in boxes`);
      if (m.goal === 'free') ok(m.turtles === 3 && m.turtlesReach, `${m.id}: three 🐢 boxes, all reachable`);
      if (m.goal === 'light') ok(m.lanterns === 4 && m.lanternsReachable, `${m.id}: four lanterns, each with a free side to burst next to`);
      if (m.goal === 'collect' && m.item === 'apple') ok(m.apples >= m.need, `${m.id}: ${m.apples} apples hidden in leaf piles, ${m.need} needed`);
      else if (m.goal === 'collect') ok(m.candies >= 10 && m.jelly === m.candies, `${m.id}: ${m.candies} candies in ${m.jelly} jellies, 10 needed`);
    }
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('stages')) {
    console.log('\nB2. The computer plays both of you through every stage (each must be beatable)');
    const p = await page(browser);
    for (const id of ['garden', 'beach', 'snow', 'candy', 'night']) {
      // two computers clear a maze 65–100% of the time, so "2 of 3" failed a third of full runs on perfectly beatable mazes;
      // beatable = 2 wins within 8 tries (stopping at the second) — a false alarm under 0.4% even for the hardest
      const runs = [];
      for (let run = 0; run < 8 && runs.filter((x) => x.how === 'win').length < 2; run++) {
        runs.push(await p.evaluate((id) => {
          __kb.close(); __kb.open('bomb', { mode: 'coop', place: id, two: true }); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true;
          G.test.setAI('cs', true); G.test.setAI('yy', true);
          let t = 0; while (t < 360 && G.state === 'play') { G.update(1 / 30); t += 1 / 30; }
          const res = { state: G.state, how: G.how, t: Math.round(t), combo: G.combo, photos: G.photos, downs: G.downs, door: !!G.door, goal: G.test.goalDone() };
          __kb.close(); return res;
        }, id));
      }
      const wins = runs.filter((x) => x.how === 'win').length;
      ok(wins >= 2, `${id}: won ${wins} of ${runs.length} tries (${runs.map((x) => `${x.how || 'still playing'} ${x.t}s 💞${x.combo} 📷${x.photos}`).join(' · ')})`);
    }
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('bmech')) {
    console.log('\nB3. 烟花炸弹 mechanics, one at a time');
    const p = await page(browser);
    const r = await p.evaluate(() => {
      const out = {}, step = (G, n) => { for (let i = 0; i < n; i++) G.update(1 / 60); };
      const open = (place, o = {}) => { __kb.close(); __kb.open('bomb', Object.assign({ mode: 'coop', place, two: true }, o)); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true; G.enemies.length = 0; if (G.boss) G.boss = null; for (const q of G.players) q.inv = 0; return G; };
      const clearRow = (G, r, c0, c1) => { for (let c = c0; c <= c1; c++) if (G.grid[r * 13 + c] !== 1) G.grid[r * 13 + c] = 0; };
      // a chain: one burst sets off the next
      let G = open('night'); clearRow(G, 1, 1, 9); G.players[0].x = 9.5; G.players[0].y = 9.5; G.players[1].x = 10.5; G.players[1].y = 9.5;
      G.bombs.push({ c: 3, r: 1, fx: 3.5, fy: 1.5, t: 0.05, range: 2, own: G.players[0] }, { c: 5, r: 1, fx: 5.5, fy: 1.5, t: 9, range: 2, own: G.players[0] }); step(G, 12); out.chain = G.bombs.length === 0;
      // 🌈 goes through boxes; a plain one stops at the first
      G = open('garden'); for (let c = 2; c <= 5; c++) G.grid[1 * 13 + c] = 2; out.plain = G.test.blast(1, 1, 4).filter(([c, r]) => r === 1 && c > 1).length; out.pierce = G.test.blast(1, 1, 4, true).filter(([c, r]) => r === 1 && c > 1).length;
      // 💞 bursts as a diamond
      out.love = G.test.blast(5, 5, 2, false, true).length;
      // a lantern lights when the fire touches it
      G = open('snow'); const lk = [...G.lanterns][0].split(',').map(Number); clearRow(G, lk[1] - 1, 1, 11); G.players.forEach((q) => { q.x = 1.5; q.y = 9.5; });
      G.bombs.push({ c: lk[0], r: lk[1] - 1, fx: lk[0] + 0.5, fy: lk[1] - 0.5, t: 0.02, range: 1, own: G.players[0] }); step(G, 5); out.lantern = G.lit.size;
      // a 🐢 box: burst it and a turtle goes home
      G = open('beach'); const tk = [...G.turtles][0].split(',').map(Number); G.players.forEach((q) => { q.x = 11.5; q.y = 9.5; }); if (tk[1] === 9) G.players.forEach((q) => { q.x = 1.5; q.y = 1.5; });
      G.flames.set(tk.join(','), { t: 0.5 }); G.grid[tk[1] * 13 + tk[0]] = 0; G.burning.push({ c: tk[0], r: tk[1], t: 0.02 }); step(G, 3); out.turtle = G.freed;
      // jelly: two bursts, then a candy that fire cannot burn
      G = open('candy'); const jI = [...G.grid].findIndex((v) => v === 3), jc = jI % 13, jr = Math.floor(jI / 13); G.players.forEach((q) => { q.x = 1.5; q.y = 1.5; }); if (jc <= 2 && jr <= 2) G.players.forEach((q) => { q.x = 11.5; q.y = 9.5; });
      const hit = () => { G.test.explode({ c: jc, r: jr, fx: jc + 0.5, fy: jr + 0.5, t: 0, range: 0, own: G.players[0] }); step(G, 40); };
      hit(); const after1 = G.grid[jI]; hit(); const after2 = G.grid[jI]; const item = G.items.get(jc + ',' + jr);
      G.test.explode({ c: jc, r: jr, fx: jc + 0.5, fy: jr + 0.5, t: 0, range: 0, own: G.players[0] }); step(G, 2);
      out.jelly = { after1, after2, item: item && item.k, survives: !!G.items.get(jc + ',' + jr) };
      // 默契: two of you, bursts at the same moment
      G = open('night'); G.players[0].x = 1.5; G.players[0].y = 1.5; G.players[1].x = 11.5; G.players[1].y = 9.5; G.players[0].cd = 9; G.players[1].cd = 9;
      G.bombs.push({ c: 3, r: 3, fx: 3.5, fy: 3.5, t: 0.02, range: 1, own: G.players[0] }, { c: 9, r: 7, fx: 9.5, fy: 7.5, t: 0.3, range: 1, own: G.players[1] }); step(G, 30);
      out.combo = { combo: G.combo, cd: [G.players[0].cd, G.players[1].cd], shells: G.shells.length + G.sparks.length };
      G.bombs.push({ c: 3, r: 3, fx: 3.5, fy: 3.5, t: 0.02, range: 1, own: G.players[0] }); step(G, 120); G.bombs.push({ c: 9, r: 7, fx: 9.5, fy: 7.5, t: 0.02, range: 1, own: G.players[1] }); step(G, 30); out.notCombo = G.combo;
      // the little house needs both of you
      G = open('garden'); G.enemies.length = 0; step(G, 2); const [dc, dr] = G.test.doorCell; G.players[0].x = dc + 0.5; G.players[0].y = dr + 0.5; step(G, 60); const oneIn = G.state; G.players[1].x = dc + 0.5; G.players[1].y = dr + 0.5; step(G, 10);
      out.door = { opened: !!G.door, oneIn, both: G.state, how: G.how };
      // a fallen partner is picked up by walking over
      G = open('garden'); const [a, b] = G.players; a.hearts = 1; a.x = 3.5; a.y = 1.5; G.flames.set('3,1', { t: 0.5 }); step(G, 2); const downed = a.state; G.flames.clear(); b.x = 3.5; b.y = 1.5; step(G, 10); out.revive = { downed, after: a.state, hearts: a.hearts };
      // ice: you keep sliding until something stops you
      G = open('snow'); const ii = [...G.ice].findIndex((v, i) => v && G.grid[i] === 0 && G.ice[i + 1] && G.grid[i + 1] === 0); const ic = ii % 13, ir = Math.floor(ii / 13);
      G.players[0].x = ic - 0.5; G.players[0].y = ir + 0.5; if (G.grid[ir * 13 + ic - 1]) G.grid[ir * 13 + ic - 1] = 0; __kb.IN.cs.dirs = ['r']; step(G, 18); __kb.IN.cs.dirs = []; const x1 = G.players[0].x; step(G, 30); out.ice = { slid: G.players[0].x - x1 };
      // 闷闷: three bursts under it; its rain shows 1.3 s before it falls
      G = open('night'); G.boss = { x: 6.5, y: 5.5, tx: 6.5, ty: 5.5, hp: 3, inv: 0, t: 0, nextRain: 99, nextCall: 99, move: 99, hurtT: 0 }; G.players.forEach((q) => { q.x = 1.5; q.y = 1.5; });
      for (let i = 0; i < 3; i++) { G.flames.set('6,5', { t: 0.5, cen: true }); step(G, 100); }
      out.boss = { hp: G.boss.hp, gone: G.boss.gone !== undefined };
      G = open('night'); G.boss = { x: 6.5, y: 5.5, tx: 6.5, ty: 5.5, hp: 3, inv: 0, t: 0, nextRain: 0.01, nextCall: 99, move: 99, hurtT: 0 }; const pz = G.players[0]; pz.x = 3.5; pz.y = 3.5; G.players[1].x = 3.5; G.players[1].y = 3.5;
      step(G, 2); const telegraph = G.rains.length && G.rains[0].t > 1; const h0 = pz.hearts; step(G, 60); const stillFine = pz.hearts === h0; step(G, 40); out.rain = { telegraph, stillFine, hit: pz.hearts < h0 || G.players[1].hearts < 3 };
      __kb.close(); return out;
    });
    ok(r.chain, 'a burst sets off the firework next to it');
    ok(r.plain === 1 && r.pierce === 4, `🌈 goes through boxes (${r.pierce} squares) where a plain one stops at the first (${r.plain})`);
    ok(r.love === 13, `💞 bursts as a diamond of 13 squares (${r.love})`);
    ok(r.lantern === 1, 'fire next to an ice lantern lights it');
    ok(r.turtle === 1, 'bursting a 🐢 box lets a turtle go home');
    ok(r.jelly.after1 === 4 && r.jelly.after2 === 0 && r.jelly.item === 'candy' && r.jelly.survives, `jelly takes two bursts and leaves a candy that fire cannot burn (${JSON.stringify(r.jelly)})`);
    ok(r.combo.combo === 1 && r.combo.cd.every((x) => x === 0) && r.combo.shells > 0, `two bursts together are a 默契: the pets are ready again and a heart goes up (${JSON.stringify(r.combo)})`);
    ok(r.notCombo === 1, 'two bursts two seconds apart are not');
    ok(r.door.opened && r.door.oneIn === 'play' && r.door.how === 'win', 'the little house opens when the goal is done, and only both of you inside ends the stage');
    ok(r.revive.downed === 'down' && r.revive.after === 'ok' && r.revive.hearts === 1, 'a fallen partner gets up when the other walks over them');
    ok(r.ice.slid > 0.3, `on ice you keep sliding after letting go (${r.ice.slid.toFixed(2)})`);
    ok(r.boss.hp === 0 && r.boss.gone, '闷闷 goes after three bursts');
    ok(r.rain.telegraph && r.rain.stillFine && r.rain.hit, '闷闷\'s rain shows its dashes first, and only then hurts');
    // the pets again, after the rewrite
    const pets = await p.evaluate(() => {
      const out = {}, step = (G, n) => { for (let i = 0; i < n; i++) G.update(1 / 60); };
      const fresh = (pet) => { __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'garden', two: true, pets: { cs: pet, yy: 'bear' } }); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true; G.enemies.length = 0; return G; };
      let G = fresh('dog'); G.items.set('9,8', { k: 'range', born: 0 }); const cs = G.players[0], r0 = cs.range; __kb.IN.cs.skillHit = 1; step(G, 150); out.dog = cs.range === r0 + 1;
      G = fresh('cat'); const c2 = G.players[0]; c2.x = 1.5; c2.y = 1.5; for (const c of [2, 3, 4]) G.grid[13 + c] = 0; G.bombs.push({ c: 2, r: 1, fx: 2.5, fy: 1.5, t: 9, range: 2, own: G.players[1], kick: null }); __kb.IN.cs.dirs = ['r']; step(G, 40); __kb.IN.cs.dirs = []; step(G, 30); out.cat = G.bombs[0].c >= 3;
      G = fresh('bunny'); const c3 = G.players[0]; c3.x = 1.5; c3.y = 1.5; c3.dir = [1, 0]; G.grid[13 + 2] = 2; G.grid[13 + 3] = 0; __kb.IN.cs.skillHit = 1; step(G, 40); out.bunny = Math.floor(c3.x) === 3;
      G = fresh('bear'); const c4 = G.players[0], y4 = G.players[1]; y4.x = 2.5; y4.y = 1.5; c4.inv = y4.inv = 0; __kb.IN.cs.skillHit = 1; step(G, 2); G.flames.set('1,1', { t: 0.5 }); G.flames.set('2,1', { t: 0.5 }); step(G, 5); out.bear = c4.hearts === 4 && y4.hearts === 4;
      __kb.close(); return out;
    });
    ok(pets.dog && pets.cat && pets.bunny && pets.bear, `the four pets still do their jobs (${JSON.stringify(pets)})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('vs')) {
    console.log('\nB4. 对战: the computer against the computer finishes rounds');
    const p = await page(browser);
    const r = await p.evaluate(() => {
      const res = [];
      for (let i = 0; i < 10; i++) {
        __kb.close(); __kb.open('bomb', { mode: 'vs', place: ['garden', 'beach', 'snow', 'candy', 'night'][i % 5], two: true }); const G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true;
        G.test.setAI('cs', true); G.test.setAI('yy', true);
        let t = 0; while (t < 150 && G.state === 'play') { G.update(1 / 30); t += 1 / 30; }
        res.push((G.how || 'none') + '@' + Math.round(t));
      }
      __kb.close(); return res;
    });
    const ended = r.filter((x) => !x.startsWith('none')).length;
    ok(ended >= 7, `${ended}/10 rounds end inside 150 s (${r.join(' ')})`);
    // the rounds: best of three through the result cards
    await p.evaluate(() => { __kb.open('bomb', { mode: 'vs', place: 'garden', two: true }); }); await p.waitForSelector('#msg:not([hidden]) [data-m="go"]'); await p.click('#msg [data-m="go"]');
    for (let i = 0; i < 2; i++) {
      await p.evaluate(() => { const G = __kb.game; G.players[1].hearts = 1; G.players[1].inv = 0; G.flames.set(Math.floor(G.players[1].x) + ',' + Math.floor(G.players[1].y), { t: 0.5 }); for (let n = 0; n < 100; n++) G.update(1 / 60); });
      await p.waitForSelector('#msg:not([hidden]) .panel', { timeout: 4000 });
      const txt = await p.evaluate(() => document.querySelector('#msg .panel').textContent);
      if (i === 0) { ok(/CS 赢了这一局/.test(txt) && /下一局/.test(txt), 'round 1 to CS, then 下一局'); await p.click('#msg [data-m="next"]'); await sleep(200); ok(await p.evaluate(() => __kb.game.round === 2 && __kb.game.state === 'play'), 'round 2 starts without the card'); }
      else ok(/CS 赢了三局两胜/.test(txt), 'two rounds to CS: the match is CS\'s');
    }
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  if (want('e2eb')) {
    console.log('\nB5. 烟花炸弹 end to end: the cards, the pets, keys on a laptop, the stick on a phone');
    const p = await page(browser, { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1 });
    await p.click('#bomb-places [data-bp="snow"]'); await p.click('[data-play="bomb:coop"]');
    await p.waitForSelector('#msg:not([hidden]) [data-m="2"]'); await p.click('#msg [data-m="2"]');
    await p.waitForSelector('#msg:not([hidden]) [data-pet="cs:cat"]');
    ok(await p.evaluate(() => /冰灯/.test(document.querySelector('#msg .panel').textContent)), 'the card says what this stage is about (冰灯)');
    await p.click('#msg [data-pet="cs:cat"]'); await p.click('#msg [data-pet="yy:bunny"]'); await sleep(100);
    ok(await p.evaluate(() => /喵喵/.test(document.querySelector('#msg .panel').textContent) && /跳跳/.test(document.querySelector('#msg .panel').textContent)), 'picking pets shows what each one does');
    await p.click('#msg [data-m="go"]'); await sleep(200);
    const pets = await p.evaluate(() => __kb.game.players.map((q) => q.pet + (q.ai ? '-ai' : '')).join(','));
    ok(pets === 'cat,bunny', `both of you play, with the pets you chose (${pets})`);
    await p.evaluate(() => { const G = __kb.game; G.enemies.length = 0; });
    const x0 = await p.evaluate(() => __kb.game.players[0].x);
    await p.keyboard.down('KeyD'); await sleep(500); await p.keyboard.up('KeyD');
    ok(await p.evaluate((x0) => __kb.game.players[0].x > x0 + 0.5, x0), 'D walks CS right');
    await p.keyboard.press('Space'); await sleep(50);
    ok(await p.evaluate(() => __kb.game.bombs.length === 1), 'Space puts a firework down');
    await p.keyboard.down('KeyA'); await sleep(450); await p.keyboard.up('KeyA'); await p.keyboard.down('KeyS'); await sleep(450); await p.keyboard.up('KeyS');
    await p.keyboard.press('Period'); await sleep(100);
    ok(await p.evaluate(() => __kb.game.players[1].cd > 0 || __kb.game.players[1].hop), '. uses YY\'s pet skill (the bunny hops)');
    await p.keyboard.down('ArrowLeft'); await sleep(400); await p.keyboard.up('ArrowLeft');
    ok(await p.evaluate(() => __kb.game.players[1].x < 11.3), '← walks YY');
    await sleep(2600);
    ok(await p.evaluate(() => __kb.game.players[0].state === 'ok'), 'CS walked out of the firework\'s way in time');
    await p.keyboard.press('KeyP'); await sleep(150);
    ok(await p.evaluate(() => __kb.game.paused && !document.getElementById('msg').hidden), 'P pauses');
    await p.click('#msg [data-m="go"]'); await sleep(100);
    await p.screenshot({ path: SHOTS + '/t_e2eb_laptop.png' });
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
    const m = await page(browser);
    await m.click('[data-play="bomb:coop"]'); await m.waitForSelector('#msg:not([hidden]) [data-m="1"]'); await m.click('#msg [data-m="1"]');
    await m.waitForSelector('#msg:not([hidden]) [data-m="go"]');
    ok(await m.evaluate(() => /由电脑陪你/.test(document.querySelector('#msg .panel').textContent)), 'alone, the card says the computer plays your partner');
    await m.click('#msg [data-m="go"]'); await sleep(200);
    ok(await m.evaluate(() => __kb.game.players.filter((q) => q.ai).length === 1), '…and it does');
    await m.evaluate(() => { __kb.game.enemies.length = 0; });
    const z = await m.evaluate(() => { const r = document.querySelector('.dz .dzb.r').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const before = await m.evaluate(() => __kb.game.players.find((q) => q.human).x);
    await m.evaluate(([x, y]) => document.querySelector('.dz').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 21, clientX: x, clientY: y, bubbles: true })), z);
    await sleep(500);
    ok(await m.evaluate((b) => __kb.game.players.find((q) => q.human).x > b + 0.5, before), 'holding ▶ on the 方向键 walks you');
    await m.evaluate(([x, y]) => document.querySelector('.dz').dispatchEvent(new PointerEvent('pointerup', { pointerId: 21, clientX: x, clientY: y, bubbles: true })), z);
    await m.evaluate(() => { const b = document.querySelector('[data-k="bomb"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 22, bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 22, bubbles: true })); }); await sleep(50);
    ok(await m.evaluate(() => __kb.game.bombs.some((b) => b.own.human)), '💥 puts a firework down');
    await m.evaluate(() => { const b = document.querySelector('[data-k="skill"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 23, bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 23, bubbles: true })); }); await sleep(80);
    ok(await m.evaluate(() => { const q = __kb.game.players.find((x) => x.human); return q.cd > 0 || q.shield > 0 || q.hop; }), 'the pet button uses the skill, and shows its cooldown');
    await m.screenshot({ path: SHOTS + '/t_e2eb_phone.png' });
    ok(!m.errs.length, 'no page errors ' + m.errs.join(' | '));
    await m.context().close();
  }

  if (want('ui')) {
    console.log('\nG1. The page at every width, light and dark');
    for (const w of [360, 390, 430, 820, 1280]) for (const scheme of ['light', 'dark']) {
      const p = await page(browser, { viewport: { width: w, height: 900 }, colorScheme: scheme, isMobile: w < 800, hasTouch: w < 800 });
      const r = await p.evaluate(() => {
        const small = [...document.querySelectorAll('.wrap button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.textContent.trim().slice(0, 10));
        const blank = ['#pv-kart', '#pv-bomb'].filter((id) => { const c = document.querySelector(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 400) { s += d[i]; s2 += d[i] * d[i]; n++; } const m = s / n; return s2 / n - m * m < 50; });
        return { over: document.documentElement.scrollWidth - innerWidth, small, blank, bg: getComputedStyle(document.body).backgroundColor };
      });
      ok(r.over <= 0 && !r.small.length && !r.blank.length, `${w}px ${scheme}: no sideways scroll (${r.over}), no button under 44px (${r.small.join(',')}), both previews drawn${r.blank.length ? ' — blank: ' + r.blank : ''}`);
      if (w === 390) await p.screenshot({ path: `${SHOTS}/t_page_${scheme}.png`, fullPage: true });
      ok(!p.errs.length, `${w}px ${scheme}: no page errors ` + p.errs.join(' | '));
      await p.context().close();
    }
  }

  if (want('layout')) {
    console.log('\nG2. In the games: everything on the screen, nothing under the thumbs');
    const sizes = [[360, 740], [390, 844], [430, 932], [844, 390], [820, 1180], [1280, 800]];
    for (const [w, h] of sizes) {
      const mob = w < 1000;
      const p = await page(browser, { viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob });
      for (const [kind, o] of [['kart', { mode: '1p', place: 'night', skipCard: true }], ['kart', { mode: '2p', place: 'sakura', skipCard: true }], ['bomb', { mode: 'coop', place: 'candy', two: false }], ['bomb', { mode: 'coop', place: 'beach', two: true }]]) {
        await p.evaluate(([k, o]) => { __kb.close(); __kb.open(k, o); }, [kind, o]); await sleep(150);
        if (kind === 'bomb') { await p.click('#msg [data-m="go"]'); await sleep(120); }
        else await p.evaluate(() => { __kb.game.count = 1.5; __kb.game.update(0.01); });
        await sleep(150);
        const r = await p.evaluate(() => {
          const G = __kb.game, vw = innerWidth, vh = innerHeight;
          const ctl = [...document.querySelectorAll('#pad .pb, #pad .jz, #pad .sz, #pad .bzb, #pad .dzb, #pad .tw, .tb')].map((e) => e.getBoundingClientRect());
          const offscreen = ctl.filter((b) => b.left < -1 || b.top < -1 || b.right > vw + 1 || b.bottom > vh + 1).length;
          const small = [...document.querySelectorAll('#pad .pb, #pad .bzb, #pad .dzb, .tb')].filter((e) => e.getBoundingClientRect().height < 42).length;
          let board = null, under = 0;
          if (G.kind === 'bomb') { const L = G.lay, top = L.y, bot = L.y + L.bh + 11 * L.rd, left = L.x, right = L.x + 13 * L.cs; board = { top, bot, left, right }; under = [...document.querySelectorAll('#pad .pb, #pad .jz, #pad .dzb')].filter((e) => { const b = e.getBoundingClientRect(); return b.left < right - 4 && b.right > left + 4 && b.top < bot - 4 && b.bottom > top + 4; }).length; }
          return { offscreen, small, board, under, inside: !board || (board.top >= 0 && board.left >= 0 && board.right <= vw && board.bot <= vh), n: ctl.length };
        });
        ok(!r.offscreen && !r.small && r.inside && !r.under, `${w}×${h} ${kind} ${o.mode}${o.two ? '·2' : ''}: ${r.n} controls all on screen and ≥ 42px${r.board ? `, the maze fully visible and no button over it (${r.under})` : ''}`);
        if ((w === 390 || w === 844) && !(kind === 'kart' && o.mode === '1p' && w === 844)) await p.screenshot({ path: `${SHOTS}/t_layout_${w}_${kind}_${o.mode}${o.two ? 2 : ''}.png` });
      }
      ok(!p.errs.length, `${w}×${h}: no page errors ` + p.errs.join(' | '));
      await p.context().close();
    }
  }

  if (want('perf')) {
    console.log('\nG3. Frame rate with the CPU slowed 4× (390×844 at 3×, like a phone)');
    for (const [label, kind, o, sz] of [['kart, 星空夜路', 'kart', { mode: '1p', place: 'night', skipCard: true }, [390, 844]], ['kart, two people', 'kart', { mode: '2p', place: 'sakura', skipCard: true }, [844, 390]], ['烟花炸弹, 闷闷 and fireworks', 'bomb', { mode: 'coop', place: 'night', two: true }, [390, 844]], ['烟花炸弹, 糖果屋', 'bomb', { mode: 'coop', place: 'candy', two: false }, [390, 844]]]) {
      const p = await page(browser, { viewport: { width: sz[0], height: sz[1] }, deviceScaleFactor: 3 });
      const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await p.evaluate(([k, o]) => __kb.open(k, o), [kind, o]); await sleep(400);
      if (kind === 'bomb') { await p.click('#msg [data-m="go"]'); await p.evaluate(() => { const G = __kb.game; G.test.setAI('cs', true); G.test.setAI('yy', true); }); }
      else await p.evaluate(() => { const G = __kb.game; G.count = 0.01; for (const k of G.karts) k.human = false; G.humans.forEach(() => {}); });
      await sleep(1500);
      const fps = await p.evaluate(() => new Promise((res) => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = (t) => { worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 4000) requestAnimationFrame(f); else res({ fps: n / ((t - t0) / 1000), worst }); }; requestAnimationFrame(f); }));
      ok(fps.fps >= 40, `${label}: ${fps.fps.toFixed(0)} fps, worst frame ${fps.worst.toFixed(0)} ms`);
      ok(!p.errs.length, `${label}: no page errors ` + p.errs.join(' | '));
      await p.context().close();
    }
  }

  if (want('motion')) {
    console.log('\nG4. Reduced motion');
    const p = await page(browser, { reducedMotion: 'reduce' });
    const r = await p.evaluate(() => {
      __kb.open('kart', { mode: '1p', place: 'snow', skipCard: true }); let G = __kb.game; G.count = 0.01; for (let i = 0; i < 120; i++) G.update(1 / 60); const flakes = G.flakes.length;
      __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'night', two: true }); G = __kb.game; G.paused = false; G.state = 'play'; document.getElementById('msg').hidden = true; G.test.setAI('cs', true); G.test.setAI('yy', true);
      let shook = 0; for (let i = 0; i < 600; i++) { G.update(1 / 60); if (G.shake > 0) shook++; } const shells = G.shells.length + G.sparks.length;
      __kb.close(); return { flakes, shook, shells };
    });
    ok(r.flakes === 0 && r.shook === 0 && r.shells === 0, `no snow drifting, no shaking, no fireworks in the sky (${JSON.stringify(r)})`);
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await p.context().close();
  }

  await browser.close();

  if (want('webkit')) {
    console.log('\nG5. Safari\'s engine (WebKit)');
    const dir = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('webkit-')).sort().pop();
    if (!dir) ok(false, 'WebKit is installed');
    else {
      const wk = await webkit.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', dir, 'pw_run.sh') }).catch((e) => { console.log('  (WebKit would not start: ' + e.message.split('\n')[0] + ')'); return null; });
      if (wk) {
        const p = await page(wk);
        const r = await p.evaluate(async () => {
          __kb.open('kart', { mode: '1p', place: 'beach', skipCard: true }); __kb.game.count = 0.01; await new Promise((r) => setTimeout(r, 2500)); const kart = __kb.game.t > 1;
          __kb.close(); __kb.open('bomb', { mode: 'coop', place: 'garden', two: true }); await new Promise((r) => setTimeout(r, 300)); document.querySelector('#msg [data-m="go"]').click(); const G = __kb.game; G.test.setAI('cs', true); G.test.setAI('yy', true);
          await new Promise((r) => setTimeout(r, 2500)); return { kart, bomb: G.t > 1, bombs: G.bombs.length + G.flames.size };
        });
        ok(r.kart && r.bomb, `both games run in WebKit (${JSON.stringify(r)})`);
        await p.screenshot({ path: SHOTS + '/t_webkit.png' });
        ok(!p.errs.length, 'no page errors in WebKit ' + p.errs.join(' | '));
        await wk.close();
      }
    }
  }

  console.log(`\n${pass} passed, ${fail} failed${fails.length ? '\n  ' + fails.join('\n  ') : ''}`);
  process.exit(fail ? 1 : 0);
})();
