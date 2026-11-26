/* 我们的家 — the couple's house and garden, loaded by app.js the first time it opens (CLAUDE.md §7.34).

   Two people walk around one house, each on their own phone; the pet follows whoever moved last.
   The garden is real and slow on purpose: each of you can water each pot once a day, a flower takes
   five waterings (three days if you both water), a pot nobody waters for three days droops until
   somebody does, and a flower picked is pet EXP (and so 小窝币) for both of you.

   What is shared lives in one save on the server (game-save, compare-and-set); where each of you is
   standing travels over the couple's live channel and is never stored, except where you were when you
   left. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REDUCE = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
// Calendar dates are the phone's own (CLAUDE.md §2), as YYYY-MM-DD; differences are whole days.
const dnum = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
const dayDiff = (a, b) => Math.round(dnum(b) - dnum(a));
const addDays = (d, n) => { const t = new Date((dnum(d) + n) * 86400000); return t.toISOString().slice(0, 10); };

const HOME_V = 2;            // the live messages' version: a phone on another one is asked to reopen the app (2: depth too)
// 2026-11-26 (「make it can move up and down also and make it more 3D」): each floor is a strip with depth, drawn in
// perspective — `back` is where the back wall meets it, `front` its front edge (in % of the scene's height) — and you
// walk anywhere on it, a little smaller the further back. G0 / G1 are the middle of the ground floor and of upstairs:
// where the pots stand, and where a walk to that floor arrives.
const G0 = 86, G1 = 51.5;
const WILT = 3;              // days without water before a growing plant droops
const PICK_EXP = 20;         // pet EXP per flower picked (half of it is 小窝币)
const BEAT_MS = 12000, GONE_MS = 32000, POLL_MS = 45000;
const CHAR = { cs: 'char1', yy: 'char2' }, KEY = { char1: 'cs', char2: 'yy' }, OTHER = { cs: 'yy', yy: 'cs' };
const BIT = { char1: 1, char2: 2 };

/* ── CS and YY, the approved chubby drawings (the same two as 一起回家) ── */
const CH = {
  cs: { body: '#FFFCF6', shade: '#EFE7DB', edge: '#CFC3B4', ear: '#DCE6F5', earEdge: '#A9BBD8' },
  yy: { body: '#FFD9E4', shade: '#F9BACD', edge: '#E995B2', ear: '#FFC4D6', earEdge: '#E995B2' },
};
let uid = 0;
function charSvg(k) {
  const cs = k === 'cs', c = CH[k], id = 'hmg' + k + (++uid);
  return `<svg viewBox="0 0 100 112" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="26%" r="85%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="${c.body}"/><stop offset="1" stop-color="${c.shade}"/></radialGradient></defs>
    <ellipse class="hm-shadow" cx="50" cy="105" rx="34" ry="5.5" fill="rgba(60,30,20,.22)"/><g class="hm-face">
    <ellipse class="hm-f1" cx="36" cy="100" rx="11" ry="6" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6"/><ellipse class="hm-f2" cx="64" cy="100" rx="11" ry="6" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6"/>
    <g class="hm-bd">
    <ellipse cx="${cs ? 9 : 15}" cy="${cs ? 46 : 38}" rx="11" ry="${cs ? 23 : 15}" fill="${c.ear}" stroke="${c.earEdge}" stroke-width="2.6" transform="rotate(${cs ? 12 : -24} ${cs ? 9 : 15} ${cs ? 46 : 38})"/>
    <ellipse cx="${cs ? 91 : 85}" cy="${cs ? 46 : 38}" rx="11" ry="${cs ? 23 : 15}" fill="${c.ear}" stroke="${c.earEdge}" stroke-width="2.6" transform="rotate(${cs ? -12 : 24} ${cs ? 91 : 85} ${cs ? 46 : 38})"/>
    <path d="M50 8C79 8 93 31 93 59C93 86 76 100 50 100C24 100 7 86 7 59C7 31 21 8 50 8Z" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.8"/>
    <g class="hm-hl"><ellipse cx="11" cy="72" rx="7" ry="10" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6" transform="rotate(24 11 72)"/></g><g class="hm-hr"><ellipse cx="89" cy="72" rx="7" ry="10" fill="url(#${id})" stroke="${c.edge}" stroke-width="2.6" transform="rotate(-24 89 72)"/></g>
    ${cs ? '<path d="M17 74Q50 88 83 74L84 82Q50 97 16 82Z" fill="#7FB2EC" stroke="#4F86C6" stroke-width="2.2" stroke-linejoin="round"/><path d="M62 86L70 100L60 97Z" fill="#7FB2EC" stroke="#4F86C6" stroke-width="2.2" stroke-linejoin="round"/>'
         : '<path d="M50 84C46 79 39 82 42 88C44 92 50 95 50 95C50 95 56 92 58 88C61 82 54 79 50 84Z" fill="#FF8FB3"/>'}
    <g class="hm-cheek"><ellipse cx="24" cy="60" rx="8" ry="5" fill="#FF9CB8"/><ellipse cx="76" cy="60" rx="8" ry="5" fill="#FF9CB8"/></g>
    <g class="hm-eyes"><circle cx="34" cy="50" r="3.6" fill="#3A2F3C"/><circle cx="66" cy="50" r="3.6" fill="#3A2F3C"/><circle cx="35.2" cy="48.8" r="1.2" fill="#fff"/><circle cx="67.2" cy="48.8" r="1.2" fill="#fff"/></g>
    <path class="hm-joyeyes" d="M29 51.5Q34 45.5 39 51.5M61 51.5Q66 45.5 71 51.5" fill="none" stroke="#3A2F3C" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M45 57Q47.5 60 50 57Q52.5 60 55 57" fill="none" stroke="#3A2F3C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    ${cs ? '' : '<path d="M62 14L47 6L49 23Z M62 14L77 7L74 24Z" fill="#FF8FB3" stroke="#D9558C" stroke-width="2" stroke-linejoin="round"/><circle cx="62" cy="14.5" r="5" fill="#FFB3CB" stroke="#D9558C" stroke-width="2"/>'}
    </g></g></svg>`;
}

/* ── the house's own furniture (the 客厅 holds the couple's real 小窝 furniture instead) ── */
const SH = '<ellipse cx="50" cy="94" rx="42" ry="5.5" fill="rgba(60,30,20,.2)"/>';
const ART = {
  bed: `${SH}<rect x="6" y="26" width="16" height="62" rx="6" fill="#C99B74" stroke="#9A6F4A" stroke-width="3"/><rect x="12" y="52" width="82" height="32" rx="8" fill="#FFF6EC" stroke="#C9A98A" stroke-width="3"/><path d="M40 52H86Q94 52 94 60V84H40Z" fill="#F8B7CC" stroke="#E58AAB" stroke-width="3" stroke-linejoin="round"/><rect x="18" y="44" width="24" height="16" rx="7" fill="#fff" stroke="#C9A98A" stroke-width="3"/>`,
  bear: `<ellipse cx="50" cy="94" rx="24" ry="4.5" fill="rgba(60,30,20,.2)"/><circle cx="30" cy="28" r="10" fill="#C99466" stroke="#96663E" stroke-width="3"/><circle cx="70" cy="28" r="10" fill="#C99466" stroke="#96663E" stroke-width="3"/><ellipse cx="50" cy="72" rx="24" ry="22" fill="#D2A074" stroke="#96663E" stroke-width="3"/><circle cx="50" cy="40" r="23" fill="#D2A074" stroke="#96663E" stroke-width="3"/><ellipse cx="50" cy="47" rx="9" ry="7" fill="#F3DDC4"/><circle cx="41" cy="37" r="3" fill="#3A2A20"/><circle cx="59" cy="37" r="3" fill="#3A2A20"/>`,
  lamp: `<ellipse cx="50" cy="94" rx="18" ry="4" fill="rgba(60,30,20,.2)"/><rect x="47" y="34" width="6" height="54" fill="#B98A5E"/><ellipse cx="50" cy="90" rx="15" ry="4.5" fill="#B98A5E"/><path d="M34 8H66L74 38H26Z" fill="#FFE9A8" stroke="#D9B45C" stroke-width="3" stroke-linejoin="round"/>`,
  tree: `${SH}<rect x="43" y="56" width="14" height="36" rx="4" fill="#B07F56" stroke="#84593A" stroke-width="3"/><circle class="hm-leaf" cx="32" cy="46" r="20" fill="#6FBF73" stroke="#3F8F4F" stroke-width="3"/><circle class="hm-leaf" cx="68" cy="46" r="20" fill="#6FBF73" stroke="#3F8F4F" stroke-width="3"/><circle class="hm-leaf hm-leaf-top" cx="50" cy="28" r="24" fill="#84CC84" stroke="#3F8F4F" stroke-width="3"/><circle class="hm-fruit" cx="40" cy="48" r="3.5" fill="#FF8FA8"/><circle class="hm-fruit" cx="62" cy="38" r="3.5" fill="#FF8FA8"/><circle class="hm-fruit" cx="30" cy="34" r="3" fill="#FF8FA8"/>`,
  stove: `${SH}<rect x="14" y="40" width="72" height="50" rx="6" fill="#EEF2F7" stroke="#9AA6B8" stroke-width="3"/><rect x="22" y="58" width="56" height="26" rx="4" fill="#C9D3E2" stroke="#9AA6B8" stroke-width="2.5"/><ellipse cx="50" cy="36" rx="20" ry="6" fill="#E07A5F" stroke="#B5523A" stroke-width="2.5"/><path d="M42 26q4-8 0-14M52 26q4-8 0-14" stroke="#C9D3E2" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  table: `${SH}<rect x="10" y="50" width="80" height="10" rx="4" fill="#D6AE86" stroke="#9A6F4A" stroke-width="3"/><rect x="18" y="58" width="7" height="32" fill="#B98A5E"/><rect x="75" y="58" width="7" height="32" fill="#B98A5E"/><path d="M44 50h12l-2-16h-8z" fill="#BFE3F5" stroke="#8FB9D0" stroke-width="2"/><circle cx="50" cy="28" r="7" fill="#FF8FB3"/><circle cx="50" cy="28" r="3" fill="#FFE27A"/>`,
  pethouse: `${SH}<rect x="16" y="44" width="68" height="46" rx="4" fill="#F2C08E" stroke="#B98A5E" stroke-width="3"/><path d="M8 48L50 14L92 48Z" fill="#7FB2EC" stroke="#5F8CC8" stroke-width="3" stroke-linejoin="round"/><path d="M38 90V70a12 12 0 0124 0V90Z" fill="#6B4A3A"/>`,
  fridge: `${SH}<rect x="24" y="8" width="52" height="84" rx="8" fill="#EEF4F8" stroke="#9FB3C3" stroke-width="3"/><path d="M24 40H76" stroke="#9FB3C3" stroke-width="3"/><rect x="65" y="15" width="4" height="17" rx="2" fill="#9FB3C3"/><rect x="65" y="47" width="4" height="24" rx="2" fill="#9FB3C3"/><circle cx="37" cy="25" r="4.5" fill="#FF8FB3"/><rect x="33" y="52" width="15" height="10" rx="2" fill="#FFD75E"/><path d="M31 14V33" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>`,
  shelf: `${SH}<rect x="14" y="12" width="72" height="80" rx="4" fill="#C99B74" stroke="#9A6F4A" stroke-width="3"/><rect x="20" y="18" width="60" height="21" fill="#A97A50"/><rect x="20" y="45" width="60" height="21" fill="#A97A50"/><rect x="20" y="72" width="60" height="14" fill="#A97A50"/><rect x="23" y="22" width="6" height="17" fill="#7FB2EC"/><rect x="30" y="20" width="6" height="19" fill="#FF8FB3"/><rect x="37" y="24" width="5" height="15" fill="#FFD75E"/><rect x="45" y="21" width="7" height="18" fill="#8FD19E" transform="rotate(8 48 30)"/><rect x="24" y="49" width="7" height="17" fill="#C69CFF"/><rect x="32" y="51" width="6" height="15" fill="#FF9E6B"/><circle cx="64" cy="58" r="7" fill="#6FBF73"/><rect x="60" y="58" width="8" height="8" fill="#E58A5C"/><rect x="40" y="76" width="22" height="10" rx="2" fill="#FFF6EA"/><path d="M18 16V88" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`,
  plant: `${SH}<ellipse cx="38" cy="40" rx="9" ry="20" fill="#5DB565" stroke="#3F8F4F" stroke-width="3" transform="rotate(-24 38 40)"/><ellipse cx="62" cy="38" rx="9" ry="22" fill="#6CC274" stroke="#3F8F4F" stroke-width="3" transform="rotate(20 62 38)"/><ellipse cx="50" cy="32" rx="9" ry="24" fill="#84CC84" stroke="#3F8F4F" stroke-width="3"/><path d="M34 62H66L61 92H39Z" fill="#E58A5C" stroke="#B9653C" stroke-width="3" stroke-linejoin="round"/><rect x="31" y="58" width="38" height="8" rx="3" fill="#F2A275" stroke="#B9653C" stroke-width="3"/><path d="M45 26q3 -10 6 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>`,
  bench: `${SH}<rect x="8" y="46" width="84" height="10" rx="4" fill="#D6AE86" stroke="#9A6F4A" stroke-width="3"/><rect x="8" y="30" width="84" height="9" rx="4" fill="#D6AE86" stroke="#9A6F4A" stroke-width="3"/><rect x="16" y="54" width="7" height="36" fill="#9A6F4A"/><rect x="77" y="54" width="7" height="36" fill="#9A6F4A"/>`,
};
const art = (k) => `<svg viewBox="0 0 100 100" aria-hidden="true">${ART[k]}</svg>`;

/* ── what the festivals bring ── */
const LANTERN = '<svg viewBox="0 0 40 70" aria-hidden="true"><path d="M20 0V10" stroke="#9C6A16" stroke-width="2"/><rect x="13" y="9" width="14" height="5" rx="2" fill="#E8B04B"/><ellipse cx="20" cy="30" rx="15" ry="17" fill="#E5402E" stroke="#B5281C" stroke-width="2"/><path d="M14 16Q10 30 14 44M26 16Q30 30 26 44M20 13V47" stroke="#B5281C" stroke-width="1.5" fill="none"/><rect x="13" y="46" width="14" height="4" rx="2" fill="#E8B04B"/><path d="M17 50L15 64M20 50V66M23 50L25 64" stroke="#E8B04B" stroke-width="2" stroke-linecap="round"/></svg>';
const RABBIT = '<svg viewBox="0 0 60 52" aria-hidden="true"><ellipse cx="30" cy="30" rx="20" ry="13" fill="#FFF7F2" stroke="#E9B9A8" stroke-width="2"/><ellipse cx="20" cy="12" rx="4" ry="11" fill="#FFF7F2" stroke="#E9B9A8" stroke-width="2" transform="rotate(-12 20 12)"/><ellipse cx="28" cy="10" rx="4" ry="11" fill="#FFF7F2" stroke="#E9B9A8" stroke-width="2" transform="rotate(8 28 10)"/><circle cx="16" cy="27" r="2.2" fill="#E5402E"/><circle cx="18" cy="46" r="4" fill="#C99B74"/><circle cx="42" cy="46" r="4" fill="#C99B74"/></svg>';
const PUMPKIN = '<svg viewBox="0 0 50 46" aria-hidden="true"><path d="M25 8q2-6 6-6" stroke="#4F8E46" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="25" cy="27" rx="22" ry="17" fill="#FF9E3D" stroke="#C96A1C" stroke-width="2"/><path d="M25 10V44M13 13Q8 27 13 41M37 13Q42 27 37 41" stroke="#C96A1C" stroke-width="1.6" fill="none"/><path class="hm-jack" d="M15 22l4 4h-6zM35 22l-4 4h6zM16 33q9 6 18 0q-4 4-9 4t-9-4z" fill="#5A2E12"/></svg>';
const XTREE = '<svg viewBox="0 0 60 100" aria-hidden="true"><ellipse cx="30" cy="97" rx="22" ry="3.5" fill="rgba(60,30,20,.2)"/><rect x="25" y="80" width="10" height="16" fill="#9A6F4A"/><path d="M30 10L52 46H8Z" fill="#3E8E4A" stroke="#2E6E38" stroke-width="2"/><path d="M30 28L56 66H4Z" fill="#4FA35B" stroke="#2E6E38" stroke-width="2"/><path d="M30 46L58 84H2Z" fill="#5DB565" stroke="#2E6E38" stroke-width="2"/><path d="M30 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="#FFD75E" stroke="#E8A32E" stroke-width="1.2"/><circle class="hm-bx" cx="22" cy="40" r="2.6" fill="#E5402E"/><circle class="hm-bx" cx="38" cy="56" r="2.6" fill="#7FB2EC"/><circle class="hm-bx" cx="20" cy="70" r="2.6" fill="#FFD75E"/><circle class="hm-bx" cx="42" cy="76" r="2.6" fill="#FF8FB3"/><circle class="hm-bx" cx="30" cy="62" r="2.6" fill="#B48CFF"/></svg>';
const SNOWMAN = '<svg viewBox="0 0 50 70" aria-hidden="true"><ellipse cx="25" cy="67" rx="16" ry="3" fill="rgba(60,30,20,.18)"/><circle cx="25" cy="50" r="16" fill="#FFFFFF" stroke="#C9D6E6" stroke-width="2"/><circle cx="25" cy="24" r="11" fill="#FFFFFF" stroke="#C9D6E6" stroke-width="2"/><rect x="16" y="6" width="18" height="10" rx="2" fill="#3A2F4F"/><rect x="12" y="15" width="26" height="3" rx="1.5" fill="#3A2F4F"/><circle cx="21" cy="22" r="1.6" fill="#3A2F4F"/><circle cx="29" cy="22" r="1.6" fill="#3A2F4F"/><path d="M25 26l8 2-8 1.5z" fill="#FF8A3C"/><path d="M14 34q11 5 22 0" stroke="#E5402E" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';
const LION = '<svg viewBox="0 0 50 50" aria-hidden="true"><ellipse cx="25" cy="48" rx="19" ry="2.5" fill="rgba(60,30,20,.2)"/><rect x="8" y="36" width="34" height="11" rx="3" fill="#C9874A" stroke="#9A6F4A" stroke-width="2"/><circle cx="25" cy="21" r="17" fill="#E5402E" stroke="#B5281C" stroke-width="2"/><circle cx="25" cy="23" r="11" fill="#FFD75E" stroke="#E8A32E" stroke-width="2"/><circle cx="21" cy="20" r="2" fill="#3A2F4F"/><circle cx="29" cy="20" r="2" fill="#3A2F4F"/><path d="M20 27q5 4 10 0" stroke="#B5281C" stroke-width="2" fill="none"/><path d="M25 4v-3" stroke="#FFD75E" stroke-width="3" stroke-linecap="round"/></svg>';
const MAIL = '<svg viewBox="0 0 40 60" aria-hidden="true"><ellipse cx="20" cy="58" rx="9" ry="2" fill="rgba(60,30,20,.2)"/><rect x="18" y="26" width="4" height="32" fill="#9A6F4A"/><rect x="5" y="10" width="30" height="20" rx="8" fill="#E5402E" stroke="#B5281C" stroke-width="2"/><path d="M20 15c-2-3-6-1-5 2 1 2 5 4 5 4s4-2 5-4c1-3-3-5-5-2z" fill="#FFFFFF"/></svg>';
const POSTLAMP = '<svg viewBox="0 0 30 90" aria-hidden="true"><ellipse cx="15" cy="88" rx="10" ry="2.5" fill="rgba(60,30,20,.2)"/><rect x="13" y="22" width="4" height="66" fill="#5A5568"/><path class="hm-bulbglass" d="M6 10h18l-3 14H9z" fill="#FFE9A8" stroke="#B98A5E" stroke-width="2"/><rect x="5" y="6" width="20" height="5" rx="2" fill="#5A5568"/></svg>';
const BAT = '<svg viewBox="0 0 60 30" aria-hidden="true"><path d="M30 12c-4-6-10-8-16-6 3 2 4 5 3 8-4-2-9-1-12 2 5 0 9 3 10 7 3-4 8-5 15-4 7-1 12 0 15 4 1-4 5-7 10-7-3-3-8-4-12-2-1-3 0-6 3-8-6-2-12 0-16 6z" fill="#5B4A7A"/><circle cx="27" cy="13" r="1" fill="#FFD75E"/><circle cx="33" cy="13" r="1" fill="#FFD75E"/></svg>';
const BALLOON = (c, e) => `<svg viewBox="0 0 30 70" aria-hidden="true"><path d="M15 34Q10 50 16 68" stroke="#B98A5E" stroke-width="1.5" fill="none"/><path d="M15 32C5 24 2 16 6 9c3-5 9-5 9 0 0-5 6-5 9 0 4 7 1 15-9 23z" fill="${c}" stroke="${e}" stroke-width="2"/></svg>`;

/* ── seeds: what grows in the pots ──
   `unlock` = flowers picked before it can be planted; `fest` = only while that festival is on.
   Once planted a seed keeps growing whatever the date. */
const SEEDS = {
  daisy:     { n: '小雏菊', e: '🌼', col: '#FF8FB3', shape: 'daisy', unlock: 0 },
  sunflower: { n: '向日葵', e: '🌻', col: '#FFC24D', shape: 'sun', unlock: 0 },
  tulip:     { n: '郁金香', e: '🌷', col: '#FF6B7A', shape: 'cup', unlock: 3 },
  hydrangea: { n: '绣球花', e: '💠', col: '#8FB8FF', shape: 'cluster', unlock: 6 },
  lavender:  { n: '薰衣草', e: '🪻', col: '#A98BEA', shape: 'spike', unlock: 10 },
  moon:      { n: '月光花', e: '🌙', col: '#BFE6FF', shape: 'star5', unlock: 15, glow: 'moon', tip: '长出叶子以后，晚上会发蓝光' },
  peach:     { n: '桃花', e: '🌸', col: '#FFB3CB', shape: 'star5', fest: 'cny' },
  rose:      { n: '玫瑰', e: '🌹', col: '#FF4F70', shape: 'rose', fest: 'vday' },
  osman:     { n: '桂花', e: '🌼', col: '#FFC24D', shape: 'cluster', fest: 'midautumn' },
  pumpkin:   { n: '南瓜', e: '🎃', col: '#FF9E3D', shape: 'pumpkin', fest: 'halloween', tip: '最后会结出一个南瓜' },
  poin:      { n: '圣诞红', e: '🌺', col: '#E8483F', shape: 'poin', fest: 'xmas' },
  eternal:   { n: '永生花', e: '💐', col: '#FFD75E', shape: 'star5', fest: 'anniv', glow: 'gold', tip: '开金色的花，晚上发光' },
};
const SEED_ORDER = Object.keys(SEEDS);

/* ── festivals: the date dresses the house for free; the shop sells things that come out every year ── */
const FESTS = {
  cny:       { n: '春节', e: '🧧', say: '家门贴上了福字' },
  vday:      { n: '情人节', e: '💝', say: '天上飘着小爱心' },
  midautumn: { n: '中秋', e: '🥮', say: '晚上的月亮又大又圆' },
  halloween: { n: '万圣节', e: '🎃', say: '天黑以后有小蝙蝠飞过' },
  xmas:      { n: '圣诞', e: '🎄', say: '屋顶和花园下雪了' },
  anniv:     { n: '周年', e: '💞', say: '门口挂上了周年横幅' },
};
// Bought with 小窝币 through the 小窝's own purchase (decor-buy), so the wallet is one ledger.
// A festival piece is on sale from a week before its festival until a few days after, and once
// bought it comes out by itself every year at that festival.
const HOUSE = {
  hm_lv2:     { n: '升级成小平房', e: '🏠', price: 600, lv: 2, tip: '多一间卧室，花园 3 个花盆，宠物小屋' },
  hm_lv3:     { n: '升级成两层小楼', e: '🏡', price: 1500, lv: 3, needs: 'hm_lv2', tip: '厨房、楼梯、二楼卧室，阳台多 2 个花盆，池塘' },
  hm_lamp:    { n: '花园小路灯', e: '💡', price: 50, tip: '一直都在，晚上会亮' },
  hm_lantern: { n: '红灯笼一对', e: '🏮', price: 60, fest: 'cny', tip: '挂在屋檐，晚上会亮' },
  hm_couplet: { n: '春联', e: '🧧', price: 40, fest: 'cny', tip: '贴在门两边' },
  hm_lion:    { n: '舞狮摆件', e: '🦁', price: 90, fest: 'cny' },
  hm_arch:    { n: '爱心门框', e: '💗', price: 70, fest: 'vday', tip: '一圈爱心绕在门上' },
  hm_mailbox: { n: '情侣信箱', e: '💌', price: 80, fest: 'vday' },
  hm_rabbit:  { n: '兔子灯一对', e: '🐰', price: 60, fest: 'midautumn', tip: '晚上会亮' },
  hm_pumpkin: { n: '南瓜灯一对', e: '🎃', price: 50, fest: 'halloween', tip: '晚上会亮' },
  hm_xtree:   { n: '圣诞树', e: '🎄', price: 120, fest: 'xmas', tip: '换掉花园的小树，晚上会闪' },
  hm_lights:  { n: '屋檐彩灯', e: '✨', price: 60, fest: 'xmas', tip: '晚上会亮' },
  hm_snowman: { n: '雪人', e: '⛄', price: 80, fest: 'xmas' },
};

/* ── the three houses. x is in % of the scene's WIDTH and may run past 100 (a bigger house is a wider world and the
   view follows you); y is in % of the scene's height. A room is a box seen from the front with its front wall taken
   away: `top` is the front edge of its ceiling, and it stands on its storey's floor `f`. Furniture is [kind, x, y of its
   feet, width]; pots are [x, y]. ── */
const LVS = {
  1: { name: '小木屋', world: 100, garden: 40,
       floors: [{ back: 76, front: 92 }],
       rooms: [{ id: 'living', n: '客厅', x0: 40, x1: 92, top: 46, f: 0 }],
       roof: [36, 96, 22, 46], chim: [80, 4, 9],
       things: [], pots: [[13, G0], [26, G0]], garden_things: [['tree', 6, 80, 9]] },
  2: { name: '小平房', world: 132, garden: 40,
       floors: [{ back: 76, front: 92 }],
       rooms: [{ id: 'living', n: '客厅', x0: 40, x1: 92, top: 46, f: 0 }, { id: 'bed', n: '卧室', x0: 92, x1: 128, top: 46, f: 0, win: [.5, 7, 8], clock: .84 }],
       roof: [36, 132, 20, 46], chim: [118, 4, 9],
       things: [['shelf', 101, 79.2, 10], ['bed', 113, 81, 15], ['bear', 121.2, 81.6, 4], ['lamp', 124, 80, 4], ['plant', 98.6, 89.4, 5]],
       pots: [[9, G0], [20, G0], [31, G0]], garden_things: [['tree', 4, 80, 7.5], ['pethouse', 35.4, 80.5, 6]] },
  3: { name: '两层小楼', world: 142, garden: 40,
       floors: [{ back: 78, front: 92 }, { back: 45.5, front: 56 }],
       rooms: [
         { id: 'living', n: '客厅', x0: 40, x1: 92, top: 59, f: 0 }, { id: 'hall', n: '楼梯', x0: 92, x1: 104, top: 59, f: 0 },
         { id: 'kitchen', n: '厨房', x0: 104, x1: 140, top: 59, f: 0, win: [.5, 6, 6] },
         { id: 'bed', n: '二楼卧室', x0: 40, x1: 92, top: 24, f: 1, win: [.36, 7, 7.5] }, { id: 'hall2', n: '楼梯', x0: 92, x1: 104, top: 24, f: 1, clock: .4 },
         { id: 'balcony', n: '阳台', x0: 104, x1: 140, top: 24, f: 1, open: true }],
       roof: [36, 144, 6, 24], chim: [128, 4, 8],
       things: [['stove', 112, 82, 9], ['table', 124, 86, 11], ['fridge', 133, 81, 10.5], ['shelf', 49.6, 48.2, 10], ['bed', 67, 49.5, 15], ['bear', 56.6, 49.6, 4], ['lamp', 87, 48.5, 4], ['bench', 133, 48.8, 8]],
       pots: [[8, G0], [16, G0], [24, G0], [32, G0], [111, G1], [121, G1]],
       garden_things: [['tree', 4, 80, 7.5], ['pethouse', 35.4, 80.5, 5.6]],
       stairs: { bx: 94.2, by: 86.5, tx: 101.6, ty: 50.5 }, pond: [3, 93.6, 24, 5], balcony: [104, 140] },
};

