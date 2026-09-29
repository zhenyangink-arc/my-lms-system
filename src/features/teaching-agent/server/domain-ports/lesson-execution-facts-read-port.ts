import 'server-only';
import { lessonFactsOutputSchema } from '../tools/contracts.ts';
import { teachingRef } from '../selection/references.ts';
import { FactsReadError,type LessonFactsBindingIssuer } from './lesson-execution-facts-binding.ts';
import type { LessonExecutionFactsReadPort } from './index.ts';

/** Projection only. Completion truth was validated by the existing domain read. */
export function createLessonExecutionFactsReadPort(issuer:LessonFactsBindingIssuer):LessonExecutionFactsReadPort {
 return {async read(handle,context){
  try{
   const {content,facts,receipt:r}=await issuer.read(handle,context),e=r.evidence;
   const revision=teachingRef('state',[content.activityRef,content.contentBinding,r.binding.snapshotDigest,e.stateDigest]);
   const data=lessonFactsOutputSchema.parse({...content,currentTeachingNode:null,currentPositionAvailability:'unavailable',
    completionStatus:r.status,attemptCount:facts.attemptCount,latestResult:facts.latestResult,nodeProgress:facts.nodeProgress,
    evidence:{source:e.source,storage:e.storage,kind:e.kind,attemptSequence:e.attemptSequence,observedAt:e.observedAt,latestAttemptAt:e.latestAttemptAt,progressUpdatedAt:e.progressUpdatedAt},
    revision,asOf:e.observedAt,completedAt:r.completedAt,evidenceRefs:[{kind:'durable_activity_completion',sourceRef:content.activityRef,revision}],completeness:'partial',truncated:false});
   return {status:'partial',data,sourceRefs:[content.activityRef]};
  }catch(error){return {status:error instanceof FactsReadError?error.status:'unavailable',code:'READ_UNAVAILABLE'};}
 }};
}

import { productionLessonFactsOutputSchema } from '../tools/contracts.ts';
import type { ProductionLessonFactsBinding } from './production-lesson-facts-binding.server.ts';
import type { ProductionLessonExecutionFactsReadPort } from './index.ts';
export function createProductionLessonExecutionFactsReadPort(issuer:ProductionLessonFactsBinding):ProductionLessonExecutionFactsReadPort {
 return {async read(handle,context){try{
  const {content,facts,receipt}=await issuer.read(handle,context),p=receipt.provenance,e=receipt.evidence;
  const data=productionLessonFactsOutputSchema.parse({...content,currentTeachingNode:null,currentPositionAvailability:'unavailable',completionStatus:receipt.status,attemptCount:facts.attemptCount,latestResult:facts.latestResult,nodeProgress:facts.nodeProgress,
   evidence:{source:p.source,storage:p.storage,kind:e.kind,receiptContract:receipt.contract,publicationRevision:p.publicationRevision,snapshotRef:p.snapshotRef,scopeRef:p.scopeRef,receiptRef:teachingRef('receipt',[p.runId,p.skillRunId,p.modelCallId,p.toolCallId,p.revision,p.asOf]),readStartedAt:p.readStartedAt,deadlineAt:p.deadlineAt,attemptSequence:e.attemptSequence,observedAt:p.observedAt,latestAttemptAt:e.latestAttemptAt,progressUpdatedAt:e.progressUpdatedAt},
   revision:p.revision,asOf:p.asOf,completedAt:receipt.completedAt,evidenceRefs:[{kind:'durable_activity_completion',sourceRef:content.activityRef,revision:p.revision}],completeness:'partial',truncated:false});
  return {status:'partial',data,sourceRefs:[content.activityRef]};
 }catch(error){return {status:error instanceof FactsReadError?error.status:'unavailable',code:'READ_UNAVAILABLE'};}}};
}
