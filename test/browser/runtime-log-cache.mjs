import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../..',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'runtime-log-ui-'));
let server,browser,release;
try{
 await build({absWorkingDir:root,entryPoints:['test/browser/runtime-log-cache-entry.tsx'],outfile:join(temp,'bundle.js'),bundle:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
 server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(temp,'bundle.js')):'<!doctype html><html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let cached=true;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{signedIn:true,subject:'owner',scheme:'ain',isOwner:false}});
  if(path==='/api/auth/google/session')return route.fulfill({json:{configured:false,identity:null}});
  if(path==='/api/auth/sso/status')return route.fulfill({json:{configured:false}});
  if(path==='/api/orgs')return route.fulfill({json:{signed_in:true,orgs:[]}});
  if(path.includes('/runtime-logs')){
   assert.equal(url.searchParams.get('allowCached'),'1');const id=path.split('/')[3];
   if(id==='two')await new Promise(r=>{release=r;});
   return route.fulfill({json:{projectId:id,deploymentId:'dep_one',sha:'a'.repeat(40),placement:'peer',tail:200,fetchedAt:Date.parse('2026-11-04T00:00:00Z'),cached,liveStatus:cached?'logs_unavailable':undefined,failureObservedAt:cached?Date.parse('2026-11-04T01:00:00Z'):undefined,lines:[{ts:null,stream:'stdout',text:id+' log line'}],truncated:false}});
  }
  return route.fulfill({json:{}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText('one log line',{exact:false}).waitFor();
 const warning=page.getByText(/실시간 로그를 읽지 못했습니다|Live logs are unavailable/);await warning.waitFor();
 await page.getByRole('checkbox').uncheck();cached=false;await page.getByRole('button',{name:/새로고침|Refresh/}).click();await warning.waitFor({state:'hidden'});
 await page.evaluate(()=>window.switchProject('two'));await page.getByText('one log line',{exact:false}).waitFor({state:'hidden'});
 const deadline=Date.now()+10000;while(!release&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(release,'new project log request was issued');release();release=undefined;await page.getByText('two log line',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: cached warning, live recovery, explicit opt-in and project-switch isolation');
}finally{release?.();await browser?.close();server?.close();await rm(temp,{recursive:true,force:true});}
