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
  canPublish,
}: {
  paperType: "homework" | "exam";
  groups: BankGroup[];
  questions: PaperBankQuestion[];
  canPublish: boolean;
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
    if (!window.confirm("确认从试卷中移除这道题？")) return;
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
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--primary)" }}
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
        style={{ borderColor: "var(--border)" }}
      >
        <div className="app-card max-h-[92dvh] overflow-y-auto rounded-3xl">
          <div
            className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--card)",
            }}
          >
            <div>
              <h2 className="text-xl font-semibold">新增标准{typeLabel}卷</h2>
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
              <label className="text-xs font-semibold">
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
              <label className="text-xs font-semibold">
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
              <label className="text-xs font-semibold md:col-span-2">
                试卷说明
                <textarea
                  name="description"
                  rows={3}
                  maxLength={5000}
                  placeholder="说明适用阶段、考查范围和注意事项。"
                  className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm leading-6"
                />
              </label>
              <label className="text-xs font-semibold">
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
              <label className="text-xs font-semibold">
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
              <label className="flex items-center gap-3 border-y py-3 text-xs font-semibold md:col-span-2">
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
                  <h3 className="font-semibold">从本章标准题库组卷</h3>
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
                    className="app-input rounded-xl border px-3 py-2.5 text-xs font-semibold"
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

              <div className="mt-4 overflow-x-auto border">
                <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-20" />
                    <col className="w-28" />
                    <col className="w-[38%]" />
                    <col />
                    <col className="w-24" />
                  </colgroup>
                  <thead className="bg-[var(--surface-soft)]">
                    <tr className="border-b app-muted-text">
                      <th className="px-3 py-2.5 text-center text-[11px] font-bold">难度</th>
                      <th className="border-l px-3 py-2.5 text-center text-[11px] font-bold">技能</th>
                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">题目</th>
                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">选项</th>
                      <th className="border-l px-3 py-2.5 text-right text-[11px] font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((question) => {
                      const isSelected = selectedIds.has(question.id);
                      return (
                        <tr key={question.id} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                          <td className="px-3 py-3 text-center text-xs font-bold">{difficultyLabels[question.difficulty] ?? question.difficulty}</td>
                          <td className="app-muted-text border-l px-3 py-3 text-center text-xs">{question.skill || "综合"}</td>
                          <td className="border-l px-4 py-3 text-xs font-bold leading-5">{question.prompt}</td>
                          <td className="app-muted-text border-l px-4 py-3 text-[11px] leading-5">
                            {question.options.length > 0 ? question.options.map((option, index) => (
                              <p key={`${question.id}-${index}`}>第 {index + 1} 项：{option}</p>
                            )) : "—"}
                          </td>
                          <td className="border-l px-3 py-3 text-right">
                            <button type="button" disabled={isSelected} onClick={() => addQuestion(question)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] disabled:text-[var(--status-success)]">
                              {isSelected ? <Check size={11} /> : <Plus size={11} />}
                              {isSelected ? "已加入" : "加入"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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

            <section className="border">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <h3 className="font-semibold">已选试卷内容</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    {selected.length} 道题 · 合计 {totalPoints} 分
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-[var(--surface-soft)]">
                    <tr className="border-b app-muted-text">
                      <th className="w-16 px-3 py-2.5 text-center text-[11px] font-bold">顺序</th>
                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">题目</th>
                      <th className="w-24 border-l px-3 py-2.5 text-center text-[11px] font-bold">分值</th>
                      <th className="w-36 border-l px-3 py-2.5 text-right text-[11px] font-bold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((item, index) => {
                      const question = questionMap.get(item.questionId);
                      if (!question) return null;
                      return (
                        <tr key={item.questionId} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                          <td className="px-3 py-3 text-center font-mono text-xs">{String(index + 1).padStart(2, "0")}</td>
                          <td className="border-l px-4 py-3 text-xs font-bold">{question.prompt}</td>
                          <td className="border-l px-3 py-2 text-center">
                            <input type="number" min={0.01} max={1000} step={0.01} value={item.points} onChange={(event) => setSelected((current) => current.map((currentItem) => currentItem.questionId === item.questionId ? { ...currentItem, points: Number(event.target.value) } : currentItem))} className="app-input w-20 rounded-lg border px-2 py-2 text-center text-xs" aria-label={`第 ${index + 1} 题分值`} />
                          </td>
                          <td className="border-l px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30" aria-label="上移"><ArrowUp size={13} /></button>
                              <button type="button" disabled={index === selected.length - 1} onClick={() => moveQuestion(index, 1)} className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-30" aria-label="下移"><ArrowDown size={13} /></button>
                              <button type="button" onClick={() => removeQuestion(item.questionId)} className="flex h-8 w-8 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2" style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)" }} aria-label="移除题目"><Trash2 size={13} aria-hidden="true" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {selected.length === 0 && (
                  <p className="app-muted-text p-6 text-center text-xs">
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
                      ? "var(--status-danger)"
                      : "var(--status-success)",
                  backgroundColor:
                    state.status === "error"
                      ? "var(--status-danger-surface)"
                      : "var(--status-success-surface)",
                }}
              >
                {state.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end" style={{ borderColor: "var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="app-soft-card rounded-xl border px-5 py-3 text-xs font-semibold"
              >
                取消
              </button>
              <button
                type="submit"
                name="intent"
                value="draft"
                disabled={pending || selected.length === 0}
                className="app-soft-card inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-xs font-semibold disabled:opacity-50"
              >
                <Save size={14} />
                保存草稿
              </button>
              {canPublish && (
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={pending || selected.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  <Send size={14} />
                  {pending ? "正在保存…" : "保存并提供给机构"}
                </button>
              )}
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
