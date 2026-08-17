import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileSearch,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { requireActiveUser } from "@/lib/auth";
import { canUseStudentFeature, normalizeMembershipTier } from "@/lib/student-permissions";
import { VisaCaseForm, VisaTaskForm } from "./VisaWorkspaceForms";
import { CollapsibleVisaCaseCard } from "./CollapsibleVisaCaseCard";
import { getVisaCaseStages } from "./visa-case-stages";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

type VisaCase = {
  id: string;
  source_target_id: string | null;
  visa_type: string;
  application_channel: string;
  case_status: string;
  target_entry_date: string | null;
  application_city: string | null;
  residence_province: string | null;
  residence_city: string | null;
  planned_entry_date: string | null;
  departure_province: string | null;
  departure_airport: string | null;
  arrival_region: string | null;
  arrival_airport: string | null;
  accommodation_status: string | null;
  airport_pickup_required: boolean | null;
  advisor_note: string | null;
  updated_at: string;
};

type VisaTarget = {
  id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
};

type VisaTask = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  status: string;
  due_date: string | null;
  student_note: string | null;
  admin_note: string | null;
  submission_version: number;
  submitted_at: string | null;
  sort_order: number;
};

type VisaTaskEvent = {
  id: number;
  task_id: string;
  event_type: string;
  note: string | null;
  created_at: string;
};

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

const APPLICATION_CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻中韩国领事馆递签证通道",
  korea_immigration: "韩国出入境返签证通道",
};

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学堂",
  bachelor_fresh: "大学 · 本科新入",
  bachelor_transfer: "大学 · 本科插班",
  master: "大学 · 硕士",
  doctor: "大学 · 博士",
};

const CASE_STATUS_LABELS: Record<string, string> = {
  admin_preparing: "管理员准备中",
  ready_to_submit: "材料邮寄发送回中国",
  planning: "材料抵达中国",
  preparing: "确认材料",
  submitted: "递交材料",
  additional_documents: "补充材料",
  issued: "签证签发",
};

const STAGE_LABELS: Record<string, string> = {
  admission: "入学许可",
  identity: "身份材料",
  finance: "资金材料",
  application: "申请表格",
  appointment: "预约递交",
  submission: "正式递签",
  result: "结果查询",
  entry: "入境安排",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "未开始",
  in_progress: "准备中",
  submitted: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "需要补充",
  blocked: "需要协助",
};

const STATUS_TONES: Record<string, { color: string; soft: string }> = {
  pending: { color: "var(--foreground-muted)", soft: "var(--surface-soft)" },
  in_progress: { color: "var(--support)", soft: "var(--support-surface)" },
  submitted: { color: "var(--primary)", soft: "var(--accent)" },
  reviewing: { color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  approved: { color: "var(--status-success)", soft: "var(--status-success-surface)" },
  revision_required: { color: "var(--destructive)", soft: "var(--surface-soft)" },
  blocked: { color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
};

const NOTIFICATION_LABELS: Record<string, string> = {
  review_started: "顾问开始审核",
  approved: "顾问确认通过",
  revision_requested: "顾问要求补充",
};

const EVENT_TIME_OPTIONS: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

function TaskIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 size={19} aria-hidden="true" />;
  if (status === "revision_required") return <RotateCcw size={19} aria-hidden="true" />;
  if (status === "submitted" || status === "reviewing") return <FileSearch size={19} aria-hidden="true" />;
  if (status === "blocked") return <AlertCircle size={19} aria-hidden="true" />;
  return <CircleDashed size={19} aria-hidden="true" />;
}

function VisaCaseProgress({ status, applicationChannel }: { status: string; applicationChannel: string }) {
  const steps = getVisaCaseStages(applicationChannel);
  const currentStep = Math.max(0, steps.findIndex((step) => step.status === status));
  return (
    <div className="mt-4 overflow-x-auto" role="progressbar" aria-label={`签证进度：${CASE_STATUS_LABELS[status] ?? "材料抵达中国"}`} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentStep + 1}>
      <div className="flex min-w-[420px] items-start">
        {steps.map((step, index) => {
          const completed = index < currentStep;
          const current = index === currentStep;
          return <div key={step.status} className="relative flex flex-1 flex-col items-center text-center">{index < steps.length - 1 && <span aria-hidden="true" className="absolute left-1/2 top-3 h-0.5 w-full" style={{ backgroundColor: index < currentStep ? "var(--status-success)" : "var(--border)" }} />}<span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ color: completed || current ? "var(--primary-foreground)" : "var(--foreground-muted)", backgroundColor: completed ? "var(--status-success)" : current ? "var(--support)" : "var(--card)", borderColor: completed ? "var(--status-success)" : current ? "var(--support)" : "var(--border)" }}>{completed ? <CheckCircle2 size={13} aria-hidden="true" /> : index + 1}</span><span className="mt-2 max-w-[60px] text-[10px] font-bold leading-4" style={{ color: current ? "var(--support)" : completed ? "var(--status-success)" : "var(--foreground-muted)" }}>{step.label}</span></div>;
        })}
      </div>
    </div>
  );
}

