import Link from "next/link";
import { Check, ChevronDown, CircleAlert, KeyRound, LockKeyhole, Search, ShieldCheck, UsersRound } from "lucide-react";

import { requirePlatformOwner } from "@/lib/admin";
import {
  ASSIGNABLE_PERMISSION_KEYS,
  ASSIGNABLE_PERMISSION_LABELS,
  PERMISSION_MODULES,
  PERMISSION_MEMBERSHIP_TIER_LABELS,
  PERMISSION_ROLE_LABELS,
  PLATFORM_PERMISSION_ROLES,
  TENANT_PERMISSION_ROLES,
  getCapabilitiesForGrant,
  roleHasCapability,
  studentTierMeetsMinimum,
  type AssignablePermissionKey,
  type PermissionCapability,
  type PermissionMembershipTier,
  type PermissionModule,
  type PermissionRole,
} from "@/lib/permissions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUnifiedPermissionGrantAction } from "./actions";

type TenantRow = { id: string; name: string; slug: string; status: string };
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  login_id: string | null;
  role: string;
  global_role: string | null;
  membership_tier: string | null;
  status: string | null;
};
type MembershipRow = { tenant_id: string; user_id: string; role: string; status: string };
type PermissionGrantRow = {
  id: number;
  scope_type: "platform" | "tenant";
  tenant_id: string | null;
  subject_user_id: string;
  permission_key: AssignablePermissionKey;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
};
type PermissionAuditRow = {
  id: number;
  actor_id: string | null;
  subject_user_id: string;
  tenant_id: string | null;
  permission_key: AssignablePermissionKey;
  action: "granted" | "revoked";
  created_at: string;
};
type PermissionAccount = {
  id: string;
  name: string;
  loginId: string;
  status: string;
  role: PermissionRole;
  scope: "platform" | "tenant";
  tenantId: string | null;
  membershipTier: PermissionMembershipTier;
};

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isPermissionRole(value: string | null | undefined): value is PermissionRole {
  return ([...PLATFORM_PERMISSION_ROLES, ...TENANT_PERMISSION_ROLES] as readonly string[]).includes(value ?? "");
}

function isPermissionMembershipTier(value: string | null | undefined): value is PermissionMembershipTier {
  return value === "normal" || value === "vip1" || value === "vip2" || value === "vip3";
}

function profileName(profile: ProfileRow | undefined, userId: string) {
  return profile?.full_name || profile?.login_id || profile?.email || `账号 …${userId.slice(-6)}`;
}

function canReceiveExplicitGrant(role: PermissionRole, permissionKey: AssignablePermissionKey) {
  return permissionKey === "standard_question_bank.manage"
    ? role === "platform_deputy" || role === "platform_admin"
    : role === "admin";
}

function RoleMatrixCell({ role, capability }: { role: PermissionRole; capability: PermissionCapability }) {
  if (role === "student" && capability.studentMinimumTier) {
    return <span className="mx-auto inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700"><KeyRound size={11} />{PERMISSION_MEMBERSHIP_TIER_LABELS[capability.studentMinimumTier]}+</span>;
  }
  if (roleHasCapability(role, capability)) {
    return <span className="mx-auto inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700"><Check size={11} />角色继承</span>;
  }
  if (capability.explicitGrant && canReceiveExplicitGrant(role, capability.explicitGrant)) {
    return <span className="mx-auto inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700"><KeyRound size={11} />可单独授权</span>;
  }
  return <span className="app-muted-text text-[10px]">—</span>;
}

function EffectivePermissionCell({ allowed, source }: { allowed: boolean; source: "角色继承" | "会员档位" | "单独授权" | "系统禁止" | "账号停用" | "会员未开放" }) {
  const style = allowed
    ? source === "单独授权"
      ? "bg-amber-50 text-amber-700"
      : source === "会员档位"
        ? "bg-violet-50 text-violet-700"
      : "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${style}`}>{allowed ? <Check size={11} /> : <LockKeyhole size={11} />}{source}</span>;
}