/* ── the shared save ──────────────────────────────────────────────────────────────────────────── */
// { v, pots: [null | { id, seed, at, w: { date: bits } }], picked, album: { seed: n }, log: [[date, who, seed]], pos: { char1: {x, f, at} } }
const blank = () => ({ v: 1, pots: [], picked: 0, album: {}, log: [], pos: {} });
const clone = (d) => JSON.parse(JSON.stringify(d));
function norm(d) {
  const b = blank();
  if (!d || typeof d !== 'object') return b;
  return { ...b, ...d, pots: Array.isArray(d.pots) ? d.pots.slice(0, 6) : [], album: d.album && typeof d.album === 'object' ? d.album : {},
    log: Array.isArray(d.log) ? d.log : [], pos: d.pos && typeof d.pos === 'object' ? d.pos : {}, picked: Number.isInteger(d.picked) && d.picked >= 0 ? d.picked : 0 };
}
// How far a planting has got, from its waterings alone — derived, so two phones can never disagree.
// One of you watering = one step, both of you the same day = two. A growing plant left WILT days droops;
// the watering that saves it doesn't make it grow.
function grow(p, today) {
  if (!p) return { stage: 0, wilted: false, last: null, days: 0 };
  const days = Object.keys(p.w || {}).filter(d => d <= today).sort();
  let stage = 0, last = null;
  for (const d of days) {
    if (stage >= 5) break;
    if (stage >= 1 && last && dayDiff(last, d) >= WILT) { last = d; continue; }
    stage = Math.min(5, stage + (p.w[d] === 3 ? 2 : 1));
    last = d;
  }
  const wilted = stage >= 1 && stage < 5 && !!last && dayDiff(last, today) >= WILT;
  return { stage, wilted, last, days: days.length };
}
// Every change to the garden is one of these. apply() returns the new save, or null when the action no
// longer makes sense on this save (the flower was already picked, the pot was already planted…) — which
// is also what makes replaying an action after a refused write safe.
function apply(data, op) {
  const d = clone(norm(data));
  const p = d.pots[op.pot];
  if (op.t === 'plant') {
    if (p || !SEEDS[op.seed] || !(op.pot >= 0 && op.pot < 6)) return null;
    while (d.pots.length <= op.pot) d.pots.push(null);
    d.pots[op.pot] = { id: op.id, seed: op.seed, at: op.date, by: op.who, w: {} };
    return d;
  }
  if (op.t === 'water') {
    if (!p || p.id !== op.id) return null;
    const g = grow(p, op.date), bit = BIT[op.who];
    if (!bit || g.stage >= 5 || ((p.w[op.date] || 0) & bit)) return null;
    p.w[op.date] = (p.w[op.date] || 0) | bit;
    return d;
  }
  if (op.t === 'pick') {
    if (!p || p.id !== op.id || grow(p, op.date).stage < 5) return null;
    d.pots[op.pot] = null;
    d.picked += 1;
    d.album[p.seed] = (d.album[p.seed] || 0) + 1;
    d.log = d.log.concat([[op.date, op.who, p.seed, p.id]]).slice(-30);
    return d;
  }
  if (op.t === 'pos') {
    if (!BIT[op.who]) return null;
    d.pos[op.who] = { x: Math.round(op.x * 10) / 10, ...(typeof op.y === 'number' && isFinite(op.y) ? { y: Math.round(op.y * 10) / 10 } : {}), f: op.f ? 1 : 0, at: op.at };
    return d;
  }
  return null;
}
const fold = (data, ops) => ops.reduce((acc, op) => apply(acc, op) || acc, norm(data));
// Is this action of ours already in the save? (A write can land with its answer lost on the way back;
// the retry is then refused, and the save it hands back already holds what we did.)
function landed(data, op) {
  const d = norm(data), p = d.pots[op.pot];
  if (op.t === 'plant') return !!p && p.id === op.id;
  if (op.t === 'water') return !!p && p.id === op.id && !!((p.w || {})[op.date] & BIT[op.who]);
  if (op.t === 'pick') return d.log.some(e => e[3] === op.id && e[1] === op.who);
  return false;
}
// who got there first, from the save
function firstBy(data, op) {
  const d = norm(data), p = d.pots[op.pot];
  if (op.t === 'pick') { const e = d.log.slice().reverse().find(e => e[3] === op.id); return e ? e[1] : ''; }
  if (op.t === 'plant') return p ? (p.by || '') : '';
  return '';
}

/* ── state ─────────────────────────────────────────────────────────────────────────────────────── */
let API = null;
const G = {
  open: false, lv: 1, me: 'cs', W: 0, H: 0, camX: 0, camT: 0, raf: 0, last: 0, hold: 0, lead: 'me',
  srv: { data: blank(), rev: 0, loaded: false }, pending: [], remote: [], view: blank(), busy: false, failAt: 0,
  partner: { at: 0, on: false, x: 0, f: 0, v: HOME_V, away: false }, today: '', fest: null, fests: new Set(), festKey: '', season: '', night: false, dusk: false,
  timers: [], lastStatus: '', lastPots: '', tab: 'garden', sheet: null, dayTick: 0,
};
const UI = {};
const P = {};       // the two people, keyed cs / yy
let pet = null;
const meK = () => G.me, peerK = () => OTHER[G.me];
const nameOf = (k) => (API && API.names && API.names[k]) || (k === 'cs' ? 'CS' : 'YY');

/* ── dates and festivals ─────────────────────────────────────────────────────────────────────── */
// Every theme the app has on a date, not only the one that wins it: on 12-24 the 周年 wins the sky, but
// it is still 圣诞 in the garden. [{ id, name }], cached per day.
const dayCache = new Map(), festCache = new Map();
function themesAt(d) {
  if (dayCache.has(d)) return dayCache.get(d);
  let r = [];
  try { r = (API.themesAt(d) || []).filter(t => t && FESTS[t.id]); } catch (e) {}
  dayCache.set(d, r);
  return r;
}
const festOn = (id, d) => themesAt(d).some(t => t.id === id);
// a festival's window: from a week before it until a few days after (a week after the anniversary)
function festWin(id, today) {
  const k = id + today;
  if (festCache.has(k)) return festCache.get(k);
  const grace = id === 'anniv' ? 7 : 2;
  let on = false;
  for (let i = -grace; i <= 7 && !on; i++) on = festOn(id, addDays(today, i));
  let left = 0;
  if (on) {
    let end = -grace;
    for (let i = -grace; i <= 40; i++) if (festOn(id, addDays(today, i))) end = i;
    left = Math.max(1, end + grace + 1);
  }
  const r = { on, left };
  festCache.set(k, r);
  return r;
}
// the festival that colours the sky: the app's own winner when it is one of ours
function topFest(d, all) { let top = null; try { top = API.themeAt(d); } catch (e) {} return top && all.some(x => x.id === top.id) ? top.id : all[0].id; }
function seasonOf(today) { const m = +today.slice(5, 7); return m >= 3 && m <= 5 ? 'spring' : m <= 8 && m >= 6 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; }
function seedState(key, today) {
  const s = SEEDS[key], picked = G.view.picked || 0;
  if (s.fest) { const w = festWin(s.fest, today); return w.on ? { ok: true, left: w.left } : { ok: false, why: `${FESTS[s.fest].n}的时候才能种` }; }
  return picked >= s.unlock ? { ok: true } : { ok: false, why: `收满 ${s.unlock} 朵花解锁（还差 ${s.unlock - picked}）` };
}

