import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../..',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'github-sync-ui-'));
let server,browser,release;
try{
 await build({absWorkingDir:root,entryPoints:['test/browser/github-sync-entry.tsx'],outfile:join(temp,'bundle.js'),bundle:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
 server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(join(temp,'bundle.js')):'<!doctype html><html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let repo='team/original',failSave=true;
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:{signedIn:true,subject:'owner',scheme:'ain',isOwner:false}});
  if(path==='/api/auth/google/session')return route.fulfill({json:{configured:false,identity:null}});
  if(path==='/api/auth/sso/status')return route.fulfill({json:{configured:false}});
  if(path==='/api/orgs')return route.fulfill({json:{signed_in:true,orgs:[]}});
  if(path.endsWith('/github-sync')){
   if(req.method()==='PUT'){
    if(failSave)return route.fulfill({status:500,json:{error:{code:'internal',message:'fixture save failed'}}});
    repo=req.postDataJSON().repo;
   }
   if(path.includes('/managed/')) return route.fulfill({json:{configured:null,status:{state:'ok',message:'up to date',checkedAt:null,syncedAt:null,nextCheckAt:null,commit:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',githubCommit:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',mode:'mirror'},requested:null}});
   const second=path.includes('/two/');
   if(second)await new Promise(r=>{release=r;});
   return route.fulfill({json:{configured:{repo:second?'team/second':repo,branch:'main',visibility:'private',enabled:true,configuredAt:'2026-11-04T00:00:00Z'},status:null,requested:null}});
  }
  return route.fulfill({json:{}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const input=page.getByPlaceholder('owner/repo');await input.waitFor();
 await page.waitForFunction(()=>document.querySelector('input[placeholder="owner/repo"]').value==='team/original');
 await input.fill('team/draft');repo='team/remote-update';await page.evaluate(()=>window.refresh());
 assert.equal(await input.inputValue(),'team/draft','refetch must preserve the draft');
 await page.locator('button[type="submit"]').click();await page.getByText('fixture save failed',{exact:false}).waitFor();assert.equal(await input.inputValue(),'team/draft');
 failSave=false;await page.locator('button[type="submit"]').click();await page.getByText('fixture save failed',{exact:false}).waitFor({state:'hidden'});
 await page.evaluate(()=>window.switchProject('two'));assert.equal(await input.inputValue(),'','another project never inherits the draft');
 const deadline=Date.now()+10000;while(!release&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(release);release();release=undefined;
 await page.waitForFunction(()=>document.querySelector('input[placeholder="owner/repo"]').value==='team/second');
 await page.evaluate(()=>window.switchProject('managed'));
 await page.getByText(/운영 동기화 작업에서 관리|Managed by the sync job/).waitFor();
 assert.equal(await page.getByRole('link',{name:'https://github.com/team/managed'}).getAttribute('href'),'https://github.com/team/managed');
 for(const [label,value] of [[/배포 대상 브랜치|Deployment branch/,'release'],[/GitHub 원본 커밋|GitHub source commit/,'aaaaaaa'],[/프로젝트 소스 커밋|Project source commit/,'bbbbbbb'],[/최근 빌드 커밋|Latest build commit/,'ccccccc'],[/운영 중인 커밋|Serving commit/,'ddddddd']]) {
  const row=page.locator('dt').filter({hasText:label}).locator('xpath=following-sibling::dd[1]');
  assert.ok((await row.innerText()).includes(value));
 }
 assert.equal(await page.getByRole('link',{name:/^원본$|^Raw$/}).getAttribute('href'),'/fixture-build-log');
 assert.deepEqual(errors,[]);console.log('PASS: sync draft survives refetch and failed save; retry and project switch use the correct project');
}finally{release?.();await browser?.close();server?.close();await rm(temp,{recursive:true,force:true});}
