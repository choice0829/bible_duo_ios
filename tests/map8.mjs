// v54 — 실제 매장 자료(www/data/brandcafes.json, 공공데이터 상가정보 걸러 낸 것)로 확인:
//        자료가 앱에서 정상으로 읽히는지, 지역별(서울·경기·부산·제주·강원) 점 수가 자료와 맞는지, 가장 빽빽한 곳에서 900곳 제한과 안내 문구,
//        지도를 계속 움직일 때 걸리는 시간, 실제 매장 점 누르기 → 카드·길찾기. (지도 타일은 단색 그림으로 대신 — 점만 본다)
// 사용: node map8.mjs   (스크린샷은 /tmp/map8shots/)
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8971); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map8shots', { recursive: true });
const DATA = JSON.parse(fs.readFileSync(new URL('../www/data/brandcafes.json', import.meta.url), 'utf8'));

function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])) >>> 0, 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);

const seed = { fn: () => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.mapeng', 'raster'); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 })); }
} };
async function openDev(dev) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url();
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });   // 매장 자료는 가로채지 않는다 — 실제 파일을 그대로 읽는다
  await p.evaluateOnNewDocument(seed.fn);
  await p.goto('http://localhost:8971/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  await p.click('#btn-map'); await sleep(2500);
  return { p, errs, w, h };
}
const dots = (p) => p.evaluate(() => { const o = { dot: 0, c: {} }; window.__mpMap.eachLayer((l) => { if (!l.options || l.options.renderer === undefined || !l._latlng) return; if (l.options.radius === 6.5) { o.dot++; o.c[l.options.fillColor] = (o.c[l.options.fillColor] || 0) + 1; } }); return o; });
const expectIn = (p) => p.evaluate((rows) => { const b = window.__mpMap.getBounds().pad(0.4); return rows.filter((r) => b.contains([r[3], r[4]])).length; }, DATA.r);
const hint_is_zoom_msg = (t) => t === '지도를 확대하면 장소가 보입니다';
const hint = (p) => p.evaluate(() => { const e = document.querySelector('#mp-bhint'); return e && !e.hidden && e.getBoundingClientRect().width > 0 ? e.textContent.trim() : ''; });
const view = async (p, lat, lng, z) => { await p.evaluate((la, lo, zz) => { window.__mpMap.setView([la, lo], zz, { animate: false }); }, lat, lng, z); await sleep(500); };

const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }];
const PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];

