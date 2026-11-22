// v63: 설정에서 '책상 질감'을 없앴다 — 설정 줄 없음 · body/html 에 desk-* 클래스 없음 · 예전에 저장된 desk 값은 무시/삭제 · 테마·상태표시줄 색은 그대로 동작
import {serve,launch,sleep,openDevice} from './devlib.mjs';
serve(8905); const b=await launch(); let fails=0; const ok=(n,c,x='')=>{console.log((c?'ok  ':'FAIL')+' '+n+' '+x); if(!c) fails++;};
// 이전 버전(v62 이하)이 저장해 둔 책상 질감 값이 있는 기기를 흉내 낸다
const seed={fn:()=>{ if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:1,chapter:1,verse:7})); localStorage.setItem('bf.settings',JSON.stringify({fontSize:18,theme:'paper',layout:'auto',font:'myeongjo',std:false,desk:'wood'}));}}, arg:null};
const SPREAD=['Duo 펼침',867,609,{top:0,right:84,bottom:0,left:0}];
const {p,errs}=await openDevice(b,SPREAD,{seed,port:8905}); await sleep(500);
const cls=()=>p.evaluate(()=>document.body.className+' | '+document.documentElement.className);
ok('책상 질감 클래스(desk-*)가 없다(예전 저장값이 wood 여도)', !/desk-/.test(await cls()) && /theme-paper/.test(await cls()), await cls());
const meta0=await p.evaluate(()=>document.querySelector('meta[name=theme-color]').content);
await p.evaluate(()=>document.querySelector('#btn-settings, #btn-set, [aria-label="설정"]').click()); await sleep(400);
const labels=await p.evaluate(()=>[...document.querySelectorAll('#sheet-body .row span')].map(e=>e.textContent));
ok('설정에 책상 질감 줄이 없다', !labels.includes('책상 질감'), labels.join('|'));
ok('설정에 글자 크기·테마·글씨체·화면 구성은 그대로 있다', ['글자 크기','테마','글씨체','화면 구성'].every(l=>labels.includes(l)), labels.join('|'));
ok('책상 질감 단추(data-k=desk)가 없다', await p.evaluate(()=>document.querySelectorAll('#sheet-body button[data-k="desk"]').length===0));
await p.evaluate(()=>[...document.querySelectorAll('#sheet-body button[data-k="theme"]')].find(b=>b.dataset.v==='night').click()); await sleep(900);
ok('테마를 야간으로 바꾸면 theme-night 만 붙는다', /theme-night/.test(await cls()) && !/desk-/.test(await cls()), await cls());
const st=JSON.parse(await p.evaluate(()=>localStorage.getItem('bf.settings')));
ok('설정을 바꿔 저장하면 예전 desk 값은 남지 않는다', st.theme==='night' && !('desk' in st), JSON.stringify(st));
const meta1=await p.evaluate(()=>document.querySelector('meta[name=theme-color]').content);
ok('theme-color 는 테마 책상색을 따른다(야간 #0a0b0d)', meta1.toLowerCase()==='#0a0b0d', meta0+' -> '+meta1);
const bg=await p.evaluate(()=>getComputedStyle(document.body).backgroundImage);
ok('책상(바탕)에 질감 그림(url)이 없다 — 은은한 빛(그라데이션)만', !/url\(/.test(bg), bg.slice(0,120));
await p.reload(); await sleep(1500);
ok('다시 열어도 야간 · 질감 없음', /theme-night/.test(await cls()) && !/desk-/.test(await cls()), await cls());
ok('no page errors', errs.length===0, JSON.stringify(errs));
console.log(fails? 'FAILS '+fails : 'ALL PASS'); await b.close(); process.exit(0);
