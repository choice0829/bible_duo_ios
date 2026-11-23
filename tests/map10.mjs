// v59 — 보드게임 카페 층(별도 층 · 별도 단추 · 서울만, data/boardgame.json).
//   A. 듀오 펼침: 주사위 단추 위치·켜짐 · 점(보라색)·확대 단계(13부터)·안내 문구 · 카드·선택 고리 · 카페 점과의 겹침/선택 전환 · 내 장소로 추가 · 끄기/켜기·저장
//   B. 테마(세피아·야간) 점 색 · 서울 밖 안내 · 점이 아주 많을 때(상한)
//   C. 아이폰 세로: 단추 배치
//   D. 자료 없음(404): 단추·안내가 없고 카페 층은 그대로 / 자료 깨짐: 안내 문구
// 사용: node map10.mjs   (스크린샷은 /tmp/map10shots/). 자료는 시험용 가짜를 요청 가로채기로 넣는다.
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8974); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map10shots', { recursive: true });

function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])), 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);

// ---- 시험용 가짜 자료 ----
const CL = [37.5285, 127.1215];   // 점들이 모여 있는 가운데
// 보드게임 카페(이름, 주소, 위도, 경도)
const BG = [
  ['시험 보드게임카페 가', '서울 강동구 보드로 1', 37.5260, 127.1180],
  ['시험 보드게임카페 나', '서울 강동구 보드로 2', 37.5260, 127.1210],
  ['시험 보드게임카페 다', '서울 강동구 보드로 3', 37.5290, 127.1180],
  ['시험 보드게임카페 라', '서울 강동구 보드로 4', 37.5290, 127.1240],
  ['주사위 보드게임방', '서울 강동구 보드로 5', 37.5320, 127.1210],
  ['Board Game Dice', '서울 강동구 보드로 6', 37.5320, 127.1270],
];
// 같은 건물에 겹친 두 곳(좌표 같음) + 12m 떨어진 한 곳 + 40m 떨어진 한 곳(가깝지만 '같은 자리'는 아님)
const OV = [['겹침 보드게임 가', '서울 강동구 겹침로 1', 37.5400, 127.1100], ['겹침 보드게임 나', '서울 강동구 겹침로 1', 37.5400, 127.1100], ['겹침 보드게임 다', '서울 강동구 겹침로 1', 37.54011, 127.1100], ['떨어진 보드게임', '서울 강동구 겹침로 9', 37.54036, 127.1100]];
const FARBG = ['먼 보드게임카페', '서울 노원구 먼로 1', 37.6000, 127.0600];   // 시험 화면 밖(서울 북쪽)
const BB = [37.50, 126.90, 37.62, 127.20];
const bgData = { v: 1, src: '시험용', asof: '2026-10', full: ['서울'], bb: BB, r: [...BG, ...OV, FARBG] };
// 카페 층(v2)도 함께 켜서 층이 서로 방해하지 않는지 본다
const BR = ['스타벅스', '투썸플레이스'];
const CAFES = [
  [0, '스타벅스 시험1점', '서울 강동구 시험로 1', 37.5260, 127.1180 + 0.0030],   // 보드게임 가(37.5260,127.1180) 근처 — 겹치지 않음
  [0, '스타벅스 시험2점', '서울 강동구 시험로 2', 37.5300, 127.1150],
  [-1, '시험개인1', '서울 강동구 개인로 1', 37.5280, 127.1260],
  [-1, '시험개인2', '서울 강동구 개인로 2', 37.5340, 127.1180],
  [-1, '같은자리카페', '서울 강동구 보드로 5', 37.5320, 127.1210],   // 주사위 보드게임방과 같은 좌표 → 점이 겹침(보드게임이 위)
];
const BUSAN = [[0, '스타벅스 부산시험점', '부산 부산진구 시험로 9', 35.1577, 129.0590]];
const cafeData = { v: 2, src: '시험용', asof: '2026-10', b: BR, full: ['서울'], bb: [37.42, 126.76, 37.70, 127.19], r: [...CAFES, ...BUSAN] };
const BUSAN_BG = ['부산 보드게임카페', '부산 부산진구 보드로 1', 35.1580, 129.0600];
const manyBG = { v: 1, src: '시험용', asof: '2026-10', full: ['서울'], bb: BB, r: [] };
for (let k = 0; k < 800; k++) manyBG.r.push([`밀집보드${k}`, '서울 시험', +(37.5100 + (k % 40) * 0.0004).toFixed(5), +(127.1000 + Math.floor(k / 40) * 0.0004).toFixed(5)]);

