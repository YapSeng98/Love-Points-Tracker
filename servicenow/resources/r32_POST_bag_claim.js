// RESOURCE 32: POST /bag/claim  |  Method: POST  |  Path: /bag/claim  |  Requires Authentication: FALSE
// Claims a milestone reward from u_love_reward table, adds it to the bag.
// Claims are PER CHARACTER (u_claimed_1 / u_claimed_2) — each partner can
// claim every reward once per round.
// Body: { rewardId, charId?, date?, month? } — charId defaults to the caller's
// own character (the app sends the active character, same acting-for-partner
// convention as entries/check-in).
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body     = request.body.data;
    var rewardId = body && body.rewardId;
    if (!rewardId) { response.setStatus(400); response.setBody({ error: 'rewardId required' }); return; }
    var charId = (body && (body.charId === 'char1' || body.charId === 'char2'))
               ? body.charId : (_au.getValue('u_char_id') || 'char1');
    var claimedField = charId === 'char2' ? 'u_claimed_2'      : 'u_claimed_1';
    var dateField    = charId === 'char2' ? 'u_claimed_date_2' : 'u_claimed_date_1';

    var rGr = new GlideRecord('x_887486_love_app_u_love_reward');
    if (!rGr.get(rewardId) || rGr.getValue('u_match') !== matchId) {
        response.setStatus(404); response.setBody({ error: 'Reward not found' }); return;
    }
    var claimedVal = rGr.getValue(claimedField);
    if (claimedVal === '1' || claimedVal === 'true' || claimedVal === true) {
        response.setStatus(400); response.setBody({ error: 'already_claimed' }); return;
    }

    var itemName = rGr.getValue('u_name') || '';
    var itemIcon = rGr.getValue('u_emoji') || '';
    var minPts   = parseInt(rGr.getValue('u_points')) || 0;
    // Prefer the client's local date/month — the SN instance timezone can be
    // a day behind the user's, so server-computed "today" is unreliable.
    var today    = (body && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) ? body.date
                 : new GlideDateTime().getLocalDate().toString();
    var month    = (body && /^\d{4}-\d{2}$/.test(body.month || '')) ? body.month
                 : today.substring(0, 7);

    // Verify the caller's current-month score actually reached the reward
    // threshold (same sum as /shop/buy — unsettled entries, this char)
    var scoreGr = new GlideRecord('x_887486_love_app_u_love_entry');
    if (matchId) scoreGr.addQuery('u_match', matchId);
    scoreGr.addQuery('u_month', month);
    scoreGr.addNullQuery('u_monthly');
    if (charId === 'char2') {
        scoreGr.addQuery('u_char', 'char2');
    } else {
        var cond = scoreGr.addQuery('u_char', 'char1');
        cond.addOrCondition('u_char', '');
    }
    scoreGr.query();
    var currentScore = 0;
    while (scoreGr.next()) {
        currentScore += parseInt(scoreGr.getValue('u_points')) || 0;
    }
    if (currentScore < minPts) {
        response.setStatus(400);
        response.setBody({ error: 'score_not_reached', currentScore: currentScore, required: minPts });
        return;
    }

    // Mark reward as claimed for THIS character only
    rGr.setValue(claimedField, true);
    rGr.setValue(dateField,    today);
    rGr.update();

    // Add to bag
    var bagGr = new GlideRecord('x_887486_love_app_u_love_bag');
    bagGr.initialize();
    bagGr.setValue('u_char',          charId);
    bagGr.setValue('u_item_name',     itemName);
    bagGr.setValue('u_item_icon',     itemIcon);
    bagGr.setValue('u_pts_spent',     0);
    bagGr.setValue('u_source_type',   'reward');
    bagGr.setValue('u_shop_item',     '');
    bagGr.setValue('u_month',         month);
    bagGr.setValue('u_acquired_date', today);
    bagGr.setValue('u_status',        'active');
    if (matchId) bagGr.setValue('u_match', matchId);
    var bagId = bagGr.insert();

    response.setStatus(201);
    response.setBody({ success: true, bagItemId: bagId });
})(request, response);
