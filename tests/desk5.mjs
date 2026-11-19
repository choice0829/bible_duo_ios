import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'fs';
serve(8908); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:1,chapter:1,verse:7}));}}, arg:null};
const SPREAD=['Duo 펼침',867,669,{top:0,right:0,bottom:34,left:0}], FOLD=['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0}];
for (const [dev,dn] of [[SPREAD,'spread'],[FOLD,'fold']]) {
  const {p,errs}=await openDevice(b,dev,{seed,port:8908}); await sleep(700);
  const r=await p.evaluate(()=>{const q=id=>{const e=document.getElementById(id); const b=e.getBoundingClientRect(); const cs=getComputedStyle(e); return {x:b.x,w:b.width,h:Math.round(b.height),bg:cs.backgroundColor,pe:cs.pointerEvents,z:cs.zIndex}}; 
    const hit=document.elementFromPoint(innerWidth-2, 300); return {l:q('desk-edge-l'), r:q('desk-edge-r'), W:innerWidth, hitId:hit&&(hit.id||hit.className)}});
  console.log(dn, JSON.stringify(r));
  ok(dn+' right strip at right edge, desk colored', Math.abs(r.r.x+r.r.w-r.W)<0.5 && r.r.bg==='rgb(220, 212, 194)', r.r.bg);
  ok(dn+' strips are click-through (elementFromPoint skips)', r.l.pe==='none' && r.r.pe==='none' && !/desk-edge/.test(String(r.hitId)), String(r.hitId));
  // 오른쪽 끝 탭으로 쪽 넘기기가 여전히 되는지 (펼침일 때)
  if (dn==='spread') {
    const before=await p.evaluate(()=>document.querySelector('.page.--right, .stf__item')?.textContent?.slice(0,20)||'');
    await p.touchscreen.tap(860,300); await sleep(1200);
    const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.pos')||'{}'));
    console.log('pos after right-edge tap', JSON.stringify(after));
  }
  await p.screenshot({path:`desk/edge-${dn}.png`});
  ok(dn+' no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
