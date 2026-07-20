"use client";

import { useActionState } from "react";
import { MessageSquareReply } from "lucide-react";

import { initialHelpCenterActionState } from "./action-state";
import { replyHelpTicketAction } from "./actions";

export function HelpTicketReplyForm({ ticketId, disabled = false }: { ticketId: string; disabled?: boolean }) {
  const action = replyHelpTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  if (disabled) return <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">该求助已经关闭，不能继续回复。</p>;
  return <form action={formAction} className="space-y-3"><label className="block text-xs font-black">继续补充<textarea name="body" required maxLength={5000} rows={4} placeholder="补充新的情况或回复后台消息" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" /></label>{state.message && <p className="text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}<button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><MessageSquareReply size={14} />{pending ? "正在发送…" : "发送回复"}</button></form>;
}
