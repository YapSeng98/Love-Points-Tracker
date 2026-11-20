/* 一起回家 and 默契拍拍 — loaded by app.js the first time either is opened (CLAUDE.md §7.33). */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const COARSE = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();

/* ── CS and YY: the approved chubby drawings (from the 小屋 try-out) ── */
const CH = {
  cs: { name: 'CS', body: '#FFFCF6', shade: '#EFE7DB', edge: '#CFC3B4', ear: '#DCE6F5', earEdge: '#A9BBD8', tint: '#4F8FDB' },
  yy: { name: 'YY', body: '#FFD9E4', shade: '#F9BACD', edge: '#E995B2', ear: '#FFC4D6', earEdge: '#E995B2', tint: '#E8508F' },
};
function partsSvg(k, face, id) {
  const cs = k === 'cs', c = CH[k];
  const eyes = {
    normal: '<circle cx="34" cy="50" r="3.6" fill="#3A2F3C"/><circle cx="66" cy="50" r="3.6" fill="#3A2F3C"/><circle cx="35.2" cy="48.8" r="1.2" fill="#fff"/><circle cx="67.2" cy="48.8" r="1.2" fill="#fff"/>',
    blink: '<path d="M30 50.5Q34 53.5 38 50.5M62 50.5Q66 53.5 70 50.5" fill="none" stroke="#3A2F3C" stroke-width="2.4" stroke-linecap="round"/>',
    happy: '<path d="M30 52Q34 46 38 52M62 52Q66 46 70 52" fill="none" stroke="#3A2F3C" stroke-width="2.6" stroke-linecap="round"/>',
    hurt: '<path d="M30 47L37 51L30 55M70 47L63 51L70 55" fill="none" stroke="#3A2F3C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    strain: '<path d="M29 48L38 51M71 48L62 51" fill="none" stroke="#3A2F3C" stroke-width="2.6" stroke-linecap="round"/>',
  }[face];
  const mouth = face === 'happy' ? '<path d="M44 57Q50 65 56 57Z" fill="#E86A8A" stroke="#3A2F3C" stroke-width="2" stroke-linejoin="round"/>'
    : face === 'hurt' ? '<ellipse cx="50" cy="59.5" rx="3" ry="3.4" fill="#3A2F3C"/>'
    : face === 'strain' ? '<path d="M44 59H56" stroke="#3A2F3C" stroke-width="2.4" stroke-linecap="round"/>'
    : '<path d="M45 57Q47.5 60 50 57Q52.5 60 55 57" fill="none" stroke="#3A2F3C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  return `<ellipse cx="${cs ? 9 : 15}" cy="${cs ? 46 : 38}" rx="11" ry="${cs ? 23 : 15}" fill="${c.ear}" stroke="${c.earEdge}" stroke-width="2.6" transform="rotate(${cs ? 12 : -24} ${cs ? 9 : 15} ${cs ? 46 : 38})"/>
    <ellipse cx="${cs ? 91 : 85}" cy="${cs ? 46 : 38}" rx="11" ry="${cs ? 23 : 15}" fill="${c.ear}" stroke="${c.earEdge}" stroke-width="2.6" transform="rotate(${cs ? -12 : 24} ${cs ? 91 : 85} ${cs ? 46 : 38})"/>
    <path d="M50 8C79 8 93 31 93 59C93 86 76 100 50 100C24 100 7 86 7 59C7 31 21 8 50 8Z" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.8"/>
    <ellipse cx="11" cy="72" rx="7" ry="10" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6" transform="rotate(24 11 72)"/>
    <ellipse cx="89" cy="72" rx="7" ry="10" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6" transform="rotate(-24 89 72)"/>
    ${cs ? '<path d="M17 74Q50 88 83 74L84 82Q50 97 16 82Z" fill="#7FB2EC" stroke="#4F86C6" stroke-width="2.2" stroke-linejoin="round"/><path d="M62 86L70 100L60 97Z" fill="#7FB2EC" stroke="#4F86C6" stroke-width="2.2" stroke-linejoin="round"/>'
         : '<path d="M50 84C46 79 39 82 42 88C44 92 50 95 50 95C50 95 56 92 58 88C61 82 54 79 50 84Z" fill="#FF8FB3"/>'}
    <ellipse cx="24" cy="60" rx="8" ry="5" fill="#FF9CB8" opacity=".55"/><ellipse cx="76" cy="60" rx="8" ry="5" fill="#FF9CB8" opacity=".55"/>
    ${eyes}${mouth}
    ${cs ? '' : '<path d="M62 14L47 6L49 23Z M62 14L77 7L74 24Z" fill="#FF8FB3" stroke="#D9558C" stroke-width="2" stroke-linejoin="round"/><circle cx="62" cy="14.5" r="5" fill="#FFB3CB" stroke="#D9558C" stroke-width="2"/>'}`;
}
const gradDef = (k, id) => `<defs><radialGradient id="${id}" cx="38%" cy="26%" r="85%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="${CH[k].body}"/><stop offset="1" stop-color="${CH[k].shade}"/></radialGradient></defs>`;
// the body alone (feet are drawn on the canvas so they can step)
const bodySvg = (k, face) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112">${gradDef(k, 'g')}${partsSvg(k, face, 'g')}</svg>`;
let _uid = 0;
// the whole character for the page itself (hero, tips)
function fullSvg(k, face = 'normal') {
  const id = 'hg' + (++_uid), c = CH[k];
  return `<svg viewBox="0 0 100 112" aria-hidden="true">${gradDef(k, id)}<ellipse cx="50" cy="105" rx="34" ry="5.5" fill="rgba(60,30,20,.22)"/>
    <ellipse cx="36" cy="100" rx="11" ry="6" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6"/><ellipse cx="64" cy="100" rx="11" ry="6" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6"/>
    <g class="bd">${partsSvg(k, face, id)}</g></svg>`;
}

const ART = { img: {}, cache: new Map() };
const FACES = ['normal', 'blink', 'happy', 'hurt', 'strain'];
function loadArt() {
  const jobs = [];
  for (const k of ['cs', 'yy']) for (const f of FACES) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(bodySvg(k, f));
    ART.img[k + f] = img;
    jobs.push(new Promise((res) => { if (img.complete && img.naturalWidth) res(); else { img.onload = res; img.onerror = res; } }));
  }
  return Promise.all(jobs);
}
const artReady = loadArt();
function bodyCanvas(k, face, px) {
  px = Math.max(8, Math.round(px / 4) * 4);
  const key = k + face + px;
  let cv = ART.cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = Math.ceil(px * 100 / 112); cv.height = px;
    const img = ART.img[k + face];
    if (img && img.naturalWidth) cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    if (ART.cache.size > 80) ART.cache.clear();
    ART.cache.set(key, cv);
  }
  return cv;
}

/* ── worlds ── */
const WORLDS = [
  { key: 'spring', name: '春 · 樱花草地', icon: '🌸', sky: ['#9AD6FF', '#FFE8F2'], far: '#BFE3C8', mid: '#A3D7A6', cap: '#7CCB6E', capEdge: '#4FA35B', dirt: '#D9A77B', dirtEdge: '#B07F55', dot: '#C49261', plat: '#DFA56B', platEdge: '#A86F3A', block: '#EFDCCB', blockEdge: '#BFA58C', tree: ['#FFC6DA', '#FF9FC0'], amb: 'petal', water: null, house: '#FFE3B8', roof: '#E9707F' },
  { key: 'summer', name: '夏 · 海边', icon: '🏖️', sky: ['#7FD0FF', '#EAF9FF'], far: '#A6E6F3', mid: '#86CF86', cap: '#F7E6AE', capEdge: '#D9BD72', dirt: '#EFD18F', dirtEdge: '#C9A55E', dot: '#E2C07A', plat: '#C99B6A', platEdge: '#8F6640', block: '#DDAE7E', blockEdge: '#A2774C', tree: ['#7BC97E', '#4FA35B'], amb: 'sparkle', water: '#4FB4E8', house: '#FFF4D6', roof: '#3FA7D6' },
  { key: 'autumn', name: '秋 · 枫叶林', icon: '🍁', sky: ['#FFC18A', '#FFEBD6'], far: '#EBB088', mid: '#DE8C58', cap: '#EA8B3F', capEdge: '#B85E25', dirt: '#BB865D', dirtEdge: '#8C5C3A', dot: '#A97752', plat: '#C47D46', platEdge: '#8A4F24', block: '#DDBB95', blockEdge: '#A88560', tree: ['#F08A3C', '#D9552B'], amb: 'leaf', water: null, house: '#FFE9C9', roof: '#B5523A' },
  { key: 'winter', name: '冬 · 雪山', icon: '❄️', sky: ['#B9D6F2', '#F4F9FF'], far: '#D8E6F4', mid: '#BACDE2', cap: '#FFFFFF', capEdge: '#BFD3E8', dirt: '#97ABC4', dirtEdge: '#6E83A0', dot: '#889CB6', plat: '#D3EAF8', platEdge: '#93B9D6', block: '#E2F2FB', blockEdge: '#9EC3DE', tree: ['#5E9C7A', '#3E7A5C'], amb: 'snow', water: null, house: '#FFEFE3', roof: '#7E8FB8' },
  { key: 'night', name: '夜 · 星空', icon: '🌙', sky: ['#131A46', '#3D2F72'], far: '#2B2B62', mid: '#23234F', cap: '#8A80E0', capEdge: '#5246AE', dirt: '#3C3674', dirtEdge: '#28235A', dot: '#4B4489', plat: '#F3EFFF', platEdge: '#B9B0E8', block: '#4F4A96', blockEdge: '#332E6E', tree: ['#3B3A7A', '#2D2C66'], amb: 'firefly', water: null, house: '#FFE6B0', roof: '#C25A8C' },
];

/* ── level chunks ──
   Rows are bottom-aligned (the last string is row 12, the bottom of the
   world); rows not given are empty sky. 13 rows, ground top at row 11.
   Tiles  # ground  B block  = one-way  I ice  ^ spikes  G gift  Q gift with
          a power-up  C crumbles  u blue (CS only)  k pink (YY only)
          D gate (open while a plate in this chunk is held)  b bridge (there
          while held)  o plate  d the boss gate
   Things 1 2 starts  h heart  * star  S spring  K checkpoint  E the house
          p puffball  n chestnut (spiky)  a alarm clock  c rain cloud
          j chilli  i icicle  M V moving rafts  Y lift (rises while held)
          X heavy box  T seesaw  Z the big cloud  H sign
   The numbers that make it fair: one jump 4.2 tiles, a jump from your
   partner's head 5.4, so walls of 5 need two of you and 6+ need a spring,
   a lift or the seesaw. Gaps stay at 4 or less unless something helps. */
const CHUNKS = {
  start: { rows: ['.1.2....', '########', '########'] },
  goal: { rows: ['......E.....', '############', '############'] },
  cp: { rows: ['..K...', '######', '######'] },
  P_flat: { rows: ['.....*....', '..........', '..........', '...hhhh...', '..........', '..........', '..........', '##########', '##########'] },
  P_gap2: { rows: ['....hh....', '..........', '..........', '..........', '####..####', '####..####'] },
  P_gap3: { rows: ['.....h.....', '....h.h....', '...........', '...........', '...........', '####...####', '####...####'] },
  P_pyramid: { rows: ['.....*......', '............', '............', '............', '......h.....', '.....##h....', '....####....', '...######...', '############', '############'] },
  P_gifts: { rows: ['.....*......', '............', '............', '....G.G.....', '............', '............', '............', '############', '############'] },
  P_giftQ: { rows: ['...BQB......', '............', '............', '............', '############', '############'] },
  P_puffy: { rows: ['.......hh...', '............', '......p.....', '############', '############'] },
  P_puffy2: { rows: ['......*.......', '..............', '..............', '.....BGB......', '..............', '..............', '..p.......p...', '##############', '##############'] },
  P_float: { rows: ['.......*......', '..............', '..............', '.....===......', '..............', '..............', '###........###', '###........###'] },
  P_float2: { rows: ['.........*........', '..................', '..................', '.........==.......', '.....==......==...', '..................', '..................', '###............###', '###............###'] },
  P_spikes: { rows: ['......*.......', '..............', '....hhh..hhh..', '..............', '..............', '....^^^..^^^..', '##############', '##############'] },
  P_stairs_pit: { rows: ['..........*.....', '................', '.........===....', '................', '.....===........', '................', '................', '###.........####', '###.........####'] },
  U_spring: { rows: ['.........*..', '............', '........hhh.', '.......=====', '............', '............', '............', '............', '............', '....S.......', '############', '############'] },
  U_raft: { rows: ['........*.......', '................', '................', '.....M..........', '................', '###..........###', '###..........###'] },
  U_raft2: { rows: ['..........*.........', '....................', '...........V........', '....M...............', '....................', '###..............###', '###..............###'] },
  U_chili: { rows: ['....hhhh....', '............', '............', '............', '####....####', '####.j..####'] },
  U_alarm: { rows: ['.......*......', '..............', '..............', '......BGB.....', '..............', '..............', '...a.....a....', '##############', '##############'] },
  A_crumble: { rows: ['.......*......', '..............', '..............', '....CC..CC....', '..............', '###........###', '###........###'] },
  A_chestnut: { rows: ['........*.....', '..............', '..............', '.....BB.......', '..............', '...n.....n....', '##############', '##############'] },
  A_cloud: { rows: ['.......*........', '................', '................', '......c.........', '................', '................', '..BB......BB....', '................', '................', '################', '################'] },
  K_teach: { sign: '蓝色只有 CS 能踩，粉色只有 YY 能踩。', rows: ['..................', '........*.........', '..................', '..................', '.....kkkkkkkk.....', '..................', '.H................', '####uuuuuuuuuu####', '####..........####'] },
  K_stairs: { rows: [
    '..........#.........',
    '..........#.........',
    '......*...#.........',
    '..........#.........',
    '..........#.........',
    '......o...#......o..',
    '.....uuu..#.....kkk.',
    '....u.....#....k....',
    '...u......D...k.....',
    '..u.......D..k......',
    '.u........D.k.......',
    '####################',
    '####################'] },
  K_ride: { sign: '这座桥只有 CS 能走：YY 站到 CS 头上，让 CS 背过去！', rows: ['.........*........', '..................', '..................', '..................', '.H................', '###uuuuuuuuuuuu###', '###............###'] },
  K_ride2: { sign: '这座桥只有 YY 能走：CS 站到 YY 头上，让 YY 背过去！', rows: ['.........*........', '..................', '..................', '..................', '.H................', '###kkkkkkkkkkkk###', '###............###'] },
  W_ice: { rows: ['.....*........', '..............', '..............', '.....hhh......', '..............', '..............', '..............', 'IIIIIIII..####', '########..####'] },
  W_icicles: { rows: [
    '################',
    '################',
    '################',
    '...i....i...i...',
    '......*.........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '################',
    '################'] },
  W_icepit: { rows: ['..........*.......', '..................', '..................', '.....III....III...', '..................', '..................', '###............###', '###............###'] },
  C_stack: { sign: '叠罗汉：一个人站着别动，另一个跳到 TA 头上，再跳上墙。墙上的按钮会开门。', rows: [
    '.......*......',
    '..............',
    '..............',
    '......o.......',
    '......##......',
    '......##......',
    '......##......',
    '......DD......',
    '.H....DD......',
    '##############',
    '##############'] },
  C_relay: { sign: '按钮要有人一直踩着，门才会开。过去的人，再去踩那边的按钮帮对方开门。', rows: [
    '........#.......',
    '........#.......',
    '........#.......',
    '........#.......',
    '...*....#.......',
    '........#.......',
    '........#.......',
    '........#.......',
    '........D.......',
    '........D.......',
    '.H.o....D....o..',
    '################',
    '################'] },
  C_bridge: { sign: '有人踩着按钮，桥才会出来。', rows: ['.........*.........', '...................', '...................', '...................', '.H.o...........o...', '####bbbbbbbbb######', '####.........######'] },
  C_elev: { sign: '电梯要有人踩着按钮才会上去。', elevTop: 5, rows: [
    '.............*..',
    '................',
    '..........o.....',
    '..........######',
    '..........######',
    '..........######',
    '..........######',
    '..........######',
    '.H.o......######',
    '#######Y..######',
    '################'] },
  X_plate: { sign: '箱子太重了，要两个人一起推。一个人玩时，先「牵手」。', rows: [
    '.............#....',
    '.............#....',
    '.............#....',
    '.............#....',
    '.............#....',
    '...........*.#....',
    '.............#....',
    '.............#....',
    '.............D....',
    '..X..........D....',
    '.H......o.#..D....',
    '##################',
    '##################'] },
  X_tower: { boxMax: 6, rows: [
    '..............#.......',
    '..............#.......',
    '....*.........#.......',
    '..............#.......',
    '........o.....#.......',
    '........##....#.......',
    '........##....#.......',
    '........##....#.......',
    '..............D.......',
    '..X...........D.......',
    '..............D....o..',
    '######################',
    '######################'] },
  N_clouds: { rows: ['........*.........', '..................', '..................', '...CCC.....CCC....', '.......CC.........', '..................', '##..............##', '##..............##'] },
  N_seesaw: { sign: '跷跷板：一个人站在低的那头，另一个跳到高的那头，把 TA 弹上去！', rows: [
    '..................#.....',
    '...............*..#.....',
    '..........o.......#.....',
    '........=====.....#.....',
    '..................#.....',
    '..................#.....',
    '..................#.....',
    '..................#.....',
    '..................D.....',
    '..................D.....',
    '.H..T.............D...o.',
    '########################',
    '########################'] },
  boss: { sign: '大乌云沉下来的时候，叠罗汉跳上去踩它！踩三下。', rows: [
    '.........................d',
    '.........................d',
    '.............Z...........d',
    '.........................d',
    '...*.................*...d',
    '.........................d',
    '.........................d',
    '.........................d',
    '.........................d',
    '.........................d',
    '.H.......................d',
    '##########################',
    '##########################'] },
};
for (const id in CHUNKS) {
  const ch = CHUNKS[id];
  const w = Math.max(...ch.rows.map(r => r.length));
  const pad = Array.from({ length: 13 - ch.rows.length }, () => '.'.repeat(w));
  ch.rows = pad.concat(ch.rows).map(r => r.padEnd(w, '.'));
  ch.w = w; ch.id = id;
}

const LEVELS = [
  { name: '樱花小路', world: 0, seq: ['start', 'P_flat', 'P_gap2', 'P_gifts', 'P_puffy', 'C_stack', 'goal'], stars: [1, 3, 5],
    tip: { art: 'stack', title: '两个人一起回家', text: '两个人都走进小屋才算过关。你们不会互相挡路，还能站到对方头上：墙太高的时候，一个人站好，另一个跳到 TA 头上再跳。' } },
  { name: '蒲公英坡', world: 0, seq: ['start', 'P_pyramid', 'P_puffy2', 'C_relay', 'P_float', 'P_gap3', 'goal'], stars: [1, 3, 4],
    tip: { art: 'plate', title: '踩住按钮', text: '黄色按钮要有人一直踩着，门才会开。先过去的人，再去踩那边的按钮，帮另一个人开门。' } },
  { name: '小溪石头', world: 0, seq: ['start', 'P_gap3', 'C_bridge', 'P_spikes', 'C_stack', 'P_float', 'goal'], stars: [2, 3, 5],
    tip: { art: 'plate', title: '按钮变出桥', text: '有人踩住按钮，桥才会出来。踩的人别乱跑！' } },
  { name: '花园迷宫', world: 0, seq: ['start', 'P_puffy2', 'C_stack', 'P_stairs_pit', 'cp', 'C_relay', 'P_spikes', 'C_bridge', 'P_float2', 'goal'], stars: [3, 7, 8] },
  { name: '沙滩散步', world: 1, seq: ['start', 'P_flat', 'U_spring', 'U_raft', 'C_elev', 'goal'], stars: [2, 3, 4],
    tip: { art: 'lift', title: '弹簧和电梯', text: '跳上弹簧会弹得很高。电梯要有人踩着按钮才会上去：一个人踩，载另一个人上去，上面也有按钮可以帮回来。' } },
  { name: '浮木跳跳', world: 1, seq: ['start', 'U_raft', 'U_alarm', 'C_bridge', 'cp', 'U_raft2', 'C_elev', 'goal'], stars: [2, 5, 6] },
  { name: '椰子林', world: 1, seq: ['start', 'U_chili', 'U_spring', 'C_stack', 'P_giftQ', 'U_alarm', 'C_elev', 'goal'], stars: [2, 3, 5],
    tip: { art: 'wings', title: '小翅膀', text: '顶开蓝色礼物盒会掉出道具：小翅膀可以在空中再跳一次，泡泡能挡一下伤害。' } },
  { name: '大浪来了', world: 1, seq: ['start', 'U_raft2', 'U_chili', 'C_relay', 'cp', 'U_spring', 'U_alarm', 'C_elev', 'P_float2', 'goal'], stars: [1, 3, 8] },
  { name: '枫叶小径', world: 2, seq: ['start', 'A_chestnut', 'K_teach', 'A_crumble', 'K_ride', 'goal'], stars: [1, 2, 3],
    tip: { art: 'color', title: '蓝色和粉色', text: '蓝色方块只有 CS 能踩，粉色方块只有 YY 能踩。过不去的时候，站到对方头上，让 TA 背你过去！刺栗子不能踩。' } },
  { name: '落叶飘飘', world: 2, seq: ['start', 'A_crumble', 'A_cloud', 'K_stairs', 'cp', 'A_chestnut', 'K_ride2', 'goal'], stars: [1, 2, 5] },
  { name: '栗子山', world: 2, seq: ['start', 'A_chestnut', 'C_stack', 'K_stairs', 'A_cloud', 'cp', 'A_crumble', 'C_bridge', 'goal'], stars: [2, 4, 7] },
  { name: '红叶桥', world: 2, seq: ['start', 'K_teach', 'A_crumble', 'K_ride', 'cp', 'A_cloud', 'K_stairs', 'P_float2', 'C_relay', 'goal'], stars: [1, 5, 7] },
  { name: '第一场雪', world: 3, seq: ['start', 'W_ice', 'X_plate', 'W_icicles', 'goal'], stars: [1, 2, 3],
    tip: { art: 'box', title: '一起推', text: '箱子太重了，要两个人一起推才动。一个人玩的时候，先「牵手」，两个人就会一起走。冰面很滑，冰柱会掉下来！' } },
  { name: '滑滑冰面', world: 3, seq: ['start', 'W_ice', 'W_icepit', 'X_plate', 'cp', 'W_icicles', 'C_stack', 'goal'], stars: [2, 3, 6] },
  { name: '冰柱洞', world: 3, seq: ['start', 'W_icicles', 'X_tower', 'cp', 'W_icepit', 'K_stairs', 'goal'], stars: [1, 2, 4] },
  { name: '雪山顶', world: 3, seq: ['start', 'W_ice', 'X_tower', 'W_icicles', 'cp', 'X_plate', 'W_icepit', 'C_relay', 'goal'], stars: [2, 5, 7] },
  { name: '星星路', world: 4, seq: ['start', 'N_clouds', 'N_seesaw', 'P_float2', 'goal'], stars: [1, 2, 3],
    tip: { art: 'seesaw', title: '跷跷板', text: '一个人站在低的那头，另一个跳到高的那头，就能把 TA 弹上天。云朵站一下就会散，快走！' } },
  { name: '云朵阶梯', world: 4, seq: ['start', 'N_clouds', 'K_ride', 'N_seesaw', 'cp', 'A_cloud', 'X_plate', 'goal'], stars: [1, 3, 5] },
  { name: '流星雨', world: 4, seq: ['start', 'A_cloud', 'N_seesaw', 'K_stairs', 'cp', 'N_clouds', 'X_tower', 'C_bridge', 'goal'], stars: [2, 5, 6] },
  { name: '回家的烟花', world: 4, seq: ['start', 'N_clouds', 'cp', 'boss', 'goal'], stars: [1, 3], final: true,
    tip: { art: 'boss', title: '最后一关', text: '大乌云只有沉下来的时候才踩得到，可它还是太高：一个人站到另一个人头上再跳。踩三下，就能一起回家看烟花。' } },
];

/* ══════════════ the engine ══════════════ */
const R = 13;
const PW = 0.78, PH = 1.18;
const RUN = 7.5, ACC = 62, DEC = 72, AIR_ACC = 42, AIR_DEC = 22, ICE_ACC = 13, ICE_DEC = 3.2;
const GRAV = 52, JUMP_V = 21, MAXFALL = 21, SPRING_V = 29, STEP = 1 / 120, ZMIN = 0.62, HP_MAX = 5;
const T_GROUND = 1, T_BLOCK = 2, T_PLAT = 3, T_ICE = 4, T_SPIKE = 5, T_GIFT = 6, T_GIFTQ = 7, T_USED = 8, T_CRUMB = 9, T_BLUE = 10, T_PINK = 11, T_GATE = 12, T_BRIDGE = 13, T_PLATE = 14, T_BGATE = 15;
const TILE_OF = { '#': 1, B: 2, '=': 3, I: 4, '^': 5, G: 6, Q: 7, C: 9, u: 10, k: 11, D: 12, b: 13, o: 14, d: 15 };

const G = {
  L: null, mode: 'duo', petImg: null, petName: '', meIdx: 0, wt: 0,
  active: 0, hold: false, state: 'off', test: false, players: [], chanOn: null, chanA: null, crumbs: new Map(),
  hp: HP_MAX, hearts: 0, stars: [false, false, false], time: 0, clock: 0, cp: null, bossDown: false, rainbow: 0,
  proj: [], parts: [], fx: [], amb: [], shells: [], sparks: [], cam: { x: 0, z: 1 }, hint: null, wonT: 0, shake: 0,
  save: { unlocked: 1, best: {} },
};
// one phone, both people (duo/solo), or each on their own phone (online)
const ONLINE = () => G.mode === 'online';
const isLocal = (p) => !ONLINE() || p.idx === G.meIdx;
const isHost = () => !ONLINE() || NET.role === 'host';

function makePlayer(idx, sp) {
  return { idx, k: idx ? 'yy' : 'cs', x: sp.x, y: sp.y, w: PW, h: PH, vx: 0, vy: 0, dx: 0, dy: 0, px: sp.x, py: sp.y, face: idx ? -1 : 1,
    grounded: false, ground: null, coyote: 0, jbuf: 0, prevJ: false, inv: 0, lock: 0, wings: false, usedDouble: false, shield: false,
    launch: null, springy: false, dead: 0, push: null, strain: 0, happy: 0,
    an: { t: 0, run: 0, squash: 0, blinkT: 1 + idx, blink: 0, flap: 0 } };
}

function buildLevel(i) {
  const spec = LEVELS[i], world = WORLDS[spec.world];
  const chunks = []; let w = 0;
  spec.seq.forEach((id, n) => { const ch = CHUNKS[id]; chunks.push({ ch, x0: w, n }); w += ch.w; });
  const L = { i, spec, world, w, grid: new Uint8Array(w * R), chunkOf: new Int16Array(w), chunks, plates: [], signs: [], decor: [], spawn: [], door: null, cps: [],
    items: [], enemies: [], movers: [], elevs: [], springs: [], boxes: [], seesaws: [], boss: null, heartsTotal: 0, qCount: 0 };
  const rng = mulberry(1000 + i * 7919);
  for (const c of chunks) {
    for (let x = 0; x < c.ch.w; x++) L.chunkOf[c.x0 + x] = c.n;
    const starOn = spec.stars.includes(c.n);
    for (let r = 0; r < R; r++) for (let x = 0; x < c.ch.w; x++) {
      const ch = c.ch.rows[r][x], gx = c.x0 + x, t = TILE_OF[ch];
      if (t) { L.grid[r * w + gx] = t; if (t === T_PLATE) L.plates.push({ c: gx, r, ch: c.n, down: false }); continue; }
      if (ch !== '.') marker(L, ch, gx, r, c, starOn, rng);
    }
  }
  for (let x = 0; x < w; x++) for (let r = 1; r < R; r++) {
    if (L.grid[r * w + x] === T_GROUND && L.grid[(r - 1) * w + x] === 0 && rng() < 0.3) L.decor.push({ x: x + 0.15 + rng() * 0.7, y: r, k: (rng() * 4) | 0, s: 0.75 + rng() * 0.45 });
  }
  L.surfs = [...L.movers, ...L.elevs, ...L.springs, ...L.boxes, ...L.seesaws];
  return L;
}

