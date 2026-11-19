import {fileURLToPath} from 'node:url';
import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'node:fs';
serve(8951); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const DIR=fileURLToPath(new URL('./', import.meta.url)), FIX=DIR+'fixtures/';
const mkSeed=(theme='paper',extra={})=>({fn:(a)=>{ const theme=a[0], extra=a[1]; window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:18,chapter:22,verse:1})); localStorage.setItem('bf.settings',JSON.stringify({fontSize:18,theme,layout:'auto',font:'myeongjo',std:false,desk:'plain',...extra}));}}, arg:undefined});
const rect=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
async function open(dev,theme='paper'){ const sd=mkSeed(theme); const o=await openDevice(b,dev,{seed:{fn:sd.fn,arg:[theme,{}]},port:8951,query:'?native=1'}); return o; }

// 1) Duo 접힘(좁은 화면): 탭
{
  const dev=['Duo 접힘 앱',466,678,{top:0,right:0,bottom:0,left:0}];
  const {p,errs}=await open(dev); await sleep(400);
  await p.click('#btn-card'); await sleep(1000);
  const m=await p.evaluate(()=>({narrow:document.querySelector('#pc').classList.contains('narrow'), tab:document.querySelector('#pc').dataset.tab, lDisp:getComputedStyle(document.querySelector('.pc-l')).display, rDisp:getComputedStyle(document.querySelector('.pc-r')).display, tabs:getComputedStyle(document.querySelector('.pc-tabs')).display}));
  ok('fold: narrow mode with tabs, input tab first', m.narrow && m.tab==='l' && m.lDisp!=='none' && m.rDisp==='none' && m.tabs!=='none', JSON.stringify(m));
  await p.screenshot({path:DIR+'pc2-fold-l.png'});
  const f=await p.evaluate(rect('.pc-form')); ok('fold: form fits in screen', f.r<=466 && f.l>=0 && f.b<=678, JSON.stringify(f));
  await p.click('.pc-tabs button[data-t="r"]'); await sleep(500);
  const C=await p.evaluate(rect('#pc-canvas')), S=await p.evaluate(rect('#pc-save'));
  console.log(' C',JSON.stringify(C),' S',JSON.stringify(S));
  ok('fold: card tab shows card inside the screen with save button below', C&&C.w>200&&C.l>=18&&C.r<=466-18&&C.b<=S.t&&S.b<=678, JSON.stringify([C,S]));
  await p.screenshot({path:DIR+'pc2-fold-r.png'});
  await p.click('#pc-save'); await sleep(1200);
  ok('fold: save works', (await p.evaluate(()=>window.__msgs.filter(m=>m.share).length))===1);
  await p.click('.pc-tabs button[data-t="l"]'); await sleep(200);
  ok('fold: back to input tab', await p.evaluate(()=>getComputedStyle(document.querySelector('.pc-l')).display!=='none' && getComputedStyle(document.querySelector('.pc-r')).display==='none'));
  ok('fold: no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
// 2) iPhone 15 세로 (안전영역 위 59)
{
  const dev=['iPhone15 세로 앱',393,852,{top:59,right:0,bottom:34,left:0}];
  const {p,errs}=await open(dev); await sleep(400);
  await p.click('#btn-card'); await sleep(1000);
  const bar=await p.evaluate(rect('.pc-x'));
  ok('iPhone portrait: close button below status bar', bar.t>=59, JSON.stringify(bar));
  await p.click('.pc-tabs button[data-t="r"]'); await sleep(500);
  const C=await p.evaluate(rect('#pc-canvas')), S=await p.evaluate(rect('#pc-save'));
  ok('iPhone portrait: save button above home indicator (bottom<=852-34)', S.b<=852-34+0.5, JSON.stringify(S));
  ok('iPhone portrait: card visible', C.w>250 && C.b<=S.t, JSON.stringify(C));
  await p.screenshot({path:DIR+'pc2-iphone-r.png'});
  ok('iphone: no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
// 3) iPhone 15 가로 (좌우 안전영역 59)
{
  const dev=['iPhone15 가로 앱',852,393,{top:0,right:59,bottom:21,left:59}];
  const {p,errs}=await open(dev); await sleep(400);
  await p.click('#btn-card'); await sleep(1000);
  ok('iPhone landscape: two-pane', await p.evaluate(()=>document.querySelector('#pc').classList.contains('two')));
  const L=await p.evaluate(rect('.pc-form')), C=await p.evaluate(rect('#pc-canvas')), S=await p.evaluate(rect('#pc-save')), X=await p.evaluate(rect('.pc-x'));
  console.log(' L',JSON.stringify(L),' C',JSON.stringify(C),' S',JSON.stringify(S),' X',JSON.stringify(X));
  ok('landscape: left content clear of notch side (x>=59)', X.l>=59 && L.l>=59, `X.l=${X.l} L.l=${L.l}`);
  ok('landscape: right content clear of right notch side (x<=852-59)', C.r<=852-59 && S.r<=852-59, `C.r=${C.r} S.r=${S.r}`);
  ok('landscape: save button above bottom inset', S.b<=393-21+0.5, `S.b=${S.b}`);
  ok('landscape: card fully visible', C.t>=0 && C.b<=S.t && C.h>150, JSON.stringify(C));
  await p.screenshot({path:DIR+'pc2-iphone-land.png'});
  ok('landscape: no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
// 4) Duo 펼침: 야간 · 검정 틀 · 긴 본문 · 세로 사진 · 설정 유지
{
  const dev=['Duo 펼침 앱',951,669,{top:0,right:84,bottom:0,left:0}];
  const {p,errs}=await open(dev,'night'); await sleep(400);
  await p.click('#btn-card'); await sleep(1000);
  await p.screenshot({path:DIR+'pc2-night.png'});
  // 긴 본문
  await p.evaluate(()=>{const r=document.querySelector('#pc-ref'); r.value='시 119:1-14'; r.dispatchEvent(new Event('input',{bubbles:true}))}); await sleep(500);
  ok('long text: warning visible', await p.evaluate(()=>!document.querySelector('#pc-warn').hidden && (document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')).length>200), await p.evaluate(()=>(document.querySelector('#pc-canvas').getAttribute('aria-label').split(' · ').slice(2).join(' · ')).length+''));
  await p.screenshot({path:DIR+'pc2-long.png'});
  await p.evaluate(()=>{const r=document.querySelector('#pc-ref'); r.value='요 3:16'; r.dispatchEvent(new Event('input',{bubbles:true}))}); await sleep(300);
  ok('warning clears for short text', await p.evaluate(()=>document.querySelector('#pc-warn').hidden));
  // 프레임 검정 + 진한 글자
  await p.evaluate(()=>{document.querySelector('.pc-seg[data-k="frame"] button[data-v="black"]').click()}); await sleep(300);
  const px=await p.evaluate(()=>Array.from(document.querySelector('#pc-canvas').getContext('2d').getImageData(8,8,1,1).data));
  ok('black frame corner pixel', Math.abs(px[0]-23)<=3&&Math.abs(px[1]-24)<=3&&Math.abs(px[2]-27)<=3, px.join(','));
  // 세로 사진
  const fileIn=await p.$('#pc-file'); await fileIn.uploadFile(FIX+'testphoto_portrait.jpg'); await sleep(1500);
  await p.evaluate(()=>{const c=document.querySelector('#pc-cap'); c.value='감사합니다'; c.dispatchEvent(new Event('input',{bubbles:true}))}); await sleep(300);
  await p.screenshot({path:DIR+'pc2-black-portrait.png'});
  // 사진 영역이 가득 차는지 (네 모서리 근처 픽셀이 틀 색이 아님)
  const edges=await p.evaluate(()=>{const g=document.querySelector('#pc-canvas').getContext('2d'); const pts=[[62,62],[1017,62],[62,1017],[1017,1017]]; return pts.map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data).slice(0,3).join(','))});
  ok('portrait photo covers the whole photo area', edges.every(e=>e!=='23,24,27'), edges.join(' | '));
  // 글씨체 바꿔 보기 (고딕)
  await p.evaluate(()=>{document.querySelector('.pc-seg[data-k="font"] button[data-v="nanumG"]').click()}); await sleep(900);
  ok('font face loaded for canvas', await p.evaluate(()=>document.fonts.check('40px "KF Nanum Gothic"')));
  await p.screenshot({path:DIR+'pc2-gothic.png'});
  // 설정 유지: 새로 고침 후
  const prefs=await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.pc')));
  ok('style prefs saved (frame black, font nanumG, no verse/photo)', prefs.frame==='black' && prefs.font==='nanumG' && !('verse' in prefs) && !('photo' in prefs), JSON.stringify(prefs));
  // 배경(사진 없이) 모래 + 진한 글자
  await p.click('#pc-nophoto'); await sleep(200);
  await p.evaluate(()=>{document.querySelector('.pc-sw button[data-i="6"]').click(); document.querySelector('.pc-seg[data-k="frame"] button[data-v="cream"]').click()}); await sleep(400);
  const pr=await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.pc')));
  ok('light preset → dark ink, no dim', pr.ink==='dark' && pr.dim===0, JSON.stringify(pr));
  await p.screenshot({path:DIR+'pc2-sand-cream.png'});
  ok('duo: no errors', errs.length===0, JSON.stringify(errs));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
