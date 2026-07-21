import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Crown,
  FileSearch,
  FileText,
  Filter,
  Search,
  UsersRound,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardPageHeader } from "../../DashboardPageHeader";


export const runtime = "edge";
type ChecklistDocument = {
  id: string;
  user_id: string;
  title: string;
  status: "preparing" | "completed" | "not_needed";
  updated_at: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

const STATUS_FILTERS = [
  { value: "all", label: "全部申请表" },
  { value: "preparing", label: "准备中" },
  { value: "completed", label: "已完成" },
  { value: "not_needed", label: "无" },
];

const STATUS_LABELS: Record<string, string> = {
  preparing: "准备中",
  completed: "已完成",
  not_needed: "无",
};

const STATUS_TONES: Record<string, { color: string; soft: string }> = {
  preparing: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  completed: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  not_needed: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
};

function formatDate(value: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function buildFilterHref(status: string, q: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/dashboard/admin/documents?${query}` : "/dashboard/admin/documents";
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = STATUS_FILTERS.some((item) => item.value === params.status)
    ? params.status ?? "all"
    : "all";
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");
  const { supabase } = await requireAdmin();

  const { data: documentsData, error } = await supabase
    .from("student_application_documents")
    .select("id, user_id, title, status, updated_at")
    .order("updated_at", { ascending: false });

  const documents = (documentsData ?? []) as ChecklistDocument[];
  const userIds = [...new Set(documents.map((document) => document.user_id))];
  const profilesResult = userIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email, membership_tier").in("id", userIds)
    : { data: [], error: null };
  const profiles = new Map(
    ((profilesResult.data ?? []) as StudentProfile[]).map((profile) => [profile.id, profile])
  );

  const matchingDocuments = documents.filter((document) => {
    const profile = profiles.get(document.user_id);
    const matchesStatus = statusFilter === "all" || document.status === statusFilter;
    const searchable = `${document.title} ${profile?.full_name ?? ""} ${profile?.email ?? ""}`.toLocaleLowerCase("zh-CN");
    return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  const groupedStudents = new Map<string, ChecklistDocument[]>();
  for (const document of matchingDocuments) {
    const group = groupedStudents.get(document.user_id) ?? [];
    group.push(document);
    groupedStudents.set(document.user_id, group);
  }

  const studentGroups = [...groupedStudents.entries()]
    .map(([userId, matchedDocuments]) => {
      const allStudentDocuments = documents.filter((document) => document.user_id === userId);
      const latestDocument = [...allStudentDocuments].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      return { userId, profile: profiles.get(userId), matchedDocuments, allStudentDocuments, latestDocument };
    })
    .sort(
      (a, b) =>
        new Date(b.latestDocument?.updated_at || 0).getTime() -
        new Date(a.latestDocument?.updated_at || 0).getTime()
    );

  const preparingCount = documents.filter((item) => item.status === "preparing").length;
  const completedCount = documents.filter((item) => item.status === "completed").length;
  const notNeededCount = documents.filter((item) => item.status === "not_needed").length;
  const completionPercent = documents.length > 0
    ? Math.round(((completedCount + notNeededCount) / documents.length) * 100)
    : 0;

  return (
    <>
      <DashboardPageHeader title="申请资料管理" description="按学生查看各目标大学申请资料清单与完成进度。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5 lg:p-8">
        {params.deleted && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">申请资料卡及其中的清单项目已经删除；学生账号和其他数据保持不变。</div>}

        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] xl:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><FileText size={15} />学生资料清单</span><h2 className="mt-3 text-2xl font-black tracking-tight">以学生为单位管理目标大学申请资料</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">目标大学进入准备资料后会出现在这里。进入学生详情，可以查看完成进度，并为每份申请表增加或删除清单项目。</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["学生数", userIds.length, UsersRound, "var(--app-accent)"],
                ["准备中", preparingCount, Clock3, "var(--app-secondary)"],
                ["已完成", completedCount, CheckCircle2, "var(--app-success)"],
                ["完成率", `${completionPercent}%`, FileText, "var(--app-warm)"],
              ].map(([label, value, Icon, color]) => {
                const MetricIcon = Icon as typeof FileText;
                return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><MetricIcon className="mx-auto" size={18} style={{ color: String(color) }} /><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text mt-1 text-xs font-black">{String(label)}</p></div>;
              })}
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">申请资料暂时无法读取，请确认数据库迁移已经完成。</div>}

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
          <form action="/dashboard/admin/documents" className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
            <label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3"><Search className="app-muted-text" size={17} /><span className="sr-only">搜索学生</span><input name="q" defaultValue={queryText} placeholder="搜索学生姓名、邮箱或材料名称" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Filter className="app-muted-text" size={16} /><span className="sr-only">资料状态</span><select name="status" defaultValue={statusFilter} className="min-w-0 flex-1 bg-transparent text-xs font-bold">{STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <button type="submit" className="rounded-2xl px-6 py-3 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>查找学生</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>{STATUS_FILTERS.map((item) => <Link key={item.value} href={buildFilterHref(item.value, queryText)} className="rounded-full border px-3 py-1.5 text-xs font-black" style={{ color: statusFilter === item.value ? "var(--app-accent)" : "inherit", backgroundColor: statusFilter === item.value ? "var(--app-accent-soft)" : "transparent", borderColor: statusFilter === item.value ? "var(--app-accent)" : "var(--app-border)" }}>{item.label}</Link>)}<span className="app-muted-text ml-auto text-xs font-bold">找到 {studentGroups.length} 名学生</span></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {studentGroups.map(({ userId, profile, matchedDocuments, allStudentDocuments, latestDocument }) => {
            const displayName = profile?.full_name || "未填写姓名";
            const studentPreparingCount = allStudentDocuments.filter((item) => item.status === "preparing").length;
            const studentCompletedCount = allStudentDocuments.filter((item) => item.status === "completed").length;
            const studentNotNeededCount = allStudentDocuments.filter((item) => item.status === "not_needed").length;
            const progress = allStudentDocuments.length > 0
              ? Math.round(((studentCompletedCount + studentNotNeededCount) / allStudentDocuments.length) * 100)
              : 0;
            return (
              <Link key={userId} href={`/dashboard/admin/documents/${userId}`} className="app-card group rounded-[1.65rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate text-lg font-black">{displayName}</h3><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={17} /></div><p className="app-muted-text mt-1 truncate text-xs">{profile?.email || `账号 …${userId.slice(-6)}`}</p><span className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Crown size={11} />{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)]}</span></div></div>
                <div className="mt-4 grid grid-cols-3 gap-2"><div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{studentPreparingCount}</p><p className="app-muted-text text-xs font-bold">准备中</p></div><div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{studentCompletedCount}</p><p className="app-muted-text text-xs font-bold">已完成</p></div><div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{progress}%</p><p className="app-muted-text text-xs font-bold">完成率</p></div></div>
                <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}><div className="flex flex-wrap gap-1.5">{matchedDocuments.slice(0, 3).map((document) => { const tone = STATUS_TONES[document.status] ?? STATUS_TONES.preparing; return <span key={document.id} className="rounded-full px-2 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{document.title} · {STATUS_LABELS[document.status]}</span>; })}</div><p className="app-muted-text mt-3 text-xs">最近更新：{formatDate(latestDocument?.updated_at ?? null)}</p></div>
              </Link>
            );
          })}

          {studentGroups.length === 0 && <div className="app-card col-span-full rounded-[1.75rem] border border-dashed p-8 text-center"><FileSearch className="mx-auto opacity-30" size={34} /><p className="mt-3 font-black">当前没有符合条件的学生申请表</p><p className="app-muted-text mt-2 text-sm">学生把目标大学调整为“准备资料”后，会自动出现在这里。</p><Link href="/dashboard/admin/documents?status=all" className="mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>查看全部申请表</Link></div>}
        </section>
      </div>
    </>
  );
}
