// v50 — 모임 장소 지도 그림을 앱 테마에 맞추기: 바탕 주소(열쇠 유무·테마별), 색조 필터, 단추·출처·핀 색, 확대 한계, 테마 전환, 열쇠 입력 화면(백업 제외), 오류 안내문
// 사용: node map4.mjs   (스크린샷은 /tmp/map4shots/ 에 저장. 타일은 가로채서 단색+선 그림으로 대신하므로 실제 지도 모습은 실기기에서 확인한다)
import zlib from 'node:zlib'; import fs from 'node:fs';
import {serve,launch,sleep} from './devlib.mjs';
serve(8967); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
fs.mkdirSync('/tmp/map4shots',{recursive:true});

// ---- 가짜 타일: 땅 + 길(가로·세로 띠) + 물. 색은 Positron·Dark Matter·OSM의 근사값(필터 계산에 쓴 값과 같다) ----
function png(w,h,pix){
  const raw=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const c=pix(x,y), o=y*(w*3+1)+1+x*3; raw[o]=c[0]; raw[o+1]=c[1]; raw[o+2]=c[2]; } }
  const chunk=(t,d)=>{ const bf=Buffer.alloc(12+d.length); bf.writeUInt32BE(d.length,0); bf.write(t,4,'ascii'); d.copy(bf,8); bf.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t,'ascii'),d]))>>>0,8+d.length); return bf; };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const mk=(land,road,water)=>png(256,256,(x,y)=>((y>=118&&y<126)||(x>=118&&x<126))?road:(x>150&&y>150)?water:land);
const T={light:mk([245,245,243],[255,255,255],[212,218,220]), dark:mk([18,18,18],[44,44,44],[9,9,9]), osm:mk([242,239,233],[255,255,255],[170,211,223])};

