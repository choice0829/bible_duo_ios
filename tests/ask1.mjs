// v70 — 문의하기(머리줄 아이콘) 시험. (v69에서 설정 안에 있던 문의하기를 머리줄의 별도 아이콘으로 옮기고, 후원하기는 삭제했다.)
//  ① 머리줄 아이콘 8개(검색·하이라이트·노트·바이블 포토 카드·지도·문의하기·내 계정·설정, v77) — 한 쪽(접힘·세로) 화면은 윗줄 4개·아랫줄 4개, 펼친 화면은 한 줄
//  ② 설정에는 문의하기·후원하기 줄이 없고, 화면 어디에도 '후원' 글자가 없다
//  ③ 문의하기: 제목·내용 검사, 앱(메일 작성 창)으로 보내는 내용(받는 사람·제목·본문·사진), 결과별 안내(보냄·취소·저장·실패·계정 없음·다른 창),
//     사진 추가(최대 3장·큰 사진은 줄임·빼기), 쓰던 글 유지, 받는 주소가 비어 있을 때 / 앱이 아닐 때의 대체 방법
// 주의: PC 크롬 모의다. 실제 아이폰의 메일 작성 창·사진 고르기는 실기기에서 확인한다.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { serve, launch, sleep, DEVICES } from './devlib.mjs';
serve(8985); const b = await launch(); let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
const PICK = ['SE3 세로', '15 세로', '14 가로', 'Duo 펼침', 'Duo 접힘'];
const HEAD_PICK = ['SE3 세로', '12mini 세로', '15 세로', '16ProMax 세로', 'SE3 가로', '14 가로', '15Plus 가로', 'iPad mini 세로', 'Duo 펼침', 'Duo 접힘'];
const MAIL = 'test@example.com';
const APPVER = fs.readFileSync(new URL('../www/app.js', import.meta.url), 'utf8').match(/APP_VER = '(v\d+)'/)[1];   // 버전을 올려도 시험을 고치지 않게 코드에서 읽는다
const IDS = ['btn-search', 'btn-hl', 'btn-notes', 'btn-card', 'btn-map', 'btn-ask', 'btn-acct', 'btn-settings'];   // v77: 내 계정(사람) 아이콘 추가

// 앱(껍데기) 모의: 보낸 메시지를 __msgs 에 모으고, 메일 요청에는 __mailResult 대로 답한다.
const seed = { fn: () => {
  window.__msgs = []; window.__mailResult = 'sent';
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => {
    window.__msgs.push(JSON.parse(JSON.stringify(m)));
    if (m.mail) setTimeout(() => window.bfMail && window.bfMail({ id: m.id, result: window.__mailResult }), 60);
  } } } };
  localStorage.setItem('bf.pos', JSON.stringify({ book: 0, chapter: 0, verse: 1 }));
} };
const open = async (dev, { addr = MAIL, native = true, book = null } = {}) => {
  const [, w, h, si] = dev; const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.createCDPSession();
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: si.top, left: si.left, bottom: si.bottom, right: si.right } }); } catch (e) { /* 무시 */ }
  await p.setRequestInterception(true);
  p.on('request', async (req) => {
    if (/\/app\.js(\?|$)/.test(req.url())) {
      let t = fs.readFileSync(new URL('../www/app.js', import.meta.url), 'utf8');
      const re = /const INQUIRY_EMAIL = '[^']*';/;
      if (!re.test(t)) throw new Error('INQUIRY_EMAIL 줄을 찾지 못했습니다');
      t = t.replace(re, "const INQUIRY_EMAIL = '" + addr + "';");   // 시험용 주소로 바꿔 끼운다(실제 주소로 메일이 가지 않음)
      req.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: t });
    } else req.continue();
  });
  // 서비스 워커가 예전에 저장해 둔 app.js(원본 주소)를 내주면 바꿔 끼운 주소가 무시되므로, 시험 화면에서는 서비스 워커를 쓰지 않는다
  await p.evaluateOnNewDocument(() => { try { Object.defineProperty(navigator, 'serviceWorker', { value: { register: () => Promise.reject(new Error('시험에서는 사용 안 함')), controller: null }, configurable: true }); } catch (e) { /* 무시 */ } });
  await p.evaluateOnNewDocument(seed.fn);
  if (book !== null) await p.evaluateOnNewDocument((bk) => { localStorage.setItem('bf.pos', JSON.stringify({ book: bk, chapter: 0, verse: 1 })); }, book);
  await p.goto('http://localhost:8985/index.html' + (native ? '?native=1' : ''));
  await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  return { p, errs };
};
const body = (p) => p.evaluate(() => document.querySelector('#sheet-body').innerText);
const msgs = (p) => p.evaluate(() => window.__msgs);
const typeIn = async (p, sel, text) => { await p.click(sel); await p.evaluate((s) => { document.querySelector(s).value = ''; }, sel); await p.type(sel, text); };
const msgText = (p) => p.evaluate(() => document.querySelector('#ask-msg')?.textContent.trim());
const inSheet = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s), sh = document.querySelector('#sheet'); if (!e || !sh) return false; e.scrollIntoView({ block: 'center' }); const a = e.getBoundingClientRect(), c = sh.getBoundingClientRect(); return a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && a.left >= c.left - 1 && a.right <= c.right + 1; }, sel);
const openAsk = async (p) => { await p.click('#btn-ask'); await sleep(450); };
const closeSheet = async (p) => { await p.click('#sheet-close'); await sleep(300); };

