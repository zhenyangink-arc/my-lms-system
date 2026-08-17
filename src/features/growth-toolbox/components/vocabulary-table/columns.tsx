"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { GrowthToolboxVocabularyItem } from "../../api/types";
import { VocabularyCellAction } from "../lazy-growth-toolbox-action-dialogs";

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

export function getGrowthToolboxVocabularyColumns(
  studentAppId: string,
  canManage: boolean,
): ColumnDef<GrowthToolboxVocabularyItem>[] {
  return [
  {
    accessorKey: "ko",
    header: sortableHeader("韩语词汇"),
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-semibold text-[var(--foreground)]">{row.original.ko || "—"}</p>
        <p className="mt-0.5 text-[11px] text-[var(--foreground-muted)]">
          {row.original.transcription || "暂无音标"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "zh",
    header: sortableHeader("中文释义"),
    cell: ({ row }) => (
      <span className="block min-w-40 font-medium text-[var(--foreground-secondary)]">
        {row.original.zh || "—"}
      </span>
    ),
  },
  {
    accessorKey: "pos",
    header: sortableHeader("词性"),
    cell: ({ row }) => row.original.pos || "未填写",
  },
  {
    accessorKey: "collocation",
    header: sortableHeader("搭配与说明"),
    cell: ({ row }) => (
      <span className="block min-w-64 max-w-96 whitespace-normal text-[var(--foreground-secondary)]">
        {row.original.collocation || "暂无"}
      </span>
    ),
  },
  {
    accessorKey: "source",
    header: sortableHeader("来源"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${
          row.original.source === "textbook"
            ? "bg-sky-50 text-sky-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {row.original.source === "textbook" ? "互动教材" : "自定义"}
      </span>
    ),
  },
  {
    accessorKey: "sortOrder",
    header: sortableHeader("排序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.sortOrder}</span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="block text-right">操作</span>,
    cell: ({ row }) => canManage ? (
      <VocabularyCellAction studentAppId={studentAppId} item={row.original} />
    ) : (
      <span className="block text-right text-[11px] text-[var(--foreground-muted)]">只读</span>
    ),
  },
  ];
}
