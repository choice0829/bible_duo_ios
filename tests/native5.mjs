import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8930); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const notes={items:[{id:'n1abc',ci:0,title:'창조의 순서',body:'본문 묵상',date:'2026-11-18',bk:'gen',c1:1,v1:3,c2:1,v2:5,ts:1},{id:'n2abc',ci:1,title:'기초의 복음서 공부',body:'여섯 글자 탭',date:'2026-11-19',bk:'gen',c1:1,v1:6,c2:1,v2:7,ts:2},{id:'n3abc',ci:2,title:'셋째 날 묵상',body:'오른쪽 쪽',date:'2026-11-20',bk:'gen',c1:1,v1:9,c2:1,v2:10,ts:3},{id:'n4abc',ci:3,title:'광명체 이야기',body:'오른쪽 쪽에서 시작해 다음 쪽으로 이어짐',date:'2026-11-21',bk:'gen',c1:1,v1:12,c2:1,v2:14,ts:4}]};
const seed={fn:(n)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n));}}, arg:notes};
const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8930,query:'?native=1'}); await sleep(700);
await p.screenshot({path:'native5-rest.png'});
const readTabs=()=>p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>{const r=t.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),h:Math.round(r.height),right:t.classList.contains('nt-r'),id:t.dataset.note||'more'}}));
const tabs=await readTabs();
{ const lb=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>({t:t.querySelector('b').textContent,h:Math.round(t.getBoundingClientRect().height),w:Math.round(t.getBoundingClientRect().width)})));
  ok('v64: note tab label shows the first 6 chars (spaces removed)', lb.some(x=>x.t==='기초의복음서') && lb.some(x=>x.t==='창조의순서'), JSON.stringify(lb));
  ok('v67: only the first-line page decides the side: notes on the left page (n1 1:3-5, n2 1:6-7) are left tabs, notes whose first line is on the right page (n3 1:9-10, n4 1:12-14) are right tabs (v89: verses moved for the shorter page)', (()=>{const g=(id)=>tabs.find(t=>t.id===id); return g('n1abc')&&g('n2abc')&&g('n3abc')&&g('n4abc')&&!g('n1abc').right&&!g('n2abc').right&&g('n3abc').right&&g('n4abc').right;})(), JSON.stringify(tabs));
  ok('v64/v66: 6-char tab is taller than the 5-char one (99 vs 86.5) and both are 18px wide', (()=>{const a=lb.find(x=>x.t==='기초의복음서'),c=lb.find(x=>x.t==='창조의순서'); return a&&c&&a.h>c.h&&a.h>=98&&a.w===18&&c.w===18;})(), JSON.stringify(lb)); }
await p.screenshot({path:'native5-rest.png'});

// v67: 오른쪽 탭을 누르면 밝게 남는 스포트라이트 + 미리보기 카드가 뜨고, 선택된 탭은 본문 쪽(왼쪽)으로 4px 나온다. 한 번 더 누르면 닫힌다.
{ const sel=(id)=>p.evaluate((i)=>{const t=document.querySelector('.nt-tab[data-note="'+i+'"]'); const r=t.getBoundingClientRect(); const pk=document.querySelector('#note-peek'); return {sel:t.classList.contains('sel'), r:Math.round(r.right), peek:!!pk&&!pk.hidden, spot:document.querySelector('#stage').classList.contains('spot')};},id);
  await p.evaluate(()=>document.querySelector('.nt-tab[data-note="n3abc"]').click()); await sleep(500);
  const a=await sel('n3abc');
  ok('v67: tapping a right tab selects it (nudges 4px toward the text), dims the other text and opens the preview card', a.sel && a.spot && a.peek && a.r===937, JSON.stringify(a));
  await p.screenshot({path:'native5-rspot.png'});
  await p.evaluate(()=>document.querySelector('.nt-tab[data-note="n3abc"]').click()); await sleep(400);
  const c=await sel('n3abc');
  ok('v67: tapping it again closes the spotlight and the tab returns to W-10', !c.sel && !c.spot && !c.peek && c.r===941, JSON.stringify(c)); }
