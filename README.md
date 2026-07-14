# 恋爱积分簿 💕 Love Points Tracker

A Pochacco-themed couples score-tracking web app. Each partner logs daily acts of love and effort — cooking, housework, sweet moments, romantic surprises — and earns points together toward shared rewards (or faces cute punishments when points fall short).

Built with **Vanilla JS + ServiceNow Scripted REST API**. No frameworks, no build step — open `index.html` and go.

---

## Features

- **Couple pairing** — One partner registers, shares a 6-digit pair code, the other joins
- **Dual character tracking** — Each person (他💙 / 她🩷) has their own score with a shared feed
- **Reward & Punishment mode** — Set a monthly target; reach it for rewards, miss it for consequences
- **5 CRUD resources** — Categories, Entries, Rewards, Punishments, Config — all manageable in-app
- **Monthly settlement** — Settle the month, archive results to history, start fresh
- **Points shop & bag** — Redeem points for custom rewards, use them later, track use history (SN-only, no demo mode)
- **Letters (情书)** — Write a private letter to your partner; they see it as a sealed envelope until they tap to open it (unseal animation), then it's marked read
- **Profile pictures** — Upload custom avatars per partner, stored in ServiceNow
- **Animated start screen** — Floating Pochacco couple with rising hearts
- **Background music** — Toggleable ambient piano track
- **Password show/hide** — Eye icon toggle on login and register
- **Data isolation** — Each couple sees only their own data; cross-couple writes blocked (ISO-06)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS · HTML · CSS (no frameworks) |
| Backend | ServiceNow Scripted REST API (36 resources) |
| Auth | Custom `u_love_auth` table · Bearer API key tokens |
| Storage | ServiceNow tables (11 tables, scoped app) |
| Hosting | Static file — open `index.html` directly in browser |

---

## Quick Start

1. Clone or download this repo
2. Open `index.html` in any modern browser (Chrome / Safari / Firefox)
3. Register as a couple:
   - **Partner 1** → tap 他💙 → fill in username & password → tap 注册 → copy the **pair code**
   - **Partner 2** → tap 她🩷 → fill in username & password → paste pair code → tap 注册
4. Both partners can now log in and share the same score feed

> The app connects to a hosted ServiceNow developer instance. No local server needed.

---

## App Structure

```
恋爱积分簿/
├── index.html          # Single-page app (all UI, CSS, and inline styles)
├── app.js              # All app logic (state, API calls, render functions)
├── *.mp3               # Background music tracks
└── servicenow/
    ├── resources/      # 36 Scripted REST API scripts (deployed to SN)
    ├── scripted-rest-api.js
    ├── background-setup.js
    └── README.md       # ServiceNow setup guide
```

---

## API Reference

**Base URL:** `https://dev405150.service-now.com/api/x_887486_love_app/love_score`  
**Auth:** `Authorization: Bearer <apiKey>` header on all requests except register/login

| # | Method | Path | Description |
|---|---|---|---|
| R01 | GET | `/config` | Get couple config + partner names + profile pics |
| R02 | PUT | `/config` | Update mode, target, threshold, start date |
| R03 | GET | `/categories` | List score categories |
| R04 | GET | `/entries?month=YYYY-MM` | List entries for a month (unsettled only) |
| R05 | POST | `/entries` | Add a score entry |
| R06 | PUT | `/entries/:id` | Edit an entry |
| R07 | DELETE | `/entries/:id` | Delete an entry |
| R08 | GET | `/rewards` | List rewards |
| R09 | GET | `/punishments` | List punishments |
| R10 | GET | `/history` | List settled months |
| R11 | POST | `/monthly/settle` | Settle the current month |
| R12 | POST | `/categories` | Create a category |
| R13 | PUT | `/categories/:id` | Edit a category |
| R14 | DELETE | `/categories/:id` | Delete a category |
| R15 | POST | `/rewards` | Create a reward |
| R16 | PUT | `/rewards/:id` | Edit a reward |
| R17 | DELETE | `/rewards/:id` | Delete a reward |
| R18 | POST | `/punishments` | Create a punishment |
| R19 | PUT | `/punishments/:id` | Edit a punishment |
| R20 | DELETE | `/punishments/:id` | Delete a punishment |
| R21 | POST | `/auth/register` | Register a new user / pair with partner |
| R22 | POST | `/auth/login` | Login, returns apiKey + partnerName |
| R23 | PUT | `/auth/charimg` | Upload profile picture (base64) |
| R24 | GET | `/shop` | List shop items |
| R25 | POST | `/shop` | Create a shop item |
| R26 | PUT | `/shop/:id` | Edit a shop item |
| R27 | DELETE | `/shop/:id` | Delete a shop item |
| R28 | POST | `/shop/buy/:id` | Redeem points for a shop item |
| R29 | GET | `/bag` | List owned (unused) items |
| R30 | POST | `/bag/use/:id` | Mark an owned item as used |
| R31 | GET | `/bag/history` | List used items |
| R32 | POST | `/bag/claim` | Claim a milestone reward into the bag |
| R33 | GET | `/letters` | List letters (oldest first, capped at 500) |
| R34 | POST | `/letters` | Write & send a letter |
| R35 | PUT | `/letters/:id` | Mark a letter as opened |
| R36 | DELETE | `/letters/:id` | Delete a letter |

