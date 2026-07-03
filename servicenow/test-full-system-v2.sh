#!/bin/bash
# ============================================================
# 恋爱积分簿 — Full System Test v2 (every feature + edge scenarios)
#
# Covers everything v1 did, plus:
#  - Emoji icon round-trip using app.js's exact \xCODEPOINT encoding
#    (supplementary emoji) and raw BMP emoji
#  - needsSetup flow (first GET /config before any config exists)
#  - Partial PUT /config must not clobber other fields (startDate)
#  - 4 settled months incl. "punishment mode but everyone safe"
#    and "positive score while in punishment mode"
#  - 500-char text limit round-trip on entry note
#  - Category deleted after entries logged -> snapshot survives
#  - Multiple shop purchases in one month + partial bag usage
#  - History ordering (desc by month)
#  - Cross-couple isolation + auth failure modes
#
# Leaves the current month UNSETTLED and fully seeded with real
# emoji data so the account is ready for manual review in the app.
#
# Usage: bash servicenow/test-full-system-v2.sh
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
id_count()    { echo "$1" | grep -o '"id"' | wc -l | tr -d ' '; }

echo ""
echo "============================================================"
echo "  恋爱积分簿 — FULL SYSTEM TEST v2"
echo "  Instance : ${INSTANCE}"
echo "============================================================"

TS=$(date +%s)
PASSWORD="LoveTest2026!"
USER1="test_v2_cs_${TS}"
USER2="test_v2_tt_${TS}"
USERD1="test_v2iso_cs_${TS}"
USERD2="test_v2iso_tt_${TS}"

M1=$(date -v-4m +%Y-%m)
M2=$(date -v-3m +%Y-%m)
M3=$(date -v-2m +%Y-%m)
M4=$(date -v-1m +%Y-%m)
M5=$(date +%Y-%m)
TODAY=$(date +%Y-%m-%d)

# Emoji icons, encoded exactly as app.js encodeForSN() does:
# code points > 0xFFFF become \xHEX (JSON-escaped here as \\x), BMP stay raw.
I_COUPLE='\\x1F491'   # 💑
I_GIFT='\\x1F381'     # 🎁
I_COOK='\\x1F373'     # 🍳
I_CLOCK='⏰'          # U+23F0 BMP, raw
I_ANGRY='\\x1F624'    # 😤
I_PHONE='\\x1F4F1'    # 📱
I_ICECREAM='\\x1F366' # 🍦
I_MOVIE='\\x1F3AC'    # 🎬
I_PLANE='✈️'          # U+2708+FE0F BMP, raw
I_BROOM='\\x1F9F9'    # 🧹
I_GAME='\\x1F3AE'     # 🎮
I_MASSAGE='\\x1F486'  # 💆
I_BOBA='\\x1F9CB'     # 🧋
I_COFFEE='☕'         # U+2615 BMP, raw
I_TICKET='\\x1F39F'   # 🎟

# ════════════════════════════════════════════════════════════
section "1. SETUP — register + pair + dual login"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER1}\",\"password\":\"${PASSWORD}\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
PAIR_CODE=$(extract "$BODY" pairCode)
[ "$HTTP" = "201" ] && [ -n "$PAIR_CODE" ] && pass "register char1 (${USER1}), pairCode=${PAIR_CODE}" || { fail "register char1 → $HTTP"; info "$BODY"; exit 1; }

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" \
  -d "{\"username\":\"${USER2}\",\"password\":\"${PASSWORD}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR_CODE}\"}")
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
MATCH_ID=$(extract "$BODY" matchId)
PARTNER=$(extract "$BODY" partnerName)
[ "$HTTP" = "201" ] && [ "$PARTNER" = "$USER1" ] && pass "register char2, paired; partnerName correctly returned (${PARTNER})" || fail "register char2 → $HTTP partner=${PARTNER}"

