"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";
import type { ModelUsageProvider } from "../../api/types";

export type ModelUsageFilters = {
  query: string;
  kind: "all" | "platform" | "organization";
  provider: "all" | ModelUsageProvider;
  model: string;
  from: string;
  to: string;
};

export function ModelUsageTableToolbar({
  filters,
  onFiltersChange,
  canViewAllTenants,
  invalidDateRange,
  viewOptions,
  modelOptions,
}: {
  filters: ModelUsageFilters;
  onFiltersChange: (filters: ModelUsageFilters) => void;
  canViewAllTenants: boolean;
  invalidDateRange: boolean;
  viewOptions: DataTableViewOption[];
  modelOptions: string[];
}) {
  const hasFilters =
    Boolean(filters.query || filters.from || filters.to) ||
    filters.kind !== "all" ||
    (canViewAllTenants && Boolean(filters.model || filters.provider !== "all"));

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 xl:max-w-sm">
          <Icons.search className="size-3.5 shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
          <span className="sr-only">搜索用量主体</span>
          <input
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="搜索机构名称或标识"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        {canViewAllTenants && (
          <label>
            <span className="sr-only">数据范围</span>
            <select
              value={filters.kind}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  kind: event.target.value as ModelUsageFilters["kind"],
                })
              }
              className="h-9 min-w-28 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
            >
              <option value="all">全部范围</option>
              <option value="platform">平台</option>
              <option value="organization">机构</option>
            </select>
          </label>
        )}
        {canViewAllTenants && (
          <>
            <label>
              <span className="sr-only">模型供应商</span>
              <select
                value={filters.provider}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    provider: event.target.value as ModelUsageFilters["provider"],
                    model: "",
                  })
                }
                className="h-9 min-w-32 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
              >
                <option value="all">全部供应商</option>
                <option value="qwen">Qwen</option>
                <option value="deepseek">DeepSeek</option>
                <option value="self_hosted">其他 / 自托管</option>
                <option value="unknown">来源待确认</option>
              </select>
            </label>
            <label>
              <span className="sr-only">具体模型</span>
              <select
                value={filters.model}
                onChange={(event) => onFiltersChange({ ...filters, model: event.target.value })}
                className="h-9 min-w-40 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
              >
                <option value="">全部模型</option>
                {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="flex h-9 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs">
          <span className="whitespace-nowrap text-[var(--foreground-muted)]">开始日期</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
            className="bg-transparent outline-none"
          />
        </label>
        <label className="flex h-9 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs">
          <span className="whitespace-nowrap text-[var(--foreground-muted)]">结束日期</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => onFiltersChange({ ...filters, to: event.target.value })}
            className="bg-transparent outline-none"
          />
        </label>
        <div className="flex shrink-0 items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={() => onFiltersChange({ query: "", kind: "all", provider: "all", model: "", from: "", to: "" })}
              className="h-9 border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)]"
            >
              清除筛选
            </button>
          )}
          <DataTableViewOptions options={viewOptions} />
        </div>
      </div>
      {invalidDateRange && (
        <p className="text-xs font-medium text-rose-700">开始日期不能晚于结束日期。</p>
      )}
    </div>
  );
}
