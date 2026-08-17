"use client";

import { useActionState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";

import { changeLearningAssignmentStatusAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import type { AssignmentStatus } from "@/app/dashboard/assignments/config";

function StatusButton({ id, status, label }: { id: string; status: AssignmentStatus; label: string }) {
  const action = changeLearningAssignmentStatusAction.bind(null, id, status);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  const Icon = status === "published" ? Send : status === "closed" ? Archive : FilePenLine;
  const confirmation = status === "draft"
    ? "确认将这项任务转为草稿？学生将无法继续访问已发布任务。"
    : status === "closed"
      ? "确认关闭这项任务？关闭后学生将无法继续提交。"
      : null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation)) event.preventDefault();
      }}
    >
      <button
        disabled={pending}
        className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50"
        style={{ color: status === "published" ? "var(--primary)" : status === "closed" ? "var(--status-warning)" : "var(--foreground-muted)" }}
      >
        <Icon size={13} aria-hidden="true" />
        {pending ? "处理中…" : label}
      </button>
      {state.message && (
        <p aria-live="polite" className="mt-1 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function AssignmentStatusActions({ id, status }: { id: string; status: AssignmentStatus }) {
  return <div className="flex flex-wrap gap-2">{status !== "published" && <StatusButton id={id} status="published" label="发布" />}{status !== "draft" && <StatusButton id={id} status="draft" label="转为草稿" />}{status !== "closed" && <StatusButton id={id} status="closed" label="关闭任务" />}</div>;
}
