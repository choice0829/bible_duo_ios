// v71 — 하이라이트 도구 상자 터치 시험. (제보: 길게 눌러 낱말을 고른 뒤 하이라이트를 터치하면 처음에는 반응이 없다가 연달아 터치해야 적용된다)
//  ① 길게 누르기 → 손 떼기 → '형광' 터치가 첫 터치에 적용된다 (손 뗀 뒤 0·400·1000ms)
//  ② 아이폰이 click 을 만들어 주지 않는 경우(모의: #ann-bar 안의 click 을 삼킴)에도 첫 터치에 적용된다  ← v70 은 여기서 실패
//  ③ 단추를 누르는 순간 도구 상자가 사라진 자리에 따라오는 click(아이폰은 손 뗀 뒤 그 자리를 다시 찾아 click 을 보낸다)이 아래 요소를 누르지 않는다
//  ④ 서로 다른 단추를 빠르게 연달아 눌러도 둘 다 먹는다 (같은 터치의 click 중복만 막는다)
//  ⑤ 단추 위에서 손가락을 끌어 벗어나면 적용되지 않는다
// 주의: PC 크롬 모의다. 아이폰(WKWebView)이 실제로 click 을 빼먹는지, 손 뗀 뒤 click 을 어디로 보내는지는 실기기에서 확인한다.
import { serve, launch, sleep, DEVICES, openDevice } from './devlib.mjs';
serve(8991); const b = await launch(); let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
const seed = { fn: () => { localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 })); localStorage.removeItem('bf.ann'); localStorage.removeItem('bf.tool'); } };
const PICK = (process.argv[2] ? process.argv[2].split(',') : ['Duo 펼침', '15 세로']);
const touch = (cdp, type, pt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: pt.x, y: pt.y, id: 1 }] });
const tap = async (cdp, pt, hold = 60) => { await touch(cdp, 'touchStart', pt); await sleep(hold); await touch(cdp, 'touchEnd', pt); };
// 손 뗀 뒤 아이폰이 그 자리를 다시 찾아 보내는 click 을 흉내 낸다. (아이폰은 포인터 이벤트 없이 click 만 보낸다. CDP 마우스 클릭은 pointerdown/up 까지 만들어 실제와 다르다)
const ghostClick = (p, pt) => p.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window }));
}, pt);

// 화면을 열고 낱말 하나를 길게 눌러 고른다. where: 'upper' → 도구 상자가 아래, 'lower' → 도구 상자가 위
async function openAndSelect(dev, where, gap = 0) {
  const { p, cdp, errs } = await openDevice(b, dev, { port: 8991, seed });
  const pt = await p.evaluate((w) => {
    const ps = [...document.querySelectorAll('#stage p[data-k]')].filter((q) => { const r = q.getBoundingClientRect(); return r.width > 60 && r.height > 14 && r.top > 110 && r.bottom < innerHeight - 20; });
    const half = innerHeight * 0.5;
    const c = ps.filter((q) => { const r = q.getBoundingClientRect(); return w === 'upper' ? r.top + 8 < half * 0.8 : r.top + 8 > half * 1.15; });
    const q = c[0] || ps[Math.min(2, ps.length - 1)], r = q.getBoundingClientRect();
    return { x: r.left + Math.min(r.width * 0.3, 90), y: r.top + 8 };
  }, where);
  await touch(cdp, 'touchStart', pt); await sleep(750); await touch(cdp, 'touchEnd', pt);   // 길게 눌러 낱말 고르기
  await sleep(gap);
  return { p, cdp, errs };
}
const center = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const saved = (p) => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bf.ann') || '{}')).length);
const barHidden = (p) => p.evaluate(() => document.querySelector('#ann-bar').hidden);
const FILL = '#ab-kinds button[data-kind="fill"]';

