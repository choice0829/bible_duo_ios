#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
스타벅스·투썸플레이스 매장만 걸러 내기 (책장성경 앱 '모임 장소' 지도용)

공공데이터포털의 「소상공인시장진흥공단_상가(상권)정보」 CSV(전국 또는 시·도별 파일, ZIP 그대로도 가능)에서
상호명이 스타벅스·투썸플레이스인 커피점만 골라 작은 파일(brandcafes.json)로 만듭니다.
파이썬 3.8 이상이면 되고, 따로 설치할 것은 없습니다(표준 라이브러리만 사용).

사용법 (명령 프롬프트 또는 PowerShell):
    python filter-brand-cafes.py 받은파일.zip
    python filter-brand-cafes.py 받은폴더
    python filter-brand-cafes.py 서울.csv 경기.csv 부산.csv ...        (여러 개를 한꺼번에)
    python filter-brand-cafes.py 받은파일.zip --asof 2026-10           (자료 기준 연월을 직접 지정)

만들어지는 파일 (실행한 폴더에):
    brandcafes.json       앱에 넣을 파일 (이 파일을 채팅에 올려 주세요)
    brandcafes-check.csv  엑셀로 열어 눈으로 확인하는 파일(한글 깨짐 없음)
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

BRANDS = ['스타벅스', '투썸플레이스']   # 앱에서 쓰는 순서(0, 1)
# 상호명을 공백·대소문자 없이 만든 뒤 '맨 앞'이 이 말로 시작하면 그 브랜드로 본다(중간에 낀 경우는 제외: 'OO약국 스타벅스 옆' 같은 이름)
BRAND_PREFIX = [('STARBUCKS', 0), ('스타벅스', 0), ('ATWOSOMEPLACE', 1), ('TWOSOMEPLACE', 1), ('투썸플레이스', 1), ('투썸', 1)]
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


def brand_of(name):
    k = norm_key(name)
    for pre, i in BRAND_PREFIX:
        if k.startswith(pre):
            return i
    return -1


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
                    if f.lower().endswith('.csv'):
                        out.append((fp, (lambda fp=fp: open(fp, 'rb'))))
                    elif f.lower().endswith('.zip'):
                        add_zip(fp, fp)
        elif p.lower().endswith('.zip'):
            add_zip(p, p)
        elif os.path.isfile(p):
            out.append((p, (lambda p=p: open(p, 'rb'))))
        else:
            print('! 찾을 수 없습니다:', p, file=sys.stderr)
    return out


