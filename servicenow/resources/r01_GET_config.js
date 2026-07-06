// RESOURCE 1: GET /config  |  Method: GET  |  Path: /config  |  Requires Authentication: FALSE
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    // Fetch both users' names and profile pictures for this match
    var char1Name = '';
    var char2Name = '';
    var charImg1  = '';
    var charImg2  = '';
    if (matchId) {
        var nameGr = new GlideRecord('x_887486_love_app_u_love_auth');
        nameGr.addQuery('u_match', matchId);
        nameGr.query();
        while (nameGr.next()) {
            var cId = nameGr.getValue('u_char_id') || 'char1';
            if (cId === 'char1') {
                char1Name = nameGr.getValue('u_username')         || '';
                charImg1  = nameGr.getValue('u_profile_picture')  || '';
            } else {
                char2Name = nameGr.getValue('u_username')         || '';
                charImg2  = nameGr.getValue('u_profile_picture')  || '';
            }
        }
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_config');
    if (matchId) gr.addQuery('u_match', matchId);
    gr.query();
    if (gr.next()) {
        // Editable display names live on the config row; fall back to the
        // login username only when a custom name hasn't been set yet
        var cn1 = gr.getValue('u_char1_name');
        var cn2 = gr.getValue('u_char2_name');
        response.setBody({
            configured:      true,
            mode:            gr.getValue('u_mode') || 'reward',
            rewardTarget:    parseInt(gr.getValue('u_reward_target'))    || 100,
            punishThreshold: parseInt(gr.getValue('u_punish_threshold')) || -80,
            startDate:       gr.getValue('u_start_date') || '',
            char1Name:       cn1 || char1Name,
            char2Name:       cn2 || char2Name,
            charImg1:        charImg1,
            charImg2:        charImg2,
        });
    } else {
        response.setBody({ configured: false, startDate: '', char1Name: char1Name, char2Name: char2Name, charImg1: charImg1, charImg2: charImg2 });
    }
})(request, response);
