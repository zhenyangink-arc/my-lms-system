"use client";

import { useActionState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";

import { initialConversationPracticeActionState } from "@/app/dashboard/conversation-practice/action-state";
import { changeConversationScenarioStatusAction } from "@/app/dashboard/conversation-practice/actions";
import type { ConversationStatus } from "@/app/dashboard/conversation-practice/config";

function StatusButton({ id, status, target, label }: { id: string; status: ConversationStatus; target: ConversationStatus; label: string }) {
  const action = changeConversationScenarioStatusAction.bind(null, id, target);
  const [state, formAction, pending] = useActionState(action, initialConversationPracticeActionState);
  const Icon = target === "published" ? Send : target === "archived" ? Archive : FilePenLine;
  if (status === target) return null;
  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50">
        <Icon size={12} aria-hidden="true" />{pending ? "处理中…" : label}
      </button>
      <p aria-live="polite" aria-atomic="true" className={`mt-1 min-h-4 text-xs font-bold ${state.status === "error" ? "text-[var(--status-danger)]" : "text-[var(--status-success)]"}`}>
        {state.message}
      </p>
    </form>
  );
}

export function ConversationScenarioStatusActions({ id, status }: { id: string; status: ConversationStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusButton id={id} status={status} target="published" label="发布" />
      <StatusButton id={id} status={status} target="draft" label="转为草稿" />
      <StatusButton id={id} status={status} target="archived" label="归档" />
    </div>
  );
}
