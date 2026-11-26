import {fileURLToPath} from 'node:url';
import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'node:fs';
serve(8950); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const DIR=fileURLToPath(new URL('./', import.meta.url)), FIX=DIR+'fixtures/';
const seed={fn:()=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:42,chapter:2,verse:16}));}}, arg:null};
const DUO=['Duo 펼침 앱',951,669,{top:0,right:84,bottom:0,left:0}];
const rect=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;

{
  const {p,errs}=await openDevice(b,DUO,{seed,port:8950,query:'?native=1'}); await sleep(500);
  ok('header has 8 menu buttons in order: search, hl, notes, card, map, ask, acct, settings (v77)', await p.evaluate(()=>{const bs=[...document.querySelectorAll('.menu-row .mini-btn')].map(b=>b.id); return JSON.stringify(bs)===JSON.stringify(['btn-search','btn-hl','btn-notes','btn-card','btn-map','btn-ask','btn-acct','btn-settings'])}));
  const hb=await p.evaluate(()=>{const r=document.querySelector('.menu-row').getBoundingClientRect(); const t=document.querySelector('#btn-pick').getBoundingClientRect(); return {menuL:r.left,menuR:r.right,titleR:t.right,titleL:t.left,W:innerWidth}});
  console.log(' header', JSON.stringify(hb));
  ok('menu row does not collide with title', hb.titleR < hb.menuL || hb.titleL > hb.menuR, JSON.stringify(hb));
  await p.screenshot({path:DIR+'pc1-header.png'});
  await p.click('#btn-card'); await sleep(1200);
  ok('overlay opens', await p.evaluate(()=>!document.querySelector('#pc').hidden));
  const L=await p.evaluate(rect('.pc-l')), R=await p.evaluate(rect('.pc-r')), C=await p.evaluate(rect('#pc-canvas')), S=await p.evaluate(rect('#pc-save')), Bar=await p.evaluate(rect('.pc-bar'));
  console.log(' L',JSON.stringify(L),'\n R',JSON.stringify(R),'\n C',JSON.stringify(C),'\n S',JSON.stringify(S),'\n Bar',JSON.stringify(Bar));
  ok('two-pane mode', await p.evaluate(()=>document.querySelector('#pc').classList.contains('two')));
  ok('left pane = left screen, right pane = right screen', L.r<=476 && R.l>=474 && Math.abs(R.r-951)<=1, `L.r=${L.r} R.l=${R.l}`);
  ok('card sits below status pill (y>=118) and inside right pane', C.t>=118 && C.l>=R.l && C.r<=R.r && C.b<=S.t, `C=${C.t}..${C.b} S.t=${S.t}`);
  ok('card aspect 1080:1320', Math.abs(C.w/C.h-1080/1320)<0.01, (C.w/C.h).toFixed(4));
  ok('card centred in right pane', Math.abs((C.l+C.r)/2-(R.l+R.r)/2)<=14, `${(C.l+C.r)/2} vs ${(R.l+R.r)/2}`);
  ok('save button inside screen bottom', S.b<=669-10 && S.l>=R.l, `S.b=${S.b}`);
  const st=await p.evaluate(()=>({book:document.querySelector('#pc-book').selectedOptions[0].textContent, ch:document.querySelector('#pc-ch').value, v1:document.querySelector('#pc-v1').value, v2:document.querySelector('#pc-v2').value, verse:(document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')), date:document.querySelector('#pc-date').value}));
  console.log(' state', JSON.stringify(st));
  ok('starts from current reading position (요한복음 3:16)', st.book==='요한복음' && st.ch==='3' && st.v1==='16' && st.v2==='16' && /하나님이 세상을/.test(st.verse), JSON.stringify(st));
  ok('date defaults to today', /^\d{4}-\d{2}-\d{2}$/.test(st.date));
  await p.screenshot({path:DIR+'pc1-duo-empty.png'});

  // 구절 직접 입력
  await p.click('#pc-ref'); await p.type('#pc-ref','시 23:1-3'); await sleep(300);
  const st2=await p.evaluate(()=>({book:document.querySelector('#pc-book').selectedOptions[0].textContent, ch:document.querySelector('#pc-ch').value, v1:document.querySelector('#pc-v1').value, v2:document.querySelector('#pc-v2').value, verse:(document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')), ch_opt:document.querySelector('#pc-ch').selectedOptions[0].textContent}));
  console.log(' typed', JSON.stringify(st2));
  ok('typed ref → selects + text', st2.book==='시편' && st2.ch==='23' && st2.v1==='1' && st2.v2==='3' && /^여호와는 나의 목자시니/.test(st2.verse) && st2.ch_opt==='23편', JSON.stringify(st2));
  await p.evaluate(()=>{document.querySelector('#pc-ref').value=''});
  await p.click('#pc-ref'); await p.type('#pc-ref','쓸모없는말'); await p.keyboard.press('Enter'); await sleep(200);
  ok('bad ref shows message', await p.evaluate(()=>!document.querySelector('#pc-refmsg').hidden));
  await p.evaluate(()=>{document.querySelector('#pc-ref').value=''}); await p.click('#pc-ref'); await p.type('#pc-ref','요 3:16-18'); await p.keyboard.press('Enter'); await sleep(300);
  ok('ref message cleared after valid', await p.evaluate(()=>document.querySelector('#pc-refmsg').hidden && document.querySelector('#pc-v2').value==='18'));

  // select 로 구절 바꾸기
  await p.select('#pc-v2','17'); await sleep(200);
  ok('end verse select updates text (16-17)', await p.evaluate(()=>/요한복음 3:16-17/.test((document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')))===false && (document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')).includes('보내신 것은')));

  // 사진
  const fileIn=await p.$('#pc-file'); await fileIn.uploadFile(FIX+'testphoto.jpg'); await sleep(1500);
  ok('photo loaded (zoom enabled, remove enabled)', await p.evaluate(()=>!document.querySelector('#pc-zoom').disabled && !document.querySelector('#pc-nophoto').disabled && document.querySelector('#pc-hint').textContent.length>5));
  await p.type('#pc-cap','오늘도 은혜로 걸어갑니다'); await sleep(300);
  await p.screenshot({path:DIR+'pc1-duo-photo.png'});
  const snap1=await p.evaluate(()=>document.querySelector('#pc-canvas').toDataURL('image/png').length);
  // 사진 끌기/확대
  const cc=await p.evaluate(rect('#pc-canvas'));
  const before=await p.evaluate(()=>{const c=document.querySelector('#pc-canvas'); return c.toDataURL('image/jpeg',.5).length+':'+c.getContext('2d').getImageData(540,500,1,1).data.join(',')});
  await p.evaluate((cc)=>{const c=document.querySelector('#pc-canvas'); const mk=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:7,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); mk('pointerdown',cc.l+100,cc.t+150); mk('pointermove',cc.l+60,cc.t+150); mk('pointermove',cc.l+20,cc.t+150); mk('pointerup',cc.l+20,cc.t+150);},cc);
  await sleep(300);
  const after=await p.evaluate(()=>{const c=document.querySelector('#pc-canvas'); return c.toDataURL('image/jpeg',.5).length+':'+c.getContext('2d').getImageData(540,500,1,1).data.join(',')});
  ok('dragging photo changes the card', before!==after, before+' → '+after);
  await p.evaluate(()=>{const z=document.querySelector('#pc-zoom'); z.value=180; z.dispatchEvent(new Event('input',{bubbles:true}))}); await sleep(300);
  const after2=await p.evaluate(()=>{const c=document.querySelector('#pc-canvas'); return c.toDataURL('image/jpeg',.5).length+':'+c.getContext('2d').getImageData(540,500,1,1).data.join(',')});
  ok('zoom changes the card', after2!==after);
  // 두 손가락
  await p.evaluate((cc)=>{const c=document.querySelector('#pc-canvas'); const mk=(id,t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); const cx=cc.l+cc.w/2, cy=cc.t+cc.h/2; mk(1,'pointerdown',cx-30,cy); mk(2,'pointerdown',cx+30,cy); for(let i=1;i<=10;i++){mk(1,'pointermove',cx-30-i*6,cy); mk(2,'pointermove',cx+30+i*6,cy);} mk(1,'pointerup',cx-90,cy); mk(2,'pointerup',cx+90,cy);},cc);
  await sleep(300);
  const zv=await p.evaluate(()=>+document.querySelector('#pc-zoom').value); ok('pinch raised zoom beyond slider 180', zv>200, 'zoom='+zv);
  await p.evaluate(()=>{const z=document.querySelector('#pc-zoom'); z.value=130; z.dispatchEvent(new Event('input',{bubbles:true}))}); await sleep(300);
  await p.screenshot({path:DIR+'pc1-duo-photo2.png'});

  // 저장 → 공유 다리
  await p.click('#pc-save'); await sleep(1500);
  const msgs=await p.evaluate(()=>window.__msgs.filter(m=>m.share).map(m=>({name:m.name,len:m.share.length})));
  console.log(' share msgs', JSON.stringify(msgs));
  ok('save posts {share,name} to native bridge', msgs.length===1 && /^photocard-\d{8}\.jpg$/.test(msgs[0].name) && msgs[0].len>50000, JSON.stringify(msgs));
  const b64=await p.evaluate(()=>window.__msgs.filter(m=>m.share)[0].share);
  fs.writeFileSync(DIR+'pc1-export.jpg',Buffer.from(b64,'base64'));
  // 사진 빼기 → 배경
  await p.click('#pc-nophoto'); await sleep(300);
  ok('photo removed → zoom disabled', await p.evaluate(()=>document.querySelector('#pc-zoom').disabled));
  // 키/닫기
  await p.keyboard.press('Escape'); await sleep(200);
  ok('Escape closes', await p.evaluate(()=>document.querySelector('#pc').hidden));
  // 다시 열기: 문구/사진 유지, 구절은 현재 읽는 곳
  await p.click('#btn-card'); await sleep(900);
  const re=await p.evaluate(()=>({cap:document.querySelector('#pc-cap').value, v:(document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')).slice(0,12)}));
  ok('reopen keeps caption, verse follows reading position', re.cap==='오늘도 은혜로 걸어갑니다' && /하나님이 세상을/.test(re.v), JSON.stringify(re));
  ok('no page errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
