'use client';
import {useOperationLease} from './operation-lease';
import { useEffect,useState } from 'react';
import {flushSync} from 'react-dom';
import {RuntimeTarget} from './target';
import type { ActivityPage,PageCheck,PageResponse } from '../core/activity-pages';
import { useLearningState,useRuntimeServices } from './runtime-context';
import { ListeningPageMedia } from './listening-page-media';
import type {LearningRestore} from '../core/learning-flow';
import type {ActivityResult} from '../core/services';

/** Scoped page checks. Formal attempt/aggregation is still the domain service's
 * responsibility; this executor never marks a Step or activity complete. */
export function ActivityPageExecutor({pages,capsuleRef,restored=[],onResult}:{pages:ActivityPage[];capsuleRef:string;restored?:LearningRestore['pages'];onResult?:(result:ActivityResult)=>void}){
  const operationLease=useOperationLease();
  const {steps,drafts,targets}=useLearningState(),services=useRuntimeServices();
  const [pageId,setPageId]=useState(pages.find(p=>!restored.some(r=>r.pageId===p.pageId&&r.ready))?.pageId??pages.at(-1)!.pageId),[values,setValues]=useState(()=>new Map(pages.flatMap(p=>p.items.map(i=>{const saved=restored.find(r=>r.pageId===p.pageId)?.response.find(r=>r.partId===i.partId);return [i.partId,drafts.get(i.partId)??(saved?.kind==='choice'?saved.optionId:saved?.kind==='fill'?saved.text:'')] as const;})))),[checks,setChecks]=useState<Map<string,PageCheck>>(()=>new Map(restored.filter(r=>r.checked&&pages.some(p=>p.pageId===r.pageId)).map(r=>[r.pageId,{pageId:r.pageId,items:r.items,formalCompletion:false,progressDelta:null}]))),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<ActivityResult|null>(null);
  const page=pages.find(p=>p.pageId===pageId)!;
  const declaration=(partId:string)=>steps.manifest.runtimeTargets.find(t=>t.stepId===steps.activeStepId&&t.partId===partId);
  useEffect(()=>{
    const off=pages.flatMap(p=>[p.pageId,...p.items.map(i=>i.partId)].flatMap(id=>{
      const t=declaration(id);return t?[targets.prepare(t.id,async signal=>{signal.throwIfAborted();flushSync(()=>setPageId(p.pageId));})]:[];
    }));return()=>off.forEach(f=>f());
  },[pages,targets,steps]);
  const set=(partId:string,value:string)=>{drafts.set(partId,value);setValues(v=>new Map(v).set(partId,value));setChecks(c=>{const next=new Map(c);next.delete(pageId);return next;});};
  async function check(){
    if(!services.pages||pending)return;const lease=operationLease();setPending(true);setError('');
    const response:PageResponse=page.items.map(i=>i.kind==='choice'?{kind:'choice',partId:i.partId,optionId:values.get(i.partId)??''}:{kind:'fill',partId:i.partId,text:values.get(i.partId)??''});
    try{const result=await services.pages.check(capsuleRef,pageId,response,lease.signal);if(steps.isCurrent(lease)){if(result.pageId!==pageId||result.formalCompletion!==false||result.progressDelta!==null)throw Error('PAGE_CHECK_SCOPE');setChecks(c=>new Map(c).set(pageId,result));}}
    catch{if(steps.isCurrent(lease))setError('本页检查未成功，请完成作答后重试。');}
    finally{if(steps.isCurrent(lease))setPending(false);}
  }
  async function advance(reveal=false){
    if(!services.learningFlow||pending)return;const lease=operationLease();setPending(true);setError('');
    try{if(reveal){const r=await services.learningFlow.revealPage(capsuleRef,pageId,lease.signal);if(!steps.isCurrent(lease))return;r.response.forEach(i=>drafts.set(i.partId,i.kind==='choice'?i.optionId:i.text));setValues(v=>new Map([...v,...r.response.map(i=>[i.partId,i.kind==='choice'?i.optionId:i.text] as const)]));setChecks(c=>new Map(c).set(pageId,r.check));}
      else {const n=pages.findIndex(p=>p.pageId===pageId);if(n<pages.length-1)setPageId(pages[n+1].pageId);else{const r=await services.learningFlow.finishPages(capsuleRef,page.activityRef,lease.signal);if(steps.isCurrent(lease)){setResult(r);onResult?.(r);}}}
    }catch{if(steps.isCurrent(lease))setError('请先完成并检查所有页面，再继续。');}finally{if(steps.isCurrent(lease))setPending(false);}
  }
  const body=<section className="runtime-card" aria-label={page.title}>
    <h3>{page.title}</h3>
    <div role="group" aria-label="练习页">{pages.map((p,i)=><button type="button" disabled={pending} aria-pressed={p.pageId===pageId} key={p.pageId} onClick={()=>setPageId(p.pageId)}>第 {i+1} 页</button>)}</div>
    {page.listening&&<ListeningPageMedia key={page.pageId} page={page} capsuleRef={capsuleRef} checked={checks.has(pageId)}/>}
    <form onSubmit={e=>{e.preventDefault();void check();}}><fieldset disabled={pending}><legend className="sr-only">{page.title}</legend>
      {page.items.map(item=>{const t=declaration(item.partId);const field=<fieldset><legend>{item.prompt}</legend>{item.kind==='choice'?item.options.map(o=><label key={o.id}><input required type="radio" name={item.partId} checked={values.get(item.partId)===o.id} onChange={()=>set(item.partId,o.id)}/>{o.text}</label>):<input aria-label={item.prompt} required value={values.get(item.partId)??''} placeholder={item.placeholder} onChange={e=>set(item.partId,e.target.value)}/>}
        {checks.get(pageId)?.items.find(i=>i.partId===item.partId)&&<p role="status">{checks.get(pageId)!.items.find(i=>i.partId===item.partId)!.correct?'本题检查正确':'本题请再检查'}</p>}
      </fieldset>;return t?<RuntimeTarget key={item.partId} declaration={t}>{field}</RuntimeTarget>:<div key={item.partId}>{field}</div>;})}<button type="submit">{pending?'正在检查…':'检查本页'}</button>
    </fieldset></form>
    {checks.has(pageId)&&<p role="status">本页检查反馈，不代表正式完成。</p>}{error&&<p role="alert">{error}</p>}
    {services.learningFlow?<><button type="button" disabled={pending||!checks.has(pageId)} onClick={()=>void advance(true)}>查看本页订正</button><button type="button" disabled={pending||!checks.get(pageId)?.items.every(i=>i.correct)} onClick={()=>void advance()}>{pageId===pages.at(-1)!.pageId?'提交整组练习':'检查后继续'}</button>{result&&<p role="status">{result.explanation}{result.preview?'（预览，不计正式进度）':''}</p>}</>:<p>连续练习、正式提交及历史恢复尚未完成验收。</p>}
  </section>;
  const t=declaration(page.pageId);
  return t?<RuntimeTarget key={page.pageId} declaration={t}>{body}</RuntimeTarget>:body;
}
