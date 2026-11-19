import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const ROOT = process.env.ROOT || fileURLToPath(new URL('../www', import.meta.url));   // 기본: 저장소의 www/ (ROOT=경로 로 다른 폴더도 시험 가능)
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
export function serve(port){ return http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)}).listen(port); }
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function launch(){ return puppeteer.launch({args:[...chromium.args,'--no-sandbox'],executablePath:await chromium.executablePath(),headless:'shell'}); }
// 기기: [이름, 폭, 높이, 안전영역 {top,right,bottom,left}]
export const DEVICES = [
  ['SE3 세로',375,667,{top:20,right:0,bottom:0,left:0}],
  ['SE3 가로',667,375,{top:0,right:0,bottom:0,left:0}],
  ['12mini 세로',375,812,{top:50,right:0,bottom:34,left:0}],
  ['12mini 가로',812,375,{top:0,right:44,bottom:21,left:44}],
  ['14 세로',390,844,{top:47,right:0,bottom:34,left:0}],
  ['14 가로',844,390,{top:0,right:47,bottom:21,left:47}],
  ['15 세로',393,852,{top:59,right:0,bottom:34,left:0}],
  ['15 가로',852,393,{top:0,right:59,bottom:21,left:59}],
  ['16Pro 세로',402,874,{top:62,right:0,bottom:34,left:0}],
  ['16Pro 가로',874,402,{top:0,right:62,bottom:21,left:62}],
  ['15Plus 세로',430,932,{top:59,right:0,bottom:34,left:0}],
  ['15Plus 가로',932,430,{top:0,right:59,bottom:21,left:59}],
  ['16ProMax 세로',440,956,{top:62,right:0,bottom:34,left:0}],
  ['16ProMax 가로',956,440,{top:0,right:62,bottom:21,left:62}],
  ['iPad mini 세로',744,1133,{top:24,right:0,bottom:20,left:0}],
  ['iPad mini 가로',1133,744,{top:24,right:0,bottom:20,left:0}],
  ['Duo 펼침',867,587,{top:0,right:84,bottom:0,left:0}],
  ['Duo 접힘',466,678,{top:0,right:0,bottom:0,left:0}],
];
export async function openDevice(b, dev, {seed, port, query=''}={}) {
  const [name,w,h,si]=dev; const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const cdp=await p.createCDPSession(); let siOK=true;
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:si.top,left:si.left,bottom:si.bottom,right:si.right}}); } catch(e){ siOK=false; }
  if (seed) await p.evaluateOnNewDocument(seed.fn, seed.arg);
  await p.goto('http://localhost:'+port+'/index.html'+query); await p.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,{timeout:90000}); await sleep(1800);
  return {p,errs,siOK,cdp};
}
