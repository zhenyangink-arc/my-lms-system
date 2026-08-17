"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  HELP_ARTICLE_CATEGORY_LABELS,
  HELP_ARTICLE_STATUS_LABELS,
  type HelpArticleStatus,
} from "@/app/dashboard/help/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { ManagedHelpArticle } from "../../api/types";
import { HelpArticleRowActions } from "../help-article-actions";

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

function statusClass(status: HelpArticleStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-amber-50 text-amber-700";
  return "bg-zinc-100 text-zinc-700";
}

export const helpArticleColumns: ColumnDef<ManagedHelpArticle>[] = [
  {
    accessorKey: "title",
    header: sortableHeader("文章"),
    cell: ({ row }) => (
      <div className="min-w-64 max-w-xl">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-[var(--foreground)]">
            {row.original.title}
          </p>
          {row.original.is_featured && (
            <span className="shrink-0 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
              推荐
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--foreground-muted)]">
          {row.original.summary || "暂无摘要"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: sortableHeader("分类"),
    cell: ({ row }) => HELP_ARTICLE_CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${statusClass(row.original.status)}`}
      >
        {HELP_ARTICLE_STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: "sort_order",
    header: sortableHeader("排序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.sort_order}</span>
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
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">文章操作</span>,
    cell: ({ row }) => <HelpArticleRowActions article={row.original} />,
  },
];
