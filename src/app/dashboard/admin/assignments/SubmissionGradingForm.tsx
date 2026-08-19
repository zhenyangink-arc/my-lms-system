"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";

import {
  gradeLearningSubmissionAction,
  releaseLearningSubmissionGradeAction,
} from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  createLearningGradingCommentAction,
  deleteLearningGradingCommentAction,
  updateLearningGradingCommentAction,
} from "./grading-actions";

type RubricKind = "speaking" | "writing";
type RubricScores = Record<string, number>;
type AnswerForGrading = {
  id: string;
  index: number;
  maxPoints: number;
  awardedPoints: number | null;
  feedback: string | null;
  autoGraded: boolean;
  languageSkill: string;
  rubricScores: RubricScores | null;
};
type GradingComment = { id: string; content: string };

const RUBRICS: Record<RubricKind, { key: string; label: string; max: number }[]> = {
  speaking: [
    { key: "pronunciation_accuracy", label: "发音准确度", max: 4 },
    { key: "fluency", label: "流利度", max: 4 },
    { key: "grammar_vocabulary", label: "语法和词汇", max: 4 },
    { key: "task_completion", label: "任务完成度", max: 3 },
  ],
  writing: [
    { key: "content_completeness", label: "内容完整性", max: 4 },
    { key: "grammar_accuracy", label: "语法准确度", max: 4 },
    { key: "vocabulary_use", label: "词汇运用", max: 3 },
    { key: "organization_expression", label: "结构与表达", max: 2 },
    { key: "spelling_format", label: "拼写与格式", max: 2 },
  ],
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

function rubricKindFor(answer: AnswerForGrading): RubricKind | null {
  if (answer.autoGraded) return null;
  if (answer.languageSkill === "speaking" || answer.languageSkill === "writing") {
    return answer.languageSkill;
  }
  return null;
}

function CommentEditor({ comment }: { comment: GradingComment }) {
  const updateAction = updateLearningGradingCommentAction.bind(null, comment.id);
  const deleteAction = deleteLearningGradingCommentAction.bind(null, comment.id);
  const [updateState, updateFormAction, updatePending] = useActionState(updateAction, initialLearningAssignmentActionState);
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAction, initialLearningAssignmentActionState);
  return (
    <li className="app-soft-card rounded-xl border p-3">
      <form action={updateFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold">
          评语内容
          <input name="content" defaultValue={comment.content} maxLength={500} required className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-3 py-2 text-sm ${focusClass}`} />
        </label>
        <button type="submit" disabled={updatePending || deletePending} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${focusClass}`}>
          <Pencil size={14} aria-hidden="true" />{updatePending ? "保存中…" : "保存"}
        </button>
      </form>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p role={updateState.status === "error" || deleteState.status === "error" ? "alert" : "status"} aria-live="polite" className="min-h-4 text-xs font-semibold" style={{ color: updateState.status === "error" || deleteState.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>
          {deleteState.message || updateState.message}
        </p>
        <form action={deleteFormAction} onSubmit={(event) => { if (!window.confirm("确定删除这条常用评语吗？")) event.preventDefault(); }}>
          <button type="submit" disabled={deletePending || updatePending} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${focusClass}`} style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }}>
            <Trash2 size={14} aria-hidden="true" />{deletePending ? "删除中…" : "删除"}
          </button>
        </form>
      </div>
    </li>
  );
}

function CommonCommentLibrary({ comments, onSelect }: { comments: GradingComment[]; onSelect: (content: string) => void }) {
  const [createState, createFormAction, createPending] = useActionState(createLearningGradingCommentAction, initialLearningAssignmentActionState);
  return (
    <section className="app-soft-card rounded-2xl border p-4">
      <CardTitleWithHint
        title="常用评语"
        description="点击评语可填入总体评语；展开管理区后可以新增、修改或删除本机构的评语。"
        headingLevel={4}
        titleClassName="text-sm font-semibold"
        hintLabel="查看常用评语使用说明"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {comments.map((comment) => (
          <button key={comment.id} type="button" onClick={() => onSelect(comment.content)} className={`app-card min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${focusClass}`}>
            {comment.content}
          </button>
        ))}
        {comments.length === 0 && <p className="app-muted-text text-xs">暂时没有常用评语，可在下方新增。</p>}
      </div>
      <details className="mt-3 rounded-xl border border-dashed p-3">
        <summary className={`min-h-11 cursor-pointer py-2 text-xs font-semibold ${focusClass}`}>管理常用评语</summary>
        <div className="mt-3 space-y-3">
          <form action={createFormAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-semibold">
              新评语
              <input name="content" maxLength={500} required placeholder="输入本机构常用评语" className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-3 py-2 text-sm ${focusClass}`} />
            </label>
            <button type="submit" disabled={createPending} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white disabled:opacity-50 ${focusClass}`}>
              <Plus size={14} aria-hidden="true" />{createPending ? "新增中…" : "新增"}
            </button>
          </form>
          {createState.message && <p role={createState.status === "error" ? "alert" : "status"} aria-live="polite" className="text-xs font-semibold" style={{ color: createState.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{createState.message}</p>}
          <ul className="space-y-2">{comments.map((comment) => <CommentEditor key={comment.id} comment={comment} />)}</ul>
        </div>
      </details>
    </section>
  );
}

function GradeReleaseAction({ submissionId, confirmedAt }: { submissionId: string; confirmedAt: string | null }) {
  const action = releaseLearningSubmissionGradeAction.bind(null, submissionId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  return (
    <form action={formAction} className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>
      <CardTitleWithHint
        title="确认发布成绩"
        description="确认后，当前总分与评语将立即发布；若任务设置了未来公开时间，则会在该时间自动向学生显示。"
        headingLevel={4}
        titleClassName="text-sm font-semibold"
        hintLabel="查看成绩发布规则"
      />
      <button type="submit" disabled={pending || Boolean(confirmedAt)} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`} style={{ backgroundColor: "var(--status-success)" }}>
        <Send size={16} aria-hidden="true" />{confirmedAt ? "已确认发布" : pending ? "发布中…" : "确认发布成绩"}
      </button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-2 text-xs font-semibold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{state.message}</p>}
    </form>
  );
}

