import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8954); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1}));}}, arg:null};
const R=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
const DEV=[['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0},299],['iPhone15 세로',393,852,{top:59,right:0,bottom:34,left:0},336],['Duo 접힘',466,678,{top:0,right:84,bottom:0,left:0},300]];
for (const [name,w,h,si,KB] of DEV) {
  const {p,errs}=await openDevice(b,[name,w,h,si],{seed,port:8954,query:'?native=1'}); await sleep(500);
  // ---- 설교노트 쓰기 창 ----
  await p.click('#btn-notes'); await sleep(500); await p.click('#sheet-act'); await sleep(600);
  const fields=await p.evaluate(()=>[...document.querySelectorAll('#sheet-body input:not([type=hidden]), #sheet-body textarea, #sheet-body select')].map(e=>e.tagName+'#'+(e.id||e.className)));
  console.log(name,'note fields:',fields.join(' '));
  const before=await p.evaluate(R('#sheet .panel')); 
  await p.evaluate(()=>document.querySelector('#sheet-body input, #sheet-body textarea').focus());
  await p.evaluate((kb)=>window.bfKeyboard(kb),KB); await sleep(700);
  const st=await p.evaluate(()=>({kb:document.documentElement.classList.contains('kb'), v:getComputedStyle(document.documentElement).getPropertyValue('--kb')}));
  const sh=await p.evaluate(R('#sheet')), pn=await p.evaluate(R('#sheet .panel'));
  ok(name+': html.kb + --kb set', st.kb && st.v.trim()===KB+'px', JSON.stringify(st));
  ok(name+': sheet backdrop still covers the whole screen (nothing shows through behind the keyboard)', Math.abs(sh.b-h)<=1 && await p.evaluate((w,h)=>{const e=document.elementFromPoint(w/2,h-6); return !!(e&&e.closest('#sheet'))},w,h), `sheet.b=${sh.b} H=${h}`);
  ok(name+': panel fully above keyboard', pn.b<=h-KB && pn.t>=0, `panel ${pn.t.toFixed(0)}..${pn.b.toFixed(0)} kbTop=${h-KB} (before ${before.t.toFixed(0)}..${before.b.toFixed(0)})`);
  // 맨 아래 입력 칸에 포커스 → 키보드 위에 보여야 한다
  const last=await p.evaluate(()=>{const es=[...document.querySelectorAll('#sheet-body input:not([type=hidden]), #sheet-body textarea')]; const e=es[es.length-1]; e.focus(); return e.tagName+'#'+(e.id||e.className)}); await sleep(900);
  const lr=await p.evaluate(()=>{const e=document.activeElement, r=e.getBoundingClientRect(), s=document.querySelector('#sheet-body').getBoundingClientRect(); return {t:r.top,b:r.bottom,sb:s.bottom,st:s.top, tag:e.tagName}});
  ok(name+': last field ('+last+') visible above keyboard', lr.b<=h-KB+1 && lr.t>=lr.st-1 && lr.t < h-KB, JSON.stringify(lr)+' kbTop='+(h-KB));
  await p.evaluate(()=>{document.activeElement.blur(); window.bfKeyboard(0)}); await sleep(400);
  const sh2=await p.evaluate(R('#sheet')); ok(name+': keyboard hidden → sheet full again', Math.abs(sh2.b-h)<=1 && !(await p.evaluate(()=>document.documentElement.classList.contains('kb'))), 'sheet.b='+sh2.b);
  await p.screenshot({path:`kb1-${name.replace(/\W/g,'_')}-note-after.png`});
  await p.evaluate(()=>document.querySelector('#sheet-close').click()); await sleep(300);
  // ---- 포토카드 ----
  await p.click('#btn-card'); await sleep(900);
  const cv0=await p.evaluate(R('#pc-canvas')), sv0=await p.evaluate(R('#pc-save')), md0=await p.evaluate(R('#pc-mode'));
  await p.evaluate((kb)=>{document.querySelector('#pc-cap').focus(); window.bfKeyboard(kb)},KB); await sleep(800);
  if (name==='Duo 접힘'||name==='iPhone15 세로') {} 
  const pc=await p.evaluate(R('#pc')); ok(name+': photocard screen covers the whole display (no reader text behind the keyboard)', Math.abs(pc.b-h)<=1 && await p.evaluate((w,h)=>[[6,h-6],[w/2,h-6],[w-6,h-6],[w/4,h-60],[w*0.75,h-60]].every(([x,y])=>{const e=document.elementFromPoint(x,y); return !!(e&&e.closest('#pc'))}),w,h), 'pc.b='+pc.b);
  const rbg=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('#pc')); return c.backgroundImage+'|'+c.backgroundColor}); console.log(' pc bg',rbg);
  const cap=await p.evaluate(R('#pc-cap')); ok(name+': caption input visible above keyboard', cap.b<=h-KB+1 && cap.t>=0, JSON.stringify(cap));
  if (name==='Duo 펼침') { const cv=await p.evaluate(R('#pc-canvas')), sv=await p.evaluate(R('#pc-save')), md=await p.evaluate(R('#pc-mode'));
    const same=(a,b)=>['l','t','r','b'].every(k=>Math.abs(a[k]-b[k])<=1);
    ok(name+': right screen unchanged when keyboard is up (card, mode switch, save button)', same(cv,cv0) && same(sv,sv0) && same(md,md0) && cv.h>300, JSON.stringify({cv,cv0}));
    ok(name+': left input pane is still lifted above the keyboard', (await p.evaluate(R('#pc-form'))).b<=h-KB+1, JSON.stringify(await p.evaluate(R('#pc-form'))));
    await p.screenshot({path:'kb1-duo-pc.png'}); }
  // 맨 아래 입력(날짜)에 포커스
  await p.evaluate(()=>{document.querySelector('#pc-date').focus()}); await sleep(900);
  const dt=await p.evaluate(R('#pc-date')); ok(name+': date input visible above keyboard', dt.b<=h-KB+1 && dt.t>=0, JSON.stringify(dt));
  await p.evaluate(()=>{document.querySelector('#pc-pt').focus()}); await sleep(900);
  const pt=await p.evaluate(R('#pc-pt')); ok(name+': pt input visible above keyboard', pt.b<=h-KB+1 && pt.t>=0, JSON.stringify(pt));
  if (name==='Duo 펼침') await p.screenshot({path:'kb1-duo-pc2.png'});
  await p.evaluate(()=>{document.activeElement.blur(); window.bfKeyboard(0)}); await sleep(500);
  const pc2=await p.evaluate(R('#pc')); ok(name+': overlay full again', Math.abs(pc2.b-h)<=1);
  ok(name+': no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
