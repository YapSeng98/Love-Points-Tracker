/*
  ============================================================
  恋爱积分簿 — ServiceNow Scripted REST API
  Application: Global scope
  API Name: love_score
  Base Path: /api/x_887486_love_app/love_score
  ============================================================

  AUTH MODEL (custom token — NO SN native accounts needed):
  ─────────────────────────────────────────────────────────
  • POST /auth/register  (Resource 21) — public, no SN auth
  • POST /auth/login     (Resource 22) — public, no SN auth
  • All other resources  (1–20)        — Bearer token auth (validated in script)

  HOW IT WORKS:
  1. User registers → SN creates u_love_auth row, generates api_key (UUID)
     - char1 (他): also creates u_love_match row with pair_code
     - char2 (她): joins existing match via pair_code
  2. Login → validates username + password → returns api_key + matchId
  3. All subsequent calls → Authorization: Bearer <api_key>
     → each resource script looks up u_love_auth by api_key
     → derives matchId from u_love_auth.u_match

  SN SETUP REQUIRED (one-time):
  ─────────────────────────────
  A. Scripted REST API resources:
     → Resources 1–20: set "Requires Authentication" = FALSE
     → Resources 21–22: set "Requires Authentication" = FALSE (they are already public)

  B. New fields to add in SN tables:
     u_love_auth  → u_password  (String, 100)
     u_love_auth  → u_api_key   (String, 100, mark as Unique)
     u_love_match → u_pair_code (String, 10)

  C. CORS:
     System Properties → glide.rest.cors.allowed_origins
     Add: https://yapseng98.github.io

  CONFIRMED COLUMN MAPPING:
  u_love_category  : sys_id→id | u_emoji→icon | u_name→name | u_points→pts | u_active→active
  u_love_entry     : sys_id→id | u_char→charId | u_icon→icon | u_points→pts | u_note→desc
                     u_month→month | u_date→date | u_category→catId | u_category_name→catName
  u_love_reward    : sys_id→id | u_emoji→icon | u_name→name | u_points→minPts | u_desc→desc
  u_love_punishment: sys_id→id | u_emoji→icon | u_name→name | u_points→minPts | u_desc→desc
  u_love_monthly   : u_month→month | u_char1_pts→char1Pts | u_char2_pts→char2Pts
                     u_result_1→result1 | u_result_2→result2 | u_mode→mode | u_settled_at→settledAt
  u_love_config    : u_mode→mode | u_reward_target→rewardTarget | u_punish_threshold→punishThreshold
  u_love_auth      : u_username→username | u_password→password | u_api_key→apiKey
                     u_char_id→charId | u_match→matchId | u_last_login→lastLogin
  u_love_match     : sys_id=matchId | u_pair_code→pairCode
  ============================================================
*/


