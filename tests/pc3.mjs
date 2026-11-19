import {fileURLToPath} from 'node:url';
import {serve,launch,sleep,openDevice} from './devlib.mjs';
import fs from 'node:fs';
serve(8952); const b=await launch();
const DIR=fileURLToPath(new URL('./', import.meta.url)), FIX=DIR+'fixtures/';
const seed={fn:()=>{ window.__msgs=[]; window.webkit={messageHandlers:{bf:{postMessage:(m)=>{window.__msgs.push(m)}}}}; if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1'); localStorage.clear(); localStorage.setItem('bf.pos',JSON.stringify({book:42,chapter:2,verse:16}));}}, arg:null};
const {p,errs}=await openDevice(b,['Duo 펼침 앱',951,669,{top:0,right:84,bottom:0,left:0}],{seed,port:8952,query:'?native=1'}); await sleep(400);
await p.click('#btn-card'); await sleep(900);
const set=async(sel,v)=>p.evaluate((sel,v)=>{const e=document.querySelector(sel); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));},sel,v);
const click=(sel)=>p.evaluate((s)=>document.querySelector(s).click(),sel);
const grab=async(name)=>{ await sleep(600); const d=await p.evaluate(()=>document.querySelector('#pc-canvas').toDataURL('image/jpeg',.93)); fs.writeFileSync(DIR+name,Buffer.from(d.split(',')[1],'base64')); };
// 1) 사진 카드
const fi=await p.$('#pc-file'); await fi.uploadFile(FIX+'testphoto.jpg'); await sleep(1200);
await set('#pc-cap','오늘도 은혜로 걸어갑니다'); await grab('sample1.jpg');
// 2) 노을 배경
await click('#pc-nophoto'); await click('.pc-sw button[data-i="1"]'); await set('#pc-ref','시 23:1-2'); await set('#pc-cap','여호와는 나의 목자'); await click('.pc-seg[data-k="font"] button[data-v="gowunB"]'); await sleep(900); await grab('sample2.jpg');
// 3) 검정 틀 + 숲
await click('.pc-sw button[data-i="3"]'); await click('.pc-seg[data-k="frame"] button[data-v="black"]'); await set('#pc-ref','빌 4:13'); await set('#pc-cap','매일 새롭게'); await click('.pc-seg[data-k="font"] button[data-v="nanumG"]'); await sleep(900); await grab('sample3.jpg');
console.log('errs',JSON.stringify(errs)); await b.close(); process.exit(0);