function marker(L, ch, x, r, c, starOn, rng) {
  const cx = x + 0.5, foot = r + 1;
  switch (ch) {
    case '1': case '2': L.spawn[ch === '1' ? 0 : 1] = { x: cx - PW / 2, y: foot - PH }; break;
    case 'h': L.items.push({ type: 'heart', x: cx, y: r + 0.5, ph: rng() * 6 }); L.heartsTotal++; break;
    case '*':
      if (starOn) L.items.push({ type: 'star', x: cx, y: r + 0.5, ph: rng() * 6, n: L.items.filter(it => it.type === 'star').length });
      else { L.items.push({ type: 'heart', x: cx, y: r + 0.5, ph: rng() * 6 }); L.heartsTotal++; }
      break;
    case 'S': L.springs.push({ kind: 'spring', x0: x + 0.08, x1: x + 0.92, y: foot - 0.55, squash: 0, dx: 0, dy: 0 }); break;
    case 'K': L.cps.push({ x: cx, y: foot, on: false }); break;
    case 'E': L.door = { x: cx, y: foot, open: 0, wait: -1 }; break;
    case 'H': L.signs.push({ x: cx, y: foot, text: c.ch.sign || '' }); break;
    case 'p': case 'n': case 'a': {
      const ew = ch === 'a' ? 0.84 : 0.9, eh = ch === 'p' ? 0.8 : 0.86;
      const sp = ch === 'n' ? 1.15 : ch === 'p' ? 1.4 + L.i * 0.03 : 0;
      L.enemies.push({ type: ch, x: cx - ew / 2, y: foot - eh, w: ew, h: eh, vx: -sp, vy: 0, dead: 0, t: 0.5 + rng() * 0.8, onGround: false, px: 0, py: 0 });
      break;
    }
    case 'c': L.enemies.push({ type: 'c', x0: cx, y0: r + 0.4, x: cx - 0.7, y: r, w: 1.4, h: 0.8, dead: 0, t: rng() * 6, drop: 1 + rng(), px: 0, py: 0 }); break;
    case 'j': L.enemies.push({ type: 'j', x: cx - 0.35, y: R + 0.6, base: R + 0.6, w: 0.7, h: 0.9, vy: 0, dead: 0, t: 0.4 + rng() * 1.4, up: false, px: 0, py: 0 }); break;
    case 'i': L.enemies.push({ type: 'i', x: cx - 0.28, y: r, w: 0.56, h: 0.9, vy: 0, dead: 0, t: 0, st: 'hang', px: 0, py: 0 }); break;
    case 'M': case 'V': L.movers.push({ kind: 'mover', axis: ch === 'M' ? 'x' : 'y', ox: x, oy: r + 0.15, x: x, y: r + 0.15, x0: x, x1: x + 3, w: 3, range: 2.5, period: ch === 'M' ? 4.2 : 4.6, t: 0, dx: 0, dy: 0, px: x, py: r + 0.15 }); break;
    case 'Y': L.elevs.push({ kind: 'elev', x0: x, x1: x + 3, y: r, py: r, yBot: r, yTop: c.ch.elevTop != null ? c.ch.elevTop : r - 5, ch: c.n, dx: 0, dy: 0 }); break;
    case 'X': L.boxes.push({ kind: 'box', x, y: r, w: 2, h: 2, ox: x, oy: r, vx: 0, vy: 0, minX: c.x0, maxX: c.x0 + (c.ch.boxMax != null ? c.ch.boxMax : c.ch.w - 2), x0: x, x1: x + 2, dx: 0, dy: 0, px: x, py: r, strain: 0 }); break;
    case 'T': L.seesaws.push({ kind: 'seesaw', px: x + 0.5, py: r + 0.35, half: 2.5, max: 0.262, ang: 0.262, x0: x + 0.5 - 2.5, x1: x + 0.5 + 2.5, flip: 0, flipTo: 0, dx: 0, dy: 0 }); break;
    case 'Z': L.boss = { x: x - 1, y: 1.6, px: x - 1, py: 1.6, w: 3, h: 2, hp: 3, st: 'float', t: 3.5, inv: 0, rain: 1.4, ax0: c.x0 + 2, ax1: c.x0 + c.ch.w - 6, dead: 0 }; break;
  }
}

/* ── tiles ── */
const code = (c, r) => (r < 0 || r >= R ? 0 : c < 0 || c >= G.L.w ? T_GROUND : G.L.grid[r * G.L.w + c]);
function crumbSolid(c, r) { const s = G.crumbs.get(r * G.L.w + c); return !s || s.st !== 'gone'; }
function solidCell(c, r, who) {
  if (r < 0 || r >= R) return false;
  if (c < 0 || c >= G.L.w) return true;
  switch (G.L.grid[r * G.L.w + c]) {
    case T_GROUND: case T_BLOCK: case T_ICE: case T_GIFT: case T_GIFTQ: case T_USED: return true;
    case T_BLUE: return who !== 'yy';
    case T_PINK: return who !== 'cs';
    case T_GATE: return !G.chanOn[G.L.chunkOf[c]];
    case T_BGATE: return !G.bossDown;
    default: return false;
  }
}
function oneWayCell(c, r) {
  if (r < 0 || r >= R || c < 0 || c >= G.L.w) return false;
  const t = G.L.grid[r * G.L.w + c];
  if (t === T_PLAT) return true;
  if (t === T_CRUMB) return crumbSolid(c, r);
  if (t === T_BRIDGE) return !!G.chanOn[G.L.chunkOf[c]];
  return false;
}
function overlapsSolid(b, who) {
  const c0 = Math.floor(b.x + 1e-6), c1 = Math.floor(b.x + b.w - 1e-6), r0 = Math.floor(b.y + 1e-6), r1 = Math.floor(b.y + b.h - 1e-6);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidCell(c, r, who)) return true;
  if (who !== 'box') for (const bx of G.L.boxes) if (bx !== b && b.x < bx.x + bx.w - 1e-4 && b.x + b.w > bx.x + 1e-4 && b.y < bx.y + bx.h - 1e-4 && b.y + b.h > bx.y + 1e-4) return true;
  return false;
}
// if something closed on a body (a gate, a box), put it beside the thing instead
function unstick(b, who) {
  if (!overlapsSolid(b, who)) return;
  const x0 = b.x, y0 = b.y;
  for (let d = 0.1; d <= 3; d += 0.1) for (const [ox, oy] of [[d, 0], [-d, 0], [0, -d], [d, -d], [-d, -d]]) {
    b.x = x0 + ox; b.y = y0 + oy;
    if (!overlapsSolid(b, who)) return;
  }
  b.x = x0; b.y = y0;
}

function moveX(b, dx, who) {
  if (!dx) return null;
  let nx = b.x + dx, hit = null;
  const r0 = Math.floor(b.y + 1e-3), r1 = Math.floor(b.y + b.h - 1e-3);
  if (dx > 0) {
    const cA = Math.floor(b.x + b.w - 1e-6) + 1, cB = Math.floor(nx + b.w - 1e-6);
    outer: for (let c = cA; c <= cB; c++) for (let r = r0; r <= r1; r++) if (solidCell(c, r, who)) { nx = c - b.w; hit = { c, r }; break outer; }
  } else {
    const cA = Math.floor(b.x + 1e-6) - 1, cB = Math.floor(nx + 1e-6);
    outer2: for (let c = cA; c >= cB; c--) for (let r = r0; r <= r1; r++) if (solidCell(c, r, who)) { nx = c + 1; hit = { c, r }; break outer2; }
  }
  if (who !== 'box') for (const bx of G.L.boxes) {
    if (bx === b || b.y + b.h <= bx.y + 1e-3 || b.y >= bx.y + bx.h - 1e-3) continue;
    if (dx > 0 && b.x + b.w <= bx.x + 1e-3 && nx + b.w > bx.x) { nx = bx.x - b.w; hit = { box: bx }; }
    if (dx < 0 && b.x >= bx.x + bx.w - 1e-3 && nx < bx.x + bx.w) { nx = bx.x + bx.w; hit = { box: bx }; }
  }
  b.x = nx;
  return hit;
}

function surfTop(s, x) {
  if (s.kind === 'seesaw') return s.py + (clamp(x, s.x0, s.x1) - s.px) * Math.tan(s.ang) - 0.12;
  if (s.kind === 'player') return s.ref.y;
  if (s.kind === 'spring') return s.y + s.squash * 0.22;
  return s.y;
}
function moveY(b, dy, who, surfs) {
  let ny = b.y + dy, land = null, head = null;
  const c0 = Math.floor(b.x + 1e-6), c1 = Math.floor(b.x + b.w - 1e-6);
  if (dy > 0) {
    const bot = b.y + b.h, nbot = ny + b.h;
    const rA = Math.max(0, Math.floor(bot - 1e-6) + 1), rB = Math.min(R - 1, Math.floor(nbot - 1e-6));
    outer: for (let r = rA; r <= rB; r++) for (let c = c0; c <= c1; c++) {
      if (solidCell(c, r, who) || (who !== 'proj' && oneWayCell(c, r))) { ny = r - b.h; land = { kind: 'tile', code: code(c, r), c, r }; break outer; }
    }
    if (surfs) for (const s of surfs) {
      if (s === b || s.ref === b) continue;
      if (b.x + b.w <= s.x0 + 0.03 || b.x >= s.x1 - 0.03) continue;
      const top = surfTop(s, b.x + b.w / 2), prev = top - (s.dy || 0);
      if (bot <= Math.max(top, prev) + 0.05 && nbot >= top - 1e-6 && top - b.h <= ny + 1e-6) { ny = top - b.h; land = { kind: s.kind, ref: s.kind === 'player' ? s.ref : s }; }
    }
  } else if (dy < 0) {
    const top = b.y, ntop = ny;
    const rA = Math.min(R - 1, Math.floor(top + 1e-6) - 1), rB = Math.max(0, Math.floor(ntop + 1e-6));
    outer2: for (let r = rA; r >= rB; r--) for (let c = c0; c <= c1; c++) if (solidCell(c, r, who)) { ny = r + 1; head = { c, r, code: code(c, r) }; break outer2; }
    if (who !== 'box') for (const bx of G.L.boxes) {
      if (bx === b || b.x + b.w <= bx.x + 0.02 || b.x >= bx.x + bx.w - 0.02) continue;
      if (top >= bx.y + bx.h - 0.05 && ntop < bx.y + bx.h) { ny = Math.max(ny, bx.y + bx.h); head = { box: bx }; }
    }
  }
  b.y = ny;
  return { land, head };
}

/* ── the level's moving parts ── */
function updatePlates() {
  const on = G.chanOn; on.fill(0);
  for (const pl of G.L.plates) {
    const was = pl.down; pl.down = false;
    const x0 = pl.c + 0.06, x1 = pl.c + 0.94, floor = pl.r + 1;
    for (const p of G.players) if (!p.dead && p.grounded && Math.abs(p.y + p.h - floor) < 0.08 && p.x < x1 && p.x + p.w > x0) pl.down = true;
    for (const b of G.L.boxes) if (Math.abs(b.y + b.h - floor) < 0.08 && b.x < x1 && b.x + b.w > x0) pl.down = true;
    if (pl.down) on[pl.ch] = 1;
    if (pl.down !== was) sfx(pl.down ? 'click' : 'unclick');
  }
}
function updateMover(m) {
  m.px = m.x; m.py = m.y;
  const s = Math.sin(G.wt * 2 * Math.PI / m.period);   // world time: both phones agree where a raft is
  const nx = m.axis === 'x' ? m.ox + s * m.range : m.ox, ny = m.axis === 'y' ? m.oy + s * m.range : m.oy;
  m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny; m.x0 = nx; m.x1 = nx + m.w;
}
function updateElev(e, dt) {
  e.py = e.y;
  const ny = approach(e.y, G.chanOn[e.ch] ? e.yTop : e.yBot, 3.2 * dt);
  e.dy = ny - e.y; e.dx = 0; e.y = ny;
}
function updateSeesaw(s, dt) {
  let torque = 0;
  for (const p of G.players) if (!p.dead && p.grounded && p.ground && p.ground.ref === s) torque += p.x + p.w / 2 - s.px;
  if (s.flip > 0) s.flip -= dt;
  const target = s.flip > 0 ? s.flipTo : torque > 0.2 ? s.max : torque < -0.2 ? -s.max : s.ang;
  s.ang = approach(s.ang, target, (s.flip > 0 ? 14 : 2.4) * dt);
}
function updateBox(b, dt) {
  b.px = b.x; b.py = b.y;
  let pr = 0, pl = 0;
  for (const p of G.players) {
    if (p.dead) continue;
    const m = p.push && p.push.box === b ? p.push : p.pushMem && p.pushMem.box === b && G.clock - p.pushMem.t < 0.25 ? p.pushMem : null;
    if (m) { if (m.dir > 0) pr++; else pl++; }
  }
  const want = pr >= 2 ? 1 : pl >= 2 ? -1 : 0;
  b.strain = (pr === 1 || pl === 1) && !want ? Math.min(1, b.strain + dt * 3) : Math.max(0, b.strain - dt * 2);
  const ox = b.x, oy = b.y;
  b.vy = Math.min(MAXFALL, b.vy + GRAV * 1.3 * dt);
  if (want) {
    const nx = clamp(b.x + want * 1.7 * dt, b.minX, b.maxX);
    moveX(b, nx - b.x, 'box');
    // anyone standing in its way is pushed along, or the box stops
    for (const p of G.players) {
      if (p.dead || (p.push && p.push.box === b) || !isLocal(p)) continue;
      if (p.y + p.h <= b.y + 0.02 || p.y >= b.y + b.h - 0.02) continue;
      if (p.x < b.x + b.w && p.x + p.w > b.x) { const before = p.x; moveX(p, b.x - ox, p.k); if (Math.abs(p.x - before) < Math.abs(b.x - ox) - 1e-4) { b.x = ox; break; } }
    }
  }
  const r = moveY(b, b.vy * dt, 'box', null);
  if (r.land) b.vy = 0;
  b.dx = b.x - ox; b.dy = b.y - oy; b.x0 = b.x; b.x1 = b.x + b.w;
  if (b.y > R + 2) { puff(b.x + 1, R - 1, '#FFFFFF', 12); b.x = b.ox; b.y = b.oy; b.vy = 0; b.x0 = b.x; b.x1 = b.x + 2; puff(b.x + 1, b.y + 1, '#FFE08A', 14); }
}
function updateCrumbs(dt) {
  for (const [key, s] of G.crumbs) {
    s.t -= dt;
    if (s.t > 0) continue;
    if (s.st === 'shake') { s.st = 'gone'; s.t = 3.2; const c = key % G.L.w, r = (key / G.L.w) | 0; puff(c + 0.5, r + 0.3, G.L.world.key === 'night' ? '#FFFFFF' : '#E9A35C', 6); sfx('crumble'); }
    else if (s.st === 'gone') {
      const c = key % G.L.w, r = (key / G.L.w) | 0;
      const busy = G.players.some(p => !p.dead && p.x < c + 1 && p.x + p.w > c && p.y < r + 1 && p.y + p.h > r);
      if (busy) s.t = 0.3; else G.crumbs.delete(key);
    }
  }
}
function triggerCrumb(c, r, fromNet) {
  const w = G.L.w;
  if (G.crumbs.has(r * w + c)) return;
  if (!fromNet) netEv('crumb', { c, r });
  let a = c, b = c;
  while (code(a - 1, r) === T_CRUMB) a--;
  while (code(b + 1, r) === T_CRUMB) b++;
  for (let x = a; x <= b; x++) if (!G.crumbs.has(r * w + x)) G.crumbs.set(r * w + x, { st: 'shake', t: 0.55 });
}

/* ── input ── */
const NONE = { l: false, r: false, j: false };
const KEYS = new Set();
const TOUCH = { solo: { l: 0, r: 0, j: 0 }, duo: [{ l: 0, r: 0, j: 0 }, { l: 0, r: 0, j: 0 }] };
const TEST_IN = [NONE, NONE];
function duoRaw(i) {
  if (G.test) return TEST_IN[i];
  const t = TOUCH.duo[i];
  return i === 0
    ? { l: KEYS.has('KeyA') || !!t.l, r: KEYS.has('KeyD') || !!t.r, j: KEYS.has('KeyW') || !!t.j }
    : { l: KEYS.has('ArrowLeft') || !!t.l, r: KEYS.has('ArrowRight') || !!t.r, j: KEYS.has('ArrowUp') || !!t.j };
}
function soloRaw() {
  if (G.test) return TEST_IN[0];
  const t = TOUCH.solo;
  return { l: KEYS.has('KeyA') || KEYS.has('ArrowLeft') || !!t.l, r: KEYS.has('KeyD') || KEYS.has('ArrowRight') || !!t.r,
    j: KEYS.has('KeyW') || KEYS.has('ArrowUp') || KEYS.has('Space') || !!t.j };
}
function inputFor(p) {
  if (G.state !== 'play') return NONE;
  if (ONLINE()) return p.idx === G.meIdx ? soloRaw() : NONE;
  if (G.mode === 'duo') return duoRaw(p.idx);
  return p.idx === G.active || G.hold ? soloRaw() : NONE;
}

/* ── the two of you ── */
function surfsFor(p) {
  const q = G.players[1 - p.idx], list = G.L.surfs.slice();
  if (q && !q.dead) list.push({ kind: 'player', ref: q, x0: q.x + 0.06, x1: q.x + q.w - 0.06, dy: q.dy });
  return list;
}
const carrying = (p) => G.players.some(q => q !== p && !q.dead && q.grounded && q.ground && q.ground.ref === p);
function doJump(p, v) {
  const g = p.ground && p.ground.ref;
  if (g && g.dx) p.vx += g.dx / STEP * 0.9;   // leave a moving thing with its speed
  p.vy = -v; p.grounded = false; p.ground = null; p.coyote = 0; p.jbuf = 0;
  sfx('jump'); dust(p.x + p.w / 2, p.y + p.h, 4);
}

function updatePlayer(p, dt) {
  p.px = p.x; p.py = p.y;
  const sx = p.x, sy = p.y;
  if (p.inv > 0) p.inv -= dt;
  if (p.dead > 0) {
    p.dead -= dt; p.waitT = (p.waitT || 0) + dt;
    if (p.dead <= 0) {
      // come back next to your partner, never behind a gate you can't open alone:
      // wait while they are in the air or on something moving
      const q = G.players[1 - p.idx];
      const safe = q && !q.dead && q.grounded && q.ground && (q.ground.kind === 'tile' || q.ground.kind === 'box') && q.y > 2;
      if (safe || !q || q.dead || p.waitT > 4) { p.waitT = 0; respawn(p); } else p.dead = 0.001;
    }
    p.dx = p.dy = 0; return;
  }
  const inp = inputFor(p);
  const jp = inp.j && !p.prevJ; p.prevJ = inp.j;
  // ride whatever you are standing on
  if (p.grounded && p.ground && p.ground.ref) {
    const g = p.ground.ref;
    if (p.ground.kind === 'seesaw') {
      const d = surfTop(g, p.x + p.w / 2) - (p.y + p.h);
      if (d < 0) moveY(p, d, p.k, null); else p.y += Math.min(d, 0.4);
    } else {
      if (g.dx) moveX(p, g.dx, p.k);
      if (g.dy) { if (g.dy < 0) moveY(p, g.dy, p.k, null); else p.y += g.dy; }
    }
  }
  let dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (p.lock > 0) { p.lock -= dt; dir = 0; }
  const ice = p.grounded && p.ground && p.ground.kind === 'tile' && p.ground.code === T_ICE;
  if (p.launch) { if (dir) p.launch = null; else p.vx = p.launch.vx; }
  if (!p.launch) {
    const acc = p.grounded ? (ice ? ICE_ACC : ACC) : AIR_ACC, dec = p.grounded ? (ice ? ICE_DEC : DEC) : AIR_DEC;
    if (dir) { const turn = p.vx * dir < 0; p.vx = approach(p.vx, dir * RUN, (turn ? acc + (ice ? 2 : dec) : acc) * dt); p.face = dir; }
    else p.vx = approach(p.vx, 0, dec * dt);
  }
  if (jp) p.jbuf = 0.13; else p.jbuf = Math.max(0, p.jbuf - dt);
  p.coyote = p.grounded ? 0.1 : Math.max(0, p.coyote - dt);
  const heavy = carrying(p);
  if (p.jbuf > 0) {
    if (p.coyote > 0 && !heavy) doJump(p, JUMP_V);
    else if (p.coyote > 0 && heavy) { p.jbuf = 0; p.strain = 0.5; }
    else if (!p.grounded && p.wings && !p.usedDouble) { doJump(p, JUMP_V * 0.92); p.usedDouble = true; p.an.flap = 0.4; }
  }
  const g = p.vy < 0 ? (inp.j || p.launch || p.springy ? GRAV : GRAV * 2.3) : GRAV * 1.35;
  p.vy = Math.min(MAXFALL, p.vy + g * dt);
  p.push = null;
  const hit = moveX(p, p.vx * dt, p.k);
  if (hit) { if (hit.box && p.grounded && dir && dir === Math.sign(p.vx)) p.push = { box: hit.box, dir }; if (!p.launch) p.vx = 0; }
  // leaning on a box you are right next to counts too: on two phones the box is a
  // moment late on one of them, and a push that flickers on and off barely moves it
  if (!p.push && p.grounded && dir) for (const b of G.L.boxes) {
    const gap = dir > 0 ? b.x - (p.x + p.w) : p.x - (b.x + b.w);
    if (gap > -0.05 && gap < 0.3 && p.y + p.h > b.y + 0.1 && p.y < b.y + b.h) { p.push = { box: b, dir }; break; }
  }
  if (p.push) p.pushMem = { box: p.push.box, dir: p.push.dir, t: G.clock };
  const was = p.grounded, vyIn = p.vy;
  const res = moveY(p, p.vy * dt, p.k, surfsFor(p));
  if (res.land) {
    p.vy = 0; p.grounded = true; p.ground = res.land; p.usedDouble = false; p.launch = null; p.springy = false;
    if (!was && vyIn > 7) { p.an.squash = Math.min(1, vyIn / 22); dust(p.x + p.w / 2, p.y + p.h, 3); }
    landOn(p, res.land, vyIn);
  } else { p.grounded = false; p.ground = null; }
  if (res.head) { p.vy = Math.max(0, p.vy); if (res.head.code === T_GIFT || res.head.code === T_GIFTQ) hitGift(res.head.c, res.head.r); }
  if (p.y > R + 0.6) fall(p);
  // looks
  const a = p.an;
  a.run = approach(a.run, p.grounded ? Math.min(1, Math.abs(p.vx) / RUN) : 0, dt * 8);
  a.t += dt * (Math.abs(p.vx) / RUN) * 2.8;
  a.squash = Math.max(0, a.squash - dt * 6);
  a.flap = Math.max(0, a.flap - dt);
  a.blinkT -= dt; if (a.blinkT <= 0) { a.blink = 0.12; a.blinkT = 2 + Math.random() * 2.6; }
  a.blink = Math.max(0, a.blink - dt);
  p.strain = heavy ? 0.3 : Math.max(0, p.strain - dt);
  if (p.happy > 0) p.happy -= dt;
  p.dx = p.x - sx; p.dy = p.y - sy;
}

function landOn(p, land, vyIn) {
  if (land.kind === 'tile' && land.code === T_CRUMB) triggerCrumb(land.c, land.r);
  if (land.kind === 'spring') {
    const s = land.ref; s.squash = 1;
    p.vy = -SPRING_V; p.grounded = false; p.ground = null; p.springy = true; sfx('spring');
  } else if (land.kind === 'seesaw') {
    const s = land.ref, side = Math.sign(p.x + p.w / 2 - s.px);
    const raised = side !== 0 && side === -Math.sign(s.ang);   // landing on the end that is up
    if (raised && vyIn > 8 && s.flip <= 0) {
      s.flip = 0.14; s.flipTo = side * s.max; sfx('boing');
      // the partner on the other end is thrown; on their own phone if they are not on this one
      if (ONLINE()) netEv('launch', { s: G.L.seesaws.indexOf(s), side, vy: Math.min(33, 13 + vyIn * 0.9) });
      for (const q of G.players) {
        if (q === p || q.dead || !q.grounded || !q.ground || q.ground.ref !== s || !isLocal(q)) continue;
        if (Math.sign(q.x + q.w / 2 - s.px) !== -side) continue;
        q.vy = -Math.min(33, 13 + vyIn * 0.9); q.grounded = false; q.ground = null; q.launch = { vx: -side * 4 }; q.happy = 1;
        sparkle(q.x + q.w / 2, q.y + q.h, '#FFE08A', 12);
      }
    }
  }
}
function hitGift(c, r, fromNet) {
  const t = code(c, r);
  G.bumps.push({ c, r, t: 0.22 });
  if (t !== T_GIFT && t !== T_GIFTQ) return;
  if (!fromNet) netEv('gift', { c, r });
  G.L.grid[r * G.L.w + c] = T_USED;
  if (t === T_GIFT) {
    for (let k = 0; k < 3; k++) G.fx.push({ kind: 'popheart', x: c + 0.5, y: r - 0.1, vx: (k - 1) * 1.6, vy: -8 - (k % 2) * 2, t: 0.75, max: 0.75 });
    addHearts(3, c + 0.5, r - 1); sfx('gift');
  } else {
    const type = G.L.qCount++ % 2 === 0 ? 'wings' : 'shield';
    G.L.items.push({ type, x: c + 0.5, y: r + 0.5, ph: 0, rise: 0.55, key: 'q' + c + '_' + r }); sfx('gift');
  }
}
function addHearts(n, x, y) {
  for (let k = 0; k < n; k++) {
    G.hearts++;
    if (G.hearts % 30 === 0 && G.hp < HP_MAX) { G.hp++; G.fx.push({ kind: 'text', text: '❤ +1', x, y: y - 0.5, t: 1.2, max: 1.2, col: '#FF5C93' }); sfx('life'); }
  }
}
function fall(p) {
  if (p.dead) return;
  sfx('fall'); p.dead = 0.75; p.waitT = 0; p.vx = p.vy = 0; p.wings = false; p.shield = false; G.hold = false; syncHold();
  loseHp();
}
// the shared hearts live on the host's phone; the other phone says what happened to it
function hurt(p, fromX) {
  if (p.dead || p.inv > 0 || G.state !== 'play') return;
  if (p.shield) { p.shield = false; p.inv = 1; sfx('pop'); sparkle(p.x + p.w / 2, p.y + p.h / 2, '#9FE3FF', 14); return; }
  p.inv = 1.4; p.lock = 0.22; p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 6; p.vy = -10; p.grounded = false; p.ground = null; p.launch = null; p.wings = false;
  G.hold = false; syncHold(); sfx('hurt'); loseHp();
}
function loseHp(fromNet) {
  if (G.god) return;   // play-testing only: knock-backs still happen, hearts don't drop
  G.shake = fromNet ? G.shake : 0.25;
  if (ONLINE() && !isHost()) { if (!fromNet) { G.hp = Math.max(0, G.hp - 1); netEv('hit', {}); } return; }
  G.hp = Math.max(0, G.hp - 1);
  if (G.hp <= 0 && G.state === 'play') { G.state = 'dying'; G.failT = 0.9; netEv('fail', {}); }
}
function respawn(p) {
  const q = G.players[1 - p.idx];
  p.vx = p.vy = 0; p.grounded = false; p.ground = null; p.launch = null; p.springy = false; p.inv = 1.6; p.dead = 0;
  if (q && !q.dead && q.grounded && q.ground && (q.ground.kind === 'tile' || q.ground.kind === 'box') && q.y > 2) {
    p.x = q.x; p.y = q.y - p.h - 0.3;
    if (overlapsSolid(p, p.k)) { p.y = q.y; p.x = q.x + (q.x > 2 ? -0.9 : 0.9); }
    unstick(p, p.k);
  } else { p.x = G.cp.x + (p.idx ? 0.45 : -0.45) - p.w / 2; p.y = G.cp.y - p.h; }
  p.px = p.x; p.py = p.y;
  sparkle(p.x + p.w / 2, p.y + p.h / 2, '#FFD6E6', 12);
}
// two people on one screen can't wander further apart than it can show
function keepTogether() {
  if (G.mode !== 'duo') return;
  const [a, b] = G.players;
  if (a.dead || b.dead) return;
  const max = V.viewW / ZMIN - 2.5, d = b.x - a.x;
  if (Math.abs(d) <= max) return;
  const m = Math.abs(a.x - a.px) >= Math.abs(b.x - b.px) ? a : b;
  const away = m === a ? -Math.sign(d) : Math.sign(d);
  moveX(m, -away * (Math.abs(d) - max), m.k); m.vx = 0;
}
function updateHold() {
  if (!G.hold) return;
  const [a, b] = G.players;
  if (G.mode !== 'solo' || a.dead || b.dead || Math.abs(a.x - b.x) > 3.2 || Math.abs(a.y - b.y) > 3) { G.hold = false; syncHold(); }
}

