"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { createManagedAccountAction } from "./actions";
import { initialAccountActionState } from "./action-state";

export function AccountCreator({ tenantId, compact = false }: { tenantId?: string; compact?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createManagedAccountAction, initialAccountActionState);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><UserPlus size={18} /></span><div><h2 className="text-lg font-black">创建员工或学生账号</h2><p className="app-muted-text mt-1 text-xs">账号会自动绑定该机构，用户使用账号和初始密码登录。</p></div></div>
      <form ref={formRef} action={formAction} className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
        {tenantId && <input type="hidden" name="tenant_id" value={tenantId} />}
        <label className="text-xs font-black">姓名<input name="full_name" required minLength={2} maxLength={50} className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-black">账号<input name="login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-black">初始密码<input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，含字母和数字" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-black">账号类型<select name="role" defaultValue="student" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"><option value="teacher">员工 / 老师</option><option value="student">学生</option></select></label>
        <div className="flex items-end"><button disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><UserPlus size={16} />{pending ? "创建中…" : "创建账号"}</button></div>
        {state.message && <p aria-live="polite" className="rounded-xl px-3 py-2.5 text-xs font-bold sm:col-span-2 xl:col-span-5" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}
      </form>
    </section>
  );
}
