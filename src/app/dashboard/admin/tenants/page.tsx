import Link from "next/link";
import { Building2, Crown, ExternalLink, History, Users } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requirePlatformTenantManager } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeputyOwnerManager } from "./DeputyOwnerManager";
import { TenantComposer } from "./TenantComposer";
import { TenantLifecycleControls } from "./TenantLifecycleControls";


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

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isTenancySchemaUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export default async function TenantManagementPage() {
  const { supabase, role } = await requirePlatformTenantManager();
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
  const { data: deputyData } = role === "platform_super_admin"
    ? await createAdminClient().from("profiles").select("id,full_name,login_id").eq("role", "tenant_operator").eq("status", "active")
    : { data: [] as Array<{ id: string; full_name: string | null; login_id: string | null }> };
  const deputies = (deputyData ?? []).map((deputy) => ({ id: deputy.id, name: deputy.full_name?.trim() || "未填写姓名", loginId: deputy.login_id ?? "未设置账号" }));
  const memberCounts = new Map<string, number>();
  for (const membership of membershipRows) {
    memberCounts.set(membership.tenant_id, (memberCounts.get(membership.tenant_id) ?? 0) + 1);
  }
  const schemaUnavailable = isTenancySchemaUnavailable(error);

  return (
    <div className="pb-12">
      <DashboardPageHeader title="租户管理" description="为不同学校、机构或业务线开通独立租户，并从这里掌握租户规模。" action={<Link href="/dashboard/admin/tenants/history" className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black"><History size={16} />停用与删除记录</Link>} />
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-secondary-soft))" }}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><Crown size={14} />负责人专属权限</span>
              <h1 className="mt-3 text-2xl font-black tracking-tight">用一套平台，服务多个独立组织</h1>
              <p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">每个租户有独立的成员关系、角色和业务数据边界。租户创建者自动成为该机构负责人，后续可在租户内配置 CEO、管理员和成员。</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="app-card rounded-2xl border p-4"><Building2 size={19} style={{ color: "var(--app-accent)" }} /><p className="mt-3 text-2xl font-black">{tenants.length}</p><p className="app-muted-text mt-1 text-xs font-bold">可管理租户</p></div>
              <div className="app-card rounded-2xl border p-4"><Users size={19} style={{ color: "var(--app-secondary)" }} /><p className="mt-3 text-2xl font-black">{Array.from(memberCounts.values()).reduce((total, count) => total + count, 0)}</p><p className="app-muted-text mt-1 text-xs font-bold">成员关系</p></div>
            </div>
          </div>
        </section>

        {schemaUnavailable ? (
          <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>
            租户控制面尚未启用。请先应用 <code>202607200002_multi_tenant_foundation.sql</code>，随后即可在此开通租户。
          </section>
        ) : error ? (
          <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "#c94f45", backgroundColor: "#fff0ed", borderColor: "#c94f45" }}>租户数据暂时无法读取，请稍后刷新重试。</section>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,0.75fr)_minmax(0,1.35fr)]">
            <div className="space-y-5"><TenantComposer />{role === "platform_super_admin" && <DeputyOwnerManager deputies={deputies} />}</div>
            <section className="app-card rounded-3xl border p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">已开通租户</h2><p className="app-muted-text mt-1 text-xs">负责人拥有超级管理员身份的租户。</p></div><span className="app-soft-card rounded-full border px-3 py-1.5 text-xs font-black">{tenants.length} 个</span></div>
              <div className="mt-5 space-y-3">
                {tenants.map((tenant) => (
                  <article key={tenant.id} className="app-soft-card rounded-2xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-black">{tenant.name}</h3><p className="app-muted-text mt-1 font-mono text-xs">{tenant.slug}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tenant.status === "active" ? "var(--app-success)" : "var(--app-warm)", backgroundColor: tenant.status === "active" ? "var(--app-success-soft)" : "var(--app-warm-soft)" }}>{tenant.status === "active" ? "运行中" : "已停用"}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{planLabels[tenant.plan_key] ?? tenant.plan_key}</span></div></div>
                    <div className="app-muted-text mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs font-bold" style={{ borderColor: "var(--app-border-soft)" }}><span>{memberCounts.get(tenant.id) ?? 0} 位成员</span><span>开通于 {dateFormatter.format(new Date(tenant.created_at))}</span></div>
                    <Link href={`/dashboard/admin/tenants/${tenant.id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-black" style={{ color: "var(--app-accent)" }}>查看并管理租户<ExternalLink size={13} /></Link>
                    <TenantLifecycleControls
                      tenantId={tenant.id}
                      slug={tenant.slug}
                      status={tenant.status}
                      managers={membershipRows
                        .filter((membership) => membership.tenant_id === tenant.id && membership.role === "tenant_super_admin" && membership.status === "active")
                        .map((membership) => {
                          const profile = profileById.get(membership.user_id);
                          return { id: membership.user_id, loginId: profile?.login_id ?? "平台负责人", name: profile?.full_name ?? "管理员" };
                        })}
                    />
                  </article>
                ))}
                {tenants.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><Building2 className="mx-auto opacity-30" size={30} /><p className="mt-3 font-black">还没有租户</p><p className="app-muted-text mt-2 text-xs">从左侧表单开通第一个租户。</p></div>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
