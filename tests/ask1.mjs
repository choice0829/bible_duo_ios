// v69 — 문의하기 · 후원하기 시험:
//  ① 설정에 '문의하기'·'후원하기' 줄이 고급설정 아래·제작자 표시 위에 있다
//  ② 문의하기: 제목·내용 검사, 앱(메일 작성 창)으로 보내는 내용(받는 사람·제목·본문·사진), 결과별 안내(보냄·취소·저장·실패·계정 없음·다른 창),
//     사진 추가(최대 3장·큰 사진은 줄임·빼기), 쓰던 글 유지, 받는 주소가 비어 있을 때 / 앱이 아닌 화면일 때의 대체 방법
//  ③ 후원하기: 후원 목적 글, 상품 단추(앱이 준 이름·가격), 결제 결과별 안내, 상품이 없을 때(사이드로드)·앱이 아닐 때 안내, 늦게 도착한 결제 소식
// 주의: PC 크롬 모의다. 실제 아이폰의 메일 작성 창·사진 고르기·Apple 결제 창은 실기기(App Store/TestFlight 설치)에서 확인한다.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { serve, launch, sleep, DEVICES } from './devlib.mjs';
serve(8985); const b = await launch(); let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
const PICK = ['SE3 세로', '15 세로', '14 가로', 'Duo 펼침', 'Duo 접힘'];
const MAIL = 'test@example.com';

// 앱(껍데기) 모의: 보낸 메시지를 __msgs 에 모으고, 메일·후원 요청에는 __mailResult / __supItems / __buyResult 대로 답한다.
const seed = { fn: () => {
  window.__msgs = []; window.__mailResult = 'sent'; window.__supItems = []; window.__buyResult = 'thanks'; window.__supSilent = false;
  window.webkit = { messageHandlers: { bf: { postMessage: (m) => {
    window.__msgs.push(JSON.parse(JSON.stringify(m)));
    if (m.mail) setTimeout(() => window.bfMail && window.bfMail({ id: m.id, result: window.__mailResult }), 60);
    if (m.support === 'list' && !window.__supSilent) setTimeout(() => window.bfSupport && window.bfSupport({ kind: 'list', id: m.id, items: window.__supItems }), 60);
    if (m.support === 'buy') setTimeout(() => window.bfSupport && window.bfSupport({ kind: 'buy', id: m.id, result: window.__buyResult }), 60);
  } } } };
  localStorage.setItem('bf.pos', JSON.stringify({ bi: 0, ch: 1 }));
} };
const open = async (dev, { addr = MAIL, native = true } = {}) => {
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
  await p.goto('http://localhost:8985/index.html' + (native ? '?native=1' : ''));
  await p.waitForFunction(() => document.querySelector('#loading')?.hidden === true, { timeout: 90000 }); await sleep(1500);
  return { p, errs };
};
const body = (p) => p.evaluate(() => document.querySelector('#sheet-body').innerText);
const msgs = (p) => p.evaluate(() => window.__msgs);
const settings = async (p) => { await p.click('#btn-settings'); await sleep(500); };
const typeIn = async (p, sel, text) => { await p.click(sel); await p.evaluate((s) => { document.querySelector(s).value = ''; }, sel); await p.type(sel, text); };
const msgText = (p) => p.evaluate(() => document.querySelector('#ask-msg')?.textContent.trim());
const inSheet = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s), sh = document.querySelector('#sheet'); if (!e || !sh) return false; e.scrollIntoView({ block: 'center' }); const a = e.getBoundingClientRect(), c = sh.getBoundingClientRect(); return a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && a.left >= c.left - 1 && a.right <= c.right + 1; }, sel);

