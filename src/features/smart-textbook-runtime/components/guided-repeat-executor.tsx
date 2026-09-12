'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { acceptRepeatState,type RepeatLesson,type RepeatState } from '../core/guided-repeat';
import { playRepeatLine } from '../core/repeat-playback';
import { useLearningState,useRuntimeServices } from './runtime-context';
import { RuntimeTarget } from './target';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';

/** Scoped practice only. No local grader, recorder, Agent or Step controller. */
export function GuidedRepeatExecutor({lesson,initialState,manifest,trackRecording}:{lesson:RepeatLesson;initialState:RepeatState;manifest:LessonManifestV1;trackRecording?:(trackId:string)=>ReactNode}){
  const services=useRuntimeServices(),{steps,setActivePart,refresh}=useLearningState();
  const [state,setState]=useState(()=>acceptRepeatState(lesson,initialState));
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
  const operation=useRef<AbortController|null>(null),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current?.abort();};},[]);
  async function playTarget(text:string,signal:AbortSignal){
    signal.throwIfAborted();if(operation.current)throw Error('REPEAT_BUSY');
    const c=new AbortController(),off=steps.onDispose(()=>c.abort());operation.current=c;
    try{await playRepeatLine(text,AbortSignal.any([signal,c.signal]),{
      create:text=>new SpeechSynthesisUtterance(text),speak:u=>window.speechSynthesis.speak(u),cancel:()=>window.speechSynthesis.cancel(),
    });}finally{off();if(operation.current===c)operation.current=null;}
    // Imperative playback alone is not a practice marker or formal completion.
  }
  async function play(trackId:string,segmentId:string){
    if(operation.current||!services.guidedRepeat)return;
    const segment=lesson.tracks.find(t=>t.id===trackId)?.segments.find(s=>s.id===segmentId);if(!segment)return;
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setError('当前浏览器不支持跟读播放，请换用支持语音播放的浏览器。');return;}
    const lease=steps.lease(),controller=new AbortController(),cancel=()=>controller.abort();
    operation.current=controller;lease.signal.addEventListener('abort',cancel,{once:true});
    setActivePart(segment.id);setBusy(segment.id);setError('');
    try{
      await playRepeatLine(segment.text,controller.signal,{
        create:text=>{const u=new SpeechSynthesisUtterance(text);const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('ko'));if(voice)u.voice=voice;return u;},
        speak:u=>window.speechSynthesis.speak(u),cancel:()=>window.speechSynthesis.cancel(),
      });
      if(!steps.isCurrent(lease)||!mounted.current) return;
      // The old repeat Action saves a practice marker only. An onend is never
      // forwarded to an activity completion/score or the teaching Agent.
      const next=await services.guidedRepeat.mark(lesson.capsuleRef,trackId,segmentId,controller.signal);
      if(mounted.current&&steps.isCurrent(lease)&&!controller.signal.aborted){
        const checked=acceptRepeatState(lesson,next);if(checked.mode!==state.mode)throw Error('REPEAT_MODE_CHANGED');setState(checked);
        if(checked.mode==='production-domain')await refresh();
      }
    }catch{if(mounted.current&&steps.isCurrent(lease)&&!controller.signal.aborted)setError('播放或保存练习标记失败，请重试本句。');}
    finally{lease.signal.removeEventListener('abort',cancel);if(operation.current===controller)operation.current=null;if(mounted.current&&steps.isCurrent(lease))setBusy(null);}
  }
  return <section aria-label="逐句跟读" className="runtime-card">
    <CardTitleWithHint title="逐句跟读" headingLevel={3} description="播放后跟读当前句；练习标记不代表口语活动完成或评分。"/>
    <p role="status">{state.mode==='preview-isolated'?'隔离预览：练习标记保留约 30 分钟，不写正式进度。':'已恢复服务端练习标记，不代表正式活动完成。'}</p>
    {error&&<p role="alert">{error}</p>}
    {lesson.tracks.map(track=>{
      const target=manifest.runtimeTargets.find(t=>t.id===track.target);if(!target)throw Error('REPEAT_TARGET');
      return <RuntimeTarget key={track.id} declaration={target}><article><h4>{track.title}</h4><p>{track.keywords.join(' · ')}</p>
        {track.segments.map(segment=>{
          const declaration=manifest.runtimeTargets.find(t=>t.id===segment.target);if(!declaration)throw Error('REPEAT_TARGET');
          return <RuntimeTarget key={segment.id} declaration={declaration} commands={declaration.capabilities.includes('play')?{play:signal=>playTarget(segment.text,signal)}:undefined}><div className="space-y-2 py-2">
            <p lang="ko">{segment.text}</p><p>{segment.translation}</p>
            <button type="button" className="min-h-11 px-3" disabled={busy!==null} aria-label={`播放：${segment.text}`} onClick={()=>void play(track.id,segment.id)}>播放当前句</button>
            {busy===segment.id&&<button type="button" className="min-h-11 px-3" onClick={()=>operation.current?.abort()}>停止</button>}
            <span role="status">{busy===segment.id?'正在播放或保存…':state.practicedSegmentIds.includes(segment.id)?'已练习':'尚未练习'}</span>
          </div></RuntimeTarget>;
        })}{trackRecording?.(track.id)}
      </article></RuntimeTarget>;
    })}
  </section>;
}
