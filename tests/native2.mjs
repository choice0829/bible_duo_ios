import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8913); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1}));}}, arg:null};
const DEVS=[
  ['Duo 펼침 앱(오른쪽 열)',951,669,{top:0,right:84,bottom:0,left:0}, {pill:true}],
  ['Duo 펼침 앱(왼쪽 열)',951,669,{top:0,right:0,bottom:0,left:84}, {sideSafe:84}],
  ['Duo 펼침 앱(좌우 열 없음)',951,669,{top:0,right:0,bottom:0,left:0}, {}],
  ['iPhone16Pro 가로 앱',874,402,{top:0,right:62,bottom:21,left:62}, {sideSafe:62}],
  ['iPhone SE 가로 앱',667,375,{top:0,right:0,bottom:0,left:0}, {}],
  ['Duo 접힘 앱',466,678,{top:0,right:0,bottom:0,left:0}, {fold:true}],
];
for (const [name,w,h,si,o] of DEVS) {
  const {p,errs}=await openDevice(b,[name,w,h,si],{seed,port:8913,query:'?native=1'}); await sleep(500);
  const st=await p.evaluate(()=>{ const R=(e)=>e&&e.getBoundingClientRect().toJSON(); const q=(s)=>document.querySelector(s);
    return {W:innerWidth,H:innerHeight,stage:R(q('#stage')),book:R(q('#book')),spread:document.body.classList.contains('is-spread'),
      rad:getComputedStyle(q('#stage')).borderBottomLeftRadius, radT:getComputedStyle(q('#stage')).borderTopLeftRadius,
      txt:[...document.querySelectorAll('.page .typo, .page')].slice(0,0)}; });
  console.log(name, JSON.stringify({W:st.W,H:st.H,spread:st.spread,stage:[st.stage.left,st.stage.top,st.stage.right,st.stage.bottom].map(Math.round),rad:st.rad}));
  if (o.fold) { ok(name+' fold unchanged (not spread)', !st.spread); }
  else {
    const tx=await p.evaluate(()=>{const pad=(e)=>{const c=getComputedStyle(e); return [parseFloat(c.paddingLeft),parseFloat(c.paddingRight)]}; const tl=document.querySelector('#stage .page.pl .txt'), tr=document.querySelector('#stage .page.pr .txt'); const rl=tl.getBoundingClientRect(), rr=tr.getBoundingClientRect(); const pl=pad(tl), pr=pad(tr); return {l:rl.left+pl[0], r:rr.right-pr[1], wl:rl.width-pl[0]-pl[1], wr:rr.width-pr[0]-pr[1], full:document.documentElement.classList.contains('full')};});
    console.log('  text', JSON.stringify(tx));
    ok(name+' spread + full', st.spread && tx.full);
    ok(name+' stage spans width', st.stage.left<=1.5 && st.W-st.stage.right<=1.5, st.stage.left+' / '+(st.W-st.stage.right));
    // v89: 책(무대)은 화면 아래 읽기 진도 약자 줄 위에서 끝난다(약자 줄 영역 --rd-area 만큼 위)
    { const rdArea=await p.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rd-area'))||0);
      ok(name+' stage ends at the reading strip top (v89)', rdArea>=30 && Math.abs(st.H-rdArea-st.stage.bottom)<=0.6, 'H-stage.bottom='+String(st.H-st.stage.bottom)+' rdArea='+rdArea); }
    ok(name+' text margins equal', Math.abs(tx.l-(st.W-tx.r))<=1.5 && tx.l>=8, tx.l+' / '+(st.W-tx.r));
    ok(name+' text widths equal', Math.abs(tx.wl-tx.wr)<=1 && tx.wl>150, tx.wl+' / '+tx.wr);
    const sd=o.sideSafe||0; ok(name+' text inside safe area', tx.l>=sd && st.W-tx.r>=sd, 'safe '+sd);
    if (o.pill) ok(name+' clears pill', st.stage.top>=114, String(st.stage.top));
  }
  ok(name+' no page errors', errs.length===0, JSON.stringify(errs));
  await p.screenshot({path:'native2-'+name.replace(/[^\w가-힣]/g,'_')+'.png'}); await p.close();
}
console.log(fails? 'FAILS '+fails : 'ALL PASS'); await b.close(); process.exit(0);
