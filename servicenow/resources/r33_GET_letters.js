// RESOURCE 33: GET /letters  |  Method: GET  |  Path: /letters  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('x_887486_love_app_u_love_letter');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_date');
    gr.setLimit(500);
    gr.query();
    var list = [];
    while (gr.next()) {
        list.push({
            id:     gr.getValue('sys_id'),
            charId: gr.getValue('u_char') || 'char1',
            text:   gr.getValue('u_text'),
            date:   gr.getValue('u_date'),
            opened: gr.getValue('u_opened') === '1' || gr.getValue('u_opened') === true,
        });
    }
    response.setBody(list);
})(request, response);
