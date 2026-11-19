import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8911); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const seed={fn:()=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:1,chapter:1,verse:7}));}}, arg:null};
for (const [dev,dn] of [[['Duo 펼침',867,669,{top:0,right:0,bottom:34,left:0}],'spread'],[['Duo 접힘',382,678,{top:0,right:0,bottom:34,left:0}],'fold']]) {
  const {p}=await openDevice(b,dev,{seed,port:8911}); await sleep(800);
  const r=await p.evaluate(()=>{
    const W=innerWidth; const er=document.getElementById('desk-edge-r').getBoundingClientRect(), el=document.getElementById('desk-edge-l').getBoundingClientRect();
    // 모든 글자의 가장 오른쪽·왼쪽 끝
    let maxR=0,minL=1e9; const rng=document.createRange();
    for (const t of document.querySelectorAll('.page .txt, .chap')) { const w=document.createTreeWalker(t,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ if(!n.textContent.trim()) continue; rng.selectNodeContents(n); for(const q of rng.getClientRects()){ if(q.width<1||q.height<1) continue; if(q.bottom<0||q.top>innerHeight||q.left<0||q.right>W+0.5) continue; maxR=Math.max(maxR,q.right); minL=Math.min(minL,q.left);} } }
    return {W,stripL:er.left,stripW:er.width,leftW:el.width,maxR:Math.round(maxR*10)/10,minL:Math.round(minL*10)/10};});
  console.log(dn,JSON.stringify(r));
  ok(dn+' text ends before right strip', r.maxR<=r.stripL+0.01, r.maxR+' vs '+r.stripL);
  ok(dn+' text starts after left strip', r.minL>=r.leftW-0.01, r.minL+' vs '+r.leftW);
  await p.screenshot({path:`desk/edge7-${dn}.png`}); await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
