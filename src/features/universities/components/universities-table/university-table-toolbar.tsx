"use client";

import { Icons } from "@/components/icons";
import {
  DataTableViewOptions,
  type DataTableViewOption,
} from "@/components/ui/table/data-table-view-options";
import type { UniversityAdmissionStage } from "../../api/types";
import {
  UNIVERSITY_ADMISSION_STAGE_LABELS,
  UNIVERSITY_RANKING_FILTER_OPTIONS,
  UNIVERSITY_TUITION_FILTER_OPTIONS,
  type UniversityRankingFilter,
  type UniversityTuitionFilter,
} from "../../constants/university-options";

export type UniversityTableFilters = {
  query: string;
  status: "all" | "published" | "hidden";
  region: string;
  admissionStage: "all" | UniversityAdmissionStage;
  ranking: UniversityRankingFilter;
  tuition: UniversityTuitionFilter;
};

export const INITIAL_UNIVERSITY_TABLE_FILTERS: UniversityTableFilters = {
  query: "",
  status: "all",
  region: "all",
  admissionStage: "all",
  ranking: "all",
  tuition: "all",
};

export function UniversityTableToolbar({
  filters,
  onFiltersChange,
  regions,
  viewOptions,
}: {
  filters: UniversityTableFilters;
  onFiltersChange: (filters: UniversityTableFilters) => void;
  regions: string[];
  viewOptions: DataTableViewOption[];
}) {
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => (key === "query" ? Boolean(value) : value !== "all"),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-2.5 transition focus-within:border-[var(--ring)] focus-within:ring-2 focus-within:ring-[var(--ring)] focus-within:ring-offset-2 xl:max-w-sm">
          <Icons.search
            className="size-3.5 shrink-0 text-[var(--foreground-muted)]"
            aria-hidden="true"
          />
          <span className="shrink-0 text-[10px] font-semibold text-[var(--foreground-secondary)]">
            搜索大学
          </span>
          <input
            value={filters.query}
            onChange={(event) =>
              onFiltersChange({ ...filters, query: event.target.value })
            }
            placeholder="搜索大学、地区或简介"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <FilterSelect
          label="发布状态"
          value={filters.status}
          onChange={(status) =>
            onFiltersChange({
              ...filters,
              status: status as UniversityTableFilters["status"],
            })
          }
          options={[
            { value: "published", label: "已发布" },
            { value: "hidden", label: "未发布" },
          ]}
        />
        <FilterSelect
          label="地区"
          value={filters.region}
          onChange={(region) => onFiltersChange({ ...filters, region })}
          options={regions.map((region) => ({ value: region, label: region }))}
        />
        <FilterSelect
          label="申请阶段"
          value={filters.admissionStage}
          onChange={(admissionStage) =>
            onFiltersChange({
              ...filters,
              admissionStage:
                admissionStage as UniversityTableFilters["admissionStage"],
            })
          }
          options={Object.entries(UNIVERSITY_ADMISSION_STAGE_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="排名"
          value={filters.ranking}
          onChange={(ranking) =>
            onFiltersChange({
              ...filters,
              ranking: ranking as UniversityRankingFilter,
            })
          }
          options={[...UNIVERSITY_RANKING_FILTER_OPTIONS]}
        />
        <FilterSelect
          label="学费"
          value={filters.tuition}
          onChange={(tuition) =>
            onFiltersChange({
              ...filters,
              tuition: tuition as UniversityTuitionFilter,
            })
          }
          options={[...UNIVERSITY_TUITION_FILTER_OPTIONS]}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                onFiltersChange(INITIAL_UNIVERSITY_TABLE_FILTERS)
              }
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
        className="h-9 min-w-32 border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium"
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
