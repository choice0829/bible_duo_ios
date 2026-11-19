#!/usr/bin/env bash
# 웹앱 폴더(bible-pwa)의 내용을 앱에 넣을 www/ 로 복사한다.
# 사용: scripts/sync-web.sh /경로/bible-pwa
set -euo pipefail
SRC="${1:?웹앱 폴더 경로를 적어 주세요}"
cd "$(dirname "$0")/.."
# 원본이 없거나 올바른 폴더가 아니면 www/를 지우기 전에 멈춘다 (v49부터는 저장소의 www/가 원본이라 보통 이 스크립트는 쓰지 않는다)
[ -f "$SRC/index.html" ] || { echo "오류: $SRC 에 index.html이 없습니다. www/를 건드리지 않고 멈춥니다." >&2; exit 1; }
rm -rf www && mkdir www
cp -R "$SRC"/. www/
rm -f www/README.md
echo "www/ 갱신 완료: $(grep -o "APP_VER = '[^']*'" www/app.js)"
