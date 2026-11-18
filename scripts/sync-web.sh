#!/usr/bin/env bash
# 웹앱 폴더(bible-pwa)의 내용을 앱에 넣을 www/ 로 복사한다.
# 사용: scripts/sync-web.sh /경로/bible-pwa
set -euo pipefail
SRC="${1:?웹앱 폴더 경로를 적어 주세요}"
cd "$(dirname "$0")/.."
rm -rf www && mkdir www
cp -R "$SRC"/. www/
rm -f www/README.md
echo "www/ 갱신 완료: $(grep -o "APP_VER = '[^']*'" www/app.js)"
