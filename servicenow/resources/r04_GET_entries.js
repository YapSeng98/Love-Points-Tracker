// RESOURCE 4: GET /entries  |  Method: GET  |  Path: /entries  |  Requires Authentication: FALSE
//
// Returns every UNSETTLED entry for the couple — NOT filtered by calendar
// month. Entries are only ever removed from this list by an actual
// /monthly/settle call (which stamps u_monthly), never by the calendar
// rolling over. Filtering by "this month" here used to silently hide any
// entry logged before a missed 月末结算 — it stayed in the table, unsettled,
// but became unreachable through the app the moment the month changed,
// which looked like the entries (and the points they represented) had just
// vanished. The frontend groups the returned entries by their own u_month
// when settling, so old months still land as their own separate history
// record instead of getting silently dropped or lumped into "today".
//
// OPTIONAL ?year=YYYY — returns EVERY entry of that year, settled ones
// included. The 年度回顾 needs this: settling stamps u_monthly and hides the
// entries from the normal call, so a yearly "how many check-ins" count only
// ever saw the current unsettled month. Without the param the behaviour is
// unchanged (unsettled only), so this stays backward compatible.
(function process(request, response) {
    var _tok = (request.getHeader('Authorization')||'').replace('Bearer ','').trim();
    var _au = new GlideRecord('x_887486_love_app_u_love_auth');
    _au.addQuery('u_api_key', _tok);
    _au.query();
    if (!_au.next()) { response.setStatus(401); response.setBody({error:'Unauthorized'}); return; }
    var matchId = _au.getValue('u_match') || '';

    var year = request.queryParams.year;
    if (year && year.join) year = year.join('');   // SN may hand back an array

    var gr = new GlideRecord('x_887486_love_app_u_love_entry');
    if (matchId) gr.addQuery('u_match', matchId);
    if (year && /^\d{4}$/.test(year)) {
        gr.addQuery('u_month', 'STARTSWITH', year);   // settled AND unsettled
        gr.setLimit(2000);
    } else {
        gr.addNullQuery('u_monthly');
    }
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
