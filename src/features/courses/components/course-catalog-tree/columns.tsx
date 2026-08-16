"use client";

import Link from "next/link";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  Layers3,
} from "lucide-react";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { CourseCatalogNode, CourseCatalogNodeKind } from "../../api/types";
import {
  CourseCatalogCreateDialog,
  CourseCatalogEditDialog,
  getCreateChildTarget,
  type CourseCatalogActionOptions,
} from "../course-catalog-action-dialogs";
import { scopeDashboardPath } from "@/lib/dashboard-path";

export type CourseCatalogTreeRow = {
  key: string;
  id: string;
  kind: CourseCatalogNodeKind;
  kindLabel: string;
  title: string;
  slug: string;
  parentTitle: string;
  contentLabel: string;
  unlockMode: string;
  isPublished: boolean;
  isLocked: boolean;
  sortOrder: number;
  completeness: number;
  missingItems: string[];
  node: CourseCatalogNode;
  children: CourseCatalogTreeRow[];
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

function NodeIcon({ kind }: { kind: CourseCatalogNodeKind }) {
  if (kind === "category") return <Folder size={14} strokeWidth={1.7} />;
  if (kind === "course") return <BookOpen size={14} strokeWidth={1.7} />;
  if (kind === "lesson") return <Layers3 size={14} strokeWidth={1.7} />;
  return <FileText size={14} strokeWidth={1.7} />;
}

function StructureCell({ row }: { row: Row<CourseCatalogTreeRow> }) {
  return (
    <div
      className="flex min-w-72 items-center gap-2"
      style={{ paddingLeft: `${row.depth * 20}px` }}
    >
      {row.getCanExpand() ? (
        <button
          type="button"
          aria-label={row.getIsExpanded() ? "收起下级内容" : "展开下级内容"}
          aria-expanded={row.getIsExpanded()}
          onClick={row.getToggleExpandedHandler()}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-soft-bg)]"
        >
          <ChevronRight
            size={13}
            className={row.getIsExpanded() ? "rotate-90 transition-transform" : "transition-transform"}
          />
        </button>
      ) : (
        <span className="h-7 w-7 shrink-0" />
      )}
      <span className="shrink-0 text-[var(--app-muted)]">
        <NodeIcon kind={row.original.kind} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--app-text)]">
          {row.original.title}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--app-muted)]">
          {row.original.slug}
        </span>
      </span>
    </div>
  );
}

function StatusBadge({ row }: { row: CourseCatalogTreeRow }) {
  if (row.isLocked) {
    return (
      <span className="inline-flex bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-600">
        已锁定
      </span>
    );
  }
  return row.isPublished ? (
    <span className="inline-flex bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      已发布
    </span>
  ) : (
    <span className="inline-flex bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
      草稿
    </span>
  );
}

export function getCourseCatalogTreeColumns({
  canManage,
  options,
  dashboardBasePath,
  routeBasePath,
}: {
  canManage: boolean;
  options: CourseCatalogActionOptions;
  dashboardBasePath: string;
  routeBasePath?: string;
}): ColumnDef<CourseCatalogTreeRow>[] {
  const columns: ColumnDef<CourseCatalogTreeRow>[] = [
  {
    id: "structure",
    accessorFn: (row) => `${row.title} ${row.slug}`,
    header: sortableHeader("课程结构"),
    cell: ({ row }) => <StructureCell row={row} />,
  },
  {
    accessorKey: "kindLabel",
    header: sortableHeader("类型"),
    cell: ({ row }) => (
      <span className="text-[var(--app-text-soft)]">{row.original.kindLabel}</span>
    ),
  },
  {
    accessorKey: "parentTitle",
    header: sortableHeader("所属上级"),
    cell: ({ row }) => (
      <span className="block max-w-48 truncate text-[var(--app-muted)]">
        {row.original.parentTitle}
      </span>
    ),
  },
  {
    accessorKey: "contentLabel",
    header: sortableHeader("下级内容"),
    cell: ({ row }) => (
      <span className="text-[var(--app-text-soft)]">{row.original.contentLabel}</span>
    ),
  },
  {
    accessorKey: "completeness",
    header: sortableHeader("完整度"),
    cell: ({ row }) => (
      <div className="min-w-28">
        <div className="flex items-center gap-2">
          <span className="h-1 w-16 overflow-hidden bg-[var(--app-soft-bg)]">
            <span
              className="block h-full"
              style={{
                width: `${row.original.completeness}%`,
                backgroundColor:
                  row.original.completeness === 100
                    ? "var(--app-success)"
                    : "var(--app-warm)",
              }}
            />
          </span>
          <span className="font-mono text-[10px] tabular-nums">
            {row.original.completeness}%
          </span>
        </div>
        {row.original.missingItems.length > 0 && (
          <p
            className="mt-1 max-w-32 truncate text-[9px] text-[var(--app-muted)]"
            title={row.original.missingItems.join("、")}
          >
            缺少：{row.original.missingItems.join("、")}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "unlockMode",
    header: sortableHeader("开放方式"),
    cell: ({ row }) => (
      <span className="block max-w-44 truncate text-[var(--app-muted)]">
        {row.original.unlockMode}
      </span>
    ),
  },
  {
    id: "status",
    accessorFn: (row) =>
      row.isLocked ? "locked" : row.isPublished ? "published" : "draft",
    header: sortableHeader("状态"),
    cell: ({ row }) => <StatusBadge row={row.original} />,
  },
  {
    accessorKey: "sortOrder",
    header: sortableHeader("排序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums text-[var(--app-muted)]">
        {row.original.sortOrder}
      </span>
    ),
  },
  ];

  columns.push({
    id: "actions",
    enableSorting: false,
    header: () => <span className="block text-right">操作</span>,
    cell: ({ row }) => {
      const target = getCreateChildTarget(row.original.node, options);
      return (
        <div className="flex min-w-max justify-end gap-1.5">
          <Link
            href={
              routeBasePath
                ? `${routeBasePath}?node=${row.original.kind}&id=${row.original.id}#course-content`
                : scopeDashboardPath(
                    `/dashboard/admin/courses?node=${row.original.kind}&id=${row.original.id}#course-content`,
                    dashboardBasePath,
                  )
            }
            className="inline-flex h-8 items-center border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-[11px] font-semibold hover:bg-[var(--app-soft-bg)]"
          >
            查看内容
          </Link>
          {canManage && (
            <>
            <CourseCatalogEditDialog node={row.original.node} options={options} />
            {target && <CourseCatalogCreateDialog target={target} studentAppId={options.studentAppId} />}
            </>
          )}
        </div>
      );
    },
  });

  return columns;
}
