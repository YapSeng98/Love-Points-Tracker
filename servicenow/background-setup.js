/*
  ============================================================
  恋爱积分簿 — ServiceNow One-Time Setup Script  [LEGACY / v1]
  ============================================================
  DEPRECATED: written before the auth/pairing system existed.
  It uses old field names (u_icon, u_pts, u_min_pts, u_description)
  that no longer match the live schema (u_emoji, u_points, u_desc),
  and it seeds *global* unscoped rows that match-scoped resources
  will never return. Do not run this against the current schema.

  Kept only as historical reference. For current setup, see
  servicenow/README.md — Step 1 (tables) and Step 2 (seeding via
  the in-app ⚙️ 管理 screens after your first couple registers).
  ============================================================
*/

// ── Helper: create a table if it doesn't exist ──
function ensureTable(tableName, label, fields) {
    var gt = new GlideRecord('sys_db_object');
    gt.addQuery('name', tableName);
    gt.query();
    if (gt.next()) {
        gs.info('Table already exists: ' + tableName);
        return;
    }

    var td = new GlideRecord('sys_db_object');
    td.initialize();
    td.setValue('name', tableName);
    td.setValue('label', label);
    td.setValue('super_class', new GlideRecord('sys_db_object').get('name', 'task') ? '' : '');
    td.insert();
    gs.info('Created table: ' + tableName);
}

// ── Helper: insert if not exists ──
function insertIfNotExists(table, matchField, matchValue, data) {
    var gr = new GlideRecord(table);
    gr.addQuery(matchField, matchValue);
    gr.query();
    if (gr.next()) return; // already exists

    gr = new GlideRecord(table);
    gr.initialize();
    for (var k in data) {
        gr.setValue(k, data[k]);
    }
    gr.insert();
}

/* ============================================================
   STEP 1: Create Tables via GlideTableCreator (Studio approach)

   MANUAL ALTERNATIVE (recommended):
   Go to: System Definition → Tables → New

   Table 1: u_love_config
   Fields:
     u_mode             String(20)   "模式"          default: reward
     u_reward_target    Integer      "奖励目标分"     default: 100
     u_punish_threshold Integer      "惩罚阈值分"     default: -80

   Table 2: u_love_category
   Fields:
     u_name    String(100)   "名称"
     u_icon    String(10)    "图标"
     u_pts     Integer       "分数"
     u_active  Boolean       "启用"  default: true

   Table 3: u_love_entry
   Fields:
     u_category    Reference(u_love_category)  "分类"
     u_icon        String(10)                  "图标"
     u_pts         Integer                     "分数"
     u_description String(500)                 "说明"
     u_month       String(7)                   "月份(YYYY-MM)"
     u_date        Date                        "日期"

   Table 4: u_love_reward
   Fields:
     u_name        String(100)  "奖励名称"
     u_icon        String(10)   "图标"
     u_min_pts     Integer      "最低分数"
     u_description String(500)  "说明"

   Table 5: u_love_punishment
   Fields:
     u_name        String(100)  "惩罚名称"
     u_icon        String(10)   "图标"
     u_min_pts     Integer      "最低负分绝对值"
     u_description String(500)  "说明"

   Table 6: u_love_monthly
   Fields:
     u_month       String(7)    "月份(YYYY-MM)"
     u_total_pts   Integer      "总分"
     u_mode        String(20)   "模式"
     u_result_name String(200)  "结果"
     u_settled_at  DateTime     "结算时间"
   ============================================================ */

gs.info('=== 恋爱积分簿 Setup Starting ===');

/* ============================================================
   STEP 2: Insert default Config
   ============================================================ */
(function seedConfig() {
    var gr = new GlideRecord('u_love_config');
    gr.query();
    if (!gr.hasNext()) {
        gr.initialize();
        gr.setValue('u_mode', 'reward');
        gr.setValue('u_reward_target', 100);
        gr.setValue('u_punish_threshold', -80);
        gr.insert();
        gs.info('Config created');
    }
})();