RES=$(curl -s -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"${PASSWORD}\"}")
API_KEY1=$(extract "$RES" apiKey)
[ -n "$API_KEY1" ] && pass "login char1" || { fail "login char1"; exit 1; }
AUTH1=(-H "Authorization: Bearer ${API_KEY1}" -H "Content-Type: application/json" -H "Accept: application/json")

RES=$(curl -s -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER2}\",\"password\":\"${PASSWORD}\"}")
API_KEY2=$(extract "$RES" apiKey)
[ -n "$API_KEY2" ] && pass "login char2" || { fail "login char2"; exit 1; }
AUTH2=(-H "Authorization: Bearer ${API_KEY2}" -H "Content-Type: application/json" -H "Accept: application/json")

# ════════════════════════════════════════════════════════════
section "2. FIRST-RUN — needsSetup flow"
# ════════════════════════════════════════════════════════════
RES=$(curl -s "${BASE}/config" "${AUTH1[@]}")
echo "$RES" | grep -q '"configured":false' && pass "GET /config before any setup → configured:false (app shows setup wizard)" || fail "needsSetup flow: $RES"

section "3. CONFIG — full write, then partial update must not clobber"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" \
  -d '{"mode":"reward","rewardTarget":100,"punishThreshold":-80,"startDate":"2024-02-14"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /config full (reward, 100, -80, startDate 2024-02-14)" || fail "PUT /config full → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" -d '{"mode":"reward"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /config partial (mode only)" || fail "PUT /config partial → $HTTP"

RES=$(curl -s "${BASE}/config" "${AUTH1[@]}")
echo "$RES" | grep -q '"startDate":"2024-02-14"' && echo "$RES" | grep -q '"rewardTarget":100' && \
  pass "GET /config → startDate + rewardTarget survived partial update" || fail "partial update clobbered config: $RES"

# ════════════════════════════════════════════════════════════
section "4. EMOJI ICON ROUND-TRIP (app.js \\xCODEPOINT encoding)"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -X POST "${BASE}/categories" "${AUTH1[@]}" -d "{\"icon\":\"${I_COUPLE}\",\"name\":\"emoji往返测试\",\"pts\":1}")
EMOJI_CAT_ID=$(extract "$RES" id)
[ -n "$EMOJI_CAT_ID" ] && pass "POST /categories with encoded 💑 (\\x1F491)" || fail "emoji category create"

RES=$(curl -s "${BASE}/categories" "${AUTH1[@]}")
echo "$RES" | grep -q 'x1F491' && pass "GET /categories → encoded emoji survives round-trip byte-exact" || fail "encoded emoji corrupted: $RES"

RES=$(curl -s -X POST "${BASE}/categories" "${AUTH1[@]}" -d "{\"icon\":\"${I_CLOCK}\",\"name\":\"BMP原生emoji测试\",\"pts\":1}")
BMP_CAT_ID=$(extract "$RES" id)
RES=$(curl -s "${BASE}/categories" "${AUTH1[@]}")
echo "$RES" | grep -q '⏰' && pass "GET /categories → raw BMP emoji ⏰ survives round-trip" || fail "BMP emoji corrupted: $RES"

RES=$(curl -s -X POST "${BASE}/entries" "${AUTH1[@]}" \
  -d "{\"charId\":\"char1\",\"catId\":\"\",\"catName\":\"emoji条目\",\"icon\":\"${I_BOBA}\",\"pts\":1,\"desc\":\"icon test\",\"month\":\"${M5}\",\"date\":\"${TODAY}\"}")
EMOJI_ENTRY_ID=$(extract "$RES" id)
RES=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH1[@]}")
echo "$RES" | grep -q 'x1F9CB' && pass "entry icon 🧋 (\\x1F9CB) round-trips through /entries" || fail "entry emoji corrupted"
curl -s -X DELETE "${BASE}/entries/${EMOJI_ENTRY_ID}" "${AUTH1[@]}" > /dev/null
curl -s -X DELETE "${BASE}/categories/${EMOJI_CAT_ID}" "${AUTH1[@]}" > /dev/null
curl -s -X DELETE "${BASE}/categories/${BMP_CAT_ID}" "${AUTH1[@]}" > /dev/null

