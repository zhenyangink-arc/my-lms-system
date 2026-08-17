"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";

export type GrowthToolboxFilterOption = {
  value: string;
  label: string;
};

export type GrowthToolboxTableFilter = {
  id: string;
  label: string;
  value: string;
  options: GrowthToolboxFilterOption[];
};

export function GrowthToolboxTableToolbar({
  query,
  queryLabel,
  queryPlaceholder,
  filters,
  viewOptions,
  onQueryChange,
  onFilterChange,
  onReset,
}: {
  query: string;
  queryLabel: string;
  queryPlaceholder: string;
  filters: GrowthToolboxTableFilter[];
  viewOptions: DataTableViewOption[];
  onQueryChange: (query: string) => void;
  onFilterChange: (id: string, value: string) => void;
  onReset: () => void;
}) {
  const hasFilters =
    Boolean(query.trim()) || filters.some((filter) => filter.value !== "all");

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 xl:max-w-sm">
        <Icons.search
          className="size-3.5 shrink-0 text-[var(--foreground-muted)]"
          aria-hidden="true"
        />
        <span className="sr-only">{queryLabel}</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={queryPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>

      {filters.map((filter) => (
        <label key={filter.id}>
          <span className="sr-only">{filter.label}</span>
          <select
            value={filter.value}
            onChange={(event) => onFilterChange(filter.id, event.target.value)}
            className="h-9 min-w-28 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
          >
            <option value="all">全部{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="h-9 border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)]"
          >
            清除筛选
          </button>
        )}
        <DataTableViewOptions options={viewOptions} />
      </div>
    </div>
  );
}
