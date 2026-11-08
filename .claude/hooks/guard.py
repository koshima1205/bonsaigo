#!/usr/bin/env python3
"""見張り役：鍵を読ませない・公開とプッシュは人に確かめる。"""
import json, re, sys

d = json.load(sys.stdin)
tool, inp = d.get("tool_name", ""), d.get("tool_input", {}) or {}
# 見るのはファイルの場所とコマンドだけ（文書の中で鍵の話をするのは止めない）
text = " ".join(str(inp.get(k, "")) for k in ("file_path", "command"))

def out(decision, reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decision, "permissionDecisionReason": reason}}, ensure_ascii=False))
    sys.exit(0)

# 鍵のファイルは読まない・書かない
if re.search(r"\.dev\.vars(?!\.example)|\.secrets/|fal_key", text):
    out("deny", "鍵のファイルには触れません。鍵は人が入れます。")

if tool == "Bash":
    cmd = inp.get("command", "")
    if re.search(r"\bwrangler\s+(deploy|secret\s+put)\b", cmd):
        out("ask", "公開・鍵の登録です。人の確認がいります。")
    if re.search(r"\bgit\s+push\b", cmd):
        out("ask", "GitHub への送信です。人の確認がいります。")
    if re.search(r"\brm\s+-[a-z]*r", cmd):
        out("ask", "まとめて消す操作です。消すものを見せてから。")
sys.exit(0)
