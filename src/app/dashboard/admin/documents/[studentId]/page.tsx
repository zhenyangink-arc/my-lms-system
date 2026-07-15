import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Crown,
  Download,
  FileClock,
  FileSearch,
  FileText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { DocumentReviewControls } from "../DocumentReviewControls";

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

type ReviewDocument = {
  id: string;
  title: string;
  category: string;
  status: string;
  original_file_name: string | null;
  file_size_bytes: number | null;
  submission_version: number;
  submitted_at: string | null;
  review_started_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  sort_order: number;
};

type FileVersion = {
  id: string;
  document_id: string;
  version: number;
  original_file_name: string;
  file_size_bytes: number;
  submitted_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  preparing: "准备中",
  pending_review: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "退回重交",
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

const STATUS_TONES: Record<string, { color: string; soft: string }> = {
  pending_review: { color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
  reviewing: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  approved: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  revision_required: { color: "#d85b51", soft: "#fff0ed" },
  preparing: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  not_started: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
};

function formatDate(value: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

export default async function StudentDocumentReviewPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { supabase } = await requireAdmin();
  const [profileResult, documentsResult] = await Promise.all([
    // 学生卡是按提交记录生成的，详情页不能再额外用角色字段过滤，否则历史账号会误报 404。
    supabase.from("profiles").select("id, full_name, email, membership_tier").eq("id", studentId).maybeSingle(),
    supabase.from("student_application_documents").select("id, title, category, status, original_file_name, file_size_bytes, submission_version, submitted_at, review_started_at, reviewed_at, review_note, sort_order").eq("user_id", studentId).order("sort_order", { ascending: true }),
  ]);

  if (documentsResult.error) throw new Error("学生申请资料读取失败，请稍后重试。");
  const documents = (documentsResult.data ?? []) as ReviewDocument[];
  if (documents.length === 0) notFound();
  const profile = (profileResult.data ?? {
    id: studentId,
    full_name: null,
    email: null,
    membership_tier: null,
  }) as StudentProfile;
  const documentIds = documents.map((document) => document.id);
  const filesResult = documentIds.length > 0
    ? await supabase.from("student_application_document_files").select("id, document_id, version, original_file_name, file_size_bytes, submitted_at").in("document_id", documentIds).order("version", { ascending: false })
    : { data: [], error: null };
  const files = (filesResult.data ?? []) as FileVersion[];
  const filesByDocument = new Map<string, FileVersion[]>();
  for (const file of files) {
    const group = filesByDocument.get(file.document_id) ?? [];
    group.push(file);
    filesByDocument.set(file.document_id, group);
  }

  const displayName = profile.full_name || "未填写姓名";
  const submittedCount = documents.filter((item) => item.submission_version > 0).length;
  const pendingCount = documents.filter((item) => item.status === "pending_review").length;
  const reviewingCount = documents.filter((item) => item.status === "reviewing").length;
  const approvedCount = documents.filter((item) => item.status === "approved").length;
  const revisionCount = documents.filter((item) => item.status === "revision_required").length;
  const latestSubmission = [...files].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];

  return (
    <>
      <DashboardPageHeader title="学生申请资料" description="查看这名学生的全部材料、提交版本与审核状态。" />
      <div className="mx-auto w-full max-w-[1380px] space-y-5 p-4 sm:p-6">
        <Link href="/dashboard/admin/documents" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回学生列表</Link>

        <section className="app-card rounded-[2rem] border p-6 sm:p-7" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] text-2xl font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">{displayName}</h1><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Crown size={11} />{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</span></div><p className="app-muted-text mt-1 text-sm">{profile.email || `账号 …${studentId.slice(-6)}`}</p><p className="app-muted-text mt-2 text-xs">最近提交：{formatDate(latestSubmission?.submitted_at ?? null)}</p></div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:ml-auto lg:min-w-[520px]">
              {[["已提交", submittedCount, FileText], ["待审核", pendingCount, FileSearch], ["审核中", reviewingCount, Clock3], ["待重交", revisionCount, RotateCcw], ["已确认", approvedCount, CheckCircle2]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof FileText; return <div key={String(label)} className="app-card rounded-xl border p-3 text-center"><MetricIcon className="mx-auto" size={15} style={{ color: "var(--app-accent)" }} /><p className="mt-1.5 text-xl font-black">{String(value)}</p><p className="app-muted-text text-[9px] font-black">{String(label)}</p></div>; })}
            </div>
          </div>
        </section>

        {documentsResult.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">这名学生的材料暂时无法读取。</div>}

        <section className="space-y-3">
          {documents.map((document) => {
            const tone = STATUS_TONES[document.status] ?? STATUS_TONES.not_started;
            const versions = filesByDocument.get(document.id) ?? [];
            return (
              <article key={document.id} className="app-card rounded-[1.5rem] border p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_320px]">
                  <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}>{document.status === "approved" ? <CheckCircle2 size={18} /> : document.status === "reviewing" ? <FileClock size={18} /> : <FileText size={18} />}</span><div className="min-w-0"><h2 className="text-sm font-black">{document.title}</h2><p className="app-muted-text mt-1 text-[10px]">{CATEGORY_LABELS[document.category] ?? document.category}</p><span className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[document.status] ?? document.status}</span></div></div>

                  <div className="min-w-0 xl:border-l xl:px-4" style={{ borderColor: "var(--app-border-soft)" }}>
                    <div className="flex items-center justify-between"><p className="text-xs font-black">提交文件版本</p><span className="app-muted-text text-[10px]">共 {versions.length} 版</span></div>
                    <div className="mt-2 space-y-2">
                      {versions.map((file) => <div key={file.id} className="app-soft-card flex items-center gap-3 rounded-xl border px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black" style={{ color: file.version === document.submission_version ? "var(--app-accent)" : "var(--app-muted)", backgroundColor: file.version === document.submission_version ? "var(--app-accent-soft)" : "var(--app-soft-bg)" }}>V{file.version}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{file.original_file_name}</p><p className="app-muted-text mt-0.5 text-[9px]">{formatFileSize(file.file_size_bytes)} · {formatDate(file.submitted_at)}</p></div><Link href={`/api/application-document-files/${file.id}/download`} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}><Download size={11} />下载</Link></div>)}
                      {versions.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-xs app-muted-text">学生尚未提交文件</div>}
                    </div>
                    {document.review_note && <div className="mt-2 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ color: document.status === "revision_required" ? "var(--app-warm)" : "var(--app-muted)", backgroundColor: document.status === "revision_required" ? "var(--app-warm-soft)" : "var(--app-soft-bg)" }}><b>审核意见：</b>{document.review_note}</div>}
                  </div>

                  <div className="xl:border-l xl:pl-4" style={{ borderColor: "var(--app-border-soft)" }}>
                    <DocumentReviewControls documentId={document.id} status={document.status} />
                    {!["pending_review", "reviewing"].includes(document.status) && <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5 app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}><ShieldCheck className="mt-0.5 shrink-0" size={14} />{document.status === "approved" ? "材料已经审核确认。" : document.status === "revision_required" ? "等待学生按意见上传新版本。" : "学生尚未提交，暂时无需审核。"}</div>}
                  </div>
                </div>
              </article>
            );
          })}

          {documents.length === 0 && <div className="app-card rounded-[1.5rem] border border-dashed p-12 text-center"><FileSearch className="mx-auto opacity-30" size={32} /><p className="mt-3 font-black">这名学生还没有材料清单</p></div>}
        </section>
      </div>
    </>
  );
}
