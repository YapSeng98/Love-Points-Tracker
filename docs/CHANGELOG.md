# Changelog

What changed, when, and **why** — the part `git log` can't tell you at a glance.
Newest first. Dates are the day the change went live on GitHub Pages.

> This file is committed to a repo that **deploys publicly**. Keep it to what
> changed in the code. No scores, no letter or photo content, no credentials —
> those live in `backups/`, which is gitignored for exactly that reason.

For the full detail of any entry: `git log --oneline` and read the commit
message. They are written to explain the reasoning, not just the diff.

---

## 2026-11-26 — ♾️ 一直走下去, an endless road in 一起回家

一起回家 gets a mode that never runs out: one 段 after another, each in a new
world, with ground made new for every run between that world's puzzles. It gets
harder as you go — more puzzles, wider gaps, more and faster walkers, the storm
chasing you every 4th 段, the night going dark from 段 5. Each 段 walked gives back
one heart; the run ends when the hearts are gone. Your farthest run is kept on
every phone you use, and the first time you get 3, 6 and 10 段 far is +1 each
(inside the usual +3 a day). It works on two phones like the levels: one of you
taps 一起出发 and you both walk the same road.

## 2026-11-25 (night) — 🧩 照片拼图

A new mini game: slide the pieces of one of your own photos back into place.
「今日拼图」 is one photo a day — the same photo on both phones — in 3×3, 4×4 or
5×5 for +1 / +2 / +3 (like the other games, at most +3 a day). Every 今日拼图 you
finish is hung as a polaroid on a string in 我们的家's living room. No photos
yet? You get a drawing of the two of you until you add some in 我们的时光. On a
laptop the arrow keys slide the pieces.

## 2026-11-25 (evening) — a clearer home page, and five buttons at the bottom

The home page was one long scroll with a dozen things the same size. Now it
shows the two of you and today first: one card at the top holds both of you,
the days together, the weather and 奖励 / 惩罚 mode; under it, 「今天」 lists only
what is still to do — check in, water the garden, open a sealed letter, play a
game, settle a month left open — each with its own button, and what is done
turns into ✓. Then this month's progress, and the four scores you use most.
The page is about 40% as long as before.

The bottom bar is now 首页 · 积分 · ＋ · 一起 · 商店, the same on every page:
- **积分** — this month (whose points, the score card, every score, the list),
  past months, and the reward / punishment tables, switched at the top.
- **＋** — add points from anywhere.
- **一起** — 我们的家, 小窝, 共同目标, 小游戏, 情书 and 我们的时光, each saying what
  is waiting there.
- **商店** — the shop, with the bar still underneath.

⚙️ 设置 is in the top-right corner of every page. The colours, the sky, the
moon and the two dogs are unchanged; nothing was removed, only moved.

我们的家 on a laptop can be played from the keyboard: hold ← → (or A D) to
walk, ↑ ↓ (or W S) for the stairs, Space for 「下一步」, E to water or pick at
the pot you are standing by, H 抱抱, J 招手, K 坐下, 1–4 for the menus. Each
button shows its key on a laptop.

Fixed: if one of you planted a flower and the other watered it within about a
second, the watering could be lost. It now waits for the planting to be saved.

## 2026-11-25 (later) — 我们的家 goes full screen

The house now fills the whole screen like a game, and is about twice as big on
a phone held upright; the view follows you through the house. Everything else
is behind labelled buttons: ❓ 玩法 (how to play), 🌱 花园 (every pot, the album),
🏠 房子 (upgrades) and 🎁 小店 (festival pieces) open as sheets. ◀ ▶, the stairs,
抱抱, 招手 and 坐下 sit at the bottom, on the lawn, never over anyone's feet.

A blue chip under the menus always says the most useful thing to do now — water
a drooping plant, water today's pots, pick a flower, plant a pot — and one tap
does it. A first visit opens with a three-step welcome. When your partner walks
off your screen, a 「‹ 名字」 tag at that edge walks you over to them. A phone
turned on its side keeps the house big by moving the menus into the top row.

It fits every screen we could find — from a folded Galaxy Fold and a first
iPhone SE to an iPad and a desktop, upright and sideways: on narrow phones the
buttons at the bottom get smaller, 抱抱 only appears when you are standing next to
each other, and nothing overlaps. In 一起回家 your partner now shows up as
「也在这里」 as soon as they open it, instead of up to a second and a half later.

Your game progress now lives in your account, not on the phone: 一起回家's
levels, stars and best times, which levels have already paid their point, and
your 接零食 / 翻牌 records follow you to every phone and iPad you log in on. Two
devices that played separately merge — the faster time, every star — and a
level that paid on one doesn't pay again on the other.

