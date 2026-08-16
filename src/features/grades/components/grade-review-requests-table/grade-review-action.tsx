"use client";

import { useActionState } from "react";
import { SearchCheck } from "lucide-react";

import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import { resolveGradeReviewAction } from "@/app/dashboard/grades/actions";

const REVIEW_STATUS_OPTIONS = [
  { value: "reviewing", label: "复核中" },
  { value: "resolved", label: "已完成" },
  { value: "rejected", label: "未调整" },
] as const;

export function GradeReviewAction({
  reviewId,
  response,
  studentAppId,
}: {
  reviewId: string;
  response: string;
  studentAppId?: string;
}) {
  const action = resolveGradeReviewAction.bind(
    null,
    reviewId,
    studentAppId ?? null,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialGradeCenterActionState,
  );

  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2.5 text-[10px] font-semibold text-[var(--app-text)] hover:bg-[var(--app-soft-bg)]">
        <SearchCheck size={12} aria-hidden="true" />
        处理复核
      </summary>
      <form
        action={formAction}
        className="absolute right-0 z-30 mt-1 w-72 space-y-3 border border-[var(--app-border)] bg-[var(--app-card-bg)] p-3 shadow-lg"
      >
        <label className="block text-[10px] font-semibold text-[var(--app-text-soft)]">
          处理状态
          <select
            name="status"
            defaultValue="reviewing"
            className="app-input mt-1.5 w-full border px-2.5 py-2 text-xs"
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold text-[var(--app-text-soft)]">
          处理说明
          <textarea
            name="response"
            maxLength={3000}
            rows={4}
            defaultValue={response}
            placeholder="填写核对结果或调整说明"
            className="app-input mt-1.5 w-full resize-y border px-2.5 py-2 text-xs leading-5"
          />
        </label>
        {state.message && (
          <p
            className="text-[10px] font-medium"
            style={{
              color:
                state.status === "error"
                  ? "var(--app-danger)"
                  : "var(--app-success)",
            }}
          >
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 bg-[var(--app-accent)] px-3 text-[10px] font-semibold text-white disabled:opacity-50"
        >
          <SearchCheck size={11} aria-hidden="true" />
          {pending ? "保存中…" : "保存处理结果"}
        </button>
      </form>
    </details>
  );
}
