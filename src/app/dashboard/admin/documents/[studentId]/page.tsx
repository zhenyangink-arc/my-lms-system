import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Crown,
  FileText,
  Lock,
  MinusCircle,
  Plus,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { CATEGORY_ORDER } from "@/app/dashboard/documents/constants";
import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { StudentModuleCardDeleteDialog } from "../../StudentModuleCardDeleteDialog";
import { AdminApplicationStageControl } from "../AdminApplicationStageControl";
import { AdminCourierInfoForm } from "../AdminCourierInfoForm";
import { AdminDocumentCategoryList } from "../AdminDocumentCategoryList";
import { TargetLockButton } from "../TargetLockButton";
import {
  createApplicationChecklistItemAction,
  deleteStudentDocumentCardAction,
} from "../actions";


type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

type ChecklistDocument = {
  id: string;
  target_id: string | null;
  title: string;
  category: string;
  notes: string | null;
  admin_note: string | null;
  status: "preparing" | "completed" | "not_needed";
  due_date: string | null;
  updated_at: string;
  sort_order: number;
  admin_locked_at: string | null;
};

type TargetApplication = {
  id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
  status: string;
  documents_locked_at: string | null;
  courier_mailed_at: string | null;
  courier_estimated_arrival_at: string | null;
  application_stage: number;
  visa_application_channel: string | null;
};

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

