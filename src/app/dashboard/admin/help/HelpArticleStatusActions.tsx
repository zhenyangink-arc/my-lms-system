"use client";

import { useActionState } from "react";
import { Archive, FilePenLine, Send } from "lucide-react";

import { initialHelpCenterActionState } from "@/app/dashboard/help/action-state";
import { changeHelpArticleStatusAction } from "@/app/dashboard/help/actions";
import type { HelpArticleStatus } from "@/app/dashboard/help/config";

function Button({ id, current, target, label }: { id: string; current: HelpArticleStatus; target: HelpArticleStatus; label: string }) { const action = changeHelpArticleStatusAction.bind(null, id, target); const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState); const Icon = target === "published" ? Send : target === "archived" ? Archive : FilePenLine; if (current === target) return null; return <form action={formAction}><button type="submit" disabled={pending} title={state.message || undefined} className="inline-flex h-7 items-center gap-1.5 border border-black/[0.08] bg-white px-2.5 text-[9px] font-medium text-zinc-700 disabled:opacity-50"><Icon size={11} />{pending ? "处理中…" : label}</button></form>; }
export function HelpArticleStatusActions({ id, status }: { id: string; status: HelpArticleStatus }) { return <div className="flex flex-wrap gap-1"><Button id={id} current={status} target="published" label="发布" /><Button id={id} current={status} target="draft" label="转草稿" /><Button id={id} current={status} target="archived" label="归档" /></div>; }
