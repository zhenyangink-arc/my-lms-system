import Link from "next/link";
import {
  CalendarPlus2,
  CheckCircle2,
  CircleUserRound,
  Crown,
  Filter,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";

import { requireExecutive } from "@/lib/admin";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardPageHeader } from "../../DashboardPageHeader";
import { AccountCard, type AccountListProfile } from "./AccountCard";
import { AccountAuditLogDialog, AccountDeletionAuditDialog } from "./AccountActivityDialogs";
import { AccountCreator } from "./AccountCreator";

type AccountAuditLog = {
  id: number;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  changed_fields: string[] | null;
  created_at: string;
};

type AccountDeletionAuditLog = {
  id: number;
  target_user_id: string;
  target_email: string | null;
  target_full_name: string | null;
  target_role: string | null;
  deletion_reason: string;
  related_data_counts: Record<string, number> | null;
  deleted_at: string;
};

const ROLE_FILTERS = [
  { value: "all", label: "全部账号" },
  { value: "ceo", label: "负责人" },
  { value: "admin", label: "管理员" },
  { value: "teacher", label: "老师" },
  { value: "student", label: "学生" },
];

const STATUS_FILTERS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "inactive", label: "已停用" },
  { value: "suspended", label: "暂停" },
];

const MEMBERSHIP_FILTERS = [
  { value: "all", label: "全部会员档位" },
  { value: "normal", label: "普通学生" },
  { value: "vip1", label: "VIP1 学生" },
  { value: "vip2", label: "VIP2 学生" },
  { value: "vip3", label: "VIP3 学生" },
];

const PROFILE_FILTERS = [
  { value: "all", label: "全部资料状态" },
  { value: "started", label: "资料已建档" },
  { value: "pending", label: "等待完善资料" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "最新注册" },
  { value: "oldest", label: "最早注册" },
  { value: "name", label: "按姓名" },
  { value: "activity", label: "最近活跃" },
];

const GROUP_ORDER = ["ceo", "admin", "teacher", "student"] as const;
const GROUP_LABELS: Record<string, string> = {
  ceo: "运营负责人",
  admin: "管理员",
  teacher: "老师",
  student: "学生",
};

function buildFilterHref(values: Record<string, string>, overrides: Record<string, string>) {
  const params = new URLSearchParams({ ...values, ...overrides });

  // 默认值不写入地址，方便复制和分享筛选结果。
  for (const key of ["role", "status", "membership", "profile"]) {
    if (params.get(key) === "all") params.delete(key);
  }
  if (!params.get("q")) params.delete("q");
  if (params.get("sort") === "newest") params.delete("sort");

  const query = params.toString();
  return query ? `/dashboard/admin/accounts?${query}` : "/dashboard/admin/accounts";
}

function AccountMetric({ label, value, hint, icon: Icon, tone = "accent" }: { label: string; value: number; hint: string; icon: typeof UsersRound; tone?: "accent" | "secondary" | "warm" }) {
  const color = tone === "secondary" ? "var(--app-secondary)" : tone === "warm" ? "var(--app-warm)" : "var(--app-accent)";
  const soft = tone === "secondary" ? "var(--app-secondary-soft)" : tone === "warm" ? "var(--app-warm-soft)" : "var(--app-accent-soft)";

  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-muted-text text-xs font-black">{label}</p>
          <p className="mt-1.5 text-2xl font-black tracking-tight">{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color, backgroundColor: soft }}><Icon size={18} /></span>
      </div>
      <p className="app-muted-text mt-1.5 text-xs">{hint}</p>
    </div>
  );
}

function DistributionRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-black">{label}</span><span className="app-muted-text font-bold">{value} 人 · {percent}%</span></div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-border-soft)" }}><div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} /></div>
    </div>
  );
}

