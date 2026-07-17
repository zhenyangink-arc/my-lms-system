"use client";

import { useActionState } from "react";
import { Link2, Send } from "lucide-react";

import { submitLearningAssignmentAction } from "./actions";
import { initialLearningAssignmentActionState } from "./action-state";
import { QUESTION_TYPE_LABELS, type QuestionType } from "./config";

type Question = { id: string; type: QuestionType; prompt: string; options: string[]; points: number };

export function AssignmentSubmissionForm({ assignmentId, questions, previousAnswers }: { assignmentId: string; questions: Question[]; previousAnswers: Record<string, string> }) {
  const action = submitLearningAssignmentAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  return (
    <form action={formAction} data-permission="learning_assignments" className="space-y-4">
      {questions.map((question, index) => (
        <article key={question.id} className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="app-muted-text text-[10px] font-black">{QUESTION_TYPE_LABELS[question.type]}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{question.points} 分</span></div><h2 className="mt-2 whitespace-pre-wrap text-sm font-black leading-7">{question.prompt}</h2></div></div>
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
            {question.type === "single_choice" ? <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option) => <label key={option} className="app-soft-card flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-bold"><input type="radio" name={`answer_${question.id}`} value={option} defaultChecked={previousAnswers[question.id] === option} required />{option}</label>)}</div> : question.type === "long_text" ? <textarea name={`answer_${question.id}`} required maxLength={10000} rows={8} defaultValue={previousAnswers[question.id] ?? ""} placeholder="在这里填写完整答案" className="app-input w-full resize-y rounded-xl border px-4 py-3 text-sm leading-7" /> : <div className="relative"><input name={`answer_${question.id}`} required maxLength={10000} type={question.type === "file_link" ? "url" : "text"} defaultValue={previousAnswers[question.id] ?? ""} placeholder={question.type === "file_link" ? "粘贴可访问的完整文件链接" : "填写你的答案"} className="app-input w-full rounded-xl border px-4 py-3 pr-10 text-sm" />{question.type === "file_link" && <Link2 className="app-muted-text absolute right-3 top-3" size={17} />}</div>}
          </div>
        </article>
      ))}
      {state.message && <p aria-live="polite" className="rounded-2xl px-4 py-3 text-sm font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><Send size={16} />{pending ? "正在提交…" : "提交全部答案"}</button>
    </form>
  );
}
