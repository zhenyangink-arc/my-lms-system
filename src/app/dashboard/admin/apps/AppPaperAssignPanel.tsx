"use client";

import { Send, UsersRound, X } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { publishAssessmentPaperAction } from "@/app/dashboard/admin/assignments/paper-actions";

export type AssignablePaper = {
  id: string;
  paperCode: string;
  title: string;
  paperType: "homework" | "exam";
  questionCount: number;
  totalPoints: number;
  version: number;
};

export type AssignStudentOption = { id: string; name: string; email: string; tier: string };
export type AssignCourseOption = { id: string; title: string };

function localDateTimeValue(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

const inputClass = "app-input mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs";

/**
 * 机构把平台已发布的标准试卷布置给本应用的学生。
 * 沿用原有的布置动作（publishAssessmentPaperAction → create_learning_assignment_from_paper_with_unlock），
 * 这里不做试卷质检或权限判断，由数据库函数最终校验。不含补考与“完成章节后开放”选项。
 */
export function AppPaperAssignPanel({
  papers,
  students,
  courses,
  canTargetAllStudents,
}: {
  papers: AssignablePaper[];
  students: AssignStudentOption[];
  courses: AssignCourseOption[];
  canTargetAllStudents: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = papers.find((paper) => paper.id === selectedId) ?? null;

  if (papers.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="assign-papers-title">
      <div>
        <h2 id="assign-papers-title" className="text-sm font-semibold">
          布置给学生
        </h2>
        <p className="app-muted-text mt-1 text-xs">选择一套平台试卷，指定学生与时间后发布。</p>
      </div>
      <ul className="divide-y border bg-[var(--card)]" style={{ borderColor: "var(--border-subtle)" }}>
        {papers.map((paper) => (
          <li key={paper.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{paper.title}</p>
              <p className="app-muted-text mt-0.5 text-[11px]">
                {paper.paperType === "exam" ? "考试卷" : "作业卷"} · {paper.questionCount} 题 · {paper.totalPoints} 分 ·{" "}
                <span className="font-mono">{paper.paperCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(paper.id)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <UsersRound size={14} />
              指向学生并发布
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <AssignDialog
          key={selected.id}
          paper={selected}
          students={students}
          courses={courses}
          canTargetAllStudents={canTargetAllStudents}
          onClose={() => setSelectedId("")}
        />
      )}
    </section>
  );
}

function AssignDialog({
  paper,
  students,
  courses,
  canTargetAllStudents,
  onClose,
}: {
  paper: AssignablePaper;
  students: AssignStudentOption[];
  courses: AssignCourseOption[];
  canTargetAllStudents: boolean;
  onClose: () => void;
}) {
  const boundAction = publishAssessmentPaperAction.bind(null, paper.paperType);
  const [state, formAction, pending] = useActionState(boundAction, initialLearningAssignmentActionState);
  const [scope, setScope] = useState(canTargetAllStudents ? "all_students" : "selected_students");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isExam = paper.paperType === "exam";

  const [defaults] = useState(() => {
    const now = Date.now();
    const start = new Date(now + 60 * 60 * 1000);
    const due = new Date(now + (isExam ? 3 * 60 : 7 * 24 * 60) * 60 * 1000);
    return {
      start: localDateTimeValue(start),
      due: localDateTimeValue(due),
      release: localDateTimeValue(new Date(due.getTime() + 24 * 60 * 60 * 1000)),
    };
  });

  const visibleStudents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return students.filter(
      (student) => !keyword || `${student.name} ${student.email} ${student.tier}`.toLowerCase().includes(keyword),
    );
  }, [query, students]);

  const succeeded = state.status === "success";

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/20" role="presentation" onClick={() => !pending && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-dialog-title"
        className="app-card flex h-dvh w-full max-w-[720px] flex-col overflow-hidden border-l"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="app-muted-text font-mono text-[11px] font-bold">
              {paper.paperCode} · 版本 {paper.version}
            </p>
            <h2 id="assign-dialog-title" className="mt-1 text-lg font-semibold">
              {paper.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border"
          >
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <input type="hidden" name="paper_id" value={paper.id} />

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold">发布范围</legend>
              {canTargetAllStudents && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" name="target_scope" value="all_students" checked={scope === "all_students"} onChange={() => setScope("all_students")} />
                  本应用全部学生
                </label>
              )}
              <label className="flex items-center gap-2 text-xs">
                <input type="radio" name="target_scope" value="selected_students" checked={scope === "selected_students"} onChange={() => setScope("selected_students")} />
                指定学生
              </label>
              {scope === "selected_students" && (
                <div className="space-y-2 border p-3" style={{ borderColor: "var(--border-subtle)" }}>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索姓名或邮箱"
                    aria-label="搜索学生"
                    className="app-input w-full rounded-lg border px-3 py-2 text-xs"
                  />
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {visibleStudents.map((student) => (
                      <li key={student.id}>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            value={student.id}
                            checked={chosen.has(student.id)}
                            onChange={() =>
                              setChosen((current) => {
                                const next = new Set(current);
                                if (next.has(student.id)) next.delete(student.id);
                                else next.add(student.id);
                                return next;
                              })
                            }
                          />
                          <span className="font-medium">{student.name}</span>
                          <span className="app-muted-text">{student.email} · {student.tier}</span>
                        </label>
                      </li>
                    ))}
                    {visibleStudents.length === 0 && <li className="app-muted-text text-xs">没有符合条件的学生。</li>}
                  </ul>
                  {/* 提交的名单来自这里，而不是当前可见的复选框：搜索过滤会让已选学生的复选框消失 */}
                  {[...chosen].map((id) => (
                    <input key={id} type="hidden" name="target_ids" value={id} />
                  ))}
                  <p className="app-muted-text text-[11px]">已选 {chosen.size} 人</p>
                </div>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[11px] font-bold">
                开始时间
                <input name="starts_at" type="datetime-local" required defaultValue={defaults.start} className={inputClass} />
              </label>
              <label className="text-[11px] font-bold">
                截止时间
                <input name="due_at" type="datetime-local" required defaultValue={defaults.due} className={inputClass} />
              </label>
              <p className="app-muted-text text-[11px] sm:col-span-2">时间按韩国标准时间（UTC+9）记录。</p>
              {courses.length > 0 && (
                <label className="text-[11px] font-bold sm:col-span-2">
                  关联课程（可选）
                  <select name="course_id" defaultValue="" className={inputClass}>
                    <option value="">不关联课程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {isExam && (
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2" style={{ borderColor: "var(--border-subtle)" }}>
                <label className="text-[11px] font-bold">
                  允许提交次数（1–10）
                  <input name="max_attempts" type="number" min={1} max={10} step={1} defaultValue={1} required className={inputClass} />
                </label>
                <label className="text-[11px] font-bold">
                  成绩公开时间
                  <input name="grade_release_at" type="datetime-local" required defaultValue={defaults.release} className={inputClass} />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input name="allow_late_submission" type="checkbox" />
                  截止后仍允许提交
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input name="shuffle_questions" type="checkbox" />
                  打乱题目顺序
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input name="shuffle_options" type="checkbox" />
                  打乱选项顺序
                </label>
              </div>
            )}

            <label className="block text-[11px] font-bold">
              机构通知（可选）
              <textarea name="institution_note" rows={2} maxLength={2000} placeholder="可填写学习提醒，不会改变平台试卷内容。" className={`${inputClass} resize-y leading-5`} />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <p role="status" className="min-w-0 text-xs font-semibold">
              {state.status !== "idle" ? state.message : ""}
            </p>
            <button
              type="submit"
              disabled={pending || succeeded || (scope === "selected_students" && chosen.size === 0)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Send size={14} />
              {succeeded ? "已发布" : "发布"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
