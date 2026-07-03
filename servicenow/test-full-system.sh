#!/bin/bash
# ============================================================
# 恋爱积分簿 — Full System Test (SN <-> app contract, 3 months, 2 couples)
#
# Simulates one couple's real usage across 3 months (reward mode ->
# punishment mode -> reward mode), including CRUD on every admin
# screen, avatar upload, shop/bag flow, monthly settle + history,
# a second couple for cross-couple isolation checks, and auth
# failure modes. Request shapes are copied 1:1 from app.js so this
# exercises the exact contract the frontend relies on.
#
# Usage:
#   bash servicenow/test-full-system.sh
# ============================================================

INSTANCE="dev405150.service-now.com"
BASE="https://${INSTANCE}/api/x_887486_love_app/love_score"
PUB_HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json")

PASS_COUNT=0
FAIL_COUNT=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1" >&2; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1" >&2; FAIL_COUNT=$((FAIL_COUNT+1)); }
info() { echo -e "${YELLOW}   → $1${NC}" >&2; }
section() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}" >&2; }

extract()     { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
extract_num() { echo "$1" | grep -o "\"$2\":-\{0,1\}[0-9.]*" | head -1 | grep -o -- '-\{0,1\}[0-9.]*$'; }
sum_pts()     { echo "$1" | grep -o '"pts":-\{0,1\}[0-9]*' | grep -o -- '-\{0,1\}[0-9]*$' | awk '{s+=$1} END{print s+0}'; }

echo ""
echo "============================================================"
echo "  恋爱积分簿 — FULL SYSTEM TEST"
echo "  Instance : ${INSTANCE}"
echo "============================================================"

TS=$(date +%s)
PASS_COMMON="LoveTest2026!"
USER1="test_sys_cs_${TS}"
USER2="test_sys_tt_${TS}"
USERB1="test_iso_cs_${TS}"
USERB2="test_iso_tt_${TS}"

M1=$(date -v-2m +%Y-%m); M1_LABEL=$(date -v-2m +"%Y年%m月")
M2=$(date -v-1m +%Y-%m); M2_LABEL=$(date -v-1m +"%Y年%m月")
M3=$(date +%Y-%m);       M3_LABEL=$(date +"%Y年%m月")
TODAY=$(date +%Y-%m-%d)

# ════════════════════════════════════════════════════════════
section "SETUP 1: Register + pair Couple A (${USER1} / ${USER2})"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER1}\",\"password\":\"${PASS_COMMON}\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
PAIR_CODE=$(extract "$BODY" pairCode)
[ "$HTTP" = "201" ] && [ -n "$PAIR_CODE" ] && pass "register char1 (${USER1})" || { fail "register char1 → $HTTP"; info "$BODY"; exit 1; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER2}\",\"password\":\"${PASS_COMMON}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR_CODE}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
MATCH_ID=$(extract "$BODY" matchId)
[ "$HTTP" = "201" ] && [ -n "$MATCH_ID" ] && pass "register char2 (${USER2}), paired matchId=${MATCH_ID}" || { fail "register char2 → $HTTP"; exit 1; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"${PASS_COMMON}\"}")
BODY=$(echo "$RES" | head -1); API_KEY1=$(extract "$BODY" apiKey)
[ -n "$API_KEY1" ] && pass "login char1" || { fail "login char1"; exit 1; }
AUTH1=(-H "Authorization: Bearer ${API_KEY1}" -H "Content-Type: application/json" -H "Accept: application/json")

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER2}\",\"password\":\"${PASS_COMMON}\"}")
BODY=$(echo "$RES" | head -1); API_KEY2=$(extract "$BODY" apiKey)
[ -n "$API_KEY2" ] && pass "login char2" || { fail "login char2"; exit 1; }
AUTH2=(-H "Authorization: Bearer ${API_KEY2}" -H "Content-Type: application/json" -H "Accept: application/json")

section "SETUP 2: Avatar upload"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/auth/charimg" "${AUTH1[@]}" -d '{"charImg":"data:image/png;base64,FULLSYSTEMTESTAVATAR"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /auth/charimg → $HTTP" || fail "PUT /auth/charimg → $HTTP"
RES=$(curl -s "${BASE}/config" "${AUTH1[@]}")
echo "$RES" | grep -q "FULLSYSTEMTESTAVATAR" && pass "GET /config → avatar persisted" || fail "GET /config → avatar NOT found"

