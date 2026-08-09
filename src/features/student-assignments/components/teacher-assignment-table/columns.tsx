"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { AssignmentMember } from "../../api/types";
import { AssignmentCellAction } from "./cell-action";

export type TeacherAssignmentDisplayRow = {
  id: string;
  teacher: AssignmentMember;
  student: AssignmentMember | null;
};

function memberName(member: AssignmentMember) {
  return member.full_name || "未填写姓名";
}

function memberAccount(member: AssignmentMember) {
  return member.login_id || member.email || `…${member.id.slice(-6)}`;
}

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />;
  };
}

export const teacherAssignmentColumns: ColumnDef<TeacherAssignmentDisplayRow>[] = [
  {
    id: "teacher",
    accessorFn: (row) => memberName(row.teacher),
    header: sortableHeader("负责老师"),
    cell: ({ row }) => <div className="min-w-44"><p className="font-semibold text-[var(--app-text)]">{memberName(row.original.teacher)}</p><p className="mt-0.5 text-[11px] text-[var(--app-muted)]">{memberAccount(row.original.teacher)}</p></div>,
  },
  {
    id: "student",
    accessorFn: (row) => row.student ? memberName(row.student) : "",
    header: sortableHeader("负责学生"),
    cell: ({ row }) => row.original.student
      ? <div className="min-w-44"><p className="font-medium text-[var(--app-text-soft)]">{memberName(row.original.student)}</p><p className="mt-0.5 text-[11px] text-[var(--app-muted)]">{memberAccount(row.original.student)}</p></div>
      : <span className="text-[var(--app-muted)]">暂无负责学生</span>,
  },
  {
    id: "assignmentStatus",
    accessorFn: (row) => row.student ? 1 : 0,
    header: sortableHeader("分配状态"),
    cell: ({ row }) => <span className={row.original.student ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{row.original.student ? "已分配" : "待分配"}</span>,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">操作</span>,
    cell: ({ row }) => row.original.student ? (
      <div className="flex justify-end">
        <AssignmentCellAction
          studentId={row.original.student.id}
          teacherId={row.original.teacher.id}
          studentName={memberName(row.original.student)}
          teacherName={memberName(row.original.teacher)}
        />
      </div>
    ) : null,
  },
];
