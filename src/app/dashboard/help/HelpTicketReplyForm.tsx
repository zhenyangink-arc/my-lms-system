"use client";

import { useActionState } from "react";
import { MessageSquareReply } from "lucide-react";

import { initialHelpCenterActionState } from "./action-state";
import { replyHelpTicketAction } from "./actions";

export function HelpTicketReplyForm({ ticketId, disabled = false, staff = false }: { ticketId: string; disabled?: boolean; staff?: boolean }) {
  const action = replyHelpTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  if (disabled) return <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">该求助已经关闭，不能继续回复。</p>;
  return <form action={formAction} className="space-y-3"><label className="block text-[10px] font-medium text-zinc-600">{staff ? "回复学生" : "继续补充"}<textarea name="body" required maxLength={5000} rows={4} placeholder={staff ? "填写给学生的回复内容" : "补充新的情况或回复老师消息"} className="app-input mt-2 w-full resize-y border px-3 py-2.5 text-xs leading-5" /></label>{state.message && <p className="text-[10px] font-medium" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}<button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-[10px] font-medium text-white disabled:opacity-50"><MessageSquareReply size={12} />{pending ? "发送中…" : "发送回复"}</button></form>;
}
