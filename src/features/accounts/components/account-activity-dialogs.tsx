"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { AccountAuditLog, AccountDeletionAuditLog, AccountDetailAuditLog } from "../api/types";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function AccountActivityDialog({ logs, accountNames }: { logs: AccountAuditLog[]; accountNames: Record<string, string> }) {
  return (
    <ActivityDialog title="账号操作记录" description="查看最近的账号角色、状态和资料变更。" count={logs.length}>
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead><tr className="border-b bg-[var(--surface-soft)]"><th className="px-4 py-3">操作时间</th><th className="px-4 py-3">目标账号</th><th className="px-4 py-3">操作类型</th><th className="px-4 py-3">变更字段</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id} className="border-b last:border-b-0"><td className="px-4 py-3"><LocalDateTime value={log.created_at} options={DATE_TIME_OPTIONS} /></td><td className="px-4 py-3 font-medium">{accountNames[log.target_user_id] ?? `账号 …${log.target_user_id.slice(-6)}`}</td><td className="px-4 py-3">{log.action}</td><td className="px-4 py-3 text-[var(--foreground-muted)]">{log.changed_fields?.join("、") || "—"}</td></tr>)}</tbody>
      </table>
    </ActivityDialog>
  );
}

export function AccountDeletionActivityDialog({ logs }: { logs: AccountDeletionAuditLog[] }) {
  return (
    <ActivityDialog title="账号删除记录" description="查看永久删除账号时保留的审计快照。" count={logs.length}>
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead><tr className="border-b bg-[var(--surface-soft)]"><th className="px-4 py-3">删除时间</th><th className="px-4 py-3">账号</th><th className="px-4 py-3">原角色</th><th className="px-4 py-3">删除原因</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id} className="border-b last:border-b-0"><td className="px-4 py-3"><LocalDateTime value={log.deleted_at} options={DATE_TIME_OPTIONS} /></td><td className="px-4 py-3"><p className="font-medium">{log.target_full_name || "未填写姓名"}</p><p className="text-[var(--foreground-muted)]">{log.target_email || `账号 …${log.target_user_id.slice(-6)}`}</p></td><td className="px-4 py-3">{log.target_role || "—"}</td><td className="px-4 py-3">{log.deletion_reason}</td></tr>)}</tbody>
      </table>
    </ActivityDialog>
  );
}

export function AccountDetailActivityDialog({ logs, actorNames }: { logs: AccountDetailAuditLog[]; actorNames: Record<string, string> }) {
  return (
    <ActivityDialog title="账号变更历史" description="查看此账号的历史变更和操作人员。" count={logs.length}>
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead><tr className="border-b bg-[var(--surface-soft)]"><th className="px-4 py-3">操作时间</th><th className="px-4 py-3">操作人员</th><th className="px-4 py-3">操作类型</th><th className="px-4 py-3">变更字段</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id} className="border-b last:border-b-0"><td className="px-4 py-3"><LocalDateTime value={log.created_at} options={DATE_TIME_OPTIONS} /></td><td className="px-4 py-3">{log.actor_id ? actorNames[log.actor_id] ?? `管理员 …${log.actor_id.slice(-6)}` : "系统"}</td><td className="px-4 py-3">{log.action}</td><td className="px-4 py-3 text-[var(--foreground-muted)]">{log.changed_fields?.join("、") || "—"}</td></tr>)}</tbody>
      </table>
    </ActivityDialog>
  );
}

function ActivityDialog({ title, description, count, children }: { title: string; description: string; count: number; children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger className="h-8 rounded-md border border-[var(--border)] px-3 text-xs font-semibold">{title}（{count}）</DialogTrigger>
      <DialogContent className="max-w-[920px] p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="overflow-x-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
