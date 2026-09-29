import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isolatedPostgres,publicationMigration,completionMigration,q,j,historicalChain} from './fixtures/teaching-agent-r7d-production/postgres.mjs';
import {serverModule,nativeCapture,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const native=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
const {projectPublishedDurableFacts}=await serverModule('src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts');
const {publishedNodeFactsSql}=await serverModule('src/features/smart-textbook-runtime/server/durable-activity-repository.server.ts');
const {publicationRepository}=await serverModule('src/lib/smart-textbook-publishing/repository.server.ts');
const reject=(db,sql,pattern)=>assert.throws(()=>db.sql(sql),e=>pattern.test(e.stderr?.toString()??e.message));
export async function publicationChecks(db,t){
 const f=nativeCapture(2);db.seed(f);const capture=db.capture(f);let a=native.packageNativePublication(native.projectNativePublicationCapture(capture,f.scope),f.scope);
 const publish=(b,expected=null)=>`set role service_role;select public.publish_runtime_snapshot_v2(${q(db.owner)},${j(f.scope)},${j(expected)},'publish',${j(b)},null);`;
 const before=db.sql("select count(*) from runtime_publish_private.snapshots");
 for(const [name,edit,pattern]of [
  ['unknown revision',b=>b.revision='publish-foundation/9',/PUBLICATION_BUNDLE/],
  ['mixed kind',b=>b.publicationKind='legacy',/CONTRACT|BUNDLE/],
  ['missing native binding',b=>b.privatePayload.bindings=[],/CONTRACT/],
  ['wrong graph binding',b=>b.privatePayload.bindings[0].sourceTeachingNodeId=uid(),/ASSOCIATION/],
  ['compiler alias forbidden',b=>b.compilerVersion='native-publication/1',/CONTRACT|BUNDLE/],
  ['legacy pretending native',b=>b.privatePayload.contract='legacy',/CONTRACT|BUNDLE/],
  ['native media marker',b=>b.manifest.mediaRefs=[{required:true}],/CONTRACT/],
  ['dependency mismatch',b=>b.privatePayload.dependencies.digital_textbook_nodes=[],/CAPTURE_CONFLICT/],
  ['private/public mismatch',b=>b.privatePayload.result.manifest.chapter.title={'zh-CN':'wrong'},/ASSOCIATION/],
 ])await t.test('SQL '+name+' rejected',()=>{const b=structuredClone(a);edit(b);reject(db,publish(b),pattern);assert.equal(db.sql('select count(*) from runtime_publish_private.snapshots'),before);});
 let pointer;
 await t.test('Owner → native publisher → ONE capture → official CAS repository/current',async()=>{
  let captures=0;globalThis.__r7dNativePublisher={owner:db.owner,admin:{async rpc(name,args){if(name==='capture_runtime_publication_v1')captures++;return db.rpc.rpc(name,args);}}};
  const publisher=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{'../auth':`export async function requireActiveUser(){return {user:{id:globalThis.__r7dNativePublisher.owner},profile:{global_role:'platform_owner'}};}`,'../supabase/admin':`export function createAdminClient(){return globalThis.__r7dNativePublisher.admin;}`});
  pointer=await publisher.publishNativePublication(f.scope,null);assert.equal(captures,1);
  const current=await publicationRepository(db.rpc).current(f.scope);assert.equal(current.bundle.manifestDigest,a.manifestDigest);assert.equal(current.bundle.revision,'publish-foundation/2');a=current.bundle;
 });
 const historical=db.sql(`select document::text from runtime_publish_private.snapshots where id=${q(a.snapshotId)}`);
 await t.test('native CAS stale pointer rejected',()=>reject(db,publish(a,null),/PUBLICATION_CONFLICT/));
 await t.test('concurrent native publication CAS has exactly one winner',async()=>{const races=await Promise.allSettled([db.queryAsync(publish(a,pointer)),db.queryAsync(publish(a,pointer))]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.match(races.find(r=>r.status==='rejected').reason.message,/PUBLICATION_CONFLICT/);pointer=JSON.parse(races.find(r=>r.status==='fulfilled').value);});
 await t.test('actual PostgreSQL READ ONLY snapshot never joins old publication with later facts',async()=>{
  const activity=a.privatePayload.source.activities[0],domain={tenantId:uid(),actorId:uid(),versionId:f.id.version,nodeId:activity.node_id,activityId:activity.id};
  const insert=(n,correct)=>`insert into public.digital_textbook_attempts(tenant_id,student_id,version_id,activity_id,attempt_number,is_correct,score) values(${q(domain.tenantId)},${q(domain.actorId)},${q(domain.versionId)},${q(domain.activityId)},${n},${correct},${correct?100:0});`;
  db.sql(insert(1,false)+`insert into public.digital_textbook_node_progress values(${q(domain.tenantId)},${q(domain.actorId)},${q(domain.versionId)},${q(domain.nodeId)},'in_progress',0,0,1,clock_timestamp(),clock_timestamp());`);
  const reading=db.queryAsync(`begin isolation level repeatable read read only;select public.read_runtime_publication_v1(${j(f.scope)})->'pointer';select pg_sleep(1);${publishedNodeFactsSql(domain)};commit;`);
  for(let i=0;i<30;i++){if(db.sql("select count(*) from pg_stat_activity where wait_event='PgSleep'")!=='0')break;await new Promise(r=>setTimeout(r,20));}
  db.sql(insert(2,true)+`update public.digital_textbook_node_progress set status='completed',completion_percent=100,mastery_score=100,attempt_count=2,updated_at=clock_timestamp() where student_id=${q(domain.actorId)};`);
  const lines=(await reading).split('\n').filter(Boolean),oldFacts=projectPublishedDurableFacts(JSON.parse(lines.at(-1)),domain,[activity]);
  assert.equal(oldFacts.attemptCount,1);assert.equal(oldFacts.completionStatus,'INCOMPLETE');
  const fresh=projectPublishedDurableFacts(JSON.parse(db.sql(publishedNodeFactsSql(domain))),domain,[activity]);assert.equal(fresh.attemptCount,2);assert.equal(fresh.completionStatus,'COMPLETED');
 });
 await t.test('native same-id different payload rejected',()=>{const b=structuredClone(a);b.seal='e'.repeat(64);reject(db,publish(b,pointer),/ID_COLLISION/);});
 await t.test('native dependency fence remains PT409',()=>reject(db,`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":0}' where activity_id=${q(f.c.digital_textbook_activities[0].id)};`,/PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW/));
 await t.test('native published immutable snapshots unchanged',()=>{reject(db,`update runtime_publish_private.snapshots set document=document where id=${q(a.snapshotId)};`,/IMMUTABLE/);assert.equal(db.sql(`select document::text from runtime_publish_private.snapshots where id=${q(a.snapshotId)}`),historical);});
 await t.test('outer wrapper and native fence preserved',()=>{assert.equal(db.sql(`select public.assert_runtime_dependency_fence_v1(${q(a.snapshotId)},${j(capture)});`),'t');assert.match(db.sql("select pg_get_functiondef('public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text)'::regprocedure)"),/TEXTBOOK_DRAIN_INCOMPLETE/);});
 await t.test('revoked and expired session locators cannot be revived',async()=>{
  const repo=publicationRepository(db.rpc),tenant=uid();
  const one=await repo.session('issue',db.owner,tenant,{scope:f.scope,expected:pointer});
  const ref=one.sessionRef.slice(17);await repo.session('revoke',db.owner,tenant,{ref});
  await assert.rejects(repo.session('resolve',db.owner,tenant,{ref}));
  const two=await repo.session('issue',db.owner,tenant,{scope:f.scope,expected:pointer}),expired=two.sessionRef.slice(17);
  db.sql(`update runtime_publish_private.sessions set expires_at=clock_timestamp()-interval '1 second' where id=${q(expired)}`);
  await assert.rejects(repo.session('resolve',db.owner,tenant,{ref:expired}));
 });
 const session=(op,ref=null)=>`set role service_role;select public.runtime_publication_session_v1(${q(op)},${q(db.owner)},${q(uid())},${ref?q(ref):'null'},${j(f.scope)},${j(pointer)},'zh-CN');`;
 await t.test('retired native snapshot cannot be revived by rollback/session',()=>{db.sql(`select public.begin_runtime_textbook_edit_v1(${q(db.owner)},${q(f.id.textbook)});`);reject(db,publish(a,pointer),/RETIRED/);reject(db,session('issue'),/RETIRED|STOPPED/);assert.equal(db.sql(`select public.assert_runtime_dependency_fence_v1(${q(a.snapshotId)},${j(capture)});`),'f');});
 await t.test('private/base RPC ACL remains closed',()=>{for(const fn of ['public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text)','public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text)'])assert.equal(db.sql(`select has_function_privilege('service_role',${q(fn)},'EXECUTE');`),'f');});
}
test('publication-only migration on complete relevant historical chain',{timeout:120000},async t=>{const db=await isolatedPostgres([publicationMigration]);try{await publicationChecks(db,t);}finally{db.stop();}});
test('combined independent migrations retain wrappers, definitions and separation',{timeout:120000},async t=>{const db=await isolatedPostgres([completionMigration,publicationMigration]);try{
 await t.test('both forward functions installed and public cancel/CAS wrapper retained',()=>{assert.match(db.sql("select pg_get_functiondef('public.transition_agent_run_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text)'::regprocedure)"),/RUN_CANCELLED/);assert.match(db.sql("select pg_get_functiondef('agent_core_private.transition_agent_run_evidence_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text)'::regprocedure)"),/validate_artifact_v2/);});
 await publicationChecks(db,t);
 }finally{db.stop();}});
test('migration responsibility separation and no historical rewrites',()=>{const c=readFileSync('supabase/migrations/'+completionMigration,'utf8'),p=readFileSync('supabase/migrations/'+publicationMigration,'utf8');assert.doesNotMatch(c,/runtime_publish_private/);assert.doesNotMatch(p,/agent_core_private/);for(const s of [c,p])assert.doesNotMatch(s,/create\s+table|delete\s+from|truncate\s+table/i);assert.equal(historicalChain.includes('202609110002_restore_single_version_publish_wrapper.sql'),true);assert.equal(historicalChain.includes('202609130003_runtime_authoring_nonretryable_error.sql'),true);});
