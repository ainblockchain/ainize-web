import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {GOOGLE_SESSION_COOKIE,mintGoogleSessionCookie} from '../src/lib/googleOAuth';
import {signSiteSubject,SITE_SUBJECT_HEADER} from '../src/lib/siteAssertion';

test('agent relay derives the signed-in identity and drops visitor assertions and container credentials',async()=>{
 const captured:{path:string;subject?:string;cookie?:string;siteCall?:string}[]=[];
 const server=createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/auth/sso/principal'){res.end(JSON.stringify({linked:false,blocked:false,notBefore:null}));return;}
  captured.push({path:req.url!,subject:req.headers[SITE_SUBJECT_HEADER] as string|undefined,cookie:req.headers.cookie,siteCall:req.headers['x-ainize-site-call'] as string|undefined});
  res.end(JSON.stringify({ok:true}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const env:Record<string,string>={
  AINIZE_NODE_URL:'http://127.0.0.1:'+(server.address() as AddressInfo).port,
  GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture-google',
  AINIZE_WEB_SESSION_SECRET:'s'.repeat(40),AINIZE_SITE_ASSERTION_SECRET:'v'.repeat(40),
  LEGACY_LOGIN:'true',AIN_SSO_ISSUER:'',AIN_SSO_CLIENT_ID:'',
 };
 const prior=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 Object.assign(process.env,env);
 try{
  const {relayToNode}=await import('../src/lib/proxy');
  const now=Date.now();
  const cookie=mintGoogleSessionCookie({sub:'42',email:'fixture@example.test',name:null,picture:null},{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,sessionSecret:env.AINIZE_WEB_SESSION_SECRET,redirectUri:null},now);
  const request=(path:string,signedIn:boolean)=>new Request('https://ainize.ai'+path,{method:'POST',headers:{
   'Content-Type':'application/json',[SITE_SUBJECT_HEADER]:'google:attacker.0.forged',
   'x-ainize-site-call':'forged privileged call',
   ...(signedIn?{cookie:GOOGLE_SESSION_COOKIE+'='+encodeURIComponent(cookie)}:{})
  },body:'{}'});
  assert.equal((await relayToNode(request('/agents/private-agent',true),'/agents/private-agent')).status,200);
  const signed=captured[0].subject!;
  const issuedAt=Number(signed.split('.')[1]);
  assert.equal(signed,signSiteSubject(env.AINIZE_SITE_ASSERTION_SECRET,'google:42',issuedAt));
  assert.equal(captured[0].siteCall,undefined);
  await relayToNode(request('/agents/private-agent',false),'/agents/private-agent');
  assert.equal(captured[1].subject,undefined,'unsigned visitor claims do not acquire a caller identity');
  await relayToNode(request('/svc/app/agents/private-agent',true),'/svc/app/agents/private-agent',{service:true});
  assert.equal(captured[2].subject,undefined);
  assert.equal(captured[2].cookie,undefined,'a user container receives no Google identity or session');
 }finally{
  for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});
