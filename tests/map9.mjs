// v57 — 카페 층(서울 모든 카페) + 종류 걸러 보기(전체/프랜차이즈/개인) + 내 장소 핀 색.
//   A. 새 형식 data/cafes.json(v2): 모든 점이 같은 색 · 개인/프랜차이즈 카드 · 걸러 보기(저장·열었을 때 유지) · 서울 밖 안내 · 켜기/끄기와 알약 · 개인 카페 → 내 장소 추가
//   B. 내 장소 핀 색: 입력 화면의 색 고르기 · 저장 · 핀/목록/카드 색 · 선택했을 때 · 수정 · 예전 저장(색 없음)·잘못된 값 · 야간 테마
//   C. 아이폰 세로, D. 자료 깨짐/없음, E. 점이 아주 많을 때(걸리는 시간 기록)
// 사용: node map9.mjs   (스크린샷은 /tmp/map9shots/). 카페 자료는 시험용 가짜를 요청 가로채기로 넣는다.
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8973); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map9shots', { recursive: true });

function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])), 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);

// ---- 시험용 가짜 카페 자료(v2) ----
const BR = ['스타벅스', '투썸플레이스', '할리스'];
const FR = [];
for (let i = 0; i < 4; i++) FR.push([0, `스타벅스 시험${i + 1}점`, `서울 강동구 시험로 ${i + 1}`, +(37.5260 + Math.floor(i / 2) * 0.0030).toFixed(5), +(127.1180 + (i % 2) * 0.0030).toFixed(5)]);
for (let j = 0; j < 3; j++) FR.push([1, `투썸플레이스 시험${j + 1}점`, `서울 강동구 시험대로 ${j + 1}`, 37.5350, +(127.1180 + j * 0.0030).toFixed(5)]);
for (let k = 0; k < 2; k++) FR.push([2, `할리스 시험${k + 1}점`, `서울 강동구 시험길 ${k + 1}`, 37.5300, +(127.1280 + k * 0.0030).toFixed(5)]);
const IND = [];
for (let i = 0; i < 6; i++) IND.push([-1, `시험개인${i + 1}`, `서울 강동구 개인로 ${i + 1}`, +(37.5210 + Math.floor(i / 3) * 0.0030).toFixed(5), +(127.1180 + (i % 3) * 0.0030).toFixed(5)]);
const BUSAN = [[0, '스타벅스 부산시험점', '부산 부산진구 시험로 9', 35.1577, 129.0590], [1, '투썸플레이스 부산시험점', '부산 부산진구 시험로 10', 35.1590, 129.0610]];
const BB = [37.42, 126.76, 37.70, 127.19];
// 같은 건물에 겹친 카페 3곳(프랜차이즈 1 + 개인 2, 모두 3m 안) — 따로 떨어진 곳에 둔다
const GP = [37.5600, 127.0900];
const GRP = [[2, '할리스 겹침점', '서울 시험구 겹침로 1', GP[0], GP[1]], [-1, '겹침개인가', '서울 시험구 겹침로 1', +(GP[0] + 0.00002).toFixed(5), GP[1]], [-1, '겹침개인나', '서울 시험구 겹침로 1', GP[0], +(GP[1] + 0.00003).toFixed(5)]];
// 한 점에 12곳이 완전히 겹친 건물(실제 자료에는 31곳이 겹친 곳도 있다)
const SP = [37.5500, 127.0800];
const STK = []; for (let i = 0; i < 12; i++) STK.push([i % 4 === 0 ? 1 : -1, `${i % 4 === 0 ? '투썸플레이스 ' : '쌓임개인'}${i + 1}`, '서울 시험구 쌓임로 1', SP[0], SP[1]]);
const v2 = { v: 2, src: '시험용', asof: '2026-10', b: BR, full: ['서울'], bb: BB, r: [...FR, ...IND, ...GRP, ...STK, ...BUSAN] };
const dense = { v: 2, src: '시험용', asof: '2026-10', b: BR, full: ['서울'], bb: BB, r: [...FR, ...IND] };
for (let k = 0; k < 3000; k++) dense.r.push([-1, `밀집개인${k}`, '서울 시험', +(37.4900 + (k % 60) * 0.0003).toFixed(5), +(127.0400 + Math.floor(k / 60) * 0.0003).toFixed(5)]);
for (let k = 0; k < 1100; k++) dense.r.push([k % 3, `${BR[k % 3]} 밀집${k}점`, '서울 시험', +(37.4900 + (k % 33) * 0.0004).toFixed(5), +(127.0400 + Math.floor(k / 33) * 0.0004).toFixed(5)]);

