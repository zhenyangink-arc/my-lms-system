"use client";

import { useActionState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { gradeLearningSubmissionAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";

type AnswerForGrading = { id: string; index: number; maxPoints: number; awardedPoints: number | null; feedback: string | null };
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

export function SubmissionGradingForm({ submissionId, answers }: { submissionId: string; answers: AnswerForGrading[] }) {
  const action = gradeLearningSubmissionAction.bind(null, submissionId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  return (
    <form action={formAction} className="app-soft-card rounded-2xl border p-4">
      <h4 className="text-xs font-semibold">逐题评分</h4>
      <div className="mt-3 space-y-3">{answers.map((answer) => <div key={answer.id} className="app-card grid gap-2 rounded-xl border p-3 sm:grid-cols-[120px_1fr]"><label className="text-xs font-semibold">第 {answer.index} 题得分<input name={`score_${answer.id}`} type="number" min={0} max={answer.maxPoints} step="0.5" required defaultValue={answer.awardedPoints ?? 0} className={`app-input mt-1.5 w-full rounded-lg border px-2 py-2 text-sm ${focusClass}`} /></label><label className="text-xs font-semibold">单题评语<input name={`feedback_${answer.id}`} maxLength={2000} defaultValue={answer.feedback ?? ""} placeholder="可选" className={`app-input mt-1.5 w-full rounded-lg border px-3 py-2 text-xs ${focusClass}`} /></label></div>)}</div>
      <label className="mt-3 block text-xs font-semibold">总体评语<textarea name="overall_feedback" maxLength={3000} rows={4} placeholder="总结完成情况；退回重做时必须写明原因。" className={`app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-xs leading-5 ${focusClass}`} /></label>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-3 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button name="decision" value="graded" disabled={pending} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 ${focusClass}`} style={{ backgroundColor: "var(--status-success)" }}><CheckCircle2 size={14} aria-hidden="true" />{pending ? "保存中…" : "完成批改"}</button><button name="decision" value="revision_required" disabled={pending} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${focusClass}`} style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }}><RotateCcw size={14} aria-hidden="true" />退回重做</button></div>
    </form>
  );
}
