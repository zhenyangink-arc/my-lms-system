'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import type {LearningTools} from '../core/learning-tools';
import {learningDestinationSchema} from '../core/learning-tools';
import {useLearningState,useRuntimeServices} from './runtime-context';
import {RuntimeTarget} from './target';
import {useRevealBoundary} from './reveal-boundary';
import {flushSync} from 'react-dom';
import {useDialogueGroupVisible} from './dialogue-groups';
import {playRepeatLine} from '../core/repeat-playback';

/** Existing grammar Browser TTS behavior. This is NOT a teaching wait grant. */
export function GrammarPlayback({tools,partId}:{tools:LearningTools;partId:string}){
  const {steps,targets}=useLearningState(),[error,setError]=useState('');
  const reveal=useRevealBoundary();
  const visible=useDialogueGroupVisible(),stopPlayback=useRef<()=>void>(()=>{});
  useEffect(()=>{if(!visible)stopPlayback.current();},[visible]);
  useEffect(()=>{const owner=tools.playback.find(p=>p.partId===partId);if(owner?.kind!=='browser-tts')return;
    let active:AbortController|null=null;
    const stop=()=>{active?.abort();active=null;};
    stopPlayback.current=stop;
    const off=targets.mountLearningOwner(tools,partId,async signal=>{
      signal.throwIfAborted();flushSync(reveal);if(!('speechSynthesis'in window))throw Error('TTS_UNAVAILABLE');stop();
      const controller=new AbortController();active=controller;
      try{await playRepeatLine(owner.text,AbortSignal.any([signal,controller.signal]),{
        create:text=>new SpeechSynthesisUtterance(text),speak:value=>window.speechSynthesis.speak(value),cancel:()=>window.speechSynthesis.cancel(),
      });}finally{if(active===controller)active=null;}
    });
    const dispose=steps.onDispose(stop);return()=>{dispose();off();stop();};
  },[tools,partId,steps,targets,reveal]);
  const owner=tools.playback.find(p=>p.partId===partId);
  return <><button type="button" onClick={()=>{setError('');if(owner)void targets.command(owner.target,'play').catch(()=>setError('当前浏览器无法点读，请重试。'));}}>例句点读</button>{error&&<p role="alert">{error}</p>}</>;
}
export function LearningNavigation({tools}:{tools:LearningTools}){
  const {steps,targets}=useLearningState(),services=useRuntimeServices(),[error,setError]=useState('');
  const commands=useMemo(()=>new Map(tools.navigation.map(n=>[n.target,{open:async(signal:AbortSignal)=>{if(!services.learningTools)throw Error('OPEN_UNAVAILABLE');const d=learningDestinationSchema.parse(await services.learningTools.open(tools.capsuleRef,n.target,signal));signal.throwIfAborted();if(d.kind==='step')steps.go(d.stepId);else window.location.assign(d.path);return 'navigated' as const;}}])),[tools,steps,services]);
  return <>{tools.navigation.map(n=>{const declaration=steps.manifest.runtimeTargets.find(t=>t.id===n.target);if(!declaration)return <p key={n.target}>该目标尚不可用。</p>;return <RuntimeTarget key={n.target} declaration={declaration} commands={commands.get(n.target)}><button type="button" onClick={()=>{setError('');void targets.command(n.target,'open').catch(()=>setError('尚未满足服务器章节完成条件，不能进入测试。'));}}>{n.label}</button></RuntimeTarget>;})}{error&&<p role="alert">{error}</p>}</>;
}
