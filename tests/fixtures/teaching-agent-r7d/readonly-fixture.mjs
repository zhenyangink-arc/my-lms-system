// Synthetic private rows ONLY. No network/DB/Provider/Run coordinator.
import '../smart-textbook-legacy-adapter/register-server-only.mjs';
import {randomUUID,randomInt} from 'node:crypto';
const {readDurableActivityFacts}=await import('../../../src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts');
const {safeDigest}=await import('../../../src/features/smart-textbook-runtime/server/native-activity-binding.server.ts');
const {createLessonFactsBindingIssuer}=await import('../../../src/features/teaching-agent/server/domain-ports/lesson-execution-facts-binding.ts');
const {createLessonExecutionFactsReadPort}=await import('../../../src/features/teaching-agent/server/domain-ports/lesson-execution-facts-read-port.ts');
const {createLessonExecutionFactsTool}=await import('../../../src/features/teaching-agent/server/tools/get-current-lesson-execution-facts.ts');
const {teachingRef}=await import('../../../src/features/teaching-agent/server/selection/references.ts');
const {createToolRegistry}=await import('../../../src/features/agent-core/tools/registry.ts');
const {executeAllowedTool}=await import('../../../src/features/agent-core/tools/executor.ts');
export async function fixture(durable){
 const id=randomUUID,ref=k=>teachingRef(k,id()),metrics={reads:0,writes:0,authReads:0};
 const domain=durable?.scope??{tenantId:id(),actorId:id(),versionId:id(),nodeId:id(),activityId:id()},moduleId=id(),chapterId=id();
 const binding=durable?.binding??{sessionId:'isolated-r7d',snapshotId:'isolated-snapshot',snapshotDigest:'sha256:'+safeDigest(id()),stepId:'step',sourceBlockId:'video',mediaRevision:'fixture',cueId:'cue',blockId:'activity',activityRef:'hangul-introduction-vowel-recognition'};
 const definition=durable?.definition??{digest:safeDigest(id()),activity:{id:domain.activityId,node_id:domain.nodeId,activity_key:binding.activityRef,activity_type:'single_choice',prompt:{'zh-CN':'哪个是元音？'},instruction:{'zh-CN':'请选择'},options:['ㄱ','ㅏ','ㄴ'].map(x=>({'zh-CN':x})),public_config:{},counts_toward_completion:true},secret:{activity_id:domain.activityId,answer_key:{kind:'index',value:randomInt(3)}},node:{id:domain.nodeId,module_id:moduleId,node_type:'practice'},module:{id:moduleId,chapter_id:chapterId,module_code:'orientation'},chapter:{id:chapterId,version_id:domain.versionId,chapter_number:0,status:'draft'},version:{id:domain.versionId,status:'draft'}};
 const old='2026-01-01T00:00:00.000Z';
 const rows={definition,attempts:[false,true].map((correct,i)=>({id:id(),attemptNumber:i+1,correct,score:correct?100:0,createdAt:old,response:{contract:'native-choice-response/1',requestId:id(),bindingDigest:safeDigest(binding),definitionDigest:definition.digest,optionIndex:definition.secret.answer_key.value,generation:0}})),progress:{tenant_id:domain.tenantId,student_id:domain.actorId,node_id:domain.nodeId,version_id:domain.versionId,attempt_count:2,status:'completed',completion_percent:100,mastery_score:100,updated_at:old}};
 const grant={domain,binding,definitionDigest:definition.digest,storage:'isolated-test-db',content:{lessonRef:ref('lesson'),lessonTitle:'韩文字母入门',scriptVersionRef:ref('script'),versionRef:ref('version'),version:1,contentBinding:ref('revision'),sourceTeachingNodeRef:ref('node'),executionNodeRef:ref('node'),activityRef:ref('activity'),activityAlias:binding.activityRef}};
 let rowFilter=x=>x,resultFilter=x=>x,authorizationError=false,readError=false,afterRead=()=>{};
 const repository={evidenceStorage:'isolated-test-db',async read(){metrics.reads++;if(readError)throw Error('private SQL error');const value=rowFilter(durable?await durable.repository.read(domain):structuredClone(rows));afterRead();return value;}};
 const reader=(g,r)=>readDurableActivityFacts({repository,authorize:async()=>g.domain,binding:g.binding,definitionDigest:g.definitionDigest,policy:'two-attempt-development'},r);
 const issuer=createLessonFactsBindingIssuer({authorize:async()=>{metrics.authReads++;if(authorizationError)throw Error('auth denied');return grant;},read:async(g,r)=>resultFilter(await reader(g,r))});
 const expiresAt=new Date(Date.now()+30000).toISOString(),context={runId:id(),skillRunId:id(),modelCallId:id(),callId:id(),deadlineAt:expiresAt,signal:new AbortController().signal,authority:{actorId:id(),tenantId:domain.tenantId,membershipRole:'platform_super_admin',appId:id(),scope:{kind:'practice',practiceSessionRef:'isolated-audit'},scopeRef:ref('scope'),policyVersion:{name:'isolated-read',version:'1'},issuedAt:new Date().toISOString(),expiresAt}};
 const handle=await issuer.issue(context),port=createLessonExecutionFactsReadPort(issuer),tool=createLessonExecutionFactsTool(port,handle),registry=createToolRegistry([tool]);
 const policy={async evaluate(authority,action){if(authority!==context.authority||action.ref.name!==tool.definition.name||action.requiredPermissions.join()!=='teaching.execution.self.read')return {effect:'deny',code:'TOOL_NOT_ALLOWED'};await issuer.revalidate(handle,context);return {effect:'allow',policyVersion:authority.policyVersion,scopeRef:authority.scopeRef,expiresAt:authority.expiresAt};}};
 return {rows,grant,metrics,context,handle,issuer,port,tool,registry,policy,read:()=>port.read(handle,context),
 core:(args={})=>executeAllowedTool({id:id(),name:tool.definition.name,arguments:JSON.stringify(args)},[tool.definition],registry,policy,context),
 alterRows(fn){rowFilter=fn;},alterResult(fn){resultFilter=fn;},deny(){authorizationError=true;},failRead(){readError=true;},afterRead(fn){afterRead=fn;},reader};
}
