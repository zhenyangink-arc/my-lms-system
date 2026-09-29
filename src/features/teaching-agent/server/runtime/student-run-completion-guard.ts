import 'server-only';
import { createHash } from 'node:crypto';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import type { createStudentAiTeacherCapabilities } from '../composition/create-student-ai-teacher-capabilities.ts';
import type { TraceEvent } from '../../../agent-core/observability/trace.ts';
type Capabilities = Awaited<ReturnType<typeof createStudentAiTeacherCapabilities>>;

export function createStudentRunCompletionGuard(capabilities: Capabilities, locale: 'zh-CN' | 'ko-KR') {
  return {
    async evidence() {
      const result = await capabilities.validateEvidence();
      if (result.status !== 'satisfied') throw new CoreError('REQUIRED_EVIDENCE_MISSING');
      return result;
    },
    async complete(text: string, checked: (kind: 'evidence.checked' | 'output.checked', details: TraceEvent['details']) => Promise<void>) {
      const evidence = await capabilities.validateEvidence();
      if (evidence.status !== 'satisfied') {
        await checked('evidence.checked', { status: 'fail' }); throw new CoreError('REQUIRED_EVIDENCE_MISSING');
      }
      const metadata = { status: 'pass' as const, revision: evidence.revision, segmentRef: evidence.segmentRef,
        sourceRefs: evidence.sourceRefs, completeness: evidence.completeness, asOf: evidence.asOf };
      await checked('evidence.checked', metadata);
      const validated = await capabilities.validateOutput({ responseText: text, locale, completeness: evidence.completeness,
        ...(evidence.completeness === 'partial' ? { limitation: locale === 'zh-CN' ? '课程证据不完整，本次只解释已核验的部分。' : '확인된 자료의 일부만 설명합니다.' } : {}) });
      if (validated.status !== 'accepted') {
        await checked('output.checked', { status: 'fail' }); throw new CoreError('SKILL_OUTPUT_INVALID');
      }
      await checked('output.checked', metadata);
      return validated.output;
    },
  };
}

import type { AgentProfile,TypedEvidenceRequirement } from '../../../agent-core/contracts/server.ts';
import type { TypedTraceEvidence } from '../../../agent-core/observability/trace.ts';
import { versionKey } from '../../../agent-core/skills/registry.ts';
import type { createProductionLessonExecutionCapabilities } from '../composition/create-production-lesson-execution-capabilities.ts';
export function requireCompleteEvidenceSet(required:readonly TypedEvidenceRequirement[],evidence:readonly TypedTraceEvidence[]){
 if(!required.length||new Set(required.map(r=>r.kind+':'+versionKey(r.toolRef))).size!==required.length||evidence.length!==required.length)throw new CoreError('REQUIRED_EVIDENCE_MISSING');
 for(const r of required)if(evidence.filter(e=>e.kind===r.kind&&versionKey(e.toolRef)===versionKey(r.toolRef)).length!==1)throw new CoreError('REQUIRED_EVIDENCE_MISSING');
}
export function createProductionStudentCompletionGuard(capabilities:Awaited<ReturnType<typeof createProductionLessonExecutionCapabilities>>,profile:AgentProfile){
 return {async complete(_modelText:string,checked:(kind:'evidence.checked'|'output.checked',details:TraceEvent['details'])=>Promise<void>){
  if(profile.artifacts?.schemaVersion!==2)throw new CoreError('REQUIRED_EVIDENCE_MISSING');
  const evidenceSet=await capabilities.traceEvidence();requireCompleteEvidenceSet(profile.artifacts.requiredEvidence,evidenceSet);
  const output=await capabilities.complete({});
  const fresh=await capabilities.traceEvidence();if(JSON.stringify(fresh)!==JSON.stringify(evidenceSet))throw new CoreError('REQUIRED_EVIDENCE_MISSING');
  const metadata={status:'pass' as const,evidenceSet,sourceRefs:[output.activityRef],revision:output.revision,asOf:output.asOf,completeness:'partial' as const};
  await checked('evidence.checked',metadata);await checked('output.checked',{...metadata,outputDigest:createHash('sha256').update(JSON.stringify(output)).digest('hex')});
  // Model text is never persisted as a source of authoritative execution fields.
  return {...output,responseText:JSON.stringify(output),sourceRefs:[output.activityRef],limitation:undefined};
 }};
}
