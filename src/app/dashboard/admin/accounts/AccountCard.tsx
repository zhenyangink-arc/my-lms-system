"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Mail,
  Shield,
  UserCog,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      style={{ backgroundColor: "var(--app-accent)" }}
    >
      {pending ? "正在保存…" : label}
    </button>
  );
}

function formatRegistrationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间待确认";
  }

  // 机构位于韩国，账号管理统一使用韩国时区，避免跨时区查看时产生日期偏差。
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

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
  const displayName = profile.full_name || "未填写姓名";
  const avatarText = displayName === "未填写姓名" ? "?" : displayName.slice(0, 1);
  const statusStyle = STATUS_STYLES[profile.status] ?? STATUS_STYLES.inactive;

  return (
    <article className="app-card flex h-full flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
      <div className="flex items-start gap-4">
        <div
          className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
          style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
        >
          {avatarText}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight">{displayName}</h3>
              {profile.email ? (
                <p className="app-muted-text mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs">
                  <Mail className="shrink-0" size={13} />{profile.email}
                </p>
              ) : (
                <p className="mt-1 text-xs font-bold text-amber-700">尚未同步邮箱</p>
              )}
            </div>

            <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
              {STATUS_LABELS[profile.status] ?? profile.status}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="app-soft-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black">
              <Shield size={12} />
              {ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}
            </span>
            <span className="app-soft-card rounded-full border px-2.5 py-1 text-[11px] font-bold">
              编号 …{profile.id.slice(-6)}
            </span>
          </div>
        </div>
      </div>

      <div className="app-soft-card mt-5 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="app-muted-text" size={18} />
          <div>
            <p className="app-muted-text text-[11px] font-black">注册时间（韩国）</p>
            <p className="mt-0.5 text-sm font-black">{formatRegistrationTime(profile.created_at)}</p>
          </div>
        </div>
        <CheckCircle2 size={18} style={{ color: "var(--app-accent)" }} />
      </div>

      {profile.status !== "active" && profile.deactivate_reason && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          <CircleAlert className="mt-0.5 shrink-0" size={15} />
          <span><b>状态原因：</b>{profile.deactivate_reason}</span>
        </div>
      )}

      <div className="mt-auto pt-5">
        {canManage ? (
          <div className="grid grid-cols-2 gap-2">
            <Dialog>
              <DialogTrigger
                type="button"
                className="app-soft-card inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-black transition hover:opacity-80"
                style={{ color: "var(--app-accent)" }}
              >
                <UserCog size={16} />修改角色
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改账号角色</DialogTitle>
                  <DialogDescription>角色会改变后台访问范围，请确认此成员的实际职责。</DialogDescription>
                </DialogHeader>

                <form action={updateProfileRoleAction.bind(null, profile.id)} className="space-y-4">
                  <div className="app-soft-card rounded-2xl border p-4 text-sm">
                    <p className="app-muted-text text-xs font-bold">正在修改</p>
                    <p className="mt-1 font-black">{displayName}</p>
                    <p className="app-muted-text mt-1 text-xs">当前角色：{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black">新的角色</span>
                    <select name="role" defaultValue={profile.role} className="app-input w-full rounded-2xl border px-3 py-3 text-sm font-bold">
                      {assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  </label>

                  <SubmitButton label="确认修改角色" />
                </form>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger
                type="button"
                className="app-soft-card inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-black transition hover:opacity-80"
                style={{ color: "var(--app-accent)" }}
              >
                <CircleAlert size={16} />修改状态
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改账号状态</DialogTitle>
                  <DialogDescription>暂停或停用后，该账号将无法继续进入受保护页面。</DialogDescription>
                </DialogHeader>

                <form action={updateProfileStatusAction.bind(null, profile.id)} className="space-y-4">
                  <div className="app-soft-card rounded-2xl border p-4 text-sm">
                    <p className="app-muted-text text-xs font-bold">正在修改</p>
                    <p className="mt-1 font-black">{displayName}</p>
                    <p className="app-muted-text mt-1 text-xs">当前状态：{STATUS_LABELS[profile.status] ?? profile.status}</p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black">新的状态</span>
                    <select
                      name="status"
                      defaultValue={profile.status}
                      onChange={(event) => setStatusChoice(event.target.value)}
                      className="app-input w-full rounded-2xl border px-3 py-3 text-sm font-bold"
                    >
                      <option value="active">正常</option>
                      <option value="inactive">已停用</option>
                      <option value="suspended">暂停</option>
                    </select>
                  </label>

                  {statusChoice !== "active" && (
                    <label className="block">
                      <span className="mb-2 block text-sm font-black">调整原因（必填）</span>
                      <textarea
                        name="deactivate_reason"
                        required
                        maxLength={300}
                        rows={4}
                        placeholder="例如：学习服务已结束，暂时停用账号。"
                        className="app-input w-full resize-none rounded-2xl border px-3 py-3 text-sm"
                      />
                      <p className="app-muted-text mt-1 text-xs">原因会显示在账号卡片中，便于团队交接。</p>
                    </label>
                  )}

                  <SubmitButton label="确认修改状态" />
                </form>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="app-soft-card rounded-2xl border px-4 py-3 text-center text-xs font-bold">
            当前账号受更高层级权限保护
          </div>
        )}
      </div>
    </article>
  );
}
