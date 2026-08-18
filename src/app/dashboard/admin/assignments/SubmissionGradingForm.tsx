"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { gradeLearningSubmissionAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";

type AnswerForGrading = { id: string; index: number; maxPoints: number; awardedPoints: number | null; feedback: string | null; autoGraded: boolean };
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

export function SubmissionGradingForm({ submissionId, answers }: { submissionId: string; answers: AnswerForGrading[] }) {
  const action = gradeLearningSubmissionAction.bind(null, submissionId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  const [overallFeedback, setOverallFeedback] = useState("");
  const autoGradedCount = answers.filter((answer) => answer.autoGraded).length;
  const autoGradedScore = answers.reduce(
    (total, answer) => total + (answer.autoGraded ? Number(answer.awardedPoints ?? 0) : 0),
    0
  );
  const manualAnswers = answers.filter((answer) => !answer.autoGraded);
  const feedbackTemplates = [
    "整体完成认真，继续保持。",
    "口语内容完整，请继续注意发音和语速。",
    "语法基本正确，请检查词尾和助词使用。",
    "请根据单题评语订正后重新提交。",
  ];
  return (
    <form action={formAction} className="app-soft-card rounded-2xl border p-4">
      <h4 className="text-sm font-semibold">主观题评分</h4>
      {autoGradedCount > 0 && <p className="mt-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>系统已先判 {autoGradedCount} 道客观题，共 {autoGradedScore} 分；下方只需处理主观题。</p>}
      {answers.filter((answer) => answer.autoGraded).map((answer) => <span key={answer.id}><input type="hidden" name={`score_${answer.id}`} value={answer.awardedPoints ?? 0} /><input type="hidden" name={`feedback_${answer.id}`} value={answer.feedback ?? ""} /></span>)}
      <div className="mt-3 space-y-3">{manualAnswers.map((answer) => <div key={answer.id} className="app-card grid gap-2 rounded-xl border p-3 sm:grid-cols-[120px_1fr]"><label className="text-xs font-semibold"><span>第 {answer.index} 题得分</span><input name={`score_${answer.id}`} type="number" min={0} max={answer.maxPoints} step="0.5" required defaultValue={answer.awardedPoints ?? 0} className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-2 py-2 text-sm ${focusClass}`} /></label><label className="text-xs font-semibold">单题评语<input name={`feedback_${answer.id}`} maxLength={2000} defaultValue={answer.feedback ?? ""} placeholder="可选" className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-3 py-2 text-xs ${focusClass}`} /></label></div>)}</div>
      {manualAnswers.length === 0 && <p className="app-muted-text mt-3 rounded-xl border border-dashed px-3 py-4 text-center text-xs">本次提交没有需要人工评分的题目。</p>}
      <div className="mt-3"><p className="text-xs font-semibold">常用评语</p><div className="mt-2 flex flex-wrap gap-2">{feedbackTemplates.map((template) => <button key={template} type="button" onClick={() => setOverallFeedback(template)} className={`app-card min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${focusClass}`}>{template}</button>)}</div></div>
      <label className="mt-3 block text-xs font-semibold">总体评语<textarea name="overall_feedback" maxLength={3000} rows={4} value={overallFeedback} onChange={(event) => setOverallFeedback(event.target.value)} placeholder="总结完成情况；退回重做时必须写明原因。" className={`app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-base leading-6 sm:text-sm ${focusClass}`} /></label>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-3 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button name="decision" value="graded" disabled={pending} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 ${focusClass}`} style={{ backgroundColor: "var(--status-success)" }}><CheckCircle2 size={14} aria-hidden="true" />{pending ? "保存中…" : "完成批改"}</button><button name="decision" value="revision_required" disabled={pending} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${focusClass}`} style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }}><RotateCcw size={14} aria-hidden="true" />退回重做</button></div>
    </form>
  );
}
