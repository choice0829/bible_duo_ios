// 내 계정 시험 (v77): 머리줄 사람 아이콘 → 내 계정. 아이폰 앱과 같은 경로(앱이 서버 요청을 대신 보냄 · 키체인)로 흉내 낸다.
// 서버는 이 파일 안의 가짜 Supabase(인증 + rpc + profiles + proofs 보관함 + sermons)다. 실제 Supabase와 응답 모양이 조금 다를 수 있어 실기기 확인이 필요하다.
import {serve,launch,sleep} from './devlib.mjs';
import fs from 'fs'; import path from 'path'; import os from 'os';
serve(8932); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'acct1-'));
const PHOTO=path.resolve('fixtures/testphoto.jpg'), PDF=path.join(tmp,'proof.pdf'), TXT=path.join(tmp,'note.txt');
fs.writeFileSync(PDF,'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'); fs.writeFileSync(TXT,'hello');

// ---------------- 가짜 Supabase ----------------
const SB={url:'https://test.supabase.co', key:'anon-test-key'};
const S={users:{}, at:{}, rt:{}, profiles:{}, churches:[], mem:{}, sermons:[], files:{}, ops:new Set(), confirm:true, log:[], n:0};
const uid=()=>'00000000-0000-4000-8000-'+String(++S.n).padStart(12,'0');
const tok=(u,exp=3600)=>{ const at='at-'+(++S.n), rt='rt-'+(++S.n); S.at[at]=u.id; S.rt[rt]=u.id; return {access_token:at, refresh_token:rt, expires_in:exp, expires_at:Math.floor(Date.now()/1000)+exp, user:{id:u.id, email:u.email}}; };
const J=(status,obj)=>({result:'ok', status, body: obj===undefined?'':JSON.stringify(obj)});
const E=(status,code,msg)=>J(status,{code:status,error_code:code,msg});
const PG=(status,code,message)=>J(status,{code,message,details:null,hint:null});
const userById=(id)=>Object.values(S.users).find(x=>x.id===id);
function account(me){ const p=S.profiles[me]||null, m=S.mem[me], c=m&&S.churches.find(x=>x.id===m.church);
  const op=S.ops.has(me);
  return {operator:op, pending_count:op?Object.values(S.profiles).filter(x=>x.church_status==='pending').length:0, profile:p&&{name:p.name,gender:p.gender,birth:p.birth,phone:p.phone,church_name:p.church_name,church_status:p.church_status,reject_reason:p.reject_reason,proof_path:p.proof_path},
    church:c?{id:c.id,name:c.name,role:m.role}:null,
    items:c?S.sermons.filter(s=>s.church_id===c.id).map(s=>({id:s.id,yt:s.yt_id,bk:s.bk,c1:s.c1,v1:s.v1,c2:s.c2,v2:s.v2,title:s.title,preacher:s.preacher,date:s.preached_on,t:s.start_sec})):[]}; }
function approve(email, admin=false){ const u=S.users[email], p=S.profiles[u.id]; let c=S.churches.find(x=>x.name===p.church_name); if(!c){ c={id:uid(),name:p.church_name}; S.churches.push(c); }
  S.mem[u.id]={church:c.id,role:admin?'admin':'member'}; p.church_status='approved'; p.reject_reason=null; }
