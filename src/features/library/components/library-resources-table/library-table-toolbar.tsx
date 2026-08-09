"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";
import {
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  LIBRARY_STATUS_LABELS,
} from "@/app/dashboard/library/config";

export type LibraryTableFilters = {
  query: string;
  status: "all" | keyof typeof LIBRARY_STATUS_LABELS;
  category: "all" | keyof typeof LIBRARY_CATEGORY_LABELS;
  resourceType: "all" | keyof typeof LIBRARY_RESOURCE_TYPE_LABELS;
  courseId: string;
};

export type LibraryCourseFilterOption = {
  value: string;
  label: string;
};

export function LibraryTableToolbar({
  filters,
  onFiltersChange,
  courseOptions,
  viewOptions,
}: {
  filters: LibraryTableFilters;
  onFiltersChange: (filters: LibraryTableFilters) => void;
  courseOptions: LibraryCourseFilterOption[];
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query) ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.resourceType !== "all" ||
    filters.courseId !== "all";

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--app-border)] bg-[var(--app-input-bg)] px-2.5 xl:max-w-sm">
        <Icons.search
          className="size-3.5 shrink-0 text-[var(--app-muted)]"
          aria-hidden="true"
        />
        <span className="sr-only">搜索资料</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索名称、说明、课程或文件名"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
      <FilterSelect
        label="状态"
        value={filters.status}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value as LibraryTableFilters["status"],
          })
        }
        options={Object.entries(LIBRARY_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <FilterSelect
        label="分类"
        value={filters.category}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            category: value as LibraryTableFilters["category"],
          })
        }
        options={Object.entries(LIBRARY_CATEGORY_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <FilterSelect
        label="类型"
        value={filters.resourceType}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            resourceType: value as LibraryTableFilters["resourceType"],
          })
        }
        options={Object.entries(LIBRARY_RESOURCE_TYPE_LABELS).map(
          ([value, label]) => ({ value, label }),
        )}
      />
      <FilterSelect
        label="课程"
        value={filters.courseId}
        onChange={(courseId) => onFiltersChange({ ...filters, courseId })}
        options={courseOptions}
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
                resourceType: "all",
                courseId: "all",
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
  options: Array<{ value: string; label: string }>;
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
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
