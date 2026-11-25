// 설교 영상 탭 시험 (교회 계정 1단계, v74): 기기에 저장된 교회 영상 목록(bf.sermons)으로
// 펼친 화면 = 노트 탭과 섞여 쌓이는 빨간 재생 탭(같은 줄의 영상 여럿은 탭 하나+개수) → 누르면 본문 스포트라이트 + 카드 → '유튜브에서 보기'가 open 메시지
// 접은 화면 = 장 제목 밑 노트 칩 옆 빨간 칩 → 카드 → open 메시지
import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8931); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const notes={items:[{id:'n1abc',ci:0,title:'창조의 순서',body:'본문 묵상',date:'2026-11-18',bk:'gen',c1:1,v1:3,c2:1,v2:5,ts:1}]};
const sermons={church:{id:'c1',name:'한사람교회'},items:[
  {id:'s1',yt:'AAAAAAAAAA1',bk:'gen',c1:1,v1:3,c2:1,v2:5,title:'빛이 있으라',preacher:'김목사',date:'2026-11-01'},
  {id:'s2',yt:'BBBBBBBBBB2',bk:'gen',c1:1,v1:11,c2:1,v2:13,title:'셋째 날',preacher:'이목사',date:'2026-10-01'},
  {id:'s3',yt:'CCCCCCCCCC3',bk:'gen',c1:1,v1:11,c2:1,v2:12,title:'땅의 열매',preacher:'박전도사',date:'2026-11-10',t:95},
  {id:'s4',yt:'DDDDDDDDDD4',bk:'exo',c1:1,v1:1,c2:1,v2:5,title:'다른 책',date:'2026-11-02'},
  {id:'bad',yt:'not-an-id',bk:'gen',c1:1,v1:1,c2:1,v2:2,title:'잘못된 항목'},
]};
const seed={fn:([n,s])=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>window.__msgs.push(m)}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n)); localStorage.setItem('bf.sermons',JSON.stringify(s));}}, arg:[notes,sermons]};

