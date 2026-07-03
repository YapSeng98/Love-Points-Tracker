# 恋爱积分簿 — ServiceNow Setup Guide

Instance: **dev405150.service-now.com**
Scope: **x_887486_love_app**

---

## Auth model (read this first)

This app does **not** use ServiceNow admin/native accounts. It has its own login system:

- `u_love_auth` — one row per person, with a username/password and a generated `u_api_key`
- `u_love_match` — one row per **couple**, holding a 6-digit `u_pair_code`
- The first partner registers → creates a `u_love_match` + gets a pair code. The second partner registers with that code → joins the same match.
- Every request after login sends `Authorization: Bearer <apiKey>`. Each resource looks up the caller's `u_love_auth` row by `u_api_key` to get `u_match` and `u_char_id` — that's how the app knows who's asking and which couple's data to touch.
- **Every data table below is scoped by a `u_match` field.** PUT/DELETE resources double-check `u_match` matches the caller before mutating (cross-couple protection, see README.md "ISO-06").

All 32 resources have **Requires Authentication: FALSE** at the SN platform level — auth is handled manually inside each script via the Bearer token, not SN's built-in auth.

---

## Step 1 — Create Tables (10 total)

Go to **System Definition → Tables → New** for each. Unless noted, add a `u_match` field (String(32) or Reference → `u_love_match`) for couple-scoping.

### Identity & pairing

**`u_love_match`** — one row per couple
| Field | Type | Notes |
|---|---|---|
| u_pair_code | String(10) | 6-digit code shown to partner 2 |
| u_couple_name | String(100) | auto-set as `"{char1}_{char2}"` once paired |

**`u_love_auth`** — one row per person
| Field | Type | Notes |
|---|---|---|
| u_username | String(100) | unique login |
| u_password | String(100) | plaintext — this is a personal/private-instance app, not a public service |
| u_api_key | String(40) | GUID, issued on login/register |
| u_char_id | String(10) | `char1` or `char2` |
| u_match | String(32) / Reference → u_love_match | blank until paired |
| u_last_login | Date/Time | |
| u_profile_picture | **String, large max length** (e.g. 4000+) or HTML field | base64 JPEG from the avatar picker — default String(40) will silently truncate it |

### Core app data (all scoped by `u_match`)

**`u_love_config`** — one row per couple
| Field | Type | Notes |
|---|---|---|
| u_mode | String(20) | `reward` / `punishment`, default `reward` |
| u_reward_target | Integer | default `100` |
| u_punish_threshold | Integer | default `-80` |
| u_start_date | Date | "together since" date, for the Love Page day counter |

**`u_love_category`**
| Field | Type | Notes |
|---|---|---|
| u_name | String(100) | |
| u_emoji | String(10) | icon — **not** `u_icon` |
| u_points | Integer | **not** `u_pts`; positive = reward, negative = deduction |
| u_active | True/False | default `true` |

**`u_love_entry`**
| Field | Type | Notes |
|---|---|---|
| u_char | String(10) | `char1` / `char2` |
| u_category | String(32) | sys_id of the category (blank for custom entries) |
| u_category_name | String(100) | snapshot of the category name at entry time |
| u_category_pts | Integer | snapshot of the category's point value |
| u_icon | String(10) | |
| u_points | Integer | the actual points applied (editable, may differ from category default) |
| u_note | String(500) | free-text description |
| u_month | String(7) | `YYYY-MM` |
| u_date | Date | |
| u_monthly | String(32) / Reference → u_love_monthly | set once this entry is folded into a settlement; unsettled entries leave this blank |

**`u_love_reward`**
| Field | Type | Notes |
|---|---|---|
| u_name | String(100) | |
| u_emoji | String(10) | |
| u_points | Integer | minimum score threshold |
| u_desc | String(500) | |
| u_claimed | True/False | default `false` — used by the milestone "claim" flow (POST /bag/claim) |
| u_claimed_date | Date | |