// 큰 사진 파일(3000×2000)과 작은 사진 파일 만들기
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ask1-'));
{
  const { p } = await open(DEVICES.find((d) => d[0] === '15 세로'));
  const big = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d'); for (let i = 0; i < 400; i++) { x.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 40) + '%)'; x.fillRect((i * 97) % 3000, (i * 53) % 2000, 300 + i % 200, 200 + i % 150); } return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(path.join(tmp, 'big.png'), Buffer.from(big, 'base64'));
  for (const n of [1, 2, 3, 4]) fs.writeFileSync(path.join(tmp, 's' + n + '.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await p.close();
}

// ① 머리줄 아이콘 배열 (기기 여러 가지)
for (const name of HEAD_PICK) {
  const dev = DEVICES.find((d) => d[0] === name);
  const { p, errs } = await open(dev);
  const r = await p.evaluate(() => {
    const bs = [...document.querySelectorAll('.menu-row > button')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
    const ti = document.querySelector('#btn-pick').getBoundingClientRect();
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--headh')) || 0;
    return { bs, ti: { r: ti.right, b: ti.bottom }, spread: document.body.classList.contains('is-spread'), headh: hh, W: innerWidth, H: innerHeight, hr: document.querySelector('.head-row').getBoundingClientRect().bottom };
  });
  const rows = {}; r.bs.forEach((x) => { const k = Math.round(x.t / 6); (rows[k] = rows[k] || []).push(x); });
  const rowList = Object.keys(rows).map(Number).sort((a, c) => a - c).map((k) => rows[k].sort((a, c) => a.l - c.l));
  ok(name + ': 아이콘 8개가 순서대로(검색·하이라이트·노트·포토 카드·지도·문의하기·내 계정·설정)', JSON.stringify(r.bs.map((x) => x.id)) === JSON.stringify(IDS), r.bs.map((x) => x.id).join(','));
  ok(name + ': 모두 화면 안에 있다', r.bs.every((x) => x.l >= 0 && x.r <= r.W && x.t >= 0 && x.b <= r.H));
  const overlap = r.bs.some((a, i) => r.bs.some((c, j) => j > i && a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5));
  ok(name + ': 아이콘끼리 겹치지 않는다', !overlap);
  ok(name + ': 책 이름과 아이콘이 겹치지 않는다', r.ti.r <= Math.min(...r.bs.map((x) => x.l)) + 1, 'title.r=' + Math.round(r.ti.r) + ' menu.l=' + Math.round(Math.min(...r.bs.map((x) => x.l))));
  if (r.spread) {
    ok(name + ': 펼친 화면은 한 줄', rowList.length === 1, 'rows=' + rowList.length);
  } else {
    ok(name + ': 한 쪽 화면은 두 줄 — 윗줄 4개 · 아랫줄 4개 (v77)', rowList.length === 2 && rowList[0].length === 4 && rowList[1].length === 4, rowList.map((x) => x.length).join('+'));
    if (rowList.length === 2 && rowList[0].length === 4 && rowList[1].length === 4) {
      ok(name + ': 윗줄은 검색·하이라이트·노트·포토 카드, 아랫줄은 지도·문의하기·내 계정·설정', rowList[0].map((x) => x.id).join() === 'btn-search,btn-hl,btn-notes,btn-card' && rowList[1].map((x) => x.id).join() === 'btn-map,btn-ask,btn-acct,btn-settings');
      const top = rowList[0], bot = rowList[1];
      ok(name + ': 두 줄 모두 오른쪽 끝이 같다(오른쪽 맞춤)', Math.abs(top[3].r - bot[3].r) < 1.5, Math.round(top[3].r) + ' / ' + Math.round(bot[3].r));
      ok(name + ': 윗줄 아이콘이 아랫줄 아이콘 위에 줄 맞춰 있다', [0, 1, 2, 3].every((i) => Math.abs(top[i].l - bot[i].l) < 1.5), top.map((x) => Math.round(x.l)).join(',') + ' / ' + bot.map((x) => Math.round(x.l)).join(','));
      ok(name + ': 아랫줄 간격이 고르다', Math.abs((bot[1].l - bot[0].r) - (bot[3].l - bot[2].r)) < 1.5);
    }
    ok(name + ': 머리줄이 본문 시작 높이(--headh)를 넘지 않는다', r.hr <= r.headh + 0.5, 'head.bottom=' + Math.round(r.hr) + ' headh=' + Math.round(r.headh));
  }
  ok(name + ': 아이콘 누르는 크기 32px 이상', r.bs.every((x) => x.w >= 37 && x.h >= 32), r.bs.map((x) => Math.round(x.w) + '×' + Math.round(x.h))[0]);
  ok(name + ': 문의하기 아이콘에 이름표(aria-label)가 있다', await p.evaluate(() => document.querySelector('#btn-ask').getAttribute('aria-label') === '문의하기' && !!document.querySelector('#btn-ask svg')));
  ok(name + ': 화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await p.close();
}

// 긴 책 이름도 잘리지 않는다(이름이 길면 글자가 자동으로 줄어듦). 아이콘이 4열이 되어 책 이름 자리가 좁아진 한 쪽 화면에서 확인한다.
for (const name of ['SE3 세로', '16ProMax 세로', 'Duo 접힘']) {
  const dev = DEVICES.find((d) => d[0] === name);
  for (const [bk, nm] of [[52, '데살로니가후서'], [65, '요한계시록'], [45, '고린도전서']]) {
    const { p } = await open(dev, { book: bk });
    const t = await p.evaluate(() => { const e = document.querySelector('#loc-book'); const ti = document.querySelector('#btn-pick').getBoundingClientRect(); const ml = Math.min(...[...document.querySelectorAll('.menu-row > button')].map((x) => x.getBoundingClientRect().left)); return { txt: e.textContent, cut: e.scrollWidth > e.clientWidth + 1, fs: parseFloat(getComputedStyle(e).fontSize), gap: ml - ti.right }; });
    ok(name + ': 책 이름 "' + nm + '"이 잘리지 않고 아이콘과 겹치지 않는다', t.txt === nm && !t.cut && t.fs >= 16 && t.gap >= -1, JSON.stringify(t));
    await p.close();
  }
}

// ②·③ 문의하기
for (const name of PICK) {
  const dev = DEVICES.find((d) => d[0] === name);
  const { p, errs } = await open(dev);
  // ② 설정에는 문의하기·후원하기가 없다
  await p.click('#btn-settings'); await sleep(500);
  const order = await p.evaluate(() => [...document.querySelectorAll('#sheet-body > *')].map((e) => e.id || e.className.split(' ')[0]));
  const t0 = await body(p);
  ok(name + ': 설정에는 문의하기·후원하기 줄이 없고 고급설정 다음에 제작자 표시가 온다', !order.includes('go-ask') && !order.includes('go-sup') && order.indexOf('credit') === order.indexOf('go-adv') + 1 && !t0.includes('문의하기') && !t0.includes('후원'), order.join(','));
  await closeSheet(p);

  // ③ 문의하기
  await openAsk(p);
  ok(name + ': 문의하기 아이콘 → 제목 "문의하기"이고 돌아가기 없이 닫기만 있다', await p.evaluate(() => !document.querySelector('#sheet').hidden && document.querySelector('#sheet-title').textContent === '문의하기' && document.querySelector('#sheet-back').hidden));
  ok(name + ': 화면 어디에도 "후원" 글자가 없다', !(await p.evaluate(() => document.body.innerText)).includes('후원') && await p.evaluate(() => typeof window.bfSupport === 'undefined'));
  ok(name + ': 받는 주소가 설정되어 있으면 경고가 없다', await p.evaluate(() => !document.querySelector('.ask-warn')));
  ok(name + ': 가로로 넘치지 않는다', await p.evaluate(() => { const b = document.querySelector('#sheet-body'); return b.scrollWidth <= b.clientWidth + 1; }));
  ok(name + ': 보내기 단추가 창 안에서 눌린다', await inSheet(p, '#ask-send'));
  await p.click('#ask-send'); await sleep(150);
  ok(name + ': 제목이 비면 안내하고 보내지 않는다', (await msgText(p)).includes('제목') && (await msgs(p)).filter((m) => m.mail).length === 0);
  await typeIn(p, '#ask-title', '글자가 겹칩니다');
  await p.click('#ask-send'); await sleep(150);
  ok(name + ': 내용이 비면 안내하고 보내지 않는다', (await msgText(p)).includes('내용') && (await msgs(p)).filter((m) => m.mail).length === 0);
  await typeIn(p, '#ask-body', '모임 장소 화면에서 카드 글자가 겹쳐 보입니다.\n두 번째 줄.');
  ok(name + ': 글자 수가 보인다', (await p.evaluate(() => document.querySelector('#ask-count').textContent)).includes('/2000'));
  // 쓰던 글은 닫았다 다시 열어도 남는다
  await closeSheet(p); await openAsk(p);
  ok(name + ': 닫았다 다시 열어도 쓰던 제목·내용이 남아 있다', await p.evaluate(() => document.querySelector('#ask-title').value === '글자가 겹칩니다' && document.querySelector('#ask-body').value.includes('두 번째 줄')));
  // 취소
  await p.evaluate(() => { window.__mailResult = 'cancelled'; });
  await p.click('#ask-send'); await sleep(400);
  let m = (await msgs(p)).filter((x) => x.mail);
  ok(name + ': 앱으로 보낸 메시지: 받는 사람·제목 머리말·본문·앱 버전', m.length === 1 && m[0].mail.to === MAIL && m[0].mail.subject === '[앱 문의] 글자가 겹칩니다' && m[0].mail.body.includes('카드 글자가 겹쳐') && m[0].mail.body.includes('앱 ' + APPVER) && Array.isArray(m[0].mail.photos) && m[0].mail.photos.length === 0 && typeof m[0].id === 'number', JSON.stringify(m[0] && m[0].mail).slice(0, 200));
  ok(name + ': 취소하면 안내하고 쓰던 글은 그대로', (await msgText(p)).includes('취소') && await p.evaluate(() => document.querySelector('#ask-title').value !== '' && !document.querySelector('#ask-send').disabled));
  for (const [res, word] of [['saved', '임시 보관함'], ['failed', '보내지 못했습니다'], ['busy', '다른 창']]) {
    await p.evaluate((r) => { window.__mailResult = r; }, res); await p.click('#ask-send'); await sleep(400);
    ok(name + ': 결과 ' + res + ' → "' + word + '" 안내', (await msgText(p)).includes(word) && await p.evaluate(() => !document.querySelector('#ask-send').disabled));
  }
  // 계정 없음 → 대체 방법
  await p.evaluate(() => { window.__mailResult = 'unavailable'; }); await p.click('#ask-send'); await sleep(400);
  const fb = await p.evaluate(() => { const f = document.querySelector('#ask-fb'); return { shown: !f.hidden, txt: f.innerText, href: f.querySelector('a.ask-mailto')?.getAttribute('href') || '', btns: [...f.querySelectorAll('button')].map((x) => x.textContent) }; });
  ok(name + ': 메일 계정이 없으면 주소 표시·복사 단추·기본 메일 앱 링크를 보여 준다', fb.shown && fb.txt.includes(MAIL) && fb.btns.includes('주소 복사') && fb.btns.includes('제목·내용 복사') && fb.href.startsWith('mailto:' + MAIL + '?subject=') && fb.href.includes(encodeURIComponent('[앱 문의] 글자가 겹칩니다')), JSON.stringify(fb).slice(0, 220));
  await p.click('#ask-c-addr'); await sleep(300);
  ok(name + ': 주소 복사 단추가 결과를 알려 준다', /주소를 복사했습니다|복사가 안 됐습니다/.test(await msgText(p)));
  ok(name + ': 대체 방법 칸도 창 안에서 보인다', await inSheet(p, '#ask-fb .ask-mailto'));
  await p.type('#ask-body', ' 추가');
  ok(name + ': 글을 고치면 대체 방법 칸이 사라진다', await p.evaluate(() => document.querySelector('#ask-fb').hidden));
  // 보냄 → 내용 비움
  await p.evaluate(() => { window.__mailResult = 'sent'; }); await p.click('#ask-send'); await sleep(400);
  ok(name + ': 보내면 감사 안내가 나오고 제목·내용이 비워진다', (await msgText(p)).includes('보냈습니다') && await p.evaluate(() => document.querySelector('#ask-title').value === '' && document.querySelector('#ask-body').value === ''));
  await closeSheet(p); await openAsk(p);
  ok(name + ': 보낸 뒤 다시 열어도 비어 있다(쓰던 글 초기화)', await p.evaluate(() => document.querySelector('#ask-title').value === ''));

  // 사진
  ok(name + ': 처음에는 사진 0/3, 사진 추가 칸이 있다', await p.evaluate(() => document.querySelector('#ask-pcount').textContent.includes('0/3') && !!document.querySelector('#ask-file')));
  await (await p.$('#ask-file')).uploadFile(path.join(tmp, 'big.png')); await sleep(1500);
  const ph = await p.evaluate(() => { const i = document.querySelector('.ask-ph img'); return { n: document.querySelectorAll('.ask-ph').length, w: i && i.naturalWidth, h: i && i.naturalHeight, cnt: document.querySelector('#ask-pcount').textContent }; });
  ok(name + ': 큰 사진(3000×2000) 한 장 → 긴 변 1600px 이하로 줄어 담긴다', ph.n === 1 && Math.max(ph.w, ph.h) <= 1600 && Math.max(ph.w, ph.h) >= 1500 && ph.cnt.includes('1/3'), JSON.stringify(ph));
  await (await p.$('#ask-file')).uploadFile(path.join(tmp, 's1.png'), path.join(tmp, 's2.png'), path.join(tmp, 's3.png'), path.join(tmp, 's4.png')); await sleep(1500);
  const ph2 = await p.evaluate(() => ({ n: document.querySelectorAll('.ask-ph').length, add: !!document.querySelector('#ask-file'), msg: document.querySelector('#ask-msg').textContent }));
  ok(name + ': 사진은 최대 3장 — 넘치면 안내하고 추가 칸이 사라진다', ph2.n === 3 && !ph2.add && ph2.msg.includes('3장'), JSON.stringify(ph2));
  await typeIn(p, '#ask-title', '사진 시험'); await typeIn(p, '#ask-body', '사진을 붙였습니다.');
  await p.evaluate(() => { window.__mailResult = 'sent'; window.__msgs.length = 0; }); await p.click('#ask-send'); await sleep(500);
  m = (await msgs(p)).filter((x) => x.mail);
  const pl = m[0] && m[0].mail.photos;
  ok(name + ': 사진 3장이 JPEG(base64)로, 한 장 1.3MB 이하로 전달된다', pl && pl.length === 3 && pl.every((x) => x.data.startsWith('/9j/') && x.data.length * 0.75 < 1300000), pl && pl.map((x) => Math.round(x.data.length * 0.75 / 1000) + 'KB').join(','));
  ok(name + ': 보낸 뒤 사진도 비워진다', await p.evaluate(() => document.querySelectorAll('.ask-ph').length === 0));
  await (await p.$('#ask-file')).uploadFile(path.join(tmp, 's1.png'), path.join(tmp, 's2.png')); await sleep(1200);
  await p.click('.ask-ph button[data-rm="0"]'); await sleep(200);
  ok(name + ': × 를 누르면 그 사진이 빠진다', await p.evaluate(() => document.querySelectorAll('.ask-ph').length === 1 && document.querySelector('#ask-pcount').textContent.includes('1/3')));
  ok(name + ': 화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await p.close();
}

// 앱이 아닐 때 · 받는 주소가 비어 있을 때
{
  const dev = DEVICES.find((d) => d[0] === '15 세로');
  let { p, errs } = await open(dev, { native: false });
  await openAsk(p);
  await typeIn(p, '#ask-title', '제목'); await typeIn(p, '#ask-body', '내용'); await p.click('#ask-send'); await sleep(300);
  const f2 = await p.evaluate(() => ({ shown: !document.querySelector('#ask-fb').hidden, txt: document.querySelector('#ask-fb').innerText, sent: window.__msgs.filter((m) => m.mail).length }));
  // 앱이 아닌 화면에서는 모의 앱 메시지(webkit)가 있어도 NATIVE 가 아니므로 보내지 않는다
  ok('앱이 아닌 화면에서 문의하기: 앱으로 보내지 않고 대체 방법(주소 복사·mailto)을 보여 준다', f2.shown && f2.txt.includes('아이폰 앱이 아닌 곳') && f2.sent === 0, JSON.stringify(f2).slice(0, 200));
  await p.close();
  ({ p, errs } = await open(dev, { addr: '' })); await openAsk(p);
  const eb = await body(p);
  ok('받는 주소가 비어 있으면 경고가 보인다', eb.includes('받는 메일 주소가 아직 설정되지 않아'), eb.slice(0, 120).replace(/\n/g, ' '));
  await typeIn(p, '#ask-title', '제목'); await typeIn(p, '#ask-body', '내용'); await p.click('#ask-send'); await sleep(300);
  ok('받는 주소가 비어 있으면 보내지 않고 안내한다', (await msgText(p)).includes('설정되지 않아') && (await msgs(p)).filter((x) => x.mail).length === 0);
  ok('화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await p.close();
}
await b.close();
console.log(fails ? 'FAILS: ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
