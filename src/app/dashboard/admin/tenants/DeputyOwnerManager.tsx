"use client";

import { useActionState, useEffect, useRef } from "react";
import { ShieldPlus } from "lucide-react";

import { createDeputyOwnerAction } from "./actions";
import { initialTenantActionState } from "./action-state";

export function DeputyOwnerManager({ deputies }: { deputies: Array<{ id: string; name: string; loginId: string }> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createDeputyOwnerAction, initialTenantActionState);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);
  return <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><ShieldPlus size={20} /></span><div><h2 className="text-lg font-black">设立副负责人</h2><p className="app-muted-text mt-1 text-xs leading-5">副负责人只拥有开通、停用、恢复和永久删除租户，以及重置租户管理员密码的权限；不具备其他平台管理权限。</p></div></div><div className="mt-4 space-y-2">{deputies.map((deputy) => <div key={deputy.id} className="app-soft-card rounded-xl border px-3 py-2 text-xs"><span className="font-black">{deputy.name}</span><span className="app-muted-text ml-2 font-mono">{deputy.loginId}</span></div>)}{deputies.length === 0 && <p className="app-muted-text text-xs">目前还没有副负责人。</p>}</div><form ref={formRef} action={formAction} className="mt-5 grid gap-3 sm:grid-cols-3"><input name="name" required minLength={2} maxLength={50} placeholder="姓名" className="app-input rounded-xl border px-3 py-2.5 text-sm" /><input name="login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="登录账号" className="app-input rounded-xl border px-3 py-2.5 text-sm" /><input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="初始密码" className="app-input rounded-xl border px-3 py-2.5 text-sm" /><div className="sm:col-span-3">{state.message && <p aria-live="polite" className="mb-3 rounded-xl px-3 py-2 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}<button disabled={pending} className="rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-secondary)" }}>{pending ? "设立中…" : "设立副负责人"}</button></div></form></section>;
}
