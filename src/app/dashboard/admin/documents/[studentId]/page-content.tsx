import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FileCheck2,
  LockKeyhole,
  Plus,
  UnlockKeyhole,
} from "lucide-react";

import {
  APPLICATION_STAGE_LABELS,
  CATEGORY_LABELS,
} from "@/app/dashboard/documents/constants";
import { requireDocumentReviewManager } from "@/lib/document-reviews";
import { AdminApplicationStageControl } from "../AdminApplicationStageControl";
import { AdminCourierInfoForm } from "../AdminCourierInfoForm";
import {
  DeleteChecklistItemButton,
  DocumentItemControls,
} from "../DocumentItemControls";
import { createApplicationChecklistItemAction } from "../actions";

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
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

type ReviewStatus =
  | "preparing"
  | "pending_review"
  | "revision_required"
  | "approved";

type TargetApplication = {
  id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
  documents_locked_at: string | null;
  courier_mailed_at: string | null;
  courier_estimated_arrival_at: string | null;
  application_stage: number;
  visa_application_channel: string | null;
  document_review_status: ReviewStatus;
  document_review_note: string | null;
  updated_at: string;
};

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

const REVIEW_META: Record<ReviewStatus, { label: string; dot: string; text: string }> = {
  preparing: { label: "准备中", dot: "bg-slate-400", text: "text-slate-600" },
  pending_review: { label: "待确认", dot: "bg-amber-500", text: "text-amber-700" },
  revision_required: { label: "需补充", dot: "bg-rose-500", text: "text-rose-700" },
  approved: { label: "已确认", dot: "bg-emerald-500", text: "text-emerald-700" },
};