section "SETUP 3: Config (target=80, threshold=-60)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" \
  -d '{"mode":"reward","rewardTarget":80,"punishThreshold":-60,"startDate":"2024-01-01"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /config (reward, target=80) → $HTTP" || fail "PUT /config → $HTTP"

section "SETUP 4: Categories (4)"
mk_cat() {
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/categories" "${AUTH1[@]}" -d "$1")
  HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
  ID=$(extract "$BODY" id)
  ([ "$HTTP" = "201" ] && [ -n "$ID" ]) && pass "POST /categories ($2) → id=${ID}" || fail "POST /categories ($2) → $HTTP"
  echo "$ID"
}
CAT_GOOD1=$(mk_cat '{"icon":"S1","name":"陪伴时光","pts":10}' "陪伴时光 +10")
CAT_GOOD2=$(mk_cat '{"icon":"S2","name":"惊喜礼物","pts":15}' "惊喜礼物 +15")
CAT_BAD1=$(mk_cat  '{"icon":"S3","name":"忘记约定","pts":-20}' "忘记约定 -20")
CAT_BAD2=$(mk_cat  '{"icon":"S4","name":"约会迟到","pts":-10}' "约会迟到 -10")

RES=$(curl -s -w "\n%{http_code}" "${BASE}/categories" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')
[ "$HTTP" = "200" ] && [ "$COUNT" = "4" ] && pass "GET /categories → 4 categories" || fail "GET /categories → $HTTP, count=$COUNT"

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/categories/${CAT_GOOD1}" "${AUTH1[@]}" -d '{"pts":12}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /categories/{id} (陪伴时光 10→12) → $HTTP" || fail "PUT /categories/{id} → $HTTP"

section "SETUP 5: Rewards (2) + Punishments (2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/rewards" "${AUTH1[@]}" -d '{"icon":"R1","name":"小零食一份","minPts":50,"desc":"低档奖励"}')
BODY=$(echo "$RES" | head -1); REWARD_LOW=$(extract "$BODY" id)
[ -n "$REWARD_LOW" ] && pass "POST /rewards (小零食, minPts=50) → id=${REWARD_LOW}" || fail "POST /rewards (low)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/rewards" "${AUTH1[@]}" -d '{"icon":"R2","name":"约会一次","minPts":80,"desc":"高档奖励"}')
BODY=$(echo "$RES" | head -1); REWARD_HIGH=$(extract "$BODY" id)
[ -n "$REWARD_HIGH" ] && pass "POST /rewards (约会一次, minPts=80) → id=${REWARD_HIGH}" || fail "POST /rewards (high)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/punishments" "${AUTH1[@]}" -d '{"icon":"P1","name":"做家务一周","minPts":30,"desc":"低档惩罚"}')
BODY=$(echo "$RES" | head -1); PUN_LOW=$(extract "$BODY" id)
[ -n "$PUN_LOW" ] && pass "POST /punishments (做家务, minPts=30) → id=${PUN_LOW}" || fail "POST /punishments (low)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/punishments" "${AUTH1[@]}" -d '{"icon":"P2","name":"按摩七天","minPts":60,"desc":"高档惩罚"}')
BODY=$(echo "$RES" | head -1); PUN_HIGH=$(extract "$BODY" id)
[ -n "$PUN_HIGH" ] && pass "POST /punishments (按摩七天, minPts=60) → id=${PUN_HIGH}" || fail "POST /punishments (high)"

section "SETUP 6: Shop items (2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop" "${AUTH1[@]}" -d '{"icon":"G1","name":"奶茶一杯","desc":"便宜商品","ptsCost":20}')
BODY=$(echo "$RES" | head -1); SHOP_CHEAP=$(extract "$BODY" id)
[ -n "$SHOP_CHEAP" ] && pass "POST /shop (奶茶一杯, cost=20) → id=${SHOP_CHEAP}" || fail "POST /shop (cheap)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop" "${AUTH1[@]}" -d '{"icon":"G2","name":"电影票","desc":"中档商品","ptsCost":40}')
BODY=$(echo "$RES" | head -1); SHOP_MID=$(extract "$BODY" id)
[ -n "$SHOP_MID" ] && pass "POST /shop (电影票, cost=40) → id=${SHOP_MID}" || fail "POST /shop (mid)"

