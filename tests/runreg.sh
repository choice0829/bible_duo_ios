#!/bin/bash
# 전체 회귀 시험. 한 번에 하나씩 차례로 돌립니다(동시에 돌리면 서로 방해하므로 pkill로 정리).
# 사용: cd tests && npm install && bash runreg.sh   (결과: reg.log)  / 하나만: node map1.mjs 펼침
# rot4(기기 168가지 조합)는 오래 걸려(약 5~8분) 목록에서 빼 두었습니다: timeout 900 node rot4.mjs
cd "$(dirname "$0")"
mkdir -p desk
: > reg.log
echo "=== filter-cafes-test (PC용 스크립트)" >> reg.log
python3 -B filter-cafes-test.py >> reg.log 2>&1
echo "--- exit $?" >> reg.log
for t in map1 map2 map4 map5 map6 map7 map8 map9 map10 flip1 pc1 pc2 pc3 pc4 pc5 kb1 native1 native2 native3 native5 native6 hd1 desk2 desk5 desk8 desk9 rot9 std3; do
  echo "=== $t" >> reg.log
  timeout 300 node $t.mjs >> reg.log 2>&1
  echo "--- exit $?" >> reg.log
  pkill -f 'node .*mjs' 2>/dev/null
done
echo "=== DONE" >> reg.log
grep -E '^=== |^--- exit|FAIL|ALL PASS|FAILS' reg.log | tr '\n' ' ' | sed 's/=== /\n=== /g'
echo
