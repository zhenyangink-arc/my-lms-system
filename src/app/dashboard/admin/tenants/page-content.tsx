import Link from "next/link";
import { Building2, History, Search } from "lucide-react";

import { requirePlatformTenantManager } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantComposer } from "./TenantComposer";
import { TenantTableActions } from "./TenantTableActions";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  plan_key: string;
  created_at: string;
};

type MembershipRow = { tenant_id: string; user_id: string; role: string; status: string };
type ProfileRow = { id: string; full_name: string | null; login_id: string | null };

const planLabels: Record<string, string> = {
  legacy: "历史兼容",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

const statusLabels: Record<TenantRow["status"], string> = {
  active: "运行中",
  suspended: "已停用",
  archived: "已归档",
};

const statusTones: Record<TenantRow["status"], { dot: string; text: string }> = {
  active: { dot: "#1f9d68", text: "#18754f" },
  suspended: { dot: "#e89b24", text: "#a5650d" },
  archived: { dot: "#9ca3af", text: "#6b7280" },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isTenancySchemaUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export default async function TenantManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const statusFilter = ["all", "active", "suspended", "archived"].includes(params.status ?? "") ? params.status ?? "all" : "all";
  const planFilter = ["all", "legacy", "starter", "growth", "enterprise"].includes(params.plan ?? "") ? params.plan ?? "all" : "all";
  const sort = ["newest", "oldest", "name", "members"].includes(params.sort ?? "") ? params.sort ?? "newest" : "newest";
  const { supabase } = await requirePlatformTenantManager();
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,status,plan_key,created_at")
    .order("created_at", { ascending: false });
  const tenants = (data ?? []) as TenantRow[];
  const tenantIds = tenants.map((tenant) => tenant.id);
  const { data: memberships } = tenantIds.length
    ? await supabase.from("tenant_memberships").select("tenant_id,user_id,role,status").in("tenant_id", tenantIds)
    : { data: [] as MembershipRow[] };
  const membershipRows = (memberships ?? []) as MembershipRow[];
  const memberIds = [...new Set(membershipRows.map((membership) => membership.user_id))];
  const { data: profiles } = memberIds.length
    ? await createAdminClient().from("profiles").select("id,full_name,login_id").in("id", memberIds)
    : { data: [] as ProfileRow[] };
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const memberCounts = new Map<string, number>();
  for (const membership of membershipRows) {
    memberCounts.set(membership.tenant_id, (memberCounts.get(membership.tenant_id) ?? 0) + 1);
  }
  const managersByTenant = new Map<string, Array<{ id: string; loginId: string; name: string }>>();
  for (const membership of membershipRows) {
    if (membership.role !== "tenant_super_admin" || membership.status !== "active") continue;
    const profile = profileById.get(membership.user_id);
    const managers = managersByTenant.get(membership.tenant_id) ?? [];
    managers.push({
      id: membership.user_id,
      loginId: profile?.login_id ?? "历史账号",
      name: profile?.full_name ?? "未填写姓名",
    });
    managersByTenant.set(membership.tenant_id, managers);
  }

  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");
  let visibleTenants = tenants.filter((tenant) => {
    const managers = managersByTenant.get(tenant.id) ?? [];
    const searchable = `${tenant.name} ${tenant.slug} ${managers.map((manager) => `${manager.name} ${manager.loginId}`).join(" ")}`.toLocaleLowerCase("zh-CN");
    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (statusFilter === "all" || tenant.status === statusFilter) &&
      (planFilter === "all" || tenant.plan_key === planFilter)
    );
  });
  visibleTenants = [...visibleTenants].sort((a, b) => {
    if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (sort === "members") return (memberCounts.get(b.id) ?? 0) - (memberCounts.get(a.id) ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const activeCount = tenants.filter((tenant) => tenant.status === "active").length;
  const inactiveCount = tenants.filter((tenant) => tenant.status !== "active").length;
  const totalMembers = Array.from(memberCounts.values()).reduce((total, count) => total + count, 0);
  const schemaUnavailable = isTenancySchemaUnavailable(error);
  const hasFilters = Boolean(queryText) || statusFilter !== "all" || planFilter !== "all" || sort !== "newest";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 sm:p-5">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="app-muted-text text-[11px] font-semibold tracking-[0.16em]">机构与租户</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">租户管理</h1>
            <p className="app-muted-text mt-1 text-xs">统一查看平台下的机构空间、负责人、成员规模和运行状态。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/admin/tenants/history" className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035]" style={{ borderColor: "var(--app-border)" }}><History size={14} />停用与删除记录</Link>
            <TenantComposer />
          </div>
        </div>
        <div className="grid border-t sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--app-border)" }}>
          {[
            ["租户总数", tenants.length],
            ["运行中", activeCount],
            ["停用或归档", inactiveCount],
            ["成员关系", totalMembers],
          ].map(([label, value], index) => (
            <div key={String(label)} className={`px-5 py-3 ${index > 0 ? "sm:border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""}`} style={{ borderColor: "var(--app-border)" }}>
              <p className="app-muted-text text-[11px] font-medium">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {schemaUnavailable ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">租户控制面尚未启用，请先应用多租户基础数据库迁移。</section>
      ) : error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">租户数据暂时无法读取，请稍后刷新重试。</section>
      ) : (
        <section className="app-card overflow-hidden rounded-xl border">
          <form action="/dashboard/admin/tenants" method="get" className="grid gap-2 border-b p-3 md:grid-cols-[minmax(260px,1fr)_145px_145px_145px_auto]" style={{ borderColor: "var(--app-border)" }}>
            <label className="app-input flex h-9 items-center gap-2 rounded-md border px-2.5">
              <Search className="app-muted-text shrink-0" size={14} />
              <span className="sr-only">搜索租户</span>
              <input name="q" defaultValue={queryText} maxLength={80} placeholder="搜索租户、标识或负责人" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-50" />
            </label>
            <label><span className="sr-only">运行状态</span><select name="status" defaultValue={statusFilter} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"><option value="all">全部状态</option><option value="active">运行中</option><option value="suspended">已停用</option><option value="archived">已归档</option></select></label>
            <label><span className="sr-only">服务套餐</span><select name="plan" defaultValue={planFilter} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"><option value="all">全部套餐</option><option value="legacy">历史兼容</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></label>
            <label><span className="sr-only">排序方式</span><select name="sort" defaultValue={sort} className="app-input h-9 w-full rounded-md border px-2.5 text-xs font-medium"><option value="newest">最新开通</option><option value="oldest">最早开通</option><option value="name">按名称</option><option value="members">成员最多</option></select></label>
            <button type="submit" className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800">筛选</button>
          </form>

          <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-[11px]" style={{ borderColor: "var(--app-border)" }}>
            <span className="app-muted-text">当前显示 {visibleTenants.length} / {tenants.length} 个租户</span>
            {hasFilters && <Link href="/dashboard/admin/tenants" className="font-semibold hover:underline">清除筛选</Link>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] border-collapse text-left">
              <thead>
                <tr className="border-b text-[11px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}>
                  <th className="px-4 py-2.5 font-medium">租户</th>
                  <th className="px-4 py-2.5 font-medium">机构负责人</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">套餐</th>
                  <th className="px-4 py-2.5 font-medium">成员</th>
                  <th className="px-4 py-2.5 font-medium">开通时间</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleTenants.map((tenant) => {
                  const managers = managersByTenant.get(tenant.id) ?? [];
                  const primaryManager = managers[0];
                  const tone = statusTones[tenant.status];
                  return (
                    <tr key={tenant.id} className="border-b text-xs transition last:border-b-0 hover:bg-black/[0.018]" style={{ borderColor: "var(--app-border)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}><Building2 size={14} /></span>
                          <div className="min-w-0"><p className="truncate font-semibold">{tenant.name}</p><p className="app-muted-text mt-0.5 truncate font-mono text-[10px]">{tenant.slug}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {primaryManager ? <div><p className="font-medium">{primaryManager.name}{managers.length > 1 ? ` +${managers.length - 1}` : ""}</p><p className="app-muted-text mt-0.5 text-[10px]">{primaryManager.loginId}</p></div> : <span className="text-amber-700">负责人待配置</span>}
                      </td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-medium" style={{ color: tone.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />{statusLabels[tenant.status]}</span></td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold" style={{ color: "#235fa6", backgroundColor: "#edf5ff" }}>{planLabels[tenant.plan_key] ?? tenant.plan_key}</span></td>
                      <td className="app-muted-text px-4 py-3 tabular-nums">{memberCounts.get(tenant.id) ?? 0} 人</td>
                      <td className="app-muted-text px-4 py-3 tabular-nums">{dateFormatter.format(new Date(tenant.created_at))}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-2"><Link href={`/dashboard/admin/tenants/${tenant.id}`} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]">详情</Link><TenantTableActions tenantId={tenant.id} name={tenant.name} slug={tenant.slug} status={tenant.status} managers={managers} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleTenants.length === 0 && (
            <div className="border-t px-5 py-12 text-center" style={{ borderColor: "var(--app-border)" }}>
              <Building2 className="mx-auto opacity-25" size={28} />
              <p className="mt-3 text-sm font-semibold">没有符合条件的租户</p>
              <p className="app-muted-text mt-1 text-xs">调整搜索词或筛选条件后再试。</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
