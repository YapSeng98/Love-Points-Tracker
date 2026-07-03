#!/bin/bash
# ============================================================
# 恋爱积分簿 — Extended API Test (covers what test-api.sh skips)
#
# test-api.sh already covers resources 1-10 (config/categories/
# rewards-GET/punishments-GET/entries/history). This script covers
# the rest: rewards & punishments CRUD, monthly settle, avatar
# upload, and the full shop -> buy -> bag -> use/claim flow
# (resources 11, 15-20, 23, 24-32).
#
# Usage:
#   bash servicenow/test-api-extended.sh
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
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; ((FAIL_COUNT++)); }
info() { echo -e "${YELLOW}   → $1${NC}"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo "============================================================"
echo "  恋爱积分簿 — Extended API Test"
echo "  Instance : ${INSTANCE}"
echo "  Base URL : ${BASE}"
echo "============================================================"

# ── REGISTER TWO FRESH TEST ACCOUNTS ────────────────────────────
TS=$(date +%s)
USER1="test_ext_cs_${TS}"
USER2="test_ext_tt_${TS}"
PASS1="pass_ext_cs_${TS}"
PASS2="pass_ext_tt_${TS}"

section "SETUP: register + pair"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER1}\",\"password\":\"${PASS1}\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
PAIR_CODE=$(echo "$BODY" | grep -o '"pairCode":"[^"]*"' | cut -d'"' -f4)
if [ "$HTTP" = "201" ] && [ -n "$PAIR_CODE" ]; then
  pass "register char1"
else
  fail "register char1 → HTTP $HTTP"; info "$BODY"; exit 1
fi

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER2}\",\"password\":\"${PASS2}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR_CODE}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "201" ] && pass "register char2 (paired)" || { fail "register char2 → HTTP $HTTP"; exit 1; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER1}\",\"password\":\"${PASS1}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
API_KEY=$(echo "$BODY" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
[ "$HTTP" = "200" ] && [ -n "$API_KEY" ] && pass "login char1" || { fail "login char1 → HTTP $HTTP"; exit 1; }
AUTH_H=(-H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -H "Accept: application/json")

# ── REWARDS CRUD ─────────────────────────────────────────────
section "REWARDS CRUD (11-17 skip, 15-17 here)"
echo "TEST: POST /rewards"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/rewards" "${AUTH_H[@]}" \
  -d '{"icon":"🏆","name":"测试奖励","minPts":0,"desc":"用于claim测试"}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
REWARD_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && [ -n "$REWARD_ID" ] && \
  pass "POST /rewards → $HTTP | id=${REWARD_ID}" || fail "POST /rewards → $HTTP"; info "$BODY"

echo "TEST: PUT /rewards/${REWARD_ID}"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/rewards/${REWARD_ID}" "${AUTH_H[@]}" \
  -d '{"desc":"更新后的描述"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /rewards/{id} → $HTTP" || fail "PUT /rewards/{id} → $HTTP"

echo "TEST: POST /rewards (second, to delete)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/rewards" "${AUTH_H[@]}" \
  -d '{"icon":"🗑️","name":"待删除奖励","minPts":50,"desc":"delete test"}')
