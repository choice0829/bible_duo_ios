import {serve,launch,sleep} from './devlib.mjs';
serve(8965); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const seed={fn:(cfg)=>{
  window.__msgs=[]; window.__loc=(cfg&&cfg.loc)||{lat:37.5301,lng:127.1238,acc:30}; window.__geo={q:[],r:[{name:'',addr:'서울 강동구 강동대로 229'}]};
  if(!(cfg&&cfg.noBridge)) window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m);
    if(m.loc){ setTimeout(()=>window.bfLocation&&window.bfLocation(window.__loc),40); }
    else if(m.geocode!==undefined){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.q}),40); }
    else if(m.rgeo){ setTimeout(()=>window.bfGeo&&window.bfGeo({id:m.id,results:window.__geo.r.map(x=>Object.assign({},x,{lat:m.rgeo.lat,lng:m.rgeo.lng}))}),40); }
  }}}};
  if(!sessionStorage.getItem('s')){ sessionStorage.setItem('s','1'); localStorage.clear();  localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); if(cfg&&cfg.places!==undefined) localStorage.setItem('bf.places',typeof cfg.places==='string'?cfg.places:JSON.stringify(cfg.places)); if(cfg&&cfg.theme) localStorage.setItem('bf.settings',JSON.stringify({theme:cfg.theme})); }
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
  await p.goto('http://localhost:8965/index.html'+query); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1500);
  return {p,errs,tileUrls,st};
}
const R=(sel)=>`(()=>{const e=document.querySelector('${sel}'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}})()`;
const vis=(p,sel)=>p.evaluate((s)=>{const e=document.querySelector(s); if(!e) return false; const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&!e.hidden},sel);
const places=(p)=>p.evaluate(()=>JSON.parse(localStorage.getItem('bf.places')||'[]'));
const settle=async(p)=>{await sleep(450); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:60000}); await sleep(300);};
const P=(i,name,lat,lng,extra={})=>Object.assign({id:'p'+i,name,lat,lng,addr:'',tel:'',hours:'',cap:0,amen:[],memo:'',ts:i},extra);
const DUO=['Duo 펼침',951,669,{top:0,right:84,bottom:0,left:0},299], FOLD=['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0},300], IP=['iPhone15 세로',393,852,{top:59,right:0,bottom:34,left:0},336];

// ===== A. 키보드 (세 기기): 입력 칸이 키보드 위에 보이고, 펼침에서는 오른쪽 지도가 그대로 =====
for (const [name,w,h,si,KB] of [DUO,FOLD,IP]) {
  console.log('===== A 키보드 '+name);
  const {p,errs}=await openDev([name,w,h,si],{cfg:{places:[P(1,'가나 카페',37.5301,127.1238,{addr:'서울 강동구'})]}});
  await settle(p);
  await p.click('#btn-map'); await sleep(1200);
  await p.click('#mp-add'); await sleep(300);
  const two=await p.evaluate(()=>document.querySelector('#mp').classList.contains('two'));
  const map0=await p.evaluate(R('.mp-mapwrap'));
  await p.evaluate((kb)=>{document.querySelector('#mp-f-memo').focus(); window.bfKeyboard(kb)},KB); await sleep(900);
  const mp=await p.evaluate(R('#mp')), memo=await p.evaluate(R('#mp-f-memo'));
  ok(name+': 화면 전체가 키보드 뒤까지 덮는다(뒤의 성경 본문이 안 보임)', Math.abs(mp.b-h)<=1 && await p.evaluate((w,h)=>[[6,h-6],[w/2,h-6],[w-6,h-6],[w/4,h-60]].every(([x,y])=>{const e=document.elementFromPoint(x,y); return !!(e&&e.closest('#mp'))}),w,h), 'mp.b='+mp.b);
  ok(name+': 메모 칸이 키보드 위에 보인다', memo.b<=h-KB+1 && memo.t>=0, JSON.stringify(memo)+' kbTop='+(h-KB));
  if(two){ const map1=await p.evaluate(R('.mp-mapwrap')); const same=['l','t','r','b'].every(k=>Math.abs(map0[k]-map1[k])<=1);
    ok(name+': 펼침: 키보드가 올라와도 오른쪽 지도는 그대로', same, JSON.stringify({map0,map1})); }
  for (const sel of ['#mp-f-name','#mp-f-tel','#mp-f-cap','#mp-f-addr']) {
    await p.evaluate((s)=>document.querySelector(s).focus(),sel); await sleep(700);
    const r=await p.evaluate(R(sel)); ok(name+': '+sel+' 키보드 위', r.b<=h-KB+1 && r.t>=0, JSON.stringify(r));
  }
  await p.evaluate(()=>{document.activeElement.blur(); window.bfKeyboard(0)}); await sleep(500);
  const mp2=await p.evaluate(R('#mp')); ok(name+': 키보드 내리면 원래대로', Math.abs(mp2.b-h)<=1);
  // 검색 칸도
  await p.click('#mp-f-cancel'); await sleep(200);
  await p.evaluate((kb)=>{document.querySelector('#mp-q').focus(); window.bfKeyboard(kb)},KB); await sleep(700);
  const q=await p.evaluate(R('#mp-q')); ok(name+': 검색 칸이 키보드 위', q.b<=h-KB+1 && q.t>=0, JSON.stringify(q));
  ok(name+': 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close();
}

// ===== B. 위치 거부 / 실패 =====
{ console.log('===== B 위치 거부·실패 (펼침)');
  const [name,w,h,si]=DUO;
  const {p,errs}=await openDev(DUO,{cfg:{places:[P(1,'다 카페',37.5301,127.1238),P(2,'가 카페',37.5401,127.1238)],loc:{error:'denied'}}}); await settle(p);
  await p.click('#btn-map'); await sleep(1200);
  const t1=await p.evaluate(()=>document.querySelector('#mp-loc').textContent);
  ok('위치 거부: 안내(설정 → 선한성경 → 위치)', t1.includes('설정 → 선한성경 → 위치'), t1);
  const names=await p.evaluate(()=>[...document.querySelectorAll('.mp-it-name')].map(e=>e.textContent));
  ok('위치를 모르면 이름순(가나다), 거리 표시 없음', JSON.stringify(names)==='["가 카페","다 카페"]' && (await p.evaluate(()=>document.querySelectorAll('.mp-it-d').length))===0, JSON.stringify(names));
  ok('위치 거부여도 지도·핀은 나온다', (await p.evaluate(()=>document.querySelectorAll('.mp-pin').length))===2);
  await p.click('#mp-add'); await sleep(200); await p.click('#mp-f-gps'); await sleep(500);
  const m1=await p.evaluate(()=>document.querySelector('#mp-f-msg').textContent);
  ok('현재 위치 단추도 같은 안내', m1.includes('위치 사용이 꺼져 있습니다') && !(await p.evaluate(()=>document.querySelector('#mp-f-msg').hidden)), m1);
  ok('거부 상태에서도 주소·지도로 등록할 수 있다(저장 단추 동작)', await vis(p,'#mp-f-save'));
  await p.evaluate(()=>{window.__loc={error:'fail'};}); await p.click('#mp-f-cancel'); await sleep(200); await p.click('#mp-loc-btn'); await sleep(500);
  const t2=await p.evaluate(()=>document.querySelector('#mp-loc').textContent);
  ok('위치 실패: 다시 눌러 보라는 안내', t2.includes('가져오지 못했습니다'), t2);
  await p.evaluate(()=>{window.__loc={lat:37.5301,lng:127.1238,acc:12};}); await p.click('#mp-loc-btn'); await sleep(500);
  ok('다시 눌러 성공하면 거리가 나온다', (await p.evaluate(()=>document.querySelectorAll('.mp-it-d').length))===2);
  ok('B 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }

// ===== C. 지도 바탕을 못 받을 때 =====
{ console.log('===== C 지도 바탕 접속 실패 (펼침)');
  const {p,errs}=await openDev(DUO,{cfg:{places:[P(1,'가나 카페',37.5301,127.1238)]},tiles:'fail'}); await settle(p);
  await p.click('#btn-map'); await sleep(2500);
  ok('안내 문구가 뜬다', await vis(p,'#mp-note'), await p.evaluate(()=>document.querySelector('#mp-note').textContent));
  ok('목록·핀은 그대로', (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===1 && (await p.evaluate(()=>document.querySelectorAll('.mp-pin').length))===1);
  await p.click('.mp-it-main'); await sleep(300);
  ok('카드도 열린다', await vis(p,'#mp-card'));
  ok('C 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }

// ===== D. 한국 밖 장소: 네이버 지도 단추 비활성, 나머지는 가능 =====
{ console.log('===== D 한국 밖 장소');
  const {p,errs}=await openDev(DUO,{cfg:{places:[P(1,'Almaty Cafe',43.2389,76.8897,{addr:'Almaty'})],loc:{lat:43.24,lng:76.89,acc:20}}}); await settle(p);
  await p.click('#btn-map'); await sleep(1200); await p.click('.mp-it-main'); await sleep(300);
  ok('한국 밖: 카드 단추는 길찾기·나만의 리뷰·수정뿐이고 길찾기는 활성이다(v61·v72)', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#mp-card .mp-lk')].map(x=>[x.textContent,x.disabled])))===JSON.stringify([['길찾기',false],['나만의 리뷰',false],['수정',false]]));
  await p.click('.mp-lk[data-o="route"]'); await sleep(200);
  { const o=await p.evaluate(()=>window.__msgs.filter(m=>m.open).map(m=>m.open));
    ok('한국 밖: 길찾기는 네이버가 아니라 구글 지도 길찾기 주소(목적지 좌표)로 간다', o.length===1 && o[0]==='https://www.google.com/maps/dir/?api=1&destination=43.238900,76.889700' && !o.some(u=>u.startsWith('nmap:')), o.join(' | ')); }
  ok('D 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }

// ===== E. 저장된 자료가 망가져 있어도 안전 / 많은 장소 =====
{ console.log('===== E 망가진 자료·많은 장소');
  const bad=[null,5,'x',{},{name:'',lat:1,lng:1},{name:'좌표없음'},{name:'범위밖',lat:99,lng:10},{id:'dup',name:'중복1',lat:37.5,lng:127.1},{id:'dup',name:'중복2',lat:37.6,lng:127.2},
    {id:'../evil',name:'<img src=x onerror=alert(1)>',lat:37.55,lng:127.05,addr:'<b>굵게</b>',memo:'<script>alert(1)</script>',amen:['out','hack','out'],cap:'abc',tel:123,hours:{}}];
  const {p,errs}=await openDev(DUO,{cfg:{places:bad}}); await settle(p);
  await p.click('#btn-map'); await sleep(1200);
  const n=await p.evaluate(()=>[...document.querySelectorAll('.mp-it-name')].map(e=>e.textContent));
  ok('쓸 수 있는 것만 남는다(중복1·중복2·태그 이름 3곳)', n.length===3 && n.includes('중복1') && n.includes('중복2') && n.some(x=>x.includes('<img')), JSON.stringify(n));
  ok('HTML이 실행되지 않고 글자로만 보인다', (await p.evaluate(()=>document.querySelectorAll('#mp-items img, #mp-items script, #mp-items b').length))===0);
  await p.click('.mp-item:last-child .mp-it-main'); await sleep(300);
  ok('카드에서도 HTML이 실행되지 않는다', (await p.evaluate(()=>document.querySelectorAll('#mp-card img, #mp-card script, #mp-card b').length))===0);
  const many=[]; for(let i=0;i<500;i++) many.push(P(i,'카페'+i,37.4+Math.random()*0.3,126.9+Math.random()*0.3));
  await p.close();
  const t0=Date.now();
  const r2=await openDev(DUO,{cfg:{places:many}}); await settle(r2.p);
  await r2.p.click('#btn-map'); await sleep(2500);
  const cnt=await r2.p.evaluate(()=>[document.querySelectorAll('.mp-item').length,document.querySelectorAll('.mp-pin').length]);
  ok('500곳: 목록·핀 모두 나온다', cnt[0]===500 && cnt[1]>=1, JSON.stringify(cnt));
  const tt=await r2.p.evaluate(()=>{const t=performance.now(); const q=document.querySelector('#mp-q'); q.value='카페49'; q.dispatchEvent(new Event('input',{bubbles:true})); return performance.now()-t;});
  ok('500곳 검색 반응 속도(< 500ms)', tt<500, Math.round(tt)+'ms');
  ok('E 오류 없음', errs.length===0 && r2.errs.length===0, JSON.stringify(errs.concat(r2.errs).slice(0,3)));
  await r2.p.close(); }

// ===== F. 야간 테마 =====
{ console.log('===== F 야간 테마 (펼침)');
  const {p,errs}=await openDev(DUO,{cfg:{theme:'night',places:[P(1,'야간 카페',37.5301,127.1238,{addr:'서울 강동구 강동대로 229',amen:['out','quiet'],cap:12,memo:'밤에도 연다'}),P(2,'두번째',37.5351,127.1238)]}}); await settle(p);
  await p.click('#btn-map'); await sleep(1500); await p.click('.mp-it-main'); await sleep(400);
  await p.screenshot({path:'map2-night.png'});
  const col=await p.evaluate(()=>({bg:getComputedStyle(document.querySelector('#mp')).backgroundColor, add:getComputedStyle(document.querySelector('.mp-add')).color}));
  ok('야간: 어두운 바탕·밝은 강조 위 어두운 글자', col.bg!=='rgb(251, 248, 241)' && col.add==='rgb(20, 22, 26)', JSON.stringify(col));
  ok('F 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }

// ===== G. 앱이 아닌 웹(브라우저)에서도 (위치는 브라우저 기능) =====
{ console.log('===== G 웹 경로 (네이티브 아님)');
  const ctx=b.defaultBrowserContext(); await ctx.overridePermissions('http://localhost:8965',['geolocation']);
  const {p,errs}=await openDev(DUO,{query:'',cfg:{noBridge:true,places:[P(1,'웹 카페',37.5301,127.1238)]}});
  await p.setGeolocation({latitude:37.5330,longitude:127.1238,accuracy:20});
  await settle(p); await p.click('#btn-map'); await sleep(1800);
  const t=await p.evaluate(()=>document.querySelector('#mp-loc').textContent); const d=await p.evaluate(()=>document.querySelector('.mp-it-d')?.textContent);
  ok('웹: 브라우저 위치로 거리 계산 (약 330m)', t.includes('내 위치 기준') && /^3[0-9]0m$/.test(d||''), t+' / '+d);
  ok('G 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); await ctx.clearPermissionOverrides(); }

// ===== H. 펼침 새 배치: 목록 창 접기·펼치기, 가려지지 않는 쪽 가운데로 이동, 고르기 중 창 숨김, 회전 =====
{ console.log('===== H 펼침 새 배치');
  const [name,w,h,si]=DUO;
  const {p,errs}=await openDev(DUO,{cfg:{places:[P(1,'가나 카페',37.5301,127.1238,{addr:'서울 강동구',amen:['wifi']}),P(2,'다라 카페',37.5401,127.1338,{amen:['out']}),P(3,'마바 카페',37.5201,127.1138)],loc:{lat:37.5301,lng:127.1238,acc:20}}}); await settle(p);
  await p.click('#btn-map'); await sleep(1500);
  const rc=(s)=>p.evaluate(R(s));
  ok('H: 목록 창 접기 단추가 보인다(열린 상태)', await vis(p,'#mp-ptog') && (await p.evaluate(()=>document.querySelector('#mp-ptog').textContent)).includes('접기') && await vis(p,'#mp-list'));
  // 목록에서 두 번째 장소 → 그 핀이 창에 가려지지 않은 쪽에 보인다
  await p.evaluate(()=>{const it=[...document.querySelectorAll('.mp-item')].find(e=>e.textContent.includes('다라')); it.querySelector('.mp-it-main').click();}); await sleep(500);
  const pin=await p.evaluate(()=>{const e=document.querySelector('.mp-pin.sel'); if(!e) return null; const r=e.getBoundingClientRect(); return {cx:r.left+r.width/2,cy:r.top+r.height/2}});
  const pl=await rc('#mp-list'), mp=await rc('.mp-mapwrap'), card=await rc('#mp-card');
  ok('H: 고른 장소의 핀이 목록 창 오른쪽(보이는 부분) 가운데쯤', pin && pin.cx>pl.r+20 && Math.abs(pin.cx-((pl.r+mp.r)/2))<=6, JSON.stringify({pin,plr:pl.r,mpr:mp.r}));
  ok('H: 카드는 목록 창 오른쪽에서 시작(창과 안 겹침)', card.w>0 && card.l>=pl.r, JSON.stringify({card:[card.l,card.r],plr:pl.r}));
  // 접기
  await p.click('#mp-ptog'); await sleep(300);
  ok('H: 접으면 목록 창이 사라지고 단추 글이 바뀐다', !(await vis(p,'#mp-list')) && (await p.evaluate(()=>document.querySelector('#mp-ptog').textContent)).includes('펼치기') && (await p.evaluate(()=>document.querySelector('#mp-ptog').getAttribute('aria-expanded')))==='false');
  const card2=await rc('#mp-card'); ok('H: 접으면 카드가 왼쪽 끝까지 넓어진다', card2.l<=mp.l+12, JSON.stringify(card2));
  // 접힌 상태에서도 핀 선택·내 위치·검색 동작
  await p.evaluate(()=>{const e=document.querySelector('.mp-pin:not(.sel)'); e.click();}); await sleep(300);
  ok('H: 접은 채 핀을 눌러도 카드가 열린다', await vis(p,'#mp-card'));
  await p.click('#mp-ptog'); await sleep(300);
  ok('H: 다시 펼치면 목록이 돌아온다', await vis(p,'#mp-list') && (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===3);
  // 위 줄 검색·키워드가 목록과 핀에 반영
  await p.click('#mp-chips button[data-k="wifi"]'); await sleep(300);
  ok('H: 위 줄 키워드(와이파이)를 켜면 목록·핀이 걸러진다', (await p.evaluate(()=>document.querySelectorAll('.mp-item').length))===1 && (await p.evaluate(()=>document.querySelectorAll('.mp-pin').length))===1);
  await p.click('#mp-chips button[data-k="wifi"]'); await sleep(200);
  await p.type('#mp-q','마바'); await sleep(300);
  ok('H: 위 줄 검색이 목록을 거른다', (await p.evaluate(()=>[...document.querySelectorAll('.mp-it-name')].map(e=>e.textContent))).join()==='마바 카페');
  await p.evaluate(()=>{const q=document.querySelector('#mp-q'); q.value=''; q.dispatchEvent(new Event('input',{bubbles:true}));}); await sleep(200);
  // 고르기 중에는 창이 숨고, 끝나면 돌아오며 고른 곳이 보이는 부분 가운데
  await p.click('#mp-add'); await sleep(300);
  ok('H: 입력 화면이 열리면 접기 단추는 숨는다', !(await vis(p,'#mp-ptog')) && await vis(p,'#mp-form'));
  await p.click('#mp-f-pick'); await sleep(500);
  ok('H: 지도에서 고르는 중에는 목록·입력 창이 숨는다', !(await vis(p,'#mp-form')) && await vis(p,'#mp-pick'));
  const cr=await p.evaluate(()=>{const e=document.querySelector('.mp-cross'); const r=e.getBoundingClientRect(); return {x:r.left,y:r.top}}), mp2=await rc('.mp-mapwrap');
  ok('H: 십자가 지도 한가운데', Math.abs(cr.x-(mp2.l+mp2.r)/2)<=2 && Math.abs(cr.y-(mp2.t+mp2.b)/2)<=2, JSON.stringify({cr,mp2}));
  await p.click('#mp-pick-ok'); await sleep(500);
  ok('H: 고른 뒤 입력 창이 돌아온다', await vis(p,'#mp-form') && !(await vis(p,'#mp-pick')));
  const dp=await p.evaluate(()=>{const e=document.querySelector('.mp-pin.draft'); if(!e) return null; const r=e.getBoundingClientRect(); return {cx:r.left+r.width/2}}), fm=await rc('#mp-form');
  ok('H: 고른 위치의 점선 핀이 입력 창에 가려지지 않는다', dp && dp.cx>fm.r+10, JSON.stringify({dp,fmr:fm.r}));
  await p.click('#mp-f-cancel'); await sleep(300);
  // 회전·접기: 좁은 화면으로 바뀌면 부품이 원래 자리로, 다시 펼치면 위 줄로
  await p.setViewport({width:393,height:852,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(900);
  ok('H: 좁은 화면으로 바뀌면 검색·키워드·위치가 목록 안으로 돌아간다', await p.evaluate(()=>['#mp-q','#mp-chips','#mp-loc','#mp-add'].every(s=>document.querySelector(s).closest('#mp-list'))) && await vis(p,'.mp-tabs') && !(await vis(p,'#mp-ptog')));
  await p.setViewport({width:951,height:669,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(900);
  ok('H: 다시 펼치면 위 줄·아래 줄로', await p.evaluate(()=>document.querySelector('#mp-q').closest('.mp-bar')&&document.querySelector('#mp-chips').closest('.mp-sub')&&document.querySelector('#mp-loc').closest('.mp-foot')&&document.querySelector('#mp-count').closest('.mp-foot')) && !(await vis(p,'.mp-tabs')));
  const zside=()=>p.evaluate(()=>document.querySelector('.leaflet-control-zoom').closest('.leaflet-right')?'right':'left');
  const z1=await zside(); await p.setViewport({width:393,height:852,deviceScaleFactor:2,isMobile:true,hasTouch:true}); await sleep(900); const z2=await zside();
  ok('H: 확대·축소는 펼침에서 오른쪽, 좁은 화면에서 왼쪽', z1==='right' && z2==='left', z1+' / '+z2);
  ok('H 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }

// ===== I. 가로로 눕힌 아이폰(높이 낮음)은 탭 배치 =====
{ console.log('===== I 가로 아이폰');
  const {p,errs}=await openDev(['iPhone15 가로',852,393,{top:0,right:59,bottom:21,left:59}],{cfg:{places:[P(1,'가나 카페',37.5301,127.1238)]}}); await settle(p);
  await p.click('#btn-map'); await sleep(1500);
  ok('I: 탭 배치(높이가 낮아 지도가 너무 작아지지 않게)', await vis(p,'.mp-tabs') && !(await p.evaluate(()=>document.querySelector('#mp').classList.contains('two'))));
  await p.click('.mp-tabs button[data-t="r"]'); await sleep(500);
  const mp=await p.evaluate(R('.mp-mapwrap')); ok('I: 지도 탭에서 지도가 충분히 크다', mp.h>250, JSON.stringify(mp));
  ok('I 오류 없음', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.close(); }
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
