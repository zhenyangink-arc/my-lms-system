import Link from "next/link";
import { ArrowLeft, Building2, KeyRound, ShieldCheck, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requirePlatformTenantManager } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TenantLifecycleControls } from "../TenantLifecycleControls";
import { AccountCreator } from "../../accounts/AccountCreator";


export const runtime = "edge";
type TenantRow = { id: string; name: string; slug: string; status: "active" | "suspended" | "archived"; plan_key: string; created_at: string };
type MembershipRow = { user_id: string; role: string; status: string; membership_tier: string; created_at: string };
type ProfileRow = { id: string; full_name: string | null; login_id: string | null };

const roleLabels: Record<string, string> = { tenant_super_admin: "机构负责人", ceo: "运营负责人", admin: "管理员", teacher: "教师", student: "学生" };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!isUuid(tenantId)) notFound();

  const { supabase } = await requirePlatformTenantManager();
  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id,name,slug,status,plan_key,created_at")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError || !tenantData) notFound();
  const tenant = tenantData as TenantRow;

  const { data: membershipData } = await supabase
    .from("tenant_memberships")
    .select("user_id,role,status,membership_tier,created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: true });
  const memberships = (membershipData ?? []) as MembershipRow[];
  const memberIds = memberships.map((member) => member.user_id);
  const { data: profileData } = memberIds.length
    ? await createAdminClient().from("profiles").select("id,full_name,login_id").in("id", memberIds)
    : { data: [] as ProfileRow[] };
  const profileById = new Map(((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const managers = memberships
    .filter((member) => member.role === "tenant_super_admin" && member.status === "active")
    .map((member) => {
      const profile = profileById.get(member.user_id);
      return { id: member.user_id, loginId: profile?.login_id ?? "平台负责人", name: profile?.full_name ?? "管理员" };
    });

  return (
    <div className="pb-12">
      <DashboardPageHeader title={tenant.name} description={`租户标识：${tenant.slug}`} action={<Link href="/dashboard/admin/tenants" className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black"><ArrowLeft size={16} />返回租户管理</Link>} />
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {tenant.status === "active" && <AccountCreator tenantId={tenant.id} compact />}
        <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end"><div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: tenant.status === "active" ? "var(--app-success)" : "var(--app-warm)", backgroundColor: tenant.status === "active" ? "var(--app-success-soft)" : "var(--app-warm-soft)" }}><ShieldCheck size={14} />{tenant.status === "active" ? "运行中" : "已停用，可恢复"}</span><h2 className="mt-3 text-2xl font-black">租户管理工作台</h2><p className="app-muted-text mt-2 text-sm leading-6">停用会停止该租户使用，但不会删除管理员账号和成员关系；删除则不可恢复，必须先停用并通过对话框确认。</p></div><div className="grid grid-cols-2 gap-3"><div className="app-soft-card rounded-2xl border p-4"><Users size={18} style={{ color: "var(--app-secondary)" }} /><p className="mt-2 text-2xl font-black">{memberships.length}</p><p className="app-muted-text text-xs font-bold">租户成员</p></div><div className="app-soft-card rounded-2xl border p-4"><Building2 size={18} style={{ color: "var(--app-accent)" }} /><p className="mt-2 text-sm font-black">{tenant.plan_key}</p><p className="app-muted-text text-xs font-bold">套餐</p></div></div></div></section>

        <section className="app-card rounded-3xl border p-5"><h2 className="text-xl font-black">租户管理员与成员</h2><p className="app-muted-text mt-1 text-xs">密码不会显示或保存到页面中；负责人可在下方为机构负责人重置密码。</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="app-muted-text border-b text-xs" style={{ borderColor: "var(--app-border-soft)" }}><tr><th className="px-3 py-3 font-black">姓名</th><th className="px-3 py-3 font-black">登录账号</th><th className="px-3 py-3 font-black">租户角色</th><th className="px-3 py-3 font-black">状态</th></tr></thead><tbody>{memberships.map((member) => { const profile = profileById.get(member.user_id); return <tr key={member.user_id} className="border-b" style={{ borderColor: "var(--app-border-soft)" }}><td className="px-3 py-3 font-bold">{profile?.full_name ?? "未填写姓名"}</td><td className="px-3 py-3 font-mono text-xs">{profile?.login_id ?? "历史账号"}</td><td className="px-3 py-3">{roleLabels[member.role] ?? member.role}</td><td className="px-3 py-3"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: member.status === "active" ? "var(--app-success)" : "var(--app-warm)", backgroundColor: member.status === "active" ? "var(--app-success-soft)" : "var(--app-warm-soft)" }}>{member.status === "active" ? "正常" : member.status}</span></td></tr>; })}</tbody></table></div>{memberships.length === 0 && <p className="app-muted-text mt-5 text-sm">当前没有成员记录。</p>}</section>

        <section className="app-card rounded-3xl border p-5"><div className="flex items-center gap-2"><KeyRound size={18} style={{ color: "var(--app-accent)" }} /><h2 className="text-xl font-black">负责人操作</h2></div><p className="app-muted-text mt-1 text-xs">停用和删除都会先弹出确认对话框；删除仅在停用后出现。</p><TenantLifecycleControls tenantId={tenant.id} slug={tenant.slug} status={tenant.status} managers={managers} /></section>
      </div>
    </div>
  );
}