/* ============================================================
   STEP 3: Insert default Categories
   ============================================================ */
var categories = [
    { u_icon: '💑', u_name: '陪伴时光',   u_pts:  10, u_active: true },
    { u_icon: '🎁', u_name: '惊喜礼物',   u_pts:  15, u_active: true },
    { u_icon: '🍳', u_name: '亲自煮饭',   u_pts:   8, u_active: true },
    { u_icon: '🧹', u_name: '做家务',     u_pts:   5, u_active: true },
    { u_icon: '📅', u_name: '记住重要日',  u_pts:  20, u_active: true },
    { u_icon: '🙏', u_name: '主动道歉',   u_pts:  10, u_active: true },
    { u_icon: '💌', u_name: '甜蜜消息',   u_pts:   5, u_active: true },
    { u_icon: '🌹', u_name: '送花浪漫',   u_pts:  12, u_active: true },
    { u_icon: '😤', u_name: '忘记约定',   u_pts: -10, u_active: true },
    { u_icon: '⏰', u_name: '约会迟到',   u_pts:  -5, u_active: true },
    { u_icon: '📱', u_name: '玩手机太久', u_pts:  -5, u_active: true },
    { u_icon: '😡', u_name: '争吵没道歉', u_pts: -15, u_active: true },
    { u_icon: '🍕', u_name: '乱花钱',    u_pts:  -8, u_active: true },
    { u_icon: '🎮', u_name: '打游戏超时', u_pts:  -8, u_active: true },
];

categories.forEach(function(c) {
    insertIfNotExists('u_love_category', 'u_name', c.u_name, c);
});
gs.info('Categories seeded: ' + categories.length);

/* ============================================================
   STEP 4: Insert default Rewards
   ============================================================ */
var rewards = [
    { u_icon: '🍦', u_name: '小零食一份',  u_min_pts:  30, u_description: '任意选一样零食，对方买单' },
    { u_icon: '🎬', u_name: '约会一次',    u_min_pts:  60, u_description: '对方全程安排，不能拒绝' },
    { u_icon: '🛍️', u_name: '想要的礼物',  u_min_pts: 100, u_description: '预算内的任意礼物' },
    { u_icon: '🍽️', u_name: '浪漫晚餐',   u_min_pts: 140, u_description: '高级餐厅二人浪漫晚餐' },
    { u_icon: '✈️', u_name: '二人小旅行',  u_min_pts: 200, u_description: '一起去想去的地方' },
];

rewards.forEach(function(r) {
    insertIfNotExists('u_love_reward', 'u_name', r.u_name, r);
});
gs.info('Rewards seeded: ' + rewards.length);

/* ============================================================
   STEP 5: Insert default Punishments
   ============================================================ */
var punishments = [
    { u_icon: '🧹', u_name: '做一周家务',   u_min_pts:  30, u_description: '一周内所有家务全包' },
    { u_icon: '🎮', u_name: '一周禁游戏',   u_min_pts:  60, u_description: '一周不能玩游戏，要陪伴' },
    { u_icon: '💆', u_name: '七天按摩',     u_min_pts:  80, u_description: '每天至少10分钟肩颈按摩' },
    { u_icon: '🍕', u_name: '供应零食一月', u_min_pts: 120, u_description: '每周采购一次指定零食' },
    { u_icon: '👑', u_name: '对方全权决定', u_min_pts: 160, u_description: '下次约会完全由对方决定' },
];

punishments.forEach(function(p) {
    insertIfNotExists('u_love_punishment', 'u_name', p.u_name, p);
});
gs.info('Punishments seeded: ' + punishments.length);

gs.info('=== 恋爱积分簿 Setup Complete! ===');
gs.info('Next: Set up Scripted REST API (see scripted-rest-api.js)');
gs.info('Then: Enable CORS for your domain');
