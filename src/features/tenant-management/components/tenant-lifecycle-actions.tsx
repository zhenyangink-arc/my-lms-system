"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

import { initialTenantActionState } from "@/app/dashboard/admin/tenants/action-state";
import {
  deleteTenantPermanentlyAction,
  setTenantStatusAction,
} from "@/app/dashboard/admin/tenants/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TenantLifecycleStatus } from "../api/types";

function ResultMessage({ status, message }: { status: "idle" | "success" | "error"; message: string }) {
  if (!message) return null;
  return <p aria-live="polite" className={status === "error" ? "mt-3 text-xs font-medium text-rose-700" : "mt-3 text-xs font-medium text-emerald-700"}>{message}</p>;
}

function SuspendTenantDialog({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [open, setOpen] = useState(false);
  const action = setTenantStatusAction.bind(null, tenantId, "suspended");
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="inline-flex h-9 items-center gap-2 border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800" />}>
        <Archive size={14} aria-hidden="true" />停用机构
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>确认停用机构？</DialogTitle><DialogDescription>将停用“{tenantName}”。现有 RPC 只更新机构状态并写入审计日志，成员和业务数据继续保留。</DialogDescription></DialogHeader>
        <form action={formAction}>
          <DialogFooter><button type="button" onClick={() => setOpen(false)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold">取消</button><button disabled={pending} className="h-9 bg-amber-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{pending ? "停用中…" : "确认停用"}</button></DialogFooter>
          <ResultMessage {...state} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RestoreTenantButton({ tenantId }: { tenantId: string }) {
  const action = setTenantStatusAction.bind(null, tenantId, "active");
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return (
    <form action={formAction}>
      <button disabled={pending} className="inline-flex h-9 items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" />{pending ? "恢复中…" : "恢复机构"}</button>
      <ResultMessage {...state} />
    </form>
  );
}

function PermanentDeleteTenantDialog({ tenantId, tenantName, slug, listHref }: { tenantId: string; tenantName: string; slug: string; listHref: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const action = deleteTenantPermanentlyAction.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);

  useEffect(() => {
    if (state.status === "success") router.replace(listHref);
  }, [listHref, router, state.status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="inline-flex h-9 items-center gap-2 bg-rose-600 px-3 text-xs font-semibold text-white" />}>
        <Trash2 size={14} aria-hidden="true" />永久删除
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>永久删除“{tenantName}”？</DialogTitle>
          <DialogDescription>此操作不可恢复。数据库将继续按现有 RPC 的依赖顺序删除业务数据并保留生命周期审计；本次没有新增 R2、Storage 或 Auth 失败补偿逻辑。</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <label className="block"><span className="mb-1.5 block text-xs font-medium">输入机构标识 <b className="font-mono">{slug}</b> 确认</span><input name="confirmation" required autoCapitalize="none" autoComplete="off" placeholder={slug} className="app-input h-9 w-full border px-2.5 text-xs" /></label>
          <DialogFooter><button type="button" onClick={() => setOpen(false)} className="h-9 border border-zinc-300 px-3 text-xs font-semibold">取消</button><button disabled={pending} className="h-9 bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{pending ? "删除中…" : "确认永久删除"}</button></DialogFooter>
          <ResultMessage {...state} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TenantLifecycleActions({ tenantId, tenantName, slug, status, canPermanentlyDelete, listHref }: { tenantId: string; tenantName: string; slug: string; status: TenantLifecycleStatus; canPermanentlyDelete: boolean; listHref: string }) {
  const inactive = status === "suspended" || status === "archived";
  return (
    <section className="management-table-panel border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">机构生命周期</h2><p className="mt-1 text-xs text-[var(--foreground-muted)]">停用可恢复；永久删除只在停用或历史归档状态下开放。</p></div>
        <div className="flex flex-wrap items-start gap-2">
          {status === "active" && <SuspendTenantDialog tenantId={tenantId} tenantName={tenantName} />}
          {inactive && <RestoreTenantButton tenantId={tenantId} />}
          {inactive && canPermanentlyDelete && <PermanentDeleteTenantDialog tenantId={tenantId} tenantName={tenantName} slug={slug} listHref={listHref} />}
        </div>
      </div>
    </section>
  );
}