/* ── things that are not on your side ── */
function nearestPlayer(e) {
  let best = null, bd = 1e9;
  for (const p of G.players) if (!p.dead) { const d = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)); if (d < bd) { bd = d; best = p; } }
  return best;
}
function updateEnemy(e, dt) {
  e.px = e.x; e.py = e.y;
  if (e.dead) { e.dead -= dt; return; }
  if (e.type === 'p' || e.type === 'n') {
    e.vy = Math.min(MAXFALL, e.vy + GRAV * 1.3 * dt);
    if (moveX(e, e.vx * dt, 'enemy')) e.vx = -e.vx;
    const r = moveY(e, e.vy * dt, 'enemy', null);
    e.onGround = !!r.land; if (r.land) e.vy = 0;
    if (e.onGround) {
      const fx = e.vx > 0 ? e.x + e.w + 0.05 : e.x - 0.05, row = Math.floor(e.y + e.h + 0.1), c = Math.floor(fx);
      if (!solidCell(c, row, 'enemy') && !oneWayCell(c, row)) e.vx = -e.vx;
    }
    e.t += dt;
  } else if (e.type === 'a') {
    e.vy = Math.min(MAXFALL, e.vy + GRAV * 1.3 * dt);
    if (e.onGround) {
      e.vx = approach(e.vx, 0, 20 * dt); e.t -= dt;
      if (e.t <= 0) {
        const t = nearestPlayer(e);
        let dir = t && Math.abs(t.x - e.x) < 9 ? Math.sign(t.x - e.x) || 1 : (e.vx >= 0 ? -1 : 1);
        const ahead = Math.floor(e.x + e.w / 2 + dir * 1.6), row = Math.floor(e.y + e.h + 0.1);
        if (!solidCell(ahead, row, 'enemy') && !oneWayCell(ahead, row)) dir = -dir;   // no hopping into a pit
        e.vx = dir * 3; e.vy = -11; e.onGround = false; e.t = 1.05 + (G.L.i % 3) * 0.12;
      }
    }
    if (moveX(e, e.vx * dt, 'enemy')) e.vx = -e.vx * 0.5;
    const r = moveY(e, e.vy * dt, 'enemy', null);
    e.onGround = !!r.land; if (r.land) e.vy = 0;
  } else if (e.type === 'c') {
    e.t += dt;
    e.x = e.x0 + Math.sin(e.t * 0.7) * 2.5 - e.w / 2; e.y = e.y0 + Math.sin(e.t * 1.6) * 0.25 - e.h / 2;
    e.drop -= dt;
    if (e.drop <= 0) { const t = nearestPlayer(e); if (t && Math.abs(t.x - e.x) < 5) spawnDrop(e.x + e.w / 2, e.y + e.h - 0.1, 1.5); e.drop = 1.7; }
  } else if (e.type === 'j') {
    if (!e.up) { e.t -= dt; if (e.t <= 0) { e.up = true; e.vy = -24; } }
    else { e.vy += GRAV * dt; e.y += e.vy * dt; if (e.vy > 0 && e.y >= e.base) { e.y = e.base; e.up = false; e.t = 2.3; } }
  } else if (e.type === 'i') {
    if (e.st === 'hang') {
      if (G.players.some(p => !p.dead && Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 1.3 && p.y > e.y)) { e.st = 'shake'; e.t = 0.45; sfx('crack'); }
    } else if (e.st === 'shake') { e.t -= dt; if (e.t <= 0) { e.st = 'fall'; e.vy = 0; } }
    else {
      e.vy = Math.min(MAXFALL, e.vy + GRAV * 1.4 * dt);
      const r = moveY(e, e.vy * dt, 'enemy', null);
      if (r.land || e.y > R) { e.dead = 0.35; e.gone = true; sparkle(e.x + e.w / 2, e.y + e.h, '#DDF4FF', 10); sfx('shatter'); }
    }
  }
  if (e.y > R + 2 && e.type !== 'j') e.dead = 0.01;
}
function enemyHits() {
  for (const p of G.players) {
    if (p.dead || !isLocal(p)) continue;
    for (const e of G.L.enemies) {
      if (e.dead || (e.type === 'i' && e.st === 'hang')) continue;
      if (p.x + p.w <= e.x + 0.08 || p.x >= e.x + e.w - 0.08 || p.y + p.h <= e.y + 0.06 || p.y >= e.y + e.h - 0.06) continue;
      const above = p.vy > 0 && p.py + p.h <= e.y + 0.32;
      if (above && (e.type === 'p' || e.type === 'a' || e.type === 'c')) {
        e.dead = 0.45; e.squashed = true; e.killedAt = G.clock;
        if (ONLINE()) netEv('stomp', { i: G.L.enemies.indexOf(e) });
        p.vy = -(inputFor(p).j ? 20 : 14); p.grounded = false; p.ground = null; p.usedDouble = false;
        sfx('stomp'); puff(e.x + e.w / 2, e.y + e.h / 2, e.type === 'c' ? '#FFFFFF' : '#FFC6DA', 8);
      } else if (above && e.type === 'n') { hurt(p, e.x + e.w / 2); p.vy = -12; }
      else hurt(p, e.x + e.w / 2);
    }
  }
}
function spikeHits() {
  for (const p of G.players) {
    if (p.dead || !isLocal(p)) continue;
    const r = Math.floor(p.y + p.h - 0.02);
    for (let c = Math.floor(p.x + 0.1); c <= Math.floor(p.x + p.w - 0.1); c++)
      if (code(c, r) === T_SPIKE && p.y + p.h > r + 0.5) { hurt(p, c + 0.5); if (p.inv > 1.3) p.vy = -12; break; }
  }
}
function updateProj(dt) {
  for (const d of G.proj) {
    d.vy = Math.min(13, d.vy + 20 * dt); d.y += d.vy * dt;
    const c = Math.floor(d.x), r = Math.floor(d.y + 0.25);
    if (d.y > R + 1 || solidCell(c, r, 'enemy') || oneWayCell(c, r)) { d.dead = true; G.fx.push({ kind: 'splash', x: d.x, y: Math.min(d.y + 0.2, R), t: 0.3, max: 0.3 }); continue; }
    if (G.state !== 'play') continue;
    for (const p of G.players) if (!p.dead && isLocal(p) && Math.abs(p.x + p.w / 2 - d.x) < p.w / 2 + 0.08 && d.y + 0.3 > p.y && d.y < p.y + p.h) { hurt(p, d.x); d.dead = true; break; }
  }
  G.proj = G.proj.filter(d => !d.dead);
}
// a good stomp, from this phone or the other one
function bossDamage() {
  const b = G.L.boss; if (!b || b.st !== 'dip' || b.inv > 0) return;
  b.hp--; b.inv = 0.8; G.shake = 0.35; sfx('bosshit');
  sparkle(b.x + 1.5, b.y, '#FFE08A', 18);
  if (b.hp <= 0) { b.st = 'dead'; b.dead = 0; G.bossDown = true; G.rainbow = 0.01; G.proj = []; sfx('cheer'); confetti(b.x + 1.5, b.y + 1, 50); }
  else { b.st = 'hit'; b.t = 0.6; }
}
function spawnDrop(x, y, vy) { G.proj.push({ x, y, vy }); if (ONLINE() && isHost()) netEv('rain', { x: +x.toFixed(2), y: +y.toFixed(2), vy }); }
function updateBoss(dt) {
  const b = G.L.boss;
  b.px = b.x; b.py = b.y;
  if (b.st === 'dead') { b.dead += dt; return; }
  const alive = G.players.filter(p => !p.dead);
  const mid = alive.length ? alive.reduce((s, p) => s + p.x + p.w / 2, 0) / alive.length : b.x + 1.5;
  const tx = clamp(mid - 1.5, b.ax0, b.ax1), fury = 3 - b.hp;
  b.t -= dt; if (b.inv > 0) b.inv -= dt;
  if (b.st === 'float') {
    b.x = approach(b.x, tx, (1.5 + fury * 0.5) * dt); b.y = approach(b.y, 1.6 + Math.sin(G.clock * 2) * 0.2, 3 * dt);
    b.rain -= dt;
    if (b.rain <= 0 && G.state === 'play') { for (let k = -1; k <= 1; k++) spawnDrop(b.x + 1.5 + k * 1.1, b.y + 1.7, 1); b.rain = Math.max(0.8, 1.5 - fury * 0.3); sfx('drip'); }
    if (b.t <= 0) { b.st = 'warn'; b.t = 1; sfx('rumble'); }
  } else if (b.st === 'warn') { b.x = approach(b.x, tx, 0.8 * dt); if (b.t <= 0) { b.st = 'dip'; b.t = 2.9; } }
  else if (b.st === 'dip') { b.y = approach(b.y, 6.2, 7 * dt); b.x = approach(b.x, tx, 0.45 * dt); if (b.t <= 0) b.st = 'rise'; }
  else if (b.st === 'rise' || b.st === 'hit') { b.y = approach(b.y, 1.6, (b.st === 'hit' ? 8 : 5) * dt); if (b.y <= 1.65 && b.t <= 0) { b.st = 'float'; b.t = 4.2 - fury * 0.6; } }
  bossTouch();
}
function bossTouch() {
  const b = G.L.boss;
  if (!b || b.st === 'dead' || G.state !== 'play') return;
  for (const p of G.players) {
    if (p.dead || !isLocal(p)) continue;
    if (p.x + p.w <= b.x + 0.2 || p.x >= b.x + b.w - 0.2 || p.y + p.h <= b.y + 0.1 || p.y >= b.y + b.h - 0.15) continue;
    const above = p.vy > 0 && p.py + p.h <= b.y + 0.4;
    if (above && b.st === 'dip' && b.inv <= 0) {
      p.vy = -16; p.grounded = false; p.ground = null;
      if (isHost()) bossDamage(); else { netEv('bosshit', {}); b.inv = 0.8; sparkle(b.x + 1.5, b.y, '#FFE08A', 18); sfx('bosshit'); }
    } else if (b.st !== 'dip' && b.st !== 'hit' && b.inv <= 0) hurt(p, b.x + 1.5);   // never right after a good stomp
  }
}

/* ── the goal, flags, pick-ups ── */
function updateItems(dt) {
  for (const it of G.L.items) {
    if (it.got) continue;
    if (it.rise > 0) { it.rise -= dt; it.y -= dt * 1.8; continue; }
    for (const p of G.players) {
      if (p.dead || !isLocal(p)) continue;
      const cx = clamp(it.x, p.x, p.x + p.w), cy = clamp(it.y, p.y, p.y + p.h), rad = it.type === 'star' ? 0.5 : 0.4;
      if ((cx - it.x) ** 2 + (cy - it.y) ** 2 < rad * rad) { collect(p, it); break; }
    }
  }
}
function collect(p, it, fromNet) {
  if (it.got) return;
  it.got = true;
  if (!fromNet && ONLINE()) netEv('item', { i: G.L.items.indexOf(it), key: it.key || '' });
  // the host keeps the 💗 count; the guest hears it in the world update (adding it here too counted a resent one twice)
  if (fromNet) { if (it.type === 'heart') { if (isHost()) addHearts(1, it.x, it.y); } else if (it.type === 'star') G.stars[it.n] = true; return; }
  if (it.type === 'heart') { addHearts(1, it.x, it.y); sparkle(it.x, it.y, '#FF8FB3', 5); sfx('heart'); }
  else if (it.type === 'star') { G.stars[it.n] = true; sparkle(it.x, it.y, '#FFD75E', 18); sfx('star'); G.fx.push({ kind: 'text', text: '⭐', x: it.x, y: it.y - 0.6, t: 1, max: 1, col: '#FFD75E' }); }
  else if (it.type === 'wings') { p.wings = true; sfx('power'); sparkle(it.x, it.y, '#FFFFFF', 12); }
  else if (it.type === 'shield') { p.shield = true; sfx('power'); sparkle(it.x, it.y, '#9FE3FF', 12); }
}
function checkpoints() {
  for (const k of G.L.cps) if (!k.on && G.players.some(p => !p.dead && isLocal(p) && Math.abs(p.x + p.w / 2 - k.x) < 0.8 && p.y + p.h > k.y - 2.6)) {
    flagOn(k); netEv('cp', { i: G.L.cps.indexOf(k) });
  }
}
function flagOn(k) { if (k.on) return; k.on = true; G.cp = { x: k.x, y: k.y }; snapAtCp(); sfx('cp'); sparkle(k.x, k.y - 2, '#FF8FB3', 14); }
function checkDoor(dt) {
  const d = G.L.door; if (!d) return;
  if (G.state === 'won') {
    G.wonT += dt; d.open = Math.min(1, d.open + dt * 2.2);
    for (const p of G.players) { if (!p.dead) { p.x = approach(p.x, d.x - p.w / 2 + (p.idx ? 0.25 : -0.25), dt * 2.4); p.an.run = 0.6; p.an.t += dt * 2; } }
    if (G.L.world.key === 'night' || G.L.spec.final) fireworksTick(dt);
    return;
  }
  if (G.state !== 'play') return;
  const inZone = (p) => !p.dead && p.grounded && Math.abs(p.x + p.w / 2 - d.x) < 1.2;
  const a = inZone(G.players[0]), b = inZone(G.players[1]);
  d.wait = a && !b ? 0 : b && !a ? 1 : -1;
  if (a && b && isHost()) { netEv('win', {}); win(); }   // online, the host's phone says when you are both in
}

function step(dt) {
  const L = G.L;
  G.clock += dt; G.wt += dt;
  if (G.state === 'play') G.time += dt;
  if (ONLINE()) netRemoteStep();   // the partner's character goes where their phone says it is
  updatePlates();
  for (const p of G.players) if (!p.dead && isLocal(p) && overlapsSolid(p, p.k)) unstick(p, p.k);
  for (const m of L.movers) updateMover(m);
  for (const e of L.elevs) updateElev(e, dt);
  for (const s of L.seesaws) updateSeesaw(s, dt);
  for (const s of L.springs) s.squash = Math.max(0, s.squash - dt * 5);
  if (isHost()) for (const b of L.boxes) updateBox(b, dt); else netWorldStep(dt);
  const [a, b] = G.players;
  for (const p of (a.grounded && a.ground && a.ground.ref === b ? [b, a] : [a, b])) if (isLocal(p)) updatePlayer(p, dt);
  keepTogether();
  updateHold();
  if (isHost()) { for (const e of L.enemies) updateEnemy(e, dt); if (L.boss) updateBoss(dt); }
  else if (L.boss) bossTouch();
  updateProj(dt);
  if (G.state === 'play') { enemyHits(); spikeHits(); updateItems(dt); checkpoints(); }
  updateCrumbs(dt);
  checkDoor(dt);
  for (const g of G.bumps) g.t -= dt;
  if (G.bumps.length && G.bumps[0].t <= 0) G.bumps = G.bumps.filter(g => g.t > 0);
  if (G.failT > 0) { G.failT -= dt; if (G.failT <= 0) showFail(); }
  if (G.state === 'won' && G.wonT > (G.L.spec.final ? 4.5 : 1.8) && !G.resultShown) { G.resultShown = true; showResult(); }
}

/* ── small effects ── */
function dust(x, y, n) { for (let k = 0; k < n; k++) G.parts.push({ x: x + (Math.random() - .5) * .5, y: y - .05, vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.2, t: .45, max: .45, col: 'rgba(255,255,255,.75)', s: .12 + Math.random() * .1 }); }
function puff(x, y, col, n) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, v = 1 + Math.random() * 2.5; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: .5, max: .5, col, s: .14 + Math.random() * .12 }); } }
function sparkle(x, y, col, n) { for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3.5; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, t: .6, max: .6, col, s: .08 + Math.random() * .08, star: true }); } }
function confetti(x, y, n) { const C = ['#FF8FC0', '#C69CFF', '#8FC4FF', '#FFD08F', '#7FD6A8']; for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = 4 + Math.random() * 6; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 1.6, max: 1.6, col: C[k % 5], s: .14, conf: Math.random() * 6, g: 7 }); } }
function updateParts(dt) {
  for (const p of G.parts) { p.t -= dt; p.vy += (p.g || 2) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; if (p.conf != null) p.conf += dt * 8; }
  if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
  G.parts = G.parts.filter(p => p.t > 0);
  for (const f of G.fx) { f.t -= dt; if (f.kind === 'popheart') { f.vy += 26 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } else if (f.kind === 'text') f.y -= dt * 1.2; }
  G.fx = G.fx.filter(f => f.t > 0);
}

/* ══════════════ drawing ══════════════ */
let cv = null, ctx = null;
// the app's own stack: a family the page never loads (the try-out's Nunito) costs a font hunt on the first fillText — 160 ms at 4× CPU
const FONT = "'PingFang SC', 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif";
const V = { w: 0, h: 0, dpr: 1, tile: 30, viewW: 14, spr: new Map(), ts: 0, world: '' };
let CX = 0, CY = 0, TP = 30;
const sx = (x) => (x - CX) * TP, sy = (y) => (y - CY) * TP;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
function rrect(c, x, y, w, h, r) {
  const q = Array.isArray(r) ? r : [r, r, r, r];
  c.beginPath(); c.moveTo(x + q[0], y); c.lineTo(x + w - q[1], y); c.quadraticCurveTo(x + w, y, x + w, y + q[1]);
  c.lineTo(x + w, y + h - q[2]); c.quadraticCurveTo(x + w, y + h, x + w - q[2], y + h); c.lineTo(x + q[3], y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - q[3]); c.lineTo(x, y + q[0]); c.quadraticCurveTo(x, y, x + q[0], y); c.closePath();
}
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); }
function heartPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * 0.95);
  c.bezierCurveTo(x - s * 1.25, y + s * 0.15, x - s * 0.95, y - s * 0.95, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.95, y - s * 0.95, x + s * 1.25, y + s * 0.15, x, y + s * 0.95); c.closePath();
}
function starPath(c, x, y, r) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath();
}

function resize() {
  const el = UI.view; if (!el) return;
  const w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  V.dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * V.dpr); cv.height = Math.round(h * V.dpr);
  V.w = w; V.h = h;
  V.tile = Math.min(h / R, w / 11, 64);   // a tall phone shows 11 tiles across, not a strip at the bottom
  V.viewW = w / V.tile;
  const ts = Math.ceil(V.tile * V.dpr);
  if (ts !== V.ts) { V.spr.clear(); V.ts = ts; }
}

/* ── tile pictures, drawn once per size and world ── */
function sprite(kind, m = 0) {
  const key = kind + ':' + m;
  let s = V.spr.get(key);
  if (!s) { s = drawSprite(kind, m, V.ts, G.L.world); V.spr.set(key, s); }
  return s;
}
function drawSprite(kind, m, ts, wd) {
  const cvs = mk(ts, ts), c = cvs.getContext('2d'), u = ts / 100;
  const night = wd.key === 'night';
  if (kind === 'ground' || kind === 'ice') {
    const ice = kind === 'ice', up = m & 1, lf = m & 2, rt = m & 4;
    c.fillStyle = ice ? '#AEDDF3' : wd.dirt; c.fillRect(0, 0, ts, ts);
    if (ice) { c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 6 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(18 * u, 80 * u); c.lineTo(42 * u, 50 * u); c.moveTo(60 * u, 94 * u); c.lineTo(82 * u, 64 * u); c.stroke(); }
    else { c.fillStyle = wd.dot; for (const [x, y, r] of [[22, 60, 6], [70, 76, 7], [44, 90, 5], [84, 46, 4.5], [10, 88, 4]]) { if (!up && y < 44) continue; ell(c, x * u, y * u, r * u, r * u * 0.8); c.fill(); } }
    c.fillStyle = ice ? '#7DBFE0' : wd.dirtEdge;
    if (!lf) c.fillRect(0, 0, 8 * u, ts);
    if (!rt) c.fillRect(ts - 8 * u, 0, 8 * u, ts);
    if (!up) {
      const h = 36 * u;
      c.fillStyle = ice ? '#C9ECFA' : wd.capEdge;
      c.beginPath(); c.moveTo(0, h - 10 * u); c.lineTo(ts, h - 10 * u); c.lineTo(ts, h);
      for (let x = 100; x > 0; x -= 25) c.quadraticCurveTo((x - 12.5) * u, h + 10 * u, (x - 25) * u, h);
      c.closePath(); c.fill();
      c.fillStyle = ice ? '#F1FBFF' : wd.cap;
      rrect(c, 0, 0, ts, h - 6 * u, [lf ? 0 : 16 * u, rt ? 0 : 16 * u, 0, 0]); c.fill();
      c.fillStyle = night ? 'rgba(200,190,255,.55)' : 'rgba(255,255,255,.4)';
      rrect(c, (lf ? 4 : 14) * u, 6 * u, 46 * u, 6 * u, 3 * u); c.fill();
    }
  } else if (kind === 'block') {
    c.fillStyle = wd.blockEdge; rrect(c, 2 * u, 2 * u, 96 * u, 96 * u, 16 * u); c.fill();
    c.fillStyle = wd.block; rrect(c, 7 * u, 6 * u, 86 * u, 84 * u, 12 * u); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; rrect(c, 14 * u, 12 * u, 40 * u, 9 * u, 4 * u); c.fill();
    if (night) { c.fillStyle = 'rgba(255,240,180,.75)'; starPath(c, 50 * u, 52 * u, 14 * u); c.fill(); }
  } else if (kind === 'plat') {
    const lf = m & 2, rt = m & 4;
    if (night) {
      c.fillStyle = '#FFFFFF';
      for (const [x, r] of [[20, 20], [50, 24], [80, 20]]) { ell(c, x * u, 22 * u, r * u, 15 * u); c.fill(); }
      c.fillStyle = 'rgba(185,176,232,.55)'; rrect(c, 0, 26 * u, ts, 10 * u, 5 * u); c.fill();
    } else {
      c.fillStyle = wd.platEdge; rrect(c, 0, 0, ts, 36 * u, [lf ? 0 : 12 * u, rt ? 0 : 12 * u, rt ? 0 : 12 * u, lf ? 0 : 12 * u]); c.fill();
      c.fillStyle = wd.plat; rrect(c, lf ? 0 : 4 * u, 3 * u, ts - (lf ? 0 : 4 * u) - (rt ? 0 : 4 * u), 24 * u, [lf ? 0 : 9 * u, rt ? 0 : 9 * u, 4 * u, 4 * u]); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(10 * u, 8 * u, 50 * u, 4 * u);
      c.strokeStyle = wd.platEdge; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(66 * u, 4 * u); c.lineTo(66 * u, 26 * u); c.stroke();
    }
  } else if (kind === 'spike') {
    c.fillStyle = '#E8ECF4'; c.strokeStyle = '#8A93A8'; c.lineWidth = 4 * u; c.lineJoin = 'round';
    for (const x of [16, 50, 84]) { c.beginPath(); c.moveTo((x - 15) * u, 98 * u); c.lineTo(x * u, 52 * u); c.lineTo((x + 15) * u, 98 * u); c.closePath(); c.fill(); c.stroke(); }
  } else if (kind === 'gift' || kind === 'giftq' || kind === 'used') {
    const col = kind === 'gift' ? ['#FF7FA8', '#D9467F'] : kind === 'giftq' ? ['#7FB8FF', '#3A78BE'] : ['#C9B39C', '#9C846C'];
    c.fillStyle = col[1]; rrect(c, 3 * u, 3 * u, 94 * u, 94 * u, 14 * u); c.fill();
    c.fillStyle = col[0]; rrect(c, 8 * u, 7 * u, 84 * u, 84 * u, 10 * u); c.fill();
    if (kind !== 'used') {
      c.fillStyle = '#FFE08A'; c.fillRect(44 * u, 7 * u, 12 * u, 84 * u); c.fillRect(8 * u, 44 * u, 84 * u, 12 * u);
      if (kind === 'giftq') { c.fillStyle = '#FFFFFF'; starPath(c, 50 * u, 50 * u, 16 * u); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.4)'; rrect(c, 14 * u, 12 * u, 24 * u, 8 * u, 4 * u); c.fill();
    } else { c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 5 * u; c.strokeRect(24 * u, 24 * u, 52 * u, 52 * u); }
  } else if (kind === 'crumb') {
    if (night) { c.fillStyle = '#FFFFFF'; for (const [x, r] of [[24, 22], [52, 26], [78, 20]]) { ell(c, x * u, 24 * u, r * u, 16 * u); c.fill(); } c.fillStyle = 'rgba(200,190,255,.6)'; for (const x of [24, 52, 78]) { ell(c, x * u, 32 * u, 14 * u, 4 * u); c.fill(); } }
    else if (wd.key === 'autumn') { c.fillStyle = '#E9853A'; c.strokeStyle = '#A9521F'; c.lineWidth = 3 * u; ell(c, 50 * u, 20 * u, 48 * u, 17 * u); c.fill(); c.stroke(); c.beginPath(); c.moveTo(6 * u, 20 * u); c.lineTo(94 * u, 20 * u); c.stroke(); }
    else { c.fillStyle = wd.platEdge; rrect(c, 2 * u, 0, 96 * u, 34 * u, 8 * u); c.fill(); c.fillStyle = wd.plat; rrect(c, 6 * u, 3 * u, 88 * u, 24 * u, 6 * u); c.fill(); c.strokeStyle = wd.platEdge; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(30 * u, 3 * u); c.lineTo(40 * u, 16 * u); c.lineTo(34 * u, 27 * u); c.moveTo(70 * u, 3 * u); c.lineTo(62 * u, 15 * u); c.stroke(); }
  } else if (kind === 'blue' || kind === 'pink') {
    const blue = kind === 'blue', A = blue ? '#7FB4F0' : '#F7A3C2', B = blue ? '#3F7FC4' : '#D9467F';
    c.fillStyle = B; rrect(c, 3 * u, 3 * u, 94 * u, 94 * u, 16 * u); c.fill();
    c.fillStyle = A; rrect(c, 8 * u, 7 * u, 84 * u, 84 * u, 12 * u); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; rrect(c, 14 * u, 12 * u, 36 * u, 9 * u, 4 * u); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    if (blue) { ell(c, 34 * u, 56 * u, 8 * u, 15 * u, 0.25); c.fill(); ell(c, 66 * u, 56 * u, 8 * u, 15 * u, -0.25); c.fill(); ell(c, 50 * u, 52 * u, 13 * u, 12 * u); c.fill(); }
    else { c.beginPath(); c.moveTo(50 * u, 52 * u); c.lineTo(28 * u, 38 * u); c.lineTo(30 * u, 66 * u); c.closePath(); c.moveTo(50 * u, 52 * u); c.lineTo(72 * u, 38 * u); c.lineTo(70 * u, 66 * u); c.closePath(); c.fill(); ell(c, 50 * u, 52 * u, 8 * u, 8 * u); c.fill(); }
  }
  return cvs;
}
const isGround = (t) => t === T_GROUND || t === T_ICE;

/* ── backdrop ── */
const STARS = Array.from({ length: 70 }, (_, i) => { const r = mulberry(i * 31 + 7); return [r(), r() * 0.75, 0.6 + r() * 1.4, r() * 6]; });
function hash(n) { const r = mulberry(n * 977 + 13); return r(); }
function drawBackdrop(W, H) {
  const wd = G.L.world;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, wd.sky[0]); g.addColorStop(1, wd.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const d = V.dpr;
  if (wd.key === 'night') {
    for (const [x, y, s, ph] of STARS) { ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(G.clock * 1.3 + ph)); ctx.fillStyle = '#FFF8DC'; ctx.fillRect(x * W, y * H, s * d, s * d); }
    ctx.globalAlpha = 1;
    const mx = W * 0.82, my = H * 0.14, mr = Math.min(W, H) * 0.06;
    ctx.fillStyle = 'rgba(255,240,200,.18)'; ell(ctx, mx, my, mr * 2, mr * 2); ctx.fill();
    ctx.fillStyle = '#FFF2C6'; ell(ctx, mx, my, mr, mr); ctx.fill();
    ctx.fillStyle = wd.sky[0]; ell(ctx, mx + mr * 0.42, my - mr * 0.18, mr * 0.86, mr * 0.86); ctx.fill();
  } else {
    const sx0 = W * 0.84, sy0 = H * 0.13, r = Math.min(W, H) * (wd.key === 'winter' ? 0.05 : 0.065);
    ctx.fillStyle = wd.key === 'autumn' ? 'rgba(255,170,90,.22)' : 'rgba(255,240,170,.28)'; ell(ctx, sx0, sy0, r * 1.55, r * 1.55); ctx.fill();
    ctx.fillStyle = wd.key === 'winter' ? '#FFF8E8' : wd.key === 'autumn' ? '#FFB45E' : '#FFE27A'; ell(ctx, sx0, sy0, r, r); ctx.fill();
    // a few slow clouds
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let k = 0; k < 4; k++) {
      const span = W / d + 300, x = ((k * 230 + G.clock * 8 - CX * TP / d * 0.08) % span + span) % span - 150, y = (40 + k * 37 % 90) ;
      const X = x * d, Y = y * d * (H / d > 500 ? 1.4 : 1), s = d * (0.8 + (k % 2) * 0.4);
      ell(ctx, X, Y, 34 * s, 13 * s); ctx.fill(); ell(ctx, X - 22 * s, Y + 4 * s, 20 * s, 10 * s); ctx.fill(); ell(ctx, X + 24 * s, Y + 3 * s, 22 * s, 11 * s); ctx.fill();
    }
  }
  if (G.rainbow > 0) {
    G.rainbow = Math.min(1, G.rainbow + 0.01);
    const bx = sx(G.L.boss.ax0 + 10), by = sy(11), rad = TP * 9;
    ctx.globalAlpha = 0.55 * G.rainbow; ctx.lineWidth = TP * 0.32;
    ['#FF7A7A', '#FFB86B', '#FFE27A', '#8EE08A', '#7FC4FF', '#B79CFF'].forEach((col, k) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(bx, by, rad - k * TP * 0.3, Math.PI, 0); ctx.stroke(); });
    ctx.globalAlpha = 1;
  }
  // far hills / mountains and the middle row of trees, with parallax
  const base = sy(10.2);
  ctx.fillStyle = wd.far; ctx.beginPath(); ctx.moveTo(0, H);
  for (let px = 0; px <= W + 10 * d; px += 10 * d) {
    const wx = px / TP + CX * 0.25;
    const yy = wd.key === 'winter' ? (1 - Math.abs(Math.sin(wx * 0.22))) * 3.6 + 0.6 : (Math.sin(wx * 0.3) * 0.7 + Math.sin(wx * 0.11 + 1.3) * 0.9 + 1.7);
    ctx.lineTo(px, base - yy * TP);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  if (wd.key === 'summer') {
    const sea = sy(8.6);
    ctx.fillStyle = '#6CC8EE'; ctx.fillRect(0, sea, W, H - sea);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2 * d;
    for (let k = 0; k < 6; k++) { const x = ((k * 170 - CX * TP * 0.3 / d) % (W / d + 200) + W / d + 200) % (W / d + 200) - 100; ctx.beginPath(); ctx.moveTo(x * d, sea + (10 + k * 9) * d); ctx.lineTo((x + 40) * d, sea + (10 + k * 9) * d); ctx.stroke(); }
  }
  const k2 = 0.5, step = 4.6;
  const first = Math.floor((CX * k2) / step) - 1, last = first + Math.ceil(W / TP / step) + 3;
  for (let i = first; i <= last; i++) {
    const wx = i * step + hash(i) * 2.2, X = (wx - CX * k2) * TP, Y = sy(10.4 + hash(i + 50) * 0.5), s = TP * (0.9 + hash(i + 90) * 0.5);
    midTree(wd, X, Y, s, i);
  }
  ctx.fillStyle = wd.mid; ctx.globalAlpha = 0.55; ctx.fillRect(0, sy(10.6), W, H); ctx.globalAlpha = 1;
}
function midTree(wd, X, Y, s, i) {
  const c = ctx;
  if (wd.key === 'night') {
    c.fillStyle = '#17163F'; c.fillRect(X - s * 0.7, Y - s * 1.3, s * 1.4, s * 1.3);
    c.beginPath(); c.moveTo(X - s * 0.9, Y - s * 1.3); c.lineTo(X, Y - s * 2); c.lineTo(X + s * 0.9, Y - s * 1.3); c.closePath(); c.fill();
    c.fillStyle = hash(i + 7) > 0.35 ? '#FFD982' : '#4A4890'; c.fillRect(X - s * 0.35, Y - s * 0.95, s * 0.28, s * 0.28); c.fillStyle = hash(i + 8) > 0.5 ? '#FFD982' : '#4A4890'; c.fillRect(X + s * 0.1, Y - s * 0.95, s * 0.28, s * 0.28);
    return;
  }
  c.fillStyle = wd.key === 'winter' ? '#7D6A5A' : '#9C7452';
  if (wd.key === 'summer') {
    c.strokeStyle = '#A8835A'; c.lineWidth = s * 0.16; c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(X + s * 0.3, Y - s, X + s * 0.15, Y - s * 2); c.stroke();
    c.fillStyle = wd.tree[1]; for (const a of [-2.6, -1.9, -1.2, -0.5]) { ell(c, X + s * 0.15 + Math.cos(a) * s * 0.55, Y - s * 2 + Math.sin(a) * s * 0.18 + s * 0.15, s * 0.6, s * 0.16, a + Math.PI / 2 + 1.4); c.fill(); }
    return;
  }
  c.fillRect(X - s * 0.08, Y - s * 1.1, s * 0.16, s * 1.1);
  if (wd.key === 'winter') {
    for (let k = 0; k < 3; k++) { const yy = Y - s * (0.6 + k * 0.5), ww = s * (0.75 - k * 0.18); c.fillStyle = wd.tree[k % 2]; c.beginPath(); c.moveTo(X - ww, yy); c.lineTo(X, yy - s * 0.7); c.lineTo(X + ww, yy); c.closePath(); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(X - ww * 0.45, yy - s * 0.38); c.lineTo(X, yy - s * 0.7); c.lineTo(X + ww * 0.45, yy - s * 0.38); c.closePath(); c.fill(); }
    return;
  }
  c.fillStyle = wd.tree[0]; ell(c, X, Y - s * 1.35, s * 0.62, s * 0.5); c.fill();
  c.fillStyle = wd.tree[1]; ell(c, X - s * 0.38, Y - s * 1.12, s * 0.38, s * 0.32); c.fill(); ell(c, X + s * 0.4, Y - s * 1.15, s * 0.36, s * 0.3); c.fill();
}

