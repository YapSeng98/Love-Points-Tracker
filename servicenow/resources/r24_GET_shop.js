// RESOURCE 24: GET /shop  |  Method: GET  |  Path: /shop  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('x_887486_love_app_u_love_shop');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_pts_cost');
    gr.query();
    var items = [];
    while (gr.next()) {
        items.push({
            id:      gr.getValue('sys_id'),
            icon:    gr.getValue('u_icon')    || '',
            name:    gr.getValue('u_name')    || '',
            desc:    gr.getValue('u_desc')    || '',
            ptsCost: parseInt(gr.getValue('u_pts_cost')) || 0,
            active:  gr.getValue('u_active') === '1' || gr.getValue('u_active') === 'true' || gr.getValue('u_active') === true,
        });
    }
    response.setBody(items);
})(request, response);
