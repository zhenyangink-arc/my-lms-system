import { z } from 'zod';
const id=z.string().min(1).max(240);
export const recordingScopeSchema=z.strictObject({capsuleRef:id,activityRef:id,target:id});
export type RecordingScope=z.infer<typeof recordingScopeSchema>;
const choice=z.strictObject({id,text:z.string()});
const base={capsuleRef:id,activityRef:id,stepId:id,blockId:id,title:z.string(),instruction:z.string()};
const slot=z.strictObject({partId:id,target:id,minimumSeconds:z.number().positive(),maximumSeconds:z.number().positive()});
export const recordingPlanSchema=z.discriminatedUnion('kind',[
  z.strictObject({...base,kind:z.literal('speaking-introduction'),slot,criteria:z.array(choice),requiredCriteria:z.number().int().positive(),minimumOutlineItems:z.number().int().positive(),outline:z.array(z.strictObject({id,label:z.string(),choices:z.array(choice)}))}),
  z.strictObject({...base,kind:z.literal('dialogue-roleplay'),scenes:z.array(z.strictObject({id,title:z.string(),context:z.string(),turns:z.array(z.strictObject({...slot.shape,text:z.string(),translation:z.string(),speaker:z.string(),side:z.enum(['left','right'])}))}))}),
  z.strictObject({...base,kind:z.literal('full-recall'),tracks:z.array(z.strictObject({...slot.shape,title:z.string()}))}),
]);
export type RecordingPlan=z.infer<typeof recordingPlanSchema>;
export type RecordingSlot=z.infer<typeof slot>;
export const recordingItemSchema=z.strictObject({id,partId:id,durationSeconds:z.number().positive().nullable(),mimeType:z.enum(['audio/webm','audio/ogg','audio/mp4','audio/mpeg']),state:z.enum(['available','consumed','expired']),reusable:z.boolean()}).refine(r=>r.state==='available'||!r.reusable,'Consumed/expired recording is not reusable');
export type RecordingItem=z.infer<typeof recordingItemSchema>;
export const recordingRestoreSchema=z.strictObject({recordings:z.array(recordingItemSchema),completion:z.enum(['none','preview-accepted','already-completed']),currentTurnId:id.nullable()}).refine(s=>new Set(s.recordings.map(r=>r.partId)).size===s.recordings.length&&new Set(s.recordings.map(r=>r.id)).size===s.recordings.length,'Duplicate recording identity');
export type RecordingRestoreState=z.infer<typeof recordingRestoreSchema>;
export const recordingCompletionSchema=z.strictObject({status:z.enum(['preview-accepted','completed','already-completed']),formalCompletion:z.boolean(),progressDelta:z.null(),score:z.null(),correct:z.null()}).refine(r=>r.status!=='preview-accepted'||!r.formalCompletion,'Preview is not formal completion');
export type RecordingCompletion=z.infer<typeof recordingCompletionSchema>;
export const recordingCompletionInput=z.discriminatedUnion('kind',[
  z.strictObject({kind:z.literal('speaking-introduction'),capsuleRef:id,activityRef:id,recordingId:id,criteriaIds:z.array(id).max(20)}),
  z.strictObject({kind:z.literal('dialogue-roleplay'),capsuleRef:id,activityRef:id,sceneId:id,side:z.enum(['left','right'])}),
]);
export type RecordingCompletionInput=z.infer<typeof recordingCompletionInput>;
/** Same browser port for isolated preview and the (unmounted) domain adapter. */
export interface RecordingRuntimeServices {
  load(capsuleRef:string,signal:AbortSignal):Promise<RecordingPlan[]>;
  restore(capsuleRef:string,activityRef:string,signal:AbortSignal):Promise<RecordingRestoreState>;
  upload(scope:RecordingScope,blob:Blob,durationSeconds:number,signal:AbortSignal):Promise<RecordingItem>;
  remove(scope:RecordingScope,recordingId:string,signal:AbortSignal):Promise<void>;
  audio(scope:RecordingScope,recordingId:string,signal:AbortSignal):Promise<Blob>;
  complete(input:RecordingCompletionInput,signal:AbortSignal):Promise<RecordingCompletion>;
}
export function recordingSlots(plan:RecordingPlan):RecordingSlot[]{return plan.kind==='speaking-introduction'?[plan.slot]:plan.kind==='full-recall'?plan.tracks:plan.scenes.flatMap(s=>s.turns);}
/** Restores the scene/side from the latest scoped persisted recording; positional
 * coordinates never cross the service boundary. Items arrive oldest → newest. */
export function restoredRecordingTurn(plans:RecordingPlan[],items:RecordingItem[]):string|null{
  const role=plans.find(p=>p.kind==='dialogue-roleplay');
  if(role?.kind==='dialogue-roleplay'){
    const last=[...items].reverse().find(r=>role.scenes.some(s=>s.turns.some(t=>t.partId===r.partId)));
    const scene=role.scenes.find(s=>s.turns.some(t=>t.partId===last?.partId))??role.scenes[0];
    const side=scene.turns.find(t=>t.partId===last?.partId)?.side??'left',required=scene.turns.filter(t=>t.side===side);
    return (required.find(t=>!items.some(r=>r.partId===t.partId))??required[required.length-1])?.partId??null;
  }
  return plans.flatMap(recordingSlots).find(s=>!items.some(r=>r.partId===s.partId))?.partId??null;
}
export function acceptRecordingRestore(plan:RecordingPlan,input:unknown){
  const result=recordingRestoreSchema.parse(input),slots=recordingSlots(plan);
  if(new Set(result.recordings.map(r=>r.partId)).size!==result.recordings.length||result.recordings.some(r=>!slots.some(s=>s.partId===r.partId)||(r.state!=='available'&&r.reusable)))throw Error('RECORDING_RESTORE_SCOPE');
  if(result.currentTurnId&&!slots.some(s=>s.partId===result.currentTurnId))throw Error('RECORDING_TURN_SCOPE');
  return result;
}