const seed={fn:(cfg)=>{
  window.__msgs=[]; window.__loc={lat:37.5301,lng:127.1238,acc:30};
  window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m); if(m.loc){ setTimeout(()=>window.bfLocation&&window.bfLocation(window.__loc),40); } }}}};
  if(!sessionStorage.getItem('s')){ sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.mapeng','raster'); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1}));
    if(cfg&&cfg.places) localStorage.setItem('bf.places',JSON.stringify(cfg.places));
    if(cfg&&cfg.theme) localStorage.setItem('bf.settings',JSON.stringify({theme:cfg.theme}));
    if(cfg&&cfg.key) localStorage.setItem('bf.mapkey',cfg.key); }
}};
const PLACE={id:'p1',name:'가나 카페',lat:37.5301,lng:127.1238,addr:'',tel:'',hours:'',cap:0,amen:[],memo:'',ts:1};
async function openDev(dev,{cfg=null,tiles='ok'}={}) {
  const [name,w,h,si]=dev; const p=await b.newPage(); const errs=[]; const tileUrls=[];
  p.on('pageerror',e=>errs.push('pageerror '+e.message)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))errs.push(m.text())});
  await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const cdp=await p.createCDPSession(); try{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:si}); }catch(e){}
  await p.setRequestInterception(true);
  const st={tiles};
  p.on('request',r=>{const u=r.url(); const osm=u.startsWith('https://tile.openstreetmap.org/'), car=u.startsWith('https://basemaps.cartocdn.com/');
    if(osm||car){ tileUrls.push(u); if(st.tiles==='ok') r.respond({status:200,contentType:'image/png',body:osm?T.osm:(u.includes('/dark_all/')?T.dark:T.light),headers:{'access-control-allow-origin':'*'}}); else r.abort(); }
    else if(u.startsWith('http://localhost')||u.startsWith('data:')||u.startsWith('blob:')) r.continue(); else r.abort();});
  await p.evaluateOnNewDocument(seed.fn, cfg);
  await p.goto('http://localhost:8967/index.html?native=1'); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1500);
  return {p,errs,tileUrls,st};
}
const DUO=['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0}], PH=['iPhone15 세로',393,852,{top:59,right:0,bottom:34,left:0}];
const openMap=async(p,narrowTab)=>{ await p.click('#btn-map'); await sleep(1600); if(narrowTab){ await p.click('.mp-tabs button[data-t="r"]'); await sleep(1200); } };
const closeMap=async(p)=>{ await p.click('#mp-close'); await sleep(400); };
// CSS 변수를 실제 색(rgb)으로 읽는다: #mp 안에 임시 요소를 만들어 그 요소의 계산된 값을 돌려 준다
const cssColor=(p,expr,prop='color')=>p.evaluate((e,pr)=>{const el=document.createElement('i'); el.style[pr]=e; document.querySelector('#mp').appendChild(el); const v=getComputedStyle(el)[pr]; el.remove(); return v;},expr,prop);
const cs=(p,sel,prop)=>p.evaluate((s,pr)=>{const e=document.querySelector(s); return e?getComputedStyle(e)[pr]:null;},sel,prop);
const lsKey=(p)=>p.evaluate(()=>localStorage.getItem('bf.mapkey'));
const maxZ=(urls)=>Math.max(...urls.map(u=>+(u.match(/\/(\d+)\/\d+\/\d+\.png/)||[0,-1])[1]));
const KEY='TESTKEY1234';
const STYLE={paper:'light_all',sepia:'light_all',night:'dark_all'};
const FILTER={ // [열쇠 없음(OSM), 열쇠 있음(CARTO)] 계산된 filter 문자열에 반드시 들어 있어야 하는 조각
  paper:[/sepia\(0\.2\)/,/sepia\(0\.15\)/], sepia:[/sepia\(0\.7\)/,/sepia\(0\.5\)/], night:[/invert\(1\)/,/hue-rotate\(185deg\)/]};

// ===== 1. 테마 3종 × 열쇠 없음/있음 (듀오 펼침) =====
for (const theme of ['paper','sepia','night']) for (const withKey of [false,true]) {
  const tag=`${theme}/${withKey?'열쇠 있음':'열쇠 없음'}`; console.log('===== '+tag);
  const {p,errs,tileUrls}=await openDev(DUO,{cfg:{theme,places:[PLACE],key:withKey?KEY:null}});
  await openMap(p);
  const cls=await p.evaluate(()=>[...document.querySelector('#mp').classList].filter(c=>c.startsWith('mp-src-')));
  ok(tag+': #mp 바탕 종류 클래스', JSON.stringify(cls)===JSON.stringify([withKey?'mp-src-carto':'mp-src-osm']), JSON.stringify(cls));
  ok(tag+': 타일을 받았다', tileUrls.length>0, tileUrls.length+'개 '+tileUrls[0]);
  if(withKey){
    const re=new RegExp('^https://basemaps\\.cartocdn\\.com/rastertiles/'+STYLE[theme]+'/\\d+/\\d+/\\d+\\.png\\?key='+KEY+'$');
    ok(tag+': 타일 주소 = CARTO '+STYLE[theme]+' + 열쇠', tileUrls.every(u=>re.test(u)), tileUrls[0]);
  } else ok(tag+': 타일 주소 = OpenStreetMap', tileUrls.every(u=>/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)), tileUrls[0]);
  const attr=await p.evaluate(()=>{const a=document.querySelector('.leaflet-control-attribution'); return {t:a?a.textContent:'',h:a?[...a.querySelectorAll('a')].map(x=>x.href):[]};});
  ok(tag+': 출처 표기 OpenStreetMap'+(withKey?'·CARTO':''), /OpenStreetMap/.test(attr.t) && (withKey?/CARTO/.test(attr.t)&&attr.h.includes('https://carto.com/attribution/'):!/CARTO/.test(attr.t)), attr.t);
  const flt=await cs(p,'.leaflet-tile-pane','filter');
  ok(tag+': 지도 그림에 테마 색조 필터', FILTER[theme][withKey?1:0].test(flt), flt);
  // 지도 위 단추·출처·핀이 앱 색인지
  const bg=await cs(p,'#mp','backgroundColor'), fg=await cs(p,'#mp','color');
  const zb=await cs(p,'.leaflet-control-zoom-in','backgroundColor'), zf=await cs(p,'.leaflet-control-zoom-in','color');
  ok(tag+': 확대·축소 단추 = 앱 바탕·글자색', zb===bg && zf===fg, `단추 ${zb}/${zf} · 앱 ${bg}/${fg}`);
  const meB=await cs(p,'#mp-me','backgroundColor'), meC=await cs(p,'#mp-me','color'), meV=await cssColor(p,'var(--mp-me)');
  ok(tag+': 내 위치 단추 = 앱 바탕 + 테마 파랑', meB===bg && meC===meV, `${meB}/${meC} · --mp-me ${meV}`);
  const lk=await cs(p,'.leaflet-control-attribution a','color'), acc=await cssColor(p,'var(--accent)');
  ok(tag+': 출처 링크 = 강조색(파란 고정색 아님)', lk===acc, `${lk} vs ${acc}`);
  const land=await cssColor(p,'var(--mp-land)','backgroundColor'), mb=await cs(p,'.mp-mapwrap','backgroundColor'), mm=await cs(p,'#mp-map','backgroundColor');
  ok(tag+': 지도 바탕(그림 뜨기 전) = 테마 땅색', mb===land && mm===land, `${mb} / ${mm} · ${land}`);
  const pin=await p.evaluate(()=>{const n=document.querySelector('.mp-pin .pn'); if(!n) return null; const c=getComputedStyle(n); return {fill:c.fill,stroke:c.stroke};});
  ok(tag+': 핀 채움 = 강조색, 테두리 = 앱 바탕색', !!pin && pin.fill===acc && pin.stroke===bg, JSON.stringify(pin));
  const dot=await p.evaluate(()=>[...document.querySelectorAll('.leaflet-overlay-pane path')].map(x=>(x.getAttribute('fill')||'').toLowerCase()).filter(f=>f&&f!=='none'));
  const meRaw=(await p.evaluate(()=>getComputedStyle(document.querySelector('#mp')).getPropertyValue('--mp-me').trim())).toLowerCase();
  ok(tag+': 내 위치 점 색 = --mp-me('+meRaw+')', dot.length>0 && meRaw!=='' && dot.every(f=>f===meRaw), JSON.stringify(dot));
  await p.screenshot({path:`/tmp/map4shots/${theme}-${withKey?'carto':'osm'}.png`});   // 확대 전(핀·내 위치 점이 보이는 상태)
  // 확대 한계: 열쇠 있음(CARTO)은 18단계까지만 받고, 없음(OSM)은 19단계까지 받는다 (확대 단추가 비활성이 될 때까지 = 최대 확대)
  const n0=tileUrls.length;
  for(let i=0;i<12;i++){ const dis=await p.evaluate(()=>{const a=document.querySelector('.leaflet-control-zoom-in'); if(a.classList.contains('leaflet-disabled')) return true; a.click(); return false;}); if(dis) break; await sleep(250); }
  await sleep(1500);
  const z=maxZ(tileUrls.slice(n0));
  ok(tag+': 가장 크게 확대했을 때 받는 타일 단계 = '+(withKey?18:19), z===(withKey?18:19), 'max z='+z);
  ok(tag+': 오류 없음', errs.length===0, JSON.stringify(errs));
  await p.close();
}