/* ═══════════════════════════════════════════════════════════
   INLINE AUTH HELPER (copy this block into resources 1–20)
   ═══════════════════════════════════════════════════════════
   var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
   var _au = new GlideRecord('x_887486_love_app_u_love_auth');
   _au.addQuery('u_api_key', _tok);
   _au.query();
   if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
   var matchId = _au.getValue('u_match') || '';
   ═══════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────
   RESOURCE 1: GET /config
   HTTP Method: GET  |  Path: /config
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('u_love_config');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.query();
    if (gr.next()) {
        response.setBody({ result: {
            mode:            gr.getValue('u_mode') || 'reward',
            rewardTarget:    parseInt(gr.getValue('u_reward_target'))   || 100,
            punishThreshold: parseInt(gr.getValue('u_punish_threshold')) || -80,
        }});
    } else {
        response.setBody({ result: { mode: 'reward', rewardTarget: 100, punishThreshold: -80 } });
    }
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 2: PUT /config
   HTTP Method: PUT  |  Path: /config
   Requires Authentication: FALSE
   Body: { mode, rewardTarget, punishThreshold }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('u_love_config');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.query();
    if (!gr.next()) { gr.initialize(); if (matchId) gr.setValue('u_match', matchId); }

    if (body.mode            !== undefined) gr.setValue('u_mode',             body.mode);
    if (body.rewardTarget    !== undefined) gr.setValue('u_reward_target',    body.rewardTarget);
    if (body.punishThreshold !== undefined) gr.setValue('u_punish_threshold', body.punishThreshold);
    gr.save();
    response.setBody({ result: { success: true } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 3: GET /categories
   HTTP Method: GET  |  Path: /categories
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('u_love_category');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_name');
    gr.query();
    var cats = [];
    while (gr.next()) {
        cats.push({
            id:     gr.getValue('sys_id'),
            icon:   gr.getValue('u_emoji'),
            name:   gr.getValue('u_name'),
            pts:    parseInt(gr.getValue('u_points')),
            active: gr.getValue('u_active') === '1' || gr.getValue('u_active') === true,
        });
    }
    response.setBody({ result: cats });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 4: GET /entries
   HTTP Method: GET  |  Path: /entries
   Requires Authentication: FALSE
   Query param: month (YYYY-MM, defaults to current month)
   Returns only unsettled entries (u_monthly IS EMPTY)
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var month = request.queryParams.month;
    if (!month) {
        var d = new GlideDateTime();
        month = d.getLocalDate().substring(0, 7);
    }

    var gr = new GlideRecord('u_love_entry');
    gr.addQuery('u_month', month);
    if (matchId) gr.addQuery('u_match', matchId);
    gr.addNullQuery('u_monthly');
    gr.orderByDesc('u_date');
    gr.query();

    var entries = [];
    while (gr.next()) {
        entries.push({
            id:      gr.getValue('sys_id'),
            catId:   gr.getValue('u_category'),
            catName: gr.getValue('u_category_name'),
            icon:    gr.getValue('u_icon'),
            pts:     parseInt(gr.getValue('u_points')),
            desc:    gr.getValue('u_note'),
            charId:  gr.getValue('u_char') || 'char1',
            month:   gr.getValue('u_month'),
            date:    gr.getValue('u_date'),
        });
    }
    response.setBody({ result: entries });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 5: POST /entries
   HTTP Method: POST  |  Path: /entries
   Requires Authentication: FALSE
   Body: { charId, catId, catName, icon, pts, desc, month, date }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('u_love_entry');
    gr.initialize();
    gr.setValue('u_char',          body.charId   || 'char1');
    gr.setValue('u_category',      body.catId    || '');
    gr.setValue('u_category_name', body.catName  || '');
    gr.setValue('u_category_pts',  parseInt(body.pts) || 0);
    gr.setValue('u_icon',          body.icon     || '📌');
    gr.setValue('u_points',        parseInt(body.pts) || 0);
    gr.setValue('u_note',          body.desc     || '');
    gr.setValue('u_month',         body.month    || '');
    gr.setValue('u_date',          body.date     || new GlideDateTime().getLocalDate());
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();

    response.setBody({ result: { id: sysId, success: true } });
    response.setStatus(201);
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 6: PUT /entries/{id}
   HTTP Method: PUT  |  Path: /entries/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('u_love_entry');
    if (!gr.get(id)) {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
        return;
    }
    if (body.catId   !== undefined) gr.setValue('u_category',      body.catId);
    if (body.catName !== undefined) gr.setValue('u_category_name', body.catName);
    if (body.icon    !== undefined) gr.setValue('u_icon',          body.icon);
    if (body.pts     !== undefined) gr.setValue('u_points',        parseInt(body.pts));
    if (body.desc    !== undefined) gr.setValue('u_note',          body.desc);
    if (body.date    !== undefined) gr.setValue('u_date',          body.date);
    if (body.charId  !== undefined) gr.setValue('u_char',          body.charId);
    gr.update();
    response.setBody({ result: { success: true } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 7: DELETE /entries/{id}
   HTTP Method: DELETE  |  Path: /entries/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id = request.pathParams.id;
    var gr = new GlideRecord('u_love_entry');
    if (gr.get(id)) {
        gr.deleteRecord();
        response.setBody({ result: { success: true } });
    } else {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
    }
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 8: GET /rewards
   HTTP Method: GET  |  Path: /rewards
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('u_love_reward');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_points');
    gr.query();
    var list = [];
    while (gr.next()) {
        list.push({
            id:     gr.getValue('sys_id'),
            icon:   gr.getValue('u_emoji'),
            name:   gr.getValue('u_name'),
            minPts: parseInt(gr.getValue('u_points')),
            desc:   gr.getValue('u_desc'),
        });
    }
    response.setBody({ result: list });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 9: GET /punishments
   HTTP Method: GET  |  Path: /punishments
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('u_love_punishment');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_points');
    gr.query();
    var list = [];
    while (gr.next()) {
        list.push({
            id:     gr.getValue('sys_id'),
            icon:   gr.getValue('u_emoji'),
            name:   gr.getValue('u_name'),
            minPts: parseInt(gr.getValue('u_points')),
            desc:   gr.getValue('u_desc'),
        });
    }
    response.setBody({ result: list });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 10: GET /history
   HTTP Method: GET  |  Path: /history
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('u_love_monthly');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderByDesc('u_month');
    gr.setLimit(24);
    gr.query();
    var list = [];
    while (gr.next()) {
        list.push({
            month:     gr.getValue('u_month'),
            char1Pts:  parseInt(gr.getValue('u_char1_pts') || 0),
            char2Pts:  parseInt(gr.getValue('u_char2_pts') || 0),
            mode:      gr.getValue('u_mode'),
            result1:   gr.getValue('u_result_1'),
            result2:   gr.getValue('u_result_2'),
            settledAt: gr.getValue('u_settled_at'),
        });
    }
    response.setBody({ result: list });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 11: POST /monthly/settle
   HTTP Method: POST  |  Path: /monthly/settle
   Requires Authentication: FALSE
   Body: { month, char1Pts, char2Pts, mode, result1, result2 }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;

    var gr = new GlideRecord('u_love_monthly');
    gr.initialize();
    gr.setValue('u_month',      body.month              || '');
    gr.setValue('u_char1_pts',  parseInt(body.char1Pts) || 0);
    gr.setValue('u_char2_pts',  parseInt(body.char2Pts) || 0);
    gr.setValue('u_mode',       body.mode               || 'reward');
    gr.setValue('u_result_1',   body.result1            || '');
    gr.setValue('u_result_2',   body.result2            || '');
    gr.setValue('u_settled_at', new GlideDateTime().toString());
    if (matchId) gr.setValue('u_match', matchId);
    var monthSysId = gr.insert();

    var entryGr = new GlideRecord('u_love_entry');
    entryGr.addQuery('u_month', body.month);
    if (matchId) entryGr.addQuery('u_match', matchId);
    entryGr.addNullQuery('u_monthly');
    entryGr.query();
    while (entryGr.next()) {
        entryGr.setValue('u_monthly', monthSysId);
        entryGr.update();
    }

    response.setBody({ result: { success: true, monthId: monthSysId } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 12: POST /categories
   HTTP Method: POST  |  Path: /categories
   Requires Authentication: FALSE
   Body: { icon, name, pts, active }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('u_love_category');
    gr.initialize();
    gr.setValue('u_emoji',  body.icon   || '📌');
    gr.setValue('u_name',   body.name   || '');
    gr.setValue('u_points', parseInt(body.pts) || 0);
    gr.setValue('u_active', body.active !== false);
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();
    response.setBody({ result: { id: sysId, success: true } });
    response.setStatus(201);
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 13: PUT /categories/{id}
   HTTP Method: PUT  |  Path: /categories/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('u_love_category');
    if (!gr.get(id)) {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
        return;
    }
    if (body.icon   !== undefined) gr.setValue('u_emoji',  body.icon);
    if (body.name   !== undefined) gr.setValue('u_name',   body.name);
    if (body.pts    !== undefined) gr.setValue('u_points', parseInt(body.pts));
    if (body.active !== undefined) gr.setValue('u_active', body.active);
    gr.update();
    response.setBody({ result: { success: true } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 14: DELETE /categories/{id}
   HTTP Method: DELETE  |  Path: /categories/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id = request.pathParams.id;
    var gr = new GlideRecord('u_love_category');
    if (gr.get(id)) {
        gr.deleteRecord();
        response.setBody({ result: { success: true } });
    } else {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
    }
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 15: POST /rewards
   HTTP Method: POST  |  Path: /rewards
   Requires Authentication: FALSE
   Body: { icon, name, minPts, desc }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('u_love_reward');
    gr.initialize();
    gr.setValue('u_emoji',  body.icon    || '🎁');
    gr.setValue('u_name',   body.name    || '');
    gr.setValue('u_points', parseInt(body.minPts) || 0);
    gr.setValue('u_desc',   body.desc    || '');
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();
    response.setBody({ result: { id: sysId, success: true } });
    response.setStatus(201);
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 16: PUT /rewards/{id}
   HTTP Method: PUT  |  Path: /rewards/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('u_love_reward');
    if (!gr.get(id)) {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
        return;
    }
    if (body.icon   !== undefined) gr.setValue('u_emoji',  body.icon);
    if (body.name   !== undefined) gr.setValue('u_name',   body.name);
    if (body.minPts !== undefined) gr.setValue('u_points', parseInt(body.minPts));
    if (body.desc   !== undefined) gr.setValue('u_desc',   body.desc);
    gr.update();
    response.setBody({ result: { success: true } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 17: DELETE /rewards/{id}
   HTTP Method: DELETE  |  Path: /rewards/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id = request.pathParams.id;
    var gr = new GlideRecord('u_love_reward');
    if (gr.get(id)) {
        gr.deleteRecord();
        response.setBody({ result: { success: true } });
    } else {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
    }
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 18: POST /punishments
   HTTP Method: POST  |  Path: /punishments
   Requires Authentication: FALSE
   Body: { icon, name, minPts, desc }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('u_love_punishment');
    gr.initialize();
    gr.setValue('u_emoji',  body.icon    || '😈');
    gr.setValue('u_name',   body.name    || '');
    gr.setValue('u_points', parseInt(body.minPts) || 0);
    gr.setValue('u_desc',   body.desc    || '');
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();
    response.setBody({ result: { id: sysId, success: true } });
    response.setStatus(201);
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 19: PUT /punishments/{id}
   HTTP Method: PUT  |  Path: /punishments/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('u_love_punishment');
    if (!gr.get(id)) {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
        return;
    }
    if (body.icon   !== undefined) gr.setValue('u_emoji',  body.icon);
    if (body.name   !== undefined) gr.setValue('u_name',   body.name);
    if (body.minPts !== undefined) gr.setValue('u_points', parseInt(body.minPts));
    if (body.desc   !== undefined) gr.setValue('u_desc',   body.desc);
    gr.update();
    response.setBody({ result: { success: true } });
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 20: DELETE /punishments/{id}
   HTTP Method: DELETE  |  Path: /punishments/{id}
   Requires Authentication: FALSE
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({result:{error:'Unauthorized'}}); return; }

    var id = request.pathParams.id;
    var gr = new GlideRecord('u_love_punishment');
    if (gr.get(id)) {
        gr.deleteRecord();
        response.setBody({ result: { success: true } });
    } else {
        response.setStatus(404);
        response.setBody({ result: { error: 'Not found' } });
    }
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 21: POST /auth/register
   HTTP Method: POST  |  Path: /auth/register
   Requires Authentication: FALSE  ← must be unchecked in SN
   ─────────────────────────────────────────────────────────
   Body: { username, password, charId, pairCode }
     - charId = 'char1' (他) → creates new u_love_match + generates pair_code
     - charId = 'char2' (她) → joins existing u_love_match via pairCode

   Response:
     { username, charId, matchId, pairCode, apiKey }
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var body     = request.body && request.body.data;
    var username = body ? (body.username || '').toString().trim() : '';
    var password = body ? (body.password || '').toString()        : '';
    var charId   = body ? (body.charId   || 'char1').toString()   : 'char1';
    var pairCode = body ? (body.pairCode || '').toString().trim() : '';

    if (!username || !password) {
        response.setStatus(400);
        response.setBody({ result: { error: '账号和密码不能为空' } });
        return;
    }

    // Check if username already taken
    var existing = new GlideRecord('x_887486_love_app_u_love_auth');
    existing.addQuery('u_username', username);
    existing.query();
    if (existing.next()) {
        response.setStatus(409);
        response.setBody({ result: { error: '账号已存在，请直接登录' } });
        return;
    }

    // Generate a random api_key (UUID-style)
    var apiKey = gs.generateGUID();
    var matchId = '';
    var returnPairCode = '';
    var matchGr = new GlideRecord('u_love_match');

    if (charId === 'char1') {
        // Create a new match row with a 6-digit pair code
        returnPairCode = String(Math.floor(100000 + Math.random() * 900000));
        matchGr.initialize();
        matchGr.setValue('u_pair_code', returnPairCode);
        matchId = matchGr.insert();
    } else {
        // char2: find the match by pair code
        if (!pairCode) {
            response.setStatus(400);
            response.setBody({ result: { error: '请输入伴侣的配对码' } });
            return;
        }
        matchGr.addQuery('u_pair_code', pairCode);
        matchGr.query();
        if (!matchGr.next()) {
            response.setStatus(404);
            response.setBody({ result: { error: '配对码无效，请重新确认' } });
            return;
        }
        matchId = matchGr.getUniqueValue();
    }

    // Create u_love_auth record
    var authGr = new GlideRecord('x_887486_love_app_u_love_auth');
    authGr.initialize();
    authGr.setValue('u_username',   username);
    authGr.setValue('u_password',   password);
    authGr.setValue('u_api_key',    apiKey);
    authGr.setValue('u_char_id',    charId);
    authGr.setValue('u_last_login', new GlideDateTime());
    if (matchId) authGr.setValue('u_match', matchId);
    authGr.insert();

    // Also create a default config row for this match (if not already)
    if (matchId && charId === 'char1') {
        var cfgGr = new GlideRecord('u_love_config');
        cfgGr.addQuery('u_match', matchId);
        cfgGr.query();
        if (!cfgGr.next()) {
            cfgGr.initialize();
            cfgGr.setValue('u_mode',             'reward');
            cfgGr.setValue('u_reward_target',    100);
            cfgGr.setValue('u_punish_threshold', -80);
            cfgGr.setValue('u_match',            matchId);
            cfgGr.insert();
        }
    }

    response.setStatus(201);
    response.setBody({ result: {
        success:   true,
        username:  username,
        charId:    charId,
        matchId:   matchId,
        pairCode:  returnPairCode,
        apiKey:    apiKey,
    }});
})(request, response);


/* ─────────────────────────────────────────────────────────
   RESOURCE 22: POST /auth/login
   HTTP Method: POST  |  Path: /auth/login
   Requires Authentication: FALSE  ← must be unchecked in SN
   ─────────────────────────────────────────────────────────
   Body: { username, password }

   Response:
     200 { username, charId, matchId, pairCode, apiKey }
     401 wrong password
     404 account not found
   ───────────────────────────────────────────────────────── */
