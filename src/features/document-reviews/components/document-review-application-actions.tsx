"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, RotateCcw, Unlock } from "lucide-react";

import {
  reviewApplicationAction,
  toggleApplicationChecklistItemLockAction,
  toggleTargetDocumentsLockAction,
  type DocumentReviewActionState,
} from "@/app/dashboard/admin/documents/actions";
import type {
  DocumentReviewApplication,
  DocumentReviewItem,
} from "../api/types";

const initialReviewState: DocumentReviewActionState = {
  status: "idle",
  message: "",
};

export function DocumentReviewDecisionActions({
  application,
}: {
  application: DocumentReviewApplication;
}) {
  const router = useRouter();
  const [note, setNote] = useState(application.reviewNote);
  const [revisionState, submitRevision, revisionPending] = useActionState(
    reviewApplicationAction.bind(
      null,
      application.id,
      "revision_required" as const,
    ),
    initialReviewState,
  );
  const [approvalState, submitApproval, approvalPending] = useActionState(
    reviewApplicationAction.bind(null, application.id, "approved" as const),
    initialReviewState,
  );
  const unresolvedCount = application.documents.filter(
    (item) => item.status === "preparing" && !item.lockedAt,
  ).length;
  const activeState =
    approvalState.status !== "idle" ? approvalState : revisionState;

  useEffect(() => {
    if (
      revisionState.status === "success" ||
      approvalState.status === "success"
    ) {
      router.refresh();
    }
  }, [approvalState.status, revisionState.status, router]);

  if (application.reviewStatus !== "pending_review") {
    return (
      <p className="border-t border-[var(--app-border)] px-5 py-4 text-xs text-[var(--app-muted)]">
        当前申请单不在待确认状态，不能执行退回补充或审核通过。
      </p>
    );
  }

  return (
    <section className="border-t border-[var(--app-border)] bg-[var(--app-soft-bg)] px-5 py-4">
      <label className="block text-xs font-semibold text-[var(--app-text)]">
        审核意见
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="退回补充时必须填写至少 2 个字符的原因；审核通过时可以填写内部说明。"
          className="mt-2 w-full resize-y border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 text-xs font-normal leading-5 outline-none focus:border-[var(--app-accent)]"
        />
      </label>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-xs">
          {activeState.status === "error" && (
            <p className="text-red-700">{activeState.message}</p>
          )}
          {activeState.status === "success" && (
            <p className="text-[var(--app-success)]">{activeState.message}</p>
          )}
          {unresolvedCount > 0 && activeState.status === "idle" && (
            <p className="text-[var(--app-warm)]">
              仍有 {unresolvedCount} 项未完成资料，只能退回补充。
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <form action={submitRevision}>
            <input type="hidden" name="reviewNote" value={note} />
            <button
              type="submit"
              disabled={revisionPending || approvalPending || note.trim().length < 2}
              className="inline-flex h-9 items-center gap-1.5 border border-red-200 bg-[var(--app-card-bg)] px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={14} />
              {revisionPending ? "正在退回…" : "退回补充"}
            </button>
          </form>
          <form action={submitApproval}>
            <input type="hidden" name="reviewNote" value={note} />
            <button
              type="submit"
              disabled={
                unresolvedCount > 0 || revisionPending || approvalPending
              }
              className="inline-flex h-9 items-center gap-1.5 bg-[var(--app-accent)] px-3 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={14} />
              {approvalPending ? "正在确认…" : "审核通过"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function LockActionButton({
  locked,
  pending,
  onClick,
  label,
}: {
  locked: boolean;
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-text-soft)] hover:text-[var(--app-text)] disabled:opacity-40"
    >
      {locked ? <Unlock size={13} /> : <Lock size={13} />}
      {pending ? "处理中…" : label}
    </button>
  );
}

export function DocumentReviewTargetLockAction({
  studentId,
  targetId,
  lockedAt,
}: {
  studentId: string;
  targetId: string;
  lockedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const locked = Boolean(lockedAt);

  function toggleLock() {
    setError("");
    startTransition(async () => {
      try {
        await toggleTargetDocumentsLockAction(
          studentId,
          targetId,
          !locked,
        );
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "申请单锁定状态更新失败。",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <LockActionButton
        locked={locked}
        pending={pending}
        onClick={toggleLock}
        label={locked ? "解锁整单" : "锁定整单"}
      />
      {error && <p className="max-w-64 text-right text-[10px] text-red-700">{error}</p>}
    </div>
  );
}

export function DocumentReviewItemLockAction({
  studentId,
  item,
}: {
  studentId: string;
  item: DocumentReviewItem;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const locked = Boolean(item.lockedAt);

  function toggleLock() {
    setError("");
    startTransition(async () => {
      try {
        await toggleApplicationChecklistItemLockAction(
          studentId,
          item.id,
          !locked,
        );
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "资料项目锁定状态更新失败。",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <LockActionButton
        locked={locked}
        pending={pending}
        onClick={toggleLock}
        label={locked ? "解锁" : "锁定"}
      />
      {error && <p className="max-w-48 text-[10px] text-red-700">{error}</p>}
    </div>
  );
}
