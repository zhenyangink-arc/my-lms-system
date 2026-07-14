import {
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileText,
  FolderCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import {
  initializeApplicationDocumentsAction,
  updateDocumentStatusAction,
} from "../planning-actions";

type ApplicationDocument = {
  id: string;
  title: string;
  category: string;
  status: string;
  due_date: string | null;
  sort_order: number;
};

const statusOptions = [
  ["not_started", "未开始"],
  ["preparing", "准备中"],
  ["uploaded", "已整理"],
  ["reviewing", "审核中"],
  ["approved", "已确认"],
  ["revision_required", "需修改"],
];
const statusLabelMap = Object.fromEntries(statusOptions);
const categoryLabelMap: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

export default async function DocumentsPage() {
  const { supabase, user } = await requireActiveUser();
  const { data, error } = await supabase
    .from("student_application_documents")
    .select("id, title, category, status, due_date, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  const documents = (data ?? []) as ApplicationDocument[];
  const approvedCount = documents.filter((item) => item.status === "approved").length;
  const activeCount = documents.filter((item) => ["preparing", "uploaded", "reviewing", "revision_required"].includes(item.status)).length;
  const completionPercent = documents.length > 0 ? Math.round((approvedCount / documents.length) * 100) : 0;

  return (
    <>
      <DashboardPageHeader title="申请材料" description="整理申请文件、审核状态和需要修改的内容。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
          <div className="grid items-center gap-7 lg:grid-cols-[1fr_330px]">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}><Sparkles size={14} /> 申请材料中心</span><h2 className="mt-5 text-3xl font-black tracking-tight">让每一份材料都有清晰状态</h2><p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">从护照、成绩单到学习计划书，按清单推进准备、审核和修改。</p></div>
            <div className="app-card rounded-3xl border p-5"><div className="flex items-end justify-between"><div><p className="text-xs font-bold app-muted-text">材料完成度</p><p className="mt-1 text-3xl font-black">{completionPercent}%</p></div><FolderCheck size={26} style={{ color: "var(--app-success)" }} /></div><div className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div><p className="mt-3 text-xs app-muted-text">已确认 {approvedCount} / {documents.length} 项</p></div>
          </div>
        </section>

        {error && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>申请材料数据表尚未连接，请先执行 Supabase 数据库迁移。</section>}

        <section className="grid grid-cols-3 gap-3">
          {[["材料总数", documents.length, FileText], ["准备进行中", activeCount, FileClock], ["已经确认", approvedCount, CheckCircle2]].map(([label, value, Icon]) => {
            const StatIcon = Icon as typeof FileText;
            return <article key={String(label)} className="app-card rounded-2xl border p-4 sm:p-5"><StatIcon size={19} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-xs font-bold app-muted-text">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></article>;
          })}
        </section>

        <section className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black">申请材料清单</h2><p className="mt-1 text-xs app-muted-text">状态会保存到个人申请档案中</p></div>{documents.length === 0 && !error && <form action={initializeApplicationDocumentsAction}><button type="submit" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><ClipboardCheck size={16} /> 生成标准清单</button></form>}</div>
          {documents.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {documents.map((document) => (
                <article key={document.id} className="app-soft-card rounded-2xl border p-4">
                  <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: document.status === "approved" ? "var(--app-success)" : "var(--app-secondary)", backgroundColor: document.status === "approved" ? "var(--app-success-soft)" : "var(--app-secondary-soft)" }}>{document.status === "approved" ? <CheckCircle2 size={18} /> : <FileText size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black">{document.title}</h3><span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>{categoryLabelMap[document.category] ?? document.category}</span></div><p className="mt-1 text-xs app-muted-text">当前状态：{statusLabelMap[document.status] ?? document.status}</p></div></div>
                  <form action={updateDocumentStatusAction.bind(null, document.id)} className="mt-4 flex items-center gap-2"><select name="status" defaultValue={document.status} className="app-input min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold outline-none">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="submit" className="rounded-xl px-3 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>更新</button></form>
                </article>
              ))}
            </div>
          ) : (
            <div className="app-soft-card flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"><ClipboardCheck size={27} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-sm font-black">还没有申请材料清单</p><p className="mt-1 text-xs app-muted-text">点击“生成标准清单”创建常用韩国留学材料。</p></div>
          )}
        </section>
      </div>
    </>
  );
}
