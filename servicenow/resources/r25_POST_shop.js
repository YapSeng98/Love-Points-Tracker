// RESOURCE 25: POST /shop  |  Method: POST  |  Path: /shop  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('x_887486_love_app_u_love_shop');
    gr.initialize();
    gr.setValue('u_icon',     body.icon    || '');
    gr.setValue('u_name',     body.name    || '');
    gr.setValue('u_desc',     body.desc    || '');
    gr.setValue('u_pts_cost', parseInt(body.ptsCost) || 0);
    gr.setValue('u_active',   body.active !== false);
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();
    response.setBody({ id: sysId, success: true });
    response.setStatus(201);
})(request, response);
