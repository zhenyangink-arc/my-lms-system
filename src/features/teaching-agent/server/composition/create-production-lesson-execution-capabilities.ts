import 'server-only';
import { z } from 'zod';
import type { AgentProfile } from '../../../agent-core/contracts/server.ts';
import type { TypedTraceEvidence } from '../../../agent-core/observability/trace.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { resolveAllowedToolDefinitions } from '../../../agent-core/permissions/tool-policy.ts';
import { createStudentAiTeacherSkillRegistry,selectStudentExecutionSkill } from '../skills/student-skill-registry.ts';
import { createProductionLessonFactsBinding } from '../domain-ports/production-lesson-facts-binding.server.ts';
import { createProductionLessonExecutionFactsReadPort } from '../domain-ports/lesson-execution-facts-read-port.ts';
import { createProductionLessonExecutionFactsTool } from '../tools/get-current-lesson-execution-facts.ts';
import { createProductionStudentExecutionToolRegistry } from '../tools/student-tool-registry.ts';
import { createProductionStudentExecutionPolicy } from '../policies/student-tool-policy.ts';
import { createStudentToolEvidenceLedger } from './create-student-ai-teacher-capabilities.ts';
import { productionLessonFactsToolRef,type StudentToolBinding } from '../tools/contracts.ts';
import { productionExecutionSummarySkillRef } from '../../skills/summarize-current-lesson-execution/definition.ts';
import { checkProductionExecutionEvidence,type ProductionExecutionEvidenceBinding } from '../../skills/summarize-current-lesson-execution/evidence.ts';
import { projectProductionExecutionSummary } from '../../skills/summarize-current-lesson-execution/output.ts';
import { teachingRef } from '../selection/references.ts';

/** Request-local composition; uses the existing Core bridge and private ledger.
 * It exposes neither an evidence setter nor a development issuer/read transport. */
export async function createProductionLessonExecutionCapabilities(input:StudentToolBinding&{profile:AgentProfile}){
 const context={...input.execution,authority:input.binding.authority,skillRunId:input.skillRunId};
 const skill=selectStudentExecutionSkill(input.profile,createStudentAiTeacherSkillRegistry()),issuer=createProductionLessonFactsBinding(input),handle=await issuer.issue(context);
 const registry=createProductionStudentExecutionToolRegistry(createProductionLessonExecutionFactsTool(createProductionLessonExecutionFactsReadPort(issuer),handle)),policy=createProductionStudentExecutionPolicy(input,issuer,handle);
 const visible=await resolveAllowedToolDefinitions(input.profile,skill,context.authority,registry,policy);
 if(visible.length!==1||visible[0].name!==productionLessonFactsToolRef.name||visible[0].version!=='1.1.0')throw new CoreError('FORBIDDEN');
 const binding:ProductionExecutionEvidenceBinding=Object.freeze({student:input.binding,runStartedAt:Date.now()});
 const ledger=createStudentToolEvidenceLedger({context,skill:productionExecutionSummarySkillRef,binding,visible,registry,policy});
 let busy=false,failed=false,dispatches=0;const seen=new Set<string>();
 async function evidence(){
  const invalid={status:'invalid',code:'REQUIRED_EVIDENCE_MISSING'} as const;
  if(busy||failed)return invalid;
  try{await issuer.validateSnapshot(handle,context);}catch{return invalid;}
  return checkProductionExecutionEvidence(ledger.get(productionLessonFactsToolRef),binding,context);
 }
 async function traceEvidence():Promise<TypedTraceEvidence[]>{
  const e=await evidence();if(e.status!=='satisfied')throw new CoreError('REQUIRED_EVIDENCE_MISSING');
  const d=e.facts,r=e.receipt;
  return [{kind:'durable_execution_facts',facts:{completionStatus:d.completionStatus,attemptCount:d.attemptCount,latestResult:d.latestResult,nodeProgress:d.nodeProgress,currentTeachingNode:d.currentTeachingNode,currentPositionAvailability:d.currentPositionAvailability},toolRef:productionLessonFactsToolRef,skillRef:productionExecutionSummarySkillRef,runId:context.runId,skillRunId:context.skillRunId,modelCallId:r.modelCallId,toolCallId:r.toolCallId,subjectRef:teachingRef('subject',context.authority.actorId),tenantRef:teachingRef('tenant',context.authority.tenantId),scopeRef:context.authority.scopeRef,lessonRef:d.lessonRef,versionRef:d.versionRef,contentBinding:d.contentBinding,revision:d.revision,asOf:d.asOf,readStartedAt:d.evidence.readStartedAt,deadlineAt:d.evidence.deadlineAt,activityRef:d.activityRef,snapshotRef:d.evidence.snapshotRef,receiptRef:d.evidence.receiptRef,executionNodeRef:d.executionNodeRef,sourceTeachingNodeRef:d.sourceTeachingNodeRef,storage:'CURRENT_PUBLISHED_DB',receiptContract:'activity-completion/3'}];
 }
 return {
  modelTools:visible.map(t=>({name:t.name,description:t.description,inputSchema:structuredClone(t.inputSchema)})),
  async executeTool(raw:unknown,modelCallId:string){
   const parsed=z.object({id:z.string().min(1).max(200),name:z.literal(productionLessonFactsToolRef.name),arguments:z.string().max(16000)}).strict().safeParse(raw);
   if(busy||failed||dispatches>=input.profile.budget.maxToolExecutions||!parsed.success||seen.has(parsed.data.id)||!z.uuid().safeParse(modelCallId).success){failed=true;throw new CoreError('TOOL_NOT_ALLOWED');}
   busy=true;seen.add(parsed.data.id);dispatches++;
   try{const result=await ledger.execute(parsed.data,modelCallId,productionLessonFactsToolRef);if(result.status!=='ok'&&result.status!=='partial')failed=true;return result;}
   catch{failed=true;throw new CoreError('TOOL_FAILED');}finally{busy=false;}
  },
  validateEvidence:evidence,traceEvidence,
  async complete(modelOutput:unknown={}){const r=projectProductionExecutionSummary(modelOutput,await evidence());if(r.status!=='accepted')throw new CoreError(r.code);return r.output;}
 };
}
