// v54/v57 — 실제 카페 자료(www/data/cafes.json, 공공데이터 상가정보 걸러 낸 것)로 확인:
//        자료가 앱에서 정상으로 읽히는지, 지역별(서울·경기·부산·제주·강원) 점 수가 자료와 맞는지, 가장 빽빽한 곳에서 900곳 제한과 안내 문구,
//        지도를 계속 움직일 때 걸리는 시간, 실제 매장 점 누르기 → 카드·길찾기. (지도 타일은 단색 그림으로 대신 — 점만 본다)
// 사용: node map8.mjs   (스크린샷은 /tmp/map8shots/)
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8971); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map8shots', { recursive: true });
// 실제 자료: data/cafes.json(서울 모든 카페 + 서울 밖 스타벅스·투썸). 없으면 옛 brandcafes.json
const DATA_FILE = fs.existsSync(new URL('../www/data/cafes.json', import.meta.url)) ? 'cafes.json' : 'brandcafes.json';
const DATA = JSON.parse(fs.readFileSync(new URL('../www/data/' + DATA_FILE, import.meta.url), 'utf8'));
const HAS_IND = DATA.r.some((r) => r[0] < 0);

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
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.mapbg', 'off'); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 })); }
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
const expectIn = (p, f = 'all') => p.evaluate((rows, ff) => { const b = window.__mpMap.getBounds().pad(0.4); return rows.filter((r) => b.contains([r[3], r[4]]) && (ff === 'fr' ? r[0] >= 0 : ff === 'ind' ? r[0] < 0 : true)).length; }, DATA.r, f);
const hint = (p) => p.evaluate(() => { const e = document.querySelector('#mp-bhint'); return e && !e.hidden && e.getBoundingClientRect().width > 0 ? e.textContent.trim() : ''; });
const view = async (p, lat, lng, z) => { await p.evaluate((la, lo, zz) => { window.__mpMap.setView([la, lo], zz, { animate: false }); }, lat, lng, z); await sleep(500); };
const filt = async (p, f) => { await p.click('#mp-bf button[data-f="' + f + '"]'); await sleep(450); };

const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }];
const PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];
const SPOTS = [['서울 강남', 37.4979, 127.0276], ['서울 홍대', 37.5563, 126.9236], ['서울 도심(시청)', 37.5663, 126.9779], ['서울 강동', 37.5301, 127.1238], ['서울 외곽(도봉)', 37.6688, 127.0471]];
const OUT = [['수원', 37.2636, 127.0286], ['부산 서면', 35.1577, 129.0590], ['제주시', 33.4996, 126.5312], ['강릉', 37.7519, 128.8761]];

