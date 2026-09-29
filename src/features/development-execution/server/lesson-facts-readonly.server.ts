import 'server-only';
import { randomUUID } from 'node:crypto';
import { STUDENT_APP_IDS } from '@/lib/student-apps';
import { requirePlatformOwner } from '@/lib/admin';
import { createToolRegistry } from '../../agent-core/tools/registry.ts';
import { executeAllowedTool } from '../../agent-core/tools/executor.ts';
import type { ToolExecutionContext,ToolResult } from '../../agent-core/contracts/tool.ts';
import type { PermissionPolicy } from '../../agent-core/permissions/permission-policy.ts';
import { prepareCurrentExecution } from './execution-composition.server.ts';
import { privateRead,EXECUTION_DIRECTORY,verifyCurrentEnvironment } from './execution-transport.server.ts';
import { assertExecutionActor } from './execution-scope.server.ts';
import { DEVELOPMENT_BINDING as B } from './provisioning-contract.ts';
import { readDurableActivityFacts } from '../../smart-textbook-runtime/server/durable-activity-completion.server.ts';
import { createDurableActivityRepository } from '../../smart-textbook-runtime/server/durable-activity-repository.server.ts';
import { createLessonFactsBindingIssuer,type FactsGrant } from '../../teaching-agent/server/domain-ports/lesson-execution-facts-binding.ts';
import { createLessonExecutionFactsReadPort } from '../../teaching-agent/server/domain-ports/lesson-execution-facts-read-port.ts';
import { createLessonExecutionFactsTool } from '../../teaching-agent/server/tools/get-current-lesson-execution-facts.ts';
import { lessonFactsToolRef,type LessonExecutionFacts } from '../../teaching-agent/server/tools/contracts.ts';
import { teachingRef } from '../../teaching-agent/server/selection/references.ts';

/** Owner is the auditing OPERATOR, never the learning subject. No Run is admitted,
 * no JWT is issued, no B3 journal is written, and no production registry imports
 * this development-only composition. Each invocation is a fresh read capability. */
export async function readDevelopmentLessonFacts(...args:unknown[]):Promise<ToolResult<LessonExecutionFacts>> {
 const owner=await requirePlatformOwner();
 if(args.length)return {status:'not_found_or_not_visible',code:'READ_UNAVAILABLE'};
 const issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+30000).toISOString();
 try{
  await verifyCurrentEnvironment();
  const p=await prepareCurrentExecution();
  const e=p.manifest.execution!,source=e.sourceNodes.find(n=>n.nodeNumber===7)!;
  const grant:FactsGrant={domain:p.domain,binding:p.binding,definitionDigest:p.definitionDigest,storage:'CURRENT_DEVELOPMENT_DB',content:{
   lessonRef:teachingRef('lesson',e.lessonBinding),lessonTitle:'韩文字母入门',scriptVersionRef:teachingRef('script',e.scriptVersionBinding),
   versionRef:teachingRef('version',p.domain.versionId),version:e.scriptVersion,contentBinding:teachingRef('revision',[e.lessonBinding,e.scriptVersionBinding,p.binding.snapshotDigest]),
   sourceTeachingNodeRef:teachingRef('node',source.binding),executionNodeRef:teachingRef('node',p.domain.nodeId),
   activityRef:teachingRef('activity',p.domain.activityId),activityAlias:'hangul-introduction-vowel-recognition'}};
  async function authorize(){
   const freshOwner=await requirePlatformOwner();if(freshOwner.user.id!==owner.user.id)throw Error('FACTS_OPERATOR_CHANGED');
   await verifyCurrentEnvironment();
   if(JSON.parse(await privateRead(`${EXECUTION_DIRECTORY}/disabled`)).state!=='DISABLED')throw Error('B3_MUST_REMAIN_DISABLED');
   // Safety validation only; this does not issue or activate an execution scope.
   assertExecutionActor(await p.reader.read(),{contract:'development-domain-execution/1',scenarioId:'r7cb-b3-wrong-correct-recovery-1',
    environment:B.environment,databaseIdentity:B.databaseIdentity,issuedAt,expiresAt,domain:p.domain,binding:p.binding,generation:0,state:'DISABLED',
    budget:{attemptInsert:2,nodeInsert:1,nodeUpdate:1,otherWrites:0,deletes:0}});
   return grant;
  }
  // Runtime-level object capability exposes READ only. The PostgreSQL transaction
  // is READ ONLY even though the shared B3 transport also supports approved writes.
  const base=createDurableActivityRepository(Object.freeze({evidenceStorage:p.transport.evidenceStorage,transaction:async(sql:string)=>{
   if(!sql.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'))throw Error('FACTS_READ_ONLY_REQUIRED');
   return p.transport.transaction(sql);
  }}));
  const repository=Object.freeze({read:base.read,evidenceStorage:base.evidenceStorage});
  const issuer=createLessonFactsBindingIssuer({authorize,read:(g,r)=>readDurableActivityFacts({repository,authorize:async()=>g.domain,binding:g.binding,definitionDigest:g.definitionDigest,policy:'two-attempt-development'},r)});
  // Core requires correlation context. These IDs are in-memory audit call IDs,
  // not persisted AgentRun/SkillRun/ModelCall records or a forged StudentBinding.
  const context:ToolExecutionContext={runId:randomUUID(),skillRunId:randomUUID(),modelCallId:randomUUID(),callId:randomUUID(),signal:AbortSignal.timeout(30000),deadlineAt:expiresAt,
   authority:Object.freeze({actorId:owner.user.id,tenantId:p.domain.tenantId,membershipRole:owner.role,appId:STUDENT_APP_IDS.korean,
    scope:{kind:'practice' as const,practiceSessionRef:'development-lesson-facts-read'},scopeRef:teachingRef('scope',[owner.user.id,p.domain,'readonly-audit']),
    policyVersion:{name:'development-lesson-facts-read',version:'1.0.0'},issuedAt,expiresAt})};
  const handle=await issuer.issue(context),port=createLessonExecutionFactsReadPort(issuer),tool=createLessonExecutionFactsTool(port,handle);
  const policy:PermissionPolicy={async evaluate(authority,action){
   if(authority!==context.authority||action.kind!=='tool'||action.ref.name!==lessonFactsToolRef.name||action.ref.version!==lessonFactsToolRef.version||action.requiredPermissions.length!==1||action.requiredPermissions[0]!=='teaching.execution.self.read')return {effect:'deny',code:'TOOL_NOT_ALLOWED'};
   try{await issuer.revalidate(handle,context);}catch{return {effect:'deny',code:'TOOL_NOT_ALLOWED'};}
   return {effect:'allow',policyVersion:authority.policyVersion,scopeRef:authority.scopeRef,expiresAt:authority.expiresAt};
  }};
  return await executeAllowedTool({id:context.callId,name:lessonFactsToolRef.name,arguments:'{}'},[tool.definition],createToolRegistry([tool]),policy,context) as ToolResult<LessonExecutionFacts>;
 }catch{return {status:'unavailable',code:'READ_UNAVAILABLE'};}
}
