"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useActionState } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { submitAssignmentRemediationAction } from "./actions";
import { initialAssignmentRemediationState } from "./action-state";

export type RemediationQuestion = {
  id: string;
  prompt: string;
  options: string[];
  previousAnswer: string;
};

function RemediationQuestionCard({
  question,
  index,
}: {
  question: RemediationQuestion;
  index: number;
}) {
  const action = submitAssignmentRemediationAction.bind(null, question.id);
  const [state, formAction, pending] = useActionState(
    action,
    initialAssignmentRemediationState
  );
  return (
    <form action={formAction} className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-6">{question.prompt}</h3>
          <p className="app-muted-text mt-1 text-xs">
            上次答案：{question.previousAnswer || "未作答"}
          </p>
        </div>
      </div>

      {question.options.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="app-card flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]"
            >
              <input type="radio" name="answer" value={option} required />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <label className="mt-4 block text-xs font-bold">
          再次作答
          <input
            name="answer"
            required
            maxLength={10000}
            className="app-input mt-2 min-h-12 w-full rounded-xl border px-4 text-base sm:text-sm"
          />
        </label>
      )}

      {state.message && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className="mt-3 rounded-xl px-3 py-2.5 text-xs font-bold"
          style={{
            color:
              state.status === "correct"
                ? "var(--status-success)"
                : "var(--status-danger)",
            backgroundColor:
              state.status === "correct"
                ? "var(--status-success-surface)"
                : "var(--status-danger-surface)",
          }}
        >
          {state.message}
          {state.correctAnswer && (
            <p className="mt-1">参考答案：{state.correctAnswer}</p>
          )}
          {state.explanation && (
            <p className="mt-1 font-normal leading-5">{state.explanation}</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || state.status === "correct"}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.status === "correct" ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <RotateCcw size={15} aria-hidden="true" />
        )}
        {state.status === "correct"
          ? "已经掌握"
          : pending
            ? "正在判定…"
            : "提交重练答案"}
      </button>
    </form>
  );
}

export function AssignmentRemediationPractice({
  questions,
}: {
  questions: RemediationQuestion[];
}) {
  if (questions.length === 0) return null;
  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <CardTitleWithHint
        headingLevel={2}
        title="错题重练"
        titleClassName="font-bold"
        description="这里只包含老师已经完成批改的客观错题。第一次答错时不会直接展示答案，第二次仍未答对才会给出参考答案。"
      />
      <div className="mt-4 space-y-3">
        {questions.map((question, index) => (
          <RemediationQuestionCard
            key={question.id}
            question={question}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
