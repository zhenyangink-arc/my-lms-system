"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";

export type ModelUsageFilters = {
  query: string;
  kind: "all" | "platform" | "organization";
  from: string;
  to: string;
};

export function ModelUsageTableToolbar({
  filters,
  onFiltersChange,
  canViewAllTenants,
  invalidDateRange,
  viewOptions,
}: {
  filters: ModelUsageFilters;
  onFiltersChange: (filters: ModelUsageFilters) => void;
  canViewAllTenants: boolean;
  invalidDateRange: boolean;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query || filters.from || filters.to) || filters.kind !== "all";

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 xl:max-w-sm">
          <Icons.search className="size-3.5 shrink-0 text-[var(--app-muted)]" aria-hidden="true" />
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
              className="h-9 min-w-28 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 text-xs font-medium"
            >
              <option value="all">全部范围</option>
              <option value="platform">平台</option>
              <option value="organization">机构</option>
            </select>
          </label>
        )}
        <label className="flex h-9 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 text-xs">
          <span className="whitespace-nowrap text-[var(--app-muted)]">开始日期</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => onFiltersChange({ ...filters, from: event.target.value })}
            className="bg-transparent outline-none"
          />
        </label>
        <label className="flex h-9 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 text-xs">
          <span className="whitespace-nowrap text-[var(--app-muted)]">结束日期</span>
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
              onClick={() => onFiltersChange({ query: "", kind: "all", from: "", to: "" })}
              className="h-9 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-3 text-xs font-semibold text-[var(--app-text-soft)]"
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
