import {fileURLToPath} from 'node:url';
import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'node:fs';
serve(8961); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const DIR=fileURLToPath(new URL('./', import.meta.url)), FIX=DIR+'fixtures/';
const seed={fn:()=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:42,chapter:2,verse:16}));}}, arg:null};
const DUO=['Duo 펼침 앱',951,669,{top:0,right:84,bottom:0,left:0}];
const R=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
// 캔버스에서 조건에 맞는 픽셀의 경계 상자
const BB=(p,r,mode)=>p.evaluate((r,mode)=>{const c=document.querySelector('#pc-canvas'); const d=c.getContext('2d').getImageData(r[0],r[1],r[2]-r[0],r[3]-r[1]); let x0=1e9,y0=1e9,x1=-1,y1=-1; for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){const i=(y*d.width+x)*4,R=d.data[i],G=d.data[i+1],B=d.data[i+2]; const hit=mode==='white'?(R>=240&&G>=240&&B>=240):(R<110&&G<110&&B<110); if(hit){if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;}} if(x1<0) return null; const o={l:x0+r[0],r:x1+r[0]+1,t:y0+r[1],b:y1+r[1]+1}; o.w=o.r-o.l; o.h=o.b-o.t; o.cx=(o.l+o.r)/2; o.cy=(o.t+o.b)/2; return o;},r,mode);
const PH=[62,62,1018,1018], BAND=[10,1024,1070,1312];
const near=(a,b,t)=>Math.abs(a-b)<=t;