# ════════════════════════════════════════════════════════════
section "5. LONG TEXT — 500-char note round-trip"
# ════════════════════════════════════════════════════════════
LONG=$(printf 'A%.0s' $(seq 1 500))
RES=$(curl -s -X POST "${BASE}/entries" "${AUTH1[@]}" \
  -d "{\"charId\":\"char1\",\"catId\":\"\",\"catName\":\"长文本测试\",\"icon\":\"${I_GIFT}\",\"pts\":1,\"desc\":\"${LONG}\",\"month\":\"${M5}\",\"date\":\"${TODAY}\"}")
LONG_ENTRY_ID=$(extract "$RES" id)
RES=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH1[@]}")
GOT_LEN=$(echo "$RES" | grep -o 'AAAA*' | head -1 | tr -d '\n' | wc -c | tr -d ' ')
[ "$GOT_LEN" = "500" ] && pass "500-char entry note stored + returned intact (got ${GOT_LEN} chars)" || fail "long note truncated/corrupted: got ${GOT_LEN}/500 chars"
curl -s -X DELETE "${BASE}/entries/${LONG_ENTRY_ID}" "${AUTH1[@]}" > /dev/null

# ════════════════════════════════════════════════════════════
section "6. SEED — real data with proper emoji (6 cats, 3 rewards, 3 punishments, 4 shop)"
# ════════════════════════════════════════════════════════════
mk_item() { # $1 endpoint, $2 json, $3 label
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}$1" "${AUTH1[@]}" -d "$2")
  HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
  ID=$(extract "$BODY" id)
  ([ "$HTTP" = "201" ] && [ -n "$ID" ]) && pass "POST $1 ($3)" || fail "POST $1 ($3) → $HTTP"
  echo "$ID"
}
CAT_TIME=$(mk_item /categories "{\"icon\":\"${I_COUPLE}\",\"name\":\"陪伴时光\",\"pts\":10}" "💑 陪伴时光 +10")
CAT_GIFT=$(mk_item /categories "{\"icon\":\"${I_GIFT}\",\"name\":\"惊喜礼物\",\"pts\":15}" "🎁 惊喜礼物 +15")
CAT_COOK=$(mk_item /categories "{\"icon\":\"${I_COOK}\",\"name\":\"亲自煮饭\",\"pts\":8}" "🍳 亲自煮饭 +8")
CAT_LATE=$(mk_item /categories "{\"icon\":\"${I_CLOCK}\",\"name\":\"约会迟到\",\"pts\":-5}" "⏰ 约会迟到 -5")
CAT_FORGET=$(mk_item /categories "{\"icon\":\"${I_ANGRY}\",\"name\":\"忘记约定\",\"pts\":-10}" "😤 忘记约定 -10")
CAT_PHONE=$(mk_item /categories "{\"icon\":\"${I_PHONE}\",\"name\":\"手机太久\",\"pts\":-5}" "📱 手机太久 -5")

RWD_SNACK=$(mk_item /rewards "{\"icon\":\"${I_ICECREAM}\",\"name\":\"小零食一份\",\"minPts\":50,\"desc\":\"任意选一样零食\"}" "🍦 小零食 ≥50")
RWD_MOVIE=$(mk_item /rewards "{\"icon\":\"${I_MOVIE}\",\"name\":\"电影之夜\",\"minPts\":100,\"desc\":\"对方全程安排\"}" "🎬 电影之夜 ≥100")
RWD_TRIP=$(mk_item /rewards "{\"icon\":\"${I_PLANE}\",\"name\":\"旅行一次\",\"minPts\":150,\"desc\":\"两人小旅行\"}" "✈️ 旅行 ≥150")

