// 읽기 진도 시험 (v87): 장 끝 ○/● 체크(날짜) · 화면 아래 책 약자 줄(구약 39 / 신약 27) · 약자를 누르면 장 번호 칸 · 서로 연동 · 백업
import {serve,launch,sleep,openDevice,DEVICES} from './devlib.mjs';
serve(8947); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const today=(()=>{const d=new Date(); const p=(x)=>(x<10?'0':'')+x; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());})();
const exo=Object.fromEntries(Array.from({length:40},(_,i)=>[String(i+1),'2026-11-01']));
const mkSeed=(bk,ch,v,read)=>({fn:([bk,ch,v,read])=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:bk,chapter:ch,verse:v})); localStorage.setItem('bf.read',JSON.stringify(read));}}, arg:[bk,ch,v,read]});
const readLS=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem('bf.read')||'{}'));
const strip=(p)=>p.evaluate(()=>{const R=(e)=>e.getBoundingClientRect(); const st=document.querySelector('#rd-strip'); const bs=[...st.querySelectorAll('.rd-b')];
  const q=R(st);
  return {r:{left:q.left,top:q.top,right:q.right,bottom:q.bottom}, n:bs.length, abbr:bs.map(x=>x.textContent), cls:Object.fromEntries(bs.map(x=>[x.textContent,x.className.replace('rd-b ','')])), tops:[...new Set(bs.map(x=>Math.round(R(x).top)))], over:st.scrollWidth>st.clientWidth+1, W:innerWidth, H:innerHeight};});
const visMarks=(p)=>p.evaluate(()=>[...document.querySelectorAll('.rd-mark')].map(m=>{const r=m.getBoundingClientRect(); return {ch:m.dataset.rc, bk:m.dataset.rb, x:r.right-18, y:r.top+r.height/2, l:r.left, t:r.top, b:r.bottom, on:m.querySelector('.rd-btn').classList.contains('on'), txt:m.textContent};}).filter(m=>m.b-m.t>4&&m.l>=0&&m.x<innerWidth&&m.t>=0&&m.b<=innerHeight));
const pageIdx=(p)=>p.evaluate(()=>{const pages=[...document.querySelectorAll('#stage .page')]; return pages.findIndex(x=>{const r=x.getBoundingClientRect(); return r.width>10&&r.left>=-1&&r.left<innerWidth/2;});});

