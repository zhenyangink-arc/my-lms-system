import { UsersRound } from "lucide-react";

import { AccountCreator } from "@/app/dashboard/admin/accounts/AccountCreator";
import { PlatformAccountCreator } from "@/app/dashboard/admin/accounts/PlatformAccountCreator";
import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getAccountList } from "../api/service";
import type { AccountSearchParams } from "../api/types";
import {
  AccountActivityDialog,
  AccountDeletionActivityDialog,
} from "./account-activity-dialogs";
import { AccountsTable } from "./accounts-table";

export default async function AccountListing({
  searchParams,
}: {
  searchParams: Promise<AccountSearchParams> | AccountSearchParams;
}) {
  const params = await searchParams;
  const result = await getAccountList(params);
  const activeCount = result.allProfiles.filter(
    (profile) => profile.status === "active",
  ).length;

  return (
    <ManagementPage
      eyebrow="组织与账号"
      title="账号管理"
      description={
        result.scope === "platform"
          ? "管理直属平台账号，查看账号状态，并创建符合平台角色边界的新成员。"
          : "管理本机构成员账号、状态与操作记录，所有变更限定在当前机构。"
      }
      icon={UsersRound}
      meta={
        <span>
          {result.scope === "platform" ? "直属平台账号" : "当前机构账号"}
        </span>
      }
      action={
        <>
          {result.scope === "tenant" && (
            <>
              <AccountActivityDialog
                logs={result.auditLogs}
                accountNames={result.accountNames}
              />
              {result.viewerRole === "tenant_super_admin" && (
                <AccountDeletionActivityDialog
                  logs={result.deletionAuditLogs}
                />
              )}
            </>
          )}
          {result.scope === "platform"
            ? result.viewerRole === "platform_super_admin" && (
                <PlatformAccountCreator />
              )
            : result.viewerRole === "tenant_super_admin" && (
                <AccountCreator
                  tenantId={result.tenantId ?? undefined}
                  dialog
                />
              )}
        </>
      }
    >
      {result.hasError && (
        <ManagementNotice tone="danger">
          部分账号或审计记录暂时无法读取，请稍后刷新重试。
        </ManagementNotice>
      )}
      {result.deletedStatus && (
        <ManagementNotice
          tone={result.deletedStatus === "success" ? "success" : "warning"}
        >
          {result.deletedStatus === "success"
            ? "账号及其关联数据已经永久删除，负责人审计记录已保留。"
            : "账号和数据库记录已经删除，但少量私有文件未能自动清理，请检查存储空间。"}
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="账号管理概况"
        items={[
          {
            label: "管理范围",
            value: result.scope === "platform" ? "直属平台" : "当前机构",
          },
          { label: "账号总数", value: result.allProfiles.length },
          { label: "正常使用", value: activeCount },
          {
            label: "当前结果",
            value: result.profiles.length,
            detail: "按当前筛选条件",
          },
        ]}
      />

      <AccountsTable
        data={result.profiles}
        scope={result.scope}
        viewerRole={result.viewerRole}
        filters={result.filters}
        hasFilters={result.hasFilters}
        totalCount={result.allProfiles.length}
      />
    </ManagementPage>
  );
}