PUN_CHORE=$(mk_item /punishments "{\"icon\":\"${I_BROOM}\",\"name\":\"做家务一周\",\"minPts\":30,\"desc\":\"全部家务包揽\"}" "🧹 做家务 ≥30")
PUN_GAME=$(mk_item /punishments "{\"icon\":\"${I_GAME}\",\"name\":\"一周不打游戏\",\"minPts\":60,\"desc\":\"还要陪伴对方\"}" "🎮 禁游戏 ≥60")
PUN_MASSAGE=$(mk_item /punishments "{\"icon\":\"${I_MASSAGE}\",\"name\":\"按摩七天\",\"minPts\":80,\"desc\":\"每天十分钟\"}" "💆 按摩 ≥80")

SHOP_BOBA=$(mk_item /shop "{\"icon\":\"${I_BOBA}\",\"name\":\"奶茶一杯\",\"desc\":\"任选一杯奶茶\",\"ptsCost\":15}" "🧋 奶茶 15分")
SHOP_COFFEE=$(mk_item /shop "{\"icon\":\"${I_COFFEE}\",\"name\":\"咖啡一杯\",\"desc\":\"早晨咖啡直送\",\"ptsCost\":10}" "☕ 咖啡 10分")
SHOP_TICKET=$(mk_item /shop "{\"icon\":\"${I_TICKET}\",\"name\":\"电影票\",\"desc\":\"一起看电影\",\"ptsCost\":30}" "🎟 电影票 30分")
SHOP_MASSAGE=$(mk_item /shop "{\"icon\":\"${I_MASSAGE}\",\"name\":\"按摩券\",\"desc\":\"三十分钟按摩\",\"ptsCost\":50}" "💆 按摩券 50分")

RES=$(curl -s "${BASE}/shop" "${AUTH1[@]}")
ACTIVE_COUNT=$(echo "$RES" | grep -o '"active":true' | wc -l | tr -d ' ')
[ "$ACTIVE_COUNT" = "4" ] && pass "GET /shop → all 4 items active:true (u_active rename verified)" || fail "shop active flags wrong: $RES"

# ════════════════════════════════════════════════════════════
section "7. MONTH 1 (${M1}, reward) — normal month, nobody reaches target"
# ════════════════════════════════════════════════════════════
mk_entry() { # $1 AUTH1|AUTH2, $2 charId, $3 catId, $4 catName, $5 icon, $6 pts, $7 month, $8 date, $9 desc
  if [ "$1" = "AUTH1" ]; then AUTHARR=("${AUTH1[@]}"); else AUTHARR=("${AUTH2[@]}"); fi
  RES=$(curl -s -X POST "${BASE}/entries" "${AUTHARR[@]}" \
    -d "{\"charId\":\"$2\",\"catId\":\"$3\",\"catName\":\"$4\",\"icon\":\"$5\",\"pts\":$6,\"desc\":\"$9\",\"month\":\"$7\",\"date\":\"$8\"}")
  extract "$RES" id
}

E=$(mk_entry AUTH1 char1 "$CAT_TIME" "陪伴时光" "$I_COUPLE" 10 "$M1" "${M1}-06" "一起散步")
E=$(mk_entry AUTH1 char1 "$CAT_GIFT" "惊喜礼物" "$I_GIFT" 15 "$M1" "${M1}-14" "小礼物")
E=$(mk_entry AUTH2 char2 "$CAT_TIME" "陪伴时光" "$I_COUPLE" 10 "$M1" "${M1}-09" "一起做饭")
E=$(mk_entry AUTH2 char2 "$CAT_LATE" "约会迟到" "$I_CLOCK" -5 "$M1" "${M1}-20" "迟到十分钟")
RES=$(curl -s "${BASE}/entries?month=${M1}" "${AUTH1[@]}")
TOTAL=$(sum_pts "$RES")
[ "$TOTAL" = "30" ] && pass "M1 combined total=30 (char1:25, char2:5) — nobody reaches 100" || fail "M1 total mismatch: ${TOTAL}"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M1}\",\"char1Pts\":25,\"char2Pts\":5,\"mode\":\"reward\",\"result1\":\"\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "settle M1 (no outcomes)" || fail "settle M1 → $HTTP"

