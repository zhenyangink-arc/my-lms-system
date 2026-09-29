'use client';
import { useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookOpen, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CardTitleWithHint } from '@/components/ui/card-title-with-hint';
import type { PublicSelectionPin } from '../client/selection-state.ts';
import { selectionIdentity } from '../client/selection-state.ts';
import { studentErrorMessage, studentRunBusy, type StudentRunPhase } from '../client/student-ai-teacher-client.ts';
import { useStudentAiTeacherRun } from '../client/use-student-ai-teacher-run.ts';
const action='min-h-11 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50';
const labels:Record<StudentRunPhase,string>={idle:'选择一句课文，让金老师为你讲解。',starting:'正在准备讲解…',resolving:'正在准备讲解…',retrieving:'正在读取本课内容…',answering:'金老师正在整理解释…',cancelling:'正在停止…',recovering:'讲解状态尚未确认，可以稍后再次查看。',completed:'讲解已完成',failed:'这次没有完成讲解',cancelled:'讲解已停止'};
export function StudentAiTeacherIntegration({pins}:{pins:PublicSelectionPin[]}) {
 const pathname=usePathname(),search=useSearchParams();
 const identity=pins.map(selectionIdentity).join(';');
 return <ExplainSegments key={`${pathname}?${search.toString()}|${identity}`} pins={pins}/>;
}
function ExplainSegments({pins}:{pins:PublicSelectionPin[]}) {
 const {state,client}=useStudentAiTeacherRun(),[open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement|null>(null);
 const busy=studentRunBusy(state),locale=pins[0]?.locale??'zh-CN',ko=locale==='ko-KR';
 const text=(zh:string,kr:string)=>ko?kr:zh;
 const koreanLabels:Record<StudentRunPhase,string>={idle:'교재 문장을 선택하면 김 선생님이 설명해 드려요.',starting:'설명을 준비하고 있어요…',resolving:'설명을 준비하고 있어요…',retrieving:'교재 내용을 확인하고 있어요…',answering:'김 선생님이 설명을 정리하고 있어요…',cancelling:'설명을 멈추고 있어요…',recovering:'설명 상태를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.',completed:'설명이 완료되었어요',failed:'설명을 완료하지 못했어요',cancelled:'설명이 중지되었어요'};
 function close(){setOpen(false);if(busy)void client.cancel();requestAnimationFrame(()=>trigger.current?.focus());}
 return <section aria-label={text("课文讲解","교재 설명")} className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-5">
  <CardTitleWithHint headingLevel={2} title={text("课文讲解","교재 설명")} description={text("选择一句已发布的课文，让金老师讲解。讲解不会推进课堂。","교재 문장을 선택하면 김 선생님이 설명해 드려요. 수업 진행 상태는 바뀌지 않아요.")} hintLabel={text("查看详细说明","자세한 설명 보기")} />
  {state.invalidSelection&&<p role="alert" className="mt-3 text-sm text-[var(--foreground-muted)]">{studentErrorMessage(state.error,locale)} {text("请刷新课文后再试。","교재를 새로고침한 후 다시 시도해 주세요.")}</p>}
  <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
   {pins.map(pin=><li key={selectionIdentity(pin)} className="flex flex-col items-start gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="min-w-0 whitespace-pre-wrap break-words text-base leading-7 text-[var(--foreground)]">{pin.displayText}</p>
    <button type="button" className={`${action} shrink-0 bg-[var(--surface-soft)] text-[var(--primary)]`} disabled={busy||state.invalidSelection}
     aria-label={`${text("解释这句话：","이 문장 설명: ")}${pin.displayText}`} onClick={e=>{trigger.current=e.currentTarget;setOpen(true);void client.start(pin);}}>{text("解释这句话","이 문장 설명")}</button>
   </li>)}
  </ul>
  {!open&&busy&&<button type="button" className={`${action} mt-2 text-[var(--primary)]`} onClick={e=>{trigger.current=e.currentTarget;setOpen(true);}}>{text("查看讲解状态","설명 상태 보기")}</button>}
  <Sheet open={open} onOpenChange={value=>{if(!value)close();}}>
   <SheetContent showCloseButton={false} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}} className="z-[100] !w-full !max-w-lg overflow-y-auto bg-[var(--card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[var(--foreground)] motion-reduce:transition-none sm:p-6" finalFocus={trigger}>
    <header className="flex items-start justify-between gap-3">
     <div><SheetTitle className="text-xl font-bold">{text("金老师","김 선생님")}</SheetTitle><SheetDescription className="mt-1 text-[var(--foreground-muted)]">{text("AI 韩语老师 · 为你讲解这句话","AI 한국어 선생님 · 선택한 문장을 설명해 드려요")}</SheetDescription></div>
     <button type="button" aria-label={text("关闭讲解","설명 닫기")} className={`${action} !px-3`} onClick={close}><X size={20} aria-hidden="true"/></button>
    </header>
    {state.selection&&<div className="rounded-xl bg-[var(--surface-soft)] p-4"><p className="mb-2 text-sm text-[var(--foreground-muted)]">{text("你选择的句子","선택한 문장")}</p><p className="whitespace-pre-wrap break-words text-base leading-7">{state.selection.displayText}</p></div>}
    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--foreground-muted)]">{ko?koreanLabels[state.phase]:labels[state.phase]}</p>
    {state.error&&<p role="alert" className="text-sm leading-6">{studentErrorMessage(state.error,locale)}</p>}
    {state.answer&&<article aria-label={text("金老师的解释","김 선생님의 설명")} className="space-y-4">
     <p className="whitespace-pre-wrap break-words text-base leading-8">{state.answer.text}</p>
     {state.answer.sourceRefs.length>0&&<p className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-sm"><BookOpen size={16} aria-hidden="true"/>{text("依据当前课文","현재 교재를 바탕으로 설명해요")}</p>}
     {state.answer.completeness==='partial'&&<p className="text-sm leading-6 text-[var(--foreground-muted)]">{text("本次讲解基于部分可用课程内容。","이번 설명은 확인 가능한 일부 교재 내용을 바탕으로 했어요.")}</p>}
    </article>}
    <div className="mt-auto flex flex-wrap gap-2 pt-4">
     {busy&&state.phase!=='cancelling'&&<button type="button" className={`${action} border border-[var(--border-subtle)]`} onClick={()=>void client.cancel()}>{text("停止讲解","설명 중지")}</button>}
     {state.phase==='recovering'&&<button type="button" className={`${action} bg-[var(--primary)] text-[var(--primary-foreground)]`} onClick={()=>void client.recover()}>{text("重新查看状态","상태 다시 확인")}</button>}
     {state.phase==='failed'&&state.selection&&!state.invalidSelection&&<button type="button" className={`${action} bg-[var(--primary)] text-[var(--primary-foreground)]`} onClick={()=>void client.retry()}>{text("重试","다시 시도")}</button>}
     {(state.phase==='completed'||state.phase==='cancelled')&&state.selection&&<button type="button" className={`${action} bg-[var(--primary)] text-[var(--primary-foreground)]`} onClick={()=>void client.start(state.selection!)}>{text("重新解释","다시 설명")}</button>}
    </div>
   </SheetContent>
  </Sheet>
 </section>;
}
