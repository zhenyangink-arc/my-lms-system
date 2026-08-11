"use client";

import { Search } from "lucide-react";

import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";
import type { GradeReviewStatus } from "../../api/types";

export type GradeReviewFilters = {
  query: string;
  status: "all" | GradeReviewStatus;
};

export function GradeReviewTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: GradeReviewFilters;
  onFiltersChange: (filters: GradeReviewFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--app-muted)]" size={14} />
        <span className="sr-only">搜索复核请求</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索学生、成绩来源或申请原因"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--app-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">复核状态</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as GradeReviewFilters["status"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部复核状态</option>
          <option value="pending">待处理</option>
          <option value="reviewing">复核中</option>
          <option value="resolved">已完成</option>
          <option value="rejected">未调整</option>
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
