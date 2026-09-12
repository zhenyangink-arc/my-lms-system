import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { ReadinessBindings } from '../../../lib/smart-textbook-legacy-adapter/readiness-contracts.server.ts';
import { assertServiceScope,guidedRepeatServiceInput,projectGuidedRepeat,type ServiceScope } from '../../../lib/smart-textbook-legacy-adapter/compatibility-services.server.ts';
import { repeatLessonSchema,acceptRepeatState,type RepeatLesson,type RepeatState } from '../core/guided-repeat.ts';
import { digest } from '../../../lib/smart-textbook-legacy-adapter/identity.server.ts';

/** Reads frozen coordinates only on the server; coordinates never become identity. */
export function repeatLesson(manifest:LessonManifestV1,bindings:PrivateBindings,services:ReadinessBindings,capsuleRef:string,locale:'zh-CN'|'ko-KR'):RepeatLesson|null{
  const capsule=bindings.capsules.find(c=>c.id===capsuleRef),block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===capsuleRef);
  if(!capsule||capsule.kind!=='learning'||!block||block.stepId!==capsule.stepId||services.versionId!==manifest.version.id)throw Error('REPEAT_CAPSULE_SCOPE');
  const section=capsule.sections.find(s=>s.slot==='repeatTracks');if(!section||section.slot!=='repeatTracks')return null;
  const rows=services.guidedRepeat.filter(r=>r.nodeId===capsule.nodeId);
  const activityIds=new Set(rows.map(r=>r.activityId));if(activityIds.size!==1||new Set(rows.map(r=>r.segmentId)).size!==rows.length)throw Error('REPEAT_IDENTITY');
  const activity=bindings.activities.find(a=>a.activityId===rows[0].activityId&&a.versionId===manifest.version.id);
  if(!activity||block.type!=='compat.learning.v1'||!block.props.activityRefs.includes(activity.ref))throw Error('REPEAT_ACTIVITY_SCOPE');
  const target=(partId:string)=>{const found=manifest.runtimeTargets.filter(t=>t.blockId===block.id&&t.stepId===capsule.stepId&&t.partId===partId);if(found.length!==1)throw Error('REPEAT_TARGET');return found[0].id;};
  const tracks=[...new Set(rows.map(r=>r.trackId))].map(trackId=>{
    const segments=rows.filter(r=>r.trackId===trackId).sort((a,b)=>a.legacySegment-b.legacySegment);
    const indexes=new Set(segments.map(r=>r.legacyTrack));if(indexes.size!==1)throw Error('REPEAT_TRACK');
    const track=section.body[segments[0].legacyTrack];
    if(!track||segments.length!==track.lines.length)throw Error('REPEAT_SEGMENT_COVERAGE');
    const identity=bindings.identities.find(i=>i.owner===capsule.nodeId&&i.partId===trackId);
    if(identity?.legacyPath!==`content.repeatTracks[${segments[0].legacyTrack}]`)throw Error('REPEAT_FROZEN_TRACK');
    return {id:trackId,title:track.title[locale],keywords:track.keywords,target:target(trackId),segments:segments.map(r=>{
      const line=track.lines[r.legacySegment],frozen=bindings.identities.find(i=>i.owner===capsule.nodeId&&i.partId===r.segmentId);
      if(!line||r.fingerprint!==digest(line)||frozen?.legacyPath!==`content.repeatTracks[${r.legacyTrack}].lines[${r.legacySegment}]`)throw Error('REPEAT_FROZEN_SEGMENT');
      return {id:r.segmentId,target:target(r.segmentId),text:line.ko,translation:line.zh,locale:'ko-KR' as const,playback:'browser-tts' as const};
    })};
  }).sort((a,b)=>rows.find(r=>r.trackId===a.id)!.legacyTrack-rows.find(r=>r.trackId===b.id)!.legacyTrack);
  if(tracks.length!==section.body.length)throw Error('REPEAT_TRACK_COVERAGE');
  return repeatLessonSchema.parse({snapshotId:manifest.snapshot.id,revision:services.sourceRevision,capsuleRef,stepId:capsule.stepId,blockId:block.id,sectionPartId:section.partId,activityRef:activity.ref,tracks});
}

