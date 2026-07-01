// RESOURCE 21: POST /auth/register  |  Method: POST  |  Path: /auth/register  |  Requires Authentication: FALSE
(function process(request, response) {
    var body     = request.body && request.body.data;
    var username = body ? (body.username || '').toString().trim() : '';
    var password = body ? (body.password || '').toString()        : '';
    var charId   = body ? (body.charId   || 'char1').toString()   : 'char1';
    var pairCode = body ? (body.pairCode || '').toString().trim() : '';

    if (!username || !password) {
        response.setStatus(400);
        response.setBody({ error: '账号和密码不能为空' });
        return;
    }

    var existing = new GlideRecord('x_887486_love_app_u_love_auth');
    existing.addQuery('u_username', username);
    existing.query();
    if (existing.next()) {
        response.setStatus(409);
        response.setBody({ error: '账号已存在，请直接登录' });
        return;
    }

    var apiKey = gs.generateGUID();
    var matchId = '';
    var returnPairCode = '';
    var matchGr = new GlideRecord('x_887486_love_app_u_love_match');

    if (charId === 'char1') {
        returnPairCode = String(Math.floor(100000 + Math.random() * 900000));
        matchGr.initialize();
        matchGr.setValue('u_pair_code', returnPairCode);
        matchId = matchGr.insert();
    } else {
        if (!pairCode) {
            response.setStatus(400);
            response.setBody({ error: '请输入伴侣的配对码' });
            return;
        }
        matchGr.addQuery('u_pair_code', pairCode);
        matchGr.query();
        if (!matchGr.next()) {
            response.setStatus(404);
            response.setBody({ error: '配对码无效，请重新确认' });
            return;
        }
        matchId = matchGr.getUniqueValue();
    }

    var authGr = new GlideRecord('x_887486_love_app_u_love_auth');
    authGr.initialize();
    authGr.setValue('u_username',   username);
    authGr.setValue('u_password',   password);
    authGr.setValue('u_api_key',    apiKey);
    authGr.setValue('u_char_id',    charId);
    authGr.setValue('u_last_login', new GlideDateTime());
    if (matchId) authGr.setValue('u_match', matchId);
    authGr.insert();

    var partnerName = '';
    if (charId === 'char2' && matchId) {
        var partnerGr = new GlideRecord('x_887486_love_app_u_love_auth');
        partnerGr.addQuery('u_match', matchId);
        partnerGr.addQuery('u_char_id', 'char1');
        partnerGr.query();
        if (partnerGr.next()) {
            partnerName = partnerGr.getValue('u_username') || '';
        }
        // Set Couple Name on the match record as "char1Name_char2Name"
        var updMatch = new GlideRecord('x_887486_love_app_u_love_match');
        if (updMatch.get(matchId)) {
            updMatch.setValue('u_couple_name', partnerName + '_' + username);
            updMatch.update();
        }
    }

    response.setBody({
        success:     true,
        username:    username,
        charId:      charId,
        matchId:     matchId,
        pairCode:    returnPairCode,
        apiKey:      apiKey,
        partnerName: partnerName,
    });
    response.setStatus(201);
})(request, response);
