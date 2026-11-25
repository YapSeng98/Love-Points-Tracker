# 恋爱积分簿 — Engineering & Design Rules

Read this before changing anything. Every rule below exists because something
actually broke in production and the user had to report it. Re-reading this is
cheaper than shipping the same bug twice.

---

## 0.0 🗄 The backend is Supabase (migrated 2026-09-11)

The app ran on a free ServiceNow PDI until 2026-09-11. It now runs on
**Supabase** — Postgres, Auth, Storage, Edge Functions. Everything under
`servicenow/` is **history**: the resource scripts there are the source the
port was made from, and are no longer deployed or called by anything. Don't
edit them, and don't take their field names as current.

```
app.js ── HTTPS ──► yvllstktmjoedfsgojgs.supabase.co
                     ├── /functions/v1/*   29 Edge Functions (supabase/functions/)
                     ├── Postgres          14 tables, RLS on all of them
                     ├── Auth              hashed passwords, JWT + refresh
                     └── Storage           "photos" bucket, private
```

**Table names dropped the `u_` prefix and the `u_love_` table prefix**:
`u_love_entry` → `entries`, `u_love_bag` → `bag`, `u_love_auth` → split into
Supabase `auth.users` + a `profiles` row. Columns likewise: `u_pts_cost` →
`pts_cost`. Two renames are not mechanical: `u_desc` → `description`
(`desc` is a reserved SQL keyword), and `bag.u_shop_item` split into
`shop_item_id` (uuid FK) and `decor_item_id` (text catalog id) because
furniture stores a catalog id where a purchase stores a row id.

**The JSON contract did not change.** Every function returns the same shape
its ServiceNow resource did — that is why `app.js` kept all ~30 call sites.
`snFetch` translates the old paths onto function slugs (`/entries/{id}` →
`entries-id?id=…`). If you add an endpoint, add the translation too.

Things that are now true and were not before:

- **Writes only happen inside Edge Functions.** RLS is `SELECT`-only for
  clients on every table, so a session token cannot write to Postgres
  directly. Functions use the service-role key and bypass RLS — which means
  **the function is the only thing enforcing a business rule**. There is no
  second line of defence; if a check is missing there, it is missing.
- **Access tokens expire** (~1h) where the ServiceNow key never did.
  `snFetch` refreshes once on a 401 and retries. Anything else talking to
  the API needs the same, or it dies after an hour.
- **Changing a password revokes every session.** Any endpoint that changes
  one must hand back a fresh session, or the caller is logged out by its own
  success. See `auth-password`.
- **Usernames match case-insensitively** — GlideRecord did, Postgres `=`
  does not, and a lowercase login started reporting "账号不存在". Look up
  with `ilike`, and build the synthetic Auth email from the **stored**
  username, never the typed one.

---

## 0. The two questions to ask before writing code

1. **Is this logically correct for BOTH partners?** This is a two-account app.
   Every feature must be reasoned about from *each* person's screen, not just
   the one you're imagining.
2. **Would this feel good to actually use?** The user cares that the app is
   attractive and doesn't feel boring. "It works" is not done. Sizing,
   spacing, motion, and copy are part of correctness here.

---

## 1. 💥 Recurring bug patterns (each has bitten us more than once)

### 1.1 Generic CSS class names collide — ALWAYS scope
**Happened four times.** Bare, short class names in a single global
stylesheet silently apply to unrelated components.

| Incident | Symptom |
|---|---|
| `.sun` (ambient sky) vs `.cal-cell.sun` (Sunday) | Sunday cells grew rotating sun rays and flew out of the calendar grid |
| `.c1`/`.c2` (clouds) vs `.dot.c1` (pet legend) | A blue ball drifted across the screen every 22s |
| `.star` | Same family of risk |
| `.bdf-back` (prep-sheet back button) vs a crown modifier | YY's birthday crown shrank to 19px and floated off her head — a *prefixed* name still collides inside its own feature; grep before naming a modifier |

**Rule:** any decorative/ambient class MUST be scoped to its container
(`.sky-bg .sun`, `.clouds-bg .c1`). Never introduce a new top-level class
shorter than ~6 characters or named after a common concept (`sun`, `star`,
`dot`, `c1`, `box`, `row`).

**Detection:** the layout tests scan every element for unexpected inherited
animations. Run them after any CSS change.

### 1.2 `::after` / `::before` paint ABOVE sibling elements
The room floor was a `::after` on `.pet-room`, so it covered the pet's legs
**and swallowed taps** — poking the pet silently did nothing.

**Rule:** any decorative pseudo-element layered over content needs explicit
`z-index` AND `pointer-events: none`.

### 1.3 Overlay z-index must beat the page underneath
A modal opened from a full-screen page (z-index 90) was invisible because the
default modal z-index is 80.

**Rule:** modals opened from `.shop-page` / `.letter-page` / `.pet-page` need
an explicit higher `z-index` inline.

### 1.4 Toasts stole taps
`.toast` sat at z-index 200 for 2.5s and blocked buttons underneath.

**Rule:** anything purely informational gets `pointer-events: none`.

---

## 2. 📅 Dates are client-authoritative — never compute them server-side

The ServiceNow instance ran in a timezone **behind** the users (UTC+8), so
`new GlideDateTime().getLocalDate()` was *yesterday* for most of their day.
This shipped a bug where purchases were dated one day early.

Supabase runs in UTC, which is the same hazard wearing a different hat: an
entry logged at 01:00 in Singapore is still "yesterday" to the server. The
rule did not change with the backend and must not be relaxed because the
new one "looks" more correct.

(The one deliberate exception is the sealed 周年悄悄话 — §7.258.)

**Rule:** the app sends its own local `date`/`month` in the request body;
the function only falls back to the server clock when the client omits it.
`clientDate()` in `supabase/functions/_shared/util.ts` is the one
implementation — use it rather than writing the check again. Applies to:
`entries`, `shop-buy`, `bag-use`, `bag-claim`, `letters`, `photos`,
`decor-buy`.

Use `todayStr()` / `monthKey()` in `app.js`. **Never** `toISOString()` — it's
UTC and rolls a day early for UTC+8 users.

---

## 3. 🗓 Entries are scoped by "unsettled", NEVER by calendar month

`month` is a *label*, not a filter.

The original `GET /entries` filtered `month == current month`. The moment
the real-world month rolled over without a 月末结算, an entire month of
entries became invisible and the score silently reset to 0 — the user thought
their data had been deleted.

**Rules:**
- `entries` (GET) returns everything with `monthly_id` NULL. No month filter.
  The partial index `entries_unsettled_idx` is built for exactly that query.
- Score-sum queries in `shop-buy` and `bag-claim` must match, or a purchase
  the UI shows as affordable gets rejected as "insufficient points". Both now
  call the single shared `unsettledScore()` in `_shared/util.ts` — it was
  made shared *because* two copies of this rule are what drift apart.
- Settling stays per-month: the frontend groups entries by their own `month`
  and calls settle once per group, so a missed month becomes its own history row.
- **Never auto-settle the current, still-running month.** Past months are swept
  automatically; the current month is opt-in via a checkbox, default OFF when
  there are older months pending.

### 3.1 The month label is DERIVED from the date — never a second input

Reported 2026-10-01: four entries dated 9/30, logged on 10/1, were left out of
September's settle. `submitEntry` sent `month: S.month` ("the month right
now") beside the date the couple picked, so they were labelled October — and
settle archives **by label**. The label was a second source of truth for a fact
the date already holds.

- `clientDate()` returns `month = date.slice(0,7)` whenever a date is present;
  `entries` POST uses it, and `entries-id` PUT moves `month` with `date`.
- Before this, an entry posted without `month` was stored with an **empty**
  label, which no settle could ever find — while the settle answered
  `alreadySettled` and the app believed it. Nothing in the app hit it; the
  suite did.
- A month can therefore be settled more than once (a 补记 after its first
  settle). That is legitimate: count months as `new Set(rows.map(r=>r.month))`,
  never `rows.length` (pet EXP is 结算月数×100, the 坚持 badges are months), and
  sum rows per month with `+=`.

### 3.2 A settle archives exactly what the phone counted

The stored totals are added up on the phone; the archive is the server's
pending set. If they differ, points vanish silently. So:

- The app sends `seen: [[id, pts, char], …]`; `monthly-settle` answers **409
  stale** unless it is exactly the pending set, and writes nothing. The app
  refreshes and reopens the preview.
- The archive UPDATE carries `.is("monthly_id", null)`; a concurrent second
  settle claims zero rows and deletes its own history row (detach first, then
  delete). Verified with four simultaneous settles × ten rounds.
- A settled entry is read-only (`entries-id` → 409 `settled`).
- `/history` is not capped — everything that sums it needs every row.
- Each `/entries` row carries `settled`; 年度回顾 uses it rather than guessing
  from "this month has a history row".

`tools/settle-test.js` replays all of it in a browser (mocked server for the
409 path); `supabase/test-full.mjs` § "settle — month follows the date…"
attacks the live functions.

---

## 4. 🐣 Derived-state rules (badges, recap, pet)

Prefer **deriving** state from existing data over storing it — it can't drift,
and it needs no schema migration. But watch these traps:

1. **Monotonic values need a stored floor.** Pet EXP is derived, but
   punishment-mode settlements archive negative totals and deleting a photo
   claws back its EXP — both would shrink the pet. Solution: store a
   high-water mark that the server refuses to lower.
2. **A "starts from zero" feature needs a baseline snapshot.** The pet stores
   `pet_base` at adoption so it doesn't inherit months of history and hatch
   at max level.
3. **Settlement empties `/entries`.** Anything derived from recent entries
   (e.g. pet mood) collapses the instant a month is settled. Mood counts a
   recent `settledAt` as activity to compensate.
4. **A "sad/empty" state must be reachable.** Pet mood had a baseline of 30
   but the sad threshold was 20 — the entire come-back-and-play mechanic was
   dead. Check that every state in a state machine can actually occur.
5. **Rebase EVERY value derived from a number you rebase.** `pet_base` made
   pet EXP start at 0, but 小窝币 was still computed from the *raw* lifetime
   score — so the screen showed `EXP 0` and `🪙 691` side by side. When you
   introduce a baseline, grep for every reader of the pre-baseline value.
6. **Resetting one side of a ledger creates hidden debt.** Re-adopting reset
   EXP (and therefore coins *earned*) to 0 while the *spent* total still
   counted every piece of furniture ever bought. A room furnished for 300
   coins silently owed 600 EXP before a single coin reappeared, with nothing
   on screen explaining the wait. Reset both sides together, or forgive the
   other side explicitly (`eq.sf`).

---

## 4.4 🎁 Year-locked keepsakes — how the room stays new without a job

Each big festival gets one piece tagged `year: 2026` on top of the pieces that
return annually. It is on sale **only in that year**; miss it and it is gone,
buy it and you keep it forever. That is what makes the room a memory box
rather than the same five things every December.

Crucially this is how "new stuff every year" happens **with no scheduled job
and no API**: future years are *drawn ahead of time* and sit dormant in the
catalog until their own year. 2026/2027/2028 are stocked. The art is reviewed
once, now, instead of trusting an unattended generator later — which matters,
because 3 of the first 21 drawings had to be redrawn and every test passed on
all three.

`season-check.js` therefore watches the **keepsake runway** the same way it
watches `LUNAR`: fewer than 2 years pre-drawn *fails* the monthly job.

---

## 4.6 🔑 The saved room stores CODES, not ids

`pet_equipped` holds a two-letter `k` per piece, never the id. Ids are
readable (`mooncake_box_27`) but average 11 characters, and at 32 pieces they
alone cost **349 of the 1000** the field allows — a fully furnished room hit
**939/1000, 6% spare**, which two more years of keepsakes would have pushed
into silent truncation. Codes took the same room to **651/1000**.

- `k` is **explicit in the catalog and must never be reassigned** — it is the
  only link between a saved room and its furniture.
- `parseEquipped` accepts a code *or* a bare id, so rooms saved before codes
  existed keep loading; they convert on the next save.
- An unknown code is preserved verbatim, never guessed at.
- Ids stay untouched because the `bag` rows reference them (`decor_item_id`).

---

## 4.5 🗄 Fixed-size fields vs. unbounded user content

> **The constraint is gone; the lesson is not.** Postgres `text` is unbounded,
> so none of the specific limits below still apply. Kept because the failure
> mode — content that grows without bound written into storage that has a
> ceiling — recurs anywhere there is a cap, and because it explains why the
> room is still encoded compactly (§4.6) and why `saveEquipped` still
> validates. Read it as "why the code looks like this", not "what to check".

`u_pet_equipped` was `String(1000)`. It was sized when the room had fixed slots
and the design doc promised "<200 chars, safe". Then free placement added
`x/y/scale` per piece and the catalog grew every season — the verbose encoding
hit the ceiling at **21 items**, and ServiceNow **truncates silently**, which
fed `parseEquipped` invalid JSON and reset the couple's entire room to the 3
starter pieces. Total, silent data loss.

Whenever user content accumulates into a fixed-size field:

