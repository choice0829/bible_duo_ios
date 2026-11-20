#!/usr/bin/env python3
# scripts/filter-cafes.py 시험: 가짜 상가정보(CSV·CP949 ZIP)를 만들어 돌려 결과를 확인한다. 사용: python3 tests/filter-cafes-test.py
import csv, io, json, os, subprocess, sys, tempfile, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, '..', 'scripts', 'filter-cafes.py')
hdr = ['상호명', '지점명', '상권업종대분류명', '상권업종중분류명', '상권업종소분류코드', '상권업종소분류명', '시도명', '시군구명', '지번주소', '도로명주소', '경도', '위도']
def row(nm, br, sub, sido, gu, addr, lon, lat, mid='커피점/카페', big='음식', code='I21201'):
    return [nm, br, big, mid, code, sub, sido, gu, addr, addr, lon, lat]
S = '서울특별시'
seoul = [
    row('스타벅스', '강동구청점', '카페', S, '강동구', S + ' 강동구 성내동 1', '127.12', '37.53'),
    row('스타벅스', '강동구청점', '카페', S, '강동구', S + ' 강동구 성내동 1', '127.12', '37.53'),   # 중복
    row('투썸플레이스 천호역점', '', '카페', S, '강동구', S + ' 강동구 천호동 2', '127.123', '37.538'),
    row('A TWOSOME PLACE', '명일점', '카페', S, '강동구', S + ' 강동구 명일동 3', '127.14', '37.55'),
    row('카페드롭탑', '길동점', '카페', S, '강동구', S + ' 강동구 길동 4', '127.14', '37.54'),
    row('할리스 강동점', '', '카페', S, '강동구', S + ' 강동구 5', '127.13', '37.54'),
    row('메가MGC커피', '천호점', '카페', S, '강동구', S + ' 강동구 6', '127.12', '37.54'),
    row('이디야커피 둔촌점', '', '카페', S, '강동구', S + ' 강동구 7', '127.13', '37.52'),
    row('바나프레소', '강동점', '카페', S, '강동구', S + ' 강동구 7-1', '127.13', '37.521'),
    row('메머드커피', '', '카페', S, '강동구', S + ' 강동구 7-2', '127.13', '37.522'),
    row('동네사랑방카페', '', '카페', S, '강동구', S + ' 강동구 8', '127.11', '37.52'),
    row('Cafe Olive', '', '카페', S, '강동구', S + ' 강동구 9', '127.10', '37.51'),
    row('커피한잔의여유', '', '카페', S, '강동구', S + ' 강동구 10', '127.10', '37.50'),
    row('업소명없음', '', '카페', S, '강동구', S + ' 강동구 10-1', '127.10', '37.505'),
    # ↓ 들어가면 안 되는 것
    row('조용한공간', '', '독서실/스터디 카페', S, '강동구', S + ' 강동구 20', '127.10', '37.51', code='R10202'),   # 소분류가 스터디카페
    row('OO스터디카페', '', '카페', S, '강동구', S + ' 강동구 21', '127.10', '37.52'),                        # 소분류는 카페지만 이름이 스터디카페
    row('눈꽃빙수', '', '아이스크림/빙수', S, '강동구', S + ' 강동구 22', '127.10', '37.53', code='I21008'),
    row('카페베네빌딩 관리사무소', '', '부동산관리', S, '강동구', S + ' 강동구 11', '127.1', '37.5', mid='부동산', big='부동산', code='L68'),
    row('스타벅스 본사', '', '사무실', S, '강남구', S + ' 강남구 12', '127.0', '37.5', mid='기타', big='서비스', code='M70'),
    row('좌표없는카페', '', '카페', S, '강동구', S + ' 강동구 13', '', ''),
    row('영점카페', '', '카페', S, '강동구', S + ' 강동구 14', '0', '0'),
]
gg = [
    row('스타벅스 판교점', '', '카페', '경기도', '성남시', '경기도 성남시 1', '127.1', '37.39'),
    row('할리스 판교점', '', '카페', '경기도', '성남시', '경기도 성남시 2', '127.11', '37.39'),
    row('경기개인카페', '', '카페', '경기도', '성남시', '경기도 성남시 3', '127.12', '37.39'),
    row('투썸플레이스 부산점', '', '카페', '부산광역시', '해운대구', '부산광역시 해운대구 1', '129.16', '35.16'),
]
fails = 0
def ok(n, c, x=''):
    global fails
    print(('ok  ' if c else 'FAIL') + ' ' + n + ' ' + str(x))
    if not c: fails += 1
