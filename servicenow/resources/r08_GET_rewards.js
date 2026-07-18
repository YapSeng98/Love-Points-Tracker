// RESOURCE 8: GET /rewards  |  Method: GET  |  Path: /rewards  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('x_887486_love_app_u_love_reward');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_points');
    gr.query();
    var list = [];
    var truthy = function (v) { return v === '1' || v === 'true' || v === true; };
    while (gr.next()) {
        // Claims are per-character (u_claimed_1 / u_claimed_2) so each partner
        // can claim every reward once. Legacy `claimed` = either, kept so a
        // cached old frontend still renders something sensible.
        var c1 = truthy(gr.getValue('u_claimed_1'));
        var c2 = truthy(gr.getValue('u_claimed_2'));
        list.push({
            id:           gr.getValue('sys_id'),
            icon:         gr.getValue('u_emoji'),
            name:         gr.getValue('u_name'),
            minPts:       parseInt(gr.getValue('u_points')),
            desc:         gr.getValue('u_desc'),
            claimed1:     c1,
            claimed2:     c2,
            claimedDate1: gr.getValue('u_claimed_date_1') || '',
            claimedDate2: gr.getValue('u_claimed_date_2') || '',
            claimed:      c1 || c2,
        });
    }
    response.setBody(list);
})(request, response);
