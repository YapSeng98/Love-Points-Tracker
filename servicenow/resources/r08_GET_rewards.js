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
    while (gr.next()) {
        var claimedVal = gr.getValue('u_claimed');
        list.push({
            id:          gr.getValue('sys_id'),
            icon:        gr.getValue('u_emoji'),
            name:        gr.getValue('u_name'),
            minPts:      parseInt(gr.getValue('u_points')),
            desc:        gr.getValue('u_desc'),
            claimed:     claimedVal === '1' || claimedVal === 'true' || claimedVal === true,
            claimedDate: gr.getValue('u_claimed_date') || '',
        });
    }
    response.setBody(list);
})(request, response);
