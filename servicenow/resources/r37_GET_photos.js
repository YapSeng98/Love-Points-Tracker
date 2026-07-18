// RESOURCE 37: GET /photos  |  Method: GET  |  Path: /photos  |  Requires Authentication: FALSE
// Returns the couple's memory photos, oldest first (story order), max 100.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var gr = new GlideRecord('x_887486_love_app_u_love_photo');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.orderBy('u_date');
    gr.setLimit(100);
    gr.query();
    var list = [];
    while (gr.next()) {
        list.push({
            id:      gr.getValue('sys_id'),
            charId:  gr.getValue('u_char') || 'char1',
            image:   gr.getValue('u_image') || '',
            caption: gr.getValue('u_caption') || '',
            date:    gr.getValue('u_date') || '',
        });
    }
    response.setBody(list);
})(request, response);
