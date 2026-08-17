"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { initialTenantActionState } from "@/app/dashboard/admin/tenants/action-state";
import { createTenantAction } from "@/app/dashboard/admin/tenants/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TenantCreateDialog() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createTenantAction,
    initialTenantActionState,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-9 items-center gap-2 bg-[var(--primary)] px-3.5 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
      >
        <Plus size={15} aria-hidden="true" />
        创建机构
      </DialogTrigger>
      <DialogContent className="max-w-[780px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <DialogTitle className="text-base">创建机构</DialogTitle>
          <DialogDescription className="text-xs">
            创建独立机构空间，并通过现有初始化流程建立机构负责人账号。
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction}>
          <div className="grid border-b border-[var(--border)] sm:grid-cols-2">
            <label className="border-b border-[var(--border)] sm:border-r sm:border-b-0">
              <span className="block border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-2.5 text-[11px] font-semibold">
                机构名称
              </span>
              <span className="block px-5 py-3">
                <input name="name" required minLength={2} maxLength={80} placeholder="例如：首尔语言学院" className="app-input h-9 w-full border px-2.5 text-xs" />
              </span>
            </label>
            <label>
              <span className="block border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-2.5 text-[11px] font-semibold">
                机构标识
              </span>
              <span className="block px-5 py-3">
                <input name="slug" required minLength={2} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" placeholder="例如：seoul-language" className="app-input h-9 w-full border px-2.5 text-xs" />
                <small className="mt-1.5 block text-[10px] text-[var(--foreground-muted)]">仅限小写字母、数字和短横线，创建后应保持稳定。</small>
              </span>
            </label>
          </div>

          <label className="grid border-b border-[var(--border)] sm:grid-cols-[160px_minmax(0,1fr)]">
            <span className="border-b border-[var(--border)] px-5 py-3 text-xs font-semibold sm:border-r sm:border-b-0">服务套餐</span>
            <span className="px-5 py-3">
              <select name="plan_key" defaultValue="starter" className="app-input h-9 w-full border px-2.5 text-xs font-medium">
                <option value="starter">入门套餐</option>
                <option value="growth">成长套餐</option>
                <option value="enterprise">企业套餐</option>
              </select>
            </span>
          </label>

          <div className="border-b border-[var(--border)]">
            <div className="bg-[var(--surface-soft)] px-5 py-3">
              <p className="text-xs font-semibold">机构负责人账号</p>
              <p className="mt-1 text-[10px] text-[var(--foreground-muted)]">账号创建、成员关系和负责人身份继续使用现有服务端流程。</p>
            </div>
            <div className="grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">负责人姓名</span><input name="manager_name" required minLength={2} maxLength={50} placeholder="例如：张老师" className="app-input h-9 w-full border px-2.5 text-xs" /></label>
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">登录账号</span><input name="manager_login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="例如：seoul-admin" className="app-input h-9 w-full border px-2.5 text-xs" /></label>
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">初始密码</span><input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少8位，含字母和数字" className="app-input h-9 w-full border px-2.5 text-xs" /></label>
            </div>
          </div>

          {state.message && (
            <p aria-live="polite" className={`border-b px-5 py-3 text-xs font-semibold ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-[10px] text-[var(--foreground-muted)]">本界面不改变创建机构的事务边界和失败回滚行为。</p>
            <button type="submit" disabled={pending} className="h-9 bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">
              {pending ? "正在创建…" : "确认创建"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
