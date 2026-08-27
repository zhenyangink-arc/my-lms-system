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
import { createModelUsageColumns } from "./columns";
import {
  ModelUsageTableToolbar,
  type ModelUsageFilters,
} from "./model-usage-table-toolbar";

const DAY_IN_MILLISECONDS = 86_400_000;
const TREND_BUCKET_IN_MILLISECONDS = 14_400_000;

const COLUMN_LABELS: Record<string, string> = {
  name: "用量主体",
  kind: "范围",
  provider: "供应商",
  model: "模型",
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
  provider: "all",
  model: "",
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
  const baseFilteredData = useMemo(() => {
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
        const searchableText = canViewAllTenants
          ? `${row.name} ${row.slug} ${row.provider} ${row.model}`
          : `${row.name} ${row.slug}`;
        return searchableText
          .toLocaleLowerCase("zh-CN")
          .includes(normalizedQuery);
      })
      .map((row) => applyDateRange(row, from, to, now));
  }, [canViewAllTenants, data, filters.kind, filters.query, from, invalidDateRange, to]);
  const filteredData = useMemo(
    () => canViewAllTenants
      ? baseFilteredData.filter((row) =>
          (filters.provider === "all" || row.provider === filters.provider) &&
          (!filters.model || row.model === filters.model),
        )
      : baseFilteredData,
    [baseFilteredData, canViewAllTenants, filters.model, filters.provider],
  );
  const modelOptions = useMemo(
    () => Array.from(new Set(data
      .filter((row) => filters.provider === "all" || row.provider === filters.provider)
      .map((row) => row.model))).sort((a, b) => a.localeCompare(b)),
    [data, filters.provider],
  );
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
  const providerTotals = useMemo(() => {
    const empty = () => ({
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      logCount: 0,
      models: new Map<string, { totalTokens: number; logCount: number }>(),
    });
    const result: Record<"qwen" | "deepseek", ReturnType<typeof empty>> = {
      qwen: empty(),
      deepseek: empty(),
    };
    for (const row of baseFilteredData) {
      if (row.provider !== "qwen" && row.provider !== "deepseek") continue;
      result[row.provider].totalTokens += row.totalTokens;
      result[row.provider].inputTokens += row.inputTokens;
      result[row.provider].outputTokens += row.outputTokens;
      result[row.provider].logCount += row.logCount;
      const model = result[row.provider].models.get(row.model) ?? {
        totalTokens: 0,
        logCount: 0,
      };
      model.totalTokens += row.totalTokens;
      model.logCount += row.logCount;
      result[row.provider].models.set(row.model, model);
    }
    return result;
  }, [baseFilteredData]);
  const columns = useMemo(
    () => createModelUsageColumns(canViewAllTenants),
    [canViewAllTenants],
  );
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
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
      {canViewAllTenants && (
      <section className="grid gap-3 lg:grid-cols-2" aria-label="Qwen 与 DeepSeek 用量对比">
        {(["qwen", "deepseek"] as const).map((provider) => {
          const item = providerTotals[provider];
          const label = provider === "qwen" ? "Qwen" : "DeepSeek";
          return (
            <article key={provider} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[var(--foreground)]">{label}</h2>
                <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground-secondary)]">
                  {item.logCount.toLocaleString("zh-CN")} 次调用
                </span>
              </div>
              <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-[var(--foreground)]">
                {item.totalTokens.toLocaleString("zh-CN")}
                <span className="ml-1.5 text-xs font-medium text-[var(--foreground-muted)]">Token</span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs">
                <div><dt className="text-[var(--foreground-muted)]">输入</dt><dd className="mt-1 font-mono font-semibold tabular-nums">{item.inputTokens.toLocaleString("zh-CN")}</dd></div>
                <div><dt className="text-[var(--foreground-muted)]">输出</dt><dd className="mt-1 font-mono font-semibold tabular-nums">{item.outputTokens.toLocaleString("zh-CN")}</dd></div>
              </dl>
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                <p className="text-xs font-semibold text-[var(--foreground-secondary)]">分模型统计</p>
                {item.models.size > 0 ? (
                  <ul className="mt-2 divide-y divide-[var(--border-subtle)] rounded-lg bg-[var(--surface-soft)] px-3">
                    {Array.from(item.models.entries())
                      .sort(([, left], [, right]) => right.totalTokens - left.totalTokens)
                      .map(([model, modelUsage]) => (
                        <li key={model} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-xs">
                          <span className="font-mono font-semibold text-[var(--foreground)]">{model}</span>
                          <span className="flex items-center gap-3 text-[var(--foreground-muted)]">
                            <span>{modelUsage.logCount.toLocaleString("zh-CN")} 次</span>
                            <span className="font-mono font-semibold tabular-nums text-[var(--foreground-secondary)]">
                              {modelUsage.totalTokens.toLocaleString("zh-CN")} Token
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--foreground-muted)]">
                    暂无模型调用
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>
      )}
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
            modelOptions={modelOptions}
          />
        }
        isEmpty={filteredData.length === 0}
        emptyContent={invalidDateRange ? "请调整日期范围" : "没有符合条件的模型用量数据"}
        footer={
          <p className="text-xs text-[var(--foreground-muted)]">
            当前显示 {filteredData.length} 个用量主体；数据来自最近 {queryLimit.toLocaleString("zh-CN")} 条调用记录
          </p>
        }
      >
        <Table className={canViewAllTenants ? "min-w-[1280px]" : "min-w-[960px]"}>
          <TableHeader className="bg-[var(--surface-soft)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} sortDirection={header.column.getCanSort() ? header.column.getIsSorted() : undefined} className="px-4 text-xs">
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
