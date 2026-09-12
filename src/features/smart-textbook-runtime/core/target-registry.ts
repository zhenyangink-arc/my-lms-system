import type { RuntimeTargetV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { parseRuntimeTarget } from '../../../lib/smart-textbook-runtime-v1/targets.ts';
import type { StepController } from './step-controller.ts';
import { ttsOwnerSchema,type TtsPlaybackOwner } from './playback.ts';
import {learningToolsSchema,type LearningTools} from './learning-tools.ts';

export type TargetCommand = RuntimeTargetV1['capabilities'][number];
export type TargetHandle = Partial<Record<TargetCommand, (signal: AbortSignal) => void | 'navigated' | Promise<void|'navigated'>>> & { dispose: () => void };
export class RuntimeTargetRegistry {
  private handles = new Map<string,TargetHandle>();
  private preparations=new Map<string,Set<(signal:AbortSignal)=>Promise<void>>>();
  private playbackOwners=new Map<string,{owner:TtsPlaybackOwner;play:(signal:AbortSignal)=>Promise<void>}>();
  private learningOwners=new Map<string,{generation:number;play:(signal:AbortSignal)=>Promise<void>}>();
  private declarations:readonly RuntimeTargetV1[];
  private steps:StepController;
  constructor(declarations: readonly RuntimeTargetV1[], steps: StepController) {
    this.declarations=declarations;this.steps=steps;
    if(new Set(declarations.map(t=>t.id)).size!==declarations.length)throw Error('DUPLICATE_TARGET');
  }
  mount(target: string, handle: TargetHandle) {
    const declaration=this.declarations.find(t=>t.id===target);
    if(!parseRuntimeTarget(target)||!declaration||declaration.stepId!==this.steps.activeStepId||this.handles.has(target))throw Error('TARGET_UNAVAILABLE');
    for(const command of Object.keys(handle))if(command!=='dispose'&&!declaration.capabilities.includes(command as TargetCommand))throw Error('TARGET_CAPABILITY_DENIED');
    this.handles.set(target,handle);
    let disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;if(this.handles.get(target)===handle)this.handles.delete(target);handle.dispose();};
    const unregister=this.steps.onDispose(dispose);
    return ()=>{unregister();dispose();};
  }
  async command(target: string, command: TargetCommand, cancellation?:AbortSignal) {
    cancellation?.throwIfAborted();
    const declaration=this.declarations.find(t=>t.id===target);
    if(!declaration||!parseRuntimeTarget(target)||!declaration.capabilities.includes(command))throw Error('TARGET_CAPABILITY_DENIED');
    if(declaration.stepId!==this.steps.activeStepId)throw Error('TARGET_UNAVAILABLE');
    if(!this.handles.has(target)){
      const lease=this.steps.lease();
      // State owners reveal actual controls. They are not target handles and
      // cannot count as command success until a real handle has mounted.
      const used=new Set();
      for(let depth=0;depth<3&&!this.handles.has(target);depth++){
        const next=[...this.preparations.get(target)??[]].filter(p=>!used.has(p));if(!next.length)break;
        for(const prepare of next){used.add(prepare);await prepare(lease.signal);if(!this.steps.isCurrent(lease))throw Error('STALE_GENERATION');}
      }
    }
    const learning=this.learningOwners.get(target);
    if(command==='play'&&learning){if(!declaration||!this.handles.has(target)||declaration.stepId!==this.steps.activeStepId||learning.generation!==this.steps.generation)throw Error('TARGET_UNAVAILABLE');const lease=this.steps.lease();await learning.play(cancellation?AbortSignal.any([lease.signal,cancellation]):lease.signal);if(!this.steps.isCurrent(lease))throw Error('STALE_GENERATION');return;}
    const playback=this.playbackOwners.get(target);
    if(command==='play'&&playback){
      if(!declaration||!this.handles.has(target)||declaration.stepId!==this.steps.activeStepId||playback.owner.generation!==this.steps.generation)throw Error('TARGET_UNAVAILABLE');
      const lease=this.steps.lease();await playback.play(lease.signal);if(!this.steps.isCurrent(lease))throw Error('STALE_GENERATION');return;
    }
    if(!declaration||!parseRuntimeTarget(target)||!declaration.capabilities.includes(command))throw Error('TARGET_CAPABILITY_DENIED');
    if(declaration.stepId!==this.steps.activeStepId)throw Error('TARGET_UNAVAILABLE');
    const handle=this.handles.get(target),execute=handle?.[command];
    if(!execute)throw Error('TARGET_UNAVAILABLE');
    const lease=this.steps.lease();const result=await execute(lease.signal);
    if(result==='navigated'&&command==='open')return; // The authorized owner deliberately disposed its source Step.
    if(!this.steps.isCurrent(lease))throw Error('STALE_GENERATION');
  }
  has(target:string) { return this.handles.has(target); }
  prepare(target:string,activate:(signal:AbortSignal)=>Promise<void>){
    const t=this.declarations.find(t=>t.id===target);
    if(!t?.capabilities.length||t.stepId!==this.steps.activeStepId)throw Error('TARGET_UNAVAILABLE');
    const owners=this.preparations.get(target)??new Set();owners.add(activate);this.preparations.set(target,owners);
    const remove=()=>{owners.delete(activate);if(!owners.size)this.preparations.delete(target);};
    const off=this.steps.onDispose(remove);return()=>{off();remove();};
  }
  /** Read-only diagnostic identities, never DOM paths or authorization data. */
  mountedTargets() { return [...this.handles.keys()]; }
  /** Read-only command evidence; a DOM anchor and its one playback service are
   * not two competing play owners. Multiple actual play implementations are. */
  commandOwnerCount(target:string,command:TargetCommand) {
    return command==='play' ? Number(this.learningOwners.has(target))+Number(this.playbackOwners.has(target))+Number(!!this.handles.get(target)?.play) : Number(!!this.handles.get(target)?.[command]);
  }
  /** Service-scoped compatibility owner, not a DOM play inference or completion
   * grant. Actual media fetch reauthorizes at the server; TTS is observation only. */
  mountLearningOwner(input:LearningTools,partId:string,play:(signal:AbortSignal)=>Promise<void>){
    const tools=learningToolsSchema.parse(input),owner=tools.playback.find(p=>p.partId===partId),declaration=this.declarations.find(t=>t.id===owner?.target),block=this.steps.manifest.blocks.find(b=>b.id===declaration?.blockId);
    if(!declaration?.capabilities.includes('play'))throw Error('TARGET_CAPABILITY_DENIED');
    if(!owner||!declaration||declaration.partId!==partId||block?.type!=='compat.learning.v1'||block.props.capsuleRef!==tools.capsuleRef||tools.snapshotId!==this.steps.manifest.snapshot.id||declaration.stepId!==this.steps.activeStepId||this.learningOwners.has(owner.target)||this.playbackOwners.has(owner.target))throw Error('LEARNING_OWNER_SCOPE');
    if(owner.kind==='listening'&&!this.steps.manifest.mediaRefs.some(m=>m.id===owner.mediaRef&&m.readiness==='ready'&&m.revision===owner.revision))throw Error('LEARNING_MEDIA_SCOPE');
    const record={generation:this.steps.generation,play};this.learningOwners.set(owner.target,record);
    const remove=()=>{if(this.learningOwners.get(owner.target)===record)this.learningOwners.delete(owner.target);};const off=this.steps.onDispose(remove);return()=>{off();remove();};
  }
  /** Only the mounted compatibility TTS owner uses this service-scoped capability.
   * It cannot authorize evidence: the server grant rechecks every binding on issue/consume. */
  mountTtsOwner(input:TtsPlaybackOwner,play:(signal:AbortSignal)=>Promise<void>){
    const owner=ttsOwnerSchema.parse(input),target=this.declarations.find(t=>t.id===owner.target),parsed=parseRuntimeTarget(owner.target);
    if(!target?.capabilities.includes('play'))throw Error('TARGET_CAPABILITY_DENIED');
    const block=this.steps.manifest.blocks.find(b=>b.id===target?.blockId);
    if(!target||!parsed?.partId||block?.type!=='compat.learning.v1'||target.stepId!==this.steps.activeStepId||owner.generation!==this.steps.generation||owner.snapshotId!==this.steps.manifest.snapshot.id||!this.steps.manifest.teachingRefs.some(t=>t.revision===owner.teachingRevision)||this.playbackOwners.has(owner.target)||this.learningOwners.has(owner.target))throw Error('TTS_OWNER_SCOPE');
    this.playbackOwners.set(owner.target,{owner,play});
    const remove=()=>{if(this.playbackOwners.get(owner.target)?.owner===owner)this.playbackOwners.delete(owner.target);};
    const off=this.steps.onDispose(remove);return()=>{off();remove();};
  }
}

/** React refs are internal. No selector, DOM path, authored CSS, or unbounded animation. */
export function elementTargetHandle(element: HTMLElement, capabilities: readonly TargetCommand[], reveal: () => void = () => {}): TargetHandle {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscribedSignal:AbortSignal|undefined;
  const clear=()=>{clearTimeout(timer);subscribedSignal?.removeEventListener('abort',clear);subscribedSignal=undefined;element.removeAttribute('data-runtime-highlight');};
  const handle:TargetHandle={dispose:clear};
  for(const command of capabilities){
    if(command==='reveal')handle.reveal=()=>{reveal();element.scrollIntoView({block:'nearest',behavior:'instant'});};
    if(command==='focus')handle.focus=()=>{reveal();element.focus({preventScroll:true});};
    if(command==='highlight')handle.highlight=(signal)=>{clear();if(signal.aborted)return;reveal();element.setAttribute('data-runtime-highlight','true');timer=setTimeout(clear,1800);subscribedSignal=signal;signal.addEventListener('abort',clear,{once:true});};
    // play/open require actual media/navigation owners, never inferred from an element.
  }
  return handle;
}
