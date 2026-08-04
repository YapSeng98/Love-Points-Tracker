/* =============================================================
   恋爱积分簿 — App Logic
   ServiceNow backend (Scripted REST API) + localStorage fallback
   ============================================================= */

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

const App = (() => {

  /* ── Config ── */
  const SN_API_PATH = '/api/x_887486_love_app/love_score';
  const SN_INSTANCE = 'dev405150.service-now.com';
  /* ── Maintenance mode ──
     Flip `on` to true to close the app while work is in progress: the login
     form is replaced by a notice, and a saved session will NOT auto-resume
     (otherwise whoever is already signed in keeps using a half-updated app).
     Local Demo stays reachable so you can still preview your own changes. */
  // Bypass: open the app with ?dev=1 once and this device remembers it, so you
  // can keep testing the real login while everyone else sees the notice.
  // Clear it with ?dev=0. Good enough for a two-person private app — it is a
  // convenience gate, not a security boundary.
  const _maintBypass = (() => {
    try {
      const q = new URLSearchParams(location.search).get('dev');
      if (q === '1') localStorage.setItem('maint_bypass', '1');
      if (q === '0') localStorage.removeItem('maint_bypass');
      return localStorage.getItem('maint_bypass') === '1';
    } catch { return false; }
  })();

  const MAINTENANCE = {
    on: false,
    title: '系统升级中 🛠️',
    message: '我们正在给小窝加新东西<br>暂时先不能登录哦 💕',
    sub: '很快就好，等一下再来看看吧',
  };

  const APP_VERSION = 'v2026.08.04-23';  // bump on each deploy — shown in ⚙️设置 + console

  /* ── Theme (light / dark / follow device) ──
     Device-local preference in localStorage — deliberately NOT synced to SN,
     each partner picks their own. index.html stamps the theme pre-paint;
     these keep it in sync afterwards (incl. live OS changes in auto mode). */
  const THEME_KEY = 'theme_mode';   // 'time' | 'auto' | 'light' | 'dark'
  const themeMode = () => localStorage.getItem(THEME_KEY) || 'time';

  /* Time of day comes from the DEVICE clock and nothing else. A server-side
     "it is night now" would be wrong for hours every day — the ServiceNow
     instance runs behind UTC+8 (§2), and it would also be wrong for whichever
     partner is travelling. So there is no scheduled job anywhere: the phone
     already knows, and it re-reads on open plus once a minute while open. */
  const PERIODS = [
    { id:'morning', from:6,  name:'早晨', emoji:'🌅', hi:'早安' },
    { id:'day',     from:11, name:'白天', emoji:'🌤', hi:'午安' },
    { id:'dusk',    from:17, name:'黄昏', emoji:'🌇', hi:'傍晚好' },
    { id:'night',   from:19, name:'夜晚', emoji:'🌙', hi:'晚安' },
  ];
  // Takes a date so the boundaries are testable without waiting for 6pm.
  function periodOf(d) {
    const h = (d || new Date()).getHours();
    if (h < PERIODS[0].from) return PERIODS[PERIODS.length - 1];  // 00:00–05:59 is still night
    let best = PERIODS[0];
    for (const p of PERIODS) if (h >= p.from) best = p;
    return best;
  }

  /* ── The moon is the real moon ──────────────────────────────────────────
     Its shape follows the actual lunar cycle, so it is a full circle on
     农历十五 (which is what 中秋 IS) and invisible on 初一. Computed from the
     mean synodic month rather than a lookup table, so unlike LUNAR it never
     runs out of years. Verified against the 农历 dates the app already knows:
     春节 = 初一 (new), 端午 = 初五, 中秋 = 十五 (full).                       */
  const SYNODIC   = 29.530588853;                       // mean lunar month, days
  const NEW_MOON0 = Date.UTC(2000, 0, 6, 18, 14);       // a known new moon

  function moonInfo(d) {
    const days = ((d || new Date()).getTime() - NEW_MOON0) / 86400000;
    let age = days % SYNODIC;
    if (age < 0) age += SYNODIC;                        // dates before 2000
    const phase = age / SYNODIC;                        // 0 new · 0.5 full · 1 new
    return {
      age,
      phase,
      lunarDay: Math.floor(age) + 1,                    // 农历几号 (1–30)
      illum: (1 - Math.cos(2 * Math.PI * phase)) / 2,   // 0 dark … 1 full
      name: age < 1.5 ? '新月' : age < 6.5 ? '娥眉月' : age < 9.5 ? '上弦月'
          : age < 13.5 ? '盈凸月' : age < 16.5 ? '满月' : age < 20.5 ? '亏凸月'
          : age < 23.5 ? '下弦月' : age < 28.5 ? '残月' : '新月',
    };
  }

  // Lit area as one path: a half-disc plus the terminator ellipse. Past full
  // the whole thing mirrors, because a zero-width terminator can't tell a
  // waxing half-moon from a waning one on its own.
  function moonSvg(d) {
    const m = moonInfo(d);
    const R = 34, C = 40;
    const waning = m.phase > 0.5;
    const k  = Math.cos(2 * Math.PI * (waning ? 1 - m.phase : m.phase));
    const rx = Math.abs(k) * R;
    const lit = `M ${C},${C - R} A ${R},${R} 0 0 1 ${C},${C + R}`
              // sweep 0 retraces the lit edge (new moon, nothing lit); sweep 1
              // carries the terminator round the far side (full moon, all lit).
              + ` A ${rx.toFixed(2)},${R} 0 0 ${k > 0 ? 0 : 1} ${C},${C - R} Z`;
    return `<svg viewBox="0 0 80 80" class="moon-svg" aria-hidden="true">
      <circle cx="${C}" cy="${C}" r="${R}" fill="rgba(226,232,246,0.10)"/>
      <g${waning ? ` transform="translate(80,0) scale(-1,1)"` : ''}>
        <path d="${lit}" fill="#F2ECD6"/>
        <circle cx="${C - 9}" cy="${C - 7}" r="4.5" fill="#DED6BC" opacity="0.55"/>
        <circle cx="${C + 6}" cy="${C + 8}" r="6"   fill="#DED6BC" opacity="0.4"/>
        <circle cx="${C + 2}" cy="${C - 13}" r="3"  fill="#DED6BC" opacity="0.45"/>
      </g></svg>`;
  }

  function renderMoon() {
    const el = document.querySelector('.sky-bg .moon');
    if (!el) return;
    const m = moonInfo();
    el.innerHTML = moonSvg();
    el.title = `${m.name} · 农历${m.lunarDay}`;
    // Full moon sits bigger and glows harder — 中秋 should feel like an event.
    el.style.setProperty('--moon-glow', (0.18 + m.illum * 0.5).toFixed(2));
    el.style.setProperty('--moon-size', (46 + m.illum * 16).toFixed(0) + 'px');
  }

  /* ── Real local weather ─────────────────────────────────────────────────
     If it is raining outside, it rains in the app. Two deliberate choices:

     · Location comes from the DEVICE TIMEZONE, not GPS. No permission prompt
       for a decoration, nothing personal leaves the phone, and it still
       follows you if you travel (the phone's zone changes with you).
     · Everything fails silent. Offline, blocked, or an API change just leaves
       the app looking exactly as it does today — weather is a garnish and
       must never be able to break the screen.                              */
  const WEATHER_KEY = 'weather_cache';
  const WEATHER_TTL = 20 * 60 * 1000;          // don't re-ask on every open
  const TZ_COORDS = {
    'Asia/Singapore':[1.35,103.82],   'Asia/Kuala_Lumpur':[3.14,101.69],
    'Asia/Hong_Kong':[22.32,114.17],  'Asia/Taipei':[25.03,121.57],
    'Asia/Shanghai':[31.23,121.47],   'Asia/Tokyo':[35.68,139.65],
    'Asia/Seoul':[37.57,126.98],      'Asia/Bangkok':[13.76,100.50],
    'Asia/Jakarta':[-6.21,106.85],    'Asia/Manila':[14.60,120.98],
    'Australia/Sydney':[-33.87,151.21],'Europe/London':[51.51,-0.13],
    'America/New_York':[40.71,-74.01],'America/Los_Angeles':[34.05,-118.24],
  };
  const DEFAULT_COORDS = TZ_COORDS['Asia/Singapore'];

  function guessCoords() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return TZ_COORDS[tz] || DEFAULT_COORDS;
    } catch { return DEFAULT_COORDS; }
  }

  // WMO weather codes → the handful of moods we actually draw.
  function weatherKind(code) {
    const c = Number(code);
    if (!Number.isFinite(c)) return '';
    if (c >= 95) return 'thunder';
    if (c >= 85) return 'snow';
    if (c >= 80) return 'rain';
    if (c >= 71) return 'snow';
    if (c >= 51) return 'rain';
    if (c >= 45) return 'fog';
    if (c >= 1)  return 'cloudy';
    return 'clear';
  }

  let _wxKind = '';
  function applyWeather(kind) {
    _wxKind = kind || '';
    const root = document.documentElement;
    if (kind) root.dataset.weather = kind; else delete root.dataset.weather;
    const sky = document.querySelector('.sky-bg');
    if (!sky) return;
    sky.querySelectorAll('.wx-drop').forEach(e => e.remove());
    try { renderRoomWeather(); } catch (e) {}
    if (kind !== 'rain' && kind !== 'thunder' && kind !== 'snow') return;
    const snow = kind === 'snow';
    let html = '';
    for (let i = 0; i < (snow ? 22 : 34); i++) {
      // --d is unitless and applied as a NEGATIVE delay, so every drop starts
      // already part-way down. With positive delays the first seconds of rain
      // were an empty sky — you'd open the app and see nothing falling.
      html += `<span class="wx-drop${snow ? ' snow' : ''}" style="--x:${(i * 97) % 100}%;` +
              `--d:${((i * 37) % 40) / 10};--t:${(snow ? 5 : 0.9) + ((i * 13) % 7) / 10}s;` +
              `--o:${0.45 + ((i * 7) % 5) / 10}"></span>`;
    }
    sky.insertAdjacentHTML('beforeend', html);
  }

  async function refreshWeather() {
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
      if (c && Date.now() - c.at < WEATHER_TTL) { applyWeather(c.kind); return c.kind; }
      const [lat, lon] = guessCoords();
      const res = await fetch(`https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}&current=weather_code`, { cache: 'no-store' });
      if (!res.ok) throw new Error('weather ' + res.status);
      const j = await res.json();
      const kind = weatherKind(j && j.current && j.current.weather_code);
      localStorage.setItem(WEATHER_KEY, JSON.stringify({ at: Date.now(), kind }));
      applyWeather(kind);
      return kind;
    } catch (e) {
      return '';                       // silent on purpose — see the note above
    }
  }

  function applyTheme() {
    const mode = themeMode();
    const per  = periodOf();
    const dark = mode === 'dark'
      || (mode === 'time' && per.id === 'night')
      || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.dataset.theme  = dark ? 'dark' : 'light';
    root.dataset.period = per.id;      // sky + accents follow the clock in EVERY mode
    renderMoon();
  }
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode() === 'auto') applyTheme();
  });
  // Roll into 黄昏/夜晚 while the app is left open. Cheap, and it means a phone
  // sitting on the table at 18:59 still looks right at 19:01.
  let _lastPeriod = periodOf().id;
  setInterval(() => {
    const p = periodOf().id;
    if (p === _lastPeriod) return;
    _lastPeriod = p;
    applyTheme();
    try { renderPetBanner(); } catch (e) {}
  }, 60000);
  refreshWeather();                                   // once now…
  setInterval(refreshWeather, WEATHER_TTL);           // …then every 20 min

  function setTheme(mode) {
    localStorage.setItem(THEME_KEY, mode);
    applyTheme();
    showToast(mode === 'time' ? '🕑 跟着一天的时间变化'
            : mode === 'auto' ? '🌗 跟随系统主题'
            : mode === 'dark' ? '🌙 一直深色' : '☀️ 一直浅色');
  }

  // Self-heal stale caches: app.js is always fetched fresh, but index.html can
  // be served from an old cache (mixed new-JS/old-HTML broke the UI). If the
  // freshness marker is missing, force ONE reload with a cache-busting query.
  (function ensureFreshHtml() {
    try {
      if (!document.querySelector('meta[name="app-html-v"]') && !sessionStorage.getItem('html_reloaded')) {
        sessionStorage.setItem('html_reloaded', '1');
        location.replace(location.pathname + '?fresh=' + Date.now());
      }
    } catch (e) { /* never block boot */ }
  })();

  // The check-in UI's CSS ships WITH app.js (injected at runtime). app.js is
  // always cache-busted fresh, but index.html (and its inline CSS) can stay
  // cached on phones — shipping component CSS here keeps new JS + old HTML
  // from mismatching (labels/dots rendering "flying").
  (function injectCheckinCSS() {
    if (document.getElementById('checkin-css')) return;
    const st = document.createElement('style');
    st.id = 'checkin-css';
    st.textContent = `
    .checkin-banner { background: linear-gradient(135deg, rgba(91,155,213,0.14), rgba(120,180,120,0.14)); border: 1.5px solid rgba(91,155,213,0.28); border-radius: 16px; padding: 11px 18px; display: flex; align-items: center; justify-content: space-between; margin: 0 0 14px; cursor: pointer; transition: transform 0.15s; }
    .checkin-banner:active { transform: scale(0.97); }
    .checkin-banner-left { display: flex; align-items: center; gap: 9px; }
    .checkin-banner-title { font-size: 15px; font-weight: 800; color: var(--blue); line-height: 1.1; }
    .checkin-banner-sub { font-size: 12px; color: var(--sub); font-weight: 600; margin-top: 2px; }
    .checkin-banner-badge { font-size: 13px; font-weight: 800; color: white; white-space: nowrap; background: linear-gradient(135deg, #5B9BD5, #3D7BB8); padding: 7px 14px; border-radius: 20px; }
    .checkin-banner-badge.done { background: #E4E9F0; color: var(--sub); }
    .checkin-rule { font-size: 12px; color: var(--sub); text-align: center; margin-bottom: 14px; }
    .checkin-rule b { color: var(--blue); }
    .checkin-rule .sun-b { color: #FF9F43; }
    .checkin-stats { display: flex; gap: 8px; margin-bottom: 16px; }
    .checkin-stat { flex: 1; border-radius: 16px; padding: 12px 6px 10px; text-align: center; background: linear-gradient(165deg, #FFFFFF, #F2F7FD); border: 1.5px solid var(--card-border); }
    .checkin-stat-num { font-size: 22px; font-weight: 900; line-height: 1; }
    .checkin-stat-num.streak { color: #FF7A45; }
    .checkin-stat-num.days   { color: var(--blue); }
    .checkin-stat-num.pts    { color: #E8609A; }
    .checkin-stat-label { font-size: 10.5px; color: var(--sub); font-weight: 700; margin-top: 5px; }
    .cal-weekdays, .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .cal-weekdays { margin-bottom: 7px; }
    .cal-weekday { text-align: center; font-size: 11px; font-weight: 800; color: var(--sub); padding: 2px 0; }
    .cal-weekday.sun { color: #FF9F43; }
    .cal-cell { aspect-ratio: 1; border-radius: 13px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 13px; font-weight: 800; color: var(--dark); background: #F4F7FB; position: relative; transition: transform 0.15s; overflow: hidden; }
    .cal-cell.blank { background: transparent; }
    .cal-cell.any { background: #EAF6EE; }
    .cal-cell.sun { color: #FF9F43; background: #FFF6EC; }
    .cal-cell.sun.any { background: #FFF0DA; }
    .cal-cell.today { box-shadow: 0 0 0 3px var(--gold); animation: calPulse 1.6s ease-in-out infinite; }
    @keyframes calPulse { 0%,100% { box-shadow: 0 0 0 3px rgba(255,200,0,0.9); } 50% { box-shadow: 0 0 0 3px rgba(255,200,0,0.35); } }
    .cal-cell.future { opacity: 0.4; }
    .cal-daynum { line-height: 1; }
    .cal-dots { display: flex; gap: 4px; height: 7px; align-items: center; }
    .cal-dot { width: 6.5px; height: 6.5px; border-radius: 50%; background: #DCE2EB; flex-shrink: 0; }
    .cal-dot.c1.on { background: var(--blue); box-shadow: 0 0 0 1px rgba(91,155,213,0.25); }
    .cal-dot.c2.on { background: #E8609A; box-shadow: 0 0 0 1px rgba(232,96,154,0.25); }
    .checkin-today { display: flex; justify-content: center; align-items: center; gap: 8px 18px; flex-wrap: wrap; font-size: 13px; font-weight: 700; margin-bottom: 14px; }
    .checkin-today .who { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
    .checkin-today .who .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .checkin-today .who.c1 { color: var(--blue); }
    .checkin-today .who.c2 { color: #E8609A; }
    .checkin-today .who.c1 .dot { background: var(--blue); }
    .checkin-today .who.c2 .dot { background: #E8609A; }
    .checkin-today .who.miss { color: var(--sub); }
    .checkin-today .who.miss .dot { background: #DCE2EB; }
    .checkin-btn { width: 100%; border: none; border-radius: 16px; cursor: pointer; padding: 15px; font-size: 15px; font-weight: 800; color: white; background: linear-gradient(135deg, #66BB6A, #43A047); box-shadow: 0 5px 16px rgba(67,160,71,0.38); margin-top: 16px; transition: transform 0.15s; }
    .checkin-btn.sunday { background: linear-gradient(135deg, #FFC24B, #FF8A2B); box-shadow: 0 5px 16px rgba(255,138,43,0.42); }
    .checkin-btn.partner { background: linear-gradient(135deg, #F48FB1, #EC5C8D); box-shadow: 0 5px 16px rgba(236,92,141,0.35); margin-top: 10px; }
    .checkin-btn:disabled { background: #E4E9F0; color: var(--sub); box-shadow: none; cursor: default; }
    .checkin-btn:active:not(:disabled) { transform: scale(0.97); }
    @media (max-width: 360px) {
      .checkin-stats { gap: 6px; }
      .checkin-stat { padding: 10px 4px 8px; border-radius: 13px; }
      .checkin-stat-num { font-size: 19px; }
      .checkin-stat-label { font-size: 9.5px; }
      .cal-weekdays, .cal-grid { gap: 4px; }
      .cal-cell { font-size: 12px; border-radius: 10px; }
      .checkin-rule { font-size: 11px; }
    }
    html[data-theme="dark"] .checkin-stat { background: linear-gradient(165deg, #1E2A3D, #223047); }
    html[data-theme="dark"] .cal-cell { background: #1E2A3D; color: var(--dark); }
    html[data-theme="dark"] .cal-cell.blank { background: transparent; }
    html[data-theme="dark"] .cal-cell.any { background: rgba(107,203,119,0.14); }
    html[data-theme="dark"] .cal-cell.sun { background: rgba(255,159,67,0.12); }
    html[data-theme="dark"] .cal-cell.sun.any { background: rgba(255,159,67,0.2); }
    html[data-theme="dark"] .cal-dot { background: #3A4763; }
    html[data-theme="dark"] .checkin-btn:disabled { background: #2A3448; }
    html[data-theme="dark"] .checkin-banner-badge.done { background: #2A3448; }`;
    document.head.appendChild(st);
  })();

  /* ── State ── */
  let S = {
    mode: 'reward',
    month: '',
    score: 0,               // active character's score (convenience alias)
    char1Score: 0,
    char2Score: 0,
    char1NegPts: 0,
    char2NegPts: 0,
    activeChar: 'char1',   // 'char1' | 'char2'
    entries: [],
    categories: [],
    rewards: [],
    punishments: [],
    rewardTarget: 100,
    punishThreshold: -80,
    charName1: 'Pochacco',
    charName2: '阿呆',
    charImg1: '',
    charImg2: '',
    snInstance: '',
    apiKey: '',
    usingSN: false,
    matchId: '',
    historyRecords: [],
    needsSetup: false,
    startDate: '',
    shopItems: [],
    bagItems: [],
    bagHistory: [],
    shopTab: 'shop',
    catTab: 'reward',   // quick-entry tab: 'reward' (加分) | 'punish' (扣分)
    shopEditId: null,
    goalName: '', goalIcon: '🎯', goalTarget: 0,
    petName: '', petSpecies: '', petExpStored: 0, petBase: 0, petPick: '',
    equipped: null, decorOwned: [], decorTab: 'floor', decorSel: null, roomSig: '',
    achievements: [],
    letters: [],
    letterReaderId: null,   // id of the letter currently open in the reader overlay
    photos: [],
  };

  /* ── Helpers ── */
  const now = () => new Date();

  // Compress an image File to a small base64 JPEG for SN storage
  function compressImage(file, maxDim = 150, quality = 0.6) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }
  const monthKey = (d = now()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  // Local calendar date (YYYY-MM-DD). NOT toISOString() — that returns UTC,
  // which is a day behind for UTC+8 users in the early morning.
  const todayStr = (d = now()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monthLabel = (k) => { const [y,m] = k.split('-'); return `${y} 年 ${parseInt(m)} 月`; };

  function _snUnwrap(json) {
    let data = json.result !== undefined ? json.result : json;
    // Unwrap a second level if old SN scripts double-wrapped with { result: ... }
    if (data !== null && typeof data === 'object' && !Array.isArray(data) && data.result !== undefined) {
      data = data.result;
    }
    return data;
  }

  // SN PDI MySQL uses utf8mb3 (3-byte max) — supplementary (4-byte) emoji corrupt on write.
  // Workaround: encode as \xCODEPOINT (7 chars) which fits in a 10-char SN field.
  function encodeForSN(str) {
    if (!str) return str;
    // Spread via [...str] correctly iterates Unicode code points (handles surrogate pairs)
    return [...str].map(ch => {
      const cp = ch.codePointAt(0);
      return cp > 0xFFFF ? `\\x${cp.toString(16).toUpperCase()}` : ch;
    }).join('');
  }

  // ServiceNow's MySQL is utf8mb3: 3-byte emoji (❤️) survive, 4-byte ones (🎯)
  // get mangled — some land back as base64 of their UTF-8 bytes. Recover those
  // on read so already-corrupted values heal themselves. Deliberately strict:
  // only accepts a decode that yields a real supplementary-plane character, so
  // ordinary text that happens to look like base64 ("test") is left alone.
  function _recoverBase64Emoji(str) {
    // SN prefixes the base64 with U+FDD6/U+FDD7 sentinels (they show as ▢▢) —
    // strip those non-characters before testing, or the payload never matches.
    const c = str.replace(/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g, '');
    if (!/^[A-Za-z0-9+/]{4,}={0,2}$/.test(c) || c.length % 4 !== 0) return null;
    try {
      const bin = atob(c);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const out = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return [...out].some(ch => ch.codePointAt(0) > 0xFFFF) ? out : null;
    } catch { return null; }
  }

  function decodeFromSN(str) {
    if (!str) return str;
    const recovered = _recoverBase64Emoji(str);
    if (recovered) return recovered;
    // Decode \xCODEPOINT format (e.g. \x1F61A → 😚)
    if (str.includes('\\x')) {
      str = str.replace(/\\x([0-9a-fA-F]+)/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    }
    // Also decode legacy \uXXXX surrogate format saved by older versions
    if (str.includes('\\u')) {
      str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
    return str;
  }

  async function snFetch(path, opts = {}) {
    const url = `https://${S.snInstance}${SN_API_PATH}${path}`;
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + S.apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error(`SN ${res.status}: ${await res.text()}`);
    return _snUnwrap(await res.json());
  }

  async function snPublicFetch(path, opts = {}) {
    const url = `https://${S.snInstance}${SN_API_PATH}${path}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      ...opts,
    });
    if (!res.ok) throw new Error(`SN ${res.status}: ${await res.text()}`);
    return _snUnwrap(await res.json());
  }

  /* ── LocalStorage (demo) backend ── */
  const LS = {
    KEY: 'love_score_data',
    load() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || this.defaults(); }
      catch { return this.defaults(); }
    },
    save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },
    defaults() {
      return {
        mode: 'reward',
        rewardTarget: 100,
        punishThreshold: -80,
        entries: {},      // { 'YYYY-MM': [...] }
        history: [],
        archive: [],      // settled entries, kept for 年度回顾
        letters: [],      // 情书: [{ id, charId, text, date, opened }]
        photos: [],       // 回忆相册: [{ id, charId, image, caption, date }]
        goalName: '', goalIcon: '🎯', goalTarget: 0,   // 共同目标
        petName: '', petSpecies: '', petExp: 0, petBase: 0, petEquipped: '',   // 恋爱小窝
        charName1: '线条小狗·他',
        charName2: '线条小狗·她',
        charImg1: '',
        charImg2: '',
        categories: [
          { id:'c1', icon:'💑', name:'陪伴时光',   pts:10,  active:true },
          { id:'c2', icon:'🎁', name:'惊喜礼物',   pts:15,  active:true },
          { id:'c3', icon:'🍳', name:'亲自煮饭',   pts:8,   active:true },
          { id:'c4', icon:'🧹', name:'做家务',     pts:5,   active:true },
          { id:'c5', icon:'📅', name:'记住重要日',  pts:20,  active:true },
          { id:'c6', icon:'🙏', name:'主动道歉',   pts:10,  active:true },
          { id:'c7', icon:'💌', name:'甜蜜消息',   pts:5,   active:true },
          { id:'c8', icon:'😤', name:'忘记约定',   pts:-10, active:true },
          { id:'c9', icon:'⏰', name:'约会迟到',   pts:-5,  active:true },
          { id:'c10',icon:'📱', name:'手机太久',   pts:-5,  active:true },
          { id:'c11',icon:'😡', name:'争吵没道歉', pts:-15, active:true },
          { id:'c12',icon:'🍕', name:'乱花钱',    pts:-8,  active:true },
        ],
        rewards: [
          { id:'r1', icon:'🍦', name:'小零食一份',  minPts:30,  desc:'任意选一样零食' },
          { id:'r2', icon:'🎬', name:'约会一次',    minPts:60,  desc:'对方全程安排约会' },
          { id:'r3', icon:'🛍️', name:'想要的东西',  minPts:100, desc:'在预算内的礼物' },
          { id:'r4', icon:'🍽️', name:'浪漫晚餐',   minPts:140, desc:'高级餐厅二人行' },
          { id:'r5', icon:'✈️', name:'旅行一次',    minPts:200, desc:'两人小旅行' },
        ],
        punishments: [
          { id:'p1', icon:'🧹', name:'做一周家务',  minPts:30,  desc:'全部家务包揽' },
          { id:'p2', icon:'🎮', name:'一周不打游戏', minPts:60,  desc:'还要陪伴对方' },
          { id:'p3', icon:'💆', name:'按摩七天',   minPts:80,  desc:'每天十分钟' },
          { id:'p4', icon:'🍕', name:'供应零食一月', minPts:120, desc:'每周采购一次' },
          { id:'p5', icon:'👑', name:'对方全权决定', minPts:160, desc:'下次约会完全听对方' },
        ],
      };
    },
  };

  /* ── Data layer (adapts SN or LS) ── */
  const _safeStr = (v) => (v != null && v !== 'undefined') ? String(v) : '';
  const _escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const _normTier = (x) => ({
    ...x,
    icon:   decodeFromSN(_safeStr(x.icon)),
    name:   _safeStr(x.name),
    minPts: x.minPts != null ? parseInt(x.minPts) : 0,
    desc:   _safeStr(x.desc),
  });

  // History is small (month summaries) so it's always refetched. Letters and
  // ESPECIALLY photos are not: /photos returns full base64 images, so pulling
  // them on every home refresh would re-download megabytes on mobile data.
  // They're fetched once per data source and then kept current by the flows
  // that change them (loadLetters / loadMemories write straight into S).
  let _heavyStatsLoaded = false;

  const Data = {
    async init() {
      // We're (re)connecting to a data source, so any cached letters/photos
      // belong to the previous one. boot() runs a refresh BEFORE login, which
      // would otherwise latch the cache on an empty dataset and leave the pet
      // and badges under-counting for the rest of the session.
      _heavyStatsLoaded = false;
      if (S.usingSN) {
        const cfg = await snFetch('/config');
        if (cfg && cfg.configured === false) {
          S.mode            = 'reward';
          S.rewardTarget    = 100;
          S.punishThreshold = -80;
          S.needsSetup      = true;
        } else {
          S.mode            = cfg.mode            || 'reward';
          S.rewardTarget    = cfg.rewardTarget    || 100;
          S.punishThreshold = cfg.punishThreshold || -80;
          S.needsSetup      = false;
        }
        const cn1 = decodeFromSN(cfg.char1Name || ''), cn2 = decodeFromSN(cfg.char2Name || '');
        if (cn1) { S.charName1 = cn1; localStorage.setItem('sn_charname1', cn1); }
        if (cn2) { S.charName2 = cn2; localStorage.setItem('sn_charname2', cn2); }
        S.startDate = cfg.startDate || '';
        // Shared goal — blank until the couple sets one (and stays blank on an
        // instance whose u_love_config lacks the u_goal_* fields yet)
        S.goalName   = decodeFromSN(cfg.goalName || '');
        S.goalIcon   = decodeFromSN(cfg.goalIcon || '') || '🎯';
        S.goalTarget = parseInt(cfg.goalTarget) || 0;
        S.petName      = decodeFromSN(cfg.petName || '');
        S.petSpecies   = cfg.petSpecies || '';
        S.petExpStored = parseInt(cfg.petExp) || 0;
        S.petBase      = parseInt(cfg.petBase) || 0;
        S.equipped     = parseEquipped(cfg.petEquipped);
        // Profile pictures come from SN auth records; blank if not set
        S.charImg1 = cfg.charImg1 || '';
        S.charImg2 = cfg.charImg2 || '';
        const normCat = (x) => ({
          ...x,
          icon:   decodeFromSN(_safeStr(x.icon)),
          name:   _safeStr(x.name),
          pts:    x.pts    != null ? parseInt(x.pts)   : 0,
          active: x.active != null ? (x.active === true || x.active === '1' || x.active === 1) : true,
        });
        S.categories  = (await snFetch('/categories')).map(normCat);
        S.rewards     = (await snFetch('/rewards')).map(_normTier);
        S.punishments = (await snFetch('/punishments')).map(_normTier);
      } else {
        const d = LS.load();
        S.mode            = d.mode;
        S.rewardTarget    = d.rewardTarget;
        S.punishThreshold = d.punishThreshold;
        S.categories      = d.categories;
        S.rewards         = d.rewards;
        S.punishments     = d.punishments;
        S.charName1       = d.charName1 || 'Pochacco';
        S.charName2       = d.charName2 || '阿呆';
        S.charImg1        = d.charImg1  || '';
        S.charImg2        = d.charImg2  || '';
        S.startDate       = d.startDate || '';
        S.goalName        = d.goalName  || '';
        S.goalIcon        = d.goalIcon  || '🎯';
        S.goalTarget      = parseInt(d.goalTarget) || 0;
        S.petName         = d.petName    || '';
        S.petSpecies      = d.petSpecies || '';
        S.petExpStored    = parseInt(d.petExp) || 0;
        S.petBase         = parseInt(d.petBase) || 0;
        S.equipped        = parseEquipped(d.petEquipped);
      }
    },

    // Returns every UNSETTLED entry regardless of calendar month — settling
    // (not the calendar rolling over) is what removes an entry from this
    // list. See r04_GET_entries.js for why: filtering by "this month" used
    // to silently hide any entry left over from a missed 月末结算 the moment
    // the month changed, even though it was still sitting there unsettled.
    async getEntries() {
      if (S.usingSN) {
        // Still send ?month= even though the fixed r04 ignores it — purely
        // so the app doesn't hard-crash against an instance that hasn't had
        // r04 re-pasted yet (the OLD script's no-param fallback throws:
        // GlideDate has no .substring()). Harmless once r04 is updated.
        const entries = await snFetch(`/entries?month=${monthKey()}`);
        return entries.map(e => ({ ...e, icon: decodeFromSN(e.icon) }));
      }
      const d = LS.load();
      const all = Object.keys(d.entries || {}).flatMap(m => d.entries[m] || []);
      return all.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // Every entry of a given year, INCLUDING settled ones. Needed by 年度回顾:
    // getEntries() only returns unsettled entries, so once a month is settled
    // its check-ins vanish and a yearly count silently shrinks to the current
    // month. Falls back to what we have if the backend doesn't support ?year.
    // Couple-wide furniture: the room is shared, so a sofa one partner bought
    // must be placeable by the other (real-world rewards stay per-person).
    async getDecorOwned() {
      if (S.usingSN) {
        return ((await snFetch('/bag?type=decor')) || []).map(r => ({
          ...r, itemName: decodeFromSN(r.itemName), itemIcon: decodeFromSN(r.itemIcon) }));
      }
      return (LS.load().decorOwned || []);
    },

    async buyDecor(itemId) {
      const it = DECOR[itemId];
      if (!it) throw new Error('unknown item');
      if (S.usingSN) {
        return snFetch('/decor/buy', { method:'POST', body: JSON.stringify({
          itemId, itemName: encodeForSN(it.name), itemIcon: encodeForSN(it.art || ''), price: it.price,
          charId: S.activeChar, date: todayStr(), month: monthKey(),
        }) });
      }
      const d = LS.load();
      d.decorOwned = d.decorOwned || [];
      if (d.decorOwned.some(r => r.itemId === itemId)) throw new Error('already_owned');
      d.decorOwned.push({ id:'d'+Date.now(), itemId, owner:S.activeChar,
                          itemName:it.name, itemIcon:it.art||'', ptsSpent:it.price });
      LS.save(d);
    },

    async getEntriesOfYear(year) {
      if (S.usingSN) {
        const list = await snFetch(`/entries?year=${year}`);
        return (list || []).map(e => ({ ...e, icon: decodeFromSN(e.icon) }));
      }
      const d = LS.load();
      const live = Object.keys(d.entries || {}).flatMap(m => d.entries[m] || []);
      const archived = d.archive || [];
      return [...live, ...archived].filter(e =>
        String(e.month || (e.date || '').slice(0, 7)).startsWith(String(year)));
    },

    async addEntry(entry) {
      if (S.usingSN) {
        const encoded = { ...entry, icon: encodeForSN(entry.icon) };
        return snFetch('/entries', { method:'POST', body: JSON.stringify(encoded) });
      }
      const d = LS.load();
      if (!d.entries[entry.month]) d.entries[entry.month] = [];
      const e = { ...entry, id: 'e'+Date.now() };
      d.entries[entry.month].unshift(e);
      LS.save(d);
      return e;
    },

    // No `month` param: an entry can now legitimately be shown (and edited or
    // deleted) from a month other than S.month once a 月末结算 gets missed, so
    // the caller's "current month" is not reliable as a bucket key — look the
    // id up across every bucket instead.
    async deleteEntry(id) {
      if (S.usingSN) return snFetch(`/entries/${id}`, { method:'DELETE' });
      const d = LS.load();
      Object.keys(d.entries || {}).forEach(m => {
        d.entries[m] = (d.entries[m] || []).filter(e => e.id !== id);
      });
      LS.save(d);
    },

    async updateEntry(id, data) {
      if (S.usingSN) {
        const encoded = data.icon ? { ...data, icon: encodeForSN(data.icon) } : data;
        return snFetch(`/entries/${id}`, { method:'PUT', body: JSON.stringify(encoded) });
      }
      const d = LS.load();
      for (const m of Object.keys(d.entries || {})) {
        const idx = (d.entries[m] || []).findIndex(e => e.id === id);
        if (idx < 0) continue;
        d.entries[m][idx] = { ...d.entries[m][idx], ...data };
        break;
      }
      LS.save(d);
    },

    async getHistory() {
      if (S.usingSN) return snFetch('/history');
      return LS.load().history || [];
    },

    /* ── 情书 (private love letters between the couple only) ── */
    async getLetters() {
      let list;
      if (S.usingSN) {
        list = (await snFetch('/letters')).map(l => ({ ...l, text: decodeFromSN(l.text) }));
      } else {
        list = LS.load().letters || [];
      }
      return list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addLetter(letter) {
      if (S.usingSN) {
        const encoded = { ...letter, text: encodeForSN(letter.text) };
        return snFetch('/letters', { method:'POST', body: JSON.stringify(encoded) });
      }
      const d = LS.load();
      d.letters = d.letters || [];
      const l = { ...letter, id: 'ltr'+Date.now() };
      d.letters.push(l);
      if (d.letters.length > 500) d.letters = d.letters.slice(-500);
      LS.save(d);
      return l;
    },

    async markLetterOpened(id) {
      if (S.usingSN) return snFetch(`/letters/${id}`, { method:'PUT', body: JSON.stringify({ opened: true }) });
      const d = LS.load();
      const l = (d.letters || []).find(x => x.id === id);
      if (l) l.opened = true;
      LS.save(d);
    },

    async deleteLetter(id) {
      if (S.usingSN) return snFetch(`/letters/${id}`, { method:'DELETE' });
      const d = LS.load();
      d.letters = (d.letters || []).filter(l => l.id !== id);
      LS.save(d);
    },

    /* ── 回忆相册 (memory photos, couple-private) ── */
    async getPhotos() {
      let list;
      if (S.usingSN) {
        list = (await snFetch('/photos')).map(p => ({ ...p, caption: decodeFromSN(p.caption) }));
      } else {
        list = LS.load().photos || [];
      }
      return list.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    },

    async addPhoto(photo) {
      if (S.usingSN) {
        const encoded = { ...photo, caption: encodeForSN(photo.caption || '') };
        return snFetch('/photos', { method:'POST', body: JSON.stringify(encoded) });
      }
      const d = LS.load();
      d.photos = d.photos || [];
      const p = { ...photo, id: 'ph'+Date.now() };
      d.photos.push(p);
      if (d.photos.length > 30) d.photos = d.photos.slice(-30);  // localStorage quota guard
      LS.save(d);
      return p;
    },

    async deletePhoto(id) {
      if (S.usingSN) return snFetch(`/photos/${id}`, { method:'DELETE' });
      const d = LS.load();
      d.photos = (d.photos || []).filter(p => p.id !== id);
      LS.save(d);
    },

    // Refetch rewards/punishments so claim states stay fresh (partner may
    // have claimed or settled from their own device)
    async reloadTiers() {
      if (!S.usingSN) return;
      S.rewards     = (await snFetch('/rewards')).map(_normTier);
      S.punishments = (await snFetch('/punishments')).map(_normTier);
    },

    async settleMonth(month, char1Pts, char2Pts, mode, result1, result2) {
      if (S.usingSN) return snFetch('/monthly/settle', {
        method: 'POST',
        body: JSON.stringify({ month, char1Pts, char2Pts, mode, result1, result2 }),
      });
      const d = LS.load();
      d.history = d.history || [];
      d.history.unshift({ month, char1Pts, char2Pts, mode, result1, result2, settledAt: new Date().toISOString() });
      // Archive rather than delete — settled entries still exist server-side
      // (u_monthly stamped) and 年度回顾 needs them for yearly counts.
      d.archive = (d.archive || []).concat(d.entries[month] || []);
      d.entries[month] = [];
      LS.save(d);
    },

    // Any config field that can hold emoji MUST be encoded — utf8mb3 mangles
    // 4-byte characters. Done here rather than at each call site so a new
    // caller can't forget (that's exactly how the goal icon got corrupted).
    _CFG_TEXT: ['goalName', 'goalIcon', 'petName', 'charName1', 'charName2'],

    async saveConfig(cfg) {
      if (S.usingSN) {
        const body = { ...cfg };
        this._CFG_TEXT.forEach(k => {
          if (body[k] !== undefined) body[k] = encodeForSN(String(body[k]));
        });
        return snFetch('/config', { method:'PUT', body: JSON.stringify(body) });
      }
      const d = LS.load();
      const { entries, history, categories, rewards, punishments, ...rest } = cfg;
      Object.assign(d, rest);
      LS.save(d);
    },

    /* ── CRUD: categories / rewards / punishments ── */
    _endpoint(type) {
      return type === 'category' ? '/categories' : type === 'reward' ? '/rewards' : '/punishments';
    },
    _arr(d, type) {
      return type === 'category' ? d.categories : type === 'reward' ? d.rewards : d.punishments;
    },

    async addItem(type, data) {
      if (S.usingSN) {
        const r = await snFetch(this._endpoint(type), { method:'POST', body: JSON.stringify(data) });
        // SN only returns { id, success } — rebuild full item for in-memory use
        return { ...data, icon: decodeFromSN(data.icon || '') || '', id: r.id };
      }
      const d = LS.load();
      const item = { ...data, id: type[0] + Date.now() };
      this._arr(d, type).push(item);
      LS.save(d);
      return item;
    },

    async updateItem(type, id, data) {
      if (S.usingSN) return snFetch(`${this._endpoint(type)}/${id}`, { method:'PUT', body: JSON.stringify(data) });
      const d = LS.load();
      const arr = this._arr(d, type);
      const idx = arr.findIndex(x => x.id === id);
      if (idx >= 0) arr[idx] = { ...arr[idx], ...data };
      LS.save(d);
    },

    async deleteItem(type, id) {
      if (S.usingSN) return snFetch(`${this._endpoint(type)}/${id}`, { method:'DELETE' });
      const d = LS.load();
      if (type === 'category')   d.categories  = d.categories.filter(x => x.id !== id);
      else if (type === 'reward') d.rewards     = d.rewards.filter(x => x.id !== id);
      else                        d.punishments = d.punishments.filter(x => x.id !== id);
      LS.save(d);
    },
  };

  /* ── Shop / Bag data layer ── */
  const ShopData = {
    async getItems() {
      if (!S.usingSN) return [];
      const items = await snFetch('/shop');
      return items.map(i => ({ ...i, icon: decodeFromSN(i.icon || '') }));
    },
    async addItem(data) {
      return snFetch('/shop', { method: 'POST', body: JSON.stringify(data) });
    },
    async updateItem(id, data) {
      return snFetch(`/shop/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async deleteItem(id) {
      return snFetch(`/shop/${id}`, { method: 'DELETE' });
    },
    async buyItem(id) {
      // Send the client's local date/month — the SN instance runs in a
      // different timezone, so server-computed "today" can be a day behind.
      return snFetch(`/shop/buy/${id}`, { method: 'POST', body: JSON.stringify({ date: todayStr(), month: monthKey() }) });
    },
    async getBag() {
      if (!S.usingSN) return [];
      const items = await snFetch('/bag');
      return items.map(i => ({ ...i, itemIcon: decodeFromSN(i.itemIcon || '') }));
    },
    async useItem(id) {
      return snFetch(`/bag/use/${id}`, { method: 'POST', body: JSON.stringify({ date: todayStr() }) });
    },
    async getBagHistory() {
      if (!S.usingSN) return [];
      const items = await snFetch('/bag/history');
      return items.map(i => ({ ...i, itemIcon: decodeFromSN(i.itemIcon || '') }));
    },
    async claimReward(rewardId) {
      // charId: claims are per character — claim for whoever is active
      return snFetch('/bag/claim', { method: 'POST', body: JSON.stringify({ rewardId, charId: S.activeChar, date: todayStr(), month: monthKey() }) });
    },
  };

  /* ── Score calc helpers ── */
  function calcScore(entries) {
    return entries.reduce((sum, e) => sum + (parseInt(e.pts) || 0), 0);
  }

  // Shop purchases are logged as negative entries so they reduce the spendable
  // balance, but they are NOT bad behavior — they must never count toward the
  // punishment threshold.
  const isPurchaseEntry = (e) => e.catName === '🛒 商店兑换';

  function calcCharScores(entries) {
    let c1 = 0, c2 = 0, n1 = 0, n2 = 0;
    entries.forEach(e => {
      const pts = parseInt(e.pts) || 0;
      const badPts = (pts < 0 && !isPurchaseEntry(e)) ? Math.abs(pts) : 0;
      if (!e.charId || e.charId === 'char1') { c1 += pts; n1 += badPts; }
      else                                    { c2 += pts; n2 += badPts; }
    });
    return { char1: c1, char2: c2, neg1: n1, neg2: n2 };
  }

  function activeNegPts() {
    return S.activeChar === 'char1' ? S.char1NegPts : S.char2NegPts;
  }

  function activeScore() {
    return S.activeChar === 'char1' ? S.char1Score : S.char2Score;
  }

  // Score used for outcome lookup: reward mode judges by net score, punishment
  // mode judges by accumulated bad-behavior points (shop purchases excluded)
  function outcomeScoreFor(charId) {
    if (S.mode === 'reward') return charId === 'char2' ? S.char2Score : S.char1Score;
    return -(charId === 'char2' ? S.char2NegPts : S.char1NegPts);
  }

  function charDisplayName(charId) {
    return charId === 'char1' ? (S.charName1 || 'CS') : (S.charName2 || 'YY');
  }

  function progressInfo(score, mode, negPts) {
    if (mode === 'reward') {
      const target = S.rewardTarget;
      const pct    = Math.min(100, Math.max(0, Math.round((score / target) * 100)));
      const gap    = Math.max(0, target - score);
      return { pct, gap, reached: score >= target, label: `奖励目标 ${target} 分`, type: 'reward' };
    } else {
      const threshold = Math.abs(S.punishThreshold);
      // Use total bad-behavior pts accumulated (not net score) so the bar fills
      // even when positive entries offset punishments, and shop purchases
      // (negative balance entries) never push anyone toward punishment
      const neg = (negPts != null && negPts > 0) ? negPts : Math.max(0, -score);
      const pct = Math.min(100, Math.round((neg / threshold) * 100));
      const gap = Math.max(0, threshold - neg);
      return { pct, gap, reached: neg >= threshold, label: `惩罚阈值 ${S.punishThreshold} 分`, type: 'punishment' };
    }
  }

  function getOutcome(score, mode) {
    const list = mode === 'reward' ? S.rewards : S.punishments;
    const sorted = [...list].sort((a,b) => b.minPts - a.minPts);
    const absScore = mode === 'reward' ? score : Math.abs(Math.min(0, score));
    for (const item of sorted) {
      if (absScore >= item.minPts) return item;
    }
    return null;
  }

  /* ── UI Renders ── */
  function renderScore(score) {
    const el = document.getElementById('score-number');
    el.textContent = score >= 0 ? `+${score}` : `${score}`;
    el.className = 'score-number ' + (score >= 0 ? 'positive' : 'negative');
    el.classList.add('score-bump');
    setTimeout(() => el.classList.remove('score-bump'), 400);
  }

  function renderEntryCounts() {
    const charId = S.activeChar;
    const mine = S.entries.filter(e => !e.charId && charId === 'char1' || e.charId === charId);
    // Shop purchases are spending, not bad behavior — count them separately
    const good = mine.filter(e => (parseInt(e.pts) || 0) > 0).length;
    const bad  = mine.filter(e => (parseInt(e.pts) || 0) < 0 && !isPurchaseEntry(e)).length;
    const buys = mine.filter(e => (parseInt(e.pts) || 0) < 0 && isPurchaseEntry(e)).length;
    const gEl = document.getElementById('stat-good');
    const bEl = document.getElementById('stat-bad');
    const sEl = document.getElementById('stat-shop');
    if (gEl) gEl.textContent = `✅ ${good} 次好行为`;
    if (bEl) bEl.textContent = `😣 ${bad} 次扣分`;
    if (sEl) { sEl.textContent = `🛒 ${buys} 次兑换`; sEl.style.display = buys ? '' : 'none'; }
  }

  function renderProgress(score) {
    const info = progressInfo(score, S.mode, activeNegPts());
    const fill = document.getElementById('progress-fill');
    fill.style.width = info.pct + '%';
    fill.className = 'progress-bar-fill ' + info.type;
    document.getElementById('progress-pct').textContent = info.pct + '%';
    // Punishment bar tracks bad-behavior points only; the net 积分 balance is
    // a separate number (big score display) — don't mix them on the bar
    document.getElementById('progress-left-label').textContent =
      info.type === 'punishment' ? `已扣 ${activeNegPts()} 分` : score + ' 分';
    document.getElementById('progress-right-label').textContent = info.label;

    const statusEl = document.getElementById('status-text');
    const gapEl    = document.getElementById('status-gap');

    if (info.reached) {
      if (info.type === 'reward') {
        const outcome = getOutcome(score, 'reward');
        statusEl.innerHTML = `🎉 已达成奖励！ <span class="status-badge badge-reward">${outcome ? outcome.name : '奖励'}</span>`;
      } else {
        const outcome = getOutcome(-activeNegPts(), 'punishment');
        statusEl.innerHTML = `⚠️ 达到惩罚阈值！ <span class="status-badge badge-danger">${outcome ? outcome.name : '惩罚'}</span>`;
      }
    } else {
      if (info.type === 'reward') {
        statusEl.innerHTML = `再加 <span id="status-gap">${info.gap}</span> 分 → 下一个奖励 🏆`;
      } else {
        const neg = activeNegPts();
        if (neg > 0) {
          statusEl.innerHTML = `⚠️ 已扣 ${neg} 分，再扣 <span id="status-gap">${info.gap}</span> 分将触发惩罚`;
        } else {
          statusEl.innerHTML = `😊 安全！本月没有扣分，继续保持 <span class="status-badge badge-safe">积分 ${score >= 0 ? '+' + score : score}</span>`;
        }
      }
    }
  }

  function renderCharacterMood(pct) {
    const p = document.getElementById('char-pochacco');
    const a = document.getElementById('char-adai');
    const mouthP = document.getElementById('pochacco-mouth');
    const mouthA = document.getElementById('adai-mouth');

    p.className = 'char-wrap pochacco';
    a.className = 'char-wrap adai';

    if (pct >= 100) {
      p.classList.add('celebrate');
      a.classList.add('celebrate');
      if (mouthP) mouthP.setAttribute('d', 'M 43 74 Q 55 88 67 74');
      if (mouthA) mouthA.setAttribute('d', 'M 43 74 Q 55 88 67 74');
    } else if (pct >= 60) {
      p.classList.add('happy');
      a.classList.add('happy');
      if (mouthP) mouthP.setAttribute('d', 'M 45 74 Q 55 86 65 74');
      if (mouthA) mouthA.setAttribute('d', 'M 45 74 Q 55 86 65 74');
    } else if (pct <= 20 && S.mode === 'punishment') {
      p.classList.add('sad');
      a.classList.add('sad');
      if (mouthP) mouthP.setAttribute('d', 'M 46.5 80 Q 55 73 63.5 80');
      if (mouthA) mouthA.setAttribute('d', 'M 46.5 80 Q 55 73 63.5 80');
    } else {
      if (mouthP) mouthP.setAttribute('d', 'M 46.5 74 Q 55 84 63.5 74');
      if (mouthA) mouthA.setAttribute('d', 'M 46.5 74 Q 55 84 63.5 74');
    }
  }

  function renderCategories() {
    const grid = document.getElementById('categories-grid');
    const cats = S.categories.filter(c => c.active !== false);
    if (!cats.length) { grid.innerHTML = '<div class="empty-state">暂无分类</div>'; return; }

    const card = (c) => {
      const pos = c.pts >= 0;
      return `<div class="cat-card ${pos?'positive':'negative'}" onclick="App.quickEntry('${c.id}')">
        <div class="cat-icon">${c.icon || '📌'}</div>
        <div class="cat-name">${c.name || '分类'}</div>
        <div class="cat-pts ${pos?'positive':'negative'}">${pos?'+':''}${c.pts} 分</div>
      </div>`;
    };

    // Split reward (加分) from punishment (扣分), shown one tab at a time.
    // Sort each by point magnitude ascending — small at top, big at bottom.
    const byMag = (a, b) => Math.abs(a.pts) - Math.abs(b.pts);
    const rewards  = cats.filter(c => c.pts >= 0).sort(byMag);
    const punishes = cats.filter(c => c.pts <  0).sort(byMag);
    const active   = S.catTab === 'punish' ? punishes : rewards;

    const tabs = `
      <div class="cat-tabs">
        <div class="cat-tab reward ${S.catTab==='reward'?'active':''}" onclick="App.switchCatTab('reward')">💙 加分</div>
        <div class="cat-tab punish ${S.catTab==='punish'?'active':''}" onclick="App.switchCatTab('punish')">💔 扣分</div>
      </div>`;

    const body = active.length
      ? `<div class="categories-grid">${active.map(card).join('')}</div>`
      : `<div class="empty-state">${S.catTab==='punish'?'还没有扣分项目':'还没有加分项目'}</div>`;

    grid.innerHTML = tabs + body;
  }

  function switchCatTab(tab) {
    S.catTab = tab;
    renderCategories();
  }

  const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六'];
  function formatDayHeader(dateStr) {
    if (!dateStr) return '未知日期';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    const md = `${d.getMonth()+1}月${d.getDate()}日`;
    const wd = WEEKDAYS[d.getDay()];
    if (dateStr === todayStr()) return `今天 · ${md} ${wd}`;
    if (dateStr === todayStr(new Date(now().getTime() - 86400000))) return `昨天 · ${md} ${wd}`;
    return `${md} ${wd}`;
  }

  function renderEntries(entries) {
    const list = document.getElementById('entries-list');
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div>本月还没有记录<br>点上方角色选择记分对象</div>`;
      return;
    }

    // Group consecutive-by-date entries into day buckets, preserving existing order.
    const groups = [];
    const byDate = new Map();
    entries.forEach(e => {
      const key = e.date || '';
      let g = byDate.get(key);
      if (!g) { g = { date: key, items: [], total: 0 }; byDate.set(key, g); groups.push(g); }
      g.items.push(e);
      g.total += (e.pts || 0);
    });

    list.innerHTML = groups.map(g => {
      const dayPos = g.total >= 0;
      const itemsHtml = g.items.map(e => {
        const pos    = e.pts >= 0;
        const charId = e.charId || 'char1';
        const name   = charDisplayName(charId);
        return `<div class="entry-item" id="entry-${e.id}">
          <div class="entry-icon">${e.icon || '📌'}</div>
          <div class="entry-info">
            <div class="entry-cat">${(e.catName && e.catName !== 'undefined') ? e.catName : (e.name && e.name !== 'undefined' ? e.name : '自定义')}</div>
            <div class="entry-desc">${e.desc || ''}</div>
          </div>
          <span class="entry-char-badge ${charId}">${name}</span>
          <div class="entry-pts ${pos?'positive':'negative'}">${pos?'+':''}${e.pts}</div>
          <div class="entry-edit" onclick="App.openEditEntryModal('${e.id}')">✏️</div>
          <div class="entry-delete" onclick="App.deleteEntry('${e.id}')">🗑️</div>
        </div>`;
      }).join('');
      return `<div class="entry-day-group">
        <div class="entry-day-header">
          <span class="entry-day-label">${formatDayHeader(g.date)}</span>
          <span class="entry-day-total ${dayPos?'positive':'negative'}">${dayPos?'+':''}${g.total}</span>
        </div>
        <div class="entry-day-items">${itemsHtml}</div>
      </div>`;
    }).join('');
  }

  /* ── The Pochacco SVG markup (default for char 1) ── */
  const POCHACCO_SVG = `<svg class="char-svg" id="char-svg-1" viewBox="0 0 110 132" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="55" cy="127" rx="25" ry="4" fill="rgba(0,0,0,0.09)"/>
    <g id="pochacco-left-ear">
      <path d="M 28 45 Q 4 43 4 65 Q 4 86 18 93 Q 32 98 39 82 Q 46 64 36 43 Z" fill="#F0F0F0" stroke="#D8D8D8" stroke-width="1.5"/>
    </g>
    <g id="pochacco-right-ear">
      <path d="M 82 45 Q 106 43 106 65 Q 106 86 92 93 Q 78 98 71 82 Q 64 64 74 43 Z" fill="#F0F0F0" stroke="#D8D8D8" stroke-width="1.5"/>
    </g>
    <ellipse cx="55" cy="86" rx="37" ry="42" fill="white" stroke="#D8D8D8" stroke-width="1.5"/>
    <ellipse cx="55" cy="65" rx="27" ry="24" fill="#F8F8F8" stroke="#E0E0E0" stroke-width="1"/>
    <path d="M 39 52 Q 44 48.5 49 52" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 61 52 Q 66 48.5 71 52" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle id="c1-eye-l" cx="44" cy="58" r="5" fill="#1A1A1A"/>
    <circle id="c1-eye-r" cx="66" cy="58" r="5" fill="#1A1A1A"/>
    <circle cx="46" cy="55.5" r="1.8" fill="rgba(255,255,255,0.9)"/>
    <circle cx="68" cy="55.5" r="1.8" fill="rgba(255,255,255,0.9)"/>
    <ellipse cx="55" cy="68" rx="5.5" ry="3.8" fill="#1A1A1A"/>
    <circle cx="53" cy="69" r="1.3" fill="#3A3A3A"/>
    <circle cx="57" cy="69" r="1.3" fill="#3A3A3A"/>
    <path id="pochacco-mouth" d="M 46.5 74 Q 55 84 63.5 74" stroke="#1A1A1A" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="33" y="90" width="44" height="8" rx="4" fill="#5B9BD5" stroke="#2B6AB3" stroke-width="0.5"/>
    <circle cx="55" cy="94" r="3.5" fill="#2B6AB3"/>
    <circle cx="55" cy="94" r="1.5" fill="#A8D4F8"/>
  </svg>`;

  const ADAI_SVG = `<svg class="char-svg" id="char-svg-2" viewBox="0 0 110 132" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="55" cy="127" rx="25" ry="4" fill="rgba(255,143,160,0.15)"/>
    <g id="adai-left-ear">
      <path d="M 28 45 Q 4 43 4 65 Q 4 86 18 93 Q 32 98 39 82 Q 46 64 36 43 Z" fill="#FFB8D0" stroke="#D9607A" stroke-width="1.8"/>
    </g>
    <g id="adai-right-ear">
      <path d="M 82 45 Q 106 43 106 65 Q 106 86 92 93 Q 78 98 71 82 Q 64 64 74 43 Z" fill="#FFB8D0" stroke="#D9607A" stroke-width="1.8"/>
    </g>
    <ellipse cx="55" cy="86" rx="37" ry="42" fill="#FFC8DE" stroke="#D9607A" stroke-width="1.8"/>
    <ellipse cx="55" cy="65" rx="27" ry="24" fill="#FFD9EB" stroke="#D9607A" stroke-width="1"/>
    <path d="M 55 38 Q 42 28 38 36 Q 36 44 44 47 Q 50 49 55 43 Z" fill="#FF8FA0" stroke="#E8607A" stroke-width="0.8"/>
    <path d="M 55 38 Q 68 28 72 36 Q 74 44 66 47 Q 60 49 55 43 Z" fill="#FF8FA0" stroke="#E8607A" stroke-width="0.8"/>
    <ellipse cx="55" cy="40.5" rx="5.5" ry="6" fill="#E8607A"/>
    <circle cx="55" cy="39" r="2.5" fill="#FFB3C6"/>
    <path d="M 39 52 Q 44 48.5 49 52" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 61 52 Q 66 48.5 71 52" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle id="c2-eye-l" cx="44" cy="58" r="5" fill="#1A1A1A"/>
    <circle id="c2-eye-r" cx="66" cy="58" r="5" fill="#1A1A1A"/>
    <circle cx="46" cy="55.5" r="1.8" fill="rgba(255,255,255,0.9)"/>
    <circle cx="68" cy="55.5" r="1.8" fill="rgba(255,255,255,0.9)"/>
    <line x1="38" y1="54" x2="35" y2="51" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="41" y1="52.5" x2="39" y2="49.5" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="72" y1="54" x2="75" y2="51" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="69" y1="52.5" x2="71" y2="49.5" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="55" cy="68" rx="5.5" ry="3.8" fill="#1A1A1A"/>
    <circle cx="53" cy="69" r="1.3" fill="#3A3A3A"/>
    <circle cx="57" cy="69" r="1.3" fill="#3A3A3A"/>
    <path id="adai-mouth" d="M 46.5 74 Q 55 84 63.5 74" stroke="#1A1A1A" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="33" y="90" width="44" height="8" rx="4" fill="#FF8FA0" stroke="#E8607A" stroke-width="0.5"/>
    <circle cx="55" cy="94" r="3.5" fill="#E8607A"/>
    <circle cx="55" cy="94" r="1.5" fill="#FFD4E8"/>
  </svg>`;

  function renderCharacters() {
    // Names
    const n1 = document.getElementById('char-name-1');
    const n2 = document.getElementById('char-name-2');
    if (n1) n1.textContent = S.charName1 || '线条小狗·他';
    if (n2) n2.textContent = S.charName2 || '线条小狗·她';

    // Images (1)
    const wrap1 = document.getElementById('char-img-wrap-1');
    if (wrap1) {
      if (S.charImg1) {
        wrap1.innerHTML = `<img src="${S.charImg1}" class="char-img-custom" alt="${S.charName1}"/>`;
      } else {
        wrap1.innerHTML = POCHACCO_SVG;
      }
    }
    // Images (2)
    const wrap2 = document.getElementById('char-img-wrap-2');
    if (wrap2) {
      if (S.charImg2) {
        wrap2.innerHTML = `<img src="${S.charImg2}" class="char-img-custom pink" alt="${S.charName2}"/>`;
      } else {
        wrap2.innerHTML = ADAI_SVG;
      }
    }
  }

  function renderCharSelector() {
    const p = document.getElementById('char-pochacco');
    const a = document.getElementById('char-adai');
    const isChar1 = S.activeChar === 'char1';

    if (p) { p.classList.toggle('selected', isChar1);  p.classList.toggle('not-selected', !isChar1); }
    if (a) { a.classList.toggle('selected', !isChar1); a.classList.toggle('not-selected', isChar1); }

    // Score badges
    const b1 = document.getElementById('char1-score-badge');
    const b2 = document.getElementById('char2-score-badge');
    const fmtScore = (s) => (s > 0 ? '+' : '') + s;
    if (b1) { b1.textContent = fmtScore(S.char1Score); b1.className = 'char-score-badge ' + (S.char1Score > 0 ? 'pos' : S.char1Score < 0 ? 'neg' : 'zero'); }
    if (b2) { b2.textContent = fmtScore(S.char2Score); b2.className = 'char-score-badge ' + (S.char2Score > 0 ? 'pos' : S.char2Score < 0 ? 'neg' : 'zero'); }

    // Active-for chip
    const chip = document.getElementById('active-for-chip');
    if (chip) {
      chip.textContent = charDisplayName(S.activeChar);
      chip.className   = 'active-char-chip ' + S.activeChar;
    }
  }

  function renderMode() {
    const toggle = document.getElementById('mode-toggle');
    const knob   = document.getElementById('mode-knob');
    const lr     = document.getElementById('label-reward');
    const lp     = document.getElementById('label-punishment');

    if (S.mode === 'reward') {
      toggle.className = 'mode-toggle-wrap reward';
      knob.textContent = '🏆';
      lr.classList.add('active');
      lp.classList.remove('active');
    } else {
      toggle.className = 'mode-toggle-wrap punishment';
      knob.textContent = '😈';
      lr.classList.remove('active');
      lp.classList.add('active');
    }
  }

  async function refresh() {
    S.month = monthKey();
    document.getElementById('month-label').textContent = monthLabel(S.month);
    renderMode();
    renderCharacters();
    renderTogetherBanner();

    const entries = await Data.getEntries();
    S.entries = entries;
    const { char1, char2, neg1, neg2 } = calcCharScores(entries);
    S.char1Score = char1; S.char2Score = char2;
    S.char1NegPts = neg1; S.char2NegPts = neg2;
    S.score = activeScore();

    renderCharSelector();
    renderScore(S.score);
    const info = progressInfo(S.score, S.mode, activeNegPts());
    renderProgress(S.score);
    renderEntryCounts();
    renderCharacterMood(info.pct);
    renderEntries(entries);
    renderCategories();
    renderCheckinBanner();
    // Needs settled history for the lifetime total — fetch in the background
    // so the home page never blocks on it.
    // Needs settled history + letters/photos for the lifetime totals the goal
    // card and the pet both read — fetch in the background so home never waits.
    _loadStatsSources().then(() => {
      renderSharedGoal();
      renderPetBanner();
      _syncPetExp();
    }).catch(() => { renderSharedGoal(); renderPetBanner(); });
  }

  /* ── Daily check-in (签到) ── */
  const CHECKIN_CAT = '📅 每日签到';
  const checkinPtsFor = (d = now()) => (d.getDay() === 0 ? 5 : 2);   // Sunday +5, else +2

  // Check-in entries/dates for a given character (defaults to active)
  function checkinEntries(charId = S.activeChar) {
    return S.entries.filter(e => e.catName === CHECKIN_CAT && (e.charId || 'char1') === charId);
  }
  function checkinDatesFor(charId) {
    return new Set(checkinEntries(charId).map(e => e.date));
  }
  function checkinDates() {
    return checkinDatesFor(S.activeChar);
  }
  // Consecutive check-in days ending today (or yesterday if not yet checked today)
  function checkinStreak() {
    const set = checkinDates();
    const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const d = now();
    if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);   // grace: streak can end yesterday
    let streak = 0;
    while (set.has(fmt(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function renderCheckinBanner() {
    const sub   = document.getElementById('checkin-banner-sub');
    const badge = document.getElementById('checkin-banner-badge');
    if (!badge) return;
    const today   = todayStr();
    const meDone  = checkinDatesFor(S.activeChar).has(today);
    const partner = S.activeChar === 'char1' ? 'char2' : 'char1';
    const paDone  = checkinDatesFor(partner).has(today);
    const paName  = charDisplayName(partner);
    const pts     = checkinPtsFor();
    if (meDone) {
      badge.textContent = '已签到 ✓'; badge.classList.add('done');
    } else {
      badge.textContent = `签到 +${pts}`; badge.classList.remove('done');
    }
    // Show today's status for both partners
    if (sub) sub.innerHTML = `今天 · 你 ${meDone ? '已签 ✓' : '未签'} · ${paName} ${paDone ? '已签 ✓' : '未签'}`;
  }

  function openCheckin() {
    const forEl = document.getElementById('checkin-for');
    if (forEl) forEl.textContent = '· ' + charDisplayName(S.activeChar);
    renderCheckinCalendar();
    openModal('modal-checkin');
  }

  function renderCheckinCalendar() {
    const cal = document.getElementById('checkin-calendar');
    if (!cal) return;
    const c1 = checkinDatesFor('char1');
    const c2 = checkinDatesFor('char2');
    const checked = checkinDates();            // active char (for stats/button)
    const today   = todayStr();
    const nowD    = now();
    const year = nowD.getFullYear(), month = nowD.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();      // 0=Sun
    const daysInMonth  = new Date(year, month + 1, 0).getDate();

    // Today status line for both partners.
    // Built entirely with inline styles (plain centered text) so it renders
    // identically no matter what CSS a cached index.html carries — it cannot
    // overlap, wrap mid-text, or shift position.
    const todayEl = document.getElementById('checkin-today');
    if (todayEl) {
      todayEl.setAttribute('style',
        'display:block;text-align:center;font-size:13px;font-weight:700;line-height:1.9;margin:0 0 14px;');
      const w = (charId, color) => {
        const on = (charId === 'char1' ? c1 : c2).has(today);
        return `<span style="white-space:nowrap;display:inline-block;margin:0 8px;color:${on ? color : '#8A94A6'}">${charId==='char1'?'💙':'🩷'} ${charDisplayName(charId)} ${on?'已签到 ✓':'未签到'}</span>`;
      };
      todayEl.innerHTML = w('char1', '#5B9BD5') + w('char2', '#E8609A');
    }

    // Cell inner layout + dots use inline styles only (classes still provide
    // the background tints / today ring, which are safe) — so the dots are
    // pixel-fixed under each date number regardless of any cached CSS.
    const CELL_LAYOUT = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;';
    const dot = (on, color) =>
      `<i style="display:inline-block;width:6.5px;height:6.5px;border-radius:50%;flex-shrink:0;background:${on ? color : 'var(--cal-dot-off, #DCE2EB)'}"></i>`;

    const wk = ['日','一','二','三','四','五','六'];
    let html = '<div class="cal-weekdays">' +
      wk.map((w,i) => `<div class="cal-weekday ${i===0?'sun':''}">${w}</div>`).join('') + '</div>';
    html += '<div class="cal-grid">';
    for (let i = 0; i < firstWeekday; i++) html += '<div class="cal-cell blank"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dow = new Date(year, month, d).getDay();
      const on1 = c1.has(ds), on2 = c2.has(ds);
      const cls = ['cal-cell'];
      if (dow === 0) cls.push('sun');
      if (on1 || on2) cls.push('any');
      if (ds === today) cls.push('today');
      if (ds > today) cls.push('future');
      html += `<div class="${cls.join(' ')}" style="${CELL_LAYOUT}">
        <span style="line-height:1">${d}</span>
        <span style="display:flex;gap:4px;align-items:center;justify-content:center;height:7px">${dot(on1,'#5B9BD5')}${dot(on2,'#E8609A')}</span>
      </div>`;
    }
    html += '</div>';
    cal.innerHTML = html;

    // Stat cards: streak · this-month days · points earned
    const statsEl = document.getElementById('checkin-stats');
    if (statsEl) {
      const totalPts = checkinEntries().reduce((s, e) => s + (parseInt(e.pts) || 0), 0);
      statsEl.innerHTML = `
        <div class="checkin-stat"><div class="checkin-stat-num streak">🔥 ${checkinStreak()}</div><div class="checkin-stat-label">连续签到</div></div>
        <div class="checkin-stat"><div class="checkin-stat-num days">${checked.size}</div><div class="checkin-stat-label">本月天数</div></div>
        <div class="checkin-stat"><div class="checkin-stat-num pts">+${totalPts}</div><div class="checkin-stat-label">累计积分</div></div>`;
    }

    const isSun = now().getDay() === 0;
    const pts   = checkinPtsFor();

    const btn = document.getElementById('checkin-btn');
    if (btn) {
      btn.classList.toggle('sunday', isSun && !checked.has(today));
      if (checked.has(today)) { btn.disabled = true; btn.textContent = '今天已签到 ✓ 明天再来~'; }
      else { btn.disabled = false; btn.textContent = isSun ? `🎉 周日签到 +${pts} 分` : `今天签到 +${pts} 分`; }
    }

    // Partner "help check in" button — only when partner hasn't checked in today
    const partner   = S.activeChar === 'char1' ? 'char2' : 'char1';
    const paChecked = (partner === 'char1' ? c1 : c2).has(today);
    const pbtn = document.getElementById('checkin-btn-partner');
    if (pbtn) {
      if (paChecked) { pbtn.style.display = 'none'; }
      else {
        pbtn.style.display = '';
        pbtn.disabled = false;
        pbtn.textContent = `💝 帮 ${charDisplayName(partner)} 签到 +${pts}`;
      }
    }
  }

  async function doCheckin(charId = S.activeChar) {
    if (checkinDatesFor(charId).has(todayStr())) { showToast('今天已经签到啦 ✅'); return; }
    const isSun = now().getDay() === 0;
    const pts   = checkinPtsFor();
    const forPartner = charId !== S.activeChar;
    const btnId = forPartner ? 'checkin-btn-partner' : 'checkin-btn';
    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = '签到中…'; }
    try {
      await Data.addEntry({
        id: 'e' + Date.now(),
        catId: '', catName: CHECKIN_CAT, icon: '📅', pts,
        desc: isSun ? '周日签到 🎉' : '每日签到',
        charId, month: S.month, date: todayStr(),
      });
      spawnParticles(true);
      const who = forPartner ? `帮 ${charDisplayName(charId)} ` : '';
      showToast(`📅 ${who}签到成功！+${pts} 分${isSun ? ' 🎉 周日加倍' : ''}`);
      await refresh();
      renderCheckinCalendar();
    } catch (err) {
      showToast('签到失败: ' + err.message);
      renderCheckinCalendar();
    }
  }
  // Check in on behalf of the partner (the non-active character)
  function doCheckinPartner() {
    doCheckin(S.activeChar === 'char1' ? 'char2' : 'char1');
  }

  /* ── Public API ── */
  async function connect() {
    const username = document.getElementById('sn-username').value.trim();
    const password = document.getElementById('sn-password').value;

    if (!username) { _loginErr('请输入账号'); return; }
    if (!password) { _loginErr('请输入密码'); return; }

    const btn = document.getElementById('sn-connect-btn');
    if (btn) { btn.disabled = true; btn.textContent = '验证中…'; }
    _loginErr('');
    S.snInstance = SN_INSTANCE;

    try {
      const result = await snPublicFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      S.apiKey     = result.apiKey;
      S.matchId    = result.matchId   || '';
      S.activeChar = result.charId    || 'char1';
      S.usingSN    = true;

      if (S.activeChar === 'char1') {
        S.charName1 = username;
        if (result.partnerName) S.charName2 = result.partnerName;
      } else {
        S.charName2 = username;
        if (result.partnerName) S.charName1 = result.partnerName;
      }

      localStorage.setItem('sn_api_key',   S.apiKey);
      localStorage.setItem('sn_username',  username);
      localStorage.setItem('sn_char',      S.activeChar);
      localStorage.setItem('sn_match',     S.matchId);
      localStorage.setItem('sn_charname1', S.charName1);
      localStorage.setItem('sn_charname2', S.charName2);

      if (!S.matchId) {
        // Registered but partner hasn't paired yet — show pair code screen
        _showWaitingForPair(result.pairCode || '');
        if (btn) { btn.disabled = false; btn.textContent = '登录'; }
        return;
      }

      await Data.init();
      await refresh();
      document.getElementById('setup-overlay').classList.add('hidden');
      if (S.needsSetup) {
        showSettings();
        showToast('欢迎！请先设置游戏规则 ⚙️');
      } else {
        showToast('✅ 欢迎回来，' + username + '！');
      }
    } catch (err) {
      S.usingSN = false;
      S.apiKey  = '';
      const msg = err.message.includes('401') ? '账号或密码错误'
                : err.message.includes('404') ? '账号不存在，请先注册'
                : err.message.includes('Failed to fetch') ? '无法连接服务器（CORS 或网络问题）'
                : `登录失败：${err.message.slice(0, 80)}`;
      _loginErr(msg);
      if (btn) { btn.disabled = false; btn.textContent = '登录'; }
    }
  }

  async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const charId   = document.querySelector('input[name="reg-char"]:checked')?.value || 'char1';
    const pairCode = charId === 'char2'
      ? (document.getElementById('reg-pair-code')?.value.trim() || '')
      : '';

    if (!username) { _regErr('请输入账号名'); return; }
    if (!password) { _regErr('请输入密码'); return; }
    if (charId === 'char2' && !pairCode) { _regErr('请输入伴侣的配对码'); return; }

    const btn = document.getElementById('reg-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '注册中…'; }
    _regErr('');
    S.snInstance = SN_INSTANCE;

    try {
      const result = await snPublicFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, charId, pairCode }),
      });

      S.apiKey     = result.apiKey;
      S.matchId    = result.matchId   || '';
      S.activeChar = charId;
      S.usingSN    = true;

      if (charId === 'char1') {
        S.charName1 = username;
      } else {
        S.charName2 = username;
        if (result.partnerName) S.charName1 = result.partnerName;
      }

      localStorage.setItem('sn_api_key',   S.apiKey);
      localStorage.setItem('sn_username',  username);
      localStorage.setItem('sn_char',      S.activeChar);
      localStorage.setItem('sn_match',     S.matchId);
      localStorage.setItem('sn_charname1', S.charName1);
      localStorage.setItem('sn_charname2', S.charName2);

      if (charId === 'char1') {
        // Show pair code for partner to use
        document.getElementById('reg-step-1').classList.add('hidden');
        document.getElementById('reg-step-2').classList.remove('hidden');
        document.getElementById('display-pair-code').textContent = result.pairCode || '------';
      } else {
        // char2 paired → enter app
        await Data.init();
        await refresh();
        document.getElementById('setup-overlay').classList.add('hidden');
        if (S.needsSetup) {
          showSettings();
          showToast('欢迎！请先设置游戏规则 ⚙️');
        } else {
          showToast('🎉 配对成功！欢迎，' + username + '！');
        }
      }
    } catch (err) {
      const msg = err.message.includes('409') ? '账号已存在，请直接登录'
                : err.message.includes('404') ? '配对码无效，请重新确认'
                : err.message.includes('400') ? '请填写完整信息'
                : '注册失败，请稍后再试';
      _regErr(msg);
      if (btn) { btn.disabled = false; btn.textContent = '注册'; }
    }
  }

  function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('panel-login').classList.toggle('hidden', !isLogin);
    document.getElementById('panel-register').classList.toggle('hidden', isLogin);
    const tLogin = document.getElementById('tab-login');
    const tReg   = document.getElementById('tab-register');
    if (tLogin) Object.assign(tLogin.style, { background: isLogin ? 'white' : 'transparent', color: isLogin ? 'var(--blue)' : 'var(--sub)', boxShadow: isLogin ? '0 2px 8px rgba(91,155,213,0.18)' : 'none' });
    if (tReg)   Object.assign(tReg.style,   { background: isLogin ? 'transparent' : 'white', color: isLogin ? 'var(--sub)' : 'var(--blue)', boxShadow: isLogin ? 'none' : '0 2px 8px rgba(91,155,213,0.18)' });
    _loginErr('');
    _regErr('');
  }

  function onRegCharChange() {
    const isChar2 = document.querySelector('input[name="reg-char"]:checked')?.value === 'char2';
    document.getElementById('reg-pair-wrap').classList.toggle('hidden', !isChar2);
  }

  function _showWaitingForPair(pairCode) {
    switchTab('register');
    document.getElementById('reg-step-1').classList.add('hidden');
    document.getElementById('reg-step-2').classList.remove('hidden');
    document.getElementById('display-pair-code').textContent = pairCode || '------';
  }

  function _loginErr(msg) {
    const el = document.getElementById('sn-login-err');
    if (el) el.textContent = msg;
  }

  function _regErr(msg) {
    const el = document.getElementById('reg-err');
    if (el) el.textContent = msg;
  }

  async function demoMode() {
    S.usingSN     = false;
    S.snInstance  = 'localhost (Demo)';
    document.getElementById('setup-overlay').classList.add('hidden');
    await Data.init();
    await refresh();
    showToast('📱 本地 Demo 模式');
  }

  function selectChar(charId) {
    S.activeChar = charId;
    S.score = activeScore();
    renderCharSelector();
    renderScore(S.score);
    renderProgress(S.score);
    renderEntryCounts();
    renderCharacterMood(progressInfo(S.score, S.mode, activeNegPts()).pct);
  }

  async function toggleMode() {
    S.mode = S.mode === 'reward' ? 'punishment' : 'reward';
    await Data.saveConfig({ mode: S.mode });
    renderMode();
    S.score = activeScore();
    renderProgress(S.score);
    renderCharacterMood(progressInfo(S.score, S.mode, activeNegPts()).pct);
    showToast(S.mode === 'reward' ? '🏆 切换为奖励模式' : '😈 切换为惩罚模式');
  }

  async function quickEntry(catId) {
    const cat = S.categories.find(c => c.id === catId);
    if (!cat) return;

    spawnParticles(cat.pts >= 0);

    const entry = {
      id: 'e' + Date.now(),
      catId: cat.id,
      catName: cat.name,
      icon: cat.icon,
      pts: cat.pts,
      desc: '',
      charId: S.activeChar,
      month: S.month,
      date: todayStr(),
    };

    try {
      await Data.addEntry(entry);
      showToast(`${cat.icon || '📌'} ${cat.name} ${cat.pts >= 0 ? '+' : ''}${cat.pts} 分！`);
      await refresh();
      checkThreshold();
    } catch (err) {
      showToast('记录失败: ' + err.message);
    }
  }

  function openAddModal() {
    document.getElementById('add-entry-id').value = '';
    document.getElementById('modal-add-title').textContent = '✏️ 自定义记分';
    document.getElementById('modal-add-btn').textContent = '记录 ✨';
    document.getElementById('add-date').value = todayStr();
    document.getElementById('add-desc').value = '';
    const sel = document.getElementById('add-cat-select');
    sel.innerHTML = S.categories.filter(c=>c.active!==false).map(c =>
      `<option value="${c.id}" data-pts="${c.pts}">${c.icon || '📌'} ${c.name} (${c.pts>=0?'+':''}${c.pts})</option>`
    ).join('');
    sel.onchange = () => {
      const opt = sel.selectedOptions[0];
      document.getElementById('add-pts').value = opt?.dataset.pts || '10';
    };
    if (sel.selectedOptions[0]) document.getElementById('add-pts').value = sel.selectedOptions[0].dataset.pts;
    openModal('modal-add');
  }

  function openEditEntryModal(id) {
    const entry = S.entries.find(e => e.id === id);
    if (!entry) return;
    document.getElementById('add-entry-id').value = id;
    document.getElementById('modal-add-title').textContent = '📝 编辑记录';
    document.getElementById('modal-add-btn').textContent = '保存 ✅';
    document.getElementById('add-date').value = entry.date || todayStr();
    document.getElementById('add-pts').value = entry.pts || 0;
    document.getElementById('add-desc').value = entry.desc || '';
    const sel = document.getElementById('add-cat-select');
    const activeCats = S.categories.filter(c=>c.active!==false);
    // System entries (商店兑换, 每日签到) and entries whose category was later
    // deleted have no matching option — without a placeholder the browser
    // auto-selects the first category and saving would silently rewrite the
    // entry's name/icon.
    const inList = activeCats.some(c => c.id === entry.catId);
    // System catNames (每日签到/商店兑换) already embed their emoji — don't
    // prepend the icon again or the option shows it twice.
    const keepName = (entry.catName && entry.catName !== 'undefined') ? entry.catName : '自定义';
    const keepIcon = entry.icon && !keepName.includes(entry.icon) ? entry.icon + ' ' : (entry.icon ? '' : '📌 ');
    const keepOpt = inList ? '' :
      `<option value="__original__" data-pts="${entry.pts || 0}" selected>${keepIcon}${keepName}（原分类）</option>`;
    sel.innerHTML = keepOpt + activeCats.map(c =>
      `<option value="${c.id}" data-pts="${c.pts}" ${c.id === entry.catId ? 'selected' : ''}>${c.icon || '📌'} ${c.name} (${c.pts>=0?'+':''}${c.pts})</option>`
    ).join('');
    sel.onchange = () => {
      const opt = sel.selectedOptions[0];
      document.getElementById('add-pts').value = opt?.dataset.pts || '10';
    };
    openModal('modal-add');
  }

  async function submitEntry() {
    const editId = document.getElementById('add-entry-id').value;
    const catId  = document.getElementById('add-cat-select').value;
    const pts    = parseInt(document.getElementById('add-pts').value) || 0;
    const desc   = document.getElementById('add-desc').value.trim();
    const date   = document.getElementById('add-date').value || todayStr();
    const cat    = S.categories.find(c => c.id === catId) || {};

    try {
      if (editId) {
        const existing = S.entries.find(e => e.id === editId);
        // "__original__" = system/deleted category kept as-is: only update
        // the editable fields, never rewrite the entry's identity.
        const keep = catId === '__original__';
        await Data.updateEntry(editId, {
          catId:   keep ? (existing?.catId || '') : catId,
          catName: keep ? (existing?.catName || '自定义') : (cat.name || existing?.catName || '自定义'),
          icon:    keep ? (existing?.icon || '📌')       : (cat.icon || existing?.icon || '📌'),
          pts, desc, date,
        });
        closeModal('modal-add');
        showToast('已更新 ✅');
      } else {
        const entry = {
          id: 'e' + Date.now(),
          catId, catName: cat.name || '自定义',
          icon: cat.icon || '📌',
          pts, desc, date,
          charId: S.activeChar,
          month: S.month,
        };
        spawnParticles(pts >= 0);
        await Data.addEntry(entry);
        closeModal('modal-add');
        document.getElementById('add-desc').value = '';
        showToast(`已记录 ${pts>=0?'+':''}${pts} 分 ✅`);
        checkThreshold();
      }
      await refresh();
    } catch (err) {
      showToast('操作失败: ' + err.message);
    }
  }

  async function deleteEntry(id) {
    if (!(await showConfirm('确认删除这条记录？'))) return;
    try {
      await Data.deleteEntry(id);
      showToast('已删除 🗑️');
      await refresh();
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  // Group entries by the calendar month they were actually logged in. Needed
  // because GET /entries returns every UNSETTLED entry regardless of month
  // (see Data.getEntries) — if a 月末结算 gets missed, older months' entries
  // stay visible instead of silently disappearing, and each one still needs
  // its own accurate history record rather than being lumped together.
  function _groupEntriesByMonth(entries) {
    const map = new Map();
    entries.forEach(e => {
      const m = e.month || (e.date ? e.date.slice(0, 7) : S.month);
      if (!map.has(m)) map.set(m, []);
      map.get(m).push(e);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));  // oldest first
  }

  // Same score/outcome logic as outcomeScoreFor()/getOutcome(), scoped to an
  // arbitrary entries subset instead of the couple's all-time S.char*Score.
  function _monthOutcomes(entries) {
    const { char1, char2, neg1, neg2 } = calcCharScores(entries);
    const s1 = S.mode === 'reward' ? char1 : -neg1;
    const s2 = S.mode === 'reward' ? char2 : -neg2;
    return {
      s1, s2,
      o1: getOutcome(s1, S.mode), o2: getOutcome(s2, S.mode),
      i1: progressInfo(char1, S.mode, neg1), i2: progressInfo(char2, S.mode, neg2),
    };
  }

  let _pendingSettleGroups = [];   // [[month, entries], ...] chosen at confirm time
  let _settlePastGroups    = [];   // months that are definitely over
  let _settleCurrentGroup  = null; // [month, entries] for the still-running month

  function openSettleModal() {
    // Nothing logged → settling would just create an empty record.
    // Give clear feedback instead of opening a modal that appears to do nothing.
    if (!S.entries.length) {
      showToast('📭 还没有任何记分，先记录一下再结算吧！');
      return;
    }
    // The current month is still being lived in — closing it early would wipe
    // a half-finished month's points. Past months are over and safe to sweep;
    // the current one is only settled if the user explicitly ticks the box.
    const groups   = _groupEntriesByMonth(S.entries);
    const thisMonth = monthKey();
    _settlePastGroups   = groups.filter(([m]) => m < thisMonth);
    _settleCurrentGroup = groups.find(([m]) => m >= thisMonth) || null;

    const prev = document.getElementById('settle-preview');
    const fmtScore = s => (s > 0 ? '+' : '') + s;

    const charCard = (charId, score, info, outcome) => {
      const name   = charDisplayName(charId);
      const result = outcome
        ? (S.mode === 'reward' ? `🎊 ${outcome.icon || '🎁'} ${outcome.name}` : `⚠️ ${outcome.icon || '⚠️'} ${outcome.name}`)
        : '😐 无结果';
      return `<div class="settle-char-card ${charId}">
        <div class="sc-name">${name}</div>
        <div class="sc-score">${fmtScore(score)}</div>
        <div class="sc-pct">${info.pct}% 完成</div>
        <div class="sc-result">${result}</div>
      </div>`;
    };

    const monthBlock = ([month, monthEntries], isCurrent) => {
      const r = _monthOutcomes(monthEntries);
      const anyReward = S.mode === 'reward' && (r.o1 || r.o2);
      const anyPunish = S.mode === 'punishment' && (r.o1 || r.o2);
      return `<div class="settle-month-block">
        <div class="sp-icon">${anyReward ? '🎊' : anyPunish ? '😱' : '📊'}</div>
        <div class="sp-title">${monthLabel(month)} 结算${isCurrent ? '（本月·进行中）' : ''}</div>
        <div class="settle-char-row">
          ${charCard('char1', r.s1, r.i1, r.o1)}
          ${charCard('char2', r.s2, r.i2, r.o2)}
        </div>
      </div>`;
    };

    let html = '';
    if (_settlePastGroups.length) {
      html += `<div class="settle-multi-note">⚠️ 有 ${_settlePastGroups.length} 个已过去的月份尚未结算，将分别存入历史记录</div>`;
      html += _settlePastGroups.map(g => monthBlock(g, false)).join('<div class="settle-month-sep"></div>');
    }
    if (_settleCurrentGroup) {
      if (_settlePastGroups.length) html += '<div class="settle-month-sep"></div>';
      html += monthBlock(_settleCurrentGroup, true);
      // Default: OFF when there are past months to clean up (the common
      // "I forgot to settle" case — don't also close the month they're in),
      // ON when the current month is all there is (the normal month-end flow).
      const defaultOn = _settlePastGroups.length === 0;
      html += `<label class="settle-current-opt">
        <input type="checkbox" id="settle-include-current" ${defaultOn ? 'checked' : ''}/>
        <span>同时结算本月（${monthLabel(_settleCurrentGroup[0])}）——本月还没结束，通常等月底再结算</span>
      </label>`;
    }
    html += `<div style="font-size:12px;color:var(--sub);margin-top:4px">结算后对应月份积分清零，开始新的一轮</div>`;

    prev.innerHTML = html;
    openModal('modal-settle');
  }

  async function confirmSettle() {
    // Read the opt-in at confirm time, so the user can tick/untick freely
    // before committing.
    const includeCurrent = !!document.getElementById('settle-include-current')?.checked;
    _pendingSettleGroups = [
      ..._settlePastGroups,
      ...(includeCurrent && _settleCurrentGroup ? [_settleCurrentGroup] : []),
    ];
    if (!_pendingSettleGroups.length) {
      closeModal('modal-settle');
      showToast('ℹ️ 没有选择要结算的月份');
      return;
    }
    try {
      let res, r;
      // Settle oldest → newest so history stays in the order it happened.
      for (const [month, monthEntries] of _pendingSettleGroups) {
        r = _monthOutcomes(monthEntries);
        res = await Data.settleMonth(
          month, r.s1, r.s2, S.mode,
          r.o1 ? r.o1.name : '无结果',
          r.o2 ? r.o2.name : '无结果'
        );
      }
      closeModal('modal-settle');

      const multi = _pendingSettleGroups.length > 1;
      if (res && res.alreadySettled) {
        showToast('✅ 已由对方结算，同步中…');
      } else if (multi) {
        showToast(`✅ 已补齐结算 ${_pendingSettleGroups.length} 个月份！`);
      } else if (S.mode === 'reward' && (r.o1 || r.o2))    { spawnConfetti(); showToast('🎊 恭喜！奖励达成！'); }
      else if (S.mode === 'punishment' && (r.o1 || r.o2)) { spawnFlash();   showToast('😱 惩罚触发！'); }
      else                                                { showToast('✅ 已结算，新的一轮开始！'); }

      _pendingSettleGroups = [];
      _settlePastGroups = []; _settleCurrentGroup = null;
      S.month = monthKey();
      try { await Data.reloadTiers(); } catch {}
      await refresh();
    } catch (err) {
      showToast('结算失败: ' + err.message);
    }
  }

  async function nav(page) {
    ['home','tables','history','shop','settings'].forEach(p => {
      document.getElementById('nav-'+p)?.classList.remove('active');
    });
    document.getElementById('nav-'+page)?.classList.add('active');

    if (page === 'tables') {
      await showTables();
    } else if (page === 'history') {
      await showHistory();
    } else if (page === 'settings') {
      showSettings();
    } else if (page === 'shop') {
      await showShop();
    } else if (page === 'home') {
      // Pull latest — the partner may have logged entries or settled the month
      await refresh();
    }
  }

  async function showTables() {
    const content = document.getElementById('modal-tables-content');
    const title   = document.getElementById('modal-tables-title');

    // Always show current claim states — partner may have claimed or settled
    try { await Data.reloadTiers(); } catch {}
    const outcome = getOutcome(outcomeScoreFor(S.activeChar), S.mode);

    if (S.mode === 'reward') {
      title.textContent = '🏆 奖励表';
      const myScore = activeScore();
      const sorted = [...S.rewards].sort((a,b) => a.minPts - b.minPts);
      content.innerHTML = `<div class="tier-table">${
        sorted.map(r => {
          // Claim → bag needs SN; button only when reached and not yet claimed.
          // Claims are per character: the table reflects the ACTIVE character's
          // own claim state, so each partner can claim every reward once.
          let claimHtml = '';
          if (S.usingSN) {
            const myClaimed = S.activeChar === 'char2' ? r.claimed2 : r.claimed1;
            if (myClaimed) {
              claimHtml = `<div class="tier-claimed">✅ 已领取</div>`;
            } else if (myScore >= r.minPts) {
              claimHtml = `<button class="tier-claim-btn" onclick="App.claimReward('${r.id}')">🎁 领取</button>`;
            }
          }
          return `
          <div class="tier-row ${outcome && outcome.id === r.id ? 'current-tier' : ''}">
            <div class="tier-icon">${r.icon || '🎁'}</div>
            <div class="tier-info">
              <div class="tier-name">${r.name}</div>
              <div class="tier-desc">${r.desc}</div>
            </div>
            <div class="tier-pts-label tier-pts-reward">≥ ${r.minPts} 分</div>
            ${claimHtml}
          </div>`;
        }).join('')
      }</div>`;
    } else {
      title.textContent = '😈 惩罚表';
      const sorted = [...S.punishments].sort((a,b) => a.minPts - b.minPts);
      content.innerHTML = `<div class="tier-table">${
        sorted.map(p => `
          <div class="tier-row ${outcome && outcome.id === p.id ? 'current-tier' : ''}">
            <div class="tier-icon">${p.icon || '⚠️'}</div>
            <div class="tier-info">
              <div class="tier-name">${p.name}</div>
              <div class="tier-desc">${p.desc}</div>
            </div>
            <div class="tier-pts-label tier-pts-punish">≥ ${p.minPts} 分</div>
          </div>`).join('')
      }</div>`;
    }
    openModal('modal-tables');
  }

  async function claimReward(rewardId) {
    const r = S.rewards.find(x => x.id === rewardId);
    if (!r) return;
    const who = charDisplayName(S.activeChar);
    if (!(await showConfirm(`以「${who}」的身份领取奖励「${r.icon || '🎁'} ${r.name}」？将放入 TA 的背包 🎒`))) return;
    try {
      await ShopData.claimReward(rewardId);
      spawnConfetti();
      showToast(`🎉 ${who} 已领取「${r.name}」，快去背包看看！`);
      if (S.activeChar === 'char2') r.claimed2 = true; else r.claimed1 = true;
      await showTables();
    } catch (err) {
      const msg = err.message.includes('already_claimed')   ? '这个奖励已经领取过了'
                : err.message.includes('score_not_reached') ? '积分还没达到这个奖励的门槛哦'
                : '领取失败: ' + err.message;
      showToast('⚠️ ' + msg);
    }
  }

  async function showHistory() {
    const records = await Data.getHistory();
    S.historyRecords = records;
    const content = document.getElementById('history-content');

    if (!records.length) {
      content.innerHTML = `<div class="empty-state"><div class="es-icon">📅</div>还没有历史记录</div>`;
    } else {
      const fmtS = s => (s > 0 ? '+' : '') + s;
      content.innerHTML = records.map(r => {
        const c1 = r.char1Pts !== undefined ? r.char1Pts : (r.totalPts || 0);
        const c2 = r.char2Pts !== undefined ? r.char2Pts : 0;
        return `<div class="history-item">
          <div class="history-month">${r.month}</div>
          <div class="history-info">
            <div class="history-result" style="font-size:13px">
              <span class="entry-char-badge char1" style="margin-right:4px">${S.charName1}</span>${fmtS(c1)} → ${r.result1 || r.resultName || '无'}
            </div>
            <div class="history-result" style="font-size:13px;margin-top:3px">
              <span class="entry-char-badge char2" style="margin-right:4px">${S.charName2}</span>${fmtS(c2)} → ${r.result2 || '无'}
            </div>
            <div class="history-score">${r.mode==='reward'?'🏆 奖励':'😈 惩罚'}模式</div>
          </div>
          <div class="history-badge ${r.mode === 'reward' ? 'reward' : 'punishment'}">${r.mode==='reward'?'🏆':'😈'}</div>
        </div>`;
      }).join('');
    }
    openModal('modal-history');
  }

  async function setCharImg(n, input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    showToast('正在处理图片…');
    const data = await compressImage(file, 150, 0.6);
    if (!data) { showToast('图片读取失败'); return; }
    if (n === 1) S.charImg1 = data;
    else         S.charImg2 = data;
    if (S.usingSN) {
      try {
        // charId targets the slot being edited, so either partner can set both
        await snFetch('/auth/charimg', { method: 'PUT', body: JSON.stringify({ charImg: data, charId: n === 1 ? 'char1' : 'char2' }) });
        showToast('📷 图片已同步到 SN！');
      } catch (err) {
        const msg = err.message.includes('partner_not_found') ? '对方还没注册，暂时无法设置 TA 的头像' : '图片同步失败: ' + err.message.slice(0, 60);
        showToast(msg);
      }
    } else {
      await Data.saveConfig({ charImg1: S.charImg1, charImg2: S.charImg2 });
      showToast('📷 图片已更新！');
    }
    renderCharacters();
    _refreshSettingsPreview();
  }

  async function resetCharImg(n) {
    if (n === 1) S.charImg1 = '';
    else         S.charImg2 = '';
    if (S.usingSN) {
      try { await snFetch('/auth/charimg', { method: 'PUT', body: JSON.stringify({ charImg: '', charId: n === 1 ? 'char1' : 'char2' }) }); }
      catch { /* best effort */ }
    } else {
      await Data.saveConfig({ charImg1: S.charImg1, charImg2: S.charImg2 });
    }
    renderCharacters();
    _refreshSettingsPreview();
    showToast('已重置为默认图片');
  }

  function _refreshSettingsPreview() {
    for (const n of [1, 2]) {
      const img    = n === 1 ? S.charImg1 : S.charImg2;
      const svg    = n === 1 ? POCHACCO_SVG : ADAI_SVG;
      const wrap   = document.getElementById(`img${n}-preview-wrap`);
      const reset  = document.getElementById(`img${n}-reset`);
      const label  = document.getElementById(`img${n}-name`);
      if (!wrap) continue;
      if (img) {
        wrap.innerHTML = `<img src="${img}" class="char-picker-preview" style="border-radius:50% 50% 40% 40%"/>`;
        if (reset) reset.style.display = 'flex';
      } else {
        // Show mini SVG
        const miniSvg = svg.replace('class="char-svg"', 'class="char-picker-preview svg-preview"');
        wrap.innerHTML = miniSvg;
        if (reset) reset.style.display = 'none';
      }
      if (label) label.textContent = n === 1 ? (S.charName1 || 'Pochacco') : (S.charName2 || '阿呆');
    }
  }

  /* ── Settings: reset actions ── */

  // Wipes ONLY this device's local試玩 data. Deliberately hidden while signed
  // in to ServiceNow so it can never be mistaken for "delete our real data".
  async function clearDemoData() {
    if (S.usingSN) { showToast('云端账号不需要清除本地数据'); return; }
    if (!(await showConfirm('清除这台设备上的本地 Demo 数据？\n所有试玩的记录、情书、回忆、宠物都会消失，且无法恢复。'))) return;
    localStorage.removeItem(LS.KEY);
    showToast('🧹 已清除，正在重新开始…');
    setTimeout(() => location.reload(), 700);
  }

  // Re-adopting is the one legitimate way to reset EXP: a fresh petBase is
  // sent alongside petExp 0, which is the only case r02 allows the stored
  // high-water mark to drop (see the pet notes in CLAUDE.md).
  async function resetPet() {
    if (!S.petSpecies) { openPetAdopt(); return; }
    if (!(await showConfirm(`确定让「${petName()}」重新开始吗？\n等级、经验和小窝币都会清零，可以重新选一只从 0 养起。\n（已买的家具会保留）`))) return;
    try {
      await _loadStatsSources();
      // Need the bag loaded to know what the outgoing pet actually spent —
      // 重置 is reachable from 设置, which never opens the room.
      try { S.decorOwned = await Data.getDecorOwned(); } catch { /* keep last known */ }
      const base = petExpDerived();
      const eq = S.equipped || (S.equipped = defaultEquipped());
      eq.sf = decorSpentTotal();
      S.petSpecies = ''; S.petName = ''; S.petBase = base; S.petExpStored = 0;
      await Data.saveConfig({ petSpecies: '', petName: '', petBase: base, petExp: 0,
                              petEquipped: JSON.stringify(eq) });
      closeModal('modal-settings');
      renderPetBanner();
      showToast('🥚 可以重新领养啦');
      openPetAdopt();
    } catch (err) {
      showToast('重置失败: ' + err.message);
    }
  }

  function showSettings() {
    const themeSel = document.getElementById('cfg-theme');
    if (themeSel) themeSel.value = themeMode();
    const demoBtn = document.getElementById('cfg-clear-demo');
    if (demoBtn) demoBtn.style.display = S.usingSN ? 'none' : 'flex';
    document.getElementById('cfg-reward-target').value    = S.rewardTarget;
    document.getElementById('cfg-punish-threshold').value = S.punishThreshold;
    document.getElementById('cfg-name1').value = S.charName1 || 'Pochacco';
    document.getElementById('cfg-name2').value = S.charName2 || '阿呆';
    document.getElementById('cfg-start-date').value = S.startDate || '';
    _refreshSettingsPreview();
    openModal('modal-settings');
  }

  async function saveConfig() {
    const rewardTarget    = parseInt(document.getElementById('cfg-reward-target').value)    || 100;
    const punishThreshold = parseInt(document.getElementById('cfg-punish-threshold').value) || -80;
    const charName1   = document.getElementById('cfg-name1').value.trim() || 'Pochacco';
    const charName2   = document.getElementById('cfg-name2').value.trim() || '阿呆';
    const startDate   = document.getElementById('cfg-start-date').value  || '';
    S.rewardTarget    = rewardTarget;
    S.punishThreshold = punishThreshold;
    S.charName1       = charName1;
    S.charName2       = charName2;
    S.startDate       = startDate;
    await Data.saveConfig({ mode: S.mode, rewardTarget, punishThreshold, charName1, charName2, startDate, charImg1: S.charImg1, charImg2: S.charImg2 });
    closeModal('modal-settings');
    await refresh();
    renderTogetherBanner();
    showToast('设置已保存 ✅');
  }

  function renderTogetherBanner() {
    const el = document.getElementById('together-days');
    if (!el) return;
    if (!S.startDate) { el.textContent = '-- 天'; return; }
    const start = new Date(S.startDate);
    const days  = Math.floor((Date.now() - start.getTime()) / 86400000);
    el.textContent = days >= 0 ? `${days} 天` : '-- 天';
  }

  function showLovePage() {
    const pg = document.getElementById('love-page');
    if (!pg) return;
    const n1 = document.getElementById('love-name1');
    const n2 = document.getElementById('love-name2');
    const dn = document.getElementById('love-days-num');
    const sd = document.getElementById('love-since-date');
    const ly = document.getElementById('lp-years');
    const lm = document.getElementById('lp-months');
    const lw = document.getElementById('lp-weeks');
    if (n1) n1.textContent = S.charName1 || '--';
    if (n2) n2.textContent = S.charName2 || '--';
    if (S.startDate) {
      const start = new Date(S.startDate);
      const days  = Math.floor((Date.now() - start.getTime()) / 86400000);
      if (dn) dn.textContent = days >= 0 ? days : '--';
      if (ly) ly.textContent = days >= 0 ? Math.floor(days / 365) : '--';
      if (lm) lm.textContent = days >= 0 ? Math.floor(days / 30) : '--';
      if (lw) lw.textContent = days >= 0 ? Math.floor(days / 7) : '--';
      if (sd) sd.textContent = S.startDate;
    } else {
      if (dn) dn.textContent = '--';
      if (ly) ly.textContent = '--';
      if (lm) lm.textContent = '--';
      if (lw) lw.textContent = '--';
      if (sd) sd.textContent = '未设置（可在设置中添加）';
    }
    pg.classList.add('open');
    loadMemories();   // async fill of the 回忆相册 strip
  }

  function closeLovePage() {
    document.getElementById('love-page')?.classList.remove('open');
  }

  /* ── 情书 page (private letters between the couple only) ── */
  async function showLetters() {
    const pg = document.getElementById('letter-page');
    if (!pg) return;
    pg.classList.add('open');
    await loadLetters();
  }

  function closeLetters() {
    document.getElementById('letter-page')?.classList.remove('open');
  }

  async function loadLetters() {
    try {
      S.letters = await Data.getLetters();
    } catch (err) {
      showToast('情书加载失败: ' + err.message);
    }
    renderLetters();
  }

  function _letterTimeLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const hm = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const dateStr = todayStr(d);
    if (dateStr === todayStr()) return `今天 ${hm}`;
    if (dateStr === todayStr(new Date(now().getTime() - 86400000))) return `昨天 ${hm}`;
    return `${d.getMonth()+1}月${d.getDate()}日 ${hm}`;
  }

  function renderLetters() {
    const list = document.getElementById('letter-list');
    if (!list) return;
    const letters = S.letters || [];
    if (!letters.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">💌</div>还没有情书<br>写第一封给对方吧</div>`;
      return;
    }
    list.innerHTML = letters.map(l => {
      const mine    = (l.charId || 'char1') === S.activeChar;
      const sealed  = !mine && !l.opened;
      const sender  = charDisplayName(l.charId || 'char1');
      const text    = l.text || '';
      const preview = sealed
        ? '一封悄悄话，点击拆开 💌'
        : _escHtml(text.length > 40 ? text.slice(0, 40) + '…' : text);
      const delBtn = mine ? `<div class="letter-card-delete" onclick="event.stopPropagation();App.deleteLetter('${l.id}')">🗑</div>` : '';
      return `<div class="letter-card ${mine ? 'mine' : 'theirs'} ${sealed ? 'sealed' : ''}" onclick="App.openLetterReader('${l.id}')">
        <div class="letter-card-icon">${sealed ? '💌' : '📖'}</div>
        <div class="letter-card-info">
          <div class="letter-card-top">
            <span class="letter-card-sender">${sender}</span>
            <span class="letter-card-time">${_letterTimeLabel(l.date)}</span>
          </div>
          <div class="letter-card-preview ${sealed ? 'sealed' : ''}">${preview}</div>
        </div>
        ${delBtn}
      </div>`;
    }).join('');
  }

  function openComposeLetter() {
    document.getElementById('letter-compose-text').value = '';
    openModal('modal-letter-compose');
  }

  async function sendLetter() {
    const ta = document.getElementById('letter-compose-text');
    const text = (ta?.value || '').trim();
    if (!text) return;
    try {
      await Data.addLetter({ charId: S.activeChar, text, date: new Date().toISOString(), opened: false });
      closeModal('modal-letter-compose');
      showToast('💌 信已封好送出');
      await loadLetters();
    } catch (err) {
      showToast('发送失败: ' + err.message);
    }
  }

  async function openLetterReader(id) {
    const letter = (S.letters || []).find(l => l.id === id);
    if (!letter) return;
    S.letterReaderId = id;

    const mine   = (letter.charId || 'char1') === S.activeChar;
    const sealed = !mine && !letter.opened;

    document.getElementById('letter-paper-sender').textContent = charDisplayName(letter.charId || 'char1');
    document.getElementById('letter-paper-time').textContent   = _letterTimeLabel(letter.date);
    document.getElementById('letter-paper-text').textContent   = letter.text || '';

    const overlay  = document.getElementById('letter-reader-overlay');
    const envelope = document.getElementById('envelope-big');
    const paper    = document.getElementById('letter-paper');
    if (!overlay || !envelope || !paper) return;

    overlay.classList.add('open');
    envelope.classList.remove('unsealed');
    paper.classList.remove('show');

    if (sealed) {
      envelope.style.display = 'flex';
      paper.style.display = 'none';
      setTimeout(() => {
        envelope.classList.add('unsealed');
        setTimeout(async () => {
          envelope.style.display = 'none';
          paper.style.display = 'flex';
          requestAnimationFrame(() => paper.classList.add('show'));
          letter.opened = true;
          renderLetters();
          try { await Data.markLetterOpened(id); } catch (e) { /* best-effort */ }
        }, 650);
      }, 300);
    } else {
      envelope.style.display = 'none';
      paper.style.display = 'flex';
      requestAnimationFrame(() => paper.classList.add('show'));
    }
  }

  function closeLetterReader() {
    document.getElementById('letter-reader-overlay')?.classList.remove('open');
    S.letterReaderId = null;
  }

  async function deleteLetter(id) {
    if (!(await showConfirm('删除这封情书？'))) return;
    try {
      await Data.deleteLetter(id);
      if (S.letterReaderId === id) closeLetterReader();
      await loadLetters();
      showToast('🗑️ 已删除');
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  /* ── 回忆相册 + Ken Burns 放映 (memory photos & slideshow) ── */
  let _pendingPhotoData = '';   // compressed image awaiting caption/date
  const _show = { idx: 0, timer: null, playing: false, layerFlip: false };
  const SHOW_INTERVAL = 6000;   // ms per photo — keep in sync with the kb-* CSS animations

  async function loadMemories() {
    try {
      S.photos = await Data.getPhotos();
    } catch (err) {
      S.photos = [];
    }
    renderMemoryStrip();
  }

  function renderMemoryStrip() {
    const strip = document.getElementById('lp-mem-strip');
    if (!strip) return;
    const thumbs = (S.photos || []).map(p =>
      `<div class="lp-mem-thumb">
        <img src="${p.image}" alt=""/>
        <span class="lp-mem-del" onclick="event.stopPropagation();App.deleteMemoryPhoto('${p.id}')">✕</span>
      </div>`
    ).join('');
    strip.innerHTML = thumbs +
      `<label class="lp-mem-add">＋
        <input type="file" accept="image/*" style="display:none" onchange="App.pickMemoryPhoto(this)"/>
      </label>`;
    const play = document.getElementById('lp-mem-play');
    if (play) play.style.display = (S.photos || []).length ? '' : 'none';
  }

  async function pickMemoryPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    showToast('正在处理图片…');
    // ~900px / q0.55 keeps the base64 under SN's u_image field limit (200k chars)
    const data = await compressImage(file, 900, 0.55);
    if (!data) { showToast('图片读取失败'); return; }
    if (data.length > 190000) { showToast('⚠️ 图片太大，请换一张试试'); return; }
    _pendingPhotoData = data;
    document.getElementById('memory-caption').value = '';
    document.getElementById('memory-date').value = todayStr();
    document.getElementById('memory-preview').src = data;
    openModal('modal-memory');
  }

  async function saveMemoryPhoto() {
    if (!_pendingPhotoData) return;
    const caption = document.getElementById('memory-caption').value.trim();
    const date    = document.getElementById('memory-date').value || todayStr();
    try {
      await Data.addPhoto({ charId: S.activeChar, image: _pendingPhotoData, caption, date });
      _pendingPhotoData = '';
      closeModal('modal-memory');
      showToast('📷 回忆已收藏！');
      await loadMemories();
    } catch (err) {
      showToast('保存失败: ' + err.message.slice(0, 80));
    }
  }

  async function deleteMemoryPhoto(id) {
    if (!(await showConfirm('删除这张回忆照片？'))) return;
    try {
      await Data.deletePhoto(id);
      await loadMemories();
      showToast('🗑️ 已删除');
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  /* Slideshow engine: two stacked layers crossfade; the incoming layer gets
     an alternating Ken Burns zoom/pan animation. */
  function playMemories() {
    if (!(S.photos || []).length) { showToast('还没有回忆照片，先添加一张吧 📷'); return; }
    _show.idx = 0;
    _show.playing = true;
    document.getElementById('memory-show')?.classList.add('open');
    _showPhoto(0, true);
    _scheduleNext();
    _updatePlayBtn();
  }

  function _scheduleNext() {
    clearTimeout(_show.timer);
    _show.timer = setTimeout(() => { if (_show.playing) _advance(1); }, SHOW_INTERVAL);
  }

  function _advance(dir) {
    const n = S.photos.length;
    _show.idx = (_show.idx + dir + n) % n;
    _showPhoto(_show.idx, false);
    if (_show.playing) _scheduleNext();
  }

  function _showPhoto(i, first) {
    const p = S.photos[i];
    if (!p) return;
    const incoming = document.getElementById(_show.layerFlip ? 'mem-layer-a' : 'mem-layer-b');
    const outgoing = document.getElementById(_show.layerFlip ? 'mem-layer-b' : 'mem-layer-a');
    _show.layerFlip = !_show.layerFlip;
    if (!incoming || !outgoing) return;

    incoming.querySelector('.mem-fg').src = p.image;
    incoming.querySelector('.mem-bg').src = p.image;
    incoming.classList.remove('kb-a', 'kb-b');
    void incoming.offsetWidth;                       // restart the CSS animation
    incoming.classList.add(i % 2 === 0 ? 'kb-a' : 'kb-b');
    incoming.classList.add('show');
    outgoing.classList.remove('show');

    const cap = document.getElementById('mem-caption');
    if (cap) {
      const d = p.date ? p.date.replaceAll('-', ' · ') : '';
      cap.innerHTML = `<div class="mem-cap-date">${d}</div>` +
                      (p.caption ? `<div class="mem-cap-text">${_escHtml(p.caption)}</div>` : '');
      cap.classList.remove('show');
      void cap.offsetWidth;
      cap.classList.add('show');
    }
    const dots = document.getElementById('mem-dots');
    if (dots) dots.innerHTML = S.photos.map((_, k) =>
      `<span class="mem-dot ${k === i ? 'on' : ''}"></span>`).join('');
  }

  function memoryPrev() { _advance(-1); }
  function memoryNext() { _advance(1); }

  function toggleMemoryPlay() {
    _show.playing = !_show.playing;
    if (_show.playing) _scheduleNext(); else clearTimeout(_show.timer);
    _updatePlayBtn();
  }

  function _updatePlayBtn() {
    const b = document.getElementById('mem-play-btn');
    if (b) b.textContent = _show.playing ? '⏸' : '▶';
  }

  function closeMemories() {
    _show.playing = false;
    clearTimeout(_show.timer);
    document.getElementById('memory-show')?.classList.remove('open');
  }

  /* ══════════════ 共同目标 · 成就徽章 · 年度回顾 ══════════════
     All three read from data the app already has — the only backend touch is
     three u_goal_* fields on the existing u_love_config row (shared goal). */

  // Lifetime points the couple has banked together: every settled month's
  // positive totals plus whatever is currently unsettled. Punishment-mode
  // months store negative "bad behaviour" totals — those aren't contributions,
  // so they're floored at 0 rather than eating into the shared pool.
  function lifetimeCombinedPoints() {
    const settled = (S.historyRecords || []).reduce((sum, r) =>
      sum + Math.max(0, parseInt(r.char1Pts) || 0) + Math.max(0, parseInt(r.char2Pts) || 0), 0);
    const current = Math.max(0, S.char1Score) + Math.max(0, S.char2Score);
    return settled + current;
  }

  function renderSharedGoal() {
    const card = document.getElementById('goal-card');
    if (!card) return;
    if (!S.goalTarget) {
      card.innerHTML = `<div class="goal-empty" onclick="App.openGoalModal()">
        <span class="goal-empty-icon">🤝</span>
        <div>
          <div class="goal-empty-title">设定共同目标</div>
          <div class="goal-empty-sub">一起攒积分，换一件大的 →</div>
        </div>
      </div>`;
      return;
    }
    const have = lifetimeCombinedPoints();
    const pct  = Math.min(100, Math.round((have / S.goalTarget) * 100));
    const done = have >= S.goalTarget;
    card.innerHTML = `<div class="goal-box ${done ? 'done' : ''}" onclick="App.openGoalModal()">
      <div class="goal-head">
        <span class="goal-icon">${S.goalIcon || '🎯'}</span>
        <div class="goal-title">${_escHtml(S.goalName || '共同目标')}</div>
        <span class="goal-pct">${pct}%</span>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-foot">${done ? '🎉 目标达成！一起去兑现吧' : `两人共攒 ${have} / ${S.goalTarget} 分`}</div>
    </div>`;
  }

  function openGoalModal() {
    document.getElementById('goal-name').value   = S.goalName || '';
    document.getElementById('goal-icon').value   = S.goalIcon || '🎯';
    document.getElementById('goal-target').value = S.goalTarget || '';
    document.getElementById('goal-delete-btn').style.display = S.goalTarget ? '' : 'none';
    openModal('modal-goal');
  }

  async function saveGoal() {
    const name   = document.getElementById('goal-name').value.trim();
    const icon   = document.getElementById('goal-icon').value.trim() || '🎯';
    const target = parseInt(document.getElementById('goal-target').value) || 0;
    if (!name || target <= 0) { showToast('请填写目标名称和分数'); return; }
    S.goalName = name; S.goalIcon = icon; S.goalTarget = target;
    try {
      await Data.saveConfig({ goalName: name, goalIcon: icon, goalTarget: target });
      closeModal('modal-goal');
      renderSharedGoal();
      showToast('🤝 共同目标已设定！');
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  }

  async function clearGoal() {
    if (!(await showConfirm('取消这个共同目标？'))) return;
    S.goalName = ''; S.goalTarget = 0;
    try {
      await Data.saveConfig({ goalName: '', goalIcon: '🎯', goalTarget: 0 });
      closeModal('modal-goal');
      renderSharedGoal();
      showToast('已取消共同目标');
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  }

  /* ── 成就徽章 ── */
  // Every badge is derived on the fly, so they stay correct even if data is
  // edited or deleted later — nothing to store, nothing to migrate.
  function computeAchievements() {
    const hist     = S.historyRecords || [];
    const letters  = (S.letters || []).length;
    const photos   = (S.photos  || []).length;
    const entries  = S.entries || [];
    const streak   = Math.max(_streakFor('char1'), _streakFor('char2'));
    const lifetime = lifetimeCombinedPoints();
    const purchases = entries.filter(isPurchaseEntry).length;
    const badMarks  = entries.filter(e => (parseInt(e.pts) || 0) < 0 && !isPurchaseEntry(e)).length;
    const wonReward = hist.some(r => r.mode === 'reward' &&
      ((r.result1 && r.result1 !== '无结果') || (r.result2 && r.result2 !== '无结果')));
    const bothCheckedToday = checkinDatesFor('char1').has(todayStr()) &&
                             checkinDatesFor('char2').has(todayStr());

    const A = (id, icon, name, desc, ok, cur, target) =>
      ({ id, icon, name, desc, unlocked: !!ok, cur, target });

    return [
      A('first_entry', '🌱', '第一笔记录', '记下第一条积分',
        entries.length > 0 || hist.length > 0),
      A('streak3',  '📅', '签到新手',   '连续签到 3 天',   streak >= 3,  streak, 3),
      A('streak7',  '🔥', '签到达人',   '连续签到 7 天',   streak >= 7,  streak, 7),
      A('streak30', '💪', '签到王者',   '连续签到 30 天',  streak >= 30, streak, 30),
      A('both_today', '💞', '心有灵犀', '两个人同一天都签到', bothCheckedToday),
      A('letter1',  '💌', '第一封情书', '写下第一封情书',  letters >= 1),
      A('letter10', '💝', '情书收藏家', '累计 10 封情书',  letters >= 10, letters, 10),
      A('photo1',   '📷', '第一张回忆', '收藏第一张照片',  photos >= 1),
      A('photo20',  '🎞', '回忆满满',   '收藏 20 张回忆',  photos >= 20, photos, 20),
      A('shop1',    '🛒', '首次兑换',   '在商店兑换一次',  purchases >= 1),
      A('reward1',  '🏆', '首次达成奖励', '结算时拿到奖励', wonReward),
      A('clean',    '✨', '零扣分',     '本轮一次扣分都没有', entries.length > 0 && badMarks === 0),
      A('season',   '📆', '坚持一季',   '结算过 3 个月',   hist.length >= 3,  hist.length, 3),
      A('year',     '🎊', '坚持一年',   '结算过 12 个月',  hist.length >= 12, hist.length, 12),
      A('pts500',   '💰', '积分 500',   '两人共攒 500 分', lifetime >= 500,  lifetime, 500),
      A('pts2000',  '👑', '积分 2000',  '两人共攒 2000 分', lifetime >= 2000, lifetime, 2000),
    ];
  }

  // Streak for either character (checkinStreak() is hardcoded to the active one)
  function _streakFor(charId) {
    const set = checkinDatesFor(charId);
    const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const d = now();
    if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  async function showAchievements() {
    await _loadStatsSources(true);   // exact counts matter here
    const list = computeAchievements();
    S.achievements = list;
    const got = list.filter(a => a.unlocked).length;
    document.getElementById('ach-summary').innerHTML =
      `已解锁 <b>${got}</b> / ${list.length} 枚徽章`;
    document.getElementById('ach-grid').innerHTML = list.map(a => {
      const prog = (!a.unlocked && a.target)
        ? `<div class="ach-prog"><div class="ach-prog-fill" style="width:${Math.min(100, Math.round((a.cur / a.target) * 100))}%"></div></div>
           <div class="ach-prog-txt">${a.cur} / ${a.target}</div>`
        : '';
      return `<div class="ach-card ${a.unlocked ? 'on' : 'off'}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        ${prog}
      </div>`;
    }).join('');
    openModal('modal-achievements');
  }

  // History/letters/photos aren't kept fresh by refresh() — pull them once
  // before anything that reports across all of them.
  async function _loadStatsSources(force = false) {
    try {
      S.historyRecords = (await Data.getHistory().catch(() => [])) || [];
      if (force || !_heavyStatsLoaded) {
        const [letters, photos] = await Promise.all([
          Data.getLetters().catch(() => []),
          Data.getPhotos().catch(() => []),
        ]);
        S.letters = letters || [];
        S.photos  = photos  || [];
        _heavyStatsLoaded = true;
      }
    } catch (e) { /* best effort — badges just show what we do have */ }
  }

  /* ── 年度回顾 ── */
  // `yearEntries` should be the FULL year (settled entries included) from
  // Data.getEntriesOfYear. Counting from S.entries alone was the bug behind
  // "5 次签到" for a whole year: settling archives entries out of /entries,
  // so every month before the current one silently disappeared from the tally.
  function computeYearReview(year, yearEntries) {
    const yr = String(year);
    const hist    = (S.historyRecords || []).filter(r => (r.month || '').startsWith(yr));
    const letters = (S.letters || []).filter(l => (l.date || '').startsWith(yr));
    const photos  = (S.photos  || []).filter(p => (p.date || '').startsWith(yr));

    const entries = (yearEntries && yearEntries.length)
      ? yearEntries
      : (S.entries || []).filter(e => (e.date || '').startsWith(yr));

    const monthOf = (e) => e.month || (e.date || '').slice(0, 7);
    const monthsWithEntries = new Set(entries.map(monthOf));

    // Points use the SAME net basis as the shared goal and the home-page score.
    // They used to count only positive entries here, which made 年度回顾 report
    // a bigger number than 共同目标 for what looks like the same thing (977 vs
    // 792) — confusing, and there is no good reason for two definitions.
    // A settled month is authoritative from its archived total; an unsettled
    // month is summed from its entries, penalties and shop spending included.
    const settledMonths = new Set(hist.map(r => r.month));
    const monthTotals = {};
    hist.forEach(r => {
      monthTotals[r.month] = Math.max(0, parseInt(r.char1Pts) || 0)
                           + Math.max(0, parseInt(r.char2Pts) || 0);
    });
    entries.forEach(e => {
      const m = monthOf(e);
      if (settledMonths.has(m)) return;             // already counted above
      monthTotals[m] = (monthTotals[m] || 0) + (parseInt(e.pts) || 0);
    });
    Object.keys(monthTotals).forEach(m => {         // a month never goes negative
      if (monthTotals[m] < 0) monthTotals[m] = 0;
    });

    let bestMonth = '', bestPts = 0, totalPts = 0;
    Object.entries(monthTotals).forEach(([m, p]) => {
      totalPts += p;
      if (p > bestPts) { bestMonth = m; bestPts = p; }
    });

    const catCount = {};
    entries.forEach(e => {
      if (isPurchaseEntry(e)) return;
      const n = e.catName && e.catName !== 'undefined' ? e.catName : '自定义';
      catCount[n] = (catCount[n] || 0) + 1;
    });
    let topCat = '', topCatN = 0;
    Object.entries(catCount).forEach(([n, c]) => { if (c > topCatN) { topCat = n; topCatN = c; } });

    let settledPts = 0, livePts = 0;
    Object.entries(monthTotals).forEach(([m, p]) => {
      if (settledMonths.has(m)) settledPts += p; else livePts += p;
    });

    return {
      year: yr,
      totalPts, settledPts, livePts,
      bestMonth, bestPts,
      topCat, topCatN,
      checkins: entries.filter(e => e.catName === CHECKIN_CAT).length,
      letters: letters.length,
      photos: photos.length,
      settledMonths: hist.length,
      yearPhotos: photos,
    };
  }

  let _yearEntriesCache = { year: null, list: [] };

  async function showYearReview() {
    await _loadStatsSources(true);   // exact counts matter here
    const y = now().getFullYear();
    // Includes settled entries, which /entries hides — see computeYearReview
    _yearEntriesCache = { year: y, list: await Data.getEntriesOfYear(y).catch(() => []) };
    const r = computeYearReview(y, _yearEntriesCache.list);
    const daysTogether = S.startDate
      ? Math.max(0, Math.floor((Date.now() - new Date(S.startDate).getTime()) / 86400000)) : null;

    const stat = (icon, num, label) =>
      `<div class="yr-stat"><div class="yr-stat-ico">${icon}</div>
        <div class="yr-stat-num">${num}</div><div class="yr-stat-lab">${label}</div></div>`;

    document.getElementById('yr-title').textContent = `${r.year} 年度回顾`;
    document.getElementById('yr-body').innerHTML = `
      <div class="yr-hero">
        <div class="yr-hero-num">${r.totalPts}</div>
        <div class="yr-hero-lab">今年一起累积的爱心积分</div>
        <div class="yr-hero-note">已结算 ${r.settledPts} + 本轮 ${r.livePts}（已扣除扣分和商店消费）</div>
      </div>
      <div class="yr-grid">
        ${stat('📅', r.checkins, '次签到')}
        ${stat('💌', r.letters, '封情书')}
        ${stat('📷', r.photos, '张回忆')}
        ${stat('🎯', r.settledMonths, '个月结算')}
      </div>
      ${r.bestMonth ? `<div class="yr-line"><span>🏅 最高分月份</span><b>${monthLabel(r.bestMonth)} · ${r.bestPts} 分</b></div>` : ''}
      ${r.topCat ? `<div class="yr-line"><span>💖 最常做的事</span><b>${_escHtml(r.topCat)} · ${r.topCatN} 次</b></div>` : ''}
      ${daysTogether != null ? `<div class="yr-line"><span>💑 在一起</span><b>${daysTogether} 天</b></div>` : ''}
      ${r.yearPhotos.length
        ? `<button class="yr-play" onclick="App.playYearMemories()">▶️ 播放 ${r.year} 年的回忆（${r.yearPhotos.length} 张）</button>`
        : `<div class="yr-empty">今年还没有回忆照片，去「在一起的时光」添加吧 📷</div>`}
    `;
    document.getElementById('year-review-page')?.classList.add('open');
  }

  function closeYearReview() {
    document.getElementById('year-review-page')?.classList.remove('open');
  }

  // Reuse the Ken Burns player, but scoped to this year's photos only
  function playYearMemories() {
    const y = now().getFullYear();
    const r = computeYearReview(y, _yearEntriesCache.year === y ? _yearEntriesCache.list : null);
    if (!r.yearPhotos.length) { showToast('今年还没有回忆照片'); return; }
    const all = S.photos;
    S.photos = r.yearPhotos;
    playMemories();
    // Restore the full album once the player closes so the album strip and
    // badge counts don't silently shrink to just this year.
    const restore = () => {
      if (document.getElementById('memory-show')?.classList.contains('open')) {
        return setTimeout(restore, 500);
      }
      S.photos = all;
    };
    setTimeout(restore, 500);
  }

  /* ══════════════ 恋爱小窝 · 宠物养成 (Phase 1) ══════════════
     Level and mood are DERIVED from the couple's real activity, never stored
     — same approach as the badges, so they can't drift out of sync and there
     is nothing to migrate. Only the couple's own choices (name, species,
     future furniture) persist, and those ride along on the existing
     u_love_config row so this feature needs no new SN table. */

  const PET_SPECIES = {
    dog:   { key:'dog',   label:'小狗', emoji:'🐶', tone:'pet',
             body:'#FFFFFF', shade:'#DCDCDC', accent:'#5B9BD5', ear:'floppy' },
    cat:   { key:'cat',   label:'小猫', emoji:'🐱', tone:'pet',
             body:'#FFE2C4', shade:'#EFC7A2', accent:'#FF9A62', ear:'pointy' },
    bunny: { key:'bunny', label:'小兔', emoji:'🐰', tone:'pet',
             body:'#FFF2F6', shade:'#F2D6E1', accent:'#FF8FA0', ear:'long' },
    baby:  { key:'baby',  label:'宝宝', emoji:'👶', tone:'baby',
             body:'#FFE7D3', shade:'#F2CDB2', accent:'#C9B1FF', ear:'none' },
  };

  // EXP is expressed in the couple's own currency — points they've banked
  // together plus a bonus for the "slow" acts (letters, photos, settling).
  // Using banked POINTS (not entry counts) keeps it stable across settlement,
  // when entries are archived out of /entries into month totals.
  const PET_STAGES = [
    { lv:1, name:'蛋蛋期', min:0,    scale:0.74 },
    { lv:2, name:'幼崽期', min:300,  scale:0.82 },
    { lv:3, name:'成长期', min:1000, scale:0.92 },
    { lv:4, name:'活泼期', min:2500, scale:1.02 },
    { lv:5, name:'圆满期', min:6000, scale:1.12 },
  ];

  // Raw lifetime activity score for the couple. This counts everything they
  // have EVER done, so it is only meaningful to the pet as a difference
  // against the snapshot taken when the pet was adopted (see petExp).
  function petExpDerived() {
    const hist    = S.historyRecords || [];
    const letters = (S.letters || []).length;
    const photos  = (S.photos  || []).length;
    return lifetimeCombinedPoints() + letters * 30 + photos * 20 + hist.length * 100;
  }

  // The pet always starts at 0 and grows only from what you do AFTER adopting
  // it — otherwise a couple with months of history would adopt an egg that
  // instantly hatched to max level, skipping the whole point of raising it.
  // petBase is the raw score snapshotted at adoption; EXP is the growth since.
  //
  // A pet must also NEVER shrink, hence the stored high-water floor. Two things
  // could otherwise pull the raw score down:
  //   1. Punishment-mode months archive a NEGATIVE total, so that month's
  //      positive earnings aren't recoverable from history.
  //   2. Deleting an old letter/photo would claw back its EXP.
  // The stored value only ever moves up, so neither can un-grow the pet.
  function petExpSinceAdoption() {
    return Math.max(0, petExpDerived() - (S.petBase || 0));
  }

  function petExp() {
    return Math.max(petExpSinceAdoption(), S.petExpStored || 0);
  }

  // Persist a new high-water mark in the background; never blocks the UI and
  // a failed write just means we recompute the same number next time.
  function _syncPetExp() {
    if (!S.petSpecies) return;              // nothing adopted yet
    const d = petExpSinceAdoption();
    if (d > (S.petExpStored || 0)) {
      S.petExpStored = d;
      Data.saveConfig({ petExp: d }).catch(() => {});
    }
  }

  // Takes the EXP as an argument (defaulting to the live value) so stage
  // boundaries can be exercised directly instead of by seeding a whole couple.
  // Outfit geometry is shared between the pet and the shop tile: the shop used
  // to render outfits as a blank grey box (they have no `art` emoji and no
  // colour swatch), so you could not tell 派对帽 from 小红围巾 except by name.
  function outfitArtFor(draw, headTop, headY, headR) {
    return {
      partyHat: `<path d="M ${60-13} ${headTop+4} L 60 ${headTop-26} L ${60+13} ${headTop+4} Z"
                       fill="#FF8FA0" stroke="#E0687E" stroke-width="1.5" stroke-linejoin="round"/>
                 <circle cx="60" cy="${headTop-28}" r="4.5" fill="#FFD24A"/>`,
      redScarf: `<path d="M ${60-16} ${headY+headR*0.74} q 16 11 32 0 l 4 9 q -20 12 -40 0 z" fill="#E8556B"/>
                 <path d="M ${60+11} ${headY+headR*0.82+6} l 10 15 l -9 3 l -6 -14 z" fill="#E8556B"/>`,
    }[draw] || '';
  }

  // What a shop tile shows. Every category must preview something real:
  // an emoji for furniture, the actual gradient for wallpaper, an opaque
  // sample for floors (their tones are semi-transparent and washed out when
  // painted straight onto the card), and a little head modelling the outfit.
  function decorArtHtml(it) {
    if (it.svg) return `<div class="decor-art">${it.svg}</div>`;
    if (it.art) return `<div class="decor-art">${it.art}</div>`;

    if (it.draw) {                                   // 穿戴 — model it on a head
      const headY = 46, headR = 22, headTop = headY - headR * 0.92;
      return `<div class="decor-art"><svg class="decor-model" viewBox="0 8 120 92">
        <ellipse cx="60" cy="${headY}" rx="${headR}" ry="${headR*0.92}"
                 fill="#FFF3E4" stroke="#D9B48F" stroke-width="2"/>
        <ellipse cx="${60-8}" cy="${headY+1}" rx="2.6" ry="2.9" fill="#2A2A2A"/>
        <ellipse cx="${60+8}" cy="${headY+1}" rx="2.6" ry="2.9" fill="#2A2A2A"/>
        <path d="M ${60-4} ${headY+9} q 4 3.5 8 0" stroke="#2A2A2A" stroke-width="1.6"
              fill="none" stroke-linecap="round"/>
        ${outfitArtFor(it.draw, headTop, headY, headR)}
      </svg></div>`;
    }

    if (it.wall) return `<div class="decor-swatch"
      style="background:linear-gradient(160deg, ${it.wall[0]}, ${it.wall[1]})"></div>`;

    if (it.tone) return `<div class="decor-swatch"
      style="background:linear-gradient(160deg, ${it.tone[0]}, ${it.tone[1]}), #E7D9C6"></div>`;

    return `<div class="decor-swatch" style="background:#DDD"></div>`;
  }

  function petStageInfo(expIn) {
    const exp = (expIn === undefined) ? petExp() : expIn;
    let idx = 0;
    for (let i = 0; i < PET_STAGES.length; i++) if (exp >= PET_STAGES[i].min) idx = i;
    const cur  = PET_STAGES[idx];
    const next = PET_STAGES[idx + 1] || null;
    // Grow smoothly inside a stage, then pop to the next artwork at the
    // boundary — "a little bigger every day" without needing new art per day.
    const spanFrom = cur.min;
    const spanTo   = next ? next.min : cur.min + 1;
    const prog     = next ? Math.min(1, (exp - spanFrom) / (spanTo - spanFrom)) : 1;
    const scale    = next ? cur.scale + (next.scale - cur.scale) * prog : cur.scale;
    return {
      exp, idx, stage: cur, next,
      pct: next ? Math.round(prog * 100) : 100,
      toNext: next ? Math.max(0, next.min - exp) : 0,
      scale,
    };
  }

  // Mood reflects the last few days only, so it naturally decays when you go
  // quiet and recovers the moment you come back — no stored counter, no
  // nightly job, and it can never get stuck.
  function petMood() {
    const since = new Date(now().getTime() - 3 * 86400000);
    const sinceStr = todayStr(since);
    const recent = (S.entries || []).filter(e => (e.date || '') >= sinceStr);
    const recentLetters = (S.letters || []).filter(l => (l.date || '').slice(0,10) >= sinceStr).length;
    const recentPhotos  = (S.photos  || []).filter(p => (p.date  || '') >= sinceStr).length;

    // Low baseline on purpose: with no activity at all the pet must fall into
    // 🥺 想你们了, because that sad state IS the come-back-and-open-the-app
    // nudge. A higher floor made it unreachable and killed the mechanic.
    let m = 15;
    recent.forEach(e => {
      const pts = parseInt(e.pts) || 0;
      if (e.catName === CHECKIN_CAT)      m += 12;
      else if (isPurchaseEntry(e))        m += 0;
      else if (pts > 0)                   m += 6;
      else                                m -= 10;
    });
    m += recentLetters * 18 + recentPhotos * 12;

    // A 月末结算 archives every entry out of /entries, so without this the pet
    // would turn sad the instant a month is settled — even though the couple
    // had just been active. A recent settlement is itself activity.
    const lastSettle = (S.historyRecords || [])
      .map(r => r.settledAt).filter(Boolean).sort().pop();
    if (lastSettle && String(lastSettle).slice(0, 10) >= sinceStr) m += 30;

    return Math.max(0, Math.min(100, Math.round(m)));
  }

  function petMoodFace(m) {
    if (m >= 80) return { emoji:'🤩', label:'超开心', cls:'happy' };
    if (m >= 50) return { emoji:'🙂', label:'开心',   cls:'good'  };
    if (m >= 20) return { emoji:'😐', label:'一般',   cls:'meh'   };
    return           { emoji:'🥺', label:'想你们了', cls:'sad'   };
  }

  const petSpecies = () => PET_SPECIES[S.petSpecies] || PET_SPECIES.dog;
  const petName    = () => S.petName || petSpecies().label;

  function petSpeech() {
    const sp = petSpecies();
    const who = sp.tone === 'baby' ? '爸爸妈妈' : '主人';
    const st = petStageInfo();
    const m  = petMood();
    const pool = [];
    if (m >= 80) pool.push(`今天也好幸福呀～`, `${who}最好了！`, `我最喜欢你们两个 💕`);
    else if (m >= 50) pool.push(`今天过得怎么样？`, `${who}回来啦～`, `陪我玩一会儿好不好`);
    else if (m >= 20) pool.push(`有点无聊…`, `${who}最近好忙哦`, `想要抱抱`);
    else pool.push(`好久没人陪我了…`, `${who}去哪了呀 🥺`, `我一个人有点孤单`);
    if (st.next && st.pct >= 80) pool.push(`我感觉…我快要长大了！`);
    if (st.idx === 0) pool.push(`（蛋壳里传来动静…）`);
    if (checkinDatesFor('char1').has(todayStr()) && checkinDatesFor('char2').has(todayStr()))
      pool.push(`今天你们都来看我了，好开心！`);
    // Festival lines are the cheapest way to make the pet feel like it lives
    // in the same world you do — but only half the time, or they get stale.
    const th = currentTheme();
    if (th && th.speech && th.speech.length && Math.random() < 0.5) {
      return th.speech[Math.floor(Math.random() * th.speech.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ══════════════ 恋爱小窝 · 装修 (Phase 2) ══════════════
     Catalog lives in code, not the database: prices and seasonal stock then
     change with a git push instead of a ServiceNow edit. `ratio` is size
     relative to the pet's height (see CLAUDE.md §7) — never hardcode px.
     `free: true` items are the room you already had, so nothing disappears
     the day decorating ships. */
  // ── furniture art ────────────────────────────────────────────────────
  // Hand-drawn SVG rather than emoji. Emoji render differently on every
  // platform, can't follow the theme, and sat next to the pet's own vector
  // art looking like a sticker sheet. Every piece shares one language: a soft
  // fill, a darker outline of the same hue, one white highlight, and a
  // 0 0 100 100 viewBox so the existing `ratio` sizing keeps working. `art`
  // stays on each item as the fallback if an SVG is ever missing.
  const _ds = (inner) => `<svg class="decor-svg" viewBox="0 0 100 100">${inner}</svg>`;
  const _hi = (x, y, rx, ry) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="0.28"/>`;

  const DECOR = {
    // ── floor furniture ──
    plant_pot:  { name:'绿植',       art:'🪴', slot:'floor', ratio:0.66, price:0,  free:true,
                   svg:_ds(`<path d="M32 60h36l-4 29a5 5 0 0 1-5 4H41a5 5 0 0 1-5-4z" fill="#CE8355" stroke="#96562F" stroke-width="2.6" stroke-linejoin="round"/> <rect x="28" y="52" width="44" height="11" rx="4.5" fill="#E09765" stroke="#96562F" stroke-width="2.6"/> <ellipse cx="38" cy="38" rx="12" ry="16" transform="rotate(-24 38 38)" fill="#72C176" stroke="#3C8354" stroke-width="2.4"/> <ellipse cx="62" cy="36" rx="11" ry="15" transform="rotate(22 62 36)" fill="#86D08A" stroke="#3C8354" stroke-width="2.4"/> <ellipse cx="50" cy="26" rx="10" ry="14" fill="#7ECA82" stroke="#3C8354" stroke-width="2.4"/> <path d="M50 52V30" stroke="#3C8354" stroke-width="2.4" stroke-linecap="round"/>${_hi(40,68,7,4)}`) },
    sofa_blue:  { name:'蓝色沙发',   art:'🛋️', slot:'floor', ratio:0.82, price:0,  free:true,
                   svg:_ds(`<rect x="14" y="46" width="72" height="30" rx="10" fill="#7FB3DC" stroke="#4B7EA8" stroke-width="2.6"/> <rect x="10" y="52" width="16" height="26" rx="7" fill="#9AC6E8" stroke="#4B7EA8" stroke-width="2.6"/> <rect x="74" y="52" width="16" height="26" rx="7" fill="#9AC6E8" stroke="#4B7EA8" stroke-width="2.6"/> <rect x="26" y="56" width="24" height="16" rx="5" fill="#B3D8F2" stroke="#4B7EA8" stroke-width="2.2"/> <rect x="52" y="56" width="24" height="16" rx="5" fill="#B3D8F2" stroke="#4B7EA8" stroke-width="2.2"/> <path d="M20 78v8M80 78v8" stroke="#4B7EA8" stroke-width="4" stroke-linecap="round"/>${_hi(36,52,12,3.5)}`) },
    bed_pink:   { name:'粉色小床',   art:'🛏️', slot:'floor', ratio:0.90, price:80,
                   svg:_ds(`<rect x="9" y="32" width="17" height="50" rx="7" fill="#F2B9CC" stroke="#C4738F" stroke-width="2.6"/> <rect x="26" y="76" width="9" height="12" rx="3" fill="#E3A3BA" stroke="#C4738F" stroke-width="2.2"/> <rect x="14" y="58" width="76" height="20" rx="7" fill="#FFF3F7" stroke="#C4738F" stroke-width="2.6"/> <path d="M48 56h36a7 7 0 0 1 7 7v9a6 6 0 0 1-6 6H48z" fill="#F5A9C4" stroke="#C4738F" stroke-width="2.6" stroke-linejoin="round"/> <path d="M48 62h43" stroke="#DE8DAE" stroke-width="2.2" stroke-linecap="round"/> <rect x="21" y="49" width="25" height="14" rx="6" fill="#fff" stroke="#C4738F" stroke-width="2.4"/> <path d="M20 78v9M85 78v9" stroke="#C4738F" stroke-width="4.5" stroke-linecap="round"/>`) },
    table_wood: { name:'木餐桌',     art:'🪑', slot:'floor', ratio:0.62, price:45,
                   svg:_ds(`<ellipse cx="50" cy="46" rx="38" ry="10" fill="#D2A06B" stroke="#94663A" stroke-width="2.6"/> <path d="M12 46v4a38 10 0 0 0 76 0v-4" fill="#B8854F" stroke="#94663A" stroke-width="2.6" stroke-linejoin="round"/> <path d="M50 56v22" stroke="#94663A" stroke-width="6" stroke-linecap="round"/> <path d="M32 88h36" stroke="#94663A" stroke-width="6" stroke-linecap="round"/>${_hi(40,43,14,3.5)}`) },
    lamp_floor: { name:'落地灯',     art:'🕯️', slot:'floor', ratio:0.70, price:40,
                   svg:_ds(`<path d="M34 20h32l8 26H26z" fill="#F6D98E" stroke="#C29A45" stroke-width="2.6" stroke-linejoin="round"/> <ellipse cx="50" cy="52" rx="16" ry="5" fill="#FFF0BF" opacity="0.75"/> <path d="M50 46v36" stroke="#8A7B6B" stroke-width="4.5" stroke-linecap="round"/> <ellipse cx="50" cy="86" rx="17" ry="6" fill="#A99684" stroke="#7B6957" stroke-width="2.4"/>${_hi(44,30,6,7)}`) },
    fishtank:   { name:'小鱼缸',     art:'🐠', slot:'floor', ratio:0.55, price:55,
                   svg:_ds(`<rect x="16" y="34" width="68" height="48" rx="8" fill="#BFE6F2" stroke="#5C93A8" stroke-width="2.8"/> <path d="M18 52h64v26a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6z" fill="#7FCBE3" opacity="0.85"/> <ellipse cx="42" cy="64" rx="9" ry="6" fill="#FF9F5B" stroke="#D2703A" stroke-width="1.8"/> <path d="M51 64l8-5v10z" fill="#FF9F5B" stroke="#D2703A" stroke-width="1.8" stroke-linejoin="round"/> <circle cx="39" cy="62" r="1.6" fill="#3A2A22"/> <circle cx="64" cy="46" r="3" fill="#fff" opacity="0.7"/> <circle cx="70" cy="56" r="2" fill="#fff" opacity="0.55"/>${_hi(28,42,7,4)}`) },
    // ── wall ──
    pic_couple: { name:'全家福',     art:'🖼️', slot:'wall',  ratio:0.42, price:0,  free:true,
                   svg:_ds(`<rect x="16" y="22" width="68" height="56" rx="6" fill="#C9A227" stroke="#8E7015" stroke-width="3"/> <rect x="24" y="30" width="52" height="40" rx="3" fill="#DFF1FB"/> <path d="M24 58l14-13 10 9 12-14 16 18v-4H24z" fill="#8FCB9B"/> <circle cx="63" cy="40" r="6" fill="#FFD86B"/> <circle cx="41" cy="58" r="6.5" fill="#F5A9C4" stroke="#C4738F" stroke-width="1.6"/> <circle cx="55" cy="58" r="6.5" fill="#9AC6E8" stroke="#4B7EA8" stroke-width="1.6"/>`) },
    clock_wall: { name:'挂钟',       art:'🕰️', slot:'wall',  ratio:0.34, price:25,
                   svg:_ds(`<circle cx="50" cy="50" r="32" fill="#F5EFE3" stroke="#8B6F52" stroke-width="3.2"/> <circle cx="50" cy="50" r="25" fill="#fff" stroke="#C8B79A" stroke-width="1.8"/> <path d="M50 32v18l12 8" stroke="#5A4632" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/> <circle cx="50" cy="50" r="3" fill="#5A4632"/> <circle cx="50" cy="24" r="1.8" fill="#8B6F52"/><circle cx="76" cy="50" r="1.8" fill="#8B6F52"/> <circle cx="50" cy="76" r="1.8" fill="#8B6F52"/><circle cx="24" cy="50" r="1.8" fill="#8B6F52"/>`) },
    shelf_books:{ name:'书架',       art:'📚', slot:'wall',  ratio:0.48, price:45,
                   svg:_ds(`<rect x="12" y="60" width="76" height="9" rx="3" fill="#C08E5C" stroke="#8A6137" stroke-width="2.6"/> <rect x="22" y="30" width="12" height="30" rx="2.5" fill="#E2707E" stroke="#AE4655" stroke-width="2.2"/> <rect x="36" y="24" width="11" height="36" rx="2.5" fill="#7FB3DC" stroke="#4B7EA8" stroke-width="2.2"/> <rect x="49" y="34" width="12" height="26" rx="2.5" fill="#F0C24B" stroke="#BE9022" stroke-width="2.2"/> <rect x="63" y="28" width="11" height="32" rx="2.5" fill="#8FCB9B" stroke="#4E8D62" stroke-width="2.2"/> <path d="M20 69v8M80 69v8" stroke="#8A6137" stroke-width="3.4" stroke-linecap="round"/>`) },
    neon_heart: { name:'爱心霓虹灯', art:'💗', slot:'wall',  ratio:0.38, price:60,
                   svg:_ds(`<path d="M50 78S16 58 16 38a18 18 0 0 1 34-8 18 18 0 0 1 34 8c0 20-34 40-34 40z" fill="#FF6F91" opacity="0.28"/> <path d="M50 74S22 56 22 39a15 15 0 0 1 28-7 15 15 0 0 1 28 7c0 17-28 35-28 35z" fill="none" stroke="#FF4D7E" stroke-width="6" stroke-linejoin="round"/> <path d="M50 74S22 56 22 39a15 15 0 0 1 28-7 15 15 0 0 1 28 7c0 17-28 35-28 35z" fill="none" stroke="#FFD3E0" stroke-width="2" stroke-linejoin="round"/>`) },
    // ── wallpaper (drawn, not emoji) ──
    wp_cream:   { name:'奶油白墙', slot:'paper', price:35, wall:['#F3ECE2','#E8DED0'], floorTone:'#C4A484' },
    wp_sakura:  { name:'樱花粉墙', slot:'paper', price:35, wall:['#FBE4EC','#F3D2DF'], floorTone:'#C9A08F' },
    wp_night:   { name:'星空蓝墙', slot:'paper', price:45, wall:['#2E3A63','#263154'], floorTone:'#4A4266' },
    // ── flooring ──
    fl_wood:    { name:'木地板', slot:'mat', price:35, tone:['rgba(180,140,100,0.34)','rgba(150,110,75,0.5)'] },
    fl_carpet:  { name:'毛毯',   slot:'mat', price:35, tone:['rgba(200,160,180,0.34)','rgba(170,125,150,0.5)'] },
    fl_tile:    { name:'瓷砖',   slot:'mat', price:30, tone:['rgba(170,185,200,0.34)','rgba(135,155,175,0.5)'] },
    // ── pet outfits (drawn into the pet SVG so they scale with it) ──
    hat_party:  { name:'派对帽',   slot:'outfit', price:20, draw:'partyHat' },
    scarf_red:  { name:'小红围巾', slot:'outfit', price:25, draw:'redScarf' },

    // ── 季节限定 ──
    // Windows are fixed MM-DD and deliberately generous, because lunar
    // festivals drift by weeks year to year. Out of season these vanish from
    // the shop, but anything already bought stays usable forever — never
    // confiscate what someone paid for.
    lantern_pair:{ name:'兔子灯笼', art:'🏮', slot:'floor', ratio:0.52, price:65,
                   from:'01-20', to:'02-25', season:'新年',
                   svg:_ds(`<path d="M50 14v8M50 78v10" stroke="#9C5F3A" stroke-width="3" stroke-linecap="round"/> <ellipse cx="50" cy="50" rx="28" ry="28" fill="#E24B4B" stroke="#A82B2B" stroke-width="2.8"/> <path d="M30 30q20 12 40 0M30 70q20-12 40 0" stroke="#F5B54A" stroke-width="2.2" fill="none"/> <rect x="34" y="20" width="32" height="7" rx="3" fill="#F5B54A" stroke="#B9832A" stroke-width="2"/> <rect x="34" y="73" width="32" height="7" rx="3" fill="#F5B54A" stroke="#B9832A" stroke-width="2"/> <path d="M44 88v8M50 88v10M56 88v8" stroke="#F5B54A" stroke-width="2.6" stroke-linecap="round"/>${_hi(40,38,6,9)}`) },
    fu_scroll:   { name:'福字挂轴', art:'🧧', slot:'wall',  ratio:0.40, price:50,
                   from:'01-20', to:'02-25', season:'新年',
                   svg:_ds(`<rect x="26" y="16" width="48" height="68" rx="4" fill="#D8443F" stroke="#9B2A26" stroke-width="2.8"/> <rect x="20" y="12" width="60" height="8" rx="4" fill="#C79A3E" stroke="#8E6B1F" stroke-width="2.2"/> <rect x="20" y="80" width="60" height="8" rx="4" fill="#C79A3E" stroke="#8E6B1F" stroke-width="2.2"/> <path d="M50 30l16 20-16 20-16-20z" fill="#F2D68A" stroke="#B08D2C" stroke-width="2.2" stroke-linejoin="round"/> <path d="M43 44h14M50 40v18M45 52h10" stroke="#9B2A26" stroke-width="2.6" stroke-linecap="round"/>`) },
    rose_vase:   { name:'玫瑰花瓶', art:'🌹', slot:'floor', ratio:0.48, price:55,
                   from:'02-08', to:'02-20', season:'情人节',
                   svg:_ds(`<path d="M39 56h22l-3 30a5 5 0 0 1-5 4h-6a5 5 0 0 1-5-4z" fill="#CFE3EE" stroke="#7397AC" stroke-width="2.6" stroke-linejoin="round"/> <path d="M37 56h26" stroke="#7397AC" stroke-width="2.6" stroke-linecap="round"/> <path d="M50 56V30M50 44l-13-7M50 40l14-9" stroke="#4E8D62" stroke-width="2.4" stroke-linecap="round"/> <ellipse cx="33" cy="45" rx="7.5" ry="4.5" transform="rotate(-24 33 45)" fill="#63AE76" stroke="#3F7A54" stroke-width="1.8"/> <ellipse cx="67" cy="41" rx="7.5" ry="4.5" transform="rotate(22 67 41)" fill="#63AE76" stroke="#3F7A54" stroke-width="1.8"/> <circle cx="34" cy="30" r="9" fill="#E8556B" stroke="#AE3349" stroke-width="2.2"/> <path d="M34 30a4 4 0 1 0 3-3" fill="none" stroke="#FBAFBE" stroke-width="2"/> <circle cx="66" cy="26" r="9" fill="#F0728A" stroke="#AE3349" stroke-width="2.2"/> <path d="M66 26a4 4 0 1 0 3-3" fill="none" stroke="#FBAFBE" stroke-width="2"/> <circle cx="50" cy="18" r="10.5" fill="#E8556B" stroke="#AE3349" stroke-width="2.4"/> <path d="M50 18a5 5 0 1 0 4-4" fill="none" stroke="#FBAFBE" stroke-width="2.2"/>`) },
    zongzi_tray: { name:'粽子小桌', art:'🍡', slot:'floor', ratio:0.50, price:55,
                   from:'05-25', to:'06-25', season:'端午',
                   svg:_ds(`<ellipse cx="50" cy="74" rx="34" ry="10" fill="#D7A97A" stroke="#8A6137" stroke-width="2.6"/> <ellipse cx="50" cy="71" rx="27" ry="7" fill="#EBD3B4" opacity="0.7"/> <path d="M72 56c3 0 5 3 4 6-1 4-6 7-11 7l-3-9z" fill="#8CBF6E" stroke="#3F7038" stroke-width="2.2" stroke-linejoin="round"/> <path d="M50 34c3 0 5 2 6 4l14 22c2 3 0 7-4 7H34c-4 0-6-4-4-7l14-22c1-2 3-4 6-4z" fill="#7FB863" stroke="#3F7038" stroke-width="2.8" stroke-linejoin="round"/> <path d="M50 34c-3 0-5 2-6 4L30 60c-2 3 0 7 4 7h16z" fill="#9AD183" opacity="0.55"/> <path d="M50 38v29" stroke="#3F7038" stroke-width="2" opacity="0.5"/> <path d="M32 58h36" stroke="#C9302C" stroke-width="3.4" stroke-linecap="round"/> <path d="M50 45l-11 22M50 45l11 22" stroke="#C9302C" stroke-width="2.6" stroke-linecap="round"/> <path d="M50 34c-3-5-1-9 0-11 2 2 3 6 0 11z" fill="#5F9A48" stroke="#3F7038" stroke-width="2" stroke-linejoin="round"/>`) },
    mooncake_set:{ name:'月饼茶席', art:'🥮', slot:'floor', ratio:0.54, price:70,
                   from:'09-05', to:'10-05', season:'中秋',
                   svg:_ds(`<ellipse cx="50" cy="78" rx="38" ry="9" fill="#B9855A" stroke="#8A6137" stroke-width="2.6"/> <rect x="24" y="56" width="30" height="18" rx="6" fill="#E8B96F" stroke="#A87A33" stroke-width="2.6"/> <path d="M29 62h20M29 68h20" stroke="#A87A33" stroke-width="1.8" opacity="0.7"/> <rect x="31" y="50" width="16" height="8" rx="3" fill="#F0CB8C" stroke="#A87A33" stroke-width="2.2"/> <path d="M62 56h18a4 4 0 0 1 4 4v8a6 6 0 0 1-6 6H62z" fill="#EFE6D8" stroke="#9C8B72" stroke-width="2.4" stroke-linejoin="round"/> <path d="M84 62c6 0 6 8 0 8" fill="none" stroke="#9C8B72" stroke-width="2.4"/> <path d="M68 56l2-8" stroke="#9C8B72" stroke-width="2.4" stroke-linecap="round"/>${_hi(34,60,7,3)}`) },
    moon_window: { name:'满月挂画', art:'🌕', slot:'wall',  ratio:0.46, price:55,
                   from:'09-05', to:'10-05', season:'中秋',
                   svg:_ds(`<circle cx="50" cy="50" r="34" fill="#1E2A4A" stroke="#5A6B93" stroke-width="3"/> <circle cx="52" cy="46" r="20" fill="#FBF3D0" stroke="#DCC98A" stroke-width="2"/> <circle cx="45" cy="41" r="4" fill="#EADFB4" opacity="0.85"/> <circle cx="58" cy="52" r="3" fill="#EADFB4" opacity="0.7"/> <circle cx="54" cy="38" r="2.2" fill="#EADFB4" opacity="0.6"/> <path d="M22 66q12-7 24 0t24-4" fill="none" stroke="#8894BC" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/> <circle cx="28" cy="30" r="2" fill="#FFF6CF"/><circle cx="74" cy="66" r="1.8" fill="#FFF6CF"/>`) },
    rabbit_lamp: { name:'玉兔灯',   art:'🐰', slot:'floor', ratio:0.58, price:60,
                   from:'09-05', to:'10-05', season:'中秋',
                   svg:_ds(`<ellipse cx="50" cy="86" rx="22" ry="6" fill="#C8B79A" stroke="#9C8B72" stroke-width="2.2"/> <ellipse cx="50" cy="58" rx="24" ry="24" fill="#FDF4E3" stroke="#D9C49B" stroke-width="2.8"/> <ellipse cx="40" cy="26" rx="6.5" ry="16" transform="rotate(-13 40 26)" fill="#FDF4E3" stroke="#D9C49B" stroke-width="2.6"/> <ellipse cx="60" cy="26" rx="6.5" ry="16" transform="rotate(13 60 26)" fill="#FDF4E3" stroke="#D9C49B" stroke-width="2.6"/> <ellipse cx="40" cy="26" rx="3" ry="10" transform="rotate(-13 40 26)" fill="#F7C9D8"/> <ellipse cx="60" cy="26" rx="3" ry="10" transform="rotate(13 60 26)" fill="#F7C9D8"/> <circle cx="42" cy="54" r="2.8" fill="#3A2A22"/><circle cx="58" cy="54" r="2.8" fill="#3A2A22"/> <path d="M47 62q3 3 6 0" stroke="#3A2A22" stroke-width="2" fill="none" stroke-linecap="round"/> <circle cx="34" cy="62" r="4" fill="#F7C9D8" opacity="0.8"/><circle cx="66" cy="62" r="4" fill="#F7C9D8" opacity="0.8"/>${_hi(40,46,7,5)}`) },
    osmanthus:   { name:'桂花树',   art:'🌼', slot:'floor', ratio:0.74, price:65,
                   from:'09-05', to:'10-05', season:'中秋',
                   svg:_ds(`<path d="M42 60h16l-2 28a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="#B98A5E" stroke="#8A6137" stroke-width="2.6" stroke-linejoin="round"/> <ellipse cx="50" cy="38" rx="30" ry="24" fill="#5FA873" stroke="#3F7A54" stroke-width="2.8"/> <ellipse cx="38" cy="32" rx="11" ry="9" fill="#72C176" opacity="0.9"/> <g fill="#F7B733" stroke="#D18E14" stroke-width="1.4"> <circle cx="34" cy="42" r="3.4"/><circle cx="50" cy="26" r="3.4"/><circle cx="62" cy="40" r="3.4"/> <circle cx="44" cy="52" r="3"/><circle cx="66" cy="26" r="3"/><circle cx="26" cy="30" r="3"/> <circle cx="56" cy="50" r="3"/> </g> <path d="M50 62V48" stroke="#8A6137" stroke-width="2.4" stroke-linecap="round"/>${_hi(46,72,4,8)}`) },
    xmas_tree:   { name:'圣诞树',   art:'🎄', slot:'floor', ratio:0.88, price:90,
                   from:'12-10', to:'12-28', season:'圣诞',
                   svg:_ds(`<path d="M50 12l16 24H34z" fill="#4E9A5B" stroke="#2F6B3C" stroke-width="2.6" stroke-linejoin="round"/> <path d="M50 28l21 28H29z" fill="#57A867" stroke="#2F6B3C" stroke-width="2.6" stroke-linejoin="round"/> <path d="M50 46l26 32H24z" fill="#63B573" stroke="#2F6B3C" stroke-width="2.6" stroke-linejoin="round"/> <rect x="43" y="78" width="14" height="12" rx="3" fill="#96683C" stroke="#6B4726" stroke-width="2.4"/> <path d="M50 4l3 6 6 1-5 4 2 6-6-3-6 3 2-6-5-4 6-1z" fill="#FFD24A" stroke="#C79A1E" stroke-width="1.8" stroke-linejoin="round"/> <circle cx="42" cy="40" r="3.4" fill="#E8556B"/><circle cx="60" cy="50" r="3.4" fill="#7FB3DC"/> <circle cx="46" cy="64" r="3.4" fill="#F0C24B"/><circle cx="60" cy="30" r="3" fill="#F5A9C4"/>`) },
    star_string: { name:'星星彩灯', art:'✨', slot:'wall',  ratio:0.36, price:45,
                   from:'12-10', to:'01-05', season:'节日',
                   svg:_ds(`<path d="M6 26q22 22 44 0t44 0" fill="none" stroke="#8A7B6B" stroke-width="2.6" stroke-linecap="round"/> <g stroke-linejoin="round" stroke-width="2"> <path d="M22 40l3.5 7 7.5 1-5.5 5 1.5 8-6.5-4-6.5 4 1.5-8-5.5-5 7.5-1z" fill="#FFD24A" stroke="#C79A1E"/> <path d="M50 52l3.5 7 7.5 1-5.5 5 1.5 8-6.5-4-6.5 4 1.5-8-5.5-5 7.5-1z" fill="#FFE9A6" stroke="#C79A1E"/> <path d="M78 40l3.5 7 7.5 1-5.5 5 1.5 8-6.5-4-6.5 4 1.5-8-5.5-5 7.5-1z" fill="#FFD24A" stroke="#C79A1E"/> </g>`) },
    sakura_vase: { name:'樱花瓶',   art:'🌸', slot:'floor', ratio:0.46, price:50,
                   from:'03-01', to:'04-30', season:'春',
                   svg:_ds(`<path d="M40 54h20l-3 32a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z" fill="#E4EEF5" stroke="#8FA9BA" stroke-width="2.6" stroke-linejoin="round"/> <path d="M50 54V34M50 42l-12-8M50 40l13-10" stroke="#8A6B5C" stroke-width="2.4" stroke-linecap="round"/> <g fill="#FBC6DA" stroke="#DE8DAE" stroke-width="1.8"> <circle cx="36" cy="31" r="7"/><circle cx="64" cy="27" r="7.5"/><circle cx="50" cy="20" r="8"/> </g> <circle cx="36" cy="31" r="2.2" fill="#F390B4"/><circle cx="64" cy="27" r="2.2" fill="#F390B4"/> <circle cx="50" cy="20" r="2.4" fill="#F390B4"/>${_hi(44,64,5,9)}`) },
  };

  // No placement cap: the couple can put out everything they own.
  const DECOR_MAX_SCALE = 1.8, DECOR_MIN_SCALE = 0.5;

  /* ══════════════ 恋爱小窝 · 季节 / 节日主题 (Phase 3) ══════════════
     Entirely date-driven in the frontend — no scheduled job, no backend, no
     stored state. A ServiceNow job would only add something that can fail to
     fire (dev instances hibernate); a date comparison cannot.

     currentTheme() takes the date as an ARGUMENT so seasons are testable
     without touching the system clock. */

  // Lunar festivals move every year, so a small lookup beats pulling in a
  // whole calendar library. ⚠️ Extend this table before it runs out (see the
  // maintenance checklist in docs/PET_GAME_DESIGN.md §7).
  const LUNAR = {
    cny:       { 2026:'02-17', 2027:'02-06', 2028:'01-26', 2029:'02-13', 2030:'02-03' },
    midautumn: { 2026:'09-25', 2027:'09-15', 2028:'10-03', 2029:'09-22', 2030:'09-12' },
    dragon:    { 2026:'06-19', 2027:'06-09', 2028:'05-28', 2029:'06-16', 2030:'06-05' },
  };

  // priority 10 = festival (overrides), 1 = ambient season.
  // Written for a tropical climate: the four seasons are mood only, festivals
  // are what actually feels real here.
  const THEMES = [
    { id:'cny', name:'新年', priority:10, lunar:'cny', span:[-2, 12], emoji:'🧧',
      window:'fireworks', particle:'🧧', outfit:'scarf_red',
      wall:['#5B2230','#4A1B27'], floorTone:'#6B2A2A',
      speech:['新年快乐呀！🧧', '今年也要一直在一起哦', '有红包吗…我也想要'] },
    { id:'vday', name:'情人节', priority:10, from:'02-12', to:'02-16', emoji:'💐',
      window:'day', particle:'💗', outfit:'',
      wall:['#5A2740','#4B1F35'], floorTone:'#6E3350',
      speech:['今天是属于你们的日子 💕', '要好好说喜欢哦', '我也想要一朵花'] },
    { id:'dragon', name:'端午', priority:10, lunar:'dragon', span:[-1, 3], emoji:'🐲',
      window:'day', particle:'🍃', outfit:'',
      wall:['#24463A','#1E3B31'], floorTone:'#3A5140',
      speech:['粽子好香呀～', '要一起看龙舟吗？', '我也想吃一口粽子'] },
    { id:'midautumn', name:'中秋', priority:10, lunar:'midautumn', span:[-3, 3], emoji:'🥮',
      window:'fullmoon', particle:'🌾', outfit:'',
      wall:['#4A3320','#3D2A1B'], floorTone:'#5C4028',
      speech:['今晚月亮好圆呀，一起看嘛？', '月饼…我也想吃一口 🥮', '团团圆圆最好了'] },
    { id:'xmas', name:'圣诞', priority:10, from:'12-18', to:'12-27', emoji:'🎄',
      window:'snow', particle:'❄️', outfit:'hat_party',
      wall:['#1F3A34','#18302B'], floorTone:'#2E4A40',
      speech:['圣诞快乐！🎄', '有礼物吗？我很乖的', '一起听圣诞歌吧'] },
    { id:'nye', name:'跨年', priority:10, from:'12-29', to:'01-02', emoji:'🎆',
      window:'fireworks', particle:'✨', outfit:'hat_party',
      wall:['#232A55','#1C2246'], floorTone:'#333A66',
      speech:['新的一年也请多指教！', '一起倒数好不好 🎆', '今年过得开心吗？'] },
    // Ambient seasons — subtle, no auto outfit
    { id:'spring', name:'春', priority:1, from:'03-01', to:'05-31', emoji:'🌸',
      window:'day', particle:'🌸', speech:['风好舒服呀～', '想出去走走'] },
    { id:'summer', name:'夏', priority:1, from:'06-01', to:'08-31', emoji:'🌞',
      window:'day', particle:'☀️', speech:['好热…想吃冰', '开空调好不好'] },
    { id:'autumn', name:'秋', priority:1, from:'09-01', to:'11-30', emoji:'🍂',
      window:'dusk', particle:'🍂', speech:['天黑得好早哦', '有点想窝着不动'] },
    { id:'winter', name:'冬', priority:1, from:'12-01', to:'02-28', emoji:'⛄',
      window:'snow', particle:'❄️', speech:['有点冷…抱抱', '想喝热的东西'] },
  ];

  const _md = (d) => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function _themeActive(th, d) {
    if (th.lunar) {
      const iso = LUNAR[th.lunar]?.[d.getFullYear()];
      if (!iso) return false;                       // table ran out — fail quiet
      // Compare CALENDAR days, not timestamps: diffing raw times let a 12:00
      // "today" round half a day into the window, so 2/14 came back as 新年
      // instead of 情人节.
      const day  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const fest = new Date(`${d.getFullYear()}-${iso}T00:00:00`);
      const days = Math.round((day - fest) / 86400000);
      return days >= th.span[0] && days <= th.span[1];
    }
    const md = _md(d);
    return th.from <= th.to ? (md >= th.from && md <= th.to)
                            : (md >= th.from || md <= th.to);   // wraps new year
  }

  // Highest-priority matching theme wins; festivals therefore override seasons.
  function currentTheme(d = now()) {
    let best = null;
    for (const th of THEMES) {
      if (!_themeActive(th, d)) continue;
      if (!best || th.priority > best.priority) best = th;   // ties: first listed wins
    }
    return best;
  }

  // 小窝币: earned from the pet's growth, NOT from love points — furniture must
  // never compete with real rewards (奶茶/约会). Uses the pet's EXP high-water
  // (base + stored) so the balance can't dip on a punishment settle, a deleted
  // photo, or re-adopting the pet.
  function nestCoinsEarned() {
    // Derive from the PET's EXP, not the couple's raw lifetime score. Basing
    // it on the raw score meant a couple with months of history adopted an egg
    // at 0 EXP but instantly held 691 coins — coins must start from zero for
    // the same reason the pet does. petExp() already carries the stored
    // high-water mark, so this stays monotonic between adoptions.
    return Math.floor(petExp() / 2);
  }
  function decorSpentTotal() {
    return (S.decorOwned || []).reduce((s, r) => s + (parseInt(r.ptsSpent) || 0), 0);
  }

  // Furniture is permanent and belongs to the ROOM, not to the pet — but the
  // coins that bought it were the pet's. Re-adopting resets EXP to 0, so
  // without forgiving the past spend the couple would silently owe it: a room
  // furnished for 300 coins meant re-earning 600 EXP before a single coin
  // reappeared, with nothing on screen explaining the wait. resetPet() banks
  // the running total into eq.sf so the new pet opens with an empty wallet
  // instead of a hidden debt, and later purchases still deduct normally.
  function nestCoinsSpent() {
    const forgiven = (S.equipped && +S.equipped.sf) || 0;
    return Math.max(0, decorSpentTotal() - forgiven);
  }
  function nestCoins() { return Math.max(0, nestCoinsEarned() - nestCoinsSpent()); }

  const decorOwns = (id) => !!DECOR[id]?.free ||
    (S.decorOwned || []).some(r => r.itemId === id);

  // Seasonal stock: an item with a date window is only BUYABLE in season, but
  // once owned it stays usable forever — never confiscate what they paid for.
  function decorInSeason(item, d = now()) {
    if (!item.from || !item.to) return true;
    const md = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return item.from <= item.to
      ? (md >= item.from && md <= item.to)
      : (md >= item.from || md <= item.to);   // window wrapping new year
  }

  /* Equipped state — one small JSON blob on u_love_config. Bounded by design
     (8 keys), so it can never outgrow the field the way an owned-list would. */
  /* Placement model: a FLAT LIST, not fixed slots — the couple asked to place
     as many pieces as they own and resize each one. Each entry is kept short
     ({i,x,y,s}) and rounded to 1dp because the whole layout has to fit in the
     u_pet_equipped string field.
       i = catalog id · x,y = % of the room (anchored bottom-centre)
       s = size multiplier applied on top of the catalog's ratio */
  function defaultEquipped() {
    return { paper:'', mat:'', outfit:'', sf:0, items:[
      { i:'pic_couple', x:16, y:30, s:1 },
      { i:'plant_pot',  x:16, y:87, s:1 },
      { i:'sofa_blue',  x:84, y:87, s:1 },
    ]};
  }
  const _r1 = (n) => Math.round(n * 10) / 10;

  // u_pet_equipped is String(1000) in ServiceNow. The old verbose encoding
  // cost ~45 chars per piece, so a room hit the ceiling at 21 items — and
  // ServiceNow truncates silently, which fed parseEquipped invalid JSON and
  // reset the whole room to the 3 starter pieces. With seasonal furniture
  // added every season the catalog only grows, so the layout is stored
  // compactly instead: "id,x,y" (plus ",scale" only when it isn't 1), which
  // is ~21 chars a piece and leaves room for the catalog to keep growing.
  const EQ_MAX = 1000;

  function encodeEquipped(eq) {
    const it = (eq.items || []).map(o => {
      const sc = _r1(o.s);
      const base = `${o.i},${_r1(o.x)},${_r1(o.y)}`;
      return sc === 1 ? base : `${base},${sc}`;
    });
    const out = { p: eq.paper || '', m: eq.mat || '', o: eq.outfit || '', it };
    if (+eq.sf > 0) out.sf = +eq.sf;
    return JSON.stringify(out);
  }

  // Last line of defence: if a blob was truncated anyway (an older oversized
  // row, a hand-edited field), rescue every COMPLETE record rather than
  // throwing the couple's whole room away.
  function salvageEquipped(raw) {
    if (!raw || raw.length < 20) return null;
    const items = [];
    const re = /"([a-z0-9_]+),([\d.]+),([\d.]+)(?:,([\d.]+))?"/g;
    let m;
    while ((m = re.exec(raw))) items.push({ i:m[1], x:+m[2], y:+m[3], s:m[4] ? +m[4] : 1 });
    if (!items.length) return null;
    const g = (k) => (new RegExp(`"${k}":"([^"]*)"`).exec(raw) || ['', ''])[1];
    return { paper: g('p') || g('paper'), mat: g('m') || g('mat'),
             outfit: g('o') || g('outfit'),
             sf: +((/"sf":(\d+)/.exec(raw) || ['', 0])[1]) || 0, items };
  }

  function parseEquipped(raw) {
    try {
      const e = JSON.parse(raw || '{}');
      let items = [];
      if (Array.isArray(e.it)) {                    // compact format
        items = e.it.map(str => {
          const [i, x, y, sc] = String(str).split(',');
          return { i: i || '',
                   x: Number.isFinite(+x)  ? +x  : 50,
                   y: Number.isFinite(+y)  ? +y  : 80,
                   s: Number.isFinite(+sc) ? +sc : 1 };
        }).filter(o => o.i);
        return { paper: e.p || '', mat: e.m || '', outfit: e.o || '',
                 sf: (+e.sf > 0) ? +e.sf : 0, items };
      }
      if (Array.isArray(e.items)) {
        items = e.items.map(o => ({
          i: o.i || o.id || '',
          x: Number.isFinite(+o.x) ? +o.x : 50,
          y: Number.isFinite(+o.y) ? +o.y : 80,
          s: Number.isFinite(+o.s) ? +o.s : 1,
        })).filter(o => o.i);
      } else if (Array.isArray(e.wall) || Array.isArray(e.floor)) {
        // Migrate the old fixed-slot layout so nothing is lost
        const home = { wall:[{x:16,y:30},{x:45,y:32}], floor:[{x:16,y:87},{x:84,y:87},{x:34,y:70}] };
        ['wall','floor'].forEach(kind => (e[kind] || []).forEach((v, idx) => {
          const id = typeof v === 'string' ? v : (v && v.id) || '';
          if (!id) return;
          const h = home[kind][idx] || { x:50, y:80 };
          items.push({ i:id,
            x: (v && Number.isFinite(+v.x)) ? +v.x : h.x,
            y: (v && Number.isFinite(+v.y)) ? +v.y : h.y, s:1 });
        }));
      } else {
        const def = defaultEquipped();
        def.sf = (+e.sf > 0) ? +e.sf : 0;
        return def;
      }
      // sf = 小窝币 already spent that has been forgiven (see nestCoinsSpent)
      return { paper: e.paper || '', mat: e.mat || '', outfit: e.outfit || '',
               sf: (+e.sf > 0) ? +e.sf : 0, items };
    } catch { return salvageEquipped(raw) || defaultEquipped(); }
  }

  async function saveEquipped() {
    // Round before saving: the whole layout must fit in u_pet_equipped
    (S.equipped.items || []).forEach(o => { o.x = _r1(o.x); o.y = _r1(o.y); o.s = _r1(o.s); });
    const blob = encodeEquipped(S.equipped);
    if (blob.length > EQ_MAX) {          // never let the field truncate silently
      showToast('小窝摆太满啦，先收起一件再摆 🧺');
      return false;
    }
    try {
      await Data.saveConfig({ petEquipped: blob });
      _markRoomSynced();          // our own change is not "someone else edited"
      return true;
    } catch (err) { showToast('保存失败: ' + err.message); return false; }
  }

  /* ── Pet artwork ──
     One parametric SVG per species. Soft radial shading, real paws and tails,
     and — importantly — ears drawn OUTSIDE the head silhouette: an earlier
     version tucked them behind the head ellipse, which made every species
     render as the same featureless snowman. */
  let _svgUid = 0;

  function petSvg(stageIdx, sp = petSpecies()) {
    const uid = 'pg' + (++_svgUid);
    const grad = `
      <defs>
        <radialGradient id="${uid}" cx="34%" cy="26%" r="82%">
          <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.96"/>
          <stop offset="52%"  stop-color="${sp.body}"/>
          <stop offset="100%" stop-color="${sp.shade}"/>
        </radialGradient>
      </defs>`;
    const FILL = `url(#${uid})`;
    const LINE = sp.shade;

    if (stageIdx === 0) {   // 🥚 egg — species reads only through its colour
      return `<svg class="pet-svg" viewBox="0 -26 120 176">${grad}
        <ellipse cx="60" cy="139" rx="27" ry="5.5" fill="rgba(0,0,0,0.14)"/>
        <path d="M 60 50 C 88 50 96 92 96 104 C 96 124 80 136 60 136
                 C 40 136 24 124 24 104 C 24 92 32 50 60 50 Z"
              fill="${FILL}" stroke="${LINE}" stroke-width="1.8"/>
        <ellipse cx="47" cy="82"  rx="8"  ry="10" fill="${sp.accent}" opacity="0.26"/>
        <ellipse cx="74" cy="104" rx="6.5" ry="8" fill="${sp.accent}" opacity="0.22"/>
        <ellipse cx="63" cy="68"  rx="4.5" ry="6" fill="${sp.accent}" opacity="0.2"/>
        <path d="M 42 96 L 52 90 L 48 102 L 60 96 L 56 108 L 68 102"
              stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
      </svg>`;
    }

    // Head shrinks relative to the body as it matures — that proportion shift
    // is what actually reads as "growing up", more than raw size does.
    const headR = [0, 31, 29, 27, 26][stageIdx];
    const bodyW = [0, 25, 31, 35, 38][stageIdx];
    const bodyH = [0, 24, 29, 33, 35][stageIdx];
    const headY = [0, 56, 54, 52, 50][stageIdx];
    const bodyY = [0, 102, 100, 98, 97][stageIdx];
    const headTop = headY - headR * 0.92;

    // Tails sit behind the body and give each species a distinct silhouette
    const tail = {
      floppy: `<path d="M ${60+bodyW*0.82} ${bodyY+4} q 20 -4 16 -22 q -1 -6 -6 -5 q -4 1 -3 6 q 2 12 -12 15 z"
                     fill="${FILL}" stroke="${LINE}" stroke-width="1.5" stroke-linejoin="round"/>`,
      pointy: `<path d="M ${60+bodyW*0.8} ${bodyY+6} q 26 2 26 -22 q 0 -8 -7 -8 q -6 0 -5 7 q 1 14 -15 15 z"
                     fill="${FILL}" stroke="${LINE}" stroke-width="1.5" stroke-linejoin="round"/>`,
      long:   `<circle cx="${60+bodyW*0.92}" cy="${bodyY+6}" r="9" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"/>`,
      none:   '',
    }[sp.ear] || '';

    // Ears are positioned to clear the head outline so the species is legible
    const ears = {
      floppy: `<ellipse cx="${60-headR*1.02}" cy="${headY+7}" rx="10.5" ry="19"
                        fill="${FILL}" stroke="${LINE}" stroke-width="1.6"
                        transform="rotate(-16 ${60-headR*1.02} ${headY+7})"/>
               <ellipse cx="${60+headR*1.02}" cy="${headY+7}" rx="10.5" ry="19"
                        fill="${FILL}" stroke="${LINE}" stroke-width="1.6"
                        transform="rotate(16 ${60+headR*1.02} ${headY+7})"/>`,
      pointy: `<path d="M ${60-headR*0.74} ${headTop+9} L ${60-headR*0.96} ${headTop-19} L ${60-headR*0.16} ${headTop+2} Z"
                     fill="${FILL}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
               <path d="M ${60-headR*0.7} ${headTop+6} L ${60-headR*0.84} ${headTop-11} L ${60-headR*0.3} ${headTop+1} Z"
                     fill="${sp.accent}" opacity="0.4"/>
               <path d="M ${60+headR*0.74} ${headTop+9} L ${60+headR*0.96} ${headTop-19} L ${60+headR*0.16} ${headTop+2} Z"
                     fill="${FILL}" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
               <path d="M ${60+headR*0.7} ${headTop+6} L ${60+headR*0.84} ${headTop-11} L ${60+headR*0.3} ${headTop+1} Z"
                     fill="${sp.accent}" opacity="0.4"/>`,
      long:   `<ellipse cx="${60-13}" cy="${headTop-16}" rx="7.5" ry="24" fill="${FILL}" stroke="${LINE}" stroke-width="1.6"
                        transform="rotate(-10 ${60-13} ${headTop-16})"/>
               <ellipse cx="${60-13}" cy="${headTop-16}" rx="3.4" ry="16" fill="${sp.accent}" opacity="0.35"
                        transform="rotate(-10 ${60-13} ${headTop-16})"/>
               <ellipse cx="${60+13}" cy="${headTop-16}" rx="7.5" ry="24" fill="${FILL}" stroke="${LINE}" stroke-width="1.6"
                        transform="rotate(10 ${60+13} ${headTop-16})"/>
               <ellipse cx="${60+13}" cy="${headTop-16}" rx="3.4" ry="16" fill="${sp.accent}" opacity="0.35"
                        transform="rotate(10 ${60+13} ${headTop-16})"/>`,
      none:   `<path d="M ${60-4} ${headTop+3} q 3 -13 11 -8 q 6 4 1 9"
                     stroke="${sp.accent}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    }[sp.ear] || '';

    const eyeY  = headY + 3;
    const eyeDX = headR * 0.4;
    const eyeR  = stageIdx <= 2 ? 5.6 : 5;

    const shellHat = stageIdx === 1
      ? `<path d="M ${60-21} ${headTop+7} q 21 -17 42 0 l -7 6 l -8 -6 l -7 7 l -8 -6 z"
               fill="#FFFDF6" stroke="${LINE}" stroke-width="1.5" stroke-linejoin="round"/>` : '';
    // Final stage floats a halo instead of a crown: a crown occupies exactly
    // the pointy/long ear zone and hid them entirely.
    const halo = stageIdx === 4
      ? `<ellipse cx="60" cy="${headTop-26}" rx="20" ry="5.6" fill="none" stroke="#FFD24A" stroke-width="4.2"/>
         <ellipse cx="60" cy="${headTop-26}" rx="20" ry="5.6" fill="none" stroke="#FFF3B0" stroke-width="1.4"/>` : '';
    const scarf = stageIdx >= 2
      ? `<path d="M ${60-14} ${headY+headR*0.78} q 14 9 28 0 l 3 7 q -17 10 -34 0 z"
               fill="${sp.accent}"/>
         <path d="M ${60+9} ${headY+headR*0.86+4} l 9 12 l -8 2 l -5 -11 z" fill="${sp.accent}"/>` : '';

    const nose = sp.ear === 'none'
      ? `<ellipse cx="60" cy="${eyeY+10}" rx="3" ry="2.2" fill="${sp.shade}"/>`
      : `<path d="M ${60-5} ${eyeY+8} q 5 6 10 0 q -5 4 -10 0 z" fill="#2A2A2A"/>
         <ellipse cx="60" cy="${eyeY+8}" rx="4.6" ry="3.2" fill="#2A2A2A"/>`;
    const whiskers = sp.ear === 'pointy'
      ? `<g stroke="${LINE}" stroke-width="1.3" stroke-linecap="round" opacity="0.8">
           <path d="M ${60-13} ${eyeY+9} L ${60-30} ${eyeY+6}"/>
           <path d="M ${60-13} ${eyeY+12} L ${60-30} ${eyeY+14}"/>
           <path d="M ${60+13} ${eyeY+9} L ${60+30} ${eyeY+6}"/>
           <path d="M ${60+13} ${eyeY+12} L ${60+30} ${eyeY+14}"/>
         </g>` : '';

    // Outfits are drawn into the SVG, never overlaid with absolute positioning
    // — the pet scales with its level and an overlay would drift off it.
    // Player choice wins; the theme only dresses the pet if they haven't.
    const _th = currentTheme();
    const outfitId = (S.equipped && S.equipped.outfit) || (_th && _th.outfit) || '';
    const outfitArt = outfitArtFor(DECOR[outfitId]?.draw, headTop, headY, headR);

    return `<svg class="pet-svg" viewBox="0 -26 120 176">${grad}
      <ellipse cx="60" cy="139" rx="${bodyW*0.86}" ry="5.5" fill="rgba(0,0,0,0.14)"/>
      ${tail}
      <ellipse cx="${60-bodyW*0.52}" cy="134" rx="9.5" ry="6" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"/>
      <ellipse cx="${60+bodyW*0.52}" cy="134" rx="9.5" ry="6" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"/>
      <ellipse class="pet-body" cx="60" cy="${bodyY}" rx="${bodyW}" ry="${bodyH}" fill="${FILL}" stroke="${LINE}" stroke-width="1.8"/>
      <ellipse cx="60" cy="${bodyY+bodyH*0.24}" rx="${bodyW*0.56}" ry="${bodyH*0.5}" fill="#FFFFFF" opacity="0.4"/>
      <ellipse cx="${60-bodyW*0.86}" cy="${bodyY+bodyH*0.3}" rx="7.5" ry="10" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"
               transform="rotate(-12 ${60-bodyW*0.86} ${bodyY+bodyH*0.3})"/>
      <ellipse cx="${60+bodyW*0.86}" cy="${bodyY+bodyH*0.3}" rx="7.5" ry="10" fill="${FILL}" stroke="${LINE}" stroke-width="1.5"
               transform="rotate(12 ${60+bodyW*0.86} ${bodyY+bodyH*0.3})"/>
      ${ears}
      <ellipse class="pet-head" cx="60" cy="${headY}" rx="${headR}" ry="${headR*0.92}" fill="${FILL}" stroke="${LINE}" stroke-width="1.8"/>
      ${scarf}${shellHat}${halo}${outfitArt}
      <ellipse cx="${60-eyeDX}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR*1.06}" fill="#2A2A2A"/>
      <ellipse cx="${60+eyeDX}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR*1.06}" fill="#2A2A2A"/>
      <circle cx="${60-eyeDX+2}" cy="${eyeY-2}" r="1.9" fill="#fff" opacity="0.95"/>
      <circle cx="${60+eyeDX+2}" cy="${eyeY-2}" r="1.9" fill="#fff" opacity="0.95"/>
      <ellipse cx="${60-headR*0.68}" cy="${eyeY+9}" rx="6.2" ry="3.8" fill="${sp.accent}" opacity="0.34"/>
      <ellipse cx="${60+headR*0.68}" cy="${eyeY+9}" rx="6.2" ry="3.8" fill="${sp.accent}" opacity="0.34"/>
      ${whiskers}${nose}
      <path d="M ${60-7} ${eyeY+13} q 7 7 14 0" stroke="#2A2A2A" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  /* ── Home banner ── */
  function renderPetBanner() {
    const el = document.getElementById('pet-banner');
    if (!el) return;
    if (!S.petSpecies) {
      el.innerHTML = `<div class="pet-adopt" onclick="App.openPetAdopt()">
        <span class="pet-adopt-ico">🥚</span>
        <div>
          <div class="pet-adopt-title">领养你们的小家伙</div>
          <div class="pet-adopt-sub">一起养大它，看着它慢慢长大 →</div>
        </div>
      </div>`;
      return;
    }
    const st = petStageInfo();
    const mood = petMood();
    const face = petMoodFace(mood);
    el.innerHTML = `<div class="pet-banner-box ${face.cls}" onclick="App.showPetHome()">
      <div class="pet-banner-avatar">${petSvg(st.idx)}</div>
      <div class="pet-banner-info">
        <div class="pet-banner-top">
          <span class="pet-banner-name">${_escHtml(petName())}</span>
          <span class="pet-banner-lv">Lv.${st.stage.lv} ${st.stage.name}</span>
          <span class="pet-banner-mood">${face.emoji}</span>
        </div>
        <div class="pet-exp-track"><div class="pet-exp-fill" style="width:${st.pct}%"></div></div>
        <div class="pet-banner-say">「${_escHtml(petSpeech())}」</div>
      </div>
      <div class="pet-banner-arrow">›</div>
    </div>`;
  }

  /* ── Adoption ── */
  function openPetAdopt() {
    const grid = document.getElementById('pet-species-grid');
    grid.innerHTML = Object.values(PET_SPECIES).map(sp =>
      `<div class="pet-pick ${S.petPick === sp.key ? 'on' : ''}" onclick="App.pickPetSpecies('${sp.key}')">
        <div class="pet-pick-art">${petSvg(2, sp)}</div>
        <div class="pet-pick-name">${sp.emoji} ${sp.label}</div>
        <div class="pet-pick-tone">${sp.tone === 'baby' ? '会叫你们爸爸妈妈' : '会叫你们主人'}</div>
      </div>`).join('');
    openModal('modal-pet-adopt');
  }

  function pickPetSpecies(key) {
    S.petPick = key;
    document.querySelectorAll('.pet-pick').forEach((el, i) => {
      el.classList.toggle('on', Object.keys(PET_SPECIES)[i] === key);
    });
  }

  async function confirmAdopt() {
    const key  = S.petPick;
    const name = document.getElementById('pet-name-input').value.trim();
    if (!key)  { showToast('先选一个小家伙吧 🥚'); return; }
    if (!name) { showToast('给它取个名字吧'); return; }
    // Everything earned before this moment belongs to the couple's past, not
    // to the pet — snapshot it so the pet genuinely hatches at 0 EXP.
    await _loadStatsSources();
    const base = petExpDerived();
    S.petSpecies = key; S.petName = name; S.petBase = base; S.petExpStored = 0;
    try {
      await Data.saveConfig({ petSpecies: key, petName: name, petBase: base, petExp: 0 });
      closeModal('modal-pet-adopt');
      spawnConfetti();
      showToast(`🎉 ${name} 加入了你们的小窝！`);
      renderPetBanner();
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  }

  /* ── Pet home (小窝) ── */
  let _petTaps = 0;

  async function showPetHome() {
    if (!S.petSpecies) { openPetAdopt(); return; }
    document.getElementById('pet-page')?.classList.add('open');
    await _loadStatsSources();
    try { S.decorOwned = await Data.getDecorOwned(); } catch { S.decorOwned = []; }
    renderPetHome();
    _markRoomSynced();
    startPetSync();
  }

  function closePetHome() {
    stopPetSync();
    document.getElementById('room-sync-banner')?.classList.remove('show');
    document.getElementById('pet-page')?.classList.remove('open');
    renderPetBanner();
  }

  /* ── Room rendering from equipped state ── */
  // The view out of the window is the actual view out of your window: same
  // weather, and at night the same moon phase as the sky outside.
  function renderRoomWeather() {
    const room = document.getElementById('pet-room');
    if (!room) return;
    room.classList.remove('wx-rain', 'wx-thunder', 'wx-snow', 'wx-fog', 'wx-cloudy', 'wx-clear');
    if (_wxKind) room.classList.add('wx-' + _wxKind);

    const win = room.querySelector('.pet-window');
    if (!win) return;
    win.querySelectorAll('.pet-win-drop').forEach(e => e.remove());
    const wet = _wxKind === 'rain' || _wxKind === 'thunder' || _wxKind === 'snow';
    if (wet) {
      const snow = _wxKind === 'snow';
      let h = '';
      for (let i = 0; i < 9; i++) {
        h += `<span class="pet-win-drop${snow ? ' snow' : ''}" style="--x:${6 + i * 10}%;` +
             `--d:${((i * 31) % 20) / 10};--t:${(snow ? 3.2 : 0.75) + ((i * 17) % 5) / 10}s"></span>`;
      }
      win.insertAdjacentHTML('beforeend', h);
    }

    const orb = win.querySelector('.pet-window-orb');
    if (!orb) return;
    const night = room.classList.contains('sky-night');
    orb.innerHTML = night ? moonSvg() : '';
    orb.classList.toggle('is-moon', night);
  }

  function renderRoomItems() {
    const layer = document.getElementById('pet-decor-layer');
    if (!layer) return;
    const eq = S.equipped || (S.equipped = defaultEquipped());

    layer.innerHTML = (eq.items || []).map((o, i) => {
      const it = DECOR[o.i];
      if (!it || (!it.svg && !it.art)) return '';
      const shadow = it.slot === 'wall' ? 'pet-wall-item' : 'pet-floor-item';
      const sel = (S.decorSel === i) ? ' selected' : '';
      return `<div class="decor-piece ${shadow}${sel}" data-i="${i}"
                   style="left:${o.x}%;top:${o.y}%;font-size:calc(var(--pet-h) * ${it.ratio * (o.s || 1)})"
                   title="${_escHtml(it.name)}">${it.svg || it.art}</div>`;
    }).join('');
    layer.querySelectorAll('.decor-piece').forEach(attachDecorDrag);
    renderDecorHandle();

    // Wallpaper / flooring tint the room itself.
    // CONFLICT RULE: anything the couple BOUGHT always beats the seasonal
    // theme — a season must never paint over wallpaper they spent coins on.
    const room = document.getElementById('pet-room');
    const paper = DECOR[eq.paper], mat = DECOR[eq.mat];
    const th = currentTheme();
    if (room) {
      const skin = paper || (th && th.wall ? { wall: th.wall, floorTone: th.floorTone } : null);
      room.style.background = skin
        ? `linear-gradient(180deg, ${skin.wall[0]} 0%, ${skin.wall[1]} 58%, ${skin.floorTone} 58.2%, ${skin.floorTone} 100%)`
        : '';
      room.style.setProperty('--floor-a', mat ? mat.tone[0] : '');
      room.style.setProperty('--floor-b', mat ? mat.tone[1] : '');
      room.dataset.theme = th ? th.id : '';
      room.dataset.window = th ? (th.window || '') : '';
    }
    renderThemeParticles(th);
  }

  /* ── Keeping the two phones in sync ──
     The room is shared, so a partner rearranging it should show up on your
     screen. We poll rather than push (no websockets available), and we do NOT
     silently re-render: yanking the room out from under someone mid-drag is
     worse than a stale view. Instead a banner offers a refresh, which reloads
     the room only — never a logout. */
  const PET_SYNC_MS = 20000;
  let _petSyncTimer = null, _petSyncBusy = false;

  // Order-independent fingerprint of the shared room state
  function _roomSig(eq, name, species) {
    if (!eq) return '';
    const items = (eq.items || []).map(o => `${o.i}:${_r1(o.x)},${_r1(o.y)},${_r1(o.s)}`).sort().join('|');
    return [name || '', species || '', eq.paper || '', eq.mat || '', eq.outfit || '', items].join('~');
  }
  function _markRoomSynced() {
    S.roomSig = _roomSig(S.equipped, S.petName, S.petSpecies);
  }

  function startPetSync() {
    stopPetSync();
    if (!S.usingSN) return;          // demo mode has no partner to sync with
    _petSyncTimer = setInterval(checkRoomRemote, PET_SYNC_MS);
  }
  function stopPetSync() { clearInterval(_petSyncTimer); _petSyncTimer = null; }

  async function checkRoomRemote() {
    if (document.hidden || _petSyncBusy) return;      // don't poll a background tab
    if (!document.getElementById('pet-page')?.classList.contains('open')) return;
    _petSyncBusy = true;
    try {
      const cfg = await snFetch('/config');
      const sig = _roomSig(parseEquipped(cfg.petEquipped),
                           decodeFromSN(cfg.petName || ''), cfg.petSpecies || '');
      if (S.roomSig && sig !== S.roomSig) showRoomUpdateBanner();
    } catch { /* offline or hiccup — just try again next tick */ }
    finally { _petSyncBusy = false; }
  }

  function showRoomUpdateBanner() {
    const el = document.getElementById('room-sync-banner');
    if (el) el.classList.add('show');
  }

  // Pulls the shared room again in place. Deliberately does not touch the
  // session — the partner changing the sofa must never log you out.
  async function refreshRoom() {
    const el = document.getElementById('room-sync-banner');
    try {
      await Data.init();                       // re-reads config → equipped/pet
      S.decorOwned = await Data.getDecorOwned();
      S.decorSel = null;
      renderPetHome();
      _markRoomSynced();
      el?.classList.remove('show');
      showToast('🔄 小窝已更新');
    } catch (err) {
      showToast('刷新失败: ' + err.message);
    }
  }

  /* ── Select a piece to resize / remove it ──
     Tap (a press that didn't turn into a drag) selects; the bar then edits
     that one piece. Buttons rather than pinch: pinch fights the page zoom on
     iOS and is far harder to hit accurately with furniture this small. */
  function renderDecorHandle() {
    const bar = document.getElementById('decor-handle');
    if (!bar) return;
    const o = (S.equipped?.items || [])[S.decorSel];
    if (!o) { bar.classList.remove('show'); return; }
    const it = DECOR[o.i];
    bar.classList.add('show');
    bar.innerHTML = `
      <span class="dh-name">${it ? _escHtml(it.name) : ''}</span>
      <button class="dh-btn" onclick="App.resizeDecor(-1)" ${o.s <= DECOR_MIN_SCALE ? 'disabled' : ''}>➖</button>
      <span class="dh-size">${Math.round((o.s || 1) * 100)}%</span>
      <button class="dh-btn" onclick="App.resizeDecor(1)" ${o.s >= DECOR_MAX_SCALE ? 'disabled' : ''}>➕</button>
      <button class="dh-btn del" onclick="App.removeSelectedDecor()">🗑</button>
      <button class="dh-btn" onclick="App.selectDecor(null)">✕</button>`;
  }

  function selectDecor(i) {
    S.decorSel = (i === null || S.decorSel === i) ? null : i;
    renderRoomItems();
  }

  async function resizeDecor(dir) {
    const o = (S.equipped?.items || [])[S.decorSel];
    if (!o) return;
    o.s = Math.min(DECOR_MAX_SCALE, Math.max(DECOR_MIN_SCALE, _r1((o.s || 1) + dir * 0.1)));
    renderRoomItems();
    await saveEquipped();
  }

  async function removeSelectedDecor() {
    const o = (S.equipped?.items || [])[S.decorSel];
    if (!o) return;
    await unplaceDecor(o.i);
  }

  /* ── Dragging furniture ──
     Pointer Events (not mouse/touch separately) so one code path covers
     finger and trackpad. Positions are stored as % of the room, so a layout
     arranged on a phone still looks right on an iPad. */
  const DRAG_BOUNDS = {
    floor: { minX: 8, maxX: 92, minY: 62, maxY: 92 },   // must stay on the floor
    wall:  { minX: 8, maxX: 92, minY: 10, maxY: 48 },   // must stay on the wall
  };
  let _dragSaveTimer = null;

  function attachDecorDrag(el) {
    el.addEventListener('pointerdown', (ev) => {
      const room = document.getElementById('pet-room');
      if (!room) return;
      const idx = +el.dataset.i;
      const slot = (S.equipped?.items || [])[idx];
      if (!slot) return;
      const kind = DECOR[slot.i]?.slot === 'wall' ? 'wall' : 'floor';

      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      el.classList.add('dragging');
      const rect = room.getBoundingClientRect();
      const b = DRAG_BOUNDS[kind];
      let moved = false;
      const startX = ev.clientX, startY = ev.clientY;

      const move = (e) => {
        const x = ((e.clientX - rect.left) / rect.width)  * 100;
        const y = ((e.clientY - rect.top)  / rect.height) * 100;
        slot.x = Math.min(b.maxX, Math.max(b.minX, x));
        slot.y = Math.min(b.maxY, Math.max(b.minY, y));
        el.style.left = slot.x + '%';
        el.style.top  = slot.y + '%';
        // A few px of finger wobble shouldn't count as a drag, or tapping to
        // select would almost never work on a phone.
        if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) moved = true;
      };
      const up = () => {
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!moved) { selectDecor(+el.dataset.i); return; }
        // Debounced: dragging fires constantly, and each save is a PUT
        clearTimeout(_dragSaveTimer);
        _dragSaveTimer = setTimeout(() => saveEquipped(), 500);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  // Falling petals / snow / lanterns — purely decorative, click-through.
  function renderThemeParticles(th) {
    const room = document.getElementById('pet-room');
    if (!room) return;
    let layer = room.querySelector('.pet-season-layer');
    if (!th || !th.particle) { layer?.remove(); return; }
    if (layer && layer.dataset.for === th.id) return;   // already correct
    layer?.remove();
    layer = document.createElement('div');
    layer.className = 'pet-season-layer';
    layer.dataset.for = th.id;
    layer.innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<span class="pet-season-p" style="--x:${8 + i * 13}%;--d:${(i * 1.7).toFixed(1)}s;--r:${9 + (i % 4) * 3}s">${th.particle}</span>`
    ).join('');
    room.appendChild(layer);
  }

  function renderPetHome() {
    const st   = petStageInfo();
    const mood = petMood();
    const face = petMoodFace(mood);
    const sp   = petSpecies();

    document.getElementById('pet-page-name').textContent = petName();
    document.getElementById('pet-page-lv').textContent   = `Lv.${st.stage.lv} · ${st.stage.name}`;

    // Window art follows the real clock, tying the room to the day/night theme
    const hr = now().getHours();
    const sky = hr >= 6 && hr < 17 ? 'day' : (hr >= 17 && hr < 19 ? 'dusk' : 'night');
    document.getElementById('pet-room').className =
      'pet-room sky-' + sky + (_wxKind ? ' wx-' + _wxKind : '');
    renderRoomWeather();

    renderRoomItems();

    const stage = document.getElementById('pet-stage');
    stage.style.setProperty('--pet-scale', st.scale);
    stage.innerHTML = petSvg(st.idx);

    const pill = document.getElementById('pet-coin-pill');
    if (pill) pill.textContent = `🪙 ${nestCoins()}`;

    document.getElementById('pet-speech').textContent = petSpeech();
    const th = currentTheme();
    document.getElementById('pet-mood-chip').innerHTML =
      (th ? `<span class="pet-season-chip">${th.emoji} ${th.name}</span> ` : '') +
      `${face.emoji} ${face.label} · ${mood}`;

    document.getElementById('pet-exp-bar').innerHTML =
      `<div class="pet-exp-track big"><div class="pet-exp-fill" style="width:${st.pct}%"></div></div>
       <div class="pet-exp-txt">${st.next
         ? `EXP ${st.exp} · 还差 ${st.toNext} 升到「${st.next.name}」`
         : `EXP ${st.exp} · 已经养到圆满啦 👑`}</div>`;

    // Contribution split — shown because you asked to see it, but it feeds
    // nothing: the pet belongs to both of you equally.
    const c1 = Math.max(0, S.char1Score), c2 = Math.max(0, S.char2Score);
    const tot = c1 + c2;
    const p1 = tot ? Math.round((c1 / tot) * 100) : 50;
    document.getElementById('pet-contrib').innerHTML = `
      <div class="pet-contrib-head">本轮一起投喂</div>
      <div class="pet-contrib-bar">
        <div class="pcb-1" style="width:${p1}%"></div>
        <div class="pcb-2" style="width:${100 - p1}%"></div>
      </div>
      <div class="pet-contrib-legend">
        <span><i class="dot c1"></i>${_escHtml(charDisplayName('char1'))} ${c1}</span>
        <span><i class="dot c2"></i>${_escHtml(charDisplayName('char2'))} ${c2}</span>
      </div>`;
  }

  /* ── 装修面板 ── */
  function openDecor() {
    if (!S.petSpecies) { showToast('先领养一只小家伙吧 🥚'); return; }
    renderDecor();
    openModal('modal-decor');
  }

  function decorTab(tab) {
    S.decorTab = tab;
    renderDecor();
  }

  // Is this item currently placed? Slot items live in arrays, the rest are scalars.
  function decorPlaced(id, slot) {
    const eq = S.equipped || defaultEquipped();
    if (slot === 'floor' || slot === 'wall') return (eq.items || []).some(o => o.i === id);
    return eq[slot] === id;
  }

  function renderDecor() {
    const coins = nestCoins();
    const pill = document.getElementById('pet-coin-pill');
    if (pill) pill.textContent = `🪙 ${coins}`;
    const badge = document.getElementById('decor-coins');
    if (badge) badge.textContent = `🪙 ${coins} 小窝币`;

    ['floor','wall','paper','mat','outfit'].forEach(t =>
      document.getElementById('dtab-' + t)?.classList.toggle('active', t === S.decorTab));

    const items = Object.entries(DECOR)
      .filter(([, it]) => it.slot === S.decorTab)
      // Out-of-season stock hides from the shop, but anything already owned
      // stays visible so it can still be placed.
      .filter(([id, it]) => decorInSeason(it) || decorOwns(id));

    const grid = document.getElementById('decor-grid');
    if (!items.length) { grid.innerHTML = `<div class="decor-empty">这一类还没有东西</div>`; return; }

    grid.innerHTML = items.map(([id, it]) => {
      const owned  = decorOwns(id);
      const placed = decorPlaced(id, it.slot);
      const afford = coins >= it.price;
      const art = decorArtHtml(it);
      let btn;
      if (!owned) {
        btn = `<button class="decor-btn" ${afford ? '' : 'disabled'} onclick="App.buyDecor('${id}')">
                 ${afford ? `🪙 ${it.price} 购买` : `🪙 ${it.price} 不够`}</button>`;
      } else if (placed) {
        btn = `<button class="decor-btn placed" onclick="App.unplaceDecor('${id}')">✓ 已摆放</button>`;
      } else {
        btn = `<button class="decor-btn own" onclick="App.placeDecor('${id}')">摆进小窝</button>`;
      }
      return `<div class="decor-card ${placed ? 'placed' : ''}">
        ${it.season ? `<span class="decor-limited">${it.season}限定</span>` : ''}
        ${art}
        <div class="decor-name">${_escHtml(it.name)}</div>
        <div class="decor-price">${it.free ? '初始赠送' : owned ? '已拥有' : `售价 ${it.price}`}</div>
        ${btn}
      </div>`;
    }).join('');
  }

  async function buyDecor(id) {
    const it = DECOR[id];
    if (!it || decorOwns(id)) return;
    if (nestCoins() < it.price) { showToast('🪙 小窝币不够，再攒攒'); return; }
    try {
      await Data.buyDecor(id);
      S.decorOwned = await Data.getDecorOwned();
      spawnPetHearts();
      showToast(`🎉 买下了「${it.name}」`);
      await placeDecor(id);          // place it immediately — that's the payoff
    } catch (err) {
      showToast(err.message === 'already_owned' ? '已经拥有了' : '购买失败: ' + err.message);
    }
  }

  async function placeDecor(id) {
    const it = DECOR[id];
    if (!it || !decorOwns(id)) return;
    const eq = S.equipped || (S.equipped = defaultEquipped());
    if (it.slot === 'floor' || it.slot === 'wall') {
      eq.items = eq.items || [];
      if (!eq.items.some(o => o.i === id)) {
        // Stagger new pieces so they never land exactly on top of each other
        const n = eq.items.length;
        const piece = it.slot === 'wall'
          ? { i:id, x: 18 + (n % 4) * 20, y: 22 + (n % 3) * 8,  s:1 }
          : { i:id, x: 14 + (n % 5) * 18, y: 70 + (n % 3) * 8, s:1 };
        // Refuse BEFORE the room changes: a piece that can't be saved would
        // otherwise show up now and vanish on the partner's next refresh.
        if (encodeEquipped({ ...eq, items: [...eq.items, piece] }).length > EQ_MAX) {
          showToast('小窝摆太满啦，先收起一件再摆 🧺');
          return;
        }
        eq.items.push(piece);
      }
    } else {
      eq[it.slot] = id;
    }
    renderRoomItems();
    if (it.slot === 'outfit') renderPetHome();
    renderDecor();
    await saveEquipped();
  }

  async function unplaceDecor(id) {
    const it = DECOR[id];
    const eq = S.equipped || (S.equipped = defaultEquipped());
    if (!it) return;
    if (it.slot === 'floor' || it.slot === 'wall') {
      eq.items = (eq.items || []).filter(o => o.i !== id);
      S.decorSel = null;
    } else if (eq[it.slot] === id) {
      eq[it.slot] = '';
    }
    renderRoomItems();
    if (it.slot === 'outfit') renderPetHome();
    renderDecor();
    await saveEquipped();
  }

  function pokePet() {
    const stage = document.getElementById('pet-stage');
    if (!stage) return;
    stage.classList.remove('poke');
    void stage.offsetWidth;
    stage.classList.add('poke');
    _petTaps++;
    const sp = petSpecies();
    const who = sp.tone === 'baby' ? '爸爸妈妈' : '主人';
    const lines = _petTaps > 3
      ? [`好痒呀～`, `再摸就要生气咯 😖`, `${who}调皮！`]
      : [`嘿嘿～`, `${who}摸摸我 💕`, `我在这儿呢！`, `喜欢你们 🥰`];
    document.getElementById('pet-speech').textContent =
      lines[Math.floor(Math.random() * lines.length)];
    spawnPetHearts();
  }

  function spawnPetHearts() {
    const room = document.getElementById('pet-room');
    if (!room) return;
    for (let i = 0; i < 4; i++) {
      const h = document.createElement('span');
      h.className = 'pet-heart';
      h.textContent = ['💕','💖','✨','💗'][i % 4];
      h.style.left = (42 + Math.random() * 16) + '%';
      h.style.animationDelay = (i * 0.09) + 's';
      room.appendChild(h);
      setTimeout(() => h.remove(), 1500);
    }
  }

  async function renamePet() {
    const name = document.getElementById('pet-rename-input').value.trim();
    if (!name) { showToast('名字不能为空'); return; }
    S.petName = name;
    try {
      await Data.saveConfig({ petName: name });
      closeModal('modal-pet-rename');
      renderPetHome();
      showToast('✅ 改名成功');
    } catch (err) { showToast('保存失败: ' + err.message); }
  }

  function openPetRename() {
    document.getElementById('pet-rename-input').value = S.petName || '';
    openModal('modal-pet-rename');
  }

  function logout() {
    localStorage.removeItem('sn_api_key');
    localStorage.removeItem('sn_username');
    localStorage.removeItem('sn_char');
    localStorage.removeItem('sn_match');
    localStorage.removeItem('sn_charname1');
    localStorage.removeItem('sn_charname2');
    location.reload();
  }

  /* ── Modal helpers ── */
  function openModal(id) {
    const el = document.getElementById(id);
    el.classList.add('open');
    el.onclick = e => { if (e.target === el) closeModal(id); };
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  /* ── Custom confirm dialog (replaces native confirm()) ── */
  let _confirmResolve = null;
  function showConfirm(message, danger = true) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-ok-btn').className = danger ? 'btn-danger' : 'btn-primary';
    const el = document.getElementById('modal-confirm');
    el.classList.add('open');
    el.onclick = e => { if (e.target === el) resolveConfirm(false); };
    return new Promise(resolve => { _confirmResolve = resolve; });
  }
  function resolveConfirm(result) {
    closeModal('modal-confirm');
    if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
  }

  /* ── Animations ── */
  function spawnParticles(positive) {
    const icons = positive
      ? ['⭐','🌟','✨','💙','💫','🐾','🎀','💝']
      : ['💔','😿','🌧️','💧','😢','❄️'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;

    for (let i = 0; i < 7; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      const dx = (Math.random() - 0.5) * 180;
      const dy = -(Math.random() * 200 + 80);
      el.style.cssText = `left:${cx + (Math.random()-0.5)*60}px;top:${cy}px;--dx:${dx}px;--dy:${dy}px;animation-delay:${i*0.05}s`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1100 + i * 50);
    }
  }

  function spawnConfetti() {
    const colors = ['#FFD700','#FF6B9D','#5B9BD5','#6BCB77','#C9B1FF','#FF6B6B'];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left:${Math.random()*100}vw;
        top:${Math.random()*30}vh;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        --dx:${(Math.random()-0.5)*200}px;
        --dy:${Math.random()*400+200}px;
        --rot:${Math.random()*720}deg;
        animation-delay:${Math.random()*0.5}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }
  }

  function spawnFlash() {
    const el = document.createElement('div');
    el.className = 'flash-overlay';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function checkThreshold() {
    const info = progressInfo(S.score, S.mode, activeNegPts());
    if (info.reached) {
      if (S.mode === 'reward') {
        setTimeout(() => { spawnConfetti(); showToast('🎊 达到奖励线！快去结算！'); }, 300);
      } else {
        setTimeout(() => { spawnFlash(); showToast('⚠️ 已触发惩罚！快去结算！'); }, 300);
      }
    }
  }

  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /* ── Manage: edit context ── */
  let editCtx = { type: null, id: null };

  function openManage(type) {
    editCtx.type = type;
    const titleMap = { category: '✏️ 管理分类', reward: '🏆 管理奖励', punishment: '😈 管理惩罚' };
    document.getElementById('manage-modal-title').textContent = titleMap[type];
    const badge = document.getElementById('manage-sn-badge');
    badge.textContent = S.usingSN ? '☁️ SN 已连接' : '📱 本地模式';
    badge.style.color = S.usingSN ? 'var(--blue)' : 'var(--sub)';
    renderManageList(type);
    openModal('modal-manage');
  }

  function openManageFromTable() {
    closeModal('modal-tables');
    openManage(S.mode === 'reward' ? 'reward' : 'punishment');
  }

  function renderManageList(type) {
    const list = document.getElementById('manage-list');
    const items = type === 'category' ? S.categories : type === 'reward' ? S.rewards : S.punishments;

    if (!items || !items.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div>还没有项目，点上方按钮添加</div>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const inactive = type === 'category' && item.active === false;
      let ptsHtml = '';
      if (type === 'category') {
        ptsHtml = item.pts >= 0
          ? `<span class="manage-pts-pos">+${item.pts}</span>`
          : `<span class="manage-pts-neg">${item.pts}</span>`;
      } else {
        ptsHtml = `<span class="manage-pts-thr">≥ ${item.minPts}</span>`;
      }
      const dotClass = (!inactive) ? 'active-dot' : 'active-dot off';
      const activeDot = type === 'category'
        ? `<span class="${dotClass}" title="${inactive?'已隐藏':'显示中'}" onclick="App.toggleCategoryActive('${item.id}')" style="cursor:pointer"></span>`
        : '';

      return `<div class="manage-row ${inactive ? 'manage-inactive' : ''}">
        <span class="manage-icon">${item.icon || '📌'}</span>
        <div class="manage-info">
          <div class="manage-name">${item.name || '(未命名)'}</div>
          ${item.desc ? `<div class="manage-sub">${item.desc}</div>` : ''}
        </div>
        ${ptsHtml}
        ${activeDot}
        <button class="manage-action-btn" onclick="App.openEditForm('${item.id}')" title="编辑">✏️</button>
        <button class="manage-action-btn del" onclick="App.confirmDeleteItem('${item.id}')" title="删除">🗑️</button>
      </div>`;
    }).join('');
  }

  function openEditForm(id) {
    const type = editCtx.type;
    editCtx.id = id || null;
    const isNew = !id;

    let item = {};
    if (!isNew) {
      const arr = type === 'category' ? S.categories : type === 'reward' ? S.rewards : S.punishments;
      item = arr.find(x => x.id === id) || {};
    }

    const typeLabel = { category: '分类', reward: '奖励', punishment: '惩罚' }[type];
    document.getElementById('edit-form-title').textContent = (isNew ? '➕ 添加' : '✏️ 编辑') + typeLabel;

    document.getElementById('ef-icon').value = item.icon  || '';
    document.getElementById('ef-name').value = item.name  || '';
    document.getElementById('ef-pts').value  = type === 'category' ? (item.pts ?? 10) : (item.minPts ?? 30);
    document.getElementById('ef-desc').value = item.desc  || '';

    const ptsLabelEl = document.getElementById('ef-pts-label');
    const ptsSubEl   = document.getElementById('ef-pts-sub');
    const descField  = document.getElementById('ef-desc-field');
    const activeRow  = document.getElementById('ef-active-row');

    if (type === 'category') {
      ptsLabelEl.textContent = '分数';
      ptsSubEl.textContent   = '正数加分，负数扣分';
      descField.style.display  = 'none';
      activeRow.style.display  = 'flex';
      document.getElementById('ef-active').checked = item.active !== false;
    } else {
      ptsLabelEl.textContent = '最低分数';
      ptsSubEl.textContent   = type === 'punishment' ? '负分的绝对值' : '累计分数门槛';
      descField.style.display  = 'block';
      activeRow.style.display  = 'none';
    }

    openModal('modal-edit-form');
  }

  async function saveEditForm() {
    const { type, id } = editCtx;
    const icon   = S.usingSN
      ? encodeForSN(document.getElementById('ef-icon').value.trim() || '📌')
      : (document.getElementById('ef-icon').value.trim() || '📌');
    const name   = document.getElementById('ef-name').value.trim();
    const pts    = parseInt(document.getElementById('ef-pts').value)  || 0;
    const desc   = document.getElementById('ef-desc').value.trim();
    const active = document.getElementById('ef-active').checked;

    if (!name) { showToast('请填写名称 ⚠️'); return; }

    const data = type === 'category'
      ? { icon, name, pts, active }
      : { icon, name, minPts: pts, desc };

    try {
      if (id) {
        await Data.updateItem(type, id, data);
        // update in-memory state
        const arr = type === 'category' ? S.categories : type === 'reward' ? S.rewards : S.punishments;
        const idx = arr.findIndex(x => x.id === id);
        if (idx >= 0) arr[idx] = { ...arr[idx], ...data, icon: decodeFromSN(data.icon || '') || '' };
        showToast('✅ 已更新 → ' + (S.usingSN ? 'SN 已同步' : '本地已保存'));
      } else {
        const created = await Data.addItem(type, data);
        if (type === 'category')   S.categories.push(created);
        else if (type === 'reward') S.rewards.push(created);
        else                        S.punishments.push(created);
        showToast('✅ 已添加 → ' + (S.usingSN ? 'SN 已同步' : '本地已保存'));
      }
      closeModal('modal-edit-form');
      renderManageList(type);
      if (type === 'category') renderCategories();
    } catch (err) {
      showToast('保存失败: ' + err.message);
    }
  }

  async function toggleCategoryActive(id) {
    const cat = S.categories.find(c => c.id === id);
    if (!cat) return;
    cat.active = cat.active === false ? true : false;
    try {
      await Data.updateItem('category', id, { active: cat.active });
      renderManageList('category');
      renderCategories();
    } catch (err) {
      showToast('更新失败: ' + err.message);
    }
  }

  async function confirmDeleteItem(id) {
    const type = editCtx.type;
    const arr  = type === 'category' ? S.categories : type === 'reward' ? S.rewards : S.punishments;
    const item = arr.find(x => x.id === id);
    if (!item) return;
    if (!(await showConfirm(`确认删除「${item.name}」？\n${S.usingSN ? '将从 ServiceNow 删除' : '将从本地删除'}`))) return;
    try {
      await Data.deleteItem(type, id);
      if (type === 'category')    S.categories  = S.categories.filter(x => x.id !== id);
      else if (type === 'reward') S.rewards     = S.rewards.filter(x => x.id !== id);
      else                        S.punishments = S.punishments.filter(x => x.id !== id);
      renderManageList(type);
      if (type === 'category') renderCategories();
      showToast('🗑️ 已删除');
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  /* ── Shop page ── */
  let _pendingBuyId = null;

  async function showShop() {
    const pg = document.getElementById('shop-page');
    if (!pg) return;
    // Update score display for the logged-in char
    const scoreEl = document.getElementById('shop-score-num');
    if (scoreEl) {
      const myScore = S.activeChar === 'char2' ? S.char2Score : S.char1Score;
      scoreEl.textContent = myScore;
    }
    pg.classList.add('open');
    // Always reload shop tab on open
    S.shopTab = 'shop';
    _shopTabUI('shop');
    await renderShopContent();
  }

  function closeShop() {
    document.getElementById('shop-page')?.classList.remove('open');
    // Return home nav highlight
    ['home','tables','history','shop','settings'].forEach(p =>
      document.getElementById('nav-'+p)?.classList.remove('active'));
    document.getElementById('nav-home')?.classList.add('active');
  }

  function shopTabSwitch(tab) {
    S.shopTab = tab;
    _shopTabUI(tab);
    renderShopContent();
  }

  function _shopTabUI(tab) {
    ['shop','bag','bag-history'].forEach(t => {
      document.getElementById('shop-tab-'+t)?.classList.toggle('active', t === tab);
      const c = document.getElementById('shop-content-'+t);
      if (c) c.classList.toggle('hidden', t !== tab);
    });
  }

  async function renderShopContent() {
    const tab = S.shopTab;
    if (tab === 'shop')        await _renderShopItems();
    else if (tab === 'bag')    await _renderBagItems();
    else                       await _renderBagHistory();
  }

  async function _renderShopItems() {
    const el = document.getElementById('shop-content-shop');
    if (!el) return;
    if (!S.usingSN) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">🔌</div><div class="shop-empty-text">请连接 ServiceNow 使用商店功能</div></div>';
      return;
    }
    el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中…</div>';
    try {
      S.shopItems = await ShopData.getItems();
    } catch(e) {
      const isNetErr = e.message.includes('fetch') || e.message.includes('network');
      el.innerHTML = `<div class="shop-empty">
        <div class="shop-empty-icon">${isNetErr ? '🔧' : '😕'}</div>
        <div class="shop-empty-text">${isNetErr ? '商品功能尚未在 SN 配置\n请先添加 u_love_shop 表和 API 资源' : '加载失败: ' + e.message}</div>
        <div style="margin-top:12px"><button class="btn-primary" style="font-size:13px;padding:10px 20px" onclick="App.openShopManage()">⚙️ 管理商品</button></div>
      </div>`;
      return;
    }
    const myScore = S.activeChar === 'char2' ? S.char2Score : S.char1Score;
    const active  = S.shopItems.filter(i => i.active !== false);
    if (!active.length) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">🛍️</div><div class="shop-empty-text">暂无商品，点右上角"管理"添加</div></div>';
      return;
    }
    el.innerHTML = `<div class="shop-items-grid">${active.map(item => `
      <div class="shop-item-card${item.active === false ? ' inactive' : ''}">
        <div class="shop-item-icon">${item.icon || '🎁'}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc || ''}</div>
        <div class="shop-item-cost">${item.ptsCost} 分</div>
        <button class="shop-item-buy"
          onclick="App.openBuySheet('${item.id}')"
          ${myScore < item.ptsCost ? 'disabled' : ''}>
          ${myScore >= item.ptsCost ? '兑换' : '积分不足'}
        </button>
      </div>`).join('')}</div>`;
  }

  async function _renderBagItems() {
    const el = document.getElementById('shop-content-bag');
    if (!el) return;
    if (!S.usingSN) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">🔌</div><div class="shop-empty-text">请连接 ServiceNow 使用背包功能</div></div>';
      return;
    }
    el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中…</div>';
    try {
      S.bagItems = await ShopData.getBag();
    } catch(e) {
      el.innerHTML = `<div class="shop-empty"><div class="shop-empty-icon">😕</div><div class="shop-empty-text">加载失败: ${e.message}</div></div>`;
      return;
    }
    if (!S.bagItems.length) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">🎒</div><div class="shop-empty-text">背包是空的，去商店兑换吧！</div></div>';
      return;
    }
    el.innerHTML = S.bagItems.map(item => `
      <div class="bag-item">
        <div class="bag-item-icon">${item.itemIcon || '🎁'}</div>
        <div class="bag-item-info">
          <div class="bag-item-name">${item.itemName}</div>
          <div class="bag-item-meta">${item.acquiredDate} · 花费 ${item.ptsSpent} 分</div>
        </div>
        <button class="bag-item-use" onclick="App.confirmUseItem('${item.id}', '${item.itemName}')">使用</button>
      </div>`).join('');
  }

  async function _renderBagHistory() {
    const el = document.getElementById('shop-content-bag-history');
    if (!el) return;
    if (!S.usingSN) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">🔌</div><div class="shop-empty-text">请连接 ServiceNow 使用此功能</div></div>';
      return;
    }
    el.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中…</div>';
    try {
      S.bagHistory = await ShopData.getBagHistory();
    } catch(e) {
      el.innerHTML = `<div class="shop-empty"><div class="shop-empty-icon">😕</div><div class="shop-empty-text">加载失败: ${e.message}</div></div>`;
      return;
    }
    if (!S.bagHistory.length) {
      el.innerHTML = '<div class="shop-empty"><div class="shop-empty-icon">📜</div><div class="shop-empty-text">还没有使用过任何道具</div></div>';
      return;
    }
    el.innerHTML = S.bagHistory.map(item => `
      <div class="bag-history-item">
        <div class="bag-history-icon">${item.itemIcon || '🎁'}</div>
        <div class="bag-history-info">
          <div class="bag-history-name">${item.itemName}</div>
          <div class="bag-history-meta">兑换: ${item.acquiredDate}  ·  使用: ${item.usedDate}</div>
        </div>
        <div class="bag-history-badge">✅ 已用</div>
      </div>`).join('');
  }

  function openBuySheet(id) {
    const item = S.shopItems.find(i => i.id === id);
    if (!item) return;
    _pendingBuyId = id;
    document.getElementById('buy-sheet-icon').textContent = item.icon || '🎁';
    document.getElementById('buy-sheet-name').textContent = item.name;
    document.getElementById('buy-sheet-desc').textContent = item.desc || '';
    document.getElementById('buy-sheet-cost').textContent = item.ptsCost;
    document.getElementById('buy-sheet-overlay').classList.add('open');
    document.getElementById('buy-confirm-sheet').classList.add('open');
  }

  function closeBuySheet() {
    _pendingBuyId = null;
    document.getElementById('buy-sheet-overlay').classList.remove('open');
    document.getElementById('buy-confirm-sheet').classList.remove('open');
  }

  async function confirmBuy() {
    if (!_pendingBuyId) return;
    const btn = document.getElementById('buy-sheet-ok-btn');
    if (btn) { btn.disabled = true; btn.textContent = '处理中…'; }
    try {
      const result = await ShopData.buyItem(_pendingBuyId);
      closeBuySheet();
      showToast('🎁 兑换成功！');
      // Update score display
      if (result.newScore !== undefined) {
        if (S.activeChar === 'char2') S.char2Score = result.newScore;
        else S.char1Score = result.newScore;
        S.score = activeScore();
        const scoreEl = document.getElementById('shop-score-num');
        if (scoreEl) scoreEl.textContent = result.newScore;
      }
      // Switch to bag tab to show the new item
      shopTabSwitch('bag');
    } catch(e) {
      closeBuySheet();
      const msg = e.message || '';
      if (msg.includes('insufficient_points')) showToast('😅 积分不足，继续加油！');
      else showToast('兑换失败: ' + msg);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '确认兑换 🎁'; }
    }
  }

  async function confirmUseItem(id, name) {
    if (!(await showConfirm(`确认使用「${name}」？\n使用后将移入历史记录`, false))) return;
    try {
      await ShopData.useItem(id);
      showToast('✅ 已使用！');
      await _renderBagItems();
    } catch(e) {
      showToast('操作失败: ' + e.message);
    }
  }

  function _shopManageSetView(view) {
    document.getElementById('shop-manage-view-list').style.display = view === 'list' ? '' : 'none';
    document.getElementById('shop-manage-view-form').style.display = view === 'form' ? '' : 'none';
  }

  function shopManageBack() {
    _shopManageSetView('list');
  }

  async function openShopManage() {
    if (!S.usingSN) { showToast('请先连接 ServiceNow'); return; }
    _shopManageSetView('list');
    openModal('modal-shop-manage');
    await _renderShopManageList();
  }

  async function _renderShopManageList() {
    const el = document.getElementById('shop-manage-list');
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      S.shopItems = await ShopData.getItems();
    } catch(e) {
      const isNetErr = e.message.includes('fetch') || e.message.includes('network');
      el.innerHTML = `
        <div style="text-align:center;padding:20px 0;color:var(--sub)">
          <div style="font-size:32px;margin-bottom:8px">${isNetErr ? '🔌' : '⚠️'}</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">
            ${isNetErr ? 'SN 商品表尚未创建' : '加载失败'}
          </div>
          <div style="font-size:11px">
            ${isNetErr ? '请先在 ServiceNow Studio 创建 u_love_shop 表和相关资源' : e.message}
          </div>
        </div>`;
      return;
    }
    if (!S.shopItems.length) {
      el.innerHTML = '<div style="color:var(--sub);font-size:13px;text-align:center;padding:20px 0">暂无商品，点上方按钮添加</div>';
      return;
    }
    el.innerHTML = S.shopItems.map(item => `
      <div class="shop-manage-item">
        <div class="shop-manage-icon">${item.icon || '🎁'}</div>
        <div class="shop-manage-info">
          <div class="shop-manage-name">${item.name}${item.active === false ? ' <span style="opacity:0.5;font-size:11px">(已下架)</span>' : ''}</div>
          <div class="shop-manage-pts">${item.ptsCost} 积分${item.desc ? ' · ' + item.desc : ''}</div>
        </div>
        <div class="shop-manage-actions">
          <button class="shop-manage-edit" onclick="App.openShopItemForm('${item.id}')">编辑</button>
          <button class="shop-manage-del"  onclick="App.deleteShopItem('${item.id}')">删除</button>
        </div>
      </div>`).join('');
  }

  function openShopItemForm(id) {
    S.shopEditId = id;
    const titleEl = document.getElementById('shop-item-form-title');
    if (titleEl) titleEl.textContent = id ? '编辑商品' : '添加商品';
    const item = id ? S.shopItems.find(i => i.id === id) : null;
    document.getElementById('sif-icon').value = item ? (decodeFromSN(item.icon) || '') : '';
    document.getElementById('sif-name').value = item?.name || '';
    document.getElementById('sif-desc').value = item?.desc || '';
    document.getElementById('sif-pts').value  = item?.ptsCost || '';
    _shopManageSetView('form');
  }

  async function saveShopItem() {
    const icon    = document.getElementById('sif-icon').value.trim() || '🎁';
    const name    = document.getElementById('sif-name').value.trim();
    const desc    = document.getElementById('sif-desc').value.trim();
    const ptsCost = parseInt(document.getElementById('sif-pts').value) || 0;
    if (!name)       { showToast('请填写商品名称 ⚠️'); return; }
    if (ptsCost < 1) { showToast('积分价格至少 1 分 ⚠️'); return; }
    const saveBtn = document.getElementById('sif-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }
    const data = { icon: encodeForSN(icon), name, desc, ptsCost, active: true };
    try {
      if (S.shopEditId) {
        await ShopData.updateItem(S.shopEditId, data);
        showToast('✅ 商品已更新');
      } else {
        await ShopData.addItem(data);
        showToast('✅ 商品已添加');
      }
      _shopManageSetView('list');
      await _renderShopManageList();
      if (S.shopTab === 'shop') await _renderShopItems();
    } catch(e) {
      const isNetErr = e.message.includes('fetch') || e.message.includes('network');
      showToast(isNetErr ? '⚠️ 请先在 SN 创建商品表' : '保存失败: ' + e.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存 ✅'; }
    }
  }

  async function deleteShopItem(id) {
    const item = S.shopItems.find(i => i.id === id);
    if (!(await showConfirm(`确认删除「${item?.name || '此商品'}」？`))) return;
    try {
      await ShopData.deleteItem(id);
      showToast('🗑️ 已删除');
      await _renderShopManageList();
      if (S.shopTab === 'shop') await _renderShopItems();
    } catch(e) {
      showToast('删除失败: ' + e.message);
    }
  }

  /* ── Boot ── */
  async function boot() {
    console.log('%c恋爱积分簿 ' + APP_VERSION, 'color:#5B9BD5;font-weight:bold');
    const vTag = document.getElementById('app-version-tag');
    if (vTag) vTag.textContent = '版本 ' + APP_VERSION;
    const savedKey = localStorage.getItem('sn_api_key');

    if (MAINTENANCE.on && !_maintBypass) {
      // Show the notice INSTEAD of the login form, and skip auto-resume so an
      // existing session can't slip past the gate.
      const card = document.getElementById('maint-card');
      const form = document.querySelector('#setup-overlay .setup-card');
      if (card) {
        card.style.display = '';
        document.getElementById('maint-title').textContent = MAINTENANCE.title;
        document.getElementById('maint-msg').innerHTML     = MAINTENANCE.message;
        document.getElementById('maint-sub').textContent   = MAINTENANCE.sub;
      }
      if (form) form.style.display = 'none';
      S.usingSN = false;
      await Data.init();
      return;
    }

    if (savedKey) {
      S.snInstance = SN_INSTANCE;
      S.apiKey     = savedKey;
      S.activeChar = localStorage.getItem('sn_char')      || 'char1';
      S.matchId    = localStorage.getItem('sn_match')     || '';
      S.charName1  = localStorage.getItem('sn_charname1') || S.charName1;
      S.charName2  = localStorage.getItem('sn_charname2') || S.charName2;
      S.usingSN    = true;
      try {
        await Data.init();
        await refresh();
      } catch (err) {
        S.usingSN = false;
        localStorage.removeItem('sn_api_key');
        localStorage.removeItem('sn_username');
        localStorage.removeItem('sn_char');
        localStorage.removeItem('sn_match');
        await Data.init();
        await refresh();
      }
    } else {
      S.usingSN    = false;
      S.snInstance = SN_INSTANCE;
      await Data.init();
      await refresh();
    }

    /* update start page names (SVGs are embedded directly in HTML) */
    const sn1 = document.getElementById('sp-name-1');
    const sn2 = document.getElementById('sp-name-2');
    if (sn1) sn1.textContent = S.charName1 || '线条小狗·他';
    if (sn2) sn2.textContent = S.charName2 || '线条小狗·她';
  }

  // Run boot even if the DOM is already parsed — app.js is loaded via a
  // cache-busting async <script>, so DOMContentLoaded may have already fired
  // by the time this runs (which would otherwise leave the app un-booted).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Coming back to the app (tab switch, phone unlock): sync with SN so a
  // settle or new entries from the partner's device show up without a manual reload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.usingSN && S.apiKey) {
      refresh().catch(() => {});
    }
  });

  /* Close modals on overlay click (already set in openModal) */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('modal-confirm')?.classList.contains('open')) resolveConfirm(false);
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  return {
    connect, register, switchTab, onRegCharChange, demoMode,
    toggleMode, selectChar,
    quickEntry, switchCatTab, openCheckin, doCheckin, doCheckinPartner, openAddModal, openEditEntryModal, submitEntry, deleteEntry,
    openSettleModal, confirmSettle,
    nav, showTables, showHistory, showSettings, saveConfig, logout,
    clearDemoData, resetPet,
    setTheme,
    claimReward,
    setCharImg, resetCharImg,
    openManage, openManageFromTable, openEditForm, saveEditForm,
    toggleCategoryActive, confirmDeleteItem,
    openModal, closeModal, resolveConfirm,
    showLovePage, closeLovePage,
    showLetters, closeLetters, openComposeLetter, sendLetter,
    openLetterReader, closeLetterReader, deleteLetter,
    pickMemoryPhoto, saveMemoryPhoto, deleteMemoryPhoto,
    playMemories, closeMemories, memoryPrev, memoryNext, toggleMemoryPlay,
    openGoalModal, saveGoal, clearGoal,
    openPetAdopt, pickPetSpecies, confirmAdopt,
    _petSvgTest: (st, sp) => petSvg(st, PET_SPECIES[sp]),   // art-review helper
    _petStatTest: () => {                                   // test helper
      const st = petStageInfo();
      return { exp: st.exp, lv: st.stage.lv, scale: st.scale, mood: petMood() };
    },
    showPetHome, closePetHome, pokePet, openPetRename, renamePet,
    openDecor, decorTab, buyDecor, placeDecor, unplaceDecor,
    selectDecor, resizeDecor, removeSelectedDecor, refreshRoom,
    _seasonStockTest: (d) => Object.entries(DECOR).filter(([,i]) => i.season && decorInSeason(i, d)).map(([k]) => k),
    _forceRoomBanner: () => showRoomUpdateBanner(),
    _coinTest: () => ({ exp: petExp(), earned: nestCoinsEarned(), spent: nestCoinsSpent(), balance: nestCoins() }),
    _scoreTest: () => ({ c1: S.char1Score, c2: S.char2Score }),
    _decorTest: () => DECOR,
    _lifetimeTest: () => lifetimeCombinedPoints(),
    _stageTest: (v) => { const st = petStageInfo(v); return { lv: st.stage.lv, name: st.stage.name, pct: st.pct, next: st.next ? st.next.name : null, toNext: st.toNext, scale: st.scale }; },
    _roomSigTest: () => _roomSig(S.equipped, S.petName, S.petSpecies),
    _setChar: (w) => { S.activeChar = w; },
    _moodTest: () => petMood(),
    _moodFaceTest: () => petMoodFace(petMood()).label,
    _eqTest: () => S.equipped,
    _parseEqTest: (raw) => parseEquipped(raw),
    _encodeEqTest: (eq) => encodeEquipped(eq),
    _saveEqTest: () => saveEquipped(),
    _maintTest: () => MAINTENANCE,
    _bootTest: () => boot(),
    _setMode: (m) => { S.mode = m; },
    _yearReviewTest: (y) => computeYearReview(y, (S.entries||[]).filter(e => (e.date||'').startsWith(String(y)))),
    _themeTest: (d) => currentTheme(d),
    _periodTest: (d) => { const p = periodOf(d); return { id: p.id, name: p.name, hi: p.hi }; },
    _moonTest: (d) => moonInfo(d),
    _weatherKindTest: (c) => weatherKind(c),
    _applyWeatherTest: (k) => applyWeather(k),
    _roomWeatherTest: () => _wxKind,
    _refreshWeatherTest: () => refreshWeather(),
    _coordsTest: () => guessCoords(),
    _moonSvgTest: (d) => moonSvg(d),
    _applyThemeTest: () => applyTheme(),   // seasons take a date so they're testable
    showAchievements, showYearReview, closeYearReview, playYearMemories,
    showShop, closeShop, shopTabSwitch,
    openBuySheet, closeBuySheet, confirmBuy,
    confirmUseItem,
    openShopManage, openShopItemForm, shopManageBack, saveShopItem, deleteShopItem,
  };
})();

/* ── Start page transition ── */
function startApp() {
  Music.toggle();
  const sp = document.getElementById('start-page');
  if (!sp) return;
  sp.classList.add('sp-exiting');

  function showLogin() {
    const el = document.getElementById('start-page');
    if (el) el.remove();

    const savedName = localStorage.getItem('sn_username');
    const nameEl = document.getElementById('sn-username');
    const btn    = document.getElementById('sn-connect-btn');
    if (savedName && nameEl) nameEl.value = savedName;
    const updateBtn = () => {
      if (btn) btn.textContent = `继续 (${nameEl?.value?.trim() || savedName || '…'}) →`;
    };
    updateBtn();
    nameEl?.addEventListener('input', updateBtn);

    document.getElementById('setup-overlay').classList.remove('hidden');
  }

  sp.addEventListener('animationend', showLogin, { once: true });
  setTimeout(showLogin, 800); // fallback if animationend doesn't fire
}

/* ── Background music (local MP3) ── */
const Music = (() => {
  let audio   = null;
  let playing = false;

  function _initAudio() {
    audio = document.getElementById('bg-audio');
    if (audio) audio.volume = 0.35;
    if (localStorage.getItem('music_on') === 'true') _play();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initAudio);
  } else {
    _initAudio();
  }

  function _play() {
    if (!audio) return;
    audio.play().then(() => {
      playing = true;
      _updateBtn();
      localStorage.setItem('music_on', 'true');
    }).catch(() => {});
  }

  function _pause() {
    if (!audio) return;
    audio.pause();
    playing = false;
    _updateBtn();
    localStorage.setItem('music_on', 'false');
  }

  function _updateBtn() {
    const btn  = document.getElementById('music-btn');
    const icon = document.getElementById('music-icon');
    if (!btn || !icon) return;
    if (playing) { btn.classList.add('playing');    icon.textContent = '🎵'; }
    else         { btn.classList.remove('playing'); icon.textContent = '🔇'; }
  }

  return {
    toggle() { playing ? _pause() : _play(); },
    setVolume(v) { if (audio) audio.volume = v / 100; },
  };
})();
