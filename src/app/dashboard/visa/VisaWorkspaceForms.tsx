"use client";

import { useActionState, useState } from "react";
import { Building2, CalendarDays, Check, House, Landmark, MapPin, PlaneLanding, PlaneTakeoff, Save, Send } from "lucide-react";

import { ChineseDateInput } from "@/components/ChineseDateInput";
import { CHINA_PROVINCES, CHINA_REGION_CITIES } from "../profile/china-cities";
import { updateVisaCaseAction, updateVisaTaskAction } from "./actions";
import { getConsulateForProvince } from "./consulate-jurisdictions";
import { CHINA_PROVINCE_AIRPORTS, CHINA_AIRPORT_PROVINCES } from "./china-airports";
import { KOREA_REGION_AIRPORTS, KOREA_AIRPORT_REGIONS } from "./korea-airports";
import { initialVisaActionState } from "./visa-action-state";

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

function ActionMessage({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return <p role={status === "success" ? "status" : "alert"} className="rounded-xl px-3 py-2 text-xs font-bold" style={status === "success" ? { color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" } : { color: "var(--destructive)", backgroundColor: "var(--surface-soft)" }}>{message}</p>;
}

export function VisaCaseForm({
  visaType,
  applicationChannel,
  targetEntryDate,
  applicationCity,
  residenceProvince,
  residenceCity,
  plannedEntryDate,
  departureProvince,
  departureAirport,
  arrivalRegion,
  arrivalAirport,
  accommodationStatus,
  airportPickupRequired,
}: {
  visaType: string;
  applicationChannel: string;
  targetEntryDate: string | null;
  applicationCity: string | null;
  residenceProvince: string | null;
  residenceCity: string | null;
  plannedEntryDate: string | null;
  departureProvince: string | null;
  departureAirport: string | null;
  arrivalRegion: string | null;
  arrivalAirport: string | null;
  accommodationStatus: string | null;
  airportPickupRequired: boolean | null;
}) {
  const [state, action, pending] = useActionState(updateVisaCaseAction, initialVisaActionState);
  const [province, setProvince] = useState(residenceProvince ?? "");
  const [city, setCity] = useState(residenceCity ?? "");
  const cities = province ? CHINA_REGION_CITIES[province] ?? [] : [];
  const resolvedConsulate = province ? getConsulateForProvince(province) : null;
  const consulateValue = resolvedConsulate ?? applicationCity ?? "";

  const [entryDate, setEntryDate] = useState(plannedEntryDate ?? "");
  const [depProvince, setDepProvince] = useState(departureProvince ?? "");
  const [depAirport, setDepAirport] = useState(departureAirport ?? "");
  const depAirports = depProvince ? CHINA_PROVINCE_AIRPORTS[depProvince] ?? [] : [];
  const [arrRegion, setArrRegion] = useState(arrivalRegion ?? "");
  const [arrAirport, setArrAirport] = useState(arrivalAirport ?? "");
  const arrAirports = arrRegion ? KOREA_REGION_AIRPORTS[arrRegion] ?? [] : [];
  const [accommodation, setAccommodation] = useState(accommodationStatus ?? "");
  const [airportPickup, setAirportPickup] = useState(airportPickupRequired === null ? "" : airportPickupRequired ? "required" : "not_required");

  return (
    <form action={action} className="space-y-2.5">
      <div>
        <span className="mb-1 block text-xs font-bold">签证办理通道</span>
        <p className="app-muted-text mb-2 text-xs font-bold">办理通道由管理员确认，学生端仅可查看，不能切换。</p>
        <div className="grid gap-2.5 lg:grid-cols-2">
          <div aria-disabled="true" className="flex cursor-not-allowed items-start gap-3 rounded-2xl border p-4 opacity-60" style={applicationChannel === "china_consulate" ? { color: "var(--support)", borderColor: "var(--support)", backgroundColor: "var(--support-surface)", opacity: 1 } : { borderColor: "var(--border-subtle)", backgroundColor: "var(--card)" }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}><Landmark size={18} aria-hidden="true" /></span>
            <span><b className="block text-sm">驻中韩国领事馆递签证通道</b><span className="app-muted-text mt-1 block text-xs leading-5">学生在中国按户籍或常住地区所属领区，向韩国领事馆递交签证材料。</span></span>
          </div>
          <div aria-disabled="true" className="flex cursor-not-allowed items-start gap-3 rounded-2xl border p-4 opacity-60" style={applicationChannel === "korea_immigration" ? { color: "var(--status-success)", borderColor: "var(--status-success)", backgroundColor: "var(--status-success-surface)", opacity: 1 } : { borderColor: "var(--border-subtle)", backgroundColor: "var(--card)" }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}><Building2 size={18} aria-hidden="true" /></span>
            <span><b className="block text-sm">韩国出入境返签证通道</b><span className="app-muted-text mt-1 block text-xs leading-5">由韩国学校或相关机构向韩国出入境管理机关提交返签证申请。</span></span>
          </div>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="mb-1 block text-xs font-bold">签证类型</span>
          <p className="app-soft-card rounded-xl border px-3 py-2 text-sm font-bold">{VISA_TYPE_LABELS[visaType] ?? "管理员待确认"}</p>
        </div>
        <div>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold"><CalendarDays size={13} aria-hidden="true" />最晚入境日期</span>
          <p className="app-soft-card rounded-xl border px-3 py-2 text-sm font-bold">{targetEntryDate ?? "管理员待确认"}</p>
        </div>
      </div>
      {applicationChannel === "china_consulate" ? <fieldset>
        <legend className="mb-1 flex items-center gap-1.5 text-xs font-bold"><MapPin size={13} aria-hidden="true" />递签领区</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-bold">省份
          <select name="residence_province" value={province} onChange={(event) => { setProvince(event.target.value); setCity(""); }} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
            <option value="">选择省份</option>
            {CHINA_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <label className="text-xs font-bold">城市
          <select name="residence_city" value={city} onChange={(event) => setCity(event.target.value)} disabled={!province} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:opacity-50">
            <option value="">选择城市</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
        </div>
      </fieldset> : <div className="flex items-start gap-2 rounded-xl px-3 py-3 text-xs font-bold leading-5" style={{ backgroundColor: "var(--status-success-surface)", color: "var(--status-success)" }}><Building2 className="mt-0.5 shrink-0" size={14} aria-hidden="true" />此通道不需要选择中国领区，具体受理机关与返签证编号由学校或顾问通知。</div>}
      <input type="hidden" name="application_channel" value={applicationChannel} />
      <input type="hidden" name="application_city" value={applicationChannel === "china_consulate" ? consulateValue : ""} />
      {applicationChannel === "china_consulate" && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold" style={{ backgroundColor: "var(--support-surface)", color: "var(--support)" }}>
        <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden="true" />当前递签领区：{consulateValue || "尚未选择"}</span>
        {province && !resolvedConsulate && <span className="text-xs font-bold" style={{ color: "var(--status-warning)" }}>该省份暂无匹配领馆，请联系顾问确认</span>}
      </div>}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold"><CalendarDays size={13} aria-hidden="true" />预计入境时间</span>
          <ChineseDateInput name="planned_entry_date" value={entryDate} onChange={setEntryDate} max={targetEntryDate ?? undefined} placeholder="选择预计入境日期" />
          {targetEntryDate && <p className="app-muted-text mt-1 text-xs font-bold">预计入境日期不能晚于 {targetEntryDate}</p>}
        </label>
        <label>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold"><House size={13} aria-hidden="true" />住宿安排状态</span>
          <select name="accommodation_status" value={accommodation} onChange={(event) => setAccommodation(event.target.value)} className="app-input w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
            <option value="">请选择住宿安排</option>
            <option value="on_campus_dormitory">校内宿舍</option>
            <option value="off_campus_dormitory">校外宿舍</option>
            <option value="rental">租房</option>
          </select>
        </label>
        <label>
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold"><PlaneLanding size={13} aria-hidden="true" />接机服务</span>
          <select name="airport_pickup_service" value={airportPickup} onChange={(event) => setAirportPickup(event.target.value)} className="app-input w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
            <option value="">请选择是否需要接机</option>
            <option value="required">需要</option>
            <option value="not_required">不需要</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 flex items-center gap-1.5 text-xs font-bold"><PlaneTakeoff size={13} aria-hidden="true" />出境机场</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold">省份<select name="departure_province" value={depProvince} onChange={(event) => { setDepProvince(event.target.value); setDepAirport(""); }} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
              <option value="">选择省份</option>
              {CHINA_AIRPORT_PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
            <label className="text-xs font-bold">机场<select name="departure_airport" value={depAirport} onChange={(event) => setDepAirport(event.target.value)} disabled={!depProvince} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:opacity-50">
              <option value="">选择机场</option>
              {depAirports.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 flex items-center gap-1.5 text-xs font-bold"><PlaneLanding size={13} aria-hidden="true" />到达机场</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold">地区<select name="arrival_region" value={arrRegion} onChange={(event) => { setArrRegion(event.target.value); setArrAirport(""); }} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
              <option value="">选择地区</option>
              {KOREA_AIRPORT_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
            <label className="text-xs font-bold">机场<select name="arrival_airport" value={arrAirport} onChange={(event) => setArrAirport(event.target.value)} disabled={!arrRegion} className="app-input mt-1 w-full rounded-xl border px-2.5 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:opacity-50">
              <option value="">选择机场</option>
              {arrAirports.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><ActionMessage status={state.status} message={state.message} /><button type="submit" disabled={pending} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--support)" }}><Save size={14} aria-hidden="true" />{pending ? "正在保存…" : "保存基础信息"}</button></div>
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
    return <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}><Check className="mt-0.5 shrink-0" size={14} aria-hidden="true" />{LOCKED_STATUS_TEXT[status]}</div>;
  }

  return (
    <form action={action} className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs font-bold">任务状态<select name="status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="app-input mt-1 w-full rounded-xl border px-3 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">{statusOptions(status).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-bold">准备说明<input name="student_note" defaultValue={studentNote ?? ""} maxLength={400} placeholder={status === "revision_required" ? "说明本次补充内容" : "填写准备情况或需要协助的问题"} className="app-input mt-1 w-full min-w-0 rounded-xl border px-3 py-2.5 text-xs font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" /></label>
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: selectedStatus === "submitted" ? "var(--status-success)" : "var(--primary)" }}>{selectedStatus === "submitted" ? <Send size={13} aria-hidden="true" /> : <Save size={13} aria-hidden="true" />}{pending ? "保存中…" : selectedStatus === "submitted" ? "提交审核" : "保存"}</button>
      </div>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
