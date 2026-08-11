"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icons } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { initialAccountActionState, type AccountActionState } from "@/app/dashboard/admin/accounts/action-state";
import {
  deleteAccountAction,
  updateMembershipTierAction,
  updateProfileRoleAction,
  updateProfileStatusAction,
} from "@/app/dashboard/admin/accounts/actions";
import type { AccountListProfile, AccountScope } from "../../api/types";
import {
  canManageTarget,
  getAssignableRoles,
  MEMBERSHIP_FILTERS,
  ROLE_LABELS,
  STATUS_LABELS,
} from "../../constants/account-options";

type ActionPanel = "role" | "status" | "membership" | "delete";

export function AccountCellAction({
  profile,
  scope,
  viewerRole,
}: {
  profile: AccountListProfile;
  scope: AccountScope;
  viewerRole: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ActionPanel>("role");
  const canManage = canManageTarget(viewerRole, profile.role, scope);
  const canDelete = scope === "tenant" && viewerRole === "tenant_super_admin" && canManage;

  function openPanel(nextPanel: ActionPanel) {
    setPanel(nextPanel);
    setOpen(true);
  }

  return (
    <>
      <details className="group relative inline-block text-left">
        <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-text)]" aria-label="打开账号操作">
          <Icons.more className="size-4" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-40 border border-[var(--app-border)] bg-[var(--app-card-bg)] p-1 shadow-lg">
          <MenuButton icon={Icons.view} label="查看详情" onClick={() => router.push(`${pathname.replace(/\/$/, "")}/${profile.id}`)} />
          {canManage ? (
            <>
              <MenuButton icon={Icons.permissions} label="修改角色" onClick={() => openPanel("role")} />
              <MenuButton icon={Icons.shield} label="修改状态" onClick={() => openPanel("status")} />
              {profile.role === "student" && <MenuButton icon={Icons.edit} label="修改会员档位" onClick={() => openPanel("membership")} />}
              {canDelete && (
                <>
                  <div className="my-1 border-t border-[var(--app-border)]" />
                  <MenuButton icon={Icons.trash} label="删除账号" destructive onClick={() => openPanel("delete")} />
                </>
              )}
            </>
          ) : (
            <p className="px-2 py-2 text-xs text-[var(--app-muted)]">受保护账号</p>
          )}
        </div>
      </details>

      <AccountActionDialog
        open={open}
        onOpenChange={setOpen}
        panel={panel}
        profile={profile}
        scope={scope}
        viewerRole={viewerRole}
      />
    </>
  );
}

