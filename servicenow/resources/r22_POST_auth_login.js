// RESOURCE 22: POST /auth/login  |  Method: POST  |  Path: /auth/login  |  Requires Authentication: FALSE
(function process(request, response) {
    var body     = request.body && request.body.data;
    var username = body ? (body.username || '').toString().trim() : '';
    var password = body ? (body.password || '').toString()        : '';

    if (!username || !password) {
        response.setStatus(400);
        response.setBody({ error: '账号和密码不能为空' });
        return;
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_auth');
    gr.addQuery('u_username', username);
    gr.query();

    if (!gr.next()) {
        response.setStatus(404);
        response.setBody({ error: '账号不存在，请先注册' });
        return;
    }

    if (gr.getValue('u_password') !== password) {
        response.setStatus(401);
        response.setBody({ error: '密码错误' });
        return;
    }

    var apiKey = gr.getValue('u_api_key') || gs.generateGUID();
    gr.setValue('u_api_key',    apiKey);
    gr.setValue('u_last_login', new GlideDateTime());
    gr.update();

    var matchId = gr.getValue('u_match') || '';

    var pairCode = '';
    if (matchId) {
        var mGr = new GlideRecord('x_887486_love_app_u_love_match');
        if (mGr.get(matchId)) {
            pairCode = mGr.getValue('u_pair_code') || '';
        }
    }

    var partnerName = '';
    if (matchId) {
        var charId = gr.getValue('u_char_id') || 'char1';
        var partnerGr = new GlideRecord('x_887486_love_app_u_love_auth');
        partnerGr.addQuery('u_match', matchId);
        partnerGr.addQuery('u_char_id', charId === 'char1' ? 'char2' : 'char1');
        partnerGr.query();
        if (partnerGr.next()) {
            partnerName = partnerGr.getValue('u_username') || '';
        }
    }

    response.setStatus(200);
    response.setBody({
        success:     true,
        username:    gr.getValue('u_username'),
        charId:      gr.getValue('u_char_id') || 'char1',
        matchId:     matchId,
        pairCode:    pairCode,
        apiKey:      apiKey,
        partnerName: partnerName,
    });
})(request, response);
