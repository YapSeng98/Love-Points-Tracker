// RESOURCE 41: GET /backup/full  |  Method: GET  |  Path: /backup/full  |  Requires Authentication: FALSE
//
// Returns every table for the caller's couple in ONE response — used only by
// tools/backup.js, never by the app itself. Authenticates exactly like every
// other resource (Bearer apiKey → matchId), so either partner's existing
// login is enough. The one deliberate difference from r29/r31: the bag query
// below does NOT filter by u_char, so a single call returns BOTH partners'
// bag rows (each tagged with its own `owner`) instead of just the caller's.
//
// u_love_auth is never touched — r22 compares u_password directly (no
// hashing), so a table of plaintext credentials has no business sitting in a
// portable backup file. Accounts can be recreated; this is for content.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    // GlideRecord fields aren't reliably enumerable across SN versions, so
    // each table lists its own columns explicitly — mirrors what the other
    // GET resources already expose, plus the raw sys_id/sys_created_on for
    // completeness.
    function rowsOf(table, fields) {
        var gr = new GlideRecord(table);
        if (matchId) gr.addQuery('u_match', matchId);
        gr.query();
        var out = [];
        while (gr.next()) {
            var o = { id: gr.getValue('sys_id'), createdOn: gr.getValue('sys_created_on') };
            for (var i = 0; i < fields.length; i++) o[fields[i]] = gr.getValue(fields[i]);
            out.push(o);
        }
        return out;
    }

    var body = {
        match:       rowsOf('x_887486_love_app_u_love_match',      ['u_couple_name','u_pair_code']),
        config:      rowsOf('x_887486_love_app_u_love_config',     ['u_mode','u_reward_target','u_punish_threshold','u_start_date','u_char1_name','u_char2_name','u_goal_name','u_goal_icon','u_goal_target','u_pet_species','u_pet_name','u_pet_exp','u_pet_base','u_pet_equipped','u_wx_1','u_wx_2']),
        categories:  rowsOf('x_887486_love_app_u_love_category',   ['u_name','u_emoji','u_points','u_active']),
        entries:     rowsOf('x_887486_love_app_u_love_entry',      ['u_char','u_category','u_category_name','u_category_pts','u_points','u_icon','u_note','u_date','u_month','u_monthly']),
        monthly:     rowsOf('x_887486_love_app_u_love_monthly',    ['u_month','u_char1_pts','u_char2_pts','u_mode','u_result_1','u_result_2','u_settled_at','u_claimed_1','u_claimed_2']),
        rewards:     rowsOf('x_887486_love_app_u_love_reward',     ['u_name','u_emoji','u_desc','u_points']),
        punishments: rowsOf('x_887486_love_app_u_love_punishment', ['u_name','u_emoji','u_desc','u_points']),
        shop:        rowsOf('x_887486_love_app_u_love_shop',       ['u_name','u_icon','u_desc','u_pts_cost','u_active']),
        // Deliberately no u_char filter — the one place this resource differs
        // from r29/r31, and the whole reason it exists.
        bag:         rowsOf('x_887486_love_app_u_love_bag',        ['u_char','u_shop_item','u_item_name','u_item_icon','u_pts_spent','u_source_type','u_status','u_month','u_acquired_date','u_used_date']),
        letters:     rowsOf('x_887486_love_app_u_love_letter',     ['u_char','u_text','u_date','u_opened']),
        photos:      rowsOf('x_887486_love_app_u_love_photo',      ['u_char','u_image','u_caption','u_date']),
    };

    response.setBody(body);
})(request, response);