// ===== 2. 좁은 화면(아이폰 세로): 지도 탭에서도 같은 바탕·색 =====
console.log('===== 아이폰 세로 · 야간 · 열쇠 있음');
{
  const {p,errs,tileUrls}=await openDev(PH,{cfg:{theme:'night',places:[PLACE],key:KEY}});
  await openMap(p,true);
  ok('아이폰 세로: CARTO dark_all 타일', tileUrls.length>0 && tileUrls.every(u=>/\/rastertiles\/dark_all\/\d+\/\d+\/\d+\.png\?key=TESTKEY1234$/.test(u)), tileUrls[0]);
  const bg=await cs(p,'#mp','backgroundColor'); const zb=await cs(p,'.leaflet-control-zoom-in','backgroundColor');
  ok('아이폰 세로: 확대 단추 = 앱 바탕색(야간)', zb===bg, `${zb} vs ${bg}`);
  await p.screenshot({path:'/tmp/map4shots/phone-night-carto.png'});
  ok('아이폰 세로: 오류 없음', errs.length===0, JSON.stringify(errs));
  await p.close();
}

// ===== 3. 테마를 바꾸고 지도를 다시 열면 바탕이 따라 바뀐다 =====
console.log('===== 테마 전환(종이 → 야간 → 세피아)');
{
  const {p,errs,tileUrls}=await openDev(DUO,{cfg:{theme:'paper',places:[PLACE],key:KEY}});
  await openMap(p); ok('전환: 처음(종이) light_all', /\/light_all\//.test(tileUrls[tileUrls.length-1]), tileUrls[tileUrls.length-1]);
  await closeMap(p);
  const setTheme=async(t)=>{ await p.click('#btn-settings'); await sleep(500); await p.click(`button[data-k="theme"][data-v="${t}"]`); await sleep(450);
    await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:60000}); await sleep(300); await p.click('#sheet-close'); await sleep(500); };
  await setTheme('night'); const n1=tileUrls.length;
  await openMap(p); await sleep(800);
  ok('전환: 야간으로 바꾼 뒤 dark_all을 받는다', tileUrls.slice(n1-1).some(u=>/\/dark_all\//.test(u)), tileUrls[tileUrls.length-1]);
  ok('전환: 야간 필터', /hue-rotate\(185deg\)/.test(await cs(p,'.leaflet-tile-pane','filter')), await cs(p,'.leaflet-tile-pane','filter'));
  const layers=await p.evaluate(()=>document.querySelectorAll('.leaflet-tile-pane .leaflet-layer').length);
  ok('전환: 바탕 층이 하나만 남는다(겹쳐 쌓이지 않음)', layers===1, 'layers='+layers);
  await closeMap(p); await setTheme('sepia'); const n2=tileUrls.length;
  await openMap(p); await sleep(800);
  ok('전환: 세피아로 바꾸면 light_all로 돌아온다', tileUrls.slice(n2-1).some(u=>/\/light_all\//.test(u)), tileUrls[tileUrls.length-1]);
  ok('전환: 세피아 필터', /sepia\(0\.5\)/.test(await cs(p,'.leaflet-tile-pane','filter')), await cs(p,'.leaflet-tile-pane','filter'));
  ok('전환: 오류 없음', errs.length===0, JSON.stringify(errs));
  await p.close();
}

// ===== 4. 고급설정의 지도 열쇠 입력: 저장·지우기·백업 제외·받는 곳 열기 =====
console.log('===== 고급설정 · 지도 열쇠');
{
  const {p,errs,tileUrls}=await openDev(DUO,{cfg:{theme:'paper',places:[PLACE]}});
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  const vis=async(s)=>p.evaluate((q)=>{const e=document.querySelector(q); if(!e) return false; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;},s);
  ok('열쇠: 입력 칸·단추 4개가 있다', await vis('#mk-in') && await vis('#mk-open') && await vis('#mk-save') && await vis('#mk-clear'));
  const st=()=>p.evaluate(()=>document.querySelector('#mk-state').textContent);
  ok('열쇠: 처음에는 "열쇠 없음", 지우기 단추 비활성', (await st()).includes('열쇠 없음') && await p.evaluate(()=>document.querySelector('#mk-clear').disabled));
  await p.click('#mk-in'); await p.type('#mk-in','abc'); await p.click('#mk-save'); await sleep(200);
  ok('열쇠: 너무 짧으면 저장하지 않고 안내', (await lsKey(p))===null && (await p.evaluate(()=>document.querySelector('#mk-msg').textContent)).includes('붙여 넣어'), await p.evaluate(()=>document.querySelector('#mk-msg').textContent));
  await p.evaluate(()=>{document.querySelector('#mk-in').value='';});
  await p.click('#mk-in'); await p.type('#mk-in','  ABCDEF123456  '); await p.click('#mk-save'); await sleep(300);
  ok('열쇠: 저장(앞뒤 공백 제거)', (await lsKey(p))==='ABCDEF123456', String(await lsKey(p)));
  ok('열쇠: 저장 뒤 입력 칸이 비워지고 "열쇠 입력됨"', (await p.evaluate(()=>document.querySelector('#mk-in').value))==='' && (await st()).includes('열쇠 입력됨') && !(await p.evaluate(()=>document.querySelector('#mk-clear').disabled)), await st());
  ok('열쇠: 화면 어디에도 열쇠 글자가 다시 보이지 않는다', !(await p.evaluate(()=>document.body.innerText)).includes('ABCDEF123456'));
  await p.click('#mk-open'); await sleep(200);
  const m=await p.evaluate(()=>window.__msgs.slice());
  ok('열쇠: 받는 곳 열기 → 앱에 https 주소 전달', m.some(x=>x.open==='https://carto.com/basemaps/apikey/'), JSON.stringify(m.filter(x=>x.open)));
  // 백업에는 열쇠가 들어가지 않는다
  await p.click('#go-bk'); await sleep(400);
  const bk=await p.evaluate(()=>document.querySelector('#bk-out').value);
  ok('열쇠: 데이터 백업 내용에 열쇠가 없다', !bk.includes('ABCDEF123456') && !/mapkey/i.test(bk), bk.length+'자');
  await p.click('#sheet-back'); await sleep(300);
  await p.click('#mk-clear'); await sleep(300);
  ok('열쇠: 지우기 → 저장값 삭제, "열쇠 없음"', (await lsKey(p))===null && (await st()).includes('열쇠 없음'));
  // 저장 → 지도 열기: 저장한 열쇠가 바로 지도 바탕에 쓰인다 (지도를 이미 한 번 열어 둔 뒤에도)
  await p.click('#sheet-close'); await sleep(400); await openMap(p);
  ok('열쇠: 열쇠 없이 연 지도는 OSM', tileUrls.length>0 && tileUrls.every(u=>u.startsWith('https://tile.openstreetmap.org/')), tileUrls[0]);
  await closeMap(p);
  await p.click('#btn-settings'); await sleep(500); await p.click('#go-adv'); await sleep(500);
  await p.click('#mk-in'); await p.type('#mk-in',KEY); await p.click('#mk-save'); await sleep(300); await p.click('#sheet-close'); await sleep(400);
  const n=tileUrls.length; await openMap(p); await sleep(800);
  ok('열쇠: 지도를 연 뒤에 열쇠를 넣어도, 다시 열면 CARTO 바탕', tileUrls.slice(n-1).some(u=>/basemaps\.cartocdn\.com\/rastertiles\/light_all\/.*key=TESTKEY1234$/.test(u)), tileUrls[tileUrls.length-1]);
  ok('열쇠: 오류 없음', errs.length===0, JSON.stringify(errs));
  await p.close();
}

// ===== 5. 타일을 못 받을 때의 안내문 (열쇠 유무에 따라 다름) =====
console.log('===== 타일 오류 안내문');
for (const withKey of [false,true]) {
  const {p,errs}=await openDev(DUO,{cfg:{theme:'paper',places:[PLACE],key:withKey?KEY:null},tiles:'fail'});
  await openMap(p); await sleep(1200);
  const note=await p.evaluate(()=>{const n=document.querySelector('#mp-note'); return {hidden:n.hidden,t:n.textContent};});
  ok(`안내문(${withKey?'열쇠 있음':'열쇠 없음'}): 타일이 연속 실패하면 뜬다`, note.hidden===false, note.t);
  ok(`안내문(${withKey?'열쇠 있음':'열쇠 없음'}): ${withKey?'열쇠 확인을 안내':'인터넷 연결 안내(열쇠 언급 없음)'}`, withKey?note.t.includes('열쇠'):(note.t.includes('인터넷 연결')&&!note.t.includes('열쇠')), note.t);
  ok(`안내문(${withKey?'열쇠 있음':'열쇠 없음'}): 목록·핀은 그대로 쓸 수 있다고 알린다`, note.t.includes('목록과 핀'));
  await p.close();
}

await b.close(); console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(fails?1:0);
