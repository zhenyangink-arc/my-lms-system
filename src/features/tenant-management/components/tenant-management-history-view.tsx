import Link from "next/link";

import { LocalDateTime } from "@/components/LocalDateTime";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getTenantManagementHistoryData } from "../api/service";
import { TenantLifecycleAuditTable } from "./tenant-lifecycle-audit-table";
import { TenantMembershipAuditTable } from "./tenant-membership-audit-table";

const STATUS_LABELS = { suspended: "已停用", archived: "历史归档" } as const;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

export default async function TenantManagementHistoryView() {
  const result = await getTenantManagementHistoryData();
  const dashboardBasePath = getDashboardBasePath();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)} className="text-xs font-semibold text-[var(--app-text-soft)] hover:text-[var(--app-text)]">返回租户管理</Link>
        <p className="text-xs text-[var(--app-muted)]">仅展示审计记录，本步骤不提供恢复或删除操作</p>
      </div>

      {result.hasQueryError && <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">部分历史记录暂时无法读取，请稍后刷新重试。</div>}

      <section className="management-table-panel overflow-hidden border">
        <div className="border-b border-[var(--app-border)] px-4 py-3"><h2 className="text-sm font-semibold">可恢复的停用机构</h2><p className="mt-1 text-xs text-[var(--app-muted)]">停用和历史归档状态都保留成员及业务数据。</p></div>
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
            <thead><tr><th>机构</th><th>机构标识</th><th>状态</th><th>最近变更</th><th>查看</th></tr></thead>
            <tbody>{result.recoverableTenants.map((tenant) => <tr key={tenant.id}><th>{tenant.name}</th><td className="font-mono">{tenant.slug}</td><td>{STATUS_LABELS[tenant.status as keyof typeof STATUS_LABELS] ?? tenant.status}</td><td><LocalDateTime value={tenant.updatedAt} options={DATE_OPTIONS} /></td><td><Link href={scopeDashboardPath(`/dashboard/admin/tenants/${tenant.id}`, dashboardBasePath)} className="font-semibold hover:underline">查看详情</Link></td></tr>)}</tbody>
          </table>
        </div>
        {result.recoverableTenants.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--app-muted)]">当前没有停用或历史归档机构</div>}
      </section>

      <TenantLifecycleAuditTable data={result.lifecycleLogs} />
      <TenantMembershipAuditTable data={result.membershipLogs} />
    </div>
  );
}
