"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  markStudentReviewItemMasteredAction,
  type MasterReviewItemActionState,
} from "./actions";

const INITIAL_STATE: MasterReviewItemActionState = {
  status: "idle",
  message: "",
};

export function MasterReviewItemButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(
    markStudentReviewItemMasteredAction.bind(null, itemId),
    INITIAL_STATE,
  );
  return (
    <div>
      <form action={action} data-permission="dashboard_section">
        <button
          type="submit"
          disabled={pending || state.status === "success"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          {pending
            ? "保存中…"
            : state.status === "success"
              ? "已重新掌握"
              : "标记为重新掌握"}
        </button>
      </form>
      {state.message ? (
        <p
          className={`mt-2 text-xs font-bold ${
            state.status === "error"
              ? "text-[var(--status-danger)]"
              : "text-[var(--status-success)]"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
