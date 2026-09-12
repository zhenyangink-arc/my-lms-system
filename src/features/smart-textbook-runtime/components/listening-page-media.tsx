'use client';
import { useEffect,useRef,useState } from 'react';
import {flushSync} from 'react-dom';
import type { ActivityPage } from '../core/activity-pages';
import { useLearningState,useRuntimeServices } from './runtime-context';
import {learningToolsSchema,type LearningTools} from '../core/learning-tools';

/** Same existing native listening playback, scoped to a frozen page/track.
 * Counts in legacy config are not represented as enforced server entitlement. */
export function ListeningPageMedia({page,capsuleRef,checked}:{page:ActivityPage;capsuleRef:string;checked:boolean}){
  const services=useRuntimeServices(),{steps,targets}=useLearningState();
  const [tools,setTools]=useState<LearningTools|null>(null);
  const [url,setUrl]=useState<string|null>(null),[transcript,setTranscript]=useState<string|null>(null),[visible,setVisible]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const audio=useRef<HTMLAudioElement|null>(null),lifetime=useRef<AbortController|null>(null),blobUrl=useRef<string|null>(null);
  const loading=useRef<Promise<void>|null>(null);
  async function loadAudio(signal:AbortSignal){
    if(!lifetime.current||!services.pages?.audio)throw Error('MEDIA_OWNER_UNAVAILABLE');
    const scoped=AbortSignal.any([signal,lifetime.current.signal]);scoped.throwIfAborted();
    if(!blobUrl.current){if(!loading.current)loading.current=(async()=>{const bytes=await services.pages!.audio!(capsuleRef,page.pageId,scoped);scoped.throwIfAborted();const url=URL.createObjectURL(bytes);blobUrl.current=url;flushSync(()=>setUrl(url));})().finally(()=>{loading.current=null;});await loading.current;}
    scoped.throwIfAborted();
  }
  const play=useRef<(signal:AbortSignal)=>Promise<void>>(async()=>{throw Error('MEDIA_NOT_MOUNTED');});
  play.current=async signal=>{await loadAudio(signal);if(!audio.current)throw Error('MEDIA_NOT_MOUNTED');await audio.current.play();};
  useEffect(()=>{if(!services.learningTools)return;const c=new AbortController(),signal=AbortSignal.any([steps.lease().signal,c.signal]);services.learningTools.load(capsuleRef,signal).then(raw=>{if(!signal.aborted)setTools(learningToolsSchema.parse(raw));}).catch(()=>{if(!signal.aborted)setError('音轨目标绑定不可用。');});return()=>c.abort();},[services,capsuleRef,steps]);
  useEffect(()=>{if(!tools)return;const owner=tools.playback.find(p=>p.kind==='listening'&&p.pageId===page.pageId);if(!owner)return;return targets.mountLearningOwner(tools,owner.partId,signal=>play.current(signal));},[tools,page.pageId,targets]);
  useEffect(()=>{const controller=new AbortController();lifetime.current=controller;const stop=()=>{controller.abort();audio.current?.pause();if(blobUrl.current){URL.revokeObjectURL(blobUrl.current);blobUrl.current=null;}};const off=steps.onDispose(stop);return()=>{stop();off();};},[steps]);
  async function load(kind:'audio'|'transcript'){
    if(pending||!lifetime.current)return;const lease=steps.lease(),signal=AbortSignal.any([lease.signal,lifetime.current.signal]);setPending(true);setError('');
    try{
      if(kind==='audio')await loadAudio(signal);
      else{if(!checked||!services.pages?.transcript)throw Error('TRANSCRIPT_LOCKED');const text=await services.pages.transcript(capsuleRef,page.pageId,signal);signal.throwIfAborted();if(steps.isCurrent(lease)){setTranscript(text);setVisible(true);}}
    }catch{if(!signal.aborted&&steps.isCurrent(lease))setError('音频或母稿暂不可用，请重试。');}
    finally{if(!signal.aborted&&steps.isCurrent(lease))setPending(false);}
  }
  const content=<div><audio hidden={!url} ref={audio} controls controlsList="nodownload" preload="none" src={url??undefined} aria-label="当前听力音轨"/>{!url&&<button type="button" disabled={pending} onClick={()=>void load('audio')}>加载本页听力</button>}
    {checked&&<button type="button" disabled={pending} aria-expanded={visible} onClick={()=>{if(visible)setVisible(false);else if(transcript)setVisible(true);else void load('transcript');}}>听力母稿</button>}
    {visible&&transcript&&<p>{transcript}</p>}{error&&<p role="alert">{error}</p>}
  </div>;
  // ActivityPageExecutor owns the single page/container handle; this component
  // contributes only its actual authorized audio playback owner.
  return content;
}