/* ── characters ── */
function foot(x, y, c) { ell(ctx, x, y, 11, 6); ctx.fillStyle = c.body; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = c.edge; ctx.stroke(); }
function drawChar(p, al) {
  if (p.dead > 0 || p.hide) return;
  const x = p.px + (p.x - p.px) * al, y = p.py + (p.y - p.py) * al;
  const X = sx(x + p.w / 2), Y = sy(y + p.h), s = TP * 1.5 / 112, a = p.an, c = CH[p.k];
  let bob = 0, rot = 0, kx = 1, ky = 1, f1x = 0, f1y = 0, f2x = 0, f2y = 0;
  if (!p.grounded) { if (p.vy < 0) { kx = 0.93; ky = 1.07; f1y = f2y = -3; f1x = 3; f2x = -3; } else { kx = 1.03; ky = 0.98; f1y = f2y = -1; } }
  else if (a.run > 0.05) { const ph = Math.sin(a.t * Math.PI * 2); bob = -Math.abs(ph) * 3.5 * a.run; rot = -0.045 * a.run; f1y = -Math.max(0, ph) * 6 * a.run; f2y = -Math.max(0, -ph) * 6 * a.run; f1x = ph * 4 * a.run; f2x = -ph * 4 * a.run; }
  else { const br = REDUCE ? 0 : Math.sin(G.clock * 2 + p.idx * 1.7) * 0.016; kx = 1 + br; ky = 1 - br; }
  if (a.squash > 0) { kx *= 1 + 0.2 * a.squash; ky *= 1 - 0.17 * a.squash; }
  if (p.strain > 0) { ky *= 0.95; kx *= 1.04; }
  const face = p.inv > 1.0 ? 'hurt' : (p.happy > 0 || G.state === 'won') ? 'happy' : p.strain > 0 ? 'strain' : a.blink > 0 ? 'blink' : 'normal';
  if (p.grounded) { ctx.fillStyle = 'rgba(40,20,30,.2)'; ell(ctx, X, Y, TP * 0.42, TP * 0.08); ctx.fill(); }
  const flick = p.inv > 0 && p.inv <= 1.0 && Math.floor(p.inv * 12) % 2;
  if (flick) ctx.globalAlpha = 0.45;
  ctx.save(); ctx.translate(X, Y); ctx.scale(s * (p.face < 0 ? -1 : 1), s); ctx.translate(-50, -106);
  if (p.wings) {
    const fl = (a.flap > 0 || !p.grounded) ? Math.sin(G.clock * 22) * 0.35 : Math.sin(G.clock * 3) * 0.12;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#C9D6EA'; ctx.lineWidth = 2.5;
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(50 + sd * 34, 52); ctx.rotate(sd * (0.5 + fl)); ell(ctx, sd * 16, -8, 20, 11); ctx.fill(); ctx.stroke(); ell(ctx, sd * 12, 4, 15, 8); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  foot(36 + f1x, 100 + f1y, c); foot(64 + f2x, 100 + f2y, c);
  ctx.translate(50, 100); ctx.rotate(rot); ctx.scale(kx, ky); ctx.translate(-50, -100 + bob);
  ctx.drawImage(bodyCanvas(p.k, face, s * 112), 0, 0, 100, 112);
  if (p.shield) { ell(ctx, 50, 58, 62, 60); ctx.fillStyle = 'rgba(160,225,255,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,240,255,.9)'; ctx.lineWidth = 3; ctx.stroke(); ell(ctx, 30, 22, 9, 5, -0.6); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
// who is who: the one you steer in 一个人玩, and both names for the first seconds
function drawTag(p, al) {
  if (p.dead > 0) return;
  const x = p.px + (p.x - p.px) * al, y = p.py + (p.y - p.py) * al, X = sx(x + p.w / 2), Y = sy(y + p.h), c = CH[p.k];
  const showTag = (G.mode === 'solo' && p.idx === G.active) || (ONLINE() && p.idx === G.meIdx && G.time < 6) || G.time < 3.5;
  if (showTag && G.state === 'play') {
    const ty = Y - TP * 1.72 + (REDUCE ? 0 : Math.sin(G.clock * 5) * TP * 0.05);
    ctx.fillStyle = c.tint; ctx.beginPath(); ctx.moveTo(X - TP * 0.16, ty); ctx.lineTo(X + TP * 0.16, ty); ctx.lineTo(X, ty + TP * 0.18); ctx.closePath(); ctx.fill();
    if (G.time < 3.5) nameTag(c.name, 900, 0.36, 0.08, 'rgba(30,20,50,.55)', X, ty - TP * 0.08);
  }
}
function drawHold(al) {
  if (!G.hold) return;
  const [a, b] = G.players;
  const ax = sx(a.px + (a.x - a.px) * al + a.w / 2), ay = sy(a.py + (a.y - a.py) * al + a.h * 0.62);
  const bx = sx(b.px + (b.x - b.px) * al + b.w / 2), by = sy(b.py + (b.y - b.py) * al + b.h * 0.62);
  ctx.strokeStyle = '#FF8FB3'; ctx.lineWidth = TP * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + TP * 0.2, bx, by); ctx.stroke();
  ctx.fillStyle = '#FF5C93'; heartPath(ctx, (ax + bx) / 2, (ay + by) / 2 + TP * 0.05, TP * 0.16 * (1 + (REDUCE ? 0 : Math.sin(G.clock * 6) * 0.12))); ctx.fill();
}
// Your own pet (or 宝宝) from 小窝, in the app's own drawing. No pet adopted, nobody follows.
function drawPet(dt) {
  const img = G.petImg; if (!img) return;
  const [a, b] = G.players;
  const lead = G.mode === 'solo' ? G.players[G.active] : ONLINE() ? G.players[G.meIdx] : (a.dead ? b : b.dead ? a : null);
  let tx, ty, face;
  if (lead) { tx = lead.x + lead.w / 2 - lead.face * 1.1; ty = lead.y + lead.h; face = lead.face; }
  else { const m = (a.x + b.x) / 2 + PW / 2; tx = m - (a.face + b.face) * 0.55; ty = Math.max(a.y + a.h, b.y + b.h); face = Math.sign(a.face + b.face) || 1; }
  if (lead && lead.dead) return;
  const pt = G.petPos || (G.petPos = { x: tx, y: ty, f: 1, hop: 0 });
  if (Math.abs(tx - pt.x) > 12) { pt.x = tx; pt.y = ty; }      // a respawn: catch up at once
  const spd = Math.hypot(tx - pt.x, ty - pt.y);
  pt.x += (tx - pt.x) * Math.min(1, dt * 4); pt.y += (ty - pt.y) * Math.min(1, dt * 6);
  pt.f = Math.abs(tx - pt.x) > 0.05 ? Math.sign(tx - pt.x) : face;
  pt.hop = spd > 0.15 && !REDUCE ? pt.hop + dt * 9 : 0;
  const hh = TP * 1.25, ww = hh * img.width / img.height, X = sx(pt.x), Y = sy(pt.y), hop = Math.abs(Math.sin(pt.hop)) * TP * 0.12;
  ctx.fillStyle = 'rgba(40,20,30,.16)'; ell(ctx, X, Y, TP * 0.32 - hop * 0.3, TP * 0.07); ctx.fill();
  ctx.save(); ctx.translate(X, Y - hop); ctx.scale(pt.f < 0 ? -1 : 1, 1);
  ctx.drawImage(img, -ww / 2, -hh * 0.97, ww, hh);
  ctx.restore();
  if (G.time < 3.5 && G.petName && G.state === 'play') {
    nameTag(G.petName, 800, 0.3, 0.07, 'rgba(30,20,50,.5)', X, Y - hh - TP * 0.05);
  }
}

/* ── everything else that moves ── */
function drawEnemy(e, al) {
  const x = e.px + (e.x - e.px) * al, y = e.py + (e.y - e.py) * al;
  const X = sx(x + e.w / 2), Y = sy(y + e.h), s = TP / 100;
  if (e.dead && e.gone) return;
  const fade = e.dead ? Math.max(0, e.dead / 0.45) : 1;
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(X, Y); ctx.scale(s, s);
  const flip = (e.vx || 0) > 0 ? -1 : 1;
  if (e.type === 'p') {
    const sq = e.squashed ? 0.35 : 1 + (REDUCE ? 0 : Math.sin(e.t * 9) * 0.04);
    ctx.scale(1 / sq * (e.squashed ? 0.8 : 1), sq);
    ctx.fillStyle = '#B79FE8'; ctx.strokeStyle = '#7E64C2'; ctx.lineWidth = 4;
    ell(ctx, -22, -6, 13, 8); ctx.fill(); ctx.stroke(); ell(ctx, 22, -6, 13, 8); ctx.fill(); ctx.stroke();
    ell(ctx, 0, -42, 44, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ell(ctx, -16, -62, 12, 7, -0.4); ctx.fill();
    ctx.strokeStyle = '#3A2F3C'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-24, -54); ctx.lineTo(-8, -48); ctx.moveTo(24, -54); ctx.lineTo(8, -48); ctx.stroke();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -14 * flip, -40, 4.5, 5); ctx.fill(); ell(ctx, 10 * flip, -40, 4.5, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -24); ctx.quadraticCurveTo(0, -30, 8, -24); ctx.stroke();
    if (G.L.world.key === 'winter') { ctx.fillStyle = '#E8508F'; rrect(ctx, -32, -86, 64, 18, 9); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ell(ctx, 0, -92, 9, 9); ctx.fill(); }
  } else if (e.type === 'n') {
    ctx.fillStyle = '#7A5A3A';
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + (e.t || 0) * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, -44 + Math.sin(a) * 34); ctx.lineTo(Math.cos(a + 0.18) * 54, -44 + Math.sin(a + 0.18) * 54); ctx.lineTo(Math.cos(a + 0.36) * 34, -44 + Math.sin(a + 0.36) * 34); ctx.fill(); }
    ctx.fillStyle = '#B87A45'; ctx.strokeStyle = '#7A4A25'; ctx.lineWidth = 4; ell(ctx, 0, -44, 40, 38); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E9C49A'; ell(ctx, 0, -26, 26, 14); ctx.fill();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -13, -48, 4.5, 5.5); ctx.fill(); ell(ctx, 13, -48, 4.5, 5.5); ctx.fill();
    ctx.strokeStyle = '#3A2F3C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-22, -60); ctx.lineTo(-6, -56); ctx.moveTo(22, -60); ctx.lineTo(6, -56); ctx.stroke();
  } else if (e.type === 'a') {
    const wob = e.onGround ? 0 : Math.sin(G.clock * 30) * 0.15;
    ctx.rotate(wob);
    ctx.fillStyle = '#FFD75E'; ctx.strokeStyle = '#C79A1E'; ctx.lineWidth = 4;
    ell(ctx, -26, -80, 13, 11); ctx.fill(); ctx.stroke(); ell(ctx, 26, -80, 13, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FF6B6B'; ctx.strokeStyle = '#C0392F'; ell(ctx, 0, -44, 40, 40); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFDF6'; ell(ctx, 0, -44, 29, 29); ctx.fill();
    ctx.strokeStyle = '#3A2F3C'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, -64); ctx.moveTo(0, -44); ctx.lineTo(14, -40); ctx.stroke();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -12, -50, 3.5, 4); ctx.fill(); ell(ctx, 12, -50, 3.5, 4); ctx.fill();
    ctx.strokeStyle = '#C0392F'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-24, 0); ctx.moveTo(18, -2); ctx.lineTo(24, 0); ctx.stroke();
  } else if (e.type === 'c') {
    ctx.fillStyle = e.squashed ? '#FFFFFF' : '#C9CFE0'; ctx.strokeStyle = '#8D95AE'; ctx.lineWidth = 4;
    for (const [cx, cy, r] of [[-38, -34, 26], [0, -48, 36], [40, -34, 26], [0, -22, 38]]) { ell(ctx, cx, cy, r * 1.15, r * 0.9); ctx.fill(); }
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -14, -38, 4, 5); ctx.fill(); ell(ctx, 14, -38, 4, 5); ctx.fill();
    ctx.strokeStyle = '#3A2F3C'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-22, -50); ctx.lineTo(-8, -46); ctx.moveTo(22, -50); ctx.lineTo(8, -46); ctx.moveTo(-8, -24); ctx.quadraticCurveTo(0, -30, 8, -24); ctx.stroke();
  } else if (e.type === 'j') {
    ctx.rotate(e.vy > 0 ? Math.PI : 0); ctx.translate(0, e.vy > 0 ? 90 : 0);
    ctx.fillStyle = '#FF4D3D'; ctx.strokeStyle = '#B2241A'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -84); ctx.bezierCurveTo(30, -76, 32, -20, 0, 0); ctx.bezierCurveTo(-32, -20, -30, -76, 0, -84); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4FA35B'; ctx.beginPath(); ctx.moveTo(-14, -82); ctx.quadraticCurveTo(0, -100, 14, -82); ctx.quadraticCurveTo(0, -88, -14, -82); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ell(ctx, -9, -52, 6, 7); ctx.fill(); ell(ctx, 9, -52, 6, 7); ctx.fill();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -8, -50, 3, 3.6); ctx.fill(); ell(ctx, 8, -50, 3, 3.6); ctx.fill();
  } else if (e.type === 'i') {
    const shake = e.st === 'shake' && !REDUCE ? Math.sin(G.clock * 70) * 4 : 0;
    ctx.translate(shake, -90);
    ctx.fillStyle = '#DDF4FF'; ctx.strokeStyle = '#8FC6E8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(2, 90); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-4, 6); ctx.lineTo(0, 60); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawBoss(al) {
  const b = G.L.boss; if (!b) return;
  if (b.st === 'dead' && b.dead > 1.4) return;
  const x = b.px + (b.x - b.px) * al, y = b.py + (b.y - b.py) * al;
  const X = sx(x + b.w / 2), Y = sy(y + b.h / 2), s = TP / 100;
  ctx.save(); ctx.translate(X, Y); ctx.scale(s, s);
  if (b.st === 'dead') { ctx.globalAlpha = Math.max(0, 1 - b.dead / 1.4); ctx.scale(1 + b.dead * 0.3, 1 + b.dead * 0.3); }
  const warn = b.st === 'warn' && !REDUCE ? Math.sin(G.clock * 40) * 6 : 0;
  ctx.translate(warn, 0);
  const dazed = b.st === 'dip', flash = b.inv > 0 && Math.floor(b.inv * 14) % 2;
  ctx.fillStyle = flash ? '#FFFFFF' : dazed ? '#9C93C2' : '#5E567F'; ctx.strokeStyle = '#3D3660'; ctx.lineWidth = 6;
  for (const [cx, cy, r] of [[-105, 10, 62], [-50, -40, 78], [30, -55, 88], [100, 0, 66], [0, 25, 92]]) { ell(ctx, cx, cy, r, r * 0.82); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ell(ctx, -40, -70, 40, 18, -0.3); ctx.fill();
  if (dazed) {
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6;
    for (const ex of [-40, 40]) { ctx.beginPath(); for (let k = 0; k < 30; k++) { const a = k * 0.6 + G.clock * 6, r = k * 0.8; ctx.lineTo(ex + Math.cos(a) * r, -10 + Math.sin(a) * r); } ctx.stroke(); }
  } else {
    ctx.fillStyle = '#FFE36B'; ell(ctx, -40, -10, 16, 13); ctx.fill(); ell(ctx, 40, -10, 16, 13); ctx.fill();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -38, -6, 7, 7); ctx.fill(); ell(ctx, 38, -6, 7, 7); ctx.fill();
    ctx.strokeStyle = '#2A2445'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-66, -40); ctx.lineTo(-20, -24); ctx.moveTo(66, -40); ctx.lineTo(20, -24); ctx.stroke();
    ctx.fillStyle = '#FFE36B'; ctx.beginPath(); ctx.moveTo(10, 60); ctx.lineTo(-14, 100); ctx.lineTo(4, 100); ctx.lineTo(-10, 140); ctx.lineTo(26, 92); ctx.lineTo(8, 92); ctx.lineTo(22, 60); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (b.st !== 'dead') for (let k = 0; k < 3; k++) { ctx.fillStyle = k < b.hp ? '#FF5C93' : 'rgba(255,255,255,.35)'; heartPath(ctx, X + (k - 1) * TP * 0.5, sy(y) - TP * 0.55, TP * 0.18); ctx.fill(); }
}
function drawItem(it) {
  if (it.got) return;
  const bob = REDUCE ? 0 : Math.sin(G.clock * 3 + it.ph) * 0.08;
  const X = sx(it.x), Y = sy(it.y + bob);
  if (it.type === 'heart') {
    ctx.fillStyle = '#FF6F9F'; heartPath(ctx, X, Y, TP * 0.24); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(ctx, X - TP * 0.09, Y - TP * 0.08, TP * 0.05, TP * 0.035, -0.5); ctx.fill();
  } else if (it.type === 'star') {
    ctx.save(); ctx.translate(X, Y); ctx.rotate(REDUCE ? 0 : Math.sin(G.clock * 2 + it.ph) * 0.2);
    ctx.fillStyle = 'rgba(255,215,94,.25)'; ell(ctx, 0, 0, TP * 0.6, TP * 0.6); ctx.fill();
    ctx.fillStyle = '#FFD75E'; ctx.strokeStyle = '#E09A1E'; ctx.lineWidth = TP * 0.05; starPath(ctx, 0, 0, TP * 0.42); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3A2F3C'; ell(ctx, -TP * 0.08, -TP * 0.02, TP * 0.03, TP * 0.045); ctx.fill(); ell(ctx, TP * 0.08, -TP * 0.02, TP * 0.03, TP * 0.045); ctx.fill();
    ctx.restore();
  } else if (it.type === 'wings') {
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#9FB7DA'; ctx.lineWidth = TP * 0.04;
    for (const sd of [-1, 1]) { ell(ctx, X + sd * TP * 0.22, Y, TP * 0.24, TP * 0.13, sd * 0.4); ctx.fill(); ctx.stroke(); }
  } else if (it.type === 'shield') {
    ell(ctx, X, Y, TP * 0.32, TP * 0.32); ctx.fillStyle = 'rgba(160,225,255,.45)'; ctx.fill(); ctx.strokeStyle = '#BDEBFF'; ctx.lineWidth = TP * 0.05; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ell(ctx, X - TP * 0.1, Y - TP * 0.1, TP * 0.07, TP * 0.045, -0.6); ctx.fill();
  }
}
function drawHouse(d) {
  const wd = G.L.world, X = sx(d.x), Y = sy(d.y), u = TP / 100;
  ctx.save(); ctx.translate(X, Y);
  ctx.fillStyle = 'rgba(40,20,30,.18)'; ell(ctx, 0, 0, 150 * u, 14 * u); ctx.fill();
  ctx.fillStyle = wd.house; ctx.strokeStyle = 'rgba(80,50,40,.55)'; ctx.lineWidth = 5 * u;
  rrect(ctx, -130 * u, -190 * u, 260 * u, 190 * u, 10 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = wd.roof; ctx.beginPath(); ctx.moveTo(-160 * u, -180 * u); ctx.lineTo(0, -300 * u); ctx.lineTo(160 * u, -180 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = wd.roof; ctx.fillRect(70 * u, -290 * u, 34 * u, 70 * u);
  ctx.fillStyle = '#FF7FA8'; heartPath(ctx, 0, -228 * u, 26 * u); ctx.fill();
  // the door: opens when you both get there
  const open = d.open;
  ctx.fillStyle = '#3A2A3A'; rrect(ctx, -42 * u, -130 * u, 84 * u, 130 * u, [40 * u, 40 * u, 0, 0]); ctx.fill();
  ctx.fillStyle = '#FFE9A8'; ctx.globalAlpha = open; rrect(ctx, -42 * u, -130 * u, 84 * u, 130 * u, [40 * u, 40 * u, 0, 0]); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#C98A5A'; ctx.save(); ctx.translate(-42 * u, 0); ctx.scale(1 - open * 0.85, 1); rrect(ctx, 0, -130 * u, 84 * u, 130 * u, [40 * u, 40 * u, 0, 0]); ctx.fill(); ctx.fillStyle = '#FFD75E'; ell(ctx, 66 * u, -62 * u, 6 * u, 6 * u); ctx.fill(); ctx.restore();
  ctx.fillStyle = wd.key === 'night' ? '#FFD982' : '#BFE6FF';
  for (const wx of [-96, 64]) { rrect(ctx, wx * u, -150 * u, 32 * u, 32 * u, 6 * u); ctx.fill(); }
  ctx.restore();
}
// a sign never changes, so it is drawn once per tile size (like the tiles) instead of laying out its text every frame
function signSprite() {
  let s = V.spr.get('sign');
  if (!s) {
    const ts = V.ts, u = ts / 100; s = mk(80 * u, 122 * u); const c = s.getContext('2d'), X = 40 * u, Y = 122 * u;
    c.fillStyle = '#9C7452'; c.fillRect(X - 5 * u, Y - 80 * u, 10 * u, 80 * u);
    c.fillStyle = '#E8C590'; c.strokeStyle = '#9C7452'; c.lineWidth = 5 * u; rrect(c, X - 36 * u, Y - 118 * u, 72 * u, 52 * u, 8 * u); c.fill(); c.stroke();
    c.fillStyle = '#9C5A2A'; c.font = `900 ${Math.round(40 * u)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', X, Y - 90 * u);
    V.spr.set('sign', s);
  }
  return s;
}
// an outlined name, drawn once per text and size: stroking text every frame cost ~3 ms a frame at 4× CPU
function nameTag(text, weight, size, line, edge, X, baseY) {
  const px = Math.max(6, Math.round(TP * size)), key = 'tag:' + weight + ':' + px + ':' + text;
  let s = V.spr.get(key);
  if (!s) {
    const lw = Math.ceil(TP * line), m = document.createElement('canvas').getContext('2d'); m.font = `${weight} ${px}px ${FONT}`;
    const w = Math.ceil(m.measureText(text).width) + lw * 2 + 4, h = Math.ceil(px * 1.4) + lw * 2;
    s = mk(w, h); const c = s.getContext('2d'); c.font = m.font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    c.lineWidth = lw; c.strokeStyle = edge; c.strokeText(text, w / 2, h - lw - px * 0.3); c.fillStyle = '#FFFFFF'; c.fillText(text, w / 2, h - lw - px * 0.3);
    s._dy = h - lw - px * 0.3;
    if (V.spr.size > 160) for (const k of V.spr.keys()) { if (k.startsWith('tag:')) { V.spr.delete(k); break; } }
    V.spr.set(key, s);
  }
  // two long names side by side ran together (「线条小狗·他线条小狗·她」): a tag that would overlap one already drawn this frame goes above it
  let x = Math.round(X - s.width / 2), y = Math.round(baseY - s._dy);
  const box = V.tags;
  for (let k = 0; k < 4 && box.some(b => x < b.x + b.w && x + s.width > b.x && y < b.y + b.h && y + s.height > b.y); k++) y = Math.min(...box.filter(b => x < b.x + b.w && x + s.width > b.x).map(b => b.y)) - s.height + 2;
  box.push({ x, y, w: s.width, h: s.height });
  ctx.drawImage(s, x, y);
}
function drawSign(s) {
  const u = TP / 100; ctx.drawImage(signSprite(), sx(s.x) - 40 * u, sy(s.y) - 122 * u, 80 * u, 122 * u);
}
function drawFlag(k) {
  const X = sx(k.x), Y = sy(k.y), u = TP / 100;
  ctx.fillStyle = '#B9B2C8'; ctx.fillRect(X - 4 * u, Y - 240 * u, 8 * u, 240 * u);
  ctx.fillStyle = k.on ? '#FF6F9F' : '#D7D2E2';
  const wave = REDUCE ? 0 : Math.sin(G.clock * 4) * 8 * u;
  ctx.beginPath(); ctx.moveTo(X + 4 * u, Y - 236 * u); ctx.quadraticCurveTo(X + 50 * u, Y - 226 * u + wave, X + 90 * u, Y - 214 * u); ctx.quadraticCurveTo(X + 50 * u, Y - 196 * u - wave, X + 4 * u, Y - 190 * u); ctx.closePath(); ctx.fill();
  if (k.on) { ctx.fillStyle = '#FFFFFF'; heartPath(ctx, X + 38 * u, Y - 214 * u, 10 * u); ctx.fill(); }
}
function drawDecor(dc) {
  const wd = G.L.world.key, X = sx(dc.x), Y = sy(dc.y), u = TP / 100 * dc.s;
  if (wd === 'spring') { ctx.strokeStyle = '#4FA35B'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 22 * u); ctx.stroke(); ctx.fillStyle = ['#FF8FB3', '#FFFFFF', '#FFD75E', '#C69CFF'][dc.k]; for (let k = 0; k < 5; k++) { const a = k * 1.256; ell(ctx, X + Math.cos(a) * 7 * u, Y - 24 * u + Math.sin(a) * 7 * u, 5 * u, 5 * u); ctx.fill(); } ctx.fillStyle = '#FFE27A'; ell(ctx, X, Y - 24 * u, 4 * u, 4 * u); ctx.fill(); }
  else if (wd === 'summer') { if (dc.k < 2) { ctx.fillStyle = '#FFB59E'; ctx.beginPath(); ctx.moveTo(X - 12 * u, Y); ctx.quadraticCurveTo(X, Y - 22 * u, X + 12 * u, Y); ctx.closePath(); ctx.fill(); } else { ctx.strokeStyle = '#5FB06A'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(X - 6 * u, Y); ctx.lineTo(X - 10 * u, Y - 18 * u); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 24 * u); ctx.moveTo(X + 6 * u, Y); ctx.lineTo(X + 10 * u, Y - 18 * u); ctx.stroke(); } }
  else if (wd === 'autumn') { if (dc.k < 2) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(X - 3 * u, Y - 14 * u, 6 * u, 14 * u); ctx.fillStyle = '#E2513A'; ell(ctx, X, Y - 16 * u, 13 * u, 9 * u); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ell(ctx, X - 4 * u, Y - 18 * u, 2.5 * u, 2.5 * u); ctx.fill(); } else { ctx.fillStyle = dc.k === 2 ? '#F08A3C' : '#D9552B'; ell(ctx, X, Y - 4 * u, 10 * u, 4 * u, 0.3); ctx.fill(); } }
  else if (wd === 'winter') { ctx.fillStyle = '#FFFFFF'; ell(ctx, X, Y - 5 * u, 14 * u, 7 * u); ctx.fill(); if (dc.k === 0) { ell(ctx, X, Y - 18 * u, 9 * u, 9 * u); ctx.fill(); ctx.fillStyle = '#FF9A62'; ctx.beginPath(); ctx.moveTo(X, Y - 18 * u); ctx.lineTo(X + 9 * u, Y - 16 * u); ctx.lineTo(X, Y - 15 * u); ctx.fill(); } }
  else { ctx.fillStyle = `rgba(255,${200 + dc.k * 12},140,${0.5 + 0.5 * Math.abs(Math.sin(G.clock * 2 + dc.x))})`; ell(ctx, X, Y - 10 * u, 4 * u, 4 * u); ctx.fill(); ctx.strokeStyle = '#6C64C8'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 8 * u); ctx.stroke(); }
}
function drawSeesaw(s) {
  const X = sx(s.px), Y = sy(s.py), u = TP / 100;
  ctx.fillStyle = '#9C7452'; ctx.beginPath(); ctx.moveTo(X - 30 * u, sy(11)); ctx.lineTo(X, Y); ctx.lineTo(X + 30 * u, sy(11)); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(X, Y); ctx.rotate(s.ang);
  ctx.fillStyle = '#E86A8A'; ctx.strokeStyle = '#B83E62'; ctx.lineWidth = 5 * u;
  rrect(ctx, -s.half * TP, -16 * u, s.half * 2 * TP, 24 * u, 10 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFE08A'; for (const sd of [-1, 1]) { heartPath(ctx, sd * (s.half - 0.4) * TP, -4 * u, 9 * u); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#FFD75E'; ell(ctx, X, Y, 9 * u, 9 * u); ctx.fill();
}
function drawPlatformThing(m, al, kind) {
  const y = m.py + (m.y - m.py) * al, x = kind === 'mover' ? m.px + (m.x - m.px) * al : m.x0;
  const X = sx(x), Y = sy(y), w = 3 * TP, u = TP / 100, wd = G.L.world;
  if (kind === 'elev') {
    ctx.strokeStyle = '#8D95AE'; ctx.lineWidth = 4 * u;
    const topY = sy(m.yTop - 1.4);
    ctx.beginPath(); ctx.moveTo(X + 20 * u, Y); ctx.lineTo(X + 20 * u, topY); ctx.moveTo(X + w - 20 * u, Y); ctx.lineTo(X + w - 20 * u, topY); ctx.stroke();
    ctx.fillStyle = '#8D95AE'; ell(ctx, X + 20 * u, topY, 12 * u, 12 * u); ctx.fill(); ell(ctx, X + w - 20 * u, topY, 12 * u, 12 * u); ctx.fill();
    ctx.fillStyle = '#5E6A86'; rrect(ctx, X, Y, w, 34 * u, 8 * u); ctx.fill();
    ctx.fillStyle = G.chanOn[m.ch] ? '#FFD75E' : '#C9CFE0'; rrect(ctx, X + 6 * u, Y + 4 * u, w - 12 * u, 20 * u, 6 * u); ctx.fill();
    return;
  }
  if (wd.key === 'night') { ctx.fillStyle = '#FFFFFF'; for (let k = 0; k < 4; k++) { ell(ctx, X + (0.4 + k * 0.75) * TP, Y + 18 * u, 30 * u, 20 * u); ctx.fill(); } return; }
  ctx.fillStyle = wd.platEdge; rrect(ctx, X, Y, w, 38 * u, 14 * u); ctx.fill();
  ctx.fillStyle = wd.key === 'summer' ? '#B98A5E' : wd.plat; rrect(ctx, X + 4 * u, Y + 3 * u, w - 8 * u, 26 * u, 10 * u); ctx.fill();
  ctx.strokeStyle = wd.platEdge; ctx.lineWidth = 3 * u; for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(X + k * TP, Y + 4 * u); ctx.lineTo(X + k * TP, Y + 28 * u); ctx.stroke(); }
}
function drawBox(b, al) {
  const x = b.px + (b.x - b.px) * al, y = b.py + (b.y - b.py) * al;
  const X = sx(x), Y = sy(y), s = TP * 2, u = TP / 100;
  ctx.fillStyle = '#9C6B3E'; rrect(ctx, X, Y, s, s, 14 * u); ctx.fill();
  ctx.fillStyle = '#D6A26A'; rrect(ctx, X + 8 * u, Y + 8 * u, s - 16 * u, s - 16 * u, 10 * u); ctx.fill();
  ctx.strokeStyle = '#9C6B3E'; ctx.lineWidth = 9 * u; ctx.beginPath(); ctx.moveTo(X + 14 * u, Y + 14 * u); ctx.lineTo(X + s - 14 * u, Y + s - 14 * u); ctx.stroke();
  ctx.fillStyle = '#FF7FA8'; heartPath(ctx, X + s / 2, Y + s / 2, 26 * u); ctx.fill();
  if (b.strain > 0.3) { ctx.fillStyle = '#7FC4FF'; for (const k of [0, 1]) { const t = (G.clock * 2 + k * 0.5) % 1; ctx.globalAlpha = 1 - t; heartPath(ctx, X + (k ? s + 10 * u : -10 * u), Y + 30 * u - t * 30 * u, 6 * u); ctx.fill(); } ctx.globalAlpha = 1; }
}
function drawSpring(s) {
  const X = sx(s.x0), Y = sy(s.y), w = (s.x1 - s.x0) * TP, u = TP / 100, sq = s.squash;
  ctx.strokeStyle = '#8D95AE'; ctx.lineWidth = 6 * u; ctx.beginPath();
  const bot = sy(s.y + 0.55), top = Y + sq * 0.22 * TP + 10 * u;
  for (let k = 0; k <= 4; k++) { const yy = bot - (bot - top) * k / 4; ctx.lineTo(X + (k % 2 ? w - 14 * u : 14 * u), yy); }
  ctx.stroke();
  ctx.fillStyle = '#FF6B6B'; rrect(ctx, X, top - 14 * u, w, 16 * u, 8 * u); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; rrect(ctx, X + 8 * u, top - 11 * u, w * 0.4, 4 * u, 2 * u); ctx.fill();
}

/* ── ambient weather, sparks and fireworks ── */
function ambTick(dt, W, H) {
  const kind = G.L.world.key;
  const n = REDUCE ? 0 : kind === 'summer' ? 10 : 26;
  while (G.amb.length < n) G.amb.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
  const d = V.dpr;
  for (const a of G.amb) {
    a.ph += dt;
    if (kind === 'firefly') { a.x += Math.cos(a.ph * 0.7) * 12 * dt * d; a.y += Math.sin(a.ph * 0.9) * 10 * dt * d; }
    else if (kind === 'summer') { a.y -= 14 * dt * d; }
    else { a.y += (kind === 'snow' ? 22 : 30) * a.s * dt * d; a.x += (Math.sin(a.ph * 1.3) * 18 + (kind === 'leaf' ? 14 : 0)) * dt * d; }
    if (a.y > H + 10) { a.y = -10; a.x = Math.random() * W; } if (a.y < -12) { a.y = H + 8; a.x = Math.random() * W; }
    if (a.x > W + 10) a.x = -10; if (a.x < -12) a.x = W + 8;
  }
}
function drawAmb() {
  const kind = G.L.world.key, d = V.dpr;
  for (const a of G.amb) {
    const s = a.s * d;
    if (kind === 'spring') { ctx.fillStyle = 'rgba(255,175,205,.85)'; ell(ctx, a.x, a.y, 5 * s, 3 * s, a.ph); ctx.fill(); }
    else if (kind === 'autumn') { ctx.fillStyle = a.s > 1 ? '#E9853A' : '#D9552B'; ell(ctx, a.x, a.y, 6 * s, 3 * s, a.ph * 2); ctx.fill(); }
    else if (kind === 'winter') { ctx.fillStyle = 'rgba(255,255,255,.9)'; ell(ctx, a.x, a.y, 2.6 * s, 2.6 * s); ctx.fill(); }
    else if (kind === 'night') { ctx.fillStyle = `rgba(255,236,150,${0.3 + 0.6 * Math.abs(Math.sin(a.ph * 2))})`; ell(ctx, a.x, a.y, 2.2 * s, 2.2 * s); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,.55)'; ell(ctx, a.x, a.y, 3 * s, 3 * s); ctx.fill(); }
  }
}
const FW_COLS = ['#FFD75E', '#FF7BA8', '#7EC8FF', '#B18CFF', '#6BE0A6', '#FF9E6B'];
function fireworksTick(dt) {
  G.fwT = (G.fwT || 0) - dt;
  if (G.fwT <= 0 && !REDUCE) { G.fwT = 0.35 + Math.random() * 0.45; G.shells.push({ x: 0.15 + Math.random() * 0.7, y: 1.05, ty: 0.12 + Math.random() * 0.3, col: FW_COLS[(Math.random() * 6) | 0], heart: Math.random() < 0.3 }); }
}
function drawFireworks(dt, W, H) {
  ctx.globalCompositeOperation = 'lighter';
  for (const s of G.shells) {
    s.y -= dt * 1.4;
    ctx.fillStyle = '#FFE8B0'; ell(ctx, s.x * W, s.y * H, 2 * V.dpr, 2 * V.dpr); ctx.fill();
    if (s.y <= s.ty) {
      s.done = true; sfx('boom');
      const n = s.heart ? 40 : 56;
      for (let k = 0; k < n; k++) {
        let vx, vy;
        if (s.heart) { const a = k / n * 6.283; vx = Math.pow(Math.sin(a), 3); vy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16; }
        else { const z = Math.random() * 2 - 1, a = Math.random() * 6.283, kk = Math.sqrt(1 - z * z); vx = Math.cos(a) * kk; vy = Math.sin(a) * kk; }
        G.sparks.push({ x: s.x * W, y: s.y * H, vx: vx * 120 * V.dpr, vy: vy * 120 * V.dpr, t: 1.3, col: s.col });
      }
    }
  }
  G.shells = G.shells.filter(s => !s.done);
  for (const p of G.sparks) {
    p.t -= dt; p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) + 40 * V.dpr * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 1.5)); ctx.fillStyle = p.col; ell(ctx, p.x, p.y, 2.2 * V.dpr, 2.2 * V.dpr); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  G.sparks = G.sparks.filter(p => p.t > 0);
}

/* ── one frame ── */
function render(al, dt) {
  const L = G.L; if (!L || !V.w) return;
  V.tags = [];     // name tags drawn this frame (nameTag keeps them from overlapping)
  V.al = al;       // how far between two physics steps this frame is drawn (the net test measures what is drawn)
  const W = cv.width, H = cv.height;
  TP = V.tile * G.cam.z * V.dpr;
  CX = G.cam.x; CY = R - H / TP;
  if (G.shake > 0 && !REDUCE) { CX += (Math.random() - 0.5) * G.shake * 0.35; CY += (Math.random() - 0.5) * G.shake * 0.25; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackdrop(W, H);
  const c0 = Math.max(0, Math.floor(CX)), c1 = Math.min(L.w - 1, Math.ceil(CX + W / TP));
  const r0 = Math.max(0, Math.floor(CY));
  if (L.world.water) { const wy = sy(12.15); ctx.fillStyle = L.world.water; ctx.fillRect(0, wy, W, H - wy); ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < W; x += 26 * V.dpr) ctx.fillRect(x + ((G.clock * 20 * V.dpr) % (26 * V.dpr)), wy + 3 * V.dpr, 12 * V.dpr, 2 * V.dpr); }
  for (const d of L.decor) if (d.x > c0 - 1 && d.x < c1 + 2) drawDecor(d);
  for (let r = r0; r < R; r++) {
    const Y = Math.round(sy(r)), Hh = Math.round(sy(r + 1)) - Y;
    for (let c = c0; c <= c1; c++) {
      const t = L.grid[r * L.w + c]; if (!t) continue;
      const X = Math.round(sx(c)), Ww = Math.round(sx(c + 1)) - X;
      drawTile(t, c, r, X, Y, Ww, Hh);
    }
  }
  if (L.door) drawHouse(L.door);
  for (const s of L.signs) drawSign(s);
  for (const k of L.cps) drawFlag(k);
  for (const s of L.seesaws) drawSeesaw(s);
  for (const s of L.springs) drawSpring(s);
  for (const m of L.movers) drawPlatformThing(m, al, 'mover');
  for (const e of L.elevs) drawPlatformThing(e, al, 'elev');
  for (const b of L.boxes) drawBox(b, al);
  for (const it of L.items) drawItem(it);
  for (const e of L.enemies) drawEnemy(e, al);
  drawBoss(al);
  ctx.fillStyle = '#7FC4FF';
  for (const d of G.proj) { const X = sx(d.x), Y = sy(d.y); ctx.beginPath(); ctx.moveTo(X, Y - TP * 0.18); ctx.quadraticCurveTo(X + TP * 0.11, Y + TP * 0.05, X, Y + TP * 0.1); ctx.quadraticCurveTo(X - TP * 0.11, Y + TP * 0.05, X, Y - TP * 0.18); ctx.fill(); }
  drawPet(dt);
  const [a, b] = G.players;
  const order = a.y < b.y ? [b, a] : [a, b];
  for (const p of order) drawChar(p, al);
  for (const p of order) drawTag(p, al);
  drawHold(al);
  for (const p of G.parts) {
    const k = p.t / p.max; ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = p.col;
    if (p.star) { starPath(ctx, sx(p.x), sy(p.y), p.s * TP * 1.4); ctx.fill(); }
    else if (p.conf != null) { ctx.save(); ctx.translate(sx(p.x), sy(p.y)); ctx.rotate(p.conf); ctx.fillRect(-p.s * TP / 2, -p.s * TP / 4, p.s * TP, p.s * TP / 2); ctx.restore(); }
    else { ell(ctx, sx(p.x), sy(p.y), p.s * TP, p.s * TP); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const f of G.fx) {
    const k = f.t / f.max;
    if (f.kind === 'popheart') { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = '#FF6F9F'; heartPath(ctx, sx(f.x), sy(f.y), TP * 0.2); ctx.fill(); }
    else if (f.kind === 'splash') { ctx.globalAlpha = k; ctx.strokeStyle = '#9FD8FF'; ctx.lineWidth = TP * 0.05; ell(ctx, sx(f.x), sy(f.y), TP * 0.3 * (1 - k + 0.3), TP * 0.08); ctx.stroke(); }
    else if (f.kind === 'text') { ctx.globalAlpha = Math.min(1, k * 2); ctx.font = `900 ${Math.round(TP * 0.5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col; ctx.fillText(f.text, sx(f.x), sy(f.y)); }
  }
  ctx.globalAlpha = 1;
  ambTick(dt, W, H); drawAmb();
  if (G.shells.length || G.sparks.length) drawFireworks(dt, W, H);
}
function drawTile(t, c, r, X, Y, Ww, Hh) {
  const L = G.L;
  if (t === T_GROUND || t === T_ICE) {
    const m = (isGround(code(c, r - 1)) || r === 0 ? 1 : 0) | (isGround(code(c - 1, r)) ? 2 : 0) | (isGround(code(c + 1, r)) ? 4 : 0);
    ctx.drawImage(sprite(t === T_ICE ? 'ice' : 'ground', m), X, Y, Ww, Hh);
    if (t === T_ICE && !(m & 1)) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(X + Ww * 0.2, Y + Hh * 0.06, Ww * 0.3, Hh * 0.05); }
  } else if (t === T_BLOCK) ctx.drawImage(sprite('block'), X, Y, Ww, Hh);
  else if (t === T_PLAT) ctx.drawImage(sprite('plat', (code(c - 1, r) === T_PLAT ? 2 : 0) | (code(c + 1, r) === T_PLAT ? 4 : 0)), X, Y, Ww, Hh);
  else if (t === T_SPIKE) ctx.drawImage(sprite('spike'), X, Y, Ww, Hh);
  else if (t === T_GIFT || t === T_GIFTQ || t === T_USED) {
    const bump = G.bumps.find(g => g.c === c && g.r === r);
    const off = bump ? Math.sin((1 - bump.t / 0.22) * Math.PI) * Hh * 0.25 : 0;
    ctx.drawImage(sprite(t === T_GIFT ? 'gift' : t === T_GIFTQ ? 'giftq' : 'used'), X, Y - off, Ww, Hh);
  } else if (t === T_CRUMB) {
    const s = G.crumbs.get(r * L.w + c);
    if (s && s.st === 'gone') return;
    const sh = s && s.st === 'shake' && !REDUCE ? Math.sin(G.clock * 60 + c) * Ww * 0.05 : 0;
    ctx.drawImage(sprite('crumb'), X + sh, Y, Ww, Hh);
  } else if (t === T_BLUE || t === T_PINK) ctx.drawImage(sprite(t === T_BLUE ? 'blue' : 'pink'), X, Y, Ww, Hh);
  else if (t === T_GATE) {
    const a = G.chanA[L.chunkOf[c]] || 0, u = Ww / 100;
    ctx.fillStyle = 'rgba(80,60,40,.35)'; ctx.fillRect(X + 6 * u, Y, 4 * u, Hh); ctx.fillRect(X + Ww - 10 * u, Y, 4 * u, Hh);
    if (a < 0.99) {
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, Ww, Hh); ctx.clip();
      const lift = a * Hh * 1.05;
      ctx.fillStyle = '#E8A53A'; ctx.strokeStyle = '#9C6A16'; ctx.lineWidth = 3 * u;
      for (const bx of [22, 50, 78]) { rrect(ctx, X + (bx - 7) * u, Y - lift, 14 * u, Hh, 6 * u); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    if (code(c, r - 1) !== T_GATE) { ctx.fillStyle = '#9C6A16'; ctx.fillRect(X, Y, Ww, 8 * u); }
  } else if (t === T_BRIDGE) {
    const a = G.chanA[L.chunkOf[c]] || 0, u = Ww / 100;
    if (a < 1) { ctx.globalAlpha = 0.55 * (1 - a); ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = 4 * u; ctx.setLineDash([10 * u, 8 * u]); ctx.strokeRect(X + 3 * u, Y + 3 * u, Ww - 6 * u, 30 * u); ctx.setLineDash([]); }
    if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = '#C47D46'; rrect(ctx, X, Y, Ww, 34 * u, 6 * u); ctx.fill(); ctx.fillStyle = '#E8B07A'; rrect(ctx, X + 3 * u, Y + 3 * u, Ww - 6 * u, 22 * u, 4 * u); ctx.fill(); ctx.fillStyle = 'rgba(255,224,138,.5)'; ctx.fillRect(X, Y - 3 * u, Ww, 3 * u); }
    ctx.globalAlpha = 1;
  } else if (t === T_PLATE) {
    const pl = L.plates.find(p => p.c === c && p.r === r), down = pl && pl.down, u = Ww / 100;
    ctx.fillStyle = '#8D95AE'; rrect(ctx, X + 8 * u, Y + Hh - 14 * u, Ww - 16 * u, 14 * u, 5 * u); ctx.fill();
    if (down) { ctx.fillStyle = 'rgba(255,215,94,.35)'; ell(ctx, X + Ww / 2, Y + Hh - 8 * u, Ww * 0.55, 14 * u); ctx.fill(); }
    ctx.fillStyle = down ? '#FFD75E' : '#E8A53A'; rrect(ctx, X + 18 * u, Y + Hh - (down ? 20 : 32) * u, Ww - 36 * u, (down ? 8 : 20) * u, 6 * u); ctx.fill();
  } else if (t === T_BGATE) {
    if (G.bossFade >= 1) return;
    const u = Ww / 100;
    ctx.globalAlpha = 1 - (G.bossFade || 0);
    ctx.fillStyle = '#4F4A96'; ctx.fillRect(X + 10 * u, Y, Ww - 20 * u, Hh);
    ctx.fillStyle = '#332E6E'; ctx.fillRect(X + 10 * u, Y + Hh - 8 * u, Ww - 20 * u, 8 * u);
    if (r === 5) { ctx.fillStyle = '#FFD75E'; rrect(ctx, X + 30 * u, Y + 30 * u, 40 * u, 34 * u, 6 * u); ctx.fill(); ctx.strokeStyle = '#FFD75E'; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.arc(X + 50 * u, Y + 30 * u, 13 * u, Math.PI, 0); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

/* ══════════════ screens, controls, sound ══════════════ */
let API = null;                           // what app.js lends: names, who I am, the pet, the live channel, points
const UI = { home: null, stage: null, view: null, veil: null, panel: null };
const nameOf = (k) => CH[k].name;
const other = (k) => (k === 'cs' ? 'yy' : 'cs');
// the signs and tips say CS and YY; the couple may go by other names
const named = (t) => String(t || '').replace(/CS/g, '\u0001').replace(/YY/g, CH.yy.name).replace(/\u0001/g, CH.cs.name);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function css() {
  if (document.getElementById('cg-style')) return;
  const st = document.createElement('style'); st.id = 'cg-style';
  st.textContent = `
.cg-home[hidden],.cg-stage[hidden],.cg-stage [hidden],.cg-home [hidden]{display:none!important}
.cg-home{position:fixed;inset:0;z-index:150;overflow-y:auto;background:linear-gradient(180deg,#FFF3F8,#F1EBFF);color:#3A2F4F;padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) calc(20px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));box-sizing:border-box;animation:cg-in .28s ease-out}
html[data-theme="dark"] .cg-home{background:linear-gradient(180deg,#1E1A33,#2A1C36);color:#EEE8F6}
@keyframes cg-in{from{opacity:0;transform:translateY(14px)}}
.cg-col{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.cg-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.cg-top h3{margin:0;font-size:20px;font-weight:800}
.cg-x{width:44px;height:44px;border-radius:50%;border:0;background:rgba(120,100,160,.14);color:inherit;font-size:18px;cursor:pointer;flex:none}
.cg-card{background:rgba(255,255,255,.82);border:1.5px solid rgba(160,130,200,.28);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 20px -16px rgba(90,60,150,.5)}
html[data-theme="dark"] .cg-card{background:rgba(255,255,255,.07);border-color:rgba(200,180,255,.2)}
.cg-lab{font-size:12.5px;font-weight:800;opacity:.72;letter-spacing:.04em}
.cg-seg{display:flex;flex-wrap:wrap;gap:6px}
.cg-seg button{min-height:42px;padding:0 12px;border-radius:13px;border:1.5px solid rgba(150,120,190,.35);background:transparent;color:inherit;font:800 13.5px/1.2 sans-serif;font-family:inherit;cursor:pointer}
.cg-seg button[aria-pressed="true"]{background:rgba(255,143,179,.22);border-color:#E0508F}
.cg-seg button:disabled{opacity:.4;cursor:default}
.cg-line{font-size:13.5px;line-height:1.5;opacity:.85;margin:0}
.cg-line b{opacity:1}
.cg-pay{font-size:13px;font-weight:800;color:#B23A72;margin:0}
html[data-theme="dark"] .cg-pay{color:#FF9CC4}
.cg-peer{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;padding:10px 12px;border-radius:14px;background:rgba(150,120,190,.12)}
.cg-peer i{width:10px;height:10px;border-radius:50%;background:#C9B6D8;flex:none}
.cg-peer.on i{background:#3DBE7A;box-shadow:0 0 0 4px rgba(61,190,122,.2)}
.cg-worlds{display:flex;gap:6px;flex-wrap:wrap}
.cg-worlds button{min-height:40px;padding:0 10px;border-radius:12px;border:1.5px solid rgba(150,120,190,.3);background:transparent;color:inherit;font:800 13px/1 sans-serif;font-family:inherit;cursor:pointer}
.cg-worlds button[aria-selected="true"]{background:rgba(150,120,190,.18);border-color:currentColor}
.cg-levels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
@media (min-width:520px){.cg-levels{grid-template-columns:repeat(4,minmax(0,1fr))}}
.cg-lv{border:1.5px solid rgba(150,120,190,.3);border-radius:16px;background:rgba(255,255,255,.6);padding:11px;text-align:left;display:flex;flex-direction:column;gap:3px;min-height:96px;color:inherit;font-family:inherit;cursor:pointer}
html[data-theme="dark"] .cg-lv{background:rgba(255,255,255,.05)}
.cg-lv .n{font-size:20px;font-weight:900}
.cg-lv .nm{font-weight:800;font-size:13.5px}
.cg-lv .st{font-size:13px;letter-spacing:1px;color:#D08A16}
html[data-theme="dark"] .cg-lv .st{color:#F2C46B}
.cg-lv .bt{font-size:11.5px;opacity:.72;font-variant-numeric:tabular-nums}
.cg-lv .co{font-size:11.5px;font-weight:800;color:#B23A72}
html[data-theme="dark"] .cg-lv .co{color:#FF9CC4}
.cg-lv[disabled]{opacity:.45;cursor:default}
.cg-lv.done{background:rgba(255,226,160,.35)}
.cg-lv:focus-visible,.cg-seg button:focus-visible,.cg-worlds button:focus-visible,.cg-x:focus-visible{outline:3px solid #3F7FC4;outline-offset:2px}
.cg-stage{position:fixed;inset:0;z-index:160;background:#16132B;color:#fff;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
.cg-top2{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 6px max(10px,env(safe-area-inset-left,0px));font-variant-numeric:tabular-nums;z-index:3}
.cg-name{font-weight:800;font-size:15px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cg-stat{display:flex;align-items:center;gap:9px;font-weight:900;font-size:14.5px}
.cg-hp{color:#FF7AA6;letter-spacing:1px;font-size:16px}
.cg-hp .off{color:rgba(255,255,255,.22)}
.cg-btn{width:40px;height:40px;border-radius:12px;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:17px;flex:none;cursor:pointer}
.cg-view{position:relative;flex:1;min-height:0;overflow:hidden}
.cg-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.cg-bubble{position:absolute;z-index:2;transform:translate(-50%,-100%);max-width:min(78vw,300px);background:#FFFDF8;color:#3A2F3C;border-radius:14px;padding:8px 12px;font:700 13.5px/1.45 sans-serif;font-family:inherit;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none;text-align:center}
.cg-bubble::after{content:"";position:absolute;left:50%;bottom:-6px;width:12px;height:12px;background:inherit;transform:translateX(-50%) rotate(45deg)}
.cg-edge{position:absolute;z-index:2;top:42%;padding:4px 9px;border-radius:14px;background:rgba(20,16,40,.6);font-weight:800;font-size:13px;pointer-events:none}
.cg-edge.l{left:8px}.cg-edge.r{right:8px}
.cg-turn,.cg-net{position:absolute;z-index:2;top:10px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:14px;background:rgba(20,16,40,.66);font:800 13px/1.3 sans-serif;font-family:inherit;pointer-events:none;white-space:nowrap}
.cg-net{top:44px;background:rgba(160,60,100,.75)}
.cg-keys{position:absolute;z-index:2;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:14px;flex-wrap:wrap;font-size:13px;font-weight:800;color:rgba(255,255,255,.88);pointer-events:none;transition:opacity .6s;padding-inline:10px}
.cg-keys kbd{font:800 12px/1 sans-serif;font-family:inherit;padding:3px 6px;border-radius:6px;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.3);border-bottom-width:3px;color:#fff}
.cg-ctl{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:10px max(14px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 14px) max(14px,env(safe-area-inset-left,0px))}
.cg-dpad{display:flex;gap:10px}
.cg-cb{width:74px;height:74px;border-radius:22px;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:26px;touch-action:none;display:grid;place-items:center;font-family:inherit}
.cg-cb.on{background:rgba(255,255,255,.34)}
.cg-cb.cg-jump{width:88px;height:88px;border-radius:50%;background:rgba(255,122,166,.5);font:800 22px/1 sans-serif;font-family:inherit}
.cg-cb.cg-jump.on{background:rgba(255,122,166,.8)}
.cg-cb.cg-sm{width:58px;height:58px;border-radius:18px;font:800 12.5px/1.15 sans-serif;font-family:inherit}
.cg-cb.cg-sm[aria-pressed="true"]{background:rgba(255,122,166,.6)}
.cg-acts{display:flex;gap:10px;align-items:flex-end}
.cg-acol{display:flex;flex-direction:column;gap:10px}
.cg-sticks{position:absolute;inset:0;z-index:2;display:grid;grid-template-columns:1fr 1fr}
.cg-zone{position:relative;touch-action:none}
.cg-zone .lab{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);max-width:calc(100% - 28px);text-align:center;font:800 12.5px/1.3 sans-serif;font-family:inherit;padding:4px 10px;border-radius:10px;background:rgba(20,16,40,.5);pointer-events:none}
.cg-zone .lab{transition:opacity .8s}.cg-sticks.cg-quiet .lab{opacity:0}
.cg-zone .lab b,.cg-zone .lab span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cg-zone .lab span{font-weight:700;opacity:.85}
.cg-zone.l .lab{left:14px}.cg-zone.r .lab{right:14px}
.cg-knob{position:absolute;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:2px solid rgba(255,255,255,.4);pointer-events:none}
.cg-knob i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.55)}
.cg-rot{position:absolute;z-index:4;left:50%;top:12px;transform:translateX(-50%);background:rgba(20,16,40,.75);padding:8px 14px;border-radius:14px;font:800 13px/1.35 sans-serif;font-family:inherit;text-align:center;width:max-content;max-width:86%;pointer-events:none}
.cg-veil{position:absolute;inset:0;z-index:5;display:grid;place-items:center;padding:16px;background:rgba(14,10,30,.55)}
.cg-panel{width:min(100%,380px);max-height:100%;overflow:auto;background:#FFFDF9;color:#2C2540;border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:11px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}
html[data-theme="dark"] .cg-panel{background:#2A2546;color:#EEE8F6}
.cg-panel h2{font-size:24px;margin:0;font-weight:800}
.cg-panel h3{margin:0;font-size:16px}
.cg-panel p{margin:0;font-size:14.5px;opacity:.82;line-height:1.5}
.cg-panel .big{font-size:40px;line-height:1}
.cg-panel .cnt{font-size:56px;font-weight:900;line-height:1;color:#E0508F}
.cg-panel .stars{font-size:30px;letter-spacing:4px;color:#E8A53A}
.cg-panel .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-variant-numeric:tabular-nums}
.cg-panel .stats div{background:rgba(150,120,190,.14);border-radius:14px;padding:8px 4px;font-weight:900;font-size:18px}
.cg-panel .stats small{display:block;font-weight:700;font-size:11.5px;opacity:.75}
.cg-panel .pb{display:flex;flex-direction:column;gap:8px}
.cg-panel .pb button{min-height:48px;border-radius:16px;border:0;background:#D9467F;color:#fff;font:800 16px/1 sans-serif;font-family:inherit;cursor:pointer}
.cg-panel .pb button.alt{background:rgba(150,120,190,.16);color:inherit}
.cg-panel .tip-art{display:flex;justify-content:center;gap:4px;height:70px;align-items:flex-end}
.cg-panel .tip-art svg{width:58px;height:auto;overflow:visible}
.cg-panel .win{font-weight:800;color:#B23A72;opacity:1}
html[data-theme="dark"] .cg-panel .win{color:#FF9CC4}
@media (orientation:landscape) and (max-height:540px){
  .cg-ctl{position:absolute;left:0;right:0;bottom:0;pointer-events:none}
  .cg-ctl>*{pointer-events:auto}
  .cg-cb{width:64px;height:64px;background:rgba(255,255,255,.2)}
  .cg-cb.cg-jump{width:78px;height:78px}
  .cg-cb.cg-sm{width:52px;height:52px}
}
/* 默契拍拍 */
.cgb-stage{position:relative;height:230px;border-radius:22px;background:radial-gradient(circle at 50% 45%,rgba(255,143,179,.25),transparent 70%);border:1.5px solid rgba(160,130,200,.28);overflow:hidden;display:grid;place-items:center}
.cgb-heart{width:110px;height:110px;transition:transform .08s}
.cgb-heart svg{width:100%;height:100%;display:block}
.cgb-msg{position:absolute;top:12px;left:0;right:0;text-align:center;font-weight:800;font-size:19px;padding-inline:10px}
.cgb-sub{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-size:13px;opacity:.78;font-variant-numeric:tabular-nums}
.cgb-dots{position:absolute;left:12%;right:12%;bottom:40px;height:22px}
.cgb-dots .mid{position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(150,120,190,.4)}
.cgb-dots i{position:absolute;top:5px;width:12px;height:12px;border-radius:50%;transform:translateX(-50%);transition:left .15s}
.cgb-pads{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cgb-pads.one{grid-template-columns:1fr}
.cgb-pad{min-height:110px;border-radius:22px;border:0;font:800 20px/1.2 sans-serif;font-family:inherit;color:#fff;touch-action:manipulation;cursor:pointer}
.cgb-pad.cs{background:#3A78BE}.cgb-pad.yy{background:#D9467F}
.cgb-pad.hit{filter:brightness(1.15);transform:scale(.98)}
.cgb-go{min-height:50px;padding:0 26px;border:0;border-radius:17px;cursor:pointer;color:#fff;font:800 16px/1 sans-serif;font-family:inherit;background:linear-gradient(180deg,#F57FB0,#E0508F)}
.cgb-go:disabled{opacity:.45;cursor:default}
@media (prefers-reduced-motion:reduce){.cg-home{animation:none}.cg-keys{transition:none}}`;
  document.head.appendChild(st);
}

/* ── progress on this phone, per person ── */
const saveKey = () => `cg_save_${API.me}`;
function loadSave() { G.save = store.get(saveKey(), { unlocked: 1, best: {} }); if (!G.save.best) G.save.best = {}; }
function keepSave() { store.set(saveKey(), G.save); }

/* ── the stage ── */
function buildStage() {
  if (UI.stage) return;
  const s = document.createElement('div');
  s.className = 'cg-stage'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', '一起回家');
  s.innerHTML = `<div class="cg-top2"><div class="cg-name" data-r="name"></div>
      <div class="cg-stat"><span class="cg-hp" data-r="hp"></span><span data-r="hearts">💗 0</span><span data-r="stars">⭐ 0/3</span></div>
      <button type="button" class="cg-btn" data-r="sound" aria-label="声音">🔊</button><button type="button" class="cg-btn" data-r="pause" aria-label="暂停">⏸</button></div>
    <div class="cg-view" data-r="view"><canvas></canvas>
      <div class="cg-bubble" data-r="b1" hidden></div><div class="cg-bubble" data-r="b2" hidden></div>
      <div class="cg-edge" data-r="edge" hidden></div><div class="cg-turn" data-r="turn" hidden></div><div class="cg-net" data-r="net" hidden></div>
      <div class="cg-keys" data-r="keys" hidden></div><div class="cg-rot" data-r="rot" hidden>两个人一起玩：把手机横过来，一人一边</div>
      <div class="cg-sticks" data-r="sticks" hidden><div class="cg-zone l" data-z="0"><span class="lab"></span></div><div class="cg-zone r" data-z="1"><span class="lab"></span></div></div>
      <div class="cg-veil" data-r="veil" hidden><div class="cg-panel" data-r="panel" role="dialog" aria-modal="true"></div></div></div>
    <div class="cg-ctl" data-r="ctl" hidden>
      <div class="cg-dpad" data-r="dpad"><button type="button" class="cg-cb" aria-label="往左">◀</button><button type="button" class="cg-cb" aria-label="往右">▶</button></div>
      <div class="cg-acts"><div class="cg-acol"><button type="button" class="cg-cb cg-sm" data-r="hold" aria-pressed="false">💞<br>牵手</button><button type="button" class="cg-cb cg-sm" data-r="swap">🔁<br>换人</button></div>
      <button type="button" class="cg-cb cg-jump" data-r="jump" aria-label="跳">跳</button></div></div>`;
  s.hidden = true;
  document.body.appendChild(s);
  const R = (k) => s.querySelector(`[data-r="${k}"]`);
  Object.assign(UI, { stage: s, view: R('view'), veil: R('veil'), panel: R('panel'), sticks: R('sticks'), R });
  cv = s.querySelector('canvas'); ctx = cv.getContext('2d');
  wireControls();
}

function startLevel(i) {
  G.L = buildLevel(i);
  G.chanOn = new Uint8Array(G.L.chunks.length); G.chanA = new Float32Array(G.L.chunks.length);
  G.crumbs = new Map(); G.bumps = []; G.proj = []; G.parts = []; G.fx = []; G.shells = []; G.sparks = []; G.amb = [];
  G.bossDown = false; G.bossFade = 0; G.rainbow = 0; G.fwT = 0;
  G.players = [makePlayer(0, G.L.spawn[0]), makePlayer(1, G.L.spawn[1])];
  G.cp = { x: G.L.spawn[0].x + PW / 2 + 0.6, y: G.L.spawn[0].y + PH };
  G.cpSnap = null;
  G.hp = HP_MAX; G.hearts = 0; G.stars = [false, false, false]; G.time = 0; G.clock = 0; G.wt = 0; G.active = 0; G.hold = false;
  G.failT = 0; G.wonT = 0; G.resultShown = false; G.petPos = null; G.shake = 0; G.paidLine = '';
  if (ONLINE()) { G.active = G.meIdx; netLevelReset(); }
  V.spr.clear();
  syncHold();
  updateCamera(0, true);
}
function snapAtCp() { G.cpSnap = { cp: { ...G.cp }, hearts: G.hearts, stars: G.stars.slice(), time: G.time, got: G.L.items.map(it => (it.got ? 1 : 0)).join('') }; }
function applySnap(snap) {
  if (!snap) return;
  G.cp = { ...snap.cp }; G.hearts = snap.hearts; G.stars = snap.stars.slice(); G.time = snap.time; G.cpSnap = snap;
  G.L.items.forEach((it, k) => { if (snap.got[k] === '1') it.got = true; });
  for (const k of G.L.cps) if (k.x <= snap.cp.x + 0.01) k.on = true;
  G.players.forEach((p, k) => { p.x = p.px = snap.cp.x + (k ? 0.45 : -0.45) - PW / 2; p.y = p.py = snap.cp.y - PH; });
  updateCamera(0, true);
}
// local play restarts here; online, the host's phone starts both
function restartFrom(useCp) {
  if (ONLINE()) return netRequest(useCp ? 'cp' : 're');
  const snap = useCp ? G.cpSnap : null, i = G.L.i;
  startLevel(i); applySnap(snap); begin();
}
function updateCamera(dt, snap) {
  if (!G.L || !G.players.length) return;
  const vw = V.viewW || 14, [a, b] = G.players;
  let tz = 1, cx;
  if (G.mode === 'duo' && !a.dead && !b.dead) {
    const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
    tz = clamp(vw / (Math.abs(ax - bx) + 6), ZMIN, 1); cx = (ax + bx) / 2;
  } else {
    const p = G.mode === 'solo' ? G.players[G.active] : ONLINE() ? G.players[G.meIdx] : (a.dead ? b : a);
    cx = p.x + p.w / 2 + p.face * 1.4;
    if (G.mode === 'solo' && G.hold) cx = (a.x + b.x) / 2 + PW / 2 + p.face * 1.2;
  }
  G.cam.z = snap ? tz : G.cam.z + (tz - G.cam.z) * (1 - Math.exp(-4 * dt));
  const vwz = vw / G.cam.z, max = Math.max(0, G.L.w - vwz);
  const tx = clamp(cx - vwz / 2, 0, max);
  G.cam.x = snap ? tx : clamp(G.cam.x + (tx - G.cam.x) * (1 - Math.exp(-7 * dt)), 0, max);
}

function openStage(i, opts = {}) {
  buildStage();
  UI.stage.hidden = false; document.documentElement.style.overflow = 'hidden';
  if (UI.home) UI.home.hidden = true;
  ensureAudio(); configureControls(); resize();
  startLevel(i);
  if (opts.snap) applySnap(opts.snap);
  if (opts.countdown) showCountdown(); else showIntro();
  if (!rafOn) { rafOn = true; requestAnimationFrame(frame); }
}
function closeStage(fromNet) {
  if (!UI.stage || UI.stage.hidden) return;
  if (ONLINE() && !fromNet) netBye();
  UI.stage.hidden = true; G.state = 'off'; document.documentElement.style.overflow = '';
  KEYS.clear(); resetTouch(); UI.veil.hidden = true;
  if (UI.home) { UI.home.hidden = false; renderHome(); } else openHome();
}
function begin() {
  UI.veil.hidden = true; G.state = 'play'; last = 0;
  // silence only counts while playing: after a long pause (a phone call, a locked screen) the partner gets a fresh 25 s
  if (ONLINE()) NET.lastRx = Math.max(NET.lastRx, performance.now());
}
function togglePause(fromNet) {
  if (G.state === 'play') { G.state = 'paused'; showPause(fromNet); if (!fromNet) netEv('pause', {}); }
  else if (G.state === 'paused') { begin(); if (!fromNet) netEv('resume', {}); }
}
function showPanel(html, onClick) {
  UI.panel.innerHTML = html; UI.veil.hidden = false;
  UI.panel.onclick = (e) => { const b = e.target.closest('[data-a]'); if (b) onClick(b.dataset.a); };
  const first = UI.panel.querySelector('button'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
const lvName = (i) => `${LEVELS[i].world + 1}-${(i % 4) + 1} ${LEVELS[i].name}`;
function tipArt(kind) {
  const c = (k, st = '') => `<span style="display:inline-block;width:58px;${st}">${fullSvg(k, 'happy')}</span>`;
  if (kind === 'stack') return `<div class="tip-art" style="height:118px;position:relative;width:70px;margin:0 auto">${c('cs', 'position:absolute;left:6px;bottom:0')}${c('yy', 'position:absolute;left:6px;bottom:52px')}</div>`;
  const icon = { plate: '🟡🚪', lift: '🛗', color: '🟦🟪', box: '📦', seesaw: '⚖️', wings: '🪽', boss: '⛈️' }[kind] || '💞';
  return `<div class="tip-art">${c('cs')}<span style="font-size:34px;align-self:center">${icon}</span>${c('yy')}</div>`;
}
function controlsLine() {
  if (ONLINE()) return COARSE ? `你是 ${esc(nameOf(API.me))}：左边走，右边跳。` : `你是 ${esc(nameOf(API.me))}：← → 走，空格跳，Esc 暂停`;
  if (G.mode === 'duo') return COARSE ? '手机横过来，一人一边：按住拖动走，往上推就跳。' : `${esc(nameOf('cs'))}：A D 走，W 跳 · ${esc(nameOf('yy'))}：← → 走，↑ 跳`;
  return COARSE ? '左边走，右边跳；「换人」切换角色，「牵手」让两个人一起走。' : '← → 走，空格跳，Q 换人，E 牵手';
}
function tipHtml() {
  const L = G.L, t = L.spec.tip;
  return t ? tipArt(t.art) + `<h3>${esc(named(t.title))}</h3><p>${esc(named(t.text))}</p>` : '<p>两个人都进小屋才算过关。路上有 3 颗藏起来的星星。</p>';
}
function showIntro() {
  G.state = 'intro';
  const L = G.L;
  showPanel(`<p style="font-size:13px">${L.world.icon} ${L.world.name}</p><h2>${lvName(L.i)}</h2>${tipHtml()}
    <p style="font-size:13px">${controlsLine()}</p>
    <div class="pb"><button type="button" data-a="go">开始</button><button type="button" class="alt" data-a="menu">回到选关</button></div>`,
    (a) => { if (a === 'go') begin(); else closeStage(); });
}
// online: both phones count down together and start at once
function showCountdown() {
  G.state = 'intro';
  const L = G.L;
  let n = 3;
  const draw = () => showPanel(`<p style="font-size:13px">${L.world.icon} ${L.world.name} · 和 ${esc(nameOf(other(API.me)))} 一起</p><h2>${lvName(L.i)}</h2>${tipHtml()}
    <div class="cnt">${n}</div><p style="font-size:13px">${controlsLine()}</p>`, () => {});
  draw();
  clearInterval(showCountdown.t);
  showCountdown.t = setInterval(() => {
    n--; if (G.state !== 'intro') { clearInterval(showCountdown.t); return; }
    if (n <= 0) { clearInterval(showCountdown.t); begin(); sfx('cp'); } else { draw(); sfx('click'); }
  }, 1000);
}
function showPause(fromNet) {
  const who = fromNet ? `${esc(nameOf(other(API.me)))} 按了暂停` : '暂停';
  showPanel(`<h2>${who}</h2><p>${lvName(G.L.i)} · 用时 ${fmtT(G.time)}</p><p style="font-size:13px">${controlsLine()}</p>
    <div class="pb"><button type="button" data-a="go">继续</button>${G.cpSnap ? '<button type="button" class="alt" data-a="cp">回到旗子</button>' : ''}<button type="button" class="alt" data-a="re">这一关重来</button><button type="button" class="alt" data-a="menu">回到选关</button></div>`,
    (a) => { if (a === 'go') togglePause(); else if (a === 'cp') restartFrom(true); else if (a === 're') restartFrom(false); else closeStage(); });
}
function showFail() {
  G.state = 'fail'; sfx('fall');
  showPanel(`<div class="big">💔</div><h2>爱心用完了</h2><p>没关系，再来一次。${G.cpSnap ? '可以从刚才的旗子那里接着走。' : ''}</p>
    <div class="pb">${G.cpSnap ? '<button type="button" data-a="cp">从旗子那里再来</button>' : ''}<button type="button" ${G.cpSnap ? 'class="alt"' : ''} data-a="re">从头再来</button><button type="button" class="alt" data-a="menu">回到选关</button></div>`,
    (a) => { if (a === 'cp') restartFrom(true); else if (a === 're') restartFrom(false); else closeStage(); });
}
function win() {
  if (G.state === 'won' || G.state === 'result') return;
  G.state = 'won'; G.wonT = 0; sfx('win');
  for (const p of G.players) { p.happy = 9; p.vx = 0; }
  const i = G.L.i, rec = G.save.best[i] || {}, sm = (rec.sm || [false, false, false]).map((v, k) => v || G.stars[k]);
  G.lastBest = !rec.t || G.time < rec.t;
  G.save.best[i] = { t: G.lastBest ? G.time : rec.t, sm, h: Math.max(rec.h || 0, G.hearts) };
  G.save.unlocked = Math.max(G.save.unlocked || 1, Math.min(LEVELS.length, i + 2));
  keepSave();
  confetti(G.L.door.x, G.L.door.y - 2.5, 40);
  // the first clear of each level pays its player once; replays are just for fun
  G.paidLine = '';
  const pay = API.pay && !G.test ? API.pay('coop', 'L' + (i + 1), `${lvName(i)} 通关`) : Promise.resolve({ pts: 0, why: 'test' });
  pay.then((r) => {
    G.paidLine = r.pts ? `<p class="win">💙 第一次通关 +${r.pts} 分，记给 ${esc(nameOf(API.me))}</p>`
      : r.why === 'cap' ? '<p>今天的 +3 分已经拿满，这一关明天再通关就有分</p>'
      : r.why === 'again' ? '<p>这一关以前通关过了，这次是纯玩 😄</p>' : '';
    if (G.state === 'result') { const el = UI.panel.querySelector('[data-r="pay"]'); if (el) el.innerHTML = G.paidLine; }
  }).catch(() => {});
}
function showResult() {
  G.state = 'result';
  const i = G.L.i, n = G.stars.filter(Boolean).length, lastLv = i === LEVELS.length - 1;
  const stars = [0, 1, 2].map(k => (G.stars[k] ? '★' : '☆')).join('');
  showPanel(`${lastLv ? `<div class="big">🎆</div><h2>全部 20 关通关！</h2><p>${esc(nameOf('cs'))} 和 ${esc(nameOf('yy'))} 一起回到家了 💞</p>` : '<h2>回到家啦！</h2>'}
    <div class="stars" aria-label="${n} 颗星">${stars}</div>
    <div class="stats"><div>${fmtT(G.time)}<small>${G.lastBest ? '新纪录！' : '用时'}</small></div><div>💗 ${G.hearts}<small>爱心</small></div><div>${n}/3<small>星星</small></div></div>
    <div data-r="pay">${G.paidLine}</div>
    <div class="pb">${lastLv ? '' : '<button type="button" data-a="next">下一关</button>'}<button type="button" class="alt" data-a="re">再玩一次</button><button type="button" class="alt" data-a="menu">回到选关</button></div>`,
    (a) => {
      if (a === 'next') { if (ONLINE()) netRequest('next'); else { startLevel(i + 1); showIntro(); } }
      else if (a === 're') restartFrom(false); else closeStage();
    });
}
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ── the loop ── */
let rafOn = false, last = 0, acc = 0;
function frame(t) {
  if (!UI.stage || UI.stage.hidden || !G.L) { rafOn = false; return; }
  requestAnimationFrame(frame);
  const now = t / 1000, dt = last ? Math.min(0.05, now - last) : 1 / 60; last = now;
  if (ONLINE()) netTick(performance.now());
  if (!G.test && (G.state === 'play' || G.state === 'won' || G.state === 'dying')) {
    acc += dt; let n = 0;
    const steps = Math.min(8, Math.floor(acc / STEP));
    NET.stepT = performance.now() - steps * STEP * 1000;
    while (acc >= STEP && n < 8) { NET.stepT += STEP * 1000; step(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
  } else acc = 0;
  for (let k = 0; k < G.chanA.length; k++) G.chanA[k] = approach(G.chanA[k], G.chanOn[k] ? 1 : 0, dt * 4);
  if (G.bossDown) G.bossFade = Math.min(1, G.bossFade + dt * 1.5);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
  updateParts(dt);
  updateCamera(dt, false);
  render(G.test ? 1 : acc / STEP, dt);
  hud(); bubbles();
  // the "who is which side" hints cover both bottom corners, where the gaps and spikes are: fade them once play is under way
  const quiet = G.state === 'play' && G.time > 6, st = UI.sticks;
  if (st && st.classList.contains('cg-quiet') !== quiet) st.classList.toggle('cg-quiet', quiet);
}
let _hudKey = '';
function hud() {
  const key = `${G.L.i}|${G.hp}|${G.hearts}|${G.stars.join()}`;
  if (key === _hudKey) return; _hudKey = key;
  const R = UI.R;
  R('name').textContent = lvName(G.L.i);
  R('hp').innerHTML = Array.from({ length: HP_MAX }, (_, k) => (k < G.hp ? '♥' : '<span class="off">♥</span>')).join('');
  R('hp').setAttribute('aria-label', `我们的爱心 ${G.hp}/${HP_MAX}`);
  R('hearts').textContent = `💗 ${G.hearts}`;
  R('stars').textContent = `⭐ ${G.stars.filter(Boolean).length}/3`;
}
function place(el, wx, wy) { el.style.left = (sx(wx) / V.dpr) + 'px'; el.style.top = (sy(wy) / V.dpr) + 'px'; }
function bubbles() {
  const R = UI.R, b1 = R('b1'), b2 = R('b2'), edge = R('edge');
  if (G.state !== 'play' && G.state !== 'won') { b1.hidden = b2.hidden = edge.hidden = true; return; }
  const mine = G.players.filter(p => !p.dead && (isLocal(p) || G.mode !== 'online'));
  let sign = null, bd = 2.6;
  for (const s of G.L.signs) for (const p of mine) { const d = Math.abs(p.x + p.w / 2 - s.x); if (d < bd && Math.abs(p.y + p.h - s.y) < 3) { bd = d; sign = s; } }
  if (sign && sign.text) { const tx = named(sign.text); if (b1.textContent !== tx) b1.textContent = tx; place(b1, sign.x, sign.y - 1.35); b1.hidden = false; } else b1.hidden = true;
  let msg = null, at = null;
  const d = G.L.door;
  if (d && d.wait >= 0 && G.state === 'play') { msg = `等 ${nameOf(G.players[1 - d.wait].k)} 一起进门 💕`; at = [d.x, d.y - 3.2]; }
  for (const bx of G.L.boxes) if (bx.strain > 0.5) { msg = G.mode === 'solo' ? '一个人推不动！先「牵手」，再一起推' : '一个人推不动，要两个人一起推！'; at = [bx.x + 1, bx.y - 0.3]; }
  if (G.hint && G.hint.t > G.clock) { msg = G.hint.text; at = G.hint.at; }
  if (msg) { if (b2.textContent !== msg) b2.textContent = msg; place(b2, at[0], at[1]); b2.hidden = false; } else b2.hidden = true;
  // the other one, when they are off screen (one person playing both, or on their own phone)
  if (G.mode === 'solo' || ONLINE()) {
    const q = G.players[G.mode === 'solo' ? 1 - G.active : 1 - G.meIdx], vwz = V.viewW / G.cam.z;
    const off = q.x + q.w < G.cam.x ? 'l' : q.x > G.cam.x + vwz ? 'r' : '';
    if (off && !q.dead) { edge.className = 'cg-edge ' + off; edge.textContent = off === 'l' ? `← ${nameOf(q.k)}` : `${nameOf(q.k)} →`; edge.hidden = false; } else edge.hidden = true;
  } else edge.hidden = true;
}

/* ── controls ── */
function configureControls() {
  const R = UI.R, solo = G.mode === 'solo', online = ONLINE();
  R('ctl').hidden = !((solo || online) && COARSE);
  R('hold').hidden = R('swap').hidden = !solo;
  R('sticks').hidden = !(G.mode === 'duo' && COARSE);
  // two lines, so a long name never pushes the instruction out of a half-width zone
  R('sticks').querySelector('.l .lab').innerHTML = `<b>${esc(nameOf('cs'))}</b><span>拖动走，上推跳</span>`;
  R('sticks').querySelector('.r .lab').innerHTML = `<b>${esc(nameOf('yy'))}</b><span>拖动走，上推跳</span>`;
  const keys = R('keys');
  keys.hidden = COARSE;
  keys.innerHTML = online ? `<span>你是 ${esc(nameOf(API.me))}</span><span><kbd>←</kbd> <kbd>→</kbd> 走</span><span><kbd>空格</kbd> 跳</span><span><kbd>Esc</kbd> 暂停</span>`
    : solo ? '<span><kbd>←</kbd> <kbd>→</kbd> 走</span><span><kbd>空格</kbd> 跳</span><span><kbd>Q</kbd> 换人</span><span><kbd>E</kbd> 牵手</span><span><kbd>Esc</kbd> 暂停</span>'
    : `<span>${esc(nameOf('cs'))}：<kbd>A</kbd> <kbd>D</kbd> 走 <kbd>W</kbd> 跳</span><span>${esc(nameOf('yy'))}：<kbd>←</kbd> <kbd>→</kbd> 走 <kbd>↑</kbd> 跳</span><span><kbd>Esc</kbd> 暂停</span>`;
  keys.style.opacity = '1';
  clearTimeout(configureControls.t); configureControls.t = setTimeout(() => { keys.style.opacity = '0.35'; }, 7000);
  checkRotate();
}
function checkRotate() { if (UI.R) UI.R('rot').hidden = !(G.mode === 'duo' && COARSE && innerHeight > innerWidth && UI.stage && !UI.stage.hidden); }
function resetTouch() {
  TOUCH.solo.l = TOUCH.solo.r = TOUCH.solo.j = 0; for (const t of TOUCH.duo) t.l = t.r = t.j = 0;
  if (UI.stage) { UI.stage.querySelectorAll('.cg-knob').forEach(k => k.remove()); UI.stage.querySelectorAll('.cg-cb.on').forEach(b => b.classList.remove('on')); }
}
function swap() {
  if (G.mode !== 'solo' || G.state !== 'play') return;
  G.active ^= 1; G.hold = false; syncHold(); sfx('swap');
  const t = UI.R('turn'); t.textContent = `现在是 ${nameOf(G.players[G.active].k)}`; t.hidden = false;
  clearTimeout(swap.t); swap.t = setTimeout(() => { t.hidden = true; }, 1300);
}
function toggleHold() {
  if (G.mode !== 'solo' || G.state !== 'play') return;
  const [a, b] = G.players;
  if (G.hold) G.hold = false;
  else if (!a.dead && !b.dead && Math.abs(a.x - b.x) < 1.9 && Math.abs(a.y - b.y) < 1.2) { G.hold = true; sfx('swap'); }
  else { const p = G.players[G.active]; G.hint = { text: '走到对方旁边才能牵手', at: [p.x + p.w / 2, p.y - 0.3], t: G.clock + 1.6 }; }
  syncHold();
}
function syncHold() { if (UI.R) UI.R('hold').setAttribute('aria-pressed', String(!!G.hold)); }
function onKeyDown(e) {
  if (!UI.stage || UI.stage.hidden) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  KEYS.add(e.code);
  if (e.repeat) return;
  ensureAudio();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play' || G.state === 'paused') togglePause(); }
  if (G.mode === 'solo' && (e.code === 'KeyQ' || e.code === 'Tab')) swap();
  if (G.mode === 'solo' && e.code === 'KeyE') toggleHold();
  if (G.state === 'intro' && !ONLINE() && (e.code === 'Enter' || (G.mode === 'solo' && e.code === 'Space'))) begin();
}
const onKeyUp = (e) => KEYS.delete(e.code);
const onBlur = () => { KEYS.clear(); resetTouch(); };
function onVis() { if (document.hidden && G.state === 'play') togglePause(); }
function onResize() { if (UI.stage && !UI.stage.hidden) { resize(); checkRotate(); } }
function wireControls() {
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis); addEventListener('resize', onResize);
  const R = UI.R, dpad = R('dpad'), dptr = new Map();
  const dsync = () => {
    let l = 0, r = 0; for (const v of dptr.values()) { if (v === 'l') l = 1; else r = 1; }
    TOUCH.solo.l = l; TOUCH.solo.r = r;
    dpad.children[0].classList.toggle('on', !!l); dpad.children[1].classList.toggle('on', !!r);
  };
  const sideOf = (e) => { const rc = dpad.getBoundingClientRect(); return e.clientX < rc.left + rc.width / 2 ? 'l' : 'r'; };
  dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); try { dpad.setPointerCapture(e.pointerId); } catch (er) {} dptr.set(e.pointerId, sideOf(e)); dsync(); });
  dpad.addEventListener('pointermove', (e) => { if (dptr.has(e.pointerId)) { dptr.set(e.pointerId, sideOf(e)); dsync(); } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dpad.addEventListener(ev, (e) => { dptr.delete(e.pointerId); dsync(); });
  const jb = R('jump'), jptr = new Set();
  jb.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); try { jb.setPointerCapture(e.pointerId); } catch (er) {} jptr.add(e.pointerId); TOUCH.solo.j = 1; jb.classList.add('on'); if (G.state === 'intro' && !ONLINE()) begin(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) jb.addEventListener(ev, (e) => { jptr.delete(e.pointerId); if (!jptr.size) { TOUCH.solo.j = 0; jb.classList.remove('on'); } });
  R('swap').addEventListener('click', swap);
  R('hold').addEventListener('click', toggleHold);
  for (const b of R('ctl').querySelectorAll('button')) b.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const zone of R('sticks').querySelectorAll('.cg-zone')) {
    const z = +zone.dataset.z, ptrs = new Map();
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault(); ensureAudio(); if (G.state === 'intro') { begin(); return; }
      try { zone.setPointerCapture(e.pointerId); } catch (er) {}
      const rc = zone.getBoundingClientRect(), knob = document.createElement('div');
      knob.className = 'cg-knob'; knob.innerHTML = '<i></i>'; knob.style.left = (e.clientX - rc.left) + 'px'; knob.style.top = (e.clientY - rc.top) + 'px';
      zone.appendChild(knob); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, knob });
    });
    zone.addEventListener('pointermove', (e) => {
      const s = ptrs.get(e.pointerId); if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, m = Math.min(1, 40 / (Math.hypot(dx, dy) || 1));
      s.knob.firstChild.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
      const t = TOUCH.duo[z]; t.l = dx < -14 ? 1 : 0; t.r = dx > 14 ? 1 : 0; t.j = dy < -26 ? 1 : 0;
    });
    const up = (e) => { const s = ptrs.get(e.pointerId); if (!s) return; s.knob.remove(); ptrs.delete(e.pointerId); if (!ptrs.size) { const t = TOUCH.duo[z]; t.l = t.r = t.j = 0; } };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, up);
  }
  R('pause').addEventListener('click', () => { ensureAudio(); if (G.state === 'play' || G.state === 'paused') togglePause(); });
  R('sound').addEventListener('click', () => { AU.on = !AU.on; store.set('cg_sound', AU.on); R('sound').textContent = AU.on ? '🔊' : '🔇'; ensureAudio(); });
  R('sound').textContent = AU.on ? '🔊' : '🔇';
}

