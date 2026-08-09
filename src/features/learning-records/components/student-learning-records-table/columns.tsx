"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { StudentLearningRecordDetailDialog } from "./student-learning-record-detail-dialog";
import type { StudentLearningRecordTableRow } from "./types";

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

function Count({ value, detail }: { value: number; detail?: string }) {
  return (
    <div>
      <p className="font-mono font-semibold tabular-nums">{value.toLocaleString("zh-CN")}</p>
      {detail && <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">{detail}</p>}
    </div>
  );
}

export const studentLearningRecordColumns: ColumnDef<StudentLearningRecordTableRow>[] = [
  {
    id: "student",
    accessorFn: (row) => row.full_name || row.email || row.student_id,
    header: sortableHeader("学生"),
    cell: ({ row }) => {
      const student = row.original;
      const name = student.full_name?.trim() || "未填写姓名";
      return (
        <div className="min-w-48">
          <p className="truncate font-semibold text-[var(--app-text)]">{name}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
            {student.email || `账号 …${student.student_id.slice(-8)}`}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "membership_tier",
    header: sortableHeader("会员档位"),
    cell: ({ row }) =>
      MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(row.original.membership_tier)],
  },
  {
    accessorKey: "completed_lesson_count",
    header: sortableHeader("课时进度"),
    cell: ({ row }) => (
      <Count value={row.original.completed_lesson_count} detail={`${row.original.active_lesson_count} 学习中`} />
    ),
  },
  {
    accessorKey: "submission_count",
    header: sortableHeader("任务提交"),
    cell: ({ row }) => (
      <Count value={row.original.submission_count} detail={`${row.original.graded_submission_count} 已批改`} />
    ),
  },
  {
    accessorKey: "conversation_practice_count",
    header: sortableHeader("会话练习"),
    cell: ({ row }) => <Count value={row.original.conversation_practice_count} />,
  },
  {
    accessorKey: "grade_count",
    header: sortableHeader("成绩记录"),
    cell: ({ row }) => <Count value={row.original.grade_count} />,
  },
  {
    accessorKey: "note_count",
    header: sortableHeader("人工辅导备注"),
    cell: ({ row }) => (
      <Count value={row.original.note_count} detail={`${row.original.attention_count} 项需关注`} />
    ),
  },
  {
    accessorKey: "last_learning_at",
    header: sortableHeader("最近学习"),
    cell: ({ row }) => (
      <span className="text-[11px] text-[var(--app-muted)]">
        <LocalDateTime value={row.original.last_learning_at} options={DATE_TIME_OPTIONS} fallback="尚未开始" />
      </span>
    ),
  },
  {
    id: "status",
    accessorFn: (row) =>
      row.attention_count > 0 ? "attention" : row.last_learning_at ? "learning" : "pending",
    header: sortableHeader("学习状态"),
    cell: ({ row }) => {
      const student = row.original;
      const status = student.attention_count > 0 ? "attention" : student.last_learning_at ? "learning" : "pending";
      const label = status === "attention" ? "需关注" : status === "learning" ? "学习中" : "待开始";
      const color = status === "attention" ? "var(--app-warm)" : status === "learning" ? "var(--app-success)" : "var(--app-muted)";
      return (
        <span className="inline-flex items-center gap-2 font-medium" style={{ color }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      );
    },
  },
  {
    id: "details",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">学生详情</span>,
    cell: ({ row }) => <StudentLearningRecordDetailDialog student={row.original} />,
  },
];