export default async function VisaPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user, profile } = await requireActiveUser();
  const tier = normalizeMembershipTier(profile?.membership_tier);
  const role = profile?.role ?? "student";
  const canEdit = canUseStudentFeature(role, tier, "visa_tasks");

  const [caseResult, tasksResult, eventsResult, eligibilityResult] = await Promise.all([
    supabase.from("student_visa_cases").select("id, source_target_id, visa_type, application_channel, case_status, target_entry_date, application_city, residence_province, residence_city, planned_entry_date, accommodation_status, airport_pickup_required, departure_province, departure_airport, arrival_region, arrival_airport, advisor_note, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_visa_tasks").select("id, title, description, stage, status, due_date, student_note, admin_note, submission_version, submitted_at, sort_order").eq("user_id", user.id).eq("is_archived", false).order("sort_order", { ascending: true }),
    supabase.from("student_visa_task_events").select("id, task_id, event_type, note, created_at").eq("user_id", user.id).in("event_type", ["review_started", "approved", "revision_requested"]).order("created_at", { ascending: false }).limit(6),
    supabase.from("student_university_targets").select("id, university_name, program_name, admission_track").eq("user_id", user.id).gte("application_stage", 9),
  ]);

  const visaCase = caseResult.data as VisaCase | null;
  const eligibleTargets = (eligibilityResult.data ?? []) as VisaTarget[];
  const visaTarget = eligibleTargets.find((target) => target.id === visaCase?.source_target_id) ?? eligibleTargets[0] ?? null;
  const tasks = (tasksResult.data ?? []) as VisaTask[];
  const notifications = (eventsResult.data ?? []) as VisaTaskEvent[];
  const taskTitleById = new Map(tasks.map((task) => [task.id, task.title]));
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
  const reviewCount = tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
  const supportCount = tasks.filter((task) => ["blocked", "revision_required"].includes(task.status)).length;
  const progressPercent = tasks.length > 0 ? Math.round((approvedCount / tasks.length) * 100) : 0;
  const visaUnlocked = visaTarget !== null;
  const hasDatabaseError = Boolean(caseResult.error || tasksResult.error || eventsResult.error || eligibilityResult.error);
  const displayName = profile?.full_name || "未填写姓名";

  if (!visaUnlocked || !visaCase || params.case !== visaCase.id) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {hasDatabaseError && <section role="alert" className="rounded-2xl border p-4" style={{ color: "var(--destructive)", backgroundColor: "var(--surface-soft)", borderColor: "var(--destructive)" }}><h2 className="text-sm font-bold">签证准备数据暂时无法读取</h2><p className="mt-1 text-sm leading-6">请稍后刷新页面；当前状态不是“尚未生成签证卡片”。</p></section>}

        {!hasDatabaseError && (visaTarget && visaCase ? (
          <section className="grid gap-4 2xl:grid-cols-2">
            <article className="app-card rounded-3xl border p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{CASE_STATUS_LABELS[visaCase.case_status] ?? visaCase.case_status}<ArrowRight size={11} aria-hidden="true" /></span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{displayName}的签证申请</h2><Link href={`/dashboard/visa?case=${visaCase.id}`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 ${focusRing}`} style={{ backgroundColor: "var(--support)" }}>查看<ArrowRight size={13} aria-hidden="true" /></Link></div>
              <p className="app-muted-text mt-1 text-xs font-bold">{user.email || "账号邮箱待完善"}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{visaTarget.university_name}</span>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{ADMISSION_TRACK_LABELS[visaTarget.admission_track ?? ""] ?? "大学"}{visaTarget.program_name ? ` · ${visaTarget.program_name}` : ""}</span>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>{VISA_TYPE_LABELS[visaCase.visa_type] ?? "签证类型待确认"}</span>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}>{APPLICATION_CHANNEL_LABELS[visaCase.application_channel] ?? "办理通道待确认"}</span>
              </div>
              <VisaCaseProgress status={visaCase.case_status} applicationChannel={visaCase.application_channel} />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-bold">{tasks.length}</p><p className="app-muted-text text-xs">准备任务</p></div>
                <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-bold">{reviewCount}</p><p className="app-muted-text text-xs">等待审核</p></div>
                <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-bold">{approvedCount}</p><p className="app-muted-text text-xs">已确认</p></div>
              </div>
              <div role="progressbar" aria-label="签证任务完成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}><div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: "var(--status-success)" }} /></div>
              <div className="app-muted-text mt-3 flex items-center justify-between text-xs font-bold"><span>完成进度 {progressPercent}%</span><span>{visaCase.target_entry_date ? `最晚入境 ${visaCase.target_entry_date}` : "最晚入境日期待确认"}</span></div>
            </article>
          </section>
        ) : (
          <section className="app-card flex min-h-64 flex-col items-center justify-center rounded-3xl border p-6 text-center">
            <ShieldCheck size={32} style={{ color: "var(--status-success)" }} aria-hidden="true" />
            <h2 className="mt-4 text-base font-bold">签证卡片尚未生成</h2>
            <p className="app-muted-text mt-2 max-w-md text-xs leading-5">申请进度到第 9 步“请进入申请签证页面”后，即可开始准备签证。</p>
          </section>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/visa" className={`app-muted-text inline-flex items-center gap-2 rounded-lg text-xs font-bold ${focusRing}`}><ArrowLeft size={14} aria-hidden="true" />返回签证卡片</Link>
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--accent), var(--card), var(--status-success-surface))" }}>
          <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_220px_360px]">
            <div><DashboardTitleWithHint headingLevel={2} titleClassName="text-2xl font-bold tracking-tight" title={<>签证准备总览</>} description={<>学生负责准备与提交，管理员负责审核、确认或退回补充。</>} /><div className="mt-5 flex flex-wrap gap-2">{visaCase ? <><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{VISA_TYPE_LABELS[visaCase.visa_type]}</span><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}>{APPLICATION_CHANNEL_LABELS[visaCase.application_channel]}</span><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{CASE_STATUS_LABELS[visaCase.case_status]}</span></> : <span className="rounded-full px-3 py-1.5 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}>等待标准入学许可书</span>}</div></div><div className="grid grid-cols-2 gap-2"><p className="app-soft-card rounded-lg border px-2 py-1.5 text-center text-xs font-bold"><b className="block text-base leading-none">{tasks.length}</b><span className="app-muted-text mt-1 block">全部任务</span></p><p className="app-soft-card rounded-lg border px-2 py-1.5 text-center text-xs font-bold"><b className="block text-base leading-none">{reviewCount}</b><span className="app-muted-text mt-1 block">等待审核</span></p><p className="app-soft-card rounded-lg border px-2 py-1.5 text-center text-xs font-bold"><b className="block text-base leading-none">{supportCount}</b><span className="app-muted-text mt-1 block">需要处理</span></p><p className="app-soft-card rounded-lg border px-2 py-1.5 text-center text-xs font-bold"><b className="block text-base leading-none">{approvedCount}</b><span className="app-muted-text mt-1 block">已经确认</span></p></div>
            <div className="app-card rounded-3xl border p-5"><div className="flex items-end justify-between"><div><p className="app-muted-text text-xs font-bold">签证准备度</p><p className="mt-1 text-2xl font-bold">{progressPercent}%</p></div><ShieldCheck size={30} style={{ color: "var(--status-success)" }} aria-hidden="true" /></div><div role="progressbar" aria-label="签证准备度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}><div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, var(--support), var(--status-success))" }} /></div><p className="app-muted-text mt-3 text-xs">管理员已确认 {approvedCount} / {tasks.length} 项</p></div>
          </div>
        </section>

        {hasDatabaseError && <section role="alert" className="rounded-2xl border p-4" style={{ color: "var(--destructive)", backgroundColor: "var(--surface-soft)", borderColor: "var(--destructive)" }}><h2 className="text-sm font-bold">签证准备数据暂时无法完整读取</h2><p className="mt-1 text-sm leading-6">请稍后刷新页面；部分任务或通知可能暂时缺失。</p></section>}

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(320px,1fr)_minmax(320px,1.1fr)]">
          <div className="space-y-4">
            <div className="app-card rounded-2xl border p-5">
              <div className="flex items-center gap-2"><Bell size={18} style={{ color: "var(--support)" }} aria-hidden="true" /><h2 className="text-base font-bold">通知区域</h2></div>
              <div className="mt-3.5 max-h-[200px] space-y-3 overflow-y-auto pr-1">
                {notifications.map((event) => (
                  <div key={event.id} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.event_type === "revision_requested" ? "var(--status-warning)" : event.event_type === "approved" ? "var(--status-success)" : "var(--primary)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-5">{NOTIFICATION_LABELS[event.event_type] ?? "顾问更新了"}：{taskTitleById.get(event.task_id) ?? "签证任务"}</p>
                      {event.event_type === "revision_requested" && event.note && <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--status-warning)" }}>{event.note}</p>}
                      <p className="app-muted-text mt-0.5 text-xs"><LocalDateTime value={event.created_at} options={EVENT_TIME_OPTIONS} fallback="时间待确认" /></p>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && <p className="app-muted-text text-sm leading-5">暂无最新审核动态，顾问处理后会在这里提醒你。</p>}
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-3">
              {[["全部任务", tasks.length, ClipboardCheck, "var(--support)", "var(--support-surface)"], ["等待审核", reviewCount, Clock3, "var(--primary)", "var(--accent)"], ["需要处理", supportCount, AlertCircle, "var(--status-warning)", "var(--status-warning-surface)"], ["已经确认", approvedCount, CheckCircle2, "var(--status-success)", "var(--status-success-surface)"]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof ClipboardCheck; return <article key={String(label)} className="app-card flex items-center gap-2.5 rounded-xl border px-3 py-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><div className="min-w-0"><p className="app-muted-text text-sm font-bold">{String(label)}</p><p className="text-2xl font-bold leading-none">{String(value)}</p></div></article>; })}
            </div>
          </div>

          {visaCase ? (
            <CollapsibleVisaCaseCard targetEntryDate={visaCase.target_entry_date}>{canEdit ? <VisaCaseForm visaType={visaCase.visa_type} applicationChannel={visaCase.application_channel} targetEntryDate={visaCase.target_entry_date} applicationCity={visaCase.application_city} residenceProvince={visaCase.residence_province} residenceCity={visaCase.residence_city} plannedEntryDate={visaCase.planned_entry_date} departureProvince={visaCase.departure_province} departureAirport={visaCase.departure_airport} arrivalRegion={visaCase.arrival_region} arrivalAirport={visaCase.arrival_airport} accommodationStatus={visaCase.accommodation_status} airportPickupRequired={visaCase.airport_pickup_required} /> : <p className="rounded-xl px-3 py-2.5 text-sm font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}>当前账号可以浏览签证路线，但没有修改权限。</p>}{visaCase.advisor_note && <div className="mt-3 rounded-xl px-3 py-2.5 text-sm leading-6" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}><b>顾问提醒：</b>{visaCase.advisor_note}</div>}</CollapsibleVisaCaseCard>
          ) : (
            <div className="app-card flex items-center justify-center rounded-2xl border border-dashed p-5 text-center text-xs font-bold app-muted-text">申请资料审核完成并颁发标准入学许可书后，即可开始准备签证。</div>
          )}
        </section>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <h2 className="mb-5 text-lg font-bold">签证准备任务</h2>
          {tasks.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tasks.map((task, index) => { const tone = STATUS_TONES[task.status] ?? STATUS_TONES.pending; return <article key={task.id} className="app-soft-card rounded-xl border p-3"><div className="flex min-w-0 items-start gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}><TaskIcon status={task.status} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="app-muted-text text-xs font-bold">步骤 {index + 1} · {STAGE_LABELS[task.stage] ?? "签证准备"}</span><span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[task.status] ?? task.status}</span></div><h3 className="mt-1 text-sm font-bold">{task.title}</h3>{task.description && <p className="app-muted-text mt-1 text-xs leading-5">{task.description}</p>}</div></div><div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>{task.admin_note ? <div className="rounded-lg px-2.5 py-1.5 text-xs leading-5" style={{ color: task.status === "revision_required" ? "var(--status-warning)" : "var(--support)", backgroundColor: task.status === "revision_required" ? "var(--status-warning-surface)" : "var(--support-surface)" }}><b>管理员意见：</b>{task.admin_note}</div> : <p className="app-muted-text text-xs">{task.student_note ? `我的备注：${task.student_note}` : "暂时没有补充说明"}</p>}{task.submission_version > 0 && <p className="app-muted-text mt-1.5 text-xs">已提交 {task.submission_version} 次</p>}</div><div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--border-subtle)" }}>{canEdit ? <VisaTaskForm taskId={task.id} status={task.status} studentNote={task.student_note} /> : <p className="rounded-lg px-2.5 py-2 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--surface-soft)" }}>当前账号仅可浏览此任务。</p>}</div></article>; })}</div> : <div className="app-soft-card flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center"><ShieldCheck size={34} style={{ color: "var(--status-success)" }} aria-hidden="true" /><p className="mt-4 text-base font-bold">等待进入签证准备阶段</p><p className="app-muted-text mt-2 max-w-md text-xs leading-5">资料审核完成并颁发标准入学许可书后，开始准备入学许可、护照、资金证明、递签和入境安排。</p></div>}
        </section>
      </div>
    </>
  );
}
