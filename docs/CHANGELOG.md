# Changelog

What changed, when, and **why** — the part `git log` can't tell you at a glance.
Newest first. Dates are the day the change went live on GitHub Pages.

> This file is committed to a repo that **deploys publicly**. Keep it to what
> changed in the code. No scores, no letter or photo content, no credentials —
> those live in `backups/`, which is gitignored for exactly that reason.

For the full detail of any entry: `git log --oneline` and read the commit
message. They are written to explain the reasoning, not just the diff.

---

## 2026-09-14 — Test accounts stopped piling up

The test suites run with only the publishable key, exactly like the app does,
so they can't delete auth users — every run left a throwaway couple behind and
three had accumulated. Added `supabase/cleanup-test-accounts.mjs`, dry-run by
default.

Real accounts are protected by an explicit allowlist rather than by the
username pattern alone: a regex that accidentally matched a real username
would delete that couple's entire history.

---

## 2026-09-11 — **Backend moved from ServiceNow to Supabase**

The largest change since the app was built. All 41 ServiceNow REST resources
became 27 Supabase Edge Functions over Postgres, every row was copied and
checked against the original, and the app switched over the same day.

**Why.** Everything lived on a free ServiceNow Personal Developer Instance.
A PDI hibernates after a few idle days and, left long enough, is reclaimed
outright with everything on it. There is no vendor backup. A backup script
existed, but that is a mitigation, not a fix.

**Held deliberately identical** so the frontend barely moved: every function
returns the same JSON shape its ServiceNow resource did, and the transport
layer rewrites the old paths onto function slugs. All ~30 call sites in
`app.js` were untouched.

**What genuinely changed**

| | Before | After |
|---|---|---|
| API | 41 resources, pasted in by hand | 27 Edge Functions, deployed by CLI |
| Data | 12 `u_love_*` tables, fixed-width strings | 12 Postgres tables, unbounded `text` |
| Auth | Custom key; **plaintext passwords** | Supabase Auth — hashed, JWT + refresh |
| Photos | base64 in a `String(200000)` column | Storage bucket, signed URLs |
| Access | Each resource re-checked scope by hand | Row-level security in the database |

**Security holes closed on the way.** Plaintext passwords are gone. The first
RLS pass was too permissive and was caught before any data existed — it would
have let anyone with a valid session token skip the functions and write
straight to Postgres, forging scores or rewriting settled history. Policies
are now `SELECT`-only for clients; all writes go through functions holding the
service-role key. A third hole was found in review: the `profiles` update
policy only checked "it's your own row", which did not stop someone changing
their *own* `match_id` into another couple's and inheriting read access to
everything in it.

**Three bugs the tests caught before any data moved**

1. `bag.source_type` allowed only `purchase` and `reward` — but furniture
   writes `decor`. Every piece the couple owns, including year-locked
   keepsakes that can't be re-bought, would have been rejected at insert.
   The two kinds don't even store the same thing: a purchase points at a shop
   row, furniture stores a text catalog id. They needed separate columns.
2. Being *stricter* than the old system is still a regression. ServiceNow
   never blocked deleting a shop item that bag rows referenced; a real foreign
   key does. `ON DELETE SET NULL` — the bag already snapshots name and icon,
   so history survives without the link.
3. Everything passed from the command line and then the app couldn't log in at
   all. A browser preflights any request with a custom header, and the
   functions answered `OPTIONS` with 405, so the real request was never sent.

Migration verified with 58 parity checks against the live original: entry
counts and multiplicity, per-person scores, lifetime totals, settled history
with results, letter timestamps unshifted, photo bytes downloading, every
furniture catalog id, and the pet-room layout byte-identical.

### Same day, after cutover

- **Change-password screen** (`设置 › 账号`). ServiceNow never had one, and the
  migration hands out temporary passwords, so one became mandatory. The bug
  worth knowing: changing a password revokes every session, so the token the
  request was made with dies the moment it succeeds — the app then reported a
  *successful* change as "wrong password", and changing twice in a row was
  impossible. The endpoint now returns a fresh session, and a wrong current
  password answers `403` so it can't be confused with an expired one.
- **Case-insensitive usernames restored.** GlideRecord ignored case, so a
  lowercase username had logged in fine for years; Postgres `=` does not, and
  that same login started reporting "account does not exist" after the
  cutover. Reported from a laptop.
  Matching case-insensitively is only half the fix — the synthetic Auth email
  is derived from the username, so it must be built from the *stored*
  spelling or the password check fails anyway.

---

## 2026-09-11 — Backups repointed, and a long-standing gap closed

The weekly job was still reading ServiceNow, which had taken no writes since
the cutover — faithfully archiving a frozen copy while the live data
accumulated **unbacked**. Given the PDI risk was the whole reason for moving,
that undid most of the point.

