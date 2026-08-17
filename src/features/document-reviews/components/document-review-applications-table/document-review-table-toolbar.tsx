"use client";

import { Search } from "lucide-react";

import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";
import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";

export type DocumentReviewTableFilters = {
  query: string;
  reviewStatus: "all" | "preparing" | "pending_review" | "revision_required" | "approved";
  lockStatus: "all" | "locked" | "editable";
};

export function DocumentReviewTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: DocumentReviewTableFilters;
  onFiltersChange: (filters: DocumentReviewTableFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 transition focus-within:border-[var(--ring)] focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--foreground-muted)]" size={14} />
        <span className="shrink-0 text-[10px] font-semibold text-[var(--foreground-secondary)]">
          搜索申请
        </span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索学生、邮箱、大学或专业"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--foreground-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">审核状态</span>
        <select
          value={filters.reviewStatus}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              reviewStatus: event.target.value as DocumentReviewTableFilters["reviewStatus"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部审核状态</option>
          <option value="preparing">准备中</option>
          <option value="pending_review">待确认</option>
          <option value="revision_required">需补充</option>
          <option value="approved">已确认</option>
        </select>
      </label>
      <label>
        <span className="sr-only">锁定状态</span>
        <select
          value={filters.lockStatus}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              lockStatus: event.target.value as DocumentReviewTableFilters["lockStatus"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部锁定状态</option>
          <option value="locked">已锁定</option>
          <option value="editable">可编辑</option>
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
