'use client';
import {useEffect,useState} from 'react';
import {useLearningState,useRuntimeServices} from './runtime-context';

/** Optional node illustration. Media failure never hides instructional text. */
export function SceneImage({capsuleRef,title}:{capsuleRef:string;title:string}){
  const {sceneImage}=useRuntimeServices(),{steps}=useLearningState();
  const [state,setState]=useState<{kind:'loading'|'empty'|'error'}|{kind:'ready';url:string}>({kind:'loading'});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!sceneImage)return;
    const lease=steps.lease(),controller=new AbortController();let live=true,url:string|undefined;
    const signal=AbortSignal.any([lease.signal,controller.signal]);setState({kind:'loading'});
    sceneImage(capsuleRef,signal).then(blob=>{
      if(!live||signal.aborted||!steps.isCurrent(lease))return;
      if(!blob){setState({kind:'empty'});return;}
      if(!['image/png','image/jpeg','image/webp','image/avif'].includes(blob.type)||!blob.size||blob.size>10*1024*1024)throw Error('IMAGE_BYTES');
      url=URL.createObjectURL(blob);setState({kind:'ready',url});
    }).catch(()=>{if(live&&!signal.aborted&&steps.isCurrent(lease))setState({kind:'error'});});
    return()=>{live=false;controller.abort();if(url)URL.revokeObjectURL(url);};
  },[sceneImage,capsuleRef,steps,retry]);
  if(!sceneImage||state.kind==='empty')return null;
  if(state.kind==='loading')return <p role="status">正在加载情景图片…</p>;
  if(state.kind==='error')return <div className="runtime-scene-error" role="status">情景图片暂不可用，仍可继续阅读和练习。<button type="button" onClick={()=>setRetry(n=>n+1)}>重试图片</button></div>;
  if(state.kind!=='ready')return null;
  // eslint-disable-next-line @next/next/no-img-element -- Authorized Blob, not a public optimization URL.
  return <figure className="runtime-scene-image"><img src={state.url} alt={`${title}：情景配图`} onError={()=>setState({kind:'error'})}/></figure>;
}