async function fakeSb(req){
  const u=new URL(req.url), p=u.pathname+u.search, H=req.headers||{};
  const body=req.bodyB64!==undefined?null:(req.body?JSON.parse(req.body):{});
  S.log.push({method:req.method, path:p, auth:H.Authorization||'', apikey:H.apikey||'', ctype:H['Content-Type']||'', body, b64len:req.bodyB64?req.bodyB64.length:0});
  if(u.origin!==SB.url || H.apikey!==SB.key) return J(401,{message:'Invalid API key'});
  if(req.method==='POST' && p==='/auth/v1/signup'){ if(S.users[body.email]) return J(200,{id:uid(),email:body.email}); if((body.password||'').length<6) return E(422,'weak_password','weak');
    const usr={id:uid(),email:body.email,pw:body.password,ok:!S.confirm,created:Date.now()}; S.users[body.email]=usr; return S.confirm?J(200,{id:usr.id,email:usr.email}):J(200,tok(usr)); }
  if(req.method==='POST' && p==='/auth/v1/verify'){ const usr=S.users[body.email]; if(!usr||body.token!=='123456') return E(403,'otp_expired','Token has expired or is invalid'); usr.ok=true; return J(200,tok(usr)); }
  if(req.method==='POST' && p==='/auth/v1/token?grant_type=password'){ const usr=S.users[body.email]; if(!usr||usr.pw!==body.password) return E(400,'invalid_credentials','Invalid login credentials'); if(!usr.ok) return E(400,'email_not_confirmed','Email not confirmed'); return J(200,tok(usr)); }
  if(req.method==='POST' && p==='/auth/v1/token?grant_type=refresh_token'){ const id=S.rt[body.refresh_token]; if(!id) return E(400,'refresh_token_not_found','x'); delete S.rt[body.refresh_token]; return J(200,tok(userById(id))); }
  if(req.method==='POST' && (p==='/auth/v1/recover'||p==='/auth/v1/resend')) return J(200,{});
  const me=S.at[(H.Authorization||'').replace(/^Bearer /,'')];
  if(req.method==='PUT' && p==='/auth/v1/user'){ if(!me) return E(401,'bad_jwt','bad'); userById(me).pw=body.password; return J(200,{id:me}); }
  if(req.method==='POST' && p==='/auth/v1/logout') return J(204);
  if(!me) return J(401,{code:'PGRST301',message:'JWT expired'});
  // 보관함: 운영자 서명 주소
  const sg=p.match(/^\/storage\/v1\/object\/sign\/proofs\/(.+)$/);
  if(sg){ const fp=decodeURIComponent(sg[1]); if(!(S.ops.has(me)||fp.split('/')[0]===me)||!S.files[fp]) return J(400,{statusCode:'404',error:'not_found',message:'Object not found'}); return J(200,{signedURL:'/object/sign/proofs/'+fp+'?token=tk'}); }
  // 운영자 함수
  if(p.startsWith('/rest/v1/rpc/op_')){ if(!S.ops.has(me)) return PG(400,'P0001','operator only');
    if(p==='/rest/v1/rpc/op_list_accounts'){ const rows=Object.values(S.users).map(u=>{const pr=S.profiles[u.id], m=S.mem[u.id], c=m&&S.churches.find(x=>x.id===m.church);
        return {id:u.id,email:u.email,created_at:new Date(u.created||0).toISOString(),name:pr&&pr.name,gender:pr&&pr.gender,birth:pr&&pr.birth,phone:pr&&pr.phone,church_name:pr&&pr.church_name,church_status:pr?pr.church_status:'noprofile',reject_reason:pr&&pr.reject_reason,proof_path:pr&&pr.proof_path,requested_at:pr&&pr.church_status==='pending'?new Date().toISOString():null,church:c?c.name:null,role:m?m.role:null,operator:S.ops.has(u.id)};});
      return J(200, body.p_kind==='pending'?rows.filter(r=>r.church_status==='pending'):rows.sort((a,b)=>b.created_at.localeCompare(a.created_at))); }
    const target=Object.values(S.users).find(u=>u.id===body.p_uid), pr=target&&S.profiles[target.id];
    if(p==='/rest/v1/rpc/op_approve'){ pr.church_name=body.p_church_name||pr.church_name; approve(target.email, !!body.p_admin); return J(200,'승인: '+pr.church_name+(body.p_admin?' (관리자)':'')); }
    if(p==='/rest/v1/rpc/op_reject'){ if(pr.church_status!=='pending') return J(200,'승인 대기 중인 신청이 없습니다'); pr.church_status='rejected'; pr.reject_reason=body.p_reason; return J(200,'반려했습니다'); }
    if(p==='/rest/v1/rpc/op_set_admin'){ const m=S.mem[target.id]; if(!m) return J(200,'승인된 소속이 없습니다'); m.role=body.p_admin?'admin':'member'; return J(200, body.p_admin?'교회 관리자로 지정했습니다':'교회 관리자에서 해제했습니다'); } }
  // 보관함
  const sm=p.match(/^\/storage\/v1\/object\/proofs\/(.+)$/);
  if(sm){ const fp=decodeURIComponent(sm[1]);
    if(fp.split('/')[0]!==me) return J(400,{statusCode:'403',error:'Unauthorized',message:'new row violates row-level security policy'});
    if(req.method==='POST'){ if(!['image/jpeg','image/png','application/pdf'].includes(H['Content-Type'])) return J(415,{statusCode:'415',error:'invalid_mime_type',message:'mime type not supported'}); S.files[fp]={type:H['Content-Type'],len:req.bodyB64.length}; return J(200,{Key:'proofs/'+fp}); }
    if(req.method==='DELETE'){ delete S.files[fp]; return J(200,[{name:fp}]); } }
  if(req.method==='POST' && p==='/rest/v1/rpc/my_account') return J(200,account(me));
  if(req.method==='POST' && p==='/rest/v1/rpc/save_my_profile'){ const ex=S.profiles[me]; if(!ex && !body.p_consent) return PG(400,'P0001','consent required');
    if(body.p_birth && !/^\d{8}$/.test(body.p_birth)) return PG(400,'P0001','bad birth');
    S.profiles[me]=Object.assign(ex||{church_status:'none',church_name:null,proof_path:null,reject_reason:null},{name:body.p_name,gender:body.p_gender,birth:body.p_birth,phone:body.p_phone}); return J(204); }
  if(req.method==='POST' && p==='/rest/v1/rpc/request_church_membership'){ const pr=S.profiles[me]; if(!pr) return PG(400,'P0001','profile required'); if(S.mem[me]) return PG(400,'P0001','already in a church');
    if(!String(body.p_proof_path).startsWith(me+'/')||!S.files[body.p_proof_path]) return PG(400,'P0001','proof required');
    Object.assign(pr,{church_name:body.p_church_name,church_status:'pending',proof_path:body.p_proof_path,reject_reason:null}); return J(204); }
  if(req.method==='POST' && p==='/rest/v1/rpc/clear_my_proof'){ const pr=S.profiles[me]; if(pr&&pr.church_status!=='pending') pr.proof_path=null; return J(204); }
  if(req.method==='POST' && p==='/rest/v1/rpc/leave_church'){ delete S.mem[me]; if(S.profiles[me]) S.profiles[me].church_status='none'; return J(204); }
  if(req.method==='POST' && p==='/rest/v1/rpc/delete_my_account'){ const usr=userById(me); delete S.users[usr.email]; delete S.profiles[me]; delete S.mem[me]; Object.keys(S.at).forEach(k=>{if(S.at[k]===me) delete S.at[k];}); return J(204); }
  if(req.method==='POST' && p==='/rest/v1/sermons'){ const m=S.mem[me]; if(!m||m.role!=='admin'||body.church_id!==m.church) return PG(403,'42501','new row violates row-level security policy for table "sermons"'); S.sermons.push(Object.assign({id:uid()},body)); return J(201); }
  if(req.method==='DELETE' && p.startsWith('/rest/v1/sermons?id=eq.')){ const id=p.split('eq.')[1]; S.sermons=S.sermons.filter(s=>s.id!==id); return J(204); }
  return J(404,{message:'not found '+p});
}

