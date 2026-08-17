"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { GrowthToolboxItem } from "../../api/types";
import {
  EditToolboxItemDialog,
  type GrowthToolboxCourseOption,
} from "../lazy-growth-toolbox-action-dialogs";

export type GrowthToolboxItemDisplayRow = GrowthToolboxItem & {
  relatedCourseTitle: string;
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

export function getGrowthToolboxItemColumns(
  courses: GrowthToolboxCourseOption[],
  studentAppId: string,
  canManage: boolean,
): ColumnDef<GrowthToolboxItemDisplayRow>[] {
  return [
  {
    accessorKey: "title",
    header: sortableHeader("工具入口"),
    cell: ({ row }) => (
      <div className="min-w-64 max-w-96">
        <p className="truncate font-semibold text-[var(--foreground)]">
          {row.original.title}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--foreground-muted)]">
          {row.original.description || "暂无说明"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "slug",
    header: sortableHeader("标识"),
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-[var(--foreground-secondary)]">
        {row.original.slug}
      </span>
    ),
  },
  {
    accessorKey: "relatedCourseTitle",
    header: sortableHeader("关联课程"),
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium text-[var(--foreground-secondary)]">
          {row.original.relatedCourseTitle}
        </p>
        {row.original.relatedCourseId && (
          <p className="mt-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">
            …{row.original.relatedCourseId.slice(-8)}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "href",
    header: sortableHeader("学生端路径"),
    cell: ({ row }) => (
      <span className="block min-w-56 truncate font-mono text-[11px] text-[var(--foreground-muted)]">
        {row.original.href}
      </span>
    ),
  },
  {
    accessorKey: "iconName",
    header: sortableHeader("图标"),
    cell: ({ row }) => (
      <span className="text-[var(--foreground-secondary)]">{row.original.iconName}</span>
    ),
  },
  {
    accessorKey: "isEnabled",
    header: sortableHeader("启停状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${
          row.original.isEnabled
            ? "bg-emerald-50 text-emerald-700"
            : "bg-zinc-100 text-zinc-600"
        }`}
      >
        {row.original.isEnabled ? "已启用" : "已停用"}
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
    cell: ({ row }) => (
      <div className="text-right">
        {canManage ? (
          <EditToolboxItemDialog
            studentAppId={studentAppId}
            item={row.original}
            courses={courses}
          />
        ) : (
          <span className="text-[11px] text-[var(--foreground-muted)]">只读</span>
        )}
      </div>
    ),
  },
  ];
}
