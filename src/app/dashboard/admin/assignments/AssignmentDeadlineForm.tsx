"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";

import { updateLearningAssignmentDeadlineAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";

export function AssignmentDeadlineForm({ assignmentId }: { assignmentId: string }) {
  const action = updateLearningAssignmentDeadlineAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  return (
    <form action={formAction} className="app-card rounded-2xl border p-4">
      <label className="text-xs font-semibold">
        调整截止时间（韩国时间）
        <input name="due_at" type="datetime-local" required className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2" />
      </label>
      {state.message && <p aria-live="polite" className="mt-2 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)" }}>{state.message}</p>}
      <button disabled={pending} className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50" style={{ backgroundColor: "var(--support)" }}>
        <CalendarClock size={14} aria-hidden="true" />
        {pending ? "保存中…" : "更新截止时间"}
      </button>
    </form>
  );
}
