import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { requireVisaManager } from "@/lib/visa-management";
import { StudentModuleCardDeleteDialog } from "../../StudentModuleCardDeleteDialog";
import { deleteStudentVisaCardAction } from "../actions";
import { VisaCaseAdminForm, VisaTaskReviewControls } from "../VisaAdminControls";
import { getVisaCaseStatusLabel } from "../../../visa/visa-case-stages";

type StudentProfile = { id: string; full_name: string | null; email: string | null };
type VisaCase = {
  id: string;
  user_id: string;
  source_target_id: string | null;
  visa_type: string;
  application_channel: string;
  case_status: string;
  target_entry_date: string | null;
  application_city: string | null;
  residence_province: string | null;
  residence_city: string | null;
  planned_entry_date: string | null;
  accommodation_status: string | null;
  airport_pickup_required: boolean | null;
  departure_province: string | null;
  departure_airport: string | null;
  arrival_region: string | null;
  arrival_airport: string | null;
  advisor_note: string | null;
  updated_at: string;
};
type VisaTask = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  status: string;
  student_note: string | null;
  admin_note: string | null;
  submission_version: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  sort_order: number;
};
type VisaTarget = { id: string; university_name: string; program_name: string | null; admission_track: string | null };

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};
const CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻华韩国领事馆递签",
  korea_immigration: "韩国出入境返签证",
};
const TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
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
const ACCOMMODATION_LABELS: Record<string, string> = {
  on_campus_dormitory: "校内宿舍",
  off_campus_dormitory: "校外宿舍",
  rental: "租房",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function taskTone(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "revision_required" || status === "blocked") return "bg-rose-50 text-rose-700";
  if (status === "submitted" || status === "reviewing") return "bg-amber-50 text-amber-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  return "bg-zinc-100 text-zinc-500";
}

