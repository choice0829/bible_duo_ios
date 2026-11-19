import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'fs';
import {execFileSync} from 'child_process';
serve(8879); const b=await launch(); let fails=0;
const ok=(n,c,x='')=>{ if(!c) fails++; console.log((c?'ok   ':'FAIL ')+n+(x?' — '+x:'')); };
const seed={fn:()=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:25,chapter:0,verse:12}));}}, arg:null};
const LAND=['Duo',867,587,{top:0,right:84,bottom:0,left:0}];
const set=async(p,cdp,w,h,si)=>{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:si}); await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true}); };
const shot=async(p)=>{ const buf=await p.screenshot(); return buf; };
const {p:fp}=await openDevice(b,LAND,{seed,port:8879}); await sleep(500); const fresh=await shot(fp); await fp.close();
const diff=(a,b2)=>a.equals(b2);
const scen={
 'finger held across rotation, released after': async(p,cdp)=>{ await p.touchscreen.touchStart(850,40); await p.touchscreen.touchMove(800,44); await p.touchscreen.touchMove(700,50); await sleep(100);
    await set(p,cdp,587,867,{top:84,right:0,bottom:0,left:0}); await sleep(300); await p.touchscreen.touchMove(600,60).catch(()=>{}); await sleep(1500);
    await set(p,cdp,867,587,LAND[3]); await sleep(400); await p.touchscreen.touchMove(650,60).catch(()=>{}); await sleep(1500); await p.touchscreen.touchEnd().catch(()=>{}); await sleep(3500); },
 'finger down after return, moves, no release for 2s': async(p,cdp)=>{ await set(p,cdp,587,867,{top:84,right:0,bottom:0,left:0}); await sleep(1500); await set(p,cdp,867,587,LAND[3]); await sleep(700);
    await p.touchscreen.touchStart(850,40).catch(()=>{}); await p.touchscreen.touchMove(820,44).catch(()=>{}); await sleep(2000); await p.touchscreen.touchEnd().catch(()=>{}); await sleep(3500); },
 'tap right edge to turn page then rotate mid-animation': async(p,cdp)=>{ await p.touchscreen.tap(800,300); await sleep(250); await set(p,cdp,587,867,{top:84,right:0,bottom:0,left:0}); await sleep(1500); await set(p,cdp,867,587,LAND[3]); await sleep(4000); },
};
for (const [name,fn] of Object.entries(scen)) {
  const {p,errs,cdp}=await openDevice(b,LAND,{seed,port:8879}); await sleep(500);
  await fn(p,cdp); const s=await shot(p); fs.writeFileSync('rot9-'+name.replace(/\W+/g,'_').slice(0,30)+'.png',s);
  const info=await p.evaluate(()=>({loc:document.querySelector('#loc-book')?.textContent, st:getComputedStyle(document.querySelector('#stage')).display}));
  const same=diff(s,fresh);
  // 책장이 넘어간 경우(3번)는 화면이 달라도 정상이므로 '접힌 채 멈춤'만 확인: 잠시 뒤 다시 찍어 두 장이 같고(멈춘 애니메이션 없음) 오류가 없어야 한다
  await sleep(1200); const s2=await shot(p);
  fs.writeFileSync('rot9-tmp-a.png',s); fs.writeFileSync('rot9-tmp-b.png',s2);
  const nd=+execFileSync('python3',['pixdiff.py','rot9-tmp-a.png','rot9-tmp-b.png']).toString().trim();
  ok(name+': settled & stable', nd===0, 'visible-diff px='+nd);
  ok(name+': no errors', errs.length===0, errs[0]);
  console.log('  ',name,'identical to fresh:',same);
  await p.close();
}
console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(0);