## 2026-11-25 — 我们的家: a house and garden the two of you share

A new place, opened from its own card on the home page and from the 小窝: the two
of you walk around one house, each on your own phone, and see each other move,
wave, hug and sit down together on the sofa. The pet follows whoever moved last.
The 客厅 is your own 小窝 — the same furniture where you put it, the same
wallpaper.

The garden is real and slow on purpose. Each of you can water each pot once a
day; a flower takes five waterings, or three days if you both water (that day
it grows two steps). A pot nobody waters for three days droops until somebody
does. A flower picked goes into the 花园图鉴 and is pet EXP +20 — so 小窝币 +10.
Picking flowers opens new seeds (郁金香 at 3, 绣球花, 薰衣草, 月光花 at 15, which
glows blue at night), and each festival brings its own seed (桃花, 玫瑰, 桂花,
南瓜, 圣诞红, 永生花) that can be planted only around that festival.

The house grows: 小平房 (600 小窝币: a bedroom, a third pot, a pet house) and
两层小楼 (1500: kitchen, stairs, an upstairs bedroom, a balcony with two more
pots, a pond), paid from the same wallet as the 小窝's furniture. A bigger house
is wider than the screen and the view follows you. Festivals dress the house by
date (snow and lights at 圣诞, 福 at 春节, hearts at 情人节, bats at 万圣节 after
dark, the big moon at 中秋, a banner on your anniversary), and a small shop sells
festival pieces that come out again by themselves every year.

The garden is one save on the server (a new table and function, `game_saves` /
`game-save`). Every write is compare-and-set: when both phones act at the same
moment, both waterings count, a flower is picked once, one seed wins a pot, and
whoever lost the race is told who got there first. Actions taken offline wait on
the phone and are sent on the next visit.

---

## 2026-11-24 — Smoother games, 沙漠 and 火山, ten more levels

All four games do much less work per frame. On a phone slowed four times, the
main thread went from 44% to 15% busy in 接零食, 38% to 9% in 翻牌, 39% to 10%
in 默契拍拍, and from 32% to 2% with a game simply open. Most of it was the home
screen still animating under the game (about 60 animations nobody could see);
it now holds still while a game is up. 接零食 also stopped re-measuring the page
every frame and draws each emoji once.

一起回家 draws its far layers (sky, sun, hills) on their own lower-resolution
canvas behind the game, which took every level from 20–34 fps to 56–60 fps when
the canvas is drawn by the CPU, as Safari draws shapes. The night levels'
darkness is drawn small and stretched by the GPU.

Looks: 接零食 has a real scene, treats that sway with shadows, sparkles and a
happy bounce on a catch, a time bar and a combo counter. 翻牌 bounces a found
pair and lets a heart float up. In 一起回家 every world's far landmark (windmill,
lighthouse, mountains, castle, shipwreck) is now actually on screen on a phone
held upright, and the night fireflies drift instead of falling like snow.