/* ── sound: tiny synthesized blips, nothing to download ── */
const AU = { ctx: null, on: store.get('cg_sound', true) !== false };
function ensureAudio() {
  if (!AU.on) return;
  try { if (!AU.ctx) AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (AU.ctx.state === 'suspended') AU.ctx.resume(); } catch (e) {}
}
function tone(f0, f1, dur, type, vol, delay = 0) {
  const a = AU.ctx, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, delay = 0) {
  const a = AU.ctx, t = a.currentTime + delay, len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g).connect(a.destination); s.start(t);
}
const _sfxAt = {};
function sfx(n) {
  if (!AU.on || !AU.ctx || G.test || AU.ctx.state !== 'running') return;
  const now = performance.now(); if (_sfxAt[n] && now - _sfxAt[n] < 45) return; _sfxAt[n] = now;
  const arp = (fs, gap, type = 'triangle', vol = 0.09, dur = 0.14) => fs.forEach((f, k) => tone(f, f * 1.01, dur, type, vol, k * gap));
  switch (n) {
    case 'jump': tone(300, 560, 0.12, 'square', 0.035); break;
    case 'heart': tone(990, 1480, 0.07, 'triangle', 0.06); break;
    case 'star': arp([1046, 1318, 1568, 2093], 0.07, 'triangle', 0.09); break;
    case 'stomp': tone(330, 90, 0.14, 'triangle', 0.13); break;
    case 'hurt': tone(440, 170, 0.28, 'sawtooth', 0.05); break;
    case 'fall': tone(620, 110, 0.45, 'triangle', 0.07); break;
    case 'spring': tone(190, 820, 0.24, 'sine', 0.11); break;
    case 'boing': tone(150, 760, 0.34, 'sine', 0.13); break;
    case 'gift': tone(660, 1000, 0.1, 'square', 0.04); break;
    case 'power': arp([523, 659, 784, 1046], 0.06, 'square', 0.035, 0.1); break;
    case 'click': tone(900, 640, 0.05, 'square', 0.04); break;
    case 'unclick': tone(560, 460, 0.05, 'square', 0.025); break;
    case 'crumble': noise(0.16, 0.05); break;
    case 'cp': arp([659, 880], 0.08); break;
    case 'win': arp([523, 659, 784, 1046, 1318], 0.1, 'triangle', 0.09, 0.2); break;
    case 'cheer': arp([784, 988, 1175, 1568, 1976], 0.08, 'triangle', 0.09, 0.22); break;
    case 'life': arp([880, 1175, 1568], 0.06); break;
    case 'pop': tone(700, 1200, 0.08, 'sine', 0.07); break;
    case 'swap': tone(740, 980, 0.09, 'sine', 0.06); break;
    case 'boom': noise(0.35, 0.05); tone(120, 50, 0.3, 'sine', 0.06); break;
    case 'bosshit': tone(260, 70, 0.3, 'square', 0.07); noise(0.2, 0.05); break;
    case 'rumble': noise(0.6, 0.04); tone(70, 50, 0.6, 'sawtooth', 0.04); break;
    case 'drip': tone(1300, 600, 0.06, 'sine', 0.03); break;
    case 'crack': tone(1800, 900, 0.05, 'square', 0.025); break;
    case 'shatter': noise(0.18, 0.06); break;
  }
}

