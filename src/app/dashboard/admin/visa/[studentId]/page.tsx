import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, FileSearch, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { VisaCaseAdminForm, VisaTaskReviewControls } from "../VisaAdminControls";

type StudentProfile = { id: string; full_name: string | null; email: string | null };
type VisaCase = { id: string; user_id: string; visa_type: string; case_status: string; target_entry_date: string | null; application_city: string | null; advisor_note: string | null; updated_at: string };
type VisaTask = { id: string; title: string; description: string | null; stage: string; status: string; student_note: string | null; admin_note: string | null; submission_version: number; submitted_at: string | null; reviewed_at: string | null; sort_order: number };

const VISA_TYPE_LABELS: Record<string, string> = { undecided: "签证类型待定", d2_degree: "学历课程签证", d4_language: "语言研修签证", d10_job: "求职签证", other: "其他签证类型" };
const CASE_STATUS_LABELS: Record<string, string> = { planning: "方案规划", preparing: "材料准备", ready_to_submit: "递签确认", submitted: "已经递签", additional_documents: "补充材料", approved: "审核通过", issued: "签证签发", closed: "流程结束" };
const STAGE_LABELS: Record<string, string> = { admission: "入学许可", identity: "身份材料", finance: "资金材料", application: "申请表格", appointment: "预约递交", submission: "正式递签", result: "结果查询", entry: "入境安排" };
const STATUS_LABELS: Record<string, string> = { pending: "未开始", in_progress: "准备中", submitted: "待审核", reviewing: "审核中", approved: "已确认", revision_required: "需要补充", blocked: "需要协助" };
const STATUS_TONES: Record<string, { color: string; soft: string }> = { pending: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" }, in_progress: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" }, submitted: { color: "var(--app-accent)", soft: "var(--app-accent-soft)" }, reviewing: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" }, approved: { color: "var(--app-success)", soft: "var(--app-success-soft)" }, revision_required: { color: "#d85b51", soft: "#fff0ed" }, blocked: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" } };

function formatDate(value: string | null) { if (!value) return "暂无记录"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "时间待确认"; return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }

export default async function StudentVisaManagementPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { supabase } = await requireAdmin();
  const [profileResult, caseResult, tasksResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", studentId).maybeSingle(),
    supabase.from("student_visa_cases").select("id, user_id, visa_type, case_status, target_entry_date, application_city, advisor_note, updated_at").eq("user_id", studentId).maybeSingle(),
    supabase.from("student_visa_tasks").select("id, title, description, stage, status, student_note, admin_note, submission_version, submitted_at, reviewed_at, sort_order").eq("user_id", studentId).order("sort_order", { ascending: true }),
  ]);
  if (caseResult.error || !caseResult.data) notFound();
  const visaCase = caseResult.data as VisaCase;
  const profile = (profileResult.data ?? { id: studentId, full_name: null, email: null }) as StudentProfile;
  const tasks = (tasksResult.data ?? []) as VisaTask[];
  const displayName = profile.full_name || "未填写姓名";
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
  const reviewCount = tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
  const supportCount = tasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length;

  return (
    <>
      <DashboardPageHeader title="学生签证档案" description="查看学生签证路线，处理任务审核并记录顾问意见。" />
      <div className="mx-auto w-full max-w-[1380px] space-y-5 p-4 sm:p-6"><Link href="/dashboard/admin/visa" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回签证学生列表</Link>
        <section className="app-card rounded-[2rem] border p-6 sm:p-7" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end), var(--app-success-soft))" }}><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] text-2xl font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span><div className="min-w-0"><h1 className="text-2xl font-black">{displayName}</h1><p className="app-muted-text mt-1 text-sm">{profile.email || `账号 …${studentId.slice(-6)}`}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{VISA_TYPE_LABELS[visaCase.visa_type] ?? "签证类型待定"}</span><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{CASE_STATUS_LABELS[visaCase.case_status] ?? visaCase.case_status}</span></div></div><div className="grid grid-cols-3 gap-2 lg:ml-auto lg:min-w-[360px]">{[["待审核", reviewCount, FileSearch], ["待处理", supportCount, TriangleAlert], ["已确认", approvedCount, CheckCircle2]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof FileSearch; return <div key={String(label)} className="app-card rounded-xl border p-3 text-center"><MetricIcon className="mx-auto" size={15} style={{ color: "var(--app-success)" }} /><p className="mt-1.5 text-xl font-black">{String(value)}</p><p className="app-muted-text text-[9px] font-black">{String(label)}</p></div>; })}</div></div></section>

        <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="app-muted-text text-xs font-black">整体跟进</p><h2 className="mt-1 text-lg font-black">签证档案管理</h2></div><div className="flex flex-wrap gap-3 text-[11px] app-muted-text">{visaCase.target_entry_date && <span className="inline-flex items-center gap-1"><Clock3 size={12} />计划入境 {visaCase.target_entry_date}</span>}{visaCase.application_city && <span className="inline-flex items-center gap-1"><MapPin size={12} />{visaCase.application_city}递签</span>}</div></div><VisaCaseAdminForm studentId={studentId} caseStatus={visaCase.case_status} advisorNote={visaCase.advisor_note} /></section>

        <section className="space-y-3">{tasks.map((task, index) => { const tone = STATUS_TONES[task.status] ?? STATUS_TONES.pending; return <article key={task.id} className="app-card rounded-[1.5rem] border p-4 sm:p-5"><div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_320px]"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{index + 1}</span><div><p className="app-muted-text text-[10px] font-black">{STAGE_LABELS[task.stage] ?? "签证准备"}</p><h2 className="mt-1 text-sm font-black">{task.title}</h2><span className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[task.status] ?? task.status}</span></div></div><div className="min-w-0 xl:border-l xl:px-4" style={{ borderColor: "var(--app-border-soft)" }}><p className="app-muted-text text-xs leading-5">{task.description}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text text-[10px] font-black">学生说明</p><p className="mt-1 text-xs leading-5">{task.student_note || "学生暂未填写说明"}</p></div><div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text text-[10px] font-black">审核记录</p><p className="mt-1 text-xs leading-5">{task.admin_note || "暂无审核意见"}</p></div></div><p className="app-muted-text mt-2 text-[10px]">提交 {task.submission_version} 次 · 最近提交 {formatDate(task.submitted_at)}</p></div><div className="xl:border-l xl:pl-4" style={{ borderColor: "var(--app-border-soft)" }}><VisaTaskReviewControls taskId={task.id} status={task.status} />{!["submitted", "reviewing"].includes(task.status) && <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5 app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}><ShieldCheck className="mt-0.5 shrink-0" size={14} />{task.status === "approved" ? "任务已经审核确认。" : task.status === "revision_required" ? "等待学生按意见补充后重新提交。" : task.status === "blocked" ? "学生标记需要协助，请及时联系。" : "学生正在准备，暂时无需审核。"}</div>}</div></div></article>; })}{tasks.length === 0 && <div className="app-card rounded-[1.5rem] border border-dashed p-12 text-center"><ShieldCheck className="mx-auto opacity-30" size={34} /><p className="mt-3 font-black">这名学生还没有签证任务</p></div>}</section>
      </div>
    </>
  );
}
