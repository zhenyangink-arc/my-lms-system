import {recordingItemSchema,type RecordingItem,type RecordingRuntimeServices,type RecordingScope,type RecordingSlot} from './recording';
export type RecordingPhase='idle'|'requesting-permission'|'recording'|'stopping'|'local-ready'|'uploading'|'uploaded'|'deleting'|'restoring'|'error';
export type RecordingView={phase:RecordingPhase;url:string|null;item:RecordingItem|null;error:string;durationSeconds:number|null;hasLocal:boolean};
/** Temporary browser state only: no server completion or grading writes. */
export class RecordingController{
  private state:RecordingView={phase:'idle',url:null,item:null,error:'',durationSeconds:null,hasLocal:false};
  private listeners=new Set<()=>void>();private abort=new AbortController();private live=true;
  private stream:MediaStream|null=null;private recorder:MediaRecorder|null=null;private blob:Blob|null=null;private started=0;
  private timer:ReturnType<typeof setTimeout>|null=null;private audio:HTMLAudioElement|null=null;
  constructor(private services:RecordingRuntimeServices,private scope:RecordingScope,private slot:RecordingSlot,signal:AbortSignal,private changed:(item:RecordingItem|null)=>void){
    const dispose=()=>this.dispose();signal.addEventListener('abort',dispose,{once:true});this.abort.signal.addEventListener('abort',()=>signal.removeEventListener('abort',dispose),{once:true});if(signal.aborted)this.dispose();
  }
  snapshot=()=>this.state;
  subscribe=(f:()=>void)=>{this.listeners.add(f);return()=>{this.listeners.delete(f);};};
  private set(patch:Partial<RecordingView>){if(!this.live)return;this.state={...this.state,...patch};this.listeners.forEach(f=>f());}
  private busy(){return ['requesting-permission','recording','stopping','uploading','deleting','restoring'].includes(this.state.phase);}
  private fail(message:string){this.set({phase:'error',error:message});}
  private replaceUrl(blob:Blob|null){this.audio?.pause();this.audio=null;if(this.state.url)URL.revokeObjectURL(this.state.url);this.set({url:blob?URL.createObjectURL(blob):null});}
  private stopTracks(){this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.timer)clearTimeout(this.timer);this.timer=null;}
  async restore(item:RecordingItem|null,notify=false){if(!this.live||this.busy())return;if(!item){this.set({phase:'idle',item:null});return;}
    this.set({phase:'restoring',item,error:''});try{const b=await this.services.audio(this.scope,item.id,this.abort.signal);if(!this.live)return;this.replaceUrl(b);this.set({phase:'uploaded',durationSeconds:item.durationSeconds,hasLocal:false});if(notify)this.changed(item);}catch{this.fail('已保存录音读取失败，请重试恢复。');}
  }
  async start(){if(!this.live||this.busy())return;
    if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices?.getUserMedia){this.fail('当前浏览器不支持录音，请换用支持麦克风的浏览器。');return;}
    this.set({phase:'requesting-permission',error:''});this.audio?.pause();
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!this.live){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
      const recorder=new MediaRecorder(stream);this.recorder=recorder;const chunks:Blob[]=[];
      recorder.ondataavailable=e=>{if(this.live&&e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>{recorder.onstop=null;this.stopTracks();this.fail('录音中断，请重新录制。');};
      recorder.onstop=()=>{this.stopTracks();if(!this.live)return;
        const duration=(performance.now()-this.started)/1000,blob=new Blob(chunks,{type:recorder.mimeType});
        if(blob.size<2048){this.fail('录音为空或过短，请重新录制。');return;}
        if(duration<this.slot.minimumSeconds){this.fail(`请至少录制 ${this.slot.minimumSeconds} 秒后重试。`);return;}
        this.blob=blob;this.replaceUrl(blob);this.set({phase:'local-ready',durationSeconds:Math.min(duration,this.slot.maximumSeconds),hasLocal:true});
      };
      this.started=performance.now();recorder.start();this.blob=null;this.set({phase:'recording',durationSeconds:null,hasLocal:false});this.changed(null);this.timer=setTimeout(()=>this.stop(),this.slot.maximumSeconds*1000);
    }catch{this.stopTracks();this.fail('无法使用麦克风，请允许权限后重试。');}
  }
  stop(){if(!this.live||this.state.phase!=='recording')return;this.set({phase:'stopping'});try{this.recorder?.stop();}catch{this.stopTracks();this.fail('停止录音失败，请重新录制。');}}
  async upload(){if(!this.live||this.busy()||!this.blob||!this.state.durationSeconds)return;this.set({phase:'uploading',error:''});
    try{const item=recordingItemSchema.parse(await this.services.upload(this.scope,this.blob,this.state.durationSeconds,this.abort.signal));if(!this.live)return;
      if(item.partId!==this.slot.partId)throw Error('RECORDING_PART');this.blob=null;this.set({phase:'uploaded',item,hasLocal:false});this.changed(item);
    }catch{this.fail('上传失败，本地录音仍保留；请重试上传。');}
  }
  async remove(){if(!this.live||this.busy()||!this.state.item)return;this.set({phase:'deleting',error:''});
    try{await this.services.remove(this.scope,this.state.item.id,this.abort.signal);if(!this.live)return;this.blob=null;this.replaceUrl(null);this.set({phase:'idle',item:null,hasLocal:false,durationSeconds:null});this.changed(null);}catch{this.fail('删除失败，已保存录音未清除；请重试删除。');}
  }
  async play(){if(!this.live||!this.state.url)return;this.audio?.pause();const a=new Audio(this.state.url);this.audio=a;try{await a.play();if(!this.live)a.pause();}catch{this.set({error:'回放失败，请重试播放。'});}}
  dispose(){if(!this.live)return;this.live=false;this.abort.abort();if(this.recorder){this.recorder.onstop=null;this.recorder.ondataavailable=null;this.recorder.onerror=null;if(this.recorder.state!=='inactive')try{this.recorder.stop();}catch{}}
    this.stopTracks();this.audio?.pause();if(this.state.url)URL.revokeObjectURL(this.state.url);this.blob=null;this.listeners.clear();}
}
