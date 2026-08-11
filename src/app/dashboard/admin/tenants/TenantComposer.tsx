"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTenantAction } from "./actions";
import { initialTenantActionState } from "./action-state";

export function TenantComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createTenantAction, initialTenantActionState);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <Dialog>
      <DialogTrigger type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-950 px-3.5 text-xs font-semibold text-white transition hover:bg-neutral-800">
        <Plus size={15} />
        开通新租户
      </DialogTrigger>
      <DialogContent className="max-w-[780px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--app-border)" }}>
          <DialogTitle className="text-base">开通新租户</DialogTitle>
          <DialogDescription className="text-xs">创建独立机构空间，并同时建立该机构的负责人登录账号。</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction}>
          <div className="grid border-b sm:grid-cols-2" style={{ borderColor: "var(--app-border)" }}>
            <label className="border-b sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>
              <span className="block border-b px-5 py-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>租户名称</span>
              <span className="block px-5 py-3"><input name="name" required minLength={2} maxLength={80} placeholder="例如：首尔语言学院" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></span>
            </label>
            <label>
              <span className="block border-b px-5 py-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>租户标识</span>
              <span className="block px-5 py-3"><input name="slug" required minLength={2} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如：seoul-language" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /><small className="app-muted-text mt-1.5 block text-[10px]">仅限小写字母、数字和短横线，创建后保持稳定。</small></span>
            </label>
          </div>

          <label className="grid border-b sm:grid-cols-[160px_minmax(0,1fr)]" style={{ borderColor: "var(--app-border)" }}>
            <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--app-border)" }}>服务套餐</span>
            <span className="px-5 py-3">
              <select name="plan_key" defaultValue="starter" className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                <option value="starter">入门套餐</option>
                <option value="growth">成长套餐</option>
                <option value="enterprise">企业套餐</option>
              </select>
            </span>
          </label>

          <div className="border-b" style={{ borderColor: "var(--app-border)" }}>
            <div className="px-5 py-3" style={{ backgroundColor: "var(--app-soft-bg)" }}>
              <p className="text-xs font-semibold">机构负责人账号</p>
              <p className="app-muted-text mt-1 text-[10px]">该账号只属于新租户，并自动获得机构负责人权限。</p>
            </div>
            <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0" style={{ borderColor: "var(--app-border)" }}>
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">负责人姓名</span><input name="manager_name" required minLength={2} maxLength={50} placeholder="例如：张老师" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></label>
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">登录账号</span><input name="manager_login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="例如：seoul-admin" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></label>
              <label className="px-5 py-3"><span className="mb-1.5 block text-[11px] font-semibold">初始密码</span><input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，含字母和数字" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></label>
            </div>
          </div>

          {state.message && <p aria-live="polite" className={`border-b px-5 py-3 text-xs font-semibold ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{state.message}</p>}

          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="app-muted-text text-[10px]">开通后可在租户总表中停用、恢复或重置负责人密码。</p>
            <button type="submit" disabled={pending} className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">{pending ? "正在开通…" : "确认开通"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
