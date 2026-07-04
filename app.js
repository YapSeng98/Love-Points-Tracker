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
    shopEditId: null,
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

  function decodeFromSN(str) {
    if (!str) return str;
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
  const _normTier = (x) => ({
    ...x,
    icon:   decodeFromSN(_safeStr(x.icon)),
    name:   _safeStr(x.name),
    minPts: x.minPts != null ? parseInt(x.minPts) : 0,
    desc:   _safeStr(x.desc),
  });

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
        S.startDate = cfg.startDate || '';
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
      return snFetch(`/shop/buy/${id}`, { method: 'POST', body: JSON.stringify({}) });
    },
    async getBag() {
      if (!S.usingSN) return [];
      const items = await snFetch('/bag');
      return items.map(i => ({ ...i, itemIcon: decodeFromSN(i.itemIcon || '') }));
    },
    async useItem(id) {
      return snFetch(`/bag/use/${id}`, { method: 'POST', body: JSON.stringify({}) });
    },
    async getBagHistory() {
      if (!S.usingSN) return [];
      const items = await snFetch('/bag/history');
      return items.map(i => ({ ...i, itemIcon: decodeFromSN(i.itemIcon || '') }));
    },
    async claimReward(rewardId) {
      return snFetch('/bag/claim', { method: 'POST', body: JSON.stringify({ rewardId }) });
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
    const good = mine.filter(e => (parseInt(e.pts) || 0) > 0).length;
    const bad  = mine.filter(e => (parseInt(e.pts) || 0) < 0).length;
    const gEl = document.getElementById('stat-good');
    const bEl = document.getElementById('stat-bad');
    if (gEl) gEl.textContent = `✅ ${good} 次好行为`;
    if (bEl) bEl.textContent = `😣 ${bad} 次扣分`;
  }

  function renderProgress(score) {
    const info = progressInfo(score, S.mode, activeNegPts());
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
        const outcome = getOutcome(-activeNegPts(), 'punishment');
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
        <div class="cat-icon">${c.icon || '📌'}</div>
        <div class="cat-name">${c.name || '分类'}</div>
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
          <div class="entry-cat">${(e.catName && e.catName !== 'undefined') ? e.catName : (e.name && e.name !== 'undefined' ? e.name : '自定义')}</div>
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
    renderTogetherBanner();

    const entries = await Data.getEntries(S.month);
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
    if (!(await showConfirm('确认删除这条记录？'))) return;
    try {
      await Data.deleteEntry(id, S.month);
      showToast('已删除 🗑️');
      await refresh();
    } catch (err) {
      showToast('删除失败: ' + err.message);
    }
  }

  function openSettleModal() {
    const s1 = outcomeScoreFor('char1');
    const s2 = outcomeScoreFor('char2');
    const o1 = getOutcome(s1, S.mode);
    const o2 = getOutcome(s2, S.mode);
    const i1 = progressInfo(S.char1Score, S.mode, S.char1NegPts);
    const i2 = progressInfo(S.char2Score, S.mode, S.char2NegPts);
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
        ${charCard('char1', s1, i1, o1)}
        ${charCard('char2', s2, i2, o2)}
      </div>
      <div style="font-size:12px;color:var(--sub);margin-top:4px">结算后积分清零，开始新月份</div>
    `;
    openModal('modal-settle');
  }

  async function confirmSettle() {
    // Punishment mode records bad-behavior points (shop purchases excluded);
    // reward mode records the net score
    const s1 = outcomeScoreFor('char1');
    const s2 = outcomeScoreFor('char2');
    const o1 = getOutcome(s1, S.mode);
    const o2 = getOutcome(s2, S.mode);

    try {
      const res = await Data.settleMonth(
        S.month, s1, s2, S.mode,
        o1 ? o1.name : '无结果',
        o2 ? o2.name : '无结果'
      );
      closeModal('modal-settle');

      if (res && res.alreadySettled) {
        showToast('✅ 本月已由对方结算，同步中…');
      } else if (S.mode === 'reward' && (o1 || o2))    { spawnConfetti(); showToast('🎊 恭喜！奖励达成！'); }
      else if (S.mode === 'punishment' && (o1 || o2)) { spawnFlash();   showToast('😱 惩罚触发！'); }
      else                                            { showToast('✅ 已结算，新月份开始！'); }

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
          // Claim → bag needs SN; button only when reached and not yet claimed
          let claimHtml = '';
          if (S.usingSN) {
            if (r.claimed) {
              claimHtml = `<div class="tier-claimed">✅ 已领取</div>`;
            } else if (myScore >= r.minPts) {
              claimHtml = `<button class="tier-claim-btn" onclick="App.claimReward('${r.id}')">🎁 领取</button>`;
            }
          }
          return `
          <div class="tier-row ${outcome && outcome.id === r.id ? 'current-tier' : ''}">
            <div class="tier-icon">${r.icon}</div>
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

  async function claimReward(rewardId) {
    const r = S.rewards.find(x => x.id === rewardId);
    if (!r) return;
    if (!(await showConfirm(`领取奖励「${r.icon} ${r.name}」？将放入你的背包 🎒`))) return;
    try {
      await ShopData.claimReward(rewardId);
      spawnConfetti();
      showToast(`🎉 已领取「${r.name}」，快去背包看看！`);
      r.claimed = true;
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
        await snFetch('/auth/charimg', { method: 'PUT', body: JSON.stringify({ charImg: data }) });
        showToast('📷 图片已同步到 SN！');
      } catch (err) {
        showToast('图片同步失败: ' + err.message.slice(0, 60));
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
      try { await snFetch('/auth/charimg', { method: 'PUT', body: JSON.stringify({ charImg: '' }) }); }
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

  function showSettings() {
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
  }

  function closeLovePage() {
    document.getElementById('love-page')?.classList.remove('open');
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
    quickEntry, openAddModal, openEditEntryModal, submitEntry, deleteEntry,
    openSettleModal, confirmSettle,
    nav, showTables, showHistory, showSettings, saveConfig, logout,
    claimReward,
    setCharImg, resetCharImg,
    openManage, openManageFromTable, openEditForm, saveEditForm,
    toggleCategoryActive, confirmDeleteItem,
    openModal, closeModal, resolveConfirm,
    showLovePage, closeLovePage,
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