// ---- 1. 듀오 펼침: 약자 줄 ----
{ const {p,errs}=await openDevice(b,['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}],{seed:mkSeed(0,2,20,{gen:{'1':'2026-11-20','2':'2026-11-21'},exo}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  ok('spread Genesis: 39 Old-Testament abbreviations in ONE row, 창 … 말', s.n===39 && s.abbr[0]==='창' && s.abbr[38]==='말' && s.abbr.includes('삼상') && s.tops.length===1 && !s.over, JSON.stringify({n:s.n,tops:s.tops,over:s.over}));
  const bx=await p.evaluate(()=>{const bs=[...document.querySelectorAll('#rd-strip .rd-b')].map(x=>x.getBoundingClientRect()); return {l:bs[0].left, r:bs[bs.length-1].right};});
  ok('strip sits in the bottom margin; the abbreviations line up with the book text width', s.r.bottom<=s.H && s.r.top>=s.H-60 && bx.l>=30 && bx.r<=s.W-30, JSON.stringify({r:s.r,bx}));
  const tb=await p.evaluate(()=>Math.max(...[...document.querySelectorAll('#stage .page p[data-k]')].map(x=>x.getBoundingClientRect()).filter(r=>r.width>10&&r.left>=0&&r.left<innerWidth).map(r=>r.bottom)));
  ok('book text ends above the strip (no overlap)', tb<=s.r.top-4, 'text.bottom='+Math.round(tb)+' strip.top='+Math.round(s.r.top));
  const stB=await p.evaluate(()=>document.querySelector('#stage').getBoundingClientRect().bottom);
  ok('v89: the book (stage) ends at the strip top — the strip is in the margin, not a band over the pages', Math.abs(stB-s.r.top)<=1 && Math.round(s.r.bottom)===s.H && s.r.left===0 && Math.round(s.r.right)===s.W, 'stage.bottom='+Math.round(stB)+' strip='+JSON.stringify(s.r));
  ok('states: 창 = reading(part)+current, 출 = done, 레 = none', /part/.test(s.cls['창'])&&/cur/.test(s.cls['창'])&&/done/.test(s.cls['출'])&&/none/.test(s.cls['레']), JSON.stringify([s.cls['창'],s.cls['출'],s.cls['레']]));
  await p.screenshot({path:'read1-spread.png',captureBeyondViewport:false});
  // 2. 장 끝 ○ (창 1장 끝이 보이는 쪽으로)
  await p.evaluate(()=>{ const t=[...document.querySelectorAll('.rd-mark')].find(m=>m.dataset.rc==='3'); return !!t; });
  let mk=(await visMarks(p));
  for (let i=0;i<8 && !mk.some(m=>m.ch==='3');i++){ await p.keyboard.press('ArrowRight'); await sleep(1300); mk=await visMarks(p); }
  const m3=mk.find(m=>m.ch==='3');
  ok('chapter 3 end has an empty ○ on the line after its last verse', !!m3 && !m3.on && m3.bk==='gen', JSON.stringify(mk));
  if (m3) {
    const lastV=await p.evaluate(()=>{const ps=[...document.querySelectorAll('#stage .page p[data-k]')].filter(x=>{const r=x.getBoundingClientRect(); return Math.floor(+x.dataset.k/1000)===2&&r.width>10&&r.left>=0&&r.left<innerWidth;}); const r=ps[ps.length-1].getBoundingClientRect(); return {b:r.bottom, k:ps[ps.length-1].dataset.k};});
    ok('the ○ line is just below the last verse of chapter 3 (3:24)', lastV.k==='2024' && m3.t>=lastV.b-2 && m3.t-lastV.b<20, JSON.stringify({lastV,markTop:m3.t}));
    const before=await pageIdx(p);
    await p.touchscreen.tap(m3.x,m3.y); await sleep(700);
    const after=(await visMarks(p)).find(m=>m.ch==='3'), rd=await readLS(p);
    ok('tapping ○ → ● with today\'s date, saved, page NOT turned', !!after && after.on && after.txt.includes(today.replace(/-/g,'.')+' 읽음') && rd.gen && rd.gen['3']===today && (await pageIdx(p))===before, JSON.stringify({after,rd:rd.gen,before,now:await pageIdx(p)}));
    const s2=await strip(p);
    ok('strip stays 창 = part after checking chapter 3 (3/50)', /part/.test(s2.cls['창']));
    await p.touchscreen.tap(m3.x,m3.y); await sleep(700);
    ok('tapping ● again clears it', !(await visMarks(p)).find(m=>m.ch==='3').on && !(await readLS(p)).gen['3']);
  }
  // 3. 약자 '창' → 장 번호 칸
  await p.evaluate(()=>[...document.querySelectorAll('#rd-strip .rd-b')].find(x=>x.textContent==='창').click()); await sleep(500);
  const g=await p.evaluate(()=>({title:document.querySelector('#sheet-title').textContent, cells:document.querySelectorAll('.rd-cell').length, on:[...document.querySelectorAll('.rd-cell.on')].map(x=>x.dataset.c), txt:document.querySelector('#sheet-body .note').textContent, small:document.querySelector('.rd-cell.on small')?.textContent}));
  ok('tapping 창 opens 창세기 with 50 chapter cells, read ones marked with MM.DD', g.title==='창세기' && g.cells===50 && JSON.stringify(g.on)==='["1","2"]' && /2 \/ 50/.test(g.txt) && g.small==='11.20', JSON.stringify(g));
  await p.screenshot({path:'read1-grid.png',captureBeyondViewport:false});
  await p.evaluate(()=>document.querySelector('.rd-cell[data-c="3"]').click()); await sleep(300);
  ok('tapping cell 3 marks chapter 3 read (today) and the text mark follows', (await readLS(p)).gen['3']===today && await p.evaluate(()=>[...document.querySelectorAll('.rd-mark[data-rb="gen"][data-rc="3"] .rd-btn')].every(x=>x.classList.contains('on'))));
  await p.evaluate(()=>document.querySelector('#rd-all').click()); await sleep(300);
  ok('모두 읽음 → all 50 chapters read, earlier dates kept, 창 becomes done', Object.keys((await readLS(p)).gen).length===50 && (await readLS(p)).gen['1']==='2026-11-20' && /done/.test((await strip(p)).cls['창']));
  await p.evaluate(()=>document.querySelector('#rd-none').click()); await sleep(200);
  ok('모두 지우기 needs a second tap', Object.keys((await readLS(p)).gen||{}).length===50);
  await p.evaluate(()=>document.querySelector('#rd-none').click()); await sleep(300);
  ok('second tap clears Genesis, 창 becomes none', !(await readLS(p)).gen && /none/.test((await strip(p)).cls['창']));
  // 5. 백업
  const bk=await p.evaluate(()=>{ localStorage.setItem('bf.read',JSON.stringify({gen:{'5':'2026-10-10'}})); return true; });
  ok('no page errors (spread)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 신약: 약자 줄 27 ----
{ const {p,errs}=await openDevice(b,['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}],{seed:mkSeed(39,0,1,{mat:{'1':'2026-11-25'}}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  ok('spread Matthew: 27 New-Testament abbreviations 마 … 계, 마 = current+part', s.n===27 && s.abbr[0]==='마' && s.abbr[26]==='계' && /cur/.test(s.cls['마']) && /part/.test(s.cls['마']) && s.tops.length===1, JSON.stringify({n:s.n,first:s.abbr[0]}));
  ok('no page errors (NT)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 듀오 접힘: 장 끝 ○ · 가로로 미는 약자 줄 ----
{ const {p,errs}=await openDevice(b,['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0}],{seed:mkSeed(0,0,1,{}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  ok('folded: strip at the very bottom, full width, scrolls sideways', Math.round(s.r.bottom)===s.H && s.r.left===0 && Math.round(s.r.right)===s.W && s.over && s.tops.length===1, JSON.stringify({r:s.r,over:s.over}));
  const railBot=await p.evaluate(()=>Math.max(...[...document.querySelectorAll('.menu-row > button')].map(x=>x.getBoundingClientRect().bottom)));
  ok('folded: strip does not overlap the right menu rail', railBot<=s.r.top, 'rail.bottom='+Math.round(railBot)+' strip.top='+Math.round(s.r.top));
  await p.evaluate(()=>{ window.__firstP=document.querySelector('#book .chap p[data-k]'); }); await sleep(3600);
  ok('v89 folded: no repeated rebuild after opening', await p.evaluate(()=>!!window.__firstP && window.__firstP.isConnected));
  const bkB=await p.evaluate(()=>document.querySelector('#book').getBoundingClientRect().bottom);
  ok('v89 folded: the scrolling text area ends at the strip top (no text under/below the strip)', Math.abs(bkB-s.r.top)<=1, 'book.bottom='+Math.round(bkB)+' strip.top='+Math.round(s.r.top));
  await p.evaluate(()=>{const c=[...document.querySelectorAll('#book .chap')].find(x=>{const r=x.getBoundingClientRect(); return r.left>-2&&r.left<innerWidth/2;}); c.scrollTop=c.scrollHeight;}); await sleep(500);
  const mk=(await visMarks(p)).find(m=>m.ch==='1');
  ok('folded: chapter 1 end shows ○ after the last verse, above the strip', !!mk && !mk.on && mk.b<=s.r.top, JSON.stringify(mk));
  if (mk) { await p.touchscreen.tap(mk.x,mk.y); await sleep(500);
    ok('folded: tap → ● with date, saved', (await visMarks(p)).find(m=>m.ch==='1').on && (await readLS(p)).gen['1']===today);
    const lr=await p.evaluate(()=>{const b=document.querySelector('.rd-mark[data-rc="1"] .rd-btn'); return {span:b.querySelector('span').getBoundingClientRect().right, dot:b.querySelector('i').getBoundingClientRect().left};});
    ok('v88: the date is LEFT of the ●', lr.span<=lr.dot, JSON.stringify(lr)); }
  const gap=await p.evaluate(()=>{const c=[...document.querySelectorAll('#book .chap')].find(x=>{const r=x.getBoundingClientRect(); return r.left>-2&&r.left<innerWidth/2;}); c.scrollTop=0; return c.querySelector('h2.ch').getBoundingClientRect().top-document.querySelector('#book').getBoundingClientRect().top;});
  ok('v88: folded text starts a little below the header (≥ 14px gap)', gap>=14, 'gap='+Math.round(gap));
  await p.screenshot({path:'read1-folded.png',captureBeyondViewport:false});
  ok('no page errors (folded)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- v89: 아래 안전영역이 있는 아이폰(15 세로): 약자 줄이 바닥까지 붙고(안전영역은 줄 바탕이 채움) 본문은 그 위에서 끝난다 ----
{ const {p,errs}=await openDevice(b,DEVICES.find(d=>d[0]==='15 세로'),{seed:mkSeed(0,0,1,{}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  const r=await p.evaluate(()=>{const R=(e)=>e.getBoundingClientRect(); const bs=[...document.querySelectorAll('#rd-strip .rd-b')].map(R); return {book:R(document.querySelector('#book')).bottom, btnBottom:Math.max(...bs.map(x=>x.bottom))};});
  await p.evaluate(()=>{ window.__firstP=document.querySelector('#book .chap p[data-k]'); });
  await sleep(3600);
  ok('v89: no repeated rebuild after opening (layout check expects the text area to end at the strip top)', await p.evaluate(()=>!!window.__firstP && window.__firstP.isConnected));
  ok('15: strip touches the screen bottom, buttons stay above the home-indicator inset (34px), text area ends at strip top', Math.round(s.r.bottom)===s.H && r.btnBottom<=s.H-34+1 && Math.abs(r.book-s.r.top)<=1, JSON.stringify({strip:s.r,...r}));
  ok('no page errors (15)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 일반 아이폰(SE): 약자 줄이 본문을 가리지 않는다 ----
{ const {p,errs}=await openDevice(b,DEVICES.find(d=>d[0]==='SE3 세로'),{seed:mkSeed(42,0,1,{}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  await p.evaluate(()=>{const c=[...document.querySelectorAll('#book .chap')].find(x=>{const r=x.getBoundingClientRect(); return r.left>-2&&r.left<innerWidth/2;}); c.scrollTop=c.scrollHeight;}); await sleep(400);
  const nav=await p.evaluate(()=>{const c=[...document.querySelectorAll('#book .chap')].find(x=>{const r=x.getBoundingClientRect(); return r.left>-2&&r.left<innerWidth/2;}); return c.querySelector('.chnav').getBoundingClientRect().bottom;});
  ok('SE (John): 27 NT abbreviations, current 요; scrolled to the end the chapter buttons stay above the strip', s.n===27 && /cur/.test(s.cls['요']) && nav<=s.r.top, 'chnav.bottom='+Math.round(nav)+' strip.top='+Math.round(s.r.top));
  // 백업
  await p.evaluate(()=>localStorage.setItem('bf.read',JSON.stringify({jhn:{'3':'2026-11-02'}})));
  ok('no page errors (SE)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 백업에 읽기 진도가 들어가고, 불러오면 돌아온다 ----
{ const {p,errs}=await openDevice(b,['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0}],{seed:mkSeed(0,0,1,{gen:{'7':'2026-09-09'}}),port:8947,query:'?native=1'}); await sleep(900);
  await p.evaluate(()=>document.querySelector('#btn-settings').click()); await sleep(300);
  await p.evaluate(()=>document.querySelector('#go-adv').click()); await sleep(300);
  await p.evaluate(()=>document.querySelector('#go-bk').click()); await sleep(400);
  const out=await p.evaluate(()=>document.querySelector('#bk-out').value);
  ok('backup text contains read progress', JSON.parse(out).read.gen['7']==='2026-09-09');
  const changed=JSON.parse(out); changed.read={exo:{'2':'2026-08-08','99':'2026-08-08','x':'bad'},zzz:{'1':'2026-08-08'}};
  await p.evaluate((t)=>{const i=document.querySelector('#bk-in'); i.value=t;},JSON.stringify(changed));
  await p.evaluate(()=>document.querySelector('#bk-apply').click()); await sleep(200); await p.evaluate(()=>document.querySelector('#bk-apply').click()); await sleep(1500);
  const rd=await readLS(p);
  ok('restore: read progress replaced, invalid chapters/books dropped', JSON.stringify(rd)==='{"exo":{"2":"2026-08-08"}}', JSON.stringify(rd));
  ok('no page errors (backup)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- v90: 듀오 접힘(아래 안전영역 34): 약자 줄 아래는 6px만 비운다 · 접기/펴기 때 남색 '불러오는 중' 화면 대신 종이색으로만 잠깐 가린다 ----
{ const {p,errs,cdp}=await openDevice(b,['Duo 접힘',466,678,{top:0,right:0,bottom:34,left:0}],{seed:mkSeed(0,0,1,{}),port:8947,query:'?native=1'}); await sleep(900);
  const s=await strip(p);
  const bh=await p.evaluate(()=>{const st=document.querySelector('#rd-strip'); const r=st.getBoundingClientRect(); const b0=st.querySelector('.rd-b').getBoundingClientRect(); return {h:Math.round(r.height), below:Math.round(r.bottom-b0.bottom)};});
  ok('v90 folded: strip height = 30 + 6 (not 30 + the whole bottom safe area)', bh.h===36, JSON.stringify(bh));
  ok('v90 folded: strip still at the very bottom', Math.round(s.r.bottom)===s.H);
  // 펼치기 → 접기: 가리는 화면이 남색 로고 화면이 아니어야 한다
  await p.evaluate(()=>{ window.__op=[]; const el0=document.querySelector('#loading'); const tick=()=>{ if(!el0.hidden) window.__op.push(+getComputedStyle(el0).opacity); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await p.evaluate(()=>{ window.__ld=[]; const el=document.querySelector('#loading'); new MutationObserver(()=>{ if(!el.hidden) window.__ld.push({quiet:el.classList.contains('quiet'), bg:getComputedStyle(el).backgroundColor, logo:getComputedStyle(el.querySelector('.ld-logo')).visibility}); }).observe(el,{attributes:true}); });
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:84}}); await p.setViewport({width:951,height:669,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(3500);
  await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:34,right:0}}); await p.setViewport({width:466,height:678,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(3500);
  const ld=await p.evaluate(()=>({seen:window.__ld, bodyBg:getComputedStyle(document.body).getPropertyValue('--bg').trim(), hidden:document.querySelector('#loading').hidden}));
  // v100: 사용자 요청 — 접기·펴기 때 가림을 아예 띄우지 않는다(남색 로고 화면도, 종이색 가림도 없음)
  ok('v100: fold/unfold shows no cover at all', ld.seen.length===0 && ld.hidden===true, JSON.stringify({seen:ld.seen.slice(0,3), hidden:ld.hidden}));
  { const op=await p.evaluate(()=>window.__op);
    ok('v100: cover never visible during fold/unfold', op.length===0, JSON.stringify({n:op.length})); }
  ok('no page errors (v90 folded)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- v90: 듀오 펼침(폭 951, 홀수): 책장이 정수 위치(왼쪽 0)에 붙고, 남는 1px 줄은 종이색 받침이 채운다(넘길 때 회색 선 방지) ----
{ const {p,errs}=await openDevice(b,['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}],{seed:mkSeed(0,1,1,{}),port:8947,query:'?native=1'}); await sleep(900);
  const r=await p.evaluate(()=>{const st=document.querySelector('#stage').getBoundingClientRect(); const f=document.querySelector('#stage-fill'); const fr=f&&f.getBoundingClientRect();
    return {st:[st.left,st.top,st.width,st.height], pages:[...document.querySelectorAll('#stage .page')].map(x=>x.getBoundingClientRect()).filter(q=>q.width>10&&q.left>=-1&&q.left<innerWidth).map(q=>q.left), fill:fr&&[fr.left,fr.top,fr.right,fr.height], fillBg:f&&getComputedStyle(f).backgroundColor, paper:getComputedStyle(document.querySelector('#rd-strip')).backgroundColor};});
  ok('v90 spread: stage at x=0 and page edges on whole pixels', r.st[0]===0 && r.pages.every(x=>Number.isInteger(x)), JSON.stringify(r));
  ok('v90 spread: paper filler behind the stage spans the full width', !!r.fill && r.fill[0]===0 && r.fill[2]===951 && r.fill[1]===r.st[1] && r.fill[3]===r.st[3] && r.fillBg===r.paper, JSON.stringify(r.fill)+' '+r.fillBg);
  // v91·v92: 듀오 펼침 책장 위 끝 ~ 첫 줄 글자 여백 = 약 20~27px(v90 약 45px)
  const gaps=[]; for (let k=0;k<4;k++){ gaps.push(...await p.evaluate(()=>{const st=document.querySelector('#stage').getBoundingClientRect(); const o=[];
    for (const pe of document.querySelectorAll('#stage .page')) { const pr=pe.getBoundingClientRect(); if(pr.width<10||pr.left<-1||pr.left>=innerWidth) continue;
      const rg=document.createRange(); let top=1e9; const w=document.createTreeWalker(pe,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ if(!n.textContent.trim())continue; rg.selectNodeContents(n); for(const q of rg.getClientRects()) if(q.height>=2) top=Math.min(top,q.top); }
      o.push(Math.round(top-st.top)); } return o;})); await p.touchscreen.tap(900,400); await sleep(1400); }
  ok('v92 spread: top margin above the first line is 20–27px on every page', gaps.length>=6 && gaps.every(x=>x>=20&&x<=27), JSON.stringify(gaps));
  // v101: 화면 전환 중 책을 잠깐 숨겨도 남색이 아닌 종이색이 보이도록, 바탕은 머리줄 높이까지만 남색
  { const bg=await p.evaluate(()=>{ const st=document.querySelector('#stage'); st.style.visibility='hidden'; const hh=getComputedStyle(document.documentElement).getPropertyValue('--headh').trim();
      const img=getComputedStyle(document.body).backgroundImage, paper=getComputedStyle(document.querySelector('#rd-strip')).backgroundColor; st.style.visibility=''; return {hh, img, paper}; });
    ok('v101: background is navy only down to the header (--headh), paper below — no navy flash while the book is hidden during rotation/fold', bg.hh==='118px' && bg.img.includes('rgb(30, 58, 95) 118px') && bg.img.includes(bg.paper+' 118px'), JSON.stringify(bg)); }
  ok('no page errors (v90 spread)', errs.length===0, JSON.stringify(errs)); await p.close(); }
// ---- v102: 듀오 접기·펴기 — 화면 크기가 바뀌는 첫 순간에 머리줄이 움직이기 시작하고 곧 끝난다 ----
{ const {p,errs,cdp}=await openDevice(b,['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}],{seed:mkSeed(0,0,1,{}),port:8947,query:'?native=1'}); await sleep(1200);
  const arm=()=>p.evaluate(()=>{ window.__ev=[]; const t0=performance.now(); let last='', rz=-1; window.addEventListener('resize',()=>{ if(rz<0) rz=performance.now()-t0; window.__rz=rz; },{once:true});
    const tick=()=>{ const m=document.querySelector('#btn-search').getBoundingClientRect(); const s=Math.round(m.left)+','+Math.round(m.top); if(s!==last){ window.__ev.push([performance.now()-t0, s]); last=s; } if(performance.now()-t0<2500) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  for (const [nm,w,h,si] of [['fold',466,678,{top:0,left:0,bottom:0,right:0}],['unfold',951,669,{top:0,left:0,bottom:0,right:84}]]) {
    await arm(); await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:si}); await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(2600);
    const r=await p.evaluate(()=>({rz:window.__rz, ev:window.__ev}));
    const after=r.ev.filter(e=>e[0]>=r.rz), first=after[0], end=after[after.length-1];
    ok('v102 '+nm+': header starts moving right at the size change (≤ 120ms) and settles within 700ms', !!first && first[0]-r.rz<=120 && end[0]-r.rz<=700, JSON.stringify({rz:Math.round(r.rz), first:first&&Math.round(first[0]-r.rz), end:end&&Math.round(end[0]-r.rz), n:after.length}));
  }
  ok('no page errors (v102)', errs.length===0, JSON.stringify(errs)); await p.close(); }
// ---- v103: 경첩 각도(window.bfHinge) — 펼친 화면에서 접기 시작하면 화면이 바뀌기 전에 머리줄이 접힘 자리로 간다 ----
{ const {p,errs,cdp}=await openDevice(b,['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}],{seed:mkSeed(0,0,1,{}),port:8947,query:'?native=1'}); await sleep(800);
  const FOLD=async()=>{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:0}}); await p.setViewport({width:466,height:678,deviceScaleFactor:2,isMobile:true,hasTouch:true}); };
  const OPEN=async()=>{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:84}}); await p.setViewport({width:951,height:669,deviceScaleFactor:2,isMobile:true,hasTouch:true}); };
  const pos=()=>p.evaluate(()=>{const r=document.querySelector('#btn-search').getBoundingClientRect(), t=document.querySelector('#loc-book').getBoundingClientRect(); return {mx:Math.round(r.left),my:Math.round(r.top),tx:Math.round(t.left),ty:Math.round(t.top),pre:document.body.classList.contains('hinge-pre')};});
  const close=async(list)=>{ for (const d of list) { await p.evaluate((d)=>window.bfHinge(d,'partiallyOpen'),d); await sleep(60); } };
  await FOLD(); await sleep(2500); const f=await pos();   // 접힘 배치를 한 번 보아 기억(bf.headpos)
  await OPEN(); await sleep(2500); const o=await pos();
  await close([179,170,150,130,120]); await sleep(450);
  ok('v104: closing to 120° (still mostly open) does not move the header yet (default start 115°)', JSON.stringify(await pos())===JSON.stringify(o));
  await close([110,100]); await sleep(500); const pre=await pos();
  ok('v103/v104: closing below 115° → header already at the folded spot (right page = folded screen) before the screen switches', pre.pre && Math.abs(pre.mx-(f.mx+485))<=2 && Math.abs(pre.my-f.my)<=2 && Math.abs(pre.tx-(f.tx+485))<=2, JSON.stringify({pre,f}));
  await FOLD(); await sleep(40); const at=await pos(); await sleep(2500); const fin=await pos();
  ok('v103: at the switch the header is already in place (no second slide)', at.mx===fin.mx && at.my===fin.my && at.tx===fin.tx && !fin.pre, JSON.stringify({at,fin}));
  ok('v104: the hinge angle at the switch is learned (bf.hingeSwitch)', await p.evaluate(()=>localStorage.getItem('bf.hingeSwitch'))==='100', await p.evaluate(()=>localStorage.getItem('bf.hingeSwitch')));
  await OPEN(); await sleep(2500); await p.evaluate(()=>window.bfHinge(180,'fullyOpen')); await sleep(200);
  await close([150,130,112]); await sleep(450);
  ok('v104: after learning (switch 100° → start 108°) 112° does not move yet', JSON.stringify(await pos())===JSON.stringify(o));
  await close([106]); await sleep(500);
  ok('v104: …and 106° does', (await pos()).pre);
  await p.evaluate(()=>window.bfHinge(180,'fullyOpen')); await sleep(700);
  ok('v103: opening again (fully open) puts the header back', JSON.stringify(await pos())===JSON.stringify(o));
  await close([150,120,104]); await sleep(1500);
  ok('v103: stopping half-folded (tabletop) puts the header back after a moment', JSON.stringify(await pos())===JSON.stringify(o));
  // v105: 펼친 뒤 본문을 곧바로 만든다(크기 안정 대기·머리줄 움직임 끝을 기다리지 않음). 시작은 크기 변화 0.1초 안, 보이는 것은 0.45초 안(모의, 그리기 시간 포함)
  { await FOLD(); await sleep(2500);
    await p.evaluate(()=>{ window.__lt=[]; window.__t0=performance.now(); window.__rz=0; window.__shown=0; new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__lt.push([e.startTime-window.__t0, e.duration]); }).observe({type:'longtask'});
      window.addEventListener('resize',()=>{ if(!window.__rz) window.__rz=performance.now()-window.__t0; });
      const st=document.querySelector('#stage'); new MutationObserver(()=>{ if(!window.__shown && window.__rz && !st.classList.contains('stale') && st.querySelector('p[data-k]')) window.__shown=performance.now()-window.__t0; }).observe(st,{attributes:true,childList:true,subtree:true}); });
    await OPEN(); await sleep(2500);
    const r=await p.evaluate(()=>({rz:Math.round(window.__rz), shown:Math.round(window.__shown-window.__rz), build:window.__lt.map(x=>Math.round(x[0]-window.__rz)).filter(x=>x>0)}));
    ok('v105 unfold: the book starts building within 0.1s of the size change and is shown within 0.45s (mock incl. drawing)', r.shown>0 && r.shown<=450 && r.build.length>0 && Math.min(...r.build)<=100, JSON.stringify(r));
    ok('v104 unfold: the book is shown again after rebuilding', await p.evaluate(()=>!document.querySelector('#stage').classList.contains('stale') && document.querySelectorAll('#stage p[data-k]').length>0)); }
  ok('no page errors (v103)', errs.length===0, JSON.stringify(errs)); await p.close(); }
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