1. **Encode compactly.** `"id,x,y"` (scale omitted when it's 1) costs ~21
   chars vs ~45 for `{"i":…,"x":…,"y":…,"s":…}` — capacity 21 → 36 items.
2. **Guard before mutating.** `placeDecor` refuses the piece *before* it lands
   in the room, so nothing appears that would vanish on the partner's refresh.
   `saveEquipped` returns `false` rather than letting the field truncate.
3. **Salvage on parse failure.** `salvageEquipped` regexes out every complete
   record, so a truncated blob loses the tail — never the whole room.
4. **Budget against catalog GROWTH, not today's size.** "It'll always be
   small" is how this bug was born.

---

## 4.6 🖼 Every icon needs a fallback — and a reserved column

The 穿戴 shop tiles rendered as blank grey boxes: outfits carry neither an
`art` emoji nor a colour swatch (they're SVG drawn onto the pet), so they fell
through `decorArtHtml`'s final `#DDD` default. You could not tell 派对帽 from
小红围巾 except by reading the name.

Sweeping for the same shape found a second one: a reward or punishment saved
without an icon rendered `.tier-icon` at **zero width**, knocking that row out
of line with every other row.

**Rules:**
- Every `${…icon}` interpolation of *user-editable* data gets a `|| 'default'`.
  Categories/entries `📌`, rewards/shop `🎁`, punishments `⚠️`, goal `🎯`.
  Icons from a hardcoded internal table (achievements, species) don't need one.
- Icon containers get a `min-width`, so an empty one still holds its column.
- A preview must show the *real thing*: wallpaper renders its actual gradient,
  floors composite their semi-transparent tone over an opaque base (painted
  straight onto the card they washed out and looked identical), and outfits
  draw the actual SVG on a little head.
- `icon_sweep.js` walks 19 screens × both themes and fails on any icon element
  that has no text, no background and no child `svg/img`. Extend the screen
  list whenever a new screen is added — 奖惩表 was missing from the first
  version, which is exactly why the tier bug survived it.

---

## 5. ⚡ Performance: never refetch photos casually

`GET /photos` returns full base64 images. Pulling them on every home refresh
re-downloads **megabytes on mobile data**.

**Rules:**
- History (small summaries) may refetch freely.
- Letters and photos load once per data source; cached in `S`.
- Only views that report exact counts (badges, year recap) force a reload.
- **Invalidate the cache in `Data.init()`** — `boot()` runs a refresh *before*
  login, which otherwise latches the cache on an empty dataset for the whole
  session.

---

## 6. 👫 Two-account correctness (test both sides, always)

Classify every piece of data explicitly:

| Shared — must be byte-identical for both | Per-person — must differ |
|---|---|
| config, mode, targets, names | bag / bag history |
| entries ledger, categories | milestone claim flags (`claimed_1/2`) |
| rewards & punishments lists | the character you're scoring for |
| history, shop, letters, photos | |
| shared goal, pet (name/species/EXP) | |
| 我们的家: house level, garden, album (`game_saves`) | who watered a pot today (one bit each) |
| | game progress — 一起回家 levels/stars/times, levels paid, 接零食/翻牌 records (`game_saves` 'play', a slot each: the partner may read, only the owner writes) |
| | where each of you stands in the house (live only) |

Anything shared is scoped by `match_id`; anything per-person also by `char`.
Cross-couple access must return 404 or an empty list — never another couple's
data. Section 26 of the test suite enforces all of this.

**"Who am I" is the login — `_me()` — never `S.activeChar`.** `S.activeChar`
is the home page's *whose-points* switch, and tapping the partner's portrait
to add points for them flips it. Points, claims and check-ins follow the
switch on purpose. Authorship does not: with the switch on the partner, a phone
wrote its weather into the partner's `wx_` slot, showed its own weather as
theirs, and stamped letters and photos as written BY the partner — who then
found a letter "from herself", while the writer could unseal it and use up
her 未拆. Found 2026-10-27 from one wrong line on a weather card; the
birthday and the anniversary film had made the same mistake earlier.

The server now takes the author from the **session**, not the request
(`letters`, `photos`), and `letters-id` lets only the writer rewrite or
delete a letter and only the other partner open it. `tools/identity-test.js`
replays all of it on the live backend with the switch flipped. Any new
"mine/theirs" or "written by" goes through `_me()` in the app and
`caller.charId` in the function.

---

## 7. 🎨 Design rules

- **Size things relative to each other, never in absolute px.** Room furniture
  is `calc(var(--pet-h) * ratio)`; hardcoded 30–40px made a room of toys.
  See `docs/PET_GAME_DESIGN.md` §4.1.1 for the ratio table.
- **Ground floating objects.** Anything on a surface needs a drop shadow or it
  reads as a sticker.
- **Both themes, every time.** Light and dark are both first-class. Check any
  new surface in both; the pet room needed its own dark palette.
- **Respect `prefers-reduced-motion`** for any new animation.
- **Vector, not raster.** Characters and furniture are SVG — a few KB, sharp at
  any size, animatable, nothing to host. Photos are only ever *user* content.
- **Distinct silhouettes.** Four pet species all looked identical because their
  ears were drawn behind the head. If variants share a body, the difference
  must be visible in the outline.

---

## 7.1 🪑 Furniture art

Pieces are **hand-drawn SVG**, not emoji. Emoji render differently on every
platform, can't follow the theme, and sat next to the pet's own vector art
looking like a sticker sheet.

- One shared language: soft fill, a darker outline of the same hue, one white
  highlight, and a `0 0 100 100` viewBox so the `ratio` table keeps sizing
  everything. `_ds()` wraps it; `.decor-svg { width:1em }` means the room's
  `font-size: calc(var(--pet-h) * ratio)` math is untouched.
- `art` (emoji) stays on every item as the fallback, and the shop/room both
  prefer `svg` when present.
- **Draw it, then look at it at real size.** The first pass shipped a bed that
  read as a fragment, roses that read as a lollipop, and a zongzi that read as
  a tent. None of that shows up in a passing test — only in the art sheet.
- `artsheet.js` renders the whole catalog on one page. Regenerate it after any
  art change and actually look.

## 7.15 🌗 Time of day, moon phase and weather

The whole app follows the **device** clock — `html[data-theme]` and
`html[data-period]` (`morning|day|dusk|night`) are both stamped pre-paint in
index.html so there is no flash, then kept in sync by `applyTheme()` and a
60-second tick that catches the app being left open across a boundary.

- Default mode is `time`: 夜晚 turns dark on its own. `light`/`dark`/`auto`
  remain in 设置 as overrides, and **period is stamped in every mode** — a
  forced-light night still shows the moon, and 黄昏 is a light theme that must
  show a low sun, not a midday one. Gate sky art on `data-period`, never on
  `data-theme`.
- **The moon is the real moon.** `moonInfo()` uses the mean synodic month from
  a known new moon, so it is a full disc on 农历十五 and dark on 初一, and
  unlike `LUNAR` it never runs out of years. Verified against the 15 festival
  dates the app already knows (中秋 99–100% lit, 春节 0%).
- **Weather** comes from Open-Meteo, located by **device timezone** — no GPS
  prompt for a decoration, and it follows you when you travel. Cached 20 min.
  Every failure path is silent: offline or blocked just leaves the app exactly
  as it looks today.
- Furniture is **never** changed by time or weather — only by what the couple
  bought. Seasons change light, sky, wall/floor tint, the window and the pet's
  lines; a bought wallpaper always beats the seasonal one.

Two bugs worth remembering, both invisible to green tests:
1. **A test that encodes the implementation's own convention proves nothing.**
   The moon shipped inverted (new moon drawn as a full disc) and the test
   passed, because it asserted the sweep flag rather than what was lit. It now
   asserts via `isPointInFill` — actual lit geometry.
2. **`translate` percentages resolve against the element, not the parent.**
   Window raindrops moved 150% of their own 11px and never crossed the pane.

---

## 7.16 👀 Telling the couple something changed

Seasonal stock appears and vanishes on its own, so without a nudge a whole
festival can pass unnoticed.

- **Name a drop after the FURNITURE's season, not the current theme.** 中秋
  stock opens 09-05 but the 中秋 theme only starts 09-21 — for two weeks the
  card announced 「秋来啦」 over a tray of mooncakes.
- **Seed the "seen" baseline on first run.** `decor_seen` starts as everything
  currently in stock, otherwise an existing couple updates and meets 18 NEW
  badges at once, which makes the badge meaningless. Only stock that appears
  *later* is new.
- **Mark seen on the way OUT of the shop** (`closeDecor`), never during
  render — marking while rendering clears the badge in the frame it appears.
- Limited pieces carry a 下架 countdown; "还有 16 天" counts the last day as
  still available.
- These markers are device-local and deliberately NOT synced: each partner
  deserves their own heads-up.

## 7.17 🌦 Sharing weather between partners

`wx_1` / `wx_2` — **one slot per partner**, each phone writing only its
own. A single shared blob would let two simultaneous writes lose each other.
Payload is `{"k":kind,"h":localHour,"at":epochMs}`; entries older than 3h are
ignored so a partner who hasn't opened the app shows nothing rather than
stale sun. Weather is display-only and stays out of `_roomSig()`, so a change
in the weather can never raise a false 「对方改了小窝」 banner — verified with
two partners in different cities in `split_weather_test.js`.

---

## 7.21 🤖 What can and cannot be automated about seasonal content

Three separable problems. Only two of them a schedule can solve.

| | automatable? |
|---|---|
| Knowing a festival is coming | **yes** — `tools/season-plan.js`, free |
| Shipping it without a deploy | yes, if the catalog moves to JSON (not done) |
| **Producing art that looks good** | **no** |

The third is the one that matters. Of the twenty-one pieces drawn by hand,
**three had to be redrawn** — a bed that read as a fragment, roses that read
as a lollipop, a zongzi that read as a tent — and **every automated test passed
on all three**. `art_verify.js` checks viewBox, shape count, no NaN, correct
in-room sizing; none of that can tell you a drawing is ugly. It was only caught
by rendering `artsheet.js` and looking.

So generation may be automated one day; **approval may not**. Any future
drafting step must open a PR with a rendered art sheet, never merge itself.

The shipped workflow is deliberately the free half: GitHub-official actions
only, built-in `GITHUB_TOKEN`, no API keys, no third-party actions. It opens
**one issue per season** (deduped by label + title) when a festival is within
45 days and under-stocked, with the exact sentence to paste to Claude. Runs on
the 1st and the 15th so a 45-day lead is never straddled by a monthly gap.

---

## 7.2 🗓 Seasonal content has no scheduled job — on purpose

`currentTheme()` reads the device clock, so 中秋/圣诞/新年 arrive by themselves
with nothing running anywhere. Two things still rot quietly, and
`tools/season-check.js` (monthly GitHub Action) watches both:

1. **`LUNAR` runs out.** Past its last listed year, `_themeActive` returns
   false and the lunar festivals silently stop happening — no error. Currently
   covered to **2030**. This *fails* the job.
2. **A season with one piece of furniture** feels empty when it arrives (中秋
   shipped like that). This only *reports* — it's a backlog, not a breakage.

The job needs no laptop. It cannot design furniture — that still needs a
conversation.

---

## 7.23 🌙 A season is not a time of day

夏's particle was `☀️`, so at 21:45 little suns drifted through a pitch-dark
room while the window correctly showed the moon. A theme describes the time of
*year*; anything in it that implies time of *day* needs a night variant.
`themeParticle(th, d)` returns `nightParticle` after dark — summer gets
fireflies `✨`. Every other particle (leaves, snow, hearts, lanterns, 红包)
reads fine at night and is unchanged. Dusk keeps the sun; it is still setting.

**Overlapping festivals: the narrower window should win.** Chasing the above,
情人节 turned out to be swallowed by 新年 in **2027, 2029 and 2030** — the CNY
window is 15 days (`span:[-2,12]`) and 2/14 lands inside it, and both sat at
priority 10 where the first one listed wins. For a couples app that is the
wrong trade, so 情人节 is priority 12 over a tight 3-day window (02-13→02-15):
it takes the days that matter and hands the rest of the fortnight back to 新年.
When adding a festival, check it against every other window in the table
rather than only against the ambient seasons.

---

## 7.235 🎆 烟花 are drawn, not styled

Asked for 2026-11-17: the fireworks were six box-shadow dots scaling up and
never read as fireworks. `_fireworksStart()` draws them on one canvas in
`.home-fest-layer`: a shell climbs on sparks and bursts into stars thrown out
as a **sphere seen from the side** (dense rim, sparse middle — a flat circle of
evenly spaced dots is what made the old one look like a loading spinner), which
slow, sag, twinkle and die. Peony, two-colour, ring, gold willow, crackle, and
a heart on the couple's days.

- 跨年, 春节 and 周年 get the full show (周年 in pink and gold, hearts among
  them — the user called 12-24's fireworks the most important thing in the
  app); 情人节 a slower one, since it already has its big heart.
- **Night only, by `data-period`** (§7.15) — by day the loop idles on a 1s
  timer and confetti stays the hero. Light adds up (`lighter`) on a dark sky;
  on a forced-light night that washes out to white, so it paints `source-over`.
- **Trails come from fading the canvas, not clearing it** (`destination-out`),
  so the canvas stays transparent and the moon shows through. It is cleared
  outright once idle: an 8-bit fade never quite reaches zero.
- It lives and dies with the festival layer — no canvas and no loop on an
  ordinary night — covers only the top 52% (the rest of the sky is behind the
  cards), and takes no taps.
- Reduced motion keeps the five still dots and starts nothing.

### Shared: one taps, the other sees it

On a firework night, a tap on the open sky launches a shell where the finger
was — and the partner's phone draws **the same one**. What travels is five
numbers: place (as fractions of the sky, since the phones differ in size),
colour, kind, and a seed; each phone grows the identical shell from them
(`_seeded`). Nothing is stored anywhere.

- **The couple's live channel** is Supabase Realtime Broadcast on a *private*
  channel, `couple:<match id>`, spoken over a plain WebSocket (no library).
  Two policies on `realtime.messages` (`supabase/sql/2026-11-17-live-channel.sql`)
  let a session join, hear and send only on its own couple's channel. The
  *public* door to the same topic name is a different channel that anyone can
  use — which is exactly why nothing of ours does.
- It is open **only while a show is on screen**, closed in the background, and
  silent when it fails; an ordinary night opens no connection at all. A refused
  join refreshes the access token once (they last an hour, §0.0) and retries.
- **Never trust the wire**: a place outside 0–1 or an unknown kind is dropped.
- Only empty sky counts: the title row, the open edges of 首页's couple card
  and the gaps between cards (§7.36). Portraits, the days, ♫, ⚙️, the mode
  switch and anything behind an open sheet keep their own taps.
- Found building it: **the sign-in path never called the session-up hook**
  (`flushWeather`) — register and a resumed session did. So after a fresh
  sign-in the weather held at module load (§7.215) waited for the next
  20-minute refresh, and the channel had nothing to open it. Every "the session
  is up" consumer now hangs off that one hook, called from all three paths.

`supabase/test-live.mjs` attacks the channel (no login, another couple's login,
a made-up id, the public door); `tools/fireworks-live-test.js` logs two phones
in and checks the same shell arrives both ways, on different screen sizes.

`tools/season-test.js` §6b reads the canvas pixels back: lit at night in both
themes, dark by day, absent under reduced motion and on ordinary nights.

## 7.28 🎃 秋 · 万圣节 — and what drawing it turned up

Added 2026-10-02 because the shop had **nothing limited for two months**:
中秋 left on 10-05 and 圣诞 arrived 12-05, and no check noticed, because every
season that existed was fully stocked. Now 秋 (10-06 → 11-30, 3 pieces) and
万圣节 (10-12 → 11-02, 5 pieces + the 2026 南瓜小屋 keepsake + 小巫师帽), with
a 万圣节 theme for 10-26 → 11-01.

- **`season-check.js` now reports stretches with no limited stock** (≥30 days,
  backlog only). Next one: **06-26 → 09-04** — summer needs a set before June.
- **Name the drop card after the NEWEST drop, and count only it.** Two drops a
  week apart are both "new" if the shop wasn't opened in between, and the
  card announced the Halloween drop as 「秋限定上架 · 9 件」.
- **Bats imply night** (§7.23 again): they fly across the home sky only at
  dusk/night. The falling particle is candy — a bat tumbling and spinning down
  the room reads as a dead bat.
- **The art sheet caught one drawing**, as it always does: the bat garland was
  a smudge at its real 62px, and near-black bats vanished on the night room.
  Widened to 0.5, bigger bats, dusky purple `_bat()`.
- **A 3-character festival broke the pet header.** The mood chip took ~180px
  of a 390px phone, so 「Lv.5 · 圆满期」 wrapped during 情人节/万圣节 and a
  5-character pet name wrapped every day. The chip now stacks season over mood
  (~105px).
- `season-plan.js` reported 圣诞 as 12-10 (first piece's window, not the
  union), counted future years' keepsakes as stock, and called an open season
  "338 days away". All three fixed.
- `salvageEquipped` dropped every re-stacked piece: its pattern had no slot
  for the signed 5th field (`z`, §7.245).

`tools/artsheet.js` renders the catalog (big + true in-room size, both themes),
a furnished room at day/dusk/night, and the shop tabs. `tools/season-test.js`
walks the calendar: 38 theme boundaries through 2030, the stock calendar, the
drop cards replayed visit by visit, and every festival rendered without errors.

## 7.29 💞 周年 — the couple's own day, and its gift

Added 2026-10-02 for 两周年 on 12-24 — which is also 圣诞's busiest day.

- **Theme `anniv`, priority 15**, above every festival. It is not a MM-DD row:
  `_themeActive` asks `annivOccasion()` (§7.257), so it follows `start_date`,
  also covers every 1000th day (「一千天」), and is simply off while no start
  date is known. `currentTheme()` fills in the name (「两周年」), the number
  for the sky and the first speech line.
- **A theme that depends on the couple needs the config first.**
  `applyTheme()` runs at module load, before login, and after that only on a
  new hour band or a new day — so on 12-24 the home sky would have stayed 圣诞
  for hours after logging in. `refresh()` now re-applies it. Anything else in a
  theme that reads `S.*` has the same dependency.
- **周年礼物** (`anniv: n`) is free and on the shelf for 8 days from the Nth
  anniversary. The window is derived from `start_date` (`_annivGiftWindow`,
  same 2/29 rule) — never a MM-DD in the catalog, which would be a second copy
  of the date (§3.1). Not `free: true` either: that flag means "always owned",
  which would have hung the frame in every room, years early.
- **One frame a year**, drawn by `_annivFrame(n)`: same gold frame and heart,
  a new ribbon and number. Drawn through 四周年 (2028). `season-check.js` fails
  when fewer than two years are drawn; it needs `START_YEAR`, the one fact the
  repo can't derive.
- **A gift has its own `spot`**, centred on the wall above the pet, with later
  years flanking it. The placement grid knows nothing about the window and hung
  the first one straight over it.
- **The shop sorts 🆕 first, newest drop first, and the season card opens the
  shop on its piece's tab.** The gift sat last on 墙面, below the fold, behind
  whichever tab was used last — and behind 圣诞's pieces for anyone who hadn't
  opened the shop since that drop.
- **The seen baseline (§7.16) is seeded on the first open**, in
  `renderSeasonCard`, not lazily at the first `isNewDecor` call. That call
  only happened on the first day with limited stock, so a phone first opened
  on 12-03 (nothing seasonal on sale) seeded it on 12-24, with that day's
  arrivals in it. A 周年 gift is never part of the baseline: a present gets
  announced even on a phone that is set up on the day.
- **Home sky:** a gold foil 「2」 with a small bunch of balloons, placed in px
  from the centre. Spread across the width by %, they sat on the title and
  behind ♫/⚙️. At 360px there are 18px between the title and the 「2」.

`tools/season-test.js` §8 covers all of it: the calendar (other couples, 2/29,
no start date), the shelf, the card → shop → claim path, placement, midnight,
reduced motion, and 360/390/820.

## 7.30 🎂 生日惊喜 — the phone decorates the day, the server opens the film

Built 2026-10-27. Both birthdays live in 设置 (month and day; an optional year
turns on 「第 N 个生日」). From 14 days before, ONLY the partner's phone shows a
card to prepare a letter (≤800), one 生日券 (it lands in the birthday
person's 背包 as `source_type 'gift'`), 3–12 photos and an optional
night-before teaser. All of it is sealed in `surprises` (RLS on, no
policies) behind the `surprise` function, opening at 00:00 in the writer's
zone — the 悄悄话 rule (§7.258).

- **Two clocks.** The phone's date drives decorations only: the `bday` theme
  (priority 16, worded per viewer — 「生日」 on your own phone, 「YY生日」 on
  the partner's), the bunting, crowns on the portrait and the pet, the cards.
  The FILM, and its "watched" flag, only start once the server answers
  `day: true`. A phone date moved to the birthday shows the bunting and
  nothing else, and uses nothing up — the first draft let the app's own
  cake-and-candles part play by the phone's date, which would have marked the
  day as watched and skipped it on the real day.
- **Who am I is the login**, `_me()` = `sn_char`, never `S.activeChar`: that
  is also the home page's "whose points am I adding" switch and can point at
  the partner. The 悄悄话 card and the anniversary film had the same mix-up.
- **The whole day.** The film plays once per phone, then docks as a 🎂 tab on
  the screen edge: tap = replay (after asking the server again), drag = it
  snaps to the nearer edge. It settles only where no SMALL control is
  (buttons under 60% of the width, the nav, 月末结算), checked with
  `elementFromPoint` so controls on hidden pages don't count; overlapping a
  big card's edge is fine. Gone the next day; past ones replay from
  「我们的时光」 (`GET ?list=1`).
- **Opened exactly once.** The opening is a conditional update on
  `opened_at` (the settle trick, §3.2) with the coupon inserted in the same
  step and the opening given back if that insert fails. Three simultaneous
  opens give one coupon.
- **Never over someone typing.** A modal or a focused input at 00:00 glows the
  tab instead; `closeModal` plays it. The anniversary film plays first on a
  shared day. A precise timer fires at 00:00 when tomorrow is your birthday,
  and a phone a few seconds ahead of the server retries for the first minute.
- **Nothing prepared still gets a birthday**: the app's own five scenes, and
  no screen ever says 「对方没写」. The photo heart fills the shape's key points
  first (tip, both lobes, sides), so 3 photos already read as a heart.
- Demo mode runs the function's rules on the phone clock (`_bdayDemo`) so the
  real UI is tested end to end — keep the two in step.
- The bag now escapes item names and looks an item up by id for 使用: a
  coupon title is the couple's own text and can contain quotes.
- **The song is 「生日快乐歌」 as a music box, built from code**
  (`tools/make-birthday-song.js` → `happy-birthday-musicbox.m4a`). The
  melody is public domain; every recording of it is someone's performance and
  this repo is public, so nothing is downloaded. ~56s, it loops, and it starts
  at the candle tap (sound needs a tap). Phone speakers drop everything under
  ~250 Hz, so the bass carries its own harmonics. It was checked by decoding
  the file and reading the pitch at each onset back as the tune — read the
  note that STARTS there (energy after minus before): plain loudest-pitch
  picked up ringing notes and the chords' harmonics and misread six notes.
- **A crown sits on the drawn head, and moves with it.** The first one was
  placed against the portrait's *box*, which is 31% air above the head, and
  stood still while the portrait bobs ~20px (`char-idle`) — on the live site it
  floated a head's height above YY. It now rides a layer the size of the
  portrait running the same animation and delay, with its band at the head
  line (y 41 of 132). YY's sits behind her bow; an uploaded photo has no
  bow and no air, so its crown sits on the top edge. Only a live screenshot
  showed it: every test passed, because they asked "is there a crown" and
  never "is it on the head".

`tools/birthday-test.js` walks it on a faked clock, both phones, every scene
at 360/375/390/430/820 (overflow, button size, thumb reach, font size), the
tab at four widths, typing at midnight, the moved-date case against a mocked
server, and replay. `supabase/test-surprise.mjs` attacks the live function.

## 7.31 ✨ 新外观 (ui3d) — the default look; 经典 is a per-phone choice

Added 2026-11-15 after a full UX walk of every screen, behind a per-phone
switch; made the **default** the next day because the user asked that nobody
should have to switch it. It is a soft-3D and motion layer over the same
screens. 设置 › 外观风格 › 经典 (or `?look=classic`) turns it off for that phone
only — stored in localStorage `look`, never synced — and `lookMode()` treats
anything but a stored `'classic'` as the new look. A prototype was approved
first, built on a snapshot of the real screens, so the decision was made
looking at the app rather than a mock.

**Why the switch looked broken on the user's phone:** an iPhone home-screen
icon runs as its own web app with its own storage, separate from Safari, so
opening `?look=ui3d` in Safari or from a chat never reached the icon. Checked
in WebKit (`~/Library/Caches/ms-playwright/webkit-*/pw_run.sh` — this
playwright-core expects a different build, so pass `executablePath`): link,
reload and the 设置 switch all worked. A per-device setting that is meant for
everyone should be a default, not an instruction.

- **One switch, one stylesheet.** `ui3d.css` holds every rule, all under
  `html.ui3d`, loaded by app.js as `ui3d.css?v=APP_VERSION` only when the look is
  on. The ui3d block in app.js adds only what CSS can't (the ＋ button and its
  sheet, the 月末结算 chip, the nav pill, tilt, the room's light, count-ups);
  everything it inserts carries `data-u3d`, so turning it off removes it all —
  `ui3d-test.js` §6 asserts zero leftovers.
- **Depth from light, not borders:** a top highlight and a coloured shadow on
  every surface, a slow aurora behind the app, clay shading on the portraits
  (an SVG lighting filter, `#u3d-clay`), a raised 3D number on the hero. Only
  transforms and opacity animate; the one blur is the nav bar.
- **UX changes ride the same switch:** ＋ in the middle of the bar (the most
  used action was 1.5 screens down), 月末结算 moves from the floating button that
  covered 签到 every day into the score card (glows when a past month is open or
  in the last three days), ✏️🗑️ appear when a row is tapped (40×40, not 27×33),
  quick-score tiles half the height, 设置 only on the ⚙️.
- **The ＋ sheet is multi-select and saves through `quickEntries()`**, the
  tiles' own path (`quickEntry(id)` is `quickEntries([id])`), after
  `selectChar(who)` — each row is exactly what a tile would have made, so §3's
  month and date rules hold with no second copy. Tiles toggle; picks survive
  switching 加分/扣分 and each tab carries a count of its picks, because a pick
  you can't see is one you save by accident. Nothing is ticked on opening for
  the same reason. All rows are sent together, every one is tried
  (`allSettled`), and the toast says how many failed — one refresh at the end,
  not one per row (§7.4).
- **Parallax never moves a decor piece.** The drag, clamp and placement code
  measure pieces (§7.247, §7.249); a `translate` on them would skew every
  measurement by up to 9px. Only the window, the light and the pet move, and the
  room holds still while a piece is selected or held.
- **State lives at the top of app.js** (`LOOK_KEY`, `_u3d`): render hooks read it
  and some renders run at module load (§7.27's temporal dead zone).
- **Class names are `u3d-`, not `u-`.** Nothing collided yet; §1.1 is about not
  waiting until something does.
- Found by the suite: under reduced motion the flying number was skipped but the
  confetti still burst. Every effect checks `_u3dReduce()`.

- **The opening screen and login card are in it too** (2026-11-15): follows
  day and night, a raised title, the couple clay-shaded on a lit stage, a frosted
  login card under a glossy app icon, a sliding tab pill, 他/她 as cards. The
  splash paints before app.js loads, so index.html's head script stamps
  `html.ui3d` and writes the stylesheet link itself — without that, every open
  flashed the classic splash first. The clay filter `#u3d-clay` lives in
  index.html for the same reason; app.js adds one only if a stale page lacks it.
  The radios are visually hidden inside the cards, so a test must tap the
  label — `page.check()` on the input fails, and so would a real finger.
- **A near-empty screen needs softer light than a busy one.** The home aurora at
  full strength read as smudges on the splash; those screens use their own
  translucent pools (`--u-p1…4`).

- **Sheets and pages joined it on 2026-11-16** (积分表, 历史, 设置, 商店/背包,
  情书, 我们的时光): glass sheets, lit rows that rise in one after another, pill
  tabs. Those rules carry `:root` in the selector — the pre-paint stylesheet
  link sits BEFORE the page's own styles, so an equal-specificity rule would
  lose to the classic dark rules until app.js loads the second link.
- **自定义记分 gets chips, a −/＋ stepper and 今天/昨天** (`_u3dAddForm`). The
  `<select>`, number box and date input stay the source of truth — `submitEntry`
  reads them — and the new controls only drive them, so the save path and the
  （原分类） placeholder are untouched. Rebuilt on every open; 经典 unwraps it.

Two fixes found on the same walk apply to BOTH looks: entry notes and
category names were inserted unescaped (a note with `<b>` rendered bold on both
phones), and two strings still said ServiceNow — one in the confirm when
deleting a category. The login card had three more: 他/她 were white-on-white in
dark mode (inline light backgrounds — inline styles can't follow a theme, so
the tabs and options are classes now and `switchTab` toggles `.on`), the
spaced-out pair-code hint was cut off, and a phone that had never logged in
read 「继续 (…) →」 instead of 「登录」.

`tools/ui3d-test.js` covers the default, the 经典 switch, the sheet's stored
entry, the chip, rows, tilt, the room's taps, turning it off, reduced motion,
the login screens, and 360/390/820 in both themes. The other browser suites now
run in the new look by default; run them again with
`APP_URL=…/index.html?look=classic` — they must pass in both.

## 7.32 🎮 小游戏 — small, capped, and paid through the ledger

Added 2026-11-17, after a try-out page: 接零食 (the couple's own pet catches
treats for 20s) and 记忆翻牌 (six pairs from their own photos). Doors: a button
in 小窝's panel and one beside 播放回忆, both added from JS; styles are injected
(`mg-*`), so there is no index.html change and nothing for a stale page to miss.

- **Levels, asked for the same day** (「not so easy to finish」). 接零食 has no
  last level: each wants more treats in the same 15s, falls faster, and adds a
  hazard (⭐ = 3 from level 2, 💣 = one of three hearts from level 3); short of
  the target when time runs out, or out of hearts, ends the run. 翻牌 has four:
  6, 8, 10 pairs under a move limit, then the same 10 with fewer moves.
- **A game pays each person at most +3 a day**, by levels cleared (接零食
  1/3/5 → +1/+2/+3; 翻牌 1/2/3). A better run later the same day is paid the
  **difference**, so a weak first try does not use the day up; nothing cleared
  pays nothing. Leaving mid-run banks the levels already cleared (`g.bank`).
- **Records** (levels cleared, then count or moves) are per person
  (`mg_best_<game>_<who>`), and since 2026-11-25 follow the person to every
  phone through game-save 'play' (§7.34); the payout row's description carries
  the run, which is what the partner sees.
- **The payout is an ordinary entry** — `🎮 小游戏`, desc `接零食 · 接到 21 个`,
  sent through `Data.addEntry` like a check-in — so both phones see it, settle
  archives it, and "paid today" is **summed from the entries** (§4).
  A per-phone number (`mg_done_<game>_<who>_<date>`) is only the backstop for a
  month settled the same day, and is set *before* the request so a second
  finish in flight cannot pay twice.
- **The player is `_me()`** (§6), never the whose-points switch.
- There is no server rule behind the cap: any phone can already add any entry,
  and what keeps this honest is the same thing that keeps the rest honest — it
  shows in 本月记录 on both phones. Do not raise the payouts without adding one.
- 翻牌 uses `S.photos` as loaded (the once-per-session load, never a refetch —
  §5); fewer than six photos are topped up with pictures, and a photo whose
  signed URL has died falls back on **both** of its cards.
- The overlay is z-index 150: above 小窝 (125) and the 装扮 sheet (140) (§1.3).

- **A feature whose only door is two screens deep does not exist.** The day it
  shipped the user asked why they couldn't see it: the button was only inside
  小窝. Since §7.36 the doors are 首页's 今天 (a row until the day's first
  points) and the 小游戏 tile on 一起, one tap from any page.

`tools/games-test.js` plays both: the pet really catches what it is under, each
hazard, every level's shape, running out of time / hearts / moves, the payout
row, the top-up and the cap (also with the flag wiped), banking on close,
tomorrow pays again, photos / too few photos / dead photos, 360–820 both themes.

### What a frame costs (2026-11-24)

Asked for: 「make it more smooth and good quality」. Measured with a CPU profile
at 4× slowdown, main thread busy, before → after: 接零食 44% → 15%, 翻牌 38% → 9%,
默契拍拍 39% → 10%, a game simply open 32% → 2%.

- **Everything behind a game holds still.** ~60 animations kept running under a
  full-screen game (the aurora, a conic ring repainting every frame, both
  portraits, 我们的时光 and 小窝 sliding nowhere off-screen). `_gameCover()` sets
  `html.game-cover` while a game is up (`.mg-root`, `.cg-home`, `.cg-stage`):
  everything else pauses at once and stops being drawn 0.3 s later, once the
  game has faded in. **A class, not `body:has(… :not([hidden]))`**: 一起回家
  writes `hidden` on its bubbles every frame, and a `:has()` that mentions
  `[hidden]` made Chrome restyle all ~3000 elements behind the game on every
  one of those frames — the first version made 一起回家 *slower* (style 66%).
  Anything that can open *over* a game (the toast, the 00:00 films, the 🎂 tab)
  is listed in the rule's `:not(…)`, or it would open invisible — add new ones there.
- **No layout in the frame.** 接零食 read `clientWidth` and two
  `getBoundingClientRect`s every frame right after moving the pet by `left`, so
  the page was laid out 60 times a second (12% on its own). The field and the
  pet are measured by a `ResizeObserver`, the pet moves by `transform`, and the
  HUD writes text only when it changes.
- **Emoji are stamped, not typeset.** A colour emoji through `fillText` is one of
  the slowest things a canvas does; each treat and each 「+1」 is drawn once into
  a small canvas and `drawImage`d after that.
- **Looks:** 接零食 has a scene (sky, sun, clouds, hills; a night sky in dark
  mode), treats that sway with a shadow on the grass where they will land, a
  sparkle burst and a squash on a catch, a puff where a treat lands, a time bar,
  and 「连击 ×n」 — looks only, the scoring is untouched. 翻牌: a found pair
  bounces and a heart floats up; a wrong pair shakes. All off under reduced
  motion.

## 7.33 🤝 一起回家 and 默契拍拍 — two phones, one game

Added 2026-11-20 after a try-out page. 一起回家 is a co-op platformer — 50
levels in ten worlds (春/夏/秋/冬/游乐园/糖果/海底/沙漠/火山/夜) since 2026-11-24 — that only works if
the two of them help each other: stand on your partner's head, hold a button so
the other can pass, push a box that one person can't move, throw each other
with the seesaw, press two 同心锁 hearts at once, ride the wind or the Ferris
wheel, and both stomp the big cloud in the last level. 默契拍拍 is five rounds of tapping on the same
heartbeat. Both open from the 小游戏 list (first two cards) and from the home
card.

- **Everything lives in `coop.js`**, loaded by app.js the first time either
  game opens (`coop.js?v=APP_VERSION`), styles injected (`cg-` / `cgb-`). No
  index.html change, so a stale cached page can't miss it (§7.27). The overlay
  is z-index 150, the stage 160 (§1.3).
- **Three ways to play**: 🤝 each on their own phone (needs a login), 👫 two
  people on one phone (split controls), and 🙋 one person switching between
  the two characters. Demo mode has no partner, so 各用自己的手机 is off there.
- **The companion is the couple's own 小窝 pet** (or 宝宝), drawn from the
  app's own `petSvg()` picture and named with its name. No pet adopted, no
  companion, and the home screen says how to get one. Nobody else's pet ever
  appears.

### Two phones over the couple's live channel

The same private channel as the fireworks (§7.235), `couple:<match id>`;
`Live.want('coop', on)` keeps it open only while a game is on screen.

- **Each phone is in charge of its own character, and simulates the
  partner's** (since 2026-11-22). A phone sends what its player is *pressing*
  the moment it changes (`i`), with where they are; otherwise every 200 ms
  while moving and once a second standing still. The other phone runs the
  partner through the same `updatePlayer` with those buttons (`ghostStep`,
  `G.ghost = 1`: no sounds, no crumbs, no gifts, no falls — the owner's phone
  has those). Each message is carried forward by its own age (min-RTT/2 plus
  how late it was, to the last physics step) through the same physics, the
  ghost moves there, and its DRAWING glides (`vox/voy`) over 0.18–0.42 s —
  longer on a jittery line (`NET.jit`); a correction under 0.04 tiles is
  ignored.
  Measured (coop-net-test): drawn 165 / 305 / 691 ms behind before, ~10 / ~20
  / ~90 ms after (good / 4G / poor). Standing on the partner or on something
  moving sends `rx`, the offset on it, so a rider is drawn ON it.
- **A correction carries whoever stands on the thing corrected**
  (`carryRiders`). Only real movement carried a rider before, and the first
  message after the partner starts walking moves them a step or more at once:
  the one on their head was left in mid-air every time (found by the 4G
  carry check). Boxes the host corrects carry their riders the same way.
- **Messages cost money.** Supabase bills a broadcast once sent and once per
  receiver, the Free plan has 2 M a month and 100 a second, and going over can
  restrict the whole project (402s), not just the game. Two phones in a level
  went from 25.9 + 16.8 to ~8 + 6 messages a second — ~100 k billed per hour of
  play. coop-net-test fails above 12 a second per phone; don't loosen it
  without doing that sum again. The host's world rides on its own position
  messages (`w`) instead of a stream of its own.
- **The guest simulates boxes and enemies too**; the host's world (every
  0.3 s while something moves, 0.12 s in the boss level, at once when hearts,
  stars or the level's fate change) corrects them gently. The host's door also
  wants the partner's own last report (`repX`), so a prediction that runs a
  step past where they stopped can't end the level.
- **The phone that picked the level (the host) runs the world**: enemies,
  boxes, the big cloud, hearts, stars and the door — 10 times a second. The
  other phone asks for anything that changes the world (a heart taken, a stomp,
  a hit on the cloud) and the host answers for both. CS wins a tie.
- **One-off events are numbered and resent until confirmed** (`q`, acked by
  `ak` in the other phone's position messages), applied once and in order.
  The level start (`go`) and 重来/下一关 (`rq`) are resent until answered. The
  win and the fail also ride the world update (`gs`). A socket that drops for
  a few seconds therefore loses nothing; before this, a lost 「win」 left one
  phone playing a level that was over.
- **Saying hello twice.** A phone says 「I'm here」 the moment it opens — before
  its channel has joined, so that one is lost and the partner appeared only at the
  next tick, 1.5 s later. It now says it again every 200 ms until the channel can
  hear it (2026-11-25).
- **Never trust the wire** (§7.235): a message for another level or round
  (`NET.n`) is dropped, and the same login on another device (`who`) is not
  the partner. A phone on another message version (`NET_V`) is told to
  reopen the app instead of half-working.
- 默契拍拍 lines the clocks up first (round trips; the shortest one wins), then
  each phone sends how far its tap was from the beat, so both phones judge the
  same taps and give the same verdict.

### What a bad network turned up (`tools/coop-net-test.js`)

The first two-phone test ran on a good connection and passed; a simulated
phone network (delay, jitter, stalls, dropped sockets, a locked screen) found
all of this:

- **On a jittery connection the partner stuttered**: 70% of frames even, 367 ms
  freezes. A fixed 110 ms delay was smaller than the jitter, and the clock
  estimate lurched whenever a fast message arrived. With the adaptive delay it
  is 90–100% even and freezes under 50 ms.
- **Locking the phone desynced the game.** `Live` closed the socket on
  `visibilitychange` before the game's own listener sent its 「暂停」, so one
  phone paused and the other played on alone. The close now waits 400 ms.
- **After a phone call both phones said the other had left.** The silence
  timer kept counting through the pause, so the moment 继续 was tapped each saw
  25 s of silence. `begin()` restarts it.
- **A resent heart was counted twice** on the guest (it arrived after a world
  update that already had it). The host owns 💗 and ❤; the guest predicts its
  own pickups and hits and otherwise takes the host's number.
- **A partner who came back after being given up on played on alone.** A
  phone now answers a message for a level it has left with `bye`.
- **Who won a simultaneous pick depended on timing** (it asked whether the
  countdown was already showing). CS's pick wins, always.
- **The same login on an iPad counted as the partner**, so a lone phone could
  start a level nobody else was in.
- **默契拍拍 could give two verdicts.** A tap that arrived late was 「没拍到」 on
  one phone and points on the other. Each phone now sends its whole tap list
  for the round a few times a second, and a beat is judged only when the
  partner's list covers it (or after 10 s).
- **Tokens:** the channel is handed a fresh token (`access_token`) before the
  old one expires, so an hour-long game doesn't go quiet for a few seconds.

### 30 levels, each with its own puzzles (2026-11-22)

Reported: some levels felt duplicated — they were. 20 levels were stitched from
~40 pieces and the puzzle pieces came back again and again (the stack wall in
4 levels, the relay in 5, the bridge in 5, the lift ending every summer level).
Now 30 levels in six worlds, **no puzzle piece used twice** (plain platforming
pieces may appear in two worlds), and new two-person mechanics:

| | piece chars | what it is |
|---|---|---|
| 同心锁 | `q` | all of a piece's heart plates down at the same moment → its gates/bridges open for good (`G.latch`, event `latch`) |
| 风扇 | `f` | a vent; an updraft up to 8 tiles while that piece's button is held (always, with no button). Not solid: you fall through a fan that is off |
| 传送带 | `<` `>` | carries whoever stands on it 2.6 tiles/s |
| 传送门 | `P` `R` | the two blue (P) / purple (R) portals of a piece are twins; powered by its button if it has one |
| 摩天轮 | `O` | four cabins on a rim; on the world clock, or turning only while its piece's button is held (angle in the host's world, `wa`) |
| 夜里的灯 | `l`, `dark: true` | darkness except round the two of you, the pet, lit lanterns, stars and the house |
| 暴风雨 | `chase: {x0, start, speed}` | a storm wall on the world clock; touching it costs a heart and shoves you on |

Only **ordinary** buttons power fans, portals and wheels — a 同心锁 heart that you
need a fan to reach would otherwise never start the fan. Your pet repeats the
current piece's sign after 25 s without progress (not while you stand at it).
Saves moved to `cg_save2_*` (records start fresh, what was unlocked stays) and
payouts to keys `M1…M30` (new levels pay their first clear once). Since
2026-11-24 records are `cg_save3_*`, keyed by level id (below).

What playing all 30 with the bot found — each a thing a person would hit too:
- **A spring's launch was cut in half by a jump pressed just after it** (the
  ground's grace time was still running). A spring now uses it up. And walking
  onto a spring bounces you; before, you had to jump onto it.
- **A lift's button sat on the path to the lift**: walking over it raised the
  lift a little, the next step missed it, and the shaft had no bottom. Shafts
  have floors now and the button is off the path.
- **Coming back after a fall put you on your partner's head**, and a carrier
  can't jump — in 一个人玩 the next gap killed both, again and again. You come
  back beside them when there is ground.
- **Taking off from ice**, landing on 3 tiles of ice at a run (you slide ~9
  tiles), a portal that came out over thin air, an updraft one tile short of
  its wall, a two-tile island after a moving raft, a pit right where the last
  piece's exit lands: all redrawn.

`tools/coop-bot.js` has a script for every puzzle piece (`rideWind`,
`rideWheel`, `pushBox`, `seesawThrow` are the shared moves) and the general
runner for the rest; it finishes all 50 in both one-phone modes, and all but
the boss with real damage (the boss rains on a bot that never dodges). The live test checks
every new piece across two phones.

### Stars anyone can reach, 糖果 and 海底, a game that looks and sounds alive (2026-11-24)

Reported: 「some star very hard to take and can't take even both jump」. Measured
with `tools/coop-stars-test.js`: **seven stars hung 9–10 tiles up where nothing
reaches** (a stack from the floor tops out at 5.4 tiles, a spring at 8.1) and
**five more needed a perfect jump**. Stars were typed into a piece's rows by
hand and no test ever asked whether anyone could get there — the bot's job is
to finish a level, not to collect it. Eleven were moved, one more in the new
worlds.

- **The oracle plays it, it doesn't measure it.** In the page, with the real
  physics, for every star and 💗: a jump from every ledge within 5 tiles, from
  the partner's head (every pair that can stand there), springs, updrafts,
  rafts and wheel cabins, a lift held up — first as the level is, then with the
  partner holding every button (`G.forceChan`). **Comfortable = still taken
  with a jump 10% weaker** than the strongest, because a thumb on glass is not
  frame-perfect. It fails on any star that is unreachable or only perfect, and
  on any heart that is unreachable. Every new star goes through it.
- **糖果乐园 and 海底世界**, 5 levels each, 23 new pieces (11 puzzles, nothing
  reused); 夜 moved to world 8. 海底 floats: gravity ×0.6, jump ×0.85, falling
  ×0.6 (`WK()`), so a jump reaches 5.1 tiles instead of 4.2 and a stack 6.3.
  A jump in the water takes longer to top out — let go after 0.375 s and you
  jump short; the bot holds it 0.67 s there, and so does the oracle.
- **Levels have ids** (`M1…M40`), and records (`cg_save3_*`) and payouts are
  keyed by id, never by position, so a world can go in between: 糖果/海底 went
  before 夜, whose levels kept `M26…M30`. `cg_save2` is migrated (position k →
  `M(k+1)`). Positions moved, so `NET_V` is 4: a phone on the old version is
  told to reopen rather than start a different level.
- **Graphics:** every world has its own far scene (a windmill, mountains and a
  cabin, a candy castle, a shipwreck under light shafts, a night town…), hills
  that fade far → near, ground tiles in three variants with grass tufts, sun
  rays, a soft vignette, dust when running. Taking a star bursts sparkles and a
  ring and says 「⭐ n/3」, on both phones.
- **Music:** each world plays its own short tune, written by code — key, tempo,
  chords and a seeded melody (`SONGS`), nothing downloaded — scheduled ahead on
  the audio clock, quiet under the sounds, and only while playing: a pause, the
  result card or a hidden phone is silence, and 🔇 silences it. Checked by
  counting what is played: ~20 notes per 3 s in each world, 0 paused or closed.

What the bot found in the new levels: a button at the end of a conveyor (you
stand on it and are carried off it — moved a tile off the belt); the door's
heart past an always-on updraft (going to it lifted you away — moved to the
near side); a portal pillar that left a 1-tile pocket between it and the wall.

### 沙漠 and 火山, and drawing it on a phone's CPU (2026-11-24)

**Two worlds, ten levels (`M41…M50`), 22 pieces, nothing reused**, before 夜,
which stays the finale (its levels keep `M26…M30`; `NET_V` is 5). New things to
do together:

| | piece chars | what it is |
|---|---|---|
| 大炮 | `A` (fires right) `L` (left), `cannon: {vx, vy}` | stand in it while the button in its piece is held (or step in while it is) → fired. Each phone fires its own player; the partner's copy is fired by the same rule. The shot keeps its speed while you hold *forward* (`launch.keep`, sent as `p[9]`) — only steering back cancels it, unlike a seesaw throw |
| 流沙 | `z` | walk at 42%, jump 62% as hard (1.6 tiles): a 2-tile step traps you alone, your partner's head gets you out. You sink in, drawn only (`an.sink`) |
| 喷火口 | `v`, `jets: [phases]` | ground that flares on the world clock (1.0 s on in 2.6, sparks 0.45 s before); in a piece every other vent is half a cycle behind unless it lists phases. A held button in its piece puts it out; so does a box sitting on it (`jetState`) |
| 熔岩 / 热气 | world `volcano` | lava under every pit (still a fall); fans are hot-air vents |

- **Keep everything that needs both of you within ~13 tiles.** On one phone the
  two share a screen and `keepTogether` holds them one screen apart:
  `viewW / ZMIN − 2.5`, which is **15.2 tiles on a phone held upright**. The
  first drafts put a cannon's two buttons 16–21 tiles apart, and the bot could
  never press the far one; a crumbling piece 22 tiles wide left whoever waited
  for it to grow back more than a screen behind.
- **The far layers are drawn on their own canvas.** On a CPU-drawn canvas
  (Chrome with `--disable-accelerated-2d-canvas`, the nearest thing to how
  Safari fills shapes) every level ran **20–34 fps at 4× slowdown**; switching
  layers off one at a time showed the sky's gradient, the sun's rays and the
  hill band costing the most. The sky, sun, clouds, far scene, hills and the
  middle row of trees now go on `.cg-back`, a second canvas behind the game at a
  quarter of the pixels (`BACK_DPR`), with the sky's gradient as its CSS
  background; the vignette is a CSS layer (`.cg-vig`); a night level's darkness
  is drawn at 1/16 of the pixels on `.cg-dark` and the GPU stretches it. All
  levels **56–60 fps** on the same test. Fireflies punch little holes in the
  dark so they still glow, and once you are both home the lights come on.
- **The landmarks were almost never on screen.** Each world's far landmark (the
  windmill, the lighthouse, the barn, the cabin, the castle, the shipwreck) sat
  20–30 tiles in — off the right edge of an upright phone, 11 tiles across,
  until the last seconds of a level. They start 5–8 tiles in now.
- **The fireflies fell like snow.** `ambTick` chose the motion by the world's
  name (`'night'`) where it meant the particle (`'firefly'`); the autumn leaves'
  drift and the slower snow never applied either. It reads `world.amb` now.
- **"New" labels are keyed by level id** (`NEW_IN.M41`): by position, every
  world that goes in moves 夜's labels onto the wrong levels.
- **A level's random seed is its position**, so moving 夜 changed its clouds'
  timing: a piece ended with YY on CS's head and the seesaw after it (the one
  carrying can't jump) never started. The bot now steps off its partner's head
  before every piece.

### Points

**+1 for the FIRST clear of each level, for the person holding the phone
(`_me()`, §6), at most +3 a day per game.** Replays pay nothing. Like §7.32
it is an ordinary entry (`🎮 小游戏`, `一起回家 · 1-1 樱花小路 通关`), the day's
cap is summed from the entries, and the level is remembered *before* the request
so two finishes in flight can't both pay. Which levels have paid
(`cg_paid_<game>_<who>`) and the level records (`cg_save3_*`) are synced to the
person's account (game-save 'play', §7.34), so a second phone knows them; only
two devices finishing the same level at the same moment while both offline could
still both pay. Still no server rule, so the §7.32 warning stands: don't raise
the payouts without one.

### What building it turned up

- **A hidden stage still took taps.** `.cg-stage{display:grid}` beat the
  `hidden` attribute, so the closed stage sat over the menu and swallowed
  every tap. A component that sets `display` needs its own `[hidden]` rule.
- **"Am I the host?" has one answer, `NET.role`.** One check read `G.net`,
  which the guest also had, so both phones ran the enemies and each undid the
  other.
- **A box pushed from two phones barely moved.** Each phone saw only its own
  push, which is never enough, so it gave up. The host now counts a push it
  heard about in the last 0.25 s.
- **Respawning at the flag put a player behind a gate** that only opens with
  two people, with the partner already through: stuck for good. A fallen
  player now comes back beside their partner when the partner stands on solid
  ground, waits (up to 4 s) while the partner is in the air or riding
  something, and only uses the flag when there is no one to come back to.
- **The first sound and the first text cost a dropped frame.** Creating the
  `AudioContext` takes ~50 ms (200 at 4× CPU) and happened at the level start;
  it is now made on the first tap in the menu. Canvas text used the try-out's
  `Nunito`, which the app never loads — it uses the app's own font stack now —
  and the sign and the name tags are drawn once and reused instead of
  outlined every frame.

`tools/coop-test.js` plays every level in the real app with a bot (one phone,
two people and alone, 50/50 each), the payouts, 默契拍拍, the no-pet case, and
360/390/820 in both themes. `tools/coop-live-test.js` logs two phones in on the
live backend and checks every cross-phone mechanic: moves mirrored, hearts,
standing on each other, the gate held from the other phone, pause, the win paying
each person, the two-person box, the seesaw, the guest's stomp on the cloud,
the cannon fired from the other phone, the vents keeping one clock and going
out for the partner's button, leaving, and 默契拍拍 giving one verdict. `tools/coop-net-test.js` does it again
over a simulated phone network (see above; `PHONE_B=webkit` puts the partner on
WebKit, `ONLY=smooth,cuts,…` runs sections). `tools/coop-bot.js` is the bot.
`tools/coop-stars-test.js` is the star and heart oracle (above).
`smooth-test.js` measures both games (a 摩天轮 level, the volcano and a dark night).

## 7.34 🏡 我们的家 — one house, two phones, a garden that takes days

Built 2026-11-25 after a plan page and a playable preview the user tried (house +
garden + upgrades, a city later). Lives in `home.js`, loaded on first open
(`home.js?v=APP_VERSION`); its styles (`hm-*`) go in when the file loads, not
while opening. Doors: the 我们的家 tile on 一起 (`#hm-home`, it says what waits in
the garden), 首页's 今天 when a pot wants water or a flower is out (§7.36), and
「🏡 带它回家 · 去花园」 in the 小窝's panel. Overlay z-index 150, the
seed sheet 155, `game-cover` like the games (§7.32).

- **The 客厅 is their 小窝.** `api.room()` hands over the 小窝's own pieces
  (`_stackOrder`, wall and floor only), paper and floor; the 客厅 draws them at
  their own x/y, sized by `--hm-mh` = min(36% of the room's width, 62% of its
  height). The 小窝 itself uses 33–43%, so a layout that fits the 小窝 fits the
  客厅. The other rooms have their own furniture.
- **Full screen, like a game** (asked for the same day, with 「make the design
  more user friendly」). The house is a 4:3 box, 100 units wide (x runs to 132 at
  Lv2, 142 at Lv3), drawn by `onResize`: on an upright phone about 58 units to
  the screen's width — pots and the two of you twice as big as in a box — and the
  view follows you (dead zone 34–66% of what is visible); a wide screen shows the
  whole house in the middle. It stands at the bottom, under the buttons at the
  top. The buttons at the bottom stand on the lawn: when the lawn is thinner than
  they are tall (82px), the house moves up (`reserve`) so they never cover a foot
  or a pot — unless the screen is wide enough to put them beside the house. A
  phone on its side (`hm-short`) puts the menus in the title row and the chip at
  the bottom between the buttons, or the house shrank to 22px people.
- **Buttons, all labelled.** Top: ✕, where the two of you are, 🪙. Then four
  menus — ❓ 玩法 🌱 花园 🏠 房子 🎁 小店 — each a sheet (closed by ✕, its own
  button again, a tap outside, or Esc; the pressed menu shows it). Bottom: ◀ ▶,
  ⬆/⬇ only in the two-storey house (it says which way), 🤗 抱抱 👋 招手 🛋️ 坐下.
  Walking to the garden or back is in 🌱 花园. After an upgrade the 房子 sheet
  closes so you see the new house; the shop stays open for buying several things.
- **The 「下一步」 chip** under the menus says the most useful thing to do now, and
  one tap does it (walks there and waters, picks, or opens the seeds): a drooping
  plant first, then today's watering, then a flower to pick, then a pot to plant.
  Watering only counts today and a flower waits forever — the first order picked
  a flower that had just opened and left its neighbour unwatered for the day. It
  bounces three times when its advice changes, restarted by switching between two
  identical keyframes: re-measuring the page to restart one cost 35 ms of opening.
- **A first visit** opens on a three-step welcome (开始吧 / 看玩法), once; a tap
  on the card never walks anyone behind it.
- **Every screen, measured** (asked: 「make sure fit all device」). 🤗 抱抱 only
  shows when you stand next to your partner — the moment it can be used, and one
  button fewer the rest of the time. Under 390px the bottom buttons shrink, under
  340px they shrink again and the menus' words get smaller, under 300px (a folded
  Galaxy Fold) ⬆/⬇ sits above ◀ ▶; the house's room for them (`reserve`) comes
  from their measured height, not a constant. A short screen measures its one top
  row: the menus stand left of the 🪙, the title takes what is left, and when that
  is too little the menus keep only their icons (iPhone 8 sideways put the title
  under ❓ 玩法). `home-test.js` §9 walks 280×653 → 1920×1080 both ways up, with
  every action button showing on the narrow ones, and fails on two buttons on top
  of each other or one off the screen.
- **Off screen:** the partner gets a 「‹ 名字」 tag at that edge, which walks you to
  where they are GOING — walking to where they were left you halfway when they
  were still on their way.
- **Moving:** tap the floor or a pot, hold ◀ ▶, the stairs button, or tap upstairs.
- **A laptop plays it from the keyboard** (asked 2026-11-25): ← → / A D walk while
  held (a blur stops it — the key-up may never come), ↑ ↓ / W S the stairs, Space
  the 「下一步」 chip, E the pot you stand by, H 抱抱, J 招手, K 坐下 / 站起来, 1–4 the
  menus, Esc a sheet or the house. Document-wide while the house is open; never
  while typing or with ⌘/Ctrl/Alt; a sheet open blocks the world keys. Each
  button wears its key (`data-key`, drawn by CSS) only under
  `(hover:hover) and (pointer:fine)`, and ❓ 玩法 lists them there. A pot takes taps a little beside it and on the flower above (±4.6%,
  no more: at Lv3 the pots stand 8% apart, and a first version's thumb-sized zone
  made the whole lawn open the seed sheet). `click`, not `pointerdown`: a swipe
  that starts on the house scrolls the page and must not walk anyone. You stand
  beside a pot (±6.5), not in front of the flower.
- **一起坐沙发:** any 🛋️ piece in the 小窝 is a sofa with two seats. Sitting is
  only a pose where you stand — the drawing is lifted onto the cushion (42% up
  sofa_blue's drawing) — so walking, stairs and saving never see it; `sit` and
  `up` travel live, and any move stands you up. Two on one sofa: 💕.

### The garden: derived, so two phones can't disagree
- A planting is `{id, seed, at, by, w: {date: bits}}` — bit 1 CS, bit 2 YY;
  dates are each phone's own (§2). `grow()` derives the stage from the waterings
  alone: one of you = one step, both the same day = two, five steps a flower. A
  growing plant last watered 3+ days ago droops (`WILT`), and the watering that
  saves it doesn't grow it. A flower never droops; a watering dated after today
  waits for its day.
- Every change is an action (`plant`/`water`/`pick`/`pos`); `apply()` returns
  null when it no longer makes sense on the save (watered twice, picked twice,
  pot taken), which is what makes replaying it after a refused write safe.
- A flower picked: `picked`+1, `album[seed]`+1, `log` [date, who, seed,
  plantingId] (last 30). `petExpDerived` adds `picked × 20` (so 小窝币 +10), and
  `petBase` rebases it on re-adopting (§4.5). The save loads with the other EXP
  sources in `_loadStatsSources`: without it the EXP would freeze behind its
  stored high-water whenever the save isn't loaded.
- Seeds are free (only permanent things cost coins): 小雏菊/向日葵 from the
  start, then 郁金香 3, 绣球花 6, 薰衣草 10, 月光花 15 flowers picked; each
  festival's seed only in its window.

### One save, compare-and-set (`game_saves`, `game-save`)
- RLS on, no policies; the function is the only writer and keeps the rules
  (§0.0): known games only, 16 KB, `picked` only grows and by at most one per pot
  per write.
- The phone keeps `srv` (last saved), `pending` (its own unsaved actions, also
  in localStorage per login, so they survive closing or a dead network) and
  `remote` (the partner's actions heard but not yet saved). What you see is
  srv + remote + pending through `apply()`. A refused write (409) hands back the
  newer save and the pending actions replay on it; one that no longer applies is
  dropped and said out loud, naming who got there first (`firstBy`) — unless it
  is our OWN action already in the save (`landed`). That case is real:
  `_fetchWithRetry` resends a write whose answer was lost, the resend is refused,
  and the first version then told the user their partner had picked the flower
  they picked themselves. The two-phone test caught it.
- Every newer save goes through `setSrv()`, which tells the app (`onSave`); the
  phone that lost a race used to keep the old flower count, so its EXP and 小窝币
  lagged.
- A save refused outright (4xx, not 409) drops the pending actions and reloads
  instead of retrying forever; five lost races in a row retry 2.5–4.5 s later.
- **An action that builds on the partner's unsaved one waits, it is not dropped.**
  The partner plants, you water within the second: your phone has *heard* the
  planting (`G.remote`) but not *loaded* its save, so `apply()` on the save
  found no pot and the watering was thrown away as lost — silently, one run in
  four of home-live-test. `flush()` now keeps an action that applies on top of
  `G.remote`, saves the rest, and loads the partner's save 1.2 s later (their
  `saved` usually arrives first); `flushOnClose` keeps such an action on the
  phone for the next open. Only when the partner's action expires (30 s) is
  ours dropped. home-live-test §8a forces it by holding the reads back.
- Upgrades (小平房 600, 两层小楼 1500) and festival pieces are decor-buy
  purchases with `hm_*` ids (`Data.buyHouse`): one wallet, the buyer is the login.

### Live: where you are is never stored
- Event `hm` on the couple's channel (§7.235), `Live.want('home')` only while
  the house is open. A tap is ONE message (`go`: from, to); holding ◀ ▶ is `hold`
  and `stop`; a heartbeat `st` every 12 s corrects drift; `hi` on arrival
  (retried until the channel has joined, and again on waking). `bye`/`away`
  carry where you were, so the partner's phone says 「上次在花园」 at once — the
  save of it lands a moment later. Garden actions travel as `op` (shown on
  arrival) and `saved` {rev} makes the partner reload. Idle, the two phones send
  about 10 messages a minute.
- Never trust the wire: our own login on another device is not the partner,
  positions must be in range, and a different `HOME_V` asks both to reopen.
- The pet follows whoever moved LAST — the same rule on both phones, so it is
  in the same place on both.

### Festivals and seasons
- `api.themesAt(date)` returns EVERY theme active that day, not only the winner:
  on 12-24 the 周年 takes the sky (a banner on the roof) and the garden still has
  its 圣诞 snow. A festival's window — shop, seed, bought pieces on show — runs
  from a week before to 2 days after (7 after the anniversary). Bought festival
  pieces come out by themselves every year in that window and are listed as
  stored otherwise. Night and dusk follow `data-period` (§7.15); the seasons tint
  the tree and the grass.
- Opening costs one ~64 ms task at 4× CPU the first time and none after (it was
  62 + 76 ms):
  the list under the house is drawn two frames later, the size comes from the
  ResizeObserver instead of a forced layout, and the app behind goes still
  (`game-cover`) a frame after the house paints.

### Progress that follows you to every device (game-save 'play')

Asked for the same day: 「make sure the changes got store the data, mean device
sync」. The house was already one save; the games were not — 一起回家's levels,
stars and best times, the levels that had paid, and 接零食 / 翻牌 records lived
only on the phone that played them, so an iPad started from nothing and could pay
a level a second time.

- `Prog` (app.js) keeps one save per person (`game-save`, game `play`, slot
  `char1`/`char2`; the function refuses a write to the partner's slot, 403). It
  merges what the phone has with what is saved — the most levels open, every
  star either device got, the fastest time, the most hearts, every level paid,
  the better record — writes that back to the phone's own keys (which the games
  already read) and saves it. The merge never loses anything, so a write refused
  because another device saved first just merges again.
- **When:** opening 小游戏 (the list redraws if another device had more), before
  一起回家 loads its save (at most 1.5 s, then it opens anyway), after a level
  pays, after a record, and when 一起回家 closes. Demo mode has one phone and
  doesn't sync.
- **The phone's copy is read AFTER the network wait**, and written back in the
  same breath. The first version read it before the wait, so a level cleared
  while the save was on its way was overwritten by the older copy — found by the
  two-device test. A sync asked for while one is running runs again after it.
- Postgres stores JSON keys in its own order: compare records field by field.

`tools/home-test.js`, `tools/home-live-test.js`, `tools/sync-live-test.js` (one
person, a phone and an iPad), `supabase/test-games.mjs`; `smooth-test.js` walks
the Lv3 house on a 圣诞 night.

## 7.215 ⏱ Anything published at module load runs BEFORE login

`refreshWeather()` is called at module level, which is *before* a session
exists — so `publishWeather` saw `S.usingSN === false` and returned every
single time. The next attempt was 20 minutes later, so anyone who used the app
for less than that **never published their weather at all** and their partner's
card stayed empty forever. It looked like a sync bug; it was an ordering bug.

- Hold the value (`_wxPending`) instead of dropping it, and **flush on login** —
  from *both* paths: fresh sign-in and resumed session.
- Anything else computed at module load and pushed to the server has the same
  hazard. Check when it actually runs relative to `S.usingSN = true`.

**And show your own side.** The card used to hide entirely until the partner
reported, so "it says rain but it isn't raining" had nowhere to be checked. It
now reads 「你这边 晴 · YY那边 下雨」, or 「YY 还没打开过」 — the state is
visible instead of mysterious.

---

## 7.225 🌧 Trust millimetres, not the weather code

"No rain here but the app shows rain" had **two** causes, and the code-only
mapping was the bigger one. Measured live in Singapore at the same moment:

| | code | precipitation |
|---|---|---|
| 市中心 | 53 | **0.2 mm** |
| 榜鹅 | 51 | **0.1 mm** |
| 樟宜 | 51 | **0.1 mm** |
| 裕廊 | 3 | 0.0 mm |

Codes 51–53 are *light drizzle* — 0.1mm/h is a mist you would not call rain —
and the old `c >= 51 → 'rain'` drew a full downpour for all three. `weatherKind`
now takes `precipitation` and needs **≥ 0.3 mm/h** before it draws rain;
anything below is overcast. Thunder and snow still trust the code alone,
because you don't need a threshold to know it's thundering. With no reading at
all it falls back to the code rather than showing nothing.

The second cause is genuine location spread — 裕廊 was dry while 市中心
drizzled — which is what 设置 › 天气 › 用精确位置 is for.

---

## 7.226 ☀️🌙 A weather condition is not a time of day either

Reported at 23:15: 「你这边 ☀️ 晴」 with the whole app in its night palette.
Checked against the source — Open-Meteo said `weather_code 0`, `cloud_cover
17%`, so **晴 was faithful**; iOS said "Partly Cloudy" only because its provider
labels 17% cloud differently. Providers disagreeing is §7.22, not a bug.

The bug was the **icon**. Exactly the §7.23 trap one layer over: a sun means
midday, and no weather code implies a time of day.

- Only `clear` gets a night variant (🌙). Rain, thunder, snow and fog read fine
  in the dark; a bare cloud is time-neutral. Don't invent variants you don't need.
- The **word** stays 晴 — Chinese forecasts say 晴 around the clock. Change the
  glyph, not the vocabulary.
- Day/night comes from Open-Meteo's **`is_day`** for the queried point, which
  beats a clock: it is right near the poles and across DST. Ask for it in the
  same call — it is free.
- **Never cache day/night with the reading.** The 20-minute weather cache
  outlives sunset; a cached `is_day` would leave a sun up after dark.
- The partner's icon uses **their** daylight, not yours. `wx_*` now carries
  `d`, and payloads written before it fall back to the hour they published.
  A couple in different time zones must be able to show 🌙 and ☀️ on one card.

---

## 7.22 🌧 Weather accuracy is a user choice, not a default

"It says raining but it isn't here" was **not** a bug — Open-Meteo genuinely
reported code 81 (阵雨) for Singapore. The problem is that a *city* coordinate
cannot answer "is it raining at my window": Singapore showers are hyper-local,
pouring in one district and dry two streets away.

There is no correct default, so 设置 › 天气 offers all three:
`跟着城市` (no prompt, city-level), `用精确位置` (asks once, accurate to the
block), `关掉天气`. Precise coordinates are rounded to **2 decimals ≈ 1km** and
cached 7 days — enough for weather, deliberately not a home address sitting in
localStorage. Refusing the prompt silently falls back to city; `off` doesn't
even call the service.

**Two test-harness traps worth remembering**, both of which made a working
feature look broken:
- A mocked cross-origin response **needs `access-control-allow-origin`**, or
  the browser rejects it before the app sees it.
- `navigator.geolocation` is read-only; plain assignment is silently ignored.
  Use `Object.defineProperty`.

And when verifying couple-scoped data by hand: partners are linked by
**`pairCode`**, not by passing `matchId`. Getting that wrong creates two
separate couples and makes perfectly good sync look broken.

---

## 7.24 🔄 Live sync: adaptive, never a fixed fast poll

Measured against the real instance: a `/config` poll is **322 bytes but takes
~1.1s** (worst seen 3.5s), and 30 back-to-back polls all succeeded — so the
limit is latency and battery, not bandwidth or rate limiting. True "instant"
does not exist here; a couple of seconds is the floor.

So the cadence adapts instead of being fast all the time:

| when | gap |
|---|---|
| 60s after any change or edit | 4s |
| next 3 min | 12s |
| idle after that | 30s |

A quiet hour costs ~120 requests (**cheaper** than the old fixed 20s poll at
180); a busy hour ~252, against 900 for naive 4s polling. Backgrounded tabs
poll not at all, and returning to the app polls immediately rather than
waiting out the gap.

**The bigger win was not the interval.** Detecting a change only raised a
banner the user had to notice and tap, so the *perceived* delay was however
long that took. It now applies silently when you are merely looking, and only
asks when you could lose work — a piece selected, or the shop open
(`_roomBusyEditing`). Pulling the room out from under someone mid-arrangement
would be hostile; doing it while they watch is the magic bit.

Use a self-rescheduling `setTimeout`, not `setInterval`, so the gap can change
between ticks.

---

## 7.245 🪑 Depth comes from POSITION, not a layer number

A table placed after a fish tank painted in front of it, because render order
was array order. The fix is not a hidden z-field: **the lower down the room a
piece sits, the nearer it is**, exactly like a real room. Sort by `y`, put wall
pieces behind every floor piece, break ties on placement order, and write the
result into `z-index` so the DOM order never shuffles under the drag handlers
(they key off `data-i`).

Costs **nothing** to store — `y` is already in the blob.

> Note `fishtank` is a **floor** piece despite usually being placed high; the
> wall/floor rule alone would not have fixed the reported case. Depth-by-y did.

### …but a MANUAL control may not move anything

The ⬆️⬇️ buttons originally honoured "one source of truth" by nudging `y` just
past the neighbouring piece. That is a defensible rule and a **user-visible
bug**: pressing ⬇️ slid the table four percent up the floor, reported with two
screenshots a minute apart. A control labelled 「放到最后面」 must change the
stacking and *nothing else*.

So automatic depth still comes from `y`, but a manual re-stack writes a small
explicit `z` that sorts ahead of it. It is optional and defaults to 0, so it
costs 2–3 characters and **only for pieces actually re-stacked** — a fully
furnished room went 651 → 654 of the 1000 (§4.5).

- `z` must be in `_roomSig()`, or a partner's re-stack never syncs.
- `parseEquipped` defaults it to 0, so blobs saved before `z` existed load
  unchanged — assert that, and assert the pose (`x/y/s`) is byte-identical
  across a layer change. `regression_reported.js #14` is that guard.

## 7.247 📐 Clamp the piece, not the anchor

`DRAG_BOUNDS` pinned x to 8–92 — but the anchor is the bottom-**centre**
(`translate(-50%,-100%)`), so that number says nothing about where the edges
land. Three separate symptoms, one cause:

- a bed dragged right and grown to 180% hung out of the room, and `.pet-room`
  is `overflow:hidden`, so it was **sliced off** rather than merely overhanging;
- `placeDecor` staggers new pieces on a fixed `14 + (n%5)*18` grid that knows
  nothing about width, so a sofa bought into the x=14 slot was clipped the
  moment it appeared;
- the starter `sofa_blue` sat at x=84 and was clipped on a 390px phone from the
  very first boot. Wide screens were fine, which is why nobody saw it.

`_pieceBounds(idx)` measures the rendered element and derives per-piece limits;
`_clampToRoom(idx)` nudges it back. Called from drag, from `resizeDecor` **after
the render** (the new bound depends on the size it just became), and from
`placeDecor`. It is also *more* generous than the flat margin: a narrow lamp may
now sit closer to the wall than 8% allowed.

> **Do not clamp on load.** Bounds are a share of the room, and the room is
> 362px on a phone but 560px on a laptop — a load-time clamp would let whichever
> device opened the room last quietly rewrite the other's layout. Clamping only
> on a deliberate edit keeps it conservative in the safe direction: coordinates
> that fit the narrowest screen that touched them fit everywhere.

## 7.249 👆 Only what is drawn takes a tap — and new pieces land where they can be seen

Reported 2026-10-07 with a screenshot: a 毛线篮 just bought showed only its
two needles above 呆呆's head and could not be picked up. Two causes, both
the §1.2 shape again:

- **The placement grid sent every fifth floor piece to x=50** — the pet's
  column. `_freeSpot()` now measures: it tries a short list of spots and takes
  the first that nothing covers, else the least-covered one. Being HIDDEN (by
  the pet's drawn body, the bubble, or a piece in front by `_stackOrder` —
  including 置前/置后 `z`) costs four to ten times more than covering a piece
  behind; the window costs a little. Measure the pet by `.pet-body`/`.pet-head`,
  not its box: the box is mostly air, and counting it pushed a 兔子灯 straight
  behind a table instead.
- **The pet's whole box took taps**, empty corners included, and it sits
  above the furniture. `.pet-stage` is now `pointer-events: none` with only its
  drawn shapes hit-testable (minus its ground shadow); the click still bubbles
  to `onclick`. The speech bubble and the rug took taps too and no longer do.

A piece already hidden comes back by 收起 then 摆进小窝 in the shop — it lands
on a free spot. `tools/room-test.js` replays the report (0% of the basket was
tappable before, half after), the drag out, the pet still reacting to a poke,
re-placing at 360/390/820, and a room filled one piece at a time; `ROOM=` a
saved layout replays a real room (never commit one).

## 7.248 🚫 A control that cannot do anything must look like it

置前/置后 stayed enabled for a lone piece, and for one already at the front of
its group. Pressing them did nothing visible while still writing `z = max+1`,
so the saved blob grew for no reason (§4.5 budget).

`_stackOrder()` is now the single comparator shared by the renderer, the action
and the buttons' `disabled` state. Three copies of that rule would drift, and a
greyed button that still works — or a live one that does nothing — is worse than
either behaviour on its own. `layerDecor` re-checks the rank as a backstop.

## 7.246 🔔 A cached count has to be told when it changes

Opening a letter set `opened` on the in-memory object, re-rendered the letter
*list*, and saved to ServiceNow — but never re-rendered the **home card**, so
「1 封未拆」 stayed after reading it. `S.letters` is cached deliberately (§5),
which means nothing refetches to correct it.

Any derived badge over cached data must be re-rendered by every action that
changes the underlying value: `renderLetterBanner()` now runs on open, on send,
on delete, and on leaving the letters page.

---

## 7.25 🖥 Wide screens: cap the canvas, scale the contents

`.pet-page` is `position:fixed; inset:0` and `.pet-room` was `flex:1`, so on a
laptop the room stretched to ~1250px — while `--pet-h` stayed a hardcoded
154px. The pet went from **36% of the room width on a phone to 8% on a wide
screen**, and the furniture read as specks scattered along a thin strip.

Two separate mistakes, both worth remembering:

1. **A flexible container needs a max-width.** The room is a diorama, not a
   wall: `width: calc(100% - 28px); max-width: 560px` (640px ≥900px),
   `margin-inline: auto`, and the topbar/panel pinned to the same column.
2. **`.pet-stage` was hardcoded `132×154px`** even though every piece of
   furniture is sized off `--pet-h`. The thing everything else is measured
   *against* wasn't participating in the scale, so widening the room could
   never have helped. It is now `height: var(--pet-h)`.

`responsive_test.js` asserts the room stays ≤660px, centred, with the pet at
25–45% of its width at 390/820/1280.

---

## 7.36 🧭 首页 · 积分 · ＋ · 一起 · 商店 — where everything lives

Asked for 2026-11-25: 「the main page looks so messy … improve the system design
for the navigation and user view」. A plan page with a clickable phone was
approved with 「the theme dun change, just the card and the idea for the
navigation button」, and after the first build 「the design can use back
previous suggest design」 — the couple's card at the top, as the plan drew it.
The look (colours, sky, clay portraits, 新外观) is the same; what moved is
where things live. Home went from 3013px (3.6 screens at 390×844) to 1176px.

| page | what is on it |
|---|---|
| 🏠 首页 | the title row; **one card for the two of you** (both portraits, the days together in the middle, weather and the mode switch underneath); 今天; 本月; 常用记分 |
| 📊 积分 | 本月 (whose points, the score card, every score, 本月记录) · 历史 · 奖惩表 — panes in the page, not sheets |
| ＋ | the 记一笔 sheet (新外观) or the 自定义记分 form (经典), from any page |
| 💞 一起 | 我们的家, 小窝 + 共同目标, 小游戏, 情书, 我们的时光 |
| 🛒 商店 | the shop page, with the bar raised above it |

⚙️ 设置 is the top-right button on every page. The pages are `section.app-tab`
inside `#app`; `_setTab()` shows one, marks its button `aria-current`, keeps
each page's scroll (tapping the page you are on goes to its top) and stamps
`html[data-tab]`. **The old names still work**: `nav('tables')`/`showTables()`
open 积分 › 奖惩表, `nav('history')`/`showHistory()` 积分 › 历史, `nav('settings')`
the ⚙️ — the tests and the films call them.

- **今天 lists only what is still to do, each with its own button**: 签到 (one
  tap checks in, no calendar first), an older month left open (去结算), the
  garden (home.js's own `grow()`, never a second copy), a letter sealed for
  you, a game not played today. Done things fold into ✓ chips (each opens its
  place); nothing left says 「今天都做完了」. The 签到 row and the 本月 card follow
  the whose-points switch, like the calendar they open (§6); letters and games
  are about the login, `_me()`.
- **本月 is the score card in one line** — same number, same percent, same
  status (`_progressStatus`, shared, with the `#status-gap` id stripped so the
  page never holds two).
- **常用记分: the four used most this month, shown in the grid's own order**, so
  a tile never moves under the next tap. Fewer than four used → the smallest 加分.
- **The couple's card is the hero (`.together-hero.duo-card`).** The portraits
  sit on its sides at 76px (62 under 360, 84 over 400) with the crowns still on
  their heads (sized in % of the portrait); the days are `.th-mid`, the one part
  that opens 我们的时光 — a tap on a portrait still picks whose points. The
  milestone is two `nowrap` halves, so a narrow card breaks between them.
- **The sky had to move, not go.** The card took the open strip where the sun
  and the moon lived, so on 首页 they sit in the title row (scaled, the real
  moon phase untouched); on 积分 and 一起 they and the festival layer are hidden —
  they sat behind the segmented control and the ⚙️. On a fireworks night the
  card turns see-through (`:has(.sky-bg .fw-canvas)`, night only), and **sky
  taps** count on the card's open edges and in the gaps between cards
  (`.app-tab` itself) as well as the title row (§7.235).
- **商店 is a page, the bar stays.** `html.shop-on` lifts the bar to 92 over the
  shop page (90), pads the shop's list to end above it, and ‹ 返回 goes back to
  the page you came from. **`#modal-add` is z 96**: ＋ in 经典 opened the form
  *behind* the shop page — nav-test found it on its first run (§1.3 again).
- **Every door is one tap from anywhere.** Nothing that used to be on 首页 was
  removed; 一起's tiles each say what waits there (the garden's pots, a badge
  for a sealed letter, 今天还能拿分).

`tools/nav-test.js` (`ONLY=…`, `LOOK=classic`): the bar in order and in both
looks, every page and pane, 今天's rows and buttons (both partners), 本月 = the
score card, the four tiles, each 一起 tile opening its place, the shop under
the bar, ＋ on top from every page, 320–1280 by day and night with nothing
under the bar or off the side, keyboard, reduced motion, and HTML_V = the meta.

## 7.27 🔁 The stale-HTML guard must COMPARE, not just check presence

`app.js` is always fetched fresh; `index.html` (which carries every bit of CSS
and the page structure) can sit in a phone's cache for days. `ensureFreshHtml`
existed for exactly this — but it only fired when the `app-html-v` meta was
**absent**. A cached index.html still has the meta, just an older value, so it
sailed through and the user ran **new JS against old HTML/CSS**: new elements
unstyled, a whole new layout invisible, `EXP 148还差 152` with no separator
because the class that adds the line break didn't exist yet.

- `HTML_V` in app.js must equal `<meta name="app-html-v">`. **Bump both.**
- The guard compares them and reloads once with a cache-busting query.
- The "already retried" flag is **keyed by version**, or one stale flag blocks
  every future release.
- Belt and braces: put a literal space in markup that relies on CSS for
  separation, so a momentary mismatch degrades to `EXP 148 还差 152` rather
  than nonsense.

**Also: the minute tick watches the DATE, not only the hour band.** A phone
left open overnight kept yesterday's day count and never showed the new
season's furniture until the user happened to navigate. `_lastDay` is
initialised to `null` and latched on the first tick — calling `todayStr()` at
module top level hits the temporal dead zone and kills boot outright.

---

## 7.255 📏 One rhythm for the home stack

Every card on the home page must share **one width, one left edge, one gap and
one internal padding**. Three separate drifts were visible on a real phone
before anyone measured:

- `#partner-wx` had `padding: … 14px` and the duo tiles `13px`, against `18px`
  on the hero and the rows — content sat 4–5px out of line down the page.
- `.letter-banner` and `.checkin-banner` kept `margin-bottom: 14px` from the
  pre-hero layout while everything else moved to `12px`, so the vertical gaps
  visibly stepped as you scrolled.

They were also **full-bleed** while `.score-card` below them used
`margin: 8px 16px`, so the top half of the page looked like a different app
from the bottom half. Everything is `0 16px 12px` now.

**Set the inset on each rule, not as a grouped override.** A grouped
`.a, #b, .c { margin: … }` loses to `#partner-wx` (an ID beats a class) and to
any class rule declared later in the file — half the stack silently ignored it.

`days_test.js` asserts all six cards, `.score-card` included, share one width,
one left edge and one gap, and that nothing touches the screen edge. Add any
new home card to that list.

## 7.256 📅 「在一起 X 天」 counts inclusively, in LOCAL days

Two bugs in one line, both reported:

1. `Math.floor((Date.now() - start) / 86400000)` is **exclusive** — the day you
   got together showed **0 天**. The first day is day 1.
2. `new Date('2024-12-24')` parses as **UTC midnight**, then got compared
   against a local `Date.now()`. At UTC+8 the number rolled over at **08:00
   local**, not midnight — it changed over breakfast.

`daysTogether()` builds a **local** midnight from the Y-M-D parts and diffs
whole calendar days, `+1`. Any future "days since" figure must do the same.


## 7.257 🎬 The anniversary film opens on the DAY, once per phone

On each anniversary of `start_date` (and every 1000th day) the first open
shows a sealed envelope; opening it plays a ~50s film built from that year's
photos, counts, a line the partner wrote, and the pet. `annivOccasion(d)` is
the single source of "is today the day" — the home tip, the trigger and the
tests all read it.

- **The device date decides** (§2). 00:30 in Singapore is already 12-24.
- **Only after the couple is in the app.** Not over the splash (`#start-page`),
  not over the login card. A resumed session boots *behind* the splash, so
  the real showing comes from `connect()` after 「继续」.
- **Seen is per device and not synced** (`anniv_seen_<date>`), so whoever
  opens first can't use it up for the other. 「稍后再看」 only snoozes for the
  session; the home tip always replays it.
- **Two-account:** the envelope carries your own name, and the quote is the
  *other* partner's line.
- **Signed photo URLs die after 4h** — the film re-signs them on start, and
  a dead image falls back to a colour card instead of a broken icon.
- Styles are injected from app.js (`anv-*`), so a stale cached index.html
  can't leave it unstyled (§7.27).

Found while building it: `_lastDay` was latched on the first clock tick, so
an app opened at 23:59:30 latched the *new* day at 00:00:30 and never saw
midnight — no day count, no new stock, no envelope. `boot()` now sets it.

`tools/anniversary-test.js` (faked clock, demo data) covers the dates, both
phones, snooze, midnight, missing photos/pet, expired photos, wide screens,
the 悄悄话 card and sheet, and the song choice. **Run it before every 12-24.**

**The song is decided BEFORE the tap.** Phones only allow sound inside the
tap itself, and a missing mp3 only reports its error after `play()` — by
then the tap is spent and the fallback is silent. `Music.prepareFilm()` HEADs
the film's song while the envelope is showing; the tap then plays whichever
exists (`A Thousand Years (Piano).mp3`, else the default).

## 7.258 💌 周年悄悄话: the one date the SERVER decides

Each partner can seal a line (≤200 chars) for the next anniversary from
「我们的时光」; on the day it replaces the letter quote in the *other*
partner's film. Table `anniv_notes`, function `anniv-note`.

- **This is the exception to §2.** Everywhere else the client date wins; here
  the client date is exactly what a curious partner would change. The note
  opens at 00:00 on its day **in the writer's time zone** (`tz_min`, stored
  when sealed). Not "the earliest zone on Earth" — that would open a
  Singapore couple's note at 18:00 the evening before.
- **RLS on, no policies at all.** A direct `SELECT` with a session token
  would hand the partner the note early, so only the function can read it.
- The GET never says whether the partner *has* written one — `sealed` is
  about your own.
- Once your note has opened it is delivered: a PUT answers **409**, like a
  posted letter. A note can't be written for a day that has already begun.
- It is in `tools/backup.js`'s table list. `supabase/test-anniv.mjs` attacks
  it live: early read, spoofed date, partner overwrite, third couple, direct
  Postgres read/write, rewrite after delivery.
- **Test text is never the real text.** The note the user picked was copied
  into `tools/anniversary-test.js` as test data on 9-30 and sat in this
  public repo until 10-27. Fixtures use obviously fake sentences; the real
  words only ever go in through the app.

---

## 7.26 🏠 Home layout: hero + duo + rows

> Superseded by §7.36 (the couple's card, 今天, 本月, 常用记分; the duo moved to 一起).
> Kept for the two measuring lessons below, which still hold.

The home cards were five identical full-width rows. Measured, each was ~430px
with the content hugging the left and a lone `›` on the right — **270–283px of
dead space per row**. Two things fixed that:

1. **Fill the trailing slot with something worth reading.** 在一起 shows the
   next milestone (every 100 days, every anniversary, plus 520 我爱你 and
   1314 一生一世); 情书 shows unread/total; 小窝 shows EXP and the gap to the
   next stage. A `›` alone does not justify a third of the row.
2. **Not everything wants to be a row.** 在一起的时光 is the emotional centre,
   so it is a hero (46px number). 小窝 and 共同目标 are both progress, so they
   pair as two tiles in `.home-duo`. 情书 and 签到 keep rows because they carry
   status text that would wrap in a half-width tile.

Two alignment bugs found on the way, both invisible until measured:

- `.pet-banner-box` had **26/15px** padding where every sibling row is 19/19.
- The idle bounce sat on `.char-wrap`, so the **name and score badge bobbed
  with the character** — and since the two sides are deliberately 0.9s out of
  phase, the two "+51" badges sat at visibly different heights. It read as a
  layout bug. The animation belongs on the portrait alone; `bounce_test.js`
  asserts the labels drift 0px across a full cycle while the art travels 22px.

---

## 7.3 ♿ Contrast, tap targets and motion

Audited from **rendered pixels**, not computed styles. Three earlier attempts
at a computed-style checker all lied: they ignored alpha, then guessed at
gradient ancestors, and reported false 1:1 ratios across the app. Screenshot
the element, take the 1st/99th luminance percentiles, compare. Two caveats:
a crop that is mostly background (a thin ✕ in a 36×36 button, a 3-character
chip) under-reports, and an emoji has no meaningful ratio at all.

What that found, all real and all now fixed:

- `--blue`, `--sub` and `--red` are tuned for **fills**. At 10–15px they were
  2.1–3.0:1 on white. Small text now uses `--blue-ink` / `--sub-ink` /
  `--red-ink` / `--nav-off` / `--goal-ink` / `--lv-ink`, which flip per theme.
  The bottom-nav labels — read on every screen — were **2.09:1**.
- **A theme-flipping token is wrong on a fixed-colour surface.**
  `.score-card-header` is the same blue gradient in both themes, so
  `--sub-ink` there went light-on-light-blue and dropped to 1.4:1. It needs a
  hardcoded ink.
- **Watch for duplicate rules.** `.checkin-banner-sub` is styled in *both*
  index.html and the injected block in app.js; the app.js copy won by load
  order and silently undid the fix. Grep both files.
- **A more specific old rule beats a new token.**
  `html[data-theme="dark"] .nav-label` hardcoded the *light* grey and kept the
  dark nav at 3.4:1 long after the variable was correct.
- `.modal-close` had **no CSS at all** — a 14×19 UA-default button.
- `prefers-reduced-motion` needs **one blanket rule**. Per-feature opt-outs
  were added with each new animation, but sixteen older ones (drifting clouds,
  idle character bob, pet ear-flaps) kept moving. The spinner is exempt so
  "loading" still reads as loading.

## 7.4 ⚡ Measured performance (keep it here)

**Login → home: 3.6s** on the live site (2026-10-02). It was 6.1s warm and
11s straight after a deploy, because `Data.init` fetched config, categories,
rewards and punishments one after another at ~1s each. They are independent,
so they now go together — and since four requests can 401 at once,
`_sbRefresh` is single-flight (Supabase rotates the refresh token on use).
Every function call costs ~1s regardless of size; count round trips on the
critical path before anything else.

Cold load **317ms**, DCL 56ms, 432KB, 818 nodes. With a year of data — 220
entries, 120 letters, 40 photos, 24 settled months — home renders in **268ms**
at 2780 nodes, the slowest screen switch is 13ms, and the heap sits at 6MB.
DOM plateaus: 48 open/close cycles of the pet room and 20 weather flips add
zero nodes. If a change pushes any of these materially, find out why.

### 7.41 Answer the tap first (2026-11-18)

A logged-in call costs 0.5–1s even when it returns `[]` — most of it is the
function checking who you are, not the data — so nothing a person taps may
wait on one. Measured with `tools/speed-test.js` (CPU 4×, 4G, a GitHub-Pages
copy of the headers), before → after:

| | before | after |
|---|---|---|
| 继续 → home | 2.6 s | 1.2 s |
| tap a tile → the score moves | 1.1 s | 0.04 s |
| 积分表 / 历史 / 情书 / 商店 open with content | 1.3 / 0.8 / 0.6 / 0.7 s | instant from the second open |
| 小窝 furnished | 1.5 s | 0.85 s |
| API calls per open | 15 → 10 |
| downloaded per open | 195 KB | 16 KB |

What made the difference, and what must not come back:

- **Show what the phone has, then catch up.** 积分表, 历史, 情书 and the
  shop open on the cached lists and redraw only if the server's answer differs (a redraw
  replays the rows' rise-in, so an unchanged answer must not cause one). 历史
  shows 加载中 until it has really fetched — `S.historyRecords` starts as
  `[]`, which must not read as "no history".
- **Points are optimistic** (`_saveRows`). Rows join the ledger under a
  local id at the tap; the POST's answer gives each its real id, or takes it
  back out with a toast. `refresh()` stays the only reader of the server's
  list: it keeps rows still in flight (`_inFlight`) and a row seen twice — a
  refresh that lands after the insert but before the answer — counts once.
  Edit and delete wait for the real id. A refused 自定义记分 reopens the form
  with the note. `tools/instant-test.js` holds saves back, refuses them and
  races refreshes against them on the live backend.
- **Never load the same thing twice.** The splash already loaded the couple
  with the saved session; 继续 still checks the password (on purpose, §0 —
  commit 5c88fff) but then reuses that load (`_bootWarm`) and refreshes
  behind the open home page. If that early load fails after 继续 has signed
  in, it must not log the new session out (`_logins`).
- **Independent requests go together.** `/entries` goes out with the four in
  `Data.init()` (used once, and only if nothing was written since —
  `_writeGen`, bumped by every non-GET); rewards with punishments; history
  with letters and photos; the room's stats with its furniture.
- **app.js is loaded by its ETag.** A HEAD asks which app.js is live and the
  script tag loads `app.js?e=<etag>`: the same version comes from the cache, a
  deploy changes the URL. `?v=Date.now()` downloaded 170 KB on every open. Two
  traps found on the way (`tools/loader-test.js`, Chrome + WebKit): a
  `Cache-Control: no-cache` *request header* on fetch() makes Chrome skip its
  cache entirely, and WebKit's fetch() did not use the cache at all where a
  plain script tag did.
- **The song is `preload="none"`** — it starts on the splash tap anyway, and
  pulling 2.6 MB at page load raced app.js for the phone's bandwidth.
- **Measuring:** `page.route()` turns the browser's HTTP cache off, so a test
  that routes anything sees every open as a first visit. `speed-test.js` keeps
  weather out by DNS instead, and serves the repo with GitHub Pages' headers
  (python's http.server sends none).

---

## 8. 🚀 Shipping checklist

```
□ node --check app.js
□ Bump APP_VERSION in app.js (and app-html-v in index.html if HTML changed —
  BOTH, matching: HTML_V in app.js must equal the meta. See §7.27)
□ Deploy any changed function:  npx supabase functions deploy <slug>
□ Drive the real flow in a browser — don't trust that it "should" work
□ Check BOTH light and dark
□ Check phone (390) + iPad (820) + laptop (1280) if layout changed
□ Re-run: node supabase/test-full.mjs         (backend, 116 checks)
  (+ node supabase/test-games.mjs when game-save changed)
□ Re-run the browser suites in tools/ that touch what changed
  (settle-test.js, season-test.js, anniversary-test.js, room-test.js, birthday-test.js, identity-test.js, ui3d-test.js, games-test.js,
  fireworks-live-test.js, smooth-test.js, instant-test.js, coop-test.js,
  coop-live-test.js, coop-net-test.js, coop-stars-test.js, home-test.js,
  home-live-test.js, sync-live-test.js, nav-test.js — serve the repo
  on :8765 first, or any port with APP_URL=http://localhost:PORT/index.html;
  loader-test.js and speed-test.js serve it themselves)
□ node supabase/cleanup-test-accounts.mjs --yes   (the suites leave couples behind)
□ git commit + push (GitHub Pages auto-deploys)
```

**Deployment reality:** both halves now deploy by command — the frontend on
push, functions via the CLI. Nothing is pasted by hand any more, so the old
advice to batch up schema requests no longer applies; a column is
`alter table … add column` and a function is one deploy.

Two things that are still true:
- **A function is deployed independently of the frontend.** Deploy the
  function first when a change spans both, or the pushed app calls an
  endpoint that doesn't answer yet.
- **Supabase CLI 3.x** (2026-11-18) refuses to read `supabase/config.toml`
  without a top-level `project_id` (now there — a local name only), and when
  an agent runs it, it will not deploy to production until the user has said
  yes (`--yes`). Ask; don't pass it on your own.
- **The service-role key lives only in the function runtime.** It must never
  reach `app.js`, which ships publicly. The client gets the publishable key,
  which is safe precisely because RLS is `SELECT`-only.

---

## 8.4 💾 Backups

A managed database is not a backup. Supabase removes the "the instance may be
reclaimed" risk that the old free PDI carried, but an accidental delete, a bad
migration or a closed account still lose everything just as completely. Weekly
runs are load-bearing, not optional.

- `node tools/backup.js` — writes `backups/<timestamp>.json`: every table,
  plus each photo's **bytes** embedded as base64.
- `tools/install-backup-schedule.sh` — macOS `launchd`, every 7 days,
  `StartInterval` (not `StartCalendarInterval`) so a week missed while asleep
  fires on next wake instead of silently skipping.
- `backups/` and `tools/backup.local*.json` are gitignored — this repo
  deploys **publicly** on every push, and they hold a live key plus the
  couple's private letters and photos.

**It authenticates with a service key, deliberately not a login.** The first
version signed in as a partner and that was wrong three ways: it needed
somebody's password to set up, the session expired while the job runs weekly,
and Supabase revokes every session when a password changes — so the backup
would have silently stopped the next time either of them changed theirs. A
backup that quietly stops is worse than none, because you believe you have
one. The key also bypasses RLS, which is what lets one run capture **both**
partners' bags.

That last point was a real gap, not a hypothetical: ServiceNow's `/bag`
filtered to the caller's own rows, so every backup ever taken silently omitted
whichever partner wasn't logged in — and at migration time YY's seven
unredeemed items had to be read off a screenshot because nothing had them.
An `r41` resource was written to fix it and never deployed. If you ever add a
per-person endpoint, ask what the backup sees.

Two details worth keeping:
- **PostgREST caps a response at 1000 rows.** This couple is past 500 entries
  already, so the read pages explicitly. A cap that silently truncates an
  archive at a round number is the same class of bug as §4.5.
- **Photo bytes, not URLs.** Storage hands back signed URLs that expire; an
  archive full of dead links is not an archive.

The ServiceNow credential is parked at `tools/backup.local.servicenow.json`
for the rollback window and can be deleted once that instance is retired.

---

## 8.5 🛠️ Maintenance mode

`MAINTENANCE.on` at the top of `app.js` closes the app: the login form is
replaced by a notice AND a saved session is not auto-resumed (otherwise
whoever was already signed in keeps using a half-updated build).

- Reopen: set `on: false`, push.
- Test the real login while it's closed: visit `?dev=1` once (sticks on that
  device); `?dev=0` clears it. Convenience gate, not a security boundary.
- Local Demo stays reachable either way.
- **Browser tests must call `App.demoMode()` directly**, not click
  `.demo-link` — that link lives inside the hidden login card.

---

## 9. 🧪 Testing

| Suite | Covers |
|---|---|
| `node supabase/test-full.mjs` | 116 live checks against the real backend: auth + pairing, scoring, settle (incl. stale previews, simultaneous settles, backdated entries), shop, buy, bag, claims, decor (incl. the free 周年 gift), letters, photos, avatars, cross-couple isolation, unauthenticated refusal |
| `node supabase/test-anniv.mjs` | 周年悄悄话: sealing, the server-side date lock, and every way round it |
| `node tools/anniversary-test.js` | 周年小电影 + 悄悄话 UI in a browser, faked clock (serve the repo on :8765 first) |
| `node supabase/test-api.mjs` | Narrower slice — auth, config, categories, entries, RLS bypass attempts |
| `node tools/season-test.js` | Seasons by faked clock: every theme boundary through 2030, the limited-stock calendar, the drop cards, each festival's home sky / room / pet / outfit, reduced motion, keepsakes that expire, and 周年 (theme, free gift, claim, placement, midnight) |
| `node tools/artsheet.js [--season 万圣节,秋] [--date …]` | Not a test — pictures to LOOK at: the catalog at true size, a furnished room day/dusk/night, the shop tabs |
| `node tools/birthday-test.js` | 生日惊喜 in a browser: dates (2/29, age), both phones, preparing and sealing, the teaser, 00:00 with the app open, nothing prepared, typing at midnight, a moved phone date against a mocked server, the 🎂 tab, every scene at 360–820, replay |
| `node supabase/test-surprise.mjs` | 生日惊喜 live: birthdays in config, sealing, the early read and the "was anything prepared?" leak, spoofed zone, third couple, direct Postgres, moved birthday, delivered rewrite, three opens → one coupon, the receipt |
| `node tools/ui3d-test.js` | 新外观 and the login screens: off by default, the 设置 switch, the ＋ sheet saving a real entry, the 月末结算 chip, entry actions on tap, tilt, the room's light letting taps through and never moving furniture, turning it off cleanly, reduced motion, 360/390/820 both themes. Run the other browser suites again with `?look=classic` in `APP_URL` (they run in the new look by default) |
| `node tools/identity-test.js` | "Who am I" with the whose-points switch on the partner: weather slots, letter/photo authorship (server-stamped), who may open, rewrite or delete a letter — live backend, local app |
| `node tools/room-test.js` | 小窝 taps and placement: a piece behind the pet can be picked up, the pet still reacts, bubble/rug don't block, new pieces land in view (360/390/820) |
| `node supabase/test-live.mjs` | The couple's live channel, attacked: both partners join and hear each other; no login, another couple, a made-up id and the public door are all shut out |
| `node tools/fireworks-live-test.js` | Shared fireworks with two logged-in phones on the live backend: the same shell both ways, different screen sizes, one toast per volley, taps that are not for the sky, junk on the wire, background/foreground, ordinary nights open no connection |
| `node tools/smooth-test.js` | Frame pacing with the CPU slowed 4×: home, scrolling, the ＋ sheet, sheets, 小窝, both games, 我们的时光, and each firework show while tapping and scrolling. Fails under 50 fps or on a stall over 120 ms. Run it alone |
| `node tools/instant-test.js` | Taps that answer at once (§7.41), on the live backend: points move before the POST answers, a refused save is taken back, a refresh mid-save neither loses nor doubles a row, 签到 double taps, a refused 自定义记分 keeps its note, 积分表/历史 open before the server answers, 继续 doesn't reload the couple, an early /entries is dropped after a write |
| `node tools/speed-test.js` | Not pass/fail except for a few budgets — the table of what a phone waits for (CPU 4×, 4G, GitHub Pages headers): open, 继续, a tile, each screen, KB and calls per open. Compare medians, never one run. `ROOT=<dir>` measures another copy (e.g. the live version) |
| `node tools/loader-test.js` | The app.js loader in Chrome and WebKit: a deploy reaches the next open, an unchanged app.js is not downloaded again, a failed HEAD or no fetch still boots |
| `node tools/games-test.js` | 小游戏: the payout tiers, one payout per person per game per day (derived from the entries, not the flag), tomorrow pays again, the pet catching for real, cards from photos with fallbacks, 360/390/820 both themes |
| `node tools/coop-test.js` | 一起回家 and 默契拍拍 in the real app: the bot clears all 50 levels (one phone and alone), first-clear payouts and the +3 cap, the no-pet case, 360/390/820 both themes |
| `node tools/coop-stars-test.js` | Every ⭐ and 💗 in 一起回家 can be taken, with the real physics: jumps, stacks, springs, updrafts, rides, lifts, with and without the partner holding the buttons — and no star only by a perfect jump (a 10% weaker jump must still do it) |
| `node tools/coop-live-test.js` | The same games on two logged-in phones, live backend: mirrored moves, hearts, stacking, held gates, pause, both paid on a win, the two-person box, the seesaw, the guest's stomp, 同心锁, wind, portals, the button-driven wheel, the storm, lanterns, the cannon fired from the other phone, the vents' shared clock and the partner's button putting them out, leaving, 默契拍拍's shared verdict |
| `node tools/coop-net-test.js` | The same two phones over a simulated phone network: how evenly the partner moves (good / 4G / poor), stacking and the box on 4G, nothing lost when a socket drops (heart, star, flag, hit, win), a locked phone pausing both through a 27 s call, a partner gone for good, simultaneous picks, 下一关/重来 with a lost request, falls, gift blocks, crumbling clouds, stomps, the same login on an iPad, token renewal and refusal, 默契拍拍 verdicts through jitter and a drop, a 90 s soak, two slow phones. `PHONE_B=webkit` for an iPhone partner |
| `node tools/nav-test.js` | 首页 · 积分 · ＋ · 一起 · 商店 (§7.36, `ONLY=…`, `LOOK=classic`): the bar in order in both looks, every page and pane and the old names landing in them, 今天's rows and each button (and YY's side), 本月 = the score card, the four tiles staying put, every 一起 tile opening its place, the shop under the bar, ＋ on top from every page, 320–1280 by day and night with nothing under the bar or off the side, keyboard, reduced motion, HTML_V = the meta |
| `node tools/home-test.js` | 我们的家 on demo data and a faked clock (`ONLY=…` sections, `BROWSER=webkit`): the garden rules on their own (five waterings, two a day together, three dry days droop, the saving watering doesn't count, one flower picked once), a week of tapping through it, seeds opening with flowers and festivals, every way to move incl. stairs and the view following, upgrades and festival pieces from the one wallet, festivals by date (12-24 is both 周年 and 圣诞), a save whose answer is lost, offline actions kept across closing, the 客厅 = the 小窝, the full-screen layout at 360×740 / 390×844 / 430×932 / 844×390 / 820×1180 / 1280×800 both themes (the house under the top buttons, the bottom buttons off the floor), reduced motion, and the screen used only by its buttons: the welcome, every menu closed four ways, a whole week of gardening by the 「下一步」 chip alone, and a laptop playing it all from the keyboard (§11: held walking, blur, stairs, Space, E, H/J/K, 1–4, Esc, ⌘ left alone, the key labels — and none on a phone) |
| `node tools/home-live-test.js` | 我们的家 on two logged-in phones, live backend: arriving and leaving, tap and hold walking mirrored, wave and hug, one garden across phones, both watering at the same instant (both count), both picking one flower (picked once, the loser told who), two seeds for one pot, an upgrade built on both, watering a pot the partner planted a moment ago before their save arrives (§8a — it waits, it is not lost), sitting together, the off-screen tag walking you to your partner, where you left |
| `node supabase/test-games.mjs` | game-save, attacked: compare-and-set (stale writes, six rounds of simultaneous writes), the flower count that only grows, bad requests, one house save, each person's own progress slot (the partner reads, can't write), another couple, direct Postgres |
| `node tools/sync-live-test.js` | One person on a phone and an iPad, live backend: 一起回家 levels/stars/times, paid levels and 接零食 records follow from one device to the other; a level paid on one doesn't pay on the other; separate changes merge (the faster time, every star); the garden is the same on both; the second device isn't taken for the partner |
| `node tools/settle-test.js` | 月末结算 in a browser: backdated entries, 补记 rounds, the 409 stale path against a mocked server, double tap, midnight, 年度回顾 and pet EXP over multi-round months |
| ~~Browser tests (scratchpad)~~ | **Gone.** `regression_reported.js`, `icon_sweep.js`, `number_oracle.js`, `artsheet.js`, `art_verify.js`, `responsive_test.js`, `days_test.js`, `bounce_test.js`, `split_weather_test.js` and the pet audit lived in a session scratchpad, which is wiped between sessions — none of them exist any more. The sections below still describe what they checked, which is worth keeping. **Every new test goes in `tools/` and gets committed.** |
| `servicenow/test-*.sh` | **Historical.** Tests the ServiceNow backend, which nothing uses. Kept only while that instance is the rollback. |

The suites register throwaway couples each run — safe to re-run any time.
They do not clean up after themselves, so delete the leftovers when done
(usernames are prefixed `t…` / `f…` and are easy to spot in `profiles`).

**Isolation is tested by attacking, not by reading config.** The suite makes
a third couple and has them try to edit, delete, buy and claim against the
first couple's rows, then re-reads those rows to confirm nothing moved. It
also uses a *genuine logged-in session* to PATCH Postgres directly — which
answers `204`, looking like success, while changing nothing. Assert the value
afterwards; the status code alone would have told you the opposite.

**When a bug is found: add a test that reproduces it before fixing.** Sections
24 (missed settle) and 26 (couple parity) exist because of real reported bugs.

### 9.0 `regression_reported.js` — every reported bug, in one file

One file replays **every issue actually reported** plus the ones found while
fixing them. If a line there goes red, that exact bug is back. Add to it
whenever something is reported; it is the cheapest guard in the suite and it
already caught a silent regression of the 年度回顾/共同目标 mismatch.

**That regression is worth understanding.** Both figures were "fixed" to use a
net basis, and both did — but they floored at different *granularity*:
`lifetimeCombinedPoints` floors **per person** (`max(0,c1)+max(0,c2)`), while
the recap summed a month into one lump and floored that once. Identical for a
happy month; with char1 +200 and char2 −40 they read 200 and 160. The first fix
only ever got tested with both partners positive. When two figures must agree,
test them with **one side negative, both negative, and with settled history** —
not just the happy path.

### 9.05 A YAML block scalar swallows anything at column 1

`season-check.yml` silently stopped running for two commits: a `gh issue create
--body "$(cat <<BODY …)"` heredoc put its content at column 1, which closes the
`run: |` block and makes the rest parse as new top-level keys. GitHub reports
this as a run that *failed with zero jobs*, and shows the workflow's **filename
instead of its `name:`** — that pair is the tell. Never build multi-line text
inside a workflow; emit it from a script (`season-plan.js --issue`) and pass
`--body-file`. Validate with `yaml.safe_load` before pushing.

### 9.06 Four things the migration only found by testing

All four passed review and failed a test. Recorded because each is a shape
that recurs, not a one-off.

1. **A CHECK constraint can quietly outlaw real data.** `bag.source_type`
   allowed `purchase` and `reward` — but furniture writes `decor`. Every
   piece the couple owns, including year-locked keepsakes that cannot be
   re-bought, would have been rejected at insert. When porting an enum,
   enumerate from the *writers*, not from memory.
2. **Being stricter than the old system is still a regression.** ServiceNow
   never blocked deleting a shop item that bag rows referenced; a real FK
   does. Deleting a bought item started failing. `ON DELETE SET NULL` — the
   bag already snapshots name and icon, so history survives without the link.
3. **The command line is not a browser.** Everything passed with `curl` and
   then the app could not log in at all: a browser preflights any request
   with a custom header, and the functions answered `OPTIONS` with 405. Test
   at least one real request from a real page origin.
4. **Success can revoke your own session.** Changing a password invalidates
   every token, so the next call 401s and the app reports the *successful*
   change as a wrong password. Anything that rotates a credential must hand
   back a new session, and a "wrong password" must not share a status code
   with "no valid session" (403 vs 401).

### 9.07 `until(async () => T(a) && T(b))` always passes

`T()` returns a promise, so `T(a) && T(b)` is a promise — truthy — and the check
returns on its first try without looking at either phone. Two checks in
`coop-live-test.js` (「each screen says the other is here」 and the 同心锁 opening on
both phones) and one in `coop-net-test.js` had passed this way since they were
written; the test then tapped a level before the phones had found each other and
passed only on timing luck, until a one-second delay before opening the game made
it fail. Await each side: `(await T(a)) && (await T(b))`. Found 2026-11-25.

### 9.1 Writing tests that don't rot

- **Assert semantics, not storage encoding.** Tests that read
  `JSON.parse(petEquipped).items[1]` all broke when the blob was compacted —
  they were checking the format, not the behaviour. Go through the app's own
  parser (`App._parseEqTest`) so an encoding change is free.
- **Never hard-code an operational toggle.** `maint_test` asserted the login
  page was locked; the moment the system went live it "failed" while the app
  was perfectly correct. Read the shipped flag (`App._maintTest().on`) and
  assert the matching expectation, and force the flag on to exercise the
  locked path even while live.
- **Load the data source before reading derived state.** `S.decorOwned` is
  only fetched in `showPetHome()`, so reading the wallet straight after boot
  reports 0 spent — a false pass. Drive the real flow.
- **Verify a failing assertion is the app's fault before "fixing" the app.**
  Several red lines this round were wrong test setup (free starter items cost
  0; a 34-item blob that never exceeded the cap).
- **Build an oracle for number-heavy screens.** `number_oracle.js` hand-computes
  every displayed figure from a seeded couple, which is what proved 年度回顾
  and 共同目标 finally agree.
