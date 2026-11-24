// 교회 계정 시험 (v75): 설정 › 교회 계정 화면을 아이폰 앱과 같은 경로(앱이 서버 요청을 대신 보냄 · 키체인)로 흉내 내어 확인한다.
// 서버는 이 파일 안의 가짜 Supabase(인증 + rpc + sermons 표)다. 실제 Supabase와 응답 모양이 조금 다를 수 있어 실기기 확인이 필요하다.
import {serve,launch,sleep} from './devlib.mjs';
serve(8932); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};

// ---------------- 가짜 Supabase ----------------
const SB={url:'https://test.supabase.co', key:'anon-test-key'};
const S={users:{}, at:{}, rt:{}, churches:[], mem:{}, sermons:[], confirm:true, log:[], n:0};
const uid=()=>'00000000-0000-4000-8000-'+String(++S.n).padStart(12,'0');
const tok=(u,exp=3600)=>{ const at='at-'+(++S.n), rt='rt-'+(++S.n); S.at[at]=u.id; S.rt[rt]=u.id; return {access_token:at, refresh_token:rt, expires_in:exp, expires_at:Math.floor(Date.now()/1000)+exp, token_type:'bearer', user:{id:u.id, email:u.email}}; };
const J=(status,obj)=>({result:'ok', status, body: obj===undefined?'':JSON.stringify(obj)});
const E=(status,code,msg)=>J(status,{code:status,error_code:code,msg});
const PG=(status,code,message)=>J(status,{code,message,details:null,hint:null});
function bundle(u){ const m=S.mem[u]; if(!m) return {church:null,items:[]}; const c=S.churches.find(x=>x.id===m.church);
  return {church:{id:c.id,name:c.name,status:c.status,role:m.role,invite_code:(m.role==='admin'&&c.status==='active')?c.code:null},
    items:c.status!=='active'?[]:S.sermons.filter(s=>s.church_id===c.id).map(s=>({id:s.id,yt:s.yt_id,bk:s.bk,c1:s.c1,v1:s.v1,c2:s.c2,v2:s.v2,title:s.title,preacher:s.preacher,date:s.preached_on,t:s.start_sec}))}; }
function leave(u){ const m=S.mem[u]; if(!m) return null; const others=Object.entries(S.mem).filter(([k,v])=>v.church===m.church&&k!==u);
  if(m.role==='admin' && others.length && !others.some(([,v])=>v.role==='admin')) return 'last admin';
  delete S.mem[u]; if(!others.length){ S.churches=S.churches.filter(c=>c.id!==m.church); S.sermons=S.sermons.filter(s=>s.church_id!==m.church); } return null; }
