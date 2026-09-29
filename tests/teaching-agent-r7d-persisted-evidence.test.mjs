import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {isolatedPostgres,completionMigration,publicationMigration,q,j} from './fixtures/teaching-agent-r7d-production/postgres.mjs';
import {serverModule,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
const {pinStudentRuntimeDefinition}=await serverModule('src/features/teaching-agent/server/runtime/student-runtime-definition.ts');
const hash=s=>createHash('sha256').update(s).digest('hex'),ref=(kind,id=uid())=>`ta1:${kind}:${hash(JSON.stringify(id))}`;
const mandatory={name:'get_current_lesson_execution_facts',version:'1.1.0'},lesson={name:'get_current_lesson_context',version:'1.0.0'};
const facts={completionStatus:'COMPLETED',attemptCount:1,latestResult:'CORRECT',nodeProgress:{status:'completed',completionPercent:100,masteryScore:100,attemptCount:1},currentTeachingNode:null,currentPositionAvailability:'unavailable'};
function setupRun(db,{legacy=false,multi=false,changeProfile=()=>{}}={}){
 const actor=uid(),tenant=uid(),scope=ref('scope'),skill={name:legacy?'explain-pinned-korean-segment':'summarize-current-lesson-execution',version:legacy?'1.0.0':'1.1.0'};
 const profile=structuredClone(pinStudentRuntimeDefinition(undefined,legacy?'explain_segment':'summarize_execution').profile);
 if(multi)profile.artifacts.requiredEvidence.push({kind:'lesson_context',toolRef:lesson});
 changeProfile(profile);
 db.sql(`insert into auth.users values(${q(actor)});insert into public.profiles values(${q(actor)},null,'active');insert into public.tenants values(${q(tenant)},'active');insert into public.tenant_memberships values(${q(tenant)},${q(actor)},'active','student');insert into public.agent_definition_versions(tenant_id,actor_id,agent_code,version,status,manifest) values(${q(tenant)},${q(actor)},'student-ai-teacher',${q(profile.definitionVersion.version)},'published',${j(profile)});`);
 const deadline=new Date(Date.now()+44000).toISOString(),budget={...profile.budget,usedModelCalls:0,usedToolExecutions:0,deadlineAt:deadline};
 let r=JSON.parse(db.sql(`set role service_role;select public.admit_agent_run_v1(${q(tenant)},${q(actor)},${q(uid())},'student-ai-teacher','fixture-app','lesson',${q(scope)},'fixture-key',${q('a'.repeat(64))},'isolated evidence test',${q(profile.definitionVersion.version)},${j(skill)},${j(budget)},${q(deadline)});`)).run;
 function transition(to='completed',final='safe explain',version=r.stateVersion,fence=r.fencingToken){return JSON.parse(db.sql(`set role service_role;select public.transition_agent_run_v1(${q(tenant)},${q(actor)},${q(r.id)},${q(r.status)},${version},${q(fence)},${q(to)},${j(r.budget)},${to==='completed'?q(final):'null'},null);`));}
 r=transition('running');const skillRun=uid();
 function append(kind,details,links={}){db.sql(`set role service_role;select public.append_agent_run_event_v2(${q(tenant)},${q(actor)},${q(r.id)},${r.stateVersion},${q(r.fencingToken)},${j({kind,runId:r.id,at:new Date().toISOString(),skillRunId:skillRun,...links,details})});`);}
 function specimen(kind='durable_execution_facts'){
  const now=new Date().toISOString(),common={kind,toolRef:kind==='durable_execution_facts'?mandatory:lesson,skillRef:skill,runId:r.id,skillRunId:skillRun,modelCallId:uid(),toolCallId:uid(),subjectRef:ref('subject',actor),tenantRef:ref('tenant',tenant),scopeRef:scope,lessonRef:ref('lesson'),versionRef:ref('version'),contentBinding:ref('revision'),revision:ref('state'),asOf:now,readStartedAt:now,deadlineAt:deadline};
  return kind==='durable_execution_facts'?{...common,activityRef:ref('activity'),snapshotRef:ref('snapshot'),receiptRef:ref('receipt'),executionNodeRef:ref('node'),sourceTeachingNodeRef:ref('node'),storage:'CURRENT_PUBLISHED_DB',receiptContract:'activity-completion/3',facts:structuredClone(facts)}:{...common,segmentRef:ref('segment'),sourceRefs:[]};
 }
 function records(evidence,change={}){
  const final=JSON.stringify({contract:profile.artifacts.completionPolicyRef,...facts,activityRef:evidence[0].activityRef,revision:evidence[0].revision,...change.final});
  for(const e of evidence)append('tool.completed',{toolRef:e.toolRef,status:'partial',evidenceSet:[e]},{modelCallId:e.modelCallId,toolCallId:e.toolCallId});
  const sourceRefs=evidence.flatMap(e=>e.kind==='durable_execution_facts'?[e.activityRef]:e.sourceRefs);
  const metadata={status:'pass',evidenceSet:evidence,revision:evidence[0].revision,asOf:evidence[0].asOf,sourceRefs,completeness:'partial'};
  append('evidence.checked',metadata);append('output.checked',{...metadata,outputDigest:hash(final),...change.output});return final;
 }
 return {actor,tenant,r,append,specimen,records,transition,profile};
}
async function checks(db,t){
 for(const [label,changeProfile]of [['without artifacts',p=>{delete p.artifacts;}],['without durable requirement',p=>{p.artifacts.requiredEvidence=[{kind:'lesson_context',toolRef:lesson}];}],['wrong output contract',p=>{p.artifacts.completionPolicyRef.version='1.0.0';}]])await t.test('Summary definition '+label+' denied',()=>assert.throws(()=>setupRun(db,{changeProfile}),/REQUIRED_EVIDENCE_MISSING/));
 await t.test('Explain v1 lesson evidence still completes',()=>{const x=setupRun(db,{legacy:true}),revision=ref('revision'),segmentRef=ref('segment'),d={status:'pass',revision,segmentRef,sourceRefs:[segmentRef],asOf:new Date().toISOString(),completeness:'complete'};x.append('tool.completed',{...d,status:'ok',toolRef:lesson},{modelCallId:uid(),toolCallId:uid()});x.append('evidence.checked',d);x.append('output.checked',d);assert.equal(x.transition().status,'completed');});
 await t.test('Explain v1 missing lesson evidence denied',()=>{const x=setupRun(db,{legacy:true});assert.throws(()=>x.transition(),/REQUIRED_EVIDENCE_MISSING/);});
 await t.test('Summary1.1 valid production evidence completes',()=>{const x=setupRun(db),e=x.specimen(),final=x.records([e]);assert.equal(x.transition('completed',final).status,'completed');});
 await t.test('all multiple mandatory requirements accepted',()=>{const x=setupRun(db,{multi:true}),a=x.specimen(),b=x.specimen('lesson_context');b.sourceRefs=[b.segmentRef];const final=x.records([a,b]);assert.equal(x.transition('completed',final).status,'completed');});
 await t.test('partial mandatory collection fails',()=>{const x=setupRun(db,{multi:true}),final=x.records([x.specimen()]);assert.throws(()=>x.transition('completed',final),/REQUIRED_EVIDENCE_MISSING/);});
 await t.test('missing durable evidence fails',()=>assert.throws(()=>setupRun(db).transition(),/REQUIRED_EVIDENCE_MISSING/));
 for(const [name,change]of [
  ['Tool1.0 cannot satisfy1.1',e=>e.toolRef={...mandatory,version:'1.0.0'}],
  ['development receipt',e=>e.receiptContract='activity-completion/2'],
  ['development provenance',e=>e.storage='CURRENT_DEVELOPMENT_DB'],['fixture provenance',e=>e.storage='isolated-test-db'],
  ['cross-run evidence',e=>e.runId=uid()],['wrong subject',e=>e.subjectRef=ref('subject')],['wrong tenant',e=>e.tenantRef=ref('tenant')],
  ['wrong scope',e=>e.scopeRef=ref('scope')],['wrong Skill version',e=>e.skillRef={...e.skillRef,version:'1.0.0'}],
  ['stale evidence',e=>e.asOf=new Date(Date.now()-40000).toISOString()],['stale deadline',e=>e.deadlineAt=new Date(Date.now()-1000).toISOString()],
  ['Activity-as-segmentRef bypass',e=>{e.kind='lesson_context';e.segmentRef=e.activityRef;e.sourceRefs=[e.activityRef];}],
  ['private payload injection',e=>e.answer_key=1],
 ])await t.test(name+' fails closed',()=>{const x=setupRun(db),e=x.specimen();change(e);assert.throws(()=>{const final=x.records([e]);x.transition('completed',final);},/REQUIRED_EVIDENCE_MISSING|INVALID_REQUEST/);});
 await t.test('bounded final facts cannot differ from verified Tool trace',()=>{const x=setupRun(db),f=x.records([x.specimen()],{final:{attemptCount:19}});assert.throws(()=>x.transition('completed',f),/SKILL_OUTPUT_INVALID/);});
 await t.test('final output byte/digest drift denied',()=>{const x=setupRun(db),f=x.records([x.specimen()]);assert.throws(()=>x.transition('completed',f+' '),/SKILL_OUTPUT_INVALID/);});
 await t.test('failed newer tool invalidates old success',()=>{const x=setupRun(db),e=x.specimen(),f=x.records([e]);x.append('tool.completed',{toolRef:mandatory,status:'unavailable'},{modelCallId:uid(),toolCallId:uid()});assert.throws(()=>x.transition('completed',f),/REQUIRED_EVIDENCE_MISSING/);});
 await t.test('cancel request cannot be completed',()=>{const x=setupRun(db),f=x.records([x.specimen()]);db.sql(`set role service_role;select public.request_agent_run_cancel_v1(${q(x.tenant)},${q(x.actor)},${q(x.r.id)});`);assert.throws(()=>x.transition('completed',f),/RUN_CANCELLED/);assert.equal(x.transition('cancelled').status,'cancelled');});
 await t.test('CAS and fence retained',()=>{const x=setupRun(db),f=x.records([x.specimen()]);assert.throws(()=>x.transition('completed',f,x.r.stateVersion-1),/PERSISTENCE_FAILED/);assert.throws(()=>x.transition('completed',f,x.r.stateVersion,uid()),/PERSISTENCE_FAILED/);assert.equal(x.transition('completed',f).status,'completed');assert.throws(()=>x.transition('completed',f),/PERSISTENCE_FAILED/);});
 await t.test('browser and service roles cannot bypass private gate',()=>{for(const role of ['anon','authenticated','service_role'])assert.equal(db.sql(`select has_function_privilege(${q(role)},'agent_core_private.transition_agent_run_base_v1(uuid,uuid,uuid,text,integer,uuid,text,jsonb,text,text)','EXECUTE');`),'f');});
}
for(const [label,migrations]of [['completion only',[completionMigration]],['combined publication and completion',[publicationMigration,completionMigration]]])test(label+' on historical schema',{timeout:120000},async t=>{const db=await isolatedPostgres(migrations);try{await checks(db,t);}finally{db.stop();}});
