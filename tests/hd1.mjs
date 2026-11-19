import {serve,launch,sleep,openDevice,DEVICES} from './devlib.mjs';
serve(8901); const b=await launch(); let fails=0;
const ok=(n,c,x='')=>{ if(!c) fails++; console.log((c?'ok   ':'FAIL ')+n+(x?' — '+x:'')); };
const seedFor=(o)=>({fn:(a)=>{ if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify(a)); }}, arg:o});
const DEV=[...DEVICES.filter(d=>['Duo 펼침','Duo 접힘','SE3 세로','15 가로','16Pro 가로','iPad mini 가로','14 세로'].includes(d[0])), ['Duo 가로(큰)',867,669,{top:0,right:0,bottom:34,left:0}]];
for (const dev of DEV) {
  const {p,errs}=await openDevice(b,dev,{seed:seedFor({book:1,chapter:1,verse:7}),port:8901});
  await sleep(500);
  const m=await p.evaluate(()=>{ const R=(e)=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};
    const st=R(document.querySelector('#stage')), hr=R(document.querySelector('.head-row')), mr=R(document.querySelector('.menu-row')), tt=R(document.querySelector('.title-btn'));
    const txt=[...document.querySelectorAll('#stage .page .txt')].filter(e=>e.getBoundingClientRect().width>0).map(R);
    const sc=document.querySelector('#book.scroll'); const cs=getComputedStyle(document.documentElement);
    return {W:innerWidth,H:innerHeight,st,hr,mr,tt,txtTop:txt[0]?txt[0].t:null,scTop:sc?R(sc).t:null,padtop:parseFloat(cs.getPropertyValue('--padtop')),headh:cs.getPropertyValue('--headh'),headr:cs.getPropertyValue('--headr'),spread:document.body.classList.contains('is-spread'),title:document.querySelector('#loc-book').textContent, fs:cs.getPropertyValue('--title-fs')};});
  const [name,w,h,si]=dev;
  ok(`${name}: header above book/body`, m.spread ? (m.hr.b<=m.st.t+0.5) : (m.hr.b<=m.padtop+0.5), `headBottom ${Math.round(m.hr.b)} stageTop ${Math.round(m.st.t)} padtop ${m.padtop}`);
  ok(`${name}: body text starts at padtop (unchanged)`, Math.abs((m.spread?m.txtTop:m.scTop)-m.padtop)<=1.5, `${m.spread?m.txtTop:m.scTop} vs ${m.padtop}`);
  ok(`${name}: menus at right end`, Math.abs(m.mr.r-(m.W-parseFloat(m.headr)))<=1.5 && (!m.spread || m.mr.l>m.tt.r), `menu ${Math.round(m.mr.l)}–${Math.round(m.mr.r)} title→${Math.round(m.tt.r)} headr ${m.headr}`);
  ok(`${name}: menus clear of status-icon safe area`, m.mr.r<=m.W-si.right+0.5, `menuRight ${Math.round(m.mr.r)} W-si.right ${m.W-si.right}`);
  ok(`${name}: title not clipped`, await p.evaluate(()=>{const b=document.querySelector('#loc-book');return b.scrollWidth<=b.clientWidth+1}), `fs ${m.fs} title ${m.title}`);
  ok(`${name}: no errors`, errs.length===0, errs.join(';'));
  await p.screenshot({path:`hd1-${name.replace(/\s/g,'_')}.png`});
  await p.close();
}
console.log(fails?`FAILS ${fails}`:'ALL PASS'); await b.close(); process.exit(0);