async function fakeSb(req){
  const u=new URL(req.url), path=u.pathname+u.search, H=req.headers||{}, body=req.body?JSON.parse(req.body):{};
  S.log.push({method:req.method, path, auth:H.Authorization||'', apikey:H.apikey||'', body, prefer:H.Prefer||''});
  if(u.origin!==SB.url || H.apikey!==SB.key) return J(401,{message:'Invalid API key'});
  if(req.method==='POST' && path==='/auth/v1/signup'){ if(S.users[body.email]) return J(200,{id:uid(),email:body.email}); if((body.password||'').length<6) return E(422,'weak_password','weak');
    const usr={id:uid(),email:body.email,pw:body.password,ok:!S.confirm}; S.users[body.email]=usr; return S.confirm?J(200,{id:usr.id,email:usr.email,confirmation_sent_at:'x'}):J(200,tok(usr)); }
  if(req.method==='POST' && path==='/auth/v1/verify'){ const usr=S.users[body.email]; if(!usr||body.token!=='123456') return E(403,'otp_expired','Token has expired or is invalid');
    if(body.type==='signup'||body.type==='email'){ usr.ok=true; return J(200,tok(usr)); } if(body.type==='recovery') return J(200,tok(usr)); return E(400,'bad','bad type'); }
  if(req.method==='POST' && path==='/auth/v1/token?grant_type=password'){ const usr=S.users[body.email]; if(!usr||usr.pw!==body.password) return E(400,'invalid_credentials','Invalid login credentials'); if(!usr.ok) return E(400,'email_not_confirmed','Email not confirmed'); return J(200,tok(usr)); }
  if(req.method==='POST' && path==='/auth/v1/token?grant_type=refresh_token'){ const id=S.rt[body.refresh_token]; if(!id) return E(400,'refresh_token_not_found','Invalid Refresh Token'); delete S.rt[body.refresh_token]; return J(200,tok(Object.values(S.users).find(x=>x.id===id))); }
  if(req.method==='POST' && (path==='/auth/v1/recover'||path==='/auth/v1/resend')) return J(200,{});
  const bearer=(H.Authorization||'').replace(/^Bearer /,''), me=S.at[bearer];
  if(req.method==='PUT' && path==='/auth/v1/user'){ if(!me) return E(401,'bad_jwt','bad'); const usr=Object.values(S.users).find(x=>x.id===me); usr.pw=body.password; return J(200,{id:me,email:usr.email}); }
  if(req.method==='POST' && path==='/auth/v1/logout'){ delete S.at[bearer]; return J(204); }
  if(!me) return J(401,{code:'PGRST301',message:'JWT expired'});
  if(req.method==='POST' && path==='/rest/v1/rpc/my_church_bundle') return J(200,bundle(me));
  if(req.method==='POST' && path==='/rest/v1/rpc/request_church'){ if(S.mem[me]) return PG(400,'P0001','already in a church'); const c={id:uid(),name:body.p_name,status:'pending',code:'ABCD2345'}; S.churches.push(c); S.mem[me]={church:c.id,role:'admin'}; return J(200,{id:c.id,name:c.name,status:c.status}); }
  if(req.method==='POST' && path==='/rest/v1/rpc/join_church'){ if(S.mem[me]) return PG(400,'P0001','already in a church'); const code=String(body.p_code||'').replace(/[^0-9A-Za-z]/g,'').toUpperCase(); const c=S.churches.find(x=>x.code===code&&x.status==='active'); if(!c) return PG(400,'P0001','invalid code'); S.mem[me]={church:c.id,role:'member'}; return J(200,[{church_id:c.id,church_name:c.name}]); }
  if(req.method==='POST' && path==='/rest/v1/rpc/leave_church'){ const e=leave(me); return e?PG(400,'P0001',e):J(204); }
  if(req.method==='POST' && path==='/rest/v1/rpc/delete_my_account'){ const e=leave(me); if(e) return PG(400,'P0001',e); const usr=Object.values(S.users).find(x=>x.id===me); delete S.users[usr.email]; Object.keys(S.at).forEach(k=>{if(S.at[k]===me) delete S.at[k];}); return J(204); }
  if(req.method==='POST' && path==='/rest/v1/sermons'){ const m=S.mem[me], c=m&&S.churches.find(x=>x.id===m.church); if(!m||m.role!=='admin'||c.status!=='active'||body.church_id!==c.id) return PG(403,'42501','new row violates row-level security policy for table "sermons"');
    if(!/^[\w-]{11}$/.test(body.yt_id)) return PG(400,'23514','check constraint'); S.sermons.push(Object.assign({id:uid()},body)); return J(201); }
  if(req.method==='DELETE' && path.startsWith('/rest/v1/sermons?id=eq.')){ const id=path.split('eq.')[1], m=S.mem[me]; if(m&&m.role==='admin') S.sermons=S.sermons.filter(s=>!(s.id===id&&s.church_id===m.church)); return J(204); }
  return J(404,{message:'not found '+path});
}

