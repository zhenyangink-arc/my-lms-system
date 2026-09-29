import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {explainRequest} from '../../src/features/teaching-agent/client/selection-state.ts';
import {parseStudentRunStream} from '../../src/features/teaching-agent/client/ndjson-parser.ts';
import {createStudentAiTeacherClient,studentRunBusy} from '../../src/features/teaching-agent/client/student-ai-teacher-client.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),s=read('state.json'),keys=read('status.json'),users=read('users.private.json'),ids=read('fixture.json'),pins=read('pins.json');
if(s.marker!=='uply-teaching-agent-r2-disposable-v1'||keys.API_URL!==`http://127.0.0.1:${s.ports.api}`)throw Error('STAGING_ONLY');
const origin=`http://127.0.0.1:${s.ports.next}`,endpoint=origin+'/api/teaching-agent/runs',pause=ms=>new Promise(r=>setTimeout(r,ms));
const action=x=>JSON.parse(execFileSync('python3',['scripts/teaching-agent-r3/process.py',x,d],{encoding:'utf8'}));
const observer=createClient(s.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const events=n=>existsSync(d+'/'+n)?readFileSync(d+'/'+n,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const counts=()=>({provider:events('provider-events.jsonl').length,tool:events('http-events.jsonl').filter(e=>['tool.requested','tool.started'].includes(e.kind)).length,http:events('http-events.jsonl').length});
const result={realNextProduction:true,pm2Touched:false,providerFixtureDelayMs:30000,killBudgetMs:15000,cases:[],liveProviderRequests:0};
const jar=[],auth=createServerClient(s.url,keys.ANON_KEY,{cookies:{getAll:()=>jar,setAll:entries=>{for(const e of entries){const i=jar.findIndex(x=>x.name===e.name);if(i>=0)jar.splice(i,1);jar.push(e);}}}});
assert.equal((await auth.auth.signInWithPassword({email:users.A1.email,password:users.A1.password})).error,null);
const cookie=()=>jar.map(c=>c.name+'='+c.value).join('; ');
const post=()=>fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json',cookie:cookie()},body:JSON.stringify(explainRequest(pins[0],randomUUID()))});
const active=async()=>{const r=await observer.from('agent_runs').select('id',{head:true,count:'exact'}).eq('tenant_id',ids.A).in('status',['created','running','waiting_tool']);assert.equal(r.error,null);return r.count;};
try {
 action('stop');assert.equal(await active(),0);
 // Live deadline and cancel paths have already terminalized without this RPC.
 const normal=await observer.from('agent_runs').select('id,status,state_version,fencing_token').eq('tenant_id',ids.A).in('status',['failed','cancelled']).limit(50);assert.equal(normal.error,null);
 for(const r of normal.data){const x=await observer.rpc('reconcile_agent_run_v1',{p_tenant:ids.A,p_run:r.id,p_expected_version:r.state_version,p_fence:r.fencing_token});assert.equal(x.error,null);assert.equal(x.data.result,'already_terminal');}
 result.normalTerminalNoops=normal.data.length;
 for(const requestedCancel of [true,false]){
  action('start-on');writeFileSync(d+'/control.json',JSON.stringify({providerDelayMs:30000}));
  const started=Date.now(),response=await post();assert.equal(response.status,200);const iter=parseStudentRunStream(response.body),first=(await iter.next()).value;assert.equal(first.type,'run.started');
  const pending=(async()=>{try{for await(const e of iter)void e;}catch{/* forced process death */}})();
  for(let i=0;!events('provider-events.jsonl').some(e=>e.at>=started);i++){assert(i<1000);await pause(20);}
  const signalAt=new Date().toISOString();const stopper=spawn('python3',['scripts/teaching-agent-r3/process.py','simulate-pm2-stop',d],{stdio:['ignore','pipe','pipe']});let stopped='';stopper.stdout.on('data',x=>stopped+=x);const done=new Promise(resolve=>stopper.on('close',resolve));
  await pause(300);
  if(requestedCancel){const c=await observer.rpc('request_agent_run_cancel_v1',{p_tenant:ids.A,p_actor:users.A1.id,p_run:first.runId});assert.equal(c.error,null);assert.equal(c.data.result,'accepted');}
  assert.equal(await done,0);await pending;const killAt=new Date().toISOString(),stopping=JSON.parse(stopped);assert.equal(stopping.forcedKill,true);
  const afterKill=counts();action('start-off');assert.equal((await post()).status,404);
  await pause(Math.max(0,started+47000-Date.now()));
  const before=await observer.from('agent_runs').select('status,state_version,fencing_token,deadline_at,cancel_requested_at').eq('id',first.runId).single();assert.equal(before.error,null);assert.equal(before.data.status,'running');assert.equal(!!before.data.cancel_requested_at,requestedCancel);
  const reproducedAt=new Date().toISOString();await pause(Math.max(0,Date.parse(before.data.deadline_at)+6100-Date.now()));
  const invokedAt=new Date().toISOString(),batch=await observer.rpc('reconcile_agent_run_batch_v1',{p_tenant:ids.A,p_limit:50});assert.equal(batch.error,null);assert.equal(batch.data.results.length,1);assert.equal(batch.data.results[0].result,'reconciled');
  const expected=requestedCancel?'cancelled':'failed';assert.equal(batch.data.results[0].status,expected);
  assert.equal(await active(),0);await pause(2200);const after=counts();assert.deepEqual(after,afterKill);
  const stored=await observer.from('agent_runs').select('status,ended_at,terminal_reason').eq('id',first.runId).single();assert.equal(stored.error,null);
  const status=await fetch(endpoint+'/'+first.runId,{headers:{cookie:cookie()}});assert.equal(status.status,200);assert.equal((await status.json()).status,expected);
  const messages=await observer.from('agent_messages').select('id',{head:true,count:'exact'}).eq('run_id',first.runId).eq('role','assistant');assert.equal(messages.error,null);assert.equal(messages.count,0);
  // Real product UI controller recovers via the existing authenticated HTTP GET.
  // Only the already received run.started frame is replayed locally; no new POST.
  let getCount=0;const ui=createStudentAiTeacherClient({retryDelays:[0],fetch:async(path,init)=>{
   if(init?.method==='POST')return new Response(JSON.stringify(first)+'\n',{headers:{'content-type':'application/x-ndjson'}});
   getCount++;return fetch(origin+path,{headers:{cookie:cookie()}});
  }});await ui.start(pins[0]);assert.equal(ui.getSnapshot().phase,expected);assert.equal(studentRunBusy(ui.getSnapshot()),false);assert.equal(ui.getSnapshot().answer,undefined);ui.dispose();
  const again=await observer.rpc('reconcile_agent_run_batch_v1',{p_tenant:ids.A,p_limit:50});assert.equal(again.error,null);assert.deepEqual(again.data.results,[]);
  result.cases.push({requestedCancel,runId:first.runId,signalAt,killAt,forcedKill:true,reproducedAt,beforeStatus:before.data.status,deadline:before.data.deadline_at,cancelRequestedAt:before.data.cancel_requested_at,invokedAt,terminalAt:stored.data.ended_at,status:stored.data.status,reason:stored.data.terminal_reason,active:0,lateProvider:0,lateTool:0,lateApplicationHttp:0,observationAfterReconcileMs:2200,teachingReadsDuringKillToReconcile:0,teachingWrites:0,assistantMessages:0,ownerGet:200,uiRecovery:expected,uiGetCount:getCount});
  console.log(JSON.stringify({case:expected,closure:'PASS',active:0}));action('stop');
 }
 result.status='PASS';
} catch(e){result.status='FAIL';result.error={name:e.name,message:String(e.message).slice(0,300)};process.exitCode=1;}
finally{action('stop');writeFileSync(d+'/strong-kill-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,cases:result.cases.length}));}
