"use client";

import { useActionState } from "react";
import { MoreHorizontal } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  deleteTenantPermanentlyAction,
  resetTenantManagerPasswordAction,
  setTenantStatusAction,
} from "./actions";
import { initialTenantActionState, type TenantActionState } from "./action-state";

type Manager = { id: string; loginId: string; name: string };

function ResultMessage({ state }: { state: TenantActionState }) {
  if (state.status === "idle") return null;
  return <p role="status" className={`mt-2 text-[11px] font-semibold ${state.status === "success" ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>;
}

function StatusControl({ tenantId, status }: { tenantId: string; status: "active" | "suspended" | "archived" }) {
  const nextStatus = status === "active" ? "suspended" : "active";
  const [state, action, pending] = useActionState(setTenantStatusAction.bind(null, tenantId, nextStatus), initialTenantActionState);

  return (
    <form action={action} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
      <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold">运行状态</p>
        <p className="app-muted-text mt-1 text-[10px]">当前：{status === "active" ? "运行中" : "已停用"}</p>
      </div>
      <div className="px-5 py-4 text-xs leading-5">
        {nextStatus === "suspended" ? "停用后机构成员暂时无法使用系统，数据和成员关系会保留。" : "恢复后机构成员可重新进入系统。"}
        <ResultMessage state={state} />
      </div>
      <div className="flex items-center px-5 pb-4 sm:px-4 sm:py-4">
        <button disabled={pending} className="h-9 w-full rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50" style={{ borderColor: "var(--border)", color: nextStatus === "suspended" ? "#a5650d" : "#18754f" }}>{pending ? "处理中…" : nextStatus === "suspended" ? "停用租户" : "恢复租户"}</button>
      </div>
    </form>
  );
}

function PasswordResetRow({ tenantId, manager }: { tenantId: string; manager: Manager }) {
  const [state, action, pending] = useActionState(resetTenantManagerPasswordAction.bind(null, tenantId, manager.id), initialTenantActionState);

  return (
    <form action={action} className="grid sm:grid-cols-[150px_minmax(0,1fr)_112px]">
      <div className="border-b px-5 py-4 sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold">负责人密码</p>
        <p className="app-muted-text mt-1 truncate text-[10px]">{manager.name} · {manager.loginId}</p>
      </div>
      <div className="px-5 py-4">
        <input name="new_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="新密码：至少 8 位，含字母和数字" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
        <ResultMessage state={state} />
      </div>
      <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4">
        <button disabled={pending} className="h-9 w-full rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035] disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{pending ? "更新中…" : "重置密码"}</button>
      </div>
    </form>
  );
}

function DeleteTenantRow({ tenantId, slug }: { tenantId: string; slug: string }) {
  const [state, action, pending] = useActionState(deleteTenantPermanentlyAction.bind(null, tenantId), initialTenantActionState);

  return (
    <form action={action} className="grid bg-rose-50/60 sm:grid-cols-[150px_minmax(0,1fr)_112px]">
      <div className="border-b border-rose-200 px-5 py-4 sm:border-b-0 sm:border-r">
        <p className="text-xs font-semibold text-rose-800">永久删除</p>
        <p className="mt-1 text-[10px] text-rose-600">不可恢复</p>
      </div>
      <div className="px-5 py-4">
        <input name="confirmation" required autoCapitalize="none" placeholder={`输入租户标识：${slug}`} className="h-9 w-full rounded-md border border-rose-200 bg-white px-2.5 text-xs outline-none" />
        <ResultMessage state={state} />
      </div>
      <div className="flex items-start px-5 pb-4 sm:px-4 sm:py-4">
        <button disabled={pending} className="h-9 w-full rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50">{pending ? "删除中…" : "永久删除"}</button>
      </div>
    </form>
  );
}

export function TenantTableActions({
  tenantId,
  name,
  slug,
  status,
  managers,
}: {
  tenantId: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  managers: Manager[];
}) {
  const disabled = status === "suspended" || status === "archived";

  return (
    <Dialog>
      <DialogTrigger type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]" style={{ borderColor: "var(--border)" }}>
        <MoreHorizontal size={14} />
        管理
      </DialogTrigger>
      <DialogContent className="max-w-[760px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--border)" }}>
          <DialogTitle className="text-base">管理租户</DialogTitle>
          <DialogDescription className="text-xs">{name} · {slug}</DialogDescription>
        </DialogHeader>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          <StatusControl tenantId={tenantId} status={status} />
          {managers.map((manager) => <PasswordResetRow key={manager.id} tenantId={tenantId} manager={manager} />)}
          {managers.length === 0 && <div className="px-5 py-4 text-xs text-amber-700">当前没有可重置密码的有效机构负责人账号。</div>}
          {disabled && <DeleteTenantRow tenantId={tenantId} slug={slug} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