const ITEM_META: Record<ChecklistDocument["status"], { label: string; dot: string; text: string }> = {
  preparing: { label: "准备中", dot: "bg-amber-500", text: "text-amber-700" },
  completed: { label: "已完成", dot: "bg-emerald-500", text: "text-emerald-700" },
  not_needed: { label: "无需准备", dot: "bg-slate-300", text: "text-slate-500" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function StudentDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ target?: string }>;
}) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const { supabase, tenantId } = await requireDocumentReviewManager();
  const [profileResult, documentsResult, targetsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_application_documents")
      .select("id,target_id,title,category,notes,admin_note,status,due_date,updated_at,sort_order,admin_locked_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("id,university_name,program_name,admission_track,documents_locked_at,courier_mailed_at,courier_estimated_arrival_at,application_stage,visa_application_channel,document_review_status,document_review_note,updated_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .neq("status", "researching")
      .order("priority", { ascending: false }),
  ]);

  if (documentsResult.error || targetsResult.error) {
    throw new Error("学生申请资料读取失败，请稍后重试。");
  }

  const documents = (documentsResult.data ?? []) as ChecklistDocument[];
  const targets = (targetsResult.data ?? []) as TargetApplication[];
  if (!profileResult.data && documents.length === 0 && targets.length === 0) notFound();

  const profile = (profileResult.data ?? {
    id: studentId,
    full_name: null,
    email: null,
  }) as StudentProfile;
  const displayName = profile.full_name || profile.email || "未填写姓名";
  const documentsByTarget = new Map<string, ChecklistDocument[]>();
  for (const document of documents) {
    if (!document.target_id) continue;
    const group = documentsByTarget.get(document.target_id) ?? [];
    group.push(document);
    documentsByTarget.set(document.target_id, group);
  }
  const latestUpdate = [
    ...targets.map((target) => target.updated_at),
    ...documents.map((document) => document.updated_at),
  ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const resolvedCount = documents.filter((document) => document.status !== "preparing").length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard/admin/documents" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-950">
          <ArrowLeft size={12} />返回资料审核
        </Link>

        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">学生资料 / 管理</p>
              <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">{displayName}</h1>
              <p className="mt-1 text-[10px] text-zinc-500">{profile.email || `账号 …${studentId.slice(-6)}`} · 最近更新 {formatDate(latestUpdate)}</p>
            </div>
            <dl className="flex flex-wrap items-center text-[10px]">
              {[
                ["申请单", targets.length],
                ["资料项目", documents.length],
                ["已处理", resolvedCount],
              ].map(([label, value], index) => (
                <div key={String(label)} className={`min-w-[82px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-zinc-950">{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <details className="group border-b border-black/[0.08]">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50/60">
              <ChevronRight className="text-zinc-400 transition group-open:rotate-90" size={13} />
              <Plus size={12} />新增申请资料项目
              <span className="ml-auto text-[9px] font-normal text-zinc-400">默认收起</span>
            </summary>
            <form action={createApplicationChecklistItemAction.bind(null, studentId)} className="grid border-t border-black/[0.06] bg-zinc-50/45 lg:grid-cols-[minmax(240px,1.2fr)_minmax(220px,1fr)_170px_100px]">
              <label className="border-b border-black/[0.06] p-3 text-[9px] font-medium uppercase tracking-[0.05em] text-zinc-400 lg:border-b-0 lg:border-r">
                目标大学申请单
                <select name="targetId" required className="mt-1.5 h-8 w-full rounded-md border border-black/10 bg-white px-2 text-[11px] font-normal normal-case tracking-normal text-zinc-800 outline-none">
                  {targets.map((target) => <option key={target.id} value={target.id}>{target.university_name} · {ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请项目"}{target.program_name ? ` · ${target.program_name}` : ""}</option>)}
                </select>
              </label>
              <label className="border-b border-black/[0.06] p-3 text-[9px] font-medium uppercase tracking-[0.05em] text-zinc-400 lg:border-b-0 lg:border-r">
                资料名称
                <input name="title" required maxLength={100} placeholder="例如：父母在职证明" className="mt-1.5 h-8 w-full rounded-md border border-black/10 bg-white px-2 text-[11px] font-normal normal-case tracking-normal text-zinc-800 outline-none" />
              </label>
              <label className="border-b border-black/[0.06] p-3 text-[9px] font-medium uppercase tracking-[0.05em] text-zinc-400 lg:border-b-0 lg:border-r">
                资料分类
                <select name="category" defaultValue="other" className="mt-1.5 h-8 w-full rounded-md border border-black/10 bg-white px-2 text-[11px] font-normal normal-case tracking-normal text-zinc-800 outline-none">
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="flex items-end p-3"><button type="submit" disabled={targets.length === 0} className="h-8 w-full rounded-md bg-zinc-950 text-[10px] font-medium text-white disabled:opacity-35">添加</button></div>
            </form>
          </details>

          <div className="overflow-x-auto">
            <div className="min-w-[1180px]">
              <div className="grid h-10 grid-cols-[38px_260px_135px_145px_105px_125px_1fr] items-center border-b border-black/[0.08] bg-zinc-50/40 px-3 text-[9px] uppercase tracking-[0.07em] text-zinc-500">
                <span />
                <span>目标大学 / 项目</span>
                <span>资料进度</span>
                <span>申请阶段</span>
                <span>审核状态</span>
                <span>更新时间</span>
                <span className="text-right">学生端</span>
              </div>

              {targets.map((target) => {
                const targetDocuments = documentsByTarget.get(target.id) ?? [];
                const targetResolved = targetDocuments.filter((document) => document.status !== "preparing").length;
                const review = REVIEW_META[target.document_review_status];
                return (
                  <details key={target.id} open={query.target === target.id} className="group border-b border-black/[0.08] last:border-b-0">
                    <summary className="grid h-[52px] cursor-pointer list-none grid-cols-[38px_260px_135px_145px_105px_125px_1fr] items-center px-3 text-[11px] transition hover:bg-zinc-50/60">
                      <ChevronRight className="text-zinc-400 transition group-open:rotate-90" size={13} />
                      <span className="min-w-0 pr-4"><b className="block truncate font-medium text-zinc-950">{target.university_name}</b><small className="mt-0.5 block truncate text-[9px] font-normal text-zinc-400">{ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请项目"}{target.program_name ? ` · ${target.program_name}` : ""}</small></span>
                      <span className="font-mono text-[10px] tabular-nums text-zinc-600">{targetResolved}/{targetDocuments.length}</span>
                      <span className="truncate pr-3 text-zinc-500">{APPLICATION_STAGE_LABELS[target.application_stage] ?? "阶段待确认"}</span>
                      <span className={`inline-flex items-center gap-1.5 ${review.text}`}><span className={`size-1.5 rounded-full ${review.dot}`} />{review.label}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{formatDate(target.updated_at)}</span>
                      <span className="flex justify-end pr-1 text-zinc-400">{target.documents_locked_at ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}</span>
                    </summary>

                    <div className="border-t border-black/[0.06] bg-zinc-50/35 px-12 py-3">
                      <table className="w-full border-collapse text-left text-[10px]">
                        <thead><tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.06em] text-zinc-400"><th className="w-[115px] px-2 font-medium">分类</th><th className="w-[230px] px-2 font-medium">资料名称</th><th className="w-[100px] px-2 font-medium">学生状态</th><th className="px-2 font-medium">学生说明 / 管理员备注</th><th className="w-[95px] px-2 font-medium">截止日期</th><th className="w-[205px] px-2 text-right font-medium">操作</th></tr></thead>
                        <tbody>
                          {targetDocuments.map((document) => {
                            const item = ITEM_META[document.status];
                            const locked = document.admin_locked_at !== null;
                            return <tr key={document.id} className="min-h-10 border-b border-black/[0.05] last:border-b-0"><td className="px-2 py-2.5 text-zinc-500">{CATEGORY_LABELS[document.category] ?? document.category}</td><td className="px-2 py-2.5 font-medium text-zinc-900">{document.title}</td><td className="px-2 py-2.5"><span className={`inline-flex items-center gap-1.5 ${item.text}`}><span className={`size-1.5 rounded-full ${item.dot}`} />{item.label}</span></td><td className="max-w-[360px] px-2 py-2.5 text-zinc-500"><p className="truncate">{document.notes || "—"}</p>{document.admin_note && <p className="mt-0.5 truncate text-amber-700">审核：{document.admin_note}</p>}</td><td className="px-2 py-2.5 font-mono text-[9px] text-zinc-400">{document.due_date || "—"}</td><td className="px-2 py-2.5"><div className="flex items-center justify-end gap-2"><DocumentItemControls studentId={studentId} documentId={document.id} title={document.title} adminNote={document.admin_note} locked={locked} /><DeleteChecklistItemButton studentId={studentId} documentId={document.id} title={document.title} locked={locked} /></div></td></tr>;
                          })}
                          {targetDocuments.length === 0 && <tr><td colSpan={6} className="px-2 py-8 text-center text-zinc-400">这份申请单还没有资料项目</td></tr>}
                        </tbody>
                      </table>

                      {target.document_review_note && <div className={`mt-3 border-l-2 px-3 py-2 text-[10px] ${review.text}`}><b>最近审核意见：</b>{target.document_review_note}</div>}

                      <details className="group/settings mt-3 border-t border-black/[0.07]">
                        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 text-[10px] font-medium text-zinc-600"><ChevronRight className="transition group-open/settings:rotate-90" size={12} />申请进程与寄送设置<span className="ml-auto text-[9px] font-normal text-zinc-400">默认收起</span></summary>
                        <div className="border-t border-black/[0.06] bg-white px-4 py-4">
                          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-medium text-zinc-800">学生端资料编辑</p><p className="mt-0.5 text-[9px] text-zinc-400">提交后自动锁定；需要学生修改时，请从资料审核主表执行“退回补充”。</p></div><span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${target.documents_locked_at ? "text-amber-700" : "text-emerald-700"}`}>{target.documents_locked_at ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}{target.documents_locked_at ? "已锁定" : "可编辑"}</span></div>
                          <AdminCourierInfoForm studentId={studentId} targetId={target.id} courierMailedAt={target.courier_mailed_at} courierEstimatedArrivalAt={target.courier_estimated_arrival_at} />
                          <div className="mt-4 border-t border-black/[0.07] pt-4"><AdminApplicationStageControl studentId={studentId} targetId={target.id} stage={target.application_stage} visaApplicationChannel={target.visa_application_channel} /></div>
                        </div>
                      </details>
                    </div>
                  </details>
                );
              })}

              {targets.length === 0 && <div className="py-16 text-center"><FileCheck2 className="mx-auto text-zinc-300" size={24} /><p className="mt-3 text-xs font-medium text-zinc-700">这名学生还没有进入资料准备阶段的申请单</p></div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