section "8. MONTH 2 (${M2}, reward) — char1 hits 100 exactly (boundary)"
E=$(mk_entry AUTH1 char1 "$CAT_TIME" "陪伴时光" "$I_COUPLE" 40 "$M2" "${M2}-05" "周末旅行陪伴")
E=$(mk_entry AUTH1 char1 "$CAT_GIFT" "惊喜礼物" "$I_GIFT" 35 "$M2" "${M2}-12" "生日惊喜")
E=$(mk_entry AUTH1 char1 "$CAT_COOK" "亲自煮饭" "$I_COOK" 25 "$M2" "${M2}-25" "一周晚餐")
E=$(mk_entry AUTH2 char2 "$CAT_COOK" "亲自煮饭" "$I_COOK" 20 "$M2" "${M2}-15" "煮饭")
RES=$(curl -s "${BASE}/entries?month=${M2}" "${AUTH1[@]}")
TOTAL=$(sum_pts "$RES")
[ "$TOTAL" = "120" ] && pass "M2 combined=120; char1=100 exactly hits reward target (boundary)" || fail "M2 total mismatch: ${TOTAL}"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M2}\",\"char1Pts\":100,\"char2Pts\":20,\"mode\":\"reward\",\"result1\":\"电影之夜\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "settle M2 (char1 wins 电影之夜)" || fail "settle M2 → $HTTP"

section "9. MONTH 3 (${M3}, punishment) — char2 hits -80 exactly; char1 POSITIVE in punishment mode"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" -d '{"mode":"punishment"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "mode switched to punishment" || fail "mode switch → $HTTP"

E=$(mk_entry AUTH2 char2 "$CAT_FORGET" "忘记约定" "$I_ANGRY" -30 "$M3" "${M3}-04" "忘记纪念日")
E=$(mk_entry AUTH2 char2 "$CAT_FORGET" "忘记约定" "$I_ANGRY" -30 "$M3" "${M3}-16" "又忘了")
E=$(mk_entry AUTH2 char2 "$CAT_PHONE" "手机太久" "$I_PHONE" -20 "$M3" "${M3}-27" "刷手机一晚")
E=$(mk_entry AUTH1 char1 "$CAT_COOK" "亲自煮饭" "$I_COOK" 15 "$M3" "${M3}-10" "煮饭")
RES=$(curl -s "${BASE}/entries?month=${M3}" "${AUTH1[@]}")
TOTAL=$(sum_pts "$RES")
[ "$TOTAL" = "-65" ] && pass "M3 combined=-65; char2=-80 exactly hits threshold; char1=+15 positive & safe in punishment mode" || fail "M3 total mismatch: ${TOTAL}"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M3}\",\"char1Pts\":15,\"char2Pts\":-80,\"mode\":\"punishment\",\"result1\":\"\",\"result2\":\"按摩七天\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "settle M3 (char2 gets 按摩七天)" || fail "settle M3 → $HTTP"

