// RESOURCE 13: PUT /categories/{id}  |  Method: PUT  |  Path: /categories/{id}  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('x_887486_love_app_u_love_category');
    if (!gr.get(id) || gr.getValue('u_match') !== matchId) {
        response.setStatus(404);
        response.setBody({ error: 'Not found' });
        return;
    }
    if (body.icon   !== undefined) gr.setValue('u_emoji',  body.icon);
    if (body.name   !== undefined) gr.setValue('u_name',   body.name);
    if (body.pts    !== undefined) gr.setValue('u_points', parseInt(body.pts));
    if (body.active !== undefined) gr.setValue('u_active', body.active);
    gr.update();
    response.setBody({ success: true });
})(request, response);
