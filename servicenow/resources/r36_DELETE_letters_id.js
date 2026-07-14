// RESOURCE 36: DELETE /letters/{id}  |  Method: DELETE  |  Path: /letters/{id}  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var id = request.pathParams.id;
    var gr = new GlideRecord('x_887486_love_app_u_love_letter');
    if (!gr.get(id) || gr.getValue('u_match') !== matchId) {
        response.setStatus(404); response.setBody({ error: 'Not found' }); return;
    }
    gr.deleteRecord();
    response.setBody({ success: true });
})(request, response);