export function SubmissionGradingForm({
  submissionId,
  submissionState,
  releaseConfirmedAt,
  answers,
  comments,
}: {
  submissionId: string;
  submissionState: string;
  releaseConfirmedAt: string | null;
  answers: AnswerForGrading[];
  comments: GradingComment[];
}) {
  const action = gradeLearningSubmissionAction.bind(null, submissionId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [rubricValues, setRubricValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    for (const answer of answers) {
      const kind = rubricKindFor(answer);
      if (!kind) continue;
      for (const criterion of RUBRICS[kind]) {
        values[`${answer.id}_${criterion.key}`] = String(answer.rubricScores?.[criterion.key] ?? 0);
      }
    }
    return values;
  });
  const autoAnswers = answers.filter((answer) => answer.autoGraded);
  const manualAnswers = answers.filter((answer) => !answer.autoGraded);
  const autoGradedScore = autoAnswers.reduce((total, answer) => total + Number(answer.awardedPoints ?? 0), 0);
  const manualAnswerLabels = manualAnswers.map((answer) => `第 ${answer.index} 题`).join("、");
  const isReleased = submissionState === "grade_released";

  const rubricTotals = Object.fromEntries(manualAnswers.map((answer) => {
    const kind = rubricKindFor(answer);
    const total = kind ? RUBRICS[kind].reduce((sum, criterion) => sum + (Number(rubricValues[`${answer.id}_${criterion.key}`]) || 0), 0) : 0;
    return [answer.id, total];
  }));

  return (
    <aside className="space-y-4">
      <form action={formAction} className="app-soft-card rounded-2xl border p-4">
        <CardTitleWithHint
          title="主观题评分"
          description="先完成所有主观题评分并保存，再使用下方独立按钮确认发布最终成绩。"
          headingLevel={4}
          titleClassName="text-sm font-semibold"
          hintLabel="查看批改与发布流程"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl px-3 py-2" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>
            <p className="text-xs font-semibold">客观题暂定成绩</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{autoGradedScore} 分</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs font-semibold">待批改主观题</p>
            <p className="app-muted-text mt-1 text-xs leading-5">{manualAnswerLabels || "无"}</p>
          </div>
        </div>

        {autoAnswers.map((answer) => <span key={answer.id}><input type="hidden" name={`score_${answer.id}`} value={answer.awardedPoints ?? 0} /><input type="hidden" name={`feedback_${answer.id}`} value={answer.feedback ?? ""} /></span>)}
        <div className="mt-3 space-y-3">
          {manualAnswers.map((answer) => {
            const kind = rubricKindFor(answer);
            return (
              <fieldset key={answer.id} className="app-card rounded-xl border p-3">
                <legend className="px-1 text-xs font-semibold">第 {answer.index} 题评分</legend>
                {kind ? (
                  <>
                    <input type="hidden" name={`rubric_kind_${answer.id}`} value={kind} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {RUBRICS[kind].map((criterion) => {
                        const inputId = `rubric-${answer.id}-${criterion.key}`;
                        return (
                          <label key={criterion.key} htmlFor={inputId} className="text-xs font-semibold">
                            {criterion.label}（满分 {criterion.max}）
                            <input id={inputId} name={`rubric_${answer.id}_${criterion.key}`} type="number" inputMode="decimal" min={0} max={criterion.max} step="0.5" required value={rubricValues[`${answer.id}_${criterion.key}`]} onChange={(event) => setRubricValues((current) => ({ ...current, [`${answer.id}_${criterion.key}`]: event.target.value }))} className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-2 py-2 text-sm ${focusClass}`} />
                          </label>
                        );
                      })}
                    </div>
                    <output className="mt-3 flex min-h-11 items-center justify-between rounded-lg bg-[var(--surface-soft)] px-3 text-xs font-semibold" aria-live="polite">
                      <span>本题总得分</span><span className="tabular-nums">{rubricTotals[answer.id]} / {answer.maxPoints} 分</span>
                    </output>
                  </>
                ) : (
                  <label className="text-xs font-semibold">
                    本题得分
                    <input name={`score_${answer.id}`} type="number" inputMode="decimal" min={0} max={answer.maxPoints} step="0.5" required defaultValue={answer.awardedPoints ?? 0} className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-2 py-2 text-sm ${focusClass}`} />
                  </label>
                )}
                <label className="mt-3 block text-xs font-semibold">
                  单题评语
                  <input name={`feedback_${answer.id}`} maxLength={2000} defaultValue={answer.feedback ?? ""} placeholder="可选" className={`app-input mt-1.5 min-h-11 w-full rounded-lg border px-3 py-2 text-sm ${focusClass}`} />
                </label>
              </fieldset>
            );
          })}
        </div>
        {manualAnswers.length === 0 && <p className="app-muted-text mt-3 rounded-xl border border-dashed px-3 py-4 text-center text-xs">本次提交没有需要人工评分的题目。</p>}
        <label className="mt-3 block text-xs font-semibold">
          总体评语
          <textarea name="overall_feedback" maxLength={3000} rows={4} value={overallFeedback} onChange={(event) => setOverallFeedback(event.target.value)} placeholder="总结完成情况；退回重做时必须写明原因。" className={`app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-base leading-6 sm:text-sm ${focusClass}`} />
        </label>
        {state.message && <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-3 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{state.message}</p>}
        {!isReleased && <div className="mt-3 flex flex-wrap gap-2">
          <button name="decision" value="graded" disabled={pending} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50 ${focusClass}`} style={{ backgroundColor: "var(--status-success)" }}><CheckCircle2 size={14} aria-hidden="true" />{pending ? "保存中…" : "完成并保存批改"}</button>
          <button name="decision" value="revision_required" disabled={pending} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${focusClass}`} style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }}><RotateCcw size={14} aria-hidden="true" />退回重做</button>
        </div>}
        {isReleased && <p className="mt-3 text-xs font-semibold text-[var(--status-success)]">成绩已经发布，批改内容已锁定。</p>}
      </form>

      <CommonCommentLibrary comments={comments} onSelect={setOverallFeedback} />
      {submissionState === "grading_completed" && <GradeReleaseAction submissionId={submissionId} confirmedAt={releaseConfirmedAt} />}
    </aside>
  );
}