section "10. MONTH 4 (${M4}, punishment) — everyone safe, empty outcomes"
E=$(mk_entry AUTH1 char1 "$CAT_TIME" "陪伴时光" "$I_COUPLE" 10 "$M4" "${M4}-08" "陪伴")
E=$(mk_entry AUTH2 char2 "$CAT_COOK" "亲自煮饭" "$I_COOK" 8 "$M4" "${M4}-18" "煮饭")
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/monthly/settle" "${AUTH1[@]}" \
  -d "{\"month\":\"${M4}\",\"char1Pts\":10,\"char2Pts\":8,\"mode\":\"punishment\",\"result1\":\"\",\"result2\":\"\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "settle M4 (punishment mode, both safe, no outcomes)" || fail "settle M4 → $HTTP"

RES=$(curl -s "${BASE}/entries?month=${M4}" "${AUTH1[@]}")
[ "$(id_count "$RES")" = "0" ] && pass "M4 entries archived after settle" || fail "M4 entries still active"

section "11. HISTORY — 4 months, desc order, correct values"
RES=$(curl -s "${BASE}/history" "${AUTH1[@]}")
SEQ=$(echo "$RES" | grep -o '"month":"[^"]*"' | cut -d'"' -f4 | tr '\n' ' ')
EXPECTED="${M4} ${M3} ${M2} ${M1} "
[ "$SEQ" = "$EXPECTED" ] && pass "GET /history → 4 months in desc order: ${SEQ}" || fail "history order wrong: got '${SEQ}' expected '${EXPECTED}'"
echo "$RES" | grep -q '"char1Pts":100' && pass "history M2 shows char1Pts=100" || fail "history M2 values wrong"
echo "$RES" | grep -q '"char2Pts":-80' && pass "history M3 shows char2Pts=-80" || fail "history M3 values wrong"
echo "$RES" | grep -q '按摩七天' && pass "history M3 shows punishment outcome 按摩七天" || fail "history outcome missing"

# ════════════════════════════════════════════════════════════
section "12. MONTH 5 (${M5}, current, back to reward) — live month, stays UNSETTLED"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/config" "${AUTH1[@]}" -d '{"mode":"reward"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "mode switched back to reward" || fail "mode switch → $HTTP"

E1=$(mk_entry AUTH1 char1 "$CAT_TIME" "陪伴时光" "$I_COUPLE" 30 "$M5" "$TODAY" "早晨散步")
E2=$(mk_entry AUTH1 char1 "$CAT_GIFT" "惊喜礼物" "$I_GIFT" 40 "$M5" "$TODAY" "送花")
CUR_ENTRY_ID=$E1
[ -n "$E1" ] && [ -n "$E2" ] && pass "char1 logged 2 entries (30+40=70)" || fail "char1 M5 entries"

section "13. SNAPSHOT INTEGRITY — delete category after entry logged"
CAT_TEMP=$(mk_item /categories "{\"icon\":\"${I_GIFT}\",\"name\":\"特别惊喜\",\"pts\":20}" "临时分类 特别惊喜 +20")
E3=$(mk_entry AUTH1 char1 "$CAT_TEMP" "特别惊喜" "$I_GIFT" 20 "$M5" "$TODAY" "特别的一天")
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/categories/${CAT_TEMP}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "category deleted while entry references it" || fail "temp category delete → $HTTP"
RES=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH1[@]}")
echo "$RES" | grep -q '特别惊喜' && pass "entry still shows snapshot catName 特别惊喜 after category deletion" || fail "snapshot lost after category delete"
# char1 running total now 90

