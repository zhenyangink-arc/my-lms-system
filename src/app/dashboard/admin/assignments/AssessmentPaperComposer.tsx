"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import type { QuestionType } from "@/app/dashboard/assignments/config";
import { createAssessmentPaperAction } from "./paper-actions";
import { DifficultyRandomSelector } from "./DifficultyRandomSelector";

type BankGroup = {
  id: string;
  title: string;
  koreanTitle: string;
  chapterNumber: number;
};

export type PaperBankQuestion = {
  id: string;
  groupId: string;
  prompt: string;
  questionType: QuestionType;
  options: string[];
  difficulty: string;
  skill: string;
  defaultPoints: number;
};

type SelectedQuestion = { questionId: string; points: number };

const difficultyLabels: Record<string, string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};
const QUESTIONS_PER_PAGE = 8;

export function AssessmentPaperComposer({
  paperType,
  groups,
  questions,
}: {
  paperType: "homework" | "exam";
  groups: BankGroup[];
  questions: PaperBankQuestion[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = createAssessmentPaperAction.bind(null, paperType);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialLearningAssignmentActionState
  );
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
    }
  }, [state]);

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const selectedIds = new Set(selected.map((item) => item.questionId));
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return questions.filter(
      (question) =>
        question.groupId === groupId &&
        (difficulty === "all" || question.difficulty === difficulty) &&
        (!keyword ||
          `${question.prompt} ${question.skill}`
            .toLowerCase()
            .includes(keyword))
    );
  }, [difficulty, groupId, query, questions]);
  const groupQuestions = useMemo(
    () => questions.filter((question) => question.groupId === groupId),
    [groupId, questions]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / QUESTIONS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * QUESTIONS_PER_PAGE,
    currentPage * QUESTIONS_PER_PAGE
  );
  const totalPoints = selected.reduce(
    (sum, item) => sum + (Number(item.points) || 0),
    0
  );
  const typeLabel = paperType === "homework" ? "作业" : "考试";

  function addQuestion(question: PaperBankQuestion) {
    if (selectedIds.has(question.id)) return;
    setSelected((current) => [
      ...current,
      { questionId: question.id, points: question.defaultPoints },
    ]);
  }

  function removeQuestion(questionId: string) {
    setSelected((current) =>
      current.filter((item) => item.questionId !== questionId)
    );
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.length) return;
    setSelected((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected([]);
          dialogRef.current?.showModal();
        }}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
        style={{ backgroundColor: "var(--app-accent)" }}
      >
        <FilePlus2 size={16} />
        新增标准{typeLabel}卷
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[92dvh] w-[min(1180px,calc(100%-2rem))] overflow-hidden rounded-3xl border bg-transparent p-0 shadow-2xl backdrop:bg-black/45"
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
              <h2 className="text-xl font-black">新增标准{typeLabel}卷</h2>
              <p className="app-muted-text mt-1 text-xs">
                A—E只是命名示例，平台可以持续新增任意数量的完整试卷。
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              aria-label="关闭新增试卷对话框"
            >
              <X size={18} />
            </button>
          </div>

          <form action={formAction} className="space-y-6 p-5 sm:p-6">
            <input
              type="hidden"
              name="selected_questions_json"
              value={JSON.stringify(selected)}
            />
            <input type="hidden" name="source_test_id" value={groupId} />

            <section className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-black">
                试卷名称
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder={`例如：韩语字母第一章${typeLabel}A卷`}
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                />
              </label>
              <label className="text-xs font-black">
                题库章节
                <select
                  value={groupId}
                  onChange={(event) => {
                    setGroupId(event.target.value);
                    setSelected([]);
                    setPage(1);
                  }}
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      第{group.chapterNumber}章 · {group.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-black md:col-span-2">
                试卷说明
                <textarea
                  name="description"
                  rows={3}
                  maxLength={5000}
                  placeholder="说明适用阶段、考查范围和注意事项。"
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm leading-6"
                />
              </label>
              <label className="text-xs font-black">
                建议用时（分钟）
                <input
                  name="duration_minutes"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={paperType === "exam" ? 60 : 30}
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                />
              </label>
              <label className="text-xs font-black">
                及格线（百分制）
                <input
                  name="passing_score"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={60}
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                />
              </label>
              <label className="app-soft-card flex items-center gap-3 rounded-2xl border p-4 text-xs font-black md:col-span-2">
                <input
                  name="allow_resubmission"
                  type="checkbox"
                  defaultChecked={paperType === "homework"}
                  className="h-4 w-4"
                />
                {paperType === "homework"
                  ? "允许学生再次提交"
                  : "允许考试重复提交（正式考试通常关闭）"}
              </label>
            </section>

            <section>
              <DifficultyRandomSelector
                key={groupId}
                questions={groupQuestions}
                onSelected={(questionIds) =>
                  setSelected(
                    questionIds.flatMap((questionId) => {
                      const question = questionMap.get(questionId);
                      return question
                        ? [
                            {
                              questionId,
                              points: question.defaultPoints,
                            },
                          ]
                        : [];
                    })
                  )
                }
              />

              <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-black">从本章标准题库组卷</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    只有平台可以进行这一步；机构发布端不会出现单题选择。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={difficulty}
                    onChange={(event) => {
                      setDifficulty(event.target.value);
                      setPage(1);
                    }}
                    className="app-input rounded-xl border px-3 py-2.5 text-xs font-black"
                  >
                    <option value="all">全部难度</option>
                    {Object.entries(difficultyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="app-input flex items-center gap-2 rounded-xl border px-3">
                    <Search size={14} className="app-muted-text" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="搜索题目"
                      className="w-44 bg-transparent py-2.5 text-xs outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {visible.map((question) => {
                  const isSelected = selectedIds.has(question.id);
                  return (
                    <article
                      key={question.id}
                      className="app-soft-card rounded-2xl border p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-1 text-[10px] font-black"
                          style={{
                            color: "var(--app-secondary)",
                            backgroundColor: "var(--app-secondary-soft)",
                          }}
                        >
                          {difficultyLabels[question.difficulty] ??
                            question.difficulty}
                        </span>
                        <span className="app-muted-text text-[10px] font-bold">
                          {question.skill || "综合"}
                        </span>
                        <button
                          type="button"
                          disabled={isSelected}
                          onClick={() => addQuestion(question)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white disabled:opacity-50"
                          style={{
                            backgroundColor: isSelected
                              ? "var(--app-success)"
                              : "var(--app-accent)",
                          }}
                        >
                          {isSelected ? <Check size={11} /> : <Plus size={11} />}
                          {isSelected ? "已加入" : "加入试卷"}
                        </button>
                      </div>
                      <p className="mt-3 text-sm font-bold leading-6">
                        {question.prompt}
                      </p>
                      {question.options.length > 0 && (
                        <div className="app-muted-text mt-2 grid gap-1 text-[11px]">
                          {question.options.map((option, index) => (
                            <span key={`${question.id}-${index}`}>
                              {String.fromCharCode(65 + index)}. {option}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="app-muted-text text-xs">
                  共 {filtered.length} 道 · 第 {currentPage}/{totalPages} 页
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-40"
                    aria-label="上一页"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                    className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border disabled:opacity-40"
                    aria-label="下一页"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </section>

            <section className="app-soft-card rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black">已选试卷内容</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    {selected.length} 道题 · 合计 {totalPoints} 分
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {selected.map((item, index) => {
                  const question = questionMap.get(item.questionId);
                  if (!question) return null;
                  return (
                    <div
                      key={item.questionId}
                      className="app-card flex items-center gap-3 rounded-xl border p-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
                        {index + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-xs font-bold">
                        {question.prompt}
                      </p>
                      <input
                        type="number"
                        min={0.01}
                        max={1000}
                        step="0.01"
                        value={item.points}
                        onChange={(event) =>
                          setSelected((current) =>
                            current.map((currentItem) =>
                              currentItem.questionId === item.questionId
                                ? {
                                    ...currentItem,
                                    points: Number(event.target.value),
                                  }
                                : currentItem
                            )
                          )
                        }
                        className="app-input w-20 rounded-lg border px-2 py-2 text-xs"
                        aria-label={`第 ${index + 1} 题分值`}
                      />
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveQuestion(index, -1)}
                        className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                        aria-label="上移"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === selected.length - 1}
                        onClick={() => moveQuestion(index, 1)}
                        className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30"
                        aria-label="下移"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(item.questionId)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}
                        aria-label="移除题目"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
                {selected.length === 0 && (
                  <p className="app-muted-text rounded-xl border border-dashed p-6 text-center text-xs">
                    从上方题库加入题目后，会在这里形成完整试卷。
                  </p>
                )}
              </div>
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

            <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end" style={{ borderColor: "var(--app-border-soft)" }}>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="app-soft-card rounded-xl border px-5 py-3 text-xs font-black"
              >
                取消
              </button>
              <button
                type="submit"
                name="intent"
                value="draft"
                disabled={pending || selected.length === 0}
                className="app-soft-card inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-xs font-black disabled:opacity-50"
              >
                <Save size={14} />
                保存草稿
              </button>
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={pending || selected.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                <Send size={14} />
                {pending ? "正在保存…" : "保存并提供给机构"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
