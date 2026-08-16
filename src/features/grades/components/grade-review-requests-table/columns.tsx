"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type {
  GradeReviewRequest,
  GradeReviewSourceType,
  GradeReviewStatus,
} from "../../api/types";
import { GradeReviewAction } from "./grade-review-action";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const STATUS_LABELS: Record<GradeReviewStatus, string> = {
  pending: "待处理",
  reviewing: "复核中",
  resolved: "已完成",
  rejected: "未调整",
};

const SOURCE_LABELS: Record<GradeReviewSourceType, string> = {
  assignment_submission: "作业／考试",
  chapter_test_attempt: "章节测试",
  manual_grade_record: "历史成绩",
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

export function getGradeReviewColumns(
  canResolveReviews: boolean,
  studentAppId?: string,
): ColumnDef<GradeReviewRequest>[] {
  return [
  {
    id: "student",
    accessorKey: "student_name",
    header: sortableHeader("学生"),
    cell: ({ row }) => (
      <span className="font-semibold text-[var(--app-text)]">
        {row.original.student_name}
      </span>
    ),
  },
  {
    id: "source",
    accessorKey: "source_type",
    header: sortableHeader("成绩来源"),
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="font-semibold text-[var(--app-text)]">
          {row.original.source_title || "历史成绩"}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
          {SOURCE_LABELS[row.original.source_type]}
          {row.original.source_score != null &&
          row.original.source_total_points != null
            ? ` · ${row.original.source_score} / ${row.original.source_total_points} 分`
            : ""}
        </p>
      </div>
    ),
  },
  {
    id: "reason",
    accessorKey: "reason",
    header: sortableHeader("申请原因"),
    cell: ({ row }) => (
      <p className="max-w-md whitespace-pre-wrap text-xs leading-5">
        {row.original.reason}
      </p>
    ),
  },
  {
    id: "requested_at",
    accessorKey: "requested_at",
    header: sortableHeader("申请时间"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
        <LocalDateTime
          value={row.original.requested_at}
          options={DATE_TIME_OPTIONS}
        />
      </span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => {
      const status = row.original.status;
      const color =
        status === "resolved"
          ? "var(--app-success)"
          : status === "rejected"
            ? "var(--app-muted)"
            : "var(--app-warm)";
      return (
        <span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
          {STATUS_LABELS[status]}
        </span>
      );
    },
  },
  {
    id: "response",
    accessorKey: "response",
    header: sortableHeader("处理说明"),
    cell: ({ row }) => (
      <p className="max-w-sm whitespace-pre-wrap text-xs text-[var(--app-muted)]">
        {row.original.response || "尚未填写处理说明"}
      </p>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">复核操作</span>,
    cell: ({ row }) =>
      canResolveReviews ? (
        <GradeReviewAction
          reviewId={row.original.id}
          response={row.original.response}
          studentAppId={studentAppId}
        />
      ) : (
        <span className="text-[10px] text-[var(--app-muted)]">仅查看</span>
      ),
  },
  ];
}
