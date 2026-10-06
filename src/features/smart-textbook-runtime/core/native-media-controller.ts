import { acceptNativeMediaRead, freezeNativePublishedCueBindings, type NativePublishedCueBinding, type NativePublishedExecutionServices, type NativeMediaReadEnvelope, type NativeSessionCompletionReceipt } from './native-published-media-contracts.ts';
import type { LessonManifestV1, RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TimelineCue } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import { validateNativeExecution } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import { acceptCompletion, completionSequence, executionBinding, restoreSchema, sameBinding, type ActivityCompletionReceipt, type AnyNativeExecutionServices, type CompletionRequest, type LegacyNativeExecutionServices, type PublishedCompletionReceipt } from './execution-contracts.ts';
import { acceptPublishedMediaRead, freezePublishedCueBindings, type PublishedCueBinding, type PublishedMediaReadEnvelope, type PublishedNativeExecutionServices, type PublishedReadRequest } from './published-media-contracts.ts';
import { activityResultSchema, type ActivityResult } from './services.ts';
import type { StepController } from './step-controller.ts';
export type MediaPhase='READY'|'PLAYING'|'CUE_PENDING'|'AWAITING_ACTIVITY'|'CHECKING_COMPLETION'|'RESUME_READY'|'ERROR';
export type MediaEvent='MEDIA_ENDED'|'USER_PAUSED'|'USER_SEEKED'|'AUTOPLAY_BLOCKED'|'MEDIA_ERROR'|'PLAYING'|null;
export type MediaElementPort={play():Promise<void>;pause():void;currentTime:number;duration:number;paused:boolean};
export type NativeMediaState={phase:MediaPhase;event:MediaEvent;layout:'split'|'learning';activeCueId:string|null;visibleActivity:string|null;completedCueIds:readonly string[];position:number;restored:boolean;userPaused:boolean;unknown:boolean;evidence:ActivityCompletionReceipt['evidence']|null;publishedReceipt:PublishedCompletionReceipt|null;nativeReceipt:NativeSessionCompletionReceipt|null};
type PublishedCall={cue:TimelineCue;request:CompletionRequest;attachment:number;signal:AbortSignal};
type PublishedReadCall=PublishedCall&{read:PublishedReadRequest};
/** Subordinate presentation owner. Never grades, advances a Step, or writes progress.
 * Server ports are injected, and all callbacks are fenced by the existing Step lease. */
