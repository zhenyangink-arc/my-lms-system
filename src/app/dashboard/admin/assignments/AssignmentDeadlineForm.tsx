"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";

import { updateLearningAssignmentDeadlineAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";

export function AssignmentDeadlineForm({ assignmentId }: { assignmentId: string }) {
  const action = updateLearningAssignmentDeadlineAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialLearningAssignmentActionState);
  return <form action={formAction} className="app-card rounded-2xl border p-4"><label className="text-xs font-black">调整截止时间（韩国时间）<input name="due_at" type="datetime-local" required className="app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm" /></label>{state.message && <p className="mt-2 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}<button disabled={pending} className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-secondary)" }}><CalendarClock size={14} />{pending ? "保存中…" : "更新截止时间"}</button></form>;
}
