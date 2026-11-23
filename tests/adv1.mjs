// v68 — 설정·고급설정 화면 개편 시험:
//  ① 설정 맨 아래의 안내문('자동: …', '본문: 개역한글 (퍼블릭 도메인)')이 없고 제작자 표시만 남는다
//  ② 고급설정에 '화면 정보'·'화면 진단'이 없다   ③ 각 항목의 설명은 ⓘ(동그라미 물음표)를 눌러야 보인다
//  ④ '다시 맞추기'·'앱 다시 시작'이 나란히 놓인 두 버튼이고, 누르면 바로 적용된다   ⑤ 지도 방식(래스터)·열쇠 입력 화면이 없다
// 주의: PC 크롬 모의다. 실제 아이폰에서의 손가락 누름·다시 시작(웹뷰 새로 읽기)은 실기기에서 확인한다.
import { serve, launch, sleep, DEVICES, openDevice } from './devlib.mjs';
serve(8977); const b = await launch(); let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
const PICK = ['SE3 세로', '15 세로', '14 가로', 'iPad mini 세로', 'Duo 펼침', 'Duo 접힘'];
const settle = async (p) => { await sleep(450); await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 30000 }); await sleep(250); };   // 값을 바꾸면 책을 다시 만드는 동안 로딩 막이 잠시 화면을 덮는다
const body = (p) => p.evaluate(() => document.querySelector('#sheet-body').innerText);

