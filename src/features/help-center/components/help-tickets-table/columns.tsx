"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import {
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import type { ManagedHelpTicket } from "../../api/types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
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

function statusClass(status: HelpTicketStatus) {
  if (status === "open") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  if (status === "waiting_student") return "bg-amber-50 text-amber-700";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-zinc-100 text-zinc-700";
}

function priorityClass(priority: HelpTicketPriority) {
  return priority === "urgent"
    ? "bg-rose-50 text-rose-700"
    : "bg-zinc-100 text-zinc-700";
}

export function getHelpTicketColumns(
  dashboardBasePath: string,
): ColumnDef<ManagedHelpTicket>[] {
  return [
  {
    accessorKey: "subject",
    header: sortableHeader("问题"),
    cell: ({ row }) => (
      <div className="min-w-60 max-w-md">
        <p className="truncate font-semibold text-[var(--foreground)]">
          {row.original.subject}
        </p>
        <p className="mt-1 font-mono text-[10px] text-[var(--foreground-muted)]">
          工单 {row.original.id.slice(0, 8).toUpperCase()}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "studentName",
    header: sortableHeader("学生"),
  },
  {
    accessorKey: "category",
    header: sortableHeader("分类"),
    cell: ({ row }) => HELP_TICKET_CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "priority",
    header: sortableHeader("优先级"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${priorityClass(row.original.priority)}`}
      >
        {HELP_TICKET_PRIORITY_LABELS[row.original.priority]}
      </span>
    ),
  },
  {
    accessorKey: "assignedTeacherName",
    header: sortableHeader("分配人"),
  },
  {
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${statusClass(row.original.status)}`}
      >
        {HELP_TICKET_STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <span className="text-[var(--foreground-muted)]">
        <LocalDateTime
          value={row.original.updatedAt}
          options={DATE_OPTIONS}
          fallback="时间待确认"
        />
      </span>
    ),
  },
  {
    id: "details",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">查看工单</span>,
    cell: ({ row }) => (
      <Link
        href={scopeDashboardPath(
          `/dashboard/admin/help/tickets/${row.original.id}`,
          dashboardBasePath,
        )}
        className="inline-flex h-8 items-center border border-[var(--border)] px-3 text-[11px] font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
      >
        查看详情
      </Link>
    ),
  },
  ];
}
