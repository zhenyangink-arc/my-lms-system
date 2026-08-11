"use client";

import { useActionState, useState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";

import {
  changeAnnouncementStatusAction,
} from "@/app/dashboard/announcements/actions";
import { initialAnnouncementActionState } from "@/app/dashboard/announcements/action-state";
import type { AnnouncementStatus } from "@/app/dashboard/announcements/config";
import { Icons } from "@/components/icons";
import type { ManagedAnnouncement } from "../../api/types";
import { EditAnnouncementDialog } from "../announcement-action-dialogs";

export function AnnouncementCellAction({
  announcement,
}: {
  announcement: ManagedAnnouncement;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <details className="group relative inline-block text-left">
        <summary
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-text)]"
          aria-label="打开公告操作"
        >
          <Icons.more className="size-4" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-44 border border-[var(--app-border)] bg-[var(--app-card-bg)] p-1 shadow-lg">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
          >
            <Icons.edit className="size-3.5" aria-hidden="true" />
            编辑公告
          </button>
          <div className="my-1 border-t border-[var(--app-border)]" />
          {announcement.status !== "published" && (
            <StatusActionButton
              announcementId={announcement.id}
              status="published"
              label="发布"
            />
          )}
          {announcement.status !== "draft" && (
            <StatusActionButton
              announcementId={announcement.id}
              status="draft"
              label="转为草稿"
            />
          )}
          {announcement.status !== "archived" && (
            <StatusActionButton
              announcementId={announcement.id}
              status="archived"
              label="归档"
            />
          )}
        </div>
      </details>
      <EditAnnouncementDialog
        announcement={announcement}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

function StatusActionButton({
  announcementId,
  status,
  label,
}: {
  announcementId: string;
  status: AnnouncementStatus;
  label: string;
}) {
  const action = changeAnnouncementStatusAction.bind(
    null,
    announcementId,
    status,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialAnnouncementActionState,
  );
  const Icon =
    status === "published"
      ? Send
      : status === "archived"
        ? Archive
        : FilePenLine;

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className={`flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium hover:bg-[var(--app-soft-bg)] disabled:opacity-50 ${
          status === "archived"
            ? "text-amber-700"
            : status === "published"
              ? "text-emerald-700"
              : "text-[var(--app-text-soft)]"
        }`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {pending ? "处理中…" : label}
      </button>
      {state.status === "error" && (
        <span className="block px-2 py-1 text-[11px] font-medium text-rose-700">
          {state.message}
        </span>
      )}
    </form>
  );
}
