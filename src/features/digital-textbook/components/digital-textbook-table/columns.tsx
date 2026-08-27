"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type {
  DigitalTextbookGrammarNode,
  DigitalTextbookVocabularyNode,
} from "../../api/types";
import { DigitalTextbookCellAction } from "./cell-action";

export type DigitalTextbookDisplayRow = {
  id: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  textbookId: string;
  textbookTitle: string;
  textbookSlug: string;
  textbookStatus: string;
  versionId: string;
  versionNumber: number;
  versionStatus: string;
  chapterId: string;
  chapterNumber: number;
  chapterSlug: string;
  chapterStatus: string;
  moduleCodes: string[];
  moduleCount: number;
  nodeCount: number;
  vocabularyCount: number;
  grammarCount: number;
  vocabularyNodes: DigitalTextbookVocabularyNode[];
  grammarNodes: DigitalTextbookGrammarNode[];
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

function statusLabel(status: string) {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "已归档";
  return "其他状态";
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "draft"
        ? "bg-amber-50 text-amber-700"
        : "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex px-2 py-1 text-[11px] font-semibold ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function PublishingSummary({ row }: { row: DigitalTextbookDisplayRow }) {
  return (
    <dl className="grid min-w-44 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
      <dt className="text-[10px] text-[var(--foreground-muted)]">教材</dt>
      <dd><StatusBadge status={row.textbookStatus} /></dd>
      <dt className="text-[10px] text-[var(--foreground-muted)]">版本</dt>
      <dd><StatusBadge status={row.versionStatus} /></dd>
      <dt className="text-[10px] text-[var(--foreground-muted)]">本章</dt>
      <dd><StatusBadge status={row.chapterStatus} /></dd>
    </dl>
  );
}

function ContentSummary({ row }: { row: DigitalTextbookDisplayRow }) {
  return (
    <div className="min-w-52">
      <div className="flex flex-wrap gap-1">
        {row.moduleCodes.length > 0 ? (
          row.moduleCodes.map((code) => (
            <span key={`${row.id}:${code}`} className="bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-medium text-[var(--foreground-secondary)]">
              {moduleLabel(code)}
            </span>
          ))
        ) : (
          <span className="text-[var(--foreground-muted)]">暂无模块</span>
        )}
      </div>
      <p className="mt-2 text-[10px] text-[var(--foreground-muted)]">
        {row.moduleCount} 个模块 · {row.nodeCount} 个节点 · {row.vocabularyCount} 个词汇 · {row.grammarCount} 个语法点
      </p>
    </div>
  );
}

function moduleLabel(code: string) {
  if (code === "vocabulary") return "词汇模块";
  if (code === "grammar") return "语法模块";
  return "其他模块";
}

export function getDigitalTextbookColumns(
  canManage: boolean,
  canPublishChapters: boolean,
): ColumnDef<DigitalTextbookDisplayRow>[] {
  return [
  {
    id: "hierarchy",
    accessorFn: (row) =>
      `${row.courseTitle} ${row.lessonTitle} ${row.textbookTitle}`,
    header: sortableHeader("教材位置"),
    cell: ({ row }) => (
      <div className="min-w-72 max-w-md">
        <p className="text-[10px] font-medium text-[var(--foreground-muted)]">
          {row.original.courseTitle}　›　{row.original.lessonTitle}
        </p>
        <p className="mt-1 truncate font-semibold text-[var(--foreground)]">
          {row.original.textbookTitle}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--foreground-muted)]">
          {row.original.textbookSlug}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "versionNumber",
    header: sortableHeader("当前版本"),
    cell: ({ row }) => (
      <div className="min-w-20">
        <p className="font-semibold tabular-nums text-[var(--foreground-secondary)]">
          第 {row.original.versionNumber} 版
        </p>
      </div>
    ),
  },
  {
    accessorKey: "chapterNumber",
    header: sortableHeader("教材章节"),
    cell: ({ row }) => (
      <div className="min-w-28">
        <p className="font-semibold tabular-nums text-[var(--foreground-secondary)]">
          第 {row.original.chapterNumber} 章
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--foreground-muted)]">
          {row.original.chapterSlug}
        </p>
      </div>
    ),
  },
  {
    id: "contentSummary",
    accessorFn: (row) => row.moduleCount + row.nodeCount + row.vocabularyCount + row.grammarCount,
    header: sortableHeader("内容概况"),
    cell: ({ row }) => <ContentSummary row={row.original} />,
  },
  {
    id: "publishing",
    accessorFn: (row) => `${row.textbookStatus} ${row.versionStatus} ${row.chapterStatus}`,
    header: sortableHeader("发布状态"),
    cell: ({ row }) => <PublishingSummary row={row.original} />,
  },
  {
    id: "actions",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="block text-right">操作</span>,
    cell: ({ row }) => (
      <div className="text-right">
        {canManage || canPublishChapters ? (
          <DigitalTextbookCellAction
            row={row.original}
            canManage={canManage}
            canPublishChapter={canPublishChapters}
          />
        ) : (
          <span className="text-[11px] text-[var(--foreground-muted)]">只读</span>
        )}
      </div>
    ),
  },
  ];
}
