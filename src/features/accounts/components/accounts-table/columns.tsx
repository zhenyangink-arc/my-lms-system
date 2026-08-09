"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { LocalDateTime } from "@/components/LocalDateTime";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import {
  ACCOUNT_STATUS_TONES,
  ROLE_LABELS,
  STATUS_LABELS,
} from "../../constants/account-options";
import type { AccountListProfile, AccountScope } from "../../api/types";
import { AccountCellAction, type AccountCellActionProps } from "./cell-action";

const ACCOUNT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

const ACCOUNT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...ACCOUNT_DATE_OPTIONS,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return (
      <DataTableColumnHeader
        title={title}
        sortable
        direction={direction}
        onClick={() => column.toggleSorting(direction === "asc")}
      />
    );
  };
}

export function getAccountColumns({
  scope,
  viewerRole,
  actions,
}: {
  scope: AccountScope;
  viewerRole: string;
  actions?: Partial<Omit<AccountCellActionProps, "profile" | "scope" | "canManage">>;
}): ColumnDef<AccountListProfile>[] {
  const canManage =
    viewerRole === "platform_super_admin" ||
    viewerRole === "tenant_super_admin" ||
    viewerRole === "ceo";

  return [
    {
      id: "account",
      accessorFn: (profile) => profile.full_name || profile.email || profile.login_id || profile.id,
      header: sortableHeader("账号"),
      cell: ({ row }) => {
        const profile = row.original;
        const name = profile.full_name?.trim() || "未填写姓名";
        return (
          <div className="min-w-52">
            <p className="truncate font-semibold text-[var(--app-text)]">{name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">
              {profile.login_id || profile.email || `账号 …${profile.id.slice(-8)}`}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: sortableHeader("角色"),
      cell: ({ row }) => ROLE_LABELS[row.original.role as keyof typeof ROLE_LABELS] ?? row.original.role,
    },
    ...(scope === "tenant"
      ? ([{
          accessorKey: "membership_tier",
          header: "会员档位",
          cell: ({ row }: { row: { original: AccountListProfile } }) =>
            row.original.role === "student"
              ? MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(row.original.membership_tier)]
              : "—",
        }] satisfies ColumnDef<AccountListProfile>[])
      : []),
    {
      accessorKey: "status",
      header: sortableHeader("状态"),
      cell: ({ row }) => {
        const status = row.original.status;
        const tone = ACCOUNT_STATUS_TONES[status] ?? ACCOUNT_STATUS_TONES.inactive;
        return (
          <span className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: tone.text }}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
            {STATUS_LABELS[status] ?? status}
          </span>
        );
      },
    },
    {
      accessorKey: "profile_completed_at",
      header: "资料状态",
      cell: ({ row }) => (row.original.profile_completed_at ? "已建档" : "待完善"),
    },
    {
      accessorKey: "last_active_at",
      header: sortableHeader("最近活动"),
      cell: ({ row }) => (
        <span className="text-[11px] text-[var(--app-muted)]">
          <LocalDateTime value={row.original.last_active_at} options={ACCOUNT_DATE_TIME_OPTIONS} fallback="暂无记录" />
        </span>
      ),
    },
    {
      id: "registered_at",
      accessorFn: (profile) => profile.registered_at || profile.created_at,
      header: sortableHeader("注册时间"),
      cell: ({ row }) => (
        <span className="text-[11px] text-[var(--app-muted)]">
          <LocalDateTime value={row.original.registered_at || row.original.created_at} options={ACCOUNT_DATE_OPTIONS} fallback="暂无记录" />
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <AccountCellAction
            profile={row.original}
            scope={scope}
            canManage={canManage}
            {...actions}
          />
        </div>
      ),
    },
  ];
}
