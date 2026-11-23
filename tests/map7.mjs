// v54 — 모임 장소 지도의 스타벅스·투썸 매장 층: 자료 읽기(정상·파일 없음·깨진 파일), 확대 수준별 점, 점 누르기 → 카드, 길찾기 연결, '내 장소로 추가'(양식 미리 채움·저장·중복 표시),
//        켜기/끄기(기기 저장), 점이 너무 많을 때 제한, 부산처럼 먼 곳, 단추·안내 문구 자리, 듀오 펼침·아이폰 세로.
// 사용: node map7.mjs   (스크린샷은 /tmp/map7shots/). 매장 자료는 시험용 가짜(이름 '시험N점')를 요청 가로채기로 넣는다 — 실제 매장 자료 시험은 자료를 받은 뒤 따로 한다.
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
import { fakeVector } from './vtscene.mjs';   // v68: 벡터 지도 자료 서버 흉내(래스터 지도가 없어졌으므로)
serve(8970); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map7shots', { recursive: true });

function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])) >>> 0, 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);

// ---- 시험용 가짜 매장 자료 ----
const BR = ['스타벅스', '투썸플레이스'];
const SB = []; for (let i = 0; i < 10; i++) SB.push([0, `스타벅스 시험${i + 1}점`, `서울 강동구 시험로 ${i + 1}`, +(37.5260 + Math.floor(i / 5) * 0.0030).toFixed(5), +(127.1180 + (i % 5) * 0.0030).toFixed(5)]);
const TW = []; for (let j = 0; j < 5; j++) TW.push([1, `투썸플레이스 시험${j + 1}점`, `서울 강동구 시험대로 ${j + 1}`, 37.5350, +(127.1180 + j * 0.0030).toFixed(5)]);
const BUSAN = [0, '스타벅스 부산시험점', '부산 부산진구 시험로 9', 35.1577, 129.0590];
const DUP = [0, '스타벅스 중복시험점', '서울 강동구 중복로 1', 37.53973, 127.1300];   // 아래 내 장소(스타벅스 내가 등록, 37.5400)의 남쪽 약 30m — 40m 안이라 같은 곳으로 본다
const small = { v: 1, src: '시험용', asof: '2026-10', b: BR, r: [...SB, ...TW, BUSAN, DUP] };
const dense = { v: 1, src: '시험용', asof: '2026-10', b: BR, r: [...SB] };
for (let k = 0; k < 1100; k++) dense.r.push([k % 2, `${BR[k % 2]} 밀집${k}점`, '서울 시험', +(37.4900 + (k % 33) * 0.0004).toFixed(5), +(127.0400 + Math.floor(k / 33) * 0.0004).toFixed(5)]);

