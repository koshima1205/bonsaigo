#!/usr/bin/env python3
"""100人が使ったときの Claude API の料金の見積もり。
トークン数は、プロンプトの長さと出力の形からの見込み（思考の分を含む）。
キーを入れて動かすと、/api/kochira/meter に本当の値がたまるので、そちらで置き換える。"""
YEN = 150  # 1ドルの円（仮）
P = {"opus": (4, 20, 0.2), "sonnet": (2, 10, 0.2), "haiku": (0.1, 0.5, 0.01)}  # 入力・出力・キャッシュ読み（100万トークンあたりのドル）

def usd(model, inp, out, cached=0):
    i, o, r = P[model]
    return (inp * i + cached * r + out * o) / 1e6

# 相談1件（スマホ版の4段）。(モデル, 入力, 出力, キャッシュから読む分)
ALL_OPUS = [("opus", 1700, 900, 0), ("opus", 900, 1500, 0), ("opus", 1700, 500, 0), ("opus", 1900, 1500, 0)]
SAVING = [
    ("haiku", 300, 150, 0),     # 判定役：職人に回すものか
    ("sonnet", 1700, 900, 0),   # 写真と相談を、職人の言葉に
    ("sonnet", 900, 1500, 0),   # 園の記録から答えの案
    ("sonnet", 500, 500, 1200), # 声の直しを整える（用語集はキャッシュ）
    ("sonnet", 700, 1500, 1200),# 意味で訳す（用語集はキャッシュ）
    ("haiku", 600, 200, 0),     # 判定役：訳し戻しの意味が同じか
]
ESCALATE = 0.15  # Opus に上げ直す割合（見込み）
ESC_COST = usd("opus", 1900, 1500)

# AI 窓口の質問1件（用語集と記事 約5,000トークンを毎回読む）
HELP_OPUS = usd("opus", 5300, 400)
HELP_SAVING = usd("haiku", 300, 400, 5000)

# 答え1件から5つの言葉の記事とショート（急がないので Batch API で半額）
MEDIA_OPUS = usd("opus", 3000, 6000) + usd("opus", 2500, 1500)
MEDIA_SAVING = (usd("sonnet", 3000, 6000) + usd("sonnet", 2500, 1500)) * 0.5

c_opus = sum(usd(*x) for x in ALL_OPUS)
c_save = sum(usd(*x) for x in SAVING) + ESCALATE * ESC_COST

print(f"相談1件: 全部Opus {c_opus*YEN:.1f}円 / 工夫あり {c_save*YEN:.1f}円")
print(f"窓口の質問1件: 全部Opus {HELP_OPUS*YEN:.2f}円 / 工夫あり {HELP_SAVING*YEN:.2f}円")
print(f"記事＋ショート1本: 全部Opus {MEDIA_OPUS*YEN:.1f}円 / 工夫あり {MEDIA_SAVING*YEN:.1f}円")
print()
print("100人・1か月 | 相談 | 窓口の質問 | 記事 | 全部Opus | 工夫あり")
for name, per_user_consult, per_user_help, media_ratio in [("少なめ", 1, 3, 0.3), ("ふつう", 3, 10, 0.3), ("多め", 10, 30, 0.3)]:
    n_c, n_h = 100 * per_user_consult, 100 * per_user_help
    n_m = int(n_c * media_ratio)
    a = n_c * c_opus + n_h * HELP_OPUS + n_m * MEDIA_OPUS
    b = n_c * c_save * 0.9 + n_h * HELP_SAVING + n_m * MEDIA_SAVING  # 同じ相談の再利用で1割減と見込む
    print(f"{name} | {n_c}件 | {n_h}件 | {n_m}本 | {a*YEN:,.0f}円 | {b*YEN:,.0f}円（{(1-b/a)*100:.0f}%減）")