/* ── 一起回家's own screen: how to play, the levels, your partner ── */
const NEW_IN = { 0: '新：叠罗汉', 1: '新：按钮开门', 2: '新：按钮变桥', 4: '新：电梯和弹簧', 6: '新：道具', 8: '新：蓝粉方块', 12: '新：一起推', 16: '新：跷跷板', 19: '最后一关' };
let menuWorld = 0;
function openHome() {
  css(); loadSave();
  if (!UI.home) {
    const h = document.createElement('div');
    h.className = 'cg-home'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-label', '一起回家');
    document.body.appendChild(h); UI.home = h;
    h.addEventListener('click', onHomeClick);
    // the sound context is made on the first tap in the menu, not when a level starts: creating one costs ~50 ms, which is a dropped frame mid-run
    h.addEventListener('pointerdown', ensureAudio, { passive: true });
  }
  UI.home.hidden = false;
  if (G.mode === 'online' && !API.online) G.mode = 'duo';
  menuWorld = Math.floor((Math.min(G.save.unlocked || 1, LEVELS.length) - 1) / 4);
  renderHome();
  netHome(true);
}
function closeHome() {
  netHome(false);
  if (UI.home) { UI.home.remove(); UI.home = null; }
  if (UI.stage) { UI.stage.remove(); UI.stage = null; }
  removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
  document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onResize);
  document.documentElement.style.overflow = '';
  G.state = 'off'; G.L = null;
  if (API && API.onClose) API.onClose();
}
function renderHome() {
  if (!UI.home) return;
  const unlocked = G.mode === 'online' ? LEVELS.length : (G.save.unlocked || 1);
  const peerOn = NET.peerAt && performance.now() - NET.peerAt < 4500;
  const pi = API.payInfo ? API.payInfo('coop') : { paid: 0, max: 3 };
  const petLine = G.petImg ? `${esc(G.petName || '你们的宠物')} 会跟着你们一起冒险` : '在小窝领养一只宠物（或者宝宝），TA 就会跟着你们一起冒险';
  UI.home.innerHTML = `<div class="cg-col">
    <div class="cg-top"><h3>🏠 一起回家</h3><button type="button" class="cg-x" data-a="x" aria-label="关闭">✕</button></div>
    <div class="cg-card">
      <span class="cg-lab">怎么玩</span>
      <div class="cg-seg">
        <button type="button" data-mode="online" aria-pressed="${G.mode === 'online'}" ${API.online ? '' : 'disabled'}>🤝 各用自己的手机</button>
        <button type="button" data-mode="duo" aria-pressed="${G.mode === 'duo'}">👫 一部手机两个人</button>
        <button type="button" data-mode="solo" aria-pressed="${G.mode === 'solo'}">🙋 一个人玩两个</button></div>
      ${G.mode === 'online' ? `<div class="cg-peer ${peerOn ? 'on' : ''}" data-r="peer"><i></i><span>${peerOn ? `${esc(nameOf(other(API.me)))} 也在这里 · 选一关就一起开始` : verOff() ? VER_HINT : `等 ${esc(nameOf(other(API.me)))} 也打开「一起回家」，选「各用自己的手机」`}</span></div>
        <p class="cg-line">你是 <b>${esc(nameOf(API.me))}</b>，用这部手机控制自己。${COARSE ? '左边走，右边跳。' : '← → 走，空格跳。'}</p>`
      : G.mode === 'duo' ? `<p class="cg-line">${COARSE ? '手机横过来，一人一边：按住拖动走，往上推就跳。' : `${esc(nameOf('cs'))} 用 A D 走、W 跳；${esc(nameOf('yy'))} 用 ← → 走、↑ 跳。`}</p>`
      : `<p class="cg-line">${COARSE ? '左边走，右边跳；「换人」切换角色，「牵手」让两个人一起走（推箱子要牵手）。' : '← → 走，空格跳，Q 换人，E 牵手（推箱子要牵手）。'}</p>`}
      <p class="cg-line">${petLine}</p>
      <p class="cg-pay">每一关第一次通关 +1 分 · 每天最多 +${pi.max}${pi.paid ? ` · 今天已拿 +${pi.paid}` : ''}</p>
    </div>
    <div class="cg-worlds" role="tablist" aria-label="五个世界">${WORLDS.map((w, k) => {
      let got = 0; for (let i = k * 4; i < k * 4 + 4; i++) got += ((G.save.best[i] || {}).sm || []).filter(Boolean).length;
      return `<button type="button" role="tab" data-w="${k}" aria-selected="${k === menuWorld}">${w.icon} ${w.name.split(' · ')[1]} ⭐${got}</button>`;
    }).join('')}</div>
    <div class="cg-levels">${[0, 1, 2, 3].map(j => {
      const i = menuWorld * 4 + j, L = LEVELS[i], rec = G.save.best[i], locked = i + 1 > unlocked;
      const st = rec ? (rec.sm || []).map(v => (v ? '★' : '☆')).join('') : '☆☆☆';
      return `<button type="button" class="cg-lv${rec ? ' done' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}>
        <span class="n">${locked ? '🔒 ' : ''}${L.world + 1}-${j + 1}</span><span class="nm">${L.name}</span><span class="st">${st}</span>
        <span class="bt">${rec ? '最快 ' + fmtT(rec.t) : locked ? '先过前一关' : '还没玩过'}</span>${NEW_IN[i] ? `<span class="co">${NEW_IN[i]}</span>` : ''}</button>`;
    }).join('')}</div>
    <p class="cg-line" style="font-size:12.5px">${G.mode === 'online' ? '各用自己的手机时，20 关都能直接选。' : '过了一关才能玩下一关。'}最高纪录和星星记在这部手机上。</p>
  </div>`;
}
function onHomeClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'x') return closeHome();
  if (b.dataset.mode) { if (b.disabled) return; G.mode = b.dataset.mode; store.set('cg_mode', G.mode); netHome(G.mode === 'online'); renderHome(); return; }
  if (b.dataset.w) { menuWorld = +b.dataset.w; renderHome(); return; }
  if (b.dataset.i && !b.disabled) {
    const i = +b.dataset.i;
    if (G.mode === 'online') return netPick(i);
    artReady.then(() => openStage(i));
  }
}