def main():
    ap = argparse.ArgumentParser(description='스타벅스·투썸플레이스 매장만 걸러 brandcafes.json 만들기')
    ap.add_argument('inputs', nargs='+', help='상가(상권)정보 CSV / ZIP / 폴더 (여러 개 가능)')
    ap.add_argument('-o', '--out', default='brandcafes.json', help='만들 파일 이름 (기본: brandcafes.json)')
    ap.add_argument('--asof', default='', help='자료 기준 연월(예: 2026-10). 안 쓰면 파일 이름의 숫자(202610 등)에서 찾고, 없으면 오늘 날짜')
    ap.add_argument('--no-cafe-check', action='store_true', help='업종이 커피·카페인지 확인하는 단계를 건너뜀(업종 열이 없는 파일용)')
    a = ap.parse_args()

    srcs = iter_sources(a.inputs)
    if not srcs:
        print('읽을 CSV 가 없습니다. 경로를 확인해 주세요.', file=sys.stderr)
        return 2

    seen, rows = set(), []
    st = Counter()
    sido_cnt = Counter()
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
            miss = [k for k in ('name', 'lon', 'lat') if ci[k] < 0] + (['주소'] if ci['road'] < 0 and ci['jibun'] < 0 else [])
            if miss:
                print('\n! 이 파일은 건너뜁니다: %s\n  찾지 못한 열: %s\n  이 파일의 열 이름: %s' % (label, ', '.join(miss), ' | '.join(header)), file=sys.stderr)
                st['건너뛴 파일'] += 1
                continue
            if not ind and not a.no_cafe_check:
                print('! 업종 열을 찾지 못했습니다(%s). 커피점 확인 없이 상호명만으로 거릅니다.' % label, file=sys.stderr)
            st['읽은 파일'] += 1
            n_rows = 0
            for r in rd:
                n_rows += 1
                if len(r) <= max(ci['name'], ci['lon'], ci['lat']):
                    continue
                nm = r[ci['name']].strip()
                bi = brand_of(nm)
                if bi < 0:
                    continue
                st['상호명이 맞는 줄'] += 1
                if ind and not a.no_cafe_check:
                    kind = ' '.join(r[i] for i in ind if i < len(r))
                    if '카페' not in kind and '커피' not in kind:
                        st['제외: 커피점 아님(본사·사무실 등)'] += 1
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
                addr = ''
                if ci['road'] >= 0 and ci['road'] < len(r):
                    addr = r[ci['road']].strip()
                if not addr and ci['jibun'] >= 0 and ci['jibun'] < len(r):
                    addr = r[ci['jibun']].strip()
                key = (bi, norm_key(full), round(lat, 4), round(lon, 4))
                if key in seen:
                    st['제외: 같은 매장이 두 번 들어 있음'] += 1
                    continue
                seen.add(key)
                sido = r[ci['sido']].strip() if ci['sido'] >= 0 and ci['sido'] < len(r) else (addr.split(' ')[0] if addr else '')
                rows.append((bi, full, addr, round(lat, 5), round(lon, 5), sido))
            print('· %s  (%s, %d줄)' % (label, enc, n_rows))

    if not rows:
        print('\n걸러낸 매장이 0곳입니다. 위 메시지(열 이름·건너뛴 파일)를 확인하거나, 그대로 채팅에 붙여 주세요.', file=sys.stderr)
        return 1

    rows.sort(key=lambda t: (t[0], t[5], t[1]))
    asof = a.asof or asof_guess or date.today().strftime('%Y-%m')
    obj = {'v': 1, 'src': '소상공인시장진흥공단 상가(상권)정보(공공데이터포털)', 'asof': asof, 'b': BRANDS,
           'r': [[bi, nm, ad, la, lo] for bi, nm, ad, la, lo, _ in rows]}
    with open(a.out, 'w', encoding='utf-8') as fo:
        json.dump(obj, fo, ensure_ascii=False, separators=(',', ':'))
    chk = os.path.splitext(a.out)[0] + '-check.csv'
    with open(chk, 'w', encoding='utf-8-sig', newline='') as fc:
        w = csv.writer(fc)
        w.writerow(['브랜드', '매장명', '주소', '위도', '경도', '시도'])
        for bi, nm, ad, la, lo, sd in rows:
            w.writerow([BRANDS[bi], nm, ad, la, lo, sd])
    for _, _, _, _, _, sd in rows:
        sido_cnt[sd] += 1

    print('\n===== 결과 =====')
    for i, b in enumerate(BRANDS):
        print('%s: %d곳' % (b, sum(1 for t in rows if t[0] == i)))
    print('합계: %d곳 · 자료 기준: %s · 파일 크기: %.0f KB' % (len(rows), asof, os.path.getsize(a.out) / 1024))
    print('\n시·도별:', ' · '.join('%s %d' % (k or '(없음)', v) for k, v in sido_cnt.most_common()))
    print('\n처리 내역:')
    for k, v in st.items():
        print('  %s: %d' % (k, v))
    print('\n만든 파일: %s (앱용), %s (엑셀로 확인용)' % (os.path.abspath(a.out), os.path.abspath(chk)))
    print('→ %s 을 채팅에 올려 주세요. 위 "결과"의 숫자도 함께 알려 주시면 확인하기 좋습니다.' % a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
