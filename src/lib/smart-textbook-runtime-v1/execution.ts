import { z } from 'zod';
import { stableIdPattern } from './targets.ts';
import type { LessonManifestV1 } from './contracts.ts';
const id=z.string().regex(stableIdPattern), hash=z.string().regex(/^[a-f0-9]{64}$/);
export const timelineCueSchema=z.strictObject({
  id,stepId:id,sourceBlockId:id,mediaRevision:id,triggerType:z.literal('time'),triggerTime:z.number().finite().nonnegative(),
  action:z.literal('show_activity'),targetBlockId:id,pauseSource:z.literal(true),mandatory:z.literal(true),
  resumePolicy:z.literal('after_authoritative_activity_completion'),sortOrder:z.number().int().positive(),
});
export const nativeExecutionSchema=z.strictObject({
  contract:z.literal('native-execution/1'),targetAlias:id,lessonBinding:hash,scriptVersionBinding:hash,scriptVersion:z.literal(1),
  sourceNodes:z.array(z.strictObject({nodeNumber:z.union([z.literal(5),z.literal(7)]),binding:hash,rowHash:hash,blockIds:z.array(id).min(1)})).length(2),
  media:z.array(z.strictObject({blockId:id,revision:id,durationSeconds:z.number().finite().positive()})).length(1),
  cues:z.array(timelineCueSchema).min(1),initialLayout:z.literal('split'),
});
export type TimelineCue= z.infer<typeof timelineCueSchema>;
export type NativeExecution= z.infer<typeof nativeExecutionSchema>;
export function validateNativeExecution(m:LessonManifestV1):string[]{
  const e=m.execution;if(!e)return [];
  const errors:string[]=[];
  if(m.blocks.filter(b=>b.type==='video').length!==1)errors.push('ONE_NATIVE_MEDIA_OWNER_REQUIRED');
  if(m.compatibility.profile!=='native'||m.blocks.some(b=>b.type.startsWith('compat.')))errors.push('NATIVE_EXECUTION_ONLY');
  if(!m.requiredCapabilities.includes('timeline.cue.v1'))errors.push('CUE_CAPABILITY_REQUIRED');
  if(new Set(e.cues.map(c=>c.id)).size!==e.cues.length||new Set(e.media.map(x=>x.blockId)).size!==e.media.length||new Set(e.sourceNodes.map(n=>n.nodeNumber)).size!==2)errors.push('DUPLICATE_EXECUTION_BINDING');
  for(const n of e.sourceNodes)for(const id of n.blockIds)if(!m.blocks.some(b=>b.id===id))errors.push('NODE_BLOCK_BINDING');
  for(const media of e.media){const b=m.blocks.find(b=>b.id===media.blockId);if(b?.type!=='video'||!m.mediaRefs.some(r=>r.id===b.props.mediaRef&&r.kind==='video'&&r.readiness==='ready'&&r.revision===media.revision))errors.push('MEDIA_BINDING');}
  for(const c of e.cues){
    const source=m.blocks.find(b=>b.id===c.sourceBlockId),target=m.blocks.find(b=>b.id===c.targetBlockId),media=e.media.find(x=>x.blockId===c.sourceBlockId);
    if(source?.type!=='video'||source.stepId!==c.stepId||!media||media.revision!==c.mediaRevision||c.triggerTime>media.durationSeconds)errors.push('CUE_SOURCE_TIME_BINDING');
    if(target?.type!=='multiple_choice'||target.stepId!==c.stepId||target.region!=='interaction.main'||!m.activityRefs.some(a=>a.id===target.props.activityRef&&a.type==='single_choice'))errors.push('CUE_ACTIVITY_BINDING');
    if(!m.runtimeTargets.some(t=>t.blockId===c.sourceBlockId&&t.stepId===c.stepId&&t.partId===null&&t.capabilities.includes('play')))errors.push('CUE_SOURCE_CAPABILITY');
    if(!m.runtimeTargets.some(t=>t.blockId===c.targetBlockId&&t.stepId===c.stepId&&t.partId===null&&t.capabilities.includes('reveal')&&t.verification==='server-attempt'))errors.push('CUE_TARGET_CAPABILITY');
  }
  return errors;
}
