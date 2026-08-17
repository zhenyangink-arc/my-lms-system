"use client";

import { useActionState, useState } from "react";

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
} from "@/app/dashboard/admin/student-assignments/actions";
import { initialStudentAssignmentActionState } from "@/app/dashboard/admin/student-assignments/state";
import type { AssignmentMember } from "../api/types";

export function AssignStudentsDialog({ students, teachers }: { students: AssignmentMember[]; teachers: AssignmentMember[] }) {
  const [state, formAction] = useActionState(assignStudentsToTeachersAction, initialStudentAssignmentActionState);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());

  return (
    <Dialog>
      <DialogTrigger type="button" className="inline-flex h-9 items-center rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800">分配学生</DialogTrigger>
      <DialogContent className="max-h-[min(760px,calc(100vh-32px))] w-full max-w-[680px] gap-0 overflow-y-auto p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-sm font-semibold">分配学生给负责老师</DialogTitle>
          <DialogDescription className="text-xs">可多选学生与多选老师；一个学生可同时归多位老师负责。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5 p-5">
          <MemberSelection
            title={`选择学生（已选 ${selectedStudents.size} 人）`}
            emptyText="本机构暂无学生账号"
            inputName="student_ids"
            members={students}
            selected={selectedStudents}
            onSelectedChange={setSelectedStudents}
          />
          <MemberSelection
            title={`选择负责老师（已选 ${selectedTeachers.size} 人）`}
            emptyText="本机构暂无老师账号，请先在账号管理创建老师"
            inputName="teacher_ids"
            members={teachers}
            selected={selectedTeachers}
            onSelectedChange={setSelectedTeachers}
          />
          {state.status !== "idle" && <p role="status" className={`rounded-md px-3 py-2 text-xs font-medium ${state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>}
          <button type="submit" disabled={selectedStudents.size === 0 || selectedTeachers.size === 0} className="h-9 w-full rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">确认分配</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberSelection({ title, emptyText, inputName, members, selected, onSelectedChange }: { title: string; emptyText: string; inputName: "student_ids" | "teacher_ids"; members: AssignmentMember[]; selected: Set<string>; onSelectedChange: (selected: Set<string>) => void }) {
  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold">{title}</p>
      <div className="grid max-h-[220px] grid-cols-2 gap-1 overflow-y-auto rounded-md border border-[var(--border)] p-2">
        {members.map((member) => {
          const checked = selected.has(member.id);
          return (
            <label key={member.id} className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs ${checked ? "bg-black/[0.035]" : ""}`}>
              <input type="checkbox" name={inputName} value={member.id} checked={checked} onChange={(event) => toggle(member.id, event.target.checked)} className="shrink-0 accent-neutral-900" />
              <span className="min-w-0 truncate font-medium">{member.full_name || "未填写姓名"}</span>
              <span className="min-w-0 truncate text-[var(--foreground-muted)]">{member.login_id || member.email || `…${member.id.slice(-6)}`}</span>
            </label>
          );
        })}
        {members.length === 0 && <p className="col-span-2 p-3 text-center text-xs text-[var(--foreground-muted)]">{emptyText}</p>}
      </div>
    </div>
  );
}
