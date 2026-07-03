// RESOURCE 28: POST /shop/buy/{id}  |  Method: POST  |  Path: /shop/buy/{id}  |  Requires Authentication: FALSE
// Buys a shop item: validates score, creates a deduction entry, creates bag item
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';
    var charId  = _au.getValue('u_char_id') || 'char1';

    var id = request.pathParams.id;
    var shopGr = new GlideRecord('x_887486_love_app_u_love_shop');
    if (!shopGr.get(id) || shopGr.getValue('u_match') !== matchId) {
        response.setStatus(404); response.setBody({ error: 'Not found' }); return;
    }
    var ptsCost  = parseInt(shopGr.getValue('u_pts_cost')) || 0;
    var itemName = shopGr.getValue('u_name') || '';
    var itemIcon = shopGr.getValue('u_icon') || '';

    // Current month string e.g. "2026-07"
    var now   = new GlideDateTime();
    var month = now.getLocalDate().toString().substring(0, 7);

    // Sum unsettled entries for this character this month
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

    if (currentScore < ptsCost) {
        response.setStatus(400);
        response.setBody({ error: 'insufficient_points', currentScore: currentScore, required: ptsCost });
        return;
    }

    // Deduct points via a negative score entry
    var entryGr = new GlideRecord('x_887486_love_app_u_love_entry');
    entryGr.initialize();
    entryGr.setValue('u_char',          charId);
    entryGr.setValue('u_category',      '');
    entryGr.setValue('u_category_name', '🛒 商店兑换');
    entryGr.setValue('u_category_pts',  -ptsCost);
    entryGr.setValue('u_icon',          itemIcon);
    entryGr.setValue('u_points',        -ptsCost);
    entryGr.setValue('u_note',          '兑换：' + itemName);
    entryGr.setValue('u_month',         month);
    entryGr.setValue('u_date',          now.getLocalDate().toString());
    if (matchId) entryGr.setValue('u_match', matchId);
    entryGr.insert();

    // Create bag item
    var bagGr = new GlideRecord('x_887486_love_app_u_love_bag');
    bagGr.initialize();
    bagGr.setValue('u_char',          charId);
    bagGr.setValue('u_item_name',     itemName);
    bagGr.setValue('u_item_icon',     itemIcon);
    bagGr.setValue('u_pts_spent',     ptsCost);
    bagGr.setValue('u_source_type',   'purchase');
    bagGr.setValue('u_shop_item',     id);
    bagGr.setValue('u_month',         month);
    bagGr.setValue('u_acquired_date', now.getLocalDate().toString());
    bagGr.setValue('u_status',        'active');
    if (matchId) bagGr.setValue('u_match', matchId);
    var bagId = bagGr.insert();

    response.setStatus(201);
    response.setBody({ success: true, bagItemId: bagId, newScore: currentScore - ptsCost });
})(request, response);
