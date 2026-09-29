import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {explainRequest} from '../../src/features/teaching-agent/client/selection-state.ts';
import {parseStudentRunStream} from '../../src/features/teaching-agent/client/ndjson-parser.ts';
const d=process.argv[2],read=n=>JSON.parse(readFileSync(d+'/'+n)),state=read('state.json'),keys=read('status.json'),users=read('users.private.json'),pins=read('pins.json');
if(state.marker!=='uply-teaching-agent-r2-disposable-v1'||keys.API_URL!==`http://127.0.0.1:${state.ports.api}`)throw Error('STAGING_ONLY');
const origin=`http://127.0.0.1:${state.ports.next}`,endpoint=origin+'/api/teaching-agent/runs',delay=ms=>new Promise(r=>setTimeout(r,ms));
const events=file=>existsSync(d+'/'+file)?readFileSync(d+'/'+file,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
const count=()=>events('provider-events.jsonl').length;
const control=async(enabled,providerDelayMs=100)=>{writeFileSync(d+'/control.json',JSON.stringify({enabled,providerDelayMs}));await delay(500);};
const result={browser:'Chromium',route:'/r2-lesson',realAuth:true,realRuntime:true,providerFixtureOnly:true,runs:[],negative:[],errors:[]};
let browser;const contexts={};
// Harness-only, read-only observation of Agent infrastructure. Never a Domain dependency.
const observer=createClient(state.url,keys.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const snapshot=async()=>{const out={};for(const table of ['agent_runs','agent_conversations','agent_messages']){const r=await observer.from(table).select('id',{count:'exact',head:true});assert.equal(r.error,null);out[table]=r.count;}return out;};
const save=()=>writeFileSync(d+'/browser-result.json',JSON.stringify(result,null,2));
try{
 browser=await chromium.launch({headless:true});
 // A1 uses the unchanged product login screen. Others use real Auth through SSR cookie storage.
 contexts.A1=await browser.newContext();const page=await contexts.A1.newPage();
 await page.goto(origin+'/login',{timeout:60000});await page.locator('input[name="account"]').fill(users.A1.email);await page.locator('input[name="password"]').fill(users.A1.password);
 const loginResponse=page.waitForResponse(r=>r.url().includes('/auth/v1/token')&&r.request().method()==='POST');
 await page.locator('button[type="submit"]').click();assert.equal((await loginResponse).status(),200);
 await delay(1000);await page.goto(origin+'/r2-lesson',{timeout:60000});
 for(const label of Object.keys(users).filter(x=>x!=='A1')){
  const jar=[];const c=createServerClient(state.url,keys.ANON_KEY,{cookies:{getAll:()=>jar,setAll:entries=>{for(const e of entries){const old=jar.findIndex(x=>x.name===e.name);if(old>=0)jar.splice(old,1);jar.push(e);}}}});
  const login=await c.auth.signInWithPassword({email:users[label].email,password:users[label].password});assert.equal(login.error,null);
  contexts[label]=await browser.newContext();await contexts[label].addCookies(jar.map(c=>({name:c.name,value:c.value,url:origin,path:undefined,sameSite:'Lax'})));
 }
 const cookies=async label=>(await contexts[label].cookies(origin)).map(c=>c.name+'='+c.value).join('; ');
 const post=async(label,body)=>fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json',cookie:await cookies(label)},body:JSON.stringify(body)});
 const get=async(label,id,cancel=false)=>fetch(endpoint+'/'+id+(cancel?'/cancel':''),{method:cancel?'POST':'GET',headers:{origin,cookie:await cookies(label)}});
 result.off={buttons:await page.getByRole('button',{name:/解释这句话/}).count(),postStatus:(await post('A1',explainRequest(pins[0],randomUUID()))).status,providerCalls:count()};
 assert.equal(result.off.buttons,0);assert.equal(result.off.postStatus,404);assert.equal(count(),0);
 execFileSync('python3',['scripts/teaching-agent-r2/observe.py','before',d]);
 await control(true);
 for(const label of ['A2','B1','TA','AA','PO','EX','IN']){
  const r=await post(label,explainRequest(pins[0],randomUUID()));result.negative.push({case:label,post:r.status});assert.equal(r.status,403);
  if(['A2','B1'].includes(label)){const p=await contexts[label].newPage();await p.goto(origin+'/r2-lesson');result.negative.at(-1).buttons=await p.getByRole('button',{name:/解释这句话/}).count();assert.equal(result.negative.at(-1).buttons,0);await p.close();}
 }
 const noAuth=await fetch(endpoint,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(explainRequest(pins[0],randomUUID()))});result.noAuthStatus=noAuth.status;assert.equal(noAuth.status,401);
 await page.goto(origin+'/r2-lesson');const first=page.getByRole('button',{name:'解释这句话：저는 학생입니다.',exact:true}).first();await first.waitFor({timeout:20000});
 const captured=[];page.on('request',r=>{if(r.url()===endpoint&&r.method()==='POST')captured.push(JSON.parse(r.postData()));});
 const uiResponse=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST');
 const start=performance.now();await first.click();await page.getByText('讲解已完成',{exact:true}).waitFor({timeout:50000});
 const uiFrames=(await (await uiResponse).text()).trim().split('\n').map(line=>JSON.parse(line));
 const originalRunId=uiFrames.find(e=>e.type==='run.started')?.runId;assert.ok(originalRunId);
 result.ui={completed:true,sourceBadge:await page.getByText('依据当前课文',{exact:true}).count(),ms:Math.round(performance.now()-start),privateLeak:/ta1:|SYNTHETIC-PRIVATE|SYNTHETIC-ANSWER|DeepSeek|Supabase|get_current_lesson_context|[0-9a-f]{8}-[0-9a-f]{4}-/.test(await page.getByRole('dialog').innerText())};
 assert.equal(result.ui.sourceBadge,1);assert.equal(result.ui.privateLeak,false);await page.screenshot({path:d+'/ui-completed.png'});
 const firstBody=captured[0];assert.ok(pins.some(p=>p.segmentRef===firstBody.selection.segmentRef));
 const beforeReplay=count(),beforeReplayRows=await snapshot(),replayEvents=[];for await(const e of parseStudentRunStream((await post('A1',firstBody)).body))replayEvents.push(e);
 const runId=replayEvents[0].runId;result.replay={sameRun:runId===originalRunId,sameConversation:replayEvents[0].conversationId===uiFrames[0].conversationId,replayed:replayEvents[0].replayed,extraProviderCalls:count()-beforeReplay};assert.equal(result.replay.sameRun,true);assert.equal(result.replay.sameConversation,true);result.replay.extraRows=await snapshot();for(const t of Object.keys(beforeReplayRows))result.replay.extraRows[t]-=beforeReplayRows[t];assert.deepEqual(Object.values(result.replay.extraRows),[0,0,0]);assert.equal(result.replay.replayed,true);assert.equal(result.replay.extraProviderCalls,0);
 result.conflicts=[];
 for(const [name,body] of [['message',{...firstBody,message:'请换一种方式解释。'}],['segment',explainRequest(pins.find(p=>p.nodeId!==pins[0].nodeId&&p.locale===pins[0].locale),firstBody.idempotencyKey)]]){
  const before=await snapshot(),calls=count(),r=await post('A1',body),payload=await r.json();result.conflicts.push({case:name,status:r.status,code:payload.code,extraProviderCalls:count()-calls});assert.equal(r.status,409);assert.equal(payload.code,'IDEMPOTENCY_CONFLICT');assert.deepEqual(await snapshot(),before);assert.equal(count(),calls);
 }
 // The replay joins the existing active run; it never owns a second execution.
 await control(true,3000);const activeBody=explainRequest(pins[0],randomUUID()),active=await post('A1',activeBody),activeIter=parseStudentRunStream(active.body),activeStart=(await activeIter.next()).value;
 while(count()===beforeReplay)await delay(20);
 const activeRows=await snapshot(),activeCalls=count(),activeReplay=[];for await(const e of parseStudentRunStream((await post('A1',activeBody)).body))activeReplay.push(e);
 result.activeReplay={sameRun:activeReplay[0].runId===activeStart.runId,sameConversation:activeReplay[0].conversationId===activeStart.conversationId,replayed:activeReplay[0].replayed,extraProviderCalls:count()-activeCalls};assert.equal(result.activeReplay.sameRun,true);assert.equal(result.activeReplay.sameConversation,true);assert.equal(result.activeReplay.replayed,true);assert.equal(result.activeReplay.extraProviderCalls,0);assert.deepEqual(await snapshot(),activeRows);
 const activeFrames=[];for await(const e of activeIter)activeFrames.push(e);assert.equal(activeFrames.at(-1).type,'run.completed');await control(true);
 for(const label of ['A2','B1']){const r=await get(label,runId),cancel=await get(label,runId,true);result.negative.push({case:label+' run ownership',status:r.status,cancel:cancel.status});assert.equal(r.status,404);assert.equal(cancel.status,404);}
 const status=await(await get('A1',runId)).json();result.ownerStatus=status.status;assert.equal(status.status,'completed');
 for(let i=0;i<3;i++){
  const calls=count(),at=performance.now(),r=await post('A1',explainRequest(pins[0],randomUUID())),frames=[];assert.equal(r.status,200);
  for await(const e of parseStudentRunStream(r.body))frames.push({type:e.type,atMs:Math.round(performance.now()-at)});
  result.runs.push({sample:i+1,ms:Math.round(performance.now()-at),providerCalls:count()-calls,frames});assert.equal(frames.at(-1).type,'run.completed');
 }
 // Actual HTTP negative selections, still real JWT/Domain Policy.
 for(const [name,patch] of [['index',{segmentIndex:999}],['revision',{expectedRevision:'ta1:revision:'+'0'.repeat(64)}],['draft',{scriptVersionId:read('fixture.json').adraftVersion}],['otherLesson',{lessonId:read('fixture.json').blesson}],['otherNode',{nodeId:read('fixture.json').bnodes[0]}]]){
  const b=explainRequest(pins[0],randomUUID());Object.assign(b.selection,patch);const calls=count(),r=await post('A1',b);result.negative.push({case:name,status:r.status,providerCalls:count()-calls});assert.equal(r.status,403);assert.equal(count(),calls);
 }
 // Warm status/cancel routing before a slow provider run.
 await get('A1',runId,true);await control(true,10000);
 const cancelling=await post('A1',explainRequest(pins[0],randomUUID())),iter=parseStudentRunStream(cancelling.body),started=(await iter.next()).value;
 await control(false,10000);const offNew=await post('A1',explainRequest(pins[0],randomUUID())),offOwner=await get('A1',runId);const ct=performance.now(),cr=await get('A1',started.runId,true);const rest=[];for await(const e of iter)rest.push(e);
 result.cancel={status:cr.status,terminal:rest.at(-1)?.type,ms:Math.round(performance.now()-ct),persisted:(await(await get('A1',started.runId)).json()).status,offNew:offNew.status,offOwnerGet:offOwner.status};
 assert.equal(result.cancel.persisted,'cancelled');assert.equal(result.cancel.offNew,404);assert.equal(result.cancel.offOwnerGet,200);
 // A real 45-second HTTP budget; only the Provider waits. No shortened clock or runtime stub.
 await control(true,60000);const calls=count(),at=performance.now(),slow=await post('A1',explainRequest(pins[0],randomUUID()));assert.equal(slow.status,200);const frames=[];
 for await(const e of parseStudentRunStream(slow.body))frames.push(e);
 result.deadline={ms:Math.round(performance.now()-at),providerCalls:count()-calls,terminal:frames.at(-1)?.type,code:frames.at(-1)?.code};
 result.deadline.terminalAt=Date.now();result.deadline.receivedAt=events('request-events.jsonl').at(-1)?.receivedAt;result.deadline.fromReceivedAtMs=result.deadline.terminalAt-Date.parse(result.deadline.receivedAt);
 const infrastructure=new Set(['agent_definition_versions','agent_conversations','agent_messages','agent_runs','agent_run_events','ai_token_usage']);
 const infrastructureRpc=new Set(['admit_agent_run_v1','transition_agent_run_v1','append_agent_run_event_v1','append_agent_run_event_v2','record_agent_usage_v1','reserve_student_agent_event_sequence_v1','get_student_agent_run_status_v1','request_agent_run_cancel_v1','check_agent_run_cancel_v1']);
 const domain=e=>e.path.startsWith('/rest/v1/')&&!(e.path.includes('/rpc/')?infrastructureRpc.has(e.path.split('/').at(-1)):infrastructure.has(e.path.split('/').at(-1)));
 const domainRead=e=>domain(e)&&(e.method==='GET'||e.path.includes('/rpc/'));
 const domainWrite=e=>domain(e)&&e.method!=='GET'&&e.method!=='HEAD';
 const tool=e=>e.kind==='tool.requested'||e.kind==='tool.started';
 const observed=()=>({provider:count(),reads:events('http-events.jsonl').filter(domainRead).length,writes:events('http-events.jsonl').filter(domainWrite).length,tools:events('http-events.jsonl').filter(tool).length});
 assert(events('http-events.jsonl').some(e=>e.path.endsWith('/student_learning_agent_script_nodes')),'real teaching reads must be observed');assert(events('http-events.jsonl').some(tool),'real prior Tool starts must be observed');
 const after=observed();await delay(2200);const late=observed();
 result.deadline.lateProviderCalls=late.provider-after.provider;result.deadline.lateDomainReads=late.reads-after.reads;result.deadline.lateDomainWrites=late.writes-after.writes;result.deadline.lateToolCalls=late.tools-after.tools;result.deadline.observationMs=Date.now()-result.deadline.terminalAt;
 const cutoff=Date.parse(result.deadline.receivedAt),http=events('http-events.jsonl').filter(e=>e.at>=cutoff);
 result.deadline.lastProviderAt=events('provider-events.jsonl').filter(e=>e.at>=cutoff).at(-1)?.at??null;
 result.deadline.lastToolAt=http.filter(tool).at(-1)?.at??null;result.deadline.lastTeachingReadAt=http.filter(domainRead).at(-1)?.at??null;
 const terminal=await observer.from('agent_runs').select('status,ended_at,deadline_at').eq('id',frames[0].runId).single();assert.equal(terminal.error,null);result.deadline.persistence=terminal.data;assert.equal(terminal.data.status,'failed');
 result.deadline.infrastructureTables=[...infrastructure];result.deadline.infrastructureRpcs=[...infrastructureRpc];
 assert.equal(result.deadline.code,'DEADLINE_EXCEEDED');assert.equal(result.deadline.lateProviderCalls,0);assert.equal(result.deadline.lateDomainReads,0);assert.equal(result.deadline.lateDomainWrites,0);assert.equal(result.deadline.lateToolCalls,0);assert.equal(result.deadline.providerCalls,1);
 await control(false);await page.goto(origin+'/r2-lesson');result.offRecoveryHidden=await page.getByRole('button',{name:/解释这句话/}).count()===0;
 execFileSync('python3',['scripts/teaching-agent-r2/observe.py','after',d]);
 result.liveProviderRuns=0;result.liveProviderRequests=0;result.liveProviderTokens=0;result.fixtureProviderCalls=count();save();console.log(JSON.stringify(result));
}catch(e){result.errors.push({name:e.name,message:String(e.message).slice(0,500)});save();console.log(JSON.stringify(result));process.exitCode=1;}
finally{await browser?.close();}
