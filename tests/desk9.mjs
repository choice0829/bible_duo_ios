import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8909); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:1,chapter:1,verse:7}));}}, arg:null};
const SPREAD=['Duo 펼침',867,609,{top:0,right:84,bottom:0,left:0}];
const {p,errs}=await openDevice(b,SPREAD,{seed,port:8909}); await sleep(900);
// 노드 식별용 표식을 달아 두고, 바뀌면 표식이 사라지는지로 '새 노드 교체'를 확인한다
const tag=()=>p.evaluate(()=>{document.querySelector('meta[name=theme-color]').__t='1'; document.getElementById('desk-edge-r').__t='1'; document.getElementById('desk-edge-l').__t='1';});
const state=()=>p.evaluate(()=>({
  metaTag:document.querySelector('meta[name=theme-color]').__t||'', metaN:document.querySelectorAll('meta[name=theme-color]').length, metaC:document.querySelector('meta[name=theme-color]').content,
  r:document.getElementById('desk-edge-r')?.__t||'', l:document.getElementById('desk-edge-l')?.__t||'',
  nr:document.querySelectorAll('#desk-edge-r').length, nl:document.querySelectorAll('#desk-edge-l').length,
  cls:document.getElementById('desk-edge-r')?.className, bg:getComputedStyle(document.getElementById('desk-edge-r')).backgroundColor, W:innerWidth}));
await sleep(900);
let s0=await state(); ok('launch: single meta + strips present', s0.metaN===1 && s0.nr===1 && s0.nl===1, JSON.stringify(s0));
await tag();
await p.evaluate(()=>document.querySelector('#btn-settings, #btn-set, [aria-label="설정"]').click()); await sleep(400);
const setTheme=(v)=>p.evaluate((v)=>[...document.querySelectorAll('#sheet-body button[data-k="theme"]')].find(b=>b.dataset.v===v).click(), v);
for (const [th,col] of [['sepia','#cdba90'],['night','#0a0b0d'],['paper','#dcd4c2']]) {
  await tag();
  await setTheme(th);
  for (let i=0;i<300;i++){ if (await p.evaluate((t)=>document.body.classList.contains('theme-'+t), th)) break; await sleep(10); }
  await sleep(15);
  const s1=await state();
  ok(th+': meta & strips replaced immediately', s1.metaTag==='' && s1.r==='' && s1.l==='' && s1.metaN===1 && s1.nr===1 && s1.nl===1, JSON.stringify(s1));
  ok(th+': theme-color = desk', s1.metaC.toLowerCase()===col, s1.metaC);
  await tag(); await sleep(200);
  const s2=await state(); ok(th+': replaced again ~150ms', s2.metaTag==='' && s2.r==='' && s2.metaN===1, JSON.stringify({m:s2.metaTag,r:s2.r}));
  await tag(); await sleep(650);
  const s3=await state(); ok(th+': replaced again ~700ms', s3.metaTag==='' && s3.r==='' && s3.metaN===1 && s3.nr===1, JSON.stringify({m:s3.metaTag,r:s3.r}));
  await tag(); await sleep(1500);
  const s4=await state(); ok(th+': then quiet (no endless swapping)', s4.metaTag==='1' && s4.r==='1', JSON.stringify({m:s4.metaTag,r:s4.r}));
}
// 크기 변화(접기/펴기) 뒤에도 한 번 다시 읽게 한다
await tag(); await p.setViewport({width:382,height:700,deviceScaleFactor:2}); await sleep(900);
const s6=await state(); ok('resize (fold) -> refresh', s6.metaTag==='' && s6.r==='' && s6.nr===1, JSON.stringify({m:s6.metaTag,r:s6.r,W:s6.W}));
await sleep(1500);
await tag(); await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); await sleep(400);
const s7=await state(); ok('visibilitychange (visible) -> refresh', s7.metaTag==='' && s7.r==='', JSON.stringify({m:s7.metaTag,r:s7.r}));
ok('no page errors', errs.length===0, JSON.stringify(errs));
console.log(fails? 'FAILS '+fails : 'ALL PASS'); await b.close(); process.exit(0);