for (const name of PICK) {
  const dev = DEVICES.find((d) => d[0] === name);
  const { p, errs } = await openDevice(b, dev, { port: 8977 });
  await p.click('#btn-settings'); await sleep(600);
  // ① 설정 화면
  let t = await body(p);
  ok(name + ': 설정에 "자동: 화면이 넓으면" 안내문이 없다', !t.includes('화면이 넓으면') && !t.includes('펼친 상태') && !t.includes('접힌 상태'));
  ok(name + ': 설정에 "개역한글 (퍼블릭 도메인)" 안내문이 없다', !t.includes('퍼블릭 도메인') && !t.includes('본문: 개역한글'));
  ok(name + ': 설정에 제작자 표시(© SEONHAN)는 남아 있다', t.includes('© SEONHAN'));
  ok(name + ': 고급설정 줄에 "화면 정보"·"지도" 글자가 없다', await p.evaluate(() => { const s = document.querySelector('#go-adv .sub').textContent; return !s.includes('화면 정보') && !s.includes('지도'); }), await p.evaluate(() => document.querySelector('#go-adv .sub').textContent));
  await p.click('#go-adv'); await sleep(500);
  // ② 화면 정보·진단 없음
  t = await body(p);
  ok(name + ': 고급설정에 "화면 정보"·"화면 진단"이 없다', !t.includes('화면 정보') && !t.includes('화면 진단') && !t.includes('안전영역 위') && !t.includes('최근 화면 기록') && !(await p.evaluate(() => !!document.querySelector('.diag'))));
  ok(name + ': 앱 버전·기기 화면 크기 같은 정보 줄도 없다', !/앱 버전|DPR|배율 \d/.test(t));
  // ⑤ 지도 방식·열쇠 화면 없음
  ok(name + ': 지도 방식(벡터/래스터) 단추·열쇠 입력 칸이 없다', await p.evaluate(() => !document.querySelector('#me-raster, #me-vector, #mk-in, #mk-save, #mk-open, #mk-clear')) && !t.includes('래스터') && !t.includes('CARTO') && !t.includes('열쇠'));
  // ③ ⓘ 설명
  const keys = await p.evaluate(() => [...document.querySelectorAll('#sheet-body .qm')].map((q) => q.dataset.q));
  const want = name.includes('Duo') || true ? ['topSpread', 'bottomSpread', 'topSingle', 'defaults', 'recover'] : [];
  ok(name + ': ⓘ 단추가 항목마다 있다(' + keys.join(',') + ')', want.every((k) => keys.includes(k)) && keys.length >= want.length, JSON.stringify(keys));
  const st = () => p.evaluate(() => [...document.querySelectorAll('#sheet-body .qm')].map((q) => ({ k: q.dataset.q, ex: q.getAttribute('aria-expanded'), hid: document.getElementById(q.getAttribute('aria-controls')).hidden })));
  let s0 = await st();
  ok(name + ': 처음에는 모든 설명이 접혀 있다(보이지 않음)', s0.every((x) => x.ex === 'false' && x.hid), JSON.stringify(s0));
  ok(name + ': 접힌 설명 문장은 화면 글에 나오지 않는다', !t.includes('본문이 시작되는 곳까지의 높이') && !t.includes('본문 맨 아래에 비워 두는') && !t.includes('책을 다시 만듭니다') && !t.includes('기본값은 기기와 화면에 맞춰'));
  const q1 = await p.evaluate(() => { const q = document.querySelector('.qm[data-q="topSpread"]'); const r = q.getBoundingClientRect(); const cs = getComputedStyle(q); return { w: r.width, h: r.height, radius: cs.borderRadius, txt: q.textContent }; });
  ok(name + ': ⓘ는 동그라미(20px, 둥근 테두리)에 "?" 글자', q1.txt === '?' && Math.round(q1.w) === 20 && Math.round(q1.h) === 20 && /50%|10px/.test(q1.radius), JSON.stringify(q1));
  await p.click('.qm[data-q="topSpread"]'); await sleep(200);
  s0 = await st(); const o = s0.find((x) => x.k === 'topSpread');
  ok(name + ': ⓘ를 누르면 그 항목의 설명만 펼쳐진다', o.ex === 'true' && !o.hid && s0.filter((x) => x.k !== 'topSpread').every((x) => x.hid), JSON.stringify(s0));
  t = await body(p);
  ok(name + ': 펼친 설명 글이 보인다', t.includes('본문이 시작되는 곳까지의 높이'));
  // 값을 바꿔 화면이 다시 그려져도 열어 둔 설명은 그대로
  const v0 = await p.evaluate(() => document.querySelector('[data-adv="topSpread"][data-step="4"]').previousElementSibling.textContent);
  await p.click('[data-adv="topSpread"][data-step="4"]'); await settle(p);
  const v1 = await p.evaluate(() => document.querySelector('[data-adv="topSpread"][data-step="4"]').previousElementSibling.textContent);
  s0 = await st();
  ok(name + ': 값(' + v0 + '→' + v1 + ')을 바꿔 다시 그려도 열어 둔 설명은 열린 채', +v1 !== +v0 && s0.find((x) => x.k === 'topSpread').ex === 'true' && !s0.find((x) => x.k === 'topSpread').hid);
  await p.click('.qm[data-q="topSpread"]'); await sleep(150);
  ok(name + ': 다시 누르면 접힌다', (await st()).find((x) => x.k === 'topSpread').hid);
  await p.click('[data-adv="topSpread"][data-step="-4"]'); await settle(p);   // 값을 되돌려 둔다
  // 되돌리기·복구 설명도 ⓘ
  await p.click('.qm[data-q="defaults"]'); await sleep(150); await p.click('.qm[data-q="recover"]'); await sleep(150);
  t = await body(p);
  ok(name + ': 기본값 설명과 복구 설명도 ⓘ로 열린다', t.includes('기본값은 기기와 화면에 맞춰') && t.includes('다시 맞추기는 화면 값을 새로 읽고'));
  // ④ 두 버튼 나열
  const bt = await p.evaluate(() => { const a = document.querySelector('#adv-refit'), c = document.querySelector('#adv-restart'); const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect(), bd = document.querySelector('#sheet-body').getBoundingClientRect();
    return { ta: a.textContent, tc: c.textContent, sameRow: Math.abs(ra.top - rc.top) < 1 && Math.abs(ra.height - rc.height) < 1, gap: Math.round(rc.left - ra.right), wa: Math.round(ra.width), wc: Math.round(rc.width), inside: ra.left >= bd.left - 0.5 && rc.right <= bd.right + 0.5, hOver: document.querySelector('#sheet-body').scrollWidth - document.querySelector('#sheet-body').clientWidth, h: Math.round(ra.height) }; });
  ok(name + ': 버튼 글자는 "다시 맞추기" · "앱 다시 시작"', bt.ta === '다시 맞추기' && bt.tc === '앱 다시 시작', JSON.stringify(bt));
  ok(name + ': 두 버튼이 한 줄에 나란히(같은 높이·간격 8~12px·화면 안에·가로로 안 넘침)', bt.sameRow && bt.gap >= 8 && bt.gap <= 12 && bt.inside && bt.hOver <= 0, JSON.stringify(bt));
  ok(name + ': 두 버튼 폭이 거의 같고 누르기 편한 높이(40px 이상)', Math.abs(bt.wa - bt.wc) <= 2 && bt.h >= 40, bt.wa + '/' + bt.wc + ' h' + bt.h);
  await p.screenshot({ path: '/tmp/adv1-' + name.replace(/\s/g, '') + '.png' });
  // 다시 맞추기: 누르면 바로 설정창이 닫히고 책이 다시 만들어진다(오류 없이)
  await p.evaluate(() => { document.querySelector('#sheet-body').scrollTop = 99999; });
  await p.click('#adv-refit'); await sleep(1800);
  ok(name + ': 다시 맞추기를 누르면 설정창이 닫히고 책이 보인다', await p.evaluate(() => { const sh = document.querySelector('#sheet'); return !!sh && (sh.hidden || !sh.classList.contains('open')) && document.querySelector('#loading')?.hidden === true; }));
  ok(name + ': 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}

// 앱 다시 시작: 누르면 바로 페이지가 새로 읽히고 읽던 위치·기록이 남는다
{
  const dev = DEVICES.find((d) => d[0] === '15 세로');
  const { p, errs } = await openDevice(b, dev, { port: 8977 });
  await p.evaluate(() => { window.__mark = 'before'; });
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  const nav = p.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).then(() => true, () => false);
  await p.click('#adv-restart');
  ok('앱 다시 시작: 누르는 즉시 페이지가 새로 읽힌다(확인 단계 없음)', await nav);
  await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 60000 }); await sleep(800);
  ok('앱 다시 시작: 새로 읽힌 뒤 화면 상태가 초기화됐다(이전 변수 없음)', (await p.evaluate(() => window.__mark)) === undefined);
  const rec = await p.evaluate(() => JSON.parse(localStorage.getItem('bf.rec') || 'null'));
  ok('앱 다시 시작: 직접 다시 시작이 기록됐다(bf.rec: n=1, auto=false)', rec && rec.n === 1 && rec.auto === false && rec.why === '직접', JSON.stringify(rec));
  ok('앱 다시 시작: 예전 화면 기록(bf.snaps)은 남기지 않는다', (await p.evaluate(() => localStorage.getItem('bf.snaps'))) === null);
  ok('앱 다시 시작: 오류 없음', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await p.close();
}
console.log(fails ? '\nFAILS ' + fails : '\nALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
