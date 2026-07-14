// RESOURCE 34: POST /letters  |  Method: POST  |  Path: /letters  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    var gr = new GlideRecord('x_887486_love_app_u_love_letter');
    gr.initialize();
    gr.setValue('u_char',   body.charId || 'char1');
    gr.setValue('u_text',   body.text   || '');
    gr.setValue('u_date',   body.date   || new GlideDateTime().toString());
    gr.setValue('u_opened', body.opened === true);
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();

    response.setBody({ id: sysId, success: true });
    response.setStatus(201);
})(request, response);
