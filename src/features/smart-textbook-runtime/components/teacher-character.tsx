'use client';
import { useEffect,useState } from 'react';
import { useLearningState,useRuntimeServices } from './runtime-context';
/** Opaque authorized bytes only. The old character Route's redirect stays server-side. */
export function TeacherCharacter({cueId,pose}:{cueId:string;pose:string}){
  const {steps}=useLearningState(),services=useRuntimeServices();const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{if(!services.teacher.character)return;const lease=steps.lease(),controller=new AbortController();let url:string|null=null;setUrl(null);
    const stop=()=>{controller.abort();if(url){URL.revokeObjectURL(url);url=null;}};const off=steps.onDispose(stop);
    services.teacher.character(cueId,lease.generation,AbortSignal.any([lease.signal,controller.signal])).then(bytes=>{if(controller.signal.aborted||!steps.isCurrent(lease))return;url=URL.createObjectURL(bytes);setUrl(url);}).catch(()=>{});
    return()=>{stop();off();};
  },[services,steps,cueId,pose]);
  return url?<img src={url} alt="金老师" width={160} height={220} className="runtime-teacher-image"/>:<p role="status">人物画面暂未加载。</p>;
}