const seed = { fn: (cfg) => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places));
    if (cfg && cfg.theme) localStorage.setItem('bf.settings', JSON.stringify({ theme: cfg.theme }));
    if (cfg && cfg.cafeOff) localStorage.setItem('bf.mapbrand', 'off');
    if (cfg && cfg.bgOff) localStorage.setItem('bf.mapbg', 'off'); }
} };
const MINE = { id: 'p1', name: '내 장소 하나', lat: 37.5400, lng: 127.1300, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', col: 0, ts: 1 };
async function openDev(dev, { bg = bgData, bgMode = 'ok', cafes = cafeData, cfg = {}, places = [MINE] } = {}) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url();
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.endsWith('/data/cafes.json')) { if (bgMode === 'real') r.continue(); else r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(cafes) }); }
    else if (u.endsWith('/data/boardgame.json')) { if (bgMode === 'real') r.continue(); else if (bgMode === 'ok') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(bg) }); else if (bgMode === 'none') r.respond({ status: 404, body: 'x' }); else r.respond({ status: 200, contentType: 'application/json', body: '{"r": oops' }); }
    else if (u.endsWith('/data/brandcafes.json')) r.respond({ status: 404, body: 'x' });
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await p.evaluateOnNewDocument(seed.fn, { places, ...cfg });
  await p.goto('http://localhost:8974/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  await p.click('#btn-map'); await sleep(1800);
  return { p, errs, w, h };
}
const rect = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const shown = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
async function tapAt(p, lat, lng, zoom = 16) {
  await p.evaluate((la, lo, z) => { window.__mpMap.setView([la, lo], z, { animate: false }); }, lat, lng, zoom); await sleep(450);
  const pt = await p.evaluate((la, lo) => { const m = window.__mpMap, c = m.latLngToContainerPoint([la, lo]), r = document.querySelector('#mp-map').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, lat, lng);
  await p.mouse.click(pt.x, pt.y); await sleep(350);
  return pt;
}
const cardName = (p) => p.evaluate(() => { const c = document.querySelector('#mp-card'); return c && !c.hidden ? (c.querySelector('.mp-c-top strong') || {}).textContent || null : null; });
// 점 세기: 보드게임 점(반지름 7)·카페 점(6.5)·선택 고리(12)
const dots = (p) => p.evaluate(() => { const o = { bg: 0, cafe: 0, ring: 0, bgc: {}, cafec: {} }; window.__mpMap.eachLayer((l) => { if (!l.options || l.options.renderer === undefined || !l._latlng) return; const r = l.options.radius; if (r === 7) { o.bg++; o.bgc[l.options.fillColor] = (o.bgc[l.options.fillColor] || 0) + 1; } else if (r === 6.5) { o.cafe++; o.cafec[l.options.fillColor] = (o.cafec[l.options.fillColor] || 0) + 1; } else if (r === 12) o.ring++; }); return o; });
const expectBg = (p, rows) => p.evaluate((rr) => { const bb = window.__mpMap.getBounds().pad(0.4); return rr.filter((r) => bb.contains([r[2], r[3]])).length; }, rows);
const hint = (p) => p.evaluate(() => { const h = document.querySelector('#mp-bhint'); return h && !h.hidden ? h.textContent : ''; });
const view = async (p, c, z) => { await p.evaluate((la, lo, zz) => { window.__mpMap.setView([la, lo], zz, { animate: false }); }, c[0], c[1], z); await sleep(600); };
const btnState = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? { on: e.classList.contains('on'), pressed: e.getAttribute('aria-pressed'), hidden: e.hidden } : null; }, sel);
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bf.places') || '[]'));
const lsGet = (p, k) => p.evaluate((kk) => localStorage.getItem(kk), k);
const overlap = (a, c) => !(a.r <= c.l || c.r <= a.l || a.b <= c.t || c.b <= a.t);

const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }], PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];

