"use client";
import { useActionState } from "react";
import { ArchiveRestore, Archive } from "lucide-react";
import { initialLearningRecordActionState } from "@/app/dashboard/records/action-state";
import { changeLearningRecordNoteStatusAction } from "@/app/dashboard/records/actions";
export function LearningRecordStatusButton({ id, status }: { id: string; status: "active" | "archived" }) { const target = status === "active" ? "archived" : "active"; const action = changeLearningRecordNoteStatusAction.bind(null, id, target); const [state, formAction, pending] = useActionState(action, initialLearningRecordActionState); const Icon = target === "archived" ? Archive : ArchiveRestore; return <form action={formAction}><button type="submit" disabled={pending} title={state.message || undefined} className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black"><Icon size={11} />{target === "archived" ? "归档" : "恢复"}</button></form>; }