function formatDate(value: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
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

export default async function StudentDocumentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { supabase } = await requireAdmin();
  const [profileResult, documentsResult, targetsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, membership_tier")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_application_documents")
      .select("id, target_id, title, category, notes, admin_note, status, due_date, updated_at, sort_order, admin_locked_at")
      .eq("user_id", studentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("id, university_name, program_name, admission_track, status, documents_locked_at, courier_mailed_at, courier_estimated_arrival_at, application_stage, visa_application_channel")
      .eq("user_id", studentId)
      .neq("status", "researching")
      .order("priority", { ascending: false }),
  ]);

  if (documentsResult.error) throw new Error("学生申请资料读取失败，请稍后重试。");
  const documents = (documentsResult.data ?? []) as ChecklistDocument[];
  const targetApplications = (targetsResult.data ?? []) as TargetApplication[];
  if (!profileResult.data && documents.length === 0 && targetApplications.length === 0) notFound();

  const targetById = new Map(targetApplications.map((target) => [target.id, target]));
  const profile = (profileResult.data ?? {
    id: studentId,
    full_name: null,
    email: null,
    membership_tier: null,
  }) as StudentProfile;
  const displayName = profile.full_name || "未填写姓名";
  const preparingCount = documents.filter((item) => item.status === "preparing").length;
  const completedCount = documents.filter((item) => item.status === "completed").length;
  const notNeededCount = documents.filter((item) => item.status === "not_needed").length;
  const completionPercent = documents.length > 0
    ? Math.round(((completedCount + notNeededCount) / documents.length) * 100)
    : 0;
  const latestUpdate = [...documents].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0];

  const documentsWithTargetLabel = documents.map((document) => {
    const target = document.target_id ? targetById.get(document.target_id) : null;
    return {
      ...document,
      targetLabel: target
        ? `${target.university_name} · ${ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请阶段"}`
        : null,
    };
  });
  const documentsByCategory = new Map<string, typeof documentsWithTargetLabel>();
  for (const document of documentsWithTargetLabel) {
    const group = documentsByCategory.get(document.category) ?? [];
    group.push(document);
    documentsByCategory.set(document.category, group);
  }
  const categoryGroups = CATEGORY_ORDER
    .map((category) => ({ category, items: documentsByCategory.get(category) ?? [] }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <DashboardPageHeader title="学生申请资料" description="查看这名学生的资料清单与准备进度。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link href="/dashboard/admin/documents" className="app-muted-text inline-flex items-center gap-2 text-xs font-black"><ArrowLeft size={14} />返回学生列表</Link>

        <section className="app-card rounded-[2rem] border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] text-2xl font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">{displayName}</h1><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Crown size={11} />{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</span></div><p className="app-muted-text mt-1 text-sm">{profile.email || `账号 …${studentId.slice(-6)}`}</p><p className="app-muted-text mt-2 text-xs">最近更新：{formatDate(latestUpdate?.updated_at ?? null)}</p>{documents.length > 0 && <div className="mt-3"><StudentModuleCardDeleteDialog action={deleteStudentDocumentCardAction.bind(null, studentId)} studentName={displayName} cardLabel="申请资料卡" description="将永久清空这名学生的全部申请资料清单项目。" /></div>}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:ml-auto lg:min-w-[420px]">
              {[
                ["准备中", preparingCount, Clock3, "var(--app-secondary)"],
                ["已完成", completedCount, CheckCircle2, "var(--app-success)"],
                ["无", notNeededCount, MinusCircle, "var(--app-muted)"],
                ["完成率", `${completionPercent}%`, FileText, "var(--app-accent)"],
              ].map(([label, value, Icon, color]) => {
                const MetricIcon = Icon as typeof FileText;
                return <div key={String(label)} className="app-card rounded-xl border p-3 text-center"><MetricIcon className="mx-auto" size={15} style={{ color: String(color) }} /><p className="mt-1.5 text-xl font-black">{String(value)}</p><p className="app-muted-text text-[10px] font-black">{String(label)}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="app-card rounded-[1.5rem] border p-5">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Plus size={17} /></span><div><h2 className="text-base font-black">添加申请资料项目</h2><p className="app-muted-text mt-1 text-xs">选择目标大学申请表后，新增项目会立即显示在学生的资料清单中。截止日期自动使用该校在「大学管理」中设置的申请截止日期，无需手动填写。</p></div></div>
          {targetApplications.length > 0 ? (
            <form action={createApplicationChecklistItemAction.bind(null, studentId)} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_170px_auto] xl:items-end">
              <label className="text-xs font-black">目标大学申请表<select name="targetId" required className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">{targetApplications.map((target) => <option key={target.id} value={target.id}>{target.university_name} · {ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "阶段待确认"}{target.program_name ? ` · ${target.program_name}` : ""}</option>)}</select></label>
              <label className="text-xs font-black">资料名称<input name="title" required maxLength={100} placeholder="例如：父母在职证明" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm" /></label>
              <label className="text-xs font-black">资料分类<select name="category" defaultValue="other" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm"><option value="identity">身份材料</option><option value="academic">学历材料</option><option value="application">申请文书</option><option value="financial">资金材料</option><option value="language">语言材料</option><option value="other">其他材料</option></select></label>
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><Plus size={14} />添加项目</button>
            </form>
          ) : (
            <p className="app-muted-text mt-4 text-xs">学生还没有进入“准备资料”的目标大学。</p>
          )}
        </section>

        <AdminDocumentCategoryList studentId={studentId} categoryGroups={categoryGroups} />

        <section className="app-card rounded-[1.5rem] border p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Lock size={17} /></span>
            <div>
              <h2 className="text-base font-black">申请表锁定管理</h2>
              <p className="app-muted-text mt-1 text-xs">锁定后，学生端这份申请表的所有资料项目都无法修改，只能查看；解锁后学生可以继续编辑。</p>
            </div>
          </div>
          {targetApplications.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {targetApplications.map((target) => {
                const targetLocked = target.documents_locked_at !== null;
                return (
                  <div key={target.id} className="app-soft-card rounded-2xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{target.university_name}</p>
                        <p className="app-muted-text mt-1 text-xs">{ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请阶段待确认"}{target.program_name ? ` · ${target.program_name}` : ""}</p>
                        <span
                          className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black"
                          style={targetLocked ? { color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" } : { color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)" }}
                        >
                          {targetLocked && <Lock size={10} />}
                          {targetLocked ? "已锁定" : "未锁定"}
                        </span>
                      </div>
                      <TargetLockButton studentId={studentId} targetId={target.id} locked={targetLocked} />
                    </div>
                    <AdminCourierInfoForm
                      studentId={studentId}
                      targetId={target.id}
                      courierMailedAt={target.courier_mailed_at}
                      courierEstimatedArrivalAt={target.courier_estimated_arrival_at}
                    />
                    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
                      <AdminApplicationStageControl studentId={studentId} targetId={target.id} stage={target.application_stage} visaApplicationChannel={target.visa_application_channel} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="app-muted-text mt-4 text-xs">学生还没有进入「准备资料」的目标大学。</p>
          )}
        </section>
      </div>
    </>
  );
}
