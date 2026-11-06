#!/bin/bash
# 答えの案と、木ごとの前の相談の確かめ（2026-11-06）
#   bash 答えの案と木の記録_確かめと見本の撮り直し.sh          → AIを使わずに流れだけ確かめる（費用なし）
#   bash 答えの案と木の記録_確かめと見本の撮り直し.sh 撮る     → Claude Code で本物の答えの案を作り、見本として残す（使用枠を使う）
# どちらも、いつもの保存データ（データ/保存データ.json）には触らない。
set -u
cd "$(dirname "$0")"
WORK=$(mktemp -d)
PORT=8798
if [ "${1:-}" = "撮る" ]; then
  PORT=$PORT AI_MODE=claude-code BONSAI_DATA="$WORK/保存データ.json" BONSAI_RECORD="$WORK/撮った答え.json" node サーバー.mjs > "$WORK/サーバー.log" 2>&1 &
else
  PORT=$PORT BONSAI_DATA="$WORK/保存データ.json" node サーバー.mjs > "$WORK/サーバー.log" 2>&1 &
fi
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 2
URL="http://127.0.0.1:$PORT"

body() { # 質問 木の番号
  python3 - "$1" "${2:-}" <<'EOF'
import json, sys, base64
img = base64.b64encode(open("共通/見本の写真_盆栽.jpg", "rb").read()).decode()
d = {"question": sys.argv[1], "lang": "en", "teacher_id": "s1", "offer_id": "one_question", "images": [{"media_type": "image/jpeg", "data": img}]}
if sys.argv[2]: d["tree_id"] = sys.argv[2]
print(json.dumps(d))
EOF
}
field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }
wait_draft() {
  for _ in $(seq 1 60); do
    st=$(curl -s "$URL/api/consultations" | python3 -c "import json,sys; print([c for c in json.load(sys.stdin)['consultations'] if c['id']=='$1'][0]['ai_draft_status'])")
    [ "$st" != "making" ] && { echo "  答えの案: $st"; return; }
    sleep 5
  done
  echo "  答えの案: 時間切れ"
}

echo "1. 1回目の相談（新しい木）"
body "I wired this tree a few months ago. The wire near the top looks tight on the branches. When and how should I take it off?" > "$WORK/q1.json"
C1=$(curl -s -X POST "$URL/api/consultations" -H 'content-type: application/json' --data @"$WORK/q1.json")
ID1=$(echo "$C1" | field '["id"]'); TREE=$(echo "$C1" | field '["tree_id"]')
wait_draft "$ID1"

echo "2. 職人が答える（案を使った形）"
curl -s -X POST "$URL/api/consultations/$ID1/answer" -H 'content-type: application/json' \
  -d '{"voice":"上のほうの針金、もう食い込みかけているね。今のうちに外そう。ほどくと樹皮を傷めるから、針金切りで1巻きずつ切って外して。少しの跡なら、幹が太るうちに目立たなくなる。枝が戻るようなら、春にもう一度針金掛けをすればいい。","marks":[],"from_draft":true}' \
  | python3 -c "import json,sys; a=json.load(sys.stdin)['answer']; print('  案を使った:', a['from_draft'], '/ 見直し:', a['review'])"

echo "3. 2回目の相談（同じ木）"
body "I cut the wire off as you said. Now some branches are springing back up a little. Should I rewire them now, or wait?" "$TREE" > "$WORK/q2.json"
C2=$(curl -s -X POST "$URL/api/consultations" -H 'content-type: application/json' --data @"$WORK/q2.json")
echo "$C2" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  同じ木:', d['tree_id']=='$TREE', '/ 前の相談:', len(d['tree_history']), '件')"
ID2=$(echo "$C2" | field '["id"]')
wait_draft "$ID2"

echo "4. 2回目の答えの案"
curl -s "$URL/api/consultations" | python3 -c "import json,sys; c=[c for c in json.load(sys.stdin)['consultations'] if c['id']=='$ID2'][0]; print(json.dumps(c['ai_draft'], ensure_ascii=False, indent=1))"

if [ "${1:-}" = "撮る" ]; then
  python3 - "$WORK/撮った答え.json" <<'EOF'
import json, sys
rec = json.load(open(sys.argv[1]))
path = "見本の答え.json"
base = json.load(open(path))
for k in ("draftAnswer", "draftAnswerWithHistory"):
    if k in rec: base[k] = rec[k]; print("  見本に入れた:", k)
json.dump(base, open(path, "w"), ensure_ascii=False, indent=2)
EOF
fi
echo "サーバーの記録:"; tail -8 "$WORK/サーバー.log"
rm -rf "$WORK"