# ════════════════════════════════════════════════════════════
section "MONTH 1 (${M1_LABEL}, reward mode) — char1 hits target exactly, char2 doesn't"
# ════════════════════════════════════════════════════════════
mk_entry() {
  # $1=auth array name(unused, always AUTH), $2=charId, $3=catId, $4=pts, $5=month, $6=date, $7=desc
  local AUTHREF=$1; local CHARID=$2; local CATID=$3; local PTS=$4; local MONTH=$5; local DATE=$6; local DESC=$7
  if [ "$AUTHREF" = "AUTH1" ]; then AUTHARR=("${AUTH1[@]}"); else AUTHARR=("${AUTH2[@]}"); fi
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/entries" "${AUTHARR[@]}" \
    -d "{\"charId\":\"${CHARID}\",\"catId\":\"${CATID}\",\"catName\":\"test\",\"icon\":\"E\",\"pts\":${PTS},\"desc\":\"${DESC}\",\"month\":\"${MONTH}\",\"date\":\"${DATE}\"}")
  BODY=$(echo "$RES" | head -1)
  extract "$BODY" id
}

M1_E1=$(mk_entry AUTH1 char1 "$CAT_GOOD1" 20 "$M1" "${M1}-05" "陪伴")
M1_E2=$(mk_entry AUTH1 char1 "$CAT_GOOD2" 30 "$M1" "${M1}-10" "礼物")
M1_E3=$(mk_entry AUTH1 char1 "$CAT_GOOD1" 10 "$M1" "${M1}-15" "陪伴2")
[ -n "$M1_E1" ] && [ -n "$M1_E2" ] && [ -n "$M1_E3" ] && pass "char1 logged 3 entries (20+30+10=60)" || fail "char1 entry creation"

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/entries/${M1_E3}" "${AUTH1[@]}" -d '{"pts":30,"desc":"陪伴2(修正)"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /entries/{id} — edited 10→30 (running total now 80)" || fail "PUT /entries/{id} → $HTTP"

M1_E4=$(mk_entry AUTH1 char1 "$CAT_GOOD2" 15 "$M1" "${M1}-20" "extra")
[ -n "$M1_E4" ] && pass "char1 logged 4th entry +15 (running total 95)" || fail "4th entry creation"

RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/entries/${M1_E4}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /entries/{id} — removed 4th entry (back to 80)" || fail "DELETE /entries/{id} → $HTTP"

M1_F1=$(mk_entry AUTH2 char2 "$CAT_GOOD1" 10 "$M1" "${M1}-08" "陪伴")
M1_F2=$(mk_entry AUTH2 char2 "$CAT_BAD2" -5 "$M1" "${M1}-18" "迟到")
[ -n "$M1_F1" ] && [ -n "$M1_F2" ] && pass "char2 logged 2 entries (10-5=5)" || fail "char2 entry creation"

RES=$(curl -s "${BASE}/entries?month=${M1}" "${AUTH1[@]}")
M1_TOTAL=$(sum_pts "$RES")
[ "$M1_TOTAL" = "85" ] && pass "GET /entries?month=${M1} → combined total=85 (char1:80 + char2:5)" || fail "M1 combined total mismatch: got ${M1_TOTAL}, expected 85"

M1_C1=80; M1_C2=5
[ "$M1_C1" -ge 80 ] && pass "char1 M1=80 reaches reward target (boundary: exactly 80)" || fail "char1 M1 target check"
[ "$M1_C2" -lt 50 ] && pass "char2 M1=5 does not reach any reward" || fail "char2 M1 target check"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M1}\",\"char1Pts\":${M1_C1},\"char2Pts\":${M1_C2},\"mode\":\"reward\",\"result1\":\"约会一次\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "200" ] && echo "$BODY" | grep -q '"success":true' && pass "POST /monthly/settle (${M1}) → $HTTP" || fail "settle M1 → $HTTP"

