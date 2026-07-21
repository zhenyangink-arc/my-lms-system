import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Building2, History, RotateCcw, Trash2 } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requirePlatformTenantManager } from "@/lib/admin";


type TenantRow = { id: string; name: string; slug: string; status: "active" | "suspended" | "archived"; updated_at: string };
type LifecycleLog = { id: number; tenant_id: string; tenant_slug: string; action: "suspended" | "archived" | "restored" | "permanently_deleted"; created_at: string };

const actionMeta: Record<LifecycleLog["action"], { label: string; description: string; color: string; soft: string; icon: typeof ArchiveRestore }> = {
  suspended: { label: "已停用", description: "租户已停止使用，可在租户详情页恢复。", color: "var(--app-warm)", soft: "var(--app-warm-soft)", icon: ArchiveRestore },
  archived: { label: "历史停用记录", description: "旧版归档记录按停用处理，可恢复或永久删除。", color: "var(--app-warm)", soft: "var(--app-warm-soft)", icon: ArchiveRestore },
  restored: { label: "已恢复", description: "租户已重新进入运行状态。", color: "var(--app-success)", soft: "var(--app-success-soft)", icon: RotateCcw },
  permanently_deleted: { label: "已永久删除", description: "仅保留审计记录，无法恢复。", color: "#c94f45", soft: "#fff0ed", icon: Trash2 },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function TenantHistoryPage() {
  const { supabase } = await requirePlatformTenantManager();
  const [{ data: archivedData }, { data: logData }] = await Promise.all([
    supabase.from("tenants").select("id,name,slug,status,updated_at").in("status", ["suspended", "archived"]).order("updated_at", { ascending: false }),
    supabase.from("tenant_lifecycle_audit_logs").select("id,tenant_id,tenant_slug,action,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const archivedTenants = (archivedData ?? []) as TenantRow[];
  const logs = (logData ?? []) as LifecycleLog[];

  return (
    <div className="pb-12">
      <DashboardPageHeader title="停用租户与删除记录" description="查看可恢复的停用租户，以及停用、恢复和永久删除的审计记录。" action={<Link href="/dashboard/admin/tenants" className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black"><ArrowLeft size={16} />返回租户管理</Link>} />
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><ArchiveRestore size={20} /></span><div><h2 className="text-xl font-black">可恢复的停用租户</h2><p className="app-muted-text mt-1 text-sm leading-6">停用不是删除。这里的租户仍保留管理员和成员关系，进入详情页后可恢复使用，或在确认后永久删除。</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{archivedTenants.map((tenant) => <Link key={tenant.id} href={`/dashboard/admin/tenants/${tenant.id}`} className="app-soft-card rounded-2xl border p-4 transition hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{tenant.name}</h3><p className="app-muted-text mt-1 font-mono text-xs">{tenant.slug}</p></div><Building2 size={18} style={{ color: "var(--app-warm)" }} /></div><p className="mt-4 text-xs font-black" style={{ color: "var(--app-warm)" }}>进入详情恢复或删除</p></Link>)}{archivedTenants.length === 0 && <div className="col-span-full rounded-2xl border border-dashed p-7 text-center"><ArchiveRestore className="mx-auto opacity-30" size={28} /><p className="mt-3 font-black">没有停用中的租户</p></div>}</div></section>

        <section className="app-card rounded-3xl border p-5 sm:p-6"><div className="flex items-center gap-2"><History size={19} style={{ color: "var(--app-accent)" }} /><div><h2 className="text-xl font-black">租户操作记录</h2><p className="app-muted-text mt-1 text-xs">永久删除后，审计记录仍会保留在这里。</p></div></div><div className="mt-5 space-y-3">{logs.map((log) => { const meta = actionMeta[log.action]; const Icon = meta.icon; return <article key={log.id} className="app-soft-card flex items-start gap-3 rounded-2xl border p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: meta.color, backgroundColor: meta.soft }}><Icon size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{meta.label} · <span className="font-mono text-sm">{log.tenant_slug}</span></p><time className="app-muted-text text-xs font-bold">{dateFormatter.format(new Date(log.created_at))}</time></div><p className="app-muted-text mt-1 text-xs leading-5">{meta.description}</p></div></article>; })}{logs.length === 0 && <div className="rounded-2xl border border-dashed p-7 text-center"><History className="mx-auto opacity-30" size={28} /><p className="mt-3 font-black">还没有租户操作记录</p></div>}</div></section>
      </div>
    </div>
  );
}
