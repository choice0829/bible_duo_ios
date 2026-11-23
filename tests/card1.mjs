// v72 — 지도 장소 카드: ① 주소 밑 분류·공공데이터·영업 안내 줄 삭제 ② 정보 보기 단추 ③ '리뷰' → '나만의 리뷰'
//   ④ 단추 모두 같은 크기로 균일 배치 ⑤ 순서: 정보 보기 · 길찾기 · 나만의 리뷰 · 내 장소로 추가 (내 장소 카드: 길찾기 · 나만의 리뷰 · [전화] · 수정).
// v73 — 정보 보기를 눌러도 카드 안에 펼치는 내용은 없다: 지도 앱(네이버 지도 검색: 가게 이름 + 시·군·구)을 바로 연다. 시험 환경은 rev1.mjs 와 같다.
// 주의: PC 크롬 모의다. 아이폰(WKWebView) 글꼴·줄바꿈은 실기기에서 확인한다.
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep, DEVICES } from './devlib.mjs';
serve(8982); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/card1shots', { recursive: true });
function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])), 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);
const BG = [['시험 보드게임카페 가', '서울 강동구 보드로 1', 37.5260, 127.1180], ['시험 보드게임카페 나', '서울 강동구 보드로 2', 37.5260, 127.1210]];
const bgData = { v: 1, src: '시험용', asof: '2026-10', full: ['서울'], bb: [37.50, 126.90, 37.62, 127.20], r: BG };
const CAFES = [[0, '스타벅스 시험1점', '서울 강동구 시험로 1', 37.5290, 127.1250], [-1, '시험개인1', '서울 강동구 개인로 1', 37.5330, 127.1180]];
const cafeData = { v: 2, src: '시험용', asof: '2026-10', b: ['스타벅스', '투썸플레이스'], full: ['서울'], bb: [37.42, 126.76, 37.70, 127.19], r: CAFES };
const seed = { fn: (cfg) => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 })); if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places)); }
} };
const MINE = { id: 'p1', name: '내 장소 하나', lat: 37.5400, lng: 127.1300, addr: '서울 강동구 내로 1', tel: '', hours: '', cap: 0, amen: [], memo: '', col: 0, ts: 1 };
const MINE_TEL = { id: 'p2', name: '전화 있는 내 장소', lat: 37.5420, lng: 127.1330, addr: '서울 강동구 내로 2', tel: '02-123-4567', hours: '매일 10:00–22:00', cap: 4, amen: [], memo: '조용한 곳', col: 1, ts: 2 };
async function openDev(dev) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) { /* 무시 */ }
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url();
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.endsWith('/data/cafes.json')) r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(cafeData) });
    else if (u.endsWith('/data/boardgame.json')) r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(bgData) });
    else if (u.endsWith('/data/brandcafes.json')) r.respond({ status: 404, body: 'x' });
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await p.evaluateOnNewDocument(seed.fn, { places: [MINE, MINE_TEL] });
  await p.goto('http://localhost:8982/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  await p.click('#btn-map'); await sleep(1800);
  await p.evaluate(() => { const t = document.querySelector('.mp-tabs button[data-t="r"]'); if (t && t.offsetParent) t.click(); }); await sleep(900);   // 좁은 화면은 목록으로 열리므로 지도 쪽으로 넘긴다
  return { p, errs, name };
}
// upper: 점을 지도 위쪽(위에서 1/4 지점)에 놓고 누른다 — 정보 칸을 펼쳐 커진 카드가 지도 가운데를 덮어도 눌리도록
async function tapAt(p, lat, lng, zoom = 16, upper = false) {
  await p.evaluate((la, lo, z, up) => { const m = window.__mpMap; m.setView([la, lo], z, { animate: false }); if (up) m.panBy([0, Math.round(m.getSize().y * 0.25)], { animate: false }); }, lat, lng, zoom, upper); await sleep(450);
  const pt = await p.evaluate((la, lo) => { const m = window.__mpMap, c = m.latLngToContainerPoint([la, lo]), r = document.querySelector('#mp-map').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, lat, lng);
  await p.mouse.click(pt.x, pt.y); await sleep(350);
}
const click = async (p, sel) => { await p.evaluate((s) => document.querySelector(s).click(), sel); await sleep(200); };
const cardName = (p) => p.evaluate(() => { const c = document.querySelector('#mp-card'); return c && !c.hidden ? (c.querySelector('.mp-c-top strong') || {}).textContent || null : null; });
const btns = (p) => p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-c-b .mp-lk')].map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, l: r.left, r: r.right, top: r.top, w: r.width, h: r.height, ow: x.scrollWidth > x.clientWidth + 1, oh: x.scrollHeight > x.clientHeight + 1 }; }));
const vis = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel);
const inner = (p) => p.evaluate(() => document.querySelector('#mp-card').innerText);
// 단추 줄 점검: 글자·순서·같은 크기·같은 줄·같은 간격·카드 안에 들어감·글자가 넘치지 않음
async function checkRow(p, label, want, tag) {
  const bs = await btns(p), card = await p.evaluate(() => { const r = document.querySelector('#mp-card').getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, t: r.top }; });
  const t = bs.map((x) => x.t);
  const w0 = bs[0] ? bs[0].w : 0, h0 = bs[0] ? bs[0].h : 0;
  const same = bs.length === want.length && bs.every((x) => Math.abs(x.w - w0) <= 1 && Math.abs(x.h - h0) <= 1 && Math.abs(x.top - bs[0].top) <= 1);
  const gaps = bs.slice(1).map((x, i) => +(x.l - bs[i].r).toFixed(1));
  ok(label + ': 단추 ' + want.length + '개가 ' + want.join(' · ') + ' 순서', JSON.stringify(t) === JSON.stringify(want), JSON.stringify(t));
  ok(label + ': 모두 같은 너비·같은 높이·같은 줄', same, JSON.stringify(bs.map((x) => [Math.round(x.w * 10) / 10, Math.round(x.h * 10) / 10, Math.round(x.top)])));
  ok(label + ': 단추 사이 간격이 일정하고 카드 안에 들어간다', gaps.every((g) => Math.abs(g - gaps[0]) <= 1) && bs[0].l >= card.l && bs[bs.length - 1].r <= card.r + 0.5 && h0 >= 40, 'gaps ' + JSON.stringify(gaps) + ' h ' + h0);
  ok(label + ': 글자가 단추 밖으로 넘치지 않는다', bs.every((x) => !x.ow && !x.oh), JSON.stringify(bs.map((x) => [x.ow, x.oh])));
  return bs;
}

