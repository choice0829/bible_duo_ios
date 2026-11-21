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
    # ↓ 보드게임 카페(이름에 보드게임): 커피 카페 자료에서는 빠지고 boardgame.json 으로 간다
    row('홍대보드게임카페 놀자', '', '카페', S, '마포구', S + ' 마포구 서교동 1', '126.92', '37.555'),
    row('홍대보드게임카페 놀자', '', '카페', S, '마포구', S + ' 마포구 서교동 1', '126.92', '37.555'),   # 중복
    row('주사위 보드 게임방', '', '기타 오락장 운영업', S, '마포구', S + ' 마포구 서교동 2', '126.921', '37.556', mid='오락시설', big='관광/여가/오락', code='R10209'),
    row('Board Game Cafe Dice', '', '카페', S, '강남구', S + ' 강남구 역삼동 3', '127.03', '37.50'),
    row('레드버튼 홍대점', '', '기타 오락장 운영업', S, '마포구', S + ' 마포구 서교동 4', '126.922', '37.557', mid='오락시설', big='관광/여가/오락', code='R10209'),   # 이름에 '보드게임' 없음 → --bg-extra 로만
    row('스노보드카페 윈터', '', '카페', S, '강남구', S + ' 강남구 5', '127.04', '37.51'),   # '보드카페' 는 보드게임이 아니다 → 커피 카페(개인)로 남는다
    # ↓ 보드게임이 들어가도 가게가 아닌 것
    row('보드게임 마트', '', '완구/취미', S, '마포구', S + ' 마포구 6', '126.93', '37.56', mid='소매', big='소매', code='G47'),
    row('보드게임 학원', '', '기타 교습학원', S, '마포구', S + ' 마포구 7', '126.93', '37.57', mid='학원', big='학문/교육', code='P85'),
    row('보드게임 제작소', '', '카페', S, '마포구', S + ' 마포구 8', '126.93', '37.58'),
    row('좌표없는 보드게임카페', '', '카페', S, '마포구', S + ' 마포구 9', '', ''),
]
gg = [
    row('스타벅스 판교점', '', '카페', '경기도', '성남시', '경기도 성남시 1', '127.1', '37.39'),
    row('할리스 판교점', '', '카페', '경기도', '성남시', '경기도 성남시 2', '127.11', '37.39'),
    row('경기개인카페', '', '카페', '경기도', '성남시', '경기도 성남시 3', '127.12', '37.39'),
    row('투썸플레이스 부산점', '', '카페', '부산광역시', '해운대구', '부산광역시 해운대구 1', '129.16', '35.16'),
    row('수원 보드게임카페', '', '카페', '경기도', '수원시', '경기도 수원시 1', '127.03', '37.27'),
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
    # ----- 보드게임 카페 -----
    bg = json.load(open(os.path.join(W, 'boardgame.json'), encoding='utf-8'))
    bn = [x[0] for x in bg['r']]
    ok('보드게임: v1 · full=서울 · bb 4개 · 행은 [이름, 주소, 위도, 경도]', bg['v'] == 1 and bg['full'] == ['서울'] and len(bg['bb']) == 4 and all(len(x) == 4 for x in bg['r']), json.dumps(bg['bb']))
    ok('보드게임: 업종이 카페든 오락장이든, 한글·영문 이름이 모두 들어간다(3곳 + 중복 한 곳은 하나로)', sorted(bn) == sorted(['홍대보드게임카페 놀자', '주사위 보드 게임방', 'Board Game Cafe Dice']), bn)
    ok('보드게임: 소매·학원·이름이 제작소·좌표 없음·서울 밖(경기)은 들어가지 않는다', not any(k in bn for k in ['보드게임 마트', '보드게임 학원', '보드게임 제작소', '좌표없는 보드게임카페', '수원 보드게임카페']), bn)
    ok('보드게임: 이름에 보드게임이 없는 레드버튼은 기본으로는 빠진다', '레드버튼 홍대점' not in bn)
    ok('커피 카페 자료에서는 보드게임 카페가 빠지고, 스노보드카페는 개인 카페로 남는다', not any('보드게임' in k or 'Board Game' in k for k in by) and '스노보드카페 윈터' in by and by['스노보드카페 윈터'][0] == -1)
    ok('출력에 보드게임 카페 요약(구별·업종)과 뺀 업종이 나온다', '===== 보드게임 카페' in r.stdout and '마포구' in r.stdout and '기타 오락장 운영업' in r.stdout and ('소매' in r.stdout or '완구/취미' in r.stdout), '')
    ok('보드게임 확인용 csv 가 만들어진다(업종 열 포함)', open(os.path.join(W, 'boardgame-check.csv'), encoding='utf-8-sig').readline().startswith('매장명,주소') and '업종' in open(os.path.join(W, 'boardgame-check.csv'), encoding='utf-8-sig').readline())
    ok('출력에 "카페가 아니라서 뺀 업종"과 독서실/스터디 카페가 나온다', '카페가 아니라서 뺀 업종' in r.stdout and '독서실/스터디 카페' in r.stdout)
    ok('확인용 csv 가 만들어진다(구분 열 포함)', open(os.path.join(W, 'cafes-check.csv'), encoding='utf-8-sig').readline().startswith('구분,브랜드'))
    # 같은 폴더에서 다시 돌려도 cafes-check.csv 를 입력으로 읽지 않는다
    for f in os.listdir(W): os.replace(os.path.join(W, f), os.path.join(T, f))
    r2 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, T], cwd=W, capture_output=True, text=True, encoding='utf-8')
    o2 = json.load(open(os.path.join(W, 'cafes.json'), encoding='utf-8'))
    ok('결과 폴더의 cafes-check.csv 가 있어도 같은 결과가 나온다(입력에서 제외)', r2.returncode == 0 and len(o2['r']) == len(rows), len(o2['r']))
    bg2 = json.load(open(os.path.join(W, 'boardgame.json'), encoding='utf-8'))
    ok('boardgame-check.csv 도 입력에서 제외돼 보드게임 결과가 그대로다', len(bg2['r']) == len(bg['r']), len(bg2['r']))
    # --bg-extra 와 --bg-in all
    W2 = tempfile.mkdtemp()
    r4 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, T, '--bg-extra', '레드버튼', '--bg-in', 'all'], cwd=W2, capture_output=True, text=True, encoding='utf-8')
    bg3 = [x[0] for x in json.load(open(os.path.join(W2, 'boardgame.json'), encoding='utf-8'))['r']]
    ok('--bg-extra 로 레드버튼이 들어가고 --bg-in all 로 경기 보드게임 카페도 들어간다', r4.returncode == 0 and '레드버튼 홍대점' in bg3 and '수원 보드게임카페' in bg3, bg3)
    W3 = tempfile.mkdtemp()
    r5 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, T, '--bg-out', 'none'], cwd=W3, capture_output=True, text=True, encoding='utf-8')
    c5 = json.load(open(os.path.join(W3, 'cafes.json'), encoding='utf-8'))
    ok('--bg-out none 이면 boardgame.json 을 만들지 않고, 보드게임 이름의 카페는 커피 카페 자료에 그대로 남는다', r5.returncode == 0 and not os.path.exists(os.path.join(W3, 'boardgame.json')) and any('홍대보드게임카페' in x[1] for x in c5['r']))
    # 없는 파일 이름
    r3 = subprocess.run([sys.executable, '-B', '-I', SCRIPT, '받은파일.zip'], cwd=W, capture_output=True, text=True, encoding='utf-8')
    ok('없는 파일 이름을 쓰면 오류 대신 안내 문구가 나온다', r3.returncode != 0 and '찾을 수 없습니다' in r3.stderr and 'Traceback' not in r3.stderr, r3.stderr[:200])
print('FAILS %d' % fails if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