BODY=$(echo "$RES" | head -1)
REWARD_DEL_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "TEST: DELETE /rewards/${REWARD_DEL_ID}"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/rewards/${REWARD_DEL_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /rewards/{id} → $HTTP" || fail "DELETE /rewards/{id} → $HTTP"

# ── PUNISHMENTS CRUD ─────────────────────────────────────────
section "PUNISHMENTS CRUD (18-20)"
echo "TEST: POST /punishments"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/punishments" "${AUTH_H[@]}" \
  -d '{"icon":"😈","name":"测试惩罚","minPts":-20,"desc":"CRUD测试"}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
PUN_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && [ -n "$PUN_ID" ] && \
  pass "POST /punishments → $HTTP | id=${PUN_ID}" || fail "POST /punishments → $HTTP"; info "$BODY"

echo "TEST: PUT /punishments/${PUN_ID}"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/punishments/${PUN_ID}" "${AUTH_H[@]}" \
  -d '{"desc":"更新后的描述"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /punishments/{id} → $HTTP" || fail "PUT /punishments/{id} → $HTTP"

echo "TEST: DELETE /punishments/${PUN_ID}"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/punishments/${PUN_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /punishments/{id} → $HTTP" || fail "DELETE /punishments/{id} → $HTTP"

# ── CHAR IMAGE ────────────────────────────────────────────────
section "AVATAR (23)"
echo "TEST: PUT /auth/charimg"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/auth/charimg" "${AUTH_H[@]}" \
  -d '{"charImg":"data:image/png;base64,TESTIMAGEDATA"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /auth/charimg → $HTTP" || fail "PUT /auth/charimg → $HTTP"

echo "TEST: GET /config (verify charImg1 saved)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/config" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
echo "$BODY" | grep -q "TESTIMAGEDATA" && pass "GET /config → charImg1 persisted" || fail "GET /config → charImg1 NOT found"; info "$BODY"

# ── SHOP CRUD + BUY ───────────────────────────────────────────
section "SHOP (24-28)"
echo "TEST: POST /shop"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop" "${AUTH_H[@]}" \
  -d '{"icon":"🎁","name":"测试商品","desc":"shop测试","ptsCost":0}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
SHOP_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && [ -n "$SHOP_ID" ] && \
  pass "POST /shop → $HTTP | id=${SHOP_ID}" || fail "POST /shop → $HTTP"; info "$BODY"

echo "TEST: GET /shop"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/shop" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "GET /shop → $HTTP" || fail "GET /shop → $HTTP"

echo "TEST: PUT /shop/${SHOP_ID}"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/shop/${SHOP_ID}" "${AUTH_H[@]}" \
  -d '{"desc":"更新后的商品描述"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /shop/{id} → $HTTP" || fail "PUT /shop/{id} → $HTTP"

echo "TEST: POST /shop/buy/${SHOP_ID} (0-cost item, should succeed with 0 balance)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_ID}" "${AUTH_H[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_ID=$(echo "$BODY" | grep -o '"bagItemId":"[^"]*"' | cut -d'"' -f4)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && [ -n "$BAG_ID" ] && \
  pass "POST /shop/buy/{id} → $HTTP | bagItemId=${BAG_ID}" || fail "POST /shop/buy/{id} → $HTTP"; info "$BODY"

echo "TEST: POST /shop/buy/${SHOP_ID} again with insufficient points (create a costly item)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop" "${AUTH_H[@]}" \
  -d '{"icon":"💎","name":"贵重商品","desc":"insufficient test","ptsCost":99999}')
BODY=$(echo "$RES" | head -1)
SHOP_EXPENSIVE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_EXPENSIVE_ID}" "${AUTH_H[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "400" ] && echo "$BODY" | grep -q "insufficient_points" && \
  pass "POST /shop/buy/{id} correctly rejects insufficient points → $HTTP" || fail "POST /shop/buy/{id} insufficient-points check → $HTTP"; info "$BODY"

# ── BAG ───────────────────────────────────────────────────────
section "BAG (29-32)"
echo "TEST: GET /bag (should include the purchased item)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/bag" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "200" ] && echo "$BODY" | grep -q "测试商品" && \
  pass "GET /bag → $HTTP | contains purchased item" || fail "GET /bag → $HTTP"; info "$BODY"

echo "TEST: POST /bag/use/${BAG_ID}"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "POST /bag/use/{id} → $HTTP" || fail "POST /bag/use/{id} → $HTTP"

echo "TEST: POST /bag/use/${BAG_ID} again (should fail, already_used)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "400" ] && echo "$BODY" | grep -q "already_used" && \
  pass "POST /bag/use/{id} correctly rejects re-use → $HTTP" || fail "POST /bag/use/{id} re-use check → $HTTP"

echo "TEST: GET /bag/history (should include the used item)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/bag/history" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "200" ] && echo "$BODY" | grep -q "测试商品" && \
  pass "GET /bag/history → $HTTP | contains used item" || fail "GET /bag/history → $HTTP"

