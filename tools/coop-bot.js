// The co-op play-tester: drives CS and YY through a level of 一起回家 on the real
// physics, one fixed step at a time, solving each chunk the way two people would.
// Loaded into the page by tools/coop-test.js; talks to CoopGames.test.
(() => {
const C = Object.assign({}, window.CoopGames.test, { close: window.CoopGames.test.closeStage }), G = C.G;
const IN = [{}, {}];
let steps = 0, log = [];
const P = (i) => G.players[i], cx = (p) => p.x + p.w / 2;
function apply() {
  if (G.mode === 'solo') { const a = IN[G.active] || {}; C.inp(0, { l: !!a.l, r: !!a.r, j: !!a.j }); }
  else { C.inp(0, { l: !!IN[0].l, r: !!IN[0].r, j: !!IN[0].j }); C.inp(1, { l: !!IN[1].l, r: !!IN[1].r, j: !!IN[1].j }); }
}
const over = () => G.state === 'won' || G.state === 'result' || G.state === 'fail' || G.state === 'dying';
const ring = [];
function tick() { apply(); C.stepFn(C.STEP); steps++; if (steps % 20 === 0) { ring.push(steps + ': ' + G.players.map((p, i) => `${'AB'[i]} ${p.x.toFixed(2)},${p.y.toFixed(2)}${p.grounded ? 'g:' + (p.ground && p.ground.kind) : ''}${p.dead > 0 ? ' DEAD' : ''} in=${JSON.stringify(IN[i])}`).join(' | ') + ` hp${G.hp} chan${Array.from(G.chanOn).join('')}`); if (ring.length > (window.__ringN || 14)) ring.shift(); } return !over(); }
function until(cond, fn, max = 3000) {
  for (let k = 0; k < max; k++) { if (cond()) return true; fn(); if (!tick()) return cond(); }
  return false;
}
function wait(n) { for (let k = 0; k < n; k++) { IN[0] = {}; IN[1] = {}; if (!tick()) return; } }
function supportAt(x, feet, who) {
  const c = Math.floor(x);
  for (const r of [Math.floor(feet + 0.02)]) if (C.solidCell(c, r, who) || C.oneWayCell(c, r)) return true;
  for (const s of G.L.surfs) if (s.kind !== 'spring' && x >= s.x0 - 0.1 && x <= s.x1 + 0.1 && Math.abs(C.surfTop(s, x) - feet) < 0.5) return true;
  return false;
}
function supportBelow(x, feet, who, depth) {
  const c = Math.floor(x);
  for (let r = Math.floor(feet + 0.02); r <= Math.floor(feet + depth); r++) if (r < 13 && (C.solidCell(c, r, who) || C.oneWayCell(c, r))) return true;
  return false;
}
function runInput(i, tx, tol = 0.18) {
  const p = P(i), who = p.k, x = cx(p), dir = Math.sign(tx - x), inp = { l: dir < 0, r: dir > 0, j: false };
  if (p.dead) return {};
  if (Math.abs(tx - x) < tol) return { j: false };
  if (!p.grounded) {
    inp.j = p.vy < 0;
    // aiming for a raft: stay over its middle (but never steer back to the one just left)
    let raft = null, rd = 2.6;
    for (const m of G.L.movers) { if (m === LR[i]) continue; const mid = (m.x0 + m.x1) / 2, d = Math.abs(mid - x); if (d < rd && m.y > p.y + p.h - 0.3 && m.y < p.y + p.h + 5) { rd = d; raft = m; } }
    if (raft) { AIM[i] = null; const mid = (raft.x0 + raft.x1) / 2 + raft.dx / C.STEP * 0.12, dx = mid - x; return { l: dx < -0.25, r: dx > 0.25, j: inp.j }; }
    const aim = AIM[i];
    if (aim) {
      const dx = aim.x - x, want = clamp(dx * 5, -RUNV, RUNV);
      return { l: p.vx > want + 0.6, r: p.vx < want - 0.6, j: inp.j };
    }
    return inp;
  }
  const feet = p.y + p.h, ax = x + dir * (p.w / 2 + 0.35);
  if (G.L.jets && G.L.jets.length) {   // a fire vent just ahead: wait until it has just gone out (not when it is about to flare)
    const front = dir > 0 ? p.x + p.w : p.x;
    for (const j of G.L.jets) {
      const inCol = p.x + p.w > j.c + 0.2 && p.x < j.c + 0.8, ahead = dir > 0 ? j.c + 0.2 - front : front - (j.c + 0.8);
      if (!inCol && ahead > -0.05 && ahead < 0.5 && feet > j.top && p.y < j.r && jetSoon(j, 0.45)) return {};
    }
  }
  const onMover = p.ground && (p.ground.kind === 'mover');
  if (onMover) {
    const m = p.ground.ref, front = dir > 0 ? p.x + p.w : p.x;
    // next thing to stand on ahead
    let best = null;
    for (let c = Math.floor(front) + dir, k = 0; k < 6; k++, c += dir) for (let r = Math.max(0, Math.floor(feet - 3.5)); r <= Math.min(12, Math.floor(feet + 3)); r++) {
      if ((C.solidCell(c, r, who) || C.oneWayCell(c, r)) && !C.solidCell(c, r - 1, who)) { const d = dir > 0 ? c - front : front - (c + 1); if (!best || d < best) best = d; }
    }
    for (const s of G.L.movers) if (s !== m) { const d = dir > 0 ? s.x0 - front : front - s.x1; const t = s.y; if (d > -0.3 && t > feet - 3.4 && t < feet + 2.5 && (!best || d < best)) best = Math.max(0, d); }
    if (best != null && best < 3.4) return { l: dir < 0, r: dir > 0, j: true };
    const spot = dir > 0 ? m.x1 - 0.55 : m.x0 + 0.55;   // wait at the front of the raft
    return { l: x > spot + 0.15, r: x < spot - 0.15, j: false };
  }
  let wall = false;
  for (let r = Math.floor(p.y + 0.05); r <= Math.floor(feet - 0.05); r++) if (C.solidCell(Math.floor(ax), r, who)) wall = true;
  for (const b of G.L.boxes) if (ax > b.x - 0.05 && ax < b.x + b.w + 0.05 && feet > b.y + 0.1 && p.y < b.y + b.h) wall = true;
  let edge = !supportAt(ax, feet, who) && !supportBelow(ax, feet, who, 1.3);
  let foe = false;
  for (const e of G.L.enemies) if (!e.dead && (e.type === 'p' || e.type === 'n' || e.type === 'a') && Math.abs(e.y + e.h - feet) < 1.6 && (e.x + e.w / 2 - x) * dir > 0 && Math.abs(e.x + e.w / 2 - x) < 2.1) foe = true;
  if (edge) {
    // a raft in the gap: wait until it is close
    // a raft in the gap at about this height (one far below a high ledge is not the way across)
    const movers = G.L.movers.filter(m => m.axis !== 'o' && m.y > feet - 3.5 && m.y < feet + 3 && (dir > 0 ? m.ox + 3 + m.range >= ax && m.ox - m.range <= ax + 7 : m.ox - m.range <= ax && m.ox + 3 + m.range >= ax - 7));
    if (movers.length) {
      const ok = movers.some(m => { const d = dir > 0 ? m.x0 - ax : ax - m.x1, toward = dir > 0 ? m.dx >= -1e-4 : m.dx <= 1e-4; return d < 0.6 && d > -2.4 && toward && m.y > feet - 3.3 && m.y < feet + 2.5; });
      if (!ok) return {};
    }
    AIM[i] = aimFor(p, dir, feet, ax);
    return { l: dir < 0, r: dir > 0, j: true };
  }
  const sc = Math.floor(ax), sr = Math.floor(feet - 0.5);
  if (sr >= 0 && sr < 13 && sc >= 0 && sc < G.L.w && G.L.grid[sr * G.L.w + sc] === 5) { AIM[i] = null; inp.j = true; }
  if ((wall || foe) && Math.abs(tx - x) > 1.0) {   // right by the target (a box to push), walk up to it
    inp.j = true;
    // floaty (under the sea, by moonlight) a hop up a step carries far: aim it at somewhere to land, as at an edge
    if (G.L.world.key === 'sea' || G.L.spec.moon) AIM[i] = aimFor(p, dir, feet, ax);
  }
  return inp;
}
const LR = [null, null], AIM = [null, null], RUNV = 7.5;
// will this fire vent burn within t seconds (or is it burning)? the same clock and rules as the game's jetState
function jetSoon(j, t) {
  if (j.powered && G.chanOn[j.ch]) return false;
  for (const b of G.L.boxes) if (b.x < j.c + 0.9 && b.x + b.w > j.c + 0.1 && Math.abs(b.y + b.h - j.r) < 0.15) return false;
  const PER = 2.6, ph = (((G.wt / PER + j.ph) % 1) + 1) % 1 * PER;
  return ph < 1.0 || ph + t > PER;
}
// where an edge jump should come down: the first thing to stand on ahead, a little way in
function aimFor(p, dir, feet, ax) {
  const who = p.k;
  for (let k = 0, c = Math.floor(ax); k < 7; k++, c += dir) {
    for (let r = Math.max(1, Math.floor(feet - 4)); r <= Math.min(12, Math.floor(feet + 4)); r++) {
      if ((C.solidCell(c, r, who) || C.oneWayCell(c, r)) && !C.solidCell(c, r - 1, who) && !C.oneWayCell(c, r - 1)) {
        if (k === 0 && r >= feet - 0.1) continue;          // the ground you are leaving
        let run = 1; while (run < 3 && (C.solidCell(c + dir * run, r, who) || C.oneWayCell(c + dir * run, r))) run++;
        return { x: dir > 0 ? c + Math.min(0.9, run * 0.5) : c + 1 - Math.min(0.9, run * 0.5), top: r };
      }
    }
  }
  return null;
}
const go = (i, tx, tol) => {
  if (P(i).grounded) { LR[i] = P(i).ground && P(i).ground.ref || null; AIM[i] = null; }
  const r = runInput(i, tx, tol);
  // a jump needs a fresh press: let go for a step before pressing again
  if (r.j && P(i).grounded && IN[i] && IN[i].j) r.j = false;
  IN[i] = r;
};
const near = (i, tx, tol = 0.25) => !P(i).dead && P(i).grounded && Math.abs(cx(P(i)) - tx) < tol;
function both(ta, tb, max = 3000, tol = 0.25) {
  if (G.mode === 'solo') return solo(0, ta, max, tol) && solo(1, tb, max, tol);
  return until(() => near(0, ta, tol) && near(1, tb, tol), () => { go(0, ta, tol * 0.7); go(1, tb, tol * 0.7); }, max); }
function take(i) { if (G.mode === 'solo' && G.active !== i) { IN[0] = {}; IN[1] = {}; tick(); C.swap(); tick(); } }
function unstack(i) {
  const q = 1 - i;
  if (!(P(q).grounded && P(q).ground && P(q).ground.ref === P(i))) return;
  take(q); let k = 0;
  const away = cx(P(i)) > 3 ? -1.4 : 1.4, tx = cx(P(i)) + away;
  until(() => k > 8 && P(q).grounded && P(q).ground && P(q).ground.ref !== P(i), () => { IN[i] = {}; const dx = tx - cx(P(q)); IN[q] = { j: k++ < 6, l: dx < -0.1, r: dx > 0.1 }; }, 300);
}
function solo(i, t, max = 2500, tol = 0.25) { if (G.mode === 'solo') unstack(i); take(i); return until(() => near(i, t, tol), () => { go(i, t, tol * 0.7); IN[1 - i] = {}; }, max); }
// jump from beside your partner and land on their head
function climbOn(top, bottom) {
  take(top);
  const b = P(bottom), dir = cx(P(top)) < cx(b) ? 1 : -1;
  // a tile from the partner; close is enough (beside a box the exact spot can be out of reach)
  if (!solo(top, cx(b) - dir * 1.0, 1500, 0.2) && Math.abs(cx(P(top)) - cx(b)) > 1.8) return false;
  let k = 0;
  IN[top] = {}; tick();
  return until(() => P(top).grounded && P(top).ground && P(top).ground.ref === P(bottom), () => {
    const t = P(top), dx = cx(P(bottom)) - cx(t);
    IN[bottom] = {};
    IN[top] = { j: k++ < 40, r: dx > 0.06, l: dx < -0.06 };
  }, 300);
}
// jump off a partner's head (or anywhere) and keep moving toward x until standing again
function leapTo(i, tx, maxFeet = 99, max = 400) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  let k = 0;
  IN[i] = {}; tick();
  return until(() => k > 10 && P(i).grounded && Math.abs(cx(P(i)) - tx) < 0.7 && P(i).y + P(i).h <= maxFeet, () => {
    const p = P(i), dx = tx - cx(p);
    IN[1 - i] = {};
    IN[i] = { j: k++ < (G.L.world.key === 'sea' || G.L.spec.moon ? 80 : 45), r: dx > 0.15, l: dx < -0.15 };   // a jump in the water (or by moonlight) takes longer to top out
  }, max);
}
const idle = () => { IN[0] = {}; IN[1] = {}; };
// walk into an updraft, rise until the feet are above feetUp, then drift across to tx and land
function rideWind(i, fx, feetUp, tx, max = 900, maxFeet = 99) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  // up in THIS updraft (passing another one on the way lifts you too, and that does not count)
  if (!until(() => !P(i).grounded && P(i).y + P(i).h < feetUp && Math.abs(cx(P(i)) - fx) < 1.3, () => { const dx = fx - cx(P(i)); IN[i] = { l: dx < -0.1, r: dx > 0.1, j: true }; IN[1 - i] = {}; }, max)) return false;
  return until(() => P(i).grounded && Math.abs(cx(P(i)) - tx) < 0.5 && P(i).y + P(i).h <= maxFeet, () => { const dx = tx - cx(P(i)); IN[i] = { l: dx < -0.15, r: dx > 0.15 }; IN[1 - i] = {}; }, max);
}
// stand under the wheel, hop into a cabin as it comes round the bottom, ride it up, and leap for (offX, offFeet)
function rideWheel(i, wh, offX, offFeet) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  const cabins = G.L.movers.filter(m => m.wheel === wh);
  if (!solo(i, wh.cx - 0.2, 1500, 0.3)) return false;
  let k = 0, cab = null;
  const on = () => (cab = cabins.find(m => P(i).grounded && P(i).ground && P(i).ground.ref === m)) != null;
  if (!until(on, () => {
    const low = cabins.find(m => Math.abs(m.x + m.w / 2 - cx(P(i))) < 0.8 && m.y > wh.cy + 2.4);
    IN[1 - i] = {}; IN[i] = { j: !!low && k++ % 30 < 14 };
  }, 4000)) return false;
  // up and round to the top-right quarter (it turns that way), then jump right
  if (!until(() => !on() || (cab.x + cab.w / 2 > wh.cx + 0.9 && cab.y < wh.cy + 0.2 && cab.dy > 0), () => { IN[i] = {}; IN[1 - i] = {}; }, 4000)) return false;
  let j = 0;
  return until(() => j > 10 && P(i).grounded && !cabins.includes(P(i).ground && P(i).ground.ref) && Math.abs(cx(P(i)) - offX) < 1.2 && P(i).y + P(i).h <= offFeet,
    () => { const dx = offX - cx(P(i)); IN[i] = { j: j++ < 40, r: dx > 0.15, l: dx < -0.15 }; IN[1 - i] = {}; }, 500);
}
function pushBox(n, x0, x1, stopAt) {
  const box = G.L.boxes.find(q => q.ox >= x0 && q.ox < x1), lx = box.x - 0.39;
  if (!both(lx - 0.05, lx - 0.05, 2000, 0.3)) return null;
  if (G.mode === 'solo') { take(0); if (!G.hold) C.toggleHold(); if (!G.hold) return null; }
  const ok = until(() => box.x >= (stopAt != null ? stopAt : box.maxX) - 0.02, () => { IN[0] = { r: true }; IN[1] = { r: true }; }, 1500);
  if (G.mode === 'solo' && G.hold) C.toggleHold();
  return ok ? box : null;
}
function seesawThrow(n, x0) {   // the N_seesaw way: CS on the low end, YY lands on the high end, CS flies up
  const s = G.L.seesaws.find(q => q.px > x0 && q.px < x0 + 24);
  if (!solo(0, x0 + 8.2, 1500, 0.3)) return 'reach';
  let k = 0;
  take(0);
  if (!until(() => P(0).grounded && P(0).ground && P(0).ground.ref === s, () => { IN[0] = { j: k++ < 12, l: cx(P(0)) > s.px + 1.8 }; IN[1] = {}; }, 300)) return 'low-end';
  if (!solo(1, x0 + 0.9, 1500, 0.25)) return 'reach-b';
  k = 0;
  take(1);
  if (!until(() => P(0).launch || !P(0).grounded, () => { IN[0] = {}; IN[1] = { j: k++ < 45, r: cx(P(1)) < s.px - 1.9 }; }, 300)) return 'no-throw';
  if (!until(() => P(0).grounded, idle, 400)) return 'no-land';
  return P(0).y > 4 ? 'launch-missed' : true;
}
// walk into a cannon (its button already held); hands off in the air — steering back would cancel the shot
function intoCannon(i, cn, tx) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  if (!until(() => P(i).launch && P(i).launch.keep, () => { go(i, cn.x, 0.15); IN[1 - i] = {}; }, 2500)) return false;
  if (!until(() => P(i).grounded && !P(i).launch, idle, 700)) return false;
  return tx == null || solo(i, tx, 1500, 0.3);
}
// the first shot: one stands in the cannon, the other steps on the button (when `ready` says so)
function fireFrom(shooter, flyer, cn, plateX, ready) {
  if (!solo(flyer, cn.x, 1500, 0.3)) return false;
  if (ready) { if (!solo(shooter, plateX - 1.2, 1500, 0.25)) return false; if (!until(ready, idle, 2000)) return false; }
  take(shooter);
  if (!until(() => P(flyer).launch && P(flyer).launch.keep, () => { go(shooter, plateX, 0.2); IN[flyer] = {}; }, 1500)) return false;
  return until(() => P(flyer).grounded && !P(flyer).launch, () => { IN[flyer] = {}; IN[shooter] = {}; }, 700);
}
/* ── 📖 the story's new things (2026-11-27) ── */
// walk under something in the air and hop until `cond` (a key overhead)
function hopUntil(i, tx, cond, max = 400) {
  if (!solo(i, tx, 1500, 0.2)) return false;
  take(i); let k = 0;
  return until(cond, () => { IN[1 - i] = {}; const dx = tx - cx(P(i)); IN[i] = { j: (k++ % 44) < 24, l: dx < -0.12, r: dx > 0.12 }; }, max);
}
// carry the key into its lock (walk on into it: stopping a hair short of it opens nothing)
const lockAt = (lx) => { const c = Math.floor(lx); for (let r = 0; r < 13; r++) { const t = G.L.grid[r * G.L.w + c]; if (t === C.T_LOCKB || t === C.T_LOCKP) return true; } return false; };
function toLock(i, lx, max = 900) {
  if (!P(i).key) return !lockAt(lx);   // already open (brushed past it on the way)
  take(i);
  return until(() => !P(i).key, () => { go(i, lx + 0.8, 0.05); IN[1 - i] = {}; }, max);
}
// a fresh press of jump (the game wants the press, not the holding)
function press(i) { IN[i] = {}; tick(); IN[i] = { j: true }; tick(); IN[i] = {}; tick(); }
// 气球: walk into it, rise until the feet are above feetUp, drift over to tx, let go, land
function floatTo(i, bx, feetUp, tx, max = 900) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  if (!until(() => P(i).balloon, () => { go(i, bx, 0.08); IN[1 - i] = {}; }, 2000)) return 'grab';
  if (!until(() => P(i).y + P(i).h < feetUp || !P(i).balloon, () => { IN[i] = {}; IN[1 - i] = {}; }, max)) return 'rise';
  if (!P(i).balloon) return 'lost';
  if (!until(() => Math.abs(cx(P(i)) - tx) < 0.3 || !P(i).balloon, () => { const dx = tx - cx(P(i)); IN[i] = { l: dx < -0.1, r: dx > 0.1 }; IN[1 - i] = {}; }, max)) return 'drift';
  if (P(i).balloon) press(i);
  if (P(i).balloon) return 'let-go';
  return until(() => P(i).grounded, () => { const dx = tx - cx(P(i)); IN[i] = { l: dx < -0.12, r: dx > 0.12 }; IN[1 - i] = {}; }, 700) || 'land';
}
// 涨潮: the sea's height in piece n
const seaAt = () => (G.L.tides.length ? C.waterLevel(G.L.tides[0]) : 99);
// wait for the sea to rise past `level`, then swim to tx holding jump, until standing there (feet at or above maxFeet)
function swimTo(i, n, level, tx, maxFeet = 99, max = 2600) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  if (!until(() => seaAt(n) < level, () => { IN[0] = {}; IN[1] = {}; }, 2400)) return 'tide';
  return until(() => P(i).grounded && Math.abs(cx(P(i)) - tx) < 0.5 && P(i).y + P(i).h <= maxFeet,
    () => { const dx = tx - cx(P(i)); IN[i] = { l: dx < -0.15, r: dx > 0.15, j: P(i).y + P(i).h > maxFeet - 0.2 || Math.abs(dx) > 0.5 }; IN[1 - i] = {}; }, max) || 'swim';
}
// walk the one carrying their partner (a rider stays on: no unstacking)
function carryWalk(i, tx, max = 2500) {
  take(i);
  return until(() => near(i, tx, 0.2), () => { go(i, tx, 0.12); IN[1 - i] = {}; }, max);
}
// 一起抬: both under the frame, lift, walk it to the stand (one phone in 一个人玩: hand in hand)
function carryTo(n, tx, max = 3000) {
  const f = G.L.frames.find(q => q.ch === n), fc = () => f.x + f.w / 2;
  if (f.st === 'placed') return true;
  if (!both(fc() - 0.6, fc() + 0.6, 2500, 0.2)) return 'gather';
  if (!until(() => f.st === 'up', idle, 120)) return 'lift';
  if (G.mode === 'solo') { take(0); if (!G.hold) C.toggleHold(); if (!G.hold) return 'hold'; }
  until(() => f.st !== 'up', () => { const dx = tx - fc(), mv = { l: dx < -0.04, r: dx > 0.04 }; IN[0] = mv; IN[1] = mv; }, max);
  if (G.mode === 'solo' && G.hold) C.toggleHold();
  return f.st === 'placed' || 'frame:' + f.st;
}
function stepChunk(n) {
  const c = G.L.chunks[n], id = c.ch.id, x0 = c.x0, x1 = c.x0 + c.ch.w;
  // a piece starts with nobody on anybody's head: the one carrying can't jump (a piece can end with one landed on the other)
  if (P(1).grounded && P(1).ground && P(1).ground.ref === P(0)) unstack(0); else if (P(0).grounded && P(0).ground && P(0).ground.ref === P(1)) unstack(1);
  const A = 0, B = 1;   // CS, YY
  switch (id) {
    case 'goal': if (G.mode === 'solo') { solo(0, G.L.door.x - 0.3, 3000, 0.5); return solo(1, G.L.door.x + 0.3, 3000, 0.5) || G.state === 'won'; }
      return both(G.L.door.x - 0.3, G.L.door.x + 0.3, 3000, 0.5) || G.state === 'won';
    // ── 第 1 章：钥匙和锁
    case 'Q1_intro':
      if (!solo(A, x0 + 7.5, 2500, 0.3)) return 'blue';
      if (!until(() => !G.L.grid.some((t, k) => t === C.T_LOCKB && k % G.L.w >= x0 && k % G.L.w < x1), idle, 30)) return 'blue-lock';
      if (!solo(B, x0 + 13.4, 2500, 0.3)) return 'pink';
      if (!until(() => !G.L.grid.some((t, k) => t === C.T_LOCKP && k % G.L.w >= x0 && k % G.L.w < x1), idle, 30)) return 'pink-lock';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Q1_high':
      if (!both(x0 + 5.6, x0 + 7, 2500, 0.25)) return 'gather';
      if (!climbOn(B, A)) return 'stack';
      if (!leapTo(B, x0 + 3.5, 6.1)) return 'ledge';
      if (!P(B).key) return 'no-key';
      if (!toLock(B, x0 + 10)) return 'lock';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Q2_relay':
      if (!solo(A, x0 + 5.5, 1500, 0.3)) return 'plate-a';
      if (!solo(B, x0 + 15.5, 2500, 0.3)) return 'key';
      if (!toLock(B, x0 + 18)) return 'lock';
      if (!solo(B, x0 + 20.5, 1500, 0.3)) return 'plate-b';
      if (!solo(A, x0 + 23, 2500, 0.4)) return 'through';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Q2_ride':
      if (!both(x0 + 1.6, x0 + 3.4, 2500, 0.25)) return 'gather';
      if (!climbOn(A, B)) return 'stack';
      if (!carryWalk(B, x0 + 16.9)) return 'ride';
      if (!P(A).key) return 'no-key';
      take(B);
      if (!until(() => !P(A).key, () => { go(B, x0 + 18.8, 0.05); IN[A] = {}; }, 600)) return 'lock';
      unstack(B);
      return both(x1 + 0.5, x1 + 1.5);
    case 'Q3_climb':
      if (!solo(B, x0 + 12.6, 2500, 0.25)) return 'reach';
      if (!leapTo(B, x0 + 10.5, 8.1)) return 'step1';
      if (!leapTo(B, x0 + 6.5, 6.1)) return 'step2';
      if (!leapTo(B, x0 + 2.4, 4.1)) return 'step3';
      if (!P(B).key) return 'no-key';
      if (!toLock(B, x0 + 14, 3000)) return 'lock';
      if (!hopUntil(A, x0 + 19.5, () => P(A).key)) return 'blue-key';
      if (!toLock(A, x0 + 24, 2500)) return 'lock-b';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Q4_tree':
      if (!both(x0 + 7, x0 + 5.6, 2500, 0.25)) return 'gather';
      if (!climbOn(A, B)) return 'stack';
      if (!leapTo(A, x0 + 3.5, 6.1)) return 'ledge';
      if (!P(A).key) return 'no-key';
      if (!toLock(A, x0 + 11, 1500)) return 'lock';
      if (!solo(A, x0 + 14.5, 1500, 0.3)) return 'plate-a';
      if (!solo(B, x0 + 30.5, 3000, 0.3)) return 'across-b';
      if (!P(B).key) return 'no-pink';
      if (!solo(A, x0 + 32.5, 3000, 0.3)) return 'across-a';
      if (!toLock(B, x0 + 34, 1500)) return 'pink-lock';
      return both(x1 + 0.5, x1 + 1.5);
    // ── 第 2 章：气球和涨潮
    case 'B1_wall': {
      const r1 = floatTo(A, x0 + 6.5, 3.5, x0 + 15.5); if (r1 !== true) return 'a:' + r1;
      const r2 = floatTo(B, x0 + 6.5, 3.5, x0 + 16.5); if (r2 !== true) return 'b:' + r2;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'B1_cross': {
      const r1 = floatTo(A, x0 + 3.5, 8, x0 + 19.5); if (r1 !== true) return 'a:' + r1;
      const r2 = floatTo(B, x0 + 3.5, 8, x0 + 18.5); if (r2 !== true) return 'b:' + r2;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'T1_ledge': {
      const r1 = swimTo(A, n, 6.0, x0 + 17.5, 5.1); if (r1 !== true) return 'a:' + r1;
      const r2 = swimTo(B, n, 6.0, x0 + 16.5, 5.1); if (r2 !== true) return 'b:' + r2;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'T1_pool': {
      const r1 = swimTo(B, n, 8.4, x0 + 12.5, 10.1); if (r1 !== true) return 'b:' + r1;
      if (!P(B).key) return 'no-key';
      if (!leapTo(B, x0 + 17.6)) return 'b-shore';
      if (!toLock(B, x0 + 19, 1500)) return 'lock';
      const r2 = swimTo(A, n, 8.4, x0 + 12.5, 10.1); if (r2 !== true) return 'a:' + r2;
      if (!leapTo(A, x0 + 17.6)) return 'a-shore';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'B2_plate': {
      const r1 = floatTo(A, x0 + 6.5, 4.5, x0 + 9.5); if (r1 !== true) return 'a:' + r1;
      if (!solo(A, x0 + 9.5, 600, 0.2)) return 'plate-a';
      if (!solo(B, x0 + 21.5, 3000, 0.3)) return 'plate-b';
      if (!solo(A, x0 + 6.4, 1500, 0.4)) return 'down';
      if (!solo(A, x0 + 23, 3000, 0.4)) return 'through';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'W1_tide': {
      const r1 = swimTo(B, n, 5.6, x0 + 4.5, 5.1); if (r1 !== true) return 'b:' + r1;
      if (!P(B).key) return 'no-key';
      if (!toLock(B, x0 + 13, 2500)) return 'lock';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'T3_wave': {
      const r1 = swimTo(A, n, 4.2, x0 + 14.5, 4.1); if (r1 !== true) return 'a:' + r1;
      if (!P(A).key) return 'no-key';
      if (!leapTo(A, x0 + 21.4)) return 'a-shore';
      if (!toLock(A, x0 + 22, 800)) return 'lock';
      const r2 = swimTo(B, n, 4.2, x0 + 14.5, 4.1); if (r2 !== true) return 'b:' + r2;
      if (!leapTo(B, x0 + 23.5)) return 'b-shore';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'W2_balloon': {
      const r1 = floatTo(A, x0 + 3.5, 1.75, x0 + 18.5); if (r1 !== true) return 'a:' + r1;
      if (!P(A).key) return 'no-key';
      if (!toLock(A, x0 + 21, 1500)) return 'lock';
      const r2 = floatTo(B, x0 + 3.5, 7, x0 + 19.5); if (r2 !== true) return 'b:' + r2;
      return both(x1 + 0.5, x1 + 1.5);
    }
    // ── 第 3 章：计时门和一起抬
    case 'R1_intro':
      if (!both(x0 + 4.5, x0 + 3.0, 2500, 0.25)) return 'gather';
      if (!solo(B, x0 + 11.5, 1500, 0.3)) return 'through-b';
      if (!solo(A, x0 + 10.5, 1500, 0.3)) return 'through-a';
      return both(x1 + 0.5, x1 + 1.5);
    case 'R2_run':
      if (!both(x0 + 3.5, x0 + 2.0, 2500, 0.25)) return 'gather';
      if (!solo(B, x0 + 28.5, 3000, 0.3)) return 'run-b';
      if (!solo(A, x0 + 27, 3000, 0.3)) return 'run-a';
      return both(x1 + 0.5, x1 + 1.5);
    case 'F1_intro': {
      const r = carryTo(n, x0 + 12.5); if (r !== true) return r;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'F2_carry': {
      const r = carryTo(n, x0 + 20.5); if (r !== true) return r;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'R3_wind':
      if (!solo(A, x0 + 3.5, 2500, 0.25)) return 'plate-a';
      if (!rideWind(A, x0 + 6.5, 3.9, x0 + 9.5, 900, 4.1)) return 'wind-a';
      if (!P(A).key) return 'no-key';
      if (!toLock(A, x0 + 18, 1500)) return 'lock';
      if (!solo(B, x0 + 3.5, 2500, 0.25)) return 'plate-b';
      if (!rideWind(B, x0 + 6.5, 3.9, x0 + 10.4, 900, 4.1)) return 'wind-b';
      if (!solo(B, x0 + 16, 1500, 0.4)) return 'down-b';
      return both(x1 + 0.5, x1 + 1.5);
    case 'F3_lockframe': {
      if (!both(x0 + 12.6, x0 + 14, 2500, 0.25)) return 'gather';
      if (!climbOn(B, A)) return 'stack';
      if (!leapTo(B, x0 + 10.5, 6.1)) return 'ledge';
      if (!P(B).key) return 'no-key';
      if (!toLock(B, x0 + 15, 1500)) return 'lock';
      const r = carryTo(n, x0 + 21.5); if (r !== true) return r;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'F4_finale': {
      if (!solo(A, x0 + 9.5, 2500, 0.25)) return 'plate';
      if (!rideWind(A, x0 + 6.5, 3.9, x0 + 2.5, 900, 4.1)) return 'wind';
      if (!P(A).key) return 'no-key';
      if (!toLock(A, x0 + 14, 2500)) return 'lock';
      const r = carryTo(n, x0 + 42.5, 4000); if (r !== true) return r;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'C_stack':
      if (!both(x0 + 5.5, x0 + 3.5)) return false;
      if (!climbOn(B, A)) return false;
      if (!leapTo(B, x0 + 6.5, 6.1)) return false;
      if (!solo(B, x0 + 6.5, 400, 0.3)) return false;
      if (!until(() => G.chanOn[n], () => { IN[A] = {}; IN[B] = {}; }, 60)) return false;
      if (!solo(A, x0 + 10)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    case 'G_relay':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!solo(B, x0 + 19.5, 2000, 0.3)) return false;
      if (!solo(A, x1 + 0.5, 2000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    case 'C_relay':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!solo(B, x0 + 13.5, 1500, 0.3)) return false;
      if (!solo(A, x0 + 15, 1500)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    case 'C_bridge':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!solo(B, x0 + 15.5, 1500, 0.3)) return false;
      if (!solo(A, x0 + 17.5, 1500)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    case 'C_elev': {
      const e = G.L.elevs.find(q => q.x0 >= x0 && q.x0 < x1);
      if (!solo(B, x0 + 8.5, 1500, 0.4)) return false;
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!until(() => e.y <= e.yTop + 0.02, () => { IN[A] = {}; IN[B] = {}; }, 600)) return false;
      if (!solo(B, x0 + 12.5, 600)) return false;
      take(A);
      if (!until(() => e.y >= e.yBot - 0.02, () => { go(A, x0 + 6); IN[B] = {}; }, 900)) return false;
      if (!solo(A, x0 + 8.5, 600, 0.4)) return false;
      if (!solo(B, x0 + 10.5, 600, 0.3)) return false;
      if (!until(() => e.y <= e.yTop + 0.02, () => { IN[A] = {}; IN[B] = {}; }, 600)) return false;
      if (!solo(A, x0 + 13.5, 600)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'K_ride': case 'K_ride2': {
      const car = id === 'K_ride' ? A : B, rider = 1 - car;
      if (!solo(car, x0 + 2.4, 1500, 0.25)) return false;
      if (!climbOn(rider, car)) return false;
      take(car);
      if (!until(() => near(car, x1 + 0.8, 0.4), () => { go(car, x1 + 0.8); IN[rider] = {}; }, 1500)) return false;
      return both(x1 + 1.5, x1 + 2.5);
    }
    case 'K_stairs':
      if (!solo(A, x0 + 6.5, 2000, 0.3)) return false;
      if (!until(() => G.chanOn[n], () => { IN[A] = {}; IN[B] = {}; }, 60)) return false;
      if (!solo(B, x0 + 17.5, 2500, 0.3)) return false;
      if (!solo(A, x1 + 0.5, 2000)) return false;
      return both(x1 + 1, x1 + 2);
    case 'X_plate': case 'X_tower': {
      const box = G.L.boxes.find(q => q.ox >= x0 && q.ox < x1);
      const lx = box.x - 0.39;
      if (!both(lx - 0.05, lx - 0.05, 2000, 0.3)) return false;
      const stopAt = id === 'X_plate' ? x0 + 8 : box.maxX;
      if (G.mode === 'solo') { take(A); if (!G.hold) C.toggleHold(); if (!G.hold) return 'no-hold'; }
      if (!until(() => box.x >= stopAt - 0.02, () => { IN[A] = { r: true }; IN[B] = { r: true }; }, 1500)) return false;
      if (G.mode === 'solo' && G.hold) C.toggleHold();
      if (id === 'X_plate') {
        if (!until(() => G.chanOn[n], () => { IN[A] = {}; IN[B] = {}; }, 60)) return false;
        return both(x1 + 0.5, x1 + 1.5);
      }
      // X_tower: CS on the box, YY on CS, YY up onto the block and its button
      if (!leapTo(A, box.x + 0.9, 9.1)) return false;
      if (!climbOn(B, A)) return false;
      if (!leapTo(B, x0 + 8.6, 5.1)) return false;
      if (!solo(B, x0 + 8.5, 300, 0.3)) return false;
      if (!until(() => G.chanOn[n], () => { IN[A] = {}; IN[B] = {}; }, 60)) return false;
      if (!solo(A, x0 + 19.5, 2000, 0.3)) return false;
      if (!solo(B, x1 + 0.5, 2000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    }
    case 'N_seesaw': case 'O_seesaw': {
      const s = G.L.seesaws.find(q => q.px > x0 && q.px < x1);
      if (!solo(A, x0 + 8.2, 1500, 0.3)) return false;
      // hop back onto the low right end
      let k = 0;
      take(A);
      if (!until(() => P(A).grounded && P(A).ground && P(A).ground.ref === s, () => { IN[A] = { j: k++ < 12, l: cx(P(A)) > s.px + 1.8 }; IN[B] = {}; }, 300)) return false;
      if (!solo(B, x0 + 0.9, 1500, 0.25)) return false;
      k = 0;
      take(B);
      if (!until(() => P(A).launch || !P(A).grounded, () => { IN[A] = {}; IN[B] = { j: k++ < 45, r: cx(P(B)) < s.px - 1.9 }; }, 300)) return false;
      if (!until(() => P(A).grounded, () => { IN[A] = {}; IN[B] = {}; }, 400)) return false;
      if (P(A).y > 4) return 'launch-missed';
      if (!solo(A, x0 + 10.5, 400, 0.3)) return false;
      if (!solo(B, x0 + 22.5, 2000, 0.3)) return false;
      if (!solo(A, x1 + 0.5, 2000)) return false;
      return both(x1 + 1, x1 + 2);
    }
    // ── 2026-11-22 ──
    case 'S_pair1':
      if (!both(x0 + 3.5, x0 + 9.5, 2000, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'S_tall':
      if (!solo(A, x0 + 5.5, 1500, 0.3)) return false;
      if (P(A).y + P(A).h > 10.1) return 'not-on-step';
      if (!climbOn(B, A)) return 'climb';
      if (!leapTo(B, x0 + 7.5, 5.1)) return 'leap';
      if (!solo(B, x0 + 7.5, 400, 0.3)) return false;
      if (!until(() => G.chanOn[n], idle, 60)) return 'gate';
      if (!solo(A, x0 + 10)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    case 'S_pair2':
      if (!both(x0 + 4.0, x0 + 2.4, 2000, 0.3)) return false;
      if (!climbOn(B, A)) return 'climb';
      if (!leapTo(B, x0 + 4.5, 6.1)) return 'leap';
      if (!solo(B, x0 + 4.5, 400, 0.3)) return false;
      if (!solo(A, x0 + 11.5, 2000, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'U_pair': case 'U_bridge2': case 'G_pair1': {
      const spots = { U_pair: [6.5, 2.5, 9.5], U_bridge2: [7.5, 10.5, 3.5], G_pair1: [7.5, 3.5, 11.5] }[id];
      const sx0 = x0 + spots[0], cloud = x0 + spots[1], floor = x0 + spots[2];
      if (id === 'U_bridge2' && !solo(A, floor, 2000, 0.3)) return false;
      take(B);
      if (!until(() => !P(B).grounded && P(B).vy < -15, () => { go(B, sx0, 0.05); IN[A] = {}; }, 900)) return 'no-spring';
      if (!until(() => P(B).grounded && P(B).y + P(B).h <= 6.1, () => { const dx = cloud - cx(P(B)); IN[B] = { j: true, l: dx < -0.15, r: dx > 0.15 }; IN[A] = {}; }, 400)) return 'missed-cloud';
      if (!solo(B, cloud, 300, 0.3)) return false;
      if (id !== 'U_bridge2' && !solo(A, floor, 2000, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'U_tower': {
      const e = G.L.elevs.find(q => q.x0 >= x0 && q.x0 < x1);
      take(B);   // step onto the lift (it is level with the floor; no hop)
      if (!until(() => P(B).grounded && P(B).ground && P(B).ground.ref === e && Math.abs(cx(P(B)) - (x0 + 6.5)) < 0.5, () => { const dx = x0 + 6.5 - cx(P(B)); IN[B] = { r: dx > 0.15, l: dx < -0.15 }; IN[A] = {}; }, 800)) return 'onto-lift';
      if (!solo(A, x0 + 2.5, 1500, 0.3)) return false;
      if (!until(() => e.y <= e.yTop + 0.02, idle, 600)) return 'lift';
      if (!solo(B, x0 + 11.5, 600, 0.3)) return false;
      if (!until(() => G.chanOn[n], idle, 60)) return 'bridge';
      if (!solo(A, x1 + 0.5, 2000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    }
    case 'F_fan2':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWind(B, x0 + 6.5, 9, x0 + 17.5)) return 'wind-b';
      if (!solo(B, x0 + 17.5, 600, 0.3)) return false;
      if (!rideWind(A, x0 + 6.5, 9, x1 + 0.5)) return 'wind-a';
      return both(x1 + 1.5, x1 + 0.8);
    case 'K_pair':
      if (!leapTo(A, x0 + 4.5, 9.1)) return 'blue';
      if (!solo(A, x0 + 4.5, 300, 0.3)) return false;
      if (!solo(B, x0 + 10.6, 2000, 0.3)) return false;
      if (!leapTo(B, x0 + 13.5, 9.1)) return 'pink';
      if (!solo(B, x0 + 13.5, 300, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'F_tower':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWind(B, x0 + 6.0, 3.7, x0 + 17.5)) return 'wind';
      if (!solo(B, x0 + 17.5, 600, 0.3)) return false;
      if (!until(() => G.chanOn[n], idle, 60)) return 'gate';
      if (!solo(A, x1 + 0.5, 2000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    case 'W_portal2':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!solo(B, x0 + 14.5, 2500, 0.3)) return false;
      if (!solo(A, x1 + 0.5, 2500)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    case 'X_bridge': case 'W_portal3':
      if (!pushBox(n, x0, x1)) return 'box';
      if (!until(() => G.chanOn[n], idle, 60)) return 'plate';
      return both(x1 + 0.5, x1 + 1.5);
    case 'X_pair': {
      const box = pushBox(n, x0, x1); if (!box) return 'box';
      if (!leapTo(A, box.x + 1.0, 9.1)) return 'onto-box';
      if (!leapTo(A, x0 + 14.5, 6.1)) return 'cloud';
      if (!solo(A, x0 + 14.5, 300, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'Y_wheel1': {
      const wh = G.L.wheels.find(w => w.cx > x0 && w.cx < x1);
      if (!rideWheel(A, wh, x0 + 13.5, 4.1)) return 'wheel-a';
      if (!rideWheel(B, wh, x0 + 13.5, 4.1)) return 'wheel-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'Y_wheel2': {
      const wh = G.L.wheels.find(w => w.cx > x0 && w.cx < x1);
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWheel(B, wh, x0 + 17.5, 11.1)) return 'wheel';
      if (!solo(B, x0 + 17.5, 600, 0.3)) return false;
      if (!until(() => G.chanOn[n], idle, 60)) return 'gate';
      if (!solo(A, x1 + 0.5, 2500)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    }
    case 'Y_wheel3': {
      const wh = G.L.wheels.find(w => w.cx > x0 && w.cx < x1);
      if (!rideWheel(B, wh, x0 + 11.5, 5.1)) return 'wheel';
      if (!solo(B, x0 + 11.5, 300, 0.3)) return false;
      if (!solo(A, x0 + 3.5, 2500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'Y_photo':
      if (!solo(A, x0 + 6.6, 1500, 0.3)) return false;
      if (!solo(B, x0 + 12.4, 2500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 120)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Y_lift':
      if (!rideWind(B, x0 + 4.9, 3.8, x0 + 8.5)) return 'wind';
      if (!solo(B, x0 + 8.5, 300, 0.3)) return false;
      if (!solo(A, x0 + 13.5, 2500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Y_finale':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWind(B, x0 + 6.9, 3.8, x0 + 11.5)) return 'wind-b';
      if (!solo(B, x0 + 11.5, 300, 0.3)) return false;
      if (!solo(A, x0 + 5.5, 1500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      if (!solo(B, x0 + 14.5, 1500, 0.3)) return false;
      if (!rideWind(A, x0 + 6.9, 3.8, x0 + 10.5)) return 'wind-a';
      return both(x1 + 0.5, x1 + 1.5);
    case 'Y_maze2':   // in at the floor mirror, out on the cloud; walk LEFT into the purple one, out past the wall
      for (const i of [A, B]) {
        if (G.mode === 'solo') unstack(i);
        take(i);
        if (!until(() => cx(P(i)) > x0 + 15 && P(i).grounded, () => { const p = P(i), up = p.y + p.h < 8 && cx(p) < x0 + 14; IN[i] = up ? { l: true } : { r: true }; IN[1 - i] = {}; }, 1500)) return 'maze' + i;
      }
      return both(x1 + 0.5, x1 + 1.5);
    // ── 2026-11-24: 糖果乐园, 海底世界 ──
    case 'G_boxfan': {
      if (!pushBox(n, x0, x1)) return 'box';
      if (!until(() => G.chanOn[n], idle, 60)) return 'plate';
      if (!rideWind(A, x0 + 13.9, 3.8, x0 + 18.5)) return 'wind-a';
      if (!rideWind(B, x0 + 13.9, 3.8, x0 + 17.5)) return 'wind-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'G_portal':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!solo(B, x0 + 19.5, 3000, 0.3)) return false;
      if (!solo(A, x1 + 0.5, 3000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    case 'G_wheel': {
      const wh = G.L.wheels.find(w => w.cx > x0 && w.cx < x1);
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWheel(B, wh, x0 + 11.5, 4.1)) return 'wheel';
      if (!solo(B, x0 + 11.5, 300, 0.3)) return false;
      if (!solo(A, x0 + 9.5, 1500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'G_finale': {
      if (!pushBox(n, x0, x1)) return 'box';
      if (!rideWind(B, x0 + 14.9, 3.8, x0 + 17.5)) return 'wind';
      if (!solo(B, x0 + 17.5, 300, 0.3)) return false;
      if (!solo(A, x0 + 11.5, 2500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'O_pair':
      if (!both(x0 + 4.6, x0 + 3.0, 2000, 0.3)) return false;
      if (!climbOn(B, A)) return 'climb';
      if (!leapTo(B, x0 + 4.5, 5.1)) return 'leap';
      if (!solo(B, x0 + 4.5, 400, 0.3)) return false;
      if (!solo(A, x0 + 13.5, 2000, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'O_vent':
      if (!solo(A, x0 + 3.5, 1500, 0.3)) return false;
      if (!rideWind(B, x0 + 8.9, 3.8, x0 + 16.5)) return 'wind-b';
      if (!solo(B, x0 + 16.5, 300, 0.3)) return false;
      if (!rideWind(A, x0 + 8.9, 3.8, x0 + 14)) return 'wind-a';
      return both(x1 + 0.5, x1 + 1.5);
    case 'O_color':   // YY through the blue wall to its button; CS through the gate and the pink wall to the other; YY through
      if (!solo(B, x0 + 3.5, 1500, 0.3)) return false;
      if (!leapTo(B, x0 + 11.5, 11.1)) return 'blue';
      if (!solo(B, x0 + 11.5, 300, 0.3)) return false;
      if (!until(() => G.chanOn[n], idle, 60)) return 'gate1';
      if (!solo(A, x0 + 13, 1500, 0.3)) return false;
      if (!leapTo(A, x0 + 20.5, 11.1)) return 'pink';
      if (!solo(A, x0 + 20.5, 300, 0.3)) return false;
      if (!solo(B, x1 + 0.5, 2000)) return false;
      return both(x1 + 1.5, x1 + 0.8);
    case 'O_palace':
      if (!rideWind(A, x0 + 5.9, 3.8, x0 + 8.5, 900, 4.1)) return 'wind-a';
      if (!solo(A, x0 + 8.5, 300, 0.3)) return false;
      if (!rideWind(B, x0 + 14.9, 3.8, x0 + 18.5, 900, 4.1)) return 'wind-b';
      if (!solo(B, x0 + 18.5, 300, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'J_cannon1': case 'J_cannon2': {   // B fires A up (or over), A holds the far button, B steps in
      const cn = G.L.cannons.find(q => q.x > x0 && q.x < x1), far = id === 'J_cannon1' ? x0 + 14.5 : x0 + 18.5, plate = id === 'J_cannon1' ? x0 + 3.5 : x0 + 7.5;
      if (!fireFrom(B, A, cn, plate)) return 'shot-a';
      if (!solo(A, far, 1500, 0.3)) return 'far-plate';
      if (!intoCannon(B, cn)) return 'shot-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'J_cannon3': {   // time the shot so it comes down on the raft; from the raft, jump to the far shore
      const cn = G.L.cannons.find(q => q.x > x0 && q.x < x1), m = G.L.movers.find(q => q.ox > x0 && q.ox < x1);
      const raftAt = (dt) => m.ox + Math.sin(2 * Math.PI * (G.wt + dt) / m.period) * m.range;   // its left end, dt seconds from now
      const want = x0 + 9.1;   // the shot comes down at x0+10.6, 0.64 s after it fires
      if (!fireFrom(B, A, cn, x0 + 4.5, () => Math.abs(raftAt(0.86) - want) < 0.3)) return 'shot-a';
      if (!(P(A).ground && P(A).ground.ref === m)) return 'missed-raft-a';
      if (!until(() => cx(P(A)) > x0 + 13.2, idle, 900)) return 'raft-a';
      if (!leapTo(A, x0 + 18)) return 'shore-a';
      if (!solo(A, x0 + 18.5, 1500, 0.3)) return 'far-plate';
      if (!solo(B, cn.x - 1.3, 1500, 0.25)) return 'b-wait';
      if (!until(() => Math.abs(raftAt(0.8) - want) < 0.3, idle, 2000)) return 'b-time';
      if (!intoCannon(B, cn)) return 'shot-b';
      if (!(P(B).ground && P(B).ground.ref === m)) return 'missed-raft-b';
      if (!until(() => cx(P(B)) > x0 + 13.2, idle, 900)) return 'raft-b';
      if (!leapTo(B, x0 + 17.5)) return 'shore-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'J_stack': {   // in the sand: B up on A's head and out; B on the button makes steps for A
      if (!both(x0 + 12.3, x0 + 10.6, 3000, 0.3)) return 'into-sand';
      if (!climbOn(B, A)) return 'climb';
      if (!leapTo(B, x0 + 14.5, 9.1)) return 'out';
      if (!solo(A, x0 + 9.6, 1500, 0.3)) return 'a-aside';
      if (!solo(B, x0 + 16.5, 1500, 0.3)) return 'plate';
      if (!solo(A, x0 + 14.8, 2500, 0.4)) return 'a-out';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'J_sand2': {   // B up on A's head to the high heart, A on the low one: the lock opens for good
      if (!both(x0 + 14.7, x0 + 15.9, 3000, 0.3)) return 'into-sand';
      if (!climbOn(B, A)) return 'climb';
      if (!leapTo(B, x0 + 12.4, 7.1)) return 'ledge';
      if (!solo(B, x0 + 10.5, 1000, 0.25)) return 'heart-b';
      if (!solo(A, x0 + 16.5, 1500, 0.25)) return 'heart-a';
      if (!until(() => G.latch[n], idle, 120)) return 'latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'J_finale': {   // the box onto the button keeps the cannon ready; then in turns
      const cn = G.L.cannons.find(q => q.x > x0 && q.x < x1);
      if (!pushBox(n, x0, x1, x0 + 5)) return 'box';
      if (!until(() => G.chanOn[n], idle, 60)) return 'box-plate';
      if (!intoCannon(A, cn, x0 + 17.5)) return 'shot-a';   // (not further: on one phone the other is still down by the box)
      if (!intoCannon(B, cn, x0 + 16.5)) return 'shot-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'V_jets2':   // a relay: the button puts the fire out
      if (!both(x0 + 3.5, x0 + 2.2, 2500, 0.3)) return false;
      if (!solo(B, x0 + 15.5, 2500, 0.3)) return false;
      if (!solo(A, x0 + 17, 2500)) return false;
      return both(x1 + 0.5, x1 + 1.5);
    case 'V_heat':
      if (!both(x0 + 8.5, x0 + 7, 2500, 0.4)) return 'gather';
      if (!rideWind(A, x0 + 12, 4.8, x0 + 15.6)) return 'wind-a';
      if (!rideWind(B, x0 + 12, 4.8, x0 + 14.8)) return 'wind-b';
      return both(x1 + 0.5, x1 + 1.5);
    case 'V_box':   // push the box onto the two vents, then walk over it
      if (!pushBox(n, x0, x1, x0 + 10)) return 'box';
      return both(x1 + 0.5, x1 + 1.5);
    case 'V_pair': {   // both hearts sit on vents: step on together as the fire goes out, then step off
      const jets = G.L.jets.filter(j => j.ch === n), off = () => { const t = (((G.wt / 2.6 + jets[0].ph) % 1) + 1) % 1 * 2.6; return t > 1.02 && t < 1.2; };
      if (!both(x0 + 8.0, x0 + 10.8, 3000, 0.25)) return 'wait-spots';
      if (!until(off, idle, 800)) return 'timing';
      if (G.mode === 'solo') { if (!solo(A, x0 + 9.5, 200, 0.25)) return 'a-on'; if (!solo(B, x0 + 12.5, 300, 0.25)) return 'b-on'; }
      else if (!until(() => near(A, x0 + 9.5) && near(B, x0 + 12.5), () => { go(A, x0 + 9.5, 0.18); go(B, x0 + 12.5, 0.18); }, 300)) return 'both-on';
      if (!until(() => G.latch[n], idle, 30)) return 'latch';
      if (G.mode === 'solo') { solo(B, x0 + 11, 200, 0.3); solo(A, x0 + 8, 200, 0.3); }
      else both(x0 + 8, x0 + 11, 200, 0.3);
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'V_cannon': {   // onto the stone pillar in the lava, and straight on to the far shore before it crumbles
      const cn = G.L.cannons.find(q => q.x > x0 && q.x < x1);
      if (!fireFrom(B, A, cn, x0 + 4.5)) return 'shot-a';
      if (!leapTo(A, x0 + 17)) return 'shore-a';
      if (!solo(A, x0 + 17.5, 1500, 0.3)) return 'far-plate';
      if (!until(() => G.crumbs.size === 0, idle, 900)) return 'pillar-back';
      if (!intoCannon(B, cn)) return 'shot-b';
      if (!leapTo(B, x0 + 16.5)) return 'shore-b';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'D_pair':
      if (!both(x0 + 5.5, x0 + 16.5, 2500, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    case 'N_seesaw2': {
      const r = seesawThrow(n, x0); if (r !== true) return r;
      if (!solo(A, x0 + 10.5, 400, 0.3)) return false;
      if (!solo(B, x0 + 12.5, 2000, 0.3)) return false;
      if (!until(() => G.latch[n], idle, 60)) return 'no-latch';
      return both(x1 + 0.5, x1 + 1.5);
    }
    case 'boss': {
      const b = G.L.boss;
      if (!both(x0 + 8, x0 + 9)) return false;
      let top = B, bot = A;
      for (let round = 0; round < (G.mode === 'solo' ? 40 : 24) && b.hp > 0; round++) {
        const onHead = (t, u) => P(t).grounded && P(t).ground && P(t).ground.ref === P(u);
        if (onHead(A, B)) { top = A; bot = B; } else if (onHead(B, A)) { top = B; bot = A; }
        else { top = B; bot = A; if (!climbOn(B, A)) return 'no-stack'; }
        // carry YY under where the cloud is, wait for it to come down
        take(bot);
        if (!until(() => b.st === 'dip' && b.y > 6.0, () => { go(bot, clamp(b.x - 0.6, x0 + 2, x1 - 3)); IN[top] = {}; }, 2500)) return 'no-dip';
        until(() => near(bot, b.x - 0.6, 0.3), () => { go(bot, b.x - 0.6); IN[top] = {}; }, 60);
        const hp = b.hp; let k = 0;
        IN[top] = {}; tick(); take(top);
        until(() => b.hp < hp || (k > 20 && P(top).grounded), () => { IN[bot] = {}; const dx = b.x + 1.5 - cx(P(top)); IN[top] = { j: k++ < 45, r: dx > 0.2, l: dx < -0.2 }; }, 300);
        wait(30);
      }
      if (b.hp > 0) return 'boss-alive hp' + b.hp;
      return both(x1 + 0.5, x1 + 1.5);
    }
    default: {
      // plain platforming: CS leads, YY follows a little behind
      const target = x1 + 0.6;
      if (/crumble|clouds/.test(id)) {
        // gather at the start, and wait just inside the piece: two phones' worth of screen apart is one too many on one phone
        if (!both(x0 + 1.4, x0 + 0.5, 2500, 0.4)) return false;
        if (!solo(0, x1 - 1, 3000, 0.4)) return false;
        if (!until(() => G.crumbs.size === 0, () => { IN[0] = {}; IN[1] = {}; }, 900)) return false;
        return solo(1, x1 - 2, 3000, 0.5);
      }
      if (G.mode === 'solo') return solo(0, target, 4000, 0.4) && solo(1, target - 1, 4000, 0.5);
      const gapB = 1.6;
      return until(() => near(0, target, 0.4) && near(1, target - 1, 0.5), () => {
        go(0, target, 0.3);
        const lead = cx(P(0)), arrived = near(0, target, 0.4);
        go(1, arrived || P(0).dead ? target - 1 : Math.min(target - 1, lead - gapB), 0.35);
      }, 4000);
    }
  }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
window.__botRun = (i, tx) => { go(i, tx); return IN[i]; };
window.__bot = {
  // ♾️ one 段 of the endless road (run seed rs, 段 d): the made stretches go to the plain-platforming runner below
  playE(rs, d, god, mode = 'duo', ws) { C.startE(rs, d, mode, ws); return this.run(god, `E${d}`); },
  play(i, god, mode = 'duo') { C.start(i, mode); return this.run(god, i >= C.SI ? 'S' + (i - C.SI + 1) : i + 1); },
  run(god, label) {
    const i = label;
    C.set('god', !!god); steps = 0; ring.length = 0;
    for (let n = 1; n < G.L.chunks.length; n++) {
      const r = stepChunk(n);
      if (G.state === 'won' || G.state === 'result') break;
      if (r !== true) return { ok: false, level: i, chunk: G.L.chunks[n].ch.id, why: r === false ? 'timeout' : r, state: G.state, hp: G.hp, steps,
        p: G.players.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), p.grounded, p.dead > 0, p.ground && p.ground.kind]), x0: G.L.chunks[n].x0, trace: ring.slice() };
    }
    until(() => G.state === 'won', () => { IN[0] = {}; IN[1] = {}; }, 300);
    return { ok: G.state === 'won', level: i, hp: G.hp, hearts: G.hearts, stars: G.stars.filter(Boolean).length, time: +G.time.toFixed(1), steps };
  },
};
})();
