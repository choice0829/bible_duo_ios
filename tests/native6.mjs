import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8940); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1}));}}, arg:null};
const DEVS=[['Duo 접힘 앱',466,678,{top:0,right:0,bottom:0,left:0}],['iPhone15 세로 앱',393,852,{top:59,right:0,bottom:34,left:0}],['SE3 세로 앱',375,667,{top:20,right:0,bottom:0,left:0}]];
const probe=()=>{const q=(s)=>document.querySelector(s); const bk=q('#book'); const cs=getComputedStyle(bk), hs=getComputedStyle(document.documentElement), bs=getComputedStyle(document.body);
  const r=bk.getBoundingClientRect(); return {cls:bk.className, full:document.documentElement.classList.contains('full'), htmlBg:hs.backgroundColor, bodyBg:bs.backgroundColor, bookBg:cs.backgroundColor, img:hs.backgroundImage+'|'+bs.backgroundImage, shadow:cs.boxShadow, rad:cs.borderTopLeftRadius, top:r.top, bottom:r.bottom, left:r.left, right:r.right, W:innerWidth,H:innerHeight, errs:0}};
for (const [name,w,h,si] of DEVS) {
  const {p,errs}=await openDevice(b,[name,w,h,si],{seed,port:8940,query:'?native=1'}); await sleep(600);
  const r=await p.evaluate(probe); console.log(name, JSON.stringify(r));
  ok(name+' scroll mode', /scroll/.test(r.cls) && !r.full);
  ok(name+' v85: background (header area) brand navy, book paper, no card', r.htmlBg===r.bodyBg && r.htmlBg==='rgb(30, 58, 95)' && r.bookBg!==r.htmlBg, r.htmlBg+' '+r.bodyBg+' '+r.bookBg);
  ok(name+' no texture/image', r.img==='none|none', r.img);
  ok(name+' no shadow/outline, square corners', r.shadow==='none' && r.rad==='0px', r.shadow+' '+r.rad);
  const m=await p.evaluate(()=>{const c=document.querySelector('#book .chap'); const cs=getComputedStyle(c); const q=(s)=>document.querySelector(s); const rb=q('.head-row .mini-btn:last-child').getBoundingClientRect(); const t=q('#btn-pick').getBoundingClientRect(); const pl=parseFloat(cs.paddingLeft), pr=parseFloat(cs.paddingRight); const cr=c.getBoundingClientRect(); const p=c.querySelector('.typo p, p'); const pr2=p?p.getBoundingClientRect():null; return {pl,pr,W:innerWidth,menuR:rb.right,titleL:t.left,pL:pr2&&pr2.left,pR:pr2&&pr2.right, cl:cr.left, crr:cr.right}});
  console.log('  margins', JSON.stringify(m));
  // v81: 듀오 접힘 앱은 오른쪽 메뉴 레일 자리를 비운다(v86: 오른쪽 84 = 레일 22 + 52 + 간격 10). 다른 아이폰은 24/24
  const wantR=name==='Duo 접힘 앱'?84:24;
  ok(name+' side margins 24/'+wantR, m.pl===24 && m.pr===wantR, m.pl+' / '+m.pr);
  ok(name+' title and menu aligned to text edges', Math.abs(m.titleL-24)<=3 && Math.abs((m.W-m.menuR)-(name==='Duo 접힘 앱'?22:24))<=1.5, 'title '+m.titleL+' menuR gap '+(m.W-m.menuR));
  ok(name+' no page errors', errs.length===0, JSON.stringify(errs));
  await p.screenshot({path:'native6-'+name.replace(/[^\w]/g,'_')+'.png'});
  if (name==='Duo 접힘 앱') {
    // 펼치기 → 접기 전환
    const cdp=await p.createCDPSession();
    await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:84}}).catch(()=>{});
    await p.setViewport({width:951,height:669,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(2500);
    const s=await p.evaluate(()=>({full:document.documentElement.classList.contains('full'), sp:document.body.classList.contains('is-spread'), bg:getComputedStyle(document.documentElement).backgroundColor, st:document.querySelector('#stage').getBoundingClientRect().top}));
    ok('unfold → spread (full)', s.full && s.sp && s.st>=114, JSON.stringify(s));
    await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,left:0,bottom:0,right:0}}).catch(()=>{});
    await p.setViewport({width:466,height:678,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(2500);
    const f=await p.evaluate(probe); ok('fold again → scroll, no card', /scroll/.test(f.cls) && !f.full && f.shadow==='none' && f.htmlBg==='rgb(30, 58, 95)', JSON.stringify([f.cls,f.full,f.shadow]));
  }
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