function getThirtyDaysAgoTimestamp() {
  // 动态服务端页面每次请求时重新计算统计窗口，不把时间状态带到客户端。
  return new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; membership?: string; profile?: string; q?: string; sort?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const roleFilter = ROLE_FILTERS.some((item) => item.value === params.role) ? params.role ?? "all" : "all";
  const statusFilter = STATUS_FILTERS.some((item) => item.value === params.status) ? params.status ?? "all" : "all";
  const membershipFilter = MEMBERSHIP_FILTERS.some((item) => item.value === params.membership) ? params.membership ?? "all" : "all";
  const profileFilter = PROFILE_FILTERS.some((item) => item.value === params.profile) ? params.profile ?? "all" : "all";
  const sort = SORT_OPTIONS.some((item) => item.value === params.sort) ? params.sort ?? "newest" : "newest";
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const deletedStatus = params.deleted === "cleanup" ? "cleanup" : params.deleted === "1" ? "success" : null;

  const { supabase, role: viewerRole } = await requireExecutive();
  const [profilesResult, auditResult, deletionAuditResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier")
      .neq("role", "tenant_super_admin")
      .order("registered_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("account_management_audit_logs")
      .select("id, actor_id, target_user_id, action, changed_fields, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    viewerRole === "tenant_super_admin" || viewerRole === "platform_super_admin"
      ? supabase
          .from("account_deletion_audit_logs")
          .select("id, target_user_id, target_email, target_full_name, target_role, deletion_reason, related_data_counts, deleted_at")
          .order("deleted_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw new Error("账号列表加载失败，请稍后重试。");

  const allProfiles = (profilesResult.data as AccountListProfile[] | null) ?? [];
  const auditLogs = auditResult.error ? [] : ((auditResult.data as AccountAuditLog[] | null) ?? []);
  const deletionAuditLogs = deletionAuditResult.error ? [] : ((deletionAuditResult.data as AccountDeletionAuditLog[] | null) ?? []);
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");

  let profiles = allProfiles.filter((profile) => {
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStatus = statusFilter === "all" || profile.status === statusFilter;
    const matchesMembership = membershipFilter === "all" || (profile.role === "student" && normalizeMembershipTier(profile.membership_tier) === membershipFilter);
    const matchesProfile = profileFilter === "all" || (profileFilter === "started" ? Boolean(profile.profile_completed_at) : !profile.profile_completed_at);
    const searchableText = `${profile.full_name ?? ""} ${profile.email ?? ""} ${profile.id.slice(-8)}`.toLocaleLowerCase("zh-CN");
    return matchesRole && matchesStatus && matchesMembership && matchesProfile && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });

  profiles = [...profiles].sort((a, b) => {
    const aRegistered = new Date(a.registered_at || a.created_at).getTime();
    const bRegistered = new Date(b.registered_at || b.created_at).getTime();
    if (sort === "oldest") return aRegistered - bRegistered;
    if (sort === "name") return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "zh-CN");
    if (sort === "activity") return new Date(b.last_active_at || 0).getTime() - new Date(a.last_active_at || 0).getTime();
    return bRegistered - aRegistered;
  });

  const thirtyDaysAgo = getThirtyDaysAgoTimestamp();
  const students = allProfiles.filter((profile) => profile.role === "student");
  const activeCount = allProfiles.filter((profile) => profile.status === "active").length;
  const recentCount = allProfiles.filter((profile) => new Date(profile.registered_at || profile.created_at).getTime() >= thirtyDaysAgo).length;
  const attentionCount = allProfiles.filter((profile) => profile.status !== "active").length;
  const vipCount = students.filter((profile) => normalizeMembershipTier(profile.membership_tier) !== "normal").length;
  const pendingProfileCount = allProfiles.filter((profile) => !profile.profile_completed_at).length;
  const accountNames = Object.fromEntries(allProfiles.map((profile) => [profile.id, profile.full_name || profile.email || `账号 …${profile.id.slice(-6)}`]));

  const filterValues = { role: roleFilter, status: statusFilter, membership: membershipFilter, profile: profileFilter, q: queryText, sort };
  const hasFilters = roleFilter !== "all" || statusFilter !== "all" || membershipFilter !== "all" || profileFilter !== "all" || Boolean(queryText) || sort !== "newest";

  return (
    <>
      <DashboardPageHeader title="账号管理" description="统一查看账号身份、会员档位、资料状态与管理记录。" />

      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        {viewerRole === "tenant_super_admin" && <AccountCreator />}
        <section className="app-card relative overflow-hidden rounded-[2rem] border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: "var(--app-accent)" }} />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(620px,1.15fr)] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ShieldCheck size={15} />账号运营工作台</div>
              <h2 className="mt-3 max-w-xl text-2xl font-black tracking-tight">身份、服务权限和账号状态，一眼看清</h2>
              <p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">会员档位与后台角色独立管理，所有重要变更由数据库自动记录，便于团队复核与交接。</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <AccountMetric label="账号总数" value={allProfiles.length} hint="不含负责人账号" icon={UsersRound} />
              <AccountMetric label="正常使用" value={activeCount} hint="当前可登录" icon={UserCheck} />
              <AccountMetric label="会员学生" value={vipCount} hint="VIP1 至 VIP3" icon={Crown} tone="secondary" />
              <AccountMetric label="近 30 天" value={recentCount} hint="新注册账号" icon={CalendarPlus2} />
              <AccountMetric label="需要关注" value={attentionCount} hint="暂停或停用" icon={UserRoundX} tone="warm" />
            </div>
          </div>
        </section>

        {deletedStatus && <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${deletedStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><CheckCircle2 className="mt-0.5 shrink-0" size={18} /><span>{deletedStatus === "success" ? "账号及其关联数据已经永久删除，负责人审计记录已保留。" : "账号和数据库记录已经删除，但少量私有文件未能自动清理，请检查存储空间。"}</span></div>}

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
          <form action="/dashboard/admin/accounts" method="get" className="grid gap-3 xl:grid-cols-[minmax(250px,1fr)_170px_180px_180px_auto]">
            <input type="hidden" name="role" value={roleFilter} />
            <input type="hidden" name="status" value={statusFilter} />
            <label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3"><Search className="app-muted-text shrink-0" size={18} /><span className="sr-only">搜索姓名、邮箱或账号编号</span><input name="q" defaultValue={queryText} maxLength={80} placeholder="姓名、邮箱或末尾编号" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-50" /></label>
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Crown className="app-muted-text" size={16} /><span className="sr-only">会员档位</span><select name="membership" defaultValue={membershipFilter} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{MEMBERSHIP_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><CircleUserRound className="app-muted-text" size={16} /><span className="sr-only">资料状态</span><select name="profile" defaultValue={profileFilter} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{PROFILE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Filter className="app-muted-text" size={16} /><span className="sr-only">排序方式</span><select name="sort" defaultValue={sort} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <button type="submit" className="rounded-2xl px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: "var(--app-accent)" }}>应用筛选</button>
          </form>

          <div className="mt-5 grid gap-4 border-t pt-5 xl:grid-cols-[1fr_auto] xl:items-center" style={{ borderColor: "var(--app-border)" }}>
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">{ROLE_FILTERS.map((item) => <Link key={item.value} href={buildFilterHref(filterValues, { role: item.value })} className="rounded-full border px-3 py-1.5 text-xs font-black transition" style={{ borderColor: roleFilter === item.value ? "var(--app-accent)" : "var(--app-border)", backgroundColor: roleFilter === item.value ? "var(--app-accent-soft)" : "transparent", color: roleFilter === item.value ? "var(--app-accent)" : "inherit" }}>{item.label}</Link>)}</div>
              <div className="flex flex-wrap gap-2">{STATUS_FILTERS.map((item) => <Link key={item.value} href={buildFilterHref(filterValues, { status: item.value })} className="rounded-full border px-3 py-1.5 text-xs font-black transition" style={{ borderColor: statusFilter === item.value ? "var(--app-secondary)" : "var(--app-border)", backgroundColor: statusFilter === item.value ? "var(--app-secondary-soft)" : "transparent", color: statusFilter === item.value ? "var(--app-secondary)" : "inherit" }}>{item.label}</Link>)}</div>
            </div>
            <div className="flex items-center gap-3"><span className="app-muted-text text-xs font-bold">找到 {profiles.length} 个账号</span>{hasFilters && <Link href="/dashboard/admin/accounts" className="text-xs font-black" style={{ color: "var(--app-accent)" }}>清除全部筛选</Link>}</div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="app-card rounded-[1.75rem] border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="app-muted-text text-xs font-black">账号结构</p><h2 className="mt-1 text-xl font-black">团队与学生分布</h2></div><UsersRound size={22} style={{ color: "var(--app-accent)" }} /></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">{ROLE_FILTERS.filter((item) => item.value !== "all").map((item, index) => <DistributionRow key={item.value} label={item.label} value={allProfiles.filter((profile) => profile.role === item.value).length} total={allProfiles.length} color={["var(--app-secondary)", "var(--app-accent)", "var(--app-warm)", "#6bbf8b"][index]} />)}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">普通学生</p><p className="mt-2 text-2xl font-black">{students.filter((profile) => normalizeMembershipTier(profile.membership_tier) === "normal").length}</p><p className="app-muted-text mt-1 text-xs">基础浏览权限</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">会员学生</p><p className="mt-2 text-2xl font-black">{vipCount}</p><p className="app-muted-text mt-1 text-xs">已开通服务</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">资料待完善</p><p className="mt-2 text-2xl font-black">{pendingProfileCount}</p><p className="app-muted-text mt-1 text-xs">建议顾问跟进</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">状态异常</p><p className="mt-2 text-2xl font-black">{attentionCount}</p><p className="app-muted-text mt-1 text-xs">暂停或停用</p></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <AccountAuditLogDialog logs={auditLogs} accountNames={accountNames} />
            {(viewerRole === "tenant_super_admin" || viewerRole === "platform_super_admin") && <AccountDeletionAuditDialog logs={deletionAuditLogs} />}
          </div>
        </section>

        <div className="space-y-5">
          {GROUP_ORDER.map((role) => {
            const groupProfiles = profiles.filter((profile) => profile.role === role);
            if (groupProfiles.length === 0) return null;
            return (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-3"><h2 className="text-lg font-black tracking-tight">{GROUP_LABELS[role]}</h2><span className="app-soft-card rounded-full border px-2.5 py-1 text-xs font-black">{groupProfiles.length} 人</span><div className="h-px flex-1" style={{ backgroundColor: "var(--app-border)" }} /></div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">{groupProfiles.map((profile) => <AccountCard key={profile.id} profile={profile} viewerRole={viewerRole} />)}</div>
              </section>
            );
          })}

          {profiles.length === 0 && (
            <div className="app-card rounded-[1.75rem] border border-dashed p-8 text-center"><Search className="mx-auto opacity-25" size={36} /><p className="mt-4 font-black">没有找到符合条件的账号</p><p className="app-muted-text mt-2 text-sm">可以换一个姓名、邮箱、编号或筛选条件再试。</p><Link href="/dashboard/admin/accounts" className="mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>查看全部账号</Link></div>
          )}
        </div>
      </div>
    </>
  );
}
