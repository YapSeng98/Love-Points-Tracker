// RESOURCE 11: POST /monthly/settle  |  Method: POST  |  Path: /monthly/settle  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;

    // Guard on whether there's anything to settle, NOT on "has this calendar
    // month been settled before". This lets a couple settle multiple rounds in
    // the same month, while still stopping a partner's duplicate click (once
    // the entries are archived there's nothing left, so the 2nd click no-ops).
    var pending = new GlideRecord('x_887486_love_app_u_love_entry');
    pending.addQuery('u_month', body.month || '');
    if (matchId) pending.addQuery('u_match', matchId);
    pending.addNullQuery('u_monthly');
    pending.query();
    if (!pending.hasNext()) {
        response.setBody({ success: true, alreadySettled: true });
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

    // Archive exactly the entries we counted as pending
    while (pending.next()) {
        pending.setValue('u_monthly', monthSysId);
        pending.update();
    }

    // New round starts fresh: milestone rewards become claimable again for
    // both characters (per-char flags + the legacy shared flag)
    var rGr = new GlideRecord('x_887486_love_app_u_love_reward');
    if (matchId) rGr.addQuery('u_match', matchId);
    rGr.query();
    while (rGr.next()) {
        rGr.setValue('u_claimed',        false);
        rGr.setValue('u_claimed_date',   '');
        rGr.setValue('u_claimed_1',      false);
        rGr.setValue('u_claimed_date_1', '');
        rGr.setValue('u_claimed_2',      false);
        rGr.setValue('u_claimed_date_2', '');
        rGr.update();
    }

    response.setBody({ success: true, monthId: monthSysId });
})(request, response);
