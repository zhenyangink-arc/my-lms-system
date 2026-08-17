"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { AssignmentMember } from "../../api/types";

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />;
  };
}

export const unassignedStudentColumns: ColumnDef<AssignmentMember>[] = [
  { accessorKey: "full_name", header: sortableHeader("学生姓名"), cell: ({ row }) => <span className="font-semibold text-[var(--foreground)]">{row.original.full_name || "未填写姓名"}</span> },
  { accessorKey: "login_id", header: sortableHeader("登录账号"), cell: ({ row }) => row.original.login_id || "—" },
  { accessorKey: "email", header: sortableHeader("电子邮箱"), cell: ({ row }) => row.original.email || "—" },
  { id: "status", header: "分配状态", cell: () => <span className="font-medium text-amber-700">待分配</span> },
];
