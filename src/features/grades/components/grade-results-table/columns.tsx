"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { LiveGradeResult } from "../../api/types";
import { GradeResultAction } from "./grade-result-action";

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

export function getGradeResultColumns(
  canManageGrades: boolean,
): ColumnDef<LiveGradeResult>[] {
  return [
  {
    id: "student",
    accessorKey: "student_name",
    header: sortableHeader("学生"),
    cell: ({ row }) => (
      <span className="font-semibold text-[var(--foreground)]">
        {row.original.student_name}
      </span>
    ),
  },
  {
    id: "source",
    accessorKey: "source_type",
    header: sortableHeader("来源"),
    cell: ({ row }) =>
      row.original.source_type === "assignment_submission"
        ? "作业／考试"
        : "章节测试",
  },
  {
    id: "course",
    accessorKey: "course_name",
    header: sortableHeader("课程"),
  },
  {
    id: "content",
    accessorKey: "title",
    header: sortableHeader("考核内容"),
    cell: ({ row }) => (
      <div className="min-w-56">
        <p className="font-semibold text-[var(--foreground)]">
          {row.original.title}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
          {row.original.type_label} · {row.original.detail}
        </p>
      </div>
    ),
  },
  {
    id: "score",
    accessorFn: (row) =>
      row.total_points ? (row.score / row.total_points) * 100 : 0,
    header: sortableHeader("成绩"),
    cell: ({ row }) => {
      const result = row.original;
      const percent = result.total_points
        ? (result.score / result.total_points) * 100
        : 0;
      return (
        <div>
          <p className="font-mono font-semibold tabular-nums">
            {result.score} / {result.total_points}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
            {percent.toFixed(1)}%
          </p>
        </div>
      );
    },
  },
  {
    id: "result",
    accessorFn: (row) => (row.passed ? 1 : 0),
    header: sortableHeader("结果"),
    cell: ({ row }) => (
      <div>
        <span
          className="inline-flex items-center gap-1.5 font-medium"
          style={{
            color: row.original.passed
              ? "var(--status-success)"
              : "var(--status-warning)",
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: "currentColor" }}
          />
          {row.original.result_label}
        </span>
        {row.original.review_status && (
          <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
            已提交复核
          </p>
        )}
      </div>
    ),
  },
  {
    id: "recorded_at",
    accessorKey: "recorded_at",
    header: sortableHeader("记录时间"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--foreground-muted)]">
        <LocalDateTime
          value={row.original.recorded_at}
          options={DATE_TIME_OPTIONS}
        />
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">成绩操作</span>,
    cell: ({ row }) =>
      canManageGrades ? (
        <GradeResultAction result={row.original} />
      ) : (
        <span className="text-[10px] text-[var(--foreground-muted)]">仅查看</span>
      ),
  },
  ];
}
