"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";

export type CourseCatalogFilters = {
  query: string;
  status: "all" | "published" | "draft" | "locked" | "incomplete";
};

export const INITIAL_COURSE_CATALOG_FILTERS: CourseCatalogFilters = {
  query: "",
  status: "all",
};

export function CourseCatalogToolbar({
  filters,
  onFiltersChange,
  view,
  onViewChange,
}: {
  filters: CourseCatalogFilters;
  onFiltersChange: (filters: CourseCatalogFilters) => void;
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-60 flex-1 lg:max-w-md">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)]"
        />
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索当前层级的名称或路径标识"
          className="app-input w-full border py-2 pl-9 pr-9 text-xs outline-none"
        />
        {filters.query && (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => onFiltersChange({ ...filters, query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--foreground-muted)]"
          >
            <X size={13} />
          </button>
        )}
      </label>

      <select
        value={filters.status}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            status: event.target.value as CourseCatalogFilters["status"],
          })
        }
        className="app-input border px-3 py-2 text-xs outline-none"
      >
        <option value="all">全部状态</option>
        <option value="published">已上架</option>
        <option value="draft">未上架</option>
        <option value="locked">已锁定</option>
        <option value="incomplete">结构待完善</option>
      </select>

      <div className="ml-auto flex items-center border border-[var(--border)]">
        <button
          type="button"
          aria-label="网格视图"
          aria-pressed={view === "grid"}
          onClick={() => onViewChange("grid")}
          className={`flex h-9 w-9 items-center justify-center ${view === "grid" ? "bg-[var(--surface-soft)] text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)]"}`}
        >
          <LayoutGrid size={14} />
        </button>
        <button
          type="button"
          aria-label="列表视图"
          aria-pressed={view === "list"}
          onClick={() => onViewChange("list")}
          className={`flex h-9 w-9 items-center justify-center border-l border-[var(--border)] ${view === "list" ? "bg-[var(--surface-soft)] text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)]"}`}
        >
          <List size={14} />
        </button>
      </div>
    </div>
  );
}