/* ══════════════ two phones, one level ══════════════
   Each phone is in charge of its own character: it moves at the tap, and
   ~15 times a second it says where it is. The partner's character is drawn
   from those messages 110 ms in the past, so there is always a pair of them
   to slide between. The host (whoever picked the level) is in charge of what
   is shared — enemies, boxes, the big cloud, the hearts bar, the door — and
   says so 10 times a second; anything that happens once (a heart picked up,
   a stomp, a flag) travels as an event. Rafts follow a world clock both phones
   keep in step. Nothing is stored anywhere; it all rides the couple's private
   live channel (the one the shared fireworks use). */
const NET_V = 2, DELAY = 110;   // 2: numbered events (2026-11-20); a phone on another version is told to reopen the app
let verAt = 0;   // when a message from a different version last arrived
const verOff = () => verAt && performance.now() - verAt < 5000;
const VER_HINT = '对方手机上的 app 不是最新的：两个人都把 app 关掉重新打开一次';
const NET = { n: 0, role: null, peerAt: 0, lastRx: 0, off: Infinity, offAt: 0, buf: [], wsnap: null, wrecv: 0, rtt: 120,
  sendAt: 0, worldAt: 0, hiAt: 0, piAt: 0, stepT: 0, goAt: 0, hiTimer: 0, listening: false, lastQ: null,
  // one-off events are numbered, resent until the partner's phone confirms them, and applied once and in order:
  // a socket that blips (a tunnel, a lift, a token renewal) must not leave the phones disagreeing about a win
  tx: 0, rx: 0, pend: [], hold: new Map(), holdAt: 0, heard: false, go: null, goSent: 0, rq: null, dead: [], byeAt: 0,
  // the partner is drawn NET.del ms in the past: enough to have two messages to slide between even on a jittery
  // phone network, little enough to feel immediate on a good one. pt is the clock they are drawn at
  cands: [], del: DELAY, pt: null };
const r3 = (v) => Math.round(v * 1000) / 1000, r1 = (v) => Math.round(v * 10) / 10;
const fin = (v) => typeof v === 'number' && isFinite(v);
function netSend(t, data) { if (!API || !API.live) return false; return API.live.send('cg', Object.assign({ t, v: NET_V }, data)); }
function netEv(k, data) {
  if (!ONLINE() || !NET.n || G.test && !G.testNet) return;
  const m = Object.assign({ n: NET.n, k }, data), now = performance.now();
  // a seesaw throw and the cloud's rain only make sense at that moment; everything else must arrive
  if (k !== 'launch' && k !== 'rain') { m.q = ++NET.tx; NET.pend.push({ m, at: now, t0: now }); }
  netSend('ev', m);
}
// a new level (a new n): nothing carries over
function netFresh() { NET.tx = 0; NET.rx = 0; NET.pend = []; NET.hold = new Map(); NET.holdAt = 0; NET.heard = false; NET.go = null; NET.rq = null; }
function netForget(n) { if (n) { NET.dead.push(n); if (NET.dead.length > 8) NET.dead.shift(); } }
function netListen() { if (NET.listening || !API || !API.live) return; NET.listening = true; API.live.on('cg', onNet); }
// keep the channel up while 一起回家 is open in online mode, and say hello
function netHome(on) {
  if (!API || !API.live) return;
  const want = G.mode === 'online' && API.online && (on || (UI.stage && !UI.stage.hidden));
  API.live.want(!!want);
  clearInterval(NET.hiTimer); NET.hiTimer = 0;
  if (want) {
    netListen();
    const hi = () => { netSend('hi', { who: G.meIdx }); if (UI.home && !UI.home.hidden) { const el = UI.home.querySelector('[data-r="peer"]'); const on2 = NET.peerAt && performance.now() - NET.peerAt < 4500; if (el && el.classList.contains('on') !== !!on2) renderHome(); } };
    hi(); NET.hiTimer = setInterval(hi, 1500);
  }
}
function netLevelReset() { NET.buf = []; NET.off = Infinity; NET.wsnap = null; NET.lastRx = performance.now(); NET.sendAt = 0; NET.worldAt = 0; NET.lastQ = null; NET.cands = []; NET.del = DELAY; NET.pt = null; }
function netPick(i) {
  const peerOn = NET.peerAt && performance.now() - NET.peerAt < 4500;
  if (!peerOn) { if (API.toast) API.toast(`等 ${nameOf(other(API.me))} 也打开「一起回家」`); return; }
  netStart(i, null);
}
function netStart(i, snap) {
  netFresh();
  NET.n = 1 + Math.floor(Math.random() * 2e9); NET.role = 'host'; NET.goAt = performance.now();
  NET.go = { n: NET.n, lv: i, who: G.meIdx, cp: snap || null }; NET.goSent = NET.goAt;   // resent until the partner's phone answers
  netSend('go', NET.go);
  artReady.then(() => openStage(i, { countdown: true, snap }));
}
function netGo(m) {
  if (!fin(m.lv) || m.lv < 0 || m.lv >= LEVELS.length || !fin(m.n) || m.who === G.meIdx) return;
  // both picked in the same moment: CS's pick wins, on both phones. (This once also asked for the countdown to be
  // showing — but the stage opens a moment after the pick, so who won depended on timing.)
  if (NET.role === 'host' && performance.now() - NET.goAt < 2000 && G.meIdx === 0) return;
  if (m.n === NET.n) return;
  if (G.mode !== 'online') return;
  netFresh();
  NET.n = m.n; NET.role = 'guest'; NET.peerAt = performance.now(); NET.heard = true;
  artReady.then(() => openStage(m.lv, { countdown: true, snap: m.cp && m.cp.cp ? m.cp : null }));
}
// 重来 / 下一关 from either phone; the host's phone actually starts it
function netRequest(k) {
  if (isHost()) { const i = G.L.i; return netStart(k === 'next' ? i + 1 : i, k === 'cp' ? G.cpSnap : null); }
  netSend('rq', { n: NET.n, k }); NET.rq = { k, at: performance.now(), t0: performance.now() };   // resent until the new level starts
  if (UI.panel) { const p = UI.panel.querySelector('.pb'); if (p) p.insertAdjacentHTML('beforebegin', `<p>等 ${esc(nameOf(other(API.me)))} 的手机开始…</p>`); }
}
function netBye() { if (NET.n) netSend('bye', { n: NET.n }); netForget(NET.n); NET.n = 0; NET.role = null; netFresh(); }
function partnerLeft() {
  if (!UI.stage || UI.stage.hidden) { if (UI.home) renderHome(); return; }
  netForget(NET.n); NET.n = 0; NET.role = null; netFresh(); G.state = 'left';
  showPanel(`<div class="big">👋</div><h2>${esc(nameOf(other(API.me)))} 离开了这一关</h2><p>回到选关，等 TA 回来再一起选一关吧。</p><div class="pb"><button type="button" data-a="menu">回到选关</button></div>`, () => closeStage(true));
}
function onNet(m) {
  if (!m) return;
  if (m.v !== NET_V) { if (m.t === 'hi' && !verOff() && UI.home && !UI.home.hidden) { verAt = performance.now(); renderHome(); } else if (m.t === 'hi') verAt = performance.now(); return; }
  const now = performance.now();
  // the partner is still in a level this phone has left (it was away too long, or the bye was lost): say so again
  if (m.n && m.n !== NET.n && NET.dead.includes(m.n) && m.t !== 'bye' && m.t !== 'go') { if (now - NET.byeAt > 1000) { NET.byeAt = now; netSend('bye', { n: m.n }); } return; }
  if (m.t === 'hi') {
    if (m.who === G.meIdx) return;   // the same login on another device is not the partner
    const was = NET.peerAt && now - NET.peerAt < 4500; NET.peerAt = now;
    if (m.n && m.n === NET.n) { NET.heard = true; NET.lastRx = now; netAck(m.ak); }
    if (!was && UI.home && !UI.home.hidden) renderHome(); return;
  }
  if (m.t === 'pi') { netSend('po', { a: m.a, b: now }); return; }
  if (m.t === 'po') { const rtt = now - m.a; if (rtt >= 0 && rtt < 4000) NET.rtt = NET.rtt * 0.7 + rtt * 0.3; return; }
  if (m.t === 'go') return netGo(m);
  if (m.t === 'bye') { if (m.n && m.n === NET.n) partnerLeft(); return; }
  if (!ONLINE() || !NET.n || m.n !== NET.n) return;
  NET.lastRx = now; NET.peerAt = now; NET.heard = true;
  if (m.t === 'st') { netAck(m.ak); return netState(m, now); }
  if (m.t === 'wd') return netWorld(m, now);
  if (m.t === 'ev') {
    if (!fin(m.q)) return netEvent(m);
    if (m.q <= NET.rx || NET.hold.has(m.q)) return;   // a resend of one already applied
    if (!NET.hold.size) NET.holdAt = now;
    NET.hold.set(m.q, m);
    while (NET.hold.has(NET.rx + 1)) { const e = NET.hold.get(NET.rx + 1); NET.hold.delete(NET.rx + 1); NET.rx++; netEvent(e); }
    if (!NET.hold.size) NET.holdAt = 0;
    return;
  }
  if (m.t === 'rq' && isHost() && (m.k === 're' || m.k === 'cp' || m.k === 'next')) return netRequest(m.k);
}
function netAck(ak) { if (fin(ak) && NET.pend.length) NET.pend = NET.pend.filter(e => e.m.q > ak); }
// sending: your character, and (host) the shared world
function netTick(now) {
  if (!NET.n || !G.L) return;
  if (now - NET.piAt > 2000) { NET.piAt = now; netSend('pi', { a: now }); }
  if (now - NET.hiAt > 1500) { NET.hiAt = now; netSend('hi', { who: G.meIdx, n: NET.n, ak: NET.rx }); }
  // what hasn't been confirmed goes again (in order; the other phone drops what it already has)
  if (NET.pend.length) {
    NET.pend = NET.pend.filter(e => now - e.t0 < 30000);
    for (const e of NET.pend) if (now - e.at > 400) { if (netSend('ev', e.m)) e.at = now; }
  }
  if (NET.hold.size && now - NET.holdAt > 6000) {   // a gap that never filled: move on rather than hold everything after it
    NET.rx = Math.min(...NET.hold.keys()) - 1;
    while (NET.hold.has(NET.rx + 1)) { const e = NET.hold.get(NET.rx + 1); NET.hold.delete(NET.rx + 1); NET.rx++; netEvent(e); }
    NET.holdAt = NET.hold.size ? now : 0;
  }
  if (NET.role === 'host' && NET.go && !NET.heard && now - NET.goSent > 800 && now - NET.goAt < 20000) { NET.goSent = now; netSend('go', NET.go); }
  if (NET.role === 'guest' && NET.rq && now - NET.rq.at > 1200 && now - NET.rq.t0 < 20000) { NET.rq.at = now; netSend('rq', { n: NET.n, k: NET.rq.k }); }
  const live = G.state === 'play' || G.state === 'won' || G.state === 'dying' || G.state === 'paused' || G.state === 'intro';
  if (!live) return;
  if (now - NET.sendAt >= 66) {
    NET.sendAt = now;
    const p = G.players[G.meIdx], L = G.L;
    const GK = { tile: 1, player: 2, box: 3, mover: 4, elev: 5, seesaw: 6, spring: 7 };
    const gk = p.grounded && p.ground ? (GK[p.ground.kind] || 1) : 0;
    const list = [null, null, null, L.boxes, L.movers, L.elevs, L.seesaws, L.springs][gk];
    const gi = list ? list.indexOf(p.ground.ref) : -1;
    const f = (p.grounded ? 1 : 0) | (p.dead > 0 ? 2 : 0) | (p.wings ? 4 : 0) | (p.shield ? 8 : 0) | (p.happy > 0 ? 16 : 0) | (p.strain > 0 ? 32 : 0) | (p.inv > 0 ? 64 : 0);
    netSend('st', { n: NET.n, ts: now, ak: NET.rx, p: [r3(p.x), r3(p.y), r1(p.vx), r1(p.vy), p.face, f, gk, gi, p.push ? p.push.dir : 0, p.push ? L.boxes.indexOf(p.push.box) : -1] });
  }
  if (isHost() && now - NET.worldAt >= 100) {
    NET.worldAt = now;
    const L = G.L, b = L.boss;
    const ST = { float: 0, warn: 1, dip: 2, rise: 3, hit: 4, dead: 5 };
    netSend('wd', { n: NET.n, ts: now, gs: G.state === 'won' ? 1 : G.state === 'dying' ? 2 : 0, wt: r3(G.wt), hp: G.hp, he: G.hearts, st: G.stars.reduce((m, v, k) => m | (v ? 1 << k : 0), 0), bd: G.bossDown ? 1 : 0,
      en: L.enemies.map(e => [r3(e.x), r3(e.y), e.dead ? 1 : 0, e.type === 'i' ? (e.st === 'hang' ? 0 : e.st === 'shake' ? 1 : 2) : (e.onGround ? 1 : 0), r1(e.vx || 0), r1(e.vy || 0)]),
      bx: L.boxes.map(q => [r3(q.x), r3(q.y)]), bs: b ? [r3(b.x), r3(b.y), ST[b.st], b.hp, b.inv > 0 ? 1 : 0] : null });
  }
  // a quiet partner: say so, and after a long while give up on them
  if (G.state === 'play') {
    const quiet = now - NET.lastRx;
    UI.R('net').hidden = quiet < 3500;
    if (quiet >= 3500) UI.R('net').textContent = `等 ${nameOf(other(API.me))} 的网络…`;
    if (quiet > 25000) partnerLeft();
  } else if (UI.R) UI.R('net').hidden = true;
}
function netState(m, now) {
  const a = m.p;
  if (!Array.isArray(a) || a.length < 10 || !a.slice(0, 5).every(fin) || !fin(m.ts)) return;
  // how late each message is (their clock to ours, plus the trip), over the last 4 s: the quickest one
  // is the trip itself, and how much later the slow ones come is the jitter the delay has to cover
  const C = NET.cands; C.push({ t: now, c: now - m.ts });
  while (C.length > 2 && C[0].t < now - 4000) C.shift();
  let lo = Infinity; for (const o of C) if (o.c < lo) lo = o.c;
  NET.off = lo;
  if (C.length >= 8) {
    const late = C.map(o => o.c - lo).sort((x, y) => x - y), jit = late[Math.floor(late.length * 0.95)];
    const want = clamp(70 + jit * 1.15, 90, 480);
    NET.del += (want - NET.del) * (want > NET.del ? 0.35 : 0.02);   // grow quickly when the network gets worse, shrink slowly
  }
  NET.buf.push({ ts: m.ts, x: a[0], y: a[1], vx: a[2], vy: a[3], face: a[4] < 0 ? -1 : 1, f: a[5] | 0, gk: a[6] | 0, gi: a[7] | 0, pd: a[8] | 0, pb: a[9] | 0 });
  if (NET.buf.length > 40) NET.buf.shift();
}
// the partner's character, moved to where their phone says it was 110 ms ago
function netRemoteStep() {
  const q = G.players[1 - G.meIdx], B = NET.buf;
  q.px = q.x; q.py = q.y;
  if (!B.length) { q.dx = q.dy = 0; return; }
  // the drawing clock runs at the phone's own pace, nudged (at most 15% faster or slower) towards where it
  // should be, so a change in the estimate never shows as a lurch. Only a big error (a new level, a long gap) snaps
  const target = NET.stepT - NET.off - NET.del;
  if (NET.pt == null || Math.abs(target - NET.pt) > 700) NET.pt = target;
  else NET.pt += STEP * 1000 * (1 + clamp((target - NET.pt) / 400, -0.15, 0.15));
  const tr = NET.pt;
  let s0 = B[0], s1 = null;
  for (let k = 0; k < B.length; k++) { if (B[k].ts <= tr) s0 = B[k]; else { s1 = B[k]; break; } }
  let x, y, vx, vy, s = s1 || s0;
  if (s1 && s0 !== s1 && s0.ts <= tr) {
    const k = clamp((tr - s0.ts) / Math.max(1, s1.ts - s0.ts), 0, 1);
    x = s0.x + (s1.x - s0.x) * k; y = s0.y + (s1.y - s0.y) * k; vx = s0.vx + (s1.vx - s0.vx) * k; vy = s0.vy + (s1.vy - s0.vy) * k;
    if (Math.abs(s1.x - s0.x) > 3 || Math.abs(s1.y - s0.y) > 3) { x = s1.x; y = s1.y; }   // a respawn: jump, don't slide
  } else {
    const ahead = clamp(tr - s0.ts, 0, 160) / 1000;   // running ahead of the messages: coast a little, then wait
    x = s0.x + s0.vx * ahead; y = s0.y; vx = s0.vx; vy = s0.vy; s = s0;
  }
  q.dx = x - q.x; q.dy = y - q.y;
  if (Math.abs(q.dx) > 3 || Math.abs(q.dy) > 3) { q.dx = q.dy = 0; q.px = x; q.py = y; G.petPos = G.petPos; }
  q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.face = s.face;
  const wasGround = q.grounded;
  q.grounded = !!(s.f & 1); q.dead = s.f & 2 ? 1 : 0; q.wings = !!(s.f & 4); q.shield = !!(s.f & 8);
  q.happy = s.f & 16 ? 1 : 0; q.strain = s.f & 32 ? 0.3 : 0; q.inv = s.f & 64 ? 0.5 : 0;
  const L = G.L, list = [null, null, null, L.boxes, L.movers, L.elevs, L.seesaws, L.springs][s.gk];
  const KIND = [null, 'tile', 'player', 'box', 'mover', 'elev', 'seesaw', 'spring'];
  q.ground = !q.grounded || !s.gk ? null : s.gk === 2 ? { kind: 'player', ref: G.players[G.meIdx] } : list ? { kind: KIND[s.gk], ref: list[s.gi] || null } : { kind: 'tile', code: 1 };
  if (q.ground && list && !q.ground.ref) q.ground = { kind: 'tile', code: 1 };
  q.push = s.pd && L.boxes[s.pb] ? { box: L.boxes[s.pb], dir: s.pd } : null;
  if (q.push) q.pushMem = { box: q.push.box, dir: q.push.dir, t: G.clock };
  const an = q.an;
  an.run = approach(an.run, q.grounded ? Math.min(1, Math.abs(vx) / RUN) : 0, STEP * 8);
  an.t += STEP * (Math.abs(vx) / RUN) * 2.8;
  if (!wasGround && q.grounded && vy > 7) an.squash = Math.min(1, vy / 22);
  an.squash = Math.max(0, an.squash - STEP * 6);
  an.blinkT -= STEP; if (an.blinkT <= 0) { an.blink = 0.12; an.blinkT = 2.4 + Math.random() * 2; } an.blink = Math.max(0, an.blink - STEP);
}
function netWorld(m, now) {
  if (isHost()) return;
  if (!Array.isArray(m.en) || !Array.isArray(m.bx)) return;
  NET.wsnap = m; NET.wrecv = now;
  if (fin(m.hp)) {
    // a hit this phone took that the host hasn't confirmed yet: don't let an older world give the heart back for a moment
    const hp = clamp(m.hp | 0, 0, HP_MAX), mine = NET.pend.some(e => e.m.k === 'hit');
    if (hp < G.hp) G.shake = 0.2;
    G.hp = mine ? Math.min(G.hp, hp) : hp;
  }
  if (fin(m.he)) G.hearts = Math.max(G.hearts, m.he | 0);   // never below what this phone just picked up (the host hasn't heard yet)
  if (fin(m.st)) G.stars = [0, 1, 2].map(k => !!(m.st & (1 << k)));
  // the win and the fail also ride the world, so a phone can never be left playing a level that is over
  if (m.gs === 1 && (G.state === 'play' || G.state === 'paused')) win();
  else if (m.gs === 2 && G.state === 'play') netEvent({ k: 'fail' });
  if (m.bd && !G.bossDown) { G.bossDown = true; G.rainbow = 0.01; G.proj = []; sfx('cheer'); if (G.L.boss) confetti(G.L.boss.x + 1.5, G.L.boss.y + 1, 50); }
  if (fin(m.wt)) {   // the world clock: rafts in the same place on both phones
    const target = m.wt + NET.rtt / 2000, err = target - G.wt;
    G.wt = Math.abs(err) > 0.5 ? target : G.wt + err * 0.2;
  }
}
// the other phone follows the host's world
function netWorldStep(dt) {
  const m = NET.wsnap, L = G.L; if (!m) return;
  const age = Math.min(0.3, (performance.now() - NET.wrecv) / 1000), k = 1 - Math.exp(-14 * dt);
  L.enemies.forEach((e, i) => {
    const r = m.en[i]; if (!r) return;
    e.px = e.x; e.py = e.y;
    const tx = r[0] + (r[2] ? 0 : r[4] * age), ty = r[1];
    if (Math.abs(tx - e.x) > 2 || Math.abs(ty - e.y) > 2) { e.x = tx; e.y = ty; } else { e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; }
    e.vx = r[4]; e.vy = r[5];
    if (e.type === 'i') e.st = ['hang', 'shake', 'fall'][r[3]] || 'hang'; else e.onGround = !!r[3];
    if (e.type !== 'c' && e.type !== 'j' && e.type !== 'i') e.t = (e.t || 0) + dt;
    if (r[2] && !e.dead) { e.dead = 0.45; if (e.type === 'i') e.gone = true; else e.squashed = true; }
    else if (e.dead) e.dead = Math.max(0.0001, e.dead - dt);
    else if (!r[2] && e.killedAt && G.clock - e.killedAt < 1.5) e.dead = 0.0001;   // a stomp from here the host hasn't heard yet
  });
  L.boxes.forEach((b, i) => {
    const r = m.bx[i]; if (!r) return;
    b.px = b.x; b.py = b.y; const ox = b.x, oy = b.y;
    if (Math.abs(r[0] - b.x) > 2 || Math.abs(r[1] - b.y) > 2) { b.x = r[0]; b.y = r[1]; } else { b.x += (r[0] - b.x) * k; b.y += (r[1] - b.y) * k; }
    b.dx = b.x - ox; b.dy = b.y - oy; b.x0 = b.x; b.x1 = b.x + b.w;
    let pr = 0; for (const p of G.players) if (!p.dead && p.push && p.push.box === b) pr++;
    b.strain = pr === 1 ? Math.min(1, b.strain + dt * 3) : Math.max(0, b.strain - dt * 2);
  });
  const b = L.boss;
  if (b && m.bs) {
    b.px = b.x; b.py = b.y;
    b.x += (m.bs[0] - b.x) * k; b.y += (m.bs[1] - b.y) * k;
    const st = ['float', 'warn', 'dip', 'rise', 'hit', 'dead'][m.bs[2]] || 'float';
    if (st === 'dead' && b.st !== 'dead') b.dead = 0;
    b.st = st; b.hp = m.bs[3]; b.inv = m.bs[4] ? Math.max(b.inv, 0.1) : Math.max(0, b.inv - dt);
    if (b.st === 'dead') b.dead += dt;
  }
}
function netEvent(m) {
  const L = G.L, me = G.players[G.meIdx], them = G.players[1 - G.meIdx];
  switch (m.k) {
    case 'item': { const it = m.key ? L.items.find(x => x.key === m.key) : L.items[m.i]; if (it && !it.got) collect(them, it, true); break; }
    case 'gift': if (fin(m.c) && fin(m.r)) hitGift(m.c | 0, m.r | 0, true); break;
    case 'crumb': if (fin(m.c) && fin(m.r) && code(m.c | 0, m.r | 0) === T_CRUMB) triggerCrumb(m.c | 0, m.r | 0, true); break;
    case 'cp': { const k = L.cps[m.i]; if (k) flagOn(k); break; }
    case 'stomp': if (isHost()) { const e = L.enemies[m.i]; if (e && !e.dead && e.type !== 'n' && e.type !== 'j') { e.dead = 0.45; e.squashed = true; sfx('stomp'); } } break;
    case 'bosshit': if (isHost()) bossDamage(); break;
    case 'hit': if (isHost()) loseHp(true); break;
    case 'launch': {
      const s = L.seesaws[m.s]; if (!s || !fin(m.side) || !fin(m.vy)) break;
      s.flip = 0.14; s.flipTo = Math.sign(m.side) * s.max;
      if (!me.dead && me.grounded && me.ground && me.ground.ref === s && Math.sign(me.x + me.w / 2 - s.px) === -Math.sign(m.side)) {
        me.vy = -clamp(m.vy, 0, 33); me.grounded = false; me.ground = null; me.launch = { vx: -Math.sign(m.side) * 4 }; me.happy = 1; sfx('boing');
        sparkle(me.x + me.w / 2, me.y + me.h, '#FFE08A', 12);
      }
      break;
    }
    case 'rain': if (!isHost() && fin(m.x) && fin(m.y) && fin(m.vy)) { const lat = Math.min(0.3, NET.rtt / 2000); G.proj.push({ x: m.x, y: m.y + m.vy * lat + 10 * lat * lat, vy: m.vy + 20 * lat }); } break;
    case 'win': if (!isHost() && (G.state === 'play' || G.state === 'paused')) win(); break;
    case 'fail': if (!isHost() && G.state === 'play') { G.hp = 0; G.state = 'dying'; G.failT = 0.9; } break;
    case 'pause': if (G.state === 'play') togglePause(true); break;
    case 'resume': if (G.state === 'paused') togglePause(true); break;
  }
}

