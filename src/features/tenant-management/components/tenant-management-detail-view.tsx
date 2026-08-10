import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalDateTime } from "@/components/LocalDateTime";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getTenantManagementDetailData } from "../api/service";
import { TenantLifecycleActions } from "./tenant-lifecycle-actions";
import { TenantMembersTable } from "./tenant-members-table";

const STATUS_LABELS = { active: "运行中", suspended: "已停用", archived: "历史归档" } as const;
const PLAN_LABELS: Record<string, string> = { legacy: "历史兼容", starter: "入门套餐", growth: "成长套餐", enterprise: "企业套餐" };
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

export default async function TenantManagementDetailView({ tenantId }: { tenantId: string }) {
  const result = await getTenantManagementDetailData(tenantId);
  if (!result) notFound();
  const dashboardBasePath = getDashboardBasePath();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)} className="text-xs font-semibold text-[var(--app-text-soft)] hover:text-[var(--app-text)]">返回租户管理</Link>
        <p className="text-xs text-[var(--app-muted)]">最近更新：<LocalDateTime value={result.tenant.updatedAt} options={DATE_OPTIONS} /></p>
      </div>

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead><tr><th>机构</th><th>机构标识</th><th>状态</th><th>套餐</th><th>成员</th><th>有效负责人</th></tr></thead>
            <tbody><tr><th>{result.tenant.name}</th><td className="font-mono">{result.tenant.slug}</td><td>{STATUS_LABELS[result.tenant.status]}</td><td>{PLAN_LABELS[result.tenant.planKey] ?? result.tenant.planKey}</td><td>{result.members.length}</td><td>{result.managers.length}</td></tr></tbody>
          </table>
        </div>
      </section>

      <TenantLifecycleActions
        tenantId={result.tenant.id}
        tenantName={result.tenant.name}
        slug={result.tenant.slug}
        status={result.tenant.status}
        canPermanentlyDelete={result.viewer.canPermanentlyDelete}
        listHref={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)}
      />

      <TenantMembersTable data={result.members} institutionName={result.tenant.name} />
    </div>
  );
}
