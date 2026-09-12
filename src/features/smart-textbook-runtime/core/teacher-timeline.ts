import type { TeacherRuntimeCue, TeacherRuntimeServices } from './teacher-runtime';
import type { TargetCommand } from './target-registry';
import { TeacherMedia } from './teacher-media';

export type TeacherTimelinePhase='idle'|'preparing'|'character'|'blackboard'|'buffer-playing'|'speech-playing'|'tts-playing'|'awaiting-task'|'awaiting-answer'|'feedback'|'remediation'|'paused'|'completed'|'error';
export type TeacherTimelineState={phase:TeacherTimelinePhase;cue:TeacherRuntimeCue|null;characterUrl:string|null;error:string};
export interface TeacherTimelineHost {
  current():boolean;
  task(cue:TeacherRuntimeCue|null):void;
  command(source:string,target:string,command:TargetCommand,signal:AbortSignal):Promise<void>;
}
/** Presentation orchestration only. No node keys, grader, navigation or Agent
 * branches. The next teaching state always comes from the server resolver. */
export class TeacherTimeline {
  private state:TeacherTimelineState={phase:'idle',cue:null,characterUrl:null,error:''};
  private listeners=new Set<()=>void>();
  private abort=new AbortController();
  private media=new TeacherMedia();
  private running=false;
  private resumePhase:TeacherTimelinePhase='idle';
  private resumeWaiters=new Set<()=>void>();
  private phaseRequest:Promise<void>=Promise.resolve();
  constructor(private services:TeacherRuntimeServices,private host:TeacherTimelineHost) {}
  snapshot=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private set(patch:Partial<TeacherTimelineState>){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
  private check(signal:AbortSignal){signal.throwIfAborted();if(!this.host.current())throw Error('TEACHER_STALE_STEP');}
  private async unpaused(signal:AbortSignal){this.check(signal);if(this.state.phase!=='paused')return;
    await new Promise<void>((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',cancel);this.resumeWaiters.delete(done);resolve();};const cancel=()=>{this.resumeWaiters.delete(done);reject(new Error('TEACHER_CANCELLED'));};this.resumeWaiters.add(done);signal.addEventListener('abort',cancel,{once:true});});this.check(signal);
  }
  private phase(phase:TeacherTimelinePhase){if(this.state.phase==='paused')this.resumePhase=phase;else this.set({phase});}
  async start(){if(this.running)return;this.abort=new AbortController();await this.run('current',true);}
  async next(){if(this.running||!['feedback','awaiting-answer','remediation'].includes(this.state.phase)||this.state.cue?.awaitingAnswer)return;await this.run('advance');}
  async answer(answer:string){if(this.running||!this.state.cue?.awaitingAnswer||this.state.phase==='paused')return;await this.run('answer',false,answer);}
  async task(){
    if(this.running||this.state.phase!=='awaiting-task'||!this.state.cue?.task)return;
    const cue=this.state.cue,signal=this.abort.signal;this.running=true;
    try { await this.host.command(cue.task!.source,cue.task!.target,'play',signal);await this.unpaused(signal); }
    catch {if(!signal.aborted)this.set({phase:'error',error:'示范未完成，请重新开始讲解。'});return;}
    finally {if(signal===this.abort.signal)this.running=false;}
    await this.run('advance');
  }
  private async run(op:'current'|'advance'|'answer',open=false,answer?:string){
    if(this.running)return;this.running=true;const signal=this.abort.signal;
    try {
      this.host.task(null);this.phase('preparing');this.set({error:''});
      if(open)await this.services.open(signal);
      let cue=op==='current'?await this.services.current(signal):op==='answer'?await this.services.answer(answer!,signal):await this.services.advance(signal);
      for(;;){
        await this.unpaused(signal);if(this.state.characterUrl)URL.revokeObjectURL(this.state.characterUrl);
        this.set({cue,characterUrl:null});this.phase('character');
        if(cue.stage.character?.visible){const image=await this.services.character(cue.cue,signal);this.check(signal);this.set({characterUrl:URL.createObjectURL(image)});}
        await this.unpaused(signal);this.phase('blackboard');
        for(const kind of ['buffer','speech'] as const){
          await this.unpaused(signal);if(kind==='buffer'&&!cue.buffer.text)continue;
          this.phase(kind==='buffer'?'buffer-playing':'speech-playing');
          await this.media.play(this.services,cue,kind,signal,mode=>{if(!signal.aborted)this.phase(mode==='tts'?'tts-playing':kind==='buffer'?'buffer-playing':'speech-playing');});
        }
        await this.unpaused(signal);
        for(const c of cue.commands){await this.host.command(c.source,c.target,c.command,signal);await this.unpaused(signal);}
        if(cue.task){if(!cue.task.playbackAvailable)throw Error('TEACHER_TASK_GRANT_UNAVAILABLE');this.host.task(cue);
          await this.host.command(cue.task.source,cue.task.target,'reveal',signal);await this.host.command(cue.task.source,cue.task.target,'focus',signal);await this.unpaused(signal);
          this.phase('awaiting-task');break;
        }
        if(cue.terminal){this.phase('completed');break;}
        if(cue.autoContinue){this.phase('preparing');cue=await this.services.advance(signal);continue;}
        this.phase(cue.answerFeedback==='retry'?'remediation':cue.awaitingAnswer?'awaiting-answer':'feedback');break;
      }
    } catch {if(!signal.aborted&&this.host.current()){this.host.task(null);this.media.stop();this.set({phase:'error',error:'教学会话或媒体未通过，请重新开始讲解。'});}}
    finally {if(signal===this.abort.signal)this.running=false;}
  }
  async pause(){if(['idle','completed','error','paused'].includes(this.state.phase))return;this.resumePhase=this.state.phase;this.set({phase:'paused'});this.media.pause();window.speechSynthesis?.pause();
    const signal=this.abort.signal;
    this.phaseRequest=this.phaseRequest.then(()=>{signal.throwIfAborted();return this.services.pause(signal);});try{await this.phaseRequest;}catch{if(signal===this.abort.signal&&!signal.aborted)this.set({phase:'error',error:'暂停请求失败，请停止后重试。'});}
  }
  async resume(){if(this.state.phase!=='paused')return;
    const signal=this.abort.signal;
    this.phaseRequest=this.phaseRequest.then(()=>{signal.throwIfAborted();return this.services.resume(signal);});try{await this.phaseRequest;this.check(signal);if(signal!==this.abort.signal)return;this.set({phase:this.resumePhase});this.media.resume();window.speechSynthesis?.resume();for(const fn of [...this.resumeWaiters])fn();}catch{if(signal===this.abort.signal&&!signal.aborted)this.set({phase:'error',error:'恢复请求失败，请停止后重试。'});}
  }
  stop(){this.abort.abort();this.media.stop();this.host.task(null);window.speechSynthesis?.cancel();if(this.state.characterUrl)URL.revokeObjectURL(this.state.characterUrl);this.running=false;this.phaseRequest=Promise.resolve();this.set({phase:'idle',cue:null,characterUrl:null,error:''});void this.services.close().catch(()=>{});}
  dispose(){this.stop();this.listeners.clear();}
}
