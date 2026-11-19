import {serve,launch,sleep,DEVICES,openDevice} from './devlib.mjs';
serve(8874); const b=await launch(); let fails=0;
const ok=(n,c,x='')=>{ if(!c) fails++; if(!c) console.log('FAIL '+n+(x?' — '+x:'')); };
const EXTRA=[['Duo 세로 top84',587,867,{top:84,right:0,bottom:0,left:0}],['Duo 세로 top0',587,867,{top:0,right:0,bottom:0,left:0}],['큰상단 100',390,844,{top:100,right:0,bottom:34,left:0}]];
let n=0;
for (const dev of [...DEVICES,...EXTRA]) {
  for (const variant of [{}, {topSingle:96}, {topSingle:280}, {topSpread:48}]) {
    for (const layout of ['auto','single']) {
      const settings=Object.assign({layout},variant);
      const seed={fn:(a)=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:25,chapter:0,verse:12})); localStorage.setItem('bf.settings',JSON.stringify(Object.assign({fontSize:18,theme:'paper',font:'myeongjo',marginRev:19},a)));}}, arg:settings};
      const {p,errs}=await openDevice(b,dev,{seed,port:8874}); n++;
      const m=await p.evaluate(()=>{ const R=(e)=>e.getBoundingClientRect(); const hr=R(document.querySelector('.head-row')); const sc=document.querySelector('#book.scroll'); const pg=[...document.querySelectorAll('#stage .page .txt')].filter(t=>R(t).width>0&&R(t).left<innerWidth); const top=sc?R(sc).top:(pg.length?Math.min(...pg.map(t=>R(t).top)):null); const title=document.querySelector('#loc-book'); return {headB:hr.bottom,headR:hr.right,top,single:!!sc,clip:title.scrollWidth>title.clientWidth+1,over:[...document.querySelectorAll('#stage .txt')].filter(t=>t.scrollHeight>t.clientHeight+1).length}; });
      const tag=dev[0]+' '+JSON.stringify(settings);
      ok(tag+' head above body', m.headB<=m.top+0.5, 'head '+Math.round(m.headB)+' body '+Math.round(m.top)+(m.single?' (single)':' (spread)'));
      ok(tag+' no errors', errs.length===0, errs[0]); ok(tag+' no overflow', m.over===0);
      await p.close();
    }
  }
}
console.log('cases',n,fails?('FAILS '+fails):'ALL PASS'); process.exit(0);