// ---- 펼친 화면 (듀오 펼침) ----
{ const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8931,query:'?native=1'}); await sleep(900);
  const tabs=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>{const r=t.getBoundingClientRect(); return {id:t.dataset.note||'more',yt:t.dataset.yt||'',n:(t.querySelector('b')||{}).textContent||'',l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),h:Math.round(r.height),right:t.classList.contains('nt-r'),bg:getComputedStyle(t).backgroundColor};}));
  console.log('tabs',JSON.stringify(tabs));
  const y1=tabs.find(t=>t.yt==='s1'), grp=tabs.find(t=>t.yt.split(' ').length===2), note=tabs.find(t=>t.id==='n1abc');
  ok('v78: s1 (same passage as the note) is a red tab tucked 10px behind the bottom of the note tab', !!y1 && !!note && !y1.right && y1.bg==='rgb(210, 48, 43)' && y1.t===note.t+note.h-10 && y1.h===48 && y1.l===note.l, JSON.stringify([y1,note]));
  { const z=await p.evaluate(()=>{ const n=document.querySelector('.nt-tab[data-note="n1abc"]').getBoundingClientRect(), y=document.querySelector('.yt-tab[data-yt="s1"]').getBoundingClientRect(); const at=(x,yy)=>{const e=document.elementFromPoint(x,yy); const t=e&&e.closest('.nt-tab'); return t?(t.dataset.yt||t.dataset.note):null;}; return {overlap:at(n.left+n.width/2,n.bottom-4), visible:at(y.left+y.width/2,y.top+10+(y.height-10)/2), tuck:document.querySelector('.yt-tab[data-yt="s1"]').classList.contains('tuck')}; });
    ok('v78: in the overlap the note tab is in front; the visible part belongs to the video tab', z.overlap==='n1abc' && z.visible==='s1' && z.tuck, JSON.stringify(z)); }
  { const g=await p.evaluate(()=>{ const t=document.querySelector('.yt-tab[data-yt="s3 s2"]'); return {tuck:t.classList.contains('tuck'), h:Math.round(t.getBoundingClientRect().height)}; });
    ok('v78: a video tab with no note above it is not tucked (normal height)', !g.tuck && g.h===52, JSON.stringify(g)); }
  ok('s2·s3 (both start at 1:11, right page) share ONE right tab showing 2, newest first', !!grp && grp.right && grp.n==='2' && grp.yt==='s3 s2', JSON.stringify(grp));
  ok('other-book (s4) and invalid entries get no tab', !tabs.some(t=>/s4|bad/.test(t.yt)), JSON.stringify(tabs));
  const lt=tabs.filter(t=>!t.right);
  ok('left-side tabs do not overlap, except a video tab tucked exactly 10px behind the note above it (v78)', lt.sort((a,c)=>a.t-c.t).every((t,i)=>i===0||t.t>=lt[i-1].t+lt[i-1].h||(t.yt&&!lt[i-1].yt&&t.t===lt[i-1].t+lt[i-1].h-10)), JSON.stringify(lt));
  await p.screenshot({path:'yt1-spread.png'});
  // 묶인 탭 누르기 → 스포트라이트 + 목록 카드
  await p.evaluate(()=>document.querySelector('.nt-tab[data-yt="s3 s2"]').click()); await sleep(450);
  const st=await p.evaluate(()=>{const pk=document.querySelector('#yt-peek'); const lit=[...document.querySelectorAll('#stage p[data-k]')].filter(x=>getComputedStyle(x).opacity==='1').map(x=>+x.dataset.k);
    return {spot:document.querySelector('#stage').classList.contains('spot'), peek:!!pk&&!pk.hidden, title:pk&&pk.querySelector('.pk-title').textContent, rows:pk?[...pk.querySelectorAll('.yt-row b')].map(x=>x.textContent):[], btns:pk?pk.querySelectorAll('.yt-go').length:0, lit:[...new Set(lit)].sort((a,c)=>a-c), sel:document.querySelector('.nt-tab.sel')&&document.querySelector('.nt-tab.sel').dataset.yt};});
  ok('tapping the grouped tab: spotlight on 1:11-13 only, card lists both sermons (newest first) with a YouTube button each', st.spot&&st.peek&&st.title==='설교 영상 2개'&&JSON.stringify(st.rows)===JSON.stringify(['땅의 열매','셋째 날'])&&st.btns===2&&st.sel==='s3 s2'&&JSON.stringify(st.lit)==='[11,12,13]', JSON.stringify(st));
  await p.screenshot({path:'yt1-spot.png'});
  await p.evaluate(()=>document.querySelector('#yt-peek .yt-go[data-yt="s3"]').click()); await sleep(200);
  const m=await p.evaluate(()=>({msgs:window.__msgs.filter(x=>x.open), spot:document.querySelector('#stage').classList.contains('spot'), peek:!document.querySelector('#yt-peek').hidden}));
  ok('YouTube button sends open message with watch URL + start time, closes card and spotlight', m.msgs.length===1 && m.msgs[0].open==='https://www.youtube.com/watch?v=CCCCCCCCCC3&t=95s' && !m.spot && !m.peek, JSON.stringify(m));
  // 단일 탭: 다시 누르면 닫힘
  await p.evaluate(()=>document.querySelector('.nt-tab[data-yt="s1"]').click()); await sleep(400);
  const s1=await p.evaluate(()=>{const pk=document.querySelector('#yt-peek'); return {peek:!pk.hidden, title:pk.querySelector('.pk-title').textContent, ref:pk.querySelector('.pk-ref').textContent, meta:pk.querySelector('.yt-row span').textContent};});
  ok('single tab card: title, passage · church, preacher · date', s1.peek && s1.title==='빛이 있으라' && s1.ref==='창세기 1:3–5 · 한사람교회' && s1.meta==='김목사 · 2026.11.01', JSON.stringify(s1));
  await p.evaluate(()=>document.querySelector('.nt-tab[data-yt="s1"]').click()); await sleep(300);
  ok('tapping the same tab again closes it', await p.evaluate(()=>document.querySelector('#yt-peek').hidden && !document.querySelector('#stage').classList.contains('spot')));
  // 노트 탭은 그대로 노트 카드
  await p.evaluate(()=>document.querySelector('.nt-tab[data-note="n1abc"]').click()); await sleep(400);
  ok('note tab still opens the note card (not the video card)', await p.evaluate(()=>!document.querySelector('#note-peek').hidden && document.querySelector('#yt-peek').hidden));
  { const t=await p.evaluate(()=>{ const R=(e)=>e.getBoundingClientRect(); const el=document.querySelector('#loc-church'), ch=document.querySelector('#loc-ch'), bk=document.querySelector('#loc-book'), icons=[...document.querySelectorAll('.menu-row > button')].map(R);
      const r=R(el), c=R(ch);
      return {text:el.textContent, hidden:el.hidden, fs:getComputedStyle(el).fontSize, chFs:getComputedStyle(ch).fontSize, color:getComputedStyle(el).color===getComputedStyle(ch).color,
        dy:Math.round(Math.abs(r.bottom-c.bottom)), after:r.left>=c.right-1, inBtn:!!el.closest('#btn-pick'), rightGap:Math.round(R(document.querySelector('#btn-pick')).right-r.right), pages:[...document.querySelectorAll('#stage .page')].map(R).filter(x=>x.width>10&&x.right>1&&x.left<innerWidth-1).length, leftTxtR:Math.round(Math.max(0,...[...document.querySelectorAll('#stage .page p[data-k]')].map(R).filter(x=>x.width>10&&x.left<innerWidth/2-20&&x.right>1).map(x=>x.right))), elR:Math.round(r.right), cut:el.scrollWidth>el.clientWidth+1, bookCut:bk.scrollWidth>bk.clientWidth+1,
        hitIcon:icons.some(i=>r.left<i.right&&i.left<r.right&&r.top<i.bottom&&i.top<r.bottom)}; });
    ok('spread: v82 "with" ends at the right edge of the LEFT page text (just left of the fold)', Math.abs(t.elR-t.leftTxtR)<=2 && t.rightGap<=1, JSON.stringify({elR:t.elR,leftTxtR:t.leftTxtR,gap:t.rightGap}));
    ok('spread: v80 "with 한사람교회" right after the chapter label, same size·color·line, not cut, not over the icons', t.text==='with 한사람교회' && !t.hidden && t.fs===t.chFs && t.color && t.dy<=1 && t.after && t.inBtn && !t.cut && !t.bookCut && !t.hitIcon, JSON.stringify(t)); }
  ok('spread: no page errors', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 접은 화면 (듀오 접힘) ----
{ const {p,errs}=await openDevice(b,['f',466,678,{top:0,right:0,bottom:0,left:0}],{seed,port:8931,query:'?native=1'}); await sleep(900);
  const chips=await p.evaluate(()=>{const box=document.querySelector('#stage .nt-chips'); return box?[...box.querySelectorAll('.nt-chip')].map(c=>({yt:c.dataset.yt||'',note:c.dataset.note||'',t:c.textContent})):null;});
  console.log('chips',JSON.stringify(chips));
  ok('folded: note chip first, then one red chip per chapter-1 sermon (reading order, newest first at the same verse), none for other book/invalid', !!chips && chips[0].note==='n1abc' && JSON.stringify(chips.slice(1).map(c=>c.yt))==='["s1","s3","s2"]', JSON.stringify(chips));
  ok('folded: no edge tabs', await p.evaluate(()=>document.querySelectorAll('.nt-tab').length===0));
  await p.evaluate(()=>document.querySelector('.yt-chip[data-yt="s2"]').click()); await sleep(300);
  const c=await p.evaluate(()=>{const pk=document.querySelector('#yt-peek'); const r=pk.getBoundingClientRect(); return {peek:!pk.hidden, title:pk.querySelector('.pk-title').textContent, l:Math.round(r.left), r:Math.round(r.right), b:Math.round(r.bottom), sheet:!!document.querySelector('.sheet.open, #sheet.open')};});
  ok('folded: chip opens the video card centred at the bottom inside the screen (no notes sheet)', c.peek && c.title==='셋째 날' && c.l>=8 && c.r<=458 && c.b<=678 && !c.sheet, JSON.stringify(c));
  await p.screenshot({path:'yt1-folded.png'});
  await p.evaluate(()=>document.querySelector('#yt-peek .yt-go').click()); await sleep(200);
  const m=await p.evaluate(()=>window.__msgs.filter(x=>x.open).map(x=>x.open));
  ok('folded: YouTube button sends open message (no start time)', JSON.stringify(m)==='["https://www.youtube.com/watch?v=BBBBBBBBBB2"]', JSON.stringify(m));
  { const t=await p.evaluate(()=>{ const R=(e)=>e.getBoundingClientRect(); const el=document.querySelector('#loc-church'), ch=document.querySelector('#loc-ch'), bk=document.querySelector('#loc-book'), icons=[...document.querySelectorAll('.menu-row > button')].map(R);
      const r=R(el), c=R(ch);
      return {text:el.textContent, hidden:el.hidden, fs:getComputedStyle(el).fontSize, chFs:getComputedStyle(ch).fontSize, color:getComputedStyle(el).color===getComputedStyle(ch).color,
        dy:Math.round(Math.abs(r.bottom-c.bottom)), after:r.left>=c.right-1, inBtn:!!el.closest('#btn-pick'), rightGap:Math.round(R(document.querySelector('#btn-pick')).right-r.right), pages:[...document.querySelectorAll('#stage .page')].map(R).filter(x=>x.width>10&&x.right>1&&x.left<innerWidth-1).length, leftTxtR:Math.round(Math.max(0,...[...document.querySelectorAll('#stage .page p[data-k]')].map(R).filter(x=>x.width>10&&x.left<innerWidth/2-20&&x.right>1).map(x=>x.right))), elR:Math.round(r.right), cut:el.scrollWidth>el.clientWidth+1, bookCut:bk.scrollWidth>bk.clientWidth+1,
        hitIcon:icons.some(i=>r.left<i.right&&i.left<r.right&&r.top<i.bottom&&i.top<r.bottom)}; });
    ok('folded: v82 "with" right-aligned to the end of the title line', t.rightGap<=1, 'gap '+t.rightGap);
    // v88: 한 쪽 화면은 머리줄의 장 수를 숨긴다 → with 는 장 수가 있던 자리 크기(책 이름의 0.4배)로 줄 오른쪽 끝에
    { const h=await p.evaluate(()=>({chHidden:getComputedStyle(document.querySelector('#loc-ch')).display==='none', bookFs:parseFloat(getComputedStyle(document.querySelector('#loc-book')).fontSize), fs:parseFloat(getComputedStyle(document.querySelector('#loc-church')).fontSize)}));
      ok('folded: v88 chapter number hidden in the header; "with 한사람교회" at chapter-label size (0.4 × title), not cut, not over the icons', h.chHidden && Math.abs(h.fs-h.bookFs*0.4)<0.6 && t.text==='with 한사람교회' && !t.hidden && t.inBtn && !t.cut && !t.bookCut && !t.hitIcon, JSON.stringify({h,t})); } }
  ok('folded: no page errors', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 영상 목록이 없으면(지금 모든 사용자) 아무것도 안 보임 ----
{ const seed0={fn:(n)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n));}}, arg:notes};
  const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed:seed0,port:8931,query:'?native=1'}); await sleep(900);
  const t=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(x=>x.dataset.note));
  ok('no sermons stored: only the note tab, no video tab', JSON.stringify(t)==='["n1abc"]', JSON.stringify(t));
  ok('v79: no registered church → no "with" label', await p.evaluate(()=>document.querySelector('#loc-church').hidden));
  ok('empty: no page errors', errs.length===0, JSON.stringify(errs)); await p.close(); }
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
