"use client";

import {
  HELP_TICKET_STATUS_LABELS,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";
import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";

export type HelpTicketTableFilters = {
  query: string;
  status: "all" | HelpTicketStatus;
  assignee: string;
};

export function HelpTicketTableToolbar({
  filters,
  assignees,
  onFiltersChange,
  viewOptions,
}: {
  filters: HelpTicketTableFilters;
  assignees: string[];
  onFiltersChange: (filters: HelpTicketTableFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(filters.query) ||
    filters.status !== "all" ||
    filters.assignee !== "all";

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 xl:max-w-sm">
        <Icons.search className="size-3.5 text-[var(--foreground-muted)]" aria-hidden="true" />
        <span className="sr-only">搜索工单</span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索问题、学生或分配人"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
      <label>
        <span className="sr-only">工单状态</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as HelpTicketTableFilters["status"],
            })
          }
          className="h-9 min-w-36 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
        >
          <option value="all">全部工单状态</option>
          {Object.entries(HELP_TICKET_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">分配人</span>
        <select
          value={filters.assignee}
          onChange={(event) =>
            onFiltersChange({ ...filters, assignee: event.target.value })
          }
          className="h-9 min-w-36 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
        >
          <option value="all">全部分配人</option>
          {assignees.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
      </label>
      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({ query: "", status: "all", assignee: "all" })
            }
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
