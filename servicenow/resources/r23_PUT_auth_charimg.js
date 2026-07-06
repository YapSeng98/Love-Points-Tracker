// RESOURCE 23: PUT /auth/charimg  |  Method: PUT  |  Path: /auth/charimg  |  Requires Authentication: FALSE
// Body: { charImg: "<base64>", charId?: "char1"|"char2" }
// charId is optional — when given, updates that partner's picture within the
// same couple (so either person can set both avatars). Omitted → caller's own.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }

    var body    = request.body && request.body.data;
    var imgData = body ? (body.charImg || '') : '';
    var charId  = body ? (body.charId  || '') : '';
    var matchId = _au.getValue('u_match') || '';

    // Target the requested partner's row within the same couple; fall back to
    // the caller's own row when no charId (or no match) is provided.
    if (charId && matchId) {
        var tGr = new GlideRecord('x_887486_love_app_u_love_auth');
        tGr.addQuery('u_match', matchId);
        tGr.addQuery('u_char_id', charId);
        tGr.query();
        if (tGr.next()) {
            tGr.setValue('u_profile_picture', imgData);
            tGr.update();
            response.setBody({ success: true, charId: charId });
            return;
        }
        // No auth row for that char yet (partner hasn't registered) — nothing
        // to attach the picture to; report it rather than silently self-editing
        response.setStatus(404);
        response.setBody({ error: 'partner_not_found', charId: charId });
        return;
    }

    _au.setValue('u_profile_picture', imgData);
    _au.update();
    response.setBody({ success: true });
})(request, response);
