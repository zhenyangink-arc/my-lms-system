"use client";

import { Activity, Clock3, UserRoundX } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AccountAuditLog = {
  id: number;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  changed_fields: string[] | null;
  created_at: string;
};

type AccountDeletionAuditLog = {
  id: number;
  target_user_id: string;
  target_email: string | null;
  target_full_name: string | null;
  target_role: string | null;
  deletion_reason: string;
  related_data_counts: Record<string, number> | null;
  deleted_at: string;
};

const AUDIT_LABELS: Record<string, string> = {
  account_created: "创建了账号",
  role_changed: "调整了账号角色",
  status_changed: "调整了账号状态",
  membership_changed: "调整了会员档位",
  profile_updated: "更新了账号资料",
};

function formatAuditTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function AccountAuditLogDialog({ logs, accountNames }: { logs: AccountAuditLog[]; accountNames: Record<string, string> }) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="app-card flex w-full items-center justify-between gap-3 rounded-[1.75rem] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
      >
        <div>
          <p className="app-muted-text text-xs font-black">最近记录</p>
          <h2 className="mt-1 text-xl font-black">账号变更动态</h2>
          <p className="app-muted-text mt-2 text-xs">点击查看最近 {logs.length} 条角色、状态与资料变更</p>
        </div>
        <Activity size={22} style={{ color: "var(--app-secondary)" }} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>账号变更动态</DialogTitle>
          <DialogDescription>最近的角色、状态、会员档位与资料变更记录。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: log.action === "status_changed" ? "var(--app-warm)" : log.action === "membership_changed" ? "var(--app-secondary)" : "var(--app-accent)" }} />
              <div className="min-w-0 flex-1 border-b pb-3" style={{ borderColor: "var(--app-border-soft)" }}>
                <p className="truncate text-xs font-black">{accountNames[log.actor_id ?? ""] ?? "系统管理员"} {AUDIT_LABELS[log.action] ?? "更新了账号"}</p>
                <p className="app-muted-text mt-1 truncate text-xs">对象：{accountNames[log.target_user_id] ?? `账号 …${log.target_user_id.slice(-6)}`}</p>
              </div>
              <span className="app-muted-text shrink-0 text-xs font-bold">{formatAuditTime(log.created_at)}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="app-soft-card rounded-2xl border border-dashed p-5 text-center">
              <Clock3 className="mx-auto opacity-30" size={24} />
              <p className="mt-2 text-xs font-black">暂无账号变更记录</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AccountDeletionAuditDialog({ logs }: { logs: AccountDeletionAuditLog[] }) {
  if (logs.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="app-card flex w-full items-center justify-between gap-3 rounded-[1.75rem] border border-rose-100 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
      >
        <div>
          <p className="text-xs font-black text-rose-600">负责人审计</p>
          <h2 className="mt-1 text-xl font-black">永久删除记录</h2>
          <p className="mt-2 text-xs text-rose-700">点击查看最近 {logs.length} 条永久删除记录</p>
        </div>
        <UserRoundX size={22} className="text-rose-500" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-rose-700">永久删除记录</DialogTitle>
          <DialogDescription>负责人执行的永久账号删除操作，记录不可修改或删除。</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {logs.map((log) => {
            const counts = Object.entries(log.related_data_counts ?? {}).filter(([, value]) => value > 0);
            return (
              <div key={log.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{log.target_full_name || log.target_email || `账号 …${log.target_user_id.slice(-6)}`}</p>
                    <p className="mt-1 break-all text-xs text-rose-700">{log.target_email || log.target_role || "历史账号"}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-rose-600">{formatAuditTime(log.deleted_at)}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-rose-900"><b>删除原因：</b>{log.deletion_reason}</p>
                {counts.length > 0 && <p className="mt-2 text-xs text-rose-700">已清理：{counts.map(([label, value]) => `${label} ${value} 项`).join("、")}</p>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
