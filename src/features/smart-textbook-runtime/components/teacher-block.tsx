'use client';
import { useEffect, useRef, useState } from 'react';
import type { BlockV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import type { TeacherTurn, TeacherIntent } from '../core/teacher';
import { useLearningState, useRuntimeServices } from './runtime-context';
import { TeacherCharacter } from './teacher-character';
import { TeacherExecutor } from './teacher-executor';

/** Scoped legacy teaching display and real Agent turns. Pending playback-task bridge
 * remains explicit; this component is not registered as fully executable compatibility. */
export function LegacyTeacherRenderer({block}:{block:Extract<BlockV1,{type:'compat.teacher.v1'}>}){
  const services=useRuntimeServices();
  return services.teacherRuntime?<TeacherExecutor/>:<LegacyTeacherInspection block={block}/>;
}
function LegacyTeacherInspection({block}:{block:Extract<BlockV1,{type:'compat.teacher.v1'}>}){
  const services=useRuntimeServices(),{steps,targets,setPlaybackOwner}=useLearningState();
  const [turn,setTurn]=useState<TeacherTurn|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('');
  const media=useRef<HTMLAudioElement|null>(null),utterance=useRef<SpeechSynthesisUtterance|null>(null),objectUrl=useRef<string|null>(null),playback=useRef<AbortController|null>(null);
  const stop=()=>{playback.current?.abort();playback.current=null;media.current?.pause();media.current=null;if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;}if(utterance.current){window.speechSynthesis?.cancel();utterance.current=null;}};
  useEffect(()=>{const generation=steps.generation;
    const dispose=()=>{stop();void services.teacher.cancel(generation).catch(()=>{});};
    // Effect replay must not revoke a still-active generation. StepController owns
    // revocation; unmount stops local media immediately.
    const unregister=steps.onDispose(dispose);return()=>{unregister();stop();};
  },[steps,services]);
  async function play(text:string,assetId:string|null,kind:'speech'|'buffer'='speech'){
    stop();const lease=steps.lease(),controller=new AbortController();playback.current=controller;const signal=AbortSignal.any([lease.signal,controller.signal]);
    try{
      if(assetId){
        if(!turn||!services.teacher.speech)throw Error('语音暂不可用');
        const bytes=await services.teacher.speech(kind,turn.cueId,lease.generation,signal);
        if(!steps.isCurrent(lease)||signal.aborted)return;
        const url=URL.createObjectURL(bytes);objectUrl.current=url;
        const audio=new Audio(url);media.current=audio;audio.onended=()=>{if(media.current===audio)stop();};await audio.play();return;
      }
      if(text&&turn?.character?.voiceEnabled!==false&&'speechSynthesis'in window){
        const speech=new SpeechSynthesisUtterance(text);speech.lang=services.context.locale;speech.rate=turn?.character?.voiceRate??1;
        utterance.current=speech;window.speechSynthesis.speak(speech);
      }
    }catch{if(steps.isCurrent(lease)&&!signal.aborted){stop();setError('语音暂不可用，请阅读当前台词。');}}
    // No completion/event/score is emitted by ended or error.
  }
  async function advance(intent:TeacherIntent,answer?:string){
    if(pending)return;
    const lease=steps.lease();stop();setPending(true);setError('');
    try{
      const next=await services.teacher.turn(block.props.teachingRef,lease.generation,intent,answer,lease.signal);
      if(!steps.isCurrent(lease))return;setTurn(next);setPlaybackOwner(next.playbackOwner??null);
      if(next.visualTarget){try{await targets.command(next.visualTarget,'reveal');await targets.command(next.visualTarget,'highlight');}catch{setError('当前教学目标尚未挂载，请在学习区打开对应内容。');}}
    }catch{if(steps.isCurrent(lease))setError('教学服务暂不可用，请重新打开审计预览。');}
    finally{if(steps.isCurrent(lease))setPending(false);}
  }
  return <div className="runtime-card">
    <h2>金老师</h2>
    {!turn?<button type="button" disabled={pending} onClick={()=>void advance('start')}>开始讲解</button>:<>
      {turn.character&&<TeacherCharacter cueId={turn.cueId} pose={turn.character.pose}/>}
      <div className="runtime-blackboard" aria-label="教学黑板">{turn.blackboard.map(e=><div key={e.id} style={{position:'absolute',left:`${e.x}%`,top:`${e.y}%`,width:`${e.width}%`,height:`${e.height}%`,textAlign:e.align,fontSize:`clamp(12px, ${e.fontSize/16}vw, ${e.fontSize}px)`}}><span>{e.content}</span>{e.translation&&<small>{e.translation}</small>}</div>)}</div>
      <p>{turn.text}</p><button type="button" onClick={()=>void play(turn.text,turn.speechAssetId)}>播放本句</button><button type="button" onClick={stop}>停止播放</button>
      {turn.buffer.text&&<button type="button" onClick={()=>void play(turn.buffer.text,turn.buffer.assetId,'buffer')}>播放过渡提示</button>}
      {turn.task&&<aside><p>{turn.task.instruction}</p><button type="button" onClick={()=>void targets.command(turn.task!.target,'focus').catch(()=>setError('学习目标不可用。'))}>定位学习任务</button></aside>}
      {turn.unsupported.map(message=><p role="status" key={message}>{message}</p>)}
      {turn.awaitingAnswer?turn.questionOptions.map(option=><button key={option} type="button" disabled={pending} onClick={()=>void advance('answer',option)}>{option}</button>):<button type="button" disabled={pending||turn.terminal} onClick={()=>void advance('ready')}>{turn.terminal?'本次讲解结束':turn.continueLabel}</button>}
    </>}
    {pending&&<p role="status">正在读取教学内容…</p>}{error&&<p role="alert">{error}</p>}
  </div>;
}
