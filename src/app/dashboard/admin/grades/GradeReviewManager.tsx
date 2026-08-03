"use client";

import { useActionState } from "react";
import { SearchCheck } from "lucide-react";

import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import { resolveGradeReviewAction } from "@/app/dashboard/grades/actions";
import { GRADE_REVIEW_STATUS_LABELS } from "@/app/dashboard/grades/config";

export function GradeReviewManager({
  reviewId,
  response,
}: {
  reviewId: string;
  response: string;
}) {
  const action = resolveGradeReviewAction.bind(null, reviewId);
  const [state, formAction, pending] = useActionState(
    action,
    initialGradeCenterActionState,
  );

  return (
    <details className="group">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-2 text-[10px] font-black text-white"
        style={{ backgroundColor: "var(--app-accent)" }}
      >
        <SearchCheck size={11} />处理复核
      </summary>
      <form
        action={formAction}
        className="mt-2 min-w-[240px] space-y-2 border-t pt-2"
        style={{ borderColor: "var(--app-border-soft)" }}
      >
        <select
          name="status"
          defaultValue="reviewing"
          className="app-input w-full rounded-md border px-2 py-2 text-[10px]"
        >
          {Object.entries(GRADE_REVIEW_STATUS_LABELS)
            .filter(([value]) => value !== "pending")
            .map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
        </select>
        <textarea
          name="response"
          maxLength={3000}
          rows={3}
          defaultValue={response}
          placeholder="填写核对结果或调整说明"
          className="app-input w-full resize-y rounded-md border px-2.5 py-2 text-[10px] leading-5"
        />
        {state.message && (
          <p
            className="text-[9px] font-bold"
            style={{
              color:
                state.status === "error"
                  ? "#c94f45"
                  : "var(--app-success)",
            }}
          >
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <SearchCheck size={10} />{pending ? "保存中…" : "保存处理结果"}
        </button>
      </form>
    </details>
  );
}
