"""歩ける庭（public/niwa/）を、スマホで遊ぶ非公開ページ（claude.ai の Artifact）用に写す。

使い方: python scripts/niwa_artifact.py <出力フォルダ>
- index.html から doctype・html・head・body・meta・icon を外す（公開のときに骨組みが付くため）
- キャラの GLB は文字（base64）にして chara/<id>.glb.txt に置く（Artifact は .glb を置けない）
- /niwa/ 以外の場所で開くと、niwa.js は .glb.txt を読み、カードのボタンは本番の Engawa を別タブで開く
- 掲示板と市は見本（samples.js）だけを見せ、書きこみは本番の Engawa へ案内する
出力フォルダの中身は作り直す（前の写しは消える）。出力フォルダは public/ の外の、空のフォルダか前に写したフォルダ（目印 .niwa-artifact がある）にすること。
"""
import base64
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'public', 'niwa')
APP = 'https://engawa.igdeploy.workers.dev/'
MARK = '.niwa-artifact'


def main(out: str) -> None:
    out = os.path.abspath(out)
    if os.path.commonpath([out, os.path.abspath(os.path.join(HERE, '..', 'public'))]) == os.path.abspath(os.path.join(HERE, '..', 'public')):
        sys.exit('出力フォルダは public/ の外にしてください')
    # 前の写しは中身だけ作り直す（フォルダそのものは残す＝ほかの道具が開いていても止まらない）。
    # 消してよいのは、この道具が作った写し（目印のファイルがある）か、空のフォルダだけ。指定ミスで別のフォルダを消さないため
    os.makedirs(out, exist_ok=True)
    names = os.listdir(out)
    if names and MARK not in names:
        sys.exit(f'止めました: {out} には、この道具が作った写しの目印（{MARK}）がありません。空のフォルダか、前に写したフォルダを指定してください。')
    for f in names:
        p = os.path.join(out, f)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    with open(os.path.join(out, MARK), 'w', encoding='utf-8') as w:
        print('scripts/niwa_artifact.py が作った写し。中身は作り直すたびに消える。', file=w)
    os.makedirs(os.path.join(out, 'chara'))
    for f in ['niwa.js', 'world.js', 'tex.js', 'bonsai.js', 'sheet.js', 'samples.js']:
        shutil.copy(os.path.join(SRC, f), out)
    shutil.copytree(os.path.join(SRC, 'img'), os.path.join(out, 'img'))
    for f in os.listdir(os.path.join(SRC, 'chara')):
        if f.endswith('.glb'):
            with open(os.path.join(SRC, 'chara', f), 'rb') as r, open(os.path.join(out, 'chara', f + '.txt'), 'w') as w:
                w.write(base64.b64encode(r.read()).decode())
    s = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
    for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</?head>\s*', r'<body>\s*', r'</body>\s*', r'</html>\s*',
                r'<meta charset[^>]*>\s*', r'<meta name="viewport"[^>]*>\s*', r'<link rel="icon"[^>]*>\s*', r'<meta name="theme-color"[^>]*>\s*']:
        s = re.sub(pat, '', s, flags=re.I)
    m = re.search(r'<title>.*?</title>\s*', s)
    s = m.group(0) + s.replace(m.group(0), '', 1)
    s = s.replace('<a class="brand" href="/">', f'<a class="brand" href="{APP}" target="_blank" rel="noopener">')
    s = s.replace('--sans:"Noto Sans JP",system-ui,sans-serif;', '--sans:"Noto Sans JP",system-ui,sans-serif;\n  color-scheme: dark;', 1)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(s)
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
    print(f'写しました: {out}（{total // 1024} KB）')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
