"use client";
import { useActionState, useEffect, useRef } from "react";
import { SearchCheck } from "lucide-react";
import { initialGradeCenterActionState } from "./action-state";
import {
  requestSourceGradeReviewAction,
  type LiveGradeSourceType,
} from "./actions";

export function GradeReviewForm({
  sourceType,
  sourceResultId,
}: {
  sourceType: LiveGradeSourceType;
  sourceResultId: string;
}) {
  const action = requestSourceGradeReviewAction.bind(
    null,
    sourceType,
    sourceResultId,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialGradeCenterActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 提交成功后文本框之前一直留着刚才的内容，下次打开还是旧的申请原因。
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <details className="app-soft-card w-full rounded-lg border px-3 sm:w-auto sm:min-w-72">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] [&::-webkit-details-marker]:hidden">
        申请成绩复核
      </summary>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 space-y-3 border-t pt-3"
        style={{ borderColor: "var(--app-border-soft)" }}
      >
        <textarea
          name="reason"
          required
          minLength={2}
          maxLength={2000}
          rows={3}
          placeholder="说明需要核对的题目、分数或评语"
          className="app-input min-h-24 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6"
        />
        {state.message && (
          <p
            className="text-xs font-semibold"
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
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <SearchCheck size={13} aria-hidden="true" />
          {pending ? "正在提交…" : "提交复核"}
        </button>
      </form>
    </details>
  );
}
