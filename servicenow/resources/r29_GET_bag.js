// RESOURCE 29: GET /bag  |  Method: GET  |  Path: /bag  |  Requires Authentication: FALSE
// Returns active (unused) bag items for the logged-in character.
//
// ⚠️ The ?type=decor branch below is PHASE 2 and NOT DEPLOYED YET — paste
// this file when 恋爱小窝 decorating ships. It is backward compatible: without
// the param the response is unchanged, so pasting early is harmless.
//
// OPTIONAL ?type=decor — returns the couple's 恋爱小窝 furniture instead, and
// deliberately does NOT filter by character: the room is shared, so a sofa
// one partner bought must be placeable by the other. Real-world rewards stay
// per-person; only decor is pooled. Without the param nothing changes.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';
    var charId  = _au.getValue('u_char_id') || 'char1';

    var type = request.queryParams.type;
    if (type && type.join) type = type.join('');
    var decorOnly = (type === 'decor');

    var gr = new GlideRecord('x_887486_love_app_u_love_bag');
    if (matchId) gr.addQuery('u_match', matchId);
    if (decorOnly) {
        gr.addQuery('u_source_type', 'decor');      // couple-wide, no u_char filter
    } else {
        gr.addQuery('u_char', charId);
        gr.addQuery('u_source_type', '!=', 'decor'); // keep furniture out of the reward bag
    }
    gr.addQuery('u_status', 'active');
    gr.orderByDesc('u_acquired_date');
    gr.query();
    var items = [];
    while (gr.next()) {
        items.push({
            id:           gr.getValue('sys_id'),
            itemId:       gr.getValue('u_shop_item')     || '',   // catalog id for decor
            owner:        gr.getValue('u_char')          || '',
            itemName:     gr.getValue('u_item_name')     || '',
            itemIcon:     gr.getValue('u_item_icon')     || '',
            ptsSpent:     parseInt(gr.getValue('u_pts_spent')) || 0,
            sourceType:   gr.getValue('u_source_type')   || '',
            month:        gr.getValue('u_month')         || '',
            acquiredDate: gr.getValue('u_acquired_date') || '',
        });
    }
    response.setBody(items);
})(request, response);
