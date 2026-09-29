import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalFreeze as F } from '../../digital-textbook/server/native-activity-authoring.server.ts';
import { projectFrozenExecution } from '../../smart-textbook-runtime/server/native-execution-projection.server.ts';
import { createDurableActivityRepository, type NativeActivitySqlTransport } from '../../smart-textbook-runtime/server/durable-activity-repository.server.ts';
import { createDurableActivityCompletion } from '../../smart-textbook-runtime/server/durable-activity-completion.server.ts';
import { publicNativeActivity,validateNativeActivity,safeDigest,nativeActivityScopeSchema } from '../../smart-textbook-runtime/server/native-activity-binding.server.ts';
import { executionBinding,completionRequestSchema,sameBinding } from '../../smart-textbook-runtime/core/execution-contracts.ts';
import { createProvisioningReadback } from './provisioning-readback.server.ts';
import { DEVELOPMENT_BINDING as B,snapshotSchema } from './provisioning-contract.ts';
import { currentDatabaseTransport,EXECUTION_DIRECTORY,privateRead,verifyCurrentEnvironment } from './execution-transport.server.ts';
import { createExecutionJournal } from './execution-journal.server.ts';
import { assertExecutionActor,assertExecutionScope,B3_BUDGET,SCENARIO,type ExecutionScope } from './execution-scope.server.ts';
import { executionMutationGuard,executionPostcondition } from './execution-guard.server.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const executionApprovalSchema=z.strictObject({contract:z.literal('b3-execution-approval/1'),scenarioId:z.literal(SCENARIO),executionApproved:z.literal(true),environment:z.literal(B.environment),databaseIdentity:z.literal(B.databaseIdentity),buildId:z.string().min(10),issuedAt:z.iso.datetime({offset:true}),expiresAt:z.iso.datetime({offset:true}),budget:z.literal('3 INSERT / 1 UPDATE / 0 DELETE')});
export async function readExecutionApproval(){
 await verifyCurrentEnvironment();const a=executionApprovalSchema.parse(JSON.parse(await privateRead(`${EXECUTION_DIRECTORY}/execution-approval.json`)));
 const {readFile}=await import('node:fs/promises');if((await readFile('.next/BUILD_ID','utf8')).trim()!==a.buildId||Date.parse(a.issuedAt)>Date.now()||Date.parse(a.expiresAt)<=Date.now()||Date.parse(a.expiresAt)-Date.parse(a.issuedAt)>900000)throw Error('B3_EXECUTION_NOT_APPROVED');return a;
}
export async function prepareCurrentExecution(){
 const transport=await currentDatabaseTransport(),reader=createProvisioningReadback(transport,B.databaseIdentity),state=snapshotSchema.parse(await reader.read());
 if(!state.canonicalValid||state.actors.length!==1||state.tenants.length!==1||hash(state.actors[0].id)!=='cf4d2db0a75301af51a807149b0ed32134ce69db7e3767251816b9232722afbe'||hash(state.tenants[0].id)!=='7356e8b33db28d06f9283e6f4a5b9fb90f7d9d630a042093cffbf9d75c0ffbac')throw Error('B3_CANONICAL_IDENTITY');
 const raw=await transport.transaction(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
 WITH lesson AS(SELECT * FROM public.learning_agent_lessons WHERE encode(sha256(convert_to(id::text,'UTF8')),'hex')='${F.lesson}')
 SELECT json_build_object('domain',json_build_object('tenantId',(SELECT id FROM public.tenants WHERE slug='uply-domain-execution-dev'),'actorId',(SELECT id FROM auth.users WHERE email='development-domain-execution@synthetic.invalid'),'activityId',a.id,'nodeId',n.id,'versionId',c.version_id),'text',(SELECT teacher_script->>'ko-KR' FROM public.learning_agent_script_nodes WHERE script_version_id IN(SELECT id FROM public.learning_agent_script_versions WHERE lesson_id IN(SELECT id FROM lesson)) AND sort_order=5),'node5',(SELECT encode(sha256(convert_to(id::text,'UTF8')),'hex') FROM public.learning_agent_script_nodes WHERE script_version_id IN(SELECT id FROM public.learning_agent_script_versions WHERE lesson_id IN(SELECT id FROM lesson)) AND sort_order=5),'node7',(SELECT encode(sha256(convert_to(id::text,'UTF8')),'hex') FROM public.learning_agent_script_nodes WHERE script_version_id IN(SELECT id FROM public.learning_agent_script_versions WHERE lesson_id IN(SELECT id FROM lesson)) AND sort_order=7))
 FROM public.digital_textbook_activities a JOIN public.digital_textbook_nodes n ON n.id=a.node_id JOIN public.digital_textbook_modules m ON m.id=n.module_id JOIN public.digital_textbook_chapters c ON c.id=m.chapter_id WHERE m.id IN(SELECT module_id FROM lesson) AND a.activity_key='hangul-introduction-vowel-recognition'; COMMIT;`);
 const p=z.object({domain:nativeActivityScopeSchema,text:z.string(),node5:z.string(),node7:z.string()}).parse(raw),repository=createDurableActivityRepository(transport);
 const rows=await repository.read(p.domain) as {definition:unknown};const definition=validateNativeActivity(rows.definition,p.domain);
 const manifest=projectFrozenExecution({lessonBinding:F.lesson,versionBinding:F.script,node5:{binding:p.node5,rowHash:F.nodes[4],text:p.text},node7:{binding:p.node7,rowHash:F.nodes[6]},compiledAt:'2026-09-17T00:00:00.000Z',mediaRevision:'development-pattern-v1',durationSeconds:30,cueTime:5,activity:publicNativeActivity(definition)});
 const context={runtimeSessionId:SCENARIO,snapshotId:manifest.snapshot.id,sourceState:'draft' as const,trackingDisabled:true,locale:'zh-CN' as const,supportMode:'bilingual' as const};
 return {transport,reader,domain:p.domain,definitionDigest:definition.digest,manifest,context,binding:executionBinding(manifest,context,manifest.execution!.cues[0])};
}
export type PreparedExecution=Awaited<ReturnType<typeof prepareCurrentExecution>>;
export function scopeFor(p:PreparedExecution,a:z.infer<typeof executionApprovalSchema>):ExecutionScope{return {contract:'development-domain-execution/1',scenarioId:SCENARIO,environment:B.environment,databaseIdentity:B.databaseIdentity,issuedAt:a.issuedAt,expiresAt:a.expiresAt,domain:p.domain,binding:p.binding,generation:0,state:'ACTIVE',budget:B3_BUDGET};}
export async function composeExecution(p:PreparedExecution,s:ExecutionScope,journal:ReturnType<typeof createExecutionJournal>,readOnly=false){
 assertExecutionScope(s,Date.now(),!readOnly);if(!sameBinding(s.binding,p.binding)||safeDigest(s.domain)!==safeDigest(p.domain))throw Error('B3_SNAPSHOT_CHANGED');
 const base=createDurableActivityRepository(p.transport);let busy=false;
 const guarded:NativeActivitySqlTransport={...p.transport,async beforeMutation(domain,envelope,grade){
  if(readOnly||!(await journal.enabled()))throw Error('B3_MUTATIONS_DISABLED');assertExecutionScope(s);
  assertExecutionActor(await p.reader.read(),s);if(envelope.generation!==s.generation||envelope.bindingDigest!==safeDigest(s.binding)||safeDigest(domain)!==safeDigest(s.domain))throw Error('B3_REQUEST_BINDING');
  const raw=await base.read(domain) as {attempts:unknown[]};const slot=raw.attempts.length;if(slot!==0&&slot!==1)throw Error('B3_BUDGET_EXHAUSTED');
  if(grade.correct!==(slot===1)||grade.score!==(slot?100:0))throw Error('B3_SCENARIO_GRADE');
  await journal.claim(s,slot,envelope.requestId,envelope.generation);
  return {beforeRpc:await executionMutationGuard(s,slot),afterRpc:executionPostcondition(s,slot),beforeDispatch:async()=>{if(!(await journal.enabled()))throw Error('B3_DISABLED');assertExecutionScope(s);}};
 }};
 const repository=createDurableActivityRepository(guarded);
 const completion=await createDurableActivityCompletion({repository,authorize:async()=>{assertExecutionScope(s,Date.now(),false);assertExecutionActor(await p.reader.read(),s);return s.domain;},binding:s.binding,definitionDigest:p.definitionDigest,policy:'two-attempt-development'});
 return {
  readback:completion.readback,restore:completion.restore,checkpoint:completion.checkpoint,
  async submit(request:unknown,optionId:string){
   if(busy||readOnly)throw Error('B3_DISPATCH_CLOSED');busy=true;
   try{completionRequestSchema.parse(request);const out=await completion.submit(request,optionId);
    // Approved fault: second confirmed COMMIT response suppressed. Facts remain
    // in the domain; no third dispatch is allowed and Runtime must read back.
    if(out.receipt.attemptNumber===2){await journal.disable();throw Error('B3_RESPONSE_SUPPRESSED');}return out;
   }catch{await journal.disable();throw Error('B3_VERIFY_BY_READBACK');}finally{busy=false;}
  },
  disable:()=>journal.disable(),
 };
}
