import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { transportFixture, req, getReq, cancelReq, eventsOf } from './fixtures/teaching-agent/student-transport.mjs';
import { providerFixture, responseStream, toolResponse } from './fixtures/teaching-agent/student-runtime.mjs';
const { parseStudentRunStream } = await import('../src/features/teaching-agent/client/ndjson-parser.ts');
const { studentTransportEnabled } = await import('../src/features/teaching-agent/server/transport/transport-config.ts');
const { CoreError } = await import('../src/features/agent-core/runtime/errors.ts');
const { ActiveRunAbortRegistry } = await import('../src/features/teaching-agent/server/transport/active-run-abort-registry.ts');
const { createStudentTransportHandlers } = await import('../src/features/teaching-agent/server/transport/student-handlers.ts');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn) { for (let i=0;i<200;i++) { if (await fn()) return; await delay(10); } assert.fail('wait timed out'); }
test('feature exact allowlist and disabled performs no auth/admission/provider', async () => {
 for (const value of ['', 'TRUE','yes','0','false']) assert.equal(studentTransportEnabled(value), false);
 for (const value of ['1','true']) assert.equal(studentTransportEnabled(value), true);
 const f = await transportFixture({ enabled: false });
 assert.equal((await f.handlers.post(req(f.body))).status,404);
 assert.equal(f.authCalls,0); assert.equal(f.persistence,undefined); assert.equal(f.provider.calls.length,0);
});
for (const [name, change, status] of [
 ['authority', b => ({ ...b, authority: {} }),400],['role',b=>({...b,role:'teacher'}),400],['tenant',b=>({...b,tenantId:randomUUID()}),400],
 ['model',b=>({...b,model:'bad'}),400],['prompt',b=>({...b,systemPrompt:'bad'}),400],['tools',b=>({...b,allowedTools:[]}),400],
 ['intent',b=>({...b,intent:'write'}),400],['agent',b=>({...b,agentCode:'teacher-copilot'}),400],['selection',b=>({...b,selection:{}}),400],
 ['nested authority',b=>({...b,selection:{...b.selection,actorId:randomUUID()}}),400],['empty message',b=>({...b,message:''}),400],
]) test(`strict intake rejects ${name}`, async () => { const f=await transportFixture(); assert.equal((await f.handlers.post(req(change(f.body)))).status,status); assert.equal(f.authCalls,0); });
for (const [name, make, status] of [
 ['media', b => new Request('http://localhost/api/teaching-agent/runs',{method:'POST',headers:{origin:'http://localhost','content-type':'text/plain'},body:JSON.stringify(b)}),415],
 ['json', () => new Request('http://localhost/api/teaching-agent/runs',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'{'}),400],
 ['size',b=>req({...b,message:'a'.repeat(33000)}),413],
 ['origin missing',b=>new Request('http://localhost/api/teaching-agent/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),403],
 ['cross origin',b=>new Request('http://localhost/api/teaching-agent/runs',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify(b)}),403],
 ['method',()=>getReq(),405],
]) test(`HTTP ${name}`,async()=>{const f=await transportFixture();assert.equal((await f.handlers.post(make(f.body))).status,status);assert.equal(f.authCalls,0);});
test('unauthenticated and invalid resource never call Provider',async()=>{const f=await transportFixture();f.setOwner(null);assert.equal((await f.handlers.post(req(f.body))).status,401);
 const g=await transportFixture();assert.equal((await g.handlers.post(req({...g.body,selection:{...g.body.selection,expectedRevision:'ta1:revision:'+'0'.repeat(64)}}))).status,403);assert.equal(g.provider.calls.length,0);});
