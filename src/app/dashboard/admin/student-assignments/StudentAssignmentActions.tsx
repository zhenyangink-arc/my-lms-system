"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  assignStudentsToTeachersAction,
  removeStudentTeacherAssignmentAction,
} from "./actions";
import { initialStudentAssignmentActionState } from "./state";
import type { AssignmentMember } from "./page-content";

type AssignmentRow = { student_id: string; teacher_id: string };

function memberName(member: AssignmentMember | undefined) {
  return member?.full_name || "未填写姓名";
}

function memberSub(member: AssignmentMember | undefined) {
  if (!member) return "";
  return member.login_id || member.email || `…${member.id.slice(-6)}`;
}

export function AssignStudentsDialog({
  students,
  teachers,
}: {
  students: AssignmentMember[];
  teachers: AssignmentMember[];
}) {
  const [state, formAction] = useActionState(
    assignStudentsToTeachersAction,
    initialStudentAssignmentActionState
  );
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());

  const toggleStudent = (id: string, checked: boolean) => {
    setSelectedStudents((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleTeacher = (id: string, checked: boolean) => {
    setSelectedTeachers((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-9 items-center rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
      >
        分配学生
      </DialogTrigger>
      <DialogContent className="max-h-[min(760px,calc(100vh-32px))] w-full max-w-[680px] gap-0 overflow-y-auto p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left" style={{ borderColor: "var(--border)" }}>
          <DialogTitle className="text-sm font-semibold">分配学生给负责老师</DialogTitle>
          <DialogDescription className="text-xs">
            可多选学生与多选老师；一个学生可同时归多位老师负责。
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold">选择学生（已选 {selectedStudents.size} 人）</p>
            <div className="grid max-h-[220px] grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
              {students.map((student) => {
                const checked = selectedStudents.has(student.id);
                return (
                  <label
                    key={student.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${checked ? "bg-black/[0.035]" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="student_ids"
                      value={student.id}
                      checked={checked}
                      onChange={(event) => toggleStudent(student.id, event.target.checked)}
                      className="shrink-0 accent-neutral-900"
                    />
                    <span className="min-w-0 truncate font-medium">{memberName(student)}</span>
                    <span className="app-muted-text min-w-0 truncate">{memberSub(student)}</span>
                  </label>
                );
              })}
              {students.length === 0 && (
                <p className="app-muted-text col-span-2 p-3 text-center text-xs">本机构暂无学生账号</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold">选择负责老师（已选 {selectedTeachers.size} 人）</p>
            <div className="grid max-h-[180px] grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
              {teachers.map((teacher) => {
                const checked = selectedTeachers.has(teacher.id);
                return (
                  <label
                    key={teacher.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${checked ? "bg-black/[0.035]" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="teacher_ids"
                      value={teacher.id}
                      checked={checked}
                      onChange={(event) => toggleTeacher(teacher.id, event.target.checked)}
                      className="shrink-0 accent-neutral-900"
                    />
                    <span className="min-w-0 truncate font-medium">{memberName(teacher)}</span>
                    <span className="app-muted-text min-w-0 truncate">{memberSub(teacher)}</span>
                  </label>
                );
              })}
              {teachers.length === 0 && (
                <p className="app-muted-text col-span-2 p-3 text-center text-xs">本机构暂无老师账号，请先在账号管理创建老师</p>
              )}
            </div>
          </div>

          {state.status !== "idle" && (
            <p
              role="status"
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={selectedStudents.size === 0 || selectedTeachers.size === 0}
            className="h-9 w-full rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            确认分配
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeacherAssignmentList({
  teachers,
  students,
  assignments,
}: {
  teachers: AssignmentMember[];
  students: AssignmentMember[];
  assignments: AssignmentRow[];
}) {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const byTeacher = new Map<string, string[]>();
  for (const assignment of assignments) {
    const list = byTeacher.get(assignment.teacher_id) ?? [];
    list.push(assignment.student_id);
    byTeacher.set(assignment.teacher_id, list);
  }

  return (
    <section className="app-card overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold">老师与负责学生</h2>
        <span className="app-muted-text text-[11px]">{teachers.length} 位老师</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b text-[11px] font-medium" style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}>
              <th className="w-[24%] px-4 py-2.5 font-medium">负责老师</th>
              <th className="px-4 py-2.5 font-medium">负责学生</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => {
              const studentIds = byTeacher.get(teacher.id) ?? [];
              return (
                <tr key={teacher.id} className="border-b text-xs last:border-b-0 hover:bg-black/[0.018]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold"
                        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}
                      >
                        {(teacher.full_name || "?").slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{teacher.full_name || "未填写姓名"}</p>
                        <p className="app-muted-text mt-0.5 truncate text-[11px]">{memberSub(teacher)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {studentIds.length === 0 ? (
                      <span className="app-muted-text">暂无负责学生</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {studentIds.map((studentId) => {
                          const student = studentById.get(studentId);
                          return (
                            <span
                              key={studentId}
                              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <span className="font-medium">{memberName(student)}</span>
                              <span className="app-muted-text">{memberSub(student)}</span>
                              <form action={removeStudentTeacherAssignmentAction} className="inline-flex">
                                <input type="hidden" name="student_id" value={studentId} />
                                <input type="hidden" name="teacher_id" value={teacher.id} />
                                <button
                                  type="submit"
                                  aria-label={`解除 ${memberName(student)} 与 ${teacher.full_name || "该老师"} 的负责关系`}
                                  title="解除负责"
                                  className="app-muted-text rounded p-0.5 transition hover:text-rose-600"
                                >
                                  <X size={12} />
                                </button>
                              </form>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-xs">
                  本机构还没有老师账号
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
