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
    // v63: 철도·지하철 노선선(점선)을 없앴고, 모든 노선의 역이 아이콘으로 나오게 역 고르는 조건을 넓혔다
    ok(`스타일 ${t}: 철도·지하철 노선선(점선) 층이 없다 — 점선(line-dasharray)을 쓰는 transportation 층도 철도 계열 필터도 없다`, !ids.includes('rail') && !st.layers.some((l) => l['source-layer'] === 'transportation' && /"rail"|"transit"/.test(JSON.stringify(l.filter || ''))), ids.filter((i) => /rail|transit|subway/.test(i)).join(','));
    { const fl = spec.featureFilter(pl[0].filter, 'layers[0].filter').filter; const ev = (props) => fl({ zoom: 14 }, { type: 2, properties: props });
      ok(`스타일 ${t}: 역 조건 — 역·간이역·지하철·경전철·모노레일은 이름이 있으면 통과(name 또는 name:ko)`, [['railway', 'station', { name: 'A' }], ['railway', 'halt', { name: 'A' }], ['railway', 'subway', { name: 'A' }], ['railway', 'light_rail', { name: 'A' }], ['railway', 'monorail', { name: 'A' }], ['railway', 'station', { 'name:ko': '천호' }], ['railway', 'station', { name_en: 'Cheonho' }]].every(([c, s, o]) => ev({ class: c, subclass: s, ...o })));
      ok(`스타일 ${t}: 역 조건 — 이름 없는 역·출구·전차 정류장·버스·다른 가게는 제외`, [['railway', 'station', {}], ['entrance', 'subway_entrance', { name: 'A' }], ['railway', 'tram_stop', { name: 'A' }], ['bus', 'bus_stop', { name: 'A' }], ['bus', 'bus_station', { name: 'A' }], ['shop', 'convenience', { name: 'A' }]].every(([c, s, o]) => !ev({ class: c, subclass: s, ...o }))); }
    ok(`스타일 ${t}: 예비 역 층은 이름은 자리가 있을 때만(text-optional)`, pl[0].layout['text-optional'] === true);
    ok(`스타일 ${t}: 합친 역 층(subway-merged, 원 bf-subway)이 맨 위 층이다(도로·동네 이름보다 우선)`, st.layers[st.layers.length - 1].id === 'subway-merged' && st.layers[st.layers.length - 1].source === 'bf-subway' && st.sources['bf-subway'].type === 'geojson' && st.layers[st.layers.length - 2].id === 'subway-station');
    { const mg = st.layers[st.layers.length - 1], fb = pl[0];
      ok(`스타일 ${t}: 합친 역 층은 아이콘을 하나도 빼지 않고(겹침 허용) 예비(타일 그대로) 층은 겹치면 하나만 남긴다`, mg.layout['icon-allow-overlap'] === true && fb.layout['icon-allow-overlap'] === false && mg.layout['icon-image'] === fb.layout['icon-image'] && mg.layout['text-optional'] === true);
      const vis = (o) => { const s2 = ST.build(t, o), m2 = s2.layers.find((l) => l.id === 'subway-merged'), f2 = s2.layers.find((l) => l.id === 'subway-station'); return m2.layout.visibility[0] + f2.layout.visibility[0]; };
      const sample = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: '천호', rank: 2 }, geometry: { type: 'Point', coordinates: [127.12, 37.53] } }] };
      ok(`스타일 ${t}: 켜고 끄기 — 기본은 예비 층만, 합친 목록이 있으면 합친 층만, 끄면(subway:false) 둘 다 숨김`, vis() === 'nv' && vis({ data: sample }) === 'vn' && vis({ subway: false }) === 'nn' && vis({ subway: false, data: sample }) === 'nn' && ST.build(t, { data: sample }).sources['bf-subway'].data.features.length === 1, [vis(), vis({ data: sample }), vis({ subway: false })].join(','));
      ok(`스타일 ${t}: 옵션 없이 build(테마) 만 불러도 된다(옛 호출)`, !!ST.build(t).layers.find((l) => l.id === 'subway-merged')); }
    ok(`스타일 ${t}: 역 아이콘 이름이 bf-subway-${t} 이고 아이콘·글자 색이 있다`, pl[0] && pl[0].layout['icon-image'] === 'bf-subway-' + t && !!ST.PAL[t].subway && !!ST.PAL[t].subwayFg && !!ST.PAL[t].subwayText); }
  ok(`스타일 ${t}: 글꼴은 OpenFreeMap이 가진 Noto Sans(Regular/Bold/Italic)만`, st.layers.every((l) => !l.layout || !l.layout['text-font'] || /^Noto Sans (Regular|Bold|Italic)$/.test(l.layout['text-font'][0])));
}
ok('스타일: 지도 자료·글자 주소가 OpenFreeMap', ST.TILEJSON === 'https://tiles.openfreemap.org/planet' && ST.GLYPHS === 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
ok('스타일: 세 테마의 땅색이 서로 다르고 야간이 가장 어둡다', new Set(['paper', 'sepia', 'night'].map((t) => ST.PAL[t].land)).size === 3 && ST.PAL.night.land < ST.PAL.sepia.land);
// v64: 환승역 합치기(mapstyle.js merge) — 같은 이름(공백·끝의 '역' 무시)이고 700m 안이면 하나, 멀면 따로
{
  const F = (name, x, y, extra) => ({ type: 'Feature', properties: Object.assign({ name, rank: 5 }, extra || {}), geometry: { type: 'Point', coordinates: [127 + x / 88700, 37.5 + y / 111320] } });   // x·y 는 대략 m
  const m = (l) => ST.merge(l), names = (r) => r.features.map((f) => f.properties.name).sort().join('|');
  ok('역 합치기: 같은 이름의 두 점(약 50m)은 하나', m([F('강남', 0, 0), F('강남', 40, 30)]).features.length === 1);
  ok('역 합치기: 이름 끝의 "역"·공백이 달라도 같은 역(\'강남\' · \'강남역\' · \'강 남\')', m([F('강남', 0, 0), F('강남역', 60, 0), F('강 남', 0, 80)]).features.length === 1);
  ok('역 합치기: 같은 이름이라도 700m보다 멀면 따로(다른 도시의 같은 이름)', m([F('중앙', 0, 0), F('중앙', 3000, 0)]).features.length === 2);
  ok('역 합치기: 이름이 다르면 20m 옆이어도 따로', names(m([F('서울', 0, 0), F('시청', 20, 0)])) === '서울|시청');
  ok('역 합치기: 합친 점의 위치는 평균, 순위(rank)는 가장 앞선 값', (() => { const r = m([F('천호', 0, 0, { rank: 4 }), F('천호', 100, 0, { rank: 2 })]).features[0]; return Math.abs(r.geometry.coordinates[0] - (127 + 50 / 88700)) < 2e-6 && r.properties.rank === 2; })());
  ok('역 합치기: 같은 점이 여러 타일에 겹쳐 들어와도 하나', m([F('잠실', 0, 0), F('잠실', 0, 0), F('잠실', 0, 0)]).features.length === 1);
  ok('역 합치기: 이름 없는 점은 버리고, name:ko 가 있으면 그 이름을 쓴다', (() => { const r = m([{ type: 'Feature', properties: { rank: 1 }, geometry: { type: 'Point', coordinates: [127, 37.5] } }, F('Gangnam', 0, 0, { 'name:ko': '강남' })]); return r.features.length === 1 && r.features[0].properties.name === '강남'; })());
  ok('역 합치기: 면(Polygon)으로 들어온 역은 가운데 점으로', (() => { const r = m([{ type: 'Feature', properties: { name: '건대입구', rank: 3 }, geometry: { type: 'Polygon', coordinates: [[[127, 37.5], [127.001, 37.5], [127.001, 37.501], [127, 37.501], [127, 37.5]]] } }]); return r.features.length === 1 && r.features[0].geometry.type === 'Point' && Math.abs(r.features[0].geometry.coordinates[0] - 127.0005) < 3e-4; })());
  ok('역 합치기: 빈 입력·잘못된 입력도 오류 없이 빈 목록', m([]).features.length === 0 && m(null).features.length === 0 && m([null, {}, { properties: { name: 'x' } }]).features.length === 0);
  ok('역 합치기: 서울 지하철 환승역 시뮬레이션 — 노선 5개의 점이 흩어져 있어도(최대 300m) 한 역', m([F('신도림', 0, 0), F('신도림', 120, 40), F('신도림', -90, 150), F('신도림', 200, -60), F('신도림', 30, 280)]).features.length === 1);
}

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
  return { p, errs, log, setData: (v) => { data = v; } };   // setData: 시험 도중 지도 자료 서버의 응답 방식을 바꾼다(예: 처음엔 연결 실패 → 나중엔 정상)
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
    const fs = gl.queryRenderedFeatures({ layers: ['subway-merged'] }), f0 = fs.find((f) => f.properties.name.startsWith('천호'));
    const q = f0 ? gl.project(f0.geometry.coordinates) : null;
    return { has: gl.hasImage('bf-subway-' + th), names: [...new Set(fs.map((f) => f.properties.name))], cheonho: new Set(fs.filter((f) => f.properties.name.startsWith('천호')).map((f) => f.geometry.coordinates.join(','))).size, vis: [gl.getLayoutProperty('subway-merged', 'visibility'), gl.getLayoutProperty('subway-station', 'visibility')], at: q ? { x: q.x + box.left - wrap.left, y: q.y + box.top - wrap.top } : null };
  }, theme);
  ok(theme + ': 지하철 아이콘(bf-subway-' + theme + ')이 지도에 등록됐다', !!stn && stn.has, JSON.stringify(stn));
  ok(theme + ': 환승역 \'천호\'(타일에 세 점)가 아이콘 하나로 합쳐져 그려지고 합친 층이 보이고 예비 층은 숨는다', !!stn && stn.cheonho === 1 && stn.vis.join() === 'visible,none', JSON.stringify(stn));
  ok(theme + ': 역 \'천호\'가 그려졌고 출구·버스 정류장·이름 없는 역은 없다', !!stn && stn.names.some((n) => n.startsWith('천호')) && stn.names.every((n) => !/출구|버스|undefined|null/.test(String(n))) && stn.names.every((n) => !!n), JSON.stringify(stn && stn.names));
  const path = await shot(p, `vec-${theme}`); const P = ST.PAL[theme];
  if (stn && stn.at) {   // 카페 점·핀 층이 아이콘을 가리지 않게 그 층들을 잠시 숨기고 찍는다(지도 바탕만 본다)
    await p.evaluate(() => { const e = document.createElement('style'); e.id = '_hidepanes'; e.textContent = '.leaflet-pane:not(.leaflet-tile-pane):not(.leaflet-map-pane){visibility:hidden!important}'; document.head.appendChild(e); }); await sleep(300);
    const sp = await shot(p, `station-${theme}-clean`);
    await p.evaluate(() => document.getElementById('_hidepanes')?.remove());
    const bx = pixAt(sp, (stn.at.x - 22) * 2, (stn.at.y - 22) * 2, 88, 88, 10, P.subway), far = pixAt(sp, (stn.at.x + 150) * 2, (stn.at.y + 60) * 2, 88, 88, 10, P.subway);
    ok(theme + ': 역 위치에 아이콘 배지 색(' + P.subway + ')이 보이고 다른 곳에는 없다', bx.near && bx.near[0] > 0.06 && far.near && far.near[0] < 0.002, JSON.stringify(bx) + ' / 먼 곳 ' + JSON.stringify(far));
    spawnSync('python3', ['-I', '-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]);x,y=int(sys.argv[2]),int(sys.argv[3]);im.crop((max(0,x-140),max(0,y-90),x+260,y+90)).resize((800,360)).save(sys.argv[4])', sp, String(Math.round(stn.at.x * 2)), String(Math.round(stn.at.y * 2)), `/tmp/map5shots/station-${theme}.png`]);
  }
  // v64: 지하철 단추 — 눌러 끄면 역이 모두 사라지고(저장), 다시 누르면 합친 역이 돌아온다. 테마를 바꿔도 상태가 이어진다.
  {
    const gl = (fn, ...a) => p.evaluate((src, ...args) => { const m = window.__mpMap; let g = null; m.eachLayer((l) => { if (l.getMaplibreMap) g = l.getMaplibreMap(); }); return (0, eval)('(' + src + ')')(g, ...args); }, fn.toString(), ...a);
    const rend = () => gl((g) => ({ merged: g.queryRenderedFeatures({ layers: ['subway-merged'] }).length, tile: g.queryRenderedFeatures({ layers: ['subway-station'] }).length, vis: [g.getLayoutProperty('subway-merged', 'visibility'), g.getLayoutProperty('subway-station', 'visibility')].join() }));
    const btn = () => p.evaluate(() => { const b = document.querySelector('#mp-sw'), r = b.getBoundingClientRect(); return { shown: getComputedStyle(b).display !== 'none' && r.width > 30, pressed: b.getAttribute('aria-pressed'), on: b.classList.contains('on'), ls: localStorage.getItem('bf.mapsubway'), label: b.getAttribute('aria-label'), svg: !!b.querySelector('svg') }; });
    const b0 = await btn(), r0 = await rend();
    ok(theme + ': 지하철 단추가 있고(열차 아이콘) 기본은 켜짐, 역이 보인다', b0.shown && b0.svg && b0.pressed === 'true' && b0.on && b0.label === '지하철역 표시' && r0.merged >= 1, JSON.stringify([b0, r0]));
    await p.evaluate(() => document.querySelector('#mp-sw').click()); await sleep(500);
    const b1 = await btn(), r1 = await rend();
    ok(theme + ': 단추를 눌러 끄면 역 아이콘이 모두 사라지고 단추가 꺼진 모양이며 저장된다', r1.merged === 0 && r1.tile === 0 && r1.vis === 'none,none' && b1.pressed === 'false' && !b1.on && b1.ls === 'off', JSON.stringify([b1, r1]));
    await p.evaluate(() => { document.querySelector('#mp-sw').click(); }); await sleep(900);
    const b2 = await btn(), r2 = await rend();
    ok(theme + ': 다시 누르면 합친 역이 돌아온다(예비 층은 숨김)', r2.merged >= 1 && r2.vis === 'visible,none' && b2.pressed === 'true' && b2.on && b2.ls === 'on', JSON.stringify([b2, r2]));
    ok(theme + ': 지하철 단추가 지도 안에 있고 내 위치 단추와 겹치지 않는다', await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(), a = r('#mp-sw'), m = r('#mp-me'), w = r('.mp-mapwrap'); const hit = !(a.right <= m.left || a.left >= m.right || a.bottom <= m.top || a.top >= m.bottom); return !hit && a.left >= w.left && a.right <= w.right && a.top >= w.top && a.bottom <= w.bottom; }));
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
  const swState = () => p.evaluate(() => { const m = window.__mpMap; let g = null; m.eachLayer((l) => { if (l.getMaplibreMap) g = l.getMaplibreMap(); }); const b = document.querySelector('#mp-sw'); return { merged: g.queryRenderedFeatures({ layers: ['subway-merged'] }).length, vis: [g.getLayoutProperty('subway-merged', 'visibility'), g.getLayoutProperty('subway-station', 'visibility')].join(), pressed: b.getAttribute('aria-pressed') }; });
  await p.evaluate(() => document.querySelector('#mp-sw').click()); await sleep(400);   // 지하철을 끈 채로 테마를 바꾼다
  ok('전환 전: 지하철을 끄면 역이 사라진다', (await swState()).vis === 'none,none');
  await closeMap(p); await setTheme(p, 'night'); await openMap(p); await vecUp(p); await sleep(3500);
  { const x = await swState(); ok('전환: 테마를 바꿔 지도를 새로 만들어도 지하철 끔 상태가 이어진다(역 없음 · 단추 꺼짐)', x.vis === 'none,none' && x.merged === 0 && x.pressed === 'false', JSON.stringify(x)); }
  await p.evaluate(() => document.querySelector('#mp-sw').click()); await sleep(1200);
  { const x = await swState(); ok('전환: 다시 켜면 야간 지도에도 합친 역이 보인다', x.vis === 'visible,none' && x.merged >= 1 && x.pressed === 'true', JSON.stringify(x)); }
  const l1 = pix(await shot(p, 'vec-sw-night'), 6, ST.PAL.night.land).luma;
  ok('전환: 종이 → 야간으로 바꾸면 그림이 어두워진다', l0 > 190 && l1 < 70, `${l0} → ${l1}`);
  ok('전환: 캔버스가 하나만(겹쳐 쌓이지 않음)', (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 1);
  ok('전환: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 4. 지도 방식: 벡터(B) 하나뿐 (v68: 래스터(A)·열쇠 입력은 앱에서 삭제) =====
console.log('===== 지도 방식(벡터 전용)');
{
  const { p, errs, log } = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE] } });
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  ok('방식: 고급설정에 지도 방식 선택·열쇠 입력 화면이 없다', await p.evaluate(() => !document.querySelector('#me-raster, #me-vector, #me-state, #mk-in, #mk-save') && !/래스터|벡터|CARTO|열쇠/.test(document.querySelector('#sheet-body').innerText)));
  ok('방식: 지도를 열기 전에는 벡터 부품을 받지 않는다', !log.local.some((u) => /maplibre-gl\.js|mapstyle\.js/.test(u)), JSON.stringify(log.local.filter((u) => /maplibre|mapstyle/.test(u))));
  await p.click('#go-bk'); await sleep(400);
  const bk = await p.evaluate(() => document.querySelector('#bk-out').value);
  ok('방식: 데이터 백업에 지도 방식·열쇠 값이 들어가지 않는다', !/mapeng/i.test(bk) && !/mapkey/i.test(bk) && !/vector/i.test(bk) && !/raster/i.test(bk), bk.length + '자');
  await p.click('#sheet-back'); await sleep(300);
  await p.click('#sheet-close'); await sleep(400); await openMap(p); const up = await vecUp(p); await sleep(2500);
  ok('방식: 연 지도는 벡터이고 래스터 그림 조각은 받지 않는다', up && JSON.stringify(await srcCls(p)) === '["mp-src-vec"]' && log.raster.length === 0, JSON.stringify(await srcCls(p)) + ' 래스터 ' + log.raster.length + '개');
  ok('방식: 이때 부품 4개(css·js 2개·mapstyle)를 받았다', ['lib/maplibre-gl.css', 'lib/maplibre-gl.js', 'lib/leaflet-maplibre-gl.js', 'mapstyle.js'].every((f) => log.local.some((u) => u.startsWith(f))), JSON.stringify(log.local.filter((u) => /maplibre|mapstyle/.test(u))));
  ok('방식: 성공했으니 실패 안내문은 없다', (await note(p)).hidden === true, JSON.stringify(await note(p)));
  ok('방식: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}
{ // 예전(v67) 설정이 남은 기기: 래스터를 골라 두고 CARTO 열쇠를 넣어 둔 경우 — 업데이트 뒤에는 무시하고 벡터로 열린다
  const { p, errs, log } = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], eng: 'raster' } });
  await p.evaluate(() => localStorage.setItem('bf.mapkey', 'TESTKEY1234'));
  await openMap(p); const up = await vecUp(p); await sleep(2000);
  ok('예전 설정: bf.mapeng=raster · 열쇠가 남아 있어도 벡터로 열린다(래스터 요청 0개)', up && JSON.stringify(await srcCls(p)) === '["mp-src-vec"]' && log.raster.length === 0, JSON.stringify(await srcCls(p)) + ' 래스터 ' + log.raster.length + '개');
  ok('예전 설정: 남은 저장값은 건드리지 않는다(나중에 비상용을 되살릴 때 쓸 수 있음)', (await lsEng(p)) === 'raster' && (await p.evaluate(() => localStorage.getItem('bf.mapkey'))) === 'TESTKEY1234');
  ok('예전 설정: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== 5. 벡터가 안 될 때: 래스터로 돌아가지 않고, 안내문 + 핀·목록은 그대로, 다시 열면 재시도 =====
console.log('===== 벡터 실패');
const failChecks = async (tag, { p, errs, log }, why, diagRe) => {
  const n = await note(p);
  ok(`${tag}: 래스터로 돌아가지 않는다(그림 조각 요청 0개 · mp-src 클래스 없음)`, log.raster.length === 0 && JSON.stringify(await srcCls(p)) === '[]', `${log.raster.length}개 · ${JSON.stringify(await srcCls(p))}`);
  ok(`${tag}: 지하철 단추는 숨는다(역은 벡터 지도에만 있음)`, await p.evaluate(() => getComputedStyle(document.querySelector('#mp-sw')).display === 'none'));
  ok(`${tag}: 벡터 캔버스가 남아 있지 않다`, (await p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 0);
  ok(`${tag}: 안내문이 뜬다(이유: ${why}) · 다시 여는 방법을 알려 준다 · 래스터 얘기는 없다`, n.hidden === false && n.t.includes(why) && n.t.includes('다시 열어') && !n.t.includes('래스터'), n.t);
  ok(`${tag}: 안내문에 진단 한 줄이 붙는다(실기기에서 이유를 알려 줄 때 쓴다)`, diagRe.test(n.t), n.t);
  ok(`${tag}: 핀(내 장소)은 그대로 보인다`, (await p.evaluate(() => document.querySelectorAll('#mp .leaflet-marker-icon.mp-pin').length)) >= 1);
  ok(`${tag}: 목록에 내 장소가 그대로 있다`, await p.evaluate(() => document.querySelector('#mp-list').innerText.includes('가나 카페')));
  ok(`${tag}: 오류 없음`, errs.length === 0, JSON.stringify(errs));
};
{ // (a) WebGL2 없음 — 부품을 받지도 않는다
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE], noGL2: true } });
  await openMap(o.p); await sleep(2000);
  await failChecks('WebGL 없음', o, 'WebGL', /WebGL2/);
  ok('WebGL 없음: 벡터 부품 파일을 받지 않았다', !o.log.local.some((u) => /maplibre-gl\.js/.test(u)), JSON.stringify(o.log.local.filter((u) => /maplibre/.test(u))));
  await sleep(10500);   // 예전에는 9초 뒤 사라졌다. 이제는 지도를 닫았다 다시 열 때까지 남는다.
  ok('WebGL 없음: 10초 넘게 지나도 안내문이 남아 있다', (await note(o.p)).hidden === false);
  // 다시 열어도 여전히 안 되면 안내문이 다시 뜬다
  await closeMap(o.p); await openMap(o.p); await sleep(1500);
  ok('WebGL 없음: 닫았다 다시 열면 한 번 더 시도하고, 여전히 안 되면 안내문이 다시 뜬다', (await note(o.p)).hidden === false && (await note(o.p)).t.includes('WebGL'));
  await o.p.close();
}
{ // (b) 부품 파일을 못 받음
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE] }, libFail: true });
  await openMap(o.p); await sleep(2500);
  await failChecks('부품 실패', o, '부품', /받지 못한 파일: maplibre-gl\.js/);
  await o.p.close();
}
{ // (c) 지도 자료 주소 연결 실패 — 바로 실패로 본다. 그 뒤 서버가 살아나면 지도를 다시 열 때 벡터가 뜬다.
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE] }, data: 'fail' });
  await openMap(o.p); await sleep(3500);
  await failChecks('자료 연결 실패', o, '자료', /스타일 . · 자료 주소 × · 타일 0개/);
  o.setData('ok');
  await closeMap(o.p); await openMap(o.p); const up = await vecUp(o.p); await sleep(2500);
  ok('자료 연결 실패 → 서버 복구: 지도를 다시 열면 벡터가 뜨고 안내문이 사라진다', up && (await note(o.p)).hidden === true && JSON.stringify(await srcCls(o.p)) === '["mp-src-vec"]', JSON.stringify(await note(o.p)) + JSON.stringify(await srcCls(o.p)));
  ok('자료 연결 실패 → 서버 복구: 지하철 단추가 다시 보인다', await o.p.evaluate(() => getComputedStyle(document.querySelector('#mp-sw')).display !== 'none'));
  ok('자료 연결 실패 → 서버 복구: 캔버스가 하나만', (await o.p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 1);
  await o.p.close();
}
{ // (d) 응답이 없어 제때 안 그려짐 — 15초 뒤 실패로 본다
  const o = await openDev(DUO, { cfg: { theme: 'paper', places: [PLACE] }, data: 'hang' });
  await openMap(o.p); await sleep(5000);
  ok('응답 없음: 15초 전에는 아직 실패로 보지 않는다', (await o.p.evaluate(() => document.querySelectorAll('.leaflet-gl-layer').length)) === 1 && (await note(o.p)).hidden === true, `래스터 ${o.log.raster.length}개`);
  await sleep(12000);
  await failChecks('응답 없음', o, '제때', /스타일 . · 자료 주소 × · 타일 0개/);
  await o.p.close();
}

await b.close(); console.log(fails ? ('FAILS ' + fails) : 'ALL PASS'); process.exit(fails ? 1 : 0);
