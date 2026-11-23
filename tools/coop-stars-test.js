// Can every ⭐ and 💗 in 一起回家 be taken — and without a frame-perfect jump? (CLAUDE.md §7.33)
// Reported 2026-11-24: "some star very hard to take and can't take even both jump". Seven stars hung 9–10
// tiles up where nothing reaches, five more needed a perfect jump. This tries every way with the real
// physics, in the page: a jump from every ledge within 5 tiles, a jump from the partner's head (every pair
// that can stand there), springs, updrafts, rafts and wheel cabins, lifts — first as the level is, then with
// the partner holding every button (bridges, fans, gates on). "Comfortable" = still taken with a jump 10%
// weaker than the strongest, which is what a thumb on glass manages.
//   python3 -m http.server 8765   (or APP_URL=http://localhost:PORT/index.html)
//   node tools/coop-stars-test.js
const { chromium } = require('/Users/ycs/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage();
  await p.goto(process.env.APP_URL || 'http://localhost:8765/index.html'); await p.waitForFunction(() => typeof App !== 'undefined');
  await p.evaluate(() => App.demoMode()); await new Promise(r => setTimeout(r, 800));
  await p.evaluate(() => App.openCoop('home')); await p.waitForSelector('.cg-lv');
  let res = await p.evaluate(() => {
    const T = CoopGames.test, G = T.G, out = [];
    const tryIt = (it, setup, weak) => {   // setup puts the players somewhere; returns true if the item gets taken
      it.got = false; G.stars = [false, false, false];
      const jumper = setup(); if (jumper == null) return false;
      let k = 0, airborne = false;
      for (; k < 220; k++) {
        const p = G.players[jumper], dx = it.x - (p.x + p.w / 2);
        T.inp(jumper, { j: k < 100, l: dx < -0.1, r: dx > 0.1 });   // held to the top (a jump in the water takes longer) T.inp(1 - jumper, {});
        T.stepFn(T.STEP);
        if (!airborne && !p.grounded && p.vy < 0) { airborne = true; if (weak) p.vy *= 0.9; }
        if (it.got) return true;
        if (p.dead) return false;
      }
      return false;
    };
    for (let i = 0; i < T.LEVELS.length; i++) {
      T.start(i, 'duo'); T.set('god', true);
      const L = G.L, w = L.w, H = 1.18, W = 0.78;
      const stand = (c, r, who) => (T.solidCell(c, r, who) || T.oneWayCell(c, r)) && !T.solidCell(c, r - 1, who) && !T.solidCell(c, r - 2, who);
      L.spec = Object.assign({}, L.spec, { chase: null });   // the storm would shove the testers away
      const items = L.items.filter(it => it.type === 'star' || it.type === 'heart');
      for (const it of items) {
        let how = null, comfy = false;
        for (const pass of [[false, true], [true, true], [false, false], [true, false]]) {   // comfortable first (with/without buttons), then perfect
          const [force, weakPass] = pass;
          G.forceChan = force; if (force) G.latch.fill(1); else G.latch.fill(0);
          for (let k = 0; k < 3; k++) T.stepFn(T.STEP);
          const spots = [];
          for (let c = Math.floor(it.x) - 5; c <= Math.floor(it.x) + 5; c++) for (let r = Math.ceil(it.y); r <= 12; r++) for (const who of [0, 1]) if (c >= 0 && c < w && stand(c, r, who ? 'yy' : 'cs')) spots.push([c, r, who]);
          const far = (j) => T.tp(j, L.spawn[j].x, L.spawn[j].y);
          for (const weak of [weakPass]) {
            for (const [c, r, who] of spots) {
              const x = c + 0.5 - W / 2, y = r - H;
              if (tryIt(it, () => { far(1 - who); T.tp(who, x, y); for (let k = 0; k < 6; k++) { T.inp(who, {}); T.stepFn(T.STEP); } return G.players[who].grounded ? who : null; }, weak)) { how = 'jump'; break; }
              // who stands at the bottom; the other jumps from their head
              if (tryIt(it, () => { T.tp(who, x, y); T.tp(1 - who, x, y - H - 0.05); for (let k = 0; k < 20; k++) { T.inp(0, {}); T.inp(1, {}); T.stepFn(T.STEP); } const q = G.players[1 - who]; return q.grounded && q.ground && q.ground.kind === 'player' ? 1 - who : null; }, weak)) { how = 'stack'; break; }
            }
            if (how) { comfy = weak; break; }
          }
          if (!how && !weakPass) for (const s2 of L.springs) if (Math.abs(s2.x0 + 0.5 - it.x) < 6) if (tryIt(it, () => { far(1); T.tp(0, s2.x0 + 0.1, s2.y - H - 0.4); return 0; }, false)) { how = 'spring'; comfy = true; break; }
          if (!how && !weakPass) for (const f of L.fans) if (Math.abs(f.c + 0.5 - it.x) < 5) if (tryIt(it, () => { far(1); T.tp(0, f.c + 0.11, f.r + 1 - H - 0.02); return 0; }, false)) { how = 'wind'; comfy = true; break; }
          if (!how && !weakPass) for (const m of L.movers) {
            for (let ph = 0; ph < 12 && !how; ph++) {
              G.wt = ph / 12 * (m.period || 12); if (m.wheel) m.wheel.ang = ph / 12 * Math.PI * 2;
              T.stepFn(T.STEP);
              if (Math.abs(m.x + m.w / 2 - it.x) > 5 || m.y < it.y) continue;
              if (tryIt(it, () => { far(1); T.tp(0, m.x + m.w / 2 - W / 2, m.y - H - 0.02); return 0; }, false)) { how = 'ride'; comfy = true; }
            }
            if (how) break;
          }
          if (!how && !weakPass) for (const e of L.elevs) if (Math.abs(e.x0 + 1.5 - it.x) < 5) {   // a lift held up
            for (let k = 0; k < 400; k++) T.stepFn(T.STEP);
            if (tryIt(it, () => { far(1); T.tp(0, e.x0 + 1.1, e.y - H - 0.02); return 0; }, false)) { how = 'lift'; comfy = true; break; }
          }
          if (how) { how += force ? '+button' : ''; break; }
        }
        G.forceChan = false; it.got = false;
        if (it.type === 'star' || !how || !comfy) out.push({ lv: i, name: T.LEVELS[i].name, type: it.type, n: it.n, x: +it.x.toFixed(1), y: +it.y.toFixed(1), chunk: L.chunks[L.chunkOf[Math.floor(it.x)]].ch.id, how: how || 'NONE', comfy });
      }
      T.closeStage();
    }
    return { out, levels: T.LEVELS.length };
  });
  const nLv = res.levels; res = res.out;
  const stars = res.filter(r => r.type === 'star'), badStars = stars.filter(r => r.how === 'NONE'), tight = stars.filter(r => r.how !== 'NONE' && !r.comfy);
  const badHearts = res.filter(r => r.type === 'heart' && r.how === 'NONE');
  console.log(`stars: ${stars.length}, unreachable ${badStars.length}, only at a perfect jump ${tight.length}; hearts unreachable ${badHearts.length}`);
  for (const r of badStars) console.log(`  ✗ STAR  ${r.lv} ${r.name} #${r.n} @${r.chunk} (${r.x},${r.y})`);
  for (const r of tight) console.log(`  ~ star  ${r.lv} ${r.name} #${r.n} @${r.chunk} (${r.x},${r.y}) only by a perfect ${r.how}`);
  for (const r of badHearts) console.log(`  ✗ heart ${r.lv} ${r.name} @${r.chunk} (${r.x},${r.y})`);
  console.log('ways:', JSON.stringify(stars.reduce((m, r) => (m[r.how + (r.comfy ? '' : '!')] = (m[r.how + (r.comfy ? '' : '!')] || 0) + 1, m), {})));
  const ok = (c, m) => console.log(c ? '  ✅' : '  ❌', m);
  ok(stars.length >= 3 * nLv, `every level has its three stars (${stars.length} in ${nLv} levels)`);
  ok(!badStars.length, `every star can be taken (${badStars.length} cannot)`);
  ok(!tight.length, `none needs a perfect jump (${tight.length} do)`);
  ok(!badHearts.length, `every heart can be taken (${badHearts.length} cannot)`);
  const fails = (stars.length >= 3 * nLv ? 0 : 1) + (badStars.length ? 1 : 0) + (tight.length ? 1 : 0) + (badHearts.length ? 1 : 0);
  console.log(`\n${4 - fails} passed, ${fails} failed`);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
