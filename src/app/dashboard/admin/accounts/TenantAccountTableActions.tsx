"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { initialAccountActionState, type AccountActionState } from "./action-state";
import {
  deleteAccountAction,
  updateMembershipTierAction,
  updateProfileRoleAction,
  updateProfileStatusAction,
} from "./actions";
import type { AccountListProfile } from "./AccountCard";
import { ROLE_LABELS, STATUS_LABELS, canManageTarget, getAssignableRoles } from "./permissions";

function ResultMessage({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role="status"
      className={`border-t px-5 py-2.5 text-xs font-semibold ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function TenantAccountTableActions({
  profile,
  viewerRole,
}: {
  profile: AccountListProfile;
  viewerRole: string;
}) {
  const canManage = canManageTarget(viewerRole, profile.role, "tenant");
  const assignableRoles = getAssignableRoles(viewerRole, "tenant");
  const displayName = profile.full_name || profile.login_id || profile.email || "未命名账号";
  const [statusChoice, setStatusChoice] = useState(profile.status);
  const [confirmation, setConfirmation] = useState("");
  const [membershipState, membershipAction, membershipPending] = useActionState(
    updateMembershipTierAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [roleState, roleAction, rolePending] = useActionState(
    updateProfileRoleAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateProfileStatusAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAccountAction.bind(null, profile.id),
    initialAccountActionState,
  );
  const expectedConfirmation = profile.email || profile.id.slice(-6);
  const matchesConfirmation = confirmation.trim().toLocaleLowerCase() === expectedConfirmation.toLocaleLowerCase();

  if (!canManage) {
    return (
      <span className="app-muted-text inline-flex h-8 items-center gap-1.5 px-2 text-[11px] font-medium">
        <CheckCircle2 size={13} />受保护
      </span>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label={`管理${displayName}`}
        className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]"
        style={{ borderColor: "var(--app-border)" }}
      >
        管理
      </DialogTrigger>
      <DialogContent className="max-h-[min(880px,calc(100vh-32px))] max-w-[780px] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--app-border)" }}>
          <DialogTitle className="text-base">管理机构账号</DialogTitle>
          <DialogDescription className="text-xs">
            {displayName} · {profile.login_id || profile.email || `…${profile.id.slice(-8)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
          {profile.role === "student" && (
            <section>
              <form action={membershipAction} className="grid sm:grid-cols-[160px_minmax(0,1fr)_112px]">
                <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-xs font-semibold">会员档位</p>
                  <p className="app-muted-text mt-1 text-[11px]">当前：{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</p>
                </div>
                <div className="px-5 py-4">
                  <select name="membership_tier" defaultValue={normalizeMembershipTier(profile.membership_tier)} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                    <option value="normal">普通学生</option>
                    <option value="vip1">一级会员学生</option>
                    <option value="vip2">二级会员学生</option>
                    <option value="vip3">三级会员学生</option>
                  </select>
                </div>
                <div className="flex items-center px-5 pb-4 sm:px-4 sm:py-4">
                  <button type="submit" disabled={membershipPending} className="h-9 w-full rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50" style={{ borderColor: "var(--app-border)" }}>{membershipPending ? "保存中…" : "保存档位"}</button>
                </div>
              </form>
              <ResultMessage state={membershipState} />
            </section>
          )}

          <section>
            <form action={roleAction} className="grid sm:grid-cols-[160px_minmax(0,1fr)_112px]">
              <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs font-semibold">账号角色</p>
                <p className="app-muted-text mt-1 text-[11px]">当前：{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</p>
              </div>
              <div className="px-5 py-4">
                <select name="role" defaultValue={profile.role} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  {assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </div>
              <div className="flex items-center px-5 pb-4 sm:px-4 sm:py-4">
                <button type="submit" disabled={rolePending} className="h-9 w-full rounded-md bg-neutral-950 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">{rolePending ? "保存中…" : "保存角色"}</button>
              </div>
            </form>
            <ResultMessage state={roleState} />
          </section>

          <section>
            <form action={statusAction} className="grid sm:grid-cols-[160px_minmax(0,1fr)_112px]">
              <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-xs font-semibold">账号状态</p>
                <p className="app-muted-text mt-1 text-[11px]">当前：{STATUS_LABELS[profile.status] ?? profile.status}</p>
              </div>
              <div className="space-y-2 px-5 py-4">
                <select name="status" defaultValue={profile.status} onChange={(event) => setStatusChoice(event.target.value)} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  <option value="active">正常</option>
                  <option value="inactive">已停用</option>
                  <option value="suspended">暂停</option>
                </select>
                {statusChoice !== "active" && (
                  <textarea name="deactivate_reason" required maxLength={300} rows={2} defaultValue={profile.deactivate_reason ?? ""} placeholder="填写暂停或停用原因" className="app-input w-full resize-none rounded-md border px-2.5 py-2 text-xs" />
                )}
              </div>
              <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4">
                <button type="submit" disabled={statusPending} className="h-9 w-full rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50" style={{ borderColor: "var(--app-border)" }}>{statusPending ? "保存中…" : "保存状态"}</button>
              </div>
            </form>
            <ResultMessage state={statusState} />
          </section>

          {viewerRole === "tenant_super_admin" && (
            <section className="bg-rose-50/35">
              <form action={deleteAction} className="grid sm:grid-cols-[160px_minmax(0,1fr)_112px]">
                <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700"><Trash2 size={13} />永久删除</p>
                  <p className="mt-1 text-[11px] text-rose-600">此操作无法恢复</p>
                </div>
                <div className="space-y-2 px-5 py-4">
                  <textarea name="deletion_reason" required minLength={2} maxLength={300} rows={2} defaultValue="清理测试账号" className="app-input w-full resize-none rounded-md border px-2.5 py-2 text-xs" />
                  <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                    <code className="rounded-md bg-rose-100 px-2.5 py-2 text-[11px] font-semibold text-rose-700">{expectedConfirmation}</code>
                    <input name="confirmation" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="输入左侧内容确认" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
                  </div>
                </div>
                <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4">
                  <button type="submit" disabled={!matchesConfirmation || deletePending} className="h-9 w-full rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-35">{deletePending ? "删除中…" : "永久删除"}</button>
                </div>
              </form>
              <ResultMessage state={deleteState} />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
