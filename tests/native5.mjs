import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8930); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const notes={items:[{id:'n1abc',ci:0,title:'창조의 순서',body:'본문 묵상',date:'2026-11-18',bk:'gen',c1:1,v1:3,c2:1,v2:5,ts:1},{id:'n2abc',ci:1,title:'기초의 복음서 공부',body:'여섯 글자 탭',date:'2026-11-19',bk:'gen',c1:1,v1:8,c2:1,v2:9,ts:2}]};
const seed={fn:(n)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n));}}, arg:notes};
const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8930,query:'?native=1'}); await sleep(700);
await p.screenshot({path:'native5-rest.png'});
const tabs=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>{const r=t.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.right),Math.round(r.top)]}));
{ const lb=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>({t:t.querySelector('b').textContent,h:Math.round(t.getBoundingClientRect().height),w:Math.round(t.getBoundingClientRect().width)})));
  ok('v64: note tab label shows the first 6 chars (spaces removed)', lb.some(x=>x.t==='기초의복음서') && lb.some(x=>x.t==='창조의순서'), JSON.stringify(lb));
  ok('v64/v65: 6-char tab is taller than the 5-char one (99 vs 86.5) and both are 17px wide', (()=>{const a=lb.find(x=>x.t==='기초의복음서'),c=lb.find(x=>x.t==='창조의순서'); return a&&c&&a.h>c.h&&a.h>=98&&a.w===17&&c.w===17;})(), JSON.stringify(lb)); }

// 넘기는 중
await p.touchscreen.touchStart(900,540);
for (let i=1;i<=14;i++){ await p.touchscreen.touchMove(900-i*26,540-i*10); await sleep(25); }
await sleep(250);
await p.screenshot({path:'native5-turn.png'});
// 넘김 효과가 머리줄 영역(y<118)으로 올라가지 않는다: 머리줄 아래 띠(y 60~110, 글자 없는 쪽 가운데)가 종이색 한 가지인지
const hdr=await p.evaluate(()=>{ const st=document.querySelector('#stage').getBoundingClientRect(); return {top:st.top, ov:getComputedStyle(document.querySelector('#stage')).overflow, cp:getComputedStyle(document.querySelector('#stage')).clipPath}; });
await p.touchscreen.touchEnd(); await sleep(1600);
// v56: 자르는 창이 clip-path(위쪽으로만 15px, 머리줄과 책 사이 간격 안쪽)로 바뀜 — 책장은 y 103 보다 위(머리줄)로는 올라가지 않는다
ok('stage top == 118 and clips (overflow clip or clip-path inset ≤ 15px upward)', Math.abs(hdr.top-118)<=0.5 && (/clip|hidden/.test(hdr.ov) || (hdr.ov==='visible' && /^inset\(-(\d+(\.\d+)?)px 0px 0px\)$/.test(hdr.cp) && parseFloat(hdr.cp.match(/-([\d.]+)px/)[1])<=15)), JSON.stringify(hdr));
console.log('tabs',JSON.stringify(tabs)); ok('note tab exists, flush with the screen edge (left 0), width>=16, and leaves >=8px before the text (text starts at 26)', tabs.length>=1 && tabs.every(t=>t[0]===0 && t[1]-t[0]>=16 && 26-t[1]>=8), JSON.stringify(tabs));
ok('no page errors', errs.length===0, JSON.stringify(errs));
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