It now reads Supabase with a **service key, deliberately not a login**. A
scheduled job authenticating as a person was wrong three ways: it needed
somebody's password to set up, the session expired while the job runs weekly,
and Supabase revokes every session when a password changes — so the backup
would have silently stopped the next time either partner changed theirs. A
backup that quietly stops is worse than none, because you believe you have one.

**The gap that closed.** ServiceNow's `/bag` filtered to the caller's own rows
— correct for the app, quietly wrong for a backup, which therefore never
captured the other partner's items. At cutover, one partner's unredeemed
rewards had to be read off a screenshot because no export contained them.
Bypassing RLS with a service key means one run now captures both.

Two details kept: the read pages explicitly, because PostgREST caps a response
at 1000 rows and the entries table is past 500; and photo **bytes** are pulled
into the snapshot, because an archive of expiring signed URLs is not an archive.

---

## 2026-09-06 — Festival ambiance

Fireworks, confetti, hearts, lanterns, lights and boats per festival. That
year's 生肖 mixed into 春节's falling particles, and the 中秋 lantern garland
given a natural hanging sag rather than a straight line.

## 2026-09-03 — Seasonal stock and a layout fix

One new piece for each of the four sparse seasons, so an arriving season never
feels empty. Settle button stopped covering the score-card header.

---

## 2026-08 — 恋爱小窝, seasons, weather, and an accessibility pass

The month the pet game was built and then repeatedly corrected.

**Pet and room.** Pet raising (Phase 1), then decorating (Phase 2) with
free-form movable and resizable furniture, all drawn as SVG rather than emoji
so it follows the theme and stays sharp at any size. The room syncs between
partners live. Furniture is depth-sorted by position rather than by a hidden
layer number — the lower in the room, the nearer — because that is how a real
room works and it costs nothing to store.

**Seasons.** Seasonal themes that arrive on their own from the device clock,
with no scheduled job anywhere. 2026–2028 keepsakes pre-drawn so future years
are stocked in advance; a free watcher nags when a season is under-stocked
rather than trying to generate art unattended.

**Time, weather and place.** Theme, moon phase and weather all follow the
device's local time and location. Partners share weather through one slot
each, so simultaneous writes can't clobber each other. Where the weather comes
from became a user choice, because a city coordinate genuinely cannot answer
"is it raining at my window".

**Corrections that came out of real use.** No suns at midnight. 新年 stopped
swallowing 情人节. Only call it rain when rain is actually falling. Furniture
kept inside the room. The ⬆️⬇️ layer buttons stopped *moving* the furniture
they were meant to restack, and greyed out when they could do nothing. Unread
counts stopped lying. Network blips retry instead of reporting a scary error.

**Home page rebuilt** as a hero, two tiles and rows — measured first, because
each old row was wasting most of its width on dead space.

**Accessibility pass**, audited from rendered pixels rather than computed
styles, because three earlier computed-style checkers all lied. Found real
contrast failures including bottom-nav labels at 2.09:1.

**Backups.** A real backup path for the PDI (2026-08-11), then an `r41`
resource so one login could back up both partners (2026-08-19) — written, but
never deployed, which is why the split-bag gap survived until the migration.

---

## 2026-07 — Shop, letters, check-in, and the date bugs

**Features.** Shop and bag module. Daily check-in (签到) with a calendar, and
either partner able to check in for the other. Letters (情书) as sealed
envelopes. Light/dark theme with follow-device auto mode. Milestone reward
claims made per-character instead of shared.

**The date bugs, twice.** Entry dates showed a day behind for UTC+8 users, and
then purchase/use/claim dates did the same. Both had the same cause — the
server's clock was in a timezone behind the users — and the fix became a
standing rule: dates are decided by the phone and merely stored by the server.

**Settlement.** Fixed settle being blocked after a first settlement in the
same calendar month, and guarded it against an empty month.

**Caching.** `app.js` cache-busting, then a fix for the app never booting cold
under that loader, then a self-healing guard for stale `index.html` caches —
the beginning of the two-version scheme still in use.

---

## 2026-06 — First build

Initial app, character design and animations, and a long search for a workable
auth model against ServiceNow: shared service account, then named users, then
a custom `u_love_auth` table with a pair-code flow — which is the model that
survived, and which Supabase Auth replaced in September.

Much of this month is churn against ServiceNow's quirks: scoped table names,
column mismatches, emoji that wouldn't fit a `utf8mb3` field, and responses
arriving double-wrapped.

---

## Conventions

- **A bug fix names the symptom, not the file.** "Fix entries silently
  disappearing at month rollover" beats "fix query in r04".
- **Anything that bit us twice goes in `CLAUDE.md`,** not just here — that
  file is read before changing code, this one is read to find out what
  happened.
- **Versions** are stamped in `app.js` as `APP_VERSION` and shown in 设置.
  `HTML_V` there must match `app-html-v` in `index.html`, or a phone running a
  cached `index.html` against fresh JS renders a broken layout.
