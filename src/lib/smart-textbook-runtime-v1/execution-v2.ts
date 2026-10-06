import { z } from 'zod';
import { stableIdPattern } from './targets.ts';
const id=z.string().regex(stableIdPattern), hash=z.string().regex(/^[a-f0-9]{64}$/);
export const timelineCueSchema=z.strictObject({
  id,stepId:id,sourceBlockId:id,mediaRevision:id,triggerType:z.literal('time'),triggerTime:z.number().finite().nonnegative(),
  action:z.literal('show_activity'),targetBlockId:id,pauseSource:z.literal(true),mandatory:z.literal(true),
  resumePolicy:z.literal('after_authoritative_activity_completion'),sortOrder:z.number().int().positive(),
});

export const nativeExecutionV2Schema=z.strictObject({
  contract:z.literal('native-execution/2'),targetAlias:id,lessonBinding:hash,scriptVersionBinding:hash,scriptVersion:z.number().int().positive(),
  sourceNodes:z.array(z.strictObject({nodeNumber:z.number().int().positive(),binding:hash,rowHash:hash,blockIds:z.tuple([id,id]).refine(v=>v[0]!==v[1])})).length(1),
  media:z.array(z.strictObject({blockId:id,revision:id,durationSeconds:z.literal(30)})).length(1),
  cues:z.array(timelineCueSchema.extend({id:z.literal('pause-1')})).length(1),initialLayout:z.literal('split'),
});
export type NativeExecutionV2=z.infer<typeof nativeExecutionV2Schema>;