function AccountActionDialog({
  open,
  onOpenChange,
  panel,
  profile,
  scope,
  viewerRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: ActionPanel;
  profile: AccountListProfile;
  scope: AccountScope;
  viewerRole: string;
}) {
  const [statusChoice, setStatusChoice] = useState(profile.status);
  const [confirmation, setConfirmation] = useState("");
  const [roleState, roleAction, rolePending] = useActionState(
    updateProfileRoleAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateProfileStatusAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [membershipState, membershipAction, membershipPending] = useActionState(
    updateMembershipTierAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAccountAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const assignableRoles = getAssignableRoles(viewerRole, scope);
  const expectedConfirmation = profile.email || profile.id.slice(-6);
  const matchesConfirmation = confirmation.trim().toLocaleLowerCase() === expectedConfirmation.toLocaleLowerCase();
  const displayName = profile.full_name || profile.login_id || profile.email || "未命名账号";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
          <DialogTitle className="text-base">管理账号</DialogTitle>
          <DialogDescription className="text-xs">{displayName} · {profile.login_id || profile.email || `…${profile.id.slice(-8)}`}</DialogDescription>
        </DialogHeader>

        {panel === "role" && (
          <>
            <form action={roleAction} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
              <PanelLabel title={scope === "platform" ? "平台角色" : "账号角色"} current={ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role} />
              <div className="px-5 py-4">
                <select name="role" defaultValue={profile.role} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  {assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </div>
              <SubmitCell pending={rolePending} idleLabel="保存角色" />
            </form>
            <ResultMessage state={roleState} />
          </>
        )}

        {panel === "status" && (
          <>
            <form action={statusAction} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
              <PanelLabel title="账号状态" current={STATUS_LABELS[profile.status] ?? profile.status} />
              <div className="space-y-2 px-5 py-4">
                <select name="status" defaultValue={profile.status} onChange={(event) => setStatusChoice(event.target.value)} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  <option value="active">正常</option><option value="inactive">已停用</option><option value="suspended">暂停</option>
                </select>
                {statusChoice !== "active" && <textarea name="deactivate_reason" required maxLength={300} rows={2} defaultValue={profile.deactivate_reason ?? ""} placeholder="填写暂停或停用原因" className="app-input w-full resize-none rounded-md border px-2.5 py-2 text-xs" />}
              </div>
              <SubmitCell pending={statusPending} idleLabel="保存状态" />
            </form>
            <ResultMessage state={statusState} />
          </>
        )}

        {panel === "membership" && profile.role === "student" && (
          <>
            <form action={membershipAction} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
              <PanelLabel title="会员档位" current={MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]} />
              <div className="px-5 py-4">
                <select name="membership_tier" defaultValue={normalizeMembershipTier(profile.membership_tier)} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  {MEMBERSHIP_FILTERS.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <SubmitCell pending={membershipPending} idleLabel="保存档位" />
            </form>
            <ResultMessage state={membershipState} />
          </>
        )}

        {panel === "delete" && scope === "tenant" && viewerRole === "tenant_super_admin" && (
          <>
            <form action={deleteAction} className="grid bg-rose-50/35 sm:grid-cols-[150px_minmax(0,1fr)_112px]">
              <PanelLabel title="永久删除" current="此操作无法恢复" destructive />
              <div className="space-y-2 px-5 py-4">
                <textarea name="deletion_reason" required minLength={2} maxLength={300} rows={2} defaultValue="清理测试账号" className="app-input w-full resize-none rounded-md border px-2.5 py-2 text-xs" />
                <code className="block rounded-md bg-rose-100 px-2.5 py-2 text-[11px] font-semibold text-rose-700">{expectedConfirmation}</code>
                <input name="confirmation" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="输入上方内容确认" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
              </div>
              <SubmitCell pending={deletePending} idleLabel="永久删除" disabled={!matchesConfirmation} destructive />
            </form>
            <ResultMessage state={deleteState} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuButton({ icon: Icon, label, destructive = false, onClick }: { icon: typeof Icons.view; label: string; destructive?: boolean; onClick: () => void }) {
  return <button type="button" className={`flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium hover:bg-[var(--app-soft-bg)] ${destructive ? "text-rose-600" : "text-[var(--app-text-soft)]"}`} onClick={onClick}><Icon className="size-3.5" />{label}</button>;
}

function PanelLabel({ title, current, destructive = false }: { title: string; current: string; destructive?: boolean }) {
  return <div className="border-b border-[var(--app-border)] px-5 py-4 sm:border-r sm:border-b-0"><p className={`text-xs font-semibold ${destructive ? "text-rose-700" : ""}`}>{title}</p><p className={`mt-1 text-[11px] ${destructive ? "text-rose-600" : "text-[var(--app-muted)]"}`}>当前：{current}</p></div>;
}

function SubmitCell({ pending, idleLabel, disabled = false, destructive = false }: { pending: boolean; idleLabel: string; disabled?: boolean; destructive?: boolean }) {
  return <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4"><button type="submit" disabled={disabled || pending} className={`h-9 w-full rounded-md px-3 text-xs font-semibold text-white disabled:opacity-40 ${destructive ? "bg-rose-600" : "bg-neutral-950"}`}>{pending ? (destructive ? "删除中…" : "保存中…") : idleLabel}</button></div>;
}

function ResultMessage({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;
  return <p role="status" className={`border-t px-5 py-3 text-xs font-semibold ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</p>;
}
