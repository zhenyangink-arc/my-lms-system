import Link from "next/link";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
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
    <ManagementPage
      title="机构历史记录"
      description="查看停用或归档机构，以及机构生命周期和成员关系的历史审计记录。"
      action={
        <Link
          href={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)}
          className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          返回机构管理
        </Link>
      }
    >

      {result.hasQueryError && (
        <ManagementNotice tone="danger">
          部分历史记录暂时无法读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="border-b border-[var(--border)] px-4 py-3"><h2 className="text-sm font-semibold">可恢复的停用机构</h2><p className="mt-1 text-xs text-[var(--foreground-muted)]">停用和历史归档状态都保留成员及业务数据。</p></div>
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
            <thead><tr><th>机构</th><th>机构标识</th><th>状态</th><th>最近变更</th><th>查看</th></tr></thead>
            <tbody>{result.recoverableTenants.map((tenant) => <tr key={tenant.id}><th>{tenant.name}</th><td className="font-mono">{tenant.slug}</td><td>{STATUS_LABELS[tenant.status as keyof typeof STATUS_LABELS] ?? tenant.status}</td><td><LocalDateTime value={tenant.updatedAt} options={DATE_OPTIONS} /></td><td><Link href={scopeDashboardPath(`/dashboard/admin/tenants/${tenant.id}`, dashboardBasePath)} className="font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">查看详情</Link></td></tr>)}</tbody>
          </table>
        </div>
        {result.recoverableTenants.length === 0 && <div className="px-5 py-8 text-center text-sm text-[var(--foreground-muted)]">当前没有停用或历史归档机构</div>}
      </section>

      <TenantLifecycleAuditTable data={result.lifecycleLogs} />
      <TenantMembershipAuditTable data={result.membershipLogs} />
    </ManagementPage>
  );
}
