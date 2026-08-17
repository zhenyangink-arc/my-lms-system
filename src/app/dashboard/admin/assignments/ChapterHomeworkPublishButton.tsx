"use client";

import { RotateCcw, Send } from "lucide-react";
import { useActionState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { setChapterHomeworkPublicationAction } from "./homework-plan-actions";

export function ChapterHomeworkPublishButton({
  planId,
  isPublished,
}: {
  planId: string;
  isPublished: boolean;
}) {
  const nextStatus = isPublished ? "draft" : "published";
  const action = setChapterHomeworkPublicationAction.bind(
    null,
    planId,
    nextStatus
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningAssignmentActionState
  );
  const label = isPublished ? "已发布" : "发布";
  const pendingLabel = isPublished ? "撤回中…" : "发布中…";
  const title =
    state.status === "error"
      ? state.message
      : isPublished
        ? "点击撤回发布并转为草稿"
        : "发布章节作业";
  const Icon = isPublished ? RotateCcw : Send;

  return (
    <form action={formAction} className="inline-flex items-center">
      <button
        type="submit"
        disabled={pending}
        aria-label={title}
        title={title}
        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold hover:underline disabled:opacity-50"
        style={{
          color: isPublished ? "var(--status-success)" : "var(--primary)",
        }}
      >
        <Icon size={12} />
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
