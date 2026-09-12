'use client';
import { useEffect, useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { TeacherTimeline } from '../core/teacher-timeline';
import type { TeacherRuntimeCue } from '../core/teacher-runtime';
import { useLearningState, useRuntimeServices } from './runtime-context';

function TeacherStage({cue,url}:{cue:TeacherRuntimeCue;url:string|null}) {
  const c=cue.stage.character;
  const style=c?{'--teacher-x':`${c.x}%`,'--teacher-y':`${c.y}%`,'--teacher-scale':c.scale,
    '--teacher-narrow-x':`${c.narrowX}%`,'--teacher-narrow-y':`${c.narrowY}%`,'--teacher-narrow-scale':c.narrowScale} as CSSProperties:undefined;
  return <div className="runtime-teacher-stage" aria-label="教师讲解画面" style={style}>
    {c?.visible&&url&&<img className="runtime-teacher-figure" src={url} alt="金老师" data-pose={c.pose} width={160} height={220}/>}
    <div className="runtime-teacher-board" aria-label="教学黑板">{cue.stage.blackboard.map(e=><div key={e.id} data-blackboard-type={e.type} data-tone={e.tone}
      style={{position:'absolute',left:`${e.x}%`,top:`${e.y}%`,width:`${e.width}%`,minHeight:`${e.height}%`,textAlign:e.align,fontSize:`clamp(12px, ${e.fontSize/18}vw, ${e.fontSize}px)`,fontWeight:e.fontWeight}}>
      {e.type==='bullets'?<ul>{e.content.split(/\n|\\n/).filter(Boolean).map((line,i)=><li key={i}>{line}</li>)}</ul>:<p>{e.content}</p>}
      {e.translation&&<small>{e.translation}</small>}
    </div>)}</div>
  </div>;
}

/** One scoped presentation owner; RuntimeContext owns Step/targets/learning. */
export function TeacherExecutor() {
  const services=useRuntimeServices(),{steps,targets,setPlaybackOwner}=useLearningState(),port=services.teacherRuntime;
  const timeline=useMemo(()=>port?new TeacherTimeline(port,{
    current:()=>!steps.lease().signal.aborted&&steps.manifest.blocks.some(b=>b.type==='compat.teacher.v1'&&b.stepId===steps.activeStepId),
    task:cue=>{const ref=steps.manifest.teachingRefs[0];setPlaybackOwner(cue?.task?{
      kind:'authorized-browser-tts-owner/1',target:cue.task.target,snapshotId:steps.manifest.snapshot.id,
      teachingRevision:ref.revision,utteranceId:cue.cue,generation:steps.generation,
    }:null);},
    command:async(source,target,command,signal)=>{signal.throwIfAborted();await targets.command(target,command);signal.throwIfAborted();port.witness?.(source,target,command,targets.commandOwnerCount(target,command));},
  }):null,[port,steps,targets,setPlaybackOwner]);
  if(!timeline)return <p role="alert">教师执行服务尚未接通。</p>;
  return <MountedTeacher timeline={timeline}/>;
}
function MountedTeacher({timeline}:{timeline:TeacherTimeline}) {
  const state=useSyncExternalStore(timeline.subscribe,timeline.snapshot,timeline.snapshot),{steps}=useLearningState();
  useEffect(()=>{const off=steps.onDispose(()=>timeline.stop());return()=>{off();timeline.dispose();};},[timeline,steps]);
  const cue=state.cue,waiting=['feedback','awaiting-answer','remediation'].includes(state.phase);
  return <section className="runtime-card runtime-teacher-executor" aria-label="金老师讲解" data-teacher-phase={state.phase}>
    <h2>金老师</h2>
    {cue&&<><TeacherStage cue={cue} url={state.characterUrl}/><p className="runtime-teacher-caption">{cue.text}</p></>}
    <div className="runtime-teacher-controls">
      {['idle','error'].includes(state.phase)?<button type="button" onClick={()=>void timeline.start()}>开始讲解</button>:<>
        {state.phase!=='completed'&&<button type="button" onClick={()=>void (state.phase==='paused'?timeline.resume():timeline.pause())}>{state.phase==='paused'?'继续播放':'暂停讲解'}</button>}
        <button type="button" onClick={()=>timeline.stop()}>停止讲解</button>
      </>}
      {waiting&&cue?.awaitingAnswer?cue.questionOptions.map(option=><button key={option} type="button" onClick={()=>void timeline.answer(option)}>{option}</button>):waiting&&<button type="button" onClick={()=>void timeline.next()}>{cue?.continueLabel||'继续'}</button>}
      {state.phase==='awaiting-task'&&<><p>{cue?.task?.instruction}</p><button type="button" onClick={()=>void timeline.task()}>听老师指定的表达</button></>}
    </div>
    {state.phase==='completed'&&<p role="status">本次讲解结束，不代表学习活动已完成。</p>}
    {state.error&&<p role="alert">{state.error}</p>}
  </section>;
}
