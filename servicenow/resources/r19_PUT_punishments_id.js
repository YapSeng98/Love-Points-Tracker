// RESOURCE 19: PUT /punishments/{id}  |  Method: PUT  |  Path: /punishments/{id}  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('x_887486_love_app_u_love_punishment');
    if (!gr.get(id) || gr.getValue('u_match') !== matchId) {
        response.setStatus(404);
        response.setBody({ error: 'Not found' });
        return;
    }
    if (body.icon   !== undefined) gr.setValue('u_emoji',  body.icon);
    if (body.name   !== undefined) gr.setValue('u_name',   body.name);
    if (body.minPts !== undefined) gr.setValue('u_points', parseInt(body.minPts));
    if (body.desc   !== undefined) gr.setValue('u_desc',   body.desc);
    gr.update();
    response.setBody({ success: true });
})(request, response);
