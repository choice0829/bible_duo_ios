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
  ok('a red play tab for s1 (1:3-5) on the left edge, stacked with the note tab of the same line without overlap', !!y1 && !!note && !y1.right && y1.bg==='rgb(210, 48, 43)' && (y1.t>=note.t+note.h || note.t>=y1.t+y1.h) && y1.l===note.l, JSON.stringify([y1,note]));
  ok('s2·s3 (both start at 1:11, right page) share ONE right tab showing 2, newest first', !!grp && grp.right && grp.n==='2' && grp.yt==='s3 s2', JSON.stringify(grp));
  ok('other-book (s4) and invalid entries get no tab', !tabs.some(t=>/s4|bad/.test(t.yt)), JSON.stringify(tabs));
  const lt=tabs.filter(t=>!t.right);
  ok('left-side tabs do not overlap each other', lt.sort((a,c)=>a.t-c.t).every((t,i)=>i===0||t.t>=lt[i-1].t+lt[i-1].h), JSON.stringify(lt));
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
  ok('folded: no page errors', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 영상 목록이 없으면(지금 모든 사용자) 아무것도 안 보임 ----
{ const seed0={fn:(n)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n));}}, arg:notes};
  const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed:seed0,port:8931,query:'?native=1'}); await sleep(900);
  const t=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(x=>x.dataset.note));
  ok('no sermons stored: only the note tab, no video tab', JSON.stringify(t)==='["n1abc"]', JSON.stringify(t));
  ok('empty: no page errors', errs.length===0, JSON.stringify(errs)); await p.close(); }
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