// ---------------- 앱 열기 (아이폰 앱 흉내: ?native=1 + 메시지 다리 + 키체인) ----------------
const bridge=(cfg)=>{ window.__msgs=[];
  const kc=()=>{ try{return JSON.parse(sessionStorage.getItem('kc')||'{}');}catch(e){return {};} }, kcSet=(o)=>sessionStorage.setItem('kc',JSON.stringify(o));
  const reply=(r)=>setTimeout(()=>window.bfMail(r),5);
  window.webkit={messageHandlers:{bf:{postMessage:(m)=>{ window.__msgs.push(m.http?{http:{url:m.http.url,method:m.http.method,bin:!!m.http.bodyB64}}:m);
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
  await p.setRequestInterception(true);
  p.on('request',(rq)=>{ if(rq.url().startsWith(SB.url+'/storage/v1/object/sign/')){ S.signedFetched=(S.signedFetched||0)+1; rq.respond({status:200,contentType:'image/jpeg',body:fs.readFileSync(PHOTO)}); } else rq.continue(); });
  await p.evaluateOnNewDocument(bridge,cfg);
  await p.goto('http://localhost:8932/index.html?native=1'); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1200);
  return {p,errs};
}
const msg=(p)=>p.evaluate(()=>(document.querySelector('#ch-msg')||{}).textContent||'');
const body=(p)=>p.evaluate(()=>document.querySelector('#sheet-body').textContent);
const click=async(p,sel,wait=350)=>{ await p.evaluate((s)=>document.querySelector(s).click(),sel); await sleep(wait); };
const type=async(p,sel,v)=>{ await p.evaluate((s,v)=>{const x=document.querySelector(s); x.value=v; x.dispatchEvent(new Event('input',{bubbles:true}));},sel,v); };
const check=(p,sel)=>p.evaluate((s)=>{document.querySelector(s).checked=true;},sel);
const upload=async(p,file,wait=900)=>{ const el=await p.$('#ch-proof'); await el.uploadFile(file); await sleep(wait); };
const openAcct=async(p)=>{ await p.evaluate(()=>document.querySelector('#btn-acct').click()); await sleep(600); };
const kcSess=(p)=>p.evaluate(()=>{try{return JSON.parse(JSON.parse(sessionStorage.getItem('kc')||'{}').session||'null');}catch(e){return null;}});
const fillSignup=async(p,o)=>{ await type(p,'#ch-email',o.email); await type(p,'#ch-pw',o.pw); await type(p,'#ch-pw2',o.pw2||o.pw); await type(p,'#ch-name',o.name||'');
  if(o.gender) await click(p,'#ch-gender [data-g="'+o.gender+'"]',100); await type(p,'#ch-birth',o.birth||''); await type(p,'#ch-phone',o.phone||''); await type(p,'#ch-church',o.church||''); };

// ---- 1. 머리줄: 사람 아이콘, 설정 안의 교회 계정 줄은 없음 ----
{ const {p,errs}=await open(SB);
  const icons=await p.evaluate(()=>[...document.querySelectorAll('.menu-row > button')].map(x=>x.id));
  ok('header has 8 icons with 내 계정 (person) before settings', JSON.stringify(icons)==='["btn-search","btn-hl","btn-notes","btn-card","btn-map","btn-ask","btn-acct","btn-settings"]', icons.join(','));
  ok('person icon has a label', await p.evaluate(()=>document.querySelector('#btn-acct').getAttribute('aria-label')==='내 계정' && !!document.querySelector('#btn-acct svg circle')));
  await p.evaluate(()=>document.querySelector('#btn-settings').click()); await sleep(400);
  ok('settings no longer has a 교회 계정 row', await p.evaluate(()=>!document.querySelector('#go-ch') && !/교회 계정/.test(document.querySelector('#sheet-body').textContent)));
  await p.evaluate(()=>document.querySelector('#sheet-close').click()); await sleep(300);
  await openAcct(p);
  ok('logged out: title 내 계정, login form + 회원가입 + basic-features note', await p.evaluate(()=>document.querySelector('#sheet-title').textContent==='내 계정' && !!document.querySelector('#ch-login') && !!document.querySelector('#ch-go-signup')) && /기본 기능은 모두/.test(await body(p)));
  await p.screenshot({path:'acct1-login.png'});
  // ---- 2. 회원가입 폼 ----
  await click(p,'#ch-go-signup',500);
  const f=await p.evaluate(()=>['#ch-email','#ch-pw','#ch-pw2','#ch-name','#ch-gender','#ch-birth','#ch-phone','#ch-church','#ch-proof','#ch-agree1','#ch-agree2','#ch-submit'].map(s=>!!document.querySelector(s)));
  ok('signup form: id(email)·pw·pw2·name·gender·birth·phone·church·proof·2 consents', f.every(Boolean), JSON.stringify(f));
  ok('optional fields are marked (선택), required ones with *', /성별 \(선택\)/.test(await body(p)) && /생년월일 \(선택/.test(await body(p)) && /전화번호 \(선택\)/.test(await body(p)) && /이름 \*/.test(await body(p)) && /소속 교회 \*/.test(await body(p)) && /교인 증빙 서류 \*/.test(await body(p)));
  ok('proof input accepts images and PDF', await p.evaluate(()=>document.querySelector('#ch-proof').accept==='image/*,application/pdf'));
  await fillSignup(p,{email:'kim@example.com',pw:'pass1234',name:'김하나',church:'한사람교회'});
  await click(p,'#ch-submit',500);
  ok('without a proof file → asks for the document (no server call)', /증빙 서류/.test(await msg(p)) && !S.log.some(l=>l.path==='/auth/v1/signup'), await msg(p));
  await upload(p,TXT);
  ok('non-image/PDF file is refused', /사진\(JPG·PNG\) 또는 PDF만/.test(await msg(p)), await msg(p));
  await upload(p,PHOTO,1500);
  ok('photo chosen: name+size shown, thumbnail, typed fields (incl. passwords) kept', /testphoto\.jpg · \d+KB/.test(await p.evaluate(()=>document.querySelector('#ch-proof-name').textContent)) && await p.evaluate(()=>!!document.querySelector('.ch-thumb') && document.querySelector('#ch-name').value==='김하나' && document.querySelector('#ch-church').value==='한사람교회' && document.querySelector('#ch-email').value==='kim@example.com' && document.querySelector('#ch-pw').value==='pass1234' && document.querySelector('#ch-pw2').value==='pass1234'), await msg(p));
  await click(p,'#ch-submit',500);
  ok('consents unchecked → asks for both', /필수 동의 두 가지/.test(await msg(p)), await msg(p));
  await check(p,'#ch-agree1'); await check(p,'#ch-agree2');
  await type(p,'#ch-birth','19901340'); await click(p,'#ch-submit',400);
  ok('bad birth (8 digits but not a date) refused', /생년월일은 8자리/.test(await msg(p)), await msg(p));
  await type(p,'#ch-birth','19900101'); await type(p,'#ch-phone','12-3'); await click(p,'#ch-submit',400);
  ok('bad phone refused', /전화번호를 확인/.test(await msg(p)), await msg(p));
  await type(p,'#ch-phone','010-1234-5678'); await type(p,'#ch-pw2','different'); await click(p,'#ch-submit',400);
  ok('password confirmation mismatch refused', /비밀번호 확인이 다릅니다/.test(await msg(p)), await msg(p));
  await type(p,'#ch-pw2','pass1234'); await click(p,'#ch-gender [data-g="F"]',100);
  await p.screenshot({path:'acct1-signup.png', fullPage:false});
  await click(p,'#ch-submit',800);
  ok('signup (email confirmation on) → code screen', await p.evaluate(()=>!!document.querySelector('#ch-code')), await msg(p));
  await type(p,'#ch-code','123456'); await click(p,'#ch-verify',2000);
  const me=S.users['kim@example.com'].id, pr=S.profiles[me];
  ok('after code: profile saved with optional fields', pr && pr.name==='김하나' && pr.gender==='F' && pr.birth==='19900101' && pr.phone==='010-1234-5678', JSON.stringify(pr));
  const up=S.log.find(l=>l.method==='POST'&&l.path.startsWith('/storage/v1/object/proofs/'));
  ok('proof uploaded as JPEG into own folder, binary through the app bridge', !!up && up.path.startsWith('/storage/v1/object/proofs/'+me+'/') && up.ctype==='image/jpeg' && up.b64len>1000 && up.auth.startsWith('Bearer '), JSON.stringify(up&&{p:up.path,c:up.ctype,l:up.b64len}));
  ok('church request sent: pending with the uploaded path', pr.church_status==='pending' && pr.church_name==='한사람교회' && !!S.files[pr.proof_path], JSON.stringify(pr));
  ok('session stored in keychain', !!(await kcSess(p)));
  const mainTxt=await body(p);
  ok('main: 내 정보 (이름·아이디·성별·생년월일·전화)', /김하나/.test(mainTxt) && /kim@example\.com/.test(mainTxt) && /여/.test(mainTxt) && /1990\.01\.01/.test(mainTxt) && /010-1234-5678/.test(mainTxt), mainTxt.slice(0,200));
  ok('main: church 한사람교회 with 확인 중 badge and explanation', await p.evaluate(()=>/확인 중/.test(document.querySelector('.ch-badge.wait')?.textContent||'')) && /운영자가 교인 증빙 서류를 확인/.test(mainTxt));
  ok('features: video tab & board locked until church registration', /교회 설교 영상[^]*교회 등록 후/.test(mainTxt) && /교회 게시판[^]*교회 등록 후 · 준비 중/.test(mainTxt) && /가입을 마쳤습니다/.test(await msg(p)), await msg(p));
  ok('v78: role badge for a user without a registered church: 교회 미등록 (no operator/admin badges, no operator menu)', await p.evaluate(()=>[...document.querySelectorAll('.ch-roles .ch-role')].map(x=>x.textContent).join()==='교회 미등록' && !document.querySelector('#ch-op-pending')));
  await p.screenshot({path:'acct1-pending.png'});
  // ---- 3. 운영자 승인(관리자 지정) → 새로 고침: 등록됨, 서류 자동 삭제, 영상 관리 ----
  approve('kim@example.com', true);
  await click(p,'#ch-sync',1200);
  const pr2=S.profiles[me];
  ok('v78: role badge after approval as admin: 교회 관리자', await p.evaluate(()=>[...document.querySelectorAll('.ch-roles .ch-role')].map(x=>x.textContent).join()==='교회 관리자'));
  ok('after approval: 등록됨 badge, 관리자 role, video feature 사용 중', await p.evaluate(()=>!!document.querySelector('.ch-badge.ok')) && /교회 관리자/.test(await body(p)) && /교회 설교 영상[^]*사용 중/.test(await body(p)), await msg(p));
  ok('approved: proof file deleted from storage and path cleared (minimal retention)', Object.keys(S.files).length===0 && pr2.proof_path===null && S.log.some(l=>l.method==='DELETE'&&l.path.startsWith('/storage/v1/object/proofs/')), JSON.stringify(S.files));
  await click(p,'#ch-admin',500);
  await type(p,'#ch-yt','https://youtu.be/AAAAAAAAAA1?t=95'); await type(p,'#ch-ref','요일 1:1-4'); await type(p,'#ch-title','생명의 말씀');
  await click(p,'#ch-add',900);
  ok('admin adds a sermon (1jn 1:1-4, start 95s)', /넣었습니다/.test(await msg(p)) && S.sermons.length===1 && S.sermons[0].bk==='1jn' && S.sermons[0].start_sec===95, await msg(p));
  await p.evaluate(()=>document.querySelector('#sheet-close').click()); await sleep(900);
  ok('approved church: video tab shows on 1 John 1 (spread? no — folded chip)', await p.evaluate(()=>document.querySelectorAll('.yt-chip, .yt-tab').length>=1));
  // 정보 수정
  await openAcct(p); await click(p,'#ch-edit',400);
  ok('edit screen prefilled; email/church not editable here', await p.evaluate(()=>document.querySelector('#ch-name').value==='김하나' && document.querySelector('#ch-birth').value==='19900101' && !document.querySelector('#ch-email') && !document.querySelector('#ch-church')));
  await type(p,'#ch-name','김하나님'); await type(p,'#ch-phone',''); await click(p,'#ch-gender [data-g=""]',100); await click(p,'#ch-save',900);
  ok('edit saves without asking consent again; cleared optional fields become empty', S.profiles[me].name==='김하나님' && S.profiles[me].phone===null && S.profiles[me].gender===null && /저장했습니다/.test(await msg(p)), JSON.stringify(S.profiles[me]));
  ok('no page errors (signup→approve)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 4. 반려 → 다시 신청(PDF) ; 메일 확인 없는 서버 ----
S.confirm=false;
{ const {p,errs}=await open(SB,951,669);
  await openAcct(p); await click(p,'#ch-go-signup',400);
  await fillSignup(p,{email:'lee@example.com',pw:'member99',name:'이둘',church:'둘째교회'});
  await upload(p,PDF,800); await check(p,'#ch-agree1'); await check(p,'#ch-agree2');
  await click(p,'#ch-submit',2000);
  const me=S.users['lee@example.com'].id;
  ok('no-confirmation server: signup logs in at once and finishes registration; PDF uploaded as application/pdf', S.profiles[me]&&S.profiles[me].church_status==='pending' && S.log.some(l=>l.ctype==='application/pdf'), await msg(p));
  ok('optional fields left empty are null', S.profiles[me].gender===null && S.profiles[me].birth===null && S.profiles[me].phone===null, JSON.stringify(S.profiles[me]));
  ok('pending (not approved): no video tabs at all', await p.evaluate(()=>{document.querySelector('#sheet-close').click(); return true;}) && (await sleep(800), await p.evaluate(()=>document.querySelectorAll('.yt-tab, .yt-chip').length===0)));
  Object.assign(S.profiles[me],{church_status:'rejected',reject_reason:'서류가 흐립니다'});
  await openAcct(p); await click(p,'#ch-sync',1200);
  ok('rejected: badge 반려됨 + reason + 교회 등록 신청 button; proof deleted', await p.evaluate(()=>!!document.querySelector('.ch-badge.bad') && !!document.querySelector('#ch-go-church')) && /서류가 흐립니다/.test(await body(p)) && Object.keys(S.files).length===0, await msg(p));
  await click(p,'#ch-go-church',400);
  ok('re-apply screen shows the reason and prefilled church name', /서류가 흐립니다/.test(await body(p)) && await p.evaluate(()=>document.querySelector('#ch-church').value==='둘째교회'));
  await click(p,'#ch-req',300);
  ok('re-apply without a file refused', /증빙 서류/.test(await msg(p)), await msg(p));
  await upload(p,PHOTO,1500); await click(p,'#ch-req',1200);
  ok('re-apply → pending again', S.profiles[me].church_status==='pending' && /신청했습니다/.test(await msg(p)), await msg(p));
  // 로그아웃 → 다시 로그인 → 계정 삭제(서류 파일 먼저 지움)
  await click(p,'#ch-logout',800);
  ok('logout clears keychain and shows login', !(await kcSess(p)) && await p.evaluate(()=>!!document.querySelector('#ch-login')));
  await type(p,'#ch-email','lee@example.com'); await type(p,'#ch-pw','member99'); await click(p,'#ch-login',1200);
  ok('login again → main with pending status', await p.evaluate(()=>!!document.querySelector('.ch-badge.wait')), await msg(p));
  const nfiles=Object.keys(S.files).length;
  await click(p,'#ch-delete',200); await click(p,'#ch-delete',1200);
  ok('delete account: pending proof file deleted first, user gone, logged out', nfiles===1 && Object.keys(S.files).length===0 && !S.users['lee@example.com'] && !(await kcSess(p)) && /계정을 지웠습니다/.test(await msg(p)), await msg(p));
  ok('no page errors (reject/reapply/delete)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 5. 계정만 있고 개인 정보가 없음(코드 확인 뒤 앱이 꺼진 경우) → 마저 입력 ----
{ const usr={id:uid(),email:'park@example.com',pw:'parkpark',ok:true}; S.users[usr.email]=usr;
  const {p,errs}=await open(SB);
  await openAcct(p); await type(p,'#ch-email','park@example.com'); await type(p,'#ch-pw','parkpark'); await click(p,'#ch-login',1500);
  ok('login without a profile → "마저 적어 주세요" form (no email/pw fields), logout available', /마저 적어/.test(await body(p)) && await p.evaluate(()=>!document.querySelector('#ch-pw2') && !!document.querySelector('#ch-church') && !!document.querySelector('#ch-logout')));
  await type(p,'#ch-name','박셋'); await type(p,'#ch-church','셋째교회'); await upload(p,PHOTO,1500); await check(p,'#ch-agree1'); await check(p,'#ch-agree2');
  await click(p,'#ch-submit',1800);
  ok('profile + church request completed', S.profiles[usr.id] && S.profiles[usr.id].church_status==='pending' && /가입을 마쳤습니다/.test(await msg(p)), await msg(p));
  ok('no page errors (complete profile)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 5-1. v78 운영자: 머리줄 숫자 · 역할 배지 · 승인 대기 · 서류 보기 · 승인(교회 이름 고침 + 관리자) · 반려 · 전체 계정(새 표시) · 관리자 해제 ----
{ const opU={id:uid(),email:'op@example.com',pw:'operator1',ok:true,created:Date.now()-86400000}; S.users[opU.email]=opU;
  S.profiles[opU.id]={name:'운영자',gender:null,birth:null,phone:null,church_name:null,church_status:'none',proof_path:null,reject_reason:null}; S.ops.add(opU.id);
  // 승인 대기 두 명 준비(최정 = 사진, 한넷 = PDF)
  for (const [em,nm,ch,ext] of [['choi@example.com','최정','넷째교횐','jpg'],['han@example.com','한넷','다섯째교회','pdf']]) { const u={id:uid(),email:em,pw:'x123456',ok:true,created:Date.now()}; S.users[em]=u;
    const fp=u.id+'/1.'+ext; S.files[fp]={type:ext==='pdf'?'application/pdf':'image/jpeg',len:10}; S.profiles[u.id]={name:nm,gender:'M',birth:'19850505',phone:'01011112222',church_name:ch,church_status:'pending',proof_path:fp,reject_reason:null}; }
  const {p,errs}=await open(SB);
  await p.evaluate(()=>{ try{localStorage.setItem('bf.opSeen', String(Date.now()-3600000));}catch(e){} });
  await openAcct(p); await type(p,'#ch-email','op@example.com'); await type(p,'#ch-pw','operator1'); await click(p,'#ch-login',1500);
  const pend=Object.values(S.profiles).filter(x=>x.church_status==='pending').length;
  ok('operator: role badges 운영자 + 교회 미등록; operator menu with pending count', await p.evaluate(()=>[...document.querySelectorAll('.ch-roles .ch-role')].map(x=>x.textContent).join()==='운영자,교회 미등록' && !!document.querySelector('#ch-op-pending') && !!document.querySelector('#ch-op-all')) && (await p.evaluate(()=>document.querySelector('#ch-op-pending .ch-count')?.textContent))===String(pend), String(pend));
  ok('operator: header person icon shows the pending count badge', (await p.evaluate(()=>document.querySelector('#btn-acct .acct-dot')?.textContent))===String(pend) && /승인 대기/.test(await p.evaluate(()=>document.querySelector('#btn-acct').getAttribute('aria-label'))));
  await p.screenshot({path:'acct1-operator.png'});
  await click(p,'#ch-op-pending',900);
  const rows=await p.evaluate(()=>[...document.querySelectorAll('.ch-urow')].map(b=>b.textContent));
  ok('pending list shows the pending people with church names and 확인 중', rows.length===pend && rows.some(t=>/최정/.test(t)&&/넷째교횐/.test(t)&&/확인 중/.test(t)) && rows.some(t=>/한넷/.test(t)), JSON.stringify(rows));
  await p.evaluate(()=>[...document.querySelectorAll('.ch-urow')].find(b=>/최정/.test(b.textContent)).click()); await sleep(500);
  ok('user detail: info (name, email, birth, phone), proof button, approve form prefilled with requested church name, reject form', /최정/.test(await body(p)) && /choi@example\.com/.test(await body(p)) && /1985\.05\.05/.test(await body(p)) && /01011112222/.test(await body(p)) && await p.evaluate(()=>!!document.querySelector('#ch-op-proof') && document.querySelector('#ch-op-church').value==='넷째교횐' && !!document.querySelector('#ch-op-reject')));
  await click(p,'#ch-op-proof',1200);
  const img=await p.evaluate(()=>{const i=document.querySelector('.ch-proof-img'); return i?{src:i.src,w:i.naturalWidth}:null;});
  ok('서류 보기: signed URL requested and the photo is shown in the app', !!img && /\/storage\/v1\/object\/sign\/proofs\/.+token=tk/.test(img.src) && img.w>0 && S.log.some(l=>l.path.startsWith('/storage/v1/object/sign/proofs/')), JSON.stringify(img));
  await p.screenshot({path:'acct1-op-user.png'});
  await type(p,'#ch-op-church','넷째교회'); await p.evaluate(()=>{document.querySelector('#ch-op-admin').checked=true;}); await click(p,'#ch-op-approve',1500);
  const choi=S.users['choi@example.com'].id;
  ok('approve with corrected church name + admin → server updated; back on the pending list (최정 gone) with the message', S.profiles[choi].church_status==='approved' && S.profiles[choi].church_name==='넷째교회' && S.mem[choi].role==='admin' && /승인: 넷째교회 \(관리자\)/.test(await msg(p)) && await p.evaluate(()=>{const r=[...document.querySelectorAll('.ch-urow')].map(b=>b.textContent); return r.length>=1 && !r.some(t=>/최정/.test(t)) && r.some(t=>/한넷/.test(t));}), await msg(p));
  ok('pending count in the header badge goes down after approval', (await p.evaluate(()=>document.querySelector('#btn-acct .acct-dot')?.textContent))===String(pend-1));
  await p.evaluate(()=>[...document.querySelectorAll('.ch-urow')].find(b=>/한넷/.test(b.textContent)).click()); await sleep(500);
  const before=(S.log.filter(l=>l.path.startsWith('/storage/v1/object/sign/')).length);
  await click(p,'#ch-op-proof',900);
  const opened=await p.evaluate(()=>window.__msgs.filter(m=>m.open).map(m=>m.open));
  ok('PDF proof: opens the signed URL externally (Safari) instead of inline', S.log.filter(l=>l.path.startsWith('/storage/v1/object/sign/')).length===before+1 && opened.some(u=>/\/object\/sign\/proofs\/.+\.pdf\?token=tk$/.test(u)) && !(await p.evaluate(()=>document.querySelector('.ch-proof-img'))), JSON.stringify(opened));
  await type(p,'#ch-op-reason','서류가 흐립니다'); await click(p,'#ch-op-reject',200); await click(p,'#ch-op-reject',1500);
  const han=S.users['han@example.com'].id;
  ok('reject (two taps) with a reason → rejected on the server', S.profiles[han].church_status==='rejected' && S.profiles[han].reject_reason==='서류가 흐립니다' && /반려/.test(await msg(p)), await msg(p));
  ok('header badge disappears when nothing is pending', !(await p.evaluate(()=>document.querySelector('#btn-acct .acct-dot'))) || Object.values(S.profiles).some(x=>x.church_status==='pending'));
  // 전체 계정: 지난번 본 뒤 가입한 계정에 '새'
  await p.evaluate(()=>document.querySelector('#sheet-close').click()); await sleep(300);
  await openAcct(p); await click(p,'#ch-op-all',1200);
  const all=await p.evaluate(()=>[...document.querySelectorAll('.ch-urow')].map(b=>({t:b.textContent,isNew:!!b.querySelector('.ch-new')})));
  ok('전체 계정: every account listed; accounts created after the last visit marked 새, older (operator, created yesterday) not', all.length===Object.keys(S.users).length && all.find(x=>/최정/.test(x.t)).isNew && !all.find(x=>/운영자/.test(x.t)&&/op@example/.test(x.t)).isNew && /새로 가입한 계정 \d+명/.test(await body(p)), JSON.stringify(all.map(x=>(x.isNew?'*':'')+x.t.slice(0,12))));
  await click(p,'#sheet-back',600); await click(p,'#ch-op-all',1200);
  ok('opening 전체 계정 again: 새 marks are cleared (last-seen updated)', await p.evaluate(()=>document.querySelectorAll('.ch-urow .ch-new').length===0));
  await p.evaluate(()=>[...document.querySelectorAll('.ch-urow')].find(b=>/최정/.test(b.textContent)).click()); await sleep(500);
  await click(p,'#ch-op-unadmin',200); await click(p,'#ch-op-unadmin',1200);
  ok('unset church admin from the detail screen', S.mem[choi].role==='member' && await p.evaluate(()=>!!document.querySelector('#ch-op-admin-on')), await msg(p));
  ok('no page errors (operator)', errs.length===0, JSON.stringify(errs)); await p.close(); }

// ---- 5-2. 운영자가 아닌 사람은 op 함수가 거절된다(가짜 서버 규칙 확인용) ----
{ const r=await fakeSb({url:SB.url+'/rest/v1/rpc/op_list_accounts',method:'POST',headers:{apikey:SB.key,Authorization:'Bearer '+tok(S.users['choi@example.com']).access_token},body:'{"p_kind":"all"}'});
  ok('non-operator op_list_accounts refused', /operator only/.test(r.body), r.body); }

// ---- 6. 서버 설정이 없는 빌드 ----
{ const {p,errs}=await open({url:'',key:''});
  await openAcct(p);
  ok('empty sb.json → "서버 설정 안 됨" + basic features still usable, no login form', /아직 이 앱에 설정되지 않았습니다/.test(await body(p)) && /기본 기능은 모두/.test(await body(p)) && !(await p.evaluate(()=>document.querySelector('#ch-email'))));
  ok('no page errors (no config)', errs.length===0, JSON.stringify(errs)); await p.close(); }
fs.rmSync(tmp,{recursive:true,force:true});
console.log(fails?'FAILS '+fails:'ALL PASS'); await b.close(); process.exit(0);