// ---------------- 앱 열기 (아이폰 앱 흉내: ?native=1 + 메시지 다리 + 키체인) ----------------
const bridge=(cfg)=>{ window.__msgs=[];
  const kc=()=>{ try{return JSON.parse(sessionStorage.getItem('kc')||'{}');}catch(e){return {};} }, kcSet=(o)=>sessionStorage.setItem('kc',JSON.stringify(o));
  const reply=(r)=>setTimeout(()=>window.bfMail(r),5);
  window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m);
    if(m.http){ window.fakeSb(m.http).then(r=>reply(Object.assign({id:m.id},r))); return; }
    if(m.kc){ const o=kc(); if(m.kc==='get') reply({id:m.id,result:'ok',v:o[m.k]||''}); else { if(m.kc==='set') o[m.k]=m.v; else delete o[m.k]; kcSet(o); reply({id:m.id,result:'ok'}); } }
  }}}};
  const f0=window.fetch; window.fetch=(u,o)=>String(u)==='sb.json'?Promise.resolve(new Response(JSON.stringify(cfg),{status:200,headers:{'Content-Type':'application/json'}})):f0(u,o);
  if(!sessionStorage.getItem('s')){ sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:61,chapter:0,verse:1})); }
};
async function open(cfg, w=466, h=678){
  const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.exposeFunction('fakeSb',fakeSb);
  await p.evaluateOnNewDocument(bridge,cfg);
  await p.goto('http://localhost:8932/index.html?native=1'); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1200);
  return {p,errs};
}
const msg=(p)=>p.evaluate(()=>(document.querySelector('#ch-msg')||{}).textContent||'');
const click=async(p,sel,wait=350)=>{ await p.evaluate((s)=>document.querySelector(s).click(),sel); await sleep(wait); };
const type=async(p,sel,v)=>{ await p.evaluate((s,v)=>{const x=document.querySelector(s); x.value=v; x.dispatchEvent(new Event('input',{bubbles:true}));},sel,v); };
const openChurch=async(p)=>{ await p.evaluate(()=>document.querySelector('#btn-settings').click()); await sleep(400); await click(p,'#go-ch',500); };
const kcSess=(p)=>p.evaluate(()=>{try{return JSON.parse(JSON.parse(sessionStorage.getItem('kc')||'{}').session||'null');}catch(e){return null;}});

