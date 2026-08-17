"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { GrowthToolboxGrammarItem } from "../../api/types";
import { GrammarCellAction } from "../growth-toolbox-action-dialogs";

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

function audioKeys(item: GrowthToolboxGrammarItem) {
  return [
    ...item.rows.map((row) => row.audio),
    ...item.examples.map((example) => example.audio),
  ].filter(Boolean);
}

export function getGrowthToolboxGrammarColumns(
  studentAppId: string,
  canManage: boolean,
): ColumnDef<GrowthToolboxGrammarItem>[] {
  return [
  {
    accessorKey: "title",
    header: sortableHeader("语法名称"),
    cell: ({ row }) => (
      <div className="min-w-56 max-w-80">
        <p className="font-semibold text-[var(--foreground)]">{row.original.title}</p>
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--foreground-muted)]">
          {row.original.meaning || "暂无中文含义"}
        </p>
      </div>
    ),
  },
  {
    id: "cases",
    accessorFn: (item) => item.cases.length,
    header: sortableHeader("收音情况"),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.cases.length} 项</span>
    ),
  },
  {
    id: "rows",
    accessorFn: (item) => item.rows.length,
    header: sortableHeader("形态组合"),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.rows.length} 项</span>
    ),
  },
  {
    id: "examples",
    accessorFn: (item) => item.examples.length,
    header: sortableHeader("例句"),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.examples.length} 条</span>
    ),
  },
  {
    id: "audio",
    accessorFn: (item) => audioKeys(item).length,
    header: sortableHeader("音频字段"),
    cell: ({ row }) => {
      const keys = audioKeys(row.original);
      return keys.length > 0 ? (
        <div className="min-w-48 max-w-72">
          <p className="font-medium text-[var(--foreground-secondary)]">
            已配置 {keys.length} 个音频
          </p>
          <p
            className="mt-0.5 truncate font-mono text-[10px] text-[var(--foreground-muted)]"
            title={keys.join("\n")}
          >
            {keys[0].split("/").pop()}
            {keys.length > 1 ? ` 等 ${keys.length} 个` : ""}
          </p>
        </div>
      ) : (
        <span className="text-[var(--foreground-muted)]">未配置</span>
      );
    },
  },
  {
    accessorKey: "caution",
    header: sortableHeader("注意事项"),
    cell: ({ row }) => (
      <span className="block min-w-56 max-w-80 whitespace-normal text-[var(--foreground-secondary)]">
        {row.original.caution || "暂无"}
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
      <GrammarCellAction studentAppId={studentAppId} item={row.original} />
    ) : (
      <span className="block text-right text-[11px] text-[var(--foreground-muted)]">只读</span>
    ),
  },
  ];
}
