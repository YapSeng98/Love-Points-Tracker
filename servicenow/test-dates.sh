#!/bin/bash
# ============================================================
# 恋爱积分簿 — Date/Timezone Test (shop buy / bag use / claim)
#
# The SN dev instance runs in a timezone behind the user's
# (UTC+8), so any server-computed "today" can be one day off.
# After the r28/r30/r32 fix, those resources prefer the client's
# date/month from the request body.
#
# This script buys/uses/claims with the LOCAL date in the body,
# then asserts every stored date equals the local date.
#
# Usage: bash servicenow/test-dates.sh
# ============================================================

INSTANCE="dev405150.service-now.com"
BASE="https://${INSTANCE}/api/x_887486_love_app/love_score"
PUB_HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json")

PASS_COUNT=0; FAIL_COUNT=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
info() { echo -e "${YELLOW}   → $1${NC}"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
extract() { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }

TODAY=$(date +%Y-%m-%d)     # LOCAL date — the truth this test asserts against
MONTH=$(date +%Y-%m)

echo ""
echo "============================================================"
echo "  恋爱积分簿 — DATE/TIMEZONE TEST"
echo "  Local today : ${TODAY}  (all stored dates must equal this)"
echo "============================================================"

section "SETUP — register throwaway couple + seed 100 pts"
TS=$(date +%s)
USER1="test_dt_cs_${TS}"; USER2="test_dt_tt_${TS}"; PW="DateTest2026!"
RES=$(curl -s -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"${PW}\",\"charId\":\"char1\"}")
PAIR=$(extract "$RES" pairCode); KEY1=$(extract "$RES" apiKey)
[ -n "$KEY1" ] && pass "register char1" || { fail "register char1"; info "$RES"; exit 1; }
curl -s -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER2}\",\"password\":\"${PW}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR}\"}" > /dev/null
AUTH1=(-H "Authorization: Bearer ${KEY1}" -H "Content-Type: application/json" -H "Accept: application/json")

RES=$(curl -s -X POST "${BASE}/entries" "${AUTH1[@]}" \
  -d "{\"charId\":\"char1\",\"catId\":\"\",\"catName\":\"日期测试\",\"icon\":\"🧪\",\"pts\":100,\"desc\":\"seed\",\"month\":\"${MONTH}\",\"date\":\"${TODAY}\"}")
[ -n "$(extract "$RES" id)" ] && pass "seed entry +100 (client date ${TODAY})" || { fail "seed entry"; info "$RES"; exit 1; }

section "1. SHOP BUY — entry date + bag acquiredDate must be local today"
RES=$(curl -s -X POST "${BASE}/shop" "${AUTH1[@]}" -d '{"icon":"🧋","name":"日期测试奶茶","desc":"dt","ptsCost":10,"active":true}')
SHOP_ID=$(extract "$RES" id)
[ -n "$SHOP_ID" ] && pass "create shop item" || { fail "create shop item"; info "$RES"; exit 1; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_ID}" "${AUTH1[@]}" \
  -d "{\"date\":\"${TODAY}\",\"month\":\"${MONTH}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_ID=$(extract "$BODY" bagItemId)
[ "$HTTP" = "201" ] && [ -n "$BAG_ID" ] && pass "POST /shop/buy with local date in body" || { fail "buy → $HTTP"; info "$BODY"; }

RES=$(curl -s "${BASE}/bag" "${AUTH1[@]}")
GOT=$(echo "$RES" | grep -o "\"acquiredDate\":\"[^\"]*\"" | head -1 | cut -d'"' -f4)
[ "$GOT" = "$TODAY" ] && pass "bag acquiredDate = ${GOT} (local)" || fail "bag acquiredDate = '${GOT}', expected ${TODAY}"

RES=$(curl -s "${BASE}/entries?month=${MONTH}" "${AUTH1[@]}")
GOT=$(echo "$RES" | grep -o '{[^}]*商店兑换[^}]*}' | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
[ "$GOT" = "$TODAY" ] && pass "deduction entry date = ${GOT} (local)" || fail "deduction entry date = '${GOT}', expected ${TODAY}"

section "2. BAG USE — usedDate must be local today"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_ID}" "${AUTH1[@]}" -d "{\"date\":\"${TODAY}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "POST /bag/use with local date in body" || fail "use → $HTTP"

RES=$(curl -s "${BASE}/bag/history" "${AUTH1[@]}")
GOT=$(echo "$RES" | grep -o '"usedDate":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$GOT" = "$TODAY" ] && pass "bag usedDate = ${GOT} (local)" || fail "bag usedDate = '${GOT}', expected ${TODAY}"

section "3. MILESTONE CLAIM — claimed bag item acquiredDate must be local today"
RES=$(curl -s -X POST "${BASE}/rewards" "${AUTH1[@]}" -d '{"icon":"🎁","name":"日期测试奖励","minPts":0,"desc":"dt"}')
RWD_ID=$(extract "$RES" id)
[ -n "$RWD_ID" ] && pass "create reward (minPts 0)" || { fail "create reward"; info "$RES"; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH1[@]}" \
  -d "{\"rewardId\":\"${RWD_ID}\",\"date\":\"${TODAY}\",\"month\":\"${MONTH}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "201" ] && pass "POST /bag/claim with local date in body" || fail "claim → $HTTP"

RES=$(curl -s "${BASE}/bag" "${AUTH1[@]}")
GOT=$(echo "$RES" | grep -o '"acquiredDate":"[^"]*"' | head -1 | cut -d'"' -f4)
[ "$GOT" = "$TODAY" ] && pass "claimed item acquiredDate = ${GOT} (local)" || fail "claimed acquiredDate = '${GOT}', expected ${TODAY}"

echo ""
echo "============================================================"
echo -e "  RESULTS: ${GREEN}${PASS_COUNT} passed${NC}  |  ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
if [ "$FAIL_COUNT" -ne "0" ]; then
  echo ""
  echo "  A date mismatch here almost always means the SN resource scripts"
  echo "  r28 (/shop/buy), r30 (/bag/use), r32 (/bag/claim) haven't been"
  echo "  updated yet to prefer the client's date from the request body —"
  echo "  re-paste them from servicenow/resources/ into ServiceNow."
fi
echo ""
