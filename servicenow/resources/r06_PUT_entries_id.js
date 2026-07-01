// RESOURCE 6: PUT /entries/{id}  |  Method: PUT  |  Path: /entries/{id}  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var id   = request.pathParams.id;
    var body = request.body.data;
    var gr   = new GlideRecord('x_887486_love_app_u_love_entry');
    if (!gr.get(id) || gr.getValue('u_match') !== matchId) {
        response.setStatus(404);
        response.setBody({ error: 'Not found' });
        return;
    }
    if (body.catId   !== undefined) gr.setValue('u_category',      body.catId);
    if (body.catName !== undefined) gr.setValue('u_category_name', body.catName);
    if (body.icon    !== undefined) gr.setValue('u_icon',          body.icon);
    if (body.pts     !== undefined) gr.setValue('u_points',        parseInt(body.pts));
    if (body.desc    !== undefined) gr.setValue('u_note',          body.desc);
    if (body.date    !== undefined) gr.setValue('u_date',          body.date);
    if (body.charId  !== undefined) gr.setValue('u_char',          body.charId);
    gr.update();
    response.setBody({ success: true });
})(request, response);
