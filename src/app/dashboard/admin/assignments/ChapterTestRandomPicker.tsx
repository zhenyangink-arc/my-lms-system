"use client";

import { Check, Dices, Save, X } from "lucide-react";
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
  correctOption: number | null;
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
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--app-accent)] hover:underline"
      >
        <Dices size={12} />
        一键选题
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="ml-auto mr-0 h-dvh max-h-dvh w-full max-w-[1100px] overflow-hidden border-0 border-l bg-transparent p-0 backdrop:bg-black/20"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="app-card flex h-dvh flex-col overflow-hidden">
          <div
            className="z-10 flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
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

          <form
            action={formAction}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6"
          >
            <input
              type="hidden"
              name="selected_questions_json"
              value={JSON.stringify(selectedIds)}
            />

            <DifficultyRandomSelector
              questions={questions}
              defaultTotal={initialQuestionIds.length || 10}
              onSelected={setSelectedIds}
              tableLayout
            />

            <section
              className="border"
              style={{ borderColor: "var(--app-border)" }}
            >
              <div
                className="flex items-end justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: "var(--app-border-soft)" }}
              >
                <div>
                  <h3 className="font-black">随机选题结果</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    已选 {selectedQuestions.length} 道；保存前可以反复点击重新随机。
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-16" />
                    <col className="w-20" />
                    <col className="w-[42%]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr
                      className="border-b app-muted-text"
                      style={{
                        borderColor: "var(--app-border-soft)",
                        backgroundColor: "var(--app-soft-bg)",
                      }}
                    >
                      <th className="w-20 px-4 py-2.5 text-center text-[11px] font-bold">
                        序号
                      </th>
                      <th className="w-28 border-l px-4 py-2.5 text-center text-[11px] font-bold">
                        难度
                      </th>
                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">
                        题目
                      </th>
                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">
                        选项
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuestions.map((question, index) => (
                      <tr
                        key={question.id}
                        className="border-b last:border-b-0"
                        style={{ borderColor: "var(--app-border-soft)" }}
                      >
                        <td className="px-4 py-3 text-center font-mono text-xs tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="border-l px-4 py-3 text-center text-xs font-bold">
                          {QUESTION_DIFFICULTY_LABELS[question.difficulty]}
                        </td>
                        <td className="border-l px-4 py-3 text-xs font-bold leading-5">
                          {question.prompt}
                        </td>
                        <td className="app-muted-text border-l px-4 py-3 text-[11px] leading-5">
                          {question.options.map((option, optionIndex) => {
                            const isCorrect =
                              optionIndex === question.correctOption;

                            return (
                              <p
                                key={`${question.id}-${optionIndex}`}
                                className="flex items-center gap-2 py-0.5"
                                style={{
                                  color: isCorrect
                                    ? "var(--app-success)"
                                    : undefined,
                                  fontWeight: isCorrect ? 700 : undefined,
                                }}
                              >
                                <span className="font-mono">
                                  {String.fromCharCode(65 + optionIndex)}.
                                </span>
                                <span>{option}</span>
                                {isCorrect && (
                                  <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-[var(--app-success)]">
                                    <Check size={11} />
                                    正确答案
                                  </span>
                                )}
                              </p>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                    {selectedQuestions.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="app-muted-text px-4 py-10 text-center text-xs"
                        >
                          暂无随机结果，请先设置难度比例并执行选题。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="border-y px-4 py-3 text-xs leading-5"
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
