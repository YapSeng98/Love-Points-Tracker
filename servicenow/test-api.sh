#!/bin/bash
# ============================================================
# 恋爱积分簿 — Full API Test Script
# Run: bash servicenow/test-api.sh
# ============================================================

INSTANCE="dev405150.service-now.com"
USER="love_score_api"
PASS="${1:-}"   # pass PIN as first arg: bash test-api.sh yourPIN
if [ -z "$PASS" ]; then
  read -rsp "Enter love_score_api PIN: " PASS
  echo ""
fi

BASE="https://${INSTANCE}/api/x_887486_love_app/love_score"
AUTH=$(echo -n "${USER}:${PASS}" | base64)
HEADERS=(-H "Authorization: Basic ${AUTH}" -H "Content-Type: application/json" -H "Accept: application/json")

PASS_COUNT=0
FAIL_COUNT=0
CREATED_ENTRY_ID=""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} — $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC} — $1"; ((FAIL_COUNT++)); }
info() { echo -e "${YELLOW}   → $1${NC}"; }

echo ""
echo "============================================================"
echo "  恋爱积分簿 — API Full Test"
echo "  Instance : ${INSTANCE}"
echo "  User     : ${USER}"
echo "  Base URL : ${BASE}"
echo "============================================================"
echo ""

# ── TEST 1: GET /config ──────────────────────────────────────
echo "TEST 1: GET /config"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/config" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
if [ "$HTTP" = "200" ]; then
  pass "GET /config → HTTP $HTTP"
  info "$BODY"
else
  fail "GET /config → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 2: PUT /config ──────────────────────────────────────
echo "TEST 2: PUT /config"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${HEADERS[@]}" \
  -d '{"mode":"reward","rewardTarget":100,"punishThreshold":-80}')
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
if [ "$HTTP" = "200" ]; then
  pass "PUT /config → HTTP $HTTP"
  info "$BODY"
else
  fail "PUT /config → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 3: GET /categories ──────────────────────────────────
echo "TEST 3: GET /categories"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/categories" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$HTTP" = "200" ]; then
  pass "GET /categories → HTTP $HTTP | Found ${COUNT} categories"
  info "$BODY"
else
  fail "GET /categories → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 4: GET /rewards ─────────────────────────────────────
echo "TEST 4: GET /rewards"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/rewards" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$HTTP" = "200" ]; then
  pass "GET /rewards → HTTP $HTTP | Found ${COUNT} rewards"
  info "$BODY"
else
  fail "GET /rewards → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 5: GET /punishments ─────────────────────────────────
echo "TEST 5: GET /punishments"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/punishments" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$HTTP" = "200" ]; then
  pass "GET /punishments → HTTP $HTTP | Found ${COUNT} punishments"
  info "$BODY"
else
  fail "GET /punishments → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 6: POST /entries (STORE to SN) ──────────────────────
echo "TEST 6: POST /entries — store a test entry in SN"
TODAY=$(date +%Y-%m-%d)
MONTH=$(date +%Y-%m)
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/entries" "${HEADERS[@]}" \
  -d "{\"charId\":\"char1\",\"catId\":\"\",\"catName\":\"API Test 🧪\",\"icon\":\"🧪\",\"pts\":5,\"desc\":\"Auto test entry\",\"month\":\"${MONTH}\",\"date\":\"${TODAY}\"}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
CREATED_ENTRY_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$HTTP" = "201" ] && [ -n "$CREATED_ENTRY_ID" ]; then
  pass "POST /entries → HTTP $HTTP | Created entry ID: ${CREATED_ENTRY_ID}"
  info "$BODY"
else
  fail "POST /entries → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 7: GET /entries (RETRIEVE from SN) ──────────────────
echo "TEST 7: GET /entries — retrieve entries from SN"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/entries?month=${MONTH}" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
FOUND=$(echo "$BODY" | grep -o '"API Test' | wc -l | tr -d ' ')
if [ "$HTTP" = "200" ] && [ "$FOUND" -ge "1" ]; then
  pass "GET /entries → HTTP $HTTP | Test entry found in SN ✅"
  info "$BODY"
else
  fail "GET /entries → HTTP $HTTP | Test entry NOT found"
  info "$BODY"
fi
echo ""

# ── TEST 8: PUT /entries/{id} ────────────────────────────────
echo "TEST 8: PUT /entries/${CREATED_ENTRY_ID} — update entry in SN"
if [ -n "$CREATED_ENTRY_ID" ]; then
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/entries/${CREATED_ENTRY_ID}" "${HEADERS[@]}" \
    -d '{"desc":"Updated by test","pts":10}')
  HTTP=$(echo "$RES" | tail -1)
  BODY=$(echo "$RES" | head -1)
  if [ "$HTTP" = "200" ]; then
    pass "PUT /entries/{id} → HTTP $HTTP"
    info "$BODY"
  else
    fail "PUT /entries/{id} → HTTP $HTTP"
    info "$BODY"
  fi
else
  fail "PUT /entries/{id} — skipped (no entry ID from TEST 6)"
fi
echo ""

# ── TEST 9: GET /history ─────────────────────────────────────
echo "TEST 9: GET /history"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/history" "${HEADERS[@]}")
HTTP=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | head -1)
if [ "$HTTP" = "200" ]; then
  pass "GET /history → HTTP $HTTP"
  info "$BODY"
else
  fail "GET /history → HTTP $HTTP"
  info "$BODY"
fi
echo ""

# ── TEST 10: DELETE /entries/{id} (cleanup) ──────────────────
echo "TEST 10: DELETE /entries/${CREATED_ENTRY_ID} — cleanup test entry"
if [ -n "$CREATED_ENTRY_ID" ]; then
  RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/entries/${CREATED_ENTRY_ID}" "${HEADERS[@]}")
  HTTP=$(echo "$RES" | tail -1)
  BODY=$(echo "$RES" | head -1)
  if [ "$HTTP" = "200" ]; then
    pass "DELETE /entries/{id} → HTTP $HTTP | Test entry cleaned up"
    info "$BODY"
  else
    fail "DELETE /entries/{id} → HTTP $HTTP"
    info "$BODY"
  fi
else
  fail "DELETE /entries/{id} — skipped (no entry ID)"
fi
echo ""

# ── SUMMARY ──────────────────────────────────────────────────
echo "============================================================"
echo -e "  RESULTS: ${GREEN}${PASS_COUNT} passed${NC}  |  ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
echo ""
if [ "$FAIL_COUNT" -eq "0" ]; then
  echo -e "${GREEN}🎉 All tests passed — SN backend is fully connected!${NC}"
else
  echo -e "${RED}⚠️  ${FAIL_COUNT} test(s) failed — check the output above.${NC}"
  echo ""
  echo "Common causes:"
  echo "  401 → wrong username/password for love_score_api"
  echo "  403 → user missing rest_service role"
  echo "  404 → wrong API path or resource not created"
  echo "  0   → CORS or network issue (try from terminal, not browser)"
fi
echo ""
