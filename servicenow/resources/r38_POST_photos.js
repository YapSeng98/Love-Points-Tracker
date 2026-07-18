// RESOURCE 38: POST /photos  |  Method: POST  |  Path: /photos  |  Requires Authentication: FALSE
// Body: { charId, image (base64 data URI), caption, date }
// NOTE: u_image must be a String field with max_length 200000 — the app
// compresses photos to ~900px JPEG before upload to fit.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var body = request.body.data;
    if (!body || !body.image) {
        response.setStatus(400); response.setBody({ error: 'image required' }); return;
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_photo');
    gr.initialize();
    gr.setValue('u_char',    body.charId || (_au.getValue('u_char_id') || 'char1'));
    gr.setValue('u_image',   body.image);
    gr.setValue('u_caption', body.caption || '');
    gr.setValue('u_date',    body.date || new GlideDateTime().getLocalDate().toString());
    if (matchId) gr.setValue('u_match', matchId);
    var sysId = gr.insert();

    response.setBody({ id: sysId, success: true });
    response.setStatus(201);
})(request, response);
