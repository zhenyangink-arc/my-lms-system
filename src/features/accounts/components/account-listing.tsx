import { AccountCreator } from "@/app/dashboard/admin/accounts/AccountCreator";
import { PlatformAccountCreator } from "@/app/dashboard/admin/accounts/PlatformAccountCreator";
import { getAccountList } from "../api/service";
import type { AccountSearchParams } from "../api/types";
import { AccountActivityDialog, AccountDeletionActivityDialog } from "./account-activity-dialogs";
import { AccountsTable } from "./accounts-table";

export default async function AccountListing({ searchParams }: { searchParams: Promise<AccountSearchParams> | AccountSearchParams }) {
  const params = await searchParams;
  const result = await getAccountList(params);
  const activeCount = result.allProfiles.filter((profile) => profile.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {result.scope === "tenant" && (
            <>
              <AccountActivityDialog logs={result.auditLogs} accountNames={result.accountNames} />
              {result.viewerRole === "tenant_super_admin" && <AccountDeletionActivityDialog logs={result.deletionAuditLogs} />}
            </>
          )}
        </div>
        {result.scope === "platform"
          ? result.viewerRole === "platform_super_admin" && <PlatformAccountCreator />
          : result.viewerRole === "tenant_super_admin" && <AccountCreator tenantId={result.tenantId ?? undefined} dialog />}
      </div>

      {result.deletedStatus && (
        <p role="status" className={`border px-4 py-3 text-xs font-semibold ${result.deletedStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {result.deletedStatus === "success"
            ? "账号及其关联数据已经永久删除，负责人审计记录已保留。"
            : "账号和数据库记录已经删除，但少量私有文件未能自动清理，请检查存储空间。"}
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
            <thead><tr><th>统计项目</th><th>账号总数</th><th>正常使用</th><th>当前结果</th><th>管理范围</th></tr></thead>
            <tbody><tr><th>当前数量</th><td>{result.allProfiles.length}</td><td>{activeCount}</td><td>{result.profiles.length}</td><td className="text-sm">{result.scope === "platform" ? "平台直属账号" : "当前机构账号"}</td></tr></tbody>
          </table>
        </div>
      </section>

      <AccountsTable data={result.profiles} scope={result.scope} viewerRole={result.viewerRole} filters={result.filters} hasFilters={result.hasFilters} totalCount={result.allProfiles.length} />
    </div>
  );
}
