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
      className="flex min-w-72 items-center gap-2.5"
      style={{ paddingLeft: `${row.depth * 24}px` }}
    >
      {row.getCanExpand() ? (
        <button
          type="button"
          aria-label={row.getIsExpanded() ? "收起下级内容" : "展开下级内容"}
          aria-expanded={row.getIsExpanded()}
          onClick={row.getToggleExpandedHandler()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ChevronRight
            size={13}
            className={row.getIsExpanded() ? "rotate-90 transition-transform" : "transition-transform"}
          />
        </button>
      ) : (
        <span className="h-8 w-8 shrink-0" />
      )}
      <span className="shrink-0 text-[var(--foreground-muted)]">
        <NodeIcon kind={row.original.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[var(--foreground)]">
            {row.original.title}
          </span>
          <span className="shrink-0 rounded-sm bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--foreground-muted)]">
            {row.original.kindLabel}
          </span>
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--foreground-muted)]">
          {row.original.slug}
        </span>
      </span>
    </div>
  );
}

function StructureHealthCell({ row }: { row: CourseCatalogTreeRow }) {
  return (
    <div className="min-w-44">
      <p className="text-[11px] font-medium text-[var(--foreground-secondary)]">{row.contentLabel}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${row.completeness}%`,
              backgroundColor: row.completeness === 100 ? "var(--status-success)" : "var(--status-warning)",
            }}
          />
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--foreground-muted)]">{row.completeness}%</span>
      </div>
      {row.missingItems.length > 0 && (
        <p className="mt-1.5 max-w-52 truncate text-[9px] text-[var(--foreground-muted)]" title={row.missingItems.join("、")}>
          待补：{row.missingItems.join("、")}
        </p>
      )}
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
      已上架
    </span>
  ) : (
    <span className="inline-flex bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
      未上架
    </span>
  );
}

function PublicationCell({ row }: { row: CourseCatalogTreeRow }) {
  return (
    <div className="min-w-36 space-y-1.5">
      <StatusBadge row={row} />
      <p className="truncate text-[10px] text-[var(--foreground-muted)]" title={row.unlockMode}>
        {row.unlockMode}
        <span className="mx-1.5" aria-hidden="true">·</span>
        排序 {row.sortOrder}
      </p>
    </div>
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
    header: sortableHeader("目录结构"),
    cell: ({ row }) => <StructureCell row={row} />,
  },
  {
    accessorKey: "completeness",
    header: sortableHeader("结构情况"),
    cell: ({ row }) => <StructureHealthCell row={row.original} />,
  },
  {
    id: "status",
    accessorFn: (row) =>
      row.isLocked ? "locked" : row.isPublished ? "published" : "draft",
    header: sortableHeader("上架与开放"),
    cell: ({ row }) => <PublicationCell row={row.original} />,
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
            className="inline-flex h-8 items-center border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-semibold hover:bg-[var(--surface-soft)]"
          >
            查看结构
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
