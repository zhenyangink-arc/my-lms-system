"use client";

import { Eye, KeyRound, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  StandardQuestion,
  StandardQuestionGroup,
} from "@/lib/question-bank";
import { CreateStandardQuestionForm } from "./QuestionBankForms";

function questionOptions(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function questionTags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
        <button
          type="button"
          onClick={() => setOpenModal("view")}
          className="app-soft-card inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-black"
          style={{ color: "var(--app-secondary)" }}
        >
          <Eye size={14} />
          查看题目
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("create")}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-xs font-black"
          style={{
            color: "var(--app-accent)",
            borderColor: "var(--app-accent)",
            backgroundColor: "var(--app-accent-soft)",
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
            className="app-card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
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
                className="app-soft-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
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
                <div className="rounded-2xl border border-dashed p-10 text-center">
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
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  {questions.map((question, index) => {
                    const options = questionOptions(question.options);
                    const tags = questionTags(question.tags);
                    const answer = standardQuestionAnswer(question);

                    return (
                      <article
                        key={question.id}
                        className="app-soft-card rounded-2xl border p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                            style={{
                              color: "var(--app-secondary)",
                              backgroundColor: "var(--app-secondary-soft)",
                            }}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                              <span>{QUESTION_TYPE_LABELS[question.question_type]}</span>
                              <span className="app-muted-text rounded-full border px-2 py-0.5">
                                {DIFFICULTY_LABELS[question.difficulty]}
                              </span>
                              <span className="app-muted-text rounded-full border px-2 py-0.5">
                                {STATUS_LABELS[question.status]} · {question.default_points} 分
                              </span>
                            </div>
                            <h3 className="mt-2 whitespace-pre-wrap text-sm font-black leading-6">
                              {question.prompt}
                            </h3>
                            <p className="app-muted-text mt-2 text-[11px]">
                              知识点：{question.skill}
                              {tags.length > 0 ? ` · ${tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                            </p>
                          </div>
                        </div>

                        {question.question_type === "single_choice" && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {options.map((option, optionIndex) => (
                              <div
                                key={`${question.id}-${optionIndex}`}
                                className="app-card flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
                              >
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-black"
                                  style={
                                    optionIndex === question.correct_option
                                      ? {
                                          color: "var(--app-success)",
                                          backgroundColor:
                                            "var(--app-success-soft)",
                                        }
                                      : undefined
                                  }
                                >
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                                {option}
                              </div>
                            ))}
                          </div>
                        )}

                        <div
                          className="mt-3 rounded-xl border p-3"
                          style={{
                            borderColor: "var(--app-success)",
                            backgroundColor: "var(--app-success-soft)",
                          }}
                        >
                          <p
                            className="flex items-center gap-1.5 text-xs font-black"
                            style={{ color: "var(--app-success)" }}
                          >
                            <KeyRound size={13} />
                            标准答案
                          </p>
                          <p className="mt-1.5 text-xs leading-5">
                            {answer || "本题由机构人工批改"}
                          </p>
                          {question.explanation && (
                            <p className="app-muted-text mt-2 border-t pt-2 text-xs leading-5">
                              解析：{question.explanation}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
