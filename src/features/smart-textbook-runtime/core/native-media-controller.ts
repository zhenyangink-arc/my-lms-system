import type { LessonManifestV1, RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TimelineCue } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import { validateNativeExecution } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import { acceptCompletion, completionSequence, executionBinding, restoreSchema, sameBinding, type ActivityCompletionReceipt, type CompletionRequest, type NativeExecutionServices } from './execution-contracts.ts';
import { activityResultSchema, type ActivityResult } from './services.ts';
import type { StepController } from './step-controller.ts';
export type MediaPhase='READY'|'PLAYING'|'CUE_PENDING'|'AWAITING_ACTIVITY'|'CHECKING_COMPLETION'|'RESUME_READY'|'ERROR';
export type MediaEvent='MEDIA_ENDED'|'USER_PAUSED'|'USER_SEEKED'|'AUTOPLAY_BLOCKED'|'MEDIA_ERROR'|'PLAYING'|null;
export type MediaElementPort={play():Promise<void>;pause():void;currentTime:number;duration:number;paused:boolean};
export type NativeMediaState={phase:MediaPhase;event:MediaEvent;layout:'split'|'learning';activeCueId:string|null;visibleActivity:string|null;completedCueIds:readonly string[];position:number;restored:boolean;userPaused:boolean;unknown:boolean;evidence:ActivityCompletionReceipt['evidence']|null};
/** Subordinate presentation owner. Never grades, advances a Step, or writes progress.
 * Server ports are injected, and all callbacks are fenced by the existing Step lease. */
