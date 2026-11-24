#!/bin/bash
# 전체 회귀 시험. 한 번에 하나씩 차례로 돌립니다(동시에 돌리면 서로 방해하므로 pkill로 정리).
# 사용: cd tests && npm install && bash runreg.sh   (결과: reg.log)  / 하나만: node map1.mjs 펼침
# (v75) church1 = 교회 계정 화면(로그인·가입·초대코드·관리자 영상 입력, 가짜 서버). (v74) yt1 = 설교 영상 탭(교회 계정 1단계) 시험. 서버 표·접근 규칙은 supabase-schema-test.sh(임시 Postgres).
# (v72·v73) card1 = 지도 장소 카드(정보 보기→지도 앱 연결·길찾기·나만의 리뷰·내 장소로 추가 균일 배치) 6개 기기 시험.
# (v71) hl1 = 하이라이트 도구 상자 터치 시험. (v70) ask1 = 문의하기(머리줄 아이콘) 시험.
# (v68) map4(래스터·CARTO 열쇠 시험)는 docs/emergency-raster/ 로 옮겼다. adv1 = 설정·고급설정 화면 시험.
# rot4(기기 168가지 조합)는 오래 걸려(약 5~8분) 목록에서 빼 두었습니다: timeout 900 node rot4.mjs
cd "$(dirname "$0")"
mkdir -p desk
: > reg.log
echo "=== filter-cafes-test (PC용 스크립트)" >> reg.log
python3 -B filter-cafes-test.py >> reg.log 2>&1
echo "--- exit $?" >> reg.log
echo "=== supabase-schema-test (서버 표·접근 규칙)" >> reg.log
bash supabase-schema-test.sh >> reg.log 2>&1
echo "--- exit $?" >> reg.log
for t in adv1 ask1 yt1 church1 hl1 card1 map1 map2 map5 map6 map7 map8 map9 map10 flip1 pc1 pc2 pc3 pc4 pc5 kb1 native1 native2 native3 native5 native6 hd1 desk2 desk5 desk8 desk9 rot9 std3 credit1 rev1; do
  echo "=== $t" >> reg.log
  timeout 600 node $t.mjs >> reg.log 2>&1
  echo "--- exit $?" >> reg.log
  pkill -f 'node .*mjs' 2>/dev/null
done
echo "=== DONE" >> reg.log
grep -E '^=== |^--- exit|FAIL|ALL PASS|FAILS' reg.log | tr '\n' ' ' | sed 's/=== /\n=== /g'
echo