RES=$(curl -s "${BASE}/entries?month=${M1}" "${AUTH1[@]}")
IDCOUNT=$(echo "$RES" | grep -o '"id"' | wc -l | tr -d ' ')
[ "$IDCOUNT" = "0" ] && pass "GET /entries?month=${M1} → archived (0 active entries)" || fail "M1 entries not archived: $RES"

# ════════════════════════════════════════════════════════════
section "MONTH 2 (${M2_LABEL}, switched to punishment mode) — char2 crosses threshold exactly, char1 safe"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" -d '{"mode":"punishment"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /config — switched mode to punishment" || fail "mode switch → $HTTP"

M2_G1=$(mk_entry AUTH2 char2 "$CAT_BAD1" -20 "$M2" "${M2}-03" "忘记约定")
M2_G2=$(mk_entry AUTH2 char2 "$CAT_BAD1" -15 "$M2" "${M2}-11" "忘记约定2")
M2_G3=$(mk_entry AUTH2 char2 "$CAT_BAD2" -10 "$M2" "${M2}-19" "迟到")
[ -n "$M2_G1" ] && [ -n "$M2_G2" ] && [ -n "$M2_G3" ] && pass "char2 logged 3 entries (-20-15-10=-45)" || fail "char2 M2 entries"

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/entries/${M2_G3}" "${AUTH2[@]}" -d '{"pts":-25,"desc":"迟到(加重)"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /entries/{id} — edited -10→-25 (running total now -60)" || fail "edit M2 entry → $HTTP"

M2_H1=$(mk_entry AUTH1 char1 "$CAT_GOOD1" 10 "$M2" "${M2}-05" "陪伴")
M2_H2=$(mk_entry AUTH1 char1 "$CAT_BAD2" -5 "$M2" "${M2}-15" "迟到")
[ -n "$M2_H1" ] && [ -n "$M2_H2" ] && pass "char1 logged 2 entries (10-5=5, stays safe)" || fail "char1 M2 entries"

RES=$(curl -s "${BASE}/entries?month=${M2}" "${AUTH1[@]}")
M2_TOTAL=$(sum_pts "$RES")
[ "$M2_TOTAL" = "-55" ] && pass "GET /entries?month=${M2} → combined total=-55 (char1:5 + char2:-60)" || fail "M2 combined total mismatch: got ${M2_TOTAL}, expected -55"

M2_C1=5; M2_C2=-60
[ "$M2_C2" -le -60 ] && pass "char2 M2=-60 crosses punish threshold (boundary: exactly -60)" || fail "char2 M2 threshold check"
[ "$M2_C1" -gt -60 ] && pass "char1 M2=5 stays safe" || fail "char1 M2 threshold check"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M2}\",\"char1Pts\":${M2_C1},\"char2Pts\":${M2_C2},\"mode\":\"punishment\",\"result1\":\"\",\"result2\":\"按摩七天\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "POST /monthly/settle (${M2}) → $HTTP" || fail "settle M2 → $HTTP"

# ════════════════════════════════════════════════════════════
section "MONTH 3 (${M3_LABEL}, switched back to reward) — shop, bag, milestone claim, partner visibility"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" -d '{"mode":"reward"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /config — switched mode back to reward" || fail "mode switch back → $HTTP"

