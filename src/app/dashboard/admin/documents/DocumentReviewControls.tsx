"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, PlayCircle, RotateCcw } from "lucide-react";

import { initialReviewActionState } from "./action-state";
import { completeDocumentReviewAction, startDocumentReviewAction } from "./actions";

function Message({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return <p role="status" className={`rounded-xl px-3 py-2.5 text-xs font-bold ${status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>;
}

export function DocumentReviewControls({ documentId, status }: { documentId: string; status: string }) {
  const [startState, startAction, startPending] = useActionState(
    startDocumentReviewAction.bind(null, documentId),
    initialReviewActionState
  );
  const [finishState, finishAction, finishPending] = useActionState(
    completeDocumentReviewAction.bind(null, documentId),
    initialReviewActionState
  );
  const [decision, setDecision] = useState("approved");

  if (status === "pending_review") {
    return (
      <form action={startAction} className="space-y-2">
        <Message status={startState.status} message={startState.message} />
        <button type="submit" disabled={startPending} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)" }}><PlayCircle size={15} />{startPending ? "正在处理…" : "开始审核"}</button>
      </form>
    );
  }

  if (status === "reviewing") {
    return (
      <form action={finishAction} className="space-y-3">
        <label className="block"><span className="mb-1.5 block text-xs font-black">审核结果</span><select name="decision" value={decision} onChange={(event) => setDecision(event.target.value)} className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold"><option value="approved">审核通过，设为已确认</option><option value="revision_required">存在问题，退回重交</option></select></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black">审核意见{decision === "revision_required" ? "（必填）" : "（选填）"}</span><textarea name="review_note" required={decision === "revision_required"} maxLength={500} rows={3} placeholder={decision === "revision_required" ? "请说明文件缺少、模糊或信息错误的位置。" : "可填写确认说明。"} className="app-input w-full resize-none rounded-xl border px-3 py-2.5 text-xs leading-5" /></label>
        <Message status={finishState.status} message={finishState.message} />
        <button type="submit" disabled={finishPending} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: decision === "approved" ? "var(--app-success)" : "var(--app-warm)" }}>{decision === "approved" ? <CheckCircle2 size={15} /> : <RotateCcw size={15} />}{finishPending ? "正在保存…" : decision === "approved" ? "完成审核" : "退回学生重交"}</button>
      </form>
    );
  }

  return null;
}
