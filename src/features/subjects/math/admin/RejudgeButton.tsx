"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";

import { rejudgeMathAnswersAction } from "../grading/rejudge-actions";

const initialState = { status: "idle" as const, message: "" };

/** 批改页上方的“重新判题”：用原规格重算待批改提交的机器建议（不改规格、不改正式得分）。 */
export function RejudgeButton({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(rejudgeMathAnswersAction, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        className="app-soft-card inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"
      >
        <RotateCcw size={14} aria-hidden="true" />
        {pending ? "重新判题中…" : "重新判题"}
      </button>
      <span className="app-muted-text text-[11px]">
        用原判题规格重算待批改提交的系统建议；已保存的评分不变。
      </span>
      {state.status !== "idle" && (
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="text-xs font-semibold">
          {state.message}
        </p>
      )}
    </form>
  );
}