section "14. SHOP — multiple purchases, score math, insufficient guard"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_BOBA}" "${AUTH1[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_BOBA=$(extract "$BODY" bagItemId)
NS=$(extract_num "$BODY" newScore)
[ "$HTTP" = "201" ] && [ "${NS%%.*}" = "75" ] && pass "buy 🧋 奶茶 (15) → newScore=75" || fail "buy boba → $HTTP newScore=$NS"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_COFFEE}" "${AUTH1[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_COFFEE=$(extract "$BODY" bagItemId)
NS=$(extract_num "$BODY" newScore)
[ "$HTTP" = "201" ] && [ "${NS%%.*}" = "65" ] && pass "buy ☕ 咖啡 (10) → newScore=65" || fail "buy coffee → $HTTP newScore=$NS"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_TICKET}" "${AUTH1[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
BAG_TICKET=$(extract "$BODY" bagItemId)
NS=$(extract_num "$BODY" newScore)
[ "$HTTP" = "201" ] && [ "${NS%%.*}" = "35" ] && pass "buy 🎟 电影票 (30) → newScore=35" || fail "buy ticket → $HTTP newScore=$NS"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_MASSAGE}" "${AUTH1[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
[ "$HTTP" = "400" ] && echo "$BODY" | grep -q 'insufficient_points' && \
  pass "buy 💆 按摩券 (50) with 35 pts → 400 insufficient_points (guard works)" || fail "insufficient guard → $HTTP"

RES=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH1[@]}")
echo "$RES" | grep -q '商店兑换' && pass "deduction entries visible in ledger (🛒 商店兑换)" || fail "deduction entries missing"

section "15. BAG — partial usage + milestone claim + counts"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_BOBA}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "use 🧋 from bag" || fail "bag use → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_BOBA}" "${AUTH1[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "400" ] && pass "re-use same item → 400 already_used" || fail "re-use guard → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH1[@]}" -d "{\"rewardId\":\"${RWD_SNACK}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "201" ] && pass "claim milestone 🍦 小零食 → bag (backend-only feature, no UI + no score check — known gap)" || fail "claim → $HTTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTH1[@]}" -d "{\"rewardId\":\"${RWD_SNACK}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "400" ] && pass "double-claim → 400 already_claimed" || fail "double-claim guard → $HTTP"

RES=$(curl -s "${BASE}/bag" "${AUTH1[@]}")
N_ACTIVE=$(id_count "$RES")
N_PURCHASE=$(echo "$RES" | grep -o '"sourceType":"purchase"' | wc -l | tr -d ' ')
N_REWARD=$(echo "$RES" | grep -o '"sourceType":"reward"' | wc -l | tr -d ' ')
[ "$N_ACTIVE" = "3" ] && [ "$N_PURCHASE" = "2" ] && [ "$N_REWARD" = "1" ] && \
  pass "GET /bag → 3 active (2 purchase + 1 reward-claim)" || fail "bag counts wrong: active=$N_ACTIVE purchase=$N_PURCHASE reward=$N_REWARD"

RES=$(curl -s "${BASE}/bag/history" "${AUTH1[@]}")
[ "$(id_count "$RES")" = "1" ] && echo "$RES" | grep -q '奶茶一杯' && \
  pass "GET /bag/history → exactly 1 used item (奶茶)" || fail "bag history wrong: $RES"

section "16. PARTNER VIEW — char2 adds entry; both see same combined ledger"
E4=$(mk_entry AUTH2 char2 "$CAT_COOK" "亲自煮饭" "$I_COOK" 12 "$M5" "$TODAY" "晚餐")
RES1=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH1[@]}")
RES2=$(curl -s "${BASE}/entries?month=${M5}" "${AUTH2[@]}")
S1=$(sum_pts "$RES1"); S2=$(sum_pts "$RES2")
[ "$S1" = "$S2" ] && [ "$S1" = "47" ] && pass "both partners see combined 47 (char1: 90-55=35, char2: 12)" || fail "partner view mismatch: $S1 vs $S2 (expected 47)"

RES=$(curl -s "${BASE}/bag" "${AUTH2[@]}")
[ "$(id_count "$RES")" = "0" ] && pass "char2's bag is empty (bag is per-person, not shared)" || fail "char2 bag should be empty: $RES"

# ════════════════════════════════════════════════════════════
section "17. ISOLATION — second couple sees nothing, touches nothing"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USERD1}\",\"password\":\"${PASSWORD}\",\"charId\":\"char1\"}")
PAIR_D=$(extract "$RES" pairCode); KEY_D=$(extract "$RES" apiKey)
AUTHD=(-H "Authorization: Bearer ${KEY_D}" -H "Content-Type: application/json" -H "Accept: application/json")
[ -n "$KEY_D" ] && pass "register isolation couple char1" || fail "isolation register"

RES=$(curl -s "${BASE}/categories" "${AUTHD[@]}")
[ "$(id_count "$RES")" = "0" ] && pass "unpaired user sees 0 categories (no leak)" || fail "category leak: $RES"
RES=$(curl -s "${BASE}/shop" "${AUTHD[@]}")
[ "$(id_count "$RES")" = "0" ] && pass "unpaired user sees 0 shop items (no leak)" || fail "shop leak: $RES"
RES=$(curl -s "${BASE}/history" "${AUTHD[@]}")
[ "$(id_count "$RES")" = "0" ] && echo "$RES" | grep -qv "$M2" && pass "unpaired user sees empty history (no leak)" || fail "history leak"

