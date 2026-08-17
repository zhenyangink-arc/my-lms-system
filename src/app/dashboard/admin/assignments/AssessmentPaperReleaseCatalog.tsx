"use client";

import { Search, Send, UsersRound, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { publishAssessmentPaperAction } from "./paper-actions";

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
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [targetScope, setTargetScope] = useState("all_students");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [studentQuery, setStudentQuery] = useState("");
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
  const filteredStudents = students.filter((student) => {
    const keyword = studentQuery.trim().toLowerCase();
    return (
      !keyword ||
      `${student.name} ${student.email} ${student.tier}`
        .toLowerCase()
        .includes(keyword)
    );
  });

  function openPaper(paperId: string) {
    setSelectedPaperId(paperId);
    setTargetScope("all_students");
    setSelectedStudentIds(new Set());
    setStudentQuery("");
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <>
      <section
        className="border"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">平台标准{typeLabel}卷</h2>
          </div>
          <span className="font-mono text-xs font-bold tabular-nums">
            {papers.length} 套可用
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead
              className="sticky top-0 z-20 backdrop-blur-xl"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--card) 84%, transparent)",
              }}
            >
              <tr className="border-b app-muted-text">
                {[
                  `标准${typeLabel}卷`,
                  "来源章节",
                  "题量",
                  "总分",
                  "时长",
                  "及格线",
                  "版本",
                  "操作",
                ].map((label, index) => (
                  <th
                    key={label}
                    className={`${index > 0 ? "border-l" : ""} px-3 py-3 text-[11px] font-bold ${
                      index >= 2 && index <= 6
                        ? "text-center"
                        : index === 7
                          ? "text-right"
                          : ""
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr
                  key={paper.id}
                  className="border-b last:border-b-0 hover:bg-[var(--surface-soft)]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td className="px-3 py-3.5">
                    <p className="text-sm font-bold">{paper.title}</p>
                    <p className="app-muted-text mt-0.5 font-mono text-[10px]">
                      {paper.paperCode}
                    </p>
                  </td>
                  <td className="border-l px-3 py-3.5 text-xs">
                    第{paper.chapterNumber}章 · {paper.chapterTitle}
                  </td>
                  <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                    {paper.questionCount}
                  </td>
                  <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                    {paper.totalPoints}
                  </td>
                  <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                    {paper.durationMinutes ?? "—"}
                  </td>
                  <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                    {paper.passingScore ?? "—"}
                  </td>
                  <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                    版本 {paper.version}
                  </td>
                  <td className="border-l px-3 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openPaper(paper.id)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--support)] hover:underline"
                    >
                      <UsersRound size={12} />
                      指向学生并发布
                    </button>
                  </td>
                </tr>
              ))}
              {papers.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="app-muted-text px-5 py-12 text-center text-sm"
                  >
                    平台暂时没有提供可用的标准{typeLabel}卷。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPaper && (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-black/20"
          role="presentation"
          onClick={() => {
            if (!pending) setSelectedPaperId("");
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`release-paper-${selectedPaper.id}`}
            className="app-card flex h-dvh w-full max-w-[1180px] flex-col overflow-hidden border-l"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="app-muted-text font-mono text-[11px] font-bold">
                  {selectedPaper.paperCode} · 版本 {selectedPaper.version}
                </p>
                <h2
                  id={`release-paper-${selectedPaper.id}`}
                  className="mt-1 text-xl font-semibold"
                >
                  指向学生并发布
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPaperId("")}
                disabled={pending}
                aria-label="关闭发布抽屉"
                className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form action={formAction} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="paper_id" value={selectedPaper.id} />
              <div className="min-h-0 flex-1 overflow-auto">
                <section className="border-b">
                  <table className="w-full border-collapse text-left">
                    <tbody>
                      <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                        <th className="app-muted-text w-32 px-5 py-3 text-[11px] font-bold">试卷名称</th>
                        <td className="border-l px-4 py-3 text-sm font-bold">{selectedPaper.title}</td>
                        <th className="app-muted-text w-28 border-l px-4 py-3 text-[11px] font-bold">题量 / 总分</th>
                        <td className="w-32 border-l px-4 py-3 text-center font-mono text-xs">{selectedPaper.questionCount} / {selectedPaper.totalPoints}</td>
                      </tr>
                      <tr>
                        <th className="app-muted-text px-5 py-3 text-[11px] font-bold">来源章节</th>
                        <td className="border-l px-4 py-3 text-xs">第{selectedPaper.chapterNumber}章 · {selectedPaper.chapterTitle}</td>
                        <th className="app-muted-text border-l px-4 py-3 text-[11px] font-bold">时长 / 及格线</th>
                        <td className="border-l px-4 py-3 text-center font-mono text-xs">{selectedPaper.durationMinutes ?? "—"} / {selectedPaper.passingScore ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section className="border-b">
                  <div className="border-b px-5 py-3">
                    <h3 className="text-sm font-semibold">试卷题目</h3>
                    <p className="app-muted-text mt-0.5 text-[11px]">
                      发布后会复制为固定快照。
                    </p>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full min-w-[780px] table-fixed border-collapse text-left">
                      <colgroup>
                        <col className="w-16" />
                        <col className="w-[44%]" />
                        <col />
                        <col className="w-20" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-[var(--card)]">
                        <tr className="border-b app-muted-text">
                          <th className="px-3 py-2.5 text-center text-[11px] font-bold">题号</th>
                          <th className="border-l px-4 py-2.5 text-[11px] font-bold">题目</th>
                          <th className="border-l px-4 py-2.5 text-[11px] font-bold">选项</th>
                          <th className="border-l px-3 py-2.5 text-center text-[11px] font-bold">分值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQuestions.map((question, index) => (
                          <tr key={question.id} className="border-b align-top last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                            <td className="px-3 py-3 text-center font-mono text-xs">{String(index + 1).padStart(2, "0")}</td>
                            <td className="border-l px-4 py-3 text-xs font-bold leading-5">{question.prompt}</td>
                            <td className="app-muted-text border-l px-4 py-3 text-[11px] leading-5">
                              {question.options.length > 0 ? question.options.map((option, optionIndex) => (
                                <p key={`${question.id}-${optionIndex}`}>第 {optionIndex + 1} 项：{option}</p>
                              )) : "—"}
                            </td>
                            <td className="border-l px-3 py-3 text-center font-mono text-xs">{question.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="border-b">
                  <div className="border-b px-5 py-3">
                    <h3 className="text-sm font-semibold">发布安排</h3>
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                        <td className="w-1/3 px-4 py-3">
                          <label className="text-[11px] font-bold">
                            关联机构课程
                            <select name="course_id" defaultValue="" className="app-input mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs">
                              <option value="">不关联具体课程</option>
                              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                            </select>
                          </label>
                        </td>
                        <td className="w-1/3 border-l px-4 py-3">
                          <label className="text-[11px] font-bold">
                            开始时间
                            <input name="starts_at" type="datetime-local" required defaultValue={defaultStart} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs" />
                          </label>
                        </td>
                        <td className="w-1/3 border-l px-4 py-3">
                          <label className="text-[11px] font-bold">
                            截止时间
                            <input name="due_at" type="datetime-local" required defaultValue={defaultDue} className="app-input mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs" />
                          </label>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-3">
                          <label className="text-[11px] font-bold">
                            机构补充通知
                            <textarea name="institution_note" rows={2} maxLength={2000} placeholder="可填写学习提醒，不会改变平台试卷内容。" className="app-input mt-1.5 w-full resize-y rounded-lg border px-3 py-2.5 text-xs leading-5" />
                          </label>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section>
                  <div className="flex flex-wrap items-center gap-4 border-b px-5 py-3">
                    <h3 className="text-sm font-semibold">指向学生</h3>
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input type="radio" name="target_scope" value="all_students" checked={targetScope === "all_students"} onChange={() => setTargetScope("all_students")} />
                      全部在籍学生
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input type="radio" name="target_scope" value="selected_students" checked={targetScope === "selected_students"} onChange={() => setTargetScope("selected_students")} />
                      指定学生
                    </label>
                    {targetScope === "selected_students" && (
                      <>
                        <span className="app-muted-text text-[11px]">已选 {selectedStudentIds.size} 人</span>
                        <label className="app-input ml-auto flex items-center gap-2 rounded-lg border px-3">
                          <Search size={13} className="app-muted-text" />
                          <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="搜索姓名、邮箱或等级" className="w-52 bg-transparent py-2 text-xs outline-none" />
                        </label>
                      </>
                    )}
                  </div>
                  {targetScope === "selected_students" && (
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-[var(--card)]">
                          <tr className="border-b app-muted-text">
                            <th className="w-14 px-4 py-2.5 text-center text-[11px] font-bold">选择</th>
                            <th className="border-l px-4 py-2.5 text-[11px] font-bold">学生</th>
                            <th className="w-56 border-l px-4 py-2.5 text-[11px] font-bold">邮箱</th>
                            <th className="w-28 border-l px-4 py-2.5 text-center text-[11px] font-bold">等级</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student) => (
                            <tr key={student.id} className="cursor-pointer border-b last:border-b-0 hover:bg-[var(--surface-soft)]" style={{ borderColor: "var(--border-subtle)" }} onClick={() => toggleStudent(student.id)}>
                              <td className="px-4 py-3 text-center">
                                <input name="target_ids" value={student.id} type="checkbox" checked={selectedStudentIds.has(student.id)} onChange={() => toggleStudent(student.id)} onClick={(event) => event.stopPropagation()} />
                              </td>
                              <td className="border-l px-4 py-3 text-xs font-bold">{student.name}</td>
                              <td className="app-muted-text border-l px-4 py-3 text-xs">{student.email}</td>
                              <td className="border-l px-4 py-3 text-center text-xs">{student.tier}</td>
                            </tr>
                          ))}
                          {filteredStudents.length === 0 && (
                            <tr><td colSpan={4} className="app-muted-text px-5 py-8 text-center text-xs">没有匹配的在籍学生。</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <div className="border-t px-5 py-4 sm:px-6">
                {state.message && (
                  <p className="mb-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--status-success)" }}>
                    {state.message}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSelectedPaperId("")} disabled={pending} className="app-soft-card rounded-lg border px-4 py-2.5 text-xs font-bold disabled:opacity-50">
                    取消
                  </button>
                  <button type="submit" disabled={pending || (targetScope === "selected_students" && selectedStudentIds.size === 0)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--support)" }}>
                    <Send size={14} />
                    {pending ? "正在发布…" : `确认发布${typeLabel}`}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
