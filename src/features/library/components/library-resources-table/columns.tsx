"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { LibraryCourseOption } from "@/app/dashboard/admin/library/LibraryResourceForm";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import {
  formatFileSize,
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  LIBRARY_STATUS_LABELS,
  type LibraryStatus,
} from "@/app/dashboard/library/config";
import { LibraryResourceCellAction } from "./cell-action";
import { ResourceDetailDialog } from "./resource-detail-dialog";
import type { LibraryResourceDisplayRow } from "./types";

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

function statusClass(status: LibraryStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-amber-50 text-amber-700";
  return "bg-zinc-100 text-zinc-700";
}

export function getLibraryResourceColumns({
  canCurate,
  courses,
}: {
  canCurate: boolean;
  courses: LibraryCourseOption[];
}): ColumnDef<LibraryResourceDisplayRow>[] {
  return [
  {
    accessorKey: "title",
    header: sortableHeader("资料名称"),
    cell: ({ row }) => (
      <div className="min-w-56 max-w-80">
        <div className="flex items-center gap-2">
          {row.original.is_featured && (
            <span className="shrink-0 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              推荐
            </span>
          )}
          <p className="truncate font-semibold text-[var(--foreground)]">
            {row.original.title}
          </p>
        </div>
        <p className="mt-1 truncate text-[11px] text-[var(--foreground-muted)]">
          {row.original.description || row.original.original_file_name || "暂无说明"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "courseLabel",
    header: sortableHeader("所属课程"),
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium text-[var(--foreground-secondary)]">
          {row.original.courseLabel}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
          {row.original.lessonLabel}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "groupTitle",
    header: sortableHeader("课程分组"),
  },
  {
    accessorKey: "category",
    header: sortableHeader("资料分类"),
    cell: ({ row }) => LIBRARY_CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "resource_type",
    header: sortableHeader("资料类型"),
    cell: ({ row }) => (
      <div className="min-w-24">
        <p>{LIBRARY_RESOURCE_TYPE_LABELS[row.original.resource_type]}</p>
        <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
          {formatFileSize(row.original.file_size)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: sortableHeader("状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${statusClass(row.original.status)}`}
      >
        {LIBRARY_STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: "download_count",
    header: sortableHeader("下载次数"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.original.download_count}
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
    accessorKey: "updated_at",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--foreground-muted)]">
        <LocalDateTime
          value={row.original.updated_at}
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
    header: () => <span className="sr-only">查看资料</span>,
    cell: ({ row }) => (
      <div className="flex min-w-64 items-center justify-end gap-1">
        <ResourceDetailDialog resource={row.original} />
        <LibraryResourceCellAction
          resource={row.original}
          course={courses.find(
            (course) =>
              (course.lesson_id ?? course.course_id) ===
              (row.original.lesson_id ?? row.original.course_id),
          )}
          courses={courses}
          canCurate={canCurate}
        />
      </div>
    ),
  },
  ];
}
