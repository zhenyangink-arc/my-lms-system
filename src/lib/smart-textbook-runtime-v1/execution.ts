import { z } from 'zod';
import { nativeExecutionV2Schema, timelineCueSchema } from './execution-v2.ts';
export { timelineCueSchema } from './execution-v2.ts';
import { stableIdPattern } from './targets.ts';
import type { LessonManifestV1 } from './contracts.ts';
const id=z.string().regex(stableIdPattern), hash=z.string().regex(/^[a-f0-9]{64}$/);
export const nativeExecutionSchema=z.strictObject({
  contract:z.literal('native-execution/1'),targetAlias:id,lessonBinding:hash,scriptVersionBinding:hash,scriptVersion:z.literal(1),
  sourceNodes:z.array(z.strictObject({nodeNumber:z.union([z.literal(5),z.literal(7)]),binding:hash,rowHash:hash,blockIds:z.array(id).min(1)})).length(2),
  media:z.array(z.strictObject({blockId:id,revision:id,durationSeconds:z.number().finite().positive()})).length(1),
  cues:z.array(timelineCueSchema).min(1),initialLayout:z.literal('split'),
});
export type TimelineCue= z.infer<typeof timelineCueSchema>;
export const anyNativeExecutionSchema=z.discriminatedUnion('contract',[nativeExecutionSchema,nativeExecutionV2Schema]);
export type NativeExecution= z.infer<typeof anyNativeExecutionSchema>;
export function validateNativeExecution(m:LessonManifestV1):string[]{
  const e=m.execution;if(!e)return [];
  if(e.contract==='native-execution/2')return validateNativeVideoExecution(m);
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

function validateNativeVideoExecution(m:LessonManifestV1):string[]{
 const e=m.execution;
 if(!e||e.contract!=='native-execution/2')return ['NATIVE_EXECUTION_VERSION'];
 const errors:string[]=[];
 if(!nativeExecutionV2Schema.safeParse(e).success)return ['NATIVE_EXECUTION_SHAPE'];
 const step=m.steps[0],video=m.blocks.find(b=>b.type==='video'),choice=m.blocks.find(b=>b.type==='multiple_choice');
 const cue=e.cues[0],media=e.media[0],node=e.sourceNodes[0];
 if(m.steps.length!==1||m.blocks.length!==2||!step||!video||!choice)return ['NATIVE_VIDEO_CARDINALITY'];
 if(m.compatibility.profile!=='native'||m.compatibility.adapterRevision!==null||m.teachingRefs.length)errors.push('NATIVE_EXECUTION_ONLY');
 if(e.targetAlias!==`native-video-${m.chapter.id}`||video.id!==`video-${step.id}`||choice.id!==`choice-${choice.props.activityRef}`||video.stepId!==step.id||choice.stepId!==step.id||video.region!=='teaching'||choice.region!=='interaction.main'||video.props.mediaRef!==video.id)errors.push('NODE_BLOCK_BINDING');
 if(node.blockIds[0]!==video.id||node.blockIds[1]!==choice.id)errors.push('NODE_BLOCK_COVERAGE');
 if(m.mediaRefs.length!==1||media.blockId!==video.id||!m.mediaRefs.some(r=>r.id===video.props.mediaRef&&r.kind==='video'&&r.readiness==='ready'&&r.revision===media.revision))errors.push('MEDIA_BINDING');
 if(cue.stepId!==step.id||cue.sourceBlockId!==video.id||cue.targetBlockId!==choice.id||cue.mediaRevision!==media.revision||cue.triggerTime>=media.durationSeconds)errors.push('CUE_SOURCE_TIME_BINDING');
 if(m.activityRefs.length!==1||!m.activityRefs.some(a=>a.id===choice.props.activityRef&&a.activityId===a.id&&a.type==='single_choice')||choice.completion.kind!=='server')errors.push('CUE_ACTIVITY_BINDING');
 if(!['block.video','block.multiple_choice','timeline.cue.v1'].every(c=>m.requiredCapabilities.includes(c)))errors.push('CUE_CAPABILITY_REQUIRED');
 if(!m.runtimeTargets.some(t=>t.blockId===video.id&&t.stepId===step.id&&t.partId===null&&t.capabilities.includes('play')&&t.capabilities.includes('focus')))errors.push('CUE_SOURCE_CAPABILITY');
 if(!m.runtimeTargets.some(t=>t.blockId===choice.id&&t.stepId===step.id&&t.partId===null&&t.capabilities.includes('reveal')&&t.capabilities.includes('focus')&&t.acceptedEvents.includes('response-submitted')&&t.verification==='server-attempt'))errors.push('CUE_TARGET_CAPABILITY');
 return errors;
}
