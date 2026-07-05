// RESOURCE 4: GET /entries  |  Method: GET  |  Path: /entries  |  Requires Authentication: FALSE
// Query param: month (YYYY-MM, defaults to current month)
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var month = request.queryParams.month;
    if (!month) {
        var d = new GlideDateTime();
        month = d.getLocalDate().substring(0, 7);
    }

    var gr = new GlideRecord('x_887486_love_app_u_love_entry');
    gr.addQuery('u_month', month);
    if (matchId) gr.addQuery('u_match', matchId);
    gr.addNullQuery('u_monthly');
    gr.orderByDesc('u_date');
    // u_date has no time part — same-day entries tie, so break the tie by
    // actual creation time (newest first)
    gr.orderByDesc('sys_created_on');
    gr.query();

    var entries = [];
    while (gr.next()) {
        entries.push({
            id:      gr.getValue('sys_id'),
            catId:   gr.getValue('u_category'),
            catName: gr.getValue('u_category_name'),
            icon:    gr.getValue('u_icon'),
            pts:     parseInt(gr.getValue('u_points')),
            desc:    gr.getValue('u_note'),
            charId:  gr.getValue('u_char') || 'char1',
            month:   gr.getValue('u_month'),
            date:    gr.getValue('u_date'),
        });
    }
    response.setBody(entries);
})(request, response);
