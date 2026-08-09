"use client";

import {
  HELP_ARTICLE_CATEGORY_LABELS,
  HELP_ARTICLE_STATUS_LABELS,
  type HelpArticleCategory,
  type HelpArticleStatus,
} from "@/app/dashboard/help/config";
import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";

export type HelpArticleTableFilters = {
  query: string;
  status: "all" | HelpArticleStatus;
  category: "all" | HelpArticleCategory;
};

export function HelpArticleTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: HelpArticleTableFilters;
  onFiltersChange: (filters: HelpArticleTableFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query) ||
    filters.status !== "all" ||
    filters.category !== "all";

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 xl:max-w-sm">
        <Icons.search className="size-3.5 text-[var(--app-muted)]" aria-hidden="true" />
        <span className="sr-only">搜索帮助文章</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索标题、摘要或正文"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
      <FilterSelect
        label="文章状态"
        value={filters.status}
        options={HELP_ARTICLE_STATUS_LABELS}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value as HelpArticleTableFilters["status"],
          })
        }
      />
      <FilterSelect
        label="文章分类"
        value={filters.category}
        options={HELP_ARTICLE_CATEGORY_LABELS}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            category: value as HelpArticleTableFilters["category"],
          })
        }
      />
      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({ query: "", status: "all", category: "all" })
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
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-32 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 text-xs font-medium"
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