export class NativeMediaController{
  readonly lease;readonly cues:readonly TimelineCue[];
  private disposed=false;private media:MediaElementPort|null=null;private attachment=0;private expectedPause=false;private autoResume=false;private previousTime=0;
  private listeners=new Set<()=>void>();private completed=new Set<string>();private requests=new Map<string,CompletionRequest>();private revisions=new Map<string,number>();private restorePromise:Promise<void>|null=null;private playSerial=0;
  private publishedServices:PublishedNativeExecutionServices|NativePublishedExecutionServices|null=null;
  private nativeBindings=new Map<string,NativePublishedCueBinding>();
  private publishedBindings=new Map<string,PublishedCueBinding>();private publishedOptions=new Map<string,readonly string[]>();private publishedMediaBlocks=new Set<string>();
  private publishedReads=new Map<string,PublishedReadCall>();private publishedWrite:PublishedCall|null=null;
  private publishedRestore:{attachment:number;promise:Promise<void>}|null=null;
  private attachmentAbort:AbortController|null=null;private terminalMediaError=false;
  private publishedPlayAttempt:{media:MediaElementPort;attachment:number;serial:number}|null=null;
  private state:NativeMediaState={phase:'READY',event:null,layout:'split',activeCueId:null,visibleActivity:null,completedCueIds:[],position:0,restored:false,userPaused:false,unknown:false,evidence:null,publishedReceipt:null,nativeReceipt:null};
  readonly manifest:LessonManifestV1;readonly context:RuntimeContextV1;readonly steps:StepController;readonly services:AnyNativeExecutionServices;
  constructor(manifest:LessonManifestV1,context:RuntimeContextV1,steps:StepController,services:AnyNativeExecutionServices){
    this.manifest=manifest;this.context=context;this.steps=steps;this.services=services;
    if(!manifest.execution||validateNativeExecution(manifest).length)throw Error('NATIVE_EXECUTION_INVALID');
    this.lease=steps.lease();
    const cues=manifest.execution.cues.filter(c=>c.stepId===this.lease.stepId).sort((a,b)=>a.triggerTime-b.triggerTime||a.sortOrder-b.sortOrder);
    const mode=services.completionMode;
    if(mode!==undefined&&mode!=='legacy'&&mode!=='published/3'&&mode!=='native-published/4')throw Error('COMPLETION_MODE');
    if(mode==='published/3'||mode==='native-published/4'){
      const bindings=mode==='published/3'?freezePublishedCueBindings(manifest,context,cues,services.publishedBindings):freezeNativePublishedCueBindings(manifest,context,cues,services.nativeBindings);
      this.cues=Object.freeze(cues.map(c=>Object.freeze({...c})));
      this.context=Object.freeze({...context});
      this.publishedServices=Object.freeze({...services});
      for(const binding of bindings){
        if('native' in binding)this.nativeBindings.set(binding.execution.cueId,binding);
        else this.publishedBindings.set(binding.execution.cueId,binding);
        const activity=manifest.activityRefs.find(a=>a.id===binding.execution.activityRef)!;
        this.publishedOptions.set(binding.execution.blockId,Object.freeze(activity.publicPresentation.options.map(o=>o.id)));
      }
      for(const media of manifest.execution.media)if(manifest.blocks.some(b=>b.id===media.blockId&&b.stepId===this.lease.stepId))this.publishedMediaBlocks.add(media.blockId);
      this.state=Object.freeze({...this.state,completedCueIds:Object.freeze([])});
    }else this.cues=cues;
    steps.onDispose(()=>this.dispose());
  }
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  snapshot=()=>this.state;
  private failed(){return this.state.phase==='ERROR';}
  private live(){return !this.disposed&&this.steps.isCurrent(this.lease);}
  private update(p:Partial<NativeMediaState>){if(!this.live())return;const next={...this.state,...p};this.state=this.publishedServices?Object.freeze({...next,completedCueIds:Object.freeze([...next.completedCueIds])}):next;this.listeners.forEach(f=>f());}
  private get legacyServices(){return this.services as LegacyNativeExecutionServices;}
  private request(c:TimelineCue):CompletionRequest{return {binding:executionBinding(this.manifest,this.context,c),generation:this.lease.generation,requestId:crypto.randomUUID()};}
  private async bounded<T>(f:()=>Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([f(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('COMPLETION_TIMEOUT')),10000);})]);}finally{clearTimeout(timer);}}
  attach(media:MediaElementPort,blockId:string){
    if(this.publishedServices)return this.attachPublished(media,blockId);
    const block=this.manifest.blocks.find(b=>b.id===blockId);
    if(!this.live()||this.media||block?.type!=='video'||block.stepId!==this.lease.stepId||!this.manifest.execution!.media.some(m=>m.blockId===blockId))throw Error('MEDIA_OWNER_BINDING');
    this.media=media;const token=++this.attachment;this.pauseMedia();
    if(!this.restorePromise)this.restorePromise=this.restore();
    return()=>{if(token===this.attachment){this.pauseMedia();this.media=null;this.attachment++;this.playSerial++;}};
  }
  private pauseMedia(){if(this.media&&!this.media.paused){this.expectedPause=true;this.media.pause();}}
  restore(){return this.publishedServices?this.restorePublished():this.restoreLegacy();}
  private async restoreLegacy(){
    try{
      for(const cue of this.cues){const request=this.request(cue);const raw=await this.bounded(()=>this.legacyServices.restore(request,this.lease.signal));if(!this.live())return;
        const data=restoreSchema.parse(raw);if(!sameBinding(data.binding,request.binding)||data.requestId!==request.requestId||data.generation!==request.generation)throw Error('RESTORE_BINDING');
        const receipt=acceptCompletion(data.receipt,request);this.revisions.set(cue.id,completionSequence(receipt));
        if(receipt.status==='COMPLETED'){this.completed.add(cue.id);this.update({evidence:receipt.evidence});}
        else if((data.pending||receipt.status==='UNKNOWN')&&!this.state.activeCueId){this.requests.set(cue.id,request);this.update({phase:'AWAITING_ACTIVITY',layout:'learning',activeCueId:cue.id,visibleActivity:cue.targetBlockId,unknown:receipt.status==='UNKNOWN',evidence:receipt.evidence});}
      }
      this.update({restored:true,completedCueIds:[...this.completed],phase:this.state.activeCueId?'AWAITING_ACTIVITY':this.completed.size?'RESUME_READY':'READY'});
    }catch{if(this.live()){this.pauseMedia();this.update({phase:'ERROR',restored:false});}}
  }
  async play(){
    if(this.publishedServices){await this.playPublished();return;}
    if(!this.live()||!this.media||!this.state.restored||this.failed()||this.state.activeCueId)return;
    this.update({userPaused:false,event:null});this.autoResume=true;await this.playMedia();
  }
  private async playMedia(){
    if(this.publishedServices){await this.playPublishedMedia();return;}
    if(!this.live()||!this.media||this.state.activeCueId||this.failed())return;
    const media=this.media,token=this.attachment,serial=++this.playSerial;
    try{await media.play();if(this.live()&&token===this.attachment&&serial===this.playSerial&&!this.state.activeCueId&&!this.state.userPaused)this.update({phase:'PLAYING',event:'PLAYING'});}
    catch{if(this.live()&&token===this.attachment&&serial===this.playSerial&&!this.state.activeCueId&&!this.failed())this.update({phase:'RESUME_READY',event:'AUTOPLAY_BLOCKED'});}
  }
  userPause(){if(!this.live())return;this.autoResume=false;this.playSerial++;this.pauseMedia();this.update({userPaused:true,event:'USER_PAUSED',phase:this.state.activeCueId?this.state.phase:this.failed()?'ERROR':'RESUME_READY'});}
  pauseEvent(){if(!this.live())return;if(this.expectedPause){this.expectedPause=false;return;}if(this.media&&!this.media.paused)return;this.userPause();}
  playingEvent(){if(this.publishedServices){this.playingPublishedEvent();return;}if(!this.live())return;if(!this.state.restored||this.state.activeCueId||this.failed()||this.state.userPaused){this.pauseMedia();return;}this.update({phase:'PLAYING',event:'PLAYING'});}
  metadata(duration:number){if(!this.live())return;if(!Number.isFinite(duration)||duration<=0||this.cues.some(c=>c.triggerTime>duration))this.mediaError();}
  seek(time:number){if(!this.live()||!this.media||!Number.isFinite(time)||time<0||time>this.media.duration)return;this.media.currentTime=time;this.observe(time,true);}
  observe(time:number,seeking=false){
    if(this.publishedServices){this.observePublished(time,seeking);return;}
    if(!this.live()||!Number.isFinite(time)||time<0)return;
    const previous=this.previousTime;this.previousTime=time;this.update({position:time,...(seeking?{event:'USER_SEEKED' as const}:{})});
    if(!this.state.restored||this.failed())return;
    if(this.state.activeCueId){this.pauseMedia();return;}
    // Also catch a restored/seeked position already past an unsatisfied mandatory
    // cue. Position is an observation; only server completion permits skipping it.
    const cue=this.cues.find(c=>!this.completed.has(c.id)&&c.triggerTime<=time&&(previous<c.triggerTime||seeking||time>=previous));
    if(cue)void this.trigger(cue);
  }
  private async trigger(cue:TimelineCue){
    if(!this.live()||this.state.activeCueId||this.completed.has(cue.id))return;
    this.autoResume=!!this.media&&!this.media.paused&&!this.state.userPaused;
    const request=this.request(cue);this.requests.set(cue.id,request);
    this.update({phase:'CUE_PENDING',activeCueId:cue.id,visibleActivity:null,unknown:false});this.playSerial++;this.pauseMedia();
    try{const raw=await this.bounded(()=>this.legacyServices.checkpoint(request,this.lease.signal));if(!this.live()||this.failed())return;
      const r=acceptCompletion(raw,request,this.revisions.get(cue.id));this.revisions.set(cue.id,completionSequence(r));
      if(r.status==='COMPLETED'){this.accept(cue,request,r);return;}
      this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,unknown:r.status==='UNKNOWN',evidence:r.evidence});
    }catch{if(this.live()&&!this.failed())this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,unknown:true});}
  }
  async submit(blockId:string,optionId:string):Promise<ActivityResult|null>{
    if(this.publishedServices)return this.submitPublished(blockId,optionId);
    const cue=this.cues.find(c=>c.id===this.state.activeCueId&&c.targetBlockId===blockId);
    if(!this.live()||!cue||this.state.phase!=='AWAITING_ACTIVITY'||this.state.unknown)return null;
    const binding=executionBinding(this.manifest,this.context,cue),activity=this.manifest.activityRefs.find(a=>a.id===binding.activityRef);
    if(!activity?.publicPresentation.options.some(o=>o.id===optionId))throw Error('OPTION_NOT_BOUND');
    const request=this.request(cue);this.requests.set(cue.id,request);this.update({phase:'CHECKING_COMPLETION'});
    try{const response=await this.bounded(()=>this.legacyServices.submit(request,optionId,this.lease.signal));if(!this.live()||this.failed())return null;
      const r=acceptCompletion(response.receipt,request,this.revisions.get(cue.id)),result=activityResultSchema.parse(response.result);
      // Submission is not completion authority. Even a valid COMPLETED submit
      // receipt must be independently read back before a media intent.
      if(r.status==='UNKNOWN')this.update({unknown:true});
      await this.readback();return r.status==='UNKNOWN'?null:result;
    }catch{if(this.live()&&!this.failed()){this.update({unknown:true});await this.readback();}return null;}
  }
  async readback(){
    if(this.publishedServices){await this.readbackPublished();return;}
    const cue=this.cues.find(c=>c.id===this.state.activeCueId),request=cue&&this.requests.get(cue.id);if(!this.live()||!cue||!request||this.failed())return;
    this.update({phase:'CHECKING_COMPLETION'});
    try{const raw=await this.bounded(()=>this.legacyServices.readback(request,this.lease.signal));if(!this.live()||this.failed())return;this.accept(cue,request,acceptCompletion(raw,request,this.revisions.get(cue.id)));}
    catch{if(this.live()&&!this.failed())this.update({phase:'AWAITING_ACTIVITY',unknown:true});}
  }
  private accept(cue:TimelineCue,request:CompletionRequest,r:ActivityCompletionReceipt){
    if(!this.live()||this.failed()||this.state.activeCueId!==cue.id||this.requests.get(cue.id)?.requestId!==request.requestId||this.completed.has(cue.id))return;
    this.revisions.set(cue.id,completionSequence(r));
    if(r.status!=='COMPLETED'){this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,unknown:r.status==='UNKNOWN',evidence:r.evidence});return;}
    this.completed.add(cue.id);this.update({phase:'RESUME_READY',layout:'split',activeCueId:null,visibleActivity:null,unknown:false,completedCueIds:[...this.completed],evidence:r.evidence});
    // A second crossed mandatory cue wins before any play intent.
    const next=this.cues.find(c=>!this.completed.has(c.id)&&c.triggerTime<=this.state.position);
    if(next){void this.trigger(next);return;}
    if(this.autoResume&&!this.state.userPaused)void this.playMedia();
  }
  private receiptState(receipt:PublishedCompletionReceipt|NativeSessionCompletionReceipt|null){
    return {publishedReceipt:receipt?.contract==='activity-completion/3'?receipt:null,
      nativeReceipt:receipt?.contract==='activity-completion/4'?receipt:null};
  }
  private acceptDurableRead(raw:unknown,call:PublishedReadCall){
    if(this.publishedServices?.completionMode==='native-published/4')
      return acceptNativeMediaRead(raw,call.read,this.nativeBindings.get(call.cue.id)!,this.revisions.get(call.cue.id),Date.now());
    return acceptPublishedMediaRead(raw,call.read,this.publishedBindings.get(call.cue.id)!,this.revisions.get(call.cue.id),Date.now());
  }
  private attachPublished(media:MediaElementPort,blockId:string){
    if(!this.live()||this.media||!this.publishedMediaBlocks.has(blockId))throw Error('MEDIA_OWNER_BINDING');
    this.media=media;const attachment=++this.attachment;
    this.attachmentAbort=new AbortController();this.expectedPause=false;this.autoResume=false;this.playSerial++;
    this.publishedPlayAttempt=null;this.publishedRestore=null;this.requests.clear();this.publishedReads.clear();this.completed.clear();
    this.pauseMedia();
    const position=Number.isFinite(media.currentTime)&&media.currentTime>=0?media.currentTime:0;
    this.previousTime=position;
    this.update({phase:this.terminalMediaError?'ERROR':'READY',event:this.terminalMediaError?'MEDIA_ERROR':null,
      position,restored:false,activeCueId:null,visibleActivity:null,completedCueIds:[],layout:'split',
      unknown:false,userPaused:false,evidence:null,publishedReceipt:null,nativeReceipt:null});
    if(!this.terminalMediaError)void this.restorePublished();
    return()=>{
      if(attachment!==this.attachment||this.media!==media)return;
      this.pauseMedia();this.media=null;this.attachment++;this.playSerial++;this.autoResume=false;
      this.attachmentAbort?.abort();this.attachmentAbort=null;this.expectedPause=false;
      this.publishedPlayAttempt=null;this.publishedRestore=null;this.requests.clear();this.publishedReads.clear();this.completed.clear();
      this.update({phase:this.terminalMediaError?'ERROR':'READY',restored:false,activeCueId:null,
        visibleActivity:null,completedCueIds:[],layout:'split',unknown:false,evidence:null,publishedReceipt:null,nativeReceipt:null});
    };
  }
  private publishedAttachmentCurrent(attachment:number){
    return this.live()&&!!this.media&&attachment===this.attachment&&!this.failed()&&!this.terminalMediaError;
  }
  private publishedCallCurrent(call:PublishedCall,active=true){
    return this.publishedAttachmentCurrent(call.attachment)&&!call.signal.aborted
      &&this.requests.get(call.cue.id)===call.request&&(!active||this.state.activeCueId===call.cue.id);
  }
  private publishedReadCurrent(call:PublishedReadCall,active=true){
    return this.publishedCallCurrent(call,active)&&this.publishedReads.get(call.cue.id)===call;
  }
  private publishedRequest(cue:TimelineCue):CompletionRequest{
    const binding=(this.nativeBindings.get(cue.id)??this.publishedBindings.get(cue.id))!.execution;
    const request=Object.freeze({binding,generation:this.lease.generation,requestId:crypto.randomUUID()});
    this.requests.set(cue.id,request);this.publishedReads.delete(cue.id);return request;
  }
  private publishedReadCall(cue:TimelineCue,request:CompletionRequest,operation:PublishedReadRequest['operation']):PublishedReadCall{
    const read=Object.freeze({...request,readId:crypto.randomUUID(),operation});
    const call={cue,request,read,attachment:this.attachment,signal:this.attachmentAbort!.signal};
    this.publishedReads.set(cue.id,call);return call;
  }
  /** The timer is a scheduling bound; elapsed monotonic time is checked as well
   * so an overdue response cannot win while the event loop delays the timer. */
  private async boundedPublished<T>(dispatch:()=>Promise<T>):Promise<T>{
    const started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const value=await Promise.race([dispatch(),new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>reject(Error('COMPLETION_TIMEOUT')),10_000);
      })]);
      if(performance.now()-started>10_000)throw Error('COMPLETION_TIMEOUT');
      return value;
    }finally{clearTimeout(timer);}
  }
  private restorePublished():Promise<void>{
    if(!this.media||!this.live()||this.terminalMediaError)return Promise.resolve();
    if(this.publishedRestore?.attachment===this.attachment)return this.publishedRestore.promise;
    if(this.state.restored||this.failed())return Promise.resolve();
    const attachment=this.attachment;
    // Install the flight before dispatch, including synchronous port re-entry.
    const promise=Promise.resolve().then(()=>this.runPublishedRestore(attachment));
    this.publishedRestore={attachment,promise};return promise;
  }
  private async runPublishedRestore(attachment:number){
    const results:Array<{call:PublishedReadCall;data:PublishedMediaReadEnvelope|NativeMediaReadEnvelope}>=[];
    try{
      for(const cue of this.cues){
        if(!this.publishedAttachmentCurrent(attachment))return;
        const call=this.publishedReadCall(cue,this.publishedRequest(cue),'restore');
        const raw=await this.boundedPublished(()=>this.publishedServices!.restore(call.read,call.signal));
        if(!this.publishedReadCurrent(call,false))return;
        const data=this.acceptDurableRead(raw,call);
        results.push({call,data});
      }
      if(!this.publishedAttachmentCurrent(attachment)||results.some(r=>!this.publishedReadCurrent(r.call,false)))return;
      // No partial result grants completion or moves the freshness lower bound.
      for(const {call,data} of results){
        this.publishedReads.delete(call.cue.id);
        this.revisions.set(call.cue.id,data.receipt.evidence.attemptSequence);
        if(data.receipt.status==='COMPLETED')this.completed.add(call.cue.id);
      }
      const pending=results.find(r=>r.data.receipt.status==='INCOMPLETE'&&r.data.pending);
      const crossed=this.crossedPublishedCue();
      // A pending hint cannot put a later question ahead of an earlier cue
      // crossed by the actual media position, including a seek during restore.
      const earlierCrossed=pending&&crossed&&this.cues.indexOf(crossed)<this.cues.indexOf(pending.call.cue)?crossed:null;
      const reopened=earlierCrossed?undefined:pending;
      this.update({restored:true,completedCueIds:[...this.completed],activeCueId:reopened?.call.cue.id??null,
        visibleActivity:reopened?.call.cue.targetBlockId??null,layout:reopened?'learning':'split',
        phase:reopened?'AWAITING_ACTIVITY':this.completed.size?'RESUME_READY':'READY',unknown:false,evidence:null,
        ...this.receiptState(reopened?.data.receipt??results.at(-1)?.data.receipt??null)});
      if(earlierCrossed)await this.prioritizePublishedCue();
    }catch{
      if(!this.publishedAttachmentCurrent(attachment))return;
      this.publishedReads.clear();this.pauseMedia();
      this.update({phase:'ERROR',restored:false,unknown:true,evidence:null,publishedReceipt:null,nativeReceipt:null});
    }
  }
  private effectivePublishedPosition(){
    const time=this.media?.currentTime;
    return time!==undefined&&Number.isFinite(time)&&time>=0?time:this.state.position;
  }
  private crossedPublishedCue(){
    const time=this.effectivePublishedPosition();
    return this.cues.find(c=>!this.completed.has(c.id)&&c.triggerTime<=time);
  }
  /** Position/interaction gates share the same synchronous priority rule.
   * Retire a displaced cue's reads/request before listeners can submit it. Its
   * in-flight write remains single flight until that write settles or times out. */
  private prioritizePublishedCue(position=this.effectivePublishedPosition()):Promise<void>|null{
    if(!this.live()||!this.media||!this.state.restored||this.failed())return null;
    const crossed=this.cues.find(c=>!this.completed.has(c.id)&&c.triggerTime<=position);
    const active=this.cues.find(c=>c.id===this.state.activeCueId);
    if(!crossed||(active&&this.cues.indexOf(active)<=this.cues.indexOf(crossed)))return null;
    if(active){
      this.requests.delete(active.id);this.publishedReads.delete(active.id);
      this.update({activeCueId:null,visibleActivity:null,unknown:false,evidence:null,publishedReceipt:null,nativeReceipt:null});
    }
    return this.triggerPublished(crossed);
  }
  private publishedPlayPermitted(){
    return this.live()&&!!this.media&&this.state.restored&&!this.failed()&&!this.terminalMediaError
      &&!this.state.userPaused&&!this.state.activeCueId&&!this.crossedPublishedCue();
  }
  private async playPublished(){
    if(!this.live()||!this.media||!this.state.restored||this.failed())return;
    if(this.state.activeCueId){
      await this.prioritizePublishedCue();
      return;
    }
    this.update({userPaused:false,event:null});this.autoResume=true;await this.playPublishedMedia();
  }
  private async playPublishedMedia(){
    if(!this.live()||!this.media||!this.state.restored||this.failed()||this.terminalMediaError
      ||this.state.userPaused||this.state.activeCueId||!this.autoResume)return;
    const cue=this.crossedPublishedCue();
    if(cue){this.update({position:this.effectivePublishedPosition()});await this.triggerPublished(cue);return;}
    const media=this.media,attachment=this.attachment,serial=++this.playSerial;
    this.publishedPlayAttempt={media,attachment,serial};
    try{
      await media.play();
      if(!this.live()||attachment!==this.attachment||serial!==this.playSerial||media!==this.media){
        this.pauseStalePublishedPlay(media);return;
      }
      if(!this.publishedPlayPermitted()||!this.autoResume){
        this.pauseMedia();
        if(this.state.restored&&!this.failed()&&!this.state.userPaused&&!this.state.activeCueId){
          const crossed=this.crossedPublishedCue();if(crossed)void this.triggerPublished(crossed);
        }
        return;
      }
      this.update({phase:'PLAYING',event:'PLAYING'});
    }catch{
      if(!this.live()||attachment!==this.attachment||serial!==this.playSerial||media!==this.media){
        this.pauseStalePublishedPlay(media);return;
      }
      if(!this.publishedPlayPermitted()||!this.autoResume){this.pauseMedia();return;}
      this.autoResume=false;this.pauseMedia();this.update({phase:'RESUME_READY',event:'AUTOPLAY_BLOCKED'});
    }
  }
  private pauseStalePublishedPlay(media:MediaElementPort){
    const current=this.publishedPlayAttempt;
    const newLegalPlay=media===this.media&&current?.media===media&&current.attachment===this.attachment
      &&current.serial===this.playSerial&&this.autoResume&&this.publishedPlayPermitted();
    if(!newLegalPlay&&!media.paused)media.pause();
  }
  private playingPublishedEvent(){
    if(!this.live())return;
    if(!this.autoResume||!this.publishedPlayPermitted()){
      this.pauseMedia();
      if(this.state.restored&&!this.failed()&&!this.state.userPaused&&!this.state.activeCueId){
        const cue=this.crossedPublishedCue();if(cue)void this.triggerPublished(cue);
      }
      return;
    }
    this.update({phase:'PLAYING',event:'PLAYING'});
  }
  private observePublished(time:number,seeking:boolean){
    if(!this.live()||!Number.isFinite(time)||time<0)return;
    // Reorder before publishing the new position so synchronous interaction
    // callbacks cannot submit an obsolete later pending activity.
    void this.prioritizePublishedCue(time);
    this.previousTime=time;this.update({position:time,...(seeking?{event:'USER_SEEKED' as const}:{})});
    if(!this.state.restored||this.failed())return;
    if(this.state.activeCueId)this.pauseMedia();
  }
  private async triggerPublished(cue:TimelineCue){
    if(!this.live()||!this.media||!this.state.restored||this.failed()||this.state.activeCueId||this.completed.has(cue.id))return;
    this.autoResume=!this.state.userPaused&&(this.autoResume||!this.media.paused);
    const request=this.publishedRequest(cue);
    this.update({phase:'CUE_PENDING',activeCueId:cue.id,visibleActivity:null,unknown:false,evidence:null,publishedReceipt:null,nativeReceipt:null});
    this.playSerial++;this.pauseMedia();await this.readPublished(cue,request,'checkpoint');
  }
  private async submitPublished(blockId:string,optionId:string):Promise<ActivityResult|null>{
    if(!this.live()||!this.media||!this.state.restored||this.failed())return null;
    if(this.prioritizePublishedCue())return null;
    const cue=this.cues.find(c=>c.id===this.state.activeCueId&&c.targetBlockId===blockId);
    if(!cue||this.publishedWrite
      ||this.state.phase!=='AWAITING_ACTIVITY'||this.state.unknown)return null;
    if(!this.publishedOptions.get(blockId)?.includes(optionId))throw Error('OPTION_NOT_BOUND');
    const request=this.publishedRequest(cue);
    const call:PublishedCall={cue,request,attachment:this.attachment,signal:this.attachmentAbort!.signal};
    this.publishedWrite=call;this.update({phase:'CHECKING_COMPLETION'});
    let result:ActivityResult|null=null;
    try{
      const response=await this.boundedPublished(()=>this.publishedServices!.submit(request,optionId,call.signal));
      if(!this.publishedCallCurrent(call))return null;
      result=activityResultSchema.parse(response.result);
    }catch{
      if(!this.publishedCallCurrent(call))return null;
      this.update({unknown:true});
    }finally{
      // Only retire this flight. An old settlement cannot release a newer write.
      if(this.publishedWrite===call)this.publishedWrite=null;
    }
    if(!this.publishedCallCurrent(call))return null;
    // Captured cue/request, never whichever activity happens to be active later.
    await this.readPublished(cue,request,'readback');
    return this.publishedCallCurrent(call,false)?result:null;
  }
  private async readbackPublished(){
    if(!this.live()||!this.media||!this.state.restored||this.failed()||this.publishedWrite)return;
    const cue=this.cues.find(c=>c.id===this.state.activeCueId),request=cue&&this.requests.get(cue.id);
    if(cue&&request)await this.readPublished(cue,request,'readback');
  }
  private async readPublished(cue:TimelineCue,request:CompletionRequest,operation:'checkpoint'|'readback'){
    if(!this.media||!this.live()||!this.state.restored||this.failed()||this.state.activeCueId!==cue.id
      ||this.requests.get(cue.id)!==request)return;
    const call=this.publishedReadCall(cue,request,operation);
    this.update({phase:operation==='checkpoint'?'CUE_PENDING':'CHECKING_COMPLETION'});
    try{
      const raw=await this.boundedPublished(()=>this.publishedServices![operation](call.read,call.signal));
      if(!this.publishedReadCurrent(call))return;
      const data=this.acceptDurableRead(raw,call);
      this.acceptPublished(call,data);
    }catch{
      if(!this.publishedReadCurrent(call))return;
      this.publishedReads.delete(cue.id);
      this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,
        unknown:true,evidence:null,publishedReceipt:null,nativeReceipt:null});
    }
  }
  private acceptPublished(call:PublishedReadCall,data:PublishedMediaReadEnvelope|NativeMediaReadEnvelope){
    if(!this.publishedReadCurrent(call)||this.completed.has(call.cue.id))return;
    const cue=call.cue,receipt=data.receipt;
    this.publishedReads.delete(cue.id);this.revisions.set(cue.id,receipt.evidence.attemptSequence);
    if(receipt.status!=='COMPLETED'){
      this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,
        unknown:false,evidence:null,...this.receiptState(receipt)});return;
    }
    this.completed.add(cue.id);
    this.update({phase:'RESUME_READY',layout:'split',activeCueId:null,visibleActivity:null,unknown:false,
      completedCueIds:[...this.completed],evidence:null,...this.receiptState(receipt)});
    // The original playback intent survives every cue in this crossed chain.
    const next=this.crossedPublishedCue();
    if(next){void this.triggerPublished(next);return;}
    if(this.autoResume&&!this.state.userPaused)void this.playPublishedMedia();
  }
  ended(){if(!this.live()||this.failed())return;if(this.publishedServices)this.autoResume=false;this.observe(this.media?.currentTime??this.state.position);if(!this.state.activeCueId)this.update({phase:'RESUME_READY',event:'MEDIA_ENDED'});}
  mediaError(){if(!this.live())return;this.autoResume=false;this.playSerial++;this.pauseMedia();if(this.publishedServices){this.terminalMediaError=true;this.attachmentAbort?.abort();this.publishedReads.clear();}this.update({phase:'ERROR',event:'MEDIA_ERROR'});}
  dispose(){if(this.disposed)return;this.pauseMedia();this.autoResume=false;this.attachmentAbort?.abort();this.publishedReads.clear();this.disposed=true;this.playSerial++;this.media=null;this.listeners.clear();}
}
