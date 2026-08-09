"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  Layers3,
} from "lucide-react";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { CourseCatalogNodeKind } from "../../api/types";

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

export const courseCatalogTreeColumns: ColumnDef<CourseCatalogTreeRow>[] = [
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
