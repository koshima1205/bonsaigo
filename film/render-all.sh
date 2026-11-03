#!/bin/zsh
# 3本の素材を順に描く（途中で止まっても、描き終えたショットは飛ばして続きから）
cd "$(dirname "$0")/.."
for f in a-pine b-maple c-eight; do
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/film.py -- film/$f.json 2>&1 | grep -E "^shot|^skip|Error|Traceback"
done
echo ALL DONE
