"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { APPLICATION_STAGE_LABELS } from "@/app/dashboard/documents/constants";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import type { DocumentReviewApplication } from "../../api/types";
import { DocumentReviewApplicationDialog } from "./document-review-application-dialog";

const REVIEW_LABELS: Record<DocumentReviewApplication["reviewStatus"], string> = {
  preparing: "准备中",
  pending_review: "待确认",
  revision_required: "需补充",
  approved: "已确认",
};

const REVIEW_COLORS: Record<DocumentReviewApplication["reviewStatus"], string> = {
  preparing: "var(--app-muted)",
  pending_review: "var(--app-warm)",
  revision_required: "#dc2626",
  approved: "var(--app-success)",
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

export function getDocumentReviewApplicationColumns(
  dashboardBasePath: string,
): ColumnDef<DocumentReviewApplication>[] {
  return [
  {
    id: "student",
    accessorFn: (row) => row.studentName || row.studentEmail || row.studentId,
    header: sortableHeader("学生"),
    cell: ({ row }) => (
      <div className="min-w-48">
        <p className="truncate font-semibold text-[var(--app-text)]">
          {row.original.studentName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
          {row.original.studentEmail || `账号 …${row.original.studentId.slice(-8)}`}
        </p>
      </div>
    ),
  },
  {
    id: "application",
    accessorFn: (row) => `${row.universityName} ${row.programName ?? ""}`,
    header: sortableHeader("目标大学与项目"),
    cell: ({ row }) => (
      <div className="min-w-56">
        <p className="font-semibold text-[var(--app-text)]">{row.original.universityName}</p>
        <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
          {row.original.admissionTrackLabel}
          {row.original.programName ? ` · ${row.original.programName}` : ""}
        </p>
      </div>
    ),
  },
  {
    id: "document_progress",
    accessorFn: (row) => row.documents.filter((item) => item.status !== "preparing").length,
    header: sortableHeader("资料进度"),
    cell: ({ row }) => {
      const resolved = row.original.documents.filter(
        (item) => item.status !== "preparing",
      ).length;
      return (
        <span className="font-mono font-semibold tabular-nums">
          {resolved}/{row.original.documents.length}
        </span>
      );
    },
  },
  {
    accessorKey: "applicationStage",
    header: sortableHeader("申请阶段"),
    cell: ({ row }) =>
      APPLICATION_STAGE_LABELS[row.original.applicationStage] ?? "阶段待确认",
  },
  {
    accessorKey: "reviewStatus",
    header: sortableHeader("审核状态"),
    cell: ({ row }) => {
      const status = row.original.reviewStatus;
      const color = REVIEW_COLORS[status];
      return (
        <span className="inline-flex items-center gap-2 font-medium" style={{ color }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          {REVIEW_LABELS[status]}
        </span>
      );
    },
  },
  {
    id: "lockStatus",
    accessorFn: (row) => (row.documentsLockedAt ? "locked" : "editable"),
    header: sortableHeader("学生端状态"),
    cell: ({ row }) => (row.original.documentsLockedAt ? "已锁定" : "可编辑"),
  },
  {
    id: "details",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">申请单详情</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        <DocumentReviewApplicationDialog application={row.original} />
        <Link
          href={scopeDashboardPath(
            `/dashboard/admin/documents/${row.original.studentId}?target=${row.original.id}`,
            dashboardBasePath,
          )}
          className="inline-flex h-8 items-center border border-[var(--app-border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
        >
          管理资料
        </Link>
      </div>
    ),
  },
  ];
}
