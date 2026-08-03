// RESOURCE 2: PUT /config  |  Method: PUT  |  Path: /config  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('x_887486_love_app_u_love_config');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.query();
    var isNew = !gr.next();
    if (isNew) { gr.initialize(); if (matchId) gr.setValue('u_match', matchId); }

    if (body.mode            !== undefined) gr.setValue('u_mode',             body.mode);
    if (body.rewardTarget    !== undefined) gr.setValue('u_reward_target',    body.rewardTarget);
    if (body.punishThreshold !== undefined) gr.setValue('u_punish_threshold', body.punishThreshold);
    if (body.startDate       !== undefined) gr.setValue('u_start_date',       body.startDate);
    if (body.charName1       !== undefined) gr.setValue('u_char1_name',       body.charName1);
    if (body.charName2       !== undefined) gr.setValue('u_char2_name',       body.charName2);
    // 共同目标 (shared goal) — the couple's joint points target
    if (body.goalName        !== undefined) gr.setValue('u_goal_name',        body.goalName);
    if (body.goalIcon        !== undefined) gr.setValue('u_goal_icon',        body.goalIcon);
    if (body.goalTarget      !== undefined) gr.setValue('u_goal_target',      parseInt(body.goalTarget) || 0);
    // 恋爱小窝 (pet) — level/mood are derived from activity, so only the
    // couple's own choices live here. u_pet_equipped is a JSON blob so new
    // furniture slots never need another SN field.
    if (body.petName         !== undefined) gr.setValue('u_pet_name',         body.petName);
    if (body.petSpecies      !== undefined) gr.setValue('u_pet_species',      body.petSpecies);
    if (body.petEquipped     !== undefined) gr.setValue('u_pet_equipped',     body.petEquipped);
    // High-water mark only — a pet must never shrink, so refuse any write
    // that would lower it (e.g. a stale client, or a deleted photo/letter).
    if (body.petExp !== undefined) {
        var _newExp = parseInt(body.petExp) || 0;
        if (_newExp > (parseInt(gr.getValue('u_pet_exp')) || 0)) gr.setValue('u_pet_exp', _newExp);
    }
    if (isNew) { gr.insert(); } else { gr.update(); }

    // Keep the couple name on the match record in sync with the display names
    // so either partner editing a name updates the shared label
    if (matchId && (body.charName1 !== undefined || body.charName2 !== undefined)) {
        var n1 = gr.getValue('u_char1_name') || '';
        var n2 = gr.getValue('u_char2_name') || '';
        var mGr = new GlideRecord('x_887486_love_app_u_love_match');
        if (mGr.get(matchId)) {
            mGr.setValue('u_couple_name', n1 + '_' + n2);
            mGr.update();
        }
    }

    response.setBody({ success: true });
})(request, response);
