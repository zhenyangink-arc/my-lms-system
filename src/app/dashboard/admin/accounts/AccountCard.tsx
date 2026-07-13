"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { updateProfileRoleAction, updateProfileStatusAction } from "./actions";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  getAssignableRoles,
  canManageTarget,
} from "./permissions";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  deactivate_reason: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: "var(--app-status-active-bg)", text: "var(--app-status-active-text)" },
  inactive: { bg: "var(--app-status-inactive-bg)", text: "var(--app-status-inactive-text)" },
  suspended: { bg: "var(--app-status-suspended-bg)", text: "var(--app-status-suspended-text)" },
};

export function AccountCard({
  profile,
  viewerRole,
}: {
  profile: Profile;
  viewerRole: string;
}) {
  const [statusChoice, setStatusChoice] = useState(profile.status);

  const canManage = canManageTarget(viewerRole, profile.role);
  const assignableRoles = getAssignableRoles(viewerRole);

  return (
    <div className="app-soft-card space-y-3 rounded-2xl border p-5">
      <div>
        <p className="font-semibold">{profile.full_name || "（未填写姓名）"}</p>

        {profile.email && (
          <p className="text-xs opacity-60">{profile.email}</p>
        )}

        <div className="mt-1 flex items-center gap-2 text-sm">
          <span
            className="rounded-full border px-2.5 py-0.5"
            style={{ borderColor: "var(--app-border)" }}
          >
            {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}
          </span>

          <span
            className="rounded-full px-2.5 py-0.5 text-white"
            style={{
              backgroundColor: STATUS_STYLES[profile.status]?.bg ?? "var(--app-status-inactive-bg)",
              color: STATUS_STYLES[profile.status]?.text ?? "#ffffff",
            }}
          >
            {STATUS_LABELS[profile.status] ?? profile.status}
          </span>
        </div>
      </div>

      创建时间：
      {new Date(profile.created_at).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
      })}

      {profile.status !== "active" && profile.deactivate_reason && (
        <p className="text-xs opacity-70">原因：{profile.deactivate_reason}</p>
      )}

      {canManage && (
        <div className="flex gap-2 pt-1">
          {/* 修改角色 Dialog */}
          <Dialog>
            <DialogTrigger
              type="button"
              className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: "var(--app-border)", color: "var(--app-accent)" }}
            >
              修改角色
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>修改角色</DialogTitle>
              </DialogHeader>

              <form
                action={updateProfileRoleAction.bind(null, profile.id)}
                className="space-y-4"
              >
                <p className="text-sm opacity-70">
                  当前角色：{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}
                </p>

                <select
                  name="role"
                  defaultValue={profile.role}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  确认修改
                </button>
              </form>
            </DialogContent>
          </Dialog>

          {/* 修改状态 Dialog */}
          <Dialog>
            <DialogTrigger
              type="button"
              className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: "var(--app-border)", color: "var(--app-accent)" }}
            >
              修改状态
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>修改账号状态</DialogTitle>
              </DialogHeader>

              <form
                action={updateProfileStatusAction.bind(null, profile.id)}
                className="space-y-4"
              >
                <p className="text-sm opacity-70">
                  当前状态：{STATUS_LABELS[profile.status] ?? profile.status}
                </p>

                <select
                  name="status"
                  defaultValue={profile.status}
                  onChange={(e) => setStatusChoice(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <option value="active">正常</option>
                  <option value="inactive">已停用</option>
                  <option value="suspended">暂停</option>
                </select>

                {statusChoice !== "active" && (
                  <div>
                    <label className="mb-1 block text-sm">停用原因（必填）</label>
                    <textarea
                      name="deactivate_reason"
                      required
                      rows={3}
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--app-border)" }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  确认修改
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}