"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crown,
  FileCheck2,
  Mail,
  Shield,
  Trash2,
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
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { initialAccountActionState, type AccountActionState } from "./action-state";
import {
  deleteAccountAction,
  updateMembershipTierAction,
  updateProfileRoleAction,
  updateProfileStatusAction,
} from "./actions";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  canManageTarget,
  getAssignableRoles,
} from "./permissions";

export type AccountListProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  registered_at: string | null;
  updated_at: string | null;
  last_active_at: string | null;
  profile_completed_at: string | null;
  registration_source: string | null;
  deactivate_reason: string | null;
  membership_tier: string;
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

function DangerSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
      {pending ? "正在永久删除…" : "永久删除这个账号"}
    </button>
  );
}

function ActionMessage({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role="status"
      className={`rounded-xl px-3 py-2.5 text-xs font-bold ${
        state.status === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </p>
  );
}

function formatKoreanTime(value: string | null | undefined, includeTime = true) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";

  // 机构位于韩国，账号管理统一使用韩国时区，避免跨时区查看产生偏差。
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function formatRecentActivity(value: string | null) {
  if (!value) return "尚无活跃记录";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "时间待确认";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 5) return "刚刚活跃";
  if (minutes < 60) return `${minutes} 分钟前活跃`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)} 小时前活跃`;
  return formatKoreanTime(value, false);
}

function MembershipDialog({ profile, displayName }: { profile: AccountListProfile; displayName: string }) {
  const [state, formAction] = useActionState(
    updateMembershipTierAction.bind(null, profile.id),
    initialAccountActionState
  );

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="app-soft-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:-translate-y-0.5 hover:opacity-90"
        style={{ color: "var(--app-secondary)" }}
      >
        <Crown size={15} />会员档位
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>配置学生会员档位</DialogTitle>
          <DialogDescription>会员档位决定学生可操作的学习与留学服务，后台角色不会随之改变。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="app-soft-card rounded-2xl border p-4">
            <p className="font-black">{displayName}</p>
            <p className="app-muted-text mt-1 text-xs">当前档位：{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-black">新的会员档位</span>
            <select name="membership_tier" defaultValue={normalizeMembershipTier(profile.membership_tier)} className="app-input w-full rounded-2xl border px-3 py-3 text-sm font-bold">
              <option value="normal">普通学生</option>
              <option value="vip1">VIP1 学生</option>
              <option value="vip2">VIP2 学生（能力预留）</option>
              <option value="vip3">VIP3 学生（能力预留）</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-800"><b>普通：</b>仅开放消息与服务操作。</div>
            <div className="rounded-xl bg-orange-50 px-3 py-2.5 text-xs leading-5 text-orange-800"><b>VIP1：</b>开放留学准备与可试听课程。</div>
          </div>
          <ActionMessage state={state} />
          <SubmitButton label="保存会员档位" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ profile, displayName, viewerRole }: { profile: AccountListProfile; displayName: string; viewerRole: string }) {
  const [state, formAction] = useActionState(
    updateProfileRoleAction.bind(null, profile.id),
    initialAccountActionState
  );
  const assignableRoles = getAssignableRoles(viewerRole);

  return (
    <Dialog>
      <DialogTrigger type="button" className="app-soft-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:-translate-y-0.5 hover:opacity-90" style={{ color: "var(--app-accent)" }}>
        <UserCog size={15} />修改角色
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改账号角色</DialogTitle>
          <DialogDescription>角色会改变后台访问范围。请按照成员的实际职责分配，不要与学生会员档位混用。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
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
          <ActionMessage state={state} />
          <SubmitButton label="确认修改角色" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ profile, displayName }: { profile: AccountListProfile; displayName: string }) {
  const [statusChoice, setStatusChoice] = useState(profile.status);
  const [state, formAction] = useActionState(
    updateProfileStatusAction.bind(null, profile.id),
    initialAccountActionState
  );

  return (
    <Dialog>
      <DialogTrigger type="button" className="app-soft-card inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black transition hover:-translate-y-0.5 hover:opacity-90" style={{ color: "var(--app-warm)" }}>
        <CircleAlert size={15} />修改状态
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改账号状态</DialogTitle>
          <DialogDescription>暂停或停用后，该账号将无法继续进入受保护页面；恢复正常会清除原状态原因。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="app-soft-card rounded-2xl border p-4 text-sm">
            <p className="app-muted-text text-xs font-bold">正在修改</p>
            <p className="mt-1 font-black">{displayName}</p>
            <p className="app-muted-text mt-1 text-xs">当前状态：{STATUS_LABELS[profile.status] ?? profile.status}</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-black">新的状态</span>
            <select name="status" defaultValue={profile.status} onChange={(event) => setStatusChoice(event.target.value)} className="app-input w-full rounded-2xl border px-3 py-3 text-sm font-bold">
              <option value="active">正常</option>
              <option value="inactive">已停用</option>
              <option value="suspended">暂停</option>
            </select>
          </label>
          {statusChoice !== "active" && (
            <label className="block">
              <span className="mb-2 block text-sm font-black">调整原因（必填）</span>
              <textarea name="deactivate_reason" required maxLength={300} rows={4} defaultValue={profile.deactivate_reason ?? ""} placeholder="例如：学习服务已结束，暂时停用账号。" className="app-input w-full resize-none rounded-2xl border px-3 py-3 text-sm" />
              <p className="app-muted-text mt-1 text-xs">原因会保留在账号档案中，方便团队后续交接。</p>
            </label>
          )}
          <ActionMessage state={state} />
          <SubmitButton label="确认修改状态" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({ profile, displayName }: { profile: AccountListProfile; displayName: string }) {
  const expectedConfirmation = profile.email || profile.id.slice(-6);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState(
    deleteAccountAction.bind(null, profile.id),
    initialAccountActionState
  );
  const matchesConfirmation = confirmation.trim().toLocaleLowerCase() === expectedConfirmation.toLocaleLowerCase();

  return (
    <Dialog>
      <DialogTrigger type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100">
        <Trash2 size={15} />删除账号
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700"><AlertTriangle size={20} />永久删除账号</DialogTitle>
          <DialogDescription>此操作会删除 Supabase 登录账号、个人资料、学习与留学业务数据，无法恢复。删除记录会保留在负责人审计日志中。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-900">{displayName}</p>
            <p className="mt-1 break-all text-xs text-rose-700">{profile.email || `账号编号：${profile.id}`}</p>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-black">删除原因</span>
            <textarea name="deletion_reason" required minLength={2} maxLength={300} rows={3} defaultValue="清理测试账号" className="app-input w-full resize-none rounded-2xl border px-3 py-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">请输入以下内容确认删除</span>
            <code className="mb-2 block rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">{expectedConfirmation}</code>
            <input name="confirmation" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="完整输入上方内容" className="app-input w-full rounded-2xl border px-3 py-3 text-sm" />
          </label>
          <ActionMessage state={state} />
          <DangerSubmitButton disabled={!matchesConfirmation} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountManagementActions({ profile, viewerRole }: { profile: AccountListProfile; viewerRole: string }) {
  const canManage = canManageTarget(viewerRole, profile.role);
  const displayName = profile.full_name || "未填写姓名";

  if (!canManage) {
    return <div className="app-soft-card flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold"><CheckCircle2 size={14} />当前账号受更高层级权限保护</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {profile.role === "student" && <MembershipDialog profile={profile} displayName={displayName} />}
      <RoleDialog profile={profile} displayName={displayName} viewerRole={viewerRole} />
      <StatusDialog profile={profile} displayName={displayName} />
      {(viewerRole === "tenant_super_admin" || viewerRole === "platform_super_admin") && <DeleteAccountDialog profile={profile} displayName={displayName} />}
    </div>
  );
}

export function AccountCard({ profile, viewerRole }: { profile: AccountListProfile; viewerRole: string }) {
  const displayName = profile.full_name || "未填写姓名";
  const avatarText = displayName === "未填写姓名" ? "?" : displayName.slice(0, 1);
  const statusStyle = STATUS_STYLES[profile.status] ?? STATUS_STYLES.inactive;
  const registeredAt = profile.registered_at || profile.created_at;
  const isProfileStarted = Boolean(profile.profile_completed_at);

  return (
    <article className="app-card group flex h-full flex-col rounded-[1.75rem] border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3.5">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          {avatarText}
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2" style={{ backgroundColor: profile.status === "active" ? "#34c985" : "#f59e0b", borderColor: "var(--app-card-bg)" }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight">{displayName}</h3>
              {profile.email ? (
                <p className="app-muted-text mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs"><Mail className="shrink-0" size={13} />{profile.email}</p>
              ) : (
                <p className="mt-1 text-xs font-bold text-amber-700">尚未同步邮箱</p>
              )}
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
              {STATUS_LABELS[profile.status] ?? profile.status}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="app-soft-card inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black"><Shield size={12} />{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</span>
            {profile.role === "student" && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Crown size={12} />{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="app-soft-card rounded-2xl border px-3 py-3">
          <div className="flex items-center gap-1.5"><CalendarDays className="app-muted-text" size={14} /><p className="app-muted-text text-xs font-black">注册时间</p></div>
          <p className="mt-1.5 text-xs font-black">{formatKoreanTime(registeredAt, false)}</p>
        </div>
        <div className="app-soft-card rounded-2xl border px-3 py-3">
          <div className="flex items-center gap-1.5"><Activity className="app-muted-text" size={14} /><p className="app-muted-text text-xs font-black">最近活动</p></div>
          <p className="mt-1.5 truncate text-xs font-black">{formatRecentActivity(profile.last_active_at)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: isProfileStarted ? "var(--app-accent-soft)" : "var(--app-warm-soft)" }}>
        <div className="flex min-w-0 items-center gap-2">
          {isProfileStarted ? <FileCheck2 size={16} style={{ color: "var(--app-accent)" }} /> : <Clock3 size={16} style={{ color: "var(--app-warm)" }} />}
          <p className="truncate text-xs font-black">{isProfileStarted ? "个人资料已开始完善" : "个人资料等待填写"}</p>
        </div>
        <span className="app-muted-text shrink-0 text-xs font-bold">…{profile.id.slice(-6)}</span>
      </div>

      {profile.status !== "active" && profile.deactivate_reason && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          <CircleAlert className="mt-0.5 shrink-0" size={15} />
          <span><b>状态原因：</b>{profile.deactivate_reason}</span>
        </div>
      )}

      <div className="mt-auto pt-5">
        <Link href={`/dashboard/admin/accounts/${profile.id}`} className="mb-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-black transition hover:opacity-80" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          查看完整账号档案
          <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />
        </Link>
        <AccountManagementActions profile={profile} viewerRole={viewerRole} />
      </div>
    </article>
  );
}