/* ══════════════ 默契拍拍 ══════════════
   Tap on the heartbeat at the same moment as each other. On two phones the
   beat has to land at the same instant on both, so the phones measure the gap
   between their clocks first (a ping there and back, keeping the quickest
   one) and each schedules the same beats in its own time. Each phone times
   only its own taps, as "this many ms off the beat", and sends that number;
   both phones then judge each beat from the same two numbers, so both show
   the same verdict. */
const BEAT_LV = [
  { name: '慢慢来', bpm: 70, n: 8, blind: 99 }, { name: '快一点', bpm: 90, n: 8, blind: 99 }, { name: '心跳加速', bpm: 112, n: 10, blind: 99 },
  { name: '跟着感觉', bpm: 90, n: 10, blind: 4 }, { name: '心有灵犀', bpm: 100, n: 12, blind: 2 },
];
const BT = { root: null, lv: 0, mode: 'online', run: null, save: null, peerAt: 0, n: 0, role: null, off: 0, offRtt: Infinity, samples: [], timer: 0, listening: false };
const beatKey = () => `cgb_save_${API.me}`;
function beatOpen() {
  css();
  BT.save = store.get(beatKey(), { unlocked: 1, best: {} });
  BT.mode = API.online ? (store.get('cgb_mode', 'online') === 'online' ? 'online' : store.get('cgb_mode', 'duo')) : (store.get('cgb_mode', 'duo') === 'online' ? 'duo' : store.get('cgb_mode', 'duo'));
  if (!['online', 'duo', 'bot'].includes(BT.mode)) BT.mode = 'duo';
  const h = document.createElement('div');
  h.className = 'cg-home'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-label', '默契拍拍');
  document.body.appendChild(h); BT.root = h;
  h.addEventListener('pointerdown', ensureAudio, { passive: true });
  h.addEventListener('click', beatClick);
  h.addEventListener('pointerdown', (e) => { const pad = e.target.closest('.cgb-pad'); if (pad) { e.preventDefault(); beatTap(pad.dataset.who); } });
  addEventListener('keydown', beatKeyDown);
  beatRender(); beatNet(true);
}
function beatClose() {
  beatStop(); beatNet(false);
  removeEventListener('keydown', beatKeyDown);
  if (BT.root) { BT.root.remove(); BT.root = null; }
  if (API && API.onClose) API.onClose();
}
const beatPeerOn = () => BT.peerAt && performance.now() - BT.peerAt < 4000;
function beatPads() {
  const me = API.me;
  if (BT.mode === 'online') return `<div class="cgb-pads one"><button type="button" class="cgb-pad ${me}" data-who="${me}">${esc(nameOf(me))} 拍这里</button></div>`;
  if (BT.mode === 'bot') return `<div class="cgb-pads"><button type="button" class="cgb-pad ${me}" data-who="${me}">${esc(nameOf(me))} 拍这里</button><button type="button" class="cgb-pad ${other(me)}" data-who="${other(me)}" disabled>${esc(nameOf(other(me)))}（电脑）</button></div>`;
  return `<div class="cgb-pads"><button type="button" class="cgb-pad cs" data-who="cs">${esc(nameOf('cs'))} 拍这里</button><button type="button" class="cgb-pad yy" data-who="yy">${esc(nameOf('yy'))} 拍这里</button></div>`;
}
function beatRender() {
  if (!BT.root) return;
  const L = BEAT_LV[BT.lv], b = BT.save.best[BT.lv], pi = API.payInfo ? API.payInfo('beat') : { paid: 0, max: 3 };
  const synced = BT.offRtt < 1500;
  const canGo = BT.mode !== 'online' || (beatPeerOn() && (BT.role === 'host' || synced));
  BT.root.innerHTML = `<div class="cg-col">
    <div class="cg-top"><h3>💓 默契拍拍</h3><button type="button" class="cg-x" data-a="x" aria-label="关闭">✕</button></div>
    <div class="cg-card">
      <div class="cg-seg"><button type="button" data-m="online" aria-pressed="${BT.mode === 'online'}" ${API.online ? '' : 'disabled'}>🤝 各用自己的手机</button>
        <button type="button" data-m="duo" aria-pressed="${BT.mode === 'duo'}">👫 一部手机</button><button type="button" data-m="bot" aria-pressed="${BT.mode === 'bot'}">🙋 和电脑练习</button></div>
      ${BT.mode === 'online' ? `<div class="cg-peer ${beatPeerOn() ? 'on' : ''}" data-r="peer"><i></i><span>${beatPeerOn() ? `${esc(nameOf(other(API.me)))} 也在 · ${synced ? '两部手机的时间对好了' : '正在对时间…'}` : verOff() ? VER_HINT : `等 ${esc(nameOf(other(API.me)))} 也打开「默契拍拍」，选「各用自己的手机」`}</span></div>` : ''}
      <p class="cg-line">跟着心跳，两个人在同一刻拍下去。差得越少，心就越大。${BT.mode === 'duo' ? (COARSE ? '' : `（电脑：${esc(nameOf('cs'))} 按 A，${esc(nameOf('yy'))} 按 L）`) : (COARSE ? '' : '（电脑：按空格）')}</p>
      <p class="cg-pay">每一关第一次过关 +1 分 · 每天最多 +${pi.max}${pi.paid ? ` · 今天已拿 +${pi.paid}` : ''}</p>
    </div>
    <div class="cg-seg" data-r="lvls">${BEAT_LV.map((l, k) => `<button type="button" data-l="${k}" aria-pressed="${k === BT.lv}" ${k + 1 > BT.save.unlocked && BT.mode !== 'online' ? 'disabled' : ''}>${k + 1 > BT.save.unlocked && BT.mode !== 'online' ? '🔒 ' : ''}${k + 1}. ${l.name}</button>`).join('')}</div>
    <div class="cgb-stage"><div class="cgb-msg" data-r="msg">${b ? `这一关最好：${b} 分` : `${L.bpm} 拍/分钟 · ${L.n} 拍${L.blind < 99 ? ' · 后面心跳会消失' : ''}`}</div>
      <div class="cgb-heart" data-r="heart"><svg viewBox="0 0 100 92" aria-hidden="true"><defs><radialGradient id="cgbh" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFC2D6"/><stop offset="1" stop-color="#E0457F"/></radialGradient></defs><path d="M50 88C20 66 4 50 4 30C4 15 15 4 29 4C38 4 45 9 50 16C55 9 62 4 71 4C85 4 96 15 96 30C96 50 80 66 50 88Z" fill="url(#cgbh)" stroke="#B8306A" stroke-width="3"/><path d="M22 24Q28 14 38 15" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/></svg></div>
      <div class="cgb-dots" aria-hidden="true"><span class="mid"></span><i data-r="dcs" style="left:50%;background:#3A78BE;opacity:0"></i><i data-r="dyy" style="left:50%;background:#D9467F;opacity:0"></i></div>
      <div class="cgb-sub" data-r="sub"></div></div>
    ${beatPads()}
    <div class="cg-seg"><button type="button" class="cgb-go" data-a="go" ${canGo ? '' : 'disabled'}>开始</button></div>
  </div>`;
}
const BR = (k) => BT.root && BT.root.querySelector(`[data-r="${k}"]`);
function beatClick(e) {
  const b = e.target.closest('button'); if (!b || b.classList.contains('cgb-pad')) return;
  if (b.dataset.a === 'x') return beatClose();
  if (b.dataset.m) { if (b.disabled) return; beatStop(); BT.mode = b.dataset.m; store.set('cgb_mode', BT.mode); beatNet(true); beatRender(); return; }
  if (b.dataset.l && !b.disabled) { beatStop(); BT.lv = +b.dataset.l; beatRender(); return; }
  if (b.dataset.a === 'go') {
    if (BT.run) { beatStop(); beatRender(); return; }
    ensureAudio();
    if (BT.mode === 'online') { BT.n = 1 + Math.floor(Math.random() * 2e9); BT.role = 'host'; BT.heard = false; const at = performance.now() + 1600; BT.go = { n: BT.n, lv: BT.lv, at }; beatSend('go', BT.go); beatStart(BT.lv, at); }
    else beatStart(BT.lv, performance.now() + 400);
  }
}
function beatKeyDown(e) {
  if (!BT.root || e.repeat) return;
  if (BT.mode === 'duo') { if (e.code === 'KeyA') beatTap('cs'); else if (e.code === 'KeyL') beatTap('yy'); }
  else if (e.code === 'Space') { e.preventDefault(); beatTap(API.me); }
}
function beatSend(t, data) { return API.live ? API.live.send('cgb', Object.assign({ t, v: NET_V }, data)) : false; }
function beatNet(on) {
  if (!API || !API.live) return;
  const want = on && BT.mode === 'online' && API.online && !!BT.root;
  API.live.want(!!want);
  clearInterval(BT.timer); BT.timer = 0;
  if (!want) return;
  if (!BT.listening) { BT.listening = true; API.live.on('cgb', beatOnNet); }
  const tick = () => {
    beatSend('hi', { who: G.meIdx }); beatSend('pi', { a: performance.now() });
    const el = BR('peer'); if (el && el.classList.contains('on') !== !!beatPeerOn() && !BT.run) beatRender();
  };
  tick(); BT.timer = setInterval(tick, 1000);
}
function beatOnNet(m) {
  if (!m) return;
  const now = performance.now();
  if (m.v !== NET_V) { if (m.t === 'hi') { const was = verOff(); verAt = now; if (!was && !BT.run) beatRender(); } return; }
  if (m.t === 'hi') { if (m.who === G.meIdx) return; const was = beatPeerOn(); BT.peerAt = now; if (!was && !BT.run) beatRender(); return; }
  if (m.t === 'pi') { beatSend('po', { a: m.a, b: now }); return; }
  if (m.t === 'po') {
    // their clock minus mine, from the quickest round trip lately
    const rtt = now - m.a; if (!(rtt >= 0 && rtt < 3000)) return;
    BT.samples.push({ rtt, off: m.b - (m.a + rtt / 2) }); if (BT.samples.length > 12) BT.samples.shift();
    const best = BT.samples.reduce((a, s) => (s.rtt < a.rtt ? s : a));
    const was = BT.offRtt < 1500; BT.off = best.off; BT.offRtt = best.rtt;
    if (!was && !BT.run) beatRender();
    return;
  }
  if (BT.mode !== 'online') return;
  if (m.t === 'go' && fin(m.lv) && m.lv >= 0 && m.lv < BEAT_LV.length && fin(m.at)) {
    BT.peerAt = now;
    if (BT.run && BT.role === 'host' && G.meIdx === 0) return;   // both pressed 开始 at once: CS's start wins
    if (m.n === BT.n && (BT.run || BT.ended === m.n)) return;   // the same start again (it is resent until answered)
    BT.n = m.n; BT.role = 'guest'; BT.lv = m.lv; beatRender();
    ensureAudio(); beatStart(m.lv, m.at - BT.off);
    return;
  }
  // the partner's whole list so far: a number is a tap that far off the beat, null is a beat they missed.
  // Sent again and again, so a late or lost message only delays a verdict, never changes it
  if (m.t === 'taps' && BT.run && m.n === BT.n && fin(m.up) && Array.isArray(m.d)) {
    if (BT.role === 'host') BT.heard = true;
    const who = other(API.me), R0 = BT.run;
    for (let k = 0; k <= Math.min(m.up, R0.beats.length - 1); k++) {
      const b = R0.beats[k], v = m.d[k];
      if (b.known[who]) continue;
      b.known[who] = true;
      if (fin(v)) { b[who] = clamp(v, -2000, 2000); if (!b.done) beatFlash(who); }
    }
    return;
  }
  if (m.t === 'stop' && BT.run && m.n === BT.n) { beatStop(); beatRender(); const el = BR('msg'); if (el) el.textContent = `${nameOf(other(API.me))} 停下了`; }
}
function beatStart(lv, at) {
  const L = BEAT_LV[lv], iv = 60 / L.bpm * 1000, lead = 4;
  BT.run = { lv, L, iv, t0: at, lead, beats: Array.from({ length: L.n }, (_, k) => ({ t: at + (lead + k) * iv, cs: null, yy: null, done: false, known: {} })), pts: 0, combo: 0, tick: 0, repAt: 0 };
  if (BT.mode === 'bot') { const bot = other(API.me); for (const b of BT.run.beats) if (Math.random() > 0.06) b['bot_' + bot] = (Math.random() + Math.random() + Math.random() - 1.5) * 70; }
  const go = BT.root && BT.root.querySelector('[data-a="go"]'); if (go) { go.textContent = '停下'; go.disabled = false; }
  requestAnimationFrame(beatFrame);
}
function beatStop() {
  if (!BT.run) return;
  if (BT.mode === 'online' && BT.n) { const n = BT.n; beatSend('stop', { n }); setTimeout(() => beatSend('stop', { n }), 400); setTimeout(() => beatSend('stop', { n }), 1200); }
  BT.run = null; BT.rep = null;
}
// online: my taps so far, for every beat whose window has closed here (and any I have tapped)
function beatReport(R0, now) {
  const me = API.me; let up = -1;
  R0.beats.forEach((b, k) => { if (b[me] != null || now > b.t + R0.iv / 2) up = k; });
  const rep = { n: BT.n, up, d: R0.beats.slice(0, up + 1).map(b => (b[me] == null ? null : Math.round(b[me] * 10) / 10)) };
  beatSend('taps', rep); BT.rep = rep; R0.repAt = now;
}
function beatFlash(who) { const el = BT.root && BT.root.querySelector(`.cgb-pad[data-who="${who}"]`); if (el) { el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90); } }
function beatTap(who) {
  const R0 = BT.run; if (!R0) return;
  if (BT.mode === 'online' && who !== API.me) return;
  if (BT.mode === 'bot' && who !== API.me) return;
  const now = performance.now();
  beatFlash(who);
  if (AU.ctx && AU.on) tone(who === 'cs' ? 520 : 780, who === 'cs' ? 480 : 720, 0.07, 'sine', 0.06);
  let best = -1, bd = R0.iv / 2;
  R0.beats.forEach((b, k) => { const d = Math.abs(now - b.t); if (d < bd && b[who] == null && !b.done) { bd = d; best = k; } });
  if (best < 0) return;
  const dt = now - R0.beats[best].t;
  R0.beats[best][who] = dt;
  if (BT.mode === 'online') beatReport(R0, now);
}
function beatFrame() {
  const R0 = BT.run; if (!R0 || !BT.root) return;
  const now = performance.now(), L = R0.L, heart = BR('heart'), msg = BR('msg');
  const k = Math.floor((now - R0.t0) / R0.iv), into = (now - R0.t0) / R0.iv - k;
  if (k >= 0 && k + 1 !== R0.tick && k < R0.lead + L.n) {
    R0.tick = k + 1;
    const counting = k < R0.lead, visible = counting || k - R0.lead < L.blind;
    if (AU.ctx && AU.on && visible) tone(counting ? 660 : 880, counting ? 640 : 860, 0.05, 'square', 0.03);
    if (counting) msg.textContent = ['预备', '3', '2', '1'][k] || '';
    else if (k - R0.lead === 0) msg.textContent = '拍！';
    else if (k - R0.lead === L.blind) msg.textContent = '心跳不见了，跟着感觉拍';
  }
  const showPulse = k < R0.lead || k - R0.lead < L.blind;
  heart.style.transform = `scale(${(1 + Math.min(R0.combo, 6) * 0.06) * (showPulse && !REDUCE ? 1 + Math.max(0, 0.16 - into * 0.5) : 1)})`;
  if (BT.mode === 'bot') { const bot = other(API.me); for (const b of R0.beats) if (b['bot_' + bot] != null && b[bot] == null && now >= b.t + b['bot_' + bot]) { b[bot] = b['bot_' + bot]; beatFlash(bot); } }
  // a beat is judged once both taps are in, or once its window has closed. On two phones a missing
  // tap is only a miss when the partner's phone says so (its report), never because a message is late:
  // otherwise one phone would say 「没拍到」 while the other gave points for the same beat
  const online = BT.mode === 'online', them = other(API.me);
  if (online && (now - R0.repAt > 250)) beatReport(R0, now);
  if (online && BT.role === 'host' && !BT.heard && BT.go && now - (BT.goSent || 0) > 400 && now < R0.t0) { BT.goSent = now; beatSend('go', BT.go); }
  let late = false;
  for (const b of R0.beats) {
    if (b.done || now < b.t + R0.iv / 2 && !(b.cs != null && b.yy != null && now > b.t)) continue;
    if (online && !b.known[them] && b[them] == null) {
      if (now < b.t + R0.iv / 2 + 10000) { if (now > b.t + R0.iv / 2 + 2500) late = true; break; }   // wait for their report (in order), up to 10 s
    }
    b.done = true;
    let label, pts = 0;
    if (b.cs != null && b.yy != null) {
      const d = Math.abs(b.cs - b.yy);
      if (d <= 60) { label = `完美同步 💞 只差 ${Math.round(d)} 毫秒`; pts = 3; } else if (d <= 120) { label = `很棒！差 ${Math.round(d)} 毫秒`; pts = 2; } else if (d <= 200) { label = `还行，差 ${Math.round(d)} 毫秒`; pts = 1; } else label = `没对上，差 ${Math.round(d)} 毫秒`;
    } else label = b.cs == null && b.yy == null ? '两个人都没拍到' : `${nameOf(b.cs == null ? 'cs' : 'yy')} 没拍到`;
    R0.pts += pts; R0.combo = pts >= 2 ? R0.combo + 1 : 0;
    msg.textContent = label;
    const pos = (t) => (t == null ? 50 : clamp(50 + t / (R0.iv / 2) * 50, 2, 98));
    const dcs = BR('dcs'), dyy = BR('dyy');
    dcs.style.left = pos(b.cs) + '%'; dcs.style.opacity = b.cs == null ? 0 : 1;
    dyy.style.left = pos(b.yy) + '%'; dyy.style.opacity = b.yy == null ? 0 : 1;
  }
  const done = R0.beats.filter(b => b.done).length;
  BR('sub').textContent = late ? `等 ${nameOf(them)} 的网络…` : `${done}/${L.n} 拍 · ${R0.pts} 分`;
  if (done === L.n) return beatEnd(R0);
  requestAnimationFrame(beatFrame);
}
function beatEnd(R0) {
  const L = R0.L, score = Math.round(R0.pts / (3 * L.n) * 100), pass = score >= 55;
  if (BT.mode === 'online') {   // the partner may still be waiting on my last beats: keep telling them for a few seconds
    beatReport(R0, performance.now()); const rep = BT.rep; BT.ended = BT.n;
    for (const t of [300, 800, 1600, 3000]) setTimeout(() => { if (BT.rep === rep && !BT.run) beatSend('taps', rep); }, t);
  }
  BT.run = null; BT.last = { lv: R0.lv, score, pass, pts: R0.pts };
  BT.save.best[R0.lv] = Math.max(BT.save.best[R0.lv] || 0, score);
  if (pass && R0.lv + 2 > BT.save.unlocked) BT.save.unlocked = Math.min(BEAT_LV.length, R0.lv + 2);
  store.set(beatKey(), BT.save);
  beatRender();
  BR('msg').textContent = `默契 ${score} 分${pass ? ' 🎉' : ''}`;
  BR('sub').textContent = pass ? (R0.lv < BEAT_LV.length - 1 ? '过关！下一关解锁了' : '最难的一关也过了 💞') : '55 分过关，再来一次';
  const go = BT.root.querySelector('[data-a="go"]'); if (go) go.textContent = '再来一次';
  if (pass && BT.mode !== 'bot' && API.pay && !G.test) API.pay('beat', 'B' + (R0.lv + 1), `${BEAT_LV[R0.lv].name} 过关 · 默契 ${score} 分`).then((r) => {
    if (r.pts && BR('sub')) BR('sub').textContent += ` · 💙 第一次过关 +${r.pts} 分，记给 ${nameOf(API.me)}`;
  }).catch(() => {});
}

/* ── what app.js calls ── */
function rasterPet(svg) {
  return new Promise((res) => {
    if (!svg) return res(null);
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); const h = 320; c.width = Math.round(h * img.width / img.height); c.height = h; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c); };
    img.onerror = () => res(null);
    let s = String(svg);
    if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace(/<svg([^>]*?)class="[^"]*"/, '<svg$1');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
function adopt(api) {
  API = api;
  CH.cs.name = api.names.cs || 'CS'; CH.yy.name = api.names.yy || 'YY';
  G.meIdx = api.me === 'yy' ? 1 : 0;
  G.petName = api.pet ? api.pet.name || '' : '';
  return rasterPet(api.pet && api.pet.svg).then((c) => { G.petImg = c; });
}
window.CoopGames = {
  open(kind, api) {
    return Promise.all([adopt(api), artReady]).then(() => {
      if (kind === 'beat') return beatOpen();
      const m = store.get('cg_mode', api.online ? 'online' : 'duo');
      G.mode = m === 'online' && !api.online ? 'duo' : ['online', 'duo', 'solo'].includes(m) ? m : 'duo';
      openHome();
    });
  },
  close() { if (BT.root) beatClose(); if (UI.home || UI.stage) closeHome(); },
  // for the play-tests: drive both characters one fixed step at a time
  test: {
    LEVELS, CHUNKS, G, NET, BT,
    start(i, mode = 'duo') { G.mode = mode; if (mode !== 'online') { NET.n = 0; } openStage(i); G.test = true; begin(); },
    stepFn: (dt) => step(dt), STEP,
    inp(i, o) { TEST_IN[i] = Object.assign({ l: false, r: false, j: false }, o || {}); },
    tp(i, x, y) { const p = G.players[i]; p.x = p.px = x; p.y = p.py = y; p.vx = p.vy = 0; p.grounded = false; p.ground = null; p.launch = null; },
    set(k, v) { G[k] = v; }, swap, toggleHold, closeStage: () => closeStage(), render: () => render(1, 0),
    solidCell, oneWayCell, surfTop, home: () => UI.home, stage: () => UI.stage, beatTap, al: () => (V.al == null ? 1 : V.al),
  },
};
})();
