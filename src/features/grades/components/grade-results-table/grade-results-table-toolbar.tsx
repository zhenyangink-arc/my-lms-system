"use client";

import { Search } from "lucide-react";

import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";

export type GradeResultFilters = {
  query: string;
  source: "all" | "assignment_submission" | "chapter_test_attempt";
  result: "all" | "passed" | "failed";
};

export function GradeResultsTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: GradeResultFilters;
  onFiltersChange: (filters: GradeResultFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--foreground-muted)]" size={14} />
        <span className="sr-only">搜索学生成绩</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索学生、课程或考核内容"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--foreground-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">成绩来源</span>
        <select
          value={filters.source}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              source: event.target.value as GradeResultFilters["source"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部来源</option>
          <option value="assignment_submission">作业／考试</option>
          <option value="chapter_test_attempt">章节测试</option>
        </select>
      </label>
      <label>
        <span className="sr-only">成绩结果</span>
        <select
          value={filters.result}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              result: event.target.value as GradeResultFilters["result"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部结果</option>
          <option value="passed">已通过</option>
          <option value="failed">未通过</option>
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
