"use client";

import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { publishAssessmentPaperAction } from "./paper-actions";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

export type ReleasePaper = {
  id: string;
  paperCode: string;
  title: string;
  description: string;
  chapterTitle: string;
  chapterNumber: number;
  durationMinutes: number | null;
  passingScore: number | null;
  allowResubmission: boolean;
  totalPoints: number;
  questionCount: number;
  version: number;
};

export type ReleasePaperQuestion = {
  id: string;
  paperId: string;
  prompt: string;
  options: string[];
  points: number;
  sortOrder: number;
};

type StudentOption = { id: string; name: string; email: string; tier: string };
type CourseOption = { id: string; title: string };

function localDateTimeValue(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

export function AssessmentPaperReleaseCatalog({
  paperType,
  papers,
  questions,
  courses,
  students,
}: {
  paperType: "homework" | "exam";
  papers: ReleasePaper[];
  questions: ReleasePaperQuestion[];
  courses: CourseOption[];
  students: StudentOption[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [targetScope, setTargetScope] = useState("all_students");
  const boundAction = publishAssessmentPaperAction.bind(null, paperType);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialLearningAssignmentActionState
  );
  const questionsByPaper = useMemo(() => {
    const grouped = new Map<string, ReleasePaperQuestion[]>();
    questions.forEach((question) => {
      const current = grouped.get(question.paperId) ?? [];
      current.push(question);
      grouped.set(question.paperId, current);
    });
    grouped.forEach((items) =>
      items.sort((left, right) => left.sortOrder - right.sortOrder)
    );
    return grouped;
  }, [questions]);
  const selectedPaper = papers.find((paper) => paper.id === selectedPaperId);
  const selectedQuestions = selectedPaper
    ? questionsByPaper.get(selectedPaper.id) ?? []
    : [];
  const typeLabel = paperType === "homework" ? "作业" : "考试";
  const now = new Date();
  const defaultStart = localDateTimeValue(
    new Date(now.getTime() + 60 * 60 * 1000)
  );
  const defaultDue = localDateTimeValue(
    new Date(
      now.getTime() +
        (paperType === "homework" ? 7 * 24 * 60 : 3 * 60) * 60 * 1000
    )
  );

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
    }
  }, [state]);

  function openPaper(paperId: string) {
    setSelectedPaperId(paperId);
    setTargetScope("all_students");
    dialogRef.current?.showModal();
  }

  return (
    <>
      <section className="app-card rounded-3xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <DashboardTitleWithHint headingLevel={2} titleClassName="text-xl font-black" title={<>平台标准{typeLabel}卷</>} description={<>只能选择整套试卷发布；题目、分值、顺序和规则均由平台锁定。</>} />
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-xs font-black"
            style={{
              color: "var(--app-success)",
              backgroundColor: "var(--app-success-soft)",
            }}
          >
            可用 {papers.length} 套
          </span>
        </div>

        <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {papers.map((paper) => (
            <article
              key={paper.id}
              className="app-soft-card rounded-3xl border p-5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-black"
                  style={{
                    color: "var(--app-accent)",
                    backgroundColor: "var(--app-accent-soft)",
                  }}
                >
                  {paper.paperCode}
                </span>
                <span className="app-muted-text ml-auto text-[10px] font-black">
                  v{paper.version}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black leading-7">{paper.title}</h3>
              <p className="app-muted-text mt-1 text-xs">
                第{paper.chapterNumber}章 · {paper.chapterTitle}
              </p>
              <p className="app-muted-text mt-3 line-clamp-2 min-h-10 text-xs leading-5">
                {paper.description || "平台暂未填写试卷说明。"}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="app-card rounded-xl border p-2.5 text-center">
                  <p className="font-black">{paper.questionCount}</p>
                  <p className="app-muted-text mt-0.5 text-[10px]">题目</p>
                </div>
                <div className="app-card rounded-xl border p-2.5 text-center">
                  <p className="font-black">{paper.totalPoints}</p>
                  <p className="app-muted-text mt-0.5 text-[10px]">总分</p>
                </div>
                <div className="app-card rounded-xl border p-2.5 text-center">
                  <p className="font-black">{paper.durationMinutes ?? "—"}</p>
                  <p className="app-muted-text mt-0.5 text-[10px]">分钟</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openPaper(paper.id)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-white"
                style={{ backgroundColor: "var(--app-secondary)" }}
              >
                <Eye size={14} />
                预览整卷并发布
              </button>
            </article>
          ))}
          {papers.length === 0 && (
            <div className="app-muted-text col-span-full rounded-3xl border border-dashed p-10 text-center text-sm">
              平台暂时还没有提供可用的标准{typeLabel}卷。
            </div>
          )}
        </div>
      </section>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[92dvh] w-[min(1050px,calc(100%-2rem))] overflow-hidden rounded-3xl border bg-transparent p-0 shadow-2xl backdrop:bg-black/45"
        style={{ borderColor: "var(--app-border)" }}
      >
        {selectedPaper && (
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
                  {selectedPaper.paperCode} · v{selectedPaper.version}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {selectedPaper.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                aria-label="关闭试卷预览"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <section className="grid gap-3 sm:grid-cols-4">
                {[
                  ["题目", `${selectedPaper.questionCount} 道`, FileCheck2],
                  ["总分", `${selectedPaper.totalPoints} 分`, CheckCircle2],
                  [
                    "建议用时",
                    selectedPaper.durationMinutes
                      ? `${selectedPaper.durationMinutes} 分钟`
                      : "未限制",
                    Clock3,
                  ],
                  [
                    "及格线",
                    selectedPaper.passingScore == null
                      ? "未设置"
                      : `${selectedPaper.passingScore} 分`,
                    BookOpenCheck,
                  ],
                ].map(([label, value, Icon]) => {
                  const MetricIcon = Icon as typeof FileCheck2;
                  return (
                    <div
                      key={String(label)}
                      className="app-soft-card rounded-2xl border p-3"
                    >
                      <MetricIcon
                        size={15}
                        style={{ color: "var(--app-accent)" }}
                      />
                      <p className="mt-2 text-sm font-black">{String(value)}</p>
                      <p className="app-muted-text mt-0.5 text-[10px]">
                        {String(label)}
                      </p>
                    </div>
                  );
                })}
              </section>

              <section>
                <h3 className="font-black">试卷题目预览</h3>
                <p className="app-muted-text mt-1 text-xs">
                  机构可以核对题目内容，但不能增删、替换、排序或修改分值。
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedQuestions.map((question, index) => (
                    <article
                      key={question.id}
                      className="app-soft-card rounded-2xl border p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black">第 {index + 1} 题</p>
                        <span
                          className="text-xs font-black"
                          style={{ color: "var(--app-secondary)" }}
                        >
                          {question.points} 分
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-bold leading-6">
                        {question.prompt}
                      </p>
                      {question.options.length > 0 && (
                        <div className="app-muted-text mt-3 space-y-1 text-xs">
                          {question.options.map((option, optionIndex) => (
                            <p key={`${question.id}-${optionIndex}`}>
                              {String.fromCharCode(65 + optionIndex)}. {option}
                            </p>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <form action={formAction} className="space-y-5 border-t pt-6" style={{ borderColor: "var(--app-border-soft)" }}>
                <input type="hidden" name="paper_id" value={selectedPaper.id} />
                <div>
                  <h3 className="font-black">机构发布安排</h3>
                  <p className="app-muted-text mt-1 text-xs">
                    这里只安排课程、学生和时间，不会改变平台试卷内容。
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-xs font-black">
                    关联机构课程
                    <select
                      name="course_id"
                      defaultValue=""
                      className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                    >
                      <option value="">不关联具体课程</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black">
                    开始时间
                    <input
                      name="starts_at"
                      type="datetime-local"
                      required
                      defaultValue={defaultStart}
                      className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-black">
                    截止时间
                    <input
                      name="due_at"
                      type="datetime-local"
                      required
                      defaultValue={defaultDue}
                      className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"
                    />
                  </label>
                </div>

                <div className="app-soft-card rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <UsersRound
                      size={16}
                      style={{ color: "var(--app-secondary)" }}
                    />
                    <p className="text-xs font-black">发布范围</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="app-card flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black">
                      <input
                        type="radio"
                        name="target_scope"
                        value="all_students"
                        checked={targetScope === "all_students"}
                        onChange={() => setTargetScope("all_students")}
                      />
                      全部在籍学生
                    </label>
                    <label className="app-card flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black">
                      <input
                        type="radio"
                        name="target_scope"
                        value="selected_students"
                        checked={targetScope === "selected_students"}
                        onChange={() => setTargetScope("selected_students")}
                      />
                      指定学生
                    </label>
                  </div>
                  {targetScope === "selected_students" && (
                    <div className="mt-4 grid max-h-52 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="app-card flex items-start gap-3 rounded-xl border p-3"
                        >
                          <input
                            name="target_ids"
                            value={student.id}
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black">
                              {student.name}
                            </span>
                            <span className="app-muted-text mt-0.5 block truncate text-[10px]">
                              {student.email} · {student.tier}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <label className="text-xs font-black">
                  机构补充通知
                  <textarea
                    name="institution_note"
                    rows={3}
                    maxLength={2000}
                    placeholder="可填写集合要求、学习提醒等；不能修改平台试卷说明。"
                    className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm leading-6"
                  />
                </label>

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

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => dialogRef.current?.close()}
                    className="app-soft-card rounded-xl border px-5 py-3 text-xs font-black"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--app-accent)" }}
                  >
                    <Send size={14} />
                    {pending ? "正在发布…" : `确认发布${typeLabel}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </dialog>

      <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text">
        <CalendarClock className="mt-0.5 shrink-0" size={16} />
        <p>
          发布后，学生使用的是当前试卷版本的固定快照。平台以后更新或停用该试卷，都不会改变已经发布的任务。
        </p>
      </section>
    </>
  );
}
