"use client";

import { Search } from "lucide-react";

import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";
import type { VisaTaskStage, VisaTaskStatus } from "../../api/types";
import { TASK_STAGE_LABELS, TASK_STATUS_LABELS } from "./columns";

export type VisaTaskFilters = {
  query: string;
  stage: "all" | VisaTaskStage;
  status: "all" | VisaTaskStatus;
};

export function VisaTaskTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: VisaTaskFilters;
  onFiltersChange: (filters: VisaTaskFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--app-muted)]" size={14} />
        <span className="sr-only">搜索签证任务</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索学生、院校、任务或意见"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--app-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">任务阶段</span>
        <select
          value={filters.stage}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              stage: event.target.value as VisaTaskFilters["stage"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部任务阶段</option>
          {Object.entries(TASK_STAGE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">任务状态</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as VisaTaskFilters["status"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部任务状态</option>
          {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