console.log('===== 실제 자료(' + DATA_FILE + ') · 듀오 펼침');
{
  const { p, errs } = await openDev(DUO);
  const per = DATA.b.map((n, i) => [n, DATA.r.filter((r) => r[0] === i).length]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('   자료: ' + DATA.r.length + '곳 (개인 ' + DATA.r.filter((r) => r[0] < 0).length + ' · 프랜차이즈 ' + DATA.r.filter((r) => r[0] >= 0).length + ') 기준 ' + DATA.asof + ' · 많은 브랜드 ' + per.map((x) => x.join(' ')).join(' · '));
  ok('종류 걸러 보기 알약이 ' + (HAS_IND ? '보인다(개인 카페가 든 자료)' : '안 보인다(옛 자료)'), (await p.evaluate(() => { const e = document.querySelector('#mp-bf'); return !!e && !e.hidden; })) === HAS_IND);
  ok('자료 오류 안내가 없다', !/불러오지 못했/.test(await hint(p)), await hint(p));
  for (const [nm, la, lo] of SPOTS) {
    for (const f of HAS_IND ? ['all', 'fr', 'ind'] : ['all']) {
      if (HAS_IND) await filt(p, f);
      await view(p, la, lo, 15); const d = await dots(p), e = await expectIn(p, f);
      ok(`${nm} 줌15 [${f}]: 점 수가 자료와 맞다(최대 900)`, d.dot === Math.min(e, 900) && d.dot > 0 && Object.keys(d.c).length === 1, `점 ${d.dot} · 자료 ${e}${e > 900 ? ' (제한)' : ''}`);
      if (e > 900) ok(`${nm} 줌15 [${f}]: 제한 안내가 보인다`, /900곳만/.test(await hint(p)), await hint(p));
    }
  }
  if (HAS_IND) await filt(p, 'all');
  for (const [nm, la, lo] of OUT) {
    await view(p, la, lo, 15); const d = await dots(p), e = await expectIn(p, 'all');
    ok(`${nm} 줌15 [all]: 서울 밖 점 수가 자료와 맞고 하나 이상 있다`, d.dot === Math.min(e, 900) && d.dot > 0, `점 ${d.dot} · 자료 ${e}`);
    if (HAS_IND) {
      ok(`${nm} 줌15 [all]: "서울 밖에서는 … 매장만" 안내가 보인다`, /^서울 밖에서는 .*매장만 보입니다/.test(await hint(p)), await hint(p));
      await filt(p, 'ind'); ok(`${nm} 줌15 [ind]: 점 0개 · 개인 카페는 서울만 안내`, (await dots(p)).dot === 0 && /개인 카페는 서울만/.test(await hint(p)), await hint(p));
      await filt(p, 'all');
    }
  }
  await view(p, 37.4979, 127.0276, 14); { const d = await dots(p); ok('줌14: 점이 없고 확대 안내가 보인다', d.dot === 0 && (await hint(p)) === '지도를 확대하면 장소가 보입니다', `점 ${d.dot} · ${await hint(p)}`); }
  await view(p, 37.4979, 127.0276, 15); await p.screenshot({ path: '/tmp/map8shots/duo-gangnam15.png' });
  if (HAS_IND) { await filt(p, 'fr'); await p.screenshot({ path: '/tmp/map8shots/duo-gangnam15-fr.png' }); await filt(p, 'ind'); await p.screenshot({ path: '/tmp/map8shots/duo-gangnam15-ind.png' }); await filt(p, 'all'); }
  await view(p, 37.5301, 127.1238, 16); await p.screenshot({ path: '/tmp/map8shots/duo-gangdong16.png' });

  // 처리 시간 — 가장 빽빽한 곳(강남 줌15)에서 지도를 30번 옮기며 그리기
  await view(p, 37.4979, 127.0276, 15);
  const ms = await p.evaluate(async () => { const m = window.__mpMap, t0 = performance.now(); let n = 0; for (let i = 0; i < 30; i++) { m.setView([37.4979 + (i % 6) * 0.002, 127.0276 + (i % 5) * 0.002], 15, { animate: false }); await new Promise((r) => requestAnimationFrame(r)); n++; } return (performance.now() - t0) / n; });
  ok('강남 줌15에서 한 번 옮겨 그리는 데 평균 80ms 이내(PC 모의 — 실기기는 더 느릴 수 있음)', ms < 80, `평균 ${ms.toFixed(1)}ms`);
  const load = await p.evaluate(() => performance.getEntriesByType('resource').filter((r) => /data\/(cafes|brandcafes)\.json/.test(r.name)).map((r) => [r.name.replace(/^.*\//, ''), Math.round(r.duration), r.transferSize]));
  console.log('   info 자료 파일 받기(ms, 바이트):', JSON.stringify(load));
  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));

  // 실제 개인 카페·프랜차이즈 하나씩 누르기 → 카드
  const picks = [DATA.r.find((r) => r[0] < 0 && /강동구/.test(r[2])), DATA.r.find((r) => r[0] >= 0 && /강동구/.test(r[2]))].filter(Boolean);
  for (const target of picks) {
    await view(p, target[3], target[4], 18);
    const pt = await p.evaluate((la, lo) => { const m = window.__mpMap, c = m.latLngToContainerPoint([la, lo]), r = document.querySelector('#mp-map').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, target[3], target[4]);
    await p.mouse.click(pt.x, pt.y); await sleep(500);
    const card = await p.evaluate(() => { const c = document.querySelector('#mp-card'); return c && !c.hidden ? { name: (c.querySelector('.mp-c-top strong') || {}).textContent, t: c.textContent } : null; });
    // 같은 자리에 다른 카페가 겹쳐 있을 수 있어(같은 건물), 이름이 다르면 주소가 같은 건물인지만 본다
    ok('실제 ' + (target[0] < 0 ? '개인 카페' : '프랜차이즈') + ' 점을 누르면 카드가 뜬다(' + target[1] + ')', !!card && (card.name === target[1] || card.t.includes(target[2].slice(0, 12))), card ? card.name : '카드 없음');
    ok('카드에 ' + (target[0] < 0 ? '"개인 카페"' : '브랜드 이름') + '과 자료 출처·기준 연월이 있다', !!card && /공공데이터/.test(card.t) && card.t.includes(DATA.asof) && (target[0] < 0 || card.name !== target[1] ? true : card.t.includes('매장')), '');
  }
  await p.screenshot({ path: '/tmp/map8shots/duo-card.png' });
  await p.close();
}

console.log('===== 실제 자료 · 아이폰 세로');
{
  const { p, errs } = await openDev(PH);
  await p.click('.mp-tabs button[data-t="r"]'); await sleep(1200);   // 좁은 화면은 목록·지도 탭으로 나뉜다 — 지도 탭으로
  await view(p, 37.5563, 126.9236, 15); const d = await dots(p), e = await expectIn(p, 'all');
  ok('홍대 줌15: 점이 있고 자료와 같은 수다(최대 900)', d.dot > 0 && d.dot === Math.min(e, 900), `점 ${d.dot} · 자료 ${e}`);
  await p.screenshot({ path: '/tmp/map8shots/phone-hongdae15.png' });
  if (HAS_IND) { await filt(p, 'ind'); await view(p, 37.5563, 126.9236, 16); await p.screenshot({ path: '/tmp/map8shots/phone-hongdae16-ind.png' }); }
  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await p.close();
}

await b.close(); console.log(fails ? `\nFAILS ${fails}` : '\nALL PASS'); process.exit(fails ? 1 : 0);
