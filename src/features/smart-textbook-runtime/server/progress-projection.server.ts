import 'server-only';
import { z } from 'zod';
import { projectActivityPage,projectGuidedRepeat,assertServiceScope,type ServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import type { ReadinessBindings } from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';

const identity={tenant_id:z.string(),student_id:z.string()};
const historySchema=z.strictObject({
  attempts:z.array(z.strictObject({...identity,activity_id:z.string(),version_id:z.string(),attempt_number:z.number().int().positive(),is_correct:z.boolean().nullable(),score:z.number().nullable(),meets_completion_requirements:z.boolean()})),
  nodes:z.array(z.strictObject({...identity,node_id:z.string(),version_id:z.string(),status:z.enum(['not_started','in_progress','completed']),completion_percent:z.number().min(0).max(100)})),
  pages:z.array(z.strictObject({...identity,activity_id:z.string(),version_id:z.string(),page_index:z.number().int().nonnegative(),item_indices:z.array(z.number().int().nonnegative()),response:z.array(z.union([z.number(),z.string()])),results:z.array(z.boolean()),answers:z.array(z.union([z.number(),z.string()]))})),
  repeats:z.array(z.strictObject({...identity,activity_id:z.string(),practice_key:z.literal('repeat-line'),track_index:z.number().int().nonnegative(),segment_index:z.number().int().nonnegative()})),
  evidence:z.array(z.strictObject({...identity,id:z.string(),activity_id:z.string(),metadata:z.strictObject({practiceKey:z.literal('repeat-line'),trackIndex:z.number().int().nonnegative(),segmentIndex:z.number().int().nonnegative()})})),
});
/** Accept only rows from an already authorized domain read. No self-authored completion,
 * private transcript or answer array is returned; no new persistence. */
export function projectPersistedHistory(manifest:LessonManifestV1,bindings:PrivateBindings,services:ReadinessBindings,scope:ServiceScope,input:unknown){
  assertServiceScope(services,scope);const rows=historySchema.parse(input);
  for(const group of Object.values(rows))for(const row of group){if(row.tenant_id!==scope.tenantId||row.student_id!==scope.actorId)throw Error('HISTORY_OWNER_MISMATCH');if('version_id'in row&&row.version_id!==scope.versionId)throw Error('HISTORY_VERSION_MISMATCH');}
  const activity=(id:string)=>{const b=bindings.activities.find(a=>a.activityId===id&&a.versionId===scope.versionId);if(!b)throw Error('UNKNOWN_HISTORY_ACTIVITY');return b.ref;};
  const attempts=rows.attempts.map(a=>({activityRef:activity(a.activity_id),attemptNumber:a.attempt_number,correct:a.is_correct,score:a.score,meetsCompletionRequirements:a.meets_completion_requirements}));
  const nodes=rows.nodes.map(n=>{const capsule=bindings.capsules.find(c=>c.kind==='learning'&&c.nodeId===n.node_id);if(!capsule||!manifest.steps.some(s=>s.id===capsule.stepId))throw Error('UNKNOWN_HISTORY_NODE');return {stepId:capsule.stepId,status:n.status,completionPercent:n.completion_percent};});
  if(new Set(nodes.map(n=>n.stepId)).size!==nodes.length)throw Error('DUPLICATE_HISTORY_NODE');
  const completedStepIds=nodes.filter(n=>n.status==='completed').map(n=>n.stepId);
  const pageProgress=rows.pages.map(p=>{
    activity(p.activity_id);const projected=projectActivityPage(services,scope,{activityId:p.activity_id,versionId:p.version_id,pageIndex:p.page_index,itemIndices:p.item_indices,response:p.response,results:p.results,answers:p.answers});
    return {pageId:projected.pageId,activityRef:activity(p.activity_id),items:projected.items.map(i=>({partId:i.partId,response:i.response,correct:i.result}))};
  });
  if(new Set(pageProgress.map(p=>p.pageId)).size!==pageProgress.length)throw Error('DUPLICATE_HISTORY_PAGE');
  const guidedRepeat=projectGuidedRepeat(services,scope,rows.repeats.map(r=>({activityId:r.activity_id,practiceKey:r.practice_key,trackIndex:r.track_index,segmentIndex:r.segment_index})));
  const speakingEvidence=rows.evidence.map(e=>{const binding=services.guidedRepeat.find(r=>r.activityId===e.activity_id&&r.legacyTrack===e.metadata.trackIndex&&r.legacySegment===e.metadata.segmentIndex);if(!binding)throw Error('UNKNOWN_EVIDENCE_SEGMENT');return {activityRef:activity(e.activity_id),evidenceId:e.id,trackId:binding.trackId,segmentId:binding.segmentId};});
  if(new Set(speakingEvidence.map(e=>e.evidenceId)).size!==speakingEvidence.length)throw Error('DUPLICATE_HISTORY_EVIDENCE');
  return {snapshotId:manifest.snapshot.id,attempts,nodes,completedStepIds,pageProgress,guidedRepeat,speakingEvidence};
}