// 큰 사진 파일(3000×2000)과 작은 사진 파일 만들기
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ask1-'));
{
  const { p } = await open(DEVICES.find((d) => d[0] === '15 세로'));
  const big = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const x = c.getContext('2d'); for (let i = 0; i < 400; i++) { x.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 40) + '%)'; x.fillRect((i * 97) % 3000, (i * 53) % 2000, 300 + i % 200, 200 + i % 150); } return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(path.join(tmp, 'big.png'), Buffer.from(big, 'base64'));
  for (const n of [1, 2, 3, 4]) fs.writeFileSync(path.join(tmp, 's' + n + '.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await p.close();
}

for (const name of PICK) {
  const dev = DEVICES.find((d) => d[0] === name);
  const { p, errs } = await open(dev);
  // ① 설정 줄
  await settings(p);
  let order = await p.evaluate(() => [...document.querySelectorAll('#sheet-body > *')].map((e) => e.id || e.className.split(' ')[0]));
  const iAdv = order.indexOf('go-adv'), iAsk = order.indexOf('go-ask'), iSup = order.indexOf('go-sup'), iCr = order.indexOf('credit');
  ok(name + ': 설정에서 고급설정 → 문의하기 → 후원하기 → 제작자 표시 순서', iAdv >= 0 && iAsk === iAdv + 1 && iSup === iAsk + 1 && iCr === iSup + 1, order.join(','));
  const t0 = await body(p);
  ok(name + ': 줄 설명에 "문의하기"·"후원하기"가 보인다', t0.includes('문의하기') && t0.includes('후원하기'));

  // ② 문의하기
  await p.click('#go-ask'); await sleep(400);
  ok(name + ': 문의하기 화면 제목과 돌아가기 단추', await p.evaluate(() => document.querySelector('#sheet-title').textContent === '문의하기' && !document.querySelector('#sheet-back').hidden));
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
  // 쓰던 글은 뒤로 갔다 와도 남는다
  await p.click('#sheet-back'); await sleep(300); await p.click('#go-ask'); await sleep(300);
  ok(name + ': 뒤로 갔다 와도 쓰던 제목·내용이 남아 있다', await p.evaluate(() => document.querySelector('#ask-title').value === '글자가 겹칩니다' && document.querySelector('#ask-body').value.includes('두 번째 줄')));
  // 취소
  await p.evaluate(() => { window.__mailResult = 'cancelled'; });
  await p.click('#ask-send'); await sleep(400);
  let m = (await msgs(p)).filter((x) => x.mail);
  ok(name + ': 앱으로 보낸 메시지: 받는 사람·제목 머리말·본문·앱 버전', m.length === 1 && m[0].mail.to === MAIL && m[0].mail.subject === '[앱 문의] 글자가 겹칩니다' && m[0].mail.body.includes('카드 글자가 겹쳐') && m[0].mail.body.includes('앱 v69') && Array.isArray(m[0].mail.photos) && m[0].mail.photos.length === 0 && typeof m[0].id === 'number', JSON.stringify(m[0] && m[0].mail).slice(0, 200));
  ok(name + ': 취소하면 안내하고 쓰던 글은 그대로', (await msgText(p)).includes('취소') && await p.evaluate(() => document.querySelector('#ask-title').value !== '' && !document.querySelector('#ask-send').disabled));
  // 임시 저장 · 실패 · 다른 창
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
  await p.click('#sheet-back'); await sleep(300); await p.click('#go-ask'); await sleep(300);
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
  // 사진 빼기
  await (await p.$('#ask-file')).uploadFile(path.join(tmp, 's1.png'), path.join(tmp, 's2.png')); await sleep(1200);
  await p.click('.ask-ph button[data-rm="0"]'); await sleep(200);
  ok(name + ': × 를 누르면 그 사진이 빠진다', await p.evaluate(() => document.querySelectorAll('.ask-ph').length === 1 && document.querySelector('#ask-pcount').textContent.includes('1/3')));
  await p.click('#sheet-back'); await sleep(300);
  ok(name + ': 돌아가기 → 설정 화면', await p.evaluate(() => document.querySelector('#sheet-title').textContent === '설정'));

  // ③ 후원하기 — 상품 있음
  await p.evaluate(() => { window.__supItems = [{ id: 'com.choice0829.bibleflip.support.small', name: '작은 후원', price: '₩1,500' }, { id: 'com.choice0829.bibleflip.support.medium', name: '보통 후원', price: '₩5,000' }]; window.__msgs.length = 0; });
  await p.click('#go-sup'); await sleep(500);
  const st = await body(p);
  ok(name + ': 후원 목적 글 — 개역개정·다양한 번역본, 세계에서 쓸 수 있는 앱 개발', st.includes('개역개정') && st.includes('다양한 번역본') && st.includes('세계') && st.includes('앱 개발'));
  ok(name + ': 후원은 선택이며 기능과 무관하고, 번역본 추가를 약속하지 않는다고 밝힌다', st.includes('전적으로 선택') && st.includes('약속하는 것은 아닙니다') && st.includes('기능이 열리거나 광고가 사라지는 일은 없습니다'));
  ok(name + ': 기부금 영수증 미발급 안내', st.includes('기부금 영수증은 발급되지 않습니다'));
  const sb = await p.evaluate(() => [...document.querySelectorAll('.sup-btn')].map((x) => x.innerText.replace(/\s+/g, ' ')));
  ok(name + ': 상품 단추 — 앱이 준 이름과 가격', sb.length === 2 && sb[0].includes('작은 후원') && sb[0].includes('₩1,500') && sb[1].includes('₩5,000'), JSON.stringify(sb));
  ok(name + ': 가로로 넘치지 않고 단추가 창 안에서 눌린다', await p.evaluate(() => { const b = document.querySelector('#sheet-body'); return b.scrollWidth <= b.clientWidth + 1; }) && await inSheet(p, '.sup-btn'));
  for (const [res, word] of [['cancelled', '취소'], ['pending', '승인을 기다리는'], ['failed', '마치지 못했습니다'], ['unavailable', '불러올 수 없습니다'], ['thanks', '감사드립니다']]) {
    await p.evaluate((r) => { window.__buyResult = r; window.__msgs.length = 0; }, res);
    await p.click('.sup-btn[data-pid$="medium"]'); await sleep(450);
    const sent = (await msgs(p)).filter((x) => x.support === 'buy');
    ok(name + ': 결제 결과 ' + res + ' → "' + word + '" 안내', sent.length === 1 && sent[0].pid === 'com.choice0829.bibleflip.support.medium' && (await p.evaluate(() => document.querySelector('#sup-state').textContent)).includes(word) && await p.evaluate(() => [...document.querySelectorAll('.sup-btn')].every((x) => !x.disabled)));
  }
  // 늦게 도착한 결제 소식(id 0)
  await p.evaluate(() => window.bfSupport({ kind: 'buy', id: 0, result: 'thanks' })); await sleep(200);
  ok(name + ': 늦게 도착한 결제 소식이면 감사 안내(토스트)가 나온다', await p.evaluate(() => (document.getElementById('infotoast')?.textContent || '').includes('감사')));
  ok(name + ': 화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await p.close();
}

// 상품이 없을 때(사이드로드) · 응답이 없을 때 · 앱이 아닐 때 · 받는 주소가 비어 있을 때
{
  const dev = DEVICES.find((d) => d[0] === '15 세로');
  let { p, errs } = await open(dev); await settings(p); await p.click('#go-sup'); await sleep(500);
  let t = await body(p);
  ok('상품이 없으면 App Store 설치 앱에서만 후원할 수 있다고 안내', t.includes('App Store에서 설치한 앱') && t.includes('사이드로드') && !(await p.$('.sup-btn')));
  await p.close();
  ({ p, errs } = await open(dev)); await p.evaluate(() => { window.__supSilent = true; }); await settings(p); await p.click('#go-sup'); await sleep(10600);
  t = await body(p);
  ok('앱이 10초 안에 답하지 않으면 불러오지 못했다고 안내', t.includes('불러오지 못했습니다') && t.includes('인터넷 연결'));
  await p.close();
  ({ p, errs } = await open(dev, { native: false })); await settings(p); await p.click('#go-sup'); await sleep(400);
  ok('앱이 아닌 화면에서 후원하기: 아이폰 앱에서만 가능하다고 안내', (await body(p)).includes('아이폰 앱에서만'));
  await p.click('#sheet-back'); await sleep(300); await p.click('#go-ask'); await sleep(300);
  await typeIn(p, '#ask-title', '제목'); await typeIn(p, '#ask-body', '내용'); await p.click('#ask-send'); await sleep(300);
  const f2 = await p.evaluate(() => ({ shown: !document.querySelector('#ask-fb').hidden, txt: document.querySelector('#ask-fb').innerText, sent: window.__msgs.filter((m) => m.mail).length }));
  // 앱이 아닌 화면에서는 모의 앱 메시지(webkit)가 있어도 NATIVE 가 아니므로 보내지 않는다
  ok('앱이 아닌 화면에서 문의하기: 앱으로 보내지 않고 대체 방법(주소 복사·mailto)을 보여 준다', f2.shown && f2.txt.includes('아이폰 앱이 아닌 곳') && f2.sent === 0, JSON.stringify(f2).slice(0, 200));
  await p.close();
  ({ p, errs } = await open(dev, { addr: '' })); await settings(p); await p.click('#go-ask'); await sleep(400);
  const eb = await body(p);
  ok('받는 주소가 비어 있으면 경고가 보인다', eb.includes('받는 메일 주소가 아직 설정되지 않아'), eb.slice(0, 120).replace(/\n/g, ' '));
  await typeIn(p, '#ask-title', '제목'); await typeIn(p, '#ask-body', '내용'); await p.click('#ask-send'); await sleep(300);
  ok('받는 주소가 비어 있으면 보내지 않고 안내한다', (await msgText(p)).includes('설정되지 않아') && (await msgs(p)).filter((x) => x.mail).length === 0);
  ok('화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await p.close();
}
await b.close();
console.log(fails ? 'FAILS: ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