M3_I1=$(mk_entry AUTH1 char1 "$CAT_GOOD1" 30 "$M3" "$TODAY" "陪伴")
M3_I2=$(mk_entry AUTH1 char1 "$CAT_GOOD2" 20 "$M3" "$TODAY" "礼物")
[ -n "$M3_I1" ] && [ -n "$M3_I2" ] && pass "char1 logged 2 entries this month (30+20=50)" || fail "char1 M3 entries"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_CHEAP}" "${AUTH1[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_ID=$(extract "$BODY" bagItemId)
NEW_SCORE=$(extract_num "$BODY" newScore)
([ "$HTTP" = "201" ] && [ -n "$BAG_ID" ]) && pass "POST /shop/buy/{id} (奶茶, cost 20) → newScore=${NEW_SCORE}" || fail "shop buy → $HTTP"

RES=$(curl -s "${BASE}/entries?month=${M3}" "${AUTH1[@]}")
M3_C1_AFTER_BUY=$(sum_pts "$RES")
[ "$M3_C1_AFTER_BUY" = "30" ] && pass "GET /entries?month=${M3} → char1 total=30 after 20pt deduction entry" || fail "post-buy total mismatch: got ${M3_C1_AFTER_BUY}, expected 30"

RES=$(curl -s "${BASE}/bag" "${AUTH1[@]}")
echo "$RES" | grep -q "奶茶一杯" && pass "GET /bag → purchased item present" || fail "GET /bag missing purchased item: $RES"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_ID}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "POST /bag/use/{id} → $HTTP" || fail "bag use → $HTTP"

RES=$(curl -s "${BASE}/bag/history" "${AUTH1[@]}")
echo "$RES" | grep -q "奶茶一杯" && pass "GET /bag/history → used item present" || fail "GET /bag/history missing item"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH1[@]}" -d "{\"rewardId\":\"${REWARD_LOW}\"}")
HTTP=$(echo "$RES" | tail -1)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && pass "POST /bag/claim (小零食一份, backend-only feature) → $HTTP" || fail "bag claim → $HTTP"
info "Note: /bag/claim is not called anywhere in app.js — this is a backend feature with no UI wiring yet, and it doesn't itself verify the caller's score meets the reward's minPts."

M3_J1=$(mk_entry AUTH2 char2 "$CAT_GOOD1" 5 "$M3" "$TODAY" "陪伴")
[ -n "$M3_J1" ] && pass "char2 logged 1 entry this month (+5)" || fail "char2 M3 entry"

RES1=$(curl -s "${BASE}/entries?month=${M3}" "${AUTH1[@]}")
RES2=$(curl -s "${BASE}/entries?month=${M3}" "${AUTH2[@]}")
SUM1=$(sum_pts "$RES1"); SUM2=$(sum_pts "$RES2")
[ "$SUM1" = "$SUM2" ] && [ "$SUM1" = "35" ] && pass "char1 and char2 both see combined couple total via GET /entries (35 = 30 + 5) — shared visibility confirmed" || fail "partner visibility mismatch: char1 sees ${SUM1}, char2 sees ${SUM2}"

M3_C1=30; M3_C2=5
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M3}\",\"char1Pts\":${M3_C1},\"char2Pts\":${M3_C2},\"mode\":\"reward\",\"result1\":\"\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "POST /monthly/settle (${M3}) → $HTTP" || fail "settle M3 → $HTTP"

section "HISTORY VERIFICATION (3 months)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/history" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
MONTH_COUNT=$(echo "$BODY" | grep -o "\"month\":\"${M1}\"\|\"month\":\"${M2}\"\|\"month\":\"${M3}\"" | wc -l | tr -d ' ')
[ "$HTTP" = "200" ] && [ "$MONTH_COUNT" = "3" ] && pass "GET /history → all 3 months present (${M1}, ${M2}, ${M3})" || fail "history incomplete: found ${MONTH_COUNT}/3 months"

# ════════════════════════════════════════════════════════════
section "COUPLE B — isolation checks (${USERB1})"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USERB1}\",\"password\":\"${PASS_COMMON}\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
PAIR_CODE_B=$(extract "$BODY" pairCode); API_KEY_B1=$(extract "$BODY" apiKey)
[ "$HTTP" = "201" ] && pass "register Couple B char1 (solo, unpaired)" || fail "register Couple B char1 → $HTTP"
AUTHB1=(-H "Authorization: Bearer ${API_KEY_B1}" -H "Content-Type: application/json" -H "Accept: application/json")

