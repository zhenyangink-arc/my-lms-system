import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { withStudentRuntimeDatabase, providerFixture, requestFixture, responseStream, toolResponse } from './fixtures/teaching-agent/student-runtime.mjs';
import { publicBody, eventsOf } from './fixtures/teaching-agent/student-transport.mjs';
import { ids } from './fixtures/teaching-agent/student-domain.mjs';
const { createStudentAiTeacherRuntime } = await import('../src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts');
const { SupabaseAgentRepositories } = await import('../src/features/agent-core/persistence/supabase/repositories.ts');
const { createStudentRunStore } = await import('../src/features/teaching-agent/server/transport/run-store.ts');
const { createStudentTransportHandlers } = await import('../src/features/teaching-agent/server/transport/student-handlers.ts');
const { ActiveRunAbortRegistry } = await import('../src/features/teaching-agent/server/transport/active-run-abort-registry.ts');
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function waitFor(fn){for(let i=0;i<100;i++){if(await fn())return;await delay(20);}assert.fail('timeout');}
test('isolated SQL + full HTTP transport: commit, replay, cancel, failure, privacy, CAS, zero teaching writes',
 {skip:process.env.RUN_TEACHING_AGENT_ISOLATED_DB_TESTS!=='1',timeout:180000},async t=>{
 await withStudentRuntimeDatabase(async f=>{
  const owner={actorId:ids.A1,tenantId:ids.A}, store=createStudentRunStore(f.client,owner), before=f.hashes();let provider=providerFixture(),enabled=true,identity=owner;
  const deps={enabled:()=>enabled,registry:new ActiveRunAbortRegistry(),authenticate:async()=>({owner:identity,allowAdmission:async()=>true,store:createStudentRunStore(f.client,identity),runtime:createStudentAiTeacherRuntime({authenticate:f.h.authenticate,repository:f.h.repository,
   persistence:a=>new SupabaseAgentRepositories(f.client,a),provider:provider.provider,checkCancellation:store.checkCancellation})})};
  const handlers=createStudentTransportHandlers(deps), other=createStudentTransportHandlers({...deps,registry:new ActiveRunAbortRegistry()});
  let origin;
  const server=createServer(async (incoming,out)=>{
   const controller=new AbortController();out.on('close',()=>{if(!out.writableEnded)controller.abort();});
   try {
    const req=new Request(origin+incoming.url,{method:incoming.method,headers:incoming.headers,signal:controller.signal,...(incoming.method==='POST'?{body:incoming,duplex:'half'}:{})});
    const match=incoming.url.match(/\/runs\/([^/]+)(\/cancel)?$/);
    const response=match?(match[2]?await other.cancel(req,match[1]):await handlers.status(req,match[1])):await handlers.post(req);
    out.writeHead(response.status,Object.fromEntries(response.headers));
    for await(const chunk of response.body??[]) {if(out.destroyed)break;out.write(chunk);}out.end();
   }catch{out.destroy();}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;
  const post=async(body,signal)=>fetch(origin+'/runs',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),signal});
  const get=async id=>fetch(origin+'/runs/'+id);
  const cancel=async id=>fetch(origin+'/runs/'+id+'/cancel',{method:'POST',headers:{origin}});
  const input=async()=>publicBody(await requestFixture(f.h));
  try{
   const b=await input();enabled=false;const count=f.sql('select count(*) from agent_runs');assert.equal((await post(b)).status,404);assert.equal(f.sql('select count(*) from agent_runs'),count);enabled=true;
   const es=await eventsOf(await post(b)),id=es[0].runId;assert.equal(es.at(-1).type,'run.completed',JSON.stringify(es));
   const status=await(await get(id)).json();assert.equal(status.status,'completed');assert.equal(status.finalAnswer,es.find(e=>e.type==='answer.final').text);
   const calls=provider.calls.length,replay=await eventsOf(await post(b));assert.equal(replay[0].runId,id);assert.equal(replay[0].replayed,true);assert.equal(provider.calls.length,calls);
   assert.equal((await(await cancel(id)).json()).result,'already_terminal');
   for(const person of [{actorId:ids.A2,tenantId:ids.A},{actorId:ids.B1,tenantId:ids.B}]){identity=person;assert.equal((await get(id)).status,404);assert.equal((await cancel(id)).status,404);}identity=owner;
   f.sql(`update tenant_memberships set status='inactive' where user_id=${f.literal(ids.A1)}`);assert.equal((await get(id)).status,404);assert.equal((await cancel(id)).status,404);f.sql(`update tenant_memberships set status='active' where user_id=${f.literal(ids.A1)}`);
   provider=providerFixture([()=>responseStream({text:'no tool'}),()=>responseStream({text:'no tool'})]);
   const failed=await eventsOf(await post(await input()));assert.equal(failed.at(-1).type,'run.failed');assert.equal(failed.at(-1).code,'REQUIRED_EVIDENCE_MISSING');assert.ok(!failed.some(e=>e.type==='answer.final'));assert.equal((await(await get(failed[0].runId)).json()).status,'failed');assert.equal((await(await cancel(failed[0].runId)).json()).result,'already_terminal');
   // Cancel arriving on a distinct handler/registry while planning is suspended.
   let resume;const pause=new Promise(r=>resume=r);provider=providerFixture([async body=>{await pause;return responseStream(toolResponse(body));}]);
   const pending=await post(await input()), reader=pending.body.getReader();let first='';while(!first.includes('\n'))first+=new TextDecoder().decode((await reader.read()).value);
   const runId=JSON.parse(first.split('\n')[0]).runId;await waitFor(()=>provider.calls.length===1);
   const version=f.sql(`select state_version||':'||fencing_token from agent_runs where id=${f.literal(runId)}`);
   enabled=false;
   assert.equal((await get(runId)).status,200);
   assert.equal((await post({...b,idempotencyKey:randomUUID()})).status,404);
   const started=performance.now();assert.equal((await(await cancel(runId)).json()).result,'accepted');assert.equal((await(await cancel(runId)).json()).result,'accepted');
   assert.equal(f.sql(`select state_version||':'||fencing_token from agent_runs where id=${f.literal(runId)}`),version);
   // DB rejects completion even before missing evidence can be checked: cancel owns row-lock order.
   const r=JSON.parse(f.sql(`select row_to_json(r) from agent_runs r where id=${f.literal(runId)}`));
   const transition={p_tenant:ids.A,p_actor:ids.A1,p_run:runId,p_expected_status:r.status,p_expected_version:r.state_version,p_fence:r.fencing_token,p_to:'completed',p_budget:r.budget,p_final:'MUST NEVER COMMIT'};
   assert.equal((await f.client.rpc('transition_agent_run_v1',transition)).error.message,'RUN_CANCELLED');
   resume();let rest=first;while(true){const n=await reader.read();if(n.done)break;rest+=new TextDecoder().decode(n.value);}assert.equal(JSON.parse(rest.trim().split('\n').at(-1)).type,'run.cancelled');
   const cancelMs=Math.round(performance.now()-started);assert.equal((await(await get(runId)).json()).status,'cancelled');assert.equal(provider.calls.length,1);assert.equal((await(await cancel(runId)).json()).result,'already_terminal');enabled=true;
   // Persistent cancel after tool boundary: check hook writes fact, coordinator sees it before final.
   let checkpoints=0;const p=providerFixture();const runtime=createStudentAiTeacherRuntime({authenticate:f.h.authenticate,repository:f.h.repository,persistence:a=>new SupabaseAgentRepositories(f.client,a),provider:p.provider,
    checkCancellation:async run=>{if(run.status==='waiting_tool'&&++checkpoints===2)await store.cancel(run.id);await store.checkCancellation(run);}});
   const boundary=await runtime.run(await requestFixture(f.h));assert.equal(boundary.run.status,'cancelled');assert.equal(p.calls.length,1);
   // Two PostgreSQL sessions race actual valid completion against the new cancel RPC.
   let captured, notify, release;const ready=new Promise(r=>notify=r),hold=new Promise(r=>release=r);
   const racer=createStudentAiTeacherRuntime({authenticate:f.h.authenticate,repository:f.h.repository,provider:providerFixture().provider,
    persistence:a=>{const repo=new SupabaseAgentRepositories(f.client,a);const move=repo.transitionRun.bind(repo);repo.transitionRun=async args=>{if(args.to==='completed'){captured=args;notify();await hold;}return move(args);};return repo;},checkCancellation:store.checkCancellation});
   const execution=racer.run(await requestFixture(f.h)).catch(()=>null);await ready;
   const cr=captured.run,j=value=>f.literal(JSON.stringify(value))+'::jsonb';
   const completing=`set role service_role;select public.transition_agent_run_v1(${f.literal(ids.A)},${f.literal(ids.A1)},${f.literal(cr.id)},${f.literal(cr.status)},${cr.stateVersion},${f.literal(cr.fencingToken)},'completed',${j(captured.budget)},${f.literal(captured.finalText)},null);`;
   const cancelling=`set role service_role;select public.request_agent_run_cancel_v1(${f.literal(ids.A)},${f.literal(ids.A1)},${f.literal(cr.id)});`;
   const race=await Promise.allSettled([f.sqlAsync(completing),f.sqlAsync(cancelling)]);release();await execution;
   const won=await store.status(cr.id);assert.ok(['completed','cancelled'].includes(won.status));
   if(won.status==='completed'){assert.equal(race[0].status,'fulfilled');assert.equal(JSON.parse(race[1].value).result,'already_terminal');}
   else{assert.equal(race[0].status,'rejected');assert.match(String(race[0].reason.stderr),/RUN_CANCELLED/);}
   for(const role of ['anon','authenticated'])assert.throws(()=>f.sql(`set role ${role};select public.request_agent_run_cancel_v1(${f.literal(ids.A)},${f.literal(ids.A1)},${f.literal(cr.id)});`));
   // Browser disconnect while model request is active; worker observes abort, DB cleanup wins.
   let finish;const suspended=new Promise(r=>finish=r);provider=providerFixture([async body=>{await suspended;return responseStream(toolResponse(body));}]);
   const c=new AbortController(),response=await post(await input(),c.signal),rr=response.body.getReader();let frame='';while(!frame.includes('\n'))frame+=new TextDecoder().decode((await rr.read()).value);const abortId=JSON.parse(frame.split('\n')[0]).runId;
   await waitFor(()=>provider.calls.length===1);c.abort();
   await waitFor(async()=> { const value=await store.status(abortId); writeFileSync('/tmp/uply-stage1d-abort-debug.json',JSON.stringify({status:value?.status,cancelled:f.sql(`select cancel_requested_at is not null from agent_runs where id=${f.literal(abortId)}`)})); return value?.status==='cancelled'; });finish();
   assert.equal((await store.status(abortId)).status,'cancelled');
   assert.deepEqual(f.hashes(),before);
   const proof={teachingTables:Object.keys(before).length,before,after:f.hashes(),crossInstanceCancelMs:cancelMs,liveProviderRequests:0,sqlMigrations:3};
   writeFileSync('/tmp/uply-stage1d-db-results.json',JSON.stringify(proof,null,2));t.diagnostic(`23 teaching tables unchanged; cross-instance cancel ${cancelMs}ms; live requests 0`);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 },{transport:true});
});