/* ── drawing pots and flowers ────────────────────────────────────────────────────────────────── */
function bloom(shape, col, top) {
  const cx = 50, cy = top - 3;
  let p = '';
  const ring = (n, r, rx, ry, fill) => { for (let k = 0; k < n; k++) { const a = k * Math.PI * 2 / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; p += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="${ry}" transform="rotate(${(a * 57.3 + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}"/>`; } };
  if (shape === 'daisy') { ring(11, 8, 2.6, 6.5, col); p += `<circle cx="${cx}" cy="${cy}" r="4.6" fill="#FFD34E" stroke="#E8A32E" stroke-width="1.2"/>`; }
  else if (shape === 'sun') { ring(13, 10, 3, 7, col); p += `<circle cx="${cx}" cy="${cy}" r="7" fill="#8A5A2B" stroke="#5E3B19" stroke-width="1.4"/><circle cx="48" cy="${cy - 2}" r="1.4" fill="#C9965A"/>`; }
  else if (shape === 'cup') p += `<path d="M40 ${cy + 4}Q38 ${cy - 8} 43 ${cy - 11}L46.5 ${cy - 4}L50 ${cy - 12}L53.5 ${cy - 4}L57 ${cy - 11}Q62 ${cy - 8} 60 ${cy + 4}Q50 ${cy + 11} 40 ${cy + 4}Z" fill="${col}" stroke="rgba(0,0,0,.22)" stroke-width="1.6" stroke-linejoin="round"/><path d="M45 ${cy}q2 -5 0 -8" stroke="#fff" stroke-width="1.6" opacity=".55" fill="none" stroke-linecap="round"/>`;
  else if (shape === 'cluster') { const pts = [[0, 0], [-6, -2], [6, -2], [-3, -7], [3, -7], [-5, 4], [5, 4], [0, 6], [0, -11]]; for (const [dx, dy] of pts) p += `<circle cx="${cx + dx}" cy="${cy + dy}" r="4.2" fill="${col}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`; p += `<circle cx="${cx - 2}" cy="${cy - 3}" r="1.5" fill="#fff" opacity=".6"/>`; }
  else if (shape === 'spike') { for (let k = 0; k < 6; k++) p += `<ellipse cx="${cx + (k % 2 ? 2.2 : -2.2)}" cy="${cy + 6 - k * 4.2}" rx="${3.4 - k * .3}" ry="2.6" fill="${col}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`; }
  else if (shape === 'star5') { for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; p += `<circle cx="${(cx + Math.cos(a) * 6.6).toFixed(1)}" cy="${(cy + Math.sin(a) * 6.6).toFixed(1)}" r="5.6" fill="${col}" stroke="rgba(0,0,0,.16)" stroke-width="1"/>`; } p += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="#FFF3B0" stroke="#E8B04B" stroke-width="1"/>`; }
  else if (shape === 'rose') p += `<circle cx="${cx}" cy="${cy}" r="9" fill="${col}" stroke="#B5283F" stroke-width="1.6"/><path d="M${cx - 5} ${cy + 1}q5 -9 10 0q-5 5 -10 0zM${cx - 2.5} ${cy - 1}q2.5 -4 5 0" fill="none" stroke="#B5283F" stroke-width="1.5" stroke-linecap="round"/>`;
  else if (shape === 'poin') { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const x1 = cx + Math.cos(a) * 11, y1 = cy + Math.sin(a) * 11, x2 = cx + Math.cos(a + .45) * 4, y2 = cy + Math.sin(a + .45) * 4, x3 = cx + Math.cos(a - .45) * 4, y3 = cy + Math.sin(a - .45) * 4; p += `<path d="M${x2.toFixed(1)} ${y2.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}Z" fill="${col}" stroke="#A72A22" stroke-width="1.2" stroke-linejoin="round"/>`; } p += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#FFD34E"/><circle cx="${cx + 3}" cy="${cy + 1}" r="1.4" fill="#7FBF5A"/>`; }
  else if (shape === 'pumpkin') p += `<path d="M50 ${top - 3}q3 -6 8 -6" stroke="#4F8E46" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="${top + 8}" rx="16" ry="12" fill="#FF9E3D" stroke="#C96A1C" stroke-width="2.5"/><path d="M50 ${top - 3}V${top + 19}M41 ${top - 1}Q36 ${top + 8} 41 ${top + 18}M59 ${top - 1}Q64 ${top + 8} 59 ${top + 18}" stroke="#C96A1C" stroke-width="1.6" fill="none"/>`;
  return p;
}
function potSvg(pl, g, inPot = true) {
  const s = pl ? SEEDS[pl.seed] || SEEDS.daisy : null;
  const stage = pl ? g.stage : -1, stem = [0, 14, 24, 34, 42, 46][Math.max(0, stage)], top = 62 - stem;
  let p = '';
  if (stage === 0) p += '<ellipse cx="50" cy="60" rx="7" ry="3.4" fill="#5E3A26"/><path d="M47 58q3 -3 6 0" stroke="#8A5A3B" stroke-width="1.6" fill="none"/>';
  else if (stage > 0) {
    const big = s.shape === 'sun' && stage >= 3 ? 1.12 : 1;
    p += `<g class="hm-plant"${big !== 1 ? ` transform="translate(50 62) scale(1 ${big}) translate(-50 -62)"` : ''}><path d="M50 62V${top}" stroke="#3E8E4A" stroke-width="4" stroke-linecap="round"/>`;
    if (stage === 1) p += `<path d="M50 ${top}q-9 -8 -14 -2q6 5 14 2zM50 ${top}q9 -8 14 -2q-6 5 -14 2z" fill="#5DB565"/>`;
    if (stage >= 2) p += `<path d="M50 ${62 - stem * .42}q-14 -10 -20 -2q8 6 20 2z" fill="#5DB565"/><path d="M50 ${62 - stem * .55}q14 -10 20 -2q-8 6 -20 2z" fill="#5DB565"/>`;
    if (stage >= 3) p += `<path d="M50 ${62 - stem * .78}q-10 -8 -15 -2q6 5 15 2z" fill="#6CC274"/>`;
    if (stage === 4) p += `<path d="M50 ${top + 3}q-8 -10 0 -18q8 8 0 18z" fill="${s.col}" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/>`;
    if (stage === 5) p += bloom(s.shape, s.col, top);
    p += '</g>';
  }
  const potArt = inPot ? `<path d="M28 62H72L65 94H35Z" fill="#E58A5C" stroke="#B9653C" stroke-width="3" stroke-linejoin="round"/><rect x="25" y="57" width="50" height="9" rx="4" fill="#F2A275" stroke="#B9653C" stroke-width="3"/>` : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${inPot ? '<ellipse cx="50" cy="96" rx="26" ry="4" fill="rgba(40,30,20,.2)"/><ellipse class="hm-soil" cx="50" cy="60" rx="21" ry="4" fill="#7A4E35"/>' : ''}${p}${potArt}</svg>`;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const glowOf = (s) => (s.glow === 'moon' ? 'rgba(140,210,255,.95)' : s.glow === 'gold' ? 'rgba(255,215,94,.95)' : rgba(s.col, .85));

/* ── one pot, as this phone sees it ── */
function potInfo(i) {
  const pl = G.view.pots[i] || null, g = grow(pl, G.today), myBit = BIT[CHAR[meK()]], peerBit = BIT[CHAR[peerK()]];
  const bits = pl ? (pl.w[G.today] || 0) : 0;
  return { pl, g, seed: pl ? SEEDS[pl.seed] || SEEDS.daisy : null, mine: !!(bits & myBit), theirs: !!(bits & peerBit),
    empty: !pl, bloom: !!pl && g.stage >= 5, thirsty: !!pl && g.stage < 5 && !(bits & myBit) };
}
function potHtml(i) {
  const L = LVS[G.lv], [x, y] = L.pots[i], q = potInfo(i), sc = depthS(y, floorOfY(y));
  const cls = ['hm-pot'];
  if (q.empty) cls.push('hm-empty');
  if (q.thirsty) cls.push('hm-thirsty');
  if (q.bloom) cls.push('hm-bloom');
  if (q.pl && q.g.stage >= 2) cls.push('hm-grown');
  if (q.seed && q.seed.glow === 'moon') cls.push('hm-glow-moon');
  if (q.pl && q.mine) cls.push('hm-wet');
  if (q.g.wilted) cls.push('hm-wilt');
  const what = q.empty ? '空花盆，点一下种花' : q.bloom ? `${q.seed.n}开花了，点一下收进图鉴` : `${q.seed.n}，${q.g.wilted ? '蔫了，快浇水' : q.mine ? '今天浇过了' : '点一下浇水'}`;
  return `<div class="${cls.join(' ')}" data-i="${i}" style="left:${x}%;top:${y}%;--s:${sc.toFixed(3)};z-index:${Math.round(y * 10)}${q.seed ? `;--hm-glow:${glowOf(q.seed)}` : ''}" role="button" tabindex="0" aria-label="${i + 1} 号花盆：${what}">${potSvg(q.pl, q.g)}${q.theirs && !q.bloom ? `<span class="hm-pmark" style="background:${peerK() === 'cs' ? '#7FB2EC' : '#FF9CC4'}" aria-hidden="true"></span>` : ''}</div>`;
}

/* ── the scene ───────────────────────────────────────────────────────────────────────────────── */
const box = (cls, x, y, w, h, inner = '', style = '') => `<div class="hm-abs ${cls}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%;${style}">${inner}</div>`;
const thingAt = (svg, x, y, w, cls = '') => `<div class="hm-abs hm-thing ${cls}" style="left:${x}%;top:${y}%;width:${w}%">${svg}</div>`;
const owns = (id) => { try { return !!API.owns(id); } catch (e) { return false; } };
const showFest = (id) => !!FESTS[id] && festWin(id, G.today).on;
/* ── the house in 3D (2026-11-26: 「make it can move up and down also and make it more 3D and more real」) ──
   Every room is a box seen from the front with its front wall taken away: a back wall, a floor running back in
   perspective, the two side walls and the ceiling closing in toward the back, shadow where they meet, light where
   the window is. Walls between rooms are wall at the back and a doorway at the front, so you go round by the door.
   It is all one drawing (one <svg> in the scene's own units: x is % of the width, y % of the height), redrawn only
   when the house, the season or the time of day changes; what stands on a floor (furniture, pots, the two of you,
   the pet) goes in front of it and is ordered by how far forward it stands. */
const DC = 2.4;                                    // how far a ceiling reaches in
const dxOf = (r) => Math.min(4.2, (r.x1 - r.x0) * .12);   // how far a room's side walls reach in
const floorsOf = () => LVS[G.lv].floors;
// where feet can be on a floor: a little off the back wall, up to its front edge
const band = (fi) => { const F = floorsOf()[fi] || floorsOf()[0]; return [F.back + 2.2, F.front - .6]; };
// the back part of a floor is wall between rooms; this far forward there is a doorway
const DOOR_U = .42, DOOR_V = .7;
const passY = (fi) => { const F = floorsOf()[fi] || floorsOf()[0]; return F.front - DOOR_U * (F.front - F.back) + .4; };
// 0 at the back of a floor, 1 at its front: further back is drawn smaller
const depthT = (y, fi) => { const [b, f] = band(fi < 0 ? 0 : fi); return clamp((y - b) / (f - b), 0, 1); };
const depthS = (y, fi) => .8 + .2 * depthT(y, fi);
const floorOfY = (y) => (floorsOf().length > 1 && y < floorsOf()[1].front + 2.5 ? 1 : 0);
// the walls across a floor that have a doorway: between rooms, and the front door onto the garden
function walls(fi) {
  const L = LVS[G.lv], rs = L.rooms.filter(r => r.f === fi), xs = [];
  rs.forEach((r, k) => { if (k > 0 || (fi === 0 && L.garden)) xs.push(r.x0); });
  return xs.sort((a, b) => a - b);
}
// how far along a floor you can go
function xRange(fi) {
  const L = LVS[G.lv];
  if (fi === 1) return [42, (L.balcony ? L.balcony[1] : 92) - 2];
  return [3, L.rooms.filter(r => r.f === 0).reduce((m, r) => Math.max(m, r.x1), 0) - 2];
}
function clampPos(x, y, fi) { const [x0, x1] = xRange(fi < 0 ? 0 : fi), [b, f] = band(fi < 0 ? 0 : fi); return [clamp(x, x0, x1), clamp(y, b, f)]; }
// a step from (x0, y0) to (x1, y1): a wall is solid from the back of the floor to its doorway. You stop against it
// (not jitter at it), and in the doorway you can go out toward the front but not back into the wall beside it.
const WALL_W = .45;
function wallStop(fi, x0, x1, y0, y1) {
  if (fi < 0) return [x1, y1];
  const py = passY(fi);
  for (const b of walls(fi)) {
    if (y1 >= py) continue;
    const inNow = Math.abs(x0 - b) < WALL_W, inNext = Math.abs(x1 - b) < WALL_W;
    if (inNow && inNext) y1 = Math.max(y1, Math.min(y0, py));                       // in the doorway, stepping back
    else if (!inNow && (inNext || (x0 - b) * (x1 - b) < 0)) x1 = x0 < b ? b - WALL_W : b + WALL_W;   // walking into it
  }
  return [x1, y1];
}
// a walk on one floor: straight there, or forward to the doorways, along, and back
function within(fi, x0, y0, x1, y1) {
  const py = passY(fi) + .3;
  if (!walls(fi).some(b => (x0 - b) * (x1 - b) < 0) || (y0 >= py - .3 && y1 >= py - .3)) return [{ x: x1, y: y1, fi }];
  const pts = [];
  if (y0 < py) pts.push({ x: x0, y: py, fi });
  pts.push({ x: x1, y: Math.max(y1, py), fi });
  if (y1 < py) pts.push({ x: x1, y: y1, fi });
  return pts;
}
/* ── walking round the furniture (2026-11-26: 「make the entire design make it more real」) ──
   Everything that stands on a floor has a footprint on it (the sofa, the beds, the table, the stove, the pots, the
   tree's trunk, the 小窝's own pieces): the stick and the keys slide you along it instead of through it, and a walk
   finds its way round it (A* on a grid of the floor, then straightened), by the doorways as before. A walk that ENDS in
   one — a seat on the sofa, a spot beside the bed — goes to the nearest free square and then steps in. */
const BODY_X = 1.2, BODY_Y = .5;   // half a person across, and into the room
// footprint of something standing at (x, y) — its feet at its front, `depth` behind them — on floor fi
function addObst(x, y, halfW, depth, fi, what) { G.obst.push({ x0: x - halfW - BODY_X, x1: x + halfW + BODY_X, y0: y - depth - BODY_Y, y1: y + .25 + BODY_Y, fi, what }); }
const blocked = (x, y, fi) => { for (const o of G.obst || []) if (o.fi === fi && x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return true; return false; };
const wallAt = (fi, x, y) => fi >= 0 && y < passY(fi) && walls(fi).some(b => Math.abs(x - b) < WALL_W);
// can you walk straight from one point to the other? (an end that is itself inside something doesn't count against it)
function clearLine(fi, x0, y0, x1, y1) {
  if (fi < 0) return true;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, (y1 - y0) * 1.6) / .3)), s0 = blocked(x0, y0, fi), s1 = blocked(x1, y1, fi);
  for (let k = 1; k < n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if ((s0 && t * n < 4) || (s1 && (1 - t) * n < 4)) continue;
    if (blocked(x, y, fi) || wallAt(fi, x, y)) return false;
  }
  return true;
}
// A* over the floor: squares of 1 across and 0.7 into the room, eight ways, a step into the room costing more
function astar(fi, sx, sy, gx, gy) {
  const [X0, X1] = xRange(fi), [B, F] = band(fi), DX = 1, DY = .7;
  const W = Math.floor((X1 - X0) / DX) + 1, H = Math.floor((F - B) / DY) + 1, N = W * H;
  const px = (i) => X0 + i * DX, py = (j) => B + j * DY;
  const idx = (x, y) => clamp(Math.round((y - B) / DY), 0, H - 1) * W + clamp(Math.round((x - X0) / DX), 0, W - 1);
  const free = new Uint8Array(N);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) free[j * W + i] = blocked(px(i), py(j), fi) || wallAt(fi, px(i), py(j)) ? 0 : 1;
  let s = idx(sx, sy), g = idx(gx, gy);
  free[s] = 1;
  if (!free[g]) {   // the nearest free square to where you are going
    let best = -1, bd = Infinity;
    for (let k = 0; k < N; k++) if (free[k]) { const d = Math.hypot(px(k % W) - gx, (py((k / W) | 0) - gy) * 1.6); if (d < bd) { bd = d; best = k; } }
    if (best < 0) return null;
    g = best;
  }
  const cost = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
  const hx = (k) => Math.hypot(px(k % W) - px(g % W), (py((k / W) | 0) - py((g / W) | 0)) * 1.6);
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
  cost[s] = 0; push(s, hx(s));
  while (heap.length) {
    const k = pop();
    if (k === g) break;
    if (shut[k]) continue;
    shut[k] = 1;
    const i = k % W, j = (k / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni; if (!free[n] || shut[n]) continue;
      if (di && dj && (!free[j * W + ni] || !free[nj * W + i])) continue;   // no squeezing between two corners
      const c = cost[k] + Math.hypot(di * DX, dj * DY * 1.6);
      if (c < cost[n]) { cost[n] = c; from[n] = k; push(n, c + hx(n)); }
    }
  }
  if (!isFinite(cost[g])) return null;
  const cells = []; for (let k = g; k !== -1 && k !== s; k = from[k]) cells.push([px(k % W), py((k / W) | 0)]);
  cells.reverse();
  // straightened: keep only the corners you can't see past
  const out = []; let ax = sx, ay = sy;
  for (let k = 0; k < cells.length; k++) {
    const nxt = cells[k + 1];
    if (!nxt || !clearLine(fi, ax, ay, nxt[0], nxt[1])) { out.push(cells[k]); [ax, ay] = cells[k]; }
  }
  return out;
}
// a walk's points, with a way found round anything in the way between each two on the same floor
function roundAbout(a, pts) {
  const out = []; let x = a.x, y = a.y, f = a.fi;
  for (const q of pts) {
    if (q.fi === f && f >= 0 && !clearLine(f, x, y, q.x, q.y)) {
      const mid = astar(f, x, y, q.x, q.y);
      // a grid square on top of where you are or where you are going is no corner: leave it out
      if (mid) for (const m of mid) if (Math.hypot(m[0] - x, m[1] - y) > .45 && Math.hypot(m[0] - q.x, m[1] - q.y) > .45) { out.push({ x: m[0], y: m[1], fi: f }); x = m[0]; y = m[1]; }
    }
    out.push(q); x = q.x; y = q.y; f = q.fi;
  }
  return out;
}
// a walk to (x, y) on floor fi, from wherever a is: up or down the stairs when it is the other floor
function route(a, x, y, fi) {
  const pts = roundAbout(a, route0(a, x, y, fi)), out = [];
  // then pulled straight: a corner you can see past from the last one kept (same floor, no furniture and no back part of
  // a wall in between) is left out, so a doorway's waypoint and a way round a table don't make a zigzag together
  let px = a.x, py = a.y, pf = a.fi;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i], n = pts[i + 1];
    if (n && pf >= 0 && q.fi === pf && n.fi === pf && clearLine(pf, px, py, n.x, n.y)) continue;
    out.push(q); px = q.x; py = q.y; pf = q.fi;
  }
  return out;
}
function route0(a, x, y, fi) {
  const L = LVS[G.lv], s = L.stairs;
  if (!s) fi = 0;
  [x, y] = clampPos(x, y, fi);
  const af = a.fi == null ? 0 : a.fi;
  if (!s || af === fi) return within(fi, a.x, a.y, x, y);
  if (af === -1) return fi === 1 ? [{ x: s.tx, y: s.ty, fi: 1 }, ...within(1, s.tx, s.ty, x, y)] : [{ x: s.bx, y: s.by, fi: 0 }, ...within(0, s.bx, s.by, x, y)];
  return af === 0
    ? [...within(0, a.x, a.y, s.bx, s.by), { x: s.tx, y: s.ty, fi: 1 }, ...within(1, s.tx, s.ty, x, y)]
    : [...within(1, a.x, a.y, s.tx, s.ty), { x: s.bx, y: s.by, fi: 0 }, ...within(0, s.bx, s.by, x, y)];
}
// a point on a room's side wall (side -1 left, 1 right): u from its front edge (0) to the back (1), v from the floor (0) to the ceiling (1)
function wallPt(r, side, u, v) {
  const F = LVS[G.lv].floors[r.f], dx = dxOf(r);
  const x = side < 0 ? r.x0 + dx * u : r.x1 - dx * u;
  const yF = F.front + (F.back - F.front) * u, yC = r.top + DC * u;
  return [x, yF + (yC - yF) * v];
}
const hexRgb = (h) => { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// a colour a little darker (k < 0) or lighter (k > 0); anything that is not #rrggbb is left alone
function tone(c, k) {
  if (!/^#[0-9a-f]{6}$/i.test(String(c))) return c;
  const [r, g, b] = hexRgb(c), f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + [f(r), f(g), f(b)].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
// how each room looks; the 客厅 takes the 小窝's own wallpaper and floor
const LOOK = {
  living: { wall: ['#FBE7D3', '#F3D5B8'], floor: '#D3A67C' },
  bed: { wall: ['#EFE8FC', '#DDD2F5'], floor: '#E2C29E', rug: '#F6C6D8' },
  kitchen: { wall: ['#E9F5EB', '#D5EBDA'], floor: '#EFEBE3', tiles: true },
  hall: { wall: ['#F7EADB', '#ECD8C0'], floor: '#CFA176' },
  hall2: { wall: ['#F7EADB', '#ECD8C0'], floor: '#CFA176' },
};
function lookOf(r, room) {
  const base = LOOK[r.id] || LOOK.hall;
  if (r.id !== 'living' || !room || !room.paper) return base;
  const w = room.paper.wall, f = room.paper.floorTone;
  return { wall: Array.isArray(w) && w.length >= 2 ? [w[0], w[1]] : base.wall, floor: f || base.floor, mat: room.mat };
}
function houseSvg(L, room) {
  const W = L.world, F0 = L.floors[0], N = G.night, D = G.dusk, defs = [], g = [];
  const P2 = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  const poly = (pts, attr) => `<polygon points="${pts.map(P2).join(' ')}" ${attr}/>`;
  // Lines, stripes, boards and pickets of one look go in as ONE path: the first version drew them one element each
  // (512 in the two-storey house), and styling that many cost a slow phone ~10 ms more every time the house opened.
  const acc = new Map();
  const add = (look, d) => acc.set(look, (acc.get(look) || '') + d);
  const flush = () => { for (const [look, d] of acc) g.push(`<path d="${d}" ${look}/>`); acc.clear(); };
  const shape = (pts) => 'M' + pts.map(P2).join('L') + 'Z';
  const seg = (a, b) => `M${P2(a)}L${P2(b)}`;
  const box = (x, y, w, h) => shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  const stroke = (c, w = 1, op = 1) => `fill="none" stroke="${c}" stroke-width="${w}"${op < 1 ? ` stroke-opacity="${op}"` : ''} vector-effect="non-scaling-stroke"`;
  const grad = (id, stops, v = true) => defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  const rgrad = (id, stops, cx = .5, cy = .5, r = .6) => defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`);
  const night = (k) => (N ? k : 0);
  // ── the lawn, the whole way across, its mown stripes running back toward the house
  const xmas = G.fests && G.fests.has('xmas'), S = G.season;
  const lawn = xmas ? ['#EEF3F9', '#FFFFFF'] : S === 'winter' ? ['#CFE0CB', '#E2EEDD'] : S === 'autumn' ? ['#A9BE6F', '#BBCB7E'] : ['#84BE77', '#9CD08B'];
  const lb = F0.back - 3;
  grad('hm3lawn', [[0, tone(lawn[0], night(-.55) || (D ? -.08 : 0))], [1, tone(lawn[1], night(-.5) || (D ? -.04 : 0))]]);
  g.push(`<rect x="-90" y="${lb}" width="${W + 180}" height="${106 - lb}" fill="url(#hm3lawn)"/>`);
  const vx = W / 2, vy = -260, ta = (lb - vy) / (106 - vy);
  for (let k = -26; k <= 26; k++) { const xa = vx + k * 9, xb = xa + 4.5; add(`fill="rgba(255,255,255,${N ? .03 : .07})"`, shape([[vx + (xa - vx) * ta, lb], [vx + (xb - vx) * ta, lb], [xb, 106], [xa, 106]])); }
  flush();
  grad('hm3edge', [[0, 'rgba(40,70,30,.22)'], [1, 'rgba(40,70,30,0)']]);
  g.push(`<rect x="-90" y="${lb}" width="${W + 180}" height="2.4" fill="url(#hm3edge)"/>`);
  // tufts of grass on the lawn in front of the house (seeded, so the same tufts every time)
  if (!xmas) { let t = 7; const rnd = () => { t = (t * 9301 + 49297) % 233280; return t / 233280; }; for (let k = 0; k < 70; k++) { const x = -20 + rnd() * (W + 40), y = 94.5 + rnd() * 5, h = .8 + rnd() * .7; add(stroke(tone(S === 'winter' ? '#B9CDB5' : S === 'autumn' ? '#97A852' : '#6FAE63', night(-.5)), 1), seg([x - .3, y], [x - .5, y - h]) + seg([x, y], [x, y - h * 1.2]) + seg([x + .3, y], [x + .55, y - h])); } flush(); }
  // ── the garden: a picket fence along the back, stepping stones to the door, the pond
  if (L.garden) {
    const fy = lb + 1.4, fh = 6.4, pk = N ? '#8E8798' : '#FFF6EA', pkS = N ? '#6E687A' : '#E3D2BD';
    add(`fill="${pkS}"`, box(1, fy - fh * .62, L.garden - 2, .9) + box(1, fy - fh * .28, L.garden - 2, .9));
    for (let x = 1.4; x < L.garden - 1.5; x += 2.3) { add(`fill="${pk}"`, shape([[x, fy], [x, fy - fh + .9], [x + .55, fy - fh], [x + 1.1, fy - fh + .9], [x + 1.1, fy]])); add(`fill="${pkS}" opacity=".9"`, box(x + .8, fy - fh + .9, .3, fh - .9)); }
    flush();
    // a bed along the fence: a low hedge, and round blossoms in the season's colours on it (none in winter, none under snow).
    // A blob is an ellipse in scene units: 1 unit down the screen is .75 of one across, so ry = rx / .75 reads as round.
    if (!xmas) {
      const blob = (x, y, rx, ry) => `M${(x - rx).toFixed(2)},${y.toFixed(2)}a${rx},${ry} 0 1,0 ${2 * rx},0a${rx},${ry} 0 1,0 ${-2 * rx},0`;
      const leaf = [S === 'winter' ? '#5E8C62' : '#4F9A55', S === 'winter' ? '#76A178' : '#67B46B'].map(c => tone(c, night(-.5)));
      for (let x = 1.6, k = 0; x < L.garden - 1.6; x += 1.15, k++) add(`fill="${leaf[k % 2]}"`, blob(x, fy + .35 + (k % 2) * .18, .95, 1.05));
      flush();
      if (S !== 'winter') {
        const cols = S === 'autumn' ? ['#E8742E', '#C7432E', '#F2B33D', '#F09A3E'] : ['#FF8FB3', '#FFD75E', '#C69CFF', '#FFFFFF', '#FF9E6B'], at = [];
        for (let x = 2.1, k = 0; x < L.garden - 2; x += 1.55, k++) { const y = fy - .3 + ((k * 7) % 3) * .32; at.push([x, y]); add(`fill="${tone(cols[k % cols.length], night(-.45))}"`, blob(x, y, .52, .66)); }
        flush();
        for (const [x, y] of at) add(`fill="${tone('#FFF0A8', night(-.45))}"`, blob(x, y - .05, .17, .22));
        flush();
      }
    }
    const r0 = L.rooms[0];
    for (const [sx, sy, s] of [[r0.x0 - 3, F0.front - 3.6, 1], [r0.x0 - 7.5, F0.front - 1.9, .92], [r0.x0 - 12.2, F0.front - .4, .86]]) g.push(`<ellipse cx="${sx}" cy="${sy}" rx="${(1.9 * s).toFixed(2)}" ry="${(1.1 * s).toFixed(2)}" fill="${N ? '#7B7D8C' : '#D9D2C6'}"/><ellipse cx="${sx - .2}" cy="${sy - .25}" rx="${(1.3 * s).toFixed(2)}" ry="${(.55 * s).toFixed(2)}" fill="rgba(255,255,255,${N ? .12 : .45})"/>`);
  }
  if (L.pond) {
    const [px, py, pw, ph] = L.pond, cx = px + pw / 2, cy = py + ph / 2;
    rgrad('hm3pond', [[0, N ? '#3C5A8C' : '#B8E2FF'], [.7, N ? '#2C4672' : '#86C8F0'], [1, N ? '#24395E' : '#6AB3E2']], .45, .4, .6);
    g.push(`<ellipse cx="${cx}" cy="${cy + .5}" rx="${pw / 2 + .9}" ry="${ph / 2 + .7}" fill="${N ? '#5E6070' : '#C9C0B2'}"/><ellipse cx="${cx}" cy="${cy}" rx="${pw / 2}" ry="${ph / 2}" fill="url(#hm3pond)"/>`
      + `<ellipse cx="${cx - pw * .18}" cy="${cy - ph * .18}" rx="${pw * .16}" ry="${ph * .1}" fill="rgba(255,255,255,${N ? .18 : .5})"/><ellipse cx="${cx + pw * .22}" cy="${cy + ph * .12}" rx="${pw * .07}" ry="${ph * .16}" fill="#5DB565"/><ellipse cx="${cx + pw * .08}" cy="${cy + ph * .2}" rx="${pw * .05}" ry="${ph * .12}" fill="#6CC274"/>`);
  }
  // ── the rooms
  grad('hm3ao', [[0, 'rgba(50,30,20,.26)'], [1, 'rgba(50,30,20,0)']]);
  grad('hm3ceil', [[0, N ? '#BDB1A4' : '#FFFBF6'], [1, N ? '#9C9083' : '#EADFD2']]);
  rgrad('hm3glow', [[0, 'rgba(255,214,150,.42)'], [.6, 'rgba(255,190,120,.12)'], [1, 'rgba(30,20,60,.18)']], .5, .22, .75);
  if (N) rgrad('hm3pool', [[0, 'rgba(255,224,170,.34)'], [1, 'rgba(255,224,170,0)']]);
  const doorTo = (r, side) => {   // a doorway in this side wall: another room, or the garden through the front door
    const x = side < 0 ? r.x0 : r.x1;
    return L.rooms.some(q => q !== r && q.f === r.f && (side < 0 ? q.x1 === x : q.x0 === x)) || (side < 0 && r.f === 0 && r === L.rooms[0] && L.garden);
  };
  for (const r of L.rooms) {
    const F = L.floors[r.f], look = lookOf(r, room), dx = dxOf(r), id = r.id;
    const A = [r.x0, r.top], B = [r.x1, r.top], C = [r.x1, F.front], Dd = [r.x0, F.front];
    const a = [r.x0 + dx, r.top + DC], b = [r.x1 - dx, r.top + DC], c = [r.x1 - dx, F.back], d = [r.x0 + dx, F.back];
    const fl0 = tone(look.floor, night(-.32)), wl = look.wall.map(w => tone(w, night(-.3)));
    if (r.open) {   // the balcony: a deck in the open air, a low rail along its back
      grad('hm3deck', [[0, tone('#C99B74', night(-.4) - .1)], [1, tone('#DDB48C', night(-.38))]]);
      g.push(poly([d, c, C, Dd], 'fill="url(#hm3deck)"'));
      for (let k = 1; k < 9; k++) add(stroke('rgba(90,55,30,.28)'), seg([d[0] + (c[0] - d[0]) * k / 9, F.back], [Dd[0] + (C[0] - Dd[0]) * k / 9, F.front]));
      const rail = N ? '#A79E95' : '#FFF8EE';
      add(`fill="${rail}"`, box(d[0], F.back - 3.4, c[0] - d[0], .7));
      for (let x = d[0]; x <= c[0] + .01; x += 2.6) add(`fill="${rail}"`, box(x - .25, F.back - 3.4, .5, 3.4));
      flush();
      continue;
    }
    grad('hm3w_' + id, [[0, wl[0]], [1, wl[1]]]);
    grad('hm3f_' + id, [[0, tone(fl0, -.16)], [1, tone(fl0, .06)]]);
    // ceiling, back wall (with a picture rail, faint stripes and a skirting board), floor
    g.push(poly([A, B, b, a], 'fill="url(#hm3ceil)"') + poly([a, b, c, d], `fill="url(#hm3w_${id})"`));
    const wh = F.back - a[1];
    add('fill="rgba(255,255,255,.55)"', box(a[0], a[1] + wh * .2, b[0] - a[0], .35));
    for (let x = a[0] + 1.6; x < b[0]; x += 3.2) add(`fill="rgba(255,255,255,${N ? .03 : .09})"`, box(x, a[1] + wh * .2 + .35, 1.6, wh * .8 - 1.5));
    add(`fill="${tone(wl[1], -.12)}"`, box(a[0], F.back - 1.4, b[0] - a[0], 1.4));
    flush();
    g.push(`<rect x="${a[0]}" y="${F.back - 1.4}" width="${b[0] - a[0]}" height=".3" fill="rgba(255,255,255,.5)"/>` + poly([d, c, C, Dd], `fill="url(#hm3f_${id})"`));
    if (look.tiles) {   // a tiled floor: lines back to front and across, closer together further back
      for (let k = 1; k < 8; k++) add(stroke('rgba(120,110,95,.28)'), seg([d[0] + (c[0] - d[0]) * k / 8, F.back], [Dd[0] + (C[0] - Dd[0]) * k / 8, F.front]));
      for (let k = 1; k < 5; k++) { const t = 1 - Math.pow(1 - k / 5, 1.35), y = F.back + (F.front - F.back) * t; add(stroke('rgba(120,110,95,.28)'), seg([d[0] + (Dd[0] - d[0]) * t, y], [c[0] + (C[0] - c[0]) * t, y])); }
    } else {           // wooden boards, running back toward the middle of the room, and where one ends and the next begins
      const n = Math.max(4, Math.round((r.x1 - r.x0) / 4.4)), line = stroke(tone(fl0, -.3), 1, .55), joint = stroke(tone(fl0, -.3), 1, .4);
      for (let k = 1; k < n; k++) add(line, seg([d[0] + (c[0] - d[0]) * k / n, F.back], [Dd[0] + (C[0] - Dd[0]) * k / n, F.front]));
      for (let k = 0; k < n; k++) for (const t of [k % 2 ? .3 : .62, k % 3 ? .82 : .14]) {
        const x0 = d[0] + (c[0] - d[0]) * k / n, x1 = d[0] + (c[0] - d[0]) * (k + 1) / n, X0 = Dd[0] + (C[0] - Dd[0]) * k / n, X1 = Dd[0] + (C[0] - Dd[0]) * (k + 1) / n, y = F.back + (F.front - F.back) * t;
        add(joint, seg([x0 + (X0 - x0) * t, y], [x1 + (X1 - x1) * t, y]));
      }
    }
    flush();
    if (look.mat && Array.isArray(look.mat)) {   // the 小窝's rug
      const cx = (r.x0 + r.x1) / 2, cy = F.back + (F.front - F.back) * .55, rx = (r.x1 - r.x0) * .26, ry = (F.front - F.back) * .26;
      grad('hm3mat', [[0, look.mat[0]], [1, look.mat[1] || look.mat[0]]]);
      g.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#hm3mat)" opacity="${N ? .75 : .92}"/>`);
    } else if (look.rug) g.push(`<ellipse cx="${(r.x0 + r.x1) / 2}" cy="${F.back + (F.front - F.back) * .58}" rx="${(r.x1 - r.x0) * .22}" ry="${(F.front - F.back) * .22}" fill="${tone(look.rug, night(-.3))}" opacity=".9"/>`);
    if (look.tiles) g.push(`<rect x="${a[0]}" y="${(F.back - wh * .34).toFixed(2)}" width="${b[0] - a[0]}" height="${(wh * .34 - 1.4).toFixed(2)}" fill="rgba(255,255,255,.35)"/>`);   // kitchen tiles behind the stove
    // the window on the back wall, and its light on the floor
    if (r.win) {
      const [cxf, ww, whh] = r.win, cx = a[0] + (b[0] - a[0]) * cxf, wy = a[1] + wh * .22, frame = '#FFF8EE', drape = tone(look.rug || '#F6C6D8', night(-.35));
      const glass = N ? ['#1B2450', '#33407A'] : D ? ['#FFB98A', '#FFE2C2'] : ['#9ED3F5', '#E3F4FD'];
      grad('hm3g_' + id, [[0, glass[0]], [1, glass[1]]]);
      g.push(`<rect x="${cx - ww / 2 - .5}" y="${wy - .6}" width="${ww + 1}" height="${whh + 1.2}" rx=".6" fill="${frame}"/><rect x="${cx - ww / 2}" y="${wy}" width="${ww}" height="${whh}" fill="url(#hm3g_${id})"/>`
        + `<path d="${box(cx - .2, wy, .4, whh) + box(cx - ww / 2, wy + whh / 2 - .25, ww, .5)}" fill="${frame}"/><rect x="${cx - ww / 2 - 1.2}" y="${wy + whh + .5}" width="${ww + 2.4}" height=".8" rx=".3" fill="${tone(wl[1], -.18)}"/>`
        + `<path d="${shape([[cx - ww / 2 - 1.6, wy - 1], [cx - ww / 2 + 1.2, wy - 1], [cx - ww / 2 + .5, wy + whh + 1.4], [cx - ww / 2 - 1.9, wy + whh + 1.4]]) + shape([[cx + ww / 2 - 1.2, wy - 1], [cx + ww / 2 + 1.6, wy - 1], [cx + ww / 2 + 1.9, wy + whh + 1.4], [cx + ww / 2 - .5, wy + whh + 1.4]])}" fill="${drape}" opacity=".85"/>`);
      if (N) g.push(`<path d="${[[.25, .3], [.7, .2], [.55, .65]].map(([sx, sy]) => box(cx - ww / 2 + ww * sx - .15, wy + whh * sy - .2, .3, .4)).join('')}" fill="#FFF8DC"/>`);
      else g.push(poly([[cx - ww / 2, F.back], [cx + ww / 2, F.back], [cx + ww / 2 + 4, F.back + (F.front - F.back) * .72], [cx - ww / 2 + 1.5, F.back + (F.front - F.back) * .72]], `fill="rgba(255,250,225,${D ? .2 : .26})"`));
    }
    // shade where the floor meets the back wall
    g.push(poly([d, c, [c[0] + .6, F.back + 2.6], [d[0] - .6, F.back + 2.6]], 'fill="url(#hm3ao)"'));
    // the side walls, darker the further from the light; a doorway at the front where there is somewhere to go
    for (const side of [-1, 1]) {
      const sw = side < 0 ? [A, a, d, Dd] : [B, b, c, C];
      g.push(poly(sw, `fill="${tone(wl[1], side < 0 ? -.07 : -.15)}"`) + poly([wallPt(r, side, 0, 0), wallPt(r, side, 1, 0), wallPt(r, side, 1, .06), wallPt(r, side, 0, .06)], `fill="${tone(wl[1], -.22)}"`));
      add(stroke('rgba(60,40,30,.25)'), seg(sw[1], sw[2]) + seg(sw[2], sw[3]));
      if (doorTo(r, side)) {
        const out = side < 0 && r === L.rooms[0] && r.f === 0;   // the front door: the garden outside
        g.push(poly([wallPt(r, side, 0, 0), wallPt(r, side, DOOR_U, 0), wallPt(r, side, DOOR_U, DOOR_V), wallPt(r, side, 0, DOOR_V)], `fill="${out ? tone('#BFE3B0', night(-.55)) : tone(wl[1], -.34)}" stroke="${N ? '#7A6650' : '#B98A5E'}" stroke-width="1.6" vector-effect="non-scaling-stroke"`));
      }
    }
    // the light: a lamp under the ceiling, lit at night, its pool of light on the floor
    const lx = (r.x0 + r.x1) / 2, ly = r.top + DC * .5;
    add(stroke('rgba(90,70,60,.6)'), seg([lx, ly], [lx, ly + 2.2]));
    flush();
    g.push(poly([[lx - 1.5, ly + 4.1], [lx + 1.5, ly + 4.1], [lx + .8, ly + 2.2], [lx - .8, ly + 2.2]], `fill="${N ? '#FFE6A8' : '#F3D9A8'}" stroke="rgba(150,110,60,.5)" stroke-width="1" vector-effect="non-scaling-stroke"`));
    if (N) g.push(poly([A, B, C, Dd], 'fill="url(#hm3glow)"') + `<ellipse cx="${lx}" cy="${F.back + (F.front - F.back) * .5}" rx="${(r.x1 - r.x0) * .32}" ry="${(F.front - F.back) * .36}" fill="url(#hm3pool)"/>`);
  }
  // ── the stairs: from the hall's floor up through the ceiling to the floor above
  if (L.stairs) {
    const s = L.stairs, n = 9, F1 = L.floors[1];
    g.push(poly([[s.tx - 3.2, F1.back + 1.4], [s.tx + 1.4, F1.back + 1.4], [s.tx + 2.6, F1.front - 1.2], [s.tx - 1.6, F1.front - 1.2]], `fill="${N ? '#2C2236' : '#5A4234'}" opacity=".85"`));   // the opening in the floor above
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, x0 = s.bx - 2 + (s.tx - s.bx) * t0, x1 = s.bx - 2 + (s.tx - s.bx) * t1, y0 = s.by + 1.4 + (s.ty - s.by) * t0, y1 = s.by + 1.4 + (s.ty - s.by) * t1;
      add(`fill="${tone('#B98A5E', night(-.35))}"`, shape([[x0, y0], [x0 + 4.2, y0], [x0 + 4.2, y1], [x0, y1]]));
      add(`fill="${tone('#E3BE94', night(-.35))}" stroke="${tone('#9A6F4A', night(-.3))}" stroke-width="1" vector-effect="non-scaling-stroke"`, shape([[x0, y1], [x0 + 4.2, y1], [x1 + 4.2, y1], [x1, y1]]));
    }
    add(stroke(tone('#8A5E3B', night(-.3)), 2.4), seg([s.bx + 2.4, s.by - 5.2], [s.tx + 2.4, s.ty - 5.2]));
    for (let k = 0; k <= 4; k++) { const t = k / 4, x = s.bx + 2.4 + (s.tx - s.bx) * t, y = s.by - 5.2 + (s.ty - s.by) * t; add(stroke(tone('#A77A53', night(-.3)), 1.4), seg([x, y], [x, y + 5])); }
    flush();
  }
  // ── the house's front edges: the walls and floors cut through, a door where one leads on
  const wallC = N ? '#9F8F7E' : '#F8EAD8', edgeC = N ? '#6E5E4E' : '#C99B74', edge = `fill="${wallC}" stroke="${edgeC}" stroke-width="1" vector-effect="non-scaling-stroke"`;
  for (let fi = 0; fi < L.floors.length; fi++) {
    const F = L.floors[fi], rs = L.rooms.filter(r => r.f === fi);
    if (!rs.length) continue;
    const top = Math.min(...rs.map(r => r.top)), x0 = Math.min(...rs.map(r => r.x0)), x1 = Math.max(...rs.map(r => r.x1)), slab = fi === 0 ? 3.4 : 3;
    // the floor's front edge (the ground floor's is its foundation)
    if (fi === 0) g.push(`<rect x="${x0 - 1.6}" y="${F.front}" width="${x1 - x0 + 3.2}" height="${slab}" fill="${N ? '#6E5848' : '#B98A5E'}" stroke="${edgeC}" stroke-width="1" vector-effect="non-scaling-stroke"/><rect x="${x0 - 1.6}" y="${F.front}" width="${x1 - x0 + 3.2}" height=".5" fill="rgba(255,255,255,.3)"/>`);
    else add(edge, box(x0 - 1.6, F.front, x1 - x0 + 3.2, slab));
    // each wall's cut edge: the outer walls thick, the inner ones thin, open from the floor up where a doorway is
    const xs = [...new Set(rs.flatMap(r => [r.x0, r.x1]))].sort((p, q) => p - q), doorH = (F.front - top) * DOOR_V;
    for (const x of xs) {
      const left = rs.find(r => r.x1 === x), right = rs.find(r => r.x0 === x);
      if ((left && left.open && !right) || (right && right.open && !left)) continue;   // the balcony's open end
      const outer = !left || !right || left.open || right.open, w = outer ? 1.6 : 1;
      const door = (left && right) || (!left && fi === 0 && L.garden), yEnd = door ? F.front - doorH : F.front;
      add(edge, box(!left ? x - w : !right ? x : x - w / 2, top, w, yEnd - top));
    }
  }
  flush();
  // the house's shadow on the lawn under its front edge
  grad('hm3base', [[0, 'rgba(30,45,20,.28)'], [1, 'rgba(30,45,20,0)']]);
  { const r0 = L.rooms[0], x1 = Math.max(...L.rooms.filter(r => r.f === 0).map(r => r.x1)); g.push(`<rect x="${r0.x0 - 2.4}" y="${F0.front + 3.4}" width="${x1 - r0.x0 + 4.8}" height="2.6" fill="url(#hm3base)"/>`); }
  // ── the roof: tiles along both slopes, the gable between them with a round window, the chimney standing on the right slope
  {
    const [rx0, rx1, ra, rb] = L.roof, mid = (rx0 + rx1) / 2, half = (rx1 - rx0) / 2, th = 3.6, dxi = th * half / (rb - ra);
    const slopeY = (x) => ra + (rb - ra) * Math.abs(x - mid) / half;
    const tileA = N ? '#8E3E4C' : D ? '#E06A6E' : '#E46F7E', tileB = N ? '#6E2C38' : '#B84B5C';
    defs.push(`<pattern id="hm3tile" width="2.4" height="1.5" patternUnits="userSpaceOnUse"><rect width="2.4" height="1.5" fill="${tileA}"/><path d="M0 1.5Q.6 .5 1.2 1.5Q1.8 .5 2.4 1.5" fill="none" stroke="${tileB}" stroke-width=".22"/></pattern>`);
    grad('hm3eave', [[0, 'rgba(40,20,20,.3)'], [1, 'rgba(40,20,20,0)']]);
    g.push(`<rect x="${rx0 + 3.6}" y="${rb}" width="${rx1 - rx0 - 7.2}" height="2.6" fill="url(#hm3eave)"/>`);
    // the chimney goes behind the slope it stands on
    const [cxc, cw, chh] = L.chim, xl = cxc - cw / 2, xr = cxc + cw / 2, yb = slopeY(xl), yt = yb - chh, brick = N ? '#7A4A36' : '#B5653F';
    g.push(poly([[xr, yt], [xr + 1.1, yt - .9], [xr + 1.1, slopeY(xr + 1.1) + .2], [xr, slopeY(xr) + .2]], `fill="${tone(brick, -.25)}"`) + poly([[xl, yt], [xr, yt], [xr, slopeY(xr) + .3], [xl, yb + .3]], `fill="${brick}"`));
    for (let y = yt + 1.4; y < yb; y += 1.4) add(stroke('rgba(60,25,15,.35)'), seg([xl, y], [xr, y]));
    flush();
    g.push(poly([[xl - .5, yt], [xr + .5, yt], [xr + 1.5, yt - 1], [xl + .5, yt - 1]], `fill="${tone(brick, .18)}"`) + `<rect x="${xl - .5}" y="${yt - .1}" width="${cw + 1}" height=".9" fill="${tone(brick, -.1)}"/>`);
    G.chimTop = [cxc, yt - 1];
    // the tiles, then the gable face over them
    g.push(poly([[rx0, rb], [mid, ra], [rx1, rb]], 'fill="url(#hm3tile)"') + `<path d="${seg([rx0, rb], [mid, ra]) + seg([mid, ra], [rx1, rb])}" ${stroke(tileB, 2)}/>`);
    if (xmas) g.push(poly([[rx0 + 1, rb - .6], [mid, ra - .5], [rx1 - 1, rb - .6], [rx1 - 2.4, rb - .6], [mid, ra + 1.4], [rx0 + 2.4, rb - .6]], 'class="hm-snowcap" fill="#FFFFFF" opacity=".95"'));
    const gab = N ? '#B8A898' : '#FFF4E6', gabL = N ? '#9C8C7C' : '#EED9C2';
    g.push(poly([[rx0 + dxi + 1.4, rb], [mid, ra + th], [rx1 - dxi - 1.4, rb]], `fill="${gab}"`));
    for (let y = ra + th + 2.2; y < rb - .4; y += 1.6) { const w = (y - ra - th) / (rb - ra - th) * (half - dxi - 1.4); add(stroke(gabL), seg([mid - w, y], [mid + w, y])); }
    flush();
    const wy = ra + th + (rb - ra - th) * .5, wr = Math.min(2.6, (rb - ra) * .14);
    g.push(`<ellipse cx="${mid}" cy="${wy}" rx="${wr + .5}" ry="${(wr + .5) / .75}" fill="#FFF8EE" stroke="${edgeC}" stroke-width="1" vector-effect="non-scaling-stroke"/><ellipse cx="${mid}" cy="${wy}" rx="${wr}" ry="${wr / .75}" fill="${N ? '#FFD982' : D ? '#FFC79A' : '#A9D8F6'}"/>`
      + `<path d="${box(mid - .18, wy - wr / .75, .36, 2 * wr / .75) + box(mid - wr, wy - .18, 2 * wr, .36)}" fill="#FFF8EE"/><rect x="${mid - 1.6}" y="${ra - .9}" width="3.2" height="1.6" rx=".7" fill="${tileB}"/>`);
  }
  // ── dusk and night over everything outdoors
  if (D || N) g.push(`<rect x="-90" y="${lb}" width="${W + 180}" height="${106 - lb}" fill="${N ? 'rgba(14,18,56,.12)' : 'rgba(255,150,90,.08)'}"/>`);
  return `<svg class="hm-svg" viewBox="0 0 ${W} 100" preserveAspectRatio="none" style="width:${W}%" aria-hidden="true"><defs>${defs.join('')}</defs>${g.join('')}</svg>`;
}