const seed = { fn: (cfg) => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places));
    if (cfg && cfg.theme) localStorage.setItem('bf.settings', JSON.stringify({ theme: cfg.theme }));
    if (cfg && cfg.off) localStorage.setItem('bf.mapbrand', 'off'); }
} };
const MINE = { id: 'p1', name: '스타벅스 내가 등록', lat: 37.5400, lng: 127.1300, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', ts: 1 };   // DUP 매장과 같은 자리
const MINE2 = { id: 'p2', name: '가나 카페', lat: 37.5330, lng: 127.1100, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', ts: 2 };
async function openDev(dev, { data = small, mode = 'ok', cfg = {} } = {}) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url();
    if (fakeVector(u, r)) return;
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.endsWith('/data/boardgame.json')) r.respond({ status: 404, body: 'x' });   // 보드게임 층은 이 시험의 대상이 아니다(map10)
    else if (u.endsWith('/data/cafes.json')) r.respond({ status: 404, body: 'x' });   // 새 파일이 없다고 응답 → 앱이 옛 형식(brandcafes.json)으로 돌아가는 경로를 시험한다
    else if (u.endsWith('/data/brandcafes.json')) { if (mode === 'ok') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }); else if (mode === 'none') r.respond({ status: 404, body: 'x' }); else r.respond({ status: 200, contentType: 'application/json', body: '{"r": oops' }); }
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await p.evaluateOnNewDocument(seed.fn, { places: [MINE, MINE2], ...cfg });
  await p.goto('http://localhost:8970/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  await p.click('#btn-map'); await sleep(1800);
  return { p, errs, w, h };
}
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const shown = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
// 지도를 그 위치·확대로 옮긴 뒤, 그 위치(= 지도 가운데)를 누른다
async function tapAt(p, lat, lng, zoom = 16) {
  await p.evaluate((la, lo, z) => { window.__mpMap.setView([la, lo], z, { animate: false }); }, lat, lng, zoom); await sleep(450);
  const pt = await p.evaluate((la, lo) => { const m = window.__mpMap, c = m.latLngToContainerPoint([la, lo]), r = document.querySelector('#mp-map').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, lat, lng);
  await p.mouse.click(pt.x, pt.y); await sleep(350);
  return pt;
}
const cardName = (p) => p.evaluate(() => { const c = document.querySelector('#mp-card'); return c && !c.hidden ? (c.querySelector('.mp-c-top strong') || {}).textContent || null : null; });
const msgsOpen = (p) => p.evaluate(() => window.__msgs.filter((m) => m.open).map((m) => m.open));
// 지도 층에 올라간 점(반지름 6.5)·선택 고리(반지름 12)를 색별로 센다
const dots = (p) => p.evaluate(() => { const o = { dot: 0, ring: 0, c: {} }; window.__mpMap.eachLayer((l) => { if (!l.options || l.options.renderer === undefined || !l._latlng) return; const r = l.options.radius; if (r === 6.5) { o.dot++; o.c[l.options.fillColor] = (o.c[l.options.fillColor] || 0) + 1; } else if (r === 12) o.ring++; }); return o; });
// 지금 보이는 범위(+40%) 안에 있어야 할 매장 수를 자료에서 직접 센다
const expectIn = (p, data) => p.evaluate((rows) => { const b = window.__mpMap.getBounds().pad(0.4); return rows.filter((r) => b.contains([r[3], r[4]])).length; }, data.r);
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bf.places') || '[]'));

const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }], PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];

