// Offline, owned PostgreSQL only; no Full Supabase stack or production connection.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {withStudentRuntimeDatabase,providerFixture,requestFixture} from '../../tests/fixtures/teaching-agent/student-runtime.mjs';
import {ids} from '../../tests/fixtures/teaching-agent/student-domain.mjs';
const checks=[];const check=(name,value)=>{assert(value,name);checks.push(name);};
await withStudentRuntimeDatabase(async f=>{
 f.sql(readFileSync('supabase/migrations/202609140006_agent_run_reconciliation.sql','utf8'));
 const before=f.hashes(),completed=await f.createRuntime(providerFixture().provider).run(await requestFixture(f.h));
 check('unchanged runtime completion',completed.run.status==='completed');
 const q=f.literal,j=x=>q(JSON.stringify(x))+'::jsonb';
 const row=id=>JSON.parse(f.sql(`select row_to_json(r) from agent_runs r where id=${q(id)}`));
 const rec=(r,tenant=ids.A)=>`select reconcile_agent_run_v1(${q(tenant)},${q(r.id)},${r.state_version},${q(r.fencing_token)});`;
 const invoke=r=>JSON.parse(f.sql('set role service_role;'+rec(r)));
 let r=row(completed.run.id),snapshot=JSON.stringify(r);check('completed immutable',invoke(r).result==='already_terminal'&&JSON.stringify(row(r.id))===snapshot);
 const admit=(expired,cancel)=>{
  const deadline=new Date(Date.now()+40000).toISOString(),profile=f.definition.profile,budget={...profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:deadline};
  const x=JSON.parse(f.sql(`set role service_role;select admit_agent_run_v1(${q(ids.A)},${q(ids.A1)},${q(randomUUID())},'student-ai-teacher','korean','lesson','r3b-synthetic',${q(randomUUID())},${q('b'.repeat(64))},'synthetic question','1.0.0',${j(profile.allowedSkillRefs[0])},${j(budget)},${q(deadline)});`)).run;
  if(expired)f.sql(`update agent_runs set deadline_at=clock_timestamp()-interval '10 seconds',lease_expires_at=clock_timestamp()-interval '10 seconds' where id=${q(x.id)}`);
  if(cancel)f.sql(`update agent_runs set cancel_requested_at=clock_timestamp()-interval '20 seconds' where id=${q(x.id)}`);
  return row(x.id);
 };
 r=admit(true,false);check('wrong tenant not found',JSON.parse(f.sql('set role service_role;'+rec(r,ids.B))).result==='not_found');
 check('wrong fence rejected',invoke({...r,fencing_token:randomUUID()}).result==='fence_conflict');
 check('deadline orphan failed',invoke(r).status==='failed');const count=f.sql(`select count(*) from agent_run_events where run_id=${q(r.id)}`);
 check('idempotent events',invoke(r).result==='already_terminal'&&f.sql(`select count(*) from agent_run_events where run_id=${q(r.id)}`)===count&&count==='2');
 assert.throws(()=>f.sql(`set role service_role;select transition_agent_run_v1(${q(ids.A)},${q(ids.A1)},${q(r.id)},${q(r.status)},${r.state_version},${q(r.fencing_token)},'completed',${j(r.budget)},'late final',null);`));checks.push('late completion rejected');
 check('no assistant for reconciled',f.sql(`select count(*) from agent_messages where run_id=${q(r.id)} and role='assistant'`)==='0');
 r=admit(true,true);check('cancel orphan cancelled',invoke(r).status==='cancelled');check('cancelled immutable',invoke(r).result==='already_terminal');
 const future=admit(false,true);check('future deadline protected',invoke(future).result==='not_eligible');
 for(const role of ['anon','authenticated']){
  assert.throws(()=>f.sql(`set role ${role};${rec(future)}`));checks.push(role+' denied');
 }
 const expired=admit(true,false);const batch=JSON.parse(f.sql(`set role service_role;select reconcile_agent_run_batch_v1(${q(ids.A)},1);`));check('bounded batch',batch.results.length===1&&batch.results[0].runId===expired.id);check('future survived batch',row(future.id).status==='created');
 assert.throws(()=>f.sql(`set role service_role;select reconcile_agent_run_batch_v1(${q(ids.A)},101);`));checks.push('oversize batch rejected');
 const owner=JSON.parse(f.sql(`set role service_role;select get_student_agent_run_status_v1(${q(ids.A)},${q(ids.A1)},${q(expired.id)});`));check('owner sees failed',owner.status==='failed');
 assert.deepEqual(f.hashes(),before);checks.push('23 teaching table hashes unchanged');
},{transport:true});
const out={status:'PASS',assertions:checks.length,checks,network:'none',fullSupabase:false,liveProviderRequests:0,productionWrites:0,cleanup:'owned fixture finally removed container',sqlVersions:['202609140000','202609140001','202609140002','202609140006'],scope:'Targeted R3A RPC regression; full Auth/RLS and two-session kill evidence remains R3A'};
writeFileSync(process.argv[2],JSON.stringify(out,null,2));console.log(JSON.stringify({status:'PASS',assertions:checks.length}));
