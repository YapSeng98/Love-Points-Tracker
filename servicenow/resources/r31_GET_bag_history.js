// RESOURCE 31: GET /bag/history  |  Method: GET  |  Path: /bag/history  |  Requires Authentication: FALSE
// Returns used bag items for the logged-in character
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';
    var charId  = _au.getValue('u_char_id') || 'char1';

    var gr = new GlideRecord('x_887486_love_app_u_love_bag');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.addQuery('u_char', charId);
    gr.addQuery('u_status', 'used');
    gr.orderByDesc('u_used_date');
    gr.query();
    var items = [];
    while (gr.next()) {
        items.push({
            id:           gr.getValue('sys_id'),
            itemName:     gr.getValue('u_item_name')     || '',
            itemIcon:     gr.getValue('u_item_icon')     || '',
            ptsSpent:     parseInt(gr.getValue('u_pts_spent')) || 0,
            sourceType:   gr.getValue('u_source_type')   || '',
            month:        gr.getValue('u_month')         || '',
            acquiredDate: gr.getValue('u_acquired_date') || '',
            usedDate:     gr.getValue('u_used_date')     || '',
        });
    }
    response.setBody(items);
})(request, response);
