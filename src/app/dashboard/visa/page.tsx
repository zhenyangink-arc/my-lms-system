import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileSearch,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { canUseStudentFeature, normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardPageHeader } from "../DashboardPageHeader";
import {
  InitializeVisaWorkspaceButton,
  VisaCaseForm,
  VisaTaskForm,
} from "./VisaWorkspaceForms";

type VisaCase = {
  id: string;
  visa_type: string;
  case_status: string;
  target_entry_date: string | null;
  application_city: string | null;
  advisor_note: string | null;
  updated_at: string;
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

const VISA_TYPE_LABELS: Record<string, string> = {
  undecided: "暂未确定",
  d2_degree: "学历课程签证",
  d4_language: "语言研修签证",
  d10_job: "求职签证",
  other: "其他签证类型",
};

const CASE_STATUS_LABELS: Record<string, string> = {
  planning: "方案规划",
  preparing: "材料准备",
  ready_to_submit: "递签确认",
  submitted: "已经递签",
  additional_documents: "补充材料",
  approved: "审核通过",
  issued: "签证签发",
  closed: "流程结束",
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
  pending: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  in_progress: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  submitted: { color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
  reviewing: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  approved: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  revision_required: { color: "#d85b51", soft: "#fff0ed" },
  blocked: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
};

function TaskIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 size={19} />;
  if (status === "revision_required") return <RotateCcw size={19} />;
  if (status === "submitted" || status === "reviewing") return <FileSearch size={19} />;
  if (status === "blocked") return <AlertCircle size={19} />;
  return <CircleDashed size={19} />;
}

export default async function VisaPage() {
  const { supabase, user, profile } = await requireActiveUser();
  const tier = normalizeMembershipTier(profile?.membership_tier);
  const role = profile?.role ?? "student";
  const canEdit = canUseStudentFeature(role, tier, "visa_tasks");

  const [caseResult, tasksResult] = await Promise.all([
    supabase.from("student_visa_cases").select("id, visa_type, case_status, target_entry_date, application_city, advisor_note, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("student_visa_tasks").select("id, title, description, stage, status, due_date, student_note, admin_note, submission_version, submitted_at, sort_order").eq("user_id", user.id).order("sort_order", { ascending: true }),
  ]);

  const visaCase = caseResult.data as VisaCase | null;
  const tasks = (tasksResult.data ?? []) as VisaTask[];
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
  const reviewCount = tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
  const supportCount = tasks.filter((task) => ["blocked", "revision_required"].includes(task.status)).length;
  const progressPercent = tasks.length > 0 ? Math.round((approvedCount / tasks.length) * 100) : 0;
  const hasDatabaseError = Boolean(caseResult.error || tasksResult.error);

  return (
    <>
      <DashboardPageHeader title="签证准备" description="管理签证类型、准备任务、审核意见和入境前的每个关键节点。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-success-soft))" }}>
          <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><Sparkles size={14} />赴韩签证路线</span><h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">让递签前的每件事都有负责人和结果</h2><p className="app-muted-text mt-4 max-w-2xl text-sm leading-7">学生负责准备与提交，管理员负责审核、确认和退回补充。每次提交都会留下状态记录，避免遗漏关键步骤。</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{VISA_TYPE_LABELS[visaCase?.visa_type ?? "undecided"]}</span><span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{CASE_STATUS_LABELS[visaCase?.case_status ?? "planning"]}</span></div></div>
            <div className="app-card rounded-3xl border p-5"><div className="flex items-end justify-between"><div><p className="app-muted-text text-xs font-bold">签证准备度</p><p className="mt-1 text-4xl font-black">{progressPercent}%</p></div><ShieldCheck size={30} style={{ color: "var(--app-success)" }} /></div><div className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div><p className="app-muted-text mt-3 text-xs">管理员已确认 {approvedCount} / {tasks.length} 项</p></div>
          </div>
        </section>

        {hasDatabaseError && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>签证准备数据暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["全部任务", tasks.length, ClipboardCheck, "var(--app-secondary)"], ["等待审核", reviewCount, Clock3, "var(--app-accent)"], ["需要处理", supportCount, AlertCircle, "var(--app-warm)"], ["已经确认", approvedCount, CheckCircle2, "var(--app-success)"]].map(([label, value, Icon, color]) => { const MetricIcon = Icon as typeof ClipboardCheck; return <article key={String(label)} className="app-card rounded-2xl border p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="app-muted-text text-xs font-bold">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></div><MetricIcon size={21} style={{ color: String(color) }} /></div></article>; })}
        </section>

        {visaCase && <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="app-muted-text text-xs font-black">签证档案</p><h2 className="mt-1 text-lg font-black">基础办理信息</h2></div><div className="flex flex-wrap gap-2 text-[11px] font-bold app-muted-text">{visaCase.target_entry_date && <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />计划入境 {visaCase.target_entry_date}</span>}{visaCase.application_city && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{visaCase.application_city}递签</span>}</div></div>{canEdit ? <VisaCaseForm visaType={visaCase.visa_type} targetEntryDate={visaCase.target_entry_date} applicationCity={visaCase.application_city} /> : <p className="rounded-2xl px-4 py-3 text-sm font-bold app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>当前账号可以浏览签证路线，但没有修改权限。</p>}{visaCase.advisor_note && <div className="mt-4 rounded-2xl px-4 py-3 text-sm leading-6" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><b>顾问提醒：</b>{visaCase.advisor_note}</div>}</section>}

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="mb-5"><p className="app-muted-text text-xs font-black">办理路线</p><h2 className="mt-1 text-lg font-black">签证准备任务</h2></div>
          {tasks.length > 0 ? <div className="space-y-3">{tasks.map((task, index) => { const tone = STATUS_TONES[task.status] ?? STATUS_TONES.pending; return <article key={task.id} className="app-soft-card rounded-2xl border p-4"><div className="grid gap-4 xl:grid-cols-[minmax(240px,0.85fr)_minmax(220px,0.7fr)_minmax(360px,1.2fr)] xl:items-center"><div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: tone.color, backgroundColor: tone.soft }}><TaskIcon status={task.status} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="app-muted-text text-[10px] font-black">步骤 {index + 1} · {STAGE_LABELS[task.stage] ?? "签证准备"}</span><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[task.status] ?? task.status}</span></div><h3 className="mt-1.5 text-sm font-black">{task.title}</h3>{task.description && <p className="app-muted-text mt-1 text-xs leading-5">{task.description}</p>}</div></div><div className="xl:border-l xl:px-4" style={{ borderColor: "var(--app-border-soft)" }}>{task.admin_note ? <div className="rounded-xl px-3 py-2 text-xs leading-5" style={{ color: task.status === "revision_required" ? "var(--app-warm)" : "var(--app-secondary)", backgroundColor: task.status === "revision_required" ? "var(--app-warm-soft)" : "var(--app-secondary-soft)" }}><b>管理员意见：</b>{task.admin_note}</div> : <p className="app-muted-text text-xs">{task.student_note ? `我的备注：${task.student_note}` : "暂时没有补充说明"}</p>}{task.submission_version > 0 && <p className="app-muted-text mt-2 text-[10px]">已提交 {task.submission_version} 次</p>}</div><div className="xl:border-l xl:pl-4" style={{ borderColor: "var(--app-border-soft)" }}>{canEdit ? <VisaTaskForm taskId={task.id} status={task.status} studentNote={task.student_note} /> : <p className="rounded-xl px-3 py-2.5 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>当前账号仅可浏览此任务。</p>}</div></div></article>; })}</div> : <div className="app-soft-card flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed p-7 text-center"><ShieldCheck size={34} style={{ color: "var(--app-success)" }} /><p className="mt-4 text-base font-black">建立你的签证准备路线</p><p className="app-muted-text mt-2 max-w-md text-xs leading-6">系统会生成入学许可、护照、资金证明、申请表、递签和入境安排等标准任务。</p><div className="mt-5">{canEdit ? <InitializeVisaWorkspaceButton /> : <p className="rounded-xl px-4 py-3 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>请联系顾问开通签证准备权限。</p>}</div></div>}
        </section>
      </div>
    </>
  );
}