function levelOf() { return owns('hm_lv3') ? 3 : owns('hm_lv2') ? 2 : 1; }
function roomLook() { let room = { items: [], paper: null, mat: null }; try { room = API.room() || room; } catch (e) {} return room; }
// The 客厅 is the couple's own 小窝: the same pieces where they put them, the same wallpaper and floor. Its wall pieces
// hang on the back wall; its floor pieces stand on the floor in perspective (the 小窝's floor is the lower 42% of its
// picture), smaller the further back, in among the two of you.
function backWall(r, room) {
  const F = LVS[G.lv].floors[r.f], dx = dxOf(r), x0 = r.x0 + dx, x1 = r.x1 - dx, y0 = r.top + DC, y1 = F.back;
  const items = room.items.map((o, z) => {
    if (!o.wall) return '';
    const size = (o.ratio || .5) * (o.s || 1) * .82;
    return `<div class="hm-mp hm-mpw" style="left:${clamp(+o.x || 50, 0, 100)}%;top:${clamp((+o.y || 30) / 58 * 100, 8, 100).toFixed(1)}%;z-index:${z + 2};font-size:calc(var(--hm-mh, 60px) * ${size.toFixed(3)})">${o.svg || `<span class="hm-mpe">${esc(o.art || '')}</span>`}</div>`;
  }).join('');
  return `<div class="hm-abs hm-bwall" style="left:${x0.toFixed(2)}%;top:${y0.toFixed(2)}%;width:${(x1 - x0).toFixed(2)}%;height:${(y1 - y0).toFixed(2)}%"><div class="hm-mwin"><i></i></div>${photoWall()}${items}</div>`;
}
function livingPieces(r, room) {
  const F = LVS[G.lv].floors[r.f], dx = dxOf(r);
  G.sofas = [];
  return room.items.map((o) => {
    if (o.wall) return '';
    const size = (o.ratio || .5) * (o.s || 1), t = clamp(((+o.y || 80) - 58) / 42, 0, 1);
    const y = F.back + (F.front - F.back) * t, xl = r.x0 + dx * (1 - t), xr = r.x1 - dx * (1 - t), x = xl + (xr - xl) * clamp(+o.x || 50, 0, 100) / 100;
    const sz = size * depthS(y, r.f);
    if (o.art === '🛋️') G.sofas.push({ x, y, size: sz });
    // its footprint: as wide as it is drawn (the room's own size unit, in floor units), about half that deep
    const wU = sz * Math.min((r.x1 - r.x0) * .36, (F.front - r.top) * .62 * .75);
    addObst(x, y, wU * .38, Math.min(2.6, wU * .32), r.f, o.art || 'piece');
    return `<div class="hm-mp hm-mpf" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;z-index:${Math.round(y * 10)};font-size:calc(var(--hm-mh, 60px) * ${sz.toFixed(3)})">${o.svg || `<span class="hm-mpe">${esc(o.art || '')}</span>`}</div>`;
  }).join('');
}
// 照片墙: the 今日拼图 the two of you have solved, pegged on a string under the ceiling (§7.34)
function photoWall() {
  const saved = (G.srv && G.srv.data && Array.isArray(G.srv.data.wall)) ? G.srv.data.wall : [];
  const pics = saved.map(w => { let src = ''; try { src = (API.photo && API.photo(w && w.p)) || ''; } catch (e) {} return src; }).filter(Boolean).slice(0, 4);
  if (!pics.length) return '';
  return `<div class="hm-pwall" role="img" aria-label="照片墙：拼好的 ${pics.length} 张今日拼图">${pics.map((src, i) =>
    `<span class="hm-pol" style="--i:${i};--n:${pics.length}"><i style="background-image:url('${esc(src).replace(/'/g, '%27')}')"></i></span>`).join('')}</div>`;
}
// what stands on a floor (the house's own furniture, the garden's things): smaller further back, ordered by where it stands
const propSvg = (svg, x, y, w, cls = '') => `<div class="hm-abs hm-thing${cls ? ' ' + cls : ''}" style="left:${x}%;top:${y}%;width:${(w * depthS(y, floorOfY(y))).toFixed(2)}%;z-index:${Math.round(y * 10)}">${svg}</div>`;
const THING_FOOT = { bed: [.44, 2.4], table: [.42, 1.6], stove: [.42, 1.8], bench: [.44, 1.2], bear: [.3, .7], lamp: [.18, .5], pethouse: [.42, 1.6], tree: [.12, 1], fridge: [.42, 1.6], shelf: [.44, 1], plant: [.3, .7] };
const propThing = (k, x, y, w, cls = '') => {
  const f = THING_FOOT[k];
  if (f && G.obst) addObst(x, y, w * depthS(y, floorOfY(y)) * f[0], f[1], floorOfY(y), k);
  return propSvg(art(k), x, y, w, cls);
};
// the front door: the doorway at the front of the 客厅's left wall, where a festival hangs things
function doorAt(L) { const r = L.rooms[0], F = L.floors[0]; return { x: r.x0, y0: F.front - (F.front - r.top) * DOOR_V, y1: F.front }; }
// → what goes on the house (h) and what stands on the lawn among the two of you (p)
function festDecor(L) {
  const [rx0, rx1, ra, rb] = L.roof, d = doorAt(L), on = (id) => G.fests.has(id);
  let h = '', p = '';
  if (on('cny')) h += box('hm-fu', d.x - .8, d.y0 - 3.4, 3, 0, '<span>福</span>', 'height:auto;aspect-ratio:1');
  if (on('anniv')) {
    const th = themesAt(G.today).find(t => t.id === 'anniv') || {}, mid = (rx0 + rx1) / 2, bw = Math.min(34, (rx1 - rx0) * .42);
    // a sign across the tiles, clear of the gable's round window
    h += box('hm-banner', mid - bw / 2, ra + (rb - ra) * .78 - 2.7, bw, 5.4, `💞 在一起${esc(th.name || '周年')} 💞`);
    p += propSvg(BALLOON('#FFD75E', '#E8A32E'), d.x - 4.4, d.y1 - 3.4, 3.2, 'hm-sway') + propSvg(BALLOON('#FF8FB3', '#E0508F'), d.x - 7, d.y1 - 2.6, 2.8, 'hm-sway');
  }
  if (owns('hm_lantern') && showFest('cny')) for (const x of [rx0 + 7, rx1 - 7]) h += `<div class="hm-abs hm-hang hm-glows" style="left:${x}%;top:${rb}%;width:3.2%">${LANTERN}</div>`;
  if (owns('hm_lights') && showFest('xmas')) { const n = Math.round((rx1 - rx0) / 4.6); for (let k = 0; k <= n; k++) { const x = rx0 + 3 + k * (rx1 - rx0 - 6) / n; h += box('hm-bulb', x, rb + .6, 1.3, 0, '', `height:auto;background:${['#FF6F9F', '#FFD75E', '#7FC4FF', '#7FD8A8'][k % 4]};animation-delay:${-(k * .37).toFixed(2)}s`); } }
  if (owns('hm_couplet') && showFest('cny')) { h += box('hm-couplet', d.x - 4.4, d.y0 + .4, 1.9, (d.y1 - d.y0) * .72, '春满人间'); h += box('hm-couplet', d.x + 1.6, d.y0 + .4, 1.9, (d.y1 - d.y0) * .72, '福到我家'); }
  if (owns('hm_arch') && showFest('vday')) for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; h += `<span class="hm-abs hm-ah" style="left:${(d.x + Math.cos(a) * 3.4).toFixed(2)}%;top:${(d.y0 - Math.sin(a) * 4.2 + .8).toFixed(2)}%">💗</span>`; }
  // the garden's own pieces stand in a row on the lawn in front of where you walk
  const front = [];
  if (owns('hm_lamp')) front.push([POSTLAMP, 2.8, 'hm-glows']);
  if (owns('hm_snowman') && showFest('xmas')) front.push([SNOWMAN, 5.6, '']);
  if (owns('hm_lion') && showFest('cny')) front.push([LION, 5.6, '']);
  if (owns('hm_mailbox') && showFest('vday')) front.push([MAIL, 3.4, '']);
  if (owns('hm_rabbit') && showFest('midautumn')) front.push([RABBIT, 5.4, 'hm-glows'], [RABBIT, 4.6, 'hm-glows']);
  if (owns('hm_pumpkin') && showFest('halloween')) front.push([PUMPKIN, 5, 'hm-glows hm-pumpkin'], [PUMPKIN, 4.2, 'hm-glows hm-pumpkin']);
  let fx0 = 4;
  for (const [svg, w, cls] of front) { p += propSvg(svg, fx0 + w / 2, 98.6, w, cls); fx0 += w + 2.2; }
  return { h, p };
}
function renderHouse(opening) {
  if (!UI.house) return;
  const L = LVS[G.lv], room = roomLook(), fd = festDecor(L);
  let h = houseSvg(L, room) + backWall(L.rooms[0], room);
  for (const r of L.rooms) if (!/^hall/.test(r.id)) h += `<span class="hm-abs hm-rn" style="left:${(r.x0 + r.x1) / 2}%;top:${r.top}%">${r.n}</span>`;
  if (!REDUCE && G.chimTop) h += `<div class="hm-abs hm-smoke" style="left:${G.chimTop[0]}%;top:${G.chimTop[1]}%" aria-hidden="true"><i></i><i></i><i></i></div>`;
  // the garden's little lives: fireflies at night, butterflies by the flowers on a spring or summer day
  if (!REDUCE && L.garden) {
    const F0 = L.floors[0];
    if (G.night) for (let k = 0; k < 8; k++) h += `<i class="hm-fly" style="left:${(3 + (k * 4.7) % (L.garden - 6)).toFixed(1)}%;top:${(F0.back - 3 + (k * 3.3) % 12).toFixed(1)}%;animation-delay:${-(k * .83).toFixed(2)}s;animation-duration:${(3.4 + (k % 3) * .7).toFixed(1)}s"></i>`;
    else if (G.season === 'spring' || G.season === 'summer') for (const [x, dl] of [[10, 0], [27, -2.6]]) h += `<i class="hm-bfly" style="left:${x}%;top:${F0.back - 6}%;animation-delay:${dl}s">🦋</i>`;
  }
  // a clock on the wall, its hands set by the phone's own clock (and moved on every minute by the house's tick)
  for (const r of L.rooms) if (r.clock) {
    const dx = dxOf(r), F = L.floors[r.f], ax = r.x0 + dx, bx = r.x1 - dx, ay = r.top + DC;
    h += `<div class="hm-abs hm-clock" style="left:${(ax + (bx - ax) * r.clock).toFixed(2)}%;top:${(ay + (F.back - ay) * .3).toFixed(2)}%" aria-hidden="true"><i></i><i></i></div>`;
  }
  UI.house.innerHTML = h + fd.h;
  clockTick();
  cancelAnimationFrame(G.propsRaf); G.propsRaf = 0;
  if (opening) { G.propsRaf = requestAnimationFrame(() => { G.propsRaf = 0; if (G.open && UI.props) { renderProps(L, room, fd); try { if (API && API.ready) API.ready(); } catch (e) {} } }); return; }
  renderProps(L, room, fd);
}
// what stands on the floors: the 客厅's furniture, the house's own, the garden's things, the balcony's rail, the pots
function renderProps(L, room, fd) {
  G.obst = [];
  let p = livingPieces(L.rooms[0], room);
  for (const [k, x, y, w] of L.things) p += propThing(k, x, y, w);
  for (const [k, x, y, w] of L.garden_things) {
    if (k === 'tree' && owns('hm_xtree') && showFest('xmas')) { p += propSvg(XTREE, x + 1, y + .6, w + 1.5, 'hm-glows hm-xtree'); continue; }
    p += propThing(k, x, y, w, k === 'tree' ? 'hm-tree' : '');
  }
  // the balcony's rail stands in front of whoever is out there
  if (L.balcony) { const F1 = L.floors[1]; p += `<div class="hm-abs hm-rail3" style="left:${L.balcony[0]}%;top:${F1.front - 4.6}%;width:${L.balcony[1] - L.balcony[0]}%;height:4.6%;z-index:${Math.round((F1.front + .1) * 10)}"></div>`; }
  p += fd.p;
  L.pots.forEach(([x, y], i) => { p += potHtml(i); addObst(x, y, 1.5, 1, floorOfY(y), 'pot'); });
  UI.props.innerHTML = p;
  G.lastPots = potsSig();
  sizeMini();
  controls();
  todo();
}
function clockTick() {
  if (!UI.house) return;
  const now = new Date(), m = now.getMinutes(), hr = now.getHours() % 12 + m / 60;
  for (const c of UI.house.querySelectorAll('.hm-clock')) { c.children[0].style.transform = `rotate(${(hr * 30).toFixed(1)}deg)`; c.children[1].style.transform = `rotate(${m * 6}deg)`; }
}
// The sky fills the whole screen: sun or moon, clouds, stars, and what a festival puts in the air.
function renderSky() {
  if (!UI.sky) return;
  const on = (id) => G.fests.has(id);
  let h = '<div class="hm-sun"></div>';
  for (const [x, y] of [[8, 14], [22, 24], [36, 10], [55, 18], [70, 8], [14, 36], [48, 30], [88, 26], [80, 42], [30, 48]]) h += `<i class="hm-star" style="left:${x}%;top:${y}%"></i>`;
  h += '<i class="hm-cloud" style="left:6%;top:20%;width:24%"></i><i class="hm-cloud" style="left:58%;top:10%;width:18%"></i><i class="hm-cloud" style="left:72%;top:44%;width:20%"></i>';
  // birds now and then across the day sky (never at night, never with reduced motion)
  if (!REDUCE && !G.night) h += '<i class="hm-bird" style="top:22%;animation-delay:-3s"></i><i class="hm-bird" style="top:27%;animation-delay:-4.2s"></i><i class="hm-bird hm-bird2" style="top:16%;animation-delay:-14s"></i>';
  UI.sky.innerHTML = h;
  let f = '';
  if (on('xmas')) for (let k = 0; k < 22; k++) f += `<i class="hm-flake" style="left:${((k * 4.6 + 2) % 100).toFixed(1)}%;animation-delay:${-(k * .41).toFixed(2)}s;animation-duration:${(6 + (k % 5) * .7).toFixed(1)}s"></i>`;
  if (on('vday')) for (let k = 0; k < 8; k++) f += `<span class="hm-fheart" style="left:${6 + k * 12}%;animation-delay:${-(k * 0.9).toFixed(1)}s">💗</span>`;
  if (on('halloween')) for (const [x, y, dl] of [[10, 24, 0], [48, 14, -2.7], [72, 34, -5.1]]) f += `<div class="hm-bat" style="left:${x}%;top:${y}%;animation-delay:${dl}s">${BAT}</div>`;
  UI.skyfx.innerHTML = f;
}
const potsSig = () => JSON.stringify([G.today, G.lv, LVS[G.lv].pots.map((_, i) => { const q = potInfo(i); return [q.pl && q.pl.id, q.g.stage, q.g.wilted, q.mine, q.theirs]; })]);
function renderPots() {
  const sig = potsSig();
  todo();
  if (sig === G.lastPots) return;
  G.lastPots = sig;
  LVS[G.lv].pots.forEach((_, i) => { const el = UI.props && UI.props.querySelector(`.hm-pot[data-i="${i}"]`); if (el) el.outerHTML = potHtml(i); });
  renderPanel();
}
// the 客厅's furniture is sized off the room it stands in, like the 小窝's is off the pet (§7)
function sizeMini() {
  if (!G.W || !UI.world) return;
  const L = LVS[G.lv], r = L.rooms[0], F = L.floors[r.f], w = (r.x1 - r.x0) / 100 * G.W, h = (F.front - r.top) / 100 * G.H;
  const mh = Math.round(Math.min(w * .36, h * .62));
  UI.world.style.setProperty('--hm-mh', mh + 'px');
  // two seats a sofa; the cushion is 42% up the drawing (sofa_blue's seat), and you sit just into it
  G.seats = [];
  for (const f of G.sofas || []) {
    const wpx = f.size * mh, half = wpx / 4 / G.W * 100;
    G.seats.push({ x: f.x - half, y: f.y + .35, lift: .4 * wpx }, { x: f.x + half, y: f.y + .35, lift: .4 * wpx });
  }
  for (const k of ['cs', 'yy']) if (P[k]) poseSit(P[k]);
  if (UI.sit) UI.sit.hidden = !G.seats.length;
}
// sitting is a pose where you stand: nothing about walking, stairs or saving changes
function poseSit(a) {
  const s = a.sit >= 0 && G.seats ? G.seats[a.sit] : null;
  a.el.classList.toggle('hm-sit', !!s);
  // the lift is inside the drawing, which is drawn smaller further back
  if (s) a.el.style.setProperty('--hm-lift', (s.lift / depthS(s.y, 0)).toFixed(1) + 'px');
  if (a.k === meK() && UI.sit) UI.sit.innerHTML = s ? '<i>🧍</i><span>站起来</span>' : '<i>🛋️</i><span>坐下</span>';
}
function standUp(a) { if (a.sit < 0 && a.sitWant < 0) return; a.sit = -1; a.sitWant = -1; poseSit(a); }
function sitDown() {
  if (!G.seats || !G.seats.length) return;
  const a = P[meK()], b = P[peerK()], taken = G.partner.on ? b.sit : -1;
  if (a.sit >= 0) { standUp(a); send('up', {}); return; }
  // the seat nearest you that your partner isn't on; next to them if they are sitting
  let best = -1, bd = Infinity;
  G.seats.forEach((s, i) => { if (i === taken) return; const d = taken >= 0 ? Math.abs(i - taken) * 100 + Math.abs(s.x - a.x) : Math.abs(s.x - a.x); if (d < bd) { bd = d; best = i; } });
  if (best < 0) return;
  walkMe(G.seats[best].x, G.seats[best].y, 0, { sit: best });
}
function together() {
  const a = P.cs, b = P.yy;
  if (a.sit >= 0 && b.sit >= 0 && Math.floor(a.sit / 2) === Math.floor(b.sit / 2) && G.partner.on) { fx((G.seats[a.sit].x + G.seats[b.sit].x) / 2, G.seats[a.sit].y - 20, '💕'); say(`一起坐在沙发上 💕`); }
}

/* ── people (and the pet) ─────────────────────────────────────────────────────────────────────── */
function makeActor(k) {
  const el = document.createElement('div');
  el.className = 'hm-ch'; el.dataset.k = k;
  el.innerHTML = `<div class="hm-cin"><span class="hm-you" aria-hidden="true">▼</span><span class="hm-tag"></span>${charSvg(k)}</div>`;
  UI.actors.appendChild(el);
  return { k, el, x: k === 'cs' ? 54 : 70, y: G0 + (k === 'cs' ? 1 : -1), fi: 0, vx: 0, vy: 0, path: [], after: null, flip: false, hv: null, sit: -1, sitWant: -1 };
}
// fi: the floor someone is on (0 the ground floor, 1 upstairs, -1 on the stairs)
function where(a) {
  const L = LVS[G.lv];
  if (a.fi === -1) return '楼梯上';
  const fi = a.fi || 0;
  if (fi === 0 && a.x < L.garden) return '花园';
  const r = L.rooms.find(r => r.f === fi && a.x >= r.x0 && a.x <= r.x1);
  return r ? r.n : '家里';
}
const near = () => P.cs && P.yy && G.partner.on && P.cs.fi >= 0 && P.cs.fi === P.yy.fi && Math.hypot(P.cs.x - P.yy.x, (P.cs.y - P.yy.y) * 1.6) < 9;

/* ── what you do ───────────────────────────────────────────────────────────────────────────────── */
function fx(x, y, t) { if (!UI.actors) return; const e = document.createElement('div'); e.className = 'hm-pop'; e.textContent = t; e.style.left = x + '%'; e.style.top = y + '%'; UI.actors.appendChild(e); setTimeout(() => e.remove(), 1300); }
let toastT = 0;
function say(t) { if (!UI.toast) return; UI.toast.textContent = t; UI.toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { if (UI.toast) UI.toast.hidden = true; }, 2600); }
function drops(x, y, who) {
  if (REDUCE || !UI.actors) return;
  for (let n = 0; n < 6; n++) { const d = document.createElement('div'); d.className = 'hm-abs hm-drop'; d.style.left = (x - 2 + Math.random() * 4) + '%'; d.style.top = (y - 13 + Math.random() * 3) + '%'; d.style.background = who === 'cs' ? '#7FB2EC' : '#FF9CC4'; d.style.animationDelay = (n * 60) + 'ms'; UI.actors.appendChild(d); setTimeout(() => d.remove(), 900 + n * 60); }
}
const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
// what tapping a pot means for this phone right now
function potAction(i) {
  const q = potInfo(i);
  if (q.empty) return openSeeds(i);
  if (q.bloom) return goTo(i, { t: 'pick', pot: i, id: q.pl.id });
  if (q.mine) { say(q.theirs ? `今天你们两个都浇过了 💧💧 明天再来` : `今天浇过这盆了，明天再浇 · ${nameOf(peerK())} 也浇的话长得更快`); return goTo(i, null); }
  return goTo(i, { t: 'water', pot: i, id: q.pl.id });
}
function goTo(i, op) {
  // stand beside the pot, not in front of it, so the flower stays in sight
  const [x, y] = LVS[G.lv].pots[i], fi = floorOfY(y), a = P[meK()];
  let sx = x + (a.x < x ? -5.5 : 5.5);
  if (clampPos(sx, y, fi)[0] !== sx) sx = x + (a.x < x ? 5.5 : -5.5);
  walkMe(sx, y + .4, fi, op ? { op } : null);
}
// An action starts once you are standing at the pot. It goes into the save through do_() — which applies
// it here at once, tells the partner's phone, and saves it (retrying on top of whatever they saved).
function act(op) {
  const who = CHAR[meK()], full = { ...op, who, date: G.today, id: op.id || newId() };
  if (op.t === 'plant') full.id = newId();
  const had = (G.view.pots[op.pot] || {}).seed;
  const next = apply(G.view, full);
  if (!next) { renderPots(); return false; }
  G.pending.push(full);
  store.set(pendKey(), G.pending);
  recompute();
  const [x, y] = LVS[G.lv].pots[op.pot] || [P[meK()].x, G0];
  if (op.t === 'water') { drops(x, y, meK()); const q = potInfo(op.pot); say(q.g.stage >= 5 ? `${q.seed.e} 开花啦！再点一下收进图鉴` : q.theirs ? `💧 浇好了 · 今天你们都浇了，长了两格` : `💧 浇好了 · 明天还能再浇`); }
  if (op.t === 'pick') { const s = SEEDS[had]; fx(x, y - 12, s && s.shape === 'pumpkin' ? '🎃' : '🧺'); say(`🧺 收了${s && s.shape === 'pumpkin' ? '一个南瓜' : `一朵${s ? s.n : '花'}`} · 宠物 +${PICK_EXP} EXP · 小窝币 +${PICK_EXP / 2}`); }
  if (op.t === 'plant') { const s = SEEDS[op.seed]; fx(x, y - 10, '🌱'); say(`🌱 种下了${s.n} · 每天浇水，${nameOf(peerK())} 也浇会长得更快`); }
  send('op', { op: full });
  flush();
  return true;
}
const pendKey = () => `hm_pending_${API && API.matchId || 'demo'}_${CHAR[meK()]}`;
// Every newer save comes in here — our own write, the partner's, or the one a refused write hands back —
// so the app always hears of it (its flower count is pet EXP and 小窝币).
function setSrv(data, rev) {
  const before = G.srv.loaded ? (G.srv.data.picked || 0) : null;
  G.srv = { data: norm(data), rev: rev || 0, loaded: true };
  const grew = before !== null && (G.srv.data.picked || 0) > before;
  try { API.onSave(G.srv.data, grew); } catch (e) {}
  // a flower is 小窝币: the balance and what it can buy change with it
  if (grew) { renderCoins(); renderPanel(); }
}
function recompute() {
  const before = G.view.picked;
  // the partner's actions we were told about wait on top until their own save lands (or they turn out
  // to be in the save already, which apply() notices)
  const now = Date.now();
  G.remote = G.remote.filter(r => now - r.at < 30000);
  let v = norm(G.srv.data);
  G.remote = G.remote.filter(r => { const n = apply(v, r.op); if (n) { v = n; return true; } return false; });
  for (const op of G.pending) v = apply(v, op) || v;
  G.view = v;
  renderPots();
  if (v.picked !== before) renderPanel();
}
// Save everything not yet saved, on top of the newest save. A refused write (the partner saved first)
// hands back their save, and our actions are replayed on it; any that no longer make sense are dropped
// and said out loud.
async function flush() {
  if (G.busy || !G.pending.length || !API) return;
  G.busy = true;
  let waiting = false;
  try {
    for (let tries = 0; tries < 5 && G.pending.length; tries++) {
      const ops = G.pending.slice();
      let data = norm(G.srv.data);
      const kept = [], lost = [], wait = [];
      for (const op of ops) {
        const n = apply(data, op);
        if (n) { data = n; kept.push(op); continue; }
        if (landed(data, op)) continue;
        // It builds on something the partner did that this phone has heard of but not loaded yet (they
        // planted, you watered within the second): it waits for their save instead of being dropped.
        // Found by home-live-test, which lost a watering one run in four.
        if (G.remote.length && apply(fold(data, G.remote.map(r => r.op)), op)) wait.push(op);
        else lost.push(op);
      }
      for (const op of lost) explainLost(op, data);
      const gone = ops.filter(o => !kept.includes(o) && !wait.includes(o));
      if (!kept.length) { G.pending = G.pending.filter(o => !gone.includes(o)); if (wait.length) { waiting = true; break; } continue; }
      let res;
      try { res = await API.save.put(data, G.srv.rev); }
      catch (e) {
        if (e && e.stale) { setSrv(e.data, e.rev); continue; }
        throw e;
      }
      setSrv(data, res.rev);
      G.pending = G.pending.filter(o => !kept.includes(o) && !gone.includes(o));
      store.set(pendKey(), G.pending);
      send('saved', { rev: res.rev });
      if (wait.length) { waiting = true; break; }
    }
    G.failAt = 0;
    // waiting on the partner's save: load it shortly (their 'saved' usually gets here first and loads it);
    // if it never comes, their action leaves G.remote after 30 s and ours is dropped then, and said so
    if (waiting) later(() => loadSave(true), 1200);
    // still something unsaved after five refusals in a row (both phones busy at once): try again shortly
    else if (G.pending.length) later(flush, 2500 + Math.random() * 2000);
  } catch (e) {
    if (e && e.status >= 400 && e.status < 500) {
      // the server refused the save itself (not a race): retrying the same thing would refuse forever
      G.pending = [];
      say('这一下没存上，已经换成最新的花园');
      later(() => loadSave(true), 300);
    } else {
      // offline or the server is unwell: keep the actions (they are on the phone too) and try again soon
      G.failAt = Date.now();
      later(flush, 8000);
    }
  } finally {
    G.busy = false;
    store.set(pendKey(), G.pending);
    recompute();
  }
}
function explainLost(op, data) {
  const by = firstBy(data, op), o = nameOf(KEY[by] || peerK());
  if (op.t === 'pick') say(by && by === op.who ? '🌸 这朵花已经收进图鉴了' : `🌸 ${o} 先把这朵花收进图鉴了`);
  else if (op.t === 'plant') say(by && by === op.who ? '🌱 这个花盆已经种上了' : `🌱 ${o} 刚在这个花盆里种了别的`);
  else if (op.t === 'water') say('💧 这盆花刚刚变了，再看一眼');
}
async function loadSave(quiet) {
  if (!API) return;
  try {
    const r = await API.save.get();
    if (!G.open) return;
    if (r.rev !== G.srv.rev || !G.srv.loaded) setSrv(r.data, r.rev);
    recompute(); renderPanel(); status();
    if (G.pending.length) flush();
  } catch (e) { if (!quiet) say('花园没加载出来，网络好像不太好'); }
}

