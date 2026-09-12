'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts';
import {recordingPlanSchema,recordingCompletionSchema,recordingRestoreSchema,recordingSlots,type RecordingPlan,type RecordingItem,type RecordingCompletionInput} from '../core/recording';
import {useLearningState,useRuntimeServices} from './runtime-context';
import {RuntimeRecordingControl} from './recording-control';
import {RuntimeTarget} from './target';
import {CardTitleWithHint} from '../../../components/ui/card-title-with-hint';

function Target({id,manifest,children}:{id:string;manifest:LessonManifestV1;children:ReactNode}){
  const target=manifest.runtimeTargets.find(t=>t.id===id);if(!target)throw Error('RECORDING_TARGET');return <RuntimeTarget declaration={target}>{children}</RuntimeTarget>;
}
function Practice({plan,manifest}:{plan:RecordingPlan;manifest:LessonManifestV1}){
  const {recording,context}=useRuntimeServices(),{steps,refresh}=useLearningState();
  const [items,setItems]=useState<RecordingItem[]|null>(null),[error,setError]=useState(''),[result,setResult]=useState('');
  const [criteria,setCriteria]=useState<string[]>([]),[outline,setOutline]=useState<Map<string,string>>(()=>new Map());
  const [sceneId,setScene]=useState(plan.kind==='dialogue-roleplay'?plan.scenes[0].id:''),[side,setSide]=useState<'left'|'right'>('left'),[turnId,setTurn]=useState<string|null>(null);
  const [pending,setPending]=useState(false);const submitting=useRef(false),operation=useRef<AbortController|null>(null);
  useEffect(()=>{if(!recording)return;const c=new AbortController(),lease=steps.lease(),cancel=()=>c.abort();lease.signal.addEventListener('abort',cancel,{once:true});
    recording.restore(plan.capsuleRef,plan.activityRef,c.signal).then(raw=>{const restored=recordingRestoreSchema.parse(raw);if(c.signal.aborted||!steps.isCurrent(lease))return;
      // A full-recall recording shares the speaking activity but never its completion.
      const allowed=recordingSlots(plan);if(restored.recordings.some(r=>!manifest.runtimeTargets.some(t=>t.partId===r.partId&&t.blockId===plan.blockId)))throw Error('RESTORE_PART');
      setItems(restored.recordings.filter(r=>allowed.some(s=>s.partId===r.partId)));
      if(plan.kind==='dialogue-roleplay'){
        const scene=plan.scenes.find(s=>s.turns.some(t=>t.partId===restored.currentTurnId));const turn=scene?.turns.find(t=>t.partId===restored.currentTurnId);
        if(scene&&turn){setScene(scene.id);setSide(turn.side);setTurn(null);}
      }
      if(plan.kind!=='full-recall'&&restored.completion!=='none')setResult(context.trackingDisabled?'预览已通过，不计入正式进度。':'服务端已完成。');
    }).catch(()=>{if(!c.signal.aborted)setError('录音状态恢复失败，请重新进入本步骤。');});return()=>{c.abort();operation.current?.abort();lease.signal.removeEventListener('abort',cancel);};
  },[recording,plan,steps,context.trackingDisabled,manifest]);
  const update=(partId:string,item:RecordingItem|null)=>{setItems(old=>[...(old??[]).filter(r=>r.partId!==partId),...(item?[item]:[])]);setResult('');};
  const complete=async(input:RecordingCompletionInput)=>{if(!recording||submitting.current)return;
    if(plan.kind==='speaking-introduction'&&plan.outline.filter(o=>o.choices.some(c=>c.id===outline.get(o.id))).length<plan.minimumOutlineItems){setError(`请先选择至少 ${plan.minimumOutlineItems} 个表达节点。`);return;}
    submitting.current=true;setPending(true);setError('');const lease=steps.lease(),c=new AbortController();operation.current=c;const abort=()=>c.abort();lease.signal.addEventListener('abort',abort,{once:true});
    try{const r=recordingCompletionSchema.parse(await recording.complete(input,c.signal));if(!steps.isCurrent(lease)||c.signal.aborted)return;
      if(context.trackingDisabled&&r.formalCompletion)throw Error('PREVIEW_FORMAL_COMPLETION');setResult(context.trackingDisabled?'预览已通过，不计入正式进度。':r.status==='already-completed'?'服务端已完成，无需重复提交。':'服务端已接收完成。');
      if(!context.trackingDisabled&&(r.formalCompletion||r.status==='already-completed'))await refresh();
    }catch{if(steps.isCurrent(lease)&&!c.signal.aborted)setError('提交未通过，请检查录音时长、勾选项及必需轮次后重试。');}
    finally{lease.signal.removeEventListener('abort',abort);submitting.current=false;if(steps.isCurrent(lease)&&!c.signal.aborted)setPending(false);}
  };
  if(!items)return <p role={error?'alert':'status'}>{error||'正在恢复口语练习…'}</p>;
  const control=(slot:ReturnType<typeof recordingSlots>[number])=><RuntimeRecordingControl key={slot.target} scope={{capsuleRef:plan.capsuleRef,activityRef:plan.activityRef,target:slot.target}} slot={slot} initial={items.find(r=>r.partId===slot.partId)??null} onChange={item=>update(slot.partId,item)}/>;
  return <section className="runtime-card" aria-label={plan.kind==='speaking-introduction'?'独立口语表达':plan.kind==='dialogue-roleplay'?'分角色录音':'完整复现录音'}>
    <CardTitleWithHint title={plan.title} description={plan.instruction} headingLevel={3}/>
    {context.trackingDisabled&&<p role="status">隔离预览：录音最多保留 30 分钟，不写正式学习记录。</p>}
    {plan.kind==='speaking-introduction'?<>
      <p>至少 {plan.requiredCriteria} 项，录音 {plan.slot.minimumSeconds}–{plan.slot.maximumSeconds} 秒。不进行发音评分。</p>
      {plan.outline.map(o=><label key={o.id}>{o.label}<select value={outline.get(o.id)??''} onChange={e=>setOutline(old=>new Map(old).set(o.id,e.target.value))}><option value="">选择表达</option>{o.choices.map(c=><option key={c.id} value={c.id}>{c.text}</option>)}</select></label>)}
      <fieldset disabled={pending}><legend>本次表达包含</legend>{plan.criteria.map(c=><label key={c.id}><input type="checkbox" checked={criteria.includes(c.id)} onChange={()=>setCriteria(old=>old.includes(c.id)?old.filter(id=>id!==c.id):[...old,c.id])}/>{c.text}</label>)}</fieldset>
      <Target manifest={manifest} id={plan.slot.target}>{control(plan.slot)}</Target>
      <button type="button" disabled={pending||!items.some(r=>r.partId===plan.slot.partId&&r.reusable)} onClick={()=>void complete({kind:plan.kind,capsuleRef:plan.capsuleRef,activityRef:plan.activityRef,recordingId:items.find(r=>r.partId===plan.slot.partId)!.id,criteriaIds:criteria})}>{pending?'正在检查…':'提交口语练习'}</button>
    </>:plan.kind==='full-recall'?plan.tracks.map(t=><Target key={t.partId} id={t.target} manifest={manifest}><article><h4>{t.title}</h4>{control(t)}<p>复现录音不代表整个口语活动完成。</p></article></Target>):<>
      <label>场景<select aria-label="场景" value={sceneId} onChange={e=>{setScene(e.target.value);setTurn(null);setResult('');}}>{plan.scenes.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <fieldset><legend>选择角色位置（沿用原左右轮次规则）</legend>{(['left','right'] as const).map(value=><label key={value}><input type="radio" name={`${plan.activityRef}-role`} checked={side===value} onChange={()=>{setSide(value);setTurn(null);setResult('');}}/>{value==='left'?'左侧角色':'右侧角色'}</label>)}</fieldset>
      <RoleTurns key={`${sceneId}:${side}`} scene={plan.scenes.find(s=>s.id===sceneId)!} side={side} items={items} selected={turnId} select={setTurn} control={control} manifest={manifest}/>
      <button type="button" disabled={pending||!plan.scenes.find(s=>s.id===sceneId)!.turns.filter(t=>t.side===side).every(t=>items.some(r=>r.partId===t.partId&&r.reusable))} onClick={()=>void complete({kind:plan.kind,capsuleRef:plan.capsuleRef,activityRef:plan.activityRef,sceneId,side})}>{pending?'正在检查…':'完成角色练习'}</button>
    </>}
    {error&&<p role="alert">{error}</p>}{result&&<p role="status">{result}</p>}
  </section>;
}
function RoleTurns({scene,side,items,selected,select,control,manifest}:{scene:Extract<RecordingPlan,{kind:'dialogue-roleplay'}>['scenes'][number];side:'left'|'right';items:RecordingItem[];selected:string|null;select:(id:string|null)=>void;control:(slot:ReturnType<typeof recordingSlots>[number])=>ReactNode;manifest:LessonManifestV1}){
  const {steps}=useLearningState(),required=scene.turns.filter(t=>t.side===side);
  const current=required.find(t=>t.partId===selected)??required.find(t=>!items.some(r=>r.partId===t.partId&&r.reusable))??required[required.length-1];
  const position=scene.turns.findIndex(t=>t.partId===current.partId),counterpart=position>0?scene.turns[position-1]:null;
  const [speaking,setSpeaking]=useState(false),stop=useRef<()=>void>(()=>{});
  const play=()=>{stop.current();if(typeof SpeechSynthesisUtterance==='undefined'||!window.speechSynthesis||!counterpart)return;
    const lease=steps.lease(),u=new SpeechSynthesisUtterance(counterpart.text);u.lang='ko-KR';u.rate=.82;setSpeaking(true);
    const finish=()=>{if(steps.isCurrent(lease))setSpeaking(false);};u.onend=finish;u.onerror=finish;
    const cancel=()=>{u.onend=null;u.onerror=null;window.speechSynthesis.cancel();lease.signal.removeEventListener('abort',cancel);setSpeaking(false);};
    stop.current=cancel;lease.signal.addEventListener('abort',cancel,{once:true});window.speechSynthesis.speak(u);
  };
  useEffect(()=>()=>stop.current(),[current.partId]);
  return <><p>{scene.context}</p><p>语音识别仅为可选辅助；不支持识别仍可录音，不按浏览器识别结果评分。</p>
    {required.map(t=><button key={t.partId} type="button" onClick={()=>select(t.partId)}>{t.speaker}：{items.some(r=>r.partId===t.partId)?'已录，可重试':'待录'} · {t.text}</button>)}
    {counterpart&&<div><p lang="ko">对方：{counterpart.text}</p><p>{counterpart.translation}</p><button type="button" onClick={play}>{speaking?'重播对方台词':'播放对方台词'}</button></div>}
    <Target id={current.target} manifest={manifest}><h4>你的轮次</h4><p lang="ko">{current.text}</p><p>{current.translation}</p>{control(current)}</Target>
    <button type="button" disabled={!items.some(r=>r.partId===current.partId&&r.reusable)} onClick={()=>select(required[required.findIndex(t=>t.partId===current.partId)+1]?.partId??null)}>下一轮</button>
  </>;
}
export function RecordingExecutor({capsuleRef,manifest,omitFullRecall=false,activityRef}:{capsuleRef:string;manifest:LessonManifestV1;omitFullRecall?:boolean;activityRef?:string}){
  const {recording}=useRuntimeServices(),{steps}=useLearningState(),[plans,setPlans]=useState<RecordingPlan[]>([]),[error,setError]=useState('');
  useEffect(()=>{if(!recording)return;const c=new AbortController(),lease=steps.lease();recording.load(capsuleRef,c.signal).then(rows=>{const values=rows.map(p=>recordingPlanSchema.parse(p));if(values.some(p=>p.capsuleRef!==capsuleRef||p.stepId!==lease.stepId))throw Error('RECORDING_PLAN_SCOPE');if(!c.signal.aborted&&steps.isCurrent(lease))setPlans(values);}).catch(()=>{if(!c.signal.aborted)setError('口语录音服务暂不可用。');});return()=>c.abort();},[recording,capsuleRef,steps]);
  return <>{error&&<p role="alert">{error}</p>}{plans.filter(p=>(!omitFullRecall||p.kind!=='full-recall')&&(!activityRef||p.activityRef===activityRef)).map(p=><Practice key={`${p.kind}:${p.activityRef}`} plan={p} manifest={manifest}/>)}</>;
}
/** Shares the existing track's mounted target; it never saves repeat markers. */
export function FullRecallTrackRecording({plan,trackId}:{plan:Extract<RecordingPlan,{kind:'full-recall'}>;trackId:string}){
  const {recording}=useRuntimeServices(),{steps}=useLearningState(),[item,setItem]=useState<RecordingItem|null|undefined>(),[error,setError]=useState('');
  const slot=plan.tracks.find(t=>t.partId===trackId);if(!slot)throw Error('RECALL_TRACK');
  useEffect(()=>{if(!recording)return;const lease=steps.lease(),c=new AbortController();recording.restore(plan.capsuleRef,plan.activityRef,c.signal).then(raw=>{const state=recordingRestoreSchema.parse(raw);if(!c.signal.aborted&&steps.isCurrent(lease))setItem(state.recordings.find(r=>r.partId===trackId)??null);}).catch(()=>{if(!c.signal.aborted)setError('复现录音恢复失败，请重新进入步骤。');});return()=>c.abort();},[recording,plan,trackId,steps]);
  return <div><h5>完整复现录音</h5><p>只保存本轨复现录音，不改变逐句练习标记或口语完成。</p>{error?<p role="alert">{error}</p>:item===undefined?<p role="status">正在恢复录音…</p>:<RuntimeRecordingControl scope={{capsuleRef:plan.capsuleRef,activityRef:plan.activityRef,target:slot.target}} slot={slot} initial={item} onChange={setItem}/>}</div>;
}
