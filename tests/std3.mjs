import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8893); const b=await launch(); let fails=0;
const ok=(n,c,x='')=>{ if(!c) fails++; console.log((c?'ok   ':'FAIL ')+n+(x?' — '+x:'')); };
const seedFor=(o)=>({fn:(a)=>{ if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify(a)); }}, arg:o});
const LAND=['Duo',867,669,{top:0,right:0,bottom:34,left:0}], FOLD=['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0}];
const info=(p)=>p.evaluate(()=>{ const pages=[...document.querySelectorAll('#stage .page')].filter(e=>e.getBoundingClientRect().width>0);
  const std=[...document.querySelectorAll('#stage p.std')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>0&&r.left<innerWidth});
  const ov=[...document.querySelectorAll('#stage .page .txt')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.scrollHeight-e.clientHeight);
  return {std:std.length, first:std[0]?std[0].textContent:null, krvFirst:(document.querySelector('#stage p[data-k]')||{}).textContent, overflow:Math.max(0,...ov), loading:document.querySelector('#loading').hidden,
    settings:localStorage.getItem('bf.settings'), btn:!!(JSON.parse(localStorage.getItem('bf.settings')||'{}').std), pos:localStorage.getItem('bf.pos'), pgc:Object.keys((JSON.parse(localStorage.getItem('bf.pgc')||'{}').map)||{}).length}; });
const openTr=async(p)=>{ await p.click('#btn-settings'); await sleep(500); await p.click('#go-tr'); await sleep(300); };
// v97: 번역을 켜고 끄면 0.25초 뒤에 다시 만들기가 시작되고(쪽 나누기 약 3초), 그동안 #loading(종이색 가림)이 보인다.
// 예전 wait 는 가림이 뜨기 전에 '숨김'을 보고 바로 지나가, 다 만들기 전에 화면을 재서 std 0개로 실패했다 → 가림이 뜨기를 먼저 기다린다.
const wait=async(p)=>{ await p.waitForFunction(()=>document.querySelector('#loading').hidden===false,{timeout:1500}).catch(()=>{}); await p.waitForFunction(()=>document.querySelector('#loading').hidden===true,{timeout:30000}); await sleep(900); };

