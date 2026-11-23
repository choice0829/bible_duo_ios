// v53 — 모임 장소 화면의 위·아래 여백을 같게: 화면 맨 위~첫 줄(검색·닫기), 맨 아래~마지막 줄(개수·내 위치 새로고침)을 재어 비교한다.
// 듀오 펼침의 아래 안전영역 34px 은 실기기 캡처(아래 여백 약 48px = 34 + 14)에서 거꾸로 읽은 값이다(실기기 값을 직접 읽은 것은 아님).
// 사용: node map6.mjs   (스크린샷은 /tmp/map6shots/ 에 저장. 지도 그림은 단색 가짜 타일이므로 모양은 실기기에서 확인한다)
import zlib from 'node:zlib'; import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8969); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/map6shots', { recursive: true });

function png(w, h, c) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; }
  const chunk = (t, d) => { const bf = Buffer.alloc(12 + d.length); bf.writeUInt32BE(d.length, 0); bf.write(t, 4, 'ascii'); d.copy(bf, 8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t, 'ascii'), d])) >>> 0, 8 + d.length); return bf; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = png(256, 256, [236, 233, 224]);

const seed = { fn: (cfg) => {
  window.__msgs = []; window.__loc = { lat: 37.5301, lng: 127.1238, acc: 30 };
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => { window.__msgs.push(m); if (m.loc) setTimeout(() => window.bfLocation && window.bfLocation(window.__loc), 40); } } } };
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
    if (cfg && cfg.places) localStorage.setItem('bf.places', JSON.stringify(cfg.places)); }
} };
const PLACE = { id: 'p1', name: '가나 카페', lat: 37.5301, lng: 127.1238, addr: '', tel: '', hours: '', cap: 0, amen: [], memo: '', ts: 1 };
async function openDev(dev, { native = true } = {}) {
  const [name, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.setRequestInterception(true);
  p.on('request', (r) => { const u = r.url(); if (u.startsWith('https://tile.openstreetmap.org/') || u.startsWith('https://basemaps.cartocdn.com/')) r.respond({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
    else if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await p.evaluateOnNewDocument(seed.fn, { places: [PLACE] });
  await p.goto('http://localhost:8969/index.html' + (native ? '?native=1' : '')); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  await p.click('#btn-map'); await sleep(1600);
  return { p, errs, w, h };
}
// 화면 맨 위~보이는 첫 줄(위 줄의 가장 높은 요소), 보이는 마지막 줄~화면 맨 아래(아래 줄의 가장 낮은 요소 · 좁은 화면은 지도 아래 끝)
const measure = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const H = innerHeight, two = document.querySelector('#mp').classList.contains('two');
  const bar = [...document.querySelectorAll('#mp .mp-bar > *')].filter(vis).map((e) => e.getBoundingClientRect());
  const foot = [...document.querySelectorAll('#mp .mp-foot > *')].filter(vis).map((e) => e.getBoundingClientRect());
  const mw = document.querySelector('#mp .mp-mapwrap').getBoundingClientRect();
  const top = Math.min(...bar.map((r) => r.top));
  const bottom = two ? H - Math.max(...foot.map((r) => r.bottom)) : H - mw.bottom;
  const ch = document.querySelector('#mp-chips')?.getBoundingClientRect();
  return { two, top: Math.round(top * 10) / 10, bottom: Math.round(bottom * 10) / 10, mapT: Math.round(mw.top * 10) / 10, mapB: Math.round(mw.bottom * 10) / 10, mapH: Math.round(mw.height * 10) / 10,
    gapChipMap: ch ? Math.round((mw.top - ch.bottom) * 10) / 10 : null, vars: ['--mp-top', '--mp-bot'].map((k) => document.querySelector('#mp').style.getPropertyValue(k)).join(' / ') };
});
const R = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);

// 기기: [이름, 폭, 높이, 안전영역, 기대(펼침이면 위=아래, 아니면 변함없음)]
const CASES = [
  ['Duo 펼침 (아래 안전영역 34 · 실기기 캡처 기준)', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }, 'equal'],
  ['Duo 펼침 (아래 안전영역 0 · 기존 시험값)', 951, 669, { top: 0, right: 84, bottom: 0, left: 0 }, 'equal'],
  ['iPad mini 가로 (위 36 · 아래 34)', 1133, 744, { top: 24, right: 0, bottom: 20, left: 0 }, 'same'],
  ['Duo 접힘 (아래 안전영역 34 · 가정)', 466, 678, { top: 0, right: 0, bottom: 34, left: 0 }, 'equal'],
  ['iPhone15 세로 (위가 더 큼)', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }, 'same'],
];
for (const [name, w, h, si, want] of CASES) {
  console.log('===== ' + name);
  const { p, errs } = await openDev([name, w, h, si]);
  const narrow = !(w >= 680 && w >= h * 1.1);
  if (narrow) { await p.click('.mp-tabs button[data-t="r"]'); await sleep(1200); }
  const m = await measure(p);
  console.log('  측정', JSON.stringify(m));
  await p.screenshot({ path: `/tmp/map6shots/${w}x${h}-b${si.bottom}-${process.argv[2] || 'run'}.png` });
  const base = { top: Math.max(si.top, 0) + 12, bot: Math.max(si.bottom, 0) + 14 };
  if (want === 'equal') {
    ok(name + ': 위 여백 = 아래 여백 (±1px)', Math.abs(m.top - m.bottom) <= 1, `위 ${m.top} · 아래 ${m.bottom}`);
    ok(name + ': 두 여백의 합은 그대로(화면이 통째로 내려갔을 뿐)', Math.abs((m.top + m.bottom) - (base.top + base.bot)) <= 1, `합 ${m.top + m.bottom} (원래 ${base.top + base.bot})`);
  } else {
    ok(name + ': 위가 이미 크거나 거의 같아 그대로다', Math.abs(m.top - base.top) <= 1 && Math.abs(m.bottom - base.bot) <= 1, `위 ${m.top}(원래 ${base.top}) · 아래 ${m.bottom}(원래 ${base.bot})`);
  }
  ok(name + ': 지도가 화면 안에 있고 높이가 충분하다', m.mapT >= 0 && m.mapB <= h && m.mapH >= (narrow ? 300 : 400), `지도 ${m.mapT}~${m.mapB} (높이 ${m.mapH})`);
  if (!narrow && si.right >= 60) {   // 듀오 펼침: 오른쪽 위 상태 알약 자리는 계속 비운다
    const q = await R(p, '#mp-q'), ad = await R(p, '#mp-add'), mp = await R(p, '#mp .mp-mapwrap');
    ok(name + ': 지도는 상태 알약 아래(118px)에서 시작하고 위 줄은 알약 자리를 피한다', mp.t >= 118 && q.r <= w - 84 && ad.r <= w - 84, `지도 위 ${Math.round(mp.t)} · 카페추가 오른쪽 ${Math.round(ad.r)}`);
    ok(name + ': 키워드 줄과 지도 사이 간격이 10px 이상', m.gapChipMap >= 10, '간격 ' + m.gapChipMap);
    // 다른 보기에서도 같다: 카페 추가 양식, 목록 창 펼침
    await p.click('#mp-add'); await sleep(500);
    const f = await measure(p);
    ok(name + ': 카페 추가 양식을 열어도 위 = 아래 (±1px)', Math.abs(f.top - f.bottom) <= 1, `위 ${f.top} · 아래 ${f.bottom}`);
    await p.screenshot({ path: `/tmp/map6shots/${w}x${h}-b${si.bottom}-form-${process.argv[2] || 'run'}.png` });
  }
  ok(name + ': 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

// ===== PC 브라우저(안전영역 없음, 앱 아님): 위 12 · 아래 14 → 1px 만 내려가 13 · 13 =====
{
  console.log('===== PC 브라우저');
  const { p, errs } = await openDev(['PC', 1280, 800, { top: 0, right: 0, bottom: 0, left: 0 }], { native: false });
  const m = await measure(p);
  console.log('  측정', JSON.stringify(m));
  ok('PC: 위 = 아래 (±1px)', Math.abs(m.top - m.bottom) <= 1, `위 ${m.top} · 아래 ${m.bottom}`);
  ok('PC: 오류 없음', errs.length === 0, JSON.stringify(errs));
  await p.close();
}

await b.close(); console.log(fails ? ('FAILS ' + fails) : 'ALL PASS'); process.exit(fails ? 1 : 0);