console.log('===== 실제 자료 · 듀오 펼침');
{
  const { p, errs } = await openDev(DUO);
  console.log('   자료: ' + DATA.r.length + '곳 (' + DATA.b.map((n, i) => n + ' ' + DATA.r.filter((r) => r[0] === i).length).join(' · ') + ') 기준 ' + DATA.asof);
  await view(p, 37.5301, 127.1238, 14);   // 강동구 일대
  let d = await dots(p), e = await expectIn(p);
  ok('강동 일대(줌14): 점이 그려지고 자료와 같은 수다(제한 이내일 때)', d.dot > 0 && d.dot === Math.min(e, 900), `점 ${d.dot} · 자료 ${e}`);
  ok('두 브랜드 색이 모두 보인다', Object.keys(d.c).length === 2, JSON.stringify(d.c));
  ok('자료 오류 안내가 없다', !/불러오지 못했/.test(await hint(p)), await hint(p));
  await p.screenshot({ path: '/tmp/map8shots/duo-gangdong14.png' });

  // 곳곳을 확대 수준 13~16에서 점검
  const SPOTS = [['서울 강남', 37.4979, 127.0276], ['서울 도심(시청)', 37.5663, 126.9779], ['수원', 37.2636, 127.0286], ['부산 서면', 35.1577, 129.0590], ['제주시', 33.4996, 126.5312], ['강릉', 37.7519, 128.8761], ['대전', 36.3504, 127.3845], ['대구', 35.8714, 128.6014], ['광주', 35.1595, 126.8526]];
  for (const [nm, la, lo] of SPOTS) for (const z of [13, 15]) {
    await view(p, la, lo, z); d = await dots(p); e = await expectIn(p);
    ok(`${nm} 줌${z}: 점 수가 자료와 맞다(최대 900)`, d.dot === Math.min(e, 900), `점 ${d.dot} · 자료 ${e}${e > 900 ? ' (제한)' : ''}`);
    if (e > 900) ok(`${nm} 줌${z}: 제한 안내 문구가 보인다`, /900곳/.test(await hint(p)), await hint(p));
  }
  await view(p, 37.4979, 127.0276, 15); await p.screenshot({ path: '/tmp/map8shots/duo-gangnam15.png' });
  await view(p, 37.5663, 126.9779, 13); await p.screenshot({ path: '/tmp/map8shots/duo-seoul13.png' });
  await view(p, 37.5663, 126.9779, 12); d = await dots(p); ok('줌12(너무 멀리): 점이 없고 확대 안내가 보인다', d.dot === 0 && hint_is_zoom_msg(await hint(p)), `점 ${d.dot} · ${await hint(p)}`);

  // 처리 시간 — 가장 빽빽한 곳(서울 도심 줌13)에서 지도를 30번 옮기며 그리기
  await view(p, 37.5663, 126.9779, 13);
  const ms = await p.evaluate(async () => { const m = window.__mpMap, t0 = performance.now(); let n = 0; for (let i = 0; i < 30; i++) { m.setView([37.5663 + (i % 6) * 0.004, 126.9779 + (i % 5) * 0.004], 13, { animate: false }); await new Promise((r) => requestAnimationFrame(() => r())); n++; } return (performance.now() - t0) / n; });
  ok('서울 도심 줌13에서 한 번 옮겨 그리는 데 평균 80ms 이내(PC 모의 — 실기기는 더 느릴 수 있음)', ms < 80, `평균 ${ms.toFixed(1)}ms`);
  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));

  // 실제 매장 하나 누르기 → 카드·길찾기
  const target = DATA.r.find((r) => r[1] === '스타벅스 강릉교동광장') || DATA.r[0];
  await view(p, target[3], target[4], 17);
  const pt = await p.evaluate((la, lo) => { const m = window.__mpMap, c = m.latLngToContainerPoint([la, lo]), r = document.querySelector('#mp-map').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, target[3], target[4]);
  await p.mouse.click(pt.x, pt.y); await sleep(500);
  const card = await p.evaluate(() => { const c = document.querySelector('#mp-card'); return c && !c.hidden ? { name: (c.querySelector('.mp-c-top strong') || {}).textContent, t: c.textContent } : null; });
  ok('실제 매장 점을 누르면 카드에 이름·주소가 나온다', !!card && card.name === target[1] && card.t.includes(target[2]), card ? card.name : '카드 없음');
  ok('카드에 자료 출처·기준 연월이 있다', !!card && /공공데이터/.test(card.t) && card.t.includes(DATA.asof), '');
  await p.screenshot({ path: '/tmp/map8shots/duo-card.png' });
  await p.close();
}

console.log('===== 실제 자료 · 아이폰 세로');
{
  const { p, errs } = await openDev(PH);
  await p.click('.mp-tabs button[data-t="r"]'); await sleep(1200);   // 좁은 화면은 목록·지도 탭으로 나뉜다 — 지도 탭으로
  await view(p, 37.5663, 126.9779, 14); const d = await dots(p), e = await expectIn(p);
  ok('서울 도심 줌14: 점이 있고 자료와 같은 수다(최대 900)', d.dot > 0 && d.dot === Math.min(e, 900), `점 ${d.dot} · 자료 ${e}`);
  await p.screenshot({ path: '/tmp/map8shots/phone-seoul14.png' });
  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await p.close();
}

await b.close(); console.log(fails ? `\nFAILS ${fails}` : '\nALL PASS'); process.exit(fails ? 1 : 0);