---

## ServiceNow Tables

| Table | Scoped Name | Purpose |
|---|---|---|
| u_love_auth | `x_887486_love_app_u_love_auth` | User accounts & API keys |
| u_love_match | `x_887486_love_app_u_love_match` | Couple pairing records |
| u_love_config | `x_887486_love_app_u_love_config` | Per-couple app settings |
| u_love_category | `x_887486_love_app_u_love_category` | Score categories |
| u_love_entry | `x_887486_love_app_u_love_entry` | Individual score entries |
| u_love_reward | `x_887486_love_app_u_love_reward` | Reward catalog |
| u_love_punishment | `x_887486_love_app_u_love_punishment` | Punishment catalog |
| u_love_monthly | `x_887486_love_app_u_love_monthly` | Settled month records |
| u_love_shop | `x_887486_love_app_u_love_shop` | Point-redeemable shop items |
| u_love_bag | `x_887486_love_app_u_love_bag` | Items owned per person (bought or claimed) |
| u_love_letter | `x_887486_love_app_u_love_letter` | Private letters (情书) between the couple |

> Full field-level schema (types, defaults, exact field names like `u_emoji`/`u_points`/`u_desc`) lives in [`servicenow/README.md`](servicenow/README.md).

---

## Security

- **No hardcoded credentials** — API keys stored in `localStorage` only; never in source code
- **Custom auth table** — `u_love_auth` only; SN admin/native accounts are never used for login
- **ISO-06 cross-couple protection** — All PUT/DELETE resources verify `u_match === caller's matchId` before mutating; returns 404 if mismatch
- **Data isolation** — All list queries filter by `matchId` derived from the Bearer token on the server side
- **Public repo safe** — No secrets, tokens, or passwords committed

---

## Architecture

```
Browser (index.html + app.js)
        │
        │  HTTPS · Bearer token auth
        ▼
ServiceNow dev405150.service-now.com
  └── Scripted REST API  /api/x_887486_love_app/love_score/*
        ├── u_love_auth        — Accounts & API keys
        ├── u_love_match       — Couple pairs
        ├── u_love_config      — Settings per couple
        ├── u_love_category    — Score categories
        ├── u_love_entry       — Score log entries
        ├── u_love_reward      — Rewards catalog
        ├── u_love_punishment  — Punishments catalog
        ├── u_love_monthly     — Monthly settlement archive
        ├── u_love_shop        — Point-redeemable shop items
        ├── u_love_bag         — Items owned per person
        └── u_love_letter      — Private letters (情书) per couple
```

---

## Development Notes

- **Icon encoding** — Emoji stored in SN as `\xCODEPOINT` (e.g. `\x1F495` for 💕) via `encodeForSN()` / `decodeFromSN()` in `app.js` to work around Rhino JS surrogate pair limitations
- **SN response unwrapping** — SN wraps `setBody()` in `{"result": ...}`. `_snUnwrap()` handles single and double wrapping
- **Null field handling** — SN Rhino may omit null JSON properties; `safeStr()` + `normCat()` / `normItem()` normalise all inbound data
- **macOS curl** — Test scripts use `sed '$d'` (not `head -n -1`) for macOS BSD compatibility
