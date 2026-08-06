# 恋爱积分簿 — Engineering & Design Rules

Read this before changing anything. Every rule below exists because something
actually broke in production and the user had to report it. Re-reading this is
cheaper than shipping the same bug twice.

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
**Happened three times.** Bare, short class names in a single global
stylesheet silently apply to unrelated components.

| Incident | Symptom |
|---|---|
| `.sun` (ambient sky) vs `.cal-cell.sun` (Sunday) | Sunday cells grew rotating sun rays and flew out of the calendar grid |
| `.c1`/`.c2` (clouds) vs `.dot.c1` (pet legend) | A blue ball drifted across the screen every 22s |
| `.star` | Same family of risk |

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

The ServiceNow instance runs in a timezone **behind** the users (UTC+8), so
`new GlideDateTime().getLocalDate()` is *yesterday* for most of their day.
This shipped a bug where purchases were dated one day early.

**Rule:** the app sends its own local `date`/`month` in the request body;
resources only fall back to the server clock when the client omits it.
Applies to: entries (05), shop buy (28), bag use (30), claim (32), letters
(34), photos (38).

Use `todayStr()` / `monthKey()` in `app.js`. **Never** `toISOString()` — it's
UTC and rolls a day early for UTC+8 users.

---

## 3. 🗓 Entries are scoped by "unsettled", NEVER by calendar month

`u_month` is a *label*, not a filter.

The original `GET /entries` filtered `u_month == current month`. The moment
the real-world month rolled over without a 月末结算, an entire month of
entries became invisible and the score silently reset to 0 — the user thought
their data had been deleted.

**Rules:**
- `GET /entries` (04) returns everything with `u_monthly` empty. No month filter.
- Score-sum queries in `/shop/buy` (28) and `/bag/claim` (32) must match, or a
  purchase the UI shows as affordable gets rejected as "insufficient points".
- Settling stays per-month: the frontend groups entries by their own `u_month`
  and calls settle once per group, so a missed month becomes its own history row.
- **Never auto-settle the current, still-running month.** Past months are swept
  automatically; the current month is opt-in via a checkbox, default OFF when
  there are older months pending.

---

## 4. 🐣 Derived-state rules (badges, recap, pet)

Prefer **deriving** state from existing data over storing it — it can't drift,
and it needs no ServiceNow migration. But watch these traps:

1. **Monotonic values need a stored floor.** Pet EXP is derived, but
   punishment-mode settlements archive negative totals and deleting a photo
   claws back its EXP — both would shrink the pet. Solution: store a
   high-water mark that the server refuses to lower.
2. **A "starts from zero" feature needs a baseline snapshot.** The pet stores
   `u_pet_base` at adoption so it doesn't inherit months of history and hatch
   at max level.
3. **Settlement empties `/entries`.** Anything derived from recent entries
   (e.g. pet mood) collapses the instant a month is settled. Mood counts a
   recent `settledAt` as activity to compensate.
4. **A "sad/empty" state must be reachable.** Pet mood had a baseline of 30
   but the sad threshold was 20 — the entire come-back-and-play mechanic was
   dead. Check that every state in a state machine can actually occur.
5. **Rebase EVERY value derived from a number you rebase.** `u_pet_base` made
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

`u_pet_equipped` holds a two-letter `k` per piece, never the id. Ids are
readable (`mooncake_box_27`) but average 11 characters, and at 32 pieces they
alone cost **349 of the 1000** the field allows — a fully furnished room hit
**939/1000, 6% spare**, which two more years of keepsakes would have pushed
into silent truncation. Codes took the same room to **651/1000**.

- `k` is **explicit in the catalog and must never be reassigned** — it is the
  only link between a saved room and its furniture.
- `parseEquipped` accepts a code *or* a bare id, so rooms saved before codes
  existed keep loading; they convert on the next save.
- An unknown code is preserved verbatim, never guessed at.
- Ids stay untouched because the ServiceNow bag rows reference them.

---

## 4.5 🗄 Fixed-size ServiceNow fields vs. unbounded user content

`u_pet_equipped` is `String(1000)`. It was sized when the room had fixed slots
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
| entries ledger, categories | milestone claim flags (`u_claimed_1/2`) |
| rewards & punishments lists | the character you're scoring for |
| history, shop, letters, photos | |
| shared goal, pet (name/species/EXP) | |

Anything shared is scoped by `u_match`; anything per-person also by `u_char`.
Cross-couple access must return 404 or an empty list — never another couple's
data. Section 26 of the test suite enforces all of this.

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

`u_wx_1` / `u_wx_2` — **one slot per partner**, each phone writing only its
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

---

## 7.26 🏠 Home layout: hero + duo + rows

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

Cold load **317ms**, DCL 56ms, 432KB, 818 nodes. With a year of data — 220
entries, 120 letters, 40 photos, 24 settled months — home renders in **268ms**
at 2780 nodes, the slowest screen switch is 13ms, and the heap sits at 6MB.
DOM plateaus: 48 open/close cycles of the pet room and 20 weather flips add
zero nodes. If a change pushes any of these materially, find out why.

---

## 8. 🚀 Shipping checklist

```
□ node --check app.js
□ Bump APP_VERSION in app.js (and app-html-v in index.html if HTML changed)
□ Drive the real flow in a browser — don't trust that it "should" work
□ Check BOTH light and dark
□ Check phone (390) + iPad (820) + laptop (1280) if layout changed
□ Re-run: servicenow/test-full-system-v2.sh   (server, 134 checks)
□ Re-run the pet logic audit                  (client invariants, 23 checks)
□ If a resource script changed → tell the user EXACTLY which files to
  re-paste in ServiceNow, and which table fields to add (type + max length)
□ git commit + push (GitHub Pages auto-deploys)
```

**Deployment reality:** the frontend deploys on push, but ServiceNow scripts
are pasted **by hand**. So: minimise resource changes, batch table fields into
one request, and prefer hanging new fields on the existing `u_love_config` row
over creating new tables. Always add fields that a planned next phase will
need (e.g. `u_pet_equipped`) so the user isn't sent back a second time.

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
| `servicenow/test-full-system-v2.sh` | 148 live checks against the real instance: scoring, settle, shop, bag, letters, photos, claims, isolation, auth, goal+pet config, couple parity |
| `servicenow/test-dates.sh` | Timezone regression (purchase/use/claim dates) |
| Browser tests (scratchpad) | Pet invariants, settle UI, layout sweep, art sheet |

The suite registers throwaway couples each run and leaves a seeded review
account — safe to re-run any time.

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
