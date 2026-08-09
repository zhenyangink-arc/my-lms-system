"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/app/dashboard/announcements/config";

export type AnnouncementTableFilters = {
  query: string;
  status: "all" | "draft" | "published" | "archived";
  category: "all" | keyof typeof CATEGORY_LABELS;
  priority: "all" | keyof typeof PRIORITY_LABELS;
};

export function AnnouncementTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: AnnouncementTableFilters;
  onFiltersChange: (filters: AnnouncementTableFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query) ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.priority !== "all";

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 xl:max-w-sm">
        <Icons.search
          className="size-3.5 shrink-0 text-[var(--app-muted)]"
          aria-hidden="true"
        />
        <span className="sr-only">搜索公告</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索标题、正文或发布人"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
      <FilterSelect
        label="公告状态"
        value={filters.status}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value as AnnouncementTableFilters["status"],
          })
        }
        options={STATUS_LABELS}
      />
      <FilterSelect
        label="公告分类"
        value={filters.category}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            category: value as AnnouncementTableFilters["category"],
          })
        }
        options={CATEGORY_LABELS}
      />
      <FilterSelect
        label="优先级"
        value={filters.priority}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            priority: value as AnnouncementTableFilters["priority"],
          })
        }
        options={PRIORITY_LABELS}
      />
      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                query: "",
                status: "all",
                category: "all",
                priority: "all",
              })
            }
            className="h-9 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-3 text-xs font-semibold text-[var(--app-text-soft)]"
          >
            清除筛选
          </button>
        )}
        <DataTableViewOptions options={viewOptions} />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-28 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 text-xs font-medium"
      >
        <option value="all">全部{label}</option>
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
