"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "@/app/dashboard/announcements/config";
import type { ManagedAnnouncement } from "../../api/types";
import { AnnouncementDetailDialog } from "./announcement-detail-dialog";
import { AnnouncementCellAction } from "./cell-action";

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

function statusClass(status: AnnouncementStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-amber-50 text-amber-700";
  return "bg-zinc-100 text-zinc-700";
}

function priorityClass(priority: AnnouncementPriority) {
  if (priority === "urgent") return "bg-rose-50 text-rose-700";
  if (priority === "important") return "bg-amber-50 text-amber-700";
  return "bg-sky-50 text-sky-700";
}

export const announcementColumns: ColumnDef<ManagedAnnouncement>[] = [
  {
    accessorKey: "title",
    header: sortableHeader("公告标题"),
    cell: ({ row }) => (
      <div className="min-w-56 max-w-80">
        <div className="flex items-center gap-2">
          {row.original.isPinned && (
            <span className="shrink-0 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
              置顶
            </span>
          )}
          <p className="truncate font-semibold text-[var(--app-text)]">
            {row.original.title}
          </p>
        </div>
        <p className="mt-1 truncate text-[11px] text-[var(--app-muted)]">
          {row.original.authorName}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "tenantName",
    header: sortableHeader("发布范围"),
    cell: ({ row }) =>
      row.original.scope === "platform" ? "全部机构" : row.original.tenantName,
  },
  {
    accessorKey: "category",
    header: sortableHeader("分类"),
    cell: ({ row }) => CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "priority",
    header: sortableHeader("优先级"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${priorityClass(row.original.priority)}`}
      >
        {PRIORITY_LABELS[row.original.priority]}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${statusClass(row.original.status)}`}
      >
        {STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    id: "readRate",
    accessorFn: (row) =>
      row.audienceCount > 0 ? row.readCount / row.audienceCount : 0,
    header: sortableHeader("阅读情况"),
    cell: ({ row }) => {
      const rate =
        row.original.audienceCount > 0
          ? Math.round(
              (row.original.readCount / row.original.audienceCount) * 100,
            )
          : 0;
      return (
        <div className="min-w-24">
          <p className="font-mono font-semibold tabular-nums">
            {row.original.readCount} / {row.original.audienceCount}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
            {row.original.status === "published" ? `${rate}%` : "尚未发布"}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "publishedAt",
    header: sortableHeader("发布时间"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
        <LocalDateTime
          value={row.original.publishedAt}
          options={DATE_OPTIONS}
          fallback="尚未发布"
        />
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
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
    header: () => <span className="sr-only">查看公告</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <AnnouncementDetailDialog announcement={row.original} />
        <AnnouncementCellAction announcement={row.original} />
      </div>
    ),
  },
];
