"use client";

import { useActionState, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialAccountActionState, type AccountActionState } from "./action-state";
import {
  updateProfileRoleAction,
  updateProfileStatusAction,
} from "./actions";
import type { AccountListProfile } from "./AccountCard";
import { ROLE_LABELS, STATUS_LABELS } from "./permissions";

function ResultMessage({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role="status"
      className={`border-t px-5 py-3 text-xs font-semibold ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function PlatformAccountTableActions({
  profile,
}: {
  profile: AccountListProfile;
}) {
  const [statusChoice, setStatusChoice] = useState(profile.status);
  const [roleState, roleAction, rolePending] = useActionState(
    updateProfileRoleAction.bind(null, profile.id),
    initialAccountActionState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateProfileStatusAction.bind(null, profile.id),
    initialAccountActionState
  );
  const displayName = profile.full_name || profile.login_id || "未命名账号";

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]"
        style={{ borderColor: "var(--app-border)" }}
      >
        <MoreHorizontal size={14} />
        管理
      </DialogTrigger>
      <DialogContent className="max-w-[720px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--app-border)" }}>
          <DialogTitle className="text-base">管理平台账号</DialogTitle>
          <DialogDescription className="text-xs">
            {displayName} · {profile.login_id || profile.email || `…${profile.id.slice(-8)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
          <form action={roleAction} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
            <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
              <p className="text-xs font-semibold">平台角色</p>
              <p className="app-muted-text mt-1 text-[11px]">当前：{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</p>
            </div>
            <div className="px-5 py-4">
              <select
                name="role"
                defaultValue={profile.role}
                className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"
              >
                <option value="platform_deputy">平台副负责人</option>
                <option value="platform_admin">平台管理员</option>
                <option value="platform_course_inspector">平台课程巡检员</option>
              </select>
            </div>
            <div className="flex items-center px-5 pb-4 sm:px-4 sm:py-4">
              <button
                type="submit"
                disabled={rolePending}
                className="h-9 w-full rounded-md bg-neutral-950 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {rolePending ? "保存中…" : "保存角色"}
              </button>
            </div>
          </form>
          <ResultMessage state={roleState} />

          <form action={statusAction} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
            <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
              <p className="text-xs font-semibold">账号状态</p>
              <p className="app-muted-text mt-1 text-[11px]">当前：{STATUS_LABELS[profile.status] ?? profile.status}</p>
            </div>
            <div className="space-y-2 px-5 py-4">
              <select
                name="status"
                defaultValue={profile.status}
                onChange={(event) => setStatusChoice(event.target.value)}
                className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"
              >
                <option value="active">正常</option>
                <option value="inactive">已停用</option>
                <option value="suspended">暂停</option>
              </select>
              {statusChoice !== "active" && (
                <textarea
                  name="deactivate_reason"
                  required
                  maxLength={300}
                  rows={2}
                  defaultValue={profile.deactivate_reason ?? ""}
                  placeholder="填写暂停或停用原因"
                  className="app-input w-full resize-none rounded-md border px-2.5 py-2 text-xs"
                />
              )}
            </div>
            <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4">
              <button
                type="submit"
                disabled={statusPending}
                className="h-9 w-full rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50"
                style={{ borderColor: "var(--app-border)" }}
              >
                {statusPending ? "保存中…" : "保存状态"}
              </button>
            </div>
          </form>
          <ResultMessage state={statusState} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
