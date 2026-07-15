"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, PlayCircle, RotateCcw, Save } from "lucide-react";

import { initialVisaAdminActionState } from "./action-state";
import {
  completeVisaTaskReviewAction,
  startVisaTaskReviewAction,
  updateVisaCaseAdminAction,
} from "./actions";

function Message({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return <p role="status" className={`rounded-xl px-3 py-2 text-xs font-bold ${status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>;
}

export function VisaCaseAdminForm({ studentId, caseStatus, advisorNote }: { studentId: string; caseStatus: string; advisorNote: string | null }) {
  const [state, action, pending] = useActionState(updateVisaCaseAdminAction.bind(null, studentId), initialVisaAdminActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
        <label><span className="mb-1.5 block text-xs font-black">整体办理阶段</span><select name="case_status" defaultValue={caseStatus} className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold"><option value="planning">方案规划</option><option value="preparing">材料准备</option><option value="ready_to_submit">递签确认</option><option value="submitted">已经递签</option><option value="additional_documents">补充材料</option><option value="approved">审核通过</option><option value="issued">签证签发</option><option value="closed">流程结束</option></select></label>
        <label><span className="mb-1.5 block text-xs font-black">给学生的顾问提醒</span><input name="advisor_note" defaultValue={advisorNote ?? ""} maxLength={1000} placeholder="例如：请在本周内确认递签城市和计划入境日期" className="app-input w-full rounded-xl border px-3 py-2.5 text-xs" /></label>
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-secondary)" }}><Save size={14} />{pending ? "保存中…" : "保存跟进信息"}</button>
      </div>
      <Message status={state.status} message={state.message} />
    </form>
  );
}

export function VisaTaskReviewControls({ taskId, status }: { taskId: string; status: string }) {
  const [startState, startAction, startPending] = useActionState(startVisaTaskReviewAction.bind(null, taskId), initialVisaAdminActionState);
  const [finishState, finishAction, finishPending] = useActionState(completeVisaTaskReviewAction.bind(null, taskId), initialVisaAdminActionState);
  const [decision, setDecision] = useState("approved");

  if (status === "submitted") {
    return <form action={startAction} className="space-y-2"><Message status={startState.status} message={startState.message} /><button type="submit" disabled={startPending} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)" }}><PlayCircle size={15} />{startPending ? "正在处理…" : "开始审核"}</button></form>;
  }

  if (status === "reviewing") {
    return (
      <form action={finishAction} className="space-y-2.5">
        <select name="decision" value={decision} onChange={(event) => setDecision(event.target.value)} className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold"><option value="approved">审核通过，设为已确认</option><option value="revision_required">存在问题，退回补充</option></select>
        <textarea name="admin_note" required={decision === "revision_required"} maxLength={1000} rows={3} placeholder={decision === "revision_required" ? "请明确说明需要补充或修改的内容" : "可填写确认说明"} className="app-input w-full resize-none rounded-xl border px-3 py-2.5 text-xs leading-5" />
        <Message status={finishState.status} message={finishState.message} />
        <button type="submit" disabled={finishPending} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60" style={{ backgroundColor: decision === "approved" ? "var(--app-success)" : "var(--app-warm)" }}>{decision === "approved" ? <CheckCircle2 size={15} /> : <RotateCcw size={15} />}{finishPending ? "保存中…" : decision === "approved" ? "完成审核" : "退回学生补充"}</button>
      </form>
    );
  }

  return null;
}
