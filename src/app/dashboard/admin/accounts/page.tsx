import Link from "next/link";
import {
  CalendarPlus2,
  Filter,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";

import { requireExecutive } from "@/lib/admin";
import { DashboardPageHeader } from "../../DashboardPageHeader";
import { AccountCard } from "./AccountCard";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  deactivate_reason: string | null;
};

const ROLE_FILTERS = [
  { value: "all", label: "全部账号" },
  { value: "ceo", label: "CEO" },
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

const SORT_OPTIONS = [
  { value: "newest", label: "最新注册" },
  { value: "oldest", label: "最早注册" },
  { value: "name", label: "按姓名" },
];

const GROUP_ORDER = ["ceo", "admin", "teacher", "student"] as const;

const GROUP_LABELS: Record<string, string> = {
  ceo: "CEO",
  admin: "管理员",
  teacher: "老师",
  student: "学生",
};

function buildFilterHref(
  values: Record<string, string>,
  overrides: Record<string, string>
) {
  const params = new URLSearchParams({ ...values, ...overrides });

  // 空搜索词不写入地址，让分享出来的筛选链接保持干净。
  if (!params.get("q")) {
    params.delete("q");
  }

  return `/dashboard/admin/accounts?${params.toString()}`;
}

function getThirtyDaysAgoTimestamp() {
  // 服务端动态页面每次请求时计算统计窗口，不把时间状态带到客户端。
  return new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
}

function AccountMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof UsersRound;
}) {
  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-muted-text text-xs font-black">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
        >
          <Icon size={20} />
        </div>
      </div>
      <p className="app-muted-text mt-2 text-xs">{hint}</p>
    </div>
  );
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    status?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const roleFilter = ROLE_FILTERS.some((item) => item.value === params.role)
    ? params.role ?? "all"
    : "all";
  const statusFilter = STATUS_FILTERS.some((item) => item.value === params.status)
    ? params.status ?? "all"
    : "all";
  const sort = SORT_OPTIONS.some((item) => item.value === params.sort)
    ? params.sort ?? "newest"
    : "newest";
  const queryText = (params.q ?? "").trim().slice(0, 80);

  const { supabase, role: viewerRole } = await requireExecutive();

  // 一次读取账号列表后在服务端完成筛选，便于同时生成准确的全局统计。
  const { data: profilesData, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at, deactivate_reason")
    .neq("role", "super_admin")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("账号列表加载失败，请稍后重试。");
  }

  const allProfiles = (profilesData as Profile[] | null) ?? [];
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");

  let profiles = allProfiles.filter((profile) => {
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStatus = statusFilter === "all" || profile.status === statusFilter;
    const searchableText = `${profile.full_name ?? ""} ${profile.email ?? ""}`.toLocaleLowerCase("zh-CN");
    const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

    return matchesRole && matchesStatus && matchesQuery;
  });

  profiles = [...profiles].sort((a, b) => {
    if (sort === "oldest") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    if (sort === "name") {
      return (a.full_name || a.email || "").localeCompare(
        b.full_name || b.email || "",
        "zh-CN"
      );
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const thirtyDaysAgo = getThirtyDaysAgoTimestamp();
  const activeCount = allProfiles.filter((profile) => profile.status === "active").length;
  const recentCount = allProfiles.filter(
    (profile) => new Date(profile.created_at).getTime() >= thirtyDaysAgo
  ).length;
  const attentionCount = allProfiles.filter(
    (profile) => profile.status !== "active"
  ).length;

  const filterValues = {
    role: roleFilter,
    status: statusFilter,
    q: queryText,
    sort,
  };

  return (
    <>
      <DashboardPageHeader
        title="账号管理"
        description="查看注册时间、搜索账号，并安全管理角色与使用状态。"
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6">
        <section className="app-card relative overflow-hidden rounded-[2rem] border p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-15 blur-3xl"
            style={{ backgroundColor: "var(--app-accent)" }}
          />

          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_620px] xl:items-end">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}
              >
                <ShieldCheck size={15} />
                账号安全与成员档案
              </div>
              <h2 className="mt-5 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
                让每个账号的身份、状态和注册时间都有迹可循
              </h2>
              <p className="app-muted-text mt-4 max-w-2xl text-sm leading-7 sm:text-base">
                统一管理学生、老师与运营成员。账号变更会由数据库自动留下审计记录，重要操作仍受角色权限保护。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AccountMetric label="账号总数" value={allProfiles.length} hint="不含老板账号" icon={UsersRound} />
              <AccountMetric label="正常使用" value={activeCount} hint="当前可登录" icon={UserCheck} />
              <AccountMetric label="近 30 天" value={recentCount} hint="新注册账号" icon={CalendarPlus2} />
              <AccountMetric label="需要关注" value={attentionCount} hint="暂停或停用" icon={UserRoundX} />
            </div>
          </div>
        </section>

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
          <form action="/dashboard/admin/accounts" method="get" className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_auto]">
            <input type="hidden" name="role" value={roleFilter} />
            <input type="hidden" name="status" value={statusFilter} />

            <label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3">
              <Search className="app-muted-text shrink-0" size={18} />
              <span className="sr-only">搜索姓名或邮箱</span>
              <input
                name="q"
                defaultValue={queryText}
                maxLength={80}
                placeholder="搜索姓名或邮箱"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
              />
            </label>

            <label className="app-input flex items-center gap-3 rounded-2xl border px-4 py-3">
              <Filter className="app-muted-text" size={17} />
              <span className="sr-only">排序方式</span>
              <select name="sort" defaultValue={sort} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none">
                {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <button type="submit" className="rounded-2xl px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: "var(--app-accent)" }}>
              搜索账号
            </button>
          </form>

          <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--app-border)" }}>
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {ROLE_FILTERS.map((item) => (
                    <Link
                      key={item.value}
                      href={buildFilterHref(filterValues, { role: item.value })}
                      className="rounded-full border px-3 py-1.5 text-xs font-black transition"
                      style={{
                        borderColor: roleFilter === item.value ? "var(--app-accent)" : "var(--app-border)",
                        backgroundColor: roleFilter === item.value ? "var(--app-accent-soft)" : "transparent",
                        color: roleFilter === item.value ? "var(--app-accent)" : "inherit",
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((item) => (
                    <Link
                      key={item.value}
                      href={buildFilterHref(filterValues, { status: item.value })}
                      className="rounded-full border px-3 py-1.5 text-xs font-black transition"
                      style={{
                        borderColor: statusFilter === item.value ? "var(--app-accent)" : "var(--app-border)",
                        backgroundColor: statusFilter === item.value ? "var(--app-accent-soft)" : "transparent",
                        color: statusFilter === item.value ? "var(--app-accent)" : "inherit",
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="app-muted-text text-xs font-bold">找到 {profiles.length} 个账号</span>
                {(roleFilter !== "all" || statusFilter !== "all" || queryText || sort !== "newest") && (
                  <Link href="/dashboard/admin/accounts" className="text-xs font-black" style={{ color: "var(--app-accent)" }}>清除筛选</Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-7">
          {GROUP_ORDER.map((role) => {
            const groupProfiles = profiles.filter((profile) => profile.role === role);

            if (groupProfiles.length === 0) {
              return null;
            }

            return (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black tracking-tight">{GROUP_LABELS[role]}</h2>
                  <span className="app-soft-card rounded-full border px-2.5 py-1 text-xs font-black">{groupProfiles.length} 人</span>
                  <div className="h-px flex-1" style={{ backgroundColor: "var(--app-border)" }} />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {groupProfiles.map((profile) => (
                    <AccountCard key={profile.id} profile={profile} viewerRole={viewerRole} />
                  ))}
                </div>
              </section>
            );
          })}

          {profiles.length === 0 && (
            <div className="app-card rounded-[1.75rem] border border-dashed p-12 text-center">
              <Search className="mx-auto opacity-25" size={36} />
              <p className="mt-4 font-black">没有找到符合条件的账号</p>
              <p className="app-muted-text mt-2 text-sm">可以换一个姓名、邮箱或筛选条件再试。</p>
              <Link href="/dashboard/admin/accounts" className="mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>查看全部账号</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
