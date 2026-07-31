"use client";

import { Dices, Save, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import {
  DifficultyRandomSelector,
  QUESTION_DIFFICULTY_LABELS,
  type QuestionDifficulty,
} from "./DifficultyRandomSelector";
import { replaceChapterTestQuestionsAction } from "./paper-actions";

export type ChapterPoolQuestion = {
  id: string;
  prompt: string;
  options: string[];
  difficulty: QuestionDifficulty;
};

export function ChapterTestRandomPicker({
  testId,
  testTitle,
  questions,
  initialQuestionIds,
}: {
  testId: string;
  testTitle: string;
  questions: ChapterPoolQuestion[];
  initialQuestionIds: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedIds, setSelectedIds] = useState(initialQuestionIds);
  const boundAction = replaceChapterTestQuestionsAction.bind(null, testId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialLearningAssignmentActionState
  );
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const selectedQuestions = selectedIds.flatMap((questionId) => {
    const question = questionMap.get(questionId);
    return question ? [question] : [];
  });

  useEffect(() => {
    if (state.status === "success") dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedIds(initialQuestionIds);
          dialogRef.current?.showModal();
        }}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white"
        style={{ backgroundColor: "var(--app-accent)" }}
      >
        <Dices size={14} />
        一键选题
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[92dvh] w-[min(1080px,calc(100%-2rem))] overflow-hidden rounded-3xl border bg-transparent p-0 shadow-2xl backdrop:bg-black/45"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="app-card max-h-[92dvh] overflow-y-auto rounded-3xl">
          <div
            className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
            style={{
              borderColor: "var(--app-border-soft)",
              backgroundColor: "var(--app-card-bg)",
            }}
          >
            <div>
              <p
                className="text-xs font-black"
                style={{ color: "var(--app-accent)" }}
              >
                章节测试一键选题
              </p>
              <h2 className="mt-1 text-xl font-black">{testTitle}</h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              aria-label="关闭一键选题"
            >
              <X size={18} />
            </button>
          </div>

          <form action={formAction} className="space-y-5 p-5 sm:p-6">
            <input
              type="hidden"
              name="selected_questions_json"
              value={JSON.stringify(selectedIds)}
            />

            <DifficultyRandomSelector
              questions={questions}
              defaultTotal={initialQuestionIds.length || 10}
              onSelected={setSelectedIds}
            />

            <section className="app-soft-card rounded-2xl border p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-black">随机选题结果</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    已选 {selectedQuestions.length} 道；保存前可以反复点击重新随机。
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedQuestions.map((question, index) => (
                  <article
                    key={question.id}
                    className="app-card rounded-2xl border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black">
                        第 {index + 1} 题
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{
                          color: "var(--app-secondary)",
                          backgroundColor: "var(--app-secondary-soft)",
                        }}
                      >
                        {QUESTION_DIFFICULTY_LABELS[question.difficulty]}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold leading-5">
                      {question.prompt}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="rounded-2xl border p-4 text-xs leading-5"
              style={{
                color: "var(--app-warm)",
                backgroundColor: "var(--app-warm-soft)",
                borderColor: "var(--app-warm)",
              }}
            >
              保存后会替换本章学生当前使用的测试题目。已经提交的历史成绩不会改变，尚未开始的新测试立即使用新题目。
            </section>

            {state.message && (
              <p
                className="rounded-xl px-4 py-3 text-xs font-bold"
                style={{
                  color:
                    state.status === "error"
                      ? "#c94f45"
                      : "var(--app-success)",
                  backgroundColor:
                    state.status === "error"
                      ? "#fff0ed"
                      : "var(--app-success-soft)",
                }}
              >
                {state.message}
              </p>
            )}

            <div
              className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"
              style={{ borderColor: "var(--app-border-soft)" }}
            >
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="app-soft-card rounded-xl border px-5 py-3 text-xs font-black"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending || selectedIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                <Save size={14} />
                {pending ? "正在保存…" : "保存并设为当前测试"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
