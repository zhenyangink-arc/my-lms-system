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
  return <form action={formAction}><button disabled={pending} className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50" style={{ color: status === "published" ? "var(--app-accent)" : status === "closed" ? "var(--app-warm)" : "var(--app-muted)" }}><Icon size={13} />{pending ? "处理中…" : label}</button>{state.message && <p className="mt-1 text-[10px] font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}</form>;
}

export function AssignmentStatusActions({ id, status }: { id: string; status: AssignmentStatus }) {
  return <div className="flex flex-wrap gap-2">{status !== "published" && <StatusButton id={id} status="published" label="发布" />}{status !== "draft" && <StatusButton id={id} status="draft" label="转为草稿" />}{status !== "closed" && <StatusButton id={id} status="closed" label="关闭任务" />}</div>;
}