/* ── moving ───────────────────────────────────────────────────────────────────────────────────── */
function walkMe(x, y, fi, after = null) {
  const a = P[meK()];
  if (a.sit >= 0) { standUp(a); send('up', {}); }
  if (G.hold) { G.hold = null; if (G.keys) G.keys.clear(); }
  a.hv = null;
  a.path = route(a, x, y, fi); a.after = after;
  G.lead = 'me';
  hideHint();
  const t = a.path[a.path.length - 1];
  send('go', { x: r1(a.x), y: r1(a.y), f: a.fi, tx: r1(t.x), ty: r1(t.y), tf: t.fi });
}
const r1 = (v) => Math.round(v * 10) / 10;
function hideHint() { if (UI.hint && !UI.hint.hidden) { UI.hint.hidden = true; store.set('hm_hinted', 1); } }
// What you can do right now, as one tap: pick a flower, water the nearest thirsty pot, plant an empty one.
function todo() {
  if (!UI.todo || !P.cs) return;
  const L = LVS[G.lv], a = P[meK()];
  // What can only be done today comes first: a drooping plant, then today's watering. A flower waits to be
  // picked however long it takes, and an empty pot can be planted any day.
  let bloom = -1, empty = -1;
  const thirsty = [], wilted = [];
  L.pots.forEach((_, i) => { const q = potInfo(i); if (q.bloom) { if (bloom < 0) bloom = i; } else if (q.thirsty) { thirsty.push(i); if (q.g.wilted) wilted.push(i); } else if (q.empty && empty < 0) empty = i; });
  const dist = (i) => { const [x, y] = L.pots[i]; return Math.abs(x - a.x) + (floorOfY(y) === Math.max(0, a.fi) ? 0 : 40); };
  const nearest = (list) => list.slice().sort((p, q) => dist(p) - dist(q))[0];
  let t, i = -1;
  if (wilted.length) { i = nearest(wilted); t = `🥀 有 ${wilted.length} 盆花蔫了 · 快去浇水`; }
  else if (thirsty.length) { i = nearest(thirsty); t = `💧 还有 ${thirsty.length} 盆花等你浇水 · 点这里`; }
  else if (bloom >= 0) { t = '🧺 花开了！点这里去收花'; i = bloom; }
  else if (empty >= 0) { t = '🌱 还有空花盆 · 点这里种一盆'; i = empty; }
  else t = '✅ 今天的花都照顾好了';
  // A new suggestion bounces three times to be noticed, then rests. It restarts by switching between two
  // identical animations — re-measuring the page to restart one cost a slow phone 35 ms while opening.
  if (UI.todo.textContent !== t) { UI.todo.textContent = t; UI.todo.dataset.n = UI.todo.dataset.n === '1' ? '0' : '1'; }
  UI.todo.dataset.todo = String(i);
  UI.todo.classList.toggle('hm-done', i < 0);
  UI.todo.hidden = false;
}
function mark(x, y) { if (!UI.actors) return; const m = document.createElement('div'); m.className = 'hm-abs hm-mark'; m.style.left = x + '%'; m.style.top = y + '%'; UI.actors.appendChild(m); setTimeout(() => m.remove(), 750); }
// A pot drawn 25px wide on a phone is a small target, so a tap a little beside it, or on the flower
// above it, still counts. Not more than that: in the Lv3 garden the pots stand 8% apart, and the lawn
// below them and the air above must still walk you there.
function nearPot(x, y) {
  const L = LVS[G.lv];
  let best = -1, bd = Infinity;
  L.pots.forEach(([px, py], i) => { const dx = Math.abs(x - px); if (dx < 4.6 && y > py - 15 && y < py + 3 && dx < bd) { bd = dx; best = i; } });
  return best;
}
const sceneXY = (e) => { const r = UI.scene.getBoundingClientRect(); return [(e.clientX - r.left) / (G.W / 100) + G.camX, (e.clientY - r.top - G.top) / G.H * 100]; };
function onScenePointer(e) {
  if (e.button > 0 || !G.open) return;
  if (UI.acts && !UI.acts.hidden) { closeActs(); return; }
  if (e.target.closest('.hm-hint')) return;
  const potEl = e.target.closest('.hm-pot');
  if (potEl) { e.preventDefault(); return potAction(+potEl.dataset.i); }
  const [tx, ty] = sceneXY(e), hit = nearPot(tx, ty);
  if (hit >= 0) { e.preventDefault(); return potAction(hit); }
  const edge = e.target.closest('.hm-edge');
  // walk to the partner — to where they are going, if they are still on their way
  if (edge) { e.preventDefault(); const b = P[peerK()], t = b.path.length ? b.path[b.path.length - 1] : b; walkMe(t.x + (t.x > P[meK()].x ? -6 : 6), t.y, t.fi >= 0 ? t.fi : 0); return; }
  // the floor under the tap, at the depth of the tap (a tap on a wall or in the air: the back of that floor)
  const fi = floorOfY(ty), [b0, f0] = band(fi), y = clamp(ty, b0, f0);
  walkMe(tx, y, fi); const [mx, my] = clampPos(tx, y, fi); mark(mx, my);
}
// v: which way the stick or the arrow keys point ({ x, y }, each -1, 0 or 1; y -1 is into the room, 1 out of it)
function startHold(v) {
  if (!v || (!v.x && !v.y)) return stopHold();
  const a = P[meK()];
  if (a.sit >= 0) { standUp(a); send('up', {}); }
  const was = G.hold;
  G.hold = v; a.hv = v; a.after = null; if (a.fi !== -1) a.path = []; G.lead = 'me';
  hideHint();
  if (!was || was.x !== v.x || was.y !== v.y) send('hold', { x: r1(a.x), y: r1(a.y), f: a.fi, dx: v.x, dy: v.y });
}
function stopHold() {
  if (!G.hold) return;   // (nothing held: leaving the app must not cut a walk short)
  G.hold = null;
  const a = P[meK()]; a.hv = null;
  send('stop', { x: r1(a.x), y: r1(a.y), f: a.fi });
}
/* ── the two of you together (2026-11-26: 「improve the interaction between both character with more real」) ──
   Next to each other, 💞 互动 opens four things to do: you walk up to your partner first (a hug is close, a high-five
   an arm's length), turn to face each other, and it plays on both phones — 抱抱 leans in with happy eyes and hearts,
   亲亲 leans further and makes the other blush, 击掌 raises a hand each with a 啪, 牵手 keeps you side by side: whoever
   walks leads, the other walks beside them, on both phones, until 放手 (or the stairs part you). */
const ACTS = {
  hug: { e: '🤗', n: '抱抱', say: '抱抱～', gap: 3.2 },
  kiss: { e: '😘', n: '亲亲', say: 'mua～', gap: 2.8 },
  five: { e: '✋', n: '击掌', say: '耶！', gap: 4.4 },
  hand: { e: '🤝', n: '牵手', say: '走吧～', gap: 3.6 },
};
const HAND_GAP = 3.6;
function interact(kind) {
  if (!Object.prototype.hasOwnProperty.call(ACTS, kind)) return;
  closeActs();
  if (kind === 'hand' && G.hand) { letGo(true); return; }
  if (!near()) { say(G.partner.on ? `走到 ${nameOf(peerK())} 身边才能${ACTS[kind].n}` : `${nameOf(peerK())} 不在家，等 TA 回来再${ACTS[kind].n}`); return; }
  const a = P[meK()], b = P[peerK()], side = a.x <= b.x ? -1 : 1;
  // walk up to them, on the side you are on, at their depth; it plays once you are there
  walkMe(b.x + side * ACTS[kind].gap, b.y, b.fi, { act: kind });
}
const hug = () => interact('hug');
// both phones play it the same way: face each other, then the thing itself
function playAct(kind, by) {
  const a = P.cs, b = P.yy, left = a.x <= b.x, who = P[by] || a, other = who === a ? b : a;
  for (const k of ['cs', 'yy']) {
    const p = P[k], toRight = (k === 'cs') === left;
    p.flip = !toRight; p.el.classList.toggle('hm-flip', p.flip);
    p.el.style.setProperty('--hm-lean', (toRight ? 1 : -1) * (kind === 'kiss' ? 17 : kind === 'hug' ? 12 : 0) + 'deg');
  }
  const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 15.5;
  const pose = (cls, ms) => { for (const p of [a, b]) { p.el.classList.add(cls, 'hm-happy'); clearTimeout(p['t_' + cls]); p['t_' + cls] = setTimeout(() => p.el.classList.remove(cls, 'hm-happy'), ms); } };
  bubble(who, ACTS[kind].say);
  if (kind === 'hug') { pose('hm-hug', 1700); hearts(mx, my, 4); }
  else if (kind === 'kiss') { pose('hm-kiss', 1500); other.el.classList.add('hm-blush'); setTimeout(() => other.el.classList.remove('hm-blush'), 2600); fx(mx, my + 2, '💋'); setTimeout(() => hearts(mx, my, 3), 450); }
  else if (kind === 'five') { pose('hm-five', 900); setTimeout(() => { fx(mx, my + 4, '✨'); bubble(other, '啪！'); }, 260); }
  else if (kind === 'hand') { G.hand = { order: left ? 'cs' : 'yy' }; for (const p of [a, b]) p.el.classList.add('hm-holding'); hearts(mx, my + 6, 1); actsButton(); }
}
function letGo(tell) {
  if (!G.hand) return;
  G.hand = null;
  for (const k of ['cs', 'yy']) if (P[k]) { P[k].el.classList.remove('hm-holding'); P[k].tow = null; }
  if (UI.hheart) UI.hheart.hidden = true;
  if (tell) send('hand', { on: 0 });
  actsButton();
}
// a little line over someone's head
function bubble(p, text) {
  if (!UI.actors || !p) return;
  const e = document.createElement('div'); e.className = 'hm-say'; e.textContent = text;
  const s = depthS(p.y, p.fi < 0 ? 0 : p.fi);
  e.style.left = p.x + '%'; e.style.top = (p.y - 15.5 * s) + '%';
  UI.actors.appendChild(e); setTimeout(() => e.remove(), 2200);
}
function hearts(x, y, n) {
  if (REDUCE || !UI.actors) { fx(x, y, '💞'); return; }
  for (let k = 0; k < n; k++) {
    const e = document.createElement('div'); e.className = 'hm-heart'; e.textContent = k % 3 === 1 ? '💕' : '💗';
    e.style.left = (x + (k - (n - 1) / 2) * 1.6) + '%'; e.style.top = y + '%'; e.style.animationDelay = (k * 140) + 'ms';
    UI.actors.appendChild(e); setTimeout(() => e.remove(), 1700 + k * 140);
  }
}
function wave() {
  const a = P[meK()];
  fx(a.x, a.y - 17, '👋'); handWave(a);
  send('wave', {});
}
function handWave(p) { p.el.classList.add('hm-waving'); clearTimeout(p.tw); p.tw = setTimeout(() => p.el.classList.remove('hm-waving'), 1500); }
// the 💞 button: there when you are next to each other (and while you hold hands, to let go)
function actsButton() {
  if (!UI.hug) return;
  const on = near() || !!G.hand;
  UI.hug.disabled = UI.hug.hidden = !on;
  if (!on) closeActs();
  if (UI.acts) { const b = UI.acts.querySelector('[data-act="hand"]'); if (b) b.innerHTML = G.hand ? '<i>👐</i><span>放手</span>' : '<i>🤝</i><span>牵手</span>'; }
}
function openActs() { if (!UI.acts) return; if (!UI.acts.hidden) return closeActs(); actsButton(); UI.acts.hidden = false; UI.hug.setAttribute('aria-expanded', 'true'); const f = UI.acts.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
function closeActs() { if (UI.acts && !UI.acts.hidden) { UI.acts.hidden = true; if (UI.hug) UI.hug.setAttribute('aria-expanded', 'false'); } }

/* ── the live channel: where the partner is, and what they just did ───────────────────────────── */
function send(t, data) { if (!API || !API.online || !G.open) return false; try { return API.live.send('hm', { v: HOME_V, t, who: CHAR[meK()], ...data }); } catch (e) { return false; } }
function beat() { const a = P[meK()]; if (!a) return; const t = a.path[a.path.length - 1]; send('st', { x: r1(a.x), y: r1(a.y), f: a.fi, tx: t ? r1(t.x) : undefined, ty: t ? r1(t.y) : undefined, tf: t ? t.fi : undefined, dx: a.hv ? a.hv.x : 0, dy: a.hv ? a.hv.y : 0, lv: G.lv }); }
const okX = (x) => typeof x === 'number' && isFinite(x) && x >= -5 && x <= 160;
const okY = (y) => typeof y === 'number' && isFinite(y) && y >= 0 && y <= 100;
const dir1 = (v) => (v === 1 || v === -1 ? v : 0);
function onLive(m) {
  if (!G.open || !m || typeof m !== 'object') return;
  // never trust the wire: our own login on another device is not the partner, and a broken message is dropped
  if (m.who !== CHAR[peerK()]) return;
  if (m.v !== HOME_V) { if (!G.verSaid) { G.verSaid = 1; say(`${nameOf(peerK())} 的 App 版本不一样，两个人都重新打开一下 App`); } return; }
  const b = P[peerK()];
  const wasOn = G.partner.on;
  G.partner.at = Date.now(); G.partner.on = true; G.partner.away = false;
  if (!wasOn) { b.el.classList.remove('hm-off'); if (m.t !== 'bye' && m.t !== 'away') { say(`👋 ${nameOf(peerK())} 回家了`); later(() => { bubble(b, '我回来啦～'); handWave(P[meK()]); }, 400); } }
  // where a message says they are, kept on the floor they are on; how far that is from where this phone has them
  const at = (x, y, f) => { const fi = f === 1 && LVS[G.lv].stairs ? 1 : 0, [cx, cy] = clampPos(x, okY(y) ? y : (fi ? G1 : G0), fi); return { x: cx, y: cy, fi }; };
  const off = (q) => Math.hypot(b.x - q.x, (b.y - q.y) * 1.6) + (b.fi !== q.fi ? 99 : 0);
  const jump = (q) => { b.x = q.x; b.y = q.y; b.fi = q.fi; b.path = []; };
  const toward = (q) => { b.path = route(b, q.x, q.y, q.fi); };
  switch (m.t) {
    case 'hi': if (okX(m.x)) { const q = at(m.x, m.y, m.f); if (!wasOn) jump(q); else if (off(q) > 7) toward(q); } beat(); if (m.lv && m.lv !== G.lv) refreshOwned(); break;
    case 'st': if (b.hv && !m.dx && !m.dy) b.hv = null; if (!b.path.length && !b.hv && okX(m.x)) { const q = at(m.x, m.y, m.f); if (off(q) > 7) toward(q); } if (m.lv && m.lv > G.lv) refreshOwned(); break;
    case 'go': standUp(b); if (okX(m.tx)) { if (okX(m.x)) { const q = at(m.x, m.y, m.f); if (off(q) > 10) jump(q); } b.hv = null; toward(at(m.tx, m.ty, m.tf)); G.lead = 'peer'; } break;
    case 'hold': { standUp(b); const v = { x: dir1(m.dx), y: dir1(m.dy) }; if (okX(m.x)) { const q = at(m.x, m.y, m.f); if (off(q) > 4) jump(q); } b.path = []; b.hv = v.x || v.y ? v : null; G.lead = 'peer'; break; }
    case 'stop': b.hv = null; if (okX(m.x)) toward(at(m.x, m.y, m.f)); break;
    case 'sit': if (Number.isInteger(m.s) && G.seats && G.seats[m.s]) { const q = G.seats[m.s]; b.hv = null; b.path = route(b, q.x, q.y, 0); b.sitWant = m.s; } break;
    case 'up': standUp(b); break;
    case 'act': if (typeof m.k === 'string' && Object.prototype.hasOwnProperty.call(ACTS, m.k)) {
        // they walked up to you: put them where they say (a moment's walk at most), then play it here too
        if (okX(m.x)) { const q = at(m.x, m.y, m.f); if (off(q) > .6) { b.x = q.x; b.y = q.y; b.fi = q.fi; b.path = []; } }
        standUp(b);
        if (P.cs.fi === P.yy.fi && Math.hypot(P.cs.x - P.yy.x, (P.cs.y - P.yy.y) * 1.6) < 14) { standUp(P[meK()]); playAct(m.k, peerK()); }
        else say(`💞 ${nameOf(peerK())} 想${ACTS[m.k].n}，走过去吧`);
      } break;
    case 'hand': if (!m.on) letGo(false); break;
    case 'wave': fx(b.x, b.y - 17, '👋'); handWave(b); say(`👋 ${nameOf(peerK())} 在跟你招手`); break;
    case 'op': if (m.op && typeof m.op === 'object' && ['plant', 'water', 'pick'].includes(m.op.t) && m.op.who === CHAR[peerK()] && Number.isInteger(m.op.pot) && m.op.pot >= 0 && m.op.pot < 6) {
        const op = { t: m.op.t, pot: m.op.pot, id: String(m.op.id || '').slice(0, 24), seed: m.op.seed, who: m.op.who, date: /^\d{4}-\d{2}-\d{2}$/.test(m.op.date || '') ? m.op.date : G.today };
        if (apply(G.view, op)) {
          G.remote.push({ op, at: Date.now() });
          const [x, y] = LVS[G.lv].pots[op.pot] || [b.x, G0];
          if (op.t === 'water') { drops(x, y, peerK()); say(`💧 ${nameOf(peerK())} 浇了水`); }
          if (op.t === 'pick') { fx(x, y - 12, '🧺'); say(`🧺 ${nameOf(peerK())} 收了一朵花 · 宠物 +${PICK_EXP} EXP`); }
          if (op.t === 'plant') { fx(x, y - 10, '🌱'); say(`🌱 ${nameOf(peerK())} 种下了${(SEEDS[op.seed] || {}).n || '新的种子'}`); }
          recompute();
        }
      } break;
    case 'saved': if (Number.isInteger(m.rev) && m.rev > G.srv.rev) loadSave(true); break;
    case 'lv': case 'own': refreshOwned(); break;
    case 'bye': case 'away':
      G.partner.on = false; G.partner.away = true; b.hv = null; b.el.classList.add('hm-off'); letGo(false);
      if (okX(m.x)) { G.partner.last = { x: m.x, ...(okY(m.y) ? { y: m.y } : {}), f: m.f === 1 ? 1 : 0, at: Date.now() }; toward(at(m.x, m.y, m.f)); }
      say(m.t === 'bye' ? `${nameOf(peerK())} 出门了` : `${nameOf(peerK())} 暂时离开了`); break;
  }
  status();
}
async function refreshOwned() {
  try { await API.reloadOwned(); } catch (e) {}
  if (!G.open) return;
  const lv = levelOf();
  if (lv !== G.lv) setLevel(lv, true); else { renderHouse(); renderPanel(); }
  renderCoins();
}

/* ── the frame: ease in, cruise, ease out; transforms only ───────────────────────────────────── */
function stepActor(a, dt, max) {
  if (a.hv && a.fi !== -1 && !a.path.length) return holdStep(a, dt);
  if (a.tow && towStep(a, dt)) return true;
  const t = a.path[0];
  if (!t) { a.vx *= .7; a.vy *= .7; return false; }
  if (t.fi != null && t.fi !== a.fi) a.fi = -1;   // going up or down the stairs
  // a step into the room counts for more than one along it: it is foreshortened
  const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy * 1.6);
  if (REDUCE) { a.x = t.x; a.y = t.y; if (t.fi != null) a.fi = t.fi; a.path.shift(); return true; }
  const want = Math.min(max, d * 6), k = 1 - Math.exp(-10 * dt), ux = d > .01 ? dx / d : 0, uy = d > .01 ? dy / d : 0;
  a.vx += (ux * want - a.vx) * k; a.vy += (uy * want - a.vy) * k;
  a.x += a.vx * dt; a.y += a.vy * dt;
  if (d < .35) { a.x = t.x; a.y = t.y; if (t.fi != null) a.fi = t.fi; a.path.shift(); }
  return true;
}
// Hand in hand, the follower keeps pace: the leader's own speed plus a pull to the spot beside them, so a walk TOWARD
// the follower moves them on ahead instead of walking through them, and nobody is left behind. A first version
// re-planned a path every 180 ms, and since a path slows down as it ends, the leader overtook the follower every time
// (found on a screenshot). Too far, or something in the way: it walks a path instead (together3 finds it).
function towStep(a, dt) {
  // only the one being led is towed: the moment they set off themselves (a tap, the stick, the partner's own walk) they
  // lead, and a tow left over from before would wipe the walk they just started
  const leadK = G.lead === 'peer' && G.partner.on ? peerK() : meK();
  if (!G.hand || a.k === leadK || a.tow.lead.k !== leadK) { a.tow = null; return false; }
  const { lead, side } = a.tow;
  a.tow.clear = false;
  if (lead.fi < 0 || a.fi !== lead.fi || a.sit >= 0) return false;
  const [tx, ty] = clampPos(lead.x + side * HAND_GAP, lead.y, lead.fi), dx = tx - a.x, dy = ty - a.y;
  if (Math.hypot(dx, dy * 1.6) > 7 || !clearLine(a.fi, a.x, a.y, tx, ty)) return false;
  a.tow.clear = true; a.path = [];
  if (REDUCE) { const moved = Math.abs(dx) + Math.abs(dy) > .01; a.x = tx; a.y = ty; a.vx = a.vy = 0; return moved; }
  let vx = lead.vx + dx * 9, vy = lead.vy + dy * 9;
  const sp = Math.hypot(vx, vy * 1.6);
  if (sp > 46) { vx *= 46 / sp; vy *= 46 / sp; }
  a.vx = vx; a.vy = vy;
  [a.x, a.y] = clampPos(a.x + vx * dt, a.y + vy * dt, a.fi);
  return Math.hypot(vx, vy) > 1.5;
}
// holding hands: whoever moved last leads and the other walks beside them (the same rule on both phones, so it looks the
// same on both); standing close and still: you turn to each other, and now and then a heart floats up
function together3(dt) {
  const a = P.cs, b = P.yy;
  if (!a || !b) return;
  if (G.hand) {
    const lead = G.lead === 'peer' && G.partner.on ? P[peerK()] : P[meK()], fol = lead === a ? b : a;
    // the stairs part you (a hand can't be held up a staircase), and so does your partner leaving
    if (!G.partner.on || lead.fi < 0 || (fol.fi >= 0 && lead.fi !== fol.fi)) letGo(false);
    else if (fol.sit >= 0 && lead.path.length) standUp(fol);   // sitting, and they set off: you get up and go with them
    if (G.hand) {
      const side = G.hand.order === fol.k ? -1 : 1, [tx, ty] = clampPos(lead.x + side * HAND_GAP, lead.y, lead.fi);
      lead.tow = null;
      if (!fol.tow || fol.tow.lead !== lead || fol.tow.side !== side) fol.tow = { lead, side, clear: false };
      // kept pace with by towStep when the way is clear; otherwise a path round whatever is between them
      const last = fol.path.length ? fol.path[fol.path.length - 1] : fol;
      const now = performance.now();
      if (!fol.tow.clear && fol.sit < 0 && !fol.hv && (Math.abs(last.x - tx) > .35 || Math.abs(last.y - ty) > .3) && (now - (G.hand.at || 0) > 180 || !fol.path.length)) { G.hand.at = now; fol.path = route(fol, tx, ty, lead.fi); }
      if (UI.hheart) {
        UI.hheart.hidden = false;
        const s = depthS((a.y + b.y) / 2, Math.max(0, a.fi));
        UI.hheart.style.transform = `translate3d(${(((a.x + b.x) / 2) / 100 * G.W).toFixed(1)}px,${((((a.y + b.y) / 2) - 5.6 * s) / 100 * G.H).toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(2)})`;
        UI.hheart.style.zIndex = String(Math.round(Math.max(a.y, b.y) * 10) + 3);
      }
    }
  }
  const still = (p) => !p.path.length && !p.hv && Math.hypot(p.vx, p.vy) < 1 && p.sit < 0;
  if (near() && still(a) && still(b)) {
    // turned to each other
    const left = a.x <= b.x;
    for (const [p, toRight] of [[a, left], [b, !left]]) if (p.flip !== !toRight && !p.el.classList.contains('hm-hug')) { p.flip = !toRight; p.el.classList.toggle('hm-flip', p.flip); }
    G.closeT = (G.closeT || 0) + dt;
    if (G.closeT > 4.5) { G.closeT = 0; if (!REDUCE) hearts((a.x + b.x) / 2, Math.min(a.y, b.y) - 14, 1); }
  } else G.closeT = 0;
}
// the stick or the arrow keys: straight on that way, along the walls, held back by the back part of a wall
function holdStep(a, dt) {
  const n = Math.hypot(a.hv.x, a.hv.y) || 1, wx = a.hv.x / n * 26, wy = a.hv.y / n * 13, k = REDUCE ? 1 : 1 - Math.exp(-12 * dt);
  a.vx += (wx - a.vx) * k; a.vy += (wy - a.vy) * k;
  let [x, y] = clampPos(a.x + a.vx * dt, a.y + a.vy * dt, a.fi);
  [x, y] = wallStop(a.fi, a.x, x, a.y, y);
  if (!blocked(a.x, a.y, a.fi) && blocked(x, y, a.fi)) {   // furniture: slide along it
    if (!blocked(x, a.y, a.fi)) y = a.y; else if (!blocked(a.x, y, a.fi)) x = a.x; else { x = a.x; y = a.y; }
  }
  if (Math.abs(x - a.x) < 1e-4) a.vx = 0;    // against a wall: no speed kept up to burst through
  if (Math.abs(y - a.y) < 1e-4) a.vy = 0;
  a.x = x; a.y = y;
  return true;
}
// transforms only, and only when something changed
function place(a) {
  const s = a.fi === -1 ? .88 : depthS(a.y, a.fi);
  const t = `translate3d(${(a.x / 100 * G.W).toFixed(1)}px,${(a.y / 100 * G.H).toFixed(1)}px,0) translate(-50%,-100%) scale(${s.toFixed(3)})`;
  if (t !== a.tf) { a.tf = t; a.el.style.transform = t; }
  const z = Math.round(a.y * 10) + 2;
  if (z !== a.z) { a.z = z; a.el.style.zIndex = String(z); }
}
function frame(t) {
  G.raf = 0;
  if (!G.open) return;
  if (!G.W) { G.raf = requestAnimationFrame(frame); return; }
  const dt = G.last ? Math.min(.05, (t - G.last) / 1000) : .016; G.last = t;
  for (const k of ['cs', 'yy']) {
    const a = P[k];
    const moving = stepActor(a, dt, 34);
    a.el.classList.toggle('hm-walk', moving && Math.hypot(a.vx, a.vy) > 3);
    if (Math.abs(a.vx) > 2) { const f = a.vx < 0; if (f !== a.flip) { a.flip = f; a.el.classList.toggle('hm-flip', f); } }
    place(a);
    if (k === meK() && !a.path.length && a.after) {
      const af = a.after; a.after = null;
      if (af.op) act(af.op);
      if (af.sit != null && G.seats && G.seats[af.sit]) { a.sit = af.sit; poseSit(a); send('sit', { s: af.sit, x: r1(a.x) }); together(); }
      if (af.act && near()) { playAct(af.act, meK()); send('act', { k: af.act, x: r1(a.x), y: r1(a.y), f: a.fi }); }
    }
    // the partner sits once their walk to the seat is done
    if (k === peerK() && a.sitWant >= 0 && !a.path.length) { a.sit = a.sitWant; a.sitWant = -1; poseSit(a); together(); }
  }
  together3(dt);
  { const a = P.cs, b = P.yy, close = a.fi === b.fi && Math.abs(a.x - b.x) < 7.5 && Math.abs(a.y - b.y) < 3, right = a.x > b.x ? a : b;
    for (const p of [a, b]) { const up = close && p === right; if (p.tagUp !== up) { p.tagUp = up; p.el.classList.toggle('hm-tagup', up); } } }
  // the pet follows whoever moved last (the same rule on both phones, so it is in the same place on both)
  if (pet) {
    const lead = G.lead === 'peer' && G.partner.on ? P[peerK()] : P[meK()];
    const end = lead.path.length ? lead.path[lead.path.length - 1] : lead, lf = end.fi >= 0 ? end.fi : Math.max(0, lead.fi);
    const [b0, f0] = band(lf), bx = lead.x + (lead.flip ? 5.5 : -5.5), by = clamp(lead.y - 1.4, b0, f0);   // a little behind you
    const tgt = pet.path.length ? pet.path[pet.path.length - 1] : pet;
    if (pet.fi !== -1 && (Math.abs(tgt.x - bx) > 3 || Math.abs(tgt.y - by) > 2.5 || (tgt.fi != null ? tgt.fi : pet.fi) !== lf)) pet.path = route(pet, bx, by, lf);
    const pm = stepActor(pet, dt, 40);
    pet.el.classList.toggle('hm-walk', pm && Math.hypot(pet.vx, pet.vy) > 3);
    if (Math.abs(pet.vx) > 2) { const f = pet.vx < 0; if (f !== pet.flip) { pet.flip = f; pet.el.classList.toggle('hm-flip', f); } }
    place(pet);
  }
  camera(dt);
  edges();
  const s = `${where(P.cs)}|${where(P.yy)}|${near()}|${G.partner.on}`;
  if (s !== G.lastStatus) { G.lastStatus = s; status(); }
  G.raf = requestAnimationFrame(frame);
}
// a bigger house is wider than the screen: the view keeps you in its middle part
function camera(dt) {
  const L = LVS[G.lv], vis = G.VW / (G.W / 100), max = L.world - vis, a = P[meK()];
  let t;
  if (max <= 0) t = max / 2;                     // the whole house fits: keep it in the middle
  else {
    t = G.camT == null ? a.x - vis * .45 : G.camT;
    if (a.x - t > vis * .66) t = a.x - vis * .66; else if (a.x - t < vis * .34) t = a.x - vis * .34;
    t = clamp(t, 0, max);
  }
  const first = G.camT == null;
  G.camT = t;
  G.camX = REDUCE || first ? t : G.camX + (t - G.camX) * (1 - Math.exp(-5 * dt));
  if (Math.abs(G.camX - t) < .02) G.camX = t;
  const px = (-G.camX / 100 * G.W).toFixed(1);
  if (px !== G.camPx) { G.camPx = px; UI.world.style.transform = `translate3d(${px}px,0,0)`; UI.hills.style.transform = `translate3d(${(px * .4).toFixed(1)}px,0,0)`; }
}
// the partner outside the view: a little tag at that edge, which walks you to them
function edges() {
  const b = P[peerK()], vis = G.VW / (G.W / 100);
  const side = !G.partner.on ? '' : b.x < G.camX + 2 ? 'l' : b.x > G.camX + vis - 2 ? 'r' : '';
  if (side !== G.edge) {
    G.edge = side;
    UI.edge.hidden = !side;
    if (side) {
      UI.edge.className = 'hm-edge hm-edge-' + side; UI.edge.style.top = (G.top + G.H * .5).toFixed(0) + 'px';
      UI.edge.innerHTML = side === 'l' ? `‹ ${esc(nameOf(peerK()))}` : `${esc(nameOf(peerK()))} ›`;
      UI.edge.setAttribute('aria-label', `${nameOf(peerK())} 在${where(b)}，点一下走过去`);
    }
  }
}
function status() {
  if (!UI.status) return;
  const o = peerK(), a = P[meK()], b = P[o];
  const same = where(a) === where(b);
  let s;
  if (!API.online) s = `你在${where(a)} · 登录后 ${esc(nameOf(o))} 才会一起来`;
  else if (!G.partner.on) { const saved = (G.view.pos || {})[CHAR[o]], heard = G.partner.last, pos = heard && (!saved || heard.at >= saved.at) ? heard : saved; s = `${esc(nameOf(o))} 不在家${pos && pos.at ? ` · 上次在${where({ x: pos.x, fi: pos.f ? 1 : 0 })}` : ''} · 你在${where(a)}`; }
  else s = same ? `和 ${esc(nameOf(o))} 都在${where(a)} 💞` : `你在${where(a)} · ${esc(nameOf(o))} 在${where(b)}`;
  UI.status.innerHTML = `<i class="hm-dot${G.partner.on ? ' on' : ''}"></i><span>${s}</span>`;
  // 💞 互动 shows up when you are next to your partner — it is the thing to do then, and one less button otherwise
  actsButton();
  controls();
}
// the stairs button: only in the two-storey house, and it says which way you'd go
function controls() {
  if (!UI.stairs || !P.cs) return;
  const L = LVS[G.lv], a = P[meK()], up = a.fi !== 1;
  UI.stairs.hidden = !L.stairs;
  UI.stairs.dataset.go = up ? 'up' : 'down';
  UI.stairs.innerHTML = up ? '<i>⬆</i><span>上楼</span>' : '<i>⬇</i><span>下楼</span>';
  UI.stairs.setAttribute('aria-label', up ? '上楼' : '下楼');
}

