"use client";

import { useActionState, useState } from "react";

import {
  createAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/dashboard/announcements/actions";
import {
  initialAnnouncementActionState,
  type AnnouncementActionState,
} from "@/app/dashboard/announcements/action-state";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
} from "@/app/dashboard/announcements/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AnnouncementManagementScope,
  ManagedAnnouncement,
} from "../api/types";

export function CreateAnnouncementDialog({
  scope,
}: {
  scope: AnnouncementManagementScope;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createAnnouncementAction,
    initialAnnouncementActionState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
      >
        新建公告
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
            <DialogTitle>
              新建{scope === "platform" ? "全平台" : "本机构"}公告
            </DialogTitle>
            <DialogDescription className="text-xs">
              发布范围由当前身份自动确定，不能手动改成其他机构或全平台。
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4 px-5 pb-5">
            <AnnouncementFields />
            <ActionResult state={state} />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                name="intent"
                value="draft"
                disabled={pending}
                className="h-9 rounded-md border border-[var(--app-border)] px-4 text-xs font-semibold text-[var(--app-text-soft)] disabled:opacity-50"
              >
                {pending ? "保存中…" : "保存草稿"}
              </button>
              <button
                type="submit"
                name="intent"
                value="publish"
                disabled={pending}
                className="h-9 rounded-md bg-emerald-700 px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? "保存中…" : "立即发布"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditAnnouncementDialog({
  announcement,
  open,
  onOpenChange,
}: {
  announcement: ManagedAnnouncement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState(
    updateAnnouncementAction.bind(null, announcement.id),
    initialAnnouncementActionState,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
          <DialogTitle>编辑公告</DialogTitle>
          <DialogDescription className="text-xs">
            只能修改当前发布范围内的公告，发布来源不能变更。
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4 px-5 pb-5">
          <AnnouncementFields announcement={announcement} />
          <ActionResult state={state} />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存修改"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementFields({
  announcement,
}: {
  announcement?: ManagedAnnouncement;
}) {
  return (
    <div className="overflow-hidden border border-[var(--app-border)] text-xs">
      <label className="grid border-b border-[var(--app-border-soft)] sm:grid-cols-[130px_minmax(0,1fr)]">
        <span className="bg-[var(--app-soft-bg)] px-3 py-3 font-medium text-[var(--app-muted)]">
          公告标题
        </span>
        <span className="p-2">
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            defaultValue={announcement?.title}
            placeholder="填写清晰、可执行的公告标题"
            className="app-input w-full rounded-md border px-3 py-2.5 text-xs outline-none"
          />
        </span>
      </label>
      <div className="grid border-b border-[var(--app-border-soft)] sm:grid-cols-2">
        <label className="grid border-b border-[var(--app-border-soft)] sm:grid-cols-[130px_minmax(0,1fr)] sm:border-r sm:border-b-0">
          <span className="bg-[var(--app-soft-bg)] px-3 py-3 font-medium text-[var(--app-muted)]">
            公告分类
          </span>
          <span className="p-2">
            <select
              name="category"
              defaultValue={announcement?.category ?? "general"}
              className="app-input h-9 w-full rounded-md border px-2.5 text-xs"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="grid sm:grid-cols-[130px_minmax(0,1fr)]">
          <span className="bg-[var(--app-soft-bg)] px-3 py-3 font-medium text-[var(--app-muted)]">
            重要程度
          </span>
          <span className="p-2">
            <select
              name="priority"
              defaultValue={announcement?.priority ?? "normal"}
              className="app-input h-9 w-full rounded-md border px-2.5 text-xs"
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <label className="grid border-b border-[var(--app-border-soft)] sm:grid-cols-[130px_minmax(0,1fr)]">
        <span className="bg-[var(--app-soft-bg)] px-3 py-3 font-medium text-[var(--app-muted)]">
          公告内容
        </span>
        <span className="p-2">
          <textarea
            name="content"
            required
            minLength={2}
            maxLength={5000}
            rows={9}
            defaultValue={announcement?.content}
            placeholder="写明执行时间、适用人员和需要完成的动作"
            className="app-input w-full resize-y rounded-md border px-3 py-2.5 text-xs leading-5 outline-none"
          />
        </span>
      </label>
      <label className="flex min-h-11 items-center gap-3 px-3 text-xs text-[var(--app-text-soft)]">
        <input
          name="is_pinned"
          type="checkbox"
          defaultChecked={announcement?.isPinned}
          className="size-3.5 accent-[var(--app-accent)]"
        />
        置顶这条公告
        <span className="ml-auto text-[11px] text-[var(--app-muted)]">
          平台置顶作用于全部机构；机构置顶只作用于本机构
        </span>
      </label>
    </div>
  );
}

function ActionResult({ state }: { state: AnnouncementActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`border px-3 py-2 text-xs font-medium ${
        state.status === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {state.message}
    </p>
  );
}