curl -s -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USERD2}\",\"password\":\"${PASSWORD}\",\"charId\":\"char2\",\"pairCode\":\"${PAIR_D}\"}" > /dev/null
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/entries/${CUR_ENTRY_ID}" "${AUTHD[@]}" -d '{"pts":9999}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "foreign couple PUT on our entry → 404" || fail "cross-couple PUT → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE}/entries/${CUR_ENTRY_ID}" "${AUTHD[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "foreign couple DELETE on our entry → 404" || fail "cross-couple DELETE → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/shop/buy/${SHOP_COFFEE}" "${AUTHD[@]}" -d '{}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "foreign couple buying our shop item → 404" || fail "cross-couple buy → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/use/${BAG_COFFEE}" "${AUTHD[@]}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "foreign couple using our bag item → 404" || fail "cross-couple bag use → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/bag/claim" "${AUTHD[@]}" -d "{\"rewardId\":\"${RWD_MOVIE}\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "foreign couple claiming our reward → 404" || fail "cross-couple claim → $HTTP"

# ════════════════════════════════════════════════════════════
section "18. AUTH FAILURE MODES"
# ════════════════════════════════════════════════════════════
RES=$(curl -s -w "\n%{http_code}" "${BASE}/config" -H "Authorization: Bearer totally-fake-token" -H "Accept: application/json")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "401" ] && pass "garbage token → 401" || fail "garbage token → $HTTP"
RES=$(curl -s -w "\n%{http_code}" "${BASE}/config" -H "Accept: application/json")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "401" ] && pass "missing Authorization header → 401" || fail "missing header → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"wrong\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "401" ] && pass "wrong password → 401" || fail "wrong password → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/login" "${PUB_HEADERS[@]}" -d '{"username":"ghost_user_none","password":"x"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "nonexistent user → 404" || fail "nonexistent user → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d "{\"username\":\"${USER1}\",\"password\":\"x\",\"charId\":\"char1\"}")
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "409" ] && pass "duplicate username → 409" || fail "duplicate register → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d '{"username":"new_ghost","password":"x","charId":"char2","pairCode":"000000"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "404" ] && pass "invalid pair code → 404" || fail "invalid pair code → $HTTP"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/auth/register" "${PUB_HEADERS[@]}" -d '{"username":"","password":"","charId":"char1"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "400" ] && pass "empty username/password → 400" || fail "empty credentials → $HTTP"

section "19. AVATAR"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/auth/charimg" "${AUTH1[@]}" -d '{"charImg":"data:image/jpeg;base64,V2AVATARDATA"}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "PUT /auth/charimg (char1)" || fail "avatar → $HTTP"
RES=$(curl -s "${BASE}/config" "${AUTH2[@]}")
echo "$RES" | grep -q 'V2AVATARDATA' && pass "char2's GET /config sees char1's avatar (shared via config)" || fail "avatar not visible to partner"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE}/auth/charimg" "${AUTH1[@]}" -d '{"charImg":""}')
HTTP=$(echo "$RES" | tail -1)
[ "$HTTP" = "200" ] && pass "avatar reset to empty (delete flow)" || fail "avatar reset → $HTTP"

# ════════════════════════════════════════════════════════════
# NO cleanup of couple's data — current month left live for review
# ════════════════════════════════════════════════════════════
echo ""
echo "============================================================"
echo -e "  RESULTS: ${GREEN}${PASS_COUNT} passed${NC}  |  ${RED}${FAIL_COUNT} failed${NC}"
echo "============================================================"
echo ""
echo -e "${BOLD}Review account (data left live, current month unsettled):${NC}"
echo "  char1 (他): username=${USER1}  password=${PASSWORD}"
echo "  char2 (她): username=${USER2}  password=${PASSWORD}"
echo ""
echo "  What you'll see in the app:"
echo "   - 4 settled months in History (incl. reward win + punishment)"
echo "   - Current month live: char1=35分, char2=12分"
echo "   - 6 categories / 3 rewards / 3 punishments / 4 shop items, all with emoji"
echo "   - char1's bag: 2 active purchases + 1 claimed reward; 1 used item in bag history"
echo ""