**`u_love_punishment`**
| Field | Type | Notes |
|---|---|---|
| u_name | String(100) | |
| u_emoji | String(10) | |
| u_points | Integer | minimum (absolute) negative-score threshold |
| u_desc | String(500) | |

**`u_love_monthly`** — one row per settled month per couple
| Field | Type | Notes |
|---|---|---|
| u_month | String(7) | |
| u_char1_pts | Integer | |
| u_char2_pts | Integer | |
| u_mode | String(20) | |
| u_result_1 | String(200) | outcome name for char1 |
| u_result_2 | String(200) | outcome name for char2 |
| u_settled_at | Date/Time | |

### Shop module

**`u_love_shop`** — items available to redeem for points
| Field | Type | Notes |
|---|---|---|
| u_icon | String(10) | |
| u_name | String(100) | |
| u_desc | String(500) | |
| u_pts_cost | Integer | |
| u_active | True/False | default `true` — inactive items are hidden from the shop but kept for history |

**`u_love_bag`** — items a person has acquired (bought or claimed)
| Field | Type | Notes |
|---|---|---|
| u_char | String(10) | owner: `char1` / `char2` |
| u_item_name | String(100) | snapshot |
| u_item_icon | String(10) | snapshot |
| u_pts_spent | Integer | `0` for milestone-reward claims |
| u_source_type | String(20) | `purchase` (from shop) or `reward` (milestone claim) |
| u_shop_item | String(32) / Reference → u_love_shop | blank when `u_source_type = reward` |
| u_month | String(7) | |
| u_acquired_date | Date | |
| u_used_date | Date | blank until used |
| u_status | String(20) | `active` → `used` |

---

## Step 2 — Seed starting data

There's no couple to scope data to until someone registers, so seeding happens **after** Step 1 + Step 3, not before:

1. Create the tables (Step 1) and resources (Step 3), enable CORS (Step 4).
2. Open the app, register your first couple through the normal UI (this creates the `u_love_match` + two `u_love_auth` rows).
3. Use the in-app **⚙️ 管理** screens (categories / rewards / punishments / shop) to add your starting data — this writes rows correctly scoped to your `u_match` automatically.

> `background-setup.js` is a **legacy v1 script** from before the auth/pairing system existed — it uses old field names (`u_icon`, `u_pts`, `u_min_pts`, `u_description`) and seeds *global* unscoped rows, which the current match-scoped resources will simply never return. Don't run it against the current schema; it's kept only as historical reference.

---

## Step 3 — Create Scripted REST API (32 resources)

**Name**: Love Score API · **API ID**: `love_score` · **Base API path**: `/api/x_887486_love_app/love_score`

For each resource: set the HTTP method + relative path, paste the matching `servicenow/resources/rNN_*.js` file into the resource script, and set **Requires Authentication: FALSE** (the script checks the Bearer token itself).

