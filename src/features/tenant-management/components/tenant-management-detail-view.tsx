import Link from "next/link";
import { notFound } from "next/navigation";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  ManagementMetricStrip,
  ManagementPage,
} from "@/components/layout/management-page";
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
    <ManagementPage
      title={result.tenant.name}
      description="查看机构标识、服务状态、负责人和成员关系，并在当前权限范围内执行生命周期操作。"
      meta={<span>更新于 <LocalDateTime value={result.tenant.updatedAt} options={DATE_OPTIONS} /></span>}
      action={
        <Link
          href={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)}
          className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          返回机构管理
        </Link>
      }
    >

      <ManagementMetricStrip
        label="机构详情概况"
        items={[
          { label: "机构标识", value: result.tenant.slug },
          { label: "状态", value: STATUS_LABELS[result.tenant.status] },
          {
            label: "套餐",
            value: PLAN_LABELS[result.tenant.planKey] ?? result.tenant.planKey,
          },
          { label: "成员", value: result.members.length },
          { label: "有效负责人", value: result.managers.length },
        ]}
      />

      <section aria-labelledby="tenant-members-title" className="space-y-2">
        <h2 id="tenant-members-title" className="sr-only">机构成员</h2>
        <TenantMembersTable data={result.members} institutionName={result.tenant.name} />
      </section>

      <TenantLifecycleActions
        tenantId={result.tenant.id}
        tenantName={result.tenant.name}
        slug={result.tenant.slug}
        status={result.tenant.status}
        canPermanentlyDelete={result.viewer.canPermanentlyDelete}
        listHref={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)}
      />
    </ManagementPage>
  );
}
