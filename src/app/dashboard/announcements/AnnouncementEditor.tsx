"use client";

import { useActionState } from "react";
import { ChevronDown, Save } from "lucide-react";

import { updateAnnouncementAction } from "./actions";
import { initialAnnouncementActionState } from "./action-state";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "./config";

export function AnnouncementEditor({
  announcement,
}: {
  announcement: {
    id: string;
    title: string;
    content: string;
    category: AnnouncementCategory;
    priority: AnnouncementPriority;
    isPinned: boolean;
  };
}) {
  const action = updateAnnouncementAction.bind(null, announcement.id);
  const [state, formAction, pending] = useActionState(action, initialAnnouncementActionState);

  return (
    <details className="app-soft-card rounded-2xl border p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black">
        修改公告内容
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <form action={formAction} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
        <label className="block text-xs font-black">
          标题
          <input name="title" required minLength={2} maxLength={120} defaultValue={announcement.title} className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-black">
            分类
            <select name="category" defaultValue={announcement.category} className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-black">
            级别
            <select name="priority" defaultValue={announcement.priority} className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm">
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs font-black">
          内容
          <textarea name="content" required minLength={2} maxLength={5000} rows={7} defaultValue={announcement.content} className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm leading-7" />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input name="is_pinned" type="checkbox" defaultChecked={announcement.isPinned} /> 置顶公告
        </label>
        {state.message && <p className="text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-secondary)" }}>
          <Save size={14} aria-hidden="true" /> {pending ? "正在保存…" : "保存修改"}
        </button>
      </form>
    </details>
  );
}
