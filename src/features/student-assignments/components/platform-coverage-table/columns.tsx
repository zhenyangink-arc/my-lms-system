"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { PlatformTenantAssignmentRow } from "../../api/types";
import {
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
} from "../../constants/student-assignment-options";

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />;
  };
}

export const platformCoverageColumns: ColumnDef<PlatformTenantAssignmentRow>[] = [
  {
    accessorKey: "name",
    header: sortableHeader("机构"),
    cell: ({ row }) => <span className="font-semibold text-[var(--foreground)]">{row.original.name}</span>,
  },
  {
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => {
      const status = row.original.status;
      const tone = TENANT_STATUS_TONES[status] ?? TENANT_STATUS_TONES.archived;
      return <span className="inline-flex items-center gap-2 font-medium" style={{ color: tone.text }}><span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />{TENANT_STATUS_LABELS[status] ?? status}</span>;
    },
  },
  { accessorKey: "teacherCount", header: sortableHeader("老师数"), cell: ({ row }) => <span className="tabular-nums">{row.original.teacherCount}</span> },
  { accessorKey: "studentCount", header: sortableHeader("学生数"), cell: ({ row }) => <span className="tabular-nums">{row.original.studentCount}</span> },
  { accessorKey: "assignedCount", header: sortableHeader("已分配学生"), cell: ({ row }) => <span className="tabular-nums">{row.original.assignedCount}</span> },
  {
    id: "assignmentRate",
    accessorFn: (row) => row.studentCount > 0 ? row.assignedCount / row.studentCount : -1,
    header: sortableHeader("分配率"),
    cell: ({ row }) => row.original.studentCount > 0 ? `${Math.round((row.original.assignedCount / row.original.studentCount) * 100)}%` : "—",
  },
];
