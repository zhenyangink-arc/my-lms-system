import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { ReadinessBindings } from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import { assertServiceScope,type ServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import { activityExecutions } from './activity-binding.server.ts';
import { activityPages } from './activity-pages.server.ts';
import { patternExecutions } from './pattern-binding.server.ts';
import { restoreActivityResponse,restorePatternResponses } from './history-response.server.ts';
import { repeatLesson,readGuidedRepeatHistory } from './guided-repeat.server.ts';
import { learningRestoreSchema,type HistoryProjection } from '../core/learning-flow.ts';
import { recordingRestoreSchema,recordingSlots,recordingPlanSchema,type RecordingRuntimeServices } from '../core/recording.ts';
import type { ActivityResult } from '../core/services.ts';
import { readAttemptHistory } from './history-pagination.server.ts';
import { restoreNativeChoice } from './native-choice-history.server.ts';

export type HistoryAuthority = {
  db:SupabaseClient; manifest:LessonManifestV1; bindings:PrivateBindings;
  services:ReadinessBindings; scope:ServiceScope; locale:'zh-CN'|'ko-KR';
  sessionId:string; snapshotId:string;
  nodes:ReadonlyArray<{id:string;node_code:string}>;
  recording:Pick<RecordingRuntimeServices,'load'|'restore'>;
};
const attemptSchema=z.object({activity_id:z.string(),response:z.unknown(),attempt_number:z.number().int().positive(),is_correct:z.boolean().nullable(),score:z.number().nullable(),meets_completion_requirements:z.boolean(),created_at:z.string()});
const nodeSchema=z.object({node_id:z.string(),status:z.enum(['not_started','in_progress','completed']),completion_percent:z.number().min(0).max(100)});
const pageSchema=z.object({activity_id:z.string(),page_index:z.number().int().nonnegative(),item_indices:z.array(z.number().int().nonnegative()),response:z.array(z.union([z.number(),z.string()])),results:z.array(z.boolean())});

/** Fresh authorization is REQUIRED on every refresh. The adapter makes real,
 * owner/version/visible-activity-scoped SELECTs. Tests replace only DB transport.
 * Recording history MUST go through the existing gateway's safe restore port. */
export function createLearningHistoryReader(authorize:()=>Promise<HistoryAuthority>,expected:{sessionId:string;snapshotId:string}){
  return async(signal:AbortSignal):Promise<HistoryProjection>=>{
    signal.throwIfAborted();const a=await authorize();assertServiceScope(a.services,a.scope);
    const {manifest:m,bindings:b,services:s,scope}=a;
    if(a.sessionId!==expected.sessionId||a.snapshotId!==expected.snapshotId||m.snapshot.id!==a.snapshotId||m.version.id!==scope.versionId)throw Error('HISTORY_SESSION_SCOPE');
    const capsules=b.capsules.filter(c=>c.kind==='learning'),ids=b.activities.map(x=>x.activityId),nodes=capsules.map(c=>c.nodeId);
    const filter=(table:string,columns:string)=>a.db.from(table).select(columns).eq('tenant_id',scope.tenantId).eq('student_id',scope.actorId).eq('version_id',scope.versionId);
    const [attemptResult,nodeResult,pageResult]=await Promise.all([
      readAttemptHistory({db:a.db,...scope,activityIds:ids,signal}),
      filter('digital_textbook_node_progress','node_id,status,completion_percent').in('node_id',nodes),
      filter('digital_textbook_activity_page_progress','activity_id,page_index,item_indices,response,results').in('activity_id',ids),
    ]);signal.throwIfAborted();
    if(nodeResult.error||pageResult.error)throw Error('HISTORY_READ_UNAVAILABLE');
    const attempts=z.array(attemptSchema).parse(attemptResult),nodeRows=z.array(nodeSchema).parse(nodeResult.data??[]),pageRows=z.array(pageSchema).parse(pageResult.data??[]);
    if(attempts.some(x=>!ids.includes(x.activity_id))||nodeRows.some(x=>!nodes.includes(x.node_id))||pageRows.some(x=>!ids.includes(x.activity_id)))throw Error('HISTORY_BINDING_SCOPE');
    if(new Set(nodeRows.map(x=>x.node_id)).size!==nodeRows.length)throw Error('HISTORY_DUPLICATE_NODE');
    const completed=(ref:string)=>attempts.some(x=>x.activity_id===ref&&(x.is_correct===true||x.meets_completion_requirements));
    const server:HistoryProjection['server']={snapshotId:m.snapshot.id,revision:scope.sourceRevision,completedStepIds:nodeRows.filter(x=>x.status==='completed').map(x=>capsules.find(c=>c.nodeId===x.node_id)!.stepId),attempts:[],activityProgress:b.activities.map(x=>({activityRef:x.ref,completed:completed(x.activityId)})),pageProgress:[],guidedRepeat:[],speakingEvidence:[]};
    for(const binding of b.activities){const rows=attempts.filter(x=>x.activity_id===binding.activityId);
      const native=m.blocks.some(x=>x.type==='multiple_choice'&&x.props.activityRef===binding.ref);
      const row=(native?rows.filter(x=>x.is_correct===true||x.meets_completion_requirements).at(-1):undefined)??rows.at(-1);
      if(row){const result:ActivityResult={ok:true,correct:row.is_correct,score:row.score,explanation:a.locale==='ko-KR'?'서버에 저장된 답변을 복원했습니다.':'已恢复服务端作答记录。',attemptNumber:row.attempt_number,preview:false,nodeId:null,nodeCompleted:false,completionPercent:0};
      // Match the old loader's latest qualifying response; pair native feedback
      // with that same attempt, not the feedback from a later unsuccessful retry.
      server.attempts.push({activityRef:binding.ref,result,...(native?{selectedOptionId:restoreNativeChoice(m,b,binding.ref,row.response)}:{})});}}
    const projected:HistoryProjection['capsules']=[];
    for(const c of capsules){
      const descriptors=activityExecutions(m,b,c.id,a.locale),patterns=patternExecutions(m,b,c.id,a.locale),pages=activityPages(b,s,c.id,a.locale);
      const latest=(ref:string)=>{const rows=attempts.filter(x=>x.activity_id===ref);return rows.filter(x=>x.is_correct===true||x.meets_completion_requirements).at(-1)??rows.at(-1);};
      const savedPages=pageRows.filter(x=>c.activities.some(y=>y.activityId===x.activity_id)).map(row=>{
        const frozen=s.activityPages.find(x=>x.activityId===row.activity_id&&x.legacyPage===row.page_index),page=pages.find(p=>p.pageId===frozen?.pageId);
        if(!frozen||!page||row.response.length!==row.item_indices.length||row.results.length!==row.item_indices.length||new Set(row.item_indices).size!==row.item_indices.length||row.item_indices.length!==frozen.items.length)throw Error('HISTORY_PAGE_SCOPE');
        const response=page.items.map(item=>{const coordinate=frozen.items.find(x=>x.partId===item.partId)!,n=row.item_indices.indexOf(coordinate.legacyItem);if(n<0)throw Error('HISTORY_PAGE_ITEM');if(item.kind==='fill')return {kind:'fill' as const,partId:item.partId,text:z.string().parse(row.response[n])};const option=item.options[z.number().int().nonnegative().parse(row.response[n])];if(!option)throw Error('HISTORY_PAGE_OPTION');return {kind:'choice' as const,partId:item.partId,optionId:option.id};});
        return {pageId:page.pageId,response,checked:true,ready:row.results.every(Boolean),items:response.map(item=>({partId:item.partId,correct:row.results[row.item_indices.indexOf(frozen.items.find(x=>x.partId===item.partId)!.legacyItem)]}))};
      });
      if(new Set(savedPages.map(p=>p.pageId)).size!==savedPages.length)throw Error('HISTORY_DUPLICATE_PAGE');
      const progress=b.progress.find(p=>p.kind==='activity-page'&&p.sourceId===c.nodeId);if(progress)server.pageProgress.push({progressRef:progress.ref,partIds:savedPages.filter(p=>p.ready).flatMap(p=>p.response.map(x=>x.partId))});
      const lesson=repeatLesson(m,b,s,c.id,a.locale);if(lesson){const repeat=await readGuidedRepeatHistory(a.db,s,scope,lesson);const ref=b.progress.find(p=>p.kind==='guided-repeat'&&p.sourceId===lesson.activityRef);if(!ref)throw Error('HISTORY_REPEAT_BINDING');server.guidedRepeat.push({progressRef:ref.ref,segmentIds:repeat.practicedSegmentIds});}
      // Safe gateway DTO, no raw evidence SELECT / storage metadata in this reader.
      const recordingPlans=(await a.recording.load(c.id,signal)).map(p=>recordingPlanSchema.parse(p));
      for(const plan of recordingPlans){
        if(plan.capsuleRef!==c.id||plan.stepId!==c.stepId||!c.activities.some(x=>x.activityId===plan.activityRef)||!m.blocks.some(x=>x.id===plan.blockId&&x.stepId===c.stepId))throw Error('HISTORY_RECORDING_SCOPE');
      }
      for(const activityRef of new Set(recordingPlans.map(p=>p.activityRef))){
        const slots=recordingPlans.filter(p=>p.activityRef===activityRef).flatMap(recordingSlots);
        const restored=recordingRestoreSchema.parse(await a.recording.restore(c.id,activityRef,signal));
        if(restored.recordings.some(r=>!slots.some(s=>s.partId===r.partId))||(restored.currentTurnId&&!slots.some(s=>s.partId===restored.currentTurnId)))throw Error('HISTORY_RECORDING_PART');
        for(const item of restored.recordings)if(!server.speakingEvidence.some(x=>x.evidenceId===item.id))server.speakingEvidence.push({activityRef,evidenceId:item.id});
      }
      projected.push(learningRestoreSchema.parse({snapshotId:m.snapshot.id,revision:scope.sourceRevision,capsuleRef:c.id,activities:descriptors.map(d=>({activityRef:d.ref,completed:completed(d.ref),response:restoreActivityResponse(d,latest(d.ref)?.response,b),feedback:server.attempts.find(a=>a.activityRef===d.ref)?.result??null})),pages:savedPages,patterns:patterns.filter(p=>latest(p.ref)?.response).map(p=>({activityRef:p.ref,responses:restorePatternResponses(p,latest(p.ref)!.response)})),practiceAcceptedRefs:[]}));
    }
    signal.throwIfAborted();return {server,capsules:projected};
  };
}
