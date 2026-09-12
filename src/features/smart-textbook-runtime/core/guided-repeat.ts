import { z } from 'zod';

const id=z.string().min(1);
export const repeatLessonSchema=z.strictObject({
  snapshotId:id,revision:id,capsuleRef:id,stepId:id,blockId:id,sectionPartId:id,activityRef:id,
  tracks:z.array(z.strictObject({id,title:z.string(),keywords:z.array(z.string()),target:id,
    segments:z.array(z.strictObject({id,target:id,text:z.string().min(1),translation:z.string(),locale:z.literal('ko-KR'),playback:z.literal('browser-tts')})).min(1),
  })).min(1),
});
export type RepeatLesson=z.infer<typeof repeatLessonSchema>;
export const repeatStateSchema=z.strictObject({snapshotId:id,revision:id,mode:z.enum(['preview-isolated','production-domain']),
  practicedSegmentIds:z.array(id),formalCompletion:z.literal(false),progressDelta:z.null(),score:z.null()});
export type RepeatState=z.infer<typeof repeatStateSchema>;
export type GuidedRepeatServices={
  load(capsuleRef:string,signal:AbortSignal):Promise<{lesson:RepeatLesson;state:RepeatState}|null>;
  mark(capsuleRef:string,trackId:string,segmentId:string,signal:AbortSignal):Promise<RepeatState>;
};
/** Practice markers, NOT activity completion, score, or proof of listening. */
export function acceptRepeatState(lesson:RepeatLesson,input:unknown){
  const state=repeatStateSchema.parse(input),ids=new Set(lesson.tracks.flatMap(t=>t.segments.map(s=>s.id)));
  if(state.snapshotId!==lesson.snapshotId||state.revision!==lesson.revision||new Set(state.practicedSegmentIds).size!==state.practicedSegmentIds.length||state.practicedSegmentIds.some(id=>!ids.has(id)))throw Error('REPEAT_STATE_SCOPE');
  return state;
}
