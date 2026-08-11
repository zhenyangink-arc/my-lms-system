"use client";

import { Eye, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  StandardQuestion,
  StandardQuestionGroup,
} from "@/lib/question-bank";
import { CreateStandardQuestionForm } from "./QuestionBankForms";
import { koreanEbookSectionLabel } from "@/lib/korean-ebook-sections";

function questionOptions(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function standardQuestionAnswer(question: StandardQuestion) {
  if (question.question_type === "single_choice") {
    const options = questionOptions(question.options);
    return question.correct_option === null
      ? ""
      : options[question.correct_option] ?? "";
  }

  return question.correct_answer ?? "";
}

const QUESTION_TYPE_LABELS: Record<StandardQuestion["question_type"], string> = {
  single_choice: "单选题",
  short_text: "简答题",
  long_text: "论述题",
  file_link: "文件链接题",
};

const DIFFICULTY_LABELS: Record<StandardQuestion["difficulty"], string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

const SKILL_LABELS: Record<string, string> = {
  vocabulary: "词汇",
  grammar: "语法",
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  communication: "交际",
  mixed: "综合",
};

const STATUS_LABELS: Record<StandardQuestion["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

type OpenModal = "view" | "create" | null;

export function ChapterQuestionBankActions({
  group,
  questions,
}: {
  group: StandardQuestionGroup;
  questions: StandardQuestion[];
}) {
  const [openModal, setOpenModal] = useState<OpenModal>(null);

  useEffect(() => {
    if (!openModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenModal(null);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openModal]);

  const title =
    group.curriculum_label ??
    `第 ${group.chapter_number} 章 · ${group.title}`;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpenModal("view")}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-black hover:bg-[var(--app-soft-bg)]"
          style={{ color: "var(--app-secondary)" }}
        >
          <Eye size={14} />
          查看题目
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("create")}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-black hover:bg-[var(--app-soft-bg)]"
          style={{
            color: "var(--app-accent)",
          }}
        >
          <Plus size={14} />
          新增标准题目
        </button>
      </div>

      {openModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`question-bank-modal-${group.id}`}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border bg-[var(--app-card-bg)] shadow-2xl"
          >
            <header
              className="flex items-start justify-between gap-4 border-b p-4 sm:p-5"
              style={{ borderColor: "var(--app-border-soft)" }}
            >
              <div className="min-w-0">
                <p className="app-muted-text text-[11px] font-black">
                  {openModal === "view"
                    ? `当前章节 · ${questions.length} 道题`
                    : "当前章节 · 新增题目"}
                </p>
                <h2
                  id={`question-bank-modal-${group.id}`}
                  className="mt-1 text-base font-black sm:text-lg"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                aria-label="关闭弹窗"
              >
                <X size={17} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {openModal === "create" ? (
                <CreateStandardQuestionForm
                  groups={[group]}
                  lockedGroup={group}
                />
              ) : questions.length === 0 ? (
                <div className="border-y py-10 text-center">
                  <p className="font-black">当前章节还没有标准题目</p>
                  <button
                    type="button"
                    onClick={() => setOpenModal("create")}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white"
                    style={{ backgroundColor: "var(--app-accent)" }}
                  >
                    <Plus size={14} />
                    新增第一道题
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border-y">
                  <table className="w-full min-w-[1050px] border-collapse text-left">
                    <thead><tr className="border-b bg-[var(--app-soft-bg)] app-muted-text"><th className="px-3 py-2.5 text-[11px]">序号</th><th className="border-l px-3 py-2.5 text-[11px]">电子书目录</th><th className="border-l px-3 py-2.5 text-center text-[11px]">难度</th><th className="border-l px-3 py-2.5 text-[11px]">题目</th><th className="border-l px-3 py-2.5 text-[11px]">四个选项</th><th className="border-l px-3 py-2.5 text-[11px]">答案与解析</th><th className="border-l px-3 py-2.5 text-[11px]">状态</th></tr></thead>
                    <tbody>
                  {questions.map((question, index) => {
                    const options = questionOptions(question.options);
                    const answer = standardQuestionAnswer(question);

                    return (
                      <tr
                        key={question.id}
                        className="border-b align-top last:border-b-0"
                      >
                        <td className="px-3 py-3 text-center font-mono text-xs font-black text-[var(--app-secondary)]">{index + 1}</td>
                        <td className="border-l px-3 py-3 text-[11px] leading-5"><span className="font-black">{koreanEbookSectionLabel(question.ebook_section_step)}</span>{question.ebook_page_reference && <span className="app-muted-text block">{question.ebook_page_reference}</span>}</td>
                        <td className="border-l px-3 py-3 text-center text-xs font-bold">{DIFFICULTY_LABELS[question.difficulty]}</td>
                        <td className="border-l px-3 py-3"><p className="whitespace-pre-wrap text-sm font-black leading-6">{question.prompt}</p><p className="app-muted-text mt-1 text-[10px]">{QUESTION_TYPE_LABELS[question.question_type]} · {SKILL_LABELS[question.skill] ?? "综合"}</p></td>
                        <td className="border-l px-3 py-3 text-xs leading-5">{options.map((option, optionIndex) => <p key={`${question.id}-${optionIndex}`} className={optionIndex === question.correct_option ? "font-black text-[var(--app-success)]" : ""}><span className="mr-1 font-mono">{String.fromCharCode(65 + optionIndex)}.</span>{option}</p>)}</td>
                        <td className="border-l px-3 py-3 text-xs leading-5"><p className="font-black text-[var(--app-success)]">{answer || "人工批改"}</p>{question.explanation && <p className="app-muted-text mt-1.5">{question.explanation}</p>}</td>
                        <td className="border-l px-3 py-3 text-xs"><p className="font-black">{STATUS_LABELS[question.status]}</p><p className="app-muted-text mt-1">{question.default_points} 分</p></td>
                      </tr>
                    );
                  })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
