"use client";

import { Icons } from "@/components/icons";
import type { AccountListProfile, AccountScope } from "../../api/types";

export interface AccountCellActionProps {
  profile: AccountListProfile;
  scope: AccountScope;
  canManage: boolean;
  onView?: (profile: AccountListProfile) => void;
  onEditRole?: (profile: AccountListProfile) => void;
  onEditStatus?: (profile: AccountListProfile) => void;
  onEditMembership?: (profile: AccountListProfile) => void;
  onDelete?: (profile: AccountListProfile) => void;
}

export function AccountCellAction({
  profile,
  canManage,
  onView,
  onEditRole,
  onEditStatus,
  onEditMembership,
  onDelete,
}: AccountCellActionProps) {
  return (
    <details className="group relative inline-block text-left">
      <summary
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-text)]"
        aria-label="打开账号操作"
      >
        <Icons.more className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-40 border border-[var(--app-border)] bg-[var(--app-card-bg)] p-1 shadow-lg">
        <ActionButton icon={Icons.view} label="查看详情" onClick={() => onView?.(profile)} />
        {canManage && (
          <>
            <ActionButton icon={Icons.permissions} label="修改角色" onClick={() => onEditRole?.(profile)} />
            <ActionButton icon={Icons.shield} label="修改状态" onClick={() => onEditStatus?.(profile)} />
            {profile.role === "student" && (
              <ActionButton icon={Icons.edit} label="修改会员档位" onClick={() => onEditMembership?.(profile)} />
            )}
            <div className="my-1 border-t border-[var(--app-border)]" />
            <ActionButton icon={Icons.trash} label="删除账号" destructive onClick={() => onDelete?.(profile)} />
          </>
        )}
      </div>
    </details>
  );
}

function ActionButton({
  icon: Icon,
  label,
  destructive = false,
  onClick,
}: {
  icon: typeof Icons.view;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--app-soft-bg)] ${destructive ? "text-rose-600" : "text-[var(--app-text-soft)]"}`}
      onClick={onClick}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
