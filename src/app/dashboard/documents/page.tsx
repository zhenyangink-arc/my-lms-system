import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderCheck,
  FolderOpen,
  Lock,
  MinusCircle,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { ApplicationDocumentChecklist } from "./ApplicationDocumentChecklist";
import { ApplicationStageTimeline } from "./ApplicationStageTimeline";
import { CourierInfoCard } from "./CourierInfoCard";
import { CATEGORY_ORDER } from "./constants";


export const runtime = "edge";
type ApplicationDocument = {
  id: string;
  target_id: string | null;
  title: string;
  category: string;
  notes: string | null;
  admin_note: string | null;
  status: "preparing" | "completed" | "not_needed";
  due_date: string | null;
  sort_order: number;
  admin_locked_at: string | null;
};

type TargetApplication = {
  id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
  status: string;
  application_deadline: string | null;
  documents_locked_at: string | null;
  courier_mailed_at: string | null;
  courier_estimated_arrival_at: string | null;
  application_stage: number;
};

const TARGET_STATUS_LABELS: Record<string, string> = {
  preparing: "准备资料",
  applied: "已申请",
  interview: "面试阶段",
  offer: "已录取",
  rejected: "未录取",
  paused: "暂缓",
};

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

function getDueMeta(dueDate: string | null, status: string) {
  if (!dueDate || status === "completed" || status === "not_needed") return null;
  const due = new Date(`${dueDate}T00:00:00+09:00`);
  if (Number.isNaN(due.getTime())) return null;
  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const shortDate = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).format(due);
  if (diffDays < 0) return { label: `已逾期 ${Math.abs(diffDays)} 天`, color: "#dc5f54", soft: "#fff0ed" };
  if (diffDays === 0) return { label: "今天截止", color: "var(--app-warm)", soft: "var(--app-warm-soft)" };
  if (diffDays <= 3) return { label: `剩余 ${diffDays} 天`, color: "var(--app-warm)", soft: "var(--app-warm-soft)" };
  return { label: `截止 ${shortDate}`, color: "var(--app-muted)", soft: "var(--app-soft-bg)" };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const { target: selectedTargetId } = await searchParams;
  const { supabase, user } = await requireActiveUser();
  const [documentsResult, targetsResult] = await Promise.all([
    supabase
      .from("student_application_documents")
      .select("id, target_id, title, category, notes, admin_note, status, due_date, sort_order, admin_locked_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("id, university_name, program_name, admission_track, status, application_deadline, documents_locked_at, courier_mailed_at, courier_estimated_arrival_at, application_stage")
      .eq("user_id", user.id)
      .neq("status", "researching")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const allDocuments = (documentsResult.data ?? []) as ApplicationDocument[];
  const targetApplications = (targetsResult.data ?? []) as TargetApplication[];
  const selectedTarget = targetApplications.find((target) => target.id === selectedTargetId) ?? null;
  if (selectedTarget && selectedTarget.documents_locked_at !== null) {
    redirect("/dashboard/documents");
  }
  const documents = selectedTarget
    ? allDocuments.filter((document) => document.target_id === selectedTarget.id)
    : [];
  const completedCount = documents.filter((item) => item.status === "completed").length;
  const notNeededCount = documents.filter((item) => item.status === "not_needed").length;
  const preparingCount = documents.filter((item) => item.status === "preparing").length;
  const resolvedCount = completedCount + notNeededCount;
  const completionPercent = documents.length > 0
    ? Math.round((resolvedCount / documents.length) * 100)
    : 0;

  const documentsWithDueMeta = documents.map((document) => ({
    ...document,
    dueMeta: getDueMeta(document.due_date, document.status),
  }));
  const documentsByCategory = new Map<string, typeof documentsWithDueMeta>();
  for (const document of documentsWithDueMeta) {
    const group = documentsByCategory.get(document.category) ?? [];
    group.push(document);
    documentsByCategory.set(document.category, group);
  }
  const categoryGroups = CATEGORY_ORDER
    .map((category) => ({ category, items: documentsByCategory.get(category) ?? [] }))
    .filter((group) => group.items.length > 0);

  if (!selectedTarget) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}><Sparkles size={14} />申请资料中心</span>
          <h1 className="mt-3 text-2xl font-black tracking-tight">按目标大学准备申请资料</h1>
          <p className="app-muted-text mt-3 max-w-2xl text-sm leading-6">目标大学进入“准备资料”后，会在这里生成对应阶段的申请表。点击申请表逐项确认准备进度。</p>
        </section>

        {(documentsResult.error || targetsResult.error) && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>申请表暂时无法读取，请稍后重试。</section>}

        {targetApplications.length > 0 ? (
          <section className="grid gap-4 2xl:grid-cols-2">
            {targetApplications.map((target) => {
              const targetDocuments = allDocuments.filter((document) => document.target_id === target.id);
              const targetCompletedCount = targetDocuments.filter((document) => document.status === "completed").length;
              const targetNotNeededCount = targetDocuments.filter((document) => document.status === "not_needed").length;
              const targetPreparingCount = targetDocuments.filter((document) => document.status === "preparing").length;
              const progress = targetDocuments.length > 0
                ? Math.round(((targetCompletedCount + targetNotNeededCount) / targetDocuments.length) * 100)
                : 0;
              const locked = target.documents_locked_at !== null;
              return (
                <div key={target.id} className="app-card rounded-3xl border p-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_170px]">
                    <div className="min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><FolderOpen size={21} /></span>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {locked && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black text-red-600 bg-red-50"><Lock size={11} />已锁定</span>}
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{TARGET_STATUS_LABELS[target.status] ?? target.status}</span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <h2 className="text-lg font-black">{target.university_name}申请表</h2>
                          {locked ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)", cursor: "not-allowed" }}>查看</span>
                          ) : (
                            <Link href={`/dashboard/documents?target=${target.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black text-white transition hover:opacity-90" style={{ backgroundColor: "var(--app-accent)" }}>查看<ArrowRight size={11} /></Link>
                          )}
                        </div>
                        <p className="app-muted-text mt-1 text-xs font-bold">{ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请阶段待确认"}{target.program_name ? ` · ${target.program_name}` : ""}</p>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{targetDocuments.length}</p><p className="app-muted-text text-xs">清单项目</p></div>
                          <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{targetPreparingCount}</p><p className="app-muted-text text-xs">准备中</p></div>
                          <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{targetCompletedCount}</p><p className="app-muted-text text-xs">已完成</p></div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: "var(--app-success)" }} /></div>
                        <div className="app-muted-text mt-3 flex items-center justify-between text-xs font-bold"><span>完成进度 {progress}%</span><span>{target.application_deadline ? `截止 ${target.application_deadline}` : "截止日期暂未公布"}</span></div>
                      </div>
                      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
                        <CourierInfoCard
                          targetId={target.id}
                          courierMailedAt={target.courier_mailed_at}
                          courierEstimatedArrivalAt={target.courier_estimated_arrival_at}
                          canEdit={target.application_stage >= 2}
                        />
                      </div>
                    </div>
                    <div className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" style={{ borderColor: "var(--app-border-soft)" }}>
                      <ApplicationStageTimeline stage={target.application_stage} />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="app-card flex min-h-64 flex-col items-center justify-center rounded-3xl border p-6 text-center">
            <FolderOpen size={30} style={{ color: "var(--app-accent)" }} />
            <h2 className="mt-4 text-base font-black">还没有需要准备资料的申请表</h2>
            <p className="app-muted-text mt-2 text-xs">先添加目标大学，并把申请状态调整为“准备资料”。</p>
            <Link href="/dashboard/universities/targets" className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>前往目标学校<ArrowRight size={13} /></Link>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/documents" className="app-muted-text inline-flex items-center gap-2 text-xs font-black"><ArrowLeft size={14} />返回申请表列表</Link>

      <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}><Sparkles size={14} />申请资料清单</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight">{selectedTarget.university_name}申请资料</h2>
            <p className="app-muted-text mt-3 max-w-2xl text-sm leading-6">{ADMISSION_TRACK_LABELS[selectedTarget.admission_track ?? ""] ?? "申请阶段待确认"}{selectedTarget.program_name ? ` · ${selectedTarget.program_name}` : ""}。无需上传文件，请按实际准备情况将每项标记为“准备中”“已完成”或“无”（不需要的材料）。</p>
          </div>

          <div className="space-y-3">
            <div className="app-card rounded-2xl border p-4">
              <div className="flex items-end justify-between"><div><p className="app-muted-text text-xs font-bold">资料完成进度</p><p className="mt-1 text-2xl font-black">{completionPercent}%</p></div><FolderCheck size={22} style={{ color: "var(--app-success)" }} /></div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["材料总数", documents.length, FileText, "var(--app-accent)", "var(--app-accent-soft)"],
                ["准备中", preparingCount, Clock3, "var(--app-secondary)", "var(--app-secondary-soft)"],
                ["已完成", completedCount, CheckCircle2, "var(--app-success)", "var(--app-success-soft)"],
                ["无需准备", notNeededCount, MinusCircle, "var(--app-muted)", "var(--app-soft-bg)"],
              ].map(([label, value, Icon, color, soft]) => {
                const StatIcon = Icon as typeof FileText;
                return <article key={String(label)} className="app-card flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: String(color), backgroundColor: String(soft) }}><StatIcon size={15} /></span><p className="text-lg font-black leading-none">{String(value)}</p><p className="app-muted-text text-xs font-bold">{String(label)}</p></article>;
              })}
            </div>
          </div>
        </div>
      </section>

      {documentsResult.error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>申请材料暂时无法读取，请确认最新数据库迁移已经执行。</section>}

      <section className="app-card rounded-3xl border p-4 sm:p-5">
        <div className="mb-5"><h2 className="text-lg font-black">申请资料清单</h2><p className="app-muted-text mt-1 text-xs">已处理 {resolvedCount}/{documents.length} 项（已完成 + 无需准备）。全部处理后可以点击「上传」提交并锁定该申请表；锁定后需联系管理员协助解锁。</p></div>

        {documents.length > 0 ? (
          <ApplicationDocumentChecklist
            targetId={selectedTarget.id}
            locked={selectedTarget.documents_locked_at !== null}
            categoryGroups={categoryGroups}
          />
        ) : (
          <div className="app-soft-card flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center"><ClipboardCheck size={27} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-sm font-black">还没有申请资料清单</p><p className="app-muted-text mt-1 text-xs">管理员配置资料项目后会显示在这里。</p></div>
        )}
      </section>
    </div>
  );
}
