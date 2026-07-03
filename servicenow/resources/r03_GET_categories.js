// RESOURCE 3: GET /categories  |  Method: GET  |  Path: /categories  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('x_887486_love_app_u_love_category');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_name');
    gr.query();
    var cats = [];
    while (gr.next()) {
        cats.push({
            id:     gr.getValue('sys_id'),
            icon:   gr.getValue('u_emoji'),
            name:   gr.getValue('u_name'),
            pts:    parseInt(gr.getValue('u_points')),
            active: gr.getValue('u_active') === '1' || gr.getValue('u_active') === 'true' || gr.getValue('u_active') === true,
        });
    }
    response.setBody(cats);
})(request, response);
