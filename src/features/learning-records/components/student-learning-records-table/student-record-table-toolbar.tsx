"use client";

import { Search } from "lucide-react";

import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";
import type { StudentLearningRecordFilters } from "./types";

export function StudentRecordTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: StudentLearningRecordFilters;
  onFiltersChange: (filters: StudentLearningRecordFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--app-muted)]" size={14} />
        <span className="sr-only">搜索学生档案</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索姓名、邮箱或账号编号"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--app-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">学习状态</span>
        <select
          value={filters.activity}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              activity: event.target.value as StudentLearningRecordFilters["activity"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部学习状态</option>
          <option value="learning">已开始学习</option>
          <option value="pending">等待开始</option>
          <option value="attention">需要关注</option>
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
