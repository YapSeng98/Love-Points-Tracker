// RESOURCE 40: POST /decor/buy  |  Method: POST  |  Path: /decor/buy  |  Requires Authentication: FALSE
//
// Buys a furniture/outfit item from the FRONTEND catalog (DECOR in app.js).
// The catalog lives in code so prices and seasonal stock change with a git
// push, never a ServiceNow edit.
//
// PAID IN 小窝币, NOT LOVE POINTS — deliberately. Furniture must never compete
// with real-world rewards (奶茶/约会), or decorating feels like stealing from
// your own date night. So this writes NO score entry and touches no points;
// it only records ownership. The coin balance is derived on the client as
// (pet EXP high-water / 2) minus the sum of u_pts_spent on decor rows, so the
// price recorded here IS the ledger — no separate balance field to drift.
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

    // NOTE: no score check and no deduction entry — coins are a separate
    // currency (see header). The client verifies the balance; the authoritative
    // record of what was spent is the u_pts_spent written below.

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
    response.setBody({ success: true, bagItemId: bagId, itemId: itemId });
})(request, response);
