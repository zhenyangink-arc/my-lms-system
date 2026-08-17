"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { VisaTaskCellAction } from "./cell-action";
import type { VisaTaskDisplayRow } from "./types";

export const TASK_STAGE_LABELS: Record<string, string> = {
  admission: "入学许可",
  identity: "身份材料",
  finance: "资金材料",
  application: "申请表格",
  appointment: "预约递交",
  submission: "正式递签",
  result: "结果查询",
  entry: "入境安排",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "未开始",
  in_progress: "准备中",
  submitted: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "需要补充",
  blocked: "需要协助",
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function sortableHeader(title: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (descending?: boolean) => void;
    };
  }) {
    const direction = column.getIsSorted();
    return (
      <DataTableColumnHeader
        title={title}
        sortable
        direction={direction}
        onClick={() => column.toggleSorting(direction === "asc")}
      />
    );
  };
}

export const visaTaskColumns: ColumnDef<VisaTaskDisplayRow>[] = [
  {
    id: "student",
    accessorKey: "studentName",
    header: sortableHeader("学生"),
    cell: ({ row }) => (
      <div className="min-w-36">
        <p className="font-semibold text-[var(--foreground)]">
          {row.original.studentName}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
          {row.original.universityName}
        </p>
      </div>
    ),
  },
  {
    id: "stage",
    accessorKey: "stage",
    header: sortableHeader("任务阶段"),
    cell: ({ row }) => TASK_STAGE_LABELS[row.original.stage],
  },
  {
    id: "task",
    accessorKey: "title",
    header: sortableHeader("任务"),
    cell: ({ row }) => (
      <span className="min-w-48 font-medium">{row.original.title}</span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--support)]">
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        {TASK_STATUS_LABELS[row.original.status] ?? row.original.status}
      </span>
    ),
  },
  {
    id: "student_note",
    accessorKey: "studentNote",
    header: sortableHeader("学生说明"),
    cell: ({ row }) => (
      <p className="max-w-64 truncate text-[var(--foreground-muted)]">
        {row.original.studentNote || "—"}
      </p>
    ),
  },
  {
    id: "admin_note",
    accessorKey: "adminNote",
    header: sortableHeader("审核意见"),
    cell: ({ row }) => (
      <p className="max-w-64 truncate text-[var(--foreground-muted)]">
        {row.original.adminNote || "—"}
      </p>
    ),
  },
  {
    id: "submitted_at",
    accessorKey: "submittedAt",
    header: sortableHeader("提交时间"),
    cell: ({ row }) => (
      <LocalDateTime
        value={row.original.submittedAt}
        options={DATE_TIME_OPTIONS}
        fallback="尚未提交"
      />
    ),
  },
  {
    id: "updated_at",
    accessorKey: "updatedAt",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <LocalDateTime
        value={row.original.updatedAt}
        options={DATE_TIME_OPTIONS}
      />
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">审核操作</span>,
    cell: ({ row }) => <VisaTaskCellAction task={row.original} />,
  },
];
