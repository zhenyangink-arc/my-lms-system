import Link from "next/link";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
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
import { createAdminClient } from "@/lib/supabase/admin";
import { AccountCard, type AccountListProfile } from "./AccountCard";
import { AccountAuditLogDialog, AccountDeletionAuditDialog } from "./AccountActivityDialogs";
import { AccountCreator } from "./AccountCreator";
import { PlatformAccountCreator } from "./PlatformAccountCreator";
import { PlatformAccountTableActions } from "./PlatformAccountTableActions";
import { STATUS_LABELS } from "./permissions";


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

const TENANT_ROLE_FILTERS = [
  { value: "all", label: "全部账号" },
  { value: "ceo", label: "负责人" },
  { value: "admin", label: "管理员" },
  { value: "teacher", label: "老师" },
  { value: "student", label: "学生" },
];

const PLATFORM_ROLE_FILTERS = [
  { value: "all", label: "全部平台账号" },
  { value: "platform_deputy", label: "平台副负责人" },
  { value: "platform_admin", label: "平台管理员" },
  { value: "platform_course_inspector", label: "平台课程巡检员" },
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

const TENANT_GROUP_ORDER = ["ceo", "admin", "teacher", "student"] as const;
const PLATFORM_GROUP_ORDER = [
  "platform_deputy",
  "platform_admin",
  "platform_course_inspector",
] as const;
const GROUP_LABELS: Record<string, string> = {
  platform_deputy: "平台副负责人",
  platform_admin: "平台管理员",
  platform_course_inspector: "平台课程巡检员",
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
    <div className="app-soft-card rounded-2xl border" title={hint}>
      <span className="flex items-center justify-center rounded-xl" style={{ color, backgroundColor: soft }}><Icon size={16} /></span>
      <p className="font-black tracking-tight">{value}</p>
      <p className="app-muted-text text-xs font-black">{label}</p>
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

const PLATFORM_ROLE_TONES: Record<string, { color: string; backgroundColor: string }> = {
  platform_deputy: { color: "#8a5a16", backgroundColor: "#fff7df" },
  platform_admin: { color: "#235fa6", backgroundColor: "#edf5ff" },
  platform_course_inspector: { color: "#7a4aa0", backgroundColor: "#f7efff" },
};

const PLATFORM_STATUS_TONES: Record<string, { dot: string; text: string }> = {
  active: { dot: "#1f9d68", text: "#18754f" },
  inactive: { dot: "#9ca3af", text: "#6b7280" },
  suspended: { dot: "#e89b24", text: "#a5650d" },
};

function formatPlatformAccountTime(value: string | null | undefined, includeTime = false) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "待确认";

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function PlatformAccountsView({
  allProfiles,
  profiles,
  roleFilter,
  statusFilter,
  queryText,
  sort,
  hasFilters,
  viewerRole,
}: {
  allProfiles: AccountListProfile[];
  profiles: AccountListProfile[];
  roleFilter: string;
  statusFilter: string;
  queryText: string;
  sort: string;
  hasFilters: boolean;
  viewerRole: string;
}) {
  const activeCount = allProfiles.filter((profile) => profile.status === "active").length;
  const deputyCount = allProfiles.filter((profile) => profile.role === "platform_deputy").length;
  const adminCount = allProfiles.filter((profile) => profile.role === "platform_admin").length;
  const inspectorCount = allProfiles.filter((profile) => profile.role === "platform_course_inspector").length;
  const canManage = viewerRole === "platform_super_admin";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 sm:p-5">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="app-muted-text text-[11px] font-semibold tracking-[0.16em]">账号与权限</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">平台账号</h1>
            <p className="app-muted-text mt-1 text-xs">只管理直属平台的后台成员，不包含任何机构负责人、老师或学生。</p>
          </div>
          {canManage && <PlatformAccountCreator />}
        </div>
        <div className="grid border-t sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: "var(--app-border)" }}>
          {[
            ["账号总数", allProfiles.length],
            ["正常使用", activeCount],
            ["副负责人", deputyCount],
            ["平台管理员", adminCount],
            ["课程巡检员", inspectorCount],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`px-5 py-3 ${index > 0 ? "sm:border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""}`}
              style={{ borderColor: "var(--app-border)" }}
            >
              <p className="app-muted-text text-[11px] font-medium">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <form action="/dashboard/admin/accounts" method="get" className="grid gap-2 border-b p-3 md:grid-cols-[minmax(240px,1fr)_170px_145px_145px_auto]" style={{ borderColor: "var(--app-border)" }}>
          <label className="app-input flex h-9 items-center gap-2 rounded-md border px-2.5">
            <Search className="app-muted-text shrink-0" size={14} />
            <span className="sr-only">搜索平台账号</span>
            <input name="q" defaultValue={queryText} maxLength={80} placeholder="搜索姓名、登录账号或编号" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-50" />
          </label>
          <label>
            <span className="sr-only">平台角色</span>
            <select name="role" defaultValue={roleFilter} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
              {PLATFORM_ROLE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">账号状态</span>
            <select name="status" defaultValue={statusFilter} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
              {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">排序方式</span>
            <select name="sort" defaultValue={sort} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium">
              {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800">筛选</button>
        </form>

        <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-[11px]" style={{ borderColor: "var(--app-border)" }}>
          <span className="app-muted-text">当前显示 {profiles.length} / {allProfiles.length} 个平台账号</span>
          {hasFilters && <Link href="/dashboard/admin/accounts" className="font-semibold hover:underline">清除筛选</Link>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-collapse text-left">
            <thead>
              <tr className="border-b text-[11px] font-medium" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}>
                <th className="px-4 py-2.5 font-medium">账号</th>
                <th className="px-4 py-2.5 font-medium">平台角色</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">最近活跃</th>
                <th className="px-4 py-2.5 font-medium">创建时间</th>
                <th className="px-4 py-2.5 font-medium">账号编号</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const displayName = profile.full_name || "未命名账号";
                const roleTone = PLATFORM_ROLE_TONES[profile.role] ?? PLATFORM_ROLE_TONES.platform_admin;
                const statusTone = PLATFORM_STATUS_TONES[profile.status] ?? PLATFORM_STATUS_TONES.inactive;
                const registeredAt = profile.registered_at || profile.created_at;
                const loginId = profile.login_id || profile.email?.split("@")[0] || "登录账号待同步";

                return (
                  <tr key={profile.id} className="border-b text-xs transition last:border-b-0 hover:bg-black/[0.018]" style={{ borderColor: "var(--app-border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>{displayName.slice(0, 1)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{displayName}</p>
                          <p className="app-muted-text mt-0.5 truncate text-[11px]">{loginId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold" style={roleTone}>{GROUP_LABELS[profile.role] ?? profile.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium" style={{ color: statusTone.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusTone.dot }} />{STATUS_LABELS[profile.status] ?? profile.status}</span>
                    </td>
                    <td className="app-muted-text px-4 py-3 tabular-nums">{formatPlatformAccountTime(profile.last_active_at, true)}</td>
                    <td className="app-muted-text px-4 py-3 tabular-nums">{formatPlatformAccountTime(registeredAt)}</td>
                    <td className="app-muted-text px-4 py-3 font-mono text-[11px]">…{profile.id.slice(-8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/admin/accounts/${profile.id}`} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]">详情</Link>
                        {canManage && <PlatformAccountTableActions profile={profile} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {profiles.length === 0 && (
          <div className="border-t px-5 py-12 text-center" style={{ borderColor: "var(--app-border)" }}>
            <p className="text-sm font-semibold">没有符合条件的平台账号</p>
            <p className="app-muted-text mt-1 text-xs">请调整搜索词、角色或状态后再试。</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; membership?: string; profile?: string; q?: string; sort?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const requestedRoleFilter = params.role ?? "all";
  const statusFilter = STATUS_FILTERS.some((item) => item.value === params.status) ? params.status ?? "all" : "all";
  const membershipFilter = MEMBERSHIP_FILTERS.some((item) => item.value === params.membership) ? params.membership ?? "all" : "all";
  const profileFilter = PROFILE_FILTERS.some((item) => item.value === params.profile) ? params.profile ?? "all" : "all";
  const sort = SORT_OPTIONS.some((item) => item.value === params.sort) ? params.sort ?? "newest" : "newest";
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const deletedStatus = params.deleted === "cleanup" ? "cleanup" : params.deleted === "1" ? "success" : null;

  const { tenant, role: viewerRole } = await requireExecutive();
  const roleFilters = tenant ? TENANT_ROLE_FILTERS : PLATFORM_ROLE_FILTERS;
  const roleFilter = roleFilters.some((item) => item.value === requestedRoleFilter)
    ? requestedRoleFilter
    : "all";
  const groupOrder = tenant ? TENANT_GROUP_ORDER : PLATFORM_GROUP_ORDER;
  const admin = createAdminClient();
  const { data: membershipData, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("user_id, role, status, membership_tier")
    .match(tenant ? { tenant_id: tenant.id } : {});
  if (membershipError) {
    throw new Error("无法确认机构账号范围，请稍后重试。");
  }
  const membershipUserIds = new Set(
    (membershipData ?? []).map((item) => String(item.user_id))
  );
  const membershipByUserId = new Map(
    (membershipData ?? []).map((item) => [String(item.user_id), item])
  );
  const [profilesResult, auditResult, deletionAuditResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, login_id, role, global_role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier")
      .neq("role", "tenant_super_admin")
      .order("registered_at", { ascending: false, nullsFirst: false }),
    tenant
      ? admin
          .from("account_management_audit_logs")
          .select("id, actor_id, target_user_id, action, changed_fields, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    tenant && viewerRole === "tenant_super_admin"
      ? admin
          .from("account_deletion_audit_logs")
          .select("id, target_user_id, target_email, target_full_name, target_role, deletion_reason, related_data_counts, deleted_at")
          .eq("tenant_id", tenant.id)
          .order("deleted_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw new Error("账号列表加载失败，请稍后重试。");

  const visibleProfiles =
    (profilesResult.data as AccountListProfile[] | null) ?? [];
  const allProfiles = visibleProfiles
    .filter((profile) =>
      tenant
        ? membershipUserIds.has(profile.id)
        : !membershipUserIds.has(profile.id) &&
          (profile.global_role === "platform_deputy" ||
            profile.global_role === "platform_admin" ||
            profile.global_role === "platform_course_inspector")
    )
    .map((profile) => {
      if (!tenant) {
        return {
          ...profile,
          role: profile.global_role ?? profile.role,
        };
      }
      const membership = membershipByUserId.get(profile.id);
      return membership
        ? {
            ...profile,
            role: membership.role,
            status: membership.status,
            membership_tier: membership.membership_tier,
          }
        : profile;
    });
  const auditLogs = auditResult.error ? [] : ((auditResult.data as AccountAuditLog[] | null) ?? []);
  const deletionAuditLogs = deletionAuditResult.error ? [] : ((deletionAuditResult.data as AccountDeletionAuditLog[] | null) ?? []);
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");

  let profiles = allProfiles.filter((profile) => {
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStatus = statusFilter === "all" || profile.status === statusFilter;
    const matchesMembership = !tenant || membershipFilter === "all" || (profile.role === "student" && normalizeMembershipTier(profile.membership_tier) === membershipFilter);
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
  const hasFilters = roleFilter !== "all" || statusFilter !== "all" || (Boolean(tenant) && membershipFilter !== "all") || profileFilter !== "all" || Boolean(queryText) || sort !== "newest";

  if (!tenant) {
    return (
      <PlatformAccountsView
        allProfiles={allProfiles}
        profiles={profiles}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        queryText={queryText}
        sort={sort}
        hasFilters={hasFilters}
        viewerRole={viewerRole}
      />
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <section className="app-card relative overflow-hidden rounded-[2rem] border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: "var(--app-accent)" }} />
          <div className={`relative grid gap-5 xl:items-center ${tenant ? "xl:grid-cols-[minmax(0,0.85fr)_minmax(620px,1.15fr)]" : "xl:grid-cols-[minmax(0,1fr)_420px]"}`}>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ShieldCheck size={15} />账号运营工作台</div>
              <DashboardTitleWithHint
                className="mt-3"
                title="账号管理"
                description={tenant
                  ? "统一查看本机构账号身份、会员档位、资料状态与管理记录。"
                  : "管理未归属机构的平台账号，并配置管理员等后台角色。"}
              />
            </div>
            <div className="dashboard-title-metrics">
              <AccountMetric label={tenant ? "账号总数" : "平台账号"} value={allProfiles.length} hint={tenant ? "不含负责人账号" : "不含平台负责人"} icon={UsersRound} />
              <AccountMetric label="正常使用" value={activeCount} hint="当前可登录" icon={UserCheck} />
              {tenant && <AccountMetric label="会员学生" value={vipCount} hint="VIP1 至 VIP3" icon={Crown} tone="secondary" />}
              {tenant && <AccountMetric label="近 30 天" value={recentCount} hint="新注册账号" icon={CalendarPlus2} />}
              <AccountMetric label="需要关注" value={attentionCount} hint="暂停或停用" icon={UserRoundX} tone="warm" />
            </div>
          </div>
        </section>

        {tenant && viewerRole === "tenant_super_admin" && <AccountCreator />}
        {!tenant && viewerRole === "platform_super_admin" && <PlatformAccountCreator />}

        {tenant && deletedStatus && <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${deletedStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><CheckCircle2 className="mt-0.5 shrink-0" size={18} /><span>{deletedStatus === "success" ? "账号及其关联数据已经永久删除，负责人审计记录已保留。" : "账号和数据库记录已经删除，但少量私有文件未能自动清理，请检查存储空间。"}</span></div>}

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
          <form action="/dashboard/admin/accounts" method="get" className={`grid gap-3 ${tenant ? "xl:grid-cols-[minmax(250px,1fr)_170px_180px_180px_auto]" : "xl:grid-cols-[minmax(320px,1fr)_180px_180px_auto]"}`}>
            <input type="hidden" name="role" value={roleFilter} />
            <input type="hidden" name="status" value={statusFilter} />
            <label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3"><Search className="app-muted-text shrink-0" size={18} /><span className="sr-only">搜索姓名、邮箱或账号编号</span><input name="q" defaultValue={queryText} maxLength={80} placeholder="姓名、邮箱或末尾编号" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-50" /></label>
            {tenant ? <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Crown className="app-muted-text" size={16} /><span className="sr-only">会员档位</span><select name="membership" defaultValue={membershipFilter} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{MEMBERSHIP_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label> : <input type="hidden" name="membership" value="all" />}
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><CircleUserRound className="app-muted-text" size={16} /><span className="sr-only">资料状态</span><select name="profile" defaultValue={profileFilter} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{PROFILE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="app-input flex items-center gap-2 rounded-2xl border px-3 py-3"><Filter className="app-muted-text" size={16} /><span className="sr-only">排序方式</span><select name="sort" defaultValue={sort} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none">{SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <button type="submit" className="rounded-2xl px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: "var(--app-accent)" }}>应用筛选</button>
          </form>

          <div className="mt-5 grid gap-4 border-t pt-5 xl:grid-cols-[1fr_auto] xl:items-center" style={{ borderColor: "var(--app-border)" }}>
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">{roleFilters.map((item) => <Link key={item.value} href={buildFilterHref(filterValues, { role: item.value })} className="rounded-full border px-3 py-1.5 text-xs font-black transition" style={{ borderColor: roleFilter === item.value ? "var(--app-accent)" : "var(--app-border)", backgroundColor: roleFilter === item.value ? "var(--app-accent-soft)" : "transparent", color: roleFilter === item.value ? "var(--app-accent)" : "inherit" }}>{item.label}</Link>)}</div>
              <div className="flex flex-wrap gap-2">{STATUS_FILTERS.map((item) => <Link key={item.value} href={buildFilterHref(filterValues, { status: item.value })} className="rounded-full border px-3 py-1.5 text-xs font-black transition" style={{ borderColor: statusFilter === item.value ? "var(--app-secondary)" : "var(--app-border)", backgroundColor: statusFilter === item.value ? "var(--app-secondary-soft)" : "transparent", color: statusFilter === item.value ? "var(--app-secondary)" : "inherit" }}>{item.label}</Link>)}</div>
            </div>
            <div className="flex items-center gap-3"><span className="app-muted-text text-xs font-bold">找到 {profiles.length} 个账号</span>{hasFilters && <Link href="/dashboard/admin/accounts" className="text-xs font-black" style={{ color: "var(--app-accent)" }}>清除全部筛选</Link>}</div>
          </div>
        </section>

        <section className={`grid gap-4 ${tenant ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]" : ""}`}>
          <div className="app-card rounded-[1.75rem] border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="app-muted-text text-xs font-black">账号结构</p><h2 className="mt-1 text-xl font-black">{tenant ? "团队与学生分布" : "平台角色分布"}</h2></div><UsersRound size={22} style={{ color: "var(--app-accent)" }} /></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">{roleFilters.filter((item) => item.value !== "all").map((item, index) => <DistributionRow key={item.value} label={item.label} value={allProfiles.filter((profile) => profile.role === item.value).length} total={allProfiles.length} color={["var(--app-secondary)", "var(--app-accent)", "var(--app-warm)", "#6bbf8b"][index]} />)}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">{tenant ? "普通学生" : "平台副负责人"}</p><p className="mt-2 text-2xl font-black">{tenant ? students.filter((profile) => normalizeMembershipTier(profile.membership_tier) === "normal").length : allProfiles.filter((profile) => profile.role === "platform_deputy").length}</p><p className="app-muted-text mt-1 text-xs">{tenant ? "基础浏览权限" : "协助负责人管理平台"}</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">{tenant ? "会员学生" : "平台管理员"}</p><p className="mt-2 text-2xl font-black">{tenant ? vipCount : allProfiles.filter((profile) => profile.role === "platform_admin").length}</p><p className="app-muted-text mt-1 text-xs">{tenant ? "已开通服务" : "负责日常后台工作"}</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">{tenant ? "资料待完善" : "近 30 天新增"}</p><p className="mt-2 text-2xl font-black">{tenant ? pendingProfileCount : recentCount}</p><p className="app-muted-text mt-1 text-xs">{tenant ? "建议顾问跟进" : "新建平台账号"}</p></div>
                <div className="app-soft-card rounded-2xl border p-4"><p className="app-muted-text text-xs font-black">状态异常</p><p className="mt-2 text-2xl font-black">{attentionCount}</p><p className="app-muted-text mt-1 text-xs">暂停或停用</p></div>
              </div>
            </div>
          </div>

          {tenant && <div className="space-y-4">
            <AccountAuditLogDialog logs={auditLogs} accountNames={accountNames} />
            {viewerRole === "tenant_super_admin" && <AccountDeletionAuditDialog logs={deletionAuditLogs} />}
          </div>}
        </section>

        <div className="space-y-5">
          {groupOrder.map((role) => {
            const groupProfiles = profiles.filter((profile) => profile.role === role);
            if (groupProfiles.length === 0) return null;
            return (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-3"><h2 className="text-lg font-black tracking-tight">{GROUP_LABELS[role]}</h2><span className="app-soft-card rounded-full border px-2.5 py-1 text-xs font-black">{groupProfiles.length} 人</span><div className="h-px flex-1" style={{ backgroundColor: "var(--app-border)" }} /></div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">{groupProfiles.map((profile) => <AccountCard key={profile.id} profile={profile} viewerRole={viewerRole} accountScope={tenant ? "tenant" : "platform"} />)}</div>
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
