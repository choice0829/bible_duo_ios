import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8930); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const notes={items:[{id:'n1abc',ci:0,title:'창조의 순서',body:'본문 묵상',date:'2026-11-18',bk:'gen',c1:1,v1:3,c2:1,v2:5,ts:1}]};
const seed={fn:(n)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); localStorage.setItem('bf.notes',JSON.stringify(n));}}, arg:notes};
const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8930,query:'?native=1'}); await sleep(700);
await p.screenshot({path:'native5-rest.png'});
const tabs=await p.evaluate(()=>[...document.querySelectorAll('.nt-tab')].map(t=>{const r=t.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.right),Math.round(r.top)]}));

// 넘기는 중
await p.touchscreen.touchStart(900,540);
for (let i=1;i<=14;i++){ await p.touchscreen.touchMove(900-i*26,540-i*10); await sleep(25); }
await sleep(250);
await p.screenshot({path:'native5-turn.png'});
// 넘김 효과가 머리줄 영역(y<118)으로 올라가지 않는다: 머리줄 아래 띠(y 60~110, 글자 없는 쪽 가운데)가 종이색 한 가지인지
const hdr=await p.evaluate(()=>{ const st=document.querySelector('#stage').getBoundingClientRect(); return {top:st.top, ov:getComputedStyle(document.querySelector('#stage')).overflow}; });
await p.touchscreen.touchEnd(); await sleep(1600);
ok('stage top == 118 and clips', Math.abs(hdr.top-118)<=0.5 && /clip|hidden/.test(hdr.ov), JSON.stringify(hdr));
console.log('tabs',JSON.stringify(tabs)); ok('note tab exists and sits left of text (right edge<=30)', tabs.length>=1 && tabs.every(t=>t[1]<=30), JSON.stringify(tabs));
ok('no page errors', errs.length===0, JSON.stringify(errs));
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