// 펼친 화면
{ const {p,errs}=await openDevice(b,LAND,{seed:seedFor({book:0,chapter:0,verse:1}),port:8893});
  const off=await info(p); ok('spread: off → no std paragraphs', off.std===0 && off.btn===false);
  await openTr(p); await sleep(500);
  await p.screenshot({path:'std-menu.png'});
  const m=await p.evaluate(()=>({title:document.querySelector('#sheet-title').textContent,
    rows:[...document.querySelectorAll('#sheet-body label.tr')].map(l=>({name:l.querySelector('span').childNodes[0].textContent, checked:l.querySelector('input').checked, disabled:l.querySelector('input').disabled})),
    infoHidden:document.querySelector('#tr-info-std').hidden, body:document.querySelector('#sheet-body').textContent}));
  ok('menu title = 번역 선택', m.title==='번역 선택', m.title);
  ok('menu rows in order', JSON.stringify(m.rows.map(r=>r.name))===JSON.stringify(['AI 표준어 번역','개역개정','현대인의성경','쉬운성경']), JSON.stringify(m.rows.map(r=>r.name)));
  ok('only AI 표준어 번역 is selectable; others disabled+unchecked', !m.rows[0].disabled && m.rows.slice(1).every(r=>r.disabled && !r.checked), JSON.stringify(m.rows));
  ok('AI guide hidden while unchecked', m.infoHidden===true && !/참고용 글/.test(await p.evaluate(()=>document.querySelector('#tr-info-std').offsetParent===null?'':'x')));
  ok('reference note: others coming later', /개역개정, 현대인의성경, 쉬운성경.*추후 업데이트될 예정/.test(m.body), m.body.slice(-60));
  ok('old "준비된 곳" list removed', !/준비된 곳/.test(m.body) && !(await p.evaluate(()=>!!document.querySelector('#easy-ready'))));
  // 선택할 수 없는 번역을 눌러도 체크되지 않는다
  await p.evaluate(()=>document.querySelector('#tr-krv2').click()); await p.click('#sheet-body label.tr.off >> nth=1',{force:true}).catch(()=>{});
  ok('disabled translation stays unchecked after tap', await p.evaluate(()=>[...document.querySelectorAll('#sheet-body label.tr.off input')].every(i=>!i.checked)));
  await p.evaluate(()=>document.querySelector('#tr-std').click());
  // v97: 다시 만드는 동안에도 번역 선택 창이 가림(#loading) 위에 보인다
  await p.waitForFunction(()=>document.querySelector('#loading').hidden===false,{timeout:1500}).catch(()=>{});
  const cov=await p.evaluate(()=>{const s=document.querySelector('#sheet .sheet-card, #sheet > div')||document.querySelector('#sheet'); const r=document.querySelector('#tr-std').getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return {loading:!document.querySelector('#loading').hidden, hitSheet:!!(t&&t.closest('#sheet'))};});
  ok('v97/v100: while rebuilding, the translation sheet stays on top (v100: no cover at all after the first screen)', !cov.loading && cov.hitSheet, JSON.stringify(cov));
  await wait(p);
  const g=await p.evaluate(()=>({open:!document.querySelector('#sheet').hidden, vis:document.querySelector('#tr-info-std').offsetParent!==null, txt:document.querySelector('#tr-info-std').textContent, checked:document.querySelector('#tr-std').checked}));
  ok('check AI → sheet stays open, guide shown', g.open && g.vis && g.checked && /참고용 글/.test(g.txt) && /목회자·전문가의 검토/.test(g.txt) && /태초에 하나님이 하늘과 땅을 창조하셨다/.test(g.txt), JSON.stringify({open:g.open,vis:g.vis}));
  await p.screenshot({path:'tr-menu-on.png'});
  await p.click('#sheet-close'); await sleep(500);
  const on=await info(p); await p.screenshot({path:'std-spread-on.png'});
  ok('spread: on → std paragraphs shown', on.std>0, JSON.stringify({n:on.std}));
  ok('spread: first std text = user example', /^태초에 하나님이 하늘과 땅을 창조하셨다\.$/.test(on.first||''), on.first);
  ok('spread: KRV line unchanged', /^1태초에 하나님이 천지를 창조하시니라$/.test((on.krvFirst||'').trim()), on.krvFirst);
  ok('spread: no page overflow', on.overflow<=0, 'overflow '+on.overflow);
  ok('spread: setting saved (std on)', on.btn===true && /"std":true/.test(on.settings), on.settings);
  ok('spread: position kept', /"book":0,"chapter":0/.test(on.pos), on.pos);
  // 쪽 넘기기
  for (let i=0;i<3;i++){ await p.keyboard.press('ArrowRight'); await sleep(900); }
  const pg=await info(p); await p.screenshot({path:'std-spread-p2.png'}); ok('spread: after turning, no overflow', pg.overflow<=0, 'overflow '+pg.overflow);
  // 풀이가 없는 책 (출애굽기) → 안내 + 개역한글만
  await p.evaluate(()=>{ localStorage.setItem('bf.pos',JSON.stringify({book:5,chapter:0,verse:1})); }); await p.reload(); await wait(p);
  const ex=await info(p); const toast=await p.evaluate(()=>document.getElementById('infotoast')?.textContent||'');
  ok('book without std: shows KRV only', ex.std===0 && ex.loading===true, JSON.stringify({std:ex.std}));
  ok('book without std: toast shown', /준비되지 않았습니다/.test(toast), toast);
  // 끄기
  await p.evaluate(()=>{ localStorage.setItem('bf.pos',JSON.stringify({book:0,chapter:0,verse:1})); }); await p.reload(); await wait(p);
  await openTr(p); await sleep(400); await p.evaluate(()=>document.querySelector('#tr-std').click()); await wait(p);
  ok('uncheck AI → guide hidden', await p.evaluate(()=>document.querySelector('#tr-info-std').offsetParent===null));
  await p.click('#sheet-close'); await sleep(400);
  const back=await info(p); ok('spread: off again → std gone, same page text', back.std===0 && back.btn===false);
  ok('spread: no errors', errs.length===0, errs.join(';')); await p.close(); }

// 접은 화면(한 쪽 세로 스크롤)
{ const {p,errs}=await openDevice(b,FOLD,{seed:seedFor({book:42,chapter:2,verse:16}),port:8893});
  await openTr(p); await sleep(500); await p.evaluate(()=>document.querySelector('#tr-std').click()); await wait(p); await p.screenshot({path:'tr-menu-fold.png'}); await p.click('#sheet-close'); await sleep(500);
  const r=await p.evaluate(()=>{ const pane=document.querySelectorAll('#book .chap')[2]; const std=pane.querySelectorAll('p.std'); const kids=[...pane.children].filter(e=>e.tagName==='P'); 
    const pairs=kids.every((e,i)=>e.dataset.k? (kids[i+1]&&kids[i+1].classList.contains('std')&&kids[i+1].dataset.s===e.dataset.k):true);
    return {std:std.length, verses:pane.querySelectorAll('p[data-k]').length, pairs, txt:std[15]&&std[15].textContent, pos:localStorage.getItem('bf.pos')}; });
  ok('folded: 36 std paragraphs in John 3, each right after its verse', r.std===36 && r.verses===36 && r.pairs, JSON.stringify({std:r.std,verses:r.verses,pairs:r.pairs}));
  ok('folded: John 3:16 text', /^하나님이 세상을 이처럼 사랑하셔서/.test(r.txt||''), r.txt);
  ok('folded: position kept (John 3)', /"book":42,"chapter":2/.test(r.pos), r.pos);
  await p.screenshot({path:'std-fold-on.png'});
  const other=await p.evaluate(()=>document.querySelectorAll('#book .chap')[0].querySelectorAll('p.std').length); ok('folded: chapter without std has none', other===0, String(other));
  ok('folded: no errors', errs.length===0, errs.join(';')); await p.close(); }
console.log(fails?('FAILS '+fails):'ALL PASS'); process.exit(0);