Two new worlds before 夜, 5 levels each, 50 levels in all: **沙漠绿洲** with a
cannon (one stands in it, the other steps on the button) and quicksand (you sink
and can only hop; your partner's head is the way out), and **火山探险** with fire
vents that flare on a timer and go out while your partner holds the button (or
when you push a box onto them), lava in every pit, and hot air that lifts you.
Both phones need this version to play together.

## 2026-11-24 — 一起回家: every star can be reached, two new worlds, music

Some stars were impossible: seven hung higher than anyone can reach, even
standing on each other, and five more only worked with a perfect jump. All of
them were moved, and a new test plays every star and heart in every level to
make sure each one can be taken with an ordinary jump. There are two new
worlds, 糖果乐园 and 海底世界 (where you float and jump higher), so 40 levels in
eight worlds. Every world now has its own background scene, softer hills,
grassier ground and dust when you run; taking a star sparkles on both phones;
and each world plays its own little tune while you play (silent when paused or
with the sound off). Records and progress carry over. Both phones need the new
version to play together.

## 2026-11-22 — 一起回家: no more lag, 30 levels, new ways to help each other

On two phones, your partner now moves on your screen almost exactly when they
move on theirs (before, they trailed a quarter of a second or more), and the
game sends about a third of the messages it did. There are now 30 levels in
six worlds — the new one is a date at the 游乐园 — and no puzzle repeats.
New things to do together: 同心锁 hearts you both have to press at the same
moment, fans that blow only while your partner holds the button, portals,
conveyor belts, a Ferris wheel, a night forest where only the two of you give
light, and a storm that chases you both. Springs now bounce you when you walk
onto them, coming back after a fall puts you beside your partner instead of on
their head, and if you are stuck your pet reminds you of the hint. Old records
start fresh for the new levels, but nothing you had unlocked is locked again,
and each new level pays its first clear.

## 2026-11-20 — Playing on two phones holds up on a phone network

Tested again over a simulated phone network, which turned up problems a good
connection hides. Your partner now moves smoothly on your screen even on a
patchy connection (before, they could stutter and jump). Nothing is lost if a
connection drops for a few seconds: hearts, stars, flags, hits and the win all
reach the other phone when it comes back. Locking your phone or taking a call
pauses the game on both phones, and after 继续 nobody is told the other has
left. 默契拍拍 always gives both phones the same score, even when a tap
arrives late. If both of you pick a level at the same moment, CS's pick wins.
If the other phone still has the old app, the game says to reopen it.

## 2026-11-20 — 一起回家 and 默契拍拍: games for two

Two new games at the top of 🎮 小游戏, made to be played together, each on
your own phone (or both on one phone, or one person switching between the
two). 一起回家 is a 20-level adventure through spring, summer, autumn, winter
and a starry night where you can only get home by helping each other: stand
on each other's heads, hold buttons open, push a box together, throw each
other with the seesaw, and stomp the big cloud. Your own 小窝 pet comes along.
默契拍拍 is five rounds of tapping on the same heartbeat. The first clear of
each level gives +1 to whoever is holding the phone, up to +3 a day per game.

## 2026-11-20 — Everything answers the tap

Points now land the moment you tap: the score moves, the toast shows, and the
save finishes in the background. If the save fails, the points are taken back
and the app tells you, and a 自定义记分 that fails reopens with your note still
in it. 积分表 and 历史 open instantly instead of after a second. After 继续, the
app no longer loads everything a second time (the opening screen already did),
so you're on the home page about twice as fast. Opening the app no longer
downloads all of app.js every time, and the music no longer downloads before
you tap.

## 2026-11-17 — Fireworks you set off for each other

On a firework night (周年, 跨年, 春节, 情人节), tap the open sky at the top of
the home page to launch a firework where you tapped. If your partner has the
app open, the same firework goes off on their phone a moment later, and it
tells them who sent it. 周年 now gets the full show, in pink and gold with
hearts. Also fixed: after signing in fresh, your weather was not sent to your
partner until up to 20 minutes later.

## 2026-11-17 — The mini games get levels and records

接零食 now goes level by level: each level wants more treats in 15 seconds and
falls faster, with ⭐ worth three, 🌶️ costing two and 💣 costing one of three
hearts. 记忆翻牌 has four levels (6, 8 and 10 pairs) with a limit on moves.
Points follow the levels you clear, up to +3 a day per game; a better run later
the same day adds the difference. Each game remembers your best run on your
phone, and 小游戏 is now a card on the home page.

## 2026-11-17 — Two mini games

小窝 has a new button, 「和它玩小游戏」. 接零食: slide your pet to catch treats
for 20 seconds. 记忆翻牌: find six pairs made from your own photos (also
reachable from 我们的时光). Each game gives each of you a few points once a day
— up to +3 — and shows up in 本月记录; after that you can keep playing for fun.

## 2026-11-17 — Tick several in 记一笔; real fireworks

The ＋ sheet now lets you tick as many items as happened — from 加分 and 扣分
together — and saves them all with one tap; the button shows how many and the
total. Nothing is ticked when it opens.

On 跨年 and 春节 nights the home sky has real fireworks: shells that climb,
burst, hang and fade, in several kinds. 周年 and 情人节 nights get a slower show
with heart-shaped ones. Daytime is unchanged, and 减少动态效果 keeps it still.

## 2026-11-16 — The rest of the app joins 新外观

积分表, 历史, 设置, 商店/背包, 情书 and 我们的时光 now match the new look. The
自定义记分 form is quicker: tap a category instead of opening a dropdown, nudge
the points with − and ＋, and pick 今天 or 昨天 with one tap.

## 2026-11-16 — 新外观 is now the default

Every phone now opens in 新外观 without switching anything. If one of you
prefers the old style, 设置 › 外观风格 › 经典 brings it back on that phone only.

## 2026-11-15 — The opening screen and login, redesigned in 新外观

With 新外观 on, the screen you see when opening the app follows day and night,
with a bigger title and the two of you standing in soft light, and the login
card is frosted glass with clearer fields and 他/她 as two cards.

For everyone: 他/她 on the sign-up form were unreadable in dark mode, the
pair-code hint was cut off, and a phone that had never logged in showed
「继续 (…) →」 on the button — all fixed.

## 2026-11-15 — 新外观 to try, and two small fixes

设置 › 外观风格 now has 新外观: cards lit with soft depth, a gently moving
background, 3D-shaded portraits, a glass bottom bar, and light falling into
小窝. It also changes a few things to use: a ＋ in the middle of the bottom bar
to add points from anywhere, 月末结算 inside the score card instead of floating
over the page, and edit/delete on an entry only after you tap it. It is per
phone and off until you choose it, so each of you can try it on your own.

For everyone: what you type in an entry's note is now always shown exactly as
typed, and two leftover messages that mentioned ServiceNow are gone.

## 2026-10-27 — The birthday film plays 「生日快乐歌」

When the candles are blown out, the film now plays Happy Birthday as a music
box instead of the app's everyday music: once softly, once higher on a
celesta, then a lift into a brighter key and a slow ending. It is made for the
app rather than taken from a recording.

## 2026-10-27 — Letters, photos and weather always know who you are

Tapping your partner's picture on the home page (to add points for them) used
to make the app briefly think you WERE them: a letter written then was saved
as theirs, a photo was credited to them, and your weather replaced theirs on
the weather card. It now always goes by who is logged in. A letter can also
only be opened by the person it was written to, and only changed or deleted
by the person who wrote it.

## 2026-10-27 — 生日惊喜

Both birthdays can be set in 设置 (a year is optional and adds 「第 N 个
生日」). Two weeks before one partner's birthday, the other one — and only the
other one — gets a card to prepare a surprise: a letter, a 生日券 that lands in
the birthday person's 背包, photos from the album, and an optional wrapped box
the night before. It is sealed on the server until 00:00 on the day; moving the
phone's date does nothing. On the day the app celebrates whoever's birthday it
is, plays a short film the first time it is opened, and keeps a small 🎂 on the
edge of the screen to watch it again all day.

Also: names in the 背包 are now shown safely whatever they contain.

Same day, after a run on the live site: the birthday crown floated above the
head on the home page. It now sits on the head (behind YY's bow) and bobs with
the portrait.

## 2026-10-07 — Furniture behind the pet can be picked up again

A piece bought from the shop could land right behind the pet — the 毛线篮 did,
with only its needles showing — and then couldn't be tapped, because the
pet's whole rectangle (empty corners included) caught every tap. Now only the
pet's actual shape takes a tap, the speech bubble and the rug never do, and new
furniture is placed on a spot where it can be seen instead of a fixed grid.
A piece that is already hidden: 装扮小窝 → 「✓ 已摆放」 to take it back, then
「摆进小窝」 — it lands somewhere free.

## 2026-10-02 — 周年纪念日

The couple's own anniversary (and every 1000th day) now gets a room theme of
its own, above any festival that lands on the same day, and each anniversary
brings a free one-time keepsake for the room. The details stay a surprise
until the day. It follows the start date set in 设置, so nothing has to be
switched on.

Also: newly arrived furniture is listed first in the shop (newest first),
the home "new stock" card opens the shop on the right tab, and a phone opened
for the first time on a day with nothing limited on sale no longer misses the
next drop's announcement.

## 2026-10-02 — Opening the app is about twice as fast

Logging in or reopening the app waited for four independent requests one
after another (~1s each), so the home screen took about 6 seconds to fill.
They now go out together: 3.6s. If the session token has expired, the
requests that notice share a single refresh instead of each starting one.

## 2026-10-02 — 秋 and 万圣节

The shop had nothing new between 中秋 closing (10-05) and 圣诞 opening
(12-05). Now:

- **秋** (10-06 → 11-30): 柿柿如意篮, 枫叶挂画, 毛线篮.
- **万圣节** (10-12 → 11-02): 南瓜灯, 小幽灵, 蝙蝠彩旗, 魔法小锅, the
  **2026 南瓜小屋** (this year only), and a 小巫师帽 for the pet.
- **万圣节 week** (10-26 → 11-01): purple room, an orange moon with a bat in
  the window, candy drifting down, the pet in a witch hat unless you've
  dressed it yourself, a pumpkin garland across the home sky — and, from dusk,
  two bats flying across it.

Also: the "new stock" card names the newest drop rather than the first one
in the catalog; the pet page header no longer wraps on phones during
three-character festivals; the season planner reports real windows; and the
season check now flags long stretches with nothing limited in the shop
(next: summer).

## 2026-10-02 — 月末结算 counts what you saw, and only that

**Reported:** entries dated 9/30 but logged on 10/1 were left out of
September's settlement. The custom-entry form let you pick a date, but saved
the entry's month as "the month right now" — so a backdated 9/30 entry was
labelled October, and the settle (which archives by that label) treated it as
October's. Four entries were affected; they have been moved into September's
history row, whose totals were recomputed from its entries (no reward
changed).

An entry's month is now always the month **of its own date** — enforced on the
server for every write, and editing an entry's date moves it with it. The date
picker no longer offers future dates, and when you backdate it says which month
the entry will count in — including when that month has already been settled,
in which case the entry becomes a 补记 round of that month at the next settle.

Two other ways to get the same symptom, both closed:
- **A partner logging while the other settles.** The settle stored totals added
  up on one phone but archived whatever the server had, so an entry logged on
  the other phone a moment earlier was archived without being counted. The
  phone now sends what it counted; if that isn't exactly what the server would
  archive, nothing is written and the preview refreshes.
- **Both partners pressing 结算 together** (or a double tap) could write two
  history rows for one month. Only one can now succeed, and the button ignores
  a second tap.

Also: a settled entry can no longer be edited or deleted (its history row was
computed from it); 年度回顾 no longer drops entries added to a month after its
first settle; history is no longer capped at 24 rows (the goal and the pet sum
all of them); and pet EXP and the 坚持 badges count settled *months*, not rows.

## 2026-09-30 — 周年小电影

On each anniversary of the start date the first open on each phone shows a
sealed envelope; opening it plays a one-minute film: the date, the day count,
that year's photos, what the year held, a line from the partner's first
letter, the pet in a party hat, and both names. It is dormant until 12-24.

**周年悄悄话.** Each partner can seal a line for the next anniversary; on the
day it appears in the other's film. The server holds it and decides when it
opens — midnight on the day in the writer's time zone — so changing a phone's
date reveals nothing. The table has no client policies at all, so a session
token can't read it directly either.

The film plays *A Thousand Years* (piano and cello). Whether that file exists
is checked while the envelope is showing, because a phone only allows sound
inside the tap and a missing file reports its error too late to fall back.

Also fixed on the way: an app opened in the last minute before midnight never
noticed the date change, because the clock latched "today" on its first tick
— which already fell after midnight.

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

---

## Appendix — every commit

All 161 commits, newest first. The sections above explain the reasoning;
this is the complete record. `git show <hash>` for the full message and diff.

### September 2026

- `3d20128` **2026-09-15** — Add docs/CHANGELOG.md, and stop the README describing ServiceNow
- `98b7431` **2026-09-14** — Add a cleanup script for the accounts the test suites leave behind
- `cd966b0` **2026-09-11** — Rewrite CLAUDE.md for Supabase, and delete the migration-only functions
- `67259cc` **2026-09-11** — Back up with a service key, not somebody's login
- `ba49914` **2026-09-11** — Point the backup at Supabase, and stop it missing half the bag
- `ccf626a` **2026-09-11** — Match usernames case-insensitively again, as ServiceNow did
- `107b34c` **2026-09-11** — Keep a partner's bag export out of the public repo
- `d939944` **2026-09-11** — Add a change-password screen, and keep the session alive through it
- `03ef923` **2026-09-11** — Move the backend from ServiceNow to Supabase
- `a948aaa` **2026-09-06** — Give the 中秋 lantern garland a natural hanging sag
- `4f31bf3` **2026-09-06** — Mix that year's 生肖 into 春节's falling particles
- `14ce9a4` **2026-09-06** — Add festival ambiance: fireworks, confetti, hearts, lanterns, lights, boats
- `46dbd06` **2026-09-03** — Add one piece to each of the 4 sparse seasons
- `cf7f842` **2026-09-03** — Keep the settle FAB from covering the score-card header

### August 2026

- `3df449b` **2026-08-19** — Add r41 GET /backup/full so one login backs up both partners
- `f1237a6` **2026-08-11** — Add a real backup path for the ServiceNow PDI
- `bf0c270` **2026-08-06** — Draw a moon, not a sun, for a clear night
- `a2c9220` **2026-08-06** — Keep furniture inside the room, and grey out dead layer buttons
- `dc5101c` **2026-08-06** — Make the furniture edit bar legible, and give it a 完成 button
- `f410454` **2026-08-06** — Stop the ⬆️⬇️ layer buttons from moving the furniture
- `ba58602` **2026-08-06** — Unread count stops lying, furniture stacks by depth, network blips retry
- `d39271d` **2026-08-05** — Give the whole home page one inset, matching the score card
- `6acca01` **2026-08-05** — Count days inclusively in local time, and give the home cards one rhythm
- `ed7e8ca` **2026-08-05** — Rewrite the README around what the app actually is now, with a real ERD
- `92bdc00` **2026-08-05** — Only call it rain when rain is actually falling
- `1abaefe` **2026-08-05** — Fix partner weather never publishing, and show your own side of the card
- `f6ba11d` **2026-08-05** — Final regression pass: fix a silent points regression and a dead workflow
- `54e3363` **2026-08-05** — Let the couple choose where the weather comes from
- `d9720c5` **2026-08-05** — Pre-draw 2026-2028 keepsakes, and store rooms by code so it can keep going
- `4c6e217` **2026-08-05** — Un-push deploy.yml — it was never meant to be on the remote
- `d8fda07` **2026-08-05** — Add a free seasonal-content watcher that nags instead of guessing
- `cf2caa5` **2026-08-05** — Fix the stale-HTML guard that was hiding every layout change
- `1372ed7` **2026-08-05** — Rebuild the home cards: hero + two tiles + rows, and stop the labels bobbing
- `cdd1120` **2026-08-04** — No suns at midnight, and stop 新年 from swallowing 情人节
- `b268a5a` **2026-08-04** — Make the shared room sync feel live, without polling harder
- `a226f2d` **2026-08-04** — Fix the pet room on laptop and other wide screens
- `2f4a83a` **2026-08-04** — Accessibility and polish pass found by a full performance/UI/design audit
- `b188fcd` **2026-08-04** — Share weather between partners, and flag new seasonal furniture
- `4e66c3b` **2026-08-04** — Theme, moon phase and weather all follow the device's local time and place
- `30dc2cb` **2026-08-04** — Draw all furniture as SVG, stock 中秋, add a seasonal content check
- `5e0b078` **2026-08-04** — Fix blank 穿戴 shop tiles, and every other icon that could render empty
- `71bb810` **2026-08-04** — Remove browser-test screenshots that were swept into the repo
- `09ccc3b` **2026-08-04** — Fix two latent pet-module data bugs found by deep testing
- `72e53f4` **2026-08-03** — Fix two point-calculation bugs: inconsistent totals and coins not starting at 0
- `4b4bcce` **2026-08-03** — Reopen the app — maintenance mode off
- `19c377b` **2026-08-03** — Sync the shared room between partners, seasonal stock, maintenance bypass
- `7e25158` **2026-08-03** — Add seasonal themes, free-form movable/resizable furniture, maintenance mode
- `ac55e4d` **2026-08-03** — Build 恋爱小窝 decorating (Phase 2) and fix emoji corruption on config fields
- `9c7ed9f` **2026-08-03** — Add year-scope test section and prepare the phase 2 backend
- `afbf335` **2026-08-03** — Fix 年度回顾 counting only the live month; add reset actions and phase 2/3 plans
- `500119c` **2026-08-03** — Add couple-parity + config test sections and capture the rules in CLAUDE.md
- `e4b76d4` **2026-08-03** — Fix drifting dot on the pet page and size room furniture to the pet
- `8031e7a` **2026-08-03** — Fix three pet-logic defects found by an invariant audit
- `879cb0b` **2026-08-03** — Start the pet at 0 EXP instead of inheriting the couple's whole history
- `4e42cef` **2026-08-03** — Record seasonal-theme plan and weekly maintenance rhythm in the pet design doc
- `0bf8c1b` **2026-08-03** — Add 恋爱小窝 pet raising (Phase 1)
- `eab7815` **2026-08-03** — Add achievements, Year in Review, and shared goal + pet game design draft
- `5335bd4` **2026-08-03** — Never auto-settle the current, still-running month
- `660d01b` **2026-08-02** — Fix entries silently disappearing at month rollover if settle is missed

### July 2026

- `d86bfb4` **2026-07-19** — Fix iOS date input overflowing the edit sheet + doubled emoji in 原分类
- `0a9633c` **2026-07-19** — Make toasts click-transparent (pointer-events: none)
- `5d69d45` **2026-07-19** — Show whole photos in the memory slideshow regardless of orientation
- `e091dd7` **2026-07-19** — Add 回忆相册 memory photos with Ken Burns slideshow (回忆放映)
- `74ef1cf` **2026-07-19** — Fix sky CSS colliding with calendar Sunday cells; polish wide layouts
- `3aaec40` **2026-07-19** — Auto-backfill legacy shared claims + day/night ambient sky animations
- `d2aa74c` **2026-07-18** — Make milestone reward claims per-character instead of shared
- `942a77f` **2026-07-18** — Add light/dark theme with follow-device auto mode
- `de7c94f` **2026-07-16** — Fix entry edit corrupting system entries (商店兑换/每日签到)
- `2ce3e8c` **2026-07-16** — Add full user guide (USER_GUIDE.md) and link it from the README
- `20a85bf` **2026-07-16** — Document client-authoritative dates and the test suites in both READMEs
- `441c0b2` **2026-07-14** — Fix purchase/use/claim dates stored a day behind the user's local date
- `93e4325` **2026-07-14** — Add letters (情书) coverage to the full system test suite
- `2f77a77` **2026-07-14** — Add letters (情书) feature: sealed-envelope private letters between the couple
- `9756eef` **2026-07-12** — Pin calendar dots with inline styles so they can't shift
- `905a0e8` **2026-07-12** — Render the today-status labels with inline styles only
- `7e4e962` **2026-07-12** — Self-heal stale index.html caches with a one-time forced reload
- `dc2933f` **2026-07-12** — Ship check-in CSS inside app.js to survive stale index.html caches
- `7e01cb3` **2026-07-12** — Fix check-in today-status line wrapping mid-text
- `81d8772` **2026-07-11** — Let a partner help check in the other for today
- `2fa34cc` **2026-07-11** — Show both partners' check-in status on the calendar
- `b4df31b` **2026-07-11** — Make check-in + layout mobile-friendly across devices
- `93bfb82` **2026-07-11** — Make the check-in calendar prettier
- `f4331fb` **2026-07-11** — Add daily check-in (签到) calendar feature
- `30f5fd2` **2026-07-10** — Fix entry date showing a day behind for UTC+8 users
- `df9d524` **2026-07-08** — Sort quick-entry actions by point size (small at top, big at bottom)
- `88b6adf` **2026-07-08** — Drop the count badge from quick-entry tabs
- `0275023` **2026-07-08** — Make quick-entry reward/punish a tab switcher
- `7bfa845` **2026-07-08** — Split quick-entry categories into 加分 / 扣分 groups
- `6de8f4d` **2026-07-07** — Add multi-round settle regression coverage to v2 suite
- `f210933` **2026-07-07** — Fix settle blocked after first settlement in the same calendar month
- `504d9f6` **2026-07-07** — Add visible app version stamp (settings + console)
- `f727e74` **2026-07-07** — Fix app never booting on cold load under the cache-busting loader
- `d599d4f` **2026-07-06** — Retrigger Pages deploy
- `2673ff1` **2026-07-06** — Cache-bust app.js load to stop stale-version issues on mobile
- `7737d11` **2026-07-06** — Cover name editing + partner avatar cross-edit in v2 suite
- `f117c0e` **2026-07-06** — Retrigger Pages deploy
- `50215ec` **2026-07-06** — Guard month-end settle against an empty month
- `eaf719f` **2026-07-06** — Let either partner edit both names and avatars, persisted in SN
- `e1e8d7c` **2026-07-05** — Sort same-day entries by creation time, newest first
- `610e98b` **2026-07-05** — Separate punishment points from balance in the home display
- `1a49a3e` **2026-07-05** — Trigger Pages redeploy
- `6d49321` **2026-07-05** — Update test suites for claim score check and settle guards
- `2c3dcab` **2026-07-04** — Sync both partners on settle and keep month/claim states fresh
- `1ea0019` **2026-07-04** — Add milestone reward claim UI and exclude shop purchases from punishment
- `5f4028c` **2026-07-03** — Decode emoji icons when loading shop and bag items
- `f210af2` **2026-07-03** — Add full-system test suites and fix boolean field reads in SN resources
- `a2e1049` **2026-07-03** — Polish shop/bag UX and correct SN schema docs
- `c2f7f93` **2026-07-03** — Fix shop manage modal: z-index, stacking, and error states
- `b4292ea` **2026-07-03** — Trigger Pages redeploy
- `17a8b30` **2026-07-03** — Add shop + bag module: frontend UI and SN backend scripts
- `be1255a` **2026-07-03** — Add .nojekyll to skip Jekyll processing on GitHub Pages
- `d99e51b` **2026-07-03** — Redesign bottom nav: floating pill bar + gold FAB for 月末结算
- `f422834` **2026-07-01** — Clean up love page: remove top back button, show year/month/week stats
- `30af1d1` **2026-07-01** — Redesign love page with dark romantic theme and glassmorphism
- `6f31b58` **2026-07-01** — Show good behaviour vs punishment entry counts in score card
- `6d16c49` **2026-07-01** — Fix punishment bar not moving when net score is still positive
- `aad3d18` **2026-07-01** — Add README.md
- `dbb22a4` **2026-07-01** — Add password show/hide toggle, fix undefined display, ISO-06 security, and start screen redesign
- `cf205b2` **2026-07-01** — fix: remove glass card, give couple scene clean margin above button
- `fe47fbc` **2026-07-01** — feat: add 3D frosted glass card for couple scene + 3D raised button
- `a53ce33` **2026-07-01** — fix: simplify couple scene — remove clip-path and absolute auras
- `f3ebf47` **2026-07-01** — fix: start screen layout — characters no longer overlap button
- `24d7740` **2026-07-01** — feat: redesign start screen with free-floating couple animation
- `268840a` **2026-07-01** — fix: guard against undefined/null category name and pts fields
- `cce6c5a` **2026-07-01** — Add love page, fix login button name, add couple start date
- `ad802ff` **2026-07-01** — feat: store/fetch profile pictures via SN u_profile_picture field
- `2116160` **2026-07-01** — fix: switch emoji encoding to \xCODEPOINT (7 chars, fits 10-char SN field)
- `b6c7ba5` **2026-07-01** — fix: encode emoji for SN utf8mb3 storage, fix undefined after addItem
- `59dc1e4` **2026-07-01** — feat: auto-fetch both partner names via GET /config

### June 2026

- `b893095` **2026-06-30** — feat: use login username as character name
- `aa189c9` **2026-06-30** — fix: self-heal SN double-nesting in snFetch, improve login error messages
- `de22ee6` **2026-06-30** — redesign: bigger char cards centered above button on start page
- `7a85497` **2026-06-30** — feat: fix double-nesting bug, split SN scripts, add first-launch setup flow
- `74d6881` **2026-06-30** — fix: use gs.generateGUID() instead of GlideStringUtil in scoped app
- `b35d872` **2026-06-30** — fix: use full scoped table name x_887486_love_app_u_love_auth
- `49d7672` **2026-06-30** — fix: show friendly error messages instead of raw SN JSON
- `93f5cdf` **2026-06-30** — fix: correct u_name→u_match in inline auth helper comment
- `ae48ec7` **2026-06-30** — fix: revert u_love_auth match field back to u_match
- `4417470` **2026-06-30** — fix: use u_name for u_love_auth match reference field
- `4886f33` **2026-06-30** — fix: hidden panels bug + start page character visibility
- `eed5b28` **2026-06-30** — feat: custom auth with register/pair-code flow
- `e3b184b` **2026-06-30** — Re-enable matchId in Resource 21 and GET /config now that u_love_match exists
- `97e6d7f` **2026-06-30** — Remove match table dependency — no u_match field in u_love_auth
- `0048598` **2026-06-30** — Revert to shared service account auth (u_love_auth custom table)
- `d1ab992` **2026-06-30** — Switch to PFMT-style individual SN user auth + match architecture
- `5c88fff` **2026-06-30** — Start button always navigates to login page
- `a328f52` **2026-06-30** — Fix start page character cards to same fixed size
- `99f8e7c` **2026-06-30** — Proper username+password login with auto-register against u_love_auth
- `ff8e914` **2026-06-30** — PIN-only login — instance and username hardcoded, user enters PIN only
- `ecf8999` **2026-06-30** — Add back login page and fix start-page → login flow
- `3cae8da` **2026-06-30** — Auto-connect on boot using saved credentials, skip setup screen
- `d4160c4` **2026-06-30** — Fix API path: use scoped app namespace x_887486_love_app
- `748a15e` **2026-06-30** — Fix scripted REST API: correct all column name mismatches + settle stamping
- `1d4c3c8` **2026-06-30** — Fix: sync card float animations + fix SVG inline collapse in start page cards
- `46b1886` **2026-06-30** — Change background music to Right Here Waiting (Piano Version)
- `dc19b03` **2026-06-30** — Fix: strip IDs from start-page SVG copies to prevent duplicate-ID animation bug
- `6f93631` **2026-06-29** — UI: clearer girl color, remove music icon + hint text
- `8d571ad` **2026-06-29** — Layout: 3-col start page — chars beside button, mobile-safe
- `4ebf0af` **2026-06-29** — Fix character visibility and improve start page design
- `4034f5a` **2026-06-29** — Improve 线条小狗 character design and animations
- `8d81b5b` **2026-06-29** — Initial commit: 恋爱积分簿 couples score app

## Conventions

- **A bug fix names the symptom, not the file.** "Fix entries silently
  disappearing at month rollover" beats "fix query in r04".
- **Anything that bit us twice goes in `CLAUDE.md`,** not just here — that
  file is read before changing code, this one is read to find out what
  happened.
- **Versions** are stamped in `app.js` as `APP_VERSION` and shown in 设置.
  `HTML_V` there must match `app-html-v` in `index.html`, or a phone running a
  cached `index.html` against fresh JS renders a broken layout.