const seed = { fn: (cfg) => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.mapeng', 'raster'); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places));
    if (cfg && cfg.theme) localStorage.setItem('bf.settings', JSON.stringify({ theme: cfg.theme }));
    if (cfg && cfg.off) localStorage.setItem('bf.mapbrand', 'off');
    if (cfg && cfg.filt) localStorage.setItem('bf.mapbrandf', cfg.filt); }
} };
const MINE = { id: 'p1', name: '스타벅스 내가 등록', lat: 37.5400, lng: 127.1300, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', ts: 1 };      // 예전 저장(색 없음)
const MINE2 = { id: 'p2', name: '가나 카페', lat: 37.5330, lng: 127.1100, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', col: 3, ts: 2 };   // 노랑
const MINE3 = { id: 'p3', name: '잘못된 색 카페', lat: 37.5450, lng: 127.1050, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', col: 99, ts: 3 };   // 범위 밖 → 기본
async function openDev(dev, { data = v2, mode = 'ok', cfg = {}, places = [MINE, MINE2, MINE3] } = {}) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url();
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.endsWith('/data/cafes.json')) { if (mode === 'ok') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }); else if (mode === 'none') r.respond({ status: 404, body: 'x' }); else r.respond({ status: 200, contentType: 'application/json', body: '{"r": oops' }); }
    else if (u.endsWith('/data/brandcafes.json')) r.respond({ status: 404, body: 'x' });
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await p.evaluateOnNewDocument(seed.fn, { places, ...cfg });
  await p.goto('http://localhost:8973/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
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
const dots = (p) => p.evaluate(() => { const o = { dot: 0, ring: 0, c: {} }; window.__mpMap.eachLayer((l) => { if (!l.options || l.options.renderer === undefined || !l._latlng) return; const r = l.options.radius; if (r === 6.5) { o.dot++; o.c[l.options.fillColor] = (o.c[l.options.fillColor] || 0) + 1; } else if (r === 12) o.ring++; }); return o; });
// 지금 보이는 범위(+40%) 안에서, 종류(f: all|fr|ind)에 맞는 카페 수를 자료에서 직접 센다
const expectIn = (p, data, f = 'all') => p.evaluate((rows, ff) => { const bb = window.__mpMap.getBounds().pad(0.4); return rows.filter((r) => bb.contains([r[3], r[4]]) && (ff === 'fr' ? r[0] >= 0 : ff === 'ind' ? r[0] < 0 : true)).length; }, data.r, f);
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bf.places') || '[]'));
const pillState = (p) => p.evaluate(() => [...document.querySelectorAll('#mp-bf button')].map((x) => x.textContent + (x.classList.contains('on') ? '*' : '') + (x.getAttribute('aria-pressed') === 'true' ? '+' : '')).join(' '));
const fillOf = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fill : null; }, sel);
const bgOf = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; }, sel);

const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }], PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];
const CL = [37.5285, 127.1215];   // 가짜 카페들이 모여 있는 가운데
const view = async (p, c, z) => { await p.evaluate((la, lo, zz) => { window.__mpMap.setView([la, lo], zz, { animate: false }); }, c[0], c[1], z); await sleep(600); };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