// ===== 1. 듀오 펼침 · 정상 자료 =====
{
  console.log('===== 듀오 펼침 · 정상 자료');
  const { p, errs, w } = await openDev(DUO);
  const br = await rect(p, '#mp-br'), me = await rect(p, '.mp-me'), zo = await rect(p, '.leaflet-control-zoom'), mw = await rect(p, '.mp-mapwrap');
  ok('카페 단추가 있고 켜진 모양이다(옛 형식 자료라 종류 걸러 보기는 안 나온다)', !!br && !(await shown(p, '#mp-bf')) && await p.evaluate(() => { const e = document.querySelector('#mp-br'); return e.classList.contains('on') && e.getAttribute('aria-pressed') === 'true'; }));
  ok('단추가 내 위치 단추 아래에 겹치지 않게, 지도 안에 있다', br.t >= me.b + 3 && br.l >= mw.l && br.r <= mw.r && br.b <= mw.b && br.t >= zo.b, `br ${Math.round(br.t)}~${Math.round(br.b)} · me ${Math.round(me.t)}~${Math.round(me.b)} · zoom~${Math.round(zo.b)}`);
  ok('점을 그리는 캔버스가 전용 층에 있다', await p.evaluate(() => !!document.querySelector('.leaflet-mpBr-pane canvas')));
  await p.screenshot({ path: '/tmp/map7shots/duo-open.png' });

  // 점 누르기 → 카드
  await tapAt(p, SB[0][3], SB[0][4]);
  ok('점을 누르면 그 매장 카드가 뜬다', (await cardName(p)) === SB[0][1], String(await cardName(p)));
  const card = await txt(p, '#mp-card');
  ok('카드에 주소가 있고, 브랜드·자료 출처·기준 연월·영업 확인 안내는 정보 보기 칸 안에 들어 있다(v72: 주소 밑 줄은 삭제)', card.includes(SB[0][2]) && card.includes('스타벅스 매장') && card.includes('공공데이터') && card.includes('2026-10 기준') && card.includes('지도 앱에서 확인'), card.slice(0, 120));
  ok('카드 단추 = 정보 보기·길찾기·나만의 리뷰·내 장소로 추가 네 개뿐(네이버·애플·구글 지도·수정·전화 없음, v61·v72)', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-lk')].map((x) => x.textContent))) === JSON.stringify(['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']));
  { const d = await dots(p), e = await expectIn(p, small);
    ok('선택하면 고리가 하나 생기고, 그려진 점 수 = 보이는 범위의 매장 수', d.ring === 1 && d.dot === e && e >= 10, JSON.stringify(d) + ' 기대 ' + e); }
  await p.screenshot({ path: '/tmp/map7shots/duo-card.png' });
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="route"]').click()); await sleep(200);
  const opens = await msgsOpen(p);
  ok('길찾기 단추 → 앱에 네이버 지도 길찾기 주소(nmap://route/public, 목적지 좌표·이름, 출발지 없음)를 보낸다', opens.length === 1 && opens[0].startsWith('nmap://route/public?dlat=37.526000&dlng=127.118000&dname=' + encodeURIComponent(SB[0][1])) && !/slat|slng|sname/.test(opens[0]) && opens[0].endsWith('&appname=com.choice0829.bibleflip'), opens.join(' | ').slice(0, 200));
  ok('길찾기의 웹 대체 주소는 네이버 지도 장소 검색', await p.evaluate(() => window.__msgs.filter((m) => m.open).pop().fallback.startsWith('https://map.naver.com/p/search/')));

  // 내 장소로 추가 → 양식 미리 채움 → 저장
  const before = (await stored(p)).length;
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="add"]').click()); await sleep(600);
  const f = await p.evaluate(() => ({ title: document.querySelector('#mp-ftitle').textContent, name: document.querySelector('#mp-f-name').value, addr: document.querySelector('#mp-f-addr').value, delHidden: document.querySelector('#mp-f-del').hidden, ll: document.querySelector('#mp-f-ll').textContent, formShown: !document.querySelector('#mp-form').hidden }));
  ok('양식이 "장소 추가"로, 이름·주소·위치가 미리 채워져 열린다(삭제 단추 없음)', f.formShown && f.title === '장소 추가' && f.name === SB[0][1] && f.addr === SB[0][2] && f.delHidden && f.ll.startsWith('위치 지정됨') && f.ll.includes('37.52600'), JSON.stringify(f).slice(0, 200));
  ok('양식을 열면 매장 카드는 닫힌다', (await cardName(p)) === null);
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  const after = await stored(p), added = after.find((x) => x.name === SB[0][1]);
  ok('저장하면 내 장소가 하나 늘고 이름·좌표·주소가 들어 있다', after.length === before + 1 && added && Math.abs(added.lat - SB[0][3]) < 1e-6 && Math.abs(added.lng - SB[0][4]) < 1e-6 && added.addr === SB[0][2], JSON.stringify(added));
  await tapAt(p, SB[0][3], SB[0][4]);
  // 같은 자리에 내 핀(마커)이 생겼으므로 매장 점 대신 핀이 눌릴 수 있다 → 핀 카드면 수정 단추가 있다. 점을 누르려면 핀 밖(약간 아래)을 누른다.
  const nm1 = await cardName(p);
  ok('이미 등록한 자리를 누르면 내 장소 카드(수정 단추)가 우선한다', nm1 === SB[0][1] && (await p.evaluate(() => !!document.querySelector('#mp-card .mp-lk[data-o="edit"]'))), String(nm1));

  // 중복 표시: 내 장소(스타벅스 내가 등록)와 40m 안에 있는 같은 브랜드 매장은 '내 장소에 있음'(눌러도 양식이 안 열림)
  await p.evaluate(() => { document.querySelector('#mp-card .mp-c-x') && document.querySelector('#mp-card .mp-c-x').click(); }); await sleep(200);
  await tapAt(p, DUP[3], DUP[4], 18);
  ok('내 장소 근처 매장 카드가 뜬다', (await cardName(p)) === DUP[1], String(await cardName(p)));
  const dupBtn = await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-lk[data-o="add"]'); return { t: x.textContent, d: x.disabled }; });
  ok('이미 내 목록에 있는 곳이면 단추가 "내 장소에 있음"(비활성)이다', dupBtn.d && dupBtn.t === '내 장소에 있음', JSON.stringify(dupBtn));
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="add"]').click()); await sleep(300);
  ok('비활성 단추를 눌러도 양식이 열리지 않는다', await p.evaluate(() => document.querySelector('#mp-form').hidden));
  // 양식이 열려 있는 동안에는 점을 눌러도 매장 카드가 뜨지 않는다
  await p.evaluate(() => document.querySelector('#mp-add').click()); await sleep(500);
  await tapAt(p, SB[4][3], SB[4][4], 16);
  ok('입력 양식을 열어 둔 동안 점을 눌러도 카드가 안 뜬다', (await cardName(p)) === null && await p.evaluate(() => !document.querySelector('#mp-form').hidden));
  await p.evaluate(() => document.querySelector('#mp-f-cancel').click()); await sleep(400);

  // 확대 수준
  await p.evaluate(() => { document.querySelector('#mp-card .mp-c-x') && document.querySelector('#mp-card .mp-c-x').click(); }); await sleep(200);
  await tapAt(p, SB[3][3], SB[3][4], 16);
  ok('다른 점을 누르면 카드가 그 매장으로 바뀐다', (await cardName(p)) === SB[3][1], String(await cardName(p)));
  await p.evaluate(() => window.__mpMap.setZoom(11, { animate: false })); await sleep(500);
  ok('확대 수준 11(기준 15 미만)에서는 점이 하나도 안 그려진다', (await dots(p)).dot === 0);
  ok('멀리 보면(확대 수준 11) 카드가 그대로이고 안내 문구가 뜬다(확대하면 보입니다)', (await shown(p, '#mp-bhint')) && (await txt(p, '#mp-bhint')).trim() === '지도를 확대하면 장소가 보입니다', await txt(p, '#mp-bhint'));
  { const hb = await rect(p, '#mp-bhint'), mw0 = await rect(p, '.mp-mapwrap'), c = (hb.l + hb.r) / 2, mc = (mw0.l + mw0.r) / 2;
    ok('안내 문구가 (왼쪽 목록 창을 뺀 영역이 아니라) 지도 전체의 가운데에 있다(±2px)', Math.abs(c - mc) <= 2, `문구 중심 ${c.toFixed(1)} · 지도 중심 ${mc.toFixed(1)}`);
    ok('안내 문구가 지도 안에 들어가고 오른쪽 단추(확대·내 위치)를 덮지 않는다', hb.l >= mw0.l && hb.r <= mw0.r - 62, `문구 ${Math.round(hb.l)}~${Math.round(hb.r)} · 지도 ${Math.round(mw0.l)}~${Math.round(mw0.r)}`);
    ok('추가 단추의 글자가 "＋ 장소 추가"', (await txt(p, '#mp-add')).trim() === '＋ 장소 추가', await txt(p, '#mp-add')); }
  await p.evaluate(() => window.__mpMap.setZoom(15, { animate: false })); await sleep(500);
  ok('확대 수준 15에서는 안내 문구가 사라지고 점이 다시 그려진다', !(await shown(p, '#mp-bhint')) && (await dots(p)).dot === (await expectIn(p, small)) && (await dots(p)).dot > 0);
  { const d = await dots(p), eb = await p.evaluate((rows) => { const bb = window.__mpMap.getBounds().pad(0.4), c = [0, 0]; rows.forEach((r) => { if (bb.contains([r[3], r[4]])) c[r[0]]++; }); return c; }, small.r);
    ok('모든 카페 점이 같은 색(커피색 #8a5a3c) 하나로 그려진다(브랜드 달라도 같음)', Object.keys(d.c).length === 1 && d.c['#8a5a3c'] === eb[0] + eb[1] && eb[1] >= 3 && eb[0] >= 5, JSON.stringify(d.c) + ' 기대 ' + eb); }
  // 먼 곳(부산)
  await tapAt(p, BUSAN[3], BUSAN[4]);
  ok('먼 곳(부산)의 매장도 그 자리로 가면 눌린다', (await cardName(p)) === BUSAN[1], String(await cardName(p)));
  // 빈 곳 누르면 닫힘
  await p.evaluate((la, lo) => { window.__mpMap.setView([la + 0.0007, lo + 0.0007], 16, { animate: false }); }, BUSAN[3], BUSAN[4]); await sleep(300);
  const mr = await rect(p, '#mp-map'); await p.mouse.click(mr.l + 600, mr.t + 90); await sleep(300);
  ok('빈 곳을 누르면 카드가 닫힌다', (await cardName(p)) === null);

  // 켜기/끄기
  await tapAt(p, SB[6][3], SB[6][4]);
  ok('(끄기 전) 점 누르기 동작', (await cardName(p)) === SB[6][1]);
  await p.click('#mp-br'); await sleep(500);
  ok('끄면 카드가 닫히고 단추가 꺼진 모양이며 검은 알림은 뜨지 않는다(v63)', (await cardName(p)) === null && await p.evaluate(() => { const e = document.querySelector('#mp-br'); return !e.classList.contains('on') && e.getAttribute('aria-pressed') === 'false' && localStorage.getItem('bf.mapbrand') === 'off'; }) && !(await txt(p, '#infotoast') || '').includes('껐습니다'), await txt(p, '#infotoast'));
  await tapAt(p, SB[6][3], SB[6][4]);
  ok('끈 상태에서는 점이 0개이고 같은 자리를 눌러도 매장 카드가 안 뜬다', (await cardName(p)) === null && (await dots(p)).dot === 0);
  await p.click('#mp-br'); await sleep(500);
  await tapAt(p, SB[6][3], SB[6][4]);
  ok('다시 켜면 눌린다', (await cardName(p)) === SB[6][1], String(await cardName(p)));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 2. 끈 상태는 기기에 저장된다(다시 열어도 유지) =====
{
  console.log('===== 끈 상태 저장');
  const { p, errs } = await openDev(DUO, { cfg: { off: true } });
  ok('저장된 값이 off 면 열었을 때 꺼져 있다(단추 모양·안내 없음)', await p.evaluate(() => { const e = document.querySelector('#mp-br'); return !e.classList.contains('on'); }) && !(await shown(p, '#mp-bhint')));
  await tapAt(p, SB[0][3], SB[0][4]);
  ok('꺼져 있으면 점이 눌리지 않는다', (await cardName(p)) === null);
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 3. 점이 너무 많을 때 =====
{
  console.log('===== 점이 너무 많을 때');
  const { p, errs } = await openDev(DUO, { data: dense });
  await p.evaluate(() => { window.__mpMap.setView([37.4960, 127.0470], 15, { animate: false }); }); await sleep(900);
  ok('한 화면에 900곳이 넘으면 "가까운 900곳만" 안내가 뜨고 점은 정확히 900개', (await shown(p, '#mp-bhint')) && (await txt(p, '#mp-bhint')).includes('900곳만') && (await dots(p)).dot === 900, await txt(p, '#mp-bhint') + ' · ' + JSON.stringify(await dots(p)));
  { const hb = await rect(p, '#mp-bhint'), mw0 = await rect(p, '.mp-mapwrap'); ok('긴 안내(900곳)도 지도 전체의 가운데(±2px)이고 지도 안에 들어간다', !!hb && Math.abs((hb.l + hb.r) / 2 - (mw0.l + mw0.r) / 2) <= 2 && hb.l >= mw0.l && hb.r <= mw0.r - 62, hb ? `문구 중심 ${((hb.l + hb.r) / 2).toFixed(1)} · 지도 중심 ${((mw0.l + mw0.r) / 2).toFixed(1)} · 폭 ${Math.round(hb.r - hb.l)}` : '없음'); }
  await p.screenshot({ path: '/tmp/map7shots/duo-dense.png' });
  await p.evaluate(() => { window.__mpMap.setView([37.4960, 127.0470], 17, { animate: false }); }); await sleep(900);
  { const d = await dots(p), e = await expectIn(p, dense); ok('충분히 확대하면 안내가 사라지고 점 수 = 보이는 범위의 매장 수', !(await shown(p, '#mp-bhint')) && d.dot === e && e > 0 && e < 900, JSON.stringify(d) + ' 기대 ' + e); }
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 4. 자료가 없거나 깨졌을 때: 지도·내 장소는 그대로 =====
for (const [mode, label] of [['none', '파일 없음(404)'], ['bad', '깨진 파일']]) {
  console.log('===== ' + label);
  const { p, errs } = await openDev(DUO, { mode });
  ok(label + ': 안내 문구(불러오지 못했습니다)', (await shown(p, '#mp-bhint')) && (await txt(p, '#mp-bhint')).includes('불러오지 못했습니다'), await txt(p, '#mp-bhint'));
  ok(label + ': 내 장소 핀 2개와 목록은 그대로', (await p.evaluate(() => [document.querySelectorAll('.mp-pin').length, document.querySelectorAll('.mp-item').length])).join() === '2,2');
  await p.click('#mp-br'); await sleep(400);
  ok(label + ': 끄면 안내 문구도 사라진다', !(await shown(p, '#mp-bhint')));
  ok(label + ': 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 5. 야간 테마 =====
{
  console.log('===== 야간 테마');
  const { p, errs } = await openDev(DUO, { cfg: { theme: 'night' } });
  await tapAt(p, TW[2][3], TW[2][4]);
  ok('야간 테마에서도 점이 눌려 카드가 뜬다(카드 안 점 색 = 야간 커피색)', (await cardName(p)) === TW[2][1] && await p.evaluate(() => (document.querySelector('#mp-card .mp-bd') || {}).style.background.replace(/\s/g, '') === 'rgb(217,165,119)'));
  await p.screenshot({ path: '/tmp/map7shots/duo-night.png' });
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 6. 아이폰 세로(좁은 화면, 지도 탭) =====
{
  console.log('===== 아이폰 세로');
  const { p, errs } = await openDev(PH);
  await p.click('.mp-tabs button[data-t="r"]'); await sleep(1000);
  const br = await rect(p, '#mp-br'), me = await rect(p, '.mp-me'), mw = await rect(p, '.mp-mapwrap');
  ok('좁은 화면: 단추가 내 위치 단추 아래·지도 안에 있다', br && br.t >= me.b + 3 && br.r <= mw.r && br.b <= mw.b, `br ${Math.round(br.t)}~${Math.round(br.b)} me ${Math.round(me.t)}~${Math.round(me.b)}`);
  await p.evaluate(() => window.__mpMap.setZoom(11, { animate: false })); await sleep(500);
  { const hb = await rect(p, '#mp-bhint'); ok('좁은 화면: 안내 문구가 지도 가운데(±2px)에 있고 지도 안에 들어간다', !!hb && Math.abs((hb.l + hb.r) / 2 - (mw.l + mw.r) / 2) <= 2 && hb.l >= mw.l && hb.r <= mw.r, hb ? `문구 중심 ${((hb.l + hb.r) / 2).toFixed(1)} · 지도 중심 ${((mw.l + mw.r) / 2).toFixed(1)}` : '없음'); }
  await tapAt(p, SB[0][3], SB[0][4]);
  ok('좁은 화면: 점을 누르면 카드가 뜬다', (await cardName(p)) === SB[0][1], String(await cardName(p)));
  const cr = await rect(p, '#mp-card');
  ok('좁은 화면: 카드가 지도 안에 들어간다', cr.l >= mw.l - 1 && cr.r <= mw.r + 1 && cr.b <= mw.b + 1, JSON.stringify(cr));
  await p.screenshot({ path: '/tmp/map7shots/phone-card.png' });
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="add"]').click()); await sleep(600);
  ok('좁은 화면: "내 장소로 추가"를 누르면 입력 화면(목록 탭)으로 넘어가 미리 채워진다', await p.evaluate(() => document.querySelector('#mp').dataset.tab === 'l' && !document.querySelector('#mp-form').hidden && document.querySelector('#mp-f-name').value.startsWith('스타벅스 시험')));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

await b.close(); console.log(fails ? ('FAILS ' + fails) : 'ALL PASS'); process.exit(fails ? 1 : 0);