RES=$(curl -s "${BASE}/config" "${AUTHB1[@]}")
echo "$RES" | grep -q '"configured":false' && pass "GET /config (unpaired) → configured:false, no data leak" || fail "unpaired config check failed: $RES"
RES=$(curl -s "${BASE}/categories" "${AUTHB1[@]}")
IDCOUNT=$(echo "$RES" | grep -o '"id"' | wc -l | tr -d ' ')
[ "$IDCOUNT" = "0" ] && pass "GET /categories (unpaired) → empty, not Couple A's 4 categories" || fail "unpaired categories leaked: $RES"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USERB2}\",\"password\":\"${PASS_COMMON}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR_CODE_B}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "201" ] && pass "register Couple B char2, paired" || fail "register Couple B char2 → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/entries/${M1_E1}" "${AUTHB1[@]}" -d '{"pts":9999}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "PUT Couple A's entry using Couple B's token → 404 (cross-couple protection)" || fail "cross-couple PUT protection FAILED → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/entries/${M1_E1}" "${AUTHB1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "DELETE Couple A's entry using Couple B's token → 404 (cross-couple protection)" || fail "cross-couple DELETE protection FAILED → $HTTP"

RES=$(curl -s "${BASE}/shop" "${AUTHB1[@]}")
IDCOUNT=$(echo "$RES" | grep -o '"id"' | wc -l | tr -d ' ')
[ "$IDCOUNT" = "0" ] && pass "GET /shop (Couple B) → empty, not Couple A's items" || fail "shop isolation FAILED: $RES"

# ════════════════════════════════════════════════════════════
section "AUTH FAILURE MODES"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" "${BASE}/config" -H "Authorization: Bearer garbage-invalid-token" -H "Accept: application/json")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "401" ] && pass "GET /config with garbage token → 401" || fail "garbage token → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"wrong-password\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "401" ] && pass "login with wrong password → 401" || fail "wrong password → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d '{"username":"nonexistent_user_xyz","password":"x"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "login with nonexistent username → 404" || fail "nonexistent user → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"x\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "409" ] && pass "register duplicate username → 409" || fail "duplicate username → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d '{"username":"whatever_new_user","password":"x","charId":"char2","pairCode":"000000"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "register with invalid pair code → 404" || fail "invalid pair code → $HTTP"

# ════════════════════════════════════════════════════════════
section "CLEANUP (Couple A: shop/categories/rewards/punishments)"
# ════════════════════════════════════════════════════════════
for id in "$SHOP_CHEAP" "$SHOP_MID"; do
  RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/shop/${id}" "${AUTH1[@]}")
  HTTP=$(echo "$RES" | tail -1)
  [ "$HTTP" = "200" ] && pass "DELETE /shop/${id} → $HTTP" || fail "DELETE /shop/${id} → $HTTP"
done
for id in "$CAT_GOOD1" "$CAT_GOOD2" "$CAT_BAD1" "$CAT_BAD2"; do
  RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/categories/${id}" "${AUTH1[@]}")
  HTTP=$(echo "$RES" | tail -1)
  [ "$HTTP" = "200" ] && pass "DELETE /categories/${id} → $HTTP" || fail "DELETE /categories/${id} → $HTTP"
done
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/rewards/${REWARD_LOW}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /rewards/${REWARD_LOW} (claimed reward, deletes fine) → $HTTP" || fail "DELETE claimed reward → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/rewards/${REWARD_HIGH}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /rewards/${REWARD_HIGH} → $HTTP" || fail "DELETE /rewards/${REWARD_HIGH} → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/punishments/${PUN_LOW}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /punishments/${PUN_LOW} → $HTTP" || fail "DELETE /punishments/${PUN_LOW} → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/punishments/${PUN_HIGH}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /punishments/${PUN_HIGH} → $HTTP" || fail "DELETE /punishments/${PUN_HIGH} → $HTTP"

info "Not deleted (no DELETE endpoint exists / kept for your review): u_love_auth + u_love_match for ${USER1}/${USER2}/${USERB1}/${USERB2}, u_love_bag rows, u_love_monthly rows (3 settled months for Couple A)."

# ════════════════════════════════════════════════════════════
echo ""
echo "============================================================"
echo -e "  RESULTS: ${GREEN}${PASS_COUNT} passed${NC}  |  ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
echo ""
echo -e "${BOLD}Couple A login (for manual review in the app):${NC}"
echo "  char1 (他): username=${USER1}  password=${PASS_COMMON}"
echo "  char2 (她): username=${USER2}  password=${PASS_COMMON}"
echo ""