// ===== A. 듀오 펼침 · 새 형식 자료 =====
{
  console.log('===== A. 듀오 펼침 · 카페 자료(v2)');
  const { p, errs } = await openDev(DUO);
  const br = await rect(p, '#mp-br'), me = await rect(p, '.mp-me'), zo = await rect(p, '.leaflet-control-zoom'), mw = await rect(p, '.mp-mapwrap'), bf = await rect(p, '#mp-bf');
  ok('종류 걸러 보기 알약이 보이고 버튼은 "전체 · 프랜차이즈 · 개인", 기본은 "전체"', (await shown(p, '#mp-bf')) && (await pillState(p)) === '전체*+ 프랜차이즈 개인', await pillState(p));
  ok('알약이 카페 단추의 왼쪽에 같은 높이로 붙고, 내 위치·확대 단추와 겹치지 않으며 지도 안에 있다', bf && Math.abs(bf.t - br.t) <= 1 && Math.abs(bf.b - br.b) <= 1 && bf.r <= br.l && br.l - bf.r <= 12 && bf.l >= mw.l && bf.t >= zo.b && bf.t >= me.b + 3, `bf ${Math.round(bf.l)}~${Math.round(bf.r)}/${Math.round(bf.t)} · br ${Math.round(br.l)}/${Math.round(br.t)}`);
  await view(p, CL, 15);   // 카페들이 모인 가운데를 확대 15로
  { const d = await dots(p), e = await expectIn(p, v2, 'all');
    ok('"전체": 프랜차이즈와 개인 카페가 모두 그려지고 점 수 = 보이는 범위의 카페 수(자료의 서울 카페 15곳 전부)', d.dot === e && e === FR.length + IND.length, JSON.stringify(d.c) + ' 기대 ' + e);
    ok('모든 점이 같은 색(커피색 #8a5a3c) 하나다', Object.keys(d.c).length === 1 && d.c['#8a5a3c'] === d.dot, JSON.stringify(d.c)); }
  await p.screenshot({ path: '/tmp/map9shots/duo-all.png' });

  // 카드: 프랜차이즈 / 개인
  await tapAt(p, FR[0][3], FR[0][4], 16);
  const fr0 = await cardName(p);
  ok('프랜차이즈 점을 누르면 카드에 브랜드 이름이 있다', fr0 === FR[0][1] && (await txt(p, '#mp-card')).includes('스타벅스 매장 · 공공데이터') && !(await txt(p, '#mp-card')).includes('개인 카페'), String(fr0));
  await tapAt(p, IND[1][3], IND[1][4], 16);
  ok('개인 카페 점을 누르면 카드가 "개인 카페 · 공공데이터(상가정보) 2026-10 기준"이고 주소가 있다', (await cardName(p)) === IND[1][1] && (await txt(p, '#mp-card')).includes('개인 카페 · 공공데이터(상가정보) 2026-10 기준') && (await txt(p, '#mp-card')).includes(IND[1][2]), (await txt(p, '#mp-card') || '').slice(0, 120));
  { const col = await bgOf(p, '#mp-card .mp-bd'); ok('카드의 점 색도 같은 커피색', col === rgb('#8a5a3c'), col); }
  ok('카드 단추 = 네이버·애플·구글·내 장소로 추가', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-lk')].map((x) => x.textContent))) === JSON.stringify(['네이버 지도', '애플 지도', '구글 지도', '내 장소로 추가']));

  // 걸러 보기: 프랜차이즈
  await p.click('#mp-bf button[data-f="fr"]'); await sleep(500);
  ok('걸러져서 사라진 개인 카페의 카드는 함께 닫힌다(고리도 없다)', (await cardName(p)) === null && (await dots(p)).ring === 0);
  await view(p, CL, 15);
  { const d = await dots(p), e = await expectIn(p, v2, 'fr');
    ok('"프랜차이즈"를 누르면 개인 카페 점이 사라지고 점 수 = 프랜차이즈 수(9곳)', d.dot === e && e === FR.length && (await pillState(p)) === '전체 프랜차이즈*+ 개인' && await p.evaluate(() => localStorage.getItem('bf.mapbrandf') === 'fr'), `${d.dot}/${e} ` + await pillState(p)); }
  await tapAt(p, FR[4][3], FR[4][4], 16);
  ok('프랜차이즈만 보는 중에도 프랜차이즈 점은 눌린다(카드 브랜드)', (await cardName(p)) === FR[4][1] && (await txt(p, '#mp-card')).includes('투썸플레이스 매장'), String(await cardName(p)));
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(500);
  ok('"개인"으로 바꾸면 프랜차이즈 카드는 닫힌다', (await cardName(p)) === null);
  await view(p, CL, 15);
  ok('"개인": 점은 개인 카페만(6곳)', (await dots(p)).dot === (await expectIn(p, v2, 'ind')) && (await dots(p)).dot === IND.length, JSON.stringify(await dots(p)) + ' 기대 ' + await expectIn(p, v2, 'ind'));
  await p.screenshot({ path: '/tmp/map9shots/duo-ind.png' });
  await tapAt(p, IND[4][3], IND[4][4], 16);
  ok('개인만 보는 중에 개인 카페 점이 눌린다', (await cardName(p)) === IND[4][1], String(await cardName(p)));
  await p.click('#mp-bf button[data-f="all"]'); await sleep(400);
  ok('"전체"를 누르면 선택한 카드는 그대로 남는다(보이는 종류이므로)', (await cardName(p)) === IND[4][1] && (await dots(p)).ring === 1);

  // 같은 건물에 겹친 카페: 맨 위 한 곳이 눌리고, 카드에서 나머지를 고른다
  await tapAt(p, GP[0], GP[1], 18);
  { const t = await txt(p, '#mp-card'), names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent)), first = await cardName(p);
    ok('겹친 자리를 누르면 카드에 "같은 자리 근처 카페 2곳"과 나머지 두 곳의 이름 단추가 있다', GRP.some((g) => g[1] === first) && t.includes('같은 자리 근처 카페 2곳') && names.length === 2 && !names.includes(first) && GRP.filter((g) => g[1] !== first).every((g) => names.includes(g[1])), first + ' | ' + names.join(',')); }
  { const before = await cardName(p); await p.evaluate(() => document.querySelector('#mp-card .mp-nb').click()); await sleep(300);
    const after = await cardName(p), names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    ok('이름 단추를 누르면 카드가 그 카페로 바뀌고(고리 1개), 새 카드에도 나머지 두 곳이 나온다', after && after !== before && GRP.some((g) => g[1] === after) && names.length === 2 && !names.includes(after) && (await dots(p)).ring === 1, before + ' → ' + after + ' | ' + names.join(',')); }
  // 한 점에 12곳이 겹친 건물: 나머지 11곳이 모두 단추로 나오고(카드 안에서 스크롤), 어느 것을 눌러도 나머지 11곳이 나온다
  await tapAt(p, SP[0], SP[1], 18);
  { const info = await p.evaluate(() => { const n = document.querySelector('#mp-card .mp-c-near'); return n ? { cnt: n.querySelectorAll('.mp-nb').length, h: Math.round(n.getBoundingClientRect().height), sh: n.scrollHeight, text: n.textContent.slice(0, 20) } : null; }), first = await cardName(p);
    ok('12곳이 한 점에 겹쳐 있으면 "같은 자리 근처 카페 11곳"과 단추 11개가 나온다(내용이 길면 그 줄 안에서 스크롤)', !!info && info.cnt === 11 && info.text.startsWith('같은 자리 근처 카페 11곳') && info.h <= 100, JSON.stringify(info) + ' ' + first); }
  { const seen = new Set([await cardName(p)]); for (let k = 0; k < 11; k++) { const nm = await p.evaluate((seenArr) => { const b = [...document.querySelectorAll('#mp-card .mp-nb')].find((x) => !seenArr.includes(x.textContent)); if (!b) return null; b.click(); return b.textContent; }, [...seen]); await sleep(120); if (!nm) break; seen.add(await cardName(p)); }
    ok('단추를 차례로 눌러 겹친 12곳 모두를 한 번씩 볼 수 있다(빠지는 곳이 없다)', seen.size === 12 && [...seen].every((n) => STK.some((x) => x[1] === n)), [...seen].length + '곳'); }
  await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-c-x'); if (x) x.click(); }); await sleep(200);   // 긴 카드가 지도 가운데를 가리지 않게 닫는다
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(400);
  await tapAt(p, GP[0], GP[1], 18);
  { const names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    ok('"개인"만 보는 중에는 같은 자리 목록에 프랜차이즈(할리스 겹침점)가 빠진다', GRP.slice(1).some((g) => g[1] === (null)) === false && names.length === 1 && !names.includes('할리스 겹침점'), names.join(',')); }
  await p.click('#mp-bf button[data-f="all"]'); await sleep(400);
  { const nm = await cardName(p), names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    ok('카드를 연 채 "전체"로 바꾸면 같은 카페 카드가 남고, 같은 자리 목록이 2곳(할리스 포함)으로 다시 그려진다', !!nm && GRP.slice(1).some((g) => g[1] === nm) && names.length === 2 && names.includes('할리스 겹침점') && (await dots(p)).ring === 1, nm + ' | ' + names.join(',')); }
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(400);
  { const names = await p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-nb')].map((x) => x.textContent));
    ok('카드를 연 채 "개인"으로 바꾸면 같은 자리 목록에서 프랜차이즈가 다시 빠진다', names.length === 1 && !names.includes('할리스 겹침점'), names.join(',')); }
  await p.click('#mp-bf button[data-f="all"]'); await sleep(400);
  await p.evaluate(() => { const x = document.querySelector('#mp-card .mp-c-x'); if (x) x.click(); }); await sleep(200);
  await tapAt(p, FR[3][3], FR[3][4], 18);
  ok('겹친 카페가 없는 점의 카드에는 "같은 자리" 줄이 없다', !(await txt(p, '#mp-card')).includes('같은 자리 근처'));
  await p.evaluate(() => { document.querySelector('#mp-card .mp-c-x') && document.querySelector('#mp-card .mp-c-x').click(); }); await sleep(200);

  // 서울 밖
  await p.evaluate((la, lo) => { window.__mpMap.setView([la, lo], 16, { animate: false }); }, BUSAN[0][3], BUSAN[0][4]); await sleep(600);
  { const h = (await txt(p, '#mp-bhint') || '').trim();
    ok('"전체"로 서울 밖(부산)을 보면 안내가 뜨고 그 안에 브랜드 이름이 있다(서울 밖에서는 …만 보입니다)', (await shown(p, '#mp-bhint')) && h.startsWith('서울 밖에서는 스타벅스·투썸플레이스 매장만 보입니다') && h.includes('개인 카페는 서울만'), h);
    ok('부산에서도 스타벅스·투썸 점은 그려진다', (await dots(p)).dot === (await expectIn(p, v2, 'all')) && (await dots(p)).dot >= 2, JSON.stringify(await dots(p))); }
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(500);
  ok('"개인"으로 서울 밖을 보면 "개인 카페는 서울만 담겨 있습니다"이고 점은 0개', (await shown(p, '#mp-bhint')) && (await txt(p, '#mp-bhint')).trim() === '개인 카페는 서울만 담겨 있습니다' && (await dots(p)).dot === 0, await txt(p, '#mp-bhint'));
  await p.click('#mp-bf button[data-f="fr"]'); await sleep(500);
  ok('"프랜차이즈"로 서울 밖을 보면 안내 없이 점만 보인다', !(await shown(p, '#mp-bhint')) && (await dots(p)).dot >= 2);
  await p.click('#mp-bf button[data-f="all"]'); await sleep(300);
  await p.evaluate((la, lo) => { window.__mpMap.setView([la, lo], 16, { animate: false }); }, FR[0][3], FR[0][4]); await sleep(600);
  ok('서울 안에서는 안내가 없다', !(await shown(p, '#mp-bhint')));
  await p.evaluate(() => window.__mpMap.setZoom(13, { animate: false })); await sleep(500);
  ok('멀리(확대 13) 보면 점은 0개, 안내는 "지도를 확대하면 장소가 보입니다", 알약은 그대로 보인다', (await dots(p)).dot === 0 && (await txt(p, '#mp-bhint')).trim() === '지도를 확대하면 장소가 보입니다' && (await shown(p, '#mp-bf')));
  await p.evaluate(() => window.__mpMap.setZoom(14, { animate: false })); await sleep(500);
  ok('확대 14에서도 아직 점이 없다(기준은 15)', (await dots(p)).dot === 0);
  await p.evaluate(() => window.__mpMap.setZoom(15, { animate: false })); await sleep(500);
  ok('확대 15에서 점이 나타난다', (await dots(p)).dot > 0 && !(await shown(p, '#mp-bhint')));

  // 켜기/끄기와 알약
  await p.click('#mp-br'); await sleep(400);
  ok('카페를 끄면 알약도 사라진다(알림도 뜬다)', !(await shown(p, '#mp-bf')) && (await dots(p)).dot === 0 && !(await shown(p, '#mp-bhint')));
  await p.click('#mp-br'); await sleep(500);
  ok('다시 켜면 알약과 점이 돌아오고 고른 종류("전체")가 유지된다', (await shown(p, '#mp-bf')) && (await dots(p)).dot > 0 && (await pillState(p)) === '전체*+ 프랜차이즈 개인');

  // 개인 카페 → 내 장소로 추가
  await tapAt(p, IND[0][3], IND[0][4], 17);
  ok('(추가 전) 개인 카페 카드', (await cardName(p)) === IND[0][1]);
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="add"]').click()); await sleep(600);
  { const f = await p.evaluate(() => ({ title: document.querySelector('#mp-ftitle').textContent, name: document.querySelector('#mp-f-name').value, addr: document.querySelector('#mp-f-addr').value, on: document.querySelector('.mp-swb.on') && document.querySelector('.mp-swb.on').dataset.c }));
    ok('개인 카페를 "내 장소로 추가"하면 양식이 미리 채워지고 색은 "기본"이 선택되어 있다', f.title === '장소 추가' && f.name === IND[0][1] && f.addr === IND[0][2] && f.on === '0', JSON.stringify(f)); }
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  { const added = (await stored(p)).find((x) => x.name === IND[0][1]);
    ok('저장하면 내 장소로 들어간다(색 0)', !!added && added.col === 0, JSON.stringify(added)); }
  await tapAt(p, IND[0][3], IND[0][4], 18);
  await p.evaluate(() => { document.querySelector('#mp-card .mp-c-x') && document.querySelector('#mp-card .mp-c-x').click(); }); await sleep(200);
  // 같은 자리 근처의 다른 점(이름이 같은 개인 카페를 내 장소로 둔 상태)은 "내 장소에 있음"
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== A2. 걸러 보기 선택이 저장되어 다시 열어도 유지 =====
{
  console.log('===== A2. 저장된 종류로 열기');
  const { p, errs } = await openDev(DUO, { cfg: { filt: 'ind' } });
  await view(p, CL, 15);
  ok('저장값이 "개인"이면 열었을 때 "개인"이 눌려 있고 개인 카페만 그려진다', (await pillState(p)) === '전체 프랜차이즈 개인*+' && (await dots(p)).dot === (await expectIn(p, v2, 'ind')) && (await dots(p)).dot === IND.length, await pillState(p) + ' ' + JSON.stringify(await dots(p)));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== B. 내 장소 핀 색 =====
for (const th of ['light', 'night']) {
  console.log('===== B. 내 장소 핀 색 · ' + th + ' 테마');
  const { p, errs } = await openDev(DUO, { cfg: th === 'night' ? { theme: 'night' } : {} });
  const PAL = th === 'night' ? { 3: '#f0c43c', 6: '#6aa5ff' } : { 3: '#c99a06', 6: '#2f6fd0' };
  await p.evaluate(() => { window.__mpMap.setView([37.5380, 127.1150], 15, { animate: false }); }); await sleep(600);
  const cls = await p.evaluate(() => [...document.querySelectorAll('.mp-pin')].map((e) => e.className.replace(/leaflet-\S+/g, '').replace(/\s+/g, ' ').trim()));
  ok('예전 저장(색 없음)은 기본 핀, 색 3(노랑)은 c3, 잘못된 값(99)은 기본 핀이다', cls.filter((c) => /\bc3\b/.test(c)).length === 1 && cls.filter((c) => /\bc\d/.test(c)).length === 1 && cls.length === 3, JSON.stringify(cls));
  { const e = await p.evaluate(() => { const pin = document.querySelector('.mp-pin.c3 .pn'); return pin ? getComputedStyle(pin).fill : null; });
    ok('노랑 핀의 실제 색이 이 테마의 노랑이다', e === rgb(PAL[3]), `${e} 기대 ${rgb(PAL[3])}`); }
  { const e = await p.evaluate(() => { const pins = [...document.querySelectorAll('.mp-pin:not(.c3) .pn')]; return pins.map((x) => getComputedStyle(x).fill); }), acc = await p.evaluate(() => getComputedStyle(document.querySelector('#mp')).getPropertyValue('--accent').trim());
    ok('색이 없는 핀 두 개는 테마 강조색(기본) 그대로다', e.length === 2 && e[0] === e[1] && e[0] !== rgb(PAL[3]), JSON.stringify(e) + ' --accent ' + acc); }
  { const sw = await p.evaluate(() => [...document.querySelectorAll('.mp-item')].map((it) => [it.querySelector('.mp-it-name').textContent, it.querySelector('.mp-sw').className.replace('mp-sw', '').trim()]));
    ok('목록에 이름 앞 색 점이 있고 노랑 점은 가나 카페에만 있다', sw.length === 3 && sw.find((x) => x[0] === '가나 카페')[1] === 'c3' && sw.filter((x) => x[1] !== 'c3').every((x) => x[1] === 'c0'), JSON.stringify(sw)); }
  await p.screenshot({ path: `/tmp/map9shots/duo-colors-${th}.png` });

  // 수정 화면: 색 고르기
  await p.click('.mp-item[data-id="p1"] .mp-it-edit'); await sleep(500);
  { const s = await p.evaluate(() => ({ n: document.querySelectorAll('#mp-f-col .mp-swb').length, on: [...document.querySelectorAll('#mp-f-col .mp-swb.on')].map((x) => x.dataset.c).join(), radios: [...document.querySelectorAll('#mp-f-col .mp-swb')].every((x) => x.getAttribute('role') === 'radio'), names: [...document.querySelectorAll('#mp-f-col .mp-swb')].map((x) => x.getAttribute('aria-label')).join() }));
    ok('색 고르기에 9개(기본+8색)가 있고 "기본"이 선택되어 있으며 이름표(aria-label)가 있다', s.n === 9 && s.on === '0' && s.radios && s.names === '기본,빨강,주황,노랑,초록,청록,파랑,보라,분홍', JSON.stringify(s)); }
  { const sizes = await p.evaluate(() => [...document.querySelectorAll('#mp-f-col .mp-swb')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)].join('x'); }));
    ok('색 단추가 손가락으로 누르기 충분한 크기(32px 이상)다', sizes.every((s) => +s.split('x')[0] >= 32 && +s.split('x')[1] >= 32), sizes.join()); }
  await p.screenshot({ path: `/tmp/map9shots/duo-form-${th}.png` });
  await p.click('#mp-f-col .mp-swb[data-c="6"]'); await sleep(200);
  ok('파랑을 누르면 그 단추만 선택(✓) 표시가 된다', await p.evaluate(() => { const on = [...document.querySelectorAll('#mp-f-col .mp-swb.on')]; return on.length === 1 && on[0].dataset.c === '6' && on[0].getAttribute('aria-checked') === 'true' && document.querySelectorAll('#mp-f-col .mp-swb[aria-checked="true"]').length === 1; }));
  { const bgSw = await bgOf(p, '#mp-f-col .mp-swb[data-c="6"]'); ok('색 단추의 색이 이 테마의 파랑이다', bgSw === rgb(PAL[6]), bgSw); }
  await p.click('#mp-close'); await sleep(300);
  ok('색만 바꿔도 "작성 중" 상태가 되어 [닫기]를 눌러도 지도 화면이 닫히지 않는다', (await shown(p, '#mp')) && (await shown(p, '#mp-form')));
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  { const rec = (await stored(p)).find((x) => x.id === 'p1');
    ok('저장하면 내 장소에 col=6이 들어간다', rec && rec.col === 6, JSON.stringify(rec)); }
  { const e = await p.evaluate(() => { const pin = document.querySelector('.mp-pin.c6 .pn'); return pin ? getComputedStyle(pin).fill : null; });
    ok('핀이 파랑으로 바뀐다', e === rgb(PAL[6]), `${e} 기대 ${rgb(PAL[6])}`); }
  { const sw = await p.evaluate(() => document.querySelector('.mp-item[data-id="p1"] .mp-sw').className), card = await p.evaluate(() => { const c = document.querySelector('#mp-card .mp-sw'); return c ? c.className : null; });
    ok('목록의 색 점·카드의 색 점도 파랑이다', sw.includes('c6') && card && card.includes('c6'), sw + ' | ' + card); }
  { const f = await p.evaluate(() => { const pin = document.querySelector('.mp-pin.sel'); if (!pin) return null; const pn = pin.querySelector('.pn'), cs = getComputedStyle(pn); return { cls: pin.className.replace(/leaflet-\S+/g, '').replace(/\s+/g, ' ').trim(), fill: cs.fill, stroke: cs.stroke, sw: cs.strokeWidth }; });
    ok('선택된 색 핀은 색은 그대로(파랑)이고 테두리가 굵어진다(선택 표시)', f && f.cls.includes('sel') && f.cls.includes('c6') && f.fill === rgb(PAL[6]) && parseFloat(f.sw) > 2.2, JSON.stringify(f)); }
  await p.screenshot({ path: `/tmp/map9shots/duo-selected-${th}.png` });
  await p.evaluate(() => document.querySelector('#mp-card .mp-lk[data-o="edit"]').click()); await sleep(500);
  ok('다시 수정 화면을 열면 저장해 둔 색(파랑)이 선택되어 있다', await p.evaluate(() => document.querySelector('#mp-f-col .mp-swb.on').dataset.c === '6'));
  await p.click('#mp-f-col .mp-swb[data-c="0"]'); await sleep(200);
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  ok('"기본"으로 되돌려 저장하면 col=0이고 핀의 색 표시(c6)가 사라진다', (await stored(p)).find((x) => x.id === 'p1').col === 0 && await p.evaluate(() => !document.querySelector('.mp-pin.c6')));
  // 새 장소 추가 화면 → 색을 고르고 저장
  await p.evaluate(() => document.querySelector('#mp-add').click()); await sleep(500);
  await p.evaluate(() => { document.querySelector('#mp-f-name').value = '새 카페'; });
  await p.click('#mp-f-col .mp-swb[data-c="8"]');
  await p.evaluate(() => { const m = window.__mpMap, c = m.getCenter(); window.__c = c; });
  await p.evaluate(() => document.querySelector('#mp-f-pick').click()); await sleep(400); await p.evaluate(() => document.querySelector('#mp-pick-ok').click()); await sleep(500);
  await p.evaluate(() => document.querySelector('#mp-f-save').click()); await sleep(600);
  ok('새 장소를 분홍으로 저장할 수 있다(col=8)', (await stored(p)).find((x) => x.name === '새 카페')?.col === 8, JSON.stringify((await stored(p)).map((x) => [x.name, x.col])));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== C. 아이폰 세로 =====
{
  console.log('===== C. 아이폰 세로');
  const { p, errs } = await openDev(PH);
  await p.click('.mp-tabs button[data-t="r"]'); await sleep(1000);
  await p.evaluate((la, lo) => { window.__mpMap.setView([la, lo], 16, { animate: false }); }, FR[0][3], FR[0][4]); await sleep(700);
  const bf = await rect(p, '#mp-bf'), br = await rect(p, '#mp-br'), me = await rect(p, '.mp-me'), mw = await rect(p, '.mp-mapwrap'), zo = await rect(p, '.leaflet-control-zoom');
  ok('좁은 화면: 알약이 카페 단추 왼쪽에 같은 높이로 붙고 지도 안에 있으며 확대 단추·내 위치 단추와 겹치지 않는다', bf && Math.abs(bf.t - br.t) <= 1 && bf.r <= br.l && bf.l >= mw.l + (zo.r - mw.l) && bf.t >= me.b + 3 - 1, `bf ${Math.round(bf.l)}~${Math.round(bf.r)} · zoom ${Math.round(zo.l)}~${Math.round(zo.r)} · map ${Math.round(mw.l)}~${Math.round(mw.r)}`);
  ok('좁은 화면: 글자가 줄 바꿈 없이 한 줄이고 알약 높이는 44px', await p.evaluate(() => [...document.querySelectorAll('#mp-bf button')].every((x) => x.getBoundingClientRect().height <= 46 && x.getBoundingClientRect().height >= 40)) && Math.round(bf.h) === 44, JSON.stringify(bf));
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(500);
  ok('좁은 화면: "개인"을 누르면 개인 카페만 그려진다', (await dots(p)).dot === (await expectIn(p, v2, 'ind')) && (await dots(p)).dot >= 5 && (await pillState(p)) === '전체 프랜차이즈 개인*+');
  await tapAt(p, IND[2][3], IND[2][4], 16);
  ok('좁은 화면: 개인 카페 카드가 지도 안에 들어간다', (await cardName(p)) === IND[2][1] && await p.evaluate(() => { const c = document.querySelector('#mp-card').getBoundingClientRect(), m = document.querySelector('.mp-mapwrap').getBoundingClientRect(); return c.left >= m.left - 1 && c.right <= m.right + 1 && c.bottom <= m.bottom + 1; }));
  await p.screenshot({ path: '/tmp/map9shots/phone-ind.png' });
  await p.evaluate(() => window.__mpMap.setZoom(12, { animate: false })); await sleep(500);
  { const hb = await rect(p, '#mp-bhint'); ok('좁은 화면: 확대 안내가 지도 가운데에 있고 알약(아래 줄)과 겹치지 않는다', !!hb && Math.abs((hb.l + hb.r) / 2 - (mw.l + mw.r) / 2) <= 2 && hb.b <= bf.t, hb ? `문구 ${Math.round(hb.t)}~${Math.round(hb.b)} · 알약 ${Math.round(bf.t)}` : '없음'); }
  // 색 고르기 화면 모양
  await p.click('.mp-tabs button[data-t="l"]'); await sleep(500);
  await p.click('.mp-item[data-id="p2"] .mp-it-edit'); await sleep(600);
  await p.evaluate(() => document.querySelector('#mp-f-col').scrollIntoView({ block: 'center' })); await sleep(300);
  ok('좁은 화면: 색 고르기가 화면 폭 안에서 줄 바꿈되어 모두 보이고 노랑(3)이 선택되어 있다', await p.evaluate(() => { const w = document.querySelector('#mp-form').getBoundingClientRect(); return [...document.querySelectorAll('#mp-f-col .mp-swb')].every((x) => { const r = x.getBoundingClientRect(); return r.left >= w.left && r.right <= w.right; }) && document.querySelector('#mp-f-col .mp-swb.on').dataset.c === '3'; }));
  await p.screenshot({ path: '/tmp/map9shots/phone-form.png' });
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== D. 자료가 없거나 깨졌을 때 =====
for (const [mode, label] of [['none', '파일 없음(404, 옛 파일도 없음)'], ['bad', '깨진 파일']]) {
  console.log('===== D. ' + label);
  const { p, errs } = await openDev(DUO, { mode });
  ok(label + ': 안내 문구(카페 자료를 불러오지 못했습니다)', (await shown(p, '#mp-bhint')) && (await txt(p, '#mp-bhint')).includes('카페 자료를 불러오지 못했습니다'), await txt(p, '#mp-bhint'));
  ok(label + ': 알약은 안 보이고, 내 장소 핀 3개와 목록은 그대로', !(await shown(p, '#mp-bf')) && (await p.evaluate(() => [document.querySelectorAll('.mp-pin').length, document.querySelectorAll('.mp-item').length])).join() === '3,3');
  ok(label + ': 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== E. 점이 아주 많을 때(서울 도심처럼) =====
{
  console.log('===== E. 점이 아주 많을 때');
  const { p, errs } = await openDev(DUO, { data: dense });
  await p.evaluate(() => { window.__mpMap.setView([37.4985, 127.0480], 15, { animate: false }); }); await sleep(1200);
  { const d = await dots(p), h = (await txt(p, '#mp-bhint') || '').trim();
    ok('"전체"에서 아주 많으면 가까운 900곳만 그려지고 안내가 뜬다', d.dot === 900 && h.includes('900곳만') && h.startsWith('카페가 많아'), h + ' ' + JSON.stringify(d.c)); }
  await p.screenshot({ path: '/tmp/map9shots/duo-dense.png' });
  const t = await p.evaluate(() => { const m = window.__mpMap, r = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); m.fire('moveend'); r.push(performance.now() - t0); } return r.map((x) => Math.round(x)); });
  console.log('info 다시 그리기 걸린 시간(ms, 헤드리스 PC · 900점):', t.join(', '));
  ok('다시 그리기가 이 PC에서 300ms 안에 끝난다(참고: 실기기는 더 느릴 수 있음)', Math.max(...t) < 300, t.join());
  await p.click('#mp-bf button[data-f="fr"]'); await sleep(600);
  { const d = await dots(p), e = await expectIn(p, dense, 'fr');
    ok('"프랜차이즈"로 바꾸면 그 수만큼만 그려진다(걸러낸 뒤에 900개 제한을 건다)', d.dot === Math.min(900, e) && d.dot > 0, `${d.dot} / 기대 ${Math.min(900, e)} (보이는 프랜차이즈 ${e})`); }
  await p.click('#mp-bf button[data-f="ind"]'); await sleep(600);
  ok('"개인"에서도 900개로 제한되고 안내가 뜬다', (await dots(p)).dot === 900 && (await txt(p, '#mp-bhint')).includes('900곳만'));
  await p.evaluate(() => { window.__mpMap.setView([37.4985, 127.0480], 18, { animate: false }); }); await sleep(900);
  { const d = await dots(p), e = await expectIn(p, dense, 'ind'); ok('충분히 확대하면 제한 없이 보이는 범위의 개인 카페가 모두 그려진다', d.dot === e && e > 0 && e < 900 && !(await shown(p, '#mp-bhint')), `${d.dot}/${e}`); }
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

await b.close(); console.log(fails ? ('FAILS ' + fails) : 'ALL PASS'); process.exit(fails ? 1 : 0);
