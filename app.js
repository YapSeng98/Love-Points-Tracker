/* =============================================================
   恋爱积分簿 — App Logic
   ServiceNow backend (Scripted REST API) + localStorage fallback
   ============================================================= */

const App = (() => {

  /* ── Config ── */
  const SN_API_PATH = '/api/x_887486_love_app/love_score';
  const SN_INSTANCE = 'dev405150.service-now.com';

  /* ── State ── */
  let S = {
    mode: 'reward',
    month: '',
    score: 0,               // active character's score (convenience alias)
    char1Score: 0,
    char2Score: 0,
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
  };

  /* ── Helpers ── */
  const now = () => new Date();
  const monthKey = (d = now()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthLabel = (k) => { const [y,m] = k.split('-'); return `${y} 年 ${parseInt(m)} 月`; };

  function _snUnwrap(json) {
    let data = json.result !== undefined ? json.result : json;
    // Unwrap a second level if old SN scripts double-wrapped with { result: ... }
    if (data !== null && typeof data === 'object' && !Array.isArray(data) && data.result !== undefined) {
      data = data.result;
    }
    return data;
  }

  // SN PDI MySQL uses utf8mb3 (3-byte max) — 4-byte emoji get corrupted on write.
  // Workaround: escape surrogate pairs to \uXXXX\uXXXX ASCII sequences before storing.
  function encodeForSN(str) {
    if (!str) return str;
    return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (m) =>
      `\\u${m.charCodeAt(0).toString(16)}\\u${m.charCodeAt(1).toString(16)}`
    );
  }

  function decodeFromSN(str) {
    if (!str || !str.includes('\\u')) return str;
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
  const Data = {
    async init() {
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
        if (cfg.char1Name) { S.charName1 = cfg.char1Name; localStorage.setItem('sn_charname1', cfg.char1Name); }
        if (cfg.char2Name) { S.charName2 = cfg.char2Name; localStorage.setItem('sn_charname2', cfg.char2Name); }
        const decodeIcons = (arr) => arr.map(x => ({ ...x, icon: decodeFromSN(x.icon) }));
        S.categories  = decodeIcons(await snFetch('/categories'));
        S.rewards     = decodeIcons(await snFetch('/rewards'));
        S.punishments = decodeIcons(await snFetch('/punishments'));
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
      }
    },

    async getEntries(month) {
      if (S.usingSN) {
        const entries = await snFetch(`/entries?month=${month}`);
        return entries.map(e => ({ ...e, icon: decodeFromSN(e.icon) }));
      }
      const d = LS.load();
      return (d.entries[month] || []).sort((a,b) => new Date(b.date)-new Date(a.date));
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

    async deleteEntry(id, month) {
      if (S.usingSN) return snFetch(`/entries/${id}`, { method:'DELETE' });
      const d = LS.load();
      if (d.entries[month]) d.entries[month] = d.entries[month].filter(e => e.id !== id);
      LS.save(d);
    },

    async updateEntry(id, month, data) {
      if (S.usingSN) {
        const encoded = data.icon ? { ...data, icon: encodeForSN(data.icon) } : data;
        return snFetch(`/entries/${id}`, { method:'PUT', body: JSON.stringify(encoded) });
      }
      const d = LS.load();
      if (d.entries[month]) {
        const idx = d.entries[month].findIndex(e => e.id === id);
        if (idx >= 0) d.entries[month][idx] = { ...d.entries[month][idx], ...data };
      }
      LS.save(d);
    },

    async getHistory() {
      if (S.usingSN) return snFetch('/history');
      return LS.load().history || [];
    },

    async settleMonth(month, char1Pts, char2Pts, mode, result1, result2) {
      if (S.usingSN) return snFetch('/monthly/settle', {
        method: 'POST',
        body: JSON.stringify({ month, char1Pts, char2Pts, mode, result1, result2 }),
      });
      const d = LS.load();
      d.history = d.history || [];
      d.history.unshift({ month, char1Pts, char2Pts, mode, result1, result2, settledAt: new Date().toISOString() });
      d.entries[month] = [];
      LS.save(d);
    },

    async saveConfig(cfg) {
      if (S.usingSN) return snFetch('/config', { method:'PUT', body: JSON.stringify(cfg) });
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
        return { ...data, icon: decodeFromSN(data.icon), id: r.id };
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

  /* ── Score calc helpers ── */
  function calcScore(entries) {
    return entries.reduce((sum, e) => sum + (parseInt(e.pts) || 0), 0);
  }

  function calcCharScores(entries) {
    let c1 = 0, c2 = 0;
    entries.forEach(e => {
      const pts = parseInt(e.pts) || 0;
      if (!e.charId || e.charId === 'char1') c1 += pts;
      else c2 += pts;
    });
    return { char1: c1, char2: c2 };
  }

  function activeScore() {
    return S.activeChar === 'char1' ? S.char1Score : S.char2Score;
  }

  function charDisplayName(charId) {
    return charId === 'char1' ? (S.charName1 || 'CS') : (S.charName2 || 'YY');
  }

  function progressInfo(score, mode) {
    if (mode === 'reward') {
      const target = S.rewardTarget;
      const pct    = Math.min(100, Math.max(0, Math.round((score / target) * 100)));
      const gap    = Math.max(0, target - score);
      return { pct, gap, reached: score >= target, label: `奖励目标 ${target} 分`, type: 'reward' };
    } else {
      const threshold = Math.abs(S.punishThreshold);
      const neg = Math.max(0, -score);
      const pct = Math.min(100, Math.round((neg / threshold) * 100));
      const gap = Math.max(0, threshold - neg);
      return { pct, gap, reached: score <= S.punishThreshold, label: `惩罚阈值 ${S.punishThreshold} 分`, type: 'punishment' };
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

  function renderProgress(score) {
    const info = progressInfo(score, S.mode);
    const fill = document.getElementById('progress-fill');
    fill.style.width = info.pct + '%';
    fill.className = 'progress-bar-fill ' + info.type;
    document.getElementById('progress-pct').textContent = info.pct + '%';
    document.getElementById('progress-left-label').textContent = score + ' 分';
    document.getElementById('progress-right-label').textContent = info.label;

    const statusEl = document.getElementById('status-text');
    const gapEl    = document.getElementById('status-gap');

    if (info.reached) {
      if (info.type === 'reward') {
        const outcome = getOutcome(score, 'reward');
        statusEl.innerHTML = `🎉 已达成奖励！ <span class="status-badge badge-reward">${outcome ? outcome.name : '奖励'}</span>`;
      } else {
        const outcome = getOutcome(score, 'punishment');
        statusEl.innerHTML = `⚠️ 达到惩罚阈值！ <span class="status-badge badge-danger">${outcome ? outcome.name : '惩罚'}</span>`;
      }
    } else {
      if (info.type === 'reward') {
        statusEl.innerHTML = `再加 <span id="status-gap">${info.gap}</span> 分 → 下一个奖励 🏆`;
      } else {
        if (score >= 0) {
          statusEl.innerHTML = `😊 安全！表现很棒，继续保持 <span class="status-badge badge-safe">+${score}</span>`;
        } else {
          statusEl.innerHTML = `⚠️ 再扣 <span id="status-gap">${info.gap}</span> 分将触发惩罚`;
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
    grid.innerHTML = cats.map(c => {
      const pos = c.pts >= 0;
      return `<div class="cat-card ${pos?'positive':'negative'}" onclick="App.quickEntry('${c.id}')">
        <div class="cat-icon">${c.icon}</div>
        <div class="cat-name">${c.name}</div>
        <div class="cat-pts ${pos?'positive':'negative'}">${pos?'+':''}${c.pts} 分</div>
      </div>`;
    }).join('');
  }

  function renderEntries(entries) {
    const list = document.getElementById('entries-list');
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div>本月还没有记录<br>点上方角色选择记分对象</div>`;
      return;
    }
    list.innerHTML = entries.map(e => {
      const pos    = e.pts >= 0;
      const charId = e.charId || 'char1';
      const name   = charDisplayName(charId);
      return `<div class="entry-item" id="entry-${e.id}">
        <div class="entry-icon">${e.icon || '📌'}</div>
        <div class="entry-info">
          <div class="entry-cat">${e.catName || e.name || '自定义'}</div>
          <div class="entry-desc">${e.desc || ''}</div>
          <div class="entry-date">${e.date || ''}</div>
        </div>
        <span class="entry-char-badge ${charId}">${name}</span>
        <div class="entry-pts ${pos?'positive':'negative'}">${pos?'+':''}${e.pts}</div>
        <div class="entry-edit" onclick="App.openEditEntryModal('${e.id}')">✏️</div>
        <div class="entry-delete" onclick="App.deleteEntry('${e.id}')">🗑️</div>
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

    const entries = await Data.getEntries(S.month);
    S.entries = entries;
    const { char1, char2 } = calcCharScores(entries);
    S.char1Score = char1;
    S.char2Score = char2;
    S.score = activeScore();

    renderCharSelector();
    renderScore(S.score);
    const info = progressInfo(S.score, S.mode);
    renderProgress(S.score);
    renderCharacterMood(info.pct);
    renderEntries(entries);
    renderCategories();
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
    renderCharacterMood(progressInfo(S.score, S.mode).pct);
  }

  async function toggleMode() {
    S.mode = S.mode === 'reward' ? 'punishment' : 'reward';
    await Data.saveConfig({ mode: S.mode });
    renderMode();
    S.score = activeScore();
    renderProgress(S.score);
    renderCharacterMood(progressInfo(S.score, S.mode).pct);
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
      date: new Date().toISOString().split('T')[0],
    };

    try {
      await Data.addEntry(entry);
      showToast(`${cat.icon} ${cat.name} ${cat.pts >= 0 ? '+' : ''}${cat.pts} 分！`);
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
    document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('add-desc').value = '';
    const sel = document.getElementById('add-cat-select');
    sel.innerHTML = S.categories.filter(c=>c.active!==false).map(c =>
      `<option value="${c.id}" data-pts="${c.pts}">${c.icon} ${c.name} (${c.pts>=0?'+':''}${c.pts})</option>`
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
    document.getElementById('add-date').value = entry.date || new Date().toISOString().split('T')[0];
    document.getElementById('add-pts').value = entry.pts || 0;
    document.getElementById('add-desc').value = entry.desc || '';
    const sel = document.getElementById('add-cat-select');
    sel.innerHTML = S.categories.filter(c=>c.active!==false).map(c =>
      `<option value="${c.id}" data-pts="${c.pts}" ${c.id === entry.catId ? 'selected' : ''}>${c.icon} ${c.name} (${c.pts>=0?'+':''}${c.pts})</option>`
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
    const date   = document.getElementById('add-date').value || new Date().toISOString().split('T')[0];
    const cat    = S.categories.find(c => c.id === catId) || {};

    try {
      if (editId) {
        const existing = S.entries.find(e => e.id === editId);
        await Data.updateEntry(editId, S.month, {
          catId, catName: cat.name || existing?.catName || '自定义',
          icon: cat.icon || existing?.icon || '📌',
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
    if (!confirm('确认删除这条记录？')) return;
    try {
      await Data.deleteEntry(id, S.month);
      showToast('已删除 🗑️');
      await refresh();
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  function openSettleModal() {
    const o1 = getOutcome(S.char1Score, S.mode);
    const o2 = getOutcome(S.char2Score, S.mode);
    const i1 = progressInfo(S.char1Score, S.mode);
    const i2 = progressInfo(S.char2Score, S.mode);
    const prev = document.getElementById('settle-preview');

    const fmtScore = s => (s > 0 ? '+' : '') + s;

    const charCard = (charId, score, info, outcome) => {
      const name   = charDisplayName(charId);
      const result = outcome
        ? (S.mode === 'reward' ? `🎊 ${outcome.icon} ${outcome.name}` : `⚠️ ${outcome.icon} ${outcome.name}`)
        : '😐 无结果';
      return `<div class="settle-char-card ${charId}">
        <div class="sc-name">${name}</div>
        <div class="sc-score">${fmtScore(score)}</div>
        <div class="sc-pct">${info.pct}% 完成</div>
        <div class="sc-result">${result}</div>
      </div>`;
    };

    const anyReward = S.mode === 'reward' && (o1 || o2);
    const anyPunish = S.mode === 'punishment' && (o1 || o2);

    prev.innerHTML = `
      <div class="sp-icon">${anyReward ? '🎊' : anyPunish ? '😱' : '📊'}</div>
      <div class="sp-title">${monthLabel(S.month)} 结算</div>
      <div class="settle-char-row">
        ${charCard('char1', S.char1Score, i1, o1)}
        ${charCard('char2', S.char2Score, i2, o2)}
      </div>
      <div style="font-size:12px;color:var(--sub);margin-top:4px">结算后积分清零，开始新月份</div>
    `;
    openModal('modal-settle');
  }

  async function confirmSettle() {
    const o1 = getOutcome(S.char1Score, S.mode);
    const o2 = getOutcome(S.char2Score, S.mode);

    try {
      await Data.settleMonth(
        S.month, S.char1Score, S.char2Score, S.mode,
        o1 ? o1.name : '无结果',
        o2 ? o2.name : '无结果'
      );
      closeModal('modal-settle');

      if (S.mode === 'reward' && (o1 || o2))        { spawnConfetti(); showToast('🎊 恭喜！奖励达成！'); }
      else if (S.mode === 'punishment' && (o1 || o2)) { spawnFlash();   showToast('😱 惩罚触发！'); }
      else                                            { showToast('✅ 已结算，新月份开始！'); }

      S.month = monthKey();
      await refresh();
    } catch (err) {
      showToast('结算失败: ' + err.message);
    }
  }

  async function nav(page) {
    ['home','tables','history','settings'].forEach(p => {
      document.getElementById('nav-'+p)?.classList.remove('active');
    });
    document.getElementById('nav-'+page)?.classList.add('active');

    if (page === 'tables') {
      await showTables();
    } else if (page === 'history') {
      await showHistory();
    } else if (page === 'settings') {
      showSettings();
    }
  }

  async function showTables() {
    const content = document.getElementById('modal-tables-content');
    const title   = document.getElementById('modal-tables-title');

    const outcome = getOutcome(S.score, S.mode);

    if (S.mode === 'reward') {
      title.textContent = '🏆 奖励表';
      const sorted = [...S.rewards].sort((a,b) => a.minPts - b.minPts);
      content.innerHTML = `<div class="tier-table">${
        sorted.map(r => `
          <div class="tier-row ${outcome && outcome.id === r.id ? 'current-tier' : ''}">
            <div class="tier-icon">${r.icon}</div>
            <div class="tier-info">
              <div class="tier-name">${r.name}</div>
              <div class="tier-desc">${r.desc}</div>
            </div>
            <div class="tier-pts-label tier-pts-reward">≥ ${r.minPts} 分</div>
          </div>`).join('')
      }</div>`;
    } else {
      title.textContent = '😈 惩罚表';
      const sorted = [...S.punishments].sort((a,b) => a.minPts - b.minPts);
      content.innerHTML = `<div class="tier-table">${
        sorted.map(p => `
          <div class="tier-row ${outcome && outcome.id === p.id ? 'current-tier' : ''}">
            <div class="tier-icon">${p.icon}</div>
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

  function setCharImg(n, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (n === 1) S.charImg1 = e.target.result;
      else         S.charImg2 = e.target.result;
      await Data.saveConfig({ charImg1: S.charImg1, charImg2: S.charImg2 });
      renderCharacters();
      _refreshSettingsPreview();
      showToast(`📷 图片已更新！`);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async function resetCharImg(n) {
    if (n === 1) S.charImg1 = '';
    else         S.charImg2 = '';
    await Data.saveConfig({ charImg1: S.charImg1, charImg2: S.charImg2 });
    renderCharacters();
    _refreshSettingsPreview();
    showToast(`已重置为默认图片`);
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

  function showSettings() {
    document.getElementById('cfg-reward-target').value    = S.rewardTarget;
    document.getElementById('cfg-punish-threshold').value = S.punishThreshold;
    document.getElementById('cfg-name1').value = S.charName1 || 'Pochacco';
    document.getElementById('cfg-name2').value = S.charName2 || '阿呆';
    _refreshSettingsPreview();
    openModal('modal-settings');
  }

  async function saveConfig() {
    const rewardTarget    = parseInt(document.getElementById('cfg-reward-target').value)    || 100;
    const punishThreshold = parseInt(document.getElementById('cfg-punish-threshold').value) || -80;
    const charName1 = document.getElementById('cfg-name1').value.trim() || 'Pochacco';
    const charName2 = document.getElementById('cfg-name2').value.trim() || '阿呆';
    S.rewardTarget    = rewardTarget;
    S.punishThreshold = punishThreshold;
    S.charName1       = charName1;
    S.charName2       = charName2;
    await Data.saveConfig({ mode: S.mode, rewardTarget, punishThreshold, charName1, charName2, charImg1: S.charImg1, charImg2: S.charImg2 });
    closeModal('modal-settings');
    await refresh();
    showToast('设置已保存 ✅');
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
    const info = progressInfo(S.score, S.mode);
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
          <div class="manage-name">${item.name}</div>
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
        if (idx >= 0) arr[idx] = { ...arr[idx], ...data, icon: decodeFromSN(data.icon) };
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
    if (!confirm(`确认删除「${item.name}」？\n${S.usingSN ? '将从 ServiceNow 删除' : '将从本地删除'}`)) return;
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

  /* ── Boot ── */
  async function boot() {
    const savedKey = localStorage.getItem('sn_api_key');

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

  document.addEventListener('DOMContentLoaded', boot);

  /* Close modals on overlay click (already set in openModal) */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  return {
    connect, register, switchTab, onRegCharChange, demoMode,
    toggleMode, selectChar,
    quickEntry, openAddModal, openEditEntryModal, submitEntry, deleteEntry,
    openSettleModal, confirmSettle,
    nav, showTables, showHistory, showSettings, saveConfig, logout,
    setCharImg, resetCharImg,
    openManage, openManageFromTable, openEditForm, saveEditForm,
    toggleCategoryActive, confirmDeleteItem,
    openModal, closeModal,
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
    if (savedName) {
      const nameEl = document.getElementById('sn-username');
      if (nameEl) nameEl.value = savedName;
      const btn = document.getElementById('sn-connect-btn');
      if (btn) btn.textContent = `继续 (${savedName}) →`;
    }

    document.getElementById('setup-overlay').classList.remove('hidden');
  }

  sp.addEventListener('animationend', showLogin, { once: true });
  setTimeout(showLogin, 800); // fallback if animationend doesn't fire
}

/* ── Background music (local MP3) ── */
const Music = (() => {
  let audio   = null;
  let playing = false;

  document.addEventListener('DOMContentLoaded', () => {
    audio = document.getElementById('bg-audio');
    audio.volume = 0.35;
    if (localStorage.getItem('music_on') === 'true') _play();
  });

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