test('full real Runtime -> projected NDJSON -> persistent status -> replay with no extra model calls',async()=>{
 const f=await transportFixture();const response=await f.handlers.post(req(f.body)); assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/ndjson/);assert.equal(response.headers.get('cache-control'),'no-store');
 const es=await eventsOf(response); assert.equal(es[0].type,'run.started');assert.equal(es.at(-1).type,'run.completed');assert.ok(es.some(e=>e.type==='tool.status'));assert.deepEqual(es.map(e=>e.seq),es.map((_,i)=>i+1));
 const answer=es.find(e=>e.type==='answer.final');const status=await(await f.handlers.status(getReq(),es[0].runId)).json();assert.equal(status.finalAnswer,answer.text);
 assert.equal(status.status,'completed');assert.doesNotMatch(JSON.stringify(es),/actorId|tenantId|authority|PRIVATE|tool_calls|teacher_script|systemPrompt/);assert.ok(!es.some(e=>e.type==='answer.delta'));
 const count=f.provider.calls.length, replay=await eventsOf(await f.handlers.post(req(f.body)));assert.equal(replay[0].replayed,true);assert.ok(replay[0].seq > es.at(-1).seq);assert.equal(replay[0].runId,es[0].runId);assert.equal(f.provider.calls.length,count);
 assert.equal((await f.handlers.cancel(cancelReq(),status.runId)).status,200);assert.equal((await f.store.status(status.runId)).status,'completed');
 f.setOwner({actorId:randomUUID(),tenantId:randomUUID()});assert.equal((await f.handlers.status(getReq(),status.runId)).status,404);assert.equal((await f.handlers.cancel(cancelReq(),status.runId)).status,404);
});
test('mandatory evidence failure stays NDJSON 200 without final; GET failed',async()=>{const f=await transportFixture({provider:providerFixture([()=>responseStream({text:'no tool'}),()=>responseStream({text:'no tool'})])});
 const response=await f.handlers.post(req(f.body));assert.equal(response.status,200);const es=await eventsOf(response);assert.equal(es.at(-1).code,'REQUIRED_EVIDENCE_MISSING');assert.ok(!es.some(e=>e.type==='answer.final'));assert.equal((await f.store.status(es[0].runId)).status,'failed');});
