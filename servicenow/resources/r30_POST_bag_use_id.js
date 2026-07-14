// RESOURCE 30: POST /bag/use/{id}  |  Method: POST  |  Path: /bag/use/{id}  |  Requires Authentication: FALSE
// Marks a bag item as used (status: active → used)
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';
    var charId  = _au.getValue('u_char_id') || 'char1';

    var id = request.pathParams.id;
    var gr = new GlideRecord('x_887486_love_app_u_love_bag');
    if (!gr.get(id) || gr.getValue('u_match') !== matchId || gr.getValue('u_char') !== charId) {
        response.setStatus(404); response.setBody({ error: 'Not found' }); return;
    }
    if (gr.getValue('u_status') !== 'active') {
        response.setStatus(400); response.setBody({ error: 'already_used' }); return;
    }
    // Prefer the client's local date — the SN instance timezone can be a day
    // behind the user's, so server-computed "today" is unreliable.
    var body  = request.body && request.body.data;
    var today = (body && /^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) ? body.date
              : new GlideDateTime().getLocalDate().toString();
    gr.setValue('u_status',    'used');
    gr.setValue('u_used_date', today);
    gr.update();
    response.setBody({ success: true });
})(request, response);
