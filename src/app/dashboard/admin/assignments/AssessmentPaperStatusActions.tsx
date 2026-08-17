"use client";

import { Archive, CopyPlus, FileClock, Send, StopCircle } from "lucide-react";
import { useActionState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import type { AssessmentPaperStatus } from "@/lib/assessment-papers";
import {
  changeAssessmentPaperStatusAction,
  duplicateAssessmentPaperAction,
} from "./paper-actions";

function ActionButton({
  action,
  label,
  icon: Icon,
  tone = "muted",
  confirmation,
}: {
  action: (
    previousState: typeof initialLearningAssignmentActionState,
    formData: FormData
  ) => Promise<typeof initialLearningAssignmentActionState>;
  label: string;
  icon: typeof Send;
  tone?: "accent" | "muted" | "danger";
  confirmation?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningAssignmentActionState
  );
  const colors =
    tone === "accent"
      ? {
          color: "var(--primary)",
          backgroundColor: "var(--accent)",
        }
      : tone === "danger"
        ? {
            color: "var(--status-danger)",
            backgroundColor: "var(--status-danger-surface)",
          }
        : {
            color: "var(--foreground-muted)",
            backgroundColor: "var(--surface-soft)",
          };

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={pending}
        title={state.message || label}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50"
        style={colors}
      >
        <Icon size={12} aria-hidden="true" />
        {pending ? "处理中…" : label}
      </button>
    </form>
  );
}

export function AssessmentPaperStatusActions({
  paperId,
  paperType,
  status,
}: {
  paperId: string;
  paperType: "homework" | "exam";
  status: AssessmentPaperStatus;
}) {
  const duplicateAction = duplicateAssessmentPaperAction.bind(
    null,
    paperId,
    paperType
  );
  const publishAction = changeAssessmentPaperStatusAction.bind(
    null,
    paperId,
    paperType,
    "published"
  );
  const draftAction = changeAssessmentPaperStatusAction.bind(
    null,
    paperId,
    paperType,
    "draft"
  );
  const retireAction = changeAssessmentPaperStatusAction.bind(
    null,
    paperId,
    paperType,
    "retired"
  );
  const archiveAction = changeAssessmentPaperStatusAction.bind(
    null,
    paperId,
    paperType,
    "archived"
  );

  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton action={duplicateAction} label="复制新卷" icon={CopyPlus} />
      {status === "published" ? (
        <ActionButton
          action={retireAction}
          label="停止提供"
          icon={StopCircle}
          tone="danger"
          confirmation="确认停止向机构提供这份试卷？已创建的任务不会被删除。"
        />
      ) : (
        <ActionButton
          action={publishAction}
          label="提供给机构"
          icon={Send}
          tone="accent"
        />
      )}
      {status !== "draft" && (
        <ActionButton action={draftAction} label="转为草稿" icon={FileClock} />
      )}
      {status !== "archived" && (
        <ActionButton
          action={archiveAction}
          label="归档"
          icon={Archive}
          confirmation="确认归档这份试卷？归档后将不再出现在常用试卷列表中。"
        />
      )}
    </div>
  );
}