export default async function StudentVisaManagementPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { supabase, tenantId } = await requireVisaManager();
  const [profileResult, caseResult, tasksResult, eligibilityResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email").eq("id", studentId).maybeSingle(),
    supabase
      .from("student_visa_cases")
      .select("id,user_id,source_target_id,visa_type,application_channel,case_status,target_entry_date,application_city,residence_province,residence_city,planned_entry_date,accommodation_status,airport_pickup_required,departure_province,departure_airport,arrival_region,arrival_airport,advisor_note,updated_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_visa_tasks")
      .select("id,title,description,stage,status,student_note,admin_note,submission_version,submitted_at,reviewed_at,sort_order")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("id,university_name,program_name,admission_track")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .gte("application_stage", 9),
  ]);

  const eligibleTargets = (eligibilityResult.data ?? []) as VisaTarget[];
  const visaTarget =
    eligibleTargets.find((target) => target.id === caseResult.data?.source_target_id) ??
    eligibleTargets[0] ??
    null;
  if (caseResult.error || !caseResult.data || eligibilityResult.error || !visaTarget) notFound();

  const visaCase = caseResult.data as VisaCase;
  const profile = (profileResult.data ?? { id: studentId, full_name: null, email: null }) as StudentProfile;
  const tasks = (tasksResult.data ?? []) as VisaTask[];
  const displayName = profile.full_name || profile.email || "未填写姓名";
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
  const reviewCount = tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
  const supportCount = tasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length;

  const entryRows = [
    ["最晚入境", visaCase.target_entry_date ?? "待确认"],
    ["预计入境", visaCase.planned_entry_date ?? "待填写"],
    ["住宿安排", visaCase.accommodation_status ? ACCOMMODATION_LABELS[visaCase.accommodation_status] ?? visaCase.accommodation_status : "待填写"],
    ["接机服务", visaCase.airport_pickup_required === null ? "待填写" : visaCase.airport_pickup_required ? "需要" : "不需要"],
    ["户籍 / 常住地", [visaCase.residence_province, visaCase.residence_city].filter(Boolean).join(" · ") || "待填写"],
    ["递签领区", visaCase.application_city ? `${visaCase.application_city}递签` : "待确认"],
    ["出境安排", [visaCase.departure_province, visaCase.departure_airport].filter(Boolean).join(" · ") || "待填写"],
    ["到达安排", [visaCase.arrival_region, visaCase.arrival_airport].filter(Boolean).join(" · ") || "待填写"],
  ];

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/dashboard/admin/visa" className="inline-flex items-center gap-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-950">
            <ArrowLeft size={13} />返回签证管理
          </Link>
          <StudentModuleCardDeleteDialog
            action={deleteStudentVisaCardAction.bind(null, studentId)}
            studentName={displayName}
            cardLabel="签证档案"
            description="将永久清空签证档案、全部准备任务和审核记录。"
          />
        </div>

        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">学生签证案件 / {studentId.slice(-8)}</p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">{displayName}</h1>
              <p className="mt-1 text-[11px] text-zinc-500">{profile.email || "未填写邮箱"}</p>
            </div>
            <dl className="flex flex-wrap items-center gap-y-2 text-[10px]">
              {[
                ["任务", tasks.length, "text-zinc-950"],
                ["等待审核", reviewCount, "text-amber-700"],
                ["补件 / 协助", supportCount, "text-rose-700"],
                ["已经确认", approvedCount, "text-emerald-700"],
              ].map(([label, value, color], index) => (
                <div key={String(label)} className={`min-w-[90px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className={`mt-0.5 font-mono text-base font-medium tabular-nums ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="overflow-x-auto border-b border-black/[0.08]">
            <table className="w-full min-w-[1120px] border-collapse text-left text-[10px]">
              <thead><tr className="h-9 border-b border-black/[0.07] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-400"><th className="px-4 font-medium">申请院校</th><th className="px-4 font-medium">申请项目</th><th className="px-4 font-medium">签证类型</th><th className="px-4 font-medium">办理通道</th><th className="px-4 font-medium">当前阶段</th><th className="px-4 font-medium">最近更新</th></tr></thead>
              <tbody><tr className="h-12"><td className="px-4 font-medium text-zinc-900">{visaTarget.university_name}</td><td className="px-4 text-zinc-600">{TRACK_LABELS[visaTarget.admission_track ?? ""] ?? "项目待确认"}{visaTarget.program_name ? ` · ${visaTarget.program_name}` : ""}</td><td className="px-4 text-zinc-600">{VISA_TYPE_LABELS[visaCase.visa_type] ?? visaCase.visa_type}</td><td className="px-4 text-zinc-600">{CHANNEL_LABELS[visaCase.application_channel] ?? visaCase.application_channel}</td><td className="px-4 font-medium text-amber-700">{getVisaCaseStatusLabel(visaCase.application_channel, visaCase.case_status)}</td><td className="px-4 font-mono text-zinc-400">{formatDate(visaCase.updated_at)}</td></tr></tbody>
            </table>
          </div>

          <div className="border-b border-black/[0.08] px-5 py-4">
            <div className="mb-3 flex items-center gap-2"><ShieldCheck size={13} className="text-zinc-400" /><h2 className="text-[11px] font-medium text-zinc-900">整体办理设置</h2></div>
            <VisaCaseAdminForm
              studentId={studentId}
              visaType={visaCase.visa_type}
              applicationChannel={visaCase.application_channel}
              targetEntryDate={visaCase.target_entry_date}
              caseStatus={visaCase.case_status}
              advisorNote={visaCase.advisor_note}
            />
          </div>

          <div className="overflow-x-auto border-b border-black/[0.08]">
            <table className="w-full min-w-[1000px] border-collapse text-left text-[10px]">
              <thead><tr className="h-9 border-b border-black/[0.07] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-400"><th colSpan={4} className="px-4 font-medium">学生填写的入境与安置信息</th></tr></thead>
              <tbody>
                {[entryRows.slice(0, 4), entryRows.slice(4)].map((row, rowIndex) => (
                  <tr key={rowIndex} className="h-12 border-b border-black/[0.05] last:border-b-0">
                    {row.map(([label, value]) => <td key={label} className="w-1/4 border-r border-black/[0.05] px-4 last:border-r-0"><span className="block text-[8px] text-zinc-400">{label}</span><span className="mt-0.5 block font-medium text-zinc-700">{value}</span></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] border-collapse text-left text-[10px]">
              <thead>
                <tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-400">
                  <th className="w-10 px-3 text-right font-medium">#</th>
                  <th className="w-[120px] px-3 font-medium">任务阶段</th>
                  <th className="w-[220px] px-3 font-medium">任务</th>
                  <th className="w-[100px] px-3 font-medium">状态</th>
                  <th className="w-[260px] px-3 font-medium">学生说明</th>
                  <th className="w-[260px] px-3 font-medium">审核记录</th>
                  <th className="w-[130px] px-3 font-medium">提交信息</th>
                  <th className="w-[250px] px-5 font-medium">审核操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => (
                  <tr key={task.id} className="border-b border-black/[0.07] align-top last:border-b-0">
                    <td className="px-3 py-4 text-right font-mono text-zinc-400">{index + 1}</td>
                    <td className="px-3 py-4 text-zinc-500">{STAGE_LABELS[task.stage] ?? task.stage}</td>
                    <td className="px-3 py-4"><p className="font-medium text-zinc-900">{task.title}</p><p className="mt-1 text-[9px] leading-4 text-zinc-400">{task.description || "—"}</p></td>
                    <td className="px-3 py-4"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${taskTone(task.status)}`}>{STATUS_LABELS[task.status] ?? task.status}</span></td>
                    <td className="px-3 py-4 leading-5 text-zinc-600">{task.student_note || "—"}</td>
                    <td className="px-3 py-4 leading-5 text-zinc-600">{task.admin_note || "—"}</td>
                    <td className="px-3 py-4 font-mono text-[9px] text-zinc-400"><p>第 {task.submission_version} 次</p><p className="mt-1">{formatDate(task.submitted_at)}</p></td>
                    <td className="px-5 py-3">
                      <VisaTaskReviewControls taskId={task.id} status={task.status} />
                      {!(["submitted", "reviewing"].includes(task.status)) && <p className="border border-black/[0.06] bg-zinc-50 px-3 py-2 text-[9px] leading-4 text-zinc-500">{task.status === "approved" ? "任务已经审核确认。" : task.status === "revision_required" ? "等待学生补充后重新提交。" : task.status === "blocked" ? "学生标记需要协助，请及时联系。" : "学生正在准备，暂无需审核。"}</p>}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && <tr><td colSpan={8} className="px-5 py-16 text-center text-zinc-400">这名学生尚未生成签证任务</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
