'use client';
import {useOperationLease} from './operation-lease';

import { useEffect, useRef, useState } from 'react';
import { CardTitleWithHint } from '../../../components/ui/card-title-with-hint';
import { assemblePatternTokens, patternCheckSchema, type PatternExecution, type PatternResponse } from '../core/patterns';
import { useLearningState, useRuntimeServices } from './runtime-context';
import type {ActivityResult} from '../core/services';

function TypedLine({ text, speed }: { text: string; speed: number }) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLength(text.length); return; }
    setLength(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count++; setLength(count);
      if (count >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return <span lang="ko"><span className="sr-only">{text}</span><span aria-hidden="true">{text.slice(0, length)}</span></span>;
}

/** Scoped sequential practice only. The old checker owns correctness; local
 * accepted answers are presentation state, never LearningState completion.
 * Non-preview activation remains blocked until final submission/history ports
 * are integrated; the registry deliberately stays unsupported. */
export function PatternExecutor({ capsuleRef, activity, restored=[],onResult }: { capsuleRef: string; activity: PatternExecution;restored?:PatternResponse[];onResult?:(result:ActivityResult)=>void }) {
  const operationLease=useOperationLease();
  const services = useRuntimeServices(), { steps } = useLearningState();
  const [activeId, setActiveId] = useState<string | null>(restored.length?activity.turns.find(t=>t.kind!=='line'&&!restored.some(r=>r.partId===t.id))?.id??null:activity.turns[0].id);
  const [responses,setResponses]=useState<PatternResponse[]>(restored);
  const [voice,setVoice]=useState(false),[finalResult,setFinalResult]=useState<ActivityResult|null>(null);
  const [accepted, setAccepted] = useState<Map<string, string>>(() => new Map(restored.map(r=>{const t=activity.turns.find(t=>t.id===r.partId);return [r.partId,t?.kind==='choice'&&r.kind==='choice'?t.options.find(o=>o.id===r.optionId)?.text??'':t?.kind==='composition'&&r.kind==='composition'?assemblePatternTokens(t.tokens,r.tokenIds):''];})));
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const current = activity.turns.find(t => t.id === activeId);
  const currentText = current?.kind === 'line' ? current.text : current ? accepted.get(current.id) ?? '' : '';
  const position = activeId === null ? activity.turns.length : activity.turns.findIndex(t => t.id === activeId);
  useEffect(() => () => request.current?.abort(), []);
  const spoken=current?.kind==='composition'?current.prompt:currentText;
  useEffect(()=>{
    if(!voice||!spoken||!current)return;
    const controller=new AbortController(),lease=steps.lease();
    const signal=AbortSignal.any([controller.signal,lease.signal]);
    let audio:HTMLAudioElement|null=null,url:string|null=null,fallenBack=false;
    const fallback=()=>{if(signal.aborted||!steps.isCurrent(lease)||fallenBack)return;fallenBack=true;
      if('speechSynthesis'in window){const utterance=new SpeechSynthesisUtterance(spoken);utterance.lang='ko-KR';utterance.rate=.82;window.speechSynthesis.speak(utterance);}};
    const stop=()=>{controller.abort();if(audio){audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();}if(url){URL.revokeObjectURL(url);url=null;}if('speechSynthesis'in window)window.speechSynthesis.cancel();};
    const off=steps.onDispose(stop);
    void(async()=>{try{
      const blob=activity.kind==='conversation'&&services.patterns?.audio?await services.patterns.audio(capsuleRef,current.id,signal):null;
      if(signal.aborted||!steps.isCurrent(lease))return;
      if(!blob){fallback();return;}
      if(!blob.size||!blob.type.startsWith('audio/'))throw Error('PATTERN_AUDIO_TYPE');
      url=URL.createObjectURL(blob);audio=new Audio(url);audio.onerror=fallback;await audio.play();
    }catch{fallback();}})();
    return()=>{off();stop();};
  },[voice,spoken,current?.id,steps,services.patterns,capsuleRef,activity.kind]);

  useEffect(() => {
    if (!current || !currentText) return;
    const lease = operationLease();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = current.kind === 'composition' ? 520 : current.afterMs + (reduced ? 0 : currentText.length * current.typingSpeedMs);
    const timer = window.setTimeout(() => {
      if (!steps.isCurrent(lease)) return;
      setActiveId(activity.turns[position + 1]?.id ?? null); setSelected([]); setMessage('');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [current, currentText, activity.turns, position, steps]);

  async function check(response: PatternResponse, renderedText: string) {
    if (pending || !services.patterns || (!services.context.trackingDisabled&&!services.learningFlow)) return;
    const lease = operationLease(), controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const signal = AbortSignal.any([lease.signal, controller.signal]);
    setPending(true); setMessage('');
    try {
      const result = patternCheckSchema.parse(await services.patterns.check(capsuleRef, activity.ref, response, signal));
      if (signal.aborted || !steps.isCurrent(lease)) return;
      if (result.activityRef !== activity.ref || result.partId !== response.partId) throw Error('PATTERN_CHECK_SCOPE');
      if (result.correct){setAccepted(old => new Map(old).set(response.partId, renderedText));setResponses(old=>[...old.filter(r=>r.partId!==response.partId),response]);}
      else setMessage('请再检查这一轮作答，正确后对话才会继续。');
    } catch {
      if (!signal.aborted && steps.isCurrent(lease)) setMessage('本轮检查未成功，请重试。');
    } finally {
      if (!signal.aborted && steps.isCurrent(lease)) setPending(false);
    }
  }
  async function finish(){if(pending||!services.learningFlow)return;const lease=operationLease();setPending(true);try{const r=await services.learningFlow.finishPattern(capsuleRef,activity.ref,responses,lease.signal);if(steps.isCurrent(lease)){setFinalResult(r);onResult?.(r);}}catch{if(steps.isCurrent(lease))setMessage('整段提交未成功，请重试。');}finally{if(steps.isCurrent(lease))setPending(false);}}
  if (!services.context.trackingDisabled&&!services.learningFlow) return <p role="status">句型连续练习的正式提交和历史恢复尚未接通。</p>;
  return <section className="runtime-card" aria-label={activity.title}>
    <CardTitleWithHint title={activity.title} description={activity.instruction} headingLevel={3}/>
    {services.learningFlow&&<label><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/>语音朗读（可选）</label>}
    <p>{Math.min(position + 1, activity.turns.length)} / {activity.turns.length}</p>
    <div className="space-y-3" aria-label="本段对话">
      {activity.turns.slice(0, position + 1).map(turn => {
        const answer = accepted.get(turn.id);
        if (turn.kind === 'choice' && !answer) return null;
        const text = turn.kind === 'line' ? turn.text : turn.kind === 'composition' ? turn.prompt : answer!;
        return <div key={turn.id} className={turn.side === 'right' ? 'text-right' : 'text-left'}>
          <p>{turn.speaker}</p>
          <p>{turn.id === activeId && turn.kind !== 'composition' ? <TypedLine key={turn.id} text={text} speed={turn.typingSpeedMs}/> : <span lang="ko">{text}</span>}</p>
          {turn.kind === 'composition' && answer && <p lang="ko" className="text-right">{answer}</p>}
        </div>;
      })}
    </div>
    {current?.kind === 'choice' && !accepted.has(current.id) && <fieldset disabled={pending}>
      <legend>{current.prompt}</legend>
      <div className="flex flex-wrap gap-2">{current.options.map(option => <button className="min-h-11" key={option.id} type="button" onClick={() => void check({ kind: 'choice', partId: current.id, optionId: option.id }, option.text)} lang="ko">{option.text}</button>)}</div>
    </fieldset>}
    {current?.kind === 'composition' && !accepted.has(current.id) && <fieldset disabled={pending}>
      <legend className="sr-only">{current.task}</legend>
      <CardTitleWithHint title={current.task} description={current.hint} headingLevel={4}/>
      <p lang="ko">{assemblePatternTokens(current.tokens, selected)}</p>
      <div className="flex flex-wrap gap-2">{current.tokens.map(token => <button className="min-h-11" type="button" key={token.id} lang="ko" onClick={() => setSelected(ids => [...ids, token.id])}>{token.text}</button>)}</div>
      <button className="min-h-11" type="button" disabled={!selected.length} onClick={() => setSelected([])}>重新排列</button>
      <button className="min-h-11" type="button" disabled={!selected.length} onClick={() => void check({ kind: 'composition', partId: current.id, tokenIds: selected }, assemblePatternTokens(current.tokens, selected))}>加入对话</button>
    </fieldset>}
    {pending && <p role="status">正在检查…</p>}{message && <p role="alert">{message}</p>}
    {activeId === null && <><p role="status">本段练习已结束；预览不产生正式完成或学习进度。</p>{services.learningFlow&&<button type="button" disabled={pending} onClick={()=>void finish()}>提交整段练习</button>}{finalResult&&<p role="status">{finalResult.explanation}</p>}<button type="button" onClick={() => { setActiveId(activity.turns[0].id); setAccepted(new Map()); setResponses([]);setFinalResult(null);setSelected([]); setMessage(''); }}>重新练习</button></>}
  </section>;
}
