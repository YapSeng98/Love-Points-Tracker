// RESOURCE 32: POST /bag/claim  |  Method: POST  |  Path: /bag/claim  |  Requires Authentication: FALSE
// Claims a milestone reward from u_love_reward table, adds it to the bag
// Body: { rewardId: "<sys_id of u_love_reward record>" }
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';
    var charId  = _au.getValue('u_char_id') || 'char1';

    var body     = request.body.data;
    var rewardId = body && body.rewardId;
    if (!rewardId) { response.setStatus(400); response.setBody({ error: 'rewardId required' }); return; }

    var rGr = new GlideRecord('x_887486_love_app_u_love_reward');
    if (!rGr.get(rewardId) || rGr.getValue('u_match') !== matchId) {
        response.setStatus(404); response.setBody({ error: 'Reward not found' }); return;
    }
    if (rGr.getValue('u_claimed') === '1' || rGr.getValue('u_claimed') === 'true' || rGr.getValue('u_claimed') === true) {
        response.setStatus(400); response.setBody({ error: 'already_claimed' }); return;
    }

    var itemName = rGr.getValue('u_name') || '';
    var itemIcon = rGr.getValue('u_emoji') || '';
    var now      = new GlideDateTime();
    var month    = now.getLocalDate().toString().substring(0, 7);

    // Mark reward as claimed
    rGr.setValue('u_claimed',      true);
    rGr.setValue('u_claimed_date', now.getLocalDate().toString());
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
    bagGr.setValue('u_acquired_date', now.getLocalDate().toString());
    bagGr.setValue('u_status',        'active');
    if (matchId) bagGr.setValue('u_match', matchId);
    var bagId = bagGr.insert();

    response.setStatus(201);
    response.setBody({ success: true, bagItemId: bagId });
})(request, response);