// 넘기는 중
await p.touchscreen.touchStart(900,540);
for (let i=1;i<=14;i++){ await p.touchscreen.touchMove(900-i*26,540-i*10); await sleep(25); }
await sleep(250);
await p.screenshot({path:'native5-turn.png'});
// 넘김 효과가 머리줄 영역(y<118)으로 올라가지 않는다: 머리줄 아래 띠(y 60~110, 글자 없는 쪽 가운데)가 종이색 한 가지인지
const hdr=await p.evaluate(()=>{ const st=document.querySelector('#stage').getBoundingClientRect(); return {top:st.top, ov:getComputedStyle(document.querySelector('#stage')).overflow, cp:getComputedStyle(document.querySelector('#stage')).clipPath}; });
await p.touchscreen.touchEnd(); await sleep(1600);
// v56: 자르는 창이 clip-path(위쪽으로만 15px, 머리줄과 책 사이 간격 안쪽)로 바뀜 — 책장은 y 103 보다 위(머리줄)로는 올라가지 않는다
ok('stage top == 118 and clips (overflow clip, or clip-path widened upward no further than the header area = stage top; v85: 남색 머리줄에서 넘김 그림자가 잘려 보이지 않게)', Math.abs(hdr.top-118)<=0.5 && (/clip|hidden/.test(hdr.ov) || (hdr.ov==='visible' && /^inset\(-(\d+(\.\d+)?)px 0px 0px\)$/.test(hdr.cp) && parseFloat(hdr.cp.match(/-([\d.]+)px/)[1])<=hdr.top+0.5)), JSON.stringify(hdr));
console.log('tabs',JSON.stringify(tabs));
{ const lt=tabs.filter(t=>!t.right), rt=tabs.filter(t=>t.right);
  ok('left tabs: 10px in from the screen edge, width>=16, >=8px before the text (text starts at 38)', lt.length>=2 && lt.every(t=>Math.abs(t.l-10)<=0.5 && t.r-t.l>=16 && 38-t.r>=8), JSON.stringify(lt));
  ok('v67: right tabs mirror the left ones: 10px in from the right screen edge (W-10), same width, >=8px after the text (text ends at W-38)', rt.length>=2 && rt.every(t=>Math.abs((951-t.r)-10)<=0.5 && t.r-t.l===(lt[0].r-lt[0].l) && t.l-(951-38)>=8), JSON.stringify(rt));
  ok('v67: right tabs stay below the status pill (y>=118) and do not overlap each other', rt.every(t=>t.t>=118) && rt.every((t,i)=>i===0||t.t>=rt[i-1].t+rt[i-1].h), JSON.stringify(rt)); }
// 다음 쪽으로 넘어가면: 오른쪽 쪽에서 시작했던 n4(1:12-14, v89)가 이번엔 왼쪽 쪽에서 이어지므로 왼쪽 탭으로 돌아온다
{ const ta=await readTabs(); console.log('tabs after turn',JSON.stringify(ta));
  const n4=ta.find(t=>t.id==='n4abc');
  ok('v67: after turning the page, the note that continues on the new LEFT page is a left tab again (and notes no longer on screen have no tab)', !!n4 && !n4.right && Math.abs(n4.l-10)<=0.5 && !ta.some(t=>t.id==='n3abc'), JSON.stringify(ta)); }
// 앱이 아닌 화면(펼침이지만 책 오른쪽 여백이 없는 경우)에서는 오른쪽 탭 없이 왼쪽만 쓴다
{ const {p:p2,errs:e2}=await openDevice(b,['pc',1280,800,{top:0,right:0,bottom:0,left:0}],{seed,port:8930,query:''}); await sleep(700);
  const t2=await p2.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>{const r=t.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),right:t.classList.contains('nt-r')};}));
  console.log('pwa tabs',JSON.stringify(t2)); ok('v67: browser/PWA spread (no free space right of the book) keeps every tab on the left, none cut off at the right edge', !t2.some(t=>t.right) && t2.every(t=>t.r<=1280), JSON.stringify(t2)); ok('browser/PWA: no page errors', e2.length===0, JSON.stringify(e2)); }
ok('no page errors', errs.length===0, JSON.stringify(errs));
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
