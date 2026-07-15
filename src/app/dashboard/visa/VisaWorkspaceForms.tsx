"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Check, FileCheck2, Save, Send } from "lucide-react";

import {
  initializeVisaWorkspaceAction,
  updateVisaCaseAction,
  updateVisaTaskAction,
} from "./actions";
import { initialVisaActionState } from "./visa-action-state";

function ActionMessage({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return <p role="status" className={`rounded-xl px-3 py-2 text-xs font-bold ${status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message}</p>;
}

export function InitializeVisaWorkspaceButton() {
  const [state, action, pending] = useActionState(initializeVisaWorkspaceAction, initialVisaActionState);
  return (
    <form action={action} className="space-y-3 text-center">
      <ActionMessage status={state.status} message={state.message} />
      <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-success)" }}><FileCheck2 size={17} />{pending ? "正在建立…" : "建立签证准备路线"}</button>
    </form>
  );
}

export function VisaCaseForm({ visaType, targetEntryDate, applicationCity }: { visaType: string; targetEntryDate: string | null; applicationCity: string | null }) {
  const [state, action, pending] = useActionState(updateVisaCaseAction, initialVisaActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block"><span className="mb-1.5 block text-xs font-black">签证类型</span><select name="visa_type" defaultValue={visaType} className="app-input w-full rounded-xl border px-3 py-2.5 text-sm font-bold"><option value="undecided">暂未确定</option><option value="d4_language">语言研修签证</option><option value="d2_degree">学历课程签证</option><option value="d10_job">求职签证</option><option value="other">其他类型</option></select></label>
        <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-black"><CalendarDays size={13} />计划入境日期</span><input name="target_entry_date" type="date" defaultValue={targetEntryDate ?? ""} className="app-input w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black">递签城市</span><input name="application_city" defaultValue={applicationCity ?? ""} maxLength={80} placeholder="例如：北京、上海、广州" className="app-input w-full rounded-xl border px-3 py-2.5 text-sm" /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><ActionMessage status={state.status} message={state.message} /><button type="submit" disabled={pending} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-secondary)" }}><Save size={14} />{pending ? "正在保存…" : "保存基础信息"}</button></div>
    </form>
  );
}

const LOCKED_STATUS_TEXT: Record<string, string> = {
  submitted: "已经提交，等待管理员开始审核。",
  reviewing: "管理员正在审核，当前内容已锁定。",
  approved: "任务已经审核确认。",
};

function statusOptions(status: string) {
  if (status === "pending") return [["pending", "未开始"], ["in_progress", "准备中"], ["blocked", "需要协助"]];
  if (status === "blocked") return [["blocked", "需要协助"], ["in_progress", "继续准备"]];
  if (status === "revision_required") return [["in_progress", "继续补充"], ["submitted", "重新提交审核"]];
  return [["in_progress", "准备中"], ["pending", "未开始"], ["submitted", "提交管理员审核"], ["blocked", "需要协助"]];
}

export function VisaTaskForm({ taskId, status, studentNote }: { taskId: string; status: string; studentNote: string | null }) {
  const [state, action, pending] = useActionState(updateVisaTaskAction.bind(null, taskId), initialVisaActionState);
  const [selectedStatus, setSelectedStatus] = useState(status === "revision_required" ? "in_progress" : status);

  if (LOCKED_STATUS_TEXT[status]) {
    return <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}><Check className="mt-0.5 shrink-0" size={14} />{LOCKED_STATUS_TEXT[status]}</div>;
  }

  return (
    <form action={action} className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
        <select name="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="app-input rounded-xl border px-3 py-2.5 text-xs font-bold">{statusOptions(status).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input name="student_note" defaultValue={studentNote ?? ""} maxLength={400} placeholder={status === "revision_required" ? "说明本次补充内容" : "填写准备情况或需要协助的问题"} className="app-input min-w-0 rounded-xl border px-3 py-2.5 text-xs" />
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: selectedStatus === "submitted" ? "var(--app-success)" : "var(--app-accent)" }}>{selectedStatus === "submitted" ? <Send size={13} /> : <Save size={13} />}{pending ? "保存中…" : selectedStatus === "submitted" ? "提交审核" : "保存"}</button>
      </div>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
