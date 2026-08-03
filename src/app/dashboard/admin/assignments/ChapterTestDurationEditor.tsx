"use client";

import { Check, LoaderCircle, Pencil, X } from "lucide-react";
import { useActionState, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { updateChapterTestDurationAction } from "./paper-actions";

export function ChapterTestDurationEditor({
  testId,
  durationMinutes,
}: {
  testId: string;
  durationMinutes: number;
}) {
  const action = updateChapterTestDurationAction.bind(null, testId);
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningAssignmentActionState
  );
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={
            state.message || `修改当前 ${durationMinutes} 分钟的测试时长`
          }
          className="group inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 font-mono text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--app-soft-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-secondary)]"
        >
          <span>{durationMinutes}</span>
          <span className="app-muted-text font-sans text-[10px]">分钟</span>
          <Pencil
            size={11}
            className="app-muted-text opacity-55 transition-opacity group-hover:opacity-100"
          />
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex items-center justify-center gap-1"
      title={state.message || undefined}
    >
      <input
        autoFocus
        type="number"
        name="duration_minutes"
        min={1}
        max={180}
        step={1}
        required
        defaultValue={durationMinutes}
        aria-label="测试时长，分钟"
        className="app-input h-8 w-14 rounded-md border px-1.5 text-center font-mono text-xs font-semibold tabular-nums"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="保存测试时长"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--app-success)" }}
      >
        {pending ? (
          <LoaderCircle size={13} className="animate-spin" />
        ) : (
          <Check size={13} />
        )}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        aria-label="取消修改"
        className="app-muted-text inline-flex h-8 w-7 items-center justify-center rounded-md hover:bg-[var(--app-soft-bg)] disabled:opacity-50"
      >
        <X size={13} />
      </button>
      {state.status === "error" && (
        <span className="sr-only" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
