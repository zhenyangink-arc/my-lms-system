'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {RecordingController} from '../core/recording-controller';
import type {RecordingItem,RecordingScope,RecordingSlot} from '../core/recording';
import {useLearningState,useRuntimeServices} from './runtime-context';
function Controls({controller}:{controller:RecordingController}){
  const s=useSyncExternalStore(controller.subscribe,controller.snapshot,controller.snapshot);
  const busy=['requesting-permission','recording','stopping','uploading','deleting','restoring'].includes(s.phase);
  const labels={idle:'尚未录音','requesting-permission':'正在申请麦克风权限…',recording:'正在录音…',stopping:'正在停止…','local-ready':'本地录音就绪，尚未上传',uploading:'正在上传…',uploaded:'录音已保存',deleting:'正在删除…',restoring:'正在恢复…',error:'操作未完成'};
  return <div className="runtime-card" aria-label="录音控件">
    <p role="status">{labels[s.phase]}{s.durationSeconds!==null?`（${Math.round(s.durationSeconds)} 秒）`:''}</p>
    <button type="button" disabled={busy} onClick={()=>void controller.start()}>{s.url?'重新录制':'开始录音'}</button>
    {s.phase==='recording'&&<button type="button" onClick={()=>controller.stop()}>停止录音</button>}
    {s.url&&<button type="button" disabled={busy} onClick={()=>void controller.play()}>播放录音</button>}
    {s.hasLocal&&<button type="button" disabled={busy} onClick={()=>void controller.upload()}>上传录音</button>}
    {s.item?.state==='available'&&<button type="button" disabled={busy} onClick={()=>void controller.remove()}>删除录音</button>}
    {s.phase==='error'&&s.item&&!s.hasLocal&&<><p>上一份已保存录音仍可恢复或删除；本次新录音尚未保存。</p><button type="button" onClick={()=>void controller.restore(s.item,true)}>重试恢复</button></>}
    {s.error&&<p role="alert">{s.error}</p>}
  </div>;
}
/** Local playback is not an undeclared Manifest play capability. */
export function RuntimeRecordingControl({scope,slot,initial,onChange}:{scope:RecordingScope;slot:RecordingSlot;initial:RecordingItem|null;onChange:(item:RecordingItem|null)=>void}){
  const {recording}=useRuntimeServices(),{steps}=useLearningState(),callback=useRef(onChange),initialRef=useRef(initial);callback.current=onChange;
  const [controller,setController]=useState<RecordingController|null>(null);
  useEffect(()=>{if(!recording)return;const c=new RecordingController(recording,scope,slot,steps.lease().signal,item=>callback.current(item));setController(c);void c.restore(initialRef.current);return()=>c.dispose();
  // Identity, not responses, determines the mounted owner lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[recording,steps,scope.target,scope.capsuleRef,scope.activityRef]);
  return controller?<Controls controller={controller}/>:<p role="status">录音服务未启用。</p>;
}
