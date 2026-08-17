"use client";

import { useActionState, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, PlayCircle, RotateCcw, Save } from "lucide-react";

import { initialVisaAdminActionState } from "./action-state";
import {
  completeVisaTaskReviewAction,
  startVisaTaskReviewAction,
  updateVisaCaseAdminAction,
} from "./actions";
import { getVisaCaseStages } from "../../visa/visa-case-stages";

function Message({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return <p role="status" className={`border px-3 py-2 text-[10px] font-medium ${status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message}</p>;
}

const CHINESE_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

function toDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ChineseDatePicker({ defaultValue }: { defaultValue: string | null }) {
  const initial = dateParts(defaultValue ?? "");
  const today = new Date();
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ year: initial?.year ?? today.getFullYear(), month: initial?.month ?? today.getMonth() }));
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const selected = dateParts(value);
  const displayValue = selected ? `${selected.year}年${String(selected.month + 1).padStart(2, "0")}月${String(selected.day).padStart(2, "0")}日` : "选择日期";

  function moveMonth(offset: number) {
    const next = new Date(view.year, view.month + offset, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <div className="relative">
      <input type="hidden" name="target_entry_date" value={value} />
      <button type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="dialog" aria-expanded={open} className="app-input flex w-full items-center justify-between border px-3 py-2.5 text-left text-xs font-medium">
        <span className={selected ? "" : "app-muted-text"}>{displayValue}</span><CalendarDays size={15} aria-hidden="true" />
      </button>
      {open && <div role="dialog" aria-label="选择最晚入境日期" className="app-card absolute z-20 mt-2 w-[280px] border p-3 shadow-xl">
        <div className="mb-3 flex items-center justify-between"><button type="button" onClick={() => moveMonth(-1)} aria-label="上一个月" className="rounded-lg p-1.5 hover:bg-black/5"><ChevronLeft size={16} /></button><p className="text-sm font-semibold">{view.year}年{view.month + 1}月</p><button type="button" onClick={() => moveMonth(1)} aria-label="下一个月" className="rounded-lg p-1.5 hover:bg-black/5"><ChevronRight size={16} /></button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">{CHINESE_WEEKDAYS.map((day) => <span key={day} className="app-muted-text py-1 font-semibold">{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const isSelected = selected?.year === view.year && selected.month === view.month && selected.day === day; return <button key={day} type="button" onClick={() => { setValue(toDateValue(view.year, view.month, day)); setOpen(false); }} className={`aspect-square rounded-lg font-bold transition ${isSelected ? "text-white" : "hover:bg-black/5"}`} style={isSelected ? { backgroundColor: "var(--support)" } : undefined}>{day}</button>; })}</div>
      </div>}
    </div>
  );
}

export function VisaCaseAdminForm({ studentId, visaType, applicationChannel, targetEntryDate, caseStatus, advisorNote }: { studentId: string; visaType: string; applicationChannel: string; targetEntryDate: string | null; caseStatus: string; advisorNote: string | null }) {
  const [state, action, pending] = useActionState(updateVisaCaseAdminAction.bind(null, studentId), initialVisaAdminActionState);
  const [selectedChannel, setSelectedChannel] = useState(applicationChannel);
  const [selectedCaseStatus, setSelectedCaseStatus] = useState(caseStatus);
  const caseStages = getVisaCaseStages(selectedChannel);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-px border border-black/[0.08] bg-black/[0.08] xl:grid-cols-[220px_190px_175px_210px_minmax(0,1fr)_auto] xl:items-stretch">
        <label className="bg-white p-3"><span className="mb-1.5 block text-[9px] font-medium text-zinc-400">办理通道</span><select name="application_channel" value={selectedChannel} onChange={(event) => { const nextChannel = event.target.value; const nextStages = getVisaCaseStages(nextChannel); setSelectedChannel(nextChannel); setSelectedCaseStatus((current) => nextStages.some((stage) => stage.status === current) ? current : nextStages[0].status); }} className="app-input w-full border px-3 py-2.5 text-xs font-medium"><option value="china_consulate">驻中韩国领事馆递签证</option><option value="korea_immigration">韩国出入境返签证</option></select></label>
        <label className="bg-white p-3"><span className="mb-1.5 block text-[9px] font-medium text-zinc-400">签证类型</span><select name="visa_type" defaultValue={visaType} className="app-input w-full border px-3 py-2.5 text-xs font-medium"><option value="d4_language">语言研修签证</option><option value="d2_bachelor">本科签证</option><option value="d2_master">硕士签证</option><option value="d2_doctor">博士签证</option></select></label>
        <label className="bg-white p-3"><span className="mb-1.5 block text-[9px] font-medium text-zinc-400">最晚入境日期</span><ChineseDatePicker defaultValue={targetEntryDate} /></label>
        <label className="bg-white p-3"><span className="mb-1.5 block text-[9px] font-medium text-zinc-400">整体办理阶段</span><select name="case_status" value={selectedCaseStatus} onChange={(event) => setSelectedCaseStatus(event.target.value)} className="app-input w-full border px-3 py-2.5 text-xs font-medium">{caseStages.map((stage) => <option key={stage.status} value={stage.status}>{stage.label}</option>)}</select></label>
        <label className="bg-white p-3"><span className="mb-1.5 block text-[9px] font-medium text-zinc-400">给学生的顾问提醒</span><input name="advisor_note" defaultValue={advisorNote ?? ""} maxLength={1000} placeholder="例如：请在本周内确认递签城市和最晚入境日期" className="app-input w-full border px-3 py-2.5 text-xs" /></label>
        <div className="flex items-end bg-white p-3"><button type="submit" disabled={pending} className="inline-flex h-[38px] w-full items-center justify-center gap-2 border border-zinc-900 bg-zinc-900 px-4 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-60"><Save size={14} />{pending ? "保存中…" : "保存跟进信息"}</button></div>
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
    return <form action={startAction} className="space-y-2"><Message status={startState.status} message={startState.message} /><button type="submit" disabled={startPending} className="flex w-full items-center justify-center gap-2 border border-amber-700 bg-amber-700 px-4 py-2 text-[10px] font-medium text-white disabled:opacity-60"><PlayCircle size={15} />{startPending ? "正在处理…" : "开始审核"}</button></form>;
  }

  if (status === "reviewing") {
    return (
      <form action={finishAction} className="space-y-2.5">
        <select key={decision} name="decision" defaultValue={decision} onChange={(event) => setDecision(event.target.value)} className="app-input w-full border px-3 py-2 text-[10px] font-medium"><option value="approved">审核通过，设为已确认</option><option value="revision_required">存在问题，退回补充</option></select>
        <textarea name="admin_note" required={decision === "revision_required"} maxLength={1000} rows={3} placeholder={decision === "revision_required" ? "请明确说明需要补充或修改的内容" : "可填写确认说明"} className="app-input w-full resize-none border px-3 py-2 text-[10px] leading-4" />
        <Message status={finishState.status} message={finishState.message} />
        <button type="submit" disabled={finishPending} className={`flex w-full items-center justify-center gap-2 border px-4 py-2 text-[10px] font-medium text-white disabled:opacity-60 ${decision === "approved" ? "border-emerald-700 bg-emerald-700" : "border-rose-700 bg-rose-700"}`}>{decision === "approved" ? <CheckCircle2 size={15} /> : <RotateCcw size={15} />}{finishPending ? "保存中…" : decision === "approved" ? "完成审核" : "退回学生补充"}</button>
      </form>
    );
  }

  return null;
}