const PICK = (process.argv[2] ? process.argv[2].split(',') : ['SE3 세로', '15 세로', '16ProMax 세로', 'Duo 접힘', 'Duo 펼침', 'iPad mini 가로']);
for (const nm of PICK) {
  const dev = DEVICES.find((d) => d[0] === nm);
  const { p, errs, name } = await openDev(dev);
  const shot = async (tag) => { const r = await p.evaluate(() => { const c = document.querySelector('#mp-card').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; }); await p.screenshot({ path: '/tmp/card1shots/' + name.replace(/ /g, '') + '_' + tag + '.png' }); return r; };

  // ===== 보드게임 카페 카드 =====
  await tapAt(p, BG[0][2], BG[0][3], 16);
  ok(name + ' · 보드게임 카드가 열린다', (await cardName(p)) === BG[0][0], await cardName(p));
  { const txt = await inner(p);
    ok(name + ' · 주소 밑 분류·공공데이터·영업 안내 줄이 없다(정보 보기를 누르기 전)', !/공공데이터|영업 여부|지도 앱에서 확인|상가정보/.test(txt) && !(await p.evaluate(() => !!document.querySelector('#mp-card .mp-c-src'))), JSON.stringify(txt.slice(0, 120)));
    ok(name + ' · 주소는 그대로 보인다', txt.includes(BG[0][1])); }
  await checkRow(p, name + ' · 보드게임', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  await shot('bg_closed');
  // 정보 보기(v73) — 카드 안에 펼치지 않고 지도 앱을 바로 연다
  const msgsOpen = (p) => p.evaluate(() => window.__msgs.filter((m) => m.open).map((m) => ({ o: m.open, f: m.fallback })));
  { const before = await inner(p); await p.evaluate(() => { window.__msgs.length = 0; }); await click(p, '.mp-lk[data-o="info"]');
    const m = await msgsOpen(p), after = await inner(p), ib = (await btns(p))[0];
    ok(name + ' · 정보 보기 → 네이버 지도 앱 검색(가게 이름 + 시·군·구)을 한 번 연다', m.length === 1 && m[0].o === 'nmap://search?query=' + encodeURIComponent('시험 보드게임카페 가 강동구') + '&appname=com.choice0829.bibleflip', JSON.stringify(m));
    ok(name + ' · 앱이 없을 때 쓸 대체 주소는 네이버 지도 웹 검색이다', m.length === 1 && m[0].f === 'https://map.naver.com/p/search/' + encodeURIComponent('시험 보드게임카페 가 강동구'), JSON.stringify(m));
    ok(name + ' · 카드는 그대로다(펼침 칸·「정보 닫기」·눌림 표시·aria-expanded 모두 없음, 글자 변화 없음)', !(await p.evaluate(() => !!document.querySelector('#mp-info, .mp-info'))) && ib.t === '정보 보기' && before === after && await p.evaluate(() => { const b = document.querySelector('.mp-lk[data-o="info"]'); return !b.classList.contains('on') && !b.hasAttribute('aria-expanded'); }), JSON.stringify([ib.t, before === after])); }
  await checkRow(p, name + ' · 정보 보기를 누른 뒤', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  await shot('bg_closed2');
  await tapAt(p, BG[1][2], BG[1][3], 16);
  ok(name + ' · 다른 장소 카드가 열린다', (await cardName(p)) === BG[1][0], await cardName(p));
  await p.evaluate(() => { window.__msgs.length = 0; }); await click(p, '.mp-lk[data-o="info"]');
  { const m = await msgsOpen(p);
    ok(name + ' · 다른 장소의 정보 보기는 그 장소의 이름으로 연다', m.length === 1 && m[0].o.includes(encodeURIComponent('시험 보드게임카페 나 강동구')), JSON.stringify(m)); }

  // 나만의 리뷰
  ok(name + ' · 리뷰 칸은 처음에는 접혀 있고 단추 이름은 「나만의 리뷰」다(접근성 이름은 「나만의 리뷰 남기기」)', !(await vis(p, '#mp-rv')) && (await p.evaluate(() => document.querySelector('.mp-rv-add').getAttribute('aria-label'))) === '나만의 리뷰 남기기');
  await click(p, '.mp-rv-add');
  { const f = await p.evaluate(() => ({ h: document.querySelector('.mp-rv-h')?.textContent || '', on: document.querySelector('.mp-rv-add').classList.contains('on'), ex: document.querySelector('.mp-rv-add').getAttribute('aria-expanded'), st: document.querySelectorAll('.mp-st').length }));
    ok(name + ' · 나만의 리뷰 → 「나만의 리뷰 남기기」 입력 칸이 단추 줄 위에 열린다', /^나만의 리뷰 남기기/.test(f.h) && f.on && f.ex === 'true' && f.st === 5 && await vis(p, '#mp-rv'), JSON.stringify(f)); }
  await checkRow(p, name + ' · 리뷰 입력 중', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  await shot('bg_form');
  await click(p, '.mp-st[data-r="4"]'); await click(p, '[data-a="save"]');
  { const s = await p.evaluate(() => ({ lab: document.querySelector('#mp-rv .mp-rv-row b')?.textContent, stars: document.querySelector('#mp-rv .mp-rv-s')?.textContent, rvB: document.querySelector('#mp-rv').getBoundingClientRect().bottom, bT: document.querySelector('#mp-card .mp-c-b').getBoundingClientRect().top, aria: document.querySelector('.mp-rv-add').getAttribute('aria-label') }));
    ok(name + ' · 저장하면 「나만의 리뷰」 ★★★★☆ 가 단추 줄 위에 보이고 단추 이름은 그대로다', s.lab === '나만의 리뷰' && s.stars === '★★★★☆' && s.rvB <= s.bT + 1 && s.aria === '나만의 리뷰 고치기', JSON.stringify(s)); }
  await checkRow(p, name + ' · 리뷰 저장 뒤', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  await shot('bg_saved');
  await click(p, '.mp-rv-add');   // 단추로도 고칠 수 있다
  ok(name + ' · 쓴 뒤 나만의 리뷰 단추를 누르면 고치기 칸(「나만의 리뷰 고치기」·삭제 단추)이 열린다', await p.evaluate(() => /^나만의 리뷰 고치기/.test(document.querySelector('.mp-rv-h')?.textContent || '') && !!document.querySelector('[data-a="del"]')));
  await click(p, '[data-a="cancel"]');

  // ===== 카페(프랜차이즈·개인) 카드 =====
  await tapAt(p, CAFES[0][3], CAFES[0][4], 16);
  ok(name + ' · 프랜차이즈 카페 카드가 열린다', (await cardName(p)) === CAFES[0][1], await cardName(p));
  ok(name + ' · 프랜차이즈 카드에도 안내 줄이 없다', !/공공데이터|영업 여부|지도 앱에서 확인/.test(await inner(p)));
  await checkRow(p, name + ' · 카페(프랜차이즈)', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  await p.evaluate(() => { window.__msgs.length = 0; }); await click(p, '.mp-lk[data-o="info"]');
  { const m = await msgsOpen(p);
    ok(name + ' · 프랜차이즈 카페: 정보 보기 → 네이버 지도 앱 검색(이름 + 시·군·구)', m.length === 1 && m[0].o === 'nmap://search?query=' + encodeURIComponent('스타벅스 시험1점 강동구') + '&appname=com.choice0829.bibleflip' && !/공공데이터|영업 여부|지도 앱에서 확인/.test(await inner(p)), JSON.stringify(m)); }
  await tapAt(p, CAFES[1][3], CAFES[1][4], 16);
  ok(name + ' · 개인 카페 카드가 열린다', (await cardName(p)) === CAFES[1][1], await cardName(p));
  await p.evaluate(() => { window.__msgs.length = 0; }); await click(p, '.mp-lk[data-o="info"]');
  { const m = await msgsOpen(p);
    ok(name + ' · 개인 카페: 정보 보기 → 네이버 지도 앱 검색(이름 + 시·군·구)', m.length === 1 && m[0].o === 'nmap://search?query=' + encodeURIComponent('시험개인1 강동구') + '&appname=com.choice0829.bibleflip', JSON.stringify(m)); }
  await checkRow(p, name + ' · 카페(개인) 정보 보기 뒤', ['정보 보기', '길찾기', '나만의 리뷰', '내 장소로 추가']);
  // 길찾기는 그대로 동작
  await p.evaluate(() => { window.__msgs.length = 0; }); await click(p, '.mp-lk[data-o="route"]');
  ok(name + ' · 길찾기 단추가 그대로 동작한다(네이버 지도 길찾기 주소로 연다)', await p.evaluate(() => window.__msgs.some((m) => m.open && /^nmap:\/\/route\/public/.test(m.open))), JSON.stringify(await p.evaluate(() => window.__msgs.filter((m) => m.open).map((m) => m.open))));

  // ===== 내 장소 카드 =====
  await tapAt(p, MINE.lat, MINE.lng, 16);
  ok(name + ' · 내 장소 카드가 열린다', (await cardName(p)) === MINE.name, await cardName(p));
  ok(name + ' · 내 장소 카드에는 정보 보기 단추가 없다(내 장소 정보가 이미 보인다)', !(await p.evaluate(() => !!document.querySelector('#mp-card .mp-lk[data-o="info"]'))));
  await checkRow(p, name + ' · 내 장소', ['길찾기', '나만의 리뷰', '수정']);
  await tapAt(p, MINE_TEL.lat, MINE_TEL.lng, 16);
  ok(name + ' · 전화가 있는 내 장소 카드가 열린다', (await cardName(p)) === MINE_TEL.name, await cardName(p));
  ok(name + ' · 내 장소 카드는 영업시간·전화·메모를 그대로 보여 준다', /영업시간 · 매일 10:00–22:00/.test(await inner(p)) && /전화 · 02-123-4567/.test(await inner(p)) && /조용한 곳/.test(await inner(p)));
  await checkRow(p, name + ' · 내 장소(전화)', ['길찾기', '나만의 리뷰', '전화', '수정']);
  await shot('mine_tel');
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="5"]'); await click(p, '[data-a="save"]');
  await checkRow(p, name + ' · 내 장소 리뷰 저장 뒤', ['길찾기', '나만의 리뷰', '전화', '수정']);
  ok(name + ' · 오류 없음', errs.length === 0, errs.join('|'));
  await p.close();
}
await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