| # | Method | Path | Script |
|---|---|---|---|
| 01 | GET | `/config` | r01_GET_config.js |
| 02 | PUT | `/config` | r02_PUT_config.js |
| 03 | GET | `/categories` | r03_GET_categories.js |
| 04 | GET | `/entries` | r04_GET_entries.js |
| 05 | POST | `/entries` | r05_POST_entries.js |
| 06 | PUT | `/entries/{id}` | r06_PUT_entries_id.js |
| 07 | DELETE | `/entries/{id}` | r07_DELETE_entries_id.js |
| 08 | GET | `/rewards` | r08_GET_rewards.js |
| 09 | GET | `/punishments` | r09_GET_punishments.js |
| 10 | GET | `/history` | r10_GET_history.js |
| 11 | POST | `/monthly/settle` | r11_POST_monthly_settle.js |
| 12 | POST | `/categories` | r12_POST_categories.js |
| 13 | PUT | `/categories/{id}` | r13_PUT_categories_id.js |
| 14 | DELETE | `/categories/{id}` | r14_DELETE_categories_id.js |
| 15 | POST | `/rewards` | r15_POST_rewards.js |
| 16 | PUT | `/rewards/{id}` | r16_PUT_rewards_id.js |
| 17 | DELETE | `/rewards/{id}` | r17_DELETE_rewards_id.js |
| 18 | POST | `/punishments` | r18_POST_punishments.js |
| 19 | PUT | `/punishments/{id}` | r19_PUT_punishments_id.js |
| 20 | DELETE | `/punishments/{id}` | r20_DELETE_punishments_id.js |
| 21 | POST | `/auth/register` | r21_POST_auth_register.js |
| 22 | POST | `/auth/login` | r22_POST_auth_login.js |
| 23 | PUT | `/auth/charimg` | r23_PUT_auth_charimg.js |
| 24 | GET | `/shop` | r24_GET_shop.js |
| 25 | POST | `/shop` | r25_POST_shop.js |
| 26 | PUT | `/shop/{id}` | r26_PUT_shop_id.js |
| 27 | DELETE | `/shop/{id}` | r27_DELETE_shop_id.js |
| 28 | POST | `/shop/buy/{id}` | r28_POST_shop_buy_id.js |
| 29 | GET | `/bag` | r29_GET_bag.js |
| 30 | POST | `/bag/use/{id}` | r30_POST_bag_use_id.js |
| 31 | GET | `/bag/history` | r31_GET_bag_history.js |
| 32 | POST | `/bag/claim` | r32_POST_bag_claim.js |

---

## Step 4 — Enable CORS

1. Go to **System Web Services → REST API Explorer → CORS Rules → New**
2. Set:
   - **REST API**: Love Score API
   - **Domain**: `*` (or your specific host / `file://` for local testing)
   - **HTTP Methods**: GET, POST, PUT, DELETE
3. Save

---

## Step 5 — Test the API

Use `servicenow/test-api.sh` — it registers two throwaway accounts, pairs them, and exercises config/categories/rewards/entries/history end to end:

```bash
bash servicenow/test-api.sh
```

Or just check an existing login:

```bash
bash servicenow/test-api.sh --login <username> <password>
```

If something fails, the script's summary lists the common causes (missing field, resource not created, "Requires Authentication" still on, etc).

---

## Step 6 — Connect the frontend

1. Open `index.html` in a browser
2. Tap **注册** (register) — partner 1 picks 他💙, sets a username/password, gets a 6-digit pair code
3. Partner 2 taps **注册**, picks 她🩷, enters that pair code
4. Both can now log in independently and see the same shared data

No SN admin credentials are ever entered in the app.

---

## Modifying data

| What to change | Where |
|---|---|
| Categories / rewards / punishments / shop items | ⚙️ 管理 screens in-app (writes are correctly `u_match`-scoped) |
| Target score, thresholds, start date | App Settings (⚙️ button) |
| View monthly history | History tab in-app, or `u_love_monthly` table in SN |
| Fix a couple's data directly | SN table, but always filter by the couple's `u_love_match` sys_id first |

---

## Architecture

```
Browser (index.html + app.js)
        │
        │  HTTPS · Authorization: Bearer <apiKey>
        ▼
ServiceNow dev405150.service-now.com
  └── Scripted REST API  /api/x_887486_love_app/love_score/*  (32 resources)
        ├── u_love_auth        — accounts, password + api_key + profile picture
        ├── u_love_match       — couple pairing + pair code
        ├── u_love_config      — mode / thresholds / start date, per couple
        ├── u_love_category    — score categories, per couple
        ├── u_love_entry       — score log entries, per couple
        ├── u_love_reward      — reward tiers (+ claim tracking), per couple
        ├── u_love_punishment  — punishment tiers, per couple
        ├── u_love_monthly     — settled month archive, per couple
        ├── u_love_shop        — point-redeemable shop items, per couple
        └── u_love_bag         — owned items (bought or claimed), per person
```

---

## Demo Mode (no SN needed)

Tap **"跳过 → 使用本地模式"** on the login screen. Core scoring/categories/rewards/punishments run entirely on `localStorage`. The **shop/bag module requires SN** — it has no local-storage fallback, so it shows a "please connect ServiceNow" empty state in demo mode.
