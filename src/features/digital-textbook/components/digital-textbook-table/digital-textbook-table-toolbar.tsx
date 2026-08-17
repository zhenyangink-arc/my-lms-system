"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";

export type DigitalTextbookTableFilters = {
  query: string;
  textbookStatus: string;
  chapterStatus: string;
  moduleCode: string;
};

export const INITIAL_DIGITAL_TEXTBOOK_FILTERS: DigitalTextbookTableFilters = {
  query: "",
  textbookStatus: "all",
  chapterStatus: "all",
  moduleCode: "all",
};

export function DigitalTextbookTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: DigitalTextbookTableFilters;
  onFiltersChange: (filters: DigitalTextbookTableFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query.trim()) ||
    filters.textbookStatus !== "all" ||
    filters.chapterStatus !== "all" ||
    filters.moduleCode !== "all";

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 xl:max-w-sm">
        <Icons.search
          className="size-3.5 shrink-0 text-[var(--foreground-muted)]"
          aria-hidden="true"
        />
        <span className="sr-only">搜索互动教材</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索课程、课时、教材或章节"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>

      <FilterSelect
        label="教材状态"
        value={filters.textbookStatus}
        onChange={(textbookStatus) =>
          onFiltersChange({ ...filters, textbookStatus })
        }
      />
      <FilterSelect
        label="章节状态"
        value={filters.chapterStatus}
        onChange={(chapterStatus) =>
          onFiltersChange({ ...filters, chapterStatus })
        }
      />
      <label>
        <span className="sr-only">内容模块</span>
        <select
          value={filters.moduleCode}
          onChange={(event) =>
            onFiltersChange({ ...filters, moduleCode: event.target.value })
          }
          className="h-9 min-w-32 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
        >
          <option value="all">全部模块</option>
          <option value="vocabulary">词汇模块</option>
          <option value="grammar">语法模块</option>
        </select>
      </label>

      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() => onFiltersChange(INITIAL_DIGITAL_TEXTBOOK_FILTERS)}
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

function FilterSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-32 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
      >
        <option value="all">全部{label}</option>
        <option value="published">已发布</option>
        <option value="draft">草稿</option>
        <option value="archived">已归档</option>
      </select>
    </label>
  );
}