/* ── level, coins, shop ───────────────────────────────────────────────────────────────────────── */
function setLevel(lv, celebrate) {
  G.lv = lv;
  for (const k of ['cs', 'yy']) if (P[k]) { P[k].sit = -1; P[k].sitWant = -1; }
  for (const a of [P.cs, P.yy, pet].filter(Boolean)) { if (!(a.fi >= 0 && a.fi < LVS[lv].floors.length)) { a.fi = 0; a.y = G0; } [a.x, a.y] = clampPos(a.x, a.y, a.fi); a.path = []; a.after = null; a.hv = null; }
  G.hold = null;
  renderHouse(); onResize(); G.camT = null; renderPanel(); status();
  if (celebrate) { say(`🏠 ${LVS[lv].name}盖好了：${lv === 2 ? '多了卧室和宠物小屋，花园 3 个花盆' : '多了厨房、楼梯、二楼卧室和阳台，池塘也有了'}`); fx(P[meK()].x, P[meK()].y - 18, '🎉'); }
}
function renderCoins() { if (UI.coins) { let c = 0; try { c = API.coins(); } catch (e) {} UI.coins.textContent = `🪙 ${c}`; } }
async function buy(id) {
  const it = HOUSE[id];
  if (!it || owns(id)) return;
  if (it.needs && !owns(it.needs)) return say(`先${HOUSE[it.needs].n}`);
  if (it.fest && !festWin(it.fest, G.today).on) return say(`${FESTS[it.fest].n}的时候才卖`);
  let c = 0; try { c = API.coins(); } catch (e) {}
  if (c < it.price) return say(`🪙 小窝币不够，还差 ${it.price - c} · 收花也能攒`);
  const btn = G.sheet && G.sheet.querySelector(`[data-buy="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  let ok = false;
  try { ok = await API.buy(id, { name: it.n, icon: it.e, price: it.price }); } catch (e) { ok = false; }
  if (!G.open) return;
  if (!ok) { say('没买成，网络好像不太好，再试一次'); renderPanel(); return; }
  renderCoins();
  // a new house is something to look at: the sheet gets out of the way (the shop stays open for more)
  if (it.lv) { closeSheet(); setLevel(levelOf(), true); send('lv', { lv: G.lv }); }
  else { renderHouse(); renderPanel(); say(`${it.e} ${it.n}放好了${it.fest ? `，以后每年${FESTS[it.fest].n}都会摆出来` : ''}`); send('own', { id }); }
}

/* ── the sheets behind the buttons: 玩法 / 花园 / 房子 / 小店 ──────────────────────────────────── */
const SHEETS = {
  help: { t: '❓ 怎么玩', html: () => helpHtml() },
  garden: { t: '🌱 花园', html: () => gardenHtml() },
  house: { t: '🏠 房子', html: () => houseHtml() },
  shop: { t: '🎁 节日小店', html: () => shopHtml() },
};
// an open sheet follows what happens behind it (a flower picked, a partner's upgrade…)
function renderPanel() {
  const k = G.sheetKind;
  if (!G.sheet || !SHEETS[k]) return;
  const body = G.sheet.querySelector('.hm-sheet-body'), top = body.scrollTop;
  body.innerHTML = SHEETS[k].html();
  body.scrollTop = top;
}
function openSheet(kind) {
  const S = SHEETS[kind]; if (!S) return;
  sheetShell(kind, S.t, S.html());
  $$('.hm-mbtn', UI.root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sheet === kind)));
}
function sheetShell(kind, title, html) {
  closeSheet();
  const sh = document.createElement('div');
  sh.className = 'hm-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', title.replace(/^\S+\s/, ''));
  sh.innerHTML = `<div class="hm-sheet-in"><div class="hm-sheet-top"><b>${title}</b><button type="button" class="hm-x" data-a="close-sheet" aria-label="关闭">✕</button></div><div class="hm-sheet-body">${html}</div></div>`;
  sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); });
  UI.root.appendChild(sh); G.sheet = sh; G.sheetKind = kind;
  hideHint();
  return sh;
}
function helpHtml() {
  const o = esc(nameOf(peerK()));
  return `<div class="hm-help">
    <section><h4>👣 走路</h4><p>点地板，就走过去：左右、往里、往外都可以。按住左下角的摇杆，往哪边推就往哪边走（往上推是往屋里走）。走到后面人会小一点，可以走到沙发和桌子后面；房间之间要从靠前的门口过。房子比屏幕大的时候，画面会跟着你走。两层小楼按 ⬆ 上楼 / ⬇ 下楼，或者直接点楼上。</p></section>
    <section class="hm-keys"><h4>⌨️ 电脑键盘</h4><p><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 按住走路（两个一起按是斜着走）· <kbd>F</kbd> 上下楼 · <kbd>空格</kbd> 下一步 · <kbd>E</kbd> 浇水 / 收花 / 种花 · <kbd>H</kbd> 抱抱 · <kbd>L</kbd> 牵手 / 放手 · <kbd>J</kbd> 招手 · <kbd>K</kbd> 坐下 · <kbd>1</kbd>–<kbd>4</kbd> 玩法 / 花园 / 房子 / 小店 · <kbd>Esc</kbd> 关掉</p></section>
    <section><h4>🌱 种花</h4><p>点空花盆选种子，种子不用买。<b>每人每天给每盆花浇一次水</b>，你和 ${o} 都浇的那天长两格，长满 5 格开花：一个人要 5 天，两个人一起 3 天。<b>三天没人浇会蔫</b>，浇一下就好（那一次不长）。</p>
      <p>开了花点一下收进图鉴：宠物 <b>+${PICK_EXP} EXP</b>，小窝币 <b>+${PICK_EXP / 2}</b>。收满 3 / 6 / 10 / 15 朵会解锁新种子；节日还有限定种子。</p></section>
    <section><h4>💞 一起</h4><p>两个人都打开「我们的家」的时候，对方手机上马上看到你走路、浇水、收花。走到 ${o} 身边点 💞 互动：抱抱、亲亲、击掌、牵手（牵着手谁走，另一个就跟着走）；客厅有沙发就能一起 🛋️ 坐下。宠物跟着最后走动的那个人。</p></section>
    <section><h4>🏠 房子</h4><p>客厅就是你们的小窝，家具摆在哪这里就在哪。在「🏠 房子」里用小窝币升级成小平房、两层小楼（和小窝的家具同一个钱包）。</p></section>
    <section><h4>🎁 节日</h4><p>节日那几天，家里自己换上节日的样子。「🎁 小店」卖节日装饰，买了以后每年这个节日都会自己摆出来。</p></section>
  </div>`;
}
function gardenHtml() {
  const L = LVS[G.lv], v = G.view, o = esc(nameOf(peerK()));
  const rows = L.pots.map((_, i) => {
    const q = potInfo(i);
    let what, today, cls = '';
    if (q.empty) { what = '空花盆'; today = '点一下种花'; cls = ' hm-pr-empty'; }
    else {
      const steps = Array.from({ length: 5 }, (_, k) => `<i class="${k < q.g.stage ? 'on' : ''}"></i>`).join('');
      what = `${q.seed.e} ${q.seed.n}<span class="hm-steps" aria-label="长到第 ${q.g.stage} 格，共 5 格">${steps}</span>`;
      today = q.bloom ? '开花了 · 点一下收' : q.g.wilted ? '蔫了 · 快浇水救救它' : `今天：你${q.mine ? ' 💧' : ' 还没浇'} · ${o}${q.theirs ? ' 💧' : ' 还没浇'}`;
      if (q.bloom) cls = ' hm-pr-bloom'; else if (q.g.wilted) cls = ' hm-pr-wilt'; else if (q.thirsty) cls = ' hm-pr-thirsty';
    }
    return `<button type="button" class="hm-prow${cls}" data-pot="${i}"><span class="hm-pn">${i + 1}</span><span class="hm-pw">${what}</span><span class="hm-pt">${today}</span></button>`;
  }).join('');
  const album = SEED_ORDER.map(k => {
    const s = SEEDS[k], n = v.album[k] || 0, st = seedState(k, G.today);
    return `<div class="hm-alb${n ? ' got' : ''}${st.ok ? '' : ' locked'}"><span class="hm-ae" aria-hidden="true">${potSvg({ seed: k, w: {} }, { stage: 5 }, false)}</span><b>${s.n}</b><span>${n ? `收了 ${n} 朵` : st.ok ? (s.fest ? `${FESTS[s.fest].n}限定 · 现在能种` : '现在能种') : st.why}</span></div>`;
  }).join('');
  return `<p class="hm-how">点一盆花，就走过去浇水、种花或者收花。每人每天每盆浇一次，<b>两个人都浇长得更快</b>；三天没人浇会蔫。开花收进图鉴：宠物 <b>+${PICK_EXP} EXP</b>，小窝币 +${PICK_EXP / 2}。</p>
    <div class="hm-prows">${rows}</div>
    <div class="hm-go2"><button type="button" class="hm-wide" data-go="garden">🌷 走去花园</button><button type="button" class="hm-wide" data-go="living">🛋️ 回客厅</button></div>
    <div class="hm-sumline">🌸 一共收了 <b>${v.picked || 0}</b> 朵花${(v.log || []).length ? ` · 最近一朵：${esc(nameOf(KEY[v.log[v.log.length - 1][1]] || 'cs'))} 收的${(SEEDS[v.log[v.log.length - 1][2]] || {}).n || '花'}` : ''}</div>
    <h4 class="hm-h4">花园图鉴</h4><div class="hm-albs">${album}</div>`;
}
function houseHtml() {
  let c = 0; try { c = API.coins(); } catch (e) {}
  const lvRow = (lv) => {
    const L = LVS[lv], id = lv === 2 ? 'hm_lv2' : lv === 3 ? 'hm_lv3' : '', it = HOUSE[id];
    const have = lv <= G.lv, next = lv === G.lv + 1;
    const desc = lv === 1 ? '客厅（就是你们的小窝）和一个 2 盆花的小花园' : it.tip;
    const btn = have ? `<span class="hm-have">${lv === G.lv ? '现在住这里' : '住过 ✓'}</span>`
      : next ? `<button type="button" class="hm-buy" data-buy="${id}"${c < it.price ? ' disabled' : ''}>${c < it.price ? `还差 🪙 ${it.price - c}` : `升级 🪙 ${it.price}`}</button>`
      : `<span class="hm-have">先升到 Lv${lv - 1}</span>`;
    return `<div class="hm-lvc${have ? ' have' : ''}${lv === G.lv ? ' cur' : ''}"><b>Lv${lv} ${L.name}</b><span>${desc}</span>${btn}</div>`;
  };
  return `<div class="hm-lvs">${[1, 2, 3].map(lvRow).join('')}</div>
    <p class="hm-how">升级用小窝币，和小窝的家具是同一个钱包：宠物长大会攒，花园收花也会攒。两个人谁升级都一样，房子是你们两个的。</p>
    <button type="button" class="hm-wide" data-a="nest">🛋️ 布置客厅（打开小窝摆家具）</button>`;
}
function shopHtml() {
  let c = 0; try { c = API.coins(); } catch (e) {}
  const on = Object.keys(FESTS).filter(f => festWin(f, G.today).on);
  const items = Object.keys(HOUSE).filter(id => !HOUSE[id].lv && (!HOUSE[id].fest || on.includes(HOUSE[id].fest)));
  const stored = Object.keys(HOUSE).filter(id => HOUSE[id].fest && !on.includes(HOUSE[id].fest) && owns(id));
  const card = (id) => {
    const it = HOUSE[id], have = owns(id), w = it.fest ? festWin(it.fest, G.today) : null, poor = c < it.price;
    const tags = [it.fest ? (w.on ? `<span class="hm-tagx">${FESTS[it.fest].n}限定 · 还有 ${w.left} 天</span>` : `<span class="hm-tagx">${FESTS[it.fest].n}</span>`) : '', have && it.fest ? `<span class="hm-tagx keep">每年${FESTS[it.fest].n}摆出来</span>` : ''].join('');
    const label = have ? '已经是你们的 ✓' : poor ? `还差 🪙 ${it.price - c}` : `买 🪙 ${it.price}`;
    return `<div class="hm-item"><span class="hm-em">${it.e}</span><b>${it.n}</b>${it.tip ? `<span class="hm-tip">${it.tip}</span>` : ''}<div class="hm-tags">${tags}</div><button type="button" class="hm-buy" data-buy="${id}"${have || poor || (it.fest && !w.on) ? ' disabled' : ''}>${label}</button></div>`;
  };
  const seeds = SEED_ORDER.filter(k => SEEDS[k].fest && festWin(SEEDS[k].fest, G.today).on);
  const next = nextFest();
  return `<p class="hm-how">${on.length ? `${on.map(f => FESTS[f].e + ' ' + FESTS[f].n).join('、')}的节日小店开了：限定的东西只在这几天卖，买了以后每年这个节日自己摆出来。到了节日那天，家里还会自己换上节日的样子。` : `平常日子也有能买的东西。${next ? `下一个节日：${FESTS[next.id].e} ${FESTS[next.id].n}，还有 ${next.in} 天开卖。` : ''}`}</p>
    ${seeds.length ? `<p class="hm-how">🌱 ${seeds.map(k => SEEDS[k].n).join('、')}种子现在可以种（不用买，点空花盆就能选）。</p>` : ''}
    <div class="hm-items">${items.map(card).join('')}</div>
    ${stored.length ? `<p class="hm-how">📦 收起来的节日装饰，到时候自己摆出来：${stored.map(id => `${HOUSE[id].e} ${HOUSE[id].n}（${FESTS[HOUSE[id].fest].n}）`).join('、')}</p>` : ''}`;
}
// the next festival whose shop is not open yet, and how many days until it opens (a week before it)
function nextFest() {
  for (let i = 1; i <= 400; i++) {
    const t = themesAt(addDays(G.today, i)).find(t => !festWin(t.id, G.today).on);
    if (t) return { id: t.id, in: Math.max(1, i - 7) };
  }
  return null;
}
// the seed picker, over the house
function openSeeds(i) {
  const opts = SEED_ORDER.map(k => ({ k, s: SEEDS[k], st: seedState(k, G.today) }));
  const sh = sheetShell('seeds', `🌱 ${i + 1} 号花盆种什么？`,
    `<div class="hm-seeds">${opts.map(({ k, s, st }) => `<button type="button" class="hm-seed" data-seed="${k}" data-pot-i="${i}"${st.ok ? '' : ' disabled'}><span class="hm-ae" aria-hidden="true">${potSvg({ seed: k, w: {} }, { stage: 5 }, false)}</span><b>${s.n}</b><span>${st.ok ? (s.fest ? `${FESTS[s.fest].n}限定` : s.tip || '每天浇水') : st.why}</span></button>`).join('')}</div>
    <p class="hm-how">种子不用买。种下以后每天浇水，${esc(nameOf(peerK()))} 也浇会长得更快。</p>`);
  const first = sh.querySelector('.hm-seed:not([disabled])'); if (first) first.focus();
}
function closeSheet() {
  if (G.sheet) { G.sheet.parentNode && G.sheet.parentNode.removeChild(G.sheet); G.sheet = null; G.sheetKind = ''; }
  if (UI.root) $$('.hm-mbtn', UI.root).forEach(b => b.setAttribute('aria-pressed', 'false'));
}

/* ── styles (scoped: every class starts with hm-, §1.1) ───────────────────────────────────────── */
function css() {
  if (document.getElementById('hm-style')) return;
  const st = document.createElement('style'); st.id = 'hm-style';
  st.textContent = `
.hm-root[hidden],.hm-root [hidden]{display:none!important}
.hm-root{--hm-ink:#3A2F4F;--hm-sub:#5E5378;--hm-line:rgba(150,120,190,.26);--hm-solid:#FFFFFF;--hm-glass:rgba(255,255,255,.88);--hm-sh:0 6px 16px -9px rgba(60,40,110,.55);--hm-pink:#E0508F;--hm-pink-ink:#B23A72;--hm-pink-soft:#FFE3EE;--hm-blue-ink:#2D65A3;--hm-blue-soft:#E1ECFA;--hm-mint:#2F8A5C;--hm-mint-soft:#E2F5EA;--hm-gold:#9A5C12;--hm-gold-soft:#FFF1D6;--hm-sky1:#A7D8F5;--hm-sky2:#E4F4FC;--hm-grass1:#9BD08A;--hm-grass2:#7DBE74;--hm-u:4px;
  position:fixed;inset:0;z-index:150;overflow:hidden;color:var(--hm-ink);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
html[data-theme="dark"] .hm-root{--hm-ink:#F0EAF8;--hm-sub:#CFC5E6;--hm-line:rgba(190,170,230,.24);--hm-solid:#2E284A;--hm-glass:rgba(40,34,68,.88);--hm-sh:0 6px 16px -9px rgba(0,0,0,.8);--hm-pink:#FF7FB0;--hm-pink-ink:#FFA3C8;--hm-pink-soft:rgba(255,127,176,.18);--hm-blue-ink:#A6CBFF;--hm-blue-soft:rgba(127,176,240,.18);--hm-mint:#8FE0B4;--hm-mint-soft:rgba(127,216,168,.16);--hm-gold:#FFC266;--hm-gold-soft:rgba(255,194,102,.16);--hm-grass1:#8CC47D;--hm-grass2:#6FAE67}
@media (prefers-reduced-motion:no-preference){.hm-root{animation:hm-in .28s ease-out}}
@keyframes hm-in{from{opacity:0}}
:where(.hm-root) button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.hm-root button:focus-visible,.hm-scene:focus-visible,.hm-pot:focus-visible{outline:3px solid #3F7FC4;outline-offset:2px}
/* the screen: sky, a strip of lawn under everything, and the house standing on it */
.hm-scene{position:absolute;inset:0;overflow:hidden;cursor:pointer;background:linear-gradient(180deg,var(--hm-sky1),var(--hm-sky2) 78%);contain:layout paint}
.hm-scene.hm-dusk{background:linear-gradient(180deg,#F6A98C,#FFE3C9 78%)}
.hm-scene.hm-night{background:linear-gradient(180deg,#121637,#2B2D63 78%)}
.hm-sky{position:absolute;left:0;right:0;pointer-events:none}
.hm-skyfx{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.hm-ground{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,var(--hm-grass1),var(--hm-grass2))}
.hm-night .hm-ground{background:linear-gradient(180deg,#3E6E52,#2F5A44)}
.hm-s-winter .hm-ground{background:linear-gradient(180deg,#DDEBD8,#BFD8BC)}
.hm-night.hm-s-winter .hm-ground{background:linear-gradient(180deg,#5B7A70,#4A665E)}
.hm-f-xmas .hm-ground{background:linear-gradient(180deg,#FFFFFF,#E9F1FA)}
.hm-night.hm-f-xmas .hm-ground{background:linear-gradient(180deg,#D3DBE8,#BFC9D9)}
.hm-band{position:absolute;left:0;top:0;width:100px;height:75px}
.hm-lay{position:absolute;inset:0;will-change:transform}
.hm-abs{position:absolute}
.hm-unsized .hm-band,.hm-unsized .hm-ground,.hm-unsized .hm-sky{display:none}
.hm-sun{position:absolute;right:8%;top:10%;width:clamp(34px,10vmin,64px);aspect-ratio:1;border-radius:50%;background:#FFE58F;box-shadow:0 0 0 10px rgba(255,229,143,.35)}
.hm-dusk .hm-sun{top:46%;background:#FFB36B;box-shadow:0 0 0 10px rgba(255,170,100,.3)}
.hm-night .hm-sun{background:#F4EDCA;box-shadow:0 0 0 8px rgba(244,237,202,.15)}
.hm-scene.hm-f-midautumn.hm-night .hm-sun{width:clamp(56px,16vmin,104px);background:#FFE08A;box-shadow:0 0 26px 10px rgba(255,214,120,.5)}
.hm-cloud{position:absolute;height:clamp(14px,3.8vmin,28px);border-radius:99px;background:rgba(255,255,255,.85)}
.hm-cloud::before,.hm-cloud::after{content:'';position:absolute;border-radius:50%;background:inherit}
.hm-cloud::before{width:42%;aspect-ratio:1;left:14%;bottom:30%}
.hm-cloud::after{width:30%;aspect-ratio:1;left:50%;bottom:25%}
.hm-night .hm-cloud{background:rgba(160,170,220,.22)}
.hm-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#FFF8DC;display:none}
.hm-night .hm-star{display:block}
.hm-hill{border-radius:50% 50% 0 0;background:rgba(150,205,140,.75)}
.hm-night .hm-hill{background:rgba(70,110,90,.7)}
.hm-rn{transform:translate(-50%,-50%);font-size:clamp(9px,calc(var(--hm-u) * 1.6),14px);font-weight:800;line-height:1.5;color:#6B4A30;background:#FFF6EA;border:1.5px solid #C99B74;padding:0 6px;border-radius:8px;white-space:nowrap;z-index:8;pointer-events:none}
.hm-night .hm-rn{background:#E9D8C4;color:#4A3322}
.hm-mwin{position:absolute;right:10%;top:12%;width:calc(var(--hm-mh,60px) * .48);height:calc(var(--hm-mh,60px) * .40);border-radius:6px;border:2px solid rgba(255,255,255,.8);background:linear-gradient(180deg,#BFE4FF,#EAF6FF);box-shadow:0 2px 6px rgba(0,0,0,.1);z-index:1}
.hm-pwall{position:absolute;left:5%;top:2.5%;width:56%;height:24%;z-index:1;pointer-events:none;display:flex;justify-content:space-evenly;align-items:flex-start;border-top:1.5px solid rgba(130,90,60,.5);border-radius:50% 50% 0 0/18% 18% 0 0}
.hm-pol{position:relative;width:calc(var(--hm-mh,60px) * .19);background:#FFFDF8;padding:calc(var(--hm-mh,60px) * .012) calc(var(--hm-mh,60px) * .012) calc(var(--hm-mh,60px) * .036);margin-top:calc(var(--hm-mh,60px) * .03);box-shadow:0 2px 4px rgba(0,0,0,.2);transform:rotate(calc((var(--i) - (var(--n) - 1) / 2) * 5deg));transform-origin:50% 0}
.hm-pol::before{content:"";position:absolute;left:50%;top:calc(var(--hm-mh,60px) * -.024);width:calc(var(--hm-mh,60px) * .022);height:calc(var(--hm-mh,60px) * .05);transform:translateX(-50%);border-radius:2px;background:#E9A86B}
.hm-pol i{display:block;width:100%;aspect-ratio:1;background:#EADFD3 center/cover no-repeat}
.hm-mwin i{position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.75) 0 0) 50% 0/2px 100% no-repeat,linear-gradient(rgba(255,255,255,.75) 0 0) 0 50%/100% 2px no-repeat}
.hm-dusk .hm-mwin{background:linear-gradient(180deg,#FFC48A,#FFE0C0)}
.hm-night .hm-mwin{background:linear-gradient(180deg,#1B2450,#2E3B72)}
.hm-mp{position:absolute;transform:translate(-50%,-100%);pointer-events:none;line-height:0}
.hm-mp .decor-svg,.hm-mp svg{width:1em;height:1em;display:block;overflow:visible}
.hm-mpf{filter:drop-shadow(0 2px 1.5px rgba(60,30,20,.28))}
.hm-mpe{font-size:1em;line-height:1}
/* the house in 3D: one drawing, then what stands on the floors (ordered by how far forward it stands, among the two of you) */
.hm-svg{position:absolute;left:0;top:0;height:100%;overflow:visible;pointer-events:none}
.hm-props{position:absolute;inset:0}
.hm-bwall{overflow:hidden;pointer-events:none}
.hm-night .hm-bwall{filter:brightness(.8) saturate(.92)}
.hm-night .hm-props .hm-mpf{filter:brightness(.84) drop-shadow(0 2px 1.5px rgba(0,0,0,.3))}
.hm-night .hm-props .hm-thing:not(.hm-glows){filter:brightness(.8)}
.hm-rail3{pointer-events:none;background:linear-gradient(#FFF8EE,#FFF8EE) 0 0/100% 15% no-repeat,repeating-linear-gradient(90deg,#FFF8EE 0 1.1%,transparent 1.1% 4.4%);filter:drop-shadow(0 1px 1px rgba(80,50,30,.3))}
.hm-night .hm-rail3{filter:brightness(.6)}
.hm-smoke{width:0;height:0;pointer-events:none}
.hm-smoke i{position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.75);opacity:0}
.hm-night .hm-smoke i{background:rgba(200,200,230,.35)}
@media (prefers-reduced-motion:no-preference){.hm-smoke i{animation:hm-smoke 4.2s ease-out infinite}.hm-smoke i:nth-child(2){animation-delay:-1.4s}.hm-smoke i:nth-child(3){animation-delay:-2.8s}}
@keyframes hm-smoke{0%{transform:translate(0,0) scale(.5);opacity:0}15%{opacity:.7}100%{transform:translate(16px,-48px) scale(1.9);opacity:0}}
.hm-thing{transform:translate(-50%,-100%);pointer-events:none}
.hm-clock{width:calc(var(--hm-u) * 3.4);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:#FFFDF8;border:max(2px,calc(var(--hm-u) * .42)) solid #C99B74;box-shadow:0 1px 3px rgba(60,40,20,.3),inset 0 -2px 3px rgba(120,90,60,.15);pointer-events:none;box-sizing:border-box}
.hm-night .hm-clock{background:#E5DCCD;border-color:#8E6E52}
.hm-clock i{position:absolute;left:50%;bottom:50%;width:2px;margin-left:-1px;height:28%;background:#5A4A3A;border-radius:1px;transform-origin:50% 100%}
.hm-clock i+i{height:40%;width:1.5px;margin-left:-.75px}
.hm-clock::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#5A4A3A}
.hm-bird{position:absolute;left:-6%;width:14px;height:6px;border-top:2.5px solid rgba(70,80,110,.6);border-radius:50% 50% 0 0;opacity:.9}
.hm-bird::after{content:'';position:absolute;left:12px;top:-2.5px;width:14px;height:6px;border-top:2.5px solid rgba(70,80,110,.6);border-radius:50% 50% 0 0}
.hm-dusk .hm-bird,.hm-dusk .hm-bird::after{border-top-color:rgba(90,50,60,.6)}
.hm-fly{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#FFF6B8;box-shadow:0 0 8px 3px rgba(255,236,140,.7);pointer-events:none;opacity:0}
.hm-bfly{position:absolute;font-size:clamp(10px,calc(var(--hm-u) * 1.9),18px);pointer-events:none}
@media (prefers-reduced-motion:no-preference){
  .hm-bird{animation:hm-birdfly 24s linear infinite}.hm-bird2{animation-duration:31s}
  .hm-fly{animation:hm-glowfly 3.6s ease-in-out infinite}
  .hm-bfly{animation:hm-flutter 7s ease-in-out infinite}
  .hm-tree svg{transform-origin:50% 96%;animation:hm-breeze 6.5s ease-in-out infinite}
}
@keyframes hm-birdfly{0%{transform:translateX(0) translateY(0)}50%{transform:translateX(60vw) translateY(-14px)}100%{transform:translateX(120vw) translateY(4px)}}
@keyframes hm-glowfly{0%,100%{opacity:0;transform:translate(0,0)}30%{opacity:1}60%{opacity:.85;transform:translate(14px,-10px)}80%{opacity:.2;transform:translate(6px,-16px)}}
@keyframes hm-flutter{0%,100%{transform:translate(0,0) scaleX(1)}25%{transform:translate(18px,-12px) scaleX(-1)}50%{transform:translate(34px,-2px) scaleX(1)}75%{transform:translate(14px,8px) scaleX(-1)}}
@keyframes hm-breeze{0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.4deg)}}
.hm-thing svg{width:100%;height:auto;display:block;overflow:visible}
.hm-s-spring .hm-tree .hm-leaf{fill:#9FD39A}.hm-s-spring .hm-tree .hm-fruit{fill:#FFB3CB;r:4.4px}
.hm-s-autumn .hm-tree .hm-leaf{fill:#F0A04B;stroke:#B8692A}.hm-s-autumn .hm-tree .hm-leaf-top{fill:#F5B85A}.hm-s-autumn .hm-tree .hm-fruit{fill:#D9534F}
.hm-s-winter .hm-tree .hm-leaf{fill:#E9F1F7;stroke:#A9BCCB}.hm-s-winter .hm-tree .hm-fruit{fill:#FFFFFF}
.hm-pot{position:absolute;transform:translate(-50%,-100%) scale(var(--s,1));transform-origin:50% 100%;width:7%;cursor:pointer;pointer-events:auto}
.hm-pot svg{width:100%;height:auto;display:block;overflow:visible;pointer-events:none}
.hm-pot.hm-thirsty::after,.hm-pot.hm-bloom::after,.hm-pot.hm-empty::after{content:'💧';position:absolute;left:50%;top:-28%;transform:translateX(-50%);font-size:clamp(10px,calc(var(--hm-u) * 2.4),22px);pointer-events:none}
.hm-pot.hm-bloom::after{content:'🧺';top:-46%}
.hm-pot.hm-empty::after{content:'＋';top:-6%;font-weight:900;color:#7A4E35;font-size:clamp(12px,calc(var(--hm-u) * 2.8),26px)}
@media (prefers-reduced-motion:no-preference){.hm-pot.hm-thirsty::after,.hm-pot.hm-bloom::after{animation:hm-hint 1.4s ease-in-out infinite}}
@keyframes hm-hint{50%{transform:translate(-50%,-4px)}}
.hm-pot::before{content:'';position:absolute;left:50%;top:62%;width:150%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;z-index:-1;opacity:0;pointer-events:none;transition:opacity .4s}
.hm-pot.hm-thirsty::before{opacity:1;background:radial-gradient(closest-side,rgba(150,210,255,.85),rgba(150,210,255,0))}
@media (prefers-reduced-motion:no-preference){.hm-pot.hm-thirsty::before{animation:hm-thirst 1.8s ease-in-out infinite}}
@keyframes hm-thirst{50%{transform:translate(-50%,-50%) scale(1.18);opacity:.5}}
.hm-night .hm-pot.hm-bloom::before,.hm-night .hm-pot.hm-glow-moon.hm-grown::before{opacity:1;width:210%;top:30%;background:radial-gradient(closest-side,var(--hm-glow),rgba(255,255,255,0));animation:none}
.hm-night .hm-pot.hm-bloom svg,.hm-night .hm-pot.hm-glow-moon.hm-grown svg{filter:drop-shadow(0 0 5px var(--hm-glow))}
.hm-pot.hm-wet .hm-soil{fill:#4A2E22}
.hm-pot.hm-wilt .hm-plant{transform:rotate(16deg);transform-origin:50% 62%;filter:saturate(.35) brightness(.92)}
.hm-pmark{position:absolute;right:-8%;bottom:30%;width:24%;aspect-ratio:1;border-radius:50%;box-shadow:0 0 0 2px #fff;pointer-events:none}
.hm-drop{z-index:4000;width:1.2%;aspect-ratio:.7;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#7FB2EC;pointer-events:none}
@media (prefers-reduced-motion:no-preference){.hm-drop{animation:hm-fall .7s ease-in forwards}}
@keyframes hm-fall{to{transform:translateY(160%);opacity:0}}
.hm-actors{pointer-events:none}
.hm-ch,.hm-pet{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;transform-origin:50% 100%}
.hm-ch{width:9%;transition:opacity .4s}
.hm-ch.hm-off{opacity:.45}
.hm-pet{width:6.6%}
.hm-ch svg,.hm-pet svg{width:100%;height:auto;display:block;overflow:visible}
.hm-pet svg{margin-bottom:-4%}
.hm-ch .hm-bd{transform-origin:50% 90%}
.hm-ch.hm-flip .hm-face,.hm-pet.hm-flip .hm-pin{transform:scaleX(-1);transform-origin:50% 50%}
@media (prefers-reduced-motion:no-preference){
  .hm-ch.hm-walk .hm-bd{animation:hm-bob .36s ease-in-out infinite}
  .hm-ch.hm-walk .hm-f1{animation:hm-step .36s ease-in-out infinite}.hm-ch.hm-walk .hm-f2{animation:hm-step .36s ease-in-out -.18s infinite}
  .hm-ch:not(.hm-walk):not(.hm-off) .hm-bd{animation:hm-breathe 3.2s ease-in-out infinite}
  .hm-pet.hm-walk .hm-pin{animation:hm-hop .3s ease-in-out infinite}
  .hm-pet.hm-flip.hm-walk .hm-pin{animation-name:hm-hopf}
}
.hm-ch.hm-hug .hm-bd,.hm-ch.hm-kiss .hm-bd{animation:none!important;transform:rotate(var(--hm-lean,0deg));transition:transform .35s cubic-bezier(.3,1.5,.5,1)}
.hm-ch .hm-eyes{transform-origin:50px 50px}
.hm-ch .hm-joyeyes{display:none}
.hm-ch.hm-happy .hm-eyes{display:none}.hm-ch.hm-happy .hm-joyeyes{display:inline}
.hm-ch .hm-cheek{opacity:.55;transition:opacity .4s}.hm-ch.hm-blush .hm-cheek,.hm-ch.hm-kiss .hm-cheek{opacity:1}
.hm-ch .hm-hl{transform-origin:16px 64px}.hm-ch .hm-hr{transform-origin:84px 64px;transition:transform .22s ease-out}
.hm-ch.hm-five .hm-hr{transform:rotate(-115deg)}
.hm-ch.hm-holding .hm-hr{transform:rotate(-28deg)}
@media (prefers-reduced-motion:no-preference){
  .hm-ch .hm-eyes{animation:hm-blink 5.4s infinite}.hm-ch[data-k="yy"] .hm-eyes{animation-delay:-2.3s;animation-duration:6.1s}
  .hm-ch.hm-waving .hm-hr{animation:hm-wavehand .32s ease-in-out 4 alternate}
  .hm-heart{animation:hm-heartup 1.6s ease-out forwards}
  .hm-say{animation:hm-sayin .22s ease-out}
}
@keyframes hm-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes hm-wavehand{from{transform:rotate(-30deg)}to{transform:rotate(-95deg)}}
@keyframes hm-heartup{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}20%{opacity:1;transform:translate(-50%,-80%) scale(1)}100%{opacity:0;transform:translate(-50%,-260%) scale(.9)}}
@keyframes hm-sayin{from{opacity:0;transform:translate(-50%,-80%) scale(.8)}}
.hm-heart{position:absolute;transform:translate(-50%,-50%);font-size:clamp(12px,calc(var(--hm-u) * 2.6),24px);pointer-events:none;z-index:5000}
.hm-hheart{position:absolute;left:0;top:0;font-size:clamp(10px,calc(var(--hm-u) * 1.9),18px);pointer-events:none;will-change:transform}
@media (prefers-reduced-motion:no-preference){.hm-hheart{animation:hm-beat 1.1s ease-in-out infinite}}
@keyframes hm-beat{50%{opacity:.75}}
.hm-say{position:absolute;transform:translate(-50%,-100%);background:var(--hm-solid);color:var(--hm-ink);font-weight:800;font-size:clamp(11px,calc(var(--hm-u) * 1.7),15px);line-height:1.3;padding:4px 10px;border-radius:12px;box-shadow:0 4px 12px -4px rgba(0,0,0,.4);white-space:nowrap;pointer-events:none;z-index:5001}
.hm-say::after{content:'';position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:inherit;transform:translateX(-50%) rotate(45deg)}
.hm-acts{position:absolute;z-index:21;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(92px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border-radius:20px;background:var(--hm-glass);box-shadow:var(--hm-sh);width:min(220px,calc(100% - 24px));box-sizing:border-box}
.hm-actb{min-height:52px;border:0;border-radius:14px;background:var(--hm-pink-soft);display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;font-size:14px}
.hm-actb i{font-style:normal;font-size:20px}
@media (prefers-reduced-motion:no-preference){.hm-acts:not([hidden]){animation:hm-up .18s ease-out}}
@keyframes hm-bob{50%{transform:translateY(-3.5px) rotate(-2.5deg)}}
@keyframes hm-step{50%{transform:translateY(-6px)}}
@keyframes hm-breathe{50%{transform:scale(1.015,.985)}}
@keyframes hm-hop{50%{transform:translateY(-3px)}}
@keyframes hm-hopf{0%,100%{transform:scaleX(-1)}50%{transform:scaleX(-1) translateY(-3px)}}
.hm-cin{position:relative}
.hm-ch.hm-sit .hm-cin{transform:translateY(calc(var(--hm-lift,0px) * -1))}
.hm-ch.hm-sit .hm-shadow{opacity:0}
.hm-ch.hm-sit .hm-bd{animation:none!important}
.hm-tag{position:absolute;left:50%;top:-21px;transform:translateX(-50%);font-size:clamp(10px,calc(var(--hm-u) * 1.5),13px);font-weight:800;padding:1px 7px;border-radius:9px;background:var(--hm-solid);color:var(--hm-ink);white-space:nowrap;max-width:9em;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px -3px rgba(0,0,0,.4)}
.hm-ch.hm-me .hm-tag{background:var(--hm-ink);color:var(--hm-solid)}
.hm-ch.hm-tagup .hm-tag{top:-42px}.hm-ch.hm-tagup .hm-you{top:-59px}
.hm-you{display:none;position:absolute;left:50%;top:-38px;transform:translateX(-50%);color:var(--hm-pink);font-size:13px;line-height:1}
.hm-ch.hm-me .hm-you{display:block}
@media (prefers-reduced-motion:no-preference){.hm-ch.hm-me .hm-you{animation:hm-youbob 1s ease-in-out infinite}}
@keyframes hm-youbob{50%{transform:translate(-50%,-4px)}}
.hm-pop{position:absolute;transform:translate(-50%,-100%);font-size:clamp(16px,calc(var(--hm-u) * 4),34px);pointer-events:none;z-index:5000}
@media (prefers-reduced-motion:no-preference){.hm-pop{animation:hm-popup 1.2s ease-out forwards}}
@keyframes hm-popup{from{opacity:0;margin-top:0}20%{opacity:1}to{opacity:0;margin-top:-40px}}
.hm-mark{width:7%;aspect-ratio:3.2;border-radius:50%;border:3px solid var(--hm-pink);transform:translate(-50%,-50%);pointer-events:none;z-index:5}
@media (prefers-reduced-motion:no-preference){.hm-mark{animation:hm-ring .7s ease-out forwards}}
@keyframes hm-ring{from{opacity:1;transform:translate(-50%,-50%) scale(.5)}to{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
.hm-toast{position:absolute;left:50%;top:120px;transform:translateX(-50%);background:var(--hm-solid);color:var(--hm-ink);font-weight:800;font-size:13px;padding:6px 14px;border-radius:99px;box-shadow:0 6px 16px -8px rgba(0,0,0,.5);z-index:30;pointer-events:none;max-width:calc(100% - 32px);text-align:center;line-height:1.4}
.hm-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 32px));box-sizing:border-box;background:var(--hm-solid);color:var(--hm-ink);border-radius:22px;padding:16px 18px;box-shadow:0 18px 40px -18px rgba(40,20,80,.7);z-index:25;cursor:default}
.hm-hint > b{display:block;font-size:19px;text-align:center;margin-bottom:8px}
.hm-hint ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.hm-hint li{display:flex;align-items:center;gap:10px;font-size:14.5px;font-weight:700;line-height:1.45}
.hm-hint li i{font-style:normal;flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--hm-pink-soft);font-size:17px}
.hm-hint-b{display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin-top:14px}
.hm-hint-b button{min-height:46px;border-radius:14px;font-weight:800;font-size:15px}
.hm-hb1{border:0;color:#fff;background:linear-gradient(180deg,#F57FB0,#E0508F);box-shadow:0 10px 18px -12px rgba(220,70,140,.9)}
.hm-hb2{border:1.5px solid var(--hm-line);background:transparent}
.hm-todo{position:absolute;left:50%;top:calc(110px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:19;max-width:calc(100% - 24px);min-height:40px;padding:0 16px;border:0;border-radius:99px;font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;background:linear-gradient(180deg,#5FB7F0,#3F7FC4);box-shadow:0 8px 18px -10px rgba(40,90,170,.9)}
.hm-todo.hm-done{color:var(--hm-mint);background:var(--hm-glass);box-shadow:var(--hm-sh)}
@media (prefers-reduced-motion:no-preference){.hm-todo:not(.hm-done){animation:hm-nudge 1.1s ease-in-out 3}.hm-todo[data-n="1"]:not(.hm-done){animation-name:hm-nudge2}}
@keyframes hm-nudge{0%,100%{transform:translateX(-50%)}50%{transform:translateX(-50%) translateY(-2px)}}
@keyframes hm-nudge2{0%,100%{transform:translateX(-50%)}50%{transform:translateX(-50%) translateY(-2px)}}
.hm-edge{position:absolute;z-index:16;transform:translateY(-50%);border:0;border-radius:99px;padding:6px 12px;font-weight:800;font-size:13px;background:var(--hm-pink);color:#fff;box-shadow:0 6px 14px -8px rgba(0,0,0,.6);min-height:36px}
.hm-edge-l{left:max(8px,env(safe-area-inset-left,0px))}.hm-edge-r{right:max(8px,env(safe-area-inset-right,0px))}
/* the buttons over the game: top for where you are and the menus, bottom for moving and doing */
.hm-top{position:absolute;left:0;right:0;top:0;z-index:20;display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));pointer-events:none}
.hm-top > *{pointer-events:auto}
.hm-x{width:44px;height:44px;border-radius:50%;border:0;background:var(--hm-glass);box-shadow:var(--hm-sh);font-size:18px;flex:none}
.hm-title{flex:1;min-width:0;min-height:44px;box-sizing:border-box;background:var(--hm-glass);box-shadow:var(--hm-sh);border-radius:16px;padding:4px 12px;display:flex;flex-direction:column;justify-content:center}
.hm-title b{font-size:15px;line-height:1.3}
.hm-status{font-weight:700;font-size:12px;color:var(--hm-sub);display:flex;align-items:center;gap:6px;min-width:0;line-height:1.35}
.hm-status span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.hm-dot{width:8px;height:8px;border-radius:50%;background:#B9AFC9;flex:none}
.hm-dot.on{background:#3DBE7A;box-shadow:0 0 0 3px rgba(61,190,122,.22)}
.hm-coins{flex:none;min-height:44px;box-sizing:border-box;display:flex;align-items:center;font-weight:800;font-variant-numeric:tabular-nums;font-size:15px;padding:0 14px;border-radius:99px;background:var(--hm-glass);box-shadow:var(--hm-sh);color:var(--hm-gold)}
.hm-menu{position:absolute;left:0;right:0;top:calc(60px + env(safe-area-inset-top,0px));z-index:20;display:flex;justify-content:center;gap:8px;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px));pointer-events:none}
.hm-mbtn{pointer-events:auto;flex:1 1 0;max-width:132px;min-width:0;min-height:42px;padding:0 4px;border:0;border-radius:99px;background:var(--hm-glass);box-shadow:var(--hm-sh);font-weight:800;font-size:14px;white-space:nowrap}
.hm-mbtn[aria-pressed="true"]{background:var(--hm-pink);color:#fff}
.hm-ctl{position:absolute;z-index:20;bottom:calc(10px + env(safe-area-inset-bottom,0px));display:flex;align-items:flex-end;gap:8px}
.hm-ctl-l{left:max(12px,env(safe-area-inset-left,0px))}
.hm-ctl-r{right:max(12px,env(safe-area-inset-right,0px))}
/* the stick: push it the way to walk — up is into the room, down out toward you */
.hm-joy{position:relative;flex:none;width:112px;height:112px;border-radius:50%;background:var(--hm-glass);box-shadow:var(--hm-sh),inset 0 2px 8px rgba(255,255,255,.35);touch-action:none;cursor:grab}
.hm-joy-k{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#FFFFFF,#DCE8F8 58%,#AFC6E6);box-shadow:0 5px 12px -4px rgba(40,60,110,.6);pointer-events:none;transition:transform .14s ease-out}
.hm-joy.hm-on .hm-joy-k{transition:none}
.hm-ja{position:absolute;font-size:11px;line-height:1;color:var(--hm-blue-ink);opacity:.62;pointer-events:none}
.hm-ja-u{left:50%;top:7px;transform:translateX(-50%)}.hm-ja-d{left:50%;bottom:7px;transform:translateX(-50%)}.hm-ja-l{left:8px;top:50%;transform:translateY(-50%)}.hm-ja-r{right:8px;top:50%;transform:translateY(-50%)}
.hm-act{width:54px;min-height:66px;border:0;background:none;padding:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.hm-act i{font-style:normal;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:var(--hm-glass);box-shadow:var(--hm-sh)}
.hm-act span{font-size:11.5px;font-weight:800;line-height:1.5;padding:0 6px;border-radius:8px;background:var(--hm-glass);color:var(--hm-ink);white-space:nowrap}
.hm-act:disabled{cursor:default}
.hm-act:disabled i,.hm-act:disabled span{opacity:.55}
.hm-act[data-a="acts"]:not(:disabled) i{background:linear-gradient(180deg,#F57FB0,#E0508F)}
.hm-act:not(:disabled):active i{transform:scale(.94)}
.hm-safeb{position:absolute;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none}
.hm-mbtn i{font-style:normal;margin-right:4px}
.hm-short .hm-menu{left:auto;top:calc(8px + env(safe-area-inset-top,0px));padding:0}
.hm-short .hm-mbtn{flex:0 0 auto;min-height:44px;padding:0 12px}
.hm-short .hm-title{flex:0 1 auto;width:auto}
.hm-short .hm-coins{margin-left:auto}
.hm-icons .hm-mbtn span{display:none}
.hm-icons .hm-mbtn i{margin:0}
.hm-icons .hm-mbtn{padding:0 13px}
/* a narrow phone: smaller bottom buttons; the narrowest puts ⬆/⬇ above ◀ ▶ */
@media (max-width:389px){.hm-joy{width:100px;height:100px}.hm-act{width:48px;min-height:62px}.hm-act i{width:42px;height:42px;font-size:20px}.hm-ctl{gap:6px}}
@media (max-width:339px){.hm-joy{width:92px;height:92px}.hm-joy-k{width:40px;height:40px;margin:-20px 0 0 -20px}.hm-act{width:44px}.hm-act i{width:40px;height:40px;font-size:19px}.hm-act span{font-size:10.5px;padding:0 3px}.hm-ctl{gap:4px}.hm-ctl-l{left:8px}.hm-ctl-r{right:8px}.hm-mbtn{font-size:13px}.hm-mbtn i{margin-right:2px}}
@media (max-width:299px){.hm-ctl-l{flex-wrap:wrap-reverse;width:100px}}
/* a laptop shows which key does what; a touch screen never does */
.hm-keys{display:none}
.hm-help kbd{display:inline-block;min-width:20px;padding:1px 5px;margin:0 1px;border-radius:5px;font:700 11.5px/1.5 inherit;font-family:inherit;text-align:center;background:rgba(120,110,170,.14);box-shadow:inset 0 -1px 0 rgba(0,0,0,.18)}
@media (hover:hover) and (pointer:fine){
  .hm-keys{display:block}
  .hm-act,.hm-pad,.hm-mbtn,.hm-joy{position:relative}
  .hm-root [data-key]::after{content:attr(data-key);position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:5px;display:grid;place-items:center;font:800 10px/1 system-ui,sans-serif;color:#3A3550;background:rgba(255,255,255,.95);box-shadow:0 1px 3px rgba(0,0,0,.28);pointer-events:none}
  .hm-root .hm-mbtn[data-key]::after{top:-4px;right:-4px}
  .hm-todo::before{content:'空格';display:inline-block;margin-right:7px;padding:1px 6px;border-radius:5px;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.28)}
}
.hm-short .hm-joy{width:80px;height:80px}.hm-short .hm-joy-k{width:36px;height:36px;margin:-18px 0 0 -18px}.hm-short .hm-ja{font-size:9px}
.hm-short .hm-todo{top:auto;bottom:calc(14px + env(safe-area-inset-bottom,0px));max-width:calc(100% - 440px);animation:none}
/* the sheets behind the buttons */
.hm-sheet{position:absolute;inset:0;z-index:40;background:rgba(30,20,50,.38);display:flex;align-items:flex-end;justify-content:center;padding:0 max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px))}
.hm-sheet-in{width:100%;max-width:600px;max-height:min(80vh,calc(100% - 70px));display:flex;flex-direction:column;background:var(--hm-solid);color:var(--hm-ink);border-radius:22px 22px 0 0;box-shadow:0 -10px 30px -12px rgba(0,0,0,.5);user-select:text;-webkit-user-select:text}
@media (prefers-reduced-motion:no-preference){.hm-sheet-in{animation:hm-up .22s ease-out}}
@keyframes hm-up{from{transform:translateY(30px);opacity:0}}
.hm-sheet-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:17px;padding:12px 14px 6px}
.hm-sheet-top .hm-x{background:rgba(120,100,160,.14);box-shadow:none}
.hm-sheet-body{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:4px 14px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px}
.hm-how{margin:0;font-size:13.5px;line-height:1.6;color:var(--hm-sub)}
.hm-how b{color:var(--hm-ink)}
.hm-help{display:flex;flex-direction:column;gap:12px}
.hm-help section{border-radius:16px;background:rgba(150,120,190,.1);padding:10px 14px}
.hm-help h4{margin:0 0 4px;font-size:15px}
.hm-help p{margin:4px 0 0;font-size:14px;line-height:1.65;color:var(--hm-sub)}
.hm-help b{color:var(--hm-ink)}
.hm-prows{display:flex;flex-direction:column;gap:6px}
.hm-prow{display:grid;grid-template-columns:28px 1fr;grid-template-areas:"n w" "n t";column-gap:10px;row-gap:1px;text-align:left;border:1.5px solid var(--hm-line);background:var(--hm-solid);border-radius:14px;padding:8px 12px;min-height:52px;align-items:center}
.hm-pn{grid-area:n;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:13px;background:rgba(150,120,190,.14)}
.hm-pw{grid-area:w;font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hm-pt{grid-area:t;font-size:12.5px;color:var(--hm-sub)}
.hm-steps{display:inline-flex;gap:3px}
.hm-steps i{width:9px;height:9px;border-radius:50%;background:rgba(150,120,190,.25)}
.hm-steps i.on{background:#5DB565}
.hm-pr-thirsty{border-color:rgba(80,150,230,.5)}
.hm-pr-bloom{border-color:#E0508F;background:var(--hm-pink-soft)}
.hm-pr-wilt{border-color:#D9902A;background:var(--hm-gold-soft)}
.hm-go2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hm-sumline{font-size:14px;font-weight:800}
.hm-h4{margin:6px 0 0;font-size:15px}
.hm-albs{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.hm-alb{border:1.5px solid var(--hm-line);background:var(--hm-solid);border-radius:14px;padding:8px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;min-width:0}
.hm-alb b{font-size:13px}
.hm-alb span:last-child{font-size:11.5px;color:var(--hm-sub);line-height:1.35}
.hm-alb.locked .hm-ae{filter:grayscale(1) opacity(.45)}
.hm-alb.got{border-color:rgba(93,181,101,.6)}
.hm-ae{display:block;width:44px;height:44px}
.hm-ae svg{width:100%;height:100%;display:block;overflow:visible}
.hm-lvs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
@media (max-width:520px){.hm-lvs{grid-template-columns:1fr}}
.hm-lvc{border:1.5px solid var(--hm-line);background:var(--hm-solid);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0}
.hm-lvc b{font-size:15px}
.hm-lvc span{font-size:12.5px;color:var(--hm-sub);line-height:1.45}
.hm-lvc.cur{border-color:var(--hm-pink);background:var(--hm-pink-soft)}
.hm-lvc .hm-have{font-weight:800;color:var(--hm-mint);margin-top:auto}
.hm-buy{margin-top:auto;min-height:42px;border:0;border-radius:12px;font-weight:800;color:#fff;background:linear-gradient(180deg,#F57FB0,#E0508F)}
.hm-buy:disabled{background:var(--hm-line);color:var(--hm-sub);cursor:default}
.hm-wide{min-height:46px;border-radius:14px;border:1.5px solid var(--hm-line);background:var(--hm-solid);font-weight:800}
.hm-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.hm-item{border:1.5px solid var(--hm-line);background:var(--hm-solid);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0}
.hm-em{font-size:28px;line-height:1.1}
.hm-item b{font-size:14px}
.hm-tip{font-size:12px;color:var(--hm-sub)}
.hm-tags{display:flex;gap:4px;flex-wrap:wrap}
.hm-tagx{font-size:11px;font-weight:800;border-radius:99px;padding:1px 8px;background:var(--hm-pink-soft);color:var(--hm-pink-ink)}
.hm-tagx.keep{background:var(--hm-gold-soft);color:var(--hm-gold)}
.hm-seeds{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}
.hm-seed{border:1.5px solid var(--hm-line);background:transparent;border-radius:14px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:96px;text-align:center}
.hm-seed b{font-size:13px}
.hm-seed span:last-child{font-size:11px;color:var(--hm-sub);line-height:1.3}
.hm-seed:disabled{opacity:.55;cursor:default}
.hm-seed:disabled .hm-ae{filter:grayscale(1)}
.hm-seed:not(:disabled):active{transform:scale(.97)}
/* festivals */
.hm-scene.hm-f-cny:not(.hm-night){background:linear-gradient(180deg,#FFC8A8,#FFF0E2 78%)}
.hm-scene.hm-f-vday:not(.hm-night){background:linear-gradient(180deg,#FFC9DF,#FFF1F7 78%)}
.hm-scene.hm-f-midautumn:not(.hm-night){background:linear-gradient(180deg,#F7D9A0,#FFF6E2 78%)}
.hm-scene.hm-f-halloween:not(.hm-night){background:linear-gradient(180deg,#9C86CF,#EADCF8 78%)}
.hm-scene.hm-f-halloween.hm-night{background:linear-gradient(180deg,#1C1038,#3D2462 78%)}
.hm-scene.hm-f-xmas:not(.hm-night){background:linear-gradient(180deg,#BCD6EF,#F5F9FF 78%)}
.hm-scene.hm-f-anniv:not(.hm-night){background:linear-gradient(180deg,#FFD9E6,#FFF6EC 78%)}
.hm-snowcap{clip-path:polygon(50% 0,81% 100%,72% 86%,64% 98%,56% 84%,48% 98%,40% 84%,32% 98%,25% 88%,19% 100%);background:#FFFFFF}
.hm-snowground{background:linear-gradient(180deg,#FFFFFF,#E9F1FA)}
.hm-night .hm-snowground,.hm-night .hm-snowcap{filter:brightness(.82)}
.hm-flake{position:absolute;top:-2%;width:6px;height:6px;border-radius:50%;background:#FFFFFF;box-shadow:0 0 3px rgba(255,255,255,.9)}
.hm-fheart{position:absolute;top:90%;font-size:clamp(12px,4vmin,22px);opacity:.85}
.hm-bat{position:absolute;display:none;width:clamp(28px,9vmin,56px)}
.hm-night .hm-bat,.hm-dusk .hm-bat{display:block}
.hm-bat svg{width:100%;height:auto;display:block}
@media (prefers-reduced-motion:no-preference){
  .hm-flake{animation:hm-snow 7s linear infinite}
  .hm-fheart{animation:hm-floatup 6s ease-in infinite}
  .hm-bat{animation:hm-batfly 8s ease-in-out infinite}
  .hm-night .hm-bulb{animation:hm-twinkle 1.6s ease-in-out infinite}
  .hm-sway{animation:hm-sway 3s ease-in-out infinite;transform-origin:50% 100%}
}
@keyframes hm-snow{from{top:-2%}to{top:100%}}
@keyframes hm-floatup{from{top:90%;opacity:0}15%{opacity:.9}to{top:12%;opacity:0}}
@keyframes hm-batfly{50%{transform:translate(60%,30%)}}
@keyframes hm-twinkle{50%{opacity:.45}}
@keyframes hm-sway{0%,100%{transform:translate(-50%,-100%) rotate(-3deg)}50%{transform:translate(-50%,-100%) rotate(3deg)}}
.hm-fu{background:#E5402E;border:2px solid #FFD75E;transform:translate(-50%,-50%) rotate(45deg);display:grid;place-items:center;z-index:5}
.hm-fu span{transform:rotate(-45deg);color:#FFD75E;font-weight:900;font-size:clamp(8px,calc(var(--hm-u) * 1.8),18px)}
.hm-couplet{background:#E5402E;color:#FFD75E;writing-mode:vertical-rl;font-weight:800;font-size:clamp(6px,calc(var(--hm-u) * 1.3),13px);display:grid;place-items:center;border-radius:2px;letter-spacing:.1em;overflow:hidden;z-index:5}
.hm-banner{background:#FF8FB3;color:#FFFFFF;font-weight:800;border-radius:6px;display:grid;place-items:center;font-size:clamp(8px,calc(var(--hm-u) * 1.7),16px);white-space:nowrap;box-shadow:0 3px 6px -3px rgba(0,0,0,.3);overflow:hidden;z-index:6}
.hm-hang{transform:translate(-50%,0);pointer-events:none;z-index:6}
.hm-hang svg{width:100%;height:auto;display:block;overflow:visible}
.hm-ah{transform:translate(-50%,-50%);font-size:clamp(8px,calc(var(--hm-u) * 1.6),16px);pointer-events:none;z-index:6}
.hm-bulb{width:1.3%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);z-index:6}
.hm-night .hm-glows svg,.hm-night .hm-bulb{filter:drop-shadow(0 0 5px rgba(255,214,120,.95))}
.hm-night .hm-bulb{box-shadow:0 0 6px 2px rgba(255,236,170,.8)}
.hm-night .hm-pumpkin .hm-jack{fill:#FFD75E}
.hm-night .hm-xtree .hm-bx{fill:#FFF3B0}
.hm-night .hm-bulbglass{fill:#FFF3B0}
@media (prefers-reduced-motion:reduce){.hm-root *{animation:none!important;transition:none!important}}
`;
  document.head.appendChild(st);
}

/* ── open / close ─────────────────────────────────────────────────────────────────────────────── */
function later(fn, ms) { const t = setTimeout(() => { G.timers = G.timers.filter(x => x !== t); if (G.open) fn(); }, ms); G.timers.push(t); }
function build() {
  css();
  const root = document.createElement('div');
  // hm-unsized: the house's drawing stays out of layout until onResize knows its size (the ResizeObserver's first
  // call, in the same frame) — otherwise the first frame styled and laid it out at no size, then all over again
  root.className = 'hm-root hm-unsized'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '我们的家');
  root.innerHTML = `
    <div class="hm-scene" data-r="scene" tabindex="0" aria-label="我们的家：点地板走过去，点花盆浇水；电脑上可以用方向键">
      <div class="hm-sky" data-r="sky"></div>
      <div class="hm-ground" data-r="ground"></div>
      <div class="hm-band" data-r="band">
        <div class="hm-lay" data-r="hills"></div>
        <div class="hm-lay" data-r="world"><div class="hm-lay" data-r="house"></div><div class="hm-lay hm-actors" data-r="actors"><div class="hm-props" data-r="props"></div></div></div>
      </div>
      <div class="hm-skyfx" data-r="skyfx" aria-hidden="true"></div>
      <button type="button" class="hm-edge" data-r="edge" hidden></button>
      <div class="hm-hint" data-r="hint"${store.get('hm_hinted', 0) ? ' hidden' : ''} role="dialog" aria-label="欢迎回家">
        <b>欢迎回家 🏡</b>
        <ol><li><i>👆</i><span>点地板就走过去，往里往外都行；按住左下角的摇杆也能走</span></li><li><i>🌱</i><span>去花园种花，每人每天浇一次水</span></li><li><i>💞</i><span>两个人一起浇，花长得更快</span></li></ol>
        <div class="hm-hint-b"><button type="button" class="hm-hb1" data-a="hint-ok">开始吧</button><button type="button" class="hm-hb2" data-a="hint-help">看玩法</button></div>
      </div>
      <div class="hm-toast" data-r="toast" hidden></div>
    </div>
    <div class="hm-top">
      <button type="button" class="hm-x" data-a="x" aria-label="关闭">✕</button>
      <div class="hm-title" data-r="title"><b>🏡 我们的家</b><div class="hm-status" data-r="status" aria-live="polite"></div></div>
      <span class="hm-coins" data-r="coins">🪙 0</span>
    </div>
    <nav class="hm-menu" data-r="menu" aria-label="家里的菜单">
      <button type="button" class="hm-mbtn" data-sheet="help" data-key="1" aria-pressed="false" aria-label="玩法"><i>❓</i><span>玩法</span></button>
      <button type="button" class="hm-mbtn" data-sheet="garden" data-key="2" aria-pressed="false" aria-label="花园"><i>🌱</i><span>花园</span></button>
      <button type="button" class="hm-mbtn" data-sheet="house" data-key="3" aria-pressed="false" aria-label="房子"><i>🏠</i><span>房子</span></button>
      <button type="button" class="hm-mbtn" data-sheet="shop" data-key="4" aria-pressed="false" aria-label="小店"><i>🎁</i><span>小店</span></button>
    </nav>
    <button type="button" class="hm-todo" data-r="todo" data-a="todo" hidden></button>
    <div class="hm-ctl hm-ctl-l" data-r="ctlL">
      <div class="hm-joy" data-r="joy" data-key="WASD" role="group" aria-label="摇杆：按住往哪边推就往哪边走，往上是往屋里走（电脑上用方向键）"><i class="hm-ja hm-ja-u">▲</i><i class="hm-ja hm-ja-d">▼</i><i class="hm-ja hm-ja-l">◀</i><i class="hm-ja hm-ja-r">▶</i><i class="hm-joy-k" data-r="joyk"></i></div>
      <button type="button" class="hm-pad hm-act" data-r="stairs" data-go="up" data-key="F" hidden><i>⬆</i><span>上楼</span></button>
    </div>
    <div class="hm-ctl hm-ctl-r" data-r="ctlR">
      <button type="button" class="hm-act" data-r="hug" data-a="acts" data-key="H" aria-haspopup="menu" aria-expanded="false" disabled hidden><i>💞</i><span>互动</span></button>
      <button type="button" class="hm-act" data-r="sit" data-a="sit" data-key="K" hidden><i>🛋️</i><span>坐下</span></button>
      <button type="button" class="hm-act" data-a="wave" data-key="J"><i>👋</i><span>招手</span></button>
    </div>
    <div class="hm-acts" data-r="acts" role="menu" aria-label="和 TA 一起" hidden>${Object.entries(ACTS).map(([k, v]) => `<button type="button" role="menuitem" class="hm-actb" data-act="${k}"><i>${v.e}</i><span>${v.n}</span></button>`).join('')}</div>
    <i class="hm-safeb" data-r="safeb" aria-hidden="true"></i>`;
  document.body.appendChild(root);
  UI.root = root;
  for (const el of $$('[data-r]', root)) UI[el.dataset.r] = el;
  // hills far behind the house, moving a little slower than it; wide enough for a wide screen
  let hills = '';
  for (let x = -130; x < 280; x += 55) hills += box('hm-hill', x, 66 + (Math.abs(x) % 3), 62, 40);
  UI.hills.innerHTML = hills;
  root.addEventListener('click', onClick);
  UI.scene.addEventListener('click', onScenePointer);
  UI.world.addEventListener('keydown', (e) => { const p = e.target.closest && e.target.closest('.hm-pot'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); potAction(+p.dataset.i); } });
  // the stick: eight ways, like the keys (the same on both phones: the partner's phone walks them the same way)
  const joy = UI.joy;
  const jmove = (e) => {
    const J = G.joy; if (!J || e.pointerId !== J.id) return;
    let dx = e.clientX - J.cx, dy = e.clientY - J.cy;
    const len = Math.hypot(dx, dy), max = J.r * .6;
    if (len > max) { dx *= max / len; dy *= max / len; }
    UI.joyk.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    if (len < J.r * .18) return stopHold();
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)), v = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(a + 8) % 8];
    startHold({ x: v[0], y: v[1] });
  };
  const jend = (e) => { const J = G.joy; if (!J || (e && e.pointerId !== J.id)) return; G.joy = null; joy.classList.remove('hm-on'); UI.joyk.style.transform = ''; stopHold(); };
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { joy.setPointerCapture(e.pointerId); } catch (err) {}
    const r = joy.getBoundingClientRect();
    G.joy = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
    joy.classList.add('hm-on'); jmove(e);
  });
  joy.addEventListener('pointermove', jmove); joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend); joy.addEventListener('lostpointercapture', jend);
  joy.addEventListener('contextmenu', (e) => e.preventDefault());
  P.cs = makeActor('cs'); P.yy = makeActor('yy');
  UI.hheart = document.createElement('div'); UI.hheart.className = 'hm-hheart'; UI.hheart.textContent = '💗'; UI.hheart.hidden = true; UI.hheart.setAttribute('aria-hidden', 'true'); UI.actors.appendChild(UI.hheart);
  if (API.pet && API.pet.svg) {
    const el = document.createElement('div'); el.className = 'hm-pet'; el.innerHTML = `<div class="hm-pin">${API.pet.svg}</div>`;
    el.setAttribute('aria-hidden', 'true'); UI.actors.appendChild(el);
    pet = { el, x: 47, y: G0 - 1.5, fi: 0, vx: 0, vy: 0, path: [], flip: false };
  } else pet = null;
  // The size arrives from the ResizeObserver after the first layout. Reading it here would force that
  // layout in the middle of building, which was most of what opening the house cost on a slow phone.
  try { G.ro = new ResizeObserver(onResize); G.ro.observe(UI.scene); } catch (e) { addEventListener('resize', onResize); requestAnimationFrame(onResize); }
}
function onResize() {
  if (!UI.scene) return;
  const vw = UI.scene.clientWidth, vh = UI.scene.clientHeight;
  if (!vw || !vh) return;
  // A phone on its side is short: the menus join the title row and the "next thing" chip moves down
  // between the buttons at the bottom, so the house keeps most of the height.
  const short = vh < 520 && vw > vh;
  UI.root.classList.toggle('hm-short', short);
  if (short) {
    // one row: ✕, where you are, the menus, 🪙 — the menus stand left of the coins, the title takes what is
    // left, and when that is too little the menus keep only their icons
    const cr = UI.coins.getBoundingClientRect(), xr = UI.root.querySelector('.hm-x').getBoundingClientRect();
    UI.menu.style.right = Math.max(12, vw - cr.left + 8).toFixed(0) + 'px';
    UI.root.classList.remove('hm-icons');
    let ml = UI.menu.getBoundingClientRect().left;
    if (ml - xr.right - 16 < 120) { UI.root.classList.add('hm-icons'); ml = UI.menu.getBoundingClientRect().left; }
    UI.title.style.maxWidth = Math.max(56, ml - xr.right - 16).toFixed(0) + 'px';
  } else { UI.menu.style.right = ''; UI.title.style.maxWidth = ''; UI.root.classList.remove('hm-icons'); }
  const rr = UI.root.getBoundingClientRect();
  // the buttons at the top: the title row, the menus, and (upright) the "next thing" chip under them
  const menuB = UI.menu.getBoundingClientRect().bottom - rr.top, top = short ? menuB + 6 : menuB + 4 + 40 + 6, sb = UI.safeb.offsetHeight || 0;
  const want = clamp(vw / 9.5, 58, 110), world = LVS[G.lv].world;
  const fit = (reserve) => Math.max(1, Math.min(vw / want, (vh - sb - top - reserve) / 75));
  let s = fit(0);
  // the buttons at the bottom stand on the lawn; if the lawn is too thin under them, the house moves up
  // the bottom buttons' real height (they get smaller on a narrow phone, and on the narrowest ⬆/⬇ sits
  // above ◀ ▶), with their margin and a little air
  const lawn = (k) => (100 - floorsOf()[0].front - 3.4) / 100 * 75 * k, ctl = Math.max(UI.ctlL.offsetHeight, UI.ctlR.offsetHeight, 46) + 16;
  const sideRoom = (vw - world * s) / 2 >= 200;   // a wide screen: the buttons stand beside the house
  let reserve = sideRoom ? 0 : Math.max(0, ctl - lawn(s));
  if (reserve) { s = fit(reserve); reserve = Math.max(0, ctl - lawn(s)); }
  G.VW = vw; G.VH = vh; G.W = 100 * s; G.H = 75 * s; G.top = vh - sb - reserve - G.H; G.hudB = top; G.camPx = null;
  UI.band.style.cssText = `top:${G.top.toFixed(1)}px;width:${G.W.toFixed(1)}px;height:${G.H.toFixed(1)}px;--hm-u:${s.toFixed(3)}px`;
  UI.ground.style.top = (G.top + (floorsOf()[0].back - 3) / 100 * G.H).toFixed(1) + 'px';
  UI.sky.style.cssText = `top:${top.toFixed(1)}px;height:${Math.max(60, G.top + .55 * G.H - top).toFixed(1)}px`;
  UI.root.style.setProperty('--hm-u', s.toFixed(3) + 'px');
  UI.todo.style.top = short ? '' : (menuB + 4).toFixed(0) + 'px';
  UI.toast.style.top = (top + 2).toFixed(0) + 'px';
  UI.root.classList.remove('hm-unsized');
  sizeMini();
  G.edge = null;
}
/* ── the keyboard (asked 2026-11-25: 「for laptop can use keyboard 我们的家」) ──
   ← → ↑ ↓ or W A S D walk for as long as they are held — two at once go diagonally, ↑ is into the room and ↓ out of
   it — F takes the stairs, Space does the 「下一步」 chip, E waters / picks / plants the pot you stand by, H 抱抱,
   J 招手, K 坐下 (again: stand up), 1–4 the menus, Esc closes a sheet or the house. Never while typing, never with
   ⌘/Ctrl/Alt (those are the browser's). */
const KEY_MENU = { 1: 'help', 2: 'garden', 3: 'house', 4: 'shop' };
const keyName = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
const KEY_V = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
function keysV() { let x = 0, y = 0; for (const k of G.keys || []) { const v = KEY_V[k]; if (v) { x += v[0]; y += v[1]; } } return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }; }
function onKey(e) {
  if (e.key === 'Escape') { if (UI.acts && !UI.acts.hidden) closeActs(); else if (G.sheet) closeSheet(); else close(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
  const k = keyName(e);
  if (KEY_MENU[k]) { e.preventDefault(); if (G.sheetKind === KEY_MENU[k]) closeSheet(); else openSheet(KEY_MENU[k]); return; }
  if (G.sheet || (UI.hint && !UI.hint.hidden && (k === ' ' || k === 'Enter'))) return;   // a sheet or the welcome card: their own buttons
  if (KEY_V[k]) {
    e.preventDefault();
    if (!G.keys.has(k)) { G.keys.add(k); G.keyAt = performance.now(); G.keyTap = k; startHold(keysV()); }
    return;
  }
  const a = P[meK()], L = LVS[G.lv];
  if (e.repeat) return;
  if (k === 'f') { e.preventDefault(); if (!L.stairs) return say('两层小楼才有楼梯'); const up = a.fi !== 1; walkMe(a.x, up ? G1 : G0, up ? 1 : 0); return; }
  if (k === ' ' || k === 'Enter') {
    if (e.target && e.target.closest && e.target.closest('button')) return;   // a focused button presses itself
    e.preventDefault(); if (UI.todo && !UI.todo.hidden) UI.todo.click(); return;
  }
  if (k === 'e') { e.preventDefault(); const i = potHere(); if (i >= 0) potAction(i); else say('走到花盆旁边，再按 E'); return; }
  if (k === 'h') { e.preventDefault(); hug(); return; }
  if (k === 'l') { e.preventDefault(); interact('hand'); return; }
  if (k === 'j') { e.preventDefault(); wave(); return; }
  if (k === 'k') { e.preventDefault(); if (a.sit >= 0 || (G.seats && G.seats.length)) sitDown(); else say('客厅里摆一张沙发，就能坐下'); return; }
}
function onKeyUp(e) {
  const k = keyName(e);
  if (!KEY_V[k] || !G.keys || !G.keys.has(k)) return;
  G.keys.delete(k);
  const v = keysV();
  if (v.x || v.y) return startHold(v);
  stopHold();
  // a quick tap is a step; holding is a walk
  if (G.keyTap === k && performance.now() - (G.keyAt || 0) < 180) { const a = P[meK()], [dx, dy] = KEY_V[k]; walkMe(a.x + dx * 8, a.y + dy * 3.5, Math.max(0, a.fi)); }
}
// a held key whose release went to another window would walk forever
function onBlur() { if (G.keys) G.keys.clear(); stopHold(); }
// the pot you stand by, on your floor, or -1
function potHere() {
  const a = P[meK()], L = LVS[G.lv];
  let best = -1, bd = 8;
  (L.pots || []).forEach((pp, i) => { if (floorOfY(pp[1]) !== a.fi) return; const d = Math.hypot(a.x - pp[0], (a.y - pp[1]) * 1.6); if (d < bd) { bd = d; best = i; } });
  return best;
}
function onClick(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.a === 'x') return close();
  if (b.dataset.a === 'close-sheet') return closeSheet();
  if (b.dataset.a === 'hint-ok') return hideHint();
  if (b.dataset.a === 'hint-help') { hideHint(); return openSheet('help'); }
  if (b.dataset.a === 'todo') { const i = +b.dataset.todo; if (i >= 0) { closeSheet(); return potAction(i); } return openSheet('garden'); }
  if (b.dataset.sheet) { if (G.sheetKind === b.dataset.sheet) return closeSheet(); return openSheet(b.dataset.sheet); }
  if (b.dataset.a === 'acts') return openActs();
  if (b.dataset.act) return interact(b.dataset.act);
  if (b.dataset.a === 'wave') return wave();
  if (b.dataset.a === 'sit') return sitDown();
  if (b.dataset.a === 'nest') { close(); try { API.openNest(); } catch (err) {} return; }
  if (b.dataset.seed) { const i = +b.dataset.potI; closeSheet(); return goTo(i, { t: 'plant', pot: i, seed: b.dataset.seed }); }
  if (b.dataset.buy) return buy(b.dataset.buy);
  if (b.dataset.pot) { closeSheet(); return potAction(+b.dataset.pot); }
  const go = b.dataset.go, a = P[meK()], L = LVS[G.lv];
  if (!go) return;
  if (G.sheet) closeSheet();
  if (go === 'up') return walkMe(a.x, G1, 1);
  if (go === 'down') return walkMe(a.x, G0, 0);
  if (go === 'garden') { walkMe(20, G0 + 2, 0); mark(20, G0 + 2); return; }
  if (go === 'living') { const r = L.rooms[0], x = (r.x0 + r.x1) / 2 - 3; walkMe(x, G0, 0); mark(x, G0); return; }
}
function onVis() {
  if (!G.open) return;
  if (document.hidden) { if (G.keys) G.keys.clear(); stopHold(); const a = P[meK()]; send('away', { x: r1(a.x), y: r1(a.y), f: a.fi }); return; }
  tickDay(); loadSave(true);
  hello();   // the channel reopens on its own a moment after the phone wakes
}
// say hello once the channel is up (it takes a moment to join), then the heartbeat keeps it fresh
function hello() {
  if (!API || !API.online) return;
  clearTimeout(G.helloT);
  let tries = 0;
  const go = () => { G.helloT = 0; if (!G.open || document.hidden) return; if (send('hi', helloData())) return; if (++tries < 30) G.helloT = setTimeout(go, 600); };
  G.helloT = setTimeout(go, 300);
}
const helloData = () => { const a = P[meK()]; return { x: r1(a.x), y: r1(a.y), f: a.fi, lv: G.lv }; };
// the date this phone is on: thirst resets at midnight, festivals come and go
function tickDay(force, opening) {
  let t = G.today; try { t = API.today(); } catch (e) {}
  const per = (document.documentElement.getAttribute('data-period') || 'day');
  const night = per === 'night', dusk = per === 'dusk';
  const changed = t !== G.today || night !== G.night || dusk !== G.dusk;
  if (t !== G.today) festCache.clear();
  G.today = t; G.night = night; G.dusk = dusk;
  const all = themesAt(t), fest = all.length ? topFest(t, all) : null, fests = all.map(x => x.id).join();
  const season = seasonOf(t);
  if (force || changed || fest !== G.fest || season !== G.season || fests !== G.festKey) {
    G.fest = fest; G.season = season; G.festKey = fests; G.fests = new Set(all.map(x => x.id));
    const sc = UI.scene;
    if (sc) {
      sc.classList.toggle('hm-night', night); sc.classList.toggle('hm-dusk', dusk);
      for (const f of Object.keys(FESTS)) sc.classList.toggle('hm-f-' + f, f === fest);
      for (const s of ['spring', 'summer', 'autumn', 'winter']) sc.classList.toggle('hm-s-' + s, s === season);
    }
    // Opening is staged a frame at a time — the house fades in over 0.3 s, so nobody sees it arrive in parts, and on a
    // slow phone no single frame has to do it all: (1) the buttons, and the house's size from the ResizeObserver;
    // (2) the house and the sky; (3) what stands on the floors; then the app behind goes still (API.ready). Done in one
    // or two frames, the first one ran to 110–170 ms at 4× CPU (smooth-test).
    if (opening) { cancelAnimationFrame(G.houseRaf); G.houseRaf = requestAnimationFrame(() => { G.houseRaf = 0; if (!G.open) return; renderHouse(true); renderSky(); }); }
    else { renderHouse(); renderSky(); }
    renderPanel();
  }
}
function open(api) {
  API = api;
  if (G.open) close(true);
  G.me = api.me === 'yy' ? 'yy' : 'cs';
  G.open = true; G.last = 0; G.hold = null; G.keys = new Set(); G.joy = null; G.hand = null; G.closeT = 0; G.camX = 0; G.camT = null; G.camPx = null; G.lead = 'me'; G.edge = null; G.verSaid = 0; G.sheet = null; G.sheetKind = '';
  G.partner = { at: 0, on: false, x: 0, f: 0, away: false };
  G.srv = { data: blank(), rev: 0, loaded: false }; G.remote = [];
  G.pending = store.get(pendKey(), []).filter(op => op && op.t && op.who === CHAR[G.me]);
  if (api.initial) G.srv = { data: norm(api.initial.data), rev: api.initial.rev || 0, loaded: true };
  G.view = fold(G.srv.data, G.pending);
  G.today = ''; G.fest = undefined; G.fests = new Set(); G.festKey = null; G.season = '';
  festCache.clear(); dayCache.clear();
  try { G.today = API.today(); } catch (e) { G.today = new Date().toISOString().slice(0, 10); }
  G.lv = levelOf();
  build();
  // where each of you was when you last left
  const pos = G.view.pos || {};
  for (const k of ['cs', 'yy']) { const p = pos[CHAR[k]]; if (p && typeof p.x === 'number') { const fi = p.f && LVS[G.lv].stairs ? 1 : 0; P[k].fi = fi; [P[k].x, P[k].y] = clampPos(p.x, typeof p.y === 'number' ? p.y : (fi ? G1 : G0), fi); } }
  if (pet) { const m = P[meK()]; pet.fi = m.fi; [pet.x, pet.y] = clampPos(m.x - 6, m.y - 1.5, m.fi); }
  P[meK()].el.classList.add('hm-me');
  P[peerK()].el.classList.add('hm-off');
  for (const k of ['cs', 'yy']) P[k].el.querySelector('.hm-tag').textContent = (k === meK() ? '我 · ' : '') + nameOf(k);
  tickDay(true, true); renderCoins(); status();
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  if (API.online) {
    API.live.on('hm', onLive);
    API.live.want(true);
    hello();
    G.beat = setInterval(() => { if (!G.open || document.hidden) return; beat(); if (G.partner.on && Date.now() - G.partner.at > GONE_MS) { G.partner.on = false; P[peerK()].el.classList.add('hm-off'); P[peerK()].hv = null; status(); } }, BEAT_MS);
  }
  G.poll = setInterval(() => { if (G.open && !document.hidden) { tickDay(); if (!G.partner.on || !API.online) loadSave(true); } }, POLL_MS);
  G.tick = setInterval(() => { if (G.open) { tickDay(); recompute(); clockTick(); } }, 60000);
  loadSave(!!api.initial);
  G.raf = requestAnimationFrame(frame);
}
function close(quiet) {
  if (!G.open) return;
  // where I was, so the partner's phone can say so while I'm away
  const a = P[meK()];
  if (a && API) {
    const op = { t: 'pos', who: CHAR[meK()], x: a.x, y: a.y, f: a.fi === 1 ? 1 : 0, at: Date.now() };
    if (apply(G.view, op)) { G.pending.push(op); store.set(pendKey(), G.pending); flushOnClose(); }
  }
  if (a) send('bye', { x: r1(a.x), y: r1(a.y), f: a.fi }); else send('bye', {});
  G.open = false;
  closeSheet();
  if (G.raf) cancelAnimationFrame(G.raf); G.raf = 0;
  cancelAnimationFrame(G.propsRaf); G.propsRaf = 0; cancelAnimationFrame(G.houseRaf); G.houseRaf = 0;
  clearInterval(G.beat); clearInterval(G.poll); clearInterval(G.tick); clearTimeout(G.helloT);
  for (const t of G.timers) clearTimeout(t); G.timers = [];
  try { G.ro && G.ro.disconnect(); } catch (e) {}
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', onBlur);
  document.removeEventListener('visibilitychange', onVis);
  removeEventListener('resize', onResize);
  if (API && API.online) { try { API.live.on('hm', () => {}); API.live.want(false); } catch (e) {} }
  if (UI.root) UI.root.remove();
  for (const k of Object.keys(UI)) delete UI[k];
  pet = null; delete P.cs; delete P.yy;
  if (!quiet && API && API.onClose) { try { API.onClose(); } catch (e) {} }
}
// leaving still saves where you stood (and anything not saved yet), without holding the screen up
function flushOnClose() {
  const api = API;
  const ops = G.pending.slice();
  (async () => {
    let srv = { data: G.srv.data, rev: G.srv.rev };
    for (let tries = 0; tries < 4 && ops.length; tries++) {
      // an action that does not apply yet (it builds on the partner's save, not loaded) stays on the phone's
      // list and is replayed the next time the house opens, instead of being taken off unsent
      let data = norm(srv.data); const done = [];
      for (const op of ops) { const n = apply(data, op); if (n) { data = n; done.push(op); } else if (landed(data, op)) done.push(op); }
      const clear = () => { const sent = new Set(done.map(o => JSON.stringify(o))); store.set(pendKeyFor(api), store.get(pendKeyFor(api), []).filter(o => !sent.has(JSON.stringify(o)))); };
      if (!done.some(op => apply(norm(srv.data), op))) { clear(); return null; }   // nothing new to write
      try {
        const r = await api.save.put(data, srv.rev);
        // take only what this sent off the phone's list: the house may already be open again with new actions
        clear();
        try { api.onSave(data, (data.picked || 0) > ((srv.data && srv.data.picked) || 0)); } catch (e) {}
        return r;
      }
      catch (e) { if (e && e.stale) { srv = { data: e.data, rev: e.rev }; continue; } return null; }
    }
  })();
}
const pendKeyFor = (api) => `hm_pending_${api && api.matchId || 'demo'}_${CHAR[G.me]}`;

const actorTest = (a) => ({ x: a.x, y: a.y, f: a.fi, where: where(a), path: a.path.length, hold: a.hv ? [a.hv.x, a.hv.y] : 0, s: a.fi === -1 ? .88 : depthS(a.y, a.fi), z: +a.el.style.zIndex || 0, sit: a.sit });
css();   // when the file loads (its own task), so opening doesn't also pay for restyling the page
window.HomeGame = {
  open, close: () => close(),
  // for the tests: the rules on their own, and the state of the open house
  test: {
    SEEDS, HOUSE, LVS, FESTS, grow, apply, fold, blank, norm, festWin, seedState: (k) => seedState(k, G.today),
    state: () => !G.open ? null : ({
      me: G.me, lv: G.lv, today: G.today, fest: G.fest, season: G.season, night: G.night, camX: G.camX, W: G.W, H: G.H,
      rev: G.srv.rev, pending: G.pending.length, remote: G.remote.length, view: clone(G.view), partner: { ...G.partner }, lead: G.lead,
      cs: actorTest(P.cs), yy: actorTest(P.yy),
      pet: pet ? { x: pet.x, y: pet.y, f: pet.fi } : null, near: !!near(),
      pots: LVS[G.lv].pots.map((_, i) => { const q = potInfo(i); return { seed: q.pl && q.pl.seed, id: q.pl && q.pl.id, stage: q.g.stage, wilted: q.g.wilted, mine: q.mine, theirs: q.theirs, thirsty: q.thirsty, bloom: q.bloom, empty: q.empty }; }),
    }),
    act: (op) => act(op), potAction: (i) => potAction(i), walk: (x, f, y) => walkMe(x, y != null ? y : (f ? G1 : G0), f ? 1 : 0), tick: () => { tickDay(); recompute(); clockTick(); },
    teleport: (x, f, y) => { const a = P[meK()]; a.fi = f ? 1 : 0; [a.x, a.y] = clampPos(x, y != null ? y : (f ? G1 : G0), a.fi); a.path = []; a.hv = null; },
    hold: (dx, dy) => startHold({ x: dx, y: dy }), stop: () => stopHold(),
    geo: () => ({ floors: clone(floorsOf()), band: floorsOf().map((_, i) => band(i)), passY: floorsOf().map((_, i) => passY(i)), walls: floorsOf().map((_, i) => walls(i)), xRange: floorsOf().map((_, i) => xRange(i)), seats: clone(G.seats || []), stairs: LVS[G.lv].stairs || null }),
    route: (x, y, f) => route(P[meK()], x, y, f), depth: (y, f) => depthS(y, f),
    interact: (k) => interact(k), hand: () => (G.hand ? { order: G.hand.order } : null),
    // a partner who is home, on this phone only (the two-phone tests do it for real)
    fakePeer: (x, y, f = 0) => { G.partner.on = true; G.partner.at = Date.now() + 1e9; const b = P[peerK()]; b.el.classList.remove('hm-off'); b.fi = f; [b.x, b.y] = clampPos(x, y != null ? y : G0, f); b.path = []; b.hv = null; status(); },
    peerWalk: (x, f = 0, y) => { const b = P[peerK()]; b.path = route(b, x, y != null ? y : (f ? G1 : G0), f); G.lead = "peer"; },
    classes: () => ({ cs: P.cs.el.className, yy: P.yy.el.className }),
    obst: () => clone(G.obst || []), blocked: (x, y, f = 0) => blocked(x, y, f), clearLine: (f, x0, y0, x1, y1) => clearLine(f, x0, y0, x1, y1),
    flush: () => flush(), load: () => loadSave(true),
  },
};
})();
