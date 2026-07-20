"use client";

import { useActionState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";

import { changeAnnouncementStatusAction } from "./actions";
import { initialAnnouncementActionState } from "./action-state";
import type { AnnouncementStatus } from "./config";

function StatusButton({
  announcementId,
  status,
  label,
  tone,
}: {
  announcementId: string;
  status: AnnouncementStatus;
  label: string;
  tone: "accent" | "muted" | "warm";
}) {
  const action = changeAnnouncementStatusAction.bind(null, announcementId, status);
  const [state, formAction, pending] = useActionState(action, initialAnnouncementActionState);
  const Icon = status === "published" ? Send : status === "archived" ? Archive : FilePenLine;
  const color = tone === "accent" ? "var(--app-accent)" : tone === "warm" ? "var(--app-warm)" : "var(--app-muted)";

  return (
    <form action={formAction} className="inline-flex flex-col items-start">
      <button type="submit" disabled={pending} className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50" style={{ color }}>
        <Icon size={13} aria-hidden="true" /> {pending ? "处理中…" : label}
      </button>
      {state.status === "error" && <span className="mt-1 text-xs font-bold" style={{ color: "#c94f45" }}>{state.message}</span>}
    </form>
  );
}

export function AnnouncementStatusActions({ id, status }: { id: string; status: AnnouncementStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && <StatusButton announcementId={id} status="published" label="发布" tone="accent" />}
      {status !== "draft" && <StatusButton announcementId={id} status="draft" label="转为草稿" tone="muted" />}
      {status !== "archived" && <StatusButton announcementId={id} status="archived" label="归档" tone="warm" />}
    </div>
  );
}
