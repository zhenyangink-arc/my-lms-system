"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { ManagedUniversity } from "../../api/types";
import {
  UNIVERSITY_ADMISSION_STAGE_LABELS,
  UNIVERSITY_OWNERSHIP_LABELS,
} from "../../constants/university-options";
import { UniversityCellAction } from "./cell-action";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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

function formatRanking(
  display: string | null,
  year: number | null,
): React.ReactNode {
  if (!display) return <span className="text-[var(--app-muted)]">暂无</span>;
  return (
    <div className="min-w-24">
      <p className="font-semibold text-[var(--app-text-soft)]">{display}</p>
      <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
        {year ? `${year} 年` : "年份待确认"}
      </p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function getUniversityColumns({
  canManageContent,
  canPermanentlyDelete,
}: {
  canManageContent: boolean;
  canPermanentlyDelete: boolean;
}): ColumnDef<ManagedUniversity>[] {
  const columns: ColumnDef<ManagedUniversity>[] = [
  {
    accessorKey: "name_zh",
    header: sortableHeader("大学名称"),
    cell: ({ row }) => (
      <div className="flex min-w-64 items-center gap-3">
        <SchoolCrest
          logoUrl={row.original.logo_url}
          name={row.original.name_zh}
          size="xs"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-[var(--app-text)]">
              {row.original.name_zh}
            </p>
            {row.original.is_featured && (
              <span className="shrink-0 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                推荐
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-[var(--app-muted)]">
            {row.original.name_ko} · {UNIVERSITY_OWNERSHIP_LABELS[row.original.ownership]}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "region",
    accessorFn: (university) => `${university.province} ${university.city}`,
    header: sortableHeader("地区"),
    cell: ({ row }) => (
      <div className="min-w-32">
        <p className="font-medium text-[var(--app-text-soft)]">
          {row.original.province}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
          {row.original.city}
        </p>
      </div>
    ),
  },
  {
    id: "qs_rank_sort",
    accessorFn: (university) =>
      university.qs_rank_sort ?? Number.MAX_SAFE_INTEGER,
    header: sortableHeader("世界排名"),
    cell: ({ row }) =>
      formatRanking(
        row.original.qs_rank_display,
        row.original.qs_ranking_year,
      ),
  },
  {
    id: "joongang_rank_sort",
    accessorFn: (university) =>
      university.joongang_rank_sort ?? Number.MAX_SAFE_INTEGER,
    header: sortableHeader("韩国排名"),
    cell: ({ row }) =>
      formatRanking(
        row.original.joongang_rank_display,
        row.original.joongang_ranking_year,
      ),
  },
  {
    accessorKey: "tuition_max_cny",
    header: sortableHeader("年度学费"),
    cell: ({ row }) => (
      <div className="min-w-36 tabular-nums">
        <p className="font-medium text-[var(--app-text-soft)]">
          {formatCurrency(row.original.tuition_min_cny)} 至 {formatCurrency(row.original.tuition_max_cny)} 元
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
          {row.original.tuition_reference_year} 年参考
        </p>
      </div>
    ),
  },
  {
    id: "admission_stages",
    accessorFn: (university) => university.admission_stages.length,
    header: sortableHeader("申请阶段"),
    cell: ({ row }) => (
      <div className="flex min-w-52 flex-wrap gap-1">
        {row.original.admission_stages.map((stage) => (
          <span
            key={stage}
            className="bg-[var(--app-soft-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-text-soft)]"
          >
            {UNIVERSITY_ADMISSION_STAGE_LABELS[stage]}
          </span>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "is_published",
    header: sortableHeader("发布状态"),
    cell: ({ row }) => (
      <span
        className={`inline-flex px-2 py-1 text-[11px] font-semibold ${
          row.original.is_published
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {row.original.is_published ? "已发布" : "未发布"}
      </span>
    ),
  },
  {
    accessorKey: "sort_order",
    header: sortableHeader("推荐顺序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.sort_order}</span>
    ),
  },
  {
    accessorKey: "updated_at",
    header: sortableHeader("最近更新"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
        <LocalDateTime
          value={row.original.updated_at}
          options={DATE_OPTIONS}
          fallback="时间待确认"
        />
      </span>
    ),
  },
  ];

  if (canManageContent) {
    columns.push({
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="block text-right">操作</span>,
      cell: ({ row }) => (
        <UniversityCellAction
          university={row.original}
          canPermanentlyDelete={canPermanentlyDelete}
        />
      ),
    });
  }

  return columns;
}
