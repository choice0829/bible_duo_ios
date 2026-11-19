import {serve,launch,sleep} from './devlib.mjs';
serve(8966); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const seed={fn:(cfg)=>{
  window.__msgs=[]; window.__loc=(cfg&&cfg.loc)||{lat:37.5301,lng:127.1238,acc:30}; window.__geo={q:[],r:[{name:'',addr:'서울 강동구 강동대로 229'}]};
  if(!(cfg&&cfg.noBridge)) window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m);
    if(m.loc){ setTimeout(()=>window.bfLocation&&window.bfLocation(window.__loc),40); }
    else if(m.geocode!==undefined){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.q}),40); }
    else if(m.rgeo){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.r.map(x=>Object.assign({},x,{lat:m.rgeo.lat,lng:m.rgeo.lng}))}),40); }
  }}}};
  if(!sessionStorage.getItem('s')){ sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); if(cfg&&cfg.places!==undefined) localStorage.setItem('bf.places',typeof cfg.places==='string'?cfg.places:JSON.stringify(cfg.places)); if(cfg&&cfg.theme) localStorage.setItem('bf.settings',JSON.stringify({theme:cfg.theme})); }
}, arg:null};
async function openDev(dev,{query='?native=1',cfg=null,tiles='ok'}={}) {
  const [name,w,h,si]=dev; const p=await b.newPage(); const errs=[]; const tileUrls=[];
  p.on('pageerror',e=>errs.push('pageerror '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text())});
  await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const cdp=await p.createCDPSession(); try{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:si}); }catch(e){}
  await p.setRequestInterception(true);
  const st={tiles};
  p.on('request',r=>{const u=r.url(); if(u.startsWith('https://tile.openstreetmap.org/')||u.startsWith('https://basemaps.cartocdn.com/')){ tileUrls.push(u); if(st.tiles==='ok') r.respond({status:200,contentType:'image/png',body:PNG,headers:{'access-control-allow-origin':'*'}}); else r.abort(); } else if(u.startsWith('http://localhost')||u.startsWith('data:')||u.startsWith('blob:')) r.continue(); else r.abort();});
  await p.evaluateOnNewDocument(seed.fn, cfg);
  await p.goto('http://localhost:8966/index.html'+query); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1500);
  return {p,errs,tileUrls,st};
}
const R=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
const vis=(p,sel)=>p.evaluate((s)=>{const e=document.querySelector(s); if(!e) return false; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.hidden},sel);
const places=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem('bf.places')||'[]'));
const settle=async(p)=>{await sleep(450); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:60000}); await sleep(300);};
const P=(i,name,lat,lng,extra={})=>Object.assign({id:'p'+i,name,lat,lng,addr:'',tel:'',hours:'',cap:0,amen:[],memo:'',ts:i},extra);
const DUO=['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0},299], FOLD=['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0},300], IP=['iPhone15 세로',393,852,{top:59,right:0,bottom:34,left:0},336];


const SHOT=async(p,n)=>{ await p.screenshot({path:n}); };
const place3=[P(1,'강동 모임 카페',37.5301,127.1238,{addr:'서울 강동구 강동대로 229',amen:['out','quiet'],cap:12,memo:'오후 3시 이후 한산'}),P(2,'두번째 카페',37.5351,127.1238,{addr:'서울 강동구 천호대로 1',amen:['wifi']}),P(3,'세번째',37.5251,127.1338)];
const G=async(p)=>p.evaluate(()=>{const R=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left*10)/10,t:Math.round(r.top*10)/10,r:Math.round(r.right*10)/10,b:Math.round(r.bottom*10)/10,w:Math.round(r.width),h:Math.round(r.height)}}; return {W:innerWidth,H:innerHeight,map:R('.mp-mapwrap'),q:R('#mp-q'),add:R('#mp-add'),chips:R('#mp-chips'),loc:R('#mp-loc'),locBtn:R('#mp-loc-btn'),cnt:R('#mp-count'),list:R('#mp-list'),form:R('#mp-form'),ptog:R('#mp-ptog'),close:R('#mp-close'),title:R('.mp-bar strong'),card:R('#mp-card'),me:R('#mp-me'),zoom:R('.leaflet-control-zoom'),foot:R('.mp-foot')}});
for (const [tag,dev,cfg] of [['duoU',DUO,{places:place3}],['duoU-empty',DUO,{places:[]}],['ip15',IP,{places:place3}],['land',['iPhone15 가로',852,393,{top:0,right:59,bottom:21,left:59},336],{places:place3}]]) {
  const {p,errs}=await openDev([dev[0],dev[1],dev[2],dev[3]],{cfg}); await settle(p);
  await p.click('#btn-map'); await sleep(1800);
  console.log('==',tag, JSON.stringify(await G(p)));
  await SHOT(p,'map3-'+tag+'-list.png');
  if(tag==='duoU'||tag==='land'){ await p.click('.mp-it-main'); await sleep(400); await SHOT(p,'map3-'+tag+'-card.png'); console.log('card',JSON.stringify((await G(p)).card));
    await p.click('#mp-ptog').catch(()=>{}); await sleep(300); await SHOT(p,'map3-'+tag+'-off.png');
    await p.click('#mp-ptog').catch(()=>{}); await sleep(200);
    await p.click('#mp-add'); await sleep(400); await SHOT(p,'map3-'+tag+'-form.png'); console.log('form',JSON.stringify((await G(p)).form));
    await p.click('#mp-f-pick'); await sleep(500); await SHOT(p,'map3-'+tag+'-pick.png'); }
  console.log('errs',JSON.stringify(errs));
  await p.close();
}
await b.close(); process.exit(0);
