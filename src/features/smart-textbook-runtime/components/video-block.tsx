'use client';
import { useEffect, useRef, useState } from 'react';
import type { BlockV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import { useLearningState, useNativeMediaState, useRuntimeServices } from './runtime-context';
/** Thin event adapter; the Runtime media owner is the only imperative controller. */
export function NativeVideoBlock({block}:{block:Extract<BlockV1,{type:'video'}>}){
  const {nativeMedia,targets}=useLearningState(),services=useRuntimeServices(),state=useNativeMediaState(),ref=useRef<HTMLVideoElement>(null);
  const [duration,setDuration]=useState(0);
  const media=nativeMedia?.manifest.mediaRefs.find(m=>m.id===block.props.mediaRef);
  const src=media&&services.nativeExecution?services.nativeExecution.mediaSource(media.id,media.revision):undefined;
  useEffect(()=>{
    if(!ref.current||!nativeMedia)return;
    const detach=nativeMedia.attach(ref.current,block.id),unregister=targets.mountNativeMediaOwner(block.runtimeTarget,()=>nativeMedia.play());
    return()=>{unregister();detach();};
  },[nativeMedia,targets,block.id,block.runtimeTarget,src]);
  if(!nativeMedia||!media||!services.nativeExecution)throw Error('NATIVE_MEDIA_SERVICE_REQUIRED');
  const busy=!!state?.activeCueId||!state?.restored||state.phase==='ERROR';
  return <div className="runtime-native-video" data-media-phase={state?.phase}>
    <video ref={ref} src={src} preload="metadata" playsInline aria-label="教学视频"
      onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);nativeMedia.metadata(e.currentTarget.duration);}}
      onTimeUpdate={e=>nativeMedia.observe(e.currentTarget.currentTime)}
      onSeeked={e=>nativeMedia.observe(e.currentTarget.currentTime,true)}
      onPlay={()=>nativeMedia.playingEvent()} onPause={()=>nativeMedia.pauseEvent()}
      onEnded={()=>nativeMedia.ended()} onError={()=>nativeMedia.mediaError()}/>
    <div className="runtime-media-controls">
      <button type="button" disabled={busy} onClick={()=>void nativeMedia.play()}>继续播放</button>
      <button type="button" onClick={()=>nativeMedia.userPause()}>保持暂停</button>
      <label>视频位置<input aria-label="视频位置" type="range" min={0} max={Number.isFinite(duration)?duration:0} step={0.1} value={state?.position??0} disabled={!state?.restored||state.phase==='ERROR'} onChange={e=>nativeMedia.seek(Number(e.currentTarget.value))}/></label>
    </div>
    {state?.activeCueId&&<p role="status">请先完成练习，视频已暂停。</p>}
    {state?.userPaused&&!state.activeCueId&&<p role="status">视频保持暂停，可点击继续播放。</p>}
    {state?.event==='AUTOPLAY_BLOCKED'&&<p role="status">浏览器暂停了自动播放，请点击继续播放。</p>}
    {state?.phase==='ERROR'&&<p role="alert">视频或执行状态无法验证，已停止播放。</p>}
  </div>;
}
