import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  FolderCheck,
  FolderOpen,
  GraduationCap,
  IdCard,
  Landmark,
  Languages,
  NotebookPen,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { initializeApplicationDocumentsAction } from "../planning-actions";
import { ApplicationDocumentForm } from "./ApplicationDocumentForm";
import { DocumentNotificationsDialog } from "./DocumentNotificationsDialog";

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

type DocumentEvent = {
  id: number;
  document_id: string;
  event_type: string;
  note: string | null;
  created_at: string;
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

const CATEGORY_ORDER = ["identity", "academic", "application", "financial", "language", "other"];

const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  identity: IdCard,
  academic: GraduationCap,
  application: NotebookPen,
  financial: Landmark,
  language: Languages,
  other: FolderOpen,
};

function formatFileSize(value: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function getDueMeta(dueDate: string | null, status: string) {
  if (!dueDate || status === "approved") return null;
  const due = new Date(`${dueDate}T00:00:00+09:00`);
  if (Number.isNaN(due.getTime())) return null;
  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const shortDate = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(due);
  if (diffDays < 0) return { label: `已逾期 ${Math.abs(diffDays)} 天`, color: "#dc5f54", soft: "#fff0ed" };
  if (diffDays === 0) return { label: "今天截止", color: "var(--app-warm)", soft: "var(--app-warm-soft)" };
  if (diffDays <= 3) return { label: `剩余 ${diffDays} 天`, color: "var(--app-warm)", soft: "var(--app-warm-soft)" };
  return { label: `截止 ${shortDate}`, color: "var(--app-muted)", soft: "var(--app-soft-bg)" };
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
  const [{ data, error }, eventsResult] = await Promise.all([
    supabase
      .from("student_application_documents")
      .select("id, title, category, status, due_date, sort_order, original_file_name, file_size_bytes, submission_version, submitted_at, review_note, reviewed_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_application_document_events")
      .select("id, document_id, event_type, note, created_at")
      .eq("user_id", user.id)
      .in("event_type", ["submitted", "review_started", "approved", "revision_requested"])
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const documents = (data ?? []) as ApplicationDocument[];
  const notifications = (eventsResult.data ?? []) as DocumentEvent[];
  const documentTitleById = Object.fromEntries(documents.map((document) => [document.id, document.title]));
  const approvedCount = documents.filter((item) => item.status === "approved").length;
  const reviewCount = documents.filter((item) => ["pending_review", "reviewing"].includes(item.status)).length;
  const revisionCount = documents.filter((item) => item.status === "revision_required").length;
  const completionPercent = documents.length > 0 ? Math.round((approvedCount / documents.length) * 100) : 0;

  const documentsByCategory = new Map<string, ApplicationDocument[]>();
  for (const document of documents) {
    const group = documentsByCategory.get(document.category) ?? [];
    group.push(document);
    documentsByCategory.set(document.category, group);
  }
  const categoryGroups = CATEGORY_ORDER.map((category) => ({ category, items: documentsByCategory.get(category) ?? [] })).filter((group) => group.items.length > 0);

  return (
    <>
      <DashboardPageHeader title="申请资料" description="准备、提交并跟踪每一份韩国留学申请材料。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* 区块 1：顶部引导横幅 —— 区域1 引导文案 50%，区域2 进度与统计 40%，区域3 通知按钮 10% */}
        <section className="app-card overflow-hidden rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
          <div className="grid items-start gap-6 lg:grid-cols-[5fr_4fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}><Sparkles size={14} />安全材料中心</span>
              <h2 className="mt-5 text-3xl font-black tracking-tight">从准备到确认，每一步都清楚</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">学生只负责准备和提交；管理员负责查看文件、开始审核、确认或退回。文件存放在私有空间，学生提交后不能自行下载或删除。</p>
            </div>

            <div className="space-y-3">
              <div className="app-card rounded-2xl border p-4">
                <div className="flex items-end justify-between"><div><p className="text-xs font-bold app-muted-text">材料确认进度</p><p className="mt-1 text-2xl font-black">{completionPercent}%</p></div><FolderCheck size={22} style={{ color: "var(--app-success)" }} /></div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["材料总数", documents.length, FileText, "var(--app-accent)", "var(--app-accent-soft)"],
                  ["待审核", reviewCount, FileClock, "var(--app-secondary)", "var(--app-secondary-soft)"],
                  ["需要重提", revisionCount, RotateCcw, "var(--app-warm)", "var(--app-warm-soft)"],
                  ["已确认", approvedCount, CheckCircle2, "var(--app-success)", "var(--app-success-soft)"],
                ].map(([label, value, Icon, color, soft]) => {
                  const StatIcon = Icon as typeof FileText;
                  return <article key={String(label)} className="app-card flex items-center gap-2 rounded-xl border px-2.5 py-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: String(color), backgroundColor: String(soft) }}><StatIcon size={15} /></span><div className="min-w-0"><p className="app-muted-text text-[11px] font-bold">{String(label)}</p><p className="text-lg font-black leading-none">{String(value)}</p></div></article>;
                })}
              </div>
            </div>

            <div className="flex justify-end lg:justify-center">
              <DocumentNotificationsDialog notifications={notifications} documentTitleById={documentTitleById} />
            </div>
          </div>
        </section>

        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>申请材料暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-lg font-black">申请材料清单</h2><p className="mt-1 text-xs app-muted-text">已准备 {documents.filter((item) => item.status !== "not_started").length} 项，“已准备”状态必须提交文件，提交后由管理员处理审核状态。</p></div>
            {documents.length === 0 && !error && <form action={initializeApplicationDocumentsAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><ClipboardCheck size={16} />生成标准清单</button></form>}
          </div>

          {documents.length > 0 ? (
            <div className="space-y-6">
              {categoryGroups.map(({ category, items }) => {
                const CategoryIcon = CATEGORY_ICONS[category] ?? FolderOpen;
                const categoryApprovedCount = items.filter((item) => item.status === "approved").length;
                return (
                  <div key={category}>
                    <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2.5" style={{ borderColor: "var(--app-border-soft)" }}>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><CategoryIcon size={14} /></span>
                        <h3 className="text-sm font-black">{CATEGORY_LABELS[category] ?? category}</h3>
                      </div>
                      <span className="app-muted-text text-[11px] font-bold">{categoryApprovedCount}/{items.length} 已确认</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((document) => {
                        const tone = STATUS_TONES[document.status] ?? STATUS_TONES.not_started;
                        const isEditable = ["not_started", "preparing", "pending_review", "revision_required"].includes(document.status);
                        const dueMeta = getDueMeta(document.due_date, document.status);
                        const submittedLabel = formatShortDate(document.submitted_at);
                        return (
                          <article key={document.id} className="app-soft-card rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--app-shadow)]">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}><StatusIcon status={document.status} /></span>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-black">{document.title}</h3>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[document.status] ?? document.status}</span>
                                  {dueMeta && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black" style={{ color: dueMeta.color, backgroundColor: dueMeta.soft }}><CalendarClock size={11} />{dueMeta.label}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                              {document.original_file_name ? (
                                <div>
                                  <div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-xs font-black">{document.original_file_name}</p><span className="app-muted-text shrink-0 text-[10px] font-bold">{formatFileSize(document.file_size_bytes)}</span></div>
                                  {submittedLabel && <p className="app-muted-text mt-1 text-[10px]">提交于 {submittedLabel}</p>}
                                </div>
                              ) : (
                                <p className="app-muted-text text-xs">尚未提交文件</p>
                              )}
                              {document.review_note && <div className="mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-5" style={{ color: document.status === "revision_required" ? "var(--app-warm)" : "var(--app-muted)", backgroundColor: document.status === "revision_required" ? "var(--app-warm-soft)" : "var(--app-soft-bg)" }}><b>审核：</b>{document.review_note}</div>}
                            </div>

                            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                              {isEditable ? (
                                <ApplicationDocumentForm documentId={document.id} currentStatus={document.status} />
                              ) : (
                                <div className="flex items-start gap-2 text-xs leading-5 app-muted-text">
                                  {document.status === "approved" ? <CheckCircle2 className="mt-0.5 shrink-0" size={15} style={{ color: "var(--app-success)" }} /> : <Clock3 className="mt-0.5 shrink-0" size={15} style={{ color: "var(--app-accent)" }} />}
                                  <span>{document.status === "pending_review" ? "材料已提交，等待管理员开始审核。" : document.status === "reviewing" ? "管理员正在核对文件，请耐心等待审核结果。" : "这份材料已经确认，无需继续操作。"}</span>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
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
