#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카페 자료 만들기 (책장성경 앱 '모임 장소' 지도용)

공공데이터포털의 「소상공인시장진흥공단_상가(상권)정보」 CSV(전국 또는 시·도별 파일, ZIP 그대로도 가능)에서
  · 서울의 카페를 전부(프랜차이즈 + 개인 카페),
  · 서울 밖에서는 스타벅스·투썸플레이스만
골라 작은 파일(cafes.json)로 만듭니다. 각 카페에는 '프랜차이즈(브랜드 이름)' 또는 '개인' 표시가 붙습니다.
같은 실행에서 이름에 '보드게임'이 들어간 가게(업종이 카페든 오락장이든)와, 이름에 '보드게임'은 없지만 널리 알려진 보드게임 카페 브랜드
(레드버튼·홈즈앤루팡·더홀릭·히어로) 또는 '○○보드카페'인 가게를 서울에서 따로 모아 boardgame.json 도 만듭니다.
(보드게임 카페는 커피 카페 자료(cafes.json)에서는 빠집니다 — 앱에서 별도 층·별도 단추로 보이기 때문입니다.)
파이썬 3.8 이상이면 되고, 따로 설치할 것은 없습니다(표준 라이브러리만 사용).

사용법 (명령 프롬프트 또는 PowerShell):
    python filter-cafes.py .                          (받은 CSV/ZIP 이 든 폴더에서 — 점 하나는 '현재 폴더')
    python filter-cafes.py 받은파일.zip
    python filter-cafes.py 서울.csv 경기.csv ...       (여러 개를 한꺼번에)
  선택 사항:
    --all-in 서울,경기          카페를 전부 담을 지역(기본: 서울). 쉼표로 여러 곳
    --everywhere 스타벅스,투썸플레이스   그 밖의 지역에서도 담을 브랜드(기본: 스타벅스,투썸플레이스. all 이면 목록의 모든 브랜드, none 이면 없음)
    --extra 우지커피            프랜차이즈 목록에 브랜드 이름 추가(여러 번 쓸 수 있음). 아래 FRANCHISES 목록을 직접 고쳐도 됩니다
    --asof 2026-10              자료 기준 연월을 직접 지정
    --bg-in 서울                보드게임 카페를 담을 지역(기본: 서울. 쉼표로 여러 곳, all 이면 전국)
    --bg-extra 우리동네놀이터   위 브랜드 말고 더할 보드게임 카페 이름(여러 번 쓸 수 있음)
    --no-bg-brand               브랜드·'보드카페' 이름 인식을 끔(이름에 '보드게임'이 든 곳만 모음)
    --bg-out boardgame.json     보드게임 파일 이름(none 이면 만들지 않음)

만들어지는 파일 (실행한 폴더에):
    cafes.json        앱에 넣을 파일 (이 파일을 채팅에 올려 주세요)
    cafes-check.csv   엑셀로 열어 눈으로 확인하는 파일(한글 깨짐 없음)
    boardgame.json        보드게임 카페 파일 (이 파일도 채팅에 올려 주세요)
    boardgame-check.csv   엑셀로 열어 눈으로 확인하는 파일(업종 열 포함)