test('active replay, conversation busy and digest conflicts do not invoke a second model',async()=>{
 let resume;const pause=new Promise(r=>resume=r);const f=await transportFixture({provider:providerFixture([async b=>{await pause;return responseStream(toolResponse(b));}])});
 const response=await f.handlers.post(req(f.body));await waitFor(()=>f.provider.calls.length===1);const run=[...f.persistence.runs.values()][0];
 const replay=await eventsOf(await f.handlers.post(req(f.body)));assert.equal(replay[0].replayed,true);assert.equal(f.provider.calls.length,1);
 assert.equal((await f.handlers.post(req({...f.body,conversationId:run.conversationId,idempotencyKey:randomUUID()}))).status,409);
 assert.equal((await f.handlers.post(req({...f.body,message:'不同问题'}))).status,409);
 resume();await eventsOf(response);
});
for(const phase of ['context','planning','tool','final']) test(`client disconnect during ${phase} -> persisted cancellation`,async()=>{
 let f,armed=false,stop;const controller=new AbortController();
 const p=providerFixture([async b=>{if(phase==='planning')controller.abort();return responseStream(toolResponse(b));},async()=>{if(phase==='final')controller.abort();return responseStream({text:'는 表示话题。'});}]);
 f=await transportFixture({provider:p,checkpoint:async run=>{if(armed&&((phase==='context'&&run.status==='created')||(phase==='tool'&&run.status==='waiting_tool')))controller.abort();}});armed=true;
 const response=await f.handlers.post(req(f.body,{signal:controller.signal}));if(response.body)await response.text().catch(()=>{});
 await waitFor(()=>{stop=[...f.persistence.runs.values()][0];return stop?.status==='cancelled';});assert.equal(stop.status,'cancelled');assert.ok(f.cancelled.has(stop.id));
});
test('abort before started creates no model calls',async()=>{const f=await transportFixture();const c=new AbortController();c.abort(new CoreError('RUN_CANCELLED'));const response=await f.handlers.post(req(f.body,{signal:c.signal}));assert.notEqual(response.status,200);assert.equal(f.provider.calls.length,0);});
for(const remote of [false,true])test(`${remote?'cross-instance':'local'} cancel endpoint stops at safe boundary, duplicate safe`,async()=>{
 let release;const pause=new Promise(r=>release=r);const f=await transportFixture({provider:providerFixture([async b=>{await pause;return responseStream(toolResponse(b));}])});
 const response=await f.handlers.post(req(f.body));await waitFor(()=>f.provider.calls.length===1);const run=[...f.persistence.runs.values()][0];
 const handlers=remote?createStudentTransportHandlers({...f.deps,registry:new ActiveRunAbortRegistry()}):f.handlers;
 const started=performance.now();assert.equal((await(await handlers.cancel(cancelReq(),run.id)).json()).result,'accepted');assert.equal((await handlers.cancel(cancelReq(),run.id)).status,200);
 release();const es=await eventsOf(response);assert.equal(es.at(-1).type,'run.cancelled');assert.equal((await f.store.status(run.id)).status,'cancelled');assert.equal(f.provider.calls.length,1);
 assert.ok(performance.now()-started<1500);
});
test('disconnect after terminal commit cannot reverse completed',async()=>{const f=await transportFixture();const response=await f.handlers.post(req(f.body));await waitFor(()=>[...f.persistence.runs.values()][0]?.status==='completed');await response.body.cancel();await delay(20);const run=[...f.persistence.runs.values()][0];assert.equal((await f.store.status(run.id)).status,'completed');});
const evt=(seq=1,type='run.started')=>({protocolVersion:1,runId:'00000000-0000-4000-a000-000000000001',seq,at:new Date().toISOString(),type,conversationId:'00000000-0000-4000-a000-000000000002'});
async function parse(text,size=1){const bytes=new TextEncoder().encode(text);const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size));c.close();}});return Array.fromAsync(parseStudentRunStream(stream));}
test('parser split bytes/Korean, many lines per chunk, final no newline',async()=>{const a=evt(),b={...evt(2),'type':'answer.final',text:'한국어',sourceRefs:[],completeness:'complete'};const s=JSON.stringify(a)+'\n'+JSON.stringify(b);assert.equal((await parse(s))[1].text,'한국어');assert.equal((await parse(s,99999)).length,2);});
for(const [name,text]of [['malformed','{'],['oversize','a'.repeat(32769)],['major',JSON.stringify({...evt(),protocolVersion:2})],['duplicate',JSON.stringify(evt())+'\n'+JSON.stringify(evt())]])test(`parser rejects ${name}`,async()=>{await assert.rejects(parse(text));});
test('parser ignores unknown same-major type',async()=>assert.equal((await parse(JSON.stringify({...evt(),type:'future.event'})+'\n'+JSON.stringify(evt(2)))).length,1));
test('transport/public boundaries have no UI/private client imports or raw trace streaming',()=>{
 const client=readFileSync('src/features/teaching-agent/client/ndjson-parser.ts','utf8');assert.doesNotMatch(client,/server\/|RunAuthority|react|Provider/);
 const dir='src/features/teaching-agent/server/transport';for(const name of readdirSync(dir)){const s=readFileSync(`${dir}/${name}`,'utf8');assert.match(s,/import 'server-only'/);assert.doesNotMatch(s,/from ['"]react|SmartTextbook|X-Debug-User|X-Skip-Auth|TEST_BYPASS_AUTH|JSON.stringify\((internalRun|traceEvent|toolResult)/);}
});

test('disconnecting an active replay does not cancel the original worker',async()=>{
 let release;const pause=new Promise(r=>release=r);const f=await transportFixture({provider:providerFixture([async b=>{await pause;return responseStream(toolResponse(b));}])});
 const first=await f.handlers.post(req(f.body));await waitFor(()=>f.provider.calls.length===1);
 const second=await f.handlers.post(req(f.body));await second.body.cancel();await delay(10);assert.equal(f.cancelled.size,0);
 release();assert.equal((await eventsOf(first)).at(-1).type,'run.completed');
});
test('cancel requires Origin and unknown run IDs share not-found projection',async()=>{const f=await transportFixture();
 assert.equal((await f.handlers.cancel(new Request('http://localhost/x',{method:'POST'}),randomUUID())).status,404);
 assert.equal((await f.handlers.status(getReq(),'invalid')).status,404);assert.equal((await f.handlers.status(getReq(),randomUUID())).status,404);
});
test('disconnect while initial authorized context read is pending does not admit a Run',async()=>{
 const f=await transportFixture();let entered;const reading=new Promise(r=>entered=r),c=new AbortController();
 f.h.repository.readAuthorizedContent=async()=>{entered();await new Promise(()=>{});};
 const pending=f.handlers.post(req(f.body,{signal:c.signal}));await reading;c.abort();
 assert.equal((await pending).status,408);assert.equal(f.persistence,undefined);assert.equal(f.provider.calls.length,0);
});
test('late admission after disconnect persists cancellation and cleans up without Provider',async()=>{
 let enter,release;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
 const f=await transportFixture({configurePersistence:p=>{const admit=p.admitRun.bind(p);p.admitRun=async input=>{enter();await hold;return admit(input);};}});
 const c=new AbortController(),response=f.handlers.post(req(f.body,{signal:c.signal}));await entered;c.abort();assert.equal((await response).status,408);
 release();await waitFor(()=>[...f.persistence.runs.values()][0]?.status==='cancelled');assert.equal(f.provider.calls.length,0);assert.equal(f.cancelled.size,1);
});
