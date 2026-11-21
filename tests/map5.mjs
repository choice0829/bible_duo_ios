// v51~v52 — 모임 장소 지도 '벡터 방식(B, v52부터 기본)': 스타일 검증, 세 테마 렌더(가짜 벡터 타일), 방식 전환(고급설정), 자동 복귀(WebGL 없음·부품 실패·자료 못 받음·제때 안 그려짐), 줌·핀
// 사용: node map5.mjs   (스크린샷은 /tmp/map5shots/ 에 저장)
// 주의: 타일은 tests/vtscene.mjs가 만든 '가짜 동네'다. 실제 OpenFreeMap 자료·실제 아이폰 웹뷰(WebGL·CORS·한글 글꼴)는 시험하지 못하므로 실기기에서 확인한다.
import fs from 'node:fs'; import vm from 'node:vm'; import { spawnSync } from 'node:child_process';
import { serve, launch, sleep } from './devlib.mjs';
import { tile, TILEJSON } from './vtscene.mjs';
serve(8968); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map5shots', { recursive: true });

// ===== 0. 스타일 3종이 MapLibre 스타일 규격에 맞는지 =====
console.log('===== 스타일 검증');
const spec = await import('@maplibre/maplibre-gl-style-spec');
const validate = spec.validateStyleMin || spec.validate;
const win = {}; vm.runInNewContext(fs.readFileSync(new URL('../www/mapstyle.js', import.meta.url), 'utf8'), { window: win });
const ST = win.bfMapStyle;
for (const t of ['paper', 'sepia', 'night']) {
  const st = ST.build(t); const errs = validate(JSON.parse(JSON.stringify(st)));
  ok(`스타일 ${t}: 규격 오류 없음`, errs.length === 0, errs.slice(0, 3).map((e) => e.message).join(' | '));
  const ids = st.layers.map((l) => l.id); ok(`스타일 ${t}: 층 id가 겹치지 않음`, new Set(ids).size === ids.length);
  { const pl = st.layers.filter((l) => l['source-layer'] === 'poi');
    ok(`스타일 ${t}: 가게·시설(POI)은 지하철역 층 하나뿐이다(v58 제거 + v60 역만 복원)`, pl.length === 1 && pl[0].id === 'subway-station' && !ids.some((i) => /^poi/.test(i)) && !('poi' in ST.PAL[t]), pl.map((l) => l.id).join(','));
    const f = JSON.stringify(pl[0] && pl[0].filter);
    ok(`스타일 ${t}: 역 층은 class=railway · subclass=station · 이름 있는 것만 고른다(출구·버스 제외)`, /"railway"/.test(f) && /"station"/.test(f) && /"has","name"/.test(f) && !/entrance|bus/.test(f), f);
    ok(`스타일 ${t}: 역 층이 맨 위 층이다(도로·동네 이름보다 우선)`, st.layers[st.layers.length - 1].id === 'subway-station');
    ok(`스타일 ${t}: 역 아이콘 이름이 bf-subway-${t} 이고 아이콘·글자 색이 있다`, pl[0] && pl[0].layout['icon-image'] === 'bf-subway-' + t && !!ST.PAL[t].subway && !!ST.PAL[t].subwayFg && !!ST.PAL[t].subwayText); }
  ok(`스타일 ${t}: 글꼴은 OpenFreeMap이 가진 Noto Sans(Regular/Bold/Italic)만`, st.layers.every((l) => !l.layout || !l.layout['text-font'] || /^Noto Sans (Regular|Bold|Italic)$/.test(l.layout['text-font'][0])));
}
ok('스타일: 지도 자료·글자 주소가 OpenFreeMap', ST.TILEJSON === 'https://tiles.openfreemap.org/planet' && ST.GLYPHS === 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
ok('스타일: 세 테마의 땅색이 서로 다르고 야간이 가장 어둡다', new Set(['paper', 'sepia', 'night'].map((t) => ST.PAL[t].land)).size === 3 && ST.PAL.night.land < ST.PAL.sepia.land);

// ===== 공통: 열기 =====
const ORIGIN = 'https://tiles.openfreemap.org';
const seed = { fn: (cfg) => {
  let _L; Object.defineProperty(window, 'L', { configurable: true, get() { return _L; }, set(v) { _L = v; try { v.Map.addInitHook(function () { window.__mpMap = this; }); } catch (e) { /* 무시 */ } } });   // v60: 벡터(gl) 지도 객체를 시험에서 꺼내 쓰려고
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) { setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } } };
  if (cfg && cfg.noGL2) { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); }; }
  if (!sessionStorage.getItem('s')) {
    sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places));
    if (cfg && cfg.theme) localStorage.setItem('bf.settings', JSON.stringify({ theme: cfg.theme }));
    if (cfg && cfg.eng) localStorage.setItem('bf.mapeng', cfg.eng);
  }
} };
const PLACE = { id: 'p1', name: '가나 카페', lat: 37.5301, lng: 127.1238, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', ts: 1 };
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
// opts.data: 'ok' | 'fail'(주소 연결 실패) | 'hang'(응답 없음); opts.libFail: 부품 파일을 404로; opts.raster: 'ok'|'fail'
async function openDev(dev, { cfg = null, data = 'ok', libFail = false, raster = 'ok' } = {}) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [], log = { tiles: 0, planet: 0, glyph: 0, raster: [], local: [] };
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) { /* 무시 */ }
  await p.setRequestInterception(true);
  p.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(ORIGIN + '/planet')) { log.planet++; if (data === 'ok') r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(TILEJSON(ORIGIN)), headers: { 'access-control-allow-origin': '*' } }); else if (data === 'fail') r.abort(); /* hang: 응답하지 않는다 */ return; }
    if (u.startsWith(ORIGIN + '/t/')) { log.tiles++; const m = u.match(/\/t\/(\d+)\/(\d+)\/(\d+)\.pbf/); r.respond({ status: 200, contentType: 'application/x-protobuf', body: tile(+m[1], +m[2], +m[3]), headers: { 'access-control-allow-origin': '*' } }); return; }
    if (u.startsWith(ORIGIN + '/fonts/')) { log.glyph++; r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' }); return; }   // 글자 파일이 없어도 기기 글꼴로 그리는지 보려고 일부러 404
    if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) { log.raster.push(u); if (raster === 'ok') r.respond({ status: 200, contentType: 'image/png', body: PNG1 }); else r.abort(); return; }
    if (u.startsWith('http://localhost')) { log.local.push(u.replace(/^http:\/\/localhost:\d+\//, '')); if (libFail && /\/lib\/maplibre-gl\.js/.test(u)) r.respond({ status: 404, body: '' }); else r.continue(); return; }
    if (u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort();
  });
  await p.evaluateOnNewDocument(seed.fn, cfg);
  await p.goto('http://localhost:8968/index.html?native=1'); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  return { p, errs, log };
}
const DUO = ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 0, left: 0 }], PH = ['iPhone15 세로', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }];
const openMap = async (p, narrowTab) => { await p.click('#btn-map'); await sleep(1600); if (narrowTab) { await p.click('.mp-tabs button[data-t="r"]'); await sleep(1200); } };
const closeMap = async (p) => { await p.click('#mp-close'); await sleep(400); };
const cs = (p, sel, prop) => p.evaluate((s, pr) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[pr] : null; }, sel, prop);
const srcCls = (p) => p.evaluate(() => [...document.querySelector('#mp').classList].filter((c) => c.startsWith('mp-src-')));
const note = (p) => p.evaluate(() => { const n = document.querySelector('#mp-note'); return { hidden: n.hidden, t: n.textContent }; });
const vecUp = (p) => p.waitForFunction(() => !!document.querySelector('.leaflet-gl-layer canvas'), { timeout: 20000 }).then(() => true, () => false);
const shot = async (p, name) => { const r = await p.evaluate(() => { const e = document.querySelector('.mp-mapwrap').getBoundingClientRect(); return { x: e.x, y: e.y, width: e.width, height: e.height }; }); const path = `/tmp/map5shots/${name}.png`; await p.screenshot({ path, clip: r, captureBeyondViewport: false }); return path; };
const pix = (path, tol, ...cols) => JSON.parse(spawnSync('python3', ['-I', new URL('./pixstat.py', import.meta.url).pathname, path, '0', '0', '0', '0', String(tol), ...cols], { encoding: 'utf8' }).stdout || '{}');
const pixAt = (path, x, y, w, h, tol, ...cols) => JSON.parse(spawnSync('python3', ['-I', new URL('./pixstat.py', import.meta.url).pathname, path, String(Math.max(0, Math.round(x))), String(Math.max(0, Math.round(y))), String(w), String(h), String(tol), ...cols], { encoding: 'utf8' }).stdout || '{}');
const setTheme = async (p, t) => { await p.click('#btn-settings'); await sleep(500); await p.click(`button[data-k="theme"][data-v="${t}"]`); await sleep(450); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 60000 }); await sleep(300); await p.click('#sheet-close'); await sleep(500); };
const lsEng = (p) => p.evaluate(() => localStorage.getItem('bf.mapeng'));

