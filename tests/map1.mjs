import {serve,launch,sleep} from './devlib.mjs';
serve(8961); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const ME={lat:37.5301,lng:127.1238,acc:30};
const seed={fn:(cfg)=>{
  window.__msgs=[]; window.__loc={lat:37.5301,lng:127.1238,acc:30};
  window.__geo={q:[],r:[{name:'',addr:'서울 강동구 강동대로 229'}]};
  window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m);
    if(m.loc){ setTimeout(()=>window.bfLocation&&window.bfLocation(window.__loc),40); }
    else if(m.geocode!==undefined){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.q}),40); }
    else if(m.rgeo){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.r.map(x=>Object.assign({},x,{lat:m.rgeo.lat,lng:m.rgeo.lng}))}),40); }
  }}}};
  if(!sessionStorage.getItem('s')){ sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.mapeng','raster'); localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); if(cfg&&cfg.places) localStorage.setItem('bf.places',JSON.stringify(cfg.places)); if(cfg&&cfg.theme) localStorage.setItem('bf.settings',JSON.stringify({theme:cfg.theme})); }
}, arg:null};
async function openDev(dev,{query='?native=1',cfg=null,tiles='ok'}={}) {
  const [name,w,h,si]=dev; const p=await b.newPage(); const errs=[]; const tileUrls=[]; const tileHeaders=[];
  p.on('pageerror',e=>errs.push('pageerror '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const cdp=await p.createCDPSession(); try{ await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:si}); }catch(e){}
  await p.setRequestInterception(true);
  const st={tiles};
  p.on('request',r=>{const u=r.url(); if(u.startsWith('https://tile.openstreetmap.org/')||u.startsWith('https://basemaps.cartocdn.com/')){ tileUrls.push(u); if(st.tiles==='ok') r.respond({status:200,contentType:'image/png',body:PNG,headers:{'access-control-allow-origin':'*'}}); else r.abort(); } else if(u.startsWith('http://localhost')||u.startsWith('data:')||u.startsWith('blob:')) r.continue(); else r.abort();});
  await p.evaluateOnNewDocument(seed.fn, cfg);
  await p.goto('http://localhost:8961/index.html'+query); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1500);
  return {p,errs,tileUrls,st};
}
const R=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
const vis=(p,sel)=>p.evaluate((s)=>{const e=document.querySelector(s); if(!e) return false; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.hidden},sel);
const msgs=(p)=>p.evaluate(()=>window.__msgs.slice());
const places=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem('bf.places')||'[]'));
const DEV=[['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0},299],['Duo 접힘',466,678,{top:0,right:84,bottom:0,left:0},300],['iPhone15 세로',393,852,{top:59,right:0,bottom:34,left:0},336]];
const settle=async(p)=>{await sleep(450); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:60000}); await sleep(300);};
const SN={'Duo 펼침':'duoU','Duo 접힘':'duoF','iPhone15 세로':'ip15'};
const only=process.argv[2];
for (const [name,w,h,si,KB] of DEV) {
  if (only && !name.includes(only)) continue;
  console.log('===== '+name);
  const {p,errs,tileUrls}=await openDev([name,w,h,si]);
  const narrow=!(w>=680&&w>=h*1.1);
  // ---- 머리줄: 순서·개수·배치 ----
  const hdr=await p.evaluate(()=>[...document.querySelectorAll('.menu-row button')].map(e=>{const r=e.getBoundingClientRect(); return {id:e.id,l:r.left,t:r.top,r:r.right,b:r.bottom}}));
  const order=[...hdr].sort((a,c)=>Math.round(a.t/10)-Math.round(c.t/10)||a.l-c.l).map(x=>x.id);
  ok(name+': 머리줄 순서 = 검색·하이라이트·노트·바이블 포토 카드·지도·설정', JSON.stringify(order)==='["btn-search","btn-hl","btn-notes","btn-card","btn-map","btn-settings"]', order.join(','));
  ok(name+': 번역 단추는 머리줄에 없다', (await p.evaluate(()=>!document.querySelector('#btn-easy'))));
  ok(name+': 단추 6개가 화면 안에 있다', hdr.length===6 && hdr.every(x=>x.l>=0&&x.r<=w&&x.t>=0&&x.b<=h), JSON.stringify(hdr.map(x=>[Math.round(x.l),Math.round(x.t)])));
  const rows=new Set(hdr.map(x=>Math.round(x.t/10)));
  const spread=await p.evaluate(()=>document.body.classList.contains('is-spread'));
  ok(name+': 배치 모양('+(spread?'펼침 한 줄':'한 쪽 3×2')+')', spread?rows.size===1:rows.size===2, 'rows='+rows.size);
  const ttl=await p.evaluate(R('#btn-pick')); const minL=Math.min(...hdr.map(x=>x.l));
  ok(name+': 책 이름과 메뉴가 겹치지 않는다', ttl.r<=minL+1, `title.r=${Math.round(ttl.r)} menu.l=${Math.round(minL)}`);
  await p.screenshot({path:`map1-${SN[name]}-header.png`,clip:{x:0,y:0,width:w,height:Math.min(h,170)}});
  // ---- 설정 안의 번역 선택 ----
  await settle(p);
  await p.click('#btn-settings'); await sleep(500);
  console.log('ERRS', JSON.stringify(errs)); console.log('DBG', JSON.stringify(await p.evaluate(()=>{const e=document.querySelector('#btn-settings'); const r=e.getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return {r:[r.left,r.top,r.width,r.height], hit:h&&(h.id||h.className||h.tagName), sheetHidden:document.querySelector('#sheet').hidden, title:document.querySelector('#sheet-title').textContent, mp:!!document.querySelector('#mp')&&!document.querySelector('#mp').hidden}})));
  ok(name+': 설정 창 제목 = 설정', (await p.evaluate(()=>document.querySelector('#sheet-title').textContent))==='설정');
  ok(name+': 설정에 번역 선택 줄이 있다', await vis(p,'#go-tr'));
  await p.click('#go-tr'); await sleep(300);
  ok(name+': 번역 선택 창 + 뒤로 단추', (await p.evaluate(()=>document.querySelector('#sheet-title').textContent))==='번역 선택' && await vis(p,'#sheet-back'));
  await p.evaluate(()=>document.querySelector('#tr-std').click()); await settle(p);
  ok(name+': AI 표준어 번역이 켜진다', (await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.settings')).std))===true);
  await p.click('#sheet-back'); await sleep(300);
  const sub=await p.evaluate(()=>document.querySelector('#go-tr .sub').textContent);
  ok(name+': 뒤로 가면 설정으로 돌아오고 켜짐이 보인다', (await p.evaluate(()=>document.querySelector('#sheet-title').textContent))==='설정' && sub.includes('켜짐'), sub);
  await p.click('#go-tr'); await sleep(200); await p.evaluate(()=>document.querySelector('#tr-std').click()); await settle(p);
  await p.click('#sheet-close'); await sleep(500);

  // ---- 지도 열기 ----
  await p.click('#btn-map'); await sleep(1500);
  ok(name+': 지도 화면이 열린다', await vis(p,'#mp'));
  ok(name+': '+(narrow?'좁은 화면(탭)':'펼친 화면(두 칸)')+' 배치', await p.evaluate((n)=>document.querySelector('#mp').classList.contains(n?'narrow':'two'),narrow));
  ok(name+': Leaflet 지도가 만들어졌다', await p.evaluate(()=>!!document.querySelector('#mp-map .leaflet-container, #mp-map.leaflet-container')));
  ok(name+': 지도 바탕 주소가 OpenStreetMap 형식', tileUrls.length>0 && tileUrls.every(u=>/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)), tileUrls.length+'개 '+tileUrls[0]);
  ok(name+': 출처 표기(OpenStreetMap)', await p.evaluate(()=>/OpenStreetMap/.test(document.querySelector('.leaflet-control-attribution')?.textContent||'')));
  let m=await msgs(p);
  ok(name+': 열면 앱에 위치를 요청한다', m.some(x=>x.loc), JSON.stringify(m));
  ok(name+': 내 위치 기준 안내', (await p.evaluate(()=>document.querySelector('#mp-loc').textContent)).includes('내 위치 기준'), await p.evaluate(()=>document.querySelector('#mp-loc').textContent));
  ok(name+': 장소가 없으면 안내 글', (await p.evaluate(()=>document.querySelector('#mp-items').textContent)).includes('아직 등록한 장소가 없습니다'));
  if(!narrow){ const mp=await p.evaluate(R('.mp-mapwrap')), q=await p.evaluate(R('#mp-q')), ch=await p.evaluate(R('#mp-chips')), ad=await p.evaluate(R('#mp-add')), lc=await p.evaluate(R('#mp-loc')), lb=await p.evaluate(R('#mp-loc-btn')), pl=await p.evaluate(R('#mp-list')), zm=await p.evaluate(R('.leaflet-control-zoom'));
    ok(name+': 지도가 가로 전체, 좌우 여백이 같다', Math.abs(mp.l-(w-mp.r))<=1 && mp.w>=w-60 && mp.h>350 && mp.t>=118 && mp.b<=h-10, JSON.stringify({map:[mp.l,mp.t,mp.r,mp.b],w}));
    ok(name+': 검색·카페 추가·키워드가 지도 위에, 오른쪽 위 상태 알약 자리는 비운다', q.b<=mp.t && ad.b<=mp.t && ch.b<=mp.t && ad.r<=w-84 && ch.r<=w-84 && q.l>=mp.l, JSON.stringify({q:[q.l,q.t,q.r,q.b],ad:[ad.r],ch:[ch.b,ch.r]}));
    ok(name+': 내 위치·새로고침이 지도 아래 오른쪽', lc.t>=mp.b-1 && lb.t>=mp.b-1 && Math.abs(lb.r-mp.r)<=1 && lb.l>w/2, JSON.stringify({lc:[lc.t],lb:[lb.l,lb.r],mp:[mp.b,mp.r]}));
    ok(name+': 목록 창은 지도 왼쪽 위에 떠 있다', pl.l>=mp.l && pl.r<mp.l+w*0.45 && pl.t>=mp.t && pl.b<=mp.b, JSON.stringify({pl:[pl.l,pl.t,pl.r,pl.b]}));
    ok(name+': 확대·축소는 지도 오른쪽 위', zm.r<=mp.r && zm.l>w*0.7 && zm.t>=mp.t, JSON.stringify(zm));
  } else { ok(name+': 목록 탭에서는 지도 칸이 숨는다', !(await vis(p,'.mp-mapwrap')) && await vis(p,'.mp-tabs')); }
  await p.screenshot({path:`map1-${SN[name]}-empty.png`});

  // ---- 카페 추가 1: 현재 위치로 ----
  await p.click('#mp-add'); await sleep(300);
  ok(name+': 입력 화면이 열린다', await vis(p,'#mp-form') && !(await vis(p,'#mp-list')));
  await p.click('#mp-f-save'); await sleep(200);
  ok(name+': 이름 없이 저장하면 막는다', (await p.evaluate(()=>document.querySelector('#mp-f-msg').textContent)).includes('이름'));
  await p.type('#mp-f-name','OO커피 강동점'); await p.click('#mp-f-save'); await sleep(200);
  ok(name+': 위치 없이 저장하면 막는다', (await p.evaluate(()=>document.querySelector('#mp-f-msg').textContent)).includes('위치를 정해'));
  await p.click('#mp-f-gps'); await sleep(500);
  const ll1=await p.evaluate(()=>document.querySelector('#mp-f-ll').textContent);
  ok(name+': 현재 위치로 위치가 정해진다', ll1.includes('위치 지정됨') && ll1.includes('37.53010') && ll1.includes('127.12380'), ll1);
  ok(name+': 주소 칸이 자동으로 채워진다', (await p.evaluate(()=>document.querySelector('#mp-f-addr').value))==='서울 강동구 강동대로 229');
  await p.type('#mp-f-tel','02-1234-5678'); await p.type('#mp-f-hours','매일 09:00–22:00'); await p.type('#mp-f-cap','20');
  await p.click('#mp-f-amen [data-k="out"]'); await p.click('#mp-f-amen [data-k="group"]'); await p.type('#mp-f-memo','2층 별실 8명까지\n오후 3시 이후 한산');
  await p.screenshot({path:`map1-${SN[name]}-form.png`});
  await p.click('#mp-f-save'); await sleep(700);
  let pl=await places(p);
  ok(name+': 저장됨 (모든 항목)', pl.length===1 && pl[0].name==='OO커피 강동점' && pl[0].tel==='02-1234-5678' && pl[0].hours==='매일 09:00–22:00' && pl[0].cap===20 && JSON.stringify(pl[0].amen)==='["out","group"]' && pl[0].memo.includes('별실') && Math.abs(pl[0].lat-37.5301)<1e-6 && pl[0].addr.includes('강동대로'), JSON.stringify(pl[0]));
  ok(name+': 목록으로 돌아와 새 장소가 보인다', await vis(p,'#mp-list') && (await p.evaluate(()=>document.querySelector('#mp-items').textContent)).includes('OO커피 강동점'));
  ok(name+': 거리 표시(내 위치 바로 옆 = 10m)', (await p.evaluate(()=>document.querySelector('.mp-it-d')?.textContent))==='10m');
  ok(name+': 지도 핀이 생긴다', (await p.evaluate(()=>document.querySelectorAll('.mp-pin').length))>=1);
  if(narrow){ /* 저장 뒤에는 목록 탭 */ await p.click('.mp-it-main'); await sleep(500); ok(name+': 좁은 화면: 목록에서 누르면 지도 탭으로 간다', (await p.evaluate(()=>document.querySelector('#mp').dataset.tab))==='r'); }
  else { await p.click('.mp-it-main'); await sleep(400); }
  ok(name+': 상세 카드가 뜬다', await vis(p,'#mp-card') && (await p.evaluate(()=>document.querySelector('#mp-card').textContent)).includes('영업시간 · 매일 09:00–22:00'));
  const card=await p.evaluate(R('#mp-card')), wrap=await p.evaluate(R('.mp-mapwrap'));
  ok(name+': 카드가 지도 칸 안에 있고 출처 표기를 가리지 않는다', card.l>=wrap.l && card.r<=wrap.r && card.b<=wrap.b-20, JSON.stringify({card:[card.t,card.b],wrap:[wrap.t,wrap.b]}));
  await p.screenshot({path:`map1-${SN[name]}-card.png`});
  // 길찾기 링크
  await p.click('.mp-lk[data-o="naver"]'); await sleep(150);
  await p.click('.mp-lk[data-o="apple"]'); await sleep(150);
  await p.click('.mp-lk[data-o="google"]'); await sleep(150);
  await p.click('.mp-lk[data-o="tel"]'); await sleep(150);
  m=(await msgs(p)).filter(x=>x.open);
  ok(name+': 네이버 지도 주소(nmap://place …&appname=번들ID, 웹 대체 주소)', m[0] && /^nmap:\/\/place\?lat=37\.530100&lng=127\.123800&name=%EC%98%A4|^nmap:\/\/place\?lat=37\.530100&lng=127\.123800&name=OO/.test(m[0].open) && m[0].open.endsWith('&appname=com.choice0829.bibleflip') && /^https:\/\/map\.naver\.com\/p\/search\//.test(m[0].fallback), JSON.stringify(m[0]));
  ok(name+': 애플 지도 주소', m[1] && m[1].open.startsWith('https://maps.apple.com/?daddr=37.530100,127.123800'), m[1]&&m[1].open);
  ok(name+': 구글 지도 주소', m[2] && m[2].open==='https://www.google.com/maps/dir/?api=1&destination=37.530100,127.123800', m[2]&&m[2].open);
  ok(name+': 전화 주소', m[3] && m[3].open==='tel:0212345678', m[3]&&m[3].open);

  // ---- 카페 추가 2: 주소로 찾기 (후보 둘 중 선택) ----
  if(narrow) await p.click('.mp-tabs [data-t="l"]');
  await p.evaluate(()=>{window.__geo.q=[{name:'가나 카페',addr:'서울 강동구 천호대로 1',lat:37.5401,lng:127.1238},{name:'다라 카페',addr:'서울 강동구 천호대로 99',lat:37.5601,lng:127.1238}];});
  await p.click('#mp-add'); await sleep(250);
  await p.type('#mp-f-name','가나 카페'); await p.type('#mp-f-addr','천호대로'); await p.click('#mp-f-find'); await sleep(400);
  ok(name+': 주소 후보 두 곳이 나온다', (await p.evaluate(()=>document.querySelectorAll('#mp-f-res button').length))===2);
  await p.click('#mp-f-res button[data-i="0"]'); await sleep(300);
  const ll2=await p.evaluate(()=>document.querySelector('#mp-f-ll').textContent);
  ok(name+': 고른 후보 위치가 정해진다 (내 위치에서 약 1.1km)', ll2.includes('37.54010') && ll2.includes('1.1km'), ll2);
  ok(name+': 후보 주소가 주소 칸에 들어간다', (await p.evaluate(()=>document.querySelector('#mp-f-addr').value))==='서울 강동구 천호대로 1');
  await p.click('#mp-f-amen [data-k="quiet"]'); await p.click('#mp-f-save'); await sleep(500);
  // ---- 카페 추가 3: 지도에서 고르기 ----
  if(narrow) await p.click('.mp-tabs [data-t="l"]');
  await p.click('#mp-add'); await sleep(250);
  await p.type('#mp-f-name','지도에서 고른 카페'); await p.click('#mp-f-pick'); await sleep(600);
  ok(name+': 지도에서 고르기: 십자 표시와 안내가 보인다', (await p.evaluate(()=>!document.querySelector('#mp-cross').hidden)) && await vis(p,'#mp-pick'));
  if(narrow) ok(name+': 좁은 화면은 지도 탭으로 바뀐다', (await p.evaluate(()=>document.querySelector('#mp').dataset.tab))==='r');
  const mw=await p.evaluate(R('#mp-map')); const cx=mw.l+mw.w/2, cy=mw.t+mw.h/2;
  await p.mouse.move(cx,cy); await p.mouse.down(); await p.mouse.move(cx-90,cy+50,{steps:10}); await p.mouse.up(); await sleep(400);
  await p.click('#mp-pick-ok'); await sleep(500);
  const ll3=await p.evaluate(()=>document.querySelector('#mp-f-ll').textContent);
  ok(name+': 끌어서 고른 위치가 정해진다 (처음 위치와 다름)', ll3.includes('위치 지정됨') && !ll3.includes('37.53010,') && !ll3.includes('127.12380'), ll3);
  ok(name+': 고른 뒤 십자 표시는 사라진다', (await p.evaluate(()=>document.querySelector('#mp-cross').hidden)) && !(await vis(p,'#mp-pick')));
  if(narrow) ok(name+': 좁은 화면은 입력 탭으로 돌아온다', (await p.evaluate(()=>document.querySelector('#mp').dataset.tab))==='l' && await vis(p,'#mp-form'));
  await p.click('#mp-f-save'); await sleep(600);
  pl=await places(p);
  ok(name+': 세 곳이 저장됐다', pl.length===3, pl.map(x=>x.name).join('|'));

  // ---- 가까운 순 정렬 ----
  if(narrow) await p.click('.mp-tabs [data-t="l"]');
  const items=await p.evaluate(()=>[...document.querySelectorAll('.mp-item')].map(e=>({n:e.querySelector('.mp-it-name').textContent,d:e.querySelector('.mp-it-d')?.textContent})));
  const toM=(s)=>s.endsWith('km')?parseFloat(s)*1000:parseFloat(s);
  ok(name+': 거리 가까운 순으로 정렬', items.length===3 && items[0].n==='OO커피 강동점' && items.every((x,i)=>i===0||toM(x.d)>=toM(items[i-1].d)), JSON.stringify(items));
  // ---- 검색·편의 항목 필터 ----
  await p.type('#mp-q','가나'); await sleep(250);
  ok(name+': 검색: 이름으로 찾기', (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===1 && (await p.evaluate(()=>document.querySelector('#mp-count').textContent))==='3곳 중 1곳');
  await p.evaluate(()=>{const i=document.querySelector('#mp-q'); i.value=''; i.dispatchEvent(new Event('input',{bubbles:true}));}); await sleep(200);
  await p.click('#mp-chips [data-k="out"]'); await sleep(200);
  ok(name+': 필터: 콘센트 있는 곳만', (await p.evaluate(()=>[...document.querySelectorAll('.mp-it-name')].map(e=>e.textContent).join()))==='OO커피 강동점');
  await p.click('#mp-chips [data-k="out"]'); await sleep(150);
  ok(name+': 필터 해제하면 전부', (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===3);
  await p.screenshot({path:`map1-${SN[name]}-list.png`});
  // ---- 수정 ----
  await p.click('.mp-item:first-child .mp-it-edit'); await sleep(300);
  ok(name+': 수정: 기존 값이 채워져 있다', (await p.evaluate(()=>document.querySelector('#mp-f-name').value))==='OO커피 강동점' && (await p.evaluate(()=>document.querySelector('#mp-f-cap').value))==='20' && await vis(p,'#mp-f-del'));
  // 작성 중에 닫으려 하면 막는다
  await p.type('#mp-f-name',' 본점'); await p.click('#mp-close'); await sleep(250);
  ok(name+': 작성 중 닫기는 막고 안내한다', await vis(p,'#mp') && (await p.evaluate(()=>document.querySelector('#infotoast')?.textContent||'')).includes('작성 중인 내용'));
  await p.click('#mp-f-save'); await sleep(500);
  pl=await places(p);
  ok(name+': 수정 저장(이름 바뀜, 개수·id 그대로)', pl.length===3 && pl.some(x=>x.name==='OO커피 강동점 본점'));
  // ---- 삭제 (두 번 눌러야) ----
  if(narrow) await p.click('.mp-tabs [data-t="l"]');
  await p.click('.mp-item:last-child .mp-it-edit'); await sleep(250);
  await p.click('#mp-f-del'); await sleep(150);
  ok(name+': 삭제 첫 번째 누름은 확인만', (await places(p)).length===3 && (await p.evaluate(()=>document.querySelector('#mp-f-del').textContent)).includes('한 번 더'));
  await p.click('#mp-f-del'); await sleep(450);
  ok(name+': 삭제 두 번째 누름에서 지워진다', (await places(p)).length===2 && await vis(p,'#mp-list'));
  // ---- 백업에 모임 장소가 들어간다 ----
  await p.click('#mp-close'); await sleep(300);
  ok(name+': 닫기', !(await vis(p,'#mp')));
  await p.click('#btn-settings'); await sleep(400); await p.click('#go-adv'); await sleep(300); await p.click('#go-bk'); await sleep(400);
  const bk=await p.evaluate(()=>document.querySelector('#bk-out').value);
  let bj=null; try{bj=JSON.parse(bk)}catch(e){}
  ok(name+': 백업 내용에 places(2곳)', bj && Array.isArray(bj.places) && bj.places.length===2);
  ok(name+': 백업 화면에 모임 장소 개수', (await p.evaluate(()=>document.querySelector('#sheet-body').textContent)).includes('모임 장소 2곳'));
  bj.places=[bj.places[0]];
  await p.evaluate((t)=>{const i=document.querySelector('#bk-in'); i.value=t; i.dispatchEvent(new Event('input',{bubbles:true}));}, JSON.stringify(bj));
  await p.click('#bk-apply'); await sleep(200); await p.click('#bk-apply'); await sleep(900);
  ok(name+': 백업 불러오기로 모임 장소가 1곳으로 바뀐다', (await places(p)).length===1);
  // 다시 열면 목록부터, 1곳
  await p.click('#btn-map'); await sleep(900);
  ok(name+': 다시 열면 목록 화면 + 1곳', await vis(p,'#mp-list') && (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===1);
  ok(name+': 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close();
}
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
