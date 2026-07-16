"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDays, Check, FileCheck2, MapPin, Save, Send } from "lucide-react";

import { CHINA_PROVINCES, CHINA_REGION_CITIES } from "../profile/china-cities";
import {
  initializeVisaWorkspaceAction,
  updateVisaCaseAction,
  updateVisaTaskAction,
} from "./actions";
import { getConsulateForProvince } from "./consulate-jurisdictions";
import { initialVisaActionState } from "./visa-action-state";

// 入境计划年份覆盖近两年到未来六年，避免依赖运行时日期导致服务端与客户端渲染不一致。
const ENTRY_YEARS = Array.from({ length: 9 }, (_, index) => String(2024 + index));
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

function daysInMonth(yearText: string, monthText: string) {
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return 31;
  if (month === 2) {
    const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

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
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const cities = province ? CHINA_REGION_CITIES[province] ?? [] : [];
  const resolvedConsulate = province ? getConsulateForProvince(province) : null;
  const consulateValue = resolvedConsulate ?? applicationCity ?? "";

  const entryParts = targetEntryDate ? targetEntryDate.split("-") : ["", "", ""];
  const [entryYear, setEntryYear] = useState(entryParts[0] ?? "");
  const [entryMonth, setEntryMonth] = useState(entryParts[1] ?? "");
  const [entryDay, setEntryDay] = useState(entryParts[2] ?? "");
  const entryDayOptions = useMemo(
    () => Array.from({ length: daysInMonth(entryYear, entryMonth) }, (_, index) => String(index + 1).padStart(2, "0")),
    [entryYear, entryMonth]
  );
  const computedEntryDate = entryYear && entryMonth && entryDay ? `${entryYear}-${entryMonth}-${entryDay}` : (targetEntryDate ?? "");

  return (
    <form action={action} className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-black">签证类型</span><select name="visa_type" defaultValue={visaType} className="app-input w-full rounded-xl border px-3 py-2 text-sm font-bold"><option value="d4_language">语言研修签证</option><option value="d2_bachelor">本科签证</option><option value="d2_master">硕士签证</option><option value="d2_doctor">博士签证</option></select></label>
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-black"><CalendarDays size={13} />预计入境日期</span>
          <div className="grid grid-cols-3 gap-1.5">
            <select value={entryYear} onChange={(event) => setEntryYear(event.target.value)} className="app-input w-full rounded-xl border px-2 py-2 text-xs font-bold">
              <option value="">年</option>
              {ENTRY_YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={entryMonth} onChange={(event) => { setEntryMonth(event.target.value); setEntryDay(""); }} className="app-input w-full rounded-xl border px-2 py-2 text-xs font-bold">
              <option value="">月</option>
              {MONTHS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={entryDay} onChange={(event) => setEntryDay(event.target.value)} className="app-input w-full rounded-xl border px-2 py-2 text-xs font-bold">
              <option value="">日</option>
              {entryDayOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <input type="hidden" name="target_entry_date" value={computedEntryDate} />
        </div>
      </div>
      <div>
        <span className="mb-1 flex items-center gap-1.5 text-xs font-black"><MapPin size={13} />递签领区</span>
        <div className="grid grid-cols-2 gap-2">
          <select value={province} onChange={(event) => { setProvince(event.target.value); setCity(""); }} className="app-input w-full rounded-xl border px-2.5 py-2 text-xs font-bold">
            <option value="">选择省份</option>
            {CHINA_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={city} onChange={(event) => setCity(event.target.value)} disabled={!province} className="app-input w-full rounded-xl border px-2.5 py-2 text-xs font-bold disabled:opacity-50">
            <option value="">选择城市</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <input type="hidden" name="application_city" value={consulateValue} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--app-secondary-soft)", color: "var(--app-secondary)" }}>
        <span className="inline-flex items-center gap-1.5"><MapPin size={13} />当前递签领区：{consulateValue || "尚未选择"}</span>
        {province && !resolvedConsulate && <span className="text-[11px] font-bold" style={{ color: "var(--app-warm)" }}>该省份暂无匹配领馆，请联系顾问确认</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><ActionMessage status={state.status} message={state.message} /><button type="submit" disabled={pending} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--app-secondary)" }}><Save size={14} />{pending ? "正在保存…" : "保存基础信息"}</button></div>
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
