import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Filter,
  Search,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "../../DashboardPageHeader";
import { getVisaCaseStatusLabel } from "../../visa/visa-case-stages";

type VisaCase = { id: string; user_id: string; source_target_id: string | null; visa_type: string; application_channel: string; case_status: string; target_entry_date: string | null; application_city: string | null; updated_at: string };
type VisaTask = { id: string; user_id: string; title: string; status: string; updated_at: string };
type StudentProfile = { id: string; full_name: string | null; email: string | null };
type VisaTarget = { id: string; user_id: string; university_name: string; program_name: string | null; admission_track: string | null };

const VISA_TYPE_LABELS: Record<string, string> = { d4_language: "语言研修签证", d2_bachelor: "本科签证", d2_master: "硕士签证", d2_doctor: "博士签证" };
const APPLICATION_CHANNEL_LABELS: Record<string, string> = { china_consulate: "驻中韩国领事馆递签证", korea_immigration: "韩国出入境返签证" };
const ADMISSION_TRACK_LABELS: Record<string, string> = { language: "语学堂", bachelor_fresh: "大学 · 本科新入", bachelor_transfer: "大学 · 本科插班", master: "大学 · 硕士", doctor: "大学 · 博士" };
const FILTERS = [{ value: "all", label: "全部学生" }, { value: "action", label: "需要处理" }, { value: "preparing", label: "准备阶段" }, { value: "submitted", label: "已经递签" }, { value: "issued", label: "已经获签" }];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export default async function AdminVisaPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; deleted?: string }> }) {
  const params = await searchParams;
  const filter = FILTERS.some((item) => item.value === params.status) ? params.status ?? "all" : "all";
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");
  const { supabase } = await requireAdmin();

  const [casesResult, eligibilityResult] = await Promise.all([
    supabase.from("student_visa_cases").select("id, user_id, source_target_id, visa_type, application_channel, case_status, target_entry_date, application_city, updated_at").order("updated_at", { ascending: false }),
    supabase.from("student_university_targets").select("id, user_id, university_name, program_name, admission_track").gte("application_stage", 9),
  ]);
  const eligibleTargets = (eligibilityResult.data ?? []) as VisaTarget[];
  const eligibleUserIds = new Set(eligibleTargets.map((target) => target.user_id));
  const targetById = new Map(eligibleTargets.map((target) => [target.id, target]));
  const targetByUserId = new Map(eligibleTargets.map((target) => [target.user_id, target]));
  const cases = ((casesResult.data ?? []) as VisaCase[]).filter((visaCase) => eligibleUserIds.has(visaCase.user_id));
  const error = casesResult.error || eligibilityResult.error;
  const userIds = cases.map((item) => item.user_id);
  const [profilesResult, tasksResult] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? supabase.from("student_visa_tasks").select("id, user_id, title, status, updated_at").in("user_id", userIds).eq("is_archived", false) : Promise.resolve({ data: [], error: null }),
  ]);
  const profiles = new Map(((profilesResult.data ?? []) as StudentProfile[]).map((profile) => [profile.id, profile]));
  const tasks = (tasksResult.data ?? []) as VisaTask[];

  const filteredCases = cases.filter((visaCase) => {
    const profile = profiles.get(visaCase.user_id);
    const visaTarget = targetById.get(visaCase.source_target_id ?? "") ?? targetByUserId.get(visaCase.user_id);
    const studentTasks = tasks.filter((task) => task.user_id === visaCase.user_id);
    const needsAction = studentTasks.some((task) => ["submitted", "reviewing", "revision_required", "blocked"].includes(task.status));
    const matchesFilter = filter === "all" || (filter === "action" ? needsAction : visaCase.case_status === filter);
    const searchable = `${profile?.full_name ?? ""} ${profile?.email ?? ""} ${visaTarget?.university_name ?? ""} ${ADMISSION_TRACK_LABELS[visaTarget?.admission_track ?? ""] ?? ""} ${visaCase.application_city ?? ""} ${VISA_TYPE_LABELS[visaCase.visa_type] ?? ""} ${APPLICATION_CHANNEL_LABELS[visaCase.application_channel] ?? ""}`.toLocaleLowerCase("zh-CN");
    return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  const reviewTaskCount = tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
  const supportTaskCount = tasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length;
  const issuedCount = cases.filter((item) => item.case_status === "issued").length;

  return (
    <>
      <DashboardPageHeader title="签证管理" description="按学生跟进签证档案、准备任务、审核意见与获签进度。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5 lg:p-8">
        {params.deleted === "1" && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">签证卡、准备任务和审核记录已经删除；学生账号及其他数据保持不变。</div>}
        <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end), var(--app-success-soft))" }}><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><ShieldCheck size={15} />管理员签证工作台</span><h2 className="mt-3 text-2xl font-black">一名学生，一套完整的签证路线</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">集中查看学生签证类型、计划入境日期和每项任务，及时审核学生提交并给出补充意见。</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["签证档案", cases.length, UsersRound, "var(--app-secondary)"], ["等待审核", reviewTaskCount, FileSearch, "var(--app-accent)"], ["需要处理", supportTaskCount, TriangleAlert, "var(--app-warm)"], ["已经获签", issuedCount, CheckCircle2, "var(--app-success)"]].map(([label, value, Icon, color]) => { const MetricIcon = Icon as typeof UsersRound; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><MetricIcon className="mx-auto" size={18} style={{ color: String(color) }} /><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text mt-1 text-xs font-black">{String(label)}</p></div>; })}</div></div></section>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">签证管理数据暂时无法读取，请确认最新数据库迁移已经执行。</div>}

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5"><form action="/dashboard/admin/visa" className="grid gap-3 lg:grid-cols-[1fr_190px_auto]"><label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3"><Search className="app-muted-text" size={17} /><span className="sr-only">搜索学生</span><input name="q" defaultValue={queryText} placeholder="搜索姓名、邮箱、城市或签证类型" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Filter className="app-muted-text" size={16} /><span className="sr-only">办理阶段</span><select name="status" defaultValue={filter} className="min-w-0 flex-1 bg-transparent text-xs font-bold">{FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="submit" className="rounded-2xl px-6 py-3 text-sm font-black text-white" style={{ backgroundColor: "var(--app-success)" }}>查找学生</button></form></section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredCases.map((visaCase) => {
            const profile = profiles.get(visaCase.user_id);
            const visaTarget = targetById.get(visaCase.source_target_id ?? "") ?? targetByUserId.get(visaCase.user_id);
            const studentTasks = tasks.filter((task) => task.user_id === visaCase.user_id);
            const pendingReview = studentTasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
            const approved = studentTasks.filter((task) => task.status === "approved").length;
            const support = studentTasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length;
            const displayName = profile?.full_name || "未填写姓名";

            return (
              <Link key={visaCase.id} href={`/dashboard/admin/visa/${visaCase.user_id}`} className="app-card group rounded-[1.65rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>{displayName === "未填写姓名" ? "?" : displayName.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><h3 className="truncate text-lg font-black">{displayName}</h3><ArrowRight className="transition group-hover:translate-x-1" size={17} /></div>
                    <p className="app-muted-text mt-1 truncate text-xs">{profile?.email || `账号 …${visaCase.user_id.slice(-6)}`}</p>
                    {visaTarget && <p className="mt-2 truncate text-sm font-black">{visaTarget.university_name}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {visaTarget && <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>{ADMISSION_TRACK_LABELS[visaTarget.admission_track ?? ""] ?? "大学"}{visaTarget.program_name ? ` · ${visaTarget.program_name}` : ""}</span>}
                      <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{VISA_TYPE_LABELS[visaCase.visa_type] ?? "签证类型待定"}</span>
                      <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>{APPLICATION_CHANNEL_LABELS[visaCase.application_channel] ?? "办理通道待定"}</span>
                      <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{getVisaCaseStatusLabel(visaCase.application_channel, visaCase.case_status)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{pendingReview}</p><p className="app-muted-text text-xs">待审核</p></div>
                  <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{support}</p><p className="app-muted-text text-xs">待处理</p></div>
                  <div className="app-soft-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{approved}</p><p className="app-muted-text text-xs">已确认</p></div>
                </div>
                <div className="app-muted-text mt-4 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: "var(--app-border-soft)" }}>
                  <span>{visaCase.application_channel === "korea_immigration" ? "韩国出入境返签证" : visaCase.application_city ? `${visaCase.application_city}递签` : "递签城市待定"}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={11} />{formatDate(visaCase.updated_at)}</span>
                </div>
              </Link>
            );
          })}
          {filteredCases.length === 0 && <div className="app-card col-span-full rounded-[1.75rem] border border-dashed p-8 text-center"><ShieldCheck className="mx-auto opacity-30" size={36} /><p className="mt-3 font-black">当前没有符合条件的签证档案</p><p className="app-muted-text mt-2 text-sm">管理员点亮第 9 步“请进入申请签证页面”后，学生会自动出现在这里。</p></div>}
        </section>
      </div>
    </>
  );
}
