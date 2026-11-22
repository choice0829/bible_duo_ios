import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8911); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1}));}}, arg:null};
const DUO_APP=['Duo 펼침 앱(전체폭)',951,669,{top:0,right:84,bottom:0,left:0}];
const {p,errs}=await openDevice(b,DUO_APP,{seed,port:8911,query:'?native=1'}); await sleep(600);
const st=await p.evaluate(async()=>{
  const q=(s)=>document.querySelector(s); const R=(e)=>e&&e.getBoundingClientRect();
  const regs = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : -1;
  return {native:document.documentElement.classList.contains('native'), edgeDisp:getComputedStyle(q('#desk-edge-r')).display, hintHidden:q('#hint').hidden, regs,
    msgs:window.__msgs, W:innerWidth, stage:R(q('#stage')).toJSON(), menuR:R(q('.head-row .mini-btn:last-child'))?.right, title:R(q('#btn-pick'))?.left,
    info: document.body.className};
});
const ex=await p.evaluate(()=>{const q=(s)=>document.querySelector(s); const pad=(e)=>{const c=getComputedStyle(e); return [parseFloat(c.paddingLeft),parseFloat(c.paddingRight)]}; const tl=q('#stage .page.pl .txt'), tr=q('#stage .page.pr .txt'); const rl=tl.getBoundingClientRect(), rr=tr.getBoundingClientRect(); const pl=pad(tl), pr=pad(tr); const t=q('#btn-pick')||q('.head-row'); const hr=q('.head-row'); const cs=getComputedStyle(q('#stage')); return {full:document.documentElement.classList.contains('full'), txtL:rl.left+pl[0], txtR:rr.right-pr[1], txtWl:rl.width-pl[0]-pl[1], txtWr:rr.width-pr[0]-pr[1], bgHtml:getComputedStyle(document.documentElement).backgroundColor, bgPage:getComputedStyle(q('#stage .page')).backgroundColor, bgImg:getComputedStyle(document.documentElement).backgroundImage, clip:getComputedStyle(q('#stage')).overflow,cp:getComputedStyle(q('#stage')).clipPath, shadow:cs.boxShadow, titleBottom:q('#btn-pick').getBoundingClientRect().bottom, rowBottom:hr.getBoundingClientRect().bottom, titleTop:q('#btn-pick').getBoundingClientRect().top, btnTop:q('.head-row .mini-btn:last-child').getBoundingClientRect().top, btnBottom:q('.head-row .mini-btn:last-child').getBoundingClientRect().bottom}});
console.log(JSON.stringify(ex));
console.log(JSON.stringify(st));
ok('html.native set', st.native);
ok('edge strips hidden in app', st.edgeDisp==='none', st.edgeDisp);
ok('install hint not shown', st.hintHidden===true);
ok('no service worker registered', st.regs<=0, String(st.regs));
ok('theme posted to native', st.msgs.length>=1 && st.msgs.every(m=>typeof m.theme==='string'), JSON.stringify(st.msgs.slice(0,3)));
const H=669, L=st.stage.left, Rm=st.W-st.stage.right;
ok('v41 html.full set', ex.full);
ok('stage spans full width (no side margins)', L<=1 && Rm<=1.5, L+' / '+Rm);
ok('stage reaches screen bottom', Math.abs(H-st.stage.bottom)<=0.5, String(H-st.stage.bottom));
ok('text left edge 24 (v64: 30 -> 24)', Math.abs(ex.txtL-24)<=1.5, String(ex.txtL));
ok('text right edge W-24', Math.abs((st.W-ex.txtR)-24)<=1.5, String(st.W-ex.txtR));
ok('text width 429 both pages', Math.abs(ex.txtWl-429)<=1 && Math.abs(ex.txtWr-429)<=1, ex.txtWl+' / '+ex.txtWr);
ok('background is paper colour = page colour, no texture', ex.bgHtml===ex.bgPage && ex.bgImg==='none', ex.bgHtml+' vs '+ex.bgPage+' img='+ex.bgImg);
// v56: 책을 자르는 창이 overflow:clip 에서 clip-path(위쪽으로만 15px 넓힘)로 바뀌었다 — 어느 쪽이든 '자른다'(왼쪽·오른쪽·아래는 책 가장자리 그대로)
ok('stage clips (overflow clip, or clip-path inset widened only upward)', ex.clip==='clip' || ex.clip==='hidden' || (/^inset\(/.test(ex.cp) && /^inset\(-?\d+(\.\d+)?px 0px 0px\)$/.test(ex.cp)), ex.clip+' / '+ex.cp);
ok('stage/text top clears the status pill (>=114)', st.stage.top>=114, String(st.stage.top));
ok('no shadow, no outline on the stage', ex.shadow==='none', ex.shadow);
ok('header row sits >=14px above card (v40: raised)', st.stage.top-ex.rowBottom>=14, String(st.stage.top-ex.rowBottom));
ok('menu buttons left of pill (pill x>=877)', st.menuR<=877-6, String(st.menuR));
ok('menu buttons stay left of the status rail (84)', st.menuR<=st.W-84, st.menuR+' <= '+(st.W-84));
await p.screenshot({path:'native-duo.png'});
// 테마를 바꾸면 앱으로 알린다
await p.evaluate(()=>document.querySelector('#btn-settings, #btn-set, [aria-label="설정"]').click()); await sleep(400);
await p.evaluate(()=>[...document.querySelectorAll('#sheet-body button[data-k="theme"]')].find(b=>b.dataset.v==='night').click()); await sleep(900);
const m2=await p.evaluate(()=>window.__msgs);
ok('night theme posted', m2.some(m=>m.theme==='night'), JSON.stringify(m2.slice(-2)));
// 일반(PWA) 열기에서는 그대로
const {p:p2,errs:e2}=await openDevice(b,DUO_APP,{seed,port:8911}); await sleep(400);
const st2=await p2.evaluate(()=>({native:document.documentElement.classList.contains('native'), edge:getComputedStyle(document.querySelector('#desk-edge-r')).display, msgs:window.__msgs.length}));
ok('PWA mode unchanged (strips on, no native msgs)', !st2.native && st2.edge==='block' && st2.msgs===0, JSON.stringify(st2));
ok('no page errors', errs.length===0 && e2.length===0, JSON.stringify([...errs,...e2]));
console.log(fails? 'FAILS '+fails : 'ALL PASS'); await b.close(); process.exit(0);
