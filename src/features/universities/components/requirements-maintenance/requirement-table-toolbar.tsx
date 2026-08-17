"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";
import type { RequirementUniversityOption } from "./types";

export function RequirementTableToolbar({
  groups,
  activeGroup,
  onGroupChange,
  query,
  onQueryChange,
  universityId,
  onUniversityChange,
  universities,
  secondaryLabel,
  secondaryValue,
  onSecondaryChange,
  secondaryOptions,
  onClear,
  viewOptions,
}: {
  groups: Array<{ value: string; label: string; count: number }>;
  activeGroup: string;
  onGroupChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  universityId: string;
  onUniversityChange: (value: string) => void;
  universities: RequirementUniversityOption[];
  secondaryLabel: string;
  secondaryValue: string;
  onSecondaryChange: (value: string) => void;
  secondaryOptions: Array<{ value: string; label: string }>;
  onClear: () => void;
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters =
    Boolean(query) || universityId !== "all" || secondaryValue !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap border-b border-[var(--border)]">
        {groups.map((group) => (
          <button
            key={group.value}
            type="button"
            aria-pressed={activeGroup === group.value}
            onClick={() => onGroupChange(group.value)}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeGroup === group.value
                ? "border-[var(--primary)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground-secondary)]"
            }`}
          >
            {group.label}
            <span className="ml-1.5 font-mono text-[10px] tabular-nums opacity-70">
              {group.count}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 xl:max-w-sm">
          <Icons.search
            className="size-3.5 shrink-0 text-[var(--foreground-muted)]"
            aria-hidden="true"
          />
          <span className="sr-only">搜索要求</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索大学、要求名称或说明"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <FilterSelect
          label="大学"
          value={universityId}
          onChange={onUniversityChange}
          options={universities}
        />
        <FilterSelect
          label={secondaryLabel}
          value={secondaryValue}
          onChange={onSecondaryChange}
          options={secondaryOptions}
        />
        <div className="flex shrink-0 items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
              className="h-9 border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)]"
            >
              清除筛选
            </button>
          )}
          <DataTableViewOptions options={viewOptions} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-36 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
      >
        <option value="all">全部{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
