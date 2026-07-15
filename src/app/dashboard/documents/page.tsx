import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  FolderCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { initializeApplicationDocumentsAction } from "../planning-actions";
import { ApplicationDocumentForm } from "./ApplicationDocumentForm";

type ApplicationDocument = {
  id: string;
  title: string;
  category: string;
  status: string;
  due_date: string | null;
  sort_order: number;
  original_file_name: string | null;
  file_size_bytes: number | null;
  submission_version: number;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  preparing: "准备中",
  pending_review: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "退回重交",
};

const STATUS_TONES: Record<string, { color: string; soft: string }> = {
  not_started: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  preparing: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  pending_review: { color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
  reviewing: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  approved: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  revision_required: { color: "#dc5f54", soft: "#fff0ed" },
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

function formatFileSize(value: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle2 size={19} />;
  if (status === "revision_required") return <RotateCcw size={19} />;
  if (status === "reviewing" || status === "pending_review") return <FileClock size={19} />;
  if (status === "preparing") return <FileCheck2 size={19} />;
  return <FileText size={19} />;
}

export default async function DocumentsPage() {
  const { supabase, user } = await requireActiveUser();
  const { data, error } = await supabase
    .from("student_application_documents")
    .select("id, title, category, status, due_date, sort_order, original_file_name, file_size_bytes, submission_version, submitted_at, review_note, reviewed_at")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const documents = (data ?? []) as ApplicationDocument[];
  const approvedCount = documents.filter((item) => item.status === "approved").length;
  const reviewCount = documents.filter((item) => ["pending_review", "reviewing"].includes(item.status)).length;
  const revisionCount = documents.filter((item) => item.status === "revision_required").length;
  const completionPercent = documents.length > 0 ? Math.round((approvedCount / documents.length) * 100) : 0;

  return (
    <>
      <DashboardPageHeader title="申请资料" description="准备、提交并跟踪每一份韩国留学申请材料。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
          <div className="grid items-center gap-7 lg:grid-cols-[1fr_360px]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}><Sparkles size={14} />安全材料中心</span>
              <h2 className="mt-5 text-3xl font-black tracking-tight">从准备到确认，每一步都清楚</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">学生只负责准备和提交；管理员负责查看文件、开始审核、确认或退回。文件存放在私有空间，学生提交后不能自行下载或删除。</p>
            </div>
            <div className="app-card rounded-3xl border p-5">
              <div className="flex items-end justify-between"><div><p className="text-xs font-bold app-muted-text">材料确认进度</p><p className="mt-1 text-3xl font-black">{completionPercent}%</p></div><FolderCheck size={27} style={{ color: "var(--app-success)" }} /></div>
              <div className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div>
              <p className="mt-3 text-xs app-muted-text">已确认 {approvedCount} / {documents.length} 项</p>
            </div>
          </div>
        </section>

        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>申请材料暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="app-muted-text text-xs font-black">申请流程</p><h2 className="mt-1 text-lg font-black">材料审核路线</h2></div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ShieldCheck size={14} />管理员专属文件查看权限</span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {["未开始", "准备中", "待审核", "审核中", "已确认", "退回重交"].map((label, index) => <div key={label} className="app-soft-card relative rounded-2xl border p-3 text-center"><span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ backgroundColor: index === 5 ? "var(--app-warm)" : index === 4 ? "var(--app-success)" : "var(--app-accent)" }}>{index + 1}</span><p className="mt-2 text-xs font-black">{label}</p>{index === 5 && <p className="app-muted-text mt-1 text-[10px]">重交后回到待审核</p>}</div>)}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["材料总数", documents.length, FileText, "var(--app-accent)"],
            ["等待或正在审核", reviewCount, FileClock, "var(--app-secondary)"],
            ["需要重新提交", revisionCount, RotateCcw, "var(--app-warm)"],
            ["已经确认", approvedCount, CheckCircle2, "var(--app-success)"],
          ].map(([label, value, Icon, color]) => {
            const StatIcon = Icon as typeof FileText;
            return <article key={String(label)} className="app-card rounded-2xl border p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold app-muted-text">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></div><StatIcon size={20} style={{ color: String(color) }} /></div></article>;
          })}
        </section>

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-lg font-black">申请材料清单</h2><p className="mt-1 text-xs app-muted-text">“已准备”必须选择文件，提交后由管理员处理审核状态。</p></div>
            {documents.length === 0 && !error && <form action={initializeApplicationDocumentsAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><ClipboardCheck size={16} />生成标准清单</button></form>}
          </div>

          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((document) => {
                const tone = STATUS_TONES[document.status] ?? STATUS_TONES.not_started;
                const isEditable = ["not_started", "preparing", "pending_review", "revision_required"].includes(document.status);
                return (
                  <article key={document.id} className="app-soft-card rounded-2xl border p-3.5 sm:p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(240px,1fr)_minmax(300px,0.95fr)] xl:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}><StatusIcon status={document.status} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black">{document.title}</h3><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>{CATEGORY_LABELS[document.category] ?? document.category}</span></div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[document.status] ?? document.status}</span>{document.submission_version > 0 && <span className="app-muted-text text-[10px] font-bold">第 {document.submission_version} 版</span>}</div>
                        </div>
                      </div>

                      <div className="min-w-0 xl:border-l xl:px-4" style={{ borderColor: "var(--app-border-soft)" }}>
                        {document.original_file_name ? (
                          <div><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-xs font-black">{document.original_file_name}</p><span className="app-muted-text shrink-0 text-[10px] font-bold">{formatFileSize(document.file_size_bytes)}</span></div><p className="app-muted-text mt-1 text-[10px]">文件已安全提交，仅管理员可查看。</p></div>
                        ) : (
                          <p className="app-muted-text text-xs">尚未提交文件</p>
                        )}
                        {document.review_note && <div className="mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-5" style={{ color: document.status === "revision_required" ? "var(--app-warm)" : "var(--app-muted)", backgroundColor: document.status === "revision_required" ? "var(--app-warm-soft)" : "var(--app-soft-bg)" }}><b>审核意见：</b>{document.review_note}</div>}
                      </div>

                      <div className="xl:border-l xl:pl-4" style={{ borderColor: "var(--app-border-soft)" }}>
                      {isEditable ? (
                        <ApplicationDocumentForm documentId={document.id} currentStatus={document.status} />
                      ) : (
                        <div className="flex items-start gap-2 text-xs leading-5 app-muted-text">
                          {document.status === "approved" ? <CheckCircle2 className="mt-0.5 shrink-0" size={15} style={{ color: "var(--app-success)" }} /> : <Clock3 className="mt-0.5 shrink-0" size={15} style={{ color: "var(--app-accent)" }} />}
                          <span>{document.status === "pending_review" ? "材料已提交，等待管理员开始审核。" : document.status === "reviewing" ? "管理员正在核对文件，请耐心等待审核结果。" : "这份材料已经确认，无需继续操作。"}</span>
                        </div>
                      )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="app-soft-card flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"><ClipboardCheck size={27} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-sm font-black">还没有申请材料清单</p><p className="mt-1 text-xs app-muted-text">点击“生成标准清单”创建常用韩国留学申请材料。</p></div>
          )}
        </section>
      </div>
    </>
  );
}
