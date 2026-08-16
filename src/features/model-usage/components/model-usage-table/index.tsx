"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import { ManagementMetricStrip } from "@/components/layout/management-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ModelUsageLog, ModelUsageTableRow } from "../../api/types";
import { modelUsageColumns } from "./columns";
import {
  ModelUsageTableToolbar,
  type ModelUsageFilters,
} from "./model-usage-table-toolbar";

const DAY_IN_MILLISECONDS = 86_400_000;
const TREND_BUCKET_IN_MILLISECONDS = 14_400_000;

const COLUMN_LABELS: Record<string, string> = {
  name: "用量主体",
  kind: "范围",
  totalTokens: "累计用量",
  inputTokens: "输入用量",
  outputTokens: "输出用量",
  dayTokens: "24 小时趋势",
  logCount: "调用次数",
  latestAt: "最近调用",
};

const INITIAL_FILTERS: ModelUsageFilters = {
  query: "",
  kind: "all",
  from: "",
  to: "",
};

function sumLogs(logs: ModelUsageLog[], field: "inputTokens" | "outputTokens" | "totalTokens") {
  return logs.reduce((sum, log) => sum + log[field], 0);
}

function startOfLocalDay(value: string) {
  return value ? new Date(`${value}T00:00:00`).getTime() : null;
}

function endOfLocalDay(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).getTime() : null;
}

function applyDateRange(
  row: ModelUsageTableRow,
  from: number | null,
  to: number | null,
  now: number,
): ModelUsageTableRow {
  if (from === null && to === null) return row;

  const activity = row.activity.filter((log) => {
    const timestamp = new Date(log.createdAt).getTime();
    return (from === null || timestamp >= from) && (to === null || timestamp <= to);
  });
  const trend = Array<number>(6).fill(0);
  const dayLogs = activity.filter((log) => {
    const age = now - new Date(log.createdAt).getTime();
    if (age < 0 || age >= DAY_IN_MILLISECONDS) return false;
    const bucket =
      5 - Math.min(5, Math.floor(age / TREND_BUCKET_IN_MILLISECONDS));
    trend[bucket] += log.totalTokens;
    return true;
  });

  return {
    ...row,
    totalTokens: sumLogs(activity, "totalTokens"),
    inputTokens: sumLogs(activity, "inputTokens"),
    outputTokens: sumLogs(activity, "outputTokens"),
    dayTokens: sumLogs(dayLogs, "totalTokens"),
    logCount: activity.length,
    trend,
    logs: activity.slice(0, 20),
    activity,
  };
}

export function ModelUsageTable({
  data,
  canViewAllTenants,
  queryLimit,
}: {
  data: ModelUsageTableRow[];
  canViewAllTenants: boolean;
  queryLimit: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<ModelUsageFilters>(INITIAL_FILTERS);
  const from = startOfLocalDay(filters.from);
  const to = endOfLocalDay(filters.to);
  const invalidDateRange = from !== null && to !== null && from > to;
  const filteredData = useMemo(() => {
    if (invalidDateRange) return [];
    const normalizedQuery = filters.query.trim().toLocaleLowerCase("zh-CN");
    const now = Date.now();

    return data
      .filter(
        (row) =>
          filters.kind === "all" || row.kind === filters.kind,
      )
      .filter((row) => {
        if (!normalizedQuery) return true;
        return `${row.name} ${row.slug}`
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery);
      })
      .map((row) => applyDateRange(row, from, to, now));
  }, [data, filters.kind, filters.query, from, invalidDateRange, to]);
  const totals = useMemo(
    () => ({
      totalTokens: filteredData.reduce((sum, row) => sum + row.totalTokens, 0),
      inputTokens: filteredData.reduce((sum, row) => sum + row.inputTokens, 0),
      outputTokens: filteredData.reduce((sum, row) => sum + row.outputTokens, 0),
      dayTokens: filteredData.reduce((sum, row) => sum + row.dayTokens, 0),
      logCount: filteredData.reduce((sum, row) => sum + row.logCount, 0),
    }),
    [filteredData],
  );
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: modelUsageColumns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const viewOptions = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
    .map((column) => ({
      id: column.id,
      label: COLUMN_LABELS[column.id] ?? column.id,
      visible: column.getIsVisible(),
      canHide: column.getCanHide(),
      onVisibleChange: (visible: boolean) => column.toggleVisibility(visible),
    }));

  return (
    <div className="space-y-4">
      <ManagementMetricStrip
        label="当前筛选模型用量概况"
        items={[
          { label: "累计用量", value: totals.totalTokens.toLocaleString("zh-CN") },
          { label: "输入用量", value: totals.inputTokens.toLocaleString("zh-CN") },
          { label: "输出用量", value: totals.outputTokens.toLocaleString("zh-CN") },
          { label: "24 小时用量", value: totals.dayTokens.toLocaleString("zh-CN") },
          { label: "调用次数", value: totals.logCount.toLocaleString("zh-CN") },
        ]}
      />
      <DataTable
        toolbar={
          <ModelUsageTableToolbar
            filters={filters}
            onFiltersChange={setFilters}
            canViewAllTenants={canViewAllTenants}
            invalidDateRange={invalidDateRange}
            viewOptions={viewOptions}
          />
        }
        isEmpty={filteredData.length === 0}
        emptyContent={invalidDateRange ? "请调整日期范围" : "没有符合条件的模型用量数据"}
        footer={
          <p className="text-xs text-[var(--app-muted)]">
            当前显示 {filteredData.length} 个用量主体；数据来自最近 {queryLimit.toLocaleString("zh-CN")} 条调用记录
          </p>
        }
      >
        <Table className="min-w-[1280px]">
          <TableHeader className="bg-[var(--app-soft-bg)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3 text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
