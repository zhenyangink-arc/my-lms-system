import type { TeacherRuntimeCue, TeacherRuntimeServices } from './teacher-runtime';

/** One presentation media owner. Ended means presentation ended, never learning
 * completion. Abort detaches handlers before stopping the browser resources. */
export class TeacherMedia {
  private audio: HTMLAudioElement | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private abort: AbortController | null = null;
  private paused = false;
  pause() { this.paused=true;this.audio?.pause();if(this.utterance)window.speechSynthesis?.pause(); }
  resume() { this.paused=false;const audio=this.audio;if(audio)void audio.play().catch(()=>{if(this.audio===audio)audio.dispatchEvent(new Event('error'));});if(this.utterance)window.speechSynthesis?.resume(); }
  stop() { this.abort?.abort();this.abort=null;this.paused=false; }
  async play(services:TeacherRuntimeServices,cue:TeacherRuntimeCue,kind:'buffer'|'speech',signal:AbortSignal,onMode:(mode:'audio'|'tts'|'text-only')=>void) {
    this.stop();const abort=new AbortController();this.abort=abort;const combined=AbortSignal.any([signal,abort.signal]);
    const text=kind==='buffer'?cue.buffer.text:cue.text,available=kind==='buffer'?cue.buffer.available:cue.speechAvailable;
    if(!text)return;
    try {
      if(available){
        try {
          const bytes=await services.speech(cue.cue,kind,combined);combined.throwIfAborted();
          const url=URL.createObjectURL(bytes),audio=new Audio(url);this.audio=audio;onMode('audio');
          try { await new Promise<void>((resolve,reject)=>{
            let settled=false;const done=(error?:Error)=>{if(settled)return;settled=true;audio.onended=null;audio.onerror=null;combined.removeEventListener('abort',cancel);error?reject(error):resolve();};
            const cancel=()=>done(new Error('TEACHER_MEDIA_ABORT'));
            audio.onended=()=>done();audio.onerror=()=>done(new Error('TEACHER_AUDIO_FAILED'));combined.addEventListener('abort',cancel,{once:true});
            if(combined.aborted)return cancel();if(!this.paused)void audio.play().catch(()=>done(new Error('TEACHER_AUDIO_FAILED')));
          }); return; }
          finally { audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');if(this.audio===audio)this.audio=null;URL.revokeObjectURL(url); }
        } catch(error) { if(combined.aborted)throw error; /* Existing Audio → browser narration fallback. */ }
      }
      combined.throwIfAborted();
      if(!cue.voice.enabled||!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){onMode('text-only');return;}
      onMode('tts');
      try { await new Promise<void>((resolve,reject)=>{
        const u=new SpeechSynthesisUtterance(text);this.utterance=u;u.lang=cue.voice.locale;u.rate=cue.voice.rate;let settled=false;
        const done=(error?:Error)=>{if(settled)return;settled=true;u.onend=null;u.onerror=null;combined.removeEventListener('abort',cancel);if(this.utterance===u)this.utterance=null;error?reject(error):resolve();};
        const cancel=()=>{done(new Error('TEACHER_MEDIA_ABORT'));window.speechSynthesis.cancel();};
        u.onend=()=>done();u.onerror=()=>done(new Error('TEACHER_TTS_FAILED'));combined.addEventListener('abort',cancel,{once:true});
        if(combined.aborted)return cancel();try{window.speechSynthesis.speak(u);if(this.paused)window.speechSynthesis.pause();}catch{done(new Error('TEACHER_TTS_FAILED'));}
      }); } catch(error) { if(combined.aborted)throw error;onMode('text-only'); }
    } finally { if(this.abort===abort)this.abort=null; }
  }
}
