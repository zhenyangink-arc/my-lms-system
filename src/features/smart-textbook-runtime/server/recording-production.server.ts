import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {withRecordingDomain} from '../../../lib/recording-domain.server';
import {createRecordingGateway,recordingActivityBinding} from '../../../lib/recording-domain-gateway.server';
import {recordingDigest} from '../../../lib/recording-evidence-v2.server';
import type {PrivateBindings} from '../../../lib/smart-textbook-legacy-adapter/capsules.server';
import {recordingScopeSchema,recordingCompletionInput,recordingSlots,restoredRecordingTurn,type RecordingPlan,type RecordingRuntimeServices,type RecordingItem} from '../core/recording';
import {legacyRecordingCoordinates,resolveRecordingSlot} from './recording-binding.server';

/** This context is supplied afresh by a trusted authorized Runtime session
 * reader, NEVER from a browser payload. No production route constructs it yet. */
export type ProductionRecordingAuthority={admin:SupabaseClient;owner:{tenantId:string;studentId:string};sessionId:string;snapshotId:string;sourceRevision:string;versionId:string;
  trackingDisabled:false;plans:RecordingPlan[];bindings:PrivateBindings;domainRevisions:Map<string,string>};
export function productionRecordingServices(authorize:()=>Promise<ProductionRecordingAuthority>,expected:{sessionId:string;snapshotId:string}):RecordingRuntimeServices{
  const authority=async(signal:AbortSignal)=>{signal.throwIfAborted();const a=await authorize();signal.throwIfAborted();if(a.trackingDisabled!==false||a.sessionId!==expected.sessionId||a.snapshotId!==expected.snapshotId)throw Error('RECORDING_RUNTIME_SESSION');return a;};
  async function run<T>(a:ProductionRecordingAuthority,ref:string,fn:(g:ReturnType<typeof createRecordingGateway>)=>Promise<T>){
    const privateRef=a.bindings.activities.find(b=>b.ref===ref&&b.versionId===a.versionId);if(!privateRef)throw Error('RECORDING_ACTIVITY_BINDING');
    return withRecordingDomain(a.admin,a.owner,async request=>{
      // Never enable the gate here or fall through to unsafe v1 Runtime writes.
      if(request.domain!=='v2')throw Error('RECORDING_DOMAIN_NOT_ENABLED');
      const binding=await recordingActivityBinding(a.admin,privateRef.activityId);
      if(binding.versionId!==a.versionId||a.domainRevisions.get(ref)!==binding.sourceRevision)throw Error('RECORDING_SOURCE_CHANGED');
      return fn(createRecordingGateway(a.admin,request,binding,{snapshot:a.snapshotId,sourceRevision:a.sourceRevision,activityRef:ref}));
    });
  }
  const matches=(a:ProductionRecordingAuthority,ref:string,capsule:string)=>{const p=a.plans.filter(p=>p.activityRef===ref&&p.capsuleRef===capsule);if(!p.length)throw Error('RECORDING_ACTIVITY');return p;};
  async function item(a:ProductionRecordingAuthority,g:ReturnType<typeof createRecordingGateway>,plan:RecordingPlan,partId:string,id:string):Promise<RecordingItem>{
    const row=await g.read(id),coords=legacyRecordingCoordinates(a.bindings,plan,partId),m=row.metadata;
    for(const [k,v]of Object.entries(coords))if(String((m as {[key:string]:unknown})[k])!==v)throw Error('RECORDING_TURN_BINDING');
    if(plan.kind==='speaking-introduction'&&('sceneId'in m||'practiceKey'in m))throw Error('RECORDING_KIND');
    if(m.lifecycle==='delete-pending')throw Error('RECORDING_DELETE_PENDING');
    const bound=m.runtimeBinding,kind=plan.kind==='speaking-introduction'?'independent-output':plan.kind==='full-recall'?'full-recall':'roleplay-turn';
    const bindingMatches=recordingDigest(bound??null)===recordingDigest({snapshot:a.snapshotId,sourceRevision:a.sourceRevision,versionId:a.versionId,activityRef:plan.activityRef,recordingKind:kind});
    const consumed=Boolean(row.consumed_at||row.consumed_attempt_number!==null),created=Date.parse(row.created_at),expired=!Number.isFinite(created)||Date.now()-created>86400000||created>Date.now();
    return {id,partId,durationSeconds:'durationSeconds'in m?m.durationSeconds??null:null,mimeType:row.mime_type,state:consumed?'consumed':expired?'expired':'available',reusable:bindingMatches&&!consumed&&!expired};
  }
  return {
    load:async(capsuleRef,signal)=>(await authority(signal)).plans.filter(p=>p.capsuleRef===capsuleRef),
    async restore(capsuleRef,activityRef,signal){const a=await authority(signal),plans=matches(a,activityRef,capsuleRef);return run(a,activityRef,async g=>{
      const recordings:RecordingItem[]=[],created=new Map<string,number>();let completed=false;for(const plan of plans)for(const slot of recordingSlots(plan)){
        const restored=await g.restore(new URLSearchParams(legacyRecordingCoordinates(a.bindings,plan,slot.partId)));if(restored){const r=await item(a,g,plan,slot.partId,restored.evidenceId);recordings.push(r);
          const row=await g.read(r.id);created.set(r.id,Date.parse(row.created_at));
          if(r.state==='consumed'&&plan.kind!=='full-recall'){
            const b=row.metadata.runtimeBinding;
            completed ||= b?.snapshot===a.snapshotId&&b.sourceRevision===a.sourceRevision&&b.versionId===a.versionId&&b.activityRef===activityRef;
          }
        }
      }
      recordings.sort((a,b)=>(created.get(a.id)??0)-(created.get(b.id)??0)||a.id.localeCompare(b.id));
      return {recordings,completion:completed?'already-completed' as const:'none' as const,currentTurnId:restoredRecordingTurn(plans,recordings)};
    });},
    async upload(input,blob,durationSeconds,signal){const a=await authority(signal),scope=recordingScopeSchema.parse(input),{plan,slot}=resolveRecordingSlot(a.plans,scope);
      if(!Number.isFinite(durationSeconds)||durationSeconds<slot.minimumSeconds||durationSeconds>slot.maximumSeconds)throw Error('RECORDING_DURATION');
      return run(a,scope.activityRef,async g=>{const form=new FormData();form.set('recording',blob,'recording');form.set('durationSeconds',String(durationSeconds));for(const [k,v]of Object.entries(legacyRecordingCoordinates(a.bindings,plan,slot.partId)))form.set(k,v);
        signal.throwIfAborted();const result=await g.upload(form);return item(a,g,plan,slot.partId,result.evidenceId);});
    },
    async remove(input,id,signal){const a=await authority(signal),scope=recordingScopeSchema.parse(input),{plan,slot}=resolveRecordingSlot(a.plans,scope);await run(a,scope.activityRef,async g=>{await item(a,g,plan,slot.partId,id);signal.throwIfAborted();await g.remove(id);});},
    async audio(input,id,signal){const a=await authority(signal),scope=recordingScopeSchema.parse(input),{plan,slot}=resolveRecordingSlot(a.plans,scope);return run(a,scope.activityRef,async g=>{await item(a,g,plan,slot.partId,id);return (await g.playback(id,new Request('https://runtime.internal/recording',{signal}))).blob();});},
    async complete(input,signal){const a=await authority(signal),r=recordingCompletionInput.parse(input),plan=matches(a,r.activityRef,r.capsuleRef).find(p=>p.kind===r.kind);if(!plan)throw Error('RECORDING_KIND');
      return run(a,r.activityRef,async g=>{
        let result:unknown;
        if(r.kind==='speaking-introduction'&&plan.kind==='speaking-introduction'){
          const row=await item(a,g,plan,plan.slot.partId,r.recordingId);if(!row.reusable)throw Error('RECORDING_NOT_REUSABLE');
          if(new Set(r.criteriaIds).size!==r.criteriaIds.length||r.criteriaIds.some(id=>!plan.criteria.some(c=>c.id===id)))throw Error('RECORDING_CRITERIA');
          const capsule=a.bindings.capsules.find(c=>c.id===r.capsuleRef),activity=capsule?.kind==='learning'?capsule.activities.find(x=>x.activityId===r.activityRef):null;if(activity?.activityKey!=='speaking-introduction')throw Error('RECORDING_ACTIVITY');
          result=await g.speak({recorded:true,recordingEvidenceId:r.recordingId,durationSeconds:row.durationSeconds,turns:0,criteria:r.criteriaIds.map(()=>true)},{answerKey:{kind:'open'},publicConfig:activity.settings},true);
        }else if(r.kind==='dialogue-roleplay'&&plan.kind==='dialogue-roleplay'){
          const scene=plan.scenes.find(s=>s.id===r.sceneId);if(!scene)throw Error('RECORDING_SCENE');const coords=legacyRecordingCoordinates(a.bindings,plan,scene.turns[0].partId);
          if(!('sceneId'in coords)||typeof coords.sceneId!=='string')throw Error('RECORDING_SCENE');result=await g.roleplay(coords.sceneId,r.side);
        }else throw Error('RECORDING_KIND');
        if(!result||typeof result!=='object')throw Error('RECORDING_RESULT');
        if(!('attempt_number'in result)||typeof result.attempt_number!=='number'||result.attempt_number<1)throw Error('RECORDING_RESULT');
        return {status:'already_completed'in result&&result.already_completed===true?'already-completed':'completed',formalCompletion:true,progressDelta:null,score:null,correct:null};
      });
    },
  };
}
