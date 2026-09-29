import 'server-only';
import type { ToolExecutionContext } from '../../../agent-core/contracts/tool.ts';
import { versionKey } from '../../../agent-core/skills/registry.ts';
import { lessonFactsContentSchema, lessonFactsOutputSchema, lessonFactsToolRef, type LessonExecutionFacts } from '../../server/tools/contracts.ts';
import { isPrivateToolReceipt, type PrivateToolReceipt } from '../../server/skills/tool-evidence-ledger.ts';
import { executionSummarySkillRef } from './definition.ts';
import type { z } from 'zod';
import type { FactsGrant } from '../../server/domain-ports/lesson-execution-facts-binding.ts';
export interface ExecutionEvidenceBinding {
 readonly content: z.infer<typeof lessonFactsContentSchema>;
 readonly storage: 'isolated-test-db';
 readonly runStartedAt: number;
 readonly snapshot: FactsGrant;
}
export type ExecutionSummaryEvidence = { status: 'satisfied'; facts: LessonExecutionFacts }
 | { status: 'missing' | 'invalid'; code: 'REQUIRED_EVIDENCE_MISSING' };
/** Provenance/freshness validation only; domain completion was already validated
 * by the existing Lesson Tool. No completion algorithm is duplicated here. */
export function checkExecutionSummaryEvidence(receipt: PrivateToolReceipt | undefined,
 binding: ExecutionEvidenceBinding, context: Omit<ToolExecutionContext, 'callId' | 'modelCallId'>): ExecutionSummaryEvidence {
 const invalid = { status: 'invalid', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
 if (!receipt) return { status: 'missing', code: 'REQUIRED_EVIDENCE_MISSING' };
 const r = receipt, now = Date.now();
 if (!isPrivateToolReceipt(r) || r.binding !== binding || r.authority !== context.authority
  || r.authoritySnapshot !== JSON.stringify(context.authority) || context.signal.aborted
  || r.runId !== context.runId || r.skillRunId !== context.skillRunId || r.deadlineAt !== context.deadlineAt
  || Date.parse(context.deadlineAt) <= now || Date.parse(context.authority.expiresAt) <= now
  || versionKey(r.skillVersion) !== versionKey(executionSummarySkillRef) || versionKey(r.toolVersion) !== versionKey(lessonFactsToolRef)
  || !r.toolCallId || !r.modelCallId || r.readStartedAt < binding.runStartedAt || r.returnedAt > now
  || (r.result.status !== 'ok' && r.result.status !== 'partial')) return invalid;
 const parsed = lessonFactsOutputSchema.safeParse(r.result.data);
 if (!parsed.success) return invalid;
 const d = parsed.data, observed = Date.parse(d.asOf);
 if (d.evidence.storage !== binding.storage || d.evidence.observedAt !== d.asOf
  || observed < r.readStartedAt || observed > r.returnedAt || now - observed > 30000
  || r.result.sourceRefs.length !== 1 || r.result.sourceRefs[0] !== binding.content.activityRef
  || d.evidenceRefs[0].sourceRef !== binding.content.activityRef || d.evidenceRefs[0].revision !== d.revision
  || JSON.stringify(lessonFactsContentSchema.parse(Object.fromEntries(Object.keys(lessonFactsContentSchema.shape).map(k => [k, d[k as keyof typeof d]])))) !== JSON.stringify(binding.content)) return invalid;
 return { status: 'satisfied', facts: d };
}

import { productionLessonFactsOutputSchema,productionLessonFactsToolRef,type ProductionLessonExecutionFacts } from '../../server/tools/contracts.ts';
import { productionExecutionSummarySkillRef } from './definition.ts';
import type { VerifiedStudentBinding } from '../../server/selection/selection-types.ts';
export interface ProductionExecutionEvidenceBinding { readonly student:VerifiedStudentBinding;readonly runStartedAt:number }
export type ProductionExecutionEvidence={status:'satisfied';facts:ProductionLessonExecutionFacts;receipt:PrivateToolReceipt}|{status:'missing'|'invalid';code:'REQUIRED_EVIDENCE_MISSING'};
export function checkProductionExecutionEvidence(r:PrivateToolReceipt|undefined,binding:ProductionExecutionEvidenceBinding,context:Omit<ToolExecutionContext,'callId'|'modelCallId'>):ProductionExecutionEvidence {
 const invalid={status:'invalid',code:'REQUIRED_EVIDENCE_MISSING'} as const;
 if(!r)return {status:'missing',code:'REQUIRED_EVIDENCE_MISSING'};
 const now=Date.now();
 if(!isPrivateToolReceipt(r)||r.binding!==binding||r.authority!==binding.student.authority||r.authority!==context.authority||r.authoritySnapshot!==JSON.stringify(context.authority)||context.signal.aborted||r.runId!==context.runId||r.skillRunId!==context.skillRunId||r.deadlineAt!==context.deadlineAt||Date.parse(context.deadlineAt)<=now||Date.parse(context.authority.expiresAt)<=now||versionKey(r.skillVersion)!==versionKey(productionExecutionSummarySkillRef)||versionKey(r.toolVersion)!==versionKey(productionLessonFactsToolRef)||!r.toolCallId||!r.modelCallId||r.readStartedAt<binding.runStartedAt||r.returnedAt>now||(r.result.status!=='ok'&&r.result.status!=='partial'))return invalid;
 const parsed=productionLessonFactsOutputSchema.safeParse(r.result.data);if(!parsed.success)return invalid;
 const d=parsed.data,e=d.evidence,observed=Date.parse(d.asOf);
 if(e.scopeRef!==context.authority.scopeRef||e.deadlineAt!==context.deadlineAt||e.observedAt!==d.asOf||Date.parse(e.readStartedAt)<r.readStartedAt||observed<Date.parse(e.readStartedAt)||observed>r.returnedAt||now-observed>30000||d.lessonRef!==binding.student.selection.lessonRef||d.scriptVersionRef!==binding.student.selection.scriptVersionRef||d.sourceTeachingNodeRef!==binding.student.selection.nodeRef||r.result.sourceRefs.length!==1||r.result.sourceRefs[0]!==d.activityRef||d.evidenceRefs[0].sourceRef!==d.activityRef||d.evidenceRefs[0].revision!==d.revision)return invalid;
 return {status:'satisfied',facts:d,receipt:r};
}
