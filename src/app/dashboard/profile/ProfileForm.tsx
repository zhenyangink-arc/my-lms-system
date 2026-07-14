"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Save, UserRound } from "lucide-react";

import {
  initialUpdateProfileState,
  updateProfileAction,
} from "./actions";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialUpdateProfileState
  );

  return (
    <form action={formAction} className="app-card rounded-3xl border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
        >
          <UserRound size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black">编辑基本信息</h2>
          <p className="mt-1 text-xs app-muted-text">姓名会用于课程称呼、学习档案和老师反馈。</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="fullName" className="text-sm font-black">姓名</label>
          <span className="text-[11px] app-muted-text">2—50 个字符</span>
        </div>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          minLength={2}
          maxLength={50}
          autoComplete="name"
          defaultValue={initialName}
          aria-describedby={state.fieldError ? "fullName-error" : "fullName-help"}
          className="app-input mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition"
        />
        {state.fieldError ? (
          <p id="fullName-error" className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600">
            <AlertCircle size={13} aria-hidden="true" />
            {state.fieldError}
          </p>
        ) : (
          <p id="fullName-help" className="mt-2 text-xs app-muted-text">请输入希望老师和顾问使用的真实姓名。</p>
        )}
      </div>

      {state.message && (
        <p
          aria-live="polite"
          className="mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-3 text-xs font-bold"
          style={
            state.status === "success"
              ? { color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }
              : { color: "#dc2626", backgroundColor: "#fef2f2" }
          }
        >
          {state.status === "success" ? (
            <CheckCircle2 size={15} aria-hidden="true" />
          ) : (
            <AlertCircle size={15} aria-hidden="true" />
          )}
          {state.message}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          {pending ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          {pending ? "正在保存" : "保存资料"}
        </button>
      </div>
    </form>
  );
}
