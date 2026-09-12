'use client';
import {useOperationLease} from './operation-lease';
import { useEffect,useState } from 'react';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';
import { activityExecutionSchema,type ActivityExecution,type ActivityResponse } from '../core/activity';
import type { ActivityResult } from '../core/services';
import { useLearningState,useRuntimeServices } from './runtime-context';
import { activityPageSchema,type ActivityPage } from '../core/activity-pages';
import { ActivityPageExecutor } from './activity-page-executor';
import { OpenActivityExecutor } from './open-activity-executor';
import { patternExecutionSchema,type PatternExecution } from '../core/patterns';
import { PatternExecutor } from './pattern-executor';
import type {LearningRestore} from '../core/learning-flow';
import {restoredActivity,acceptLearningRestore} from '../core/learning-flow';
import type {ReactNode} from 'react';
import type {LearningPanel} from '../core/services';
import {LearningPanelOwner} from './learning-panel';
import {flushSync} from 'react-dom';

export function ActivityForm({activity,restore=null,feedback=null,onResult}:{activity:ActivityExecution;restore?:ActivityResponse|null;feedback?:ActivityResult|null;onResult?:(result:ActivityResult)=>void}){
  const operationLease=useOperationLease();
  const services=useRuntimeServices(),{steps}=useLearningState();
  const [values,setValues]=useState<Map<string,string>>(()=>new Map(restore?.kind==='choice-group'||restore?.kind==='fill-group'?restore.items.map(i=>[i.partId,'optionId'in i?i.optionId:i.text]):[])),[selected,setSelected]=useState<string[]>(restore?.kind==='single'?[restore.optionId]:restore?.kind==='multiple'||restore?.kind==='ordering'?restore.optionIds:[]),[pending,setPending]=useState(false),[result,setResult]=useState<ActivityResult|null>(feedback),[error,setError]=useState('');
  const [cardId,setCard]=useState(activity.kind==='choice-group'?activity.items[0]?.id:null);
  if(activity.kind==='unavailable')return <p role="status">{activity.title}：{activity.reason}</p>;
  if(activity.kind==='writing'||activity.kind==='self-check')return <OpenActivityExecutor activity={activity} restore={restore} feedback={feedback} onResult={onResult}/>;
  const set=(id:string,value:string)=>setValues(old=>new Map(old).set(id,value));
  const submit=async()=>{
    if(pending||!services.activities)return;const lease=operationLease();setPending(true);setError('');
    let response:ActivityResponse;
    switch(activity.kind){
      case 'single':response={kind:'single',optionId:selected[0]??''};break;
      case 'multiple':case 'ordering':response={kind:activity.kind,optionIds:selected};break;
      case 'choice-group':response={kind:'choice-group',items:activity.items.map(i=>({partId:i.id,optionId:values.get(i.id)??''}))};break;
      case 'fill-group':response={kind:'fill-group',items:activity.items.map(i=>({partId:i.id,text:values.get(i.id)??''}))};break;
    }
    try{const r=await services.activities.submit(activity.ref,response,lease.signal);if(steps.isCurrent(lease)){setResult(r);onResult?.(r);}}
    catch{if(steps.isCurrent(lease))setError('提交未成功，请检查每项作答后重试。');}
    finally{if(steps.isCurrent(lease))setPending(false);}
  };
  return <form className="runtime-card" onSubmit={e=>{e.preventDefault();void submit();}}>
    <CardTitleWithHint title={activity.title} description={activity.instruction} headingLevel={3}/>
    {services.learningFlow&&activity.kind==='choice-group'&&<div role="group" aria-label="题目定位">{activity.items.map((i,n)=><button type="button" key={i.id} aria-pressed={cardId===i.id} onClick={()=>setCard(i.id)}>第 {n+1} 项{values.has(i.id)?' · 已作答':''}</button>)}</div>}
    <fieldset disabled={pending}><legend className="sr-only">{activity.title}</legend>
      {activity.kind==='choice-group'?activity.items.filter(item=>!services.learningFlow||item.id===cardId).map(item=><fieldset key={item.id}><legend>{item.prompt}</legend>{item.options.map(o=><label key={o.id}><input type="radio" name={item.id} checked={values.get(item.id)===o.id} onChange={()=>set(item.id,o.id)}/>{o.text}</label>)}</fieldset>):activity.kind==='fill-group'?activity.items.map(item=><label key={item.id}>{item.prompt}<input value={values.get(item.id)??''} placeholder={item.placeholder} onChange={e=>set(item.id,e.target.value)}/></label>):activity.kind==='ordering'?<><ol>{selected.map(id=><li key={id}><button type="button" onClick={()=>setSelected(s=>s.filter(x=>x!==id))}>{activity.options.find(o=>o.id===id)?.text}（移除）</button></li>)}</ol>{activity.options.map(o=><button type="button" key={o.id} disabled={selected.includes(o.id)} onClick={()=>setSelected(s=>[...s,o.id])}>{o.text}</button>)}</>:activity.options.map(o=><label key={o.id}><input type={activity.kind==='single'?'radio':'checkbox'} name={activity.ref} checked={selected.includes(o.id)} onChange={()=>setSelected(s=>activity.kind==='single'?[o.id]:s.includes(o.id)?s.filter(x=>x!==o.id):[...s,o.id])}/>{o.text}</label>)}
      <button type="submit">{pending?'正在检查…':'检查作答'}</button>
    </fieldset>
    {error&&<p role="alert">{error}</p>}{result&&<div role="status"><p>{result.explanation}</p><p>{result.ok?(result.correct===true?'回答正确':result.correct===false?'请再检查':'已提交'):'提交未通过'}</p>{result.preview&&<p>预览检查，不计入正式进度。</p>}</div>}
  </form>;
}
export function ActivityExecutor({capsuleRef,externallyExecutedRefs=[],renderExternal,panels=[]}:{capsuleRef:string;externallyExecutedRefs?:string[];renderExternal?:(ref:string)=>ReactNode;panels?:LearningPanel[]}){
  const operationLease=useOperationLease();
  const services=useRuntimeServices(),{steps,targets,refresh,server}=useLearningState();const [activities,setActivities]=useState<ActivityExecution[]>([]),[error,setError]=useState('');
  const [restore,setRestore]=useState<LearningRestore|null>(null),[activeRef,setActive]=useState<string|null>(null),[accepted,setAccepted]=useState<Set<string>>(()=>new Set());
  const [pages,setPages]=useState<ActivityPage[]>([]);
  const [patterns,setPatterns]=useState<PatternExecution[]>([]);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{if(!services.activities)return;const lease=operationLease();let mounted=true;
    Promise.all([services.activities.load(capsuleRef,lease.signal),services.pages?.load(capsuleRef,lease.signal)??[],services.patterns?.load(capsuleRef,lease.signal)??[],services.learningFlow?.restore(capsuleRef,lease.signal)??null]).then(([rows,pageRows,patternRows,saved])=>{if(mounted&&steps.isCurrent(lease)){setActivities(rows.map(row=>activityExecutionSchema.parse(row)));setPages(pageRows.map(row=>activityPageSchema.parse(row)));setPatterns(patternRows.map(row=>patternExecutionSchema.parse(row)));if(saved){const r=acceptLearningRestore(saved,services.context.snapshotId,capsuleRef);setRestore(r);const done=new Set([...r.activities.filter(a=>a.completed).map(a=>a.activityRef),...r.practiceAcceptedRefs]);setAccepted(done);setActive(rows.find(a=>!done.has(a.ref))?.ref??rows.at(-1)?.ref??null);}setLoaded(true);}}).catch(()=>{if(mounted&&steps.isCurrent(lease))setError('活动暂不可用，请重新加载。');});return()=>{mounted=false;};
  },[services,capsuleRef,steps]);
  async function activate(ref:string,signal:AbortSignal){
    if(!services.learningFlow)throw Error('ACTIVITY_FLOW_UNAVAILABLE');
    const restored=await services.learningFlow.restore(capsuleRef,signal);signal.throwIfAborted();
    flushSync(()=>{setRestore(acceptLearningRestore(restored,services.context.snapshotId,capsuleRef));setActive(ref);});
  }
  useEffect(()=>{
    if(!loaded||!services.learningFlow)return;
    const entries=[...panels.filter(p=>p.activityRefs.length).map(p=>({partId:p.partId,ref:p.activityRefs[0]})),...pages.flatMap(p=>[p.pageId,...p.items.map(i=>i.partId)].map(partId=>({partId,ref:p.activityRef})))];
    const off=entries.flatMap(e=>{const t=steps.manifest.runtimeTargets.find(t=>t.stepId===steps.activeStepId&&t.partId===e.partId);return t?[targets.prepare(t.id,s=>activate(e.ref,s))]:[];});return()=>off.forEach(f=>f());
  },[loaded,services,panels,pages,targets,steps,capsuleRef]);
  if(services.activities&&!loaded)return <p role={error?'alert':'status'}>{error||'正在加载练习…'}</p>;
  if(services.learningFlow){
    const current=activities.find(a=>a.ref===activeRef),position=activities.findIndex(a=>a.ref===activeRef);
    const result=(r:ActivityResult)=>{if(r.ok&&r.correct!==false)setAccepted(old=>new Set(old).add(current!.ref));if(!r.preview)void refresh().catch(()=>setError('正式状态刷新失败，请重新加载。'));};
    const change=(ref:string)=>{const lease=operationLease();services.learningFlow!.restore(capsuleRef,lease.signal).then(r=>{if(steps.isCurrent(lease)){setRestore(acceptLearningRestore(r,services.context.snapshotId,capsuleRef));setActive(ref);}}).catch(()=>{if(steps.isCurrent(lease))setError('恢复失败，请重试。');});};
    const pattern=patterns.find(p=>p.ref===current?.ref);
    const body=<section aria-label="本步骤练习流程">
      <div role="group" aria-label="子活动">{activities.map((a,n)=><button type="button" key={a.ref} aria-pressed={a.ref===activeRef} onClick={()=>change(a.ref)}>练习 {n+1}{server.activityProgress.some(x=>x.activityRef===a.ref&&x.completed)?' · 已完成':accepted.has(a.ref)?' · 已检查':''}</button>)}</div>
      {error&&<p role="alert">{error}</p>}{current&&<div key={current.ref}>
        {externallyExecutedRefs.includes(current.ref)?renderExternal?.(current.ref):pattern?<PatternExecutor activity={pattern} capsuleRef={capsuleRef} restored={restore?.patterns.find(p=>p.activityRef===current.ref)?.responses} onResult={result}/>:pages.some(p=>p.activityRef===current.ref)?<ActivityPageExecutor pages={pages.filter(p=>p.activityRef===current.ref)} capsuleRef={capsuleRef} restored={restore?.pages} onResult={result}/>:<ActivityForm activity={current} restore={restoredActivity(restore,current.ref)} feedback={restore?.activities.find(a=>a.activityRef===current.ref)?.feedback} onResult={result}/>}
      </div>}
      <div role="group" aria-label="练习顺序"><button type="button" disabled={position<=0} onClick={()=>change(activities[position-1].ref)}>上一练习</button><button type="button" disabled={position<0||position>=activities.length-1||!accepted.has(activeRef!)} onClick={()=>change(activities[position+1].ref)}>继续下一练习</button></div>
      <p>已检查不等于正式完成；正式完成状态只来自服务器。</p>
    </section>;
    const panel=panels.find(p=>p.activityRefs.includes(activeRef??''));
    return panel?<LearningPanelOwner panel={panel}>{body}</LearningPanelOwner>:body;
  }
  return <>{error&&<p role="alert">{error}</p>}{activities.filter(a=>!externallyExecutedRefs.includes(a.ref)).map(a=>{const pattern=patterns.find(p=>p.ref===a.ref);return pattern?<PatternExecutor key={a.ref} capsuleRef={capsuleRef} activity={pattern}/>:pages.some(p=>p.activityRef===a.ref)?<ActivityPageExecutor key={a.ref} capsuleRef={capsuleRef} pages={pages.filter(p=>p.activityRef===a.ref)}/>:<ActivityForm key={a.ref} activity={a}/>;})}</>;
}
