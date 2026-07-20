"use client";

import { useActionState, useEffect, useRef } from "react";
import { FilePenLine, Save, Send } from "lucide-react";

import { createAnnouncementAction } from "./actions";
import { initialAnnouncementActionState } from "./action-state";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "./config";

export function AnnouncementComposer() {
  const [state, formAction, pending] = useActionState(
    createAnnouncementAction,
    initialAnnouncementActionState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <section id="publish-announcement" className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <FilePenLine size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black">新建通知公告</h2>
          <p className="mt-1 text-xs leading-5 app-muted-text">可以先保存草稿，确认内容后再正式发布。</p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="mt-6 space-y-4">
        <label className="block text-xs font-black">
          公告标题
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            placeholder="例如：七月课程安排调整通知"
            className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-black">
            公告分类
            <select name="category" defaultValue="general" className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-black">
            重要程度
            <select name="priority" defaultValue="normal" className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm">
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-xs font-black">
          公告内容
          <textarea
            name="content"
            required
            minLength={2}
            maxLength={5000}
            rows={9}
            placeholder="写明通知事项、执行时间、适用人员和需要完成的动作。"
            className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6"
          />
        </label>

        <label className="app-soft-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold">
          <input name="is_pinned" type="checkbox" className="h-4 w-4" />
          置顶这条公告
          <span className="ml-auto app-muted-text">重要公告会优先显示</span>
        </label>

        {state.message && (
          <p
            className="rounded-xl px-4 py-3 text-xs font-bold"
            style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            <Send size={15} aria-hidden="true" /> {pending ? "正在保存…" : "立即发布"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-black disabled:opacity-50"
          >
            <Save size={15} aria-hidden="true" /> 保存草稿
          </button>
        </div>
      </form>
    </section>
  );
}
