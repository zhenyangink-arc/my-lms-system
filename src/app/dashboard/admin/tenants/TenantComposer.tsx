"use client";

import { useActionState, useEffect, useRef } from "react";
import { Building2, Plus } from "lucide-react";

import { createTenantAction } from "./actions";
import { initialTenantActionState } from "./action-state";

export function TenantComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createTenantAction, initialTenantActionState);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <section className="app-card rounded-3xl border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <Building2 size={20} />
        </span>
        <div>
          <h2 className="text-lg font-black">开通新租户</h2>
          <p className="app-muted-text mt-1 text-xs leading-5">创建后，负责人自动成为该租户的超级管理员。租户标识会作为系统内稳定地址使用，创建后不建议随意修改。</p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <label className="block text-xs font-black">
          租户名称
          <input name="name" required minLength={2} maxLength={80} placeholder="例如：首尔语言学院" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-black">
          租户标识
          <input name="slug" required minLength={2} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如：seoul-language" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
          <span className="app-muted-text mt-1 block text-[11px] font-medium">仅限小写字母、数字与短横线。</span>
        </label>
        <label className="block text-xs font-black">
          套餐
          <select name="plan_key" defaultValue="starter" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm">
            <option value="starter">Starter · 起步版</option>
            <option value="growth">Growth · 成长版</option>
            <option value="enterprise">Enterprise · 企业版</option>
          </select>
        </label>
        <div className="space-y-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
          <div><p className="text-sm font-black">租户管理员账号</p><p className="app-muted-text mt-1 text-xs">该账号将成为此租户的超级管理员。用户只使用账号和密码登录，不需要邮箱。</p></div>
          <label className="block text-xs font-black">
            管理员姓名
            <input name="manager_name" required minLength={2} maxLength={50} placeholder="例如：张老师" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs font-black">
            登录账号
            <input name="manager_login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="例如：seoul-admin" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
            <span className="app-muted-text mt-1 block text-[11px] font-medium">3 至 32 位小写字母、数字、短横线或下划线。</span>
          </label>
          <label className="block text-xs font-black">
            初始密码
            <input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，包含字母和数字" className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
          </label>
        </div>
        {state.message && <p aria-live="polite" className="rounded-xl px-3 py-2.5 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}>
          <Plus size={16} />{pending ? "正在开通…" : "开通租户"}
        </button>
      </form>
    </section>
  );
}
