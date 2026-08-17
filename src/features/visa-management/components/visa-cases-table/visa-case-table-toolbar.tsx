"use client";

import { Search } from "lucide-react";

import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";

export type VisaCaseFilters = {
  query: string;
  channel: "all" | "china_consulate" | "korea_immigration";
  status: "all" | "action" | "preparing" | "submitted" | "issued";
};

export function VisaCaseTableToolbar({
  filters,
  onFiltersChange,
  viewOptions,
}: {
  filters: VisaCaseFilters;
  onFiltersChange: (filters: VisaCaseFilters) => void;
  viewOptions: DataTableViewOption[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 transition focus-within:border-[var(--ring)] focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 sm:max-w-sm">
        <Search className="shrink-0 text-[var(--foreground-muted)]" size={14} />
        <span className="shrink-0 text-[10px] font-semibold text-[var(--foreground-secondary)]">
          搜索档案
        </span>
        <input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="搜索学生、院校、专业"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--foreground-muted)]"
        />
      </label>
      <label>
        <span className="sr-only">办理通道</span>
        <select
          value={filters.channel}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              channel: event.target.value as VisaCaseFilters["channel"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部办理通道</option>
          <option value="china_consulate">驻华领馆递签</option>
          <option value="korea_immigration">韩国出入境返签</option>
        </select>
      </label>
      <label>
        <span className="sr-only">办理阶段</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as VisaCaseFilters["status"],
            })
          }
          className="app-input h-9 border px-2.5 text-xs font-medium"
        >
          <option value="all">全部办理阶段</option>
          <option value="action">需要处理</option>
          <option value="preparing">准备阶段</option>
          <option value="submitted">递签阶段</option>
          <option value="issued">已经获签</option>
        </select>
      </label>
      <DataTableViewOptions options={viewOptions} className="ml-auto" />
    </div>
  );
}
