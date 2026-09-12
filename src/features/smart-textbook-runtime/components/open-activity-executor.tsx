'use client';
import {useOperationLease} from './operation-lease';
import { useState } from 'react';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';
import type { ActivityExecution,ActivityResponse } from '../core/activity';
import type { ActivityResult } from '../core/services';
import { useLearningState,useRuntimeServices } from './runtime-context';

export function OpenActivityExecutor({activity,restore=null,feedback=null,onResult}:{activity:Extract<ActivityExecution,{kind:'writing'|'self-check'}>;restore?:ActivityResponse|null;feedback?:ActivityResult|null;onResult?:(result:ActivityResult)=>void}){
  const operationLease=useOperationLease();
  const services=useRuntimeServices(),{steps,drafts}=useLearningState();
  const [text,setText]=useState(drafts.get(activity.ref)??(restore?.kind==='writing'?restore.text:restore?.kind==='self-check'?restore.note:'')),[checks,setChecks]=useState<Map<string,boolean|'can'|'review'>>(()=>new Map<string,boolean|'can'|'review'>(restore?.kind==='writing'?restore.information.map(i=>[i.partId,i.checked]):restore?.kind==='self-check'?restore.checks.map(i=>[i.partId,i.value]):[])),[returns,setReturns]=useState<string[]>(restore?.kind==='self-check'?restore.returnTargetIds:[]),[confirmed,setConfirmed]=useState(restore?.kind==='writing'&&restore.rubricConfirmed),[pending,setPending]=useState(false),[result,setResult]=useState<ActivityResult|null>(feedback),[error,setError]=useState('');
  const editText=(value:string)=>{setText(value);drafts.set(activity.ref,value);setResult(null);};
  async function submit(){
    if(!services.activities||pending)return;const lease=operationLease();setPending(true);setError('');
    const response:ActivityResponse=activity.kind==='writing'?{kind:'writing',text,information:activity.checklist.map(i=>({partId:i.id,checked:checks.get(i.id)===true})),rubricConfirmed:confirmed}:{kind:'self-check',checks:activity.items.map(i=>({partId:i.id,value:checks.get(i.id) as 'can'|'review'})),returnTargetIds:returns,note:text};
    try{const result=await services.activities.submit(activity.ref,response,lease.signal);if(steps.isCurrent(lease)){setResult(result);onResult?.(result);}}
    catch{if(steps.isCurrent(lease))setError('提交未成功，请检查作答后重试。');}
    finally{if(steps.isCurrent(lease))setPending(false);}
  }
  return <form className="runtime-card" onSubmit={e=>{e.preventDefault();void submit();}}><CardTitleWithHint title={activity.title} description={activity.instruction} headingLevel={3}/>
    <fieldset disabled={pending}><legend className="sr-only">{activity.title}</legend>
      {activity.kind==='writing'?<>
        <label>个人介绍<textarea required maxLength={10000} value={text} onChange={e=>editText(e.target.value)}/></label>
        {activity.checklist.map(i=><label key={i.id}><input type="checkbox" checked={checks.get(i.id)===true} onChange={e=>setChecks(c=>new Map(c).set(i.id,e.target.checked))}/>{i.text}</label>)}
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{activity.confirmation}</label>
      </>:<>
        {activity.items.map(i=><fieldset key={i.id}><legend>{i.text}</legend>{(['can','review'] as const).map(value=><label key={value}><input required type="radio" name={i.id} checked={checks.get(i.id)===value} onChange={()=>setChecks(c=>new Map(c).set(i.id,value))}/>{value==='can'?'我能做到':'需要复习'}</label>)}</fieldset>)}
        <fieldset><legend>复习去向</legend>{activity.returnTargets.map(i=><label key={i.id}><input type="checkbox" checked={returns.includes(i.id)} onChange={()=>setReturns(s=>s.includes(i.id)?s.filter(x=>x!==i.id):[...s,i.id])}/>{i.text}</label>)}</fieldset>
        <label>学习备注<textarea value={text} maxLength={2000} onChange={e=>editText(e.target.value)}/></label>
      </>}
      <button type="submit">{pending?'正在提交…':'提交作答'}</button>
    </fieldset>{error&&<p role="alert">{error}</p>}{result&&<div role="status"><p>{result.explanation}</p><p>{result.ok?'服务器已接收本次作答。':'提交未通过。'}</p>{result.preview&&<p>预览不产生正式完成或学习进度。</p>}</div>}
  </form>;
}
