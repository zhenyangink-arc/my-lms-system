"use client";
import { useActionState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";
import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import { changeGradeItemStatusAction } from "@/app/dashboard/grades/actions";
import type { GradeItemStatus } from "@/app/dashboard/grades/config";
function Button({ id, current, target, label }: { id: string; current: GradeItemStatus; target: GradeItemStatus; label: string }) { const action = changeGradeItemStatusAction.bind(null, id, target); const [state, formAction, pending] = useActionState(action, initialGradeCenterActionState); const Icon = target === "published" ? Send : target === "archived" ? Archive : FilePenLine; if (current === target) return null; return <form action={formAction}><button type="submit" disabled={pending} title={state.message || undefined} className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black"><Icon size={12} />{pending ? "处理中…" : label}</button></form>; }
export function GradeItemStatusActions({ id, status }: { id: string; status: GradeItemStatus }) { return <div className="flex flex-wrap gap-2"><Button id={id} current={status} target="published" label="发布" /><Button id={id} current={status} target="draft" label="转为草稿" /><Button id={id} current={status} target="archived" label="归档" /></div>; }
