"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { ModelUsageTableRow } from "../../api/types";
import { ModelUsageActivityDialog } from "./activity-dialog";

const RECENT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
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

function TokenNumber({ value, strong = false }: { value: number; strong?: boolean }) {
  return (
    <span className={`font-mono tabular-nums ${strong ? "font-semibold" : "font-medium"}`}>
      {value.toLocaleString("zh-CN")}
    </span>
  );
}

function TrendCell({ row }: { row: ModelUsageTableRow }) {
  const max = Math.max(...row.trend, 1);
  const color = row.kind === "platform" ? "var(--app-accent)" : "var(--app-secondary)";

  return (
    <div className="flex min-w-36 items-center gap-3">
      <span className="min-w-14 font-mono text-xs font-semibold tabular-nums text-emerald-700">
        +{row.dayTokens.toLocaleString("zh-CN")}
      </span>
      <span className="flex h-6 flex-1 items-end gap-1" aria-label="最近 24 小时趋势">
        {row.trend.map((value, index) => (
          <span
            key={index}
            className="min-h-px flex-1"
            style={{
              height: `${Math.max(8, Math.round((value / max) * 100))}%`,
              backgroundColor: value > 0 ? color : "var(--app-border)",
            }}
          />
        ))}
      </span>
    </div>
  );
}

export const modelUsageColumns: ColumnDef<ModelUsageTableRow>[] = [
  {
    accessorKey: "name",
    header: sortableHeader("用量主体"),
    cell: ({ row }) => (
      <div className="min-w-44">
        <p className="font-semibold text-[var(--app-text)]">{row.original.name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
          {row.original.slug}
          {row.original.isCurrent ? " · 当前机构" : ""}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "kind",
    header: sortableHeader("范围"),
    cell: ({ row }) => (row.original.kind === "platform" ? "平台" : "机构"),
  },
  {
    accessorKey: "totalTokens",
    header: sortableHeader("累计用量"),
    cell: ({ row }) => <TokenNumber value={row.original.totalTokens} strong />,
  },
  {
    accessorKey: "inputTokens",
    header: sortableHeader("输入用量"),
    cell: ({ row }) => <TokenNumber value={row.original.inputTokens} />,
  },
  {
    accessorKey: "outputTokens",
    header: sortableHeader("输出用量"),
    cell: ({ row }) => <TokenNumber value={row.original.outputTokens} />,
  },
  {
    accessorKey: "dayTokens",
    header: sortableHeader("24 小时趋势"),
    cell: ({ row }) => <TrendCell row={row.original} />,
  },
  {
    accessorKey: "logCount",
    header: sortableHeader("调用次数"),
    cell: ({ row }) => <TokenNumber value={row.original.logCount} />,
  },
  {
    id: "latestAt",
    accessorFn: (row) => row.logs[0]?.createdAt ?? "",
    header: sortableHeader("最近调用"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
        <LocalDateTime
          value={row.original.logs[0]?.createdAt}
          options={RECENT_TIME_OPTIONS}
          fallback="暂无记录"
        />
      </span>
    ),
  },
  {
    id: "details",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">调用明细</span>,
    cell: ({ row }) => <ModelUsageActivityDialog row={row.original} />,
  },
];
