"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createManagedAccountAction } from "./actions";
import { initialAccountActionState } from "./action-state";

export function AccountCreator({
  tenantId,
  compact = false,
  dialog = false,
}: {
  tenantId?: string;
  compact?: boolean;
  dialog?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createManagedAccountAction, initialAccountActionState);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  if (dialog) {
    return (
      <Dialog>
        <DialogTrigger
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-neutral-950 px-3.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          <Plus size={15} />
          新增账号
        </DialogTrigger>
        <DialogContent className="max-w-[760px] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--border)" }}>
            <DialogTitle className="text-base">新增机构账号</DialogTitle>
            <DialogDescription className="text-xs">账号会自动加入当前机构，创建后可在账号总表中调整角色、会员档位与状态。</DialogDescription>
          </DialogHeader>
          <form ref={formRef} action={formAction}>
            {tenantId && <input type="hidden" name="tenant_id" value={tenantId} />}
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
                <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>姓名</span>
                <span className="px-5 py-3"><input name="full_name" required minLength={2} maxLength={50} placeholder="请输入成员姓名" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></span>
              </label>
              <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
                <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>登录账号</span>
                <span className="px-5 py-3"><input name="login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="小写字母、数字、- 或 _" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></span>
              </label>
              <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
                <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>初始密码</span>
                <span className="px-5 py-3"><input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，同时包含字母和数字" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" /></span>
              </label>
              <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
                <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>账号类型</span>
                <span className="px-5 py-3"><select name="role" defaultValue="student" className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"><option value="teacher">员工 / 老师</option><option value="student">学生</option></select></span>
              </label>
            </div>
            {state.message && (
              <p aria-live="polite" className={`border-t px-5 py-3 text-xs font-semibold ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{state.message}</p>
            )}
            <div className="flex items-center justify-between gap-4 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <p className="app-muted-text text-[11px]">负责人账号不会出现在可分配角色中。</p>
              <button disabled={pending} className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">{pending ? "创建中…" : "确认创建"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><UserPlus size={18} /></span><div><h2 className="text-lg font-semibold">创建员工或学生账号</h2><p className="app-muted-text mt-1 text-xs">账号会自动绑定该机构，用户使用账号和初始密码登录。</p></div></div>
      <form ref={formRef} action={formAction} className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
        {tenantId && <input type="hidden" name="tenant_id" value={tenantId} />}
        <label className="text-xs font-semibold">姓名<input name="full_name" required minLength={2} maxLength={50} className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-semibold">账号<input name="login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-semibold">初始密码<input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，含字母和数字" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-semibold">账号类型<select name="role" defaultValue="student" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"><option value="teacher">员工 / 老师</option><option value="student">学生</option></select></label>
        <div className="flex items-end"><button disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}><UserPlus size={16} />{pending ? "创建中…" : "创建账号"}</button></div>
        {state.message && <p aria-live="polite" className="rounded-xl px-3 py-2.5 text-xs font-bold sm:col-span-2 xl:col-span-5" style={{ color: state.status === "error" ? "#c94f45" : "var(--status-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--status-success-surface)" }}>{state.message}</p>}
      </form>
    </section>
  );
}