"""
import argparse, csv, io, json, os, re, sys, zipfile
from collections import Counter
from datetime import date

try:
    sys.stdout.reconfigure(errors='replace')
    sys.stderr.reconfigure(errors='replace')
except Exception:
    pass
csv.field_size_limit(10 ** 7)

# ── 프랜차이즈(체인) 브랜드 목록 ─────────────────────────────────────────────
# (앱에 표시되는 이름, [상호명이 이 말로 시작하면 그 브랜드로 본다]) — 상호명은 공백·특수문자를 없애고 대문자로 바꾼 뒤 비교합니다.
# 목록에 없는 체인은 '개인'으로 분류됩니다. 브랜드를 더하려면 한 줄을 추가하거나 --extra 를 쓰세요.
# 앞쪽 번호가 앱에서 쓰는 브랜드 번호(0부터)이므로, 이미 만든 파일과 섞어 쓰지 않는다면 순서는 바꿔도 됩니다.
FRANCHISES = [
    ('스타벅스', ['STARBUCKS', '스타벅스']),
    ('투썸플레이스', ['ATWOSOMEPLACE', 'TWOSOMEPLACE', '투썸플레이스', '투썸']),
    ('할리스', ['HOLLYS', '할리스']),
    ('이디야커피', ['EDIYA', '이디야']),
    ('메가MGC커피', ['메가MGC', '메가커피', '메가엠지씨', 'MEGACOFFEE', 'MEGAMGC']),
    ('컴포즈커피', ['컴포즈', 'COMPOSE']),
    ('빽다방', ['빽다방', "PAIK'S", 'PAIKS']),
    ('매머드커피', ['매머드커피', '매머드익스프레스', '메머드', 'MAMMOTH']),
    ('더벤티', ['더벤티', 'THEVENTI']),
    ('커피빈', ['커피빈', 'COFFEEBEAN']),
    ('폴바셋', ['폴바셋', 'PAULBASSETT']),
    ('파스쿠찌', ['파스쿠찌', 'PASCUCCI']),
    ('엔제리너스', ['엔제리너스', '엔젤리너스', 'ANGELINUS']),
    ('탐앤탐스', ['탐앤탐스', 'TOMNTOMS']),
    ('카페베네', ['카페베네', 'CAFFEBENE', 'CAFEBENE']),
    ('드롭탑', ['드롭탑', 'DROPTOP']),
    ('블루보틀', ['블루보틀', 'BLUEBOTTLE']),
    ('공차', ['공차', 'GONGCHA']),
    ('요거프레소', ['요거프레소', 'YOGERPRESSO']),
    ('달콤커피', ['달콤커피', 'DALKOMM']),
    ('커피에반하다', ['커피에반하다']),
    ('토프레소', ['토프레소', 'TOPRESSO']),
    ('만랩커피', ['만랩커피']),
    ('텐퍼센트커피', ['텐퍼센트', '10PERCENT']),
    ('하삼동커피', ['하삼동']),
    ('감성커피', ['감성커피']),
    ('아마스빈', ['아마스빈']),
    ('우지커피', ['우지커피']),
    ('쥬씨', ['쥬씨']),
    ('설빙', ['설빙', 'SULBING']),
    ('스무디킹', ['스무디킹', 'SMOOTHIEKING']),
    ('빌리엔젤', ['빌리엔젤']),
    ('바나프레소', ['바나프레소', 'BANAPRESSO']),
    ('디저트39', ['디저트39']),
    ('백억커피', ['백억커피']),
    ('과일에반하다', ['과일에반하다']),
    ('커스텀커피', ['커스텀커피']),
    ('포트캔커피', ['포트캔']),
    ('달리는커피', ['달리는커피']),
    ('벤티프레소', ['벤티프레소']),
    ('카페게이트', ['카페게이트']),
    ('에슬로우', ['에슬로우']),
    ('요거트월드', ['요거트월드']),
    ('더리터', ['더리터']),
    ('하이오커피', ['하이오커피', 'HIOCOFFEE']),
    ('브루다커피', ['브루다']),
    ('블루포트커피', ['블루포트']),
    ('커피나인', ['커피나인']),
    ('플러스82', ['플러스82']),
    ('해머스미스', ['해머스미스']),
    ('데이롱카페', ['데이롱']),
    ('와플대학', ['와플대학']),
    ('테라로사', ['테라로사', 'TERAROSA']),
    ('앤트러사이트', ['앤트러사이트', 'ANTHRACITE']),
    ('프릳츠', ['프릳츠', 'FRITZ']),
    ('빈브라더스', ['빈브라더스', 'BEANBROTHERS']),
]
# 업종이 '카페'(상권업종 소분류)여야 담는다. 독서실/스터디 카페·빙수·빵집 등은 뺀다. 소분류 열이 없는 파일이면 '카페·커피' 글자가 든 줄만 보되, 아래 이름은 뺀다.
CAFE_KINDS = {'카페', '커피전문점', 'I21201'}
NOT_CAFE_NAME = ('스터디카페', '스터디 카페', '독서실', '스터디룸', '워크앤스터디')
UNNAMED = ('업소명없음', '상호없음', '이름없음')
# 보드게임 카페: 이름에 아래 말이 들어 있으면 보드게임 카페 후보로 본다(업종은 카페·오락장 등 무엇이든). 단, 업종이 소매·학원 같은 곳과 이름이 학원·제작인 곳은 뺀다.
BG_NAME_RE = re.compile(r'보드\s*게임|BOARD\s*-?\s*GAME', re.I)   # '보드카페'는 스노보드·스케이트보드 카페와 헷갈려 일부러 뺐다(필요하면 --bg-extra 로 이름을 더한다)
BG_NOT_NAME = ('학원', '교습', '제작', '공방', '도매')
# 이름에 '보드게임'은 없어도 보드게임 카페인 곳: ① 보드게임 카페 브랜드(레드버튼·홈즈앤루팡·더홀릭·히어로) ② '○○보드카페'(스노보드·스케이트보드 가게는 제외)
BG_BRAND_RE = re.compile(r'레드\s*버튼|red\s*button|홈즈\s*(?:앤|&|and)?\s*루팡|더\s*홀릭\s*보드|히어로\s*보드', re.I)
BG_BOARDCAFE_RE = re.compile(r'보드\s*(?:카페|까페)', re.I)
BG_NOT_BOARDCAFE = ('스노', '스케이트', '서프', '서핑', '웨이크', '롱보드', '패들', '윈드', '스키', 'SNOW', 'SKATE', 'SURF')
BG_VIA = []   # 이름에 '보드게임'은 없지만 브랜드·보드카페 이름이라 담은 곳(요약에 보여 주려고 모은다)


def bg_name_hit(nm, brand_on=True):
    """이름만 보고 보드게임 카페 후보인지 가린다. 돌려주는 값: 'name'(이름에 보드게임) / 'brand'(브랜드) / 'boardcafe'(○○보드카페) / ''(아님)"""
    if BG_NAME_RE.search(nm):
        return 'name'
    if brand_on:
        if BG_BRAND_RE.search(nm):
            return 'brand'
        if BG_BOARDCAFE_RE.search(nm) and not any(x in nm.upper() for x in BG_NOT_BOARDCAFE):
            return 'boardcafe'
    return ''
BG_NOT_KIND = re.compile(r'소매|도매|학원|교육|제조|임대|수리|부동산|의료|병원|의원|출판|인쇄|광고|중개')
GENERIC_LEAD = ('카페', '까페', '커피', 'CAFE', 'COFFEE')   # '카페드롭탑' 처럼 맨 앞에 붙는 말을 떼고도 한 번 더 비교

NAME_COLS = ['상호명', '상호', '업소명', '사업장명']
BRANCH_COLS = ['지점명']
ROAD_COLS = ['도로명주소']
JIBUN_COLS = ['지번주소', '주소', '소재지']
LON_COLS = ['경도', 'lon', 'lng', 'x']
LAT_COLS = ['위도', 'lat', 'y']
SIDO_COLS = ['시도명']
LAT_RANGE, LON_RANGE = (32.5, 39.0), (124.0, 132.5)   # 우리나라 범위 밖 좌표(0,0 등)는 오류로 보고 뺀다


def norm_key(s):
    return re.sub(r'[\s\-_.()·]', '', (s or '')).upper()


def build_matcher(brands):
    """brands: [(표시 이름, [접두어…])] → 상호명 → 브랜드 번호(없으면 -1)"""
    pats = []
    for i, (_, ps) in enumerate(brands):
        for p in ps:
            pats.append((norm_key(p), i))
    pats.sort(key=lambda t: -len(t[0]))   # 긴 것부터(투썸플레이스 가 투썸 보다 먼저)

    def brand_of(name):
        k = norm_key(name)
        cands = [k] + [k[len(g):] for g in GENERIC_LEAD if k.startswith(g) and len(k) > len(g)]
        for c in cands:
            for p, i in pats:
                if c.startswith(p):
                    return i
        return -1
    return brand_of


def pick(header, cands):
    low = {h.strip().lower(): i for i, h in enumerate(header)}
    for c in cands:
        if c.lower() in low:
            return low[c.lower()]
    return -1


def open_text(raw):
    """바이트 스트림을 UTF-8(BOM 포함) 또는 CP949로 읽는다. 첫 줄(머리줄)로 인코딩을 정한다."""
    head = raw.readline()
    enc = 'utf-8-sig'
    try:
        head.decode('utf-8-sig')
    except UnicodeDecodeError:
        enc = 'cp949'
    return io.TextIOWrapper(io.BufferedReader(_Chain(head, raw)), encoding=enc, errors='replace', newline=''), enc


class _Chain(io.RawIOBase):
    """이미 읽은 첫 줄을 되돌려 놓고 이어서 읽는 얇은 래퍼."""
    def __init__(self, head, raw):
        self.head, self.raw, self.pos = head, raw, 0
    def readable(self):
        return True
    def readinto(self, b):
        if self.pos < len(self.head):
            n = min(len(b), len(self.head) - self.pos)
            b[:n] = self.head[self.pos:self.pos + n]
            self.pos += n
            return n
        data = self.raw.read(len(b))
        n = len(data)
        b[:n] = data
        return n


SKIP_FILES = ('cafes-check.csv', 'brandcafes-check.csv', 'boardgame-check.csv')   # 이 스크립트(와 옛 스크립트)가 만든 확인용 파일은 입력에서 제외


def iter_sources(paths):
    """(표시 이름, 열기 함수) 목록. 폴더 → 안의 csv·zip 전부, zip → 안의 csv 전부."""
    out = []
    def add_zip(zp, label):
        with zipfile.ZipFile(zp) as z:
            for info in z.infolist():
                if info.filename.lower().endswith('.csv'):
                    # 한글 파일 이름이 깨진 zip 도 있으므로 이름은 참고용으로만 쓴다
                    out.append((label + ' ▸ ' + info.filename, (lambda zp=zp, fn=info.filename: zipfile.ZipFile(zp).open(fn))))
    for p in paths:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for f in sorted(files):
                    fp = os.path.join(root, f)
                    if f.lower() in SKIP_FILES:
                        continue
                    if f.lower().endswith('.csv'):
                        out.append((fp, (lambda fp=fp: open(fp, 'rb'))))
                    elif f.lower().endswith('.zip'):
                        add_zip(fp, fp)
        elif p.lower().endswith('.zip') and os.path.isfile(p):
            add_zip(p, p)
        elif os.path.isfile(p):
            out.append((p, (lambda p=p: open(p, 'rb'))))
        else:
            print('! 찾을 수 없습니다:', p, file=sys.stderr)
            print('  → 파일 이름을 실제 이름으로 바꿔 쓰거나, 받은 파일이 든 폴더 이름(현재 폴더는 점 하나 .)을 쓰세요.', file=sys.stderr)
    return out


def sido_key(s):
    """'서울특별시' → '서울', '경기도' → '경기' 처럼 앞 두 글자로 비교한다(전북특별자치도 → 전북 등)."""
    s = (s or '').strip()
    return s[:2]


def take_boardgame(r, nm, ci, ind, sub, bg_all, bg_regions, seen, out, kinds, excl, st, via=''):
    """이름에 보드게임이 든 한 줄을 보드게임 카페로 담을지 정한다(업종·지역·좌표·중복 확인)."""
    kind = ' / '.join(r[i].strip() for i in ind if i < len(r))
    sub_txt = ' / '.join(r[i].strip() for i in sub if i < len(r))
    if BG_NOT_KIND.search(kind) or any(x in nm for x in BG_NOT_NAME):
        excl[sub_txt or kind or '(업종 열 없음)'] += 1
        st['보드게임: 업종·이름이 가게(소매·학원 등)라서 뺌'] += 1
        return
    addr = ''
    if 0 <= ci['road'] < len(r):
        addr = r[ci['road']].strip()
    if not addr and 0 <= ci['jibun'] < len(r):
        addr = r[ci['jibun']].strip()
    sido = r[ci['sido']].strip() if 0 <= ci['sido'] < len(r) else (addr.split(' ')[0] if addr else '')
    if not bg_all and sido_key(sido) not in bg_regions:
        st['보드게임: 담는 지역 밖이라 뺌'] += 1
        return
    try:
        lat, lon = float(r[ci['lat']]), float(r[ci['lon']])
    except ValueError:
        st['보드게임: 좌표 없음'] += 1
        return
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
        st['보드게임: 좌표가 우리나라 밖'] += 1
        return
    br = r[ci['branch']].strip() if 0 <= ci['branch'] < len(r) else ''
    full = re.sub(r'\s+', ' ', nm)
    if br and norm_key(br) not in norm_key(full):
        full += ' ' + br
    key = (norm_key(full), round(lat, 4), round(lon, 4))
    if key in seen:
        st['보드게임: 같은 가게가 두 번 들어 있음'] += 1
        return
    seen.add(key)
    out.append((full, addr, round(lat, 5), round(lon, 5), sido, sub_txt or kind))
    if via:
        BG_VIA.append(full)
    kinds[sub_txt or kind or '(비어 있음)'] += 1


def main():
    ap = argparse.ArgumentParser(description='서울 전체 카페 + 서울 밖 스타벅스·투썸 → cafes.json')
    ap.add_argument('inputs', nargs='+', help='상가(상권)정보 CSV / ZIP / 폴더 (여러 개 가능)')
    ap.add_argument('-o', '--out', default='cafes.json', help='만들 파일 이름 (기본: cafes.json)')
    ap.add_argument('--all-in', default='서울', help='카페를 전부 담을 시·도(쉼표로 여러 곳, 기본: 서울)')
    ap.add_argument('--everywhere', default='스타벅스,투썸플레이스', help='그 밖의 지역에서도 담을 브랜드(쉼표로, 기본: 스타벅스,투썸플레이스 / all / none)')
    ap.add_argument('--extra', action='append', default=[], help='프랜차이즈 목록에 더할 브랜드 이름(여러 번 가능)')
    ap.add_argument('--asof', default='', help='자료 기준 연월(예: 2026-10). 안 쓰면 파일 이름의 숫자(202610 등)에서 찾고, 없으면 오늘 날짜')
    ap.add_argument('--bg-in', default='서울', help='보드게임 카페를 담을 시·도(쉼표로 여러 곳, 기본: 서울 / all = 전국)')
    ap.add_argument('--bg-extra', action='append', default=[], help="이름에 '보드게임'이 없는 보드게임 카페 이름(여러 번 가능)")
    ap.add_argument('--no-bg-brand', action='store_true', help="보드게임 카페 브랜드·'○○보드카페' 이름 인식을 끔(이름에 '보드게임'이 든 곳만 모음)")
    ap.add_argument('--bg-out', default='boardgame.json', help='보드게임 카페 파일 이름 (기본: boardgame.json / none = 만들지 않음)')
    ap.add_argument('--no-cafe-check', action='store_true', help='업종이 커피·카페인지 확인하는 단계를 건너뜀(업종 열이 없는 파일용)')
    a = ap.parse_args()

    brands = [(n, list(p)) for n, p in FRANCHISES] + [(x.strip(), [x.strip()]) for x in a.extra if x.strip()]
    names = [n for n, _ in brands]
    brand_of = build_matcher(brands)
    full_regions = [sido_key(x) for x in a.all_in.split(',') if x.strip()]
    ev = a.everywhere.strip()
    if ev.lower() == 'all':
        ev_set = set(range(len(brands)))
    elif ev.lower() in ('none', '없음', ''):
        ev_set = set()
    else:
        ev_set = set()
        for x in ev.split(','):
            x = x.strip()
            if x not in names:
                print('! --everywhere 에 적은 브랜드가 목록에 없습니다: %s' % x, file=sys.stderr)
                return 2
            ev_set.add(names.index(x))

    srcs = iter_sources(a.inputs)
    if not srcs:
        print('읽을 CSV 가 없습니다. 경로를 확인해 주세요.', file=sys.stderr)
        return 2

    bg_on = a.bg_out.strip().lower() not in ('none', '없음', '')
    bg_all = a.bg_in.strip().lower() == 'all'
    bg_regions = [sido_key(x) for x in a.bg_in.split(',') if x.strip()]
    bg_extra = [norm_key(x) for x in a.bg_extra if x.strip()]
    seen, rows = set(), []
    bg_seen, bg_rows = set(), []
    bg_kinds, bg_excl = Counter(), Counter()   # 보드게임 후보의 업종(소분류) 분포 / 업종·이름 때문에 뺀 것
    st = Counter()
    kinds = Counter()
    excl = Counter()   # 카페가 아니라서 뺀 업종(소분류)
    asof_guess = ''
    for label, opener in srcs:
        m = re.search(r'(20\d{2})[-_.]?(0[1-9]|1[0-2])', label)
        if m and not asof_guess:
            asof_guess = '%s-%s' % (m.group(1), m.group(2))
        with opener() as raw:
            f, enc = open_text(raw)
            rd = csv.reader(f)
            try:
                header = next(rd)
            except StopIteration:
                print('· 비어 있음:', label); continue
            header = [h.strip().lstrip('﻿') for h in header]
            ci = dict(name=pick(header, NAME_COLS), branch=pick(header, BRANCH_COLS), road=pick(header, ROAD_COLS), jibun=pick(header, JIBUN_COLS),
                      lon=pick(header, LON_COLS), lat=pick(header, LAT_COLS), sido=pick(header, SIDO_COLS))
            ind = [i for i, h in enumerate(header) if '업종' in h or '표준산업분류' in h]
            sub_real = [i for i in ind if '소분류' in header[i]]
            sub = sub_real or ind[-1:]   # 업종 종류를 세어 보여 줄 열(소분류 우선)
            miss = [k for k in ('name', 'lon', 'lat') if ci[k] < 0] + (['주소'] if ci['road'] < 0 and ci['jibun'] < 0 else [])
            if miss:
                print('\n! 이 파일은 건너뜁니다: %s\n  찾지 못한 열: %s\n  이 파일의 열 이름: %s' % (label, ', '.join(miss), ' | '.join(header)), file=sys.stderr)
                st['건너뛴 파일'] += 1
                continue
            if not ind and not a.no_cafe_check:
                print('! 업종 열을 찾지 못했습니다(%s). 카페 확인 없이 거릅니다(커피·카페 아닌 곳이 섞일 수 있음).' % label, file=sys.stderr)
            if ci['sido'] < 0:
                print('· 참고: 시도 열이 없어 주소의 첫 단어로 지역을 가립니다(%s)' % label)
            st['읽은 파일'] += 1
            n_rows = 0
            need = max(ci['name'], ci['lon'], ci['lat'])
            for r in rd:
                n_rows += 1
                if len(r) <= need:
                    continue
                if bg_on:
                    nm0 = r[ci['name']].strip()
                    hit = bg_name_hit(nm0, not a.no_bg_brand) if nm0 else ''
                    if nm0 and not hit and any(x in norm_key(nm0) for x in bg_extra):
                        hit = 'extra'
                    if hit:
                        take_boardgame(r, nm0, ci, ind, sub, bg_all, bg_regions, bg_seen, bg_rows, bg_kinds, bg_excl, st, '' if hit == 'name' else hit)
                        continue   # 보드게임 카페는 커피 카페 자료에 넣지 않는다
                if ind and not a.no_cafe_check:
                    kind = ' '.join(r[i] for i in ind if i < len(r))
                    if '카페' not in kind and '커피' not in kind:
                        continue
                    if sub_real:   # 소분류가 '카페'인 줄만(독서실/스터디 카페·아이스크림/빙수·빵/도넛 등은 제외)
                        vals = [r[i].strip() for i in sub_real if i < len(r)]
                        if not any(v.replace(' ', '') in CAFE_KINDS for v in vals):
                            excl[' / '.join(vals)] += 1
                            continue
                nm = r[ci['name']].strip()
                if not nm:
                    continue
                if any(x in nm for x in NOT_CAFE_NAME):
                    st['제외: 이름이 스터디카페·독서실'] += 1
                    continue
                if norm_key(nm) in UNNAMED:
                    nm = '이름 없는 카페'
                addr = ''
                if ci['road'] >= 0 and ci['road'] < len(r):
                    addr = r[ci['road']].strip()
                if not addr and ci['jibun'] >= 0 and ci['jibun'] < len(r):
                    addr = r[ci['jibun']].strip()
                sido = r[ci['sido']].strip() if ci['sido'] >= 0 and ci['sido'] < len(r) else (addr.split(' ')[0] if addr else '')
                in_full = sido_key(sido) in full_regions
                bi = brand_of(nm)
                if not in_full and bi not in ev_set:
                    st['제외: 전부 담는 지역 밖의 다른 카페'] += 1
                    continue
                try:
                    lat, lon = float(r[ci['lat']]), float(r[ci['lon']])
                except ValueError:
                    st['제외: 좌표 없음'] += 1
                    continue
                if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
                    st['제외: 좌표가 우리나라 밖'] += 1
                    continue
                br = r[ci['branch']].strip() if ci['branch'] >= 0 and ci['branch'] < len(r) else ''
                full = re.sub(r'\s+', ' ', nm)
                if br and norm_key(br) not in norm_key(full):
                    full += ' ' + br
                key = (norm_key(full), round(lat, 4), round(lon, 4))
                if key in seen:
                    st['제외: 같은 카페가 두 번 들어 있음'] += 1
                    continue
                seen.add(key)
                rows.append((bi, full, addr, round(lat, 5), round(lon, 5), sido, in_full))
                if sub:
                    kinds[' / '.join(r[i].strip() for i in sub if i < len(r))] += 1
            print('· %s  (%s, %d줄)' % (label, enc, n_rows))

    if not rows:
        print('\n걸러낸 카페가 0곳입니다. 위 메시지(열 이름·건너뛴 파일)를 확인하거나, 그대로 채팅에 붙여 주세요.', file=sys.stderr)
        return 1

    rows.sort(key=lambda t: (t[0] if t[0] >= 0 else 999, t[5], t[1]))
    asof = a.asof or asof_guess or date.today().strftime('%Y-%m')
    inb = [t for t in rows if t[6]]
    bb = [round(min(t[3] for t in inb), 3), round(min(t[4] for t in inb), 3), round(max(t[3] for t in inb), 3), round(max(t[4] for t in inb), 3)] if inb else []
    obj = {'v': 2, 'src': '소상공인시장진흥공단 상가(상권)정보(공공데이터포털)', 'asof': asof, 'b': names,
           'full': [x.strip() for x in a.all_in.split(',') if x.strip()], 'bb': bb,
           'r': [[bi, nm, ad, la, lo] for bi, nm, ad, la, lo, _, _ in rows]}   # bi = 브랜드 번호, 개인 카페는 -1
    with open(a.out, 'w', encoding='utf-8') as fo:
        json.dump(obj, fo, ensure_ascii=False, separators=(',', ':'))
    chk = os.path.splitext(a.out)[0] + '-check.csv'
    with open(chk, 'w', encoding='utf-8-sig', newline='') as fc:
        w = csv.writer(fc)
        w.writerow(['구분', '브랜드', '매장명', '주소', '위도', '경도', '시도'])
        for bi, nm, ad, la, lo, sd, _ in rows:
            w.writerow(['프랜차이즈' if bi >= 0 else '개인', names[bi] if bi >= 0 else '', nm, ad, la, lo, sd])

    bg_info = None
    if bg_on:
        bg_rows.sort(key=lambda t: (t[4], t[0]))
        bg_bb = [round(min(t[2] for t in bg_rows), 3), round(min(t[3] for t in bg_rows), 3), round(max(t[2] for t in bg_rows), 3), round(max(t[3] for t in bg_rows), 3)] if bg_rows else []
        bg_obj = {'v': 1, 'src': '소상공인시장진흥공단 상가(상권)정보(공공데이터포털)', 'asof': asof,
                  'full': ['전국'] if bg_all else [x.strip() for x in a.bg_in.split(',') if x.strip()], 'bb': bg_bb,
                  'r': [[nm, ad, la, lo] for nm, ad, la, lo, _, _ in bg_rows]}   # 이름, 주소, 위도, 경도
        with open(a.bg_out, 'w', encoding='utf-8') as fo:
            json.dump(bg_obj, fo, ensure_ascii=False, separators=(',', ':'))
        bg_chk = os.path.splitext(a.bg_out)[0] + '-check.csv'
        with open(bg_chk, 'w', encoding='utf-8-sig', newline='') as fc:
            w = csv.writer(fc)
            w.writerow(['매장명', '주소', '위도', '경도', '시도', '업종'])
            for nm, ad, la, lo, sd, kd in bg_rows:
                w.writerow([nm, ad, la, lo, sd, kd])
        bg_info = (bg_chk,)
    print('\n===== 결과 =====')
    n_fr = sum(1 for t in inb if t[0] >= 0)
    print('전부 담은 지역(%s): %d곳 = 프랜차이즈 %d + 개인 %d' % (a.all_in, len(inb), n_fr, len(inb) - n_fr))
    out_rows = [t for t in rows if not t[6]]
    print('그 밖의 지역(선택한 브랜드만): %d곳' % len(out_rows))
    print('\n브랜드별(전체):')
    cnt = Counter(t[0] for t in rows)
    for i in sorted(cnt, key=lambda k: -cnt[k]):
        if i >= 0:
            print('  %s: %d곳 (그중 전부 담은 지역 %d)' % (names[i], cnt[i], sum(1 for t in inb if t[0] == i)))
    print('합계: %d곳 · 자료 기준: %s · 파일 크기: %.0f KB' % (len(rows), asof, os.path.getsize(a.out) / 1024))
    gu = Counter((t[2].split(' ') + ['', ''])[1] for t in inb)
    if gu:
        print('\n전부 담은 지역의 구·군별:', ' · '.join('%s %d' % (k or '(없음)', v) for k, v in gu.most_common()))
    sido_cnt = Counter(t[5] for t in out_rows)
    if sido_cnt:
        print('\n그 밖의 지역 시·도별:', ' · '.join('%s %d' % (k or '(없음)', v) for k, v in sido_cnt.most_common()))
    print('\n업종 종류(많은 순 12개):')
    for k, v in kinds.most_common(12):
        print('  %s: %d' % (k or '(비어 있음)', v))
    if excl:
        print('\n카페가 아니라서 뺀 업종(많은 순 8개):')
        for k, v in excl.most_common(8):
            print('  %s: %d' % (k or '(비어 있음)', v))
    print('\n처리 내역:')
    for k, v in st.items():
        print('  %s: %d' % (k, v))
    if bg_on:
        print('\n===== 보드게임 카페 (%s) =====' % ('전국' if bg_all else a.bg_in))
        print('담은 곳: %d곳 (커피 카페 자료에서는 빠집니다)' % len(bg_rows))
        gu2 = Counter((t[1].split(' ') + ['', ''])[1] for t in bg_rows)
        if gu2:
            print('구·군별:', ' · '.join('%s %d' % (k or '(없음)', v) for k, v in gu2.most_common()))
        if bg_kinds:
            print('담은 곳의 업종(많은 순 8개):')
            for k, v in bg_kinds.most_common(8):
                print('  %s: %d' % (k, v))
        if bg_excl:
            print("이름에 '보드게임'이 있지만 업종·이름 때문에 뺀 곳(업종 많은 순 8개):")
            for k, v in bg_excl.most_common(8):
                print('  %s: %d' % (k, v))
        if bg_rows:
            print('이름 예시:', ' · '.join(t[0] for t in bg_rows[:8]))
        if BG_VIA:
            print("이름에 '보드게임'은 없지만 브랜드·보드카페 이름이라 담은 곳: %d곳 — 눈으로 확인해 주세요 (boardgame-check.csv)" % len(BG_VIA))
            print('  예시:', ' · '.join(BG_VIA[:12]))
    print('\n만든 파일: %s (앱용), %s (엑셀로 확인용)' % (os.path.abspath(a.out), os.path.abspath(chk)))
    if bg_info:
        print('            %s (보드게임 앱용), %s (엑셀로 확인용)' % (os.path.abspath(a.bg_out), os.path.abspath(bg_info[0])))
        print('→ %s 과 %s 을 채팅에 올려 주세요. 위 "결과"와 "보드게임 카페" 부분도 함께 붙여 주시면 확인하기 좋습니다.' % (a.out, a.bg_out))
    else:
        print('→ %s 을 채팅에 올려 주세요. 위 "결과"와 "업종 종류" 부분도 함께 붙여 주시면 확인하기 좋습니다.' % a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
