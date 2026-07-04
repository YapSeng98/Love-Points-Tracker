// RESOURCE 11: POST /monthly/settle  |  Method: POST  |  Path: /monthly/settle  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;

    // Guard: if this couple already settled this month (e.g. the partner
    // clicked 月结 first), don't create a duplicate history row or wipe
    // anything again — just report it back.
    var existing = new GlideRecord('x_887486_love_app_u_love_monthly');
    existing.addQuery('u_month', body.month || '');
    if (matchId) existing.addQuery('u_match', matchId);
    existing.query();
    if (existing.next()) {
        response.setBody({ success: true, alreadySettled: true, monthId: existing.getUniqueValue() });
        return;
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_monthly');
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

    var entryGr = new GlideRecord('x_887486_love_app_u_love_entry');
    entryGr.addQuery('u_month', body.month);
    if (matchId) entryGr.addQuery('u_match', matchId);
    entryGr.addNullQuery('u_monthly');
    entryGr.query();
    while (entryGr.next()) {
        entryGr.setValue('u_monthly', monthSysId);
        entryGr.update();
    }

    // New month starts fresh: milestone rewards become claimable again
    var rGr = new GlideRecord('x_887486_love_app_u_love_reward');
    if (matchId) rGr.addQuery('u_match', matchId);
    rGr.addQuery('u_claimed', true);
    rGr.query();
    while (rGr.next()) {
        rGr.setValue('u_claimed', false);
        rGr.setValue('u_claimed_date', '');
        rGr.update();
    }

    response.setBody({ success: true, monthId: monthSysId });
})(request, response);
