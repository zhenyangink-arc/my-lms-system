"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { CourseLessonResource } from "../../api/types";
import { LessonResourceRowActions } from "../lesson-resource-action-dialogs";

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  file: "文件",
  link: "链接",
  template: "模板",
  checklist: "清单",
  reference: "参考资料",
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

function ResourceStatus({ resource }: { resource: CourseLessonResource }) {
  if (resource.is_deleted) {
    return (
      <span className="inline-flex bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
        回收站
      </span>
    );
  }
  return resource.is_published ? (
    <span className="inline-flex bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      已发布
    </span>
  ) : (
    <span className="inline-flex bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
      已隐藏
    </span>
  );
}

export function getLessonResourceColumns({
  canManage,
  canPermanentlyDelete,
}: {
  canManage: boolean;
  canPermanentlyDelete: boolean;
}): ColumnDef<CourseLessonResource>[] {
  const columns: ColumnDef<CourseLessonResource>[] = [
  {
    accessorKey: "title",
    header: sortableHeader("资料名称"),
    cell: ({ row }) => (
      <div className="min-w-64 max-w-md">
        <p className="truncate font-semibold text-[var(--app-text)]">
          {row.original.title}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--app-muted)]">
          {row.original.description || "暂无说明"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "resource_type",
    header: sortableHeader("类型"),
    cell: ({ row }) => (
      <span className="text-[var(--app-text-soft)]">
        {RESOURCE_TYPE_LABELS[row.original.resource_type] ?? "其他资料"}
      </span>
    ),
  },
  {
    id: "source",
    accessorFn: (row) => row.original_file_name ?? row.resource_url ?? "",
    header: sortableHeader("资料来源"),
    cell: ({ row }) => (
      <span
        className="block max-w-72 truncate text-[var(--app-muted)]"
        title={row.original.original_file_name ?? row.original.resource_url ?? undefined}
      >
        {row.original.original_file_name ??
          row.original.resource_url ??
          "未填写来源"}
      </span>
    ),
  },
  {
    accessorKey: "is_required",
    header: sortableHeader("学习要求"),
    cell: ({ row }) => (
      <span className="text-[var(--app-text-soft)]">
        {row.original.is_required ? "必学" : "选学"}
      </span>
    ),
  },
  {
    id: "status",
    accessorFn: (row) =>
      row.is_deleted ? "deleted" : row.is_published ? "published" : "hidden",
    header: sortableHeader("当前状态"),
    cell: ({ row }) => <ResourceStatus resource={row.original} />,
  },
  {
    accessorKey: "sort_order",
    header: sortableHeader("排序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[var(--app-muted)]">
        {row.original.sort_order}
      </span>
    ),
  },
  ];
  if (canManage) {
    columns.push({
      id: "actions",
      enableSorting: false,
      header: () => <span className="block text-right">操作</span>,
      cell: ({ row }) => (
        <LessonResourceRowActions
          resource={row.original}
          canManage={canManage}
          canPermanentlyDelete={canPermanentlyDelete}
        />
      ),
    });
  }
  return columns;
}

export { RESOURCE_TYPE_LABELS };
