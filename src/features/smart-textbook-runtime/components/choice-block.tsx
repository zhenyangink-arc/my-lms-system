'use client';
import { useEffect, useState } from 'react';
import type { BlockV1, LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts';
import type { ActivityResult } from '../core/services';
import { useLearningState, useRuntimeServices } from './runtime-context';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';
import {acceptLearningRestore} from '../core/learning-flow';

export function MultipleChoiceBlock({block,manifest}:{block:Extract<BlockV1,{type:'multiple_choice'}>;manifest:LessonManifestV1}){
  const services=useRuntimeServices(),{steps,drafts,server,refresh}=useLearningState();
  const activity=manifest.activityRefs.find(a=>a.id===block.props.activityRef);
  const restored=server.attempts.find(a=>a.activityRef===block.props.activityRef);
  const [selection,setSelection]=useState(drafts.get(block.id)??restored?.selectedOptionId??'');
  const [result,setResult]=useState<ActivityResult|null>(server.attempts.find(a=>a.activityRef===block.props.activityRef)?.result??null);
  const [pending,setPending]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(drafts.has(block.id)||!restored)return;
    if(restored.selectedOptionId&&!activity?.publicPresentation.options.some(o=>o.id===restored.selectedOptionId)){setError('历史选项无法安全恢复。');return;}
    setSelection(restored.selectedOptionId??'');setResult(restored.result);
  },[restored,block.id,drafts,activity]);
  useEffect(()=>{
    if(!services.context.trackingDisabled||!services.learningFlow||restored||drafts.has(block.id))return;
    const capsule=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===block.stepId);
    if(!capsule||capsule.type!=='compat.learning.v1')return;
    const lease=steps.lease();let live=true;
    services.learningFlow.restore(capsule.props.capsuleRef,lease.signal).then(raw=>{
      if(!live||!steps.isCurrent(lease)||drafts.has(block.id))return;
      const saved=acceptLearningRestore(raw,manifest.snapshot.id,capsule.props.capsuleRef).activities.find(a=>a.activityRef===block.props.activityRef);
      if(saved?.response?.kind!=='single'||!saved.feedback?.preview)return;
      const option=saved.response.optionId;if(!activity?.publicPresentation.options.some(o=>o.id===option))throw Error('PREVIEW_OPTION_SCOPE');
      setSelection(option);setResult(saved.feedback);
    }).catch(()=>{if(live&&steps.isCurrent(lease))setError('预览作答暂时无法恢复。');});
    return()=>{live=false;};
  },[services,restored,manifest,block,steps,drafts,activity]);
  if(!activity||activity.type!=='single_choice')throw Error('ACTIVITY_REF_MISMATCH');
  const text=(v:{'zh-CN'?:string;'ko-KR'?:string})=>v[services.context.locale]??v['zh-CN']??v['ko-KR']??'';
  async function submit(){
    if(pending||!selection)return;
    const lease=steps.lease();setPending(true);setError('');
    try{const response=await services.submit(block.props.activityRef,selection,lease.signal);if(steps.isCurrent(lease)){setResult(response);if(!response.preview)await refresh();}}
    catch{if(steps.isCurrent(lease))setError('提交失败，请重试。');}
    finally{if(steps.isCurrent(lease))setPending(false);}
  }
  return <form onSubmit={e=>{e.preventDefault();void submit();}}>
    <fieldset disabled={pending}><legend><CardTitleWithHint title={text(activity.publicPresentation.prompt)} description={activity.publicPresentation.instruction?text(activity.publicPresentation.instruction):undefined} headingLevel={3}/></legend>
      <div className="runtime-choices">{activity.publicPresentation.options.map(option=><label key={option.id}><input type="radio" name={block.id} value={option.id} checked={selection===option.id} onChange={()=>{drafts.set(block.id,option.id);setSelection(option.id);setResult(null);}}/>{text(option.text)}</label>)}</div>
      <button type="submit" disabled={!selection||pending}>{pending?'正在检查…':'提交答案'}</button>
    </fieldset>
    {error&&<p role="alert">{error}</p>}
    {result&&<div role="status" aria-live="polite"><p>{result.explanation}</p><p>{result.ok?(result.correct===true?'回答正确':result.correct===false?'请再想一想':'已收到提交'):'提交未成功'}</p>
      <p>第 {result.attemptNumber} 次{result.preview?'预览检查（不计入正式进度）':'作答'}</p></div>}
  </form>;
}