{
  const {p,errs}=await openDevice(b,DUO,{seed,port:8961,query:'?native=1'}); await sleep(500);
  const mode=async(m)=>{ await p.click(`#pc-mode button[data-m=${m}]`); await sleep(250); };
  const drag=async(x0,y0,dx,dy)=>{ await p.evaluate((x0,y0,dx,dy)=>{const c=document.querySelector('#pc-canvas'); const mk=(t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:5,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); mk('pointerdown',x0,y0); for(let i=1;i<=8;i++) mk('pointermove',x0+dx*i/8,y0+dy*i/8); mk('pointerup',x0+dx,y0+dy);},x0,y0,dx,dy); await sleep(250); };
  await p.click('#btn-card'); await sleep(1300);

  // ---- 화면 구성 ----
  ok('renamed to 바이블 포토 카드 (title, menu button)', await p.evaluate(()=>document.querySelector('.pc-bar strong').textContent==='바이블 포토 카드' && document.querySelector('#btn-card').title==='바이블 포토 카드'));
  ok('no verse edit box any more; reference inputs remain', await p.evaluate(()=>!document.querySelector('#pc-verse') && !!document.querySelector('#pc-ref') && !!document.querySelector('#pc-book') && !document.querySelector('#pc textarea')));
  ok('mode switch present, starts in 글씨 배치 (no photo)', await p.evaluate(()=>document.querySelector('#pc-mode button.on')?.dataset.m==='text'));
  ok('target switch: 구절 글씨 selected', await p.evaluate(()=>document.querySelector('#pc-tg button.on')?.dataset.t==='v'));
  const auto0=await p.evaluate(()=>({v:document.querySelector('#pc-pt').value, chip:document.querySelector('#pc-pt-auto').classList.contains('on')}));
  const A0=+auto0.v; ok('auto size shown in pt (30–36pt for a short verse)', auto0.chip && A0>=30 && A0<=36, JSON.stringify(auto0));
  const C=await p.evaluate(R('#pc-canvas')), S=await p.evaluate(R('#pc-save')), M=await p.evaluate(R('#pc-mode'));
  ok('Duo: card clear of status pill; mode switch between card and save', C.t>=118 && C.b<=M.t+1 && M.b<=S.t && S.b<=669-10, JSON.stringify({C:[C.t,C.b],M:[M.t,M.b],S:[S.t,S.b]}));
  await p.screenshot({path:DIR+'pc4-duo-text.png'});

  // ---- 기본 배치(가운데) ----
  await mode('photo');
  const b0=await BB(p,PH,'white');
  console.log(' default bbox',JSON.stringify(b0));
  ok('default: centered block (x≈540, y≈photo middle 540)', b0 && near(b0.cx,540,6) && near(b0.cy,540,14), JSON.stringify(b0));

  // ---- 정렬 ----
  await p.click('#pc-al button[data-v=l]'); await sleep(250);
  const bl=await BB(p,PH,'white'); ok('left align: text hugs the left edge of the box (~141)', near(bl.l,141,10), JSON.stringify(bl));
  await p.click('#pc-al button[data-v=r]'); await sleep(250);
  const br=await BB(p,PH,'white'); ok('right align: text hugs the right edge of the box (~939)', near(br.r,939,12), JSON.stringify(br));
  ok('alignment buttons reflect state', await p.evaluate(()=>document.querySelector('#pc-al button.on')?.dataset.v==='r'));
  await p.screenshot({path:DIR+'pc4-duo-right.png'});
  await p.click('#pc-al button[data-v=c]'); await sleep(250);

  // ---- 크기(pt) ----
  await p.click('#pc-pt-p'); await p.click('#pc-pt-p'); await p.click('#pc-pt-p'); await sleep(250);
  const v1=await p.evaluate(()=>({v:document.querySelector('#pc-pt').value, chip:document.querySelector('#pc-pt-auto').classList.contains('on'), r:document.querySelector('#pc-pt-r').value}));
  const b1=await BB(p,PH,'white');
  ok('+ ×3 → auto+3 pt, auto off, slider follows', +v1.v===A0+3 && !v1.chip && +v1.r===A0+3, JSON.stringify(v1));
  ok('bigger pt → bigger block', b1.h>b0.h+4, `h ${b0.h} → ${b1.h}`);
  await p.evaluate(()=>{const n=document.querySelector('#pc-pt'); n.focus(); n.value='20'; n.dispatchEvent(new Event('input',{bubbles:true})); n.blur(); n.dispatchEvent(new Event('change',{bubbles:true}));}); await sleep(250);
  const b2=await BB(p,PH,'white');
  ok('typed 20pt → smaller block', b2.h<b0.h-4 && (await p.evaluate(()=>+document.querySelector('#pc-pt-r').value))===20, `h ${b0.h} → ${b2.h}`);
  await p.evaluate(()=>{const r=document.querySelector('#pc-pt-r'); r.value=60; r.dispatchEvent(new Event('input',{bubbles:true}));}); await sleep(250);
  const b60=await BB(p,PH,'white'); ok('60pt (max) stays inside the card', b60 && b60.l>=24 && b60.r<=1056 && b60.t>=24 && b60.b<=1296, JSON.stringify(b60));
  ok('overflow warning shown when 60pt cannot fit', await p.evaluate(()=>!document.querySelector('#pc-warn').hidden));
  await p.click('#pc-pt-auto'); await sleep(300);
  const b3=await BB(p,PH,'white');
  ok('자동 → back to the original size', near(b3.h,b0.h,3) && await p.evaluate((A0)=>document.querySelector('#pc-pt-auto').classList.contains('on') && +document.querySelector('#pc-pt').value===A0, A0), `h ${b3.h} vs ${b0.h}`);
  ok('warning cleared again', await p.evaluate(()=>document.querySelector('#pc-warn').hidden));

  // ---- 너비 ----
  await p.evaluate(()=>{const r=document.querySelector('#pc-w'); r.value=50; r.dispatchEvent(new Event('input',{bubbles:true}));}); await sleep(250);
  const bw=await BB(p,PH,'white'); ok('width 50% → narrower block', bw.w<b0.w-100 && near(bw.cx,540,8), `w ${b0.w} → ${bw.w}`);

  // ---- 끌어서 배치 ----
  await mode('text');
  const cv=await p.evaluate(R('#pc-canvas')); const sc=1080/cv.w;
  const cx0=cv.l+cv.w/2, cy0=cv.t+cv.h*(540/1320);
  await drag(cx0,cy0,-40,15);
  await mode('photo');
  const bd=await BB(p,PH,'white');
  ok('drag (−40,+30 css px) moves the block by that much', near(bd.cx-bw.cx,-40*sc,8) && near(bd.cy-bw.cy,15*sc,8), `Δ=(${(bd.cx-bw.cx).toFixed(0)},${(bd.cy-bw.cy).toFixed(0)}) want (${(-40*sc).toFixed(0)},${(15*sc).toFixed(0)})`);
  await mode('text');
  await p.screenshot({path:DIR+'pc4-duo-dragged.png'});
  await p.click('#pc-pos-reset'); await sleep(250); await mode('photo');
  const brs=await BB(p,PH,'white'); ok('위치 되돌리기 → back to default', near(brs.cx,bw.cx,3) && near(brs.cy,bw.cy,3), JSON.stringify({brs,bw}));
  await mode('text'); await drag(cx0,cy0,-2,2); await mode('photo');
  const bsn=await BB(p,PH,'white'); ok('tiny drag snaps back to center (guide)', near(bsn.cx,bw.cx,2) && near(bsn.cy,bw.cy,2), JSON.stringify({bsn,bw}));
  await mode('text'); await drag(cx0,cy0,-400,-400); await mode('photo');
  const bcl=await BB(p,PH,'white'); ok('drag far away stays inside the card (margin 24)', bcl && bcl.l>=20 && bcl.t>=20, JSON.stringify(bcl));
  await mode('text'); await p.click('#pc-pos-reset');

  // ---- 두 손가락으로 크기 ----
  await p.evaluate(()=>{const r=document.querySelector('#pc-pt-r'); r.value=24; r.dispatchEvent(new Event('input',{bubbles:true}));}); await sleep(200);
  await p.evaluate((cx,cy)=>{const c=document.querySelector('#pc-canvas'); const mk=(id,t,x,y)=>c.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); mk(1,'pointerdown',cx-20,cy); mk(2,'pointerdown',cx+20,cy); for(let i=1;i<=10;i++){mk(1,'pointermove',cx-20-i*4,cy); mk(2,'pointermove',cx+20+i*4,cy);} mk(1,'pointerup',cx-60,cy); mk(2,'pointerup',cx+60,cy);},cx0,cy0); await sleep(300);
  const pz=await p.evaluate(()=>+document.querySelector('#pc-pt').value); ok('pinch in 글씨 모드 raises pt (24 → >35)', pz>35, 'pt='+pz);
  await p.click('#pc-pt-auto'); await sleep(200);

  // ---- 추가 문구 ----
  await p.click('#pc-tg button[data-t=c]'); await sleep(200);
  await p.evaluate(()=>{const c=document.querySelector('#pc-showdate'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));}); await sleep(250);
  ok('caption without text and date: guidance shown', await p.evaluate(()=>!document.querySelector('#pc-none').hidden));
  await p.type('#pc-cap','오늘도 은혜로 걸어갑니다'); await sleep(300);
  ok('caption guidance hidden once text exists', await p.evaluate(()=>document.querySelector('#pc-none').hidden));
  await p.evaluate(()=>{const c=document.querySelector('#pc-showdate'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));}); await sleep(200);
  const cap0=await p.evaluate(()=>({v:document.querySelector('#pc-pt').value, chip:document.querySelector('#pc-pt-auto').classList.contains('on')}));
  ok('caption auto size is shown (29pt)', cap0.chip && +cap0.v===29, JSON.stringify(cap0));
  await mode('photo'); const c0=await BB(p,BAND,'dark'); console.log(' caption bbox',JSON.stringify(c0));
  ok('caption sits centered in the white band', c0 && near(c0.cx,540,6) && c0.t>1024, JSON.stringify(c0));
  const INK=()=>p.evaluate((r)=>{const d=document.querySelector('#pc-canvas').getContext('2d').getImageData(r[0],r[1],r[2]-r[0],r[3]-r[1]).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]<110&&d[i+1]<110&&d[i+2]<110) n++; return n;},BAND);
  const ink0=await INK();
  await p.click('.pc-seg[data-k=font] button[data-v=nanumG]'); await sleep(1200);
  const ink1=await INK(), cf=await BB(p,BAND,'dark');
  ok('글씨체 also applies to 추가 문구 (caption ink changes with the font)', Math.abs(ink1-ink0)/ink0>0.05 || Math.abs(cf.w-c0.w)>8, `ink ${ink0} → ${ink1}, w ${c0.w} → ${cf.w}`);
  await p.click('.pc-seg[data-k=font] button[data-v=nanumM]'); await sleep(900);
  await p.click('#pc-al button[data-v=l]'); await sleep(250);
  const c1=await BB(p,BAND,'dark'); ok('caption left aligned (box left ≈ 108)', near(c1.l,108,12), JSON.stringify(c1));
  await p.click('#pc-pt-m'); await p.click('#pc-pt-m'); await p.click('#pc-pt-m'); await p.click('#pc-pt-m'); await sleep(250);
  const c2=await BB(p,BAND,'dark'); ok('caption 4pt smaller → smaller', c2.h<c1.h-2 || c2.w<c1.w-10, `${c1.w}x${c1.h} → ${c2.w}x${c2.h}`);
  // 문구를 끌어서(손가락이 닿은 덩어리가 선택된다) 사진 쪽으로 올리면 사진 위 글자색(흰색)으로 바뀐다
  await mode('text');
  await p.click('#pc-tg button[data-t=v]'); await sleep(150);
  const capY=cv.t+cv.h*(1166/1320);
  await drag(cv.l+cv.w*0.3,capY,0,-110);
  ok('touching the caption selects it (target switches to 추가 문구)', await p.evaluate(()=>document.querySelector('#pc-tg button.on')?.dataset.t==='c'));
  await mode('photo');
  const cm=await BB(p,PH,'white'); const cb=await BB(p,BAND,'dark');
  console.log(' moved caption: white bbox in photo',JSON.stringify(cm),' dark in band',JSON.stringify(cb));
  ok('caption moved onto the photo turns white (photo ink)', cm && cm.b>b0.b-10 && (!cb || cb.t>1024), '');
  await mode('text'); await p.click('#pc-pos-reset'); await p.click('#pc-tg button[data-t=v]');

  // ---- 저장: 안내선이 사진에 들어가지 않는다 ----
  await mode('text');
  await p.click('#pc-save'); await sleep(1500);
  const b64=await p.evaluate(()=>window.__msgs.filter(m=>m.share).pop().share);
  fs.writeFileSync(DIR+'pc4-export.jpg',Buffer.from(b64,'base64'));
  const ex=await p.evaluate(async(b64,r)=>{const im=new Image(); await new Promise(res=>{im.onload=res; im.src='data:image/jpeg;base64,'+b64;}); const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0); const d=x.getImageData(r[0],r[1],r[2]-r[0],r[3]-r[1]); let reds=0; for(let i=0;i<d.data.length;i+=4){ if(d.data[i]>190&&d.data[i+1]<110&&d.data[i+2]<90) reds++; } return {w:im.width,h:im.height,reds};},b64,PH);
  ok('export is 1080×1320 and has no red guide pixels', ex.w===1080 && ex.h===1320 && ex.reds<30, JSON.stringify(ex));
  const live=await p.evaluate((r)=>{const c=document.querySelector('#pc-canvas'); const d=c.getContext('2d').getImageData(r[0],r[1],r[2]-r[0],r[3]-r[1]); let reds=0; for(let i=0;i<d.data.length;i+=4){ if(d.data[i]>190&&d.data[i+1]<110&&d.data[i+2]<90) reds++; } return reds;},PH);
  ok('after saving, the on-screen preview shows the guides again', live>300, 'reds='+live);

  // ---- 설정 기억 ----
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.pc')));
  console.log(' saved pref',JSON.stringify(saved));
  ok('prefs saved (v/c objects, no old size)', saved.v && saved.c && !('size' in saved) && saved.c.al==='l', JSON.stringify(saved));
  ok('no page errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}

// ---- 좁은 화면(아이폰 세로) ----
{
  const IP=['iPhone15 세로 앱',393,852,{top:59,right:0,bottom:34,left:0}];
  const {p,errs}=await openDevice(b,IP,{seed,port:8961,query:'?native=1'}); await sleep(500);
  await p.click('#btn-card'); await sleep(1200);
  const tt=await p.evaluate(()=>{const r=(s)=>document.querySelector(s).getBoundingClientRect(); const t=r('.pc-bar strong'), x=r('#pc-close'), g=r('.pc-tabs'); return {tl:t.left,tr:t.right,xr:x.right,gl:g.left,gr:g.right,fs:getComputedStyle(document.querySelector('.pc-bar strong')).fontSize,ww:document.querySelector('.pc-bar strong').scrollWidth,sw:document.querySelector('.pc-bar strong').clientWidth,th:document.querySelector('.pc-tabs button').getBoundingClientRect().height}});
  ok('narrow: title 바이블 포토 카드 fits between 닫기 and the tabs', tt.tl>=tt.xr+4 && tt.tr<=tt.gl-4 && tt.gr<=393-10 && tt.ww<=tt.sw+1, JSON.stringify(tt));
  const form=await p.evaluate(()=>{const f=document.querySelector('#pc-form'); return {sw:f.scrollWidth,cw:f.clientWidth}});
  ok('narrow: no horizontal overflow in the form', form.sw<=form.cw+1, JSON.stringify(form));
  const row=await p.evaluate(R('.pc-pt')), pr=await p.evaluate(R('#pc-pt-auto'));
  ok('narrow: pt row fits (자동 button inside the screen)', pr.r<=393-10 && row.r<=393-10, JSON.stringify({row:row.r,auto:pr.r}));
  await p.evaluate(()=>document.querySelector('#pc-pt-r').scrollIntoView({block:'center'})); await sleep(200);
  await p.screenshot({path:DIR+'pc4-iphone-input.png'});
  await p.click('.pc-tabs button[data-t=r]'); await sleep(500);
  const C=await p.evaluate(R('#pc-canvas')), S=await p.evaluate(R('#pc-save')), M=await p.evaluate(R('#pc-mode'));
  ok('narrow card tab: canvas / mode switch / save stack without overlap', C.b<=M.t+1 && M.b<=S.t && S.b<=852-20 && C.h>200, JSON.stringify({C:[C.t,C.b],M:[M.t,M.b],S:[S.t,S.b]}));
  await p.screenshot({path:DIR+'pc4-iphone-card.png'});
  ok('no page errors (narrow)', errs.length===0, JSON.stringify(errs));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