// ---- 1. 관리자: 가입(메일 코드) → 개설 신청 → 승인 → 영상 넣기·지우기 ----
{ const {p,errs}=await open(SB);
  await p.evaluate(()=>document.querySelector('#btn-settings').click()); await sleep(400);
  const sub=await p.evaluate(()=>document.querySelector('#go-ch').textContent);
  ok('settings has a 교회 계정 row (logged out hint)', /교회 계정/.test(sub) && /로그인하면/.test(sub), sub);
  await click(p,'#go-ch',500);
  ok('logged out: email/password form with login·signup·forgot', await p.evaluate(()=>!!document.querySelector('#ch-email')&&!!document.querySelector('#ch-pw')&&!!document.querySelector('#ch-login')&&!!document.querySelector('#ch-signup')&&!!document.querySelector('#ch-forgot')));
  ok('inputs are 16px (no iPhone zoom on focus)', await p.evaluate(()=>getComputedStyle(document.querySelector('#ch-email')).fontSize==='16px'));
  await p.screenshot({path:'church1-login.png'});
  await type(p,'#ch-email','admin@example.com'); await type(p,'#ch-pw','123');
  await click(p,'#ch-signup');
  ok('short password is refused before any request', /6자 이상/.test(await msg(p)) && !S.log.some(l=>l.path==='/auth/v1/signup'), await msg(p));
  await type(p,'#ch-pw','pass1234'); await click(p,'#ch-signup',600);
  ok('signup with email confirmation → 6-digit code screen', await p.evaluate(()=>!!document.querySelector('#ch-code')&&!!document.querySelector('#ch-verify')), await msg(p));
  ok('server requests go through the app bridge with apikey (no Authorization for signup)', (()=>{const l=S.log.find(x=>x.path==='/auth/v1/signup'); return l&&l.apikey===SB.key&&!l.auth;})(), JSON.stringify(S.log.slice(-1)));
  await type(p,'#ch-code','000000'); await click(p,'#ch-verify',600);
  ok('wrong code → Korean message', /코드가 틀렸거나/.test(await msg(p)), await msg(p));
  await type(p,'#ch-code','123 456'); await click(p,'#ch-verify',800);
  const s1=await kcSess(p);
  ok('right code → logged in, session stored in the keychain (not localStorage)', !!s1 && /^at-/.test(s1.at) && s1.email==='admin@example.com' && await p.evaluate(()=>!localStorage.getItem('bf.session')), JSON.stringify(s1));
  ok('logged in without a church: join + request forms, logout, delete account', await p.evaluate(()=>['#ch-join','#ch-req','#ch-logout','#ch-delete'].every(s=>document.querySelector(s))));
  await type(p,'#ch-code','ZZZZ9999'); await click(p,'#ch-join',600);
  ok('bad invite code → mapped message', /초대코드가 맞지 않거나/.test(await msg(p)), await msg(p));
  await type(p,'#ch-name','한사람교회'); await click(p,'#ch-req',800);
  ok('church request → pending screen', await p.evaluate(()=>/승인을 기다리는 중/.test(document.querySelector('#sheet-body').textContent)) && /개설 신청을 보냈습니다/.test(await msg(p)), await msg(p));
  ok('rest calls carry Bearer token + apikey', (()=>{const l=S.log.find(x=>x.path==='/rest/v1/rpc/request_church'); return l&&l.auth==='Bearer '+s1.at&&l.apikey===SB.key&&l.body.p_name==='한사람교회';})());
  S.churches[0].status='active';   // 운영자 승인
  await click(p,'#ch-sync',800);
  const inv=await p.evaluate(()=>(document.querySelector('#ch-invite')||{}).textContent);
  ok('after approval + refresh: admin sees invite code and the manage row', inv==='ABCD2345' && await p.evaluate(()=>!!document.querySelector('#ch-admin')), inv);
  await click(p,'#ch-admin',500);
  await type(p,'#ch-yt','https://youtu.be/AAAAAAAAAA1?si=xyz&t=1m35s'); await type(p,'#ch-ref','요일 1:1-4'); await type(p,'#ch-title','생명의 말씀'); await type(p,'#ch-preacher','김목사'); await type(p,'#ch-date','2026-11-22');
  await click(p,'#ch-add',900);
  const ins=S.log.find(x=>x.method==='POST'&&x.path==='/rest/v1/sermons');
  ok('add sermon: parses youtu.be + t=1m35s, 요일 1:1-4 → 1jn 1:1-1:4, sends church id·preacher·date', !!ins && ins.body.yt_id==='AAAAAAAAAA1' && ins.body.start_sec===95 && ins.body.bk==='1jn' && ins.body.c1===1&&ins.body.v1===1&&ins.body.c2===1&&ins.body.v2===4 && ins.body.preacher==='김목사' && ins.body.preached_on==='2026-11-22' && ins.body.church_id===S.churches[0].id, JSON.stringify(ins&&ins.body));
  ok('after adding: message, list shows 1, device cache has it', /넣었습니다/.test(await msg(p)) && await p.evaluate(()=>document.querySelectorAll('.ch-srow').length===1 && JSON.parse(localStorage.getItem('bf.sermons')).items.length===1), await msg(p));
  for (const [u,want] of [['https://www.youtube.com/watch?v=BBBBBBBBBB2&t=30','BBBBBBBBBB2/30'],['youtube.com/live/CCCCCCCCCC3?feature=share','CCCCCCCCCC3/null'],['https://m.youtube.com/shorts/DDDDDDDDDD4','DDDDDDDDDD4/null']]) {
    await type(p,'#ch-yt',u); await type(p,'#ch-ref','요한일서 1장 5-10절'); await type(p,'#ch-title','x'); await click(p,'#ch-add',700);
    const l=S.log.filter(x=>x.method==='POST'&&x.path==='/rest/v1/sermons').pop(); ok('youtube url form: '+u, l.body.yt_id+'/'+l.body.start_sec===want && l.body.v1===5 && l.body.v2===10, l.body.yt_id+'/'+l.body.start_sec); }
  await type(p,'#ch-yt','https://example.com/watch?v=AAAAAAAAAA1'); await type(p,'#ch-ref','요일 1:1'); await type(p,'#ch-title','x'); await click(p,'#ch-add',500);
  ok('non-YouTube url is refused locally', /유튜브 영상 주소를 확인/.test(await msg(p)), await msg(p));
  await type(p,'#ch-yt','https://youtu.be/AAAAAAAAAA1'); await type(p,'#ch-ref','없는책 1:1'); await click(p,'#ch-add',500);
  ok('unreadable passage is refused locally', /설교 본문을 읽지 못했습니다/.test(await msg(p)), await msg(p));
  await p.screenshot({path:'church1-admin.png'});
  const n0=await p.evaluate(()=>document.querySelectorAll('.ch-srow').length);
  await click(p,'.ch-srow [data-del]',200);
  ok('delete needs a second tap', await p.evaluate(()=>document.querySelectorAll('.ch-srow').length)===n0 && await p.evaluate(()=>document.querySelector('.ch-srow [data-del]').textContent==='한 번 더'));
  await click(p,'.ch-srow [data-del]',900);
  ok('second tap deletes (list shrinks by one)', await p.evaluate(()=>document.querySelectorAll('.ch-srow').length)===n0-1, String(n0));
  // 접근 토큰 만료 → 갱신 토큰으로 새로 받아 이어서 처리
  await p.evaluate(()=>{const o=JSON.parse(sessionStorage.getItem('kc')); const s=JSON.parse(o.session); s.exp=Date.now()-1000; o.session=JSON.stringify(s); sessionStorage.setItem('kc',JSON.stringify(o));});
  await p.reload(); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(2500);
  const ref=S.log.filter(x=>x.path==='/auth/v1/token?grant_type=refresh_token');
  const s2=await kcSess(p);
  ok('app start with an expired token: refreshes, stores the new session, then syncs', ref.length===1 && s2 && s2.at!==s1.at && s2.exp>Date.now() && S.log.slice(-1)[0].path==='/rest/v1/rpc/my_church_bundle' && S.log.slice(-1)[0].auth==='Bearer '+s2.at, JSON.stringify(S.log.slice(-2).map(x=>x.path)));
  ok('no page errors (admin)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 2. 성도: 메일 확인 없는 서버 → 바로 로그인 → 초대코드 가입 → 영상이 본문 옆에 → 나가기 → 로그아웃 ----
S.confirm=false;
{ const {p,errs}=await open(SB,951,669);
  await openChurch(p);
  await type(p,'#ch-email','member@example.com'); await type(p,'#ch-pw','member99'); await click(p,'#ch-signup',900);
  ok('signup on a server without email confirmation logs in at once', !!(await kcSess(p)) && await p.evaluate(()=>!!document.querySelector('#ch-join')), await msg(p));
  await type(p,'#ch-code','abcd-2345'); await click(p,'#ch-join',900);
  ok('join with lowercase/dashed code → member screen, no admin row, sermons cached', /가입했습니다/.test(await msg(p)) && await p.evaluate(()=>!document.querySelector('#ch-admin') && !document.querySelector('#ch-invite') && JSON.parse(localStorage.getItem('bf.sermons')).items.length>=1), await msg(p));
  await p.evaluate(()=>document.querySelector('#sheet-close').click()); await sleep(900);
  const tabs=await p.evaluate(()=>[...document.querySelectorAll('.yt-tab')].map(t=>t.dataset.yt));
  ok('after joining, 1 John 1 shows the church video tab(s) in the spread view', tabs.length>=1, JSON.stringify(tabs));
  await p.evaluate(()=>document.querySelector('#btn-settings').click()); await sleep(400);
  ok('settings row shows the church name', /한사람교회/.test(await p.evaluate(()=>document.querySelector('#go-ch').textContent)));
  await click(p,'#go-ch',500);
  await click(p,'#ch-leave',200); await click(p,'#ch-leave',900);
  ok('leave (two taps) → no church; video tabs gone', /나왔습니다/.test(await msg(p)) && await p.evaluate(()=>JSON.parse(localStorage.getItem('bf.sermons')).church===null && document.querySelectorAll('.yt-tab').length===0), await msg(p));
  await click(p,'#ch-logout',700);
  ok('logout clears the keychain session and shows the login form', !(await kcSess(p)) && await p.evaluate(()=>!!document.querySelector('#ch-login')) && S.log.slice(-1)[0].path==='/auth/v1/logout', await msg(p));
  await type(p,'#ch-email','member@example.com'); await type(p,'#ch-pw','wrongpw'); await click(p,'#ch-login',700);
  ok('wrong password → Korean message', /이메일 또는 비밀번호가 맞지 않습니다/.test(await msg(p)), await msg(p));
  // 비밀번호 재설정: 코드 + 새 비밀번호
  await click(p,'#ch-forgot',400);
  ok('forgot → email prefilled', await p.evaluate(()=>document.querySelector('#ch-email').value)==='member@example.com');
  await click(p,'#ch-send',700);
  await type(p,'#ch-code','123456'); await type(p,'#ch-pw','newpass1'); await click(p,'#ch-verify',900);
  ok('reset: verify recovery code → set new password → logged in', !!(await kcSess(p)) && S.users['member@example.com'].pw==='newpass1' && S.log.some(x=>x.path==='/auth/v1/verify'&&x.body.type==='recovery'), await msg(p));
  // 계정 삭제
  await click(p,'#ch-delete',200); await click(p,'#ch-delete',900);
  ok('delete account (two taps) → server user gone, logged out here', !S.users['member@example.com'] && !(await kcSess(p)) && /계정을 지웠습니다/.test(await msg(p)), await msg(p));
  ok('no page errors (member)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 3. 관리자는 성도가 남아 있으면 나가거나 계정을 지울 수 없다 (메시지) ----
{ const {p,errs}=await open(SB);
  const adm=Object.values(S.users).find(u=>u.email==='admin@example.com');
  S.mem['someone']={church:S.churches[0].id,role:'member'};
  await openChurch(p);
  await type(p,'#ch-email','admin@example.com'); await type(p,'#ch-pw','pass1234'); await click(p,'#ch-login',900);
  await click(p,'#ch-delete',200); await click(p,'#ch-delete',900);
  ok('last admin with members: delete refused with a clear message, still logged in', /마지막 관리자/.test(await msg(p)) && !!(await kcSess(p)) && !!S.users['admin@example.com'], await msg(p));
  ok('no page errors (last admin)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 4. 서버 설정이 없는 빌드(sb.json 빈 값) ----
{ const {p,errs}=await open({url:'',key:''});
  await openChurch(p);
  ok('empty sb.json → "서버 설정 안 됨" message, no form, no bridge http', /아직 이 앱에 설정되지 않았습니다/.test(await p.evaluate(()=>document.querySelector('#sheet-body').textContent)) && !(await p.evaluate(()=>document.querySelector('#ch-email'))) && !(await p.evaluate(()=>window.__msgs.some(m=>m.http||m.kc))));
  ok('no page errors (no config)', errs.length===0, JSON.stringify(errs)); await p.close(); }
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
