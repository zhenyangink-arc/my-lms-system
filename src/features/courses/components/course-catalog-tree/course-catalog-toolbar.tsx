"use client";

import { Search, X } from "lucide-react";

import type { CourseCatalogNodeKind } from "../../api/types";

export type CourseCatalogFilters = {
  query: string;
  kind: "all" | CourseCatalogNodeKind;
  status: "all" | "published" | "draft" | "locked" | "incomplete";
};

export const INITIAL_COURSE_CATALOG_FILTERS: CourseCatalogFilters = {
  query: "",
  kind: "all",
  status: "all",
};

export function CourseCatalogToolbar({
  filters,
  onFiltersChange,
  onExpandAll,
  onCollapseAll,
}: {
  filters: CourseCatalogFilters;
  onFiltersChange: (filters: CourseCatalogFilters) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
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
          placeholder="搜索名称、路径标识或所属上级"
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
        value={filters.kind}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            kind: event.target.value as CourseCatalogFilters["kind"],
          })
        }
        className="app-input border px-3 py-2 text-xs outline-none"
      >
        <option value="all">全部类型</option>
        <option value="category">分类</option>
        <option value="course">课程</option>
        <option value="lesson">课时</option>
        <option value="chapter">章节</option>
      </select>

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

      <div className="flex items-center border border-[var(--border)]">
        <button
          type="button"
          onClick={onExpandAll}
          className="px-3 py-2 text-xs font-medium text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
        >
          全部展开
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          className="border-l border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
        >
          全部收起
        </button>
      </div>
    </div>
  );
}
