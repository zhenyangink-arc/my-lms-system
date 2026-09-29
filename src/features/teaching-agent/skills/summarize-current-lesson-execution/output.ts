import 'server-only';
import { z } from 'zod';
import { lessonFactsOutputSchema } from '../../server/tools/contracts.ts';
import type { ExecutionSummaryEvidence } from './evidence.ts';
import { executionSummaryOutputRef } from './definition.ts';
/** No model-authored authoritative fields or free text are accepted. */
export const executionSummaryInputSchema = z.strictObject({});
export function projectExecutionSummary(input: unknown, evidence: ExecutionSummaryEvidence) {
 if (evidence.status !== 'satisfied') return { status: 'rejected', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
 if (!executionSummaryInputSchema.safeParse(input).success) return { status: 'rejected', code: 'SKILL_OUTPUT_INVALID' } as const;
 // Existing bounded schema preserves null cursor and excludes raw/private fields.
 const facts = lessonFactsOutputSchema.parse(evidence.facts);
 return { status: 'accepted', output: { contract: { ...executionSummaryOutputRef }, ...facts } } as const;
}

import { productionLessonFactsOutputSchema } from '../../server/tools/contracts.ts';
import type { ProductionExecutionEvidence } from './evidence.ts';
import { productionExecutionSummaryOutputRef } from './definition.ts';
export function projectProductionExecutionSummary(input:unknown,evidence:ProductionExecutionEvidence){
 if(evidence.status!=='satisfied')return {status:'rejected',code:'REQUIRED_EVIDENCE_MISSING'} as const;
 if(!executionSummaryInputSchema.safeParse(input).success)return {status:'rejected',code:'SKILL_OUTPUT_INVALID'} as const;
 return {status:'accepted',output:{contract:{...productionExecutionSummaryOutputRef},...productionLessonFactsOutputSchema.parse(evidence.facts)}} as const;
}