(function process(request, response) {
    var body     = request.body && request.body.data;
    var username = body ? (body.username || '').toString().trim() : '';
    var password = body ? (body.password || '').toString()        : '';

    if (!username || !password) {
        response.setStatus(400);
        response.setBody({ result: { error: '账号和密码不能为空' } });
        return;
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_auth');
    gr.addQuery('u_username', username);
    gr.query();

    if (!gr.next()) {
        response.setStatus(404);
        response.setBody({ result: { error: '账号不存在，请先注册' } });
        return;
    }

    if (gr.getValue('u_password') !== password) {
        response.setStatus(401);
        response.setBody({ result: { error: '密码错误' } });
        return;
    }

    // Refresh api_key on each login (optional but good practice)
    var apiKey = gr.getValue('u_api_key') || gs.generateGUID();
    gr.setValue('u_api_key',    apiKey);
    gr.setValue('u_last_login', new GlideDateTime());
    gr.update();

    var matchId = gr.getValue('u_match') || '';

    // Fetch pair_code from u_love_match so char1 can reshare it if needed
    var pairCode = '';
    if (matchId) {
        var mGr = new GlideRecord('u_love_match');
        if (mGr.get(matchId)) {
            pairCode = mGr.getValue('u_pair_code') || '';
        }
    }

    response.setStatus(200);
    response.setBody({ result: {
        success:  true,
        username: gr.getValue('u_username'),
        charId:   gr.getValue('u_char_id') || 'char1',
        matchId:  matchId,
        pairCode: pairCode,
        apiKey:   apiKey,
    }});
})(request, response);
