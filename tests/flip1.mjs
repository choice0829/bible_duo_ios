// v56 — 책장이 넘어갈 때 들린 쪽의 윗부분이 책(#stage) 위쪽 경계에서 한 줄로 잘리지 않는지.
//        같은 순간을 (1) 지금 화면 (2) 자르기를 끈 화면 두 장으로 찍어, 다른 화소가 책 위쪽 경계 위에 몇 px 있는지(= 잘려 안 보이는 높이)를 잰다.
//        탭(자동 넘김) 앞으로·뒤로, 끌기(아래 모서리 · 위 모서리, 손가락을 크게 위아래로 움직여도). 평소(넘기지 않을 때)에는 책 위로 아무것도 보이지 않아야 한다.
// 사용: node flip1.mjs   (스크린샷은 /tmp/flip1shots/). 탭 넘김을 12초로 늘려(window.TURN_MS) 거의 멈춘 상태로 여러 순간을 잰다.
import fs from 'node:fs';
import { serve, launch, sleep } from './devlib.mjs';
serve(8972); const b = await launch(); let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + n + ' ' + x); if (!c) fails++; };
fs.mkdirSync('/tmp/flip1shots', { recursive: true });
const DEVS = [
  ['Duo 펼침', 951, 669, { top: 0, right: 84, bottom: 34, left: 0 }, '?native=1', 15],
  ['iPad mini 가로', 1133, 744, { top: 24, right: 0, bottom: 20, left: 0 }, '?native=1', 15],
  ['iPhone15 가로', 852, 393, { top: 0, right: 59, bottom: 21, left: 59 }, '?native=1', 15],
  ['웹(PC 브라우저)', 1180, 760, { top: 0, right: 0, bottom: 0, left: 0 }, '', 0],
];
const TOL = 1.5;   // 가장자리 안티앨리어싱 오차
async function diffUp(p, a, v, st) {
  return p.evaluate(async (a, v, s) => {
    const load = (b64) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + b64; });
    const [ia, iv] = await Promise.all([load(a), load(v)]); const W = ia.width, H = ia.height, k = W / innerWidth;
    const cv = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
    const da = cv(ia), dv = cv(iv); let up = 0, n = 0; const top = Math.round(s.t * k);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (Math.abs(da[o] - dv[o]) + Math.abs(da[o + 1] - dv[o + 1]) + Math.abs(da[o + 2] - dv[o + 2]) > 24) { n++; if (y < top) up = Math.max(up, top - y); } }
    return { n, up: up / k };
  }, a, v, st);
}
for (const [name, w, h, si, query, wantUp] of DEVS) {
  console.log('===== ' + name);
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession(); try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: si }); } catch (e) {}
  await p.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('bf.pos', JSON.stringify({ book: 42, chapter: 2, verse: 16 })); } window.TURN_MS = 12000; });
  await p.goto('http://localhost:8972/index.html' + query); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(2500);
  const st = await p.evaluate(() => { const e = document.querySelector('#stage'), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left, t: r.top, w: r.width, h: r.height, scroll: e.classList.contains('scroll'), up: getComputedStyle(document.documentElement).getPropertyValue('--flip-up').trim(), clip: cs.clipPath, ov: cs.overflow }; });
  if (st.scroll) { console.log('  (이 크기는 위아래로 읽는 화면이라 넘김 없음 — 건너뜀)'); await p.close(); continue; }
  if (wantUp === 0) {   // 웹(PC): 책 카드 그림자가 있어 예전 그대로 — 자르는 창을 넓히지 않고(clip-path 없음) 넘김 모양도 그대로여야 한다
    ok('웹(PC)은 예전 그대로: 자르는 창을 넓히지 않는다(clip-path 없음, overflow 자름)', st.up === '0px' && st.clip === 'none' && /clip|hidden/.test(st.ov), `--flip-up ${st.up} · clip-path ${st.clip} · overflow ${st.ov}`);
    const sh = await p.evaluate(() => getComputedStyle(document.querySelector('#stage')).boxShadow);
    ok('웹(PC)의 책 카드 그림자가 그대로 있다', sh && sh !== 'none', sh);
    ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
    await p.close(); continue;
  }
  ok('책 위쪽 여유(--flip-up)가 ' + wantUp + 'px 이고, 자르는 창이 그만큼 위로 넓어져 있다', st.up === wantUp + 'px' && /inset\(/.test(st.clip) && st.ov === 'visible', `--flip-up ${st.up} · clip-path ${st.clip} · overflow ${st.ov}`);
  const shot = () => p.screenshot({ encoding: 'base64' });
  // 애니메이션을 잠시 멈춘다(requestAnimationFrame 보류) — 두 장을 찍는 사이 책장이 움직여 생기는 오차를 없앤다. 다시 켜면 이어서 진행한다.
  const freeze = async () => { await p.evaluate(() => { if (window.__raf) return; window.__raf = window.requestAnimationFrame; window.__q = []; window.requestAnimationFrame = (cb) => { window.__q.push(cb); return 0; }; }); await sleep(80); };
  const thaw = () => p.evaluate(() => { if (!window.__raf) return; window.requestAnimationFrame = window.__raf; const q = window.__q; window.__q = []; window.__raf = null; q.forEach((cb) => window.requestAnimationFrame(cb)); });
  const NOCLIP = '#stage{clip-path:none !important;overflow:visible !important}';
  const worstOf = async (label, ks, t0, ms) => {
    let worst = 0;
    for (const k of ks) { const wait = k * ms - (Date.now() - t0); if (wait > 0) await sleep(wait);
      await freeze();
      const a = await shot(); const sty = await p.addStyleTag({ content: NOCLIP }); await sleep(30); const v = await shot(); await p.evaluate((el) => el.remove(), sty);
      await thaw();
      const d = await diffUp(p, a, v, st); worst = Math.max(worst, d.up);
      if (k === ks[Math.floor(ks.length / 2)]) await p.screenshot({ path: `/tmp/flip1shots/${name.replace(/[ ()]/g, '')}-${label.replace(/[ ·:]/g, '')}.png` }); }
    return { worst };
  };
  // 0) 평소(넘기지 않을 때): 책 위로 아무것도 더 보이지 않는다
  { const a = await shot(); const sty = await p.addStyleTag({ content: NOCLIP }); await sleep(30); const v = await shot(); await p.evaluate((el) => el.remove(), sty); const d = await diffUp(p, a, v, st); ok('평소에는 책 위쪽 경계 밖으로 보이는 것이 없다', d.up === 0, `다른 화소 ${d.n}`); }
  // 1) 탭 넘김 — 앞으로(오른쪽 탭)
  const KS = [0.08, 0.15, 0.22, 0.3, 0.38, 0.46, 0.55, 0.65, 0.8];
  let t0 = Date.now(); await p.mouse.click(st.l + st.w * 0.9, st.t + st.h * 0.5); await sleep(200);
  let r = await worstOf('탭 다음', KS, t0, 12000);
  ok('탭 넘김(다음): 윗부분이 잘려 안 보이는 높이 ≤ ' + TOL + 'px', r.worst <= TOL, `최대 ${r.worst.toFixed(1)}px`);
  await sleep(Math.max(0, 12000 - (Date.now() - t0)) + 1200);
  // 2) 탭 넘김 — 뒤로(왼쪽 탭)
  t0 = Date.now(); await p.mouse.click(st.l + st.w * 0.1, st.t + st.h * 0.5); await sleep(200);
  r = await worstOf('탭 이전', KS, t0, 12000);
  ok('탭 넘김(이전): 윗부분이 잘려 안 보이는 높이 ≤ ' + TOL + 'px', r.worst <= TOL, `최대 ${r.worst.toFixed(1)}px`);
  await sleep(Math.max(0, 12000 - (Date.now() - t0)) + 1200);
  // 3) 끌기 — 아래 모서리(손가락이 아래쪽에서 시작, 위로 크게 움직임) / 위 모서리(위쪽에서 시작, 아래로 크게 움직임)
  for (const [lab, y0, y1] of [['끌기 아래 모서리', st.t + st.h * 0.8, st.t + st.h * 0.05], ['끌기 위 모서리', st.t + st.h * 0.2, st.t + st.h * 0.95]]) {
    const x0 = st.l + st.w - 60; let worst = 0, N = 16;
    await p.mouse.move(x0, y0); await p.mouse.down();
    for (let i = 1; i <= N; i++) {
      await p.mouse.move(x0 - i * (st.w * 0.8 / N), y0 + (y1 - y0) * (i / N)); await sleep(60);
      if (i < 3) continue;
      const a = await shot(); const sty = await p.addStyleTag({ content: NOCLIP }); await sleep(30); const v = await shot(); await p.evaluate((el) => el.remove(), sty);
      worst = Math.max(worst, (await diffUp(p, a, v, st)).up);
      if (i === 8) await p.screenshot({ path: `/tmp/flip1shots/${name.replace(/[ ()]/g, '')}-${lab.replace(/ /g, '')}.png` });
    }
    ok(lab + ': 윗부분이 잘려 안 보이는 높이 ≤ ' + TOL + 'px (손가락을 크게 위아래로 움직여도)', worst <= TOL, `최대 ${worst.toFixed(1)}px`);
    await p.mouse.move(x0, y0, { steps: 4 }); await p.mouse.up(); await sleep(1800);   // 제자리로
  }
  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await p.close();
}
await b.close(); console.log(fails ? `\nFAILS ${fails}` : '\nALL PASS'); process.exit(fails ? 1 : 0);
