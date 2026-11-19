import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8914); const b=await launch();
for (const th of ['night','sepia']) {
  const seed={fn:(th)=>{ window.webkit={messageHandlers:{bf:{postMessage:()=>{}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.settings',JSON.stringify({fontSize:18,theme:th,layout:'auto',font:'myeongjo',std:false,desk:'linen',marginRev:19,shiftX:52,bottomSpread:20,topSpread:96}));}}, arg:th};
  const {p,errs}=await openDevice(b,['d',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8914,query:'?native=1'}); await sleep(600);
  const r=await p.evaluate(()=>{const R=document.querySelector('#stage').getBoundingClientRect(); return [R.left,R.top,R.right,R.bottom,innerWidth,JSON.parse(localStorage.getItem('bf.settings'))]});
  console.log(th, JSON.stringify(r), errs.length);
  await p.screenshot({path:'native3-'+th+'.png'}); await p.close();
}
await b.close(); process.exit(0);