echo "TEST: POST /bag/claim (milestone reward → bag)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH_H[@]}" \
  -d "{\"rewardId\":\"${REWARD_ID}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
([ "$HTTP" = "201" ] || [ "$HTTP" = "200" ]) && pass "POST /bag/claim → $HTTP" || fail "POST /bag/claim → $HTTP"; info "$BODY"

echo "TEST: POST /bag/claim again (should fail, already_claimed)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH_H[@]}" \
  -d "{\"rewardId\":\"${REWARD_ID}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "400" ] && echo "$BODY" | grep -q "already_claimed" && \
  pass "POST /bag/claim correctly rejects double-claim → $HTTP" || fail "POST /bag/claim double-claim check → $HTTP"

# ── MONTHLY SETTLE ────────────────────────────────────────────
section "MONTHLY SETTLE (11)"
MONTH=$(date +%Y-%m); TODAY=$(date +%Y-%m-%d)
echo "TEST: POST /entries (create one to be archived by settle)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/entries" "${AUTH_H[@]}" \
  -d "{\"charId\":\"char1\",\"catId\":\"\",\"catName\":\"结算测试\",\"icon\":\"📅\",\"pts\":10,\"desc\":\"settle test\",\"month\":\"${MONTH}\",\"date\":\"${TODAY}\"}")
BODY=$(echo "$RES" | head -1)
SETTLE_ENTRY_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

echo "TEST: POST /monthly/settle"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH_H[@]}" \
  -d "{\"month\":\"${MONTH}\",\"char1Pts\":10,\"char2Pts\":0,\"mode\":\"reward\",\"result1\":\"测试结果\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "200" ] && echo "$BODY" | grep -q '"success":true' && \
  pass "POST /monthly/settle → $HTTP" || fail "POST /monthly/settle → $HTTP"; info "$BODY"

echo "TEST: GET /entries?month=${MONTH} (settled entry should no longer appear as active)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/entries?month=${MONTH}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
echo "$BODY" | grep -q "${SETTLE_ENTRY_ID}" && fail "GET /entries → settled entry still shows as active" || pass "GET /entries → settled entry correctly archived (not in active list)"

echo "TEST: GET /history (settled month should appear)"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/history" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "200" ] && echo "$BODY" | grep -q "${MONTH}" && \
  pass "GET /history → $HTTP | contains settled month" || fail "GET /history → $HTTP"

# ── CLEANUP (shop items only — no DELETE endpoint exists for rewards-claimed/bag/monthly) ──
section "CLEANUP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/shop/${SHOP_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /shop/{id} → $HTTP" || fail "DELETE /shop/{id} → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/shop/${SHOP_EXPENSIVE_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /shop/{id} (expensive) → $HTTP" || fail "DELETE /shop/{id} (expensive) → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/rewards/${REWARD_ID}" "${AUTH_H[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "DELETE /rewards/{id} (claimed test reward) → $HTTP" || fail "DELETE /rewards/{id} → $HTTP"
info "Note: test u_love_auth/u_love_match/u_love_bag/u_love_monthly rows for ${USER1}/${USER2} are NOT deleted (no DELETE endpoint exists for them) — harmless leftover test data, safe to ignore or clean up manually in SN."

# ── SUMMARY ───────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "  RESULTS: ${GREEN}${PASS_COUNT} passed${NC}  |  ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
if [ "$FAIL_COUNT" -eq "0" ]; then
  echo -e "${GREEN}🎉 All extended tests passed!${NC}"
else
  echo -e "${RED}⚠️  ${FAIL_COUNT} test(s) failed — check output above.${NC}"
fi
echo ""
