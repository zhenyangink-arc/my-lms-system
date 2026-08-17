"use client";

import { useActionState, useId } from "react";
import { MessageSquareReply } from "lucide-react";

import { initialHelpCenterActionState } from "./action-state";
import { replyHelpTicketAction } from "./actions";

export function HelpTicketReplyForm({ ticketId, disabled = false, staff = false }: { ticketId: string; disabled?: boolean; staff?: boolean }) {
  const action = replyHelpTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  const bodyId = useId();
  const feedbackId = useId();

  if (disabled) return <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">该求助已经关闭，不能继续回复。</p>;

  const hasError = state.status === "error";

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <div>
        <label htmlFor={bodyId} className="block text-xs font-medium text-[var(--foreground-secondary)]">
          {staff ? "回复学生" : "继续补充"}
        </label>
        <textarea
          id={bodyId}
          name="body"
          required
          minLength={1}
          maxLength={5000}
          rows={4}
          placeholder={staff ? "填写给学生的回复内容" : "补充新的情况或回复老师消息"}
          aria-invalid={hasError}
          aria-describedby={hasError ? feedbackId : undefined}
          disabled={pending}
          className="app-input mt-2 w-full resize-y border px-3 py-2.5 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        {state.message && (
          <p
            id={feedbackId}
            role={hasError ? "alert" : "status"}
            aria-atomic="true"
            className="mt-2 text-xs font-medium"
            style={{ color: hasError ? "var(--destructive)" : "var(--status-success)" }}
          >
            {state.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquareReply size={12} aria-hidden="true" />
        {pending ? "发送中…" : "发送回复"}
      </button>
    </form>
  );
}
