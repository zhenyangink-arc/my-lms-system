"use client";

import { Check, Eye, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ChapterTestViewerQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number | null;
  difficulty: "foundation" | "medium";
};

const difficultyLabels = {
  foundation: "基础",
  medium: "中等",
} as const;

export function ChapterTestQuestionViewer({
  testTitle,
  questions,
}: {
  testTitle: string;
  questions: ChapterTestViewerQuestion[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline"
      >
        <Eye size={12} />
        查看题目
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-black/20"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`chapter-test-viewer-${questions[0]?.id ?? "empty"}`}
            className="app-card flex h-dvh w-full max-w-[1100px] flex-col overflow-hidden border-l"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b p-5 sm:px-6">
              <div>
                <p className="app-muted-text text-[11px] font-semibold">
                  当前测试题目 · {questions.length} 题
                </p>
                <h2
                  id={`chapter-test-viewer-${questions[0]?.id ?? "empty"}`}
                  className="mt-1 text-xl font-semibold"
                >
                  {testTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="关闭测试题目"
                className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-[42%]" />
                  <col />
                </colgroup>
                <thead className="sticky top-0 z-10 backdrop-blur-xl">
                  <tr
                    className="border-b app-muted-text"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor:
                        "color-mix(in srgb, var(--card) 84%, transparent)",
                    }}
                  >
                    <th className="px-4 py-3 text-center text-[11px] font-bold">
                      题号
                    </th>
                    <th className="border-l px-4 py-3 text-center text-[11px] font-bold">
                      难度
                    </th>
                    <th className="border-l px-4 py-3 text-[11px] font-bold">
                      题目
                    </th>
                    <th className="border-l px-4 py-3 text-[11px] font-bold">
                      选项
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question, index) => (
                    <tr
                      key={question.id}
                      className="border-b align-top last:border-b-0"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <td className="px-4 py-4 text-center font-mono text-xs tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="border-l px-4 py-4 text-center text-xs font-bold">
                        {difficultyLabels[question.difficulty]}
                      </td>
                      <td className="border-l px-4 py-4 text-sm font-bold leading-6">
                        {question.prompt}
                      </td>
                      <td className="app-muted-text border-l px-4 py-4 text-[11px] leading-5">
                        {question.options.map((option, optionIndex) => {
                          const isCorrect =
                            optionIndex === question.correctOption;

                          return (
                            <p
                              key={`${question.id}-${optionIndex}`}
                              className="flex items-center gap-2 py-0.5"
                              style={{
                                color: isCorrect
                                  ? "var(--status-success)"
                                  : undefined,
                                fontWeight: isCorrect ? 700 : undefined,
                              }}
                            >
                              <span className="font-mono">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              <span>{option}</span>
                              {isCorrect && (
                                <span
                                  className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold"
                                  style={{ color: "var(--status-success)" }}
                                >
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
                  {questions.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="app-muted-text px-5 py-12 text-center text-xs"
                      >
                        当前章节还没有设置学生实际使用的测试题目。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
