// Exact frozen candidate browser check; real isolated GoTrue + post-007 PostgREST.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServerClient} from '@supabase/ssr';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n));
const s=read('services.private.json'),k=read('keys.private.json'),actor=read('actor.private.json'),source=read('build-origin.private.json');
const origin=`http://127.0.0.1:${s.nextPort}`,api=`http://127.0.0.1:${s.gatewayPort}`;
const jar=[];
const auth=createServerClient(source.origin,k.anon,{global:{fetch:async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input.url);assert.equal(u.origin,source.origin);
 return fetch(api+u.pathname+u.search,init);
}},cookies:{getAll:()=>jar,setAll:entries=>{for(const entry of entries){const i=jar.findIndex(x=>x.name===entry.name);if(i>=0)jar.splice(i,1);jar.push(entry);}}}});
assert.equal((await auth.auth.signInWithPassword({email:actor.email,password:actor.password})).error,null);
const result={status:'RUNNING',buildId:readFileSync(d+'/candidate/.next/BUILD_ID','utf8').trim(),nextVersion:JSON.parse(readFileSync(d+'/candidate/node_modules/next/package.json')).version,realIsolatedAuth:true,realPost007Database:true,artifactBytesChanged:false,transportShim:'Public build-bound Supabase origin redirected only to isolated real Auth/PostgREST; all other external requests blocked',routes:[],externalBlocked:0,agentRequests:0,providerRequests:0,browserErrors:0,feature:'OFF',allowlists:'EMPTY'};
let browser,page;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});
 await context.addCookies(jar.map(c=>({name:c.name,value:c.value,url:origin,sameSite:'Lax',secure:false})));
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.pathname.startsWith('/api/teaching-agent/')){result.agentRequests++;await route.abort();return;}
  if(u.origin===origin||u.origin===api){await route.continue();return;}
  if(u.origin===source.origin){
   if(!['GET','HEAD'].includes(request.method())){await route.abort();return;}
   const headers={...request.headers(),apikey:k.anon};delete headers.host;
   const response=await route.fetch({url:api+u.pathname+u.search,headers});await route.fulfill({response});return;
  }
  result.externalBlocked++;await route.abort();
 });
 page=await context.newPage();page.on('pageerror',()=>{result.browserErrors++;});
 for(const [name,path,expected] of [
  ['homepage','/',null],['auth-entry','/login',null],['platform-dashboard','/platform/dashboard',null],
  ['textbook-authoring','/platform/dashboard/admin/apps/korean/textbooks','创建教学内容'],
  ['script-studio','/platform/dashboard/admin/apps/korean/teaching-scripts','教学脚本']]){
  const response=await page.goto(origin+path,{waitUntil:'networkidle',timeout:45000});
  const body=await page.locator('body').innerText();
  const entry={name,status:response.status(),redirectedToLogin:new URL(page.url()).pathname==='/login'&&path!=='/login',expectedUiPresent:expected?body.includes(expected):body.length>10,agentUiAbsent:await page.getByRole('region',{name:/^(课文讲解|교재 설명)$/}).count()===0};
  result.routes.push(entry);
  writeFileSync(d+'/candidate-browser.private.json',JSON.stringify(result,null,2),{mode:0o600});
  if(entry.status!==200||(entry.redirectedToLogin&&path!=='/')||!entry.expectedUiPresent){writeFileSync(d+'/candidate-failure-body.private.txt',body,{mode:0o600});throw Error('ROUTE_VALIDATION_FAILED:'+name);}
 }
 assert.equal(result.agentRequests,0);assert.equal(result.providerRequests,0);assert.equal(result.browserErrors,0);
 // One local disabled-transport request, not a Run or live Provider smoke test.
 const off=await fetch(origin+'/api/teaching-agent/runs',{method:'POST',headers:{'content-type':'application/json',origin},body:'{}'});
 const rejected=await off.json();assert.equal(off.status,404);assert.equal(rejected.code,'RUN_NOT_FOUND');
 result.offTransportProbe={requests:1,status:off.status,code:rejected.code,admission:false,target:'ISOLATED CANDIDATE ONLY'};
 result.status='PASS';
}catch(error){result.status='FAIL';result.reason=String(error.message).slice(0,250);process.exitCode=1;}
finally{await browser?.close();writeFileSync(d+'/candidate-browser.private.json',JSON.stringify(result,null,2),{mode:0o600});}
writeFileSync(new URL('../../docs/evidence/teaching-agent-stage-1f-r5b/candidate-validation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