// ===== 1. 벡터 방식 × 테마 3종 (듀오 펼침) =====
const STAT = {};
for (const theme of ['paper', 'sepia', 'night']) {
  console.log('===== 벡터 · ' + theme);
  const { p, errs, log } = await openDev(DUO, { cfg: { theme, places: [PLACE], eng: 'vector' } });
  await openMap(p); const up = await vecUp(p); await sleep(3500);
  ok(theme + ': 벡터 캔버스가 만들어졌다', up);
  ok(theme + ': #mp 바탕 종류 클래스 = mp-src-vec 하나', JSON.stringify(await srcCls(p)) === JSON.stringify(['mp-src-vec']), JSON.stringify(await srcCls(p)));
  ok(theme + ': 지도 자료·타일을 받았다(래스터 타일은 받지 않음)', log.planet > 0 && log.tiles > 0 && log.raster.length === 0, `planet ${log.planet} · 타일 ${log.tiles} · 래스터 ${log.raster.length}`);
  ok(theme + ': 글자 파일(glyph)을 요청했다 → 404여도 그려진다(기기 글꼴 대체)', log.glyph > 0, 'glyph 요청 ' + log.glyph);
  ok(theme + ': 래스터용 색조 필터가 걸리지 않는다', (await cs(p, '.leaflet-tile-pane', 'filter')) === 'none', await cs(p, '.leaflet-tile-pane', 'filter'));
  const at = await p.evaluate(() => { const a = document.querySelector('.leaflet-control-attribution'); return { t: a ? a.textContent : '', h: a ? [...a.querySelectorAll('a')].map((x) => x.href) : [] }; });
  ok(theme + ': 출처 표기 OpenFreeMap · OpenMapTiles · OpenStreetMap', /OpenFreeMap/.test(at.t) && /OpenMapTiles/.test(at.t) && /OpenStreetMap/.test(at.t), at.t);
  ok(theme + ': 출처 링크가 올바른 주소', at.h.includes('https://openfreemap.org/') && at.h.includes('https://www.openmaptiles.org/') && at.h.includes('https://www.openstreetmap.org/copyright'), JSON.stringify(at.h));
  const pin = await p.evaluate(() => !!document.querySelector('.mp-pin .pn'));
  ok(theme + ': 핀이 지도 위에 보인다', pin);
  // v60: 지하철역 — 아이콘이 등록되고 배치되며(출구·버스 정류장·이름 없는 역은 없음) 그림에 배지 색이 보인다
  const stn = await p.evaluate((th) => {
    const m = window.__mpMap; if (!m) return null; let gl = null; m.eachLayer((l) => { if (l.getMaplibreMap) gl = l.getMaplibreMap(); }); if (!gl) return null;
    const wrap = document.querySelector('.mp-mapwrap').getBoundingClientRect(), box = gl.getCanvas().getBoundingClientRect();   // gl.project 는 캔버스 기준 좌표
    const fs = gl.queryRenderedFeatures({ layers: ['subway-station'] }), f0 = fs.find((f) => f.properties.name === '천호');
    const q = f0 ? gl.project(f0.geometry.coordinates) : null;
    return { has: gl.hasImage('bf-subway-' + th), names: [...new Set(fs.map((f) => f.properties.name))], at: q ? { x: q.x + box.left - wrap.left, y: q.y + box.top - wrap.top } : null };
  }, theme);
  ok(theme + ': 지하철 아이콘(bf-subway-' + theme + ')이 지도에 등록됐다', !!stn && stn.has, JSON.stringify(stn));
  ok(theme + ': 역 \'천호\'가 그려졌고 출구·버스 정류장·이름 없는 역은 없다', !!stn && stn.names.includes('천호') && stn.names.every((n) => !/출구|버스|undefined|null/.test(String(n))) && stn.names.every((n) => !!n), JSON.stringify(stn && stn.names));
  const path = await shot(p, `vec-${theme}`); const P = ST.PAL[theme];
  if (stn && stn.at) {   // 카페 점·핀 층이 아이콘을 가리지 않게 그 층들을 잠시 숨기고 찍는다(지도 바탕만 본다)
    await p.evaluate(() => { const e = document.createElement('style'); e.id = '_hidepanes'; e.textContent = '.leaflet-pane:not(.leaflet-tile-pane):not(.leaflet-map-pane){visibility:hidden!important}'; document.head.appendChild(e); }); await sleep(300);
    const sp = await shot(p, `station-${theme}-clean`);
    await p.evaluate(() => document.getElementById('_hidepanes')?.remove());
    const bx = pixAt(sp, (stn.at.x - 22) * 2, (stn.at.y - 22) * 2, 88, 88, 10, P.subway), far = pixAt(sp, (stn.at.x + 150) * 2, (stn.at.y + 60) * 2, 88, 88, 10, P.subway);
    ok(theme + ': 역 위치에 아이콘 배지 색(' + P.subway + ')이 보이고 다른 곳에는 없다', bx.near && bx.near[0] > 0.06 && far.near && far.near[0] < 0.002, JSON.stringify(bx) + ' / 먼 곳 ' + JSON.stringify(far));
    spawnSync('python3', ['-I', '-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]);x,y=int(sys.argv[2]),int(sys.argv[3]);im.crop((max(0,x-140),max(0,y-90),x+260,y+90)).resize((800,360)).save(sys.argv[4])', sp, String(Math.round(stn.at.x * 2)), String(Math.round(stn.at.y * 2)), `/tmp/map5shots/station-${theme}.png`]);
  }
  const s = pix(path, 6, P.land, P.water, P.building, P.minor, P.main); STAT[theme] = s;
  ok(theme + ': 그림에 땅색이 상당히 보인다(스타일 색이 적용됨)', s.near && s.near[0] > 0.08, JSON.stringify(s));
  ok(theme + ': 여러 색(도로·건물·글자)이 그려졌다(빈 화면 아님)', s.colors > 400, 'colors ' + s.colors);
  ok(theme + ': 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
ok('밝기: 종이 > 세피아 > 야간', STAT.paper.luma > STAT.sepia.luma && STAT.sepia.luma > STAT.night.luma, `${STAT.paper.luma} / ${STAT.sepia.luma} / ${STAT.night.luma}`);
ok('야간은 어둡고(평균 밝기 < 70) 종이는 밝다(> 190)', STAT.night.luma < 70 && STAT.paper.luma > 190, `${STAT.night.luma} / ${STAT.paper.luma}`);

// ===== 2. 줌·핀·좁은 화면 =====
console.log('===== 확대·축소와 핀 (듀오 펼침 · 종이)');
{
  const { p, errs } = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector' } });
  await openMap(p); await vecUp(p); await sleep(3000);
  const a = await shot(p, 'vec-zoom-0');
  for (let i = 0; i < 3; i++) { await p.click('.leaflet-control-zoom-in'); await sleep(900); }
  await sleep(2500); const z = await shot(p, 'vec-zoom-3');
  const sa = pix(a, 4, '#F2EFE2'), sz = pix(z, 4, '#F2EFE2');
  ok('줌: 3단계 확대하면 그림이 달라진다', JSON.stringify(sa) !== JSON.stringify(sz), JSON.stringify(sa) + ' → ' + JSON.stringify(sz));
  ok('줌: 확대 뒤에도 캔버스가 하나만 있다', (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer canvas').length)) === 1);
  for (let i = 0; i < 4; i++) { await p.click('.leaflet-control-zoom-out'); await sleep(500); }
  await sleep(1500);
  ok('줌: 핀이 계속 보인다', await p.evaluate(() => !!document.querySelector('.mp-pin .pn')));
  ok('줌: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
console.log('===== 아이폰 세로 · 야간 · 벡터');
{
  const { p, errs } = await openDev(PH, { cfg: { theme: 'night', places: [PLACE], eng: 'vector' } });
  await openMap(p, true); const up = await vecUp(p); await sleep(3500);
  ok('아이폰 세로: 벡터 캔버스', up);
  const s = pix(await shot(p, 'vec-phone-night'), 6, ST.PAL.night.land);
  ok('아이폰 세로(야간): 어두운 그림', s.luma < 70, JSON.stringify(s));
  ok('아이폰 세로: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 3. 테마를 바꾸면 벡터 그림이 따라 바뀐다 =====
console.log('===== 벡터 · 테마 전환(종이 → 야간)');
{
  const { p, errs } = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector' } });
  await openMap(p); await vecUp(p); await sleep(3000); const l0 = pix(await shot(p, 'vec-sw-paper'), 6, ST.PAL.paper.land).luma;
  await closeMap(p); await setTheme(p, 'night'); await openMap(p); await vecUp(p); await sleep(3500);
  const l1 = pix(await shot(p, 'vec-sw-night'), 6, ST.PAL.night.land).luma;
  ok('전환: 종이 → 야간으로 바꾸면 그림이 어두워진다', l0 > 190 && l1 < 70, `${l0} → ${l1}`);
  ok('전환: 캔버스가 하나만(겹쳐 쌓이지 않음)', (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 1);
  ok('전환: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 4. 고급설정: 방식 고르기(A/B) =====
console.log('===== 고급설정 · 지도 방식');
{
  const { p, errs, log } = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE] } });
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  const st = () => p.evaluate(() => document.querySelector('#me-state').textContent);
  const on = () => p.evaluate(() => ({ r: document.querySelector('#me-raster').classList.contains('on'), v: document.querySelector('#me-vector').classList.contains('on'), pr: document.querySelector('#me-raster').getAttribute('aria-pressed'), pv: document.querySelector('#me-vector').getAttribute('aria-pressed') }));
  const o0 = await on();
  ok('방식: 처음(저장값 없음)에는 벡터(B)가 기본으로 선택됨', !o0.r && o0.v && o0.pr === 'false' && o0.pv === 'true' && (await st()).includes('벡터(B) 사용 중') && (await st()).includes('기본'), await st());
  ok('방식: 저장값이 없다(기본 = 벡터)', (await lsEng(p)) === null);
  ok('방식: 단추 이름에 기본/비상용이 적혀 있다', await p.evaluate(() => /벡터 \(B\) · 기본/.test(document.querySelector('#me-vector').textContent) && /래스터 \(A\) · 비상용/.test(document.querySelector('#me-raster').textContent)));
  ok('방식: 지도를 열기 전에는 벡터 부품을 받지 않는다', !log.local.some((u) => /maplibre-gl\.js|mapstyle\.js/.test(u)), JSON.stringify(log.local.filter((u) => /maplibre|mapstyle/.test(u))));
  await p.click('#go-bk'); await sleep(400);
  const bk = await p.evaluate(() => document.querySelector('#bk-out').value);
  ok('방식: 데이터 백업에 방식 선택값이 들어가지 않는다', !/mapeng/i.test(bk) && !/vector/i.test(bk) && !/raster/i.test(bk), bk.length + '자');
  await p.click('#sheet-back'); await sleep(300);
  await p.click('#sheet-close'); await sleep(400); await openMap(p); const up = await vecUp(p); await sleep(2500);
  ok('방식: 아무것도 고르지 않고 연 지도가 벡터(기본)', up && JSON.stringify(await srcCls(p)) === '["mp-src-vec"]', JSON.stringify(await srcCls(p)));
  ok('방식: 이때 부품 4개(css·js 2개·mapstyle)를 받았다', ['lib/maplibre-gl.css', 'lib/maplibre-gl.js', 'lib/leaflet-maplibre-gl.js', 'mapstyle.js'].every((f) => log.local.some((u) => u.startsWith(f))), JSON.stringify(log.local.filter((u) => /maplibre|mapstyle/.test(u))));
  await closeMap(p);
  // 비상용 래스터로: 지도를 다시 열면 OSM 타일을 받고 벡터 층은 없다
  const r0 = log.raster.length;   // (바꾸는 즉시 지도가 이미 만들어져 있으면 그때 타일을 받으므로, 바꾸기 전에 센다)
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500); await p.click('#me-raster'); await sleep(300);
  const o2 = await on();
  ok('방식: 래스터(A)를 누르면 선택이 바뀌고 raster로 저장된다', (await lsEng(p)) === 'raster' && o2.r && !o2.v && (await st()).includes('래스터(A) 사용 중') && (await st()).includes('비상용'), await st());
  await p.click('#sheet-close'); await sleep(400); await openMap(p); await sleep(1500);
  ok('방식: 래스터로 바꾼 뒤 지도는 OSM 타일이고 벡터 캔버스가 없다', log.raster.length > r0 && JSON.stringify(await srcCls(p)) === '["mp-src-osm"]' && (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 0 && (await p.evaluate(() => document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile').length)) > 0, `래스터 ${log.raster.length - r0}개 · ${JSON.stringify(await srcCls(p))}`);
  await closeMap(p);
  // 다시 벡터로
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500); await p.click('#me-vector'); await sleep(300);
  ok('방식: 벡터(B)로 다시 누르면 vector로 저장된다', (await lsEng(p)) === 'vector' && (await on()).v);
  await p.click('#sheet-close'); await sleep(400); await openMap(p); const up2 = await vecUp(p); await sleep(2000);
  ok('방식: 다시 연 지도가 벡터이고 래스터 타일층이 사라졌다', up2 && JSON.stringify(await srcCls(p)) === '["mp-src-vec"]' && (await p.evaluate(() => document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile').length)) === 0, JSON.stringify(await srcCls(p)));
  ok('방식: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 5. 자동 복귀(벡터가 안 될 때 래스터로) =====
console.log('===== 자동 복귀');
const fallbackChecks = async (tag, { p, errs, log }, why, diagRe) => {
  const n = await note(p);
  ok(`${tag}: 래스터로 돌아왔다(OSM 타일을 받고 mp-src-osm)`, log.raster.length > 0 && JSON.stringify(await srcCls(p)) === '["mp-src-osm"]', `${log.raster.length}개 · ${JSON.stringify(await srcCls(p))}`);
  ok(`${tag}: 벡터 캔버스가 남아 있지 않다`, (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 0);
  ok(`${tag}: 안내문이 뜬다(이유: ${why})`, n.hidden === false && n.t.includes(why) && n.t.includes('래스터'), n.t);
  // 고급설정의 상태 줄에 '진단' 한 줄이 보인다(실기기에서 이유를 알려 줄 때 쓴다)
  await closeMap(p); await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  const t = await p.evaluate(() => document.querySelector('#me-state').textContent);
  ok(`${tag}: 고급설정에 진단 한 줄이 보인다`, t.includes('진단:') && diagRe.test(t), t);
  ok(`${tag}: 오류 없음`, errs.length === 0, JSON.stringify(errs));
};
{ // (a) WebGL2 없음 — 부품을 받지도 않는다
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector', noGL2: true } });
  await openMap(o.p); await sleep(2000);
  await fallbackChecks('WebGL 없음', o, 'WebGL', /WebGL2/);
  ok('WebGL 없음: 벡터 부품 파일을 받지 않았다', !o.log.local.some((u) => /maplibre-gl\.js/.test(u)), JSON.stringify(o.log.local.filter((u) => /maplibre/.test(u))));
  // 설정에 이유가 보이고, 다시 누르면 한 번 더 시도한다(여전히 안 되면 다시 복귀)
  const t = await o.p.evaluate(() => document.querySelector('#me-state').textContent);
  ok('WebGL 없음: 고급설정에 "선택됨 · 이번에는 래스터" 이유가 보인다', t.includes('벡터(B) 선택됨') && t.includes('WebGL'), t);
  await o.p.close();
}
{ // (b) 부품 파일을 못 받음
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector' }, libFail: true });
  await openMap(o.p); await sleep(2500);
  await fallbackChecks('부품 실패', o, '부품', /받지 못한 파일: maplibre-gl\.js/);
  await o.p.close();
}
{ // (c) 지도 자료 주소 연결 실패 — 바로 실패로 본다
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector' }, data: 'fail' });
  await openMap(o.p); await sleep(3500);
  await fallbackChecks('자료 연결 실패', o, '자료', /스타일 . · 자료 주소 × · 타일 0개/);
  await o.p.close();
}
{ // (d) 응답이 없어 제때 안 그려짐 — 15초 뒤 실패로 본다
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'vector' }, data: 'hang' });
  await openMap(o.p); await sleep(5000);
  ok('응답 없음: 15초 전에는 아직 복귀하지 않는다', (await o.p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 1 && o.log.raster.length === 0, `래스터 ${o.log.raster.length}개`);
  await sleep(12000);
  await fallbackChecks('응답 없음', o, '제때', /스타일 . · 자료 주소 × · 타일 0개/);
  await o.p.close();
}

await b.close(); console.log(fails ? ('FAILS ' + fails) : 'ALL PASS'); process.exit(fails ? 1 : 0);
