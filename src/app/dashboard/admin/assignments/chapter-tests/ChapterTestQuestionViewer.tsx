"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ChapterTestViewerQuestion = {
  id: string;
  prompt: string;
  options: string[];
  difficulty: "foundation" | "medium" | "hard" | "expert";
};

const difficultyLabels = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
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
        className="app-soft-card mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"
      >
        <Eye size={14} />
        查看测试题目
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#102f35]/55 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`chapter-test-viewer-${questions[0]?.id ?? "empty"}`}
            className="app-card flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b p-5 sm:px-6">
              <div>
                <p className="app-muted-text text-[11px] font-black">
                  当前测试题目 · {questions.length} 题
                </p>
                <h2
                  id={`chapter-test-viewer-${questions[0]?.id ?? "empty"}`}
                  className="mt-1 text-xl font-black"
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

            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-5 md:grid-cols-2 sm:p-6">
              {questions.map((question, index) => (
                <article
                  key={question.id}
                  className="app-soft-card rounded-2xl border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black">第 {index + 1} 题</p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black"
                      style={{
                        color: "var(--app-secondary)",
                        backgroundColor: "var(--app-secondary-soft)",
                      }}
                    >
                      {difficultyLabels[question.difficulty]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6">
                    {question.prompt}
                  </p>
                  <div className="app-muted-text mt-3 space-y-1 text-[11px]">
                    {question.options.map((option, optionIndex) => (
                      <p key={`${question.id}-${optionIndex}`}>
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </p>
                    ))}
                  </div>
                </article>
              ))}

              {questions.length === 0 && (
                <p className="app-muted-text col-span-full rounded-2xl border border-dashed p-8 text-center text-xs">
                  当前章节还没有设置学生实际使用的测试题目。
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
