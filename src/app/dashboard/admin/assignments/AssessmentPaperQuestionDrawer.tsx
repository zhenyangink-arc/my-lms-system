"use client";

import { Eye, X } from "lucide-react";
import { useEffect, useState } from "react";

export type AssessmentPaperQuestionItem = {
  id: string;
  prompt: string;
  options: string[];
  points: number;
  difficulty: string;
  skill: string;
};

const difficultyLabels: Record<string, string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

export function AssessmentPaperQuestionDrawer({
  title,
  paperCode,
  questions,
}: {
  title: string;
  paperCode: string;
  questions: AssessmentPaperQuestionItem[];
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
            aria-labelledby={`paper-questions-${paperCode}`}
            className="app-card flex h-dvh w-full max-w-[1100px] flex-col overflow-hidden border-l"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="app-muted-text font-mono text-[11px] font-bold">
                  {paperCode} · {questions.length} 题
                </p>
                <h2
                  id={`paper-questions-${paperCode}`}
                  className="mt-1 text-xl font-semibold"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="关闭试卷题目"
                className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-16" />
                  <col className="w-24" />
                  <col className="w-[38%]" />
                  <col />
                  <col className="w-20" />
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
                    <th className="px-3 py-3 text-center text-[11px] font-bold">
                      题号
                    </th>
                    <th className="border-l px-3 py-3 text-center text-[11px] font-bold">
                      难度
                    </th>
                    <th className="border-l px-4 py-3 text-[11px] font-bold">
                      题目
                    </th>
                    <th className="border-l px-4 py-3 text-[11px] font-bold">
                      选项
                    </th>
                    <th className="border-l px-3 py-3 text-center text-[11px] font-bold">
                      分值
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
                      <td className="px-3 py-4 text-center font-mono text-xs tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="border-l px-3 py-4 text-center text-xs font-bold">
                        {difficultyLabels[question.difficulty] ??
                          question.difficulty}
                      </td>
                      <td className="border-l px-4 py-4">
                        <p className="text-sm font-bold leading-6">
                          {question.prompt}
                        </p>
                        {question.skill && (
                          <p className="app-muted-text mt-1 text-[10px]">
                            {question.skill}
                          </p>
                        )}
                      </td>
                      <td className="app-muted-text border-l px-4 py-4 text-xs leading-5">
                        {question.options.length > 0
                          ? question.options.map((option, optionIndex) => (
                              <p key={`${question.id}-${optionIndex}`}>
                                {String.fromCharCode(65 + optionIndex)}. {option}
                              </p>
                            ))
                          : "—"}
                      </td>
                      <td className="border-l px-3 py-4 text-center font-mono text-xs font-bold tabular-nums">
                        {question.points}
                      </td>
                    </tr>
                  ))}
                  {questions.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="app-muted-text px-5 py-12 text-center text-sm"
                      >
                        当前试卷没有题目。
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
