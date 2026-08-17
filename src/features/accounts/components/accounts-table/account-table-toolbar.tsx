"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Table } from "@tanstack/react-table";

import { Icons } from "@/components/icons";
import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import type { AccountFilters, AccountListProfile, AccountScope } from "../../api/types";
import {
  MEMBERSHIP_FILTERS,
  PLATFORM_ROLE_FILTERS,
  PROFILE_FILTERS,
  SORT_OPTIONS,
  STATUS_FILTERS,
  TENANT_ROLE_FILTERS,
} from "../../constants/account-options";

export function AccountTableToolbar({
  table,
  scope,
  filters,
  hasFilters,
}: {
  table: Table<AccountListProfile>;
  scope: AccountScope;
  filters: AccountFilters;
  hasFilters: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const roleFilters = scope === "tenant" ? TENANT_ROLE_FILTERS : PLATFORM_ROLE_FILTERS;
  const viewOptions = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
    .map((column) => ({
      id: column.id,
      label: columnLabel(column.id),
      visible: column.getIsVisible(),
      canHide: column.getCanHide(),
      onVisibleChange: (visible: boolean) => column.toggleVisibility(visible),
    }));

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <form method="get" className="grid min-w-0 flex-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_140px_125px_140px_125px_130px_auto]">
        <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5">
          <Icons.search className="size-3.5 shrink-0 text-[var(--foreground-muted)]" aria-hidden="true" />
          <span className="sr-only">搜索账号</span>
          <input name="q" defaultValue={filters.query} maxLength={80} placeholder="搜索姓名、邮箱或账号" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
        </label>
        <FilterSelect name="role" label="账号角色" value={filters.role} options={roleFilters} />
        <FilterSelect name="status" label="账号状态" value={filters.status} options={STATUS_FILTERS} />
        {scope === "tenant" ? (
          <FilterSelect name="membership" label="会员档位" value={filters.membership} options={MEMBERSHIP_FILTERS} />
        ) : (
          <input type="hidden" name="membership" value="all" />
        )}
        <FilterSelect name="profile" label="资料状态" value={filters.profile} options={PROFILE_FILTERS} />
        <FilterSelect name="sort" label="排序方式" value={filters.sort} options={SORT_OPTIONS} />
        <button type="submit" className="h-9 rounded-md bg-[var(--primary)] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90">筛选</button>
      </form>
      <div className="flex shrink-0 items-center gap-2">
        {hasFilters && (
          <button type="button" onClick={() => router.replace(pathname)} className="h-9 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground-secondary)]">
            清空筛选
          </button>
        )}
        <DataTableViewOptions options={viewOptions} />
      </div>
    </div>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-medium">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function columnLabel(id: string) {
  const labels: Record<string, string> = {
    account: "账号",
    role: "角色",
    membership_tier: "会员档位",
    status: "状态",
    profile_completed_at: "资料状态",
    last_active_at: "最近活动",
    registered_at: "注册时间",
  };
  return labels[id] ?? id;
}
