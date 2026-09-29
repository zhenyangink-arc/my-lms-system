import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {explainRequest} from '../../src/features/teaching-agent/client/selection-state.ts';
import {parseStudentRunStream} from '../../src/features/teaching-agent/client/ndjson-parser.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),keys=read('status.json'),users=read('users.private.json'),ids=read('fixture.json'),pins=read('pins.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||keys.API_URL!==`http://127.0.0.1:${s.ports.api}`)throw Error('STAGING_ONLY');
const origin=`http://127.0.0.1:${s.ports.next}`,endpoint=origin+'/api/teaching-agent/runs',route=read('formal-fixture-result.json').route;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const processAction=action=>JSON.parse(execFileSync('python3',['scripts/teaching-agent-r3/process.py',action,d],{encoding:'utf8'}));
const observer=createClient(s.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const events=name=>existsSync(d+'/'+name)?readFileSync(d+'/'+name,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const counts=async()=>{const result={};for(const t of ['agent_runs','agent_messages','agent_conversations','agent_run_events']){const r=await observer.from(t).select('id',{head:true,count:'exact'});assert.equal(r.error,null);result[t]=r.count;}return result;};
const result={startupOnly:true,realNextStart:true,providerFixtureOnly:true,productionMutations:0,negative:[]};
let browser;
try{
 processAction('stop');browser=await chromium.launch({headless:true});const contexts={};
 for(const label of ['A1','A2']){
  const jar=[];const client=createServerClient(s.url,keys.ANON_KEY,{cookies:{getAll:()=>jar,setAll:entries=>{for(const e of entries){const old=jar.findIndex(x=>x.name===e.name);if(old>=0)jar.splice(old,1);jar.push(e);}}}});
  assert.equal((await client.auth.signInWithPassword({email:users[label].email,password:users[label].password})).error,null);
  contexts[label]=await browser.newContext();await contexts[label].addCookies(jar.map(c=>({name:c.name,value:c.value,url:origin,sameSite:'Lax'})));
 }
 const cookie=async label=>(await contexts[label].cookies(origin)).map(c=>c.name+'='+c.value).join('; ');
 const post=async()=>fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json',cookie:await cookie('A1')},body:JSON.stringify(explainRequest(pins[0],randomUUID()))});
 const status=async id=>fetch(endpoint+'/'+id,{headers:{cookie:await cookie('A1')}});
 const cancel=async id=>fetch(endpoint+'/'+id+'/cancel',{method:'POST',headers:{origin,cookie:await cookie('A1')}});
 for(const mode of ['start-off','start-wrong-course','start-wrong-user']){
  processAction(mode);const p=await contexts.A1.newPage();const r=await p.goto(origin+route);const before=await counts();const response=await post();
  const item={mode,pageStatus:r.status(),buttons:await p.getByRole('button',{name:/解释这句话/}).count(),post:response.status,extraRuns:(await counts()).agent_runs-before.agent_runs};
  assert.equal(item.buttons,0);assert.equal(item.extraRuns,0);assert.equal(item.post,mode==='start-off'?404:403);result.negative.push(item);
  if(mode==='start-wrong-user'){const p2=await contexts.A2.newPage();const r2=await p2.goto(origin+route);result.noEnrollment={pageStatus:r2.status(),buttons:await p2.getByRole('button',{name:/解释这句话/}).count()};assert.equal(result.noEnrollment.buttons,0);await p2.close();}
  await p.close();processAction('stop');
 }
 processAction('start-on');writeFileSync(d+'/control.json',JSON.stringify({enabled:false,providerDelayMs:8000}));
 // Startup-only ON remains ON despite editing the fixture control file to OFF.
 const startedAt=Date.now(),response=await post();assert.equal(response.status,200);const iter=parseStudentRunStream(response.body),first=(await iter.next()).value;assert.equal(first.type,'run.started');
 const runId=first.runId;result.startupReality={configFileAloneDoesNotSwitchOff:true};
 while(!events('provider-events.jsonl').some(e=>e.at>=startedAt))await pause(20);
 result.listenerStop=processAction('signal');await pause(200);result.replacement=processAction('start-off');
 const before=await counts();result.kill={newPost:(await post()).status,ownerGet:(await status(runId)).status};
 result.kill.cancelStatus=(await cancel(runId)).status;
 const frames=[];for await(const e of iter)frames.push(e);
 result.kill.terminal=frames.at(-1)?.type;result.kill.persisted=(await(await status(runId)).json()).status;result.kill.extraRuns=(await counts()).agent_runs-before.agent_runs;
 assert.equal(result.kill.newPost,404);assert.equal(result.kill.ownerGet,200);assert.equal(result.kill.cancelStatus,200);assert.equal(result.kill.persisted,'cancelled');assert.equal(result.kill.extraRuns,0);
 const active=await observer.from('agent_runs').select('id').eq('tenant_id',ids.A).in('status',['created','running','waiting_tool']);assert.equal(active.error,null);assert.equal(active.data.length,0);
 const calls=events('provider-events.jsonl').length,tools=events('http-events.jsonl').filter(e=>e.kind==='tool.requested'||e.kind==='tool.started').length;
 await pause(2200);assert.equal(events('provider-events.jsonl').length,calls);assert.equal(events('http-events.jsonl').filter(e=>e.kind==='tool.requested'||e.kind==='tool.started').length,tools);
 result.drain={active:0,lateProvider:0,lateTool:0,observedMs:2200,runMs:Date.now()-startedAt};
 result.beforeRollback=await counts();
 // Roll back to the actual prior release source rebuilt solely with staging public configuration.
 processAction('stop');execFileSync('python3',['-c',"from pathlib import Path;import sys;d=Path(sys.argv[1]);(d/'next').rename(d/'next-fixture');(d/'previous').rename(d/'next')",d]);
 processAction('start-off');const p=await contexts.A1.newPage();const previous=await p.goto(origin+route);await p.waitForTimeout(1000);
 result.rollback={pageStatus:previous.status(),classroom:await p.locator('[data-learning-target]').count(),agentButtons:await p.getByRole('button',{name:/解释这句话/}).count(),post:(await post()).status,counts:await counts()};
 assert.equal(result.rollback.pageStatus,200);assert(result.rollback.classroom>0);assert.equal(result.rollback.agentButtons,0);assert.equal(result.rollback.post,404);assert.deepEqual(result.rollback.counts,result.beforeRollback);
 await p.close();processAction('stop');execFileSync('python3',['-c',"from pathlib import Path;import sys;d=Path(sys.argv[1]);(d/'next').rename(d/'previous');(d/'next-fixture').rename(d/'next')",d]);
 // Reproduce the configured production 15s termination budget in an owned process.
 processAction('start-on');writeFileSync(d+'/control.json',JSON.stringify({providerDelayMs:30000}));
 const at=Date.now(),slow=await post(),slowIter=parseStudentRunStream(slow.body),slowRun=(await slowIter.next()).value.runId;
 const pending=(async()=>{try{for await(const _ of slowIter){void _;}}catch{/* Expected forced process termination; DB remains authoritative. */}})();
 while(!events('provider-events.jsonl').some(e=>e.at>=at))await pause(20);
 const stopper=spawn('python3',['scripts/teaching-agent-r3/process.py','simulate-pm2-stop',d],{stdio:['ignore','pipe','pipe']});let stopped='';stopper.stdout.on('data',x=>stopped+=x);const done=new Promise(resolve=>stopper.on('close',resolve));
 // Do not start the replacement until this helper has finished identifying/signalling the old process.
 await pause(300);const ownerCancel=await observer.rpc('request_agent_run_cancel_v1',{p_tenant:ids.A,p_actor:users.A1.id,p_run:slowRun});assert.equal(ownerCancel.error,null);
 await done;await pending;result.productionTimeoutSimulation=JSON.parse(stopped);
 processAction('start-off');await pause(Math.max(0,at+47000-Date.now()));
 const stored=await observer.from('agent_runs').select('status,deadline_at,cancel_requested_at').eq('id',slowRun).single();assert.equal(stored.error,null);
 result.productionTimeoutSimulation.persisted=stored.data;result.productionTimeoutSimulation.elapsedMs=Date.now()-at;
 result.productionTimeoutSimulation.drainConverged=['completed','failed','cancelled'].includes(stored.data.status);
 result.productionTimeoutSimulation.verdict=result.productionTimeoutSimulation.drainConverged?'PASS':'FAIL';
 result.lookupRunIds={completed:(await observer.from('agent_runs').select('id').eq('status','completed').limit(1)).data[0].id,cancelled:runId,orphan:slowRun};
 result.liveProviderRequests=0;
}catch(e){result.error={name:e.name,message:String(e.message).slice(0,400)};process.exitCode=1;}
finally{await browser?.close();writeFileSync(d+'/operations-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