export class NativeMediaController{
  readonly lease;readonly cues:readonly TimelineCue[];
  private disposed=false;private media:MediaElementPort|null=null;private attachment=0;private expectedPause=false;private autoResume=false;private previousTime=0;
  private listeners=new Set<()=>void>();private completed=new Set<string>();private requests=new Map<string,CompletionRequest>();private revisions=new Map<string,number>();private restorePromise:Promise<void>|null=null;private playSerial=0;
  private state:NativeMediaState={phase:'READY',event:null,layout:'split',activeCueId:null,visibleActivity:null,completedCueIds:[],position:0,restored:false,userPaused:false,unknown:false,evidence:null};
  readonly manifest:LessonManifestV1;readonly context:RuntimeContextV1;readonly steps:StepController;readonly services:NativeExecutionServices;
  constructor(manifest:LessonManifestV1,context:RuntimeContextV1,steps:StepController,services:NativeExecutionServices){
    this.manifest=manifest;this.context=context;this.steps=steps;this.services=services;
    if(!manifest.execution||validateNativeExecution(manifest).length)throw Error('NATIVE_EXECUTION_INVALID');
    this.lease=steps.lease();this.cues=manifest.execution.cues.filter(c=>c.stepId===this.lease.stepId).sort((a,b)=>a.triggerTime-b.triggerTime||a.sortOrder-b.sortOrder);
    steps.onDispose(()=>this.dispose());
  }
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  snapshot=()=>this.state;
  private failed(){return this.state.phase==='ERROR';}
  private live(){return !this.disposed&&this.steps.isCurrent(this.lease);}
  private update(p:Partial<NativeMediaState>){if(!this.live())return;this.state={...this.state,...p};this.listeners.forEach(f=>f());}
  private request(c:TimelineCue):CompletionRequest{return {binding:executionBinding(this.manifest,this.context,c),generation:this.lease.generation,requestId:crypto.randomUUID()};}
  private async bounded<T>(f:()=>Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([f(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('COMPLETION_TIMEOUT')),10000);})]);}finally{clearTimeout(timer);}}
  attach(media:MediaElementPort,blockId:string){
    const block=this.manifest.blocks.find(b=>b.id===blockId);
    if(!this.live()||this.media||block?.type!=='video'||block.stepId!==this.lease.stepId||!this.manifest.execution!.media.some(m=>m.blockId===blockId))throw Error('MEDIA_OWNER_BINDING');
    this.media=media;const token=++this.attachment;this.pauseMedia();
    if(!this.restorePromise)this.restorePromise=this.restore();
    return()=>{if(token===this.attachment){this.pauseMedia();this.media=null;this.attachment++;this.playSerial++;}};
  }
  private pauseMedia(){if(this.media&&!this.media.paused){this.expectedPause=true;this.media.pause();}}
  async restore(){
    try{
      for(const cue of this.cues){const request=this.request(cue);const raw=await this.bounded(()=>this.services.restore(request,this.lease.signal));if(!this.live())return;
        const data=restoreSchema.parse(raw);if(!sameBinding(data.binding,request.binding)||data.requestId!==request.requestId||data.generation!==request.generation)throw Error('RESTORE_BINDING');
        const receipt=acceptCompletion(data.receipt,request);this.revisions.set(cue.id,completionSequence(receipt));
        if(receipt.status==='COMPLETED'){this.completed.add(cue.id);this.update({evidence:receipt.evidence});}
        else if((data.pending||receipt.status==='UNKNOWN')&&!this.state.activeCueId){this.requests.set(cue.id,request);this.update({phase:'AWAITING_ACTIVITY',layout:'learning',activeCueId:cue.id,visibleActivity:cue.targetBlockId,unknown:receipt.status==='UNKNOWN',evidence:receipt.evidence});}
      }
      this.update({restored:true,completedCueIds:[...this.completed],phase:this.state.activeCueId?'AWAITING_ACTIVITY':this.completed.size?'RESUME_READY':'READY'});
    }catch{if(this.live()){this.pauseMedia();this.update({phase:'ERROR',restored:false});}}
  }
  async play(){
    if(!this.live()||!this.media||!this.state.restored||this.failed()||this.state.activeCueId)return;
    this.update({userPaused:false,event:null});this.autoResume=true;await this.playMedia();
  }
  private async playMedia(){
    if(!this.live()||!this.media||this.state.activeCueId||this.failed())return;
    const media=this.media,token=this.attachment,serial=++this.playSerial;
    try{await media.play();if(this.live()&&token===this.attachment&&serial===this.playSerial&&!this.state.activeCueId&&!this.state.userPaused)this.update({phase:'PLAYING',event:'PLAYING'});}
    catch{if(this.live()&&token===this.attachment&&serial===this.playSerial&&!this.state.activeCueId&&!this.failed())this.update({phase:'RESUME_READY',event:'AUTOPLAY_BLOCKED'});}
  }
  userPause(){if(!this.live())return;this.autoResume=false;this.playSerial++;this.pauseMedia();this.update({userPaused:true,event:'USER_PAUSED',phase:this.state.activeCueId?this.state.phase:this.failed()?'ERROR':'RESUME_READY'});}
  pauseEvent(){if(!this.live())return;if(this.expectedPause){this.expectedPause=false;return;}if(this.media&&!this.media.paused)return;this.userPause();}
  playingEvent(){if(!this.live())return;if(!this.state.restored||this.state.activeCueId||this.failed()||this.state.userPaused){this.pauseMedia();return;}this.update({phase:'PLAYING',event:'PLAYING'});}
  metadata(duration:number){if(!this.live())return;if(!Number.isFinite(duration)||duration<=0||this.cues.some(c=>c.triggerTime>duration))this.mediaError();}
  seek(time:number){if(!this.live()||!this.media||!Number.isFinite(time)||time<0||time>this.media.duration)return;this.media.currentTime=time;this.observe(time,true);}
  observe(time:number,seeking=false){
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
    try{const raw=await this.bounded(()=>this.services.checkpoint(request,this.lease.signal));if(!this.live()||this.failed())return;
      const r=acceptCompletion(raw,request,this.revisions.get(cue.id));this.revisions.set(cue.id,completionSequence(r));
      if(r.status==='COMPLETED'){this.accept(cue,request,r);return;}
      this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,unknown:r.status==='UNKNOWN',evidence:r.evidence});
    }catch{if(this.live()&&!this.failed())this.update({phase:'AWAITING_ACTIVITY',layout:'learning',visibleActivity:cue.targetBlockId,unknown:true});}
  }
  async submit(blockId:string,optionId:string):Promise<ActivityResult|null>{
    const cue=this.cues.find(c=>c.id===this.state.activeCueId&&c.targetBlockId===blockId);
    if(!this.live()||!cue||this.state.phase!=='AWAITING_ACTIVITY'||this.state.unknown)return null;
    const binding=executionBinding(this.manifest,this.context,cue),activity=this.manifest.activityRefs.find(a=>a.id===binding.activityRef);
    if(!activity?.publicPresentation.options.some(o=>o.id===optionId))throw Error('OPTION_NOT_BOUND');
    const request=this.request(cue);this.requests.set(cue.id,request);this.update({phase:'CHECKING_COMPLETION'});
    try{const response=await this.bounded(()=>this.services.submit(request,optionId,this.lease.signal));if(!this.live()||this.failed())return null;
      const r=acceptCompletion(response.receipt,request,this.revisions.get(cue.id)),result=activityResultSchema.parse(response.result);
      // Submission is not completion authority. Even a valid COMPLETED submit
      // receipt must be independently read back before a media intent.
      if(r.status==='UNKNOWN')this.update({unknown:true});
      await this.readback();return r.status==='UNKNOWN'?null:result;
    }catch{if(this.live()&&!this.failed()){this.update({unknown:true});await this.readback();}return null;}
  }
  async readback(){
    const cue=this.cues.find(c=>c.id===this.state.activeCueId),request=cue&&this.requests.get(cue.id);if(!this.live()||!cue||!request||this.failed())return;
    this.update({phase:'CHECKING_COMPLETION'});
    try{const raw=await this.bounded(()=>this.services.readback(request,this.lease.signal));if(!this.live()||this.failed())return;this.accept(cue,request,acceptCompletion(raw,request,this.revisions.get(cue.id)));}
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
  ended(){if(!this.live()||this.failed())return;this.observe(this.media?.currentTime??this.state.position);if(!this.state.activeCueId)this.update({phase:'RESUME_READY',event:'MEDIA_ENDED'});}
  mediaError(){if(!this.live())return;this.autoResume=false;this.playSerial++;this.pauseMedia();this.update({phase:'ERROR',event:'MEDIA_ERROR'});}
  dispose(){if(this.disposed)return;this.pauseMedia();this.disposed=true;this.playSerial++;this.media=null;this.listeners.clear();}
}
