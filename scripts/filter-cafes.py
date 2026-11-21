#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카페 자료 만들기 (책장성경 앱 '모임 장소' 지도용)

공공데이터포털의 「소상공인시장진흥공단_상가(상권)정보」 CSV(전국 또는 시·도별 파일, ZIP 그대로도 가능)에서
  · 서울의 카페를 전부(프랜차이즈 + 개인 카페),
  · 서울 밖에서는 스타벅스·투썸플레이스만
골라 작은 파일(cafes.json)로 만듭니다. 각 카페에는 '프랜차이즈(브랜드 이름)' 또는 '개인' 표시가 붙습니다.
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

만들어지는 파일 (실행한 폴더에):
    cafes.json        앱에 넣을 파일 (이 파일을 채팅에 올려 주세요)
    cafes-check.csv   엑셀로 열어 눈으로 확인하는 파일(한글 깨짐 없음)
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


SKIP_FILES = ('cafes-check.csv', 'brandcafes-check.csv')   # 이 스크립트(와 옛 스크립트)가 만든 확인용 파일은 입력에서 제외


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


def main():
    ap = argparse.ArgumentParser(description='서울 전체 카페 + 서울 밖 스타벅스·투썸 → cafes.json')
    ap.add_argument('inputs', nargs='+', help='상가(상권)정보 CSV / ZIP / 폴더 (여러 개 가능)')
    ap.add_argument('-o', '--out', default='cafes.json', help='만들 파일 이름 (기본: cafes.json)')
    ap.add_argument('--all-in', default='서울', help='카페를 전부 담을 시·도(쉼표로 여러 곳, 기본: 서울)')
    ap.add_argument('--everywhere', default='스타벅스,투썸플레이스', help='그 밖의 지역에서도 담을 브랜드(쉼표로, 기본: 스타벅스,투썸플레이스 / all / none)')
    ap.add_argument('--extra', action='append', default=[], help='프랜차이즈 목록에 더할 브랜드 이름(여러 번 가능)')
    ap.add_argument('--asof', default='', help='자료 기준 연월(예: 2026-10). 안 쓰면 파일 이름의 숫자(202610 등)에서 찾고, 없으면 오늘 날짜')
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

    seen, rows = set(), []
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
    print('\n만든 파일: %s (앱용), %s (엑셀로 확인용)' % (os.path.abspath(a.out), os.path.abspath(chk)))
    print('→ %s 을 채팅에 올려 주세요. 위 "결과"와 "업종 종류" 부분도 함께 붙여 주시면 확인하기 좋습니다.' % a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