// ===== A. 듀오 펼침 =====
{
  console.log('===== A. 듀오 펼침 · 보드게임 층(켜짐) + 카페 층');
  const { p, errs } = await openDev(DUO);
  const bgb = await rect(p, '#mp-bg'), br = await rect(p, '#mp-br'), me = await rect(p, '.mp-me'), zo = await rect(p, '.leaflet-control-zoom'), mw = await rect(p, '.mp-mapwrap');
  ok('주사위 단추가 보이고 기본은 켜짐(aria-pressed=true), 아이콘이 있다', (await shown(p, '#mp-bg')) && JSON.stringify(await btnState(p, '#mp-bg')) === JSON.stringify({ on: true, pressed: 'true', hidden: false }) && (await p.evaluate(() => !!document.querySelector('#mp-bg svg rect'))), JSON.stringify(await btnState(p, '#mp-bg')));
  ok('주사위 단추는 카페 단추 바로 아래(같은 세로줄)에 있고 다른 단추·확대와 겹치지 않으며 지도 안에 있다', Math.abs(bgb.l - br.l) <= 1 && bgb.t >= br.b + 3 && bgb.t - br.b <= 16 && !overlap(bgb, br) && !overlap(bgb, me) && !overlap(bgb, zo) && bgb.r <= mw.r && bgb.b <= mw.b, `bg ${Math.round(bgb.l)}/${Math.round(bgb.t)} · br ${Math.round(br.l)}/${Math.round(br.b)}`);

  // 확대 12 : 보드게임도 카페도 안 그려진다 → 확대 안내
  await view(p, CL, 12);
  { const d = await dots(p);
    ok('확대 12: 보드게임·카페 점이 모두 없고 "지도를 확대하면 장소가 보입니다"가 뜬다', d.bg === 0 && d.cafe === 0 && (await hint(p)) === '지도를 확대하면 장소가 보입니다', JSON.stringify(d) + ' ' + (await hint(p))); }
  // 확대 13~14 : 보드게임만
  await view(p, CL, 14);
  { const d = await dots(p), e = await expectBg(p, bgData.r);
    ok('확대 14: 보드게임 점만 보이고(점 수 = 보이는 범위의 자료 수) 카페 점은 없다', d.bg === e && e >= BG.length && d.cafe === 0, JSON.stringify(d) + ' 기대 ' + e);
    ok('확대 14 안내: "커피 카페는 더 확대하면 보입니다"', (await hint(p)) === '커피 카페는 더 확대하면 보입니다', await hint(p));
    ok('점 색은 보라(#5d4fa8) 하나이고 카페(갈색)와 다르다', Object.keys(d.bgc).length === 1 && d.bgc['#5d4fa8'] === d.bg, JSON.stringify(d.bgc)); }
  await view(p, CL, 13);
  { const d = await dots(p); ok('확대 13에서도 보드게임 점이 보인다(최소 확대 13)', d.bg > 0 && d.cafe === 0, JSON.stringify(d)); }
  // 확대 15: 둘 다, 안내 없음
  await view(p, CL, 15);
  { const d = await dots(p), e = await expectBg(p, bgData.r);
    ok('확대 15: 보드게임 점과 카페 점이 함께 그려지고 안내 문구는 없다', d.bg === e && d.cafe > 0 && (await hint(p)) === '', JSON.stringify(d) + ' ' + (await hint(p)));
    ok('두 층의 색이 다르다(카페 #8a5a3c / 보드게임 #5d4fa8)', d.cafec['#8a5a3c'] === d.cafe && d.bgc['#5d4fa8'] === d.bg); }
  await p.screenshot({ path: '/tmp/map10shots/duo-both.png' });

  // 카드
  await tapAt(p, BG[0][2], BG[0][3], 17);
  { const t = await txt(p, '#mp-card'), d = await dots(p);
    ok('보드게임 점을 누르면 카드에 이름·주소가 있고 "보드게임 카페 · 공공데이터(상가정보) 2026-10 기준"이 나온다', (await cardName(p)) === BG[0][0] && t.includes(BG[0][1]) && t.includes('보드게임 카페 · 공공데이터(상가정보) 2026-10 기준') && t.includes('영업 여부·시간은 지도 앱에서 확인'), t.slice(0, 140));
    ok('선택하면 고리(반지름 12)가 하나 생긴다', d.ring === 1, JSON.stringify(d)); }
  ok('카드 단추 = 길찾기·내 장소로 추가 두 개(v61)', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-lk')].map((x) => x.textContent))) === JSON.stringify(['길찾기', '내 장소로 추가']));
  // 카페 점 → 카드가 카페로 바뀌고 보드게임 고리는 사라진다
  await tapAt(p, CAFES[1][3], CAFES[1][4], 17);
  { const d = await dots(p);
    ok('카페 점을 누르면 카드가 카페로 바뀌고 고리는 하나만 남는다(보드게임 선택은 풀림)', (await cardName(p)) === CAFES[1][1] && d.ring === 1 && (await txt(p, '#mp-card')).includes('스타벅스 매장'), String(await cardName(p)) + ' ' + JSON.stringify(d)); }
  await tapAt(p, BG[2][2], BG[2][3], 17);
  { const d = await dots(p);
    ok('다시 보드게임 점을 누르면 카드가 보드게임으로 바뀌고 고리 하나', (await cardName(p)) === BG[2][0] && d.ring === 1 && !(await txt(p, '#mp-card')).includes('스타벅스'), String(await cardName(p)) + ' ' + JSON.stringify(d)); }
  // 내 장소 점(핀) → 카드가 내 장소로, 보드게임 고리 사라짐
  await p.evaluate(() => { document.querySelector('#mp-card .mp-c-x').click(); }); await sleep(250);
  ok('카드의 ✕ 를 누르면 카드가 닫히고 고리가 사라진다', (await cardName(p)) === null && (await dots(p)).ring === 0);
  // 같은 건물에 겹친 보드게임 카페끼리: 카드에서 나머지를 고른다
  await tapAt(p, OV[0][2], OV[0][3], 19);
  { const first = await cardName(p), names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent)), t = await txt(p, '#mp-card');
    ok('겹친 자리를 누르면 "같은 자리 근처 보드게임 카페 2곳"(15m 안: 같은 좌표 1곳 + 약 12m 1곳)이 뜨고 40m 떨어진 곳은 없다', OV.slice(0, 3).some((x) => x[0] === first) && names.length === 2 && !names.includes(first) && !names.includes('떨어진 보드게임') && t.includes('같은 자리 근처 보드게임 카페 2곳'), first + ' | ' + names.join(',')); 
    const before = first; await p.evaluate(() => document.querySelector('#mp-card .mp-nb').click()); await sleep(300);
    const after = await cardName(p), n2 = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    ok('이름 단추를 누르면 카드가 그 곳으로 바뀌고(고리 1개) 나머지 두 곳이 다시 나온다', !!after && after !== before && OV.slice(0, 3).some((x) => x[0] === after) && n2.length === 2 && !n2.includes(after) && (await dots(p)).ring === 1, before + ' → ' + after + ' | ' + n2.join(',')); }
  await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-c-x'); if (x) x.click(); }); await sleep(250);
  await tapAt(p, BG[0][2], BG[0][3], 19);
  ok('겹친 곳이 없는 점의 카드에는 "같은 자리" 줄이 없다', !(await txt(p, '#mp-card')).includes('같은 자리 근처'));
  await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-c-x'); if (x) x.click(); }); await sleep(250);
  // 같은 좌표에 겹친 카페와 보드게임: 보드게임이 위
  await tapAt(p, BG[4][2], BG[4][3], 18);
  ok('같은 자리에 카페와 보드게임이 겹쳐 있으면 위에 있는 보드게임이 눌린다', (await cardName(p)) === BG[4][0], String(await cardName(p)));

  // 내 장소로 추가
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="add"]').click()); await sleep(600);
  { const f = await p.evaluate(() => ({ title: document.querySelector('#mp-ftitle').textContent, name: document.querySelector('#mp-f-name').value, addr: document.querySelector('#mp-f-addr').value }));
    ok('"내 장소로 추가"하면 양식이 이름·주소로 미리 채워진다', f.title === '장소 추가' && f.name === BG[4][0] && f.addr === BG[4][1], JSON.stringify(f)); }
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  { const added = (await stored(p)).find((x) => x.name === BG[4][0]);
    ok('저장하면 내 장소로 들어간다(위치 = 보드게임 카페 자리, 색 0)', !!added && Math.abs(added.lat - BG[4][2]) < 1e-6 && Math.abs(added.lng - BG[4][3]) < 1e-6 && added.col === 0, JSON.stringify(added)); }
  await tapAt(p, BG[4][2], BG[4][3], 18);
  ok('그 자리는 이제 내 장소 핀이 위에 있어 눌러 보면 내 장소 카드(수정 단추)가 뜬다', (await cardName(p)) === BG[4][0] && (await p.evaluate(() => !!document.querySelector('#mp-card .mp-lk[data-o="edit"]'))), String(await cardName(p)));
  await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-c-x'); if (x) x.click(); }); await sleep(250);
  await tapAt(p, BG[5][2], BG[5][3], 18);
  { const lab = await p.evaluate(() => { const e = document.querySelector('#mp-card .mp-lk[data-o="add"]'); return e ? e.textContent : null; });
    ok('다른 보드게임 카페(Board Game Dice)는 아직 "내 장소로 추가"', (await cardName(p)) === BG[5][0] && lab === '내 장소로 추가', String(lab)); }

  // 끄기 · 켜기 (카페가 보이는 화면으로 옮겨 놓고 끈다)
  await view(p, CL, 16);
  await p.click('#mp-bg'); await sleep(500);
  { const d = await dots(p), st = await btnState(p, '#mp-bg');
    ok('끄면 보드게임 점·열린 카드가 사라지고 단추가 꺼진 모양이며 저장된다', d.bg === 0 && d.ring === 0 && (await cardName(p)) === null && st.on === false && st.pressed === 'false' && (await lsGet(p, 'bf.mapbg')) === 'off', JSON.stringify(d) + JSON.stringify(st) + ' ' + (await lsGet(p, 'bf.mapbg')));
    ok('끄면 카페 점은 그대로이고 검은 알림은 뜨지 않는다(v63)', d.cafe > 0 && !(await p.evaluate(() => document.body.textContent.includes('표시를 껐습니다'))), JSON.stringify(d)); }
  await view(p, CL, 14);
  ok('보드게임을 끈 채 확대 14: "지도를 확대하면 장소가 보입니다"(카페만 멀어서 안 보임)', (await hint(p)) === '지도를 확대하면 장소가 보입니다', await hint(p));
  await p.click('#mp-bg'); await sleep(500);
  { const d = await dots(p), st = await btnState(p, '#mp-bg');
    ok('다시 켜면 점이 돌아오고 단추가 켜진 모양이며 저장값이 on', d.bg > 0 && st.on === true && (await lsGet(p, 'bf.mapbg')) === 'on', JSON.stringify(d)); }
  // 카페 끄기 — 보드게임은 그대로
  await view(p, CL, 15);
  await p.click('#mp-br'); await sleep(500);
  { const d = await dots(p);
    ok('카페를 끄면 카페 점만 사라지고 보드게임 점은 그대로다', d.cafe === 0 && d.bg > 0, JSON.stringify(d)); }
  await tapAt(p, BG[1][2], BG[1][3], 17);
  await p.click('#mp-br'); await sleep(500);   // 카페를 다시 켜도 열려 있는 보드게임 카드는 그대로
  ok('보드게임 카드를 연 채 카페를 켜고 꺼도 그 카드는 닫히지 않는다', (await cardName(p)) === BG[1][0], String(await cardName(p)));
  await p.click('#mp-br'); await sleep(500);
  ok('(카페 끄기) 보드게임 카드가 그대로다', (await cardName(p)) === BG[1][0] && (await dots(p)).ring === 1, String(await cardName(p)));
  await p.click('#mp-br'); await sleep(400);
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== A2. 저장된 꺼짐 상태로 열기 =====
{
  console.log('===== A2. 꺼 둔 채로 열기');
  const { p, errs } = await openDev(DUO, { cfg: { bgOff: true } });
  await view(p, CL, 15);
  const st = await btnState(p, '#mp-bg'), d = await dots(p);
  ok('저장된 값이 off 이면 단추가 꺼진 모양이고 보드게임 점이 없다(카페는 있다)', st.on === false && st.pressed === 'false' && !st.hidden && d.bg === 0 && d.cafe > 0, JSON.stringify(st) + JSON.stringify(d));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== B. 테마 · 서울 밖 · 아주 많을 때 =====
for (const [theme, col] of [['sepia', '#5b4a8c'], ['night', '#b4a6f2']]) {
  console.log('===== B. ' + theme);
  const { p, errs } = await openDev(DUO, { cfg: { theme } });
  await view(p, CL, 15);
  const d = await dots(p);
  ok(theme + ': 보드게임 점 색 ' + col, d.bg > 0 && d.bgc[col] === d.bg, JSON.stringify(d.bgc));
  await p.screenshot({ path: `/tmp/map10shots/duo-${theme}.png` });
  ok(theme + ': 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
{
  console.log('===== B2. 서울 밖');
  const bgOut = { ...bgData, r: [...bgData.r, BUSAN_BG] };
  const { p, errs } = await openDev(DUO, { bg: bgOut, cfg: { cafeOff: true } });
  await view(p, [35.1580, 129.0600], 14);
  ok('서울 밖(부산) 확대 14: 안내 "보드게임 카페는 서울만 담겨 있습니다"', (await hint(p)) === '보드게임 카페는 서울만 담겨 있습니다', await hint(p));
  await view(p, CL, 14);
  ok('서울 안으로 돌아오면 안내가 사라진다', (await hint(p)) === '', await hint(p));
  await p.close();
  const o2 = await openDev(DUO, { bg: bgOut });
  await view(o2.p, [35.1580, 129.0600], 15);
  ok('카페 층이 켜져 있으면 카페 쪽 안내가 먼저 나온다("서울 밖에서는 스타벅스 매장만 …")', /서울 밖에서는/.test(await hint(o2.p)), await hint(o2.p));
  await o2.p.close();
}
{
  console.log('===== B3. 아주 많을 때(800곳)');
  const { p, errs } = await openDev(DUO, { bg: manyBG, cfg: { cafeOff: true } });
  await view(p, [37.5178, 127.1038], 16);
  const d = await dots(p);
  ok('800곳이 보이는 범위에 있으면 600곳까지만 그리고 안내 문구가 나온다', d.bg === 600 && (await hint(p)).startsWith('보드게임 카페가 많아 가운데에서 가까운 600곳만'), d.bg + ' ' + (await hint(p)));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== C. 아이폰 세로 =====
{
  console.log('===== C. 아이폰 세로');
  const { p, errs } = await openDev(PH);
  await p.evaluate(() => { const t = document.querySelector('.mp-tabs button[data-t="r"]'); if (t) t.click(); }); await sleep(900);
  const b2 = await rect(p, '#mp-bg'), r2 = await rect(p, '#mp-br'), m2 = await rect(p, '.mp-me'), w2 = await rect(p, '.mp-mapwrap'), z2 = await rect(p, '.leaflet-control-zoom');
  ok('(좁은 화면) 지도 탭: 단추 3개가 위에서 아래로 나란히(내 위치 → 카페 → 주사위) 겹치지 않고 지도 안에 있다', b2 && r2 && m2 && b2.t > r2.t && r2.t > m2.t && !overlap(b2, r2) && !overlap(b2, m2) && !overlap(b2, z2) && Math.abs(b2.l - r2.l) <= 1 && b2.t - r2.b >= 3 && b2.t - r2.b <= 16 && b2.r <= w2.r && b2.b <= w2.b, JSON.stringify([m2.t, r2.t, b2.t].map(Math.round)));
  await view(p, CL, 15);
  const d = await dots(p);
  ok('(좁은 화면) 점이 그려진다', d.bg > 0 && d.cafe > 0, JSON.stringify(d));
  await tapAt(p, BG[3][2], BG[3][3], 17);
  ok('(좁은 화면) 점을 누르면 카드가 뜬다', (await cardName(p)) === BG[3][0], String(await cardName(p)));
  await p.screenshot({ path: '/tmp/map10shots/phone.png' });
  ok('(좁은 화면) 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== E. 실제 자료(www/data/boardgame.json, www/data/cafes.json) =====
if (fs.existsSync(new URL('../www/data/boardgame.json', import.meta.url))) {
  console.log('===== E. 실제 보드게임 자료');
  const real = JSON.parse(fs.readFileSync(new URL('../www/data/boardgame.json', import.meta.url), 'utf8'));
  const rows = real.r;
  const { p, errs } = await openDev(DUO, { bgMode: 'real', cfg: { cafeOff: true } });
  ok('실제 자료: 형식 v1 · 서울 · 144곳 안팎이고 모든 행에 이름·주소·위도·경도가 있다', real.v === 1 && real.full[0] === '서울' && rows.length > 50 && rows.every((r) => r[0] && r[1] && Number.isFinite(r[2]) && Number.isFinite(r[3])), rows.length + '곳');
  ok('주사위 단추가 보이고 켜져 있다', (await shown(p, '#mp-bg')) && (await btnState(p, '#mp-bg')).on === true);
  // 서울 한복판(확대 14)에서 보이는 점 수 = 자료의 그 범위 수
  await view(p, [37.5400, 127.0000], 14);
  { const d = await dots(p), e = await expectBg(p, rows);
    ok('서울 가운데(확대 14): 점 수가 자료의 보이는 범위 수와 같다 · 안내 없음', d.bg === e && e > 20 && (await hint(p)) === '', d.bg + ' / ' + e + ' ' + (await hint(p)));
    await p.screenshot({ path: '/tmp/map10shots/real-seoul.png' }); }
  // 같은 좌표에 겹친 곳(자료에서 찾는다)도 카드에서 모두 고를 수 있다
  const dm = (a, c) => Math.hypot((a[2] - c[2]) * 111320, (a[3] - c[3]) * 111320 * Math.cos(a[2] * Math.PI / 180));
  const groups = []; const seenG = new Set();
  rows.forEach((r, i) => { const g = [i]; rows.forEach((q, j) => { if (j !== i && dm(r, q) <= 15) g.push(j); }); if (g.length > 1) { const k = [...g].sort((x, y) => x - y).join(','); if (!seenG.has(k)) { seenG.add(k); groups.push(g); } } });
  ok('실제 자료에 15m 안에 겹친 곳이 있다(시험할 대상)', groups.length >= 1, groups.length + '묶음');
  for (const g of groups.slice(0, 6)) {
    await tapAt(p, rows[g[0]][2], rows[g[0]][3], 19);
    const first = await cardName(p), names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    const all = new Set([first, ...names]);
    ok('겹친 ' + g.length + '곳(' + rows[g[0]][0] + ' 등): 카드와 같은 자리 단추로 모두 고를 수 있다', g.every((i) => all.has(rows[i][0])), [...all].join(' | '));
  }
  // 표본: 아무 보드게임 점이나 눌러 카드 이름이 맞는지(앞 12곳)
  let good = 0, tried = 0;
  for (const i of [0, 13, 29, 41, 57, 66, 77, 88, 99, 111, 125, 140].filter((x) => x < rows.length)) {
    tried++; await tapAt(p, rows[i][2], rows[i][3], 19);
    const nm = await cardName(p), nb = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    if (nm === rows[i][0] || nb.includes(rows[i][0])) good++;
  }
  ok('표본 ' + tried + '곳: 눌러 보면 모두 그 카페 카드(또는 같은 자리 단추 안)로 간다', good === tried, good + '/' + tried);
  ok('실제 자료: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== D. 자료 없음 / 깨짐 =====
{
  console.log('===== D. 자료 없음(404)');
  const { p, errs } = await openDev(DUO, { bgMode: 'none' });
  await view(p, CL, 14);
  ok('자료가 없으면 주사위 단추가 숨겨진다', !(await shown(p, '#mp-bg')));
  ok('자료가 없어도 안내는 카페 층 것 그대로("지도를 확대하면 장소가 보입니다") · 오류 안내 없음', (await hint(p)) === '지도를 확대하면 장소가 보입니다', await hint(p));
  await view(p, CL, 15);
  { const d = await dots(p); ok('카페 점은 그대로 그려지고 보드게임 점은 없다', d.cafe > 0 && d.bg === 0, JSON.stringify(d)); }
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
{
  console.log('===== D2. 자료 깨짐');
  const { p, errs } = await openDev(DUO, { bgMode: 'bad' });
  await view(p, CL, 15);
  ok('자료가 깨졌으면 "보드게임 카페 자료를 불러오지 못했습니다."가 뜬다', (await hint(p)) === '보드게임 카페 자료를 불러오지 못했습니다.', await hint(p));
  { const d = await dots(p); ok('카페 점은 그대로 그려진다', d.cafe > 0 && d.bg === 0, JSON.stringify(d)); }
  ok('오류(앱 코드) 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
await b.close();
console.log(fails ? 'FAILS ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
