// v63 — 장소 리뷰(평점 1~5 + 100자 이하 문구): 보드게임·카페·내 장소 카드, 입력 제한, 수정·삭제, 백업, 관리자 모아 보기(다른 기기 리뷰 붙여 넣기·표 복사),
//   쓰던 글 보존, 내 장소 삭제 시 리뷰 삭제, 깨진 저장값 정리, 아이폰 세로 배치. (시험 환경은 map10.mjs 와 같다)
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8981); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/rev1shots', { recursive: true });

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
  window.__msgs = []; window.__clip = ''; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip = String(t); } } }); } catch (e) { /* 무시 */ } window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.mapeng', 'raster'); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places));
    if (cfg && cfg.theme) localStorage.setItem('bf.settings', JSON.stringify({ theme: cfg.theme }));
    if (cfg && cfg.cafeOff) localStorage.setItem('bf.mapbrand', 'off');
    if (cfg && cfg.bgOff) localStorage.setItem('bf.mapbg', 'off');
    if (cfg && cfg.rv) localStorage.setItem('bf.reviews', cfg.rv); }
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
  await p.goto('http://localhost:8981/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
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


const LONG = '가나다라마바사아자차카타파하'.repeat(10);   // 140자
const EMO = '맛있어요😀'.repeat(30);                    // 이모지 포함 180자
const rvStore = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bf.reviews') || '[]'));
const rvIn = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bf.reviews.in') || '[]'));
const box = (p) => p.evaluate(() => { const e = document.querySelector('#mp-rv'); return e ? { html: e.innerHTML, text: e.textContent, add: !!e.querySelector('.mp-rv-add'), form: !!e.querySelector('.mp-rv-form'), stars: e.querySelector('.mp-rv-s')?.textContent || '', body: e.querySelector('.mp-rv-t')?.textContent || '' } : null; });
const lkTexts = (p) => p.evaluate(() => [...document.querySelectorAll('#mp-card .mp-lk')].map((x) => x.textContent));
const click = async (p, sel) => { await p.evaluate((s) => document.querySelector(s).click(), sel); await sleep(180); };
const openAdv = async (p, sel) => { await p.click('#btn-settings'); await sleep(500); await click(p, '#go-adv'); await sleep(300); await click(p, sel); await sleep(300); };
const closeAny = async (p) => { await p.evaluate(() => { const c = document.querySelector('#sheet-close, #sheet .close, [aria-label="닫기"]'); if (c) c.click(); }); await sleep(200); };
const KEY_BG0 = 'b:시험 보드게임카페 가|37.52600,127.11800';

// ===== A. 듀오 펼침 · 보드게임 카드 =====
{
  console.log('===== A. 듀오 펼침 · 보드게임 카드의 리뷰');
  const { p, errs } = await openDev(DUO);
  await tapAt(p, BG[0][2], BG[0][3], 16);
  ok('보드게임 카드가 열리고 단추는 길찾기·내 장소로 추가 두 개 그대로다', (await cardName(p)) === BG[0][0] && JSON.stringify(await lkTexts(p)) === JSON.stringify(['길찾기', '내 장소로 추가']), await cardName(p));
  let bx = await box(p);
  ok('처음에는 "☆ 리뷰" 단추 하나만 보인다(접근성 이름은 "리뷰 남기기")', bx && bx.add && !bx.form && /리뷰/.test(bx.text) && (await p.evaluate(() => document.querySelector('.mp-rv-add').getAttribute('aria-label'))) === '리뷰 남기기', bx && bx.text);
  { const g = await p.evaluate(() => { const a = document.querySelector('.mp-rv-add').getBoundingClientRect(), r = document.querySelector('.mp-lk[data-o="route"]').getBoundingClientRect(), e = document.querySelector('.mp-lk[data-o="add"]').getBoundingClientRect(), c = document.querySelector('#mp-card').getBoundingClientRect(), m = document.querySelector('#mp-map').getBoundingClientRect(); return { aT: a.top, rT: r.top, eT: e.top, aR: a.right, rL: r.left, cardTop: c.top, midY: (m.top + m.bottom) / 2 }; });
    ok('접힌 리뷰 단추가 길찾기·내 장소로 추가와 같은 줄(높이가 늘지 않는다)', Math.abs(g.aT - g.rT) <= 2 && Math.abs(g.rT - g.eT) <= 2 && g.aR <= g.rL + 1, JSON.stringify(g));
    ok('(듀오 펼침) 카드가 지도 가운데 높이를 가리지 않는다(맨 위가 지도 세로 가운데보다 아래)', g.cardTop > g.midY, JSON.stringify(g)); }
  await click(p, '.mp-rv-add');
  bx = await box(p);
  const f0 = await p.evaluate(() => ({ st: document.querySelectorAll('.mp-st').length, sv: document.querySelector('[data-a="save"]').disabled, cnt: document.querySelector('#mp-rv-cnt').textContent, ph: document.querySelector('.mp-rv-in').placeholder, del: !!document.querySelector('[data-a="del"]') }));
  ok('입력 칸: 별 5개 · 저장은 별을 고르기 전까지 비활성 · 0 / 100 · 안내 글 · 삭제 단추 없음(새 리뷰)', f0.st === 5 && f0.sv === true && f0.cnt === '0' && /100자/.test(f0.ph) && !f0.del, JSON.stringify(f0));
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '가'.repeat(140); t.dispatchEvent(new Event('input', { bubbles: true })); });
  const tr = await p.evaluate(() => ({ len: Array.from(document.querySelector('.mp-rv-in').value).length, cnt: document.querySelector('#mp-rv-cnt').textContent }));
  ok('140자를 넣으면 100자에서 잘리고 글자 수는 100', tr.len === 100 && tr.cnt === '100', JSON.stringify(tr));
  await p.evaluate((e) => { const t = document.querySelector('.mp-rv-in'); t.value = e; t.dispatchEvent(new Event('input', { bubbles: true })); }, EMO);
  const tr2 = await p.evaluate(() => ({ len: Array.from(document.querySelector('.mp-rv-in').value).length, cnt: document.querySelector('#mp-rv-cnt').textContent }));
  ok('이모지가 섞여도 글자 수는 100자 기준(이모지 한 글자)', tr2.len === 100 && tr2.cnt === '100', JSON.stringify(tr2));
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '분위기 좋고 게임 종류가 많아요'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(p, '.mp-st[data-r="4"]');
  const st4 = await p.evaluate(() => ({ on: [...document.querySelectorAll('.mp-st')].map((x) => x.textContent).join(''), sv: document.querySelector('[data-a="save"]').disabled, sc: document.querySelector('.mp-rv-sc').textContent, checked: [...document.querySelectorAll('.mp-st')].filter((x) => x.getAttribute('aria-checked') === 'true').map((x) => x.dataset.r) }));
  ok('4번째 별을 누르면 ★★★★☆ · 저장 활성 · "4점" · aria-checked=4', st4.on === '★★★★☆' && st4.sv === false && st4.sc === '4점' && JSON.stringify(st4.checked) === '["4"]', JSON.stringify(st4));
  await p.screenshot({ path: '/tmp/rev1shots/a-form.png' });
  await click(p, '[data-a="save"]');
  bx = await box(p); let rv = await rvStore(p);
  ok('저장하면 카드에 ★★★★☆ · 내 리뷰 · 문구가 보인다', bx && !bx.form && bx.stars === '★★★★☆' && bx.body === '분위기 좋고 게임 종류가 많아요' && /내 리뷰/.test(bx.text), JSON.stringify(bx && [bx.stars, bx.body]));
  ok('기기 저장(bf.reviews): 한 건 · 키·이름·좌표·평점·문구', rv.length === 1 && rv[0].k === KEY_BG0 && rv[0].n === BG[0][0] && rv[0].r === 4 && rv[0].t === '분위기 좋고 게임 종류가 많아요' && rv[0].la === 37.526 && rv[0].lo === 127.118, JSON.stringify(rv));
  ok('카드 단추는 여전히 두 개', JSON.stringify(await lkTexts(p)) === JSON.stringify(['길찾기', '내 장소로 추가']));
  await p.screenshot({ path: '/tmp/rev1shots/a-saved.png' });
  // 닫았다 다시 열어도 · 다른 장소에는 없다
  await click(p, '#mp-c-x');
  await tapAt(p, BG[0][2], BG[0][3], 16);
  ok('카드를 닫았다 다시 열어도 리뷰가 남아 있다', (await box(p)).stars === '★★★★☆');
  await click(p, '#mp-c-x'); await tapAt(p, BG[1][2], BG[1][3], 16);
  ok('다른 보드게임 카페 카드에는 그 리뷰가 없다(장소마다 따로)', (await cardName(p)) === BG[1][0] && (await box(p)).add);
  // 수정
  await click(p, '#mp-c-x'); await tapAt(p, BG[0][2], BG[0][3], 16);
  await click(p, '[data-a="edit"]');
  const pre = await p.evaluate(() => ({ r: [...document.querySelectorAll('.mp-st')].filter((x) => x.classList.contains('on')).length, t: document.querySelector('.mp-rv-in').value, del: !!document.querySelector('[data-a="del"]'), h: document.querySelector('.mp-rv-h').textContent }));
  ok('수정을 누르면 지금 별점·문구가 채워져 있고 삭제 단추가 생긴다', pre.r === 4 && pre.t === '분위기 좋고 게임 종류가 많아요' && pre.del && /리뷰 고치기/.test(pre.h), JSON.stringify(pre));
  await click(p, '.mp-st[data-r="2"]'); await click(p, '[data-a="save"]'); rv = await rvStore(p);
  ok('별점을 2로 고쳐 저장하면 같은 한 건이 바뀐다(새 건이 늘지 않음)', rv.length === 1 && rv[0].r === 2 && (await box(p)).stars === '★★☆☆☆', JSON.stringify(rv.map((x) => x.r)));
  // 취소는 저장하지 않는다
  await click(p, '[data-a="edit"]'); await click(p, '.mp-st[data-r="5"]'); await click(p, '[data-a="cancel"]'); rv = await rvStore(p);
  ok('취소하면 바뀌지 않는다', rv[0].r === 2 && (await box(p)).stars === '★★☆☆☆');
  // 삭제는 두 번 눌러야 한다
  await click(p, '[data-a="edit"]'); await click(p, '[data-a="del"]');
  ok('삭제를 한 번 누르면 "한 번 더 누르면 삭제"로 바뀌고 아직 지워지지 않는다', /한 번 더 누르면 삭제/.test((await box(p)).text) && (await rvStore(p)).length === 1);
  await click(p, '[data-a="del"]');
  ok('한 번 더 누르면 지워지고 "리뷰 남기기"로 돌아간다', (await rvStore(p)).length === 0 && (await box(p)).add);
  // 리뷰 없이 별만(문구 없음)
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="5"]'); await click(p, '[data-a="save"]'); rv = await rvStore(p);
  ok('문구 없이 별점만 저장할 수 있다', rv.length === 1 && rv[0].r === 5 && rv[0].t === '' && (await box(p)).stars === '★★★★★' && (await box(p)).body === '');
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// ===== B. 카페 카드 · 내 장소 카드 · 쓰던 글 보존 · 내 장소 삭제 =====
{
  console.log('===== B. 카페 카드 · 내 장소 카드');
  const { p, errs } = await openDev(DUO);
  await tapAt(p, 37.5300, 127.1150, 16);
  ok('카페 카드가 열린다', /스타벅스/.test((await cardName(p)) || ''), await cardName(p));
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="3"]');
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '무난해요'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(p, '[data-a="save"]');
  let rv = await rvStore(p);
  ok('카페 리뷰는 키가 c: 로 시작하고 이름·좌표가 들어 있다', rv.length === 1 && /^c:스타벅스 시험2점\|37\.53000,127\.11500$/.test(rv[0].k) && rv[0].r === 3, JSON.stringify(rv));
  // 내 장소
  await click(p, '#mp-c-x'); await tapAt(p, MINE.lat, MINE.lng, 16);
  ok('내 장소 카드: 단추는 길찾기·수정, 리뷰 칸이 있다', (await cardName(p)) === MINE.name && JSON.stringify(await lkTexts(p)) === JSON.stringify(['길찾기', '수정']) && (await box(p)).add, JSON.stringify(await lkTexts(p)));
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="3"]');
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '쓰는 중인 글'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(p, '#mp-me'); await sleep(1200);   // 내 위치 갱신 → 카드가 다시 그려진다
  const kept = await p.evaluate(() => ({ form: !!document.querySelector('.mp-rv-form'), t: document.querySelector('.mp-rv-in')?.value, r: [...document.querySelectorAll('.mp-st.on')].length, card: !document.querySelector('#mp-card').hidden }));
  ok('쓰는 중에 카드가 다시 그려져도(내 위치 갱신) 별점·쓰던 글이 남는다', kept.card && kept.form && kept.t === '쓰는 중인 글' && kept.r === 3, JSON.stringify(kept));
  await click(p, '[data-a="save"]'); rv = await rvStore(p);
  ok('내 장소 리뷰는 키가 m:<장소 id>', rv.some((x) => x.k === 'm:p1' && x.r === 3 && x.t === '쓰는 중인 글'), JSON.stringify(rv.map((x) => x.k)));
  // 장소를 지우면 그 리뷰도 지워진다
  await click(p, '.mp-lk.edit'); await sleep(500);
  await click(p, '#mp-f-del'); await click(p, '#mp-f-del'); await sleep(600);
  rv = await rvStore(p);
  ok('내 장소를 지우면 그 장소의 리뷰만 함께 지워진다(카페 리뷰는 남음)', !rv.some((x) => x.k === 'm:p1') && rv.some((x) => x.k.startsWith('c:')), JSON.stringify(rv.map((x) => x.k)));
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// ===== C. 백업 · 관리자 모아 보기 =====
{
  console.log('===== C. 백업 · 관리자 모아 보기');
  const { p, errs } = await openDev(DUO);
  await tapAt(p, BG[0][2], BG[0][3], 16);
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="4"]');
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '내 리뷰, "따옴표" 포함'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(p, '[data-a="save"]');
  await click(p, '#mp-c-x'); await tapAt(p, BG[1][2], BG[1][3], 16); await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="5"]'); await click(p, '[data-a="save"]');
  await click(p, '#mp-c-x');
  // 지도를 닫고 설정으로
  await p.evaluate(() => { const c = [...document.querySelectorAll('button')].find((b) => /닫기/.test(b.textContent) && b.offsetParent); if (c) c.click(); }); await sleep(600);
  // 백업
  await openAdv(p, '#go-bk');
  const bk = await p.evaluate(() => { try { const j = JSON.parse(document.querySelector('#bk-out').value); return { n: (j.reviews || []).length, inn: (j.reviewsIn || []).length, label: document.querySelector('#sheet-body').textContent.includes('리뷰 2개') }; } catch (e) { return { err: String(e) }; } });
  ok('백업 내보내기에 리뷰 2개가 들어 있고 개수가 표시된다', bk.n === 2 && bk.inn === 0 && bk.label, JSON.stringify(bk));
  const saved = await p.evaluate(() => document.querySelector('#bk-out').value);
  await p.evaluate(() => { localStorage.setItem('bf.reviews', '[]'); });
  await p.evaluate((t) => { const i = document.querySelector('#bk-in'); i.value = t; }, saved);
  await click(p, '#bk-apply'); await click(p, '#bk-apply'); await sleep(900);
  ok('백업을 불러오면 리뷰도 돌아온다', (await rvStore(p)).length === 2, JSON.stringify((await rvStore(p)).map((x) => x.k)));
  const toast = await p.evaluate(() => document.body.textContent.includes('리뷰 2개'));
  ok('불러오기 알림에 리뷰 개수가 나온다', toast);
  // 관리자 화면
  await openAdv(p, '#go-rv');
  const adm0 = await p.evaluate(() => ({ title: document.querySelector('#sheet-title').textContent, head: [...document.querySelectorAll('#sheet-body .adv-head')].map((x) => x.textContent.replace(/\s+/g, ' ')), groups: document.querySelectorAll('.rv-g').length, out: document.querySelector('#rv-out').value }));
  const ex = JSON.parse(adm0.out);
  ok('관리자 화면: 제목·내 리뷰 2개·장소 2곳·기기 1대', adm0.title === '리뷰 모아 보기' && adm0.head.some((h) => /모아 본 리뷰 \(2개 · 장소 2곳 · 기기 1대\)/.test(h)) && adm0.groups === 2, JSON.stringify(adm0.head));
  ok('내보내기 글: app·did·리뷰 2개, 이름·전화번호 없음', ex.app === 'bibleflip-reviews' && /^[a-z0-9]{4,12}$/.test(ex.did) && ex.reviews.length === 2 && !/tel|phone|name/.test(JSON.stringify(Object.keys(ex))), adm0.out.slice(0, 120));
  // 다른 기기 리뷰 모으기
  const other = { app: 'bibleflip-reviews', ver: 1, did: 'zz9988', savedAt: '2026-11-22T00:00:00Z', reviews: [
    { k: KEY_BG0, n: BG[0][0], la: 37.526, lo: 127.118, r: 2, t: '다른 사람 리뷰', ts: 1700000000000 },
    { k: 'b:딴 가게|37.50000,127.00000', n: '딴 가게', la: 37.5, lo: 127.0, r: 5, t: '', ts: 1700000001000 },
    { k: 'x', n: '나쁜 별점', r: 9, t: 'x', ts: 1 }] };
  await p.evaluate((t) => { document.querySelector('#rv-in').value = t; }, JSON.stringify(other));
  await click(p, '#rv-apply'); await sleep(400);
  const adm1 = await p.evaluate(() => ({ head: [...document.querySelectorAll('#sheet-body .adv-head')].map((x) => x.textContent.replace(/\s+/g, ' ')), groups: [...document.querySelectorAll('.rv-g')].map((g) => ({ n: g.querySelector('strong').textContent, av: g.querySelector('.rv-av').textContent, rows: [...g.querySelectorAll('.rv-r')].map((r) => r.textContent.replace(/\s+/g, ' ')) })), msg: document.querySelector('#rv-in-msg').textContent }));
  ok('다른 기기 리뷰를 모으면 4개(내 2 + 다른 기기 2) · 장소 3곳 · 기기 2대(잘못된 별점은 버림)', adm1.head.some((h) => /\(4개 · 장소 3곳 · 기기 2대\)/.test(h)) && /기기 zz9988의 리뷰 2개/.test(adm1.msg), JSON.stringify(adm1.head) + adm1.msg);
  const g0 = adm1.groups.find((g) => g.n === BG[0][0]);
  ok('같은 장소 묶음: 리뷰 2개 · 평균 ★ 3.0 · "이 기기"와 "기기 zz9988" 구분', g0 && /★ 3\.0 · 2개/.test(g0.av) && g0.rows.some((r) => /이 기기/.test(r)) && g0.rows.some((r) => /기기 zz9988/.test(r) && /다른 사람 리뷰/.test(r)), JSON.stringify(g0));
  ok('리뷰가 많은 장소가 위에 나온다', adm1.groups[0].n === BG[0][0], adm1.groups.map((g) => g.n).join(' | '));
  const inStore = await rvIn(p);
  ok('모은 리뷰는 별도 저장소(bf.reviews.in)에 기기 번호와 함께 들어가고 이 기기 리뷰(bf.reviews)는 그대로 2개', inStore.length === 2 && inStore.every((x) => x.did === 'zz9988') && (await rvStore(p)).length === 2, JSON.stringify(inStore.map((x) => x.did)));
  // 같은 기기를 다시 붙여 넣으면 그 기기의 것이 통째로 바뀐다
  other.reviews = [other.reviews[0]]; other.reviews[0].r = 4;
  await p.evaluate((t) => { document.querySelector('#rv-in').value = t; }, JSON.stringify(other)); await click(p, '#rv-apply'); await sleep(300);
  const inStore2 = await rvIn(p);
  ok('같은 기기 글을 다시 모으면 그 기기 리뷰가 새 내용으로 바뀐다(중복 없음)', inStore2.length === 1 && inStore2[0].r === 4, JSON.stringify(inStore2));
  // 잘못된 글 · 내 기기 글
  await p.evaluate((t) => { document.querySelector('#rv-in').value = t; }, '아무 글'); await click(p, '#rv-apply');
  ok('잘못된 글은 오류 안내를 보이고 저장소는 그대로', /리뷰 내용이 아닙니다/.test(await p.evaluate(() => document.querySelector('#rv-in-msg').textContent)) && (await rvIn(p)).length === 1);
  await p.evaluate((t) => { document.querySelector('#rv-in').value = t; }, adm0.out); await click(p, '#rv-apply');
  ok('이 기기에서 내보낸 글을 다시 넣으려 하면 막는다', /이 기기에서 내보낸 글/.test(await p.evaluate(() => document.querySelector('#rv-in-msg').textContent)));
  // 내 카드에는 다른 사람 리뷰가 보이지 않는다
  await click(p, '#sheet-back'); await sleep(200);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#sheet button')].find((b) => /닫기|✕/.test(b.getAttribute('aria-label') || b.textContent)); if (c) c.click(); }); await sleep(500);
  // 표(CSV) 복사
  await p.click('#btn-settings'); await sleep(500); await click(p, '#go-adv'); await click(p, '#go-rv'); await sleep(300);
  await click(p, '#rv-csv'); await sleep(200);
  const csv = await p.evaluate(() => window.__clip);
  const lines = csv.split('\n');
  ok('표(CSV): 머리줄 + 리뷰 3줄, 따옴표는 두 번 겹쳐 쓰고 기기·날짜가 들어간다', lines[0] === '장소,위도,경도,평점,문구,기기,날짜' && lines.length === 4 && csv.includes('"내 리뷰, ""따옴표"" 포함"') && /zz9988/.test(csv) && /\(이 기기\)/.test(csv) && /,"\d{4}-\d{2}-\d{2}"$/m.test(csv), JSON.stringify(lines.slice(0, 2)));
  // 모아 온 리뷰 지우기(두 번)
  await click(p, '#rv-clear');
  ok('지우기를 한 번 누르면 아직 지워지지 않는다', (await rvIn(p)).length === 1);
  await click(p, '#rv-clear'); await sleep(300);
  ok('한 번 더 누르면 모아 온 리뷰만 지워지고 이 기기 리뷰는 남는다', (await rvIn(p)).length === 0 && (await rvStore(p)).length === 2);
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// ===== D. 깨진 저장값 · 내 카드에는 내 리뷰만 · 새로 열어도 남음 =====
{
  console.log('===== D. 깨진 저장값 · 다시 열기');
  const bad = JSON.stringify([
    { k: KEY_BG0, n: BG[0][0], la: 37.526, lo: 127.118, r: 3, t: LONG + '\n줄바꿈', ts: 5 },
    { k: KEY_BG0, n: '중복', r: 1, t: '', ts: 6 },
    { k: 'b:나쁜별점|1,1', n: 'x', r: 7, t: '', ts: 1 },
    { k: '', n: '키 없음', r: 3, t: '', ts: 1 },
    { n: '키 없음2', r: 3 }, 'abc', null]);
  const { p, errs } = await openDev(DUO, { cfg: { rv: bad } });
  const rv = await p.evaluate(() => { /* 읽기만: 앱이 저장값을 정리해 카드에 보여 준다 */ return JSON.parse(localStorage.getItem('bf.reviews')); });
  await tapAt(p, BG[0][2], BG[0][3], 16);
  const bx = await box(p);
  ok('깨진 저장값: 유효한 한 건만 쓰이고(중복·나쁜 별점·키 없음은 버림) 문구는 100자로 잘리고 줄바꿈은 공백이 된다', bx.stars === '★★★☆☆' && Array.from(bx.body).length === 100 && !/\n/.test(bx.body), JSON.stringify([bx.stars, Array.from(bx.body).length]));
  await click(p, '[data-a="edit"]'); await click(p, '[data-a="save"]');
  const rv2 = await rvStore(p);
  ok('저장하면 정리된 한 건만 남는다', rv2.length === 1 && rv2[0].r === 3 && Array.from(rv2[0].t).length === 100, JSON.stringify(rv2.map((x) => [x.k, x.r, Array.from(x.t).length])));
  await p.reload(); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 60000 }); await sleep(1200);
  await p.click('#btn-map'); await sleep(1500); await tapAt(p, BG[0][2], BG[0][3], 16);
  ok('앱을 다시 열어도 리뷰가 남아 있다', (await box(p)).stars === '★★★☆☆');
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// ===== E. 아이폰 세로 · 야간 =====
{
  console.log('===== E. 아이폰 세로 · 야간');
  const { p, errs } = await openDev(PH, { cfg: { theme: 'night' } });
  await p.evaluate(() => { const t = document.querySelector('.mp-tabs button[data-t="r"]'); if (t) t.click(); }); await sleep(900);
  await tapAt(p, BG[0][2], BG[0][3], 16);
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="4"]');
  await p.evaluate(() => { const t = document.querySelector('.mp-rv-in'); t.value = '아이폰 세로에서 쓰는 한 줄 리뷰입니다'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  const geo = await p.evaluate(() => { const c = document.querySelector('#mp-card').getBoundingClientRect(), mw = document.querySelector('.mp-mapwrap').getBoundingClientRect(), s = document.querySelector('[data-a="save"]').getBoundingClientRect(), x = document.querySelector('#mp-card'); return { cl: c.left, cr: c.right, ct: c.top, cb: c.bottom, ml: mw.left, mr: mw.right, mt: mw.top, mb: mw.bottom, hOver: x.scrollWidth - x.clientWidth, sw: s.width, sh: s.height, iw: innerWidth }; });
  ok('아이폰 세로: 카드가 지도 안에 있고 가로로 넘치지 않으며 저장 단추를 누를 수 있는 크기다', geo.cl >= geo.ml - 1 && geo.cr <= geo.mr + 1 && geo.ct >= geo.mt - 1 && geo.cb <= geo.mb + 1 && geo.hOver <= 0 && geo.sh >= 36, JSON.stringify(geo));
  await p.screenshot({ path: '/tmp/rev1shots/e-phone-night.png' });
  await click(p, '[data-a="save"]');
  ok('아이폰 세로: 저장된다', (await rvStore(p)).length === 1);
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}
// ===== F. 카페·보드게임 단추를 눌러도 검은 안내 문구가 뜨지 않는다(v63) =====
{
  console.log('===== F. 단추를 눌러도 검은 안내 없음');
  const { p, errs } = await openDev(DUO);
  const toastText = () => p.evaluate(() => [...document.querySelectorAll('#infotoast, .toast, [id*="toast"]')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => e.textContent).join('|') + '#' + (document.body.textContent.match(/표시를 (켰|껐)습니다/g) || []).join(','));
  const states = [];
  for (const sel of ['#mp-br', '#mp-bg', '#mp-br', '#mp-bg']) { await click(p, sel); await sleep(350); states.push(await toastText()); }
  ok('카페·보드게임 단추를 끄고 켜도 "표시를 켰습니다/껐습니다" 안내가 하나도 뜨지 않는다', states.every((x) => x.endsWith('#')), JSON.stringify(states));
  ok('단추는 그대로 동작한다(둘 다 켜짐으로 돌아옴)', (await p.evaluate(() => ['#mp-br', '#mp-bg'].map((s) => document.querySelector(s).getAttribute('aria-pressed')))).join() === 'true,true');
  ok('페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}
// ===== G. 리뷰를 쓰는 중 키보드가 올라와도 입력 칸이 가려지지 않는다(v64) =====
// 아이폰 앱은 키보드 높이를 앱(Swift)이 window.bfKeyboard(px) 로 알려 준다 → 여기서는 그 호출을 흉내 낸다. 실제 키보드·실기기는 확인하지 못한다.
for (const [label, dev, kb, narrow, theme] of [['듀오 펼침', DUO, 300, false, 'paper'], ['아이폰 세로', PH, 336, true, 'night']]) {
  console.log('===== G. 키보드 — ' + label);
  const { p, errs } = await openDev(dev, { cfg: { theme } });
  if (narrow) { await p.evaluate(() => { const t = document.querySelector('.mp-tabs button[data-t="r"]'); if (t) t.click(); }); await sleep(900); }
  await tapAt(p, BG[0][2], BG[0][3], 16);
  await click(p, '.mp-rv-add'); await click(p, '.mp-st[data-r="3"]');
  const geo = () => p.evaluate((kbh) => {
    const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
    const c = document.querySelector('#mp-card');
    return { kbTop: innerHeight - kbh, card: r('#mp-card'), ta: r('.mp-rv-in'), sv: r('[data-a="save"]'), cn: r('[data-a="cancel"]'), title: r('.mp-c-top'), map: r('.mp-mapwrap'), cls: c.className, bottom: getComputedStyle(c).bottom, route: getComputedStyle(c.querySelector('.mp-lk')).display, src: c.querySelector('.mp-c-src') ? getComputedStyle(c.querySelector('.mp-c-src')).display : 'none', ae: document.activeElement.className };
  }, kb);
  const g0 = await geo();
  ok(label + ': (키보드 전) 카드가 평소 자리(아래 28px)에 있고 줄어들지 않았다', !/kbup/.test(g0.cls) && g0.bottom === '28px' && g0.route !== 'none', JSON.stringify(g0.cls + ' ' + g0.bottom));
  await p.focus('.mp-rv-in');
  await p.evaluate((h) => window.bfKeyboard(h), kb); await sleep(500);
  const g1 = await geo();
  const above = (o) => o && o.b <= g1.kbTop + 0.5;
  ok(label + ': 키보드가 올라오면 카드가 키보드 위로 올라가 아래 끝이 키보드 위에 있다', /kbup/.test(g1.cls) && above(g1.card), JSON.stringify({ kbTop: g1.kbTop, card: g1.card, cls: g1.cls }));
  ok(label + ': 리뷰 입력 칸·저장·취소 단추가 모두 키보드 위에 보인다(카드 안, 가려지지 않음)', g1.ta && above(g1.ta) && above(g1.sv) && above(g1.cn) && g1.ta.t >= g1.card.t - 0.5 && g1.sv.b <= g1.card.b + 0.5, JSON.stringify({ kbTop: g1.kbTop, ta: g1.ta, sv: g1.sv, card: g1.card }));
  { const sc = await p.evaluate(() => { const c = document.querySelector('#mp-card'); return { sh: c.scrollHeight, ch: c.clientHeight, top: c.scrollTop }; });
    ok(label + ': 간추린 카드는 스크롤 없이 이름 줄·별·입력 칸·저장 단추가 한 번에 다 보인다', sc.sh <= sc.ch + 1 && sc.top === 0, JSON.stringify(sc)); }
  ok(label + ': 카드 위 끝이 지도 안에 있다(지도 밖으로 밀려 올라가지 않음)', g1.card.t >= g1.map.t - 0.5, JSON.stringify({ card: g1.card, map: g1.map }));
  ok(label + ': 입력 중에는 이름 줄과 리뷰 칸만 남기고 주소·출처·길찾기 단추는 숨긴다', g1.title && g1.src === 'none' && g1.route === 'none', JSON.stringify([g1.src, g1.route]));
  await p.screenshot({ path: '/tmp/rev1shots/g-' + (narrow ? 'phone' : 'duo') + '-kb.png' });
  // 글을 쓰고 저장 → 카드가 원래대로(키보드가 아직 올라와 있어도 저장 뒤에는 입력 칸이 없으므로)
  await p.type('.mp-rv-in', '키보드 위에서 쓴 리뷰'); await sleep(150);
  await click(p, '[data-a="save"]'); await sleep(300);
  const g2 = await geo().catch(() => null);
  ok(label + ': 저장하면 카드가 평소 모양으로 돌아온다(줄임 해제 · 길찾기 단추 복귀)', !!g2 && !/kbup/.test(g2.cls) && g2.bottom === '28px' && g2.route !== 'none' && (await rvStore(p)).length === 1, JSON.stringify(g2 && [g2.cls, g2.bottom, g2.route]));
  await p.evaluate(() => window.bfKeyboard(0)); await sleep(200);
  // 고치기 → 키보드 → 키보드 내림(blur)
  await click(p, '.mp-rv-ch'); await p.focus('.mp-rv-in'); await p.evaluate((h) => window.bfKeyboard(h), kb); await sleep(400);
  ok(label + ': 고치기에서도 같은 방식으로 올라온다', /kbup/.test((await geo()).cls) && above((await geo()).ta));
  await p.evaluate(() => { document.activeElement.blur(); window.bfKeyboard(0); }); await sleep(400);
  const g3 = await geo();
  ok(label + ': 키보드를 내리면 카드가 제자리로 돌아오고 리뷰 폼은 그대로 열려 있다', !/kbup/.test(g3.cls) && g3.bottom === '28px' && !!g3.ta && g3.route !== 'none', JSON.stringify([g3.cls, g3.bottom]));
  ok(label + ': 페이지 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}
console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
