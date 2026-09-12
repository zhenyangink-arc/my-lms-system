import { z } from 'zod';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { activityResponseSchema, type ActivityResponse } from './activity.ts';
import { pageResponseSchema, type PageResponse, type PageCheck } from './activity-pages.ts';
import { patternResponseSchema, type PatternResponse } from './patterns.ts';
import { activityResultSchema,type ActivityResult,type ServerLearningState } from './services.ts';

/** Restoration and preview practice are not formal completion authorities. */
export const learningRestoreSchema = z.strictObject({
  snapshotId:idSchema, capsuleRef:idSchema, revision:z.string(),
  activities:z.array(z.strictObject({activityRef:idSchema,completed:z.boolean(),response:activityResponseSchema.nullable(),feedback:activityResultSchema.nullable()})),
  pages:z.array(z.strictObject({pageId:idSchema,response:pageResponseSchema,checked:z.boolean(),ready:z.boolean(),items:z.array(z.strictObject({partId:idSchema,correct:z.boolean()}))})),
  patterns:z.array(z.strictObject({activityRef:idSchema,responses:z.array(patternResponseSchema)})),
  practiceAcceptedRefs:z.array(idSchema),
});
export type LearningRestore = z.infer<typeof learningRestoreSchema>;
export interface LearningFlowServices {
  restore(capsuleRef:string,signal:AbortSignal):Promise<LearningRestore>;
  revealPage(capsuleRef:string,pageId:string,signal:AbortSignal):Promise<{response:PageResponse;check:PageCheck}>;
  finishPages(capsuleRef:string,activityRef:string,signal:AbortSignal):Promise<ActivityResult>;
  finishPattern(capsuleRef:string,activityRef:string,responses:PatternResponse[],signal:AbortSignal):Promise<ActivityResult>;
}
export type HistoryProjection = { server:ServerLearningState; capsules:LearningRestore[] };
export function acceptLearningRestore(input:unknown,snapshotId:string,capsuleRef:string){
  const state=learningRestoreSchema.parse(input);
  if(state.snapshotId!==snapshotId||state.capsuleRef!==capsuleRef)throw Error('LEARNING_RESTORE_SCOPE');
  for(const ids of [state.activities.map(a=>a.activityRef),state.pages.map(p=>p.pageId),state.patterns.map(p=>p.activityRef),state.practiceAcceptedRefs])if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_RESTORE_ID');
  return state;
}
export function restoredActivity(state:LearningRestore|null,ref:string):ActivityResponse|null {
  return state?.activities.find(a=>a.activityRef===ref)?.response??null;
}