function PermissionMatrixTable({
  title,
  description,
  scope,
  roles,
  modules,
  defaultOpen,
}: {
  title: string;
  description: string;
  scope: "platform" | "tenant";
  roles: readonly PermissionRole[];
  modules: readonly PermissionModule[];
  defaultOpen: boolean;
}) {
  const rows = modules.flatMap((module) => {
    const capabilities = module.capabilities.filter((capability) =>
      scope === "platform"
        ? (capability.platformRoles?.length ?? 0) > 0 || capability.explicitGrant === "standard_question_bank.manage"
        : (capability.tenantRoles?.length ?? 0) > 0 || Boolean(capability.explicitGrant && capability.explicitGrant !== "standard_question_bank.manage")
    );
    return capabilities.map((capability, index) => ({ module, capability, showModule: index === 0 }));
  });

  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-b px-4 py-2.5 transition hover:bg-black/[0.02] [&::-webkit-details-marker]:hidden" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>
        <div><p className="text-[11px] font-semibold">{title}</p><p className="app-muted-text mt-0.5 text-[9px]">{description}</p></div>
        <span className="app-muted-text flex shrink-0 items-center gap-2 text-[9px]"><span>{roles.length} 个角色 · {rows.length} 项操作</span><ChevronDown size={14} className="transition-transform duration-200 group-open:rotate-180" /></span>
      </summary>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
          <thead><tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="w-[42%] px-4 py-2 font-medium">模块 / 操作</th>{roles.map((role) => <th key={role} className="px-1.5 py-2 text-center font-medium">{PERMISSION_ROLE_LABELS[role]}</th>)}</tr></thead>
          <tbody>{rows.map(({ module, capability, showModule }) => (
            <tr key={`${scope}-${capability.key}`} className="border-b text-[11px] last:border-b-0 hover:bg-black/[0.015]" style={{ borderColor: "var(--app-border)" }}>
              <td className="px-4 py-2"><div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2"><span className="app-muted-text truncate text-[9px] font-semibold">{showModule ? module.label : ""}</span><div><p className="font-semibold">{capability.label}</p><p className="app-muted-text mt-0.5 truncate text-[9px]">{capability.description}</p></div></div></td>
              {roles.map((role) => <td key={role} className="px-1.5 py-2 text-center"><RoleMatrixCell role={role} capability={capability} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}

const permissionFlow = [
  ["01", "账号状态", "停用后全部权限失效"],
  ["02", "身份范围", "先区分平台账号与机构账号"],
  ["03", "角色继承", "获得角色自带的固定权限"],
  ["04", "附加条件", "叠加单独授权或学生会员档位"],
  ["05", "数据边界", "权限只能作用于规定的数据范围"],
] as const;

const roleLogicRows = [
  ["平台负责人", "平台", "平台治理、权限中心、平台内容与跨机构汇总", "不以机构身份处理学生个案"],
  ["平台副负责人", "平台", "机构协作、租户管理和大学资料查看", "不能修改权限中心或平台课程内容"],
  ["平台管理员", "平台", "课程、考试和大学资料维护", "不能管理平台账号和权限；题库需单独授权"],
  ["课程巡检员", "平台", "只读检查课程、电子书和测试流程", "不能编辑、发布或删除内容"],
  ["机构负责人 / 运营负责人", "本机构", "机构账号、教学运营和留学服务", "不能查看其他机构数据"],
  ["机构管理员", "本机构", "作业考试等基础管理；可接受指定模块授权", "单独授权不会扩大到其他机构"],
  ["教师", "本机构", "教学任务、批改和学生帮助回复", "不能管理机构账号或平台内容"],
  ["学生", "本人", "使用会员档位开放的学习与留学功能", "只能查看和操作本人数据"],
] as const;

const explicitGrantRows = [
  ["标准题库管理", "平台副负责人、平台管理员", "平台", "查看并维护平台标准题库"],
  ["会话练习管理", "机构管理员", "本机构", "查看本机构练习数据"],
  ["成绩管理", "机构管理员", "本机构", "维护本机构成绩与复核"],
  ["学习记录管理", "机构管理员", "本机构", "维护本机构辅导与学习记录"],
  ["资料审核管理", "机构管理员", "本机构", "处理本机构学生申请资料"],
  ["签证管理", "机构管理员", "本机构", "处理本机构签证档案"],
] as const;

function PermissionLogicView() {
  return (
    <div className="space-y-3">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-semibold">权限如何生效</h2><p className="app-muted-text mt-1 text-[10px]">系统始终按照下面的顺序计算，前一步不成立时不会继续放行。</p></div><p className="text-[10px] font-semibold">最终权限 = 账号状态 × 身份范围 ×（角色权限 + 附加权限）× 数据边界</p></div>
        </div>
        <div className="grid md:grid-cols-5">
          {permissionFlow.map(([number, title, description], index) => (
            <div key={number} className={`relative px-4 py-3 ${index > 0 ? "border-t md:border-l md:border-t-0" : ""}`} style={{ borderColor: "var(--app-border)" }}>
              <div className="flex items-center gap-2"><span className="app-muted-text text-[9px] font-semibold tabular-nums">{number}</span><p className="text-[11px] font-semibold">{title}</p></div>
              <p className="app-muted-text mt-1 text-[9px] leading-4">{description}</p>
              {index < permissionFlow.length - 1 && <span aria-hidden className="app-muted-text absolute -right-1.5 top-1/2 z-10 hidden -translate-y-1/2 bg-[var(--app-card-bg)] px-0.5 text-xs md:block">→</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b px-4 py-2.5 [&::-webkit-details-marker]:hidden" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}><span className="text-[11px] font-semibold">角色与数据范围</span><span className="app-muted-text flex items-center gap-2 text-[9px]">8 类身份<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></span></summary>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] table-fixed text-left"><thead><tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="w-[20%] px-4 py-2 font-medium">身份</th><th className="w-[12%] px-3 py-2 font-medium">数据范围</th><th className="w-[34%] px-3 py-2 font-medium">主要权限</th><th className="px-3 py-2 font-medium">明确边界</th></tr></thead><tbody>{roleLogicRows.map(([role, scope, permissions, boundary]) => <tr key={role} className="border-b text-[10px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="px-4 py-2.5 font-semibold">{role}</td><td className="px-3 py-2.5"><span className="rounded bg-sky-50 px-1.5 py-1 text-[9px] font-semibold text-sky-700">{scope}</span></td><td className="px-3 py-2.5">{permissions}</td><td className="app-muted-text px-3 py-2.5">{boundary}</td></tr>)}</tbody></table></div>
        </details>
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b px-4 py-2.5 [&::-webkit-details-marker]:hidden" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}><span><span className="text-[11px] font-semibold">允许单独追加的权限</span><span className="app-muted-text ml-2 text-[9px]">只能增加，不能突破数据范围</span></span><span className="app-muted-text flex items-center gap-2 text-[9px]">6 项<ChevronDown size={14} className="transition-transform group-open:rotate-180" /></span></summary>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed text-left"><thead><tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="w-[22%] px-4 py-2 font-medium">权限</th><th className="w-[24%] px-3 py-2 font-medium">可以授予谁</th><th className="w-[14%] px-3 py-2 font-medium">范围</th><th className="px-3 py-2 font-medium">生效内容</th></tr></thead><tbody>{explicitGrantRows.map(([permission, target, scope, effect]) => <tr key={permission} className="border-b text-[10px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="px-4 py-2.5 font-semibold">{permission}</td><td className="px-3 py-2.5">{target}</td><td className="px-3 py-2.5"><span className="rounded bg-amber-50 px-1.5 py-1 text-[9px] font-semibold text-amber-700">{scope}</span></td><td className="app-muted-text px-3 py-2.5">{effect}</td></tr>)}</tbody></table></div>
        </details>
      </section>

      <section className="app-card flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-3 text-[9px]"><span className="font-semibold">结果颜色</span><span className="text-sky-700">● 角色继承</span><span className="text-violet-700">● 会员档位</span><span className="text-amber-700">● 单独授权</span><span className="text-rose-700">● 禁止 / 未开放</span><span className="app-muted-text">● 不适用</span><span className="app-muted-text ml-auto">学生会员档位只控制学生功能，不会改变账号角色。</span></section>
    </div>
  );
}

function pageHref(current: Record<string, string>, overrides: Record<string, string | null>) {
  const query = new URLSearchParams(current);
  for (const [key, value] of Object.entries(overrides)) {
    if (!value) query.delete(key);
    else query.set(key, value);
  }
  const value = query.toString();
  return value ? `/dashboard/admin/permissions?${value}` : "/dashboard/admin/permissions";
}

export default async function PermissionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tenant?: string; account?: string; scope?: string; q?: string; updated?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requirePlatformOwner();
  const admin = createAdminClient();
  const view = (["logic", "matrix", "account", "grants", "audit"].includes(params.view ?? "") ? params.view : "logic") as "logic" | "matrix" | "account" | "grants" | "audit";
  const scopeFilter = (["all", "platform", "tenant"].includes(params.scope ?? "") ? params.scope : "all") as "all" | "platform" | "tenant";
  const queryText = (params.q ?? "").trim().slice(0, 80);

  const [tenantsResult, platformProfilesResult, grantsResult, auditResult] = await Promise.all([
    admin.from("tenants").select("id,name,slug,status").order("name"),
    admin.from("profiles").select("id,full_name,email,login_id,role,global_role,membership_tier,status").in("global_role", [...PLATFORM_PERMISSION_ROLES]).order("created_at"),
    admin.from("permission_grants").select("id,scope_type,tenant_id,subject_user_id,permission_key,granted_by,granted_at,revoked_at").is("revoked_at", null).order("granted_at", { ascending: false }),
    admin.from("permission_grant_audit_logs").select("id,actor_id,subject_user_id,tenant_id,permission_key,action,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  if (tenantsResult.error || platformProfilesResult.error || grantsResult.error || auditResult.error) {
    throw new Error("无法读取统一权限中心数据，请稍后重试。");
  }

  const tenants = (tenantsResult.data ?? []) as TenantRow[];
  const platformProfiles = (platformProfilesResult.data ?? []) as ProfileRow[];
  const grants = (grantsResult.data ?? []) as PermissionGrantRow[];
  const auditLogs = (auditResult.data ?? []) as PermissionAuditRow[];
  const selectedTenant = tenants.find((tenant) => tenant.id === params.tenant) ?? tenants.find((tenant) => tenant.status === "active") ?? tenants[0] ?? null;
  const membershipsResult = selectedTenant
    ? await admin.from("tenant_memberships").select("tenant_id,user_id,role,status").eq("tenant_id", selectedTenant.id).order("created_at")
    : { data: [] as MembershipRow[], error: null };
  if (membershipsResult.error) throw new Error("无法读取当前机构成员，请稍后重试。");
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];

  const relevantProfileIds = [...new Set([
    ...memberships.map((membership) => membership.user_id),
    ...grants.flatMap((grant) => [grant.subject_user_id, grant.granted_by]),
    ...auditLogs.flatMap((log) => [log.subject_user_id, log.actor_id].filter((value): value is string => Boolean(value))),
  ])];
  const relatedProfilesResult = relevantProfileIds.length
    ? await admin.from("profiles").select("id,full_name,email,login_id,role,global_role,membership_tier,status").in("id", relevantProfileIds)
    : { data: [] as ProfileRow[], error: null };
  if (relatedProfilesResult.error) throw new Error("无法读取权限账号资料，请稍后重试。");
  const allProfiles = [...platformProfiles, ...((relatedProfilesResult.data ?? []) as ProfileRow[])];
  const profilesById = new Map(allProfiles.map((profile) => [profile.id, profile]));
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  const platformAccounts: PermissionAccount[] = platformProfiles.flatMap((profile) =>
    isPermissionRole(profile.global_role)
      ? [{ id: profile.id, name: profileName(profile, profile.id), loginId: profile.login_id ?? "历史账号", status: profile.status ?? "active", role: profile.global_role, scope: "platform" as const, tenantId: null, membershipTier: "normal" as const }]
      : []
  );
  const tenantAccounts: PermissionAccount[] = memberships.flatMap((membership) => {
    const profile = profilesById.get(membership.user_id);
    return isPermissionRole(membership.role)
      ? [{ id: membership.user_id, name: profileName(profile, membership.user_id), loginId: profile?.login_id ?? "历史账号", status: membership.status === "active" ? profile?.status ?? "active" : membership.status, role: membership.role, scope: "tenant" as const, tenantId: membership.tenant_id, membershipTier: isPermissionMembershipTier(profile?.membership_tier) ? profile.membership_tier : "normal" }]
      : [];
  });
  const selectableAccounts = [...platformAccounts, ...tenantAccounts];
  const selectedAccount = selectableAccounts.find((account) => account.id === params.account) ?? platformAccounts[0] ?? tenantAccounts[0] ?? null;
  const selectedAccountGrants = new Set(
    grants
      .filter((grant) => grant.subject_user_id === selectedAccount?.id && grant.tenant_id === selectedAccount.tenantId)
      .map((grant) => grant.permission_key)
  );
  const currentParams = { view, ...(selectedTenant ? { tenant: selectedTenant.id } : {}), ...(selectedAccount ? { account: selectedAccount.id } : {}), scope: scopeFilter, ...(queryText ? { q: queryText } : {}) };
  const filteredModules = PERMISSION_MODULES.filter((module) => {
    if (scopeFilter === "platform" && !module.capabilities.some((capability) => (capability.platformRoles?.length ?? 0) > 0)) return false;
    if (scopeFilter === "tenant" && !module.capabilities.some((capability) => (capability.tenantRoles?.length ?? 0) > 0)) return false;
    if (!queryText) return true;
    const search = `${module.label} ${module.description} ${module.capabilities.map((capability) => `${capability.label} ${capability.description}`).join(" ")}`.toLocaleLowerCase("zh-CN");
    return search.includes(queryText.toLocaleLowerCase("zh-CN"));
  });
  const capabilityCount = PERMISSION_MODULES.reduce((total, module) => total + module.capabilities.length, 0);
  const activeTenantAdmins = tenantAccounts.filter((account) => account.role === "admin" && account.status === "active");
  const platformGrantCandidates = platformAccounts.filter((account) => (account.role === "platform_deputy" || account.role === "platform_admin") && account.status === "active");

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3 p-3 sm:p-4">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="app-muted-text text-[11px] font-semibold tracking-[0.16em]">统一访问控制</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">权限中心</h1>
            <p className="app-muted-text mt-1 text-xs">角色继承、账号例外授权、数据范围和审计记录统一显示，以最终生效结果为准。</p>
          </div>
          <div className="flex items-center gap-2 text-[11px]"><ShieldCheck size={15} className="text-emerald-600" /><span className="font-semibold">只有平台负责人可以修改例外授权</span></div>
        </div>
        <div className="grid border-t sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--app-border)" }}>
          {[["权限模块", PERMISSION_MODULES.length], ["操作权限", capabilityCount], ["生效授权", grants.length], ["审计记录", auditLogs.length]].map(([label, value], index) => (
            <div key={String(label)} className={`px-5 py-3 ${index > 0 ? "sm:border-l" : ""} ${index > 1 ? "border-t sm:border-t-0" : ""}`} style={{ borderColor: "var(--app-border)" }}><p className="app-muted-text text-[11px]">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p></div>
          ))}
        </div>
      </section>

      {params.updated === "1" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">权限已更新，页面显示的是数据库重新计算后的结果。</div>}
      {params.error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><CircleAlert className="mt-0.5 shrink-0" size={14} />{params.error}</div>}

      <nav className="app-card flex flex-wrap items-center gap-1 rounded-xl border p-1.5">
        {[["logic", "权限逻辑"], ["matrix", "角色权限"], ["account", "账号最终权限"], ["grants", "单独授权"], ["audit", "操作记录"]].map(([value, label]) => <Link key={value} href={pageHref(currentParams, { view: value, account: value === "account" ? selectedAccount?.id ?? null : null })} className="rounded-md px-3 py-2 text-xs font-semibold transition" style={{ color: view === value ? "white" : "inherit", backgroundColor: view === value ? "#171717" : "transparent" }}>{label}</Link>)}
      </nav>

      {view === "logic" && <PermissionLogicView />}

      {view === "matrix" && (
        <section className="app-card overflow-hidden rounded-xl border">
          <form method="get" className="grid gap-2 border-b p-3 md:grid-cols-[minmax(240px,1fr)_160px_auto]" style={{ borderColor: "var(--app-border)" }}>
            <input type="hidden" name="view" value="matrix" />
            <label className="app-input flex h-9 items-center gap-2 rounded-md border px-2.5"><Search className="app-muted-text" size={14} /><input name="q" defaultValue={queryText} placeholder="搜索模块或操作权限" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
            <select name="scope" defaultValue={scopeFilter} className="app-input h-9 rounded-md border px-2.5 text-xs font-medium"><option value="all">全部范围</option><option value="platform">平台权限</option><option value="tenant">机构权限</option></select>
            <button className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white">筛选</button>
          </form>
          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {scopeFilter !== "tenant" && <PermissionMatrixTable title="平台角色权限" description="平台治理、内容维护与跨机构巡检权限" scope="platform" roles={PLATFORM_PERMISSION_ROLES} modules={filteredModules} defaultOpen />}
            {scopeFilter !== "platform" && <PermissionMatrixTable title="机构角色权限" description="机构运营、教学协作与学生会员权限" scope="tenant" roles={TENANT_PERMISSION_ROLES} modules={filteredModules} defaultOpen={scopeFilter === "tenant"} />}
          </div>
        </section>
      )}

      {view === "account" && (
        <section className="app-card overflow-hidden rounded-xl border">
          <div className="grid border-b lg:grid-cols-[260px_minmax(0,1fr)]" style={{ borderColor: "var(--app-border)" }}>
            <div className="border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor: "var(--app-border)" }}><p className="text-xs font-semibold">选择账号</p><p className="app-muted-text mt-1 text-[10px]">查看账号最终生效权限和每项来源。</p></div>
            <form method="get" className="grid gap-2 p-3 md:grid-cols-[180px_minmax(260px,1fr)_auto]">
              <input type="hidden" name="view" value="account" />
              <select name="tenant" defaultValue={selectedTenant?.id ?? ""} className="app-input h-9 rounded-md border px-2.5 text-xs"><option value="">仅平台账号</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.status !== "active" ? "（停用）" : ""}</option>)}</select>
              <select name="account" defaultValue={selectedAccount?.id ?? ""} className="app-input h-9 rounded-md border px-2.5 text-xs"><optgroup label="平台账号">{platformAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {PERMISSION_ROLE_LABELS[account.role]}</option>)}</optgroup>{selectedTenant && <optgroup label={selectedTenant.name}>{tenantAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {PERMISSION_ROLE_LABELS[account.role]}</option>)}</optgroup>}</select>
              <button className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white">查看权限</button>
            </form>
          </div>
          {selectedAccount ? <>
            <div className="grid border-b sm:grid-cols-5" style={{ borderColor: "var(--app-border)" }}><div className="px-4 py-3"><p className="app-muted-text text-[10px]">账号</p><p className="mt-1 text-xs font-semibold">{selectedAccount.name}</p></div><div className="border-l px-4 py-3" style={{ borderColor: "var(--app-border)" }}><p className="app-muted-text text-[10px]">角色</p><p className="mt-1 text-xs font-semibold">{PERMISSION_ROLE_LABELS[selectedAccount.role]}</p></div><div className="border-l px-4 py-3" style={{ borderColor: "var(--app-border)" }}><p className="app-muted-text text-[10px]">会员档位</p><p className="mt-1 text-xs font-semibold">{selectedAccount.role === "student" ? PERMISSION_MEMBERSHIP_TIER_LABELS[selectedAccount.membershipTier] : "不适用"}</p></div><div className="border-l px-4 py-3" style={{ borderColor: "var(--app-border)" }}><p className="app-muted-text text-[10px]">数据范围</p><p className="mt-1 text-xs font-semibold">{selectedAccount.scope === "platform" ? "平台范围" : selectedTenant?.name ?? "当前机构"}</p></div><div className="border-l px-4 py-3" style={{ borderColor: "var(--app-border)" }}><p className="app-muted-text text-[10px]">账号状态</p><p className={`mt-1 text-xs font-semibold ${selectedAccount.status === "active" ? "text-emerald-700" : "text-rose-700"}`}>{selectedAccount.status === "active" ? "正常" : "已停用"}</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b text-[10px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="px-4 py-2.5 font-medium">模块</th><th className="px-4 py-2.5 font-medium">操作权限</th><th className="px-4 py-2.5 font-medium">最终结果</th><th className="px-4 py-2.5 font-medium">范围</th><th className="px-4 py-2.5 font-medium">说明</th></tr></thead><tbody>{PERMISSION_MODULES.flatMap((module) => module.capabilities.map((capability) => { const roleInherited = roleHasCapability(selectedAccount.role, capability); const tierEligible = selectedAccount.role !== "student" || studentTierMeetsMinimum(selectedAccount.membershipTier, capability.studentMinimumTier); const inherited = roleInherited && tierEligible; const membershipBlocked = roleInherited && !tierEligible; const delegated = capability.explicitGrant ? selectedAccountGrants.has(capability.explicitGrant) : false; const active = selectedAccount.status === "active"; const allowed = active && (inherited || delegated); const source = !active ? "账号停用" : membershipBlocked ? "会员未开放" : delegated ? "单独授权" : inherited && selectedAccount.role === "student" && capability.studentMinimumTier ? "会员档位" : inherited ? "角色继承" : "系统禁止"; return <tr key={capability.key} className="border-b text-xs last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="px-4 py-3 font-medium">{module.label}</td><td className="px-4 py-3"><p className="font-semibold">{capability.label}</p><p className="app-muted-text mt-0.5 text-[10px]">{capability.key}</p></td><td className="px-4 py-3"><EffectivePermissionCell allowed={allowed} source={source} /></td><td className="app-muted-text px-4 py-3">{selectedAccount.scope === "platform" ? "平台" : "本机构 / 本人数据"}</td><td className="app-muted-text px-4 py-3 text-[11px]">{capability.description}{capability.studentMinimumTier ? ` · ${PERMISSION_MEMBERSHIP_TIER_LABELS[capability.studentMinimumTier]} 及以上` : ""}</td></tr>; }))}</tbody></table></div>
          </> : <div className="p-10 text-center text-xs">没有可查看的账号。</div>}
        </section>
      )}

      {view === "grants" && (
        <div className="space-y-4">
          <section className="app-card overflow-hidden rounded-xl border">
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)" }}><h2 className="text-sm font-semibold">新增单独授权</h2><p className="app-muted-text mt-1 text-[10px]">角色固定权限不能在这里拆散；这里只处理经过目录批准的例外授权。</p></div>
            <div className="grid lg:grid-cols-2">
              <form action={updateUnifiedPermissionGrantAction} className="border-b lg:border-b-0 lg:border-r" style={{ borderColor: "var(--app-border)" }}><div className="border-b px-4 py-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>平台例外权限</div><div className="grid gap-2 p-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]"><input type="hidden" name="tenantId" value="" /><input type="hidden" name="enabled" value="true" /><input type="hidden" name="view" value="grants" /><select required name="targetUserId" defaultValue="" className="app-input h-9 rounded-md border px-2.5 text-xs"><option value="" disabled>选择平台副负责人或管理员</option>{platformGrantCandidates.map((account) => <option key={account.id} value={account.id}>{account.name} · {PERMISSION_ROLE_LABELS[account.role]}</option>)}</select><select name="permissionKey" defaultValue="standard_question_bank.manage" className="app-input h-9 rounded-md border px-2.5 text-xs"><option value="standard_question_bank.manage">标准题库管理</option></select><button className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white">授权</button></div></form>
              <div><div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}><span className="text-[11px] font-semibold">机构例外权限</span>{selectedTenant && <span className="app-muted-text text-[10px]">{selectedTenant.name}</span>}</div><form method="get" className="flex gap-2 border-b p-3" style={{ borderColor: "var(--app-border)" }}><input type="hidden" name="view" value="grants" /><select name="tenant" defaultValue={selectedTenant?.id ?? ""} className="app-input h-9 min-w-0 flex-1 rounded-md border px-2.5 text-xs">{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><button className="h-9 rounded-md border px-3 text-xs font-semibold" style={{ borderColor: "var(--app-border)" }}>切换机构</button></form><form action={updateUnifiedPermissionGrantAction} className="grid gap-2 p-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]"><input type="hidden" name="tenantId" value={selectedTenant?.id ?? ""} /><input type="hidden" name="enabled" value="true" /><input type="hidden" name="view" value="grants" /><select required name="targetUserId" defaultValue="" className="app-input h-9 rounded-md border px-2.5 text-xs"><option value="" disabled>选择普通管理员</option>{activeTenantAdmins.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.loginId}</option>)}</select><select required name="permissionKey" defaultValue="grade_center.manage" className="app-input h-9 rounded-md border px-2.5 text-xs">{ASSIGNABLE_PERMISSION_KEYS.filter((key) => key !== "standard_question_bank.manage").map((key) => <option key={key} value={key}>{ASSIGNABLE_PERMISSION_LABELS[key]}</option>)}</select><button disabled={!selectedTenant} className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-40">授权</button></form></div>
            </div>
          </section>
          <section className="app-card overflow-hidden rounded-xl border"><div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)" }}><h2 className="text-sm font-semibold">当前生效授权</h2><p className="app-muted-text mt-1 text-[10px]">共 {grants.length} 条；收回后立即影响菜单、页面访问和服务器操作。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead><tr className="border-b text-[10px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="px-4 py-2.5 font-medium">账号</th><th className="px-4 py-2.5 font-medium">范围</th><th className="px-4 py-2.5 font-medium">授权权限</th><th className="px-4 py-2.5 font-medium">覆盖操作</th><th className="px-4 py-2.5 font-medium">授权人 / 时间</th><th className="px-4 py-2.5 text-right font-medium">操作</th></tr></thead><tbody>{grants.map((grant) => <tr key={grant.id} className="border-b text-xs last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="px-4 py-3"><p className="font-semibold">{profileName(profilesById.get(grant.subject_user_id), grant.subject_user_id)}</p><p className="app-muted-text mt-0.5 text-[10px]">…{grant.subject_user_id.slice(-8)}</p></td><td className="px-4 py-3">{grant.scope_type === "platform" ? "平台" : tenantsById.get(grant.tenant_id ?? "")?.name ?? "历史机构"}</td><td className="px-4 py-3"><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{ASSIGNABLE_PERMISSION_LABELS[grant.permission_key]}</span></td><td className="app-muted-text px-4 py-3 text-[10px]">{getCapabilitiesForGrant(grant.permission_key).map(({ capability }) => capability.label).join("、") || "模块管理"}</td><td className="px-4 py-3"><p>{profileName(profilesById.get(grant.granted_by), grant.granted_by)}</p><p className="app-muted-text mt-0.5 text-[10px]">{dateTimeFormatter.format(new Date(grant.granted_at))}</p></td><td className="px-4 py-3"><form action={updateUnifiedPermissionGrantAction} className="flex justify-end"><input type="hidden" name="targetUserId" value={grant.subject_user_id} /><input type="hidden" name="permissionKey" value={grant.permission_key} /><input type="hidden" name="tenantId" value={grant.tenant_id ?? ""} /><input type="hidden" name="enabled" value="false" /><input type="hidden" name="view" value="grants" /><button className="h-8 rounded-md border border-rose-200 px-2.5 text-[10px] font-semibold text-rose-700">收回</button></form></td></tr>)}</tbody></table></div>{grants.length === 0 && <div className="p-10 text-center text-xs"><KeyRound className="mx-auto opacity-25" size={24} /><p className="mt-2 font-semibold">当前没有单独授权</p></div>}</section>
        </div>
      )}

      {view === "audit" && (
        <section className="app-card overflow-hidden rounded-xl border"><div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)" }}><h2 className="text-sm font-semibold">权限审计记录</h2><p className="app-muted-text mt-1 text-[10px]">记录授权与收回，旧授权入口已经停止写入。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b text-[10px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="px-4 py-2.5 font-medium">时间</th><th className="px-4 py-2.5 font-medium">操作人</th><th className="px-4 py-2.5 font-medium">目标账号</th><th className="px-4 py-2.5 font-medium">范围</th><th className="px-4 py-2.5 font-medium">权限</th><th className="px-4 py-2.5 font-medium">结果</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id} className="border-b text-xs last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="app-muted-text px-4 py-3 tabular-nums">{dateTimeFormatter.format(new Date(log.created_at))}</td><td className="px-4 py-3">{log.actor_id ? profileName(profilesById.get(log.actor_id), log.actor_id) : "系统"}</td><td className="px-4 py-3 font-semibold">{profileName(profilesById.get(log.subject_user_id), log.subject_user_id)}</td><td className="px-4 py-3">{log.tenant_id ? tenantsById.get(log.tenant_id)?.name ?? "历史机构" : "平台"}</td><td className="px-4 py-3">{ASSIGNABLE_PERMISSION_LABELS[log.permission_key] ?? log.permission_key}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${log.action === "granted" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{log.action === "granted" ? "已授权" : "已收回"}</span></td></tr>)}</tbody></table></div>{auditLogs.length === 0 && <div className="p-10 text-center text-xs"><UsersRound className="mx-auto opacity-25" size={24} /><p className="mt-2 font-semibold">还没有统一权限变更记录</p></div>}</section>
      )}
    </div>
  );
}
