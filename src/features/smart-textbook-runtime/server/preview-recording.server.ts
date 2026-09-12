import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { gradeSmartTextbookActivity } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission';
import { recordingCompletionInput,recordingScopeSchema,restoredRecordingTurn,type RecordingRuntimeServices,type RecordingPlan,type RecordingItem,type RecordingCompletion } from '../core/recording';
import { resolveRecordingSlot } from './recording-binding.server';

type Authority={ownerId:string;sessionId:string;snapshotId:string;revision:string;expiresAt:number;plans:RecordingPlan[]};
type Entry={scope:string;expiresAt:number;blob:Blob;item:RecordingItem;target:string;activityRef:string;capsuleRef:string};
const mime=z.enum(['audio/webm','audio/ogg','audio/mp4','audio/mpeg']);
/** Ephemeral audit memory, NOT durable evidence. No database/storage client accepted.
 * Fixed TTL, bounded bytes + entry count, sweep even without incoming requests. */
export function createPreviewRecordingStore(now=()=>Date.now(),limits={fileBytes:10*1024*1024,totalBytes:64*1024*1024,sessionBytes:20*1024*1024,entries:256}){
  const rows=new Map<string,Entry>(),completions=new Map<string,{expiresAt:number;ids:string[]}>();
  const sweep=()=>{for(const [id,r]of rows)if(r.expiresAt<=now())rows.delete(id);for(const [id,r]of completions)if(r.expiresAt<=now()||r.ids.some(id=>!rows.has(id)))completions.delete(id);};
  const timer=setInterval(sweep,30_000);timer.unref();
  const key=(a:Authority)=>JSON.stringify([a.ownerId,a.sessionId,a.snapshotId,a.revision]);
  const accepted=(duplicate=false):RecordingCompletion=>({status:duplicate?'already-completed':'preview-accepted',formalCompletion:false,progressDelta:null,score:null,correct:null});
  function services(authorize:()=>Promise<Authority>):RecordingRuntimeServices{
    const context=async(signal:AbortSignal)=>{signal.throwIfAborted();const a=await authorize();signal.throwIfAborted();sweep();if(!a.ownerId||!a.sessionId||a.expiresAt<=now())throw Error('RECORDING_SESSION_EXPIRED');return a;};
    const entry=(a:Authority,id:string)=>{const r=rows.get(id);if(!r||r.scope!==key(a))throw Error('RECORDING_NOT_FOUND');return r;};
    return {
      async load(capsuleRef,signal){const a=await context(signal);return a.plans.filter(p=>p.capsuleRef===capsuleRef);},
      async restore(capsuleRef,activityRef,signal){const a=await context(signal),plans=a.plans.filter(p=>p.capsuleRef===capsuleRef&&p.activityRef===activityRef);if(!plans.length)throw Error('RECORDING_ACTIVITY');
        const recordings=[...rows.values()].filter(r=>r.scope===key(a)&&r.activityRef===activityRef&&r.capsuleRef===capsuleRef).map(r=>({...r.item}));
        const completed=[...completions.keys()].some(k=>k.startsWith(JSON.stringify([key(a),activityRef])+':'));
        return {recordings,completion:completed?'preview-accepted':'none',currentTurnId:restoredRecordingTurn(plans,recordings)};},
      async upload(input,blob,durationSeconds,signal){const a=await context(signal),scope=recordingScopeSchema.parse(input),{slot}=resolveRecordingSlot(a.plans,scope);
        const type=mime.parse(blob.type.split(';',1)[0]);
        if(blob.size<2048||blob.size>limits.fileBytes)throw Error('RECORDING_SIZE');
        if(!Number.isFinite(durationSeconds)||durationSeconds<slot.minimumSeconds||durationSeconds>slot.maximumSeconds)throw Error('RECORDING_DURATION');
        // No await between quota check and commit. A single-process store is explicit.
        let total=0,owned=0;for(const r of rows.values()){total+=r.blob.size;if(r.scope===key(a))owned+=r.blob.size;}
        if(rows.size>=limits.entries||total+blob.size>limits.totalBytes||owned+blob.size>limits.sessionBytes)throw Error('RECORDING_CAPACITY');
        signal.throwIfAborted();const id=`preview-recording:${randomUUID()}`;
        const item:RecordingItem={id,partId:slot.partId,durationSeconds,mimeType:type,state:'available',reusable:true};
        for(const [old,r]of rows)if(r.scope===key(a)&&r.activityRef===scope.activityRef&&r.target===scope.target)rows.delete(old);
        rows.set(id,{scope:key(a),expiresAt:Math.min(a.expiresAt,now()+30*60*1000),blob,item,target:scope.target,activityRef:scope.activityRef,capsuleRef:scope.capsuleRef});sweep();return {...item};},
      async remove(input,id,signal){const a=await context(signal),scope=recordingScopeSchema.parse(input);resolveRecordingSlot(a.plans,scope);const r=entry(a,id);
        if(r.target!==scope.target||r.activityRef!==scope.activityRef||r.capsuleRef!==scope.capsuleRef)throw Error('RECORDING_SCOPE');rows.delete(id);sweep();},
      async audio(input,id,signal){const a=await context(signal),scope=recordingScopeSchema.parse(input);resolveRecordingSlot(a.plans,scope);const r=entry(a,id);
        if(r.target!==scope.target||r.activityRef!==scope.activityRef||r.capsuleRef!==scope.capsuleRef)throw Error('RECORDING_SCOPE');return r.blob;},
      async complete(input,signal){const a=await context(signal),request=recordingCompletionInput.parse(input),plan=a.plans.find(p=>p.kind===request.kind&&p.capsuleRef===request.capsuleRef&&p.activityRef===request.activityRef);if(!plan)throw Error('RECORDING_ACTIVITY');
        let ids:string[],completionKey:string;
        if(request.kind==='speaking-introduction'&&plan.kind==='speaking-introduction'){
          const r=entry(a,request.recordingId);if(r.target!==plan.slot.target||r.activityRef!==plan.activityRef||!r.item.reusable)throw Error('RECORDING_SCOPE');
          if(new Set(request.criteriaIds).size!==request.criteriaIds.length||request.criteriaIds.some(id=>!plan.criteria.some(c=>c.id===id)))throw Error('RECORDING_CRITERIA');
          // Reuse original grader, no new correctness or pronunciation score.
          const result=gradeSmartTextbookActivity({kind:'open'},{recorded:true,durationSeconds:r.item.durationSeconds,turns:0,criteria:request.criteriaIds.map(()=>true)},'speaking',{enforceCompletionRequirements:true,minimumSeconds:plan.slot.minimumSeconds,maximumSeconds:plan.slot.maximumSeconds,minimumTurns:0,requiredCriteria:plan.requiredCriteria});
          if(!result.ok||!result.meetsCompletionRequirements)throw Error('RECORDING_REQUIREMENTS');
          ids=[r.item.id];completionKey='speaking';
        }else if(request.kind==='dialogue-roleplay'&&plan.kind==='dialogue-roleplay'){
          const scene=plan.scenes.find(s=>s.id===request.sceneId);if(!scene)throw Error('RECORDING_SCENE');
          ids=scene.turns.filter(t=>t.side===request.side).map(turn=>{const r=[...rows.values()].find(r=>r.scope===key(a)&&r.activityRef===plan.activityRef&&r.target===turn.target&&r.item.reusable);if(!r)throw Error('RECORDING_TURN_REQUIRED');return r.item.id;});
          if(!ids.length)throw Error('RECORDING_TURN_REQUIRED');completionKey=`${scene.id}:${request.side}`;
        }else throw Error('RECORDING_KIND');
        const k=JSON.stringify([key(a),plan.activityRef])+':'+completionKey,duplicate=completions.has(k);
        if(completions.size>=limits.entries&&!duplicate)throw Error('RECORDING_CAPACITY');
        completions.set(k,{expiresAt:a.expiresAt,ids});return accepted(duplicate);
      },
    };
  }
  return {services,sweep,dispose:()=>{clearInterval(timer);rows.clear();completions.clear();}};
}