for (const name of PICK) {
  const dev = DEVICES.find((d) => d[0] === name);

  // ① 첫 터치로 적용
  for (const gap of [0, 400, 1000]) {
    const { p, cdp, errs } = await openAndSelect(dev, 'upper', gap);
    ok(name + ' · 손 뗀 뒤 ' + gap + 'ms: 도구 상자 보임', !(await barHidden(p)));
    const btn = await center(p, FILL);
    await tap(cdp, btn); await sleep(250);
    ok(name + ' · 손 뗀 뒤 ' + gap + 'ms: 첫 터치로 적용·도구 상자 닫힘', (await saved(p)) === 1 && (await barHidden(p)));
    ok(name + ' · 오류 없음', errs.length === 0, errs.join('|'));
    await p.close();
  }

  // ② click 이 빠져도 첫 터치로 적용
  {
    const { p, cdp } = await openAndSelect(dev, 'upper', 300);
    await p.evaluate(() => window.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#ann-bar')) { e.stopImmediatePropagation(); e.stopPropagation(); } }, true));
    const btn = await center(p, FILL);
    await tap(cdp, btn); await sleep(300);
    ok(name + ' · click 이 빠져도 첫 터치로 적용', (await saved(p)) === 1 && (await barHidden(p)));
    await p.close();
  }

  // ③ 따라오는 click 이 도구 상자 아래 요소를 누르지 않는다 (도구 상자가 위에 뜨면 머리줄과 겹친다)
  for (const target of [FILL, '#ab-close', '#ab-erase']) {
    const { p, cdp, errs } = await openAndSelect(dev, 'lower', 300);
    await p.evaluate(() => {
      window.__stray = [];
      document.addEventListener('click', (e) => { if (!(e.target.closest && e.target.closest('#ann-bar'))) window.__stray.push((e.target.id || e.target.className || e.target.tagName) + ''); }, true);
    });
    const pt = await center(p, target);
    await tap(cdp, pt); await sleep(30);
    const under = await p.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); const bt = el && el.closest && el.closest('button'); return (bt && (bt.id || bt.className)) || (el && (el.id || el.tagName)) || ''; }, pt);
    await ghostClick(p, pt); await sleep(300);
    const stray = await p.evaluate(() => window.__stray.join(','));
    const sheetOpen = await p.evaluate(() => !document.querySelector('#sheet').hidden);
    ok(name + ' · 도구 상자가 위: ' + target + ' 뒤따르는 click 차단', stray === '' && !sheetOpen, '아래에 있던 요소=' + under + ' / 새어 나간 click=' + (stray || '없음') + ' / 창 열림=' + sheetOpen);
    ok(name + ' · 오류 없음', errs.length === 0, errs.join('|'));
    await p.close();
  }

  // ④ 서로 다른 단추를 빠르게 연달아
  {
    const { p, cdp } = await openAndSelect(dev, 'upper', 300);
    const c2 = await center(p, '#ab-colors .dot[data-c="2"]'), pen = await center(p, '#ab-pens button[data-pen="pencil"]');
    await tap(cdp, c2, 40); await sleep(60); await tap(cdp, pen, 40); await sleep(300);
    const tool = await p.evaluate(() => JSON.parse(localStorage.getItem('bf.tool') || 'null'));
    ok(name + ' · 색→펜을 빠르게 눌러도 둘 다 바뀜', !!tool && tool.c === 2 && tool.pen === 'pencil', JSON.stringify(tool));
    await p.close();
  }

  // ⑤ 단추 위에서 끌어 벗어나면 적용되지 않는다
  {
    const { p, cdp } = await openAndSelect(dev, 'upper', 300);
    const btn = await center(p, FILL);
    await touch(cdp, 'touchStart', btn); await sleep(40);
    await touch(cdp, 'touchMove', { x: btn.x + 8, y: btn.y - 40 }); await sleep(40);
    await touch(cdp, 'touchMove', { x: btn.x + 16, y: btn.y - 80 }); await sleep(40);
    await touch(cdp, 'touchEnd', { x: btn.x + 16, y: btn.y - 80 }); await sleep(300);
    ok(name + ' · 단추에서 끌어 벗어나면 적용 안 됨', (await saved(p)) === 0 && !(await barHidden(p)));
    await p.close();
  }
}
await b.close(); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
