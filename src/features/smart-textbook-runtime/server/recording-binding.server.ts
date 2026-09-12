import 'server-only';
import {capsuleSchema,type PrivateBindings} from '../../../lib/smart-textbook-legacy-adapter/capsules.server';
import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts';
import {recordingPlanSchema,recordingSlots,type RecordingPlan,type RecordingScope} from '../core/recording';

/** Private old coordinates are resolved from the frozen ledger, never client indices. */
export function recordingPlans(manifest:LessonManifestV1,bindings:PrivateBindings,ref:string,locale:'zh-CN'|'ko-KR'):RecordingPlan[]{
  const c=capsuleSchema.parse(bindings.capsules.find(c=>c.id===ref));if(c.kind!=='learning')throw Error('RECORDING_CAPSULE');
  const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===ref);if(!block||block.type!=='compat.learning.v1')throw Error('RECORDING_BLOCK');
  const frozen=(owner:string,path:string)=>{const row=bindings.identities.find(i=>i.owner===owner&&i.legacyPath===path);if(!row)throw Error('RECORDING_FROZEN_ID');return row.partId;};
  const target=(partId:string)=>{const t=manifest.runtimeTargets.find(t=>t.blockId===block.id&&t.partId===partId);if(!t)throw Error('RECORDING_TARGET');return {partId,target:t.id,minimumSeconds:1,maximumSeconds:300};};
  const result:RecordingPlan[]=[];
  for(const a of c.activities){
    if(!['speaking-introduction','dialogue-roleplay'].includes(a.activityKey))continue;
    const ar=manifest.activityRefs.find(r=>r.id===a.activityId);if(!ar||!block.props.activityRefs.includes(ar.id))throw Error('RECORDING_ACTIVITY');
    const base={capsuleRef:ref,activityRef:ar.id,stepId:c.stepId,blockId:block.id,title:ar.publicPresentation.prompt[locale],instruction:ar.publicPresentation.instruction?.[locale]??''};
    if(a.activityKey==='speaking-introduction'){
      // Existing speakingFrame section is the recording owner; no Manifest mutation.
      const section=c.sections.find(s=>s.slot==='speakingFrame');if(!section)throw Error('RECORDING_SECTION');
      result.push(recordingPlanSchema.parse({...base,kind:a.activityKey,slot:{...target(section.partId),minimumSeconds:a.settings.minimumSeconds,maximumSeconds:a.settings.maximumSeconds},requiredCriteria:a.settings.requiredCriteria,minimumOutlineItems:a.settings.minimumOutlineItems,
        criteria:a.settings.criteria.map((text,i)=>({id:frozen(a.activityId,`public_config.criteria[${i}]`),text})),
        outline:a.settings.outlineItems.map((o,i)=>({id:frozen(a.activityId,`public_config.outlineItems[${i}]`),label:o.label[locale],choices:o.choices.map((text,j)=>({id:frozen(a.activityId,`public_config.outlineItems[${i}].choices[${j}]`),text}))}))}));
      const repeat=c.sections.find(s=>s.slot==='repeatTracks');if(repeat?.slot==='repeatTracks')result.push(recordingPlanSchema.parse({...base,kind:'full-recall',title:'完整复现录音',tracks:repeat.body.map((t,i)=>({...target(frozen(c.nodeId,`content.repeatTracks[${i}]`)),title:t.title[locale]}))}));
    }else if(a.activityKey==='dialogue-roleplay'){
      const section=c.sections.find(s=>s.slot==='dialogueScenes');if(section?.slot!=='dialogueScenes')throw Error('RECORDING_SCENES');
      result.push(recordingPlanSchema.parse({...base,kind:a.activityKey,scenes:section.body.map((scene,i)=>({id:frozen(c.nodeId,`content.dialogueScenes[${i}]`),title:scene.title[locale],context:scene.context[locale],turns:scene.lines.map((line,j)=>({...target(frozen(c.nodeId,`content.dialogueScenes[${i}].lines[${j}]`)),text:line.ko,translation:line.zh,speaker:line.speaker,side:j%2===0?'left':'right'}))}))}));
    }
  }return result;
}
export function resolveRecordingSlot(plans:RecordingPlan[],scope:RecordingScope){
  const matches=plans.filter(p=>p.capsuleRef===scope.capsuleRef&&p.activityRef===scope.activityRef).flatMap(plan=>recordingSlots(plan).filter(s=>s.target===scope.target).map(slot=>({plan,slot})));
  if(matches.length!==1)throw Error('RECORDING_SCOPE');return matches[0];
}
export function legacyRecordingCoordinates(bindings:PrivateBindings,plan:RecordingPlan,partId:string):{[key:string]:string}{
  const c=bindings.capsules.find(c=>c.id===plan.capsuleRef);if(!c||c.kind!=='learning')throw Error('RECORDING_CAPSULE');
  const row=bindings.identities.find(i=>i.owner===c.nodeId&&i.partId===partId);
  if(plan.kind==='speaking-introduction'){if(plan.slot.partId!==partId)throw Error('RECORDING_PART');return {};}
  if(plan.kind==='full-recall'){
    const match=row?.legacyPath.match(/^content\.repeatTracks\[(\d+)\]$/);if(!match)throw Error('RECORDING_TRACK');
    return {practiceKey:'full-recall',trackIndex:String(Number(match[1])),segmentIndex:'0'};
  }
  const match=row?.legacyPath.match(/^content\.dialogueScenes\[(\d+)\]\.lines\[(\d+)\]$/),section=c.sections.find(s=>s.slot==='dialogueScenes');
  if(!match||section?.slot!=='dialogueScenes')throw Error('RECORDING_TURN');
  const scene=section.body[Number(match[1])],turn=Number(match[2]);if(!scene?.lines[turn])throw Error('RECORDING_TURN');
  return {sceneId:scene.id,roleSide:turn%2===0?'left':'right',turnIndex:String(turn)};
}
