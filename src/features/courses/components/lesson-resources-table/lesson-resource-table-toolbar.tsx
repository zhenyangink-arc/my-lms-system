"use client";

import { Search, X } from "lucide-react";

import { RESOURCE_TYPE_LABELS } from "./columns";

export type LessonResourceFilters = {
  query: string;
  type: string;
  status: "all" | "published" | "hidden" | "deleted";
};

export const INITIAL_LESSON_RESOURCE_FILTERS: LessonResourceFilters = {
  query: "",
  type: "all",
  status: "all",
};

export function LessonResourceTableToolbar({
  filters,
  onFiltersChange,
}: {
  filters: LessonResourceFilters;
  onFiltersChange: (filters: LessonResourceFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-60 flex-1 lg:max-w-md">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]"
        />
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索资料名称、说明或来源"
          className="app-input w-full border py-2 pl-9 pr-9 text-xs outline-none"
        />
        {filters.query && (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => onFiltersChange({ ...filters, query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--app-muted)]"
          >
            <X size={13} />
          </button>
        )}
      </label>

      <select
        value={filters.type}
        onChange={(event) =>
          onFiltersChange({ ...filters, type: event.target.value })
        }
        className="app-input border px-3 py-2 text-xs outline-none"
      >
        <option value="all">全部类型</option>
        {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            status: event.target.value as LessonResourceFilters["status"],
          })
        }
        className="app-input border px-3 py-2 text-xs outline-none"
      >
        <option value="all">全部状态</option>
        <option value="published">已发布</option>
        <option value="hidden">已隐藏</option>
        <option value="deleted">回收站</option>
      </select>
    </div>
  );
}
