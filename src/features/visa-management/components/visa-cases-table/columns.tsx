"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { VisaManagementCase } from "../../api/types";
import { VisaCaseCellAction } from "./cell-action";

export const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

export const CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻华领馆递签",
  korea_immigration: "韩国出入境返签",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  admin_preparing: "机构准备中",
  planning: "材料运输中",
  preparing: "学生确认材料",
  ready_to_submit: "准备递签",
  submitted: "已经递签",
  additional_documents: "等待补件",
  approved: "签证批准",
  issued: "已经获签",
  closed: "已经关闭",
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

export function getVisaCaseColumns(
  dashboardBasePath: string,
): ColumnDef<VisaManagementCase>[] {
  return [
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
          {row.original.studentEmail || "未读取邮箱"}
        </p>
      </div>
    ),
  },
  {
    id: "target",
    accessorKey: "universityName",
    header: sortableHeader("目标院校"),
    cell: ({ row }) => (
      <div className="min-w-48">
        <p className="font-medium">{row.original.universityName}</p>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
          {[row.original.programName, row.original.admissionTrack]
            .filter(Boolean)
            .join(" · ") || "项目待确认"}
        </p>
      </div>
    ),
  },
  {
    id: "visa_type",
    accessorKey: "visaType",
    header: sortableHeader("签证类型"),
    cell: ({ row }) => VISA_TYPE_LABELS[row.original.visaType],
  },
  {
    id: "channel",
    accessorKey: "applicationChannel",
    header: sortableHeader("办理通道"),
    cell: ({ row }) => CHANNEL_LABELS[row.original.applicationChannel],
  },
  {
    id: "status",
    accessorKey: "caseStatus",
    header: sortableHeader("办理阶段"),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--support)]">
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        {CASE_STATUS_LABELS[row.original.caseStatus] ?? row.original.caseStatus}
      </span>
    ),
  },
  {
    id: "progress",
    accessorFn: (row) =>
      row.tasks.filter((task) => task.status === "approved").length,
    header: sortableHeader("任务进度"),
    cell: ({ row }) => {
      const approved = row.original.tasks.filter(
        (task) => task.status === "approved",
      ).length;
      return (
        <span className="font-mono tabular-nums">
          {approved} / {row.original.tasks.length}
        </span>
      );
    },
  },
  {
    id: "entry_date",
    accessorFn: (row) => row.plannedEntryDate ?? row.targetEntryDate ?? "",
    header: sortableHeader("入境日期"),
    cell: ({ row }) =>
      row.original.plannedEntryDate ?? row.original.targetEntryDate ?? "待确认",
  },
  {
    id: "updated_at",
    accessorKey: "updatedAt",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--foreground-muted)]">
        <LocalDateTime
          value={row.original.updatedAt}
          options={DATE_TIME_OPTIONS}
        />
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">档案操作</span>,
    cell: ({ row }) => (
      <VisaCaseCellAction
        item={row.original}
        dashboardBasePath={dashboardBasePath}
      />
    ),
  },
  ];
}
