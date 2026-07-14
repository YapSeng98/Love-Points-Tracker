// RESOURCE 35: PUT /letters/{id}  |  Method: PUT  |  Path: /letters/{id}  |  Requires Authentication: FALSE
// Body: { opened } — used to mark a letter as opened once the recipient unseals it
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
    var body = request.body.data;
    if (body.opened !== undefined) gr.setValue('u_opened', body.opened === true);
    gr.update();
    response.setBody({ success: true });
})(request, response);