export function repeatState(lesson:RepeatLesson,mode:RepeatState['mode'],ids:string[]):RepeatState{
  return acceptRepeatState(lesson,{snapshotId:lesson.snapshotId,revision:lesson.revision,mode,practicedSegmentIds:[...new Set(ids)].sort(),formalCompletion:false,progressDelta:null,score:null});
}
/** Actual SELECT Reader. Caller must supply freshly authorized server scope and
 * source-bound manifest; never accepts student/tenant identity from request JSON.
 * No R2/object metadata, transcript, scoring keys, or other students' rows read. */
export async function readGuidedRepeatHistory(db:SupabaseClient,services:ReadinessBindings,scope:ServiceScope,lesson:RepeatLesson){
  assertServiceScope(services,scope);
  if(lesson.revision!==services.sourceRevision)throw Error('REPEAT_REVISION');
  const activityIds=[...new Set(services.guidedRepeat.filter(r=>lesson.tracks.some(t=>t.id===r.trackId)).map(r=>r.activityId))];
  if(activityIds.length!==1)throw Error('REPEAT_ACTIVITY_SCOPE');
  const {data,error}=await db.from('digital_textbook_guided_repeat_progress')
    .select('activity_id,practice_key,track_index,segment_index')
    .eq('tenant_id',scope.tenantId).eq('student_id',scope.actorId)
    .eq('activity_id',activityIds[0]).eq('practice_key','repeat-line');
  if(error)throw Error('REPEAT_HISTORY_UNAVAILABLE');
  const ids=projectGuidedRepeat(services,scope,(data??[]).map(r=>({activityId:r.activity_id,practiceKey:r.practice_key,trackIndex:r.track_index,segmentIndex:r.segment_index})));
  return repeatState(lesson,'production-domain',ids);
}
/** Binding adapter delegates to the existing Action (which reauthenticates).
 * Not exported as a client Action and NOT wired to a production route. */
export async function saveBoundGuidedRepeat(services:ReadinessBindings,scope:ServiceScope,lesson:RepeatLesson,trackId:string,segmentId:string,
  save:(input:ReturnType<typeof guidedRepeatServiceInput>)=>Promise<{ok:boolean}>){
  if(lesson.revision!==scope.sourceRevision||!lesson.tracks.find(t=>t.id===trackId)?.segments.some(s=>s.id===segmentId))throw Error('REPEAT_SEGMENT_SCOPE');
  const result=await save(guidedRepeatServiceInput(services,scope,trackId,segmentId));
  if(!result.ok)throw Error('REPEAT_SAVE_FAILED');
}

/** Explicitly isolated, bounded and expiring. Same owner+snapshot can reload in
 * this process; a process restart/other replica loses PREVIEW markers only.
 * No production database/recording store is ever passed to this backend. */
export function createPreviewRepeatStore(now=()=>Date.now()){
  const entries=new Map<string,{expiresAt:number;ids:Set<string>}>();
  function entry(ownerId:string,lesson:RepeatLesson){
    if(!ownerId)throw Error('PREVIEW_OWNER_REQUIRED');
    for(const [key,value] of entries)if(value.expiresAt<=now())entries.delete(key);
    const key=JSON.stringify([ownerId,lesson.snapshotId,lesson.revision,lesson.capsuleRef]);
    let value=entries.get(key);if(!value){if(entries.size>=32)throw Error('PREVIEW_STORE_FULL');value={expiresAt:now()+30*60*1000,ids:new Set()};entries.set(key,value);}return value;
  }
  return {
    read:(ownerId:string,lesson:RepeatLesson)=>repeatState(lesson,'preview-isolated',[...entry(ownerId,lesson).ids]),
    mark(ownerId:string,lesson:RepeatLesson,trackId:string,segmentId:string){
      if(!lesson.tracks.find(t=>t.id===trackId)?.segments.some(s=>s.id===segmentId))throw Error('REPEAT_SEGMENT_SCOPE');
      const value=entry(ownerId,lesson);value.ids.add(segmentId);return repeatState(lesson,'preview-isolated',[...value.ids]);
    },
  };
}