with tempfile.TemporaryDirectory() as T, tempfile.TemporaryDirectory() as W:
    with open(os.path.join(T, '서울_202609.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(hdr); w.writerows(seoul)
    buf = io.StringIO(); w = csv.writer(buf); w.writerow(hdr); w.writerows(gg)
    with zipfile.ZipFile(os.path.join(T, '전국.zip'), 'w') as z:
        z.writestr('sg_202609.csv', buf.getvalue().encode('cp949'))
    r = subprocess.run([sys.executable, '-B', '-I', SCRIPT, T], cwd=W, capture_output=True, text=True, encoding='utf-8')
    print(r.stdout[-1800:])
    ok('스크립트가 오류 없이 끝난다', r.returncode == 0, r.stderr[:300])
    o = json.load(open(os.path.join(W, 'cafes.json'), encoding='utf-8'))
    names = o['b']; rows = o['r']
    by = {x[1]: x for x in rows}
    ok('형식: v2 · full=서울 · bb 가 서울 카페들의 범위', o['v'] == 2 and o['full'] == ['서울'] and len(o['bb']) == 4 and o['bb'][0] <= 37.50 and o['bb'][2] >= 37.55, o['bb'])
    ok('중복 한 곳은 하나로 합쳐진다', sum(1 for x in rows if x[1].startswith('스타벅스 강동구청점')) == 1)
    ok('스타벅스·투썸·할리스·이디야·메가·드롭탑·바나프레소·메머드는 프랜차이즈(번호 0 이상, 이름 맞음)',
       all(by[k][0] >= 0 for k in ['스타벅스 강동구청점', '투썸플레이스 천호역점', 'A TWOSOME PLACE 명일점', '카페드롭탑 길동점', '할리스 강동점', 'MEGA'.replace('MEGA', '메가MGC커피 천호점'), '이디야커피 둔촌점', '바나프레소 강동점', '메머드커피'])
       and names[by['메머드커피'][0]] == '매머드커피' and names[by['카페드롭탑 길동점'][0]] == '드롭탑' and names[by['바나프레소 강동점'][0]] == '바나프레소')
    ok('목록에 없는 서울 카페는 개인(-1)이다', all(by[k][0] == -1 for k in ['동네사랑방카페', 'Cafe Olive', '커피한잔의여유']))
    ok('"업소명없음"은 "이름 없는 카페"로 바뀌어 개인으로 들어간다', '이름 없는 카페' in by and by['이름 없는 카페'][0] == -1 and '업소명없음' not in by)
    ok('소분류가 독서실/스터디 카페 · 이름이 스터디카페 · 빙수 · 부동산 · 본사 · 좌표 없음/0,0 은 들어가지 않는다', not any(k in by for k in ['조용한공간', 'OO스터디카페', '눈꽃빙수', '카페베네빌딩 관리사무소', '스타벅스 본사', '좌표없는카페', '영점카페']))
    ok('서울 밖은 스타벅스·투썸만 들어간다(할리스·개인 제외)', '스타벅스 판교점' in by and '투썸플레이스 부산점' in by and '할리스 판교점' not in by and '경기개인카페' not in by)
    ok('출력에 "카페가 아니라서 뺀 업종"과 독서실/스터디 카페가 나온다', '카페가 아니라서 뺀 업종' in r.stdout and '독서실/스터디 카페' in r.stdout)
    ok('확인용 csv 가 만들어진다(구분 열 포함)', open(os.path.join(W, 'cafes-check.csv'), encoding='utf-8-sig').readline().startswith('구분,브랜드'))
    # 같은 폴더에서 다시 돌려도 cafes-check.csv 를 입력으로 읽지 않는다
    for f in os.listdir(W): os.replace(os.path.join(W, f), os.path.join(T, f))
    r2 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, T], cwd=W, capture_output=True, text=True, encoding='utf-8')
    o2 = json.load(open(os.path.join(W, 'cafes.json'), encoding='utf-8'))
    ok('결과 폴더의 cafes-check.csv 가 있어도 같은 결과가 나온다(입력에서 제외)', r2.returncode == 0 and len(o2['r']) == len(rows), len(o2['r']))
    # 없는 파일 이름
    r3 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, '받은파일.zip'], cwd=W, capture_output=True, text=True, encoding='utf-8')
    ok('없는 파일 이름을 쓰면 오류 대신 안내 문구가 나온다', r3.returncode != 0 and '찾을 수 없습니다' in r3.stderr and 'Traceback' not in r3.stderr, r3.stderr[:200])
print('FAILS %d' % fails if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
