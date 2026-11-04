/** Run with node; PLAYWRIGHT_MODULE may point to an existing Playwright installation. */
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../..',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'linked-draft-'));
let server,browser;
try {
  await build({absWorkingDir:root,entryPoints:['test/browser/linked-agent-entry.tsx'],outfile:join(temp,'bundle.js'),bundle:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
  server=createServer(async(req,res)=>{
    res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');
    res.end(req.url==='/bundle.js'?await readFile(join(temp,'bundle.js')):'<!doctype html><html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(10_000);
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(String(e)));
  let failSave=false,failRead=false,holdAlpha=false,held,releaseHeld,holdWrite=false,writeHeld,releaseWrite;
  const names={alpha:'Alpha',beta:'Beta'};
  const response=(id,name=names[id]||id)=>({agent:{id,name,description:'Description',owner:'owner',upstream:'https://agent.example/rpc',a2a_url:`https://node.example/agents/${id}`,card_url:`https://node.example/agents/${id}/card`,visibility:'public',reachable:true}});
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==='/api/auth/me')return route.fulfill({json:{signedIn:true,subject:'owner',scheme:'ain',isOwner:false}});
    if(path==='/api/auth/google/session')return route.fulfill({json:{configured:false,identity:null}});
    if(path==='/api/auth/sso/status')return route.fulfill({json:{configured:false}});
    if(path==='/api/orgs')return route.fulfill({json:{signed_in:true,orgs:[]}});
    if(path.startsWith('/api/linked-agents')){
      const id=path.split('/')[3];
      if(req.method()==='GET'){
        if(holdAlpha&&id==='alpha'){held?.();await new Promise(resolve=>{releaseHeld=resolve;});return route.fulfill({json:response(id,'Late alpha')});}
        if(failRead)return route.fulfill({status:503,json:{error:{code:'unavailable',message:'Read unavailable'}}});
        return route.fulfill({json:response(id)});
      }
      const body=req.postDataJSON();writes.push({path,method:req.method(),body});
      if(holdWrite){writeHeld?.();await new Promise(resolve=>{releaseWrite=resolve;});}
      if(failSave)return route.fulfill({status:503,json:{error:{code:'unavailable',message:'Retry this save'}}});
      return route.fulfill({json:response(body.id,body.name)});
    }
    return route.fulfill({json:{}});
  });
  const name=page.getByTestId('agent-link-name');
  const value=async expected=>{
    try{await page.waitForFunction(expected=>document.querySelector('[data-testid="agent-link-name"]')?.value===expected,expected);}
    catch(error){throw new Error(`Expected editor name ${JSON.stringify(expected)}; page errors: ${errors.join('; ')}; rendered: ${await page.locator('body').innerText()}`,{cause:error});}
  };
  const refetch=async id=>{
    const done=page.waitForResponse(r=>r.url().endsWith(`/api/linked-agents/${id}`));
    await page.evaluate(id=>window.refresh(id),id);await done;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/agent/alpha/link`);
  await value('Alpha');await name.fill('Unsaved alpha');names.alpha='Server changed';await refetch('alpha');assert.equal(await name.inputValue(),'Unsaved alpha');
  failRead=true;await refetch('alpha');assert.equal(await name.inputValue(),'Unsaved alpha');failRead=false;
  holdAlpha=true;const arrived=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Alpha refetch was not requested')),10_000);held=()=>{clearTimeout(timer);resolve();};});await page.evaluate(()=>window.refresh('alpha'));await arrived;
  await page.evaluate(()=>window.navigate('/agent/beta/link'));await value('Beta');await name.fill('Unsaved beta');holdAlpha=false;
  const lateRead=page.waitForResponse(r=>r.url().endsWith('/api/linked-agents/alpha'));releaseHeld();await lateRead;
  assert.equal(await name.inputValue(),'Unsaved beta');assert.equal(await page.getByTestId('agent-link-id').inputValue(),'beta');
  failSave=true;await page.getByTestId('agent-link-submit').click();await page.getByTestId('agent-link-error').waitFor();assert.equal(await name.inputValue(),'Unsaved beta');
  assert.equal(writes.at(-1).path,'/api/linked-agents/beta');assert.equal(writes.at(-1).body.id,'beta');
  failSave=false;await page.getByTestId('agent-link-submit').click();await page.waitForURL('**/agent/beta');assert.equal(writes.at(-1).body.name,'Unsaved beta');
  await page.evaluate(()=>window.navigate('/agent/alpha/link'));await value('Late alpha');
  holdWrite=true;const writeStarted=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Delayed save was not requested')),10_000);writeHeld=()=>{clearTimeout(timer);resolve();};});
  await name.fill('Saving alpha');await page.getByTestId('agent-link-submit').click();await writeStarted;
  await page.evaluate(()=>window.navigate('/agent/beta/link'));await value('Beta');await name.fill('Still editing beta');
  const lateWrite=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/api/linked-agents/alpha'));holdWrite=false;releaseWrite();await lateWrite;
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.ok(page.url().endsWith('/agent/beta/link'));assert.equal(await name.inputValue(),'Still editing beta');
  await page.evaluate(()=>window.navigate('/agent/link'));await value('');assert.equal(await page.getByTestId('agent-link-id').inputValue(),'');
  await name.fill('New linked');await page.getByTestId('agent-link-upstream').fill('https://agent.example/new');await page.getByTestId('agent-link-submit').click();await page.waitForURL('**/agent/new-linked');assert.equal(writes.at(-1).method,'POST');
  await page.evaluate(()=>window.navigate('/agent/alpha/link'));await value('Server changed');
  assert.deepEqual(errors,[]);
  console.log('PASS: initial load, same-ID refetch, failed refetch, late previous-ID response, save target, failed save/retry, late save after navigation, create, return to edit');
} finally {
  await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());await rm(temp,{recursive:true,force:true});
}
