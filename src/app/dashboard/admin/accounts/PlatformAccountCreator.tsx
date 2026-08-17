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
import { initialAccountActionState } from "./action-state";
import { createPlatformAccountAction } from "./actions";

export function PlatformAccountCreator() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createPlatformAccountAction,
    initialAccountActionState
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-neutral-950 px-3.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
      >
        <Plus size={15} />
        新增平台账号
      </DialogTrigger>
      <DialogContent className="max-w-[760px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--border)" }}>
          <DialogTitle className="text-base">新增平台账号</DialogTitle>
          <DialogDescription className="text-xs">
            新账号直属平台，不会加入任何机构。创建后可在总表中继续调整角色与状态。
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction}>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
              <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>姓名</span>
              <span className="px-5 py-3">
                <input name="full_name" required minLength={2} maxLength={50} placeholder="请输入成员姓名" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
              </span>
            </label>
            <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
              <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>登录账号</span>
              <span className="px-5 py-3">
                <input name="login_id" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_]|-){2,31}" autoCapitalize="none" placeholder="小写字母、数字、- 或 _" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
              </span>
            </label>
            <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
              <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>初始密码</span>
              <span className="px-5 py-3">
                <input name="initial_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="至少 8 位，同时包含字母和数字" className="app-input h-9 w-full rounded-md border px-2.5 text-xs" />
              </span>
            </label>
            <label className="grid sm:grid-cols-[160px_minmax(0,1fr)]">
              <span className="border-b px-5 py-3 text-xs font-semibold sm:border-b-0 sm:border-r" style={{ borderColor: "var(--border)" }}>平台角色</span>
              <span className="px-5 py-3">
                <select name="role" defaultValue="platform_admin" className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
                  <option value="platform_deputy">平台副负责人</option>
                  <option value="platform_admin">平台管理员</option>
                  <option value="platform_course_inspector">平台课程巡检员</option>
                </select>
              </span>
            </label>
          </div>

          {state.message && (
            <p
              aria-live="polite"
              className={`border-t px-5 py-3 text-xs font-semibold ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
            >
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <p className="app-muted-text text-[11px]">平台负责人账号不会出现在可分配角色中。</p>
            <button disabled={pending} className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50">
              {pending ? "创建中…" : "确认创建"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
