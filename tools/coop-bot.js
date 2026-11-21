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
  if ((wall || foe) && Math.abs(tx - x) > 1.0) inp.j = true;   // right by the target (a box to push), walk up to it
  return inp;
}
const LR = [null, null], AIM = [null, null], RUNV = 7.5;
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
    IN[i] = { j: k++ < 45, r: dx > 0.15, l: dx < -0.15 };
  }, max);
}
const idle = () => { IN[0] = {}; IN[1] = {}; };
// walk into an updraft, rise until the feet are above feetUp, then drift across to tx and land
function rideWind(i, fx, feetUp, tx, max = 900) {
  if (G.mode === 'solo') unstack(i);
  take(i);
  if (!until(() => !P(i).grounded && P(i).y + P(i).h < feetUp, () => { const dx = fx - cx(P(i)); IN[i] = { l: dx < -0.1, r: dx > 0.1, j: true }; IN[1 - i] = {}; }, max)) return false;
  return until(() => P(i).grounded && Math.abs(cx(P(i)) - tx) < 0.5, () => { const dx = tx - cx(P(i)); IN[i] = { l: dx < -0.15, r: dx > 0.15 }; IN[1 - i] = {}; }, max);
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
function stepChunk(n) {
  const c = G.L.chunks[n], id = c.ch.id, x0 = c.x0, x1 = c.x0 + c.ch.w;
  const A = 0, B = 1;   // CS, YY
  switch (id) {
    case 'goal': if (G.mode === 'solo') { solo(0, G.L.door.x - 0.3, 3000, 0.5); return solo(1, G.L.door.x + 0.3, 3000, 0.5) || G.state === 'won'; }
      return both(G.L.door.x - 0.3, G.L.door.x + 0.3, 3000, 0.5) || G.state === 'won';
    case 'C_stack':
      if (!both(x0 + 5.5, x0 + 3.5)) return false;
      if (!climbOn(B, A)) return false;
      if (!leapTo(B, x0 + 6.5, 6.1)) return false;
      if (!solo(B, x0 + 6.5, 400, 0.3)) return false;
      if (!until(() => G.chanOn[n], () => { IN[A] = {}; IN[B] = {}; }, 60)) return false;
      if (!solo(A, x0 + 10)) return false;
      return both(x1 + 0.5, x1 + 1.5);
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
    case 'N_seesaw': {
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
    case 'U_pair': case 'U_bridge2': {
      const sx0 = x0 + (id === 'U_pair' ? 6.5 : 7.5), cloud = x0 + (id === 'U_pair' ? 2.5 : 10.5), floor = x0 + (id === 'U_pair' ? 9.5 : 3.5);
      if (id === 'U_bridge2' && !solo(A, floor, 2000, 0.3)) return false;
      take(B);
      if (!until(() => !P(B).grounded && P(B).vy < -15, () => { go(B, sx0, 0.05); IN[A] = {}; }, 900)) return 'no-spring';
      if (!until(() => P(B).grounded && P(B).y + P(B).h <= 6.1, () => { const dx = cloud - cx(P(B)); IN[B] = { j: true, l: dx < -0.15, r: dx > 0.15 }; IN[A] = {}; }, 400)) return 'missed-cloud';
      if (!solo(B, cloud, 300, 0.3)) return false;
      if (id === 'U_pair' && !solo(A, floor, 2000, 0.3)) return false;
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
        if (!solo(0, target, 3000, 0.4)) return false;
        if (!until(() => G.crumbs.size === 0, () => { IN[0] = {}; IN[1] = {}; }, 900)) return false;
        return solo(1, target - 1, 3000, 0.5);
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
  play(i, god, mode = 'duo') {
    C.start(i, mode); C.set('god', !!god); steps = 0; ring.length = 0;
    for (let n = 1; n < G.L.chunks.length; n++) {
      const r = stepChunk(n);
      if (G.state === 'won' || G.state === 'result') break;
      if (r !== true) return { ok: false, level: i + 1, chunk: G.L.chunks[n].ch.id, why: r === false ? 'timeout' : r, state: G.state, hp: G.hp, steps,
        p: G.players.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), p.grounded, p.dead > 0, p.ground && p.ground.kind]), x0: G.L.chunks[n].x0, trace: ring.slice() };
    }
    until(() => G.state === 'won', () => { IN[0] = {}; IN[1] = {}; }, 300);
    return { ok: G.state === 'won', level: i + 1, hp: G.hp, hearts: G.hearts, stars: G.stars.filter(Boolean).length, time: +G.time.toFixed(1), steps };
  },
};
})();
