'use client';
import { useEffect,useRef,useState } from 'react';
import { speakAuthorizedUtterance,type TtsPlaybackOwner as Owner } from '../core/playback';
import { useLearningState,useRuntimeServices } from './runtime-context';
import {useRevealBoundary} from './reveal-boundary';
import {flushSync} from 'react-dom';
import {useDialogueGroupVisible} from './dialogue-groups';

/** Real mounted browser media owner; the surrounding text element never invents play. */
export function TtsPlaybackOwner({owner}:{owner:Owner}){
  const services=useRuntimeServices(),{steps,targets}=useLearningState();
  const reveal=useRevealBoundary();
  const [status,setStatus]=useState(''),[observed,setObserved]=useState(false),active=useRef<AbortController|null>(null);
  const visible=useDialogueGroupVisible();
  useEffect(()=>{if(!visible)active.current?.abort();},[visible]);
  useEffect(()=>{
    if(!services.tts)return;
    const stop=()=>{active.current?.abort();active.current=null;};
    const unmount=targets.mountTtsOwner(owner,async signal=>{
      signal.throwIfAborted();flushSync(reveal);
      stop();const controller=new AbortController();active.current=controller;const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
      try{setStatus('正在播放授权示范…');const result=await speakAuthorizedUtterance(services.tts!,controller.signal,{
        create:text=>new SpeechSynthesisUtterance(text),speak:utterance=>window.speechSynthesis.speak(utterance),cancel:()=>window.speechSynthesis.cancel(),
      });if(!signal.aborted){setObserved(true);setStatus(result.teachingPlaybackWaitSatisfied?'已报告示范播放结束，可返回老师继续讲解。':'此播放观察已处理。');}}
      catch(error){if(!signal.aborted&&active.current===controller)setStatus(controller.signal.aborted?'已停止示范，未记录播放完成。':'播放未完成，请重试。');throw error;}
      finally{signal.removeEventListener('abort',cancel);if(active.current===controller)active.current=null;}
    });
    const off=steps.onDispose(stop);return()=>{stop();off();unmount();};
  },[owner,services,steps,targets,reveal]);
  return <div><button type="button" disabled={observed} onClick={()=>void targets.command(owner.target,'play').catch(()=>{})}>播放老师指定的表达</button><button type="button" onClick={()=>active.current?.abort()}>停止示范</button>{status&&<p role="status">{status}</p>}</div>;
}
