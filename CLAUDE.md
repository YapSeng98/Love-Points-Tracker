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
