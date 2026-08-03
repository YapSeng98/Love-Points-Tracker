// RESOURCE 40: POST /decor/buy  |  Method: POST  |  Path: /decor/buy  |  Requires Authentication: FALSE
//
// ⚠️ PHASE 2 — NOT DEPLOYED YET. Paste this when 恋爱小窝 decorating ships.
//
// Buys a furniture/outfit item from the FRONTEND catalog (docs: DECOR in
// app.js). Unlike /shop/buy (28), the item isn't a u_love_shop row — the
// catalog lives in code so prices and seasonal stock can change without any
// ServiceNow work. This resource therefore takes the item's id/name/price
// from the request and does the three things that must happen together:
//   1. verify the buyer can afford it
//   2. write the negative score entry
//   3. write the u_love_bag row that records ownership
// Doing it here rather than as three client calls keeps it atomic — a client
// that died halfway would otherwise deduct points without granting the item.
//
// Body: { itemId, itemName, itemIcon, price, charId?, date?, month? }
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body   = request.body && request.body.data;
    var itemId = body ? (body.itemId || '') : '';
    var price  = body ? (parseInt(body.price) || 0) : 0;
    if (!itemId)   { response.setStatus(400); response.setBody({ error: 'itemId required' }); return; }
    if (price < 0) { response.setStatus(400); response.setBody({ error: 'bad price' }); return; }

    var charId = (body && (body.charId === 'char1' || body.charId === 'char2'))
               ? body.charId : (_au.getValue('u_char_id') || 'char1');

    // Client-authoritative dates — the instance timezone runs behind the users
    var today = (body && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) ? body.date
              : new GlideDateTime().getLocalDate().toString();
    var month = (body && /^\d{4}-\d{2}$/.test(body.month || '')) ? body.month
              : today.substring(0, 7);

    // Already owned? Decor is a one-off purchase — never charge twice.
    var ownGr = new GlideRecord('x_887486_love_app_u_love_bag');
    if (matchId) ownGr.addQuery('u_match', matchId);
    ownGr.addQuery('u_source_type', 'decor');
    ownGr.addQuery('u_shop_item', itemId);
    ownGr.query();
    if (ownGr.hasNext()) {
        response.setStatus(400);
        response.setBody({ error: 'already_owned', itemId: itemId });
        return;
    }

    // Sum ALL unsettled entries for this character — must match r04/r28/r32.
    // Never filter by month here: a missed 月末结算 leaves last month's points
    // unsettled and they still count, exactly like the score the app shows.
    var scoreGr = new GlideRecord('x_887486_love_app_u_love_entry');
    if (matchId) scoreGr.addQuery('u_match', matchId);
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
    if (currentScore < price) {
        response.setStatus(400);
        response.setBody({ error: 'insufficient_points', currentScore: currentScore, required: price });
        return;
    }

    // Deduct via a negative entry so the ledger explains where points went
    var entryGr = new GlideRecord('x_887486_love_app_u_love_entry');
    entryGr.initialize();
    entryGr.setValue('u_char',          charId);
    entryGr.setValue('u_category',      '');
    entryGr.setValue('u_category_name', '🏡 小窝装修');
    entryGr.setValue('u_category_pts',  -price);
    entryGr.setValue('u_icon',          (body && body.itemIcon) || '🏡');
    entryGr.setValue('u_points',        -price);
    entryGr.setValue('u_note',          '购买：' + ((body && body.itemName) || itemId));
    entryGr.setValue('u_month',         month);
    entryGr.setValue('u_date',          today);
    if (matchId) entryGr.setValue('u_match', matchId);
    entryGr.insert();

    // Ownership row. u_shop_item holds the catalog id (not a sys_id) so the
    // frontend can look the item up in DECOR without another round trip.
    var bagGr = new GlideRecord('x_887486_love_app_u_love_bag');
    bagGr.initialize();
    bagGr.setValue('u_char',          charId);
    bagGr.setValue('u_item_name',     (body && body.itemName) || itemId);
    bagGr.setValue('u_item_icon',     (body && body.itemIcon) || '');
    bagGr.setValue('u_pts_spent',     price);
    bagGr.setValue('u_source_type',   'decor');
    bagGr.setValue('u_shop_item',     itemId);
    bagGr.setValue('u_month',         month);
    bagGr.setValue('u_acquired_date', today);
    bagGr.setValue('u_status',        'active');
    if (matchId) bagGr.setValue('u_match', matchId);
    var bagId = bagGr.insert();

    response.setStatus(201);
    response.setBody({ success: true, bagItemId: bagId, itemId: itemId, newScore: currentScore - price });
})(request, response);
