import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { transportFixture, req, getReq, cancelReq, eventsOf } from './fixtures/teaching-agent/student-transport.mjs';
import { ids } from './fixtures/teaching-agent/student-domain.mjs';
import { providerFixture, responseStream, toolResponse } from './fixtures/teaching-agent/student-runtime.mjs';
const { TeachingAgentRolloutPolicy, createStudentRolloutAdmission } = await import('../src/features/teaching-agent/server/transport/rollout-policy.ts');
const owner={actorId:ids.A1,tenantId:ids.A},course='00000000-0000-4000-8000-000000000102';
const allowed=()=>({enabled:'true',tenants:ids.A,courses:course,users:ids.A1});
function clientFor(lessonId,courseId=course,hold) {
 const reads=[];
 return {reads,from(table){assert.equal(table,'lessons');return {select(columns){assert.equal(columns,'id,course_id');return this;},eq(k,v){assert.equal(k,'id');reads.push(v);return this;},abortSignal(){return this;},async maybeSingle(){await hold;return {data:reads.at(-1)===lessonId?{id:lessonId,course_id:courseId}:null,error:null};}};}};
}
for(const [name,config,identity,expect] of [
 ['global OFF',{...allowed(),enabled:'false'},owner,false],
 ['global ON empty lists',{enabled:'true'},owner,false],
 ['tenant allowed course denied',{...allowed(),courses:randomUUID()},owner,false],
 ['course allowed tenant denied',{...allowed(),tenants:ids.B},owner,false],
 ['wrong user',allowed(),{...owner,actorId:ids.A2},false],
 ['same user different active tenant',allowed(),{...owner,tenantId:ids.B},false],
 ['all three allowed',allowed(),owner,true],
 ['wildcard denies',{...allowed(),courses:'*'},owner,false],
 ['mixed invalid denies entire list',{...allowed(),users:ids.A1+',not-a-uuid'},owner,false],
 ['UUID case and whitespace',{...allowed(),users:' '+ids.A1.toUpperCase()+'\n'},owner,true],
])test(`rollout UI/POST shared admission: ${name}`,async()=>{
 const policy=new TeachingAgentRolloutPolicy(()=>config);assert.equal(policy.allows(identity,course),expect);
 const f=await transportFixture();const client=clientFor(f.body.selection.lessonId),admit=createStudentRolloutAdmission(client,identity,policy);
 // The page projection and POST composition both use this exact server resolver.
 const pageAllowed=await admit(f.body.selection.lessonId,new AbortController().signal);
 const original=f.deps.authenticate;f.deps.authenticate=async()=>({...await original(),allowAdmission:admit});
 const response=await f.handlers.post(req(f.body));assert.equal(pageAllowed,expect);assert.equal(response.status,expect?200:403);
 if(expect)assert.equal((await eventsOf(response)).at(-1).type,'run.completed');
 else{assert.equal(f.provider.calls.length,0);assert.equal(f.persistence,undefined);}
});
test('server course resolution ignores forged browser pilot fields and headers',async()=>{
 const f=await transportFixture({allowAdmission:async()=>false});
 for(const field of ['pilot','tenantOverride','courseOverride','userOverride','courseId'])assert.equal((await f.handlers.post(req({...f.body,[field]:true}))).status,400);
 assert.equal((await f.handlers.post(req(f.body,{headers:{origin:'http://localhost','content-type':'application/json','X-Agent-Allow':'true'}}))).status,403);
 const bad=createStudentRolloutAdmission(clientFor(f.body.selection.lessonId,randomUUID()),owner,new TeachingAgentRolloutPolicy(allowed));assert.equal(await bad(f.body.selection.lessonId,new AbortController().signal),false);
 assert.equal(f.provider.calls.length,0);
});
test('OFF is rechecked after async admission, with no new run/provider',async()=>{
 let enabled=true,release;const hold=new Promise(r=>release=r),f=await transportFixture({allowAdmission:async()=>{await hold;return true;}});f.deps.enabled=()=>enabled;
 const pending=f.handlers.post(req(f.body));await new Promise(r=>setTimeout(r,10));enabled=false;release();assert.equal((await pending).status,404);assert.equal(f.provider.calls.length,0);assert.equal(f.persistence,undefined);
});
test('OFF and removed allowlist preserve owner status/cancel, never new admission',async()=>{
 let release;const hold=new Promise(r=>release=r);const f=await transportFixture({provider:providerFixture([async b=>{await hold;return responseStream(toolResponse(b));}])});
 const pending=await f.handlers.post(req(f.body));while(f.provider.calls.length<1)await new Promise(r=>setTimeout(r,5));const run=[...f.persistence.runs.values()][0];
 f.deps.enabled=()=>false;const oldAuth=f.deps.authenticate;f.deps.authenticate=async()=>({...await oldAuth(),allowAdmission:async()=>false});
 assert.equal((await f.handlers.post(req({...f.body,idempotencyKey:randomUUID()}))).status,404);assert.equal(f.persistence.runs.size,1);
 assert.equal((await f.handlers.status(getReq(),run.id)).status,200);assert.equal((await f.handlers.cancel(cancelReq(),run.id)).status,200);
 release();assert.equal((await eventsOf(pending)).at(-1).type,'run.cancelled');assert.equal(f.provider.calls.length,1);
 assert.equal((await(await f.handlers.status(getReq(),run.id)).json()).status,'cancelled');
 for(const other of [{actorId:ids.A2,tenantId:ids.A},{actorId:ids.B1,tenantId:ids.B},{actorId:ids.A1,tenantId:ids.B}]){f.setOwner(other);assert.equal((await f.handlers.status(getReq(),run.id)).status,404);assert.equal((await f.handlers.cancel(cancelReq(),run.id)).status,404);}
 f.setOwner(null);assert.equal((await f.handlers.status(getReq(),run.id)).status,401);assert.equal((await f.handlers.cancel(cancelReq(),run.id)).status,401);
});
test('OFF cancel still enforces Origin and unknown owner-safe IDs',async()=>{
 const f=await transportFixture({enabled:false});assert.equal((await f.handlers.cancel(new Request('http://localhost/api/teaching-agent/runs/x/cancel',{method:'POST',headers:{origin:'https://forged.invalid'}}),randomUUID())).status,404);
 assert.equal((await f.handlers.status(getReq(),randomUUID())).status,404);assert.equal(f.provider.calls.length,0);assert.equal(f.persistence,undefined);
});
test('production page and transport both resolve course with user client, never client config',()=>{
 const page=readFileSync('src/features/teaching-agent/server/page-projection/lesson-slots.tsx','utf8'),server=readFileSync('src/features/teaching-agent/server/transport/production.ts','utf8');
 assert.ok(page.indexOf('if (!await createStudentRolloutAdmission')<page.indexOf(".from('learning_agent_lessons')"));assert.match(server,/createStudentRolloutAdmission\(auth.supabase, owner\)/);
 assert.match(page,/createStudentRolloutAdmission\(input.supabase/);assert.doesNotMatch(page,/ALLOWED_TENANTS|ALLOWED_COURSES|ALLOWED_USERS/);
});
