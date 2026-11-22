// v62: 설정 화면 맨 아래 제작자 표시('© SEONHAN') 시험 — 모든 기기에서 보이고, 맨 끝에 있고, 잘리거나 가로로 넘치지 않고, 다른 화면에는 없다.
import { serve, launch, sleep, DEVICES, openDevice } from './devlib.mjs';
serve(8975); const b = await launch(); let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
const PICK = ['SE3 세로', '14 가로', '15Plus 세로', 'iPad mini 세로', 'Duo 펼침', 'Duo 접힘'];
const THEMES = ['paper', 'sepia', 'night'];

for (const name of PICK) {
  const dev = DEVICES.find((d) => d[0] === name);
  const { p, errs } = await openDevice(b, dev, { port: 8975 });
  await p.click('#btn-settings'); await sleep(600);
  const g = () => p.evaluate(() => {
    const c = document.querySelector('#sheet-body .credit'), body = document.querySelector('#sheet-body');
    if (!c) return null;
    const r = c.getBoundingClientRect(), br = body.getBoundingClientRect();
    return { text: c.textContent, last: body.lastElementChild === c, fs: parseFloat(getComputedStyle(c).fontSize), color: getComputedStyle(c).color,
      inW: r.left >= br.left - 0.5 && r.right <= br.right + 0.5, vis: r.bottom <= br.bottom + 0.5 && r.top >= br.top - 0.5, hOver: body.scrollWidth - body.clientWidth, centered: Math.abs((r.left + r.right) / 2 - (br.left + br.right) / 2) < 12, h: r.height };
  });
  let c = await g();
  ok(name + ': 설정 화면에 제작자 표시가 있다', !!c);
  if (c) {
    ok(name + ': 문구는 정확히 "© SEONHAN"', c.text === '© SEONHAN', JSON.stringify(c.text));
    ok(name + ': 설정 내용의 맨 마지막 요소다', c.last);
    // 맨 아래까지 내리면 완전히 보인다
    await p.evaluate(() => { const bd = document.querySelector('#sheet-body'); bd.scrollTop = bd.scrollHeight; }); await sleep(250);
    c = await g();
    ok(name + ': 끝까지 내리면 완전히 보인다(잘리지 않음)', c.vis && c.h > 8, JSON.stringify({ vis: c.vis, h: c.h }));
    ok(name + ': 가로로 넘치지 않고 가운데에 있다', c.inW && c.hOver <= 0 && c.centered, JSON.stringify({ inW: c.inW, hOver: c.hOver, centered: c.centered }));
    ok(name + ': 작고 흐린 글자(12px, 본문색과 다름)', c.fs === 12 && c.color !== 'rgb(0, 0, 0)', c.fs + 'px ' + c.color);
    await p.screenshot({ path: '/tmp/credit-' + name.replace(/\s/g, '') + '.png' });
  }
  // 다른 화면(고급설정·번역 선택·검색)에는 없다
  await p.click('#go-adv'); await sleep(400);
  ok(name + ': 고급설정 화면에는 없다', !(await p.evaluate(() => !!document.querySelector('#sheet-body .credit'))));
  await p.click('#sheet-back'); await sleep(400);
  ok(name + ': 설정으로 돌아오면 다시 한 번만 나온다', (await p.evaluate(() => document.querySelectorAll('#sheet-body .credit').length)) === 1);
  await p.click('#sheet-close'); await sleep(300);
  await p.click('#btn-search'); await sleep(500);
  ok(name + ': 검색 화면에는 없다', !(await p.evaluate(() => !!document.querySelector('#sheet-body .credit'))));
  ok(name + ': 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// 테마 3가지에서 글자가 배경과 구분되는지(대비) — 한 기기에서
{ const dev = DEVICES.find((d) => d[0] === '15Plus 세로');
  for (const th of THEMES) {
    const { p } = await openDevice(b, dev, { port: 8975, seed: { fn: (t) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('bf.settings', JSON.stringify({ theme: t })); } }, arg: th } });
    await p.click('#btn-settings'); await sleep(600);
    const r = await p.evaluate(() => {
      const c = document.querySelector('#sheet-body .credit'), cs = getComputedStyle(c);
      const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const lumRGB = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
      const bgc = parse(getComputedStyle(document.querySelector('.panel')).backgroundColor), fg = parse(cs.color);
      const mix = { r: fg.r * fg.a + bgc.r * (1 - fg.a), g: fg.g * fg.a + bgc.g * (1 - fg.a), b: fg.b * fg.a + bgc.b * (1 - fg.a) };   // 반투명 글자를 배경 위에 섞은 실제 색
      const a = lumRGB(mix), bgl = lumRGB(bgc), hi = Math.max(a, bgl), lo = Math.min(a, bgl);
      const bg = getComputedStyle(document.querySelector('.panel')).backgroundColor;
      return { ratio: +((hi + .05) / (lo + .05)).toFixed(2), color: cs.color, bg };
    });
    ok('테마 ' + th + ': 글자·배경 대비 4.5:1 이상', r.ratio >= 4.5, JSON.stringify(r));
    await p.close();
  } }
await b.close();
console.log(fails ? 'FAILS ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
